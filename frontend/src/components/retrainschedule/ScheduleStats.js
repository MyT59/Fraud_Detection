import React from "react";

/* ═══════════════════════════════════════════
   ScheduleStats — Summary stat cards
═══════════════════════════════════════════ */
const ScheduleStats = ({ stats }) => {
  const cards = [
    {
      label: "Total Schedule",
      value: stats.total,
      icon: "bi-calendar2-check",
      colorClass: "stat-card--total",
    },
    {
      label: "Aktif",
      value: stats.active,
      icon: "bi-play-circle-fill",
      colorClass: "stat-card--active",
      sub: `${stats.daily} harian · ${stats.weekly} mingguan`,
    },
    {
      label: "Di-Pause",
      value: stats.paused,
      icon: "bi-pause-circle-fill",
      colorClass: "stat-card--paused",
    },
    {
      label: "Bulanan",
      value: stats.monthly,
      icon: "bi-calendar-month",
      colorClass: "stat-card--monthly",
    },
  ];

  return (
    <div className="rs-stats-grid">
      {cards.map((c) => (
        <div key={c.label} className={`rs-stat-card ${c.colorClass}`}>
          <div className="rs-stat-card__icon">
            <i className={`bi ${c.icon}`} />
          </div>
          <div className="rs-stat-card__body">
            <span className="rs-stat-card__val">{c.value}</span>
            <span className="rs-stat-card__lbl">{c.label}</span>
            {c.sub && <span className="rs-stat-card__sub">{c.sub}</span>}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ScheduleStats;