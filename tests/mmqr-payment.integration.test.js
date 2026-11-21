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
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ecommerce-mmqr-test-'))
const databaseFile = path.join(tempRoot, 'shop.sqlite')
const shopDataFile = path.join(tempRoot, 'shop.json')
const paymentsFile = path.join(tempRoot, 'payments.json')
const settingsFile = path.join(tempRoot, 'settings.json')
const adminFile = path.join(tempRoot, 'admin.json')
const ownerPassword = 'temporary-owner-password'
const ownerSalt = crypto.randomBytes(16).toString('hex')
const ownerHash = crypto.scryptSync(ownerPassword, ownerSalt, 64, { N: 16_384, r: 8, p: 1 }).toString('hex')

const MOCK_QR = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="160" height="160" fill="#111"/></svg>'
)

const seededShop = {
  orders: [],
  products: [{
    id: 'prod-mmqr-1',
    name: 'MMQR Test Product',
    price: 15000,
    stock: 10,
    enabled: true
  }],
  customers: [],
  categories: [],
  subCategories: []
}

const seededPayments = {
  cod: { id: 'cod', name: 'Cash', type: 'cash', enabled: true, sortOrder: 1 },
  mmqr: {
    id: 'mmqr',
    name: 'MMQR',
    nameMyanmar: 'MMQR',
    type: 'wallet',
    enabled: true,
    accountName: '',
    phoneNumber: '',
    bankName: '',
    accountNumber: '',
    qrCode: MOCK_QR,
    mmqrImageUrl: MOCK_QR,
    sortOrder: 2
  }
}

fs.writeFileSync(shopDataFile, JSON.stringify(seededShop))
fs.writeFileSync(paymentsFile, JSON.stringify(seededPayments))
fs.writeFileSync(settingsFile, JSON.stringify({ carGatePickupFee: 3000 }))
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
  const text = await response.text()
  let data = null
  try { data = JSON.parse(text) } catch { data = text }
  return { response, data }
}

after(async () => {
  if (serverProcess && serverProcess.exitCode === null) {
    serverProcess.kill()
    await Promise.race([once(serverProcess, 'exit'), new Promise((resolve) => setTimeout(resolve, 3000))])
  }
  fs.rmSync(tempRoot, { recursive: true, force: true })
})

test('MMQR payment integration: admin configuration, orders API, and storefront checkout', async () => {
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
      PAYMENT_ACCOUNTS_FILE: paymentsFile,
      SHOP_SETTINGS_FILE: settingsFile,
      SESSION_SECRET: 'test-session-secret-mmqr'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  })

  let output = ''
  serverProcess.stdout.setEncoding('utf8').on('data', (chunk) => { output += chunk })
  serverProcess.stderr.setEncoding('utf8').on('data', (chunk) => { output += chunk })

  const deadline = Date.now() + 15_000
  let isReady = false
  while (Date.now() < deadline) {
    if (serverProcess.exitCode !== null) throw new Error(`Server exited early: ${output}`)
    try {
      const response = await fetch(`${baseUrl}/api/payments`)
      if (response.ok) { isReady = true; break }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  assert.ok(isReady, `Server failed to start: ${output}`)

  // 1. Verify GET /api/payments returns MMQR with mmqrImageUrl and qrCode
  const paymentsRes = await request('/api/payments')
  assert.equal(paymentsRes.response.status, 200)
  const mmqrPayment = paymentsRes.data.payments.find((p) => p.id === 'mmqr')
  assert.ok(mmqrPayment, 'MMQR payment should be included in GET /api/payments')
  assert.equal(mmqrPayment.mmqrImageUrl, MOCK_QR)
  assert.equal(mmqrPayment.qrCode, MOCK_QR)

  // 2. Owner Login
  const ownerLogin = await request('/api/owner/login', {
    method: 'POST',
    body: { email: 'owner@example.test', password: ownerPassword }
  })
  assert.equal(ownerLogin.response.status, 200)
  const ownerCookie = sessionCookie(ownerLogin.response, 'hto_admin_session')

  // 3. Admin creates a new dedicated MMQR payment account with mmqrImageUrl
  const NEW_QR = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  const createPaymentRes = await request('/api/admin/payments', {
    method: 'POST',
    cookie: ownerCookie,
    body: {
      id: 'mmqr-special',
      name: 'Shop MMQR Pay',
      type: 'mmqr',
      mmqrImageUrl: NEW_QR,
      enabled: true
    }
  })
  assert.equal(createPaymentRes.response.status, 201, `Failed to create MMQR payment: ${JSON.stringify(createPaymentRes.data)}`)
  const createdId = createPaymentRes.data.payment.id
  assert.ok(createdId, 'Payment ID should be generated')
  assert.equal(createPaymentRes.data.payment.mmqrImageUrl, NEW_QR)
  assert.equal(createPaymentRes.data.payment.qrCode, NEW_QR)

  // 4. Admin updates mmqrImageUrl on existing account
  const patchPaymentRes = await request('/api/admin/payments/mmqr', {
    method: 'PATCH',
    cookie: ownerCookie,
    body: {
      mmqrImageUrl: NEW_QR
    }
  })
  assert.equal(patchPaymentRes.response.status, 200)
  assert.equal(patchPaymentRes.data.payment.mmqrImageUrl, NEW_QR)

  // 5. Customer places an order using MMQR without needing accountName / phoneNumber
  const orderRes = await request('/api/orders', {
    method: 'POST',
    body: {
      customer: {
        name: 'Aung Aung',
        phone: '09765432100',
        address: 'No. 123 Bogyoke Rd, Yangon'
      },
      paymentAccountId: createdId,
      paymentSlip: NEW_QR,
      deliveryMethod: 'standard',
      items: [{
        productId: 'prod-mmqr-1',
        quantity: 1,
        selected: true
      }]
    }
  })
  assert.equal(orderRes.response.status, 201, `Order placement failed: ${JSON.stringify(orderRes.data)}`)
  assert.ok(orderRes.data.order, 'Order object should be returned')
  assert.equal(orderRes.data.order.status, 'New')
  assert.equal(orderRes.data.order.paymentMethod, 'Shop MMQR Pay')

  // 6. Component source code assertions
  const mobileAppSrc = fs.readFileSync(path.join(root, 'src', 'MobileApp.jsx'), 'utf8')
  assert.ok(mobileAppSrc.includes('isMmqrPayment'), 'MobileApp should include isMmqrPayment helper')
  assert.ok(!mobileAppSrc.includes('mob-co-account-list'), 'MobileApp should completely remove mob-co-account-list')
  assert.ok(!mobileAppSrc.includes('mob-payment-detail-box'), 'MobileApp should completely remove mob-payment-detail-box')
  assert.ok(mobileAppSrc.includes('mob-qr-preview'), 'MobileApp should render mob-qr-preview')
  assert.ok(mobileAppSrc.includes('mob-slip-box'), 'MobileApp should render mob-slip-box')

  const desktopAppSrc = fs.readFileSync(path.join(root, 'src', 'DesktopApp.jsx'), 'utf8')
  assert.ok(desktopAppSrc.includes('isMmqrPayment'), 'DesktopApp should include isMmqrPayment helper')
  assert.ok(desktopAppSrc.includes('isSelectedMmqr'), 'DesktopApp should detect isSelectedMmqr')
  assert.ok(desktopAppSrc.includes('slip-upload-row'), 'DesktopApp should include slip upload field')

  const adminPageSrc = fs.readFileSync(path.join(root, 'src', 'admin', 'pages', 'PaymentMethodsPage.jsx'), 'utf8')
  assert.ok(adminPageSrc.includes('mmqrImageUrl'), 'Admin PaymentMethodsPage should support mmqrImageUrl')
  assert.ok(adminPageSrc.includes('payment-mmqr-upload'), 'Admin PaymentMethodsPage should have dedicated file upload')
  assert.ok(adminPageSrc.includes('payment-mmqr-image-url'), 'Admin PaymentMethodsPage should have MMQR Image URL input')
})
