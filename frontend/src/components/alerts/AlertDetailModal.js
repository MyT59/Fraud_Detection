import React, { useEffect, useRef, useState } from "react";
import useRole from "../../hooks/useRole";
import { updateAlertStatus } from "../../services/AlertsService";
import "./AlertDetailModal.css";

// ─── Helpers ──────────────────────────────────────────────────────

const SEVERITY_META = {
  CRITICAL: {
    label: "CRITICAL",
    cls: "severity-critical",
    icon: "bi-exclamation-octagon-fill",
  },
  HIGH: {
    label: "HIGH",
    cls: "severity-high",
    icon: "bi-exclamation-triangle-fill",
  },
  MEDIUM: {
    label: "MEDIUM",
    cls: "severity-medium",
    icon: "bi-exclamation-circle-fill",
  },
  LOW: { label: "LOW", cls: "severity-low", icon: "bi-info-circle-fill" },
};

const STATUS_META = {
  OPEN: { label: "Open", cls: "status-open", icon: "bi-circle-fill" },
  IN_PROGRESS: {
    label: "In Progress",
    cls: "status-in-progress",
    icon: "bi-arrow-repeat",
  },
  RESOLVED: {
    label: "Resolved",
    cls: "status-resolved",
    icon: "bi-check-circle-fill",
  },
  REOPENED: {
    label: "Reopened",
    cls: "status-open",
    icon: "bi-arrow-counterclockwise",
  },
  OVERRIDDEN: {
    label: "Overridden",
    cls: "status-in-progress",
    icon: "bi-shield-fill-exclamation",
  },
};

// Semua status yang bisa dipilih RISK_MANAGER & SUPER_ADMIN
// Sesuai AlertStatusEnum dari BE
const STATUS_OPTIONS = [
  { value: "OPEN", label: "Open", icon: "bi-circle", color: "#1d4ed8" },
  {
    value: "IN_PROGRESS",
    label: "In Progress",
    icon: "bi-arrow-repeat",
    color: "#7e22ce",
  },
  {
    value: "RESOLVED",
    label: "Resolved",
    icon: "bi-check-circle-fill",
    color: "#15803d",
  },
  {
    value: "REOPENED",
    label: "Reopened",
    icon: "bi-arrow-counterclockwise",
    color: "#d97706",
  },
  {
    value: "OVERRIDDEN",
    label: "Overridden",
    icon: "bi-shield-fill-exclamation",
    color: "#dc2626",
  },
];

const formatDate = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// ─── Sub-components ───────────────────────────────────────────────

const DetailRow = ({ label, value, children }) => (
  <div className="adm-row">
    <span className="adm-row__label">{label}</span>
    <span className="adm-row__value">{children ?? value ?? "—"}</span>
  </div>
);

const SeverityBadge = ({ severity }) => {
  const meta =
    SEVERITY_META[(severity || "LOW").toUpperCase()] || SEVERITY_META.LOW;
  return (
    <span className={`adm-badge ${meta.cls}`}>
      <i className={`bi ${meta.icon}`} /> {meta.label}
    </span>
  );
};

const StatusBadge = ({ status }) => {
  const meta =
    STATUS_META[(status || "OPEN").toUpperCase()] || STATUS_META.OPEN;
  return (
    <span className={`adm-badge ${meta.cls}`}>
      <i className={`bi ${meta.icon}`} /> {meta.label}
    </span>
  );
};

const ModalSkeleton = () => (
  <div className="adm-skeleton">
    {[1, 2, 3, 4, 5].map((i) => (
      <div key={i} className="adm-skeleton__row">
        <div className="adm-skeleton__label" />
        <div
          className="adm-skeleton__value"
          style={{ width: `${55 + (i % 3) * 15}%` }}
        />
      </div>
    ))}
  </div>
);

// ─── Update Status Dropdown ───────────────────────────────────────
// Hanya render untuk RISK_MANAGER & SUPER_ADMIN

const UpdateStatusDropdown = ({
  currentStatus,
  alertId,
  onStatusUpdated,
  disabled,
}) => {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const dropdownRef = useRef(null);

  // Tutup dropdown jika klik di luar
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
        setError(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = async (newStatus) => {
    if (newStatus === currentStatus) {
      setOpen(false);
      return;
    }
    setPending(true);
    setError(null);
    try {
      await updateAlertStatus(alertId, newStatus);
      setOpen(false);
      onStatusUpdated(newStatus);
    } catch (err) {
      setError(err.message || "Gagal update status.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div ref={dropdownRef} style={{ position: "relative" }}>
      <button
        className="adm-btn adm-btn--ghost"
        onClick={() => {
          setOpen((v) => !v);
          setError(null);
        }}
        disabled={disabled || pending}
        style={{ borderColor: open ? "#6b7280" : undefined, gap: "6px" }}
      >
        {pending ? (
          <>
            <i className="bi bi-arrow-repeat adm-spin" /> Updating…
          </>
        ) : (
          <>
            <i className="bi bi-sliders" />
            Update Status
            <i
              className={`bi bi-chevron-${open ? "up" : "down"}`}
              style={{ fontSize: ".65rem" }}
            />
          </>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            right: 0,
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: "10px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            zIndex: 600,
            minWidth: 200,
            padding: ".375rem",
            animation: "adm-slide-up .15s ease",
          }}
        >
          {/* Header dropdown */}
          <div
            style={{
              padding: ".5rem .75rem .375rem",
              fontSize: ".7rem",
              fontWeight: 700,
              color: "#94a3b8",
              textTransform: "uppercase",
              letterSpacing: ".06em",
              borderBottom: "1px solid #f1f5f9",
              marginBottom: ".25rem",
            }}
          >
            <i className="bi bi-sliders" style={{ marginRight: 4 }} /> Ubah
            Status
          </div>

          {STATUS_OPTIONS.map((opt) => {
            const isCurrent = opt.value === (currentStatus || "").toUpperCase();
            return (
              <button
                key={opt.value}
                onClick={() => handleSelect(opt.value)}
                disabled={isCurrent}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: ".5rem",
                  width: "100%",
                  padding: ".5rem .75rem",
                  border: "none",
                  borderRadius: "7px",
                  background: "transparent",
                  cursor: isCurrent ? "default" : "pointer",
                  fontSize: ".82rem",
                  fontWeight: isCurrent ? 700 : 500,
                  color: isCurrent ? opt.color : "#334155",
                  backgroundColor: isCurrent ? `${opt.color}12` : "transparent",
                  transition: "background .12s",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => {
                  if (!isCurrent)
                    e.currentTarget.style.backgroundColor = "#f8fafc";
                }}
                onMouseLeave={(e) => {
                  if (!isCurrent)
                    e.currentTarget.style.backgroundColor = "transparent";
                  else e.currentTarget.style.backgroundColor = `${opt.color}12`;
                }}
              >
                <i
                  className={`bi ${opt.icon}`}
                  style={{ color: opt.color, fontSize: ".9rem" }}
                />
                {opt.label}
                {isCurrent && (
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: ".7rem",
                      color: opt.color,
                      fontWeight: 700,
                    }}
                  >
                    Current
                  </span>
                )}
              </button>
            );
          })}

          {/* Error inline */}
          {error && (
            <div
              style={{
                margin: ".375rem",
                padding: ".4rem .6rem",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "6px",
                fontSize: ".75rem",
                color: "#dc2626",
              }}
            >
              <i
                className="bi bi-exclamation-circle-fill"
                style={{ marginRight: 4 }}
              />
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Main Modal ───────────────────────────────────────────────────

const AlertDetailModal = ({
  open,
  detail,
  loading,
  error,
  onClose,
  onResolve,
  onClaim,
  pendingOp,
  onStatusUpdated, // callback ke parent setelah status berhasil diubah
}) => {
  const { canManage } = useRole();
  const overlayRef = useRef(null);

  const isMLAlert = detail?.type?.includes("ML");
  const violationList =
    detail?.transaction?.violation_reason?.split(" | ") ?? [];

  // Track status lokal untuk update optimistic di badge header
  const [localStatus, setLocalStatus] = useState(null);
  const displayStatus = localStatus || detail?.status;

  // Reset localStatus setiap modal buka dengan alert baru
  useEffect(() => {
    if (open) setLocalStatus(null);
  }, [open, detail?.id]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose();
  };

  const handleStatusUpdated = (newStatus) => {
    setLocalStatus(newStatus);
    onStatusUpdated?.(detail.id, newStatus);
  };

  const canClaim = displayStatus === "OPEN";
  const canResolve = displayStatus === "IN_PROGRESS";

  return (
    <div
      className="adm-overlay"
      ref={overlayRef}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label="Alert Detail"
    >
      <div className="adm-panel">
        {/* ── Header ── */}
        <div className="adm-header">
          <div className="adm-header__left">
            <span className="adm-header__eyebrow">Alert Detail</span>
            <h2 className="adm-header__title">
              {loading ? (
                <span className="adm-skeleton__inline" style={{ width: 180 }} />
              ) : (
                detail?.title || "Alert"
              )}
            </h2>
          </div>
          <button className="adm-close" onClick={onClose} aria-label="Close">
            <i className="bi bi-x-lg" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="adm-body">
          {loading && <ModalSkeleton />}

          {!loading && error && (
            <div className="adm-error">
              <i className="bi bi-wifi-off" />
              <p>{error}</p>
            </div>
          )}

          {!loading && !error && detail && (
            <>
              {/* Badges */}
              <div className="adm-badges-row">
                <SeverityBadge severity={detail.severity} />
                <StatusBadge status={displayStatus} />
                {/* Info badge jika status diubah manual */}
                {localStatus && (
                  <span
                    style={{
                      fontSize: ".7rem",
                      background: "#f0fdf4",
                      color: "#15803d",
                      border: "1px solid #bbf7d0",
                      borderRadius: "10px",
                      padding: "2px 8px",
                      fontWeight: 600,
                    }}
                  >
                    <i
                      className="bi bi-check-circle-fill"
                      style={{ marginRight: 4 }}
                    />
                    Status diperbarui
                  </span>
                )}
              </div>

              <div className="adm-divider" />

              {/* Core fields */}
              <div className="adm-rows">
                <DetailRow label="Alert ID">
                  <code className="adm-code">#{detail.id}</code>
                </DetailRow>
                <DetailRow label="Transaction ID">
                  <code className="adm-code">
                    {detail.transaction_id ?? "—"}
                  </code>
                </DetailRow>
                <DetailRow label="Alert Type">
                  <span className="adm-pill adm-alert-type">{detail.type}</span>
                </DetailRow>
                <DetailRow
                  label="Created At"
                  value={formatDate(detail.created_at)}
                />
                {detail.claimed_at && (
                  <DetailRow
                    label="Claimed At"
                    value={formatDate(detail.claimed_at)}
                  />
                )}
                {detail.resolved_at && (
                  <DetailRow
                    label="Resolved At"
                    value={formatDate(detail.resolved_at)}
                  />
                )}
                {detail.resolved_by && (
                  <DetailRow label="Resolved By">
                    <span className="adm-pill">
                      <i className="bi bi-person-fill" /> User #
                      {detail.resolved_by}
                    </span>
                  </DetailRow>
                )}
              </div>

              {/* Message */}
              {detail.message && (
                <div className="adm-message-block">
                  <span className="adm-message-block__label">
                    <i className="bi bi-card-text" /> Detail Pesan
                  </span>
                  <p className="adm-message-block__text">{detail.message}</p>
                </div>
              )}

              {/* ML block */}
              {isMLAlert && (
                <div
                  className="adm-message-block adm-ml-block"
                  style={{ marginTop: 12 }}
                >
                  <span className="adm-message-block__label">
                    <i className="bi bi-cpu-fill" /> ML Detection
                  </span>
                  <p className="adm-message-block__text">
                    Alert ini juga terdeteksi oleh Machine Learning Runtime
                    (Isolation Forest).
                  </p>
                </div>
              )}

              {/* Transaction details */}
              {detail.transaction && (
                <>
                  <div className="adm-divider" />
                  <div className="adm-message-block">
                    <span className="adm-message-block__label">
                      <i className="bi bi-receipt" /> Data Transaksi
                    </span>
                    <div className="adm-rows" style={{ marginTop: 12 }}>
                      <DetailRow label="Original Trx ID">
                        <code className="adm-code">
                          {detail.transaction.original_trx_id}
                        </code>
                      </DetailRow>
                      <DetailRow
                        label="Service Source"
                        value={detail.transaction.service_source}
                      />
                      <DetailRow label="Amount">
                        Rp {detail.transaction.amount?.toLocaleString("id-ID")}
                      </DetailRow>
                      <DetailRow
                        label="Account Number"
                        value={detail.transaction.account_number}
                      />
                      <DetailRow
                        label="Merchant ID"
                        value={detail.transaction.merchant_id}
                      />
                      <DetailRow
                        label="IP Address"
                        value={detail.transaction.ip_address}
                      />
                      {detail.ml_score != null && (
                        <DetailRow label="ML Score">
                          <code
                            className="adm-code"
                            style={{ color: "#7c3aed", borderColor: "#c4b5fd" }}
                          >
                            {typeof detail.ml_score === "number"
                              ? detail.ml_score.toFixed(6)
                              : detail.ml_score}
                          </code>
                        </DetailRow>
                      )}
                      {detail.is_anomaly !== undefined &&
                        detail.ml_score != null && (
                          <DetailRow label="ML Anomaly">
                            <span
                              className={`adm-badge ${detail.is_anomaly ? "severity-critical" : "status-resolved"}`}
                              style={{
                                fontSize: "0.75rem",
                                padding: "2px 8px",
                              }}
                            >
                              {detail.is_anomaly ? "YES / ANOMALY" : "NO"}
                            </span>
                          </DetailRow>
                        )}
                      {detail.ml_patterns?.length > 0 && (
                        <DetailRow label="ML Patterns">
                          <div
                            style={{
                              display: "flex",
                              gap: "4px",
                              flexWrap: "wrap",
                              marginTop: "2px",
                            }}
                          >
                            {detail.ml_patterns.map((pat, idx) => (
                              <span
                                key={idx}
                                className="adm-badge"
                                style={{
                                  backgroundColor: "#f3e8ff",
                                  color: "#6b21a8",
                                  border: "1px solid #d8b4fe",
                                  textTransform: "none",
                                  fontSize: "0.7rem",
                                }}
                              >
                                {pat}
                              </span>
                            ))}
                          </div>
                        </DetailRow>
                      )}
                      <DetailRow label="Risk Score">
                        <span className="adm-pill">
                          {detail.transaction.risk_score}
                        </span>
                      </DetailRow>
                      <DetailRow label="Violation Reason">
                        <ul className="adm-violation-list">
                          {violationList.map((item, idx) => (
                            <li key={idx} style={{ marginBottom: "2px" }}>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </DetailRow>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* ── Footer ── */}
        {!loading && !error && detail && (
          <div className="adm-footer">
            <button className="adm-btn adm-btn--ghost" onClick={onClose}>
              Tutup
            </button>

            <div className="adm-footer__actions">
              {/* Update Status — hanya RISK_MANAGER & SUPER_ADMIN */}
              {canManage && (
                <UpdateStatusDropdown
                  currentStatus={displayStatus}
                  alertId={detail.id}
                  onStatusUpdated={handleStatusUpdated}
                  disabled={!!pendingOp}
                />
              )}

              {/* Claim — semua role, hanya jika status OPEN */}
              {canClaim && (
                <button
                  className="adm-btn adm-btn--claim"
                  onClick={() => onClaim(detail.id)}
                  disabled={!!pendingOp}
                >
                  {pendingOp === "claiming" ? (
                    <>
                      <i className="bi bi-arrow-repeat adm-spin" /> Claiming…
                    </>
                  ) : (
                    <>
                      <i className="bi bi-hand-index-fill" /> Claim
                    </>
                  )}
                </button>
              )}

              {/* Resolve — semua role, hanya jika status IN_PROGRESS */}
              {canResolve && (
                <button
                  className="adm-btn adm-btn--resolve"
                  onClick={() => onResolve(detail.id)}
                  disabled={!!pendingOp}
                >
                  {pendingOp === "resolving" ? (
                    <>
                      <i className="bi bi-arrow-repeat adm-spin" /> Resolving…
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check-lg" /> Resolve
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AlertDetailModal;
