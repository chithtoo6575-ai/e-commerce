import { getBasePath } from '../lib/baseUrl.js'

const deploymentBase = getBasePath()

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
  return path === '/owner-login' ||
    path === '/staff-login' ||
    path === '/admin' ||
    path.startsWith('/admin/') ||
    path === '/staff' ||
    path.startsWith('/staff/')
}
