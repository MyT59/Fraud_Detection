import React from "react";
import "./HistoryDetailModal.css";

/**
 * HistoryDetailModal
 *
 * Hanya merender field yang BENAR-BENAR ada di ReviewHistoryItem schema BE:
 *   id, transaction_id, alert_id, decision, review_note,
 *   previous_status, final_status, reviewed_by, created_at
 *
 * Field yang DIHAPUS (tidak ada di BE):
 *   service, amount, risk_score, account_id, matched_patterns,
 *   reviewer_name, reviewer_role, duration
 */

const fmtTs = (ds) => {
  if (!ds) return "—";
  return new Date(ds).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

// Decision config — sesuai enum BE: SAFE | FRAUD
const DECISION_META = {
  SAFE: {
    icon: "bi-check-circle-fill",
    label: "SAFE",
    bg: "#ecfdf5",
    color: "#059669",
    borderColor: "#059669",
  },
  FRAUD: {
    icon: "bi-x-circle-fill",
    label: "FRAUD",
    bg: "#fef2f2",
    color: "#dc2626",
    borderColor: "#dc2626",
  },
};

// Status badge helper
const StatusBadge = ({ status }) => {
  if (!status) return <span style={{ color: "#94a3b8" }}>—</span>;
  const colorMap = {
    FRAUD: { bg: "#fee2e2", color: "#b91c1c" },
    SAFE: { bg: "#dcfce7", color: "#15803d" },
    UNDER_REVIEW: { bg: "#eff6ff", color: "#1d4ed8" },
    PENDING: { bg: "#f1f5f9", color: "#475569" },
    RESOLVED: { bg: "#f0fdf4", color: "#15803d" },
  };
  const style = colorMap[status.toUpperCase()] || {
    bg: "#f1f5f9",
    color: "#475569",
  };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: "12px",
        fontSize: ".78rem",
        fontWeight: 700,
        background: style.bg,
        color: style.color,
      }}
    >
      {status}
    </span>
  );
};

// KV row helper
const KVRow = ({ label, children }) => (
  <div className="hmodal-field-row">
    <span className="hmodal-field-label">{label}</span>
    <span className="hmodal-field-value">{children}</span>
  </div>
);

const HistoryDetailModal = ({ item, onClose }) => {
  if (!item) return null;

  const decision = (item.decision || "").toUpperCase();
  const meta = DECISION_META[decision] || DECISION_META.SAFE;

  return (
    <div className="hmodal-overlay" onClick={onClose}>
      <div className="hmodal-box" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div
          className="hmodal-header"
          style={{ borderBottom: `3px solid ${meta.borderColor}` }}
        >
          <div className="hmodal-header-left">
            <div
              className="hmodal-icon-wrap"
              style={{ background: meta.bg, color: meta.color }}
            >
              <i className={`bi ${meta.icon}`} />
            </div>
            <div>
              <div className="hmodal-entry-label">
                Audit Entry · Review #{item.reviewId}
              </div>
              <div className="hmodal-txn-id">{item.transactionId}</div>
            </div>
          </div>
          <button className="hmodal-close" onClick={onClose}>
            <i className="bi bi-x-lg" />
          </button>
        </div>

        {/* Banner Decision */}
        <div
          className="hmodal-banner"
          style={{ background: meta.bg, color: meta.color }}
        >
          <i className={`bi ${meta.icon}`} />
          <span>
            Keputusan: <strong>{meta.label}</strong>
          </span>
          <span className="hmodal-banner-time">{fmtTs(item.createdAt)}</span>
        </div>

        <div className="hmodal-body">
          {/* Grid 2 kolom: Identifikasi + Status */}
          <div className="hmodal-grid" style={{ marginBottom: "1rem" }}>
            {/* Identifikasi */}
            <div className="hmodal-kv">
              <div className="hmodal-kv-label">
                <i className="bi bi-fingerprint" /> Identifikasi
              </div>
              <div
                className="hmodal-info-block"
                style={{
                  background: "transparent",
                  border: "none",
                  padding: 0,
                }}
              >
                <KVRow label="Review ID">
                  <code
                    style={{
                      fontFamily: "IBM Plex Mono, monospace",
                      fontSize: ".8rem",
                    }}
                  >
                    #{item.reviewId}
                  </code>
                </KVRow>
                <KVRow label="Transaction ID">
                  <code
                    style={{
                      fontFamily: "IBM Plex Mono, monospace",
                      fontSize: ".8rem",
                      color: "#7c3aed",
                    }}
                  >
                    {item.transactionId}
                  </code>
                </KVRow>
                <KVRow label="Alert ID">
                  {item.alertId != null ? (
                    <code
                      style={{
                        fontFamily: "IBM Plex Mono, monospace",
                        fontSize: ".8rem",
                      }}
                    >
                      #{item.alertId}
                    </code>
                  ) : (
                    "—"
                  )}
                </KVRow>
              </div>
            </div>

            {/* Status Transition */}
            <div className="hmodal-kv">
              <div className="hmodal-kv-label">
                <i className="bi bi-arrow-left-right" /> Status Transition
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: ".5rem",
                  marginTop: ".25rem",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: ".68rem",
                      color: "#94a3b8",
                      fontWeight: 600,
                      marginBottom: ".25rem",
                    }}
                  >
                    SEBELUM
                  </div>
                  <StatusBadge status={item.previousStatus} />
                </div>
                <div
                  style={{
                    color: "#94a3b8",
                    fontSize: ".85rem",
                    paddingLeft: "4px",
                  }}
                >
                  <i className="bi bi-arrow-down" />
                </div>
                <div>
                  <div
                    style={{
                      fontSize: ".68rem",
                      color: "#94a3b8",
                      fontWeight: 600,
                      marginBottom: ".25rem",
                    }}
                  >
                    SESUDAH
                  </div>
                  <StatusBadge status={item.finalStatus} />
                </div>
              </div>
            </div>
          </div>

          {/* Reviewer & Waktu */}
          <div className="hmodal-grid" style={{ marginBottom: "1rem" }}>
            <div className="hmodal-kv">
              <div className="hmodal-kv-label">
                <i className="bi bi-person-badge" /> Reviewer
              </div>
              <div className="hmodal-kv-value">
                {item.reviewedBy != null ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: ".6rem",
                    }}
                  >
                    <div className="hmodal-avatar">
                      <i
                        className="bi bi-person-fill"
                        style={{ fontSize: ".8rem" }}
                      />
                    </div>
                    <div>
                      <div className="hmodal-reviewer-name">
                        Analyst #{item.reviewedBy}
                      </div>
                      <div
                        className="hmodal-reviewer-role"
                        style={{ fontSize: ".7rem", color: "#94a3b8" }}
                      >
                        ID: {item.reviewedBy}
                      </div>
                    </div>
                  </div>
                ) : (
                  <span style={{ color: "#94a3b8" }}>—</span>
                )}
              </div>
            </div>

            <div className="hmodal-kv">
              <div className="hmodal-kv-label">
                <i className="bi bi-calendar-event" /> Waktu Review
              </div>
              <div
                className="hmodal-kv-value mono"
                style={{
                  fontFamily: "IBM Plex Mono, monospace",
                  fontSize: ".8rem",
                }}
              >
                {fmtTs(item.createdAt)}
              </div>
            </div>
          </div>

          {/* Decision & Confidence — dari field decision */}
          <div
            className="hmodal-kv hmodal-kv-full"
            style={{ marginBottom: "1rem" }}
          >
            <div className="hmodal-kv-label">
              <i className="bi bi-shield-check" /> Keputusan Final
            </div>
            <div
              style={{
                marginTop: ".4rem",
                display: "flex",
                alignItems: "center",
                gap: ".75rem",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: ".4rem",
                  padding: ".4rem 1rem",
                  background: meta.bg,
                  color: meta.color,
                  border: `1px solid ${meta.color}30`,
                  borderRadius: "8px",
                  fontWeight: 700,
                  fontSize: ".9rem",
                }}
              >
                <i className={`bi ${meta.icon}`} /> {meta.label}
              </span>
            </div>
          </div>

          {/* Review Notes */}
          {item.reviewNote && (
            <div className="hmodal-notes">
              <div className="hmodal-notes-label">
                <i className="bi bi-chat-left-text-fill" /> Catatan Review
              </div>
              <p className="hmodal-notes-text">{item.reviewNote}</p>
            </div>
          )}

          {/* Info: field tidak tersedia */}
          <div
            style={{
              marginTop: "1rem",
              padding: ".625rem 1rem",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              fontSize: ".75rem",
              color: "#64748b",
            }}
          >
            <i className="bi bi-info-circle" style={{ marginRight: 6 }} />
            Detail transaksi (amount, service, risk score) tidak tersedia di
            riwayat review. Untuk informasi lengkap, lihat di halaman{" "}
            <strong>Alerts</strong>.
          </div>
        </div>

        {/* Footer */}
        <div className="hmodal-footer">
          <button className="hmodal-close-btn" onClick={onClose}>
            <i className="bi bi-x-circle" /> Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

export default HistoryDetailModal;
