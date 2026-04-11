import React from "react";

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
    },
    {
      label: "Di-Pause",
      value: stats.paused,
      icon: "bi-pause-circle-fill",
      colorClass: "stat-card--paused",
    },
    {
      label: "Harian",
      value: stats.daily,
      icon: "bi-arrow-clockwise",
      colorClass: "stat-card--daily",
    },
    {
      label: "Mingguan",
      value: stats.weekly,
      icon: "bi-calendar-week",
      colorClass: "stat-card--weekly",
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
          </div>
        </div>
      ))}
    </div>
  );
};

export default ScheduleStats;
