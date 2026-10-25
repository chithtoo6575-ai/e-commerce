import { useState } from 'react'
import { adminT } from '../adminI18n'
import ConfirmModal from '../components/ConfirmModal'
import { IconChevronUp, IconChevronDown, IconPlus, IconEdit, IconTrash, IconX } from '../AdminIcons'

export default function PaymentMethodsPage({
  methods = [],
  onSaveMethods,
  onAddMethod,
  onUpdateMethod,
  onDeleteMethod,
  showToast
}) {
  const [saving, setSaving] = useState(false)
  const [editingMethod, setEditingMethod] = useState(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)
  const sortedMethods = [...methods].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))

  const save = async (updated, successMessage) => {
    if (saving) return
    setSaving(true)
    try {
      await onSaveMethods?.(updated)
      showToast?.(successMessage, 'success')
    } catch (saveError) {
      console.error('[PaymentMethodsPage] Could not update payment methods:', saveError)
      showToast?.(saveError.message || 'Unable to update payment methods.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const saveAccount = async (method) => {
    if (saving) return false
    setSaving(true)
    try {
      if (method.id) {
        await onUpdateMethod(method)
        showToast?.(`Payment method "${method.name}" updated`, 'success')
      } else {
        await onAddMethod(method)
        showToast?.(`Payment method "${method.name}" added`, 'success')
      }
      setEditingMethod(null)
      return true
    } catch (saveError) {
      console.error('[PaymentMethodsPage] Could not save payment method:', saveError)
      showToast?.(saveError.message || 'Unable to save payment method.', 'error')
      return false
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (saving || !deleteConfirmId) return
    setSaving(true)
    try {
      await onDeleteMethod(deleteConfirmId)
      showToast?.('Payment method deleted', 'success')
      setDeleteConfirmId(null)
    } catch (deleteError) {
      console.error('[PaymentMethodsPage] Could not delete payment method:', deleteError)
      showToast?.(deleteError.message || 'Unable to delete payment method.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleMove = (index, direction) => {
    const target = index + direction
    if (saving || target < 0 || target >= sortedMethods.length) return
    const updated = [...sortedMethods]
    const moved = updated[index]
    updated[index] = updated[target]
    updated[target] = moved
    void save(updated.map((method, position) => ({ ...method, sortOrder: position + 1 })), 'Payment methods reordered')
  }

  const handleToggleStatus = (method) => {
    if (saving) return
    const updated = sortedMethods.map((item) =>
      item.id === method.id ? { ...item, status: item.status === 'Active' ? 'Inactive' : 'Active' } : item
    )
    void save(updated, `Payment method "${method.name}" updated`)
  }

  return (
    <div className="admin-page-content">
      <div className="page-header-actions">
        <div>
          <h2>{adminT('Payment Gateways & Methods')}</h2>
          <p className="page-subtitle">{adminT('Enable or disable the payment accounts shown to customers at checkout.')}</p>
        </div>
        <button
          className="admin-btn-gold"
          type="button"
          disabled={saving}
          onClick={() => setEditingMethod({ type: 'wallet', status: 'Active' })}
        >
          <IconPlus size={16} />
          <span>{adminT('Add Payment Method')}</span>
        </button>
      </div>

      {sortedMethods.length ? (
        <div className="admin-card">
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: 70 }}>{adminT('Order')}</th>
                  <th>{adminT('Method Name')}</th>
                  <th>{adminT('Payment Account')}</th>
                  <th>{adminT('Status')}</th>
                  <th>{adminT('Actions')}</th>
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
                            type="button"
                            disabled={saving || index === 0}
                            onClick={() => handleMove(index, -1)}
                            title={adminT('Move up')}
                            aria-label={adminT('Move up')}
                          >
                            <IconChevronUp size={14} />
                          </button>
                          <button
                            className="admin-icon-btn btn-sm"
                            type="button"
                            disabled={saving || index === sortedMethods.length - 1}
                            onClick={() => handleMove(index, 1)}
                            title={adminT('Move down')}
                            aria-label={adminT('Move down')}
                          >
                            <IconChevronDown size={14} />
                          </button>
                        </div>
                      </td>
                      <td>
                        <strong className="text-primary font-medium">{method.icon} {method.name}</strong>
                        <div className="text-muted text-xs">{method.description}</div>
                      </td>
                      <td><span className="text-muted text-xs font-mono">{method.instructions || adminT('Account details not configured')}</span></td>
                      <td>
                        <button
                          className={`status-toggle-btn ${isActive ? 'toggle-on' : 'toggle-off'}`}
                          type="button"
                          aria-pressed={isActive}
                          disabled={saving}
                          onClick={() => handleToggleStatus(method)}
                        >
                          <span className="toggle-indicator" />
                          {adminT(method.status)}
                        </button>
                      </td>
                      <td>
                        <div className="action-button-group">
                          <button
                            className="admin-btn-secondary btn-sm"
                            type="button"
                            disabled={saving}
                            onClick={() => setEditingMethod({ ...method })}
                          >
                            <IconEdit size={14} />
                            {adminT('Edit')}
                          </button>
                          <button
                            className="admin-btn-danger btn-sm"
                            type="button"
                            disabled={saving}
                            onClick={() => setDeleteConfirmId(method.id)}
                          >
                            <IconTrash size={14} />
                            {adminT('Delete')}
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
      ) : (
        <div className="admin-card">{adminT('No payment methods configured.')}</div>
      )}

      {editingMethod && (
        <PaymentMethodFormModal
          method={editingMethod}
          saving={saving}
          onClose={() => setEditingMethod(null)}
          onSave={saveAccount}
        />
      )}

      <ConfirmModal
        isOpen={Boolean(deleteConfirmId)}
        title={adminT('Delete Payment Method')}
        message={adminT('Are you sure you want to delete this payment method?')}
        confirmText={adminT('Delete')}
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  )
}

function PaymentMethodFormModal({ method, saving, onClose, onSave }) {
  const isEditing = Boolean(method.id)
  const type = method.type || (method.id === 'bank' ? 'bank' : method.id === 'cod' ? 'cash' : 'wallet')
  const [formData, setFormData] = useState(() => ({
    ...(method.id ? { id: method.id } : {}),
    name: method.name || '',
    type: isEditing ? type : 'wallet',
    accountName: method.accountName || '',
    phoneNumber: method.phoneNumber || '',
    bankName: method.bankName || '',
    accountNumber: method.accountNumber || '',
    status: method.status || 'Active'
  }))
  const [formSaving, setFormSaving] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (formSaving || saving) return
    setFormSaving(true)
    try {
      await onSave(formData)
    } finally {
      setFormSaving(false)
    }
  }

  const isCash = formData.type === 'cash'
  const isBank = formData.type === 'bank'

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal-box form-modal-wide" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h3>{adminT(isEditing ? 'Edit Payment Method' : 'Add Payment Method')}</h3>
          <button className="modal-close-btn" type="button" onClick={onClose} aria-label={adminT('Close')}>
            <IconX size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="admin-form">
          <div className="form-grid-2">
            <div className="form-group">
              <label htmlFor="payment-method-name">{adminT('Method Name')} *</label>
              <input
                id="payment-method-name"
                type="text"
                maxLength={60}
                required
                value={formData.name}
                onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                disabled={formSaving || saving}
              />
            </div>
            <div className="form-group">
              <label htmlFor="payment-method-type">{adminT('Payment Type')}</label>
              {isEditing ? (
                <input id="payment-method-type" type="text" value={adminT(type === 'cash' ? 'Cash on Delivery' : type === 'bank' ? 'Bank Transfer' : 'Mobile Wallet')} disabled />
              ) : (
                <select
                  id="payment-method-type"
                  value={formData.type}
                  onChange={(event) => setFormData({ ...formData, type: event.target.value })}
                  disabled={formSaving || saving}
                >
                  <option value="wallet">{adminT('Mobile Wallet')}</option>
                  <option value="bank">{adminT('Bank Transfer')}</option>
                </select>
              )}
            </div>
          </div>

          {!isCash && (
            <div className="form-grid-2">
              <div className="form-group">
                <label htmlFor="payment-account-holder">{adminT('Account Holder')} *</label>
                <input
                  id="payment-account-holder"
                  type="text"
                  required
                  value={formData.accountName}
                  onChange={(event) => setFormData({ ...formData, accountName: event.target.value })}
                  disabled={formSaving || saving}
                />
              </div>
              {isBank ? (
                <>
                  <div className="form-group">
                    <label htmlFor="payment-bank-name">{adminT('Bank Name')} *</label>
                    <input
                      id="payment-bank-name"
                      type="text"
                      required
                      value={formData.bankName}
                      onChange={(event) => setFormData({ ...formData, bankName: event.target.value })}
                      disabled={formSaving || saving}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="payment-account-number">{adminT('Account Number')} *</label>
                    <input
                      id="payment-account-number"
                      type="text"
                      required
                      value={formData.accountNumber}
                      onChange={(event) => setFormData({ ...formData, accountNumber: event.target.value })}
                      disabled={formSaving || saving}
                    />
                  </div>
                </>
              ) : (
                <div className="form-group">
                  <label htmlFor="payment-phone-number">{adminT('Phone Number')} *</label>
                  <input
                    id="payment-phone-number"
                    type="tel"
                    required
                    value={formData.phoneNumber}
                    onChange={(event) => setFormData({ ...formData, phoneNumber: event.target.value })}
                    disabled={formSaving || saving}
                  />
                </div>
              )}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="payment-method-status">{adminT('Status')}</label>
            <select
              id="payment-method-status"
              value={formData.status}
              onChange={(event) => setFormData({ ...formData, status: event.target.value })}
              disabled={formSaving || saving}
            >
              <option value="Active">{adminT('Active')}</option>
              <option value="Inactive">{adminT('Inactive')}</option>
            </select>
          </div>

          <div className="modal-footer">
            <button type="button" className="admin-btn-secondary" onClick={onClose} disabled={formSaving || saving}>
              {adminT('Cancel')}
            </button>
            <button type="submit" className="admin-btn-gold" disabled={formSaving || saving}>
              {adminT(formSaving || saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Payment Method')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
