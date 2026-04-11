import React from "react";
import "./HistoryDetailModal.css";

const fmt = (amount) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);

const fmtTs = (ds) => {
  const d = new Date(ds);
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

const ACTION_META = {
  approved: {
    icon: "bi-check-circle-fill",
    label: "Approved",
    cls: "approved",
    bg: "#ecfdf5",
    color: "#059669",
  },
  rejected: {
    icon: "bi-x-circle-fill",
    label: "Rejected",
    cls: "rejected",
    bg: "#fef2f2",
    color: "#dc2626",
  },
  flagged: {
    icon: "bi-flag-fill",
    label: "Flagged",
    cls: "flagged",
    bg: "#fffbeb",
    color: "#d97706",
  },
  escalated: {
    icon: "bi-arrow-up-circle-fill",
    label: "Escalated",
    cls: "escalated",
    bg: "#eff6ff",
    color: "#2563eb",
  },
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

const PROC_CODE_MAP = {
  0: "Balance Inquiry",
  10000: "Transfer",
  200000: "Payment",
  400000: "Withdrawal",
  900000: "Reversal",
};

const HistoryDetailModal = ({ item, onClose }) => {
  if (!item) return null;
  const meta = ACTION_META[item.action] || ACTION_META.approved;
  const isAgenusa = item.service === "agenusa";

  const procLabel =
    item.PROCESSING_CODE != null
      ? `${item.PROCESSING_CODE} — ${PROC_CODE_MAP[item.PROCESSING_CODE] || item.typeOrChannel || "—"}`
      : item.typeOrChannel || "—";

  return (
    <div className="hmodal-overlay" onClick={onClose}>
      <div className="hmodal-box" onClick={(e) => e.stopPropagation()}>
        <div
          className="hmodal-header"
          style={{ borderBottom: `3px solid ${meta.color}` }}
        >
          <div className="hmodal-header-left">
            <div
              className="hmodal-icon-wrap"
              style={{ background: meta.bg, color: meta.color }}
            >
              <i className={`bi ${meta.icon}`}></i>
            </div>
            <div>
              <div
                className="hmodal-entry-label"
                style={{ display: "flex", alignItems: "center", gap: ".5rem" }}
              >
                Audit Entry
                {item.service && <ServiceBadge service={item.service} />}
              </div>
              <div className="hmodal-txn-id">{item.transactionId}</div>
            </div>
          </div>
          <button className="hmodal-close" onClick={onClose}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        <div
          className="hmodal-banner"
          style={{ background: meta.bg, color: meta.color }}
        >
          <i className={`bi ${meta.icon}`}></i>
          <span>
            Transaction was <strong>{meta.label}</strong>
          </span>
          <span className="hmodal-banner-time">{fmtTs(item.timestamp)}</span>
        </div>

        <div className="hmodal-body">
          <div className="hmodal-row2" style={{ marginBottom: "1rem" }}>
            <div className="hmodal-risk-block">
              <div
                className="hmodal-risk-circle"
                style={{
                  borderColor:
                    item.riskScore >= 80
                      ? "#dc2626"
                      : item.riskScore >= 60
                        ? "#d97706"
                        : "#16a34a",
                  color:
                    item.riskScore >= 80
                      ? "#dc2626"
                      : item.riskScore >= 60
                        ? "#d97706"
                        : "#16a34a",
                }}
              >
                <span className="hmodal-risk-num">{item.riskScore}</span>
                <span className="hmodal-risk-sub">/100</span>
              </div>
              <div>
                <div className="hmodal-risk-info-label">Fraud Score</div>
                <div
                  className="hmodal-risk-level"
                  style={{
                    color:
                      item.riskScore >= 80
                        ? "#dc2626"
                        : item.riskScore >= 60
                          ? "#d97706"
                          : "#16a34a",
                  }}
                >
                  {item.riskScore >= 80
                    ? "CRITICAL RISK"
                    : item.riskScore >= 60
                      ? "HIGH RISK"
                      : "LOW RISK"}
                </div>
              </div>
            </div>

            <div className="hmodal-info-block">
              <div className="hmodal-block-title">
                <i className="bi bi-cash-stack"></i>
                {isAgenusa ? "Transaction" : "Billing"}
              </div>
              {isAgenusa ? (
                <>
                  <div className="hmodal-field-row">
                    <span className="hmodal-field-label">Amount</span>
                    <span className="hmodal-field-value amount">
                      {fmt(item.amount)}
                    </span>
                  </div>
                  <div className="hmodal-field-row">
                    <span className="hmodal-field-label">Processing Code</span>
                    <span className="hmodal-field-value mono">{procLabel}</span>
                  </div>
                  <div className="hmodal-field-row">
                    <span className="hmodal-field-label">Response Code</span>
                    <span className="hmodal-field-value mono">
                      {item.RESPONSE_CODE != null ? item.RESPONSE_CODE : "—"}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="hmodal-field-row">
                    <span className="hmodal-field-label">Bill Amount</span>
                    <span className="hmodal-field-value amount">
                      {fmt(item.amount)}
                    </span>
                  </div>
                  {item.PAYMENT_AMOUNT != null && (
                    <div className="hmodal-field-row">
                      <span className="hmodal-field-label">Payment Amount</span>
                      <span
                        className="hmodal-field-value amount"
                        style={{
                          color:
                            item.amount !== item.PAYMENT_AMOUNT
                              ? "#ea580c"
                              : "inherit",
                        }}
                      >
                        {fmt(item.PAYMENT_AMOUNT)}
                        {item.amount !== item.PAYMENT_AMOUNT && " ⚠️"}
                      </span>
                    </div>
                  )}
                  <div className="hmodal-field-row">
                    <span className="hmodal-field-label">Channel</span>
                    <span className="hmodal-field-value">
                      {item.CHANNEL || item.typeOrChannel || "—"}
                    </span>
                  </div>
                  <div className="hmodal-field-row">
                    <span className="hmodal-field-label">Refund Flag</span>
                    <span className="hmodal-field-value">
                      {item.REFUND_FLAG ? "✅ Yes" : "No"}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="hmodal-row2" style={{ marginBottom: "1rem" }}>
            <div className="hmodal-info-block">
              <div className="hmodal-block-title">
                <i className="bi bi-person-circle"></i>
                {isAgenusa ? "Account" : "Customer"}
              </div>
              {isAgenusa ? (
                <>
                  <div className="hmodal-field-row">
                    <span className="hmodal-field-label">Account Number</span>
                    <span className="hmodal-field-value mono">
                      {item.accountId || "—"}
                    </span>
                  </div>
                  <div className="hmodal-field-row">
                    <span className="hmodal-field-label">Date & Time</span>
                    <span className="hmodal-field-value mono">
                      {item.TIMESTAMP_DB
                        ? fmtTs(item.TIMESTAMP_DB)
                        : fmtTs(item.timestamp)}
                    </span>
                  </div>
                </>
              ) : (
                <div className="hmodal-field-row">
                  <span className="hmodal-field-label">Customer ID</span>
                  <span className="hmodal-field-value mono">
                    {item.accountId || "—"}
                  </span>
                </div>
              )}
            </div>

            <div className="hmodal-info-block">
              <div className="hmodal-block-title">
                <i className="bi bi-arrow-left-right"></i>
                {isAgenusa ? "Destination" : "Bill Info"}
              </div>
              {isAgenusa ? (
                <div className="hmodal-field-row">
                  <span className="hmodal-field-label">Dest. Account</span>
                  <span className="hmodal-field-value mono">
                    {item.DEST_ACCOUNT_NUMBER || item.destOrBill || "—"}
                  </span>
                </div>
              ) : (
                <div className="hmodal-field-row">
                  <span className="hmodal-field-label">Bill ID</span>
                  <span className="hmodal-field-value mono">
                    {item.BILL_ID || item.destOrBill || "—"}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="hmodal-info-block" style={{ marginBottom: "1rem" }}>
            <div className="hmodal-block-title">
              <i className="bi bi-exclamation-triangle"></i>
              Matched Fraud Patterns ({item.matchedPatterns?.length || 0})
            </div>
            {item.matchedPatterns?.length > 0 ? (
              <ul className="hmodal-anomaly-list">
                {item.matchedPatterns.map((p, i) => (
                  <li key={i} className="hmodal-anomaly-item">
                    <i className="bi bi-dot"></i>
                    {p
                      .replace(/_/g, " ")
                      .replace(/\b\w/g, (c) => c.toUpperCase())}
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

          <div className="hmodal-grid" style={{ marginBottom: "1rem" }}>
            <div className="hmodal-kv">
              <div className="hmodal-kv-label">
                <i className="bi bi-person-badge"></i> Reviewed By
              </div>
              <div className="hmodal-kv-value">
                <div className="hmodal-reviewer-row">
                  <div className="hmodal-avatar">
                    {item.reviewer
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)}
                  </div>
                  <div>
                    <div className="hmodal-reviewer-name">{item.reviewer}</div>
                    <div className="hmodal-reviewer-role">
                      {item.reviewerRole}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="hmodal-kv">
              <div className="hmodal-kv-label">
                <i className="bi bi-calendar-event"></i> Timestamp
              </div>
              <div className="hmodal-kv-value mono">
                {fmtTs(item.timestamp)}
              </div>
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
