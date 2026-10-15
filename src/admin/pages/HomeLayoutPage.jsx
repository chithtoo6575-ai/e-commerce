import React, { useState } from 'react'
import { adminT } from '../adminI18n'
import {
  IconChevronUp,
  IconChevronDown,
  IconEye,
  IconX,
  IconRefresh
} from '../AdminIcons'

export default function HomeLayoutPage({
  layout = [],
  onSaveLayout,
  showToast
}) {
  const [blocks, setBlocks] = useState(layout.filter((block) => block.id !== 'block-categories').sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)))
  const [previewOpen, setPreviewOpen] = useState(false)

  const handleMove = (index, direction) => {
    const target = index + direction
    if (target < 0 || target >= blocks.length) return
    const updated = [...blocks]
    const temp = updated[index]
    updated[index] = updated[target]
    updated[target] = temp

    const reordered = updated.map((b, idx) => ({ ...b, sortOrder: idx + 1 }))
    setBlocks(reordered)
    onSaveLayout?.(reordered)
    showToast?.('Homepage layout updated', 'info')
  }

  const handleToggle = (id) => {
    const updated = blocks.map((b) => b.id === id ? { ...b, enabled: !b.enabled } : b)
    setBlocks(updated)
    onSaveLayout?.(updated)
    const block = updated.find((b) => b.id === id)
    showToast?.(`Block "${block.name}" is now ${block.enabled ? 'Visible' : 'Hidden'}`, 'info')
  }

  const handleResetDefault = () => {
    // Reset to standard order
    const reset = blocks.map((b, idx) => ({ ...b, enabled: true, sortOrder: idx + 1 }))
    setBlocks(reset)
    onSaveLayout?.(reset)
    showToast?.('Reset layout to default order', 'success')
  }

  return (
    <div className="admin-page-content">
      {/* Page Header */}
      <div className="page-header-actions">
        <div>
          <h2>{adminT("Storefront Homepage Layout")}</h2>
          <p className="page-subtitle">{adminT("Drag or reorder modular homepage sections and toggle customer visibility")}</p>
        </div>
        <div className="header-action-btns">
          <button className="admin-btn-secondary" onClick={() => setPreviewOpen(true)}>
            <IconEye size={16} />
            <span>{adminT("Layout Preview")}</span>
          </button>
          <button className="admin-btn-secondary" onClick={handleResetDefault}>
            <IconRefresh size={15} />
            <span>{adminT("Reset Order")}</span>
          </button>
        </div>
      </div>

      {/* Layout Blocks Reorder Table */}
      <div className="admin-card">
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: 80 }}>{adminT("Position")}</th>
                <th style={{ width: 90 }}>{adminT("Move")}</th>
                <th>{adminT("Layout Block Component")}</th>
                <th>{adminT("Description")}</th>
                <th>{adminT("Visibility in Shop")}</th>
              </tr>
            </thead>
            <tbody>
              {blocks.map((block, index) => {
                const isFirst = index === 0
                const isLast = index === blocks.length - 1
                return (
                  <tr key={block.id} className={`table-row-hover ${!block.enabled ? 'row-muted' : ''}`}>
                    <td>
                      <span className="order-pill font-mono">#{block.sortOrder}</span>
                    </td>
                    <td>
                      <div className="order-reorder-btns">
                        <button
                          className="admin-icon-btn btn-sm"
                          disabled={isFirst}
                          onClick={() => handleMove(index, -1)}
                          title={adminT("Move up")}
                        >
                          <IconChevronUp size={14} />
                        </button>
                        <button
                          className="admin-icon-btn btn-sm"
                          disabled={isLast}
                          onClick={() => handleMove(index, 1)}
                          title={adminT("Move down")}
                        >
                          <IconChevronDown size={14} />
                        </button>
                      </div>
                    </td>
                    <td>
                      <div className="block-name-cell">
                        <strong className="text-primary font-medium">{block.name}</strong>
                        {!block.enabled && <span className="hidden-tag">{adminT("Hidden")}</span>}
                      </div>
                    </td>
                    <td>
                      <span className="text-secondary text-sm">{block.description}</span>
                    </td>
                    <td>
                      <button
                        className={`status-toggle-btn ${block.enabled ? 'toggle-on' : 'toggle-off'}`}
                        onClick={() => handleToggle(block.id)}
                      >
                        <span className="toggle-indicator" />
                        {adminT(block.enabled ? 'Visible' : 'Hidden')}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live Storefront Preview Modal */}
      {previewOpen && (
        <div className="admin-modal-overlay" onClick={() => setPreviewOpen(false)}>
          <div className="admin-modal-box layout-preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>{adminT("Storefront Layout Wireframe")}</h3>
                <small className="text-muted">{adminT("Simulated representation of the homepage blocks sequence")}</small>
              </div>
              <button className="modal-close-btn" onClick={() => setPreviewOpen(false)}>
                <IconX size={16} />
              </button>
            </div>

            <div className="layout-preview-body">
              <div className="mock-store-frame">
                {/* Store Header bar */}
                <div className="mock-store-topbar">
                  <span className="mock-logo">{adminT("HTOO")}</span>
                  <div className="mock-search-bar" />
                  <div className="mock-icons-row" />
                </div>

                {/* Rendered active blocks in order */}
                <div className="mock-blocks-container">
                  {blocks.filter((b) => b.enabled).map((b) => (
                    <div key={b.id} className="mock-block-item">
                      <div className="mock-block-tag">
                        <span>#{b.sortOrder} {b.name}</span>
                        <span className="active-dot" />
                      </div>
                      <div className={`mock-block-visual mock-style-${b.id}`}>
                        {b.id === 'block-hero' && (
                          <div className="mock-hero-slide">
                            <span className="mock-hero-text">{adminT("HTOO GOLD LUXURY COLLECTION &bull; HERO SLIDER")}</span>
                          </div>
                        )}
                        {b.id === 'block-featured' && (
                          <div className="mock-prod-cards-row">
                            <div className="mock-card" /><div className="mock-card" /><div className="mock-card" /><div className="mock-card" />
                          </div>
                        )}
                        {b.id === 'block-promo' && (
                          <div className="mock-promo-split">
                            <div className="mock-promo-half" /><div className="mock-promo-half" />
                          </div>
                        )}
                        {['block-new', 'block-best', 'block-discount', 'block-recommend'].includes(b.id) && (
                          <div className="mock-prod-cards-row">
                            <div className="mock-card" /><div className="mock-card" /><div className="mock-card" /><div className="mock-card" />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
