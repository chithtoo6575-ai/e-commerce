import { useMemo, useRef, useState } from 'react'
import { orderFilters as filters, trackingStages as stages, orderStage, matchesOrderFilter, stageTimestamp, canCancelOrder, isCancelled, orderDateTime as dateTime } from './lib/customerOrders'
import './CustomerOrders.css'

function ProductRow({ item, formatPrice }) {
  const [failed, setFailed] = useState(false)
  return <div className="customer-product-row">
    {item.image && !failed ? <img src={item.image} alt={item.name} loading="lazy" onError={() => setFailed(true)} /> : <div className="customer-product-placeholder" aria-label="Product image unavailable">HT</div>}
    <div><strong>{item.name}</strong><small>Quantity: {item.quantity} · Unit price: {formatPrice(item.price)}</small>{(item.variants?.size || item.variants?.color) && <small>{[item.variants.size, item.variants.color].filter(Boolean).join(' · ')}</small>}</div>
    <b>{formatPrice(item.lineTotal ?? item.price * item.quantity)}</b>
  </div>
}

export default function CustomerOrders({ orders, selectedOrder, setSelectedOrder, formatPrice, onBuyAgain, onCancelOrder, getTrackingUrl, compact = false, loading = false, error = '' }) {
  const [filter, setFilter] = useState('all')
  const [tracking, setTracking] = useState(false)
  const [cancelling, setCancelling] = useState('')
  const topRef = useRef(null)
  const displayed = useMemo(() => orders.filter((order) => matchesOrderFilter(order, filter)).sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0)), [orders, filter])
  const order = selectedOrder
  const canCancel = order && canCancelOrder(order)
  function openOrder(item, track = false) {
    setTracking(track)
    setSelectedOrder(item)
    window.setTimeout(() => topRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 0)
  }
  async function cancel(item) {
    setCancelling(item.id)
    try { await onCancelOrder(item) } finally { setCancelling('') }
  }

  if (order) {
    const currentStage = orderStage(order)
    return <section className={`customer-orders customer-order-details ${compact ? 'customer-orders--compact' : ''}`} aria-label="Order details" ref={topRef}>
      <div className="customer-orders-heading">
        <div><button className="customer-orders-back" onClick={() => setSelectedOrder(null)}>← My Orders</button><h3>{tracking ? 'Track Order' : 'Order Details'}</h3><p>Order #{order.orderNumber || order.id} · {dateTime(order.createdAt)}</p></div>
        <span className={`customer-order-status status-${String(order.status || 'pending').toLowerCase().replaceAll(' ', '-')}`}>{order.status || 'Pending'}</span>
      </div>
      {error && <p className="customer-order-error" role="alert">{error}</p>}
      <div className="customer-sync-note" role="status">Automatic updates every 15 seconds · Shipping: {order.shippingStatus || order.status}</div>
      {isCancelled(order) ? <div className="customer-order-cancelled">This order was cancelled.{order.cancellationReason && <p>{order.cancellationReason}</p>}</div> : <div className="customer-timeline" aria-label="Order tracking progress">
        {stages.map(([label], index) => {
          const completed = index <= currentStage
          const at = stageTimestamp(order, index)
          return <div key={label} aria-current={index === currentStage ? 'step' : undefined} className={`customer-timeline-step ${completed ? 'complete' : ''} ${index === currentStage ? 'current' : ''}`}><i>{completed ? '✓' : ''}</i><div><strong>{label}</strong><small>{completed ? dateTime(at || (index === 0 ? order.createdAt : '')) : 'Awaiting update'}</small></div></div>
        })}
      </div>}
      <div className="customer-detail-grid">
        <section><h4>Order Information</h4><p><span>Order status</span><strong>{order.status}</strong></p><p><span>Payment method</span><strong>{order.paymentMethod || 'Not specified'}</strong></p><p><span>Payment status</span><strong>{order.paymentStatus || 'Pending'}</strong></p>{order.trackingNumber && <p><span>Tracking number</span><strong>{getTrackingUrl?.(order.deliveryCompany, order.trackingNumber) ? <a href={getTrackingUrl(order.deliveryCompany, order.trackingNumber)} target="_blank" rel="noreferrer">{order.trackingNumber}</a> : order.trackingNumber}</strong></p>}</section>
        <section><h4>Customer & Delivery</h4><p><span>Customer</span><strong>{order.customer?.name || 'Not specified'}</strong></p><p><span>Phone</span><strong>{order.customer?.phone || 'Not specified'}</strong></p><p><span>Delivery address</span><strong>{order.customer?.address || 'Not specified'}</strong></p></section>
      </div>
      <section className="customer-products"><h4>Ordered Products</h4>{(order.items || []).map((item, index) => <ProductRow item={item} formatPrice={formatPrice} key={`${item.productId || item.id}-${index}`} />)}</section>
      <section className="customer-totals"><p><span>Subtotal</span><strong>{formatPrice(order.subtotal)}</strong></p><p><span>Delivery Fee</span><strong>{formatPrice(order.shippingFee ?? order.deliveryFee)}</strong></p><p><span>Discount</span><strong>−{formatPrice(order.discount)}</strong></p><p className="customer-grand-total"><span>Grand Total</span><strong>{formatPrice(order.total)}</strong></p></section>
      <div className="customer-order-actions"><button className="customer-btn secondary" onClick={() => onBuyAgain(order)}>Buy Again</button>{canCancel && <button className="customer-btn danger" disabled={!!cancelling} onClick={() => cancel(order)}>{cancelling ? 'Cancelling…' : 'Cancel Order'}</button>}</div>
    </section>
  }
  return <section className={`customer-orders ${compact ? 'customer-orders--compact' : ''}`} aria-label="My orders" ref={topRef}>
    <div className="customer-orders-heading"><div><h3>My Orders</h3><p>Everything you ordered, all in one place.</p></div><span className="customer-sync-note">Auto-updates every 15 seconds</span></div>
    {error && <p className="customer-order-error" role="alert">{error}</p>}
    {loading && <p role="status">Loading your orders…</p>}
    <div className="customer-order-tabs" aria-label="Filter orders">{filters.map(([id, label]) => <button key={id} aria-pressed={filter === id} className={filter === id ? 'active' : ''} onClick={() => setFilter(id)}>{label} <span>{orders.filter((item) => matchesOrderFilter(item, id)).length}</span></button>)}</div>
    <div className="customer-order-list">{displayed.map((item) => <article className="customer-order-card" key={item.id}>
      <header><div><strong>Order #{item.orderNumber || item.id}</strong><small>{dateTime(item.createdAt)}</small></div><span className={`customer-order-status status-${String(item.status || 'pending').toLowerCase().replaceAll(' ', '-')}`}>{item.status || 'Pending'}</span></header>
      <div className="customer-order-preview">{(item.items || []).map((product, index) => <ProductRow key={`${product.productId || product.id}-${index}`} item={product} formatPrice={formatPrice} />)}</div>
      <footer><span>Total <strong>{formatPrice(item.total)}</strong></span><div><button className="customer-btn text" onClick={() => openOrder(item)}>View Details</button><button className="customer-btn secondary" onClick={() => openOrder(item, true)}>Track Order</button><button className="customer-btn text" onClick={() => onBuyAgain(item)}>Buy Again</button>{canCancelOrder(item) && <button className="customer-btn danger" disabled={!!cancelling} onClick={() => cancel(item)}>{cancelling === item.id ? 'Cancelling…' : 'Cancel Order'}</button>}</div></footer>
    </article>)}</div>
    {!loading && !error && !displayed.length && <div className="customer-orders-empty"><strong>No {filter === 'all' ? '' : filters.find(([id]) => id === filter)?.[1].toLowerCase()} orders yet</strong><span>Orders placed with this account will appear here.</span></div>}
  </section>
}
