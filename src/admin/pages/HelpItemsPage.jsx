import React, { useState, useMemo } from 'react'
import { adminT } from '../adminI18n'
import ConfirmModal from '../components/ConfirmModal'
import {
  IconPlus,
  IconSearch,
  IconEdit,
  IconTrash,
  IconChevronUp,
  IconChevronDown,
  IconX
} from '../AdminIcons'

const FAQ_CATEGORIES = ['All', 'Ordering', 'Shipping', 'Payment', 'Returns', 'Account']

export default function HelpItemsPage({
  helpItems = [],
  onSaveHelpItems,
  showToast
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [editingItem, setEditingItem] = useState(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)

  const sortedItems = useMemo(() => {
    return [...helpItems].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
  }, [helpItems])

  const filteredItems = useMemo(() => {
    return sortedItems.filter((item) => {
      const q = searchTerm.toLowerCase()
      const matchSearch =
        !searchTerm ||
        item.question.toLowerCase().includes(q) ||
        item.answer.toLowerCase().includes(q)
      const matchCategory = categoryFilter === 'All' || item.category === categoryFilter
      return matchSearch && matchCategory
    })
  }, [sortedItems, searchTerm, categoryFilter])

  const handleMove = (index, direction) => {
    const target = index + direction
    if (target < 0 || target >= sortedItems.length) return
    const updated = [...sortedItems]
    const temp = updated[index]
    updated[index] = updated[target]
    updated[target] = temp

    const reordered = updated.map((it, idx) => ({ ...it, sortOrder: idx + 1 }))
    onSaveHelpItems?.(reordered)
    showToast?.('Help items reordered', 'info')
  }

  const handleToggleStatus = (item) => {
    const updated = sortedItems.map((it) =>
      it.id === item.id ? { ...it, status: it.status === 'Active' ? 'Inactive' : 'Active' } : it
    )
    onSaveHelpItems?.(updated)
    const newStatus = item.status === 'Active' ? 'Inactive' : 'Active'
    showToast?.(`Help item marked ${newStatus}`, 'info')
  }

  return (
    <div className="admin-page-content">
      {/* Page Header */}
      <div className="page-header-actions">
        <div>
          <h2>{adminT("Help & FAQ Knowledge Base")}</h2>
          <p className="page-subtitle">{adminT("Configure self-service FAQs, return rules, payment guides, and shopper support answers")}</p>
        </div>
        <button
          className="admin-btn-gold"
          onClick={() => setEditingItem({
            question: '',
            answer: '',
            category: 'Ordering',
            status: 'Active',
            sortOrder: sortedItems.length + 1
          })}
        >
          <IconPlus size={16} />
          <span>{adminT("Add Help Item")}</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="admin-card filter-card">
        <div className="filter-row">
          <div className="filter-search-box">
            <IconSearch size={15} className="search-icon-muted" />
            <input
              type="text"
              placeholder={adminT("Search question or answer keywords...")}
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
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="admin-select"
            >
              {FAQ_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat} Topics</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* FAQ Items List */}
      <div className="admin-card">
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: 80 }}>{adminT("Order")}</th>
                <th>{adminT("Category")}</th>
                <th>{adminT("Question & Answer Details")}</th>
                <th>{adminT("Status")}</th>
                <th className="th-action">{adminT("Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan="5" className="table-empty-cell">{' ' + adminT("No FAQs found matching your criteria.") + ' '}</td>
                </tr>
              ) : (
                filteredItems.map((item, index) => {
                  const isActive = item.status === 'Active'
                  return (
                    <tr key={item.id} className="table-row-hover">
                      <td>
                        <div className="order-reorder-btns">
                          <button
                            className="admin-icon-btn btn-sm"
                            disabled={index === 0}
                            onClick={() => handleMove(index, -1)}
                            title={adminT("Move up")}
                          >
                            <IconChevronUp size={14} />
                          </button>
                          <button
                            className="admin-icon-btn btn-sm"
                            disabled={index === filteredItems.length - 1}
                            onClick={() => handleMove(index, 1)}
                            title={adminT("Move down")}
                          >
                            <IconChevronDown size={14} />
                          </button>
                        </div>
                      </td>
                      <td>
                        <span className="category-pill">{item.category}</span>
                      </td>
                      <td>
                        <div className="faq-content-cell">
                          <strong className="text-primary font-medium">{item.question}</strong>
                          <p className="faq-answer-snippet">{item.answer}</p>
                        </div>
                      </td>
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
                            title={adminT("Edit FAQ")}
                            onClick={() => setEditingItem({ ...item })}
                          >
                            <IconEdit size={15} />
                          </button>
                          <button
                            className="admin-icon-btn btn-danger-hover"
                            title={adminT("Delete FAQ")}
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

      {/* Add / Edit Modal */}
      {editingItem && (
        <HelpItemModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSave={(saved) => {
            const exists = sortedItems.some((it) => it.id === saved.id)
            let updated
            if (exists) {
              updated = sortedItems.map((it) => it.id === saved.id ? saved : it)
            } else {
              updated = [...sortedItems, saved]
            }
            onSaveHelpItems?.(updated)
            showToast?.(exists ? 'Help item updated' : 'Help item created', 'success')
            setEditingItem(null)
          }}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={Boolean(deleteConfirmId)}
        title={adminT("Delete Help Item")}
        message={adminT("Are you sure you want to remove this FAQ entry from the store knowledge base?")}
        confirmText={adminT("Delete Item")}
        danger={true}
        onConfirm={() => {
          const updated = sortedItems.filter((it) => it.id !== deleteConfirmId)
          onSaveHelpItems?.(updated)
          showToast?.('Help item deleted', 'success')
          setDeleteConfirmId(null)
        }}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  )
}

function HelpItemModal({ item, onClose, onSave }) {
  const [formData, setFormData] = useState(() => ({
    id: item.id || `help-${Date.now().toString(36)}`,
    question: item.question || '',
    answer: item.answer || '',
    category: item.category || 'Ordering',
    status: item.status || 'Active',
    sortOrder: item.sortOrder ?? 1
  }))
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.question.trim() || !formData.answer.trim()) {
      setError('Question and answer text are required')
      return
    }
    onSave(formData)
  }

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{adminT(item.id ? 'Edit Help Item' : 'Add Help Item')}</h3>
          <button className="modal-close-btn" onClick={onClose}><IconX size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="admin-form">
          <div className="form-group">
            <label>{adminT("Question Title *")}</label>
            <input
              type="text"
              required
              placeholder={adminT("e.g. How do I modify my order?")}
              value={formData.question}
              onChange={(e) => setFormData({ ...formData, question: e.target.value })}
            />
            {error && <span className="form-error">{adminT(error)}</span>}
          </div>

          <div className="form-group">
            <label>{adminT("Answer / Instructions *")}</label>
            <textarea
              rows="4"
              required
              placeholder={adminT("Enter clear, helpful guidance for the shopper...")}
              value={formData.answer}
              onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
            />
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label>{adminT("Category")}</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                <option value="Ordering">{adminT("Ordering")}</option>
                <option value="Shipping">{adminT("Shipping")}</option>
                <option value="Payment">{adminT("Payment")}</option>
                <option value="Returns">{adminT("Returns")}</option>
                <option value="Account">{adminT("Account")}</option>
              </select>
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
          </div>

          <div className="modal-footer">
            <button type="button" className="admin-btn-secondary" onClick={onClose}>{' ' + adminT("Cancel") + ' '}</button>
            <button type="submit" className="admin-btn-gold">{' ' + adminT("Save FAQ Item") + ' '}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
