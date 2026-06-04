import React, { useState, useEffect, useCallback } from "react";
import PageLoader from "../components/common/PageLoader";
import ReviewFilter from "../components/review/ReviewFilter";

import {
  fetchOpenQueue,
  fetchReviewMetrics,
  claimAndSubmitReview,
  claimAlert,
  submitReview,
  mapAlertsToTransactions,
} from "../services/reviewApiService";

import "./ManualReview.css";

const fmt = (amount) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount || 0);

const fmtDate = (ds) => {
  if (!ds) return "—";
  const d = new Date(ds);
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const THRESHOLDS = {
  agenusa: { review: 0.4828, high_risk: 0.5 },
  nusabill: { review: 0.4862, high_risk: 0.9321 },
};

const scoreToRisk = (score01, service) => {
  if (service === "agenusa") {
    if (score01 >= 0.88) return "critical";
    if (score01 >= 0.7) return "high";
    if (score01 >= THRESHOLDS.agenusa.high_risk) return "medium";
    return "low";
  } else {
    if (score01 >= THRESHOLDS.nusabill.high_risk) return "critical";
    if (score01 >= 0.75) return "high";
    if (score01 >= THRESHOLDS.nusabill.review) return "medium";
    return "low";
  }
};

const PROC_CODE_MAP = {
  0: "Balance Inquiry",
  10000: "Transfer",
  200000: "Payment",
  400000: "Withdrawal",
  900000: "Reversal",
};

const RISK_COLOR = {
  low: "#16a34a",
  medium: "#d97706",
  high: "#ea580c",
  critical: "#dc2626",
};
const getRiskColor = (l) => RISK_COLOR[l] || "#475569";

const SAMPLE_TRANSACTIONS = [
  {
    id: "AGN-000001",
    _alertId: null,
    service: "agenusa",
    status: "pending",
    rawScore: 0.931,
    ACCOUNT_NUMBER: "ACCT100038",
    TIMESTAMP_DB: "2026-01-17 04:09:00",
    AMOUNT: 664602,
    DEST_ACCOUNT_NUMBER: "DST300123",
    PROCESSING_CODE: 10000,
    RESPONSE_CODE: 0,
    matched_patterns: [
      "rapid_retry_declined",
      "bruteforce_pin_pattern",
      "money_mule_destination",
    ],
  },
  {
    id: "AGN-000002",
    _alertId: null,
    service: "agenusa",
    status: "pending",
    rawScore: 0.854,
    ACCOUNT_NUMBER: "ACCT100112",
    TIMESTAMP_DB: "2026-01-14 04:15:00",
    AMOUNT: 251202,
    DEST_ACCOUNT_NUMBER: "DST300182",
    PROCESSING_CODE: 10000,
    RESPONSE_CODE: 0,
    matched_patterns: ["bruteforce_pin_pattern", "money_mule_destination"],
  },
  {
    id: "AGN-000003",
    _alertId: null,
    service: "agenusa",
    status: "pending",
    rawScore: 0.782,
    ACCOUNT_NUMBER: "ACCT100021",
    TIMESTAMP_DB: "2026-01-12 03:17:00",
    AMOUNT: 234802,
    DEST_ACCOUNT_NUMBER: "DST300020",
    PROCESSING_CODE: 400000,
    RESPONSE_CODE: 0,
    matched_patterns: ["rapid_retry_declined", "midnight_unusual_amount"],
  },
  {
    id: "NUS-000001",
    _alertId: null,
    service: "nusabill",
    status: "pending",
    rawScore: 0.942,
    CUSTOMER_ID: "CUST10055",
    BILL_ID: "BILL881234",
    BILL_AMOUNT: 412500,
    PAYMENT_AMOUNT: 412500,
    CHANNEL: "API",
    REFUND_FLAG: 0,
    matched_patterns: ["burst_payment_pattern", "sudden_channel_switch_to_api"],
  },
  {
    id: "NUS-000002",
    _alertId: null,
    service: "nusabill",
    status: "pending",
    rawScore: 0.878,
    CUSTOMER_ID: "CUST10422",
    BILL_ID: "BILL334455",
    BILL_AMOUNT: 275000,
    PAYMENT_AMOUNT: 265000,
    CHANNEL: "API",
    REFUND_FLAG: 1,
    matched_patterns: ["refund_abuse_pattern", "burst_payment_pattern"],
  },
];

const normalise = (raw) => {
  const score01 = raw.rawScore ?? 0.5;
  const risk = scoreToRisk(score01, raw.service);
  const score100 = Math.round(score01 * 100);
  const patterns = (raw.matched_patterns || []).map((p) =>
    p.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
  );

  if (raw.service === "agenusa") {
    return {
      ...raw,
      fraudScore: score100,
      riskLevel: risk,
      accountId: raw.ACCOUNT_NUMBER || "—",
      amount: raw.AMOUNT || 0,
      amountNote: null,
      destOrBill: raw.DEST_ACCOUNT_NUMBER || "—",
      typeOrChannel:
        PROC_CODE_MAP[raw.PROCESSING_CODE] || `Code ${raw.PROCESSING_CODE}`,
      dateTime: raw.TIMESTAMP_DB || null,
      anomalies: patterns,
    };
  } else {
    return {
      ...raw,
      fraudScore: score100,
      riskLevel: risk,
      accountId: raw.CUSTOMER_ID || "—",
      amount: raw.BILL_AMOUNT || 0,
      amountNote:
        raw.BILL_AMOUNT !== raw.PAYMENT_AMOUNT
          ? `Paid: ${fmt(raw.PAYMENT_AMOUNT)}`
          : null,
      destOrBill: raw.BILL_ID || "—",
      typeOrChannel: raw.CHANNEL || "—",
      dateTime: null,
      anomalies: patterns,
    };
  }
};

const mapAlertToTxnFrontend = (alert) => {
  const service =
    (alert.service || "").toLowerCase() === "nusabill" ? "nusabill" : "agenusa";

  const parseAnomalies = (msg = "") => {
    return msg
      .split("\n")
      .filter((l) => l.trim().startsWith("-") || l.trim().startsWith("•"))
      .map((l) => l.replace(/^[-•]\s*/, "").trim())
      .filter(Boolean);
  };

  const priorityScore = alert.priority ?? 50;
  const rawScore = Math.min(priorityScore / 100, 1);
  const anomalies = parseAnomalies(
    alert.description || alert.message_raw || "",
  );

  const base = {
    id: alert.trx_id || `TXN-${alert.transaction_id}`,
    _alertId: alert.id,
    _transactionId: alert.transaction_id,
    service,
    status: "pending",
    rawScore,
    matched_patterns: anomalies.map((a) =>
      a.toLowerCase().replace(/\s+/g, "_"),
    ),
    dateTime: alert.created_at || null,
    _alertData: alert,
  };

  if (service === "agenusa") {
    return {
      ...base,
      ACCOUNT_NUMBER: alert.user_account || "—",
      DEST_ACCOUNT_NUMBER: "—",
      TIMESTAMP_DB: alert.created_at,
      AMOUNT: 0,
      PROCESSING_CODE: 10000,
      RESPONSE_CODE: 0,
    };
  } else {
    return {
      ...base,
      CUSTOMER_ID: alert.user_account || "—",
      BILL_ID: "—",
      BILL_AMOUNT: 0,
      PAYMENT_AMOUNT: 0,
      CHANNEL: "—",
      REFUND_FLAG: 0,
    };
  }
};

const StatusTag = ({ status }) => {
  const map = {
    pending: { icon: "bi-clock-history", label: "Pending" },
    approved: { icon: "bi-check-circle-fill", label: "Approved" },
    rejected: { icon: "bi-x-circle-fill", label: "Rejected" },
  };
  const { icon, label } = map[status] || map.pending;
  return (
    <span className={`status-tag ${status}`}>
      <i className={`bi ${icon}`}></i>
      {label}
    </span>
  );
};

const ServiceBadge = ({ service }) => (
  <span
    style={{
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: "4px",
      fontSize: ".68rem",
      fontWeight: 700,
      letterSpacing: ".04em",
      background: service === "agenusa" ? "#eff6ff" : "#fdf4ff",
      color: service === "agenusa" ? "#1d4ed8" : "#7c3aed",
      border: `1px solid ${service === "agenusa" ? "#bfdbfe" : "#e9d5ff"}`,
    }}
  >
    {service === "agenusa" ? "AGENUSA" : "NUSABILL"}
  </span>
);

const Pagination = ({
  currentPage,
  totalPages,
  totalItems,
  perPage,
  onPageChange,
}) => {
  const start = totalItems === 0 ? 0 : (currentPage - 1) * perPage + 1;
  const end = Math.min(currentPage * perPage, totalItems);
  const eff = Math.max(1, totalPages);

  const getPages = () => {
    if (eff <= 7) return Array.from({ length: eff }, (_, i) => i + 1);
    const pages = [1];
    if (currentPage > 3) pages.push("...");
    for (
      let i = Math.max(2, currentPage - 1);
      i <= Math.min(eff - 1, currentPage + 1);
      i++
    )
      pages.push(i);
    if (currentPage < eff - 2) pages.push("...");
    pages.push(eff);
    return pages;
  };

  return (
    <div className="pagination-bar">
      <span className="pagination-info">
        Showing{" "}
        <strong>
          {start}–{end}
        </strong>{" "}
        of <strong>{totalItems}</strong> records
      </span>
      <div className="pagination-controls">
        <button
          className="page-btn page-nav"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <i className="bi bi-chevron-left"></i>
        </button>
        {getPages().map((p, i) =>
          p === "..." ? (
            <span key={`d${i}`} className="page-ellipsis">
              …
            </span>
          ) : (
            <button
              key={p}
              className={`page-btn${p === currentPage ? " active" : ""}`}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          ),
        )}
        <button
          className="page-btn page-nav"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === eff || totalItems === 0}
        >
          <i className="bi bi-chevron-right"></i>
        </button>
      </div>
    </div>
  );
};

const TxnModal = ({ txn, onClose, onReview }) => {
  const [decision, setDecision] = useState("");
  const [notes, setNotes] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const rColor = getRiskColor(txn.riskLevel);
  const isPending = txn.status === "pending";
  const isAgenusa = txn.service === "agenusa";
  const thr = THRESHOLDS[txn.service];
  const isFallback = !txn._alertId;

  const handleDecide = (d) => {
    setDecision(d);
    setConfirming(true);
    setError(null);
  };

  const handleCancel = () => {
    setDecision("");
    setConfirming(false);
    setError(null);
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onReview(txn, decision, notes);
    } catch (err) {
      setError(err.message || "Terjadi kesalahan saat submit review.");
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="txn-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div
            className="modal-header-left"
            style={{
              display: "flex",
              alignItems: "center",
              gap: ".6rem",
              flexWrap: "wrap",
            }}
          >
            <span className="modal-txn-id">{txn.id}</span>
            <ServiceBadge service={txn.service} />
            <StatusTag status={txn.status} />
            {isFallback && (
              <span
                style={{
                  fontSize: ".68rem",
                  fontWeight: 700,
                  padding: "2px 7px",
                  borderRadius: "4px",
                  background: "#fef3c7",
                  color: "#92400e",
                  border: "1px solid #fde68a",
                }}
              >
                SAMPLE DATA
              </span>
            )}
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        <div className="modal-body">
          <div className="modal-grid" style={{ marginBottom: "1.25rem" }}>
            <div className="modal-risk-block">
              <div
                className="modal-risk-circle"
                style={{ borderColor: rColor, color: rColor }}
              >
                <span className="modal-risk-num">{txn.fraudScore}</span>
                <span className="modal-risk-sub">/100</span>
              </div>
              <div>
                <div className="modal-risk-info-label">
                  Fraud Score · review ≥{Math.round(thr.review * 100)}
                </div>
                <div className="modal-risk-level" style={{ color: rColor }}>
                  {txn.riskLevel.toUpperCase()} RISK
                </div>
                <div
                  style={{
                    fontSize: ".7rem",
                    color: "#94a3b8",
                    marginTop: ".2rem",
                  }}
                >
                  high-risk ≥{Math.round(thr.high_risk * 100)}
                </div>
              </div>
            </div>

            <div className="modal-info-block">
              <div className="modal-block-title">
                <i className="bi bi-cash-stack"></i>
                {isAgenusa ? "Transaction" : "Billing"}
              </div>
              {isAgenusa ? (
                <>
                  <div className="modal-field-row">
                    <span className="modal-field-label">Amount</span>
                    <span className="modal-field-value amount">
                      {fmt(txn.AMOUNT)}
                    </span>
                  </div>
                  <div className="modal-field-row">
                    <span className="modal-field-label">Processing Code</span>
                    <span className="modal-field-value mono">
                      {txn.PROCESSING_CODE} — {txn.typeOrChannel}
                    </span>
                  </div>
                  <div className="modal-field-row">
                    <span className="modal-field-label">Response Code</span>
                    <span className="modal-field-value mono">
                      {txn.RESPONSE_CODE}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="modal-field-row">
                    <span className="modal-field-label">Bill Amount</span>
                    <span className="modal-field-value amount">
                      {fmt(txn.BILL_AMOUNT)}
                    </span>
                  </div>
                  <div className="modal-field-row">
                    <span className="modal-field-label">Payment Amount</span>
                    <span
                      className="modal-field-value amount"
                      style={{
                        color:
                          txn.BILL_AMOUNT !== txn.PAYMENT_AMOUNT
                            ? "#ea580c"
                            : "inherit",
                      }}
                    >
                      {fmt(txn.PAYMENT_AMOUNT)}
                      {txn.BILL_AMOUNT !== txn.PAYMENT_AMOUNT && " ⚠️"}
                    </span>
                  </div>
                  <div className="modal-field-row">
                    <span className="modal-field-label">Channel</span>
                    <span className="modal-field-value">{txn.CHANNEL}</span>
                  </div>
                  <div className="modal-field-row">
                    <span className="modal-field-label">Refund Flag</span>
                    <span className="modal-field-value">
                      {txn.REFUND_FLAG ? "✅ Yes" : "No"}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="modal-grid" style={{ marginBottom: "1.25rem" }}>
            <div className="modal-info-block">
              <div className="modal-block-title">
                <i className="bi bi-person-circle"></i>
                {isAgenusa ? "Account" : "Customer"}
              </div>
              {isAgenusa ? (
                <>
                  <div className="modal-field-row">
                    <span className="modal-field-label">Account Number</span>
                    <span className="modal-field-value mono">
                      {txn.ACCOUNT_NUMBER}
                    </span>
                  </div>
                  <div className="modal-field-row">
                    <span className="modal-field-label">Date & Time</span>
                    <span className="modal-field-value mono">
                      {fmtDate(txn.TIMESTAMP_DB)}
                    </span>
                  </div>
                </>
              ) : (
                <div className="modal-field-row">
                  <span className="modal-field-label">Customer ID</span>
                  <span className="modal-field-value mono">
                    {txn.CUSTOMER_ID}
                  </span>
                </div>
              )}
            </div>

            <div className="modal-info-block">
              <div className="modal-block-title">
                <i className="bi bi-arrow-left-right"></i>
                {isAgenusa ? "Destination" : "Bill Info"}
              </div>
              {isAgenusa ? (
                <div className="modal-field-row">
                  <span className="modal-field-label">Dest. Account</span>
                  <span className="modal-field-value mono">
                    {txn.DEST_ACCOUNT_NUMBER}
                  </span>
                </div>
              ) : (
                <div className="modal-field-row">
                  <span className="modal-field-label">Bill ID</span>
                  <span className="modal-field-value mono">{txn.BILL_ID}</span>
                </div>
              )}
            </div>
          </div>

          {txn._alertId && (
            <div
              style={{
                padding: ".5rem .75rem",
                background: "#f0f9ff",
                border: "1px solid #bae6fd",
                borderRadius: "6px",
                fontSize: ".78rem",
                color: "#0369a1",
                marginBottom: "1.25rem",
                display: "flex",
                alignItems: "center",
                gap: ".4rem",
              }}
            >
              <i className="bi bi-link-45deg"></i>
              Alert ID: <strong>#{txn._alertId}</strong>
              {txn._transactionId && (
                <>
                  {" "}
                  · Transaction ID: <strong>#{txn._transactionId}</strong>
                </>
              )}
            </div>
          )}

          <div className="modal-info-block" style={{ marginBottom: "1.25rem" }}>
            <div className="modal-block-title">
              <i className="bi bi-exclamation-triangle"></i>
              Matched Fraud Patterns ({txn.anomalies?.length || 0})
            </div>
            {txn.anomalies?.length > 0 ? (
              <ul className="modal-anomaly-list">
                {txn.anomalies.map((a, i) => (
                  <li key={i} className="modal-anomaly-item">
                    <i className="bi bi-dot"></i>
                    {a}
                  </li>
                ))}
              </ul>
            ) : (
              <p
                style={{
                  fontSize: ".875rem",
                  color: "#94a3b8",
                  margin: ".5rem 0 0",
                }}
              >
                No specific pattern — flagged by score threshold only.
              </p>
            )}
          </div>

          {error && (
            <div
              style={{
                padding: ".6rem .9rem",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "6px",
                color: "#dc2626",
                fontSize: ".82rem",
                fontWeight: 600,
                marginBottom: "1rem",
                display: "flex",
                alignItems: "center",
                gap: ".4rem",
              }}
            >
              <i className="bi bi-exclamation-circle-fill"></i>
              {error}
            </div>
          )}

          {!isPending && (
            <div className="modal-reviewed-state">
              <i
                className={`bi ${txn.status === "approved" ? "bi-check-circle-fill" : "bi-x-circle-fill"} modal-reviewed-icon`}
                style={{
                  color: txn.status === "approved" ? "#16a34a" : "#dc2626",
                }}
              ></i>
              <h4>
                Already {txn.status === "approved" ? "Approved" : "Rejected"}
              </h4>
              <p>
                Reviewed on{" "}
                {fmtDate(txn.reviewedAt || new Date().toISOString())}
              </p>
              {txn.reviewNotes && (
                <div
                  className="audit-notes-block"
                  style={{ marginTop: ".75rem", textAlign: "left" }}
                >
                  <i className="bi bi-chat-left-text"></i>
                  <span className="audit-notes-text">{txn.reviewNotes}</span>
                </div>
              )}
            </div>
          )}

          {isPending && (
            <div className="modal-decision">
              <div className="modal-decision-title">Make Decision</div>

              {isFallback && (
                <div
                  style={{
                    padding: ".5rem .75rem",
                    background: "#fef3c7",
                    border: "1px solid #fde68a",
                    borderRadius: "6px",
                    fontSize: ".78rem",
                    color: "#92400e",
                    marginBottom: ".75rem",
                    display: "flex",
                    gap: ".4rem",
                    alignItems: "center",
                  }}
                >
                  <i className="bi bi-exclamation-triangle-fill"></i>
                  Mode offline — keputusan hanya tersimpan secara lokal, tidak
                  dikirim ke server.
                </div>
              )}

              {!confirming ? (
                <div className="modal-decision-btns">
                  <button
                    className="modal-btn-approve"
                    onClick={() => handleDecide("approved")}
                  >
                    <i className="bi bi-check-circle"></i>Approve Transaction
                  </button>
                  <button
                    className="modal-btn-reject"
                    onClick={() => handleDecide("rejected")}
                  >
                    <i className="bi bi-x-circle"></i>Reject Transaction
                  </button>
                </div>
              ) : (
                <div className="modal-confirm-section">
                  <div
                    style={{
                      padding: ".5rem .75rem",
                      background:
                        decision === "approved" ? "#f0fdf4" : "#fef2f2",
                      border: `1px solid ${decision === "approved" ? "#bbf7d0" : "#fecaca"}`,
                      borderRadius: "6px",
                      fontSize: ".82rem",
                      fontWeight: 600,
                      color: decision === "approved" ? "#15803d" : "#dc2626",
                      marginBottom: ".75rem",
                      display: "flex",
                      alignItems: "center",
                      gap: ".4rem",
                    }}
                  >
                    <i
                      className={`bi ${decision === "approved" ? "bi-check-circle-fill" : "bi-x-circle-fill"}`}
                    ></i>
                    Confirm{" "}
                    {decision === "approved"
                      ? "Approval (SAFE)"
                      : "Rejection (FRAUD)"}
                    {txn._alertId && (
                      <span
                        style={{
                          marginLeft: "auto",
                          fontSize: ".72rem",
                          fontWeight: 400,
                          color: "#64748b",
                        }}
                      >
                        Alert #{txn._alertId}
                      </span>
                    )}
                  </div>

                  <div className="modal-notes-input">
                    <label>Review Notes (Optional, max 500 karakter)</label>
                    <textarea
                      rows="3"
                      maxLength={500}
                      placeholder="Add notes about your decision..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                    <div
                      style={{
                        fontSize: ".72rem",
                        color: "#94a3b8",
                        textAlign: "right",
                      }}
                    >
                      {notes.length}/500
                    </div>
                  </div>

                  <div className="modal-confirm-row">
                    <button
                      className="modal-btn-cancel"
                      onClick={handleCancel}
                      disabled={submitting}
                    >
                      Cancel
                    </button>
                    <button
                      className={
                        decision === "approved"
                          ? "modal-btn-confirm-approve"
                          : "modal-btn-confirm-reject"
                      }
                      onClick={handleConfirm}
                      disabled={submitting}
                    >
                      {submitting ? (
                        <>
                          <span
                            style={{
                              display: "inline-block",
                              width: "12px",
                              height: "12px",
                              border: "2px solid currentColor",
                              borderTopColor: "transparent",
                              borderRadius: "50%",
                              animation: "spin 0.6s linear infinite",
                              marginRight: ".4rem",
                            }}
                          ></span>
                          Submitting...
                        </>
                      ) : (
                        `Confirm ${decision === "approved" ? "Approval" : "Rejection"}`
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ReviewStatsBar = ({ metrics, loading }) => {
  if (loading) return null;
  if (!metrics) return null;

  const stats = [
    {
      label: "Open Alerts",
      value: metrics.open_alerts ?? "—",
      icon: "bi-inbox-fill",
      color: "#f59e0b",
    },
    {
      label: "In Progress",
      value: metrics.in_progress_alerts ?? "—",
      icon: "bi-hourglass-split",
      color: "#3b82f6",
    },
    {
      label: "Reviewed Today",
      value: metrics.total_reviews ?? "—",
      icon: "bi-clipboard-check",
      color: "#8b5cf6",
    },
    {
      label: "Fraud Rate",
      value:
        metrics.fraud_confirmation_rate != null
          ? `${metrics.fraud_confirmation_rate.toFixed(1)}%`
          : "—",
      icon: "bi-shield-exclamation",
      color: "#ef4444",
    },
    {
      label: "Avg. Review Time",
      value:
        metrics.avg_review_duration_minutes != null
          ? `${metrics.avg_review_duration_minutes.toFixed(1)} min`
          : "—",
      icon: "bi-stopwatch",
      color: "#10b981",
    },
  ];

  return (
    <div
      style={{
        display: "flex",
        gap: ".75rem",
        flexWrap: "wrap",
        marginBottom: "1.25rem",
      }}
    >
      {stats.map((s) => (
        <div
          key={s.label}
          style={{
            flex: "1 1 120px",
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: "10px",
            padding: ".75rem 1rem",
            display: "flex",
            alignItems: "center",
            gap: ".6rem",
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "8px",
              background: `${s.color}18`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: s.color,
              fontSize: "1.1rem",
              flexShrink: 0,
            }}
          >
            <i className={`bi ${s.icon}`}></i>
          </div>
          <div>
            <div
              style={{ fontSize: ".72rem", color: "#64748b", fontWeight: 500 }}
            >
              {s.label}
            </div>
            <div
              style={{ fontSize: "1.05rem", fontWeight: 700, color: "#0f172a" }}
            >
              {s.value}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const ManualReview = () => {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [apiError, setApiError] = useState(false);
  const [metrics, setMetrics] = useState(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setApiError(false);

        const alerts = await fetchOpenQueue({ limit: 100 });

        if (!Array.isArray(alerts) || alerts.length === 0) {
          setTransactions(SAMPLE_TRANSACTIONS.map(normalise));
          setApiError(true);
          return;
        }

        const txns = alerts
          .map(mapAlertToTxnFrontend)
          .map(normalise)
          .sort((a, b) => b.fraudScore - a.fraudScore);

        setTransactions(txns);
      } catch (err) {
        console.warn("API tidak tersedia, pakai sample data:", err.message);
        setApiError(true);
        setTransactions(SAMPLE_TRANSACTIONS.map(normalise));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [refreshKey]);

  useEffect(() => {
    const loadMetrics = async () => {
      try {
        setMetricsLoading(true);
        const data = await fetchReviewMetrics();
        setMetrics(data);
      } catch {
      } finally {
        setMetricsLoading(false);
      }
    };

    loadMetrics();
  }, [refreshKey]);

  const handleReview = useCallback(async (txn, decision, notes) => {
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === txn.id
          ? {
              ...t,
              status: decision,
              reviewNotes: notes,
              reviewedAt: new Date().toISOString(),
            }
          : t,
      ),
    );
    setSelectedTxn(null);

    if (txn._alertId) {
      try {
        await claimAndSubmitReview({
          alertId: txn._alertId,
          frontendDecision: decision,
          note: notes,
          fraudScore: txn.fraudScore,
        });

        setRefreshKey((k) => k + 1);
      } catch (err) {
        console.error("Submit review gagal:", err);

        if (err.message && err.message.toLowerCase().includes("claim")) {
          try {
            await submitReview({
              alertId: txn._alertId,
              frontendDecision: decision,
              note: notes,
              fraudScore: txn.fraudScore,
            });
            setRefreshKey((k) => k + 1);
          } catch (retryErr) {
            console.error("Retry submit gagal:", retryErr);

            throw retryErr;
          }
        } else {
          throw err;
        }
      }
    } else {
      console.info(
        "Mode offline: review disimpan lokal, tidak dikirim ke server.",
      );
    }
  }, []);

  if (loading) return <PageLoader message="Memuat Manual Review..." />;

  return (
    <div className="manual-review-page">
      <div className="review-header">
        <div className="header-content">
          <h1>Manual Review</h1>
          <p className="subtitle">Review and verify flagged transactions</p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
          {apiError ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: ".5rem",
                padding: ".5rem 1rem",
                background: "#fef3c7",
                border: "1px solid #fde68a",
                borderRadius: "8px",
                fontSize: ".8rem",
                color: "#92400e",
                fontWeight: 600,
              }}
            >
              <i className="bi bi-exclamation-triangle-fill"></i>
              API offline — menampilkan sample data
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: ".5rem",
                padding: ".5rem 1rem",
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: "8px",
                fontSize: ".8rem",
                color: "#15803d",
                fontWeight: 600,
              }}
            >
              <i className="bi bi-check-circle-fill"></i>
              Terhubung ke API
            </div>
          )}

          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: ".35rem",
              padding: ".5rem .9rem",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              background: "#fff",
              fontSize: ".82rem",
              fontWeight: 600,
              color: "#374151",
              cursor: "pointer",
            }}
          >
            <i className="bi bi-arrow-clockwise"></i>
            Refresh
          </button>
        </div>
      </div>

      <ReviewStatsBar metrics={metrics} loading={metricsLoading} />

      <ReviewFilter transactions={transactions}>
        {({
          filtered,
          paginatedTxns,
          totalTxnPages,
          txnPage,
          setTxnPage,
          filterBar,
          sectionHeader,
          tableHead,
          datePickerPortal,
          activeFiltersBar,
        }) => (
          <>
            <div className="review-section">
              {sectionHeader}
              {activeFiltersBar}

              <div className="txn-table-wrapper">
                {filtered.length === 0 ? (
                  <div className="txn-empty">
                    <i className="bi bi-inbox"></i>
                    <p>No transactions match the current filter</p>
                  </div>
                ) : (
                  <table className="txn-table">
                    {tableHead}
                    <tbody>
                      {paginatedTxns.map((t) => (
                        <tr
                          key={t.id}
                          onClick={() => setSelectedTxn(t)}
                          style={{ cursor: "pointer" }}
                        >
                          <td>
                            <ServiceBadge service={t.service} />
                          </td>
                          <td>
                            <span className="cell-id">{t.id}</span>
                          </td>
                          <td>
                            <div className="cell-user-name">{t.accountId}</div>
                          </td>
                          <td>
                            <span className="cell-amount">{fmt(t.amount)}</span>
                            {t.amountNote && (
                              <div
                                style={{
                                  fontSize: ".72rem",
                                  color: "#ea580c",
                                  marginTop: "2px",
                                  fontWeight: 600,
                                }}
                              >
                                {t.amountNote}
                              </div>
                            )}
                          </td>
                          <td className="hide-sm">
                            <span
                              style={{
                                fontFamily: "IBM Plex Mono, monospace",
                                fontSize: ".8rem",
                                color: "#475569",
                              }}
                            >
                              {t.destOrBill}
                            </span>
                          </td>
                          <td className="hide-sm">
                            <span
                              style={{ fontSize: ".85rem", color: "#374151" }}
                            >
                              {t.typeOrChannel}
                            </span>
                            {t.service === "nusabill" && t.REFUND_FLAG ? (
                              <span
                                style={{
                                  display: "block",
                                  fontSize: ".7rem",
                                  color: "#7c3aed",
                                  fontWeight: 700,
                                  marginTop: "2px",
                                }}
                              >
                                🔄 Refund
                              </span>
                            ) : null}
                          </td>
                          <td className="hide-sm">
                            {t.dateTime ? (
                              <span className="cell-date">
                                {fmtDate(t.dateTime)}
                              </span>
                            ) : (
                              <span
                                style={{ color: "#94a3b8", fontSize: ".8rem" }}
                              >
                                —
                              </span>
                            )}
                          </td>
                          <td>
                            {t.anomalies?.length > 0 ? (
                              <span className="anomaly-pill">
                                <i className="bi bi-exclamation-triangle-fill"></i>
                                {t.anomalies.length}
                              </span>
                            ) : (
                              <span
                                style={{ color: "#94a3b8", fontSize: ".8rem" }}
                              >
                                —
                              </span>
                            )}
                          </td>
                          <td className="center">
                            <span className={`risk-badge risk-${t.riskLevel}`}>
                              <span className="risk-score-num">
                                {t.fraudScore}
                              </span>
                              <span className="risk-label-text">
                                {t.riskLevel}
                              </span>
                            </span>
                          </td>
                          <td>
                            <StatusTag status={t.status} />
                          </td>
                          <td
                            className="col-action"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              className="btn-aksi"
                              onClick={() => setSelectedTxn(t)}
                            >
                              <i className="bi bi-eye"></i>Aksi
                            </button>
                          </td>
                        </tr>
                      ))}

                      {Array.from({
                        length: Math.max(0, 10 - paginatedTxns.length),
                      }).map((_, i) => (
                        <tr key={`ghost-${i}`} className="txn-row-ghost">
                          <td></td>
                          <td></td>
                          <td></td>
                          <td></td>
                          <td className="hide-sm"></td>
                          <td className="hide-sm"></td>
                          <td className="hide-sm"></td>
                          <td></td>
                          <td></td>
                          <td></td>
                          <td className="col-action"></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <Pagination
                currentPage={txnPage}
                totalPages={totalTxnPages}
                totalItems={filtered.length}
                perPage={10}
                onPageChange={setTxnPage}
              />
            </div>

            {datePickerPortal}
          </>
        )}
      </ReviewFilter>

      {selectedTxn && (
        <TxnModal
          txn={selectedTxn}
          onClose={() => setSelectedTxn(null)}
          onReview={handleReview}
        />
      )}
    </div>
  );
};

export default ManualReview;
