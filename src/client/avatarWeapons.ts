import {
  AvatarAnchorPointType,
  AvatarAttach,
  CameraMode,
  CameraType,
  Entity,
  GltfContainer,
  Material,
  MeshRenderer,
  PlayerIdentityData,
  Transform,
  engine
} from '@dcl/sdk/ecs'
import { Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import { getPlayer } from '@dcl/sdk/src/players'
import { PlayerState } from '../shared/schemas'
import { isInsideOutpost, type WeaponId } from '../shared/config'
import { clientState } from './state'
import { getLocalSoloPlayer } from './localSolo'

type WearableGun = { root: Entity; gripPivot: Entity; model: Entity; muzzleFlash: Entity; parts: Entity[]; weapon: WeaponId | ''; firingUntil:number }

const guns = new Map<string, WearableGun>()
let elapsed = 0

function gunPart(parent: Entity, position: Vector3, scale: Vector3, color: string, cylinder = false) {
  const entity = engine.addEntity()
  Transform.create(entity, { position, scale, parent })
  if (cylinder) MeshRenderer.setCylinder(entity, .5, .5); else MeshRenderer.setBox(entity)
  Material.setPbrMaterial(entity, { albedoColor: Color4.fromHexString(color), metallic: .7, roughness: .34 })
  return entity
}

function createGun(address: string) {
  const root = engine.addEntity()
  Transform.create(root, { position: Vector3.create(.02,-.52,.115), rotation: Quaternion.fromEulerDegrees(4,0,-8), scale: Vector3.create(1,1,1) })
  // v158: position-only palm alignment from marked side-view reference. Rotation remains locked; root is moved down and slightly toward the palm.
  // v157: third-person weapons stay on the RIGHT hand. Palm alignment update: the complete weapon assembly is lowered so the GLB grip meets the avatar palm.
  // v156: third-person weapons stay on the RIGHT hand. The weapon mesh is mirrored
  // left-to-right around the vertical axis, then lowered so the grip seats in the palm.
  AvatarAttach.create(root, { avatarId: address, anchorPointId: AvatarAnchorPointType.AAPT_RIGHT_HAND })

  // v159: dedicated grip pivot. The avatar hand drives only `root`; all palm alignment
  // is now isolated on this child pivot so hand animation cannot overwrite the gun offset.
  const gripPivot = engine.addEntity()
  // v163: v162 proved this local hand axis is reversed. Keep the proven vertical seat (.39)
  // and reverse only the sideways/inward offset so the gun grip moves toward the hand edge
  // and into the avatar palm instead of away from it.
  // v164 moved the grip/depth away from the palm and pushed the weapon into clothing.
  // v166 restored the palm depth. v167 adds a small outward/trigger alignment correction so the
  // parked index finger sits through the trigger area while the receiver remains clear of clothing.
  // v168: restore the v161 vertical seat exactly and reverse BOTH later v162 lateral/depth offsets.
  // Rotation remains completely untouched.
  // v169: back/side reference correction: seat the grip into the palm. Keep v161 Y and all rotations untouched.
  // v170: final small position-only palm-center correction. Move the complete grip pivot inward on the
  // local lateral/depth axes only; preserve the v161 Y seat and every weapon rotation/scale.
  // v171: continue the same proven inward direction from the new side/back references. Center the
  // grip on the right-hand palm by removing the remaining lateral/depth gap only. Y, rotation and scale stay locked.
  // v173: v172 proved the correct magnitude but the horizontal direction was reversed.
  // Mirror that same X/Z displacement across the v171 zero point so the grip moves INTO the right palm
  // in both side and rear views. Keep the proven v161 Y (.39), rotation and scale untouched.
  // v175: side-view correction. v174 proved +Z moves the grip away from the palm, so reverse only the depth movement by the same 0.20 amount. Keep the v173 rear-view X alignment and v161 Y placement unchanged.
  // v177: calibrated trigger/finger alignment. Runtime screenshots show Z=0 leaves the trigger slightly outside the finger, while Z=-0.10 overshoots past it. Use a controlled interpolated depth offset between those tested positions. Keep X/Y, rotation and scale unchanged.
  // v179: runtime screenshot proved the v178 +Y adjustment moved the grip away from the palm. Reverse that exact 0.045 vertical displacement across the proven v177 Y=.39 baseline, while preserving X/Z, rotation, scale, and the v178 clothing-clearance model offsets.
  Transform.create(gripPivot, { parent: root, position: Vector3.create(.10,.345,-.035), rotation: Quaternion.Identity(), scale: Vector3.create(1,1,1) })

  const model = engine.addEntity()
  Transform.create(model, { parent: gripPivot, position: Vector3.create(0,0,0), rotation: Quaternion.fromEulerDegrees(0,-90,0), scale: Vector3.create(.8,.8,.8) })
  GltfContainer.create(model, { src: 'assets/Models/AvatarRifle_v132.glb' })

  // Muzzle flash follows the independent weapon pivot as well.
  const muzzleFlash=gunPart(gripPivot,Vector3.create(0,.02,.86),Vector3.create(.001,.001,.001),'#ffb020ff')
  Material.setPbrMaterial(muzzleFlash,{albedoColor:Color4.fromHexString('#fff2a0ff'),emissiveColor:Color4.fromHexString('#ff5a00ff'),emissiveIntensity:12,metallic:0,roughness:.1})
  const record={root,gripPivot,model,muzzleFlash,parts:[root,gripPivot,model,muzzleFlash],weapon:'' as WeaponId|'',firingUntil:0}
  guns.set(address,record)
  return record
}

function applyWeaponModel(gun:WearableGun, weapon:WeaponId){
  if(gun.weapon===weapon)return
  gun.weapon=weapon
  const model=Transform.getMutable(gun.model)
  // v156: horizontal left/right flip only: reverse yaw by 180 degrees while preserving
  // the existing low-ready roll. This avoids another top/bottom flip.
  model.rotation=Quaternion.fromEulerDegrees(0,90,90)
  if(weapon==='rail-pistol'){
    GltfContainer.createOrReplace(gun.model,{src:'assets/Models/AvatarPistol_v132.glb'})
    model.rotation=Quaternion.fromEulerDegrees(0,90,90)
    // v183: fine palm-seat correction from the close-up runtime reference. Keep the proven v182 scale/rotation/X/Z unchanged and move only along the pistol's rotated local Y axis by 0.025 toward the palm so the grip seats fully inside the hand without repeating the earlier large overshoot.
    model.position=Vector3.create(-.020,-.135,.035);model.scale=Vector3.create(.34,.34,.34)
  } else if(weapon==='scattergun'){
    GltfContainer.createOrReplace(gun.model,{src:'assets/Models/AvatarShotgun_v132.glb'})
    model.rotation=Quaternion.fromEulerDegrees(10,90,90)
    model.position=Vector3.create(-.030,-.085,.060);model.scale=Vector3.create(.86,.86,.86)
  } else {
    GltfContainer.createOrReplace(gun.model,{src:'assets/Models/AvatarRifle_v132.glb'})
    model.rotation=Quaternion.fromEulerDegrees(0,90,90)
    model.position=Vector3.create(-.030,-.085,.060);model.scale=Vector3.create(.88,.88,.88)
  }
}

function removeGun(address:string){const gun=guns.get(address);if(!gun)return;for(const entity of [...gun.parts].reverse())engine.removeEntity(entity);guns.delete(address)}

function syncedStateFor(address:string){
  for(const[,candidate]of engine.getEntitiesWith(PlayerState))if(candidate.playerId.toLowerCase()===address)return candidate
  return undefined
}

function setGunVisible(gun:WearableGun,visible:boolean){
  Transform.getMutable(gun.root).scale=visible?Vector3.create(1,1,1):Vector3.create(.001,.001,.001)
}

export function triggerAvatarWeaponFire(address:string){
  const key=address.toLowerCase(),gun=guns.get(key)
  if(!gun)return
  gun.firingUntil=Date.now()+150
}

function animateGun(gun:WearableGun){
  const firing=Date.now()<gun.firingUntil
  const root=Transform.getMutable(gun.root)
  root.position=firing?Vector3.create(.02,-.505,.095):Vector3.create(.02,-.52,.115)
  root.rotation=firing?Quaternion.fromEulerDegrees(-6,0,-8):Quaternion.fromEulerDegrees(4,0,-8)
  Transform.getMutable(gun.muzzleFlash).scale=firing?Vector3.create(.16,.16,.22):Vector3.create(.001,.001,.001)
}

export function setupAvatarWeapons(){
  engine.addSystem((dt)=>{
    elapsed+=dt;if(elapsed<.12)return;elapsed=0
    const localAddress=getPlayer()?.userId.toLowerCase()??'',present=new Set<string>()

    // Remote avatars: only the right-hand world weapon is rendered. The FPS hands/viewmodel
    // lives in viewmodel.ts and is never replicated or attached to another avatar.
    for(const[avatarEntity,identity]of engine.getEntitiesWith(PlayerIdentityData)){
      const address=identity.address.toLowerCase();if(!address||address===localAddress)continue
      const state=syncedStateFor(address)
      if(!state?.joined)continue
      present.add(address)
      const gun=guns.get(address)??createGun(address)
      setGunVisible(gun,!!state.alive)
      const weapon=(state.equippedWeapon==='scattergun'||state.equippedWeapon==='rail-pistol'?state.equippedWeapon:'pulse-rifle') as WeaponId
      applyWeaponModel(gun,weapon)
      animateGun(gun)
    }

    // Local avatar: attach the same synchronized right-hand weapon so the player can see
    // their own avatar carrying it in third person. Hide it in first person to keep the
    // dedicated FPS hands/gun model clean and local-only.
    if(localAddress){
      const state=clientState.localSolo?getLocalSoloPlayer():syncedStateFor(localAddress)
      if(state?.joined){
        present.add(localAddress)
        const gun=guns.get(localAddress)??createGun(localAddress)
        const thirdPerson=CameraMode.getOrNull(engine.CameraEntity)?.mode===CameraType.CT_THIRD_PERSON
        setGunVisible(gun,!!state.alive&&thirdPerson)
        const weapon=(state.equippedWeapon==='scattergun'||state.equippedWeapon==='rail-pistol'?state.equippedWeapon:'pulse-rifle') as WeaponId
        applyWeaponModel(gun,weapon)
      animateGun(gun)
      }
    }

    for(const address of guns.keys())if(!present.has(address))removeGun(address)
  })
}
