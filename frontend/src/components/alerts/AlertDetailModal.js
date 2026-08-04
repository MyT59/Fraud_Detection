import React, { useEffect, useRef, useState } from "react";
import useRole from "../../hooks/useRole";
import { updateAlertStatus } from "../../services/AlertsService";
import { getAlertCaseType } from "../review/reviewHelpers";
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
const ALERT_TYPE_META = {
  RULE: { icon: "bi-gear-fill", color: "#0891b2", bg: "#e0f2fe" },
  PATTERN: { icon: "bi-diagram-3-fill", color: "#7c3aed", bg: "#f3e8ff" },
  COMBINED: { icon: "bi-shield-shaded", color: "#dc2626", bg: "#fef2f2" },
  BLACKLIST: { icon: "bi-ban", color: "#e11d48", bg: "#fff1f2" },
  ML: { icon: "bi-cpu-fill", color: "#6366f1", bg: "#eef2ff" },
  RULE_ML: { icon: "bi-gear-wide-connected", color: "#0369a1", bg: "#e0f2fe" },
  PATTERN_ML: { icon: "bi-diagram-3-fill", color: "#7c3aed", bg: "#f3e8ff" },
  COMBINED_ML: {
    icon: "bi-shield-fill-exclamation",
    color: "#dc2626",
    bg: "#fef2f2",
  },
  FRAUD: { icon: "bi-shield-x", color: "#dc2626", bg: "#fef2f2" },
};

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

const ALLOWED_STATUS_TRANSITIONS = {
  OPEN: ["RESOLVED", "OVERRIDDEN"],
  IN_PROGRESS: ["OPEN", "RESOLVED", "OVERRIDDEN"],
  RESOLVED: ["REOPENED", "OVERRIDDEN"],
  REOPENED: ["OPEN", "RESOLVED", "OVERRIDDEN"],
  OVERRIDDEN: ["REOPENED"],
};

const fmt = (amount) =>
  amount != null
    ? new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
      }).format(amount)
    : "—";

const PROCESSING_CODE_MAP = {
  0: "Balance Inquiry",
  10000: "Transfer",
  200000: "Payment",
  400000: "Withdrawal",
  900000: "Reversal",
};
const procLabel = (code) => {
  if (code == null) return "—";
  const label = PROCESSING_CODE_MAP[Number(code)];
  return label ? `${code} — ${label}` : String(code);
};

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

const AlertTypeBadge = ({ type }) => {
  const meta = ALERT_TYPE_META[(type || "").toUpperCase()] ?? {
    icon: "bi-bell",
    color: "#6b7280",
    bg: "#f1f5f9",
  };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "4px 10px",
        borderRadius: 20,
        fontSize: ".72rem",
        fontWeight: 700,
        letterSpacing: ".05em",
        textTransform: "uppercase",
        background: meta.bg,
        color: meta.color,
        border: `1px solid ${meta.color}30`,
      }}
    >
      <i className={`bi ${meta.icon}`} /> {type}
    </span>
  );
};

const PriorityBadge = ({ label, value }) => {
  const style = {
    CRITICAL: { bg: "#fef2f2", color: "#dc2626" },
    HIGH: { bg: "#fffbeb", color: "#d97706" },
    MEDIUM: { bg: "#eff6ff", color: "#2563eb" },
    LOW: { bg: "#f0fdf4", color: "#15803d" },
  }[label?.toUpperCase()] ?? { bg: "#f1f5f9", color: "#6b7280" };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "4px 10px",
        borderRadius: 20,
        fontSize: ".72rem",
        fontWeight: 700,
        background: style.bg,
        color: style.color,
        border: `1px solid ${style.color}30`,
      }}
    >
      <i className="bi bi-speedometer2" /> {label} ({value?.toFixed(1)})
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

          {STATUS_OPTIONS.filter((opt) =>
            (ALLOWED_STATUS_TRANSITIONS[(currentStatus || "").toUpperCase()] || []).includes(opt.value),
          ).map((opt) => {
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
  const { canManage, canOverride } = useRole();
  const overlayRef = useRef(null);

  const isMLAlert = detail?.type?.includes("ML");
  const isEscalated = detail?.is_escalated;
  const priorityLabel = detail?.priority_label;
  const claimedByName = detail?.claimed_by_name;
  const resolvedByName = detail?.resolved_by_name;
  const review = detail?.review ?? null;
  const isTransactionAlert = Boolean(detail?.transaction_id);
  const hasCompletedReview = Boolean(review?.decision && review?.reviewed_at);
  const violationList =
    detail?.transaction?.violation_reason?.split(" | ") ?? [];

  // Track status lokal untuk update optimistic di badge header
  const [localStatus, setLocalStatus] = useState(null);
  const [isOverrideOpen, setIsOverrideOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideError, setOverrideError] = useState("");
  const [isOverriding, setIsOverriding] = useState(false);
  const overrideReasonRef = useRef(null);
  const displayStatus = localStatus || detail?.status;

  // Reset localStatus setiap modal buka dengan alert baru
  useEffect(() => {
    if (open) {
      setLocalStatus(null);
      setIsOverrideOpen(false);
      setOverrideReason("");
      setOverrideError("");
    }
  }, [open, detail?.id]);

  useEffect(() => {
    if (isOverrideOpen) overrideReasonRef.current?.focus();
  }, [isOverrideOpen]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key !== "Escape") return;
      if (isOverrideOpen) {
        setIsOverrideOpen(false);
        setOverrideError("");
      } else {
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose, isOverrideOpen]);

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

  const canClaim = displayStatus === "OPEN" && typeof onClaim === "function";
  const canResolve =
    displayStatus === "IN_PROGRESS" &&
    typeof onResolve === "function" &&
    (!isTransactionAlert || hasCompletedReview);
  const canOverrideTransaction =
    canOverride &&
    isTransactionAlert &&
    ["OPEN", "IN_PROGRESS", "RESOLVED", "REOPENED"].includes(displayStatus);
  const caseType = getAlertCaseType({
    ...(detail || {}),
    transactionFinalStatus:
      detail?.transaction?.final_status ||
      detail?.transaction_final_status ||
      detail?.final_status,
    transaction: detail?.transaction,
  });

  const openOverrideModal = () => {
    setOverrideReason("");
    setOverrideError("");
    setIsOverrideOpen(true);
  };

  const handleOverride = async (e) => {
    e.preventDefault();
    const reason = overrideReason.trim();
    if (!reason) {
      setOverrideError("Alasan override wajib diisi untuk kebutuhan audit.");
      overrideReasonRef.current?.focus();
      return;
    }

    setIsOverriding(true);
    setOverrideError("");
    try {
      await updateAlertStatus(detail.id, "OVERRIDDEN", reason);
      handleStatusUpdated("OVERRIDDEN");
      setIsOverrideOpen(false);
      setOverrideReason("");
    } catch (err) {
      setOverrideError(err.message || "Gagal override alert.");
    } finally {
      setIsOverriding(false);
    }
  };

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
                <AlertTypeBadge type={detail.type} />
                <span className={`adm-case-chip ${caseType.tone}`}>
                  <i className={`bi ${caseType.icon}`} />
                  {caseType.label}
                </span>
                {priorityLabel && (
                  <PriorityBadge
                    label={priorityLabel}
                    value={detail.priority}
                  />
                )}
                {isEscalated && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "4px 10px",
                      borderRadius: 20,
                      fontSize: ".72rem",
                      fontWeight: 700,
                      background: "#fef3c7",
                      color: "#d97706",
                      border: "1px solid #fde68a",
                    }}
                  >
                    <i className="bi bi-arrow-up-circle-fill" /> ESCALATED
                  </span>
                )}
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
                <DetailRow
                  label="Created At"
                  value={formatDate(detail.created_at)}
                />

                {/* Claimed info */}
                {detail.claimed_at && (
                  <DetailRow
                    label="Claimed At"
                    value={formatDate(detail.claimed_at)}
                  />
                )}
                {(claimedByName || detail.claimed_by) && (
                  <DetailRow label="Claimed By">
                    <span className="adm-pill">
                      <i
                        className="bi bi-person-check-fill"
                        style={{ color: "#2563eb", marginRight: 4 }}
                      />
                      {claimedByName ?? `Analyst #${detail.claimed_by}`}
                    </span>
                  </DetailRow>
                )}

                {/* Resolved info */}
                {detail.resolved_at && (
                  <DetailRow
                    label="Resolved At"
                    value={formatDate(detail.resolved_at)}
                  />
                )}
                {(resolvedByName || detail.resolved_by) && (
                  <DetailRow label="Resolved By">
                    <span className="adm-pill">
                      <i
                        className="bi bi-person-fill"
                        style={{ color: "#15803d", marginRight: 4 }}
                      />
                      {resolvedByName ?? `User #${detail.resolved_by}`}
                    </span>
                  </DetailRow>
                )}

                {/* Version ID */}
                {detail.version_id != null && (
                  <DetailRow label="Version">
                    <code
                      className="adm-code"
                      style={{ fontSize: ".75rem", color: "#6b7280" }}
                    >
                      v{detail.version_id}
                    </code>
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
              {detail.transaction &&
                (() => {
                  const t = detail.transaction;
                  const td = t.transaction_details ?? {};
                  const isAgenusa =
                    (t.service_source ?? "").toUpperCase() === "AGENUSA";
                  const riskLevelStyle = {
                    CRITICAL: { bg: "#fef2f2", color: "#dc2626" },
                    HIGH: { bg: "#fffbeb", color: "#d97706" },
                    MEDIUM: { bg: "#eff6ff", color: "#2563eb" },
                    LOW: { bg: "#f0fdf4", color: "#15803d" },
                  }[t.risk_level?.toUpperCase()] ?? {
                    bg: "#f1f5f9",
                    color: "#475569",
                  };

                  return (
                    <>
                      <div className="adm-divider" />

                      {/* ── ML Detection ── */}
                      {detail.ml_score != null && (
                        <div className="adm-message-block adm-ml-block">
                          <span className="adm-message-block__label">
                            <i className="bi bi-cpu-fill" /> ML Detection
                          </span>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "1rem",
                              marginTop: 4,
                              flexWrap: "wrap",
                            }}
                          >
                            <div
                              style={{
                                width: 56,
                                height: 56,
                                borderRadius: "50%",
                                border: `3px solid #7c3aed`,
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                background: "#fff",
                                flexShrink: 0,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: ".85rem",
                                  fontWeight: 700,
                                  color: "#7c3aed",
                                  lineHeight: 1,
                                }}
                              >
                                {typeof detail.ml_score === "number"
                                  ? detail.ml_score.toFixed(4)
                                  : detail.ml_score}
                              </span>
                              <span
                                style={{ fontSize: ".55rem", color: "#94a3b8" }}
                              >
                                IF Score
                              </span>
                            </div>
                            <div>
                              <div
                                style={{
                                  display: "flex",
                                  gap: ".4rem",
                                  flexWrap: "wrap",
                                  marginBottom: ".3rem",
                                }}
                              >
                                <span
                                  className={`adm-badge ${detail.is_anomaly ? "severity-critical" : "status-resolved"}`}
                                  style={{ fontSize: ".72rem" }}
                                >
                                  {detail.is_anomaly ? "ANOMALY" : "NORMAL"}
                                </span>
                              </div>
                              {detail.ml_patterns?.length > 0 && (
                                <div
                                  style={{
                                    display: "flex",
                                    gap: "4px",
                                    flexWrap: "wrap",
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
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* ── Data Transaksi ── */}
                      <div className="adm-message-block">
                        <span className="adm-message-block__label">
                          <i className="bi bi-receipt" /> Data Transaksi
                        </span>
                        <div className="adm-rows" style={{ marginTop: 12 }}>
                          <DetailRow label="Original Trx ID">
                            <code className="adm-code">
                              {t.original_trx_id}
                            </code>
                          </DetailRow>
                          <DetailRow label="Service" value={t.service_source} />
                          <DetailRow label="Amount">
                            <strong>{fmt(t.amount)}</strong>
                          </DetailRow>
                          <DetailRow
                            label="Account"
                            value={t.account_number ?? "—"}
                          />
                          <DetailRow
                            label="User Account"
                            value={t.user_account_id ?? "—"}
                          />
                          <DetailRow
                            label="Terminal ID"
                            value={t.terminal_id ?? "—"}
                          />
                          <DetailRow
                            label="Merchant ID"
                            value={t.merchant_id ?? "—"}
                          />
                          <DetailRow
                            label="IP Address"
                            value={t.ip_address ?? "—"}
                          />
                          <DetailRow
                            label="Trx Time"
                            value={
                              t.transaction_time
                                ? formatDate(t.transaction_time)
                                : "—"
                            }
                          />
                          <DetailRow
                            label="Location"
                            value={
                              [t.city, t.country].filter(Boolean).join(", ") ||
                              "—"
                            }
                          />
                          <DetailRow label="ML Flagged">
                            <span
                              style={{
                                fontWeight: 700,
                                color: t.is_flagged_ml ? "#dc2626" : "#15803d",
                              }}
                            >
                              {t.is_flagged_ml ? "Ya ⚠️" : "Tidak"}
                            </span>
                          </DetailRow>

                          {/* Service-specific fields dari transaction_details */}
                          {isAgenusa ? (
                            <>
                              <DetailRow
                                label="Dest Account"
                                value={td.dest_account_number ?? "—"}
                              />
                              <DetailRow
                                label="Issuer Bank"
                                value={td.issuer_bank ?? "—"}
                              />
                              <DetailRow
                                label="Dest Bank"
                                value={td.dest_bank_code ?? "—"}
                              />
                              <DetailRow
                                label="Processing"
                                value={procLabel(td.processing_code)}
                              />
                              <DetailRow label="Response Code">
                                {td.response_code != null ? (
                                  <span
                                    style={{
                                      fontWeight: 700,
                                      color:
                                        String(td.response_code) === "0" ||
                                        String(td.response_code) === "00"
                                          ? "#15803d"
                                          : "#dc2626",
                                    }}
                                  >
                                    {String(td.response_code) === "0" ||
                                    String(td.response_code) === "00"
                                      ? "00 — Approved"
                                      : `${td.response_code} — Declined`}
                                  </span>
                                ) : (
                                  "—"
                                )}
                              </DetailRow>
                            </>
                          ) : (
                            <>
                              <DetailRow
                                label="Customer ID"
                                value={t.user_account_id ?? "—"}
                              />
                              <DetailRow label="Bill Amount">
                                <strong>{fmt(td.bill_amount)}</strong>
                              </DetailRow>
                              <DetailRow label="Payment Amount">
                                {(() => {
                                  const bill = td.bill_amount ?? 0;
                                  const paid =
                                    td.payment_amount ?? t.amount ?? 0;
                                  const diff = paid - bill;
                                  return (
                                    <span
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: ".4rem",
                                      }}
                                    >
                                      <strong>{fmt(paid)}</strong>
                                      {diff !== 0 && (
                                        <span
                                          style={{
                                            fontSize: ".7rem",
                                            fontWeight: 700,
                                            padding: "1px 6px",
                                            borderRadius: "8px",
                                            background:
                                              diff > 0 ? "#fef2f2" : "#fffbeb",
                                            color:
                                              diff > 0 ? "#dc2626" : "#92400e",
                                          }}
                                        >
                                          {diff > 0 ? "+" : ""}
                                          {fmt(diff)}
                                        </span>
                                      )}
                                    </span>
                                  );
                                })()}
                              </DetailRow>
                              <DetailRow
                                label="Channel"
                                value={td.channel ?? "—"}
                              />
                              <DetailRow
                                label="Status Tagihan"
                                value={td.status_tagihan ?? "—"}
                              />
                              <DetailRow
                                label="Bill Date"
                                value={td.bill_date ?? "—"}
                              />
                              <DetailRow
                                label="Payment Date"
                                value={td.payment_date ?? "—"}
                              />
                              {td.nama_customer && (
                                <DetailRow
                                  label="Nama Customer"
                                  value={td.nama_customer}
                                />
                              )}
                            </>
                          )}

                          <DetailRow label="Risk Score">
                            <span
                              style={{
                                fontWeight: 700,
                                color:
                                  (t.risk_score ?? 0) >= 80
                                    ? "#dc2626"
                                    : (t.risk_score ?? 0) >= 50
                                      ? "#d97706"
                                      : "#15803d",
                              }}
                            >
                              {t.risk_score ?? "—"}
                            </span>
                          </DetailRow>

                          {t.risk_level && (
                            <DetailRow label="Risk Level">
                              <span
                                style={{
                                  fontWeight: 700,
                                  padding: "2px 8px",
                                  borderRadius: "8px",
                                  fontSize: ".78rem",
                                  background: riskLevelStyle.bg,
                                  color: riskLevelStyle.color,
                                }}
                              >
                                {t.risk_level}
                              </span>
                            </DetailRow>
                          )}
                        </div>
                      </div>

                      {/* ── Score Breakdown ── */}
                      {t.score_breakdown &&
                        Object.keys(t.score_breakdown).length > 0 && (
                          <div
                            className="adm-message-block"
                            style={{ borderLeftColor: "#6366f1" }}
                          >
                            <span
                              className="adm-message-block__label"
                              style={{ color: "#6366f1" }}
                            >
                              <i className="bi bi-bar-chart-fill" /> Score
                              Breakdown
                            </span>
                            <div className="adm-rows" style={{ marginTop: 12 }}>
                              {t.score_breakdown.rule_score != null && (
                                <DetailRow
                                  label="Rule Score"
                                  value={t.score_breakdown.rule_score}
                                />
                              )}
                              {t.score_breakdown.pattern_score != null && (
                                <DetailRow label="Pattern Score">
                                  <span
                                    style={{
                                      fontWeight: 700,
                                      color:
                                        t.score_breakdown.pattern_score >= 50
                                          ? "#dc2626"
                                          : "#374151",
                                    }}
                                  >
                                    {t.score_breakdown.pattern_score}
                                  </span>
                                </DetailRow>
                              )}
                              {t.score_breakdown.ml_risk_contribution != null && (
                                <DetailRow label="ML Risk Impact">
                                  <span style={{ fontWeight: 700, color: "#7c3aed" }}>
                                    +{t.score_breakdown.ml_risk_contribution}
                                  </span>
                                </DetailRow>
                              )}
                              {t.score_breakdown.final_score != null && (
                                <DetailRow label="Final Score">
                                  <span
                                    style={{
                                      fontWeight: 700,
                                      fontSize: "1rem",
                                      color:
                                        t.score_breakdown.final_score >= 80
                                          ? "#dc2626"
                                          : t.score_breakdown.final_score >= 50
                                            ? "#d97706"
                                            : "#15803d",
                                    }}
                                  >
                                    {t.score_breakdown.final_score}
                                  </span>
                                </DetailRow>
                              )}
                            </div>
                            {t.score_breakdown.ml_score != null && (
                              <div
                                style={{ marginTop: 10, fontSize: ".78rem", color: "#6b7280" }}
                              >
                                <i className="bi bi-info-circle me-1" />
                                ML Anomaly Score{" "}
                                <code className="adm-code" style={{ color: "#7c3aed", borderColor: "#c4b5fd" }}>
                                  {typeof t.score_breakdown.ml_score === "number"
                                    ? t.score_breakdown.ml_score.toFixed(6)
                                    : t.score_breakdown.ml_score}
                                </code>
                                {" "}adalah nilai mentah model; tidak dijumlahkan langsung ke Final Score.
                              </div>
                            )}
                          </div>
                        )}

                      {/* ── Violation Reason ── */}
                      {violationList.length > 0 && (
                        <div
                          className="adm-message-block"
                          style={{ borderLeftColor: "#dc2626" }}
                        >
                          <span
                            className="adm-message-block__label"
                            style={{ color: "#dc2626" }}
                          >
                            <i className="bi bi-exclamation-triangle-fill" />{" "}
                            Violation Reasons
                          </span>
                          <ul
                            className="adm-violation-list"
                            style={{ marginTop: 4 }}
                          >
                            {violationList.map((item, idx) => (
                              <li key={idx} style={{ marginBottom: "2px" }}>
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  );
                })()}
            </>
          )}
        </div>

        {/* ── Section 6: Review Result ── */}
        {!loading && !error && review && (
          <div style={{ padding: "0 24px 16px" }}>
            <div
              className="adm-message-block"
              style={{
                borderLeftColor:
                  review.decision === "FRAUD" ? "#dc2626" : "#15803d",
              }}
            >
              <span
                className="adm-message-block__label"
                style={{
                  color: review.decision === "FRAUD" ? "#dc2626" : "#15803d",
                }}
              >
                <i
                  className={`bi ${review.decision === "FRAUD" ? "bi-x-circle-fill" : "bi-check-circle-fill"}`}
                />{" "}
                Review Result
              </span>

              <div className="adm-rows" style={{ marginTop: 8 }}>
                {/* Decision */}
                <DetailRow label="Decision">
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "3px 10px",
                      borderRadius: 12,
                      fontSize: ".78rem",
                      fontWeight: 700,
                      background:
                        review.decision === "FRAUD" ? "#fee2e2" : "#dcfce7",
                      color:
                        review.decision === "FRAUD" ? "#b91c1c" : "#15803d",
                    }}
                  >
                    <i
                      className={`bi ${review.decision === "FRAUD" ? "bi-x-circle-fill" : "bi-check-circle-fill"}`}
                    />
                    {review.decision}
                  </span>
                </DetailRow>

                {/* Confidence */}
                {review.decision_confidence && (
                  <DetailRow label="Confidence">
                    <span
                      style={{
                        fontWeight: 700,
                        color:
                          review.decision_confidence === "HIGH"
                            ? "#15803d"
                            : review.decision_confidence === "MEDIUM"
                              ? "#d97706"
                              : "#64748b",
                      }}
                    >
                      {review.decision_confidence}
                    </span>
                  </DetailRow>
                )}

                {/* Reviewer */}
                <DetailRow label="Reviewer">
                  <span className="adm-pill">
                    <i
                      className="bi bi-person-badge-fill"
                      style={{ color: "#7c3aed", marginRight: 4 }}
                    />
                    {review.reviewer_name ??
                      `Analyst #${review.reviewer_id ?? "?"}`}
                  </span>
                </DetailRow>

                {/* Waktu review */}
                {review.reviewed_at && (
                  <DetailRow
                    label="Reviewed At"
                    value={formatDate(review.reviewed_at)}
                  />
                )}

                {/* Durasi */}
                {review.duration_minutes != null && (
                  <DetailRow label="Duration">
                    <span style={{ fontWeight: 600, color: "#374151" }}>
                      <i
                        className="bi bi-stopwatch"
                        style={{ marginRight: 4, color: "#6366f1" }}
                      />
                      {review.duration_minutes} menit
                    </span>
                  </DetailRow>
                )}

                {/* Notes */}
                {review.review_note && (
                  <DetailRow label="Notes">
                    <span
                      style={{
                        fontSize: ".85rem",
                        color: "#374151",
                        fontStyle: "italic",
                      }}
                    >
                      "{review.review_note}"
                    </span>
                  </DetailRow>
                )}
              </div>

              {/* Override info */}
              {review.is_overridden && (
                <div
                  style={{
                    marginTop: 8,
                    padding: ".5rem .75rem",
                    background: "#fef3c7",
                    border: "1px solid #fde68a",
                    borderRadius: "6px",
                    fontSize: ".78rem",
                    color: "#92400e",
                  }}
                >
                  <i
                    className="bi bi-arrow-repeat"
                    style={{ marginRight: 6 }}
                  />
                  <strong>Overridden</strong> pada{" "}
                  {formatDate(review.overridden_at)}
                  {review.override_reason && ` — "${review.override_reason}"`}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Footer ── */}
        {!loading && !error && detail && (
          <div className="adm-footer">
            <button className="adm-btn adm-btn--ghost" onClick={onClose}>
              Tutup
            </button>

            <div className="adm-footer__actions">
              {/* Update Status — hanya RISK_MANAGER & SUPER_ADMIN */}
              {canManage && !isTransactionAlert && (
                <UpdateStatusDropdown
                  currentStatus={displayStatus}
                  alertId={detail.id}
                  onStatusUpdated={handleStatusUpdated}
                  disabled={!!pendingOp}
                />
              )}

              {canOverrideTransaction && (
                <button
                  className="adm-btn adm-btn--ghost"
                  onClick={openOverrideModal}
                  disabled={!!pendingOp}
                  title="Tutup kasus khusus dengan alasan audit"
                  style={{ borderColor: "#dc2626", color: "#b91c1c" }}
                >
                  <i className="bi bi-shield-fill-exclamation" /> Override
                </button>
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
                      <i className={`bi ${caseType.icon}`} />
                      {caseType.key === "BLOCKED" ? "Investigate" : "Review"}
                    </>
                  )}
                </button>
              )}

              {/* Alert transaksi hanya dapat resolve setelah Manual Review selesai. */}
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

      {isOverrideOpen && (
        <div
          className="adm-override-overlay"
          onClick={() => !isOverriding && setIsOverrideOpen(false)}
          role="presentation"
        >
          <form
            className="adm-override-modal"
            onSubmit={handleOverride}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="adm-override-title"
          >
            <div className="adm-override-modal__header">
              <span className="adm-override-modal__icon" aria-hidden="true">
                <i className="bi bi-shield-fill-exclamation" />
              </span>
              <div>
                <p className="adm-override-modal__eyebrow">Aksi sensitif</p>
                <h3 id="adm-override-title">Konfirmasi Override Alert</h3>
              </div>
            </div>

            <p className="adm-override-modal__description">
              Alert akan ditandai sebagai <strong>Overridden</strong>. Masukkan
              alasan untuk jejak audit.
            </p>

            <label className="adm-override-modal__label" htmlFor="override-reason">
              Alasan override <span aria-hidden="true">*</span>
            </label>
            <textarea
              ref={overrideReasonRef}
              id="override-reason"
              className={`adm-override-modal__textarea${overrideError ? " is-invalid" : ""}`}
              value={overrideReason}
              onChange={(e) => {
                setOverrideReason(e.target.value);
                if (overrideError) setOverrideError("");
              }}
              placeholder="Contoh: duplicate alert atau approved business exception."
              rows={4}
              disabled={isOverriding}
              aria-invalid={Boolean(overrideError)}
              aria-describedby={overrideError ? "override-reason-error" : undefined}
            />
            {overrideError && (
              <p id="override-reason-error" className="adm-override-modal__error" role="alert">
                <i className="bi bi-exclamation-circle-fill" /> {overrideError}
              </p>
            )}

            <div className="adm-override-modal__actions">
              <button
                type="button"
                className="adm-btn adm-btn--ghost"
                onClick={() => setIsOverrideOpen(false)}
                disabled={isOverriding}
              >
                Batal
              </button>
              <button type="submit" className="adm-btn adm-btn--override" disabled={isOverriding}>
                {isOverriding ? (
                  <><i className="bi bi-arrow-repeat adm-spin" /> Menyimpan…</>
                ) : (
                  <><i className="bi bi-shield-fill-exclamation" /> Konfirmasi Override</>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default AlertDetailModal;
