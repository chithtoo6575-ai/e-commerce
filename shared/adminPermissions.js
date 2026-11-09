export const STAFF_PERMISSIONS = [
  { key: 'products.view', label: 'View Products', group: 'PRODUCT MANAGEMENT' },
  { key: 'products.add', label: 'Add Products', group: 'PRODUCT MANAGEMENT' },
  { key: 'products.edit', label: 'Edit Products', group: 'PRODUCT MANAGEMENT' },
  { key: 'products.delete', label: 'Delete Products', group: 'PRODUCT MANAGEMENT' },
  { key: 'categories.manage', label: 'Manage Categories', group: 'PRODUCT MANAGEMENT' },
  { key: 'subcategories.manage', label: 'Manage Subcategories', group: 'PRODUCT MANAGEMENT' },
  { key: 'stock.view', label: 'View Stock', group: 'PRODUCT MANAGEMENT' },
  { key: 'stock.update', label: 'Update Stock', group: 'PRODUCT MANAGEMENT' },
  { key: 'orders.view', label: 'View Orders', group: 'ORDER MANAGEMENT' },
  { key: 'orders.details', label: 'View Order Details', group: 'ORDER MANAGEMENT' },
  { key: 'orders.confirm', label: 'Confirm Orders', group: 'ORDER MANAGEMENT' },
  { key: 'orders.status', label: 'Update Order Status', group: 'ORDER MANAGEMENT' },
  { key: 'orders.cancel', label: 'Cancel Orders', group: 'ORDER MANAGEMENT' },
  { key: 'shipping.manage', label: 'Manage Shipping', group: 'ORDER MANAGEMENT' },
  { key: 'customers.view', label: 'View Customers', group: 'CUSTOMER MANAGEMENT' },
  { key: 'customers.edit', label: 'Edit Customer Information', group: 'CUSTOMER MANAGEMENT' },
  { key: 'customers.support', label: 'Manage Customer Support', group: 'CUSTOMER MANAGEMENT' },
  { key: 'storefront.banners', label: 'Manage Banner Images', group: 'STOREFRONT MANAGEMENT' },
  { key: 'storefront.home_sections', label: 'Manage Home Sections', group: 'STOREFRONT MANAGEMENT' },
  { key: 'storefront.home_layout', label: 'Manage Home Layout', group: 'STOREFRONT MANAGEMENT' },
  { key: 'notifications.view', label: 'View Notifications', group: 'NOTIFICATIONS' },
  { key: 'notifications.send', label: 'Send Notifications', group: 'NOTIFICATIONS' }
]

export const STAFF_PERMISSION_KEYS = STAFF_PERMISSIONS.map(({ key }) => key)

export function normalizeStaffPermissions(value) {
  const requested = new Set(Array.isArray(value) ? value : [])
  return STAFF_PERMISSION_KEYS.filter((key) => requested.has(key))
}
