import React, { useState, useMemo, useEffect } from 'react'
import { adminT } from '../adminI18n'
import Badge from '../components/Badge'
import ConfirmModal from '../components/ConfirmModal'
import {
  IconSearch,
  IconEye,
  IconX,
  IconRefresh
} from '../AdminIcons'

const formatMoney = (val) => `Ks ${Math.round(val || 0).toLocaleString('en-US')}`

const ORDER_STATUSES = [
  'All',
  'Pending',
  'Confirmed',
  'Processing',
  'Packed',
  'Packing',
  'Shipped',
  'Out for Delivery',
  'Delivered',
  'Cancelled'
]

export default function OrdersPage({
  orders = [],
  onUpdateOrder,
  onRefreshOrders,
  selectedOrderFromNav = null,
  showToast
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusTab, setStatusTab] = useState('All')
  const [paymentFilter, setPaymentFilter] = useState('All')
  const [shippingFilter, setShippingFilter] = useState('All')
  const [dateFilter, setDateFilter] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState('')

  const [selectedOrder, setSelectedOrder] = useState(selectedOrderFromNav)
  const [confirmStatusChange, setConfirmStatusChange] = useState(null) // { id, newStatus }

  useEffect(() => {
    if (!selectedOrder) return
    const updatedOrder = orders.find((order) => order.id === selectedOrder.id)
    if (updatedOrder && updatedOrder !== selectedOrder) setSelectedOrder(updatedOrder)
  }, [orders, selectedOrder])

  useEffect(() => {
    if (selectedOrderFromNav) setSelectedOrder(selectedOrderFromNav)
  }, [selectedOrderFromNav])

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const q = searchTerm.toLowerCase()
      const matchSearch =
        !searchTerm ||
        (o.orderNumber || '').toLowerCase().includes(q) ||
        (o.id || '').toLowerCase().includes(q) ||
        (o.customer?.name || '').toLowerCase().includes(q) ||
        (o.customer?.phone || '').includes(q)

      let matchStatus = true
      if (statusTab !== 'All') {
        if (statusTab === 'Pending' && (o.status === 'New' || o.status === 'Pending')) matchStatus = true
        else if (statusTab === 'Packing' && (o.status === 'Packing' || o.status === 'Processing' || o.status === 'Packed')) matchStatus = true
        else matchStatus = o.status === statusTab
      }

      let matchPayment = true
      if (paymentFilter !== 'All') {
        matchPayment = o.paymentStatus === paymentFilter
      }

      let matchShipping = true
      if (shippingFilter !== 'All') {
        matchShipping = o.shippingStatus === shippingFilter
      }

      const matchDate = !dateFilter || String(o.createdAt || '').slice(0, 10) === dateFilter
      return matchSearch && matchStatus && matchPayment && matchShipping && matchDate
    }).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
  }, [orders, searchTerm, statusTab, paymentFilter, shippingFilter, dateFilter])

  const handleRefresh = async () => {
    if (!onRefreshOrders) return
    setRefreshing(true)
    setRefreshError('')
    try {
      await onRefreshOrders()
    } catch (refreshFailure) {
      setRefreshError(refreshFailure.message || 'Unable to refresh orders.')
    } finally {
      setRefreshing(false)
    }
  }

  const handleApplyStatusChange = async () => {
    if (!confirmStatusChange) return
    const { id, newStatus } = confirmStatusChange
    try {
      const updatedOrder = await onUpdateOrder?.(id, { status: newStatus })
      if (!updatedOrder) throw new Error('The order was not updated.')
      showToast?.(`Order status updated to ${newStatus}`, 'success')
      if (selectedOrder?.id === id) setSelectedOrder(updatedOrder)
    } catch (updateError) {
      showToast?.(updateError.message || 'Unable to update order status.', 'error')
    }
    setConfirmStatusChange(null)
  }

  return (
    <div className="admin-page-content">
      {/* Page Header */}
      <div className="page-header-actions">
        <div>
          <h2>{adminT("Order Management")}</h2>
          <p className="page-subtitle">{adminT("Review customer orders, verify payments, and manage fulfillment")}</p>
        </div>
        <button className="admin-btn-secondary" onClick={handleRefresh} disabled={refreshing}>
          <IconRefresh size={15} />
          <span>{adminT(refreshing ? 'Refreshing…' : 'Refresh Orders')}</span>
        </button>
      </div>

      {refreshError && <div className="admin-card form-error" role="alert">{adminT(refreshError)}</div>}

      {/* Status Filter Tabs */}
      <div className="order-status-tabs">
        {ORDER_STATUSES.map((tab) => {
          const count = tab === 'All'
            ? orders.length
            : orders.filter((o) => {
                if (tab === 'Pending') return o.status === 'New' || o.status === 'Pending'
                if (tab === 'Packing') return o.status === 'Packing' || o.status === 'Processing' || o.status === 'Packed'
                return o.status === tab
              }).length

          return (
            <button
              key={tab}
              className={`status-tab-btn ${statusTab === tab ? 'active' : ''}`}
              onClick={() => setStatusTab(tab)}
            >
              <span>{adminT(tab)}</span>
              <span className="tab-counter">{count}</span>
            </button>
          )
        })}
      </div>

      {/* Filter and Search Bar */}
      <div className="admin-card filter-card">
        <div className="filter-row">
          <div className="filter-search-box">
            <IconSearch size={15} className="search-icon-muted" />
            <input
              type="text"
              placeholder={adminT("Search by Order ID, Customer name or Phone...")}
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
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="admin-select"
            >
              <option value="All">{adminT("All Payment Statuses")}</option>
              <option value="Pending Verification">{adminT("Pending Verification")}</option>
              <option value="Verified">{adminT("Verified")}</option>
              <option value="Rejected">{adminT("Rejected")}</option>
              <option value="Not Required">{adminT("Not Required (COD)")}</option>
            </select>

            <select
              value={shippingFilter}
              onChange={(e) => setShippingFilter(e.target.value)}
              className="admin-select"
            >
              <option value="All">{adminT("All Shipping Statuses")}</option>
              <option value="Preparing">{adminT("Preparing")}</option>
              <option value="Shipped">{adminT("Shipped")}</option>
              <option value="In Transit">{adminT("In Transit")}</option>
              <option value="Delivered">{adminT("Delivered")}</option>
              <option value="Failed">{adminT("Failed")}</option>
            </select>
            <input
              type="date"
              aria-label={adminT("Filter orders by date")}
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="admin-select"
            />
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="admin-card">
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{adminT("Order ID")}</th>
                <th>{adminT("Customer Details")}</th>
                <th>{adminT("Date")}</th>
                <th>{adminT("Items")}</th>
                <th>{adminT("Total (Ks)")}</th>
                <th>{adminT("Payment Method")}</th>
                <th>{adminT("Payment Status")}</th>
                <th>{adminT("Fulfillment")}</th>
                <th className="th-action">{adminT("Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan="9" className="table-empty-cell">{' ' + adminT("No orders match your filter criteria.") + ' '}</td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const itemCount = (order.items || []).reduce((sum, item) => sum + Number(item.quantity || 1), 0)
                  return (
                    <tr key={order.id} className="table-row-hover">
                      <td className="td-mono font-medium">
                        <span className="order-id-badge">
                          {order.orderNumber || order.id?.slice(0, 8)}
                        </span>
                      </td>
                      <td>
                        <div className="customer-cell">
                          <strong className="text-primary">{order.customer?.name || 'Guest User'}</strong>
                          <span className="text-secondary text-sm">{order.customer?.phone || 'No phone'}</span>
                        </div>
                      </td>
                      <td className="td-muted">
                        {order.createdAt ? new Date(order.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                      </td>
                      <td>
                        <span className="badge-number-pill">{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
                      </td>
                      <td>
                        <strong className="gold-accent-text font-bold">
                          {formatMoney(order.total)}
                        </strong>
                      </td>
                      <td>
                        <span className="text-secondary">{order.paymentMethod || 'COD'}</span>
                      </td>
                      <td>
                        <Badge>{order.paymentStatus || 'Verified'}</Badge>
                      </td>
                      <td>
                        <Badge>{order.status || 'New'}</Badge>
                      </td>
                      <td className="td-action">
                        <button
                          className="admin-icon-btn"
                          title={adminT("View order details")}
                          onClick={() => setSelectedOrder(order)}
                        >
                          <IconEye size={15} />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Details Drawer */}
      {selectedOrder && (
        <OrderDetailDrawer
          order={selectedOrder}
          orders={orders}
          onClose={() => setSelectedOrder(null)}
          onStatusClick={(newStatus) => {
            setConfirmStatusChange({ id: selectedOrder.id, newStatus })
          }}
          onVerifyPayment={async (status, reason) => {
            try {
              const updatedOrder = await onUpdateOrder?.(selectedOrder.id, { paymentStatus: status, ...(reason ? { paymentRejectionReason: reason } : {}) })
              if (!updatedOrder) throw new Error('The payment status was not updated.')
              showToast?.(`Payment marked as ${status}`, 'success')
              setSelectedOrder(updatedOrder)
            } catch (updateError) {
              showToast?.(updateError.message || 'Unable to update payment status.', 'error')
            }
          }}
          onUpdateShipping={async (changes) => {
            try {
              const updatedOrder = await onUpdateOrder?.(selectedOrder.id, changes)
              if (!updatedOrder) throw new Error('The shipping details were not updated.')
              setSelectedOrder(updatedOrder)
              showToast?.('Shipping details saved.', 'success')
            } catch (updateError) {
              showToast?.(updateError.message || 'Unable to update shipping details.', 'error')
              throw updateError
            }
          }}
        />
      )}

      {/* Status Change Confirmation */}
      <ConfirmModal
        isOpen={Boolean(confirmStatusChange)}
        title={adminT("Confirm Order Status Change")}
        message={adminT(`Are you sure you want to change order ${confirmStatusChange?.id?.slice(0, 8)} to "${confirmStatusChange?.newStatus}"?`)}
        confirmText={adminT("Update Status")}
        danger={confirmStatusChange?.newStatus === 'Cancelled'}
        onConfirm={handleApplyStatusChange}
        onCancel={() => setConfirmStatusChange(null)}
      />
    </div>
  )
}

function OrderDetailDrawer({ order, orders = [], onClose, onStatusClick, onVerifyPayment, onUpdateShipping }) {
  const items = order.items || []
  const distinctProductCount = new Set(items.map((item) => item.productId || item.id).filter(Boolean)).size
  const subtotal = Number(order.subtotal ?? items.reduce((sum, it) => sum + (Number(it.price || 0) * Number(it.quantity || 1)), 0))
  const shippingFee = Number(order.shippingFee ?? order.deliveryFee ?? 0)
  const discount = Number(order.discount || 0)
  const grandTotal = Number(order.total || (subtotal + shippingFee - discount))
  const customerHistory = orders.filter((candidate) =>
    candidate.id !== order.id &&
    ((order.customer?.userId && candidate.customer?.userId === order.customer.userId) ||
      (!order.customer?.userId && order.customer?.phone && candidate.customer?.phone === order.customer.phone))
  )
  const [deliveryCompany, setDeliveryCompany] = useState(order.deliveryCompany || '')
  const [trackingNumber, setTrackingNumber] = useState(order.trackingNumber || '')
  const [shippingSaving, setShippingSaving] = useState(false)
  const [rejectionReason, setRejectionReason] = useState(order.paymentRejectionReason || '')
  const [rejectingPayment, setRejectingPayment] = useState(false)
  const [slipOpen, setSlipOpen] = useState(false)

  useEffect(() => {
    setDeliveryCompany(order.deliveryCompany || '')
    setTrackingNumber(order.trackingNumber || '')
    setRejectionReason(order.paymentRejectionReason || '')
  }, [order.id, order.deliveryCompany, order.trackingNumber, order.paymentRejectionReason])

  return (
    <div className="admin-drawer-overlay" onClick={onClose}>
      <div className="admin-drawer order-drawer-wide" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <h3>Order {order.orderNumber || order.id?.slice(0, 10)}</h3>
            <span className="text-muted text-sm">
              Placed on {order.createdAt ? new Date(order.createdAt).toLocaleString() : 'Recent'}
            </span>
          </div>
          <button className="modal-close-btn" onClick={onClose}><IconX size={16} /></button>
        </div>

        <div className="drawer-body">
          {/* Quick Status Control Bar */}
          <div className="order-quick-status-bar">
            <span>{adminT("Fulfillment State:")}</span>
            <Badge>{order.status || 'New'}</Badge>
            <div className="status-action-btns">
              {({
                New: ['Confirmed', 'Cancelled'],
                Pending: ['Confirmed', 'Cancelled'],
                Confirmed: ['Processing', 'Cancelled'],
                Processing: ['Packed', 'Cancelled'],
                Packed: ['Shipped', 'Cancelled'],
                Packing: ['Shipped', 'Cancelled'],
                Shipped: ['Out for Delivery', 'Delivered'],
                'Out for Delivery': ['Delivered'],
                Delivered: [],
                Cancelled: []
              }[order.status] || []).map((st) => (
                <button
                  key={st}
                  className={`status-btn-choice ${order.status === st ? 'active' : ''}`}
                  onClick={() => onStatusClick(st)}
                >
                  {(order.status === 'New' || order.status === 'Pending') && st === 'Confirmed' ? 'Accept Order' : st}
                </button>
              ))}
            </div>
          </div>

          {/* Customer & Shipping Summary Grid */}
          <div className="drawer-specs-grid order-info-grid">
            <div className="spec-card">
              <small>{adminT("Customer Name")}</small>
              <strong className="text-primary">{order.customer?.name || 'Guest User'}</strong>
            </div>
            <div className="spec-card">
              <small>{adminT("Phone Number")}</small>
              <span className="text-secondary font-mono">{order.customer?.phone || 'N/A'}</span>
            </div>
            <div className="spec-card">
              <small>{adminT("Customer ID")}</small>
              <span className="text-secondary font-mono">{order.customer?.userId || 'Guest'}</span>
            </div>
            <div className="spec-card">
              <small>{adminT("Email")}</small>
              <span className="text-secondary">{order.customer?.email || 'Not provided'}</span>
            </div>
            <div className="spec-card">
              <small>{adminT("Payment Method")}</small>
              <strong className="gold-accent-text">{order.paymentMethod || 'COD'}</strong>
            </div>
            <div className="spec-card">
              <small>{adminT("Payment Verification")}</small>
              <div className="payment-verify-row">
                <Badge>{order.paymentStatus || 'Verified'}</Badge>
                {order.paymentStatus !== 'Verified' && order.paymentStatus !== 'Not Required' && (
                  <button
                    className="admin-btn-secondary btn-xs"
                    onClick={() => onVerifyPayment('Verified', '')}
                  >
                    {adminT("Mark Verified")}
                  </button>
                )}
                {order.paymentStatus !== 'Rejected' && order.paymentStatus !== 'Not Required' && (
                  rejectingPayment ? (
                    <div className="payment-reject-form">
                      <input
                        value={rejectionReason}
                        onChange={(event) => setRejectionReason(event.target.value)}
                        placeholder={adminT("Rejection reason")}
                        maxLength={500}
                        aria-label={adminT("Payment rejection reason")}
                      />
                      <button className="admin-btn-danger btn-xs" disabled={!rejectionReason.trim()} onClick={() => {
                        onVerifyPayment('Rejected', rejectionReason.trim())
                        setRejectingPayment(false)
                      }}>{adminT("Save rejection")}</button>
                    </div>
                  ) : (
                    <button className="admin-btn-danger btn-xs" onClick={() => setRejectingPayment(true)}>
                      {adminT("Reject")}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>

          {/* Delivery Address */}
          <div className="drawer-section">
            <h5>{adminT("Delivery Address")}</h5>
            <div className="address-box">
              {(order.customer?.township || order.customer?.city || order.customer?.region) && (
                <p>{[order.customer.township, order.customer.city, order.customer.region].filter(Boolean).join(', ')}</p>
              )}
              <p>{order.customer?.address || 'No street address specified.'}</p>
            </div>
          </div>

          <div className="drawer-section">
            <h5>{adminT("Delivery & Tracking")}</h5>
            <p className="text-secondary text-sm">Method: {order.deliveryMethod || 'Not specified'} · Shipping status: {order.shippingStatus || 'Preparing'}</p>
            <div className="form-grid-2">
              <label className="form-group">{adminT("Delivery company")}<input value={deliveryCompany} onChange={(event) => setDeliveryCompany(event.target.value)} maxLength={120} /></label>
              <label className="form-group">{adminT("Tracking number")}<input value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} maxLength={100} /></label>
            </div>
            <button
              className="admin-btn-secondary"
              disabled={shippingSaving}
              onClick={async () => {
                setShippingSaving(true)
                try {
                  await onUpdateShipping?.({ deliveryCompany, trackingNumber })
                } finally {
                  setShippingSaving(false)
                }
              }}
            >
              {adminT(shippingSaving ? 'Saving…' : 'Save Shipping Details')}
            </button>
          </div>

          {/* Ordered Products Table */}
          <div className="drawer-section">
            <h5>Ordered Products ({distinctProductCount} types)</h5>
            <div className="drawer-items-list">
              {items.map((it, idx) => (
                <div key={idx} className="drawer-product-row">
                  <div className="drawer-prod-thumb">
                    {it.image ? (
                      <img src={it.image} alt={it.name} />
                    ) : (
                      <div className="thumb-placeholder">{it.name?.[0] || 'P'}</div>
                    )}
                  </div>
                  <div className="drawer-prod-details">
                    <strong className="text-primary">{it.name}</strong>
                    <span className="text-muted text-xs">
                      Product ID: {it.productId || it.id || 'N/A'} · SKU: {it.sku || 'N/A'}
                    </span>
                    <span className="text-muted text-xs">
                      Variant: {[it.variants?.size, it.variants?.color].filter(Boolean).join(' / ') || 'None'}
                    </span>
                    <span className="text-secondary text-sm">
                      {formatMoney(it.price)} &times; {it.quantity || 1}
                    </span>
                  </div>
                  <div className="drawer-prod-total">
                    <small>{adminT("Line total")}</small>
                    <strong className="gold-accent-text">
                      {formatMoney(it.lineTotal ?? (it.price || 0) * (it.quantity || 1))}
                    </strong>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Financial Breakdown */}
          <div className="drawer-section">
            <h5>{adminT("Order Financial Summary")}</h5>
            <div className="order-totals-box">
              <div className="total-row">
                <span>{adminT("Subtotal")}</span>
                <span>{formatMoney(subtotal)}</span>
              </div>
              {order.couponCode && <div className="total-row"><span>Promotion ({order.couponCode})</span><span>{adminT("Applied")}</span></div>}
              <div className="total-row discount-row">
                <span>{adminT("Discount")}</span>
                <span>{discount > 0 ? `-${formatMoney(discount)}` : formatMoney(0)}</span>
              </div>
              <div className="total-row">
                <span>{adminT("Shipping & Delivery Fee")}</span>
                <span>{formatMoney(shippingFee)}</span>
              </div>
              <div className="total-row grand-total-row">
                <strong>{adminT("Grand Total")}</strong>
                <strong className="gold-accent-text">{formatMoney(grandTotal)}</strong>
              </div>
            </div>
          </div>

          {customerHistory.length > 0 && (
            <div className="drawer-section">
              <h5>Other Customer Orders ({customerHistory.length})</h5>
              {customerHistory.map((customerOrder) => (
                <div className="total-row" key={customerOrder.id}>
                  <span>{customerOrder.orderNumber || customerOrder.id} · {adminT(customerOrder.status)}</span>
                  <strong>{formatMoney(customerOrder.total)}</strong>
                </div>
              ))}
            </div>
          )}

          <div className="drawer-section">
            <h5>{adminT("Payment Information")}</h5>
            <div className="drawer-specs-grid">
              <div className="spec-card"><small>{adminT("Payment amount")}</small><strong>{formatMoney(order.paymentAmount ?? grandTotal)}</strong></div>
              <div className="spec-card"><small>{adminT("Payment date")}</small><span className="text-secondary">{order.paymentUpdatedAt ? new Date(order.paymentUpdatedAt).toLocaleString() : 'Not verified yet'}</span></div>
              <div className="spec-card"><small>{adminT("Reference ID")}</small><span className="text-secondary font-mono">{order.transactionId || order.referenceId || 'Not provided'}</span></div>
              {order.paymentRejectionReason && <div className="spec-card"><small>{adminT("Rejection reason")}</small><span className="text-secondary">{order.paymentRejectionReason}</span></div>}
            </div>
          </div>

          <div className="drawer-section">
            <h5>{adminT("Payment Slip")}</h5>
            {(order.receipt?.dataUrl || order.paymentProof) ? (
              <button className="payment-slip-view payment-slip-button" onClick={() => setSlipOpen(true)} title={adminT("Open payment slip")}>
                <img src={order.receipt?.dataUrl || order.paymentProof} alt={adminT("Uploaded payment slip thumbnail")} />
              </button>
            ) : <p className="text-secondary">{adminT("Payment slip မတင်ရသေးပါ")}</p>}
          </div>

          <div className="drawer-section">
            <h5>{adminT("Order Timeline")}</h5>
            <div className="order-timeline">
              {(Array.isArray(order.statusHistory) && order.statusHistory.length ? order.statusHistory : [{ status: order.status || 'Pending', at: order.createdAt }]).map((event, index, history) => (
                <div className={`order-timeline-event ${event.status === order.status ? 'current' : ''}`} key={`${event.status}-${event.at}-${index}`}>
                  <span className="order-timeline-dot">{index < history.length - 1 || event.status === order.status ? '✓' : ''}</span>
                  <div><strong>{adminT(event.status)}</strong><small>{event.at ? new Date(event.at).toLocaleString() : '—'}</small></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="drawer-footer">
          <button className="admin-btn-secondary" onClick={onClose}>{' ' + adminT("Close") + ' '}</button>
        </div>
        {slipOpen && (
          <div className="admin-modal-overlay slip-lightbox" onClick={() => setSlipOpen(false)}>
            <div className="slip-lightbox-content" onClick={(event) => event.stopPropagation()}>
              <button className="modal-close-btn slip-lightbox-close" onClick={() => setSlipOpen(false)}><IconX size={16} /></button>
              <img src={order.receipt?.dataUrl || order.paymentProof} alt={adminT("Payment slip full size")} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
