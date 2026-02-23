import React from 'react';

const AlertsStats = ({ alerts }) => {
  const total    = alerts.length;
  const critical = alerts.filter(a => a.severity === 'critical').length;
  const unread   = alerts.filter(a => a.status === 'unread').length;
  const resolved = alerts.filter(a => a.status === 'resolved').length;

  const stats = [
    { label: 'Total Alerts',  value: total,    icon: 'bi-bell',                colorClass: 'stat-primary' },
    { label: 'Critical',      value: critical, icon: 'bi-exclamation-octagon', colorClass: 'stat-danger'  },
    { label: 'Belum Dibaca',  value: unread,   icon: 'bi-envelope',            colorClass: 'stat-warning' },
    { label: 'Resolved',      value: resolved, icon: 'bi-check-circle',        colorClass: 'stat-success' },
  ];

  return (
    <div className="alerts-stats-grid">
      {stats.map((s) => (
        <div key={s.label} className={`alerts-stat-card ${s.colorClass}`}>
          <div className="alerts-stat-icon">
            <i className={`bi ${s.icon}`}></i>
          </div>
          <div className="alerts-stat-content">
            <div className="alerts-stat-value">{s.value}</div>
            <div className="alerts-stat-label">{s.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default AlertsStats;