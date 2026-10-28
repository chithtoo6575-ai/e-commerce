import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { getCart, mergeCart, mergeWishlist, saveCart, saveWishlist } from './lib/storage'
import { useLanguage } from './lib/i18n'
import { getProductStock, getProductVariants, hasVariantStock, variantStockKey } from './lib/productVariants'
import { readJsonResponse, apiErrorMessage } from './lib/apiResponse'
import DesktopApp from './DesktopApp'
import MobileApp from './MobileApp'
import { adminStore } from './admin/adminStore'
import { fetchSupportChannels, mergeSupportChannels } from './lib/supportChannels'
import { shopData, supabase, supabaseConfigured } from './lib/supabase'

const GUEST_CART_KEY = 'atelier_guest_cart'
const GUEST_WISHLIST_KEY = 'atelier_guest_wishlist'
const GUEST_ORDER_ACCESS_KEY = 'hto_guest_order_access_key'
const ORDER_REQUEST_KEY = 'hto_order_request_key'
const formatPrice = (amount) => `Ks ${Math.round(amount || 0).toLocaleString('en-US')}`
let fallbackOrderRequestKey = ''

// crypto.randomUUID() only exists in secure contexts (https or localhost).
// When the storefront is opened over the LAN (e.g. http://10.56.125.59:5173)
// from a phone, randomUUID is undefined and would throw, breaking checkout.
// getRandomValues works in insecure contexts, so build a UUID v4 from it.
function createRequestKey() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  } catch {}
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0'))
    return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`
  }
  return `key-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function getOrderRequestKey() {
  try {
    const existing = sessionStorage.getItem(ORDER_REQUEST_KEY)
    if (existing) return existing
    const key = createRequestKey()
    sessionStorage.setItem(ORDER_REQUEST_KEY, key)
    return key
  } catch (storageError) {
    console.warn('[checkout] Could not persist the order retry key for this tab.', storageError.message)
    fallbackOrderRequestKey ||= createRequestKey()
    return fallbackOrderRequestKey
  }
}

// Identifies one selectable cart line: the product plus its chosen size/color.
const cartLineKey = (item) => `${item.id}:${item.variants?.size || ''}:${item.variants?.color || ''}`

// The single cart shape the cart API and the order API both expect. Prices, names and
// other display fields are deliberately left out so a stale local copy can never make
// the server think the cart changed.
function buildCartPayload(items) {
  const lines = new Map()
  for (const item of Array.isArray(items) ? items : []) {
    const id = String(item.id || item.productId || '')
    if (!id) continue
    const size = String(item.variants?.size || '')
    const color = String(item.variants?.color || '')
    const key = `${id}:${size}:${color}`
    const quantity = Math.max(1, Math.trunc(Number(item.quantity) || 1))
    // The same product+variant can arrive twice (e.g. from a guest merge); send one line.
    const existing = lines.get(key)
    if (existing) existing.quantity += quantity
    else lines.set(key, { id, productId: id, quantity, selected: item.selected !== false, variants: { ...(size ? { size } : {}), ...(color ? { color } : {}) } })
  }
  return [...lines.values()]
}

// Put saved lines back after a failed submission, adding only what is missing so a cart
// edited in another tab is not clobbered.
function mergeCartLines(current, lines) {
  const next = [...current]
  for (const line of lines) {
    const key = cartLineKey(line)
    const existing = next.find((item) => cartLineKey(item) === key)
    if (existing) existing.quantity = Math.max(Number(existing.quantity) || 0, Number(line.quantity) || 0)
    else next.push(line)
  }
  return next
}

// What the shop should keep after a successful order: every line that was NOT ordered,
// plus whatever is left of an ordered line when only part of its quantity was bought.
function remainingCartFor(savedOrder, orderedItems, previousCart) {
  const ordered = Array.isArray(savedOrder?.items) ? savedOrder.items : orderedItems
  const consumed = new Map()
  for (const item of ordered) {
    const key = cartLineKey({ ...item, id: item.productId || item.id })
    consumed.set(key, (consumed.get(key) || 0) + (Number(item.quantity) || 0))
  }
  const remaining = []
  for (const item of previousCart) {
    const key = cartLineKey(item)
    const bought = consumed.get(key) || 0
    const left = (Number(item.quantity) || 0) - bought
    if (left > 0) remaining.push({ ...item, quantity: left })
    consumed.delete(key)
  }
  // Lines ordered that were not in the local cart (e.g. changed elsewhere) are done too.
  return remaining
}

function getGuestOrderAccessKey() {
  try {
    const current = localStorage.getItem(GUEST_ORDER_ACCESS_KEY)
    if (current) return current
    const key = createRequestKey()
    localStorage.setItem(GUEST_ORDER_ACCESS_KEY, key)
    return key
  } catch (storageError) {
    console.warn('[orders] Could not persist guest order access.', storageError.message)
    return createRequestKey()
  }
}

function clearOrderRequestKey() {
  fallbackOrderRequestKey = ''
  try {
    sessionStorage.removeItem(ORDER_REQUEST_KEY)
  } catch (storageError) {
    console.warn('[checkout] Could not clear the order retry key for this tab.', storageError.message)
  }
}

const MAIN_TABS = ['home', 'categories', 'search', 'wishlist', 'account', 'cart']

const CATEGORY_TREE = {
  Men: ['T-Shirts', 'Shirts', 'Pants', 'Jackets', 'Sweaters', 'Shorts', 'Activewear', 'Shoes'],
  Women: ['Dresses', 'Tops', 'Pants', 'Jackets', 'Skirts', 'Activewear', 'Shoes'],
  Kids: ['Boys', 'Girls', 'Baby'],
  Shoes: ['Running', 'Casual', 'Formal'],
  Accessories: ['Bags', 'Belts', 'Hats', 'Watches'],
  Sale: ['Flash Sale', 'Clearance']
}

const DELIVERY_METHODS = [
  { id: 'standard', label: 'Standard Delivery' },
  { id: 'cargate', label: 'Car Gate Pickup' }
]

const seedCatalog = [
  { id: 'm-tee-1', name: 'Classic Cotton Tee', category: 'Men', subcategory: 'T-Shirts', brand: 'HTOO', style: 'Casual', material: 'Cotton', color: 'Black', size: ['S', 'M', 'L'], rating: 4.7, price: 24900, oldPrice: 29900, stock: 12, image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80', images: ['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80'], description: 'Premium heavyweight cotton tee with tailored fit and breathable weave.' },
  { id: 'w-dress-1', name: 'Floral Midi Dress', category: 'Women', subcategory: 'Dresses', brand: 'HTOO', style: 'Elegant', material: 'Rayon', color: 'Blue', size: ['M', 'L'], rating: 4.8, price: 48900, oldPrice: 56900, stock: 8, image: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=900&q=80', images: ['https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=900&q=80'], description: 'Flowing rayon silhouette with custom botanical floral print.' },
  { id: 'k-boys-1', name: 'Boys Active Set', category: 'Kids', subcategory: 'Boys', brand: 'HTOO Kids', style: 'Activewear', material: 'Polyester', color: 'Green', size: ['XS', 'S'], rating: 4.6, price: 31900, oldPrice: null, stock: 11, image: 'https://images.unsplash.com/photo-1519238359922-989348752efb?auto=format&fit=crop&w=900&q=80', images: ['https://images.unsplash.com/photo-1519238359922-989348752efb?auto=format&fit=crop&w=900&q=80'], description: 'Breathable sports wear set for active boys with stretch fabric.' },
  { id: 'shoe-1', name: 'City Runner Shoes', category: 'Shoes', subcategory: 'Running', brand: 'HTOO Sport', style: 'Sport', material: 'Mesh', color: 'White', size: ['40', '41', '42', '43'], rating: 4.5, price: 68900, oldPrice: 75900, stock: 14, image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80', images: ['https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80'], description: 'Lightweight aerodynamic running sneakers with responsive foam cushion.' },
  { id: 'acc-1', name: 'Canvas Daypack', category: 'Accessories', subcategory: 'Bags', brand: 'HTOO Essentials', style: 'Minimal', material: 'Canvas', color: 'Brown', size: ['One Size'], rating: 4.4, price: 39900, oldPrice: 45900, stock: 9, image: 'https://images.unsplash.com/photo-1491637639811-60e2756cc1c7?auto=format&fit=crop&w=900&q=80', images: ['https://images.unsplash.com/photo-1491637639811-60e2756cc1c7?auto=format&fit=crop&w=900&q=80'], description: 'Vintage waterproof waxed canvas backpack with laptop sleeve.' },
  { id: 'sale-1', name: 'Denim Jacket Sale', category: 'Sale', subcategory: 'Clearance', brand: 'HTOO', style: 'Street', material: 'Denim', color: 'Navy', size: ['M', 'L'], rating: 4.2, price: 55900, oldPrice: 79900, stock: 5, image: 'https://images.unsplash.com/photo-1521223890158-f9f7c3d5d504?auto=format&fit=crop&w=900&q=80', images: ['https://images.unsplash.com/photo-1521223890158-f9f7c3d5d504?auto=format&fit=crop&w=900&q=80'], description: 'Classic rugged washed denim jacket with brass buttons.' }
]

const initialFilters = {
  size: '',
  color: '',
  price: '',
  brand: '',
  category: '',
  rating: '',
  availability: '',
  material: '',
  style: ''
}

function readGuestList(key, fallback) {
  try {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

function writeGuestList(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

function mapApiProduct(raw) {
  const images = Array.isArray(raw.images) && raw.images.length ? raw.images : [raw.image || '']
  const rawVariants = raw.availableVariants || raw.variants || null
  const sizes = Array.isArray(rawVariants?.sizes)
    ? rawVariants.sizes
    : typeof raw.variants === 'string'
      ? raw.variants.split(',').map((s) => s.trim()).filter(Boolean)
      : Array.isArray(raw.variants)
        ? raw.variants
        : []
  return {
    id: String(raw.id),
    name: raw.nameEn || raw.name || 'Product',
    nameMy: raw.nameMy || '',
    category: raw.storefrontCategory || (raw.category === 'Clothing' ? 'Men' : raw.category === 'Grocery' ? 'Accessories' : 'Shoes'),
    subcategory: raw.subCategory || raw.categoryName || raw.category,
    brand: raw.brand || 'HTOO',
    style: raw.style || 'Standard',
    material: raw.material || '',
    color: raw.color || '',
    featured: Boolean(raw.featured),
    size: sizes,
    rating: Number.isFinite(Number(raw.rating)) ? Number(raw.rating) : 0,
    reviewsCount: Number(raw.reviewsCount) || 0,
    price: raw.discountPrice ?? raw.price ?? 0,
    oldPrice: raw.discountPrice != null && raw.discountPrice < raw.price ? raw.price : null,
    stock: Number.isInteger(raw.stock) ? raw.stock : 0,
    variantStock: raw.variantStock && typeof raw.variantStock === 'object' ? raw.variantStock : null,
    image: raw.image || raw.images?.[0] || '',
    images,
    description: raw.descriptionEn || raw.description || '',
    descriptionMy: raw.descriptionMy || '',
    careInformation: raw.careInformation || raw.care || '',
    sku: raw.sku || '',
    tags: raw.tags || '',
    variants: rawVariants,
    availableVariants: rawVariants
  }
}

export default function App() {
  const [language, setLanguage] = useLanguage()
  const changeCustomerLanguage = (nextLanguage) => {
    const next = nextLanguage === 'my' ? 'my' : 'en'
    setLanguage(next)
    if (!user) return
    fetch('/api/customer/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ languagePreference: next })
    })
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Unable to save language preference.')
        setUser(result.customer)
      })
      .catch((preferenceError) => {
        console.error('[i18n] Could not save the customer language preference:', preferenceError)
      })
  }
  const [guestMode, setGuestMode] = useState(() => {
    try { return localStorage.getItem('hto_guest_mode') === 'true' } catch { return false }
  })
  const [route, setRoute] = useState({ page: 'main' })
  const [authMode, setAuthMode] = useState('signin')
  const [authFlow, setAuthFlow] = useState('login')
  const [authOtpPurpose, setAuthOtpPurpose] = useState('')
  const [authChallengeId, setAuthChallengeId] = useState('')
  const [authPhone, setAuthPhone] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [authNotice, setAuthNotice] = useState('')
  const [accountLinkNotice, setAccountLinkNotice] = useState('')
  const [recoveryEmailChallengeId, setRecoveryEmailChallengeId] = useState('')
  const [recoveryEmailNotice, setRecoveryEmailNotice] = useState('')
  const [user, setUser] = useState(null)
  useEffect(() => {
    if (user?.languagePreference === 'my' || user?.languagePreference === 'en') {
      setLanguage(user.languagePreference)
    }
  }, [user?.id, user?.languagePreference, setLanguage])
  const [products, setProducts] = useState(seedCatalog)
  const [catalogStatus, setCatalogStatus] = useState('loading')
  const [cart, setCart] = useState([])
  const [cartLoadedFor, setCartLoadedFor] = useState('')
  const [cartSyncReadyFor, setCartSyncReadyFor] = useState('')
  // Latest in-flight cart save, so checkout never submits a cart the account does not have yet.
  const cartSyncRef = useRef(null)
  const [wishlist, setWishlist] = useState([])
  const [activeTab, setActiveTab] = useState('home')
  const [storefrontBanners, setStorefrontBanners] = useState(() => adminStore.getBanners())
  const [storefrontSections, setStorefrontSections] = useState(() => adminStore.getHomeSections())
  const [storefrontLayout, setStorefrontLayout] = useState(() => adminStore.getHomeLayout())
  // Active channels published by the admin; re-fetched when the Help page opens.
  const [supportChannels, setSupportChannels] = useState(() => adminStore.getSupportChannels())
  const [supportChannelsLoading, setSupportChannelsLoading] = useState(false)
  const [supportChannelsError, setSupportChannelsError] = useState('')
  const [storefrontNotifications, setStorefrontNotifications] = useState(() => adminStore.getNotifications())
  const [selectedCategory, setSelectedCategory] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [recentSearches, setRecentSearches] = useState([])
  const [sortBy, setSortBy] = useState('popular')
  const [filters, setFilters] = useState(initialFilters)
  const [coupon, setCoupon] = useState('')
  const [checkoutStep, setCheckoutStep] = useState('review')
  const [addressBook, setAddressBook] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('hto_customer_addresses') || '{}')
      return Array.isArray(stored.guest) ? stored.guest : []
    } catch {
      return []
    }
  })
  const [paymentMethods, setPaymentMethods] = useState([])
  const [paymentMethodsLoaded, setPaymentMethodsLoaded] = useState(false)
  const [promotions, setPromotions] = useState([])
  const [paymentSlip, setPaymentSlip] = useState('')
  const [orders, setOrders] = useState([])
  const [ordersLoadedFor, setOrdersLoadedFor] = useState('')
  const [deepLinkOrderId, setDeepLinkOrderId] = useState(() => new URLSearchParams(window.location.search).get('order') || '')
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [error, setError] = useState('')
  const [settings, setSettings] = useState({ carGatePickupFee: 20000 })
  const [checkoutForm, setCheckoutForm] = useState({
    name: '',
    phone: '',
    email: '',
    township: '',
    city: '',
    shippingAddress: '',
    deliveryMethod: DELIVERY_METHODS[0].id,
    paymentAccountId: '',
    saveAddress: true
  })

  useEffect(() => {
    const refreshStorefrontSettings = () => {
      setStorefrontBanners(adminStore.getBanners())
      setStorefrontSections(adminStore.getHomeSections())
      setStorefrontLayout(adminStore.getHomeLayout())
      setSupportChannels((current) => mergeSupportChannels(adminStore.getSupportChannels(), current))
      setStorefrontNotifications(adminStore.getNotifications())
    }
    const handleAdminStoreUpdate = (event) => {
      const key = event.detail?.key
      if (key === 'banners' || key === 'home_sections' || key === 'home_layout' || key === 'support_channels' || key === 'notifications') refreshStorefrontSettings()
    }
    const handleStorage = (event) => {
      if (event.key?.startsWith('htoo_admin_')) refreshStorefrontSettings()
    }
    window.addEventListener('htoo-admin-store-update', handleAdminStoreUpdate)
    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener('htoo-admin-store-update', handleAdminStoreUpdate)
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  // Pull the live, active-only channel list. Called on mount and whenever the
  // customer opens Help, so a change made in the dashboard shows up right away.
  const loadSupportChannels = useCallback(async () => {
    setSupportChannelsLoading(true)
    setSupportChannelsError('')
    try {
      const channels = await fetchSupportChannels()
      setSupportChannels(mergeSupportChannels(channels, adminStore.getSupportChannels()))
    } catch (channelError) {
      console.warn('[support] Could not load support channels from the server:', channelError)
      setSupportChannelsError('Unable to load the latest support channels. Please try again.')
    } finally {
      setSupportChannelsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSupportChannels()
  }, [loadSupportChannels])

  useEffect(() => {
    try {
      const books = JSON.parse(localStorage.getItem('hto_customer_addresses') || '{}')
      const saved = books[user?.id || 'guest']
      if (Array.isArray(saved)) setAddressBook(saved)
    } catch (storageError) {
      console.warn('[account] Could not restore saved addresses.', storageError)
    }
  }, [user?.id])

  useEffect(() => {
    try {
      const key = user?.id || 'guest'
      const books = JSON.parse(localStorage.getItem('hto_customer_addresses') || '{}')
      localStorage.setItem('hto_customer_addresses', JSON.stringify({ ...books, [key]: addressBook }))
    } catch (storageError) {
      console.warn('[account] Could not persist saved addresses.', storageError)
    }
  }, [addressBook, user?.id])

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('hto_checkout_draft') || '{}')
      if (saved && typeof saved === 'object') {
        setCheckoutForm((current) => ({ ...current, ...saved.form }))
        setCheckoutStep('review')
      }
    } catch (storageError) {
      console.warn('[checkout] Could not restore checkout progress.', storageError)
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('hto_checkout_draft', JSON.stringify({ form: checkoutForm, step: checkoutStep }))
    } catch (storageError) {
      console.warn('[checkout] Could not persist checkout progress.', storageError)
    }
  }, [checkoutForm, checkoutStep])

  useEffect(() => {
    if (!supabaseConfigured) {
      setCatalogStatus('error')
      setError('Connect Supabase to load live products and sign in securely.')
      return
    }
    let active = true
    const restoreCustomer = async () => {
      const profile = await shopData.getProfile()
      if (active && profile) {
        setUser({ id: profile.id, name: profile.full_name, phone: profile.phone, email: profile.email, languagePreference: profile.language_preference })
        setRoute({ page: 'main' })
      }
    }
    restoreCustomer().catch((restoreError) => console.error('[auth] Session restoration failed.', restoreError))
    supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) setUser(null)
    })
    const telegramWebApp = window.Telegram?.WebApp
    const telegramInitData = telegramWebApp?.initData || ''
    telegramWebApp?.ready()
    telegramWebApp?.expand()

    async function linkTelegramAccount() {
      const response = await fetch('/api/customer/telegram/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: telegramInitData })
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to link this Telegram account.')
    }

    shopData.getProducts().then((data) => {
      if (active) setProducts(data.map(mapApiProduct))
      if (active) setCatalogStatus('ready')
    }).catch((catalogError) => {
      console.error('[catalog] Unable to load products.', catalogError)
      if (active) setCatalogStatus('error')
    })
    shopData.getSettings().then((data) => { if (active && data.car_gate_pickup_fee != null) setSettings({ carGatePickupFee: Number(data.car_gate_pickup_fee) }) }).catch((loadError) => console.warn('[settings] Unable to load store settings.', loadError))
    shopData.getPromotions().then((data) => { if (active) setPromotions(data || []) }).catch((loadError) => console.warn('[promotions] Unable to load promotions.', loadError))
    shopData.getBanners().then((data) => {
      if (active && Array.isArray(data) && data.length) setStorefrontBanners(data.map((banner) => ({ ...banner, image: banner.image_url, altText: banner.alt_text, link: banner.link_url, sortOrder: banner.sort_order, startDate: banner.starts_on, endDate: banner.ends_on })))
    }).catch((loadError) => console.warn('[banners] Unable to load banners.', loadError))
    return () => { active = false }
  }, [])

  const refreshPaymentMethods = useCallback(async () => {
    const response = await fetch('/api/payments')
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Unable to load active payment methods.')
    if (!Array.isArray(result.payments)) throw new Error('The payment methods API returned invalid data.')
    return result.payments
  }, [])

  useEffect(() => {
    const callbackUrl = new URL(window.location.href)
    const code = callbackUrl.searchParams.get('code')
    const state = callbackUrl.searchParams.get('state')
    if (!code && !state && !callbackUrl.searchParams.has('error')) return
    const provider = callbackUrl.pathname.startsWith('/auth/telegram/') ? 'telegram' : 'google'
    window.history.replaceState({}, '', `${callbackUrl.pathname}${callbackUrl.hash}`)
    if (callbackUrl.searchParams.has('error') || !code || !state) {
      setError(`${provider === 'google' ? 'Google' : 'Telegram'} sign-in was cancelled or could not be completed. Please try again.`)
      setRoute({ page: 'auth' })
      return
    }
    let active = true
    setAuthBusy(true)
    fetch(`/api/customer/${provider}/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, state })
    }).then(async (response) => {
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Google sign-in failed.')
      if (!active) return
      setUser(result.customer)
      setRoute({ page: 'main' })
      setError('')
      if (result.linked) {
        setAccountLinkNotice(`${provider === 'google' ? 'Google' : 'Telegram'} account linked. You verified ownership of both accounts.`)
        setActiveTab('account')
      } else {
        setCartSyncReadyFor('')
      }
    }).catch((oauthError) => {
      if (active) {
        setError(oauthError.message || 'Google sign-in failed. Please try again.')
        setRoute({ page: 'auth' })
      }
    }).finally(() => { if (active) setAuthBusy(false) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (route.page !== 'checkout') return
    let active = true
    const refreshActivePayments = async () => {
      try {
        const available = await refreshPaymentMethods()
        if (active) {
          setPaymentMethods(available)
          setPaymentMethodsLoaded(true)
        }
      } catch (loadError) {
        console.error('[checkout] Could not refresh active payment methods.', loadError)
        if (active) setError(loadError.message || 'Unable to load active payment methods.')
      }
    }
    Promise.all([
      refreshPaymentMethods(),
      fetch('/api/promotions').then((response) => response.ok ? response.json() : Promise.reject(new Error('Unable to load promotions.')))
    ]).then(([paymentData, promotionData]) => {
      if (!active) return
      setPaymentMethods(paymentData)
      setPaymentMethodsLoaded(true)
      setPromotions(Array.isArray(promotionData.promotions) ? promotionData.promotions : [])
    }).catch((loadError) => {
      if (active) setError(loadError.message)
    })
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshActivePayments()
    }
    const timer = window.setInterval(() => { void refreshActivePayments() }, 15_000)
    window.addEventListener('focus', refreshWhenVisible)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener('focus', refreshWhenVisible)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [route.page, refreshPaymentMethods])

  useEffect(() => {
    if (!paymentMethodsLoaded) return
    // An empty selection means the customer is picking a payment kind right now:
    // wait for them instead of silently jumping back to the first account (COD).
    if (route.page === 'checkout' && !checkoutForm.paymentAccountId) return
    if (paymentMethods.some((payment) => payment.id === checkoutForm.paymentAccountId)) return
    const nextPaymentId = paymentMethods[0]?.id || ''
    setCheckoutForm((current) => current.paymentAccountId === nextPaymentId
      ? current
      : { ...current, paymentAccountId: nextPaymentId })
    setPaymentSlip('')
  }, [paymentMethods, paymentMethodsLoaded, checkoutForm.paymentAccountId, route.page])

  useEffect(() => {
    let active = true
    if (user?.id) {
      const mergedWish = mergeWishlist(user.id, readGuestList(GUEST_WISHLIST_KEY, []))
      setWishlist(mergedWish)
      writeGuestList(GUEST_WISHLIST_KEY, [])
      const savedCart = getCart(user.id)
      fetch('/api/customer/cart')
        .then((response) => response.ok ? response.json() : response.json().then((result) => Promise.reject(new Error(result.error || 'Unable to load your cart.'))))
        .then((data) => {
          if (!active) return
          const serverCart = Array.isArray(data.cart) ? data.cart : []
          saveCart(user.id, serverCart.length ? serverCart : savedCart)
          const mergedCart = mergeCart(user.id, readGuestList(GUEST_CART_KEY, []))
          setCart(mergedCart)
          setCartLoadedFor(user.id)
          setCartSyncReadyFor(user.id)
        })
        .catch((loadError) => {
          if (!active) return
          setCart(savedCart)
          setCartLoadedFor(user.id)
          setCartSyncReadyFor('')
          setError(loadError.message || 'Unable to sync your cart with your account.')
        })
    } else {
      setCart(readGuestList(GUEST_CART_KEY, []))
      setCartLoadedFor('guest')
      setWishlist(readGuestList(GUEST_WISHLIST_KEY, []))
    }
    return () => { active = false }
  }, [user?.id])

  useEffect(() => {
    if (cartLoadedFor !== (user?.id || 'guest')) return
    if (user?.id) saveCart(user.id, cart)
    else writeGuestList(GUEST_CART_KEY, cart)
  }, [cart, cartLoadedFor, user?.id])

  // Save the cart to the account. Order placement waits for the latest sync to land,
  // so what the server has always matches what checkout is about to submit.
  const syncCartToAccount = useCallback((items) => {
    const request = fetch('/api/customer/cart', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Cart-Sync-Mode': 'replace' },
      body: JSON.stringify({ items: buildCartPayload(items) })
    })
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Unable to sync your cart.')
        writeGuestList(GUEST_CART_KEY, [])
        return true
      })
    cartSyncRef.current = request
    request
      .catch((syncError) => {
        if (cartSyncRef.current === request) cartSyncRef.current = null
        setError(syncError.message || 'Unable to sync your cart with your account.')
      })
    return request
  }, [])

  useEffect(() => {
    if (!user?.id || cartSyncReadyFor !== user.id) return
    const timer = window.setTimeout(() => { void syncCartToAccount(cart) }, 250)
    return () => window.clearTimeout(timer)
  }, [cart, cartSyncReadyFor, user?.id, syncCartToAccount])

  useEffect(() => {
    if (user?.id) saveWishlist(user.id, wishlist)
    else writeGuestList(GUEST_WISHLIST_KEY, wishlist)
  }, [wishlist, user?.id])

  useEffect(() => {
    if (!user?.id && !guestMode) return
    let active = true
    const customerKey = user?.id || 'guest'
    async function loadOrders() {
      try {
        const response = await fetch('/api/customer/orders', user?.id ? {} : {
          headers: { 'X-Guest-Order-Key': getGuestOrderAccessKey() }
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Unable to refresh your orders.')
        if (active) {
          setOrders(Array.isArray(result.orders) ? result.orders : [])
          setOrdersLoadedFor(customerKey)
        }
      } catch (loadError) {
        if (active) setError(loadError.message || 'Unable to refresh your orders.')
      }
    }
    const refresh = () => { void loadOrders() }
    refresh()
    window.addEventListener('focus', refresh)
    const interval = window.setInterval(refresh, 15_000)
    return () => {
      active = false
      window.removeEventListener('focus', refresh)
      window.clearInterval(interval)
    }
  }, [user?.id, guestMode])

  useEffect(() => {
    if (!user?.id || !deepLinkOrderId || ordersLoadedFor !== user.id) return
    const order = orders.find((item) => item.id === deepLinkOrderId || item.orderNumber === deepLinkOrderId)
    setDeepLinkOrderId('')
    const currentUrl = new URL(window.location.href)
    currentUrl.searchParams.delete('order')
    window.history.replaceState(window.history.state, '', `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`)
    if (!order) {
      setError('That order is not available in this account.')
      return
    }
    setSelectedOrder(order)
    setActiveTab('account')
    setRoute({ page: 'main', openOrderId: order.id })
  }, [user?.id, deepLinkOrderId, ordersLoadedFor, orders])

  const allBrands = useMemo(() => Array.from(new Set(products.map((p) => p.brand))), [products])

  const filteredProducts = useMemo(() => {
    let list = [...products]

    if (activeTab === 'categories' && selectedCategory) {
      list = list.filter((product) => product.category === selectedCategory)
    }
    if (searchQuery.trim()) {
      const term = searchQuery.toLowerCase()
      list = list.filter((product) => `${product.name} ${product.brand}`.toLowerCase().includes(term))
    }
    if (filters.size) list = list.filter((p) => p.size.includes(filters.size))
    if (filters.color) list = list.filter((p) => p.color === filters.color)
    if (filters.brand) list = list.filter((p) => p.brand === filters.brand)
    if (filters.category) list = list.filter((p) => p.category === filters.category)
    if (filters.rating) list = list.filter((p) => p.rating >= Number(filters.rating))
    if (filters.availability === 'in-stock') list = list.filter((p) => p.stock > 0)
    if (filters.material) list = list.filter((p) => p.material === filters.material)
    if (filters.style) list = list.filter((p) => p.style === filters.style)
    if (filters.price) {
      if (filters.price === 'under-30') list = list.filter((p) => p.price < 30000)
      if (filters.price === '30-60') list = list.filter((p) => p.price >= 30000 && p.price <= 60000)
      if (filters.price === 'over-60') list = list.filter((p) => p.price > 60000)
    }

    if (sortBy === 'price-asc') list.sort((a, b) => a.price - b.price)
    if (sortBy === 'price-desc') list.sort((a, b) => b.price - a.price)
    if (sortBy === 'newest') list = list.reverse()
    if (sortBy === 'rating') list.sort((a, b) => b.rating - a.rating)

    return list
  }, [products, activeTab, selectedCategory, searchQuery, filters, sortBy])

  const wishlistProducts = useMemo(() => products.filter((product) => wishlist.includes(product.id)), [products, wishlist])
  const cartSubtotal = useMemo(() => cart.reduce((sum, item) => {
    const quantity = Number.isSafeInteger(item.quantity) && item.quantity > 0 ? item.quantity : 0
    const product = products.find((candidate) => String(candidate.id) === String(item.id))
    const price = Number(product?.discountPrice ?? product?.price ?? item.price)
    return sum + Math.max(0, Number.isFinite(price) ? price : 0) * quantity
  }, 0), [cart, products])
  const deliveryFee = checkoutForm.deliveryMethod === 'cargate' ? Math.max(0, Number(settings.carGatePickupFee) || 0) : 0
  // No silent fallback to the first account: while the customer is choosing a
  // payment kind (empty id) nothing is selected, and place-order stays blocked.
  const selectedPaymentAccount = paymentMethods.find((payment) => payment.id === checkoutForm.paymentAccountId) || null
  const isCashPayment = selectedPaymentAccount?.type === 'cash' || selectedPaymentAccount?.id === 'cod'
  const activePromotion = promotions.find((promotion) => {
    const code = String(promotion.code || promotion.name || '').trim().toUpperCase()
    const now = new Date().toISOString().slice(0, 10)
    return promotion.enabled !== false && code && code === coupon.trim().toUpperCase() && (!promotion.startsAt || promotion.startsAt <= now) && (!promotion.endsAt || promotion.endsAt >= now) && (!promotion.usageLimit || Number(promotion.usageCount || 0) < Number(promotion.usageLimit)) && cartSubtotal >= Number(promotion.minimumOrder || 0)
  })
  const couponDiscount = activePromotion ? Math.max(0, Math.min(cartSubtotal, activePromotion.type === 'percentage' ? Math.round(cartSubtotal * Number(activePromotion.amount) / 100) : Number(activePromotion.amount))) : 0
  const cartTotal = Math.max(0, cartSubtotal + deliveryFee - couponDiscount)

  function beginCheckout(startStep = 'review') {
    // Prefill the form with the customer's default saved address (or the most recent one),
    // falling back to the signed-in account so checkout never opens with blank required fields.
    const defaultAddress = addressBook.find((address) => address.default) || addressBook[0]
    setCheckoutForm((current) => ({
      ...current,
      name: defaultAddress?.fullName || current.name || user?.name || '',
      phone: defaultAddress?.phone || current.phone || user?.phone || '',
      township: defaultAddress?.township || current.township,
      city: defaultAddress?.region || current.city,
      shippingAddress: defaultAddress?.value || defaultAddress?.addressLine || current.shippingAddress
    }))
    setCheckoutStep(startStep)
    setError('')
    setRoute({ page: 'checkout' })
  }

  // Checkout back button: return to the cart screen, never the step-by-step form.
  function exitCheckoutToCart() {
    setError('')
    setCheckoutStep('review')
    setRoute({ page: 'main' })
    setActiveTab('cart')
  }

  async function submitAuth(event) {
    event.preventDefault()
    setError('')
    setAuthNotice('')
    const form = new FormData(event.currentTarget)
    const isSignup = authMode === 'signup'
    const password = String(form.get('password') || '')
    if (isSignup && password !== String(form.get('confirmPassword') || '')) {
      setError('Passwords do not match.')
      return
    }
    setAuthBusy(true)
    try {
      const email = String(form.get('email') || form.get('identifier') || '').trim()
      const isPasswordReset = authFlow === 'forgot'
      if (isPasswordReset) {
        await shopData.requestPasswordReset(email)
        setAuthFlow('login')
        setAuthNotice('If an account exists for that email, a password reset link has been sent.')
        return
      }
      const result = isSignup
        ? await shopData.signUp({ name: String(form.get('name') || ''), phone: String(form.get('phone') || ''), email, password })
        : await shopData.signIn({ email, password })
      const authUser = result.user
      if (!authUser) throw new Error('Check your email to confirm your account before logging in.')
      const profile = await shopData.getProfile()
      const customer = profile || { id: authUser.id, name: authUser.user_metadata?.full_name || '', email: authUser.email, phone: authUser.user_metadata?.phone || '' }
      setCartSyncReadyFor('')
      setUser({ ...customer, name: customer.full_name || customer.name })
      setRoute({ page: 'main' })
    } catch (authError) {
      setError(authError?.message || (isSignup ? 'Unable to create the account. Please try again.' : isPasswordReset ? 'Unable to send a verification code. Please try again.' : 'Unable to log in. Please try again.'))
    } finally {
      setAuthBusy(false)
    }
  }

  async function startExternalLogin(provider, link = false) {
    setError('')
    setAuthNotice('')
    if (link) setAccountLinkNotice('')
    setAuthBusy(true)
    try {
      const response = await fetch(`/api/customer/${provider}${link ? '/link' : ''}`)
      const result = await response.json()
      if (!response.ok || !result.url) throw new Error(result.error || `${provider === 'google' ? 'Google' : 'Telegram'} sign-in is not available.`)
      window.location.assign(result.url)
    } catch (authError) {
      if (link) setAccountLinkNotice(authError.message || `Unable to link ${provider}.`)
      else setError(authError.message || `${provider === 'google' ? 'Google' : 'Telegram'} sign-in failed. Please try again.`)
      setAuthBusy(false)
    }
  }

  async function verifyAuthOtp(event) {
    event.preventDefault()
    const otp = String(new FormData(event.currentTarget).get('otp') || '')
    setAuthBusy(true)
    setError('')
    setAuthNotice('')
    try {
      const response = await fetch('/api/customer/phone/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ challengeId: authChallengeId, otp }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to verify the code.')
      setCartSyncReadyFor('')
      setUser(result.customer)
      setError('')
      if (authOtpPurpose === 'reset-password') setAuthFlow('reset-password')
      else setRoute({ page: 'main' })
    } catch (authError) {
      setError(authError.message || 'Unable to verify the code.')
    } finally {
      setAuthBusy(false)
    }
  }

  async function resetCustomerPassword(event) {
    event.preventDefault()
    setAuthBusy(true)
    setError('')
    setAuthNotice('')
    try {
      const password = String(new FormData(event.currentTarget).get('password') || '')
      const response = await fetch('/api/customer/phone/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to update your password.')
      setUser(result.customer)
      setCartSyncReadyFor('')
      setRoute({ page: 'main' })
    } catch (authError) {
      setError(authError.message || 'Unable to update your password.')
    } finally {
      setAuthBusy(false)
    }
  }

  async function resendAuthOtp() {
    setAuthBusy(true)
    setError('')
    setAuthNotice('')
    try {
      const response = await fetch('/api/customer/phone/resend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ challengeId: authChallengeId }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to resend the code.')
      setAuthPhone(result.phone || authPhone)
      setAuthNotice(result.developmentOnlyCode
        ? `Local test OTP: ${result.developmentOnlyCode}. No SMS was sent.`
        : 'A verification code was sent to your phone.')
    } catch (authError) {
      setError(authError.message || 'Unable to resend the code.')
    } finally {
      setAuthBusy(false)
    }
  }

  async function requestRecoveryEmail(event) {
    event.preventDefault()
    setAuthBusy(true)
    setError('')
    setRecoveryEmailNotice('')
    try {
      const email = String(new FormData(event.currentTarget).get('recoveryEmail') || '')
      const response = await fetch('/api/customer/recovery-email/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to send a recovery email code.')
      setRecoveryEmailChallengeId(result.challengeId)
      setRecoveryEmailNotice(result.message || 'A verification code was sent to your email.')
    } catch (recoveryError) {
      setRecoveryEmailNotice(recoveryError.message || 'Unable to send a recovery email code.')
    } finally {
      setAuthBusy(false)
    }
  }

  async function verifyRecoveryEmail(event) {
    event.preventDefault()
    setAuthBusy(true)
    setRecoveryEmailNotice('')
    try {
      const otp = String(new FormData(event.currentTarget).get('recoveryOtp') || '')
      const response = await fetch('/api/customer/recovery-email/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId: recoveryEmailChallengeId, otp })
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to verify the recovery email.')
      setUser(result.customer)
      setRecoveryEmailChallengeId('')
      setRecoveryEmailNotice('Recovery email verified. You can use HTOO email-code password recovery if you lose an external sign-in.')
    } catch (recoveryError) {
      setRecoveryEmailNotice(recoveryError.message || 'Unable to verify the recovery email.')
    } finally {
      setAuthBusy(false)
    }
  }

  const authActions = {
    verifyOtp: verifyAuthOtp,
    resendOtp: resendAuthOtp
  }

  function linkExternalAccount(provider) {
    return startExternalLogin(provider, true)
  }

  function continueAsGuest() {
    try { localStorage.setItem('hto_guest_mode', 'true') } catch {}
    setGuestMode(true)
    setRoute({ page: 'main' })
  }

  function addToCart(product, quantity = 1) {
    const variants = product.selectedVariants || {}
    const availableStock = getProductStock(product, variants)
    if (!Number.isInteger(quantity) || quantity < 1 || !availableStock) {
      setError('This item is out of stock.')
      return false
    }
    const { sizes, colors } = getProductVariants(product)
    if ((sizes.length && !sizes.includes(variants.size)) || (colors.length && !colors.includes(variants.color))) {
      setError('Choose an available size and color before adding this product.')
      return false
    }
    const cartKey = `${product.id}:${variants.size || ''}:${variants.color || ''}`
    const inCart = cart.filter((item) => String(item.id) === String(product.id) &&
      (!hasVariantStock(product) || variantStockKey(item.variants) === variantStockKey(variants)))
      .reduce((sum, item) => sum + Number(item.quantity || 0), 0)
    if (inCart + quantity > availableStock) {
      setError(`Only ${availableStock} item(s) are available.`)
      return false
    }
    setError('')
    setCart((current) => {
      const existing = current.find((item) => (item.cartKey || `${item.id}:${item.variants?.size || ''}:${item.variants?.color || ''}`) === cartKey)
      if (existing) return current.map((item) => (item.cartKey || `${item.id}:${item.variants?.size || ''}:${item.variants?.color || ''}`) === cartKey ? { ...item, quantity: item.quantity + quantity } : item)
      return [...current, { id: product.id, cartKey, name: product.name, price: product.price, image: product.image, sku: product.sku, variants, quantity, selected: true }]
    })
    return true
  }

  function updateQuantity(id, amount) {
    setCart((current) => current
      .map((item) => {
        if ((item.cartKey || item.id) !== id) return item
        const product = products.find((candidate) => String(candidate.id) === String(item.id))
        const stock = product ? getProductStock(product, item.variants) : item.quantity
        return { ...item, quantity: Math.max(1, Math.min(stock || 1, item.quantity + amount)) }
      })
      .filter((item) => item.quantity > 0))
  }

  function removeFromCart(id) {
    setCart((current) => current.filter((item) => (item.cartKey || item.id) !== id))
  }

  function toggleWishlist(productId) {
    setWishlist((current) => current.includes(productId) ? current.filter((id) => id !== productId) : [...current, productId])
  }

  function saveSearch() {
    if (!searchQuery.trim()) return
    setRecentSearches((current) => [searchQuery.trim(), ...current.filter((item) => item !== searchQuery.trim())].slice(0, 5))
  }

  function moveWishlistItemToCart(productId) {
    const product = products.find((item) => item.id === productId)
    if (!product || !addToCart(product)) return false
    setWishlist((current) => current.filter((id) => id !== productId))
    return true
  }

  function addAddress(address) {
    setAddressBook((current) => {
      const next = current.map((item) => ({ ...item, default: address.default ? false : item.default }))
      const id = globalThis.crypto?.randomUUID?.() || `address-${Date.now()}-${Math.random().toString(36).slice(2)}`
      return [...next, { ...address, id }]
    })
  }

  function updateAddress(addressId, patch) {
    setAddressBook((current) => current.map((item) => {
      if (item.id !== addressId) return patch.default ? { ...item, default: false } : item
      return { ...item, ...patch }
    }))
  }

  function removeAddress(addressId) {
    setAddressBook((current) => {
      const next = current.filter((item) => item.id !== addressId)
      if (!next.some((item) => item.default) && next.length) next[0] = { ...next[0], default: true }
      return next
    })
  }

  async function updateProfile(profile) {
    const customer = await shopData.updateProfile(profile)
    const updated = { ...customer, name: customer.full_name }
    setUser(updated)
    return updated
  }

  function validateCheckoutStep(step) {
    const checkoutCart = cart
    if (!checkoutCart.length) return 'Your cart is empty.'
    if (step === 1) {
      if (!checkoutForm.name.trim()) return 'Enter your full name.'
      if (!checkoutForm.phone.trim()) return 'Enter your phone number.'
      if (!/^(?:\+?95|0)\d{7,13}$/.test(checkoutForm.phone.replace(/[\s()-]/g, ''))) return 'Enter a valid phone number.'
      if (!checkoutForm.shippingAddress.trim()) return 'Enter your complete delivery address.'
    }
    if (step === 2 && !selectedPaymentAccount) return 'No active payment account is available. Please contact the shop.'
    if (step === 3 && !isCashPayment && !paymentSlip) return 'Upload your payment slip to continue.'
    if (step >= 4) {
      if (!Number.isFinite(cartTotal) || cartTotal <= 0) return 'Check your cart and order total before continuing.'
      const unavailable = checkoutCart.find((item) => {
        const product = products.find((candidate) => String(candidate.id) === String(item.id))
        if (!product || product.enabled === false || !Number.isInteger(item.quantity) || item.quantity < 1 ||
          item.quantity > getProductStock(product, item.variants)) return true
        const { sizes, colors } = getProductVariants(product)
        return (sizes.length > 0 && !sizes.includes(item.variants?.size)) ||
          (colors.length > 0 && !colors.includes(item.variants?.color))
      })
      if (unavailable) return `${unavailable.name} is no longer available in the selected quantity.`
    }
    return ''
  }

  function handlePaymentSlip(event) {
    const file = event.target.files?.[0]
    if (!file) return
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError('Choose a JPG, PNG, or WebP payment slip no larger than 5 MB.')
      event.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = () => { setPaymentSlip(String(reader.result || '')); setError('') }
    reader.onerror = () => setError('Unable to read that image. Please choose another file.')
    reader.readAsDataURL(file)
  }

  async function placeOrder() {
    console.info('[checkout] Place order requested', {
      itemCount: cart.length,
      paymentAccountId: selectedPaymentAccount?.id || null,
      hasPaymentSlip: Boolean(paymentSlip)
    })
    try {
      const validationMessage = [1, 2, 3, 4].map(validateCheckoutStep).find(Boolean)
      if (validationMessage) {
        console.warn('[checkout] Validation failed', validationMessage)
        setError(validationMessage)
        return
      }
      if (!selectedPaymentAccount || (!isCashPayment && !paymentSlip)) {
        const message = 'Select an active payment method and upload the payment slip.'
        console.warn('[checkout] Payment validation failed')
        setError(message)
        return
      }

      const checkoutCart = cart
      if (!checkoutCart.length) {
        setError('Your cart is empty.')
        return
      }
      // Saving the account cart must finish before the order is sent, otherwise the server
      // still has an older cart and rejects the order as "changed".
      if (user?.id) {
        try {
          await (cartSyncRef.current || syncCartToAccount(checkoutCart))
        } catch (syncError) {
          setError(syncError.message || 'Unable to sync your cart with your account. Please try again.')
          return
        }
      }
      const orderItems = buildCartPayload(checkoutCart)
      if (!orderItems.length) {
        setError('Your cart is empty.')
        return
      }
      const order = {
        customer: {
          userId: user?.id || null,
          name: checkoutForm.name,
          phone: checkoutForm.phone,
          email: String(user?.email || checkoutForm.email || '').trim(),
          township: checkoutForm.township,
          city: checkoutForm.city,
          address: checkoutForm.shippingAddress
        },
        items: orderItems,
        subtotal: cartSubtotal,
        deliveryFee,
        discount: couponDiscount,
        couponCode: activePromotion ? String(activePromotion.code || activePromotion.name) : '',
        deliveryMethod: checkoutForm.deliveryMethod,
        paymentAccountId: selectedPaymentAccount.id,
        receipt: paymentSlip ? { dataUrl: paymentSlip } : null
      }
      // Lines already represented in this order must not be retried if the response was
      // lost, so drop the cart before every attempt and restore it when the server says no.
      const orderedCart = checkoutCart
      const orderedLineKeys = new Set(orderItems.map(cartLineKey))
      const dropOrderedLines = (items) => items.filter((item) => !orderedLineKeys.has(cartLineKey(item)))
      if (user?.id) setCart((current) => dropOrderedLines(current))

      console.info('[checkout] Sending order request', {
        method: 'POST',
        url: '/api/orders',
        itemCount: order.items.length,
        paymentAccountId: order.paymentAccountId,
        hasPaymentSlip: Boolean(order.receipt)
      })
      const orderRequestKey = getOrderRequestKey()
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': orderRequestKey,
          ...(!user?.id ? { 'X-Guest-Order-Key': getGuestOrderAccessKey() } : {})
        },
        body: JSON.stringify(order)
      })
      let result
      try {
        result = await response.json()
      } catch (responseError) {
        console.error('[checkout] Could not read order API response', {
          status: response.status,
          error: responseError
        })
        // The network layer refused or dropped the request, so it was never processed:
        // put the cart back and allow a clean retry with a fresh request key.
        if (!response.status) {
          clearOrderRequestKey()
          setCart((current) => mergeCartLines(current, orderedCart))
        }
        setError('Unable to confirm your order. Please check My Orders before trying again.')
        return
      }
      console.info('[checkout] Order API response received', {
        status: response.status,
        ok: response.ok,
        orderId: result.order?.id || null
      })
      if (!response.ok) {
        if (response.status >= 400 && response.status < 500) clearOrderRequestKey()
        console.error('[checkout] Order API rejected the request', {
          status: response.status,
          error: result.error || 'Unable to place order.'
        })
        setCart((current) => mergeCartLines(current, orderedCart))
        setError(result.error || 'Unable to place order. Please check your details and try again.')
        return
      }
      if (!result.ok || !result.order?.id) {
        console.error('[checkout] Order API returned an incomplete success response')
        setCart((current) => mergeCartLines(current, orderedCart))
        setError('Unable to confirm your order. Please check My Orders before trying again.')
        return
      }

      const savedOrder = result.order
      clearOrderRequestKey()
      console.info('[checkout] Order saved; clearing cart and opening confirmation', {
        orderId: savedOrder.id
      })
      setOrders((current) => [savedOrder, ...current])
      setSelectedOrder(savedOrder)
      // The server has already consumed the ordered lines; mirror exactly what is left.
      setCart((current) => mergeCartLines(current, remainingCartFor(savedOrder, orderedCart, checkoutCart)))
      setPaymentSlip('')
      setCoupon('')
      try { localStorage.removeItem('hto_checkout_draft') } catch (storageError) { console.warn('[checkout] Could not clear checkout draft.', storageError) }
      if (checkoutForm.saveAddress && checkoutForm.shippingAddress) {
        addAddress({
          label: 'Home',
          fullName: checkoutForm.name || user?.name || '',
          phone: checkoutForm.phone || user?.phone || '',
          region: checkoutForm.city || '',
          township: checkoutForm.township || '',
          addressLine: checkoutForm.shippingAddress,
          value: [checkoutForm.shippingAddress, checkoutForm.township, checkoutForm.city].filter(Boolean).join(', '),
          default: addressBook.length === 0
        })
      }
      setError('')
      setRoute({ page: 'confirmation' })
      return savedOrder
    } catch (submitError) {
      console.error('[checkout] Unexpected error while placing order', submitError)
      const detail = submitError?.message || String(submitError)
      setError(import.meta.env.DEV
        ? `Unable to place order: ${detail}`
        : 'Unable to place order. Please check your payment slip and try again.')
      return null
    }
  }

  function logout() {
    void shopData.signOut().catch((logoutError) => console.warn('[auth] Sign-out failed.', logoutError))
    try { localStorage.removeItem('hto_guest_mode') } catch {}
    setCartSyncReadyFor('')
    setUser(null)
    setGuestMode(false)
    setAuthFlow('login')
    setAuthMode('signin')
    setRoute({ page: 'auth' })
  }

  async function deleteAccount() {
    const response = await fetch('/api/customer/account', { method: 'DELETE' })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Unable to delete your account.')
    if (user?.id) {
      saveCart(user.id, [])
      saveWishlist(user.id, [])
    }
    setCart([])
    setWishlist([])
    setAddressBook([])
    setOrders([])
    setUser(null)
    setGuestMode(false)
    setCartSyncReadyFor('')
    setRoute({ page: 'auth' })
    try {
      localStorage.removeItem('hto_checkout_draft')
      const books = JSON.parse(localStorage.getItem('hto_customer_addresses') || '{}')
      delete books[user?.id || 'guest']
      localStorage.setItem('hto_customer_addresses', JSON.stringify(books))
      localStorage.removeItem(GUEST_CART_KEY)
      localStorage.removeItem(GUEST_WISHLIST_KEY)
    } catch (storageError) {
      console.warn('[account] Could not clear local customer data after account deletion.', storageError)
    }
  }

  const sharedProps = {
    route,
    setRoute,
    authMode,
    setAuthMode,
    authFlow,
    setAuthFlow,
    authOtpPurpose,
    authPhone,
    setAuthPhone,
    authActions,
    accountLinkNotice,
    linkGoogle: () => linkExternalAccount('google'),
    linkTelegram: () => linkExternalAccount('telegram'),
    authBusy,
    authNotice,
    recoveryEmailChallengeId,
    recoveryEmailNotice,
    requestRecoveryEmail,
    verifyRecoveryEmail,
    user,
    storefrontBanners,
    storefrontSections,
    storefrontLayout,
    supportChannels,
    supportChannelsLoading,
    supportChannelsError,
    loadSupportChannels,
    storefrontNotifications,
    language,
    setLanguage: changeCustomerLanguage,
    guestMode,
    products,
    catalogStatus,
    cart,
    wishlist,
    activeTab,
    setActiveTab,
    selectedCategory,
    setSelectedCategory,
    searchQuery,
    setSearchQuery,
    recentSearches,
    setRecentSearches,
    sortBy,
    setSortBy,
    filters,
    setFilters,
    coupon,
    setCoupon,
    checkoutStep,
    setCheckoutStep,
    addressBook,
    paymentMethods,
    promotions,
    paymentSlip,
    setPaymentSlip,
    orders,
    selectedOrder,
    setSelectedOrder,
    error,
    setError,
    settings,
    checkoutForm,
    setCheckoutForm,
    allBrands,
    filteredProducts,
    wishlistProducts,
    cartSubtotal,
    deliveryFee,
    selectedPaymentAccount,
    isCashPayment,
    activePromotion,
    couponDiscount,
    cartTotal,
    beginCheckout,
    exitCheckoutToCart,
    submitAuth,
    resetCustomerPassword,
    continueAsGuest,
    addToCart,
    updateQuantity,
    removeFromCart,
    toggleWishlist,
    saveSearch,
    moveWishlistItemToCart,
    addAddress,
    updateAddress,
    removeAddress,
    deleteAccount,
    updateProfile,
    validateCheckoutStep,
    handlePaymentSlip,
    placeOrder,
    logout,
    MAIN_TABS,
    CATEGORY_TREE,
    DELIVERY_METHODS,
    formatPrice
  }

  return (
    <>
      <div className="desktop-view">
        <DesktopApp {...sharedProps} />
      </div>
      <div className="mobile-view">
        <MobileApp {...sharedProps} />
      </div>
    </>
  )
}
