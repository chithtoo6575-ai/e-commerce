import React from 'react'
import { adminT } from '../adminI18n'

export default function Badge({ variant = 'default', children, size = 'md' }) {
  // Normalize variants:
  // success, warning, danger, info, neutral, gold
  let normalizedVariant = variant
  const lower = String(children || variant).toLowerCase()

  if (['active', 'delivered', 'verified', 'completed', 'sent', 'stock in'].includes(lower)) {
    normalizedVariant = 'success'
  } else if (['pending', 'processing', 'packing', 'scheduled', 'adjustment', 'low stock'].includes(lower)) {
    normalizedVariant = 'warning'
  } else if (['cancelled', 'rejected', 'inactive', 'out of stock', 'damaged', 'failed'].includes(lower)) {
    normalizedVariant = 'danger'
  } else if (['new', 'shipped', 'return', 'stock out'].includes(lower)) {
    normalizedVariant = 'info'
  } else if (['vip', 'featured', 'gold'].includes(lower)) {
    normalizedVariant = 'gold'
  }

  return (
    <span className={`admin-badge badge-${normalizedVariant} badge-${size}`}>
      {typeof children === 'string' ? adminT(children) : children}
    </span>
  )
}
