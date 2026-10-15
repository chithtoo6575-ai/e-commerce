import React, { useEffect, useState, useCallback } from 'react'
import AdminShell from './admin/AdminShell'
import { adminT, AdminLanguageSelector, getAdminLanguage, setAdminLanguage } from './admin/adminI18n'
import './admin/AdminTheme.css'

export default function AdminApp() {
  const [language, setLanguage] = useState(getAdminLanguage)
  const [auth, setAuth] = useState(null)
  const [login, setLogin] = useState({ email: 'chithtoo6575@gmail.com', password: '' })
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  const changeLanguage = (nextLanguage) => {
    const next = setAdminLanguage(nextLanguage)
    setLanguage(next)
    if (!auth) return
    fetch('/api/admin/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ languagePreference: next })
    })
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Unable to save Admin language preference.')
      })
      .catch((preferenceError) => {
        console.error('[AdminApp] Could not save the Admin language preference:', preferenceError)
      })
  }

  const restoreAdminLanguage = (admin) => {
    if (admin?.languagePreference === 'my' || admin?.languagePreference === 'en') {
      setLanguage(setAdminLanguage(admin.languagePreference))
    }
  }

  // Load dashboard data only from the persistent API.
  const loadDashboard = useCallback(async () => {
    const response = await fetch('/api/admin/dashboard')
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || adminT('Unable to load the Admin dashboard.'))
    setData(result)
  }, [])

  useEffect(() => {
    if (!auth) return undefined
    const refresh = () => { void loadDashboard() }
    const timer = window.setInterval(refresh, 15_000)
    window.addEventListener('focus', refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [auth, loadDashboard])

  // Check existing session
  useEffect(() => {
    let active = true
    async function restoreAdminSession() {
      try {
        const response = await fetch('/api/admin/session')
        if (!response.ok) {
          if (response.status !== 401) throw new Error(adminT('Unable to verify the Admin session.'))
          return
        }
        const { admin } = await response.json()
        if (!admin) return
        await loadDashboard()
        if (active) {
          restoreAdminLanguage(admin)
          setAuth(admin)
        }
      } catch (sessionError) {
        console.error('[AdminApp] Could not restore the Admin session:', sessionError)
        if (active)         setError('Unable to load the Admin dashboard. Please try again.')
      } finally {
        if (active) setLoading(false)
      }
    }
    restoreAdminSession()
    return () => { active = false }
  }, [loadDashboard])

  // Login handler
  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(login)
      })
      const result = await res.json()
      if (!res.ok) {
        setError(result.error || 'Invalid email or password.')
        return
      }
      await loadDashboard()
      restoreAdminLanguage(result.admin)
      setAuth(result.admin)
    } catch (loginError) {
      console.error('[AdminApp] Admin login failed:', loginError)
      setError(loginError.message || 'Unable to sign in to the Admin dashboard.')
    }
  }

  // Logout handler
  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' })
    } catch (logoutError) {
      console.error('[AdminApp] Admin logout failed:', logoutError)
    }
    setAuth(null)
  }

  // Product CRUD
  const handleSaveProduct = async (product) => {
    const isEdit = Boolean(product.id != null && data?.products?.some((p) => String(p.id) === String(product.id)))
    const url = isEdit ? `/api/admin/products/${encodeURIComponent(product.id)}` : '/api/admin/products'
    const res = await fetch(url, {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product)
    })
    const result = await res.json()
    if (!res.ok) throw new Error(result.error || adminT('Unable to save product.'))
    if (!result.product) throw new Error(adminT('The product API returned no saved product.'))
    setData((prev) => {
      if (!prev) return prev
      const updatedProducts = isEdit
        ? prev.products.map((item) => String(item.id) === String(result.product.id) ? result.product : item)
        : [result.product, ...(prev.products || [])]
      return { ...prev, products: updatedProducts }
    })
    return true
  }

  const handleAddStockMovement = async (movement) => {
    const response = await fetch('/api/admin/stock-movements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(movement)
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || adminT('Unable to record stock movement.'))
    if (!result.movement || !result.product) throw new Error(adminT('The stock API returned an incomplete response.'))
    setData((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        products: (prev.products || []).map((product) => String(product.id) === String(result.product.id) ? result.product : product),
        stockMovements: [result.movement, ...(prev.stockMovements || []).filter((item) => item.id !== result.movement.id)]
      }
    })
    return result.movement
  }

  const handleDeleteProduct = async (id) => {
    try {
      await fetch(`/api/admin/products/${encodeURIComponent(id)}`, { method: 'DELETE' })
    } catch {}
    setData((prev) => {
      if (!prev) return prev
      return { ...prev, products: (prev.products || []).filter((p) => String(p.id) !== String(id)) }
    })
    return true
  }

  // Category CRUD
  const handleSaveCategory = async (category) => {
    const isEdit = Boolean(category.id && data?.categories?.some((c) => c.id === category.id))
    try {
      const url = isEdit ? `/api/admin/categories/${encodeURIComponent(category.id)}` : '/api/admin/categories'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(category)
      })
      if (res.ok) {
        const result = await res.json()
        setData((prev) => {
          if (!prev) return prev
          const updated = isEdit
            ? prev.categories.map((c) => c.id === category.id ? result.category : c)
            : [...(prev.categories || []), result.category]
          return { ...prev, categories: updated }
        })
        return true
      }
    } catch {}

    // Local state fallback
    setData((prev) => {
      if (!prev) return prev
      const updated = isEdit
        ? prev.categories.map((c) => c.id === category.id ? category : c)
        : [...(prev.categories || []), category]
      return { ...prev, categories: updated }
    })
    return true
  }

  const handleDeleteCategory = async (id) => {
    try {
      await fetch(`/api/admin/categories/${encodeURIComponent(id)}`, { method: 'DELETE' })
    } catch {}
    setData((prev) => {
      if (!prev) return prev
      return { ...prev, categories: (prev.categories || []).filter((c) => c.id !== id && c.name !== id) }
    })
    return true
  }

  // Order Update
  const handleUpdateOrder = async (id, changes) => {
    try {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes)
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || adminT('Unable to update this order.'))
      if (!result.order) throw new Error(adminT('The order API returned no updated order.'))
      setData((prev) => prev ? {
        ...prev,
        orders: (prev.orders || []).map((order) => order.id === id ? result.order : order)
      } : prev)
      return result.order
    } catch (updateError) {
      console.error('[AdminApp] Order update failed:', updateError)
      throw updateError
    }
  }

  const handleRefreshOrders = async () => {
    const response = await fetch('/api/admin/dashboard')
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || adminT('Unable to refresh orders.'))
    setData(result)
    return result.orders || []
  }

  if (loading) {
    return (
    <>
    <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 10 }}>
      <AdminLanguageSelector language={language} onChange={changeLanguage} />
    </div>
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', backgroundColor: '#0b0f19', color: '#d4af37', fontFamily: "'Playfair Display', serif", fontSize: 28, letterSpacing: '0.15em' }}>{' ' + adminT("HTOO ATELIER") + ' '}</div>
    </>
    )
  }

  // Login Screen
  if (!auth) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', backgroundColor: '#0b0f19', padding: 20 }}>
        <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 10 }}>
          <AdminLanguageSelector language={language} onChange={changeLanguage} />
        </div>
        <div style={{ width: 'min(440px, 100%)', backgroundColor: '#121929', border: '1px solid #1e2d47', borderRadius: 16, padding: '40px 32px', boxShadow: '0 20px 60px rgba(0,0,0,0.85)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: 'linear-gradient(135deg, #182030 0%, #0d121c 100%)', border: '1px solid rgba(212,175,55,0.3)', display: 'grid', placeItems: 'center', color: '#d4af37', fontWeight: 800, fontSize: 22 }}>{' ' + adminT("H") + ' '}</div>
            <div>
              <h2 style={{ margin: 0, fontFamily: "'Playfair Display', serif", color: '#f8fafc', fontSize: 22 }}>{adminT("HTOO ATELIER")}</h2>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#d4af37', letterSpacing: '0.12em' }}>{adminT('SELLER DASHBOARD ACCESS', language)}</span>
            </div>
          </div>

          <p style={{ margin: '0 0 20px', color: '#94a3b8', fontSize: 13 }}>
            {adminT('Sign in to access inventory, sales orders, storefront merchandising, and customer support.', language)}
          </p>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>{adminT('Admin Email', language)}</label>
              <input
                type="email"
                required
                value={login.email}
                onChange={(e) => setLogin({ ...login, email: e.target.value })}
                style={{ padding: '10px 12px', backgroundColor: '#0b0f19', border: '1px solid #1e2d47', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>{adminT('Admin Password', language)}</label>
              <input
                type="password"
                required
                placeholder={adminT('Enter password', language)}
                value={login.password}
                onChange={(e) => setLogin({ ...login, password: e.target.value })}
                style={{ padding: '10px 12px', backgroundColor: '#0b0f19', border: '1px solid #1e2d47', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none' }}
              />
            </div>

            {error && (
              <div style={{ padding: '8px 12px', backgroundColor: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 6, color: '#ef4444', fontSize: 12 }}>
                {adminT(error, language)}
              </div>
            )}

            <button
              type="submit"
              style={{ padding: '11px 16px', background: 'linear-gradient(135deg, #d4af37 0%, #b89324 100%)', color: '#0b0f19', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer', marginTop: 6 }}
            >
              {adminT('Sign In to Dashboard →', language)}
            </button>

          </form>
        </div>
      </div>
    )
  }

  return (
    <AdminShell
      auth={auth}
      onLogout={handleLogout}
      data={data}
      onRefreshData={loadDashboard}
      onRefreshOrders={handleRefreshOrders}
      onAddStockMovement={handleAddStockMovement}
      onSaveProduct={handleSaveProduct}
      onDeleteProduct={handleDeleteProduct}
      onSaveCategory={handleSaveCategory}
      onDeleteCategory={handleDeleteCategory}
      onUpdateOrder={handleUpdateOrder}
      language={language}
      onLanguageChange={changeLanguage}
    />
  )
}
