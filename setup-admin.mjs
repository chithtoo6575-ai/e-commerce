import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const envFile = path.join(root, '.env')
if (typeof process.loadEnvFile === 'function' && fs.existsSync(envFile)) process.loadEnvFile(envFile)
const accountFile = process.env.ADMIN_ACCOUNT_FILE ? path.resolve(process.env.ADMIN_ACCOUNT_FILE) : path.join(root, 'data', 'admin.json')
const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase()
const password = process.env.ADMIN_PASSWORD || ''

if (!email || !password) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD in .env or the process environment before running admin setup.')
if (!email.includes('@')) throw new Error('ADMIN_EMAIL must be a valid email address.')
if (password.length < 12) throw new Error('ADMIN_PASSWORD in .env must be at least 12 characters. Update it locally and run npm run admin:setup again.')
const salt = crypto.randomBytes(16).toString('hex')
const hash = crypto.scryptSync(password, salt, 64, { N: 16_384, r: 8, p: 1 }).toString('hex')
fs.mkdirSync(path.dirname(accountFile), { recursive: true })
const temporaryFile = `${accountFile}.${process.pid}.tmp`
fs.writeFileSync(temporaryFile, JSON.stringify({ email, salt, hash, createdAt: new Date().toISOString() }, null, 2), { mode: 0o600 })
fs.renameSync(temporaryFile, accountFile)
console.log(`Admin account configured for ${email}. Restart the API server before logging in.`)
