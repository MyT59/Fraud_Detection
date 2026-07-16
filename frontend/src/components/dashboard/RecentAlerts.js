import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./RecentAlerts.css";

const EMPTY_SUMMARY = { high: 0, medium: 0, low: 0 };

const getSeverityColor = (t) =>
  t === "high"
    ? "severity-high"
    : t === "medium"
      ? "severity-medium"
      : "severity-low";

const getSeverityLabel = (t) =>
  t === "high" ? "High Risk" : t === "medium" ? "Medium Risk" : "Safe";

const RecentAlerts = ({ alerts, summary, variant = "card" }) => {
  const navigate = useNavigate();

  const displayAlerts = Array.isArray(alerts) ? alerts : [];
  const displaySummary = summary || EMPTY_SUMMARY;

  const [dismissed, setDismissed] = useState(new Set());
  const visible = displayAlerts.filter((a) => !dismissed.has(a.id));

  return (
    <div className={`recent-alerts-card recent-alerts-${variant}`}>
      <div className="alerts-header">
        <div className="header-left">
          <h3 className="alerts-title">
            <i className="bi bi-bell-fill"></i>
            Recent Alerts
          </h3>
          <p className="alerts-subtitle">
            Fraud & rule engine alerts terbaru
            {alerts && alerts.length > 0 && (
              <span
                style={{
                  marginLeft: 8,
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  color: "#059669",
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  padding: "1px 8px",
                  borderRadius: 10,
                }}
              >
                {alerts.length} live
              </span>
            )}
          </p>
        </div>
        <button className="btn-view-all" onClick={() => navigate("/alerts")}>
          View All <i className="bi bi-arrow-right"></i>
        </button>
      </div>

      <div
        className="alerts-list"
        style={{ maxHeight: 380, overflowY: "auto" }}
      >
        {visible.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "40px 24px",
              color: "#9ca3af",
              gap: 8,
            }}
          >
            <i
              className="bi bi-bell-slash"
              style={{ fontSize: "2rem", opacity: 0.4 }}
            ></i>
            <p style={{ margin: 0, fontSize: "0.875rem" }}>No alerts</p>
          </div>
        ) : (
          visible.map((alert) => (
            <div key={alert.id} className="recent-alert-item">
              <div
                className={`recent-alert-indicator ${getSeverityColor(alert.type)}`}
              >
                <i className={alert.icon || "bi-exclamation-triangle-fill"}></i>
              </div>

              <div className="recent-alert-content">
                <h4 className="recent-alert-title">{alert.title}</h4>

                <p className="recent-alert-description">{alert.description}</p>

                <div className="recent-alert-meta">
                  {alert.userId && alert.userId !== "-" && (
                    <span className="recent-meta-item">
                      <i className="bi bi-hash"></i>
                      {alert.userId}
                    </span>
                  )}
                  {alert.amount && (
                    <span className="recent-meta-item">
                      <i className="bi bi-currency-dollar"></i>
                      {alert.amount}
                    </span>
                  )}
                  <span className="recent-meta-item time">
                    <i className="bi bi-clock"></i>
                    {alert.time}
                  </span>
                </div>
              </div>

              <div className="recent-alert-actions">
                <span
                  className={`severity-badge ${getSeverityColor(alert.type)}`}
                >
                  {getSeverityLabel(alert.type)}
                </span>
                <button
                  className="btn-action btn-investigate"
                  title="Lihat detail"
                  onClick={() => navigate("/alerts")}
                >
                  <i className="bi bi-search"></i>
                </button>
                <button
                  className="btn-action btn-dismiss"
                  title="Dismiss"
                  onClick={() =>
                    setDismissed((prev) => new Set([...prev, alert.id]))
                  }
                >
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="alerts-footer">
        <div className="alert-summary">
          <span className="summary-item">
            <span className="dot severity-high"></span>
            {displaySummary.high} High Risk
          </span>
          <span className="summary-item">
            <span className="dot severity-medium"></span>
            {displaySummary.medium} Medium Risk
          </span>
          <span className="summary-item">
            <span className="dot severity-low"></span>
            {displaySummary.low} Safe
          </span>
        </div>
      </div>
    </div>
  );
};

export default RecentAlerts;
