import React from "react";
import AlertItem from "./AlertItem";

const AlertsFeed = ({ alerts, onMarkRead, onResolve, onDelete }) => {
  if (alerts.length === 0) {
    return (
      <div className="alerts-empty">
        <i className="bi bi-bell-slash"></i>
        <h4>Tidak ada alert ditemukan</h4>
        <p>Coba ubah filter atau cari dengan kata kunci lain</p>
      </div>
    );
  }

  return (
    <div className="alerts-feed-card">
      <div className="alerts-feed-header">
        <h2 className="alerts-feed-title">
          <i className="bi bi-list-ul"></i>
          Log Alert
          <span className="alerts-feed-count">({alerts.length} entri)</span>
        </h2>
      </div>
      <div className="alerts-feed-list">
        {alerts.map((alert) => (
          <AlertItem
            key={alert.id}
            alert={alert}
            onMarkRead={onMarkRead}
            onResolve={onResolve}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
};

export default AlertsFeed;
