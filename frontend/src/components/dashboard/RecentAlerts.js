import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./RecentAlerts.css";

const STATIC_ALERTS = [
  {
    id: "static-1",
    type: "high",
    title: "Fraud Terdeteksi — Blacklist Hit",
    description:
      "Rekening ACCT100114 terdeteksi pola brute force PIN di terminal T1023.",
    time: "2 minutes ago",
    userId: "AGN-001783",
    amount: null,
    icon: "bi-ban",
  },
  {
    id: "static-2",
    type: "high",
    title: "Rule Engine — Transfer Besar",
    description:
      "Rule Transfer Besar terpicu pada akun ACCT100235. Jumlah Rp 113.137.",
    time: "15 minutes ago",
    userId: "AGN-003648",
    amount: null,
    icon: "bi-gear-fill",
  },
  {
    id: "static-3",
    type: "high",
    title: "Fraud Terdeteksi — NusaBill",
    description:
      "Pembayaran mencurigakan oleh CUST10000 via Web. Bill ID: BILL280462.",
    time: "1 hour ago",
    userId: "NUS-004798",
    amount: null,
    icon: "bi-exclamation-triangle-fill",
  },
  {
    id: "static-4",
    type: "medium",
    title: "Rule Engine — API Burst Payment",
    description: "Rule Burst Payment via API terpicu pada pelanggan CUST10318.",
    time: "2 hours ago",
    userId: "NUS-004818",
    amount: null,
    icon: "bi-gear-fill",
  },
  {
    id: "static-5",
    type: "high",
    title: "Manual Review — Antrian Menumpuk",
    description: "Terdapat transaksi menunggu review lebih dari 2 jam.",
    time: "3 hours ago",
    userId: "—",
    amount: null,
    icon: "bi-clipboard-check",
  },
];
const STATIC_SUMMARY = { high: 3, medium: 1, low: 0 };

const getSeverityColor = (t) =>
  t === "high"
    ? "severity-high"
    : t === "medium"
      ? "severity-medium"
      : "severity-low";

const getSeverityLabel = (t) =>
  t === "high" ? "High Risk" : t === "medium" ? "Medium Risk" : "Low Risk";

const RecentAlerts = ({ alerts, summary }) => {
  const navigate = useNavigate();

  const displayAlerts = alerts && alerts.length > 0 ? alerts : STATIC_ALERTS;
  const displaySummary = summary || STATIC_SUMMARY;

  const [dismissed, setDismissed] = useState(new Set());
  const visible = displayAlerts.filter((a) => !dismissed.has(a.id));

  return (
    <div className="recent-alerts-card">
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
            <div key={alert.id} className="alert-item">
              <div
                className={`alert-indicator ${getSeverityColor(alert.type)}`}
              >
                <i className={alert.icon || "bi-exclamation-triangle-fill"}></i>
              </div>

              <div className="alert-content">
                <div className="alert-header-row">
                  <h4 className="alert-title">{alert.title}</h4>
                  <span
                    className={`severity-badge ${getSeverityColor(alert.type)}`}
                  >
                    {getSeverityLabel(alert.type)}
                  </span>
                </div>

                <p className="alert-description">{alert.description}</p>

                <div className="alert-meta">
                  {alert.userId && alert.userId !== "—" && (
                    <span className="meta-item">
                      <i className="bi bi-hash"></i>
                      {alert.userId}
                    </span>
                  )}
                  {alert.amount && (
                    <span className="meta-item">
                      <i className="bi bi-currency-dollar"></i>
                      {alert.amount}
                    </span>
                  )}
                  <span className="meta-item time">
                    <i className="bi bi-clock"></i>
                    {alert.time}
                  </span>
                </div>
              </div>

              <div className="alert-actions">
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
            {displaySummary.low} Low Risk
          </span>
        </div>
      </div>
    </div>
  );
};

export default RecentAlerts;
