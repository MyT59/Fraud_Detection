import React, { useState } from 'react';
import './AlertsPanel.css';

const AlertsPanel = ({ alerts }) => {
  const [filter, setFilter] = useState('all');

  const defaultAlerts = [
    { id:1, type:'critical', title:'Fraud Rate Spike Detected',     message:'Fraud rate increased by 45% in the last hour. Immediate attention required.',    timestamp: new Date(Date.now()-5*60000),   icon:'exclamation-triangle-fill', actionRequired:true  },
    { id:2, type:'critical', title:'Multiple Failed Transactions',   message:'User #12345 has 15 failed transaction attempts from Jakarta.',                    timestamp: new Date(Date.now()-15*60000),  icon:'shield-exclamation',        actionRequired:true  },
    { id:3, type:'warning',  title:'Unusual Transaction Pattern',    message:'Detected unusual transaction amounts in Surabaya region.',                        timestamp: new Date(Date.now()-30*60000),  icon:'exclamation-circle-fill',   actionRequired:false },
    { id:4, type:'warning',  title:'High Volume Location',           message:'Jakarta showing 30% higher transaction volume than usual.',                       timestamp: new Date(Date.now()-45*60000),  icon:'geo-alt-fill',              actionRequired:false },
    { id:5, type:'info',     title:'Daily Report Generated',         message:'Analytics report for yesterday has been generated successfully.',                  timestamp: new Date(Date.now()-60*60000),  icon:'file-earmark-text-fill',    actionRequired:false },
    { id:6, type:'info',     title:'System Update',                  message:'Fraud detection model updated to version 2.1.5.',                                 timestamp: new Date(Date.now()-120*60000), icon:'arrow-up-circle-fill',      actionRequired:false },
  ];

  const alertsList = alerts || defaultAlerts;

  const fmtTime = (ts) => {
    const diff  = Date.now() - ts;
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    if (hours > 0)  return `${hours}h ago`;
    if (mins > 0)   return `${mins}m ago`;
    return 'now';
  };

  const filtered = filter === 'all' ? alertsList : alertsList.filter(a => a.type === filter);
  const counts   = { critical: alertsList.filter(a=>a.type==='critical').length, warning: alertsList.filter(a=>a.type==='warning').length, info: alertsList.filter(a=>a.type==='info').length };

  return (
    <div className="ap-wrapper">
      {/* Filter pills */}
      <div className="ap-filters">
        {[
          { key:'all',      label:'All',      count: alertsList.length },
          { key:'critical', label:'Critical', count: counts.critical   },
          { key:'warning',  label:'Warning',  count: counts.warning    },
          { key:'info',     label:'Info',     count: counts.info       },
        ].map(f => (
          <button
            key={f.key}
            className={`ap-filter-btn ${filter === f.key ? `active-${f.key}` : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
            <span className="ap-badge">{f.count}</span>
          </button>
        ))}
      </div>

      {/* Alerts */}
      <div className="ap-list">
        {filtered.length === 0 ? (
          <div className="ap-empty">
            <i className="bi bi-check-circle-fill"></i>
            <p>No {filter !== 'all' ? filter : ''} alerts</p>
          </div>
        ) : (
          filtered.map(alert => (
            <div key={alert.id} className="ap-row">
              {/* Stripe */}
              <div className={`ap-stripe ${alert.type}`}></div>

              {/* Icon */}
              <div className={`ap-icon ${alert.type}`}>
                <i className={`bi bi-${alert.icon}`}></i>
              </div>

              {/* Content */}
              <div className="ap-content">
                <div className="ap-title-row">
                  <span className="ap-title">{alert.title}</span>
                  <span className="ap-time">{fmtTime(alert.timestamp)}</span>
                </div>
                <p className="ap-msg">{alert.message}</p>
              </div>

              {/* Actions */}
              {alert.actionRequired ? (
                <div className="ap-actions">
                  <button className="ap-btn view"><i className="bi bi-eye"></i> View</button>
                  <button className="ap-btn dismiss">Done</button>
                </div>
              ) : (
                <button className="ap-dismiss" title="Dismiss">
                  <i className="bi bi-x"></i>
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      {filtered.length > 0 && (
        <div className="ap-footer">
          <button className="ap-footer-btn">
            <i className="bi bi-check-all"></i>Mark All as Read
          </button>
        </div>
      )}
    </div>
  );
};

export default AlertsPanel;