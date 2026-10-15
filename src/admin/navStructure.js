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
      { id: 'Products', label: 'Products', path: '/admin/products', icon: IconProducts },
      { id: 'Categories', label: 'Categories', path: '/admin/categories', icon: IconCategories },
      { id: 'Sub Categories', label: 'Sub Categories', path: '/admin/sub-categories', icon: IconSubCategories },
      { id: 'Stock Movements', label: 'Stock Movements', path: '/admin/stock-movements', icon: IconStockMovements }
    ]
  },
  {
    group: 'STOREFRONT',
    items: [
      { id: 'Banner Images', label: 'Banner Images', path: '/admin/banner-images', icon: IconBannerImages },
      { id: 'Home Sections', label: 'Home Sections', path: '/admin/home-sections', icon: IconHomeSections },
      { id: 'Home Layout', label: 'Home Layout', path: '/admin/home-layout', icon: IconHomeLayout }
    ]
  },
  {
    group: 'SALES',
    items: [
      { id: 'Orders', label: 'Orders', path: '/admin/orders', icon: IconOrders },
      { id: 'Shipping Rates', label: 'Shipping Rates', path: '/admin/shipping-rates', icon: IconShippingRates },
      { id: 'Delivery Companies', label: 'Delivery Companies', path: '/admin/delivery-companies', icon: IconDeliveryCompanies },
      { id: 'Payment Methods', label: 'Payment Methods', path: '/admin/payment-methods', icon: IconPaymentMethods }
    ]
  },
  {
    group: 'CUSTOMER RELATION',
    items: [
      { id: 'Customers', label: 'Customers', path: '/admin/customers', icon: IconCustomers },
      { id: 'Notifications', label: 'Notifications', path: '/admin/notifications', icon: IconNotifications },
      { id: 'Support Channels', label: 'Support Channels', path: '/admin/support-channels', icon: IconSupportChannels },
      { id: 'Help Items', label: 'Help Items', path: '/admin/help-items', icon: IconHelpItems }
    ]
  }
]
