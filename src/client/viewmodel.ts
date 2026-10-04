import { Entity, GltfContainer, Material, MeshRenderer, Transform, engine } from '@dcl/sdk/ecs'
import { Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import { getPlayer } from '@dcl/sdk/src/players'
import type { WeaponId } from '../shared/config'

let root: Entity | undefined
let weaponRoot: Entity | undefined
let gunBody: Entity | undefined
let barrel: Entity | undefined
let magazine: Entity | undefined
let optic: Entity | undefined
let muzzleBrake: Entity | undefined
let muzzleFxRoot: Entity | undefined
let flashRoot: Entity | undefined
let smokeRoot: Entity | undefined
let bombProp: Entity | undefined
let leftHand: Entity | undefined
let rightHand: Entity | undefined
let leftArm: Entity | undefined
let rightArm: Entity | undefined
let leftSleeve: Entity | undefined
let rightSleeve: Entity | undefined
let suppliedHands: Entity | undefined
let suppliedPistol: Entity | undefined
let suppliedPistolHands: Entity | undefined
let suppliedRifle: Entity | undefined
let suppliedShotgun: Entity | undefined
let suppliedLeftHand: Entity | undefined
let suppliedRightHand: Entity | undefined
let recoil = 0
let reloadTime = 0
let switchTime = 0
let interactTime = 0
let throwTime = 0
let gripHold = 0
let elapsed = 0
let gripBlend = 0
let flashTime = 0
let smokeTime = 0
let lastPlayerPosition = Vector3.Zero()
let smoothedSpeed = 0
let moveBlend = 0
let runBlend = 0
let jumpBlend = 0
let aimTarget = 0
let aimBlend = 0
let gaitPhase = 0
let activeWeapon: WeaponId | '' = ''
let getWeapon: () => WeaponId
let shouldShow: () => boolean
const skinParts: Entity[] = []
const fingerSegments: Array<{ entity: Entity; mirrored: boolean; index: number; distal: boolean }> = []
const casings: Array<{ entity:Entity; age:number; velocity:Vector3; spin:number }> = []
const rifleDetails: Array<{entity:Entity;scale:Vector3}> = []
const shotgunDetails: Array<{entity:Entity;scale:Vector3}> = []
const pistolDetails: Array<{entity:Entity;scale:Vector3}> = []
let lastSkin = ''
let skinCheck = 0

function part(name: string, position: Vector3, scale: Vector3, color: string, parent: Entity, rotation = Quaternion.Identity(), cylinder = false) {
  const entity = engine.addEntity()
  Transform.create(entity, { position, scale, rotation, parent })
  if (cylinder) MeshRenderer.setCylinder(entity, 0.5, 0.5)
  else MeshRenderer.setBox(entity)
  const skin = color === '#b97854ff'
  const fabric = color === '#15191dff' || color === '#1c2025ff' || color === '#23272cff' || color === '#343a40ff' || color === '#41474eff'
  Material.setPbrMaterial(entity, {
    albedoColor: Color4.fromHexString(color), metallic: skin ? 0.02 : fabric ? 0.08 : 0.68, roughness: skin ? 0.88 : fabric ? 0.82 : 0.34,
    emissiveColor: color === '#24bce8ff' ? Color4.fromHexString('#075b75ff') : undefined,
    emissiveIntensity: color === '#24bce8ff' ? 1.5 : 0
  })
  return entity
}

function skinPart(name: string, position: Vector3, scale: Vector3, parent: Entity, rotation = Quaternion.Identity(), cylinder = false) {
  const entity = part(name, position, scale, '#b97854ff', parent, rotation, cylinder)
  skinParts.push(entity)
  return entity
}

function rifleDetail(name:string,position:Vector3,scale:Vector3,color:string,parent:Entity,rotation=Quaternion.Identity(),cylinder=false){
  const entity=part(name,position,scale,color,parent,rotation,cylinder)
  rifleDetails.push({entity,scale:Vector3.clone(scale)})
  return entity
}

function weaponDetail(collection:Array<{entity:Entity;scale:Vector3}>,name:string,position:Vector3,scale:Vector3,color:string,parent:Entity,rotation=Quaternion.Identity(),cylinder=false){
  const entity=part(name,position,scale,color,parent,rotation,cylinder);collection.push({entity,scale:Vector3.clone(scale)});return entity
}

function emissivePart(name:string,position:Vector3,scale:Vector3,color:string,parent:Entity,rotation=Quaternion.Identity(),cylinder=false){
  const entity=part(name,position,scale,color,parent,rotation,cylinder)
  const glow=Color4.fromHexString(color)
  Material.setPbrMaterial(entity,{albedoColor:glow,emissiveColor:glow,emissiveIntensity:8,metallic:.05,roughness:.18})
  return entity
}

function spawnCasing(){
  const casing=casings.find(value=>value.age>=.72)??casings[0]
  if(!casing)return
  casing.age=0;casing.velocity=Vector3.create(1.45,1.05,-.08);casing.spin=0
  const transform=Transform.getMutable(casing.entity)
  transform.position=Vector3.create(.22,-.18,.62);transform.scale=Vector3.create(.035,.09,.035);transform.rotation=Quaternion.fromEulerDegrees(0,0,90)
}

function avatarHand(name: string, position: Vector3, parent: Entity, mirrored: boolean) {
  // Human-proportioned low-poly tactical hand based on the approved reference:
  // exposed fingertips, segmented black fingerless glove, broad armored back plate,
  // reinforced knuckles and a rugged green-screen field watch on the LEFT wrist.
  const hand = engine.addEntity()
  Transform.create(hand, { position, scale: Vector3.create(.9,.9,.9), parent })
  const glove = '#17191dff'
  const gloveMid = '#24272cff'
  const gloveHi = '#363a40ff'
  const side = mirrored ? 1 : -1

  // Anatomical palm + glove shell. Skin remains visible at thumb/fingertips.
  skinPart(`${name} palm`, Vector3.create(0,-.005,.015), Vector3.create(.31,.135,.33), hand, Quaternion.fromEulerDegrees(-4,0,0))
  part(`${name} palm glove`, Vector3.create(0,-.073,.005), Vector3.create(.285,.035,.255), glove, hand, Quaternion.fromEulerDegrees(-4,0,0))
  part(`${name} back glove`, Vector3.create(0,.074,.018), Vector3.create(.285,.075,.255), gloveMid, hand, Quaternion.fromEulerDegrees(-5,0,0))
  part(`${name} armored back plate`, Vector3.create(0,.122,.025), Vector3.create(.235,.038,.19), gloveHi, hand, Quaternion.fromEulerDegrees(-7,0,0))
  part(`${name} back plate center`, Vector3.create(0,.148,.03), Vector3.create(.115,.022,.15), '#41464dff', hand)
  part(`${name} thumb side guard`, Vector3.create(side*.145,.025,.02), Vector3.create(.06,.11,.19), gloveMid, hand, Quaternion.fromEulerDegrees(0,side*12,0))
  part(`${name} palm heel`, Vector3.create(0,-.015,-.145), Vector3.create(.30,.17,.17), glove, hand)

  // Wide tactical cuff like the reference, not a thin bracelet.
  part(`${name} wrist cuff`, Vector3.create(0,0,-.255), Vector3.create(.37,.205,.19), '#1b1e22ff', hand)
  part(`${name} cuff armor`, Vector3.create(0,.105,-.255), Vector3.create(.31,.045,.17), gloveHi, hand)
  part(`${name} cuff strap`, Vector3.create(0,-.105,-.255), Vector3.create(.34,.035,.18), '#0e1013ff', hand)

  // Reference watch belongs on the LEFT hand/forearm only (mirrored=true in this viewmodel).
  if (mirrored) {
    part(`${name} watch strap`, Vector3.create(0,.025,-.285), Vector3.create(.405,.05,.17), '#202820ff', hand)
    part(`${name} watch case`, Vector3.create(0,.153,-.25), Vector3.create(.255,.095,.205), '#343a3dff', hand)
    part(`${name} watch bezel`, Vector3.create(0,.205,-.245), Vector3.create(.205,.026,.155), '#0d1110ff', hand)
    const screen=part(`${name} watch green display`,Vector3.create(0,.224,-.24),Vector3.create(.16,.014,.11),'#173d2aff',hand)
    Material.setPbrMaterial(screen,{albedoColor:Color4.fromHexString('#173d2aff'),emissiveColor:Color4.fromHexString('#55d58aff'),emissiveIntensity:2.7,metallic:.12,roughness:.22})
    // Bright center mark gives the same readable military-screen character at gameplay distance.
    const mark=part(`${name} watch display mark`,Vector3.create(0,.234,-.235),Vector3.create(.038,.009,.055),'#dfffe9ff',hand,Quaternion.fromEulerDegrees(0,0,35))
    Material.setPbrMaterial(mark,{albedoColor:Color4.fromHexString('#dfffe9ff'),emissiveColor:Color4.fromHexString('#dfffe9ff'),emissiveIntensity:2.2,metallic:0,roughness:.35})
  }

  // Four individually articulated fingers. Proximal section is gloved; distal section
  // and rounded tip are exposed skin exactly like a fingerless glove.
  for (let index=0; index<4; index+=1) {
    const x=(index-1.5)*.075
    const proximalLength=.17-index*.006
    part(`${name} knuckle ${index+1}`,Vector3.create(x,.092,.185),Vector3.create(.066,.06,.082),gloveHi,hand,Quaternion.fromEulerDegrees(-8,0,0))
    const proximalPivot=engine.addEntity()
    Transform.create(proximalPivot,{position:Vector3.create(x,.004,.22),parent:hand})
    part(`${name} finger ${index+1} glove`,Vector3.create(0,0,proximalLength/2),Vector3.create(.061,.067,proximalLength),gloveMid,proximalPivot)
    part(`${name} finger ${index+1} top armor`,Vector3.create(0,.047,proximalLength*.45),Vector3.create(.052,.024,proximalLength*.52),gloveHi,proximalPivot)
    const distalPivot=engine.addEntity()
    Transform.create(distalPivot,{position:Vector3.create(0,0,proximalLength),parent:proximalPivot})
    skinPart(`${name} exposed finger ${index+1}`,Vector3.create(0,0,.065),Vector3.create(.056,.061,.135),distalPivot)
    skinPart(`${name} fingertip ${index+1}`,Vector3.create(0,-.002,.145),Vector3.create(.052,.058,.065),distalPivot)
    fingerSegments.push({entity:proximalPivot,mirrored,index,distal:false},{entity:distalPivot,mirrored,index,distal:true})
  }

  // Chunkier human thumb with glove at the base and exposed distal thumb.
  const thumbPivot=engine.addEntity()
  Transform.create(thumbPivot,{position:Vector3.create(side*.15,-.02,.015),parent:hand,rotation:Quaternion.fromEulerDegrees(-16,side*32,-side*10)})
  part(`${name} thumb glove base`,Vector3.create(side*.04,.002,.045),Vector3.create(.085,.078,.13),gloveMid,thumbPivot,Quaternion.fromEulerDegrees(0,side*24,0))
  part(`${name} thumb armor`,Vector3.create(side*.04,.047,.035),Vector3.create(.07,.025,.075),gloveHi,thumbPivot,Quaternion.fromEulerDegrees(0,side*22,0))
  const thumbTipPivot=engine.addEntity()
  Transform.create(thumbTipPivot,{position:Vector3.create(side*.095,-.002,.095),parent:thumbPivot})
  skinPart(`${name} exposed thumb`,Vector3.create(side*.03,-.002,.045),Vector3.create(.075,.07,.11),thumbTipPivot,Quaternion.fromEulerDegrees(0,side*16,0))
  skinPart(`${name} thumb tip`,Vector3.create(side*.055,-.002,.075),Vector3.create(.065,.063,.065),thumbTipPivot,Quaternion.fromEulerDegrees(0,side*10,0))
  fingerSegments.push({entity:thumbPivot,mirrored,index:4,distal:false},{entity:thumbTipPivot,mirrored,index:4,distal:true})
  return hand
}

function updateAvatarSkin(dt:number) {
  skinCheck += dt
  if (skinCheck < .75) return
  skinCheck = 0
  const color = getPlayer()?.avatar?.skinColor
  if (!color) return
  const signature = `${color.r.toFixed(3)}:${color.g.toFixed(3)}:${color.b.toFixed(3)}`
  if (signature === lastSkin) return
  lastSkin = signature
  const skinColor = Color4.create(color.r,color.g,color.b,1)
  for (const entity of skinParts) Material.setPbrMaterial(entity,{albedoColor:skinColor,metallic:.02,roughness:.88})
}

function applyWeaponShape(weapon: WeaponId) {
  if (!gunBody || !barrel || !magazine || !optic || !muzzleBrake || !muzzleFxRoot || activeWeapon === weapon) return
  activeWeapon = weapon

  // v44: the first-person guns are now the user's supplied GLBs. Hide every old
  // procedural weapon piece so it cannot overlap the new models.
  for(const detail of rifleDetails) Transform.getMutable(detail.entity).scale=Vector3.create(.001,.001,.001)
  for(const detail of shotgunDetails) Transform.getMutable(detail.entity).scale=Vector3.create(.001,.001,.001)
  for(const detail of pistolDetails) Transform.getMutable(detail.entity).scale=Vector3.create(.001,.001,.001)
  Transform.getMutable(gunBody).scale=Vector3.create(.001,.001,.001)
  Transform.getMutable(barrel).scale=Vector3.create(.001,.001,.001)
  Transform.getMutable(magazine).scale=Vector3.create(.001,.001,.001)
  Transform.getMutable(optic).scale=Vector3.create(.001,.001,.001)
  Transform.getMutable(muzzleBrake).scale=Vector3.create(.001,.001,.001)

  const hide=Vector3.create(.001,.001,.001)
  if(suppliedRifle) Transform.getMutable(suppliedRifle).scale=weapon==='pulse-rifle'?Vector3.create(1.56,1.56,1.56):hide
  if(suppliedPistol) Transform.getMutable(suppliedPistol).scale=hide
  if(suppliedPistolHands) Transform.getMutable(suppliedPistolHands).scale=weapon==='rail-pistol'?Vector3.create(.92,.92,.92):hide
  if(suppliedHands) Transform.getMutable(suppliedHands).scale=weapon==='rail-pistol'?hide:Vector3.create(1.16,1.16,1.16)
  if(suppliedShotgun) Transform.getMutable(suppliedShotgun).scale=weapon==='scattergun'?Vector3.create(1.52,1.52,1.52):hide

  // Keep existing firing effects attached to the approximate muzzle location.
  const fx=Transform.getMutable(muzzleFxRoot)
  if(weapon==='rail-pistol') fx.position=Vector3.create(0,.08,.62)
  else if(weapon==='scattergun') fx.position=Vector3.create(0,.06,1.10)
  else fx.position=Vector3.create(0,.06,1.02)
}

function system(dt: number) {
  if (!root || !weaponRoot || !leftHand || !rightHand || !leftArm || !rightArm || !leftSleeve || !rightSleeve) return
  const rt = Transform.getMutable(root)
  const visible = shouldShow()
  rt.scale = visible ? Vector3.One() : Vector3.create(.001,.001,.001)
  if (!visible) return
  updateAvatarSkin(dt)
  applyWeaponShape(getWeapon())
  elapsed += dt; recoil = Math.max(0,recoil-dt*7); gripHold=Math.max(0,gripHold-dt); flashTime=Math.max(0,flashTime-dt); smokeTime=Math.max(0,smokeTime-dt); reloadTime=Math.max(0,reloadTime-dt); switchTime=Math.max(0,switchTime-dt); interactTime=Math.max(0,interactTime-dt);throwTime=Math.max(0,throwTime-dt)
  const player = Transform.getOrNull(engine.PlayerEntity)
  let speed = 0, verticalMotion = 0
  if (player) {
    const dx=player.position.x-lastPlayerPosition.x,dz=player.position.z-lastPlayerPosition.z
    speed = dt > 0 && lastPlayerPosition.x !== 0 ? Math.sqrt(dx*dx+dz*dz)/dt : 0
    verticalMotion=Math.abs(player.position.y-lastPlayerPosition.y)
    lastPlayerPosition = Vector3.clone(player.position)
  }
  smoothedSpeed+=(Math.min(speed,8)-smoothedSpeed)*Math.min(1,dt*5)
  const moveTarget=smoothedSpeed>.22?1:0,runTarget=Math.max(0,Math.min(1,(smoothedSpeed-2.2)/3.6)),jumpTarget=verticalMotion>.035?1:0
  moveBlend+=(moveTarget-moveBlend)*Math.min(1,dt*(moveTarget>moveBlend?6:4));runBlend+=(runTarget-runBlend)*Math.min(1,dt*4.5);jumpBlend+=(jumpTarget-jumpBlend)*Math.min(1,dt*(jumpTarget>jumpBlend?9:5))
  aimBlend += (aimTarget - aimBlend) * Math.min(1, dt * 11)
  const firing = gripHold > 0
  const gripTarget = firing || aimBlend > .08 ? 1 : 0
  gripBlend += (gripTarget - gripBlend) * Math.min(1, dt * (firing ? 18 : 7))
  const bobRate=6.8+runBlend*4.2;gaitPhase+=dt*bobRate
  const bobAmount=moveBlend*(.009+runBlend*.01),bob=Math.sin(gaitPhase*2)*bobAmount
  const sway=Math.sin(gaitPhase)*moveBlend*(.35+runBlend*.55)
  let y=-.36+bob+recoil*.035-jumpBlend*.018,z=.74-recoil*.13-runBlend*.018,pitch=-4-recoil*6+Math.cos(gaitPhase*2)*moveBlend*.28,roll=sway
  if (reloadTime>0){const p=1-Math.abs(reloadTime-.55)/.55;y-=Math.max(0,p)*.22;roll-=Math.max(0,p)*38;pitch+=Math.max(0,p)*18}
  if (switchTime>0)y-=Math.sin((switchTime/.45)*Math.PI)*.28
  if (interactTime>0)roll+=Math.sin((interactTime/.35)*Math.PI)*10
  if(throwTime>0){const p=1-throwTime/.72,arc=Math.sin(Math.min(1,p)*Math.PI);y+=arc*.18;roll-=arc*28}
  // v70: the combined pistol+hands model must remain screen-pinned while moving/running.
  // Do not apply locomotion bob, jump dip, run lowering or sway to the pistol viewmodel root.
  // Recoil is kept so firing still has feedback, but the forearm ends remain below the viewport.
  const pistolPinned=getWeapon()==='rail-pistol'
  if(pistolPinned){
    // v88: HARD PIN: pistol stays identical during walk/run AND either Shift+W sprint. Reload is the only
    // locomotion-independent hand motion: tilt right briefly to show the magazine action.
    const reloadP=reloadTime>0?Math.max(0,1-Math.abs(reloadTime-.55)/.55):0
    rt.position=Vector3.create(.035*reloadP,-.36-.035*reloadP,.74)
    rt.rotation=Quaternion.fromEulerDegrees(-4+reloadP*7,0,reloadP*34)
  }else{
    rt.position=Vector3.create(0,y+aimBlend*.005,z-aimBlend*.20)
    rt.rotation=Quaternion.fromEulerDegrees(pitch*(1-aimBlend),0,roll*(1-aimBlend))
  }
  const wh=Transform.getMutable(weaponRoot);wh.position.x=0;wh.position.y=pistolPinned?0:Math.sin(elapsed*1.7)*.003-runBlend*.07;wh.position.z=pistolPinned?.27:.27-runBlend*.045
  // v35: HARD-LOCK the authored hands onto the weapon exactly like the approved FPS reference.
  // Left hand wraps/supports the forward handguard and keeps the black watch visible.
  // Right hand stays on the pistol grip/trigger area.  Both follow recoil/reload with the rifle
  // instead of floating beside it.  This deliberately overrides the old open-hand locomotion pose.
  // v40: use the user's new complete two-hand GLB as one authored grip.
  // Keeping both hands in a single model preserves the exact relationship between the palms/fingers,
  // so the weapon stays inside the intended two-hand grip instead of independent hand meshes drifting apart.
  if(suppliedPistolHands && getWeapon()==='rail-pistol'){
    const pistolHands=Transform.getMutable(suppliedPistolHands)
    // v70: fixed FPS pistol pose. Keep the forearm ends below the bottom edge at all movement speeds.
    // No sprint/run locomotion transform is applied to this combined GLB. Reload is the only positional/tilt animation.
    const reloadP=reloadTime>0?Math.max(0,1-Math.abs(reloadTime-.55)/.55):0
    pistolHands.position=Vector3.create(.02+.025*reloadP,-.37-.02*reloadP,.60)
    pistolHands.rotation=Quaternion.fromEulerDegrees(2+reloadP*6,270,-2+reloadP*34)
  }
  if(suppliedHands && getWeapon()!=='rail-pistol'){
    const hands=Transform.getMutable(suppliedHands)
    const reloadDip=reloadTime>0?Math.sin(Math.min(1,(1.1-reloadTime)/1.1)*Math.PI):0
    hands.position=Vector3.create(.03,-.20-reloadDip*.025,.31-recoil*.03)
    // v42: authored GLB points its wrists toward -Z. Turn it 180 on Y so the hands reach forward toward the weapon,
    // then pitch/roll it into the rifle line instead of presenting the forearm ends toward the camera.
    hands.rotation=Quaternion.fromEulerDegrees(2-recoil*2.2,180,-2+roll*.05)
  }
  wh.scale=throwTime>0?Vector3.create(.001,.001,.001):Vector3.One()
  const mix=(a:number,b:number)=>a+(b-a)*gripBlend
  Transform.getMutable(leftHand).position=Vector3.create(mix(-.56-runBlend*.14,-.255),mix(-.08-runBlend*.035,-.18),mix(-.05-runBlend*.05,.34))
  Transform.getMutable(rightHand).position=Vector3.create(.105,-.16-runBlend*.07,.015-runBlend*.045)
  Transform.getMutable(leftArm).position=Vector3.create(mix(-.49-runBlend*.11,-.37),mix(-.16-runBlend*.03,-.18),mix(-.18-runBlend*.06,-.02))
  Transform.getMutable(rightArm).position=Vector3.create(.31,-.18-runBlend*.07,-.09-runBlend*.045)
  Transform.getMutable(leftSleeve).position=Vector3.create(mix(-.56-runBlend*.11,-.46),mix(-.20-runBlend*.03,-.20),mix(-.44-runBlend*.06,-.30))
  Transform.getMutable(rightSleeve).position=Vector3.create(.39,-.20-runBlend*.07,-.34-runBlend*.045)
  Transform.getMutable(leftHand).rotation=Quaternion.fromEulerDegrees(mix(-5,10),mix(-28,88),mix(-52,-12)+roll*.12)
  Transform.getMutable(rightHand).rotation=Quaternion.fromEulerDegrees(-12,-5,7-roll*.08)
  Transform.getMutable(leftArm).rotation=Quaternion.fromEulerDegrees(mix(-18,-10),mix(18,6),mix(-14,-9))
  Transform.getMutable(leftSleeve).rotation=Quaternion.fromEulerDegrees(mix(-18,-10),mix(18,6),mix(-14,-9))
  if(throwTime>0){const p=1-throwTime/.72,wind=Math.sin(Math.min(1,p)*Math.PI);const hand=Transform.getMutable(rightHand),arm=Transform.getMutable(rightArm);hand.position=Vector3.create(.18+wind*.12,.02+wind*.34,.12-wind*.22);hand.rotation=Quaternion.fromEulerDegrees(-45-wind*70,-18,24);arm.position=Vector3.create(.34,-.04+wind*.18,-.08-wind*.12);if(bombProp){const prop=Transform.getMutable(bombProp);prop.scale=p<.68?Vector3.One():Vector3.create(.001,.001,.001);prop.position=Vector3.create(.18+wind*.12,.12+wind*.34,.24-wind*.22);prop.rotation=Quaternion.fromEulerDegrees(p*280,p*190,0)}}else if(bombProp)Transform.getMutable(bombProp).scale=Vector3.create(.001,.001,.001)
  for(const segment of fingerSegments){
    const handGrip=segment.mirrored?gripBlend:.92
    if(segment.index===4){
      const thumbSide=segment.mirrored?1:-1
      const neutralPitch=segment.distal?-10:-18,gripPitch=segment.distal?-52:-46
      const neutralYaw=thumbSide*(segment.distal?18:34),gripYaw=thumbSide*(segment.distal?8:12)
      const neutralRoll=-thumbSide*(segment.distal?4:12),gripRoll=thumbSide*(segment.distal?12:18)
      Transform.getMutable(segment.entity).rotation=Quaternion.fromEulerDegrees(neutralPitch+(gripPitch-neutralPitch)*handGrip,neutralYaw+(gripYaw-neutralYaw)*handGrip,neutralRoll+(gripRoll-neutralRoll)*handGrip)
      continue
    }
    const spread=segment.index===4?0:(segment.index-1.5)*(1-handGrip)*9
    const curl=segment.distal?-62*handGrip:-34*handGrip
    Transform.getMutable(segment.entity).rotation=Quaternion.fromEulerDegrees(curl,spread,0)
  }
  if(flashRoot){const pulse=flashTime>0?(.8+Math.random()*.45):.001;Transform.getMutable(flashRoot).scale=Vector3.create(pulse,pulse,pulse)}
  if(smokeRoot){const life=smokeTime>0?1-smokeTime/.42:0,smoke=Transform.getMutable(smokeRoot);smoke.scale=smokeTime>0?Vector3.create(.45+life*.95,.45+life*.95,.45+life*.95):Vector3.create(.001,.001,.001);smoke.position=Vector3.create(0,.08+life*.13,.07+life*.18)}
  for(const casing of casings){
    if(casing.age>=.72)continue
    casing.age+=dt;casing.velocity=Vector3.create(casing.velocity.x,casing.velocity.y-2.8*dt,casing.velocity.z);casing.spin+=dt*900
    const transform=Transform.getMutable(casing.entity);transform.position=Vector3.add(transform.position,Vector3.scale(casing.velocity,dt));transform.rotation=Quaternion.fromEulerDegrees(casing.spin,casing.spin*.55,90)
    if(casing.age>=.72)transform.scale=Vector3.create(.001,.001,.001)
  }
}

export function kickViewModel(){recoil=1;gripHold=.55;flashTime=.11;smokeTime=.42;spawnCasing()}
export function reloadViewModel(){reloadTime=1.1}
export function switchViewModel(){switchTime=.45}
export function interactViewModel(){interactTime=.35}
export function throwViewModel(){throwTime=.72;gripHold=.72}
export function setViewModelAim(aiming:boolean){aimTarget=aiming?1:0}

export function setupFirstPersonViewModel(weaponGetter:()=>WeaponId,visibilityGetter:()=>boolean){
  getWeapon=weaponGetter;shouldShow=visibilityGetter
  root=engine.addEntity();Transform.create(root,{position:Vector3.create(-.12,-.44,.74),rotation:Quaternion.fromEulerDegrees(-4,0,0),scale:Vector3.create(.001,.001,.001),parent:engine.CameraEntity})
  // v40: use the exact newly supplied complete two-hand GLB for the first-person weapon grip.
  // Keep the old procedural entities only as inert animation anchors for existing gameplay code.
  leftArm=skinPart('Legacy left forearm anchor',Vector3.Zero(),Vector3.create(.001,.001,.001),root)
  leftSleeve=part('Legacy left sleeve anchor',Vector3.Zero(),Vector3.create(.001,.001,.001),'#23272cff',root)
  leftHand=engine.addEntity();Transform.create(leftHand,{position:Vector3.Zero(),scale:Vector3.create(.001,.001,.001),parent:root})
  rightArm=skinPart('Legacy right forearm anchor',Vector3.Zero(),Vector3.create(.001,.001,.001),root)
  rightSleeve=part('Legacy right sleeve anchor',Vector3.Zero(),Vector3.create(.001,.001,.001),'#23272cff',root)
  rightHand=engine.addEntity();Transform.create(rightHand,{position:Vector3.Zero(),scale:Vector3.create(.001,.001,.001),parent:root})
  suppliedHands=engine.addEntity()
  Transform.create(suppliedHands,{position:Vector3.create(.03,-.20,.31),scale:Vector3.create(1.16,1.16,1.16),rotation:Quaternion.fromEulerDegrees(2,180,-2),parent:root})
  GltfContainer.create(suppliedHands,{src:'assets/Models/PlayerHands_v40.glb'})
  weaponRoot=engine.addEntity();Transform.create(weaponRoot,{position:Vector3.create(0,.07,.27),parent:root})
  // v44: supplied first-person weapon GLBs. They share weaponRoot so the existing
  // recoil/reload/aim animation and the supplied hands continue to move together.
  suppliedRifle=engine.addEntity();Transform.create(suppliedRifle,{position:Vector3.create(.10,-.015,.155),scale:Vector3.create(.001,.001,.001),rotation:Quaternion.fromEulerDegrees(0,258,0),parent:weaponRoot});GltfContainer.create(suppliedRifle,{src:'assets/Models/PlayerRifle_v44.glb'})
  suppliedPistol=engine.addEntity();Transform.create(suppliedPistol,{position:Vector3.create(.08,-.025,.15),scale:Vector3.create(.001,.001,.001),rotation:Quaternion.fromEulerDegrees(0,258,0),parent:weaponRoot});GltfContainer.create(suppliedPistol,{src:'assets/Models/PlayerPistol_v44.glb'})
  suppliedPistolHands=engine.addEntity();Transform.create(suppliedPistolHands,{position:Vector3.create(.02,-.25,.58),scale:Vector3.create(.001,.001,.001),rotation:Quaternion.fromEulerDegrees(2,270,-2),parent:root});GltfContainer.create(suppliedPistolHands,{src:'assets/Models/PlayerPistolHands_v65.glb'})
  suppliedShotgun=engine.addEntity();Transform.create(suppliedShotgun,{position:Vector3.create(.10,-.02,.16),scale:Vector3.create(.001,.001,.001),rotation:Quaternion.fromEulerDegrees(0,258,0),parent:weaponRoot});GltfContainer.create(suppliedShotgun,{src:'assets/Models/PlayerShotgun_v44.glb'})
  gunBody=part('Rifle receiver',Vector3.Zero(),Vector3.create(.3,.25,.66),'#30343aff',weaponRoot)
  rifleDetail('Rifle upper receiver',Vector3.create(0,.105,.02),Vector3.create(.32,.12,.56),'#41474eff',weaponRoot)
  rifleDetail('Rifle lower receiver',Vector3.create(0,-.095,-.03),Vector3.create(.27,.11,.43),'#23282eff',weaponRoot)
  rifleDetail('Rifle tan shell',Vector3.create(0,.015,-.04),Vector3.create(.325,.135,.36),'#8b7654ff',weaponRoot)
  rifleDetail('Rifle tan left panel',Vector3.create(-.174,.02,.27),Vector3.create(.025,.13,.37),'#a78b5fff',weaponRoot)
  rifleDetail('Rifle tan right panel',Vector3.create(.174,.02,.27),Vector3.create(.025,.13,.37),'#a78b5fff',weaponRoot)
  rifleDetail('Rifle stock',Vector3.create(0,-.01,-.44),Vector3.create(.25,.21,.34),'#171a1eff',weaponRoot)
  rifleDetail('Rifle stock cheek',Vector3.create(0,.12,-.44),Vector3.create(.22,.08,.32),'#343a40ff',weaponRoot)
  rifleDetail('Rifle stock upper strut',Vector3.create(0,.02,-.67),Vector3.create(.12,.08,.30),'#24292fff',weaponRoot,Quaternion.fromEulerDegrees(-5,0,0))
  rifleDetail('Rifle stock lower strut',Vector3.create(0,-.12,-.64),Vector3.create(.10,.07,.28),'#171a1eff',weaponRoot,Quaternion.fromEulerDegrees(12,0,0))
  rifleDetail('Rifle butt pad',Vector3.create(0,-.02,-.84),Vector3.create(.27,.26,.08),'#101317ff',weaponRoot)
  rifleDetail('Rifle pistol grip',Vector3.create(.015,-.21,-.08),Vector3.create(.14,.34,.16),'#171a1eff',weaponRoot,Quaternion.fromEulerDegrees(-17,0,0))
  rifleDetail('Rifle grip backstrap',Vector3.create(.015,-.25,-.13),Vector3.create(.16,.24,.07),'#343a40ff',weaponRoot,Quaternion.fromEulerDegrees(-17,0,0))
  rifleDetail('Rifle trigger guard front',Vector3.create(0,-.145,.04),Vector3.create(.13,.035,.16),'#111419ff',weaponRoot)
  rifleDetail('Rifle trigger',Vector3.create(0,-.19,.01),Vector3.create(.025,.10,.025),'#0a0c0fff',weaponRoot,Quaternion.fromEulerDegrees(-25,0,0))
  barrel=part('Rifle barrel',Vector3.create(0,.06,.58),Vector3.create(.095,.54,.095),'#171a1eff',weaponRoot,Quaternion.fromEulerDegrees(90,0,0),true)
  muzzleBrake=part('Rifle muzzle',Vector3.create(0,.06,.88),Vector3.create(.16,.17,.16),'#101216ff',weaponRoot,Quaternion.fromEulerDegrees(90,0,0),true)
  rifleDetail('Rifle barrel bore',Vector3.create(0,.06,.98),Vector3.create(.06,.035,.06),'#030405ff',weaponRoot,Quaternion.fromEulerDegrees(90,0,0),true)
  magazine=part('Rifle magazine',Vector3.create(0,-.25,.16),Vector3.create(.15,.36,.18),'#171a1eff',weaponRoot,Quaternion.fromEulerDegrees(-12,0,0))
  rifleDetail('Rifle magazine well',Vector3.create(0,-.13,.14),Vector3.create(.20,.16,.22),'#272c32ff',weaponRoot,Quaternion.fromEulerDegrees(-7,0,0))
  rifleDetail('Rifle rail',Vector3.create(0,.19,.12),Vector3.create(.12,.065,.65),'#111317ff',weaponRoot)
  for(let index=0;index<7;index+=1)rifleDetail(`Rifle rail tooth ${index+1}`,Vector3.create(0,.235,-.12+index*.085),Vector3.create(.18,.035,.03),'#24292fff',weaponRoot)
  optic=part('Combat scope tube',Vector3.create(0,.285,.04),Vector3.create(.14,.30,.14),'#171a1eff',weaponRoot,Quaternion.fromEulerDegrees(90,0,0),true)
  rifleDetail('Optic mount',Vector3.create(0,.225,.075),Vector3.create(.19,.055,.17),'#101317ff',weaponRoot)
  rifleDetail('Scope front ring',Vector3.create(0,.285,.205),Vector3.create(.18,.045,.18),'#24292fff',weaponRoot,Quaternion.fromEulerDegrees(90,0,0),true)
  rifleDetail('Scope rear ring',Vector3.create(0,.285,-.125),Vector3.create(.18,.045,.18),'#24292fff',weaponRoot,Quaternion.fromEulerDegrees(90,0,0),true)
  rifleDetail('Scope front glass',Vector3.create(0,.285,.232),Vector3.create(.105,.018,.105),'#4fc7dfff',weaponRoot,Quaternion.fromEulerDegrees(90,0,0),true)
  rifleDetail('Scope rear glass',Vector3.create(0,.285,-.153),Vector3.create(.105,.018,.105),'#183c48ff',weaponRoot,Quaternion.fromEulerDegrees(90,0,0),true)
  rifleDetail('Front sight base',Vector3.create(0,.20,.49),Vector3.create(.15,.07,.10),'#111419ff',weaponRoot)
  rifleDetail('Front sight post',Vector3.create(0,.28,.49),Vector3.create(.035,.13,.035),'#111419ff',weaponRoot)
  rifleDetail('Rear sight',Vector3.create(0,.245,-.13),Vector3.create(.12,.10,.04),'#111419ff',weaponRoot)
  rifleDetail('Left support grip',Vector3.create(-.08,-.07,.40),Vector3.create(.12,.22,.22),'#171a1eff',weaponRoot,Quaternion.fromEulerDegrees(0,0,-18))
  rifleDetail('Handguard underside',Vector3.create(0,-.09,.43),Vector3.create(.25,.08,.34),'#252a30ff',weaponRoot)
  rifleDetail('Ejection port',Vector3.create(.158,.06,.02),Vector3.create(.018,.09,.20),'#0a0c0fff',weaponRoot)
  rifleDetail('Charging handle',Vector3.create(.18,.13,-.08),Vector3.create(.08,.055,.06),'#171a1eff',weaponRoot)
  for(let index=0;index<4;index+=1){rifleDetail(`Left vent ${index+1}`,Vector3.create(-.19,.08,.29+index*.085),Vector3.create(.018,.035,.045),'#0a0c0fff',weaponRoot);rifleDetail(`Right vent ${index+1}`,Vector3.create(.19,.08,.29+index*.085),Vector3.create(.018,.035,.045),'#0a0c0fff',weaponRoot)}
  // Reference-directed scattergun: long angular receiver, pump, shell carrier and skeleton stock.
  weaponDetail(shotgunDetails,'Scattergun upper receiver',Vector3.create(0,.08,.08),Vector3.create(.34,.18,.78),'#34383eff',weaponRoot)
  weaponDetail(shotgunDetails,'Scattergun tan receiver shell',Vector3.create(0,.09,-.16),Vector3.create(.35,.15,.36),'#a98a57ff',weaponRoot)
  weaponDetail(shotgunDetails,'Scattergun pump',Vector3.create(0,-.05,.57),Vector3.create(.30,.18,.42),'#171b20ff',weaponRoot)
  weaponDetail(shotgunDetails,'Scattergun vented handguard',Vector3.create(0,.05,.51),Vector3.create(.34,.13,.43),'#9b7d4dff',weaponRoot)
  weaponDetail(shotgunDetails,'Scattergun top rail',Vector3.create(0,.22,.11),Vector3.create(.15,.045,.92),'#101317ff',weaponRoot)
  weaponDetail(shotgunDetails,'Scattergun pistol grip',Vector3.create(0,-.24,-.17),Vector3.create(.16,.38,.17),'#171b20ff',weaponRoot,Quaternion.fromEulerDegrees(-14,0,0))
  weaponDetail(shotgunDetails,'Scattergun stock beam',Vector3.create(0,.02,-.62),Vector3.create(.20,.18,.55),'#a98a57ff',weaponRoot)
  weaponDetail(shotgunDetails,'Scattergun butt pad',Vector3.create(0,.01,-.92),Vector3.create(.27,.30,.09),'#171b20ff',weaponRoot)
  for(let i=0;i<4;i++){weaponDetail(shotgunDetails,`Scattergun red shell ${i+1}`,Vector3.create(-.19+i*.12,-.04,-.02),Vector3.create(.045,.18,.045),'#d72424ff',weaponRoot,true?Quaternion.fromEulerDegrees(0,0,0):Quaternion.Identity(),true);weaponDetail(shotgunDetails,`Scattergun shell brass ${i+1}`,Vector3.create(-.19+i*.12,-.135,-.02),Vector3.create(.05,.035,.05),'#d8a02dff',weaponRoot,Quaternion.Identity(),true)}
  // Reference-directed rail pistol: faceted tan frame, charcoal slide and red iron sights.
  weaponDetail(pistolDetails,'Pistol angular slide',Vector3.create(0,.09,.05),Vector3.create(.30,.18,.54),'#34383eff',weaponRoot)
  weaponDetail(pistolDetails,'Pistol slide top',Vector3.create(0,.19,.03),Vector3.create(.23,.06,.48),'#20252aff',weaponRoot)
  weaponDetail(pistolDetails,'Pistol rear plate',Vector3.create(0,.08,-.245),Vector3.create(.27,.17,.055),'#15191dff',weaponRoot)
  weaponDetail(pistolDetails,'Pistol tan frame',Vector3.create(0,-.04,.01),Vector3.create(.31,.16,.46),'#b2925dff',weaponRoot)
  weaponDetail(pistolDetails,'Pistol tan dust cover',Vector3.create(0,-.07,.24),Vector3.create(.28,.11,.24),'#a88754ff',weaponRoot)
  weaponDetail(pistolDetails,'Pistol grip frame',Vector3.create(0,-.29,-.10),Vector3.create(.22,.48,.20),'#a88754ff',weaponRoot,Quaternion.fromEulerDegrees(-9,0,0))
  weaponDetail(pistolDetails,'Pistol magazine body',Vector3.create(0,-.38,-.10),Vector3.create(.15,.31,.13),'#12161aff',weaponRoot,Quaternion.fromEulerDegrees(-9,0,0))
  weaponDetail(pistolDetails,'Pistol black grip panel left',Vector3.create(-.12,-.29,-.10),Vector3.create(.025,.36,.15),'#171a1eff',weaponRoot,Quaternion.fromEulerDegrees(-9,0,0))
  weaponDetail(pistolDetails,'Pistol black grip panel right',Vector3.create(.12,-.29,-.10),Vector3.create(.025,.36,.15),'#171a1eff',weaponRoot,Quaternion.fromEulerDegrees(-9,0,0))
  weaponDetail(pistolDetails,'Pistol squared muzzle block',Vector3.create(0,.09,.34),Vector3.create(.29,.19,.16),'#2b3036ff',weaponRoot)
  weaponDetail(pistolDetails,'Pistol barrel',Vector3.create(0,.09,.38),Vector3.create(.085,.28,.085),'#15191dff',weaponRoot,Quaternion.fromEulerDegrees(90,0,0),true)
  weaponDetail(pistolDetails,'Pistol barrel bore',Vector3.create(0,.09,.535),Vector3.create(.052,.025,.052),'#030405ff',weaponRoot,Quaternion.fromEulerDegrees(90,0,0),true)
  weaponDetail(pistolDetails,'Pistol guide rod',Vector3.create(0,.015,.43),Vector3.create(.04,.18,.04),'#59616aff',weaponRoot,Quaternion.fromEulerDegrees(90,0,0),true)
  weaponDetail(pistolDetails,'Pistol chamber top',Vector3.create(0,.195,.045),Vector3.create(.14,.025,.15),'#090c0fff',weaponRoot)
  weaponDetail(pistolDetails,'Pistol ejection port',Vector3.create(.158,.13,.02),Vector3.create(.018,.095,.16),'#080a0cff',weaponRoot)
  weaponDetail(pistolDetails,'Pistol trigger guard',Vector3.create(0,-.16,.10),Vector3.create(.20,.045,.22),'#9b7d4fff',weaponRoot)
  weaponDetail(pistolDetails,'Pistol trigger guard left',Vector3.create(-.105,-.105,.10),Vector3.create(.03,.15,.03),'#9b7d4fff',weaponRoot,Quaternion.fromEulerDegrees(18,0,0))
  weaponDetail(pistolDetails,'Pistol trigger guard right',Vector3.create(.105,-.105,.10),Vector3.create(.03,.15,.03),'#9b7d4fff',weaponRoot,Quaternion.fromEulerDegrees(18,0,0))
  weaponDetail(pistolDetails,'Pistol trigger',Vector3.create(0,-.19,.08),Vector3.create(.028,.105,.028),'#111419ff',weaponRoot,Quaternion.fromEulerDegrees(-24,0,0))
  weaponDetail(pistolDetails,'Pistol magazine base',Vector3.create(0,-.55,-.13),Vector3.create(.24,.055,.22),'#171a1eff',weaponRoot)
  weaponDetail(pistolDetails,'Pistol lower accessory rail',Vector3.create(0,-.13,.27),Vector3.create(.15,.045,.22),'#34383eff',weaponRoot)
  weaponDetail(pistolDetails,'Pistol slide catch',Vector3.create(.166,.055,-.055),Vector3.create(.026,.045,.10),'#59616aff',weaponRoot)
  weaponDetail(pistolDetails,'Pistol takedown pin',Vector3.create(.168,-.035,.10),Vector3.create(.025,.04,.025),'#15191dff',weaponRoot,Quaternion.fromEulerDegrees(0,0,90),true)
  for(let i=0;i<5;i++){weaponDetail(pistolDetails,`Pistol right slide serration ${i+1}`,Vector3.create(.155,.11,-.03-i*.05),Vector3.create(.025,.12,.024),'#101317ff',weaponRoot);weaponDetail(pistolDetails,`Pistol left slide serration ${i+1}`,Vector3.create(-.155,.11,-.03-i*.05),Vector3.create(.025,.12,.024),'#101317ff',weaponRoot)}
  weaponDetail(pistolDetails,'Pistol front red sight',Vector3.create(0,.225,.31),Vector3.create(.045,.05,.04),'#ff2020ff',weaponRoot)
  weaponDetail(pistolDetails,'Pistol rear sight left',Vector3.create(-.055,.225,-.19),Vector3.create(.04,.05,.04),'#ff2020ff',weaponRoot)
  weaponDetail(pistolDetails,'Pistol rear sight right',Vector3.create(.055,.225,-.19),Vector3.create(.04,.05,.04),'#ff2020ff',weaponRoot)
  muzzleFxRoot=engine.addEntity();Transform.create(muzzleFxRoot,{position:Vector3.create(0,.06,.98),parent:weaponRoot})
  flashRoot=engine.addEntity();Transform.create(flashRoot,{scale:Vector3.create(.001,.001,.001),parent:muzzleFxRoot})
  emissivePart('Muzzle fire core',Vector3.create(0,0,.06),Vector3.create(.18,.18,.34),'#fff0a0ff',flashRoot)
  emissivePart('Muzzle fire horizontal',Vector3.create(0,0,.03),Vector3.create(.62,.055,.24),'#ff9b22ff',flashRoot,Quaternion.fromEulerDegrees(0,0,12))
  emissivePart('Muzzle fire vertical',Vector3.create(0,0,.03),Vector3.create(.055,.62,.24),'#ffb52dff',flashRoot,Quaternion.fromEulerDegrees(0,0,-8))
  emissivePart('Muzzle spark left',Vector3.create(-.22,.09,.14),Vector3.create(.32,.025,.025),'#ffd166ff',flashRoot,Quaternion.fromEulerDegrees(0,-25,-18))
  emissivePart('Muzzle spark right',Vector3.create(.22,-.07,.11),Vector3.create(.3,.025,.025),'#ff8a1dff',flashRoot,Quaternion.fromEulerDegrees(0,22,16))
  smokeRoot=engine.addEntity();Transform.create(smokeRoot,{position:Vector3.create(0,.08,.07),scale:Vector3.create(.001,.001,.001),parent:muzzleFxRoot})
  const smokeA=part('Muzzle smoke A',Vector3.Zero(),Vector3.create(.22,.18,.3),'#70757a88',smokeRoot);Material.setPbrMaterial(smokeA,{albedoColor:Color4.fromHexString('#70757a88'),metallic:0,roughness:1})
  const smokeB=part('Muzzle smoke B',Vector3.create(.1,.08,.15),Vector3.create(.18,.2,.22),'#4c505588',smokeRoot);Material.setPbrMaterial(smokeB,{albedoColor:Color4.fromHexString('#4c505588'),metallic:0,roughness:1})
  for(let index=0;index<4;index+=1){const entity=part(`Ejected casing ${index+1}`,Vector3.Zero(),Vector3.create(.001,.001,.001),'#d79d34ff',root,Quaternion.fromEulerDegrees(0,0,90),true);casings.push({entity,age:1,velocity:Vector3.Zero(),spin:0})}
  bombProp=part('Bomb in throwing hand',Vector3.Zero(),Vector3.create(.001,.001,.001),'#25291fff',root,Quaternion.Identity(),true)
  const bombBand=emissivePart('Bomb purple fuse band',Vector3.create(0,.02,0),Vector3.create(.19,.045,.19),'#b72cffff',bombProp,Quaternion.Identity(),true)
  Transform.getMutable(bombBand).position.y=.04
  engine.addSystem(system)
}
