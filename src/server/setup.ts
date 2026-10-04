import {
  BotState,
  BuildState,
  BombState,
  LootState,
  MatchState,
  PlayerState,
  protectAuthoritativeState
} from '../shared/schemas'
import {
  GAME,
  BOMB,
  DIFFICULTY,
  ENEMIES,
  ENEMY_SPAWN_ZONES,
  COMBAT_LAND_ZONES,
  isInsideCombatLand,
  mutantNavigationTarget,
  isOnMutantBridge,
  MUTANT_ISLAND_GROUND,
  mutantSurfaceY,
  MUTANT_AVATARS,
  PANDORA_BOX_SPAWNS,
  WORLD_LOOT_SPAWNS,
  LOCATIONS,
  MISSION_ORDER,
  MISSIONS,
  WEAPONS,
  OUTPOST_ZONE,
  isInsideOutpost,
  isBuildKind,
  isGameMode,
  isDifficulty,
  isInventoryItem,
  isMissionId,
  isWeaponId,
  type GameMode,
  type Difficulty,
  type EnemyVariant,
  type WeaponId
} from '../shared/config'
import { room } from '../shared/messages'
import {
  ColliderLayer,
  AudioSource,
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
  PlayerIdentityData,
  Transform,
  engine,
  executeTask
} from '@dcl/sdk/ecs'
import { Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import { syncEntity } from '@dcl/sdk/network'
import { Storage } from '@dcl/sdk/server'
import { onLeaveScene } from '@dcl/sdk/src/players'

type PersistedLoadout = {
  equippedWeapon: WeaponId
  ammoRifle: number
  ammoShotgun: number
  ammoPistol: number
  magazineRifle?: number
  magazineShotgun?: number
  magazinePistol?: number
  medkits: number
  shieldCells: number
  water: number
  bombs: number
  lifeCredits: number
  lifetimeKills: number
  missionsCompleted: number
  mutantKills?: number
  droneKills?: number
  lootCollected?: number
  explosivesUsed?: number
  healingDone?: number
  medkitsUsed?: number
  watersUsed?: number
  tradesCompleted?: number
  soloMissions?: number
  coopMissions?: number
  suppliesDelivered?: number
  outpostDefenses?: number
  cleanSweeps?: number
  locationsDiscovered?: number
  missionTypesMask?: number
  noHitMissions?: number
  headshots?: number
  legendaryLoot?: number
  weaponsCollected?: number
  ammoRoundsCollected?: number
  gearTypesMask?: number
  speedRuns?: number
  nightMissions?: number
  missionDamageTaken?: number
  missionStartedAt?: number
  completedGeneratedMissions?: number[]
  collectedMemoryIds?: number[]
  collectedDataRamIds?: number[]
  missionAcceptedIndex?: number
  missionMemoryFound?: number
  missionDataRamFound?: number
}

type ClientProgress = {
  completedGeneratedMissions:number[]
  collectedMemoryIds:number[]
  collectedDataRamIds:number[]
  missionAcceptedIndex:number
  missionMemoryFound:number
  missionDataRamFound:number
}

const clientProgress = new Map<string, ClientProgress>()
function sanitizeIds(value:any,max:number){return Array.isArray(value)?Array.from(new Set(value.map(Number).filter((n:number)=>Number.isInteger(n)&&n>=1&&n<=max))).slice(0,max):[]}
function sanitizeProgress(value:any):ClientProgress{return {
  completedGeneratedMissions:sanitizeIds(value?.completedGeneratedMissions,100),
  collectedMemoryIds:sanitizeIds(value?.collectedMemoryIds,100),
  collectedDataRamIds:sanitizeIds(value?.collectedDataRamIds,100),
  missionAcceptedIndex:Math.max(-1,Math.min(99,Number.isInteger(Number(value?.missionAcceptedIndex))?Number(value.missionAcceptedIndex):-1)),
  missionMemoryFound:Math.max(0,Math.min(100,Math.floor(Number(value?.missionMemoryFound)||0))),
  missionDataRamFound:Math.max(0,Math.min(100,Math.floor(Number(value?.missionDataRamFound)||0)))
}}
function progressFromPersisted(p:PersistedLoadout):ClientProgress{return sanitizeProgress(p)}
function sendProgress(address:string,p:ClientProgress){void room.send('progressLoaded',{payload:JSON.stringify(p)},{to:[address]})}

const players = new Map<string, Entity>()
const bots = new Map<string, Entity>()
const enemyParts = new Map<string, Entity[]>()
const enemyEyes = new Map<string, Entity>()
const projectiles = new Map<Entity, { targetId: string; velocity: Vector3; damage: number; expiresAt: number; toxic:boolean }>()
const impactFx = new Map<Entity,{expiresAt:number;toxic:boolean;damage:number;lastTick:number}>()
const playerNoise = new Map<string, { x: number; z: number; radius: number; until: number }>()
const backupCalls = new Map<string, number>()
const kingAnimationState = new Map<string,string>()
const kingAttackFlip = new Map<string,boolean>()

function playKingAnimation(entity:Entity, botId:string, clip:string, force=false){
  if(!force&&kingAnimationState.get(botId)===clip)return
  kingAnimationState.set(botId,clip); Animator.playSingleAnimation(entity,clip)
}

const enemyEmoteCounters = new Map<string, number>()
const builds = new Map<string, Entity>()
const loot = new Map<string, Entity>()
const thrownBombs = new Map<string, Entity>()
const lastShotAt = new Map<string, number>()
const botLastShotAt = new Map<string, number>()
const buildCounts = new Map<string, number>()
const buildStacks = new Map<string, number>()
const lastSurvivalPositions = new Map<string, Vector3>()

let matchEntity: Entity
let botTick = 0
let worldTick = 0
let heartbeatTick = 0
let survivalTick = 0
let nextBuildId = 1
let nextEnemyId = 1
let nextBombId = 1
let reinforcementsSpawned = 0
let missionAdvanceAt = 0

const defaultLoadout: PersistedLoadout = {
  equippedWeapon: 'pulse-rifle',
  ammoRifle: 0,
  ammoShotgun: 0,
  ammoPistol: 0,
  magazineRifle: 0,
  magazineShotgun: 0,
  magazinePistol: 0,
  medkits: 1,
  shieldCells: 1,
  water: 2,
  bombs: BOMB.startingCount,
  lifeCredits: 0,
  lifetimeKills: 0,
  missionsCompleted: 0, mutantKills:0, droneKills:0, lootCollected:0, explosivesUsed:0, healingDone:0, medkitsUsed:0, watersUsed:0, tradesCompleted:0, soloMissions:0, coopMissions:0, suppliesDelivered:0, outpostDefenses:0, cleanSweeps:0, locationsDiscovered:0, missionTypesMask:0, noHitMissions:0, headshots:0, legendaryLoot:0, weaponsCollected:0, ammoRoundsCollected:0, gearTypesMask:0, speedRuns:0, nightMissions:0, missionDamageTaken:0, missionStartedAt:Date.now()
}

function normalizeAddress(value: string) {
  return value.toLowerCase()
}

function createMatchState() {
  matchEntity = engine.addEntity()
  MatchState.create(matchEntity, {
    phase: 'lobby',
    mode: 'solo-bots',
    round: 1,
    startsAt: 0,
    endsAt: 0,
    alivePlayers: 0,
    zoneRadius: GAME.initialZoneRadius,
    heartbeat: Date.now(),
    winner: '',
    announcement: 'Choose a mode to enter the arena',
    difficulty: 'normal',
    threatLevel: 0
  })
  syncEntity(matchEntity, [MatchState.componentId], 100)
}

function getAvatar(address: string): Entity | undefined {
  for (const [entity, identity] of engine.getEntitiesWith(PlayerIdentityData)) {
    if (normalizeAddress(identity.address) === address) return entity
  }
  return undefined
}

function getPlayerPosition(address: string) {
  const avatar = getAvatar(address)
  return avatar ? Transform.getOrNull(avatar)?.position : undefined
}

function safeDirection(x: number, y: number, z: number) {
  const length = Math.sqrt(x * x + y * y + z * z)
  if (!Number.isFinite(length) || length < 0.5 || length > 1.5) return undefined
  return Vector3.create(x / length, y / length, z / length)
}

function pointToRayDistance(origin: Vector3, direction: Vector3, point: Vector3) {
  const relative = Vector3.subtract(point, origin)
  const distanceAlongRay = Vector3.dot(relative, direction)
  if (distanceAlongRay < 0) return { distanceAlongRay, miss: Number.POSITIVE_INFINITY }
  const closestPoint = Vector3.add(origin, Vector3.scale(direction, distanceAlongRay))
  return { distanceAlongRay, miss: Vector3.distance(point, closestPoint) }
}

async function loadPlayer(address: string, displayName: string) {
  const persisted = (await Storage.player.get<PersistedLoadout>(address, 'project-exodus-loadout')) ?? defaultLoadout
  clientProgress.set(address, progressFromPersisted(persisted))
  const existing = players.get(address)
  if (existing && PlayerState.getOrNull(existing)) {
    const state = PlayerState.getMutable(existing)
    state.displayName = displayName || state.displayName
    state.joined = true
    state.alive = true
    state.hp = 100
    state.shield = 50
    state.stamina = 100
    state.hunger = 100
    state.thirst = 100
    state.missionComplete = false
    return existing
  }

  const entity = engine.addEntity()
  PlayerState.create(entity, {
    playerId: address,
    displayName: displayName || `Runner ${address.slice(2, 6)}`,
    hp: 100,
    shield: 50,
    kills: persisted.lifetimeKills ?? 0,
    deaths: 0,
    materials: GAME.startingMaterials,
    equippedWeapon: isWeaponId(persisted.equippedWeapon) ? persisted.equippedWeapon : 'pulse-rifle',
    ammoRifle: Math.max(0, persisted.ammoRifle ?? defaultLoadout.ammoRifle),
    ammoShotgun: Math.max(0, persisted.ammoShotgun ?? defaultLoadout.ammoShotgun),
    ammoPistol: Math.max(0, persisted.ammoPistol ?? defaultLoadout.ammoPistol),
    magazineRifle: Math.max(0,Math.min(WEAPONS['pulse-rifle'].magazine,persisted.magazineRifle??WEAPONS['pulse-rifle'].magazine)),
    magazineShotgun: Math.max(0,Math.min(WEAPONS.scattergun.magazine,persisted.magazineShotgun??WEAPONS.scattergun.magazine)),
    magazinePistol: Math.max(0,Math.min(WEAPONS['rail-pistol'].magazine,persisted.magazinePistol??WEAPONS['rail-pistol'].magazine)),
    medkits: Math.max(0, persisted.medkits ?? defaultLoadout.medkits),
    shieldCells: Math.max(0, persisted.shieldCells ?? defaultLoadout.shieldCells),
    water: Math.max(0, persisted.water ?? defaultLoadout.water),
    bombs: Math.max(0, persisted.bombs ?? defaultLoadout.bombs),
    lifeCredits: Math.max(0, persisted.lifeCredits ?? defaultLoadout.lifeCredits),
    stamina: 100,
    hunger: 100,
    thirst: 100,
    missionId: 'reach-city',
    missionComplete: false,
    missionsCompleted: Math.max(0, persisted.missionsCompleted ?? 0),
    mutantKills: Math.max(0,persisted.mutantKills??0), droneKills: Math.max(0,persisted.droneKills??0), lootCollected: Math.max(0,persisted.lootCollected??0), explosivesUsed: Math.max(0,persisted.explosivesUsed??0), healingDone: Math.max(0,persisted.healingDone??0), medkitsUsed: Math.max(0,persisted.medkitsUsed??0), watersUsed: Math.max(0,persisted.watersUsed??0), tradesCompleted: Math.max(0,persisted.tradesCompleted??0), soloMissions: Math.max(0,persisted.soloMissions??0), coopMissions: Math.max(0,persisted.coopMissions??0),
    suppliesDelivered:Math.max(0,persisted.suppliesDelivered??0), outpostDefenses:Math.max(0,persisted.outpostDefenses??0), cleanSweeps:Math.max(0,persisted.cleanSweeps??0), locationsDiscovered:Math.max(0,persisted.locationsDiscovered??0), missionTypesMask:Math.max(0,persisted.missionTypesMask??0), noHitMissions:Math.max(0,persisted.noHitMissions??0), headshots:Math.max(0,persisted.headshots??0), legendaryLoot:Math.max(0,persisted.legendaryLoot??0), weaponsCollected:Math.max(0,persisted.weaponsCollected??0), ammoRoundsCollected:Math.max(0,persisted.ammoRoundsCollected??0), gearTypesMask:Math.max(0,persisted.gearTypesMask??0), speedRuns:Math.max(0,persisted.speedRuns??0), nightMissions:Math.max(0,persisted.nightMissions??0), missionDamageTaken:0, missionStartedAt:Date.now(),
    joined: true,
    alive: true
  })
  syncEntity(entity, [PlayerState.componentId])
  players.set(address, entity)
  return entity
}

async function savePlayer(address: string) {
  const entity = players.get(address)
  const state = entity ? PlayerState.getOrNull(entity) : undefined
  if (!state) return
  const saved = await Storage.player.set<PersistedLoadout>(
    address,
    'project-exodus-loadout',
    {
      equippedWeapon: isWeaponId(state.equippedWeapon) ? state.equippedWeapon : 'pulse-rifle',
      ammoRifle: state.ammoRifle,
      ammoShotgun: state.ammoShotgun,
      ammoPistol: state.ammoPistol,
      magazineRifle: state.magazineRifle,
      magazineShotgun: state.magazineShotgun,
      magazinePistol: state.magazinePistol,
      medkits: state.medkits,
      shieldCells: state.shieldCells,
      water: state.water,
      bombs: state.bombs,
      lifeCredits: state.lifeCredits,
      lifetimeKills: state.kills,
      missionsCompleted: state.missionsCompleted, mutantKills:state.mutantKills, droneKills:state.droneKills, lootCollected:state.lootCollected, explosivesUsed:state.explosivesUsed, healingDone:state.healingDone, medkitsUsed:state.medkitsUsed, watersUsed:state.watersUsed, tradesCompleted:state.tradesCompleted, soloMissions:state.soloMissions, coopMissions:state.coopMissions, suppliesDelivered:state.suppliesDelivered, outpostDefenses:state.outpostDefenses, cleanSweeps:state.cleanSweeps, locationsDiscovered:state.locationsDiscovered, missionTypesMask:state.missionTypesMask, noHitMissions:state.noHitMissions, headshots:state.headshots, legendaryLoot:state.legendaryLoot, weaponsCollected:state.weaponsCollected, ammoRoundsCollected:state.ammoRoundsCollected, gearTypesMask:state.gearTypesMask, speedRuns:state.speedRuns, nightMissions:state.nightMissions,
      ...(clientProgress.get(address) ?? sanitizeProgress({}))
    },
    { skipIfUnchanged: true }
  )
  if (!saved) console.error(`[SERVER] Could not persist loadout for ${address}`)
}

function sendResult(address: string, action: string, ok: boolean, detail: string) {
  void room.send('actionResult', { action, ok, detail }, { to: [address] })
}

function announce(kind: string, text: string, to?: string) {
  void room.send('serverEvent', { kind, text }, to ? { to: [to] } : undefined)
}

function isNear(address: string, x: number, z: number, radius = 6) {
  const position = getPlayerPosition(address)
  return !!position && Vector3.distance(position, Vector3.create(x, position.y, z)) <= radius
}

function reloadPlayerWeapon(address: string, weaponId: string) {
  const entity = players.get(address)
  const player = entity ? PlayerState.getMutableOrNull(entity) : undefined
  if (!player || !isWeaponId(weaponId)) return sendResult(address, 'reload', false, 'Weapon is unavailable')
  const weapon = WEAPONS[weaponId]
  const missing = weapon.magazine - player[weapon.magazineField]
  const moved = Math.min(missing, player[weapon.ammoField])
  if (moved <= 0) return sendResult(address, 'reload', false, missing <= 0 ? 'Magazine already full' : 'No reserve ammunition')
  player[weapon.ammoField] -= moved
  player[weapon.magazineField] += moved
  sendResult(address, 'reload', true, `${weapon.name} reloaded`)
}

function joinedPlayerCount() {
  let count = 0
  for (const [, state] of engine.getEntitiesWith(PlayerState)) if (state.joined) count += 1
  return count
}

function aliveCombatantCount() {
  let count = 0
  for (const [, state] of engine.getEntitiesWith(PlayerState)) if (state.joined && state.alive) count += 1
  for (const [, state] of engine.getEntitiesWith(BotState)) if (state.active && state.hp > 0) count += 1
  return count
}

function alivePlayerCount() {
  let count = 0
  for (const [, state] of engine.getEntitiesWith(PlayerState)) if (state.joined && state.alive) count += 1
  return count
}

function activeEnemyCount() {
  let count = 0
  for (const [, state] of engine.getEntitiesWith(BotState)) if (state.active && state.hp > 0) count += 1
  return count
}

function resetPlayersForRound() {
  for (const [, state] of engine.getEntitiesWith(PlayerState)) {
    if (!state.joined) continue
    const mutable = PlayerState.getMutable(players.get(normalizeAddress(state.playerId))!)
    mutable.hp = 100
    mutable.shield = 50
    mutable.materials = GAME.startingMaterials
    mutable.stamina = 100
    mutable.hunger = 100
    mutable.thirst = 100
    mutable.alive = true
  }
}

function resetPlayerForRespawn(player: ReturnType<typeof PlayerState.getMutable>, joined: boolean) {
  player.hp = 100
  player.shield = 50
  player.stamina = 100
  player.hunger = 100
  player.thirst = 100
  player.alive = true
  player.joined = joined
}

function removeDynamicEntities() {
  for (const entity of bots.values()) engine.removeEntity(entity)
  for (const parts of enemyParts.values()) for (const entity of parts) engine.removeEntity(entity)
  for (const entity of projectiles.keys()) engine.removeEntity(entity)
  for (const entity of builds.values()) engine.removeEntity(entity)
  for (const entity of loot.values()) engine.removeEntity(entity)
  for (const entity of thrownBombs.values()) engine.removeEntity(entity)
  bots.clear()
  enemyParts.clear()
  enemyEyes.clear()
  projectiles.clear()
  backupCalls.clear()
  enemyEmoteCounters.clear()
  reinforcementsSpawned = 0
  builds.clear()
  loot.clear()
  thrownBombs.clear()
  buildCounts.clear()
  buildStacks.clear()
}

function enemyPart(botId: string, parent: Entity, position: Vector3, scale: Vector3, color: string, mesh: 'box' | 'cylinder' | 'sphere' = 'box', emissive = false, rotation = Quaternion.Identity()) {
  const entity = engine.addEntity()
  Transform.create(entity, { position, scale, rotation, parent })
  if (mesh === 'cylinder') MeshRenderer.setCylinder(entity, 0.5, 0.5)
  else if (mesh === 'sphere') MeshRenderer.setSphere(entity)
  else MeshRenderer.setBox(entity)
  Material.setPbrMaterial(entity, {
    albedoColor: Color4.fromHexString(color), emissiveColor: emissive ? Color4.fromHexString(color) : undefined,
    emissiveIntensity: emissive ? 2.4 : 0, metallic: color === '#62665aff' ? 0.05 : 0.68, roughness: 0.48
  })
  syncEntity(entity, [Transform.componentId, MeshRenderer.componentId, Material.componentId])
  const parts = enemyParts.get(botId) ?? []; parts.push(entity); enemyParts.set(botId, parts)
  return entity
}

function buildMutantModel(botId: string, root: Entity, variant: EnemyVariant) {
  const berserker = variant === 'berserker-mutant', stalker = variant === 'stalker-mutant', infected = variant === 'infected-mutant'
  const s = berserker ? 1.35 : stalker ? 0.82 : 1
  const skin = infected ? '#78813cff' : stalker ? '#383b35ff' : '#62665aff'
  enemyPart(botId, root, Vector3.create(0,1.25*s,0), Vector3.create(1.1*s,1.65*s,.7*s), skin, 'cylinder')
  enemyPart(botId, root, Vector3.create(0,2.45*s,-.08), Vector3.create(.72*s,.72*s,.68*s), skin, 'sphere')
  enemyPart(botId, root, Vector3.create(-.85*s,1.35*s,0), Vector3.create(.38*s,1.75*s,.4*s), skin, 'box', false, Quaternion.fromEulerDegrees(0,0,-18))
  enemyPart(botId, root, Vector3.create(.85*s,1.35*s,0), Vector3.create(.38*s,1.75*s,.4*s), skin, 'box', false, Quaternion.fromEulerDegrees(0,0,18))
  enemyPart(botId, root, Vector3.create(-.92*s,.35*s,0), Vector3.create(.42*s,.68*s,.48*s), '#202226ff')
  enemyPart(botId, root, Vector3.create(.92*s,.35*s,0), Vector3.create(.42*s,.68*s,.48*s), '#202226ff')
  enemyPart(botId, root, Vector3.create(-.2*s,2.55*s,-.5*s), Vector3.create(.15*s,.12*s,.08*s), '#ff1919ff', 'box', true)
  const eye = enemyPart(botId, root, Vector3.create(.2*s,2.55*s,-.5*s), Vector3.create(.15*s,.12*s,.08*s), '#ff1919ff', 'box', true)
  enemyEyes.set(botId, eye)
  enemyPart(botId, root, Vector3.create(0,2.25*s,-.54*s), Vector3.create(.55*s,.18*s,.08*s), '#d9c7a1ff')
  enemyPart(botId, root, Vector3.create(0,.65*s,0), Vector3.create(1*s,.9*s,.72*s), '#26272aff')
  if (infected) for (let i=0;i<3;i++) enemyPart(botId, root, Vector3.create((i-1)*.45,1.7+i*.2,.32), Vector3.create(.36,.36,.36), '#b4c929ff', 'sphere', true)
}

function buildDroneModel(botId: string, root: Entity, variant: EnemyVariant) {
  const support = variant === 'support-drone', scout = variant === 'scout-drone'
  enemyPart(botId, root, Vector3.Zero(), Vector3.create(support?1.7:1.4,.6,1.25), '#252a30ff')
  enemyPart(botId, root, Vector3.create(0,-.4,-.25), Vector3.create(.45,.45,.5), '#15191eff')
  const eye=enemyPart(botId, root, Vector3.create(0,.02,-.68), Vector3.create(.38,.27,.12), '#ff1616ff', 'box', true);enemyEyes.set(botId,eye)
  for(let i=0;i<4;i++){const a=Math.PI/4+i*Math.PI/2,x=Math.sin(a)*1.35,z=Math.cos(a)*1.35;enemyPart(botId,root,Vector3.create(x,0,z),Vector3.create(.18,.16,1.7),'#30363dff','box',false,Quaternion.fromEulerDegrees(0,-45-i*90,0));enemyPart(botId,root,Vector3.create(x*1.5,.08,z*1.5),Vector3.create(1.15,.1,1.15),scout?'#4b5055ff':'#20252aff','cylinder')}
  enemyPart(botId,root,Vector3.create(0,-.58,-.3),Vector3.create(.22,.55,.22),support?'#f0a62fff':'#343a40ff','cylinder')
  for(const x of[-.55,.55])enemyPart(botId,root,Vector3.create(x,-.52,.25),Vector3.create(.12,.55,.12),'#171a1eff','cylinder')
}

function buildMutantAvatar(botId: string, root: Entity, variant: EnemyVariant) {
  if (variant === 'king-mutant') {
    GltfContainer.create(root,{src:'assets/Models/KingMutantAnimated.glb',visibleMeshesCollisionMask:0,invisibleMeshesCollisionMask:0})
    Animator.create(root,{states:[{clip:'Idle',playing:true,loop:true},{clip:'Walk',playing:false,loop:true},{clip:'Jump',playing:false,loop:false},{clip:'Roar',playing:false,loop:false},{clip:'Attack 1',playing:false,loop:false},{clip:'Attack 2',playing:false,loop:false},{clip:'Get Hit',playing:false,loop:false},{clip:'Death',playing:false,loop:false}]})
    kingAnimationState.set(botId,'Idle'); return
  }
  if (!(variant in MUTANT_AVATARS)) return
  const appearance = MUTANT_AVATARS[variant as keyof typeof MUTANT_AVATARS]
  AvatarShape.create(root, {
    id: `project-exodus-${botId}`,
    name: '',
    bodyShape: 'urn:decentraland:off-chain:base-avatars:BaseMale',
    wearables: [...appearance.wearables],
    skinColor: appearance.skin,
    eyeColor: appearance.eye,
    hairColor: appearance.hair,
    expressionTriggerId: '',
    expressionTriggerTimestamp: 0,
    emotes: [],
    talking: false,
    showOnlyWearables: false
  })
}

function playMutantEmote(entity: Entity, botId: string, emote: string) {
  const avatar = AvatarShape.getMutableOrNull(entity)
  if (!avatar) return
  const next = (enemyEmoteCounters.get(botId) ?? 0) + 1
  enemyEmoteCounters.set(botId, next)
  avatar.expressionTriggerId = emote
  avatar.expressionTriggerTimestamp = next
}

function spawnBot(index: number, forcedVariant?: EnemyVariant, missionNumber = 1) {
  const match=MatchState.get(matchEntity), difficulty=isDifficulty(match.difficulty)?match.difficulty:'normal'
  const eligibleZones = forcedVariant ? ENEMY_SPAWN_ZONES.filter((candidate) => candidate.family === ENEMIES[forcedVariant].family) : [...ENEMY_SPAWN_ZONES]
  const zone=eligibleZones[index%eligibleZones.length]
  const mutantVariants:EnemyVariant[]=['standard-mutant','standard-mutant','berserker-mutant','stalker-mutant','infected-mutant']
  const droneVariants:EnemyVariant[]=['scout-drone','attack-drone','attack-drone','support-drone']
  const variant=forcedVariant??(zone.family==='mutant'?mutantVariants[index%mutantVariants.length]:droneVariants[index%droneVariants.length])
  const def=ENEMIES[variant], botId=`enemy-${match.round}-${nextEnemyId++}`
  // v57: 15x15 unique grid per island/building cluster. At Mission 10 this provides
  // 1,575 unique positions per family, so no two same-family enemies share a spawn point.
  const slot = Math.floor(index / Math.max(1, eligibleZones.length))
  const seedBase = index + slot * 131 + (def.family === 'drone' ? 7919 : 3571)
  let position: Vector3
  if (def.family === 'drone') {
    // v63: exactly 3 drones per non-Outpost island per mission level. The remaining
    // 2 drones per mission roam the bridge/river airspace. Every slot gets a distinct
    // orbit offset/altitude so drones do not fly shoulder-to-shoulder.
    const islandZones = COMBAT_LAND_ZONES.slice(1, 7) // Arena, Ruins, Plant, Docks, Camp, Beach
    const perIsland = Math.max(3, missionNumber * 3)
    const islandSlots = islandZones.length * perIsland
    const ordinal = index
    if (ordinal < islandSlots) {
      const islandIndex = Math.floor(ordinal / perIsland) % islandZones.length
      const local = ordinal % perIsland, land = islandZones[islandIndex]
      const ring = Math.floor(local / 6), angle = (local % 6) * (Math.PI * 2 / 6) + ring * .41 + islandIndex * .27
      const radius = 7 + ring * 4.2 + (local % 3) * 1.1
      position=Vector3.create(land.x+Math.cos(angle)*radius,6.5+((local+islandIndex)%6)*.8,land.z+Math.sin(angle)*radius)
    } else {
      const roam=ordinal-islandSlots, t=(roam+1)/(Math.max(1, missionNumber*2)+1)
      const routes=[[124,292,226,222],[254,218,373,282],[252,226,267,370],[254,204,371,112],[284,384,346,384],[240,94,240,202]]
      const r=routes[roam%routes.length], lane=Math.floor(roam/routes.length), side=((lane%2)*2-1)*(5+Math.floor(lane/2)*3)
      const dx=r[2]-r[0],dz=r[3]-r[1],len=Math.max(1,Math.hypot(dx,dz))
      position=Vector3.create(r[0]+dx*t+(-dz/len)*side,7.5+(roam%5)*.9,r[1]+dz*t+(dx/len)*side)
    }
  } else {
    // Mutants stay on island/building ground and are scattered throughout each zone.
    const seedX=((seedBase*73+19)%1009)/1008, seedZ=((seedBase*151+47)%1013)/1012
    const land=COMBAT_LAND_ZONES[zone.zoneIndex]
    position=Vector3.create(zone.x+(seedX*2-1)*Math.max(3,land.halfWidth-1.8),1.55,zone.z+(seedZ*2-1)*Math.max(3,land.halfDepth-1.8))
  }
  const entity=engine.addEntity();Transform.create(entity,{position,scale:variant==='king-mutant'?Vector3.create(10.0,10.0,10.0):Vector3.One()});MeshCollider.setBox(entity,ColliderLayer.CL_POINTER)
  BotState.create(entity,{botId,displayName:def.name,hp:def.hp,active:true,targetId:'',family:def.family,variant,aiState:'patrol',maxHp:def.hp,damage:Math.round(def.damage*DIFFICULTY[difficulty].damage),speed:def.speed*DIFFICULTY[difficulty].speed,detection:def.detection*DIFFICULTY[difficulty].detection,homeX:position.x,homeZ:position.z,lastKnownX:position.x,lastKnownZ:position.z,lastSeenAt:0,stateUntil:0,attackReadyAt:0,reinforcementLevel:0,airborne:def.family==='drone'})
  if(def.family==='mutant'){
    buildMutantAvatar(botId,entity,variant)
    Raycast.create(entity,{originOffset:Vector3.create(0,.7,0),direction:{ $case:'globalDirection',globalDirection:Vector3.Forward()},maxDistance:1.4,queryType:RaycastQueryType.RQT_HIT_FIRST,timestamp:Date.now()})
    syncEntity(entity,variant==='king-mutant'?[Transform.componentId,MeshCollider.componentId,BotState.componentId,GltfContainer.componentId]:[Transform.componentId,MeshCollider.componentId,BotState.componentId,AvatarShape.componentId])
  }else{
    // Publish fix: synchronize the drone root before synchronizing its child meshes.
    // In the live realm the visual parts reference this entity as their Transform parent;
    // publishing the children first can leave the parent unresolved and make the drone
    // invisible even though its authoritative AI/projectiles continue to run.
    syncEntity(entity,[Transform.componentId,MeshCollider.componentId,BotState.componentId])
    // Drone geometry is built client-side from synchronized BotState in published matches.
    // This avoids relying on networked child Transform/MeshRenderer/Material entities.
  }
  bots.set(botId, entity)
}

function spawnLoot(index: number) {
  const lootId = `loot-${MatchState.get(matchEntity).round}-${index}`
  const spawn = WORLD_LOOT_SPAWNS[index % WORLD_LOOT_SPAWNS.length]
  const kinds = ['ammo-rifle','ammo-shotgun','ammo-pistol','bomb','materials','medkit','ammo-rifle','shield-cell','ammo-pistol','water'] as const
  const kind = kinds[index % kinds.length]
  // The Outpost is a safe staging area: no loose bullets or bombs spawn inside it.
  const insideOutpost = Math.abs(spawn.x - OUTPOST_ZONE.centerX) <= OUTPOST_ZONE.halfWidth && Math.abs(spawn.z - OUTPOST_ZONE.centerZ) <= OUTPOST_ZONE.halfDepth
  if (insideOutpost) return
  const amount = kind === 'ammo-rifle' ? 30 : kind === 'ammo-shotgun' ? 8 : kind === 'ammo-pistol' ? 18 : kind === 'materials' ? 5 : 1
  const entity = engine.addEntity()
  Transform.create(entity, { position: Vector3.create(spawn.x, spawn.y ?? 1.05, spawn.z), scale: Vector3.create(0.85, 0.85, 0.85) })
  LootState.create(entity, { lootId, kind, amount, active: true })
  syncEntity(entity, [Transform.componentId, LootState.componentId])
  loot.set(lootId, entity)
}

function spawnPandoraBox(index: number) {
  const round = MatchState.get(matchEntity).round
  const spawn = PANDORA_BOX_SPAWNS[(round + index * 2) % PANDORA_BOX_SPAWNS.length]
  const lootId = `pandora-${round}-${index}`
  const entity = engine.addEntity()
  Transform.create(entity, {
    position: Vector3.create(spawn.x, 1.92, spawn.z),
    scale: Vector3.create(1.15, 0.9, 0.95),
    rotation: Quaternion.fromEulerDegrees(0, 45, 0)
  })
  MeshRenderer.setBox(entity)
  MeshCollider.setBox(entity, ColliderLayer.CL_POINTER)
  Material.setPbrMaterial(entity, {
    albedoColor: Color4.fromHexString('#222633ff'),
    emissiveColor: Color4.fromHexString('#b838ffff'),
    emissiveIntensity: 3.2,
    metallic: 0.72,
    roughness: 0.28
  })
  LootState.create(entity, { lootId, kind: 'life-credit', amount: 1, active: true })
  syncEntity(entity, [Transform.componentId, MeshRenderer.componentId, MeshCollider.componentId, Material.componentId, LootState.componentId])
  loot.set(lootId, entity)
}

function beginRound(mode: GameMode) {
  removeDynamicEntities()
  resetPlayersForRound()
  const state = MatchState.getMutable(matchEntity)
  state.phase = 'active'
  state.mode = mode
  state.startsAt = Date.now()
  state.endsAt = Date.now() + GAME.matchSeconds * 1000
  state.zoneRadius = GAME.initialZoneRadius
  state.winner = ''
  state.threatLevel = 0
  state.announcement = `Round ${state.round} live`
  state.threatLevel = mode === 'pvp' ? 0 : 1
  if (mode !== 'pvp') spawnMissionEnemies(1)
  for (let index = 0; index < WORLD_LOOT_SPAWNS.length; index += 1) spawnLoot(index)
  for (let index = 0; index < GAME.pandoraBoxesPerRound; index += 1) spawnPandoraBox(index)
  state.alivePlayers = aliveCombatantCount()
  announce('round-start', `Round ${state.round} has begun. Survive the collapse.`)
}


function activeEnemyFamilyCount(family: 'mutant' | 'drone') {
  let count = 0
  for (const [, bot] of engine.getEntitiesWith(BotState)) if (bot.active && bot.hp > 0 && bot.family === family) count += 1
  return count
}

function spawnMissionEnemies(mission: number) {
  const perFamily = GAME.missionBasePerFamily + (mission - 1) * GAME.missionIncreasePerFamily
  const mutants: EnemyVariant[] = ['standard-mutant','berserker-mutant','stalker-mutant','infected-mutant']
  const drones: EnemyVariant[] = ['scout-drone','attack-drone','support-drone']
  const kingCount=12*mission
  for (let i=0;i<perFamily;i++) spawnBot(i, mutants[i % mutants.length], mission)
  for (let i=0;i<kingCount;i++) spawnBot(perFamily+i, 'king-mutant', mission)
  for (let i=0;i<perFamily;i++) spawnBot(i, drones[i % drones.length], mission)
  const state = MatchState.getMutable(matchEntity)
  state.announcement = `MISSION ${mission} START — MUTANTS ${perFamily} • DRONES ${perFamily} • KINGS ${kingCount}`
  announce('mission-start', state.announcement)
}

function startCountdown(mode: GameMode, difficulty: Difficulty) {
  const state = MatchState.getMutable(matchEntity)
  if (state.phase !== 'lobby') return
  state.phase = 'countdown'
  state.mode = mode
  state.difficulty = difficulty
  state.startsAt = Date.now() + GAME.countdownSeconds * 1000
  state.endsAt = 0
  state.announcement = `Deployment in ${GAME.countdownSeconds} seconds`
  announce('countdown', state.announcement)
}

function finishRound() {
  const state = MatchState.getMutable(matchEntity)
  let winner = 'No survivor'
  if (state.mode === 'coop-bots') winner = alivePlayerCount() > 0 && activeEnemyCount() === 0 ? 'SURVIVOR TEAM' : activeEnemyCount() > 0 ? 'HOSTILE FORCES' : 'No survivor'
  else {
    for (const [, player] of engine.getEntitiesWith(PlayerState)) if (player.joined && player.alive) winner = player.displayName
    for (const [, bot] of engine.getEntitiesWith(BotState)) if (bot.active && bot.hp > 0) winner = bot.displayName
  }
  state.phase = 'results'
  state.endsAt = Date.now() + GAME.resultsSeconds * 1000
  state.winner = winner
  state.announcement = `${winner} survived round ${state.round}`
  announce('round-end', state.announcement)
  for (const address of players.keys()) executeTask(() => savePlayer(address))
}

function applyDamageToPlayer(targetAddress: string, damage: number, attackerAddress: string) {
  damage = Math.max(1, Math.round(damage * 0.8))
  const targetEntity = players.get(targetAddress)
  const state = targetEntity ? PlayerState.getMutableOrNull(targetEntity) : undefined
  const position = getPlayerPosition(targetAddress)
  if (!state || !state.alive || (position && isInsideOutpost(position))) return false
  const shieldDamage = Math.min(state.shield, damage)
  state.shield -= shieldDamage
  state.hp -= damage - shieldDamage
  if (MatchState.get(matchEntity).phase === 'active') state.missionDamageTaken += damage
  if (state.hp <= 0) {
    state.hp = 0
    state.alive = false
    state.deaths += 1
    const attackerEntity = players.get(attackerAddress)
    const attacker = attackerEntity ? PlayerState.getMutableOrNull(attackerEntity) : undefined
    if (attacker && attackerAddress !== targetAddress) attacker.kills += 1
    announce('eliminated', 'You were eliminated. Your loadout remains saved.', targetAddress)
  }
  return true
}

function setEnemyEye(botId: string, state: string, damaged = false) {
  const eye = enemyEyes.get(botId)
  if (!eye) return
  const color = state === 'alert' || state === 'attack' || state === 'chase' ? '#ff1717ff' : state === 'suspicious' || state === 'investigate' ? '#ff6338ff' : '#7c0909ff'
  Material.setPbrMaterial(eye, {
    albedoColor: Color4.fromHexString(color), emissiveColor: Color4.fromHexString(color),
    emissiveIntensity: damaged ? 4.2 : state === 'patrol' ? 1.15 : 3.2, metallic: 0.4, roughness: 0.3
  })
}

function spawnEnemyLoot(bot: ReturnType<typeof BotState.get>, position: Vector3) {
  const lootId = `enemy-drop-${bot.botId}`
  const droneAmmo=bot.variant==='support-drone'?{kind:'ammo-shotgun',amount:8}:bot.variant==='scout-drone'?{kind:'ammo-pistol',amount:18}:{kind:'ammo-rifle',amount:30}
  const kind = bot.family === 'drone' ? droneAmmo.kind : 'contaminated-material'
  const amount = bot.family === 'drone' ? droneAmmo.amount : bot.variant === 'berserker-mutant' ? 5 : 3
  const entity = engine.addEntity()
  Transform.create(entity, { position: Vector3.create(position.x, 1.7, position.z), scale: bot.family==='drone'?Vector3.create(.9,.5,.68):Vector3.create(0.55, 0.55, 0.55) })
  MeshCollider.setBox(entity,ColliderLayer.CL_POINTER)
  LootState.create(entity, { lootId, kind, amount, active: true })
  syncEntity(entity, [Transform.componentId, MeshCollider.componentId, LootState.componentId])
  loot.set(lootId, entity)
}

function applyDamageToBot(entity: Entity, damage: number, attackerAddress: string) {
  const bot = BotState.getMutableOrNull(entity)
  if (!bot || !bot.active) return false
  const transform = Transform.getMutableOrNull(entity)
  bot.hp -= damage
  bot.aiState = 'alert'
  bot.targetId = attackerAddress
  bot.stateUntil = Date.now() + 700
  setEnemyEye(bot.botId, 'alert', bot.family === 'drone' && bot.hp < bot.maxHp * 0.3)
  if(bot.variant==='king-mutant')playKingAnimation(entity,bot.botId,'Get Hit',true);else if (bot.family === 'mutant') playMutantEmote(entity, bot.botId, 'getHit')
  if (bot.hp <= 0) {
    bot.hp = 0
    bot.active = false
    bot.aiState = 'dead'
    if(bot.variant==='king-mutant')playKingAnimation(entity,bot.botId,'Death',true);else if (bot.family === 'mutant') playMutantEmote(entity, bot.botId, 'knockOut')
    if (transform) {
      spawnEnemyLoot(bot, transform.position)
      if(bot.variant!=='king-mutant') transform.rotation = Quaternion.fromEulerDegrees(0, 0, bot.family === 'mutant' ? 82 : 28)
      transform.position.y = bot.family === 'drone' ? 0.45 : 0.3
    }
    setEnemyEye(bot.botId, 'dead')
    const attackerEntity = players.get(attackerAddress)
    const attacker = attackerEntity ? PlayerState.getMutableOrNull(attackerEntity) : undefined
    if (attacker) {
      attacker.kills += 1
      if(bot.family==='mutant') attacker.mutantKills += 1; else if(bot.family==='drone') attacker.droneKills += 1
      attacker.materials += 2
    }
    announce('enemy-down', `${bot.displayName} neutralized${bot.family === 'drone' ? ' — ammunition crate dropped' : ' — contaminated material dropped'}`, attackerAddress)
  }
  return true
}

function createEnemyProjectile(origin: Vector3, targetId: string, damage: number, toxic: boolean) {
  const target = players.has(targetId) ? getPlayerPosition(targetId) : Transform.getOrNull(bots.get(targetId) ?? engine.RootEntity)?.position
  if (!target) return
  const direction = Vector3.normalize(Vector3.subtract(Vector3.create(target.x, target.y + 0.8, target.z), origin))
  const entity = engine.addEntity()
  Transform.create(entity, { position: Vector3.clone(origin), scale: Vector3.create(toxic ? 0.42 : 0.22, toxic ? 0.42 : 0.22, toxic ? 0.42 : 0.7), rotation: Quaternion.multiply(Quaternion.lookRotation(direction), Quaternion.fromEulerDegrees(0,270,0)) })
  if (toxic) { GltfContainer.create(entity,{src:'assets/Models/MutantBullet_v66.glb',visibleMeshesCollisionMask:0,invisibleMeshesCollisionMask:0}); Transform.getMutable(entity).scale=Vector3.create(1.36,1.36,1.36); AudioSource.create(entity,{audioClipUrl:'assets/Audio/User/mutant-acid-attack.mp3',playing:true,loop:false,volume:.45}); syncEntity(entity,[Transform.componentId,GltfContainer.componentId,AudioSource.componentId]) }
  else { GltfContainer.create(entity,{src:'assets/Models/DroneBullet_v65.glb'}); Transform.getMutable(entity).scale=Vector3.create(1.36,1.36,1.36); AudioSource.create(entity,{audioClipUrl:'assets/Audio/User/enemy-missile-fire.mp3',playing:true,loop:false,volume:.45}); syncEntity(entity,[Transform.componentId,GltfContainer.componentId,AudioSource.componentId]) }
  Raycast.create(entity,{originOffset:Vector3.Zero(),direction:{ $case:'globalDirection',globalDirection:direction},maxDistance:1.25,queryType:RaycastQueryType.RQT_HIT_FIRST,timestamp:Date.now()})
  projectiles.set(entity, { targetId, velocity: Vector3.scale(direction, toxic ? 8 : 11), damage: Math.max(1,Math.round(damage*2)), expiresAt: Date.now() + 4200, toxic })
}

function spawnImpactFx(position:Vector3,toxic:boolean,damage=0){
  const now=Date.now(),count=toxic?7:9
  for(let i=0;i<count;i++){
    const a=(i/count)*Math.PI*2,rad=toxic?.55:.38,e=engine.addEntity()
    Transform.create(e,{position:Vector3.create(position.x+Math.cos(a)*rad,position.y+(i%3)*.12,position.z+Math.sin(a)*rad),scale:toxic?Vector3.create(.42,.18,.42):Vector3.create(.24,.12,.34),rotation:Quaternion.fromEulerDegrees(i*19,i*41,i*27)})
    MeshRenderer.setBox(e)
    Material.setPbrMaterial(e,toxic?{albedoColor:Color4.fromHexString('#38ff56aa'),emissiveColor:Color4.fromHexString('#22d948ff'),emissiveIntensity:2.8,roughness:.45}:{albedoColor:Color4.fromHexString(i%2?'#49bfffff':'#ff6b18ff'),emissiveColor:Color4.fromHexString(i%2?'#39aaffff':'#ff7a18ff'),emissiveIntensity:8,roughness:.2})
    if(!toxic&&i===0)AudioSource.create(e,{audioClipUrl:'assets/Audio/User/enemy-big-explosion.mp3',playing:true,loop:false,volume:1})
    syncEntity(e,!toxic&&i===0?[Transform.componentId,MeshRenderer.componentId,Material.componentId,AudioSource.componentId]:[Transform.componentId,MeshRenderer.componentId,Material.componentId]);impactFx.set(e,{expiresAt:now+(toxic?900:900),toxic,damage:0,lastTick:0})
  }
}
function updateImpactFx(){const now=Date.now();for(const[e,fx]of impactFx){const t=Transform.getMutableOrNull(e);if(!t||now>=fx.expiresAt){engine.removeEntity(e);impactFx.delete(e);continue}}}

function updateProjectiles(dt: number) {
  updateImpactFx()
  const now = Date.now()
  for (const [entity, projectile] of projectiles) {
    const transform = Transform.getMutableOrNull(entity)
    if (!transform || now >= projectile.expiresAt) {
      engine.removeEntity(entity); projectiles.delete(entity); continue
    }
    Raycast.getMutable(entity).timestamp=now;const physicsHit=RaycastResult.getOrNull(entity)?.hits?.[0]
    if(physicsHit&&physicsHit.length<=1.25){spawnImpactFx(transform.position,projectile.toxic,projectile.damage);engine.removeEntity(entity);projectiles.delete(entity);continue}
    transform.position = Vector3.add(transform.position, Vector3.scale(projectile.velocity, dt))
    if (isInsideOutpost(transform.position)) {
      engine.removeEntity(entity); projectiles.delete(entity); continue
    }
    if (players.has(projectile.targetId)) {
      const target = getPlayerPosition(projectile.targetId)
      if (target && Vector3.distance(transform.position, Vector3.create(target.x, target.y + 0.8, target.z)) < 1.25) {
        applyDamageToPlayer(projectile.targetId, projectile.damage, 'enemy-projectile')
        spawnImpactFx(transform.position,projectile.toxic,projectile.damage)
        engine.removeEntity(entity); projectiles.delete(entity)
      }
    } else {
      const targetEntity = bots.get(projectile.targetId)
      const target = targetEntity ? Transform.getOrNull(targetEntity) : undefined
      if (target && Vector3.distance(transform.position, target.position) < 1.4) {
        applyDamageToBot(targetEntity!, projectile.damage, 'enemy-faction')
        engine.removeEntity(entity); projectiles.delete(entity)
      }
    }
  }
}

function handleFire(address: string, directionX: number, directionY: number, directionZ: number) {
  const match = MatchState.get(matchEntity)
  const playerEntity = players.get(address)
  const state = playerEntity ? PlayerState.getMutableOrNull(playerEntity) : undefined
  if (match.phase !== 'active' || !state?.alive) return sendResult(address, 'fire', false, 'Not active in this round')
  const direction = safeDirection(directionX, directionY, directionZ)
  if (!direction) return sendResult(address, 'fire', false, 'Invalid aim vector')
  const weapon = isWeaponId(state.equippedWeapon) ? WEAPONS[state.equippedWeapon] : WEAPONS['pulse-rifle']
  const now = Date.now()
  if (now - (lastShotAt.get(address) ?? 0) < weapon.fireDelayMs) return
  if (state[weapon.magazineField] <= 0) return sendResult(address, 'fire', false, 'Magazine empty - reload')
  const playerPosition = getPlayerPosition(address)
  if (!playerPosition) return sendResult(address, 'fire', false, 'Player position unavailable')
  if (isInsideOutpost(playerPosition)) return sendResult(address, 'fire', false, 'Weapons are secured inside the Outpost')
  state[weapon.magazineField] -= 1
  lastShotAt.set(address, now)
  playerNoise.set(address, { x: playerPosition.x, z: playerPosition.z, radius: 120, until: now + 2200 })
  const origin = Vector3.create(playerPosition.x, playerPosition.y + 1.35, playerPosition.z)
  const effectiveRange=Math.max(weapon.range,90) // any hostile whose HUD life bar can be shown remains shootable
  let closestDistance = effectiveRange + 1
  let hitBot: Entity | undefined
  let hitPlayer: string | undefined

  for (const [entity, bot, transform] of engine.getEntitiesWith(BotState, Transform)) {
    if (!bot.active || isInsideOutpost(transform.position)) continue
    const test = pointToRayDistance(origin, direction, transform.position)
    if (test.distanceAlongRay <= effectiveRange && test.miss <= 1.2 && test.distanceAlongRay < closestDistance) {
      closestDistance = test.distanceAlongRay
      hitBot = entity
      hitPlayer = undefined
    }
  }
  if (match.mode !== 'coop-bots') {
    for (const [targetAddress, targetEntity] of players) {
      if (targetAddress === address) continue
      const target = PlayerState.getOrNull(targetEntity)
      const position = getPlayerPosition(targetAddress)
      if (!target?.joined || !target.alive || !position || isInsideOutpost(position)) continue
      const test = pointToRayDistance(origin, direction, Vector3.create(position.x, position.y + 1, position.z))
      if (test.distanceAlongRay <= weapon.range && test.miss <= 1 && test.distanceAlongRay < closestDistance) {
        closestDistance = test.distanceAlongRay
        hitBot = undefined
        hitPlayer = targetAddress
      }
    }
  }

  let headshot=false
  if(hitBot){const bt=Transform.getOrNull(hitBot);if(bt){const head=Vector3.create(bt.position.x,bt.position.y+(BotState.get(hitBot).family==='mutant'?1.65:.35),bt.position.z);const ht=pointToRayDistance(origin,direction,head);headshot=ht.distanceAlongRay<=effectiveRange&&ht.miss<=.42}}
  const hit = hitBot ? applyDamageToBot(hitBot, weapon.damage, address) : hitPlayer ? applyDamageToPlayer(hitPlayer, weapon.damage, address) : false
  if(hit&&headshot){state.headshots+=1; announce('headshot',`HEADSHOT ${state.headshots}/100`,address)}
  void room.send('weaponFired', { playerId: address, weapon: weapon.id })
    sendResult(address, 'fire', true, hit ? `Hit for ${weapon.damage}` : 'Shot fired')
}

function explodeBomb(entity: Entity, bomb: ReturnType<typeof BombState.getMutable>) {
  const transform = Transform.getMutableOrNull(entity)
  if (!transform || bomb.phase !== 'thrown') return
  bomb.phase = 'blast'
  bomb.expiresAt = Date.now() + 520
  transform.scale = Vector3.create(0.4, 0.4, 0.4)
  MeshRenderer.setSphere(entity)
  Material.setPbrMaterial(entity, {
    albedoColor: Color4.fromHexString('#fff0a0e8'), emissiveColor: Color4.fromHexString('#ff7a18ff'),
    emissiveIntensity: 12, metallic: 0, roughness: 0.22
  })
  for (const [address, playerEntity] of players) {
    const player = PlayerState.getOrNull(playerEntity), position = getPlayerPosition(address)
    if (!player?.alive || !position || isInsideOutpost(position)) continue
    const distance = Vector3.distance(transform.position, position)
    if (distance <= BOMB.blastRadius) applyDamageToPlayer(address, Math.max(12, Math.round(BOMB.maxDamage * (1 - distance / BOMB.blastRadius))), bomb.ownerId)
  }
  for (const [botEntity, bot, botTransform] of engine.getEntitiesWith(BotState, Transform)) {
    if (!bot.active) continue
    const distance = Vector3.distance(transform.position, botTransform.position)
    if (distance <= BOMB.blastRadius) applyDamageToBot(botEntity, Math.max(12, Math.round(BOMB.maxDamage * (1 - distance / BOMB.blastRadius))), bomb.ownerId)
  }
  playerNoise.set(bomb.ownerId, { x: transform.position.x, z: transform.position.z, radius: 150, until: Date.now() + 3000 })
  announce('explosion', 'BOMB DETONATED')
}

function handleThrowBomb(address: string, directionX: number, directionY: number, directionZ: number) {
  const match = MatchState.get(matchEntity), playerEntity = players.get(address)
  const player = playerEntity ? PlayerState.getMutableOrNull(playerEntity) : undefined
  if (match.phase !== 'active' || !player?.alive) return sendResult(address, 'bomb', false, 'Bombs are unavailable')
  if (player.bombs <= 0) return sendResult(address, 'bomb', false, 'No bombs - find a purple bomb pickup')
  const direction = safeDirection(directionX, directionY, directionZ), position = getPlayerPosition(address)
  if (!direction || !position) return sendResult(address, 'bomb', false, 'Invalid throw')
  if (isInsideOutpost(position)) return sendResult(address, 'bomb', false, 'Explosives are secured inside the Outpost')
  player.bombs -= 1
  player.explosivesUsed += 1
  const bombId = `bomb-${MatchState.get(matchEntity).round}-${nextBombId++}`, entity = engine.addEntity()
  Transform.create(entity, { position: Vector3.create(position.x + direction.x, position.y + 1.45, position.z + direction.z), scale: Vector3.create(.34,.34,.34) })
  MeshRenderer.setSphere(entity)
  MeshCollider.setSphere(entity, ColliderLayer.CL_POINTER)
  Material.setPbrMaterial(entity, { albedoColor: Color4.fromHexString('#25291fff'), emissiveColor: Color4.fromHexString('#9b25ffff'), emissiveIntensity: 1.7, metallic: .58, roughness: .44 })
  const velocity = Vector3.add(Vector3.scale(direction, BOMB.throwSpeed), Vector3.create(0, 5.6, 0))
  BombState.create(entity, { bombId, ownerId: address, phase: 'thrown', explodeAt: Date.now() + BOMB.fuseMs, expiresAt: 0, velocityX: velocity.x, velocityY: velocity.y, velocityZ: velocity.z })
  syncEntity(entity, [Transform.componentId, MeshRenderer.componentId, MeshCollider.componentId, Material.componentId, BombState.componentId])
  thrownBombs.set(bombId, entity)
  sendResult(address, 'bomb', true, `Bomb thrown - ${player.bombs} remaining`)
}

function updateBombs(dt: number) {
  const now = Date.now()
  for (const [bombId, entity] of thrownBombs) {
    const bomb = BombState.getMutableOrNull(entity), transform = Transform.getMutableOrNull(entity)
    if (!bomb || !transform) { thrownBombs.delete(bombId); continue }
    if (bomb.phase === 'thrown') {
      if (now >= bomb.explodeAt) { explodeBomb(entity, bomb); continue }
      bomb.velocityY -= 9.8 * dt
      const velocity = Vector3.create(bomb.velocityX, bomb.velocityY, bomb.velocityZ)
      const next = Vector3.add(transform.position, Vector3.scale(velocity, dt))
      if (next.y <= .35) { next.y = .35; bomb.velocityY = Math.abs(bomb.velocityY) * .28; bomb.velocityX *= .72; bomb.velocityZ *= .72 }
      transform.position = next
      transform.rotation = Quaternion.fromEulerDegrees(now * .22, now * .31, now * .17)
    } else if (bomb.phase === 'blast') {
      const remaining = Math.max(0, bomb.expiresAt - now), life = 1 - remaining / 520
      const size = .4 + Math.sin(Math.min(1, life) * Math.PI) * BOMB.blastRadius * .8
      transform.scale = Vector3.create(size, size, size)
      if (now >= bomb.expiresAt) { engine.removeEntity(entity); thrownBombs.delete(bombId) }
    }
  }
}

function handleBuild(address: string, kindValue: string, x: number, y: number, z: number, yaw: number) {
  const match = MatchState.get(matchEntity)
  const playerEntity = players.get(address)
  const player = playerEntity ? PlayerState.getMutableOrNull(playerEntity) : undefined
  const playerPosition = getPlayerPosition(address)
  if (match.phase !== 'active' || !player?.alive || !playerPosition) return sendResult(address, 'build', false, 'Building is unavailable')
  if (isInsideOutpost(playerPosition)) return sendResult(address, 'build', false, 'Building is disabled inside the Outpost')
  if (!isBuildKind(kindValue)) return sendResult(address, 'build', false, 'Unknown structure')
  if ((buildCounts.get(address) ?? 0) >= GAME.maxBuildsPerPlayer) return sendResult(address, 'build', false, 'Build limit reached')
  const requested = Vector3.create(x, Math.max(0.5, Math.min(y, 10)), z)
  if (x < 2 || x > GAME.arenaSize - 2 || z < 2 || z > GAME.arenaSize - 2 || Vector3.distance(playerPosition, requested) > 9) {
    return sendResult(address, 'build', false, 'Build closer to your position')
  }
  const snapped = Vector3.create(Math.round(x / 2) * 2, requested.y, Math.round(z / 2) * 2)
  const stackKey=`${address}:${kindValue}:${snapped.x}:${snapped.z}:${Math.round(yaw/15)*15}`, level=buildStacks.get(stackKey)??0
  const baseY=kindValue==='wall'?1.335:kindValue==='ramp'?1.404:1.48
  const stepY=kindValue==='wall'?3.115:kindValue==='ramp'?3.208:.289
  snapped.y=baseY+level*stepY
  buildStacks.set(stackKey,level+1)
  const entity = engine.addEntity()
  Transform.create(entity, { position: snapped, scale: Vector3.One(), rotation: Quaternion.fromEulerDegrees(0, yaw, 0) })
  GltfContainer.create(entity,{src:kindValue==='wall'?'assets/Models/BuildWall.glb':kindValue==='ramp'?'assets/Models/BuildRamp.glb':'assets/Models/BuildFloor.glb',visibleMeshesCollisionMask:ColliderLayer.CL_POINTER|ColliderLayer.CL_PHYSICS,invisibleMeshesCollisionMask:ColliderLayer.CL_POINTER|ColliderLayer.CL_PHYSICS})
  const buildId = `build-${MatchState.get(matchEntity).round}-${nextBuildId++}`
  BuildState.create(entity, { buildId, ownerId: address, kind: kindValue, hp: 150 })
  syncEntity(entity, [Transform.componentId, GltfContainer.componentId, BuildState.componentId])
  builds.set(buildId, entity)
  buildCounts.set(address, (buildCounts.get(address) ?? 0) + 1)
  // Project Exodus v13: building materials are infinite; do not decrement on placement.
  sendResult(address, 'build', true, `${kindValue} deployed`)
}

function collectNearbyLoot() {
  for (const [lootId, lootEntity] of loot) {
    const lootState = LootState.getMutableOrNull(lootEntity)
    const lootTransform = Transform.getOrNull(lootEntity)
    if (!lootState?.active || !lootTransform) continue
    for (const [address, playerEntity] of players) {
      const player = PlayerState.getMutableOrNull(playerEntity)
      const position = getPlayerPosition(address)
      if (!player?.joined || !player.alive || !position || Vector3.distance(position, lootTransform.position) > 2) continue
      if (lootState.kind === 'life-credit') player.lifeCredits += lootState.amount
      else if (lootState.kind === 'materials' || lootState.kind === 'contaminated-material' || lootState.kind === 'electronic-component') player.materials += lootState.amount
      else if (lootState.kind === 'ammo-shotgun') player.ammoShotgun += lootState.amount
      else if (lootState.kind === 'ammo-pistol') player.ammoPistol += lootState.amount
      else if (lootState.kind === 'medkit') player.medkits += lootState.amount
      else if (lootState.kind === 'shield-cell') player.shieldCells += lootState.amount
      else if (lootState.kind === 'water') player.water += lootState.amount
      else if (lootState.kind === 'bomb') player.bombs += lootState.amount
      else player.ammoRifle += lootState.amount
      player.lootCollected += 1
      if(lootState.kind.startsWith('ammo-')) { player.weaponsCollected += 1; player.ammoRoundsCollected += Math.max(0, lootState.amount) }
      const gearKinds=['ammo-rifle','ammo-pistol','ammo-shotgun','medkit','shield-cell','water','bomb','materials']
      const gearIndex=gearKinds.indexOf(lootState.kind)
      if(gearIndex>=0) player.gearTypesMask = (player.gearTypesMask | (1<<gearIndex))
      if((player.lootCollected % 25)===0){player.legendaryLoot += 1; announce('legendary-loot',`LEGENDARY LOOT FOUND ${player.legendaryLoot}/5`,address)}
      lootState.active = false
      Transform.getMutable(lootEntity).position.y = -20
      const label = lootState.kind.replace('ammo-', '').replace('-', ' ')
      announce('loot', `Collected ${lootState.amount} ${label}`, address)
      loot.delete(lootId)
      break
    }
  }
}

// v109: persistent wall-following state. A blocked Mutant/King never takes a blind
// sideways step through a collider. It stops, turns, probes the chosen side on the next
// frame, and keeps following that wall until the direct route is clear again.
const mutantWallAvoid = new Map<Entity,{side:number,until:number}>()
const mutantProbes = new Map<Entity,{f:Entity,l:Entity,r:Entity,fl:Entity,fr:Entity}>()
function ensureMutantProbes(owner:Entity,position:Vector3){
  let p=mutantProbes.get(owner);if(p)return p
  const make=()=>{const e=engine.addEntity();Transform.create(e,{position:Vector3.clone(position)});Raycast.create(e,{originOffset:Vector3.create(0,1.05,0),direction:{$case:'globalDirection',globalDirection:Vector3.Forward()},maxDistance:2.4,queryType:RaycastQueryType.RQT_HIT_FIRST,timestamp:Date.now()});return e}
  p={f:make(),l:make(),r:make(),fl:make(),fr:make()};mutantProbes.set(owner,p);return p
}
function probeBlocked(e:Entity,max:number){const h=RaycastResult.getOrNull(e)?.hits?.[0];return !!h&&h.length<=max}
// v127: IslandTerrain.glb is the authoritative enemy walking surface.
// Do not use generic downward raycasts here: they can hit roofs/upper GLB geometry and lift enemies into the air.
// The shared terrain profile matches the authored IslandTerrain/bridge root heights and only drops to water
// after a normal Mutant has actually left valid island/bridge ground during an acquired chase.
function groundedMutantY(_owner:Entity,position:Vector3){return mutantSurfaceY(position)}
function mutantPhysicsStep(entity:Entity,position:Vector3,direction:Vector3,step:number){
  const flat=Vector3.normalize(Vector3.create(direction.x,0,direction.z));if(Vector3.length(flat)<.001)return Vector3.clone(position)
  const left=Vector3.normalize(Vector3.create(-flat.z,0,flat.x)),right=Vector3.scale(left,-1),max=Math.max(2.2,step+1.8),p=ensureMutantProbes(entity,position)
  const fb=probeBlocked(p.f,max),lb=probeBlocked(p.l,max),rb=probeBlocked(p.r,max),flb=probeBlocked(p.fl,max),frb=probeBlocked(p.fr,max),now=Date.now()
  const aim=(e:Entity,d:Vector3)=>{Transform.getMutable(e).position=Vector3.clone(position);const r=Raycast.getMutable(e);r.originOffset=Vector3.create(0,1.05,0);r.direction={$case:'globalDirection',globalDirection:d};r.maxDistance=max;r.timestamp=now}
  const fLeft=Vector3.normalize(Vector3.add(Vector3.scale(flat,.88),Vector3.scale(left,.48))),fRight=Vector3.normalize(Vector3.add(Vector3.scale(flat,.88),Vector3.scale(right,.48)))
  aim(p.f,flat);aim(p.l,left);aim(p.r,right);aim(p.fl,fLeft);aim(p.fr,fRight)
  const bodyBlocked=fb||flb||frb
  let avoid=mutantWallAvoid.get(entity)
  if(bodyBlocked){if(!avoid||avoid.until<=now)avoid={side:lb&&!rb?-1:rb&&!lb?1:((entity%2)*2-1),until:now+1800};else avoid.until=now+700;mutantWallAvoid.set(entity,avoid)}
  if(avoid&&avoid.until>now){
    const sideDir=avoid.side>0?left:right,sideBlocked=avoid.side>0?lb:rb
    if(sideBlocked){const other=avoid.side>0?rb:lb;if(!other){avoid.side=-avoid.side;mutantWallAvoid.set(entity,avoid);return Vector3.add(position,Vector3.scale(avoid.side>0?left:right,Math.min(step,.10)))}return Vector3.clone(position)}
    if(!bodyBlocked)avoid.until=Math.min(avoid.until,now+260)
    return Vector3.add(position,Vector3.scale(sideDir,Math.min(step,.10)))
  }
  mutantWallAvoid.delete(entity);if(bodyBlocked)return Vector3.clone(position)
  // Small accepted steps prevent fast enemies tunnelling through thin authored GLB walls.
  return Vector3.add(position,Vector3.scale(flat,Math.min(step,.16)))
}

function moveEnemy(entity:Entity, transform: ReturnType<typeof Transform.getMutable>, target: Vector3, speed: number, dt: number, airborne: boolean, offsetX = 0, offsetZ = 0, pursueOffLand = false) {
  const rawTarget={x:target.x+offsetX,z:target.z+offsetZ}
  const state=BotState.get(entity)
  // v107: normal Mutants use the same direct live-target pursuit principle as Drones.
  // Do not funnel them through scripted bridge endpoints: that caused groups to stack/freeze.
  // King Mutant keeps its territorial navigation because it must remain on its island.
  const nav=!airborne&&state.variant==='king-mutant'?mutantNavigationTarget(transform.position,rawTarget):rawTarget
  const desired = Vector3.create(nav.x, airborne ? target.y : transform.position.y, nav.z)
  const direction = Vector3.normalize(Vector3.subtract(desired, transform.position))
  const step=speed*dt
  let next = Vector3.add(transform.position, Vector3.scale(direction, step))
  if(!airborne) next=mutantPhysicsStep(entity,transform.position,direction,step)
  if (!airborne && state.variant==='king-mutant') {
    // King Mutant is a territorial island guard: it may patrol/chase/shoot, but never leaves its spawn island.
    const home=MUTANT_ISLAND_GROUND.reduce((best,z)=>Math.hypot(state.homeX-z.x,state.homeZ-z.z)<Math.hypot(state.homeX-best.x,state.homeZ-best.z)?z:best,MUTANT_ISLAND_GROUND[0])
    const dx=(next.x-home.x)/home.rx,dz=(next.z-home.z)/home.rz
    if(dx*dx+dz*dz>.68){
      const homeDirection=Vector3.normalize(Vector3.create(state.homeX-transform.position.x,0,state.homeZ-transform.position.z))
      transform.rotation=Quaternion.lookRotation(Vector3.length(homeDirection)<.01?Vector3.Forward():homeDirection)
      return
    }
  }
  if (isInsideOutpost(next)) {
    const away = Vector3.normalize(Vector3.create(next.x - OUTPOST_ZONE.centerX, 0, next.z - OUTPOST_ZONE.centerZ))
    const fallback = Vector3.length(away) < .01 ? Vector3.create(1, 0, 0) : away
    next = Vector3.create(
      OUTPOST_ZONE.centerX + fallback.x * (OUTPOST_ZONE.halfWidth + 2),
      next.y,
      OUTPOST_ZONE.centerZ + fallback.z * (OUTPOST_ZONE.halfDepth + 2)
    )
  }
  transform.position.x = Math.max(2, Math.min(GAME.arenaSize - 2, next.x))
  transform.position.z = Math.max(2, Math.min(GAME.arenaSize - 2, next.z))
  if (airborne) transform.position.y = Math.max(5, Math.min(13, next.y || 7))
  else transform.position.y = groundedMutantY(entity,transform.position)
  transform.rotation = Quaternion.lookRotation(Vector3.create(direction.x, 0, direction.z))
}

function scheduleBackup(bot: ReturnType<typeof BotState.getMutable>, now: number) {
  if ((bot.variant !== 'scout-drone' && bot.variant !== 'support-drone') || backupCalls.has(bot.botId)) return
  const difficulty = isDifficulty(MatchState.get(matchEntity).difficulty) ? MatchState.get(matchEntity).difficulty as Difficulty : 'normal'
  backupCalls.set(bot.botId, now + DIFFICULTY[difficulty].reinforcementDelay)
  bot.reinforcementLevel = Math.min(3, bot.reinforcementLevel + 1)
  announce('drone-alert', 'DRONE ALERT — CALLING REINFORCEMENTS...')
}

function processBackupCalls(now: number) {
  const difficulty = isDifficulty(MatchState.get(matchEntity).difficulty) ? MatchState.get(matchEntity).difficulty as Difficulty : 'normal'
  for (const [botId, due] of backupCalls) {
    if (now < due) continue
    backupCalls.delete(botId)
    const callerEntity = bots.get(botId), caller = callerEntity ? BotState.getOrNull(callerEntity) : undefined
    if (!caller?.active || reinforcementsSpawned >= DIFFICULTY[difficulty].reinforcementCap) continue
    spawnBot(nextEnemyId + 7, reinforcementsSpawned >= 2 ? 'support-drone' : 'attack-drone')
    reinforcementsSpawned += 1
    announce('drone-alert', `REINFORCEMENTS ARRIVED — escalation ${reinforcementsSpawned}`)
  }
}

function updateBots(dt: number) {
  const now = Date.now()
  updateProjectiles(dt)
  processBackupCalls(now)
  for (const [entity, readonlyBot, readonlyTransform] of engine.getEntitiesWith(BotState, Transform)) {
    if (!readonlyBot.active) continue
    const bot = BotState.getMutable(entity), transform = Transform.getMutable(entity)
    let targetId = '', targetPosition: Vector3 | undefined, targetDistance = Number.POSITIVE_INFINITY

    for (const [address, playerEntity] of players) {
      const player = PlayerState.getOrNull(playerEntity), position = getPlayerPosition(address)
      if (!player?.joined || !player.alive || !position || isInsideOutpost(position)) continue
      const distance = Vector3.distance(transform.position, position)
      const noise = playerNoise.get(address)
      const heard = !!noise && noise.until > now && Vector3.distance(transform.position, Vector3.create(noise.x, transform.position.y, noise.z)) <= noise.radius
      const seen = distance <= bot.detection * (bot.family === 'mutant' ? 1.35 : 1)
      if ((seen || heard) && distance < targetDistance) { targetId = address; targetPosition = position; targetDistance = distance }
    }
    // Mutants and drones are rival factions and can become each other's target.
    if (!targetPosition) for (const [otherEntity, other, otherTransform] of engine.getEntitiesWith(BotState, Transform)) {
      if (otherEntity === entity || !other.active || other.family === bot.family) continue
      const distance = Vector3.distance(transform.position, otherTransform.position)
      if (distance < Math.min(bot.detection * 0.6, targetDistance)) { targetId = other.botId; targetPosition = otherTransform.position; targetDistance = distance }
    }

    if (targetPosition) {
      bot.targetId = targetId; bot.lastKnownX = targetPosition.x; bot.lastKnownZ = targetPosition.z; bot.lastSeenAt = now
      if (bot.aiState === 'patrol' || bot.aiState === 'return' || bot.aiState === 'search') { bot.aiState = 'alert'; bot.stateUntil = now + (bot.family === 'mutant' ? 120 : 450); setEnemyEye(bot.botId, 'alert'); if (bot.family === 'drone' && players.has(targetId)) scheduleBackup(bot, now) }
    } else if (bot.targetId && now - bot.lastSeenAt < 9000) {
      targetPosition = Vector3.create(bot.lastKnownX, transform.position.y, bot.lastKnownZ); targetDistance = Vector3.distance(transform.position, targetPosition); bot.aiState = 'search'
    } else {
      bot.targetId = ''
      const phase = (now / (bot.variant === 'king-mutant' ? 1250 : 1450) + Number(bot.botId.replace(/\D/g, ''))) % (Math.PI * 2)
      const patrolRadius = bot.variant === 'king-mutant' ? 18 : bot.family === 'mutant' ? 90 : 10
      const patrolTarget = Vector3.create(bot.homeX + Math.sin(phase) * patrolRadius, bot.airborne ? 7 + Math.sin(phase * 1.7) * 2 : transform.position.y, bot.homeZ + Math.cos(phase) * patrolRadius)
      bot.aiState = Vector3.distance(transform.position, patrolTarget) < 2 ? 'idle' : 'patrol'; if(bot.variant==='king-mutant')playKingAnimation(entity,bot.botId,bot.aiState==='idle'?'Idle':'Walk'); setEnemyEye(bot.botId, bot.aiState)
      moveEnemy(entity, transform, patrolTarget, bot.speed * (bot.family === 'mutant' ? 0.58 : 0.35), dt, bot.airborne)
      continue
    }

    if (bot.stateUntil > now && bot.aiState === 'alert' && bot.family === 'drone') continue
    const range = bot.variant==='king-mutant'?12:(bot.family==='mutant'?2.15:(ENEMIES[bot.variant as EnemyVariant]?.range ?? 2))
    const ranged = bot.variant==='king-mutant' || bot.family === 'drone'
    if (targetPosition && targetDistance <= range) {
      bot.aiState = 'attack'; if(bot.variant==='king-mutant'){const flip=!(kingAttackFlip.get(bot.botId)??false);kingAttackFlip.set(bot.botId,flip);playKingAnimation(entity,bot.botId,flip?'Attack 1':'Attack 2',true)}; setEnemyEye(bot.botId, 'attack', bot.family === 'drone' && bot.hp < bot.maxHp * .3)
      // v79: Kings are island guards, not stationary turrets. Keep closing on the player while firing.
      // Navigation still goes through moveEnemy, so bridge/land constraints and solid-GLB avoidance remain active.
      if (bot.family === 'mutant' && players.has(targetId) && targetDistance > 1.35) {
        // Zombie pressure: mutants never become stationary targets after spotting the player.
        // Ranged mutants/Kings keep advancing while firing; melee mutants close to striking distance.
        const n=Number(bot.botId.replace(/\D/g,''))||entity, formationAngle=(n%8)*(Math.PI/4), formationRadius=bot.variant==='king-mutant'?1.8:0
        moveEnemy(entity, transform, targetPosition, bot.speed * (bot.variant==='king-mutant'?1.45:1), dt, false, Math.cos(formationAngle)*formationRadius, Math.sin(formationAngle)*formationRadius, false)
      }
      if (now >= bot.attackReadyAt) {
        bot.attackReadyAt = now + (bot.variant === 'berserker-mutant' ? 1700 : bot.family === 'drone' ? 1650 : bot.variant === 'king-mutant' ? 1535 : 1150)
        if (bot.family === 'mutant' && bot.variant !== 'king-mutant' && bot.variant in MUTANT_AVATARS) playMutantEmote(entity, bot.botId, MUTANT_AVATARS[bot.variant as keyof typeof MUTANT_AVATARS].attackEmote)
        if (ranged) {
          transform.rotation=Quaternion.lookRotation(Vector3.normalize(Vector3.subtract(targetPosition,transform.position)))
          // Only the King Mutant has mutant bullets. Its projectile damage matches an Attack Drone projectile.
          const projectileDamage=bot.variant==='king-mutant'?ENEMIES['attack-drone'].damage:bot.damage
          createEnemyProjectile(Vector3.create(transform.position.x, transform.position.y + (bot.family === 'drone' ? -.2 : 1.5), transform.position.z), targetId, projectileDamage, bot.variant==='king-mutant')
        }
        else if (players.has(targetId)) applyDamageToPlayer(targetId, Math.max(1,Math.round(bot.damage*.45)), bot.botId)
        else { const rival = bots.get(targetId); if (rival) applyDamageToBot(rival, bot.damage, bot.botId) }
      }
    } else if (targetPosition) {
      bot.aiState = 'chase'; if(bot.variant==='king-mutant')playKingAnimation(entity,bot.botId,'Walk'); setEnemyEye(bot.botId, 'chase')
      let offsetX = 0, offsetZ = 0
      
      if (bot.family === 'drone') { const n=Number(bot.botId.replace(/\D/g,''))||entity, angle=(n*2.399963229728653)+(now/5000), radius=16+(n%9)*3.2; offsetX=Math.cos(angle)*radius; offsetZ=Math.sin(angle)*radius; targetPosition=Vector3.create(targetPosition.x,7+(n%5)*.8+Math.sin(now/1100+n)*1.2,targetPosition.z) }
      if(bot.family==='mutant'&&bot.variant==='king-mutant'){const n=Number(bot.botId.replace(/\D/g,''))||entity,angle=(n%8)*(Math.PI/4),radius=1.8;offsetX+=Math.cos(angle)*radius;offsetZ+=Math.sin(angle)*radius}
      moveEnemy(entity, transform, targetPosition, bot.speed * (bot.family==='mutant' ? (bot.variant==='berserker-mutant'?1.15:bot.variant==='king-mutant'?1.45:1) : 1), dt, bot.airborne, offsetX, offsetZ, false)
    }
  }
  for (const [address, noise] of playerNoise) if (noise.until <= now) playerNoise.delete(address)
}

function escalateMissionThreat(triggerAddress: string) {
  const match = MatchState.getMutable(matchEntity)
  match.threatLevel += 1
  const enemyMode = match.mode === 'solo-bots' || match.mode === 'coop-bots' || match.mode === 'pvp-bots'
  if (!enemyMode || match.phase !== 'active') return announce('threat-rise', `THREAT LEVEL ${match.threatLevel} — hostile activity increased`)
  const remaining = Math.max(0, GAME.maxEnemies - activeEnemyCount())
  const waveSize = Math.min(remaining, GAME.missionWaveBase + Math.min(4, Math.floor((match.threatLevel - 1) / 2)))
  const wave: EnemyVariant[] = ['standard-mutant', 'attack-drone', 'stalker-mutant', 'scout-drone', 'infected-mutant', 'support-drone']
  for (let index=0; index<waveSize; index+=1) spawnBot(nextEnemyId + index + match.threatLevel * 5, wave[index % wave.length])
  announce('threat-rise', `MISSION COMPLETE — THREAT LEVEL ${match.threatLevel}. ${waveSize} new hostiles entered the island.`)
  sendResult(triggerAddress, 'threat', true, `Threat level increased to ${match.threatLevel}`)
}

function applyStormDamage() {
  const match = MatchState.get(matchEntity)
  const center = Vector3.create(GAME.centerX, 0, GAME.centerZ)
  for (const [address, playerEntity] of players) {
    const player = PlayerState.getOrNull(playerEntity)
    const position = getPlayerPosition(address)
    if (player?.joined && player.alive && position && !isInsideOutpost(position) && Vector3.distance(position, center) > match.zoneRadius) {
      applyDamageToPlayer(address, 5, 'storm')
    }
  }
  for (const [entity, bot, transform] of engine.getEntitiesWith(BotState, Transform)) {
    if (bot.active && Vector3.distance(transform.position, center) > match.zoneRadius) applyDamageToBot(entity, 5, 'storm')
  }
}

function serverSystem(dt: number) {
  const now = Date.now()
  updateBombs(dt)
  heartbeatTick += dt
  if (heartbeatTick >= 2) {
    heartbeatTick = 0
    MatchState.getMutable(matchEntity).heartbeat = now
    const locs=Object.values(LOCATIONS)
    for(const [address,entity] of players){const ps=PlayerState.getMutableOrNull(entity),pos=getPlayerPosition(address);if(!ps||!pos)continue;for(let i=0;i<locs.length;i++){const l=locs[i];if(Math.hypot(pos.x-l.x,pos.z-l.z)<=14)ps.locationsDiscovered|=(1<<i)}}
  }

  const state = MatchState.getMutable(matchEntity)
  if (state.phase === 'countdown' && now >= state.startsAt) beginRound(isGameMode(state.mode) ? state.mode : 'solo-bots')
  if (state.phase === 'active') {
    const elapsed = Math.max(0, (now - state.startsAt) / 1000)
    const progress = Math.min(1, elapsed / GAME.matchSeconds)
    state.zoneRadius = GAME.initialZoneRadius + (GAME.finalZoneRadius - GAME.initialZoneRadius) * progress
    state.alivePlayers = aliveCombatantCount()
    if (state.mode !== 'pvp' && activeEnemyCount() === 0) {
      const mission = Math.max(1, state.threatLevel)
      if (!missionAdvanceAt) {
        state.announcement = `MISSION ${mission} COMPLETE`
        announce('mission-complete', state.announcement)
        for (const [address, playerEntity] of players) {
          const player=PlayerState.getMutableOrNull(playerEntity)
          if(!player?.joined) continue
          player.missionsCompleted+=1
          if(state.mode==='solo-bots') player.soloMissions+=1
          if(state.mode==='coop-bots') player.coopMissions+=1
          player.cleanSweeps+=1
          player.missionTypesMask |= (1 << ((mission-1)%10))
          if(mission===1) player.outpostDefenses+=1
          if(mission===7) player.suppliesDelivered+=10
          if(player.missionDamageTaken===0) player.noHitMissions+=1
          const duration=now-Number(player.missionStartedAt||now); if(duration<=300000) player.speedRuns+=1
          const hour=new Date(now).getUTCHours(); if(hour>=18||hour<6) player.nightMissions+=1
          player.missionDamageTaken=0; player.missionStartedAt=now
          void savePlayer(address)
        }
        missionAdvanceAt = now + 4500
      } else if (now >= missionAdvanceAt) {
        missionAdvanceAt = 0
        if (mission >= GAME.totalMissions) { finishRound(); return }
        state.threatLevel = mission + 1
        spawnMissionEnemies(state.threatLevel)
      }
    }
    const coopFinished = state.mode === 'coop-bots' && alivePlayerCount() === 0
    const competitiveFinished = state.mode === 'pvp' && elapsed > 20 && state.alivePlayers <= 1
    if ((state.mode === 'pvp' && now >= state.endsAt) || coopFinished || competitiveFinished) finishRound()
  } else if (state.phase === 'results' && now >= state.endsAt) {
    removeDynamicEntities()
    state.phase = 'lobby'
    state.round += 1
    state.startsAt = 0
    state.endsAt = 0
    state.zoneRadius = GAME.initialZoneRadius
    state.alivePlayers = joinedPlayerCount()
    state.winner = ''
    state.threatLevel = 0
    state.announcement = 'Choose a mode for the next deployment'
  }

  botTick += dt
  if (state.phase === 'active' && botTick >= 0.25) {
    updateBots(botTick)
    botTick = 0
  }
  worldTick += dt
  if (state.phase === 'active' && worldTick >= 1) {
    collectNearbyLoot()
    // v63: storm no longer damages the player; only hostile attacks/contact reduce health.
    // applyStormDamage()
    for (const [address, entity] of players) {
      const player = PlayerState.getMutableOrNull(entity)
      const position = getPlayerPosition(address)
      if (!player?.joined || !position) continue
      const previous = lastSurvivalPositions.get(address)
      const travelled = previous ? Vector3.distance(previous, position) : 0
      player.stamina = travelled > 4 ? Math.max(0, player.stamina - 7) : Math.min(100, player.stamina + 5)
      if (travelled > 1.8) playerNoise.set(address, { x: position.x, z: position.z, radius: travelled > 4 ? 34 : 14, until: now + 1200 })
      lastSurvivalPositions.set(address, Vector3.clone(position))
    }
    worldTick = 0
  }
  survivalTick += dt
  if (state.phase === 'active' && survivalTick >= 20) {
    survivalTick = 0
    for (const [address, entity] of players) {
      const player = PlayerState.getMutableOrNull(entity)
      if (!player?.joined || !player.alive) continue
      player.stamina = Math.min(100, player.stamina + 8)
      // v63: hunger/thirst remain informational; health only falls from direct hostile contact/projectiles.
    }
  }
}

export function setupServer() {
  console.log('[SERVER] Project Exodus server booting')
  protectAuthoritativeState()
  createMatchState()

  room.onMessage('joinMatch', (data, context) => {
    if (!context) return
    const address = normalizeAddress(context.from)
    if (!isGameMode(data.mode)) return sendResult(address, 'join', false, 'Invalid match mode')
    if (!isDifficulty(data.difficulty)) return sendResult(address, 'join', false, 'Invalid solo difficulty')
    const mode = data.mode
    const difficulty = data.difficulty
    if (!players.has(address) && joinedPlayerCount() >= GAME.maxPlayers) return sendResult(address, 'join', false, 'Arena is full')
    executeTask(async () => {
      await loadPlayer(address, data.displayName.slice(0, 32))
      sendProgress(address, clientProgress.get(address) ?? sanitizeProgress({}))
      sendResult(address, 'join', true, 'Loadout and campaign progress synchronized')
      announce('joined', `${data.displayName || 'A runner'} entered the lobby`)
      startCountdown(mode, difficulty)
    })
  })

  room.onMessage('saveProgress', (data, context) => {
    if (!context) return
    const address = normalizeAddress(context.from)
    try {
      const parsed = JSON.parse(data.payload || '{}')
      clientProgress.set(address, sanitizeProgress(parsed))
      executeTask(() => savePlayer(address))
    } catch {
      console.error(`[SERVER] Invalid progress payload from ${address}`)
    }
  })

  room.onMessage('leaveMatch', (_data, context) => {
    if (!context) return
    const address = normalizeAddress(context.from)
    const entity = players.get(address)
    const state = entity ? PlayerState.getMutableOrNull(entity) : undefined
    if (state) state.joined = false
    executeTask(() => savePlayer(address))
  })

  room.onMessage('fireWeapon', (data, context) => {
    if (!context) return
    handleFire(normalizeAddress(context.from), data.directionX, data.directionY, data.directionZ)
  })

  room.onMessage('throwBomb', (data, context) => {
    if (!context) return
    handleThrowBomb(normalizeAddress(context.from), data.directionX, data.directionY, data.directionZ)
  })

  room.onMessage('buildStructure', (data, context) => {
    if (!context) return
    handleBuild(normalizeAddress(context.from), data.kind, data.x, data.y, data.z, data.yaw)
  })

  room.onMessage('selectWeapon', (data, context) => {
    if (!context) return
    const address = normalizeAddress(context.from)
    const entity = players.get(address)
    const player = entity ? PlayerState.getMutableOrNull(entity) : undefined
    if (!player || !isWeaponId(data.weapon)) return sendResult(address, 'weapon', false, 'Weapon is unavailable')
    player.equippedWeapon = data.weapon
    sendResult(address, 'weapon', true, WEAPONS[data.weapon].name)
  })

  room.onMessage('reloadWeapon', (data, context) => {
    if (!context) return
    const address = normalizeAddress(context.from)
    reloadPlayerWeapon(address, data.weapon)
  })

  room.onMessage('collectLoot', (_data, context) => {
    if (context) collectNearbyLoot()
  })

  room.onMessage('useItem', (data, context) => {
    if (!context) return
    const address = normalizeAddress(context.from)
    const entity = players.get(address)
    const player = entity ? PlayerState.getMutableOrNull(entity) : undefined
    if (!player?.alive || !isInventoryItem(data.item)) return sendResult(address, 'item', false, 'Item is unavailable')
    if (data.item === 'life-credit') {
      if (player.lifeCredits <= 0) return sendResult(address, 'item', false, 'No Life Credits')
      if (player.hp >= 100) return sendResult(address, 'item', false, 'Health is already full')
      player.lifeCredits -= 1
      player.hp = 100
      executeTask(() => savePlayer(address))
      return sendResult(address, 'item', true, 'Life Credit restored full health')
    }
    if (data.item === 'medkit') {
      if (player.medkits <= 0) return sendResult(address, 'item', false, 'No medkits')
      if (player.hp >= 100) return sendResult(address, 'item', false, 'Health is already full')
      player.medkits -= 1
      const beforeHp=player.hp; player.hp = Math.min(100, player.hp + 40); player.healingDone += player.hp-beforeHp; player.medkitsUsed += 1
      return sendResult(address, 'item', true, 'Medkit restored 40 health')
    }
    if (data.item === 'water') {
      if (player.water <= 0) return sendResult(address, 'item', false, 'No water')
      if (player.stamina >= 100) return sendResult(address, 'item', false, 'Stamina is already full')
      player.water -= 1
      player.stamina = Math.min(100, player.stamina + 45); player.watersUsed += 1
      return sendResult(address, 'item', true, 'Water restored stamina for faster running')
    }
    if (player.shieldCells <= 0) return sendResult(address, 'item', false, 'No shield cells')
    if (player.shield >= 100) return sendResult(address, 'item', false, 'Shield is already full')
    player.shieldCells -= 1
    player.shield = Math.min(100, player.shield + 30)
    sendResult(address, 'item', true, 'Shield cell restored 30 shield')
  })

  room.onMessage('requestMission', (data, context) => {
    if (!context) return
    const address = normalizeAddress(context.from)
    const entity = players.get(address)
    const player = entity ? PlayerState.getMutableOrNull(entity) : undefined
    if (!player || !isMissionId(data.missionId) || !isNear(address, 104, 101.75, 8)) return sendResult(address, 'mission', false, 'Use the Outpost mission board')
    const nextMission = MISSION_ORDER[player.missionsCompleted % MISSION_ORDER.length]
    player.missionId = nextMission
    player.missionComplete = false
    player.missionDamageTaken=0; player.missionStartedAt=Date.now()
    sendResult(address, 'mission', true, `${MISSIONS[nextMission].name} accepted`)
  })

  room.onMessage('completeMission', (data, context) => {
    if (!context) return
    const address = normalizeAddress(context.from)
    const entity = players.get(address)
    const player = entity ? PlayerState.getMutableOrNull(entity) : undefined
    if (!player || !isMissionId(data.missionId) || player.missionId !== data.missionId || player.missionComplete) return
    const mission = MISSIONS[data.missionId]
    const target = LOCATIONS[mission.target]
    if (!isNear(address, target.x, target.z, 9)) return
    player.missionComplete = true
    player.missionsCompleted += 1
    const mode=MatchState.get(matchEntity).mode; if(mode==='solo-bots') player.soloMissions+=1; if(mode==='coop-bots') player.coopMissions+=1
    player.materials += mission.rewardMaterials
    sendResult(address, 'mission', true, `Mission complete: +${mission.rewardMaterials} materials`)
    executeTask(() => savePlayer(address))
  })

  room.onMessage('buySupply', (data, context) => {
    if (!context) return
    const address = normalizeAddress(context.from)
    const entity = players.get(address)
    const player = entity ? PlayerState.getMutableOrNull(entity) : undefined
    if (!player || !isNear(address, 105.5, 118.25, 7)) return sendResult(address, 'shop', false, 'Use the Outpost trader terminal')
    const price = data.item === 'medkit' ? 6 : data.item === 'water' ? 3 : -1
    if (price < 0 || player.materials < price) return sendResult(address, 'shop', false, price < 0 ? 'Unknown supply' : 'Not enough materials')
    player.materials -= price
    player.tradesCompleted += 1
    player.suppliesDelivered += 1
    if (data.item === 'medkit') player.medkits += 1
    else if (data.item === 'water') player.water += 1
    sendResult(address, 'shop', true, `Purchased ${data.item.replace('-', ' ')}`)
  })

  room.onMessage('respawnPlayer', (data, context) => {
    if (!context) return
    const address = normalizeAddress(context.from)
    const entity = players.get(address)
    const player = entity ? PlayerState.getMutableOrNull(entity) : undefined
    if (!player || player.alive || (data.choice !== 'continue' && data.choice !== 'rejoin' && data.choice !== 'outpost')) return sendResult(address, 'respawn', false, 'Respawn is unavailable')
    const fresh = data.choice === 'rejoin'
    const continuing = data.choice === 'continue'
    resetPlayerForRespawn(player, fresh || continuing)
    // Continue preserves the current bots/kills/mission state. Fresh explicitly rebuilds the mission.
    if (fresh && MatchState.get(matchEntity).mode === 'solo-bots') beginRound('solo-bots')
    sendResult(address, 'respawn', true, continuing ? 'continue' : fresh ? 'rejoin' : 'outpost')
  })

  onLeaveScene((userId) => {
    const address = normalizeAddress(userId)
    const entity = players.get(address)
    const state = entity ? PlayerState.getMutableOrNull(entity) : undefined
    if (state) state.joined = false
    executeTask(() => savePlayer(address))
  })

  engine.addSystem(serverSystem)
  console.log('[SERVER] Project Exodus server ready')
}
