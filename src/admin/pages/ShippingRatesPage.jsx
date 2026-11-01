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

const formatMoney = (val) => `Ks ${Math.round(val || 0).toLocaleString('en-US')}`

export default function ShippingRatesPage({
  rates = [],
  onSaveRates,
  showToast
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [editingRate, setEditingRate] = useState(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)

  const filteredRates = useMemo(() => {
    return rates.filter((r) => {
      const q = searchTerm.toLowerCase()
      return !searchTerm || r.region.toLowerCase().includes(q) || r.deliveryType.toLowerCase().includes(q)
    })
  }, [rates, searchTerm])

  const handleToggleStatus = (rate) => {
    const updated = rates.map((r) =>
      r.id === rate.id ? { ...r, status: r.status === 'Active' ? 'Inactive' : 'Active' } : r
    )
    onSaveRates?.(updated)
    const newStatus = rate.status === 'Active' ? 'Inactive' : 'Active'
    showToast?.(`Shipping zone "${rate.region}" is now ${newStatus}`, 'info')
  }

  return (
    <div className="admin-page-content">
      {/* Page Header */}
      <div className="page-header-actions">
        <div>
          <h2>{adminT("Shipping Rates & Delivery Zones")}</h2>
          <p className="page-subtitle">{adminT("Configure regional postage fees, free delivery qualifications, and transit estimates")}</p>
        </div>
        <button
          className="admin-btn-gold"
          onClick={() => setEditingRate({
            region: '',
            deliveryType: 'Standard Delivery (2-3 Days)',
            baseFee: 3000,
            freeThreshold: 60000,
            additionalFee: 0,
            status: 'Active'
          })}
        >
          <IconPlus size={16} />
          <span>{adminT("Add Shipping Rate")}</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="admin-card filter-card">
        <div className="filter-row">
          <div className="filter-search-box">
            <IconSearch size={15} className="search-icon-muted" />
            <input
              type="text"
              placeholder={adminT("Search region or delivery type...")}
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
            <span className="badge-pill-muted">{rates.length} Delivery Zones</span>
          </div>
        </div>
      </div>

      {/* Shipping Rates Table */}
      <div className="admin-card">
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{adminT("Region / Destination Zone")}</th>
                <th>{adminT("Delivery Service Type")}</th>
                <th>{adminT("Base Fee (Ks)")}</th>
                <th>{adminT("Free Shipping Threshold")}</th>
                <th>{adminT("Weight / Extra Fee")}</th>
                <th>{adminT("Status")}</th>
                <th className="th-action">{adminT("Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredRates.length === 0 ? (
                <tr>
                  <td colSpan="7" className="table-empty-cell">{' ' + adminT("No shipping rates configured. Click \"Add Shipping Rate\" to create one.") + ' '}</td>
                </tr>
              ) : (
                filteredRates.map((rate) => {
                  const isActive = rate.status === 'Active'
                  return (
                    <tr key={rate.id} className="table-row-hover">
                      <td>
                        <strong className="text-primary font-medium">{rate.region}</strong>
                      </td>
                      <td>
                        <span className="text-secondary">{rate.deliveryType}</span>
                      </td>
                      <td>
                        <strong className="gold-accent-text">{formatMoney(rate.baseFee)}</strong>
                      </td>
                      <td>
                        <span className="text-secondary">
                          {rate.freeThreshold > 0 ? adminT(`Orders above ${formatMoney(rate.freeThreshold)}`) : adminT('None (Always charged)')}
                        </span>
                      </td>
                      <td>
                        <span className="text-muted">
                          {rate.additionalFee > 0 ? adminT(`+${formatMoney(rate.additionalFee)} / kg`) : adminT('Flat rate')}
                        </span>
                      </td>
                      <td>
                        <button
                          className={`status-toggle-btn ${isActive ? 'toggle-on' : 'toggle-off'}`}
                          onClick={() => handleToggleStatus(rate)}
                        >
                          <span className="toggle-indicator" />
                          {adminT(rate.status)}
                        </button>
                      </td>
                      <td className="td-action">
                        <div className="action-button-group">
                          <button
                            className="admin-icon-btn"
                            title={adminT("Edit rate")}
                            onClick={() => setEditingRate({ ...rate })}
                          >
                            <IconEdit size={15} />
                          </button>
                          <button
                            className="admin-icon-btn btn-danger-hover"
                            title={adminT("Delete rate")}
                            onClick={() => setDeleteConfirmId(rate.id)}
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

      {/* Add / Edit Rate Modal */}
      {editingRate && (
        <ShippingRateModal
          rate={editingRate}
          onClose={() => setEditingRate(null)}
          onSave={(saved) => {
            const exists = rates.some((r) => r.id === saved.id)
            let updated
            if (exists) {
              updated = rates.map((r) => r.id === saved.id ? saved : r)
            } else {
              updated = [...rates, saved]
            }
            onSaveRates?.(updated)
            showToast?.(exists ? 'Shipping rate updated' : 'Shipping rate added', 'success')
            setEditingRate(null)
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteConfirmId)}
        title={adminT("Delete Shipping Zone")}
        message={adminT("Are you sure you want to remove this delivery zone and shipping rate?")}
        confirmText={adminT("Delete Rate")}
        danger={true}
        onConfirm={() => {
          const updated = rates.filter((r) => r.id !== deleteConfirmId)
          onSaveRates?.(updated)
          showToast?.('Shipping rate deleted', 'success')
          setDeleteConfirmId(null)
        }}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  )
}

function ShippingRateModal({ rate, onClose, onSave }) {
  const [formData, setFormData] = useState(() => ({
    id: rate.id || `ship-${Date.now().toString(36)}`,
    region: rate.region || '',
    deliveryType: rate.deliveryType || 'Standard Delivery (2-3 Days)',
    baseFee: rate.baseFee ?? 3000,
    freeThreshold: rate.freeThreshold ?? 50000,
    additionalFee: rate.additionalFee ?? 0,
    status: rate.status || 'Active'
  }))
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.region.trim()) {
      setError('Region name is required')
      return
    }
    onSave({
      ...formData,
      baseFee: Number(formData.baseFee),
      freeThreshold: Number(formData.freeThreshold),
      additionalFee: Number(formData.additionalFee)
    })
  }

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{adminT(rate.id ? 'Edit Shipping Rate' : 'Add Shipping Rate')}</h3>
          <button className="modal-close-btn" onClick={onClose}><IconX size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="admin-form">
          <div className="form-group">
            <label>{adminT("Destination Area / Region *")}</label>
            <input
              type="text"
              required
              placeholder={adminT("e.g. Mandalay Metropolitan Region")}
              value={formData.region}
              onChange={(e) => setFormData({ ...formData, region: e.target.value })}
            />
            {error && <span className="form-error">{adminT(error)}</span>}
          </div>

          <div className="form-group">
            <label>{adminT("Delivery Method Title")}</label>
            <input
              type="text"
              placeholder={adminT("e.g. Standard Doorstep (1-2 Days)")}
              value={formData.deliveryType}
              onChange={(e) => setFormData({ ...formData, deliveryType: e.target.value })}
            />
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label>{adminT("Base Shipping Cost (Ks) *")}</label>
              <input
                type="number"
                min="0"
                required
                value={formData.baseFee}
                onChange={(e) => setFormData({ ...formData, baseFee: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>{adminT("Free Shipping Threshold (Ks)")}</label>
              <input
                type="number"
                min="0"
                value={formData.freeThreshold}
                onChange={(e) => setFormData({ ...formData, freeThreshold: e.target.value })}
              />
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label>{adminT("Additional Fee / Heavy kg (Ks)")}</label>
              <input
                type="number"
                min="0"
                value={formData.additionalFee}
                onChange={(e) => setFormData({ ...formData, additionalFee: e.target.value })}
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
            <button type="submit" className="admin-btn-gold">{' ' + adminT("Save Rate") + ' '}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
