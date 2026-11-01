import React, { useEffect } from 'react'
import { adminT } from '../adminI18n'
import { IconCheck, IconX } from '../AdminIcons'

export default function ToastContainer({ toasts, onDismiss }) {
  if (!toasts || toasts.length === 0) return null

  return (
    <div className="admin-toast-container" aria-live="polite">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss()
    }, toast.duration || 4000)
    return () => clearTimeout(timer)
  }, [toast, onDismiss])

  const type = toast.type || 'success'

  return (
    <div className={`admin-toast-item toast-${type}`}>
      <span className="toast-icon">
        {type === 'success' && <IconCheck size={16} />}
        {type === 'error' && <IconX size={16} />}
        {type === 'warning' && '!'}
        {type === 'info' && 'i'}
      </span>
      <div className="toast-content">
        {toast.title && <strong className="toast-title">{adminT(toast.title)}</strong>}
        <span className="toast-message">{adminT(toast.message)}</span>
      </div>
      <button className="toast-close" onClick={onDismiss} aria-label={adminT("Close notification")}>
        <IconX size={14} />
      </button>
    </div>
  )
}
