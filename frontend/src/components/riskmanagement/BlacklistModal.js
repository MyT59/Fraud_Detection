import React, { useEffect, useState } from "react";
import "./BlacklistModal.css";

const SOURCE_CONFIG = {
  manual: { label: "Input Manual", cls: "src-manual", icon: "bi-person-fill" },
  system: { label: "Auto-Detect", cls: "src-system", icon: "bi-cpu-fill" },
  import: { label: "Bulk Import", cls: "src-import", icon: "bi-upload" },
};

const STATUS_CONFIG = {
  active: {
    label: "Active",
    cls: "st-active",
    icon: "bi-shield-fill-x",
  },
  pending: {
    label: "Needs Review",
    cls: "st-pending",
    icon: "bi-hourglass-split",
  },
  inactive: {
    label: "Inactive",
    cls: "st-inactive",
    icon: "bi-shield-slash",
  },
  rejected: {
    label: "Rejected",
    cls: "st-inactive",
    icon: "bi-x-circle",
  },
};

const REASON_ICON = {
  "Penipuan Online": "bi-laptop",
  "Rekening Mule": "bi-arrow-left-right",
  Phishing: "bi-fish",
  "Social Engineering": "bi-people-fill",
  "Investasi Bodong": "bi-graph-down-arrow",
  "Jual Beli Palsu": "bi-bag-x",
  "Pinjol Ilegal": "bi-currency-dollar",
  Lainnya: "bi-exclamation-octagon",
};

const BlacklistDetailModal = ({
  isOpen,
  item,
  onClose,
  onEdit,
  onDelete,
  onApprove,
  onReject,
  onToggleStatus,
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

  if (!isOpen || !item) return null;

  const src = SOURCE_CONFIG[item.source] || SOURCE_CONFIG.manual;
  const st = STATUS_CONFIG[item.status] || STATUS_CONFIG.active;
  const reasonIcon = REASON_ICON[item.reason] || "bi-exclamation-octagon";

  return (
    <div
      className="bdm-overlay"
      onClick={(e) =>
        e.target === e.currentTarget && !confirmDelete && onClose()
      }
    >
      <div className="bdm-box">
        <div className={`bdm-header bdm-header--${item.status}`}>
          <div className="bdm-header-bg" />
          <div className="bdm-header-content">
            <div className="bdm-header-top">
              <div className="bdm-avatar">
                <i className="bi bi-person-fill-slash" />
              </div>
              <button className="bdm-close" onClick={onClose} title="Tutup">
                <i className="bi bi-x-lg" />
              </button>
            </div>
            <div className="bdm-header-info">
              <div className="bdm-acct-number">{item.accountNumber}</div>
              <div className="bdm-acct-name">{item.accountName || "—"}</div>
              <div className="bdm-header-badges">
                <span className={`bdm-status-badge ${st.cls}`}>
                  <i className={`bi ${st.icon}`} />
                  {st.label}
                </span>
                <span className="bdm-bank-badge">
                  <i className="bi bi-bank" />
                  {item.bank || "—"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bdm-body">
          <div className="bdm-stat-strip">
            <div className="bdm-stat">
              <span className="bdm-stat-val">{item.hitCount || 0}</span>
              <span className="bdm-stat-lbl">Total Hit</span>
            </div>
            <div className="bdm-stat-divider" />
            <div className="bdm-stat">
              <span className="bdm-stat-val">{item.addedAt || "—"}</span>
              <span className="bdm-stat-lbl">Ditambahkan</span>
            </div>
            <div className="bdm-stat-divider" />
            <div className="bdm-stat">
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 2,
                }}
              >
                <span
                  className="bdm-stat-val"
                  style={{
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    color: "#111827",
                    textAlign: "center",
                  }}
                >
                  {item.addedBy || "—"}
                </span>
                {item.addedByRole && (
                  <span
                    style={{
                      fontSize: "0.65rem",
                      fontWeight: 600,
                      padding: "1px 6px",
                      borderRadius: 4,
                      background: "#eff6ff",
                      color: "#1d4ed8",
                    }}
                  >
                    {item.addedByRole}
                  </span>
                )}
                {item.addedById && (
                  <span
                    style={{
                      fontSize: "0.62rem",
                      color: "#9ca3af",
                      fontFamily: "Courier New, monospace",
                    }}
                  >
                    #{item.addedById}
                  </span>
                )}
              </div>
              <span className="bdm-stat-lbl">Ditambah oleh</span>
            </div>
            <div className="bdm-stat-divider" />
            <div className="bdm-stat">
              <span className={`bdm-stat-val bdm-stat-src ${src.cls}`}>
                <i className={`bi ${src.icon}`} />
                {src.label}
              </span>
              <span className="bdm-stat-lbl">Sumber</span>
            </div>
          </div>

          <div className="bdm-section-title">
            <i className="bi bi-info-circle" />
            Informasi Rekening
          </div>
          <div className="bdm-info-grid">
            <div className="bdm-info-item bdm-info-item--full">
              <span className="bdm-info-label">Nilai / Identifier</span>
              <span
                className="bdm-info-val bdm-mono"
                style={{ fontSize: "1rem", letterSpacing: "0.04em" }}
              >
                {item.accountNumber}
              </span>
            </div>
            <div className="bdm-info-item">
              <span className="bdm-info-label">Tipe Identifier</span>
              <span className="bdm-info-val">
                <span
                  className="bdm-pill bdm-pill-gray"
                  style={{
                    fontFamily: "Courier New, monospace",
                    fontSize: "0.75rem",
                  }}
                >
                  {item.bank || item.type || "—"}
                </span>
              </span>
            </div>
            <div className="bdm-info-item">
              <span className="bdm-info-label">Service Scope</span>
              <span className="bdm-info-val">
                <span
                  className={`bdm-pill ${
                    item.service_scope === "AGENUSA"
                      ? "bdm-pill-blue"
                      : item.service_scope === "NUSABILL"
                        ? "bdm-pill-green"
                        : "bdm-pill-gray"
                  }`}
                >
                  {item.service_scope || "ALL"}
                </span>
              </span>
            </div>
            <div className="bdm-info-item">
              <span className="bdm-info-label">Status</span>
              <span className={`bdm-status-inline ${st.cls}`}>
                <i className={`bi ${st.icon}`} />
                {st.label}
              </span>
            </div>
            <div className="bdm-info-item bdm-info-item--full">
              <span className="bdm-info-label">Alasan Blacklist</span>
              <span className="bdm-info-val bdm-reason-val">
                <span className="bdm-reason-icon">
                  <i className={`bi ${reasonIcon}`} />
                </span>
                {item.reason || "—"}
              </span>
            </div>
            {item.reasonDetail && (
              <div className="bdm-info-item bdm-info-item--full">
                <span className="bdm-info-label">Review Note</span>
                <span className="bdm-info-val bdm-reason-detail">
                  {item.reasonDetail || item.review_note || "—"}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="bdm-footer">
          <div className="bdm-footer-left">
            <button
              className="bdm-foot-btn bdm-foot-btn--danger"
              onClick={() => setConfirmDelete(true)}
              title="Hapus dari blacklist"
            >
              <i className="bi bi-trash3" />
              Hapus
            </button>
          </div>
          <div className="bdm-footer-right">
            {item.status === "pending" && (
              <>
                <button
                  className="bdm-foot-btn bdm-foot-btn--approve"
                  onClick={() => {
                    onApprove(item.id);
                    onClose();
                  }}
                >
                  <i className="bi bi-check-circle" />
                  Setujui
                </button>
                <button
                  className="bdm-foot-btn bdm-foot-btn--warn"
                  onClick={() => {
                    onReject(item.id);
                    onClose();
                  }}
                >
                  <i className="bi bi-x-circle" />
                  Tolak
                </button>
              </>
            )}
            {item.status === "active" && (
              <button
                className="bdm-foot-btn bdm-foot-btn--warn"
                onClick={() => {
                  onToggleStatus(item.id, "inactive");
                  onClose();
                }}
              >
                <i className="bi bi-pause-circle" />
                Nonaktifkan
              </button>
            )}
            {item.status === "inactive" && (
              <button
                className="bdm-foot-btn bdm-foot-btn--approve"
                onClick={() => {
                  onToggleStatus(item.id, "active");
                  onClose();
                }}
              >
                <i className="bi bi-play-circle" />
                Aktifkan Kembali
              </button>
            )}
            {item.status === "rejected" && (
              <button
                className="bdm-foot-btn bdm-foot-btn--approve"
                onClick={() => {
                  onApprove(item.id);
                  onClose();
                }}
              >
                <i className="bi bi-arrow-repeat" />
                Setujui Ulang
              </button>
            )}
            <button
              className="bdm-foot-btn bdm-foot-btn--edit"
              onClick={() => {
                onEdit(item);
                onClose();
              }}
            >
              <i className="bi bi-pencil" />
              Edit Data
            </button>
          </div>
        </div>

        {confirmDelete && (
          <div className="bdm-confirm-overlay">
            <div className="bdm-confirm-box">
              <div className="bdm-confirm-icon-wrap">
                <i className="bi bi-exclamation-triangle-fill" />
              </div>
              <h3 className="bdm-confirm-title">Hapus Rekening Blacklist?</h3>
              <p className="bdm-confirm-msg">
                Data rekening{" "}
                <strong className="bdm-confirm-acct">
                  {item.accountNumber}
                </strong>{" "}
                atas nama <strong>{item.accountName || "—"}</strong> akan{" "}
                <strong>dihapus dari daftar blacklist aktif</strong>. Data
                tetap disimpan sebagai arsip sistem.
              </p>
              <div className="bdm-confirm-warning">
                <i className="bi bi-shield-exclamation" />
                Apakah Anda masih ingin melanjutkan?
              </div>
              <div className="bdm-confirm-actions">
                <button
                  className="bdm-confirm-btn-cancel"
                  onClick={() => setConfirmDelete(false)}
                >
                  <i className="bi bi-arrow-left" />
                  Batal
                </button>
                <button
                  className="bdm-confirm-btn-delete"
                  onClick={() => {
                    onDelete(item.id);
                    onClose();
                  }}
                >
                  <i className="bi bi-trash3-fill" />
                  Ya, Hapus dari Daftar Aktif
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BlacklistDetailModal;
