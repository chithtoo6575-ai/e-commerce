import React from 'react'

// Lightweight, crisp, consistent outline SVG icons
const baseProps = {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

export function IconDashboard({ size = 18, className = '' }) {
  return (
    <svg {...baseProps} width={size} height={size} className={className}>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  )
}

export function IconProducts({ size = 18, className = '' }) {
  return (
    <svg {...baseProps} width={size} height={size} className={className}>
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  )
}

export function IconCategories({ size = 18, className = '' }) {
  return (
    <svg {...baseProps} width={size} height={size} className={className}>
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  )
}

export function IconSubCategories({ size = 18, className = '' }) {
  return (
    <svg {...baseProps} width={size} height={size} className={className}>
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
      <path d="M12 10v4" />
      <path d="M10 12h4" />
    </svg>
  )
}

export function IconStockMovements({ size = 18, className = '' }) {
  return (
    <svg {...baseProps} width={size} height={size} className={className}>
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <path d="M3 21v-5h5" />
      <path d="M12 8v4l3 2" />
    </svg>
  )
}

export function IconBannerImages({ size = 18, className = '' }) {
  return (
    <svg {...baseProps} width={size} height={size} className={className}>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  )
}

export function IconHomeSections({ size = 18, className = '' }) {
  return (
    <svg {...baseProps} width={size} height={size} className={className}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18" />
      <path d="M3 15h18" />
      <path d="M9 9v6" />
    </svg>
  )
}

export function IconHomeLayout({ size = 18, className = '' }) {
  return (
    <svg {...baseProps} width={size} height={size} className={className}>
      <rect x="3" y="3" width="18" height="7" rx="1" />
      <rect x="3" y="14" width="8" height="7" rx="1" />
      <rect x="13" y="14" width="8" height="7" rx="1" />
    </svg>
  )
}

export function IconOrders({ size = 18, className = '' }) {
  return (
    <svg {...baseProps} width={size} height={size} className={className}>
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <path d="M9 11h6" />
      <path d="M9 15h6" />
      <path d="M9 19h4" />
    </svg>
  )
}

export function IconShippingRates({ size = 18, className = '' }) {
  return (
    <svg {...baseProps} width={size} height={size} className={className}>
      <path d="M5 18H3c-.6 0-1-.4-1-1V7c0-.6.4-1 1-1h10c.6 0 1 .4 1 1v11" />
      <path d="M14 9h4l4 4v4c0 .6-.4 1-1 1h-2" />
      <circle cx="7" cy="18" r="2" />
      <path d="M9 18h5" />
      <circle cx="17" cy="18" r="2" />
    </svg>
  )
}

export function IconDeliveryCompanies({ size = 18, className = '' }) {
  return (
    <svg {...baseProps} width={size} height={size} className={className}>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01" />
      <path d="M16 6h.01" />
      <path d="M12 6h.01" />
      <path d="M12 10h.01" />
      <path d="M12 14h.01" />
      <path d="M16 10h.01" />
      <path d="M16 14h.01" />
      <path d="M8 10h.01" />
      <path d="M8 14h.01" />
    </svg>
  )
}

export function IconPaymentMethods({ size = 18, className = '' }) {
  return (
    <svg {...baseProps} width={size} height={size} className={className}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
      <line x1="6" y1="15" x2="10" y2="15" />
    </svg>
  )
}

export function IconCustomers({ size = 18, className = '' }) {
  return (
    <svg {...baseProps} width={size} height={size} className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

export function IconNotifications({ size = 18, className = '' }) {
  return (
    <svg {...baseProps} width={size} height={size} className={className}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  )
}

export function IconSupportChannels({ size = 18, className = '' }) {
  return (
    <svg {...baseProps} width={size} height={size} className={className}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M8 10h.01" />
      <path d="M12 10h.01" />
      <path d="M16 10h.01" />
    </svg>
  )
}

export function IconHelpItems({ size = 18, className = '' }) {
  return (
    <svg {...baseProps} width={size} height={size} className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

export function IconSearch({ size = 16, className = '' }) {
  return (
    <svg {...baseProps} width={size} height={size} className={className}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

export function IconPlus({ size = 16, className = '' }) {
  return (
    <svg {...baseProps} width={size} height={size} className={className}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

export function IconEdit({ size = 15, className = '' }) {
  return (
    <svg {...baseProps} width={size} height={size} className={className}>
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  )
}

export function IconTrash({ size = 15, className = '' }) {
  return (
    <svg {...baseProps} width={size} height={size} className={className}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}

export function IconEye({ size = 15, className = '' }) {
  return (
    <svg {...baseProps} width={size} height={size} className={className}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

export function IconChevronDown({ size = 16, className = '' }) {
  return (
    <svg {...baseProps} width={size} height={size} className={className}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

export function IconChevronUp({ size = 16, className = '' }) {
  return (
    <svg {...baseProps} width={size} height={size} className={className}>
      <polyline points="18 15 12 9 6 15" />
    </svg>
  )
}

export function IconCheck({ size = 16, className = '' }) {
  return (
    <svg {...baseProps} width={size} height={size} className={className}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export function IconX({ size = 16, className = '' }) {
  return (
    <svg {...baseProps} width={size} height={size} className={className}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

export function IconArrowUpRight({ size = 14, className = '' }) {
  return (
    <svg {...baseProps} width={size} height={size} className={className}>
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="7 7 17 7 17 17" />
    </svg>
  )
}

export function IconTrendingUp({ size = 14, className = '' }) {
  return (
    <svg {...baseProps} width={size} height={size} className={className}>
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  )
}

export function IconMenu({ size = 20, className = '' }) {
  return (
    <svg {...baseProps} width={size} height={size} className={className}>
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}

export function IconSidebarCollapse({ size = 18, className = '' }) {
  return (
    <svg {...baseProps} width={size} height={size} className={className}>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <polyline points="15 9 12 12 15 15" />
    </svg>
  )
}

export function IconSidebarExpand({ size = 18, className = '' }) {
  return (
    <svg {...baseProps} width={size} height={size} className={className}>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <polyline points="12 9 15 12 12 15" />
    </svg>
  )
}

export function IconLogout({ size = 16, className = '' }) {
  return (
    <svg {...baseProps} width={size} height={size} className={className}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

export function IconFilter({ size = 16, className = '' }) {
  return (
    <svg {...baseProps} width={size} height={size} className={className}>
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  )
}

export function IconDownload({ size = 16, className = '' }) {
  return (
    <svg {...baseProps} width={size} height={size} className={className}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

export function IconRefresh({ size = 16, className = '' }) {
  return (
    <svg {...baseProps} width={size} height={size} className={className}>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  )
}
