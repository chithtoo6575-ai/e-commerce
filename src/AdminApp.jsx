import { useEffect, useMemo, useState } from 'react'
import './Admin.css'

const money = (amount) => `Ks ${Math.round(amount || 0).toLocaleString('en-US')}`
const statuses = ['New', 'Confirmed', 'Packing', 'Shipped', 'Delivered', 'Cancelled']
const paymentStatuses = ['Pending Verification', 'Verified', 'Rejected', 'Not Required']

const NAV_ITEMS = [
  { id: 'Dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'Orders', label: 'Orders', icon: '🧾' },
  { id: 'Order Chat', label: 'Order Chat', icon: '💬' },
  { id: 'Products', label: 'Products', icon: '🛍️' },
  { id: 'Stock', label: 'Stock', icon: '📦' },
  { id: 'Categories', label: 'Categories', icon: '🗂️' },
  { id: 'Payments', label: 'Payments', icon: '💳' },
  { id: 'Customers', label: 'Customers', icon: '👥' },
  { id: 'Promotions', label: 'Promotions', icon: '🏷️' },
  { id: 'Reviews', label: 'Reviews', icon: '⭐' },
  { id: 'Delivery', label: 'Delivery', icon: '🚚' },
  { id: 'Invoices', label: 'Invoices', icon: '🧮' },
  { id: 'Notifications', label: 'Notifications', icon: '🔔' },
  { id: 'Reports', label: 'Sales Reports', icon: '📈' },
  { id: 'Homepage', label: 'Banners', icon: '🏠' },
  { id: 'Settings', label: 'Shop Settings', icon: '⚙️' },
  { id: 'Security Log', label: 'Activity History', icon: '🛡️' },
  { id: 'Backup', label: 'Backup / Data Safety', icon: '💾' },
]

export default function AdminApp() {
  const [auth, setAuth] = useState(null)
  const [login, setLogin] = useState({ email: '', password: '' })
  const [data, setData] = useState(null)
  const [payments, setPayments] = useState(null)
  const [settings, setSettings] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('Dashboard')
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [log, setLog] = useState([])

  function pushLog(message) {
    setLog((current) => [{ id: crypto.randomUUID(), message, at: new Date().toISOString() }, ...current].slice(0, 50))
  }

  async function loadDashboard() {
    const response = await fetch('/api/admin/dashboard')
    if (!response.ok) throw new Error('Unable to load orders.')
    setData(await response.json())
  }

  async function loadPayments() {
    const response = await fetch('/api/admin/payments')
    if (!response.ok) throw new Error('Unable to load payments.')
    setPayments(await response.json())
  }

  async function loadSettings() {
    const response = await fetch('/api/admin/settings')
    if (!response.ok) throw new Error('Unable to load settings.')
    const result = await response.json()
    setSettings(result.settings)
  }

  useEffect(() => {
    fetch('/api/admin/session')
      .then((response) => { if (response.ok) return response.json(); throw new Error() })
      .then(({ admin }) => { setAuth(admin); return Promise.all([loadDashboard(), loadPayments(), loadSettings()]) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function submit(event) {
    event.preventDefault()
    setError('')
    const response = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(login) })
    const result = await response.json()
    if (!response.ok) return setError(result.error)
    setAuth(result.admin)
    pushLog(`Signed in as ${result.admin.email}`)
    await loadDashboard()
  }

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' })
    pushLog('Signed out')
    setAuth(null)
    setData(null)
  }

  async function updateOrder(id, changes) {
    const response = await fetch(`/api/admin/orders/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(changes) })
    const result = await response.json()
    if (!response.ok) return setError(result.error)
    setSelectedOrder(result.order)
    pushLog(`Order ${result.order.orderNumber || id} updated: ${Object.entries(changes).map(([k, v]) => `${k} → ${v}`).join(', ')}`)
    await loadDashboard()
  }

  async function savePaymentSettings(methodId, settings) {
    const response = await fetch(`/api/admin/payments/${methodId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) })
    const result = await response.json()
    if (!response.ok) return setError(result.error)
    pushLog(`Payment method "${methodId}" settings saved`)
    await loadPayments()
  }

  async function saveShopSettings(changes) {
    const response = await fetch('/api/admin/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(changes) })
    const result = await response.json()
    if (!response.ok) return setError(result.error)
    setSettings(result.settings)
    pushLog(`Shop settings updated: ${Object.entries(changes).map(([k, v]) => `${k} → ${v}`).join(', ')}`)
  }

  async function saveProduct(product) {
    const editing = Boolean(product.id)
    const response = await fetch(editing ? `/api/admin/products/${product.id}` : '/api/admin/products', { method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(product) })
    const result = await response.json()
    if (!response.ok) return setError(result.error)
    pushLog(`Product "${result.product.nameEn || result.product.name}" ${editing ? 'updated' : 'created'}`)
    await loadDashboard()
  }

  async function removeProduct(id) {
    if (!window.confirm('Delete this product?')) return
    const response = await fetch(`/api/admin/products/${id}`, { method: 'DELETE' })
    const result = await response.json()
    if (!response.ok) return setError(result.error)
    pushLog(`Product ${id} deleted`)
    await loadDashboard()
  }

  async function savePromotion(promotion) {
    const editing = Boolean(promotion.id)
    const response = await fetch(editing ? `/api/admin/promotions/${promotion.id}` : '/api/admin/promotions', { method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(promotion) })
    const result = await response.json()
    if (!response.ok) return setError(result.error)
    pushLog(`Promotion "${result.promotion.name}" ${editing ? 'updated' : 'created'}`)
    await loadDashboard()
  }

  async function removePromotion(id) {
    const response = await fetch(`/api/admin/promotions/${id}`, { method: 'DELETE' })
    if (response.ok) { pushLog(`Promotion ${id} deleted`); await loadDashboard() }
  }

  async function downloadBackup() {
    try {
      const response = await fetch('/api/admin/backup')
      if (!response.ok) throw new Error('Unable to create backup.')
      const backup = await response.blob()
      const link = document.createElement('a')
      link.href = URL.createObjectURL(backup)
      link.download = `htoo-backup-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      URL.revokeObjectURL(link.href)
      pushLog('Downloaded protected shop backup')
    } catch (backupError) {
      setError(backupError.message)
    }
  }

  if (loading) return <div className="admin-loading">HTOO</div>

  if (!auth) {
    return (
      <main className="admin-login">
        <div className="login-panel">
          <span className="admin-mark">H</span>
          <p className="admin-kicker">HTOO ADMIN PANEL / OWNER ACCESS</p>
          <h1>Welcome back.</h1>
          <p className="admin-tagline">HTOO — Better Life, Together</p>
          <form onSubmit={submit}>
            <label>Admin email
              <input type="email" required autoComplete="username" value={login.email} onChange={(event) => setLogin({ ...login, email: event.target.value })} />
            </label>
            <label>Password
              <input type="password" required autoComplete="current-password" value={login.password} onChange={(event) => setLogin({ ...login, password: event.target.value })} />
            </label>
            {error && <div className="admin-error" role="alert">{error}</div>}
            <button className="admin-primary" type="submit">Sign in securely <span>↗</span></button>
          </form>
          <small>Owner area only. Customer accounts cannot access this dashboard.</small>
        </div>
      </main>
    )
  }

  const summary = data?.summary || {}
  const products = data?.products || []
  const orders = data?.orders || []

  return (
    <div className="admin-shell">
      <button className="sidebar-toggle" onClick={() => setSidebarOpen((open) => !open)} aria-label="Toggle menu">☰</button>

      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="admin-brand">
          <span className="admin-mark">H</span>
          <div>
            <strong>HTOO Admin Panel</strong>
            <small>Better Life, Together</small>
          </div>
        </div>

        <nav>
          {NAV_ITEMS.map((item) => (
            <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => { setTab(item.id); setSidebarOpen(false) }}>
              <span className="nav-icon">{item.icon}</span>{item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-actions">
          <button className="admin-logout" onClick={logout}><span className="nav-icon">🚪</span>Logout</button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <p className="admin-kicker">SHOP OWNER / {tab.toUpperCase()}</p>
            <h1>{tab}</h1>
          </div>
          <div className="admin-user"><span>{auth.email.slice(0, 2).toUpperCase()}</span><small>{auth.email}</small></div>
        </header>

        {error && <div className="admin-error admin-error-banner" role="alert">{error}</div>}

        {tab === 'Dashboard' && <Dashboard summary={summary} data={data} onOrders={() => setTab('Orders')} onOpen={setSelectedOrder} onStatus={(id, status) => updateOrder(id, { status })} />}
        {tab === 'Orders' && <Orders orders={orders} onOpen={setSelectedOrder} onStatus={(id, status) => updateOrder(id, { status })} />}
        {tab === 'Order Chat' && <OrderChat onOpenOrder={(id) => setSelectedOrder(orders.find((order) => order.id === id) || null)} />}
        {tab === 'Products' && <Products products={products} onSave={saveProduct} onDelete={removeProduct} />}
        {tab === 'Stock' && <Stock products={products} onSave={saveProduct} />}
        {tab === 'Categories' && <Categories products={products} />}
        {tab === 'Payments' && <PaymentSettings payments={payments?.payments || {}} onSave={savePaymentSettings} />}
        {tab === 'Customers' && <Customers data={data} />}
        {tab === 'Promotions' && <Promotions promotions={data?.promotions || []} onSave={savePromotion} onDelete={removePromotion} />}
        {tab === 'Reviews' && <Reviews />}
        {tab === 'Delivery' && <Delivery settings={settings} onSaveSettings={saveShopSettings} />}
        {tab === 'Invoices' && <Invoices orders={orders} />}
        {tab === 'Notifications' && <Notifications summary={summary} orders={orders} products={products} />}
        {tab === 'Reports' && <Reports orders={orders} products={products} />}
        {tab === 'Homepage' && <Homepage />}
        {tab === 'Settings' && <Settings />}
        {tab === 'Security Log' && <SecurityLog log={data?.activityLog || log} auth={auth} />}
        {tab === 'Backup' && <BackupData onDownload={downloadBackup} />}
      </main>

      {selectedOrder && (
        <OrderDetail order={selectedOrder} onClose={() => setSelectedOrder(null)} onUpdate={updateOrder} />
      )}
    </div>
  )
}

/* ---------- DASHBOARD ---------- */

function SalesChart({ orders }) {
  const days = useMemo(() => {
    const now = new Date()
    const buckets = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(now)
      date.setDate(now.getDate() - (6 - index))
      return { key: date.toISOString().slice(0, 10), label: date.toLocaleDateString(undefined, { weekday: 'short' }), total: 0 }
    })
    orders.forEach((order) => {
      if (order.status === 'Cancelled') return
      const key = (order.createdAt || '').slice(0, 10)
      const bucket = buckets.find((day) => day.key === key)
      if (bucket) bucket.total += Number(order.total || 0)
    })
    return buckets
  }, [orders])

  const max = Math.max(...days.map((day) => day.total), 1)

  return (
    <div className="sales-chart">
      {days.map((day) => (
        <div className="sales-chart-bar" key={day.key}>
          <div className="sales-chart-track">
            <div className="sales-chart-fill" style={{ height: `${Math.max(4, (day.total / max) * 100)}%` }} title={money(day.total)} />
          </div>
          <small>{day.label}</small>
        </div>
      ))}
    </div>
  )
}

function Dashboard({ summary, data, onOrders, onOpen, onStatus }) {
  const orders = data?.orders || []
  const products = data?.products || []
  const cards = [
    ['todayOrders', 'Today Orders', summary.todayOrders || 0],
    ['pending', 'Pending Orders', summary.pending || 0],
    ['pendingPayment', 'Pending Payment', summary.pendingPayment || 0],
    ['totalSales', 'Total Sales', money(summary.totalSales || 0)],
    ['products', 'Products', products.length],
    ['lowStock', 'Low Stock', summary.lowStock || 0],
    ['customers', 'Customers', data?.customers?.length || 0],
  ]
  const topSelling = useMemo(() => {
    const counts = new Map()
    orders.forEach((order) => (order.items || []).forEach((item) => counts.set(item.name, (counts.get(item.name) || 0) + item.quantity)))
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [orders])
  const lowStockProducts = products.filter((product) => product.stock <= 5).sort((a, b) => a.stock - b.stock).slice(0, 6)

  return (
    <>
      <section className="stat-grid">
        {cards.map(([key, label, value]) => (
          <div className={`stat-card ${['lowStock', 'outOfStock', 'pendingPayment'].includes(key) && summary[key] ? 'warning-card' : ''}`} key={key}>
            <small>{label}</small>
            <strong>{value}</strong>
          </div>
        ))}
      </section>

      <section className="admin-section">
        <div className="section-title"><div><p className="admin-kicker">ANALYTICS</p><h2>Sales Overview (last 7 days)</h2></div></div>
        <SalesChart orders={orders} />
      </section>

      <div className="dashboard-grid">
        <section className="admin-section">
          <div className="section-title"><div><p className="admin-kicker">TOP PERFORMERS</p><h2>Top Selling Products</h2></div></div>
          {topSelling.length ? (
            <div className="owner-list">{topSelling.map(([name, qty]) => <div key={name}><strong>{name}</strong><span>{qty} sold</span></div>)}</div>
          ) : <div className="admin-empty">No sales data yet.</div>}
        </section>

        <section className="admin-section">
          <div className="section-title"><div><p className="admin-kicker">INVENTORY</p><h2>Low Stock Alert</h2></div></div>
          {lowStockProducts.length ? (
            <div className="owner-list">{lowStockProducts.map((product) => <div key={product.id}><strong>{product.nameEn || product.name}</strong><span className={product.stock === 0 ? 'danger-text' : ''}>{product.stock === 0 ? 'Out of stock' : `${product.stock} left`}</span></div>)}</div>
          ) : <div className="admin-empty">Stock levels look healthy.</div>}
        </section>
      </div>

      <section className="admin-section">
        <div className="section-title"><div><p className="admin-kicker">LIVE ORDER FEED</p><h2>Recent Orders</h2></div><button className="text-button" onClick={onOrders}>View all ↗</button></div>
        <OrderTable orders={orders.slice(0, 5)} onOpen={onOpen} onStatus={onStatus} />
      </section>
    </>
  )
}

/* ---------- ORDERS ---------- */

function Orders({ orders, onOpen, onStatus }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('All')
  const [paymentStatus, setPaymentStatus] = useState('All')
  const [date, setDate] = useState('')

  const filtered = orders.filter((order) => {
    const search = `${order.orderNumber || ''} ${order.id} ${order.customer?.name || ''} ${order.customer?.phone || ''}`.toLowerCase()
    return search.includes(query.toLowerCase()) &&
      (status === 'All' || order.status === status) &&
      (paymentStatus === 'All' || order.paymentStatus === paymentStatus) &&
      (!date || order.createdAt?.startsWith(date))
  })

  return (
    <section className="admin-section">
      <div className="section-title"><div><p className="admin-kicker">CUSTOMER ORDERS</p><h2>Order Management &amp; Search</h2></div></div>

      <div className="status-badge-row">
        {['All', ...statuses].map((item) => (
          <button key={item} className={`status-filter-badge status-${item.toLowerCase()} ${status === item ? 'active' : ''}`} onClick={() => setStatus(item)}>{item}</button>
        ))}
      </div>

      <div className="order-tools">
        <input placeholder="Search order, name, phone" value={query} onChange={(event) => setQuery(event.target.value)} />
        <select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)}>
          <option value="All">All payment statuses</option>
          {paymentStatuses.map((item) => <option key={item}>{item}</option>)}
        </select>
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </div>

      <OrderTable orders={filtered} onOpen={onOpen} onStatus={onStatus} />
    </section>
  )
}

function OrderTable({ orders, onOpen, onStatus }) {
  if (!orders.length) return <div className="admin-empty">No customer orders yet. New orders will appear here automatically.</div>
  return (
    <div className="order-table">
      {orders.map((order) => (
        <article className="admin-order" key={order.id}>
          <div className="order-customer">
            <strong>{order.orderNumber || order.id}</strong>
            <small>{new Date(order.createdAt).toLocaleString()}</small>
            <span>{order.customer?.name} · {order.customer?.phone}</span>
            <span>{order.customer?.address}</span>
          </div>
          <div className="order-items-preview">
            {order.items?.map((item) => <div key={item.id}><img src={item.image} alt="" /><span>{item.quantity} × {item.name}</span></div>)}
          </div>
          <div className="order-payment">
            <strong>{money(order.total)}</strong>
            <span>{order.paymentMethod}</span>
            <span className={`status-badge status-${(order.paymentStatus || '').toLowerCase().replace(/\s+/g, '-')}`}>{order.paymentStatus}</span>
          </div>
          <div className="order-actions">
            <select value={order.status} aria-label="Status" onChange={(event) => onStatus(order.id, event.target.value)}>
              {statuses.map((status) => <option key={status}>{status}</option>)}
            </select>
            <button className="open-order" onClick={() => onOpen(order)}>Open order</button>
          </div>
        </article>
      ))}
    </div>
  )
}

const TIMELINE_STEPS = ['New', 'Confirmed', 'Packing', 'Shipped', 'Delivered']

function OrderDetail({ order, onClose, onUpdate }) {
  const [chat, setChat] = useState({ messages: [] })
  const [draft, setDraft] = useState('')
  const [loadingChat, setLoadingChat] = useState(true)
  const [imageData, setImageData] = useState('')
  const [chatError, setChatError] = useState('')

  const currentStepIndex = TIMELINE_STEPS.indexOf(order.status)
  const isCancelled = order.status === 'Cancelled'

  useEffect(() => {
    let active = true
    async function loadChat() {
      setLoadingChat(true)
      setChatError('')
      try {
        const response = await fetch(`/api/admin/orders/${order.id}/chat`)
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Unable to load chat.')
        if (active) {
          setChat(result.chat || { messages: [] })
          await fetch(`/api/admin/orders/${order.id}/chat/read`, { method: 'POST' })
        }
      } catch (err) {
        if (active) setChatError(err.message)
      } finally {
        if (active) setLoadingChat(false)
      }
    }
    loadChat()
    return () => { active = false }
  }, [order.id])

  function handleImageChange(event) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setImageData(String(reader.result || ''))
    reader.readAsDataURL(file)
  }

  async function sendMessage() {
    const trimmed = draft.trim()
    if (!trimmed && !imageData) { setChatError('Type a message or attach an image.'); return }
    try {
      const response = await fetch(`/api/admin/orders/${order.id}/chat/messages`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: trimmed, image: imageData || undefined })
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to send message.')
      setChat(result.chat || { messages: [] })
      setDraft('')
      setImageData('')
      setChatError('')
    } catch (err) {
      setChatError(err.message)
    }
  }

  function printInvoice() { window.print() }

  return (
    <div className="order-detail-backdrop" onClick={onClose}>
      <article className="order-detail" onClick={(event) => event.stopPropagation()}>
        <header className="detail-header">
          <div>
            <p className="admin-kicker">Order details</p>
            <h2>{order.orderNumber}</h2>
            <small>{new Date(order.createdAt).toLocaleString()}</small>
          </div>
          <div className="detail-header-actions">
            <button className="print-invoice-button" onClick={printInvoice}>🖨 Print Invoice</button>
            <button className="close-button" onClick={onClose} aria-label="Close">×</button>
          </div>
        </header>

        {!isCancelled && (
          <div className="order-timeline">
            {TIMELINE_STEPS.map((step, index) => (
              <div key={step} className={`timeline-step ${index <= currentStepIndex ? 'done' : ''} ${index === currentStepIndex ? 'current' : ''}`}>
                <span className="timeline-dot" />
                <small>{step}</small>
              </div>
            ))}
          </div>
        )}

        <div className="detail-grid">
          <section>
            <h3>Customer</h3>
            <p><strong>{order.customer?.name}</strong><br />{order.customer?.phone}</p>
            <h3>Delivery address</h3>
            <p>{order.customer?.address}<br />{order.customer?.note}</p>
          </section>
          <section>
            <h3>Payment</h3>
            <p>Method: <strong>{order.paymentMethod}</strong><br />Status: <strong>{order.paymentStatus}</strong></p>
            <label className="detail-control payment-verify-toggle">
              Payment Verification
              <select value={order.paymentStatus} onChange={(event) => onUpdate(order.id, { paymentStatus: event.target.value })}>
                {paymentStatuses.map((status) => <option key={status}>{status}</option>)}
              </select>
            </label>
            <h3>Payment slip</h3>
            {order.receipt?.dataUrl ? <img className="receipt-image" src={order.receipt.dataUrl} alt="Payment slip uploaded by customer" /> : <p className="muted">No payment slip uploaded.</p>}
          </section>
        </div>

        <section className="detail-products">
          <h3>Order Items</h3>
          <table className="invoice-table">
            <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Subtotal</th></tr></thead>
            <tbody>
              {order.items?.map((item) => (
                <tr key={item.id}>
                  <td className="invoice-item-cell"><img src={item.image} alt={item.name} />{item.name}</td>
                  <td>{item.quantity}</td>
                  <td>{money(item.price)}</td>
                  <td>{money(item.price * item.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="detail-total"><span>Total amount</span><strong>{money(order.total)}</strong></div>
        </section>

        <section className="admin-order-chat-panel">
          <div className="admin-order-chat-header"><div><p className="admin-kicker">ORDER CHAT</p><h3>Customer ↔ Shop owner</h3></div></div>
          {loadingChat ? <div className="admin-chat-loading">Loading...</div> : (
            <>
              <div className="admin-chat-thread">
                {(chat.messages || []).length ? chat.messages.map((message) => (
                  <div key={message.id} className={`chat-bubble ${message.senderRole === 'admin' ? 'from-admin' : 'from-customer'}`}>
                    {message.image && <img src={message.image} alt="" />}
                    {message.text && <p>{message.text}</p>}
                    <small>{new Date(message.createdAt).toLocaleTimeString()}</small>
                  </div>
                )) : <div className="admin-empty">No messages yet.</div>}
              </div>
              {chatError && <p className="admin-error">{chatError}</p>}
              <div className="admin-chat-composer">
                <input placeholder="Type a message..." value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && sendMessage()} />
                <input type="file" accept="image/*" onChange={handleImageChange} />
                <button onClick={sendMessage}>Send</button>
              </div>
            </>
          )}
        </section>
      </article>
    </div>
  )
}

/* ---------- ORDER CHAT LIST ---------- */

function OrderChat({ onOpenOrder }) {
  const [chats, setChats] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    fetch('/api/admin/order-chat').then((response) => response.json()).then((result) => { if (active) setChats(result.chats || []) }).finally(() => active && setLoading(false))
    return () => { active = false }
  }, [])

  if (loading) return <div className="admin-empty">Loading conversations...</div>

  return (
    <section className="admin-section">
      <div className="section-title"><div><p className="admin-kicker">MESSENGER</p><h2>Order Chat</h2></div></div>
      {chats.length ? (
        <div className="chat-list">
          {chats.map((chat) => (
            <button key={chat.orderId} className="chat-list-item" onClick={() => onOpenOrder(chat.orderId)}>
              <div className="chat-list-avatar">{(chat.customer?.name || '?').slice(0, 1).toUpperCase()}</div>
              <div className="chat-list-body">
                <strong>{chat.customer?.name || 'Customer'} <small>· {chat.orderNumber}</small></strong>
                <span>{chat.lastMessage ? (chat.lastMessage.senderRole === 'admin' ? 'You: ' : '') + chat.lastMessage.text : 'No messages yet'}</span>
              </div>
              {chat.unreadCount > 0 && <span className="chat-unread-badge">{chat.unreadCount}</span>}
            </button>
          ))}
        </div>
      ) : <div className="admin-empty">No customer conversations yet.</div>}
    </section>
  )
}

/* ---------- PRODUCTS ---------- */

const emptyProduct = { nameEn: '', nameMy: '', descriptionEn: '', descriptionMy: '', category: 'Clothing', price: '', discountPrice: '', stock: 0, images: [], enabled: true }

function Products({ products, onSave, onDelete }) {
  const [editing, setEditing] = useState(null)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [sort, setSort] = useState('newest')

  const filtered = products
    .filter((product) => {
      const name = `${product.nameEn || product.name} ${product.nameMy || ''}`.toLowerCase()
      return (category === 'All' || product.category === category) && name.includes(query.toLowerCase())
    })
    .sort((left, right) => sort === 'price' ? Number(left.price) - Number(right.price) : sort === 'stock' ? Number(left.stock) - Number(right.stock) : 0)

  return (
    <section className="admin-section products-section">
      <div className="section-title">
        <div><p className="admin-kicker">CATALOG CONTROL</p><h2>Products</h2></div>
        <button className="admin-primary product-add-button" onClick={() => setEditing({ ...emptyProduct })}>+ Add Product</button>
      </div>

      <div className="product-tools">
        <input placeholder="Search products" value={query} onChange={(event) => setQuery(event.target.value)} />
        <select value={category} onChange={(event) => setCategory(event.target.value)}>
          <option>All</option><option>Clothing</option><option>Grocery</option><option>Phones &amp; Accessories</option>
        </select>
        <select value={sort} onChange={(event) => setSort(event.target.value)}>
          <option value="newest">Sort: newest</option><option value="price">Price: low to high</option><option value="stock">Stock: low to high</option>
        </select>
      </div>

      {editing && <ProductForm product={editing} onCancel={() => setEditing(null)} onSave={async (product) => { await onSave(product); setEditing(null) }} />}
      {!filtered.length && <div className="admin-empty">No products found.</div>}

      <div className="product-admin-grid">
        {filtered.map((product) => (
          <article className="product-admin-card" key={product.id}>
            <div className="admin-product-images">{(product.images || [product.image]).slice(0, 3).map((image) => <img key={image} src={image} alt="" />)}</div>
            <div className="product-admin-copy">
              <strong>{product.nameEn || product.name}</strong>
              <span>{product.nameMy}</span>
              <small>{product.category} · {product.stock === 0 ? 'Out of Stock' : `${product.stock} in stock`}</small>
              <b>{money(product.discountPrice ?? product.price)} {product.discountPrice != null && <del>{money(product.price)}</del>}</b>
              <label className="status-switch">
                <input type="checkbox" checked={product.enabled !== false} onChange={(event) => onSave({ ...product, enabled: event.target.checked })} />
                <span>{product.enabled !== false ? 'Active' : 'Hidden'}</span>
              </label>
            </div>
            <div className="product-admin-actions">
              <button onClick={() => setEditing({ ...product })}>Edit</button>
              <button onClick={() => onSave({ ...product, stock: product.stock + 1 })}>+ Stock</button>
              <button onClick={() => onSave({ ...product, stock: Math.max(0, product.stock - 1) })}>- Stock</button>
              <button className="delete-product" onClick={() => onDelete(product.id)}>Delete</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function ProductForm({ product, onCancel, onSave }) {
  const [values, setValues] = useState(product)
  const [error, setError] = useState('')
  function update(key, value) { setValues((current) => ({ ...current, [key]: value })) }
  function uploadImages(event) {
    const files = Array.from(event.target.files || []).filter((file) => file.type.startsWith('image/'))
    Promise.all(files.map((file) => new Promise((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(file) })))
      .then((images) => update('images', [...values.images, ...images]))
  }
  async function submit(event) {
    event.preventDefault()
    if (!values.images.length) return setError('Upload at least one product image.')
    if (values.discountPrice !== '' && Number(values.discountPrice) > Number(values.price)) return setError('Discount price must not exceed the regular price.')
    setError('')
    await onSave({ ...values, price: Number(values.price), discountPrice: values.discountPrice === '' ? null : Number(values.discountPrice), stock: Number(values.stock) })
  }
  return (
    <form className="product-form" onSubmit={submit}>
      <div className="form-heading"><h3>{values.id ? 'Edit product' : 'Add product'}</h3><button type="button" onClick={onCancel}>×</button></div>
      <div className="form-grid">
        <label>Product name / English<input required value={values.nameEn} onChange={(event) => update('nameEn', event.target.value)} /></label>
        <label>ပစ္စည်းအမည် / မြန်မာ<input required value={values.nameMy} onChange={(event) => update('nameMy', event.target.value)} /></label>
        <label>Description / English<textarea value={values.descriptionEn} onChange={(event) => update('descriptionEn', event.target.value)} /></label>
        <label>ဖော်ပြချက် / မြန်မာ<textarea value={values.descriptionMy} onChange={(event) => update('descriptionMy', event.target.value)} /></label>
        <label>Category
          <select value={values.category} onChange={(event) => update('category', event.target.value)}>
            <option>Clothing</option><option>Grocery</option><option>Phones &amp; Accessories</option>
          </select>
        </label>
        <label>Price (Ks)<input required type="number" min="0" value={values.price} onChange={(event) => update('price', event.target.value)} /></label>
        <label>Discount price (Ks)<input type="number" min="0" value={values.discountPrice ?? ''} onChange={(event) => update('discountPrice', event.target.value)} /></label>
        <label>Stock quantity<input required type="number" min="0" step="1" value={values.stock} onChange={(event) => update('stock', event.target.value)} /></label>
        <label className="image-upload">Product images<input required={!values.images.length} type="file" accept="image/*" multiple onChange={uploadImages} /></label>
      </div>
      <div className="form-image-list">
        {values.images.map((image, index) => (
          <div key={image}><img src={image} alt="" /><button type="button" onClick={() => update('images', values.images.filter((_, imageIndex) => imageIndex !== index))}>×</button></div>
        ))}
      </div>
      {error && <p className="admin-error">{error}</p>}
      <div className="form-actions"><button type="button" onClick={onCancel}>Cancel</button><button className="admin-primary" type="submit">Save product</button></div>
    </form>
  )
}

/* ---------- STOCK ---------- */

function Stock({ products, onSave }) {
  const sorted = [...products].sort((a, b) => a.stock - b.stock)
  return (
    <section className="admin-section">
      <div className="section-title"><div><p className="admin-kicker">INVENTORY CONTROL</p><h2>Stock</h2></div></div>
      <div className="stock-table">
        <div className="stock-table-head"><span>Product</span><span>Category</span><span>Stock</span><span>Adjust</span></div>
        {sorted.map((product) => (
          <div className={`stock-row ${product.stock === 0 ? 'danger' : product.stock <= 5 ? 'warning' : ''}`} key={product.id}>
            <span className="stock-row-name"><img src={(product.images || [product.image])[0]} alt="" />{product.nameEn || product.name}</span>
            <span>{product.category}</span>
            <span>{product.stock === 0 ? 'Out of stock' : product.stock}</span>
            <span className="stock-adjust">
              <button onClick={() => onSave({ ...product, stock: Math.max(0, product.stock - 1) })}>−</button>
              <button onClick={() => onSave({ ...product, stock: product.stock + 1 })}>+</button>
            </span>
          </div>
        ))}
        {!sorted.length && <div className="admin-empty">No products yet.</div>}
      </div>
    </section>
  )
}

/* ---------- CATEGORIES ---------- */

function Categories({ products }) {
  const categories = ['Clothing', 'Grocery', 'Phones & Accessories']
  return (
    <section className="admin-section owner-section">
      <p className="admin-kicker">CATALOG STRUCTURE</p>
      <h2>Categories</h2>
      <div className="owner-list">
        {categories.map((category) => (
          <div key={category}><strong>{category}</strong><span>{products.filter((product) => product.category === category).length} products</span></div>
        ))}
      </div>
    </section>
  )
}

/* ---------- CUSTOMERS ---------- */

function Customers({ data }) {
  const orders = data?.orders || []
  const customers = data?.customers?.length ? data.customers : [...new Map(orders.map((order) => [order.customer?.phone, order.customer])).values()].filter(Boolean)
  return (
    <section className="admin-section owner-section">
      <p className="admin-kicker">OWNER WORKSPACE</p>
      <h2>Customers</h2>
      {customers.length ? (
        <div className="owner-list">
          {customers.map((customer) => (
            <div key={customer.phone}>
              <strong>{customer.name}</strong>
              <span>{customer.phone} · {customer.orderCount ?? (customer.orderIds || orders.filter((order) => order.customer?.phone === customer.phone).map((order) => order.id)).length} orders · {money(customer.totalPurchase)}</span>
            </div>
          ))}
        </div>
      ) : <div className="admin-empty">Customer records will appear when orders arrive.</div>}
    </section>
  )
}

/* ---------- PROMOTIONS ---------- */

function Promotions({ promotions, onSave, onDelete }) {
  const [form, setForm] = useState(null)
  const initial = { name: '', type: 'percentage', amount: '', enabled: true }
  return (
    <section className="admin-section owner-section">
      <div className="section-title"><div><p className="admin-kicker">DISCOUNTS</p><h2>Promotions</h2></div><button className="admin-primary product-add-button" onClick={() => setForm({ ...initial })}>+ Create promotion</button></div>
      {form && (
        <form className="promotion-form" onSubmit={async (event) => { event.preventDefault(); await onSave({ ...form, amount: Number(form.amount) }); setForm(null) }}>
          <input required placeholder="Promotion name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
            <option value="percentage">Percentage %</option><option value="fixed">Fixed amount Ks</option>
          </select>
          <input required type="number" min="1" placeholder="Amount" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
          <label><input type="checkbox" checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} /> Enabled</label>
          <button className="admin-primary" type="submit">Save</button>
          <button type="button" onClick={() => setForm(null)}>Cancel</button>
        </form>
      )}
      {promotions.length ? (
        <div className="owner-list">
          {promotions.map((promotion) => (
            <div key={promotion.id}>
              <strong>{promotion.name}</strong>
              <span>{promotion.type === 'percentage' ? `${promotion.amount}%` : money(promotion.amount)} · {promotion.enabled ? 'Enabled' : 'Disabled'} <button onClick={() => setForm({ ...promotion })}>Edit</button> <button onClick={() => onDelete(promotion.id)}>Delete</button></span>
            </div>
          ))}
        </div>
      ) : <div className="admin-empty">No promotions created yet.</div>}
    </section>
  )
}

/* ---------- REVIEWS ---------- */

function Reviews() {
  return (
    <section className="admin-section owner-section">
      <p className="admin-kicker">CUSTOMER FEEDBACK</p>
      <h2>Reviews</h2>
      <div className="admin-empty">No product reviews submitted yet. Customer reviews will appear here once collected.</div>
    </section>
  )
}

/* ---------- DELIVERY ---------- */

function Delivery({ settings, onSaveSettings }) {
  const [zones, setZones] = useState([
    { id: 1, name: 'Yangon (Inner city)', fee: 2000, etaDays: 1 },
    { id: 2, name: 'Yangon (Suburbs)', fee: 3500, etaDays: 2 },
    { id: 3, name: 'Other regions', fee: 6000, etaDays: 4 },
  ])
  const [carGateFee, setCarGateFee] = useState(settings?.carGatePickupFee ?? 20000)
  const [saved, setSaved] = useState(false)
  useEffect(() => { setCarGateFee(settings?.carGatePickupFee ?? 20000) }, [settings?.carGatePickupFee])
  function update(id, key, value) { setZones((current) => current.map((zone) => zone.id === id ? { ...zone, [key]: value } : zone)) }
  async function saveCarGateFee(event) {
    event.preventDefault()
    setSaved(false)
    await onSaveSettings({ carGatePickupFee: Number(carGateFee) })
    setSaved(true)
  }
  return (
    <section className="admin-section owner-section">
      <p className="admin-kicker">SHIPPING &amp; FULFILLMENT</p>
      <h2>Delivery</h2>

      <form className="car-gate-fee-form" onSubmit={saveCarGateFee}>
        <label>
          Car Gate Pickup Fee (Ks)
          <input type="number" min="0" step="1000" required value={carGateFee} onChange={(event) => { setCarGateFee(event.target.value); setSaved(false) }} />
        </label>
        <button className="admin-primary" type="submit">Save fee</button>
        {saved && <span className="fee-saved-note">Saved — storefront checkout updated.</span>}
      </form>

      <div className="delivery-table">
        <div className="delivery-table-head"><span>Zone</span><span>Fee (Ks)</span><span>Estimated days</span></div>
        {zones.map((zone) => (
          <div className="delivery-row" key={zone.id}>
            <span>{zone.name}</span>
            <input type="number" min="0" value={zone.fee} onChange={(event) => update(zone.id, 'fee', Number(event.target.value))} />
            <input type="number" min="1" value={zone.etaDays} onChange={(event) => update(zone.id, 'etaDays', Number(event.target.value))} />
          </div>
        ))}
      </div>
      <p className="muted">Delivery zone settings are managed locally in this session.</p>
    </section>
  )
}

/* ---------- INVOICES ---------- */

function Invoices({ orders }) {
  return (
    <section className="admin-section">
      <div className="section-title"><div><p className="admin-kicker">BILLING</p><h2>Invoices</h2></div></div>
      {orders.length ? (
        <div className="invoice-list">
          {orders.map((order) => (
            <div className="invoice-row" key={order.id}>
              <span>{order.orderNumber || order.id}</span>
              <span>{order.customer?.name}</span>
              <span>{new Date(order.createdAt).toLocaleDateString()}</span>
              <span>{money(order.total)}</span>
              <button onClick={() => window.print()}>🖨 Print</button>
            </div>
          ))}
        </div>
      ) : <div className="admin-empty">No invoices yet.</div>}
    </section>
  )
}

/* ---------- NOTIFICATIONS ---------- */

function Notifications({ summary, orders, products }) {
  const notes = []
  if (summary.new) notes.push({ id: 'new-orders', text: `${summary.new} new order(s) awaiting confirmation.`, level: 'info' })
  if (summary.pendingPayment) notes.push({ id: 'pending-payment', text: `${summary.pendingPayment} order(s) pending payment verification.`, level: 'warning' })
  products.filter((product) => product.stock === 0).forEach((product) => notes.push({ id: `out-${product.id}`, text: `${product.nameEn || product.name} is out of stock.`, level: 'danger' }))
  products.filter((product) => product.stock > 0 && product.stock <= 5).forEach((product) => notes.push({ id: `low-${product.id}`, text: `${product.nameEn || product.name} has low stock (${product.stock} left).`, level: 'warning' }))
  return (
    <section className="admin-section">
      <div className="section-title"><div><p className="admin-kicker">ALERTS</p><h2>Notifications</h2></div></div>
      {notes.length ? (
        <div className="notification-list">{notes.map((note) => <div key={note.id} className={`notification-item ${note.level}`}>{note.text}</div>)}</div>
      ) : <div className="admin-empty">You're all caught up.</div>}
    </section>
  )
}

/* ---------- REPORTS ---------- */

function Reports({ orders, products }) {
  const validOrders = orders.filter((order) => order.status !== 'Cancelled')
  const sales = validOrders.reduce((total, order) => total + Number(order.total || 0), 0)
  const byCategory = useMemo(() => {
    const map = new Map()
    validOrders.forEach((order) => (order.items || []).forEach((item) => {
      const product = products.find((p) => p.id === item.id)
      const category = product?.category || 'Other'
      map.set(category, (map.get(category) || 0) + item.price * item.quantity)
    }))
    return [...map.entries()]
  }, [validOrders, products])
  const max = Math.max(...byCategory.map(([, value]) => value), 1)

  return (
    <section className="admin-section">
      <div className="section-title"><div><p className="admin-kicker">ANALYTICS</p><h2>Sales Report</h2></div></div>
      <div className="sales-summary">
        <div><small>Total sales</small><strong>{money(sales)}</strong></div>
        <div><small>Orders</small><strong>{validOrders.length}</strong></div>
        <div><small>Average order</small><strong>{money(validOrders.length ? sales / validOrders.length : 0)}</strong></div>
      </div>
      <div className="category-report">
        {byCategory.map(([category, value]) => (
          <div className="category-report-row" key={category}>
            <span>{category}</span>
            <div className="category-report-track"><div className="category-report-fill" style={{ width: `${(value / max) * 100}%` }} /></div>
            <b>{money(value)}</b>
          </div>
        ))}
        {!byCategory.length && <div className="admin-empty">No sales data yet.</div>}
      </div>
    </section>
  )
}

/* ---------- HOMEPAGE / BANNER MANAGER ---------- */

function Homepage() {
  const [slides, setSlides] = useState([
    { id: 1, title: 'Big Season Sale', cta: 'Shop now', active: true },
    { id: 2, title: 'New Arrivals', cta: 'Explore', active: true },
  ])
  function update(id, key, value) { setSlides((current) => current.map((slide) => slide.id === id ? { ...slide, [key]: value } : slide)) }
  function addSlide() { setSlides((current) => [...current, { id: Date.now(), title: 'New banner', cta: 'Learn more', active: true }]) }
  function removeSlide(id) { setSlides((current) => current.filter((slide) => slide.id !== id)) }
  return (
    <section className="admin-section owner-section">
      <div className="section-title"><div><p className="admin-kicker">STOREFRONT</p><h2>Homepage / Banner Manager</h2></div><button className="admin-primary product-add-button" onClick={addSlide}>+ Add banner</button></div>
      <div className="banner-list">
        {slides.map((slide) => (
          <div className="banner-row" key={slide.id}>
            <input value={slide.title} onChange={(event) => update(slide.id, 'title', event.target.value)} />
            <input value={slide.cta} onChange={(event) => update(slide.id, 'cta', event.target.value)} />
            <label className="status-switch"><input type="checkbox" checked={slide.active} onChange={(event) => update(slide.id, 'active', event.target.checked)} /><span>{slide.active ? 'Active' : 'Hidden'}</span></label>
            <button className="delete-product" onClick={() => removeSlide(slide.id)}>Delete</button>
          </div>
        ))}
      </div>
      <p className="muted">Banner content is managed locally in this session.</p>
    </section>
  )
}

/* ---------- SECURITY LOG ---------- */

function SecurityLog({ log, auth }) {
  return (
    <section className="admin-section">
      <div className="section-title"><div><p className="admin-kicker">AUDIT TRAIL</p><h2>Security Log</h2></div></div>
      <p className="muted">Signed in as {auth.email}. Activity is stored with the shop data and contains no passwords or secrets.</p>
      {log.length ? (
        <div className="security-log-list">{log.map((entry) => <div key={entry.id} className="security-log-item"><small>{new Date(entry.at).toLocaleString()}</small><span>{entry.actor ? `${entry.actor}: ` : ''}{entry.message}</span></div>)}</div>
      ) : <div className="admin-empty">No saved activity yet.</div>}
    </section>
  )
}

function BackupData({ onDownload }) {
  return (
    <section className="admin-section owner-section">
      <p className="admin-kicker">DATA SAFETY</p>
      <h2>Backup / Data Safety</h2>
      <p className="muted">Download an owner-only snapshot of products, orders, customers, promotions, and order chats. Restore is intentionally not available in the browser.</p>
      <button className="admin-primary product-add-button" onClick={onDownload}>Download JSON Backup</button>
    </section>
  )
}

/* ---------- SETTINGS ---------- */

function Settings() {
  return (
    <section className="admin-section owner-section">
      <p className="admin-kicker">OWNER WORKSPACE</p>
      <h2>Shop Settings</h2>
      <div className="settings-list">
        <div><span>Shop name</span><strong>HTOO</strong></div>
        <div><span>Currency</span><strong>Myanmar Kyat (Ks)</strong></div>
        <div><span>Language</span><strong>Myanmar / English</strong></div>
        <div><span>Access</span><strong>Owner-only, secure session</strong></div>
      </div>
    </section>
  )
}

/* ---------- PAYMENTS ---------- */

function PaymentSettings({ payments, onSave }) {
  const [editing, setEditing] = useState(null)
  const paymentMethods = [
    { id: 'cod', name: 'Cash on Delivery (COD)', fields: [] },
    { id: 'kbzpay', name: 'KPay (KBZ Pay)', fields: ['accountName', 'phoneNumber'] },
    { id: 'wavemoney', name: 'WavePay (Wave Money)', fields: ['accountName', 'phoneNumber'] },
    { id: 'ayapay', name: 'AYA Pay (ABA)', fields: ['accountName', 'phoneNumber'] },
    { id: 'bank', name: 'Bank Transfer', fields: ['accountName', 'bankName', 'accountNumber'] },
  ]
  const getPayment = (id) => payments?.[id] || {}

  return (
    <section className="admin-section owner-section">
      <div className="section-title"><div><p className="admin-kicker">PAYMENT MANAGEMENT</p><h2>Payments</h2></div></div>
      <div className="payment-methods">
        {paymentMethods.map((method) => {
          if (method.id === 'cod') {
            return (
              <div key={method.id} className="payment-method-card">
                <h3>{method.name}</h3>
                <div className="method-details"><small>Availability</small><p>Always available at checkout, no account setup required.</p></div>
                <div className="method-status"><span className="status-badge enabled">Enabled</span></div>
              </div>
            )
          }
          const payment = getPayment(method.id)
          if (editing?.id === method.id) {
            return (
              <form key={method.id} className="payment-form" onSubmit={async (event) => { event.preventDefault(); await onSave(method.id, editing); setEditing(null) }}>
                <h3>{method.name}</h3>
                {method.fields.includes('accountName') && <label>Account Name<input required value={editing.accountName || ''} onChange={(e) => setEditing({ ...editing, accountName: e.target.value })} /></label>}
                {method.fields.includes('phoneNumber') && <label>Phone Number<input required type="tel" value={editing.phoneNumber || ''} onChange={(e) => setEditing({ ...editing, phoneNumber: e.target.value })} /></label>}
                {method.fields.includes('bankName') && <label>Bank Name<input required value={editing.bankName || ''} onChange={(e) => setEditing({ ...editing, bankName: e.target.value })} /></label>}
                {method.fields.includes('accountNumber') && <label>Account Number<input required value={editing.accountNumber || ''} onChange={(e) => setEditing({ ...editing, accountNumber: e.target.value })} /></label>}
                <label><input type="checkbox" checked={editing.enabled || false} onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })} /> Enabled</label>
                <button className="admin-primary" type="submit">Save</button>
                <button type="button" onClick={() => setEditing(null)}>Cancel</button>
              </form>
            )
          }
          return (
            <div key={method.id} className="payment-method-card">
              <h3>{method.name}</h3>
              <div className="method-details">
                <small>Account Name</small><p>{payment.accountName || 'Not configured'}</p>
                <small>{method.fields.includes('phoneNumber') ? 'Phone Number' : 'Bank Name / Account Number'}</small>
                <p>{payment.phoneNumber || payment.bankName ? `${payment.phoneNumber || payment.bankName}${payment.accountNumber ? ' / ' + payment.accountNumber : ''}` : 'Not configured'}</p>
              </div>
              <div className="method-status">
                <span className={`status-badge ${payment.enabled ? 'enabled' : 'disabled'}`}>{payment.enabled ? 'Enabled' : 'Disabled'}</span>
                <button onClick={() => setEditing({ id: method.id, ...payment })}>Edit</button>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
