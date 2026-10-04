export const GAME = {
  arenaSize: 480,
  centerX: 240,
  centerZ: 240,
  maxPlayers: 20,
  matchSeconds: 15 * 60,
  countdownSeconds: 10,
  resultsSeconds: 15,
  initialZoneRadius: 220,
  finalZoneRadius: 35,
  startingMaterials: 12,
  maxBuildsPerPlayer: 24,
  botCountSolo: 8,
  botCountFill: 12,
  maxEnemies: 600,
  totalMissions: 10,
  missionBasePerFamily: 20,
  missionIncreasePerFamily: 20,
  missionWaveBase: 2,
  pandoraBoxesPerRound: 3
} as const

export const OUTPOST_ZONE = {
  centerX: 96,
  centerZ: 112,
  // Covers the complete imported Outpost shell, stairs and entrance threshold.
  halfWidth: 40,
  halfDepth: 42,
  minY: 0,
  maxY: 32
} as const

// v122: the Outpost *island terrain* is the safe-zone authority.  Do not use the
// Outpost building footprint: the player can be outside the building while still on the island.
export function isInsideOutpost(position: { x: number; y: number; z: number }) {
  const dx = (position.x - 96) / 55
  const dz = (position.z - 112) / 51
  return dx * dx + dz * dz <= 1 && position.y >= OUTPOST_ZONE.minY && position.y <= OUTPOST_ZONE.maxY
}

export type WeaponId = 'pulse-rifle' | 'scattergun' | 'rail-pistol'
export type BuildKind = 'wall' | 'ramp' | 'platform'
export type GameMode = 'solo-bots' | 'coop-bots' | 'pvp' | 'pvp-bots'
export type Difficulty = 'easy' | 'normal' | 'hard'
export type EnemyVariant = 'standard-mutant' | 'berserker-mutant' | 'stalker-mutant' | 'infected-mutant' | 'king-mutant' | 'scout-drone' | 'attack-drone' | 'support-drone'
export type InventoryItem = 'medkit' | 'shield-cell' | 'water' | 'life-credit'

export const BOMB = {
  fuseMs: 3000,
  blastRadius: 11,
  maxDamage: 90,
  throwSpeed: 15,
  startingCount: 2
} as const

export const DIFFICULTY = {
  easy: { enemyCount: 40, damage: 0.35, detection: 0.62, speed: 0.78, reinforcementDelay: 9000, reinforcementCap: 0 },
  normal: { enemyCount: 40, damage: 0.55, detection: 0.9, speed: 0.95, reinforcementDelay: 7000, reinforcementCap: 0 },
  hard: { enemyCount: 40, damage: 0.8, detection: 1.2, speed: 1.12, reinforcementDelay: 5000, reinforcementCap: 0 }
} as const

export const ENEMIES: Record<EnemyVariant, { name: string; family: 'mutant' | 'drone'; hp: number; speed: number; damage: number; range: number; detection: number }> = {
  'standard-mutant': { name: 'Standard Mutant', family: 'mutant', hp: 180, speed: 7.2, damage: 18, range: 2.2, detection: 55 },
  'berserker-mutant': { name: 'Berserker Mutant', family: 'mutant', hp: 340, speed: 6.4, damage: 34, range: 3.2, detection: 58 },
  'stalker-mutant': { name: 'Stalker Mutant', family: 'mutant', hp: 125, speed: 8.8, damage: 16, range: 2, detection: 58 },
  'infected-mutant': { name: 'Infected Mutant', family: 'mutant', hp: 165, speed: 5.8, damage: 14, range: 18, detection: 55 },
  // v75: King Mutant is the boss mutant: roughly x2 Standard Mutant combat settings, ranged-only.
  'king-mutant': { name: 'King Mutant', family: 'mutant', hp: 360, speed: 7.2, damage: 36, range: 22, detection: 110 },
  'scout-drone': { name: 'Scout Drone', family: 'drone', hp: 75, speed: 8.2, damage: 5, range: 24, detection: 68 },
  'attack-drone': { name: 'Attack Drone', family: 'drone', hp: 135, speed: 6.2, damage: 12, range: 30, detection: 58 },
  'support-drone': { name: 'Support Drone', family: 'drone', hp: 155, speed: 5.2, damage: 6, range: 25, detection: 64 }
}

const BASE_AVATAR_URN = 'urn:decentraland:off-chain:base-avatars:'
const mutantWearables = (...items: string[]) => items.map((item) => `${BASE_AVATAR_URN}${item}`)

export const MUTANT_AVATARS = {
  'standard-mutant': {
    skin: { r: 0.35, g: 0.36, b: 0.32 }, eye: { r: 1, g: 0.03, b: 0.02 }, hair: { r: 0.08, g: 0.07, b: 0.06 },
    wearables: mutantWearables('eyebrows_07', 'mouth_03', 'eyes_08', 'black_tshirt', 'cargo_pants', 'sport_shoes', 'mohawk'),
    attackEmote: 'swingWeaponOneHand'
  },
  'berserker-mutant': {
    skin: { r: 0.43, g: 0.29, b: 0.24 }, eye: { r: 1, g: 0, b: 0 }, hair: { r: 0.05, g: 0.04, b: 0.03 },
    wearables: mutantWearables('eyebrows_06', 'mouth_04', 'eyes_09', 'red_tshirt', 'brown_pants', 'classic_shoes', 'bald'),
    attackEmote: 'swingWeaponTwoHands'
  },
  'stalker-mutant': {
    skin: { r: 0.19, g: 0.21, b: 0.19 }, eye: { r: 0.95, g: 0.02, b: 0.02 }, hair: { r: 0.03, g: 0.03, b: 0.03 },
    wearables: mutantWearables('eyebrows_05', 'mouth_02', 'eyes_10', 'striped_shirt', 'shorts', 'sneakers', 'short_hair'),
    attackEmote: 'punch'
  },
  'king-mutant': {
    skin: { r: 0.48, g: 0.22, b: 0.16 }, eye: { r: 1, g: 0.02, b: 0 }, hair: { r: 0.05, g: 0.03, b: 0.02 },
    wearables: mutantWearables('eyebrows_06', 'mouth_04', 'eyes_09', 'red_tshirt', 'cargo_pants', 'classic_shoes', 'mohawk'),
    attackEmote: 'throw'
  },
  'infected-mutant': {
    skin: { r: 0.36, g: 0.48, b: 0.18 }, eye: { r: 1, g: 0.08, b: 0 }, hair: { r: 0.13, g: 0.16, b: 0.06 },
    wearables: mutantWearables('eyebrows_04', 'mouth_04', 'eyes_11', 'green_tshirt', 'cargo_pants', 'sport_shoes', 'cool_hair'),
    attackEmote: 'throw'
  }
} as const

export const COMBAT_LAND_ZONES = [
  // v57: combat-only land/building clusters. The Outpost is intentionally excluded.
  { name: 'Exodus City', x: 240, z: 216, halfWidth: 14, halfDepth: 14 },
  { name: 'The Arena', x: 240, z: 80, halfWidth: 14, halfDepth: 12 },
  { name: 'The Ruins', x: 111, z: 296, halfWidth: 13, halfDepth: 13 },
  { name: 'The Plant', x: 270, z: 384, halfWidth: 14, halfDepth: 13 },
  { name: 'The Docks', x: 387, z: 285, halfWidth: 13, halfDepth: 13 },
  { name: 'Scavenger Camp', x: 384, z: 107, halfWidth: 13, halfDepth: 12 },
  { name: 'The Beach', x: 360, z: 384, halfWidth: 12, halfDepth: 12 }
] as const

export function isInsideCombatLand(position: { x: number; z: number }) {
  return COMBAT_LAND_ZONES.some((zone) =>
    Math.abs(position.x - zone.x) <= zone.halfWidth &&
    Math.abs(position.z - zone.z) <= zone.halfDepth
  )
}

export const ENEMY_SPAWN_ZONES = COMBAT_LAND_ZONES.flatMap((zone, index) => [
  { x: zone.x, z: zone.z, family: 'mutant' as const, zoneIndex: index },
  // Offset drone anchors so a drone and mutant never begin on the exact same point.
  { x: zone.x + 0.8, z: zone.z + 0.8, family: 'drone' as const, zoneIndex: index }
])

// v75 mutant navigation surfaces. These match the authored/rebuilt bridge center-lines.
export const MUTANT_BRIDGES = [
  { a:{x:145,z:145}, b:{x:190,z:184} }, // Outpost -> City (mutants never enter Outpost)
  { a:{x:240,z:126}, b:{x:240,z:165} }, // Arena -> City
  { a:{x:337,z:145}, b:{x:293,z:182} }, // Camp -> City
  { a:{x:142,z:282}, b:{x:187,z:246} }, // Ruins -> City
  { a:{x:338,z:270}, b:{x:296,z:243} }, // Docks -> City
  { a:{x:304,z:355}, b:{x:353,z:314} }, // Plant -> Docks
  { a:{x:238,z:264}, b:{x:262,z:338} }  // City -> Plant
] as const

function segmentDistance2D(x:number,z:number,ax:number,az:number,bx:number,bz:number){
  const dx=bx-ax,dz=bz-az,l2=dx*dx+dz*dz;if(l2<=.0001)return Math.hypot(x-ax,z-az)
  const t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/l2)),px=ax+t*dx,pz=az+t*dz
  return Math.hypot(x-px,z-pz)
}
export function isOnMutantBridge(position:{x:number;z:number}){
  return MUTANT_BRIDGES.some(r=>segmentDistance2D(position.x,position.z,r.a.x,r.a.z,r.b.x,r.b.z)<=4.35)
}
// v103: IslandTerrain.glb is the Mutant/King walking floor.  The older code only
// treated the small building/combat rectangles as land, which made normal mutants
// drop to the river floor while they were still standing on the island mesh.
// These footprints follow the authored island shorelines/bridge approaches.
export const MUTANT_ISLAND_GROUND = [
  { name:'Outpost Island', x:96,  z:112, rx:55, rz:51 },
  { name:'Exodus City Island', x:240, z:216, rx:53, rz:52 },
  { name:'Arena Island', x:240, z:80,  rx:48, rz:48 },
  { name:'Scavenger Island', x:384, z:107, rx:49, rz:48 },
  { name:'Ruins Island', x:111, z:296, rx:42, rz:42 },
  { name:'Docks Island', x:387, z:285, rx:51, rz:46 },
  { name:'Plant Island', x:270, z:384, rx:48, rz:47 },
  { name:'Beach Island', x:360, z:384, rx:43, rz:42 }
] as const
export function isOnMutantIslandGround(position:{x:number;z:number}){
  return MUTANT_ISLAND_GROUND.some(i=>{const dx=(position.x-i.x)/(i.rx*1.08),dz=(position.z-i.z)/(i.rz*1.08);return dx*dx+dz*dz<=1})
}
export function mutantSurfaceY(position:{x:number;z:number}){
  // Normal mutants and Kings share exactly the same feet/root height on IslandTerrain.glb.
  // The low level is used only after a mutant has actually left island/bridge ground and fallen into water.
  // v143: measured from the live scene debug panel: IslandTerrain center = 1.3m, shoreline/water = 1.2m.
  // IslandTerrain.glb is the only authoritative island floor for Mutants/Kings.
  // v169: rebuilt bridge road top is ~2.18m. Keep mutant feet on the deck instead of island/water height.
  if(isOnMutantBridge(position)) return 2.18
  const island=MUTANT_ISLAND_GROUND.find(i=>{const dx=(position.x-i.x)/(i.rx*1.08),dz=(position.z-i.z)/(i.rz*1.08);return dx*dx+dz*dz<=1})
  if(island){const radial=Math.min(1,Math.hypot((position.x-island.x)/island.rx,(position.z-island.z)/island.rz));return 1.30-.10*Math.max(0,(radial-.55)/.45)}
  return 1.20
}
function landIndex(p:{x:number;z:number}){return COMBAT_LAND_ZONES.findIndex(z=>Math.abs(p.x-z.x)<=z.halfWidth&&Math.abs(p.z-z.z)<=z.halfDepth)}
export function mutantNavigationTarget(current:{x:number;z:number}, target:{x:number;z:number}){
  const ci=landIndex(current),ti=landIndex(target)
  if(ci>=0&&ci===ti)return {x:target.x,z:target.z}
  // v105 bridge traversal: once a mutant enters a bridge corridor, commit to crossing it.
  // Choosing an endpoint only from the target distance could make the mutant repeatedly
  // select the endpoint under its own feet and freeze on the bridge. Pick the opposite
  // endpoint from the mutant instead; near an exit, release it back to normal routing.
  for(const r of MUTANT_BRIDGES) if(segmentDistance2D(current.x,current.z,r.a.x,r.a.z,r.b.x,r.b.z)<=4.6){
    const ca=Math.hypot(current.x-r.a.x,current.z-r.a.z),cb=Math.hypot(current.x-r.b.x,current.z-r.b.z)
    const exit=ca<cb?r.b:r.a
    if(Math.hypot(current.x-exit.x,current.z-exit.z)>2.4)return {x:exit.x,z:exit.z}
  }
  // From land, use the bridge entrance nearest the mutant whose opposite end makes progress toward target.
  let best:{x:number;z:number}|undefined,bestScore=Infinity
  for(const r of MUTANT_BRIDGES){for(const pair of [[r.a,r.b],[r.b,r.a]] as const){const [near,far]=pair
    const approach=Math.hypot(current.x-near.x,current.z-near.z),after=Math.hypot(target.x-far.x,target.z-far.z)
    const score=approach+after*.72;if(score<bestScore){bestScore=score;best={x:near.x,z:near.z}}
  }}
  return best??{x:target.x,z:target.z}
}

export const LOCATIONS = {
  outpost: { name: 'The Outpost', x: 96, z: 112 },
  city: { name: 'Exodus City', x: 240, z: 216 },
  arena: { name: 'The Arena', x: 240, z: 80 },
  camp: { name: 'Scavenger Camp', x: 384, z: 107 },
  ruins: { name: 'The Ruins', x: 111, z: 296 },
  plant: { name: 'The Plant', x: 270, z: 384 },
  docks: { name: 'The Docks', x: 387, z: 285 },
  beach: { name: 'The Beach', x: 360, z: 384 }
} as const

export type LocationId = keyof typeof LOCATIONS

export const MISSIONS = {
  'reach-city': { name: 'Reach Exodus City', target: 'city', rewardMaterials: 8 },
  'reach-arena': { name: 'Reach the Arena', target: 'arena', rewardMaterials: 10 },
  'reach-docks': { name: 'Reach the Docks', target: 'docks', rewardMaterials: 12 }
} as const

export type MissionId = keyof typeof MISSIONS
export const MISSION_ORDER: MissionId[] = ['reach-city', 'reach-arena', 'reach-docks']

export const INTERIOR_LOOT_SPAWNS = COMBAT_LAND_ZONES.flatMap((zone, zoneIndex) => {
  // v62: pickups sit in clear perimeter lanes around island/building meshes instead of through walls.
  // Each point is unique, one-by-one, and stays away from the Outpost interior.
  return Array.from({ length: 12 }, (_, slot) => {
    const edge=(slot+zoneIndex)%4
    const u=((((zoneIndex+7)*89 + slot*67 + slot*slot*11)%947)/946)*2-1
    const inset=2.2 + ((slot*13+zoneIndex*5)%4)*0.45
    if(edge===0)return {x:zone.x+u*(zone.halfWidth-inset),y:1.05,z:zone.z-zone.halfDepth+inset}
    if(edge===1)return {x:zone.x+zone.halfWidth-inset,y:1.05,z:zone.z+u*(zone.halfDepth-inset)}
    if(edge===2)return {x:zone.x+u*(zone.halfWidth-inset),y:1.05,z:zone.z+zone.halfDepth-inset}
    return {x:zone.x-zone.halfWidth+inset,y:1.05,z:zone.z+u*(zone.halfDepth-inset)}
  })
})

export const FRONTIER_LOOT_SPAWNS = INTERIOR_LOOT_SPAWNS
export const PANDORA_BOX_SPAWNS = [3,13,23,33,43,53,63].map((index) => INTERIOR_LOOT_SPAWNS[index])

// Bridges also carry loot, but at wide intervals so pickups appear individually rather than in piles.
const bridgeTrail = (ax:number, az:number, bx:number, bz:number, count:number) => Array.from({length:count}, (_,i) => {
  const t=(i+1)/(count+1)
  const side=-1.45
  const dx=bx-ax, dz=bz-az, len=Math.max(1,Math.hypot(dx,dz))
  return {x:ax+dx*t+(-dz/len)*side, y:2.75, z:az+dz*t+(dx/len)*side}
})
export const BRIDGE_LOOT_SPAWNS = [
  ...bridgeTrail(145,145,190,184,4),
  ...bridgeTrail(240,126,240,165,4),
  ...bridgeTrail(337,145,293,182,4),
  ...bridgeTrail(142,282,187,246,4),
  ...bridgeTrail(338,270,296,243,4),
  ...bridgeTrail(304,355,353,314,4),
  ...bridgeTrail(238,264,262,338,5)
]

// Shuffle the fixed safe positions deterministically so every new scene load feels scattered
// without allowing two pickups to occupy the same location.
const LOOT_POOL = [...INTERIOR_LOOT_SPAWNS, ...BRIDGE_LOOT_SPAWNS]
export const WORLD_LOOT_SPAWNS = LOOT_POOL
  .map((p,index)=>({p,key:(index*73+index*index*17+41)%1009}))
  .sort((a,b)=>a.key-b.key)
  .map(({p})=>p)

export type WeaponDefinition = {
  id: WeaponId
  name: string
  damage: number
  range: number
  fireDelayMs: number
  magazine: number
  ammoField: 'ammoRifle' | 'ammoShotgun' | 'ammoPistol'
  magazineField: 'magazineRifle' | 'magazineShotgun' | 'magazinePistol'
  fireMode: string
}

export const WEAPONS: Record<WeaponId, WeaponDefinition> = {
  'pulse-rifle': {
    id: 'pulse-rifle',
    name: 'Pulse Rifle',
    damage: 22,
    range: 70,
    fireDelayMs: 190,
    magazine: 30,
    ammoField: 'ammoRifle',
    magazineField: 'magazineRifle',
    fireMode: 'AUTO'
  },
  scattergun: {
    id: 'scattergun',
    name: 'Scattergun',
    damage: 48,
    range: 18,
    fireDelayMs: 850,
    magazine: 8,
    ammoField: 'ammoShotgun',
    magazineField: 'magazineShotgun',
    fireMode: 'PUMP'
  },
  'rail-pistol': {
    id: 'rail-pistol',
    name: 'Rail Pistol',
    damage: 34,
    range: 50,
    fireDelayMs: 430,
    magazine: 12,
    ammoField: 'ammoPistol',
    magazineField: 'magazinePistol',
    fireMode: 'SEMI'
  }
}

export function isWeaponId(value: string): value is WeaponId {
  return value === 'pulse-rifle' || value === 'scattergun' || value === 'rail-pistol'
}

export function isBuildKind(value: string): value is BuildKind {
  return value === 'wall' || value === 'ramp' || value === 'platform'
}

export function isGameMode(value: string): value is GameMode {
  return value === 'solo-bots' || value === 'coop-bots' || value === 'pvp' || value === 'pvp-bots'
}

export function isDifficulty(value: string): value is Difficulty {
  return value === 'easy' || value === 'normal' || value === 'hard'
}

export function isInventoryItem(value: string): value is InventoryItem {
  return value === 'medkit' || value === 'shield-cell' || value === 'water' || value === 'life-credit'
}

export function isMissionId(value: string): value is MissionId {
  return value === 'reach-city' || value === 'reach-arena' || value === 'reach-docks'
}
