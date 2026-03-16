import React from 'react';
import './TransactionDetailModal.css';

const TransactionDetailModal = ({ transaction, isOpen, onClose }) => {
  if (!isOpen || !transaction) return null;

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'full',
      timeStyle: 'medium'
    }).format(date);
  };

  const getRiskScore = () => {
    // Simulasi risk score berdasarkan status
    return transaction.status === 'Fraud' ? Math.floor(Math.random() * 30) + 70 : Math.floor(Math.random() * 40) + 10;
  };

  const getRiskLevel = (score) => {
    if (score >= 70) return { label: 'High', class: 'danger' };
    if (score >= 40) return { label: 'Medium', class: 'warning' };
    return { label: 'Low', class: 'success' };
  };

  const riskScore = getRiskScore();
  const riskLevel = getRiskLevel(riskScore);

  return (
    <>
      {/* Overlay */}
      <div className="txn-detail-overlay" onClick={onClose}></div>
      
      {/* Modal */}
      <div className="txn-detail-modal">
        <div className="txn-detail-dialog">
          <div className="txn-modal-content">
            {/* Header */}
            <div className="txn-modal-header">
              <h5 className="txn-modal-title">
                <i className="bi bi-receipt me-2"></i>
                Detail Transaksi
              </h5>
              <button type="button" className="txn-btn-close" onClick={onClose}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            {/* Body */}
            <div className="txn-modal-body">
              {/* Risk Score Banner */}
              <div className={`txn-risk-banner txn-risk-${riskLevel.class}`}>
                <i className="bi bi-shield-exclamation txn-risk-icon"></i>
                <div className="txn-risk-info">
                  <h6 className="txn-risk-title">Risk Level: {riskLevel.label}</h6>
                  <div className="txn-progress">
                    <div 
                      className={`txn-progress-bar txn-progress-${riskLevel.class}`}
                      style={{ width: `${riskScore}%` }}
                    ></div>
                  </div>
                  <small>Risk Score: {riskScore}/100</small>
                </div>
              </div>

              {/* Transaction Info Grid */}
              <div className="txn-grid">
                {/* Transaction ID */}
                <div className="txn-grid-item">
                  <div className="detail-card">
                    <label className="detail-label">
                      <i className="bi bi-hash me-2"></i>Transaction ID
                    </label>
                    <div className="detail-value transaction-id">{transaction.id}</div>
                  </div>
                </div>

                {/* Status */}
                <div className="txn-grid-item">
                  <div className="detail-card">
                    <label className="detail-label">
                      <i className="bi bi-flag me-2"></i>Status
                    </label>
                    <div className="detail-value">
                      {transaction.status === 'Fraud' ? (
                        <span className="txn-badge txn-badge-danger">
                          <i className="bi bi-exclamation-circle me-1"></i>Fraud
                        </span>
                      ) : (
                        <span className="txn-badge txn-badge-success">
                          <i className="bi bi-check-circle me-1"></i>Legit
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* User Info */}
                <div className="txn-grid-item">
                  <div className="detail-card">
                    <label className="detail-label">
                      <i className="bi bi-person me-2"></i>User
                    </label>
                    <div className="detail-value txn-user-row">
                      <div className="user-avatar-large">
                        {(transaction.user || transaction.accountId || "?").charAt(0).toUpperCase()}
                      </div>
                      {transaction.user || transaction.accountId || "—"}
                    </div>
                  </div>
                </div>

                {/* Amount */}
                <div className="txn-grid-item">
                  <div className="detail-card">
                    <label className="detail-label">
                      <i className="bi bi-currency-dollar me-2"></i>Amount
                    </label>
                    <div className="detail-value txn-amount">
                      {formatCurrency(transaction.amount)}
                    </div>
                  </div>
                </div>

                {/* Time */}
                <div className="txn-grid-item">
                  <div className="detail-card">
                    <label className="detail-label">
                      <i className="bi bi-clock me-2"></i>Transaction Time
                    </label>
                    <div className="detail-value">{formatDateTime(transaction.time)}</div>
                  </div>
                </div>

                {/* Location */}
                <div className="txn-grid-item">
                  <div className="detail-card">
                    <label className="detail-label">
                      <i className="bi bi-geo-alt me-2"></i>Location
                    </label>
                    <div className="detail-value">{transaction.location || transaction.channel || "—"}</div>
                  </div>
                </div>

                {/* Additional Info */}
                <div className="txn-grid-item txn-grid-full">
                  <div className="detail-card">
                    <label className="detail-label">
                      <i className="bi bi-info-circle me-2"></i>Additional Information
                    </label>
                    <div className="txn-additional-grid">
                      <div>
                        <small className="txn-sub-label">Device Type</small>
                        <div className="txn-sub-value">Mobile - Android</div>
                      </div>
                      <div>
                        <small className="txn-sub-label">IP Address</small>
                        <div className="txn-sub-value">192.168.1.100</div>
                      </div>
                      <div>
                        <small className="txn-sub-label">Payment Method</small>
                        <div className="txn-sub-value">Credit Card</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Fraud Indicators */}
                {transaction.status === 'Fraud' && (
                  <div className="txn-grid-item txn-grid-full">
                    <div className="detail-card border-danger">
                      <label className="detail-label txn-label-danger">
                        <i className="bi bi-exclamation-triangle me-2"></i>Fraud Indicators
                      </label>
                      <ul className="fraud-indicators mb-0">
                        <li>Unusual transaction amount</li>
                        <li>Location mismatch with user profile</li>
                        <li>Multiple failed attempts detected</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>


          </div>
        </div>
      </div>
    </>
  );
};

export default TransactionDetailModal;