import React from "react";

const AlertsHeader = ({ totalUnread }) => {
  return (
    <div className="alerts-page-header">
      <div className="alerts-header-left">
        <div className="alerts-header-icon">
          <i className="bi bi-bell-fill"></i>
          {totalUnread > 0 && (
            <span className="alerts-header-badge">
              {totalUnread > 99 ? "99+" : totalUnread}
            </span>
          )}
        </div>
        <div>
          <h1 className="alerts-title">
            Alerts Log
          </h1>
          <p className="alerts-subtitle">
            {totalUnread > 0
              ? `${totalUnread} notifikasi menunggu`
              : "Semua notifikasi sudah ditangani"}
          </p>
        </div>
      </div>
    </div>
  );
};

export default AlertsHeader;
