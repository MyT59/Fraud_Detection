import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { storage } from "../services/apiService";
import { fetchRecentAlerts, fetchAlertCount } from "../services/AlertsService";
import NotificationDropdown from "./NotificationDropdown";
import { getRoleLabel } from "../utils/roleUi";
import "./Navbar.css";

const getInitials = (name = "") =>
  name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

const POLL_INTERVAL = 30_000; // refresh count tiap 30 detik

const Navbar = ({ onToggleSidebar }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => storage.getUser());

  // Notification state
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [alertCount, setAlertCount] = useState(0);
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [alertError, setAlertError] = useState(false);
  const bellRef = useRef(null);

  // Sync user dari storage (kalau ada tab lain yang update)
  useEffect(() => {
    const syncUser = () => setUser(storage.getUser());
    window.addEventListener("storage", syncUser);
    return () => window.removeEventListener("storage", syncUser);
  }, []);

  // Polling alert count (badge)
  const refreshCount = useCallback(async () => {
    try {
      const res = await fetchAlertCount(undefined, true);
      setAlertCount(res?.data?.count ?? 0);
    } catch {
      // Silent fail — badge tidak kritis
    }
  }, []);

  useEffect(() => {
    refreshCount();
    const timer = setInterval(refreshCount, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [refreshCount]);

  // Fetch recent alerts saat dropdown dibuka
  const openDropdown = useCallback(async () => {
    setDropdownOpen(true);
    setLoadingAlerts(true);
    setAlertError(false);
    try {
      const res = await fetchRecentAlerts();
      setRecentAlerts(res?.data ?? []);
    } catch {
      setAlertError(true);
    } finally {
      setLoadingAlerts(false);
    }
  }, []);

  const handleBellClick = () => {
    if (dropdownOpen) {
      setDropdownOpen(false);
    } else {
      openDropdown();
    }
  };

  const displayName = user?.full_name || "Admin User";
  const displayRole = getRoleLabel(user?.role);
  const initials = getInitials(displayName);

  return (
    <nav className="navbar-simple">
      <div className="navbar-container">
        <div className="navbar-left">
          <button
            className="hamburger-btn"
            onClick={onToggleSidebar}
            title="Toggle Sidebar"
          >
            <i className="bi bi-list"></i>
          </button>

          <div className="navbar-brand">
            <div className="brand-logo">
              <i className="bi bi-shield-check"></i>
            </div>
            <span className="brand-name">Fraud Detection System</span>
          </div>
        </div>

        <div className="navbar-menu">
          {/* Bell button */}
          <div className="nav-item-wrapper" ref={bellRef}>
            <button
              className={`nav-item ${dropdownOpen ? "nav-item--active" : ""}`}
              onClick={handleBellClick}
              title="Notifikasi"
            >
              <i className="bi bi-bell"></i>
              {alertCount > 0 && (
                <span className="notification-badge">
                  {alertCount > 99 ? "99+" : alertCount}
                </span>
              )}
            </button>

            {dropdownOpen && (
              <NotificationDropdown
                alerts={recentAlerts}
                loading={loadingAlerts}
                error={alertError}
                onClose={() => setDropdownOpen(false)}
              />
            )}
          </div>

          <button className="nav-item" onClick={() => navigate("/settings")}>
            <i className="bi bi-gear"></i>
          </button>

          <div className="user-profile" onClick={() => navigate("/settings")}>
            <div className="user-avatar" title={displayName}>
              {initials}
            </div>
            <div className="user-info">
              <span className="user-name">{displayName}</span>
              <span className="user-role">{displayRole}</span>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
