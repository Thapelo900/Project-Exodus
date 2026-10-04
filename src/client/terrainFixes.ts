import { ColliderLayer, Entity, GltfContainer, Material, MeshCollider, MeshRenderer, Transform, engine } from '@dcl/sdk/ecs'
import { Color4, Quaternion, Vector3 } from '@dcl/sdk/math'

function part(position:Vector3,scale:Vector3,rotation:Quaternion,color:Color4,collider=false){
  const e=engine.addEntity();Transform.create(e,{position,scale,rotation});MeshRenderer.setBox(e)
  if(collider)MeshCollider.setBox(e,ColliderLayer.CL_PHYSICS|ColliderLayer.CL_POINTER)
  Material.setPbrMaterial(e,{albedoColor:color,metallic:.35,roughness:.62});return e
}
function fixedBridge(ax:number,az:number,bx:number,bz:number){
  const dx=bx-ax,dz=bz-az,length=Math.hypot(dx,dz),yaw=Math.atan2(dx,dz)*180/Math.PI
  const rot=Quaternion.fromEulerDegrees(0,yaw,0),x=(ax+bx)/2,z=(az+bz)/2,ox=dz/length*4.15,oz=-dx/length*4.15
  part(Vector3.create(x,1.75,z),Vector3.create(8,.7,length),rot,Color4.fromHexString('#293036ff'),true)
  part(Vector3.create(x,2.12,z),Vector3.create(6.8,.12,length),rot,Color4.fromHexString('#1f2224ff'),true)
  part(Vector3.create(x+ox,2.65,z+oz),Vector3.create(.22,1.45,length),rot,Color4.fromHexString('#f04008ff'),true)
  part(Vector3.create(x-ox,2.65,z-oz),Vector3.create(.22,1.45,length),rot,Color4.fromHexString('#f04008ff'),true)
}
function box(parent:Entity,pos:Vector3,scale:Vector3,color:Color4,rot=Quaternion.Identity()){
 const e=engine.addEntity();Transform.create(e,{parent,position:pos,scale,rotation:rot});MeshRenderer.setBox(e);Material.setPbrMaterial(e,{albedoColor:color,emissiveColor:color,emissiveIntensity:1.25,metallic:.35,roughness:.28});return e
}
function terminal3D(position:Vector3,kind:'gear'|'shop'|'mission'){
 const root=engine.addEntity();Transform.create(root,{position:Vector3.create(position.x,position.y+2.0,position.z),scale:Vector3.create(.82,.82,.82)})
 const green=Color4.fromHexString('#35ff72ff'),yellow=Color4.fromHexString('#ffbf27ff'),blue=Color4.fromHexString('#29d9ffff'),dark=Color4.fromHexString('#111820ff'),metal=Color4.fromHexString('#39434cff'),olive=Color4.fromHexString('#5f702fff'),col=kind==='gear'?green:kind==='shop'?yellow:blue
 // Chunky 3D pickup-style pedestal with luminous trim, built entirely from geometry (no flat icon picture).
 box(root,Vector3.create(0,-1.18,0),Vector3.create(2.55,.28,1.35),dark)
 box(root,Vector3.create(0,-.98,0),Vector3.create(2.2,.10,1.12),col)
 box(root,Vector3.create(-1.15,-1.0,0),Vector3.create(.18,.55,1.15),metal);box(root,Vector3.create(1.15,-1.0,0),Vector3.create(.18,.55,1.15),metal)
 if(kind==='gear'){
   // Open military storage chest with raised lid, cases and medical/ammo shapes inside.
   box(root,Vector3.create(0,-.25,0),Vector3.create(1.9,.82,1.02),olive)
   box(root,Vector3.create(0,.42,.34),Vector3.create(1.9,.18,1.02),olive,Quaternion.fromEulerDegrees(-32,0,0))
   box(root,Vector3.create(-.55,.12,-.18),Vector3.create(.52,.36,.44),dark);box(root,Vector3.create(.2,.12,-.2),Vector3.create(.45,.38,.4),Color4.fromHexString('#69754cff'))
   box(root,Vector3.create(.7,.14,-.18),Vector3.create(.12,.42,.12),yellow);box(root,Vector3.create(.86,.14,-.18),Vector3.create(.12,.42,.12),yellow)
   // crossed tool silhouette above the chest
   box(root,Vector3.create(-.12,1.12,0),Vector3.create(.18,1.05,.18),col,Quaternion.fromEulerDegrees(0,0,43));box(root,Vector3.create(.12,1.12,0),Vector3.create(.18,1.05,.18),col,Quaternion.fromEulerDegrees(0,0,-43))
 }else if(kind==='shop'){
   // Fully 3D trader stall: counter, canopy, shelves and supply blocks.
   box(root,Vector3.create(0,-.2,0),Vector3.create(2.15,.32,1.05),Color4.fromHexString('#7b4a20ff'))
   box(root,Vector3.create(0,.82,.42),Vector3.create(2.15,.14,.78),Color4.fromHexString('#b66a27ff'),Quaternion.fromEulerDegrees(-8,0,0))
   box(root,Vector3.create(-.92,.34,.38),Vector3.create(.12,1.25,.12),metal);box(root,Vector3.create(.92,.34,.38),Vector3.create(.12,1.25,.12),metal)
   for(const x of [-.62,-.2,.22,.64]){box(root,Vector3.create(x,.26,.2),Vector3.create(.28,.32,.28),Color4.fromHexString('#8b672fff'))}
   box(root,Vector3.create(0,1.36,0),Vector3.create(1.1,.16,.22),col);box(root,Vector3.create(-.42,1.68,0),Vector3.create(.14,.7,.14),col,Quaternion.fromEulerDegrees(0,0,-18));box(root,Vector3.create(.42,1.68,0),Vector3.create(.14,.7,.14),col,Quaternion.fromEulerDegrees(0,0,18))
 }else{
   // Thick mission board with frame, map blocks, pinned job cards and 3D exclamation mark.
   box(root,Vector3.create(0,.22,0),Vector3.create(2.05,1.5,.28),metal)
   box(root,Vector3.create(0,.24,-.17),Vector3.create(1.68,1.15,.08),Color4.fromHexString('#aa956cff'))
   box(root,Vector3.create(-.55,.45,-.24),Vector3.create(.42,.46,.06),Color4.fromHexString('#d7c89aff'));box(root,Vector3.create(.35,.35,-.24),Vector3.create(.72,.62,.06),Color4.fromHexString('#9f8d68ff'))
   box(root,Vector3.create(0,1.62,0),Vector3.create(.24,1.0,.24),col);box(root,Vector3.create(0,.98,0),Vector3.create(.3,.3,.3),col)
 }
 let a=0;engine.addSystem(function spin(dt){const t=Transform.getMutableOrNull(root);if(!t){engine.removeSystem(spin);return}a=(a+dt*28)%360;t.rotation=Quaternion.fromEulerDegrees(0,a,0)})
}


export function setupTerrainFixes(){
 let done=false
 engine.addSystem(()=>{
  if(done)return
  const ready=engine.getEntityOrNullByName('Outpost Mission Board');if(ready===null||ready===undefined)return
  // v101 collision policy: every authored world GLB is solid for physics/raycast navigation.
  // Water/splash/FX are intentionally non-solid. First-person weapon models and projectile visuals
  // are also excluded because they are UI/combat visuals rather than world geometry.
  const nonSolidGlb=(src:string)=>{const s=src.toLowerCase();return s.includes('water')||s.includes('splash')||s.includes('bullet')||s.includes('playerhand')||s.includes('playerrifle')||s.includes('playerpistol')||s.includes('playershotgun')}
  for(const [e,gltf] of engine.getEntitiesWith(GltfContainer)){
    if(nonSolidGlb(gltf.src))continue
    GltfContainer.createOrReplace(e,{src:gltf.src,visibleMeshesCollisionMask:ColliderLayer.CL_PHYSICS|ColliderLayer.CL_POINTER,invisibleMeshesCollisionMask:ColliderLayer.CL_PHYSICS})
  }
  const terrain=engine.getEntityOrNullByName('Island Terrain GLB');if(terrain!==null&&terrain!==undefined){const gt=GltfContainer.getOrNull(terrain as Entity);if(gt)GltfContainer.createOrReplace(terrain as Entity,{src:gt.src,visibleMeshesCollisionMask:ColliderLayer.CL_PHYSICS|ColliderLayer.CL_POINTER,invisibleMeshesCollisionMask:ColliderLayer.CL_PHYSICS})}
  for(const bridge of ['Outpost City Bridge','Arena City Bridge','Camp City Bridge','Ruins City Bridge','Plant City Bridge','Docks City Bridge'])for(const partName of ['Deck','Road','Rail Left','Rail Right']){const e=engine.getEntityOrNullByName(`${bridge} ${partName}`);if(e!==null&&e!==undefined)MeshCollider.setBox(e as Entity,ColliderLayer.CL_PHYSICS|ColliderLayer.CL_POINTER)}
  // v84: bridge geometry is authored directly at the approved Preview coordinates, so Edit and Preview stay identical.
  // Remove the obsolete small Beach plane/platform and its palm trees from the water.
  for(const name of ['Beach Bay','Beach Road','Beach Sand','Beach Firepit','Beach Fire','Beach Bench 0','Beach Bench 1','Beach Bench 2','Beach Sign', ...Array.from({length:4},(_,i)=>`Beach Palm ${i} Trunk`), ...Array.from({length:4},(_,i)=>Array.from({length:5},(_,j)=>`Beach Palm ${i} Leaf ${j}`)).flat()]){const e=engine.getEntityOrNullByName(name);if(e!==null&&e!==undefined){Transform.getMutable(e as Entity).scale=Vector3.Zero()}}
  // Replace the old Ruins renderer at its authored transform with the newly supplied GLB.
  const ruins=engine.getEntityOrNullByName('Ruins GLB');if(ruins!==null&&ruins!==undefined){GltfContainer.createOrReplace(ruins as Entity,{src:'assets/Models/Ruins_v16_supplied.glb',visibleMeshesCollisionMask:ColliderLayer.CL_PHYSICS|ColliderLayer.CL_POINTER,invisibleMeshesCollisionMask:ColliderLayer.CL_PHYSICS});const rt=Transform.getMutable(ruins as Entity);rt.position=Vector3.create(93,rt.position.y,296);rt.rotation=Quaternion.fromEulerDegrees(0,180,0)}
  // Move The Plant fully onto the RIGHT island and keep its existing height/orientation/scale.
  // Authored center is x=211; right-island centered placement is x=270.
  const plant=engine.getEntityOrNullByName('Plant GLB');if(plant!==null&&plant!==undefined){const t=Transform.getMutable(plant as Entity);t.position=Vector3.create(270,t.position.y,384)}
  // Replace flat picture terminals with actual 3D hologram geometry.
  for(const [name,pos,kind] of [['Outpost Mission Board',Vector3.create(104,1,101.75),'mission'],['Outpost Shop Terminal',Vector3.create(105.5,1,118.25),'shop'],['Outpost Inventory Terminal',Vector3.create(88,1,119.75),'gear']] as const){const e=engine.getEntityOrNullByName(name);if(e!==null&&e!==undefined)MeshRenderer.deleteFrom(e as Entity);terminal3D(pos,kind)}
  done=true
 })
}
