import React from "react";
import { getAlertCaseType } from "../review/reviewHelpers";
import "./alertItem.css";

const TYPE_CONFIG = {
  FRAUD: { icon: "bi-shield-x", label: "Fraud", colorClass: "type-fraud" },
  PATTERN: {
    icon: "bi-diagram-3-fill",
    label: "Pattern",
    colorClass: "type-fraud",
  },
  RULE: { icon: "bi-gear-fill", label: "Rule", colorClass: "type-rule" },
  COMBINED: {
    icon: "bi-shield-shaded",
    label: "Combined",
    colorClass: "type-fraud",
  },
  BLACKLIST: {
    icon: "bi-ban",
    label: "Blacklist",
    colorClass: "type-blacklist",
  },
  ML: { icon: "bi-cpu-fill", label: "ML", colorClass: "type-fraud" },
  RULE_ML: {
    icon: "bi-gear-wide-connected",
    label: "Rule + ML",
    colorClass: "type-fraud",
  },
  PATTERN_ML: {
    icon: "bi-diagram-3-fill",
    label: "Pattern + ML",
    colorClass: "type-fraud",
  },
  COMBINED_ML: {
    icon: "bi-shield-fill-exclamation",
    label: "Combined + ML",
    colorClass: "type-fraud",
  },
  SYSTEM: { icon: "bi-cpu", label: "System", colorClass: "type-system" },
  UNKNOWN: {
    icon: "bi-question-circle",
    label: "Unknown",
    colorClass: "type-system",
  },
};

const SEVERITY_CONFIG = {
  CRITICAL: { label: "Critical", colorClass: "sev-critical" },
  HIGH: { label: "High", colorClass: "sev-high" },
  MEDIUM: { label: "Medium", colorClass: "sev-medium" },
  LOW: { label: "Low", colorClass: "sev-low" },
};

const STATUS_CONFIG = {
  OPEN: { label: "Open", icon: "bi-circle-fill", className: "status-open" },
  IN_PROGRESS: {
    label: "Claimed",
    icon: "bi-person-check-fill",
    className: "status-progress",
  },
  RESOLVED: {
    label: "Resolved",
    icon: "bi-check-circle-fill",
    className: "status-resolved",
  },
  REOPENED: {
    label: "Reopened",
    icon: "bi-arrow-counterclockwise",
    className: "status-open",
  },
  OVERRIDDEN: {
    label: "Overridden",
    icon: "bi-shield-fill-exclamation",
    className: "status-progress",
  },
};

const PENDING_LABEL = {
  resolving: "Menyelesaikan...",
  claiming: "Mengklaim...",
  deleting: "Menghapus...",
};

const fmtTime = (ts) => {
  if (!ts) return "-";
  return new Date(ts).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const AlertItem = ({
  alert,
  pending,
  onResolve,
  onClaim,
  onRelease,
  onDelete,
  onViewDetail,
}) => {
  const safeType = (alert.type || "UNKNOWN").toUpperCase();
  const typeCfg = TYPE_CONFIG[safeType] || TYPE_CONFIG.UNKNOWN;
  const safeSeverity = (alert.severity || "LOW").toUpperCase();
  const sevCfg = SEVERITY_CONFIG[safeSeverity] || SEVERITY_CONFIG.LOW;
  const safeStatus = (alert.status || "OPEN").toUpperCase();
  const statusCfg = STATUS_CONFIG[safeStatus] || STATUS_CONFIG.OPEN;
  const caseType = getAlertCaseType(alert);

  const isOpen = safeStatus === "OPEN" || safeStatus === "UNREAD";
  const isInProgress = safeStatus === "IN_PROGRESS" || safeStatus === "READ";
  const transactionId = alert.transaction_id || alert.txnId;

  return (
    <article
      className={[
        "alert-item",
        `severity-${safeSeverity.toLowerCase()}`,
        pending ? "pending-op" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        type="button"
        className="alert-card-main"
        onClick={() => onViewDetail?.(alert.id)}
      >
        <div className={`alert-icon ${typeCfg.colorClass}`}>
          <i className={`bi ${typeCfg.icon}`} />
        </div>

        <div className="alert-content-col">
          <div className="alert-meta">
            <span className={`alert-badge ${sevCfg.colorClass}`}>
              {sevCfg.label}
            </span>
            <span className={`alert-status-chip ${statusCfg.className}`}>
              <i className={`bi ${statusCfg.icon}`} />
              {statusCfg.label}
            </span>
            <span className="alert-type">{typeCfg.label}</span>
            <span className={`alert-case-chip ${caseType.tone}`}>
              <i className={`bi ${caseType.icon}`} />
              {caseType.label}
            </span>
            <span className="alert-id">#{alert.id}</span>
          </div>

          <h3 className="alert-item-title">{alert.title}</h3>
          <p className="alert-item-message">
            {alert.message || alert.description || "Tidak ada detail pesan."}
          </p>

          <div className="alert-facts">
            <span>
              <i className="bi bi-clock" />
              {fmtTime(alert.created_at || alert.time)}
            </span>
            {transactionId && (
              <span>
                <i className="bi bi-receipt" />
                TRX {transactionId}
              </span>
            )}
            {alert.service && (
              <span>
                <i className="bi bi-layers" />
                {String(alert.service).toUpperCase()}
              </span>
            )}
          </div>
        </div>
      </button>

      <div className="alert-actions-col">
        {pending ? (
          <div className="alert-spinner">
            <div className="spinner" />
            <span>{PENDING_LABEL[pending] || "Memproses..."}</span>
          </div>
        ) : (
          <div className="alert-actions">
            {onViewDetail && (
              <button
                className="alert-action-btn alert-action-detail"
                onClick={() => onViewDetail(alert.id)}
              >
                <i className="bi bi-eye" />
                Detail
              </button>
            )}

            {isOpen && onClaim && (
              <button
                className="alert-action-btn alert-action-claim"
                onClick={() => onClaim(alert.id)}
              >
                <i className="bi bi-person-check" />
                {caseType.key === "BLOCKED" ? "Investigate" : "Review"}
              </button>
            )}

            {isInProgress && onRelease && (
              <button
                className="alert-action-btn alert-action-release"
                onClick={() => onRelease(alert.id)}
              >
                <i className="bi bi-arrow-return-left" />
                Release
              </button>
            )}

            {isInProgress && onResolve && !alert.transaction_id && (
              <button
                className="alert-action-btn alert-action-resolve"
                onClick={() => onResolve(alert.id)}
              >
                <i className="bi bi-check2-all" />
                Resolve
              </button>
            )}

            {onDelete && (
              <button
                className="alert-action-btn alert-action-delete"
                onClick={() => onDelete(alert.id)}
              >
                <i className="bi bi-trash3" />
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
};

export default AlertItem;
