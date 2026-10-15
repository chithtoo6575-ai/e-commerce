import React, { useState, useMemo, useRef } from 'react'
import { adminT } from '../adminI18n'
import Badge from '../components/Badge'
import ConfirmModal from '../components/ConfirmModal'
import {
  IconPlus,
  IconSearch,
  IconEdit,
  IconTrash,
  IconEye,
  IconX
} from '../AdminIcons'
import { getVariantStockOptions } from '../../lib/productVariants'

const formatMoney = (val) => `Ks ${Math.round(val || 0).toLocaleString('en-US')}`

export default function ProductsPage({
  products = [],
  categories = [],
  subCategories = [],
  onSaveProduct,
  onDeleteProduct,
  showToast
}) {
  // Filters & State
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [subCategoryFilter, setSubCategoryFilter] = useState('All')
  const [stockFilter, setStockFilter] = useState('All') // 'All' | 'in_stock' | 'low_stock' | 'out_of_stock'
  const [statusFilter, setStatusFilter] = useState('All') // 'All' | 'Active' | 'Draft'
  const [sortBy, setSortBy] = useState('newest') // 'newest' | 'price_asc' | 'price_desc' | 'stock_asc' | 'name_asc'
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 8

  // Selection for bulk actions
  const [selectedIds, setSelectedIds] = useState([])

  // Modal / Drawer state
  const [editingProduct, setEditingProduct] = useState(null) // null = closed, {} = new, obj = edit
  const [viewingProduct, setViewingProduct] = useState(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)
  const [bulkActionConfirm, setBulkActionConfirm] = useState(null) // 'activate' | 'deactivate' | 'delete'

  // Filtered and sorted products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const name = (p.nameEn || p.name || '').toLowerCase()
      const sku = (p.sku || '').toLowerCase()
      const searchMatch = !searchTerm || name.includes(searchTerm.toLowerCase()) || sku.includes(searchTerm.toLowerCase())

      const catMatch = categoryFilter === 'All' || p.category === categoryFilter
      const subCatMatch = subCategoryFilter === 'All' || p.subCategory === subCategoryFilter

      let stockMatch = true
      const stock = Number(p.stock) || 0
      if (stockFilter === 'in_stock') stockMatch = stock > 5
      else if (stockFilter === 'low_stock') stockMatch = stock > 0 && stock <= 5
      else if (stockFilter === 'out_of_stock') stockMatch = stock === 0

      let statusMatch = true
      if (statusFilter === 'Active') statusMatch = p.enabled !== false && p.status !== 'Draft'
      else if (statusFilter === 'Draft') statusMatch = p.enabled === false || p.status === 'Draft'

      return searchMatch && catMatch && subCatMatch && stockMatch && statusMatch
    }).sort((a, b) => {
      if (sortBy === 'price_asc') return (a.price || 0) - (b.price || 0)
      if (sortBy === 'price_desc') return (b.price || 0) - (a.price || 0)
      if (sortBy === 'stock_asc') return (a.stock || 0) - (b.stock || 0)
      if (sortBy === 'name_asc') return (a.nameEn || a.name || '').localeCompare(b.nameEn || b.name || '')
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    })
  }, [products, searchTerm, categoryFilter, subCategoryFilter, stockFilter, statusFilter, sortBy])

  // Pagination
  const totalPages = Math.ceil(filteredProducts.length / pageSize) || 1
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredProducts.slice(start, start + pageSize)
  }, [filteredProducts, currentPage])

  // Checkbox helpers
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(paginatedProducts.map((p) => p.id))
    } else {
      setSelectedIds([])
    }
  }

  const handleSelectOne = (id) => {
    setSelectedIds((prev) =>
      prev.some((item) => String(item) === String(id))
        ? prev.filter((item) => String(item) !== String(id))
        : [...prev, id]
    )
  }

  // Bulk actions
  const handleExecuteBulkAction = async () => {
    if (!bulkActionConfirm) return
    if (bulkActionConfirm === 'delete') {
      for (const id of selectedIds) {
        await onDeleteProduct?.(id)
      }
      showToast?.('Selected products deleted successfully', 'success')
    } else if (bulkActionConfirm === 'activate') {
      for (const id of selectedIds) {
        const prod = products.find((p) => String(p.id) === String(id))
        if (prod) await onSaveProduct?.({ ...prod, enabled: true, status: 'Active' })
      }
      showToast?.('Selected products marked active', 'success')
    } else if (bulkActionConfirm === 'deactivate') {
      for (const id of selectedIds) {
        const prod = products.find((p) => String(p.id) === String(id))
        if (prod) await onSaveProduct?.({ ...prod, enabled: false, status: 'Draft' })
      }
      showToast?.('Selected products moved to draft', 'success')
    }
    setSelectedIds([])
    setBulkActionConfirm(null)
  }

  return (
    <div className="admin-page-content">
      {/* Page Header Bar */}
      <div className="page-header-actions">
        <div>
          <h2>{adminT("Product Catalog")}</h2>
          <p className="page-subtitle">{adminT("Manage items, inventory counts, pricing, and variants")}</p>
        </div>
        <button
          className="admin-btn-gold"
          onClick={() => setEditingProduct({
            name: '',
            nameEn: '',
            sku: '',
            category: categories[0]?.name || 'Clothing',
            subCategory: '',
            brand: 'HTOO Ateliers',
            price: 25000,
            salePrice: 0,
            costPrice: 15000,
            stock: 20,
            lowStockThreshold: 5,
            image: '',
            description: '',
            enabled: true,
            featured: false,
            tags: 'Luxury, New',
            variants: 'S, M, L, XL'
          })}
        >
          <IconPlus size={16} />
          <span>{adminT("Add Product")}</span>
        </button>
      </div>

      {/* Filter and Control Bar */}
      <div className="admin-card filter-card">
        <div className="filter-row">
          <div className="filter-search-box">
            <IconSearch size={15} className="search-icon-muted" />
            <input
              type="text"
              placeholder={adminT("Search by product title or SKU...")}
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1) }}
            />
            {searchTerm && (
              <button className="clear-btn" onClick={() => setSearchTerm('')}>
                <IconX size={13} />
              </button>
            )}
          </div>

          <div className="filter-dropdown-group">
            <select
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1) }}
              className="admin-select"
            >
              <option value="All">{adminT("All Categories")}</option>
              {categories.map((c) => (
                <option key={c.id || c.name} value={c.name}>{c.name}</option>
              ))}
            </select>

            <select
              value={subCategoryFilter}
              onChange={(e) => { setSubCategoryFilter(e.target.value); setCurrentPage(1) }}
              className="admin-select"
            >
              <option value="All">{adminT("All Sub Categories")}</option>
              {subCategories.map((sc) => (
                <option key={sc.id} value={sc.name}>{sc.name}</option>
              ))}
            </select>

            <select
              value={stockFilter}
              onChange={(e) => { setStockFilter(e.target.value); setCurrentPage(1) }}
              className="admin-select"
            >
              <option value="All">{adminT("All Stock Levels")}</option>
              <option value="in_stock">{adminT("In Stock (&gt;5)")}</option>
              <option value="low_stock">{adminT("Low Stock (1-5)")}</option>
              <option value="out_of_stock">{adminT("Out of Stock (0)")}</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1) }}
              className="admin-select"
            >
              <option value="All">{adminT("All Statuses")}</option>
              <option value="Active">{adminT("Active")}</option>
              <option value="Draft">{adminT("Draft")}</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="admin-select sort-select"
            >
              <option value="newest">{adminT("Sort: Newest")}</option>
              <option value="price_asc">{adminT("Price: Low to High")}</option>
              <option value="price_desc">{adminT("Price: High to Low")}</option>
              <option value="stock_asc">{adminT("Stock: Low to High")}</option>
              <option value="name_asc">{adminT("Name: A to Z")}</option>
            </select>
          </div>
        </div>

        {/* Bulk Action Bar when items selected */}
        {selectedIds.length > 0 && (
          <div className="bulk-action-bar">
            <span>{selectedIds.length} product(s) selected:</span>
            <div className="bulk-btn-group">
              <button
                className="admin-btn-secondary btn-sm"
                onClick={() => setBulkActionConfirm('activate')}
              >
                {adminT("Mark Active")}
              </button>
              <button
                className="admin-btn-secondary btn-sm"
                onClick={() => setBulkActionConfirm('deactivate')}
              >
                {adminT("Mark Draft")}
              </button>
              <button
                className="admin-btn-danger btn-sm"
                onClick={() => setBulkActionConfirm('delete')}
              >
                {adminT("Delete Selected")}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Products Table */}
      <div className="admin-card">
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input
                    type="checkbox"
                    checked={paginatedProducts.length > 0 && selectedIds.length === paginatedProducts.length}
                    onChange={handleSelectAll}
                  />
                </th>
                <th>{adminT("Product")}</th>
                <th>{adminT("SKU")}</th>
                <th>{adminT("Category")}</th>
                <th>{adminT("Price")}</th>
                <th>{adminT("Stock")}</th>
                <th>{adminT("Status")}</th>
                <th>{adminT("Created")}</th>
                <th className="th-action">{adminT("Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {paginatedProducts.length === 0 ? (
                <tr>
                  <td colSpan="9" className="table-empty-cell">{' ' + adminT("No products matched your criteria.") + ' '}</td>
                </tr>
              ) : (
                paginatedProducts.map((p) => {
                  const isSelected = selectedIds.some((item) => String(item) === String(p.id))
                  const isLow = Number(p.stock) > 0 && Number(p.stock) <= 5
                  const isOut = Number(p.stock) === 0
                  const isActive = p.enabled !== false && p.status !== 'Draft'

                  return (
                    <tr key={p.id} className={`table-row-hover ${isSelected ? 'row-selected' : ''}`}>
                      <td>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectOne(p.id)}
                        />
                      </td>
                      <td>
                        <div className="table-product-cell">
                          <div className="prod-thumb">
                            {p.image ? (
                              <img src={p.image} alt={p.nameEn || p.name} />
                            ) : (
                              <div className="thumb-placeholder">{(p.nameEn || p.name || 'P')[0]}</div>
                            )}
                          </div>
                          <div className="prod-info">
                            <strong className="prod-title">{p.nameEn || p.name}</strong>
                            {p.featured && <span className="featured-pill">{adminT("Featured")}</span>}
                          </div>
                        </div>
                      </td>
                      <td className="td-mono">{p.sku || 'SKU-000'}</td>
                      <td>
                        <span className="text-secondary">{p.category || 'General'}</span>
                        {p.subCategory && <small className="d-block text-muted">{p.subCategory}</small>}
                      </td>
                      <td>
                        <div className="price-cell">
                          <strong className="gold-accent-text">{formatMoney(p.price)}</strong>
                          {p.salePrice > 0 && (
                            <small className="sale-strike">{formatMoney(p.salePrice)}</small>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={`stock-indicator ${isOut ? 'stock-out' : isLow ? 'stock-low' : 'stock-ok'}`}>
                          {p.stock ?? 0}
                        </span>
                      </td>
                      <td>
                        <Badge variant={isActive ? 'Active' : 'Draft'}>
                          {adminT(isActive ? 'Active' : 'Draft')}
                        </Badge>
                      </td>
                      <td className="td-muted">
                        {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : 'Recent'}
                      </td>
                      <td className="td-action">
                        <div className="action-button-group">
                          <button
                            className="admin-icon-btn"
                            title={adminT("View product details")}
                            onClick={() => setViewingProduct(p)}
                          >
                            <IconEye size={15} />
                          </button>
                          <button
                            className="admin-icon-btn"
                            title={adminT("Edit product")}
                            onClick={() => setEditingProduct({ ...p })}
                          >
                            <IconEdit size={15} />
                          </button>
                          <button
                            className="admin-icon-btn btn-danger-hover"
                            title={adminT("Delete product")}
                            onClick={() => setDeleteConfirmId(p.id)}
                          >
                            <IconTrash size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="table-pagination-footer">
          <span className="pagination-info">
            Showing {filteredProducts.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{' '}
            {Math.min(currentPage * pageSize, filteredProducts.length)} of {filteredProducts.length} items
          </span>
          <div className="pagination-buttons">
            <button
              className="pagination-btn"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              {adminT("Previous")}
            </button>
            <span className="pagination-current">
              Page {currentPage} of {totalPages}
            </span>
            <button
              className="pagination-btn"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              {adminT("Next")}
            </button>
          </div>
        </div>
      </div>

      {/* Product Form Modal (Add / Edit) */}
      {editingProduct && (
        <ProductFormModal
          product={editingProduct}
          categories={categories}
          subCategories={subCategories}
          onClose={() => setEditingProduct(null)}
          onSave={async (savedData) => {
            try {
              if (!onSaveProduct) throw new Error('The product API is unavailable.')
              const ok = await onSaveProduct(savedData)
              if (!ok) throw new Error('The product was not saved.')
              showToast?.(savedData.id != null ? 'Product updated successfully' : 'Product created successfully', 'success')
              setEditingProduct(null)
            } catch (saveError) {
              showToast?.(saveError.message || 'Unable to save product changes.', 'error')
            }
          }}
        />
      )}

      {/* Product View Drawer */}
      {viewingProduct && (
        <ProductDetailDrawer
          product={viewingProduct}
          onClose={() => setViewingProduct(null)}
          onEdit={() => {
            const p = { ...viewingProduct }
            setViewingProduct(null)
            setEditingProduct(p)
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteConfirmId)}
        title={adminT("Delete Product")}
        message={adminT("Are you sure you want to delete this product? This action cannot be undone.")}
        confirmText={adminT("Delete")}
        danger={true}
        onConfirm={async () => {
          await onDeleteProduct?.(deleteConfirmId)
          showToast?.('Product deleted successfully', 'success')
          setDeleteConfirmId(null)
        }}
        onCancel={() => setDeleteConfirmId(null)}
      />

      {/* Bulk Action Confirm Modal */}
      <ConfirmModal
        isOpen={Boolean(bulkActionConfirm)}
        title={`Confirm Bulk ${bulkActionConfirm ? bulkActionConfirm.toUpperCase() : ''}`}
        message={`Are you sure you want to apply this action to ${selectedIds.length} product(s)?`}
        confirmText={adminT("Confirm Action")}
        danger={bulkActionConfirm === 'delete'}
        onConfirm={handleExecuteBulkAction}
        onCancel={() => setBulkActionConfirm(null)}
      />
    </div>
  )
}

// ---------------- Product Form Modal Component ----------------
function ProductFormModal({ product, categories, subCategories, onClose, onSave }) {
  const [formData, setFormData] = useState(() => ({
    ...product,
    nameEn: product.nameEn || product.name || '',
    name: product.name || product.nameEn || '',
    sku: product.sku || (product.id != null ? (isNaN(Number(product.id)) ? `HTOO-${String(product.id).slice(0, 6)}` : `HTOO-${String(product.id).padStart(3, '0')}`) : ''),
    category: product.category || categories[0]?.name || 'Clothing',
    subCategory: product.subCategory || '',
    brand: product.brand || 'HTOO',
    price: product.price ?? 25000,
    salePrice: product.salePrice ?? (product.discountPrice ?? 0),
    costPrice: product.costPrice ?? 15000,
    stock: product.stock ?? 20,
    lowStockThreshold: product.lowStockThreshold ?? 5,
    image: product.image || (Array.isArray(product.images) ? product.images[0] : '') || '',
    description: product.description || product.descriptionEn || '',
    enabled: product.enabled !== false,
    featured: Boolean(product.featured),
    tags: Array.isArray(product.tags) ? product.tags.join(', ') : (product.tags || ''),
    variants: typeof product.variants === 'string'
      ? product.variants
      : Array.isArray(product.variants?.sizes)
        ? product.variants.sizes.join(', ')
        : Array.isArray(product.variants)
          ? product.variants.join(', ')
          : 'S, M, L, XL',
    variantColors: Array.isArray(product.availableVariants?.colors)
      ? product.availableVariants.colors.join(', ')
      : Array.isArray(product.colors) ? product.colors.join(', ')
        : typeof product.colors === 'string' ? product.colors
          : typeof product.color === 'string' ? product.color : Array.isArray(product.color) ? product.color.join(', ') : '',
    variantStock: product.variantStock && typeof product.variantStock === 'object' ? { ...product.variantStock } : {},
    trackVariantStock: Boolean(product.variantStock && typeof product.variantStock === 'object' && Object.keys(product.variantStock).length)
  }))

  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [selectedFileName, setSelectedFileName] = useState('')
  const [previewUrl, setPreviewUrl] = useState(() => product.image || (Array.isArray(product.images) ? product.images[0] : '') || '')
  const [imageError, setImageError] = useState('')
  const variantStockOptions = getVariantStockOptions({
    availableVariants: {
      sizes: formData.variants.split(',').map((value) => value.trim()).filter(Boolean),
      colors: formData.variantColors.split(',').map((value) => value.trim()).filter(Boolean)
    }
  })
  const variantStockTotal = variantStockOptions.reduce((total, option) => {
    const quantity = formData.variantStock[option.key]
    return Number.isSafeInteger(Number(quantity)) && String(quantity).trim() !== '' ? total + Number(quantity) : total
  }, 0)

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageError('')

    const allowedMime = ['image/jpeg', 'image/png', 'image/webp']
    const hasValidExt = /\.(jpe?g|png|webp)$/i.test(file.name)
    if (!allowedMime.includes(file.type) && !hasValidExt) {
      setImageError('Only JPG, PNG, and WebP images are supported.')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setImageError('Image file must be 5 MB or smaller.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setSelectedFile(file)
        setSelectedFileName(file.name)
        setPreviewUrl(reader.result)
        setFormData((prev) => ({ ...prev, image: reader.result }))
      }
    }
    reader.onerror = () => setImageError('Failed to read image file.')
    reader.readAsDataURL(file)
  }

  const handleRemoveImage = () => {
    setSelectedFile(null)
    setSelectedFileName('')
    setPreviewUrl('')
    setImageError('')
    setFormData((prev) => ({ ...prev, image: '' }))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setImageError('')
    const errs = {}
    if (!formData.nameEn.trim()) errs.nameEn = 'Product title is required'
    if (!formData.sku.trim()) errs.sku = 'SKU is required'
    if (Number(formData.price) <= 0) errs.price = 'Price must be greater than 0'
    if (Number(formData.stock) < 0) errs.stock = 'Stock cannot be negative'
    const variantStock = {}
    if (formData.trackVariantStock) {
      for (const option of variantStockOptions) {
        const rawQuantity = formData.variantStock[option.key]
        const quantity = Number(rawQuantity)
        if (String(rawQuantity ?? '').trim() === '' || !Number.isSafeInteger(quantity) || quantity < 0) {
          errs.variantStock = 'Enter a whole, non-negative stock quantity for every variant.'
          break
        }
        variantStock[option.key] = quantity
      }
    }
    if (!previewUrl && !formData.image) {
      setImageError('Product image is required.')
      errs.image = 'Product image is required'
    }

    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }

    setSaving(true)
    let finalImageUrl = formData.image

    // If a new local image was selected, upload it through the API to get a persistent server URL
    if (selectedFile && previewUrl?.startsWith('data:image/')) {
      try {
        const uploadRes = await fetch('/api/admin/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            file: previewUrl,
            filename: selectedFile.name
          })
        })
        const uploadResult = await uploadRes.json()
        if (!uploadRes.ok || !uploadResult.url) {
          throw new Error(uploadResult.error || 'Failed to upload product image.')
        }
        finalImageUrl = uploadResult.url
      } catch (uploadErr) {
        setImageError(uploadErr.message || 'Image upload failed.')
        setSaving(false)
        return
      }
    }

    const payload = {
      ...formData,
      availableVariants: {
        ...(formData.availableVariants || {}),
        colors: formData.variantColors.split(',').map((value) => value.trim()).filter(Boolean)
      },
      variantStock: formData.trackVariantStock ? variantStock : null,
      trackVariantStock: undefined,
      variantColors: undefined,
      image: finalImageUrl,
      images: [finalImageUrl, ...(Array.isArray(formData.images) ? formData.images.filter((img) => img !== formData.image && img !== finalImageUrl) : [])],
      name: formData.nameEn,
      price: Number(formData.price),
      salePrice: Number(formData.salePrice || 0),
      costPrice: Number(formData.costPrice || 0),
      stock: formData.trackVariantStock ? Object.values(variantStock).reduce((sum, quantity) => sum + quantity, 0) : Number(formData.stock),
      lowStockThreshold: Number(formData.lowStockThreshold),
      status: formData.enabled ? 'Active' : 'Draft'
    }
    await onSave(payload)
    setSaving(false)
  }

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal-box form-modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{adminT(formData.id != null ? 'Edit Product' : 'Add New Product')}</h3>
          <button className="modal-close-btn" onClick={onClose}><IconX size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="admin-form">
          <div className="form-grid-2">
            <div className="form-group">
              <label>{adminT("Product Title *")}</label>
              <input
                type="text"
                required
                placeholder={adminT("e.g. Minimalist Gold Embroidered Tee")}
                value={formData.nameEn}
                onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
              />
              {errors.nameEn && <span className="form-error">{adminT(errors.nameEn)}</span>}
            </div>

            <div className="form-group">
              <label>{adminT("SKU (Stock Keeping Unit) *")}</label>
              <input
                type="text"
                required
                placeholder={adminT("e.g. HTOO-TEE-001")}
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
              />
              {errors.sku && <span className="form-error">{adminT(errors.sku)}</span>}
            </div>
          </div>

          <div className="form-grid-3">
            <div className="form-group">
              <label>{adminT("Category *")}</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                {categories.map((c) => (
                  <option key={c.id || c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>{adminT("Sub Category")}</label>
              <select
                value={formData.subCategory}
                onChange={(e) => setFormData({ ...formData, subCategory: e.target.value })}
              >
                <option value="">{adminT("None / General")}</option>
                {subCategories.map((sc) => (
                  <option key={sc.id} value={sc.name}>{sc.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>{adminT("Brand")}</label>
              <input
                type="text"
                placeholder={adminT("HTOO Atelier")}
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
              />
            </div>
          </div>

          <div className="form-grid-3">
            <div className="form-group">
              <label>{adminT("Price (Ks) *")}</label>
              <input
                type="number"
                min="0"
                required
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              />
              {errors.price && <span className="form-error">{adminT(errors.price)}</span>}
            </div>

            <div className="form-group">
              <label>{adminT("Sale Price (Optional Ks)")}</label>
              <input
                type="number"
                min="0"
                value={formData.salePrice}
                onChange={(e) => setFormData({ ...formData, salePrice: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>{adminT("Cost Price (Ks)")}</label>
              <input
                type="number"
                min="0"
                value={formData.costPrice}
                onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
              />
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label>{adminT(formData.trackVariantStock ? 'Total Variant Stock' : 'Stock Quantity *')}</label>
              <input
                type="number"
                min="0"
                required
                value={formData.trackVariantStock ? variantStockTotal : formData.stock}
                disabled={formData.trackVariantStock}
                onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
              />
              {formData.trackVariantStock && <span className="text-muted text-xs">{adminT("Calculated from the variant quantities below.")}</span>}
              {errors.stock && <span className="form-error">{adminT(errors.stock)}</span>}
            </div>

            <div className="form-group">
              <label>{adminT("Low Stock Warning Threshold")}</label>
              <input
                type="number"
                min="1"
                value={formData.lowStockThreshold}
                onChange={(e) => setFormData({ ...formData, lowStockThreshold: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group product-image-field-group">
            <label>{adminT("Product Image *")}</label>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />

            {previewUrl ? (
              <div className="product-image-card">
                <div className="product-image-preview-frame">
                  <img src={previewUrl} alt={formData.nameEn || 'Product preview'} />
                </div>
                <div className="product-image-info">
                  {selectedFileName ? (
                    <div className="product-image-filename">
                      <strong>{adminT("Selected file:")}</strong> <span>{selectedFileName}</span>
                    </div>
                  ) : (
                    <div className="product-image-filename">
                      <strong>{adminT("Current image:")}</strong> <span>{previewUrl.startsWith('data:') ? 'Image uploaded' : (previewUrl.length > 40 ? previewUrl.slice(0, 40) + '...' : previewUrl)}</span>
                    </div>
                  )}
                  <span className="text-muted text-xs">{adminT("Supports JPG, PNG, WebP (Max 5 MB)")}</span>
                  <div className="product-image-actions">
                    <button
                      type="button"
                      className="admin-btn-secondary btn-sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {adminT("Replace Image")}
                    </button>
                    <button
                      type="button"
                      className="admin-btn-danger btn-sm"
                      onClick={handleRemoveImage}
                    >{' ' + adminT("Remove Image") + ' '}</button>
                  </div>
                </div>
              </div>
            ) : (
              <div
                className="product-image-dropzone"
                onClick={() => fileInputRef.current?.click()}
              >
                <button
                  type="button"
                  className="admin-btn-secondary"
                  onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}
                >
                  <IconPlus size={16} />
                  <span>{adminT("Upload Image")}</span>
                </button>
                <p className="dropzone-hint">{adminT("Select a JPG, PNG, or WebP file from your computer or phone (Max 5 MB)")}</p>
              </div>
            )}

            {imageError && <span className="form-error" role="alert">{adminT(imageError)}</span>}

            {/* Optional URL input for backward compatibility */}
            <details className="mt-2 text-xs">
              <summary className="text-muted cursor-pointer">{adminT("Or use an image URL manually")}</summary>
              <input
                type="text"
                className="mt-1"
                placeholder={adminT("https://... or /uploads/...")}
                value={formData.image.startsWith('data:') ? '' : formData.image}
                onChange={(e) => {
                  setSelectedFile(null)
                  setSelectedFileName('')
                  setPreviewUrl(e.target.value)
                  setFormData({ ...formData, image: e.target.value })
                }}
              />
            </details>
          </div>

          <div className="form-group">
            <label>{adminT("Product Description")}</label>
            <textarea
              rows="3"
              placeholder={adminT("Describe materials, sizing, fit, and care instructions...")}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label>{adminT("Sizes (comma separated)")}</label>
              <input
                type="text"
                placeholder={adminT("e.g. S, M, L, XL")}
                value={formData.variants}
                onChange={(e) => setFormData({ ...formData, variants: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>{adminT("Colors (comma separated)")}</label>
              <input
                type="text"
                placeholder={adminT("e.g. Black, Navy, White")}
                value={formData.variantColors}
                onChange={(e) => setFormData({ ...formData, variantColors: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.trackVariantStock}
                onChange={(event) => {
                  const enabled = event.target.checked
                  const variantStock = enabled
                    ? Object.fromEntries(variantStockOptions.map((option) => [option.key, formData.variantStock[option.key] ?? '']))
                    : formData.variantStock
                  setFormData({ ...formData, trackVariantStock: enabled, variantStock })
                }}
              />
              <span>{adminT("Track stock separately by size and color")}</span>
            </label>
            {formData.trackVariantStock && (
              <>
                <p className="text-muted text-xs">{adminT("Enter current stock for each combination. Existing aggregate stock remains unchanged until you save these explicit counts.")}</p>
                <div className="form-grid-3">
                  {variantStockOptions.map((option) => (
                    <div className="form-group" key={option.key}>
                      <label>{option.label} {adminT('Stock')}</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        required
                        value={formData.variantStock[option.key] ?? ''}
                        onChange={(event) => setFormData({
                          ...formData,
                          variantStock: { ...formData.variantStock, [option.key]: event.target.value }
                        })}
                      />
                    </div>
                  ))}
                </div>
                {errors.variantStock && <span className="form-error">{adminT(errors.variantStock)}</span>}
              </>
            )}
          </div>

          <div className="form-group">
            <label>{adminT("Tags")}</label>
            <input
              type="text"
              placeholder={adminT("e.g. New, Bestseller, Autumn")}
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
            />
          </div>

          <div className="form-checkboxes">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.enabled}
                onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
              />
              <span>{adminT("Active in Storefront")}</span>
            </label>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.featured}
                onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
              />
              <span>{adminT("Featured on Homepage")}</span>
            </label>
          </div>

          <div className="modal-footer">
            <button type="button" className="admin-btn-secondary" onClick={onClose} disabled={saving}>{' ' + adminT("Cancel") + ' '}</button>
            <button type="submit" className="admin-btn-gold" disabled={saving}>
              {adminT(saving ? 'Saving...' : formData.id ? 'Save Changes' : 'Create Product')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---------------- Product Detail Drawer Component ----------------
function ProductDetailDrawer({ product, onClose, onEdit }) {
  return (
    <div className="admin-drawer-overlay" onClick={onClose}>
      <div className="admin-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <h3>{adminT("Product Overview")}</h3>
            <span className="td-mono">{product.sku}</span>
          </div>
          <button className="modal-close-btn" onClick={onClose}><IconX size={16} /></button>
        </div>

        <div className="drawer-body">
          <div className="drawer-image-box">
            {product.image ? (
              <img src={product.image} alt={product.nameEn || product.name} />
            ) : (
              <div className="drawer-img-placeholder">{adminT("No Image Available")}</div>
            )}
          </div>

          <div className="drawer-section">
            <h4>{product.nameEn || product.name}</h4>
            <div className="drawer-badge-row">
              <Badge>{adminT(product.enabled !== false ? 'Active' : 'Draft')}</Badge>
              {product.featured && <span className="featured-pill">{adminT("Featured")}</span>}
              <span className="category-pill">{product.category}</span>
            </div>
          </div>

          <div className="drawer-specs-grid">
            <div className="spec-card">
              <small>{adminT("Price")}</small>
              <strong className="gold-accent-text">{formatMoney(product.price)}</strong>
            </div>
            <div className="spec-card">
              <small>{adminT("Stock Quantity")}</small>
              <strong>{product.stock ?? 0} units</strong>
            </div>
            <div className="spec-card">
              <small>{adminT("Sub Category")}</small>
              <span>{product.subCategory || 'General'}</span>
            </div>
            <div className="spec-card">
              <small>{adminT("Brand")}</small>
              <span>{product.brand || 'HTOO'}</span>
            </div>
          </div>

          <div className="drawer-section">
            <h5>{adminT("Description")}</h5>
            <p className="drawer-desc-text">
              {product.description || product.descriptionEn || 'No detailed description provided for this product.'}
            </p>
          </div>
          {(product.variants || product.tags) && (
            <div className="drawer-specs-grid" style={{ marginTop: '0.75rem' }}>
              {product.variants && (
                <div className="spec-card">
                  <small>{adminT("Variants")}</small>
                  <span>{typeof product.variants === 'string' ? product.variants : Array.isArray(product.variants) ? product.variants.join(', ') : Array.isArray(product.variants?.sizes) ? product.variants.sizes.join(', ') : 'Standard'}</span>
                </div>
              )}
              {product.tags && (
                <div className="spec-card">
                  <small>{adminT("Tags")}</small>
                  <span>{Array.isArray(product.tags) ? product.tags.join(', ') : product.tags}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="drawer-footer">
          <button className="admin-btn-secondary" onClick={onClose}>{adminT("Close")}</button>
          <button className="admin-btn-gold" onClick={onEdit}>{adminT("Edit Product")}</button>
        </div>
      </div>
    </div>
  )
}
