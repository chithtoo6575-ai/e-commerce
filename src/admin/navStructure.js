import {
  IconDashboard,
  IconProducts,
  IconCategories,
  IconSubCategories,
  IconStockMovements,
  IconBannerImages,
  IconHomeSections,
  IconHomeLayout,
  IconOrders,
  IconOrderDetails,
  IconShippingRates,
  IconDeliveryCompanies,
  IconPaymentMethods,
  IconCustomers,
  IconNotifications,
  IconSupportChannels,
  IconHelpItems
} from './AdminIcons'

// EXACT 5 GROUPS AND 16 MODULES
export const NAV_STRUCTURE = [
  {
    group: 'GENERAL',
    items: [
      { id: 'Dashboard', label: 'Dashboard', path: '/admin', icon: IconDashboard }
    ]
  },
  {
    group: 'PRODUCT MANAGEMENT',
    items: [
      { id: 'Products', label: 'Products', path: '/admin/products', icon: IconProducts, permissions: ['products.view', 'products.add', 'products.edit', 'products.delete'] },
      { id: 'Categories', label: 'Categories', path: '/admin/categories', icon: IconCategories, permissions: ['categories.manage'] },
      { id: 'Sub Categories', label: 'Sub Categories', path: '/admin/sub-categories', icon: IconSubCategories, permissions: ['subcategories.manage'] },
      { id: 'Stock Movements', label: 'Stock Movements', path: '/admin/stock-movements', icon: IconStockMovements, permissions: ['stock.view', 'stock.update'] }
    ]
  },
  {
    group: 'STOREFRONT',
    items: [
      { id: 'Banner Images', label: 'Banner Images', path: '/admin/banner-images', icon: IconBannerImages, permissions: ['storefront.banners'] },
      { id: 'Home Sections', label: 'Home Sections', path: '/admin/home-sections', icon: IconHomeSections, permissions: ['storefront.home_sections'] },
      { id: 'Home Layout', label: 'Home Layout', path: '/admin/home-layout', icon: IconHomeLayout, permissions: ['storefront.home_layout'] }
    ]
  },
  {
    group: 'SALES',
    items: [
      { id: 'Orders', label: 'Orders', path: '/admin/orders', icon: IconOrders, permissions: ['orders.view', 'orders.details', 'orders.confirm', 'orders.status', 'orders.cancel'] },
      { id: 'အော်ဒါအသေးစိတ်', label: 'Order Details', path: '/admin/order-details', icon: IconOrderDetails, permissions: ['orders.details'] },
      { id: 'Shipping Rates', label: 'Shipping Rates', path: '/admin/shipping-rates', icon: IconShippingRates, permissions: ['shipping.manage'] },
      { id: 'Delivery Companies', label: 'Delivery Companies', path: '/admin/delivery-companies', icon: IconDeliveryCompanies, permissions: ['shipping.manage'] },
      { id: 'Payment Methods', label: 'Payment Methods', path: '/admin/payment-methods', icon: IconPaymentMethods, ownerOnly: true }
    ]
  },
  {
    group: 'CUSTOMER RELATION',
    items: [
      { id: 'Customers', label: 'Customers', path: '/admin/customers', icon: IconCustomers, permissions: ['customers.view', 'customers.edit', 'customers.support'] },
      { id: 'Notifications', label: 'Notifications', path: '/admin/notifications', icon: IconNotifications, permissions: ['notifications.view', 'notifications.send'] },
      { id: 'Support Channels', label: 'Support Channels', path: '/admin/support-channels', icon: IconSupportChannels, permissions: ['customers.support'] },
      { id: 'Help Items', label: 'Help Items', path: '/admin/help-items', icon: IconHelpItems, permissions: ['customers.support'] }
    ]
  },
  {
    group: 'STAFF MANAGEMENT',
    items: [
      { id: 'Staff Management', label: 'Staff Management', path: '/admin/staff-management', icon: IconCustomers, ownerOnly: true },
      { id: 'Staff Permissions', label: 'Staff Permissions', path: '/admin/staff-permissions', icon: IconCustomers, ownerOnly: true },
      { id: 'Staff Activity Logs', label: 'Staff Activity Logs', path: '/admin/staff-activity', icon: IconCustomers, ownerOnly: true }
    ]
  }
]

export function isNavigationItemAvailable(item, auth) {
  if (auth?.role === 'owner') return true
  if (item.ownerOnly) return false
  return Boolean(item.permissions?.some((permission) => auth?.permissions?.includes(permission)))
}
