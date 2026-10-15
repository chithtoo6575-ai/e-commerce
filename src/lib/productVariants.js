function optionList(value) {
  if (Array.isArray(value)) return value.map((option) => String(option).trim()).filter(Boolean)
  if (typeof value === 'string') return value.split(',').map((option) => option.trim()).filter(Boolean)
  return []
}

export function getProductVariants(product) {
  const available = product.availableVariants || product.variants || {}
  const sizes = optionList(
    Array.isArray(available) || typeof available === 'string'
      ? available
      : available.sizes
  )
  const colors = optionList(Array.isArray(available) || typeof available === 'string' ? [] : available.colors)
  return {
    sizes: sizes.length ? sizes : optionList(product.size),
    colors: colors.length ? colors : optionList(product.color)
  }
}

export function hasVariantStock(product) {
  return Boolean(product.variantStock && typeof product.variantStock === 'object' && !Array.isArray(product.variantStock) && Object.keys(product.variantStock).length)
}

export function variantStockKey(variants = {}) {
  return JSON.stringify([String(variants.size || ''), String(variants.color || '')])
}

export function getProductStock(product, variants = {}) {
  if (hasVariantStock(product)) {
    const quantity = product.variantStock[variantStockKey(variants)]
    return Number.isSafeInteger(quantity) && quantity >= 0 ? quantity : 0
  }
  return Math.max(0, Number(product.stock) || 0)
}

export function getVariantStockOptions(product) {
  const { sizes, colors } = getProductVariants(product)
  return (sizes.length ? sizes : ['']).flatMap((size) =>
    (colors.length ? colors : ['']).map((color) => ({
      key: variantStockKey({ size, color }),
      size,
      color,
      label: [size, color].filter(Boolean).join(' · ') || 'Standard'
    }))
  )
}
