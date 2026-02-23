import React, { useState, useEffect } from 'react';
import './SystemHealth.css';

const SystemHealth = () => {
  const [healthData, setHealthData] = useState({
    overall: 'healthy',
    uptime: '99.98%',
    responseTime: 145,
    lastUpdate: new Date().toLocaleTimeString()
  });

  const services = [
    {
      id: 1,
      name: 'API Server',
      status: 'operational',
      latency: '120ms',
      icon: 'bi-server',
      description: 'Main API endpoint'
    },
    {
      id: 2,
      name: 'ML Model',
      status: 'operational',
      latency: '85ms',
      icon: 'bi-cpu',
      description: 'Fraud detection model'
    },
    {
      id: 3,
      name: 'Database',
      status: 'operational',
      latency: '32ms',
      icon: 'bi-database',
      description: 'PostgreSQL cluster'
    },
    {
      id: 4,
      name: 'Cache Layer',
      status: 'operational',
      latency: '8ms',
      icon: 'bi-lightning',
      description: 'Redis cache'
    },
    {
      id: 5,
      name: 'Payment Gateway',
      status: 'operational',
      latency: '210ms',
      icon: 'bi-credit-card',
      description: 'External payment API'
    },
    {
      id: 6,
      name: 'Notification Service',
      status: 'degraded',
      latency: '450ms',
      icon: 'bi-bell',
      description: 'Email & SMS notifications'
    }
  ];

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setHealthData(prev => ({
        ...prev,
        responseTime: Math.floor(Math.random() * 50) + 120,
        lastUpdate: new Date().toLocaleTimeString()
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status) => {
    switch(status) {
      case 'operational': return 'status-healthy';
      case 'degraded': return 'status-warning';
      case 'down': return 'status-critical';
      default: return 'status-unknown';
    }
  };

  const getStatusLabel = (status) => {
    switch(status) {
      case 'operational': return 'Operational';
      case 'degraded': return 'Degraded';
      case 'down': return 'Down';
      default: return 'Unknown';
    }
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'operational': return 'bi-check-circle-fill';
      case 'degraded': return 'bi-exclamation-triangle-fill';
      case 'down': return 'bi-x-circle-fill';
      default: return 'bi-question-circle-fill';
    }
  };

  return (
    <div className="system-health-card">
      <div className="health-header">
        <div className="header-left">
          <h3 className="health-title">
            <i className="bi bi-heart-pulse-fill"></i>
            System Health
          </h3>
          <p className="health-subtitle">Real-time system monitoring</p>
        </div>
        <div className="last-update">
          <i className="bi bi-arrow-clockwise"></i>
          Updated {healthData.lastUpdate}
        </div>
      </div>

      {/* Overall Status */}
      <div className="overall-status">
        <div className="status-indicator status-healthy">
          <i className="bi bi-check-circle-fill"></i>
        </div>
        <div className="status-info">
          <h4 className="status-title">All Systems Operational</h4>
          <p className="status-description">
            All core services are running smoothly
          </p>
        </div>
        <div className="status-metrics">
          <div className="metric-item">
            <span className="metric-label">Uptime</span>
            <span className="metric-value">{healthData.uptime}</span>
          </div>
          <div className="metric-item">
            <span className="metric-label">Avg Response</span>
            <span className="metric-value">{healthData.responseTime}ms</span>
          </div>
        </div>
      </div>

      {/* Services List */}
      <div className="services-list">
        {services.map((service) => (
          <div key={service.id} className="service-item">
            <div className={`service-status ${getStatusColor(service.status)}`}>
              <i className={getStatusIcon(service.status)}></i>
            </div>
            
            <div className={`service-icon ${getStatusColor(service.status)}`}>
              <i className={service.icon}></i>
            </div>
            
            <div className="service-info">
              <h5 className="service-name">{service.name}</h5>
              <p className="service-description">{service.description}</p>
            </div>
            
            <div className="service-metrics">
              <span className={`status-badge ${getStatusColor(service.status)}`}>
                {getStatusLabel(service.status)}
              </span>
              <span className="latency-badge">{service.latency}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Health Summary */}
      <div className="health-summary">
        <div className="summary-stat">
          <i className="bi bi-check-circle-fill text-success"></i>
          <span>5 Services Operational</span>
        </div>
        <div className="summary-stat">
          <i className="bi bi-exclamation-triangle-fill text-warning"></i>
          <span>1 Service Degraded</span>
        </div>
        <div className="summary-stat">
          <i className="bi bi-x-circle-fill text-danger"></i>
          <span>0 Services Down</span>
        </div>
      </div>
    </div>
  );
};

export default SystemHealth;