import React, { useMemo, useState } from "react";
import { adminT } from "../adminI18n";
import {
  getProductStock,
  getVariantStockOptions,
  hasVariantStock,
} from "../../lib/productVariants";

const money = (value) => `Ks ${Number(value || 0).toLocaleString()}`;
const localDay = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString();
};

export default function PosPage({
  products = [],
  orders = [],
  canSell = false,
  canViewHistory = false,
  canViewReports = false,
  mode = "sell",
  onCreateSale,
  onSaleCreated,
  showToast,
}) {
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState("Walk-in customer");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const posOrders = useMemo(
    () => orders.filter((order) => order.source === "pos"),
    [orders],
  );
  const today = new Date().toLocaleDateString();
  const todaysOrders = posOrders.filter(
    (order) => localDay(order.createdAt) === today,
  );
  const todaySales = todaysOrders.reduce(
    (sum, order) => sum + Number(order.total || 0),
    0,
  );
  const filteredProducts = products.filter((product) => {
    const term = query.trim().toLowerCase();
    return (
      product.enabled !== false &&
      (!term ||
        `${product.nameEn || product.name || ""} ${product.sku || ""}`
          .toLowerCase()
          .includes(term))
    );
  });
  const cartTotal = cart.reduce(
    (sum, line) => sum + line.price * line.quantity,
    0,
  );

  function addProduct(product, variants = {}) {
    const available = getProductStock(product, variants);
    if (available < 1) return;
    const key = `${product.id}:${JSON.stringify(variants)}`;
    setCart((current) => {
      const line = current.find((item) => item.key === key);
      if (line)
        return current.map((item) =>
          item.key === key && item.quantity < available
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      return [
        ...current,
        {
          key,
          productId: product.id,
          name: product.nameEn || product.name || "Product",
          sku: product.sku || "",
          image: product.image || product.images?.[0] || "",
          variants,
          price: Number(product.discountPrice ?? product.price),
          quantity: 1,
        },
      ];
    });
    setError("");
  }

  function changeQuantity(key, amount) {
    setCart((current) =>
      current.flatMap((line) => {
        if (line.key !== key) return [line];
        const product = products.find(
          (item) => String(item.id) === String(line.productId),
        );
        const quantity = line.quantity + amount;
        if (quantity < 1) return [];
        if (quantity > getProductStock(product || {}, line.variants))
          return [line];
        return [{ ...line, quantity }];
      }),
    );
  }

  async function completeSale(event) {
    event.preventDefault();
    if (!cart.length || saving || !onCreateSale) return;
    setSaving(true);
    setError("");
    try {
      const order = await onCreateSale({
        customerName: customerName.trim() || "Walk-in customer",
        paymentMethod,
        items: cart.map(({ productId, quantity, variants }) => ({
          productId,
          quantity,
          variants,
        })),
      });
      onSaleCreated?.(order);
      setCart([]);
      setCustomerName("Walk-in customer");
      showToast?.(`Sale ${order.orderNumber} completed`, "success");
    } catch (saleError) {
      setError(saleError.message || "Unable to complete the POS sale.");
    } finally {
      setSaving(false);
    }
  }

  if (mode === "history") {
    if (!canViewHistory) return <AccessDenied />;
    return (
      <section className="admin-page-content">
        <header className="page-header-actions">
          <div>
            <h2>{adminT("POS Sales History")}</h2>
            <p className="page-subtitle">
              {adminT("Completed in-store sales")}
            </p>
          </div>
        </header>
        <SalesTable orders={posOrders} />
      </section>
    );
  }

  if (mode === "reports") {
    if (!canViewReports) return <AccessDenied />;
    return (
      <section className="admin-page-content">
        <header className="page-header-actions">
          <div>
            <h2>{adminT("POS Reports")}</h2>
            <p className="page-subtitle">
              {adminT(
                "Sales totals are based on completed in-store POS orders.",
              )}
            </p>
          </div>
        </header>
        <div className="dashboard-stats-grid">
          <ReportCard
            title={adminT("Sales today")}
            value={money(todaySales)}
            detail={`${todaysOrders.length} ${adminT("sales")}`}
          />
          <ReportCard
            title={adminT("Transactions today")}
            value={todaysOrders.length.toLocaleString()}
            detail={adminT("Completed POS sales")}
          />
          <ReportCard
            title={adminT("All-time POS sales")}
            value={money(
              posOrders.reduce(
                (sum, order) => sum + Number(order.total || 0),
                0,
              ),
            )}
            detail={`${posOrders.length} ${adminT("transactions")}`}
          />
        </div>
        <SalesTable orders={posOrders.slice(0, 10)} />
      </section>
    );
  }

  if (!canSell) return <AccessDenied />;

  return (
    <section className="admin-page-content">
      <header className="page-header-actions">
        <div>
          <h2>{adminT("Point of Sale")}</h2>
          <p className="page-subtitle">
            {adminT(
              "Create an in-store sale and record payment at the counter.",
            )}
          </p>
        </div>
      </header>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.4fr) minmax(300px, 0.8fr)",
          gap: 20,
          alignItems: "start",
        }}
      >
        <div>
          <div className="admin-card" style={{ padding: 16, marginBottom: 16 }}>
            <label
              style={{ display: "block", marginBottom: 8, fontWeight: 600 }}
              htmlFor="pos-search"
            >
              {adminT("Find a product")}
            </label>
            <input
              id="pos-search"
              className="admin-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={adminT("Search by product name or SKU")}
            />
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
              gap: 12,
            }}
          >
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onAdd={addProduct}
              />
            ))}
            {!filteredProducts.length && (
              <div className="admin-card" style={{ padding: 20 }}>
                {adminT("No available products match your search.")}
              </div>
            )}
          </div>
        </div>
        <form
          className="admin-card"
          style={{ padding: 18, position: "sticky", top: 88 }}
          onSubmit={completeSale}
        >
          <h3 style={{ marginTop: 0 }}>{adminT("Current sale")}</h3>
          {!cart.length ? (
            <p className="text-muted">
              {adminT("Add products to begin a sale.")}
            </p>
          ) : (
            <div style={{ display: "grid", gap: 12, marginBottom: 18 }}>
              {cart.map((line) => (
                <div
                  key={line.key}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 8,
                    borderBottom: "1px solid var(--admin-line-subtle)",
                    paddingBottom: 10,
                  }}
                >
                  <div>
                    <strong>{line.name}</strong>
                    <div className="text-muted text-sm">
                      {[line.variants.size, line.variants.color]
                        .filter(Boolean)
                        .join(" · ") || line.sku}{" "}
                      · {money(line.price)}
                    </div>
                  </div>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <button
                      type="button"
                      className="admin-btn-secondary"
                      aria-label={adminT("Decrease quantity")}
                      onClick={() => changeQuantity(line.key, -1)}
                    >
                      −
                    </button>
                    <span>{line.quantity}</span>
                    <button
                      type="button"
                      className="admin-btn-secondary"
                      aria-label={adminT("Increase quantity")}
                      onClick={() => changeQuantity(line.key, 1)}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <label style={{ display: "block", marginBottom: 12 }}>
            {adminT("Customer name")}
            <input
              className="admin-input"
              style={{ display: "block", width: "100%", marginTop: 6 }}
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              maxLength={120}
            />
          </label>
          <label style={{ display: "block", marginBottom: 16 }}>
            {adminT("Payment method")}
            <select
              className="admin-select"
              style={{ display: "block", width: "100%", marginTop: 6 }}
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value)}
            >
              <option>Cash</option>
              <option>Card</option>
              <option>Mobile wallet</option>
              <option>Other</option>
            </select>
          </label>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 18,
              fontWeight: 700,
              marginBottom: 14,
            }}
          >
            <span>{adminT("Total")}</span>
            <span>{money(cartTotal)}</span>
          </div>
          {error && (
            <p role="alert" style={{ color: "var(--admin-danger, #d84b4b)" }}>
              {error}
            </p>
          )}
          <button
            type="submit"
            className="admin-btn-gold"
            disabled={!cart.length || saving}
            style={{ width: "100%", justifyContent: "center" }}
          >
            {saving ? adminT("Saving…") : adminT("Complete sale")}
          </button>
          <p className="text-muted text-sm">
            {adminT(
              "This records payment as received at the counter. No payment processor is connected.",
            )}
          </p>
        </form>
      </div>
    </section>
  );
}

function ProductCard({ product, onAdd }) {
  const variantsEnabled = hasVariantStock(product);
  const variantOptions = variantsEnabled ? getVariantStockOptions(product) : [];
  const [variantKey, setVariantKey] = useState(variantOptions[0]?.key || "");
  const variant =
    variantOptions.find((option) => option.key === variantKey) ||
    variantOptions[0];
  const selection = variant
    ? {
        ...(variant.size ? { size: variant.size } : {}),
        ...(variant.color ? { color: variant.color } : {}),
      }
    : {};
  const stock = getProductStock(product, selection);
  return (
    <article
      className="admin-card"
      style={{ padding: 14, display: "grid", gap: 9 }}
    >
      <strong>{product.nameEn || product.name}</strong>
      {product.sku && (
        <span className="text-muted text-sm">SKU: {product.sku}</span>
      )}
      <span>{money(product.discountPrice ?? product.price)}</span>
      {variantsEnabled && (
        <select
          className="admin-select"
          aria-label={`${adminT("Variant for")} ${product.nameEn || product.name}`}
          value={variantKey}
          onChange={(event) => setVariantKey(event.target.value)}
        >
          {variantOptions.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label} —{" "}
              {getProductStock(product, {
                ...(option.size ? { size: option.size } : {}),
                ...(option.color ? { color: option.color } : {}),
              })}{" "}
              {adminT("in stock")}
            </option>
          ))}
        </select>
      )}
      <span className="text-muted text-sm">
        {stock} {adminT("in stock")}
      </span>
      <button
        type="button"
        className="admin-btn-secondary"
        disabled={stock < 1}
        onClick={() => onAdd(product, selection)}
      >
        {adminT("Add to sale")}
      </button>
    </article>
  );
}

function SalesTable({ orders }) {
  return (
    <div className="admin-card" style={{ overflowX: "auto", marginTop: 18 }}>
      <table className="admin-table">
        <thead>
          <tr>
            <th>{adminT("Date")}</th>
            <th>{adminT("Sale")}</th>
            <th>{adminT("Customer")}</th>
            <th>{adminT("Items")}</th>
            <th>{adminT("Payment")}</th>
            <th>{adminT("Total")}</th>
          </tr>
        </thead>
        <tbody>
          {orders.length ? (
            orders.map((order) => (
              <tr key={order.id}>
                <td>
                  {order.createdAt
                    ? new Date(order.createdAt).toLocaleString()
                    : "—"}
                </td>
                <td>{order.orderNumber || order.id}</td>
                <td>{order.customer?.name || "Walk-in customer"}</td>
                <td>
                  {(order.items || []).reduce(
                    (total, item) => total + Number(item.quantity || 0),
                    0,
                  )}
                </td>
                <td>{order.paymentMethod || "—"}</td>
                <td>{money(order.total)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="6" className="table-empty-cell">
                {adminT("No POS sales have been recorded yet.")}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ReportCard({ title, value, detail }) {
  return (
    <article className="admin-card" style={{ padding: 20 }}>
      <div className="text-muted">{title}</div>
      <strong style={{ display: "block", fontSize: 24, margin: "8px 0" }}>
        {value}
      </strong>
      <span className="text-muted text-sm">{detail}</span>
    </article>
  );
}

function AccessDenied() {
  return (
    <div className="admin-page-content">
      <div className="admin-card" role="alert" style={{ padding: 20 }}>
        {adminT("You do not have permission to access this section.")}
      </div>
    </div>
  );
}
