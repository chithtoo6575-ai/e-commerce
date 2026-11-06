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
    const response = await adminFetch(`/api/admin/products/${encodeURIComponent(id)}`, { method: 'DELETE' })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || adminT('Unable to delete product.'))
    setData((prev) => {
      if (!prev) return prev
      return { ...prev, products: (prev.products || []).filter((p) => String(p.id) !== String(id)) }
    })
    return result
  }

  const handleUpdateCustomerStatus = async (customerId, status) => {
    const response = await adminFetch(`/api/admin/customers/${encodeURIComponent(customerId)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || adminT('Unable to update customer status.'))
    if (!result.customer) throw new Error(adminT('The customer API returned no updated customer.'))
    setData((prev) => prev ? {
      ...prev,
      customers: (prev.customers || []).map((customer) =>
        String(customer.id) === String(result.customer.id) ? result.customer : customer
      )
    } : prev)
    return result.customer
  }

  // Category CRUD
  const handleSaveCategory = async (category) => {
    const isEdit = Boolean(category.id && data?.categories?.some((item) => String(item.id) === String(category.id)))
    const previousCategory = isEdit
      ? data.categories.find((item) => String(item.id) === String(category.id))
      : null
    const url = isEdit ? `/api/admin/categories/${encodeURIComponent(category.id)}` : '/api/admin/categories'
    const response = await adminFetch(url, {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(category)
    })
    const result = await readJsonResponse(response, adminT('Unable to save category.'))
    if (response.status === 401) {
      handleExpiredSession()
      throw new Error('Your Admin session has expired. Please sign in again.')
    }
    if (!response.ok) throw new Error(apiErrorMessage(result, adminT('Unable to save category.')))
    if (!result.category) throw new Error('The category API returned no saved category.')
    setData((prev) => {
      if (!prev) return prev
      const categories = isEdit
        ? prev.categories.map((item) => String(item.id) === String(result.category.id) ? result.category : item)
        : [...(prev.categories || []), result.category]
      const products = previousCategory && previousCategory.name !== result.category.name
        ? (prev.products || []).map((product) =>
          product.categoryId === previousCategory.id || product.category === previousCategory.id || product.category === previousCategory.name
            ? { ...product, category: result.category.name, categoryId: result.category.id }
            : product
        )
        : prev.products
      return { ...prev, categories, products }
    })
    return result.category
  }

  const handleDeleteCategory = async (id) => {
    const response = await adminFetch(`/api/admin/categories/${encodeURIComponent(id)}`, { method: 'DELETE' })
    const result = await readJsonResponse(response, adminT('Unable to delete category.'))
    if (response.status === 401) {
      handleExpiredSession()
      throw new Error('Your Admin session has expired. Please sign in again.')
    }
    if (!response.ok) throw new Error(apiErrorMessage(result, adminT('Unable to delete category.')))
    setData((prev) => {
      if (!prev) return prev
      return { ...prev, categories: (prev.categories || []).filter((c) => c.id !== id && c.name !== id) }
    })
    return true
  }

  const handleSaveSubCategory = async (subCategory) => {
    const isEdit = Boolean(subCategory.id && data?.subCategories?.some((item) => String(item.id) === String(subCategory.id)))
    const previousSubCategory = isEdit
      ? data.subCategories.find((item) => String(item.id) === String(subCategory.id))
      : null
    const url = isEdit ? `/api/admin/sub-categories/${encodeURIComponent(subCategory.id)}` : '/api/admin/sub-categories'
    const response = await adminFetch(url, {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subCategory)
    })
    const result = await readJsonResponse(response, adminT('Unable to save subcategory.'))
    if (response.status === 401) {
      handleExpiredSession()
      throw new Error('Your Admin session has expired. Please sign in again.')
    }
    if (!response.ok) throw new Error(apiErrorMessage(result, adminT('Unable to save subcategory.')))
    if (!result.subCategory) throw new Error('The subcategory API returned no saved subcategory.')
    setData((prev) => {
      if (!prev) return prev
      const subCategories = isEdit
        ? (prev.subCategories || []).map((item) => String(item.id) === String(result.subCategory.id) ? result.subCategory : item)
        : [...(prev.subCategories || []), result.subCategory]
      const products = previousSubCategory && previousSubCategory.name !== result.subCategory.name
        ? (prev.products || []).map((product) =>
          product.subCategoryId === previousSubCategory.id
            ? { ...product, subCategory: result.subCategory.name, subCategoryId: result.subCategory.id }
            : product
        )
        : prev.products
      return { ...prev, subCategories, products }
    })
    return result.subCategory
  }

  const handleDeleteSubCategory = async (id) => {
    const response = await adminFetch(`/api/admin/sub-categories/${encodeURIComponent(id)}`, { method: 'DELETE' })
    const result = await readJsonResponse(response, adminT('Unable to delete subcategory.'))
    if (response.status === 401) {
      handleExpiredSession()
      throw new Error('Your Admin session has expired. Please sign in again.')
    }
    if (!response.ok) throw new Error(apiErrorMessage(result, adminT('Unable to delete subcategory.')))
    setData((prev) => prev ? {
      ...prev,
      subCategories: (prev.subCategories || []).filter((item) => String(item.id) !== String(id))
    } : prev)
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
      onUpdateCustomerStatus={handleUpdateCustomerStatus}
      onSaveCategory={handleSaveCategory}
      onDeleteCategory={handleDeleteCategory}
      onSaveSubCategory={handleSaveSubCategory}
      onDeleteSubCategory={handleDeleteSubCategory}
      onUpdateOrder={handleUpdateOrder}
      language={language}
      onLanguageChange={changeLanguage}
    />
  )
}
