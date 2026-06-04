import React from "react";
import "./HistoryStats.css";

const HistoryStats = ({
  data = [],
  metrics = null,
  metricsLoading = false,
}) => {
  const total = metrics ? metrics.total_reviews : data.length;
  const approved = metrics
    ? metrics.safe_count
    : data.filter((d) => d.action === "approved").length;
  const rejected = metrics
    ? metrics.fraud_count
    : data.filter((d) => d.action === "rejected").length;

  const approvalRate = metrics
    ? (100 - metrics.fraud_confirmation_rate).toFixed(1)
    : total > 0
      ? ((approved / total) * 100).toFixed(1)
      : "0.0";

  const fraudRate = metrics
    ? metrics.fraud_confirmation_rate.toFixed(1)
    : total > 0
      ? ((rejected / total) * 100).toFixed(1)
      : "0.0";

  const avgDuration = metrics
    ? metrics.avg_review_duration_minutes != null
      ? `${metrics.avg_review_duration_minutes.toFixed(1)} min avg`
      : "—"
    : null;

  const openAlerts = metrics?.open_alerts ?? null;
  const inProgressAlerts = metrics?.in_progress_alerts ?? null;

  const cards = [
    {
      id: 1,
      label: "Total Reviewed",
      value: total,
      icon: "bi-clipboard-check",
      color: "purple",
      sub: avgDuration ?? "All-time entries",
    },
    {
      id: 2,
      label: "Safe (Approved)",
      value: approved,
      icon: "bi-check-circle-fill",
      color: "success",
      sub: `${approvalRate}% approval rate`,
    },
    {
      id: 3,
      label: "Fraud (Rejected)",
      value: rejected,
      icon: "bi-x-circle-fill",
      color: "danger",
      sub: `${fraudRate}% fraud confirmation`,
    },
  ];

  return (
    <div className="history-stats-container">
      {cards.map((card) => (
        <div key={card.id} className={`hstat-card hstat-${card.color}`}>
          <div className={`hstat-icon bg-${card.color}`}>
            <i className={`bi ${card.icon}`}></i>
          </div>
          <div className="hstat-content">
            <span className="hstat-label">{card.label}</span>

            {metricsLoading ? (
              <span className="hstat-value hstat-skeleton">—</span>
            ) : (
              <span className="hstat-value">{card.value}</span>
            )}

            <span className="hstat-sub">{card.sub}</span>
          </div>
        </div>
      ))}

      {metrics && (openAlerts !== null || inProgressAlerts !== null) && (
        <div className="hstat-card hstat-info">
          <div className="hstat-icon bg-info">
            <i className="bi bi-hourglass-split"></i>
          </div>
          <div className="hstat-content">
            <span className="hstat-label">Alert Queue</span>
            {metricsLoading ? (
              <span className="hstat-value hstat-skeleton">—</span>
            ) : (
              <span className="hstat-value">
                {(openAlerts ?? 0) + (inProgressAlerts ?? 0)}
              </span>
            )}
            <span className="hstat-sub">
              {openAlerts ?? 0} open · {inProgressAlerts ?? 0} in-progress
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoryStats;
