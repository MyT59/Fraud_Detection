import React, { useState, useRef, useCallback } from "react";
import api from "../../services/apiService";

const DOMAINS = [
  { value: "auto_detect", label: "Auto Detect" },
  { value: "agenusa", label: "Agenusa" },
  { value: "nusabill", label: "Nusabill" },
];

const UploadDatasetModal = ({ isOpen, onClose, onSuccess }) => {
  const [domain, setDomain] = useState("auto_detect");
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const reset = () => {
    setDomain("auto_detect");
    setFile(null);
    setResult(null);
    setError(null);
    setUploading(false);
  };

  const handleClose = () => {
    if (uploading) return;
    reset();
    onClose();
  };

  const handleFile = (f) => {
    setError(null);
    setResult(null);
    if (!f) return;
    if (!f.name.endsWith(".csv")) {
      setError("Hanya file .csv yang diperbolehkan.");
      return;
    }
    setFile(f);
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }, []);

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragging(true);
  };
  const handleDragLeave = () => setDragging(false);

  const handleSubmit = async () => {
    if (!file) {
      setError("Pilih file CSV terlebih dahulu.");
      return;
    }

    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("domain", domain);

      const data = await api.postForm("/retrain/upload", formData);
      setResult(data);
      if (onSuccess) onSuccess(data);
    } catch (err) {
      const msg =
        err?.data?.detail || err?.message || "Upload gagal. Coba lagi.";
      setError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="rs-modal-backdrop" onClick={handleClose}>
      <div
        className="rs-modal rs-modal--form"
        style={{ maxWidth: 520 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="rs-modal__header">
          <div className="rs-modal__header-icon">
            <i className="bi bi-cloud-upload" />
          </div>
          <div>
            <h2 className="rs-modal__title">Upload Dataset & Train</h2>
            <p className="rs-modal__subtitle">
              Upload file CSV untuk melatih ulang model Isolation Forest.
            </p>
          </div>
          <button
            className="rs-modal__close"
            onClick={handleClose}
            disabled={uploading}
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <div className="rs-modal__body">
          {/* Result success */}
          {result && (
            <div
              style={{
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: 10,
                padding: "14px 16px",
                marginBottom: 18,
                fontSize: "0.8125rem",
                color: "#15803d",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontWeight: 600,
                  marginBottom: 8,
                }}
              >
                <i className="bi bi-check-circle-fill" />
                Training selesai!
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "6px 16px",
                  color: "#166534",
                }}
              >
                {result.domain && (
                  <span>
                    <i className="bi bi-server me-1" />
                    Domain: <strong>{result.domain}</strong>
                  </span>
                )}
                {result.total_records_trained != null && (
                  <span>
                    <i className="bi bi-table me-1" />
                    Records:{" "}
                    <strong>
                      {result.total_records_trained.toLocaleString()}
                    </strong>
                  </span>
                )}
                {result.anomalies_found != null && (
                  <span>
                    <i className="bi bi-exclamation-triangle me-1" />
                    Anomali: <strong>{result.anomalies_found}</strong>
                  </span>
                )}
                {result.new_patterns_discovered != null && (
                  <span>
                    <i className="bi bi-diagram-3 me-1" />
                    Pola baru: <strong>{result.new_patterns_discovered}</strong>
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: 10,
                padding: "12px 16px",
                marginBottom: 18,
                fontSize: "0.8125rem",
                color: "#dc2626",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <i
                className="bi bi-exclamation-circle-fill"
                style={{ flexShrink: 0 }}
              />
              {error}
            </div>
          )}

          {/* Domain selector */}
          <div className="rs-form-group">
            <label className="rs-form-label">Domain</label>
            <select
              className="rs-form-select"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              disabled={uploading || !!result}
            >
              {DOMAINS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
            <p style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: 4 }}>
              Pilih <strong>Auto Detect</strong> jika tidak yakin domain
              datanya.
            </p>
          </div>

          {/* Drop zone */}
          <div className="rs-form-group">
            <label className="rs-form-label">
              File CSV <span className="rs-required">*</span>
            </label>
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() =>
                !uploading && !result && fileInputRef.current?.click()
              }
              style={{
                border: `2px dashed ${dragging ? "#dc2626" : file ? "#16a34a" : "#e2e8f0"}`,
                borderRadius: 10,
                padding: "28px 20px",
                textAlign: "center",
                cursor: uploading || result ? "default" : "pointer",
                background: dragging ? "#fef2f2" : file ? "#f0fdf4" : "#fafafa",
                transition: "all 0.15s ease",
              }}
            >
              {file ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                  }}
                >
                  <i
                    className="bi bi-file-earmark-spreadsheet"
                    style={{ fontSize: 24, color: "#16a34a" }}
                  />
                  <div style={{ textAlign: "left" }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: "0.875rem",
                        color: "#15803d",
                      }}
                    >
                      {file.name}
                    </div>
                    <div style={{ fontSize: "0.775rem", color: "#94a3b8" }}>
                      {(file.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                  {!uploading && !result && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                        setError(null);
                      }}
                      style={{
                        marginLeft: 8,
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "#94a3b8",
                        fontSize: 16,
                      }}
                    >
                      <i className="bi bi-x-circle" />
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <i
                    className="bi bi-cloud-arrow-up"
                    style={{
                      fontSize: 32,
                      color: "#94a3b8",
                      display: "block",
                      marginBottom: 8,
                    }}
                  />
                  <div
                    style={{
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      color: "#475569",
                      marginBottom: 4,
                    }}
                  >
                    Drop file CSV di sini, atau klik untuk browse
                  </div>
                  <div style={{ fontSize: "0.775rem", color: "#94a3b8" }}>
                    Hanya file .csv
                  </div>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              style={{ display: "none" }}
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="rs-modal__footer">
          <button
            className="rs-btn rs-btn--ghost"
            onClick={handleClose}
            disabled={uploading}
          >
            {result ? "Tutup" : "Batal"}
          </button>
          {!result && (
            <button
              className="rs-btn rs-btn--primary"
              onClick={handleSubmit}
              disabled={uploading || !file}
            >
              {uploading ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm"
                    style={{ width: 14, height: 14 }}
                  />
                  Mengupload & Training...
                </>
              ) : (
                <>
                  <i className="bi bi-play-fill" />
                  Upload & Train
                </>
              )}
            </button>
          )}
          {result && (
            <button
              className="rs-btn rs-btn--primary"
              onClick={() => {
                reset();
              }}
            >
              <i className="bi bi-plus-lg" />
              Upload Lagi
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UploadDatasetModal;
