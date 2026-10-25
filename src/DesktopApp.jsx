import { useEffect, useMemo, useState } from 'react'
import BuyerAuth from './BuyerAuth'
import { AddToCartButton } from './CartControls'
import SupportChannelList from './SupportChannelList'
import { getProductStock, getProductVariants } from './lib/productVariants'
import { t } from './lib/i18n'

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
  updateCartItem,
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
  toggleWishlist,
  saveSearch,
  moveWishlistItemToCart,
  _addAddress,
  updateAddress,
  validateCheckoutStep,
  handlePaymentSlip,
  placeOrder,
  logout,
  MAIN_TABS,
  CATEGORY_TREE,
  DELIVERY_METHODS,
  formatPrice,
  ONBOARDING_KEY,
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
      .filter((banner) => banner.enabled !== false && banner.image && (!banner.startDate || banner.startDate.slice(0, 10) <= today) && (!banner.endDate || banner.endDate.slice(0, 10) >= today))
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
  }, [storefrontBanners])
  const [activeBannerIndex, setActiveBannerIndex] = useState(0)
  // Screen-reader announcement after a support channel is opened.
  const [supportNotice, setSupportNotice] = useState('')
  const [isDesktopViewport, setIsDesktopViewport] = useState(() => window.matchMedia?.('(min-width: 768px)')?.matches ?? true)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false)

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
    if (route.page !== 'main' || activeTab !== 'home' || !isDesktopViewport || prefersReducedMotion || activeBanners.length < 2) return
    const timer = window.setInterval(() => {
      setActiveBannerIndex((index) => ((index % activeBanners.length) + 1) % activeBanners.length)
    }, 3500)
    return () => window.clearInterval(timer)
  }, [route.page, activeTab, isDesktopViewport, prefersReducedMotion, activeBanners.length])

  if (route.page === 'launch') {
    return (
      <main className="launch-screen">
        <section className="launch-card">
          <p className="kicker">{tr('APP LAUNCH')}</p>
          <h1>{tr('Dress Better.')} {tr('Live Brighter.')}</h1>
          <p>{tr('Fashion-first shopping with curated categories, smart search, wishlist, and fast checkout.')}</p>
          <div className="launch-actions">
            <button className="btn-primary" onClick={startApp}>{tr('Start Onboarding')}</button>
            <button className="btn-ghost" onClick={() => { localStorage.setItem(ONBOARDING_KEY, '1'); setRoute({ page: 'auth' }) }}>{tr('Skip')}</button>
          </div>
        </section>
      </main>
    )
  }

  if (route.page === 'auth') {
    return <BuyerAuth authMode={authMode} setAuthMode={setAuthMode} authFlow={authFlow} setAuthFlow={setAuthFlow} otpPurpose={authOtpPurpose} error={error} notice={authNotice} setError={setError} onSubmit={submitAuth} onOtpSubmit={authActions.verifyOtp} onResetPassword={resetCustomerPassword} onResendOtp={authActions.resendOtp} continueAsGuest={continueAsGuest} busy={authBusy} language={language} authPhone={authPhone} setAuthPhone={setAuthPhone} />
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
                  {DELIVERY_METHODS.map((method) => <label key={method.id} className="inline-check"><input type="radio" name="delivery" checked={checkoutForm.deliveryMethod === method.id} onChange={() => setCheckoutForm({ ...checkoutForm, deliveryMethod: method.id })} />{tr(method.label)}{method.id === 'cargate' && <span>{formatPrice(settings.carGatePickupFee)}</span>}</label>)}
                </fieldset>
                <label className="inline-check"><input type="checkbox" checked={checkoutForm.saveAddress} onChange={(event) => setCheckoutForm({ ...checkoutForm, saveAddress: event.target.checked })} /> {tr('Save address')}</label>
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
        <div>
          <p className="kicker">{tr('MAIN APP')}</p>
          <h1>{tr('HTOO Online Shop')}</h1>
        </div>
        <nav className="top-actions">
          <select aria-label={tr('Language')} value={language} onChange={(event) => setLanguage(event.target.value)}>
            <option value="my">🇲🇲 မြန်မာ</option>
            <option value="en">🇺🇸 English</option>
          </select>
          <button onClick={() => beginCheckout('review')}>{tr('Checkout')}</button>
          {user || guestMode
            ? <button onClick={logout}>{tr('Log Out')}</button>
            : <button onClick={() => setRoute({ page: 'auth' })}>{tr('Sign In / Register')}</button>
          }
        </nav>
      </header>

      <section className="tabs-row">
        {MAIN_TABS.map((tab) => (
          <button key={tab} className={tab === activeTab ? 'active' : ''} onClick={() => setActiveTab(tab)}>{tr(tab)}</button>
        ))}
      </section>

      {activeTab === 'home' && (
        <section className="home-layout">
          {activeBanners.length > 0 ? (
            <div className="desktop-hero-banner">
              <img
                src={(activeBanners[currentBannerIndex] || activeBanners[0]).image}
                alt={(activeBanners[currentBannerIndex] || activeBanners[0]).altTextMy && language === 'my' ? activeBanners[currentBannerIndex].altTextMy : (activeBanners[currentBannerIndex] || activeBanners[0]).altText || tr('Promotional Banner')}
                className="desktop-banner-img"
              />
            </div>
          ) : (
            <article className="hero-block">
              <p className="kicker">{tr('Home')}</p>
              <h2>{tr('Banner / Hero')}</h2>
              <p>{tr('Curated fashion essentials with strong value, quick delivery, and easy returns.')}</p>
            </article>
          )}

          <article className="section-block">
            <h3>{tr('Categories Shortcuts')}</h3>
            <div className="chips">
              {Object.keys(CATEGORY_TREE).map((category) => <button key={category} onClick={() => { setActiveTab('categories'); setSelectedCategory(category) }}>{category}</button>)}
            </div>
          </article>

          <article className="section-block">
            <h3>{tr('Deals & Offers')}</h3>
            <DesktopProductRow products={products.filter((p) => p.oldPrice)} wishlist={wishlist} onWish={toggleWishlist} onAdd={addToCart} formatPrice={formatPrice} language={language} />
          </article>

          <article className="section-block">
            <h3>{tr('New Arrivals')}</h3>
            <DesktopProductRow products={products.slice(0, 4)} wishlist={wishlist} onWish={toggleWishlist} onAdd={addToCart} formatPrice={formatPrice} language={language} />
          </article>

          <article className="section-block">
            <h3>{tr('Best Sellers')}</h3>
            <DesktopProductRow products={[...products].sort((a, b) => b.rating - a.rating).slice(0, 4)} wishlist={wishlist} onWish={toggleWishlist} onAdd={addToCart} formatPrice={formatPrice} language={language} />
          </article>

          <article className="section-block">
            <h3>{tr('Recommended For You')}</h3>
            <DesktopProductRow products={[...products].sort((a, b) => a.price - b.price).slice(0, 4)} wishlist={wishlist} onWish={toggleWishlist} onAdd={addToCart} formatPrice={formatPrice} language={language} />
          </article>
        </section>
      )}

      {activeTab === 'categories' && (
        <section className="categories-layout">
          <aside className="category-nav">
            <h3>{tr('Categories')}</h3>
            {Object.keys(CATEGORY_TREE).map((category) => (
              <button key={category} className={(selectedCategory || 'Men') === category ? 'active' : ''} onClick={() => setSelectedCategory(category)}>{category}</button>
            ))}
            <div className="sub-list">
              {(CATEGORY_TREE[selectedCategory || 'Men'] || []).map((sub) => <span key={sub}>{sub}</span>)}
            </div>
          </aside>
          <div>
            <h3>{selectedCategory || 'Men'}</h3>
            <DesktopProductGrid products={filteredProducts} wishlist={wishlist} onWish={toggleWishlist} onAdd={addToCart} formatPrice={formatPrice} language={language} />
          </div>
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
            </select>
          </div>

          <p>{tr('Recent Searches')}: {recentSearches.length ? recentSearches.join(', ') : tr('None')}</p>
          <h4>{tr('Search Results')} ({filteredProducts.length})</h4>
          <DesktopProductGrid products={filteredProducts} wishlist={wishlist} onWish={toggleWishlist} onAdd={addToCart} formatPrice={formatPrice} language={language} />
        </section>
      )}

      {activeTab === 'wishlist' && (
        <section className="section-block">
          <h3>{tr('Wishlist')}</h3>
          <p>{tr('Saved Products, Move to Cart, Remove Item')}</p>
          <div className="product-grid">
            {wishlistProducts.map((product) => (
              <article key={product.id} className="product-card">
                <img src={product.image} alt={product.name} />
                <h4>{product.name}</h4>
                <p>{formatPrice(product.price)}</p>
                <div className="card-actions">
                  <button className="btn-primary" onClick={() => moveWishlistItemToCart(product.id)}>{tr('Move to Cart')}</button>
                  <button className="btn-ghost" onClick={() => toggleWishlist(product.id)}>{tr('Remove')}</button>
                </div>
              </article>
            ))}
            {!wishlistProducts.length && <p>{tr('No saved products yet.')}</p>}
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
            <h3>{tr('Orders')}</h3>
            {orders.map((order) => (
              <div key={order.id} className="order-row">
                <span>{order.orderNumber || order.id}</span>
                <span>{tr(order.status)}</span>
                <span>{formatPrice(order.total)}</span>
                <button className="btn-link" onClick={() => setSelectedOrder(order)}>{tr('Order Details')}</button>
              </div>
            ))}
            {!orders.length && <p>{tr('No orders yet.')}</p>}
          </article>

          <article className="card-block">
            <h3>{tr('Addresses')}</h3>
            {addressBook.map((address) => (
              <div key={address.id} className="order-row">
                <span>{tr(address.label)}: {address.value}</span>
                <button className="btn-link" onClick={() => updateAddress(address.id, { default: true })}>{tr('Default Address')}</button>
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
              compact
            />
            <p className="sr-only" role="status" aria-live="polite">{supportNotice}</p>
            <p>{tr('Track Order, Return / Refund, and support are available after order placement.')}</p>
          </article>

          {selectedOrder && (
            <article className="card-block">
              <h3>{tr('Order Details')}</h3>
              <p>{tr('Order')}: {selectedOrder.orderNumber || selectedOrder.id}</p>
              <p>{tr('Status')}: {tr(selectedOrder.status)}</p>
              <p>{tr('Payment')}: {tr(selectedOrder.paymentStatus)}</p>
              <p>{tr('Track Order and Return / Refund follow this status timeline.')}</p>
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

          <div className="coupon-row">
            <input value={coupon} onChange={(event) => setCoupon(event.target.value)} placeholder={tr('Promo code')} aria-label={tr('Promo code')} />
            {coupon && <small className={activePromotion ? 'promo-valid' : 'promo-invalid'}>{activePromotion ? `${activePromotion.name} ${tr('applied')}` : tr('No active promotion matches this code')}</small>}
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

      <footer className="footer-nav">
        <button onClick={() => setActiveTab('home')}>{tr('Home')}</button>
        <button onClick={() => setActiveTab('search')}>{tr('Search')}</button>
        <button onClick={() => setActiveTab('wishlist')}>{tr('Wishlist')}</button>
        <button onClick={() => setActiveTab('cart')}>{tr('Cart')} ({cart.reduce((count, item) => count + Number(item.quantity || 0), 0)})</button>
        <button onClick={() => setActiveTab('account')}>{tr('Profile')}</button>
      </footer>
    </main>
  )
}

function DesktopProductRow({ products, wishlist, onWish, onAdd, formatPrice, language }) {
  const tr = (text) => t(text, language)
  return (
    <div className="product-row">
      {products.slice(0, 4).map((product) => (
        <DesktopProductCard key={product.id} product={product} wished={wishlist.includes(product.id)} onWish={onWish} onAdd={onAdd} formatPrice={formatPrice} language={language} />
      ))}
      {!products.length && <p>{tr('No products found.')}</p>}
    </div>
  )
}

function DesktopProductGrid({ products, wishlist, onWish, onAdd, formatPrice, language }) {
  const tr = (text) => t(text, language)
  return (
    <div className="product-grid">
      {products.map((product) => (
        <DesktopProductCard key={product.id} product={product} wished={wishlist.includes(product.id)} onWish={onWish} onAdd={onAdd} formatPrice={formatPrice} language={language} />
      ))}
      {!products.length && <p>{tr('No matching products.')}</p>}
    </div>
  )
}

function DesktopProductCard({ product, wished, onWish, onAdd, formatPrice, language }) {
  const tr = (text) => t(text, language)
  const [size, setSize] = useState('')
  const [color, setColor] = useState('')
  const { sizes, colors } = getProductVariants(product)
  const variantRequired = sizes.length > 0 || colors.length > 0
  const canAdd = (!sizes.length || size) && (!colors.length || color)
  const selectedVariants = { ...(size ? { size } : {}), ...(color ? { color } : {}) }
  const selectedStock = getProductStock(product, selectedVariants)
  return (
    <article className="product-card">
      <img src={product.image} alt={product.name} />
      <div className="badge-row">
        <span>{product.category}</span>
        <button className={wished ? 'wished' : ''} onClick={() => onWish(product.id)}>{tr(wished ? 'Wish saved' : 'Wish')}</button>
      </div>
      <h4>{product.name}</h4>
      <p>{product.brand} · {product.subcategory}</p>
      <div className="price-row">
        <strong>{formatPrice(product.price)}</strong>
        {product.oldPrice && <small>{formatPrice(product.oldPrice)}</small>}
      </div>
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
