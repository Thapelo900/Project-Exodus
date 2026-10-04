import { Billboard, BillboardMode, Entity, Material, MaterialTransparencyMode, MeshRenderer, Transform, engine } from '@dcl/sdk/ecs'
import { Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import { LootState } from '../shared/schemas'

type LootVisual = { root:Entity; icon:Entity; lastPosition:Vector3; phase:'idle'|'pickup'; age:number; seed:number }
const visuals = new Map<string, LootVisual>()

const styleFor = (kind:string) => {
  if(kind==='medkit')return {image:'images/loot-medkit.png',color:'#ff2525ff'}
  if(kind==='water'||kind==='shield-cell')return {image:'images/loot-water.png',color:'#25a9ffff'}
  if(kind==='bomb')return {image:'images/loot-bomb.png',color:'#b72cffff'}
  if(kind==='ammo-pistol')return {image:'images/loot-ammo-pistol.png',color:'#39e66fff'}
  if(kind==='ammo-rifle')return {image:'images/loot-ammo-rifle.png',color:'#b72cffff'}
  if(kind==='ammo-shotgun')return {image:'images/loot-ammo-shotgun.png',color:'#ffd226ff'}
  if(kind==='life-credit')return {image:'images/loot-bomb.png',color:'#d15cffff'}
  return {image:'images/loot-ammo.png',color:'#ff9d26ff'}
}

function createVisual(parent:Entity,kind:string,amount:number,position:Vector3):LootVisual{
  // Hide any authored placeholder pickup mesh (the old white/grey box). The pickup is represented only by its icon.
  MeshRenderer.deleteFrom(parent)
  const style=styleFor(kind),glow=Color4.fromHexString(style.color)
  const root=engine.addEntity();Transform.create(root,{position:Vector3.create(0,.42,0),parent})
  // Pickup presentation is intentionally image-only: no box, ring, halo or text block.
  const icon=engine.addEntity();Transform.create(icon,{position:Vector3.create(0,.34,0),scale:Vector3.create(1.9,1.9,1),rotation:Quaternion.fromEulerDegrees(0,180,0),parent:root});MeshRenderer.setPlane(icon);Billboard.create(icon,{billboardMode:BillboardMode.BM_Y})
  const texture=Material.Texture.Common({src:style.image})
  Material.setPbrMaterial(icon,{texture,emissiveTexture:texture,emissiveColor:glow,emissiveIntensity:1.8,roughness:.35,metallic:0,transparencyMode:MaterialTransparencyMode.MTM_ALPHA_BLEND})
  return {root,icon,lastPosition:Vector3.clone(position),phase:'idle',age:0,seed:Math.random()*10}
}

function destroyVisual(visual:LootVisual){engine.removeEntity(visual.icon);engine.removeEntity(visual.root)}

function lootVisualSystem(dt:number){
  const seen=new Set<string>(),now=Date.now()/1000
  for(const[entity,loot,transform]of engine.getEntitiesWith(LootState,Transform)){
    seen.add(loot.lootId)
    let visual=visuals.get(loot.lootId)
    if(!visual&&loot.active){visual=createVisual(entity,loot.kind,loot.amount,transform.position);visuals.set(loot.lootId,visual)}
    if(!visual)continue
    if(loot.active){visual.lastPosition=Vector3.clone(transform.position);const t=Transform.getMutable(visual.root),pulse=1+Math.sin(now*4+visual.seed)*.06;t.position.y=.45+Math.sin(now*2.6+visual.seed)*.16;t.rotation=Quaternion.fromEulerDegrees(0,now*42+visual.seed*20,0);const glitch=Math.sin(now*19+visual.seed)>.93?1.16:1;Transform.getMutable(visual.icon).scale=Vector3.create(1.65*glitch,1.65/glitch,1)}
    else if(visual.phase==='idle'){visual.phase='pickup';visual.age=0;const t=Transform.getMutable(visual.root);t.parent=engine.RootEntity;t.position=Vector3.add(visual.lastPosition,Vector3.create(0,.5,0))}
  }
  for(const[id,visual]of visuals){
    if(visual.phase==='pickup'){visual.age+=dt;const t=Transform.getMutable(visual.root),p=Math.min(1,visual.age/.48),scale=Math.max(.001,1-p);t.position.y+=dt*(2.4+p*3);t.rotation=Quaternion.fromEulerDegrees(0,p*520,0);t.scale=Vector3.create(scale,scale,scale);if(p>=1){destroyVisual(visual);visuals.delete(id)}}
    else if(!seen.has(id)){destroyVisual(visual);visuals.delete(id)}
  }
}

export function setupLootVisuals(){engine.addSystem(lootVisualSystem)}
