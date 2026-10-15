// HTOO Admin Data Service & State Management
// Integrates with backend endpoints where available and persists extended modules in localStorage

const STORAGE_PREFIX = 'htoo_admin_'

function getStored(key, fallback) {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${key}`)
    return raw ? JSON.parse(raw) : fallback
  } catch (err) {
    console.warn(`[adminStore] Failed reading ${key}:`, err)
    return fallback
  }
}

function setStored(key, value) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value))
    window.dispatchEvent(new CustomEvent('htoo-admin-store-update', { detail: { key } }))
  } catch (err) {
    console.warn(`[adminStore] Failed writing ${key}:`, err)
  }
}

// Initial Seeds
const SEED_SUB_CATEGORIES = [
  { id: 'sub-1', name: 'T-Shirts & Polos', parentCategoryId: 'Clothing', status: 'Active', sortOrder: 1, image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=200&auto=format&fit=crop&q=80', productCount: 14 },
  { id: 'sub-2', name: 'Hoodies & Jackets', parentCategoryId: 'Clothing', status: 'Active', sortOrder: 2, image: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=200&auto=format&fit=crop&q=80', productCount: 8 },
  { id: 'sub-3', name: 'Pants & Trousers', parentCategoryId: 'Clothing', status: 'Active', sortOrder: 3, image: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=200&auto=format&fit=crop&q=80', productCount: 9 },
  { id: 'sub-4', name: 'Sneakers & Shoes', parentCategoryId: 'Clothing', status: 'Active', sortOrder: 4, image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200&auto=format&fit=crop&q=80', productCount: 6 },
  { id: 'sub-5', name: 'Gourmet Snacks', parentCategoryId: 'Grocery', status: 'Active', sortOrder: 1, image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&auto=format&fit=crop&q=80', productCount: 12 },
  { id: 'sub-6', name: 'Organic Teas & Coffee', parentCategoryId: 'Grocery', status: 'Active', sortOrder: 2, image: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=200&auto=format&fit=crop&q=80', productCount: 7 },
  { id: 'sub-7', name: 'Smartphones & Tablets', parentCategoryId: 'Phones & Accessories', status: 'Active', sortOrder: 1, image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=200&auto=format&fit=crop&q=80', productCount: 5 },
  { id: 'sub-8', name: 'Wireless Audio & Buds', parentCategoryId: 'Phones & Accessories', status: 'Active', sortOrder: 2, image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200&auto=format&fit=crop&q=80', productCount: 11 },
  { id: 'sub-9', name: 'Fast Chargers & Cables', parentCategoryId: 'Phones & Accessories', status: 'Active', sortOrder: 3, image: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=200&auto=format&fit=crop&q=80', productCount: 8 }
]

const SEED_STOCK_MOVEMENTS = [
  { id: 'sm-101', productId: '32e0efe5-b37b-4325-bcc7-86777a7ae698', productName: 'Sneaker, Running Shoes', sku: 'SNK-HT-01', type: 'Stock In', quantity: 25, previousStock: 10, newStock: 35, reason: 'Supplier shipment restock batch #12', reference: 'PO-2026-102', date: '2026-10-06T15:30:00Z', user: 'Chit Htoo' },
  { id: 'sm-102', productId: '32e0efe5-b37b-4325-bcc7-86777a7ae698', productName: 'Sneaker, Running Shoes', sku: 'SNK-HT-01', type: 'Stock Out', quantity: -1, previousStock: 35, newStock: 34, reason: 'Customer Order #HT-288BD843', reference: 'ORD-HT-288BD843', date: '2026-10-06T16:10:00Z', user: 'System (Order)' },
  { id: 'sm-103', productId: 'prod-hoodie-02', productName: 'Minimalist Heavyweight Hoodie', sku: 'HOD-NVY-02', type: 'Adjustment', quantity: -2, previousStock: 18, newStock: 16, reason: 'Physical inventory count reconciliation', reference: 'AUD-INV-09', date: '2026-10-05T11:45:00Z', user: 'Chit Htoo' },
  { id: 'sm-104', productId: 'prod-tea-05', productName: 'Artisanal Green Tea Box', sku: 'TEA-ORG-05', type: 'Return', quantity: 1, previousStock: 14, newStock: 15, reason: 'Customer exchange unopened seal', reference: 'RET-8841', date: '2026-10-04T13:20:00Z', user: 'Chit Htoo' },
  { id: 'sm-105', productId: 'prod-buds-08', productName: 'Pro Wireless ANC Earbuds', sku: 'AUD-ANC-08', type: 'Damaged', quantity: -1, previousStock: 8, newStock: 7, reason: 'Damaged casing discovered in quality check', reference: 'DMG-302', date: '2026-10-03T17:15:00Z', user: 'Chit Htoo' }
]

const SEED_BANNERS = [
  {
    id: 'ban-hero-1',
    image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1200&auto=format&fit=crop&q=80',
    altText: 'HTOO Luxury Atelier - New Season Collection',
    link: '/search',
    sortOrder: 1,
    startDate: '',
    endDate: '',
    enabled: true
  }
]

const SEED_HOME_SECTIONS = [
  { id: 'sec-1', title: 'Featured Products', subtitle: 'Curated premium items handpicked for quality', source: 'featured', displayStyle: 'grid', enabled: true, sortOrder: 1 },
  { id: 'sec-2', title: 'New Arrivals', subtitle: 'Fresh drops straight from verified ateliers', source: 'new_arrivals', displayStyle: 'carousel', enabled: true, sortOrder: 2 },
  { id: 'sec-3', title: 'Best Sellers', subtitle: 'Most ordered by HTOO members this week', source: 'best_sellers', displayStyle: 'grid', enabled: true, sortOrder: 3 },
  { id: 'sec-4', title: 'Limited Flash Deals', subtitle: 'Exclusive seasonal markdowns before stocks end', source: 'discount', displayStyle: 'banner_grid', enabled: true, sortOrder: 4 },
  { id: 'sec-5', title: 'Curated Recommendations', subtitle: 'Specially chosen for your aesthetic', source: 'recommended', displayStyle: 'carousel', enabled: false, sortOrder: 5 }
]

const SEED_HOME_LAYOUT = [
  { id: 'block-hero', name: 'Hero Banner Slider', description: 'Main promotional slider at the storefront header', enabled: true, sortOrder: 1 },
  { id: 'block-featured', name: 'Featured Showcase Grid', description: 'Primary 4-column curated collection', enabled: true, sortOrder: 2 },
  { id: 'block-promo', name: 'Brand Story Banner', description: 'High-impact full width aesthetic banner', enabled: true, sortOrder: 3 },
  { id: 'block-new', name: 'New Arrivals Carousel', description: 'Horizontal swipeable product cards', enabled: true, sortOrder: 4 },
  { id: 'block-best', name: 'Top Trending Sellers', description: 'Top volume products with rating tags', enabled: true, sortOrder: 5 },
  { id: 'block-discount', name: 'Special Promotion Box', description: 'Discount highlighted section with coupon pill', enabled: true, sortOrder: 6 },
  { id: 'block-recommend', name: 'Footer Product Carousel', description: 'Discovery stream at bottom of storefront', enabled: false, sortOrder: 7 }
]

const SEED_SHIPPING_RATES = [
  { id: 'ship-1', region: 'Yangon (Downtown & Inner Townships)', deliveryType: 'Standard Delivery (1-2 Days)', baseFee: 2500, freeThreshold: 50000, additionalFee: 0, status: 'Active' },
  { id: 'ship-2', region: 'Yangon (Outer Townships & Suburbs)', deliveryType: 'Standard Delivery (2-3 Days)', baseFee: 3500, freeThreshold: 60000, additionalFee: 500, status: 'Active' },
  { id: 'ship-3', region: 'Mandalay Metropolitan Area', deliveryType: 'Express Courier (2-3 Days)', baseFee: 4000, freeThreshold: 75000, additionalFee: 500, status: 'Active' },
  { id: 'ship-4', region: 'Naypyitaw & Major Highway Cities', deliveryType: 'Highway Express / Bus Terminal Gate', baseFee: 4500, freeThreshold: 80000, additionalFee: 1000, status: 'Active' },
  { id: 'ship-5', region: 'Other States & Regional Townships', deliveryType: 'National Logistics Parcel (3-5 Days)', baseFee: 6000, freeThreshold: 100000, additionalFee: 1500, status: 'Active' },
  { id: 'ship-6', region: 'Yangon Rush Same-Day', deliveryType: 'Express Rider (Within 4-6 Hours)', baseFee: 6500, freeThreshold: 0, additionalFee: 0, status: 'Active' }
]

const SEED_DELIVERY_COMPANIES = [
  { id: 'del-1', name: 'Royal Express', logo: '🚚', contact: 'Ko Aung Myo', phone: '09-777123456', trackingUrl: 'https://royalexpress.com.mm/track?code={CODE}', description: 'Fast nationwide courier covering over 80 cities with SMS alerts', status: 'Active' },
  { id: 'del-2', name: 'Ninja Van Myanmar', logo: '🥷', contact: 'Ma Thidar', phone: '09-444987654', trackingUrl: 'https://ninjavan.co/mm/tracking?id={CODE}', description: 'Door-to-door logistics with real-time GPS tracking and instant POD', status: 'Active' },
  { id: 'del-3', name: 'Kerry Express / KEX', logo: '📦', contact: 'Ko Zaw Min', phone: '09-250112233', trackingUrl: 'https://kerryexpress.com.mm/track/{CODE}', description: 'Reliable parcel logistics ideal for boxed apparel, footwear and electronics', status: 'Active' },
  { id: 'del-4', name: 'City Express Delivery', logo: '⚡', contact: 'Ko Kyaw Swar', phone: '09-965432100', trackingUrl: 'https://cityexpress.mm/shipment/{CODE}', description: 'Specialized in Yangon intra-city same-day dispatch and delicate cargo', status: 'Active' },
  { id: 'del-5', name: 'Aung Mingalar Highway Bus Gate', logo: '🚌', contact: 'Gate 14 Terminal', phone: '09-312345678', trackingUrl: '', description: 'Direct bus parcel dispatch to Upper Myanmar major township gates', status: 'Active' }
]

const SEED_PAYMENT_METHODS = [
  { id: 'pay-cod', name: 'Cash on Delivery (COD)', icon: '💵', description: 'Pay in cash when parcel arrives at your doorstep', instructions: 'Please keep exact cash ready upon arrival. Available for verified phone numbers in standard delivery zones.', status: 'Active', sortOrder: 1 },
  { id: 'pay-kpay', name: 'KBZPay (KPay QR & Direct)', icon: '📱', description: 'Instant transfer via KBZPay mobile app', instructions: 'Transfer to 09266172967 (Chit Htoo). Please upload transaction screenshot as proof of payment.', status: 'Active', sortOrder: 2 },
  { id: 'pay-wave', name: 'WavePay Mobile Money', icon: '🌊', description: 'Quick payment using WavePay transfer or agent', instructions: 'Transfer to 09266172967 (Chit Htoo). Enter order number in the payment remarks field.', status: 'Active', sortOrder: 3 },
  { id: 'pay-kbzbank', name: 'KBZ Bank Transfer', icon: '🏦', description: 'Direct bank account transfer (Mobile Banking)', instructions: 'A/C: 123-456-789-001 (Chit Htoo). Branch: Yangon Main. Upload slip after payment.', status: 'Active', sortOrder: 4 },
  { id: 'pay-cbbank', name: 'CB Bank / CB Pay', icon: '🏛️', description: 'Direct payment via CB Bank account', instructions: 'A/C: 987-654-321-002 (Chit Htoo). Transfer remarks: Your HTOO Order ID.', status: 'Inactive', sortOrder: 5 },
  { id: 'pay-ayapay', name: 'AYA Pay', icon: '💳', description: 'AYA Pay wallet digital transfer', instructions: 'Wallet: 09266172967. Upload payment confirmation slip upon checkout.', status: 'Inactive', sortOrder: 6 }
]

const SEED_NOTIFICATIONS = []

const LEGACY_SUPPORT_IDS = new Set(['sup-1', 'sup-2', 'sup-3', 'sup-4', 'sup-5'])
const LEGACY_NOTIFICATIONS = new Map([
  ['notif-1', 'Weekend Flash Sale Launch'],
  ['notif-2', 'New Organic Tea Restocked'],
  ['notif-3', 'Upcoming Holiday Logistics Notice'],
  ['notif-4', 'Welcome Voucher Reminder']
])
const SEED_SUPPORT_CHANNELS = []

const SEED_HELP_ITEMS = [
  { id: 'help-1', question: 'How do I place an order on HTOO?', answer: 'Browse through our collections, select your desired variant (size/color), click "Add to Cart", and proceed through our seamless 3-step checkout.', category: 'Ordering', status: 'Active', sortOrder: 1 },
  { id: 'help-2', question: 'Can I modify or cancel my order after placing it?', answer: 'Yes! Orders in "New" or "Confirmed" status can be modified or cancelled by messaging our support channels or directly within your profile order history.', category: 'Ordering', status: 'Active', sortOrder: 2 },
  { id: 'help-3', question: 'What are the delivery fees and timelines?', answer: 'Inside Yangon, standard delivery is Ks 2,500 - Ks 3,500 (1-2 days). Same-day express is available for Ks 6,500. Orders over Ks 50,000 enjoy free standard shipping.', category: 'Shipping', status: 'Active', sortOrder: 3 },
  { id: 'help-4', question: 'Do you offer Cash on Delivery (COD)?', answer: 'Yes, Cash on Delivery is supported for all major townships in Yangon and Mandalay with verified contact phone numbers.', category: 'Shipping', status: 'Active', sortOrder: 4 },
  { id: 'help-5', question: 'How do I submit payment proof for KPay or WavePay?', answer: 'After transferring to our official numbers, simply upload your transaction slip screenshot on the order completion screen or send it to our Telegram/Viber support.', category: 'Payment', status: 'Active', sortOrder: 5 },
  { id: 'help-6', question: 'What is HTOO\'s return & refund policy?', answer: 'We offer a 7-day hassle-free return window for unworn items with original tags intact or products damaged during transit.', category: 'Returns', status: 'Active', sortOrder: 6 },
  { id: 'help-7', question: 'How do I qualify for the HTOO VIP Gold Membership?', answer: 'Customers with total historical spend exceeding Ks 300,000 automatically unlock VIP Gold tier with 10% storewide discounts and priority shipping.', category: 'Account', status: 'Active', sortOrder: 7 }
]

export const adminStore = {
  // Generic getters and setters with persistence
  getSubCategories() {
    return getStored('sub_categories', SEED_SUB_CATEGORIES)
  },
  saveSubCategories(items) {
    setStored('sub_categories', items)
    return items
  },

  getStockMovements() {
    return getStored('stock_movements', SEED_STOCK_MOVEMENTS)
  },
  saveStockMovements(items) {
    setStored('stock_movements', items)
    return items
  },
  addStockMovement(movement) {
    const list = this.getStockMovements()
    const item = {
      id: `sm-${Date.now().toString(36)}`,
      date: new Date().toISOString(),
      user: 'Chit Htoo (Admin)',
      ...movement
    }
    const updated = [item, ...list]
    this.saveStockMovements(updated)
    return item
  },

  getBanners() {
    const banners = getStored('banners', SEED_BANNERS)
    return Array.isArray(banners) && banners.length ? banners : SEED_BANNERS
  },
  saveBanners(items) {
    setStored('banners', items)
    return items
  },

  getHomeSections() {
    return getStored('home_sections', SEED_HOME_SECTIONS)
  },
  saveHomeSections(items) {
    setStored('home_sections', items)
    return items
  },

  getHomeLayout() {
    return getStored('home_layout', SEED_HOME_LAYOUT).filter((block) => block.id !== 'block-categories')
  },
  saveHomeLayout(items) {
    const storefrontItems = items.filter((block) => block.id !== 'block-categories')
    setStored('home_layout', storefrontItems)
    return storefrontItems
  },

  getShippingRates() {
    return getStored('shipping_rates', SEED_SHIPPING_RATES)
  },
  saveShippingRates(items) {
    setStored('shipping_rates', items)
    return items
  },

  getDeliveryCompanies() {
    return getStored('delivery_companies', SEED_DELIVERY_COMPANIES)
  },
  saveDeliveryCompanies(items) {
    setStored('delivery_companies', items)
    return items
  },

  getPaymentMethods() {
    return getStored('payment_methods', SEED_PAYMENT_METHODS)
  },
  savePaymentMethods(items) {
    setStored('payment_methods', items)
    return items
  },

  getNotifications() {
    return getStored('notifications', SEED_NOTIFICATIONS).filter((notification) => LEGACY_NOTIFICATIONS.get(notification.id) !== notification.title)
  },
  saveNotifications(items) {
    setStored('notifications', items)
    return items
  },

  getSupportChannels() {
    return getStored('support_channels', SEED_SUPPORT_CHANNELS).filter((channel) => !LEGACY_SUPPORT_IDS.has(channel.id))
  },
  saveSupportChannels(items) {
    setStored('support_channels', items)
    return items
  },

  getHelpItems() {
    return getStored('help_items', SEED_HELP_ITEMS)
  },
  saveHelpItems(items) {
    setStored('help_items', items)
    return items
  }
}
