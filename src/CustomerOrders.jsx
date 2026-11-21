import { useMemo, useRef, useState } from "react";
import {
  orderFilters as filters,
  trackingStages as stages,
  orderStage,
  matchesOrderFilter,
  stageTimestamp,
  canCancelOrder,
  isCancelled,
  orderDateTime as dateTime,
} from "./lib/customerOrders";
import "./CustomerOrders.css";

function OrderThumb({ image, name }) {
  const [failed, setFailed] = useState(false);
  if (!image || failed)
    return (
      <div className="customer-order-thumb" aria-hidden="true">
        HT
      </div>
    );
  return (
    <img
      className="customer-order-thumb"
      src={image}
      alt={name ? `Product image for ${name}` : ""}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

function ProductRow({ item, formatPrice, tr }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="customer-product-row">
      {item.image && !failed ? (
        <img
          src={item.image}
          alt={item.name}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <div
          className="customer-product-placeholder"
          aria-label={tr("Product image unavailable")}
        >
          HT
        </div>
      )}
      <div>
        <strong>{item.name}</strong>
        <small>
          {tr("Quantity")}: {item.quantity} · {tr("Unit price")}:{" "}
          {formatPrice(item.price)}
        </small>
        {(item.variants?.size || item.variants?.color) && (
          <small>
            {[item.variants.size, item.variants.color]
              .filter(Boolean)
              .join(" · ")}
          </small>
        )}
      </div>
      <b>{formatPrice(item.lineTotal ?? item.price * item.quantity)}</b>
    </div>
  );
}

function itemCountOf(order) {
  return (order.items || []).reduce(
    (total, item) => total + Number(item.quantity || 0),
    0,
  );
}

export default function CustomerOrders({
  orders,
  selectedOrder,
  setSelectedOrder,
  formatPrice,
  onBuyAgain,
  onCancelOrder,
  getTrackingUrl,
  compact = false,
  loading = false,
  error = "",
  tr = (text) => text,
}) {
  const [filter, setFilter] = useState("all");
  const [tracking, setTracking] = useState(false);
  const [cancelling, setCancelling] = useState("");
  const topRef = useRef(null);
  const displayed = useMemo(
    () =>
      orders
        .filter((order) => matchesOrderFilter(order, filter))
        .sort(
          (a, b) =>
            (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0),
        ),
    [orders, filter],
  );
  const order = selectedOrder;
  const canCancel = order && canCancelOrder(order);
  function openOrder(item, track = false) {
    setTracking(track);
    setSelectedOrder(item);
    window.setTimeout(
      () =>
        topRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }),
      0,
    );
  }
  async function cancel(item) {
    setCancelling(item.id);
    try {
      await onCancelOrder(item);
    } finally {
      setCancelling("");
    }
  }

  // ---- Order details: a separate page (desktop) / screen (mobile) reached from a card ----
  if (order) {
    const currentStage = orderStage(order);
    const itemCount = itemCountOf(order);
    return (
      <section
        className={`customer-orders customer-order-details ${compact ? "customer-orders--compact" : ""}`}
        aria-label={tr("Order details")}
        ref={topRef}
      >
        <div className="customer-order-details-topbar">
          <button
            className="customer-orders-back"
            onClick={() => setSelectedOrder(null)}
          >
            ← {tr("My Orders")}
          </button>
          <span
            className={`customer-order-status status-${String(
              order.status || "pending",
            )
              .toLowerCase()
              .replaceAll(" ", "-")}`}
          >
            {tr(order.status || "Pending")}
          </span>
        </div>
        <div className="customer-orders-heading">
          <div>
            <h3>{tr(tracking ? "Track Order" : "Order Details")}</h3>
            <p>
              Order #{order.orderNumber || order.id} ·{" "}
              {dateTime(order.createdAt)} · {itemCount}{" "}
              {tr(itemCount === 1 ? "item" : "items")}
            </p>
          </div>
        </div>
        {error && (
          <p className="customer-order-error" role="alert">
            {error}
          </p>
        )}
        <div className="customer-sync-note" role="status">
          {tr("Automatic updates every 15 seconds")} · {tr("Shipping")}:{" "}
          {tr(order.shippingStatus || order.status)}
        </div>
        {isCancelled(order) ? (
          <div className="customer-order-cancelled">
            {tr("This order was cancelled.")}
            {order.cancellationReason && <p>{order.cancellationReason}</p>}
          </div>
        ) : (
          <div
            className="customer-timeline"
            aria-label={tr("Order tracking progress")}
          >
            {stages.map(([label], index) => {
              const completed = index <= currentStage;
              const at = stageTimestamp(order, index);
              return (
                <div
                  key={label}
                  aria-current={index === currentStage ? "step" : undefined}
                  className={`customer-timeline-step ${completed ? "complete" : ""} ${index === currentStage ? "current" : ""}`}
                >
                  <i>{completed ? "✓" : ""}</i>
                  <div>
                    <strong>{tr(label)}</strong>
                    <small>
                      {completed
                        ? dateTime(at || (index === 0 ? order.createdAt : ""))
                        : tr("Awaiting update")}
                    </small>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="customer-detail-grid">
          <section>
            <h4>{tr("Order Information")}</h4>
            <p>
              <span>{tr("Order status")}</span>
              <strong>{tr(order.status || "Pending")}</strong>
            </p>
            <p>
              <span>{tr("Payment method")}</span>
              <strong>{order.paymentMethod || tr("Not specified")}</strong>
            </p>
            <p>
              <span>{tr("Payment status")}</span>
              <strong>{tr(order.paymentStatus || "Pending")}</strong>
            </p>
            {order.trackingNumber && (
              <p>
                <span>{tr("Tracking number")}</span>
                <strong>
                  {getTrackingUrl?.(
                    order.deliveryCompany,
                    order.trackingNumber,
                  ) ? (
                    <a
                      href={getTrackingUrl(
                        order.deliveryCompany,
                        order.trackingNumber,
                      )}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {order.trackingNumber}
                    </a>
                  ) : (
                    order.trackingNumber
                  )}
                </strong>
              </p>
            )}
          </section>
          <section>
            <h4>{tr("Customer & Delivery")}</h4>
            <p>
              <span>{tr("Customer")}</span>
              <strong>{order.customer?.name || tr("Not specified")}</strong>
            </p>
            <p>
              <span>{tr("Phone")}</span>
              <strong>{order.customer?.phone || tr("Not specified")}</strong>
            </p>
            <p>
              <span>{tr("Delivery address")}</span>
              <strong>{order.customer?.address || tr("Not specified")}</strong>
            </p>
          </section>
        </div>
        <section className="customer-products">
          <h4>{tr("Ordered Products")}</h4>
          {(order.items || []).map((item, index) => (
            <ProductRow
              item={item}
              formatPrice={formatPrice}
              tr={tr}
              key={`${item.productId || item.id}-${index}`}
            />
          ))}
        </section>
        <section className="customer-totals">
          <p>
            <span>{tr("Subtotal")}</span>
            <strong>{formatPrice(order.subtotal)}</strong>
          </p>
          <p>
            <span>{tr("Delivery Fee")}</span>
            <strong>
              {formatPrice(order.shippingFee ?? order.deliveryFee)}
            </strong>
          </p>
          <p>
            <span>{tr("Discount")}</span>
            <strong>−{formatPrice(order.discount)}</strong>
          </p>
          <p className="customer-grand-total">
            <span>{tr("Grand Total")}</span>
            <strong>{formatPrice(order.total)}</strong>
          </p>
        </section>
        <div className="customer-order-actions">
          <button
            className="customer-btn secondary"
            onClick={() => onBuyAgain(order)}
          >
            {tr("Buy Again")}
          </button>
          {canCancel && (
            <button
              className="customer-btn danger"
              disabled={!!cancelling}
              onClick={() => cancel(order)}
            >
              {cancelling ? tr("Cancelling…") : tr("Cancel Order")}
            </button>
          )}
        </div>
      </section>
    );
  }

  // ---- My Orders: compact summary cards ----
  return (
    <section
      className={`customer-orders ${compact ? "customer-orders--compact" : ""}`}
      aria-label={tr("My orders")}
      ref={topRef}
    >
      {error && (
        <p className="customer-order-error" role="alert">
          {error}
        </p>
      )}
      {loading && <p role="status">{tr("Loading your orders…")}</p>}
      <div className="customer-order-tabs" aria-label="Filter orders">
        {filters.map(([id, label]) => (
          <button
            key={id}
            aria-pressed={filter === id}
            className={filter === id ? "active" : ""}
            onClick={() => setFilter(id)}
          >
            {tr(label)}{" "}
            <span>
              {orders.filter((item) => matchesOrderFilter(item, id)).length}
            </span>
          </button>
        ))}
      </div>
      <div className="customer-order-list">
        {displayed.map((item) => {
          const itemCount = itemCountOf(item);
          const thumbs = (item.items || [])
            .filter((line) => line.image)
            .slice(0, 4);
          return (
            <article
              className="customer-order-card customer-order-card--compact"
              key={item.id}
            >
              <header>
                <div className="customer-order-card-title">
                  {thumbs[0] ? (
                    <OrderThumb image={thumbs[0].image} name={thumbs[0].name} />
                  ) : (
                    <div className="customer-order-thumb" aria-hidden="true">
                      HT
                    </div>
                  )}
                  <div>
                    <strong>Order #{item.orderNumber || item.id}</strong>
                    <small>{dateTime(item.createdAt)}</small>
                  </div>
                </div>
                <span
                  className={`customer-order-status status-${String(
                    item.status || "pending",
                  )
                    .toLowerCase()
                    .replaceAll(" ", "-")}`}
                >
                  {tr(item.status || "Pending")}
                </span>
              </header>
              {thumbs.length > 0 && (
                <div className="customer-order-thumbs" aria-hidden="true">
                  {thumbs.map((line, index) => (
                    <OrderThumb
                      key={`${line.productId || line.id}-${index}`}
                      image={line.image}
                      name={line.name}
                    />
                  ))}
                  {thumbs.length < (item.items || []).length && (
                    <span className="customer-order-thumb customer-order-thumb-more">
                      +{(item.items || []).length - thumbs.length}
                    </span>
                  )}
                </div>
              )}
              <footer>
                <span className="customer-order-summary">
                  {itemCount} {tr(itemCount === 1 ? "item" : "items")} ·{" "}
                  {tr("Total")} <strong>{formatPrice(item.total)}</strong>
                </span>
                <div>
                  <button
                    className="customer-btn secondary"
                    onClick={() => openOrder(item)}
                  >
                    {tr("View Details")}
                  </button>
                  <button
                    className="customer-btn text"
                    onClick={() => openOrder(item, true)}
                  >
                    {tr("Track Order")}
                  </button>
                  {canCancelOrder(item) && (
                    <button
                      className="customer-btn danger"
                      disabled={!!cancelling}
                      onClick={() => cancel(item)}
                    >
                      {cancelling === item.id
                        ? tr("Cancelling…")
                        : tr("Cancel Order")}
                    </button>
                  )}
                </div>
              </footer>
            </article>
          );
        })}
      </div>
      {!loading && !error && !displayed.length && (
        <div className="customer-orders-empty">
          <strong>
            {filter === "all"
              ? tr("No orders yet")
              : tr("No orders yet").replace(
                  "orders",
                  `${tr(filters.find(([id]) => id === filter)?.[1] || "").toLowerCase()} orders`,
                )}
          </strong>
          <span>{tr("Orders placed with this account will appear here.")}</span>
        </div>
      )}
    </section>
  );
}
