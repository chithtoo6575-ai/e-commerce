import React, { useState } from 'react'
import { adminT } from '../adminI18n'
import Badge from '../components/Badge'
import ConfirmModal from '../components/ConfirmModal'
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconArrowUpRight,
  IconX
} from '../AdminIcons'

export default function SupportChannelsPage({
  channels = [],
  onSaveChannels,
  showToast
}) {
  const [editingChannel, setEditingChannel] = useState(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)

  const sortedChannels = [...channels].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))

  const handleToggleStatus = (channel) => {
    const updated = sortedChannels.map((c) =>
      c.id === channel.id ? { ...c, status: c.status === 'Active' ? 'Inactive' : 'Active' } : c
    )
    onSaveChannels?.(updated)
    const newStatus = channel.status === 'Active' ? 'Inactive' : 'Active'
    showToast?.(`Support channel "${channel.channel || channel.name}" is now ${newStatus}`, 'info')
  }

  return (
    <div className="admin-page-content">
      {/* Page Header */}
      <div className="page-header-actions">
        <div>
          <h2>{adminT("Customer Support Channels")}</h2>
          <p className="page-subtitle">{adminT("Manage the Facebook, Viber, and Telegram contact options shown to customers")}</p>
        </div>
        <button
          className="admin-btn-gold"
          onClick={() => setEditingChannel({
            channel: 'Facebook',
            accountName: '',
            username: '',
            link: '',
            icon: '💬',
            description: '',
            status: 'Active',
            sortOrder: sortedChannels.length + 1
          })}
        >
          <IconPlus size={16} />
          <span>{adminT("Add Channel")}</span>
        </button>
      </div>

      {/* Channels Cards Grid */}
      <div className="support-channels-grid">
        {sortedChannels.map((channel) => {
          const isActive = channel.status === 'Active'
          return (
            <div key={channel.id} className="admin-card channel-card">
              <div className="channel-card-top">
                <div className="channel-icon-avatar">
                  <span>{channel.icon || '💬'}</span>
                </div>
                <div className="channel-meta-top">
                  <h4>{channel.channel || channel.name}</h4>
                  <Badge>{channel.status}</Badge>
                </div>
              </div>

                {(channel.accountName || channel.username) && (
                  <p className="channel-desc">
                    {[channel.accountName, channel.username].filter(Boolean).join(' · ')}
                  </p>
                )}
                <p className="channel-desc">{channel.description || 'Customer inquiry and resolution channel.'}</p>

                <div className="channel-contact-box">
                  <span className="contact-label">{adminT("Contact link:")}</span>
                  <span className="contact-val font-mono">{channel.link || channel.contact || 'Not set'}</span>
              </div>

              <div className="channel-card-footer">
                <button
                  className={`status-toggle-btn ${isActive ? 'toggle-on' : 'toggle-off'}`}
                  onClick={() => handleToggleStatus(channel)}
                >
                  <span className="toggle-indicator" />
                  {adminT(channel.status)}
                </button>

                <div className="action-button-group">
                  {(channel.link || channel.contact) && (
                    <a
                      href={channel.link || channel.contact}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="admin-icon-btn"
                      title={adminT("Test contact link")}
                    >
                      <IconArrowUpRight size={14} />
                    </a>
                  )}
                  <button
                    className="admin-icon-btn"
                    title={adminT("Edit Channel")}
                    onClick={() => setEditingChannel({ ...channel })}
                  >
                    <IconEdit size={15} />
                  </button>
                  <button
                    className="admin-icon-btn btn-danger-hover"
                    title={adminT("Delete Channel")}
                    onClick={() => setDeleteConfirmId(channel.id)}
                  >
                    <IconTrash size={15} />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Add / Edit Modal */}
      {editingChannel && (
        <ChannelModal
          channel={editingChannel}
          onClose={() => setEditingChannel(null)}
          onSave={(saved) => {
            const exists = sortedChannels.some((c) => c.id === saved.id)
            let updated
            if (exists) {
              updated = sortedChannels.map((c) => c.id === saved.id ? saved : c)
            } else {
              updated = [...sortedChannels, saved]
            }
            onSaveChannels?.(updated)
            showToast?.(exists ? 'Support channel updated' : 'Support channel added', 'success')
            setEditingChannel(null)
          }}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={Boolean(deleteConfirmId)}
        title={adminT("Delete Support Channel")}
        message={adminT("Are you sure you want to remove this support channel?")}
        confirmText={adminT("Delete Channel")}
        danger={true}
        onConfirm={() => {
          const updated = sortedChannels.filter((c) => c.id !== deleteConfirmId)
          onSaveChannels?.(updated)
          showToast?.('Support channel deleted', 'success')
          setDeleteConfirmId(null)
        }}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  )
}

function ChannelModal({ channel, onClose, onSave }) {
  const [formData, setFormData] = useState(() => ({
    id: channel.id || `sup-${Date.now().toString(36)}`,
    channel: channel.channel || channel.name || 'Facebook',
    accountName: channel.accountName || '',
    username: channel.username || '',
    link: channel.link || channel.contact || '',
    icon: channel.icon || '💬',
    description: channel.description || '',
    status: channel.status || 'Active',
    sortOrder: channel.sortOrder ?? 1
  }))
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.channel || (!formData.accountName.trim() && !formData.username.trim() && !formData.link.trim())) {
      setError('Choose a channel and enter its account details or link.')
      return
    }
    onSave(formData)
  }

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{adminT(channel.id ? 'Edit Support Channel' : 'Add Support Channel')}</h3>
          <button className="modal-close-btn" onClick={onClose}><IconX size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="admin-form">
          <div className="form-grid-2">
            <div className="form-group">
              <label>{adminT("Channel *")}</label>
              <select
                required
                value={formData.channel}
                onChange={(e) => setFormData({ ...formData, channel: e.target.value })}
              >
                <option value="Facebook">{adminT("Facebook")}</option>
                <option value="Viber">{adminT("Viber")}</option>
                <option value="Telegram">{adminT("Telegram")}</option>
              </select>
              {error && <span className="form-error">{adminT(error)}</span>}
            </div>

            <div className="form-group">
              <label>{adminT("Account name")}</label>
              <input
                type="text"
                placeholder={adminT("Account or page display name")}
                value={formData.accountName}
                onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label>{adminT("Username")}</label>
            <input
              type="text"
              placeholder={adminT("@username")}
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>{adminT("Link")}</label>
            <input
              type="text"
              placeholder={adminT("https://...")}
              value={formData.link}
              onChange={(e) => setFormData({ ...formData, link: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>{adminT("Description")}</label>
            <input
              type="text"
              placeholder={adminT("Optional details for customers")}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label>{adminT("Sort Order")}</label>
              <input
                type="number"
                value={formData.sortOrder}
                onChange={(e) => setFormData({ ...formData, sortOrder: Number(e.target.value) })}
              />
            </div>

            <div className="form-group">
              <label>{adminT("Status")}</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                <option value="Active">{adminT("Active")}</option>
                <option value="Inactive">{adminT("Inactive")}</option>
              </select>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="admin-btn-secondary" onClick={onClose}>{' ' + adminT("Cancel") + ' '}</button>
            <button type="submit" className="admin-btn-gold">{' ' + adminT("Save Channel") + ' '}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
