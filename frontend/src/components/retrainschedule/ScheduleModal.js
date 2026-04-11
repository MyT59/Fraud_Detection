import React from "react";
import {
  MODELS,
  DAYS_OF_WEEK,
  DAYS_OF_MONTH,
  FREQUENCIES,
} from "./scheduleConstants";

const ScheduleModal = ({
  isOpen,
  isEdit,
  form,
  formErrors,
  onClose,
  onSubmit,
  updateForm,
}) => {
  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="rs-modal-backdrop" onClick={handleBackdropClick}>
      <div className="rs-modal rs-modal--form">
        <div className="rs-modal__header">
          <div className="rs-modal__header-icon">
            <i
              className={`bi ${isEdit ? "bi-pencil-square" : "bi-plus-circle"}`}
            />
          </div>
          <div>
            <h2 className="rs-modal__title">
              {isEdit ? "Edit Schedule" : "Buat Schedule Baru"}
            </h2>
            <p className="rs-modal__subtitle">
              {isEdit
                ? "Perbarui konfigurasi jadwal retrain model."
                : "Konfigurasi jadwal retrain machine learning baru."}
            </p>
          </div>
          <button className="rs-modal__close" onClick={onClose}>
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <div className="rs-modal__body">
          <div className="rs-form-row rs-form-row--2col">
            <div className="rs-form-group">
              <label className="rs-form-label">
                Nama Schedule <span className="rs-required">*</span>
              </label>
              <input
                className={`rs-form-input ${formErrors.name ? "rs-form-input--error" : ""}`}
                type="text"
                placeholder="cth. Weekly Full Retrain"
                value={form.name}
                onChange={(e) => updateForm("name", e.target.value)}
              />
              {formErrors.name && (
                <span className="rs-form-error">{formErrors.name}</span>
              )}
            </div>

            <div className="rs-form-group">
              <label className="rs-form-label">
                Model ML <span className="rs-required">*</span>
              </label>
              <select
                className={`rs-form-select ${formErrors.model ? "rs-form-input--error" : ""}`}
                value={form.model}
                onChange={(e) => updateForm("model", e.target.value)}
              >
                {MODELS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              {formErrors.model && (
                <span className="rs-form-error">{formErrors.model}</span>
              )}
            </div>
          </div>

          <div className="rs-form-group">
            <label className="rs-form-label">Frekuensi</label>
            <div className="rs-freq-options">
              {FREQUENCIES.map((f) => (
                <label
                  key={f.value}
                  className={`rs-freq-option ${form.frequency === f.value ? "rs-freq-option--active" : ""}`}
                >
                  <input
                    type="radio"
                    name="frequency"
                    value={f.value}
                    checked={form.frequency === f.value}
                    onChange={() => updateForm("frequency", f.value)}
                  />
                  <i className={`bi ${f.icon}`} />
                  <span>{f.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="rs-form-row rs-form-row--2col">
            {form.frequency === "weekly" && (
              <div className="rs-form-group">
                <label className="rs-form-label">Hari</label>
                <select
                  className="rs-form-select"
                  value={form.dayOfWeek}
                  onChange={(e) => updateForm("dayOfWeek", e.target.value)}
                >
                  {DAYS_OF_WEEK.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {form.frequency === "monthly" && (
              <div className="rs-form-group">
                <label className="rs-form-label">Tanggal</label>
                <select
                  className="rs-form-select"
                  value={form.dayOfMonth}
                  onChange={(e) => updateForm("dayOfMonth", e.target.value)}
                >
                  {DAYS_OF_MONTH.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="rs-form-group">
              <label className="rs-form-label">
                Waktu (UTC+7) <span className="rs-required">*</span>
              </label>
              <input
                className={`rs-form-input ${formErrors.time ? "rs-form-input--error" : ""}`}
                type="time"
                value={form.time}
                onChange={(e) => updateForm("time", e.target.value)}
              />
              {formErrors.time && (
                <span className="rs-form-error">{formErrors.time}</span>
              )}
            </div>
          </div>

          <div className="rs-form-group">
            <label className="rs-form-label">Status Awal</label>
            <div className="rs-toggle-group">
              {["active", "paused"].map((st) => (
                <button
                  key={st}
                  type="button"
                  className={`rs-toggle-btn ${form.status === st ? "rs-toggle-btn--active" : ""}`}
                  onClick={() => updateForm("status", st)}
                >
                  <i
                    className={`bi ${st === "active" ? "bi-play-circle" : "bi-pause-circle"}`}
                  />
                  {st === "active" ? "Aktif" : "Paused"}
                </button>
              ))}
            </div>
          </div>

          <div className="rs-form-group">
            <label className="rs-form-label">Deskripsi</label>
            <textarea
              className="rs-form-textarea"
              rows={3}
              placeholder="Deskripsi singkat tentang schedule ini..."
              value={form.description}
              onChange={(e) => updateForm("description", e.target.value)}
            />
          </div>
        </div>

        <div className="rs-modal__footer">
          <button className="rs-btn rs-btn--ghost" onClick={onClose}>
            Batal
          </button>
          <button className="rs-btn rs-btn--primary" onClick={onSubmit}>
            <i className={`bi ${isEdit ? "bi-check-lg" : "bi-plus-lg"}`} />
            {isEdit ? "Simpan Perubahan" : "Buat Schedule"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScheduleModal;
