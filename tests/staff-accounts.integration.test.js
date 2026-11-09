import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { after, test } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ecommerce-staff-test-'))
const databaseFile = path.join(tempRoot, 'shop.sqlite')
const shopDataFile = path.join(tempRoot, 'shop.json')
const adminFile = path.join(tempRoot, 'admin.json')
const ownerPassword = 'temporary-owner-password'
const staffPassword = 'temporary-staff-password'
const ownerSalt = crypto.randomBytes(16).toString('hex')
const ownerHash = crypto.scryptSync(ownerPassword, ownerSalt, 64, { N: 16_384, r: 8, p: 1 }).toString('hex')

const seededShop = {
  orders: [{
    id: 'order-test-1',
    orderNumber: 'ORDER-TEST-1',
    status: 'New',
    createdAt: '2026-10-01T10:00:00.000Z',
    total: 987654321,
    subtotal: 987650000,
    shippingFee: 4321,
    discount: 0,
    paymentMethod: 'BANK-SECRET',
    paymentStatus: 'Confirmed',
    transactionId: 'TRANSACTION-SECRET',
    receipt: { dataUrl: 'PAYMENT-SLIP-SECRET' },
    items: [{ id: 'product-test-1', productId: 'product-test-1', name: 'Test Product', price: 987650000, quantity: 1 }],
    customer: { name: 'Test Customer', phone: '0912345678', email: 'customer@example.test', userId: 'customer-test-1', totalPurchase: 987654321 }
  }],
  products: [{
    id: 'product-test-1',
    name: 'Test Product',
    nameEn: 'Test Product',
    sku: 'TEST-001',
    price: 987650000,
    costPrice: 12345,
    profit: 987637655,
    margin: 98,
    stock: 7,
    enabled: true
  }],
  customers: [{ id: 'customer-test-1', name: 'Test Customer', totalPurchase: 987654321 }],
  categories: [],
  subCategories: []
}

fs.writeFileSync(shopDataFile, JSON.stringify(seededShop))
fs.writeFileSync(adminFile, JSON.stringify({
  email: 'owner@example.test',
  salt: ownerSalt,
  hash: ownerHash
}))

let serverProcess
let baseUrl

async function findAvailablePort() {
  const listener = net.createServer()
  listener.listen(0, '127.0.0.1')
  await once(listener, 'listening')
  const { port } = listener.address()
  await new Promise((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()))
  return port
}

async function startServer() {
  const port = await findAvailablePort()
  baseUrl = `http://127.0.0.1:${port}`
  serverProcess = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: {
      ...process.env,
      API_PORT: String(port),
      SHOP_DATABASE_FILE: databaseFile,
      SHOP_DATA_FILE: shopDataFile,
      ADMIN_ACCOUNT_FILE: adminFile,
      PAYMENT_ACCOUNTS_FILE: path.join(tempRoot, 'payments.json'),
      SHOP_SETTINGS_FILE: path.join(tempRoot, 'settings.json'),
      SESSION_SECRET: 'integration-test-session-secret'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  })

  let output = ''
  serverProcess.stdout.setEncoding('utf8').on('data', (chunk) => { output += chunk })
  serverProcess.stderr.setEncoding('utf8').on('data', (chunk) => { output += chunk })

  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    if (serverProcess.exitCode !== null) throw new Error(`Test API exited early: ${output}`)
    try {
      const response = await fetch(`${baseUrl}/api/admin/session`)
      if (response.status === 401) return
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`Test API did not become ready: ${output}`)
}

function sessionCookie(response, name) {
  const cookies = response.headers.getSetCookie()
  const value = cookies.map((cookie) => cookie.match(new RegExp(`^${name}=([^;]+)`))?.[1]).find(Boolean)
  assert.ok(value, `Expected ${name} session cookie`)
  return `${name}=${value}`
}

async function request(pathname, { cookie, method = 'GET', body, headers = {} } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      ...headers,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  })
  return { response, data: await response.json() }
}

after(async () => {
  if (serverProcess && serverProcess.exitCode === null) {
    serverProcess.kill()
    await Promise.race([once(serverProcess, 'exit'), new Promise((resolve) => setTimeout(resolve, 3000))])
  }
  fs.rmSync(tempRoot, { recursive: true, force: true })
})

test('Owner and two Staff accounts have isolated authentication and permissions', async () => {
  await startServer()

  const ownerLogin = await request('/api/owner/login', {
    method: 'POST',
    body: { email: 'owner@example.test', password: ownerPassword }
  })
  assert.equal(ownerLogin.response.status, 200)
  const ownerCookie = sessionCookie(ownerLogin.response, 'hto_admin_session')
  assert.equal(ownerLogin.data.admin.role, 'owner')
  const legacyOwnerLogin = await request('/api/admin/login', {
    method: 'POST',
    body: { email: 'owner@example.test', password: ownerPassword }
  })
  assert.equal(legacyOwnerLogin.response.status, 200)

  const ownerCannotUseStaffLogin = await request('/api/staff/login', {
    method: 'POST',
    body: { username: 'owner@example.test', password: ownerPassword }
  })
  assert.equal(ownerCannotUseStaffLogin.response.status, 401)

  const createStaff = async (name, username) => {
    const result = await request('/api/admin/staff', {
      cookie: ownerCookie,
      method: 'POST',
      body: { name, username, password: staffPassword }
    })
    assert.equal(result.response.status, 201)
    return result.data.staff
  }

  const staffOne = await createStaff('Staff One', 'staff.one')
  const staffTwo = await createStaff('Staff Two', 'staff.two')
  const thirdStaff = await request('/api/admin/staff', {
    cookie: ownerCookie,
    method: 'POST',
    body: { name: 'Staff Three', username: 'staff.three', password: staffPassword }
  })
  assert.equal(thirdStaff.response.status, 201)

  const ownerTab = await request('/api/owner/login', {
    headers: { 'X-Admin-Tab': 'owner-tab-session-1234' },
    method: 'POST',
    body: { email: 'owner@example.test', password: ownerPassword }
  })
  assert.equal(ownerTab.response.status, 200)
  const staffTab = await request('/api/staff/login', {
    headers: { 'X-Admin-Tab': 'staff-tab-session-1234' },
    method: 'POST',
    body: { username: 'staff.one', password: staffPassword }
  })
  assert.equal(staffTab.response.status, 200)
  assert.equal((await request('/api/admin/session', { headers: { 'X-Admin-Tab': 'owner-tab-session-1234' } })).data.admin.role, 'owner')
  assert.equal((await request('/api/admin/session', { headers: { 'X-Admin-Tab': 'staff-tab-session-1234' } })).data.admin.role, 'staff')
  const staffTabLogout = await request('/api/staff/logout', {
    headers: { 'X-Admin-Tab': 'staff-tab-session-1234' },
    method: 'POST'
  })
  assert.equal(staffTabLogout.response.status, 200)
  assert.equal((await request('/api/admin/session', { headers: { 'X-Admin-Tab': 'owner-tab-session-1234' } })).response.status, 200)
  assert.equal((await request('/api/admin/session', { headers: { 'X-Admin-Tab': 'staff-tab-session-1234' } })).response.status, 401)

  for (const [staff, permissions] of [
    [staffOne, ['products.view', 'products.edit', 'orders.view', 'orders.confirm', 'stock.update', 'customers.edit', 'customers.support']],
    [staffTwo, ['orders.details', 'shipping.manage']]
  ]) {
    const updated = await request(`/api/admin/staff/${staff.id}/permissions`, {
      cookie: ownerCookie,
      method: 'PUT',
      body: { permissions }
    })
    assert.equal(updated.response.status, 200)
  }

  const ownerDashboard = await request('/api/admin/dashboard', { cookie: ownerCookie })
  assert.equal(ownerDashboard.response.status, 200)
  assert.equal(ownerDashboard.data.orders[0].id, 'order-test-1')
  assert.equal(ownerDashboard.data.orders[0].total, 987654321)
  assert.equal(ownerDashboard.data.products[0].id, 'product-test-1')
  assert.equal(ownerDashboard.data.products[0].costPrice, 12345)
  assert.equal(ownerDashboard.data.customers[0].totalPurchase, 987654321)

  const loginStaff = async (username) => {
    const result = await request('/api/staff/login', {
      method: 'POST',
      body: { username, password: staffPassword }
    })
    assert.equal(result.response.status, 200)
    assert.equal(result.data.admin.role, 'staff')
    return sessionCookie(result.response, 'hto_staff_session')
  }

  const staffOneCookie = await loginStaff('staff.one')
  const staffOneDashboard = await request('/api/admin/dashboard', { cookie: staffOneCookie })
  assert.equal(staffOneDashboard.response.status, 200)
  assert.deepEqual(Object.keys(staffOneDashboard.data.summary).sort(), [
    'cancelled', 'confirmed', 'delivered', 'lowStock', 'new', 'outOfStock', 'packing', 'pending', 'shipped', 'totalOrders'
  ].sort())
  assert.equal(staffOneDashboard.data.orders[0].total, undefined)
  assert.equal(staffOneDashboard.data.orders[0].items, undefined)
  assert.equal(staffOneDashboard.data.products[0].costPrice, undefined)
  assert.equal(staffOneDashboard.data.products[0].profit, undefined)
  assert.equal(JSON.stringify(staffOneDashboard.data).includes('PAYMENT-SLIP-SECRET'), false)

  const deniedStaffManagement = await request('/api/admin/staff', { cookie: staffOneCookie })
  assert.equal(deniedStaffManagement.response.status, 403)
  const deniedOrderDetails = await request('/api/admin/orders/order-test-1', { cookie: staffOneCookie })
  assert.equal(deniedOrderDetails.response.status, 403)
  const deniedFinance = await request('/api/admin/backup', { cookie: staffOneCookie })
  assert.equal(deniedFinance.response.status, 403)
  const deniedPayments = await request('/api/admin/payments', { cookie: staffOneCookie })
  assert.equal(deniedPayments.response.status, 403)
  const deniedProductCostWrite = await request('/api/admin/products/product-test-1', {
    cookie: staffOneCookie,
    method: 'PATCH',
    body: { cost_price: 1 }
  })
  assert.equal(deniedProductCostWrite.response.status, 403)

  const confirmed = await request('/api/admin/orders/order-test-1', {
    cookie: staffOneCookie,
    method: 'PATCH',
    body: { status: 'Confirmed' }
  })
  assert.equal(confirmed.response.status, 200)
  assert.equal(confirmed.data.order.total, undefined)
  const stockUpdate = await request('/api/admin/stock-movements', {
    cookie: staffOneCookie,
    method: 'POST',
    body: { productId: 'product-test-1', type: 'Stock In', quantity: 1, reason: 'Integration test stock update' }
  })
  assert.equal(stockUpdate.response.status, 201)
  assert.equal(stockUpdate.data.product.costPrice, undefined)
  const customerUpdate = await request('/api/admin/customers/customer-test-1/status', {
    cookie: staffOneCookie,
    method: 'PATCH',
    body: { status: 'Suspended' }
  })
  assert.equal(customerUpdate.response.status, 200)
  assert.equal(customerUpdate.data.customer.totalPurchase, undefined)
  const supportChat = await request('/api/admin/orders/order-test-1/chat', { cookie: staffOneCookie })
  assert.equal(supportChat.response.status, 200)
  assert.equal(supportChat.data.chat.order.items[0].price, undefined)
  assert.equal(supportChat.data.chat.order.receipt, undefined)
  assert.equal(JSON.stringify(supportChat.data).includes('BANK-SECRET'), false)
  const deniedLogMutation = await request('/api/admin/staff/activity', {
    cookie: staffOneCookie,
    method: 'DELETE'
  })
  assert.equal(deniedLogMutation.response.status, 403)

  const staffTwoCookie = await loginStaff('staff.two')
  const staffTwoDashboard = await request('/api/admin/dashboard', { cookie: staffTwoCookie })
  assert.equal(staffTwoDashboard.response.status, 200)
  assert.equal(staffTwoDashboard.data.orders[0].total, undefined)
  assert.equal(staffTwoDashboard.data.orders[0].items[0].price, undefined)
  assert.equal(staffTwoDashboard.data.orders[0].receipt, undefined)
  assert.equal(staffTwoDashboard.data.orders[0].transactionId, undefined)
  assert.equal(JSON.stringify(staffTwoDashboard.data).includes('987654321'), false)

  const deniedSelfPermissionChange = await request(`/api/admin/staff/${staffTwo.id}/permissions`, {
    cookie: staffTwoCookie,
    method: 'PUT',
    body: { permissions: ['products.view'] }
  })
  assert.equal(deniedSelfPermissionChange.response.status, 403)

  const permissionChange = await request(`/api/admin/staff/${staffTwo.id}/permissions`, {
    cookie: ownerCookie,
    method: 'PUT',
    body: { permissions: ['orders.view'] }
  })
  assert.equal(permissionChange.response.status, 200)
  const revokedSession = await request('/api/admin/session', { cookie: staffTwoCookie })
  assert.equal(revokedSession.response.status, 401)

  const deactivated = await request(`/api/admin/staff/${staffTwo.id}`, {
    cookie: ownerCookie,
    method: 'PATCH',
    body: { active: false }
  })
  assert.equal(deactivated.response.status, 200)
  const inactiveLogin = await request('/api/staff/login', {
    method: 'POST',
    body: { username: 'staff.two', password: staffPassword }
  })
  assert.equal(inactiveLogin.response.status, 401)

  const logout = await request('/api/staff/logout', { cookie: staffOneCookie, method: 'POST' })
  assert.equal(logout.response.status, 200)
  const activity = await request('/api/admin/staff/activity', { cookie: ownerCookie })
  assert.equal(activity.response.status, 200)
  assert.ok(activity.data.logs.some((entry) => entry.staffId === staffOne.id && entry.action === 'login'))
  assert.ok(activity.data.logs.some((entry) => entry.staffId === staffOne.id && entry.action === 'logout'))
  assert.ok(activity.data.logs.some((entry) => entry.staffId === staffOne.id && entry.action.includes('Confirmed')))
  assert.ok(activity.data.logs.some((entry) => entry.staffId === staffOne.id && entry.action.includes('Stock In')))

  const deletedStaff = await request(`/api/admin/staff/${staffOne.id}`, {
    cookie: ownerCookie,
    method: 'DELETE'
  })
  assert.equal(deletedStaff.response.status, 200)
  const staffAfterDelete = await request('/api/admin/staff', { cookie: ownerCookie })
  assert.equal(staffAfterDelete.response.status, 200)
  assert.equal(staffAfterDelete.data.staff.some((account) => account.id === staffOne.id), false)
})
