import React from 'react';

const TYPE_CONFIG = {
  fraud:     { icon: 'bi-shield-x',          label: 'Fraud',         colorClass: 'type-fraud'     },
  blacklist: { icon: 'bi-ban',               label: 'Blacklist',     colorClass: 'type-blacklist' },
  rule:      { icon: 'bi-gear-fill',         label: 'Rule Engine',   colorClass: 'type-rule'      },
  review:    { icon: 'bi-clipboard-check',   label: 'Manual Review', colorClass: 'type-review'    },
  system:    { icon: 'bi-cpu',               label: 'System',        colorClass: 'type-system'    },
};

const SEVERITY_CONFIG = {
  critical: { label: 'Critical', colorClass: 'sev-critical' },
  high:     { label: 'High',     colorClass: 'sev-high'     },
  medium:   { label: 'Medium',   colorClass: 'sev-medium'   },
  low:      { label: 'Low',      colorClass: 'sev-low'      },
};

const fmtTime = (ts) => {
  const d = new Date(ts);
  return d.toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const AlertItem = ({ alert, onMarkRead, onResolve, onDelete }) => {
  const type     = TYPE_CONFIG[alert.type]     || TYPE_CONFIG.system;
  const severity = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.low;
  const isUnread = alert.status === 'unread';

  return (
    <div className={`alert-item ${isUnread ? 'alert-item-unread' : ''}`}>
      {/* Unread dot */}
      {isUnread && <span className="alert-unread-dot"></span>}

      {/* Icon */}
      <div className={`alert-type-icon ${type.colorClass}`}>
        <i className={`bi ${type.icon}`}></i>
      </div>

      {/* Content */}
      <div className="alert-content">
        <div className="alert-content-top">
          <div className="alert-badges">
            <span className={`alert-type-badge ${type.colorClass}`}>{type.label}</span>
            <span className={`alert-severity-badge ${severity.colorClass}`}>{severity.label}</span>
            {alert.txnId && (
              <span className="alert-txn-badge">
                <i className="bi bi-hash"></i>{alert.txnId}
              </span>
            )}
          </div>
          <div className="alert-status-badge-wrap">
            {alert.status === 'resolved' && (
              <span className="alert-status-resolved">
                <i className="bi bi-check-circle-fill"></i> Resolved
              </span>
            )}
          </div>
        </div>

        <h4 className="alert-item-title">{alert.title}</h4>
        <p className="alert-item-message">{alert.message}</p>

        <div className="alert-item-footer">
          <span className="alert-time">
            <i className="bi bi-clock"></i> {fmtTime(alert.time)}
          </span>
          <div className="alert-actions">
            {alert.status === 'unread' && (
              <button className="alert-action-btn" onClick={() => onMarkRead(alert.id)}>
                <i className="bi bi-check2"></i> Tandai Dibaca
              </button>
            )}
            {alert.status !== 'resolved' && (
              <button className="alert-action-btn alert-action-resolve" onClick={() => onResolve(alert.id)}>
                <i className="bi bi-check2-all"></i> Resolve
              </button>
            )}
            <button className="alert-action-btn alert-action-delete" onClick={() => onDelete(alert.id)}>
              <i className="bi bi-trash3"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlertItem;