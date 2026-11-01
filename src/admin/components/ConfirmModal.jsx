import React from 'react'
import { adminT } from '../adminI18n'
import { IconX } from '../AdminIcons'

export default function ConfirmModal({
  isOpen,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger = true,
  onConfirm,
  onCancel
}) {
  if (!isOpen) return null

  return (
    <div className="admin-modal-overlay" onClick={onCancel} role="dialog" aria-modal="true">
      <div className="admin-modal-box confirm-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{adminT(title)}</h3>
          <button className="modal-close-btn" onClick={onCancel} aria-label={adminT("Close")}>
            <IconX size={16} />
          </button>
        </div>
        <div className="modal-body">
          <p>{adminT(message)}</p>
        </div>
        <div className="modal-footer">
          <button className="admin-btn-secondary" onClick={onCancel}>
            {adminT(cancelText)}
          </button>
          <button
            className={danger ? 'admin-btn-danger' : 'admin-btn-gold'}
            onClick={onConfirm}
          >
            {adminT(confirmText)}
          </button>
        </div>
      </div>
    </div>
  )
}
