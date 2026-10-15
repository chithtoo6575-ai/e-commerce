import React, { useState } from 'react'
import { adminT } from '../adminI18n'
import Badge from '../components/Badge'
import ConfirmModal from '../components/ConfirmModal'
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconX
} from '../AdminIcons'

export default function DeliveryCompaniesPage({
  companies = [],
  onSaveCompanies,
  showToast
}) {
  const [editingCompany, setEditingCompany] = useState(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)

  const handleToggleStatus = (company) => {
    const updated = companies.map((c) =>
      c.id === company.id ? { ...c, status: c.status === 'Active' ? 'Inactive' : 'Active' } : c
    )
    onSaveCompanies?.(updated)
    const newStatus = company.status === 'Active' ? 'Inactive' : 'Active'
    showToast?.(`Delivery partner "${company.name}" is now ${newStatus}`, 'info')
  }

  return (
    <div className="admin-page-content">
      {/* Page Header */}
      <div className="page-header-actions">
        <div>
          <h2>{adminT("Delivery Companies & Couriers")}</h2>
          <p className="page-subtitle">{adminT("Manage courier logistics partners, contact points, and tracking URL integrations")}</p>
        </div>
        <button
          className="admin-btn-gold"
          onClick={() => setEditingCompany({
            name: '',
            logo: '🚚',
            contact: '',
            phone: '',
            trackingUrl: 'https://.../track/{CODE}',
            description: '',
            status: 'Active'
          })}
        >
          <IconPlus size={16} />
          <span>{adminT("Add Courier Partner")}</span>
        </button>
      </div>

      {/* Courier Grid */}
      <div className="companies-card-grid">
        {companies.map((company) => {
          const isActive = company.status === 'Active'
          return (
            <div key={company.id} className="admin-card company-card">
              <div className="company-card-top">
                <div className="company-avatar-box">
                  <span className="company-logo-glyph">{company.logo || '🚚'}</span>
                </div>
                <div className="company-meta-top">
                  <h4 className="company-name">{company.name}</h4>
                  <Badge>{company.status}</Badge>
                </div>
              </div>

              <p className="company-desc">{company.description || 'Logistics fulfillment partner for customer deliveries.'}</p>

              <div className="company-info-list">
                <div className="company-info-row">
                  <span className="info-label">{adminT("Contact Person:")}</span>
                  <span className="info-val">{company.contact || 'Dispatch Officer'}</span>
                </div>
                <div className="company-info-row">
                  <span className="info-label">{adminT("Hotline Phone:")}</span>
                  <span className="info-val font-mono">{company.phone || '-'}</span>
                </div>
                {company.trackingUrl && (
                  <div className="company-info-row">
                    <span className="info-label">{adminT("Tracking Link:")}</span>
                    <span className="info-val tracking-code font-mono text-muted">{company.trackingUrl}</span>
                  </div>
                )}
              </div>

              <div className="company-card-footer">
                <button
                  className={`status-toggle-btn ${isActive ? 'toggle-on' : 'toggle-off'}`}
                  onClick={() => handleToggleStatus(company)}
                >
                  <span className="toggle-indicator" />
                  {adminT(company.status)}
                </button>

                <div className="action-button-group">
                  <button
                    className="admin-icon-btn"
                    title={adminT("Edit Courier")}
                    onClick={() => setEditingCompany({ ...company })}
                  >
                    <IconEdit size={15} />
                  </button>
                  <button
                    className="admin-icon-btn btn-danger-hover"
                    title={adminT("Delete Courier")}
                    onClick={() => setDeleteConfirmId(company.id)}
                  >
                    <IconTrash size={15} />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Add / Edit Modal */}
      {editingCompany && (
        <CompanyModal
          company={editingCompany}
          onClose={() => setEditingCompany(null)}
          onSave={(saved) => {
            const exists = companies.some((c) => c.id === saved.id)
            let updated
            if (exists) {
              updated = companies.map((c) => c.id === saved.id ? saved : c)
            } else {
              updated = [...companies, saved]
            }
            onSaveCompanies?.(updated)
            showToast?.(exists ? 'Courier updated' : 'Courier added', 'success')
            setEditingCompany(null)
          }}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={Boolean(deleteConfirmId)}
        title={adminT("Delete Courier Partner")}
        message={adminT("Are you sure you want to remove this delivery company?")}
        confirmText={adminT("Delete Partner")}
        danger={true}
        onConfirm={() => {
          const updated = companies.filter((c) => c.id !== deleteConfirmId)
          onSaveCompanies?.(updated)
          showToast?.('Delivery company removed', 'success')
          setDeleteConfirmId(null)
        }}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  )
}

function CompanyModal({ company, onClose, onSave }) {
  const [formData, setFormData] = useState(() => ({
    id: company.id || `del-${Date.now().toString(36)}`,
    name: company.name || '',
    logo: company.logo || '🚚',
    contact: company.contact || '',
    phone: company.phone || '',
    trackingUrl: company.trackingUrl || '',
    description: company.description || '',
    status: company.status || 'Active'
  }))
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      setError('Company name is required')
      return
    }
    onSave(formData)
  }

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{adminT(company.id ? 'Edit Courier Partner' : 'Add Courier Partner')}</h3>
          <button className="modal-close-btn" onClick={onClose}><IconX size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="admin-form">
          <div className="form-grid-2">
            <div className="form-group">
              <label>{adminT("Courier Name *")}</label>
              <input
                type="text"
                required
                placeholder={adminT("e.g. Royal Express Logistics")}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
              {error && <span className="form-error">{adminT(error)}</span>}
            </div>

            <div className="form-group">
              <label>{adminT("Icon / Emoji Logo")}</label>
              <input
                type="text"
                placeholder={adminT("🚚 or 📦 or ⚡")}
                value={formData.logo}
                onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
              />
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label>{adminT("Contact Person")}</label>
              <input
                type="text"
                placeholder={adminT("e.g. Ko Aung Myo")}
                value={formData.contact}
                onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>{adminT("Phone Number")}</label>
              <input
                type="text"
                placeholder={adminT("09-xxxxxxxxx")}
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label>{adminT("Tracking URL Pattern")}</label>
            <input
              type="text"
              placeholder={adminT("https://example.com/track?code={CODE}")}
              value={formData.trackingUrl}
              onChange={(e) => setFormData({ ...formData, trackingUrl: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>{adminT("Service Coverage & Description")}</label>
            <textarea
              rows="3"
              placeholder={adminT("Township coverage, pickup schedule notes...")}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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

          <div className="modal-footer">
            <button type="button" className="admin-btn-secondary" onClick={onClose}>{' ' + adminT("Cancel") + ' '}</button>
            <button type="submit" className="admin-btn-gold">{' ' + adminT("Save Courier Partner") + ' '}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
