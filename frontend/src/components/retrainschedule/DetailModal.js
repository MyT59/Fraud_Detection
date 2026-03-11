import React from "react";
import {
  getFrequencyLabel,
  getFrequencyIcon,
  getStatusClass,
  getStatusLabel,
  formatScheduleTime,
} from "./scheduleConstants";

/* ═══════════════════════════════════════════
   DetailModal — Read-only detail view
═══════════════════════════════════════════ */
const DetailModal = ({ schedule, onClose, onEdit }) => {
  if (!schedule) return null;

  const Row = ({ icon, label, value, children }) => (
    <div className="rs-detail-row">
      <div className="rs-detail-row__label">
        <i className={`bi ${icon}`} />
        {label}
      </div>
      <div className="rs-detail-row__value">{children ?? value}</div>
    </div>
  );

  return (
    <div className="rs-modal-backdrop" onClick={onClose}>
      <div className="rs-modal rs-modal--detail" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="rs-modal__header">
          <div className="rs-modal__header-icon">
            <i className="bi bi-info-circle" />
          </div>
          <div>
            <h2 className="rs-modal__title">{schedule.name}</h2>
            <p className="rs-modal__subtitle">Detail konfigurasi schedule retrain</p>
          </div>
          <button className="rs-modal__close" onClick={onClose}>
            <i className="bi bi-x-lg" />
          </button>
        </div>

        {/* Body */}
        <div className="rs-modal__body">
          {/* Status badge */}
          <div className="rs-detail-status">
            <span className={`rs-badge rs-badge--lg ${getStatusClass(schedule.status)}`}>
              <span className="rs-badge__dot" />
              {getStatusLabel(schedule.status)}
            </span>
          </div>

          {schedule.description && (
            <p className="rs-detail-desc">{schedule.description}</p>
          )}

          <div className="rs-detail-grid">
            <Row icon="bi-cpu" label="Model ML" value={schedule.model} />
            <Row icon={getFrequencyIcon(schedule.frequency)} label="Frekuensi">
              <span className="rs-freq-badge">
                <i className={`bi ${getFrequencyIcon(schedule.frequency)}`} />
                {getFrequencyLabel(schedule.frequency)}
              </span>
            </Row>
            <Row icon="bi-clock" label="Waktu Eksekusi" value={formatScheduleTime(schedule)} />
            <Row icon="bi-play-circle" label="Last Run" value={schedule.lastRun} />
            <Row icon="bi-calendar-check" label="Next Run" value={schedule.nextRun} />
            <Row icon="bi-calendar-plus" label="Dibuat" value={schedule.createdAt} />
          </div>
        </div>

        {/* Footer */}
        <div className="rs-modal__footer">
          <button className="rs-btn rs-btn--ghost" onClick={onClose}>
            Tutup
          </button>
          <button
            className="rs-btn rs-btn--primary"
            onClick={() => { onClose(); onEdit(schedule); }}
          >
            <i className="bi bi-pencil" /> Edit Schedule
          </button>
        </div>
      </div>
    </div>
  );
};

export default DetailModal;