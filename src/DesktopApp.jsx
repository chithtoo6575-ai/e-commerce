import { useEffect, useMemo, useRef, useState } from 'react'
import BuyerAuth from './BuyerAuth'
import { AddToCartButton } from './CartControls'
import SupportChannelList from './SupportChannelList'
import { getProductStock, getProductVariants } from './lib/productVariants'
import { t } from './lib/i18n'
import { assetUrl } from './lib/baseUrl.js'

export default function DesktopApp({
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
  loginTelegram,
  recoveryEmailChallengeId,
  recoveryEmailNotice,
  requestRecoveryEmail,
  verifyRecoveryEmail,
  authBusy,
  authNotice,
  resetCustomerPassword,
  user,
  guestMode,
  products,
  cart,
  wishlist,
  activeTab,
  setActiveTab,
  selectedCategory,
  setSelectedCategory,
  searchQuery,
  setSearchQuery,
  recentSearches,
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
  _promotions,
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
  cartShippingWeightKg,
  updateCartItem,
  deliveryFee,
  selectedPaymentAccount,
  isCashPayment,
  activePromotion,
  couponDiscount,
  cartTotal,
  beginCheckout,
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
  validateCheckoutStep,
  handlePaymentSlip,
  placeOrder,
  logout,
  MAIN_TABS,
  CATEGORY_TREE,
  storefrontCategories = [],
  DELIVERY_METHODS,
  storefrontHelpItems = [],
  getDeliveryTrackingUrl,
  formatPrice,
  storefrontBanners = [],
  supportChannels = [],
  supportChannelsLoading = false,
  supportChannelsError = '',
  loadSupportChannels,
  language = 'en',
  setLanguage = () => {}
}) {
  const tr = (text) => t(text, language)
  const activeBanners = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return (storefrontBanners || [])
      .map((banner) => ({
        ...banner,
        image: banner.image || banner.image_url || banner.imageUrl || '',
      }))
      .filter((banner) => banner.enabled !== false && banner.image && (!banner.startDate || banner.startDate.slice(0, 10) <= today) && (!banner.endDate || banner.endDate.slice(0, 10) >= today))
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
  }, [storefrontBanners])
  const [activeBannerIndex, setActiveBannerIndex] = useState(0)
  const [desktopBannerPosition, setDesktopBannerPosition] = useState(1)
  const [desktopBannerNoTransition, setDesktopBannerNoTransition] = useState(false)
  const [desktopBannerDragging, setDesktopBannerDragging] = useState(false)
  const [desktopBannerDragOffset, setDesktopBannerDragOffset] = useState(0)
  const [desktopBannerAutoplayPaused, setDesktopBannerAutoplayPaused] = useState(false)
  const desktopBannerTrackRef = useRef(null)
  const desktopBannerDragRef = useRef(null)
  const desktopBannerResumeRef = useRef(0)
  const suppressDesktopBannerClickRef = useRef(false)
  // Screen-reader announcement after a support channel is opened.
  const [supportNotice, setSupportNotice] = useState('')
  const [editingAddressId, setEditingAddressId] = useState('')
  const [addressDraft, setAddressDraft] = useState({ fullName: '', phone: '', addressLine: '', township: '', region: '', default: false })
  const [viewingProduct, setViewingProduct] = useState(null)
  const [isDesktopViewport, setIsDesktopViewport] = useState(() => window.matchMedia?.('(min-width: 768px)')?.matches ?? true)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false)
  const categoryNames = Object.keys(CATEGORY_TREE || {})
  const activeCategory = selectedCategory || categoryNames[0] || ''
  const imageForCategory = (category) =>
    storefrontCategories.find((item) => item.name === category)?.image ||
    products.find((product) => product.category === category && product.image)?.image ||
    assetUrl('appliance-placeholder.svg')
  const cartCount = cart.reduce((count, item) => count + Number(item.quantity || 0), 0)
  const featuredProducts = products.filter((product) => product.featured).slice(0, 4)
  const bestSellerProducts = products.filter((product) => product.isBestSeller)
    .sort((first, second) => Number(second.salesCount || 0) - Number(first.salesCount || 0))
    .slice(0, 4)
  const homeProductSections = [
    { title: 'Featured Products', products: featuredProducts.length ? featuredProducts : products.slice(0, 4) },
    { title: 'Deals & Offers', products: products.filter((product) => Number(product.oldPrice) > Number(product.price)).slice(0, 4) },
    { title: 'New Arrivals', products: products.slice().reverse().slice(0, 4) },
    { title: 'Best Sellers', products: bestSellerProducts },
    { title: 'Recommended For You', products: products.slice(1, 5) }
  ].filter((section) => section.products.length)

  useEffect(() => {
    const desktopQuery = window.matchMedia('(min-width: 768px)')
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updateMediaPreferences = () => {
      setIsDesktopViewport(desktopQuery.matches)
      setPrefersReducedMotion(reducedMotionQuery.matches)
    }
    desktopQuery.addEventListener('change', updateMediaPreferences)
    reducedMotionQuery.addEventListener('change', updateMediaPreferences)
    return () => {
      desktopQuery.removeEventListener('change', updateMediaPreferences)
      reducedMotionQuery.removeEventListener('change', updateMediaPreferences)
    }
  }, [])

  const currentBannerIndex = activeBanners.length ? activeBannerIndex % activeBanners.length : 0

  useEffect(() => {
    setActiveBannerIndex(0)
    setDesktopBannerPosition(1)
  }, [activeBanners.length])

  useEffect(() => () => window.clearTimeout(desktopBannerResumeRef.current), [])

  useEffect(() => {
    if (route.page !== 'main' || activeTab !== 'home' || !isDesktopViewport || desktopBannerAutoplayPaused || activeBanners.length < 2) return
    const timer = window.setInterval(() => {
      setActiveBannerIndex((index) => ((index % activeBanners.length) + 1) % activeBanners.length)
      setDesktopBannerPosition((position) => {
        if (currentBannerIndex === activeBanners.length - 1) return prefersReducedMotion ? 1 : activeBanners.length + 1
        return position + 1
      })
    }, 4000)
    return () => window.clearInterval(timer)
  }, [route.page, activeTab, isDesktopViewport, desktopBannerAutoplayPaused, activeBanners.length, currentBannerIndex, prefersReducedMotion])

  function pauseDesktopBannerAutoplay() {
    window.clearTimeout(desktopBannerResumeRef.current)
    setDesktopBannerAutoplayPaused(true)
  }

  function resumeDesktopBannerAutoplay() {
    window.clearTimeout(desktopBannerResumeRef.current)
    desktopBannerResumeRef.current = window.setTimeout(() => setDesktopBannerAutoplayPaused(false), 1000)
  }

  function stepDesktopBanner(direction) {
    if (activeBanners.length < 2) return
    pauseDesktopBannerAutoplay()
    const nextIndex = (currentBannerIndex + direction + activeBanners.length) % activeBanners.length
    setActiveBannerIndex(nextIndex)
    setDesktopBannerPosition(
      prefersReducedMotion
        ? nextIndex + 1
        : direction > 0 && currentBannerIndex === activeBanners.length - 1
          ? activeBanners.length + 1
          : direction < 0 && currentBannerIndex === 0
            ? 0
            : nextIndex + 1
    )
    resumeDesktopBannerAutoplay()
  }

  function selectDesktopBanner(index) {
    if (index < 0 || index >= activeBanners.length) return
    pauseDesktopBannerAutoplay()
    setActiveBannerIndex(index)
    setDesktopBannerPosition(index + 1)
    resumeDesktopBannerAutoplay()
  }

  function handleDesktopBannerPointerDown(event) {
    if (event.button !== 0 || event.target.closest('button')) return
    desktopBannerDragRef.current = { startX: event.clientX, deltaX: 0 }
    event.target.setPointerCapture(event.pointerId)
    setDesktopBannerDragging(true)
    setDesktopBannerDragOffset(0)
    pauseDesktopBannerAutoplay()
  }

  function handleDesktopBannerPointerMove(event) {
    if (!desktopBannerDragRef.current) return
    const deltaX = event.clientX - desktopBannerDragRef.current.startX
    desktopBannerDragRef.current.deltaX = deltaX
    setDesktopBannerDragOffset(deltaX)
  }

  function handleDesktopBannerPointerUp() {
    const drag = desktopBannerDragRef.current
    if (!drag) return
    desktopBannerDragRef.current = null
    setDesktopBannerDragging(false)
    setDesktopBannerDragOffset(0)
    const threshold = (desktopBannerTrackRef.current?.clientWidth || 0) * .15
    if (Math.abs(drag.deltaX) > threshold) {
      suppressDesktopBannerClickRef.current = true
      stepDesktopBanner(drag.deltaX < 0 ? 1 : -1)
    }
    resumeDesktopBannerAutoplay()
  }

  function handleDesktopBannerClickCapture(event) {
    if (!suppressDesktopBannerClickRef.current) return
    suppressDesktopBannerClickRef.current = false
    event.preventDefault()
    event.stopPropagation()
  }

  function handleDesktopBannerTransitionEnd() {
    if (desktopBannerPosition !== 0 && desktopBannerPosition !== activeBanners.length + 1) return
    setDesktopBannerNoTransition(true)
    setDesktopBannerPosition(desktopBannerPosition === 0 ? activeBanners.length : 1)
    window.requestAnimationFrame(() => setDesktopBannerNoTransition(false))
  }

  if (route.page === 'auth') {
    return <BuyerAuth authMode={authMode} setAuthMode={setAuthMode} authFlow={authFlow} setAuthFlow={setAuthFlow} otpPurpose={authOtpPurpose} error={error} notice={authNotice} setError={setError} onSubmit={submitAuth} onOtpSubmit={authActions.verifyOtp} onResetPassword={resetCustomerPassword} onResendOtp={authActions.resendOtp} continueAsGuest={continueAsGuest} busy={authBusy} language={language} authPhone={authPhone} setAuthPhone={setAuthPhone} onTelegramLogin={loginTelegram} />
  }

  if (route.page === 'checkout') {
    const checkoutSteps = ['Shipping information', 'Payment method', 'Payment slip', 'Review order', 'Place order']
    const canContinue = !validateCheckoutStep(checkoutStep)
    const selectedDelivery = DELIVERY_METHODS.find((method) => method.id === checkoutForm.deliveryMethod)
    const accountNumber = selectedPaymentAccount?.type === 'bank' || selectedPaymentAccount?.id === 'bank'
      ? selectedPaymentAccount?.accountNumber
      : selectedPaymentAccount?.phoneNumber

    return (
      <main className="checkout-screen">
        <header className="section-head">
          <button className="btn-link" onClick={() => { setError(''); setRoute({ page: 'main' }) }}>{tr('Back to Cart')}</button>
          <div><p className="kicker">{tr('SECURE CHECKOUT')}</p><h2>{tr('Checkout')}</h2></div>
          <p>{checkoutStep}/{checkoutSteps.length}</p>
        </header>

        <div className="checkout-grid">
          <section className="checkout-steps">
            <ol>
              {checkoutSteps.map((step, index) => <li key={step} className={checkoutStep === index + 1 ? 'active' : checkoutStep > index + 1 ? 'complete' : ''}>{index + 1}. {tr(step)}</li>)}
            </ol>

            {checkoutStep === 1 && (
              <div className="card-block">
                <h3>{tr('Shipping information')}</h3>
                <label className="checkout-field">{tr('Full name')}<input autoComplete="name" required value={checkoutForm.name} onChange={(event) => setCheckoutForm({ ...checkoutForm, name: event.target.value })} placeholder={tr('Name for delivery')} /></label>
                <label className="checkout-field">{tr('Phone number')}<input autoComplete="tel" type="tel" required value={checkoutForm.phone} onChange={(event) => setCheckoutForm({ ...checkoutForm, phone: event.target.value })} placeholder="09xxxxxxxxx" /></label>
                {!user?.email && <label className="checkout-field">{tr('Email (optional)')}<input autoComplete="email" type="email" value={checkoutForm.email || ''} onChange={(event) => setCheckoutForm({ ...checkoutForm, email: event.target.value })} placeholder={tr('Email address')} /></label>}
                <label className="checkout-field">{tr('Township (optional)')}<input autoComplete="address-level3" value={checkoutForm.township || ''} onChange={(event) => setCheckoutForm({ ...checkoutForm, township: event.target.value })} placeholder={tr('Township')} /></label>
                <label className="checkout-field">{tr('City / Region (optional)')}<input autoComplete="address-level2" value={checkoutForm.city || ''} onChange={(event) => setCheckoutForm({ ...checkoutForm, city: event.target.value })} placeholder={tr('City or region')} /></label>
                <label className="checkout-field">{tr('Complete delivery address')}<textarea autoComplete="street-address" required value={checkoutForm.shippingAddress} onChange={(event) => setCheckoutForm({ ...checkoutForm, shippingAddress: event.target.value })} placeholder={tr('House number, street, township, city/region, and delivery notes')} /></label>
                <fieldset className="delivery-options"><legend>{tr('Delivery method')}</legend>
                  {DELIVERY_METHODS.map((method) => <label key={method.id} className="inline-check"><input type="radio" name="delivery" checked={checkoutForm.deliveryMethod === method.id} onChange={() => setCheckoutForm({ ...checkoutForm, deliveryMethod: method.id })} />{tr(method.label)}<span>{formatPrice(method.rate ? (method.rate.freeThreshold > 0 && cartSubtotal >= method.rate.freeThreshold ? 0 : Number(method.rate.baseFee) + Math.ceil(Number(method.rate.additionalFee || 0) * cartShippingWeightKg)) : method.id === 'cargate' ? settings.carGatePickupFee : 0)}</span></label>)}
                </fieldset>
              </div>
            )}

            {checkoutStep === 2 && (
              <div className="card-block payment-select-block">
                <h3>{tr('Select a payment method')}</h3>
                {paymentMethods.length ? <div className="payment-account-options">{paymentMethods.map((payment) => (
                  <label className={`payment-account-option ${selectedPaymentAccount?.id === payment.id ? 'selected' : ''}`} key={payment.id}>
                    <input type="radio" name="paymentAccount" value={payment.id} checked={selectedPaymentAccount?.id === payment.id} onChange={() => { setCheckoutForm({ ...checkoutForm, paymentAccountId: payment.id }); setPaymentSlip(''); setError('') }} />
                    <span className="payment-account-option-copy"><strong>{language === 'my' ? payment.nameMyanmar || payment.name : payment.name}</strong><small>{payment.accountName || tr('Pay on delivery')}{payment.phoneNumber ? ` · ${payment.phoneNumber}` : ''}{payment.bankName ? ` · ${payment.bankName}` : ''}</small></span>
                    <span className="payment-radio-mark" />
                  </label>
                ))}</div> : <div className="admin-empty">{tr('No active payment methods are configured. Please contact the shop owner.')}</div>}

                {selectedPaymentAccount && <div className="selected-payment-details">
                  <div className="selected-payment-heading"><div><p className="kicker">{tr('PAYMENT DESTINATION')}</p><h4>{language === 'my' ? selectedPaymentAccount.nameMyanmar || selectedPaymentAccount.name : selectedPaymentAccount.name}</h4></div><strong>{formatPrice(cartTotal)}</strong></div>
                  {isCashPayment ? <p>{tr('Pay the delivery person when your order arrives.')}</p> : <>
                    {selectedPaymentAccount.accountName && <p><span>{tr('Account name')}</span><strong>{selectedPaymentAccount.accountName}</strong></p>}
                    {selectedPaymentAccount.type === 'bank' || selectedPaymentAccount.id === 'bank' ? <>
                      {selectedPaymentAccount.bankName && <p><span>{tr('Bank')}</span><strong>{selectedPaymentAccount.bankName}</strong></p>}
                      {selectedPaymentAccount.accountNumber && <p><span>{tr('Account number')}</span><strong className="account-number">{selectedPaymentAccount.accountNumber}</strong></p>}
                    </> : selectedPaymentAccount.phoneNumber && <p><span>{tr('Phone number')}</span><strong className="account-number">{selectedPaymentAccount.phoneNumber}</strong></p>}
                    {selectedPaymentAccount.qrCode && <figure className="payment-qr"><img src={selectedPaymentAccount.qrCode} alt={`${language === 'my' ? selectedPaymentAccount.nameMyanmar || selectedPaymentAccount.name : selectedPaymentAccount.name} ${tr('payment QR code')}`} /><figcaption>{tr('Scan this QR code to pay')}</figcaption></figure>}
                    <p className="payment-instruction">{tr('Please transfer the exact order amount to the selected account, then upload your payment slip.')}</p>
                  </>}
                </div>}
              </div>
            )}

            {checkoutStep === 3 && (
              <div className="card-block payment-slip-block">
                <h3>{tr('Payment slip')}</h3>
                {isCashPayment ? <p>{tr('Cash on Delivery does not require a payment slip.')}</p> : <>
                  <div className="slip-upload-row"><label className="btn-ghost slip-upload-button">{paymentSlip ? tr('Replace payment slip') : tr('Upload payment slip')}<input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" onChange={handlePaymentSlip} /></label>{paymentSlip && <button className="btn-link" onClick={() => setPaymentSlip('')}>{tr('Remove image')}</button>}</div>
                  <p className="muted">{tr('JPG, JPEG, PNG, or WebP · up to 5 MB')}</p>
                  {paymentSlip && <figure className="slip-preview"><img src={paymentSlip} alt={tr('Payment slip preview')} /><figcaption>{tr('Payment slip preview')}</figcaption></figure>}
                </>}
              </div>
            )}

            {checkoutStep === 4 && (
              <div className="card-block checkout-review">
                <h3>{tr('Review your order')}</h3>
                <section><h4>{tr('Customer information')}</h4><p><span>{tr('Name')}</span><strong>{checkoutForm.name}</strong></p><p><span>{tr('Phone')}</span><strong>{checkoutForm.phone}</strong></p><p><span>{tr('Delivery address')}</span><strong>{checkoutForm.shippingAddress}</strong></p><p><span>{tr('Delivery method')}</span><strong>{tr(selectedDelivery?.label || '')}</strong></p></section>
                <section><h4>{tr('Payment')}</h4><p><span>{tr('Payment method')}</span><strong>{selectedPaymentAccount ? language === 'my' ? selectedPaymentAccount.nameMyanmar || selectedPaymentAccount.name : selectedPaymentAccount.name : tr('Not selected')}</strong></p>{selectedPaymentAccount?.accountName && <p><span>{tr('Account name')}</span><strong>{selectedPaymentAccount.accountName}</strong></p>}{accountNumber && <p><span>{tr('Account number / phone')}</span><strong className="account-number">{accountNumber}</strong></p>}<p><span>{tr('Payment amount')}</span><strong>{formatPrice(cartTotal)}</strong></p>{paymentSlip && <figure className="slip-preview review-slip"><img src={paymentSlip} alt={tr('Uploaded payment slip')} /><figcaption>{tr('Uploaded payment slip')}</figcaption></figure>}{isCashPayment && <p className="muted">{tr('Cash on Delivery · no slip required')}</p>}</section>
                <section><h4>{tr('Items')} ({cart.filter((item) => item.selected !== false).length})</h4>{cart.filter((item) => item.selected !== false).map((item) => {
                  const product = products.find((candidate) => String(candidate.id) === String(item.id))
                  const price = Number(product?.discountPrice ?? product?.price ?? item.price)
                  return <p className="review-item" key={item.cartKey || item.id}><span>{item.name}{(item.variants?.size || item.variants?.color) && ` · ${[item.variants.size, item.variants.color].filter(Boolean).join(' / ')}`} × {item.quantity}</span><strong>{formatPrice(price * item.quantity)}</strong></p>
                })}</section>
              </div>
            )}

            {checkoutStep === 5 && (
              <div className="card-block">
                <h3>{tr('Place your order')}</h3>
                <p>{tr('Your payment will remain pending until the shop owner verifies your transfer.')}</p>
                {error && <p className="checkout-error" role="alert">{tr(error)}</p>}
                <button className="btn-primary place-order-button" disabled={!cart.length || !selectedPaymentAccount || (!isCashPayment && !paymentSlip)} onClick={placeOrder}>{tr('Place Order')} · {formatPrice(cartTotal)}</button>
              </div>
            )}

            {error && checkoutStep !== 5 && <p className="checkout-error" role="alert">{tr(error)}</p>}
            <div className="step-actions">
              <button className="btn-ghost" disabled={checkoutStep === 1} onClick={() => { setError(''); setCheckoutStep((step) => Math.max(1, step - 1)) }}>{tr('Previous')}</button>
              {checkoutStep < 5 && <button className="btn-primary" onClick={() => { if (!canContinue) { setError(validateCheckoutStep(checkoutStep)); return } setError(''); setCheckoutStep((step) => Math.min(5, step + 1)) }}>{tr('Continue')}</button>}
            </div>
          </section>

          <aside className="order-summary card-block">
            <h3>{tr('Order Summary')}</h3>
            <p><span>{tr('Subtotal')}</span><strong>{formatPrice(cartSubtotal)}</strong></p>
            <p><span>{tr('Delivery fee')}</span><strong>{formatPrice(deliveryFee)}</strong></p>
            <p><span>{tr('Discount')}</span><strong>−{formatPrice(couponDiscount)}</strong></p>
            <label className="checkout-coupon">{tr('Promotion code')}<input value={coupon} onChange={(event) => setCoupon(event.target.value)} placeholder={tr('Enter code')} /></label>
            {coupon && <small className={activePromotion ? 'coupon-applied' : 'coupon-invalid'}>{activePromotion ? `${activePromotion.name} ${tr('applied')}` : tr('No active promotion matches this code')}</small>}
            <hr />
            <p className="checkout-grand-total"><span>{tr('Total')}</span><strong>{formatPrice(cartTotal)}</strong></p>
          </aside>
        </div>
      </main>
    )
  }

  if (route.page === 'confirmation') {
    return (
      <main className="confirm-screen">
        <section className="confirm-card">
          <p className="kicker">{tr('ORDER CONFIRMATION')}</p>
          <h2>{tr('Order placed successfully.')}</h2>
          <p>{tr('Order number:')} {selectedOrder?.orderNumber || selectedOrder?.id}</p>
          <div className="launch-actions">
            <button className="btn-primary" onClick={() => { setActiveTab('home'); setRoute({ page: 'main' }) }}>{tr('Continue Shopping')}</button>
            <button className="btn-ghost" onClick={() => { setActiveTab('account'); setRoute({ page: 'main' }) }}>{tr('View Account')}</button>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="desktop-brand" onClick={() => { setActiveTab('home'); setSearchQuery('') }} aria-label={tr('HTOO Home')}>
          <img src={assetUrl('logo-white.svg')} alt="" aria-hidden="true" />
          <span><strong>HTOO</strong><small>{tr('HOME & LIVING')}</small></span>
        </button>
        <form className="desktop-header-search" onSubmit={(event) => { event.preventDefault(); saveSearch(); setActiveTab('search') }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-4-4" />
          </svg>
          <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} aria-label={tr('Search products')} placeholder={tr('Search products and brands')} />
          {searchQuery && <button type="button" className="desktop-search-clear" onClick={() => setSearchQuery('')} aria-label={tr('Clear search')}>×</button>}
          <button type="submit">{tr('Search')}</button>
        </form>
        <nav className="top-actions">
          <select aria-label={tr('Language')} value={language} onChange={(event) => setLanguage(event.target.value)}>
            <option value="my">🇲🇲 မြန်မာ</option>
            <option value="en">🇺🇸 English</option>
          </select>
          <button className="desktop-header-cart" onClick={() => setActiveTab('cart')} aria-label={`${tr('Cart')}${cartCount ? `, ${cartCount} ${tr('items')}` : ''}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 4h2l2.2 11.2a2 2 0 0 0 2 1.6h8.9a2 2 0 0 0 2-1.6L22 8H6" />
              <circle cx="10" cy="20" r="1" />
              <circle cx="18" cy="20" r="1" />
            </svg>
            <span>{tr('Cart')}</span>{cartCount > 0 && <b>{cartCount}</b>}
          </button>
          {user || guestMode
            ? <button onClick={logout}>{tr('Log Out')}</button>
            : <button onClick={() => setRoute({ page: 'auth' })}>{tr('Sign In / Register')}</button>
          }
        </nav>
      </header>

      <section className="tabs-row">
        {MAIN_TABS.map((tab) => (
          <button key={tab} className={tab === activeTab ? 'active' : ''} onClick={() => setActiveTab(tab)}>{tr(tab === 'account' ? 'Profile' : tab)}</button>
        ))}
      </section>
      {error && <p className="desktop-global-error" role="alert">{tr(error)}</p>}

      {activeTab === 'home' && (
        <section className="home-layout">
          {activeBanners.length > 0 ? (
            <div
              className="desktop-banner-carousel"
              onClickCapture={handleDesktopBannerClickCapture}
              onPointerDown={handleDesktopBannerPointerDown}
              onPointerMove={handleDesktopBannerPointerMove}
              onPointerUp={handleDesktopBannerPointerUp}
              onPointerCancel={handleDesktopBannerPointerUp}
            >
              <div className="desktop-hero-banner">
                <div
                  className={`desktop-banner-track${desktopBannerNoTransition ? ' no-transition' : ''}${desktopBannerDragging ? ' is-dragging' : ''}`}
                  ref={desktopBannerTrackRef}
                  style={{ transform: `translateX(calc(${-desktopBannerPosition * 100}% + ${desktopBannerDragOffset}px))`, transitionDuration: prefersReducedMotion ? '0ms' : undefined }}
                  onTransitionEnd={handleDesktopBannerTransitionEnd}
                >
                  {(activeBanners.length > 1
                    ? [
                        { banner: activeBanners[activeBanners.length - 1], index: activeBanners.length - 1, clone: 'last' },
                        ...activeBanners.map((banner, index) => ({ banner, index, clone: '' })),
                        { banner: activeBanners[0], index: 0, clone: 'first' }
                      ]
                    : activeBanners.map((banner, index) => ({ banner, index, clone: '' }))
                  ).map(({ banner, index, clone }) => (
                    <div className="desktop-banner-slide" key={`${banner.id || `banner-${index}`}${clone ? `-${clone}-clone` : ''}`} aria-hidden={Boolean(clone) || undefined}>
                      {banner.link ? (
                        <a className="desktop-banner-link" href={banner.link} tabIndex={clone ? -1 : undefined} draggable="false">
                          <img
                            src={banner.image}
                            alt={clone ? '' : (language === 'my' ? banner.altTextMy || banner.altText : banner.altText) || tr('Promotional Banner')}
                            className="desktop-banner-img"
                            draggable="false"
                          />
                        </a>
                      ) : (
                        <img
                          src={banner.image}
                          alt={clone ? '' : (language === 'my' ? banner.altTextMy || banner.altText : banner.altText) || tr('Promotional Banner')}
                          className="desktop-banner-img"
                          draggable="false"
                        />
                      )}
                    </div>
                  ))}
                </div>
                <div className="desktop-hero-copy">
                  <span>{tr('HTOO HOME')}</span>
                  <h2>{tr('Comfort begins at home.')}</h2>
                  <p>{tr('Explore thoughtful appliances for everyday living.')}</p>
                  <button onClick={() => setActiveTab('search')}>{tr('Shop now')}</button>
                </div>
                {activeBanners.length > 1 && (
                  <>
                    <button className="desktop-banner-control previous" aria-label={tr('Previous image')} onClick={() => stepDesktopBanner(-1)}>‹</button>
                    <button className="desktop-banner-control next" aria-label={tr('Next image')} onClick={() => stepDesktopBanner(1)}>›</button>
                  </>
                )}
              </div>
              {activeBanners.length > 1 && (
                <div className="desktop-banner-pagination" aria-label={tr('Choose promotion')}>
                  {activeBanners.map((banner, index) => (
                    <button key={banner.id || `${banner.image}-${index}`} className={index === currentBannerIndex ? 'active' : ''} aria-label={`${tr('Promotion')} ${index + 1}`} aria-current={index === currentBannerIndex ? 'true' : undefined} onClick={() => selectDesktopBanner(index)} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <article className="hero-block">
              <p className="kicker">{tr('HTOO HOME')}</p>
              <h2>{tr('Comfort begins at home.')}</h2>
              <p>{tr('Explore thoughtful appliances for everyday living.')}</p>
              <button className="btn-primary" onClick={() => setActiveTab('search')}>{tr('Shop now')}</button>
            </article>
          )}

          <section className="section-block desktop-home-categories">
            <div className="section-heading">
              <div><h3>{tr('Shop by Category')}</h3><p>{tr('Find the right appliance for your home')}</p></div>
              <button className="btn-link" onClick={() => setActiveTab('categories')}>{tr('See All')}</button>
            </div>
            <div className="desktop-category-grid">
              {categoryNames.map((category, index) => {
                const image = imageForCategory(category)
                return (
                  <button className="desktop-category-card" key={category} onClick={() => { setActiveTab('categories'); setSelectedCategory(category) }}>
                    <span className="desktop-category-number">{String(index + 1).padStart(2, '0')}</span>
                    <img src={image} alt="" loading="lazy" />
                    <strong>{tr(category)}</strong>
                  </button>
                )
              })}
            </div>
          </section>

          {products.some((product) => product.demoData) && <p className="desktop-demo-note" role="note">{tr('Demo prices and stock')}</p>}

          {homeProductSections.map((section) => (
            <article className="section-block desktop-home-products" key={section.title}>
              <div className="section-heading">
                <h3>{tr(section.title)}</h3>
                <button className="btn-link" onClick={() => setActiveTab('search')}>{tr('See All')}</button>
              </div>
              <DesktopProductRow products={section.products} wishlist={wishlist} onWish={toggleWishlist} onAdd={addToCart} onSelect={setViewingProduct} formatPrice={formatPrice} language={language} />
            </article>
          ))}
        </section>
      )}

      {activeTab === 'categories' && (
        <section className="categories-page">
          <div className="desktop-page-heading">
            <div><p className="kicker">{tr('Explore')}</p><h2>{tr('Categories')}</h2></div>
            <span>{categoryNames.length} {tr('Categories')}</span>
          </div>
          <div className="desktop-category-grid desktop-category-grid--page">
            {categoryNames.map((category, index) => {
              const image = imageForCategory(category)
              return (
                <button className={`desktop-category-card${activeCategory === category ? ' active' : ''}`} key={category} onClick={() => setSelectedCategory(category)}>
                  <span className="desktop-category-number">{String(index + 1).padStart(2, '0')}</span>
                  <img src={image} alt="" loading="lazy" />
                  <strong>{tr(category)}</strong>
                </button>
              )
            })}
          </div>
          <section className="section-block desktop-category-results">
            <div className="section-heading">
              <h3>{tr(activeCategory)}</h3>
              <span>{filteredProducts.length} {tr('Products')}</span>
            </div>
            <div className="chips desktop-subcategory-chips">
              {(CATEGORY_TREE[activeCategory] || []).map((subcategory) => (
                <button key={subcategory} onClick={() => { setSearchQuery(subcategory); setActiveTab('search') }}>{tr(subcategory)}</button>
              ))}
            </div>
            <DesktopProductGrid products={filteredProducts} wishlist={wishlist} onWish={toggleWishlist} onAdd={addToCart} onSelect={setViewingProduct} formatPrice={formatPrice} language={language} />
          </section>
        </section>
      )}

      {activeTab === 'search' && (
        <section className="search-layout">
          <h3>{tr('Search Products & Brands')}</h3>
          <div className="search-bar">
            <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={tr('Search products and brands')} />
            <button onClick={saveSearch}>{tr('Search')}</button>
          </div>

          <div className="filter-grid">
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
              <option value="popular">{tr('Sort: Popular')}</option>
              <option value="newest">{tr('Newest')}</option>
              <option value="rating">{tr('Rating')}</option>
              <option value="price-asc">{tr('Price Low to High')}</option>
              <option value="price-desc">{tr('Price High to Low')}</option>
            </select>

            <select value={filters.price} onChange={(event) => setFilters({ ...filters, price: event.target.value })}>
              <option value="">{tr('Price')}</option>
              <option value="under-30">{tr('Under 30,000')}</option>
              <option value="30-60">{tr('30,000 - 60,000')}</option>
              <option value="over-60">{tr('Over 60,000')}</option>
            </select>

            <select value={filters.brand} onChange={(event) => setFilters({ ...filters, brand: event.target.value })}>
              <option value="">{tr('Brand')}</option>
              {allBrands.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
            </select>

            <select value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}>
              <option value="">{tr('Category')}</option>
              {Object.keys(CATEGORY_TREE).map((category) => <option key={category} value={category}>{category}</option>)}
            </select>

            <select value={filters.rating} onChange={(event) => setFilters({ ...filters, rating: event.target.value })}>
              <option value="">{tr('Rating')}</option>
              <option value="4">4.0+</option>
              <option value="4.5">4.5+</option>
            </select>

            <select value={filters.availability} onChange={(event) => setFilters({ ...filters, availability: event.target.value })}>
              <option value="">{tr('Availability')}</option>
              <option value="in-stock">{tr('In Stock')}</option>
              <option value="out-of-stock">{tr('Out of stock')}</option>
            </select>

            <select value={filters.discount || ''} onChange={(event) => setFilters({ ...filters, discount: event.target.value })}>
              <option value="">{tr('Discount')}</option>
              <option value="discounted">{tr('On sale')}</option>
            </select>
          </div>

          <div className="desktop-filter-summary">
            <p>{tr('Recent Searches')}: {recentSearches.length ? recentSearches.join(', ') : tr('None')}</p>
            <button className="btn-link" onClick={() => setFilters({ size: '', color: '', price: '', brand: '', category: '', rating: '', availability: '', material: '', style: '', discount: '' })}>{tr('Reset Filters')}</button>
          </div>
          <div className="section-heading"><h4>{tr('Search Results')}</h4><span>{filteredProducts.length} {tr('Products')}</span></div>
          <div className="desktop-active-filters">
            {Object.entries(filters).filter(([, value]) => value).map(([key, value]) => (
              <button key={key} onClick={() => setFilters({ ...filters, [key]: '' })}>{tr(String(value))} <span aria-hidden="true">×</span></button>
            ))}
          </div>
          <DesktopProductGrid products={filteredProducts} wishlist={wishlist} onWish={toggleWishlist} onAdd={addToCart} onSelect={setViewingProduct} formatPrice={formatPrice} language={language} />
        </section>
      )}

      {activeTab === 'wishlist' && (
        <section className="section-block">
          <div className="section-heading">
            <div><h3>{tr('My Wishlist')}</h3><p>{wishlistProducts.length} {tr('Products')}</p></div>
          </div>
          <div className="product-grid">
            {wishlistProducts.map((product) => (
              <article key={product.id} className="product-card">
                <button className="desktop-product-image" onClick={() => setViewingProduct(product)} aria-label={`${tr('View details')}: ${product.name}`}>
                  <img src={product.image || assetUrl('appliance-placeholder.svg')} alt="" loading="lazy" />
                </button>
                <button className="desktop-product-title" onClick={() => setViewingProduct(product)}>{language === 'my' ? product.nameMy || product.name : product.name}</button>
                <p className="desktop-product-brand">{product.brand || 'HTOO'}</p>
                <div className="price-row"><strong>{formatPrice(product.price)}</strong>{Number(product.oldPrice) > Number(product.price) && <small>{formatPrice(product.oldPrice)}</small>}</div>
                <span className={`desktop-product-stock${Number(product.stock) <= 0 ? ' unavailable' : ''}`}>{Number(product.stock) > 0 ? tr('In Stock') : tr('Out of stock')}</span>
                <div className="card-actions">
                  <button className="btn-primary" disabled={Number(product.stock) <= 0} onClick={() => moveWishlistItemToCart(product.id)}>{tr('Move to Cart')}</button>
                  <button className="btn-ghost" onClick={() => toggleWishlist(product.id)}>{tr('Remove')}</button>
                </div>
              </article>
            ))}
            {!wishlistProducts.length && <div className="desktop-empty-state"><p>{tr('Your wishlist is empty')}</p><button className="btn-primary" onClick={() => setActiveTab('search')}>{tr('Discover Products')}</button></div>}
          </div>
        </section>
      )}

      {activeTab === 'account' && (
        <section className="account-layout">
          <article className="card-block">
            <h3>{tr('Profile Information')}</h3>
            {accountLinkNotice && <p className="account-link-status" role="status">{tr(accountLinkNotice)}</p>}
            {user?.profileImage && <img src={user.profileImage} alt="" referrerPolicy="no-referrer" style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover' }} />}
            <p>{tr('Name')}: {user?.name || tr('Guest User')}</p>
            <p>{tr('Email')}: {user?.email || '-'}</p>
            <p>{tr('Phone')}: {user?.phone || '-'}</p>
            <p>{tr('Email status')}: {user?.email ? user.emailVerified ? tr('Verified') : tr('Not verified') : '-'}</p>
            {user && <>
              <p>{tr('Sign-in methods:')} {(user.authMethods || ['email']).join(', ')}</p>
              {(!user.email || !user.emailVerified) && <section>
                <p>{tr('Add a verified HTOO recovery email. Password recovery codes are sent only to the email you verify here.')}</p>
                <form className="buyer-auth-form" onSubmit={requestRecoveryEmail}>
                  <label className="buyer-auth-label" htmlFor="buyer-recovery-email">{tr('Recovery email')}</label>
                  <input id="buyer-recovery-email" className="buyer-auth-input" name="recoveryEmail" type="email" autoComplete="email" defaultValue={user.email || ''} maxLength={254} required />
                  <button className="btn-primary" type="submit" disabled={authBusy}>{authBusy ? tr('Please wait…') : tr('Send verification code')}</button>
                </form>
                {recoveryEmailChallengeId && <form className="buyer-auth-form" onSubmit={verifyRecoveryEmail}>
                  <label className="buyer-auth-label" htmlFor="buyer-recovery-otp">{tr('Email verification code')}</label>
                  <input id="buyer-recovery-otp" className="buyer-auth-input" name="recoveryOtp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required />
                  <button className="btn-primary" type="submit" disabled={authBusy}>{authBusy ? tr('Please wait…') : tr('Verify recovery email')}</button>
                </form>}
              </section>}
              {recoveryEmailNotice && <p className="account-link-status" role="status">{tr(recoveryEmailNotice)}</p>}
              <p>{tr('Connect providers only by signing in to each account. Losing Google or Telegram access must be recovered through that provider; verified HTOO email accounts can use email-code password recovery.')}</p>
              {!user.authMethods?.includes('google') && <button className="btn-ghost" onClick={linkGoogle}>{tr('Link Google account')}</button>}
              {!user.authMethods?.includes('telegram') && <button className="btn-ghost" onClick={linkTelegram}>{tr('Link Telegram account')}</button>}
            </>}
            {user && <button className="btn-ghost" onClick={logout}>{tr('Log out')}</button>}
          </article>

          <article className="card-block">
            <h3>{tr('My Orders')}</h3>
            {orders.map((order) => (
              <div key={order.id} className="order-row">
                <span>{order.orderNumber || order.id}</span>
                <span>{(order.items || []).map((item) => `${item.name} × ${item.quantity} · ${formatPrice(item.price)}`).join(', ')}</span>
                <span>{tr(order.status)}</span>
                <span>{formatPrice(order.total)}</span>
                <span>{order.createdAt && !Number.isNaN(Date.parse(order.createdAt)) ? new Date(order.createdAt).toLocaleDateString() : ''}</span>
                <button className="btn-link" onClick={() => setSelectedOrder(order)}>{tr('View Details')}</button>
              </div>
            ))}
            {!orders.length && <p>{tr('No orders yet.')}</p>}
          </article>

          <article className="card-block">
            <h3>{tr('Address Book')}</h3>
            <form className="buyer-auth-form" onSubmit={async (event) => {
              event.preventDefault()
              const payload = {
                ...addressDraft,
                fullName: addressDraft.fullName.trim(),
                phone: addressDraft.phone.trim(),
                addressLine: addressDraft.addressLine.trim()
              }
              const result = editingAddressId
                ? await updateAddress(editingAddressId, payload)
                : await addAddress({ ...payload, label: 'Home' })
              if (!result) return
              setEditingAddressId('')
              setAddressDraft({ fullName: '', phone: '', addressLine: '', township: '', region: '', default: false })
            }}>
              <label>{tr('Full Name')}<input value={addressDraft.fullName} onChange={(event) => setAddressDraft({ ...addressDraft, fullName: event.target.value })} maxLength={120} required /></label>
              <label>{tr('Phone Number')}<input type="tel" value={addressDraft.phone} onChange={(event) => setAddressDraft({ ...addressDraft, phone: event.target.value })} required /></label>
              <label>{tr('Township')}<input value={addressDraft.township} onChange={(event) => setAddressDraft({ ...addressDraft, township: event.target.value })} maxLength={120} /></label>
              <label>{tr('City / Region')}<input value={addressDraft.region} onChange={(event) => setAddressDraft({ ...addressDraft, region: event.target.value })} maxLength={120} /></label>
              <label>{tr('Complete delivery address')}<textarea value={addressDraft.addressLine} onChange={(event) => setAddressDraft({ ...addressDraft, addressLine: event.target.value })} maxLength={1000} required /></label>
              <label className="inline-check"><input type="checkbox" checked={addressDraft.default} onChange={(event) => setAddressDraft({ ...addressDraft, default: event.target.checked })} />{tr('Set as Default')}</label>
              <button className="btn-primary" type="submit">{tr(editingAddressId ? 'Save changes' : 'Add New Address')}</button>
              {editingAddressId && <button className="btn-ghost" type="button" onClick={() => {
                setEditingAddressId('')
                setAddressDraft({ fullName: '', phone: '', addressLine: '', township: '', region: '', default: false })
              }}>{tr('Cancel')}</button>}
            </form>
            {addressBook.map((address) => (
              <div key={address.id} className="order-row">
                <span>{address.fullName} · {address.phone} · {address.value || address.addressLine}</span>
                {address.default && <span>{tr('Default')}</span>}
                <button className="btn-link" onClick={() => {
                  setEditingAddressId(address.id)
                  setAddressDraft({
                    fullName: address.fullName || '',
                    phone: address.phone || '',
                    addressLine: address.addressLine || address.value || '',
                    township: address.township || '',
                    region: address.region || '',
                    default: Boolean(address.default)
                  })
                }}>{tr('Edit')}</button>
                {!address.default && <button className="btn-link" onClick={() => void updateAddress(address.id, { default: true })}>{tr('Set as Default')}</button>}
                <button className="btn-link" onClick={() => {
                  if (window.confirm(tr('Delete this saved address?'))) void removeAddress(address.id)
                }}>{tr('Delete')}</button>
              </div>
            ))}
            {!addressBook.length && <p>{tr('No saved addresses.')}</p>}
          </article>

          <article className="card-block">
            <h3>{tr('Payment Methods')}</h3>
            <p>{tr('Cards')}</p>
            <p>{tr('Wallet')}</p>
            <p>{tr('Cash on Delivery')}</p>
          </article>

          <article className="card-block desktop-support-card">
            <h3>{tr('Help & Support')}</h3>
            <p className="desktop-support-intro">{tr('Reach our team on any channel below — we are happy to help with orders, payments and delivery.')}</p>
            <SupportChannelList
              channels={supportChannels}
              loading={supportChannelsLoading}
              error={supportChannelsError}
              onRetry={loadSupportChannels}
              tr={tr}
              onNotify={setSupportNotice}
              helpItems={storefrontHelpItems}
              compact
            />
            <p className="sr-only" role="status" aria-live="polite">{supportNotice}</p>
            <p>{tr('Track Order, Return / Refund, and support are available after order placement.')}</p>
          </article>

          {selectedOrder && (
            <article className="card-block">
              <h3>{tr('Order Details')} <button className="btn-link" onClick={() => setSelectedOrder(null)}>{tr('Close')}</button></h3>
              <p>{tr('Order')}: {selectedOrder.orderNumber || selectedOrder.id}</p>
              <p>{tr('Status')}: {tr(selectedOrder.status)}</p>
              <p>{tr('Order date')}: {selectedOrder.createdAt && !Number.isNaN(Date.parse(selectedOrder.createdAt)) ? new Date(selectedOrder.createdAt).toLocaleString() : tr('Not available')}</p>
              <p>{tr('Name')}: {selectedOrder.customer?.name || tr('Not specified')}</p>
              <p>{tr('Phone Number')}: {selectedOrder.customer?.phone || tr('Not specified')}</p>
              <p>{tr('Shipping address')}: {selectedOrder.customer?.address || tr('Not specified')}</p>
              <p>{tr('Delivery method')}: {tr(selectedOrder.deliveryMethod || 'Not specified')}</p>
              <h4>{tr('Products')}</h4>
              {(selectedOrder.items || []).map((item) => (
                <p key={`${item.productId || item.id}-${item.variants?.size || ''}-${item.variants?.color || ''}`}>
                  {item.name} × {item.quantity} · {formatPrice(item.price)} {tr('each')} · {formatPrice(item.lineTotal ?? item.price * item.quantity)}
                </p>
              ))}
              <p>{tr('Payment method')}: {selectedOrder.paymentMethod || tr('Not specified')}</p>
              <p>{tr('Payment status')}: {tr(selectedOrder.paymentStatus || 'Pending')}</p>
              <p>{tr('Shipping status')}: {tr(selectedOrder.shippingStatus || 'Preparing')}</p>
              {selectedOrder.trackingNumber && <p>{tr('Tracking number')}: {selectedOrder.trackingNumber}{getDeliveryTrackingUrl?.(selectedOrder.deliveryCompany, selectedOrder.trackingNumber) && <> · <a href={getDeliveryTrackingUrl(selectedOrder.deliveryCompany, selectedOrder.trackingNumber)} target="_blank" rel="noopener noreferrer">{tr('Track delivery')}</a></>}</p>}
              {selectedOrder.deliveryCompany && <p>{tr('Delivery company')}: {selectedOrder.deliveryCompany}</p>}
              <p>{tr('Subtotal')}: {formatPrice(selectedOrder.subtotal || 0)}</p>
              <p>{tr('Shipping fee')}: {formatPrice(selectedOrder.shippingFee ?? selectedOrder.deliveryFee ?? 0)}</p>
              <p>{tr('Discount')}: {formatPrice(selectedOrder.discount || 0)}</p>
              <p><strong>{tr('Total')}: {formatPrice(selectedOrder.total)}</strong></p>
              <h4>{tr('Track Order')}</h4>
              {(selectedOrder.statusHistory || []).map((entry, index) => (
                <p key={`${entry.status}-${entry.at || index}`}>{tr(entry.status)} · {entry.at && !Number.isNaN(Date.parse(entry.at)) ? new Date(entry.at).toLocaleString() : ''}</p>
              ))}
              <p>{tr(selectedOrder.status)}</p>
            </article>
          )}
        </section>
      )}

      {activeTab === 'cart' && (
        <section className="section-block desktop-cart-screen">
          <div className="desktop-cart-heading">
            <h3>{tr('Shopping Cart')} ({cart.reduce((count, item) => count + Number(item.quantity || 0), 0)})</h3>
            {cart.length > 0 && <p>{cart.filter((item) => item.selected !== false).length} {tr('selected')}</p>}
          </div>
          {cart.length > 0 && (
            <label className="desktop-cart-select-all">
              <input
                type="checkbox"
                checked={cart.every((item) => item.selected !== false)}
                onChange={(event) => cart.forEach((item) => updateCartItem(item.cartKey || item.id, { selected: event.target.checked }))}
              />
              <span>{tr('Select all')}</span>
            </label>
          )}
          <div className="cart-list">
            {cart.map((item) => (
              <article key={item.cartKey || item.id} className="cart-item">
                <input
                  type="checkbox"
                  aria-label={`${tr('Select')} ${item.name}`}
                  checked={item.selected !== false}
                  onChange={() => updateCartItem(item.cartKey || item.id, { selected: item.selected === false })}
                />
                <img src={products.find((product) => String(product.id) === String(item.id))?.image || item.image} alt={item.name} />
                <div className="desktop-cart-info">
                  <h4>{item.name}</h4>
                  {(item.variants?.size || item.variants?.color) && <p className="cart-variant">{[item.variants.size, item.variants.color].filter(Boolean).join(' / ')}</p>}
                  {(() => {
                    const product = products.find((candidate) => String(candidate.id) === String(item.id))
                    const price = Number(product?.discountPrice ?? product?.price ?? item.price)
                    const stock = getProductStock(product || {}, item.variants)
                    return (
                      <>
                        <div className="desktop-cart-prices"><span>{formatPrice(price)} {tr('each')}</span><strong>{formatPrice(price * item.quantity)}</strong></div>
                        <div className="qty-actions">
                          <button type="button" aria-label={`${tr('Decrease quantity')} ${item.name}`} disabled={item.quantity <= 1} onClick={() => updateQuantity(item.cartKey || item.id, -1)}>−</button>
                          <span aria-live="polite">{item.quantity}</span>
                          <button type="button" className="desktop-cart-plus" aria-label={`${tr('Increase quantity')} ${item.name}`} disabled={item.quantity >= stock} onClick={() => updateQuantity(item.cartKey || item.id, 1)}>+</button>
                        </div>
                      </>
                    )
                  })()}
                </div>
                <button className="btn-link desktop-cart-remove" aria-label={`${tr('Remove')} ${item.name}`} onClick={() => removeFromCart(item.cartKey || item.id)}>{tr('Remove')}</button>
              </article>
            ))}
            {!cart.length && <p>{tr('Your cart is empty.')}</p>}
          </div>

          <article className="card-block">
            <h4>{tr('Order Summary')}</h4>
            <p>{tr('Subtotal')}: {formatPrice(cartSubtotal)}</p>
            <p>{tr('Delivery')}: {formatPrice(deliveryFee)}</p>
            {couponDiscount > 0 && <p>{tr('Discount')}: −{formatPrice(couponDiscount)}</p>}
            <strong>{tr('Total')}: {formatPrice(cartTotal)}</strong>
            <button className="btn-primary" disabled={!cart.some((item) => item.selected !== false)} onClick={() => beginCheckout('review')}>{tr('Proceed to Checkout')}</button>
          </article>
        </section>
      )}

      {viewingProduct && (
        <DesktopProductDetail
          key={viewingProduct.id}
          product={viewingProduct}
          wished={wishlist.includes(viewingProduct.id)}
          onClose={() => setViewingProduct(null)}
          onWish={() => toggleWishlist(viewingProduct.id)}
          onAdd={addToCart}
          onBuyNow={(product, quantity) => {
            if (!addToCart(product, quantity)) return
            setViewingProduct(null)
            beginCheckout('review')
          }}
          formatPrice={formatPrice}
          language={language}
        />
      )}

      <footer className="footer-nav">
        <button onClick={() => setActiveTab('home')}>{tr('Home')}</button>
        <button onClick={() => setActiveTab('categories')}>{tr('Categories')}</button>
        <button onClick={() => setActiveTab('cart')}>{tr('Cart')} ({cartCount})</button>
        <button onClick={() => setActiveTab('wishlist')}>{tr('Wishlist')}</button>
        <button onClick={() => setActiveTab('account')}>{tr('Profile')}</button>
      </footer>
    </main>
  )
}

function DesktopProductRow({ products, wishlist, onWish, onAdd, onSelect, formatPrice, language }) {
  const tr = (text) => t(text, language)
  return (
    <div className="product-row">
      {products.slice(0, 4).map((product) => (
        <DesktopProductCard key={product.id} product={product} wished={wishlist.includes(product.id)} onWish={onWish} onAdd={onAdd} onSelect={onSelect} formatPrice={formatPrice} language={language} />
      ))}
      {!products.length && <p>{tr('No products found.')}</p>}
    </div>
  )
}

function DesktopProductGrid({ products, wishlist, onWish, onAdd, onSelect, formatPrice, language }) {
  const tr = (text) => t(text, language)
  return (
    <div className="product-grid">
      {products.map((product) => (
        <DesktopProductCard key={product.id} product={product} wished={wishlist.includes(product.id)} onWish={onWish} onAdd={onAdd} onSelect={onSelect} formatPrice={formatPrice} language={language} />
      ))}
      {!products.length && <p>{tr('No matching products.')}</p>}
    </div>
  )
}

function DesktopProductCard({ product, wished, onWish, onAdd, onSelect, formatPrice, language }) {
  const tr = (text) => t(text, language)
  const [size, setSize] = useState('')
  const [color, setColor] = useState('')
  const { sizes, colors } = getProductVariants(product)
  const variantRequired = sizes.length > 0 || colors.length > 0
  const canAdd = (!sizes.length || size) && (!colors.length || color)
  const selectedVariants = { ...(size ? { size } : {}), ...(color ? { color } : {}) }
  const selectedStock = getProductStock(product, selectedVariants)
  const discount = Number(product.oldPrice) > Number(product.price)
    ? Math.round(((Number(product.oldPrice) - Number(product.price)) / Number(product.oldPrice)) * 100)
    : 0
  return (
    <article className="product-card">
      <button className="desktop-product-image" onClick={() => onSelect?.(product)} aria-label={`${tr('View details')}: ${product.name}`}>
        <img src={product.image || assetUrl('appliance-placeholder.svg')} alt="" loading="lazy" />
      </button>
      <div className="badge-row">
        <span>{tr(product.category)}</span>
        <button className={wished ? 'wished' : ''} aria-pressed={wished} onClick={() => onWish(product.id)}>{tr(wished ? 'Wish saved' : 'Wish')}</button>
      </div>
      <button className="desktop-product-title" onClick={() => onSelect?.(product)}>{language === 'my' ? product.nameMy || product.name : product.name}</button>
      <p className="desktop-product-brand">{product.brand || 'HTOO'}{product.subcategory ? ` · ${tr(product.subcategory)}` : ''}</p>
      <div className="price-row">
        <strong>{formatPrice(product.price)}</strong>
        {discount > 0 && <small>{formatPrice(product.oldPrice)}</small>}
      </div>
      {discount > 0 && <span className="desktop-product-discount">{discount}% {tr('Off')}</span>}
      <span className={`desktop-product-stock${Number(product.stock) <= 0 ? ' unavailable' : ''}`}>{Number(product.stock) > 0 ? tr('In Stock') : tr('Out of stock')}</span>
      {Number(product.rating) > 0 && <span className="desktop-product-rating">★ {Number(product.rating).toFixed(1)}{Number(product.reviewsCount) > 0 ? ` · ${product.reviewsCount}` : ''}</span>}
      {product.demoData && <span className="desktop-product-sample">{tr('Demo prices and stock')}</span>}
      {sizes.length > 0 && <label className="product-variant-select">{tr('Size')}<select value={size} onChange={(event) => setSize(event.target.value)}><option value="">{tr('Choose size')}</option>{sizes.map((option) => <option key={option}>{option}</option>)}</select></label>}
      {colors.length > 0 && <label className="product-variant-select">{tr('Color')}<select value={color} onChange={(event) => setColor(event.target.value)}><option value="">{tr('Choose color')}</option>{colors.map((option) => <option key={option}>{option}</option>)}</select></label>}
      <AddToCartButton
        productName={product.name}
        language={language}
        disabled={!selectedStock || (variantRequired && !canAdd)}
        onClick={() => onAdd({ ...product, selectedVariants })}
      />
    </article>
  )
}

function DesktopProductDetail({ product, wished, onClose, onWish, onAdd, onBuyNow, formatPrice, language }) {
  const tr = (text) => t(text, language)
  const images = [...new Set([...(Array.isArray(product.images) ? product.images : []), product.image].filter(Boolean))]
  const [imageIndex, setImageIndex] = useState(0)
  const [size, setSize] = useState('')
  const [color, setColor] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [zoomed, setZoomed] = useState(false)
  const { sizes, colors } = getProductVariants(product)
  const variants = { ...(size ? { size } : {}), ...(color ? { color } : {}) }
  const availableStock = getProductStock(product, variants)
  const variantSelected = (!sizes.length || size) && (!colors.length || color)
  const canPurchase = availableStock > 0 && variantSelected
  const image = images[imageIndex] || product.image || assetUrl('appliance-placeholder.svg')
  const details = [
    [tr('Brand'), product.brand],
    [tr('Category'), tr(product.category)],
    [tr('Model'), product.model],
    [tr('SKU'), product.sku]
  ].filter(([, value]) => value)

  return (
    <div className="desktop-product-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="desktop-product-detail" role="dialog" aria-modal="true" aria-labelledby="desktop-product-name">
        <button className="desktop-detail-close" onClick={onClose} aria-label={tr('Close')}>×</button>
        <div className="desktop-detail-gallery">
          <button className={`desktop-detail-main-image${zoomed ? ' is-zoomed' : ''}`} onClick={() => setZoomed((value) => !value)} aria-label={tr(zoomed ? 'Zoom out' : 'Zoom image')}>
            <img src={image} alt={language === 'my' ? product.nameMy || product.name : product.name} />
          </button>
          {images.length > 1 && (
            <div className="desktop-detail-thumbnails">
              {images.map((item, index) => <button key={item} className={imageIndex === index ? 'active' : ''} onClick={() => { setImageIndex(index); setZoomed(false) }} aria-label={`${tr('Product image')} ${index + 1}`}><img src={item} alt="" /></button>)}
            </div>
          )}
        </div>
        <div className="desktop-detail-copy">
          <p className="kicker">{tr(product.category)}</p>
          <h2 id="desktop-product-name">{language === 'my' ? product.nameMy || product.name : product.name}</h2>
          <p className="desktop-detail-brand">{product.brand || 'HTOO'}</p>
          {Number(product.rating) > 0 && <p className="desktop-detail-rating">★ {Number(product.rating).toFixed(1)}{Number(product.reviewsCount) > 0 ? ` · ${product.reviewsCount}` : ''}</p>}
          <div className="desktop-detail-price"><strong>{formatPrice(product.price)}</strong>{Number(product.oldPrice) > Number(product.price) && <del>{formatPrice(product.oldPrice)}</del>}</div>
          <p className={`desktop-detail-stock${availableStock <= 0 ? ' unavailable' : ''}`}>{availableStock > 0 ? `${tr('In Stock')} · ${availableStock}` : tr('Out of stock')}</p>
          {product.demoData && <p className="desktop-product-sample">{tr('Demo prices and stock')}</p>}
          {product.description && <p className="desktop-detail-description">{language === 'my' ? product.descriptionMy || product.description : product.description}</p>}
          {details.length > 0 && <dl className="desktop-detail-specs">{details.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
          {sizes.length > 0 && <label className="product-variant-select">{tr('Size')}<select value={size} onChange={(event) => setSize(event.target.value)}><option value="">{tr('Choose size')}</option>{sizes.map((option) => <option key={option}>{option}</option>)}</select></label>}
          {colors.length > 0 && <label className="product-variant-select">{tr('Color')}<select value={color} onChange={(event) => setColor(event.target.value)}><option value="">{tr('Choose color')}</option>{colors.map((option) => <option key={option}>{option}</option>)}</select></label>}
          <div className="desktop-detail-actions">
            <div className="desktop-detail-quantity">
              <button onClick={() => setQuantity((value) => Math.max(1, value - 1))} disabled={quantity <= 1} aria-label={tr('Decrease quantity')}>−</button>
              <span>{quantity}</span>
              <button onClick={() => setQuantity((value) => Math.min(availableStock, value + 1))} disabled={quantity >= availableStock} aria-label={tr('Increase quantity')}>+</button>
            </div>
            <button className={`btn-ghost desktop-detail-wish${wished ? ' active' : ''}`} onClick={onWish} aria-pressed={wished}>{tr(wished ? 'Wish saved' : 'Add to Wishlist')}</button>
          </div>
          <div className="desktop-detail-purchase">
            <button className="btn-primary" disabled={!canPurchase} onClick={() => { if (onAdd({ ...product, selectedVariants: variants }, quantity)) onClose() }}>{tr('Add to Cart')}</button>
            <button className="btn-ghost" disabled={!canPurchase} onClick={() => onBuyNow({ ...product, selectedVariants: variants }, quantity)}>{tr('Buy Now')}</button>
          </div>
        </div>
      </section>
    </div>
  )
}
