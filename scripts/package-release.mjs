import { createWriteStream } from 'node:fs'
import { fileURLToPath } from 'node:url'
import archiver from 'archiver'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const outputPath = fileURLToPath(new URL('../../project-exodus-30x30.zip', import.meta.url))
const output = createWriteStream(outputPath)
const archive = archiver('zip', { zlib: { level: 9 } })

const completed = new Promise((resolve, reject) => {
  output.on('close', resolve)
  output.on('error', reject)
  archive.on('error', reject)
})

archive.pipe(output)
archive.glob('**/*', {
  cwd: projectRoot,
  dot: true,
  ignore: ['node_modules/**', 'bin/**', '.git/**', '*.log']
}, { prefix: 'project-exodus/' })
await archive.finalize()
await completed

console.log(`Created ${outputPath} (${archive.pointer()} bytes)`)
