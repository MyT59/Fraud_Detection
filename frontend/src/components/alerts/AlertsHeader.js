import React from "react";

const AlertsHeader = ({ totalUnread, onClearAll, isLive }) => {
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
            {isLive && (
              <span
                style={{
                  marginLeft: 10,
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 10,
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  color: "#059669",
                  verticalAlign: "middle",
                }}
              >
                <i
                  className="bi bi-circle-fill"
                  style={{ fontSize: "0.45rem", marginRight: 4 }}
                ></i>
                Live
              </span>
            )}
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
