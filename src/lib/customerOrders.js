export const orderFilters = [
  ["all", "All Orders"],
  ["pending", "Pending"],
  ["confirmed", "Confirmed"],
  ["shipping", "Shipping"],
  ["delivered", "Delivered"],
];
export const trackingStages = [
  ["Order Placed", ["new", "pending"]],
  ["Order Confirmed", ["confirmed"]],
  ["Packing", ["processing", "packing", "packed"]],
  ["Shipping", ["shipping", "shipped", "out for delivery", "in transit"]],
  ["Delivered", ["delivered"]],
];
const normalize = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();
export const isCancelled = (order) =>
  ["cancelled", "canceled"].includes(normalize(order.status));
export function orderStage(order) {
  if (isCancelled(order)) return -1;
  const statusStage = trackingStages.findIndex(([, statuses]) =>
    statuses.includes(normalize(order.status)),
  );
  const shippingStage = trackingStages.findIndex(([, statuses]) =>
    statuses.includes(normalize(order.shippingStatus)),
  );
  return Math.max(statusStage, shippingStage);
}
export function matchesOrderFilter(order, filter) {
  if (filter === "all") return true;
  if (isCancelled(order)) return false;
  const stage = orderStage(order);
  return filter === "pending"
    ? stage === 0
    : filter === "confirmed"
      ? [1, 2].includes(stage)
      : filter === "shipping"
        ? stage === 3
        : stage === 4;
}
export function stageTimestamp(order, index) {
  const statuses = trackingStages[index][1];
  const history = Array.isArray(order.statusHistory) ? order.statusHistory : [];
  const entry = history.find((item) =>
    statuses.includes(normalize(item.status)),
  );
  return (
    entry?.at ||
    (index === 0 ? order.createdAt : index === 4 ? order.deliveredAt : "") ||
    ""
  );
}
// Cancellation is opt-in: status alone is not proof that the API permits it.
export const canCancelOrder = (order) =>
  order.canCancel === true &&
  ["new", "pending"].includes(normalize(order.status)) &&
  orderStage(order) === 0;
export function orderDateTime(value) {
  return !value || Number.isNaN(Date.parse(value))
    ? "Timestamp not recorded"
    : new Date(value).toLocaleString([], {
        dateStyle: "medium",
        timeStyle: "short",
      });
}
