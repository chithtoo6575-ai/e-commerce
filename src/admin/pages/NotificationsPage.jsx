import React, { useState } from 'react'
import { adminT } from '../adminI18n'
import Badge from '../components/Badge'
import ConfirmModal from '../components/ConfirmModal'
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconX
} from '../AdminIcons'

export default function NotificationsPage({
  notifications = [],
  onSaveNotifications,
  showToast
}) {
  const [editingNotification, setEditingNotification] = useState(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)

  const handleSendNow = (notif) => {
    const updated = notifications.map((n) =>
      n.id === notif.id ? { ...n, status: 'Sent', date: new Date().toISOString() } : n
    )
    onSaveNotifications?.(updated)
    showToast?.(`Broadcast notification "${notif.title}" sent to ${notif.audience}!`, 'success')
  }

  return (
    <div className="admin-page-content">
      {/* Page Header */}
      <div className="page-header-actions">
        <div>
          <h2>{adminT("Store Notifications & Broadcasts")}</h2>
          <p className="page-subtitle">{adminT("Send marketing announcements, flash sale alerts, and transactional push updates")}</p>
        </div>
        <button
          className="admin-btn-gold"
          onClick={() => setEditingNotification({
            title: '',
            message: '',
            audience: 'All Customers',
            link: '/categories',
            status: 'Draft',
            date: new Date().toISOString()
          })}
        >
          <IconPlus size={16} />
          <span>{adminT("New Notification")}</span>
        </button>
      </div>

      {/* Notifications Table */}
      <div className="admin-card">
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{adminT("Title & Announcement")}</th>
                <th>{adminT("Target Audience")}</th>
                <th>{adminT("Link / Target")}</th>
                <th>{adminT("Scheduled / Sent Date")}</th>
                <th>{adminT("Status")}</th>
                <th className="th-action">{adminT("Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {notifications.length === 0 ? (
                <tr>
                  <td colSpan="6" className="table-empty-cell">{' ' + adminT("No notifications created. Click \"New Notification\" to compose one.") + ' '}</td>
                </tr>
              ) : (
                notifications.map((notif) => (
                  <tr key={notif.id} className="table-row-hover">
                    <td>
                      <div className="notif-title-cell">
                        <strong className="text-primary font-medium">{notif.title}</strong>
                        <p className="notif-message-preview">{notif.message}</p>
                      </div>
                    </td>
                    <td>
                      <span className="category-pill">{notif.audience}</span>
                    </td>
                    <td className="td-mono text-secondary text-xs">
                      {notif.link || '/'}
                    </td>
                    <td className="td-muted">
                      {notif.date ? new Date(notif.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Immediate'}
                    </td>
                    <td>
                      <Badge variant={notif.status}>{notif.status}</Badge>
                    </td>
                    <td className="td-action">
                      <div className="action-button-group">
                        {notif.status !== 'Sent' && (
                          <button
                            className="admin-btn-gold btn-xs"
                            onClick={() => handleSendNow(notif)}
                            title={adminT("Send broadcast now")}
                          >
                            {adminT("Send")}
                          </button>
                        )}
                        <button
                          className="admin-icon-btn"
                          title={adminT("Edit")}
                          onClick={() => setEditingNotification({ ...notif })}
                        >
                          <IconEdit size={15} />
                        </button>
                        <button
                          className="admin-icon-btn btn-danger-hover"
                          title={adminT("Delete")}
                          onClick={() => setDeleteConfirmId(notif.id)}
                        >
                          <IconTrash size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {editingNotification && (
        <NotificationModal
          notification={editingNotification}
          onClose={() => setEditingNotification(null)}
          onSave={(saved) => {
            const exists = notifications.some((n) => n.id === saved.id)
            let updated
            if (exists) {
              updated = notifications.map((n) => n.id === saved.id ? saved : n)
            } else {
              updated = [saved, ...notifications]
            }
            onSaveNotifications?.(updated)
            showToast?.(exists ? 'Notification updated' : 'Notification created', 'success')
            setEditingNotification(null)
          }}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={Boolean(deleteConfirmId)}
        title={adminT("Delete Notification")}
        message={adminT("Are you sure you want to delete this notification record?")}
        confirmText={adminT("Delete")}
        danger={true}
        onConfirm={() => {
          const updated = notifications.filter((n) => n.id !== deleteConfirmId)
          onSaveNotifications?.(updated)
          showToast?.('Notification deleted', 'success')
          setDeleteConfirmId(null)
        }}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  )
}

function NotificationModal({ notification, onClose, onSave }) {
  const [formData, setFormData] = useState(() => ({
    id: notification.id || `notif-${Date.now().toString(36)}`,
    title: notification.title || '',
    message: notification.message || '',
    audience: notification.audience || 'All Customers',
    link: notification.link || '/categories',
    status: notification.status || 'Draft',
    date: notification.date || new Date().toISOString()
  }))
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.title.trim() || !formData.message.trim()) {
      setError('Title and message text are required')
      return
    }
    onSave(formData)
  }

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{adminT(notification.id ? 'Edit Notification' : 'Compose Notification')}</h3>
          <button className="modal-close-btn" onClick={onClose}><IconX size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="admin-form">
          <div className="form-group">
            <label>{adminT("Notification Headline *")}</label>
            <input
              type="text"
              required
              placeholder={adminT("e.g. Flash Sale: 20% Off Weekend Collection")}
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
            {error && <span className="form-error">{adminT(error)}</span>}
          </div>

          <div className="form-group">
            <label>{adminT("Message Content *")}</label>
            <textarea
              rows="3"
              required
              placeholder={adminT("Enter announcement details shown to customers...")}
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
            />
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label>{adminT("Target Audience")}</label>
              <select
                value={formData.audience}
                onChange={(e) => setFormData({ ...formData, audience: e.target.value })}
              >
                <option value="All Customers">{adminT("All Customers")}</option>
                <option value="VIP Customers">{adminT("VIP Gold Members")}</option>
                <option value="New Customers">{adminT("New Signups (&lt; 30 Days)")}</option>
                <option value="Inactive Customers">{adminT("Inactive Customers (&gt; 60 Days)")}</option>
              </select>
            </div>

            <div className="form-group">
              <label>{adminT("Status")}</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                <option value="Draft">{adminT("Draft")}</option>
                <option value="Scheduled">{adminT("Scheduled")}</option>
                <option value="Sent">{adminT("Sent")}</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>{adminT("Call-to-Action Link")}</label>
            <input
              type="text"
              placeholder={adminT("/categories/Clothing or /promotions")}
              value={formData.link}
              onChange={(e) => setFormData({ ...formData, link: e.target.value })}
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="admin-btn-secondary" onClick={onClose}>{' ' + adminT("Cancel") + ' '}</button>
            <button type="submit" className="admin-btn-gold">{' ' + adminT("Save Notification") + ' '}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
