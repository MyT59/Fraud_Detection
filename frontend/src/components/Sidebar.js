import React from "react";
import { NavLink } from "react-router-dom";
import { authService } from "../services/AuthService"; // ✅ FIX
import "./Sidebar.css";

const Sidebar = ({ isOpen, onClose, collapsed, onToggleCollapse }) => {
  const user = authService.getCurrentUser();
  const role = user?.role || null;

  const isRiskManager = role === "RISK_MANAGER";
  const isSuperAdmin = role === "SUPER_ADMIN";
  const isFraudAnalyst = role === "FRAUD_ANALYST";
  const canManage = isRiskManager || isSuperAdmin;
  const canViewFraudPatterns = canManage || isFraudAnalyst;

  const menuItems = [
    { path: "/dashboard", icon: "bi-speedometer2", label: "Dashboard" },
    { path: "/alerts", icon: "bi-bell-fill", label: "Alerts" },
    {
      path: "/manual-review",
      icon: "bi-clipboard-check",
      label: "Manual Review",
    },
    {
      path: "/review-history",
      icon: "bi-clock-history",
      label: "Review History",
    },
    {
      path: "/transactions",
      icon: "bi-arrow-left-right",
      label: "Transactions",
    },
    ...(canViewFraudPatterns
      ? [
          {
            path: "/fraud-patterns",
            icon: "bi-bug-fill",
            label: "Fraud Patterns",
          },
        ]
      : []),
    {
      path: "/activity-timeline",
      icon: "bi-activity",
      label: "Activity Timeline",
    },
    { path: "/reports", icon: "bi-file-earmark-text", label: "Reports" },
    ...(canManage
      ? [
          {
            path: "/risk-management",
            icon: "bi-shield-fill-exclamation",
            label: "Risk Management",
          },
        ]
      : []),
  ];

  const adminMenu = canManage
    ? [
        ...(isSuperAdmin
          ? [
              {
                path: "/super-admin",
                icon: "bi-shield-lock-fill",
                label: "Super Admin",
              },
            ]
          : []),
        { path: "/audit-log", icon: "bi-journal-text", label: "Audit Log" },
        ...(isSuperAdmin
          ? [
              {
                path: "/retrain-schedule",
                icon: "bi-cpu",
                label: "Retrain Schedule",
              },
            ]
          : []),
      ]
    : [];

  const handleLinkClick = () => {
    if (window.innerWidth <= 992) onClose();
  };

  const renderMenuItem = (item) => (
    <li key={item.path} className="sidebar-menu-item">
      <NavLink
        to={item.path}
        className={({ isActive }) =>
          `sidebar-menu-link ${isActive ? "active" : ""}`
        }
        onClick={handleLinkClick}
        title={collapsed ? item.label : ""}
      >
        <i className={`bi ${item.icon}`} />
        {!collapsed && (
          <>
            <span className="sidebar-menu-label">{item.label}</span>
            {item.badge && (
              <span className="sidebar-menu-badge">{item.badge}</span>
            )}
          </>
        )}
        {collapsed && item.badge && (
          <span className="sidebar-badge-dot">{item.badge}</span>
        )}
      </NavLink>
    </li>
  );

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}
      <aside
        className={`sidebar ${isOpen ? "open" : ""} ${collapsed ? "collapsed" : ""}`}
      >
        <button
          className="sidebar-collapse-btn"
          onClick={onToggleCollapse}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <i
            className={`bi ${collapsed ? "bi-chevron-right" : "bi-chevron-left"}`}
          />
          {!collapsed && <span>Tutup</span>}
        </button>
        <nav className="sidebar-nav">
          <ul className="sidebar-menu">{menuItems.map(renderMenuItem)}</ul>
          {canManage && adminMenu.length > 0 && (
            <>
              {!collapsed && (
                <>
                  <div
                    style={{
                      margin: "12px 12px 4px",
                      borderTop: "1px solid #f3f4f6",
                    }}
                  />
                  <p
                    style={{
                      padding: "4px 22px",
                      fontSize: ".68rem",
                      fontWeight: 700,
                      color: "#d1d5db",
                      textTransform: "uppercase",
                      letterSpacing: ".08em",
                      margin: 0,
                    }}
                  >
                    Control Panel
                  </p>
                </>
              )}
              {collapsed && (
                <div
                  style={{ margin: "12px 8px", borderTop: "1px solid #f3f4f6" }}
                />
              )}
              <ul className="sidebar-menu">{adminMenu.map(renderMenuItem)}</ul>
            </>
          )}
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;
