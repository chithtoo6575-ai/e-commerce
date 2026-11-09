import { useEffect, useMemo, useState } from 'react'
import { adminT, hasAdminLanguagePreference } from '../adminI18n'
import { STAFF_PERMISSIONS } from '../../../shared/adminPermissions.js'
import { adminFetch } from '../../adminApi'
import { IconEdit, IconPlus, IconTrash, IconX } from '../AdminIcons'

const TABS = [
  { id: 'accounts', label: 'Staff Management' },
  { id: 'permissions', label: 'Staff Permissions' },
  { id: 'activity', label: 'Staff Activity Logs' }
]

function displayDate(value) {
  if (!value) return 'Never'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString()
}

async function readResult(response, fallback, language) {
  const result = await response.json()
  if (!response.ok) throw new Error(adminT(result.error || fallback, language))
  return result
}

export default function StaffManagementPage({ initialTab = 'accounts', showToast, language = 'my', onLanguageChange }) {
  const hasSavedLanguage = hasAdminLanguagePreference()
  const currentLanguage = hasSavedLanguage ? language : 'my'
  const t = (value) => adminT(value, currentLanguage)
  const [tab, setTab] = useState(initialTab)
  const [staff, setStaff] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [logs, setLogs] = useState([])
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [editForm, setEditForm] = useState(null)
  const [editingStaff, setEditingStaff] = useState(null)
  const [createModalOpen, setCreateModalOpen] = useState(initialTab === 'create')
  const [newPassword, setNewPassword] = useState('')
  const [permissions, setPermissions] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const selected = useMemo(() => staff.find((account) => account.id === selectedId) || staff[0] || null, [staff, selectedId])

  const openCreateModal = () => {
    setError('')
    setForm({ name: '', email: '', password: '' })
    setTab('accounts')
    setCreateModalOpen(true)
  }

  const loadStaff = async () => {
    const result = await readResult(await adminFetch('/api/admin/staff'), 'Unable to load Staff accounts.', currentLanguage)
    setStaff(Array.isArray(result.staff) ? result.staff : [])
    if (result.staff?.length && !result.staff.some((account) => account.id === selectedId)) setSelectedId(result.staff[0].id)
  }

  const loadLogs = async (staffId = '') => {
    const query = staffId ? `?staffId=${encodeURIComponent(staffId)}` : ''
    const result = await readResult(await adminFetch(`/api/admin/staff/activity${query}`), 'Unable to load Staff activity logs.', currentLanguage)
    setLogs(Array.isArray(result.logs) ? result.logs : [])
  }

  useEffect(() => {
    setTab(initialTab === 'create' ? 'accounts' : initialTab)
    if (initialTab === 'create') setCreateModalOpen(true)
  }, [initialTab])

  useEffect(() => {
    if (!hasSavedLanguage) onLanguageChange?.('my')
  }, [hasSavedLanguage, onLanguageChange])

  useEffect(() => {
    let active = true
    loadStaff().catch((loadError) => {
      if (active) setError(loadError.message)
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!selected) return
    setPermissions(selected.permissions || [])
    setEditForm({ name: selected.name, email: selected.email || selected.username })
    if (tab === 'activity') loadLogs(selected.id).catch((loadError) => setError(loadError.message))
  }, [selected?.id, tab])

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await readResult(await adminFetch('/api/admin/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      }), 'Unable to create Staff account.', currentLanguage)
      setForm({ name: '', email: '', password: '' })
      await loadStaff()
      setTab('accounts')
      setCreateModalOpen(false)
      showToast?.(t('Staff account created.'), 'success')
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setBusy(false)
    }
  }

  const saveAccount = async () => {
    if (!selected || !editForm) return
    setBusy(true)
    setError('')
    try {
      await readResult(await adminFetch(`/api/admin/staff/${encodeURIComponent(selected.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      }), 'Unable to update Staff account.', currentLanguage)
      await loadStaff()
      setEditingStaff(null)
      showToast?.(t('Staff information updated.'), 'success')
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setBusy(false)
    }
  }

  const toggleActive = async (account) => {
    setBusy(true)
    setError('')
    try {
      await readResult(await adminFetch(`/api/admin/staff/${encodeURIComponent(account.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !account.active })
      }), 'Unable to update Staff account status.', currentLanguage)
      await loadStaff()
      showToast?.(t(account.active ? 'Staff account deactivated.' : 'Staff account activated.'), 'success')
    } catch (statusError) {
      setError(statusError.message)
    } finally {
      setBusy(false)
    }
  }

  const editStaff = (account) => {
    setSelectedId(account.id)
    setTab('accounts')
    setEditingStaff(account)
  }

  const deleteStaff = async (account) => {
    if (!window.confirm(t(`Delete Staff account "${account.name}"?`))) return
    setBusy(true)
    setError('')
    try {
      await readResult(await adminFetch(`/api/admin/staff/${encodeURIComponent(account.id)}`, {
        method: 'DELETE'
      }), 'Unable to delete Staff account.', currentLanguage)
      await loadStaff()
      if (editingStaff?.id === account.id) setEditingStaff(null)
      showToast?.(t('Staff account deleted.'), 'success')
    } catch (deleteError) {
      setError(deleteError.message)
    } finally {
      setBusy(false)
    }
  }

  const changePassword = async (event) => {
    event.preventDefault()
    if (!selected) return
    setBusy(true)
    setError('')
    try {
      await readResult(await adminFetch(`/api/admin/staff/${encodeURIComponent(selected.id)}/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword })
      }), 'Unable to change Staff password.', currentLanguage)
      setNewPassword('')
      showToast?.(t('Staff password changed; existing Staff sessions were revoked.'), 'success')
    } catch (passwordError) {
      setError(passwordError.message)
    } finally {
      setBusy(false)
    }
  }

  const savePermissions = async () => {
    if (!selected) return
    setBusy(true)
    setError('')
    try {
      const result = await readResult(await adminFetch(`/api/admin/staff/${encodeURIComponent(selected.id)}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions })
      }), 'Unable to save Staff permissions.', currentLanguage)
      setStaff((current) => current.map((account) => account.id === selected.id ? result.staff : account))
      showToast?.(t('Permissions saved; existing Staff sessions were revoked.'), 'success')
    } catch (permissionError) {
      setError(permissionError.message)
    } finally {
      setBusy(false)
    }
  }

  const renderStaffSelector = () => (
    <label className="staff-account-selector">
      {t('Staff account')}
      <select value={selected?.id || ''} onChange={(event) => setSelectedId(event.target.value)} disabled={!staff.length}>
        {staff.map((account) => <option key={account.id} value={account.id}>{account.name} ({account.email || account.username})</option>)}
      </select>
    </label>
  )

  return (
    <div className="admin-page-content staff-management-page">
      <div className="page-header-actions">
        <div>
          <h2>{t('Staff Account Management')}</h2>
          <p className="page-subtitle">{t('Create and manage Staff accounts.')}</p>
        </div>
        <button
          className="admin-btn-gold"
          type="button"
          disabled={busy}
          aria-haspopup="dialog"
          aria-controls="create-staff-modal"
          onClick={openCreateModal}
        >
          <IconPlus size={16} />
          <span>{t('Add New Staff')}</span>
        </button>
      </div>
      <div className="staff-management-tabs" role="tablist" aria-label={t('Staff management')}>
        {TABS.map((item) => (
          <button key={item.id} type="button" className={`admin-btn-secondary ${tab === item.id ? 'active' : ''}`} onClick={() => setTab(item.id)}>
            {t(item.label)}
          </button>
        ))}
      </div>
      {error && <div className="admin-card form-error" role="alert">{error}</div>}

      {tab === 'accounts' && (
        <>
          <div className="admin-card admin-table-wrapper">
            <table className="admin-table staff-table">
              <thead><tr><th>{t('Staff Name')}</th><th>{t('Gmail')}</th><th>{t('Status')}</th><th>{t('Assigned Permissions')}</th><th>{t('Last Login')}</th><th>{t('Created Date')}</th><th>{t('Actions')}</th></tr></thead>
              <tbody>
                {staff.map((account) => (
                  <tr key={account.id} onClick={() => setSelectedId(account.id)} className="table-row-hover">
                    <td>{account.name}</td><td>{account.email || account.username}</td><td>{t(account.active ? 'Active' : 'Inactive')}</td>
                    <td>{account.permissions.length}</td><td>{t(displayDate(account.lastLoginAt))}</td><td>{displayDate(account.createdAt)}</td>
                    <td className="staff-row-actions">
                      <button type="button" className="admin-icon-btn" disabled={busy} title={t('Edit')} aria-label={t('Edit')} onClick={(event) => { event.stopPropagation(); editStaff(account) }}>
                        <IconEdit size={15} />
                      </button>
                      <button type="button" className="admin-icon-btn btn-danger-hover" disabled={busy} title={t('Delete')} aria-label={t('Delete')} onClick={(event) => { event.stopPropagation(); deleteStaff(account) }}>
                        <IconTrash size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
                {!staff.length && <tr><td colSpan="7" className="table-empty-cell">{t('No Staff accounts created yet.')}</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'permissions' && (
        <div className="admin-card staff-form">
          <h3>{t('Configure Individual Staff Permissions')}</h3>
          {renderStaffSelector()}
          {selected ? (
            <>
              {Object.entries(Object.groupBy ? Object.groupBy(STAFF_PERMISSIONS, ({ group }) => group) : STAFF_PERMISSIONS.reduce((groups, permission) => {
                groups[permission.group] ||= []
                groups[permission.group].push(permission)
                return groups
              }, {})).map(([group, groupPermissions]) => (
                <fieldset className="staff-permission-group" key={group}>
                  <legend>{t(group)}</legend>
                  {groupPermissions.map((permission) => (
                    <label key={permission.key}>
                      <input
                        type="checkbox"
                        checked={permissions.includes(permission.key)}
                        onChange={(event) => setPermissions((current) => event.target.checked
                          ? [...current, permission.key]
                          : current.filter((key) => key !== permission.key))}
                      />
                      {t(permission.label)}
                    </label>
                  ))}
                </fieldset>
              ))}
              <button className="admin-btn-gold" type="button" disabled={busy} onClick={savePermissions}>{t('Save Permissions')}</button>
            </>
          ) : <p>{t('No Staff accounts are available.')}</p>}
        </div>
      )}

      {tab === 'activity' && (
        <div className="admin-card">
          <div className="page-header-actions">
            <div><h3>{t('Staff Activity Logs')}</h3><p className="card-subtitle">{t('Logs are recorded by the server and cannot be edited or deleted by Staff.')}</p></div>
            {renderStaffSelector()}
          </div>
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead><tr><th>{t('Staff')}</th><th>{t('Action')}</th><th>{t('Date and Time')}</th><th>{t('Affected Record')}</th><th>{t('Activity Details')}</th></tr></thead>
              <tbody>
                {logs.map((log) => <tr key={log.id}><td>{log.staffName} (@{log.username})</td><td>{t(log.action)}</td><td>{displayDate(log.occurredAt)}</td><td>{log.affectedRecord || '—'}</td><td>{t(log.details)}</td></tr>)}
                {!logs.length && <tr><td colSpan="5" className="table-empty-cell">{t('No Staff activity has been recorded.')}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editingStaff && selected && (
        <div className="admin-modal-overlay" onClick={() => setEditingStaff(null)}>
          <div className="admin-modal-box form-modal-wide staff-edit-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('Edit Staff Information')}</h3>
              <button type="button" className="modal-close-btn" onClick={() => setEditingStaff(null)} aria-label={t('Close')}>
                <IconX size={16} />
              </button>
            </div>
            <div className="modal-body">
              <div className="staff-edit-grid">
                <label>{t('Staff Name')}<input value={editForm?.name || ''} maxLength={120} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} /></label>
                <label>{t('Gmail')}<input required type="email" value={editForm?.email || ''} maxLength={254} onChange={(event) => setEditForm({ ...editForm, email: event.target.value })} /></label>
              </div>
              <div className="modal-footer">
                <button className="admin-btn-secondary" type="button" disabled={busy} onClick={saveAccount}>{t('Save Information')}</button>
              </div>
              <form className="staff-edit-grid" onSubmit={changePassword}>
                <label>{t('New Password')}<input required minLength={12} maxLength={256} type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
                <button className="admin-btn-secondary" disabled={busy}>{t('Change Password')}</button>
                <button className="admin-btn-secondary" type="button" disabled={busy} onClick={() => toggleActive(selected)}>
                  {t(selected.active ? 'Deactivate Account' : 'Activate Account')}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {createModalOpen && (
        <div className="admin-modal-overlay" onClick={() => setCreateModalOpen(false)}>
          <div
            id="create-staff-modal"
            className="admin-modal-box form-modal-wide staff-edit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-staff-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h3 id="create-staff-modal-title">{t('Add New Staff')}</h3>
              <button type="button" className="modal-close-btn" onClick={() => setCreateModalOpen(false)} aria-label={t('Close')}>
                <IconX size={16} />
              </button>
            </div>
            <form className="modal-body staff-form" onSubmit={submit}>
              <label>{t('Staff Name')}<input required maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
              <label>{t('Gmail')}<input required type="email" maxLength={254} autoComplete="username" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
              <label>{t('Password')}<input required minLength={12} maxLength={256} type="password" autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
              <div className="modal-footer">
                <button className="admin-btn-secondary" type="button" onClick={() => setCreateModalOpen(false)}>{t('Cancel')}</button>
                <button className="admin-btn-gold" disabled={busy}>{t('Create Staff Account')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
