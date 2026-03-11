import React from "react";
import {
  getFrequencyLabel,
  getFrequencyIcon,
  getStatusClass,
  getStatusLabel,
  formatScheduleTime,
} from "./scheduleConstants";

/* ═══════════════════════════════════════════
   ScheduleTable — Main data table
═══════════════════════════════════════════ */
const ScheduleTable = ({
  schedules,
  onEdit,
  onDelete,
  onToggleStatus,
  onDetail,
  onManualRun,
}) => {
  if (schedules.length === 0) {
    return (
      <div className="rs-empty">
        <div className="rs-empty__icon"><i className="bi bi-calendar-x" /></div>
        <p className="rs-empty__title">Tidak ada schedule ditemukan</p>
        <p className="rs-empty__sub">Coba ubah filter atau buat schedule baru.</p>
      </div>
    );
  }

  return (
    <div className="rs-table-wrap">
      <table className="rs-table">
        <thead>
          <tr>
            <th>Schedule</th>
            <th>Model ML</th>
            <th>Frekuensi</th>
            <th>Waktu Eksekusi</th>
            <th>Last Run</th>
            <th>Next Run</th>
            <th>Status</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          {schedules.map((s) => (
            <tr key={s.id} className="rs-table__row">
              {/* Schedule name */}
              <td>
                <div className="rs-cell-name">
                  <span
                    className="rs-cell-name__text"
                    onClick={() => onDetail(s)}
                    title="Lihat detail"
                  >
                    {s.name}
                  </span>
                </div>
              </td>

              {/* Model */}
              <td>
                <span className="rs-model-tag">
                  <i className="bi bi-cpu" />
                  {s.model}
                </span>
              </td>

              {/* Frequency */}
              <td>
                <span className="rs-freq-badge">
                  <i className={`bi ${getFrequencyIcon(s.frequency)}`} />
                  {getFrequencyLabel(s.frequency)}
                </span>
              </td>

              {/* Execution time */}
              <td className="rs-cell-time">{formatScheduleTime(s)}</td>

              {/* Last run */}
              <td className="rs-cell-muted">{s.lastRun}</td>

              {/* Next run */}
              <td className={`rs-cell-next ${s.nextRun === "—" ? "rs-cell-muted" : ""}`}>
                {s.nextRun}
              </td>

              {/* Status badge */}
              <td>
                <span className={`rs-badge ${getStatusClass(s.status)}`}>
                  <span className="rs-badge__dot" />
                  {getStatusLabel(s.status)}
                </span>
              </td>

              {/* Action buttons */}
              <td>
                <div className="rs-actions">
                  {/* Detail */}
                  <button
                    className="rs-action-btn rs-action-btn--info"
                    onClick={() => onDetail(s)}
                    title="Detail"
                  >
                    <i className="bi bi-eye" />
                  </button>

                  {/* Run manually */}
                  <button
                    className="rs-action-btn rs-action-btn--run"
                    onClick={() => onManualRun(s)}
                    title="Jalankan manual"
                  >
                    <i className="bi bi-play-fill" />
                  </button>

                  {/* Edit */}
                  <button
                    className="rs-action-btn rs-action-btn--edit"
                    onClick={() => onEdit(s)}
                    title="Edit"
                  >
                    <i className="bi bi-pencil" />
                  </button>

                  {/* Toggle status */}
                  <button
                    className={`rs-action-btn ${
                      s.status === "active"
                        ? "rs-action-btn--pause"
                        : "rs-action-btn--resume"
                    }`}
                    onClick={() => onToggleStatus(s)}
                    title={s.status === "active" ? "Pause" : "Aktifkan"}
                  >
                    <i className={`bi ${s.status === "active" ? "bi-pause-fill" : "bi-play-fill"}`} />
                  </button>

                  {/* Delete */}
                  <button
                    className="rs-action-btn rs-action-btn--delete"
                    onClick={() => onDelete(s)}
                    title="Hapus"
                  >
                    <i className="bi bi-trash" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ScheduleTable;