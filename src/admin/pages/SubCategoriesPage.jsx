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

export default function SubCategoriesPage({
  subCategories = [],
  categories = [],
  onSaveSubCategory,
  onDeleteSubCategory,
  showToast
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [parentFilter, setParentFilter] = useState('All')
  const [editingSubCategory, setEditingSubCategory] = useState(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)

  const filteredItems = useMemo(() => {
    return subCategories.filter((item) => {
      const matchSearch = !searchTerm || item.name.toLowerCase().includes(searchTerm.toLowerCase())
      const matchParent = parentFilter === 'All' || item.parentCategoryId === parentFilter
      return matchSearch && matchParent
    }).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
  }, [subCategories, searchTerm, parentFilter])

  const handleToggleStatus = async (item) => {
    const updated = {
      ...item,
      status: item.status === 'Active' ? 'Inactive' : 'Active'
    }
    await onSaveSubCategory?.(updated)
    showToast?.(`Sub category "${item.name}" is now ${updated.status}`, 'info')
  }

  return (
    <div className="admin-page-content">
      {/* Page Header */}
      <div className="page-header-actions">
        <div>
          <h2>{adminT("Sub Categories")}</h2>
          <p className="page-subtitle">{adminT("Granular taxonomic classification under main store categories")}</p>
        </div>
        <button
          className="admin-btn-gold"
          onClick={() => setEditingSubCategory({
            name: '',
            parentCategoryId: categories[0]?.name || 'Clothing',
            image: '',
            status: 'Active',
            sortOrder: subCategories.length + 1,
            productCount: 0
          })}
        >
          <IconPlus size={16} />
          <span>{adminT("Add Sub Category")}</span>
        </button>
      </div>

      {/* Filter Card */}
      <div className="admin-card filter-card">
        <div className="filter-row">
          <div className="filter-search-box">
            <IconSearch size={15} className="search-icon-muted" />
            <input
              type="text"
              placeholder={adminT("Search sub category...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button className="clear-btn" onClick={() => setSearchTerm('')}>
                <IconX size={13} />
              </button>
            )}
          </div>

          <div className="filter-dropdown-group">
            <select
              value={parentFilter}
              onChange={(e) => setParentFilter(e.target.value)}
              className="admin-select"
            >
              <option value="All">{adminT("All Parent Categories")}</option>
              {categories.map((c) => (
                <option key={c.id || c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Sub Categories Table */}
      <div className="admin-card">
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: 50 }}>{adminT("Image")}</th>
                <th>{adminT("Sub Category Name")}</th>
                <th>{adminT("Parent Category")}</th>
                <th>{adminT("Product Count")}</th>
                <th>{adminT("Sort Order")}</th>
                <th>{adminT("Status")}</th>
                <th className="th-action">{adminT("Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan="7" className="table-empty-cell">{' ' + adminT("No sub-categories found matching your criteria.") + ' '}</td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isActive = item.status === 'Active'
                  return (
                    <tr key={item.id} className="table-row-hover">
                      <td>
                        <div className="thumb-square-xs">
                          {item.image ? (
                            <img src={item.image} alt={item.name} />
                          ) : (
                            <div className="thumb-placeholder">{item.name[0]}</div>
                          )}
                        </div>
                      </td>
                      <td>
                        <strong className="text-primary font-medium">{item.name}</strong>
                      </td>
                      <td>
                        <span className="category-pill">{item.parentCategoryId}</span>
                      </td>
                      <td>
                        <span className="badge-number-pill">{item.productCount || 0} items</span>
                      </td>
                      <td className="td-mono">{item.sortOrder ?? 1}</td>
                      <td>
                        <button
                          className={`status-toggle-btn ${isActive ? 'toggle-on' : 'toggle-off'}`}
                          onClick={() => handleToggleStatus(item)}
                        >
                          <span className="toggle-indicator" />
                          {adminT(item.status)}
                        </button>
                      </td>
                      <td className="td-action">
                        <div className="action-button-group">
                          <button
                            className="admin-icon-btn"
                            title={adminT("Edit sub category")}
                            onClick={() => setEditingSubCategory({ ...item })}
                          >
                            <IconEdit size={15} />
                          </button>
                          <button
                            className="admin-icon-btn btn-danger-hover"
                            title={adminT("Delete sub category")}
                            onClick={() => setDeleteConfirmId(item.id)}
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

      {/* Sub Category Form Modal */}
      {editingSubCategory && (
        <SubCategoryModal
          subCategory={editingSubCategory}
          categories={categories}
          onClose={() => setEditingSubCategory(null)}
          onSave={async (saved) => {
            await onSaveSubCategory?.(saved)
            showToast?.(saved.id ? 'Sub Category updated' : 'Sub Category created', 'success')
            setEditingSubCategory(null)
          }}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={Boolean(deleteConfirmId)}
        title={adminT("Delete Sub Category")}
        message={adminT("Are you sure you want to delete this sub category?")}
        confirmText={adminT("Delete")}
        danger={true}
        onConfirm={async () => {
          await onDeleteSubCategory?.(deleteConfirmId)
          showToast?.('Sub Category deleted', 'success')
          setDeleteConfirmId(null)
        }}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  )
}

function SubCategoryModal({ subCategory, categories, onClose, onSave }) {
  const [formData, setFormData] = useState(() => ({
    id: subCategory.id || `sub-${Date.now().toString(36)}`,
    name: subCategory.name || '',
    parentCategoryId: subCategory.parentCategoryId || categories[0]?.name || 'Clothing',
    image: subCategory.image || '',
    status: subCategory.status || 'Active',
    sortOrder: subCategory.sortOrder ?? 1,
    productCount: subCategory.productCount || 0
  }))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      setError('Sub category name is required')
      return
    }
    setSaving(true)
    await onSave(formData)
    setSaving(false)
  }

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{adminT(subCategory.id ? 'Edit Sub Category' : 'Add Sub Category')}</h3>
          <button className="modal-close-btn" onClick={onClose}><IconX size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="admin-form">
          <div className="form-group">
            <label>{adminT("Sub Category Name *")}</label>
            <input
              type="text"
              required
              placeholder={adminT("e.g. Hoodies & Sweatshirts")}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            {error && <span className="form-error">{adminT(error)}</span>}
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label>{adminT("Parent Category *")}</label>
              <select
                value={formData.parentCategoryId}
                onChange={(e) => setFormData({ ...formData, parentCategoryId: e.target.value })}
              >
                {categories.map((c) => (
                  <option key={c.id || c.name} value={c.name}>{c.name}</option>
                ))}
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
            <label>{adminT("Image URL (Optional)")}</label>
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

          <div className="form-group">
            <label>{adminT("Status")}</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            >
              <option value="Active">{adminT("Active")}</option>
              <option value="Inactive">{adminT("Inactive")}</option>
            </select>
          </div>

          <div className="modal-footer">
            <button type="button" className="admin-btn-secondary" onClick={onClose} disabled={saving}>{' ' + adminT("Cancel") + ' '}</button>
            <button type="submit" className="admin-btn-gold" disabled={saving}>
              {adminT(saving ? 'Saving...' : formData.id ? 'Save Changes' : 'Create Sub Category')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
