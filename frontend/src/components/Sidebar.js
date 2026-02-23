import React from "react";
import { NavLink } from "react-router-dom";
import "./Sidebar.css";

const Sidebar = ({ isOpen, onClose }) => {
  const menuItems = [
    { path: "/dashboard",          icon: "bi-speedometer2",            label: "Dashboard" },
    { path: "/risk-management",    icon: "bi-shield-fill-exclamation", label: "Risk Management" },
    { path: "/manual-review",      icon: "bi-clipboard-check",         label: "Manual Review", badge: "3" },
    { path: "/review-history",     icon: "bi-clock-history",           label: "Review History" },
    { path: "/transactions",       icon: "bi-arrow-left-right",        label: "Transactions" },
    { path: "/analytics",          icon: "bi-bar-chart",               label: "Analytics" },
    { path: "/activity-timeline",  icon: "bi-activity",                label: "Activity Timeline" },
    { path: "/reports",            icon: "bi-file-earmark-text",       label: "Reports" },
  ];

  const adminMenu = [
    { path: "/super-admin",    icon: "bi-shield-lock-fill", label: "Super Admin" },
    { path: "/audit-log",      icon: "bi-clock-history",    label: "Audit Log" },
    { path: "/alerts",         icon: "bi-bell-fill",        label: "Alerts Log" },
    { path: "/fraud-patterns", icon: "bi-bug-fill",         label: "Fraud Patterns" },
    { path: "/settings",       icon: "bi-gear",             label: "Settings" },
  ];

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar ${isOpen ? "open" : ""}`}>
        <nav className="sidebar-nav">
          <ul className="sidebar-menu">
            {menuItems.map((item) => (
              <li key={item.path} className="sidebar-menu-item">
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `sidebar-menu-link ${isActive ? "active" : ""}`
                  }
                  onClick={onClose}
                >
                  <i className={`bi ${item.icon}`} />
                  <span className="sidebar-menu-label">{item.label}</span>
                  {item.badge && (
                    <span className="sidebar-menu-badge">{item.badge}</span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>

          <div
            style={{ margin: "12px 12px 4px", borderTop: "1px solid #f3f4f6" }}
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
          <ul className="sidebar-menu">
            {adminMenu.map((item) => (
              <li key={item.path} className="sidebar-menu-item">
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `sidebar-menu-link ${isActive ? "active" : ""}`
                  }
                  onClick={onClose}
                >
                  <i className={`bi ${item.icon}`} />
                  <span className="sidebar-menu-label">{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;