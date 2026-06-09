import React from "react";
import "./UserStats.css";

const UserStats = ({ users }) => {
  const total = users.length;
  const superadmins = users.filter((u) => u.role === "superadmin").length;
  const riskmanagers = users.filter((u) => u.role === "risk manager").length;
  const analysts = users.filter((u) => u.role === "analyst").length;
  const active = users.filter((u) => u.status === "active").length;

  const stats = [
    {
      icon: "bi-people-fill",
      iconClass: "icon-total",
      value: total,
      label: "Total Users",
      sub: `${active} aktif saat ini`,
    },
    {
      icon: "bi-shield-fill",
      iconClass: "icon-superadmin",
      value: superadmins,
      label: "Super Admin",
      sub: "Kontrol penuh sistem",
    },
    {
      icon: "bi-person-badge-fill",
      iconClass: "icon-risk-manager",
      value: riskmanagers,
      label: "Risk Manager",
      sub: "Hak akses penuh",
    },
    {
      icon: "bi-search",
      iconClass: "icon-analyst",
      value: analysts,
      label: "Fraud Analyst",
      sub: "Review & investigasi",
    },
  ];

  return (
    <div className="user-stats-grid">
      {stats.map((s, i) => (
        <div className="stat-card" key={i}>
          <div className={`stat-icon ${s.iconClass}`}>
            <i className={`bi ${s.icon}`}></i>
          </div>
          <div className="stat-info">
            <span className="stat-value">{s.value}</span>
            <span className="stat-label">{s.label}</span>
            <span className="stat-sub">{s.sub}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default UserStats;
