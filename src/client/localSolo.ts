import {
  BotState,
  BombState,
  LootState,
  MatchState,
  PlayerState
} from '../shared/schemas'
import {
  DIFFICULTY,
  BOMB,
  ENEMIES,
  ENEMY_SPAWN_ZONES,
  COMBAT_LAND_ZONES,
  MUTANT_ISLAND_GROUND,
  mutantSurfaceY,
  isOnMutantIslandGround,
  isOnMutantBridge,
  isInsideCombatLand,
  MUTANT_AVATARS,
  GAME,
  PANDORA_BOX_SPAWNS,
  WORLD_LOOT_SPAWNS,
  LOCATIONS,
  MISSION_ORDER,
  MISSIONS,
  WEAPONS,
  OUTPOST_ZONE,
  isInsideOutpost,
  type BuildKind,
  type Difficulty,
  type EnemyVariant,
  type InventoryItem,
  type WeaponId
} from '../shared/config'
import {
  ColliderLayer,
  AvatarShape,
  Animator,
  Entity,
  GltfContainer,
  Material,
  MeshCollider,
  MeshRenderer,
  Raycast,
  RaycastQueryType,
  RaycastResult,
  Transform,
  engine
} from '@dcl/sdk/ecs'
import { Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import { getPlayer } from '@dcl/sdk/src/players'
import { playMutantAlertSound, playEnemyBigExplosionSound, playMutantAcidAttackSound, playEnemyMissileFireSound } from './audio'
import { clientState } from './state'
import { GENERATED_MISSIONS } from '../shared/generatedMissions'

let matchEntity: Entity | undefined
let playerEntity: Entity | undefined
let started = false
let worldTick = 0
let survivalTick = 0
let previousSurvivalPosition = Vector3.Zero()
const botEntities: Entity[] = []
const lootEntities: Entity[] = []
const botLastShotAt = new Map<string, number>()
const botHasSeenPlayer = new Map<string, boolean>()
const botParts = new Map<string, Entity[]>()
const kingModels = new Map<string, Entity>()
const kingAnimationState = new Map<string, string>()
const kingAttackFlip = new Map<string, boolean>()
const localProjectiles = new Map<Entity, { velocity: Vector3; damage: number; expiresAt: number; toxic:boolean }>()
const localImpactFx = new Map<Entity,{expiresAt:number;toxic:boolean;damage:number;lastTick:number}>()
const localBombs = new Map<Entity, { velocity: Vector3; explodeAt: number; blastUntil: number; exploded: boolean }>()
let localDifficulty: Difficulty = 'normal'
let localMissionAdvanceAt = 0
const localBuildStacks = new Map<string, number>()

export function getLocalSoloMatch() {
  return matchEntity ? MatchState.getOrNull(matchEntity) : undefined
}

export function getLocalSoloPlayer() {
  return playerEntity ? PlayerState.getOrNull(playerEntity) : undefined
}

function selectedMissionPlan(wave=1){
  const gm=GENERATED_MISSIONS[Math.max(0,Math.min(GENERATED_MISSIONS.length-1,clientState.missionAcceptedIndex>=0?clientState.missionAcceptedIndex:0))]
  const scale=gm.difficulty==='SPECIAL'?4:gm.difficulty==='HARD'?3:gm.difficulty==='MEDIUM'?2:1
  const base=Math.max(4,GAME.missionBasePerFamily+scale*2+Math.floor((wave-1)*1.5))
  const set=gm.enemySet.toLowerCase()
  let mutants=0,drones=0,kings=0
  if(set.includes('mixed')){mutants=base;drones=base;kings=Math.max(1,scale)}
  else if(set.includes('mutants + drones')){mutants=base;drones=base}
  else if(set.includes('king')){mutants=Math.max(3,Math.floor(base*.6));kings=Math.max(1,scale+Math.floor(wave/3))}
  else if(set.includes('drone'))drones=Math.max(base+2,Math.floor(base*1.25))
  else mutants=Math.max(base+2,Math.floor(base*1.25))
  return {gm,mutants,drones,kings}
}
function deployMissionHostiles(wave:number){
  const plan=selectedMissionPlan(wave),base=botEntities.length
  const mutantVariants:EnemyVariant[]=['standard-mutant','berserker-mutant','stalker-mutant','infected-mutant'],droneVariants:EnemyVariant[]=['scout-drone','attack-drone','support-drone']
  for(let i=0;i<plan.mutants;i++)makeBot(base+i,mutantVariants[i%mutantVariants.length],wave,i)
  for(let i=0;i<plan.kings;i++)makeBot(base+plan.mutants+i,'king-mutant',wave,i)
  for(let i=0;i<plan.drones;i++)makeBot(base+plan.mutants+plan.kings+i,droneVariants[i%droneVariants.length],wave,i)
  return plan
}

function part(botId: string, parent: Entity, position: Vector3, scale: Vector3, color: string, mesh: 'box'|'sphere'|'cylinder'='box', emissive=false, rotation=Quaternion.Identity()) {
  const entity=engine.addEntity(); Transform.create(entity,{position,scale,rotation,parent})
  if(mesh==='sphere')MeshRenderer.setSphere(entity);else if(mesh==='cylinder')MeshRenderer.setCylinder(entity,.5,.5);else MeshRenderer.setBox(entity)
  Material.setPbrMaterial(entity,{albedoColor:Color4.fromHexString(color),emissiveColor:emissive?Color4.fromHexString(color):undefined,emissiveIntensity:emissive?2.5:0,metallic:.45,roughness:.5})
  const parts=botParts.get(botId)??[];parts.push(entity);botParts.set(botId,parts);return entity
}

function playLocalKingAnimation(botId:string, clip:string, force=false){
  const model=kingModels.get(botId); if(!model)return
  if(!force&&kingAnimationState.get(botId)===clip)return
  kingAnimationState.set(botId,clip); Animator.playSingleAnimation(model,clip)
}

function makeEnemyModel(botId:string,root:Entity,variant:EnemyVariant){
  const def=ENEMIES[variant]
  if(def.family==='drone'){
    const model=engine.addEntity();Transform.create(model,{position:Vector3.create(0,-.35,0),scale:Vector3.create(1.15,1.15,1.15),parent:root});GltfContainer.create(model,{src:'assets/Models/Drones.glb'})
    const parts=botParts.get(botId)??[];parts.push(model);botParts.set(botId,parts);return
  }
  if(variant==='king-mutant'){
    const model=engine.addEntity();Transform.create(model,{position:Vector3.create(0,0,0),scale:Vector3.One(),parent:root});GltfContainer.create(model,{src:'assets/Models/KingMutantAnimated.glb',visibleMeshesCollisionMask:0,invisibleMeshesCollisionMask:0})
    Animator.create(model,{states:[
      {clip:'Idle',playing:true,loop:true},{clip:'Walk',playing:false,loop:true},{clip:'Jump',playing:false,loop:false},
      {clip:'Roar',playing:false,loop:false},{clip:'Attack 1',playing:false,loop:false},{clip:'Attack 2',playing:false,loop:false},
      {clip:'Get Hit',playing:false,loop:false},{clip:'Death',playing:false,loop:false}
    ]})
    kingModels.set(botId,model);kingAnimationState.set(botId,'Idle')
    const parts=botParts.get(botId)??[];parts.push(model);botParts.set(botId,parts);return
  }
  const appearance=MUTANT_AVATARS[variant as keyof typeof MUTANT_AVATARS]
  AvatarShape.create(root,{id:`project-exodus-${botId}`,name:'',bodyShape:'urn:decentraland:off-chain:base-avatars:BaseMale',wearables:[...appearance.wearables],skinColor:appearance.skin,eyeColor:appearance.eye,hairColor:appearance.hair,expressionTriggerId:'',expressionTriggerTimestamp:0,emotes:[],talking:false,showOnlyWearables:false})
}

function playLocalMutantEmote(entity:Entity,emote:string){const avatar=AvatarShape.getMutableOrNull(entity);if(!avatar)return;avatar.expressionTriggerId=emote;avatar.expressionTriggerTimestamp=(avatar.expressionTriggerTimestamp??0)+1}

function makeBot(index: number, forcedVariant?:EnemyVariant, missionNumber=1, spawnOrdinal=index) {
  const mutants:EnemyVariant[]=['standard-mutant','standard-mutant','berserker-mutant','stalker-mutant','infected-mutant'],drones:EnemyVariant[]=['scout-drone','attack-drone','attack-drone','support-drone']
  const provisionalFamily=forcedVariant?ENEMIES[forcedVariant].family:ENEMY_SPAWN_ZONES[index%ENEMY_SPAWN_ZONES.length].family
  const eligibleZones=ENEMY_SPAWN_ZONES.filter((candidate)=>candidate.family===provisionalFamily),zone=eligibleZones[index%eligibleZones.length]
  const variant=forcedVariant??(zone.family==='mutant'?mutants[index%mutants.length]:drones[index%drones.length]),def=ENEMIES[variant],botId=`local-enemy-${index}`
  const entity = engine.addEntity()
  const slot = Math.floor(index / Math.max(1, eligibleZones.length))
  const seedBase = index + slot * 131 + (def.family === 'drone' ? 7919 : 3571)
  let position: Vector3
  if(def.family==='drone'){
    const islandZones=COMBAT_LAND_ZONES.slice(1,7),perIsland=Math.max(3,missionNumber*3),islandSlots=islandZones.length*perIsland,ordinal=spawnOrdinal
    if(ordinal<islandSlots){const islandIndex=Math.floor(ordinal/perIsland)%islandZones.length,local=ordinal%perIsland,land=islandZones[islandIndex],ring=Math.floor(local/6),angle=(local%6)*(Math.PI*2/6)+ring*.41+islandIndex*.27,radius=7+ring*4.2+(local%3)*1.1;position=Vector3.create(land.x+Math.cos(angle)*radius,6.5+((local+islandIndex)%6)*.8,land.z+Math.sin(angle)*radius)}
    else{const roam=ordinal-islandSlots,t=(roam+1)/(Math.max(1,missionNumber*2)+1),routes=[[124,292,226,222],[254,218,373,282],[252,226,267,370],[254,204,371,112],[284,384,346,384],[240,94,240,202]],r=routes[roam%routes.length],lane=Math.floor(roam/routes.length),side=((lane%2)*2-1)*(5+Math.floor(lane/2)*3),dx=r[2]-r[0],dz=r[3]-r[1],len=Math.max(1,Math.hypot(dx,dz));position=Vector3.create(r[0]+dx*t+(-dz/len)*side,7.5+(roam%5)*.9,r[1]+dz*t+(dx/len)*side)}
  }else{
    const seedX=((seedBase*73+19)%1009)/1008,seedZ=((seedBase*151+47)%1013)/1012,landZone=COMBAT_LAND_ZONES[zone.zoneIndex]
    position=Vector3.create(zone.x+(seedX*2-1)*Math.max(3,landZone.halfWidth-1.8),1.30,zone.z+(seedZ*2-1)*Math.max(3,landZone.halfDepth-1.8)); position=Vector3.create(position.x,mutantSurfaceY(position),position.z)
  }
  Transform.create(entity, { position, scale: variant==='king-mutant'?Vector3.create(10.0,10.0,10.0):Vector3.One() })
  MeshCollider.setBox(entity, ColliderLayer.CL_POINTER)
  BotState.create(entity, { botId, displayName:def.name,hp:def.hp,active:true,targetId:'',family:def.family,variant,aiState:'patrol',maxHp:def.hp,damage:Math.round(def.damage*DIFFICULTY[localDifficulty].damage),speed:def.speed*DIFFICULTY[localDifficulty].speed,detection:def.detection*DIFFICULTY[localDifficulty].detection,homeX:position.x,homeZ:position.z,lastKnownX:position.x,lastKnownZ:position.z,lastSeenAt:0,stateUntil:0,attackReadyAt:0,reinforcementLevel:0,airborne:def.family==='drone'})
  makeEnemyModel(botId,entity,variant)
  if(def.family==='mutant') Raycast.create(entity,{originOffset:Vector3.create(0,.7,0),direction:{ $case:'globalDirection',globalDirection:Vector3.Forward()},maxDistance:1.4,queryType:RaycastQueryType.RQT_HIT_FIRST,timestamp:Date.now()})
  botEntities.push(entity)
}

function makeLoot(index: number) {
  const spawn = WORLD_LOOT_SPAWNS[index % WORLD_LOOT_SPAWNS.length]
  const kinds = ['ammo-rifle','ammo-shotgun','ammo-pistol','bomb','materials','medkit','ammo-rifle','shield-cell','ammo-pistol','water'] as const
  const kind = kinds[index % kinds.length]
  // The Outpost is a safe staging area: no loose bullets or bombs spawn inside it.
  const insideOutpost = Math.abs(spawn.x - OUTPOST_ZONE.centerX) <= OUTPOST_ZONE.halfWidth && Math.abs(spawn.z - OUTPOST_ZONE.centerZ) <= OUTPOST_ZONE.halfDepth
  if (insideOutpost) return
  const amount = kind === 'ammo-rifle' ? 30 : kind === 'ammo-shotgun' ? 8 : kind === 'ammo-pistol' ? 18 : kind === 'materials' ? 5 : 1
  const entity = engine.addEntity()
  Transform.create(entity, { position: Vector3.create(spawn.x, spawn.y ?? 1.05, spawn.z), scale: Vector3.create(0.85, 0.85, 0.85) })
  LootState.create(entity, { lootId: `local-loot-${index}`, kind, amount, active: true })
  lootEntities.push(entity)
}

function makePandoraBox(index: number) {
  const spawn=PANDORA_BOX_SPAWNS[(index*2+1)%PANDORA_BOX_SPAWNS.length],entity=engine.addEntity()
  Transform.create(entity,{position:Vector3.create(spawn.x,1.92,spawn.z),scale:Vector3.create(1.15,.9,.95),rotation:Quaternion.fromEulerDegrees(0,45,0)})
  MeshRenderer.setBox(entity);MeshCollider.setBox(entity,ColliderLayer.CL_POINTER)
  Material.setPbrMaterial(entity,{albedoColor:Color4.fromHexString('#222633ff'),emissiveColor:Color4.fromHexString('#b838ffff'),emissiveIntensity:3.2,metallic:.72,roughness:.28})
  LootState.create(entity,{lootId:`local-pandora-${index}`,kind:'life-credit',amount:1,active:true});lootEntities.push(entity)
}

function makeDroneAmmoDrop(bot:ReturnType<typeof BotState.get>,position:Vector3){
  const reward=bot.variant==='support-drone'?{kind:'ammo-shotgun',amount:8}:bot.variant==='scout-drone'?{kind:'ammo-pistol',amount:18}:{kind:'ammo-rifle',amount:30}
  const entity=engine.addEntity()
  Transform.create(entity,{position:Vector3.create(position.x,1.7,position.z),scale:Vector3.create(.9,.5,.68),rotation:Quaternion.fromEulerDegrees(0,35,0)})
  LootState.create(entity,{lootId:`local-drone-ammo-${bot.botId}-${Date.now()}`,kind:reward.kind,amount:reward.amount,active:true})
  lootEntities.push(entity)
}

export function startLocalSolo(difficulty: Difficulty = 'normal') {
  if (started) return
  started = true
  localDifficulty = difficulty
  const now = Date.now()
  matchEntity = engine.addEntity()
  MatchState.create(matchEntity, {
    phase: 'active', mode: 'solo-bots', round: 1, startsAt: now, endsAt: now + GAME.matchSeconds * 1000,
    alivePlayers: DIFFICULTY[difficulty].enemyCount + 1, zoneRadius: GAME.initialZoneRadius, heartbeat: now,
    winner: '', announcement: 'Local solo survival active', difficulty, threatLevel: 1
  })
  playerEntity = engine.addEntity()
  const profile = getPlayer()
  PlayerState.create(playerEntity, {
    playerId: profile?.userId.toLowerCase() ?? 'local-player', displayName: profile?.name ?? 'Exodus Runner',
    hp: 100, shield: 50, kills: 0, deaths: 0, materials: GAME.startingMaterials,
    equippedWeapon: 'pulse-rifle', ammoRifle: 0, ammoShotgun: 0, ammoPistol: 0,
    magazineRifle: 0, magazineShotgun: 0, magazinePistol: 0,
    medkits: 1, shieldCells: 1, water: 2, bombs: 2, lifeCredits: 0, stamina: 100, hunger: 100, thirst: 100,
    missionId: 'reach-city', missionComplete: false, missionsCompleted: 0, mutantKills:0, droneKills:0, lootCollected:0, explosivesUsed:0, healingDone:0, watersUsed:0, tradesCompleted:0, soloMissions:0, coopMissions:0, suppliesDelivered:0, outpostDefenses:0, cleanSweeps:0, locationsDiscovered:0, missionTypesMask:0, noHitMissions:0, headshots:0, legendaryLoot:0, weaponsCollected:0, speedRuns:0, nightMissions:0, missionDamageTaken:0, missionStartedAt:now, joined: true, alive: true
  })
  const initialPlan=deployMissionHostiles(1)
  MatchState.getMutable(matchEntity).announcement=`${initialPlan.gm.name} — MUTANTS ${initialPlan.mutants} • DRONES ${initialPlan.drones} • KINGS ${initialPlan.kings}`
  for (let index = 0; index < WORLD_LOOT_SPAWNS.length; index += 1) makeLoot(index)
  for (let index = 0; index < GAME.pandoraBoxesPerRound; index += 1) makePandoraBox(index)
  engine.addSystem(localSoloSystem)
}

function pointToRayDistance(origin: Vector3, direction: Vector3, point: Vector3) {
  const relative = Vector3.subtract(point, origin)
  const along = Vector3.dot(relative, direction)
  if (along < 0) return { along, miss: Number.POSITIVE_INFINITY }
  return { along, miss: Vector3.distance(point, Vector3.add(origin, Vector3.scale(direction, along))) }
}

const playerShotProbes=new Map<Entity,Entity>()
function playerShotClear(target:Entity,origin:Vector3,targetPos:Vector3){
  let e=playerShotProbes.get(target)
  if(!e){e=engine.addEntity();Transform.create(e,{position:Vector3.clone(origin)});Raycast.create(e,{originOffset:Vector3.Zero(),direction:{$case:'globalDirection',globalDirection:Vector3.Forward()},maxDistance:1,queryType:RaycastQueryType.RQT_HIT_FIRST,timestamp:Date.now()});playerShotProbes.set(target,e)}
  const dist=Vector3.distance(origin,targetPos),hit=RaycastResult.getOrNull(e)?.hits?.[0],clear=!hit||hit.length>=Math.max(.5,dist-.8)
  Transform.getMutable(e).position=Vector3.clone(origin);const r=Raycast.getMutable(e);r.originOffset=Vector3.Zero();r.direction={$case:'globalDirection',globalDirection:Vector3.normalize(Vector3.subtract(targetPos,origin))};r.maxDistance=dist;r.timestamp=Date.now()
  return clear
}

export function fireLocalWeapon(direction: Vector3) {
  if (!playerEntity) return 'Solo training is loading'
  const player = PlayerState.getMutable(playerEntity)
  const weapon = WEAPONS[player.equippedWeapon as WeaponId] ?? WEAPONS['pulse-rifle']
  if (player[weapon.magazineField] <= 0) return 'Magazine empty - reload'
  player[weapon.magazineField] -= 1
  const playerTransform = Transform.getOrNull(engine.PlayerEntity)
  if (!playerTransform) return 'Shot fired'
  if (isInsideOutpost(playerTransform.position)) return 'Weapons are secured inside the Outpost'
  const origin = Vector3.create(playerTransform.position.x, playerTransform.position.y + 1.35, playerTransform.position.z)
  let closest: Entity | undefined
  const effectiveRange=Math.max(weapon.range,140)
  let closestDistance = effectiveRange + 1
  for (const entity of botEntities) {
    const bot = BotState.getOrNull(entity)
    const transform = Transform.getOrNull(entity)
    if (!bot?.active || !transform) continue
    const test = pointToRayDistance(origin, direction, transform.position)
    if (test.along <= effectiveRange && test.miss <= (bot?.variant==='king-mutant'?5.0:bot?.family==='drone'?1.8:1.65) && test.along < closestDistance) {
      closest = entity
      closestDistance = test.along
    }
  }
  if (!closest) return 'Shot fired'
  const closestTransform=Transform.getOrNull(closest)
  if(!closestTransform||!playerShotClear(closest,origin,Vector3.create(closestTransform.position.x,closestTransform.position.y+1,closestTransform.position.z))) return 'Shot blocked by cover'
  const bot = BotState.getMutable(closest)
  bot.hp = Math.max(0, bot.hp - weapon.damage)
  bot.aiState = 'alert'
  if(bot.variant==='king-mutant')playLocalKingAnimation(bot.botId,'Get Hit',true);else if(bot.family==='mutant')playLocalMutantEmote(closest,'getHit')
  bot.lastSeenAt = Date.now()
  if (bot.hp === 0) {
    bot.active = false
    bot.aiState = 'dead'
    if(bot.variant==='king-mutant')playLocalKingAnimation(bot.botId,'Death',true);else if(bot.family==='mutant')playLocalMutantEmote(closest,'knockOut')
    const defeatedTransform=Transform.getMutable(closest)
    if(bot.family==='drone'||bot.variant==='king-mutant')makeDroneAmmoDrop(bot,defeatedTransform.position)
    if(bot.variant!=='king-mutant') defeatedTransform.rotation = Quaternion.fromEulerDegrees(0,0,bot.family==='mutant'?82:28)
    defeatedTransform.position.y = .35
    player.kills += 1
    player.materials += bot.variant === 'berserker-mutant' || bot.variant === 'support-drone' ? 5 : 3
  }
  return `Hit for ${weapon.damage}`
}

export function selectLocalWeapon(weapon: WeaponId) {
  if (!playerEntity) return 'Inventory is loading'
  PlayerState.getMutable(playerEntity).equippedWeapon = weapon
  return `${WEAPONS[weapon].name} equipped`
}

export function reloadLocalWeapon() {
  if (!playerEntity) return 'Inventory is loading'
  const player = PlayerState.getMutable(playerEntity)
  const weapon = WEAPONS[player.equippedWeapon as WeaponId] ?? WEAPONS['pulse-rifle']
  const moved = Math.min(weapon.magazine - player[weapon.magazineField], player[weapon.ammoField])
  if (moved <= 0) return player[weapon.magazineField] >= weapon.magazine ? 'Magazine already full' : 'No reserve ammunition'
  player[weapon.ammoField] -= moved
  player[weapon.magazineField] += moved
  return `${weapon.name} reloaded`
}

export function throwLocalBomb(direction: Vector3) {
  if (!playerEntity) return 'Solo training is loading'
  const player = PlayerState.getMutable(playerEntity), playerTransform = Transform.getOrNull(engine.PlayerEntity)
  if (!player.alive || !playerTransform) return 'Bombs are unavailable'
  if (isInsideOutpost(playerTransform.position)) return 'Explosives are secured inside the Outpost'
  if (player.bombs <= 0) return 'No bombs - find a purple bomb pickup'
  player.bombs -= 1
  const entity = engine.addEntity(), velocity = Vector3.add(Vector3.scale(direction, BOMB.throwSpeed), Vector3.create(0, 5.6, 0))
  // Start at the visible right-hand side of the FPS view, then throw toward the aim direction.
  const right=Vector3.normalize(Vector3.create(direction.z,0,-direction.x))
  Transform.create(entity,{position:Vector3.create(playerTransform.position.x+direction.x*.55+right.x*.38,playerTransform.position.y+1.12,playerTransform.position.z+direction.z*.55+right.z*.38),scale:Vector3.create(.34,.34,.34)})
  MeshRenderer.setSphere(entity);Material.setPbrMaterial(entity,{albedoColor:Color4.fromHexString('#25291fff'),emissiveColor:Color4.fromHexString('#9b25ffff'),emissiveIntensity:1.7,metallic:.58,roughness:.44})
  BombState.create(entity,{bombId:`local-bomb-${Date.now()}`,ownerId:'local-player',phase:'thrown',explodeAt:Date.now()+BOMB.fuseMs,expiresAt:0,velocityX:velocity.x,velocityY:velocity.y,velocityZ:velocity.z})
  localBombs.set(entity,{velocity,explodeAt:Date.now()+BOMB.fuseMs,blastUntil:0,exploded:false})
  return `Bomb thrown - ${player.bombs} remaining`
}

function updateLocalBombs(dt:number, player:ReturnType<typeof PlayerState.getMutable>){
  const now=Date.now()
  for(const[entity,state]of localBombs){const transform=Transform.getMutableOrNull(entity);if(!transform){localBombs.delete(entity);continue}
    if(!state.exploded){state.velocity=Vector3.create(state.velocity.x,state.velocity.y-9.8*dt,state.velocity.z);const next=Vector3.add(transform.position,Vector3.scale(state.velocity,dt));if(next.y<=.35){next.y=.35;state.velocity=Vector3.create(state.velocity.x*.72,Math.abs(state.velocity.y)*.28,state.velocity.z*.72)}transform.position=next;transform.rotation=Quaternion.fromEulerDegrees(now*.22,now*.31,now*.17)
      if(now>=state.explodeAt){state.exploded=true;state.blastUntil=now+520;BombState.getMutable(entity).phase='blast';Material.setPbrMaterial(entity,{albedoColor:Color4.fromHexString('#fff0a0e8'),emissiveColor:Color4.fromHexString('#ff7a18ff'),emissiveIntensity:12});for(const botEntity of botEntities){const bot=BotState.getMutableOrNull(botEntity),botTransform=Transform.getOrNull(botEntity);if(!bot?.active||!botTransform)continue;const distance=Vector3.distance(transform.position,botTransform.position);if(distance>BOMB.blastRadius)continue;bot.hp=Math.max(0,bot.hp-Math.max(12,Math.round(BOMB.maxDamage*(1-distance/BOMB.blastRadius))));bot.aiState='alert';if(bot.hp===0){bot.active=false;bot.aiState='dead';if(bot.variant==='king-mutant')playLocalKingAnimation(bot.botId,'Death',true);if(bot.family==='drone'||bot.variant==='king-mutant')makeDroneAmmoDrop(bot,botTransform.position);Transform.getMutable(botEntity).position.y=.35;player.kills+=1}}}
    }else{const life=1-Math.max(0,state.blastUntil-now)/520,size=.4+Math.sin(Math.min(1,life)*Math.PI)*BOMB.blastRadius*.8;transform.scale=Vector3.create(size,size,size);if(now>=state.blastUntil){engine.removeEntity(entity);localBombs.delete(entity)}}
  }
}

export function useLocalItem(item: InventoryItem) {
  if (!playerEntity) return 'Inventory is loading'
  const player = PlayerState.getMutable(playerEntity)
  if (item === 'life-credit') {
    if (player.lifeCredits <= 0) return 'No Life Credits'
    if (player.hp >= 100) return 'Health is already full'
    player.lifeCredits -= 1
    player.hp = 100
    return 'Life Credit restored full health'
  }
  if (item === 'medkit') {
    if (player.medkits <= 0) return 'No medkits'
    if (player.hp >= 100) return 'Health is already full'
    player.medkits -= 1
    player.hp = Math.min(100, player.hp + 40)
    return 'Medkit restored 40 health'
  }
  if (item === 'water') {
    if (player.water <= 0) return 'No water'
    if (player.stamina >= 100) return 'Stamina is already full'
    player.water -= 1
    player.stamina = Math.min(100, player.stamina + 45)
    return 'Water restored stamina for faster running'
  }
  if (player.shieldCells <= 0) return 'No shield cells'
  if (player.shield >= 100) return 'Shield is already full'
  player.shieldCells -= 1
  player.shield = Math.min(100, player.shield + 30)
  return 'Shield cell restored 30 shield'
}

export function acceptLocalMission() {
  if (!playerEntity) return 'Mission system is loading'
  const player = PlayerState.getMutable(playerEntity)
  player.missionId = MISSION_ORDER[player.missionsCompleted % MISSION_ORDER.length]
  player.missionComplete = false
  return `${MISSIONS[player.missionId as keyof typeof MISSIONS].name} accepted`
}

export function buyLocalSupply(item: string) {
  if (!playerEntity) return 'Trader is loading'
  if(item!=='medkit'&&item!=='water')return 'Ammunition must be scavenged from the island'
  const player = PlayerState.getMutable(playerEntity)
  const price = item === 'medkit' ? 6 : 3
  if (player.materials < price) return 'Not enough materials'
  player.materials -= price
  if (item === 'medkit') player.medkits += 1
  else if (item === 'water') player.water += 1
  return `Purchased ${item.replace('-', ' ')}`
}

export function respawnLocalPlayer(choice: 'continue' | 'rejoin' | 'outpost') {
  if (!playerEntity || !matchEntity) return 'Respawn is unavailable'
  const player = PlayerState.getMutable(playerEntity)
  player.hp = 100
  player.shield = 50
  player.stamina = 100
  player.hunger = 100
  player.thirst = 100
  player.alive = true
  botHasSeenPlayer.clear()
  player.joined = choice === 'continue' || choice === 'rejoin'
  const match = MatchState.getMutable(matchEntity)
  if (choice === 'continue') {
    // Keep current mission, remaining enemies, kills and pickups exactly where they were.
    match.phase = 'active'
    match.announcement = 'Mission resumed — previous elimination progress preserved'
  } else if (choice === 'rejoin') {
    match.phase = 'active'
    match.round += 1
    match.startsAt = Date.now()
    match.endsAt = Date.now() + GAME.matchSeconds * 1000
    match.winner = ''
    match.announcement = 'New solo deployment active'
    match.threatLevel = 0
    botEntities.forEach((entity, index) => {
      const bot = BotState.getMutable(entity)
      bot.hp = bot.maxHp
      bot.active = true
      bot.aiState = 'patrol'; bot.targetId = ''; bot.lastSeenAt = 0
      Transform.getMutable(entity).rotation = Quaternion.Identity()
      Transform.getMutable(entity).position = Vector3.create(bot.homeX, bot.airborne ? 7 + index % 3 : mutantSurfaceY({x:bot.homeX,z:bot.homeZ}), bot.homeZ)
    })
    for(const entity of lootEntities) engine.removeEntity(entity)
    lootEntities.length=0
    for(const entity of localBombs.keys()) engine.removeEntity(entity)
    localBombs.clear()
    for(let index=0;index<WORLD_LOOT_SPAWNS.length;index+=1)makeLoot(index)
    for(let index=0;index<GAME.pandoraBoxesPerRound;index+=1)makePandoraBox(index+match.round)
  } else {
    match.phase = 'lobby'
    match.announcement = 'Safe at the Outpost. Deploy when ready.'
  }
  return choice
}

export function deployLocalBuild(kind: BuildKind, position: Vector3, yaw: number) {
  if (!playerEntity) return 'Build system is loading'
  const player = PlayerState.getMutable(playerEntity)
  const playerTransform=Transform.getOrNull(engine.PlayerEntity)
  if(playerTransform&&isInsideOutpost(playerTransform.position))return 'Building is disabled inside the Outpost'
  const entity = engine.addEntity()
  const sx=Math.round(position.x/2)*2, sz=Math.round(position.z/2)*2, stackKey=`${kind}:${sx}:${sz}:${Math.round(yaw/15)*15}`, level=localBuildStacks.get(stackKey)??0
  const baseY=kind==='wall'?1.335:kind==='ramp'?1.404:1.48, stepY=kind==='wall'?3.115:kind==='ramp'?3.208:.289
  localBuildStacks.set(stackKey,level+1)
  Transform.create(entity, { position: Vector3.create(sx,baseY+level*stepY,sz), scale: Vector3.One(), rotation: Quaternion.fromEulerDegrees(0,yaw,0) })
  GltfContainer.create(entity,{src:kind==='wall'?'assets/Models/BuildWall.glb':kind==='ramp'?'assets/Models/BuildRamp.glb':'assets/Models/BuildFloor.glb',visibleMeshesCollisionMask:ColliderLayer.CL_POINTER|ColliderLayer.CL_PHYSICS,invisibleMeshesCollisionMask:ColliderLayer.CL_POINTER|ColliderLayer.CL_PHYSICS})
  // Project Exodus v13: building materials are infinite; placement never consumes stock.
  return `${kind} deployed`
}

function collectLoot(player: ReturnType<typeof PlayerState.getMutable>, playerPosition: Vector3) {
  for (const entity of lootEntities) {
    const loot = LootState.getMutableOrNull(entity)
    const transform = Transform.getOrNull(entity)
    if (!loot?.active || !transform || Vector3.distance(playerPosition, transform.position) > 3.6) continue
    if (loot.kind === 'life-credit') player.lifeCredits += loot.amount
    else if (loot.kind === 'materials') player.materials += loot.amount
    else if (loot.kind === 'ammo-shotgun') player.ammoShotgun += loot.amount
    else if (loot.kind === 'ammo-pistol') player.ammoPistol += loot.amount
    else if (loot.kind === 'medkit') player.medkits += loot.amount
    else if (loot.kind === 'shield-cell') player.shieldCells += loot.amount
    else if (loot.kind === 'water') player.water += loot.amount
    else if (loot.kind === 'bomb') player.bombs += loot.amount
    else player.ammoRifle += loot.amount
    player.lootCollected += 1
    if(loot.kind.startsWith('ammo-')) player.weaponsCollected += 1
    if(player.lootCollected%25===0) player.legendaryLoot += 1
    loot.active = false
    Transform.getMutable(entity).position.y = -20
  }
}

function escalateLocalThreat(match:ReturnType<typeof MatchState.getMutable>){
  match.threatLevel+=1
  const remaining=Math.max(0,GAME.maxEnemies-botEntities.filter((entity)=>BotState.getOrNull(entity)?.active).length)
  const waveSize=Math.min(remaining,GAME.missionWaveBase+Math.min(4,Math.floor((match.threatLevel-1)/2)))
  const wave:EnemyVariant[]=['standard-mutant','attack-drone','stalker-mutant','scout-drone','infected-mutant','support-drone']
  for(let index=0;index<waveSize;index+=1)makeBot(botEntities.length,wave[index%wave.length])
  match.announcement=`Mission complete — threat level ${match.threatLevel}. ${waveSize} new hostiles detected.`
}

function fireLocalEnemyProjectile(origin:Vector3, target:Vector3, damage:number, toxic:boolean){
  if(toxic)playMutantAcidAttackSound();else playEnemyMissileFireSound()
  const direction=Vector3.normalize(Vector3.subtract(Vector3.create(target.x,target.y+1,target.z),origin)),entity=engine.addEntity()
  Transform.create(entity,{position:Vector3.clone(origin),scale:Vector3.create(toxic?.42:.22,toxic?.42:.22,toxic?.42:.65),rotation:Quaternion.multiply(Quaternion.lookRotation(direction),Quaternion.fromEulerDegrees(0,270,0))})
  if(toxic){GltfContainer.create(entity,{src:'assets/Models/MutantBullet_v66.glb',visibleMeshesCollisionMask:0,invisibleMeshesCollisionMask:0});Transform.getMutable(entity).scale=Vector3.create(1.36,1.36,1.36)}else{GltfContainer.create(entity,{src:'assets/Models/DroneBullet_v65.glb'});Transform.getMutable(entity).scale=Vector3.create(1.36,1.36,1.36)}
  Raycast.create(entity,{originOffset:Vector3.Zero(),direction:{ $case:'globalDirection',globalDirection:direction},maxDistance:1.25,queryType:RaycastQueryType.RQT_HIT_FIRST,timestamp:Date.now()})
  localProjectiles.set(entity,{velocity:Vector3.scale(direction,toxic?8:11),damage:Math.max(1,Math.round(damage*2)),expiresAt:Date.now()+4200,toxic})
}

function damageLocalPlayer(player:ReturnType<typeof PlayerState.getMutable>,damage:number){player.missionDamageTaken+=Math.max(0,damage);const transform=Transform.getOrNull(engine.PlayerEntity);if(transform&&isInsideOutpost(transform.position))return;const absorbed=Math.min(player.shield,damage);player.shield-=absorbed;player.hp=Math.max(0,player.hp-(damage-absorbed));if(player.hp===0)player.alive=false}

function spawnLocalImpact(position:Vector3,toxic:boolean,damage:number){
  if(!toxic)playEnemyBigExplosionSound()
  const now=Date.now(),count=toxic?14:26
  for(let i=0;i<count;i++){
    const a=(i/count)*Math.PI*2,rad=toxic?1.15:.9,e=engine.addEntity()
    Transform.create(e,{position:Vector3.create(position.x+Math.cos(a)*rad,position.y+(i%3)*.12,position.z+Math.sin(a)*rad),scale:toxic?Vector3.create(.72,.30,.72):Vector3.create(.52,.24,.64),rotation:Quaternion.fromEulerDegrees(i*19,i*41,i*27)})
    MeshRenderer.setBox(e)
    Material.setPbrMaterial(e,toxic?{albedoColor:Color4.fromHexString('#38ff56aa'),emissiveColor:Color4.fromHexString('#22d948ff'),emissiveIntensity:2.8,roughness:.45}:{albedoColor:Color4.fromHexString(i%2?'#49bfffff':'#ff6b18ff'),emissiveColor:Color4.fromHexString(i%2?'#39aaffff':'#ff7a18ff'),emissiveIntensity:7,roughness:.25})
    localImpactFx.set(e,{expiresAt:now+(toxic?900:520),toxic,damage:0,lastTick:0})
  }
}
function updateLocalImpactFx(player:ReturnType<typeof PlayerState.getMutable>,playerPosition:Vector3){const now=Date.now();for(const[e,fx]of localImpactFx){const t=Transform.getMutableOrNull(e);if(!t||now>=fx.expiresAt){engine.removeEntity(e);localImpactFx.delete(e);continue}}}

function updateLocalProjectiles(dt:number,player:ReturnType<typeof PlayerState.getMutable>,playerPosition:Vector3){const now=Date.now();for(const[entity,p]of localProjectiles){const t=Transform.getMutableOrNull(entity);if(!t||now>=p.expiresAt){if(t)spawnLocalImpact(t.position,p.toxic,p.damage);engine.removeEntity(entity);localProjectiles.delete(entity);continue}Raycast.getMutable(entity).timestamp=now;const hit=RaycastResult.getOrNull(entity)?.hits?.[0];if(hit&&hit.length<=1.25){spawnLocalImpact(t.position,p.toxic,p.damage);engine.removeEntity(entity);localProjectiles.delete(entity);continue}t.position=Vector3.add(t.position,Vector3.scale(p.velocity,dt));if(isInsideOutpost(t.position)){engine.removeEntity(entity);localProjectiles.delete(entity);continue}if(Vector3.distance(t.position,Vector3.create(playerPosition.x,playerPosition.y+1,playerPosition.z))<1.25){damageLocalPlayer(player,p.damage);spawnLocalImpact(t.position,p.toxic,p.damage);engine.removeEntity(entity);localProjectiles.delete(entity)}}updateLocalImpactFx(player,playerPosition)}

// v110: three-probe solid-world navigation. NPC transforms do not physically collide
// with GLB colliders in Decentraland, so Mutants must query the PHYSICS world before moving.
// Dedicated forward/left/right probes avoid the stale single-ray direction bug from v109.
const mutantWallAvoid = new Map<Entity,{side:number,until:number}>()
const mutantProbes = new Map<Entity,{f:Entity,l:Entity,r:Entity,fl:Entity,fr:Entity}>()
function ensureMutantProbes(owner:Entity,position:Vector3){
  let p=mutantProbes.get(owner);if(p)return p
  const make=()=>{const e=engine.addEntity();Transform.create(e,{position:Vector3.clone(position)});Raycast.create(e,{originOffset:Vector3.create(0,.62,0),direction:{$case:'globalDirection',globalDirection:Vector3.Forward()},maxDistance:2.4,queryType:RaycastQueryType.RQT_HIT_FIRST,timestamp:Date.now()});return e}
  p={f:make(),l:make(),r:make(),fl:make(),fr:make()};mutantProbes.set(owner,p);return p
}
function probeBlocked(e:Entity,max:number){const h=RaycastResult.getOrNull(e)?.hits?.[0];return !!h&&h.length<=max}
function aimProbe(e:Entity,pos:Vector3,dir:Vector3,max:number){
  const t=Transform.getMutable(e);t.position=Vector3.clone(pos)
  const r=Raycast.getMutable(e);r.originOffset=Vector3.create(0,.62,0);r.direction={$case:'globalDirection',globalDirection:dir};r.maxDistance=max;r.timestamp=Date.now()
}
const enemyLosProbes=new Map<Entity,Entity>()
function enemyHasLineOfSight(owner:Entity,from:Vector3,to:Vector3){
  let e=enemyLosProbes.get(owner)
  if(!e){e=engine.addEntity();Transform.create(e,{position:Vector3.clone(from)});Raycast.create(e,{originOffset:Vector3.create(0,1.25,0),direction:{$case:'globalDirection',globalDirection:Vector3.Forward()},maxDistance:1,queryType:RaycastQueryType.RQT_HIT_FIRST,timestamp:Date.now()});enemyLosProbes.set(owner,e)}
  const dist=Vector3.distance(from,to),result=RaycastResult.getOrNull(e)?.hits?.[0]
  const clear=!result||result.length>=Math.max(.5,dist-.75)
  const t=Transform.getMutable(e);t.position=Vector3.clone(from)
  const r=Raycast.getMutable(e);r.originOffset=Vector3.create(0,1.25,0);r.direction={$case:'globalDirection',globalDirection:Vector3.normalize(Vector3.subtract(Vector3.create(to.x,to.y+1,to.z),Vector3.create(from.x,from.y+1.25,from.z)))};r.maxDistance=dist;r.timestamp=Date.now()
  return clear
}
function kingHomeIsland(bot:{homeX:number,homeZ:number}){return MUTANT_ISLAND_GROUND.reduce((best,z)=>Math.hypot(bot.homeX-z.x,bot.homeZ-z.z)<Math.hypot(bot.homeX-best.x,bot.homeZ-best.z)?z:best,MUTANT_ISLAND_GROUND[0])}
type IslandGround = { readonly name:string; readonly x:number; readonly z:number; readonly rx:number; readonly rz:number }
function pointOnIsland(zone:IslandGround,p:{x:number,z:number},margin:number){const dx=(p.x-zone.x)/zone.rx,dz=(p.z-zone.z)/zone.rz;return dx*dx+dz*dz<=margin}
function kingGroundAllowed(bot:{homeX:number,homeZ:number},p:{x:number,z:number}){return pointOnIsland(kingHomeIsland(bot),p,.68)}
function sameKingIsland(bot:{homeX:number,homeZ:number},p:{x:number,z:number}){return pointOnIsland(kingHomeIsland(bot),p,.96)}
// Idle patrol is terrain/bridge only. During an acquired chase, normal Mutants may enter water; Kings never may.
function mutantGroundAllowed(p:{x:number,z:number}){return isOnMutantIslandGround(p)||isOnMutantBridge(p)}

// v126: follow the real PHYSICS surface under each enemy instead of assigning a fixed Y.
// The ray result is one frame old by design; it is used only when it is a plausible floor below the feet.
// v127: IslandTerrain.glb is the authoritative enemy walking surface.
// Do not use generic downward raycasts here: they can hit roofs/upper GLB geometry and lift enemies into the air.
// The shared terrain profile matches the authored IslandTerrain/bridge root heights and only drops to water
// after a normal Mutant has actually left valid island/bridge ground during an acquired chase.
function groundedMutantY(_owner:Entity,position:Vector3){return mutantSurfaceY(position)}

function mutantSafeStep(entity:Entity,position:Vector3,direction:Vector3,step:number){
  const flat=Vector3.normalize(Vector3.create(direction.x,0,direction.z));if(Vector3.length(flat)<.001)return Vector3.clone(position)
  const left=Vector3.normalize(Vector3.create(-flat.z,0,flat.x)),right=Vector3.scale(left,-1),max=Math.max(2.8,step+2.25),p=ensureMutantProbes(entity,position)
  // Results belong to the rays aimed on the previous frame. Movement is only allowed when
  // that probe reports clear; then immediately queue the next three world-physics queries.
  const fb=probeBlocked(p.f,max),lb=probeBlocked(p.l,max),rb=probeBlocked(p.r,max),flb=probeBlocked(p.fl,max),frb=probeBlocked(p.fr,max),now=Date.now()
  // Body-width probes catch GLB corners that a single center ray misses. This keeps the
  // Mutant/King capsule outside authored walls instead of allowing shoulders/body to clip through.
  const fLeft=Vector3.normalize(Vector3.add(Vector3.scale(flat,.88),Vector3.scale(left,.48)))
  const fRight=Vector3.normalize(Vector3.add(Vector3.scale(flat,.88),Vector3.scale(right,.48)))
  aimProbe(p.f,position,flat,max);aimProbe(p.l,position,left,max);aimProbe(p.r,position,right,max);aimProbe(p.fl,position,fLeft,max);aimProbe(p.fr,position,fRight,max)
  const bodyBlocked=fb||flb||frb
  let avoid=mutantWallAvoid.get(entity)
  if(bodyBlocked){
    if(!avoid||avoid.until<=now)avoid={side:lb&&!rb?-1:rb&&!lb?1:((entity%2)*2-1),until:now+1800}
    else avoid.until=now+700
    mutantWallAvoid.set(entity,avoid)
  }
  if(avoid&&avoid.until>now){
    const sideDir=avoid.side>0?left:right, sideBlocked=avoid.side>0?lb:rb
    if(sideBlocked){
      const otherBlocked=avoid.side>0?rb:lb
      if(!otherBlocked){avoid.side=-avoid.side;mutantWallAvoid.set(entity,avoid);return Vector3.add(position,Vector3.scale(avoid.side>0?left:right,Math.min(step,.075)))}
      return Vector3.clone(position)
    }
    // Follow the wall until the forward probe has been clear for long enough.
    if(!bodyBlocked)avoid.until=Math.min(avoid.until,now+260)
    return Vector3.add(position,Vector3.scale(sideDir,Math.min(step,.075)))
  }
  mutantWallAvoid.delete(entity)
  if(bodyBlocked)return Vector3.clone(position)
  // Limit each accepted ground step so fast Kings cannot tunnel through thin GLB colliders between probes.
  return Vector3.add(position,Vector3.scale(flat,Math.min(step,.16)))
}

function updateBots(dt: number, player: ReturnType<typeof PlayerState.getMutable>, playerPosition: Vector3) {
  const now = Date.now()
  const playerSafe = isInsideOutpost(playerPosition)
  updateLocalProjectiles(dt,player,playerPosition)
  for (const entity of botEntities) {
    const bot = BotState.getMutableOrNull(entity)
    const transform = Transform.getMutableOrNull(entity)
    if (!bot?.active || !transform) continue
    if (isInsideOutpost(transform.position)) {
      const away=Vector3.normalize(Vector3.create(transform.position.x-OUTPOST_ZONE.centerX,0,transform.position.z-OUTPOST_ZONE.centerZ))
      const direction=Vector3.length(away)<.01?Vector3.create(1,0,0):away
      transform.position=Vector3.create(OUTPOST_ZONE.centerX+direction.x*(OUTPOST_ZONE.halfWidth+2),bot.airborne?7:mutantSurfaceY({x:transform.position.x,z:transform.position.z}),OUTPOST_ZONE.centerZ+direction.z*(OUTPOST_ZONE.halfDepth+2))
      bot.targetId='';bot.aiState='return'
    }
    const distance = Vector3.distance(transform.position, playerPosition), range=bot.family==='mutant'&&bot.variant!=='king-mutant'?2.15:ENEMIES[bot.variant as EnemyVariant].range
    if(bot.variant==='king-mutant'){const maxHp=ENEMIES['king-mutant'].hp;if(bot.hp>0&&bot.hp<maxHp)bot.hp=Math.min(maxHp,bot.hp+dt*.45)}
    const acquired=bot.family==='mutant'&&botHasSeenPlayer.get(bot.botId)===true
    const kingPlayerOnHome=bot.variant!=='king-mutant'||sameKingIsland(bot,playerPosition)
    const detected=!playerSafe&&kingPlayerOnHome&&(acquired||distance<=bot.detection*(bot.family==='mutant'?1.35:1)||((bot.aiState==='alert'||bot.aiState==='chase'||bot.aiState==='attack')&&distance<=bot.detection*(bot.family==='mutant'?2.25:1.8)))
    if(!detected){if(bot.variant==='king-mutant'&&!kingPlayerOnHome){botHasSeenPlayer.set(bot.botId,false);bot.targetId=''}bot.aiState='patrol';if(bot.variant==='king-mutant')playLocalKingAnimation(bot.botId,'Walk');const phase=now/(bot.variant==='king-mutant'?1500:1450)+entity,patrolRadius=bot.variant==='king-mutant'?28:10,homeIsland=bot.variant==='king-mutant'?kingHomeIsland(bot):undefined,rawPatrol=bot.variant==='king-mutant'&&homeIsland?Vector3.create(homeIsland.x+Math.sin(phase+(Math.floor(now/6000)+entity)*1.37)*homeIsland.rx*(.28+((entity+Math.floor(now/6000))%4)*.055),transform.position.y,homeIsland.z+Math.cos(phase*.71+(Math.floor(now/6000)+entity)*.91)*homeIsland.rz*(.28+((entity+2+Math.floor(now/6000))%4)*.055)):Vector3.create(bot.homeX+Math.sin(phase)*patrolRadius,bot.airborne?7+Math.sin(phase)*2:transform.position.y,bot.homeZ+Math.cos(phase)*patrolRadius),patrolNav={x:rawPatrol.x,z:rawPatrol.z},target=Vector3.create(patrolNav.x,rawPatrol.y,patrolNav.z);const direction=Vector3.normalize(Vector3.subtract(target,transform.position));const patrolStep=bot.speed*(bot.family==='mutant'?.58:.3)*dt;let next=bot.family==='mutant'?mutantSafeStep(entity,transform.position,direction,patrolStep):Vector3.add(transform.position,Vector3.scale(direction,patrolStep));if(!isInsideOutpost(next)&&(bot.airborne||bot.family==='mutant')){const groundAllowed=bot.variant==='king-mutant'?kingGroundAllowed(bot,next):true;if(groundAllowed){transform.position=next;if(!bot.airborne){transform.position.y=groundedMutantY(entity,transform.position)}}}continue}
    bot.targetId='local-player';bot.lastKnownX=playerPosition.x;bot.lastKnownZ=playerPosition.z;bot.lastSeenAt=now
    // Mutant/King alert plays only on the moment this hostile newly sees/acquires the player.
    // audio.ts owns a single shared source, so simultaneous detections can never overlap.
    if(bot.family==='mutant' && !botHasSeenPlayer.get(bot.botId)){botHasSeenPlayer.set(bot.botId,true);playMutantAlertSound();if(bot.variant==='king-mutant')playLocalKingAnimation(bot.botId,'Roar',true)}
    if (distance > range) {
      bot.aiState='chase'
      if(bot.variant==='king-mutant')playLocalKingAnimation(bot.botId,'Walk')
      let target=Vector3.clone(playerPosition)
      if(bot.family==='drone'){const angle=entity*2.399963229728653+now/5000,radius=16+(entity%9)*3.2;target=Vector3.create(playerPosition.x+Math.cos(angle)*radius,7+(entity%5)*.8+Math.sin(now/1100+entity)*1.2,playerPosition.z+Math.sin(angle)*radius)}
      
      if(bot.family==='mutant'){if(bot.variant==='king-mutant'){const n=entity,angle=now/780+n*1.73,radius=Math.min(7,Math.max(3.4,distance*.22));target=Vector3.create(target.x+Math.cos(angle)*radius,target.y,target.z+Math.sin(angle)*radius);target=Vector3.create(target.x,transform.position.y,target.z)}else{const flankAngle=now/2100+entity*2.17,flankRadius=1.4+(entity%4)*.55;target=Vector3.create(playerPosition.x+Math.cos(flankAngle)*flankRadius,transform.position.y,playerPosition.z+Math.sin(flankAngle)*flankRadius)}}
      const direction = Vector3.normalize(Vector3.subtract(target, transform.position))
      const boost=bot.family==='mutant'?(bot.variant==='berserker-mutant'?1.6:bot.variant==='king-mutant'?1.45:1.08):1
      const step=bot.speed*boost*dt
      const next = Vector3.add(transform.position, Vector3.scale(direction, step))
      const moveNext=bot.family==='mutant'?mutantSafeStep(entity,transform.position,direction,step):next
      if(!isInsideOutpost(moveNext)){const groundAllowed=bot.variant==='king-mutant'?kingGroundAllowed(bot,moveNext):true;if((bot.airborne||bot.family==='mutant')&&groundAllowed){transform.position.x=Math.max(2,Math.min(GAME.arenaSize-2,moveNext.x));transform.position.z=Math.max(2,Math.min(GAME.arenaSize-2,moveNext.z));if(!bot.airborne){transform.position.y=groundedMutantY(entity,transform.position)}}}
      if(bot.airborne)transform.position.y=Math.max(5,Math.min(12,next.y))
      transform.rotation = Quaternion.lookRotation(direction)
    } else {
      // v79: Kings keep advancing on a detected player while they fire.
      if(bot.family==='mutant'&&distance>.55){
        const flankAngle=now/1900+entity*2.17,flankRadius=bot.variant==='king-mutant'?0:1.25+(entity%3)*.5;const desired=Vector3.create(playerPosition.x+Math.cos(flankAngle)*flankRadius,playerPosition.y,playerPosition.z+Math.sin(flankAngle)*flankRadius);const nav={x:desired.x,z:desired.z}; let target=Vector3.create(nav.x,transform.position.y,nav.z)
        if(bot.variant==='king-mutant'){const n=entity,angle=now/780+n*1.73,radius=Math.min(7,Math.max(3.4,distance*.22));target=Vector3.create(target.x+Math.cos(angle)*radius,target.y,target.z+Math.sin(angle)*radius)}
        const direction=Vector3.normalize(Vector3.subtract(target,transform.position)),step=bot.speed*(bot.variant==='king-mutant'?1.45:1.08)*dt
        let moveNext=mutantSafeStep(entity,transform.position,direction,step)
        if(!isInsideOutpost(moveNext)){const groundAllowed=bot.variant==='king-mutant'?kingGroundAllowed(bot,moveNext):true;if(groundAllowed){transform.position.x=moveNext.x;transform.position.z=moveNext.z;transform.position.y=groundedMutantY(entity,transform.position)}}
      }
      const hasLos=enemyHasLineOfSight(entity,transform.position,playerPosition)
      if(!hasLos){bot.aiState='chase';continue}
      if (now - (botLastShotAt.get(bot.botId) ?? 0) > (bot.family==='drone'?1650:bot.variant==='king-mutant'?1535:1350)) {
        bot.aiState='attack'
        if(bot.variant==='king-mutant'){const flip=!(kingAttackFlip.get(bot.botId)??false);kingAttackFlip.set(bot.botId,flip);playLocalKingAnimation(bot.botId,flip?'Attack 1':'Attack 2',true)}
        botLastShotAt.set(bot.botId, now)
        if(bot.family==='mutant'&&bot.variant!=='king-mutant'){
          // Normal mutants are melee-only: chase all the way to the player, then strike at close range.
          playLocalMutantEmote(entity,MUTANT_AVATARS[bot.variant as keyof typeof MUTANT_AVATARS].attackEmote)
          if(distance<=2.25) damageLocalPlayer(player,Math.max(1,Math.round(bot.damage*.45)))
        } else if(bot.family==='drone'||bot.variant==='king-mutant'){
          transform.rotation=Quaternion.lookRotation(Vector3.normalize(Vector3.subtract(playerPosition,transform.position)))
          // King Mutant bullets hurt the player at the same level as an Attack Drone projectile.
          const projectileDamage=bot.variant==='king-mutant'?ENEMIES['attack-drone'].damage:bot.damage
          fireLocalEnemyProjectile(Vector3.create(transform.position.x,transform.position.y+.2,transform.position.z),playerPosition,projectileDamage,bot.variant==='king-mutant')
        }
      }
    }
  }
}

function localSoloSystem(dt: number) {
  if (!matchEntity || !playerEntity) return
  const match = MatchState.getMutable(matchEntity)
  const player = PlayerState.getMutable(playerEntity)
  if (match.phase !== 'active') return
  // Story pickups pause solo simulation completely until the player closes the popup.
  if (clientState.memoryStoryOpen || clientState.dataStoryOpen) return
  const now = Date.now()
  match.heartbeat = now
  const elapsed = Math.max(0, (now - match.startsAt) / 1000)
  const progress = Math.min(1, elapsed / GAME.matchSeconds)
  match.zoneRadius = GAME.initialZoneRadius + (GAME.finalZoneRadius - GAME.initialZoneRadius) * progress
  let activeBots = 0
  for (const entity of botEntities) if (BotState.getOrNull(entity)?.active) activeBots += 1
  match.alivePlayers = activeBots + (player.alive ? 1 : 0)
  // v225: campaign/solo gameplay must not silently expire after GAME.matchSeconds (15 minutes).
  // The old timer switched the match to results while Decentraland locomotion kept working,
  // which looked like a gameplay freeze because firing/reload/build all require phase='active'.
  // Solo now ends only on elimination or normal mission/campaign completion.
  if (!player.alive) {
    match.phase = 'results'; match.winner = 'Training Drones'; match.announcement = 'You were eliminated'; return
  }
  if(activeBots===0){
    const mission=Math.max(1,match.threatLevel)
    if(!localMissionAdvanceAt){match.announcement=`MISSION ${mission} COMPLETE`;const gm=GENERATED_MISSIONS[clientState.missionAcceptedIndex];if(gm){player.materials+=gm.materials;player.bombs+=gm.bombs;player.shieldCells+=gm.shieldCells;player.lifeCredits+=gm.lifeCredits;clientState.completedGeneratedMissions.add(gm.id)}player.missionsCompleted+=1;player.soloMissions+=1;player.cleanSweeps+=1;player.missionTypesMask|=(1<<((mission-1)%10));if(mission===1)player.outpostDefenses+=1;if(mission===7)player.suppliesDelivered+=10;if(player.missionDamageTaken===0)player.noHitMissions+=1;if(now-Number(player.missionStartedAt||now)<=300000)player.speedRuns+=1;const h=new Date(now).getUTCHours();if(h>=18||h<6)player.nightMissions+=1;player.missionDamageTaken=0;player.missionStartedAt=now;localMissionAdvanceAt=now+3500;return}
    if(now<localMissionAdvanceAt)return
    localMissionAdvanceAt=0
    if(mission>=GAME.totalMissions){match.phase='results';match.winner=player.displayName;match.announcement='ALL 10 MISSIONS COMPLETE';return}
    const next=mission+1,plan=deployMissionHostiles(next)
    match.threatLevel=next;match.announcement=`${plan.gm.name} — WAVE ${next} • MUTANTS ${plan.mutants} • DRONES ${plan.drones} • KINGS ${plan.kings}`
  }
  const playerTransform = Transform.getOrNull(engine.PlayerEntity)
  if (!playerTransform) return
  updateLocalBombs(dt, player)
  updateBots(dt, player, playerTransform.position)
  if (!player.missionComplete && player.missionId in MISSIONS) {
    const mission = MISSIONS[player.missionId as keyof typeof MISSIONS]
    const target = LOCATIONS[mission.target]
    if (Vector3.distance(playerTransform.position, Vector3.create(target.x, playerTransform.position.y, target.z)) < 9) {
      player.missionComplete = true
      player.missionsCompleted += 1
      player.materials += mission.rewardMaterials
    }
  }
  survivalTick += dt
  if (survivalTick >= 10) {
    survivalTick = 0
    player.stamina = Math.min(100, player.stamina + 8)
    // v64: hunger/thirst are retired. Health only changes from hostile attacks/contact.
  }
  worldTick += dt
  if (worldTick < 0.5) return
  const travelled = previousSurvivalPosition.x === 0 ? 0 : Vector3.distance(previousSurvivalPosition, playerTransform.position)
  player.stamina = travelled > 2 ? Math.max(0, player.stamina - 4) : Math.min(100, player.stamina + 3)
  previousSurvivalPosition = Vector3.clone(playerTransform.position)
  worldTick = 0
  collectLoot(player, playerTransform.position)
  const center = Vector3.create(GAME.centerX, playerTransform.position.y, GAME.centerZ)
  // v63: zone/storm is visual/gameplay pressure only; it does not reduce player health.
}
