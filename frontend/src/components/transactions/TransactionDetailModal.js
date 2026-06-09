import React, { useState, useEffect } from "react";
import "./TransactionDetailModal.css";
import transactionService from "../../services/transactionService";

const STATUS_MAP = {
  PENDING: {
    icon: "bi-hourglass-split",
    label: "Pending",
    badge: "txn-badge-warning",
  },
  UNDER_REVIEW: {
    icon: "bi-search",
    label: "Under Review",
    badge: "txn-badge-warning",
  },
  SAFE: {
    icon: "bi-check-circle",
    label: "Safe",
    badge: "txn-badge-success",
  },
  FRAUD: {
    icon: "bi-exclamation-circle",
    label: "Fraud",
    badge: "txn-badge-danger",
  },
};

const RISK_LEVEL_MAP = {
  LOW: { label: "Low", cls: "success" },
  MEDIUM: { label: "Medium", cls: "warning" },
  HIGH: { label: "High", cls: "danger" },
  CRITICAL: { label: "Critical", cls: "danger" },
};

const formatCurrency = (amount) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);

const formatDateTime = (dateString) => {
  if (!dateString) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "full",
    timeStyle: "medium",
  }).format(new Date(dateString));
};

const TransactionDetailModal = ({ transaction, isOpen, onClose }) => {
  const [detailData, setDetailData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && transaction?.id) {
      const fetchDetail = async () => {
        setLoading(true);
        try {
          const response = await transactionService.getTransactionById(
            transaction.id,
          );
          setDetailData(response);
        } catch (error) {
          console.error("Gagal mengambil detail transaksi:", error);
          // Fallback ke data ringkas dari list
          setDetailData(transaction);
        } finally {
          setLoading(false);
        }
      };
      fetchDetail();
    } else {
      setDetailData(null);
    }
  }, [isOpen, transaction]);

  if (!isOpen || !transaction) return null;

  const t = detailData || transaction;

  const riskScore = Math.round(t.risk_score || 0);
  const riskLevel = RISK_LEVEL_MAP[t.risk_level] || RISK_LEVEL_MAP.LOW;
  const statusMeta = STATUS_MAP[t.final_status] || STATUS_MAP.PENDING;
  const isFraud = t.final_status === "FRAUD";

  return (
    <>
      <div className="txn-detail-overlay" onClick={onClose}></div>

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
              {loading ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-danger" role="status">
                    <span className="visually-hidden">Memuat...</span>
                  </div>
                  <p
                    className="mt-2 text-muted"
                    style={{ fontSize: "0.85rem" }}
                  >
                    Mengambil data dari server...
                  </p>
                </div>
              ) : (
                <div className="txn-grid">
                  {/* Risk Banner */}
                  <div
                    className={`txn-grid-full txn-risk-banner txn-risk-${riskLevel.cls}`}
                  >
                    <i className="bi bi-shield-exclamation txn-risk-icon"></i>
                    <div className="txn-risk-info">
                      <h6 className="txn-risk-title">
                        Risk Level: {riskLevel.label}
                      </h6>
                      <div className="txn-progress">
                        <div
                          className={`txn-progress-bar txn-progress-${riskLevel.cls}`}
                          style={{ width: `${riskScore}%` }}
                        ></div>
                      </div>
                      <small>Risk Score: {riskScore}/100</small>
                    </div>
                  </div>

                  {/* Transaction ID */}
                  <div>
                    <div className="detail-card">
                      <label className="detail-label">
                        <i className="bi bi-hash me-2"></i>Transaction ID
                      </label>
                      <div className="detail-value">
                        {t.original_trx_id || "—"}
                      </div>
                    </div>
                  </div>

                  {/* Status */}
                  <div>
                    <div className="detail-card">
                      <label className="detail-label">
                        <i className="bi bi-flag me-2"></i>Status
                      </label>
                      <div className="detail-value">
                        <span className={`txn-badge ${statusMeta.badge}`}>
                          <i className={`bi ${statusMeta.icon} me-1`}></i>
                          {statusMeta.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* User Account */}
                  <div>
                    <div className="detail-card">
                      <label className="detail-label">
                        <i className="bi bi-person me-2"></i>User Account ID
                      </label>
                      <div className="detail-value txn-user-row">
                        <div className="user-avatar-large">
                          {(t.user_account_id || "?").charAt(0).toUpperCase()}
                        </div>
                        {t.user_account_id || "—"}
                      </div>
                    </div>
                  </div>

                  {/* Amount */}
                  <div>
                    <div className="detail-card">
                      <label className="detail-label">
                        <i className="bi bi-currency-dollar me-2"></i>Amount
                      </label>
                      <div className="detail-value txn-amount">
                        {formatCurrency(t.amount)}
                      </div>
                    </div>
                  </div>

                  {/* Transaction Time */}
                  <div>
                    <div className="detail-card">
                      <label className="detail-label">
                        <i className="bi bi-clock me-2"></i>Transaction Time
                      </label>
                      <div className="detail-value">
                        {formatDateTime(t.transaction_time)}
                      </div>
                    </div>
                  </div>

                  {/* Location */}
                  <div>
                    <div className="detail-card">
                      <label className="detail-label">
                        <i className="bi bi-geo-alt me-2"></i>Location
                      </label>
                      <div className="detail-value">
                        {[t.city, t.country].filter(Boolean).join(", ") || "—"}
                      </div>
                    </div>
                  </div>

                  {/* Additional Information */}
                  <div className="txn-grid-full">
                    <div className="detail-card">
                      <label className="detail-label">
                        <i className="bi bi-info-circle me-2"></i>Additional
                        Information
                      </label>
                      <div className="txn-additional-grid">
                        <div>
                          <small className="txn-sub-label">Service</small>
                          <div className="txn-sub-value">
                            {t.service_source || "—"}
                          </div>
                        </div>
                        <div>
                          <small className="txn-sub-label">Terminal ID</small>
                          <div className="txn-sub-value">
                            {t.terminal_id || "—"}
                          </div>
                        </div>
                        <div>
                          <small className="txn-sub-label">IP Address</small>
                          <div className="txn-sub-value">
                            {t.ip_address || "—"}
                          </div>
                        </div>
                        <div>
                          <small className="txn-sub-label">Merchant ID</small>
                          <div className="txn-sub-value">
                            {t.merchant_id || "—"}
                          </div>
                        </div>
                        <div>
                          <small className="txn-sub-label">
                            Account Number
                          </small>
                          <div className="txn-sub-value">
                            {t.account_number || "—"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Score Breakdown */}
                  {t.score_breakdown && (
                    <div className="txn-grid-full">
                      <div className="detail-card">
                        <label className="detail-label">
                          <i className="bi bi-bar-chart-line me-2"></i>Score
                          Breakdown
                        </label>
                        <div className="txn-additional-grid">
                          <div>
                            <small className="txn-sub-label">Rule Score</small>
                            <div className="txn-sub-value">
                              {t.score_breakdown.rule_score ?? "—"}
                            </div>
                          </div>
                          <div>
                            <small className="txn-sub-label">
                              Pattern Score
                            </small>
                            <div className="txn-sub-value">
                              {t.score_breakdown.pattern_score ?? "—"}
                            </div>
                          </div>
                          <div>
                            <small className="txn-sub-label">ML Score</small>
                            <div className="txn-sub-value">
                              {t.score_breakdown.ml_score ?? "—"}
                            </div>
                          </div>
                          <div>
                            <small className="txn-sub-label">
                              Anomaly Score
                            </small>
                            <div className="txn-sub-value">
                              {t.anomaly_score != null ? (
                                t.anomaly_score.toFixed(4)
                              ) : (
                                <span
                                  className="text-muted"
                                  style={{ fontSize: "0.8rem" }}
                                >
                                  Pending ML
                                </span>
                              )}
                            </div>
                          </div>
                          <div>
                            <small className="txn-sub-label">ML Flagged</small>
                            <div className="txn-sub-value">
                              {t.is_flagged_ml ? (
                                <span style={{ color: "#dc2626" }}>
                                  <i className="bi bi-robot me-1"></i>Ya
                                </span>
                              ) : (
                                <span style={{ color: "#16a34a" }}>
                                  <i className="bi bi-check-circle me-1"></i>
                                  Tidak
                                </span>
                              )}
                            </div>
                          </div>
                          <div>
                            <small className="txn-sub-label">Final Score</small>
                            <div
                              className="txn-sub-value"
                              style={{ color: "#2563eb", fontWeight: 700 }}
                            >
                              {t.score_breakdown.final_score ?? riskScore}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Fraud Indicators — only when FRAUD & violation_reason exists */}
                  {isFraud && t.violation_reason && (
                    <div className="txn-grid-full">
                      <div className="detail-card border-danger">
                        <label className="detail-label txn-label-danger">
                          <i className="bi bi-exclamation-triangle me-2"></i>
                          Fraud Indicators
                        </label>
                        <ul className="fraud-indicators mb-0">
                          <li>{t.violation_reason}</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="txn-modal-footer">
              <button
                type="button"
                className="txn-btn txn-btn-secondary"
                onClick={onClose}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default TransactionDetailModal;
