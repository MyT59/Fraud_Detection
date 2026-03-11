import React from 'react';
import './ReviewCard.css';

/* ── Service badge ── */
const ServiceBadge = ({ service }) => (
  <span style={{
    display: 'inline-block',
    padding: '1px 7px',
    borderRadius: '4px',
    fontSize: '.66rem',
    fontWeight: 700,
    letterSpacing: '.04em',
    background: service === 'agenusa' ? '#eff6ff' : '#fdf4ff',
    color:      service === 'agenusa' ? '#1d4ed8' : '#7c3aed',
    border: `1px solid ${service === 'agenusa' ? '#bfdbfe' : '#e9d5ff'}`,
  }}>
    {service === 'agenusa' ? 'AGENUSA' : 'NUSABILL'}
  </span>
);

const ReviewCard = ({ transaction, onClick, isSelected, onSelect, isMultiSelected }) => {
  const getRiskColor = (riskLevel) => {
    const colors = {
      low: '#10b981',
      medium: '#f59e0b',
      high: '#ef4444',
      critical: '#dc2626'
    };
    return colors[riskLevel] || '#6b7280';
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: { icon: 'bi-clock-history', text: 'Pending', class: 'pending' },
      approved: { icon: 'bi-check-circle-fill', text: 'Approved', class: 'approved' },
      rejected: { icon: 'bi-x-circle-fill', text: 'Rejected', class: 'rejected' }
    };
    return badges[status] || badges.pending;
  };

  const formatAmount = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const statusBadge = getStatusBadge(transaction.status);

  const handleCheckboxClick = (e) => {
    e.stopPropagation();
    if (onSelect) {
      onSelect();
    }
  };

  const handleCardClick = () => {
    if (onClick) {
      onClick();
    }
  };

  return (
    <div 
      className={`review-card ${isSelected ? 'selected' : ''} ${isMultiSelected ? 'multi-selected' : ''} ${(onSelect && transaction.status === 'pending') ? 'has-checkbox' : ''}`}
      onClick={handleCardClick}
    >
      {/* NEW: Checkbox for multi-selection */}
      {onSelect && transaction.status === 'pending' && (
        <div className="selection-checkbox" onClick={handleCheckboxClick}>
          <input 
            type="checkbox" 
            checked={isMultiSelected}
            onChange={() => {}}
            onClick={handleCheckboxClick}
          />
          <label></label>
        </div>
      )}

      <div className="card-header">
        <div className="transaction-info">
          <div className="transaction-id-row">
            <span className="transaction-id">{transaction.id}</span>
            <ServiceBadge service={transaction.service} />
            <span className={`status-badge ${statusBadge.class}`}>
              <i className={`bi ${statusBadge.icon}`}></i>
              {statusBadge.text}
            </span>
          </div>
          {/* Account Number (agenusa) atau Customer ID (nusabill) */}
          <div className="user-info">
            <i className="bi bi-person-circle"></i>
            <span className="user-name">{transaction.accountId}</span>
          </div>
        </div>
        
        <div className="fraud-score-container">
          <div 
            className="fraud-score-circle"
            style={{ 
              borderColor: getRiskColor(transaction.riskLevel),
              color: getRiskColor(transaction.riskLevel)
            }}
          >
            <span className="score-value">{transaction.fraudScore}</span>
            <span className="score-label">Risk</span>
          </div>
          <span 
            className="risk-level"
            style={{ color: getRiskColor(transaction.riskLevel) }}
          >
            {transaction.riskLevel.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="card-body">
        <div className="transaction-details">
          {/* Amount — AMOUNT (agenusa) / BILL_AMOUNT (nusabill) */}
          <div className="detail-item">
            <i className="bi bi-cash-stack"></i>
            <div>
              <span className="detail-label">{transaction.service === 'agenusa' ? 'Amount' : 'Bill Amount'}</span>
              <span className="detail-value amount">{formatAmount(transaction.amount)}</span>
              {transaction.amountNote && (
                <span style={{ fontSize:'.72rem', color:'#ea580c', display:'block' }}>{transaction.amountNote}</span>
              )}
            </div>
          </div>

          {/* Type / Channel — PROCESSING_CODE (agenusa) / CHANNEL (nusabill) */}
          <div className="detail-item">
            <i className="bi bi-arrow-left-right"></i>
            <div>
              <span className="detail-label">{transaction.service === 'agenusa' ? 'Type' : 'Channel'}</span>
              <span className="detail-value">{transaction.typeOrChannel}</span>
            </div>
          </div>

          {/* Dest Account / Bill ID */}
          <div className="detail-item">
            <i className="bi bi-send"></i>
            <div>
              <span className="detail-label">{transaction.service === 'agenusa' ? 'Dest. Account' : 'Bill ID'}</span>
              <span className="detail-value" style={{ fontFamily:'monospace', fontSize:'.82rem' }}>
                {transaction.destOrBill}
              </span>
            </div>
          </div>

          {/* Date & Time — TIMESTAMP_DB (agenusa) / "—" (nusabill: no date column) */}
          <div className="detail-item">
            <i className="bi bi-calendar-event"></i>
            <div>
              <span className="detail-label">Date & Time</span>
              <span className="detail-value">
                {transaction.dateTime ? formatDate(transaction.dateTime) : <span style={{ color:'#94a3b8' }}>—</span>}
              </span>
            </div>
          </div>
        </div>

        {transaction.anomalies && transaction.anomalies.length > 0 && (
          <div className="anomalies-preview">
            <div className="anomaly-header">
              <i className="bi bi-exclamation-triangle"></i>
              <span>{transaction.anomalies.length} Anomalies Detected</span>
            </div>
            <div className="anomaly-tags">
              {transaction.anomalies.slice(0, 2).map((anomaly, index) => (
                <span key={index} className="anomaly-tag">{anomaly}</span>
              ))}
              {transaction.anomalies.length > 2 && (
                <span className="anomaly-tag more">+{transaction.anomalies.length - 2} more</span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="card-footer">
        <button className="view-details-btn">
          View Details
          <i className="bi bi-arrow-right"></i>
        </button>
      </div>
    </div>
  );
};

export default ReviewCard;