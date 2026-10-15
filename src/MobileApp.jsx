import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import './Mobile.css'
import BuyerAuth from './BuyerAuth'
import { t } from './lib/i18n'
import { AddToCartButton, CartIcon } from './CartControls'
import { getProductStock, getProductVariants, hasVariantStock, variantStockKey } from './lib/productVariants'

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

function getSupportHref(value) {
  const link = String(value || '').trim()
  return /^(https?:\/\/|viber:\/\/|tg:\/\/|tel:)/i.test(link) || /^\/(?!\/)/.test(link) ? link : ''
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
  submitAuth,
  continueAsGuest,
  addToCart,
  updateQuantity,
  removeFromCart,
  updateCartItem,
  toggleWishlist,
  saveSearch,
  moveWishlistItemToCart,
  addAddress,
  updateAddress,
  removeAddress,
  deleteAccount,
  updateProfile,
  _validateCheckoutStep,
  handlePaymentSlip,
  placeOrder,
  logout,
  CATEGORY_TREE,
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
  const [newAddressInput, setNewAddressInput] = useState('')
  const [newAddressLabel, setNewAddressLabel] = useState('Home')
  const [editingAddressId, setEditingAddressId] = useState('')
  const [savedForLater, setSavedForLater] = useState(() => {
    try { return JSON.parse(localStorage.getItem('hto_saved_for_later') || '[]') } catch { return [] }
  })
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false)
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [orderStatusFilter, setOrderStatusFilter] = useState('All')
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
  const unreadNotifications = notifications.filter((notification) => !notification.read).length
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
    try {
      localStorage.setItem('hto_saved_for_later', JSON.stringify(savedForLater))
    } catch (storageError) {
      console.warn('[cart] Could not persist cart selections.', storageError)
    }
  }, [savedForLater])

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
    const shareUrl = new URL('/', window.location.origin)
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
  const orderStatusFilters = ['All', 'Pending', 'Confirmed', 'Processing', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled']
  const matchesOrderStatus = (order, status) => {
    const currentStatus = String(order.status || '').toLowerCase()
    if (status === 'Pending') return ['new', 'pending'].includes(currentStatus)
    if (status === 'Processing') return ['processing', 'packing'].includes(currentStatus)
    return status === 'All' || currentStatus === status.toLowerCase()
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
    beginCheckout()
  }

  function handleAddNewAddress(e) {
    e.preventDefault()
    if (!newAddressInput.trim() || !addAddress) return
    if (editingAddressId) {
      updateAddress(editingAddressId, { label: newAddressLabel, value: newAddressInput.trim() })
      setEditingAddressId('')
      showToast(tr('Address updated.'))
    } else {
      addAddress({ label: newAddressLabel, value: newAddressInput.trim(), default: addressBook.length === 0 })
      showToast(tr('New address saved!'))
    }
    setNewAddressInput('')
  }

  function saveCartItemForLater(item) {
    const key = item.cartKey || item.id
    setSavedForLater((current) => [...current.filter((saved) => (saved.cartKey || saved.id) !== key), item])
    removeFromCart(key)
    showToast(tr('Saved for later.'))
  }

  async function confirmDeleteAccount() {
    if (deleteConfirmationText !== 'DELETE') return
    setDeleteBusy(true)
    try {
      await deleteAccount()
      setNotifications([])
      setSavedForLater([])
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

  // Mobile Order Placement with loading state
  async function handleMobilePlaceOrder() {
    setIsSubmittingOrder(true)
    try {
      await placeOrder()
    } catch (submitError) {
      console.error('[checkout] Mobile place-order handler failed', submitError)
      const detail = submitError?.message || String(submitError)
      setError(import.meta.env.DEV
        ? `Unable to place order: ${detail}`
        : 'Unable to place order. Please check your payment slip and try again.')
    } finally {
      setIsSubmittingOrder(false)
    }
  }

  // Active payment account details
  const accountNumber = selectedPaymentAccount?.type === 'bank' || selectedPaymentAccount?.id === 'bank'
    ? selectedPaymentAccount?.accountNumber
    : selectedPaymentAccount?.phoneNumber

  // --------------------------------------------------------------------------
  // ONBOARDING / LAUNCH SCREEN (MOBILE)
  // --------------------------------------------------------------------------
  if (route.page === 'launch') {
    return (
      <main className="mobile-shell mob-confirm-screen">
        <div className="mob-confirm-card" style={{ marginTop: '2rem' }}>
          <img src="/logo.svg" alt="" style={{ width: '56px', height: '56px', display: 'block', margin: '0 auto 1.25rem' }} />
          <span className="mob-hero-badge">HTOO ONLINE SHOP</span>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0.5rem 0', color: 'var(--mob-ink)' }}>{tr('Dress Better.')}<br />{tr('Live Brighter.')}</h1>
          <label className="mob-launch-language">
            <span>{language === 'my' ? '🇲🇲' : '🇺🇸'} {tr('Language')}</span>
            <select value={language} onChange={(event) => setLanguage(event.target.value)}>
              <option value="my">🇲🇲 မြန်မာ</option>
              <option value="en">🇺🇸 English</option>
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
                💬 View Order & Chat with Shop
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
    const selectedDelivery = DELIVERY_METHODS.find((m) => m.id === checkoutForm.deliveryMethod)
    function validateMobileStep(step) {
      if (!cart.length || !cart.some((item) => item.selected !== false)) return 'Select at least one available item to continue.'
      const unavailableItem = cart.find((item) => item.selected !== false && (products.find((product) => String(product.id) === String(item.id))?.stock ?? 0) < item.quantity)
      if (unavailableItem) return tr('This item has insufficient stock. Update the quantity or remove it to continue.')
      const invalidVariantItem = cart.find((item) => {
        if (item.selected === false) return false
        const product = products.find((candidate) => String(candidate.id) === String(item.id))
        return product && !hasValidCartVariants(item, product)
      })
      if (invalidVariantItem) return tr('A selected size or color is no longer available. Remove this item and add an available option to continue.')
      if (step === 1) {
        if (!checkoutForm.name.trim()) return 'Enter your full name.'
        if (!checkoutForm.phone.trim()) return 'Enter your phone number.'
        if (!/^(?:\+?95|0)\d{7,13}$/.test(checkoutForm.phone.replace(/[\s()-]/g, ''))) return 'Enter a valid phone number.'
        if (!checkoutForm.shippingAddress.trim()) return 'Enter your complete delivery address.'
      }
      if (step === 2 && !checkoutForm.deliveryMethod) return 'Select a delivery method.'
      if (step === 3 && !selectedPaymentAccount) return 'Select an active payment method.'
      if (step === 4 && !isCashPayment && !paymentSlip) return 'Upload your payment slip to continue.'
      return ''
    }
    return (
      <main className="mobile-shell mob-checkout-screen">
        {/* Header */}
        <div className="mob-checkout-header">
          <button className="mob-back-btn" onClick={() => { setError(''); setRoute({ page: 'main' }) }}>
            <span style={{ fontSize: '1.1rem' }}>‹</span> {tr('Back to Cart')}
          </button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.95rem', fontWeight: 800 }}>{tr('Checkout')}</div>
            <small style={{ fontSize: '0.72rem', color: 'var(--mob-muted)' }}>{tr('Step')} {checkoutStep} of 5</small>
          </div>
          <div style={{ width: '40px' }} />
        </div>

        {/* Progress Bar */}
        <div className="mob-steps-track">
          {[1, 2, 3, 4, 5].map((s) => (
            <div key={s} className={`mob-step-bar ${checkoutStep >= s ? 'active' : ''}`} />
          ))}
        </div>

        {/* Step 1: Customer Info & Address */}
        {checkoutStep === 1 && (
          <div className="mob-checkout-card">
            <h3>1. {tr('Customer Information')}</h3>
            <p className="mob-checkout-card-sub">{tr('Enter your delivery details for accurate shipping.')}</p>
            {addressBook.length > 0 && (
              <div className="mob-form-group">
                <label className="mob-form-label">{tr('Use a saved address')}</label>
                <select className="mob-form-input" value="" onChange={(event) => {
                  const address = addressBook.find((item) => item.id === event.target.value)
                  if (address) setCheckoutForm({ ...checkoutForm, shippingAddress: address.value, name: checkoutForm.name || user?.name || '', phone: checkoutForm.phone || user?.phone || '' })
                }}>
                  <option value="">{tr('Choose a saved address')}</option>
                  {addressBook.map((address) => <option key={address.id} value={address.id}>{address.label}{address.default ? ' · Default' : ''}</option>)}
                </select>
              </div>
            )}

            <div className="mob-form-group">
              <label className="mob-form-label">{tr('Full Name *')}</label>
              <input
                className="mob-form-input"
                autoComplete="name"
                required
                value={checkoutForm.name}
                onChange={(e) => setCheckoutForm({ ...checkoutForm, name: e.target.value })}
                placeholder={tr('e.g. Mg Mg')}
              />
            </div>

            <div className="mob-form-group">
              <label className="mob-form-label">{tr('Phone Number *')}</label>
              <input
                className="mob-form-input"
                autoComplete="tel"
                type="tel"
                required
                value={checkoutForm.phone}
                onChange={(e) => setCheckoutForm({ ...checkoutForm, phone: e.target.value })}
                placeholder="09xxxxxxxxx"
              />
            </div>

            {!user?.email && (
              <div className="mob-form-group">
                <label className="mob-form-label">{tr('Email (optional)')}</label>
                <input
                  className="mob-form-input"
                  type="email"
                  autoComplete="email"
                  value={checkoutForm.email || ''}
                  onChange={(event) => setCheckoutForm({ ...checkoutForm, email: event.target.value })}
                  placeholder={tr('Email address')}
                />
              </div>
            )}

            <div className="mob-form-group">
              <label className="mob-form-label">{tr('Township (optional)')}</label>
              <input
                className="mob-form-input"
                autoComplete="address-level3"
                value={checkoutForm.township || ''}
                onChange={(event) => setCheckoutForm({ ...checkoutForm, township: event.target.value })}
                placeholder={tr('Township')}
              />
            </div>

            <div className="mob-form-group">
              <label className="mob-form-label">{tr('City / Region (optional)')}</label>
              <input
                className="mob-form-input"
                autoComplete="address-level2"
                value={checkoutForm.city || ''}
                onChange={(event) => setCheckoutForm({ ...checkoutForm, city: event.target.value })}
                placeholder={tr('City or region')}
              />
            </div>

            <div className="mob-form-group">
              <label className="mob-form-label">{tr('Delivery Address *')}</label>
              <textarea
                className="mob-form-textarea"
                autoComplete="street-address"
                required
                value={checkoutForm.shippingAddress}
                onChange={(e) => setCheckoutForm({ ...checkoutForm, shippingAddress: e.target.value })}
                placeholder={tr('House / street, township, city/region, delivery notes')}
              />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', marginTop: '0.5rem' }}>
              <input
                type="checkbox"
                checked={checkoutForm.saveAddress}
                onChange={(e) => setCheckoutForm({ ...checkoutForm, saveAddress: e.target.checked })}
              /> {tr('Save this address for future orders')}
            </label>
          </div>
        )}

        {/* Step 2: Delivery Method */}
        {checkoutStep === 2 && (
          <div className="mob-checkout-card">
            <h3>2. {tr('Delivery Method')}</h3>
            <p className="mob-checkout-card-sub">{tr('Choose how you want to receive your items.')}</p>

            {DELIVERY_METHODS.map((method) => {
              const isSelected = checkoutForm.deliveryMethod === method.id
              const isCarGate = method.id === 'cargate'
              return (
                <label key={method.id} className={`mob-radio-card ${isSelected ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="deliveryMethod"
                    checked={isSelected}
                    onChange={() => setCheckoutForm({ ...checkoutForm, deliveryMethod: method.id })}
                  />
                  <div className="mob-radio-info">
                    <span className="mob-radio-title">{tr(method.label)}</span>
                    <span className="mob-radio-desc">
                      {isCarGate
                        ? `Pickup fee: ${formatPrice(settings.carGatePickupFee)}`
                        : tr('Door-to-door standard city delivery')}
                    </span>
                  </div>
                  <div className="mob-radio-circle" />
                </label>
              )
            })}
          </div>
        )}

        {/* Step 3: Payment Method (ACTIVE accounts from shop owner) */}
        {checkoutStep === 3 && (
          <div className="mob-checkout-card">
            <h3>3. {tr('Payment Method')}</h3>
            <p className="mob-checkout-card-sub">{tr('Select from the shop owner’s active payment options.')}</p>

            {paymentMethods.length > 0 ? (
              paymentMethods.map((payment) => {
                const isSelected = selectedPaymentAccount?.id === payment.id
                return (
                  <label key={payment.id} className={`mob-radio-card ${isSelected ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="paymentAccount"
                      value={payment.id}
                      checked={isSelected}
                      onChange={() => {
                        setCheckoutForm({ ...checkoutForm, paymentAccountId: payment.id })
                        setPaymentSlip('')
                        setError('')
                      }}
                    />
                    <div className="mob-radio-info">
                      <span className="mob-radio-title">{language === 'my' ? payment.nameMyanmar || payment.name : payment.name}</span>
                      <span className="mob-radio-desc">
                        {payment.id === 'cod' || payment.type === 'cash'
                          ? tr('Pay cash upon delivery')
                          : `${payment.accountName || 'Active account'}${payment.phoneNumber ? ` · ${payment.phoneNumber}` : ''}${payment.bankName ? ` · ${payment.bankName}` : ''}`}
                      </span>
                    </div>
                    <div className="mob-radio-circle" />
                  </label>
                )
              })
            ) : (
              <div className="mob-empty-desc" style={{ color: 'var(--mob-danger)', margin: '1rem 0' }}>
                {tr('No active payment accounts are configured. Please contact the shop owner.')}
              </div>
            )}

            {/* Selected payment account details card */}
            {selectedPaymentAccount && (
              <div className="mob-payment-detail-box">
                <div className="mob-payment-detail-head">
                  <div>
                    <span style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--mob-brand)', textTransform: 'uppercase' }}>{tr('Selected Account')}</span>
                    <h4 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }}>{language === 'my' ? selectedPaymentAccount.nameMyanmar || selectedPaymentAccount.name : selectedPaymentAccount.name}</h4>
                  </div>
                  <strong style={{ fontSize: '1.05rem', color: 'var(--mob-brand-dark)' }}>{formatPrice(cartTotal)}</strong>
                </div>

                {isCashPayment ? (
                  <p style={{ fontSize: '0.82rem', color: 'var(--mob-ink-light)', margin: '0.5rem 0' }}>
                    💵 {tr('Cash on Delivery: Please have the exact payment ready when your delivery arrives.')} {formatPrice(cartTotal)}
                  </p>
                ) : (
                  <>
                    {selectedPaymentAccount.accountName && (
                      <div className="mob-payment-detail-row">
                        <span>{tr('Account Name')}</span>
                        <strong>{selectedPaymentAccount.accountName}</strong>
                      </div>
                    )}
                    {selectedPaymentAccount.type === 'bank' || selectedPaymentAccount.id === 'bank' ? (
                      <>
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
                      </>
                    ) : (
                      selectedPaymentAccount.phoneNumber && (
                        <div className="mob-payment-detail-row">
                          <span>{tr('Phone Number')}</span>
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            <strong>{selectedPaymentAccount.phoneNumber}</strong>
                            <button className="mob-copy-btn" onClick={() => copyToClipboard(selectedPaymentAccount.phoneNumber)}>
                              {copiedText ? tr('Copied') : tr('Copy')}
                            </button>
                          </div>
                        </div>
                      )
                    )}

                    {selectedPaymentAccount.qrCode && (
                      <div className="mob-qr-preview">
                        <img src={selectedPaymentAccount.qrCode} alt={`${selectedPaymentAccount.name} QR Code`} />
                        <small style={{ fontSize: '0.72rem', color: 'var(--mob-muted)' }}>{tr('Scan QR code with your mobile banking app')}</small>
                      </div>
                    )}

                    <div style={{ fontSize: '0.74rem', color: 'var(--mob-muted)', marginTop: '0.6rem', lineHeight: 1.4 }}>
                      ⚠️ Transfer the exact amount <strong>{formatPrice(cartTotal)}</strong>, then upload the receipt screenshot in the next step.
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 4: Payment Slip */}
        {checkoutStep === 4 && (
          <div className="mob-checkout-card">
            <h3>4. {tr('Payment Slip')}</h3>
            <p className="mob-checkout-card-sub">{tr('Upload a screenshot or photo of your transfer receipt.')}</p>

            {isCashPayment ? (
              <div style={{ padding: '1rem', background: 'var(--mob-line-light)', borderRadius: 'var(--mob-radius-md)', textAlign: 'center' }}>
                <span style={{ fontSize: '1.5rem' }}>💵</span>
                <p style={{ fontSize: '0.86rem', fontWeight: 700, margin: '0.5rem 0 0.2rem' }}>{tr('No Slip Required')}</p>
                <p style={{ fontSize: '0.76rem', color: 'var(--mob-muted)' }}>{tr('You chose Cash on Delivery. Simply continue to review your order.')}</p>
              </div>
            ) : (
              <div className="mob-slip-box">
                {paymentSlip ? (
                  <>
                    <div className="mob-slip-preview-wrap">
                      <img src={paymentSlip} alt={tr('Payment slip')} />
                    </div>
                    <div className="mob-slip-actions">
                      <label className="mob-slip-upload-label">
                        <span>{tr('Replace Slip')}</span>
                        <input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" onChange={handlePaymentSlip} />
                      </label>
                      <button className="mob-btn-secondary" style={{ padding: '0.65rem 1rem' }} onClick={() => setPaymentSlip('')}>
                        {tr('Remove')}
                      </button>
                    </div>
                    <small style={{ fontSize: '0.72rem', color: 'var(--mob-success)', fontWeight: 700 }}>✓ {tr('Receipt attached successfully')}</small>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: '2rem', color: 'var(--mob-brand)' }}>📷</div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 800 }}>{tr('Upload Payment Slip')}</div>
                    <p style={{ fontSize: '0.76rem', color: 'var(--mob-muted)', margin: 0 }}>
                      {tr('Take a photo or choose from gallery.')}<br />{tr('JPG, JPEG, PNG, or WebP (up to 5 MB)')}
                    </p>
                    <label className="mob-slip-upload-label">
                      <span>{tr('Choose Image')}</span>
                      <input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" onChange={handlePaymentSlip} />
                    </label>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 5: Review & Place Order */}
        {checkoutStep === 5 && (
          <div className="mob-checkout-card">
            <h3>5. {tr('Review & Place Order')}</h3>
            <p className="mob-checkout-card-sub">{tr('Verify your order details before final submission.')}</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.82rem' }}>
              <div style={{ padding: '0.65rem', background: 'var(--mob-line-light)', borderRadius: 'var(--mob-radius-md)' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--mob-muted)', textTransform: 'uppercase' }}>{tr('Delivery Info')}</span>
                <div><strong>{checkoutForm.name}</strong> · {checkoutForm.phone}</div>
                <div style={{ color: 'var(--mob-ink-light)' }}>{checkoutForm.shippingAddress}</div>
                <div style={{ marginTop: '0.2rem', color: 'var(--mob-brand)' }}>{tr(selectedDelivery?.label || '')}</div>
              </div>

              <div style={{ padding: '0.65rem', background: 'var(--mob-line-light)', borderRadius: 'var(--mob-radius-md)' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--mob-muted)', textTransform: 'uppercase' }}>{tr('Payment Details')}</span>
                <div><strong>{selectedPaymentAccount?.name}</strong></div>
                {accountNumber && <div>{accountNumber} ({selectedPaymentAccount?.accountName})</div>}
                <div>{tr('Amount')}: <strong>{formatPrice(cartTotal)}</strong></div>
                {paymentSlip && (
                  <div style={{ marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <img src={paymentSlip} alt={tr('Payment slip')} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} />
                    <span style={{ color: 'var(--mob-success)', fontWeight: 700 }}>{tr('Payment slip uploaded')}</span>
                  </div>
                )}
              </div>

              <div>
                <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--mob-muted)', textTransform: 'uppercase' }}>{tr('Items')} ({cart.filter((item) => item.selected !== false).length})</span>
                {cart.filter((item) => item.selected !== false).map((item) => {
                  const product = products.find((candidate) => String(candidate.id) === String(item.id))
                  const price = Number(product?.discountPrice ?? product?.price ?? item.price)
                  return (
                    <div key={item.cartKey || item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid var(--mob-line-light)' }}>
                      <span>{item.name} × {item.quantity}</span>
                      <strong>{formatPrice(price * item.quantity)}</strong>
                    </div>
                  )
                })}
              </div>

              <div style={{ paddingTop: '0.5rem' }}>
                <div className="mob-summary-row"><span>{tr('Subtotal')}</span><strong>{formatPrice(cartSubtotal)}</strong></div>
                <div className="mob-summary-row"><span>{tr('Delivery Fee')}</span><strong>{formatPrice(deliveryFee)}</strong></div>
                {couponDiscount > 0 && <div className="mob-summary-row discount"><span>{tr('Discount')}</span><strong>−{formatPrice(couponDiscount)}</strong></div>}
                <div className="mob-summary-divider" />
                <div className="mob-summary-row mob-summary-total"><span>{tr('Total to Pay')}</span><strong>{formatPrice(cartTotal)}</strong></div>
              </div>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div style={{ background: 'var(--mob-danger-light)', color: 'var(--mob-danger)', padding: '0.75rem', borderRadius: 'var(--mob-radius-md)', fontSize: '0.8rem', fontWeight: 600, marginBottom: '1rem' }}>
            {tr(error)}
          </div>
        )}

        {/* Bottom Actions for Checkout */}
        <div className="mob-checkout-nav-bar">
          <button
            className="mob-btn-secondary"
            disabled={checkoutStep === 1}
            onClick={() => { setError(''); setCheckoutStep((s) => Math.max(1, s - 1)) }}
          >
            {tr('Previous')}
          </button>
          {checkoutStep < 5 ? (
            <button
              className="mob-btn-primary"
              onClick={() => {
                const msg = validateMobileStep(checkoutStep)
                if (msg) { setError(tr(msg)); return }
                setError('')
                setCheckoutStep((s) => Math.min(5, s + 1))
              }}
            >
              {tr('Continue')}
            </button>
          ) : (
            <button
              className="mob-btn-primary"
              disabled={isSubmittingOrder || !cart.length || !selectedPaymentAccount || (!isCashPayment && !paymentSlip)}
              onClick={handleMobilePlaceOrder}
            >
              {isSubmittingOrder ? tr('Placing Order...') : `${tr('Place Order')} · ${formatPrice(cartTotal)}`}
            </button>
          )}
        </div>
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
              <img className="mob-logo-image" src="/logo.svg" alt="" aria-hidden="true" />
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
          {currentTab === 'explore' && !searchQuery.trim() && selectedMobileCategory === 'All' && (
            <div className="mob-search-discovery">
              <strong>{tr('Popular searches')}</strong>
              <div className="mob-search-discovery-chips">
                {['New Collection', 'Shoes', 'Bags', 'Sale'].map((term) => (
                  <button key={term} className="mob-chip" onClick={() => {
                    if (['New Collection', 'Sale'].includes(term)) setSelectedMobileCategory(term)
                    else setSearchQuery(term === 'Bags' ? 'bag' : term.slice(0, -1))
                  }}>{tr(term)}</button>
                ))}
              </div>
            </div>
          )}
          {/* Recent Searches */}
          {recentSearches && recentSearches.length > 0 && (
            <div className="mob-recent-searches">
              <div className="mob-recent-searches-head">
                <small>{tr('Recent searches')}</small>
                <button onClick={() => setRecentSearches?.([])}>{tr('Clear')}</button>
              </div>
              <div className="mob-search-discovery-chips">
                {recentSearches.map((term) => (
                  <button key={term} className="mob-chip" onClick={() => setSearchQuery(term)}>{term}</button>
                ))}
              </div>
            </div>
          )}

          {/* Subcategories */}
          {selectedMobileCategory !== 'All' && selectedMobileCategory !== 'Sale' && CATEGORY_TREE?.[selectedMobileCategory] && (
            <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', marginBottom: '0.75rem', scrollbarWidth: 'none' }}>
              {CATEGORY_TREE[selectedMobileCategory].map((sub) => (
                <span key={sub} style={{ fontSize: '0.74rem', padding: '0.22rem 0.65rem', background: '#fff', border: '1px solid var(--mob-line)', borderRadius: '999px', whiteSpace: 'nowrap', color: 'var(--mob-ink-light)' }}>
                  {sub}
                </span>
              ))}
            </div>
          )}

          {/* Sort & Filter Controls on Explore */}
          {currentTab === 'explore' && (
            <div className="mob-search-tools">
              <button className="mob-chip" onClick={() => setSearchSheet('filter')}>{tr('Filter')} · {tr(selectedMobileCategory)}</button>
              <button className="mob-chip" onClick={() => setSearchSheet('sort')}>{tr('Sort')}</button>
              {(filters?.brand || filters?.price || sortBy !== 'popular') && (
                <button className="mob-chip" onClick={() => { setFilters({ ...filters, brand: '', price: '' }); setSortBy('popular') }}>{tr('Clear')}</button>
              )}
            </div>
          )}

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
                        ↗
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
            {cart.length > 0 && <p>{tr('Review your selected pieces before checkout.')}</p>}
          </div>

          {cart.length > 0 ? (
            <>
              <label className="mob-cart-select-all">
                <input
                  type="checkbox"
                  className="mob-cart-checkbox"
                  checked={cart.every((item) => item.selected !== false)}
                  onChange={(event) => {
                    const selected = event.target.checked
                    cart.forEach((item) => updateCartItem(item.cartKey || item.id, { selected }))
                  }}
                />
                <span>{tr('Select all')}</span>
                <span className="mob-cart-selected-count">{cart.filter((item) => item.selected !== false).length} {tr('selected')}</span>
              </label>
              {/* Cart Items List */}
              <div className="mob-cart-list">
                {cart.map((item) => (
                  <article key={item.cartKey || item.id} className="mob-cart-card" data-selected={item.selected !== false}>
                    <input
                      className="mob-cart-checkbox"
                      type="checkbox"
                      aria-label={`${tr('Select')} ${item.name}`}
                      checked={item.selected !== false}
                      onChange={() => {
                        const key = item.cartKey || item.id
                        const selected = item.selected === false
                        updateCartItem(key, { selected })
                      }}
                    />
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
                            <div className="mob-cart-pricing">
                              <span className="mob-cart-price">{formatPrice(price)}</span>
                              <strong>{formatPrice(price * item.quantity)}</strong>
                            </div>
                            <div className="mob-cart-controls-row">
                              <div className="mob-cart-stepper" aria-label={`${tr('Quantity')}: ${item.quantity}`}>
                                <button type="button" aria-label={`${tr('Decrease quantity')} ${item.name}`} disabled={item.quantity <= 1} onClick={() => updateQuantity(item.cartKey || item.id, -1)}>−</button>
                                <span aria-live="polite">{item.quantity}</span>
                                <button type="button" className="mob-cart-stepper-plus" aria-label={`${tr('Increase quantity')} ${item.name}`} disabled={item.quantity >= stock} onClick={() => updateQuantity(item.cartKey || item.id, 1)}>+</button>
                              </div>
                              <button className="mob-save-later" type="button" onClick={() => saveCartItemForLater(item)}>{tr('Save for later')}</button>
                            </div>
                          </>
                        )
                      })()}
                    </div>
                  </article>
                ))}
              </div>

              {savedForLater.length > 0 && (
                <div className="mob-saved-later">
                  <h4>{tr('Saved for later')} ({savedForLater.length})</h4>
                  {savedForLater.map((item) => (
                    <div className="mob-saved-later-row" key={item.cartKey || item.id}>
                      <span>{item.name} · {formatPrice(item.price)}</span>
                      <button className="mob-section-see-all" onClick={() => {
                        const product = products.find((candidate) => String(candidate.id) === String(item.id))
                        if (!product) { showToast(tr('This product is no longer available.')); return }
                        handleAddToCart({ ...product, selectedVariants: item.variants }, item.variants, item.quantity)
                        setSavedForLater((current) => current.filter((saved) => (saved.cartKey || saved.id) !== (item.cartKey || item.id)))
                      }}>{tr('Move to Cart')}</button>
                    </div>
                  ))}
                </div>
              )}

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

              {/* Order Summary Card */}
              <div className="mob-order-summary-card">
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800 }}>{tr('Order Summary')}</h4>
                <div className="mob-summary-row"><span>{tr('Subtotal')}</span><strong>{formatPrice(cartSubtotal)}</strong></div>
                <div className="mob-summary-row"><span>{tr('Delivery Fee')}</span><strong>{formatPrice(deliveryFee)}</strong></div>
                {couponDiscount > 0 && (
                  <div className="mob-summary-row discount"><span>{tr('Discount')}</span><strong>−{formatPrice(couponDiscount)}</strong></div>
                )}
                <div className="mob-summary-divider" />
                <div className="mob-summary-row mob-summary-total"><span>{tr('Total')}</span><strong>{formatPrice(cartTotal)}</strong></div>
              </div>

              {/* Sticky Bottom Bar */}
              <div className="mob-sticky-checkout-bar">
                <div className="mob-checkout-total-col">
                  <small>{tr('Total Price')}</small>
                  <strong>{formatPrice(cartTotal)}</strong>
                </div>
                <button className="mob-btn-checkout" disabled={!cart.some((item) => item.selected !== false)} onClick={() => {
                  if (!cart.some((item) => item.selected !== false)) { showToast(tr('Select at least one item to continue.')); return }
                  beginCheckout()
                }}>
                  <span>{tr('Proceed to Checkout')}</span>
                  <span>→</span>
                </button>
              </div>
            </>
          ) : (
            <div className="mob-empty-state">
              <div className="mob-empty-icon">🛍️</div>
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
          {/* User Profile Card */}
          <div className="mob-profile-card">
            <div className="mob-avatar-large">
              {user?.profileImage ? <img src={user.profileImage} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : user?.name ? user.name.charAt(0).toUpperCase() : 'G'}
            </div>
            <div className="mob-profile-info">
              <div className="mob-profile-name">{user?.name || tr('Guest Shopper')}</div>
              <div className="mob-profile-phone">{user?.email || user?.phone || tr('Not signed in')}</div>
              {user?.phone && user?.email && <div className="mob-profile-phone">{user.phone}</div>}
              {user?.email && <div className="mob-profile-phone">{tr(user.emailVerified ? 'Email verified' : 'Email not verified')}</div>}
              <span className="mob-profile-tier">{tr(user ? 'VIP Member' : 'Guest Account')}</span>
              {user && <button className="mob-section-see-all" onClick={() => setActiveAccountModal('profile')}>{tr('Edit profile')}</button>}
            </div>
          </div>
          {accountLinkNotice && <p className="account-link-status" role="status">{tr(accountLinkNotice)}</p>}

          {/* Account Menu Groups */}
          <div className="mob-menu-group">
            {user && <button className="mob-menu-item" onClick={logout}>
              <div className="mob-menu-item-left">
                <div className="mob-menu-icon">↪</div>
                <span className="mob-menu-label">{tr('Log out')}</span>
              </div>
              <div className="mob-menu-item-right"><span>›</span></div>
            </button>}
            <button className="mob-menu-item" onClick={() => setActiveAccountModal('orders')}>
              <div className="mob-menu-item-left">
                <div className="mob-menu-icon">📦</div>
                <span className="mob-menu-label">{tr('My Orders')}</span>
              </div>
              <div className="mob-menu-item-right">
                <span>{orders.length} {tr('orders')}</span>
                <span>›</span>
              </div>
            </button>

            <button className="mob-menu-item" onClick={() => setActiveAccountModal('addresses')}>
              <div className="mob-menu-item-left">
                <div className="mob-menu-icon">📍</div>
                <span className="mob-menu-label">{tr('My Addresses')}</span>
              </div>
              <div className="mob-menu-item-right">
                <span>{addressBook.length} {tr('saved')}</span>
                <span>›</span>
              </div>
            </button>

            <button className="mob-menu-item" onClick={() => setActiveTab('wishlist')}>
              <div className="mob-menu-item-left">
                <div className="mob-menu-icon">❤️</div>
                <span className="mob-menu-label">{tr('Wishlist')}</span>
              </div>
              <div className="mob-menu-item-right">
                <span>{wishlist.length} {tr('items')}</span>
                <span>›</span>
              </div>
            </button>

          </div>

          <div className="mob-menu-group">
            <button className="mob-menu-item" onClick={() => setNotificationsOpen(true)} aria-label={`${tr('Notifications')} (${unreadNotifications})`}>
              <div className="mob-menu-item-left">
                <div className="mob-menu-icon">🔔</div>
                <span className="mob-menu-label">{tr('Notifications & Deals')}</span>
              </div>
              <div className="mob-menu-item-right">
                <span>›</span>
              </div>
            </button>

            <button className="mob-menu-item" onClick={() => setActiveAccountModal('settings')}>
              <div className="mob-menu-item-left">
                <div className="mob-menu-icon">⚙️</div>
                <span className="mob-menu-label">{tr('Settings')}</span>
              </div>
              <div className="mob-menu-item-right">
                <span>›</span>
              </div>
            </button>

            <button className="mob-menu-item" onClick={() => setActiveAccountModal('help')}>
              <div className="mob-menu-item-left">
                <div className="mob-menu-icon">💬</div>
                <span className="mob-menu-label">{tr('Help & Support')}</span>
              </div>
              <div className="mob-menu-item-right">
                <span>›</span>
              </div>
            </button>
          </div>

          <div className="mob-menu-group">
            {user || guestMode ? (
              <button className="mob-menu-item logout" onClick={logout}>
                <div className="mob-menu-item-left">
                  <div className="mob-menu-icon">🚪</div>
                  <span className="mob-menu-label">{tr('Log Out')}</span>
                </div>
                <div className="mob-menu-item-right">
                  <span>›</span>
                </div>
              </button>
            ) : (
              <button className="mob-menu-item" onClick={() => setRoute({ page: 'auth' })}>
                <div className="mob-menu-item-left">
                  <div className="mob-menu-icon">🔑</div>
                  <span className="mob-menu-label" style={{ color: 'var(--mob-brand)' }}>{tr('Sign In / Register')}</span>
                </div>
                <div className="mob-menu-item-right">
                  <span>›</span>
                </div>
              </button>
            )}
          </div>
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

        {/* Cart */}
        <button
          className={`mob-nav-item ${currentTab === 'cart' ? 'active' : ''}`}
          onClick={() => setActiveTab('cart')}
          aria-label={`${tr('Open cart')}${cartCount ? `, ${cartCount} ${tr('items')}` : ''}`}
        >
          <div className="mob-nav-icon-wrap">
            <CartIcon count={cartCount} />
          </div>
          <span className="mob-nav-label">{tr('Cart')}</span>
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
          <span className="mob-nav-label">{tr('Profile')}</span>
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
              <button className="mob-icon-btn" onClick={() => setNotificationsOpen(false)} aria-label={tr('Close')}>✕</button>
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
          <div className="mob-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="mob-sheet-head">
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>
                {activeAccountModal === 'orders' && tr('My Orders')}
                {activeAccountModal === 'addresses' && tr('Saved Delivery Addresses')}
                {activeAccountModal === 'notifications' && tr('Notifications')}
                {activeAccountModal === 'settings' && tr('App Settings')}
                {activeAccountModal === 'help' && tr('Help & Customer Support')}
                {activeAccountModal === 'chat' && `Order #${selectedOrder?.orderNumber || selectedOrder?.id}`}
                {activeAccountModal === 'profile' && tr('Edit profile')}
              </h3>
              <button className="mob-icon-btn" onClick={() => setActiveAccountModal(null)} aria-label={tr('Close')}>✕</button>
            </div>

            <div className="mob-sheet-scroll" style={{ paddingBottom: '30px' }}>
              {/* ORDERS MODAL */}
              {activeAccountModal === 'orders' && (
                <div>
                  {orders.length > 0 && (
                    <div className="mob-order-status-tabs">
                      {orderStatusFilters.map((status) => (
                        <button className={`mob-chip ${orderStatusFilter === status ? 'active' : ''}`} key={status} onClick={() => setOrderStatusFilter(status)}>{tr(status)}</button>
                      ))}
                    </div>
                  )}

                  {orders.filter((order) => matchesOrderStatus(order, orderStatusFilter)).length ? (
                    orders.filter((order) => matchesOrderStatus(order, orderStatusFilter)).map((ord) => (
                      <div key={ord.id} className="mob-order-card">
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
                          <button
                            className="mob-btn-secondary"
                            style={{ padding: '0.35rem 0.8rem', fontSize: '0.75rem' }}
                            onClick={() => loadOrderChat(ord)}
                          >
                            {tr('Details & Chat 💬')}
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="mob-empty-state">
                      <div className="mob-empty-icon">📦</div>
                      <h4 className="mob-empty-title">{tr('No orders yet')}</h4>
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

              {/* ADDRESSES MODAL */}
              {activeAccountModal === 'addresses' && (
                <div>
                  <form onSubmit={handleAddNewAddress} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem', padding: '0.85rem', background: 'var(--mob-line-light)', borderRadius: 'var(--mob-radius-md)' }}>
                    <strong style={{ fontSize: '0.85rem' }}>{editingAddressId ? tr('Edit') : `+ ${tr('Add New Address')}`}</strong>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <select
                        style={{ padding: '0.45rem', fontSize: '0.8rem', borderRadius: 'var(--mob-radius-md)', border: '1px solid var(--mob-line)', background: '#fff' }}
                        value={newAddressLabel}
                        onChange={(e) => setNewAddressLabel(e.target.value)}
                      >
                        <option value="Home">{tr('Home address')}</option>
                        <option value="Office">{tr('Office')}</option>
                        <option value="Other">{tr('Other')}</option>
                      </select>
                      <input
                        style={{ flex: 1, padding: '0.45rem 0.75rem', fontSize: '0.8rem', borderRadius: 'var(--mob-radius-md)', border: '1px solid var(--mob-line)', background: '#fff' }}
                        placeholder={tr('Street, township, city')}
                        value={newAddressInput}
                        onChange={(e) => setNewAddressInput(e.target.value)}
                        required
                      />
                    </div>
                    <button className="mob-btn-primary" style={{ padding: '0.5rem', fontSize: '0.8rem' }} type="submit">
                      {editingAddressId ? tr('Save changes') : tr('Save Address')}
                    </button>
                  </form>

                  {addressBook.length ? (
                    addressBook.map((addr) => (
                      <div key={addr.id} style={{ padding: '0.85rem', background: 'var(--mob-line-light)', borderRadius: 'var(--mob-radius-md)', marginBottom: '0.65rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                          <strong>{addr.label}</strong>
                          {addr.default ? (
                            <span style={{ fontSize: '0.7rem', color: 'var(--mob-success)', fontWeight: 700 }}>{tr('Default')}</span>
                          ) : (
                            <button
                              style={{ background: 'none', border: 'none', color: 'var(--mob-brand)', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                              onClick={() => updateAddress(addr.id, { default: true })}
                            >
                              {tr('Set as Default')}
                            </button>
                          )}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--mob-ink-light)' }}>{addr.value}</div>
                        <div className="mob-address-actions">
                          <button type="button" className="mob-section-see-all" onClick={() => {
                            setEditingAddressId(addr.id)
                            setNewAddressLabel(addr.label || 'Home')
                            setNewAddressInput(addr.value || '')
                          }}>{tr('Edit')}</button>
                          <button type="button" className="mob-section-see-all mob-danger-link" onClick={() => {
                            if (window.confirm(tr('Delete this saved address?'))) removeAddress(addr.id)
                          }}>{tr('Delete')}</button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="mob-empty-state">
                      <div className="mob-empty-icon">📍</div>
                      <h4 className="mob-empty-title">{tr('No saved addresses')}</h4>
                      <p className="mob-empty-desc">{tr('Addresses entered during checkout will be safely saved here.')}</p>
                    </div>
                  )}
                </div>
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

              {/* SETTINGS MODAL */}
              {activeAccountModal === 'settings' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label htmlFor="mob-language">{tr('Language')}</label>
                    <select id="mob-language" value={language} onChange={(event) => setLanguage(event.target.value)}>
                      <option value="en">🇺🇸 English</option>
                      <option value="my">🇲🇲 {tr('Myanmar')}</option>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.85rem' }}>
                  {supportChannels
                    .filter((channel) => channel.status === 'Active' || channel.enabled === true)
                    .sort((first, second) => (first.sortOrder || 0) - (second.sortOrder || 0))
                    .map((channel) => {
                      const contactLink = getSupportHref(channel.link || channel.contact)
                      return (
                        <div key={channel.id} className="mob-support-channel">
                          <div className="mob-support-channel-copy">
                            <strong>{channel.channel || channel.name}</strong>
                            {channel.accountName && <span>{channel.accountName}</span>}
                            {channel.username && <span>{channel.username}</span>}
                            {channel.description && <p>{channel.description}</p>}
                          </div>
                          {contactLink
                            ? <a href={contactLink} target="_blank" rel="noopener noreferrer">{tr('Contact / Open')}</a>
                            : <span className="mob-support-unavailable">{tr('Contact details unavailable')}</span>}
                        </div>
                      )
                    })}
                  {supportChannels.filter((channel) => channel.status === 'Active' || channel.enabled === true).length === 0 && (
                    <div className="mob-empty-state">
                      <h4 className="mob-empty-title">{tr('No support channels available')}</h4>
                      <p className="mob-empty-desc">{tr('Please check back later for shop contact options.')}</p>
                    </div>
                  )}
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
                  {user?.id && (
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
              <button className="mob-icon-btn" onClick={() => setSearchSheet('')} aria-label={tr('Close')}>✕</button>
            </div>
            {searchSheet === 'filter' ? (
              <div className="mob-sheet-scroll">
                <h4>{tr('Category')}</h4>
                <div className="mob-search-category-list">
                  {['All', 'Men', 'Women', 'Kids', 'Shoes', 'Bags', 'Accessories', 'New Collection', 'Sale'].map((category) => (
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
              <button className="mob-icon-btn" disabled={deleteBusy} onClick={() => setDeleteConfirmationOpen(false)} aria-label={tr('Close')}>✕</button>
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
  const discountPercent = product.oldPrice && product.oldPrice > product.price
    ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
    : null

  return (
    <article className="mob-product-card" onClick={onSelect}>
      <div className="mob-card-img-wrap">
        <img className="mob-card-img" src={product.image} alt={product.name} loading="lazy" />

        {/* Discount Badge */}
        {discountPercent ? (
          <span className="mob-badge-discount">-{discountPercent}%</span>
        ) : product.category === 'Sale' ? (
          <span className="mob-badge-discount">{tr('SALE')}</span>
        ) : null}

        {/* Wishlist Button */}
        <button
          className={`mob-btn-wish ${wished ? 'active' : ''}`}
          onClick={(e) => { e.stopPropagation(); onWish() }}
          aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          {wished ? '❤️' : '🤍'}
        </button>

        {/* In Stock Badge */}
        {product.stock > 0 && product.stock <= 5 && (
          <span className="mob-badge-stock">{product.stock} left</span>
        )}
        {product.stock <= 0 && (
          <span className="mob-badge-stock mob-badge-sold-out">{tr('Out of stock')}</span>
        )}
      </div>

      <div className="mob-card-content">
        <div>
          <div className="mob-card-brand">{product.brand || 'HTOO'}</div>
          <h4 className="mob-card-title">{language === 'my' ? product.nameMy || product.name : product.name}</h4>

          {/* Rating */}
          <div className="mob-card-rating">
            {Number(product.rating) > 0 ? (
              <>
                <span className="mob-star-icon">★</span>
                <span>{Number(product.rating).toFixed(1)}</span>
              </>
            ) : <span>{tr('No ratings yet')}</span>}
          </div>

          {/* Price */}
          <div className="mob-card-price-row">
            <span className="mob-card-price">{formatPrice(product.price)}</span>
            {product.oldPrice && <span className="mob-card-old-price">{formatPrice(product.oldPrice)}</span>}
          </div>
        </div>

        {/* Quick Add Button */}
        <AddToCartButton
          className="mob-card-add-btn"
          productName={product.name}
          language={language}
          disabled={Number(product.stock) <= 0}
          onClick={variantRequired ? onSelect : onAdd}
        />
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
              <button className={`mob-detail-wishlist ${wished ? 'active' : ''}`} onClick={onWish} aria-label={wished ? tr('Remove from wishlist') : tr('Add to wishlist')}>
                {wished ? '♥' : '♡'}
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
