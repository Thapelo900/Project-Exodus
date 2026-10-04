import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'

const identity = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]

function multiply(a, b) {
  const out = new Array(16).fill(0)
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      for (let index = 0; index < 4; index += 1) out[column * 4 + row] += a[index * 4 + row] * b[column * 4 + index]
    }
  }
  return out
}

function nodeMatrix(node) {
  if (node.matrix) return node.matrix
  const [x, y, z, w] = node.rotation ?? [0, 0, 0, 1]
  const [sx, sy, sz] = node.scale ?? [1, 1, 1]
  const [tx, ty, tz] = node.translation ?? [0, 0, 0]
  const x2 = x + x, y2 = y + y, z2 = z + z
  const xx = x * x2, xy = x * y2, xz = x * z2
  const yy = y * y2, yz = y * z2, zz = z * z2
  const wx = w * x2, wy = w * y2, wz = w * z2
  return [
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    tx, ty, tz, 1
  ]
}

function transformPoint(matrix, [x, y, z]) {
  return [
    matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
    matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
    matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14]
  ]
}

function readJson(buffer) {
  if (buffer.toString('utf8', 0, 4) !== 'glTF') throw new Error('Not a binary GLB')
  const jsonLength = buffer.readUInt32LE(12)
  return JSON.parse(buffer.toString('utf8', 20, 20 + jsonLength))
}

function emptyBounds() {
  return { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }
}

function include(bounds, point) {
  for (let axis = 0; axis < 3; axis += 1) {
    bounds.min[axis] = Math.min(bounds.min[axis], point[axis])
    bounds.max[axis] = Math.max(bounds.max[axis], point[axis])
  }
}

function includeAccessor(bounds, accessor, matrix) {
  if (!accessor?.min || !accessor?.max) return
  for (const x of [accessor.min[0], accessor.max[0]]) {
    for (const y of [accessor.min[1], accessor.max[1]]) {
      for (const z of [accessor.min[2], accessor.max[2]]) include(bounds, transformPoint(matrix, [x, y, z]))
    }
  }
}

function formatBounds(bounds) {
  const size = bounds.max.map((value, index) => value - bounds.min[index])
  return {
    min: bounds.min.map((value) => Number(value.toFixed(3))),
    max: bounds.max.map((value) => Number(value.toFixed(3))),
    size: size.map((value) => Number(value.toFixed(3)))
  }
}

for (const file of process.argv.slice(2)) {
  const buffer = await readFile(file)
  const json = readJson(buffer)
  const bounds = emptyBounds()
  const roots = json.scenes?.[json.scene ?? 0]?.nodes ?? []
  let triangleCount = 0
  let primitiveCount = 0
  let meshNodeCount = 0
  const nodeSummaries = []
  const groupBounds = new Map()

  function visit(nodeIndex, parentMatrix, branchBounds = bounds) {
    const node = json.nodes[nodeIndex]
    const matrix = multiply(parentMatrix, nodeMatrix(node))
    const ownBounds = emptyBounds()
    if (node.mesh !== undefined) {
      meshNodeCount += 1
      const groupName = /^(CENTER|NW|NE|SE|N|S|E|W)_/.exec(node.name ?? '')?.[1]
      const grouped = groupName ? (groupBounds.get(groupName) ?? emptyBounds()) : undefined
      if (groupName && grouped) groupBounds.set(groupName, grouped)
      for (const primitive of json.meshes[node.mesh]?.primitives ?? []) {
        primitiveCount += 1
        const position = json.accessors[primitive.attributes?.POSITION]
        includeAccessor(bounds, position, matrix)
        includeAccessor(branchBounds, position, matrix)
        includeAccessor(ownBounds, position, matrix)
        if (grouped) includeAccessor(grouped, position, matrix)
        const indices = primitive.indices === undefined ? position?.count ?? 0 : json.accessors[primitive.indices]?.count ?? 0
        triangleCount += primitive.mode === 1 ? 0 : Math.floor(indices / 3)
      }
    }
    for (const child of node.children ?? []) visit(child, matrix, branchBounds)
    if (node.mesh !== undefined && Number.isFinite(ownBounds.min[0])) nodeSummaries.push({ name: node.name ?? `node-${nodeIndex}`, ...formatBounds(ownBounds) })
  }

  for (const root of roots) visit(root, identity())
  const colliderNames = [...(json.nodes ?? []), ...(json.meshes ?? [])].map((value) => value.name ?? '').filter((name) => /_collider/i.test(name))
  const report = {
    file: basename(file), bytes: buffer.length, ...formatBounds(bounds), nodes: json.nodes?.length ?? 0,
    meshNodes: meshNodeCount, meshes: json.meshes?.length ?? 0, primitives: primitiveCount,
    triangles: triangleCount, materials: json.materials?.length ?? 0, textures: json.textures?.length ?? 0,
    animations: (json.animations ?? []).map((animation) => animation.name ?? 'unnamed'), colliders: colliderNames,
    groups: Object.fromEntries([...groupBounds.entries()].map(([name, value]) => [name, formatBounds(value)])),
    largestNodes: nodeSummaries.sort((a, b) => (b.size[0] * b.size[1] * b.size[2]) - (a.size[0] * a.size[1] * a.size[2])).slice(0, 8)
  }
  console.log(JSON.stringify(report, null, 2))
}
