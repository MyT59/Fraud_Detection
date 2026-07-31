import React from "react";

/**
 * AlertsStats
 * Menampilkan statistik alert dari data API.
 * Tidak lagi menghitung lokal dari dummy data.
 * Jika API gagal (props null), tampilkan 0 atau "—".
 */
const AlertsStats = ({ stats, priorityData }) => {
  const statList = [
    {
      label: "Total Alerts",
      value: stats?.total_alerts ?? "—",
      icon: "bi-bell",
      colorClass: "stat-primary",
    },
    {
      label: "Open Critical",
      value: priorityData?.critical ?? "—",
      icon: "bi-exclamation-octagon",
      colorClass: "stat-danger",
    },
    {
      label: "Open High",
      value: priorityData?.high ?? "—",
      icon: "bi-exclamation-triangle",
      colorClass: "stat-orange",
    },
    {
      label: "Open Medium",
      value: priorityData?.medium ?? "—",
      icon: "bi-dash-circle",
      colorClass: "stat-warning",
    },
    {
      label: "Open Low",
      value: priorityData?.low ?? "—",
      icon: "bi-info-circle",
      colorClass: "stat-success",
    },
    {
      label: "Open",
      value: stats?.open_alerts ?? "—",
      icon: "bi-envelope",
      colorClass: "stat-warning",
    },
  ];

  return (
    <div className="alerts-stats-grid">
      {statList.map((s) => (
        <div key={s.label} className={`alerts-stat-card ${s.colorClass}`}>
          <div className="alerts-stat-icon">
            <i className={`bi ${s.icon}`} />
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
