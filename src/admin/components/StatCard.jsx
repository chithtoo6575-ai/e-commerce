import React from 'react'
import { IconTrendingUp } from '../AdminIcons'

export default function StatCard({
  title,
  value,
  change,
  isPositive = true,
  icon,
  badgeText
}) {
  return (
    <div className="admin-stat-card">
      <div className="stat-card-top">
        <span className="stat-card-title">{title}</span>
        {icon && <div className="stat-card-icon">{icon}</div>}
      </div>
      <div className="stat-card-value">{value}</div>
      <div className="stat-card-bottom">
        {change && (
          <span className={`stat-card-trend ${isPositive ? 'trend-up' : 'trend-neutral'}`}>
            {isPositive && <IconTrendingUp size={13} />}
            <span>{change}</span>
          </span>
        )}
        {badgeText && <span className="stat-card-badge">{badgeText}</span>}
      </div>
    </div>
  )
}
