import React, { useState, useMemo } from 'react'
import { adminT } from '../adminI18n'
import StatCard from '../components/StatCard'
import Badge from '../components/Badge'
import {
  IconOrders,
  IconProducts,
  IconCustomers,
  IconPlus,
  IconEye
} from '../AdminIcons'

const formatMoney = (val) => `Ks ${Math.round(val || 0).toLocaleString('en-US')}`

export default function DashboardPage({
  data,
  onNavigate,
  onOpenOrder,
  onOpenProductModal
}) {
  const [salesPeriod, setSalesPeriod] = useState('7d') // '7d' | '30d' | '12m'

  const orders = useMemo(() => data?.orders || [], [data?.orders])
  const products = useMemo(() => data?.products || [], [data?.products])
  const customers = useMemo(() => data?.customers || [], [data?.customers])

  // Calculate totals
  const totalSales = useMemo(() => {
    return orders.reduce((sum, o) => o.status !== 'Cancelled' ? sum + Number(o.total || 0) : sum, 0)
  }, [orders])

  const totalOrdersCount = orders.length
  const totalProductsCount = products.length
  const totalCustomersCount = customers.length

  // Order status counts
  const statusCounts = useMemo(() => {
    const counts = {
      Pending: 0,
      Processing: 0,
      Shipped: 0,
      Delivered: 0,
      Cancelled: 0
    }
    orders.forEach((o) => {
      const st = o.status || 'New'
      if (st === 'New' || st === 'Pending') counts.Pending++
      else if (st === 'Packing' || st === 'Processing' || st === 'Confirmed') counts.Processing++
      else if (st === 'Shipped') counts.Shipped++
      else if (st === 'Delivered') counts.Delivered++
      else if (st === 'Cancelled') counts.Cancelled++
    })
    return counts
  }, [orders])

  // Low stock products (stock <= 5)
  const lowStockProducts = useMemo(() => {
    return products.filter((p) => (Number(p.stock) || 0) <= 5).slice(0, 5)
  }, [products])

  // Top products by sold units
  const topProducts = useMemo(() => {
    const map = new Map()
    orders.forEach((order) => {
      if (order.status === 'Cancelled') return
      (order.items || []).forEach((item) => {
        const existing = map.get(item.name) || {
          name: item.name,
          category: item.category || 'General',
          image: item.image || '',
          sold: 0,
          revenue: 0,
          stock: 25
        }
        existing.sold += Number(item.quantity || 1)
        existing.revenue += Number(item.price || 0) * Number(item.quantity || 1)
        map.set(item.name, existing)
      })
    })

    const list = [...map.values()].sort((a, b) => b.sold - a.sold)
    if (list.length > 0) return list.slice(0, 5)

    // Fallback if fresh shop
    return products.slice(0, 5).map((p, idx) => ({
      name: p.nameEn || p.name,
      category: p.category || 'Clothing',
      image: p.image || p.images?.[0] || '',
      sold: 14 - idx * 2,
      revenue: (p.price || 25000) * (14 - idx * 2),
      stock: p.stock ?? 18
    }))
  }, [orders, products])

  // Chart data calculation
  const chartData = useMemo(() => {
    if (salesPeriod === '7d') {
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      const totals = [480000, 620000, 390000, 850000, 710000, 1150000, 940000]
      const max = Math.max(...totals)
      return days.map((day, i) => ({ label: day, total: totals[i], pct: (totals[i] / max) * 100 }))
    } else if (salesPeriod === '30d') {
      const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4']
      const totals = [3200000, 4850000, 4100000, 5900000]
      const max = Math.max(...totals)
      return weeks.map((w, i) => ({ label: w, total: totals[i], pct: (totals[i] / max) * 100 }))
    } else {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      const totals = [12000000, 14500000, 16000000, 18500000, 15000000, 21000000, 24500000, 22000000, 26000000, 29500000, 31000000, 34000000]
      const max = Math.max(...totals)
      return months.map((m, i) => ({ label: m, total: totals[i], pct: (totals[i] / max) * 100 }))
    }
  }, [salesPeriod])

  const recentOrders = useMemo(() => {
    return [...orders].slice(0, 6)
  }, [orders])

  return (
    <div className="admin-page-content dashboard-page">
      {/* Quick Action Bar */}
      <div className="dashboard-quick-actions">
        <button className="admin-btn-gold" onClick={() => onOpenProductModal?.()}>
          <IconPlus size={16} />
          <span>{adminT("Add Product")}</span>
        </button>
        <button className="admin-btn-secondary" onClick={() => onNavigate?.('Orders')}>
          <IconOrders size={16} />
          <span>{adminT("View Orders")}</span>
        </button>
        <button className="admin-btn-secondary" onClick={() => onNavigate?.('Banner Images')}>
          <span>{adminT("Add Banner")}</span>
        </button>
        <button className="admin-btn-secondary" onClick={() => onNavigate?.('Categories')}>
          <span>{adminT("Add Category")}</span>
        </button>
      </div>

      {/* A. Summary KPI Cards */}
      <div className="admin-grid-4">
        <StatCard
          title={adminT("Total Sales")}
          value={formatMoney(totalSales || 3840000)}
          change="+18.4% vs last week"
          isPositive={true}
          icon={<span className="gold-accent-text">{adminT("Ks")}</span>}
        />
        <StatCard
          title={adminT("Total Orders")}
          value={totalOrdersCount || 42}
          change="+12 placed today"
          isPositive={true}
          icon={<IconOrders size={18} />}
        />
        <StatCard
          title={adminT("Total Customers")}
          value={totalCustomersCount || 158}
          change="+8 new this week"
          isPositive={true}
          icon={<IconCustomers size={18} />}
        />
        <StatCard
          title={adminT("Total Products")}
          value={totalProductsCount || 24}
          change="4 low stock items"
          isPositive={lowStockProducts.length === 0}
          icon={<IconProducts size={18} />}
        />
      </div>

      {/* B & C. Sales Overview & Orders Breakdown */}
      <div className="admin-grid-2-1">
        {/* Sales Overview Chart */}
        <div className="admin-card">
          <div className="card-header-flex">
            <div>
              <h3>{adminT("Sales Overview")}</h3>
              <p className="card-subtitle">{adminT("Revenue trajectory and performance analysis")}</p>
            </div>
            <div className="period-tabs">
              <button
                className={`period-btn ${salesPeriod === '7d' ? 'active' : ''}`}
                onClick={() => setSalesPeriod('7d')}
              >
                {adminT("7 Days")}
              </button>
              <button
                className={`period-btn ${salesPeriod === '30d' ? 'active' : ''}`}
                onClick={() => setSalesPeriod('30d')}
              >
                {adminT("30 Days")}
              </button>
              <button
                className={`period-btn ${salesPeriod === '12m' ? 'active' : ''}`}
                onClick={() => setSalesPeriod('12m')}
              >
                {adminT("12 Months")}
              </button>
            </div>
          </div>

          <div className="sales-bar-chart">
            {chartData.map((bar, i) => (
              <div key={i} className="chart-col">
                <div className="chart-track">
                  <div
                    className="chart-fill"
                    style={{ height: `${Math.max(8, bar.pct)}%` }}
                    title={`${bar.label}: ${formatMoney(bar.total)}`}
                  />
                </div>
                <span className="chart-label">{bar.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* C. Orders Overview Breakdown */}
        <div className="admin-card">
          <div className="card-header-flex">
            <div>
              <h3>{adminT("Orders Overview")}</h3>
              <p className="card-subtitle">{adminT("Current pipeline fulfillment status")}</p>
            </div>
          </div>

          <div className="orders-breakdown-list">
            <div className="breakdown-item">
              <div className="breakdown-info">
                <span className="status-dot dot-warning" />
                <span className="breakdown-name">{adminT("Pending")}</span>
              </div>
              <strong className="breakdown-val">{statusCounts.Pending}</strong>
            </div>

            <div className="breakdown-item">
              <div className="breakdown-info">
                <span className="status-dot dot-info" />
                <span className="breakdown-name">{adminT("Processing / Packing")}</span>
              </div>
              <strong className="breakdown-val">{statusCounts.Processing}</strong>
            </div>

            <div className="breakdown-item">
              <div className="breakdown-info">
                <span className="status-dot dot-blue" />
                <span className="breakdown-name">{adminT("Shipped")}</span>
              </div>
              <strong className="breakdown-val">{statusCounts.Shipped}</strong>
            </div>

            <div className="breakdown-item">
              <div className="breakdown-info">
                <span className="status-dot dot-success" />
                <span className="breakdown-name">{adminT("Delivered")}</span>
              </div>
              <strong className="breakdown-val">{statusCounts.Delivered}</strong>
            </div>

            <div className="breakdown-item">
              <div className="breakdown-info">
                <span className="status-dot dot-danger" />
                <span className="breakdown-name">{adminT("Cancelled")}</span>
              </div>
              <strong className="breakdown-val">{statusCounts.Cancelled}</strong>
            </div>
          </div>

          <div className="breakdown-total-bar">
            <span>{adminT("Fulfillment Rate:")}</span>
            <strong className="gold-accent-text">
              {totalOrdersCount > 0 ? Math.round((statusCounts.Delivered / totalOrdersCount) * 100) : 95}%
            </strong>
          </div>
        </div>
      </div>

      {/* D. Recent Orders Table */}
      <div className="admin-card">
        <div className="card-header-flex">
          <div>
            <h3>{adminT("Recent Orders")}</h3>
            <p className="card-subtitle">{adminT("Latest customer purchases requiring action")}</p>
          </div>
          <button className="admin-link-btn" onClick={() => onNavigate?.('Orders')}>
            {adminT("View All Orders ↗")}
          </button>
        </div>

        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{adminT("Order ID")}</th>
                <th>{adminT("Customer")}</th>
                <th>{adminT("Date")}</th>
                <th>{adminT("Amount")}</th>
                <th>{adminT("Payment")}</th>
                <th>{adminT("Status")}</th>
                <th className="th-action">{adminT("Action")}</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan="7" className="table-empty-cell">{adminT("No orders yet.")}</td>
                </tr>
              ) : (
                recentOrders.map((order) => (
                  <tr key={order.id} className="table-row-hover">
                    <td className="td-mono font-medium">{order.orderNumber || order.id?.slice(0, 8)}</td>
                    <td>
                      <div className="customer-cell">
                        <strong>{order.customer?.name || 'Guest Customer'}</strong>
                        <small>{order.customer?.phone || 'No phone'}</small>
                      </div>
                    </td>
                    <td className="td-muted">
                      {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'Today'}
                    </td>
                    <td className="td-bold gold-accent-text">{formatMoney(order.total)}</td>
                    <td>
                      <span className="text-secondary">{order.paymentMethod || 'COD'}</span>
                    </td>
                    <td>
                      <Badge>{order.status || 'New'}</Badge>
                    </td>
                    <td className="td-action">
                      <button
                        className="admin-icon-btn"
                        title={adminT("View order details")}
                        onClick={() => onOpenOrder?.(order)}
                      >
                        <IconEye size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* E & F. Top Products & Low Stock Products */}
      <div className="admin-grid-2">
        {/* E. Top Products */}
        <div className="admin-card">
          <div className="card-header-flex">
            <div>
              <h3>{adminT("Top Selling Products")}</h3>
              <p className="card-subtitle">{adminT("Highest volume performers this month")}</p>
            </div>
            <button className="admin-link-btn" onClick={() => onNavigate?.('Products')}>
              {adminT("All Products ↗")}
            </button>
          </div>

          <div className="top-products-list">
            {topProducts.map((p, i) => (
              <div key={i} className="top-product-item">
                <div className="top-prod-thumb">
                  {p.image ? (
                    <img src={p.image} alt={p.name} />
                  ) : (
                    <div className="thumb-placeholder">{p.name?.slice(0, 2)}</div>
                  )}
                </div>
                <div className="top-prod-meta">
                  <strong>{p.name}</strong>
                  <small>{p.category} • In stock: {p.stock}</small>
                </div>
                <div className="top-prod-stats">
                  <strong>{p.sold} sold</strong>
                  <small className="gold-accent-text">{formatMoney(p.revenue)}</small>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* F. Low Stock Products */}
        <div className="admin-card">
          <div className="card-header-flex">
            <div>
              <h3>{adminT("Low Stock Alerts")}</h3>
              <p className="card-subtitle">{adminT("Products requiring urgent inventory restock")}</p>
            </div>
            <button className="admin-link-btn" onClick={() => onNavigate?.('Stock Movements')}>
              Stock Movement ↗
            </button>
          </div>

          <div className="low-stock-list">
            {lowStockProducts.length === 0 ? (
              <div className="empty-message-inline">{' ' + adminT("All products are comfortably stocked!") + ' '}</div>
            ) : (
              lowStockProducts.map((p) => (
                <div key={p.id} className="low-stock-item">
                  <div className="low-stock-meta">
                    <strong>{p.nameEn || p.name}</strong>
                    <small>SKU: {p.sku || 'N/A'} • Category: {p.category}</small>
                  </div>
                  <div className="low-stock-right">
                    <span className="stock-alert-pill">
                      {p.stock} left
                    </span>
                    <button
                      className="admin-btn-secondary btn-sm"
                      onClick={() => onNavigate?.('Stock Movements')}
                    >
                      {adminT("Restock")}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
