import React from "react";
import { useNavigate } from "react-router-dom";
import { storage } from "../../services/apiService";
import { getRoleCopy } from "../../utils/roleUi";
import "./QuickActions.css";

const QuickActions = () => {
  const navigate = useNavigate();
  const role = storage.getUser()?.role;
  const canManage = role === "SUPER_ADMIN" || role === "RISK_MANAGER";
  const isSuperAdmin = role === "SUPER_ADMIN";
  const roleCopy = getRoleCopy(role);

  const actions = [
    ...(canManage
      ? [
          {
            id: 1,
            title: "Risk Management",
            icon: "bi-shield-fill-exclamation",
            color: "danger",
            route: "/risk-management",
          },
        ]
      : []),
    {
      id: 2,
      title: roleCopy.quickReview,
      hint: roleCopy.quickReviewHint,
      icon: "bi-clipboard-check",
      color: "warning",
      route: "/manual-review",
    },
    {
      id: 9,
      title: "Review History",
      icon: "bi-clock-history",
      color: "purple",
      route: "/review-history",
    },
    {
      id: 3,
      title: "Transactions",
      icon: "bi-list-ul",
      color: "primary",
      route: "/transactions",
    },
    {
      id: 4,
      title: "Analytics",
      icon: "bi-graph-up",
      color: "info",
      route: "/analytics",
    },
    {
      id: 11,
      title: "Activity Timeline",
      icon: "bi-activity",
      color: "purple",
      route: "/activity-timeline",
    },
    ...(canManage
      ? [
          {
            id: 5,
            title: "Reports",
            icon: "bi-file-earmark-text",
            color: "success",
            route: "/reports",
          },
        ]
      : []),
    ...(isSuperAdmin
      ? [
          {
            id: 6,
            title: "Admin Control",
            icon: "bi-shield-lock-fill",
            color: "secondary",
            route: "/super-admin",
          },
        ]
      : []),
    ...(canManage
      ? [
          {
            id: 7,
            title: "Audit Log",
            icon: "bi-clock-history",
            color: "purple",
            route: "/audit-log",
          },
        ]
      : []),
    {
      id: 12,
      title: "Fraud Patterns",
      icon: "bi-bug-fill",
      color: "danger",
      route: "/fraud-patterns",
    },
    ...(isSuperAdmin
      ? [
          {
            id: 13,
            title: "Retrain Schedule",
            icon: "bi-cpu",
            color: "info",
            route: "/retrain-schedule",
          },
        ]
      : []),
    {
      id: 8,
      title: "Alerts Log",
      icon: "bi-bell-fill",
      color: "warning",
      route: "/alerts",
    },
    {
      id: 10,
      title: "Settings",
      icon: "bi-gear-fill",
      color: "secondary",
      route: "/settings",
    },
  ];

  return (
    <div className="quick-actions-card">
      <div className="quick-actions-header">
        <h3 className="quick-actions-title">Quick Actions</h3>
        <p className="quick-actions-subtitle">Fast access to common tasks</p>
      </div>

      <div className="actions-icon-grid">
        {actions.map((action) => (
          <div key={action.id} className="action-icon-wrap">
            <button
              className={`action-icon-btn action-icon-btn--${action.color}`}
              onClick={() => navigate(action.route)}
              title={action.hint || action.title}
            >
              <i className={`bi ${action.icon}`}></i>
              {action.count && (
                <span className="action-icon-badge">{action.count}</span>
              )}
            </button>
            <span className="action-tooltip">{action.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default QuickActions;
