import React from 'react';

const AlertsHeader = ({ totalUnread, onMarkAllRead, onClearAll }) => {
  return (
    <div className="alerts-page-header">
      <div className="alerts-header-left">
        <div className="alerts-header-icon">
          <i className="bi bi-bell-fill"></i>
          {totalUnread > 0 && (
            <span className="alerts-header-badge">{totalUnread > 99 ? '99+' : totalUnread}</span>
          )}
        </div>
        <div>
          <h1 className="alerts-title">Alerts Log</h1>
          <p className="alerts-subtitle">
            {totalUnread > 0
              ? `${totalUnread} notifikasi belum dibaca`
              : 'Semua notifikasi sudah dibaca'}
          </p>
        </div>
      </div>
      <div className="alerts-header-actions">
        <button className="alerts-btn-outline" onClick={onMarkAllRead}>
          <i className="bi bi-check2-all"></i>
          Tandai Semua Dibaca
        </button>
        <button className="alerts-btn-ghost" onClick={onClearAll}>
          <i className="bi bi-trash3"></i>
          Hapus Semua
        </button>
      </div>
    </div>
  );
};

export default AlertsHeader;