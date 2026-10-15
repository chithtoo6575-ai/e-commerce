import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import { getCart, getPaymentAccounts, getProducts, getWishlist, mergeCart, mergeWishlist, saveCart, saveOrder, saveProducts, saveWishlist } from './lib/storage'

const GUEST_CART_KEY = 'atelier_guest_cart'
const GUEST_WISHLIST_KEY = 'atelier_guest_wishlist'
const LANGUAGE_KEY = 'hto_language'
const formatPrice = (amount) => `Ks ${Math.round(amount || 0).toLocaleString('en-US')}`

// Render an order invoice to a canvas and download it as a PNG image (mobile-friendly, no PDF).
const downloadInvoiceImage = (order, language) => {
  if (!order) return
  const my = language === 'my'
  const items = order.items || []
  const width = 900
  const rowH = 54
  const headerH = 140
  const infoH = 220
  const tableHeadH = 46
  const totalsH = 150
  const footerH = 84
  const height = headerH + infoH + tableHeadH + items.length * rowH + totalsH + footerH
  const scale = 2
  const canvas = document.createElement('canvas')
  canvas.width = width * scale
  canvas.height = height * scale
  const ctx = canvas.getContext('2d')
  ctx.scale(scale, scale)
  const font = (size, weight = 400) => `${weight} ${size}px Manrope, 'Pyidaungsu', 'Noto Sans Myanmar', sans-serif`
  const truncate = (text, max) => {
    const str = String(text ?? '')
    return str.length > max ? `${str.slice(0, max - 1)}…` : str
  }

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)

  // Header band
  ctx.fillStyle = '#0756a4'
  ctx.fillRect(0, 0, width, headerH)
  ctx.fillStyle = '#f7c948'
  ctx.fillRect(0, headerH - 6, width, 6)
  ctx.fillStyle = '#f7c948'
  ctx.fillRect(40, 36, 64, 64)
  ctx.fillStyle = '#043b75'
  ctx.font = font(34, 900)
  ctx.textAlign = 'center'
  ctx.fillText('H', 72, 80)
  ctx.textAlign = 'left'
  ctx.fillStyle = '#ffffff'
  ctx.font = font(28, 900)
  ctx.fillText('HTOO ONLINE SHOP', 126, 68)
  ctx.font = font(15, 600)
  ctx.fillStyle = '#cfe4fb'
  ctx.fillText(my ? 'ဘောင်ချာ / INVOICE' : 'INVOICE / ဘောင်ချာ', 126, 96)
  ctx.textAlign = 'right'
  ctx.fillStyle = '#ffffff'
  ctx.font = font(15, 700)
  ctx.fillText(my ? 'ဘောင်ချာနံပါတ်' : 'Invoice No.', width - 40, 62)
  ctx.font = font(20, 800)
  ctx.fillText(order.orderNumber || order.id, width - 40, 92)
  ctx.textAlign = 'left'

  // Order / customer info
  let y = headerH + 40
  const dateStr = order.createdAt ? new Date(order.createdAt).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''
  ctx.font = font(13, 700)
  ctx.fillStyle = '#64748b'
  ctx.fillText(my ? 'ဝယ်ယူသူ အချက်အလက်' : 'CUSTOMER', 40, y)
  ctx.fillText(my ? 'အော်ဒါ အချက်အလက်' : 'ORDER INFO', width / 2 + 20, y)
  ctx.fillStyle = '#17243a'
  ctx.font = font(16, 800)
  ctx.fillText(truncate(order.customer?.name || '-', 34), 40, y + 30)
  ctx.font = font(14, 500)
  ctx.fillText(`☎ ${order.customer?.phone || '-'}`, 40, y + 56)
  ctx.font = font(13, 500)
  ctx.fillStyle = '#334a69'
  ctx.fillText(truncate(order.customer?.address || '-', 52), 40, y + 82)
  ctx.font = font(13, 600)
  ctx.fillStyle = '#334a69'
  ctx.fillText(`${my ? 'ရက်စွဲ' : 'Date'}: ${dateStr}`, width / 2 + 20, y + 30)
  ctx.fillText(`${my ? 'ပို့ဆောင်ရေး' : 'Delivery'}: ${truncate(order.deliveryMethod || '-', 26)}`, width / 2 + 20, y + 56)
  ctx.fillText(`${my ? 'ငွေပေးချေမှု' : 'Payment'}: ${truncate(order.paymentMethod || '-', 26)}`, width / 2 + 20, y + 82)
  ctx.fillText(`${my ? 'အခြေအနေ' : 'Status'}: ${order.status || 'New'} · ${order.paymentStatus || ''}`, width / 2 + 20, y + 108)
  y += infoH - 30
  ctx.strokeStyle = '#dbe5f0'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(40, y)
  ctx.lineTo(width - 40, y)
  ctx.stroke()

  // Items table
  y += 34
  ctx.fillStyle = '#f2f8ff'
  ctx.fillRect(40, y, width - 80, tableHeadH)
  ctx.fillStyle = '#0756a4'
  ctx.font = font(13, 800)
  ctx.fillText(my ? 'ပစ္စည်း' : 'ITEM', 56, y + 30)
  ctx.fillText(my ? 'အရေအတွက်' : 'QTY', width - 380, y + 30)
  ctx.fillText(my ? 'ဈေးနှုန်း' : 'PRICE', width - 280, y + 30)
  ctx.textAlign = 'right'
  ctx.fillText(my ? 'ကျသင့်ငွေ' : 'AMOUNT', width - 56, y + 30)
  ctx.textAlign = 'left'
  y += tableHeadH
  ctx.font = font(14, 600)
  items.forEach((item, idx) => {
    if (idx % 2 === 0) {
      ctx.fillStyle = '#fafcff'
      ctx.fillRect(40, y, width - 80, rowH)
    }
    ctx.fillStyle = '#17243a'
    ctx.fillText(truncate(item.name, 40), 56, y + 33)
    ctx.fillStyle = '#334a69'
    ctx.fillText(String(item.quantity), width - 380, y + 33)
    ctx.fillText(formatPrice(item.price), width - 280, y + 33)
    ctx.textAlign = 'right'
    ctx.fillStyle = '#17243a'
    ctx.fillText(formatPrice(item.price * item.quantity), width - 56, y + 33)
    ctx.textAlign = 'left'
    y += rowH
  })
  ctx.strokeStyle = '#dbe5f0'
  ctx.beginPath()
  ctx.moveTo(40, y)
  ctx.lineTo(width - 40, y)
  ctx.stroke()

  // Totals
  y += 34
  const subtotal = order.subtotal ?? items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  ctx.font = font(14, 600)
  ctx.fillStyle = '#334a69'
  ctx.fillText(my ? 'ပစ္စည်းဖိုး စုစုပေါင်း' : 'Subtotal', width - 320, y)
  ctx.fillText(my ? 'ပို့ဆောင်ခ' : 'Delivery Fee', width - 320, y + 30)
  ctx.textAlign = 'right'
  ctx.fillStyle = '#17243a'
  ctx.fillText(formatPrice(subtotal), width - 56, y)
  ctx.fillText(formatPrice(order.deliveryFee || 0), width - 56, y + 30)
  ctx.font = font(20, 900)
  ctx.fillStyle = '#0756a4'
  ctx.textAlign = 'left'
  ctx.fillText(my ? 'စုစုပေါင်း ကျသင့်ငွေ' : 'Total', width - 320, y + 66)
  ctx.textAlign = 'right'
  ctx.fillText(formatPrice(order.total), width - 56, y + 66)
  ctx.textAlign = 'left'

  // Footer
  ctx.fillStyle = '#0756a4'
  ctx.fillRect(0, height - footerH, width, footerH)
  ctx.fillStyle = '#ffffff'
  ctx.font = font(14, 700)
  ctx.textAlign = 'center'
  ctx.fillText(my ? 'HTOO Online Shop မှ ဝယ်ယူအားပေးမှုအတွက် ကျေးဇူးတင်ပါသည်။' : 'Thank you for shopping with HTOO Online Shop.', width / 2, height - footerH + 34)
  ctx.font = font(12, 500)
  ctx.fillStyle = '#cfe4fb'
  ctx.fillText('Hotline: 09-123456789 · 9:00 AM - 8:00 PM', width / 2, height - footerH + 58)
  ctx.textAlign = 'left'

  const link = document.createElement('a')
  link.download = `HTOO-Invoice-${order.orderNumber || order.id}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}

const _STATUS_OPTIONS = ['New', 'Confirmed', 'Packing', 'Shipped', 'Delivered', 'Cancelled']
const _PAYMENT_STATUS_OPTIONS = ['Pending', 'Verified', 'Rejected']
const PAYMENT_METHODS = [
  { id: 'cod', label: 'အိမ်ရောက်ငွေချေ', english: 'Cash on Delivery', digital: false },
  { id: 'kbzpay', label: 'KBZ Pay', digital: true },
  { id: 'wavemoney', label: 'Wave Money', digital: true },
  { id: 'ayapay', label: 'AYA Pay', digital: true },
  { id: 'bank', label: 'Bank Transfer', digital: true }
]
const DELIVERY_METHODS = [
  { id: 'standard', labelMy: 'HTOO စတိုးမှ တိုက်ရိုက်ပို့ဆောင်မှု', labelEn: 'Standard Home Delivery' },
  { id: 'cargate', labelMy: 'ကားဂိတ်ပို့နဲ့ယူမယ်', labelEn: 'Car Gate Pickup' }
]
const SEED_PAYMENT_ACCOUNTS = {
  kbzpay: { accountName: '', accountNumber: '', bankName: '' },
  wavemoney: { accountName: '', accountNumber: '', bankName: '' },
  ayapay: { accountName: '', accountNumber: '', bankName: '' },
  bank: { accountName: '', accountNumber: '', bankName: '' }
}

const CATEGORIES = [
  { id: 'all', nameMy: 'ပင်မစာမျက်နှာ', nameEn: 'Home / All', value: 'All stores', icon: '🏠' },
  { id: 'fashion', nameMy: 'အဝတ်အထည်များ', nameEn: 'Clothing', value: 'Fashion', icon: '👗' },
  { id: 'grocery', nameMy: 'ကုန်ခြောက်များ', nameEn: 'Grocery', value: 'Grocery', icon: '🥫' },
  { id: 'tech', nameMy: 'ဖုန်းနှင့် ဆက်စပ်ပစ္စည်းများ', nameEn: 'Phones & Accessories', value: 'Tech', icon: '📱' },
]

const HERO_SLIDES = [
  {
    badge: 'HTOO SPECIAL OFFER · အထူးပရိုမိုးရှင်း',
    titleMy: 'အရည်အသွေးမြင့် ပစ္စည်းများကို အကောင်းဆုံး စျေးနှုန်းဖြင့်',
    titleEn: 'Premium Quality Products at Best Prices',
    descMy: 'အဝတ်အထည်၊ ကုန်ခြောက်နှင့် ဖုန်းဆက်စပ်ပစ္စည်းများကို အိမ်အရောက် အမြန်ပို့ဆောင်ပေးပါသည်။',
    descEn: 'Shop quality clothing, groceries, and phone accessories with fast door-to-door delivery.',
    ctaMy: 'အခုပဲ ဝယ်ယူမည်',
    ctaEn: 'Shop Now',
    image: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=1000&q=85',
  },
  {
    badge: 'FASHION & APPAREL · ဖက်ရှင် အသစ်များ',
    titleMy: 'ခေတ်မီဆန်းသစ်သော အဝတ်အထည်နှင့် ဖက်ရှင်ဒီဇိုင်းများ',
    titleEn: 'Modern & Stylish Clothing & Fashion',
    descMy: 'လူငယ်ကြိုက် စတိုင်ကျ အဝတ်အထည်များကို အထူးလျှော့စျေးဖြင့် ရရှိနိုင်ပါပြီ။',
    descEn: 'Trendy casual wear and accessories at discounted prices for every season.',
    ctaMy: 'ဖက်ရှင်ပစ္စည်းများ ကြည့်ရန်',
    ctaEn: 'Explore Fashion',
    image: 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=1000&q=85',
    category: 'Fashion'
  },
  {
    badge: 'TECH & GROCERY · ဖုန်းနှင့် ကုန်ခြောက်',
    titleMy: 'နေ့စဉ်သုံး ကုန်ခြောက်များနှင့် ဖုန်းဆက်စပ်ပစ္စည်းများ',
    titleEn: 'Daily Groceries & Phone Accessories',
    descMy: 'စိတ်ချရသော အရည်အသွေး၊ ၁၀၀% စစ်မှန်သော ပစ္စည်းများကိုသာ ရောင်းချပေးပါသည်။',
    descEn: 'Authentic phone gear, gadgets, and fresh daily essentials right to your doorstep.',
    ctaMy: 'ပစ္စည်းများ ကြည့်ရန်',
    ctaEn: 'Shop Essentials',
    image: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=1000&q=85',
    category: 'Tech'
  }
]

const SERVICE_ITEMS = [
  { icon: '🛡️', titleMy: 'စိတ်ချရသော ဈေးဝယ်စနစ်', titleEn: '100% Secure Shopping', descMy: 'စိတ်ချရသော အာမခံစနစ်', descEn: 'Guaranteed genuine quality' },
  { icon: '🚚', titleMy: 'မြန်ဆန်သော ပို့ဆောင်မှု', titleEn: 'Fast Delivery', descMy: 'အိမ်အရောက် အမြန်ပို့ဆောင်ခြင်း', descEn: 'Direct doorstep delivery' },
  { icon: '💬', titleMy: '၂၄ နာရီ ကူညီပေးခြင်း', titleEn: 'Customer Support', descMy: 'အဆင်ပြေစေရန် ကူညီမှု', descEn: '24/7 dedicated assistance' },
  { icon: '💳', titleMy: 'လွယ်ကူသော ငွေပေးချေမှု', titleEn: 'Multiple Payments', descMy: 'KPay, Wave, Bank, COD', descEn: 'Cash on delivery & mobile pay' },
]

const toCustomerProduct = (product) => ({
  ...product,
  name: product.nameEn || product.name,
  nameMy: product.nameMy || product.nameEn || product.name,
  description: product.descriptionEn || '',
  price: product.discountPrice ?? product.price,
  oldPrice: product.discountPrice != null ? product.price : product.oldPrice,
  image: product.image || product.images?.[0] || '',
  images: product.images || (product.image ? [product.image] : []),
  store: product.store || 'HTOO',
  category: product.category === 'Clothing' ? 'Fashion' : product.category === 'Phones & Accessories' ? 'Tech' : product.category,
  tag: product.tag || (product.discountPrice != null ? `−${Math.round((1 - product.discountPrice / product.price) * 100)}%` : (product.oldPrice ? `−${Math.round((1 - product.price / product.oldPrice) * 100)}%` : 'New'))
})

const seedProducts = [
  { id: 1, name: 'Linen camp shirt', store: 'Mingalar Wardrobe', category: 'Fashion', price: 29900, oldPrice: 36000, tag: 'Bestseller', stock: 18, image: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=900&q=85', tone: 'sand', sellerId: 'demo-seller' },
  { id: 2, name: 'Wireless earbuds', store: 'Plug & Play', category: 'Tech', price: 42000, oldPrice: 54000, tag: '−22%', stock: 7, image: 'https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?auto=format&fit=crop&w=900&q=85', tone: 'mist', sellerId: 'demo-seller' },
  { id: 3, name: 'Weekend market basket', store: 'The Daily Pantry', category: 'Grocery', price: 18500, oldPrice: null, tag: 'Local pick', stock: 24, image: 'https://images.unsplash.com/photo-1543168256-418811576931?auto=format&fit=crop&w=900&q=85', tone: 'leaf', sellerId: 'demo-seller' },
  { id: 4, name: 'Retro runner sneakers', store: 'Mingalar Wardrobe', category: 'Fashion', price: 68000, oldPrice: 84000, tag: 'New drop', stock: 4, image: 'https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=900&q=85', tone: 'coral', sellerId: 'demo-seller' },
]

function App() {
  const [products, setProducts] = useState(() => getProducts(seedProducts))
  const [paymentAccounts] = useState(() => getPaymentAccounts(SEED_PAYMENT_ACCOUNTS))
  const [enabledPayments, setEnabledPayments] = useState([])
  const [settings, setSettings] = useState({ carGatePickupFee: 20000 })
  const [customerOrders, setCustomerOrders] = useState([])
  const [selectedCustomerOrder, setSelectedCustomerOrder] = useState(null)
  const [user, setUser] = useState(null)
  const [activeCategory, setActiveCategory] = useState('All stores')
  const [query, setQuery] = useState('')
  const [cart, setCart] = useState(() => user ? getCart(user.id) : JSON.parse(localStorage.getItem(GUEST_CART_KEY) || '[]'))
  const [liked, setLiked] = useState(() => user ? getWishlist(user.id) : JSON.parse(localStorage.getItem(GUEST_WISHLIST_KEY) || '[]'))
  const [modal, setModal] = useState(null)
  const [page, setPage] = useState('home')
  const [lastOrder, setLastOrder] = useState(null)
  const [showCart, setShowCart] = useState(false)
  const [showWishlist, setShowWishlist] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [notice, setNotice] = useState('')
  const [language, setLanguage] = useState(() => localStorage.getItem(LANGUAGE_KEY) || 'my')
  const [currentSlide, setCurrentSlide] = useState(0)

  const fetchCustomerOrders = () => {
    fetch('/api/customer/orders')
      .then((response) => response.ok ? response.json() : null)
      .then((orderResult) => setCustomerOrders(orderResult?.orders || []))
      .catch(() => {})
  }

  const openCustomerOrder = useCallback(async (orderIdOrNum) => {
    if (!user) {
      setModal('login')
      setNotice(language === 'my' ? 'ကျေးဇူးပြု၍ အော်ဒါကြည့်ရှုရန် အကောင့်ဝင်ပေးပါ။' : 'Please log in to view your order.')
      return
    }
    try {
      const res = await fetch(`/api/customer/orders/${orderIdOrNum}`)
      if (res.status === 403) {
        setNotice('Access denied. You can only view your own orders.')
        setPage('home')
        return
      }
      if (!res.ok) throw new Error(language === 'my' ? 'အော်ဒါ ရှာမတွေ့ပါ။' : 'Order not found.')
      const data = await res.json()
      if (data?.order) {
        setSelectedCustomerOrder(data.order)
        setPage('order-detail')
        window.location.hash = `order/${data.order.orderNumber || data.order.id}`
      }
    } catch (err) {
      setNotice(err.message)
    }
  }, [language, user])

  useEffect(() => {
    fetch('/api/customer/session')
      .then((response) => response.ok ? response.json() : null)
      .then((result) => {
        if (result?.customer) {
          setUser(result.customer)
          setCart(getCart(result.customer.id))
          setLiked(getWishlist(result.customer.id))
          fetchCustomerOrders()
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const syncHash = () => {
      const hash = window.location.hash
      if (hash === '#my-orders') {
        if (user) {
          setPage('my-orders')
        }
      } else if (hash.startsWith('#order/')) {
        const targetId = hash.replace('#order/', '')
        if (targetId && user) {
          openCustomerOrder(targetId)
        }
      }
    }
    syncHash()
    window.addEventListener('hashchange', syncHash)
    return () => window.removeEventListener('hashchange', syncHash)
  }, [user, openCustomerOrder])

  useEffect(() => {
    if (user) saveCart(user.id, cart)
    else localStorage.setItem(GUEST_CART_KEY, JSON.stringify(cart))
  }, [cart, user])

  useEffect(() => {
    if (user) saveWishlist(user.id, liked)
    else localStorage.setItem(GUEST_WISHLIST_KEY, JSON.stringify(liked))
  }, [liked, user])

  useEffect(() => {
    const syncCatalog = () =>
      fetch('/api/products')
        .then((response) => response.ok ? response.json() : null)
        .then((result) => {
          if (result?.products) setProducts(result.products.map(toCustomerProduct))
        })
        .catch(() => {})
    syncCatalog()
    const timer = setInterval(syncCatalog, 15000)
    window.addEventListener('focus', syncCatalog)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', syncCatalog)
    }
  }, [])

  useEffect(() => {
    const syncPayments = () =>
      fetch('/api/payments')
        .then((response) => response.ok ? response.json() : null)
        .then((result) => {
          if (result?.payments) setEnabledPayments(result.payments)
        })
        .catch(() => {})
    syncPayments()
    const timer = setInterval(syncPayments, 15000)
    window.addEventListener('focus', syncPayments)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', syncPayments)
    }
  }, [])

  useEffect(() => {
    const syncSettings = () =>
      fetch('/api/settings')
        .then((response) => response.ok ? response.json() : null)
        .then((result) => {
          if (result?.settings) setSettings(result.settings)
        })
        .catch(() => {})
    syncSettings()
    const timer = setInterval(syncSettings, 15000)
    window.addEventListener('focus', syncSettings)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', syncSettings)
    }
  }, [])

  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => setNotice(''), 2800)
    return () => clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    localStorage.setItem(LANGUAGE_KEY, language)
  }, [language])

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length)
    }, 6000)
    return () => clearInterval(timer)
  }, [])

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesCategory =
        activeCategory === 'All stores' ||
        product.category === activeCategory ||
        (activeCategory === 'Fashion' && (product.category === 'Fashion' || product.category === 'Clothing')) ||
        (activeCategory === 'Tech' && (product.category === 'Tech' || product.category === 'Phones & Accessories'))
      const searchTarget = `${product.name} ${product.nameMy || ''} ${product.store || ''} ${product.category || ''}`.toLowerCase()
      const matchesQuery = query.trim() === '' || searchTarget.includes(query.toLowerCase().trim())
      return matchesCategory && matchesQuery
    })
  }, [products, activeCategory, query])

  const cartCount = cart.reduce((total, item) => total + item.quantity, 0)
  const cartTotal = cart.reduce((total, item) => total + item.price * item.quantity, 0)
  const getDeliveryFee = useCallback((method) => method === 'cargate' ? Number(settings.carGatePickupFee || 0) : (cart.length ? 3 : 0), [cart.length, settings.carGatePickupFee])

  function addToCart(product) {
    if (!product.stock) return setNotice(language === 'my' ? 'ပစ္စည်းကုန်သွားပါပြီ။' : 'This item is currently out of stock.')
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id)
      return existing
        ? current.map((item) => item.id === product.id ? { ...item, quantity: Math.min(item.quantity + 1, product.stock) } : item)
        : [...current, { ...product, quantity: 1 }]
    })
    setNotice(language === 'my' ? `${product.name} ကို ခြင်းထဲထည့်လိုက်ပါပြီ။` : `${product.name} added to your cart.`)
  }

  function updateQuantity(id, amount) {
    setCart((current) =>
      current
        .map((item) => item.id === id ? { ...item, quantity: Math.max(0, Math.min(item.quantity + amount, products.find((product) => product.id === id)?.stock || 99)) } : item)
        .filter((item) => item.quantity > 0)
    )
  }

  async function handleAuth(values) {
    const endpoint = modal === 'register' ? '/api/customer/register' : '/api/customer/login'
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Authentication failed.')
      const nextUser = result.customer
      const guestCart = JSON.parse(localStorage.getItem(GUEST_CART_KEY) || '[]')
      const guestWishlist = JSON.parse(localStorage.getItem(GUEST_WISHLIST_KEY) || '[]')
      setUser(nextUser)
      setCart(guestCart.length ? mergeCart(nextUser.id, guestCart) : getCart(nextUser.id))
      setLiked(guestWishlist.length ? mergeWishlist(nextUser.id, guestWishlist) : getWishlist(nextUser.id))
      localStorage.removeItem(GUEST_CART_KEY)
      localStorage.removeItem(GUEST_WISHLIST_KEY)
      setModal(null)
      setNotice(language === 'my' ? `ကြိုဆိုပါသည်၊ ${nextUser.name.split(' ')[0]}` : `Welcome, ${nextUser.name.split(' ')[0]}.`)
      fetchCustomerOrders()
    } catch (error) {
      setNotice(error.message)
    }
  }

  async function handleLogout() {
    await fetch('/api/customer/logout', { method: 'POST' }).catch(() => {})
    setUser(null)
    setCart([])
    setCustomerOrders([])
    setSelectedCustomerOrder(null)
    setPage('home')
    setLiked(JSON.parse(localStorage.getItem(GUEST_WISHLIST_KEY) || '[]'))
    setNotice(language === 'my' ? 'အကောင့်ထွက်ပြီးပါပြီ။' : 'You have been signed out.')
  }

  function openCheckout() {
    setShowCart(false)
    setPage(cart.length ? 'checkout' : 'home')
  }

  async function placeOrder(values) {
    const payment = PAYMENT_METHODS.find((method) => method.id === values.paymentMethod)
    const delivery = DELIVERY_METHODS.find((method) => method.id === values.deliveryMethod) || DELIVERY_METHODS[0]
    const orderDeliveryFee = getDeliveryFee(delivery.id)
    const customer = {
      ...values,
      name: values.name.trim(),
      phone: values.phone.trim(),
      address: values.address.trim(),
      note: values.note.trim(),
      userId: user?.id || null
    }
    if (!customer.name || !customer.phone || !customer.address || !payment) {
      setNotice(language === 'my' ? 'အမည်၊ ဖုန်းနံပါတ်၊ လိပ်စာနှင့် ငွေပေးချေမှုနည်းလမ်း ဖြည့်ပေးပါ။' : 'Please fill in name, phone, address and payment method.')
      return false
    }
    const order = {
      id: crypto.randomUUID(),
      orderNumber: `AM-${Date.now().toString(36).toUpperCase()}`,
      customer,
      items: cart.map(({ id, name, image, price, quantity, store }) => ({ id, name, image, price, quantity, store })),
      subtotal: cartTotal,
      deliveryFee: orderDeliveryFee,
      deliveryMethod: language === 'my' ? delivery.labelMy : delivery.labelEn,
      deliveryMethodId: delivery.id,
      total: cartTotal + orderDeliveryFee,
      paymentMethod: payment.label,
      paymentMethodId: payment.id,
      paymentAccount: payment.digital ? paymentAccounts[payment.id] : null,
      receipt: payment.digital ? values.receipt : null,
      paymentStatus: payment.digital ? 'Pending Verification' : 'Not Required',
      status: 'New',
      createdAt: new Date().toISOString()
    }
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order)
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Order service unavailable.')
    } catch (error) {
      setNotice(error.message === 'Order service unavailable.' ? (language === 'my' ? 'အော်ဒါဝန်ဆောင်မှုကို ချိတ်ဆက်၍ မရသေးပါ။ API server ကို ဖွင့်ပြီး ပြန်ကြိုးစားပါ။' : 'Order service unavailable. Please check API server.') : `အော်ဒါတင်၍ မရပါ။ ${error.message}`)
      return false
    }
    saveOrder(order)
    const catalogResponse = await fetch('/api/products').catch(() => null)
    const catalog = catalogResponse?.ok ? await catalogResponse.json() : null
    if (catalog?.products) {
      const next = catalog.products.map(toCustomerProduct)
      setProducts(next)
      saveProducts(next)
    }
    setCart([])
    if (user) saveCart(user.id, [])
    else localStorage.removeItem(GUEST_CART_KEY)
    setCustomerOrders((prev) => [order, ...prev])
    setLastOrder(order)
    setPage('success')
    return true
  }

  if (selectedProduct) {
    return (
      <ProductDetail
        product={selectedProduct}
        language={language}
        onBack={() => setSelectedProduct(null)}
        onAdd={() => addToCart(selectedProduct)}
        onBuy={(quantity) => {
          for (let index = 0; index < quantity; index += 1) addToCart(selectedProduct)
          setSelectedProduct(null)
          setShowCart(true)
        }}
      />
    )
  }

  if (page === 'checkout') {
    return (
      <CheckoutPage
        cart={cart}
        subtotal={cartTotal}
        carGatePickupFee={settings.carGatePickupFee}
        user={user}
        language={language}
        enabledPayments={enabledPayments}
        paymentAccounts={paymentAccounts}
        onBack={() => setPage('home')}
        onPlaceOrder={placeOrder}
      />
    )
  }

  if (page === 'success') {
    return (
      <OrderSuccess
        order={lastOrder}
        language={language}
        onContinue={() => setPage('home')}
        onViewOrder={(ord) => openCustomerOrder(ord.orderNumber || ord.id)}
        onMyOrders={() => {
          setPage('my-orders')
          window.location.hash = 'my-orders'
        }}
      />
    )
  }

  if (page === 'my-orders') {
    return (
      <MyOrdersPage
        orders={customerOrders}
        user={user}
        language={language}
        onBack={() => setPage('home')}
        onSelectOrder={(ord) => openCustomerOrder(ord.orderNumber || ord.id)}
        onLogin={() => setModal('login')}
      />
    )
  }

  if (page === 'order-detail' && selectedCustomerOrder) {
    return (
      <CustomerOrderDetailPage
        order={selectedCustomerOrder}
        language={language}
        onBack={() => {
          setPage('my-orders')
          window.location.hash = 'my-orders'
        }}
      />
    )
  }

  const slide = HERO_SLIDES[currentSlide]

  return (
    <div className="app-shell">
      {/* 1. APPROVED DESKTOP HEADER */}
      <header className="topbar">
        <a className="brand" href="#top" onClick={() => setPage('home')}>
          <span className="brand-mark">H</span>
          <div className="brand-title">
            <strong>HTOO</strong>
            <small>{language === 'my' ? 'အွန်လိုင်းစျေးဝယ်' : 'Online Shop'}</small>
          </div>
        </a>

        <form
          className="header-search"
          onSubmit={(e) => {
            e.preventDefault()
            document.getElementById('shop-grid')?.scrollIntoView({ behavior: 'smooth' })
          }}
        >
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={language === 'my' ? 'ပစ္စည်းများ ရှာရန်...' : 'Search products in HTOO...'}
            aria-label="Search products"
          />
          <button type="submit" className="search-button">
            <span>⌕</span> {language === 'my' ? 'ရှာမည်' : 'Search'}
          </button>
        </form>

        <div className="header-actions">
          <button
            className="language-toggle"
            onClick={() => setLanguage((current) => current === 'my' ? 'en' : 'my')}
            aria-label="Change language"
          >
            🌐 {language === 'my' ? 'English' : 'မြန်မာ'}
          </button>

          <button
            className="notif-button"
            onClick={() => setModal('notifications')}
            aria-label="Open notifications"
          >
            🔔
          </button>

          <button
            className="wishlist-button"
            onClick={() => setShowWishlist(true)}
            aria-label="Open wishlist"
          >
            ♥ <span>{language === 'my' ? 'သိမ်းထားသည်' : 'Wishlist'}</span>
            <b className="badge-count">{liked.length}</b>
          </button>

          <button
            className="profile-button-text"
            onClick={() => user ? setModal('account') : setModal('login')}
            aria-label="Open account"
          >
            {user ? (
              <>
                <span className="user-avatar-circle">{user.name.slice(0, 2).toUpperCase()}</span>
                <span>{user.name.split(' ')[0]}</span>
              </>
            ) : (
              <>
                <span>👤</span>
                <span>{language === 'my' ? 'အကောင့်ဝင်ရန်' : 'Sign In'}</span>
              </>
            )}
          </button>

          <button
            className="cart-button"
            onClick={() => setShowCart(true)}
            aria-label="Open cart"
          >
            🛒 <span>{language === 'my' ? 'ခြင်း' : 'Cart'}</span>
            <b className="badge-count">{cartCount}</b>
          </button>
        </div>
      </header>

      {/* MAIN TWO-COLUMN DESKTOP LAYOUT WITH LEFT SIDEBAR */}
      <main id="top" className="htoo-main-container">
        <div className="htoo-layout-wrapper">
          {/* 2. LEFT NAVIGATION SIDEBAR */}
          <aside className="htoo-sidebar">
            <div className="sidebar-section-title">
              <span>🛍️</span>
              <strong>{language === 'my' ? 'ပစ္စည်းအမျိုးအစားများ' : 'Shop Categories'}</strong>
            </div>

            <nav className="sidebar-nav-list">
              {CATEGORIES.map((category) => (
                <button
                  className={`sidebar-nav-item ${activeCategory === category.value ? 'active' : ''}`}
                  key={category.id}
                  onClick={() => {
                    setActiveCategory(category.value)
                    document.getElementById('shop-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
                >
                  <span className="nav-icon">{category.icon}</span>
                  <span className="nav-label">{language === 'my' ? category.nameMy : category.nameEn}</span>
                </button>
              ))}
            </nav>

            <div className="sidebar-divider" />

            <div className="sidebar-section-title">
              <span>👤</span>
              <strong>{language === 'my' ? 'အကောင့်နှင့် ဝန်ဆောင်မှု' : 'Customer Menu'}</strong>
            </div>

            <nav className="sidebar-nav-list secondary-menu">
              <button
                className="sidebar-nav-item"
                onClick={() => {
                  if (user) {
                    setPage('my-orders')
                    window.location.hash = 'my-orders'
                  } else {
                    setModal('login')
                    setNotice(language === 'my' ? 'ကျေးဇူးပြု၍ အော်ဒါကြည့်ရှုရန် အကောင့်ဝင်ပေးပါ။' : 'Please log in to view your orders.')
                  }
                }}
              >
                <span className="nav-icon">📦</span>
                <span className="nav-label">{language === 'my' ? 'အော်ဒါကြည့်ရန်' : 'My Orders'}</span>
              </button>

              <button
                className="sidebar-nav-item"
                onClick={() => setModal('notifications')}
              >
                <span className="nav-icon">🔔</span>
                <span className="nav-label">{language === 'my' ? 'အကြောင်းကြားချက်များ' : 'Notifications'}</span>
              </button>

              <button
                className="sidebar-nav-item"
                onClick={() => user ? setModal('account') : setModal('login')}
              >
                <span className="nav-icon">👤</span>
                <span className="nav-label">{language === 'my' ? 'အကောင့်' : 'My Account'}</span>
              </button>

              <button
                className="sidebar-nav-item"
                onClick={() => setModal('help')}
              >
                <span className="nav-icon">💬</span>
                <span className="nav-label">{language === 'my' ? 'အကူအညီ' : 'Help & Support'}</span>
              </button>
            </nav>

            <div className="sidebar-promo-card">
              <div className="promo-badge">HOTLINE</div>
              <strong>📞 09-123456789</strong>
              <small>{language === 'my' ? 'နံနက် ၉:၀၀ မှ ည ၈:၀၀ ထိ' : '9:00 AM - 8:00 PM'}</small>
            </div>
          </aside>

          {/* 3. MAIN CONTENT ON THE RIGHT */}
          <div className="htoo-main-content">
            {/* HERO BANNER */}
            <section className="hero-banner">
              <div className="hero-content">
                <span className="hero-badge">{slide.badge}</span>
                <h1 className="hero-title">{language === 'my' ? slide.titleMy : slide.titleEn}</h1>
                <p className="hero-desc">{language === 'my' ? slide.descMy : slide.descEn}</p>
                <button
                  className="hero-cta"
                  onClick={() => {
                    if (slide.category) setActiveCategory(slide.category)
                    document.getElementById('shop-grid')?.scrollIntoView({ behavior: 'smooth' })
                  }}
                >
                  {language === 'my' ? slide.ctaMy : slide.ctaEn} <span>↗</span>
                </button>
              </div>

              <div className="hero-image-wrap">
                <img src={slide.image} alt="Promotion Banner" className="hero-image" />
                <div className="hero-arrows">
                  <button
                    className="hero-arrow-btn"
                    onClick={() => setCurrentSlide((prev) => (prev === 0 ? HERO_SLIDES.length - 1 : prev - 1))}
                    aria-label="Previous slide"
                  >
                    ❮
                  </button>
                  <button
                    className="hero-arrow-btn"
                    onClick={() => setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length)}
                    aria-label="Next slide"
                  >
                    ❯
                  </button>
                </div>
              </div>

              <div className="hero-dots">
                {HERO_SLIDES.map((_, idx) => (
                  <button
                    key={idx}
                    className={`hero-dot ${idx === currentSlide ? 'active' : ''}`}
                    onClick={() => setCurrentSlide(idx)}
                    aria-label={`Slide ${idx + 1}`}
                  />
                ))}
              </div>
            </section>

            {/* 4. FEATURED PRODUCTS GRID */}
            <section className="shop-section" id="shop-grid">
              <div className="shop-section-header">
                <div>
                  <h2>
                    <span>✦</span> {language === 'my' ? 'ထူးခြားသော ပစ္စည်းများ' : 'Featured Products'}
                  </h2>
                </div>
                <div className="item-count">
                  {language === 'my' ? `ပစ္စည်း စုစုပေါင်း (${filteredProducts.length}) ခု` : `${filteredProducts.length} item(s) found`}
                </div>
              </div>

              {filteredProducts.length === 0 ? (
                <div className="empty-cart" style={{ minHeight: '220px' }}>
                  <span>🔍</span>
                  <p>{language === 'my' ? 'ရှာဖွေထားသော ပစ္စည်းမရှိပါ။' : 'No products found.'}</p>
                </div>
              ) : (
                <div className="product-grid">
                  {filteredProducts.map((product) => (
                    <article className="product-card" key={product.id}>
                      <div
                        className="product-open"
                        role="button"
                        tabIndex="0"
                        onClick={() => setSelectedProduct(product)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') setSelectedProduct(product)
                        }}
                      >
                        <div className={`product-image ${product.tone || ''}`}>
                          <img src={product.image} alt={product.name} />
                          {product.tag && (
                            <span className="product-tag">
                              {product.stock === 0 ? (language === 'my' ? 'ကုန်ပြီ' : 'Sold out') : product.tag}
                            </span>
                          )}
                          <button
                            className={`heart-button ${liked.includes(product.id) ? 'liked' : ''}`}
                            onClick={(event) => {
                              event.stopPropagation()
                              const isLiked = liked.includes(product.id)
                              setLiked((current) => isLiked ? current.filter((id) => id !== product.id) : [...current, product.id])
                              setNotice(isLiked ? (language === 'my' ? 'သိမ်းဆည်းထားသည်မှ ဖယ်ရှားလိုက်ပါပြီ' : 'Removed from saved items') : (language === 'my' ? 'သိမ်းဆည်းထားသောစာရင်းသို့ ထည့်လိုက်ပါပြီ' : 'Saved to wishlist'))
                            }}
                            aria-label={`Save ${product.name}`}
                          >
                            {liked.includes(product.id) ? '♥' : '♡'}
                          </button>
                        </div>

                        <div className="product-info">
                          <p className="store-name">{product.store} · {product.category}</p>
                          <h3>{product.name}</h3>
                          <div className="product-price">
                            <strong>{formatPrice(product.price)}</strong>
                            {product.oldPrice && <del>{formatPrice(product.oldPrice)}</del>}
                          </div>
                        </div>
                      </div>

                      <button
                        className="add-button"
                        disabled={!product.stock}
                        onClick={() => addToCart(product)}
                      >
                        {product.stock ? (language === 'my' ? '+ ခြင်းထဲထည့်ရန်' : '+ Add to Cart') : (language === 'my' ? 'ပစ္စည်းကုန်ပြီ' : 'Sold out')}
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </section>

            {/* 5. LOWER SERVICE BAR */}
            <section className="service-strip">
              {SERVICE_ITEMS.map((item, idx) => (
                <div className="service-item" key={idx}>
                  <div className="service-icon">{item.icon}</div>
                  <div className="service-text">
                    <strong>{language === 'my' ? item.titleMy : item.titleEn}</strong>
                    <small>{language === 'my' ? item.descMy : item.descEn}</small>
                  </div>
                </div>
              ))}
            </section>
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="htoo-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <span className="brand-mark">H</span>
            <strong>HTOO Online Shop</strong>
            <p>{language === 'my' ? 'မြန်မာနိုင်ငံ၏ စိတ်ချရဆုံး အွန်လိုင်းစျေးဝယ်စနစ်' : 'Myanmar Reliable Online Shopping'}</p>
          </div>
          <div className="footer-links">
            <small>© {new Date().getFullYear()} HTOO Online Shop. All rights reserved.</small>
          </div>
        </div>
      </footer>

      {/* 7. FLOATING CHAT / SUPPORT BUTTON */}
      <button
        className="floating-chat-btn"
        onClick={() => setModal('help')}
        aria-label="Customer Support Chat"
      >
        <span>💬</span>
        <span>{language === 'my' ? 'အကူအညီ / Chat' : 'Help & Chat'}</span>
      </button>

      {/* MOBILE BOTTOM NAVIGATION */}
      <nav className="mobile-nav">
        <button className={page === 'home' ? 'active' : ''} onClick={() => setPage('home')}>
          ⌂<span>{language === 'my' ? 'ပင်မ' : 'Home'}</span>
        </button>
        <button onClick={() => { setPage('home'); setTimeout(() => document.getElementById('shop-grid')?.scrollIntoView({ behavior: 'smooth' }), 50) }}>
          ◌<span>{language === 'my' ? 'အမျိုးအစား' : 'Category'}</span>
        </button>
        <button onClick={() => setShowWishlist(true)}>
          ♥<span>{language === 'my' ? 'သိမ်းထား' : 'Saved'} {liked.length > 0 && `(${liked.length})`}</span>
        </button>
        <button onClick={() => setShowCart(true)}>
          ▢<span>{language === 'my' ? 'ခြင်း' : 'Cart'} {cartCount > 0 && `(${cartCount})`}</span>
        </button>
        {user ? (
          <button
            className={page === 'my-orders' || page === 'order-detail' ? 'active' : ''}
            onClick={() => {
              setPage('my-orders')
              window.location.hash = 'my-orders'
            }}
          >
            ◉<span>{language === 'my' ? 'အော်ဒါများ' : 'Orders'}</span>
          </button>
        ) : (
          <button onClick={() => setModal('login')}>
            ◉<span>{language === 'my' ? 'အကောင့်' : 'Account'}</span>
          </button>
        )}
      </nav>

      {/* DRAWERS & MODALS */}
      {showCart && (
        <CartDrawer
          cart={cart}
          total={cartTotal}
          onClose={() => setShowCart(false)}
          updateQuantity={updateQuantity}
          onCheckout={openCheckout}
          language={language}
        />
      )}

      {showWishlist && (
        <WishlistDrawer
          products={products}
          liked={liked}
          onClose={() => setShowWishlist(false)}
          onRemove={(id) => setLiked((current) => current.filter((item) => item !== id))}
          onAddToCart={(product) => {
            addToCart(product)
            setNotice(`${product.name} ခြင်းထဲထည့်ပြီးပါပြီ။`)
          }}
          language={language}
        />
      )}

      {modal === 'login' && (
        <AuthModal
          mode="login"
          onClose={() => setModal(null)}
          onSubmit={handleAuth}
          onSwitch={() => setModal('register')}
          onForgot={() => setModal('forgot')}
          onGoogle={() =>
            fetch('/api/customer/google')
              .then((response) => response.json())
              .then((result) => setNotice(result.configured ? 'Google OAuth is ready to connect.' : result.message))
              .catch(() => setNotice('Google OAuth configuration cannot be checked right now.'))
          }
        />
      )}

      {modal === 'register' && (
        <AuthModal
          mode="register"
          onClose={() => setModal(null)}
          onSubmit={handleAuth}
          onSwitch={() => setModal('login')}
          onGoogle={() =>
            fetch('/api/customer/google')
              .then((response) => response.json())
              .then((result) => setNotice(result.configured ? 'Google OAuth is ready to connect.' : result.message))
              .catch(() => setNotice('Google OAuth configuration cannot be checked right now.'))
          }
        />
      )}

      {modal === 'forgot' && (
        <ForgotModal
          onClose={() => setModal(null)}
          onSubmit={async (values) => {
            const response = await fetch('/api/customer/forgot/request', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(values)
            })
            const result = await response.json().catch(() => ({}))
            setNotice(result.message || result.error || 'Password reset request received.')
            setModal(null)
          }}
        />
      )}

      {modal === 'account' && (
        <AccountModal
          user={user}
          orders={customerOrders}
          onClose={() => setModal(null)}
          onLogout={handleLogout}
          onOpenWishlist={() => {
            setModal(null)
            setShowWishlist(true)
          }}
          onOpenMyOrders={() => {
            setPage('my-orders')
            window.location.hash = 'my-orders'
            setModal(null)
          }}
          language={language}
        />
      )}

      {modal === 'notifications' && (
        <NotificationsModal
          user={user}
          orders={customerOrders}
          onClose={() => setModal(null)}
          language={language}
          onSelectOrder={(ord) => {
            setModal(null)
            openCustomerOrder(ord.orderNumber || ord.id)
          }}
        />
      )}

      {modal === 'help' && (
        <HelpModal
          onClose={() => setModal(null)}
          language={language}
        />
      )}

      {notice && <aside className="toast" role="status">{notice}</aside>}
    </div>
  )
}

function NotificationsModal({ _user, orders, onClose, language, onSelectOrder }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="auth-modal notifications-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>×</button>
        <p className="eyebrow">{language === 'my' ? 'အကြောင်းကြားချက်များ' : 'NOTIFICATIONS'}</p>
        <h2>{language === 'my' ? 'နောက်ဆုံးရ အချက်အလက်များ' : 'Latest Updates'}</h2>

        <div className="notifications-list">
          <div className="notification-item">
            <span className="notif-icon">🎉</span>
            <div>
              <strong>{language === 'my' ? 'HTOO Online Shop မှ ကြိုဆိုပါသည်' : 'Welcome to HTOO Online Shop'}</strong>
              <small>{language === 'my' ? 'အရည်အသွေးမြင့် ပစ္စည်းများကို အထူးလျှော့စျေးဖြင့် ဝယ်ယူရရှိနိုင်ပါပြီ။' : 'Explore high quality products at discounted prices.'}</small>
            </div>
          </div>

          {orders && orders.length > 0 ? (
            orders.slice(0, 3).map((ord) => (
              <div
                className="notification-item clickable"
                key={ord.id}
                onClick={() => onSelectOrder(ord)}
              >
                <span className="notif-icon">📦</span>
                <div>
                  <strong>{language === 'my' ? `အော်ဒါ #${ord.orderNumber || ord.id}` : `Order #${ord.orderNumber || ord.id}`}</strong>
                  <small>{language === 'my' ? `အခြေအနေ: ${ord.status} · စုစုပေါင်း: ${formatPrice(ord.total)}` : `Status: ${ord.status} · Total: ${formatPrice(ord.total)}`}</small>
                </div>
              </div>
            ))
          ) : (
            <div className="notification-item">
              <span className="notif-icon">🚚</span>
              <div>
                <strong>{language === 'my' ? 'မြန်ဆန်သော အိမ်အရောက် ပို့ဆောင်မှု' : 'Fast Doorstep Delivery'}</strong>
                <small>{language === 'my' ? 'ရန်ကုန်နှင့် မြန်မာနိုင်ငံအနှံ့ အိမ်အရောက် ပို့ဆောင်ပေးပါသည်။' : 'Delivering across Yangon and throughout Myanmar.'}</small>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function HelpModal({ onClose, language }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="auth-modal help-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>×</button>
        <p className="eyebrow">{language === 'my' ? 'အကူအညီနှင့် ဝန်ဆောင်မှု' : 'CUSTOMER SUPPORT'}</p>
        <h2>{language === 'my' ? 'HTOO အကူအညီ' : 'How can we help?'}</h2>
        <p className="modal-copy">
          {language === 'my' ? 'သင်သိရှိလိုသည်များရှိပါက အောက်ပါ လိုင်းများမှတစ်ဆင့် အချိန်မရွေး ဆက်သွယ်မေးမြန်းနိုင်ပါသည်။' : 'Contact our support team anytime through any of the channels below.'}
        </p>

        <div className="help-channels">
          <div className="help-channel-card">
            <span>📞</span>
            <div>
              <strong>{language === 'my' ? 'ဖုန်းဖြင့် ဆက်သွယ်ရန်' : 'Phone Hotline'}</strong>
              <p>09-123456789 / 09-987654321</p>
            </div>
          </div>

          <div className="help-channel-card">
            <span>💬</span>
            <div>
              <strong>{language === 'my' ? 'Viber & Telegram' : 'Viber & Telegram'}</strong>
              <p>+95 9 123456789</p>
            </div>
          </div>

          <button
            className="primary-button"
            style={{ width: '100%', marginTop: '12px' }}
            onClick={() => window.open('https://www.facebook.com/', '_blank', 'noopener,noreferrer')}
          >
            Facebook Messenger <span>↗</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function AuthModal({ mode, onClose, onSubmit, onSwitch, onForgot, onGoogle }) {
  const [values, setValues] = useState({ name: '', phone: '', password: '', confirmPassword: '', remember: false })
  const update = (key, value) => setValues({ ...values, [key]: value })

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="auth-modal" onClick={(event) => event.stopPropagation()}>
        <button className="close-button" onClick={onClose}>×</button>
        <p className="eyebrow">HTOO</p>
        <h2>{mode === 'login' ? 'Welcome back.' : 'Join HTOO.'}</h2>
        <p className="modal-copy">{mode === 'login' ? 'ဖုန်းနံပါတ်ဖြင့် ဝင်ရောက်ပါ။' : 'အကောင့်ဖွင့်ပြီး ဝယ်ယူမှုများကို စီမံပါ။'}</p>
        <form onSubmit={(event) => { event.preventDefault(); onSubmit(values) }}>
          {mode === 'register' && (
            <input
              required
              placeholder="Customer name / အမည်"
              value={values.name}
              onChange={(event) => update('name', event.target.value)}
            />
          )}
          <input
            required
            inputMode="tel"
            pattern="(?:\+?95|0)[0-9s()-]{7,13}"
            placeholder="Phone number / ဖုန်းနံပါတ်"
            value={values.phone}
            onChange={(event) => update('phone', event.target.value)}
          />
          <div className="password-field">
            <input
              required
              type={values.showPassword ? 'text' : 'password'}
              minLength="8"
              placeholder="Password / စကားဝှက်"
              value={values.password}
              onChange={(event) => update('password', event.target.value)}
            />
            <button type="button" onClick={() => update('showPassword', !values.showPassword)}>
              {values.showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          {mode === 'register' && (
            <input
              required
              type="password"
              minLength="8"
              placeholder="Confirm password / ထပ်မံရိုက်ပါ"
              value={values.confirmPassword}
              onChange={(event) => update('confirmPassword', event.target.value)}
            />
          )}
          {mode === 'login' && (
            <label className="remember-choice">
              <input
                type="checkbox"
                checked={values.remember}
                onChange={(event) => update('remember', event.target.checked)}
              /> Remember me / မှတ်ထားမည်
            </label>
          )}
          <button className="primary-button" type="submit">
            {mode === 'login' ? 'Login / ဝင်ရန်' : 'Register / စာရင်းသွင်းရန်'} <span>↗</span>
          </button>
        </form>

        <button className="google-auth-button" type="button" onClick={onGoogle}>
          Continue with Google
        </button>

        <div className="auth-links">
          {mode === 'login' ? (
            <>
              <button className="switch-button" onClick={onForgot}>Forgot password? / စကားဝှက်မေ့နေပါသလား</button>
              <button className="switch-button" onClick={onSwitch}>အကောင့်အသစ်ဖွင့်ရန် / Create account</button>
            </>
          ) : (
            <button className="switch-button" onClick={onSwitch}>အကောင့်ရှိပြီးသားဖြစ်ပါက ဝင်ရန် / Sign in</button>
          )}
        </div>
      </div>
    </div>
  )
}

function ForgotModal({ onClose, onSubmit }) {
  const [phone, setPhone] = useState('')
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="auth-modal" onClick={(event) => event.stopPropagation()}>
        <button className="close-button" onClick={onClose}>×</button>
        <p className="eyebrow">PASSWORD RESET</p>
        <h2>Forgot password?</h2>
        <p className="modal-copy">ဖုန်းနံပါတ်ထည့်ပြီး OTP အတည်ပြုခြင်းကို စတင်ပါ။</p>
        <form onSubmit={(event) => { event.preventDefault(); onSubmit({ phone }) }}>
          <input
            required
            inputMode="tel"
            placeholder="Phone number / ဖုန်းနံပါတ်"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
          <button className="primary-button" type="submit">Request OTP <span>↗</span></button>
        </form>
      </div>
    </div>
  )
}

function AccountModal({ user, orders, onClose, onLogout, onOpenWishlist, onOpenMyOrders, language }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="account-modal" onClick={(event) => event.stopPropagation()}>
        <button className="close-button" onClick={onClose}>×</button>
        <span className="account-avatar">{user.name.slice(0, 2).toUpperCase()}</span>
        <p className="eyebrow">HTOO CUSTOMER ACCOUNT</p>
        <h2>{user.name}</h2>
        <p className="modal-copy">{user.phone}<br />{language === 'my' ? `အော်ဒါ ${orders.length} ခု` : `${orders.length} order(s)`}</p>
        <button className="primary-button" style={{ width: '100%', marginBottom: '10px' }} onClick={() => { onClose(); onOpenMyOrders(); }}>
          {language === 'my' ? 'သင့်အော်ဒါများကြည့်ရန် ↗' : 'My Orders ↗'}
        </button>
        <button className="dashboard-button" style={{ marginBottom: '10px' }} onClick={onOpenWishlist}>
          {language === 'my' ? 'သိမ်းဆည်းထားသော ပစ္စည်းများ ↗' : 'Wishlist ↗'}
        </button>
        <button className="dashboard-button" style={{ marginBottom: '10px' }} onClick={() => window.open('https://www.facebook.com/', '_blank', 'noopener,noreferrer')}>
          {language === 'my' ? 'Customer Support' : 'Customer Support'}
        </button>
        <button className="switch-button" onClick={onLogout}>
          {language === 'my' ? 'ထွက်မည်' : 'Log out'}
        </button>
      </div>
    </div>
  )
}

function MyOrdersPage({ orders, user, language, onBack, onSelectOrder, onLogin }) {
  if (!user) {
    return (
      <div className="my-orders-page">
        <header className="checkout-header">
          <button className="back-button" onClick={onBack}>
            ← {language === 'my' ? 'ဆိုင်သို့ပြန်ရန်' : 'Back to shop'}
          </button>
          <a className="brand" href="#top" onClick={onBack}>
            <span className="brand-mark">H</span>
            <div className="brand-title"><strong>HTOO</strong></div>
          </a>
          <span className="checkout-step">{language === 'my' ? 'သင့်အော်ဒါများ' : 'MY ORDERS'}</span>
        </header>
        <main style={{ textAlign: 'center', padding: '60px 20px' }}>
          <h2>{language === 'my' ? 'အကောင့်ဝင်ရန် လိုအပ်ပါသည်' : 'Login Required'}</h2>
          <p className="modal-copy">
            {language === 'my' ? 'သင့်အော်ဒါမှတ်တမ်း ကြည့်ရန် အကောင့်ဝင်ပါ။' : 'Please log in to view your order history.'}
          </p>
          <button className="primary-button" onClick={onLogin}>
            {language === 'my' ? 'ဝင်ရန်' : 'Login'} <span>↗</span>
          </button>
        </main>
      </div>
    )
  }

  const getStatusClass = (status) => {
    const s = String(status || '').toLowerCase()
    if (s === 'delivered') return 'delivered'
    if (s === 'confirmed') return 'confirmed'
    if (s === 'packing') return 'packing'
    if (s === 'shipped') return 'shipped'
    if (s === 'cancelled') return 'cancelled'
    return 'new'
  }

  const getStatusText = (status) => {
    if (language !== 'my') return status
    const map = {
      'New': 'အော်ဒါအသစ်',
      'Confirmed': 'အတည်ပြုပြီး',
      'Packing': 'ထုပ်ပိုးနေသည်',
      'Shipped': 'ပို့ဆောင်နေသည်',
      'Delivered': 'ပို့ဆောင်ပြီး',
      'Cancelled': 'ပယ်ဖျက်ပြီး'
    }
    return map[status] || status
  }

  return (
    <div className="my-orders-page">
      <header className="checkout-header">
        <button className="back-button" onClick={onBack}>
          ← {language === 'my' ? 'ဆိုင်သို့ပြန်ရန်' : 'Back to shop'}
        </button>
        <a className="brand" href="#top" onClick={onBack}>
          <span className="brand-mark">H</span>
          <div className="brand-title"><strong>HTOO</strong></div>
        </a>
        <span className="checkout-step">{language === 'my' ? 'သင့်အော်ဒါများ' : 'MY ORDERS'}</span>
      </header>

      <main className="my-orders-layout">
        <div className="my-orders-header">
          <p className="eyebrow">{language === 'my' ? 'HTOO ဝယ်ယူမှု မှတ်တမ်း' : 'PURCHASE HISTORY'}</p>
          <h1>{language === 'my' ? 'သင့်အော်ဒါများ' : 'My Orders'} ({orders.length})</h1>
        </div>

        {!orders || orders.length === 0 ? (
          <div className="empty-cart" style={{ minHeight: '300px' }}>
            <span>✳</span>
            <p>{language === 'my' ? 'သင့်တွင် အော်ဒါမှတ်တမ်း မရှိသေးပါ။' : 'You have no orders yet.'}</p>
            <button className="primary-button" style={{ marginTop: '20px' }} onClick={onBack}>
              {language === 'my' ? 'ဈေးဝယ်ရန်' : 'Shop Now'} <span>↗</span>
            </button>
          </div>
        ) : (
          <div className="my-orders-list">
            {orders.map((order) => {
              const dateStr = order.createdAt ? new Date(order.createdAt).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''
              const itemCount = order.items ? order.items.reduce((sum, item) => sum + item.quantity, 0) : 0
              return (
                <div key={order.id || order.orderNumber} className="my-order-card" onClick={() => onSelectOrder(order)}>
                  <div className="my-order-card-head">
                    <div>
                      <div className="my-order-num">{order.orderNumber || order.id}</div>
                      <div className="my-order-date">{dateStr}</div>
                    </div>
                    <span className={`status-badge ${getStatusClass(order.status)}`}>
                      {getStatusText(order.status)}
                    </span>
                  </div>

                  <div className="my-order-items-preview">
                    {order.items?.map((item, idx) => (
                      <img key={idx} className="my-order-thumb" src={item.image} alt={item.name} title={`${item.quantity}x ${item.name}`} />
                    ))}
                  </div>

                  <div className="my-order-summary-row">
                    <div>
                      <small style={{ color: 'var(--muted)', display: 'block' }}>
                        {language === 'my' ? `ပစ္စည်း ${itemCount} ခု` : `${itemCount} item(s)`} · {order.paymentMethod}
                      </small>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span className="my-order-total">{formatPrice(order.total)}</span>
                      <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--green-primary)' }}>↗</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

function CustomerOrderDetailPage({ order, language, onBack }) {
  const [chat, setChat] = useState({ messages: [] })
  const [draft, setDraft] = useState('')
  const [imageData, setImageData] = useState('')
  const [loadedOrderId, setLoadedOrderId] = useState('')
  const [chatError, setChatError] = useState('')
  const orderId = order?.id || ''
  const loadingChat = Boolean(orderId) && loadedOrderId !== orderId

  useEffect(() => {
    if (!orderId) return undefined

    let active = true
    async function loadChat() {
      try {
        const response = await fetch(`/api/orders/${orderId}/chat`)
        if (!response.ok) throw new Error('Unable to load chat.')
        const result = await response.json()
        if (active) {
          setChat(result.chat || { messages: [] })
          setLoadedOrderId(orderId)
          setChatError('')
        }
      } catch {
        if (active) {
          setChat({ messages: [] })
          setLoadedOrderId(orderId)
        }
      }
    }
    loadChat()
    fetch(`/api/orders/${orderId}/chat/read`, { method: 'POST' }).catch(() => {})
    return () => { active = false }
  }, [orderId])

  if (!order) return null

  const getStatusClass = (status) => {
    const s = String(status || '').toLowerCase()
    if (s === 'delivered') return 'delivered'
    if (s === 'confirmed') return 'confirmed'
    if (s === 'packing') return 'packing'
    if (s === 'shipped') return 'shipped'
    if (s === 'cancelled') return 'cancelled'
    return 'new'
  }

  const getStatusText = (status) => {
    if (language !== 'my') return status
    const map = {
      'New': 'အော်ဒါအသစ်',
      'Confirmed': 'အတည်ပြုပြီး',
      'Packing': 'ထုပ်ပိုးနေသည်',
      'Shipped': 'ပို့ဆောင်နေသည်',
      'Delivered': 'ပို့ဆောင်ပြီး',
      'Cancelled': 'ပယ်ဖျက်ပြီး'
    }
    return map[status] || status
  }

  const getPaymentStatusText = (status) => {
    if (language !== 'my') return status
    const map = {
      'Not Required': 'မလိုပါ (COD)',
      'Pending Verification': 'စစ်ဆေးဆဲ',
      'Verified': 'အတည်ပြုပြီး',
      'Rejected': 'ငြင်းပယ်ထားသည်'
    }
    return map[status] || status
  }

  const dateStr = order.createdAt ? new Date(order.createdAt).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''
  const itemSubtotalSum = order.items ? order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0) : 0
  const subtotal = order.subtotal || itemSubtotalSum
  const deliveryFee = order.deliveryFee || 0

  async function sendMessage(overrideText) {
    const text = (typeof overrideText === 'string' ? overrideText : draft).trim()
    if (!text && !imageData) return
    try {
      setChatError('')
      const response = await fetch(`/api/orders/${order.id}/chat/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, image: imageData || undefined })
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to send message.')
      setChat((current) => ({ ...current, messages: [...(current.messages || []), result.message] }))
      setDraft('')
      setImageData('')
    } catch (error) {
      setChatError(error.message)
    }
  }

  function handleImageChange(event) {
    const file = event.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => setImageData(String(reader.result || ''))
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  return (
    <div className="order-detail-page">
      <header className="checkout-header">
        <button className="back-button" onClick={onBack}>
          ← {language === 'my' ? 'သင့်အော်ဒါများသို့ပြန်ရန်' : 'Back to My Orders'}
        </button>
        <a className="brand" href="#top" onClick={onBack}>
          <span className="brand-mark">H</span>
          <div className="brand-title"><strong>HTOO</strong></div>
        </a>
        <span className="checkout-step">{language === 'my' ? 'အော်ဒါအသေးစိတ်' : 'ORDER DETAILS'}</span>
      </header>

      <main className="order-detail-layout">
        <section className="order-detail-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <p className="eyebrow" style={{ margin: 0 }}>
                {language === 'my' ? 'အော်ဒါ / ပြေစာ နံပါတ်' : 'ORDER / INVOICE NUMBER'}
              </p>
              <h2 style={{ fontFamily: 'DM Mono, monospace', fontSize: '24px', margin: '4px 0 6px', fontWeight: '800' }}>
                {order.orderNumber || order.id}
              </h2>
              <div style={{ color: 'var(--muted)', fontSize: '11px' }}>
                {language === 'my' ? 'မှာယူသည့် ရက်စွဲ - ' : 'Order Date & Time: '} {dateStr}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className={`status-badge ${getStatusClass(order.status)}`}>
                {getStatusText(order.status)}
              </span>
            </div>
          </div>
        </section>

        <section className="order-detail-card">
          <h3>{language === 'my' ? 'ဝယ်ယူထားသော ပစ္စည်းများ' : 'PURCHASED PRODUCTS'}</h3>
          <div className="order-items-list">
            {order.items?.map((item, idx) => (
              <div key={idx} className="order-item-row">
                <img src={item.image} alt={item.name} />
                <div className="order-item-info">
                  <strong>{item.name}</strong>
                  {item.store && <small>{item.store}</small>}
                </div>
                <div className="order-item-qty">
                  {language === 'my' ? `အရေအတွက် - ${item.quantity}` : `Qty: ${item.quantity}`} × {formatPrice(item.price)}
                </div>
                <div className="order-item-price">
                  {formatPrice(item.price * item.quantity)}
                </div>
              </div>
            ))}
          </div>

          <div className="order-cost-breakdown">
            <div className="order-cost-row">
              <span>{language === 'my' ? 'ပစ္စည်းဖိုး စုစုပေါင်း' : 'Items Subtotal'}</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            <div className="order-cost-row">
              <span>{language === 'my' ? 'ပို့ဆောင်ခ' : 'Delivery Fee'}</span>
              <span>{formatPrice(deliveryFee)}</span>
            </div>
            <div className="order-cost-row grand-total">
              <span>{language === 'my' ? 'စုစုပေါင်း ကျသင့်ငွေ' : 'Total Amount'}</span>
              <span>{formatPrice(order.total)}</span>
            </div>
          </div>
        </section>

        <section className="order-detail-card">
          <h3>{language === 'my' ? 'ပို့ဆောင်ရေး အချက်အလက်များ' : 'DELIVERY & CUSTOMER DETAILS'}</h3>
          <div className="order-info-grid">
            <div className="order-info-group">
              <small className="eyebrow" style={{ display: 'block', marginBottom: '4px' }}>
                {language === 'my' ? 'ဝယ်ယူသူ အချက်အလက်' : 'CUSTOMER INFO'}
              </small>
              <p>
                <strong>{order.customer?.name}</strong><br />
                📞 {order.customer?.phone}
              </p>
            </div>
            <div className="order-info-group">
              <small className="eyebrow" style={{ display: 'block', marginBottom: '4px' }}>
                {language === 'my' ? 'ပို့ဆောင်ရန် လိပ်စာ' : 'DELIVERY ADDRESS'}
              </small>
              <p>{order.customer?.address}</p>
            </div>
            <div className="order-info-group">
              <small className="eyebrow" style={{ display: 'block', marginBottom: '4px' }}>
                {language === 'my' ? 'ပို့ဆောင်ရေး နည်းလမ်း' : 'DELIVERY METHOD'}
              </small>
              <p><strong>{order.deliveryMethod || (language === 'my' ? 'HTOO Standard Delivery ပို့ဆောင်ရေး' : 'HTOO Standard Delivery')}</strong></p>
            </div>
            <div className="order-info-group">
              <small className="eyebrow" style={{ display: 'block', marginBottom: '4px' }}>
                {language === 'my' ? 'မှတ်ချက်' : 'ORDER NOTE'}
              </small>
              <p>{order.customer?.note || (language === 'my' ? 'မှတ်ချက်မရှိပါ' : 'No note provided')}</p>
            </div>
          </div>
        </section>

        <section className="order-detail-card">
          <h3>{language === 'my' ? 'ငွေပေးချေမှု အချက်အလက်များ' : 'PAYMENT DETAILS'}</h3>
          <div className="order-info-grid">
            <div className="order-info-group">
              <small className="eyebrow" style={{ display: 'block', marginBottom: '4px' }}>
                {language === 'my' ? 'ငွေပေးချေမှု နည်းလမ်း' : 'PAYMENT METHOD'}
              </small>
              <p><strong>{order.paymentMethod}</strong></p>
            </div>
            <div className="order-info-group">
              <small className="eyebrow" style={{ display: 'block', marginBottom: '4px' }}>
                {language === 'my' ? 'ငွေပေးချေမှု အခြေအနေ' : 'PAYMENT STATUS'}
              </small>
              <p><strong>{getPaymentStatusText(order.paymentStatus)}</strong></p>
            </div>
          </div>

          {order.receipt?.dataUrl && (
            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--line)' }}>
              <small className="eyebrow" style={{ display: 'block', marginBottom: '8px' }}>
                {language === 'my' ? 'တင်သွင်းထားသော ငွေလွှဲပြေစာ' : 'PAYMENT RECEIPT SLIP'}
              </small>
              <img src={order.receipt.dataUrl} alt="Uploaded payment receipt" style={{ maxWidth: '240px', borderRadius: '8px', border: '1px solid var(--line)' }} />
            </div>
          )}
        </section>

        <section className="order-detail-card order-chat-card">
          <div className="order-chat-header">
            <div>
              <p className="eyebrow" style={{ margin: 0 }}>{language === 'my' ? 'အော်ဒါစာတိုက်' : 'ORDER CHAT'}</p>
              <h3>{language === 'my' ? 'ဆိုင်ရှင်နှင့် ဆက်သွယ်ရန်' : 'Chat with the shop owner'}</h3>
            </div>
            <span className="order-chat-badge">{order.orderNumber || order.id}</span>
          </div>

          {loadingChat ? <div className="chat-loading">Loading...</div> : (
            <>
              <div className="chat-thread">
                {(chat.messages || []).length ? (chat.messages || []).map((message) => (
                  <div key={message.id} className={`chat-message ${message.senderRole === 'customer' ? 'customer' : 'admin'}`}>
                    <div className="chat-bubble">
                      {message.image && <img src={message.image} alt="Chat attachment" className="chat-image" />}
                      {message.text && <p>{message.text}</p>}
                      <small>{new Date(message.createdAt).toLocaleString()}</small>
                    </div>
                  </div>
                )) : <div className="chat-empty">{language === 'my' ? 'မက်ဆေ့ချ်မရှိသေးပါ။' : 'No messages yet.'}</div>}
              </div>

              <div className="chat-composer">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  rows={3}
                  placeholder={language === 'my' ? 'မက်ဆေ့ချ် ရိုက်ပါ...' : 'Type a message...'}
                />
                <div className="chat-actions-row">
                  <button
                    className="chat-quick-reply"
                    type="button"
                    onClick={() => sendMessage(language === 'my' ? 'ပစ္စည်းရောက်ပါပြီ' : 'The package has arrived.')}
                  >
                    {language === 'my' ? '📦 ပစ္စည်းရောက်ပါပြီ' : '📦 Arrived'}
                  </button>
                  <label className="image-upload-button">
                    <input type="file" accept="image/*" onChange={handleImageChange} />
                    {language === 'my' ? 'ပုံတင်ရန်' : 'Image'}
                  </label>
                  <button className="primary-button" type="button" onClick={() => sendMessage()}>
                    {language === 'my' ? 'ပို့မည်' : 'Send'}
                  </button>
                </div>
                {imageData && <img src={imageData} alt="Selected chat attachment" className="chat-preview" />}
                {chatError && <div className="chat-error">{chatError}</div>}
              </div>
            </>
          )}
        </section>

        <div className="order-actions-bar">
          <button className="primary-button" onClick={() => downloadInvoiceImage(order, language)}>
            {language === 'my' ? '📥 ဘောင်ချာ Download (PNG)' : '📥 Download Invoice (PNG)'}
          </button>
          <button className="secondary-button" onClick={() => window.print()}>
            {language === 'my' ? 'ပရင့်ထုတ်ရန်' : 'Print Invoice'}
          </button>
          <button className="secondary-button" onClick={onBack}>
            ← {language === 'my' ? 'အော်ဒါများစာရင်းသို့' : 'Back to My Orders'}
          </button>
        </div>
      </main>
    </div>
  )
}

function WishlistDrawer({ products, liked, onClose, onRemove, onAddToCart, language }) {
  const savedProducts = products.filter((p) => liked.includes(p.id))
  return (
    <div className="cart-overlay" onClick={onClose}>
      <aside className="cart-drawer" onClick={(event) => event.stopPropagation()}>
        <div className="drawer-heading">
          <div>
            <p className="eyebrow">{language === 'my' ? 'သိမ်းဆည်းထားသည်' : 'SAVED ITEMS'}</p>
            <h2>{language === 'my' ? 'သိမ်းဆည်းထားသော ပစ္စည်းများ' : 'Wishlist'} <span>({savedProducts.length})</span></h2>
          </div>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        {!savedProducts.length ? (
          <div className="empty-cart">
            <span>♥</span>
            <p>{language === 'my' ? 'သိမ်းဆည်းထားသော ပစ္စည်းမရှိသေးပါ။' : 'Your wishlist is empty.'}</p>
          </div>
        ) : (
          <>
            {savedProducts.map((item) => (
              <div className="cart-item" key={item.id}>
                <img src={item.image} alt="" />
                <div>
                  <strong>{item.name}</strong>
                  <small>{item.store} · {formatPrice(item.price)}</small>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <button
                      className="add-button"
                      style={{ fontSize: '11px', padding: '4px 10px', height: 'auto', minHeight: '30px', width: 'auto', borderRadius: '5px' }}
                      disabled={!item.stock}
                      onClick={() => onAddToCart(item)}
                    >
                      {item.stock ? (language === 'my' ? '+ ခြင်းထဲထည့်ရန်' : '+ Add') : (language === 'my' ? 'ကုန်ပြီ' : 'Sold out')}
                    </button>
                    <button className="remove-item" onClick={() => onRemove(item.id)}>
                      {language === 'my' ? 'ဖယ်ရှားရန်' : 'Remove'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </aside>
    </div>
  )
}

function CartDrawer({ cart, total, onClose, updateQuantity, onCheckout, language }) {
  const deliveryFee = cart.length ? 3 : 0
  return (
    <div className="cart-overlay" onClick={onClose}>
      <aside className="cart-drawer" onClick={(event) => event.stopPropagation()}>
        <div className="drawer-heading">
          <div>
            <p className="eyebrow">{language === 'my' ? 'သင့်ဈေးခြင်း' : 'YOUR CART'}</p>
            <h2>{language === 'my' ? 'ဈေးခြင်း' : 'Cart'} <span>({cart.reduce((sum, item) => sum + item.quantity, 0)})</span></h2>
          </div>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        {!cart.length ? (
          <div className="empty-cart">
            <span>✳</span>
            <p>{language === 'my' ? 'သင့်ဈေးခြင်းတွင် ပစ္စည်းထည့်ပါ။' : 'Your cart is empty.'}</p>
          </div>
        ) : (
          <>
            {cart.map((item) => (
              <div className="cart-item" key={item.id}>
                <img src={item.image} alt="" />
                <div>
                  <strong>{item.name}</strong>
                  <small>{item.store}</small>
                  <div className="quantity">
                    <button onClick={() => updateQuantity(item.id, -1)}>-</button>
                    <span>{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, 1)}>+</button>
                  </div>
                  <button className="remove-item" onClick={() => updateQuantity(item.id, -item.quantity)}>
                    {language === 'my' ? 'ဖယ်ရှားရန်' : 'Remove'}
                  </button>
                </div>
                <b>{formatPrice(item.price * item.quantity)}</b>
              </div>
            ))}
            <div className="cart-total">
              <span>{language === 'my' ? 'ပစ္စည်းဖိုး' : 'Subtotal'}</span>
              <strong>{formatPrice(total)}</strong>
              <span>{language === 'my' ? 'ပို့ဆောင်ခ' : 'Delivery Fee'}</span>
              <strong>{formatPrice(deliveryFee)}</strong>
              <span className="grand-total-label">{language === 'my' ? 'စုစုပေါင်း' : 'Total'}</span>
              <strong className="grand-total">{formatPrice(total + deliveryFee)}</strong>
            </div>
            <button className="checkout-button" onClick={onCheckout}>
              {language === 'my' ? 'အော်ဒါတင်ရန်' : 'Proceed to Checkout'} <span>↗</span>
            </button>
          </>
        )}
      </aside>
    </div>
  )
}

function ProductDetail({ product, language, onBack, onAdd, onBuy }) {
  const [quantity, setQuantity] = useState(1)
  return (
    <div className="product-detail-page">
      <header className="checkout-header">
        <button className="back-button" onClick={onBack}>
          ← {language === 'my' ? 'ဆိုင်သို့ပြန်ရန်' : 'Back to shop'}
        </button>
        <a className="brand" href="#top">
          <span className="brand-mark">H</span>
          <div className="brand-title"><strong>HTOO</strong></div>
        </a>
        <span className="checkout-step">{language === 'my' ? 'ပစ္စည်းအသေးစိတ်' : 'PRODUCT DETAILS'}</span>
      </header>
      <main className="product-detail-layout">
        <div className={`detail-image ${product.tone || ''}`}>
          <img src={product.image} alt={product.name} />
        </div>
        <section className="detail-copy">
          <p className="store-name">{product.store} · {product.category}</p>
          <h1>{product.name}</h1>
          <div className="detail-prices">
            <strong>{formatPrice(product.price)}</strong>
            {product.oldPrice && <del>{formatPrice(product.oldPrice)}</del>}
          </div>
          <p className="stock-label">
            {product.stock > 0
              ? (language === 'my' ? `လက်ကျန် ${product.stock} ခုရှိပါသည်` : `In Stock: ${product.stock} item(s)`)
              : (language === 'my' ? 'ပစ္စည်းကုန်ပြီ' : 'Sold out')}
          </p>
          <p className="detail-description">
            {product.description || (language === 'my' ? 'နေ့စဉ်အသုံးပြုရန် အရည်အသွေးကောင်းမွန်ပြီး စိတ်ချစွာ ဝယ်ယူနိုင်သော ပစ္စည်းဖြစ်ပါသည်။' : 'High quality product carefully curated for your everyday needs.')}
          </p>
          <div className="detail-quantity">
            <span>{language === 'my' ? 'အရေအတွက်' : 'Quantity'}</span>
            <button onClick={() => setQuantity(Math.max(1, quantity - 1))}>−</button>
            <b>{quantity}</b>
            <button onClick={() => setQuantity(Math.min(product.stock || 1, quantity + 1))}>+</button>
          </div>
          <div className="detail-actions">
            <button
              className="secondary-button"
              disabled={!product.stock}
              onClick={() => {
                for (let index = 0; index < quantity; index += 1) onAdd()
              }}
            >
              {language === 'my' ? 'ခြင်းထဲထည့်မည်' : 'Add to Cart'}
            </button>
            <button
              className="primary-button"
              disabled={!product.stock}
              onClick={() => onBuy(quantity)}
            >
              {language === 'my' ? 'အခုပဲဝယ်မည်' : 'Buy Now'} <span>↗</span>
            </button>
          </div>
        </section>
      </main>
    </div>
  )
}

function CheckoutPage({ cart, subtotal, carGatePickupFee, user, language, enabledPayments, paymentAccounts = {}, onBack, onPlaceOrder }) {
  const [values, setValues] = useState({
    name: user?.name || '',
    phone: '',
    address: '',
    note: '',
    paymentMethod: 'cod',
    deliveryMethod: 'standard',
    receipt: null
  })
  const [uploadError, setUploadError] = useState('')
  const availablePaymentMethods = PAYMENT_METHODS.filter((method) => method.id === 'cod' || enabledPayments.some((payment) => payment.id === method.id))
  const isDigitalPayment = values.paymentMethod !== 'cod'
  const payment = PAYMENT_METHODS.find((method) => method.id === values.paymentMethod) || PAYMENT_METHODS[0]
  const deliveryFee = values.deliveryMethod === 'cargate' ? Number(carGatePickupFee || 0) : (cart.length ? 3 : 0)
  const total = subtotal + deliveryFee
  const update = (key, value) => setValues({ ...values, [key]: value })

  function selectReceipt(event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setUploadError(language === 'my' ? 'JPG, JPEG သို့မဟုတ် PNG ပုံဖိုင်သာ တင်နိုင်ပါသည်။' : 'Only JPG, JPEG or PNG images are allowed.')
      event.target.value = ''
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError(language === 'my' ? 'ပုံဖိုင်အရွယ်အစားသည် 5MB ထက် မကျော်ရပါ။' : 'Image size must be less than 5MB.')
      event.target.value = ''
      return
    }
    setUploadError('')
    const reader = new FileReader()
    reader.onload = () => update('receipt', { name: file.name, type: file.type, size: file.size, dataUrl: reader.result })
    reader.readAsDataURL(file)
  }

  function submit(event) {
    event.preventDefault()
    if (isDigitalPayment && !values.receipt) {
      setUploadError(language === 'my' ? 'ဒီငွေပေးချေမှုအတွက် ငွေလွှဲပြေစာ ပုံတင်ပေးပါ။' : 'Please upload payment slip for digital payment.')
      return
    }
    onPlaceOrder(values)
  }

  return (
    <div className="checkout-page">
      <header className="checkout-header">
        <button className="back-button" onClick={onBack}>
          ← {language === 'my' ? 'ဆိုင်သို့ပြန်ရန်' : 'Back to shop'}
        </button>
        <a className="brand" href="#top">
          <span className="brand-mark">H</span>
          <div className="brand-title"><strong>HTOO</strong></div>
        </a>
        <span className="checkout-step">{language === 'my' ? 'အော်ဒါမှာယူရန်' : 'CHECKOUT'}</span>
      </header>

      <main className="checkout-layout">
        <section>
          <p className="eyebrow">{language === 'my' ? 'ပို့ဆောင်ရန် အချက်အလက်' : 'DELIVERY DETAILS'}</p>
          <h1>{language === 'my' ? 'အော်ဒါဖြည့်စွက်ရန်' : 'Complete your order'}</h1>
          <p className="burmese-copy">{language === 'my' ? 'ပို့ဆောင်ရမည့် အချက်အလက်များ ပြည့်စုံစွာ ဖြည့်ပေးပါ။' : 'Please provide accurate delivery info.'}</p>

          <form className="checkout-form" onSubmit={submit}>
            <label>
              {language === 'my' ? 'ဝယ်ယူသူ အမည်' : 'Customer Name'} *
              <input required value={values.name} onChange={(event) => update('name', event.target.value)} />
            </label>

            <label>
              {language === 'my' ? 'ဖုန်းနံပါတ်' : 'Phone Number'} *
              <input
                required
                inputMode="tel"
                pattern="(?:\+?95|0)[0-9\s()-]{7,13}"
                value={values.phone}
                onChange={(event) => update('phone', event.target.value)}
                placeholder="09..."
              />
            </label>

            <label>
              {language === 'my' ? 'ပို့ဆောင်ရမည့် လိပ်စာ' : 'Delivery Address'} *
              <textarea
                required
                rows="3"
                value={values.address}
                onChange={(event) => update('address', event.target.value)}
                placeholder={language === 'my' ? 'မြို့နယ်၊ လမ်း၊ အိမ်အမှတ်...' : 'Township, street, house number...'}
              />
            </label>

            <label>
              {language === 'my' ? 'မှတ်ချက် (ရွေးချယ်ရန်)' : 'Order Note (Optional)'}
              <input value={values.note} onChange={(event) => update('note', event.target.value)} />
            </label>

            <fieldset>
              <legend>{language === 'my' ? 'ပို့ဆောင်ရေး ရွေးချယ်မှု' : 'DELIVERY OPTION'}</legend>
              <div className="payment-methods">
                {DELIVERY_METHODS.map((method) => (
                  <label
                    key={method.id}
                    className={`payment-choice ${values.deliveryMethod === method.id ? 'selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="deliveryMethod"
                      value={method.id}
                      checked={values.deliveryMethod === method.id}
                      onChange={(event) => update('deliveryMethod', event.target.value)}
                    />
                    <strong>{language === 'my' ? method.labelMy : method.labelEn}</strong>
                    <span>+{formatPrice(method.id === 'cargate' ? carGatePickupFee : (cart.length ? 3 : 0))}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend>{language === 'my' ? 'ငွေပေးချေမှု နည်းလမ်း' : 'PAYMENT METHOD'}</legend>
              <div className="payment-methods">
                {availablePaymentMethods.map((method) => (
                  <label
                    key={method.id}
                    className={`payment-choice ${values.paymentMethod === method.id ? 'selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={method.id}
                      checked={values.paymentMethod === method.id}
                      onChange={(event) => update('paymentMethod', event.target.value)}
                    />
                    <strong>{language === 'my' ? method.label : method.english}</strong>
                    <span>{method.digital ? 'Digital' : 'Cash'}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {isDigitalPayment && paymentAccounts[values.paymentMethod] && (
              <div className="payment-account">
                <p className="eyebrow">{payment.label} {language === 'my' ? 'လွှဲရမည့် အကောင့်' : 'Account Details'}</p>
                <strong>{paymentAccounts[values.paymentMethod].accountName || 'HTOO Shop Official'}</strong>
                <span>
                  {paymentAccounts[values.paymentMethod].accountNumber || '09-123456789'}
                  {paymentAccounts[values.paymentMethod].bankName && ` · ${paymentAccounts[values.paymentMethod].bankName}`}
                </span>
              </div>
            )}

            {isDigitalPayment && (
              <div className="receipt-upload">
                <label>
                  {language === 'my' ? 'ငွေလွှဲပြေစာ ပုံတင်ပေးပါ' : 'Upload Payment Slip / Receipt'} *
                  <input required={!values.receipt} type="file" accept="image/jpeg,image/png" onChange={selectReceipt} />
                </label>
                {uploadError && <div className="upload-error">{uploadError}</div>}
                {values.receipt && (
                  <div className="receipt-preview">
                    <img src={values.receipt.dataUrl} alt="Receipt preview" />
                    <span>{values.receipt.name}</span>
                  </div>
                )}
              </div>
            )}

            <button className="primary-button place-order-button" type="submit">
              {language === 'my' ? 'အော်ဒါ အတည်ပြုတင်မည်' : 'Place Order Now'} <span>↗</span>
            </button>
          </form>
        </section>

        <OrderSummary cart={cart} subtotal={subtotal} deliveryFee={deliveryFee} total={total} payment={payment} language={language} />
      </main>
    </div>
  )
}

function OrderSummary({ cart, subtotal, deliveryFee, total, payment, language }) {
  return (
    <aside className="order-summary">
      <p className="eyebrow">{language === 'my' ? 'မှာယူထားသော စာရင်း' : 'ORDER SUMMARY'}</p>
      <h2>{language === 'my' ? 'ရွေးချယ်ထားသော ပစ္စည်းများ' : 'Your items'}</h2>
      {cart.map((item) => (
        <div className="summary-item" key={item.id}>
          <img src={item.image} alt="" />
          <div>
            <strong>{item.name}</strong>
            <small>Qty {item.quantity}</small>
          </div>
          <b>{formatPrice(item.price * item.quantity)}</b>
        </div>
      ))}
      <div className="summary-total">
        <span>{language === 'my' ? 'ကုန်ပစ္စည်း စုစုပေါင်း' : 'Subtotal'}</span>
        <strong>{formatPrice(subtotal)}</strong>
      </div>
      <div className="summary-total">
        <span>{language === 'my' ? 'ပို့ဆောင်ခ' : 'Delivery Fee'}</span>
        <strong>{formatPrice(deliveryFee)}</strong>
      </div>
      <div className="summary-total">
        <span>{language === 'my' ? 'စုစုပေါင်း' : 'Total'}</span>
        <strong>{formatPrice(total)}</strong>
      </div>
      <small className="cod-note">
        Payment: {payment.label}<br />
        {payment.digital ? (language === 'my' ? 'ငွေလွှဲပြီး ပြေစာကို စစ်ဆေးပြီးမှ အတည်ပြုပါမည်။' : 'Payment slip will be verified by admin.') : (language === 'my' ? 'Cash on Delivery · ပစ္စည်းရောက်မှ ငွေချေမည်' : 'Cash on Delivery')}
      </small>
    </aside>
  )
}

function OrderSuccess({ order, language, onContinue, onViewOrder, onMyOrders }) {
  if (!order) return null
  return (
    <div className="success-page">
      <div className="success-mark">✓</div>
      <p className="eyebrow">{language === 'my' ? 'ဝယ်ယူမှုအောင်မြင်ပါသည်' : 'ORDER CONFIRMED'}</p>
      <h1>{language === 'my' ? `ကျေးဇူးတင်ပါတယ်၊ ${order.customer.name.split(' ')[0]}။` : `Thank you, ${order.customer.name.split(' ')[0]}!`}</h1>
      <p className="success-copy">
        {language === 'my'
          ? `အော်ဒါနံပါတ် ${order.orderNumber} ကို လက်ခံရရှိပါပြီ။ ပို့ဆောင်ရေး အဆင်ပြေစေရန် မကြာမီ ဆက်သွယ်ပေးပါမည်။`
          : `We received your order #${order.orderNumber}. We will contact you soon for delivery.`}
      </p>

      <div className="success-card">
        <div>
          <small>{language === 'my' ? 'ဘောင်ချာနံပါတ်' : 'ORDER NUMBER'}</small>
          <strong>{order.orderNumber}</strong>
        </div>
        <div className="success-details">
          <span>{order.items.reduce((sum, item) => sum + item.quantity, 0)} items</span>
          <span>{order.paymentMethod}</span>
          <b>{formatPrice(order.total)}</b>
        </div>
      </div>

      <div className="success-items">
        {order.items.map((item) => (
          <div key={item.id}>
            <span>{item.quantity} × {item.name}</span>
            <b>{formatPrice(item.price * item.quantity)}</b>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '24px', flexWrap: 'wrap' }}>
        <button className="primary-button" onClick={() => downloadInvoiceImage(order, language)}>
          {language === 'my' ? '📥 ဘောင်ချာ Download' : '📥 Download Invoice'}
        </button>
        <button className="primary-button" onClick={() => onViewOrder(order)}>
          {language === 'my' ? 'အော်ဒါအသေးစိတ် ကြည့်မည်' : 'View Order Details'} <span>↗</span>
        </button>
        <button className="secondary-button" onClick={onMyOrders}>
          {language === 'my' ? 'သင့်အော်ဒါများသို့' : 'My Orders'}
        </button>
        <button className="secondary-button" onClick={onContinue}>
          {language === 'my' ? 'ဆက်လက်ဈေးဝယ်မည်' : 'Continue Shopping'}
        </button>
      </div>
    </div>
  )
}

export default App
