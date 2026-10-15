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

export default function HomeSectionsPage({
  sections = [],
  onSaveSections,
  showToast
}) {
  const [editingSection, setEditingSection] = useState(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)

  const sortedSections = [...sections].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))

  const handleMove = (index, direction) => {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= sortedSections.length) return

    const newSections = [...sortedSections]
    const temp = newSections[index]
    newSections[index] = newSections[targetIndex]
    newSections[targetIndex] = temp

    // Reassign sort orders
    const updated = newSections.map((sec, idx) => ({ ...sec, sortOrder: idx + 1 }))
    onSaveSections?.(updated)
    showToast?.('Section order updated', 'info')
  }

  const handleToggleStatus = (sec) => {
    const updated = sortedSections.map((s) => s.id === sec.id ? { ...s, enabled: !s.enabled } : s)
    onSaveSections?.(updated)
    showToast?.(`Section "${sec.title}" is now ${sec.enabled ? 'Disabled' : 'Enabled'}`, 'info')
  }

  return (
    <div className="admin-page-content">
      {/* Page Header */}
      <div className="page-header-actions">
        <div>
          <h2>{adminT("Home Sections")}</h2>
          <p className="page-subtitle">{adminT("Configure product curation blocks and promotional sections on the storefront homepage")}</p>
        </div>
        <button
          className="admin-btn-gold"
          onClick={() => setEditingSection({
            title: '',
            subtitle: '',
            source: 'featured',
            displayStyle: 'grid',
            enabled: true,
            sortOrder: sortedSections.length + 1
          })}
        >
          <IconPlus size={16} />
          <span>{adminT("Add Section")}</span>
        </button>
      </div>

      {/* Sections List */}
      <div className="admin-card">
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: 80 }}>{adminT("Reorder")}</th>
                <th>{adminT("Section Title")}</th>
                <th>{adminT("Subtitle")}</th>
                <th>{adminT("Product Source")}</th>
                <th>{adminT("Display Style")}</th>
                <th>{adminT("Status")}</th>
                <th className="th-action">{adminT("Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {sortedSections.map((sec, index) => {
                const isEnabled = sec.enabled !== false
                return (
                  <tr key={sec.id} className="table-row-hover">
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
                          disabled={index === sortedSections.length - 1}
                          onClick={() => handleMove(index, 1)}
                          title={adminT("Move down")}
                        >
                          <IconChevronDown size={14} />
                        </button>
                      </div>
                    </td>
                    <td>
                      <strong className="text-primary font-medium">{sec.title}</strong>
                    </td>
                    <td>
                      <span className="text-secondary text-sm">{sec.subtitle || '-'}</span>
                    </td>
                    <td>
                      <span className="category-pill">{sec.source}</span>
                    </td>
                    <td>
                      <span className="style-pill font-mono">{sec.displayStyle}</span>
                    </td>
                    <td>
                      <button
                        className={`status-toggle-btn ${isEnabled ? 'toggle-on' : 'toggle-off'}`}
                        onClick={() => handleToggleStatus(sec)}
                      >
                        <span className="toggle-indicator" />
                        {adminT(isEnabled ? 'Enabled' : 'Disabled')}
                      </button>
                    </td>
                    <td className="td-action">
                      <div className="action-button-group">
                        <button
                          className="admin-icon-btn"
                          title={adminT("Edit section")}
                          onClick={() => setEditingSection({ ...sec })}
                        >
                          <IconEdit size={15} />
                        </button>
                        <button
                          className="admin-icon-btn btn-danger-hover"
                          title={adminT("Delete section")}
                          onClick={() => setDeleteConfirmId(sec.id)}
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

      {/* Edit / Add Modal */}
      {editingSection && (
        <SectionModal
          section={editingSection}
          onClose={() => setEditingSection(null)}
          onSave={(saved) => {
            const exists = sortedSections.some((s) => s.id === saved.id)
            let updated
            if (exists) {
              updated = sortedSections.map((s) => s.id === saved.id ? saved : s)
            } else {
              updated = [...sortedSections, saved]
            }
            onSaveSections?.(updated)
            showToast?.(exists ? 'Section updated' : 'Section created', 'success')
            setEditingSection(null)
          }}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={Boolean(deleteConfirmId)}
        title={adminT("Delete Home Section")}
        message={adminT("Are you sure you want to remove this section from the storefront homepage?")}
        confirmText={adminT("Delete Section")}
        danger={true}
        onConfirm={() => {
          const updated = sortedSections.filter((s) => s.id !== deleteConfirmId)
          onSaveSections?.(updated)
          showToast?.('Section deleted', 'success')
          setDeleteConfirmId(null)
        }}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  )
}

function SectionModal({ section, onClose, onSave }) {
  const [formData, setFormData] = useState(() => ({
    id: section.id || `sec-${Date.now().toString(36)}`,
    title: section.title || '',
    subtitle: section.subtitle || '',
    source: section.source || 'featured',
    displayStyle: section.displayStyle || 'grid',
    enabled: section.enabled !== false,
    sortOrder: section.sortOrder ?? 1
  }))

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(formData)
  }

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{adminT(section.id ? 'Edit Home Section' : 'Create Home Section')}</h3>
          <button className="modal-close-btn" onClick={onClose}><IconX size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="admin-form">
          <div className="form-group">
            <label>{adminT("Section Title *")}</label>
            <input
              type="text"
              required
              placeholder={adminT("e.g. Best Selling Luxury Items")}
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>{adminT("Subtitle / Description")}</label>
            <input
              type="text"
              placeholder={adminT("e.g. Customer favorites this season")}
              value={formData.subtitle}
              onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
            />
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label>{adminT("Product Source *")}</label>
              <select
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
              >
                <option value="featured">{adminT("Featured Products")}</option>
                <option value="new_arrivals">{adminT("New Arrivals")}</option>
                <option value="best_sellers">{adminT("Best Sellers")}</option>
                <option value="discount">{adminT("Flash Deals & Discounts")}</option>
                <option value="recommended">{adminT("Personalized Recommendations")}</option>
              </select>
            </div>

            <div className="form-group">
              <label>{adminT("Display Layout Style *")}</label>
              <select
                value={formData.displayStyle}
                onChange={(e) => setFormData({ ...formData, displayStyle: e.target.value })}
              >
                <option value="grid">{adminT("Product Grid (4 Columns)")}</option>
                <option value="carousel">{adminT("Horizontal Carousel")}</option>
                <option value="banner_grid">{adminT("Banner + 3-Item Grid")}</option>
              </select>
            </div>
          </div>

          <div className="form-checkboxes">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.enabled}
                onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
              />
              <span>{adminT("Enabled & Visible on Homepage")}</span>
            </label>
          </div>

          <div className="modal-footer">
            <button type="button" className="admin-btn-secondary" onClick={onClose}>{' ' + adminT("Cancel") + ' '}</button>
            <button type="submit" className="admin-btn-gold">{' ' + adminT("Save Section") + ' '}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
