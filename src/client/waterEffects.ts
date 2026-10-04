import { Entity, Material, MeshRenderer, Transform, engine } from '@dcl/sdk/ecs'
import { Color4, Vector3 } from '@dcl/sdk/math'
import { isInsideCombatLand, isOnMutantBridge } from '../shared/config'
import { playWaterSplashSound } from './audio'

const OUTPOST={x:96,z:112,hw:18,hd:20}
function dry(p:{x:number;z:number}){return isInsideCombatLand(p)||isOnMutantBridge(p)||(Math.abs(p.x-OUTPOST.x)<=OUTPOST.hw&&Math.abs(p.z-OUTPOST.z)<=OUTPOST.hd)}
let wasWater=false
const splashes=new Map<Entity,{born:number,vx:number,vy:number,vz:number}>()
const waterBits:Entity[]=[]

function splash(p:Vector3){
  playWaterSplashSound()
  const now=Date.now()
  // Broken-up droplets/pieces instead of one large circle.
  for(let i=0;i<18;i++){
    const e=engine.addEntity(),a=(i/18)*Math.PI*2,j=.25+(i%5)*.12
    Transform.create(e,{position:Vector3.create(p.x+Math.cos(a)*j,.72,p.z+Math.sin(a)*j),scale:Vector3.create(.07+(i%3)*.035,.05+(i%2)*.025,.07+(i%4)*.025)})
    if(i%3===0)MeshRenderer.setBox(e);else MeshRenderer.setSphere(e)
    Material.setPbrMaterial(e,{albedoColor:Color4.fromHexString('#76ddffff'),emissiveColor:Color4.fromHexString('#2baeeeff'),emissiveIntensity:.8,roughness:.18})
    splashes.set(e,{born:now,vx:Math.cos(a)*(1.1+(i%4)*.35),vy:1.15+(i%5)*.18,vz:Math.sin(a)*(1.1+(i%4)*.35)})
  }
}
function makeWaterLife(){
  // Lightweight moving glints/bubbles under the surface make the river feel alive without colliders.
  for(let i=0;i<28;i++){
    const e=engine.addEntity(),x=12+(i*83)%456,z=10+(i*137)%460
    Transform.create(e,{position:Vector3.create(x,.28-(i%4)*.08,z),scale:Vector3.create(.08,.08,.08)})
    MeshRenderer.setSphere(e);Material.setPbrMaterial(e,{albedoColor:Color4.fromHexString('#9beaff99'),emissiveColor:Color4.fromHexString('#49c8eeff'),emissiveIntensity:.45,roughness:.2});waterBits.push(e)
  }
}
export function setupWaterEffects(){
  makeWaterLife();let time=0
  engine.addSystem((dt)=>{
    time+=dt
    const t=Transform.getOrNull(engine.PlayerEntity)
    if(t){
      // Splash only when the avatar physically reaches the water surface. Horizontal travel
      // beyond a bridge/outpost while still airborne must never trigger the splash early.
      const overWater=!dry(t.position), touchingWater=overWater&&t.position.y<=1.05
      if(touchingWater&&!wasWater)splash(Vector3.create(t.position.x,.62,t.position.z))
      wasWater=touchingWater
    }
    const now=Date.now()
    for(const[e,s]of splashes){const x=Transform.getMutableOrNull(e);if(!x||now-s.born>720){if(x)engine.removeEntity(e);splashes.delete(e);continue}x.position.x+=s.vx*dt;x.position.z+=s.vz*dt;x.position.y+=s.vy*dt;s.vy-=3.5*dt;x.scale=Vector3.scale(x.scale,.965)}
    for(let i=0;i<waterBits.length;i++){const x=Transform.getMutableOrNull(waterBits[i]);if(!x)continue;x.position.y=.22+Math.sin(time*1.4+i*.7)*.11;x.position.x+=Math.sin(time*.35+i)*dt*.08;x.position.z+=Math.cos(time*.31+i*.4)*dt*.08}
  })
}
