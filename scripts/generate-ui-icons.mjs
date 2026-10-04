import { mkdir, writeFile } from 'node:fs/promises'
import { deflateSync } from 'node:zlib'

const output = new URL('../images/ui/', import.meta.url)
await mkdir(output, { recursive: true })

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const name = Buffer.from(type), length = Buffer.alloc(4), checksum = Buffer.alloc(4)
  length.writeUInt32BE(data.length); checksum.writeUInt32BE(crc32(Buffer.concat([name, data])))
  return Buffer.concat([length, name, data, checksum])
}
function png(size, paint) {
  const pixels = new Uint8Array(size * size * 4)
  const blend = (x, y, color) => {
    x = Math.round(x); y = Math.round(y)
    if (x < 0 || y < 0 || x >= size || y >= size) return
    const i = (y * size + x) * 4, a = (color[3] ?? 255) / 255
    pixels[i] = Math.round(color[0] * a + pixels[i] * (1 - a)); pixels[i + 1] = Math.round(color[1] * a + pixels[i + 1] * (1 - a)); pixels[i + 2] = Math.round(color[2] * a + pixels[i + 2] * (1 - a)); pixels[i + 3] = Math.min(255, Math.round((a + pixels[i + 3] / 255 * (1 - a)) * 255))
  }
  const line = (x0, y0, x1, y1, width, color) => {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2
    for (let i = 0; i <= steps; i++) { const t = steps ? i / steps : 0, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t; for (let yy = -width / 2; yy <= width / 2; yy++) for (let xx = -width / 2; xx <= width / 2; xx++) if (xx * xx + yy * yy <= width * width / 3) blend(x + xx, y + yy, color) }
  }
  const rect = (x, y, w, h, color) => { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) blend(xx, yy, color) }
  const circle = (cx, cy, radius, color, inner = 0) => { for (let y = cy - radius; y <= cy + radius; y++) for (let x = cx - radius; x <= cx + radius; x++) { const d = Math.hypot(x - cx, y - cy); if (d <= radius && d >= inner) blend(x, y, color) } }
  const polygon = (points, color) => { const minY = Math.floor(Math.min(...points.map(p => p[1]))), maxY = Math.ceil(Math.max(...points.map(p => p[1]))); for (let y = minY; y <= maxY; y++) for (let x = 0; x < size; x++) { let hit = false; for (let i = 0, j = points.length - 1; i < points.length; j = i++) { const a = points[i], b = points[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit } if (hit) blend(x, y, color) } }
  paint({ line, rect, circle, polygon, size })
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) { const row = y * (size * 4 + 1); raw[row] = 0; Buffer.from(pixels.buffer, y * size * 4, size * 4).copy(raw, row + 1) }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

const WHITE = [244, 247, 249, 255], DARK = [8, 11, 14, 255], RED = [230, 50, 50, 255], CYAN = [36, 188, 232, 255]
const AMBER = [241, 173, 53, 255], GREEN = [70, 184, 107, 255], BLUE = [85, 189, 234, 255], PURPLE = [190, 78, 233, 255]
const icons = {
  health: ({ rect }) => { rect(25, 9, 14, 46, RED); rect(9, 25, 46, 14, RED) },
  stamina: ({ polygon }) => polygon([[32, 5], [50, 31], [47, 47], [38, 57], [25, 58], [15, 49], [13, 36]], BLUE),
  hunger: ({ circle, line }) => { circle(25, 24, 14, AMBER); line(35, 35, 52, 53, 7, AMBER) },
  thirst: ({ rect, polygon }) => { rect(25, 6, 14, 8, GREEN); polygon([[22, 14], [42, 14], [46, 58], [18, 58]], GREEN) },
  players: ({ circle, polygon }) => { circle(24, 19, 9, WHITE); circle(44, 23, 7, WHITE); polygon([[8, 55], [12, 38], [24, 31], [36, 38], [39, 55]], WHITE); polygon([[35, 55], [38, 40], [47, 35], [57, 43], [59, 55]], WHITE) },
  skull: ({ circle, rect, polygon }) => { circle(32, 27, 19, WHITE); polygon([[17, 35], [47, 35], [43, 48], [37, 48], [35, 57], [29, 57], [27, 48], [21, 48]], WHITE); circle(25, 25, 5, DARK); circle(39, 25, 5, DARK); rect(29, 35, 6, 6, DARK) },
  clock: ({ circle, line }) => { circle(32, 32, 25, WHITE, 20); line(32, 32, 32, 17, 5, WHITE); line(32, 32, 43, 39, 5, WHITE) },
  rifle: ({ rect, polygon, circle }) => { rect(10, 25, 39, 10, WHITE); rect(42, 20, 11, 8, WHITE); rect(17, 19, 19, 5, WHITE); rect(49, 28, 11, 5, WHITE); polygon([[24, 34], [36, 34], [32, 51], [25, 51]], WHITE); polygon([[10, 26], [3, 32], [11, 38]], WHITE); circle(51, 35, 3, WHITE) },
  pistol: ({ rect, polygon }) => { rect(12, 19, 40, 13, WHITE); rect(49, 22, 10, 5, WHITE); polygon([[32, 31], [45, 31], [40, 55], [29, 55]], WHITE) },
  shotgun: ({ rect, polygon }) => { rect(7, 26, 50, 8, WHITE); rect(29, 18, 20, 6, WHITE); polygon([[13, 34], [26, 34], [19, 46], [7, 46]], WHITE) },
  medkit: ({ rect }) => { rect(9, 17, 46, 38, WHITE); rect(22, 9, 20, 10, WHITE); rect(27, 24, 10, 25, RED); rect(20, 31, 24, 10, RED) },
  water: ({ rect, polygon }) => { rect(25, 7, 14, 8, WHITE); polygon([[22, 15], [42, 15], [47, 57], [17, 57]], WHITE); rect(20, 36, 24, 18, BLUE) },
  outpost: ({ polygon, rect }) => { polygon([[7, 30], [32, 8], [57, 30]], CYAN); rect(13, 29, 38, 28, CYAN); rect(26, 39, 12, 18, DARK) },
  arena: ({ line, circle }) => { line(13, 12, 51, 52, 8, RED); line(51, 12, 13, 52, 8, RED); circle(32, 32, 27, RED, 23) },
  camp: ({ polygon, line }) => { polygon([[7, 53], [32, 10], [57, 53]], GREEN); polygon([[22, 53], [32, 30], [42, 53]], DARK); line(7, 53, 57, 53, 4, GREEN) },
  city: ({ rect }) => { rect(8, 25, 14, 32, AMBER); rect(25, 13, 16, 44, AMBER); rect(44, 31, 12, 26, AMBER) },
  ruins: ({ circle, polygon, rect }) => { circle(32, 26, 19, RED); polygon([[17, 35], [47, 35], [42, 54], [22, 54]], RED); circle(25, 25, 5, DARK); circle(39, 25, 5, DARK); rect(29, 36, 6, 7, DARK) },
  plant: ({ circle, rect }) => { circle(32, 32, 23, BLUE, 15); circle(32, 32, 8, BLUE); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; rect(28 + Math.cos(a) * 25, 28 + Math.sin(a) * 25, 8, 8, BLUE) } },
  docks: ({ line, circle }) => { line(32, 9, 32, 50, 6, PURPLE); circle(32, 12, 7, PURPLE, 3); line(13, 33, 32, 55, 6, PURPLE); line(51, 33, 32, 55, 6, PURPLE); line(10, 34, 20, 34, 5, PURPLE); line(44, 34, 54, 34, 5, PURPLE) },
  beach: ({ line, polygon }) => { line(31, 12, 31, 56, 5, AMBER); polygon([[30, 18], [8, 13], [23, 30]], AMBER); polygon([[33, 18], [56, 12], [41, 30]], AMBER); polygon([[30, 19], [14, 32], [31, 34]], AMBER) }
}

for (const [name, paint] of Object.entries(icons)) await writeFile(new URL(`${name}.png`, output), png(64, paint))
for (let direction = 0; direction < 8; direction++) await writeFile(new URL(`player-arrow-${direction}.png`, output), png(48, ({ polygon }) => { const angle = direction * Math.PI / 4; polygon([[24, 3], [42, 42], [24, 34], [6, 42]].map(([x, y]) => { const dx = x - 24, dy = y - 24; return [24 + dx * Math.cos(angle) - dy * Math.sin(angle), 24 + dx * Math.sin(angle) + dy * Math.cos(angle)] }), RED) }))
console.log(`Generated ${Object.keys(icons).length + 8} Project Exodus UI icons`)
