import React from 'react';
import './HistoryDetailModal.css';

const fmt = (amount) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

const fmtTs = (ds) => {
  const d = new Date(ds);
  return d.toLocaleDateString('id-ID', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
};

const ACTION_META = {
  approved:  { icon: 'bi-check-circle-fill',    label: 'Approved',   cls: 'approved',  bg: '#ecfdf5', color: '#059669' },
  rejected:  { icon: 'bi-x-circle-fill',        label: 'Rejected',   cls: 'rejected',  bg: '#fef2f2', color: '#dc2626' },
  flagged:   { icon: 'bi-flag-fill',            label: 'Flagged',    cls: 'flagged',   bg: '#fffbeb', color: '#d97706' },
  escalated: { icon: 'bi-arrow-up-circle-fill', label: 'Escalated',  cls: 'escalated', bg: '#eff6ff', color: '#2563eb' },
};

const HistoryDetailModal = ({ item, onClose }) => {
  if (!item) return null;
  const meta = ACTION_META[item.action] || ACTION_META.approved;

  return (
    <div className="hmodal-overlay" onClick={onClose}>
      <div className="hmodal-box" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="hmodal-header" style={{ borderBottom: `3px solid ${meta.color}` }}>
          <div className="hmodal-header-left">
            <div className="hmodal-icon-wrap" style={{ background: meta.bg, color: meta.color }}>
              <i className={`bi ${meta.icon}`}></i>
            </div>
            <div>
              <div className="hmodal-entry-label">Audit Entry</div>
              <div className="hmodal-txn-id">{item.transactionId}</div>
            </div>
          </div>
          <button className="hmodal-close" onClick={onClose}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        {/* Action Banner */}
        <div className="hmodal-banner" style={{ background: meta.bg, color: meta.color }}>
          <i className={`bi ${meta.icon}`}></i>
          <span>Transaction was <strong>{meta.label}</strong></span>
          <span className="hmodal-banner-time">{fmtTs(item.timestamp)}</span>
        </div>

        {/* Body */}
        <div className="hmodal-body">
          <div className="hmodal-grid">
            <div className="hmodal-kv">
              <div className="hmodal-kv-label"><i className="bi bi-cash-stack"></i> Amount</div>
              <div className="hmodal-kv-value mono highlight">{fmt(item.amount)}</div>
            </div>
            <div className="hmodal-kv">
              <div className="hmodal-kv-label"><i className="bi bi-shield-exclamation"></i> Risk Score</div>
              <div className="hmodal-kv-value mono" style={{
                color: item.riskScore >= 80 ? '#dc2626' : item.riskScore >= 60 ? '#d97706' : '#16a34a'
              }}>
                {item.riskScore}<span style={{ color: '#94a3b8', fontWeight: 400 }}>/100</span>
              </div>
            </div>
            <div className="hmodal-kv">
              <div className="hmodal-kv-label"><i className="bi bi-person-badge"></i> Reviewed By</div>
              <div className="hmodal-kv-value">
                <div className="hmodal-reviewer-row">
                  <div className="hmodal-avatar">
                    {item.reviewer.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <div className="hmodal-reviewer-name">{item.reviewer}</div>
                    <div className="hmodal-reviewer-role">{item.reviewerRole}</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="hmodal-kv">
              <div className="hmodal-kv-label"><i className="bi bi-stopwatch"></i> Review Duration</div>
              <div className="hmodal-kv-value mono">{item.duration}</div>
            </div>
            <div className="hmodal-kv hmodal-kv-full">
              <div className="hmodal-kv-label"><i className="bi bi-calendar-event"></i> Timestamp</div>
              <div className="hmodal-kv-value mono">{fmtTs(item.timestamp)}</div>
            </div>
          </div>

          {item.notes && (
            <div className="hmodal-notes">
              <div className="hmodal-notes-label">
                <i className="bi bi-chat-left-text-fill"></i>
                Review Notes
              </div>
              <p className="hmodal-notes-text">{item.notes}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="hmodal-footer">
          <button className="hmodal-close-btn" onClick={onClose}>
            <i className="bi bi-x-circle"></i>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default HistoryDetailModal;