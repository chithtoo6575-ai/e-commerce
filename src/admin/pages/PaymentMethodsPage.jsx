import React, { useState } from 'react'
import { adminT } from '../adminI18n'
import ConfirmModal from '../components/ConfirmModal'
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconChevronUp,
  IconChevronDown,
  IconX
} from '../AdminIcons'

export default function PaymentMethodsPage({
  methods = [],
  onSaveMethods,
  showToast
}) {
  const [editingMethod, setEditingMethod] = useState(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)

  const sortedMethods = [...methods].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))

  const handleMove = (index, direction) => {
    const target = index + direction
    if (target < 0 || target >= sortedMethods.length) return
    const updated = [...sortedMethods]
    const temp = updated[index]
    updated[index] = updated[target]
    updated[target] = temp

    const reordered = updated.map((m, idx) => ({ ...m, sortOrder: idx + 1 }))
    onSaveMethods?.(reordered)
    showToast?.('Payment methods reordered', 'info')
  }

  const handleToggleStatus = (method) => {
    const updated = sortedMethods.map((m) =>
      m.id === method.id ? { ...m, status: m.status === 'Active' ? 'Inactive' : 'Active' } : m
    )
    onSaveMethods?.(updated)
    const newStatus = method.status === 'Active' ? 'Inactive' : 'Active'
    showToast?.(`Payment method "${method.name}" is now ${newStatus}`, 'info')
  }

  return (
    <div className="admin-page-content">
      {/* Page Header */}
      <div className="page-header-actions">
        <div>
          <h2>{adminT("Payment Gateways & Methods")}</h2>
          <p className="page-subtitle">{adminT("Configure mobile money wallets, bank accounts, QR payment options, and Cash on Delivery")}</p>
        </div>
        <button
          className="admin-btn-gold"
          onClick={() => setEditingMethod({
            name: '',
            icon: '💳',
            description: '',
            instructions: '',
            status: 'Active',
            sortOrder: sortedMethods.length + 1
          })}
        >
          <IconPlus size={16} />
          <span>{adminT("Add Payment Method")}</span>
        </button>
      </div>

      {/* Methods Table */}
      <div className="admin-card">
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: 70 }}>{adminT("Order")}</th>
                <th style={{ width: 50 }}>{adminT("Icon")}</th>
                <th>{adminT("Method Name")}</th>
                <th>{adminT("Description")}</th>
                <th>{adminT("Payment Instructions / Account")}</th>
                <th>{adminT("Status")}</th>
                <th className="th-action">{adminT("Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {sortedMethods.map((method, index) => {
                const isActive = method.status === 'Active'
                return (
                  <tr key={method.id} className="table-row-hover">
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
                          disabled={index === sortedMethods.length - 1}
                          onClick={() => handleMove(index, 1)}
                          title={adminT("Move down")}
                        >
                          <IconChevronDown size={14} />
                        </button>
                      </div>
                    </td>
                    <td>
                      <div className="pay-method-icon-box">
                        <span>{method.icon || '💳'}</span>
                      </div>
                    </td>
                    <td>
                      <strong className="text-primary font-medium">{method.name}</strong>
                    </td>
                    <td>
                      <span className="text-secondary text-sm">{method.description}</span>
                    </td>
                    <td>
                      <span className="text-muted text-xs font-mono">{method.instructions || 'Standard checkout'}</span>
                    </td>
                    <td>
                      <button
                        className={`status-toggle-btn ${isActive ? 'toggle-on' : 'toggle-off'}`}
                        onClick={() => handleToggleStatus(method)}
                      >
                        <span className="toggle-indicator" />
                        {adminT(method.status)}
                      </button>
                    </td>
                    <td className="td-action">
                      <div className="action-button-group">
                        <button
                          className="admin-icon-btn"
                          title={adminT("Edit method")}
                          onClick={() => setEditingMethod({ ...method })}
                        >
                          <IconEdit size={15} />
                        </button>
                        <button
                          className="admin-icon-btn btn-danger-hover"
                          title={adminT("Delete method")}
                          onClick={() => setDeleteConfirmId(method.id)}
                        >
                          <IconTrash size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {editingMethod && (
        <PaymentMethodModal
          method={editingMethod}
          onClose={() => setEditingMethod(null)}
          onSave={(saved) => {
            const exists = sortedMethods.some((m) => m.id === saved.id)
            let updated
            if (exists) {
              updated = sortedMethods.map((m) => m.id === saved.id ? saved : m)
            } else {
              updated = [...sortedMethods, saved]
            }
            onSaveMethods?.(updated)
            showToast?.(exists ? 'Payment method updated' : 'Payment method created', 'success')
            setEditingMethod(null)
          }}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={Boolean(deleteConfirmId)}
        title={adminT("Delete Payment Method")}
        message={adminT("Are you sure you want to remove this payment gateway option?")}
        confirmText={adminT("Delete Method")}
        danger={true}
        onConfirm={() => {
          const updated = sortedMethods.filter((m) => m.id !== deleteConfirmId)
          onSaveMethods?.(updated)
          showToast?.('Payment method removed', 'success')
          setDeleteConfirmId(null)
        }}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  )
}

function PaymentMethodModal({ method, onClose, onSave }) {
  const [formData, setFormData] = useState(() => ({
    id: method.id || `pay-${Date.now().toString(36)}`,
    name: method.name || '',
    icon: method.icon || '💳',
    description: method.description || '',
    instructions: method.instructions || '',
    status: method.status || 'Active',
    sortOrder: method.sortOrder ?? 1
  }))
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      setError('Payment method name is required')
      return
    }
    onSave(formData)
  }

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{adminT(method.id ? 'Edit Payment Method' : 'Add Payment Method')}</h3>
          <button className="modal-close-btn" onClick={onClose}><IconX size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="admin-form">
          <div className="form-grid-2">
            <div className="form-group">
              <label>{adminT("Method Title *")}</label>
              <input
                type="text"
                required
                placeholder={adminT("e.g. KBZPay Quick Pay")}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
              {error && <span className="form-error">{adminT(error)}</span>}
            </div>

            <div className="form-group">
              <label>{adminT("Icon / Emoji Symbol")}</label>
              <input
                type="text"
                placeholder={adminT("📱 or 💵 or 🏦")}
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label>{adminT("Customer Brief Description")}</label>
            <input
              type="text"
              placeholder={adminT("e.g. Instant payment with transfer slip upload")}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>{adminT("Payment Instructions & Bank Account Details")}</label>
            <textarea
              rows="3"
              placeholder={adminT("A/C Number: 09266172967 (Chit Htoo). Please include Order ID in transfer remarks.")}
              value={formData.instructions}
              onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
            />
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label>{adminT("Sort Priority Order")}</label>
              <input
                type="number"
                value={formData.sortOrder}
                onChange={(e) => setFormData({ ...formData, sortOrder: Number(e.target.value) })}
              />
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
            <button type="submit" className="admin-btn-gold">{' ' + adminT("Save Method") + ' '}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
