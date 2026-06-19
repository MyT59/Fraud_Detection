import React, { useState, useEffect } from "react";
import "./TransactionDetailModal.css";
import transactionService from "../../services/transactionService";

// ─── Maps ─────────────────────────────────────────────────────────────────────

const STATUS_MAP = {
  PENDING: { icon: "bi-hourglass-split", label: "Pending", cls: "warning" },
  UNDER_REVIEW: { icon: "bi-search", label: "Under Review", cls: "warning" },
  SAFE: { icon: "bi-check-circle-fill", label: "Safe", cls: "success" },
  FRAUD: { icon: "bi-exclamation-circle-fill", label: "Fraud", cls: "danger" },
};

const RISK_LEVEL_MAP = {
  LOW: { label: "Low", cls: "success" },
  MEDIUM: { label: "Medium", cls: "warning" },
  HIGH: { label: "High", cls: "danger" },
  CRITICAL: { label: "Critical", cls: "danger" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (amount) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);

const fmtDT = (ds) => {
  if (!ds) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(ds));
};

const fmtDate = (ds) => {
  if (!ds) return "—";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(
    new Date(ds),
  );
};

// ─── Small reusable pieces ────────────────────────────────────────────────────

const Badge = ({ cls, icon, label }) => (
  <span className={`tdm-badge tdm-badge-${cls}`}>
    {icon && <i className={`bi ${icon} me-1`} />}
    {label}
  </span>
);

/** A single labelled field */
const Field = ({ label, value, mono = false, span2 = false }) => (
  <div className={`tdm-field${span2 ? " tdm-field-span2" : ""}`}>
    <span className="tdm-field-label">{label}</span>
    <span className={`tdm-field-value${mono ? " tdm-mono" : ""}`}>
      {value ?? "—"}
    </span>
  </div>
);

/** Collapsible card section */
const Section = ({
  title,
  icon,
  children,
  danger = false,
  defaultOpen = true,
  badge,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`tdm-section${danger ? " tdm-section-danger" : ""}`}>
      <button
        className="tdm-section-header"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="tdm-section-title">
          {icon && <i className={`bi ${icon} me-2`} />}
          {title}
          {badge && <span className="tdm-section-badge">{badge}</span>}
        </span>
        <i className={`bi bi-chevron-${open ? "up" : "down"} tdm-chevron`} />
      </button>
      {open && <div className="tdm-section-body">{children}</div>}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const TransactionDetailModal = ({ transaction, isOpen, onClose }) => {
  const [detailData, setDetailData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && transaction?.id) {
      setLoading(true);
      transactionService
        .getTransactionById(transaction.id)
        .then(setDetailData)
        .catch(() => setDetailData(transaction))
        .finally(() => setLoading(false));
    } else {
      setDetailData(null);
    }
  }, [isOpen, transaction]);

  // ESC to close
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen || !transaction) return null;

  const t = detailData || transaction;
  const riskScore = Math.round(t.risk_score || 0);
  const riskLevel = RISK_LEVEL_MAP[t.risk_level] || RISK_LEVEL_MAP.LOW;
  const statusMeta = STATUS_MAP[t.final_status] || STATUS_MAP.PENDING;
  const isFraud = t.final_status === "FRAUD";
  const d = t.transaction_details || {};

  // Count only active rule / pattern violations. Do not treat a free-text
  // `violation_reason` as a separate count (it may duplicate info).
  const activeRuleCount = (t.violation_rule_ids || []).length;
  const activePatternCount = (t.violation_pattern_ids || []).length;
  const violationCount = activeRuleCount + activePatternCount;

  // Support suppressed signals returned by the backend for forensic review.
  // Backend may provide either `suppressed_patterns` (objects) or
  // `suppressed_pattern_ids` (ids). Normalize to an array of items.
  const suppressedPatternsRaw =
    t.suppressed_patterns || t.suppressed_pattern_ids || [];
  const suppressedPatterns = Array.isArray(suppressedPatternsRaw)
    ? suppressedPatternsRaw
    : [];

  return (
    <>
      <div className="txn-detail-overlay" onClick={onClose} />

      <div className="txn-detail-modal" role="dialog" aria-modal="true">
        <div className="txn-detail-dialog">
          <div className="txn-modal-content">
            {/* ── Header ───────────────────────────────────────────────── */}
            <div className="txn-modal-header">
              <div className="tdm-header-left">
                <div className={`tdm-status-dot tdm-dot-${statusMeta.cls}`} />
                <div>
                  <h5 className="txn-modal-title">
                    <i className="bi bi-receipt me-2" />
                    Detail Transaksi
                  </h5>
                  <div className="tdm-header-meta">
                    <span className="tdm-mono">{t.original_trx_id}</span>
                    <span className="tdm-sep">·</span>
                    <Badge
                      cls={statusMeta.cls}
                      icon={statusMeta.icon}
                      label={statusMeta.label}
                    />
                    <span className="tdm-sep">·</span>
                    <span
                      className={`tdm-source-pill tdm-source-${t.service_source?.toLowerCase()}`}
                    >
                      {t.service_source}
                    </span>
                  </div>
                </div>
              </div>
              <button
                className="txn-btn-close"
                onClick={onClose}
                aria-label="Tutup"
              >
                <i className="bi bi-x-lg" />
              </button>
            </div>

            {/* ── Body ─────────────────────────────────────────────────── */}
            <div className="txn-modal-body">
              {loading ? (
                <div className="tdm-loading">
                  <div className="spinner-border text-danger" role="status" />
                  <p className="tdm-loading-text">
                    Mengambil data dari server…
                  </p>
                </div>
              ) : (
                <>
                  {/* 1 ── Risk Banner ─────────────────────────────────── */}
                  <div className={`tdm-risk-banner tdm-risk-${riskLevel.cls}`}>
                    <i className="bi bi-shield-exclamation tdm-risk-icon" />
                    <div className="tdm-risk-info">
                      <div className="tdm-risk-top">
                        <span className="tdm-risk-title">
                          Risk Level: <strong>{riskLevel.label}</strong>
                        </span>
                        {t.is_flagged_ml && (
                          <Badge
                            cls="danger"
                            icon="bi-robot"
                            label="ML Flagged"
                          />
                        )}
                      </div>
                      <div className="tdm-progress-wrap">
                        <div className="tdm-progress">
                          <div
                            className={`tdm-progress-bar tdm-progress-${riskLevel.cls}`}
                            style={{ width: `${riskScore}%` }}
                          />
                        </div>
                        <span className="tdm-progress-label">
                          {riskScore}/100
                        </span>
                      </div>
                      <div className="tdm-risk-sub-row">
                        {t.anomaly_score != null && (
                          <span className="tdm-risk-chip">
                            <i className="bi bi-activity me-1" />
                            Anomaly: {t.anomaly_score.toFixed(4)}
                          </span>
                        )}
                        <span className="tdm-risk-chip">
                          <i className="bi bi-clock me-1" />
                          {fmtDT(t.transaction_time)}
                        </span>
                      </div>
                    </div>
                    <div className="tdm-amount-block">
                      <div className="tdm-amount-value">{fmt(t.amount)}</div>
                      <div className="tdm-amount-label">Nilai Transaksi</div>
                    </div>
                  </div>

                  {/* 2 ── Identitas & Akun ────────────────────────────── */}
                  <Section title="Identitas & Akun" icon="bi-person-badge">
                    <div className="tdm-grid-2">
                      <div className="tdm-field">
                        <span className="tdm-field-label">User Account ID</span>
                        <div className="tdm-user-row">
                          <div className="tdm-avatar">
                            {(t.user_account_id || "?").charAt(0).toUpperCase()}
                          </div>
                          <span className="tdm-field-value tdm-mono">
                            {t.user_account_id || "—"}
                          </span>
                        </div>
                      </div>
                      <Field
                        label="Account Number"
                        value={t.account_number}
                        mono
                      />
                      <Field label="Merchant ID" value={t.merchant_id} mono />
                      <Field label="Terminal ID" value={t.terminal_id} mono />
                      <Field label="IP Address" value={t.ip_address} mono />
                      <Field
                        label="Lokasi"
                        value={
                          [t.city, t.country].filter(Boolean).join(", ") || "—"
                        }
                      />
                    </div>
                  </Section>

                  {/* 3 ── Score Breakdown ─────────────────────────────── */}
                  {t.score_breakdown && (
                    <Section title="Score Breakdown" icon="bi-bar-chart-line">
                      <div className="tdm-grid-4">
                        {[
                          [
                            "bi-list-check",
                            "Rule Score",
                            t.score_breakdown.rule_score,
                          ],
                          [
                            "bi-diagram-3",
                            "Pattern Score",
                            t.score_breakdown.pattern_score,
                          ],
                          ["bi-cpu", "ML Score", t.score_breakdown.ml_score],
                          [
                            "bi-bullseye",
                            "Final Score",
                            t.score_breakdown.final_score ?? riskScore,
                          ],
                        ].map(([icon, label, val]) => (
                          <div className="tdm-score-card" key={label}>
                            <i className={`bi ${icon} tdm-score-icon`} />
                            <div className="tdm-score-num">{val ?? "—"}</div>
                            <div className="tdm-score-label">{label}</div>
                          </div>
                        ))}
                      </div>
                    </Section>
                  )}

                  {/* 4 ── Source Detail (conditional) ────────────────── */}
                  {t.service_source === "AGENUSA" && (
                    <Section title="AGENUSA — ISO 8583 Detail" icon="bi-send">
                      <div className="tdm-grid-3">
                        <Field label="MTI" value={d.mti} mono />
                        <Field label="STAN" value={d.stan} mono />
                        <Field
                          label="Processing Code"
                          value={d.processing_code}
                          mono
                        />
                        <Field
                          label="Response Code"
                          value={d.response_code}
                          mono
                        />
                        <Field label="Msg Type" value={d.msg_type} mono />
                        <Field label="FEP ID" value={d.fep_id} mono />
                        <Field label="DE7" value={d.de7} mono />
                        <Field label="DE12" value={d.de12} mono />
                        <Field label="DE13" value={d.de13} mono />
                      </div>
                      <div className="tdm-divider" />
                      <div className="tdm-grid-2">
                        <Field label="Issuer Bank" value={d.issuer_bank} />
                        <Field
                          label="Dest Bank Code"
                          value={d.dest_bank_code}
                          mono
                        />
                        <Field
                          label="Acquirer Code"
                          value={d.acquirer_code}
                          mono
                        />
                        <Field
                          label="Issuer Account Number"
                          value={d.issuer_account_number}
                          mono
                        />
                        <Field
                          label="Dest Account Number"
                          value={d.dest_account_number}
                          mono
                          span2={false}
                        />
                      </div>
                    </Section>
                  )}

                  {t.service_source === "NUSABILL" && (
                    <Section
                      title="NUSABILL — Data Tagihan"
                      icon="bi-file-earmark-text"
                    >
                      <div className="tdm-grid-3">
                        <Field
                          label="Bill Amount"
                          value={fmt(d.bill_amount ?? 0)}
                        />
                        <Field
                          label="Payment Amount"
                          value={fmt(d.payment_amount ?? 0)}
                        />
                        <Field
                          label="Biaya Admin"
                          value={fmt(d.biaya_admin ?? 0)}
                        />
                      </div>
                      <div className="tdm-divider" />
                      <div className="tdm-grid-2">
                        <Field label="Nama Customer" value={d.nama_customer} />
                        <Field label="SOF" value={d.sof} mono />
                        <Field label="Channel" value={d.channel} />
                        <Field
                          label="UTC Reference"
                          value={d.utc_reference}
                          mono
                        />
                        <Field
                          label="Status Tagihan"
                          value={d.status_tagihan}
                        />
                        <Field label="Status Akhir" value={d.status_akhir} />
                        <Field label="Bill Date" value={fmtDate(d.bill_date)} />
                        <Field
                          label="Payment Date"
                          value={fmtDate(d.payment_date)}
                        />
                        <Field
                          label="Tanggal Rekon"
                          value={fmtDate(d.tanggal_rekon)}
                        />
                        <Field label="Keterangan" value={d.keterangan} span2 />
                      </div>
                    </Section>
                  )}

                  {/* 5 ── Violations ──────────────────────────────────── */}
                  {violationCount > 0 && (
                    <Section
                      title="Fraud Indicators"
                      icon="bi-exclamation-triangle"
                      danger
                      badge={violationCount}
                    >
                      {t.violation_reason && (
                        <p className="tdm-violation-reason">
                          {t.violation_reason}
                        </p>
                      )}
                      {(activeRuleCount > 0 || activePatternCount > 0) && (
                        <div className="tdm-tag-list">
                          {(t.violation_rule_ids || []).map((id) => (
                            <span
                              key={`r-${id}`}
                              className="tdm-tag tdm-tag-rule"
                            >
                              <i className="bi bi-check2-circle me-1" />
                              Rule #{id}
                            </span>
                          ))}
                          {(t.violation_pattern_ids || []).map((id) => (
                            <span
                              key={`p-${id}`}
                              className="tdm-tag tdm-tag-pattern"
                            >
                              <i className="bi bi-bezier2 me-1" />
                              Pattern #{id}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Additional Signals (suppressed patterns) for forensic review */}
                      {suppressedPatterns.length > 0 && (
                        <Section
                          title="Additional Signals"
                          icon="bi-info-circle"
                          defaultOpen={false}
                        >
                          <div className="tdm-tag-list">
                            {suppressedPatterns.map((it, idx) => {
                              // If backend returns numeric ids, render as Pattern #id
                              if (
                                typeof it === "number" ||
                                typeof it === "string"
                              ) {
                                return (
                                  <span
                                    key={`s-${idx}`}
                                    className="tdm-tag tdm-tag-suppressed"
                                  >
                                    <i className="bi bi-slash-circle me-1" />
                                    Pattern #{it}
                                  </span>
                                );
                              }

                              // If backend returns object with name/id
                              const label =
                                it.name ||
                                it.pattern_name ||
                                it.id ||
                                JSON.stringify(it);
                              return (
                                <span
                                  key={`s-${idx}`}
                                  className="tdm-tag tdm-tag-suppressed"
                                >
                                  <i className="bi bi-slash-circle me-1" />
                                  {label}
                                </span>
                              );
                            })}
                          </div>
                        </Section>
                      )}
                    </Section>
                  )}

                  {/* 6 ── Timestamps ──────────────────────────────────── */}
                  <Section
                    title="Timestamps"
                    icon="bi-clock-history"
                    defaultOpen={false}
                  >
                    <div className="tdm-grid-2">
                      <Field
                        label="Waktu Transaksi"
                        value={fmtDT(t.transaction_time)}
                      />
                      <Field
                        label="Status Ingest"
                        value={t.transaction_status || "INGESTED"}
                      />
                      <Field label="Dibuat" value={fmtDT(t.created_at)} />
                      <Field label="Diperbarui" value={fmtDT(t.updated_at)} />
                    </div>
                  </Section>
                </>
              )}
            </div>

            {/* ── Footer ───────────────────────────────────────────────── */}
            <div className="txn-modal-footer">
              <span className="tdm-footer-meta">
                ID #{t.id}
                {t.updated_at && <> · Diperbarui {fmtDT(t.updated_at)}</>}
              </span>
              <button className="txn-btn txn-btn-secondary" onClick={onClose}>
                Tutup
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default TransactionDetailModal;
