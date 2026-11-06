import React, { useState, useMemo } from 'react'
import { adminT } from '../adminI18n'
import Badge from '../components/Badge'
import {
  IconSearch,
  IconEye,
  IconX
} from '../AdminIcons'

const formatMoney = (val) => `Ks ${Math.round(val || 0).toLocaleString('en-US')}`

export default function CustomersPage({
  customers = [],
  orders = [],
  onUpdateCustomerStatus,
  showToast
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('All') // 'All' | 'Active' | 'VIP'
  const [selectedCustomer, setSelectedCustomer] = useState(null)

  // Compute spend and order totals per customer
  const enrichedCustomers = useMemo(() => {
    // If customers array is empty, derive from orders
    const map = new Map()

    customers.forEach((c, index) => {
      map.set(c.id || c.email || c.name, {
        id: c.id || `cust-${index + 1}`,
        name: c.name || 'Valued Customer',
        email: c.email || '',
        phone: c.phone || '',
        ordersCount: Number(c.orderCount ?? c.orderIds?.length ?? 0),
        totalSpent: Number(c.totalSpent ?? c.totalPurchase ?? 0),
        joinedDate: c.createdAt || '',
        status: c.status || 'Active',
        statusManaged: Boolean(c.id),
        address: c.address || ''
      })
    })

    // Also parse from orders to ensure all purchasers show up
    orders.forEach((o) => {
      const cust = o.customer
      if (!cust?.name) return
      const key = cust.userId || cust.phone || cust.name
      const existing = map.get(key)
      if (existing) {
        if (!existing.statusManaged) {
          existing.ordersCount += 1
          existing.totalSpent += Number(o.total || 0)
        }
        if (cust.address && !existing.address) existing.address = cust.address
      } else {
        map.set(key, {
          id: key,
          name: cust.name,
          email: cust.email || '',
          phone: cust.phone || '',
          ordersCount: 1,
          totalSpent: Number(o.total || 0),
          joinedDate: o.createdAt || '',
          status: 'Active',
          statusManaged: false,
          address: cust.address || ''
        })
      }
    })

    return [...map.values()]
  }, [customers, orders])

  const filteredCustomers = useMemo(() => {
    return enrichedCustomers.filter((c) => {
      const q = searchTerm.toLowerCase()
      const matchSearch =
        !searchTerm ||
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.includes(q)

      let matchStatus = true
      if (statusFilter === 'Active') matchStatus = c.status === 'Active'
      else if (statusFilter === 'VIP') matchStatus = c.totalSpent >= 200000

      return matchSearch && matchStatus
    }).sort((a, b) => b.totalSpent - a.totalSpent)
  }, [enrichedCustomers, searchTerm, statusFilter])

  const handleToggleStatus = async (cust) => {
    const newStatus = cust.status === 'Active' ? 'Suspended' : 'Active'
    if (!cust.statusManaged) {
      showToast?.('Only registered customer accounts can be suspended.', 'error')
      return
    }
    try {
      const updatedCustomer = await onUpdateCustomerStatus?.(cust.id, newStatus)
      if (!updatedCustomer) throw new Error('The customer status was not updated.')
      showToast?.(`Customer account ${cust.name} marked ${newStatus}`, 'success')
      setSelectedCustomer((current) => current && String(current.id) === String(cust.id)
        ? { ...current, status: updatedCustomer.status }
        : current)
    } catch (statusError) {
      showToast?.(statusError.message || 'Unable to update customer status.', 'error')
    }
  }

  return (
    <div className="admin-page-content">
      {/* Page Header */}
      <div className="page-header-actions">
        <div>
          <h2>{adminT("Customer Directory")}</h2>
          <p className="page-subtitle">{adminT("Track customer purchasing history, lifetime value, and delivery addresses")}</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="admin-card filter-card">
        <div className="filter-row">
          <div className="filter-search-box">
            <IconSearch size={15} className="search-icon-muted" />
            <input
              type="text"
              placeholder={adminT("Search by customer name, email or phone...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button className="clear-btn" onClick={() => setSearchTerm('')}>
                <IconX size={13} />
              </button>
            )}
          </div>

          <div className="filter-dropdown-group">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="admin-select"
            >
              <option value="All">{adminT("All Customer Tiers")}</option>
              <option value="VIP">{adminT("VIP Gold (Spent &gt; Ks 200,000)")}</option>
              <option value="Active">{adminT("Active Accounts")}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Customers Table */}
      <div className="admin-card">
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{adminT("Customer")}</th>
                <th>{adminT("Contact Details")}</th>
                <th>{adminT("Lifetime Orders")}</th>
                <th>{adminT("Total Spent")}</th>
                <th>{adminT("Tier")}</th>
                <th>{adminT("Joined")}</th>
                <th>{adminT("Status")}</th>
                <th className="th-action">{adminT("Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan="8" className="table-empty-cell">{' ' + adminT("No customers found matching your search.") + ' '}</td>
                </tr>
              ) : (
                filteredCustomers.map((cust) => {
                  const isVIP = cust.totalSpent >= 200000
                  const initials = (cust.name || 'C').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
                  return (
                    <tr key={cust.id} className="table-row-hover">
                      <td>
                        <div className="customer-avatar-cell">
                          <div className={`avatar-circle ${isVIP ? 'avatar-vip' : ''}`}>
                            {initials}
                          </div>
                          <div className="customer-name-meta">
                            <strong className="text-primary font-medium">{cust.name}</strong>
                            <small className="text-muted">{cust.address?.slice(0, 28) || 'Myanmar'}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="contact-meta-cell">
                          <span className="font-mono text-secondary">{cust.phone}</span>
                          <small className="text-muted">{cust.email}</small>
                        </div>
                      </td>
                      <td>
                        <span className="badge-number-pill">{cust.ordersCount} orders</span>
                      </td>
                      <td>
                        <strong className="gold-accent-text font-bold">
                          {formatMoney(cust.totalSpent)}
                        </strong>
                      </td>
                      <td>
                        {isVIP ? (
                          <span className="featured-pill vip-pill">{adminT("VIP Gold")}</span>
                        ) : (
                          <span className="tier-pill-standard">{adminT("Member")}</span>
                        )}
                      </td>
                      <td className="td-muted">
                        {cust.joinedDate ? new Date(cust.joinedDate).toLocaleDateString([], { month: 'short', year: 'numeric' }) : 'Recent'}
                      </td>
                      <td>
                        <Badge variant={cust.status === 'Active' ? 'Active' : 'Cancelled'}>
                          {adminT(cust.status)}
                        </Badge>
                      </td>
                      <td className="td-action">
                        <button
                          className="admin-icon-btn"
                          title={adminT("View customer profile")}
                          aria-label={adminT("View customer profile")}
                          onClick={() => setSelectedCustomer(cust)}
                        >
                          <IconEye size={15} />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Details Drawer */}
      {selectedCustomer && (
        <CustomerDetailDrawer
          customer={selectedCustomer}
          orders={orders.filter((o) =>
            o.customer?.name === selectedCustomer.name ||
            o.customer?.phone === selectedCustomer.phone ||
            o.customer?.userId === selectedCustomer.id
          )}
          onClose={() => setSelectedCustomer(null)}
          onToggleStatus={() => { void handleToggleStatus(selectedCustomer) }}
          canToggleStatus={selectedCustomer.statusManaged}
        />
      )}
    </div>
  )
}

function CustomerDetailDrawer({ customer, orders, onClose, onToggleStatus, canToggleStatus }) {
  const isVIP = customer.totalSpent >= 200000

  return (
    <div className="admin-drawer-overlay customer-drawer-overlay" onClick={onClose}>
      <div className="admin-drawer customer-detail-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <h3>{adminT("Customer Profile")}</h3>
            <span className="td-mono text-muted text-sm">{customer.email}</span>
          </div>
          <button className="modal-close-btn" onClick={onClose}><IconX size={16} /></button>
        </div>

        <div className="drawer-body">
          {/* Profile Card */}
          <div className="customer-drawer-hero">
            <div className={`avatar-circle-lg ${isVIP ? 'avatar-vip' : ''}`}>
              {(customer.name || 'C').slice(0, 2).toUpperCase()}
            </div>
            <div className="customer-hero-meta">
              <h4>{customer.name}</h4>
              <div className="drawer-badge-row">
                <Badge variant={customer.status}>{customer.status}</Badge>
                {isVIP && <span className="featured-pill vip-pill">{adminT("VIP Gold Member")}</span>}
              </div>
            </div>
          </div>

          <div className="drawer-specs-grid">
            <div className="spec-card">
              <small>{adminT("Total Lifetime Spend")}</small>
              <strong className="gold-accent-text">{formatMoney(customer.totalSpent)}</strong>
            </div>
            <div className="spec-card">
              <small>{adminT("Orders Count")}</small>
              <strong>{customer.ordersCount || orders.length} orders</strong>
            </div>
            <div className="spec-card">
              <small>{adminT("Phone Number")}</small>
              <span className="font-mono">{customer.phone}</span>
            </div>
            <div className="spec-card">
              <small>{adminT("Default Address")}</small>
              <span className="text-secondary text-xs">{customer.address}</span>
            </div>
          </div>

          {/* Customer Order History */}
          <div className="drawer-section">
            <h5>Purchase History ({orders.length} orders)</h5>
            {orders.length === 0 ? (
              <p className="text-muted text-sm">{adminT("No recorded orders on file for this user yet.")}</p>
            ) : (
              <div className="customer-orders-list">
                {orders.map((o) => (
                  <div key={o.id} className="cust-order-row">
                    <div>
                      <strong className="font-mono">{o.orderNumber || o.id?.slice(0, 8)}</strong>
                      <small className="d-block text-muted">{o.createdAt ? new Date(o.createdAt).toLocaleDateString() : 'Recent'}</small>
                    </div>
                    <div>
                      <Badge>{o.status}</Badge>
                    </div>
                    <strong className="gold-accent-text font-mono">
                      {formatMoney(o.total)}
                    </strong>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="drawer-footer">
          {canToggleStatus && <button
            className={`admin-btn-secondary ${customer.status === 'Active' ? 'btn-danger-hover' : ''}`}
            onClick={onToggleStatus}
          >
            {adminT(customer.status === 'Active' ? 'Suspend Account' : 'Reactivate Account')}
          </button>}
          <button className="admin-btn-secondary" onClick={onClose}>{' ' + adminT("Close") + ' '}</button>
        </div>
      </div>
    </div>
  )
}
