import React from 'react';
import { useNavigate } from 'react-router-dom';
import './RecentAlerts.css';

const RecentAlerts = () => {
  const navigate = useNavigate();
  // Dummy data for recent alerts
  const alerts = [
    {
      id: 1,
      type: 'high',
      title: 'Suspicious Transaction Detected',
      description: 'Multiple high-value transactions from Jakarta',
      time: '2 minutes ago',
      userId: 'USR12345',
      amount: 'Rp 25.000.000',
      icon: 'bi-exclamation-triangle-fill'
    },
    {
      id: 2,
      type: 'medium',
      title: 'Unusual Login Location',
      description: 'Login attempt from unknown device in Medan',
      time: '15 minutes ago',
      userId: 'USR67890',
      icon: 'bi-geo-alt-fill'
    },
    {
      id: 3,
      type: 'high',
      title: 'Card Verification Failed',
      description: 'Multiple failed verification attempts',
      time: '28 minutes ago',
      userId: 'USR11223',
      icon: 'bi-credit-card-fill'
    },
    {
      id: 4,
      type: 'low',
      title: 'Velocity Check Triggered',
      description: '5 transactions within 10 minutes',
      time: '1 hour ago',
      userId: 'USR44556',
      amount: 'Rp 8.500.000',
      icon: 'bi-speedometer2'
    },
    {
      id: 5,
      type: 'medium',
      title: 'IP Address Mismatch',
      description: 'Transaction from blacklisted IP range',
      time: '2 hours ago',
      userId: 'USR77889',
      icon: 'bi-shield-exclamation'
    }
  ];

  const getSeverityColor = (type) => {
    switch(type) {
      case 'high': return 'severity-high';
      case 'medium': return 'severity-medium';
      case 'low': return 'severity-low';
      default: return 'severity-medium';
    }
  };

  const getSeverityLabel = (type) => {
    switch(type) {
      case 'high': return 'High Risk';
      case 'medium': return 'Medium Risk';
      case 'low': return 'Low Risk';
      default: return 'Unknown';
    }
  };

  return (
    <div className="recent-alerts-card">
      <div className="alerts-header">
        <div className="header-left">
          <h3 className="alerts-title">
            <i className="bi bi-bell-fill"></i>
            Recent Alerts
          </h3>
          <p className="alerts-subtitle">Real-time fraud detection alerts</p>
        </div>
        <button className="btn-view-all" onClick={() => navigate('/alerts')}>
          View All
          <i className="bi bi-arrow-right"></i>
        </button>
      </div>

      <div className="alerts-list">
        {alerts.map((alert) => (
          <div key={alert.id} className="alert-item">
            <div className={`alert-indicator ${getSeverityColor(alert.type)}`}>
              <i className={alert.icon}></i>
            </div>
            
            <div className="alert-content">
              <div className="alert-header-row">
                <h4 className="alert-title">{alert.title}</h4>
                <span className={`severity-badge ${getSeverityColor(alert.type)}`}>
                  {getSeverityLabel(alert.type)}
                </span>
              </div>
              
              <p className="alert-description">{alert.description}</p>
              
              <div className="alert-meta">
                <span className="meta-item">
                  <i className="bi bi-person-fill"></i>
                  {alert.userId}
                </span>
                {alert.amount && (
                  <span className="meta-item">
                    <i className="bi bi-currency-dollar"></i>
                    {alert.amount}
                  </span>
                )}
                <span className="meta-item time">
                  <i className="bi bi-clock"></i>
                  {alert.time}
                </span>
              </div>
            </div>

            <div className="alert-actions">
              <button className="btn-action btn-investigate" title="Investigate">
                <i className="bi bi-search"></i>
              </button>
              <button className="btn-action btn-dismiss" title="Dismiss">
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="alerts-footer">
        <div className="alert-summary">
          <span className="summary-item">
            <span className="dot severity-high"></span>
            3 High Risk
          </span>
          <span className="summary-item">
            <span className="dot severity-medium"></span>
            2 Medium Risk
          </span>
          <span className="summary-item">
            <span className="dot severity-low"></span>
            1 Low Risk
          </span>
        </div>
      </div>
    </div>
  );
};

export default RecentAlerts;