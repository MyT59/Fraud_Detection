import React, { useState } from 'react';
import './ReviewDetail.css';

const ReviewDetail = ({ transaction, onClose, onReview }) => {
  const [decision, setDecision] = useState('');
  const [notes, setNotes] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  const getRiskColor = (riskLevel) => {
    const colors = {
      low: '#10b981',
      medium: '#f59e0b',
      high: '#ef4444',
      critical: '#dc2626'
    };
    return colors[riskLevel] || '#6b7280';
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
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const handleDecision = (newDecision) => {
    setDecision(newDecision);
    setShowConfirm(true);
  };

  const handleConfirm = () => {
    onReview(transaction.id, decision, notes);
    setShowConfirm(false);
    setNotes('');
    setDecision('');
  };

  const handleCancel = () => {
    setShowConfirm(false);
    setDecision('');
  };

  if (transaction.status !== 'pending') {
    return (
      <div className="review-detail-panel">
        <div className="detail-header">
          <h2>Transaction Details</h2>
          <button className="close-btn" onClick={onClose}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        <div className="detail-content">
          <div className="already-reviewed">
            <i className={`bi ${transaction.status === 'approved' ? 'bi-check-circle' : 'bi-x-circle'}`}></i>
            <h3>Already Reviewed</h3>
            <p>This transaction has been {transaction.status}</p>
            {transaction.reviewNotes && (
              <div className="review-notes-display">
                <strong>Review Notes:</strong>
                <p>{transaction.reviewNotes}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="review-detail-panel">
      <div className="detail-header">
        <h2>Review Transaction</h2>
        <button className="close-btn" onClick={onClose}>
          <i className="bi bi-x-lg"></i>
        </button>
      </div>

      <div className="detail-content">
        {/* Risk Score Section */}
        <div className="risk-section">
          <div className="risk-score-large">
            <div 
              className="score-circle-large"
              style={{ 
                borderColor: getRiskColor(transaction.riskLevel),
                color: getRiskColor(transaction.riskLevel)
              }}
            >
              <span className="score-value">{transaction.fraudScore}</span>
              <span className="score-max">/100</span>
            </div>
            <div className="risk-info">
              <span className="risk-label">Fraud Risk Score</span>
              <span 
                className="risk-level-large"
                style={{ color: getRiskColor(transaction.riskLevel) }}
              >
                {transaction.riskLevel.toUpperCase()} RISK
              </span>
            </div>
          </div>
        </div>

        {/* Transaction Info */}
        <div className="info-section">
          <h3 className="section-title">Transaction Information</h3>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Transaction ID</span>
              <span className="info-value">{transaction.id}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Type</span>
              <span className="info-value">{transaction.transactionType}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Amount</span>
              <span className="info-value highlight">{formatAmount(transaction.amount)}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Date & Time</span>
              <span className="info-value">{formatDate(transaction.date)}</span>
            </div>
          </div>
        </div>

        {/* User Info */}
        <div className="info-section">
          <h3 className="section-title">User Information</h3>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">User ID</span>
              <span className="info-value">{transaction.userId}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Name</span>
              <span className="info-value">{transaction.userName}</span>
            </div>
          </div>
        </div>

        {/* Device & Location Info */}
        <div className="info-section">
          <h3 className="section-title">Device & Location</h3>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Device</span>
              <span className="info-value">{transaction.device}</span>
            </div>
            <div className="info-item">
              <span className="info-label">IP Address</span>
              <span className="info-value">{transaction.ipAddress}</span>
            </div>
            <div className="info-item full-width">
              <span className="info-label">Location</span>
              <span className="info-value">{transaction.location}</span>
            </div>
          </div>
        </div>

        {/* Anomalies */}
        {transaction.anomalies && transaction.anomalies.length > 0 && (
          <div className="info-section anomalies-section">
            <h3 className="section-title">
              <i className="bi bi-exclamation-triangle"></i>
              Detected Anomalies ({transaction.anomalies.length})
            </h3>
            <ul className="anomalies-list">
              {transaction.anomalies.map((anomaly, index) => (
                <li key={index} className="anomaly-item">
                  <i className="bi bi-dot"></i>
                  {anomaly}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Decision Section */}
        {!showConfirm ? (
          <div className="decision-section">
            <h3 className="section-title">Make Decision</h3>
            <div className="decision-buttons">
              <button 
                className="decision-btn approve"
                onClick={() => handleDecision('approved')}
              >
                <i className="bi bi-check-circle"></i>
                Approve Transaction
              </button>
              <button 
                className="decision-btn reject"
                onClick={() => handleDecision('rejected')}
              >
                <i className="bi bi-x-circle"></i>
                Reject Transaction
              </button>
            </div>
          </div>
        ) : (
          <div className="confirm-section">
            <h3 className="section-title">
              Confirm {decision === 'approved' ? 'Approval' : 'Rejection'}
            </h3>
            <div className="notes-input">
              <label>Review Notes (Optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes about your decision..."
                rows="4"
              />
            </div>
            <div className="confirm-buttons">
              <button className="confirm-btn cancel" onClick={handleCancel}>
                Cancel
              </button>
              <button 
                className={`confirm-btn ${decision === 'approved' ? 'approve' : 'reject'}`}
                onClick={handleConfirm}
              >
                Confirm {decision === 'approved' ? 'Approval' : 'Rejection'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewDetail;