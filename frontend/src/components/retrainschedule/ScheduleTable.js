import React, { useState, useRef, useEffect } from "react";
import {
  getFrequencyLabel,
  getFrequencyIcon,
  getStatusClass,
  getStatusLabel,
  getDomainLabel,
  formatScheduleTime,
} from "./scheduleConstants";

const FREQ_OPTIONS = [
  { value: "all", label: "Semua" },
  { value: "daily", label: "Harian" },
  { value: "weekly", label: "Mingguan" },
  { value: "monthly", label: "Bulanan" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "Semua" },
  { value: "active", label: "Aktif" },
  { value: "paused", label: "Paused" },
];

const DOMAIN_COLORS = {
  agenusa: { bg: "#f0fdf4", color: "#16a34a" },
  nusabill: { bg: "#eff6ff", color: "#2563eb" },
};

const ColumnDropdown = ({ options, value, onChange, label }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const activeLabel = options.find((o) => o.value === value)?.label ?? label;
  const isFiltered = value !== "all";

  return (
    <div className="rs-col-filter" ref={ref}>
      <button
        className={`rs-col-filter__trigger ${isFiltered ? "rs-col-filter__trigger--active" : ""}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{label}</span>
        {isFiltered && (
          <span className="rs-col-filter__badge">{activeLabel}</span>
        )}
        <i
          className={`bi bi-chevron-${open ? "up" : "down"} rs-col-filter__chevron`}
        />
      </button>

      {open && (
        <div className="rs-col-filter__dropdown">
          {options.map((o) => (
            <button
              key={o.value}
              className={`rs-col-filter__opt ${value === o.value ? "rs-col-filter__opt--active" : ""}`}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              {value === o.value && (
                <i className="bi bi-check2 rs-col-filter__check" />
              )}
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const ScheduleTable = ({
  schedules,
  onEdit,
  onDelete,
  onToggleStatus,
  onDetail,
  onManualRun,
  filterFreq,
  setFilterFreq,
  filterStatus,
  setFilterStatus,
}) => {
  if (schedules.length === 0) {
    return (
      <div className="rs-empty">
        <div className="rs-empty__icon">
          <i className="bi bi-calendar-x" />
        </div>
        <p className="rs-empty__title">Tidak ada schedule ditemukan</p>
        <p className="rs-empty__sub">
          Coba ubah filter atau buat schedule baru.
        </p>
      </div>
    );
  }

  return (
    <div className="rs-table-wrap">
      <table className="rs-table">
        <thead>
          <tr>
            <th>Schedule</th>
            <th>Domain</th>
            <th>
              <ColumnDropdown
                label="Frekuensi"
                options={FREQ_OPTIONS}
                value={filterFreq}
                onChange={setFilterFreq}
              />
            </th>
            <th>Waktu Eksekusi</th>
            <th>Last Run</th>
            <th>Next Run</th>
            <th>
              <ColumnDropdown
                label="Status"
                options={STATUS_OPTIONS}
                value={filterStatus}
                onChange={setFilterStatus}
              />
            </th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          {schedules.map((s) => {
            const domStyle = DOMAIN_COLORS[s.domain] || {
              bg: "#f8fafc",
              color: "#475569",
            };
            return (
              <tr key={s.id} className="rs-table__row">
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

                <td>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      background: domStyle.bg,
                      color: domStyle.color,
                      padding: "3px 9px",
                      borderRadius: "20px",
                      fontSize: "0.775rem",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    <i className="bi bi-server" style={{ fontSize: "11px" }} />
                    {getDomainLabel(s.domain)}
                  </span>
                </td>

                <td>
                  <span className="rs-freq-badge">
                    <i className={`bi ${getFrequencyIcon(s.frequency)}`} />
                    {getFrequencyLabel(s.frequency)}
                  </span>
                </td>

                <td className="rs-cell-time">{formatScheduleTime(s)}</td>

                <td className="rs-cell-muted">
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "2px",
                    }}
                  >
                    <span>{s.lastRun}</span>
                    {s.lastRunStatus && (
                      <span
                        style={{
                          fontSize: "0.7rem",
                          fontWeight: 600,
                          color:
                            s.lastRunStatus === "SUCCESS"
                              ? "#16a34a"
                              : "#dc2626",
                        }}
                      >
                        {s.lastRunStatus}
                      </span>
                    )}
                  </div>
                </td>

                <td
                  className={`rs-cell-next ${s.nextRun === "—" ? "rs-cell-muted" : ""}`}
                >
                  {s.nextRun}
                </td>

                <td>
                  <span className={`rs-badge ${getStatusClass(s.status)}`}>
                    <span className="rs-badge__dot" />
                    {getStatusLabel(s.status)}
                  </span>
                </td>

                <td>
                  <div className="rs-actions">
                    <button
                      className="rs-action-btn rs-action-btn--info"
                      onClick={() => onDetail(s)}
                      title="Detail"
                    >
                      <i className="bi bi-eye" />
                    </button>

                    <button
                      className="rs-action-btn rs-action-btn--run"
                      onClick={() => onManualRun(s)}
                      title="Jalankan manual"
                    >
                      <i className="bi bi-play-fill" />
                    </button>

                    <button
                      className="rs-action-btn rs-action-btn--edit"
                      onClick={() => onEdit(s)}
                      title="Edit"
                    >
                      <i className="bi bi-pencil" />
                    </button>

                    <button
                      className={`rs-action-btn ${
                        s.status === "active"
                          ? "rs-action-btn--pause"
                          : "rs-action-btn--resume"
                      }`}
                      onClick={() => onToggleStatus(s)}
                      title={s.status === "active" ? "Pause" : "Aktifkan"}
                    >
                      <i
                        className={`bi ${
                          s.status === "active"
                            ? "bi-pause-fill"
                            : "bi-play-fill"
                        }`}
                      />
                    </button>

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
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default ScheduleTable;
