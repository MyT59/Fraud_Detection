import React from "react";
import "./alertItem.css";

const TYPE_CONFIG = {
  FRAUD: { icon: "bi-shield-x", label: "Fraud (ML)", colorClass: "type-fraud" }, // 🚀 TAMBAHKAN INI
  PATTERN: {
    icon: "bi-shield-x",
    label: "Pattern Detection",
    colorClass: "type-fraud",
  },
  RULE: { icon: "bi-gear-fill", label: "Rule Engine", colorClass: "type-rule" },
  COMBINED: {
    icon: "bi-shield-shaded",
    label: "Kombinasi",
    colorClass: "type-fraud",
  },
  BLACKLIST: {
    icon: "bi-ban",
    label: "Blacklist",
    colorClass: "type-blacklist",
  },
  ML: {
    icon: "bi-cpu-fill",
    label: "ML Anomaly",
    colorClass: "type-fraud",
  },
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

// Ubah key menjadi UpperCase agar cocok dengan Backend
const SEVERITY_CONFIG = {
  CRITICAL: { label: "Critical", colorClass: "sev-critical" },
  HIGH: { label: "High", colorClass: "sev-high" },
  MEDIUM: { label: "Medium", colorClass: "sev-medium" },
  LOW: { label: "Low", colorClass: "sev-low" },
};

const PENDING_LABEL = {
  resolving: "Menyelesaikan...",
  claiming: "Mengklaim...",
  deleting: "Menghapus...",
};

const fmtTime = (ts) => {
  if (!ts) return "–";
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
  // 🚀 PENGAMANAN DATA: Kebal dari beda huruf besar/kecil & fallback jika tidak ada data
  const safeType = (alert.type || "UNKNOWN").toUpperCase();
  const typeCfg = TYPE_CONFIG[safeType] || TYPE_CONFIG.UNKNOWN;

  const safeSeverity = (alert.severity || "LOW").toUpperCase();
  const sevCfg = SEVERITY_CONFIG[safeSeverity] || SEVERITY_CONFIG.LOW;

  // Sinkronisasi status API dengan UI
  const safeStatus = (alert.status || "OPEN").toUpperCase();
  const isUnread = safeStatus === "OPEN" || safeStatus === "UNREAD";
  const isInProgress = safeStatus === "IN_PROGRESS" || safeStatus === "READ";

  return (
    <div
      className={[
        "alert-item",
        isUnread ? "unread" : "",
        pending ? "pending-op" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="alert-item-inner">
        {/* Sisi Kiri: Ikon + Teks */}
        <div className="alert-item-left">
          <div className={`alert-icon ${typeCfg.colorClass}`}>
            <i className={`bi ${typeCfg.icon}`}></i>
          </div>

          <div className="alert-content-col">
            <div className="alert-meta">
              <span className={`alert-badge ${sevCfg.colorClass}`}>
                {sevCfg.label}
              </span>
              <span className="alert-type">{typeCfg.label}</span>
              <span className="alert-time">
                <i className="bi bi-clock"></i>{" "}
                {/* Baca created_at dari BE atau time dari data dummy */}
                {fmtTime(alert.created_at || alert.time)}
              </span>
              <span className="alert-id">#{alert.id}</span>
            </div>

            <h3 className="alert-item-title">{alert.title}</h3>
            <p className="alert-item-message">
              {alert.message || alert.description}
            </p>

            {/* Baca transaction_id dari BE atau txnId dari data dummy */}
            {(alert.transaction_id || alert.txnId) && (
              <div className="alert-txn-ref">
                <i className="bi bi-receipt"></i> Ref:{" "}
                <strong>{alert.transaction_id || alert.txnId}</strong>
              </div>
            )}
          </div>
        </div>

        {/* Separator */}
        <div className="alert-separator" aria-hidden="true" />

        {/* Sisi Kanan: Tombol / Spinner */}
        <div className="alert-actions-col">
          {pending ? (
            <div className="alert-spinner">
              <div className="spinner"></div>
              <span>{PENDING_LABEL[pending] || "Memproses..."}</span>
            </div>
          ) : (
            <div className="alert-actions">
              {onViewDetail && (
                <button
                  className="alert-action-btn alert-action-detail"
                  onClick={() => onViewDetail(alert.id)}
                  title="Lihat detail alert"
                >
                  <i className="bi bi-eye"></i> Detail
                </button>
              )}

              {isUnread && onClaim && (
                <button
                  className="alert-action-btn alert-action-claim"
                  onClick={() => onClaim(alert.id)}
                  title="Klaim untuk investigasi"
                >
                  <i className="bi bi-person-check"></i> Klaim
                </button>
              )}

              {isInProgress && onRelease && (
                <button
                  className="alert-action-btn alert-action-release"
                  onClick={() => onRelease(alert.id)}
                  title="Batal klaim & kembalikan ke antrean"
                >
                  <i className="bi bi-arrow-return-left"></i> Release
                </button>
              )}

              {isInProgress && onResolve && (
                <button
                  className="alert-action-btn alert-action-resolve"
                  onClick={() => onResolve(alert.id)}
                  title="Selesaikan alert"
                >
                  <i className="bi bi-check2-all"></i> Resolve
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AlertItem;
