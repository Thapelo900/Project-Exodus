import { access, readFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const scene = JSON.parse(await readFile(new URL('scene.json', root), 'utf8'))
const composite = JSON.parse(await readFile(new URL('assets/scene/main.composite', root), 'utf8'))

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

assert(scene.runtimeVersion === '7', 'Scene must target SDK 7')
assert(scene.authoritativeMultiplayer === true, 'Multiplayer Server must be enabled')
assert(scene.worldConfiguration?.name === 'aurethegard.dcl.eth', 'Unexpected World NAME')
assert(scene.scene?.parcels?.length === 900, 'Expected a 30x30 parcel layout')
assert(new Set(scene.scene.parcels).size === 900, 'Parcel coordinates must be unique')
assert(scene.requiredPermissions?.includes('USE_WEBSOCKET'), 'WebSocket permission is required')
await access(new URL(scene.display.navmapThumbnail, root))
for (const model of ['OutPost.glb','IslandTerrain.glb','Arena.glb','ExodusCity.glb','ScavengerCamp.glb','Ruins.glb','Plant.glb','Docks.glb']) await access(new URL(`assets/Models/${model}`, root))
await access(new URL('images/outpost-interior-map.png', root))
for (const asset of ['images/loot-medkit.png','images/loot-water.png','images/loot-ammo.png','images/loot-bomb.png','images/ui/weapon-rifle.png','images/ui/weapon-pistol.png','images/ui/weapon-shotgun.png']) await access(new URL(asset, root))

const components = new Map(composite.components.map((component) => [component.name, component]))
const transforms = components.get('core::Transform')?.data ?? {}
const gltfs = components.get('core::GltfContainer')?.data ?? {}
const names = components.get('core-schema::Name')?.data ?? {}
const nodes = components.get('inspector::Nodes')?.data?.['0']?.json?.value ?? []
const nodeIds = new Set(nodes.map((node) => node.entity))
const rootNode = nodes.find((node) => node.entity === 0)

assert(Object.keys(transforms).length >= 110, 'Island redesign should contain at least 110 top-level static entities')
assert(Object.keys(gltfs).length === 8, 'Expected terrain, Outpost and six supplied regional GLBs')
assert(rootNode, 'Creator Hub root node is missing')
const entityNames = Object.values(names).map((wrapped) => wrapped.json?.value ?? '')
for (const landmark of ['Outpost GLB', 'Outpost Shop Terminal', 'Outpost Mission Board', 'Outpost Inventory Terminal', 'Island Terrain GLB', 'Exodus City GLB', 'Arena GLB', 'Scavenger Camp GLB', 'Ruins GLB', 'Plant GLB', 'Docks GLB', 'Beach Sand']) {
  assert(entityNames.includes(landmark), `Missing landmark: ${landmark}`)
}
assert(entityNames.filter((name) => name.endsWith('Bridge Deck')).length === 7, 'Expected seven inter-region bridge decks')
assert(entityNames.includes('Beach Shelter Door Lintel'), 'Beach shelter must retain its open entrance')
assert(!entityNames.some((name) => / Block \d+$/.test(name)), 'Legacy solid building blocks must not remain')

for (const [id, wrapped] of Object.entries(transforms)) {
  const numericId = Number(id)
  const transform = wrapped.json
  assert(names[id]?.json?.value, `Entity ${id} has no Creator Hub name`)
  assert(nodeIds.has(numericId), `Entity ${id} is missing from Creator Hub Nodes`)
  assert(rootNode.children.includes(numericId), `Entity ${id} is not registered under RootEntity`)
  assert(transform.position.x >= 0 && transform.position.x <= 480, `Entity ${id} is outside X bounds`)
  assert(transform.position.z >= 0 && transform.position.z <= 480, `Entity ${id} is outside Z bounds`)
  assert(transform.position.y >= 0 || names[id]?.json?.value === 'Island Terrain GLB', `Entity ${id} is below ground`)
}

console.log(`Validated SDK 7 World, 900 parcels and ${Object.keys(transforms).length} Creator Hub entities`)
