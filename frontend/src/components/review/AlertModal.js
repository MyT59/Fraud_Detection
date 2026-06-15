import React, { useState, useEffect, useRef } from "react";
import { SeverityBadge, ServiceBadge } from "./ReviewBadges";
import { fmtDate } from "./reviewHelpers";
import "./AlertModal.css";
import { fetchAlertDetail } from "../../services/AlertsService";

/**
 * AlertModal.js — Investigation & Decision Modal
 * FRAUD_ANALYST menggunakan modal ini untuk menginvestigasi dan
 * memutuskan SAFE/FRAUD pada alert yang sudah diklaim.
 *
 * Layout: Split — kiri info investigasi (scroll), kanan decision panel (sticky)
 */

// ─── Constants ────────────────────────────────────────────────────

const PROCESSING_CODE_MAP = {
  0: "Balance Inquiry",
  10000: "Transfer",
  200000: "Payment",
  400000: "Withdrawal",
  900000: "Reversal",
};

const RISK_LEVEL_META = {
  CRITICAL: { color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
  HIGH: { color: "#d97706", bg: "#fff7ed", border: "#fed7aa" },
  MEDIUM: { color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" },
  LOW: { color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
};

const PRIORITY_META = {
  CRITICAL: { color: "#dc2626", icon: "bi-fire" },
  HIGH: { color: "#d97706", icon: "bi-arrow-up-circle-fill" },
  MEDIUM: { color: "#2563eb", icon: "bi-dash-circle-fill" },
  LOW: { color: "#16a34a", icon: "bi-arrow-down-circle-fill" },
};

// ─── Helpers ──────────────────────────────────────────────────────

const fmt = (v) =>
  v != null
    ? new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
      }).format(v)
    : "—";

const fmtDT = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const calcDuration = (claimedAt) => {
  if (!claimedAt) return null;
  const diff = Math.floor((Date.now() - new Date(claimedAt).getTime()) / 1000);
  if (diff < 60) return `${diff}d`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400)
    return `${Math.floor(diff / 3600)}j ${Math.floor((diff % 3600) / 60)}m`;
  return `${Math.floor(diff / 86400)} hari`;
};

const procLabel = (code) => {
  if (code == null) return "—";
  const lbl = PROCESSING_CODE_MAP[Number(code)];
  return lbl ? `${code} — ${lbl}` : String(code);
};

// Isolation Forest: semakin negatif = semakin anomali
const getRiskFromMLScore = (mlScore) => {
  if (mlScore == null) return null;
  if (mlScore <= -0.1) return "CRITICAL";
  if (mlScore <= -0.05) return "HIGH";
  if (mlScore <= 0.0) return "MEDIUM";
  return "LOW";
};

// ─── Sub-components ───────────────────────────────────────────────

const FieldRow = ({ label, value, children, mono = false }) => (
  <div className="am-field-row">
    <span className="am-field-label">{label}</span>
    <span className={`am-field-value${mono ? " am-mono" : ""}`}>
      {children ?? value ?? "—"}
    </span>
  </div>
);

const InfoCard = ({ icon, title, accentColor = "#2563eb", children }) => (
  <div className="am-card" style={{ "--card-accent": accentColor }}>
    <div className="am-card__title">
      <i className={`bi ${icon}`} />
      {title}
    </div>
    <div className="am-card__body">{children}</div>
  </div>
);

const Skeleton = () => (
  <div className="am-skeleton">
    {[75, 55, 65, 45, 70].map((w, i) => (
      <div key={i} className="am-skeleton__row">
        <div className="am-skeleton__bar" style={{ width: `${w}%` }} />
      </div>
    ))}
  </div>
);

// ─── Decision Panel ───────────────────────────────────────────────

const DecisionPanel = ({
  decision,
  setDecision,
  confidence,
  setConfidence,
  notes,
  setNotes,
  confirming,
  setConfirming,
  submitting,
  error,
  onConfirm,
}) => {
  const isDecided = !!decision && confirming;
  const isSafe = decision === "SAFE";
  const dc = isSafe ? "#15803d" : "#dc2626";

  return (
    <div className="am-decision-panel">
      <div className="am-decision-panel__title">
        <i className="bi bi-shield-check" />
        Keputusan Review
      </div>

      {/* Info hint */}
      <div className="am-hint am-hint--info">
        <i className="bi bi-info-circle-fill" />
        Alert sudah diklaim. Submit keputusan untuk menyelesaikan.
      </div>

      {!isDecided ? (
        /* Step 1: pilih keputusan */
        <div className="am-decision-btns">
          <button
            className="am-decide-btn am-decide-btn--safe"
            onClick={() => {
              setDecision("SAFE");
              setConfirming(true);
            }}
          >
            <i className="bi bi-check-circle-fill" />
            <span>SAFE</span>
            <small>Transaksi aman</small>
          </button>
          <button
            className="am-decide-btn am-decide-btn--fraud"
            onClick={() => {
              setDecision("FRAUD");
              setConfirming(true);
            }}
          >
            <i className="bi bi-x-circle-fill" />
            <span>FRAUD</span>
            <small>Laporkan penipuan</small>
          </button>
        </div>
      ) : (
        /* Step 2: konfirmasi + confidence + notes */
        <div className="am-confirm-wrap">
          {/* Decision banner */}
          <div
            className="am-confirm-banner"
            style={{
              background: isSafe ? "#f0fdf4" : "#fef2f2",
              border: `1px solid ${isSafe ? "#bbf7d0" : "#fecaca"}`,
              color: dc,
            }}
          >
            <i
              className={`bi ${isSafe ? "bi-check-circle-fill" : "bi-x-circle-fill"}`}
            />
            Konfirmasi: Transaksi {isSafe ? "AMAN (SAFE)" : "PENIPUAN (FRAUD)"}
          </div>

          {/* Confidence picker */}
          <div className="am-conf-section">
            <label className="am-conf-label">
              Tingkat Keyakinan <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <div className="am-conf-btns">
              {[
                {
                  val: "HIGH",
                  label: "HIGH",
                  color: "#15803d",
                  bg: "#f0fdf4",
                  border: "#86efac",
                },
                {
                  val: "MEDIUM",
                  label: "MEDIUM",
                  color: "#92400e",
                  bg: "#fffbeb",
                  border: "#fde68a",
                },
                {
                  val: "LOW",
                  label: "LOW",
                  color: "#374151",
                  bg: "#f8fafc",
                  border: "#e2e8f0",
                },
              ].map((c) => (
                <button
                  key={c.val}
                  onClick={() => setConfidence(c.val)}
                  className={`am-conf-btn${confidence === c.val ? " active" : ""}`}
                  style={
                    confidence === c.val
                      ? {
                          background: c.bg,
                          border: `2px solid ${c.border}`,
                          color: c.color,
                        }
                      : {}
                  }
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="am-notes-wrap">
            <label className="am-notes-label">
              Catatan <span className="am-optional">(opsional)</span>
            </label>
            <textarea
              className="am-notes-input"
              rows={3}
              maxLength={500}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Tambahkan catatan investigasi..."
            />
            <div className="am-notes-count">{notes.length}/500</div>
          </div>

          {/* Error */}
          {error && (
            <div className="am-error">
              <i className="bi bi-exclamation-circle-fill" /> {error}
            </div>
          )}

          {/* Actions */}
          <div className="am-confirm-row">
            <button
              className="am-btn am-btn--cancel"
              onClick={() => {
                setDecision("");
                setConfidence("");
                setConfirming(false);
              }}
              disabled={submitting}
            >
              Batal
            </button>
            <button
              className={`am-btn ${isSafe ? "am-btn--safe" : "am-btn--fraud"}`}
              onClick={onConfirm}
              disabled={submitting || !confidence}
            >
              {submitting ? (
                <>
                  <i className="bi bi-arrow-repeat am-spin" /> Menyimpan…
                </>
              ) : (
                `Konfirmasi ${decision}`
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────

const AlertModal = ({ alert, onClose, onReview }) => {
  const [decision, setDecision] = useState("");
  const [confidence, setConfidence] = useState("");
  const [notes, setNotes] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [detailError, setDetailError] = useState(false);

  // ESC to close
  useEffect(() => {
    const h = (e) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose, submitting]);

  // Fetch detail
  useEffect(() => {
    const load = async () => {
      try {
        setDetailLoading(true);
        const data = await fetchAlertDetail(alert.alertId);
        setDetail(data?.data ?? data ?? null);
      } catch (err) {
        console.error("[AlertModal] Fetch detail gagal:", err.message);
        setDetailError(true);
      } finally {
        setDetailLoading(false);
      }
    };
    load();
  }, [alert.alertId]);

  const handleConfirm = async () => {
    if (!confidence) {
      setError("Pilih tingkat keyakinan sebelum submit.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onReview(alert, decision, confidence, notes);
    } catch (err) {
      const msg = err.message || "Terjadi kesalahan.";
      if (msg.includes("analis lain") || msg.includes("tidak ditemukan")) {
        setSubmitting(false);
        return;
      }
      setError(msg);
      setSubmitting(false);
    }
  };

  // Derived data
  const trx = detail?.transaction ?? null;
  const td = trx?.transaction_details ?? {};
  const mlScore = detail?.ml_score;
  const isAnomaly = detail?.is_anomaly;
  const mlPatterns = detail?.ml_patterns ?? [];
  const isAgenusa =
    (detail?.service ?? alert.service ?? "").toUpperCase() === "AGENUSA";
  const isNusabill =
    (detail?.service ?? alert.service ?? "").toUpperCase() === "NUSABILL";
  const duration = calcDuration(detail?.claimed_at);

  const riskKey = getRiskFromMLScore(mlScore) || trx?.risk_level?.toUpperCase();
  const riskMeta = RISK_LEVEL_META[riskKey] || RISK_LEVEL_META.LOW;
  const prioKey = (alert.priorityLabel || "LOW").toUpperCase();
  const prioMeta = PRIORITY_META[prioKey] || PRIORITY_META.LOW;

  const violations = (trx?.violation_reason || "").split(" | ").filter(Boolean);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="txn-modal am-modal" onClick={(e) => e.stopPropagation()}>
        {/* ── Header ── */}
        <div className="modal-header">
          <div className="modal-header-left">
            {/* Severity dot */}
            <div
              className="am-severity-dot"
              style={{ background: riskMeta.color }}
            />
            <div>
              <div className="modal-txn-id">
                <i
                  className="bi bi-bell-fill"
                  style={{ marginRight: 6, color: riskMeta.color }}
                />
                Alert #{alert.alertId}
                {alert.alertType && (
                  <span className="am-type-chip">{alert.alertType}</span>
                )}
              </div>
              <div className="am-header-meta">
                {alert.service && <ServiceBadge service={alert.service} />}
                {alert.severity && <SeverityBadge severity={alert.severity} />}
                <span
                  className="am-priority-chip"
                  style={{ color: prioMeta.color }}
                >
                  <i className={`bi ${prioMeta.icon}`} /> {alert.priorityLabel}
                </span>
                {duration && (
                  <span className="am-duration-chip">
                    <i className="bi bi-stopwatch" /> {duration}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <i className="bi bi-x-lg" />
          </button>
        </div>

        {/* ── Body: split layout ── */}
        <div className="am-body">
          {/* ── Left: investigation data (scrollable) ── */}
          <div className="am-left">
            {detailLoading ? (
              <Skeleton />
            ) : detailError ? (
              <div className="am-fetch-error">
                <i className="bi bi-wifi-off" />
                <p>Gagal memuat detail alert.</p>
              </div>
            ) : (
              <>
                {/* 1 — ML / Risk Assessment */}
                {mlScore != null && (
                  <InfoCard
                    icon="bi-cpu-fill"
                    title="ML Risk Assessment"
                    accentColor="#7c3aed"
                  >
                    <div className="am-risk-row">
                      <div
                        className="am-risk-circle"
                        style={{
                          borderColor: riskMeta.color,
                          background: riskMeta.bg,
                        }}
                      >
                        <span
                          className="am-risk-circle__score"
                          style={{ color: riskMeta.color }}
                        >
                          {mlScore.toFixed(4)}
                        </span>
                        <span className="am-risk-circle__sub">IF Score</span>
                      </div>
                      <div className="am-risk-info">
                        <div
                          className="am-risk-level-tag"
                          style={{
                            background: riskMeta.bg,
                            color: riskMeta.color,
                            borderColor: riskMeta.border,
                          }}
                        >
                          <i
                            className={`bi ${isAnomaly ? "bi-exclamation-triangle-fill" : "bi-check-circle-fill"}`}
                          />
                          {riskKey}{" "}
                          {isAnomaly ? "— Anomaly Detected" : "— Normal"}
                        </div>
                        {trx?.anomaly_score != null && (
                          <div
                            style={{
                              fontSize: ".75rem",
                              color: "#6b7280",
                              marginTop: 4,
                            }}
                          >
                            Anomaly Score:{" "}
                            <code className="am-inline-code">
                              {trx.anomaly_score.toFixed(6)}
                            </code>
                          </div>
                        )}
                        {mlPatterns.length > 0 && (
                          <div className="am-pattern-tags">
                            {mlPatterns.map((p, i) => (
                              <span key={i} className="am-tag am-tag--pattern">
                                {p}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </InfoCard>
                )}

                {/* 2 — Score Breakdown */}
                {trx?.score_breakdown &&
                  Object.keys(trx.score_breakdown).length > 0 && (
                    <InfoCard
                      icon="bi-bar-chart-fill"
                      title="Score Breakdown"
                      accentColor="#6366f1"
                    >
                      <div className="am-score-grid">
                        {[
                          ["Rule", trx.score_breakdown.rule_score, "#16a34a"],
                          [
                            "Pattern",
                            trx.score_breakdown.pattern_score,
                            "#d97706",
                          ],
                          ["ML", trx.score_breakdown.ml_score, "#7c3aed"],
                          ["Final", trx.score_breakdown.final_score, "#dc2626"],
                        ]
                          .filter(([, v]) => v != null)
                          .map(([lbl, val, color]) => (
                            <div key={lbl} className="am-score-card">
                              <div
                                className="am-score-card__num"
                                style={{ color }}
                              >
                                {typeof val === "number" && val < 1
                                  ? val.toFixed(4)
                                  : val}
                              </div>
                              <div className="am-score-card__lbl">{lbl}</div>
                            </div>
                          ))}
                      </div>
                    </InfoCard>
                  )}

                {/* 3 — Data Transaksi */}
                {trx && (
                  <InfoCard icon="bi-receipt" title="Data Transaksi">
                    {/* Amount hero */}
                    <div className="am-amount-hero">
                      <div>
                        <div className="am-amount-hero__value">
                          {fmt(trx.amount)}
                        </div>
                        <div className="am-amount-hero__label">
                          Nilai Transaksi
                        </div>
                      </div>
                      {trx.risk_level && (
                        <div
                          className="am-risk-tag"
                          style={{
                            color: riskMeta.color,
                            background: riskMeta.bg,
                            borderColor: riskMeta.border,
                          }}
                        >
                          {trx.risk_level} · {Math.round(trx.risk_score ?? 0)}
                          /100
                        </div>
                      )}
                    </div>

                    {/* Nusabill amounts */}
                    {isNusabill && td.bill_amount != null && (
                      <div className="am-amount-row">
                        <div className="am-amount-cell">
                          <span className="am-amount-cell__lbl">Bill</span>
                          <span className="am-amount-cell__val">
                            {fmt(td.bill_amount)}
                          </span>
                        </div>
                        <i
                          className="bi bi-arrow-right"
                          style={{ color: "#d1d5db" }}
                        />
                        <div className="am-amount-cell">
                          <span className="am-amount-cell__lbl">Payment</span>
                          <span
                            className="am-amount-cell__val"
                            style={{
                              color:
                                td.payment_amount > td.bill_amount
                                  ? "#dc2626"
                                  : td.payment_amount < td.bill_amount
                                    ? "#d97706"
                                    : "#15803d",
                            }}
                          >
                            {fmt(td.payment_amount)}
                          </span>
                        </div>
                        {td.biaya_admin > 0 && (
                          <>
                            <i
                              className="bi bi-plus"
                              style={{ color: "#d1d5db" }}
                            />
                            <div className="am-amount-cell">
                              <span className="am-amount-cell__lbl">Admin</span>
                              <span className="am-amount-cell__val">
                                {fmt(td.biaya_admin)}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* Core fields */}
                    <div className="am-fields">
                      <FieldRow label="Trx ID">
                        <code className="am-inline-code">
                          {trx.original_trx_id}
                        </code>
                      </FieldRow>
                      <FieldRow
                        label="User Account"
                        value={trx.user_account_id}
                        mono
                      />
                      <FieldRow
                        label="Account #"
                        value={trx.account_number}
                        mono
                      />
                      <FieldRow
                        label="Merchant ID"
                        value={trx.merchant_id}
                        mono
                      />
                      <FieldRow
                        label="Terminal ID"
                        value={trx.terminal_id}
                        mono
                      />
                      <FieldRow
                        label="IP Address"
                        value={trx.ip_address}
                        mono
                      />
                      <FieldRow
                        label="Waktu"
                        value={fmtDT(trx.transaction_time)}
                      />
                      <FieldRow
                        label="Lokasi"
                        value={
                          [trx.city, trx.country].filter(Boolean).join(", ") ||
                          "—"
                        }
                      />
                      <FieldRow label="ML Flagged">
                        <span
                          style={{
                            fontWeight: 700,
                            color: trx.is_flagged_ml ? "#dc2626" : "#15803d",
                          }}
                        >
                          <i
                            className={`bi ${trx.is_flagged_ml ? "bi-robot" : "bi-check-circle"} me-1`}
                          />
                          {trx.is_flagged_ml ? "Ya" : "Tidak"}
                        </span>
                      </FieldRow>
                    </div>

                    {/* AGENUSA specific */}
                    {isAgenusa && (
                      <div className="am-sub-section">
                        <div className="am-sub-label">
                          <i className="bi bi-send me-1" />
                          ISO 8583
                        </div>
                        <div className="am-fields">
                          <FieldRow
                            label="Dest Account"
                            value={td.dest_account_number}
                            mono
                          />
                          <FieldRow
                            label="Issuer Bank"
                            value={td.issuer_bank}
                          />
                          <FieldRow
                            label="Dest Bank"
                            value={td.dest_bank_code}
                            mono
                          />
                          <FieldRow
                            label="Processing"
                            value={procLabel(td.processing_code)}
                          />
                          <FieldRow label="Response">
                            {td.response_code != null ? (
                              <code
                                className="am-inline-code"
                                style={{
                                  color:
                                    String(td.response_code) === "0" ||
                                    String(td.response_code) === "00"
                                      ? "#15803d"
                                      : "#dc2626",
                                }}
                              >
                                {td.response_code}
                              </code>
                            ) : (
                              "—"
                            )}
                          </FieldRow>
                          <FieldRow label="MTI" value={td.mti} mono />
                          <FieldRow label="STAN" value={td.stan} mono />
                        </div>
                      </div>
                    )}

                    {/* NUSABILL specific */}
                    {isNusabill && (
                      <div className="am-sub-section">
                        <div className="am-sub-label">
                          <i className="bi bi-file-earmark-text me-1" />
                          Tagihan
                        </div>
                        <div className="am-fields">
                          <FieldRow label="Customer" value={td.nama_customer} />
                          <FieldRow label="Channel" value={td.channel} />
                          <FieldRow label="SOF" value={td.sof} mono />
                          <FieldRow label="Status" value={td.status_tagihan} />
                        </div>
                      </div>
                    )}
                  </InfoCard>
                )}

                {/* 4 — Fraud Indicators */}
                {(violations.length > 0 ||
                  trx?.violation_rule_ids?.length > 0 ||
                  trx?.violation_pattern_ids?.length > 0) && (
                  <InfoCard
                    icon="bi-exclamation-triangle-fill"
                    title="Fraud Indicators"
                    accentColor="#dc2626"
                  >
                    {violations.length > 0 && (
                      <ul className="am-violation-list">
                        {violations.map((v, i) => (
                          <li key={i}>
                            <i className="bi bi-dot" />
                            {v}
                          </li>
                        ))}
                      </ul>
                    )}
                    {(trx?.violation_rule_ids?.length > 0 ||
                      trx?.violation_pattern_ids?.length > 0) && (
                      <div className="am-tag-row">
                        {(trx.violation_rule_ids || []).map((id) => (
                          <span key={`r-${id}`} className="am-tag am-tag--rule">
                            Rule #{id}
                          </span>
                        ))}
                        {(trx.violation_pattern_ids || []).map((id) => (
                          <span
                            key={`p-${id}`}
                            className="am-tag am-tag--pattern-id"
                          >
                            Pattern #{id}
                          </span>
                        ))}
                      </div>
                    )}
                  </InfoCard>
                )}
              </>
            )}
          </div>

          {/* ── Right: decision panel (sticky) ── */}
          <div className="am-right">
            <DecisionPanel
              decision={decision}
              setDecision={setDecision}
              confidence={confidence}
              setConfidence={setConfidence}
              notes={notes}
              setNotes={setNotes}
              confirming={confirming}
              setConfirming={setConfirming}
              submitting={submitting}
              error={error}
              onConfirm={handleConfirm}
            />
          </div>
        </div>
      </div>
      <style>{`@keyframes am-shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }`}</style>
    </div>
  );
};

export default AlertModal;
