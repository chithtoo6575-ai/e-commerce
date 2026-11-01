import React, { useState } from 'react'
import { adminT } from '../adminI18n'
import ConfirmModal from '../components/ConfirmModal'
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconEye,
  IconX
} from '../AdminIcons'

export default function BannerImagesPage({
  banners = [],
  onSaveBanner,
  onDeleteBanner,
  showToast
}) {
  const [editingBanner, setEditingBanner] = useState(null)
  const [previewBanner, setPreviewBanner] = useState(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)

  const sortedBanners = [...banners].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))

  const handleToggleStatus = async (banner) => {
    const updated = { ...banner, enabled: !banner.enabled }
    await onSaveBanner?.(updated)
    showToast?.(`Banner ${banner.sortOrder ?? ''} is now ${updated.enabled ? 'Active' : 'Inactive'}`, 'info')
  }

  return (
    <div className="admin-page-content">
      {/* Page Header */}
      <div className="page-header-actions">
        <div>
          <h2>{adminT("Storefront Banners")}</h2>
          <p className="page-subtitle">{adminT("Upload image-first promotional artwork for the customer home carousel")}</p>
        </div>
        <button
          className="admin-btn-gold"
          onClick={() => setEditingBanner({
            image: '',
            link: '',
            sortOrder: banners.length + 1,
            enabled: true
          })}
        >
          <IconPlus size={16} />
          <span>{adminT("Add Banner")}</span>
        </button>
      </div>

      {/* Banners Grid Display */}
      <div className="banners-card-grid">
        {sortedBanners.map((banner) => (
          <div key={banner.id} className="admin-card banner-display-card">
            <div className="banner-preview-frame" onClick={() => setPreviewBanner(banner)}>
              <img src={banner.image} alt={banner.altText || 'Banner artwork preview'} className="banner-img-cover" />
              <div className="banner-overlay-tags">
                <span className={`status-pill ${banner.enabled ? 'pill-active' : 'pill-inactive'}`}>
                  {adminT(banner.enabled ? 'Active' : 'Inactive')}
                </span>
                <span className="order-pill">Order #{banner.sortOrder ?? 1}</span>
              </div>
            </div>

            <div className="banner-card-body">
              <h4 className="banner-title">{banner.altText || `Banner ${banner.sortOrder ?? ''}`}</h4>

              <div className="banner-meta-rows">
                <div className="banner-meta-item">
                  <span className="meta-label">{adminT("Target Link:")}</span>
                  <span className="meta-val font-mono">{banner.link || '/'}</span>
                </div>
                <div className="banner-meta-item">
                  <span className="meta-label">{adminT("Schedule:")}</span>
                  <span className="meta-val text-muted">{banner.startDate || 'Immediate'} &rarr; {banner.endDate || 'Indefinite'}</span>
                </div>
              </div>

              <div className="banner-card-actions">
                <button
                  className={`status-toggle-btn ${banner.enabled ? 'toggle-on' : 'toggle-off'}`}
                  onClick={() => handleToggleStatus(banner)}
                >
                  <span className="toggle-indicator" />
                  {adminT(banner.enabled ? 'Published' : 'Hidden')}
                </button>

                <div className="action-button-group">
                  <button
                    className="admin-icon-btn"
                    title={adminT("Live Preview")}
                    onClick={() => setPreviewBanner(banner)}
                  >
                    <IconEye size={15} />
                  </button>
                  <button
                    className="admin-icon-btn"
                    title={adminT("Edit Banner")}
                    onClick={() => setEditingBanner({ ...banner })}
                  >
                    <IconEdit size={15} />
                  </button>
                  <button
                    className="admin-icon-btn btn-danger-hover"
                    title={adminT("Delete Banner")}
                    onClick={() => setDeleteConfirmId(banner.id)}
                  >
                    <IconTrash size={15} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Edit / Add Modal */}
      {editingBanner && (
        <BannerFormModal
          banner={editingBanner}
          onClose={() => setEditingBanner(null)}
          onSave={async (saved) => {
            await onSaveBanner?.(saved)
            showToast?.(editingBanner.id ? 'Banner updated' : 'Banner created', 'success')
            setEditingBanner(null)
          }}
        />
      )}

      {/* Live Preview Modal */}
      {previewBanner && (
        <BannerPreviewModal
          banner={previewBanner}
          onClose={() => setPreviewBanner(null)}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={Boolean(deleteConfirmId)}
        title={adminT("Delete Banner")}
        message={adminT("Are you sure you want to delete this promotional banner?")}
        confirmText={adminT("Delete Banner")}
        danger={true}
        onConfirm={async () => {
          await onDeleteBanner?.(deleteConfirmId)
          showToast?.('Banner deleted', 'success')
          setDeleteConfirmId(null)
        }}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  )
}

function BannerFormModal({ banner, onClose, onSave }) {
  const isExistingBanner = Boolean(banner.id)
  const [formData, setFormData] = useState(() => ({
    id: banner.id || `ban-${Date.now().toString(36)}`,
    image: banner.image || '',
    altText: banner.altText || '',
    link: banner.link || '',
    sortOrder: banner.sortOrder ?? 1,
    startDate: banner.startDate || '',
    endDate: banner.endDate || '',
    enabled: banner.enabled !== false
  }))
  const [saving, setSaving] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.image) {
      setUploadError('Upload an image or provide an image URL before saving.')
      return
    }
    setSaving(true)
    try {
      await onSave(formData)
    } finally {
      setSaving(false)
    }
  }

  const handleImageUpload = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setUploadError('')
    if (!file.type.startsWith('image/')) {
      setUploadError('Choose an image file.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setUploadError('Choose an image smaller than 2 MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        setUploadError('The selected image could not be read.')
        return
      }
      setFormData((current) => ({ ...current, image: reader.result }))
    }
    reader.onerror = () => setUploadError('The selected image could not be read.')
    reader.readAsDataURL(file)
  }

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal-box form-modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{adminT(banner.id ? 'Edit Banner' : 'Create New Banner')}</h3>
          <button className="modal-close-btn" onClick={onClose}><IconX size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="admin-form">
          <div className="form-group">
            <label>{adminT("Promotional artwork image *")}</label>
            <input type="file" accept="image/*" onChange={handleImageUpload} />
            <span className="text-muted text-sm">{adminT("Image files up to 2 MB. The artwork supplies its own promotional text.")}</span>
            <label htmlFor="banner-image-url">{adminT("Or use an image URL")}</label>
            <input
              id="banner-image-url"
              type="url"
              placeholder={adminT("https://...")}
              value={formData.image.startsWith('data:') ? '' : formData.image}
              onChange={(e) => setFormData({ ...formData, image: e.target.value })}
            />
            {uploadError && <span className="form-error" role="alert">{uploadError}</span>}
          </div>

          {formData.image && (
            <div className="banner-form-preview-thumb">
              <img src={formData.image} alt={adminT("Promotional artwork preview")} />
            </div>
          )}

          <div className="form-grid-2">
            <div className="form-group">
              <label>{adminT("Optional destination link")}</label>
              <input
                type="text"
                placeholder={adminT("https://... or /search")}
                value={formData.link}
                onChange={(e) => setFormData({ ...formData, link: e.target.value })}
              />
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

          <div className="form-grid-2">
            <div className="form-group">
              <label>{adminT("Accessible text (optional)")}</label>
              <input
                type="text"
                maxLength={160}
                placeholder={adminT("Brief description for screen readers")}
                value={formData.altText}
                onChange={(e) => setFormData({ ...formData, altText: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>{adminT("Start Date (optional)")}</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>{adminT("End Date (optional)")}</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              />
            </div>
          </div>

          <div className="form-checkboxes">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.enabled}
                onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
              />
              <span>{adminT("Published & Live on Homepage")}</span>
            </label>
          </div>

          <div className="modal-footer">
            <button type="button" className="admin-btn-secondary" onClick={onClose} disabled={saving}>{' ' + adminT("Cancel") + ' '}</button>
            <button type="submit" className="admin-btn-gold" disabled={saving}>
              {adminT(saving ? 'Saving...' : isExistingBanner ? 'Save Changes' : 'Create Banner')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function BannerPreviewModal({ banner, onClose }) {
  const [device, setDevice] = useState('desktop') // 'desktop' | 'mobile'

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal-box banner-preview-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{adminT("Banner Artwork Preview")}</h3>
          <div className="device-toggle-group">
            <button
              className={`device-btn ${device === 'desktop' ? 'active' : ''}`}
              onClick={() => setDevice('desktop')}
            >
              {adminT("Desktop")}
            </button>
            <button
              className={`device-btn ${device === 'mobile' ? 'active' : ''}`}
              onClick={() => setDevice('mobile')}
            >
              {adminT("Mobile")}
            </button>
          </div>
          <button className="modal-close-btn" onClick={onClose}><IconX size={16} /></button>
        </div>

        <div className="preview-container">
          <div className={`preview-viewport ${device}`}>
            <img
              src={banner.image}
              alt={banner.altText || 'Promotional artwork'}
              className="preview-img-fill"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
