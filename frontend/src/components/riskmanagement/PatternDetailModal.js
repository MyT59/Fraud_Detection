import React, { useEffect, useState } from "react";
import "./PatternDetailModal.css";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const ACTION_CFG = {
  BLOCK: {
    headerCls: "pdm-header--block",
    icon: "bi-ban",
    label: "BLOCK",
    avatarIcon: "bi-shield-fill-x",
  },
  FLAG: {
    headerCls: "pdm-header--flag",
    icon: "bi-flag-fill",
    label: "FLAG",
    avatarIcon: "bi-flag-fill",
  },
};

const normalizeMitigationAction = (action) =>
  String(action || "FLAG").toUpperCase() === "BLOCK" ? "BLOCK" : "FLAG";

const SVC_CFG = {
  ALL: { cls: "pdm-svc--all", label: "ALL" },
  AGENUSA: { cls: "pdm-svc--agenusa", label: "AGENUSA" },
  NUSABILL: { cls: "pdm-svc--nusabill", label: "NUSABILL" },
};

const OP_LABEL = {
  "==": "=",
  "!=": "≠",
  ">": ">",
  "<": "<",
  ">=": "≥",
  "<=": "≤",
  IN: "IN",
  NOT_IN: "NOT IN",
};

const FIELD_LABEL = {
  amount: "Nominal transaksi",
  total_amount: "Total nominal (window)",
  tx_count: "Jumlah transaksi",
  distinct_account_count: "Jumlah kartu berbeda",
  distinct_customer_count: "Jumlah customer berbeda",
  failure_count: "Jumlah gagal",
  has_success_after_failure: "Ada sukses setelah gagal",
  chain_decline_success_burst: "Chain decline→sukses burst",
  service_source: "Service source",
};

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

const fmtVal = (v) => {
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return v.toLocaleString("id-ID");
  return String(v);
};

// ─── Accuracy bar ─────────────────────────────────────────────────────────────
const AccuracyBar = ({ value }) => {
  const pct = value != null ? Math.round(value * 100) : null;
  const color =
    pct == null
      ? "#e5e7eb"
      : pct >= 85
        ? "#16a34a"
        : pct >= 60
          ? "#d97706"
          : pct >= 40
            ? "#f59e0b"
            : "#dc2626";

  return (
    <div className="pdm-acc-bar-wrap">
      {/* Fill bar */}
      <div className="pdm-acc-bar-track">
        {pct != null && (
          <div
            className="pdm-acc-bar-fill"
            style={{ width: `${pct}%`, background: color }}
          />
        )}
        {/* Threshold marker lines only — labels below */}
        <div
          className="pdm-acc-marker-line pdm-acc-marker--disable"
          style={{
            position: "absolute",
            left: "40%",
            top: 0,
            bottom: 0,
            width: 2,
          }}
        />
        <div
          className="pdm-acc-marker-line pdm-acc-marker--promote"
          style={{
            position: "absolute",
            left: "85%",
            top: 0,
            bottom: 0,
            width: 2,
          }}
        />
      </div>
      {/* Labels row */}
      <div className="pdm-acc-threshold-row">
        <span
          style={{ left: "40%" }}
          className="pdm-acc-threshold-lbl pdm-acc-threshold-lbl--disable"
        >
          40% · disable
        </span>
        <span
          style={{ left: "85%" }}
          className="pdm-acc-threshold-lbl pdm-acc-threshold-lbl--promote"
        >
          85% · promote
        </span>
      </div>
    </div>
  );
};

// ─── Condition renderer ───────────────────────────────────────────────────────
const ConditionNode = ({ cond, logic, isFirst }) => {
  const field = FIELD_LABEL[cond.field] || cond.field;
  const op = OP_LABEL[cond.operator] || cond.operator;
  const val = fmtVal(cond.value);

  return (
    <div className="pdm-cond-item">
      {!isFirst && (
        <div
          className={`pdm-cond-logic-badge pdm-cond-logic--${logic?.toLowerCase()}`}
        >
          {logic}
        </div>
      )}
      <div className="pdm-cond-pill">
        <span className="pdm-cond-field">{field}</span>
        <span className="pdm-cond-op">{op}</span>
        <span className="pdm-cond-val">{val}</span>
      </div>
    </div>
  );
};

// ─── Main Modal ───────────────────────────────────────────────────────────────
const PatternDetailModal = ({
  isOpen,
  pattern,
  onClose,
  onEdit,
  onActivate,
  onDeactivate,
}) => {
  const [confirmAction, setConfirmAction] = useState(null); // "activate" | "deactivate"

  useEffect(() => {
    if (isOpen) {
      setConfirmAction(null);
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.key === "Escape") {
        if (confirmAction) setConfirmAction(null);
        else onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose, confirmAction]);

  if (!isOpen || !pattern) return null;

  const act = ACTION_CFG[normalizeMitigationAction(pattern.action)];
  const svc = SVC_CFG[pattern.service_source] || SVC_CFG.ALL;
  const acc = pattern.accuracy_score;
  const pct = acc != null ? Math.round(acc * 100) : null;
  const rules = pattern.pattern_rules || {};
  const conds = rules.conditions || [];
  const logic = rules.logic || "AND";
  const tw = rules.time_window_minutes;

  const accColor =
    pct == null
      ? "#9ca3af"
      : pct >= 85
        ? "#16a34a"
        : pct >= 60
          ? "#d97706"
          : "#dc2626";

  // Lifecycle status
  const lcStatus = (() => {
    if (pct == null) return null;
    if (pct >= 85)
      return {
        label: "Kandidat promote → BLOCKED",
        cls: "pdm-lc--promote",
        icon: "bi-arrow-up-circle-fill",
      };
    if (pct < 40)
      return {
        label: "Risiko auto-disable untuk pattern",
        cls: "pdm-lc--danger",
        icon: "bi-exclamation-triangle-fill",
      };
    if (pct < 60)
      return {
        label: "Performa perlu dipantau untuk manual review",
        cls: "pdm-lc--warn",
        icon: "bi-eye-fill",
      };
    return null;
  })();

  return (
    <div
      className="pdm-overlay"
      onClick={(e) =>
        e.target === e.currentTarget && !confirmAction && onClose()
      }
    >
      <div className="pdm-box">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className={`pdm-header ${act.headerCls}`}>
          <div className="pdm-header-bg" />
          <button className="pdm-close" onClick={onClose}>
            <i className="bi bi-x-lg" />
          </button>
          <div className="pdm-header-content">
            <div className="pdm-header-top">
              <div className="pdm-avatar">
                <i className={`bi ${act.avatarIcon}`} />
              </div>
            </div>

            <div className="pdm-header-name">{pattern.pattern_name}</div>
            {pattern.pattern_category && (
              <div className="pdm-header-cat">{pattern.pattern_category}</div>
            )}

            <div className="pdm-header-badges">
              <span className="pdm-badge pdm-badge--action">
                <i className={`bi ${act.icon}`} /> {act.label}
              </span>
              <span className={`pdm-badge pdm-badge--svc ${svc.cls}`}>
                {svc.label}
              </span>
              <span
                className={`pdm-badge ${pattern.is_active ? "pdm-badge--active" : "pdm-badge--inactive"}`}
              >
                <i
                  className={`bi ${pattern.is_active ? "bi-circle-fill" : "bi-circle"}`}
                  style={{ fontSize: "0.55rem" }}
                />
                {pattern.is_active ? "Aktif" : "Menunggu Review"}
              </span>
            </div>
          </div>
        </div>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <div className="pdm-body">
          {/* Lifecycle alert */}
          {lcStatus && (
            <div className={`pdm-lc-alert ${lcStatus.cls}`}>
              <i className={`bi ${lcStatus.icon}`} />
              <span>{lcStatus.label}</span>
            </div>
          )}

          {/* Stat strip */}
          <div className="pdm-stat-strip">
            <div className="pdm-stat">
              <span
                className="pdm-stat-val"
                style={{ color: pct != null ? accColor : "#9ca3af" }}
              >
                {pct != null ? `${pct}%` : "—"}
              </span>
              <span className="pdm-stat-lbl">Precision Deteksi</span>
            </div>
            <div className="pdm-stat-div" />
            <div className="pdm-stat">
              <span className="pdm-stat-val">{pattern.risk_score ?? "—"}</span>
              <span className="pdm-stat-lbl">Risk Score</span>
            </div>
            <div className="pdm-stat-div" />
            <div className="pdm-stat">
              <span className="pdm-stat-val pdm-tp">
                {pattern.true_positive ?? 0}
              </span>
              <span className="pdm-stat-lbl">True Positive</span>
            </div>
            <div className="pdm-stat-div" />
            <div className="pdm-stat">
              <span className="pdm-stat-val pdm-fp">
                {pattern.false_positive ?? 0}
              </span>
              <span className="pdm-stat-lbl">False Positive</span>
            </div>
            <div className="pdm-stat-div" />
            <div className="pdm-stat">
              <span className="pdm-stat-val">{pattern.hit_count ?? 0}</span>
              <span className="pdm-stat-lbl">Total Deteksi</span>
            </div>
          </div>

          {/* Accuracy bar */}
          <div className="pdm-section">
            <div className="pdm-section-title">
              <i className="bi bi-bar-chart-fill" /> Performa & Lifecycle
            </div>
            <AccuracyBar value={acc} />
            <div className="pdm-acc-meta">
              <span>
                False Discovery Rate:{" "}
                <strong>
                  {pattern.false_positive_rate != null
                    ? `${Math.round(pattern.false_positive_rate * 100)}%`
                    : "—"}
                </strong>
              </span>
              <span>
                Min sample evaluasi: <strong>5</strong>
              </span>
              <span>
                Aktivasi ulang: <strong>persetujuan manager</strong>
              </span>
            </div>
          </div>

          {/* Pattern Rules */}
          <div className="pdm-section">
            <div className="pdm-section-title">
              <i className="bi bi-diagram-2" /> Kondisi Deteksi
            </div>

            {conds.length === 0 ? (
              <div className="pdm-no-conds">
                <i className="bi bi-slash-circle" /> Tidak ada kondisi
                terdefinisi.
              </div>
            ) : (
              <div className="pdm-rules-wrap">
                {/* Header logic + window */}
                <div className="pdm-rules-meta">
                  <span
                    className={`pdm-logic-chip pdm-logic--${logic.toLowerCase()}`}
                  >
                    {logic}
                  </span>
                  {tw && (
                    <span className="pdm-window-chip">
                      <i className="bi bi-clock" /> Window {tw} menit
                    </span>
                  )}
                </div>

                {/* Conditions */}
                <div className="pdm-cond-list">
                  {conds.map((c, i) => (
                    <ConditionNode
                      key={i}
                      cond={c}
                      logic={logic}
                      isFirst={i === 0}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Meta info */}
          <div className="pdm-section">
            <div className="pdm-section-title">
              <i className="bi bi-info-circle" /> Informasi Pattern
            </div>
            <div className="pdm-info-grid">
              <div className="pdm-info-item">
                <span className="pdm-info-lbl">Prioritas</span>
                <span className="pdm-info-val">
                  <span
                    className={`pdm-prio-pill ${pattern.priority >= 8 ? "high" : pattern.priority >= 5 ? "med" : "low"}`}
                  >
                    {pattern.priority}
                  </span>
                </span>
              </div>
              <div className="pdm-info-item">
                <span className="pdm-info-lbl">Dibuat</span>
                <span className="pdm-info-val">
                  {fmtDate(pattern.created_at)}
                </span>
              </div>
              <div className="pdm-info-item">
                <span className="pdm-info-lbl">Diperbarui</span>
                <span className="pdm-info-val">
                  {fmtDate(pattern.updated_at)}
                </span>
              </div>
              {pattern.disabled_at && (
                <div className="pdm-info-item">
                  <span className="pdm-info-lbl">Dinonaktifkan</span>
                  <span className="pdm-info-val pdm-info-val--warn">
                    {fmtDate(pattern.disabled_at)}
                  </span>
                </div>
              )}
              <div className="pdm-info-item pdm-info-item--full">
                <span className="pdm-info-lbl">Pattern ID</span>
                <span className="pdm-info-val pdm-mono">#{pattern.id}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className="pdm-footer">
          <div className="pdm-footer-left">
            {pattern.is_active ? (
              <button
                className="pdm-foot-btn pdm-foot-btn--warn"
                onClick={() => setConfirmAction("deactivate")}
              >
                <i className="bi bi-pause-circle" /> Nonaktifkan Pattern
              </button>
            ) : (
              <button
                className="pdm-foot-btn pdm-foot-btn--activate"
                onClick={() => setConfirmAction("activate")}
              >
                <i className="bi bi-play-circle" /> Aktifkan Pattern
              </button>
            )}
          </div>
          <div className="pdm-footer-right">
            <button
              className="pdm-foot-btn pdm-foot-btn--close"
              onClick={onClose}
            >
              Tutup
            </button>
            <button
              className="pdm-foot-btn pdm-foot-btn--edit"
              onClick={() => {
                onEdit(pattern);
                onClose();
              }}
            >
              <i className="bi bi-pencil" /> Edit Pattern
            </button>
          </div>
        </div>

        {/* ── Confirm overlay ──────────────────────────────────────────────── */}
        {confirmAction && (
          <div className="pdm-confirm-overlay">
            <div className="pdm-confirm-box">
              <div
                className={`pdm-confirm-icon ${confirmAction === "activate" ? "pdm-confirm-icon--green" : "pdm-confirm-icon--amber"}`}
              >
                <i
                  className={`bi ${confirmAction === "activate" ? "bi-play-circle-fill" : "bi-pause-circle-fill"}`}
                />
              </div>
              <h3 className="pdm-confirm-title">
                {confirmAction === "activate"
                  ? "Aktifkan Pattern?"
                  : "Nonaktifkan Pattern?"}
              </h3>
              <p className="pdm-confirm-msg">
                {confirmAction === "activate" ? (
                  <>
                    Pattern <strong>"{pattern.pattern_name}"</strong> akan mulai
                    dievaluasi engine secara real-time.
                  </>
                ) : (
                  <>
                    Pattern <strong>"{pattern.pattern_name}"</strong> tidak akan
                    dievaluasi engine sampai diaktifkan kembali.
                  </>
                )}
              </p>
              <div className="pdm-confirm-actions">
                <button
                  className="pdm-foot-btn pdm-foot-btn--close"
                  onClick={() => setConfirmAction(null)}
                >
                  Batal
                </button>
                <button
                  className={`pdm-foot-btn ${confirmAction === "activate" ? "pdm-foot-btn--activate" : "pdm-foot-btn--warn"}`}
                  onClick={() => {
                    if (confirmAction === "activate") onActivate(pattern.id);
                    else onDeactivate(pattern.id);
                    setConfirmAction(null);
                    onClose();
                  }}
                >
                  <i
                    className={`bi ${confirmAction === "activate" ? "bi-play-circle" : "bi-pause-circle"}`}
                  />
                  {confirmAction === "activate"
                    ? "Ya, Aktifkan"
                    : "Ya, Nonaktifkan"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PatternDetailModal;
