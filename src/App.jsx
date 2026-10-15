import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { getCart, mergeCart, mergeWishlist, saveCart, saveWishlist } from './lib/storage'
import { useLanguage } from './lib/i18n'
import { getProductStock, getProductVariants, hasVariantStock, variantStockKey } from './lib/productVariants'
import DesktopApp from './DesktopApp'
import MobileApp from './MobileApp'
import { adminStore } from './admin/adminStore'

const GUEST_CART_KEY = 'atelier_guest_cart'
const GUEST_WISHLIST_KEY = 'atelier_guest_wishlist'
const GUEST_ORDER_ACCESS_KEY = 'hto_guest_order_access_key'
const ORDER_REQUEST_KEY = 'hto_order_request_key'
const ONBOARDING_KEY = 'shop_onboarding_seen'
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
  const [route, setRoute] = useState(() => {
    try {
      if (localStorage.getItem('hto_guest_mode') === 'true') return { page: 'main' }
      return { page: localStorage.getItem(ONBOARDING_KEY) ? 'auth' : 'launch' }
    } catch {
      return { page: 'launch' }
    }
  })
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
  const [wishlist, setWishlist] = useState([])
  const [activeTab, setActiveTab] = useState('home')
  const [storefrontBanners, setStorefrontBanners] = useState(() => adminStore.getBanners())
  const [storefrontSections, setStorefrontSections] = useState(() => adminStore.getHomeSections())
  const [storefrontLayout, setStorefrontLayout] = useState(() => adminStore.getHomeLayout())
  const [supportChannels, setSupportChannels] = useState(() => adminStore.getSupportChannels())
  const [storefrontNotifications, setStorefrontNotifications] = useState(() => adminStore.getNotifications())
  const [selectedCategory, setSelectedCategory] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [recentSearches, setRecentSearches] = useState([])
  const [sortBy, setSortBy] = useState('popular')
  const [filters, setFilters] = useState(initialFilters)
  const [coupon, setCoupon] = useState('')
  const [checkoutStep, setCheckoutStep] = useState(1)
  const [addressBook, setAddressBook] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('hto_customer_addresses') || '{}')
      return Array.isArray(stored.guest) ? stored.guest : []
    } catch {
      return []
    }
  })
  const [paymentMethods, setPaymentMethods] = useState([])
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
      setSupportChannels(adminStore.getSupportChannels())
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
        if (Number.isInteger(saved.step) && saved.step >= 1 && saved.step <= 5) setCheckoutStep(saved.step)
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

    fetch('/api/customer/session')
      .then((res) => res.ok ? res.json() : Promise.reject(new Error('session')))
      .then(async (data) => {
        if (data.customer) {
          setUser(data.customer)
          setRoute({ page: 'main' })
          if (telegramInitData) {
            try { await linkTelegramAccount() } catch (linkError) { setError(linkError.message) }
          }
          return
        }
        if (telegramInitData) {
          const response = await fetch('/api/telegram/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData: telegramInitData })
          })
          const result = await response.json()
          if (!response.ok) throw new Error(result.error || 'Unable to authenticate your Telegram account.')
          setUser(result.customer)
          setRoute({ page: 'main' })
        }
      })
      .catch((sessionError) => { if (telegramInitData) setError(sessionError.message || 'Unable to authenticate your Telegram account.') })

    fetch('/api/products')
      .then((res) => res.ok ? res.json() : Promise.reject(new Error('products')))
      .then((data) => {
        if (Array.isArray(data.products) && data.products.length) {
          setProducts(data.products.map(mapApiProduct))
        }
        setCatalogStatus('ready')
      })
      .catch((catalogError) => {
        console.error('[catalog] Unable to load products.', catalogError)
        setCatalogStatus('error')
      })

    fetch('/api/settings')
      .then((res) => res.ok ? res.json() : Promise.reject(new Error('settings')))
      .then((data) => {
        if (data.settings) setSettings(data.settings)
      })
      .catch(() => {})

    fetch('/api/payments')
      .then((res) => res.ok ? res.json() : Promise.reject(new Error('payments')))
      .then((data) => {
        if (Array.isArray(data.payments)) setPaymentMethods(data.payments)
      })
      .catch(() => {})

    fetch('/api/promotions')
      .then((res) => res.ok ? res.json() : Promise.reject(new Error('promotions')))
      .then((data) => {
        if (Array.isArray(data.promotions)) setPromotions(data.promotions)
      })
      .catch(() => {})

    fetch('/api/banners')
      .then((res) => res.ok ? res.json() : Promise.reject(new Error('banners')))
      .then((data) => {
        if (Array.isArray(data.banners) && data.banners.length) {
          setStorefrontBanners(data.banners)
          adminStore.saveBanners(data.banners)
        }
      })
      .catch(() => {})

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
    Promise.all([
      fetch('/api/payments').then((response) => response.ok ? response.json() : Promise.reject(new Error('Unable to load payment accounts.'))),
      fetch('/api/promotions').then((response) => response.ok ? response.json() : Promise.reject(new Error('Unable to load promotions.')))
    ]).then(([paymentData, promotionData]) => {
      if (!active) return
      const available = Array.isArray(paymentData.payments) ? paymentData.payments : []
      setPaymentMethods(available)
      setPromotions(Array.isArray(promotionData.promotions) ? promotionData.promotions : [])
    }).catch((loadError) => {
      if (active) setError(loadError.message)
    })
    return () => { active = false }
  }, [route.page])

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

  useEffect(() => {
    if (!user?.id || cartSyncReadyFor !== user.id) return
    const timer = window.setTimeout(() => {
      fetch('/api/customer/cart', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cart.map((item) => ({ id: item.id, quantity: item.quantity, variants: item.variants || {}, selected: item.selected !== false })) })
      })
        .then(async (response) => {
          const result = await response.json()
          if (!response.ok) throw new Error(result.error || 'Unable to sync your cart.')
          writeGuestList(GUEST_CART_KEY, [])
        })
        .catch((syncError) => setError(syncError.message || 'Unable to sync your cart with your account.'))
    }, 250)
    return () => window.clearTimeout(timer)
  }, [cart, cartSyncReadyFor, user?.id])

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
    if (item.selected === false) return sum
    const quantity = Number.isSafeInteger(item.quantity) && item.quantity > 0 ? item.quantity : 0
    const product = products.find((candidate) => String(candidate.id) === String(item.id))
    const price = Number(product?.discountPrice ?? product?.price ?? item.price)
    return sum + Math.max(0, Number.isFinite(price) ? price : 0) * quantity
  }, 0), [cart, products])
  const deliveryFee = checkoutForm.deliveryMethod === 'cargate' ? Math.max(0, Number(settings.carGatePickupFee) || 0) : 0
  const selectedPaymentAccount = paymentMethods.find((payment) => payment.id === checkoutForm.paymentAccountId) || paymentMethods[0] || null
  const isCashPayment = selectedPaymentAccount?.type === 'cash' || selectedPaymentAccount?.id === 'cod'
  const activePromotion = promotions.find((promotion) => {
    const code = String(promotion.code || promotion.name || '').trim().toUpperCase()
    const now = new Date().toISOString().slice(0, 10)
    return promotion.enabled !== false && code && code === coupon.trim().toUpperCase() && (!promotion.startsAt || promotion.startsAt <= now) && (!promotion.endsAt || promotion.endsAt >= now) && (!promotion.usageLimit || Number(promotion.usageCount || 0) < Number(promotion.usageLimit)) && cartSubtotal >= Number(promotion.minimumOrder || 0)
  })
  const couponDiscount = activePromotion ? Math.max(0, Math.min(cartSubtotal, activePromotion.type === 'percentage' ? Math.round(cartSubtotal * Number(activePromotion.amount) / 100) : Number(activePromotion.amount))) : 0
  const cartTotal = Math.max(0, cartSubtotal + deliveryFee - couponDiscount)

  function startApp() {
    localStorage.setItem(ONBOARDING_KEY, '1')
    setRoute({ page: 'auth' })
  }

  function beginCheckout() {
    setCheckoutStep(1)
    setError('')
    setRoute({ page: 'checkout' })
  }

  async function submitAuth(event) {
    event.preventDefault()
    setError('')
    setAuthNotice('')
    setAuthBusy(true)
    const form = new FormData(event.currentTarget)
    try {
      const phone = String(form.get('phone') || '')
      const isSignup = authMode === 'signup'
      const isPasswordReset = authFlow === 'forgot'
      const password = String(form.get('password') || '')
      const response = await fetch(isSignup || isPasswordReset ? '/api/customer/phone/request' : '/api/customer/phone/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isSignup
          ? { phone, mode: 'signup', name: String(form.get('name') || ''), password }
          : isPasswordReset
            ? { phone, mode: 'reset-password' }
            : { phone, password })
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || (isSignup || isPasswordReset ? 'Unable to send a verification code.' : 'Unable to log in.'))
      setAuthPhone(phone)
      if (!isSignup && !isPasswordReset) {
        setCartSyncReadyFor('')
        setUser(result.customer)
        setRoute({ page: 'main' })
        return
      }
      setAuthOtpPurpose(isSignup ? 'signup' : 'reset-password')
      setAuthChallengeId(result.challengeId)
      setAuthFlow('otp')
      setError('')
      setAuthNotice(result.developmentOnlyCode
        ? `Local test OTP: ${result.developmentOnlyCode}. No SMS was sent.`
        : 'A verification code was sent to your phone.')
    } catch (authError) {
      setError(authError.message || 'Unable to send a verification code. Please try again.')
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

  function updateCartItem(id, changes) {
    setCart((current) => current.map((item) => (item.cartKey || item.id) === id ? { ...item, ...changes } : item))
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
    const response = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile)
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Unable to update your profile.')
    setUser(result.customer)
    return result.customer
  }

  function validateCheckoutStep(step) {
    const selectedCart = cart.filter((item) => item.selected !== false)
    if (!selectedCart.length) return 'Select at least one item to continue.'
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
      const unavailable = selectedCart.find((item) => {
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

      const selectedCart = cart.filter((item) => item.selected !== false)
      if (!selectedCart.length) {
        setError('Select at least one item to place your order.')
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
        items: selectedCart.map((item) => {
          const product = products.find((candidate) => String(candidate.id) === String(item.id))
          const variants = { ...item.variants }
          if (!product?.availableVariants?.sizes?.length) delete variants.size
          if (!product?.availableVariants?.colors?.length) delete variants.color
          return { ...item, selected: true, variants, productId: item.id }
        }),
        subtotal: cartSubtotal,
        deliveryFee,
        discount: couponDiscount,
        couponCode: activePromotion ? String(activePromotion.code || activePromotion.name) : '',
        deliveryMethod: checkoutForm.deliveryMethod,
        paymentAccountId: selectedPaymentAccount.id,
        receipt: paymentSlip ? { dataUrl: paymentSlip } : null
      }

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
        if (!response.ok) clearOrderRequestKey()
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
        setError(result.error || 'Unable to place order. Please check your details and try again.')
        return
      }
      if (!result.ok || !result.order?.id) {
        console.error('[checkout] Order API returned an incomplete success response')
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
      setCart((current) => current.filter((item) => item.selected === false))
      setPaymentSlip('')
      setCoupon('')
      try { localStorage.removeItem('hto_checkout_draft') } catch (storageError) { console.warn('[checkout] Could not clear checkout draft.', storageError) }
      if (checkoutForm.saveAddress && checkoutForm.shippingAddress) {
        addAddress({ label: 'Home', value: checkoutForm.shippingAddress, default: addressBook.length === 0 })
      }
      setError('')
      setRoute({ page: 'confirmation' })
    } catch (submitError) {
      console.error('[checkout] Unexpected error while placing order', submitError)
      const detail = submitError?.message || String(submitError)
      setError(import.meta.env.DEV
        ? `Unable to place order: ${detail}`
        : 'Unable to place order. Please check your payment slip and try again.')
    }
  }

  function logout() {
    fetch('/api/customer/logout', { method: 'POST' }).catch(() => {})
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
    startApp,
    beginCheckout,
    submitAuth,
    resetCustomerPassword,
    continueAsGuest,
    addToCart,
    updateQuantity,
    updateCartItem,
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
    formatPrice,
    ONBOARDING_KEY
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
