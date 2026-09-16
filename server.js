import http from 'node:http'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const envFile = path.join(root, '.env')
if (typeof process.loadEnvFile === 'function' && fs.existsSync(envFile)) process.loadEnvFile(envFile)
const dataFile = path.join(root, 'data', 'shop.json')
const adminFile = process.env.ADMIN_ACCOUNT_FILE ? path.resolve(process.env.ADMIN_ACCOUNT_FILE) : path.join(root, 'data', 'admin.json')
const paymentsFile = path.join(root, 'data', 'payments.json')
const settingsFile = path.join(root, 'data', 'settings.json')
const port = Number(process.env.API_PORT || 8787)
const sessions = new Map()
const secureCookie = process.env.NODE_ENV === 'production' ? '; Secure' : ''
const customerCookie = 'hto_customer_session'
const ORDER_STATUSES = ['New', 'Confirmed', 'Packing', 'Shipped', 'Delivered', 'Cancelled']
const PAYMENT_STATUSES = ['Pending Verification', 'Verified', 'Rejected', 'Not Required']
const PRODUCT_CATEGORIES = ['Clothing', 'Grocery', 'Phones & Accessories']
const PROMOTION_TYPES = ['percentage', 'fixed']
const resetRequests = new Map()

function readData() {
  try {
    const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'))
    const base = { orders: [], products: [], customers: [], promotions: [], orderChats: [], activityLog: [] }
    return { ...base, ...data, orderChats: Array.isArray(data.orderChats) ? data.orderChats : base.orderChats, activityLog: Array.isArray(data.activityLog) ? data.activityLog : base.activityLog }
  } catch {
    return { orders: [], products: [], customers: [], promotions: [], orderChats: [], activityLog: [] }
  }
}
function writeData(data) {
  fs.mkdirSync(path.dirname(dataFile), { recursive: true })
  const safeData = { orders: [], products: [], customers: [], promotions: [], orderChats: [], activityLog: [], ...data }
  safeData.orderChats = Array.isArray(safeData.orderChats) ? safeData.orderChats : []
  safeData.activityLog = Array.isArray(safeData.activityLog) ? safeData.activityLog.slice(0, 100) : []
  fs.writeFileSync(dataFile, JSON.stringify(safeData, null, 2))
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
  return session?.type === 'customer' ? session : null
}
function customerSafeProfile(customer) {
  if (!customer) return null
  return { id: customer.id, name: customer.name, phone: customer.phone, createdAt: customer.createdAt }
}
function adminCustomerSummary(customer, orders) {
  const customerOrders = orders.filter((order) => isCustomerOrder(order, customer.id, customer))
  return { id: customer.id, name: customer.name, phone: customer.phone, createdAt: customer.createdAt, orderCount: customerOrders.length, totalPurchase: customerOrders.filter((order) => order.status !== 'Cancelled').reduce((total, order) => total + Number(order.total || 0), 0) }
}
function customerOnly(request, response) {
  const session = customerSession(request)
  if (!session) { send(response, 401, { error: 'Customer authentication required.' }); return null }
  return session
}
function normalizePhone(value) { return String(value || '').replace(/[\s()-]/g, '') }
function validPhone(value) { return /^(?:\+?95|0)\d{7,13}$/.test(normalizePhone(value)) }
function validPassword(value) { return typeof value === 'string' && value.length >= 8 }
function isCustomerOrder(order, customerId, customer) {
  if (!order || !order.customer) return false
  if (order.customer.userId && order.customer.userId === customerId) return true
  if (customer && customer.phone && normalizePhone(order.customer.phone) === normalizePhone(customer.phone)) return true
  if (customer && Array.isArray(customer.orderIds) && (customer.orderIds.includes(order.id) || customer.orderIds.includes(order.orderNumber))) return true
  return false
}
function findCustomer(data, phone) { return data.customers.find((customer) => customer.phone === normalizePhone(phone)) }
function customerCookieHeader(token, maxAge = 28800) { return `${customerCookie}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secureCookie}` }
function createCustomerSession(customer) {
  const token = crypto.randomBytes(32).toString('hex')
  sessions.set(token, { type: 'customer', customerId: customer.id, createdAt: Date.now() })
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
  const today = new Date().toDateString()
  const todayOrders = orders.filter((order) => new Date(order.createdAt).toDateString() === today)
  return { totalOrders: orders.length, todayOrders: todayOrders.length, todaySales: todayOrders.filter((order) => order.status !== 'Cancelled').reduce((total, order) => total + Number(order.total || 0), 0), new: orders.filter((order) => order.status === 'New').length, pending: orders.filter((order) => ['New', 'Confirmed', 'Packing', 'Shipped'].includes(order.status)).length, pendingPayment: orders.filter((order) => order.paymentStatus === 'Pending Verification').length, confirmed: orders.filter((order) => order.status === 'Confirmed').length, packing: orders.filter((order) => order.status === 'Packing').length, shipped: orders.filter((order) => order.status === 'Shipped').length, delivered: orders.filter((order) => order.status === 'Delivered').length, completed: orders.filter((order) => order.status === 'Delivered').length, cancelled: orders.filter((order) => order.status === 'Cancelled').length, totalSales: active.reduce((total, order) => total + Number(order.total || 0), 0) }
}
function cleanPromotion(input, existing = {}) {
  const promotion = { ...existing, ...input, id: existing.id || input.id || crypto.randomUUID() }
  promotion.name = String(promotion.name || '').trim()
  promotion.type = String(promotion.type || 'percentage')
  promotion.amount = Number(promotion.amount)
  promotion.enabled = promotion.enabled !== false
  if (!promotion.name || !PROMOTION_TYPES.includes(promotion.type) || !Number.isFinite(promotion.amount) || promotion.amount <= 0 || (promotion.type === 'percentage' && promotion.amount > 100)) throw new Error('Promotion requires a name and a valid percentage or Ks amount.')
  return promotion
}
function cleanProduct(input, existing = {}) {
  const product = { ...existing, ...input }
  product.id = existing.id || product.id || crypto.randomUUID()
  product.nameEn = String(product.nameEn || product.name || '').trim()
  product.nameMy = String(product.nameMy || product.nameEn).trim()
  product.descriptionEn = String(product.descriptionEn || '').trim()
  product.descriptionMy = String(product.descriptionMy || '').trim()
  product.category = String(product.category || '')
  product.price = Number(product.price)
  product.discountPrice = product.discountPrice === '' || product.discountPrice == null ? null : Number(product.discountPrice)
  product.stock = Number(product.stock)
  product.images = Array.isArray(product.images) ? product.images.filter((image) => typeof image === 'string' && image.startsWith('data:image/')) : []
  product.image = product.images[0] || product.image || ''
  product.enabled = product.enabled !== false
  if (!product.nameEn || !PRODUCT_CATEGORIES.includes(product.category) || !Number.isFinite(product.price) || product.price < 0 || (product.discountPrice != null && (!Number.isFinite(product.discountPrice) || product.discountPrice < 0 || product.discountPrice > product.price)) || !Number.isInteger(product.stock) || product.stock < 0 || !product.images.length) throw new Error('Product requires names, category, valid Ks prices, stock, and at least one image.')
  return product
}
function normalizeChatImage(value) {
  if (typeof value !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/.test(value)) return null
  const data = value.split(',')[1] || ''
  if (!data || data.length > 5 * 1024 * 1024) return null
  try {
    const binary = Buffer.from(data, 'base64')
    if (binary.length === 0 || binary.length > 5 * 1024 * 1024) return null
    return value
  } catch {
    return null
  }
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

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`)
  response.setHeader('Cache-Control', 'no-store')
  try {
    if (request.method === 'POST' && url.pathname === '/api/admin/login') {
      const body = await readBody(request)
      if (!adminAccount) return send(response, 503, { error: 'Admin setup is required on the server.' })
      if (body.email?.trim().toLowerCase() !== adminAccount.email || !passwordMatches(body.password)) return send(response, 401, { error: 'Admin email or password is incorrect.' })
      const token = crypto.randomBytes(32).toString('hex')
      sessions.set(token, { type: 'admin', email: adminAccount.email, createdAt: Date.now() })
      return send(response, 200, { admin: { email: adminAccount.email } }, { 'Set-Cookie': `hto_admin_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secureCookie}` })
    }
    if (request.method === 'POST' && url.pathname === '/api/admin/logout') {
      const token = cookieValue(request, 'hto_admin_session'); if (token) sessions.delete(token)
      return send(response, 200, { ok: true }, { 'Set-Cookie': `hto_admin_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secureCookie}` })
    }
    if (request.method === 'GET' && url.pathname === '/api/customer/session') {
      const session = customerSession(request); const data = readData(); const customer = session && data.customers.find((item) => item.id === session.customerId)
      return send(response, 200, { customer: customerSafeProfile(customer) })
    }
    if (request.method === 'POST' && url.pathname === '/api/customer/register') {
      const body = await readBody(request); const name = String(body.name || '').trim(); const phone = normalizePhone(body.phone)
      if (!name || !validPhone(phone) || !validPassword(body.password) || body.password !== body.confirmPassword) return send(response, 400, { error: 'အမည်၊ မှန်ကန်သော ဖုန်းနံပါတ်နှင့် စကားဝှက် (အနည်းဆုံး ၈ လုံး) ကို မှန်ကန်စွာ ဖြည့်ပါ။' })
      const data = readData(); if (findCustomer(data, phone)?.passwordHash) return send(response, 409, { error: 'ဤဖုန်းနံပါတ်ဖြင့် အကောင့်ရှိပြီးသား ဖြစ်ပါသည်။' })
      const existing = findCustomer(data, phone); const salt = crypto.randomBytes(16).toString('hex'); const customer = { ...(existing || {}), id: existing?.id || crypto.randomUUID(), name, phone, salt, passwordHash: hashPassword(body.password, salt), createdAt: existing?.createdAt || new Date().toISOString(), orderIds: existing?.orderIds || [] }
      data.customers = [customer, ...data.customers.filter((item) => item.id !== customer.id)]; writeData(data)
      return send(response, 201, { customer: customerSafeProfile(customer) }, { 'Set-Cookie': customerCookieHeader(createCustomerSession(customer)) })
    }
    if (request.method === 'POST' && url.pathname === '/api/customer/login') {
      const body = await readBody(request); const data = readData(); const customer = findCustomer(data, body.phone); const actual = customer?.salt && customer?.passwordHash ? Buffer.from(hashPassword(body.password || '', customer.salt), 'hex') : Buffer.alloc(0); const expected = customer?.passwordHash ? Buffer.from(customer.passwordHash, 'hex') : Buffer.alloc(0)
      if (!customer || !expected.length || actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return send(response, 401, { error: 'ဖုန်းနံပါတ် သို့မဟုတ် စကားဝှက် မမှန်ကန်ပါ။' })
      return send(response, 200, { customer: customerSafeProfile(customer) }, { 'Set-Cookie': customerCookieHeader(createCustomerSession(customer), body.remember ? 2592000 : 28800) })
    }
    if (request.method === 'POST' && url.pathname === '/api/customer/logout') {
      const token = cookieValue(request, customerCookie); if (token) sessions.delete(token)
      return send(response, 200, { ok: true }, { 'Set-Cookie': customerCookieHeader('', 0) })
    }
    if (request.method === 'GET' && url.pathname === '/api/customer/google') {
      return send(response, 200, { configured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI), message: 'Google OAuth is not configured on this server.' })
    }
    if (request.method === 'POST' && url.pathname === '/api/customer/forgot/request') {
      const body = await readBody(request); const phone = normalizePhone(body.phone); const requestId = crypto.randomUUID(); const customer = findCustomer(readData(), phone)
      resetRequests.set(requestId, { phone, codeHash: crypto.createHash('sha256').update(crypto.randomBytes(32)).digest('hex'), expiresAt: Date.now() + 5 * 60 * 1000, attempts: 0, exists: Boolean(customer) })
      return send(response, 200, { ok: true, requestId, message: process.env.SMS_PROVIDER ? 'OTP ပို့ပြီးပါပြီ။' : 'SMS provider မပြင်ဆင်ရသေးပါ။ OTP ပို့ခြင်းကို မလုပ်ဆောင်နိုင်သေးပါ။' })
    }
    if (request.method === 'POST' && url.pathname === '/api/customer/forgot/reset') {
      const body = await readBody(request); const requestData = resetRequests.get(body.requestId)
      if (!requestData || Date.now() > requestData.expiresAt || requestData.attempts >= 5 || !process.env.SMS_PROVIDER) return send(response, 400, { error: 'OTP ဝန်ဆောင်မှုကို မပြင်ဆင်ရသေးပါ သို့မဟုတ် OTP သက်တမ်းကုန်နေပါပြီ။' })
      requestData.attempts += 1
      if (!requestData.exists || !validPassword(body.password) || body.password !== body.confirmPassword) return send(response, 400, { error: 'အချက်အလက်များ မမှန်ကန်ပါ။' })
      const data = readData(); const customer = findCustomer(data, requestData.phone); const salt = crypto.randomBytes(16).toString('hex'); customer.salt = salt; customer.passwordHash = hashPassword(body.password, salt); writeData(data); resetRequests.delete(body.requestId)
      return send(response, 200, { ok: true })
    }
    if (request.method === 'GET' && url.pathname === '/api/customer/orders') {
      const session = customerOnly(request, response); if (!session) return
      const data = readData()
      const customer = data.customers.find((item) => item.id === session.customerId)
      const myOrders = data.orders.filter((order) => isCustomerOrder(order, session.customerId, customer))
      return send(response, 200, { orders: myOrders })
    }
    if (request.method === 'GET' && url.pathname.startsWith('/api/customer/orders/')) {
      const session = customerOnly(request, response); if (!session) return
      const orderId = url.pathname.split('/').pop()
      const data = readData()
      const customer = data.customers.find((item) => item.id === session.customerId)
      const order = data.orders.find((item) => item.id === orderId || item.orderNumber === orderId)
      if (!order) return send(response, 404, { error: 'Order not found.' })
      if (!isCustomerOrder(order, session.customerId, customer)) {
        return send(response, 403, { error: 'Access denied. You do not have permission to view this order.' })
      }
      return send(response, 200, { order })
    }
    if (request.method === 'GET' && url.pathname.startsWith('/api/orders/') && url.pathname.endsWith('/chat')) {
      const session = customerOnly(request, response); if (!session) return
      const orderId = url.pathname.split('/')[2]
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
      const orderId = url.pathname.split('/')[2]
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
      const orderId = url.pathname.split('/')[2]
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
    if (request.method === 'GET' && url.pathname === '/api/admin/session') return adminOnly(request, response) && send(response, 200, { admin: adminSession(request) })
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
      const orderId = url.pathname.split('/')[3]
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
      const orderId = url.pathname.split('/')[3]
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
      const orderId = url.pathname.split('/')[3]
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
      if (request.method === 'PATCH' && url.pathname.startsWith('/api/admin/payments/')) {
        const methodId = url.pathname.split('/').pop()
        const body = await readBody(request)
        const payments = readPayments()
        if (!payments[methodId]) return send(response, 404, { error: 'Payment method not found.' })
        const updated = { ...payments[methodId], ...body, id: payments[methodId].id, name: payments[methodId].name, nameMyanmar: payments[methodId].nameMyanmar }
        if (methodId !== 'bank' && typeof updated.accountName !== 'string') throw new Error('Account name is required.')
        if (methodId !== 'bank' && typeof updated.phoneNumber !== 'string') throw new Error('Phone number is required.')
        if (methodId === 'bank') {
          if (typeof updated.accountName !== 'string') throw new Error('Account name is required.')
          if (typeof updated.bankName !== 'string') throw new Error('Bank name is required.')
          if (typeof updated.accountNumber !== 'string') throw new Error('Account number is required.')
        }
        if (typeof updated.enabled !== 'boolean') throw new Error('Enabled status is required.')
        payments[methodId] = updated
        writePayments(payments)
        const data = readData(); auditAdminAction(data, request, `Updated ${updated.name} payment settings.`); writeData(data)
        return send(response, 200, { payment: updated })
      }
      return send(response, 404, { error: 'Admin payments endpoint not found.' })
    }
    if (url.pathname === '/api/admin/settings') {
      if (!adminOnly(request, response)) return
      if (request.method === 'GET') return send(response, 200, { settings: readSettings() })
      if (request.method === 'PATCH') {
        const body = await readBody(request)
        const fee = Number(body.carGatePickupFee)
        if (!Number.isFinite(fee) || fee < 0) return send(response, 400, { error: 'Car gate pickup fee must be a valid non-negative number.' })
        const settings = { ...readSettings(), carGatePickupFee: fee }
        writeSettings(settings)
        const data = readData(); auditAdminAction(data, request, 'Updated car gate pickup delivery fee.'); writeData(data)
        return send(response, 200, { settings })
      }
      return send(response, 404, { error: 'Admin settings endpoint not found.' })
    }
    if (url.pathname.startsWith('/api/admin/')) {
      if (!adminOnly(request, response)) return
      const data = readData()
      if (request.method === 'GET' && url.pathname === '/api/admin/dashboard') return send(response, 200, { summary: { ...summary(data.orders), lowStock: data.products.filter((product) => product.stock > 0 && product.stock <= 5 && product.enabled !== false).length, outOfStock: data.products.filter((product) => product.stock === 0 && product.enabled !== false).length }, orders: data.orders, products: data.products, customers: data.customers.map((customer) => adminCustomerSummary(customer, data.orders)), promotions: data.promotions, activityLog: data.activityLog || [] })
      if (request.method === 'GET' && url.pathname === '/api/admin/backup') {
        const backup = JSON.stringify({ exportedAt: new Date().toISOString(), shop: data }, null, 2)
        response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="htoo-backup-${new Date().toISOString().slice(0, 10)}.json"`, 'Cache-Control': 'no-store' })
        return response.end(backup)
      }
      if (request.method === 'POST' && url.pathname === '/api/admin/products') { const product = cleanProduct(await readBody(request)); data.products = [product, ...data.products.filter((item) => item.id !== product.id)]; auditAdminAction(data, request, `Added product: ${product.nameEn}.`); writeData(data); return send(response, 201, { product }) }
      if (url.pathname.startsWith('/api/admin/products/')) {
        const id = url.pathname.split('/').pop(); const current = data.products.find((product) => product.id === id)
        if (!current) return send(response, 404, { error: 'Product not found.' })
        if (request.method === 'PATCH') { const product = cleanProduct(await readBody(request), current); data.products = data.products.map((item) => item.id === id ? product : item); auditAdminAction(data, request, `Updated product: ${product.nameEn}.`); writeData(data); return send(response, 200, { product }) }
        if (request.method === 'DELETE') { data.products = data.products.filter((item) => item.id !== id); auditAdminAction(data, request, `Deleted product: ${current.nameEn}.`); writeData(data); return send(response, 200, { ok: true }) }
      }
      if (request.method === 'POST' && url.pathname === '/api/admin/promotions') { const promotion = cleanPromotion(await readBody(request)); data.promotions = [promotion, ...data.promotions.filter((item) => item.id !== promotion.id)]; auditAdminAction(data, request, `Added promotion: ${promotion.name}.`); writeData(data); return send(response, 201, { promotion }) }
      if (url.pathname.startsWith('/api/admin/promotions/')) {
        const id = url.pathname.split('/').pop(); const current = data.promotions.find((promotion) => promotion.id === id)
        if (!current) return send(response, 404, { error: 'Promotion not found.' })
        if (request.method === 'PATCH') { const promotion = cleanPromotion(await readBody(request), current); data.promotions = data.promotions.map((item) => item.id === id ? promotion : item); auditAdminAction(data, request, `Updated promotion: ${promotion.name}.`); writeData(data); return send(response, 200, { promotion }) }
        if (request.method === 'DELETE') { data.promotions = data.promotions.filter((item) => item.id !== id); auditAdminAction(data, request, `Deleted promotion: ${current.name}.`); writeData(data); return send(response, 200, { ok: true }) }
      }
      if (request.method === 'PATCH' && url.pathname.startsWith('/api/admin/orders/')) {
        const id = url.pathname.split('/').pop(); const body = await readBody(request)
        if (body.status && !ORDER_STATUSES.includes(body.status)) return send(response, 400, { error: 'Invalid order status.' })
        if (body.paymentStatus && !PAYMENT_STATUSES.includes(body.paymentStatus)) return send(response, 400, { error: 'Invalid payment status.' })
        data.orders = data.orders.map((order) => order.id === id ? { ...order, ...(body.status ? { status: body.status } : {}), ...(body.paymentStatus ? { paymentStatus: body.paymentStatus } : {}), updatedAt: new Date().toISOString() } : order); auditAdminAction(data, request, `Updated order ${id.slice(0, 8)}.`); writeData(data)
        return send(response, 200, { order: data.orders.find((order) => order.id === id) })
      }
      return send(response, 404, { error: 'Admin endpoint not found.' })
    }
    if (request.method === 'GET' && url.pathname === '/api/products') return send(response, 200, { products: readData().products.filter((product) => product.enabled !== false) })
    if (request.method === 'GET' && url.pathname === '/api/settings') return send(response, 200, { settings: readSettings() })
    if (request.method === 'GET' && url.pathname === '/api/payments') {
      const payments = readPayments()
      const enabled = Object.values(payments).filter((p) => p.enabled).map((p) => ({ id: p.id, name: p.name, nameMyanmar: p.nameMyanmar, accountName: p.accountName, phoneNumber: p.phoneNumber, bankName: p.bankName, accountNumber: p.accountNumber }))
      return send(response, 200, { payments: enabled })
    }
    if (request.method === 'POST' && url.pathname === '/api/customers') {
      const session = customerOnly(request, response); if (!session) return
      const body = await readBody(request)
      if (body.id && body.id !== session.customerId) return send(response, 403, { error: 'You cannot update another customer.' })
      const data = readData(); const existing = data.customers.find((customer) => customer.id === session.customerId)
      if (!existing) return send(response, 404, { error: 'Customer not found.' })
      const customer = { ...existing, name: String(body.name || existing.name).trim(), phone: normalizePhone(body.phone || existing.phone) }
      data.customers = [customer, ...data.customers.filter((item) => item.id !== customer.id)]; writeData(data)
      return send(response, 200, { customer: customerSafeProfile(customer) })
    }
    if (request.method === 'POST' && url.pathname === '/api/orders') {
      const order = await readBody(request)
      const authenticatedCustomer = customerSession(request)
      if (order.customer?.userId && (!authenticatedCustomer || order.customer.userId !== authenticatedCustomer.customerId)) return send(response, 403, { error: 'Customer session does not match this order.' })
      if (authenticatedCustomer) order.customer.userId = authenticatedCustomer.customerId
      if (!order.id || !order.customer?.name || !order.customer?.phone || !Array.isArray(order.items) || !order.total || !ORDER_STATUSES.includes(order.status) || !PAYMENT_STATUSES.includes(order.paymentStatus)) return send(response, 400, { error: 'Order is missing required fields.' })
      const data = readData(); const requested = new Map(order.items.map((item) => [String(item.id), Number(item.quantity)]))
      for (const [id, quantity] of requested) { const product = data.products.find((item) => String(item.id) === id); if (!product || product.enabled === false || !Number.isInteger(quantity) || quantity < 1 || product.stock < quantity) return send(response, 409, { error: `Insufficient stock for ${product?.nameEn || 'one of the products'}.` }) }
      const customer = data.customers.find((item) => (order.customer.userId && item.id === order.customer.userId) || item.phone === order.customer.phone) || { id: order.customer.userId || crypto.randomUUID(), phone: order.customer.phone, orderIds: [] }
      Object.assign(customer, { name: order.customer.name, address: order.customer.address, userId: order.customer.userId || customer.userId, orderIds: [...new Set([...(customer.orderIds || []), order.id])] })
      data.customers = [customer, ...data.customers.filter((item) => item.id !== customer.id)]
      data.products = data.products.map((product) => requested.has(String(product.id)) ? { ...product, stock: product.stock - requested.get(String(product.id)) } : product)
      data.orders = [order, ...data.orders.filter((item) => item.id !== order.id)]; writeData(data)
      return send(response, 201, { ok: true })
    }
    return send(response, 404, { error: 'Not found.' })
  } catch (error) { return send(response, 400, { error: error.message || 'Request failed.' }) }
})

server.listen(port, () => console.log(`HTOO API listening on http://localhost:${port}`))
