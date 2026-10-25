import React, { useEffect, useState, useCallback } from 'react'
import AdminShell from './admin/AdminShell'
import AdminLoginPage from './admin/AdminLoginPage'
import { adminT, getAdminLanguage, setAdminLanguage } from './admin/adminI18n'
import { getAdminPath, getAdminUrl } from './admin/adminRouter'
import { readJsonResponse, apiErrorMessage } from './lib/apiResponse'
import { adminFetch } from './adminApi'
import './admin/AdminTheme.css'

export default function AdminApp() {
  const [language, setLanguage] = useState(getAdminLanguage)
  const [auth, setAuth] = useState(null)
  const [login, setLogin] = useState({ email: '', password: '' })
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const handleExpiredSession = useCallback(() => {
    setAuth(null)
    setData(null)
    setError('Your Admin session has expired. Please sign in again.')
    setLoading(false)
    if (getAdminPath() !== '/admin/login') {
      window.history.replaceState(null, '', getAdminUrl('/admin/login'))
    }
  }, [])

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  useEffect(() => {
    if (auth && getAdminPath() === '/admin/login') {
      window.history.replaceState(null, '', getAdminUrl('/admin'))
    } else if (!auth && !loading && getAdminPath() !== '/admin/login') {
      window.history.replaceState(null, '', getAdminUrl('/admin/login'))
    }
  }, [auth, loading])

  const changeLanguage = (nextLanguage) => {
    const next = setAdminLanguage(nextLanguage)
    setLanguage(next)
    if (!auth) return
    adminFetch('/api/admin/preferences', {
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
    const response = await adminFetch('/api/admin/dashboard')
    const result = await response.json()
    if (response.status === 401) {
      handleExpiredSession()
      throw new Error('Your Admin session has expired. Please sign in again.')
    }
    if (!response.ok) throw new Error(result.error || adminT('Unable to load the Admin dashboard.'))
    setData(result)
  }, [handleExpiredSession, language])

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
        const response = await adminFetch('/api/admin/session')
        if (!response.ok) {
          if (response.status === 401) {
            if (getAdminPath() !== '/admin/login') window.history.replaceState(null, '', getAdminUrl('/admin/login'))
            if (active) setError('')
            return
          }
          throw new Error(adminT('Unable to verify the Admin session.'))
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
        if (active) setError('Unable to load the Admin dashboard. Please try again.')
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
      const res = await adminFetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(login)
      })
      const result = await readJsonResponse(res, adminT('Unable to sign in. Please try again.', language))
      if (!res.ok) {
        setError(apiErrorMessage(result, adminT('Invalid email or password.', language)))
        return
      }
      if (!result.admin) throw new Error(adminT('The server returned an unexpected response. Please try again.', language))
      await loadDashboard()
      restoreAdminLanguage(result.admin)
      setAuth(result.admin)
    } catch (loginError) {
      console.error('[AdminApp] Admin login failed:', loginError)
      setError(loginError?.message || adminT('Unable to sign in to the Admin dashboard.', language))
    }
  }

  // Logout handler
  const handleLogout = async () => {
    try {
      await adminFetch('/api/admin/logout', { method: 'POST' })
    } catch (logoutError) {
      console.error('[AdminApp] Admin logout failed:', logoutError)
    }
    setAuth(null)
  }

  // Product CRUD
  const handleSaveProduct = async (product) => {
    const isEdit = Boolean(product.id != null && data?.products?.some((p) => String(p.id) === String(product.id)))
    const url = isEdit ? `/api/admin/products/${encodeURIComponent(product.id)}` : '/api/admin/products'
    const res = await adminFetch(url, {
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
    const response = await adminFetch('/api/admin/stock-movements', {
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
      await adminFetch(`/api/admin/products/${encodeURIComponent(id)}`, { method: 'DELETE' })
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
      const res = await adminFetch(url, {
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
      await adminFetch(`/api/admin/categories/${encodeURIComponent(id)}`, { method: 'DELETE' })
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
      const res = await adminFetch(`/api/admin/orders/${id}`, {
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
    const response = await adminFetch('/api/admin/dashboard')
    const result = await response.json()
    if (response.status === 401) {
      handleExpiredSession()
      throw new Error('Your Admin session has expired. Please sign in again.')
    }
    if (!response.ok) throw new Error(result.error || adminT('Unable to refresh orders.'))
    setData(result)
    return result.orders || []
  }

  if (loading) {
    return (
      <div className="admin-loading">{adminT('HTOO ATELIER')}</div>
    )
  }

  if (!auth) {
    return (
      <AdminLoginPage
        language={language}
        onLanguageChange={changeLanguage}
        login={login}
        onLoginChange={setLogin}
        onSubmit={handleLogin}
        error={error}
      />
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
