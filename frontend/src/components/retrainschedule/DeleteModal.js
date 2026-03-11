import React from "react";

/* ═══════════════════════════════════════════
   DeleteModal — Confirmation dialog
═══════════════════════════════════════════ */
const DeleteModal = ({ schedule, onConfirm, onCancel }) => {
  if (!schedule) return null;

  return (
    <div className="rs-modal-backdrop" onClick={onCancel}>
      <div className="rs-modal rs-modal--confirm" onClick={(e) => e.stopPropagation()}>
        <div className="rs-modal__header rs-modal__header--danger">
          <div className="rs-modal__header-icon rs-modal__header-icon--danger">
            <i className="bi bi-trash3-fill" />
          </div>
          <div>
            <h2 className="rs-modal__title">Hapus Schedule</h2>
            <p className="rs-modal__subtitle">Tindakan ini tidak dapat dibatalkan.</p>
          </div>
          <button className="rs-modal__close" onClick={onCancel}>
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <div className="rs-modal__body">
          <div className="rs-confirm-info">
            <i className="bi bi-exclamation-triangle-fill rs-confirm-info__icon" />
            <p>
              Apakah Anda yakin ingin menghapus schedule{" "}
              <strong>"{schedule.name}"</strong>?{" "}
              Semua konfigurasi jadwal dan riwayat run akan dihapus permanen.
            </p>
          </div>

          <div className="rs-confirm-detail">
            <div className="rs-confirm-detail__row">
              <span>Model</span>
              <strong>{schedule.model}</strong>
            </div>
            <div className="rs-confirm-detail__row">
              <span>Frekuensi</span>
              <strong>{schedule.frequency}</strong>
            </div>
            <div className="rs-confirm-detail__row">
              <span>Status</span>
              <strong>{schedule.status}</strong>
            </div>
          </div>
        </div>

        <div className="rs-modal__footer">
          <button className="rs-btn rs-btn--ghost" onClick={onCancel}>
            Batal
          </button>
          <button className="rs-btn rs-btn--danger" onClick={onConfirm}>
            <i className="bi bi-trash3" /> Ya, Hapus Schedule
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteModal;