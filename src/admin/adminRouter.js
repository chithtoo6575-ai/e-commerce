const deploymentBase = import.meta.env.BASE_URL.replace(/\/+$/, '')

export function getAdminPath(pathname = window.location.pathname) {
  if (deploymentBase && pathname.startsWith(`${deploymentBase}/`)) {
    return pathname.slice(deploymentBase.length) || '/'
  }
  return pathname
}

export function getAdminUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${deploymentBase}${normalizedPath}` || normalizedPath
}

export function isAdminPath(pathname = window.location.pathname) {
  const path = getAdminPath(pathname)
  return path === '/admin' || path.startsWith('/admin/')
}
