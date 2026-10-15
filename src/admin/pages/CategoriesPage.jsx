import React, { useState, useMemo } from 'react'
import { adminT } from '../adminI18n'
import ConfirmModal from '../components/ConfirmModal'
import {
  IconPlus,
  IconSearch,
  IconEdit,
  IconTrash,
  IconX
} from '../AdminIcons'

export default function CategoriesPage({
  categories = [],
  products = [],
  onSaveCategory,
  onDeleteCategory,
  showToast
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [editingCategory, setEditingCategory] = useState(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)

  // Map product counts to categories
  const categoryWithCounts = useMemo(() => {
    return categories.map((cat) => {
      const count = products.filter((p) => p.category === cat.name || p.category === cat.id).length
      return {
        ...cat,
        productCount: count
      }
    })
  }, [categories, products])

  const filteredCategories = useMemo(() => {
    return categoryWithCounts.filter((c) => {
      const name = (c.name || '').toLowerCase()
      return !searchTerm || name.includes(searchTerm.toLowerCase())
    })
  }, [categoryWithCounts, searchTerm])

  const handleToggleEnable = async (cat) => {
    const updated = { ...cat, enabled: cat.enabled === false ? true : false }
    await onSaveCategory?.(updated)
    showToast?.(`Category "${cat.name}" is now ${updated.enabled ? 'Enabled' : 'Disabled'}`, 'info')
  }

  return (
    <div className="admin-page-content">
      {/* Page Header */}
      <div className="page-header-actions">
        <div>
          <h2>{adminT("Category Management")}</h2>
          <p className="page-subtitle">{adminT("Organize products into intuitive collections and navigation paths")}</p>
        </div>
        <button
          className="admin-btn-gold"
          onClick={() => setEditingCategory({
            name: '',
            storefrontCategory: 'Men',
            icon: '◇',
            image: '',
            enabled: true,
            sortOrder: categories.length + 1
          })}
        >
          <IconPlus size={16} />
          <span>{adminT("Add Category")}</span>
        </button>
      </div>

      {/* Control / Search */}
      <div className="admin-card filter-card">
        <div className="filter-row">
          <div className="filter-search-box">
            <IconSearch size={15} className="search-icon-muted" />
            <input
              type="text"
              placeholder={adminT("Search category name...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button className="clear-btn" onClick={() => setSearchTerm('')}>
                <IconX size={13} />
              </button>
            )}
          </div>
          <div className="stat-pill-group">
            <span className="badge-pill-muted">{categories.length} Categories</span>
          </div>
        </div>
      </div>

      {/* Categories Table */}
      <div className="admin-card">
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: 60 }}>{adminT("Icon")}</th>
                <th>{adminT("Category Name")}</th>
                <th>{adminT("Storefront Group")}</th>
                <th>{adminT("Products Count")}</th>
                <th>{adminT("Sort Order")}</th>
                <th>{adminT("Status")}</th>
                <th className="th-action">{adminT("Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredCategories.length === 0 ? (
                <tr>
                  <td colSpan="7" className="table-empty-cell">{' ' + adminT("No categories found. Click \"Add Category\" to create one.") + ' '}</td>
                </tr>
              ) : (
                filteredCategories.map((c) => {
                  const isEnabled = c.enabled !== false
                  return (
                    <tr key={c.id || c.name} className="table-row-hover">
                      <td>
                        <div className="category-icon-box">
                          {c.image ? (
                            <img src={c.image} alt={c.name} className="cat-table-thumb" />
                          ) : (
                            <span className="cat-icon-symbol">{c.icon || '▥'}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <strong className="text-primary font-medium">{c.name}</strong>
                      </td>
                      <td>
                        <span className="text-secondary">{c.storefrontCategory || 'Storefront'}</span>
                      </td>
                      <td>
                        <span className="badge-number-pill">{c.productCount} products</span>
                      </td>
                      <td className="td-mono">{c.sortOrder ?? 1}</td>
                      <td>
                        <button
                          className={`status-toggle-btn ${isEnabled ? 'toggle-on' : 'toggle-off'}`}
                          onClick={() => handleToggleEnable(c)}
                          title={adminT("Click to toggle status")}
                        >
                          <span className="toggle-indicator" />
                          {adminT(isEnabled ? 'Active' : 'Disabled')}
                        </button>
                      </td>
                      <td className="td-action">
                        <div className="action-button-group">
                          <button
                            className="admin-icon-btn"
                            title={adminT("Edit category")}
                            onClick={() => setEditingCategory({ ...c })}
                          >
                            <IconEdit size={15} />
                          </button>
                          <button
                            className="admin-icon-btn btn-danger-hover"
                            title={adminT("Delete category")}
                            onClick={() => setDeleteConfirmId(c.id || c.name)}
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
      </div>

      {/* Edit / Create Category Modal */}
      {editingCategory && (
        <CategoryModal
          category={editingCategory}
          onClose={() => setEditingCategory(null)}
          onSave={async (saved) => {
            await onSaveCategory?.(saved)
            showToast?.(saved.id ? 'Category updated' : 'Category created', 'success')
            setEditingCategory(null)
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteConfirmId)}
        title={adminT("Delete Category")}
        message={adminT("Are you sure you want to delete this category? Associated products may need recategorization.")}
        confirmText={adminT("Delete")}
        danger={true}
        onConfirm={async () => {
          await onDeleteCategory?.(deleteConfirmId)
          showToast?.('Category deleted', 'success')
          setDeleteConfirmId(null)
        }}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  )
}

function CategoryModal({ category, onClose, onSave }) {
  const [formData, setFormData] = useState({
    id: category.id || '',
    name: category.name || '',
    storefrontCategory: category.storefrontCategory || 'Men',
    icon: category.icon || '◇',
    image: category.image || '',
    sortOrder: category.sortOrder ?? 1,
    enabled: category.enabled !== false
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      setError('Category name is required')
      return
    }
    setSaving(true)
    await onSave({
      ...formData,
      id: formData.id || formData.name.trim()
    })
    setSaving(false)
  }

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{adminT(category.id ? 'Edit Category' : 'Add Category')}</h3>
          <button className="modal-close-btn" onClick={onClose}><IconX size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="admin-form">
          <div className="form-group">
            <label>{adminT("Category Name *")}</label>
            <input
              type="text"
              required
              placeholder={adminT("e.g. Footwear & Shoes")}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            {error && <span className="form-error">{adminT(error)}</span>}
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label>{adminT("Storefront Department")}</label>
              <select
                value={formData.storefrontCategory}
                onChange={(e) => setFormData({ ...formData, storefrontCategory: e.target.value })}
              >
                <option value="Men">{adminT("Men")}</option>
                <option value="Women">{adminT("Women")}</option>
                <option value="Kids">{adminT("Kids")}</option>
                <option value="Shoes">{adminT("Shoes")}</option>
                <option value="Accessories">{adminT("Accessories")}</option>
                <option value="Sale">{adminT("Sale")}</option>
              </select>
            </div>

            <div className="form-group">
              <label>{adminT("Sort Order")}</label>
              <input
                type="number"
                value={formData.sortOrder}
                onChange={(e) => setFormData({ ...formData, sortOrder: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="form-group">
            <label>{adminT("Icon Symbol or Emoji")}</label>
            <input
              type="text"
              placeholder={adminT("◇ or 👟 or 👔")}
              value={formData.icon}
              onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>{adminT("Category Image URL (Optional)")}</label>
            <input
              type="text"
              placeholder={adminT("https://...")}
              value={formData.image}
              onChange={(e) => setFormData({ ...formData, image: e.target.value })}
            />
            {formData.image && (
              <div className="image-preview-box">
                <img src={formData.image} alt={adminT("Preview")} />
              </div>
            )}
          </div>

          <div className="form-checkboxes">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.enabled}
                onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
              />
              <span>{adminT("Enabled & Visible in Shop")}</span>
            </label>
          </div>

          <div className="modal-footer">
            <button type="button" className="admin-btn-secondary" onClick={onClose} disabled={saving}>{' ' + adminT("Cancel") + ' '}</button>
            <button type="submit" className="admin-btn-gold" disabled={saving}>
              {adminT(saving ? 'Saving...' : formData.id ? 'Save Changes' : 'Create Category')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
