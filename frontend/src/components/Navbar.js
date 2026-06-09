import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { storage } from "../services/apiService";
import "./Navbar.css";

const ROLE_LABEL = {
  SUPER_ADMIN: "Super Admin",
  RISK_MANAGER: "Risk Manager",
  FRAUD_ANALYST: "Fraud Analyst",
};

const getInitials = (name = "") =>
  name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

const Navbar = ({ onToggleSidebar }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => storage.getUser());

  useEffect(() => {
    const syncUser = () => setUser(storage.getUser());
    window.addEventListener("storage", syncUser);
    return () => window.removeEventListener("storage", syncUser);
  }, []);

  const displayName = user?.full_name || "Admin User";
  const displayRole = ROLE_LABEL[user?.role] || user?.role || "Administrator";
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
          <button className="nav-item" onClick={() => navigate("/alerts")}>
            <i className="bi bi-bell"></i>
            <span className="notification-dot"></span>
          </button>
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
