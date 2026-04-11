import React, { useEffect, useState } from "react";
import "./RuleDetailModal.css";

const ACTION_CONFIG = {
  block: {
    label: "BLOKIR",
    cls: "act-block",
    icon: "bi-ban",
    headerCls: "rdm-header--block",
    avatarIcon: "bi-shield-fill-x",
  },
  flag: {
    label: "FLAG",
    cls: "act-flag",
    icon: "bi-flag-fill",
    headerCls: "rdm-header--flag",
    avatarIcon: "bi-flag-fill",
  },
  review: {
    label: "REVIEW",
    cls: "act-review",
    icon: "bi-clipboard-check",
    headerCls: "rdm-header--review",
    avatarIcon: "bi-clipboard-check",
  },
};

const getPriorityCls = (p) => (p <= 3 ? "p-high" : p <= 6 ? "p-med" : "p-low");
const getPriorityLabel = (p) =>
  p <= 3
    ? "Prioritas Tinggi"
    : p <= 6
      ? "Prioritas Sedang"
      : "Prioritas Rendah";

const RuleDetailModal = ({
  isOpen,
  rule,
  onClose,
  onEdit,
  onDelete,
  onToggle,
}) => {
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setConfirmDelete(false);
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
        if (confirmDelete) setConfirmDelete(false);
        else onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose, confirmDelete]);

  if (!isOpen || !rule) return null;

  const act = ACTION_CONFIG[rule.action] || ACTION_CONFIG.flag;
  const prioCls = getPriorityCls(rule.priority);

  return (
    <div
      className="rdm-overlay"
      onClick={(e) =>
        e.target === e.currentTarget && !confirmDelete && onClose()
      }
    >
      <div className="rdm-box">
        <div className={`rdm-header ${act.headerCls}`}>
          <div className="rdm-header-bg" />
          <div className="rdm-header-content">
            <div className="rdm-header-top">
              <div className="rdm-avatar">
                <i className={`bi ${act.avatarIcon}`} />
              </div>
              <button className="rdm-close" onClick={onClose} title="Tutup">
                <i className="bi bi-x-lg" />
              </button>
            </div>
            <div className="rdm-rule-name">{rule.name}</div>
            {rule.description && (
              <div className="rdm-rule-desc">{rule.description}</div>
            )}
            <div className="rdm-header-badges">
              <span className="rdm-action-badge">
                <i className={`bi ${act.icon}`} />
                {act.label}
              </span>
              <span className="rdm-priority-badge">
                <i className="bi bi-lightning-charge-fill" />
                {getPriorityLabel(rule.priority)}
              </span>
              <span className="rdm-status-badge">
                <i
                  className={`bi ${rule.enabled ? "bi-toggle-on" : "bi-toggle-off"}`}
                />
                {rule.enabled ? "Aktif" : "Nonaktif"}
              </span>
            </div>
          </div>
        </div>

        <div className="rdm-body">
          <div className="rdm-stat-strip">
            <div className="rdm-stat">
              <span className="rdm-stat-val">{rule.hitCount ?? 0}</span>
              <span className="rdm-stat-lbl">Total Hit</span>
            </div>
            <div className="rdm-stat-divider" />
            <div className="rdm-stat">
              <span className="rdm-stat-val">{rule.hitToday ?? 0}</span>
              <span className="rdm-stat-lbl">Hari Ini</span>
            </div>
            <div className="rdm-stat-divider" />
            <div className="rdm-stat">
              <span className="rdm-stat-val">{rule.hitWeek ?? 0}</span>
              <span className="rdm-stat-lbl">Minggu Ini</span>
            </div>
            <div className="rdm-stat-divider" />
            <div className="rdm-stat">
              <span className="rdm-stat-val">{rule.hitMonth ?? 0}</span>
              <span className="rdm-stat-lbl">Bulan Ini</span>
            </div>
          </div>

          <div className="rdm-section-title">
            <i className="bi bi-info-circle" />
            Informasi Rule
          </div>
          <div className="rdm-info-grid">
            <div className="rdm-info-item">
              <span className="rdm-info-label">Prioritas</span>
              <span className="rdm-info-val">
                <span className={`rdm-priority-pill ${prioCls}`}>
                  {rule.priority}
                </span>
              </span>
            </div>
            <div className="rdm-info-item">
              <span className="rdm-info-label">Status</span>
              <span
                className={`rdm-enabled-badge ${rule.enabled ? "on" : "off"}`}
              >
                <i
                  className={`bi ${rule.enabled ? "bi-check-circle-fill" : "bi-pause-circle"}`}
                />
                {rule.enabled ? "Aktif" : "Nonaktif"}
              </span>
            </div>
            <div className="rdm-info-item">
              <span className="rdm-info-label">Aksi</span>
              <span className={`rdm-action-inline ${act.cls}`}>
                <i className={`bi ${act.icon}`} />
                {act.label}
              </span>
            </div>
            <div className="rdm-info-item">
              <span className="rdm-info-label">Dibuat</span>
              <span className="rdm-info-val">{rule.createdAt || "—"}</span>
            </div>
          </div>

          <div className="rdm-section-title">
            <i className="bi bi-diagram-3" />
            Kondisi Pemicu
          </div>
          <div className="rdm-condition-box">
            <div className={`rdm-condition-icon ${act.cls}`}>
              <i className={`bi ${act.icon}`} />
            </div>
            <span className="rdm-condition-text">{rule.condition || "—"}</span>
          </div>

          <div className="rdm-section-title">
            <i className="bi bi-bar-chart-fill" />
            Statistik Hit
          </div>
          <div className="rdm-hit-grid">
            {[
              { label: "Hari Ini", val: rule.hitToday ?? 0 },
              { label: "Minggu Ini", val: rule.hitWeek ?? 0 },
              { label: "Bulan Ini", val: rule.hitMonth ?? 0 },
            ].map((h) => (
              <div className="rdm-hit-card" key={h.label}>
                <span className={`rdm-hit-val ${h.val === 0 ? "zero" : ""}`}>
                  {h.val === 0 ? "—" : h.val.toLocaleString("id-ID")}
                </span>
                <span className="rdm-hit-period">{h.label}</span>
              </div>
            ))}
          </div>

          {rule.notes && (
            <>
              <div className="rdm-section-title">
                <i className="bi bi-sticky" />
                Catatan Internal
              </div>
              <div className="rdm-notes-box">{rule.notes}</div>
            </>
          )}
        </div>

        <div className="rdm-footer">
          <div className="rdm-footer-left">
            <button
              className="rdm-foot-btn rdm-foot-btn--danger"
              onClick={() => setConfirmDelete(true)}
              title="Hapus rule ini"
            >
              <i className="bi bi-trash3" />
              Hapus
            </button>
          </div>
          <div className="rdm-footer-right">
            {rule.enabled ? (
              <button
                className="rdm-foot-btn rdm-foot-btn--warn"
                onClick={() => {
                  onToggle(rule.id);
                  onClose();
                }}
              >
                <i className="bi bi-pause-circle" />
                Nonaktifkan
              </button>
            ) : (
              <button
                className="rdm-foot-btn rdm-foot-btn--activate"
                onClick={() => {
                  onToggle(rule.id);
                  onClose();
                }}
              >
                <i className="bi bi-play-circle" />
                Aktifkan
              </button>
            )}
            <button
              className="rdm-foot-btn rdm-foot-btn--edit"
              onClick={() => {
                onEdit(rule);
                onClose();
              }}
            >
              <i className="bi bi-pencil" />
              Edit Rule
            </button>
          </div>
        </div>

        {confirmDelete && (
          <div className="rdm-confirm-overlay">
            <div className="rdm-confirm-box">
              <div className="rdm-confirm-icon-wrap">
                <i className="bi bi-exclamation-triangle-fill" />
              </div>
              <h3 className="rdm-confirm-title">Hapus Rule Ini?</h3>
              <p className="rdm-confirm-msg">
                Rule <strong>"{rule.name}"</strong> akan{" "}
                <strong>terhapus secara permanen</strong> dan tidak dapat
                dikembalikan.
              </p>
              <div className="rdm-confirm-warning">
                <i className="bi bi-shield-exclamation" />
                Apakah Anda ingin melanjutkan?
              </div>
              <div className="rdm-confirm-actions">
                <button
                  className="rdm-confirm-btn-cancel"
                  onClick={() => setConfirmDelete(false)}
                >
                  <i className="bi bi-arrow-left" />
                  Batal
                </button>
                <button
                  className="rdm-confirm-btn-delete"
                  onClick={() => {
                    onDelete(rule.id);
                    onClose();
                  }}
                >
                  <i className="bi bi-trash3-fill" />
                  Ya, Hapus
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RuleDetailModal;
