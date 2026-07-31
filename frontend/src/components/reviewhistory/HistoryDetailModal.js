import React, { useState, useRef, useCallback } from "react";
import "./HistoryDetailModal.css";

/**
 * HistoryDetailModal — Audit Trail View (read-only)
 */

// ─── Helpers ──────────────────────────────────────────────────────

const fmtTs = (ds) => {
  if (!ds) return "—";
  const date = new Date(ds);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

const fmtDate = (ds) => {
  if (!ds) return "—";
  const date = new Date(ds);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const fmtDuration = (startedAt, completedAt) => {
  if (!startedAt || !completedAt) return null;
  const start = new Date(startedAt).getTime();
  const end = new Date(completedAt).getTime();

  if (isNaN(start) || isNaN(end)) return null;

  const diffMs = end - start;
  if (diffMs < 0) return null;

  const s = Math.floor(diffMs / 1000);
  if (s < 60) return `${s}dtk`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}dtk`;
  return `${Math.floor(m / 60)}j ${m % 60}m`;
};

const fmtCurrency = (v) => {
  if (v == null || v === "" || isNaN(v)) return "—";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(v);
};

const fmtRiskScore = (v) => {
  if (v == null || v === "") return null;
  const n = parseFloat(v);
  if (isNaN(n)) return null;
  return (n <= 1.0 ? n * 100 : n).toFixed(1);
};

// ─── Static configs ───────────────────────────────────────────────

const DECISION_META = {
  SAFE: {
    icon: "bi-check-circle-fill",
    label: "SAFE",
    cls: "hdm-decision--safe",
  },
  FRAUD: {
    icon: "bi-x-circle-fill",
    label: "FRAUD",
    cls: "hdm-decision--fraud",
  },
};

const CONFIDENCE_META = {
  HIGH: { cls: "hdm-conf--high", label: "HIGH" },
  MEDIUM: { cls: "hdm-conf--medium", label: "MEDIUM" },
  LOW: { cls: "hdm-conf--low", label: "LOW" },
};

const STATUS_COLOR = {
  FRAUD: { bg: "#fee2e2", color: "#b91c1c" },
  SAFE: { bg: "#dcfce7", color: "#15803d" },
  UNDER_REVIEW: { bg: "#eff6ff", color: "#1d4ed8" },
  PENDING: { bg: "#f1f5f9", color: "#475569" },
  RESOLVED: { bg: "#f0fdf4", color: "#15803d" },
  OVERRIDDEN: { bg: "#fdf4ff", color: "#7e22ce" },
};

const RISK_META = {
  CRITICAL: { color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
  HIGH: { color: "#d97706", bg: "#fff7ed", border: "#fed7aa" },
  MEDIUM: { color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" },
  LOW: { color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
};

// ─── Atoms ────────────────────────────────────────────────────────

const StatusPill = ({ status }) => {
  if (!status || status === "NaN") return <span className="hdm-muted">—</span>;
  const s = STATUS_COLOR[String(status).toUpperCase()] || STATUS_COLOR.PENDING;
  return (
    <span
      className="hdm-status-pill"
      style={{ background: s.bg, color: s.color }}
    >
      {status}
    </span>
  );
};

const Field = ({ label, children, value }) => (
  <div className="hdm-field">
    <span className="hdm-field-label">{label}</span>
    <span className="hdm-field-value">
      {children ?? value ?? <span className="hdm-muted">—</span>}
    </span>
  </div>
);

const CopyButton = ({ text, label }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(
    async (e) => {
      e.stopPropagation();
      if (!text) return;
      try {
        await navigator.clipboard.writeText(String(text));
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      } catch {
        // Abaikan jika tidak disupport
      }
    },
    [text],
  );

  if (!text) return null;

  return (
    <button
      type="button"
      className={`hdm-copy-btn ${copied ? "hdm-copy-btn--done" : ""}`}
      onClick={handleCopy}
      aria-label={label ? `Copy ${label}` : "Copy"}
      title={copied ? "Tersalin!" : "Salin"}
    >
      <i className={`bi ${copied ? "bi-check-lg" : "bi-clipboard"}`} />
    </button>
  );
};

const Section = ({
  title,
  icon,
  accentColor,
  children,
  defaultOpen = true,
  variant,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      className={`hdm-section ${variant === "alert" ? "hdm-section--alert" : ""}`}
      style={{ "--hdm-accent": accentColor || "#475569" }}
    >
      <button
        className="hdm-section__toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="hdm-section__title">
          {icon && <i className={`bi ${icon}`} />}
          {title}
          {variant === "alert" && (
            <span className="hdm-section__badge">Perlu Perhatian</span>
          )}
        </span>
        <i
          className={`bi bi-chevron-${open ? "up" : "down"} hdm-section__chevron`}
        />
      </button>
      {open && <div className="hdm-section__body">{children}</div>}
    </div>
  );
};

const StatusFlow = ({ from, to }) => (
  <div className="hdm-status-flow">
    <StatusPill status={from} />
    <span className="hdm-status-flow__arrow">
      <i className="bi bi-arrow-right" />
    </span>
    <StatusPill status={to} />
  </div>
);

// ─── Snapshot Section ─────────────────────────────────────────────

const SnapshotSection = ({ snap }) => {
  if (!snap) return null;

  const isNusabill = snap.service_source === "NUSABILL";
  const isAgenusa = snap.service_source === "AGENUSA";
  const d = snap.transaction_details || {};
  const riskScore = fmtRiskScore(snap.risk_score);
  const riskKey = (snap.risk_level || "").toUpperCase();
  const riskMeta = RISK_META[riskKey] || {};
  const violations = (snap.violation_reason || "").split(" | ").filter(Boolean);

  return (
    <>
      <div className="hdm-snapshot-hero">
        <div className="hdm-snapshot-hero__amount">
          <div className="hdm-snapshot-hero__value">
            {fmtCurrency(snap.amount)}
          </div>
          <div className="hdm-snapshot-hero__label">Nilai Transaksi</div>
          {isNusabill && d.bill_amount != null && (
            <div className="hdm-snapshot-hero__sub">
              Tagihan: {fmtCurrency(d.bill_amount)}
              {d.biaya_admin > 0 && ` · Admin: ${fmtCurrency(d.biaya_admin)}`}
            </div>
          )}
        </div>
        {riskScore != null && (
          <div
            className="hdm-risk-badge"
            style={{
              background: riskMeta.bg,
              borderColor: riskMeta.border,
              color: riskMeta.color,
            }}
            title={`Risk score ${riskScore} dari 100 (${snap.risk_level})`}
          >
            <span className="hdm-risk-badge__num">{riskScore}</span>
            <span className="hdm-risk-badge__sub">
              /100 · {snap.risk_level}
            </span>
          </div>
        )}
      </div>

      <div className="hdm-grid-2">
        <Field label="Trx ID">
          <code className="hdm-code">{snap.original_trx_id}</code>{" "}
          <CopyButton text={snap.original_trx_id} label="Trx ID" />
        </Field>
        <Field label="Service" value={snap.service_source} />
        <Field label="User Account" value={snap.user_account_id} />
        <Field label="Account #" value={snap.account_number} />
        <Field label="Merchant ID" value={snap.merchant_id} />
        <Field label="Terminal ID" value={snap.terminal_id} />
        <Field label="IP Address" value={snap.ip_address} />
        <Field
          label="Lokasi"
          value={[snap.city, snap.country].filter(Boolean).join(", ") || "—"}
        />
        <Field label="Final Status">
          <StatusPill status={snap.final_status} />
        </Field>
        <Field label="ML Flagged">
          <span
            style={{
              fontWeight: 700,
              color: snap.is_flagged_ml ? "#dc2626" : "#15803d",
            }}
          >
            <i
              className={`bi ${snap.is_flagged_ml ? "bi-robot" : "bi-check-circle"} me-1`}
            />
            {snap.is_flagged_ml ? "Ya" : "Tidak"}
          </span>
        </Field>
      </div>

      {snap.score_breakdown && Object.keys(snap.score_breakdown).length > 0 && (
        <div className="hdm-score-grid">
          {[
            ["Rule", snap.score_breakdown.rule_score, "#16a34a"],
            ["Pattern", snap.score_breakdown.pattern_score, "#d97706"],
            ["ML", snap.score_breakdown.ml_score, "#7c3aed"],
            ["Final", snap.score_breakdown.final_score, "#dc2626"],
          ]
            .filter(([, v]) => v != null && !isNaN(v))
            .map(([lbl, val, color]) => (
              <div key={lbl} className="hdm-score-card">
                <div className="hdm-score-card__num" style={{ color }}>
                  {typeof val === "number" && val < 1 ? val.toFixed(4) : val}
                </div>
                <div className="hdm-score-card__lbl">{lbl}</div>
              </div>
            ))}
        </div>
      )}

      {violations.length > 0 && (
        <div className="hdm-violations">
          <div className="hdm-violations__label">
            <i className="bi bi-exclamation-triangle-fill" /> Fraud Indicators
          </div>
          <ul className="hdm-violation-list">
            {violations.map((v, i) => (
              <li key={i}>{v}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
};

// ─── Main Modal ───────────────────────────────────────────────────

const HistoryDetailModal = ({ item, onClose }) => {
  // ── Normalisasi Data (Menangani backend camelCase & snake_case) ──
  const cleanStr = (val) => (val === "NaN" ? null : val);

  const data = {
    id: item.reviewId ?? item.id,
    transactionId: item.transactionId ?? item.transaction_id,
    alertId: item.alertId ?? item.alert_id,
    decision: item.decision,
    confidence: item.decisionConfidence ?? item.confidence,
    previousStatus: cleanStr(item.previousStatus ?? item.previous_status),
    finalStatus: cleanStr(item.finalStatus ?? item.final_status),
    reviewStartedAt: item.reviewStartedAt ?? item.created_at,
    reviewCompletedAt:
      item.reviewCompletedAt ?? item.updated_at ?? item.completed_at,
    createdAt: item.createdAt ?? item.created_at,
    reviewerName: item.reviewerName ?? item.reviewer_name,
    reviewedBy: item.reviewedBy ?? item.reviewed_by,
    reviewNote: cleanStr(item.reviewNote ?? item.review_note),
    isOverridden: item.isOverridden ?? item.is_overridden,
    originalDecision: item.originalDecision ?? item.original_decision,
    overriddenBy: item.overriddenBy ?? item.overridden_by,
    overriddenAt: item.overriddenAt ?? item.overridden_at,
    overrideReason: cleanStr(item.overrideReason ?? item.override_reason),
    transactionSnapshot: item.transactionSnapshot ?? item.transaction_snapshot,
  };

  const meta = DECISION_META[data.decision] || DECISION_META.SAFE;
  const confidenceMeta = CONFIDENCE_META[(data.confidence || "").toUpperCase()];
  const duration = fmtDuration(data.reviewStartedAt, data.reviewCompletedAt);
  const hasOverride = data.isOverridden;
  const hasSnapshot = !!data.transactionSnapshot;

  const boxRef = useRef(null);
  const closeBtnRef = useRef(null);

  React.useEffect(() => {
    closeBtnRef.current?.focus();
    const h = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div
      className="hmodal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
    >
      <div className="hmodal-box" ref={boxRef}>
        {/* ── Header ── */}
        <div className="hmodal-header">
          <div className="hmodal-header-left">
            <div
              className={`hdm-decision-icon ${data.decision === "FRAUD" ? "hdm-decision-icon--fraud" : "hdm-decision-icon--safe"}`}
            >
              <i className={`bi ${meta.icon}`} />
            </div>
            <div>
              <div className="hmodal-entry-label">Review #{data.id}</div>
              <div className="hmodal-txn-id">
                <span>Trx #{data.transactionId}</span>
                <CopyButton text={data.transactionId} label="Transaction ID" />
              </div>
              <div className="hdm-header-chips">
                {data.alertId && (
                  <span className="hdm-chip hdm-chip--alert">
                    <i className="bi bi-bell-fill" /> Alert #{data.alertId}
                  </span>
                )}
                {hasOverride && (
                  <span className="hdm-chip hdm-chip--overridden">
                    <i className="bi bi-shield-fill-exclamation" /> Overridden
                  </span>
                )}
              </div>
            </div>
          </div>
          <button className="hmodal-close" onClick={onClose} ref={closeBtnRef}>
            <i className="bi bi-x-lg" />
          </button>
        </div>

        {/* ── Decision Banner ── */}
        <div
          className={`hdm-decision-banner ${data.decision === "FRAUD" ? "hdm-decision-banner--fraud" : "hdm-decision-banner--safe"}`}
        >
          <i className={`bi ${meta.icon} hdm-decision-banner__icon`} />
          <div className="hdm-decision-banner__body">
            <span className="hdm-decision-banner__label">
              Keputusan: {meta.label}
            </span>
            <div className="hdm-decision-banner__chips">
              {confidenceMeta && (
                <span className={`hdm-conf ${confidenceMeta.cls}`}>
                  {confidenceMeta.label} Confidence
                </span>
              )}
              <span className="hdm-duration">
                <i className="bi bi-stopwatch" />
                {duration ?? "—"}
              </span>
            </div>
          </div>
          <div className="hdm-decision-banner__ts">
            {fmtDate(data.createdAt)}
          </div>
        </div>

        {/* ── Body ── */}
        <div className="hmodal-body">
          <Section
            title="Info Review"
            icon="bi-clipboard2-check-fill"
            accentColor="#2563eb"
          >
            <div className="hdm-grid-2">
              <Field label="Review ID">
                <code className="hdm-code">#{data.id}</code>
              </Field>
              <Field label="Alert ID">
                {data.alertId ? (
                  <code className="hdm-code">#{data.alertId}</code>
                ) : (
                  <span className="hdm-muted">—</span>
                )}
              </Field>
              <div className="hdm-field" style={{ gridColumn: "1 / -1" }}>
                <span className="hdm-field-label">Perubahan Status</span>
                <span className="hdm-field-value">
                  <StatusFlow
                    from={data.previousStatus}
                    to={data.finalStatus}
                  />
                </span>
              </div>
              <Field label="Mulai Review" value={fmtTs(data.reviewStartedAt)} />
              <Field label="Selesai" value={fmtTs(data.reviewCompletedAt)} />
            </div>
          </Section>

          <Section
            title="Reviewer"
            icon="bi-person-badge-fill"
            accentColor="#7c3aed"
          >
            <div className="hdm-reviewer-row">
              <div className="hdm-avatar">
                {data.reviewerName ? (
                  data.reviewerName
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()
                ) : (
                  <i className="bi bi-person-fill" />
                )}
              </div>
              <div>
                <div className="hdm-reviewer-name">
                  {data.reviewerName || `Analyst #${data.reviewedBy || "—"}`}
                </div>
                <div className="hdm-reviewer-meta">
                  {data.reviewedBy && `ID #${data.reviewedBy}`}
                  {duration && (
                    <span className="hdm-duration-badge">
                      <i className="bi bi-stopwatch" /> {duration}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Section>

          {data.reviewNote && (
            <div className="hmodal-notes">
              <div className="hmodal-notes-label">
                <i className="bi bi-chat-left-text-fill" /> Catatan Review
              </div>
              <p className="hmodal-notes-text">{data.reviewNote}</p>
            </div>
          )}

          {hasOverride && (
            <Section
              title="Override Info"
              icon="bi-shield-fill-exclamation"
              accentColor="#dc2626"
              variant="alert"
            >
              <div className="hdm-grid-2">
                <Field label="Keputusan Awal" value={data.originalDecision || "â€”"} />
                <Field label="Keputusan Setelah Override" value={data.decision || "â€”"} />
                <Field
                  label="Override oleh"
                  value={`User #${data.overriddenBy || "—"}`}
                />
                <Field
                  label="Waktu Override"
                  value={fmtTs(data.overriddenAt)}
                />
                {data.overrideReason && (
                  <div className="hdm-override-reason">
                    <div className="hdm-override-reason__label">
                      Alasan Override
                    </div>
                    <p className="hdm-override-reason__text">
                      {data.overrideReason}
                    </p>
                  </div>
                )}
              </div>
            </Section>
          )}

          {hasSnapshot ? (
            <Section
              title="Snapshot Transaksi"
              icon="bi-database-lock"
              accentColor="#0369a1"
              defaultOpen={false}
            >
              <SnapshotSection snap={data.transactionSnapshot} />
            </Section>
          ) : (
            <div className="hdm-no-snapshot">
              <i className="bi bi-info-circle" />
              Snapshot transaksi tidak tersedia.
            </div>
          )}
        </div>

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
