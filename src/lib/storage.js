const KEYS = { users: 'atelier_users', session: 'atelier_session', carts: 'atelier_carts', products: 'atelier_products', orders: 'atelier_orders', categories: 'atelier_categories', paymentAccounts: 'atelier_payment_accounts', wishlists: 'atelier_wishlists' }

const read = (key, fallback) => {
  try {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) : fallback
  } catch { return fallback }
}
const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (err) {
    console.warn(`[storage] Failed writing ${key}:`, err)
  }
}

export function getProducts(seed) { const products = read(KEYS.products, null); if (products) return products; write(KEYS.products, seed); return seed }
export function saveProducts(products) { write(KEYS.products, products) }
export function getOrders() { return read(KEYS.orders, []) }
export function saveOrder(order) { const orders = getOrders(); write(KEYS.orders, [order, ...orders]); return order }
export function updateOrder(orderId, changes) { const orders = getOrders().map((order) => order.id === orderId ? { ...order, ...changes, updatedAt: new Date().toISOString() } : order); write(KEYS.orders, orders); return orders }
export function getCategories(seed) { const categories = read(KEYS.categories, null); if (categories) return categories; write(KEYS.categories, seed); return seed }
export function saveCategories(categories) { write(KEYS.categories, categories) }
export function getPaymentAccounts(seed) { const accounts = read(KEYS.paymentAccounts, null); if (accounts) return accounts; write(KEYS.paymentAccounts, seed); return seed }
export function savePaymentAccounts(accounts) { write(KEYS.paymentAccounts, accounts) }
export function getSession() { return read(KEYS.session, null) }
export function getCart(userId) { return read(KEYS.carts, {})[userId] || [] }
export function saveCart(userId, items) { write(KEYS.carts, { ...read(KEYS.carts, {}), [userId]: items }) }
export function mergeCart(userId, guestItems) {
  const merged = [...getCart(userId)]
  if (Array.isArray(guestItems)) {
    guestItems.forEach((guestItem) => {
      if (!guestItem || typeof guestItem !== 'object') return
      const guestKey = guestItem.cartKey || `${guestItem.id}:${guestItem.variants?.size || ''}:${guestItem.variants?.color || ''}`
      const existing = merged.find((item) => (item.cartKey || `${item.id}:${item.variants?.size || ''}:${item.variants?.color || ''}`) === guestKey)
      if (existing) existing.quantity += (Number(guestItem.quantity) || 1)
      else merged.push({ ...guestItem, cartKey: guestKey })
    })
  }
  saveCart(userId, merged)
  return merged
}
export function getWishlist(userId) { return read(KEYS.wishlists, {})[userId] || [] }
export function saveWishlist(userId, productIds) { write(KEYS.wishlists, { ...read(KEYS.wishlists, {}), [userId]: productIds }) }
export function mergeWishlist(userId, guestProductIds) {
  const userWishlist = Array.isArray(getWishlist(userId)) ? getWishlist(userId) : []
  const validGuestIds = Array.isArray(guestProductIds) ? guestProductIds : []
  const merged = Array.from(new Set([...userWishlist, ...validGuestIds]))
  saveWishlist(userId, merged)
  return merged
}