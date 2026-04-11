import React, { useState, useEffect, useCallback } from "react";
import PageLoader from "../components/common/PageLoader";
import ReviewFilter from "../components/review/ReviewFilter";
import { labelHistory } from "../services/mlService";
import { submitReview, postFraudAlert } from "../services/reviewService";

import "./ManualReview.css";

const fmt = (amount) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);

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
const TXN_PER_PAGE = 5;

const SAMPLE_TRANSACTIONS = [
  {
    id: "AGN-000001",
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
    id: "AGN-000004",
    service: "agenusa",
    status: "pending",
    rawScore: 0.615,
    ACCOUNT_NUMBER: "ACCT100145",
    TIMESTAMP_DB: "2026-01-11 10:47:00",
    AMOUNT: 226048,
    DEST_ACCOUNT_NUMBER: "DST300122",
    PROCESSING_CODE: 400000,
    RESPONSE_CODE: 0,
    matched_patterns: [
      "impossible_travel_terminal_switch",
      "rapid_retry_declined",
    ],
  },
  {
    id: "AGN-000005",
    service: "agenusa",
    status: "pending",
    rawScore: 0.602,
    ACCOUNT_NUMBER: "ACCT100235",
    TIMESTAMP_DB: "2026-01-21 04:00:00",
    AMOUNT: 142014,
    DEST_ACCOUNT_NUMBER: "DST300197",
    PROCESSING_CODE: 10000,
    RESPONSE_CODE: 0,
    matched_patterns: ["impossible_travel_terminal_switch"],
  },
  {
    id: "AGN-000006",
    service: "agenusa",
    status: "pending",
    rawScore: 0.573,
    ACCOUNT_NUMBER: "ACCT100166",
    TIMESTAMP_DB: "2026-01-20 04:11:00",
    AMOUNT: 184311,
    DEST_ACCOUNT_NUMBER: "DST300135",
    PROCESSING_CODE: 10000,
    RESPONSE_CODE: 0,
    matched_patterns: ["midnight_unusual_amount"],
  },
  {
    id: "AGN-000007",
    service: "agenusa",
    status: "approved",
    rawScore: 0.521,
    ACCOUNT_NUMBER: "ACCT100187",
    TIMESTAMP_DB: "2026-01-21 03:15:00",
    AMOUNT: 130227,
    DEST_ACCOUNT_NUMBER: "DST300179",
    PROCESSING_CODE: 10000,
    RESPONSE_CODE: 0,
    matched_patterns: [],
    reviewNotes: "Verified with customer — legit transaction.",
    reviewedAt: "2026-01-22T08:30:00.000Z",
  },
  {
    id: "AGN-000008",
    service: "agenusa",
    status: "rejected",
    rawScore: 0.962,
    ACCOUNT_NUMBER: "ACCT100299",
    TIMESTAMP_DB: "2026-01-22 02:45:00",
    AMOUNT: 895000,
    DEST_ACCOUNT_NUMBER: "DST300301",
    PROCESSING_CODE: 10000,
    RESPONSE_CODE: 0,
    matched_patterns: [
      "rapid_retry_declined",
      "bruteforce_pin_pattern",
      "money_mule_destination",
      "midnight_unusual_amount",
    ],
    reviewNotes: "Multiple high-risk patterns confirmed. Account blocked.",
    reviewedAt: "2026-01-22T09:10:00.000Z",
  },

  {
    id: "NUS-000001",
    service: "nusabill",
    status: "pending",
    rawScore: 0.942,
    CUSTOMER_ID: "CUST10055",
    BILL_ID: "BILL881234",
    BILL_AMOUNT: 412500,
    PAYMENT_AMOUNT: 412500,
    CHANNEL: "API",
    REFUND_FLAG: 0,
    matched_patterns: [
      "burst_payment_pattern",
      "sudden_channel_switch_to_api",
      "refund_abuse_pattern",
    ],
  },
  {
    id: "NUS-000002",
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
  {
    id: "NUS-000003",
    service: "nusabill",
    status: "pending",
    rawScore: 0.765,
    CUSTOMER_ID: "CUST10199",
    BILL_ID: "BILL556677",
    BILL_AMOUNT: 198000,
    PAYMENT_AMOUNT: 198000,
    CHANNEL: "Mobile",
    REFUND_FLAG: 0,
    matched_patterns: ["payment_spike", "burst_payment_pattern"],
  },
  {
    id: "NUS-000004",
    service: "nusabill",
    status: "pending",
    rawScore: 0.657,
    CUSTOMER_ID: "CUST10188",
    BILL_ID: "BILL629474",
    BILL_AMOUNT: 357477,
    PAYMENT_AMOUNT: 357477,
    CHANNEL: "Web",
    REFUND_FLAG: 0,
    matched_patterns: ["sudden_channel_switch_to_api"],
  },
  {
    id: "NUS-000005",
    service: "nusabill",
    status: "pending",
    rawScore: 0.655,
    CUSTOMER_ID: "CUST10514",
    BILL_ID: "BILL445805",
    BILL_AMOUNT: 324503,
    PAYMENT_AMOUNT: 324503,
    CHANNEL: "Web",
    REFUND_FLAG: 0,
    matched_patterns: ["sudden_channel_switch_to_api"],
  },
  {
    id: "NUS-000006",
    service: "nusabill",
    status: "pending",
    rawScore: 0.648,
    CUSTOMER_ID: "CUST10360",
    BILL_ID: "BILL717788",
    BILL_AMOUNT: 195992,
    PAYMENT_AMOUNT: 195992,
    CHANNEL: "Mobile",
    REFUND_FLAG: 0,
    matched_patterns: ["sudden_channel_switch_to_api"],
  },
  {
    id: "NUS-000007",
    service: "nusabill",
    status: "pending",
    rawScore: 0.531,
    CUSTOMER_ID: "CUST10088",
    BILL_ID: "BILL223344",
    BILL_AMOUNT: 88000,
    PAYMENT_AMOUNT: 80000,
    CHANNEL: "Web",
    REFUND_FLAG: 0,
    matched_patterns: ["underpayment"],
  },
  {
    id: "NUS-000008",
    service: "nusabill",
    status: "approved",
    rawScore: 0.502,
    CUSTOMER_ID: "CUST10008",
    BILL_ID: "BILL160983",
    BILL_AMOUNT: 280575,
    PAYMENT_AMOUNT: 280575,
    CHANNEL: "Web",
    REFUND_FLAG: 0,
    matched_patterns: ["sudden_channel_switch_to_api"],
    reviewNotes: "Customer confirmed channel change was intentional.",
    reviewedAt: "2026-01-22T10:00:00.000Z",
  },
  {
    id: "NUS-000009",
    service: "nusabill",
    status: "rejected",
    rawScore: 0.957,
    CUSTOMER_ID: "CUST10588",
    BILL_ID: "BILL153894",
    BILL_AMOUNT: 315845,
    PAYMENT_AMOUNT: 310000,
    CHANNEL: "API",
    REFUND_FLAG: 1,
    matched_patterns: [
      "burst_payment_pattern",
      "refund_abuse_pattern",
      "sudden_channel_switch_to_api",
    ],
    reviewNotes: "Confirmed fraud — refund abuse + API channel switch pattern.",
    reviewedAt: "2026-01-22T11:20:00.000Z",
  },
];

const mapApiResult = (result, domain, index, originalId) => {
  const rec = result.record;
  const rawScore = result.ml_fraud_score;
  const prefix = domain === "agenusa" ? "AGN" : "NUS";

  const id = originalId || `${prefix}-${String(index + 1).padStart(6, "0")}`;

  if (domain === "agenusa") {
    return {
      id,
      service: "agenusa",
      status: "pending",
      rawScore,
      matched_patterns: result.matched_patterns || [],
      ACCOUNT_NUMBER: rec.ACCOUNT_NUMBER,
      TIMESTAMP_DB: rec.TIMESTAMP_DB,
      AMOUNT: rec.AMOUNT,
      DEST_ACCOUNT_NUMBER: rec.DEST_ACCOUNT_NUMBER,
      PROCESSING_CODE: rec.PROCESSING_CODE,
      RESPONSE_CODE: rec.RESPONSE_CODE,
    };
  } else {
    return {
      id,
      service: "nusabill",
      status: "pending",
      rawScore,
      matched_patterns: result.matched_patterns || [],
      CUSTOMER_ID: rec.CUSTOMER_ID,
      BILL_ID: rec.BILL_ID,
      BILL_AMOUNT: rec.BILL_AMOUNT,
      PAYMENT_AMOUNT: rec.PAYMENT_AMOUNT,
      CHANNEL: rec.CHANNEL,
      REFUND_FLAG: rec.REFUND_FLAG,
    };
  }
};

const normalise = (raw) => {
  const score01 = raw.rawScore;
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
      accountId: raw.ACCOUNT_NUMBER,
      amount: raw.AMOUNT,
      amountNote: null,
      destOrBill: raw.DEST_ACCOUNT_NUMBER,
      typeOrChannel:
        PROC_CODE_MAP[raw.PROCESSING_CODE] || `Code ${raw.PROCESSING_CODE}`,
      dateTime: raw.TIMESTAMP_DB,
      anomalies: patterns,
    };
  } else {
    return {
      ...raw,
      fraudScore: score100,
      riskLevel: risk,
      accountId: raw.CUSTOMER_ID,
      amount: raw.BILL_AMOUNT,
      amountNote:
        raw.BILL_AMOUNT !== raw.PAYMENT_AMOUNT
          ? `Paid: ${fmt(raw.PAYMENT_AMOUNT)}`
          : null,
      destOrBill: raw.BILL_ID,
      typeOrChannel: raw.CHANNEL,
      dateTime: null,
      anomalies: patterns,
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

  const rColor = getRiskColor(txn.riskLevel);
  const isPending = txn.status === "pending";
  const isAgenusa = txn.service === "agenusa";
  const thr = THRESHOLDS[txn.service];

  const handleDecide = (d) => {
    setDecision(d);
    setConfirming(true);
  };
  const handleCancel = () => {
    setDecision("");
    setConfirming(false);
  };
  const handleConfirm = async () => {
    setSubmitting(true);
    await onReview(txn, decision, notes);
    setSubmitting(false);
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
                  <div className="modal-notes-input">
                    <label>Review Notes (Optional)</label>
                    <textarea
                      rows="3"
                      placeholder="Add notes about your decision..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
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
                      {submitting
                        ? "Submitting..."
                        : `Confirm ${decision === "approved" ? "Approval" : "Rejection"}`}
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

const ManualReview = () => {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [apiError, setApiError] = useState(false);

  useEffect(() => {
    const fetchFromML = async () => {
      try {
        setLoading(true);
        setApiError(false);

        const BASE_URL =
          process.env.REACT_APP_ML_API_URL || "http://localhost:8000";

        const txnRes = await fetch(`${BASE_URL}/transactions/flagged`);
        if (!txnRes.ok)
          throw new Error(`Gagal fetch dataset: ${txnRes.status}`);
        const { agenusa: agenusaRaw, nusabill: nusabillRaw } =
          await txnRes.json();

        const agenusaIds = agenusaRaw.map((r) => r.id);
        const nusabillIds = nusabillRaw.map((r) => r.id);

        const agenusaRecords = agenusaRaw.map((r) => ({
          TERMINAL_ID: r.TERMINAL_ID || "T1000",
          MERCHANT_ID: r.MERCHANT_ID || "M2000",
          ACCOUNT_NUMBER: r.ACCOUNT_NUMBER,
          DEST_ACCOUNT_NUMBER: r.DEST_ACCOUNT_NUMBER,
          TIMESTAMP_DB: r.TIMESTAMP_DB,
          AMOUNT: Number(r.AMOUNT),
          STAN: r.STAN || 100000,
          PROCESSING_CODE: Number(r.PROCESSING_CODE) || 10000,
          RESPONSE_CODE: Number(r.RESPONSE_CODE) || 0,
          MTI: r.MTI || "0200",
        }));

        const nusabillRecords = nusabillRaw.map((r) => ({
          BILL_ID: r.BILL_ID,
          CUSTOMER_ID: r.CUSTOMER_ID,
          BILL_AMOUNT: Number(r.BILL_AMOUNT),
          PAYMENT_AMOUNT: Number(r.PAYMENT_AMOUNT),
          BILL_DATE: r.BILL_DATE || "2026-01-01",
          PAYMENT_DATE: r.PAYMENT_DATE || "2026-01-05",
          CHANNEL: r.CHANNEL || "Web",
          BILL_STATUS: r.BILL_STATUS || "Paid",
          REFUND_FLAG: Number(r.REFUND_FLAG) || 0,
        }));

        const [agenusaRes, nusabillRes, feedbackRes] = await Promise.all([
          labelHistory("agenusa", agenusaRecords, THRESHOLDS.agenusa),
          labelHistory("nusabill", nusabillRecords, THRESHOLDS.nusabill),
          fetch(`${BASE_URL}/review/feedback`).catch(() => null),
        ]);

        const reviewedIds = new Set();
        if (feedbackRes && feedbackRes.ok) {
          const fb = await feedbackRes.json();
          (fb.records || []).forEach((r) => reviewedIds.add(r.transaction_id));
        }

        const allTxns = [
          ...agenusaRes.results.map((r, i) =>
            mapApiResult(r, "agenusa", i, agenusaIds[i]),
          ),
          ...nusabillRes.results.map((r, i) =>
            mapApiResult(r, "nusabill", i, nusabillIds[i]),
          ),
        ]
          .map(normalise)
          .filter((t) => !reviewedIds.has(t.id))
          .sort((a, b) => b.fraudScore - a.fraudScore);

        setTransactions(allTxns);
      } catch (err) {
        console.warn("ML API tidak tersedia, pakai sample data:", err.message);
        setApiError(true);

        setTransactions(SAMPLE_TRANSACTIONS.map(normalise));
      } finally {
        setLoading(false);
      }
    };

    fetchFromML();
  }, []);

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

    try {
      await submitReview(txn, decision, notes);
    } catch (err) {
      console.warn("submitReview gagal:", err.message);
    }

    try {
      await postFraudAlert(txn, decision, notes);
    } catch (err) {
      console.warn("postFraudAlert gagal:", err.message);
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

        {apiError && (
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
            ML API offline — menampilkan sample data
          </div>
        )}
      </div>

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

                      {Array.from({ length: 10 - paginatedTxns.length }).map(
                        (_, i) => (
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
                        ),
                      )}
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
