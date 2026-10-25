import { useState, useMemo } from "react";
import { adminT } from "../adminI18n";
import Badge from "../components/Badge";
import {
  IconSearch,
  IconEye,
  IconX,
  IconRefresh,
  IconDownload,
} from "../AdminIcons";
import { OrderDetailDrawer, buildOrderDetailRows } from "./OrdersPage";

const ORDER_DETAIL_COLUMNS = [
  "နံပါတ်စဉ်",
  "ပြေစာအမှတ်",
  "အမည်",
  "SKU ကုဒ်",
  "ဘားကုဒ်",
  "ပစ္စည်းအမည်",
  "အရေအတွက်",
  "ပို့ဆောင်ရမည့်ပုံစံ",
  "ဝယ်ယူသည့်ရက်စွဲ",
];

const PRINT_COLUMNS = [
  { key: "serial", label: "နံပါတ်စဉ်" },
  { key: "voucher", label: "ပြေစာအမှတ်" },
  { key: "customer", label: "အမည်" },
  { key: "sku", label: "SKU ကုဒ်" },
  { key: "barcode", label: "ဘားကုဒ်" },
  { key: "product", label: "ပစ္စည်းအမည်" },
  { key: "quantity", label: "အရေအတွက်" },
  { key: "delivery", label: "ပို့ဆောင်ရမည့်ပုံစံ" },
  { key: "date", label: "ဝယ်ယူသည့်ရက်စွဲ" },
  { key: "status", label: "Status" },
];

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Returns the YYYY-MM-DD key of an order's purchase date, ignoring time/timezone noise.
const orderDateKey = (order) => {
  const raw =
    order?.createdAt || order?.purchaseDate || order?.data?.createdAt || "";
  if (!raw) return "";
  const date = new Date(raw);
  if (!Number.isNaN(date.getTime())) {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
  }
  return String(raw).slice(0, 10);
};

const formatRangeLabel = (startDate, endDate) => {
  const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
  const end = endDate ? new Date(`${endDate}T00:00:00`) : null;
  const format = (date) =>
    date && !Number.isNaN(date.getTime())
      ? date.toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "";
  if (start && end) return `${format(start)} — ${format(end)}`;
  if (start) return format(start);
  if (end) return format(end);
  return null;
};

// အော်ဒါအသေးစိတ် — one flat row per ordered line item across every order.
export default function OrderDetailsPage({
  orders = [],
  onUpdateOrder,
  onRefreshOrders,
  showToast,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [orderFilter, setOrderFilter] = useState("All");
  const [deliveryFilter, setDeliveryFilter] = useState("All");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);

  const deliveryMethods = useMemo(() => {
    const set = new Set();
    orders.forEach((order) => {
      buildOrderDetailRows(order).forEach((row) => set.add(row.delivery));
    });
    return [...set].sort();
  }, [orders]);

  const detailRows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const rows = [];
    orders.forEach((order) => {
      buildOrderDetailRows(order).forEach((row) =>
        rows.push({ ...row, order }),
      );
    });
    return rows
      .filter((row) => {
        const matchOrder =
          orderFilter === "All" || row.order.id === orderFilter;
        const matchDelivery =
          deliveryFilter === "All" || row.delivery === deliveryFilter;
        const rowDate = orderDateKey(row.order);
        const matchDate =
          !startDate && !endDate
            ? true
            : Boolean(rowDate) &&
              (!startDate || rowDate >= startDate) &&
              (!endDate || rowDate <= endDate);
        const matchSearch =
          !q ||
          String(row.voucher).toLowerCase().includes(q) ||
          String(row.customer).toLowerCase().includes(q) ||
          String(row.sku).toLowerCase().includes(q) ||
          String(row.barcode).toLowerCase().includes(q) ||
          String(row.product).toLowerCase().includes(q);
        return matchOrder && matchDelivery && matchDate && matchSearch;
      })
      .sort(
        (a, b) =>
          new Date(b.order.createdAt || 0) - new Date(a.order.createdAt || 0),
      )
      // Number the visible rows as one continuous list (1..n), independent of orders.
      .map((row, index) => ({ ...row, serial: index + 1 }));
  }, [orders, searchTerm, orderFilter, deliveryFilter, startDate, endDate]);

  const activeRangeLabel = formatRangeLabel(startDate, endDate);

  // Choosing a start date after the current end date pushes the end date forward.
  const handleStartDateChange = (value) => {
    setStartDate(value);
    if (value && endDate && endDate < value) setEndDate(value);
  };

  const handleEndDateChange = (value) => {
    setEndDate(value);
    if (value && startDate && value < startDate) setStartDate(value);
  };

  const clearDateRange = () => {
    setStartDate("");
    setEndDate("");
  };

  const handlePrint = () => {
    const rangeLabel = activeRangeLabel || adminT("All dates");
    const bodyRows = detailRows.length
      ? detailRows
          .map(
            (row) => `<tr>${PRINT_COLUMNS.map(
              (column) =>
                `<td${column.key === "quantity" ? ' class="num"' : ""}>${escapeHtml(
                  column.key === "status"
                    ? adminT(row.order.status || "New")
                    : column.key === "delivery"
                      ? adminT(row.delivery)
                      : row[column.key],
                )}</td>`,
            ).join("")}</tr>`,
          )
          .join("")
      : `<tr><td class="empty" colspan="${PRINT_COLUMNS.length}">${escapeHtml(
          adminT("No order details match your filter criteria."),
        )}</td></tr>`;
    const totalQuantity = detailRows.reduce(
      (sum, row) => sum + Number(row.quantity || 0),
      0,
    );

    const printWindow = window.open("", "_blank", "width=1100,height=800");
    if (!printWindow) {
      showToast?.("Allow pop-ups to print the order details.", "error");
      return;
    }

    printWindow.document.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(adminT("အော်ဒါအသေးစိတ်"))}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: "Pyidaungsu", "Myanmar Text", "Segoe UI", Arial, sans-serif; margin: 24px; color: #111; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .meta { font-size: 12px; color: #444; margin: 2px 0; }
  .meta strong { color: #111; }
  tfoot td { text-align: left; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 11px; }
  th, td { border: 1px solid #999; padding: 6px 7px; text-align: left; vertical-align: top; }
  th { background: #f1f1f1; font-size: 11px; }
  td.num, th.num { text-align: right; }
  tfoot td { font-weight: 700; background: #fafafa; }
  td.empty { text-align: center; color: #666; }
  @page { size: A4 landscape; margin: 12mm; }
  @media print { body { margin: 0; } thead { display: table-header-group; } tr { break-inside: avoid; } }
</style>
</head>
<body>
<h1>${escapeHtml(adminT("အော်ဒါအသေးစိတ်"))}</h1>
<p class="meta"><strong>${escapeHtml(adminT("Date range"))}:</strong> ${escapeHtml(rangeLabel)}</p>
<p class="meta"><strong>${escapeHtml(adminT("Printed on"))}:</strong> ${escapeHtml(new Date().toLocaleString())}</p>
<p class="meta"><strong>${escapeHtml(adminT("Total rows"))}:</strong> ${detailRows.length} &nbsp;|&nbsp; <strong>${escapeHtml(adminT("Total quantity"))}:</strong> ${totalQuantity}</p>
<table>
<thead><tr>${PRINT_COLUMNS.map(
      (column) =>
        `<th${column.key === "quantity" ? ' class="num"' : ""}>${escapeHtml(adminT(column.label))}</th>`,
    ).join("")}</tr></thead>
<tbody>${bodyRows}</tbody>
<tfoot><tr><td colspan="${PRINT_COLUMNS.length - 1}">${escapeHtml(adminT("Total rows"))}: ${detailRows.length} &nbsp;|&nbsp; ${escapeHtml(adminT("Total quantity"))}: ${totalQuantity}</td><td></td></tr></tfoot>
</table>
</body>
</html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.onload = () => printWindow.print();
    window.setTimeout(() => printWindow.print(), 350);
  };

  const handleRefresh = async () => {
    if (!onRefreshOrders) return;
    setRefreshing(true);
    setRefreshError("");
    try {
      await onRefreshOrders();
    } catch (refreshFailure) {
      setRefreshError(refreshFailure.message || "Unable to refresh orders.");
    } finally {
      setRefreshing(false);
    }
  };



  return (
    <div className="admin-page-content">
      <div className="page-header-actions">
        <div>
          <h2>{adminT("အော်ဒါအသေးစိတ်")}</h2>
          <p className="page-subtitle">
            {adminT(
              "Every ordered line item with voucher, SKU, barcode, quantity, delivery method and purchase date",
            )}
          </p>
        </div>
        <div className="page-header-actions-buttons">
          <button
            className="admin-btn-secondary"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <IconRefresh size={15} />
            <span>{adminT(refreshing ? "Refreshing…" : "Refresh Orders")}</span>
          </button>
          <button
            className="admin-btn-gold order-details-print-btn"
            type="button"
            onClick={handlePrint}
            title={adminT("Print or save the filtered order details as PDF")}
          >
            <IconDownload size={15} />
            <span>{adminT("Print / Export PDF")}</span>
          </button>
        </div>
      </div>

      {refreshError && (
        <div className="admin-card form-error" role="alert">
          {adminT(refreshError)}
        </div>
      )}

      <div className="admin-card filter-card">
        <div className="filter-row">
          <div className="filter-search-box">
            <IconSearch size={15} className="search-icon-muted" />
            <input
              type="text"
              placeholder={adminT(
                "Search by voucher, customer, SKU, barcode or product...",
              )}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                className="clear-btn"
                onClick={() => setSearchTerm("")}
                aria-label={adminT("Clear search")}
              >
                <IconX size={13} />
              </button>
            )}
          </div>

          <div className="filter-dropdown-group">
            <select
              value={orderFilter}
              onChange={(e) => setOrderFilter(e.target.value)}
              className="admin-select"
              aria-label={adminT("Filter by order")}
            >
              <option value="All">{adminT("All Orders")}</option>
              {orders.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.orderNumber || order.id?.slice(0, 8)}
                </option>
              ))}
            </select>

            <select
              value={deliveryFilter}
              onChange={(e) => setDeliveryFilter(e.target.value)}
              className="admin-select"
              aria-label={adminT("Filter by delivery method")}
            >
              <option value="All">{adminT("All Delivery Methods")}</option>
              {deliveryMethods.map((method) => (
                <option key={method} value={method}>
                  {adminT(method)}
                </option>
              ))}
            </select>

            <div className="date-range-group">
              <label className="date-range-field">
                <span>{adminT("From")}</span>
                <input
                  type="date"
                  aria-label={adminT("Filter orders from start date")}
                  value={startDate}
                  max={endDate || undefined}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="admin-select"
                />
              </label>
              <label className="date-range-field">
                <span>{adminT("To")}</span>
                <input
                  type="date"
                  aria-label={adminT("Filter orders to end date")}
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(e) => handleEndDateChange(e.target.value)}
                  className="admin-select"
                />
              </label>
              {(startDate || endDate) && (
                <button
                  type="button"
                  className="date-range-clear"
                  onClick={clearDateRange}
                  title={adminT("Clear date range")}
                >
                  <IconX size={12} />
                  <span>{adminT("Clear")}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="filter-summary">
          <span>
            {adminT("Showing")} <strong>{detailRows.length}</strong>{" "}
            {adminT("rows")}
          </span>
          <span className="filter-summary-range">
            {activeRangeLabel
              ? `${adminT("Date range")}: ${activeRangeLabel}`
              : adminT("All dates")}
          </span>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-table-wrapper">
          <table className="admin-table order-details-table">
            <thead>
              <tr>
                {ORDER_DETAIL_COLUMNS.map((label, index) => (
                  <th
                    key={label}
                    className={index === 6 ? "order-details-num" : undefined}
                  >
                    {adminT(label)}
                  </th>
                ))}
                <th>{adminT("Status")}</th>
                <th className="th-action">{adminT("Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {detailRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={ORDER_DETAIL_COLUMNS.length + 2}
                    className="table-empty-cell"
                  >
                    {adminT("No order details match your filter criteria.")}
                  </td>
                </tr>
              ) : (
                detailRows.map((row) => (
                  <tr
                    key={`${row.order.id}-${row.key}`}
                    className="table-row-hover"
                  >
                    <td className="td-mono">{row.serial}</td>
                    <td className="td-mono font-medium">
                      <span className="order-id-badge">{row.voucher}</span>
                    </td>
                    <td>{row.customer}</td>
                    <td className="td-mono">{row.sku}</td>
                    <td className="td-mono">{row.barcode}</td>
                    <td>{row.product}</td>
                    <td className="order-details-num">{row.quantity}</td>
                    <td>{adminT(row.delivery)}</td>
                    <td className="td-muted">{row.date}</td>
                    <td>
                      <Badge>{row.order.status || "New"}</Badge>
                    </td>
                    <td className="td-action">
                      <button
                        className="admin-icon-btn"
                        title={adminT("View order details")}
                        onClick={() => setSelectedOrder(row.order)}
                      >
                        <IconEye size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedOrder && (
        <OrderDetailDrawer
          order={selectedOrder}
          orders={orders}
          readOnly
          onClose={() => setSelectedOrder(null)}
          onUpdateShipping={async (changes) => {
            const updatedOrder = await onUpdateOrder?.(selectedOrder.id, changes)
            if (!updatedOrder) throw new Error('The order details were not updated.')
            setSelectedOrder(updatedOrder)
            showToast?.('Order details updated.', 'success')
          }}
        />
      )}
    </div>
  );
}
