import fs from 'node:fs'
import path from 'node:path'
import { PNG } from 'pngjs'

const sourcePath = process.argv[2] ?? 'images/project-exodus-loot-sheet.png'
const image = PNG.sync.read(fs.readFileSync(sourcePath))
const halfWidth = Math.floor(image.width / 2)
const halfHeight = Math.floor(image.height / 2)
const icons = [
  ['loot-medkit', 0, 0],
  ['loot-water', halfWidth, 0],
  ['loot-ammo', 0, halfHeight],
  ['loot-bomb', halfWidth, halfHeight]
]

for (const [name, left, top] of icons) {
  const output = new PNG({ width: halfWidth, height: halfHeight })
  PNG.bitblt(image, output, left, top, halfWidth, halfHeight, 0, 0)
  fs.writeFileSync(path.join('images', `${name}.png`), PNG.sync.write(output))
  console.log(`Generated images/${name}.png`)
}
