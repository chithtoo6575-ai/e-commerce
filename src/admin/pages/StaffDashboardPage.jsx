import { adminT } from '../adminI18n'
import StatCard from '../components/StatCard'
import { IconOrders, IconProducts, IconCustomers } from '../AdminIcons'

export default function StaffDashboardPage({ data, onNavigate, permissions = [] }) {
  const summary = data?.summary || {}
  const canViewProducts = permissions.includes('products.view')
  const canViewCustomers = permissions.includes('customers.view')
  const canViewOrders = permissions.includes('orders.view') || permissions.includes('orders.details')
  const cards = [
    ...(canViewOrders ? [{
      title: 'Orders',
      value: summary.totalOrders || 0,
      icon: <IconOrders size={18} />
    }] : []),
    ...(canViewProducts ? [{
      title: 'Products',
      value: data?.products?.length || 0,
      icon: <IconProducts size={18} />
    }] : []),
    ...(canViewCustomers ? [{
      title: 'Customers',
      value: data?.customers?.length || 0,
      icon: <IconCustomers size={18} />
    }] : []),
    ...((permissions.includes('stock.view') || permissions.includes('products.view')) ? [{
      title: 'Low Stock',
      value: summary.lowStock || 0,
      icon: <IconProducts size={18} />
    }] : [])
  ]

  return (
    <div className="admin-page-content dashboard-page">
      <div className="page-header-actions">
        <div>
          <h2>{adminT('Staff Dashboard')}</h2>
          <p className="page-subtitle">{adminT('Operational overview based on your assigned permissions.')}</p>
        </div>
      </div>
      {cards.length > 0 ? (
        <div className="admin-grid-4">
          {cards.map((card) => (
            <StatCard key={card.title} title={adminT(card.title)} value={card.value} icon={card.icon} />
          ))}
        </div>
      ) : (
        <div className="admin-card">{adminT('No dashboard data is available for your current permissions.')}</div>
      )}
      <div className="admin-card">
        <h3>{adminT('Assigned Access')}</h3>
        <p className="card-subtitle">{adminT('Your available dashboard sections are shown in the sidebar.')}</p>
        <div className="dashboard-quick-actions">
          {canViewOrders && <button className="admin-btn-secondary" onClick={() => onNavigate?.('Orders')}>{adminT('View Orders')}</button>}
          {canViewProducts && <button className="admin-btn-secondary" onClick={() => onNavigate?.('Products')}>{adminT('View Products')}</button>}
          {canViewCustomers && <button className="admin-btn-secondary" onClick={() => onNavigate?.('Customers')}>{adminT('View Customers')}</button>}
        </div>
      </div>
    </div>
  )
}
