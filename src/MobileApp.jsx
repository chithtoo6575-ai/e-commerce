import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import './Mobile.css'
import BuyerAuth from './BuyerAuth'
import { t } from './lib/i18n'
import { AddToCartButton, CartIcon } from './CartControls'
import { getProductStock, getProductVariants, hasVariantStock, variantStockKey } from './lib/productVariants'
import SupportChannelList from './SupportChannelList'

const STORE_LOGO_URL = `${import.meta.env.BASE_URL}logo.svg`
// Header mark: white letterform only (no cart glyph, no shadow).
const HEADER_LOGO_URL = `${import.meta.env.BASE_URL}logo-white.svg`

function hasValidCartVariants(item, product) {
  const { sizes, colors } = getProductVariants(product)
  const selectedSize = item.variants?.size
  const selectedColor = item.variants?.color
  return (sizes.length ? sizes.includes(selectedSize) : !selectedSize) &&
    (colors.length ? colors.includes(selectedColor) : !selectedColor)
}

function getCartItemIssue(item, product) {
  if (!product || Number(product.stock) <= 0) return 'This product is no longer available.'
  if (getProductStock(product, item.variants) < item.quantity) return 'Insufficient stock for this size or color. Reduce the quantity or remove this item.'
  if (!hasValidCartVariants(item, product)) return 'A selected size or color is no longer available.'
  return ''
}

/* Myanmar region/state → townships used by the Add New Address form */
const MYANMAR_REGIONS = {
  'Yangon Region': ['Yangon', 'Mandalay', 'Lashio', 'Taunggyi', 'Mawlamyine', 'Bago', 'Magway', 'Pyay', 'Myitkyina', 'Sagaing'],
  'Mandalay Region': ['Mandalay', 'Pyin Oo Lwin', 'Kyaukse', 'Meiktila', 'Yamethin', 'Myingyan', 'Nyaung-U'],
  'Naypyidaw Union Territory': ['Zabuthiri', 'Ottarathiri', 'Dekkhinathiri', 'Pobbathiri', 'Tatkon'],
  'Ayeyarwady Region': ['Pathein', 'Hinthada', 'Maubin', 'Myaungmya', 'Bogale', 'Labutta', 'Pyapon'],
  'Bago Region': ['Bago', 'Taungoo', 'Pyay', 'Tharrawaddy', 'Nattalin', 'Shwegyin'],
  'Magway Region': ['Magway', 'Minbu', 'Pakokku', 'Thayet', 'Gangaw', 'Yenangyaung'],
  'Sagaing Region': ['Sagaing', 'Monywa', 'Shwebo', 'Katha', 'Kale', 'Tamu', 'Hkamti'],
  'Tanintharyi Region': ['Dawei', 'Myeik', 'Kawthaung', 'Bokpyin', 'Thayetchaung'],
  'Kachin State': ['Myitkyina', 'Bhamo', 'Putao', 'Hpakant', 'Mohnyin'],
  'Kayah State': ['Loikaw', 'Demoso', 'Hpasawng', 'Bawlake', 'Mese'],
  'Kayin State': ['Hpa-An', 'Myawaddy', 'Kawkareik', 'Hlaingbwe', 'Thandaunggyi'],
  'Chin State': ['Hakha', 'Falam', 'Mindat', 'Palan', 'Tonzang', 'Tiddim'],
  'Mon State': ['Mawlamyine', 'Thaton', 'Ye', 'Mudon', 'Paung'],
  'Rakhine State': ['Sittwe', 'Kyaukpyu', 'Thandwe', 'Mrauk U', 'Maungdaw'],
  'Shan State': ['Taunggyi', 'Lashio', 'Kengtung', 'Muse', 'Tachileik', 'Nyaungshwe', 'Hsipaw'],
  'Magway': ['Magway', 'Minbu', 'Pakokku', 'Thayet'],
  'Tachileik': ['Tachileik', 'Kengtung', 'Monghsat']
}

const MYANMAR_REGIONS_MY = {
  'Yangon Region': 'ရန်ကုန်တိုင်းဒေသကြီး',
  'Mandalay Region': 'မန္တလေးတိုင်းဒေသကြီး',
  'Naypyidaw Union Territory': 'နေပြည်တော် ပြည်ထောင်စုနယ်မြေ',
  'Ayeyarwady Region': 'ဧရာဝတီတိုင်းဒေသကြီး',
  'Bago Region': 'ပဲခူးတိုင်းဒေသကြီး',
  'Magway Region': 'မကွေးတိုင်းဒေသကြီး',
  'Sagaing Region': 'စစ်ကိုင်းတိုင်းဒေသကြီး',
  'Tanintharyi Region': 'တနင်္သာရီတိုင်းဒေသကြီး',
  'Kachin State': 'ကချင်ပြည်နယ်',
  'Kayah State': 'ကယားပြည်နယ်',
  'Kayin State': 'ကရင်ပြည်နယ်',
  'Chin State': 'ချင်းပြည်နယ်',
  'Mon State': 'မွန်ပြည်နယ်',
  'Rakhine State': 'ရခိုင်ပြည်နယ်',
  'Shan State': 'ရှမ်းပြည်နယ်'
}

const MYANMAR_TOWNSHIP_MY = {
  'Yangon': 'ရန်ကုန်', 'Mandalay': 'မန္တလေး', 'Lashio': 'လားရှိုး', 'Taunggyi': 'တောင်ကြီး',
  'Mawlamyine': 'မော်လမြိုင်', 'Bago': 'ပဲခူး', 'Magway': 'မကွေး', 'Pyay': 'ပြည်',
  'Myitkyina': 'မြစ်ကြီးနား', 'Sagaing': 'စစ်ကိုင်း', 'Pyin Oo Lwin': 'ပြင်ဦးလွင်',
  'Kyaukse': 'ကျောက်ဆည်', 'Meiktila': 'မိတ္ထီလာ', 'Yamethin': 'ရမည်းသင်း',
  'Myingyan': 'မြင်းခြံ', 'Nyaung-U': 'ညောင်ဦး', 'Pathein': 'ပုသိမ်', 'Hinthada': 'ဟင်္သာတ',
  'Maubin': 'မော်လမြိုင်', 'Myaungmya': 'မြောင်းမြ', 'Bogale': 'ဘိုကလေး', 'Labutta': 'လပွတ္တာ',
  'Pyapon': 'ဖျာပုံ', 'Taungoo': 'တောင်ငူ', 'Tharrawaddy': 'သာယာဝတီ', 'Nattalin': 'နတ္တလင်း',
  'Shwegyin': 'ရွှေကျင်', 'Minbu': 'မင်းဘူး', 'Pakokku': 'ပခုက္ကူ', 'Thayet': 'သရက်',
  'Gangaw': 'ဂန်ဂေါ', 'Yenangyaung': 'ရေနံချောင်း', 'Monywa': 'မုံရွာ', 'Shwebo': 'ရွှေဘို',
  'Katha': 'ကသာ', 'Kale': 'ကလေး', 'Tamu': 'တမူး', 'Hkamti': 'ခန္တီး', 'Dawei': 'ထားဝယ်',
  'Myeik': 'မြိတ်', 'Kawthaung': 'ကော့သောင်း', 'Bokpyin': 'ဘုတ်ပြင်း', 'Thayetchaung': 'သရက်ချောင်း',
  'Bhamo': 'ဗန်းမော်', 'Putao': 'ပူတာအို', 'Hpakant': 'ဖားကန့်', 'Mohnyin': 'မိုးကောင်း',
  'Loikaw': 'လွိုင်ကော်', 'Demoso': 'ဒီမောဆို', 'Hpasawng': 'ဖားဆောင်း', 'Bawlake': 'ဘောလခဲ',
  'Mese': 'မယ်စဲ့', 'Hpa-An': 'ဘားအံ', 'Myawaddy': 'မြဝတီ', 'Kawkareik': 'ကော့ကရိတ်',
  'Hlaingbwe': 'လှိုင်းဘွဲ့', 'Thandaunggyi': 'သံတောင်ကြီး', 'Hakha': 'ဟားခါး', 'Falam': 'ဖလမ်း',
  'Mindat': 'မင်းတပ်', 'Palan': 'ပင်လုံ', 'Tonzang': 'တွန်းဇံ', 'Tiddim': 'တီးတိန်', 'Thaton': 'သထုံ',
  'Ye': 'ရေး', 'Mudon': 'မုဒုံ', 'Paung': 'ပေါင်', 'Sittwe': 'စစ်တွေ', 'Kyaukpyu': 'ကျောက်ဖြူ',
  'Thandwe': 'သံတွဲ', 'Mrauk U': 'မြောက်ဦး', 'Maungdaw': 'မောင်တော', 'Kengtung': 'ကျိုင်းတုံ',
  'Muse': 'မူဆယ်', 'Tachileik': 'တာချီလိတ်', 'Nyaungshwe': 'ညောင်ရွှေ', 'Hsipaw': 'သီပေါ',
  'Zabuthiri': 'ဇမ္ဗူသီရိ', 'Ottarathiri': 'ဥတ္တရသီရိ', 'Dekkhinathiri': 'ဒက္ခိဏသီရိ',
  'Pobbathiri': 'ပုဗ္ဗသီရိ', 'Tatkon': 'တပ်ကုန်း', 'Monghsat': 'မိုင်းဆတ်'
}

/* Checkout review screen: payment choices shown as radio cards */
const CHECKOUT_PAYMENT_KINDS = [
  {
    id: 'cod',
    titleKey: 'Cash on Delivery (COD)',
    subtitleKey: 'Pay cash when the item arrives',
    svg: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 12h.01M18 12h.01" /></svg>
  },
  {
    id: 'wallet',
    titleKey: 'Mobile Wallet',
    subtitleKey: 'KBZPay / WavePay / CB Pay and more',
    svg: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="2.5" /><path d="M11 18h2" /></svg>
  },
  {
    id: 'bank',
    titleKey: 'Bank Transfer',
    subtitleKey: 'Transfer directly to the shop bank account',
    svg: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3 10 9-6 9 6" /><path d="M5 10v9h14v-9" /><path d="M9 19v-5h6v5" /><path d="m2 21h20" /></svg>
  }
]

function getPaymentKind(payment) {
  if (!payment) return 'wallet'
  // Explicit cash/bank flags win, so a shop-configured "kind" can never make a
  // COD account ask for a payment slip (or a transfer account skip it).
  if (payment.type === 'cash' || payment.id === 'cod') return 'cod'
  if (payment.kind) return payment.kind
  const hint = `${payment.type || ''} ${payment.name || ''} ${payment.nameMyanmar || ''} ${payment.id || ''}`.toLowerCase()
  if (hint.includes('cod') || hint.includes('cash')) return 'cod'
  if (hint.includes('bank') || hint.includes('transfer') || hint.includes('ဘန်')) return 'bank'
  return 'wallet'
}

function createEmptyAddressForm() {
  return { fullName: '', phone: '', region: '', township: '', addressLine: '', mapLocation: '', isDefault: false }
}

function isPhoneNumber(value) {
  const digits = String(value || '').replace(/[^0-9]/g, '')
  return digits.length >= 7 && digits.length <= 15
}



export default function MobileApp({
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
  linkGoogle,
  linkTelegram,
  recoveryEmailChallengeId,
  recoveryEmailNotice,
  requestRecoveryEmail,
  verifyRecoveryEmail,
  authBusy,
  authNotice,
  resetCustomerPassword,
  user,
  storefrontBanners = [],
  storefrontSections = [],
  storefrontLayout = [],
  supportChannels = [],
  supportChannelsLoading = false,
  supportChannelsError = '',
  loadSupportChannels,
  storefrontNotifications = [],
  language,
  setLanguage,
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
  recentSearches: _recentSearches,
  setRecentSearches: _setRecentSearches,
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
  _filteredProducts,
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
  exitCheckoutToCart,
  submitAuth,
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
  CATEGORY_TREE: _CATEGORY_TREE,
  DELIVERY_METHODS,
  formatPrice,
  ONBOARDING_KEY
}) {
  // Mobile UI States
  const deepLinkedProductId = new URLSearchParams(window.location.search).get('product')
  const currentTab = deepLinkedProductId ? 'explore' : activeTab === 'categories' || activeTab === 'search' ? 'explore' : activeTab
  const tr = (text) => t(text, language)
  const [selectedMobileCategory, setSelectedMobileCategory] = useState(selectedCategory || 'All')
  const [selectedProduct, setSelectedProduct] = useState(null)
  const viewingProduct = selectedProduct || products.find((product) => String(product.id) === deepLinkedProductId) || null
  const storefrontError = error || (deepLinkedProductId && catalogStatus !== 'loading' && !viewingProduct ? t('This product is no longer available.', language) : '')
  const setViewingProduct = (product) => setSelectedProduct(product)
  const [toastMessage, setToastMessage] = useState('')
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [activeAccountModal, setActiveAccountModal] = useState(null)
  // Screen-reader announcement after a support channel is opened.
  const [supportNotice, setSupportNotice] = useState('')
  const [activeBannerIndex, setActiveBannerIndex] = useState(0)
  const bannerTrackRef = useRef(null)
  const bannerResumeTimeoutRef = useRef(null)
  const [bannerAutoplayPaused, setBannerAutoplayPaused] = useState(false)
  const [isMobileViewport, setIsMobileViewport] = useState(() => window.matchMedia?.('(max-width: 767px)')?.matches ?? true)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false)
  const [copiedText, setCopiedText] = useState(false)
  const [orderChatData, setOrderChatData] = useState(null)
  const [chatDraft, setChatDraft] = useState('')
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false)
  const [addressScreen, setAddressScreen] = useState('list')
  const [editingAddressId, setEditingAddressId] = useState('')
  const [addressForm, setAddressForm] = useState(createEmptyAddressForm())
  const [addressFormErrors, setAddressFormErrors] = useState({})
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false)
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [orderStatusFilter, setOrderStatusFilter] = useState('To Receive')
  const [profileName, setProfileName] = useState(user?.name || '')
  const [profilePhone, setProfilePhone] = useState(user?.phone || '')
  const [profileBusy, setProfileBusy] = useState(false)
  const [searchSheet, setSearchSheet] = useState('')
  const [notifications, setNotifications] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('hto_customer_notifications') || 'null')
      return Array.isArray(stored) ? stored : [{ id: 'welcome', title: 'Welcome to HTOO', message: 'Discover new styles, seasonal offers, and fresh arrivals.', read: false }]
    } catch {
      return [{ id: 'welcome', title: 'Welcome to HTOO', message: 'Discover new styles, seasonal offers, and fresh arrivals.', read: false }]
    }
  })
  const activeBanners = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const heroLayout = storefrontLayout.find((block) => block.id === 'block-hero')
    if (heroLayout?.enabled === false) return []
    return storefrontBanners
      .filter((banner) => banner.enabled !== false && banner.image && (!banner.startDate || banner.startDate.slice(0, 10) <= today) && (!banner.endDate || banner.endDate.slice(0, 10) >= today))
      .sort((first, second) => (first.sortOrder || 0) - (second.sortOrder || 0))
  }, [storefrontBanners, storefrontLayout])

  useEffect(() => {
    if (!Array.isArray(storefrontNotifications)) return
    const adminIds = new Set(storefrontNotifications.map((notification) => notification.id))
    const now = new Date().toISOString()
    const published = storefrontNotifications
      .filter((notification) => notification.status === 'Sent' || (notification.status === 'Scheduled' && (!notification.date || notification.date <= now)))
      .sort((first, second) => String(second.date || '').localeCompare(String(first.date || '')))
    setNotifications((current) => {
      const readById = new Map(current.map((notification) => [notification.id, notification.read]))
      return [
        ...published.map((notification) => ({
          ...notification,
          read: readById.get(notification.id) || false
        })),
        ...current.filter((notification) => !adminIds.has(notification.id))
      ]
    })
  }, [storefrontNotifications])

  useEffect(() => {
    try { localStorage.setItem('hto_customer_notifications', JSON.stringify(notifications)) } catch (storageError) {
      console.warn('[notifications] Could not persist notification state.', storageError)
    }
  }, [notifications])

  useEffect(() => {
    setProfileName(user?.name || '')
    setProfilePhone(user?.phone || '')
  }, [user?.id, user?.name, user?.phone])

  // Quick toast helper
  function showToast(msg) {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 2400)
  }

  // Copy helper
  async function copyToClipboard(text) {
    if (!text) return
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard access is not available in this browser.')
      await navigator.clipboard.writeText(text)
      setCopiedText(true)
      showToast(tr('Copied to clipboard!'))
      setTimeout(() => setCopiedText(false), 2000)
    } catch (copyError) {
      setError(copyError.message || 'Unable to copy this payment detail.')
    }
  }

  async function shareProduct(product) {
    const shareUrl = new URL(import.meta.env.BASE_URL, window.location.origin)
    shareUrl.searchParams.set('product', product.id)
    try {
      if (!navigator.share) {
        await copyToClipboard(shareUrl.toString())
        return
      }
      await navigator.share({ title: product.name, text: product.description || product.name, url: shareUrl.toString() })
    } catch (shareError) {
      if (shareError.name !== 'AbortError') setError(shareError.message || tr('Unable to share this product.'))
    }
  }

  function closeProductDetail() {
    setViewingProduct(null)
    const currentUrl = new URL(window.location.href)
    if (currentUrl.searchParams.has('product')) {
      currentUrl.searchParams.delete('product')
      window.history.replaceState(window.history.state, '', `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`)
    }
  }

  // Products filtered for mobile
  const mobileDisplayProducts = useMemo(() => {
    let list = [...products]
    const effectiveCategory = selectedMobileCategory !== 'All' ? selectedMobileCategory : (currentTab === 'explore' && selectedCategory ? selectedCategory : '')
    if (effectiveCategory && effectiveCategory !== 'All') {
      if (effectiveCategory === 'Sale') {
        list = list.filter((p) => p.oldPrice != null || p.category === 'Sale')
      } else if (effectiveCategory === 'Bags') {
        list = list.filter((p) => /bag/i.test(`${p.category} ${p.subcategory}`))
      } else if (effectiveCategory === 'New Collection') {
        list = list.slice().reverse().slice(0, 12)
      } else {
        list = list.filter((p) => p.category === effectiveCategory)
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter((p) => `${p.name} ${p.nameMy || ''} ${p.brand} ${p.category} ${p.subcategory}`.toLowerCase().includes(q))
    }
    if (filters?.brand) list = list.filter((p) => p.brand === filters.brand)
    if (filters?.category) list = list.filter((p) => p.category === filters.category)
    if (filters?.size) {
      list = list.filter((p) => getProductVariants(p).sizes.includes(filters.size))
    }
    if (filters?.color) {
      list = list.filter((p) => getProductVariants(p).colors.includes(filters.color))
    }
    if (filters?.rating) list = list.filter((p) => Number(p.rating || 0) >= Number(filters.rating))
    if (filters?.availability === 'in-stock') list = list.filter((p) => Number(p.stock) > 0)
    if (filters?.availability === 'out-of-stock') list = list.filter((p) => Number(p.stock) <= 0)
    if (filters?.discount === 'discounted') list = list.filter((p) => Number(p.oldPrice) > Number(p.price))
    if (filters?.material) list = list.filter((p) => p.material === filters.material)
    if (filters?.style) list = list.filter((p) => p.style === filters.style)
    if (filters?.price === 'under-30') list = list.filter((p) => p.price < 30000)
    if (filters?.price === '30-60') list = list.filter((p) => p.price >= 30000 && p.price <= 60000)
    if (filters?.price === 'over-60') list = list.filter((p) => p.price > 60000)

    if (sortBy === 'popular') list.sort((a, b) => (b.rating || 0) - (a.rating || 0))
    if (sortBy === 'price-asc') list.sort((a, b) => a.price - b.price)
    if (sortBy === 'price-desc') list.sort((a, b) => b.price - a.price)
    if (sortBy === 'newest') list = list.slice().reverse()
    if (sortBy === 'rating') list.sort((a, b) => (b.rating || 0) - (a.rating || 0))

    return list
  }, [products, selectedMobileCategory, currentTab, selectedCategory, searchQuery, filters, sortBy])

  const cartCount = useMemo(() => cart.reduce((count, item) => count + Number(item.quantity || 0), 0), [cart])
  const availableSizes = useMemo(() => Array.from(new Set(products.flatMap((product) => getProductVariants(product).sizes).filter(Boolean))), [products])
  const availableColors = useMemo(() => Array.from(new Set(products.flatMap((product) => getProductVariants(product).colors).filter(Boolean))), [products])
  const orderStatusFilters = ['To Receive', 'Received', 'Cancellations']
  const matchesOrderStatus = (order, status) => {
    const currentStatus = String(order.status || '').toLowerCase()
    if (status === 'Received') return ['delivered', 'completed', 'received'].includes(currentStatus)
    if (status === 'Cancellations') return ['cancelled', 'canceled', 'cancel'].includes(currentStatus)
    return !['delivered', 'completed', 'received', 'cancelled', 'canceled', 'cancel'].includes(currentStatus)
  }

  // Featured, Best Sellers, New Arrivals, Deals, Recommended
  const featuredProducts = useMemo(() => {
    const curated = products.filter((product) => product.featured)
    return (curated.length ? curated : products).slice(0, 4)
  }, [products])
  const bestSellers = useMemo(() => [...products].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 4), [products])
  const newArrivals = useMemo(() => products.slice().reverse().slice(0, 4), [products])
  const dealProducts = useMemo(() => products.filter((p) => p.oldPrice != null || p.category === 'Sale').slice(0, 4), [products])
  const recommendedProducts = useMemo(() => products.slice(1, 5), [products])
  const homeSections = useMemo(() => {
    const productsBySource = {
      featured: featuredProducts,
      new_arrivals: newArrivals,
      best_sellers: bestSellers,
      discount: dealProducts,
      recommended: recommendedProducts
    }
    const sectionBlocks = {
      featured: 'block-featured',
      new_arrivals: 'block-new',
      best_sellers: 'block-best',
      discount: 'block-discount',
      recommended: 'block-recommend'
    }
    return storefrontSections
      .filter((section) => section.enabled !== false)
      .map((section) => {
        const block = storefrontLayout.find((item) => item.id === sectionBlocks[section.source])
        return {
          ...section,
          products: productsBySource[section.source] || [],
          sortOrder: block?.sortOrder ?? section.sortOrder,
          visible: block?.enabled !== false
        }
      })
      .filter((section) => section.visible && section.products.length > 0)
      .sort((first, second) => (first.sortOrder || 0) - (second.sortOrder || 0))
  }, [storefrontSections, storefrontLayout, featuredProducts, newArrivals, bestSellers, dealProducts, recommendedProducts])
  const homeItems = useMemo(() => [
    ...(activeBanners.length ? [{
      id: 'block-hero',
      kind: 'banner',
      sortOrder: storefrontLayout.find((block) => block.id === 'block-hero')?.sortOrder ?? 0
    }] : []),
    ...homeSections.map((section) => ({ ...section, kind: 'products' }))
  ].sort((first, second) => (first.sortOrder || 0) - (second.sortOrder || 0)), [activeBanners, homeSections, storefrontLayout])
  const hasHomeBanner = homeItems.some((item) => item.kind === 'banner')
  const currentBannerIndex = activeBanners.length ? activeBannerIndex % activeBanners.length : 0

  useEffect(() => {
    const mobileQuery = window.matchMedia('(max-width: 767px)')
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updateMediaPreferences = () => {
      setIsMobileViewport(mobileQuery.matches)
      setPrefersReducedMotion(reducedMotionQuery.matches)
    }
    mobileQuery.addEventListener('change', updateMediaPreferences)
    reducedMotionQuery.addEventListener('change', updateMediaPreferences)
    return () => {
      mobileQuery.removeEventListener('change', updateMediaPreferences)
      reducedMotionQuery.removeEventListener('change', updateMediaPreferences)
    }
  }, [])

  useEffect(() => {
    if (
      route.page !== 'main' ||
      currentTab !== 'home' ||
      searchQuery.trim() ||
      selectedMobileCategory !== 'All' ||
      !hasHomeBanner ||
      !isMobileViewport ||
      prefersReducedMotion ||
      bannerAutoplayPaused ||
      activeBanners.length < 2
    ) return

    const timer = window.setInterval(() => {
      const nextIndex = (currentBannerIndex + 1) % activeBanners.length
      const track = bannerTrackRef.current
      const slide = track?.children[nextIndex]
      if (!track || !slide) return
      track.scrollTo({ left: slide.offsetLeft, behavior: 'smooth' })
      setActiveBannerIndex(nextIndex)
    }, 3500)
    return () => window.clearInterval(timer)
  }, [
    route.page,
    currentTab,
    searchQuery,
    selectedMobileCategory,
    hasHomeBanner,
    isMobileViewport,
    prefersReducedMotion,
    bannerAutoplayPaused,
    activeBanners,
    currentBannerIndex
  ])

  useEffect(() => () => window.clearTimeout(bannerResumeTimeoutRef.current), [])

  function pauseBannerAutoplay() {
    window.clearTimeout(bannerResumeTimeoutRef.current)
    setBannerAutoplayPaused(true)
  }

  function resumeBannerAutoplaySoon() {
    window.clearTimeout(bannerResumeTimeoutRef.current)
    bannerResumeTimeoutRef.current = window.setTimeout(() => setBannerAutoplayPaused(false), 5000)
  }

  function selectBanner(index) {
    const track = bannerTrackRef.current
    const slide = track?.children[index]
    if (!track || !slide) return
    pauseBannerAutoplay()
    track.scrollTo({ left: slide.offsetLeft, behavior: prefersReducedMotion ? 'auto' : 'smooth' })
    setActiveBannerIndex(index)
    resumeBannerAutoplaySoon()
  }

  // Handle Add to Cart with feedback
  function handleAddToCart(product, variants = null, quantity = 1) {
    const availableStock = getProductStock(product, variants || {})
    if (!availableStock) {
      showToast(tr('This item is out of stock.'))
      return false
    }
    const supportedVariants = getProductVariants(product)
    const sizes = supportedVariants.sizes || []
    const colors = supportedVariants.colors || []
    if ((sizes.length && !sizes.includes(variants?.size)) || (colors.length && !colors.includes(variants?.color))) {
      showToast(tr('Choose an available size and color first.'))
      return false
    }
    const selectedVariants = {
      ...(variants?.size ? { size: variants.size } : {}),
      ...(variants?.color ? { color: variants.color } : {})
    }
    const inCart = cart.filter((item) => String(item.id) === String(product.id) &&
      (!hasVariantStock(product) || variantStockKey(item.variants) === variantStockKey(selectedVariants)))
      .reduce((sum, item) => sum + Number(item.quantity || 0), 0)
    if (inCart + quantity > availableStock) {
      showToast(`Only ${availableStock} item(s) are available for this option.`)
      return false
    }
    if (!addToCart({ ...product, selectedVariants }, quantity)) return false
    showToast(`Added ${product.name} to Cart`)
    return true
  }

  // Handle Buy Now (adds to cart and directly goes to checkout)
  function handleBuyNow(product, variants = null, quantity = 1) {
    if (!handleAddToCart(product, variants, quantity)) return
    setViewingProduct(null)
    beginCheckout('review')
  }

  function resetAddressForm() {
    setAddressForm(createEmptyAddressForm())
    setAddressFormErrors({})
  }

  function openAddressList() {
    setEditingAddressId('')
    setAddressScreen('list')
    resetAddressForm()
    setActiveAccountModal('addresses')
  }

  function openAddressForm(address = null) {
    setEditingAddressId(address?.id || '')
    setAddressForm(address ? {
      fullName: address.fullName || user?.name || '',
      phone: address.phone || user?.phone || '',
      region: address.region || '',
      township: address.township || '',
      addressLine: address.addressLine || address.value || '',
      mapLocation: address.mapLocation || '',
      isDefault: Boolean(address.default ?? address.isDefault)
    } : { ...createEmptyAddressForm(), fullName: user?.name || '', phone: user?.phone || '', isDefault: !addressBook.length })
    setAddressFormErrors({})
    setAddressScreen('form')
  }

  function updateAddressField(field, value) {
    setAddressForm((current) => {
      const next = { ...current, [field]: value }
      if (field === 'region') next.township = ''
      return next
    })
    setAddressFormErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  function handleSaveAddress(event) {
    event.preventDefault()
    const errors = {}
    if (!addressForm.fullName.trim()) errors.fullName = 'Please enter your full name.'
    if (!addressForm.phone.trim()) errors.phone = 'Please enter your phone number.'
    else if (!isPhoneNumber(addressForm.phone)) errors.phone = 'Enter a valid phone number.'
    if (!addressForm.region) errors.region = 'Please select a region or state.'
    if (!addressForm.township) errors.township = 'Please select a township.'
    if (!addressForm.addressLine.trim()) errors.addressLine = 'Please enter your full delivery address.'
    if (!addressForm.mapLocation) errors.mapLocation = 'Please pin your location on the map.'
    setAddressFormErrors(errors)
    if (Object.keys(errors).length) {
      showToast(tr('Please fill in all required fields.'))
      const firstField = document.getElementById(`mob-address-${Object.keys(errors)[0]}`)
      firstField?.focus?.()
      firstField?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
      return
    }
    const payload = {
      label: editingAddressId ? addressBook.find((item) => item.id === editingAddressId)?.label || 'Home' : 'Home',
      fullName: addressForm.fullName.trim(),
      phone: addressForm.phone.trim(),
      region: addressForm.region,
      township: addressForm.township,
      addressLine: addressForm.addressLine.trim(),
      mapLocation: addressForm.mapLocation,
      value: `${addressForm.addressLine.trim()}, ${addressForm.township}, ${addressForm.region}`,
      default: addressForm.isDefault || !addressBook.length
    }
    if (editingAddressId) {
      updateAddress(editingAddressId, payload)
      showToast(tr('Address updated.'))
    } else {
      addAddress(payload)
      showToast(tr('New address saved!'))
    }
    setEditingAddressId('')
    resetAddressForm()
    setAddressScreen('list')
  }

  function pickMapLocation() {
    if (!navigator.geolocation) {
      showToast(tr('Location is not available on this device.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        updateAddressField('mapLocation', `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`)
      },
      () => showToast(tr('Unable to get your current location. Please pick it manually.')),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  async function confirmDeleteAccount() {
    if (deleteConfirmationText !== 'DELETE') return
    setDeleteBusy(true)
    try {
      await deleteAccount()
      setNotifications([])
      try { localStorage.removeItem('hto_customer_notifications'); localStorage.removeItem('hto_saved_for_later') } catch (storageError) {
        console.warn('[account] Could not clear local notification and saved-item data.', storageError)
      }
      setDeleteConfirmationOpen(false)
      showToast(tr('Your account has been deleted.'))
    } catch (deleteError) {
      setError(deleteError.message || 'Unable to delete your account. Please try again.')
    } finally {
      setDeleteBusy(false)
    }
  }

  async function saveProfile(event) {
    event.preventDefault()
    setProfileBusy(true)
    try {
      await updateProfile({ name: profileName.trim(), phone: profilePhone.trim() })
      showToast(tr('Profile updated.'))
      setActiveAccountModal(null)
    } catch (profileError) {
      setError(profileError.message || 'Unable to update your profile.')
    } finally {
      setProfileBusy(false)
    }
  }

  // Open the read-only order detail view
  function openOrderDetail(order) {
    setSelectedOrder(order)
    setActiveAccountModal('chat')
  }

  // Load Order Chat when opening an order
  const loadOrderChat = useCallback(async (order) => {
    setSelectedOrder(order)
    setActiveAccountModal('chat')
    if (!order?.id) return
    if (!user?.id) {
      setOrderChatData(null)
      return
    }
    try {
      const res = await fetch(`/api/orders/${order.id}/chat`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Unable to load order details.')
      setOrderChatData(data.chat)
    } catch (chatError) {
      setError(chatError.message || 'Unable to load order details.')
    }
  }, [user?.id, setSelectedOrder, setError])

  useEffect(() => {
    if (route.page !== 'main' || !route.openOrderId) return
    const order = orders.find((item) => item.id === route.openOrderId)
    if (!order) return
    setActiveTab('account')
    setRoute({ page: 'main' })
    void loadOrderChat(order)
  }, [route.page, route.openOrderId, orders, setActiveTab, setRoute, loadOrderChat])

  // Send Order Chat message
  async function sendChatMessage() {
    if (!chatDraft.trim() || !selectedOrder?.id) return
    try {
      const res = await fetch(`/api/orders/${selectedOrder.id}/chat/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: chatDraft })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Unable to send your message.')
      setOrderChatData(data.chat)
      setChatDraft('')
    } catch (chatError) {
      setError(chatError.message || 'Unable to send your message.')
    }
  }

  // Shared by the review and final checkout steps: which payment kind is active
  // (cod / wallet / bank) and the accounts configured for it.
  const activePaymentKind = getPaymentKind(selectedPaymentAccount)
  const paymentKindAccounts = paymentMethods.filter((payment) => getPaymentKind(payment) === activePaymentKind)

  // Mobile Order Placement with loading state. Resolves to true only when the
  // order was accepted and the confirmation screen is about to be shown.
  async function handleMobilePlaceOrder(fromStep = checkoutStep) {
    const stepMessage = validateCheckoutStep(fromStep)
    if (stepMessage) { setError(tr(stepMessage)); return false }
    // The selected payment option is the source of truth for the request.
    if (!selectedPaymentAccount) { setError(tr('Select an active payment method.')); return false }
    if (!isCashPayment && !paymentSlip) { setError(tr('Upload your payment slip to continue.')); return false }
    setError('')
    setIsSubmittingOrder(true)
    try {
      const placed = await placeOrder()
      if (placed?.id || placed?.orderNumber) setRoute({ page: 'confirmation' })
      return Boolean(placed)
    } catch (submitError) {
      console.error('[checkout] Mobile place-order handler failed', submitError)
      const detail = submitError?.message || String(submitError)
      setError(import.meta.env.DEV
        ? `Unable to place order: ${detail}`
        : 'Unable to place order. Please check your payment slip and try again.')
      return false
    } finally {
      setIsSubmittingOrder(false)
    }
  }

  // --------------------------------------------------------------------------
  // ONBOARDING / LAUNCH SCREEN (MOBILE)
  // --------------------------------------------------------------------------
  if (route.page === 'launch') {
    return (
      <main className="mobile-shell mob-confirm-screen">
        <div className="mob-confirm-card" style={{ marginTop: '2rem' }}>
          <img src={STORE_LOGO_URL} alt="" style={{ width: '56px', height: '56px', display: 'block', margin: '0 auto 1.25rem' }} />
          <span className="mob-hero-badge">HTOO ONLINE SHOP</span>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0.5rem 0', color: 'var(--mob-ink)' }}>{tr('Dress Better.')}<br />{tr('Live Brighter.')}</h1>
          <label className="mob-launch-language">
            <span>{language === 'my' ? 'ðŸ‡²ðŸ‡²' : 'ðŸ‡ºðŸ‡¸'} {tr('Language')}</span>
            <select value={language} onChange={(event) => setLanguage(event.target.value)}>
              <option value="my">🇲🇲 မြန်မာ</option>
              <option value="en">ðŸ‡ºðŸ‡¸ English</option>
            </select>
          </label>
          <p style={{ fontSize: '0.86rem', color: 'var(--mob-muted)', lineHeight: 1.5, marginBottom: '1.5rem' }}>
            {tr('Fashion-first shopping with curated categories, smart search, wishlist, and fast checkout.')}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <button className="mob-btn-primary" onClick={startApp}>{tr('Get Started')}</button>
            <button className="mob-btn-secondary" onClick={() => { localStorage.setItem(ONBOARDING_KEY, '1'); setRoute({ page: 'auth' }) }}>{tr('Skip to Shop')}</button>
          </div>
        </div>
      </main>
    )
  }

  // --------------------------------------------------------------------------
  // AUTH SCREEN (MOBILE)
  // --------------------------------------------------------------------------
  if (route.page === 'auth') {
    return <BuyerAuth authMode={authMode} setAuthMode={setAuthMode} authFlow={authFlow} setAuthFlow={setAuthFlow} otpPurpose={authOtpPurpose} error={error} notice={authNotice} setError={setError} onSubmit={submitAuth} onOtpSubmit={authActions.verifyOtp} onResetPassword={resetCustomerPassword} onResendOtp={authActions.resendOtp} continueAsGuest={continueAsGuest} busy={authBusy} language={language} authPhone={authPhone} setAuthPhone={setAuthPhone} />
  }

  // --------------------------------------------------------------------------
  // ORDER CONFIRMATION SCREEN (MOBILE)
  // --------------------------------------------------------------------------
  if (route.page === 'confirmation') {
    return (
      <main className="mobile-shell mob-confirm-screen">
        <div className="mob-confirm-card">
          <div className="mob-success-badge">✓</div>
          <h2 className="mob-confirm-title">{tr('Order Placed Successfully!')}</h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--mob-muted)', marginBottom: '0.85rem' }}>
            {tr('Thank you for shopping with HTOO Online Shop.')}
          </p>
          <div className="mob-confirm-id">
            Order #{selectedOrder?.orderNumber || selectedOrder?.id}
          </div>

          <div className="mob-confirm-details">
            <div className="mob-confirm-row">
              <span>{tr('Customer Name')}</span>
              <strong>{selectedOrder?.customer?.name || checkoutForm.name}</strong>
            </div>
            <div className="mob-confirm-row">
              <span>{tr('Phone Number')}</span>
              <strong>{selectedOrder?.customer?.phone || checkoutForm.phone}</strong>
            </div>
            <div className="mob-confirm-row">
              <span>{tr('Delivery Address')}</span>
              <strong style={{ maxWidth: '60%', textAlign: 'right' }}>{selectedOrder?.customer?.address || checkoutForm.shippingAddress}</strong>
            </div>
            <div className="mob-confirm-row">
              <span>{tr('Payment Method')}</span>
              <strong>{selectedOrder?.paymentMethod || selectedPaymentAccount?.name}</strong>
            </div>
            <div className="mob-confirm-row">
              <span>{tr('Total Amount')}</span>
              <strong style={{ color: 'var(--mob-brand)', fontSize: '1rem' }}>{formatPrice(selectedOrder?.total || cartTotal)}</strong>
            </div>
            <div className="mob-confirm-row">
              <span>{tr('Order Status')}</span>
              <span className="mob-status-pill mob-status-new">{selectedOrder?.status || 'New'}</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {selectedOrder && (
              <button className="mob-btn-secondary" onClick={() => loadOrderChat(selectedOrder)}>
                ðŸ’¬ View Order & Chat with Shop
              </button>
            )}
            <button className="mob-btn-primary" onClick={() => { setActiveTab('home'); setRoute({ page: 'main' }) }}>
              {tr('Continue Shopping')}
            </button>
          </div>
        </div>
      </main>
    )
  }

  // --------------------------------------------------------------------------
  // CHECKOUT SCREEN (MOBILE STEP-BY-STEP)
  // --------------------------------------------------------------------------
  if (route.page === 'checkout') {
    const checkoutIsReview = checkoutStep === 'review'
    // "final" is a legacy step kept only so older drafts still render the review screen.
    const checkoutIsFinal = checkoutStep === 'final'

    function goToStorefrontStep(step) {
      // The wizard is bypassed: "edit" entry points return to the cart instead of step forms.
      if (typeof step === 'number') { exitCheckoutToCart(); return }
      setError('')
      setCheckoutStep(step)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    function handleCheckoutEditAddress() {
      setActiveTab('account')
      setRoute({ page: 'main' })
      openAddressList()
    }

    return (
      <main className={`mobile-shell mob-checkout-screen ${checkoutIsReview || checkoutIsFinal ? 'mob-checkout-screen--review' : ''}`}>
        {/* Header */}
        <div className="mob-checkout-header">
          <button className="mob-back-btn" onClick={() => {
            setError('')
            if (checkoutIsFinal) { setCheckoutStep('review'); return }
            // Straight back to the cart screen — never into the step-by-step form.
            exitCheckoutToCart()
          }}>
            <span style={{ fontSize: '1.1rem' }}>‹</span> {tr('Cart')}
          </button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.95rem', fontWeight: 800 }}>{tr('Checkout')}</div>
            {!checkoutIsReview && !checkoutIsFinal && (
              <small style={{ fontSize: '0.72rem', color: 'var(--mob-muted)' }}>{tr('Step')} {checkoutStep} of 5</small>
            )}
          </div>
          <div style={{ width: '40px' }} />
        </div>

        {/* Progress Bar */}
        {!checkoutIsReview && !checkoutIsFinal && (
          <div className="mob-steps-track">
            {[1, 2, 3, 4, 5].map((s) => (
              <div key={s} className={`mob-step-bar ${checkoutStep >= s ? 'active' : ''}`} />
            ))}
          </div>
        )}

        {/* Order review / confirmation screen */}
        {checkoutIsReview && (() => {
          const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0)
          // Always show the customer's default saved address; the checkout form is only a fallback.
          const defaultAddress = addressBook.find((address) => address.default) || addressBook[0] || null
          const recipientName = defaultAddress?.fullName || checkoutForm.name || user?.name || ''
          const recipientPhone = defaultAddress?.phone || checkoutForm.phone || user?.phone || ''
          const detailedAddress = defaultAddress?.value || defaultAddress?.addressLine || checkoutForm.shippingAddress || ''
          const addressMeta = defaultAddress
            ? [defaultAddress.township, defaultAddress.region].filter(Boolean).join(', ')
            : [checkoutForm.township, checkoutForm.city].filter(Boolean).join(', ')
          const choosePaymentKind = (kindId) => {
            const match = paymentMethods.find((payment) => getPaymentKind(payment) === kindId)
            setError('')
            setPaymentSlip('')
            // Fall back to any active shop account so ordering never dead-ends on an unconfigured method.
            setCheckoutForm({ ...checkoutForm, paymentAccountId: (match || selectedPaymentAccount)?.id || '' })
          }
          const kindAccounts = paymentKindAccounts
          return (
            <div className="mob-co-review">
              {/* 1. Delivery address */}
              <section className="mob-co-card">
                <header className="mob-co-card-head">
                  <button type="button" className="mob-co-link" onClick={handleCheckoutEditAddress}>{tr('Edit')} <span aria-hidden="true">›</span></button>
                </header>
                {recipientName || recipientPhone || detailedAddress ? (
                  <div className="mob-co-address">
                    <div className="mob-co-address-row">
                      <span className="mob-co-avatar" aria-hidden="true">{(recipientName.trim().charAt(0) || '?').toUpperCase()}</span>
                      <div className="mob-co-address-person">
                        <div className="mob-co-address-name-row">
                          <strong className="mob-co-address-name">{recipientName || tr('Name not provided')}</strong>
                          <span className="mob-co-address-phone">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.08 4.18 2 2 0 0 1 4.06 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.68 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.2a2 2 0 0 1 2.11-.45c.9.32 1.85.55 2.81.68A2 2 0 0 1 22 16.92Z" /></svg>
                            {recipientPhone || tr('Phone not provided')}
                          </span>
                        </div>
                        <p className="mob-co-address-line">{detailedAddress || tr('Address not provided')}</p>
                        {addressMeta && <span className="mob-co-address-meta">{addressMeta}</span>}
                      </div>
                    </div>
                  </div>
                ) : (
                  <button type="button" className="mob-co-empty" onClick={() => goToStorefrontStep(1)}>
                    + {tr('Add New Address')}
                  </button>
                )}
              </section>

              {/* 2. Order items */}
              <section className="mob-co-card">
                <header className="mob-co-card-head">
                  <h2 className="mob-co-card-title">{itemCount} {tr('item')}</h2>
                </header>
                <div className="mob-co-items">
                  {cart.map((item) => {
                    const product = products.find((candidate) => String(candidate.id) === String(item.id))
                    const price = Number(product?.discountPrice ?? product?.price ?? item.price)
                    const stock = product ? getProductStock(product, item.variants) : item.quantity
                    const variants = [item.variants?.size && `${tr('Size')} ${item.variants.size}`, item.variants?.color && item.variants.color].filter(Boolean).join(' · ')
                    return (
                      <article key={item.cartKey || item.id} className="mob-co-item">
                        <div className="mob-co-item-thumb">
                          {item.image ? <img src={item.image} alt="" loading="lazy" /> : <span aria-hidden="true">🛍️</span>}
                        </div>
                        <div className="mob-co-item-main">
                          <h3 className="mob-co-item-name">{item.name}</h3>
                          <p className="mob-co-item-variant">{variants || product?.sku || tr('Standard')}</p>
                          <div className="mob-co-item-price-row">
                            <strong className="mob-co-item-price">{formatPrice(price * item.quantity)}</strong>
                            <div className="mob-cart-stepper mob-co-stepper" aria-label={`${tr('Quantity')}: ${item.quantity}`}>
                              <button type="button" aria-label={`${tr('Decrease quantity')} ${item.name}`} disabled={item.quantity <= 1} onClick={() => updateQuantity(item.cartKey || item.id, -1)}>−</button>
                              <span aria-live="polite">{item.quantity}</span>
                              <button type="button" className="mob-cart-stepper-plus" aria-label={`${tr('Increase quantity')} ${item.name}`} disabled={item.quantity >= stock} onClick={() => updateQuantity(item.cartKey || item.id, 1)}>+</button>
                            </div>
                          </div>
                        </div>
                      </article>
                    )
                  })}
                  {!cart.length && <p className="mob-co-card-sub">{tr('Your cart is empty.')}</p>}
                </div>
              </section>

              {/* 3. Payment summary */}
              <section className="mob-co-card">
                <div className="mob-co-summary">
                  <div className="mob-co-summary-row">
                    <span>{tr('Items Subtotal')}</span>
                    <strong>{formatPrice(cartSubtotal)}</strong>
                  </div>
                  <div className="mob-co-summary-row">
                    <span>{tr('Delivery Fee')}</span>
                    <strong>{formatPrice(deliveryFee)}</strong>
                  </div>
                  <div className={`mob-co-summary-row ${couponDiscount > 0 ? '' : 'is-muted'}`}>
                    <span>{tr('Discount')}</span>
                    <strong>{couponDiscount > 0 ? `−${formatPrice(couponDiscount)}` : formatPrice(0)}</strong>
                  </div>
                  <div className="mob-co-summary-total">
                    <span>{tr('Total Amount')}</span>
                    <strong>{formatPrice(cartTotal)}</strong>
                  </div>
                </div>
              </section>

              {/* 4. Payment method */}
              <section className="mob-co-card">
                <div className="mob-co-payments" role="radiogroup" aria-label={tr('Payment Method')}>
                  {CHECKOUT_PAYMENT_KINDS.map((kind) => {
                    const isSelected = activePaymentKind === kind.id
                    return (
                      <label key={kind.id} className={`mob-co-pay ${isSelected ? 'is-selected' : ''}`}>
                        <input
                          type="radio"
                          name="checkoutPaymentKind"
                          value={kind.id}
                          checked={isSelected}
                          onChange={() => choosePaymentKind(kind.id)}
                        />
                        <span className="mob-co-pay-icon" aria-hidden="true">{kind.svg}</span>
                        <span className="mob-co-pay-copy">
                          <strong>{tr(kind.titleKey)}</strong>
                          <span>{tr(kind.subtitleKey)}</span>
                        </span>
                        <span className="mob-co-pay-radio" aria-hidden="true" />
                      </label>
                    )
                  })}
                </div>

                {/* Accounts (mobile wallets / bank accounts) configured for the selected method */}
                {activePaymentKind === 'wallet' && paymentMethods.some((payment) => getPaymentKind(payment) === 'wallet') && (
                  <div className="mob-co-account-list" role="radiogroup" aria-label={tr('Choose a mobile wallet')}>
                    {kindAccounts.map((payment) => {
                      const isSelected = selectedPaymentAccount?.id === payment.id
                      return (
                        <label key={payment.id} className={`mob-co-account ${isSelected ? 'is-selected' : ''}`}>
                          <input
                            type="radio"
                            name="checkoutWalletAccount"
                            value={payment.id}
                            checked={isSelected}
                            onChange={() => { setError(''); setPaymentSlip(''); setCheckoutForm({ ...checkoutForm, paymentAccountId: payment.id }) }}
                          />
                          <span className="mob-co-account-copy">
                            <strong>{language === 'my' ? payment.nameMyanmar || payment.name : payment.name}</strong>
                            <span>{[payment.accountName, payment.phoneNumber].filter(Boolean).join(' · ') || payment.name}</span>
                          </span>
                          <span className="mob-co-pay-radio" aria-hidden="true" />
                        </label>
                      )
                    })}
                  </div>
                )}

                {activePaymentKind === 'bank' && selectedPaymentAccount && (
                  <div className="mob-payment-detail-box">
                    {selectedPaymentAccount.accountName && (
                      <div className="mob-payment-detail-row">
                        <span>{tr('Account Name')}</span>
                        <strong>{selectedPaymentAccount.accountName}</strong>
                      </div>
                    )}
                    {selectedPaymentAccount.bankName && (
                      <div className="mob-payment-detail-row">
                        <span>{tr('Bank Name')}</span>
                        <strong>{selectedPaymentAccount.bankName}</strong>
                      </div>
                    )}
                    {selectedPaymentAccount.accountNumber && (
                      <div className="mob-payment-detail-row">
                        <span>{tr('Account Number')}</span>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <strong>{selectedPaymentAccount.accountNumber}</strong>
                          <button className="mob-copy-btn" onClick={() => copyToClipboard(selectedPaymentAccount.accountNumber)}>
                            {copiedText ? tr('Copied') : tr('Copy')}
                          </button>
                        </div>
                      </div>
                    )}
                    {selectedPaymentAccount.qrCode && (
                      <div className="mob-qr-preview">
                        <img src={selectedPaymentAccount.qrCode} alt={`${selectedPaymentAccount.name} QR Code`} />
                        <small style={{ fontSize: '0.72rem', color: 'var(--mob-muted)' }}>{tr('Scan QR code with your mobile banking app')}</small>
                      </div>
                    )}
                  </div>
                )}

                {isCashPayment ? (
                  <p className="mob-co-pay-note">{tr('No payment slip needed. Pay the delivery person when your order arrives.')}</p>
                ) : (
                  <div className="mob-co-final-group">
                    <div className="mob-co-final-group-head"><span>{tr('Payment Slip')}</span></div>
                    <div className="mob-slip-box">
                      {paymentSlip ? (
                        <>
                          <div className="mob-slip-preview-wrap"><img src={paymentSlip} alt={tr('Payment slip')} /></div>
                          <div className="mob-slip-actions">
                            <label className="mob-slip-upload-label">
                              <span>{tr('Replace Slip')}</span>
                              <input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" onChange={handlePaymentSlip} />
                            </label>
                            <button type="button" className="mob-btn-secondary" style={{ padding: '0.65rem 1rem' }} onClick={() => setPaymentSlip('')}>{tr('Remove')}</button>
                          </div>
                        </>
                      ) : (
                        <label className="mob-slip-upload-label">
                          <span>{tr('Upload Payment Slip')}</span>
                          <input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" onChange={handlePaymentSlip} />
                        </label>
                      )}
                    </div>
                  </div>
                )}
              </section>
            </div>
          )
        })()}

        {/* Error message */}
        {error && (
          <div style={{ background: 'var(--mob-danger-light)', color: 'var(--mob-danger)', padding: '0.75rem', borderRadius: 'var(--mob-radius-md)', fontSize: '0.8rem', fontWeight: 600, marginBottom: '1rem' }}>
            {tr(error)}
          </div>
        )}

        {/* Bottom bar: storefront wizard navigation, or one-tap place order from the review screen */}
        {checkoutIsReview || checkoutIsFinal ? (
          <div className="mob-co-bar">
            <div className="mob-co-bar-total">
              <span>{tr('Total Amount')}</span>
              <strong>{formatPrice(cartTotal)}</strong>
            </div>
            <button
              type="button"
              className="mob-co-place"
              disabled={isSubmittingOrder || !cart.length || !selectedPaymentAccount || (!isCashPayment && !paymentSlip)}
              onClick={() => { void handleMobilePlaceOrder('review') }}
            >
              {isSubmittingOrder ? tr('Placing Order...') : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
                  {tr('Place Order')}
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="mob-checkout-nav-bar">
            <button
              className="mob-btn-secondary"
              disabled={checkoutStep === 1}
              onClick={() => { setError(''); setCheckoutStep((s) => Math.max(1, s - 1)) }}
            >
              {tr('Previous')}
            </button>
            <button
              className="mob-btn-primary"
              onClick={() => {
                const msg = validateCheckoutStep(checkoutStep)
                if (msg) { setError(tr(msg)); return }
                setError('')
                if (checkoutStep === 5) { setCheckoutStep('review'); return }
                setCheckoutStep((s) => Math.min(5, s + 1))
              }}
            >
              {checkoutStep >= 5 ? tr('Review order') : tr('Continue')}
            </button>
          </div>
        )}
      </main>
    )
  }

  // --------------------------------------------------------------------------
  // MAIN APP SHELL (MOBILE VIEWS: HOME, EXPLORE, WISHLIST, CART, ACCOUNT)
  // --------------------------------------------------------------------------
  return (
    <div className="mobile-shell">
      {/* Toast Notification */}
      {toastMessage && <div className="mob-toast">{toastMessage}</div>}
    {catalogStatus === 'loading' && <div className="mob-catalog-status" role="status">{tr('Loading the latest collection…')}</div>}
    {catalogStatus === 'error' && <div className="mob-catalog-status error" role="alert">{tr('We could not refresh the catalog. Showing available products.')}</div>}
    {storefrontError && <div className="mob-global-error" role="alert">{tr(storefrontError)}</div>}

      {(activeTab === 'home' || activeTab === 'search') && (
        <header className="mob-header">
          <div className="mob-header-inner">
            <button className="mob-logo" aria-label={tr('HTOO Home')} onClick={() => { setActiveTab('home'); setSelectedMobileCategory('All'); setSearchQuery('') }}>
              <img className="mob-logo-image" src={HEADER_LOGO_URL} alt="" aria-hidden="true" />
            </button>

            <div className="mob-header-search">
              <input
                className="mob-header-search-input"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onFocus={() => { if (currentTab === 'home') setActiveTab('search') }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    saveSearch()
                    setActiveTab('search')
                    event.currentTarget.blur()
                  }
                }}
                aria-label={tr('Search')}
                placeholder={tr('Search products')}
              />
              {searchQuery && <button className="mob-header-search-clear" onClick={() => setSearchQuery('')} aria-label={tr('Clear search')}>×</button>}
              <button
                className="mob-header-search-submit"
                aria-label={tr('Search')}
                onClick={() => { saveSearch(); setActiveTab('search') }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-4-4" />
                </svg>
              </button>
            </div>
            <button className="mob-header-cart" onClick={() => setActiveTab('cart')} aria-label={`${tr('Open cart')}${cartCount ? `, ${cartCount} ${tr('items')}` : ''}`}>
              <CartIcon count={cartCount} />
            </button>
          </div>
        </header>
      )}

      {/* Category shortcuts belong to Search, not the customer home page. */}
      {currentTab === 'explore' && (
        <>
          <div className="mob-categories-scroll">
            {[
              ['All', '✦'],
              ['Men', '◉'],
              ['Women', '♡'],
              ['Kids', '☆'],
              ['Shoes', '⌁'],
              ['Bags', '▱'],
              ['Accessories', '◇'],
              ['New Collection', '✧'],
              ['Sale', '%']
            ].map(([cat, icon]) => {
              const isActive = selectedMobileCategory === cat
              return (
                <button
                  key={cat}
                  className={`mob-category-shortcut ${isActive ? 'active' : ''}`}
                  aria-pressed={isActive}
                  onClick={() => {
                    setSelectedMobileCategory(cat)
                    if (currentTab === 'home') setActiveTab('search')
                    setSelectedCategory?.(cat === 'All' || cat === 'Sale' ? '' : cat)
                  }}
                >
                  <span className="mob-category-icon" aria-hidden="true">{icon}</span>
                  <span>{tr(cat)}</span>
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* --------------------------------------------------------------------
         TAB 1: HOME PAGE
         -------------------------------------------------------------------- */}
      {currentTab === 'home' && !searchQuery.trim() && selectedMobileCategory === 'All' && (
        <>
          {homeItems.map((item) => item.kind === 'banner' ? (
            <section
              className="mob-banner-carousel"
              aria-label={tr('Promotions')}
              key={item.id}
              onPointerDown={pauseBannerAutoplay}
              onPointerUp={resumeBannerAutoplaySoon}
              onPointerCancel={resumeBannerAutoplaySoon}
            >
              <div
                className="mob-banner-track"
                ref={bannerTrackRef}
                onScroll={(event) => {
                  const track = event.currentTarget
                  const step = track.clientWidth || 1
                  setActiveBannerIndex(Math.min(activeBanners.length - 1, Math.max(0, Math.round(track.scrollLeft / step))))
                }}
              >
                {activeBanners.map((banner, index) => (
                  <div className="mob-banner-slide" key={banner.id || `${banner.image}-${index}`}>
                    <img src={banner.image} alt={banner.altText || tr('Store promotion')} />
                  </div>
                ))}
              </div>
              {activeBanners.length > 1 && (
                <div className="mob-banner-pagination" aria-label={tr('Choose promotion')}>
                  {activeBanners.map((banner, index) => (
                    <button
                      key={banner.id || `${banner.image}-dot`}
                      className={index === currentBannerIndex ? 'active' : ''}
                      aria-label={`${tr('Promotion')} ${index + 1}`}
                      aria-current={index === currentBannerIndex ? 'true' : undefined}
                      onClick={() => selectBanner(index)}
                    />
                  ))}
                </div>
              )}
            </section>
          ) : (
            <section className="mob-section" key={item.id}>
              <div className="mob-section-head">
                <div>
                  <h3 className="mob-section-title">{tr(item.title)}</h3>
                  {item.subtitle && <p className="mob-section-subtitle">{tr(item.subtitle)}</p>}
                </div>
                <button className="mob-section-see-all" onClick={() => setActiveTab('search')}>{tr('See All')}</button>
              </div>
              <div className={`mob-product-grid ${item.displayStyle === 'carousel' ? 'mob-product-grid-carousel' : ''}`}>
                {item.products.map((product) => (
                  <MobileProductCard
                    key={`${item.id}-${product.id}`}
                    product={product}
                    wished={wishlist.includes(product.id)}
                    onWish={() => toggleWishlist(product.id)}
                    onAdd={() => handleAddToCart(product)}
                    onSelect={() => setViewingProduct(product)}
                    formatPrice={formatPrice}
                    language={language}
                  />
                ))}
              </div>
            </section>
          ))}
        </>
      )}

      {/* FILTERED OR SEARCH RESULTS (On Home or Explore) */}
      {(searchQuery.trim() || selectedMobileCategory !== 'All' || currentTab === 'explore') && currentTab !== 'wishlist' && currentTab !== 'cart' && currentTab !== 'account' && (
        <section className="mob-section">
          <div className="mob-section-head">
            <h3 className="mob-section-title">
              {searchQuery ? `${tr('Search Results')} (${mobileDisplayProducts.length})` : `${tr(selectedMobileCategory)} (${mobileDisplayProducts.length})`}
            </h3>
          </div>
          <div className="mob-product-grid">
            {mobileDisplayProducts.map((product) => (
              <MobileProductCard
                key={product.id}
                product={product}
                wished={wishlist.includes(product.id)}
                onWish={() => toggleWishlist(product.id)}
                onAdd={() => handleAddToCart(product)}
                onSelect={() => setViewingProduct(product)}
                formatPrice={formatPrice}
                language={language}
              />
            ))}
          </div>
          {!mobileDisplayProducts.length && (
            <div className="mob-empty-state">
              <div className="mob-empty-icon">🔍</div>
              <h4 className="mob-empty-title">{tr('No products found')}</h4>
              <p className="mob-empty-desc">{tr('Try checking your spelling or search for another category.')}</p>
              <button className="mob-btn-secondary" onClick={() => { setSearchQuery(''); setSelectedMobileCategory('All') }}>
                {tr('Reset Filters')}
              </button>
            </div>
          )}
        </section>
      )}

      {/* --------------------------------------------------------------------
         TAB 2: WISHLIST (MOBILE)
         -------------------------------------------------------------------- */}
      {currentTab === 'wishlist' && (
        <section className="mob-section">
          <div className="mob-wishlist-head">
            <h3 className="mob-section-title" style={{ fontSize: '1.25rem' }}>
              {tr('My Wishlist')} {wishlistProducts.length > 0 && `(${wishlistProducts.length})`}
            </h3>
          </div>

          {wishlistProducts.length > 0 ? (
            <div className="mob-product-grid">
              {wishlistProducts.map((product) => (
                <div key={product.id} className="mob-wishlist-card">
                  <div className="mob-wish-card-img-wrap" onClick={() => setViewingProduct(product)}>
                    <img className="mob-wish-card-img" src={product.image} alt={product.name} />
                    {product.oldPrice && (
                      <span className="mob-badge-discount">
                        -{Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)}%
                      </span>
                    )}
                    <button
                      className="mob-btn-wish active"
                      onClick={(e) => { e.stopPropagation(); toggleWishlist(product.id) }}
                      aria-label={tr('Remove from wishlist')}
                    >
                      ❤️
                    </button>
                  </div>
                  <div className="mob-wish-content">
                    <div>
                      <div className="mob-card-brand">{product.brand || 'HTOO'}</div>
                      <div className="mob-card-title">{product.name}</div>
                      <div className={`mob-wish-stock-state ${Number(product.stock) <= 0 ? 'unavailable' : ''}`}>
                        {Number(product.stock) <= 0 ? tr('Out of stock') : Number(product.stock) <= 5 ? `${tr('Low stock')} · ${product.stock}` : tr('In Stock')}
                      </div>
                      <div className="mob-card-price-row">
                        <span className="mob-card-price">{formatPrice(product.price)}</span>
                        {product.oldPrice && <span className="mob-card-old-price">{formatPrice(product.oldPrice)}</span>}
                      </div>
                    </div>
                    <div className="mob-wish-actions">
                      <button
                        className="mob-btn-move-cart"
                        disabled={Number(product.stock) <= 0}
                        onClick={() => {
                          const stock = Number(product.stock || 0)
                          const inCart = cart.filter((item) => String(item.id) === String(product.id)).reduce((sum, item) => sum + item.quantity, 0)
                          if (inCart + 1 > stock) { showToast(tr('This item is out of stock.')); return }
                          const variants = getProductVariants(product)
                          if (variants.sizes.length || variants.colors.length) {
                            setViewingProduct(product)
                            return
                          }
                          if (moveWishlistItemToCart(product.id)) showToast(tr('Moved to Cart!'))
                        }}
                      >
                        {tr('Move to Cart')}
                      </button>
                      <button
                        className="mob-btn-more"
                        onClick={() => setViewingProduct(product)}
                        title={tr('View details')}
                      >
                        ←
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mob-empty-state">
              <div className="mob-empty-icon">🤍</div>
              <h4 className="mob-empty-title">{tr('Your wishlist is empty')}</h4>
              <p className="mob-empty-desc">{tr('Explore our collections and tap the heart icon to save products you love.')}</p>
              <button className="mob-btn-primary" onClick={() => { setActiveTab('home'); setSelectedMobileCategory('All') }}>
                {tr('Discover Products')}
              </button>
            </div>
          )}
        </section>
      )}

      {/* --------------------------------------------------------------------
         TAB 3: CART (MOBILE)
         -------------------------------------------------------------------- */}
      {currentTab === 'cart' && (
        <section className="mob-cart-screen">
          <div className="mob-cart-heading">
            <h3 className="mob-section-title">{tr('Shopping Cart')} ({cartCount})</h3>
          </div>

          {cart.length > 0 ? (
            <>
              {/* Cart Items List */}
              <div className="mob-cart-list">
                {cart.map((item) => (
                  <article key={item.cartKey || item.id} className="mob-cart-card">
                    <img
                      className="mob-cart-thumb"
                      src={products.find((product) => String(product.id) === String(item.id))?.image || item.image}
                      alt={item.name}
                    />
                    <div className="mob-cart-info">
                      <div className="mob-cart-title-row">
                        <div className="mob-cart-name">{item.name}</div>
                        <button
                          className="mob-cart-remove"
                          type="button"
                          onClick={() => { removeFromCart(item.cartKey || item.id); showToast(tr('Item removed')) }}
                          aria-label={`${tr('Remove')} ${item.name}`}
                          title={tr('Remove')}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                      {(item.variants?.size || item.variants?.color) && (
                        <div className="mob-cart-variant">
                          {[item.variants.size, item.variants.color].filter(Boolean).join(' · ')}
                        </div>
                      )}
                      {getCartItemIssue(item, products.find((product) => String(product.id) === String(item.id))) && (
                        <div className="mob-cart-stock-error">
                          {tr(getCartItemIssue(item, products.find((product) => String(product.id) === String(item.id))))}
                        </div>
                      )}
                      {(() => {
                        const product = products.find((candidate) => String(candidate.id) === String(item.id))
                        const price = Number(product?.discountPrice ?? product?.price ?? item.price)
                        const stock = getProductStock(product || {}, item.variants)
                        return (
                          <>
                            <div className="mob-cart-controls-row">
                              <div className="mob-cart-stepper" aria-label={`${tr('Quantity')}: ${item.quantity}`}>
                                <button type="button" aria-label={`${tr('Decrease quantity')} ${item.name}`} disabled={item.quantity <= 1} onClick={() => updateQuantity(item.cartKey || item.id, -1)}>−</button>
                                <span aria-live="polite">{item.quantity}</span>
                                <button type="button" className="mob-cart-stepper-plus" aria-label={`${tr('Increase quantity')} ${item.name}`} disabled={item.quantity >= stock} onClick={() => updateQuantity(item.cartKey || item.id, 1)}>+</button>
                              </div>
                              <strong className="mob-cart-line-total">{formatPrice(price * item.quantity)}</strong>
                            </div>
                          </>
                        )
                      })()}
                    </div>
                  </article>
                ))}
              </div>

              {/* Coupon Row */}
              <div className="mob-coupon-card">
                <input
                  className="mob-coupon-input"
                  value={coupon}
                  onChange={(e) => setCoupon(e.target.value)}
                  placeholder={tr('Promo code')}
                />
                <button
                  className="mob-coupon-btn"
                  type="button"
                  disabled={!coupon.trim()}
                  onClick={() => {
                    if (activePromotion) showToast(tr('Promotion applied!'))
                    else showToast(tr('No active promotion matches this code'))
                  }}
                >
                  {tr('Apply')}
                </button>
              </div>
              {coupon && (
                <div className={`mob-coupon-badge ${activePromotion ? 'is-valid' : 'is-invalid'}`} role={activePromotion ? 'status' : 'alert'}>
                  {activePromotion ? `✓ ${activePromotion.name} ${tr('applied')} (−${formatPrice(couponDiscount)})` : `✗ ${tr('No active promotion matches this code')}`}
                </div>
              )}

              {/* Sticky checkout footer bar, sitting just above the bottom nav */}
              <div className="mob-cart-checkout-footer">
                <button
                  className="mob-btn-checkout"
                  type="button"
                  disabled={!cart.some((item) => item.selected !== false)}
                  onClick={() => beginCheckout('review')}
                >
                  <span className="mob-btn-checkout-label">{tr('Go to Checkout')}</span>
                  <span className="mob-btn-checkout-arrow" aria-hidden="true">→</span>
                </button>
                <div className="mob-cart-checkout-total">
                  <span className="mob-cart-checkout-total-label">{tr('Grand Total')}</span>
                  <strong className="mob-cart-checkout-total-value">{formatPrice(cartTotal)}</strong>
                </div>
              </div>
            </>
          ) : (
            <div className="mob-empty-state">
              <div className="mob-empty-icon">🔍</div>
              <h4 className="mob-empty-title">{tr('Your cart is empty')}</h4>
              <p className="mob-empty-desc">{tr('Looks like you haven’t added anything to your cart yet.')}</p>
              <button className="mob-btn-primary" onClick={() => { setActiveTab('home'); setSelectedMobileCategory('All') }}>
                {tr('Start Shopping')}
              </button>
            </div>
          )}
        </section>
      )}

      {/* --------------------------------------------------------------------
         TAB 4: ACCOUNT (MOBILE)
         -------------------------------------------------------------------- */}
      {currentTab === 'account' && (
        <section className="mob-account-screen">
          {/* Profile Header: name (with edit icon), email, phone */}
          <div className={user ? 'mob-profile-header' : 'mob-profile-header guest'}>
            <div className="mob-avatar-large">
              {user?.profileImage ? <img src={user.profileImage} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : user?.name ? user.name.charAt(0).toUpperCase() : 'G'}
            </div>
            <div className="mob-profile-info">
              <div className="mob-profile-name-row">
                <h2 className="mob-profile-name">{user?.name || tr('Guest Shopper')}</h2>
                {user && (
                  <button
                    type="button"
                    className="mob-profile-edit-btn"
                    onClick={() => setActiveAccountModal('profile')}
                    aria-label={tr('Edit profile')}
                    title={tr('Edit profile')}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
                  </button>
                )}
              </div>
              <div className="mob-profile-contact">
                <span className="mob-profile-contact-line">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 6L2 7" /></svg>
                  {user?.email || tr('No email added')}
                </span>
                <span className="mob-profile-contact-line">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.08 4.18 2 2 0 0 1 4.06 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.68 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.2a2 2 0 0 1 2.11-.45c.9.32 1.85.55 2.81.68A2 2 0 0 1 22 16.92Z" /></svg>
                  {user?.phone || tr('No phone number added')}
                </span>
              </div>
            </div>
          </div>
          {accountLinkNotice && <p className="account-link-status" role="status">{tr(accountLinkNotice)}</p>}

          {/* Account Menu List */}
          <div className="mob-menu-group">
            <button className="mob-menu-item" onClick={() => { setOrderStatusFilter('To Receive'); setActiveAccountModal('orders') }}>
              <div className="mob-menu-item-left">
                <div className="mob-menu-icon">📦</div>
                <span className="mob-menu-label">{tr('My Orders')}</span>
              </div>
              <div className="mob-menu-item-right">
                <span>{orders.length} {tr('orders')}</span>
                <span aria-hidden="true">›</span>
              </div>
            </button>

            <button className="mob-menu-item" onClick={openAddressList}>
              <div className="mob-menu-item-left">
                <div className="mob-menu-icon">📒</div>
                <span className="mob-menu-label">{tr('Address Book')}</span>
              </div>
              <div className="mob-menu-item-right">
                <span>{addressBook.length} {tr('saved')}</span>
                <span aria-hidden="true">›</span>
              </div>
            </button>

            <button
              className="mob-menu-item"
              onClick={() => {
                setActiveAccountModal('help')
                // Always show the channels the admin has configured right now.
                loadSupportChannels?.()
              }}
            >
              <div className="mob-menu-item-left">
                <div className="mob-menu-icon">💬</div>
                <span className="mob-menu-label">{language === 'my' ? 'အကူအညီ' : tr('Help')}</span>
              </div>
              <div className="mob-menu-item-right">
                <span aria-hidden="true">›</span>
              </div>
            </button>

            <button className="mob-menu-item" onClick={() => setActiveAccountModal('language')}>
              <div className="mob-menu-item-left">
                <div className="mob-menu-icon">🌐</div>
                <span className="mob-menu-label">{tr('Language')}</span>
              </div>
              <div className="mob-menu-item-right">
                <span>{language === 'my' ? tr('Myanmar') : tr('English')}</span>
                <span aria-hidden="true">›</span>
              </div>
            </button>

            {user || guestMode ? (
              <button className="mob-menu-item logout" onClick={logout}>
                <div className="mob-menu-item-left">
                  <div className="mob-menu-icon">↪</div>
                  <span className="mob-menu-label">{language === 'my' ? 'ထွက်ရန်' : tr('Log Out')}</span>
                </div>
                <div className="mob-menu-item-right">
                  <span aria-hidden="true">›</span>
                </div>
              </button>
            ) : (
              <button className="mob-menu-item" onClick={() => setRoute({ page: 'auth' })}>
                <div className="mob-menu-item-left">
                  <div className="mob-menu-icon">🔑</div>
                  <span className="mob-menu-label" style={{ color: 'var(--mob-brand)' }}>{language === 'my' ? 'အကောင့်ဝင်ရန် / အကောင့်ဖွင့်ရန်' : tr('Sign In / Register')}</span>
                </div>
                <div className="mob-menu-item-right">
                  <span aria-hidden="true">›</span>
                </div>
              </button>
            )}

            {user && (
              <button className="mob-menu-item danger" onClick={() => { setError(''); setDeleteConfirmationText(''); setDeleteConfirmationOpen(true) }}>
                <div className="mob-menu-item-left">
                  <div className="mob-menu-icon">🗑️</div>
                  <span className="mob-menu-label">{language === 'my' ? 'အကောင့်ဖျက်ရန်' : tr('Delete Account')}</span>
                </div>
                <div className="mob-menu-item-right">
                  <span aria-hidden="true">›</span>
                </div>
              </button>
            )}
          </div>

          {/* Account Settings & Support Links */}
          {user && (
            <div className="mob-account-links">
              <button className="mob-account-link" onClick={() => setActiveAccountModal('settings')}>
                <span>{tr('Account Settings')}</span>
                <span className="mob-account-link-arrow" aria-hidden="true">›</span>
              </button>
            </div>
          )}
        </section>
      )}

      {/* --------------------------------------------------------------------
         BOTTOM FIXED NAVIGATION
         -------------------------------------------------------------------- */}
      <nav className="mob-bottom-nav">
        {/* Home */}
        <button
          className={`mob-nav-item ${currentTab === 'home' ? 'active' : ''}`}
          onClick={() => { setActiveTab('home'); setSelectedMobileCategory('All') }}
        >
          <div className="mob-nav-icon-wrap">
            <svg width="22" height="22" viewBox="0 0 24 24" fill={currentTab === 'home' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <span className="mob-nav-label">{tr('Home')}</span>
        </button>

        {/* Search and category discovery */}
        <button
          className={`mob-nav-item ${currentTab === 'explore' ? 'active' : ''}`}
          onClick={() => { setActiveTab('search'); setSelectedMobileCategory('All') }}
        >
          <div className="mob-nav-icon-wrap">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-4-4" />
            </svg>
          </div>
          <span className="mob-nav-label">{tr('Search')}</span>
        </button>

        {/* Wishlist */}
        <button
          className={`mob-nav-item ${currentTab === 'wishlist' ? 'active' : ''}`}
          onClick={() => setActiveTab('wishlist')}
        >
          <div className="mob-nav-icon-wrap">
            <svg width="22" height="22" viewBox="0 0 24 24" fill={currentTab === 'wishlist' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
            </svg>
            {wishlist.length > 0 && <span className="mob-nav-badge">{wishlist.length}</span>}
          </div>
          <span className="mob-nav-label">{tr('Wishlist')}</span>
        </button>

        {/* Account */}
        <button
          className={`mob-nav-item ${currentTab === 'account' ? 'active' : ''}`}
          onClick={() => setActiveTab('account')}
        >
          <div className="mob-nav-icon-wrap">
            <svg width="22" height="22" viewBox="0 0 24 24" fill={currentTab === 'account' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <span className="mob-nav-label">{tr('Account')}</span>
        </button>
      </nav>

      {/* --------------------------------------------------------------------
         PRODUCT DETAILS MODAL / SHEET (MOBILE)
         -------------------------------------------------------------------- */}
      {viewingProduct && (
        <MobileProductDetailSheet
          key={viewingProduct.id}
          product={viewingProduct}
          products={products}
          cart={cart}
          cartCount={cartCount}
          language={language}
          wished={wishlist.includes(viewingProduct.id)}
          onClose={closeProductDetail}
          onOpenCart={() => { closeProductDetail(); setActiveTab('cart') }}
          onShare={shareProduct}
          onSelectProduct={setViewingProduct}
          onWish={() => toggleWishlist(viewingProduct.id)}
          onAddToCart={handleAddToCart}
          onBuyNow={handleBuyNow}
          formatPrice={formatPrice}
        />
      )}

      {/* --------------------------------------------------------------------
         NOTIFICATIONS DRAWER / MODAL
         -------------------------------------------------------------------- */}
      {notificationsOpen && (
        <div className="mob-sheet-overlay" onClick={() => setNotificationsOpen(false)}>
          <div className="mob-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="mob-sheet-head">
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>{tr('Store Notifications')}</h3>
              <button className="mob-icon-btn" onClick={() => setNotificationsOpen(false)} aria-label={tr('Close')}>✢</button>
            </div>
            <div className="mob-sheet-scroll" style={{ paddingBottom: '20px' }}>
              {notifications.length > 0 && (
                <button className="mob-section-see-all" onClick={() => setNotifications((current) => current.map((notification) => ({ ...notification, read: true })))}>{tr('Mark all as read')}</button>
              )}
              {notifications.map((notification) => (
                <button className={`mob-notification-card ${notification.read ? 'read' : ''}`} key={notification.id} onClick={() => setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, read: true } : item))}>
                  <strong>{tr(notification.title)}</strong>
                  <span>{tr(notification.message)}</span>
                  {!notification.read && <i aria-label="Unread" />}
                </button>
              ))}
              {notifications.length === 0 && <div className="mob-empty-state"><h4 className="mob-empty-title">{tr('No notifications')}</h4></div>}
              <button className="mob-section-see-all mob-danger-link" onClick={() => setNotifications([])}>{tr('Clear notifications')}</button>
              {promotions.length > 0 && (
                <section className="mob-notification-promos">
                  <h4>{tr('Active Promotions')}</h4>
                  {promotions.map((promotion) => <p key={promotion.code || promotion.name}><strong>{promotion.code || promotion.name}</strong> · {promotion.type === 'percentage' ? `${promotion.amount}% off` : formatPrice(promotion.amount)}</p>)}
                </section>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------
         ACCOUNT SUB-MODALS (My Orders, Addresses, Payments, etc.)
         -------------------------------------------------------------------- */}
      {activeAccountModal && (
        <div className="mob-sheet-overlay" onClick={() => setActiveAccountModal(null)}>
          <div className={`mob-sheet ${activeAccountModal === 'orders' || (activeAccountModal === 'addresses' && addressScreen === 'form') ? 'mob-sheet--orders' : ''}`} onClick={(e) => e.stopPropagation()}>
            <div className="mob-sheet-head">
              {activeAccountModal === 'orders' || activeAccountModal === 'addresses' || activeAccountModal === 'help' ? (
                <button
                  className="mob-icon-btn"
                  onClick={() => {
                    if (activeAccountModal === 'addresses' && addressScreen === 'form') {
                      setAddressScreen('list')
                      setEditingAddressId('')
                      resetAddressForm()
                      return
                    }
                    setActiveAccountModal(null)
                  }}
                  aria-label={tr('Back')}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
                </button>
              ) : null}
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>
                {activeAccountModal === 'orders' && tr('My Orders')}
                {activeAccountModal === 'addresses' && (addressScreen === 'form'
                  ? (editingAddressId ? tr('Edit Address') : tr('Add New Address'))
                  : tr('Address Book'))}
                {activeAccountModal === 'notifications' && tr('Notifications')}
                {activeAccountModal === 'settings' && tr('App Settings')}
                {activeAccountModal === 'language' && tr('Languages')}
                {activeAccountModal === 'help' && tr('Help & Customer Support')}
                {activeAccountModal === 'chat' && `Order #${selectedOrder?.orderNumber || selectedOrder?.id}`}
                {activeAccountModal === 'profile' && tr('Edit profile')}
              </h3>
              <button className="mob-icon-btn" onClick={() => setActiveAccountModal(null)} aria-label={tr('Close')}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>

            {activeAccountModal === 'orders' && (
              <div className="mob-order-tabs" role="tablist" aria-label={tr('My Orders')}>
                {orderStatusFilters.map((status) => (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={orderStatusFilter === status}
                    className={`mob-order-tab ${orderStatusFilter === status ? 'active' : ''}`}
                    key={status}
                    onClick={() => setOrderStatusFilter(status)}
                  >
                    {tr(status)}
                  </button>
                ))}
              </div>
            )}

            <div className="mob-sheet-scroll" style={{ paddingBottom: '30px' }}>
              {/* MY ORDERS SCREEN */}
              {activeAccountModal === 'orders' && (
                <div className="mob-orders-body">
                  {orders.filter((order) => matchesOrderStatus(order, orderStatusFilter)).length ? (
                    orders.filter((order) => matchesOrderStatus(order, orderStatusFilter)).map((ord) => (
                      <button
                        key={ord.id}
                        type="button"
                        className="mob-order-card mob-order-card--tappable"
                        onClick={() => openOrderDetail(ord)}
                      >
                        <div className="mob-order-header">
                          <span className="mob-order-number">#{ord.orderNumber || ord.id}</span>
                          <span className={`mob-status-pill mob-status-${(ord.status || 'new').toLowerCase()}`}>
                            {tr(ord.status || 'New')}
                          </span>
                        </div>
                        <div className="mob-order-items-preview">
                          {(ord.items || []).map((it) => `${it.name} (×${it.quantity})`).join(', ') || 'Order details'}
                        </div>
                        <div className="mob-order-footer">
                          <strong style={{ fontSize: '0.9rem', color: 'var(--mob-brand-dark)' }}>{formatPrice(ord.total)}</strong>
                          <span className="mob-order-card-chevron" aria-hidden="true">›</span>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="mob-empty-state">
                      <div className="mob-empty-icon">📦</div>
                      <h4 className="mob-empty-title">{tr(orderStatusFilter === 'Received' ? 'No received orders yet' : orderStatusFilter === 'Cancellations' ? 'No cancelled orders' : 'No orders to receive')}</h4>
                      <p className="mob-empty-desc">{tr('Your placed orders will show up here with live status updates.')}</p>
                    </div>
                  )}
                </div>
              )}

              {activeAccountModal === 'profile' && (
                <form className="mob-profile-form" onSubmit={saveProfile}>
                  <label className="mob-form-label" htmlFor="mob-profile-name">{tr('Full Name')}</label>
                  <input id="mob-profile-name" className="mob-form-input" value={profileName} onChange={(event) => setProfileName(event.target.value)} maxLength={120} required />
                  <label className="mob-form-label" htmlFor="mob-profile-phone">{tr('Phone Number')}</label>
                  <input id="mob-profile-phone" className="mob-form-input" type="tel" value={profilePhone} onChange={(event) => setProfilePhone(event.target.value)} required />
                  <p className="mob-profile-phone">{user?.email}</p>
                  {error && <p className="mob-inline-error" role="alert">{tr(error)}</p>}
                  <button className="mob-btn-primary" disabled={profileBusy}>{profileBusy ? tr('Saving…') : tr('Save changes')}</button>
                </form>
              )}

              {/* ADDRESS BOOK (LIST) */}
              {activeAccountModal === 'addresses' && addressScreen === 'list' && (
                <div className="mob-address-book">
                  {addressBook.length ? (
                    <div className="mob-address-list">
                      {addressBook.map((addr) => {
                        const regionLabel = addr.region ? (language === 'my' ? MYANMAR_REGIONS_MY[addr.region] || addr.region : addr.region) : ''
                        const townshipLabel = addr.township ? (language === 'my' ? MYANMAR_TOWNSHIP_MY[addr.township] || addr.township : addr.township) : ''
                        return (
                          <article key={addr.id} className={`mob-address-card ${addr.default ? 'is-default' : ''}`}>
                            <div className="mob-address-card-head">
                              <strong>{addr.fullName || addr.label}</strong>
                              {addr.default && <span className="mob-address-default-badge">{tr('Default')}</span>}
                            </div>
                            {addr.phone && <div className="mob-address-card-phone">{addr.phone}</div>}
                            <p className="mob-address-card-value">{addr.value}</p>
                            {regionLabel && <div className="mob-address-card-meta">{[townshipLabel, regionLabel].filter(Boolean).join(', ')}</div>}
                            {addr.mapLocation && <div className="mob-address-card-meta">📍 {addr.mapLocation}</div>}
                            <div className="mob-address-actions">
                              <button type="button" className="mob-section-see-all" onClick={() => openAddressForm(addr)}>{tr('Edit')}</button>
                              {!addr.default && (
                                <button type="button" className="mob-section-see-all" onClick={() => updateAddress(addr.id, { default: true })}>{tr('Set as Default')}</button>
                              )}
                              <button type="button" className="mob-section-see-all mob-danger-link" onClick={() => {
                                if (window.confirm(tr('Delete this saved address?'))) removeAddress(addr.id)
                              }}>{tr('Delete')}</button>
                            </div>
                          </article>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="mob-empty-state">
                      <div className="mob-empty-icon">📍</div>
                      <h4 className="mob-empty-title">{tr('No saved addresses')}</h4>
                      <p className="mob-empty-desc">{tr('Add your first delivery address to check out faster.')}</p>
                    </div>
                  )}
                  <button type="button" className="mob-btn-primary mob-address-add-btn" onClick={() => openAddressForm(null)}>
                    + {tr('Add New Address')}
                  </button>
                </div>
              )}

              {/* ADD / EDIT ADDRESS FORM */}
              {activeAccountModal === 'addresses' && addressScreen === 'form' && (
                <form className="mob-address-form" onSubmit={handleSaveAddress} noValidate>
                  <div className={`mob-form-group ${addressFormErrors.fullName ? 'has-error' : ''}`}>
                    <label className="mob-form-label" htmlFor="mob-address-fullName">{tr('Full Name')} <span className="mob-req" aria-hidden="true">*</span></label>
                    <input
                      id="mob-address-fullName"
                      className="mob-form-input"
                      autoComplete="name"
                      value={addressForm.fullName}
                      onChange={(event) => updateAddressField('fullName', event.target.value)}
                      placeholder={tr('Enter your full name')}
                      aria-required="true"
                      aria-invalid={Boolean(addressFormErrors.fullName)}
                    />
                    {addressFormErrors.fullName && <span className="mob-field-error">{tr(addressFormErrors.fullName)}</span>}
                  </div>

                  <div className={`mob-form-group ${addressFormErrors.phone ? 'has-error' : ''}`}>
                    <label className="mob-form-label" htmlFor="mob-address-phone">{tr('Phone Number')} <span className="mob-req" aria-hidden="true">*</span></label>
                    <input
                      id="mob-address-phone"
                      className="mob-form-input"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      value={addressForm.phone}
                      onChange={(event) => updateAddressField('phone', event.target.value)}
                      placeholder={tr('e.g. 09 123 456 789')}
                      aria-required="true"
                      aria-invalid={Boolean(addressFormErrors.phone)}
                    />
                    {addressFormErrors.phone && <span className="mob-field-error">{tr(addressFormErrors.phone)}</span>}
                  </div>

                  <div className={`mob-form-group ${addressFormErrors.region ? 'has-error' : ''}`}>
                    <label className="mob-form-label" htmlFor="mob-address-region">{tr('Region / State')} <span className="mob-req" aria-hidden="true">*</span></label>
                    <select
                      id="mob-address-region"
                      className="mob-form-input"
                      value={addressForm.region}
                      onChange={(event) => updateAddressField('region', event.target.value)}
                      aria-required="true"
                      aria-invalid={Boolean(addressFormErrors.region)}
                    >
                      <option value="">{tr('Select region / state')}</option>
                      {Object.keys(MYANMAR_REGIONS).map((region) => (
                        <option key={region} value={region}>{language === 'my' ? MYANMAR_REGIONS_MY[region] || region : region}</option>
                      ))}
                    </select>
                    {addressFormErrors.region && <span className="mob-field-error">{tr(addressFormErrors.region)}</span>}
                  </div>

                  <div className={`mob-form-group ${addressFormErrors.township ? 'has-error' : ''}`}>
                    <label className="mob-form-label" htmlFor="mob-address-township">{tr('Township')} <span className="mob-req" aria-hidden="true">*</span></label>
                    <select
                      id="mob-address-township"
                      className="mob-form-input"
                      value={addressForm.township}
                      onChange={(event) => updateAddressField('township', event.target.value)}
                      disabled={!addressForm.region}
                      aria-required="true"
                      aria-invalid={Boolean(addressFormErrors.township)}
                    >
                      <option value="">{addressForm.region ? tr('Select township') : tr('Select region / state first')}</option>
                      {(MYANMAR_REGIONS[addressForm.region] || []).map((township) => (
                        <option key={township} value={township}>{language === 'my' ? MYANMAR_TOWNSHIP_MY[township] || township : township}</option>
                      ))}
                    </select>
                    {addressFormErrors.township && <span className="mob-field-error">{tr(addressFormErrors.township)}</span>}
                  </div>

                  <div className={`mob-form-group ${addressFormErrors.addressLine ? 'has-error' : ''}`}>
                    <label className="mob-form-label" htmlFor="mob-address-addressLine">{tr('Full Delivery Address')} <span className="mob-req" aria-hidden="true">*</span></label>
                    <textarea
                      id="mob-address-addressLine"
                      className="mob-form-textarea"
                      autoComplete="street-address"
                      value={addressForm.addressLine}
                      onChange={(event) => updateAddressField('addressLine', event.target.value)}
                      placeholder={tr('Township, street, house number, building name, etc.')}
                      aria-required="true"
                      aria-invalid={Boolean(addressFormErrors.addressLine)}
                    />
                    {addressFormErrors.addressLine && <span className="mob-field-error">{tr(addressFormErrors.addressLine)}</span>}
                  </div>

                  <div className={`mob-form-group ${addressFormErrors.mapLocation ? 'has-error' : ''}`}>
                    <label className="mob-form-label" htmlFor="mob-address-mapLocation">{tr('Map Location Picker')} <span className="mob-req" aria-hidden="true">*</span></label>
                    <div className="mob-map-picker">
                      <div className="mob-map-picker-canvas" aria-hidden="true">
                        <svg viewBox="0 0 320 120" role="presentation">
                          <path d="M0 88 L70 62 L130 78 L190 44 L250 66 L320 38" />
                          <path d="M40 0 L58 60 L36 120" />
                          <path d="M150 0 L166 52 L142 120" />
                          <path d="M262 0 L248 58 L272 120" />
                        </svg>
                        {addressForm.mapLocation ? <span className="mob-map-picker-pin" aria-hidden="true">📍</span> : null}
                      </div>
                      <div className="mob-map-picker-row">
                        <input
                          id="mob-address-mapLocation"
                          className="mob-form-input"
                          value={addressForm.mapLocation}
                          onChange={(event) => updateAddressField('mapLocation', event.target.value)}
                          placeholder={tr('Pin location on the map')}
                          aria-required="true"
                          aria-invalid={Boolean(addressFormErrors.mapLocation)}
                        />
                        <button type="button" className="mob-map-picker-btn" onClick={pickMapLocation}>{tr('Use my location')}</button>
                      </div>
                    </div>
                    {addressFormErrors.mapLocation && <span className="mob-field-error">{tr(addressFormErrors.mapLocation)}</span>}
                  </div>

                  <label className="mob-address-default-toggle">
                    <input
                      type="checkbox"
                      checked={addressForm.isDefault}
                      onChange={(event) => updateAddressField('isDefault', event.target.checked)}
                    />
                    <span>{tr('Set as default address')}</span>
                  </label>

                  <div className="mob-address-form-actions">
                    <button type="button" className="mob-btn-secondary" onClick={() => setAddressScreen('list')}>{tr('Cancel')}</button>
                    <button type="submit" className="mob-btn-primary">
                      {editingAddressId ? tr('Save changes') : tr('Save Address')}
                    </button>
                  </div>
                </form>
              )}


              {/* NOTIFICATIONS MODAL */}
              {activeAccountModal === 'notifications' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {notifications.map((notification) => (
                    <button
                      className={`mob-notification-card ${notification.read ? 'read' : ''}`}
                      key={notification.id}
                      onClick={() => setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, read: true } : item))}
                    >
                      <strong>{tr(notification.title)}</strong>
                      <span>{tr(notification.message)}</span>
                      {!notification.read && <i aria-label="Unread" />}
                    </button>
                  ))}
                  {notifications.length === 0 && (
                    <div className="mob-empty-state">
                      <h4 className="mob-empty-title">{tr('No notifications')}</h4>
                      <p className="mob-empty-desc">{tr('Shop updates and announcements will appear here.')}</p>
                    </div>
                  )}
                  {promotions && promotions.length > 0 && (
                    <div style={{ marginTop: '0.4rem' }}>
                      <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.88rem' }}>{tr('Active Promotions')}</h4>
                      {promotions.map((promo) => (
                        <div key={promo.code || promo.name} style={{ padding: '0.75rem', background: '#fff', borderRadius: 'var(--mob-radius-md)', border: '1px solid var(--mob-line)', marginBottom: '0.5rem' }}>
                          <strong>🏷️ {tr('Code')}: {promo.code || promo.name}</strong>
                          <div style={{ fontSize: '0.78rem', color: 'var(--mob-muted)', marginTop: '0.2rem' }}>
                            {promo.type === 'percentage' ? `${promo.amount}% off` : `${formatPrice(promo.amount)} off`}{promo.minimumOrder ? ` · Min order ${formatPrice(promo.minimumOrder)}` : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* LANGUAGE MODAL */}
              {activeAccountModal === 'language' && (
                <div className="mob-language-options" role="radiogroup" aria-label={tr('Languages')}>
                  {[
                    { value: 'en', label: 'English', native: 'English', flag: 'uk' },
                    { value: 'my', label: 'Myanmar', native: 'မြန်မာ', flag: 'mm' },
                  ].map((option) => {
                    const isSelected = language === option.value
                    return (
                      <label key={option.value} className={`mob-radio-card mob-language-option ${isSelected ? 'selected' : ''}`}>
                        <input
                          type="radio"
                          name="mob-app-language"
                          value={option.value}
                          checked={isSelected}
                          onChange={() => setLanguage(option.value)}
                        />
                        <span className="mob-language-flag" aria-hidden="true">
                          {option.flag === 'uk' ? (
                            <svg viewBox="0 0 60 40" width="30" height="20">
                              <rect width="60" height="40" fill="#012169" />
                              <path d="M0 0 60 40M60 0 0 40" stroke="#fff" strokeWidth="8" />
                              <path d="M0 0 60 40M60 0 0 40" stroke="#c8102e" strokeWidth="4" />
                              <path d="M30 0v40M0 20h60" stroke="#fff" strokeWidth="13" />
                              <path d="M30 0v40M0 20h60" stroke="#c8102e" strokeWidth="8" />
                            </svg>
                          ) : (
                            <svg viewBox="0 0 60 40" width="30" height="20">
                              <rect width="60" height="40" fill="#fecb00" />
                              <rect x="20" width="20" height="40" fill="#ea2839" />
                              <rect y="13" width="60" height="14" fill="#34b233" />
                              <rect x="20" y="13" width="20" height="14" fill="#fff" />
                              <polygon points="30,17 31.9,23 38,23 33.1,26.7 35,32.7 30,29 25,32.7 26.9,26.7 22,23 28.1,23" fill="#fff" />
                            </svg>
                          )}
                        </span>
                        <div className="mob-radio-info">
                          <span className="mob-radio-title">{tr(option.label)}</span>
                          {option.native !== tr(option.label) && <span className="mob-radio-desc">{option.native}</span>}
                        </div>
                        <div className="mob-radio-circle" />
                      </label>
                    )
                  })}
                </div>
              )}

              {/* SETTINGS MODAL */}
              {activeAccountModal === 'settings' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label htmlFor="mob-language">{tr('Language')}</label>
                    <select id="mob-language" value={language} onChange={(event) => setLanguage(event.target.value)}>
                      <option value="en">ðŸ‡ºðŸ‡¸ English</option>
                      <option value="my">ðŸ‡²ðŸ‡² {tr('Myanmar')}</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{tr('Currency')}</span>
                    <strong>{tr('Myanmar Kyat (Ks)')}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{tr('Push Notifications')}</span>
                    <strong style={{ color: 'var(--mob-success)' }}>{tr('Enabled')}</strong>
                  </div>
                  {user && <>
                    <div><strong>{tr('Sign-in methods:')}</strong> {(user.authMethods || ['email']).join(', ')}</div>
                    {(!user.email || !user.emailVerified) && <div className="buyer-auth-form">
                      <p>{tr('Add a verified HTOO recovery email. HTOO will send account recovery codes only to the address you verify.')}</p>
                      <form className="buyer-auth-form" onSubmit={requestRecoveryEmail}>
                        <label className="buyer-auth-label" htmlFor="mob-recovery-email">{tr('Recovery email')}</label>
                        <input id="mob-recovery-email" className="buyer-auth-input" name="recoveryEmail" type="email" autoComplete="email" defaultValue={user.email || ''} maxLength={254} required />
                        <button className="mob-btn-primary" type="submit" disabled={authBusy}>{authBusy ? tr('Please wait…') : tr('Send verification code')}</button>
                      </form>
                      {recoveryEmailChallengeId && <form className="buyer-auth-form" onSubmit={verifyRecoveryEmail}>
                        <label className="buyer-auth-label" htmlFor="mob-recovery-otp">{tr('Email verification code')}</label>
                        <input id="mob-recovery-otp" className="buyer-auth-input" name="recoveryOtp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required />
                        <button className="mob-btn-primary" type="submit" disabled={authBusy}>{authBusy ? tr('Please wait…') : tr('Verify recovery email')}</button>
                      </form>}
                    </div>}
                    {recoveryEmailNotice && <p className="account-link-status" role="status">{tr(recoveryEmailNotice)}</p>}
                    <p className="mob-profile-phone">{tr('Linking requires you to authenticate with both accounts. Recover lost Google or Telegram access with the provider; use HTOO email-code recovery when a verified email is on the account.')}</p>
                    {accountLinkNotice && <p className="account-link-status" role="status">{tr(accountLinkNotice)}</p>}
                    {!user.authMethods?.includes('google') && <button className="mob-btn-secondary" onClick={linkGoogle}>{tr('Link Google account')}</button>}
                    {!user.authMethods?.includes('telegram') && <button className="mob-btn-secondary" onClick={linkTelegram}>{tr('Link Telegram account')}</button>}
                  </>}
                  {user && <button className="mob-danger-account" onClick={() => { setError(''); setDeleteConfirmationText(''); setDeleteConfirmationOpen(true) }}>{tr('Delete Account')}</button>}
                  <details className="mob-legal">
                    <summary>{tr('Legal & Privacy')}</summary>
                    <p>{tr('Your order history may be retained for accounting and legal obligations. Personal account details are removed after confirmed deletion.')}</p>
                  </details>
                </div>
              )}

              {/* HELP & SUPPORT */}
              {activeAccountModal === 'help' && (
                <div className="mob-support-panel">
                  <p className="mob-support-intro">
                    {tr('Reach our team on any channel below — we are happy to help with orders, payments and delivery.')}
                  </p>

                  <SupportChannelList
                    channels={supportChannels}
                    loading={supportChannelsLoading}
                    error={supportChannelsError}
                    onRetry={loadSupportChannels}
                    tr={tr}
                    onNotify={setSupportNotice}
                  />

                  <p className="sr-only" role="status" aria-live="polite">{supportNotice}</p>
                </div>
              )}

              {/* ORDER CHAT MODAL */}
              {activeAccountModal === 'chat' && selectedOrder && (
                <div>
                  <div style={{ padding: '0.75rem', background: 'var(--mob-line-light)', borderRadius: 'var(--mob-radius-md)', marginBottom: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: 800 }}>Order #{selectedOrder.orderNumber || selectedOrder.id}</span>
                      <span className={`mob-status-pill mob-status-${(selectedOrder.status || 'new').toLowerCase()}`}>
                        {selectedOrder.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--mob-muted)' }}>
                      Total: <strong>{formatPrice(selectedOrder.total)}</strong> · Payment: {selectedOrder.paymentStatus}
                    </div>
                  </div>

                  <div className="mob-order-timeline">
                    {['Pending', 'Confirmed', 'Processing', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered'].map((status) => {
                      const statusIndex = ['New', 'Pending', 'Confirmed', 'Processing', 'Packing', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered'].indexOf(selectedOrder.status)
                      const currentIndex = ['Pending', 'Confirmed', 'Processing', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered'].indexOf(status)
                      return <div key={status} className={currentIndex <= statusIndex ? 'complete' : ''}><i />{tr(status)}</div>
                    })}
                    {selectedOrder.status === 'Cancelled' && <div className="cancelled">{tr('Cancelled')}</div>}
                  </div>
                  <div className="mob-order-detail-items">
                    {(selectedOrder.items || []).map((item) => (
                      <div key={item.productId || item.id}>
                        <span>
                          {item.name} × {item.quantity}
                          {(item.variants?.size || item.variants?.color) && (
                            <small style={{ display: 'block', color: 'var(--mob-muted)' }}>
                              {[item.variants.size && `Size ${item.variants.size}`, item.variants.color && `Color ${item.variants.color}`].filter(Boolean).join(' · ')}
                            </small>
                          )}
                        </span>
                        <strong>{formatPrice(item.lineTotal ?? item.price * item.quantity)}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="mob-order-detail-items">
                    <div>{tr('Payment method')}<strong>{selectedOrder.paymentMethod || tr('Not specified')}</strong></div>
                    <div>{tr('Payment status')}<strong>{tr(selectedOrder.paymentStatus || 'Pending')}</strong></div>
                    <div>{tr('Shipping address')}<strong>{selectedOrder.customer?.address || tr('Not specified')}</strong></div>
                    <div>{tr('Delivery method')}<strong>{tr(selectedOrder.deliveryMethod || 'Not specified')}</strong></div>
                    {selectedOrder.trackingNumber && <div>{tr('Tracking number')}<strong>{selectedOrder.trackingNumber}</strong></div>}
                    <div>{tr('Subtotal')}<strong>{formatPrice(selectedOrder.subtotal || 0)}</strong></div>
                    <div>{tr('Discount')}<strong>−{formatPrice(selectedOrder.discount || 0)}</strong></div>
                    <div>{tr('Shipping fee')}<strong>{formatPrice(selectedOrder.shippingFee ?? selectedOrder.deliveryFee ?? 0)}</strong></div>
                    <div><strong>{tr('Grand Total')}</strong><strong>{formatPrice(selectedOrder.total || 0)}</strong></div>
                  </div>
                  {activeAccountModal === 'chat' && user?.id && (
                    <>
                      <h4 style={{ fontSize: '0.85rem', fontWeight: 800, margin: '0.5rem 0' }}>{tr('Chat with Shop Owner')}</h4>
                      <div className="mob-chat-thread">
                    {(orderChatData?.messages || []).length ? (
                      orderChatData.messages.map((msg) => (
                        <div key={msg.id} className={`mob-chat-bubble ${msg.senderRole === 'customer' ? 'from-customer' : 'from-admin'}`}>
                          {msg.image && <img src={msg.image} alt="" />}
                          {msg.text && <p style={{ margin: 0 }}>{msg.text}</p>}
                          <div style={{ fontSize: '0.62rem', opacity: 0.8, marginTop: '0.2rem', textAlign: 'right' }}>
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p style={{ fontSize: '0.78rem', color: 'var(--mob-muted)', textAlign: 'center', margin: '1rem 0' }}>
                        {tr('No messages yet. Send a message to chat with the shop owner about your order.')}
                      </p>
                    )}
                      </div>

                      <div className="mob-chat-input-row">
                        <input
                          className="mob-chat-input"
                          value={chatDraft}
                          onChange={(e) => setChatDraft(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                          placeholder={tr('Type a message to shop...')}
                        />
                        <button className="mob-btn-primary" style={{ padding: '0.55rem 1rem', fontSize: '0.8rem' }} onClick={sendChatMessage}>
                          {tr('Send')}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {searchSheet && (
        <div className="mob-sheet-overlay" onClick={() => setSearchSheet('')}>
          <section className="mob-sheet mob-search-sheet" role="dialog" aria-modal="true" aria-label={tr(searchSheet === 'filter' ? 'Filter' : 'Sort')} onClick={(event) => event.stopPropagation()}>
            <div className="mob-sheet-head">
              <h3>{tr(searchSheet === 'filter' ? 'Filter' : 'Sort')}</h3>
              <button className="mob-icon-btn" onClick={() => setSearchSheet('')} aria-label={tr('Close')}>✢</button>
            </div>
            {searchSheet === 'filter' ? (
              <div className="mob-sheet-scroll">
                <h4>{tr('Category')}</h4>
                <div className="mob-search-category-list">
                  {['All', '✦', 'Women', 'Kids', 'Shoes', 'Bags', 'Accessories', 'New Collection', 'Sale'].map((category) => (
                    <button key={category} className={`mob-chip ${selectedMobileCategory === category ? 'active' : ''}`} onClick={() => {
                      setSelectedMobileCategory(category)
                      setSelectedCategory?.(category === 'All' || category === 'Sale' ? '' : category)
                    }}>{tr(category)}</button>
                  ))}
                </div>
                <h4>{tr('Brand')}</h4>
                <select className="mob-form-input" value={filters?.brand || ''} onChange={(event) => setFilters({ ...filters, brand: event.target.value })}>
                  <option value="">{tr('All Brands')}</option>
                  {allBrands.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
                </select>
                <h4>{tr('Price')}</h4>
                <select className="mob-form-input" value={filters?.price || ''} onChange={(event) => setFilters({ ...filters, price: event.target.value })}>
                  <option value="">{tr('All Prices')}</option>
                  <option value="under-30">{tr('Under 30,000')}</option>
                  <option value="30-60">{tr('30,000 - 60,000')}</option>
                  <option value="over-60">{tr('Over 60,000')}</option>
                </select>
                <h4>{tr('Size')}</h4>
                <select className="mob-form-input" value={filters?.size || ''} onChange={(event) => setFilters({ ...filters, size: event.target.value })}>
                  <option value="">{tr('All sizes')}</option>
                  {availableSizes.map((size) => <option key={size} value={size}>{size}</option>)}
                </select>
                <h4>{tr('Color')}</h4>
                <select className="mob-form-input" value={filters?.color || ''} onChange={(event) => setFilters({ ...filters, color: event.target.value })}>
                  <option value="">{tr('All colors')}</option>
                  {availableColors.map((color) => <option key={color} value={color}>{color}</option>)}
                </select>
                <h4>{tr('Rating')}</h4>
                <select className="mob-form-input" value={filters?.rating || ''} onChange={(event) => setFilters({ ...filters, rating: event.target.value })}>
                  <option value="">{tr('Any rating')}</option>
                  <option value="4">{tr('4★ & up')}</option>
                  <option value="3">{tr('3★ & up')}</option>
                </select>
                <h4>{tr('Availability')}</h4>
                <select className="mob-form-input" value={filters?.availability || ''} onChange={(event) => setFilters({ ...filters, availability: event.target.value })}>
                  <option value="">{tr('Any availability')}</option>
                  <option value="in-stock">{tr('In Stock')}</option>
                  <option value="out-of-stock">{tr('Out of stock')}</option>
                </select>
                <h4>{tr('Discount')}</h4>
                <select className="mob-form-input" value={filters?.discount || ''} onChange={(event) => setFilters({ ...filters, discount: event.target.value })}>
                  <option value="">{tr('All products')}</option>
                  <option value="discounted">{tr('On sale')}</option>
                </select>
              </div>
            ) : (
              <div className="mob-sheet-scroll mob-sort-options">
                {[['relevance', 'Relevance'], ['popular', 'Popular'], ['newest', 'Newest'], ['rating', 'Top Rated'], ['price-asc', 'Price Low to High'], ['price-desc', 'Price High to Low']].map(([value, label]) => (
                  <button key={value} className={sortBy === value ? 'active' : ''} onClick={() => { setSortBy(value); setSearchSheet('') }}>{tr(label)}</button>
                ))}
              </div>
            )}
            <div className="mob-search-filter-actions">
              {searchSheet === 'filter' && (
                <button className="mob-btn-secondary" onClick={() => {
                  setFilters({ size: '', color: '', price: '', brand: '', category: '', rating: '', availability: '', material: '', style: '', discount: '' })
                  setSelectedMobileCategory('All')
                }}>{tr('Reset Filters')}</button>
              )}
              <button className="mob-btn-primary" onClick={() => setSearchSheet('')}>{tr('Apply')}</button>
            </div>
          </section>
        </div>
      )}

      {deleteConfirmationOpen && (
        <div className="mob-sheet-overlay" role="presentation" onClick={() => !deleteBusy && setDeleteConfirmationOpen(false)}>
          <section className="mob-sheet mob-delete-sheet" role="alertdialog" aria-modal="true" aria-labelledby="mob-delete-title" onClick={(event) => event.stopPropagation()}>
            <div className="mob-sheet-head">
              <h3 id="mob-delete-title">{tr('Delete Account')}?</h3>
              <button className="mob-icon-btn" disabled={deleteBusy} onClick={() => setDeleteConfirmationOpen(false)} aria-label={tr('Close')}>✢</button>
            </div>
            <p>{tr('This permanently removes your customer profile and saved account data. Your order records may be retained with personal details removed. This cannot be undone.')}</p>
            <label className="mob-form-label" htmlFor="mob-delete-confirm">{tr('Type DELETE to confirm')}</label>
            <input id="mob-delete-confirm" className="mob-form-input" value={deleteConfirmationText} onChange={(event) => setDeleteConfirmationText(event.target.value)} autoComplete="off" />
            {error && <p className="mob-inline-error" role="alert">{tr(error)}</p>}
            <div className="mob-delete-actions">
              <button className="mob-btn-secondary" disabled={deleteBusy} onClick={() => setDeleteConfirmationOpen(false)}>{tr('Cancel')}</button>
              <button className="mob-btn-danger" disabled={deleteBusy || deleteConfirmationText !== 'DELETE'} onClick={confirmDeleteAccount}>{deleteBusy ? 'Deleting…' : tr('Delete Account')}</button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

// --------------------------------------------------------------------------
// MOBILE PRODUCT CARD COMPONENT
// --------------------------------------------------------------------------
function MobileProductCard({ product, wished, onWish, onAdd, onSelect, formatPrice, language }) {
  const tr = (text) => t(text, language)
  const variants = getProductVariants(product)
  const variantRequired = variants.sizes.length > 0 || variants.colors.length > 0
  const rating = Number(product.rating) || 0
  const reviewCount = Number(product.reviewsCount) || 0
  const roundRating = Math.round(rating)
  const reviewLabel = reviewCount > 0 ? `(${reviewCount > 999 ? `${(reviewCount / 1000).toFixed(1)}k` : reviewCount})` : tr('New')
  const title = language === 'my' ? product.nameMy || product.name : product.name
  const discountPercent = product.oldPrice && product.oldPrice > product.price
    ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
    : null

  return (
    <article className={`mob-product-card${Number(product.stock) <= 0 ? ' is-sold-out' : ''}`} onClick={onSelect}>
      <div className="mob-card-img-wrap">
        <img className="mob-card-img" src={product.image} alt={title} loading="lazy" />

        {/* Tags layered over the lower-left of the image */}
        <div className="mob-card-badges">
          {discountPercent ? <span className="mob-card-tag mob-card-tag--discount">{discountPercent}% OFF</span> : null}
          {!discountPercent && (product.isBestSeller || roundRating === 5) ? <span className="mob-card-tag mob-card-tag--best">{tr('Best Seller')}</span> : null}
          {Number(product.stock) <= 0 ? <span className="mob-card-tag mob-card-tag--muted">{tr('Sold out')}</span> : null}
        </div>

        {/* Wishlist Button */}
        <button
          type="button"
          className={`mob-card-heart ${wished ? 'is-active' : ''}`}
          onClick={(e) => { e.stopPropagation(); onWish() }}
          aria-pressed={wished}
          aria-label={`${tr(wished ? 'Remove from wishlist' : 'Add to wishlist')}: ${title}`}
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill={wished ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
          </svg>
        </button>

        {/* In Stock Badge */}
        {product.stock > 0 && product.stock <= 5 && (
          <span className="mob-badge-stock">{product.stock} left</span>
        )}
      </div>

      <div className="mob-card-content">
        <h4 className="mob-card-title">{title}</h4>

        <div className="mob-card-price-row">
          <span className="mob-card-price">{formatPrice(product.price)}</span>
          {product.oldPrice ? <span className="mob-card-old-price">{formatPrice(product.oldPrice)}</span> : null}
        </div>

        <div className="mob-card-foot">
          <div className="mob-card-rating" aria-label={`${rating.toFixed(1)} / 5, ${reviewLabel}`}>
            <span className="mob-card-stars" aria-hidden="true">
              {[0, 1, 2, 3, 4].map((index) => (
                <svg key={index} viewBox="0 0 24 24" width="10" height="10" fill={index < roundRating ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
                  <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z" />
                </svg>
              ))}
            </span>
            <span className="mob-card-reviews">{reviewLabel}</span>
          </div>

          <AddToCartButton
            className="mob-card-add-btn"
            productName={title}
            language={language}
            disabled={Number(product.stock) <= 0}
            onClick={variantRequired ? onSelect : onAdd}
          />
          </div>
        </div>
    </article>
  )
}

// --------------------------------------------------------------------------
// MOBILE PRODUCT DETAIL SHEET COMPONENT
// --------------------------------------------------------------------------
function MobileProductDetailSheet({ product, products, cart, cartCount, wished, onClose, onOpenCart, onShare, onSelectProduct, onWish, onAddToCart, onBuyNow, formatPrice, language }) {
  const tr = (text) => t(text, language)
  const images = (Array.isArray(product.images) && product.images.length ? product.images : [product.image]).filter(Boolean)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const supportedVariants = getProductVariants(product)
  const sizes = supportedVariants.sizes || []
  const colors = supportedVariants.colors || []
  const [selectedSize, setSelectedSize] = useState('')
  const [selectedColor, setSelectedColor] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [recentlyViewedIds] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('hto_recently_viewed') || '[]')
      return Array.isArray(stored) ? stored : []
    } catch (storageError) {
      console.warn('[catalog] Could not read recently viewed products.', storageError)
      return []
    }
  })
  const touchStartX = useRef(null)
  const unitPrice = Number(product.price) || 0
  const totalPrice = unitPrice * quantity
  const originalPrice = Number(product.oldPrice)
  const hasDiscount = Number.isFinite(originalPrice) && originalPrice > unitPrice
  const discountPercent = hasDiscount ? Math.round(((originalPrice - unitPrice) / originalPrice) * 100) : 0
  const selectedImage = images[selectedImageIndex] || ''
  const needsVariantSelection = (sizes.length > 0 && !selectedSize) || (colors.length > 0 && !selectedColor)
  const selectedVariants = {
    ...(selectedSize ? { size: selectedSize } : {}),
    ...(selectedColor ? { color: selectedColor } : {})
  }
  const stock = hasVariantStock(product) && !needsVariantSelection
    ? getProductStock(product, selectedVariants)
    : Math.max(0, Number(product.stock) || 0)
  const quantityInCart = cartQuantityForVariants(selectedVariants)
  const remainingStock = Math.max(0, stock - quantityInCart)
  const canPurchase = !needsVariantSelection && remainingStock > 0 && quantity <= remainingStock
  const recentlyViewedProducts = recentlyViewedIds
    .filter((id) => String(id) !== String(product.id))
    .map((id) => products.find((item) => String(item.id) === String(id)))
    .filter(Boolean)
    .slice(0, 6)

  useEffect(() => {
    const next = [String(product.id), ...recentlyViewedIds.filter((id) => String(id) !== String(product.id))].slice(0, 12)
    try { localStorage.setItem('hto_recently_viewed', JSON.stringify(next)) } catch (storageError) {
      console.warn('[catalog] Could not save recently viewed products.', storageError)
    }
  }, [product.id, recentlyViewedIds])

  function changeImage(index) {
    if (images.length < 2) return
    setSelectedImageIndex((index + images.length) % images.length)
  }

  function handleGalleryTouchStart(event) {
    touchStartX.current = event.touches[0]?.clientX ?? null
  }

  function handleGalleryTouchEnd(event) {
    if (touchStartX.current === null || images.length < 2) return
    const delta = (event.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current
    if (Math.abs(delta) > 40) changeImage(selectedImageIndex + (delta < 0 ? 1 : -1))
    touchStartX.current = null
  }

  function cartQuantityForVariants(variants) {
    return cart.filter((item) => String(item.id) === String(product.id) &&
      (!hasVariantStock(product) || variantStockKey(item.variants) === variantStockKey(variants)))
      .reduce((total, item) => total + Number(item.quantity || 0), 0)
  }

  function selectVariant(type, value) {
    const nextVariants = {
      ...(type === 'size' ? { size: value } : selectedSize ? { size: selectedSize } : {}),
      ...(type === 'color' ? { color: value } : selectedColor ? { color: selectedColor } : {})
    }
    const complete = (!sizes.length || nextVariants.size) && (!colors.length || nextVariants.color)
    if (complete && hasVariantStock(product)) {
      const available = Math.max(0, getProductStock(product, nextVariants) - cartQuantityForVariants(nextVariants))
      setQuantity((current) => Math.max(1, Math.min(current, available || 1)))
    }
    if (type === 'size') setSelectedSize(value)
    else setSelectedColor(value)
  }

  return (
    <div className="mob-sheet-overlay mob-product-detail-overlay" onClick={onClose}>
      <div className="mob-sheet mob-product-detail" role="dialog" aria-modal="true" aria-labelledby="mob-detail-title" onClick={(event) => event.stopPropagation()}>
        <header className="mob-detail-topbar">
          <button className="mob-detail-icon-button" onClick={onClose} aria-label={tr('Back')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /><path d="M9 12h11" /></svg>
          </button>
          <span className="mob-detail-brandmark">HTOO</span>
          <button className="mob-detail-icon-button mob-detail-cart-button" onClick={onOpenCart} aria-label={`${tr('Open cart')}${cartCount ? `, ${cartCount} ${tr('items')}` : ''}`}>
            <CartIcon count={cartCount} />
          </button>
        </header>

        <div className="mob-sheet-scroll mob-detail-scroll">
          <section className="mob-detail-gallery" aria-label={tr('Product images')}>
            <div
              className="mob-detail-hero-img-wrap"
              onTouchStart={handleGalleryTouchStart}
              onTouchEnd={handleGalleryTouchEnd}
            >
              {selectedImage
                ? <img className="mob-detail-hero-img" src={selectedImage} alt={product.name} />
                : <div className="mob-detail-image-placeholder" role="img" aria-label={tr('Product image unavailable')}>HTOO</div>}
              {hasDiscount && <span className="mob-detail-discount">-{discountPercent}%</span>}
              {images.length > 1 && (
                <>
                  <button
                    className="mob-detail-gallery-nav previous"
                    onClick={() => changeImage(selectedImageIndex - 1)}
                    aria-label={tr('Previous image')}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m15 18-6-6 6-6" />
                    </svg>
                  </button>
                  <button
                    className="mob-detail-gallery-nav next"
                    onClick={() => changeImage(selectedImageIndex + 1)}
                    aria-label={tr('Next image')}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </button>
                  <span className="mob-detail-image-count" aria-live="polite">{selectedImageIndex + 1}/{images.length}</span>
                </>
              )}
              <button className={`mob-detail-wishlist ${wished ? '❤️' : '🤍'}`} onClick={onWish} aria-label={wished ? tr('Remove from wishlist') : tr('Add to wishlist')}>
          {wished ? '❤️' : '🤍'}
              </button>
            </div>
            {images.length > 1 && (
              <div className="mob-detail-thumbs" aria-label={tr('Choose product image')}>
                {images.map((image, index) => (
                  <button
                    key={`${image}-${index}`}
                    className={`mob-detail-thumb ${selectedImageIndex === index ? 'active' : ''}`}
                    onClick={() => changeImage(index)}
                    aria-label={`${tr('Product image')} ${index + 1}`}
                    aria-current={selectedImageIndex === index ? 'true' : undefined}
                  >
                    <img src={image} alt="" />
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="mob-detail-product-info">
            <div className="mob-detail-eyebrow-row">
              <div className="mob-detail-eyebrow">{product.brand || 'HTOO'}{product.category ? ` · ${product.category}` : ''}</div>
              <button className="mob-detail-share" onClick={() => onShare(product)} aria-label={tr('Share product')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                  <path d="m8.6 10.7 6.8-4.4m-6.8 7 6.8 4.3" />
                </svg>
              </button>
            </div>
            <h1 className="mob-detail-title" id="mob-detail-title">{language === 'my' ? product.nameMy || product.name : product.name}</h1>
            <div className="mob-detail-price-row">
              <div className="mob-detail-prices">
                <strong className="mob-detail-price">{formatPrice(unitPrice)}</strong>
                {hasDiscount && <del className="mob-detail-old-price">{formatPrice(originalPrice)}</del>}
              </div>
              {Number(product.rating) > 0 && <span className="mob-detail-rating">★ {Number(product.rating).toFixed(1)}</span>}
            </div>
            <p className={`mob-detail-stock ${stock > 0 ? 'available' : 'unavailable'}`}>
              <span aria-hidden="true" />
              {needsVariantSelection && hasVariantStock(product)
                ? `${tr('Choose options')} · ${Math.max(0, Number(product.stock) || 0)} ${tr('available')}`
                : stock > 0 ? `${tr('In Stock')} · ${stock} ${tr('available')}` : tr('Out of stock')}
            </p>
            {product.sku && <p className="mob-detail-sku">{tr('Product code')}: {product.sku}</p>}
            <p className="mob-detail-description">
              {(language === 'my' ? product.descriptionMy : product.description) || tr('No product description provided.')}
            </p>
            {(product.material || product.subcategory) && (
              <div className="mob-detail-meta">
                {product.subcategory && <span>{product.subcategory}</span>}
                {product.material && <span>{tr('Materials')}: {product.material}</span>}
              </div>
            )}
          </section>

          {colors.length > 0 && (
            <section className="mob-detail-choice">
              <div className="mob-detail-choice-heading"><strong>{tr('Color')}</strong><span>{selectedColor || tr('Choose a color')}</span></div>
              <div className="mob-detail-options mob-detail-colors">
                {colors.map((color) => (
                  <button key={color} className={`mob-option-chip ${selectedColor === color ? 'active' : ''}`} onClick={() => selectVariant('color', color)} aria-pressed={selectedColor === color}>
                    <span className="mob-color-swatch" style={{ backgroundColor: color }} aria-hidden="true" />
                    {color}
                  </button>
                ))}
              </div>
            </section>
          )}

          {sizes.length > 0 && (
            <section className="mob-detail-choice">
              <div className="mob-detail-choice-heading"><strong>{tr('Size')}</strong><span>{selectedSize || tr('Choose a size')}</span></div>
              <div className="mob-detail-options">
                {sizes.map((size) => (
                  <button key={size} className={`mob-option-chip mob-size-chip ${selectedSize === size ? 'active' : ''}`} onClick={() => selectVariant('size', size)} aria-pressed={selectedSize === size}>
                    {size}
                  </button>
                ))}
              </div>
            </section>
          )}

          {stock > 0 && (
            <section className="mob-detail-quantity">
              <div><strong>{tr('Quantity')}</strong><span>{tr('Total')}: {formatPrice(totalPrice)}</span></div>
              <div className="mob-stepper" aria-label={tr('Quantity')}>
                <button className="mob-stepper-btn" disabled={quantity <= 1} onClick={() => setQuantity((current) => Math.max(1, current - 1))} aria-label={tr('Decrease quantity')}>−</button>
                <output className="mob-stepper-value">{quantity}</output>
                <button className="mob-stepper-btn" disabled={quantity >= remainingStock} onClick={() => setQuantity((current) => Math.min(remainingStock, current + 1))} aria-label={tr('Increase quantity')}>+</button>
              </div>
            </section>
          )}

          {product.careInformation && (
            <section className="mob-detail-extra">
              <h2>{tr('Care information')}</h2>
              <p>{product.careInformation}</p>
            </section>
          )}

          {Number(product.reviewsCount) > 0 && (
            <section className="mob-detail-extra">
              <h2>{tr('Customer reviews')}</h2>
              <p>{Number(product.rating) > 0 ? `★ ${Number(product.rating).toFixed(1)} · ` : ''}{product.reviewsCount} {tr('customer reviews')}</p>
            </section>
          )}

          {products.some((item) => String(item.id) !== String(product.id) && item.category === product.category) && (
            <section className="mob-detail-related">
              <h2>{tr('You may also like')}</h2>
              <div className="mob-related-products">
                {products.filter((item) => String(item.id) !== String(product.id) && item.category === product.category).slice(0, 6).map((item) => (
                  <button key={item.id} onClick={() => onSelectProduct(item)}>
                    <img src={item.image} alt="" />
                    <span>{item.name}</span>
                    <strong>{formatPrice(item.price)}</strong>
                  </button>
                ))}
              </div>
            </section>
          )}

          {recentlyViewedProducts.length > 0 && (
            <section className="mob-detail-related">
              <h2>{tr('Recently viewed')}</h2>
              <div className="mob-related-products">
                {recentlyViewedProducts.map((item) => (
                  <button key={item.id} onClick={() => onSelectProduct(item)}>
                    <img src={item.image} alt="" />
                    <span>{item.name}</span>
                    <strong>{formatPrice(item.price)}</strong>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>

        <footer className="mob-detail-action-bar">
          <div className="mob-detail-action-total">
            <span>{tr('Total')}</span>
            <strong>{formatPrice(totalPrice)}</strong>
          </div>
          <button
            className="mob-detail-add-cart"
            disabled={!canPurchase}
            onClick={() => onAddToCart(product, selectedVariants, quantity)}
            aria-label={tr('Add selected product to cart')}
          >
            <CartIcon />
          </button>
          <button
            className="mob-detail-buy-now"
            disabled={!canPurchase}
            onClick={() => onBuyNow(product, selectedVariants, quantity)}
          >
            {stock <= 0 ? tr('Out of stock') : needsVariantSelection ? tr('Choose options') : remainingStock <= 0 ? tr('Already in cart') : tr('Buy Now')}
          </button>
        </footer>
      </div>
    </div>
  )
}
