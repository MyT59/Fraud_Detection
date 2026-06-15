import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./NotificationDropdown.css";

const SEVERITY_CONFIG = {
  CRITICAL: { label: "CRITICAL", color: "#dc2626", bg: "#fef2f2" },
  HIGH: { label: "HIGH", color: "#ea580c", bg: "#fff7ed" },
  MEDIUM: { label: "MEDIUM", color: "#d97706", bg: "#fffbeb" },
  LOW: { label: "LOW", color: "#16a34a", bg: "#f0fdf4" },
};

const NotificationDropdown = ({ alerts, loading, error, onClose }) => {
  const navigate = useNavigate();
  const ref = useRef(null);

  // Tutup dropdown kalau klik di luar
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const handleViewAll = () => {
    navigate("/alerts");
    onClose();
  };

  const handleItemClick = () => {
    navigate("/alerts");
    onClose();
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="notif-state">
          <div className="notif-spinner" />
          <span>Memuat notifikasi...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="notif-state notif-state--error">
          <i className="bi bi-exclamation-circle" />
          <span>Gagal memuat notifikasi</span>
        </div>
      );
    }

    if (!alerts || alerts.length === 0) {
      return (
        <div className="notif-state">
          <i className="bi bi-bell-slash" />
          <span>Tidak ada alert terbaru</span>
        </div>
      );
    }

    return alerts.map((alert) => {
      const sev =
        SEVERITY_CONFIG[alert.severity?.toUpperCase()] || SEVERITY_CONFIG.LOW;
      return (
        <div key={alert.id} className="notif-item" onClick={handleItemClick}>
          <div className="notif-item__header">
            <span className="notif-item__title">
              {alert.title || alert.type || "Alert"}
            </span>
            <span
              className="notif-item__badge"
              style={{ color: sev.color, background: sev.bg }}
            >
              {sev.label}
            </span>
          </div>
          <div className="notif-item__meta">
            <span className="notif-item__type">{alert.type}</span>
            <span className="notif-item__time">{alert.time}</span>
          </div>
        </div>
      );
    });
  };

  return (
    <div className="notif-dropdown" ref={ref}>
      <div className="notif-dropdown__header">
        <span className="notif-dropdown__title">Notifikasi Terbaru</span>
      </div>

      <div className="notif-dropdown__body">{renderContent()}</div>

      <div className="notif-dropdown__footer" onClick={handleViewAll}>
        Lihat semua alerts
        <i className="bi bi-arrow-right" />
      </div>
    </div>
  );
};

export default NotificationDropdown;
