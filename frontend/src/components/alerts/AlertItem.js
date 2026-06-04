import React from "react";

const TYPE_CONFIG = {
  fraud: { icon: "bi-shield-x", label: "Fraud", colorClass: "type-fraud" },
  blacklist: {
    icon: "bi-ban",
    label: "Blacklist",
    colorClass: "type-blacklist",
  },
  rule: { icon: "bi-gear-fill", label: "Rule Engine", colorClass: "type-rule" },
  review: {
    icon: "bi-clipboard-check",
    label: "Manual Review",
    colorClass: "type-review",
  },
  system: { icon: "bi-cpu", label: "System", colorClass: "type-system" },
};

const SEVERITY_CONFIG = {
  critical: { label: "Critical", colorClass: "sev-critical" },
  high: { label: "High", colorClass: "sev-high" },
  medium: { label: "Medium", colorClass: "sev-medium" },
  low: { label: "Low", colorClass: "sev-low" },
};

const PENDING_LABEL = {
  resolving: "Menyelesaikan...",
  claiming: "Mengklaim...",
  deleting: "Menghapus...",
};

const fmtTime = (ts) => {
  if (!ts) return "–";
  const d = new Date(ts);
  return d.toLocaleString("id-ID", {
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
  onMarkRead,
  onResolve,
  onClaim,
  onDelete,
}) => {
  const type = TYPE_CONFIG[alert.type] || TYPE_CONFIG.system;
  const severity = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.low;
  const isUnread = alert.status === "unread";
  const isBusy = !!pending;

  return (
    <div
      className={`alert-item ${isUnread ? "alert-item-unread" : ""} ${isBusy ? "alert-item-busy" : ""}`}
      style={isBusy ? { opacity: 0.75, pointerEvents: "none" } : undefined}
    >
      {isUnread && <span className="alert-unread-dot"></span>}

      <div className={`alert-type-icon ${type.colorClass}`}>
        {isBusy ? (
          <i className="bi bi-arrow-repeat alert-spin"></i>
        ) : (
          <i className={`bi ${type.icon}`}></i>
        )}
      </div>

      <div className="alert-content">
        <div className="alert-content-top">
          <div className="alert-badges">
            <span className={`alert-type-badge ${type.colorClass}`}>
              {type.label}
            </span>
            <span className={`alert-severity-badge ${severity.colorClass}`}>
              {severity.label}
            </span>
            {alert.txnId && (
              <span className="alert-txn-badge">
                <i className="bi bi-hash"></i>
                {alert.txnId}
              </span>
            )}
          </div>

          <div className="alert-status-badge-wrap">
            {alert.status === "resolved" && (
              <span className="alert-status-resolved">
                <i className="bi bi-check-circle-fill"></i> Resolved
              </span>
            )}
            {alert.status === "read" && (
              <span className="alert-status-inprogress">
                <i className="bi bi-clock-history"></i> In Progress
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

          {isBusy ? (
            <span
              style={{
                fontSize: "0.8rem",
                color: "#6b7280",
                fontStyle: "italic",
              }}
            >
              {PENDING_LABEL[pending] || "Memproses..."}
            </span>
          ) : (
            <div className="alert-actions">
              {alert.status === "unread" && (
                <button
                  className="alert-action-btn"
                  onClick={() => onMarkRead(alert.id)}
                  title="Tandai Dibaca"
                >
                  <i className="bi bi-check2"></i> Tandai Dibaca
                </button>
              )}

              {alert.status === "unread" && onClaim && (
                <button
                  className="alert-action-btn alert-action-claim"
                  onClick={() => onClaim(alert.id)}
                  title="Klaim untuk investigasi"
                >
                  <i className="bi bi-person-check"></i> Klaim
                </button>
              )}

              {alert.status !== "resolved" && (
                <button
                  className="alert-action-btn alert-action-resolve"
                  onClick={() => onResolve(alert.id)}
                  title="Selesaikan alert"
                >
                  <i className="bi bi-check2-all"></i> Resolve
                </button>
              )}

              <button
                className="alert-action-btn alert-action-delete"
                onClick={() => onDelete(alert.id)}
                title="Hapus dari tampilan"
              >
                <i className="bi bi-trash3"></i>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AlertItem;
