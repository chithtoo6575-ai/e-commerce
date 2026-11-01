export function adminFetch(input, init = {}) {
  return fetch(input, { ...init, credentials: "same-origin" });
}
