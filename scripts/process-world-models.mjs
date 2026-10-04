import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const inputRoot = process.argv[2]
const outputRoot = process.argv[3] ?? new URL('../assets/Models/', import.meta.url).pathname
if (!inputRoot) throw new Error('Usage: node scripts/process-world-models.mjs <input-folder> [output-folder]')

const files = [
  ['outpost', 'OutPost(2).glb', 'OutPost.glb'],
  ['ruins', 'racks_actual.glb', 'Ruins.glb']
]

const palette = {
  ocean: [[0.018, 0.24, 0.43, 1], 0.05, 0.28],
  sand: [[0.62, 0.46, 0.23, 1], 0.02, 0.9],
  grass: [[0.12, 0.34, 0.15, 1], 0.01, 0.94],
  pine: [[0.045, 0.23, 0.10, 1], 0.01, 0.92],
  pineLight: [[0.12, 0.39, 0.15, 1], 0.01, 0.92],
  wood: [[0.29, 0.16, 0.065, 1], 0.02, 0.88],
  rock: [[0.28, 0.30, 0.32, 1], 0.04, 0.88],
  concrete: [[0.36, 0.37, 0.36, 1], 0.06, 0.82],
  dusty: [[0.39, 0.34, 0.28, 1], 0.03, 0.9],
  road: [[0.075, 0.085, 0.09, 1], 0.12, 0.75],
  charcoal: [[0.035, 0.045, 0.055, 1], 0.58, 0.34],
  steel: [[0.16, 0.19, 0.21, 1], 0.72, 0.28],
  rust: [[0.46, 0.16, 0.055, 1], 0.45, 0.66],
  orange: [[0.95, 0.25, 0.025, 1], 0.38, 0.35],
  red: [[0.72, 0.025, 0.02, 1], 0.28, 0.42],
  cyan: [[0.01, 0.56, 0.95, 1], 0.12, 0.24, [0.01, 0.34, 0.85], 2.5],
  amber: [[1.0, 0.43, 0.035, 1], 0.08, 0.25, [1.0, 0.22, 0.01], 3],
  blue: [[0.035, 0.20, 0.42, 1], 0.5, 0.31],
  tan: [[0.55, 0.42, 0.25, 1], 0.12, 0.72],
  olive: [[0.24, 0.28, 0.13, 1], 0.04, 0.88],
  snow: [[0.78, 0.84, 0.86, 1], 0.01, 0.94],
  black: [[0.008, 0.012, 0.016, 1], 0.65, 0.22]
}

function hash(name) {
  let value = 2166136261
  for (const character of name) value = Math.imul(value ^ character.charCodeAt(0), 16777619)
  return value >>> 0
}

function common(name) {
  const n = name.toLowerCase()
  if (/fire|torchglow/.test(n)) return 'amber'
  if (/glow|doorlight|lamphead|lampglow|screen|light/.test(n)) return 'cyan'
  if (/snow/.test(n)) return 'snow'
  if (/(tree|pine).*(trunk)|trunk/.test(n)) return 'wood'
  if (/(tree|pine).*(top|low)|^(tree|pine)/.test(n)) return hash(n) % 2 ? 'pine' : 'pineLight'
  if (/rock|cliff|mountain|peak/.test(n)) return 'rock'
  if (/banner|flag|warning/.test(n)) return 'red'
  if (/antenna|yellowedge|stackband/.test(n)) return 'orange'
  if (/roof|wheel|rail|mast|cable/.test(n)) return 'charcoal'
  if (/floor|ramp|road|ground|pad|bridge/.test(n)) return 'concrete'
  if (/front|rear|side|header|wall|post|leg|deck|fence/.test(n)) return hash(n) % 3 ? 'steel' : 'concrete'
  return undefined
}

function classify(kind, name) {
  const n = name.toLowerCase()
  if (kind === 'outpost') {
    if (/glass|window/.test(n)) return 'cyan'
    if (/door|light|screen|terminal/.test(n)) return 'cyan'
    if (/warning|stripe|accent/.test(n)) return 'orange'
    if (/floor|ground|foundation|concrete/.test(n)) return 'concrete'
    if (/wall|roof|beam|frame|column|metal/.test(n)) return hash(n) % 3 === 0 ? 'rust' : 'steel'
    return common(name) ?? (hash(n) % 4 === 0 ? 'rust' : 'steel')
  }
  if (kind === 'terrain') {
    if (n === 'ocean') return 'ocean'
    if (/grass/.test(n)) return 'grass'
    if (/sand/.test(n)) return 'sand'
    if (/pine.*trunk/.test(n)) return 'wood'
    if (/pine.*low/.test(n)) return 'pine'
    if (/pine.*top/.test(n)) return 'pineLight'
    return /cliff|rock/.test(n) ? 'rock' : 'grass'
  }
  if (kind === 'arena') {
    if (/arenasand/.test(n)) return 'sand'
    if (/islandbase/.test(n)) return 'rock'
    if (/torch/.test(n)) return /glow/.test(n) ? 'amber' : 'rust'
    if (/seat/.test(n)) return 'charcoal'
    if (/banner|crest/.test(n)) return 'red'
    return common(name) ?? (hash(n) % 4 === 0 ? 'rust' : 'steel')
  }
  if (kind === 'city') {
    if (/cityground|^road|^bridge/.test(n)) return 'road'
    if (/glow/.test(n)) return 'cyan'
    if (/spire|antenna/.test(n)) return 'orange'
    if (/tier/.test(n)) return 'steel'
    return common(name) ?? (hash(n) % 3 === 0 ? 'tan' : 'steel')
  }
  if (kind === 'plant') {
    if (/plantground/.test(n)) return 'concrete'
    if (/^road/.test(n)) return 'road'
    if (/blue|reactor/.test(n)) return /brace|base|bottom|top/.test(n) ? 'steel' : 'blue'
    if (/pipe.*glow|doorlight|lampglow/.test(n)) return 'cyan'
    if (/pipe|truck/.test(n)) return hash(n) % 2 ? 'rust' : 'steel'
    if (/stackband/.test(n)) return 'orange'
    return common(name) ?? 'steel'
  }
  if (kind === 'camp') {
    if (/campground|entrypath/.test(n)) return 'sand'
    if (/canopy|sandbag/.test(n)) return 'olive'
    if (/crate/.test(n)) return hash(n) % 3 ? 'wood' : 'rust'
    if (/barrel/.test(n)) return hash(n) % 3 ? 'blue' : 'orange'
    if (/fire/.test(n)) return /stone/.test(n) ? 'rock' : 'amber'
    if (/fence/.test(n)) return 'rust'
    if (/truck/.test(n)) return hash(n) % 2 ? 'rust' : 'steel'
    return common(name) ?? (hash(n) % 3 === 0 ? 'tan' : 'steel')
  }
  if (kind === 'docks') {
    if (n === 'water') return 'ocean'
    if (/pier|deck|post/.test(n)) return /post/.test(n) ? 'wood' : 'steel'
    if (/container/.test(n)) return ['rust', 'blue', 'orange', 'olive'][hash(n) % 4]
    if (/crane/.test(n)) return 'orange'
    if (/ship|tug/.test(n)) return /hull/.test(n) ? 'rust' : 'steel'
    if (/truck|forklift/.test(n)) return hash(n) % 2 ? 'orange' : 'rust'
    return common(name) ?? 'steel'
  }
  if (kind === 'ruins') {
    if (/compound|^road/.test(n)) return 'dusty'
    if (/yellowedge/.test(n)) return 'orange'
    if (/sandbag|canopy/.test(n)) return 'olive'
    if (/crate/.test(n)) return hash(n) % 3 ? 'wood' : 'rust'
    if (/truck/.test(n)) return hash(n) % 2 ? 'rust' : 'steel'
    if (/lamphead/.test(n)) return 'cyan'
    if (/bunker|hq|watch|gate/.test(n)) return common(name) ?? (hash(n) % 4 === 0 ? 'rust' : 'concrete')
    return common(name) ?? 'dusty'
  }
  return common(name) ?? 'steel'
}

function material(name) {
  const [baseColorFactor, metallicFactor, roughnessFactor, emissiveFactor, emissiveStrength] = palette[name]
  const value = {
    name: `PX_${name}`,
    doubleSided: true,
    pbrMetallicRoughness: { baseColorFactor, metallicFactor, roughnessFactor }
  }
  if (emissiveFactor) {
    value.emissiveFactor = emissiveFactor
    value.extensions = { KHR_materials_emissive_strength: { emissiveStrength } }
  }
  return value
}

function readGlb(buffer) {
  if (buffer.toString('utf8', 0, 4) !== 'glTF') throw new Error('Input is not a binary GLB')
  const jsonLength = buffer.readUInt32LE(12)
  return { json: JSON.parse(buffer.toString('utf8', 20, 20 + jsonLength)), tail: buffer.subarray(20 + jsonLength) }
}

function writeGlb(json, tail) {
  const serialized = Buffer.from(JSON.stringify(json), 'utf8')
  const paddedLength = Math.ceil(serialized.length / 4) * 4
  const jsonChunk = Buffer.alloc(paddedLength, 0x20)
  serialized.copy(jsonChunk)
  const output = Buffer.alloc(20 + paddedLength + tail.length)
  output.write('glTF', 0)
  output.writeUInt32LE(2, 4)
  output.writeUInt32LE(output.length, 8)
  output.writeUInt32LE(paddedLength, 12)
  output.writeUInt32LE(0x4e4f534a, 16)
  jsonChunk.copy(output, 20)
  tail.copy(output, 20 + paddedLength)
  return output
}

await mkdir(outputRoot, { recursive: true })
for (const [kind, inputName, outputName] of files) {
  const { json, tail } = readGlb(await readFile(join(inputRoot, inputName)))
  if (kind === 'terrain') {
    // Keep the forested silhouettes while opening a buildable clearing at each landmark centre.
    const clearings = [
      [-9, 8, 3.0], [0, 10, 3.0], [9, 8.3, 2.7], [0, 1.5, 3.7],
      [-9.2, -3.5, 2.9], [-1.8, -9, 2.8], [9.2, -2.8, 3.1], [7.5, -9, 2.3]
    ]
    const rootIndex = json.scenes?.[json.scene ?? 0]?.nodes?.[0]
    const root = rootIndex === undefined ? undefined : json.nodes[rootIndex]
    if (root?.children) {
      root.children = root.children.filter((nodeIndex) => {
        const node = json.nodes[nodeIndex]
        if (!/pine/i.test(node.name ?? '') || node.mesh === undefined) return true
        const primitive = json.meshes[node.mesh]?.primitives?.[0]
        const accessor = primitive ? json.accessors[primitive.attributes?.POSITION] : undefined
        if (!accessor?.min || !accessor?.max) return true
        const x = (accessor.min[0] + accessor.max[0]) / 2
        const y = (accessor.min[1] + accessor.max[1]) / 2
        return !clearings.some(([cx, cy, radius]) => Math.hypot(x - cx, y - cy) < radius)
      })
    }
  }
  if (kind === 'ruins') {
    const root = json.scenes?.[json.scene ?? 0]?.nodes?.[0]
    if (root !== undefined) json.nodes[root].rotation = [-0.70710678, 0, 0, 0.70710678]
  }
  const assignments = json.meshes.map((mesh) => classify(kind, mesh.name ?? ''))
  const used = [...new Set(assignments)].sort()
  const indexByName = new Map(used.map((name, index) => [name, index]))
  json.materials = used.map(material)
  for (let meshIndex = 0; meshIndex < json.meshes.length; meshIndex += 1) {
    const materialIndex = indexByName.get(assignments[meshIndex])
    for (const primitive of json.meshes[meshIndex].primitives) primitive.material = materialIndex
  }
  if (used.some((name) => palette[name][3])) {
    json.extensionsUsed = [...new Set([...(json.extensionsUsed ?? []), 'KHR_materials_emissive_strength'])]
  }
  const output = writeGlb(json, tail)
  await writeFile(join(outputRoot, outputName), output)
  console.log(`${outputName}: ${json.meshes.length} meshes, ${used.length} shared materials, ${(output.length / 1024).toFixed(1)} KiB`)
}
