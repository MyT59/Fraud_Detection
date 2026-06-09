import React from "react";
import "./HistoryStats.css";

/**
 * HistoryStats
 * Menampilkan statistik dari GET /reviews/metrics.
 * Tidak menghitung lokal dari array items — data lokal tidak reliable
 * karena items hanya 1 page (10 record), bukan total keseluruhan.
 * Jika metrics null (API gagal), tampilkan "—".
 */
const HistoryStats = ({ metrics = null, metricsLoading = false }) => {
  const fraudRate =
    metrics?.fraud_confirmation_rate != null
      ? `${metrics.fraud_confirmation_rate.toFixed(1)}%`
      : "—";

  const approvalRate =
    metrics?.fraud_confirmation_rate != null
      ? `${(100 - metrics.fraud_confirmation_rate).toFixed(1)}%`
      : "—";

  const avgDuration =
    metrics?.avg_review_duration_minutes != null
      ? `${metrics.avg_review_duration_minutes.toFixed(1)} min avg`
      : "—";

  const cards = [
    {
      id: "total",
      label: "Total Reviewed",
      value: metrics?.total_reviews ?? "—",
      icon: "bi-clipboard-check",
      color: "purple",
      sub: avgDuration,
    },
    {
      id: "safe",
      label: "Safe (Approved)",
      value: metrics?.safe_count ?? "—",
      icon: "bi-check-circle-fill",
      color: "success",
      sub: `${approvalRate} approval rate`,
    },
    {
      id: "fraud",
      label: "Fraud (Rejected)",
      value: metrics?.fraud_count ?? "—",
      icon: "bi-x-circle-fill",
      color: "danger",
      sub: `${fraudRate} fraud confirmation`,
    },
  ];

  const hasQueueData =
    metrics &&
    (metrics.open_alerts != null || metrics.in_progress_alerts != null);

  return (
    <div className="history-stats-container">
      {cards.map((card) => (
        <div key={card.id} className={`hstat-card hstat-${card.color}`}>
          <div className={`hstat-icon bg-${card.color}`}>
            <i className={`bi ${card.icon}`} />
          </div>
          <div className="hstat-content">
            <span className="hstat-label">{card.label}</span>
            {metricsLoading ? (
              <span className="hstat-value hstat-skeleton" />
            ) : (
              <span className="hstat-value">{card.value}</span>
            )}
            <span className="hstat-sub">{card.sub}</span>
          </div>
        </div>
      ))}

      {/* Alert Queue card — hanya tampil jika metrics tersedia */}
      {hasQueueData && (
        <div className="hstat-card hstat-info">
          <div className="hstat-icon bg-info">
            <i className="bi bi-hourglass-split" />
          </div>
          <div className="hstat-content">
            <span className="hstat-label">Alert Queue</span>
            {metricsLoading ? (
              <span className="hstat-value hstat-skeleton" />
            ) : (
              <span className="hstat-value">
                {(metrics.open_alerts ?? 0) + (metrics.in_progress_alerts ?? 0)}
              </span>
            )}
            <span className="hstat-sub">
              {metrics.open_alerts ?? 0} open ·{" "}
              {metrics.in_progress_alerts ?? 0} in-progress
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoryStats;
