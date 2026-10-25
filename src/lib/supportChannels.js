// Customer-facing support channels.
// The admin configures these in Dashboard → Support Channels (persisted by
// /api/admin/support-channels). The storefront reads the public, active-only
// /api/support-channels endpoint so customers always see the live list.

const CHANNEL_ICONS = {
  Facebook: '📘',
  Telegram: '✈️',
  Viber: '📞',
  Phone: '📱',
  Email: '✉️',
  Instagram: '📸',
  WhatsApp: '🟢',
  TikTok: '🎵'
}

export function isActiveChannel(channel) {
  return Boolean(channel) && (channel.status === 'Active' || channel.enabled === true)
}

export function channelIcon(channel) {
  return channel?.icon || CHANNEL_ICONS[channel?.channel || channel?.name] || '💬'
}

// Build the address to open for a channel. Admin-entered links are used as-is
// when they carry a usable scheme; a bare phone number or username is turned
// into a tel:/mailto:/https: target so the button is still tappable.
export function supportChannelHref(channel) {
  const raw = String(channel?.link || channel?.contact || '').trim()
  if (/^(https?:\/\/|viber:\/\/|tg:\/\/|tel:|mailto:)/i.test(raw)) return raw
  if (raw.startsWith('//')) return `https:${raw}`
  if (raw.startsWith('/')) return raw

  const name = channel?.channel || channel?.name || ''
  const handle = String(channel?.username || raw || '').trim()
  if (!handle) return ''

  if (name === 'Phone') {
    const digits = handle.replace(/[^\d+]/g, '')
    return digits.length >= 6 ? `tel:${digits}` : ''
  }
  if (name === 'Email') return `mailto:${handle}`
  // A leading @ means a handle, not an email address.
  if (handle.includes('@') && !handle.startsWith('@')) return `mailto:${handle}`
  if (/^(www\.)?[a-z0-9-]+(\.[a-z]{2,})+/i.test(handle)) {
    return `https://${handle.replace(/^https?:\/\//i, '')}`
  }
  if (name === 'Telegram') return `https://t.me/${handle.replace(/^@/, '')}`
  if (name === 'Instagram') return `https://instagram.com/${handle.replace(/^@/, '')}`
  if (name === 'TikTok') return `https://tiktok.com/@${handle.replace(/^@/, '')}`
  if (name === 'Facebook') return `https://facebook.com/${handle.replace(/^@/, '')}`
  if (name === 'Viber') return `viber://chat?number=${encodeURIComponent(handle.replace(/[^\d+]/g, ''))}`
  if (name === 'WhatsApp') return `https://wa.me/${handle.replace(/[^\d]/g, '')}`
  return ''
}

// Merge channels from the API with any locally configured ones, keeping the
// admin's ordering and never showing a channel twice.
export function mergeSupportChannels(remoteChannels, localChannels = []) {
  const seen = new Set()
  const merged = []
  const candidates = [
    ...(Array.isArray(remoteChannels) ? remoteChannels : []),
    ...(Array.isArray(localChannels) ? localChannels : [])
  ]
  for (const channel of candidates) {
    if (!isActiveChannel(channel)) continue
    const key = String(channel.id || `${channel.channel || channel.name}:${channel.link || channel.contact || ''}`)
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(channel)
  }
  return merged.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
}

// The API is served behind the same origin on localhost and from its own host
// in production, so an absolute URL (localStorage key `htoo_api_base`) wins when
// the storefront is opened from a different origin (Telegram/bot previews).
function supportApiBase() {
  try {
    return String(localStorage.getItem('htoo_api_base') || '').replace(/\/$/, '')
  } catch {
    return ''
  }
}

export async function fetchSupportChannels(signal, baseUrl = supportApiBase()) {
  const response = await fetch(`${baseUrl}/api/support-channels`, { signal })
  const result = await response.json().catch(() => ({}))
  if (!response.ok || !Array.isArray(result.channels)) {
    throw new Error(result.error || 'Unable to load support channels.')
  }
  return result.channels
}
