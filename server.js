import http from 'node:http'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'
import nodemailer from 'nodemailer'

const root = path.dirname(fileURLToPath(import.meta.url))
const envFile = path.join(root, '.env')
if (typeof process.loadEnvFile === 'function' && fs.existsSync(envFile)) process.loadEnvFile(envFile)
const dataFile = process.env.SHOP_DATA_FILE ? path.resolve(process.env.SHOP_DATA_FILE) : path.join(root, 'data', 'shop.json')
const databaseFile = process.env.SHOP_DATABASE_FILE ? path.resolve(process.env.SHOP_DATABASE_FILE) : path.join(root, 'data', 'shop.sqlite')
if (databaseFile === dataFile) throw new Error('SHOP_DATABASE_FILE must not point to the legacy SHOP_DATA_FILE.')
fs.mkdirSync(path.dirname(databaseFile), { recursive: true })
const shopDatabase = new DatabaseSync(databaseFile)
shopDatabase.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; PRAGMA busy_timeout = 5000;')
shopDatabase.exec(`
  CREATE TABLE IF NOT EXISTS shop_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    revision INTEGER NOT NULL,
    payload TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
  );
`)
const adminFile = process.env.ADMIN_ACCOUNT_FILE ? path.resolve(process.env.ADMIN_ACCOUNT_FILE) : path.join(root, 'data', 'admin.json')
const paymentsFile = process.env.PAYMENT_ACCOUNTS_FILE ? path.resolve(process.env.PAYMENT_ACCOUNTS_FILE) : path.join(root, 'data', 'payments.json')
const settingsFile = process.env.SHOP_SETTINGS_FILE ? path.resolve(process.env.SHOP_SETTINGS_FILE) : path.join(root, 'data', 'settings.json')
const uploadsDir = path.join(root, 'public', 'uploads')
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
const port = Number(process.env.API_PORT || 8787)
const sessions = new Map()
const secureCookie = process.env.NODE_ENV === 'production' ? '; Secure' : ''
const customerCookie = 'hto_customer_session'
const authSecret = process.env.AUTH_SECRET || crypto.randomBytes(32).toString('hex')
const ORDER_STATUSES = ['New', 'Pending', 'Confirmed', 'Processing', 'Packing', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled']
const PAYMENT_STATUSES = ['Pending Verification', 'Verified', 'Rejected', 'Not Required']
const SHIPPING_STATUSES = ['Preparing', 'Shipped', 'In Transit', 'Delivered', 'Failed']
const STOCK_MOVEMENT_TYPES = ['Stock In', 'Stock Out', 'Adjustment', 'Return', 'Damaged']
const STOREFRONT_CATEGORIES = ['Men', 'Women', 'Kids', 'Shoes', 'Accessories', 'Sale']
const DEFAULT_CATEGORIES = [
  { id: 'Clothing', name: 'Clothing', storefrontCategory: 'Men', icon: '◇', image: '', enabled: true },
  { id: 'Grocery', name: 'Grocery', storefrontCategory: 'Accessories', icon: '▦', image: '', enabled: true },
  { id: 'Phones & Accessories', name: 'Phones & Accessories', storefrontCategory: 'Accessories', icon: '▣', image: '', enabled: true }
]
const DEFAULT_BANNERS = [
  {
    id: 'ban-hero-1',
    image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1200&auto=format&fit=crop&q=80',
    altText: 'HTOO Luxury Atelier - New Season Collection',
    link: '/search',
    sortOrder: 1,
    startDate: '',
    endDate: '',
    enabled: true,
    createdAt: '2026-10-08T00:00:00.000Z',
    updatedAt: '2026-10-08T00:00:00.000Z'
  }
]
const PROMOTION_TYPES = ['percentage', 'fixed']
const oauthTransactions = new Map()
const dataRevisions = new WeakMap()

function normalizeShopData(data) {
  const base = { orders: [], products: [], customers: [], promotions: [], categories: DEFAULT_CATEGORIES, banners: DEFAULT_BANNERS, orderChats: [], stockMovements: [], guestOrderAccess: {}, activityLog: [], processedTelegramUpdates: [], telegramOrderMessages: {}, telegramOrderNotifications: {}, orderIdempotency: [], authChallenges: {}, authRateLimits: {} }
  const safeData = { ...base, ...data }
  for (const key of ['orders', 'products', 'customers', 'promotions']) {
    if (!Array.isArray(safeData[key])) throw new Error(`Shop data field "${key}" must be an array.`)
  }
  safeData.categories = Array.isArray(safeData.categories) ? safeData.categories : base.categories
  safeData.banners = Array.isArray(safeData.banners) ? safeData.banners : base.banners
  safeData.orderChats = Array.isArray(safeData.orderChats) ? safeData.orderChats : []
  safeData.stockMovements = Array.isArray(safeData.stockMovements) ? safeData.stockMovements : []
  safeData.guestOrderAccess = safeData.guestOrderAccess && typeof safeData.guestOrderAccess === 'object' && !Array.isArray(safeData.guestOrderAccess) ? safeData.guestOrderAccess : {}
  safeData.activityLog = Array.isArray(safeData.activityLog) ? safeData.activityLog.slice(0, 100) : []
  safeData.processedTelegramUpdates = Array.isArray(safeData.processedTelegramUpdates) ? safeData.processedTelegramUpdates.slice(-1000) : []
  safeData.telegramOrderMessages = safeData.telegramOrderMessages && typeof safeData.telegramOrderMessages === 'object' && !Array.isArray(safeData.telegramOrderMessages) ? safeData.telegramOrderMessages : {}
  safeData.telegramOrderNotifications = safeData.telegramOrderNotifications && typeof safeData.telegramOrderNotifications === 'object' && !Array.isArray(safeData.telegramOrderNotifications) ? safeData.telegramOrderNotifications : {}
  safeData.orderIdempotency = Array.isArray(safeData.orderIdempotency) ? safeData.orderIdempotency.slice(-1000) : []
  safeData.authChallenges = safeData.authChallenges && typeof safeData.authChallenges === 'object' && !Array.isArray(safeData.authChallenges) ? safeData.authChallenges : {}
  safeData.authRateLimits = safeData.authRateLimits && typeof safeData.authRateLimits === 'object' && !Array.isArray(safeData.authRateLimits) ? safeData.authRateLimits : {}
  return safeData
}
function initializeShopDatabase() {
  const state = shopDatabase.prepare('SELECT revision FROM shop_state WHERE id = 1').get()
  if (!state) {
    let initialData = normalizeShopData({})
    if (fs.existsSync(dataFile)) {
      try {
        const legacyData = JSON.parse(fs.readFileSync(dataFile, 'utf8'))
        if (!legacyData || typeof legacyData !== 'object' || Array.isArray(legacyData)) throw new Error('The file root must be a JSON object.')
        initialData = normalizeShopData(legacyData)
      } catch (migrationError) {
        throw new Error(`Could not import existing shop data from ${dataFile}; the original file was left untouched. ${migrationError.message}`)
      }
    }
    shopDatabase.exec('BEGIN IMMEDIATE')
    try {
      shopDatabase.prepare('INSERT INTO shop_state (id, revision, payload, updated_at) VALUES (1, 1, ?, ?)').run(JSON.stringify(initialData), new Date().toISOString())
      shopDatabase.prepare('INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (1, ?)').run(new Date().toISOString())
      shopDatabase.exec('COMMIT')
    } catch (migrationError) {
      shopDatabase.exec('ROLLBACK')
      throw new Error(`Could not initialize the persistent shop database. ${migrationError.message}`)
    }
    if (fs.existsSync(dataFile)) console.info(`[database] Imported existing shop data from ${dataFile}; the source file was preserved.`)
    return
  }
  shopDatabase.prepare('INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (1, ?)').run(new Date().toISOString())
}
initializeShopDatabase()

function readData() {
  const row = shopDatabase.prepare('SELECT revision, payload FROM shop_state WHERE id = 1').get()
  if (!row) throw new Error('Persistent shop database is missing its state record.')
  let data
  try {
    data = normalizeShopData(JSON.parse(row.payload))
  } catch (readError) {
    throw new Error(`Persistent shop database data could not be read. ${readError.message}`)
  }
  dataRevisions.set(data, Number(row.revision))
  return data
}
function writeData(data) {
  const expectedRevision = dataRevisions.get(data)
  if (!Number.isSafeInteger(expectedRevision)) throw new Error('Shop data cannot be saved without a database revision.')
  const safeData = normalizeShopData(data)
  const result = shopDatabase.prepare('UPDATE shop_state SET payload = ?, revision = revision + 1, updated_at = ? WHERE id = 1 AND revision = ?')
    .run(JSON.stringify(safeData), new Date().toISOString(), expectedRevision)
  if (Number(result.changes) !== 1) {
    const conflict = new Error('Shop data changed while this request was being processed.')
    conflict.code = 'SHOP_DATA_CONFLICT'
    throw conflict
  }
  dataRevisions.set(data, expectedRevision + 1)
}
function readPayments() {
  try { return JSON.parse(fs.readFileSync(paymentsFile, 'utf8')) } catch { return {} }
}
function writePayments(payments) {
  fs.mkdirSync(path.dirname(paymentsFile), { recursive: true })
  fs.writeFileSync(paymentsFile, JSON.stringify(payments, null, 2))
}
function readSettings() {
  try { return { carGatePickupFee: 20000, ...JSON.parse(fs.readFileSync(settingsFile, 'utf8')) } } catch { return { carGatePickupFee: 20000 } }
}
function writeSettings(settings) {
  fs.mkdirSync(path.dirname(settingsFile), { recursive: true })
  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2))
}
function hashPassword(password, salt) { return crypto.scryptSync(password, salt, 64, { N: 16_384, r: 8, p: 1 }).toString('hex') }
function loadAdminAccount() {
  try {
    const account = JSON.parse(fs.readFileSync(adminFile, 'utf8'))
    if (account.email && account.salt && account.hash) return account
  } catch {}
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase()
  const password = process.env.ADMIN_PASSWORD || ''
  if (!email || password.length < 12) return null
  const salt = crypto.randomBytes(16).toString('hex')
  const account = { email, salt, hash: hashPassword(password, salt), createdAt: new Date().toISOString() }
  fs.mkdirSync(path.dirname(adminFile), { recursive: true })
  fs.writeFileSync(adminFile, JSON.stringify(account, null, 2), { mode: 0o600 })
  return account
}
function writeAdminAccount() {
  if (!adminAccount) throw new Error('Admin account is not configured.')
  fs.mkdirSync(path.dirname(adminFile), { recursive: true })
  fs.writeFileSync(adminFile, JSON.stringify(adminAccount, null, 2), { mode: 0o600 })
}
const adminAccount = loadAdminAccount()
function send(response, status, body, headers = {}) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers })
  response.end(JSON.stringify(body))
}
function cookieValue(request, name) {
  return (request.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.split('=')[1]
}
function adminSession(request) {
  const token = cookieValue(request, 'hto_admin_session')
  const session = token && sessions.get(token)
  return session?.type === 'admin' ? session : null
}
function customerSession(request) {
  const token = cookieValue(request, customerCookie)
  const session = token && sessions.get(token)
  if (session?.type !== 'customer') return null
  if (session.expiresAt <= Date.now()) { sessions.delete(token); return null }
  return session
}
function guestOrderAccessHash(request) {
  const key = request.headers['x-guest-order-key']
  if (typeof key !== 'string' || !/^[A-Za-z0-9._:-]{16,128}$/.test(key)) return ''
  return crypto.createHash('sha256').update(key).digest('hex')
}
function customerSafeProfile(customer) {
  if (!customer) return null
  return {
    id: customer.id,
    name: customer.name || '',
    email: customer.email || '',
    phone: customer.phone || '',
    profileImage: customer.profileImage || '',
    emailVerified: Boolean(customer.emailVerified),
    authProvider: customer.authProvider || 'password',
    authMethods: [
      ...(customer.phoneVerified ? ['phone'] : []),
      ...(customer.passwordHash ? ['password'] : []),
      ...(customer.googleId ? ['google'] : []),
      ...(customer.telegramUserId ? ['telegram'] : [])
    ],
    languagePreference: customer.languagePreference === 'my' ? 'my' : customer.languagePreference === 'en' ? 'en' : '',
    createdAt: customer.createdAt
  }
}
function adminCustomerSummary(customer, orders) {
  const customerOrders = orders.filter((order) => isCustomerOrder(order, customer.id, customer))
  return { id: customer.id, name: customer.name, phone: customer.phone, email: customer.email || '', createdAt: customer.createdAt, orderCount: customerOrders.length, totalPurchase: customerOrders.filter((order) => order.status !== 'Cancelled').reduce((total, order) => total + Number(order.total || 0), 0) }
}
function productVariantOptions(product) {
  const sizes = Array.isArray(product.availableVariants?.sizes)
    ? product.availableVariants.sizes
    : typeof product.variants === 'string'
      ? product.variants.split(',').map((size) => size.trim()).filter(Boolean)
      : []
  const colors = Array.isArray(product.availableVariants?.colors) ? product.availableVariants.colors : []
  return { sizes, colors }
}
function productVariantStockKey(variants = {}) {
  return JSON.stringify([String(variants.size || ''), String(variants.color || '')])
}
function invalidAdminInput(message) {
  const error = new Error(message)
  error.status = 400
  throw error
}
function restoreCancelledOrderStock(data, order) {
  const quantities = new Map()
  const variantQuantities = new Map()
  for (const item of order.items || []) {
    const productId = String(item.productId || item.id || '')
    const quantity = Number(item.quantity)
    if (!productId || !Number.isInteger(quantity) || quantity <= 0) continue
    quantities.set(productId, (quantities.get(productId) || 0) + quantity)
    const variants = item.variants || {}
    const key = productVariantStockKey(variants)
    const entries = variantQuantities.get(productId) || new Map()
    entries.set(key, (entries.get(key) || 0) + quantity)
    variantQuantities.set(productId, entries)
  }
  const movementDate = new Date().toISOString()
  data.products = data.products.map((product) => {
    const quantity = quantities.get(String(product.id))
    if (!quantity) return product
    const previousStock = Number(product.stock || 0)
    const stock = previousStock + quantity
    const variantStock = product.variantStock && typeof product.variantStock === 'object'
      ? { ...product.variantStock }
      : null
    const variantChanges = []
    if (variantStock) {
      for (const [key, variantQuantity] of variantQuantities.get(String(product.id)) || []) {
        if (!Object.hasOwn(variantStock, key)) continue
        const previousVariantStock = variantStock[key]
        variantStock[key] += variantQuantity
        const [size, color] = JSON.parse(key)
        variantChanges.push({
          variants: { ...(size ? { size } : {}), ...(color ? { color } : {}) },
          quantity: variantQuantity,
          previousStock: previousVariantStock,
          newStock: variantStock[key]
        })
      }
    }
    const stockHistory = [...(product.stockHistory || []), { id: crypto.randomUUID(), type: 'Order cancelled', change: quantity, stockAfter: stock, at: new Date().toISOString() }].slice(-30)
    data.stockMovements.unshift({
      id: crypto.randomUUID(),
      productId: product.id,
      productName: product.nameEn || product.name,
      sku: product.sku || '',
      type: 'Return',
      quantity,
      previousStock,
      newStock: stock,
      reason: 'Cancelled customer order',
      reference: order.orderNumber || order.id,
      ...(variantChanges.length ? { variantChanges } : {}),
      date: movementDate,
      user: 'System (Order)'
    })
    return { ...product, stock, ...(variantStock ? { variantStock } : {}), stockHistory }
  })
}
function customerOnly(request, response) {
  const session = customerSession(request)
  if (!session) { send(response, 401, { error: 'Customer authentication required.' }); return null }
  return session
}
function normalizePhone(value) { return String(value || '').replace(/[\s()-]/g, '') }
function validPhone(value) { return /^(?:\+?95|0)\d{7,13}$/.test(normalizePhone(value)) }
function phoneE164(value) {
  const phone = normalizePhone(value)
  if (phone.startsWith('+95')) return phone
  if (phone.startsWith('95')) return `+${phone}`
  if (phone.startsWith('0')) return `+95${phone.slice(1)}`
  return ''
}
function validPassword(value) { return typeof value === 'string' && value.length >= 8 && value.length <= 256 }
function normalizeEmail(value) { return String(value || '').trim().toLowerCase() }
function validEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value)) }
function authRateLimit(data, key, limit, windowMs) {
  const now = Date.now()
  const current = data.authRateLimits[key]
  const record = current && current.resetAt > now ? current : { count: 0, resetAt: now + windowMs }
  if (record.count >= limit) return Math.max(1, Math.ceil((record.resetAt - now) / 1000))
  record.count += 1
  data.authRateLimits[key] = record
  return 0
}
function otpHash(email, otp, purpose, challengeId) {
  return crypto.createHmac('sha256', authSecret).update(`${email}:${purpose}:${challengeId}:${otp}`).digest('hex')
}
function pruneAuthState(data) {
  const now = Date.now()
  for (const [id, challenge] of Object.entries(data.authChallenges)) if (!challenge || challenge.expiresAt <= now) delete data.authChallenges[id]
  for (const [key, record] of Object.entries(data.authRateLimits)) if (!record || record.resetAt <= now) delete data.authRateLimits[key]
}
function emailTransport() {
  const portNumber = Number(process.env.EMAIL_PORT || 587)
  if (!process.env.EMAIL_HOST || !Number.isInteger(portNumber) || portNumber < 1 || portNumber > 65535 || !process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) return null
  return nodemailer.createTransport({ host: process.env.EMAIL_HOST, port: portNumber, secure: portNumber === 465, auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD } })
}
async function sendBuyerOtp(email, otp, purpose) {
  const transport = emailTransport()
  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER
  if (!transport || !from) throw new Error('Buyer email delivery is not configured.')
  const subject = purpose === 'reset' ? 'Reset your HTOO Online password' : 'Your HTOO Online Verification Code'
  await transport.sendMail({
    from,
    to: email,
    subject,
    text: `HTOO Online\n\nYour verification code is: ${otp}\n\nThis code expires in 5 minutes and can only be used once. If you did not request this code, secure your account and ignore this email.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px;color:#17223b"><h1 style="margin-bottom:8px">HTOO Online</h1><p>Your verification code is:</p><p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#2868ed">${otp}</p><p>This code expires in 5 minutes and can only be used once.</p><p style="color:#6b7280">If you did not request this code, secure your account and ignore this email.</p></div>`
  })
}
function twilioVerifyConfigured() {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_VERIFY_SERVICE_SID)
}
function phoneOtpProvider() {
  const mode = process.env.AUTH_OTP_MODE || 'auto'
  const hasAnyTwilioCredentials = Boolean(
    process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_AUTH_TOKEN || process.env.TWILIO_VERIFY_SERVICE_SID
  )
  if (mode === 'mock' && process.env.NODE_ENV !== 'production') return 'mock'
  if ((mode === 'auto' || mode === 'twilio') && twilioVerifyConfigured()) return 'twilio'
  if (mode === 'auto' && !hasAnyTwilioCredentials && process.env.NODE_ENV !== 'production') return 'mock'
  return ''
}
const DEVELOPMENT_PHONE_OTP = '123456'
async function twilioVerifyRequest(action, values) {
  if (!twilioVerifyConfigured()) throw new Error('Twilio Verify is not configured.')
  const account = process.env.TWILIO_ACCOUNT_SID
  const service = encodeURIComponent(process.env.TWILIO_VERIFY_SERVICE_SID)
  const credentials = Buffer.from(`${account}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')
  const response = await fetch(`https://verify.twilio.com/v2/Services/${service}/${action}`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams(values),
    signal: AbortSignal.timeout(10_000)
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(result.message || `Twilio Verify returned HTTP ${response.status}.`)
    error.status = response.status
    throw error
  }
  return result
}
function createAuthChallenge(data, { email, purpose, customerId = '', pendingCustomer = null }) {
  pruneAuthState(data)
  const now = Date.now()
  const key = `otp:${purpose}:${email}`
  const current = data.authRateLimits[key]
  if (current?.cooldownUntil > now) return { retryAfter: Math.ceil((current.cooldownUntil - now) / 1000) }
  const retryAfter = authRateLimit(data, `otp-requests:${email}`, 5, 60 * 60 * 1000)
  if (retryAfter) return { retryAfter }
  const id = crypto.randomUUID()
  const otp = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
  data.authChallenges[id] = { email, purpose, customerId, pendingCustomer, otpHash: otpHash(email, otp, purpose, id), expiresAt: now + 5 * 60 * 1000, cooldownUntil: now + 60 * 1000, attempts: 0 }
  data.authRateLimits[key] = { count: 0, resetAt: now + 60 * 1000, cooldownUntil: now + 60 * 1000 }
  return { id, otp }
}
function configuredRedirectUrl(value) {
  try {
    const uri = new URL(value)
    if (!['http:', 'https:'].includes(uri.protocol) || (process.env.NODE_ENV === 'production' && uri.protocol !== 'https:') || uri.username || uri.password || uri.hash) return ''
    return uri.toString()
  } catch { return '' }
}
function googleCallbackUrl() { return configuredRedirectUrl(process.env.GOOGLE_REDIRECT_URI) }
function telegramCallbackUrl() { return configuredRedirectUrl(process.env.TELEGRAM_REDIRECT_URI) }
function telegramOidcConfigured() {
  return Boolean(process.env.TELEGRAM_CLIENT_ID && process.env.TELEGRAM_CLIENT_SECRET && telegramCallbackUrl())
}
async function verifyOidcToken(token, { issuer, audience, jwksUrl, nonce }) {
  if (typeof token !== 'string' || token.length > 16_384) throw new Error('The identity token is invalid.')
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('The identity token is invalid.')
  let header
  let claims
  try {
    header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'))
    claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
  } catch { throw new Error('The identity token is invalid.') }
  if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid) throw new Error('The identity token signing algorithm is not supported.')
  const keysResponse = await fetch(jwksUrl, { signal: AbortSignal.timeout(10_000) })
  if (!keysResponse.ok) throw new Error('The identity provider signing keys could not be loaded.')
  const jwks = await keysResponse.json()
  const jwk = Array.isArray(jwks.keys) ? jwks.keys.find((key) => key.kid === header.kid && key.kty === 'RSA' && key.use === 'sig') : null
  if (!jwk) throw new Error('The identity token signing key is unknown.')
  let signatureValid = false
  try {
    signatureValid = crypto.verify(
      'RSA-SHA256',
      Buffer.from(`${parts[0]}.${parts[1]}`),
      crypto.createPublicKey({ key: jwk, format: 'jwk' }),
      Buffer.from(parts[2], 'base64url')
    )
  } catch { throw new Error('The identity token signature could not be verified.') }
  const now = Math.floor(Date.now() / 1000)
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud]
  const issuers = Array.isArray(issuer) ? issuer : [issuer]
  if (!signatureValid || !issuers.includes(claims.iss) || !audiences.includes(audience) ||
    !Number.isInteger(claims.exp) || claims.exp <= now ||
    !Number.isInteger(claims.iat) || claims.iat > now + 60 ||
    (nonce && claims.nonce !== nonce)) {
    throw new Error('The identity token claims are invalid or expired.')
  }
  return claims
}
async function googleFetchProfile(code, transaction) {
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, redirect_uri: googleCallbackUrl(), grant_type: 'authorization_code', code_verifier: transaction.verifier }),
    signal: AbortSignal.timeout(10_000)
  })
  if (!tokenResponse.ok) throw new Error('Google OAuth token exchange failed.')
  const token = await tokenResponse.json()
  const profile = await verifyOidcToken(token.id_token, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience: process.env.GOOGLE_CLIENT_ID,
    jwksUrl: 'https://www.googleapis.com/oauth2/v3/certs',
    nonce: transaction.nonce
  })
  if (typeof profile.sub !== 'string' || !profile.sub || !validEmail(profile.email) || profile.email_verified !== true) throw new Error('Google account email is not verified.')
  const profileImage = typeof profile.picture === 'string' && profile.picture.length <= 2048 && /^https:\/\//i.test(profile.picture)
    ? profile.picture
    : ''
  return { subject: profile.sub, email: normalizeEmail(profile.email), name: String(profile.name || '').slice(0, 120), profileImage }
}
async function telegramFetchProfile(code, transaction) {
  const credentials = Buffer.from(`${process.env.TELEGRAM_CLIENT_ID}:${process.env.TELEGRAM_CLIENT_SECRET}`).toString('base64')
  const tokenResponse = await fetch('https://oauth.telegram.org/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${credentials}` },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: process.env.TELEGRAM_CLIENT_ID,
      redirect_uri: telegramCallbackUrl(),
      code_verifier: transaction.verifier
    }),
    signal: AbortSignal.timeout(10_000)
  })
  if (!tokenResponse.ok) throw new Error('Telegram OAuth token exchange failed.')
  const token = await tokenResponse.json()
  const profile = await verifyOidcToken(token.id_token, {
    issuer: 'https://oauth.telegram.org',
    audience: process.env.TELEGRAM_CLIENT_ID,
    jwksUrl: 'https://oauth.telegram.org/.well-known/jwks.json',
    nonce: transaction.nonce
  })
  if (typeof profile.sub !== 'string' || !profile.sub) throw new Error('Telegram account identifier is missing.')
  const name = String(profile.name || [profile.given_name, profile.family_name].filter(Boolean).join(' ') || profile.preferred_username || '').trim().slice(0, 120)
  return { subject: profile.sub, name }
}
function customerForExternalIdentity(data, provider, profile, linkCustomerId = '') {
  const providerField = provider === 'google' ? 'googleId' : 'telegramUserId'
  const providerOwner = data.customers.find((item) => item[providerField] === profile.subject)
  let customer
  if (linkCustomerId) {
    customer = data.customers.find((item) => item.id === linkCustomerId)
    if (!customer) throw Object.assign(new Error('The HTOO account to link no longer exists. Sign in again and retry.'), { statusCode: 401 })
    if (providerOwner && providerOwner.id !== customer.id) throw Object.assign(new Error(`This ${provider} account is already linked to a different HTOO account.`), { statusCode: 409 })
    customer[providerField] = profile.subject
    if (provider === 'google' && !customer.email && profile.email) {
      const emailUsed = data.customers.some((item) => item.id !== customer.id && normalizeEmail(item.email) === profile.email)
      if (!emailUsed) {
        customer.email = profile.email
        customer.emailVerified = true
        customer.emailVerifiedAt ||= new Date().toISOString()
      }
    }
  } else if (providerOwner) {
    customer = providerOwner
  } else {
    const emailOwner = provider === 'google' && profile.email
      ? data.customers.find((item) => normalizeEmail(item.email) === profile.email)
      : null
    if (emailOwner) throw Object.assign(new Error('A HTOO account already uses this email. Sign in to that account first, then link Google from account settings.'), { statusCode: 409 })
    const now = new Date().toISOString()
    customer = {
      id: crypto.randomUUID(),
      name: profile.name || (provider === 'google' ? profile.email : 'Telegram customer'),
      email: provider === 'google' ? profile.email : '',
      ...(provider === 'google' && profile.profileImage ? { profileImage: profile.profileImage } : {}),
      emailVerified: provider === 'google',
      ...(provider === 'google' ? { emailVerifiedAt: now } : {}),
      phone: '',
      [providerField]: profile.subject,
      authProvider: provider,
      createdAt: now,
      orderIds: []
    }
  }
  customer.lastLoginAt = new Date().toISOString()
  data.customers = [customer, ...data.customers.filter((item) => item.id !== customer.id)]
  return customer
}
function isCustomerOrder(order, customerId, customer) {
  if (!order || !order.customer) return false
  if (order.customer.userId) return order.customer.userId === customerId
  if (customer && Array.isArray(customer.orderIds) && (customer.orderIds.includes(order.id) || customer.orderIds.includes(order.orderNumber))) return true
  return false
}
function customerCookieHeader(token, maxAge = 28800) { return `${customerCookie}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secureCookie}` }
function createCustomerSession(customer, maxAge = 28800) {
  const token = crypto.randomBytes(32).toString('hex')
  sessions.set(token, { type: 'customer', customerId: customer.id, createdAt: Date.now(), expiresAt: Date.now() + maxAge * 1000 })
  return token
}
function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = ''
    request.on('data', (chunk) => { body += chunk; if (body.length > 8_000_000) request.destroy() })
    request.on('end', () => { try { resolve(body ? JSON.parse(body) : {}) } catch { reject(new Error('Invalid JSON')) } })
    request.on('error', reject)
  })
}
function passwordMatches(value) {
  if (!adminAccount || typeof value !== 'string') return false
  const expected = Buffer.from(adminAccount.hash, 'hex')
  const actual = Buffer.from(hashPassword(value, adminAccount.salt), 'hex')
  return expected.length === actual.length && crypto.timingSafeEqual(actual, expected)
}
function adminOnly(request, response) {
  const session = adminSession(request)
  if (!session) { send(response, 401, { error: 'Admin authentication required.' }); return null }
  return session
}
function auditAdminAction(data, request, message) {
  const session = adminSession(request)
  data.activityLog = [{ id: crypto.randomUUID(), at: new Date().toISOString(), actor: session?.email || 'Admin', message }, ...(data.activityLog || [])].slice(0, 100)
}
function summary(orders) {
  const active = orders.filter((order) => order.status !== 'Cancelled')
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const wasCreatedOn = (order, date) => new Date(order.createdAt).toDateString() === date.toDateString()
  const todayOrders = orders.filter((order) => wasCreatedOn(order, today))
  const yesterdayOrders = orders.filter((order) => wasCreatedOn(order, yesterday))
  const salesFor = (items) => items.filter((order) => order.status !== 'Cancelled').reduce((total, order) => total + Number(order.total || 0), 0)
  const todayFulfilled = orders.filter((order) => order.status === 'Delivered' && new Date(order.deliveredAt || order.updatedAt || order.createdAt).toDateString() === today.toDateString()).length
  const yesterdayFulfilled = orders.filter((order) => order.status === 'Delivered' && new Date(order.deliveredAt || order.updatedAt || order.createdAt).toDateString() === yesterday.toDateString()).length
  const totalSales = salesFor(active)
  const yesterdayActive = yesterdayOrders.filter((order) => order.status !== 'Cancelled')
  return { totalOrders: orders.length, todayOrders: todayOrders.length, todaySales: salesFor(todayOrders), yesterdaySales: salesFor(yesterdayOrders), todayFulfilled, yesterdayFulfilled, averageOrderValue: active.length ? totalSales / active.length : 0, yesterdayAverageOrderValue: yesterdayActive.length ? salesFor(yesterdayActive) / yesterdayActive.length : 0, todayUnfulfilled: todayOrders.filter((order) => !['Delivered', 'Cancelled'].includes(order.status)).length, todayPacking: todayOrders.filter((order) => order.status === 'Packing').length, new: orders.filter((order) => order.status === 'New').length, pending: orders.filter((order) => ['New', 'Confirmed', 'Packing', 'Shipped'].includes(order.status)).length, pendingPayment: orders.filter((order) => order.paymentStatus === 'Pending Verification').length, confirmed: orders.filter((order) => order.status === 'Confirmed').length, packing: orders.filter((order) => order.status === 'Packing').length, shipped: orders.filter((order) => order.status === 'Shipped').length, delivered: orders.filter((order) => order.status === 'Delivered').length, completed: orders.filter((order) => order.status === 'Delivered').length, cancelled: orders.filter((order) => order.status === 'Cancelled').length, totalSales }
}
function cleanPromotion(input, existing = {}) {
  const promotion = { ...existing, ...input, id: existing.id || input.id || crypto.randomUUID() }
  promotion.name = String(promotion.name || '').trim()
  promotion.code = String(promotion.code || promotion.name).trim().toUpperCase()
  promotion.type = String(promotion.type || 'percentage')
  promotion.amount = Number(promotion.amount)
  promotion.enabled = promotion.enabled !== false
  if (!promotion.name || !PROMOTION_TYPES.includes(promotion.type) || !Number.isFinite(promotion.amount) || promotion.amount <= 0 || (promotion.type === 'percentage' && promotion.amount > 100)) throw new Error('Promotion requires a name and a valid percentage or Ks amount.')
  return promotion
}
function cleanProduct(input, existing = {}) {
  const product = { ...existing, ...input }
  const categories = readData().categories
  product.id = existing.id != null ? existing.id : (product.id != null ? product.id : crypto.randomUUID())
  product.nameEn = String(product.nameEn || product.name || '').trim()
  product.name = product.nameEn
  product.nameMy = String(product.nameMy || product.nameEn).trim()

  const desc = String(product.description || product.descriptionEn || '').trim()
  product.description = desc
  product.descriptionEn = desc
  product.descriptionMy = String(product.descriptionMy || desc).trim()

  product.sku = String(product.sku || '').trim()
  product.category = String(product.category || '')
  product.subCategory = String(product.subCategory || '').trim()
  product.brand = String(product.brand || 'HTOO').trim()

  product.price = Number(product.price)
  product.salePrice = Number(product.salePrice || 0)
  product.discountPrice = product.salePrice > 0
    ? product.salePrice
    : (product.discountPrice === '' || product.discountPrice == null ? null : Number(product.discountPrice))
  product.costPrice = Number(product.costPrice || 0)
  product.stock = Number(product.stock)
  product.lowStockThreshold = Number(product.lowStockThreshold || 5)

  // Allow data URIs, absolute URLs, and root-relative image paths
  let rawImage = typeof product.image === 'string' ? product.image.trim() : ''
  if (rawImage.startsWith('data:image/')) {
    const saved = saveImageToDisk(rawImage, product.nameEn || 'product')
    if (saved) rawImage = saved
  }
  let images = Array.isArray(product.images)
    ? product.images.map((img) => typeof img === 'string' && img.startsWith('data:image/') ? (saveImageToDisk(img, product.nameEn || 'product') || img) : img).filter((img) => typeof img === 'string' && img.trim().length > 0)
    : []
  if (rawImage && !images.includes(rawImage)) {
    images = [rawImage, ...images]
  }
  product.images = images
  product.image = rawImage || images[0] || ''

  product.enabled = product.enabled !== false
  product.status = product.enabled ? 'Active' : 'Draft'
  product.featured = Boolean(product.featured)

  // Variants & Tags
  const rawVariantColors = product.availableVariants?.colors ?? product.variants?.colors ?? product.colors ?? product.color
  const variantsStr = typeof product.variants === 'string'
    ? product.variants.trim()
    : Array.isArray(product.variants)
      ? product.variants.join(', ')
      : Array.isArray(product.variants?.sizes)
        ? product.variants.sizes.join(', ')
        : ''
  product.variants = variantsStr
  const parsedSizes = variantsStr ? variantsStr.split(',').map((s) => s.trim()).filter(Boolean) : []
  product.availableVariants = {
    sizes: parsedSizes,
    colors: [...new Set((Array.isArray(rawVariantColors) ? rawVariantColors : typeof rawVariantColors === 'string' ? rawVariantColors.split(',') : [])
      .map((color) => String(color).trim()).filter(Boolean))]
  }
  if (product.variantStock != null) {
    if (typeof product.variantStock !== 'object' || Array.isArray(product.variantStock)) invalidAdminInput('Variant stock must be a size/color inventory map.')
    const sizeOptions = parsedSizes.length ? parsedSizes : ['']
    const colorOptions = product.availableVariants.colors.length ? product.availableVariants.colors : ['']
    const expectedKeys = new Set(sizeOptions.flatMap((size) => colorOptions.map((color) => productVariantStockKey({ size, color }))))
    const variantStock = {}
    for (const [key, rawQuantity] of Object.entries(product.variantStock)) {
      const quantity = Number(rawQuantity)
      if (!expectedKeys.has(key) || !Number.isSafeInteger(quantity) || quantity < 0) invalidAdminInput('Variant stock must contain valid, non-negative whole-unit quantities for the selected sizes and colors.')
      variantStock[key] = quantity
    }
    if (Object.keys(variantStock).length !== expectedKeys.size || [...expectedKeys].some((key) => !Object.hasOwn(variantStock, key))) {
      invalidAdminInput('Enter a stock quantity for every available size and color combination.')
    }
    const activeOrderWithoutVariant = readData().orders.some((order) => order.status !== 'Cancelled' &&
      (order.items || []).some((item) => String(item.productId || item.id) === String(existing.id) &&
        !Object.hasOwn(variantStock, productVariantStockKey(item.variants || {}))))
    if (activeOrderWithoutVariant) invalidAdminInput('Keep every size/color selection used by an active historical order so cancellation can restore its stock safely.')
    const totalVariantStock = Object.values(variantStock).reduce((total, quantity) => total + quantity, 0)
    if (!Number.isSafeInteger(totalVariantStock)) invalidAdminInput('The total variant stock exceeds the supported quantity.')
    product.variantStock = variantStock
    product.stock = totalVariantStock
  } else {
    delete product.variantStock
  }

  product.tags = typeof product.tags === 'string'
    ? product.tags.trim()
    : Array.isArray(product.tags)
      ? product.tags.join(', ')
      : ''

  product.rating = Number.isFinite(Number(product.rating)) ? Number(product.rating) : 5
  product.reviewsCount = Number(product.reviewsCount) || 0
  product.stockHistory = Array.isArray(product.stockHistory) ? product.stockHistory : []
  product.createdAt = existing.createdAt || product.createdAt || new Date().toISOString()
  product.updatedAt = new Date().toISOString()

  const selectedCategory = categories.find((category) => category.id === product.category || category.name === product.category)
  const mayKeepInactiveCategory = existing.id != null && (existing.category === product.category || existing.category === selectedCategory?.id || existing.category === selectedCategory?.name)
  if (!product.nameEn || !selectedCategory || (selectedCategory.enabled === false && !mayKeepInactiveCategory) || !Number.isFinite(product.price) || product.price < 0 || (product.discountPrice != null && (!Number.isFinite(product.discountPrice) || product.discountPrice < 0 || product.discountPrice > product.price)) || !Number.isInteger(product.stock) || product.stock < 0 || (!product.images.length && !product.image)) {
    throw new Error('Product requires names, an active category, valid Ks prices, stock, and at least one image.')
  }
  return product
}
function cleanCategory(input, existing = {}) {
  const category = { ...existing, ...input, id: existing.id || crypto.randomUUID() }
  category.name = String(category.name || '').trim()
  category.storefrontCategory = String(category.storefrontCategory || '')
  category.icon = String(category.icon || '').trim().slice(0, 8)
  category.enabled = category.enabled !== false
  if (!category.name || category.name.length > 60 || !STOREFRONT_CATEGORIES.includes(category.storefrontCategory)) throw new Error('Category requires a name of 1 to 60 characters and a valid storefront group.')
  if (category.image && (typeof category.image !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/.test(category.image) || category.image.length > 7_000_000)) throw new Error('Category image must be a JPG, PNG, or WebP image no larger than 5 MB.')
  return category
}
function cleanBanner(input, existing = {}) {
  const banner = { ...existing, ...input }
  banner.id = existing.id || banner.id || `ban-${crypto.randomUUID().slice(0, 8)}`
  banner.image = String(banner.image || '').trim()
  banner.altText = String(banner.altText || '').trim().slice(0, 160)
  banner.link = String(banner.link || '').trim()
  banner.sortOrder = Number.isFinite(Number(banner.sortOrder)) ? Number(banner.sortOrder) : 1
  banner.startDate = String(banner.startDate || '').trim()
  banner.endDate = String(banner.endDate || '').trim()
  banner.enabled = banner.enabled !== false
  banner.createdAt = existing.createdAt || banner.createdAt || new Date().toISOString()
  banner.updatedAt = new Date().toISOString()
  if (!banner.image) throw new Error('Banner requires an image.')
  return banner
}
function normalizeChatImage(value) {
  if (typeof value !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/.test(value)) return null
  const data = value.split(',')[1] || ''
  // base64 inflates bytes by ~4/3, so bound the encoded string above 5 MB to let
  // a genuine 5 MB image through; the decoded byte length below enforces the real limit.
  if (!data || data.length > Math.ceil((5 * 1024 * 1024 * 4) / 3) + 1024) return null
  try {
    const binary = Buffer.from(data, 'base64')
    if (binary.length === 0 || binary.length > 5 * 1024 * 1024) return null
    return value
  } catch {
    return null
  }
}
function saveImageToDisk(dataUrl, originalName = '') {
  if (typeof dataUrl !== 'string' || !/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(dataUrl)) return null
  const match = /^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/i.exec(dataUrl)
  if (!match) return null
  const mimeSubtype = match[1].toLowerCase()
  const base64Data = match[2]
  const ext = mimeSubtype === 'jpeg' || mimeSubtype === 'jpg' ? '.jpg' : mimeSubtype === 'png' ? '.png' : '.webp'
  const buffer = Buffer.from(base64Data, 'base64')
  if (buffer.length === 0 || buffer.length > 5 * 1024 * 1024) return null
  const rawBase = path.parse(originalName || 'product').name
  const safeBase = rawBase.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30) || 'product'
  const filename = `${safeBase}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`
  const filePath = path.join(uploadsDir, filename)
  fs.writeFileSync(filePath, buffer)
  return `/uploads/${filename}`
}
function getOrderChat(data, orderId) {
  return (data.orderChats || []).find((chat) => chat.orderId === orderId) || null
}
function ensureOrderChat(data, order) {
  const existing = getOrderChat(data, order.id)
  if (existing) return existing
  const chat = {
    id: crypto.randomUUID(),
    orderId: order.id,
    orderNumber: order.orderNumber || order.id,
    customerId: order.customer?.userId || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: []
  }
  data.orderChats = [chat, ...(data.orderChats || []).filter((item) => item.orderId !== order.id)]
  return chat
}
function orderChatUnreadCount(chat, viewerRole) {
  if (!chat) return 0
  return (chat.messages || []).filter((message) => message.senderRole !== viewerRole && !message.readBy?.[viewerRole]).length
}
function getOrderChatPayload(chat, order) {
  const safeChat = { ...chat, orderNumber: order?.orderNumber || order?.id || chat?.orderNumber, order: { id: order?.id, orderNumber: order?.orderNumber || order?.id, customer: order?.customer || null, items: order?.items || [] }, messages: (chat?.messages || []).map((message) => ({
    id: message.id,
    orderId: message.orderId,
    customerId: message.customerId,
    senderId: message.senderId,
    senderRole: message.senderRole,
    text: message.text || '',
    image: message.image || null,
    createdAt: message.createdAt,
    readBy: { customer: Boolean(message.readBy?.customer), admin: Boolean(message.readBy?.admin) }
  })) }
  return safeChat
}
function verifyTelegramInitData(initData) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) throw new Error('Telegram Mini App authentication is not configured.')
  if (typeof initData !== 'string' || !initData || initData.length > 10_000) throw new Error('Telegram authentication data is missing or invalid.')
  const params = new URLSearchParams(initData)
  const receivedHash = params.get('hash') || ''
  if (!/^[a-f0-9]{64}$/i.test(receivedHash)) throw new Error('Telegram authentication signature is invalid.')
  const fields = [...params.entries()].filter(([key]) => key !== 'hash').sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
  const dataCheckString = fields.map(([key, value]) => `${key}=${value}`).join('\n')
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest()
  const expectedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest()
  const actualHash = Buffer.from(receivedHash, 'hex')
  if (actualHash.length !== expectedHash.length || !crypto.timingSafeEqual(actualHash, expectedHash)) throw new Error('Telegram authentication signature is invalid.')
  const authDate = Number(params.get('auth_date'))
  const nowSeconds = Math.floor(Date.now() / 1000)
  if (!Number.isInteger(authDate) || authDate > nowSeconds + 60 || nowSeconds - authDate > 86_400) throw new Error('Telegram authentication data has expired.')
  let user
  try { user = JSON.parse(params.get('user') || '') } catch { throw new Error('Telegram user data is invalid.') }
  if (!user || (typeof user.id !== 'number' && typeof user.id !== 'string') || !String(user.id)) throw new Error('Telegram user data is invalid.')
  return { ...user, id: String(user.id) }
}
function telegramSecretMatches(actualValue, expectedValue) {
  if (!actualValue || !expectedValue) return false
  const actual = Buffer.from(actualValue)
  const expected = Buffer.from(expectedValue)
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected)
}
function markTelegramUpdate(data, updateId) {
  if (!Number.isSafeInteger(updateId)) return false
  if ((data.processedTelegramUpdates || []).includes(updateId)) return false
  data.processedTelegramUpdates = [...(data.processedTelegramUpdates || []), updateId].slice(-1000)
  return true
}
function getMiniAppUrl(orderId = '') {
  const configuredUrl = process.env.TELEGRAM_MINI_APP_URL
  if (!configuredUrl) return null
  try {
    const url = new URL(configuredUrl)
    if (url.protocol !== 'https:' && process.env.NODE_ENV === 'production') return null
    if (orderId) url.searchParams.set('order', orderId)
    return url.toString()
  } catch {
    return null
  }
}
function getAdminOrderUrl(orderId) {
  const miniAppUrl = getMiniAppUrl()
  if (!miniAppUrl) return null
  const url = new URL('/admin', miniAppUrl)
  url.searchParams.set('order', orderId)
  return url.toString()
}
function telegramOrderKeyboard(order) {
  const viewUrl = getAdminOrderUrl(order.id)
  const keyboard = [[viewUrl ? { text: 'View Order', url: viewUrl } : { text: 'View Order', callback_data: `view_order:${order.id}` }]]
  if (order.status === 'New') keyboard.push([{ text: 'Confirm', callback_data: `confirm_order:${order.id}` }, { text: 'Cancel', callback_data: `cancel_order:${order.id}` }])
  else if (order.status === 'Confirmed') keyboard.push([{ text: 'Start Packing', callback_data: `start_packing:${order.id}` }, { text: 'Cancel', callback_data: `cancel_order:${order.id}` }])
  else if (order.status === 'Packing') keyboard.push([{ text: 'Mark Shipped', callback_data: `mark_shipped:${order.id}` }, { text: 'Cancel', callback_data: `cancel_order:${order.id}` }])
  else if (order.status === 'Shipped') keyboard.push([{ text: 'Mark Delivered', callback_data: `mark_delivered:${order.id}` }])
  return { inline_keyboard: keyboard }
}
function telegramOrderMessage(order) {
  const headings = {
    New: '🛍️ NEW ORDER',
    Confirmed: '🟢 ORDER CONFIRMED',
    Packing: '📦 ORDER PACKING',
    Shipped: '🚚 ORDER SHIPPED',
    Delivered: '✅ ORDER DELIVERED',
    Cancelled: '❌ ORDER CANCELLED'
  }
  const paymentStatus = order.paymentStatus === 'Verified' ? 'Paid' : order.paymentStatus === 'Not Required' ? 'Not Required' : order.paymentStatus === 'Rejected' ? 'Rejected' : 'Pending'
  const items = (order.items || []).map((item) => `• ${item.name} × ${item.quantity}`).join('\n') || '• No items'
  const cancellationReason = order.status === 'Cancelled' ? `\nReason: ${order.cancellationReason || 'Cancelled by shop'}` : ''
  return `${headings[order.status] || 'ORDER UPDATE'}\n\nOrder: #${order.orderNumber || order.id}\n\n👤 Customer:\n${order.customer?.name || 'Customer'}\n\n📞 Phone:\n${order.customer?.phone || '—'}\n\n📦 Items:\n${items}\n\n💰 Subtotal: ${Math.round(order.subtotal || 0).toLocaleString('en-US')} MMK\n🚚 Delivery: ${Math.round(order.deliveryFee || 0).toLocaleString('en-US')} MMK\n🏷️ Discount: ${Math.round(order.discount || 0).toLocaleString('en-US')} MMK\n\n💵 TOTAL: ${Math.round(order.total || 0).toLocaleString('en-US')} MMK\n\n💳 Payment: ${order.paymentMethod || '—'}\n💰 Payment Status: ${paymentStatus}\n\n📦 Order Status: ${order.status}${order.trackingNumber ? `\nTracking: ${order.trackingNumber}` : ''}${cancellationReason}`
}
async function telegramRequest(method, payload) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) throw new Error('TELEGRAM_BOT_TOKEN is not configured.')
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(5000)
  })
  const result = await response.json()
  if (!response.ok || result.ok !== true) throw new Error(result.description || `Telegram ${method} request failed.`)
  return result.result
}
function queueTelegramRequest(method, payload, context) {
  return telegramRequest(method, payload).catch((error) => {
    const safeMessage = String(error.message || 'Request failed.').replaceAll(process.env.TELEGRAM_BOT_TOKEN || '\u0000', '[redacted]')
    console.error(`[telegram] ${context}:`, safeMessage)
    return null
  })
}
function saveTelegramOrderMessage(orderId, chatId, messageId) {
  const data = readData()
  const order = data.orders.find((item) => item.id === orderId)
  if (!order) return null
  const messageReferences = new Map(Object.entries(data.telegramOrderMessages))
  messageReferences.set(orderId, { chatId: String(chatId), messageId })
  data.telegramOrderMessages = Object.fromEntries([...messageReferences].slice(-1000))
  writeData(data)
  return order
}
function claimTelegramOrderNotification(orderId) {
  const data = readData()
  if (data.telegramOrderNotifications[orderId]) return false
  const notificationStates = new Map(Object.entries(data.telegramOrderNotifications))
  notificationStates.set(orderId, 'pending')
  data.telegramOrderNotifications = Object.fromEntries([...notificationStates].slice(-1000))
  writeData(data)
  return true
}
function saveTelegramOrderNotificationState(orderId, state) {
  const data = readData()
  if (!Object.hasOwn(data.telegramOrderNotifications, orderId)) return
  data.telegramOrderNotifications[orderId] = state
  writeData(data)
}
function notifyNewTelegramOrder(order) {
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID
  if (!chatId) {
    console.error('[telegram] New-order notification skipped: TELEGRAM_ADMIN_CHAT_ID is not configured.')
    return
  }
  try {
    if (!claimTelegramOrderNotification(order.id)) return
  } catch (error) {
    console.error(`[telegram] Could not record notification deduplication for ${order.orderNumber}:`, error.message)
    return
  }
  queueTelegramRequest('sendMessage', {
    chat_id: chatId,
    text: telegramOrderMessage(order),
    reply_markup: telegramOrderKeyboard(order)
  }, `New-order notification for ${order.orderNumber}`).then((message) => {
    saveTelegramOrderNotificationState(order.id, message ? 'sent' : 'failed')
    if (message?.message_id) {
      const latestOrder = saveTelegramOrderMessage(order.id, chatId, message.message_id)
      if (latestOrder && latestOrder.status !== order.status) updateTelegramOrderMessage(latestOrder)
    }
  }).catch((error) => console.error(`[telegram] Could not persist new-order notification state for ${order.orderNumber}:`, error.message))
}
function notifyTelegramAdmin(text, context, replyMarkup) {
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID
  if (!chatId) {
    console.error(`[telegram] ${context} skipped: TELEGRAM_ADMIN_CHAT_ID is not configured.`)
    return
  }
  queueTelegramRequest('sendMessage', { chat_id: chatId, text, ...(replyMarkup ? { reply_markup: replyMarkup } : {}) }, context)
}
function updateTelegramOrderMessage(order, fallbackMessage = '') {
  const reference = readData().telegramOrderMessages[order.id]
  if (reference?.chatId && reference?.messageId) {
    queueTelegramRequest('editMessageText', {
      chat_id: reference.chatId,
      message_id: reference.messageId,
      text: telegramOrderMessage(order),
      reply_markup: telegramOrderKeyboard(order)
    }, `Order message update for ${order.orderNumber}`)
    return
  }
  notifyTelegramAdmin(fallbackMessage || telegramOrderMessage(order), `Status notification for ${order.orderNumber}`, telegramOrderKeyboard(order))
}
function notifyTelegramCustomer(order, text) {
  const data = readData()
  const customerId = order.customer?.userId
  const customer = data.customers.find((item) => item.id === customerId)
  if (!customer?.telegramUserId) return
  const miniAppUrl = getMiniAppUrl(order.id)
  const replyMarkup = miniAppUrl ? { inline_keyboard: [[{ text: 'View Order', web_app: { url: miniAppUrl } }]] } : undefined
  queueTelegramRequest('sendMessage', { chat_id: customer.telegramUserId, text, ...(replyMarkup ? { reply_markup: replyMarkup } : {}) }, `Customer update for ${order.orderNumber}`)
}
function notifyTelegramOrderStatus(order) {
  const statusText = order.status === 'Shipped'
    ? `🚚 ORDER SHIPPED\n\nOrder: #${order.orderNumber}\nCustomer: ${order.customer?.name || 'Customer'}\nTracking: ${order.trackingNumber || 'Not provided'}`
    : order.status === 'Delivered'
      ? `✅ ORDER DELIVERED\n\nOrder: #${order.orderNumber}`
      : order.status === 'Confirmed'
        ? `🟢 ORDER CONFIRMED\n\nOrder: #${order.orderNumber}\nCustomer: ${order.customer?.name || 'Customer'}\nTotal: ${Math.round(order.total || 0).toLocaleString('en-US')} MMK`
        : order.status === 'Packing'
          ? `📦 ORDER PACKING\n\nOrder: #${order.orderNumber}`
          : order.status === 'Cancelled'
            ? `❌ ORDER CANCELLED\n\nOrder: #${order.orderNumber}\nReason: ${order.cancellationReason || 'Cancelled by shop'}`
            : `Order #${order.orderNumber} status changed to ${order.status}.`
  updateTelegramOrderMessage(order, statusText)
  notifyTelegramCustomer(order, statusText)
}
function notifyTelegramPayment(order) {
  const message = `💳 PAYMENT RECEIVED\n\nOrder: #${order.orderNumber}\nCustomer: ${order.customer?.name || 'Customer'}\nAmount: ${Math.round(order.total || 0).toLocaleString('en-US')} MMK\nPayment Method: ${order.paymentMethod || '—'}\nStatus: Paid`
  const viewUrl = getAdminOrderUrl(order.id)
  const keyboard = { inline_keyboard: [[viewUrl ? { text: 'View Order', url: viewUrl } : { text: 'View Order', callback_data: `view_order:${order.id}` }]] }
  notifyTelegramAdmin(message, `Payment notification for ${order.orderNumber}`, keyboard)
  notifyTelegramCustomer(order, `💳 Payment received for your HTOO Online Shop order #${order.orderNumber}.`)
}
function orderTransitionError(currentStatus, nextStatus) {
  if (!ORDER_STATUSES.includes(nextStatus)) return 'Invalid order status.'
  if (currentStatus === nextStatus) return ''
  const allowedTransitions = {
    New: ['Confirmed', 'Cancelled'],
    Pending: ['Confirmed', 'Cancelled'],
    Confirmed: ['Processing', 'Packing', 'Cancelled'],
    Processing: ['Packed', 'Packing', 'Cancelled'],
    Packed: ['Shipped', 'Cancelled'],
    Packing: ['Shipped', 'Cancelled'],
    Shipped: ['Out for Delivery', 'Delivered'],
    'Out for Delivery': ['Delivered'],
    Delivered: [],
    Cancelled: []
  }
  if (!allowedTransitions[currentStatus]?.includes(nextStatus)) return `An order cannot move from ${currentStatus || 'its current status'} to ${nextStatus}.`
  return ''
}
function beginExternalOAuth(provider, customerId = '') {
  const isGoogle = provider === 'google'
  const clientId = isGoogle ? process.env.GOOGLE_CLIENT_ID : process.env.TELEGRAM_CLIENT_ID
  const clientSecret = isGoogle ? process.env.GOOGLE_CLIENT_SECRET : process.env.TELEGRAM_CLIENT_SECRET
  const redirectUri = isGoogle ? googleCallbackUrl() : telegramCallbackUrl()
  if (!clientId || !clientSecret || !redirectUri) {
    const providerName = isGoogle ? 'Google' : 'Telegram'
    const setupHint = isGoogle
      ? ' Configure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI on the API server.'
      : ' Configure TELEGRAM_CLIENT_ID, TELEGRAM_CLIENT_SECRET, and TELEGRAM_REDIRECT_URI on the API server.'
    return { status: 503, error: `${providerName} sign-in is not configured.${setupHint} You can use email sign-in meanwhile.` }
  }
  const now = Date.now()
  for (const [state, transaction] of oauthTransactions) {
    if (transaction.expiresAt <= now) oauthTransactions.delete(state)
  }
  if (oauthTransactions.size >= 1000) return { status: 503, error: 'Too many sign-in requests are active. Please try again shortly.' }
  const state = crypto.randomBytes(32).toString('base64url')
  const verifier = crypto.randomBytes(32).toString('base64url')
  const nonce = crypto.randomBytes(32).toString('base64url')
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url')
  oauthTransactions.set(state, { provider, verifier, nonce, customerId, expiresAt: now + 10 * 60 * 1000 })
  const authorize = new URL(isGoogle ? 'https://accounts.google.com/o/oauth2/v2/auth' : 'https://oauth.telegram.org/auth')
  authorize.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: isGoogle ? 'openid email profile' : 'openid profile',
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    ...(isGoogle ? { prompt: 'select_account' } : {})
  }).toString()
  const cookieName = `hto_${provider}_state`
  return {
    status: 200,
    url: authorize.toString(),
    cookie: `${cookieName}=${state}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600${secureCookie}`
  }
}
function oauthStateCookie(provider, state = '') {
  const name = `hto_${provider}_state`
  return `${name}=${state}; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secureCookie}`
}
function transitionOrder(data, existing, nextStatus, updatedAt = new Date().toISOString()) {
  const history = Array.isArray(existing.statusHistory) && existing.statusHistory.length
    ? existing.statusHistory
    : [{ status: existing.status || 'New', at: existing.createdAt || updatedAt }]
  const updated = {
    ...existing,
    status: nextStatus,
    statusHistory: [...history, { status: nextStatus, at: updatedAt }],
    ...(nextStatus === 'Cancelled' ? { cancellationReason: existing.cancellationReason || 'Cancelled by shop' } : {}),
    ...(nextStatus === 'Delivered' ? { deliveredAt: existing.deliveredAt || updatedAt, shippingStatus: 'Delivered' } : { deliveredAt: null }),
    ...(nextStatus === 'Shipped' ? { shippingStatus: 'Shipped' } : {}),
    ...(nextStatus === 'Out for Delivery' ? { shippingStatus: 'In Transit' } : {}),
    ...(nextStatus === 'Processing' || nextStatus === 'Packed' || nextStatus === 'Packing' ? { shippingStatus: 'Preparing' } : {}),
    updatedAt
  }
  if (nextStatus === 'Cancelled' && existing.status !== 'Cancelled') restoreCancelledOrderStock(data, existing)
  return updated
}
function telegramAdminAuthorized(chatId, userId) {
  return Boolean(process.env.TELEGRAM_ADMIN_CHAT_ID && process.env.TELEGRAM_ADMIN_USER_ID
    && String(chatId || '') === process.env.TELEGRAM_ADMIN_CHAT_ID
    && String(userId || '') === process.env.TELEGRAM_ADMIN_USER_ID)
}
function queueTelegramStart(chatId) {
  const url = getMiniAppUrl()
  if (!url) {
    console.error('[telegram] Mini App launch skipped: TELEGRAM_MINI_APP_URL is missing or invalid.')
    queueTelegramRequest('sendMessage', { chat_id: chatId, text: 'HTOO Shop Mini App is not configured yet. Please contact the shop administrator.' }, 'Mini App launch response')
    return
  }
  queueTelegramRequest('sendMessage', {
    chat_id: chatId,
    text: 'Welcome to HTOO Online Shop. Open the Mini App to browse products, manage your cart, and track orders.',
    reply_markup: { inline_keyboard: [[{ text: 'Open HTOO Shop', web_app: { url } }]] }
  }, 'Mini App launch message')
}
function queueTelegramOrderList(chatId, orders, heading, customerView = false) {
  const recent = orders.slice(0, 10)
  const text = recent.length
    ? `${heading}\n\n${recent.map((order) => `#${order.orderNumber || order.id} · ${order.status} · ${Math.round(order.total || 0).toLocaleString('en-US')} MMK`).join('\n')}`
    : `${heading}\n\nNo orders found.`
  const rows = customerView
    ? recent.flatMap((order) => {
      const url = getMiniAppUrl(order.id)
      return url ? [[{ text: `View #${order.orderNumber || order.id}`, web_app: { url } }]] : []
    })
    : recent.map((order) => telegramOrderKeyboard(order).inline_keyboard.flat())
  const replyMarkup = rows.length ? { inline_keyboard: rows } : undefined
  queueTelegramRequest('sendMessage', { chat_id: chatId, text, ...(replyMarkup ? { reply_markup: replyMarkup } : {}) }, 'Order list response')
}
function handleTelegramMessage(message, data) {
  const text = String(message.text || '').trim()
  const command = text.split(/\s+/, 1)[0].split('@', 1)[0].toLowerCase()
  const chatId = message.chat?.id
  const userId = message.from?.id
  if (!chatId || !userId || !command.startsWith('/')) return
  const isAdmin = telegramAdminAuthorized(chatId, userId)
  if (command === '/start') return queueTelegramStart(chatId)
  if (command === '/help') {
    const help = isAdmin
      ? 'HTOO Shop commands:\n/start — Open the Mini App\n/help — Show this help\n/orders — Recent orders\n/pending — Orders awaiting fulfillment'
      : 'HTOO Shop commands:\n/start — Open the Mini App\n/help — Show this help\n/orders — View your orders'
    return queueTelegramRequest('sendMessage', { chat_id: chatId, text: help }, 'Help command response')
  }
  if (command === '/orders') {
    if (isAdmin) return queueTelegramOrderList(chatId, data.orders, 'Recent HTOO orders')
    if (message.chat?.type !== 'private') return queueTelegramRequest('sendMessage', { chat_id: chatId, text: 'For privacy, view your orders in a private chat with the HTOO Shop bot.' }, 'Customer orders privacy response')
    const customer = data.customers.find((item) => item.telegramUserId === String(userId))
    const customerOrders = customer ? data.orders.filter((order) => isCustomerOrder(order, customer.id, customer)) : []
    if (!customer) return queueTelegramRequest('sendMessage', { chat_id: chatId, text: 'Open the HTOO Shop Mini App first to link your account and view orders.' }, 'Unlinked customer orders response')
    return queueTelegramOrderList(chatId, customerOrders, 'Your HTOO orders', true)
  }
  if (command === '/pending') {
    if (!isAdmin) return queueTelegramRequest('sendMessage', { chat_id: chatId, text: 'This command is available to shop admins only.' }, 'Unauthorized pending command response')
    const pending = data.orders.filter((order) => ['New', 'Confirmed', 'Packing'].includes(order.status))
    return queueTelegramOrderList(chatId, pending, 'Orders awaiting fulfillment')
  }
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`)
  if (request.method === 'GET' && (url.pathname.startsWith('/api/uploads/') || url.pathname.startsWith('/uploads/'))) {
    const filename = path.basename(url.pathname)
    const filePath = path.join(uploadsDir, filename)
    if (!fs.existsSync(filePath)) return send(response, 404, { error: 'File not found.' })
    const ext = path.extname(filename).toLowerCase()
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp'
    }
    const contentType = mimeTypes[ext] || 'application/octet-stream'
    response.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable'
    })
    return fs.createReadStream(filePath).pipe(response)
  }
  response.setHeader('Cache-Control', 'no-store')
  try {
    if (request.method === 'POST' && url.pathname === '/api/telegram/webhook') {
      const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET
      if (!webhookSecret) return send(response, 503, { error: 'Telegram webhook is not configured.' })
      if (!telegramSecretMatches(request.headers['x-telegram-bot-api-secret-token'], webhookSecret)) return send(response, 401, { error: 'Invalid Telegram webhook secret.' })
      let update
      try {
        update = await readBody(request)
      } catch (parseError) {
        console.warn('[telegram] Ignored invalid update body:', parseError.message)
        return send(response, 200, { ok: true })
      }
      if (!update || typeof update !== 'object' || Array.isArray(update)) return send(response, 200, { ok: true })
      let data = readData()
      if (!Number.isSafeInteger(update.update_id)) {
        console.warn('[telegram] Ignored update without a valid update_id.')
        return send(response, 200, { ok: true })
      }
      if ((data.processedTelegramUpdates || []).includes(update.update_id)) return send(response, 200, { ok: true })

      if (update.callback_query) {
        const callback = update.callback_query
        const callbackId = callback.id
        if (!telegramAdminAuthorized(callback.message?.chat?.id, callback.from?.id)) {
          console.warn('[telegram] Rejected order action from an untrusted chat or Telegram user.')
          markTelegramUpdate(data, update.update_id)
          writeData(data)
          if (callbackId) queueTelegramRequest('answerCallbackQuery', { callback_query_id: callbackId, text: 'Not authorized.', show_alert: true }, 'Unauthorized callback response')
          return send(response, 200, { ok: true })
        }
        const match = /^(view_order|confirm_order|cancel_order|start_packing|mark_shipped|mark_delivered):([0-9a-f-]{36})$/i.exec(String(callback.data || ''))
        if (!match || !callbackId) {
          markTelegramUpdate(data, update.update_id)
          writeData(data)
          return send(response, 200, { ok: true })
        }
        const [, rawAction, rawOrderId] = match
        const action = rawAction.toLowerCase()
        const orderId = rawOrderId.toLowerCase()
        const order = data.orders.find((item) => item.id === orderId)
        if (!order) {
          markTelegramUpdate(data, update.update_id)
          writeData(data)
          queueTelegramRequest('answerCallbackQuery', { callback_query_id: callbackId, text: 'Order not found.', show_alert: true }, 'Order callback response')
          return send(response, 200, { ok: true })
        }
        if (action === 'view_order') {
          markTelegramUpdate(data, update.update_id)
          writeData(data)
          const orderUrl = getAdminOrderUrl(order.id)
          queueTelegramRequest('answerCallbackQuery', { callback_query_id: callbackId }, 'Order callback response')
          if (orderUrl) queueTelegramRequest('sendMessage', { chat_id: callback.message.chat.id, text: `Open order #${order.orderNumber} in Admin: ${orderUrl}` }, `Admin order link for ${order.orderNumber}`)
          else queueTelegramRequest('sendMessage', { chat_id: callback.message.chat.id, text: telegramOrderMessage(order), reply_markup: telegramOrderKeyboard(order) }, `Order details for ${order.orderNumber}`)
          return send(response, 200, { ok: true })
        }
        const nextStatus = {
          confirm_order: 'Confirmed',
          cancel_order: 'Cancelled',
          start_packing: 'Packing',
          mark_shipped: 'Shipped',
          mark_delivered: 'Delivered'
        }[action]
        const requiredStatus = {
          confirm_order: 'New',
          cancel_order: ['New', 'Confirmed', 'Packing'],
          start_packing: 'Confirmed',
          mark_shipped: 'Packing',
          mark_delivered: 'Shipped'
        }[action]
        const currentStatusAllowed = Array.isArray(requiredStatus) ? requiredStatus.includes(order.status) : order.status === requiredStatus
        const transitionError = !currentStatusAllowed
          ? `Order must be ${Array.isArray(requiredStatus) ? requiredStatus.join(', ') : requiredStatus} before this action.`
          : orderTransitionError(order.status, nextStatus)
        if (transitionError) {
          markTelegramUpdate(data, update.update_id)
          writeData(data)
          queueTelegramRequest('answerCallbackQuery', { callback_query_id: callbackId, text: transitionError, show_alert: true }, 'Order callback validation response')
          return send(response, 200, { ok: true })
        }
        const updatedAt = new Date().toISOString()
        const updated = transitionOrder(data, order, nextStatus, updatedAt)
        if (callback.message?.chat?.id && callback.message?.message_id) {
          const messageReferences = new Map(Object.entries(data.telegramOrderMessages))
          messageReferences.set(orderId, { chatId: String(callback.message.chat.id), messageId: callback.message.message_id })
          data.telegramOrderMessages = Object.fromEntries([...messageReferences].slice(-1000))
        }
        data.orders = data.orders.map((item) => item.id === orderId ? updated : item)
        data.activityLog = [{ id: crypto.randomUUID(), at: updatedAt, actor: 'Telegram admin', message: `Updated order ${order.orderNumber}: ${updated.status}.` }, ...(data.activityLog || [])].slice(0, 100)
        markTelegramUpdate(data, update.update_id)
        writeData(data)
        queueTelegramRequest('answerCallbackQuery', { callback_query_id: callbackId, text: `Order ${updated.status.toLowerCase()}.` }, 'Order callback response')
        notifyTelegramOrderStatus(updated)
        return send(response, 200, { ok: true })
      }

      if (update.message) {
        markTelegramUpdate(data, update.update_id)
        writeData(data)
        handleTelegramMessage(update.message, data)
        return send(response, 200, { ok: true })
      }
      markTelegramUpdate(data, update.update_id)
      writeData(data)
      return send(response, 200, { ok: true })
    }
    if (request.method === 'POST' && url.pathname === '/api/telegram/auth') {
      if (!process.env.TELEGRAM_BOT_TOKEN) return send(response, 503, { error: 'Telegram Mini App authentication is not configured on this server.' })
      const body = await readBody(request)
      const telegramUser = verifyTelegramInitData(body.initData)
      const data = readData()
      const now = new Date().toISOString()
      let customer = data.customers.find((item) => item.telegramUserId === telegramUser.id)
      if (!customer) {
        customer = { id: crypto.randomUUID(), name: [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(' ').slice(0, 120) || 'Telegram customer', phone: '', telegramUserId: telegramUser.id, createdAt: now, orderIds: [] }
      }
      data.customers = [customer, ...data.customers.filter((item) => item.id !== customer.id)]
      writeData(data)
      return send(response, 200, { customer: customerSafeProfile(customer) }, { 'Set-Cookie': customerCookieHeader(createCustomerSession(customer)) })
    }
    if (request.method === 'POST' && url.pathname === '/api/admin/login') {
      const body = await readBody(request)
      if (!adminAccount) return send(response, 503, { error: 'Admin setup is required on the server.' })
      if (body.email?.trim().toLowerCase() !== adminAccount.email || !passwordMatches(body.password)) return send(response, 401, { error: 'Admin email or password is incorrect.' })
      const token = crypto.randomBytes(32).toString('hex')
      sessions.set(token, { type: 'admin', email: adminAccount.email, createdAt: Date.now() })
      return send(response, 200, { admin: { email: adminAccount.email, languagePreference: adminAccount.languagePreference === 'my' ? 'my' : adminAccount.languagePreference === 'en' ? 'en' : '' } }, { 'Set-Cookie': `hto_admin_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secureCookie}` })
    }
    if (request.method === 'POST' && url.pathname === '/api/admin/logout') {
      const token = cookieValue(request, 'hto_admin_session'); if (token) sessions.delete(token)
      return send(response, 200, { ok: true }, { 'Set-Cookie': `hto_admin_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secureCookie}` })
    }
    if (request.method === 'GET' && url.pathname === '/api/customer/session') {
      const session = customerSession(request); const data = readData(); const customer = session && data.customers.find((item) => item.id === session.customerId)
      return send(response, 200, { customer: customerSafeProfile(customer) })
    }
    if (request.method === 'DELETE' && url.pathname === '/api/customer/account') {
      const session = customerOnly(request, response); if (!session) return
      const data = readData()
      const customer = data.customers.find((item) => item.id === session.customerId)
      if (!customer) return send(response, 404, { error: 'Customer account was not found.' })
      data.customers = data.customers.filter((item) => item.id !== session.customerId)
      data.orders = data.orders.map((order) => order.customer?.userId === session.customerId
        ? { ...order, customer: { ...order.customer, userId: null, name: 'Deleted customer', phone: '', address: '' } }
        : order)
      for (const [token, activeSession] of sessions) {
        if (activeSession.type === 'customer' && activeSession.customerId === session.customerId) sessions.delete(token)
      }
      writeData(data)
      return send(response, 200, { ok: true }, { 'Set-Cookie': `${customerCookie}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secureCookie}` })
    }
    if (request.method === 'POST' && url.pathname === '/api/customer/telegram/link') {
      const session = customerOnly(request, response); if (!session) return
      if (!process.env.TELEGRAM_BOT_TOKEN) return send(response, 503, { error: 'Telegram account linking is not configured on this server.' })
      const body = await readBody(request)
      const telegramUser = verifyTelegramInitData(body.initData)
      const data = readData()
      const customer = data.customers.find((item) => item.id === session.customerId)
      if (!customer) return send(response, 404, { error: 'Customer not found.' })
      const linkedToAnother = data.customers.some((item) => item.telegramUserId === telegramUser.id && item.id !== customer.id)
      if (linkedToAnother) return send(response, 409, { error: 'This Telegram account is already linked to another customer account.' })
      customer.telegramUserId = telegramUser.id
      data.customers = data.customers.map((item) => item.id === customer.id ? customer : item)
      writeData(data)
      return send(response, 200, { linked: true, customer: customerSafeProfile(customer) })
    }
    if (url.pathname === '/api/customer/cart') {
      const session = customerOnly(request, response); if (!session) return
      const data = readData()
      const customer = data.customers.find((item) => item.id === session.customerId)
      if (!customer) return send(response, 404, { error: 'Customer not found.' })
      if (request.method === 'GET') {
        const cart = (Array.isArray(customer.cart) ? customer.cart : []).flatMap((item) => {
          const product = data.products.find((candidate) => String(candidate.id) === String(item.productId) && candidate.enabled !== false)
          if (!product) return []
          const variants = item.variants || {}
          const cartKey = `${product.id}:${variants.size || ''}:${variants.color || ''}`
          return [{ id: product.id, cartKey, name: product.nameEn || product.name, price: Number(product.discountPrice ?? product.price), image: product.image || product.images?.[0] || '', sku: product.sku || '', variants, quantity: item.quantity, selected: item.selected !== false }]
        })
        return send(response, 200, { cart })
      }
      if (request.method === 'PUT') {
        const body = await readBody(request)
        if (!Array.isArray(body.items) || body.items.length > 100) return send(response, 400, { error: 'Cart must contain no more than 100 items.' })
        const normalized = []
        const requestedByProduct = new Map()
        const requestedByVariant = new Map()
        for (const item of body.items) {
          const productId = String(item.id || item.productId || '')
          const product = data.products.find((candidate) => String(candidate.id) === productId && candidate.enabled !== false)
          const quantity = Number(item.quantity)
          if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 999) return send(response, 400, { error: 'Cart contains an unavailable product or invalid quantity.' })
          const totalRequested = (requestedByProduct.get(productId) || 0) + quantity
          requestedByProduct.set(productId, totalRequested)
          if (totalRequested > Number(product.stock || 0)) return send(response, 400, { error: `Cart quantity exceeds available stock for ${product.nameEn || product.name}.` })
          const variants = {
            ...(item.variants?.size ? { size: String(item.variants.size) } : {}),
            ...(item.variants?.color ? { color: String(item.variants.color) } : {})
          }
          const { sizes, colors } = productVariantOptions(product)
          if ((sizes.length && !sizes.includes(variants.size)) || (colors.length && !colors.includes(variants.color))) return send(response, 400, { error: 'Cart contains an unavailable product variant.' })
          if (product.variantStock && Object.keys(product.variantStock).length) {
            const key = productVariantStockKey(variants)
            const byVariant = requestedByVariant.get(productId) || new Map()
            const variantRequested = (byVariant.get(key) || 0) + quantity
            byVariant.set(key, variantRequested)
            requestedByVariant.set(productId, byVariant)
            if (variantRequested > Number(product.variantStock[key] || 0)) return send(response, 400, { error: `Cart quantity exceeds available stock for ${product.nameEn || product.name} (${[variants.size, variants.color].filter(Boolean).join(' · ')}).` })
          }
          const existing = normalized.find((entry) => entry.productId === productId && entry.variants.size === variants.size && entry.variants.color === variants.color)
          if (existing) existing.quantity = Math.min(999, existing.quantity + quantity)
          else normalized.push({ productId, quantity, variants, selected: item.selected !== false })
        }
        customer.cart = normalized
        data.customers = data.customers.map((item) => item.id === customer.id ? customer : item)
        writeData(data)
        return send(response, 200, { ok: true })
      }
      return send(response, 405, { error: 'Method not allowed.' })
    }
    if (request.method === 'POST' && url.pathname === '/api/customer/phone/request') {
      const body = await readBody(request)
      const phone = phoneE164(body.phone)
      const mode = body.mode === 'signup' ? 'signup' : body.mode === 'reset-password' ? 'reset-password' : ''
      const name = String(body.name || '').trim()
      if (!mode) return send(response, 400, { error: 'Invalid phone verification request.' })
      if (!validPhone(body.phone) || !phone ||
        (mode === 'signup' && (!name || name.length > 120 || !validPassword(body.password)))) {
        return send(response, 400, { error: mode === 'signup' ? 'Enter a valid name, phone number, and password of at least 8 characters.' : 'Enter a valid Myanmar phone number.' })
      }
      const provider = phoneOtpProvider()
      if (!provider) {
        const message = process.env.NODE_ENV === 'production'
          ? 'Phone verification is not configured. Set up Twilio Verify credentials.'
          : 'Phone verification is not configured. Set up Twilio Verify or enable local mock OTP mode.'
        return send(response, 503, { error: message })
      }
      const data = readData()
      pruneAuthState(data)
      const matchingCustomer = data.customers.find((item) =>
        item.phone && phoneE164(item.phone) === phone && item.phoneVerified
      )
      if (mode === 'signup' && matchingCustomer) {
        return send(response, 409, { error: 'An account already exists for this phone number. Please log in instead.' })
      }
      if (mode === 'reset-password' && !matchingCustomer) {
        return send(response, 404, { error: 'No account was found for this phone number.' })
      }
      const phoneHash = crypto.createHash('sha256').update(phone).digest('hex')
      const ip = request.socket.remoteAddress || 'unknown'
      const retryAfter = Math.max(
        authRateLimit(data, `phone-otp:${phoneHash}`, 5, 60 * 60 * 1000),
        authRateLimit(data, `phone-otp-ip:${ip}`, 20, 60 * 60 * 1000),
        authRateLimit(data, `phone-otp-cooldown:${phoneHash}`, 1, 60 * 1000)
      )
      if (retryAfter) {
        writeData(data)
        return send(response, 429, { error: 'Too many code requests. Please try again later.' }, { 'Retry-After': String(retryAfter) })
      }
      writeData(data)
      if (provider === 'twilio') {
        try {
          const verification = await twilioVerifyRequest('Verifications', { To: phone, Channel: 'sms' })
          if (verification.status !== 'pending') throw new Error('Twilio Verify did not start a pending verification.')
        } catch (verifyError) {
          console.error('[auth] Twilio phone verification could not be started:', verifyError.message)
          return send(response, 502, { error: 'Unable to send a verification code. Please try again later.' })
        }
      }
      const latestData = readData()
      pruneAuthState(latestData)
      for (const [id, challenge] of Object.entries(latestData.authChallenges)) {
        if (challenge.purpose === 'phone' && challenge.phone === phone) delete latestData.authChallenges[id]
      }
      const challengeId = crypto.randomUUID()
      const passwordSalt = mode === 'signup' ? crypto.randomBytes(16).toString('hex') : ''
      latestData.authChallenges[challengeId] = {
        purpose: 'phone',
        phone,
        mode,
        name,
        ...(mode === 'signup' ? {
          passwordSalt,
          passwordHash: hashPassword(body.password, passwordSalt)
        } : {}),
        provider,
        ...(provider === 'mock' ? { otpHash: otpHash(phone, DEVELOPMENT_PHONE_OTP, 'phone', challengeId) } : {}),
        attempts: 0,
        expiresAt: Date.now() + 10 * 60 * 1000
      }
      writeData(latestData)
      return send(response, 200, {
        challengeId,
        phone,
        ...(provider === 'mock' ? { developmentOnlyCode: DEVELOPMENT_PHONE_OTP } : {})
      })
    }
    if (request.method === 'POST' && url.pathname === '/api/customer/phone/resend') {
      const body = await readBody(request)
      const challengeId = String(body.challengeId || '')
      const data = readData()
      const challenge = data.authChallenges[challengeId]
      if (!challenge || challenge.purpose !== 'phone' || challenge.expiresAt <= Date.now() ||
        (challenge.provider === 'mock' && process.env.NODE_ENV === 'production')) {
        return send(response, 400, { error: 'This verification request expired. Enter your phone number to request a new code.' })
      }
      const phoneHash = crypto.createHash('sha256').update(challenge.phone).digest('hex')
      const ip = request.socket.remoteAddress || 'unknown'
      const retryAfter = Math.max(
        authRateLimit(data, `phone-otp:${phoneHash}`, 5, 60 * 60 * 1000),
        authRateLimit(data, `phone-otp-ip:${ip}`, 20, 60 * 60 * 1000),
        authRateLimit(data, `phone-otp-cooldown:${phoneHash}`, 1, 60 * 1000)
      )
      if (retryAfter) {
        writeData(data)
        return send(response, 429, { error: 'Too many code requests. Please try again later.' }, { 'Retry-After': String(retryAfter) })
      }
      writeData(data)
      if (challenge.provider === 'twilio') {
        try {
          const verification = await twilioVerifyRequest('Verifications', { To: challenge.phone, Channel: 'sms' })
          if (verification.status !== 'pending') throw new Error('Twilio Verify did not start a pending verification.')
        } catch (verifyError) {
          console.error('[auth] Twilio phone verification could not be resent:', verifyError.message)
          return send(response, 502, { error: 'Unable to resend the verification code. Please try again later.' })
        }
      }
      const latestData = readData()
      const latestChallenge = latestData.authChallenges[challengeId]
      if (!latestChallenge || latestChallenge.purpose !== 'phone' || latestChallenge.expiresAt <= Date.now()) {
        return send(response, 400, { error: 'This verification request expired. Enter your phone number to request a new code.' })
      }
      latestChallenge.attempts = 0
      latestChallenge.expiresAt = Date.now() + 10 * 60 * 1000
      writeData(latestData)
      return send(response, 200, {
        challengeId,
        phone: latestChallenge.phone,
        ...(latestChallenge.provider === 'mock' ? { developmentOnlyCode: DEVELOPMENT_PHONE_OTP } : {})
      })
    }
    if (request.method === 'POST' && url.pathname === '/api/customer/phone/verify') {
      const body = await readBody(request)
      const challengeId = String(body.challengeId || '')
      const otp = String(body.otp || '')
      if (!/^\d{6}$/.test(otp)) return send(response, 400, { error: 'Enter the 6-digit verification code.' })
      const data = readData()
      const challenge = data.authChallenges[challengeId]
      if (!challenge || challenge.purpose !== 'phone' || challenge.expiresAt <= Date.now()) {
        delete data.authChallenges[challengeId]
        writeData(data)
        return send(response, 400, { error: 'This verification code expired. Request a new one.' })
      }
      if (challenge.provider === 'mock' && process.env.NODE_ENV === 'production') {
        delete data.authChallenges[challengeId]
        writeData(data)
        return send(response, 400, { error: 'Local test verification cannot be used in production. Request a new code.' })
      }
      challenge.attempts += 1
      if (challenge.attempts > 5) {
        delete data.authChallenges[challengeId]
        writeData(data)
        return send(response, 429, { error: 'Too many incorrect codes. Request a new verification code.' })
      }
      writeData(data)
      if (challenge.provider === 'mock') {
        const submitted = Buffer.from(otpHash(challenge.phone, otp, 'phone', challengeId), 'hex')
        const expected = Buffer.from(challenge.otpHash || '', 'hex')
        if (submitted.length !== expected.length || !crypto.timingSafeEqual(submitted, expected)) {
          return send(response, 400, { error: 'The verification code is incorrect.' })
        }
      } else if (challenge.provider === 'twilio') {
        try {
          const verification = await twilioVerifyRequest('VerificationCheck', { To: challenge.phone, Code: otp })
          if (verification.status !== 'approved') return send(response, 400, { error: 'The verification code is incorrect.' })
        } catch (verifyError) {
          if (verifyError.status === 400 || verifyError.status === 404) return send(response, 400, { error: 'The verification code is incorrect or expired.' })
          if (verifyError.status === 429) return send(response, 429, { error: 'Too many verification attempts. Please wait before trying again.' })
          console.error('[auth] Twilio phone code could not be checked:', verifyError.message)
          return send(response, 502, { error: 'Unable to verify the code right now. Please try again.' })
        }
      } else {
        return send(response, 503, { error: 'Phone verification provider is unavailable. Request a new code later.' })
      }
      const latestData = readData()
      const latestChallenge = latestData.authChallenges[challengeId]
      if (!latestChallenge || latestChallenge.purpose !== 'phone' || latestChallenge.expiresAt <= Date.now()) {
        return send(response, 400, { error: 'This verification request has already been used or expired. Request a new code.' })
      }
      const normalizedPhone = phoneE164(latestChallenge.phone)
      let customer = latestData.customers.find((item) =>
        item.phoneVerified && item.phone && phoneE164(item.phone) === normalizedPhone
      )
      const unverifiedPhoneAccount = latestData.customers.some((item) =>
        !item.phoneVerified && item.phone && phoneE164(item.phone) === normalizedPhone
      )
      if (customer && latestChallenge.mode === 'signup') {
        delete latestData.authChallenges[challengeId]
        writeData(latestData)
        return send(response, 409, { error: 'An account already exists for this phone number. Please log in instead.' })
      }
      if (!customer && unverifiedPhoneAccount) {
        delete latestData.authChallenges[challengeId]
        writeData(latestData)
        return send(response, 409, { error: 'This phone number is already linked to an account that has not verified it. Contact support to link it safely.' })
      }
      if (!customer && latestChallenge.mode !== 'signup') {
        delete latestData.authChallenges[challengeId]
        writeData(latestData)
        return send(response, 404, { error: 'No account was found for this phone number. Create an account to continue.' })
      }
      if (!customer) {
        customer = {
          id: crypto.randomUUID(),
          name: latestChallenge.name,
          email: '',
          phone: normalizedPhone,
          phoneVerified: true,
          phoneVerifiedAt: new Date().toISOString(),
          salt: latestChallenge.passwordSalt,
          passwordHash: latestChallenge.passwordHash,
          authProvider: 'phone',
          createdAt: new Date().toISOString(),
          orderIds: []
        }
      } else {
        customer.phone = normalizedPhone
        customer.phoneVerified = true
        customer.phoneVerifiedAt = customer.phoneVerifiedAt || new Date().toISOString()
        customer.lastLoginAt = new Date().toISOString()
      }
      latestData.customers = [customer, ...latestData.customers.filter((item) => item.id !== customer.id)]
      for (const [id, item] of Object.entries(latestData.authChallenges)) {
        if (item.purpose === 'phone' && item.phone === normalizedPhone) delete latestData.authChallenges[id]
      }
      writeData(latestData)
      return send(response, 200, { customer: customerSafeProfile(customer) }, { 'Set-Cookie': customerCookieHeader(createCustomerSession(customer, 2592000), 2592000) })
    }
    if (request.method === 'POST' && url.pathname === '/api/customer/phone/login') {
      const body = await readBody(request)
      const phone = phoneE164(body.phone)
      if (!validPhone(body.phone) || !phone) return send(response, 400, { error: 'Enter a valid Myanmar phone number.' })
      const data = readData()
      pruneAuthState(data)
      const phoneHash = crypto.createHash('sha256').update(phone).digest('hex')
      const ip = request.socket.remoteAddress || 'unknown'
      const retryAfter = Math.max(
        authRateLimit(data, `phone-login:${ip}:${phoneHash}`, 10, 15 * 60 * 1000),
        authRateLimit(data, `phone-login-ip:${ip}`, 30, 15 * 60 * 1000)
      )
      if (retryAfter) {
        writeData(data)
        return send(response, 429, { error: 'Too many login attempts. Please try again later.' }, { 'Retry-After': String(retryAfter) })
      }
      writeData(data)
      const customer = data.customers.find((item) =>
        item.phoneVerified && item.phone && phoneE164(item.phone) === phone
      )
      const password = typeof body.password === 'string' && body.password.length <= 256 ? body.password : ''
      const actual = customer?.salt && customer?.passwordHash ? Buffer.from(hashPassword(password, customer.salt), 'hex') : Buffer.alloc(0)
      const expected = customer?.passwordHash ? Buffer.from(customer.passwordHash, 'hex') : Buffer.alloc(0)
      if (!customer || !expected.length || actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
        return send(response, 401, { error: 'Phone number or password is incorrect.' })
      }
      customer.lastLoginAt = new Date().toISOString()
      data.customers = data.customers.map((item) => item.id === customer.id ? customer : item)
      writeData(data)
      const maxAge = 2592000
      return send(response, 200, { customer: customerSafeProfile(customer) }, { 'Set-Cookie': customerCookieHeader(createCustomerSession(customer, maxAge), maxAge) })
    }
    if (request.method === 'POST' && url.pathname === '/api/customer/phone/password') {
      const session = customerOnly(request, response)
      if (!session) return
      const body = await readBody(request)
      if (!validPassword(body.password)) return send(response, 400, { error: 'Password must be at least 8 characters.' })
      const data = readData()
      const customer = data.customers.find((item) => item.id === session.customerId)
      if (!customer || !customer.phoneVerified) return send(response, 404, { error: 'Phone-verified customer account was not found.' })
      const salt = crypto.randomBytes(16).toString('hex')
      customer.salt = salt
      customer.passwordHash = hashPassword(body.password, salt)
      data.customers = data.customers.map((item) => item.id === customer.id ? customer : item)
      writeData(data)
      return send(response, 200, { customer: customerSafeProfile(customer) })
    }
    if (request.method === 'POST' && url.pathname === '/api/customer/register') {
      const body = await readBody(request); const name = String(body.name || '').trim(); const email = normalizeEmail(body.email); const phone = normalizePhone(body.phone)
      if (!name || name.length > 120 || !validEmail(email) || !validPhone(phone) || !validPassword(body.password) || body.password !== body.confirmPassword) return send(response, 400, { error: 'အမည်၊ အီးမေးလ်၊ ဖုန်းနံပါတ်နှင့် အနည်းဆုံး ၈ လုံးရှိသော စကားဝှက်ကို မှန်ကန်စွာ ဖြည့်ပါ။' })
      const data = readData(); pruneAuthState(data)
      const ipRetryAfter = authRateLimit(data, `register-ip:${request.socket.remoteAddress || 'unknown'}`, 10, 60 * 60 * 1000)
      if (ipRetryAfter) { writeData(data); return send(response, 429, { error: 'Too many registration attempts. Please try again later.' }, { 'Retry-After': String(ipRetryAfter) }) }
      const existingEmail = data.customers.find((item) => normalizeEmail(item.email) === email)
      if (existingEmail?.passwordHash) return send(response, 409, { error: 'ဤအီးမေးလ်ဖြင့် အကောင့်ရှိပြီးသား ဖြစ်ပါသည်။' })
      const existingPhone = data.customers.find((item) => item.phone && normalizePhone(item.phone) === phone)
      if (existingPhone?.email && normalizeEmail(existingPhone.email) !== email) return send(response, 409, { error: 'ဤဖုန်းနံပါတ်ဖြင့် အကောင့်ရှိပြီးသား ဖြစ်ပါသည်။' })
      if (!emailTransport()) return send(response, 503, { error: 'Email verification service is not configured. Please contact support.' })
      const salt = crypto.randomBytes(16).toString('hex')
      const existing = existingEmail || existingPhone
      const pendingCustomer = { ...(existing || {}), id: existing?.id || crypto.randomUUID(), name, email, phone, salt, passwordHash: hashPassword(body.password, salt), emailVerified: false, authProvider: 'password', createdAt: existing?.createdAt || new Date().toISOString(), orderIds: existing?.orderIds || [] }
      const challenge = createAuthChallenge(data, { email, purpose: 'verify', customerId: pendingCustomer.id, pendingCustomer })
      if (challenge.retryAfter) return send(response, 429, { error: 'Too many code requests. Please try again later.' }, { 'Retry-After': String(challenge.retryAfter) })
      try { await sendBuyerOtp(email, challenge.otp, 'verify') } catch (mailError) { console.error('[auth] Registration verification email failed:', mailError.message); delete data.authChallenges[challenge.id]; return send(response, 503, { error: 'Unable to send the verification email. Please try again later.' }) }
      writeData(data)
      return send(response, 201, { challengeId: challenge.id, message: 'Verification code sent.' })
    }
    if (request.method === 'POST' && url.pathname === '/api/customer/otp/resend') {
      const body = await readBody(request); const challengeId = String(body.challengeId || ''); const data = readData(); const previous = data.authChallenges[challengeId]
      if (!previous || !['verify', 'reset'].includes(previous.purpose) || previous.expiresAt <= Date.now()) return send(response, 400, { error: 'Verification request has expired. Please try again.' })
      const challenge = createAuthChallenge(data, { email: previous.email, purpose: previous.purpose, customerId: previous.customerId, pendingCustomer: previous.pendingCustomer })
      if (challenge.retryAfter) { writeData(data); return send(response, 429, { error: 'Please wait before requesting another code.' }, { 'Retry-After': String(challenge.retryAfter) }) }
      if (previous.purpose === 'verify' || previous.customerId) {
        try { await sendBuyerOtp(previous.email, challenge.otp, previous.purpose) } catch (mailError) {
          console.error('[auth] Resend verification email failed:', mailError.message)
          delete data.authChallenges[challenge.id]
          delete data.authChallenges[challengeId]
          writeData(data)
          if (previous.purpose === 'reset') return send(response, 200, { challengeId: challenge.id, message: 'If an account exists, a reset code has been sent.' })
          return send(response, 503, { error: 'Unable to resend the verification email. Please try again later.' })
        }
      }
      delete data.authChallenges[challengeId]
      writeData(data)
      return send(response, 200, { challengeId: challenge.id, message: 'Verification code sent.' })
    }
    if (request.method === 'POST' && url.pathname === '/api/customer/otp/verify') {
      const body = await readBody(request); const challengeId = String(body.challengeId || ''); const otp = String(body.otp || '')
      if (!/^\d{6}$/.test(otp)) return send(response, 400, { error: 'Enter the 6-digit verification code.' })
      const data = readData(); const challenge = data.authChallenges[challengeId]
      if (!challenge || challenge.purpose !== 'verify' || challenge.expiresAt <= Date.now()) { delete data.authChallenges[challengeId]; writeData(data); return send(response, 400, { error: 'This verification code has expired. Please request a new one.' }) }
      challenge.attempts += 1
      const submitted = Buffer.from(otpHash(challenge.email, otp, challenge.purpose, challengeId), 'hex')
      const expected = Buffer.from(challenge.otpHash, 'hex')
      if (challenge.attempts > 5) { delete data.authChallenges[challengeId]; writeData(data); return send(response, 429, { error: 'Too many incorrect codes. Please register again.' }) }
      if (submitted.length !== expected.length || !crypto.timingSafeEqual(submitted, expected)) { writeData(data); return send(response, 400, { error: 'The verification code is incorrect.' }) }
      const customer = { ...challenge.pendingCustomer, emailVerified: true, emailVerifiedAt: new Date().toISOString() }
      data.customers = [customer, ...data.customers.filter((item) => item.id !== customer.id)]
      delete data.authChallenges[challengeId]
      writeData(data)
      return send(response, 200, { customer: customerSafeProfile(customer) }, { 'Set-Cookie': customerCookieHeader(createCustomerSession(customer, 2592000), 2592000) })
    }
    if (request.method === 'POST' && url.pathname === '/api/customer/login') {
      const body = await readBody(request); const email = normalizeEmail(body.email); const data = readData(); pruneAuthState(data)
      const ip = request.socket.remoteAddress || 'unknown'
      const retryAfter = Math.max(authRateLimit(data, `login:${ip}:${email}`, 10, 15 * 60 * 1000), authRateLimit(data, `login-ip:${ip}`, 30, 15 * 60 * 1000))
      if (retryAfter) { writeData(data); return send(response, 429, { error: 'Too many login attempts. Please try again later.' }, { 'Retry-After': String(retryAfter) }) }
      writeData(data)
      const customer = data.customers.find((item) => normalizeEmail(item.email) === email)
      const actual = customer?.salt && customer?.passwordHash ? Buffer.from(hashPassword(body.password || '', customer.salt), 'hex') : Buffer.alloc(0); const expected = customer?.passwordHash ? Buffer.from(customer.passwordHash, 'hex') : Buffer.alloc(0)
      if (!customer || !expected.length || actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return send(response, 401, { error: 'အီးမေးလ် သို့မဟုတ် စကားဝှက် မမှန်ကန်ပါ။' })
      if (!customer.emailVerified) return send(response, 403, { error: 'Please verify your email before signing in.' })
      customer.lastLoginAt = new Date().toISOString()
      data.customers = data.customers.map((item) => item.id === customer.id ? customer : item)
      writeData(data)
      const maxAge = body.remember ? 2592000 : 28800
      return send(response, 200, { customer: customerSafeProfile(customer) }, { 'Set-Cookie': customerCookieHeader(createCustomerSession(customer, maxAge), maxAge) })
    }
    if (request.method === 'POST' && url.pathname === '/api/customer/logout') {
      const token = cookieValue(request, customerCookie); if (token) sessions.delete(token)
      return send(response, 200, { ok: true }, { 'Set-Cookie': customerCookieHeader('', 0) })
    }
    if (request.method === 'GET' && ['/api/customer/google', '/api/customer/google/link'].includes(url.pathname)) {
      const linkCustomerId = url.pathname.endsWith('/link') ? customerOnly(request, response)?.customerId : ''
      if (url.pathname.endsWith('/link') && !linkCustomerId) return
      const result = beginExternalOAuth('google', linkCustomerId)
      return send(response, result.status, result.status === 200 ? { url: result.url } : { error: result.error }, result.cookie ? { 'Set-Cookie': result.cookie } : {})
    }
    if (request.method === 'GET' && ['/api/customer/telegram', '/api/customer/telegram/link'].includes(url.pathname)) {
      const linkCustomerId = url.pathname.endsWith('/link') ? customerOnly(request, response)?.customerId : ''
      if (url.pathname.endsWith('/link') && !linkCustomerId) return
      const result = beginExternalOAuth('telegram', linkCustomerId)
      return send(response, result.status, result.status === 200 ? { url: result.url } : { error: result.error }, result.cookie ? { 'Set-Cookie': result.cookie } : {})
    }
    if (request.method === 'POST' && ['/api/customer/google/callback', '/api/customer/telegram/callback'].includes(url.pathname)) {
      const provider = url.pathname.includes('/google/') ? 'google' : 'telegram'
      const body = await readBody(request)
      const state = typeof body.state === 'string' ? body.state : ''
      const transaction = oauthTransactions.get(state)
      if (transaction) oauthTransactions.delete(state)
      const stateCookie = cookieValue(request, `hto_${provider}_state`)
      const stateCookieBuffer = Buffer.from(stateCookie || '')
      const stateBuffer = Buffer.from(state)
      const authorizationCode = typeof body.code === 'string' ? body.code : ''
      const clearStateCookie = oauthStateCookie(provider)
      if (!transaction || transaction.provider !== provider || transaction.expiresAt <= Date.now() ||
        !stateCookie || stateCookieBuffer.length !== stateBuffer.length || !crypto.timingSafeEqual(stateCookieBuffer, stateBuffer) ||
        authorizationCode.length < 1 || authorizationCode.length > 4096 || /[\r\n]/.test(authorizationCode)) {
        return send(response, 400, { error: `${provider === 'google' ? 'Google' : 'Telegram'} sign-in expired. Please try again.` }, { 'Set-Cookie': clearStateCookie })
      }
      if (transaction.customerId && customerSession(request)?.customerId !== transaction.customerId) {
        return send(response, 401, { error: 'Sign in to the same HTOO account before completing account linking.' }, { 'Set-Cookie': clearStateCookie })
      }
      let profile
      try {
        profile = provider === 'google'
          ? await googleFetchProfile(authorizationCode, transaction)
          : await telegramFetchProfile(authorizationCode, transaction)
      } catch (oauthError) {
        console.error(`[auth] ${provider} sign-in failed:`, oauthError.message)
        return send(response, 401, { error: `${provider === 'google' ? 'Google' : 'Telegram'} sign-in could not be verified. Please try again.` }, { 'Set-Cookie': clearStateCookie })
      }
      const data = readData()
      let customer
      try {
        customer = customerForExternalIdentity(data, provider, profile, transaction.customerId)
      } catch (linkError) {
        return send(response, linkError.statusCode || 409, { error: linkError.message }, { 'Set-Cookie': clearStateCookie })
      }
      writeData(data)
      const headers = transaction.customerId
        ? { 'Set-Cookie': clearStateCookie }
        : { 'Set-Cookie': [customerCookieHeader(createCustomerSession(customer, 2592000), 2592000), clearStateCookie] }
      return send(response, 200, { customer: customerSafeProfile(customer), linked: Boolean(transaction.customerId) }, headers)
    }
    if (request.method === 'POST' && url.pathname === '/api/customer/recovery-email/request') {
      const session = customerOnly(request, response); if (!session) return
      const body = await readBody(request)
      const email = normalizeEmail(body.email)
      if (!validEmail(email) || email.length > 254) return send(response, 400, { error: 'Enter a valid recovery email address.' })
      const data = readData()
      const customer = data.customers.find((item) => item.id === session.customerId)
      if (!customer) return send(response, 404, { error: 'Customer account was not found.' })
      if (customer.emailVerified) return send(response, 409, { error: 'A verified recovery email is already set. Contact HTOO support if you need to change it.' })
      if (customer.email && normalizeEmail(customer.email) !== email) return send(response, 409, { error: 'Verify the email already on this account before changing account recovery details.' })
      if (data.customers.some((item) => item.id !== customer.id && normalizeEmail(item.email) === email)) return send(response, 409, { error: 'That email is already used by another HTOO account.' })
      if (!emailTransport()) return send(response, 503, { error: 'Email verification is not configured. Contact HTOO support for account recovery.' })
      pruneAuthState(data)
      const retryAfter = authRateLimit(data, `recovery-email:${session.customerId}:${email}`, 5, 60 * 60 * 1000)
      if (retryAfter) { writeData(data); return send(response, 429, { error: 'Too many recovery-email requests. Please try again later.' }, { 'Retry-After': String(retryAfter) }) }
      const challenge = createAuthChallenge(data, { email, purpose: 'recovery-email', customerId: customer.id })
      if (challenge.retryAfter) { writeData(data); return send(response, 429, { error: 'Please wait before requesting another verification code.' }, { 'Retry-After': String(challenge.retryAfter) }) }
      try {
        await sendBuyerOtp(email, challenge.otp, 'verify')
      } catch (mailError) {
        console.error('[auth] Recovery-email verification failed:', mailError.message)
        delete data.authChallenges[challenge.id]
        return send(response, 503, { error: 'Unable to send a verification code. Please try again later.' })
      }
      writeData(data)
      return send(response, 200, { challengeId: challenge.id, message: 'A verification code was sent to your recovery email.' })
    }
    if (request.method === 'POST' && url.pathname === '/api/customer/recovery-email/verify') {
      const session = customerOnly(request, response); if (!session) return
      const body = await readBody(request)
      const challengeId = String(body.challengeId || '')
      const otp = String(body.otp || '')
      if (!/^\d{6}$/.test(otp)) return send(response, 400, { error: 'Enter the 6-digit verification code.' })
      const data = readData()
      const challenge = data.authChallenges[challengeId]
      if (!challenge || challenge.purpose !== 'recovery-email' || challenge.customerId !== session.customerId || challenge.expiresAt <= Date.now()) {
        return send(response, 400, { error: 'This recovery verification request expired. Request a new code.' })
      }
      challenge.attempts += 1
      const submitted = Buffer.from(otpHash(challenge.email, otp, challenge.purpose, challengeId), 'hex')
      const expected = Buffer.from(challenge.otpHash, 'hex')
      if (challenge.attempts > 5) {
        delete data.authChallenges[challengeId]
        writeData(data)
        return send(response, 429, { error: 'Too many incorrect codes. Request another verification code.' })
      }
      if (submitted.length !== expected.length || !crypto.timingSafeEqual(submitted, expected)) {
        writeData(data)
        return send(response, 400, { error: 'The verification code is incorrect.' })
      }
      const customer = data.customers.find((item) => item.id === session.customerId)
      if (!customer || customer.emailVerified || (customer.email && normalizeEmail(customer.email) !== challenge.email) ||
        data.customers.some((item) => item.id !== session.customerId && normalizeEmail(item.email) === challenge.email)) {
        delete data.authChallenges[challengeId]
        writeData(data)
        return send(response, 409, { error: 'The recovery email can no longer be attached to this account.' })
      }
      customer.email = challenge.email
      customer.emailVerified = true
      customer.emailVerifiedAt = new Date().toISOString()
      delete data.authChallenges[challengeId]
      data.customers = data.customers.map((item) => item.id === customer.id ? customer : item)
      writeData(data)
      return send(response, 200, { customer: customerSafeProfile(customer) })
    }
    if (request.method === 'POST' && url.pathname === '/api/customer/forgot/request') {
      const body = await readBody(request); const email = normalizeEmail(body.email)
      if (!validEmail(email)) return send(response, 400, { error: 'Enter a valid email address.' })
      const data = readData(); pruneAuthState(data)
      const ip = request.socket.remoteAddress || 'unknown'
      const retryAfter = Math.max(authRateLimit(data, `reset:${ip}:${email}`, 5, 60 * 60 * 1000), authRateLimit(data, `reset-ip:${ip}`, 20, 60 * 60 * 1000))
      if (retryAfter) { writeData(data); return send(response, 429, { error: 'Too many reset requests. Please try again later.' }, { 'Retry-After': String(retryAfter) }) }
      if (!emailTransport()) return send(response, 503, { error: 'Password reset email is not configured. Please contact support.' })
      const customer = data.customers.find((item) => normalizeEmail(item.email) === email)
      const challenge = createAuthChallenge(data, { email, purpose: 'reset', customerId: customer?.id || '' })
      if (challenge.retryAfter) { writeData(data); return send(response, 429, { error: 'Please wait before requesting another code.' }, { 'Retry-After': String(challenge.retryAfter) }) }
      if (customer) {
        try { await sendBuyerOtp(email, challenge.otp, 'reset') } catch (mailError) { console.error('[auth] Password reset email failed:', mailError.message); delete data.authChallenges[challenge.id] }
      }
      writeData(data)
      return send(response, 200, { challengeId: challenge.id, message: 'If an account exists, a reset code has been sent.' })
    }
    if (request.method === 'POST' && url.pathname === '/api/customer/forgot/verify') {
      const body = await readBody(request); const challengeId = String(body.challengeId || ''); const otp = String(body.otp || '')
      if (!/^\d{6}$/.test(otp)) return send(response, 400, { error: 'Enter the 6-digit verification code.' })
      const data = readData(); const challenge = data.authChallenges[challengeId]
      if (!challenge || challenge.purpose !== 'reset' || challenge.expiresAt <= Date.now()) { delete data.authChallenges[challengeId]; writeData(data); return send(response, 400, { error: 'This reset code has expired. Please request a new one.' }) }
      challenge.attempts += 1
      const submitted = Buffer.from(otpHash(challenge.email, otp, challenge.purpose, challengeId), 'hex'); const expected = Buffer.from(challenge.otpHash, 'hex')
      if (challenge.attempts > 5) { delete data.authChallenges[challengeId]; writeData(data); return send(response, 429, { error: 'Too many incorrect codes. Please request another reset code.' }) }
      if (submitted.length !== expected.length || !crypto.timingSafeEqual(submitted, expected)) { writeData(data); return send(response, 400, { error: 'The verification code is incorrect.' }) }
      challenge.verified = true
      const resetToken = crypto.randomBytes(32).toString('base64url')
      challenge.resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex')
      challenge.expiresAt = Date.now() + 10 * 60 * 1000
      writeData(data)
      return send(response, 200, { resetToken })
    }
    if (request.method === 'POST' && url.pathname === '/api/customer/forgot/reset') {
      const body = await readBody(request); const data = readData()
      const submittedTokenHash = typeof body.resetToken === 'string' ? Buffer.from(crypto.createHash('sha256').update(body.resetToken).digest('hex'), 'hex') : Buffer.alloc(0)
      const challenge = Object.values(data.authChallenges).find((item) => {
        if (item.purpose !== 'reset' || !item.verified || item.expiresAt <= Date.now() || typeof item.resetTokenHash !== 'string') return false
        const expectedTokenHash = Buffer.from(item.resetTokenHash, 'hex')
        return submittedTokenHash.length === expectedTokenHash.length && crypto.timingSafeEqual(submittedTokenHash, expectedTokenHash)
      })
      if (!challenge || !validPassword(body.password) || body.password !== body.confirmPassword) return send(response, 400, { error: 'The reset request has expired or the passwords do not match.' })
      const customer = data.customers.find((item) => item.id === challenge.customerId)
      if (!customer) return send(response, 400, { error: 'The reset request has expired.' })
      const salt = crypto.randomBytes(16).toString('hex'); customer.salt = salt; customer.passwordHash = hashPassword(body.password, salt); customer.emailVerified = true
      for (const [id, item] of Object.entries(data.authChallenges)) if (item.customerId === customer.id) delete data.authChallenges[id]
      data.customers = data.customers.map((item) => item.id === customer.id ? customer : item); writeData(data)
      return send(response, 200, { ok: true })
    }
    if (request.method === 'GET' && url.pathname === '/api/customer/orders') {
      const session = customerSession(request)
      const guestAccessHash = session ? '' : guestOrderAccessHash(request)
      if (!session && !guestAccessHash) return send(response, 401, { error: 'Customer or guest order access is required.' })
      const data = readData()
      const customer = session ? data.customers.find((item) => item.id === session.customerId) : null
      const myOrders = session
        ? data.orders.filter((order) => isCustomerOrder(order, session.customerId, customer))
        : data.orders.filter((order) => data.guestOrderAccess[order.id] === guestAccessHash)
      return send(response, 200, { orders: myOrders })
    }
    if (request.method === 'GET' && url.pathname.startsWith('/api/customer/orders/')) {
      const session = customerSession(request)
      const guestAccessHash = session ? '' : guestOrderAccessHash(request)
      if (!session && !guestAccessHash) return send(response, 401, { error: 'Customer or guest order access is required.' })
      const orderId = url.pathname.split('/').pop()
      const data = readData()
      const customer = session ? data.customers.find((item) => item.id === session.customerId) : null
      const order = data.orders.find((item) => item.id === orderId || item.orderNumber === orderId)
      if (!order) return send(response, 404, { error: 'Order not found.' })
      if (session ? !isCustomerOrder(order, session.customerId, customer) : data.guestOrderAccess[order.id] !== guestAccessHash) {
        return send(response, 403, { error: 'Access denied. You do not have permission to view this order.' })
      }
      return send(response, 200, { order })
    }
    if (request.method === 'GET' && url.pathname.startsWith('/api/orders/') && url.pathname.endsWith('/chat')) {
      const session = customerOnly(request, response); if (!session) return
      const orderId = url.pathname.split('/')[3]
      const data = readData(); const customer = data.customers.find((item) => item.id === session.customerId)
      const order = data.orders.find((item) => item.id === orderId || item.orderNumber === orderId)
      if (!order) return send(response, 404, { error: 'Order not found.' })
      if (!isCustomerOrder(order, session.customerId, customer)) return send(response, 403, { error: 'Access denied. You do not have permission to view this chat.' })
      const chat = ensureOrderChat(data, order)
      ;(chat.messages || []).forEach((message) => { if (message.senderRole === 'admin') message.readBy = { ...message.readBy, customer: true } })
      chat.updatedAt = new Date().toISOString()
      writeData(data)
      return send(response, 200, { order: { id: order.id, orderNumber: order.orderNumber || order.id, customer: order.customer, items: order.items || [] }, chat: getOrderChatPayload(chat, order), unreadCount: 0 })
    }
    if (request.method === 'POST' && url.pathname.startsWith('/api/orders/') && url.pathname.endsWith('/chat/messages')) {
      const session = customerOnly(request, response); if (!session) return
      const orderId = url.pathname.split('/')[3]
      const body = await readBody(request)
      const data = readData(); const customer = data.customers.find((item) => item.id === session.customerId)
      const order = data.orders.find((item) => item.id === orderId || item.orderNumber === orderId)
      if (!order) return send(response, 404, { error: 'Order not found.' })
      if (!isCustomerOrder(order, session.customerId, customer)) return send(response, 403, { error: 'Access denied. You do not have permission to send chat messages to this order.' })
      const text = String(body.text || '').trim(); const image = normalizeChatImage(body.image)
      if (!text && !image) return send(response, 400, { error: 'A chat message requires text or an image.' })
      const chat = ensureOrderChat(data, order)
      const message = { id: crypto.randomUUID(), orderId: order.id, customerId: session.customerId, senderId: session.customerId, senderRole: 'customer', text, image: image || null, createdAt: new Date().toISOString(), readBy: { customer: true, admin: false } }
      chat.messages = [...(chat.messages || []), message]
      chat.updatedAt = message.createdAt
      writeData(data)
      return send(response, 201, { chat: getOrderChatPayload(chat, order), message })
    }
    if (request.method === 'POST' && url.pathname.startsWith('/api/orders/') && url.pathname.endsWith('/chat/read')) {
      const session = customerOnly(request, response); if (!session) return
      const orderId = url.pathname.split('/')[3]
      const data = readData(); const customer = data.customers.find((item) => item.id === session.customerId)
      const order = data.orders.find((item) => item.id === orderId || item.orderNumber === orderId)
      if (!order) return send(response, 404, { error: 'Order not found.' })
      if (!isCustomerOrder(order, session.customerId, customer)) return send(response, 403, { error: 'Access denied. You do not have permission to access this chat.' })
      const chat = ensureOrderChat(data, order)
      chat.messages = (chat.messages || []).map((message) => {
        if (message.senderRole === 'admin') {
          return { ...message, readBy: { ...message.readBy, customer: true } }
        }
        return message
      })
      chat.updatedAt = new Date().toISOString(); writeData(data)
      return send(response, 200, { ok: true, chat: getOrderChatPayload(chat, order) })
    }
    if (request.method === 'GET' && url.pathname === '/api/admin/session') return adminOnly(request, response) && send(response, 200, { admin: { email: adminAccount.email, languagePreference: adminAccount.languagePreference === 'my' ? 'my' : adminAccount.languagePreference === 'en' ? 'en' : '' } })
    if (request.method === 'POST' && url.pathname === '/api/admin/preferences') {
      if (!adminOnly(request, response)) return
      const body = await readBody(request)
      if (body.languagePreference !== 'my' && body.languagePreference !== 'en') return send(response, 400, { error: 'Language preference must be "my" or "en".' })
      adminAccount.languagePreference = body.languagePreference
      writeAdminAccount()
      return send(response, 200, { languagePreference: adminAccount.languagePreference })
    }
    if (request.method === 'GET' && url.pathname === '/api/admin/order-chat') {
      if (!adminOnly(request, response)) return
      const data = readData()
      const chats = data.orders.map((order) => {
        const chat = ensureOrderChat(data, order)
        const lastMessage = (chat.messages || []).slice(-1)[0] || null
        return {
          orderId: order.id,
          orderNumber: order.orderNumber || order.id,
          customer: order.customer || { name: '', phone: '' },
          lastMessage: lastMessage ? { id: lastMessage.id, text: lastMessage.text || (lastMessage.image ? 'Image' : ''), senderRole: lastMessage.senderRole, createdAt: lastMessage.createdAt } : null,
          unreadCount: orderChatUnreadCount(chat, 'admin'),
          updatedAt: lastMessage?.createdAt || order.createdAt,
          createdAt: order.createdAt
        }
      }).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      return send(response, 200, { chats })
    }
    if (request.method === 'GET' && url.pathname.startsWith('/api/admin/orders/') && url.pathname.endsWith('/chat')) {
      if (!adminOnly(request, response)) return
      const orderId = url.pathname.split('/')[4]
      const data = readData(); const order = data.orders.find((item) => item.id === orderId || item.orderNumber === orderId)
      if (!order) return send(response, 404, { error: 'Order not found.' })
      const chat = ensureOrderChat(data, order)
      chat.messages = (chat.messages || []).map((message) => ({ ...message, readBy: { ...message.readBy, admin: message.senderRole === 'customer' ? true : Boolean(message.readBy?.admin) } }))
      const adminReadMessages = (chat.messages || []).map((message) => {
        if (message.senderRole === 'customer') return { ...message, readBy: { ...message.readBy, admin: true } }
        return message
      })
      chat.messages = adminReadMessages
      chat.updatedAt = new Date().toISOString(); writeData(data)
      return send(response, 200, { order: { id: order.id, orderNumber: order.orderNumber || order.id, customer: order.customer, items: order.items || [] }, chat: getOrderChatPayload(chat, order), unreadCount: 0 })
    }
    if (request.method === 'POST' && url.pathname.startsWith('/api/admin/orders/') && url.pathname.endsWith('/chat/messages')) {
      if (!adminOnly(request, response)) return
      const orderId = url.pathname.split('/')[4]
      const body = await readBody(request)
      const data = readData(); const order = data.orders.find((item) => item.id === orderId || item.orderNumber === orderId)
      if (!order) return send(response, 404, { error: 'Order not found.' })
      const text = String(body.text || '').trim(); const image = normalizeChatImage(body.image)
      if (!text && !image) return send(response, 400, { error: 'A chat message requires text or an image.' })
      const chat = ensureOrderChat(data, order)
      const message = { id: crypto.randomUUID(), orderId: order.id, customerId: order.customer?.userId || null, senderId: 'admin', senderRole: 'admin', text, image: image || null, createdAt: new Date().toISOString(), readBy: { customer: false, admin: true } }
      chat.messages = [...(chat.messages || []), message]
      chat.updatedAt = message.createdAt
      writeData(data)
      return send(response, 201, { chat: getOrderChatPayload(chat, order), message })
    }
    if (request.method === 'POST' && url.pathname.startsWith('/api/admin/orders/') && url.pathname.endsWith('/chat/read')) {
      if (!adminOnly(request, response)) return
      const orderId = url.pathname.split('/')[4]
      const data = readData(); const order = data.orders.find((item) => item.id === orderId || item.orderNumber === orderId)
      if (!order) return send(response, 404, { error: 'Order not found.' })
      const chat = ensureOrderChat(data, order)
      chat.messages = (chat.messages || []).map((message) => {
        if (message.senderRole === 'customer') {
          return { ...message, readBy: { ...message.readBy, admin: true } }
        }
        return message
      })
      chat.updatedAt = new Date().toISOString(); writeData(data)
      return send(response, 200, { ok: true, chat: getOrderChatPayload(chat, order) })
    }
    if (url.pathname.startsWith('/api/admin/payments')) {
      if (!adminOnly(request, response)) return
      if (request.method === 'GET') {
        const payments = readPayments()
        return send(response, 200, { payments })
      }
      if (request.method === 'POST' && url.pathname === '/api/admin/payments') {
        const body = await readBody(request)
        const name = String(body.name || '').trim()
        const type = body.type === 'bank' ? 'bank' : 'wallet'
        const accountName = String(body.accountName || '').trim()
        const phoneNumber = String(body.phoneNumber || '').trim()
        const bankName = String(body.bankName || '').trim()
        const accountNumber = String(body.accountNumber || '').trim()
        const qrCode = body.qrCode ? normalizeChatImage(body.qrCode) : ''
        if (!name || name.length > 60 || !accountName || (type === 'bank' ? !bankName || !accountNumber : !phoneNumber) || (body.qrCode && !qrCode)) {
          return send(response, 400, { error: 'Enter a payment name, account holder, valid account details, and a supported QR image.' })
        }
        const payments = readPayments()
        const id = `custom-${crypto.randomUUID()}`
        const isEnabled = body.status ? body.status === 'Active' : body.enabled !== false
        const payment = { id, name, type, accountName, phoneNumber, bankName, accountNumber, qrCode, enabled: isEnabled }
        payments[id] = payment
        writePayments(payments)
        const data = readData(); auditAdminAction(data, request, `Added payment account: ${name}.`); writeData(data)
        return send(response, 201, { payment })
      }
      if (request.method === 'PATCH' && url.pathname.startsWith('/api/admin/payments/')) {
        const methodId = url.pathname.split('/').pop()
        const body = await readBody(request)
        const payments = readPayments()
        if (!payments[methodId]) return send(response, 404, { error: 'Payment method not found.' })
        const updated = {
          ...payments[methodId],
          ...body,
          id: payments[methodId].id,
          name: body.name ? String(body.name).trim() : payments[methodId].name,
          nameMyanmar: payments[methodId].nameMyanmar || payments[methodId].name,
          type: body.type ? (body.type === 'bank' ? 'bank' : body.type === 'cash' ? 'cash' : 'wallet') : (payments[methodId].type || (methodId === 'bank' ? 'bank' : methodId === 'cod' ? 'cash' : 'wallet'))
        }
        if (body.status === 'Active') updated.enabled = true
        if (body.status === 'Inactive') updated.enabled = false
        if (methodId !== 'bank' && methodId !== 'cod' && updated.type !== 'bank' && typeof updated.accountName !== 'string') throw new Error('Account name is required.')
        if (methodId !== 'bank' && methodId !== 'cod' && updated.type !== 'bank' && typeof updated.phoneNumber !== 'string') throw new Error('Phone number is required.')
        if (methodId === 'bank' || updated.type === 'bank') {
          if (typeof updated.accountName !== 'string') throw new Error('Account name is required.')
          if (typeof updated.bankName !== 'string') throw new Error('Bank name is required.')
          if (typeof updated.accountNumber !== 'string') throw new Error('Account number is required.')
        }
        if (Object.hasOwn(body, 'qrCode')) {
          const qrCode = body.qrCode ? normalizeChatImage(body.qrCode) : ''
          if (body.qrCode && !qrCode) return send(response, 400, { error: 'QR code must be a JPG, PNG, or WebP image no larger than 5 MB.' })
          updated.qrCode = qrCode
        }
        if (typeof updated.enabled !== 'boolean') throw new Error('Enabled status is required.')
        payments[methodId] = updated
        writePayments(payments)
        const data = readData(); auditAdminAction(data, request, `Updated ${updated.name} payment settings.`); writeData(data)
        return send(response, 200, { payment: updated })
      }
      if (request.method === 'DELETE' && url.pathname.startsWith('/api/admin/payments/')) {
        const methodId = url.pathname.split('/').pop()
        const payments = readPayments()
        if (!payments[methodId]) return send(response, 404, { error: 'Payment method not found.' })
        const deletedName = payments[methodId].name || methodId
        delete payments[methodId]
        writePayments(payments)
        const data = readData(); auditAdminAction(data, request, `Deleted payment method ${deletedName}.`); writeData(data)
        return send(response, 200, { ok: true, id: methodId })
      }
      return send(response, 404, { error: 'Admin payments endpoint not found.' })
    }
    if (url.pathname === '/api/admin/settings') {
      if (!adminOnly(request, response)) return
      if (request.method === 'GET') return send(response, 200, {
        settings: readSettings(),
        telegram: {
          miniAppAuthConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
          websiteLoginConfigured: telegramOidcConfigured(),
          adminNotificationsConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_ADMIN_CHAT_ID),
          callbackActionsConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_ADMIN_CHAT_ID && process.env.TELEGRAM_ADMIN_USER_ID && process.env.TELEGRAM_WEBHOOK_SECRET)
        }
      })
      if (request.method === 'PATCH') {
        const body = await readBody(request)
        const settings = { ...readSettings() }
        if (Object.hasOwn(body, 'carGatePickupFee')) {
          const fee = Number(body.carGatePickupFee)
          if (!Number.isFinite(fee) || fee < 0) return send(response, 400, { error: 'Car gate pickup fee must be a valid non-negative number.' })
          settings.carGatePickupFee = fee
        }
        const textSettings = { shopName: 80, businessName: 120, contactPhone: 40, contactEmail: 120, businessAddress: 500 }
        for (const [key, maxLength] of Object.entries(textSettings)) {
          if (Object.hasOwn(body, key)) {
            if (typeof body[key] !== 'string' || body[key].length > maxLength) return send(response, 400, { error: `Invalid ${key} value.` })
            settings[key] = body[key].trim()
          }
        }
        for (const key of ['orderAlerts', 'lowStockAlerts']) {
          if (Object.hasOwn(body, key)) {
            if (typeof body[key] !== 'boolean') return send(response, 400, { error: `Invalid ${key} value.` })
            settings[key] = body[key]
          }
        }
        writeSettings(settings)
        const data = readData(); auditAdminAction(data, request, 'Updated shop settings.'); writeData(data)
        return send(response, 200, { settings })
      }
      return send(response, 404, { error: 'Admin settings endpoint not found.' })
    }
    if (request.method === 'POST' && url.pathname === '/api/admin/stock-movements') {
      const admin = adminOnly(request, response)
      if (!admin) return
      const body = await readBody(request)
      const productId = String(body.productId || '')
      const data = readData()
      const product = data.products.find((item) => String(item.id) === productId)
      if (!product) return send(response, 404, { error: 'Product not found.' })

      const type = String(body.type || '')
      const quantity = Number(body.quantity)
      const reason = String(body.reason || '').trim()
      const reference = String(body.reference || '').trim()
      if (!STOCK_MOVEMENT_TYPES.includes(type) || !Number.isSafeInteger(quantity) || quantity === 0) {
        return send(response, 400, { error: 'Choose a valid stock movement type and non-zero whole-unit quantity.' })
      }
      if ((['Stock In', 'Return'].includes(type) && quantity < 0) || (['Stock Out', 'Damaged'].includes(type) && quantity > 0)) {
        return send(response, 400, { error: 'Stock In and Return quantities must be positive; Stock Out and Damaged quantities must be negative.' })
      }
      if (!reason || reason.length > 500 || reference.length > 120) {
        return send(response, 400, { error: 'Enter a reason of up to 500 characters and a reference of up to 120 characters.' })
      }

      const previousStock = Number(product.stock)
      const newStock = previousStock + quantity
      if (!Number.isSafeInteger(previousStock) || previousStock < 0) {
        return send(response, 409, { error: 'The product has an invalid current stock value.' })
      }
      if (!Number.isSafeInteger(newStock) || newStock < 0) {
        return send(response, 409, { error: 'This movement would reduce stock below zero.' })
      }
      let variantStock = product.variantStock && Object.keys(product.variantStock).length ? { ...product.variantStock } : null
      let variantChange = null
      if (variantStock) {
        const variants = {
          ...(body.variants?.size ? { size: String(body.variants.size) } : {}),
          ...(body.variants?.color ? { color: String(body.variants.color) } : {})
        }
        const { sizes, colors } = productVariantOptions(product)
        const key = productVariantStockKey(variants)
        if ((sizes.length && !sizes.includes(variants.size)) || (colors.length && !colors.includes(variants.color)) || !Object.hasOwn(variantStock, key)) {
          return send(response, 400, { error: 'Select a valid size and color for this variant-tracked product.' })
        }
        const previousVariantStock = variantStock[key]
        const newVariantStock = previousVariantStock + quantity
        if (!Number.isSafeInteger(newVariantStock) || newVariantStock < 0) return send(response, 409, { error: 'This movement would reduce that variant stock below zero.' })
        variantStock[key] = newVariantStock
        variantChange = { variants, previousStock: previousVariantStock, newStock: newVariantStock, quantity }
      }

      const date = new Date().toISOString()
      const movement = {
        id: crypto.randomUUID(),
        productId: product.id,
        productName: product.nameEn || product.name,
        sku: product.sku || '',
        type,
        quantity,
        previousStock,
        newStock,
        reason,
        reference,
        ...(variantChange ? { variantChanges: [variantChange] } : {}),
        date,
        user: admin.email || 'Admin'
      }
      const updatedProduct = {
        ...product,
        stock: newStock,
        ...(variantStock ? { variantStock } : {}),
        stockHistory: [...(Array.isArray(product.stockHistory) ? product.stockHistory : []), {
          id: movement.id,
          type,
          change: quantity,
          stockAfter: newStock,
          at: date,
          reference
        }].slice(-30)
      }
      data.products = data.products.map((item) => String(item.id) === productId ? updatedProduct : item)
      data.stockMovements = [movement, ...data.stockMovements].slice(0, 1000)
      auditAdminAction(data, request, `Recorded ${type} of ${Math.abs(quantity)} for ${movement.productName}.`)
      writeData(data)
      return send(response, 201, { movement, product: updatedProduct })
    }
    if (url.pathname.startsWith('/api/admin/')) {
      if (!adminOnly(request, response)) return
      const data = readData()
      if (request.method === 'GET' && url.pathname === '/api/admin/dashboard') return send(response, 200, { summary: { ...summary(data.orders), lowStock: data.products.filter((product) => product.stock > 0 && product.stock <= 5 && product.enabled !== false).length, outOfStock: data.products.filter((product) => product.stock === 0 && product.enabled !== false).length }, orders: data.orders, products: data.products, categories: data.categories, customers: data.customers.map((customer) => adminCustomerSummary(customer, data.orders)), promotions: data.promotions, stockMovements: data.stockMovements, activityLog: data.activityLog || [] })
      if (request.method === 'POST' && url.pathname === '/api/admin/categories') {
        const category = cleanCategory(await readBody(request))
        if (data.categories.some((item) => item.name.toLowerCase() === category.name.toLowerCase())) return send(response, 409, { error: 'A category with that name already exists.' })
        data.categories = [category, ...data.categories]
        auditAdminAction(data, request, `Added category: ${category.name}.`); writeData(data)
        return send(response, 201, { category })
      }
      if (url.pathname.startsWith('/api/admin/categories/')) {
        const id = decodeURIComponent(url.pathname.split('/').pop())
        const current = data.categories.find((category) => category.id === id)
        if (!current) return send(response, 404, { error: 'Category not found.' })
        if (request.method === 'PATCH') {
          const category = cleanCategory(await readBody(request), current)
          if (data.categories.some((item) => item.id !== id && item.name.toLowerCase() === category.name.toLowerCase())) return send(response, 409, { error: 'A category with that name already exists.' })
          data.categories = data.categories.map((item) => item.id === id ? category : item)
          auditAdminAction(data, request, `Updated category: ${category.name}.`); writeData(data)
          return send(response, 200, { category })
        }
        if (request.method === 'DELETE') {
          if (data.products.some((product) => product.category === id)) return send(response, 409, { error: 'Move or delete products in this category before deleting it.' })
          data.categories = data.categories.filter((category) => category.id !== id)
          auditAdminAction(data, request, `Deleted category: ${current.name}.`); writeData(data)
          return send(response, 200, { ok: true })
        }
      }
      if (request.method === 'GET' && url.pathname === '/api/admin/backup') {
        const backup = JSON.stringify({ exportedAt: new Date().toISOString(), shop: data }, null, 2)
        response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="htoo-backup-${new Date().toISOString().slice(0, 10)}.json"`, 'Cache-Control': 'no-store' })
        return response.end(backup)
      }
      if (request.method === 'POST' && url.pathname === '/api/admin/products') {
        const product = cleanProduct(await readBody(request))
        data.products = [product, ...data.products.filter((item) => String(item.id) !== String(product.id))]
        auditAdminAction(data, request, `Added product: ${product.nameEn}.`)
        writeData(data)
        return send(response, 201, { product })
      }
      if (url.pathname.startsWith('/api/admin/products/')) {
        const rawId = url.pathname.replace(/^\/api\/admin\/products\//, '').replace(/\/$/, '')
        const id = decodeURIComponent(rawId)
        const current = data.products.find((product) => String(product.id) === String(id))
        if (!current) return send(response, 404, { error: 'Product not found.' })
        if (request.method === 'GET') return send(response, 200, { product: current })
        if (request.method === 'PATCH') {
          const product = cleanProduct(await readBody(request), current)
          data.products = data.products.map((item) => String(item.id) === String(id) ? product : item)
          auditAdminAction(data, request, `Updated product: ${product.nameEn}.`)
          writeData(data)
          return send(response, 200, { product })
        }
        if (request.method === 'DELETE') {
          data.products = data.products.filter((item) => String(item.id) !== String(id))
          auditAdminAction(data, request, `Deleted product: ${current.nameEn}.`)
          writeData(data)
          return send(response, 200, { ok: true })
        }
      }
      if (request.method === 'POST' && url.pathname === '/api/admin/upload') {
        const body = await readBody(request)
        const fileData = body.file || body.image || body.dataUrl
        const filename = body.filename || body.name || 'product.jpg'
        if (!fileData) return send(response, 400, { error: 'No image file was provided in the upload request.' })
        const savedUrl = saveImageToDisk(fileData, filename)
        if (!savedUrl) return send(response, 400, { error: 'Uploaded file must be a valid JPG, PNG, or WebP image 5 MB or smaller.' })
        auditAdminAction(data, request, `Uploaded image: ${path.basename(savedUrl)}.`)
        writeData(data)
        return send(response, 201, {
          url: savedUrl,
          filename: path.basename(savedUrl)
        })
      }
      if (request.method === 'POST' && url.pathname === '/api/admin/promotions') { const promotion = cleanPromotion(await readBody(request)); data.promotions = [promotion, ...data.promotions.filter((item) => item.id !== promotion.id)]; auditAdminAction(data, request, `Added promotion: ${promotion.name}.`); writeData(data); return send(response, 201, { promotion }) }
      if (url.pathname.startsWith('/api/admin/promotions/')) {
        const id = url.pathname.split('/').pop(); const current = data.promotions.find((promotion) => promotion.id === id)
        if (!current) return send(response, 404, { error: 'Promotion not found.' })
        if (request.method === 'PATCH') { const promotion = cleanPromotion(await readBody(request), current); data.promotions = data.promotions.map((item) => item.id === id ? promotion : item); auditAdminAction(data, request, `Updated promotion: ${promotion.name}.`); writeData(data); return send(response, 200, { promotion }) }
        if (request.method === 'DELETE') { data.promotions = data.promotions.filter((item) => item.id !== id); auditAdminAction(data, request, `Deleted promotion: ${current.name}.`); writeData(data); return send(response, 200, { ok: true }) }
      }
      if (request.method === 'GET' && url.pathname === '/api/admin/banners') {
        const data = readData()
        return send(response, 200, { banners: (data.banners || []).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)) })
      }
      if (request.method === 'POST' && url.pathname === '/api/admin/banners') {
        const banner = cleanBanner(await readBody(request))
        data.banners = [banner, ...(data.banners || []).filter((item) => String(item.id) !== String(banner.id))]
        auditAdminAction(data, request, `Saved banner: ${banner.id}.`)
        writeData(data)
        return send(response, 201, { banner })
      }
      if (url.pathname.startsWith('/api/admin/banners/')) {
        const id = decodeURIComponent(url.pathname.replace(/^\/api\/admin\/banners\//, '').replace(/\/$/, ''))
        const current = (data.banners || []).find((b) => String(b.id) === String(id))
        if (!current) return send(response, 404, { error: 'Banner not found.' })
        if (request.method === 'DELETE') {
          data.banners = (data.banners || []).filter((b) => String(b.id) !== String(id))
          auditAdminAction(data, request, `Deleted banner: ${current.id}.`)
          writeData(data)
          return send(response, 200, { ok: true, id })
        }
      }
      if (request.method === 'PATCH' && url.pathname.startsWith('/api/admin/orders/')) {
        const id = url.pathname.split('/').pop(); const body = await readBody(request)
        if (body.status && !ORDER_STATUSES.includes(body.status)) return send(response, 400, { error: 'Invalid order status.' })
        if (body.paymentStatus && !PAYMENT_STATUSES.includes(body.paymentStatus)) return send(response, 400, { error: 'Invalid payment status.' })
        if (body.shippingStatus && !SHIPPING_STATUSES.includes(body.shippingStatus)) return send(response, 400, { error: 'Invalid shipping status.' })
        if (Object.hasOwn(body, 'trackingNumber') && (typeof body.trackingNumber !== 'string' || body.trackingNumber.length > 100)) return send(response, 400, { error: 'Tracking number must be a string of 100 characters or fewer.' })
        if (Object.hasOwn(body, 'deliveryCompany') && (typeof body.deliveryCompany !== 'string' || body.deliveryCompany.length > 120)) return send(response, 400, { error: 'Delivery company must be a string of 120 characters or fewer.' })
        const existing = data.orders.find((order) => order.id === id)
        if (!existing) return send(response, 404, { error: 'Order not found.' })
        const requestedStatus = body.status || (body.shippingStatus === 'Delivered' ? 'Delivered' : ['Shipped', 'In Transit'].includes(body.shippingStatus) ? 'Shipped' : '')
        const transitionError = requestedStatus ? orderTransitionError(existing.status, requestedStatus) : ''
        if (transitionError) return send(response, 409, { error: transitionError })
        const reason = String(body.paymentRejectionReason || '').trim()
        if (body.paymentStatus === 'Rejected' && (!reason || reason.length > 500)) return send(response, 400, { error: 'Provide a rejection reason of 1 to 500 characters.' })
        const updatedAt = new Date().toISOString()
        const transitioned = requestedStatus && requestedStatus !== existing.status ? transitionOrder(data, existing, requestedStatus, updatedAt) : existing
        const updated = {
          ...transitioned,
          ...(body.paymentStatus ? {
            paymentStatus: body.paymentStatus,
            paymentVerificationStatus: body.paymentStatus,
            paymentUpdatedAt: updatedAt,
            ...(body.paymentStatus === 'Verified' ? { paymentVerifiedAt: updatedAt } : {})
          } : {}),
          ...(body.paymentStatus === 'Rejected' ? { paymentRejectionReason: reason } : body.paymentStatus === 'Verified' ? { paymentRejectionReason: '' } : {}),
          ...(body.shippingStatus ? { shippingStatus: body.shippingStatus } : {}),
          ...(Object.hasOwn(body, 'trackingNumber') ? { trackingNumber: body.trackingNumber.trim() } : {}),
          ...(Object.hasOwn(body, 'deliveryCompany') ? { deliveryCompany: body.deliveryCompany.trim() } : {}),
          updatedAt
        }
        data.orders = data.orders.map((order) => order.id === id ? updated : order)
        auditAdminAction(data, request, `Updated order ${id.slice(0, 8)}.`); writeData(data)
        const statusChanged = updated.status !== existing.status
        const shipmentChanged = updated.shippingStatus !== existing.shippingStatus || updated.trackingNumber !== existing.trackingNumber
        if (statusChanged || shipmentChanged) notifyTelegramOrderStatus(updated)
        if (body.paymentStatus === 'Verified' && existing.paymentStatus !== 'Verified') {
          notifyTelegramPayment(updated)
        }
        return send(response, 200, { order: updated })
      }
      return send(response, 404, { error: 'Admin endpoint not found.' })
    }
    if (request.method === 'GET' && url.pathname === '/api/categories') return send(response, 200, { categories: readData().categories.filter((category) => category.enabled !== false) })
    if (request.method === 'GET' && url.pathname === '/api/banners') {
      const data = readData()
      const today = new Date().toISOString().slice(0, 10)
      const banners = (data.banners || [])
        .filter((banner) => banner.enabled !== false && (!banner.startDate || banner.startDate.slice(0, 10) <= today) && (!banner.endDate || banner.endDate.slice(0, 10) >= today))
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
      return send(response, 200, { banners })
    }
    if (request.method === 'GET' && url.pathname === '/api/products') {
      const data = readData()
      const categories = new Map(data.categories.map((category) => [category.id, category]))
      const products = data.products.filter((product) => product.enabled !== false && categories.get(product.category)?.enabled !== false).map((product) => ({ ...product, categoryName: categories.get(product.category)?.name || product.category, storefrontCategory: categories.get(product.category)?.storefrontCategory }))
      return send(response, 200, { products })
    }
    if (request.method === 'GET' && url.pathname === '/api/promotions') {
      const today = new Date().toISOString().slice(0, 10)
      const data = readData()
      const promotions = data.promotions.filter((promotion) => promotion.enabled && (!promotion.startsAt || promotion.startsAt <= today) && (!promotion.endsAt || promotion.endsAt >= today)).map((promotion) => ({ code: promotion.code || promotion.name, name: promotion.name, type: promotion.type, amount: promotion.amount, minimumOrder: Number(promotion.minimumOrder || 0), usageLimit: Number(promotion.usageLimit || 0), usageCount: data.orders.filter((order) => String(order.couponCode || '').toUpperCase() === String(promotion.code || promotion.name).toUpperCase()).length }))
      return send(response, 200, { promotions })
    }
    if (request.method === 'GET' && url.pathname === '/api/settings') return send(response, 200, { settings: readSettings() })
    if (request.method === 'GET' && url.pathname === '/api/payments') {
      const payments = readPayments()
      const enabled = Object.values(payments).filter((payment) => payment.enabled && (payment.id === 'cod' || (payment.accountName && (payment.type === 'bank' || payment.id === 'bank' ? payment.bankName && payment.accountNumber : payment.phoneNumber)))).map((payment) => ({ id: payment.id, name: payment.name, nameMyanmar: payment.nameMyanmar, type: payment.type || (payment.id === 'bank' ? 'bank' : payment.id === 'cod' ? 'cash' : 'wallet'), accountName: payment.accountName || '', phoneNumber: payment.phoneNumber || '', bankName: payment.bankName || '', accountNumber: payment.accountNumber || '', qrCode: payment.qrCode || '' }))
      return send(response, 200, { payments: enabled })
    }
    if (request.method === 'POST' && url.pathname === '/api/customers') {
      const session = customerOnly(request, response); if (!session) return
      const body = await readBody(request)
      if (body.id && body.id !== session.customerId) return send(response, 403, { error: 'You cannot update another customer.' })
      const data = readData(); const existing = data.customers.find((customer) => customer.id === session.customerId)
      if (!existing) return send(response, 404, { error: 'Customer not found.' })
      const name = String(body.name || '').trim()
      const phone = normalizePhone(body.phone || '')
      if (!name || name.length > 120 || !validPhone(phone)) return send(response, 400, { error: 'Enter a valid name and phone number.' })
      const customer = { ...existing, name, phone }
      data.customers = [customer, ...data.customers.filter((item) => item.id !== customer.id)]; writeData(data)
      return send(response, 200, { customer: customerSafeProfile(customer) })
    }
    if (request.method === 'POST' && url.pathname === '/api/customer/preferences') {
      const session = customerOnly(request, response); if (!session) return
      const body = await readBody(request)
      if (body.languagePreference !== 'my' && body.languagePreference !== 'en') return send(response, 400, { error: 'Language preference must be "my" or "en".' })
      const data = readData()
      const existing = data.customers.find((customer) => customer.id === session.customerId)
      if (!existing) return send(response, 404, { error: 'Customer not found.' })
      const customer = { ...existing, languagePreference: body.languagePreference }
      data.customers = [customer, ...data.customers.filter((item) => item.id !== customer.id)]
      writeData(data)
      return send(response, 200, { customer: customerSafeProfile(customer) })
    }
    if (request.method === 'POST' && url.pathname === '/api/orders') {
      const requestedOrder = await readBody(request)
      const authenticatedCustomer = customerSession(request)
      if (requestedOrder.customer?.userId && (!authenticatedCustomer || requestedOrder.customer.userId !== authenticatedCustomer.customerId)) return send(response, 403, { error: 'Customer session does not match this order.' })
      const data = readData()
      const signedInCustomer = authenticatedCustomer
        ? data.customers.find((item) => item.id === authenticatedCustomer.customerId)
        : null
      if (authenticatedCustomer && !signedInCustomer) return send(response, 401, { error: 'Customer account could not be verified. Sign in again before ordering.' })
      const idempotencyHeader = request.headers['idempotency-key']
      const idempotencyKey = typeof idempotencyHeader === 'string' ? idempotencyHeader.trim() : ''
      let idempotencyRecord = null
      if (idempotencyKey) {
        if (!/^[A-Za-z0-9._:-]{1,128}$/.test(idempotencyKey)) return send(response, 400, { error: 'Invalid idempotency key.' })
        const identity = authenticatedCustomer ? `customer:${authenticatedCustomer.customerId}` : `guest:${normalizePhone(requestedOrder.customer?.phone)}`
        const keyHash = crypto.createHash('sha256').update(`${identity}:${idempotencyKey}`).digest('hex')
        const fingerprint = crypto.createHash('sha256').update(JSON.stringify(requestedOrder)).digest('hex')
        const previousRequest = data.orderIdempotency.find((entry) => entry.keyHash === keyHash)
        if (previousRequest) {
          if (previousRequest.fingerprint !== fingerprint) return send(response, 409, { error: 'This order request key was already used with different order details.' })
          const previousOrder = data.orders.find((order) => order.id === previousRequest.orderId)
          if (!previousOrder) return send(response, 409, { error: 'This order request was already processed but is no longer available.' })
          notifyNewTelegramOrder(previousOrder)
          return send(response, 200, { ok: true, order: previousOrder, idempotentReplay: true })
        }
        idempotencyRecord = { keyHash, fingerprint }
      }
      const customerName = String(requestedOrder.customer?.name || '').trim()
      const customerPhone = normalizePhone(requestedOrder.customer?.phone)
      const customerAddress = String(requestedOrder.customer?.address || '').trim()
      const customerEmail = normalizeEmail(requestedOrder.customer?.email || signedInCustomer?.email || '')
      if (!customerName || customerName.length > 120 || !validPhone(customerPhone) || !customerAddress || customerAddress.length > 1000 ||
        (customerEmail && (!validEmail(customerEmail) || customerEmail.length > 254)) ||
        String(requestedOrder.customer?.township || '').length > 120 ||
        String(requestedOrder.customer?.city || '').length > 120 ||
        String(requestedOrder.customer?.region || '').length > 120) {
        return send(response, 400, { error: 'Enter a valid full name, phone number, email (if provided), and complete delivery address.' })
      }
      if (!Array.isArray(requestedOrder.items) || requestedOrder.items.length < 1 || requestedOrder.items.length > 50) return send(response, 400, { error: 'Your cart must contain between 1 and 50 items.' })

      const stockRequested = new Map()
      const variantStockRequested = new Map()
      const items = []
      let subtotal = 0
      for (const requestedItem of requestedOrder.items) {
        const id = String(requestedItem.id || requestedItem.productId || '')
        const product = data.products.find((item) => String(item.id) === id)
        const quantity = Number(requestedItem.quantity)
        if (!product || product.enabled === false || requestedItem.selected !== true || !Number.isInteger(quantity) || quantity < 1) return send(response, 409, { error: 'Select available cart items and check their quantities before ordering.' })
        const nextStock = (stockRequested.get(id) || 0) + quantity
        stockRequested.set(id, nextStock)
        if (Number(product.stock || 0) < nextStock) return send(response, 409, { error: `Insufficient stock for ${product.nameEn || product.name || 'one of your products'}.` })
        const size = String(requestedItem.variants?.size || '')
        const color = String(requestedItem.variants?.color || '')
        const variants = { ...(size ? { size } : {}), ...(color ? { color } : {}) }
        if (signedInCustomer) {
          const savedCartItem = (Array.isArray(signedInCustomer.cart) ? signedInCustomer.cart : []).find((item) =>
            String(item.productId) === id && productVariantStockKey(item.variants || {}) === productVariantStockKey(variants)
          )
          if (!savedCartItem || savedCartItem.selected === false || quantity > Number(savedCartItem.quantity)) {
            return send(response, 409, { error: 'Your selected cart items changed. Refresh your cart and try again.' })
          }
        }
        const { sizes, colors } = productVariantOptions(product)
        if ((sizes.length && !sizes.includes(size)) || (colors.length && !colors.includes(color))) return send(response, 400, { error: `The selected size or color for ${product.nameEn || product.name} is unavailable.` })
        if (product.variantStock && Object.keys(product.variantStock).length) {
          const key = productVariantStockKey(variants)
          const requestedForProduct = variantStockRequested.get(id) || new Map()
          const nextVariantStock = (requestedForProduct.get(key) || 0) + quantity
          requestedForProduct.set(key, nextVariantStock)
          variantStockRequested.set(id, requestedForProduct)
          if (nextVariantStock > Number(product.variantStock[key] || 0)) return send(response, 409, { error: `Insufficient stock for ${product.nameEn || product.name} (${[size, color].filter(Boolean).join(' · ')}).` })
        }
        const price = Number(product.discountPrice ?? product.price)
        if (!Number.isFinite(price) || price < 0) return send(response, 400, { error: 'A product has an invalid price. Please contact the shop.' })
        subtotal += price * quantity
        items.push({ id: product.id, productId: product.id, sku: product.sku || '', name: product.nameEn || product.name, quantity, price, lineTotal: price * quantity, image: product.image || product.images?.[0] || '', variants })
      }

      const deliveryMethodId = requestedOrder.deliveryMethod === 'cargate' ? 'cargate' : requestedOrder.deliveryMethod === 'standard' ? 'standard' : ''
      if (!deliveryMethodId) return send(response, 400, { error: 'Select a valid delivery method.' })
      const deliveryFee = deliveryMethodId === 'cargate' ? Math.max(0, Number(readSettings().carGatePickupFee) || 0) : 0
      const couponCode = String(requestedOrder.couponCode || '').trim().toUpperCase()
      const promotion = couponCode ? data.promotions.find((item) => item.enabled && String(item.code || item.name).trim().toUpperCase() === couponCode) : null
      if (couponCode && !promotion) return send(response, 400, { error: 'That promotion is no longer active.' })
      const today = new Date().toISOString().slice(0, 10)
      if (promotion && ((promotion.startsAt && promotion.startsAt > today) || (promotion.endsAt && promotion.endsAt < today) || subtotal < Number(promotion.minimumOrder || 0))) return send(response, 400, { error: 'That promotion is not valid for this order.' })
      if (promotion?.usageLimit && data.orders.filter((order) => String(order.couponCode || '').toUpperCase() === couponCode).length >= Number(promotion.usageLimit)) return send(response, 400, { error: 'That promotion has reached its usage limit.' })
      const discount = promotion ? Math.max(0, Math.min(subtotal, promotion.type === 'percentage' ? Math.round(subtotal * Number(promotion.amount) / 100) : Number(promotion.amount))) : 0
      const total = subtotal + deliveryFee - discount
      if (!Number.isFinite(total) || total <= 0) return send(response, 400, { error: 'The order total must be greater than zero.' })

      const paymentAccountId = String(requestedOrder.paymentAccountId || requestedOrder.paymentMethodId || '')
      const paymentAccount = readPayments()[paymentAccountId]
      const isCashPayment = paymentAccountId === 'cod' || paymentAccount?.type === 'cash'
      if (!paymentAccount || paymentAccount.enabled !== true || (paymentAccountId !== 'cod' && (!paymentAccount.accountName || (paymentAccount.type === 'bank' || paymentAccountId === 'bank' ? !paymentAccount.bankName || !paymentAccount.accountNumber : !paymentAccount.phoneNumber)))) return send(response, 400, { error: 'That payment account is not active or fully configured. Refresh checkout and choose another account.' })
      const slipData = requestedOrder.receipt?.dataUrl
      const receiptDataUrl = slipData ? normalizeChatImage(slipData) : null
      if (slipData && !receiptDataUrl) return send(response, 400, { error: 'Payment slip must be a JPG, PNG, or WebP image no larger than 5 MB.' })
      if (!isCashPayment && !receiptDataUrl) return send(response, 400, { error: 'Upload your payment slip before placing this order.' })

      const paymentStatus = isCashPayment ? 'Not Required' : 'Pending Verification'
      const orderId = crypto.randomUUID()
      const customerId = authenticatedCustomer?.customerId || null
      const orderCreatedAt = new Date().toISOString()
      const order = {
        id: orderId,
        orderNumber: `HT-${orderId.slice(0, 8).toUpperCase()}`,
        customer: {
          userId: customerId,
          name: customerName,
          phone: customerPhone,
          email: customerEmail,
          address: customerAddress,
          township: String(requestedOrder.customer?.township || '').trim(),
          city: String(requestedOrder.customer?.city || '').trim(),
          region: String(requestedOrder.customer?.region || '').trim()
        },
        items,
        subtotal,
        deliveryFee,
        shippingFee: deliveryFee,
        discount,
        couponCode: promotion ? couponCode : '',
        promotion: promotion ? { code: couponCode, name: promotion.name, type: promotion.type, amount: promotion.amount } : null,
        deliveryMethod: deliveryMethodId,
        total,
        paymentMethod: paymentAccount.name,
        paymentMethodId: paymentAccount.id,
        paymentAccountId: paymentAccount.id,
        paymentAccount: { id: paymentAccount.id, name: paymentAccount.name, accountName: paymentAccount.accountName || '', phoneNumber: paymentAccount.phoneNumber || '', bankName: paymentAccount.bankName || '', accountNumber: paymentAccount.accountNumber || '' },
        paymentAmount: total,
        receipt: receiptDataUrl ? { dataUrl: receiptDataUrl, contentType: receiptDataUrl.slice(5, receiptDataUrl.indexOf(';')) } : null,
        paymentStatus,
        paymentVerificationStatus: paymentStatus,
        shippingStatus: 'Preparing',
        trackingNumber: '',
        deliveryCompany: '',
        paymentRejectionReason: '',
        status: 'Pending',
        statusHistory: [{ status: 'Pending', at: orderCreatedAt }],
        createdAt: orderCreatedAt,
        updatedAt: orderCreatedAt
      }

      const customer = signedInCustomer || { id: crypto.randomUUID(), phone: customerPhone, orderIds: [], userId: null }
      Object.assign(customer, { name: customerName, phone: customerPhone, address: customerAddress, ...(customerId ? { cart: [] } : {}), orderIds: [...new Set([...(customer.orderIds || []), order.id])] })
      if (idempotencyRecord) data.orderIdempotency = [...data.orderIdempotency, { ...idempotencyRecord, orderId: order.id }].slice(-1000)
      data.customers = [customer, ...data.customers.filter((item) => item.id !== customer.id)]
      const guestKeyHash = customerId ? '' : guestOrderAccessHash(request)
      if (guestKeyHash) data.guestOrderAccess[order.id] = guestKeyHash
      data.products = data.products.map((product) => {
        const quantity = stockRequested.get(String(product.id))
        if (!quantity) return product
        const nextStock = Number(product.stock || 0) - quantity
        const variantStock = product.variantStock && Object.keys(product.variantStock).length
          ? { ...product.variantStock }
          : null
        const variantChanges = []
        for (const [key, variantQuantity] of variantStockRequested.get(String(product.id)) || []) {
          const previousVariantStock = variantStock[key]
          variantStock[key] -= variantQuantity
          variantChanges.push({
            variants: JSON.parse(key).reduce((selection, value, index) => {
              if (value) selection[index === 0 ? 'size' : 'color'] = value
              return selection
            }, {}),
            quantity: -variantQuantity,
            previousStock: previousVariantStock,
            newStock: variantStock[key]
          })
        }
        data.stockMovements.unshift({
          id: crypto.randomUUID(),
          productId: product.id,
          productName: product.nameEn || product.name,
          sku: product.sku || '',
          type: 'Stock Out',
          quantity: -quantity,
          previousStock: Number(product.stock || 0),
          newStock: nextStock,
          reason: 'Customer order placed',
          reference: order.orderNumber,
          variantChanges,
          date: orderCreatedAt,
          user: 'System (Order)'
        })
        return { ...product, stock: nextStock, ...(variantStock ? { variantStock } : {}) }
      })
      data.stockMovements = data.stockMovements.slice(0, 1000)
      data.orders = [order, ...data.orders]; writeData(data)
      notifyNewTelegramOrder(order)
      return send(response, 201, { ok: true, order })
    }
    return send(response, 404, { error: 'Not found.' })
  } catch (error) {
    console.error('[api] Request failed:', error.message)
    if (error.code === 'SHOP_DATA_CONFLICT') return send(response, 409, { error: 'Shop data changed while processing your request. Please retry.' })
    if (Number.isInteger(error.status) && error.status >= 400 && error.status < 500) return send(response, error.status, { error: error.message })
    return send(response, 500, { error: 'The request could not be completed. Please try again later.' })
  }
})

server.listen(port, () => console.log(`HTOO API listening on http://localhost:${port}`))
