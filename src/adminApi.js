const ADMIN_TAB_KEY = 'htoo_admin_tab_id'

function getAdminTabId() {
  try {
    let tabId = window.sessionStorage.getItem(ADMIN_TAB_KEY)
    if (!tabId) {
      tabId = globalThis.crypto?.randomUUID?.() || `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`
      window.sessionStorage.setItem(ADMIN_TAB_KEY, tabId)
    }
    return tabId
  } catch {
    return ''
  }
}

export function clearAdminTabSession() {
  try {
    window.sessionStorage.removeItem(ADMIN_TAB_KEY)
  } catch {
    // Session storage can be unavailable in privacy-restricted browser contexts.
  }
}

export function adminFetch(input, init = {}) {
  const headers = new Headers(init.headers)
  const tabId = getAdminTabId()
  if (tabId) headers.set('X-Admin-Tab', tabId)
  return fetch(input, { ...init, headers, credentials: "same-origin" });
}
