import React from "react";

/**
 * ReviewStatsBar.js
 * Stats bar di bagian atas Manual Review page.
 * Menampilkan metrics dari BE (personal atau global tergantung role).
 */
const ReviewStatsBar = ({ metrics, loading }) => {
  if (loading || !metrics) return null;

  const stats = [
    {
      label: "Open Alerts",
      value: metrics.open_alerts ?? "—",
      icon: "bi-inbox-fill",
      color: "#f59e0b",
    },
    {
      label: "In Progress",
      value: metrics.in_progress_alerts ?? "—",
      icon: "bi-hourglass-split",
      color: "#3b82f6",
    },
    {
      label: "Total Reviewed",
      value: metrics.total_reviews ?? "—",
      icon: "bi-clipboard-check",
      color: "#8b5cf6",
    },
    {
      label: "Fraud Rate",
      value:
        metrics.fraud_confirmation_rate != null
          ? `${metrics.fraud_confirmation_rate.toFixed(1)}%`
          : "—",
      icon: "bi-shield-exclamation",
      color: "#ef4444",
    },
    {
      label: "Avg. Review Time",
      value:
        metrics.avg_review_duration_minutes != null
          ? `${metrics.avg_review_duration_minutes.toFixed(1)} min`
          : "—",
      icon: "bi-stopwatch",
      color: "#10b981",
    },
  ];

  return (
    <div
      style={{
        display: "flex",
        gap: ".75rem",
        flexWrap: "wrap",
        marginBottom: "1.25rem",
      }}
    >
      {stats.map((s) => (
        <div
          key={s.label}
          style={{
            flex: "1 1 120px",
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: "10px",
            padding: ".75rem 1rem",
            display: "flex",
            alignItems: "center",
            gap: ".6rem",
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "8px",
              background: `${s.color}18`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: s.color,
              fontSize: "1.1rem",
              flexShrink: 0,
            }}
          >
            <i className={`bi ${s.icon}`} />
          </div>
          <div>
            <div
              style={{ fontSize: ".72rem", color: "#64748b", fontWeight: 500 }}
            >
              {s.label}
            </div>
            <div
              style={{ fontSize: "1.05rem", fontWeight: 700, color: "#0f172a" }}
            >
              {s.value}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ReviewStatsBar;
