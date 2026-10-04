import { engine, Schemas } from '@dcl/sdk/ecs'

export const MatchState = engine.defineComponent('exodus::match-state', {
  phase: Schemas.String,
  mode: Schemas.String,
  round: Schemas.Int,
  startsAt: Schemas.Int64,
  endsAt: Schemas.Int64,
  alivePlayers: Schemas.Int,
  zoneRadius: Schemas.Float,
  heartbeat: Schemas.Int64,
  winner: Schemas.String,
  announcement: Schemas.String,
  difficulty: Schemas.String,
  threatLevel: Schemas.Int
})

export const PlayerState = engine.defineComponent('exodus::player-state', {
  playerId: Schemas.String,
  displayName: Schemas.String,
  hp: Schemas.Int,
  shield: Schemas.Int,
  kills: Schemas.Int,
  deaths: Schemas.Int,
  materials: Schemas.Int,
  equippedWeapon: Schemas.String,
  ammoRifle: Schemas.Int,
  ammoShotgun: Schemas.Int,
  ammoPistol: Schemas.Int,
  magazineRifle: Schemas.Int,
  magazineShotgun: Schemas.Int,
  magazinePistol: Schemas.Int,
  medkits: Schemas.Int,
  shieldCells: Schemas.Int,
  water: Schemas.Int,
  bombs: Schemas.Int,
  lifeCredits: Schemas.Int,
  stamina: Schemas.Int,
  hunger: Schemas.Int,
  thirst: Schemas.Int,
  missionId: Schemas.String,
  missionComplete: Schemas.Boolean,
  missionsCompleted: Schemas.Int,
  mutantKills: Schemas.Int,
  droneKills: Schemas.Int,
  lootCollected: Schemas.Int,
  explosivesUsed: Schemas.Int,
  healingDone: Schemas.Int,
  medkitsUsed: Schemas.Int,
  watersUsed: Schemas.Int,
  tradesCompleted: Schemas.Int,
  soloMissions: Schemas.Int,
  coopMissions: Schemas.Int,
  suppliesDelivered: Schemas.Int,
  outpostDefenses: Schemas.Int,
  cleanSweeps: Schemas.Int,
  locationsDiscovered: Schemas.Int,
  missionTypesMask: Schemas.Int,
  noHitMissions: Schemas.Int,
  headshots: Schemas.Int,
  legendaryLoot: Schemas.Int,
  weaponsCollected: Schemas.Int,
  ammoRoundsCollected: Schemas.Int,
  gearTypesMask: Schemas.Int,
  speedRuns: Schemas.Int,
  nightMissions: Schemas.Int,
  missionDamageTaken: Schemas.Int,
  missionStartedAt: Schemas.Int64,
  joined: Schemas.Boolean,
  alive: Schemas.Boolean
})

export const BotState = engine.defineComponent('exodus::bot-state', {
  botId: Schemas.String,
  displayName: Schemas.String,
  hp: Schemas.Int,
  active: Schemas.Boolean,
  targetId: Schemas.String,
  family: Schemas.String,
  variant: Schemas.String,
  aiState: Schemas.String,
  maxHp: Schemas.Int,
  damage: Schemas.Int,
  speed: Schemas.Float,
  detection: Schemas.Float,
  homeX: Schemas.Float,
  homeZ: Schemas.Float,
  lastKnownX: Schemas.Float,
  lastKnownZ: Schemas.Float,
  lastSeenAt: Schemas.Int64,
  stateUntil: Schemas.Int64,
  attackReadyAt: Schemas.Int64,
  reinforcementLevel: Schemas.Int,
  airborne: Schemas.Boolean
})

export const BuildState = engine.defineComponent('exodus::build-state', {
  buildId: Schemas.String,
  ownerId: Schemas.String,
  kind: Schemas.String,
  hp: Schemas.Int
})

export const LootState = engine.defineComponent('exodus::loot-state', {
  lootId: Schemas.String,
  kind: Schemas.String,
  amount: Schemas.Int,
  active: Schemas.Boolean
})

export const BombState = engine.defineComponent('exodus::bomb-state', {
  bombId: Schemas.String,
  ownerId: Schemas.String,
  phase: Schemas.String,
  explodeAt: Schemas.Int64,
  expiresAt: Schemas.Int64,
  velocityX: Schemas.Float,
  velocityY: Schemas.Float,
  velocityZ: Schemas.Float
})

const SERVER_ID = 'authoritative-server'

export function protectAuthoritativeState() {
  MatchState.validateBeforeChange((value) => value.senderAddress === SERVER_ID)
  PlayerState.validateBeforeChange((value) => value.senderAddress === SERVER_ID)
  BotState.validateBeforeChange((value) => value.senderAddress === SERVER_ID)
  BuildState.validateBeforeChange((value) => value.senderAddress === SERVER_ID)
  LootState.validateBeforeChange((value) => value.senderAddress === SERVER_ID)
  BombState.validateBeforeChange((value) => value.senderAddress === SERVER_ID)
}
