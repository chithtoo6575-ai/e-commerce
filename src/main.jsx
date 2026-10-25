import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import AdminApp from './AdminApp.jsx'
import AppErrorBoundary from './AppErrorBoundary.jsx'
import { isAdminPath } from './admin/adminRouter.js'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppErrorBoundary>{isAdminPath() ? <AdminApp /> : <App />}</AppErrorBoundary>
  </StrictMode>,
)
