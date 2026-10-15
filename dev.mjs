import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const viteArgs = process.argv.slice(2)
const children = [
  spawn(process.execPath, [path.join(root, 'server.js')], { cwd: root, stdio: 'inherit', env: process.env }),
  spawn(process.execPath, [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), ...viteArgs], { cwd: root, stdio: 'inherit', env: process.env }),
]
let stopping = false
function stop() {
  if (stopping) return
  stopping = true
  children.forEach((child) => child.kill())
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
children.forEach((child) => child.on('exit', (code) => { if (code && !stopping) { stop(); process.exitCode = code } }))
