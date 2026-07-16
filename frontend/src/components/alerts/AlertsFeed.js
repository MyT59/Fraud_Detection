import React from "react";
import AlertItem from "./AlertItem";

const AlertsFeed = ({
  alerts,
  pendingOps = {},
  onResolve,
  onClaim,
  onDelete,
  onViewDetail,
  mode = "all",
  canClaim = false,
}) => {
  if (alerts.length === 0) {
    return (
      <div className="alerts-empty">
        <i className="bi bi-bell-slash" />
        <h4>Tidak ada alert ditemukan</h4>
        <p>Coba ubah filter, keyword, atau mode queue.</p>
      </div>
    );
  }

  return (
    <section className="alerts-feed-card">
      <div className="alerts-feed-header">
        <div>
          <h2 className="alerts-feed-title">
            <i className={mode === "open" ? "bi bi-inbox-fill" : "bi bi-list-ul"} />
            {mode === "open" ? "Open Queue" : "All Alerts"}
          </h2>
          <p>
            {mode === "open"
              ? canClaim
                ? "Alert yang tersedia untuk diklaim dan diproses di Fraud Analysts."
                : "Alert terbuka yang belum diklaim oleh fraud analyst."
              : "Riwayat dan status seluruh alert dari sistem deteksi fraud."}
          </p>
        </div>
        <span className="alerts-feed-count">{alerts.length} alert</span>
      </div>
      <div className="alerts-feed-list">
        {alerts.map((alert) => (
          <AlertItem
            key={alert.id}
            alert={alert}
            pending={pendingOps[alert.id] || null}
            onResolve={onResolve}
            onClaim={onClaim}
            onDelete={onDelete}
            onViewDetail={onViewDetail}
          />
        ))}
      </div>
    </section>
  );
};

export default AlertsFeed;
