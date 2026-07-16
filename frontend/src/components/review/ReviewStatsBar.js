import React from "react";

/**
 * ReviewStatsBar.js
 * Stats bar di bagian atas Manual Review page.
 * Menampilkan metrics dari BE (personal atau global tergantung role).
 */
const ReviewStatsBar = ({ metrics, loading, isPersonal = false }) => {
  if (loading || !metrics) return null;

  const stats = [
    {
      label: isPersonal ? "Available Alerts" : "Open Alerts",
      value: metrics.open_alerts ?? "-",
      icon: "bi-inbox-fill",
      color: "#f59e0b",
    },
    {
      label: isPersonal ? "My In Progress" : "In Progress",
      value: metrics.in_progress_alerts ?? "-",
      icon: "bi-hourglass-split",
      color: "#3b82f6",
    },
    {
      label: isPersonal ? "My Reviewed" : "Total Reviewed",
      value: metrics.total_reviews ?? "-",
      icon: "bi-clipboard-check",
      color: "#8b5cf6",
    },
    {
      label: "Fraud Rate",
      value:
        metrics.fraud_confirmation_rate != null
          ? `${metrics.fraud_confirmation_rate.toFixed(1)}%`
          : "-",
      icon: "bi-shield-exclamation",
      color: "#ef4444",
    },
    {
      label: "Avg. Review Time",
      value:
        metrics.avg_review_duration_minutes != null
          ? `${metrics.avg_review_duration_minutes.toFixed(1)} min`
          : "-",
      icon: "bi-stopwatch",
      color: "#10b981",
    },
  ];

  return (
    <div className="review-stats-grid">
      {stats.map((s) => (
        <div className="review-stat-card" key={s.label}>
          <div
            className="review-stat-icon"
            style={{ background: `${s.color}18`, color: s.color }}
          >
            <i className={`bi ${s.icon}`} />
          </div>
          <div className="review-stat-copy">
            <span>{s.label}</span>
            <strong>{s.value}</strong>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ReviewStatsBar;
