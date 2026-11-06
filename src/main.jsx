import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import AdminApp from './AdminApp.jsx'
import AppErrorBoundary from './AppErrorBoundary.jsx'
import { isAdminPath } from './admin/adminRouter.js'

const adminPath = isAdminPath()
document.body.classList.toggle('admin-app', adminPath)
document.body.classList.toggle('storefront-app', !adminPath)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppErrorBoundary>{adminPath ? <AdminApp /> : <App />}</AppErrorBoundary>
  </StrictMode>,
)
