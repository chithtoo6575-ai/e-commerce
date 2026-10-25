import React, { useState, useEffect, useMemo } from 'react'
import './AdminTheme.css'
import ToastContainer from './components/Toast'
import {
  IconSearch,
  IconSun,
  IconMoon,
  IconSidebarCollapse,
  IconSidebarExpand,
  IconLogout,
  IconArrowUpRight,
  IconMenu,
  IconChevronDown,
  IconNotifications
} from './AdminIcons'
import { NAV_STRUCTURE } from './navStructure'
import { adminFetch } from '../adminApi'

import DashboardPage from './pages/DashboardPage'
import ProductsPage from './pages/ProductsPage'
import CategoriesPage from './pages/CategoriesPage'
import SubCategoriesPage from './pages/SubCategoriesPage'
import StockMovementsPage from './pages/StockMovementsPage'
import BannerImagesPage from './pages/BannerImagesPage'
import HomeSectionsPage from './pages/HomeSectionsPage'
import HomeLayoutPage from './pages/HomeLayoutPage'
import OrdersPage from './pages/OrdersPage'
import OrderDetailsPage from './pages/OrderDetailsPage'
import ShippingRatesPage from './pages/ShippingRatesPage'
import DeliveryCompaniesPage from './pages/DeliveryCompaniesPage'
import PaymentMethodsPage from './pages/PaymentMethodsPage'
import CustomersPage from './pages/CustomersPage'
import NotificationsPage from './pages/NotificationsPage'
import SupportChannelsPage from './pages/SupportChannelsPage'
import HelpItemsPage from './pages/HelpItemsPage'

import { adminStore } from './adminStore'
import { adminT, AdminLanguageSelector } from './adminI18n'
import { getAdminPath, getAdminUrl } from './adminRouter'

function mapPaymentAccounts(payments) {
  return Object.values(payments).map((payment, index) => ({
    ...payment,
    icon: payment.type === 'cash' ? '💵' : payment.type === 'bank' ? '🏦' : '📱',
    description: payment.type === 'cash' ? 'Pay on delivery' : payment.type === 'bank' ? payment.bankName || 'Bank transfer' : 'Mobile wallet',
    instructions: payment.type === 'cash'
      ? 'Cash payment on delivery'
      : [payment.accountName, payment.bankName, payment.accountNumber || payment.phoneNumber].filter(Boolean).join(' · '),
    status: payment.enabled === true ? 'Active' : 'Inactive',
    sortOrder: Number.isInteger(payment.sortOrder) ? payment.sortOrder : index + 1
  })).sort((a, b) => a.sortOrder - b.sortOrder)
}

export default function AdminShell({
  auth,
  onLogout,
  data,
  onRefreshOrders,
  onAddStockMovement,
  onSaveProduct,
  onDeleteProduct,
  onSaveCategory,
  onDeleteCategory,
  onUpdateOrder,
  language,
  onLanguageChange
}) {
  // Determine active tab from URL path
  const getTabFromPath = () => {
    const path = getAdminPath().toLowerCase()
    for (const group of NAV_STRUCTURE) {
      for (const item of group.items) {
        if (path === item.path || (item.path === '/admin' && (path === '/admin/' || path === '/admin/dashboard'))) {
          return item.id
        }
      }
    }
    return 'Dashboard'
  }

  const [activeTab, setActiveTab] = useState(getTabFromPath)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false)
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false)
  const [headerSearch, setHeaderSearch] = useState('')
  const [selectedOrderForDrawer, setSelectedOrderForDrawer] = useState(null)
  // Reset the drawer hand-off after it is consumed, so returning to Orders from the
  // sidebar does not immediately reopen an order opened from အော်ဒါအသေးစိတ်.
  const [autoOpenOrder, setAutoOpenOrder] = useState(null)
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('htoo_admin_theme') === 'light' ? 'light' : 'dark'
    } catch (storageError) {
      console.warn('[AdminShell] Could not read the dashboard theme preference:', storageError)
      return 'dark'
    }
  })

  // Toast Notifications system
  const [toasts, setToasts] = useState([])
  const showToast = (message, type = 'success', title = '') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    setToasts((prev) => [...prev, { id, message, type, title }])
  }
  const dismissToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  // Manage Extended Store State
  const [subCategories, setSubCategories] = useState(() => adminStore.getSubCategories())
  const [localStockMovements] = useState(() => adminStore.getStockMovements())
  const [banners, setBanners] = useState(() => adminStore.getBanners())
  const [homeSections, setHomeSections] = useState(() => adminStore.getHomeSections())
  const [homeLayout, setHomeLayout] = useState(() => adminStore.getHomeLayout())
  const [shippingRates, setShippingRates] = useState(() => adminStore.getShippingRates())
  const [deliveryCompanies, setDeliveryCompanies] = useState(() => adminStore.getDeliveryCompanies())
  const [paymentMethods, setPaymentMethods] = useState(() => adminStore.getPaymentMethods())
  const [notifications, setNotifications] = useState(() => adminStore.getNotifications())
  const [supportChannels, setSupportChannels] = useState(() => adminStore.getSupportChannels())
  const [helpItems, setHelpItems] = useState(() => adminStore.getHelpItems())

  useEffect(() => {
    let active = true
    adminFetch('/api/admin/payments')
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Unable to load payment methods.')
        if (!result.payments || typeof result.payments !== 'object' || Array.isArray(result.payments)) {
          throw new Error('The payment methods API returned invalid data.')
        }
        if (active) setPaymentMethods(mapPaymentAccounts(result.payments))
      })
      .catch((paymentError) => {
        console.error('[AdminShell] Could not load payment methods:', paymentError)
        if (active) showToast(paymentError.message || 'Unable to load payment methods.', 'error')
      })
    return () => { active = false }
  }, [])

  const stockMovements = useMemo(() => {
    const serverMovements = Array.isArray(data?.stockMovements) ? data.stockMovements : []
    const serverIds = new Set(serverMovements.map((movement) => movement.id))
    return [...serverMovements, ...localStockMovements.filter((movement) => !serverIds.has(movement.id))]
  }, [data, localStockMovements])

  // Keep active tab synced with browser popstate
  useEffect(() => {
    const handlePopState = () => {
      setActiveTab(getTabFromPath())
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.adminTheme = theme
    try {
      localStorage.setItem('htoo_admin_theme', theme)
    } catch (storageError) {
      console.warn('[AdminShell] Could not save the dashboard theme preference:', storageError)
    }
  }, [theme])

  // Sync support channels from the server, which is what the storefront Help page reads.
  useEffect(() => {
    let active = true
    adminFetch('/api/admin/support-channels')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data) return
        if (!Array.isArray(data.channels)) return
        adminStore.saveSupportChannels(data.channels)
        setSupportChannels(data.channels)
      })
      .catch((channelError) => {
        console.warn('[AdminShell] Could not load support channels from the server:', channelError)
      })
    return () => { active = false }
  }, [])

  const saveSupportChannels = async (updated) => {
    try {
      const response = await adminFetch('/api/admin/support-channels', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channels: updated })
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to save support channels.')
      const saved = Array.isArray(result.channels) ? result.channels : updated
      adminStore.saveSupportChannels(saved)
      setSupportChannels(saved)
      showToast('Support channels published to the Help page.', 'success')
    } catch (channelError) {
      // Keep the admin's edit locally so it is not lost, and surface the failure.
      console.error('[AdminShell] Could not save support channels:', channelError)
      adminStore.saveSupportChannels(updated)
      setSupportChannels(updated)
      showToast(channelError.message || 'Unable to save support channels.', 'error')
    }
  }

  // Sync banners from server
  useEffect(() => {
    adminFetch('/api/admin/banners')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data && Array.isArray(data.banners) && data.banners.length) {
          setBanners(data.banners)
          adminStore.saveBanners(data.banners)
        }
      })
      .catch(() => {})
  }, [])

  // Navigate helper that updates URL cleanly
  const navigateTo = (tabId) => {
    setActiveTab(tabId)
    setAutoOpenOrder(null)
    setSelectedOrderForDrawer(null)
    setMobileMenuOpen(false)
    setProfileDropdownOpen(false)
    setNotifDropdownOpen(false)

    let targetPath = '/admin'
    for (const group of NAV_STRUCTURE) {
      const found = group.items.find((it) => it.id === tabId)
      if (found) {
        targetPath = found.path
        break
      }
    }
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, '', getAdminUrl(targetPath))
    }
  }

  // Breadcrumb helper
  const currentNavGroup = useMemo(() => {
    for (const group of NAV_STRUCTURE) {
      if (group.items.some((it) => it.id === activeTab)) {
        return group.group
      }
    }
    return 'GENERAL'
  }, [activeTab])

  // Header search submit
  const handleHeaderSearchSubmit = (e) => {
    if (e.key === 'Enter' && headerSearch.trim()) {
      if (headerSearch.match(/\d|HT-/i)) {
        navigateTo('Orders')
      } else {
        navigateTo('Products')
      }
    }
  }

  // Persist stock and its audit movement together through the backend.
  const handleAddStockMovement = async (movement) => {
    if (!onAddStockMovement) throw new Error(adminT('The stock movement API is unavailable.', language))
    await onAddStockMovement(movement)
  }

  const handleSavePaymentMethods = async (methods) => {
    const response = await adminFetch('/api/admin/payments', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        methods: methods.map(({ id, status, sortOrder }) => ({ id, status, sortOrder }))
      })
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Unable to update payment methods.')
    if (!result.payments || typeof result.payments !== 'object' || Array.isArray(result.payments)) {
      throw new Error('The payment methods API returned invalid data.')
    }
    const updated = mapPaymentAccounts(result.payments)
    setPaymentMethods(updated)
    return updated
  }

  const handleCreatePaymentMethod = async (method) => {
    const response = await adminFetch('/api/admin/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(method)
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Unable to add payment method.')
    if (!result.payment || typeof result.payment !== 'object' || Array.isArray(result.payment)) {
      throw new Error('The payment methods API returned invalid data.')
    }
    setPaymentMethods((current) => {
      const payments = Object.fromEntries(current.map((item) => [item.id, item]))
      payments[result.payment.id] = result.payment
      return mapPaymentAccounts(payments)
    })
    return result.payment
  }

  const handleUpdatePaymentMethod = async (method) => {
    const { id, ...changes } = method
    const response = await adminFetch(`/api/admin/payments/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(changes)
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Unable to update payment method.')
    if (!result.payment || typeof result.payment !== 'object' || Array.isArray(result.payment)) {
      throw new Error('The payment methods API returned invalid data.')
    }
    setPaymentMethods((current) => {
      const payments = Object.fromEntries(current.map((item) => [item.id, item]))
      payments[result.payment.id] = result.payment
      return mapPaymentAccounts(payments)
    })
    return result.payment
  }

  const handleDeletePaymentMethod = async (id) => {
    const response = await adminFetch(`/api/admin/payments/${encodeURIComponent(id)}`, { method: 'DELETE' })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Unable to delete payment method.')
    if (result.id !== id) throw new Error('The payment methods API returned invalid data.')
    setPaymentMethods((current) => current.filter((method) => method.id !== id))
  }

  const orders = data?.orders || []
  const products = data?.products || []
  const categories = data?.categories || []
  const customers = data?.customers || []

  return (
    <div className="admin-shell">
      {/* Toast Alert Container */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* ---------------- SIDEBAR ---------------- */}
      <aside className={`admin-sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${mobileMenuOpen ? 'open' : ''}`}>
        {/* Brand Header */}
        <div className="sidebar-brand-box">
          <a
            href="/admin"
            className="brand-link"
            onClick={(e) => { e.preventDefault(); navigateTo('Dashboard') }}
          >
            <img
              className="brand-mark-logo"
              src={`${import.meta.env.BASE_URL}logo-white.svg`}
              alt={adminT("H logo")}
            />
          </a>
          <button
            className="sidebar-collapse-toggle"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={adminT(sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar', language)}
          >
            {sidebarCollapsed ? <IconSidebarExpand size={16} /> : <IconSidebarCollapse size={16} />}
          </button>
        </div>

        {/* Scrollable Navigation Groups */}
        <div className="sidebar-scroll-area">
          {NAV_STRUCTURE.map((group) => (
            <div key={group.group} className="sidebar-group">
              <div className="sidebar-group-title">
                {sidebarCollapsed ? adminT(group.group, language).slice(0, 3) : adminT(group.group, language)}
              </div>
              {group.items.map((item) => {
                const IconComponent = item.icon
                const isActive = activeTab === item.id
                return (
                  <button
                    key={item.id}
                    className={`sidebar-menu-btn ${isActive ? 'active' : ''}`}
                    onClick={() => navigateTo(item.id)}
                    title={sidebarCollapsed ? adminT(item.label, language) : undefined}
                  >
                    <span className="sidebar-icon">
                      <IconComponent size={18} />
                    </span>
                    {!sidebarCollapsed && (
                      <span className="sidebar-label">{adminT(item.label, language)}</span>
                    )}
                    {!sidebarCollapsed && item.id === 'Orders' && orders.some((o) => o.status === 'New' || o.status === 'Pending') && (
                      <span className="sidebar-counter">
                        {orders.filter((o) => o.status === 'New' || o.status === 'Pending').length}
                      </span>
                    )}
                    {!sidebarCollapsed && item.id === 'Products' && products.some((p) => p.stock <= 5) && (
                      <span className="sidebar-counter" style={{ backgroundColor: 'var(--admin-warning-soft)', color: 'var(--admin-warning)' }}>
                        !
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        {/* Sidebar Footer with Profile & Live status */}
        <div className="sidebar-footer">
          <div className="sidebar-user-info">
            <div className="user-avatar-sm">
              {(auth?.email || 'CH').slice(0, 2).toUpperCase()}
            </div>
            {!sidebarCollapsed && (
              <div className="user-names-col">
                <span className="user-display-name">{adminT("Chit Htoo")}</span>
                <span className="user-role-label">{adminT('Owner Access', language)}</span>
              </div>
            )}
          </div>
          <button
            className="sidebar-logout-btn"
            onClick={onLogout}
            title={adminT('Log out of HTOO Admin', language)}
          >
            <IconLogout size={15} />
          </button>
        </div>
      </aside>

      {/* ---------------- MAIN CONTAINER ---------------- */}
      <div className={`admin-main-wrap ${sidebarCollapsed ? 'expanded' : ''}`}>
        {/* Sticky Header */}
        <header className="admin-header">
          <div className="header-left">
            <button
              className="header-mobile-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <IconMenu size={20} />
            </button>
            <div>
              <div className="breadcrumb-trail">
                <span>{adminT('HTOO ADMIN', language)}</span>
                <span>/</span>
                <span>{adminT(currentNavGroup, language)}</span>
                <span>/</span>
                <span className="gold">{adminT(activeTab, language)}</span>
              </div>
              <h1 className="header-page-title">{adminT(activeTab, language)}</h1>
            </div>
          </div>

          <div className="header-tools">
            <AdminLanguageSelector language={language} onChange={onLanguageChange} />
            <button
              className="header-icon-action theme-toggle-button"
              type="button"
              aria-label={adminT(theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode', language)}
              title={adminT(theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode', language)}
              onClick={() => setTheme((currentTheme) => currentTheme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? <IconSun size={17} /> : <IconMoon size={17} />}
            </button>
            {/* Global Search */}
            <div className="header-search-wrap">
              <IconSearch size={15} className="header-search-icon" />
              <input
                type="text"
                placeholder={adminT('Search orders, SKU, products...', language)}
                value={headerSearch}
                onChange={(e) => setHeaderSearch(e.target.value)}
                onKeyDown={handleHeaderSearchSubmit}
              />
            </div>

            {/* Notifications Dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                className="header-icon-action"
                onClick={() => setNotifDropdownOpen(!notifDropdownOpen)}
                title={adminT('Store Notifications', language)}
              >
                <IconNotifications size={17} />
                <span className="notif-badge-indicator" />
              </button>
              {notifDropdownOpen && (
                <div className="profile-dropdown-card" style={{ width: 280, right: 0 }}>
                  <div className="profile-dropdown-header">
                    <strong>{adminT('Recent Activity Alerts', language)}</strong>
                    <small>{adminT('Real-time system updates', language)}</small>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '4px 0' }}>
                    <div style={{ fontSize: 12, padding: '6px 8px', borderBottom: '1px solid var(--admin-line-subtle)' }}>
                      <span className="gold-accent-text" style={{ fontWeight: 600 }}>{adminT('New Order Placed', language)}</span>
                      <p style={{ margin: '2px 0 0', color: 'var(--admin-text-secondary)', fontSize: 11 }}>{adminT('Order HT-288BD843 received via COD', language)}</p>
                    </div>
                    <div style={{ fontSize: 12, padding: '6px 8px' }}>
                      <span style={{ color: 'var(--admin-warning)', fontWeight: 600 }}>{adminT('Low Stock Alert', language)}</span>
                      <p style={{ margin: '2px 0 0', color: 'var(--admin-text-secondary)', fontSize: 11 }}>{adminT('Sneaker, Running Shoes below threshold (5)', language)}</p>
                    </div>
                  </div>
                  <button
                    className="admin-link-btn"
                    style={{ padding: '8px 10px', width: '100%', textAlign: 'center', display: 'block', fontSize: 11 }}
                    onClick={() => { setNotifDropdownOpen(false); navigateTo('Notifications') }}
                  >
                    {adminT('View All Notifications →', language)}
                  </button>
                </div>
              )}
            </div>

            {/* View Storefront Link */}
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="store-link-btn"
              title={adminT('Open customer storefront in new tab', language)}
            >
              <span>{adminT('View Shop', language)}</span>
              <IconArrowUpRight size={13} />
            </a>

            {/* Profile Dropdown */}
            <div className="header-profile-menu">
              <button
                className="header-user-btn"
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              >
                <div className="user-avatar-sm" style={{ width: 26, height: 26, fontSize: 10 }}>
                  {(auth?.email || 'CH').slice(0, 2).toUpperCase()}
                </div>
                <span className="font-medium text-sm">{adminT("Chit Htoo")}</span>
                <IconChevronDown size={14} className="text-muted" />
              </button>

              {profileDropdownOpen && (
                <div className="profile-dropdown-card">
                  <div className="profile-dropdown-header">
                    <strong>{adminT("Chit Htoo")}</strong>
                    <small>{auth?.email || 'chithtoo6575@gmail.com'}</small>
                  </div>
                  <button
                    className="dropdown-item-btn"
                    onClick={() => { setProfileDropdownOpen(false); navigateTo('Payment Methods') }}
                  >
                    {adminT('Payment Settings', language)}
                  </button>
                  <button
                    className="dropdown-item-btn"
                    onClick={() => { setProfileDropdownOpen(false); navigateTo('Shipping Rates') }}
                  >
                    {adminT('Shipping Configuration', language)}
                  </button>
                  <button
                    className="dropdown-item-btn item-danger"
                    onClick={() => { setProfileDropdownOpen(false); onLogout?.() }}
                  >
                    {adminT('Log Out', language)}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ---------------- ACTIVE PAGE DISPATCHER ---------------- */}
        <main style={{ minHeight: 'calc(100vh - 68px)' }}>
          {/* GROUP 1: GENERAL */}
          {activeTab === 'Dashboard' && (
            <DashboardPage
              data={data}
              onNavigate={navigateTo}
              onOpenOrder={(order) => {
                // navigateTo clears both hand-off states, so queue it afterwards.
                navigateTo('Orders')
                setAutoOpenOrder(order)
              }}
              onOpenProductModal={() => {
                navigateTo('Products')
              }}
            />
          )}

          {/* GROUP 2: PRODUCT MANAGEMENT */}
          {activeTab === 'Products' && (
            <ProductsPage
              products={products}
              categories={categories}
              subCategories={subCategories}
              onSaveProduct={onSaveProduct}
              onDeleteProduct={onDeleteProduct}
              showToast={showToast}
            />
          )}

          {activeTab === 'Categories' && (
            <CategoriesPage
              categories={categories}
              products={products}
              onSaveCategory={onSaveCategory}
              onDeleteCategory={onDeleteCategory}
              showToast={showToast}
            />
          )}

          {activeTab === 'Sub Categories' && (
            <SubCategoriesPage
              subCategories={subCategories}
              categories={categories}
              onSaveSubCategory={(saved) => {
                const exists = subCategories.some((sc) => sc.id === saved.id)
                let updated
                if (exists) updated = subCategories.map((sc) => sc.id === saved.id ? saved : sc)
                else updated = [...subCategories, saved]
                adminStore.saveSubCategories(updated)
                setSubCategories(updated)
              }}
              onDeleteSubCategory={(id) => {
                const updated = subCategories.filter((sc) => sc.id !== id)
                adminStore.saveSubCategories(updated)
                setSubCategories(updated)
              }}
              showToast={showToast}
            />
          )}

          {activeTab === 'Stock Movements' && (
            <StockMovementsPage
              movements={stockMovements}
              products={products}
              onAddMovement={handleAddStockMovement}
              showToast={showToast}
            />
          )}

          {/* GROUP 3: STOREFRONT */}
          {activeTab === 'Banner Images' && (
            <BannerImagesPage
              banners={banners}
              onSaveBanner={async (saved) => {
                const exists = banners.some((b) => b.id === saved.id)
                let updated
                if (exists) updated = banners.map((b) => b.id === saved.id ? saved : b)
                else updated = [...banners, saved]
                adminStore.saveBanners(updated)
                setBanners(updated)
                try {
                  await adminFetch('/api/admin/banners', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(saved)
                  })
                } catch (err) {
                  console.warn('[AdminShell] Failed to save banner to API:', err)
                }
              }}
              onDeleteBanner={async (id) => {
                const updated = banners.filter((b) => b.id !== id)
                adminStore.saveBanners(updated)
                setBanners(updated)
                try {
                  await adminFetch(`/api/admin/banners/${encodeURIComponent(id)}`, { method: 'DELETE' })
                } catch (err) {
                  console.warn('[AdminShell] Failed to delete banner from API:', err)
                }
              }}
              showToast={showToast}
            />
          )}

          {activeTab === 'Home Sections' && (
            <HomeSectionsPage
              sections={homeSections}
              onSaveSections={(updated) => {
                adminStore.saveHomeSections(updated)
                setHomeSections(updated)
              }}
              showToast={showToast}
            />
          )}

          {activeTab === 'Home Layout' && (
            <HomeLayoutPage
              layout={homeLayout}
              onSaveLayout={(updated) => {
                adminStore.saveHomeLayout(updated)
                setHomeLayout(updated)
              }}
              showToast={showToast}
            />
          )}

          {/* GROUP 4: SALES */}
          {activeTab === 'Orders' && (
            <OrdersPage
              orders={orders}
              onUpdateOrder={onUpdateOrder}
              onRefreshOrders={onRefreshOrders}
              selectedOrderFromNav={selectedOrderForDrawer || autoOpenOrder}
              showToast={showToast}
            />
          )}

          {activeTab === 'အော်ဒါအသေးစိတ်' && (
            <OrderDetailsPage
              orders={orders}
              onUpdateOrder={onUpdateOrder}
              onRefreshOrders={onRefreshOrders}
              showToast={showToast}
            />
          )}

          {activeTab === 'Shipping Rates' && (
            <ShippingRatesPage
              rates={shippingRates}
              onSaveRates={(updated) => {
                adminStore.saveShippingRates(updated)
                setShippingRates(updated)
              }}
              showToast={showToast}
            />
          )}

          {activeTab === 'Delivery Companies' && (
            <DeliveryCompaniesPage
              companies={deliveryCompanies}
              onSaveCompanies={(updated) => {
                adminStore.saveDeliveryCompanies(updated)
                setDeliveryCompanies(updated)
              }}
              showToast={showToast}
            />
          )}

          {activeTab === 'Payment Methods' && (
            <PaymentMethodsPage
              methods={paymentMethods}
              onSaveMethods={handleSavePaymentMethods}
              onAddMethod={handleCreatePaymentMethod}
              onUpdateMethod={handleUpdatePaymentMethod}
              onDeleteMethod={handleDeletePaymentMethod}
              showToast={showToast}
            />
          )}

          {/* GROUP 5: CUSTOMER RELATION */}
          {activeTab === 'Customers' && (
            <CustomersPage
              customers={customers}
              orders={orders}
              showToast={showToast}
            />
          )}

          {activeTab === 'Notifications' && (
            <NotificationsPage
              notifications={notifications}
              onSaveNotifications={(updated) => {
                adminStore.saveNotifications(updated)
                setNotifications(updated)
              }}
              showToast={showToast}
            />
          )}

          {activeTab === 'Support Channels' && (
            <SupportChannelsPage
              channels={supportChannels}
              onSaveChannels={saveSupportChannels}
              showToast={showToast}
            />
          )}

          {activeTab === 'Help Items' && (
            <HelpItemsPage
              helpItems={helpItems}
              onSaveHelpItems={(updated) => {
                adminStore.saveHelpItems(updated)
                setHelpItems(updated)
              }}
              showToast={showToast}
            />
          )}
        </main>
      </div>
    </div>
  )
}
