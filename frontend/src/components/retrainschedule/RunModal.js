import React from "react";

const RunModal = ({ schedule, onConfirm, onCancel }) => {
  if (!schedule) return null;

  return (
    <div className="rs-modal-backdrop" onClick={onCancel}>
      <div
        className="rs-modal rs-modal--confirm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rs-modal__header rs-modal__header--run">
          <div className="rs-modal__header-icon rs-modal__header-icon--run">
            <i className="bi bi-play-circle-fill" />
          </div>
          <div>
            <h2 className="rs-modal__title">Jalankan Manual</h2>
            <p className="rs-modal__subtitle">
              Eksekusi retrain di luar jadwal.
            </p>
          </div>
          <button className="rs-modal__close" onClick={onCancel}>
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <div className="rs-modal__body">
          <div className="rs-confirm-info rs-confirm-info--run">
            <i className="bi bi-lightning-charge-fill rs-confirm-info__icon rs-confirm-info__icon--run" />
            <p>
              Anda akan menjalankan <strong>"{schedule.name}"</strong> secara
              manual sekarang. Proses retrain akan dimulai segera dan mungkin
              memakan waktu beberapa menit.
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
          </div>
        </div>

        <div className="rs-modal__footer">
          <button className="rs-btn rs-btn--ghost" onClick={onCancel}>
            Batal
          </button>
          <button className="rs-btn rs-btn--run" onClick={onConfirm}>
            <i className="bi bi-play-fill" /> Jalankan Sekarang
          </button>
        </div>
      </div>
    </div>
  );
};

export default RunModal;
