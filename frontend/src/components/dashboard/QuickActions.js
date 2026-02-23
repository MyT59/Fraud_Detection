import React from 'react';
import { useNavigate } from 'react-router-dom';
import './QuickActions.css';

const QuickActions = () => {
  const navigate = useNavigate();

  const actions = [
    {
      id: 1,
      title: 'Risk Management',
      icon: 'bi-shield-fill-exclamation',
      color: 'danger',
      route: '/risk-management'
    },
    {
      id: 2,
      title: 'Manual Review',
      icon: 'bi-clipboard-check',
      color: 'warning',
      count: 3,
      route: '/manual-review'
    },
    {
      id: 9,
      title: 'Review History',
      icon: 'bi-clock-history',
      color: 'purple',
      route: '/review-history'
    },
    {
      id: 3,
      title: 'Transactions',
      icon: 'bi-list-ul',
      color: 'primary',
      route: '/transactions'
    },
    {
      id: 4,
      title: 'Analytics',
      icon: 'bi-graph-up',
      color: 'info',
      route: '/analytics'
    },
    {
      id: 11,
      title: 'Activity Timeline',
      icon: 'bi-activity',
      color: 'purple',
      route: '/activity-timeline'
    },
    {
      id: 5,
      title: 'Reports',
      icon: 'bi-file-earmark-text',
      color: 'success',
      route: '/reports'
    },
    {
      id: 10,
      title: 'Settings',
      icon: 'bi-gear-fill',
      color: 'secondary',
      route: '/settings'
    },
    {
      id: 6,
      title: 'Super Admin',
      icon: 'bi-shield-lock-fill',
      color: 'secondary',
      route: '/super-admin'
    },
    {
      id: 7,
      title: 'Audit Log',
      icon: 'bi-clock-history',
      color: 'purple',
      route: '/audit-log'
    },
    {
      id: 8,
      title: 'Alerts Log',
      icon: 'bi-bell-fill',
      color: 'warning',
      route: '/alerts'
    }
  ];

  return (
    <div className="quick-actions-card">
      <div className="quick-actions-header">
        <h3 className="quick-actions-title">
          <i className="bi bi-lightning-fill"></i>
          Quick Actions
        </h3>
        <p className="quick-actions-subtitle">Fast access to common tasks</p>
      </div>

      <div className="actions-icon-grid">
        {actions.map((action) => (
          <div key={action.id} className="action-icon-wrap">
            <button
              className={`action-icon-btn action-icon-btn--${action.color}`}
              onClick={() => navigate(action.route)}
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