import { useEffect, useRef, useState } from 'react'
import { t } from './lib/i18n'

export function CartIcon({ count = 0, className = '' }) {
  return (
    <span className={`hto-cart-icon ${className}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 4h2l2.1 10.1a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 1.9-1.4L21 8H6" />
        <circle cx="10" cy="19" r="1.25" />
        <circle cx="18" cy="19" r="1.25" />
      </svg>
      {count > 0 && <span className="hto-cart-badge">{count > 99 ? '99+' : count}</span>}
    </span>
  )
}

export function AddToCartButton({ productName, disabled = false, onClick, className = '', language = 'en' }) {
  const [isAdding, setIsAdding] = useState(false)
  const lockRef = useRef(false)
  const timerRef = useRef(0)
  const addToCartLabel = `${t('Add to cart:', language)} ${productName}`

  useEffect(() => () => window.clearTimeout(timerRef.current), [])

  function handleClick(event) {
    event.stopPropagation()
    if (disabled || lockRef.current) return
    lockRef.current = true
    setIsAdding(true)
    onClick?.()
    timerRef.current = window.setTimeout(() => {
      lockRef.current = false
      setIsAdding(false)
    }, 350)
  }

  return (
    <button
      type="button"
      className={`hto-add-button ${className}`}
      aria-label={addToCartLabel}
      title={addToCartLabel}
      disabled={disabled || isAdding}
      onClick={handleClick}
    >
      <span aria-hidden="true">+</span>
    </button>
  )
}
