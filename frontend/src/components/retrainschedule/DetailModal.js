import React from "react";
import {
  getFrequencyLabel,
  getFrequencyIcon,
  getStatusClass,
  getStatusLabel,
  getDomainLabel,
  formatScheduleTime,
} from "./scheduleConstants";

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
      <div
        className="rs-modal rs-modal--detail"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rs-modal__header">
          <div className="rs-modal__header-icon">
            <i className="bi bi-info-circle" />
          </div>
          <div>
            <h2 className="rs-modal__title">{schedule.name}</h2>
            <p className="rs-modal__subtitle">
              Detail konfigurasi schedule retrain
            </p>
          </div>
          <button className="rs-modal__close" onClick={onClose}>
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <div className="rs-modal__body">
          <div className="rs-detail-status">
            <span
              className={`rs-badge rs-badge--lg ${getStatusClass(schedule.status)}`}
            >
              <span className="rs-badge__dot" />
              {getStatusLabel(schedule.status)}
            </span>

            {schedule.lastRunStatus && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "3px 10px",
                  borderRadius: "20px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  background:
                    schedule.lastRunStatus === "SUCCESS"
                      ? "#f0fdf4"
                      : "#fef2f2",
                  color:
                    schedule.lastRunStatus === "SUCCESS"
                      ? "#16a34a"
                      : "#dc2626",
                }}
              >
                <i
                  className={`bi ${
                    schedule.lastRunStatus === "SUCCESS"
                      ? "bi-check-circle-fill"
                      : "bi-x-circle-fill"
                  }`}
                  style={{ fontSize: "11px" }}
                />
                Last run: {schedule.lastRunStatus}
              </span>
            )}
          </div>

          <div className="rs-detail-grid">
            <Row icon="bi-server" label="Domain">
              <span
                style={{
                  fontWeight: 600,
                  color: schedule.domain === "agenusa" ? "#16a34a" : "#2563eb",
                }}
              >
                {getDomainLabel(schedule.domain)}
              </span>
            </Row>
            <Row icon="bi-cpu" label="Model ML" value="Isolation Forest" />
            <Row icon={getFrequencyIcon(schedule.frequency)} label="Frekuensi">
              <span className="rs-freq-badge">
                <i className={`bi ${getFrequencyIcon(schedule.frequency)}`} />
                {getFrequencyLabel(schedule.frequency)}
              </span>
            </Row>
            <Row
              icon="bi-clock"
              label="Waktu Eksekusi"
              value={formatScheduleTime(schedule)}
            />
            <Row icon="bi-terminal" label="Cron Expression">
              <code
                style={{
                  fontFamily: "monospace",
                  fontSize: "0.82rem",
                  background: "#f1f5f9",
                  padding: "2px 8px",
                  borderRadius: "5px",
                  color: "#334155",
                }}
              >
                {schedule.cron_expr}
              </code>
            </Row>
            <Row
              icon="bi-play-circle"
              label="Last Run"
              value={schedule.lastRun}
            />
            <Row
              icon="bi-calendar-check"
              label="Next Run"
              value={schedule.nextRun}
            />
            <Row
              icon="bi-calendar-plus"
              label="Dibuat"
              value={schedule.createdAt}
            />
            <Row icon="bi-fingerprint" label="Schedule ID">
              <span
                style={{
                  fontFamily: "monospace",
                  fontSize: "0.72rem",
                  color: "#94a3b8",
                  wordBreak: "break-all",
                }}
              >
                {schedule.id}
              </span>
            </Row>
          </div>
        </div>

        <div className="rs-modal__footer">
          <button className="rs-btn rs-btn--ghost" onClick={onClose}>
            Tutup
          </button>
          <button
            className="rs-btn rs-btn--primary"
            onClick={() => {
              onClose();
              onEdit(schedule);
            }}
          >
            <i className="bi bi-pencil" /> Edit Schedule
          </button>
        </div>
      </div>
    </div>
  );
};

export default DetailModal;
