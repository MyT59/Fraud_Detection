import React from "react";

const AlertsStats = ({ alerts, stats }) => {
  const data = stats || {
    total: (alerts || []).length,
    critical: (alerts || []).filter((a) => a.severity === "critical").length,
    high: (alerts || []).filter((a) => a.severity === "high").length,
    medium: (alerts || []).filter((a) => a.severity === "medium").length,
    low: (alerts || []).filter((a) => a.severity === "low").length,
    approved: (alerts || []).filter((a) => a.status === "approved").length,
    rejected: (alerts || []).filter((a) => a.status === "rejected").length,
    unread: (alerts || []).filter((a) => a.status === "unread").length,
  };

  const statList = [
    {
      label: "Total Alerts",
      value: data.total,
      icon: "bi-bell",
      colorClass: "stat-primary",
    },
    {
      label: "Critical",
      value: data.critical,
      icon: "bi-exclamation-octagon",
      colorClass: "stat-danger",
    },
    {
      label: "High",
      value: data.high,
      icon: "bi-exclamation-triangle",
      colorClass: "stat-orange",
    },
    {
      label: "Medium",
      value: data.medium,
      icon: "bi-dash-circle",
      colorClass: "stat-warning",
    },
    {
      label: "Low",
      value: data.low,
      icon: "bi-info-circle",
      colorClass: "stat-success",
    },
    {
      label: "Approved",
      value: data.approved,
      icon: "bi-check-circle",
      colorClass: "stat-teal",
    },
    {
      label: "Rejected",
      value: data.rejected,
      icon: "bi-x-circle",
      colorClass: "stat-red",
    },
    {
      label: "Belum Dibaca",
      value: data.unread,
      icon: "bi-envelope",
      colorClass: "stat-warning",
    },
  ];

  return (
    <div className="alerts-stats-grid">
      {statList.map((s) => (
        <div key={s.label} className={`alerts-stat-card ${s.colorClass}`}>
          <div className="alerts-stat-icon">
            <i className={`bi ${s.icon}`}></i>
          </div>
          <div className="alerts-stat-content">
            <div className="alerts-stat-value">{s.value ?? 0}</div>
            <div className="alerts-stat-label">{s.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default AlertsStats;
