// Resolve the application's base path in a way that works both when Vite is
// configured with an absolute base (e.g. /e-commerce/) and with a relative
// base (./). With a relative base, Vite reports './' as BASE_URL, so we
// derive the real mount point from the current module's URL at runtime.
export function getBasePath() {
  const envBase = (import.meta.env && import.meta.env.BASE_URL) || '';
  if (envBase && envBase.startsWith('/')) {
    return envBase.replace(/\/+$/, '');
  }
  // Relative base ('./'): in dev the app is served from the root.
  if (import.meta.env && import.meta.env.DEV) {
    return '';
  }
  // In production, derive the mount point from this module's URL, which lives
  // under <base>/assets/.
  try {
    const url = new URL(import.meta.url);
    const pathname = url.pathname || '';
    const assetIndex = pathname.indexOf('/assets/');
    if (assetIndex !== -1) return pathname.slice(0, assetIndex);
    return pathname.replace(/\/[^/]*$/, '') || '';
  } catch {
    return '';
  }
}

export function assetUrl(path) {
  const base = getBasePath();
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalized}`;
}

export function getAdminUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const base = getBasePath();
  return `${base}${normalizedPath}` || normalizedPath;
}
