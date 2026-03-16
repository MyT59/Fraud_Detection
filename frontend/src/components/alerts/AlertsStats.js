import React from 'react';

// Menerima dua bentuk props:
//   <AlertsStats stats={apiStats} />           ← dari API langsung
//   <AlertsStats alerts={localAlertsArray} />  ← hitung sendiri (fallback)
const AlertsStats = ({ alerts, stats }) => {
  const data = stats || {
    total:    (alerts || []).length,
    critical: (alerts || []).filter(a => a.severity === 'critical').length,
    unread:   (alerts || []).filter(a => a.status   === 'unread').length,
    resolved: (alerts || []).filter(a => a.status   === 'resolved').length,
  };

  const statList = [
    { label: 'Total Alerts',  value: data.total,    icon: 'bi-bell',                colorClass: 'stat-primary' },
    { label: 'Critical',      value: data.critical, icon: 'bi-exclamation-octagon', colorClass: 'stat-danger'  },
    { label: 'Belum Dibaca',  value: data.unread,   icon: 'bi-envelope',            colorClass: 'stat-warning' },
    { label: 'Resolved',      value: data.resolved, icon: 'bi-check-circle',        colorClass: 'stat-success' },
  ];

  return (
    <div className="alerts-stats-grid">
      {statList.map(s => (
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