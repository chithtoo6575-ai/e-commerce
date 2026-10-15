import React, { useState, useMemo } from 'react'
import { adminT } from '../adminI18n'
import Badge from '../components/Badge'
import {
  IconPlus,
  IconSearch,
  IconX
} from '../AdminIcons'
import { getVariantStockOptions, hasVariantStock } from '../../lib/productVariants'

export default function StockMovementsPage({
  movements = [],
  products = [],
  onAddMovement,
  showToast
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState('All')
  const [modalOpen, setModalOpen] = useState(false)

  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      const matchSearch =
        !searchTerm ||
        (m.productName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.sku || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.reference || '').toLowerCase().includes(searchTerm.toLowerCase())
      const matchType = typeFilter === 'All' || m.type === typeFilter
      return matchSearch && matchType
    }).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
  }, [movements, searchTerm, typeFilter])

  return (
    <div className="admin-page-content">
      {/* Page Header */}
      <div className="page-header-actions">
        <div>
          <h2>{adminT("Stock Movement Audit Log")}</h2>
          <p className="page-subtitle">{adminT("Track inbound inventory shipments, order deductions, returns, and write-offs")}</p>
        </div>
        <button className="admin-btn-gold" onClick={() => setModalOpen(true)}>
          <IconPlus size={16} />
          <span>{adminT("Record Movement")}</span>
        </button>
      </div>

      {/* Filter and Control Bar */}
      <div className="admin-card filter-card">
        <div className="filter-row">
          <div className="filter-search-box">
            <IconSearch size={15} className="search-icon-muted" />
            <input
              type="text"
              placeholder={adminT("Search product, SKU or reference code...")}
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
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="admin-select"
            >
              <option value="All">{adminT("All Movement Types")}</option>
              <option value="Stock In">{adminT("Stock In")}</option>
              <option value="Stock Out">{adminT("Stock Out")}</option>
              <option value="Adjustment">{adminT("Adjustment")}</option>
              <option value="Return">{adminT("Return")}</option>
              <option value="Damaged">{adminT("Damaged")}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Movements Table */}
      <div className="admin-card">
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{adminT("Date & Time")}</th>
                <th>{adminT("Product")}</th>
                <th>{adminT("SKU")}</th>
                <th>{adminT("Variant")}</th>
                <th>{adminT("Type")}</th>
                <th>{adminT("Qty Delta")}</th>
                <th>{adminT("Prev &rarr; New Stock")}</th>
                <th>{adminT("Reason & Notes")}</th>
                <th>{adminT("Reference")}</th>
                <th>{adminT("Admin / Actor")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredMovements.length === 0 ? (
                <tr>
                  <td colSpan="10" className="table-empty-cell">{' ' + adminT("No stock movements recorded matching your criteria.") + ' '}</td>
                </tr>
              ) : (
                filteredMovements.map((m) => {
                  const isPositive = Number(m.quantity) > 0
                  return (
                    <tr key={m.id} className="table-row-hover">
                      <td className="td-muted">
                        {m.date ? new Date(m.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Recent'}
                      </td>
                      <td>
                        <strong className="text-primary font-medium">{m.productName}</strong>
                      </td>
                      <td className="td-mono">{m.sku || 'N/A'}</td>
                      <td className="td-muted">
                        {(m.variantChanges || []).map((change) => [change.variants?.size, change.variants?.color].filter(Boolean).join(' · ') || 'Standard').join(', ') || '-'}
                      </td>
                      <td>
                        <Badge variant={m.type}>{m.type}</Badge>
                      </td>
                      <td>
                        <strong className={`qty-delta ${isPositive ? 'qty-pos' : 'qty-neg'}`}>
                          {isPositive ? `+${m.quantity}` : m.quantity}
                        </strong>
                      </td>
                      <td className="td-mono">
                        <span className="text-muted">{m.previousStock}</span>
                        <span className="arrow-sep">{' ' + adminT("&rarr;") + ' '}</span>
                        <strong className="text-primary">{m.newStock}</strong>
                      </td>
                      <td>
                        <span className="text-secondary">{m.reason || 'General inventory update'}</span>
                      </td>
                      <td className="td-mono text-muted">{m.reference || '-'}</td>
                      <td>
                        <span className="user-pill">{m.user || 'System'}</span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Movement Modal */}
      {modalOpen && (
        <RecordMovementModal
          products={products}
          onClose={() => setModalOpen(false)}
          onSave={async (movement) => {
            if (!onAddMovement) throw new Error('The stock movement API is unavailable.')
            await onAddMovement(movement)
            showToast?.(`Recorded ${movement.type} for ${movement.productName}`, 'success')
            setModalOpen(false)
          }}
        />
      )}
    </div>
  )
}

function RecordMovementModal({ products, onClose, onSave }) {
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id || '')
  const selectedProduct = products.find((p) => p.id === selectedProductId) || products[0]
  const [selectedVariantKey, setSelectedVariantKey] = useState('')
  const variantOptions = selectedProduct && hasVariantStock(selectedProduct) ? getVariantStockOptions(selectedProduct) : []
  const selectedVariant = variantOptions.find((option) => option.key === selectedVariantKey) || variantOptions[0]

  const [type, setType] = useState('Stock In')
  const [quantity, setQuantity] = useState(10)
  const [reason, setReason] = useState('Supplier restock batch')
  const [reference, setReference] = useState(() => `PO-${Date.now().toString().slice(-6)}`)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedProduct) return

    setSaving(true)
    let delta = Number(quantity)
    if (['Stock Out', 'Damaged'].includes(type)) {
      delta = -Math.abs(delta)
    }

    const payload = {
      productId: selectedProduct.id,
      productName: selectedProduct.nameEn || selectedProduct.name,
      sku: selectedProduct.sku || 'SKU-001',
      type,
      quantity: delta,
      reason,
      reference,
      ...(selectedVariant ? { variants: { ...(selectedVariant.size ? { size: selectedVariant.size } : {}), ...(selectedVariant.color ? { color: selectedVariant.color } : {}) } } : {})
    }

    setSaveError('')
    try {
      await onSave(payload)
    } catch (saveFailure) {
      console.error('[StockMovementsPage] Stock movement failed:', saveFailure)
      setSaveError(saveFailure.message || 'Unable to record the stock movement.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{adminT("Record Stock Movement")}</h3>
          <button className="modal-close-btn" onClick={onClose}><IconX size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="admin-form">
          <div className="form-group">
            <label>{adminT("Target Product *")}</label>
            <select
              value={selectedProductId}
              onChange={(e) => {
                setSelectedProductId(e.target.value)
                setSelectedVariantKey('')
              }}
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nameEn || p.name} (Current Stock: {p.stock ?? 0})
                </option>
              ))}
            </select>
          </div>

          {variantOptions.length > 0 && (
            <div className="form-group">
              <label>{adminT("Variant *")}</label>
              <select value={selectedVariant?.key || ''} onChange={(event) => setSelectedVariantKey(event.target.value)}>
                {variantOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label} ({adminT('Current Stock')}: {selectedProduct.variantStock[option.key]})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="form-grid-2">
            <div className="form-group">
              <label>{adminT("Movement Type *")}</label>
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="Stock In">{adminT("Stock In (Inbound/Restock)")}</option>
                <option value="Stock Out">{adminT("Stock Out (Dispatch/Fulfillment)")}</option>
                <option value="Adjustment">{adminT("Adjustment (Audit Count)")}</option>
                <option value="Return">{adminT("Return (Restocked from Customer)")}</option>
                <option value="Damaged">{adminT("Damaged (Loss Write-off)")}</option>
              </select>
            </div>

            <div className="form-group">
              <label>{adminT("Quantity Count *")}</label>
              <input
                type="number"
                min="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="form-group">
            <label>{adminT("Reason / Note")}</label>
            <input
              type="text"
              required
              placeholder={adminT("e.g. Inbound purchase order arrival")}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>{adminT("Reference Code / Invoice / PO")}</label>
            <input
              type="text"
              placeholder={adminT("e.g. PO-2026-092")}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>

          {selectedProduct && (
            <div className="stock-calc-preview">
              <span>{adminT("Current:") + ' '}<strong>{selectedProduct.stock ?? 0}</strong></span>
              <span>{' ' + adminT("&rarr;") + ' '}</span>
              <span>
                Projected New:{' '}
                <strong className="gold-accent-text">
                  {Math.max(0, (selectedProduct.stock ?? 0) + (['Stock Out', 'Damaged'].includes(type) ? -Math.abs(quantity) : quantity))}
                </strong>
              </span>
              {selectedVariant && (
                <span>
                  {selectedVariant.label}: <strong>{selectedProduct.variantStock[selectedVariant.key]}</strong>
                  {' → '}
                  <strong>{Math.max(0, selectedProduct.variantStock[selectedVariant.key] + (['Stock Out', 'Damaged'].includes(type) ? -Math.abs(quantity) : quantity))}</strong>
                </span>
              )}
            </div>
          )}

          {saveError && <div className="form-error" role="alert">{adminT(saveError)}</div>}

          <div className="modal-footer">
            <button type="button" className="admin-btn-secondary" onClick={onClose} disabled={saving}>{' ' + adminT("Cancel") + ' '}</button>
            <button type="submit" className="admin-btn-gold" disabled={saving}>
              {adminT(saving ? 'Recording...' : 'Save Stock Movement')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
