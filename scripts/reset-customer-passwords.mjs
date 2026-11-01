import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const dataFile = process.env.SHOP_DATA_FILE ? path.resolve(process.env.SHOP_DATA_FILE) : path.join(root, '..', 'data', 'shop.json')

const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'))
const customers = Array.isArray(data.customers) ? data.customers : []
let resetCount = 0
for (const customer of customers) {
  if (customer.passwordHash || customer.salt) {
    delete customer.passwordHash
    delete customer.salt
    customer.passwordResetRequired = true
    customer.passwordResetAt = new Date().toISOString()
    resetCount += 1
  } else {
    customer.passwordResetRequired = true
  }
}
data.authChallenges = {}
data.authRateLimits = {}
// Clear any in-flight recovery state is handled server-side; persist reset metadata.
data.activityLog = [{ id: crypto.randomUUID(), at: new Date().toISOString(), actor: 'SecurityAudit', message: `Reset passwords for ${resetCount} customer account(s).` }, ...(data.activityLog || [])].slice(0, 100)

const tempFile = `${dataFile}.${process.pid}.tmp`
fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), { mode: 0o600 })
fs.renameSync(tempFile, dataFile)
console.log(`Reset ${resetCount} customer password(s). ${customers.length} customer account(s) now require a password reset.`)
