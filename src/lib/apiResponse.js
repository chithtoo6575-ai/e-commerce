// Reads an API response body without ever throwing on empty or non-JSON payloads.
// A crashed proxy, an HTML error page, or an unexpected 500 would otherwise surface
// as "Failed to execute 'json' on 'Response': Unexpected end of JSON input".
export async function readJsonResponse(response, fallbackMessage = 'Unexpected server response. Please try again.') {
  let text = ''
  try {
    text = await response.text()
  } catch {
    throw new Error(fallbackMessage)
  }

  let payload = null
  if (text.trim()) {
    try {
      payload = JSON.parse(text)
    } catch {
      // Non-JSON body (HTML error page, proxy message, empty stream).
      payload = null
    }
  }

  if (payload && typeof payload === 'object') return payload

  // Prefer a server-supplied message, then a status-specific one, then the caller's fallback.
  const status = response.ok ? 0 : response.status
  if (status === 401) throw new Error('Invalid credentials. Please check your details and try again.')
  if (status === 403) throw new Error('You do not have permission to perform this action.')
  if (status === 429) throw new Error('Too many attempts. Please wait a moment and try again.')
  if (status === 503) throw new Error('The server is not ready yet. Please try again shortly.')
  if (status >= 500) throw new Error('The server ran into a problem. Please try again later.')
  if (!response.ok) throw new Error(fallbackMessage)

  throw new Error('The server returned an unexpected response. Please try again.')
}

// Returns the server error message for a payload produced by readJsonResponse.
export function apiErrorMessage(payload, fallbackMessage) {
  const message = payload?.error || payload?.message
  return typeof message === 'string' && message.trim() ? message : fallbackMessage
}
