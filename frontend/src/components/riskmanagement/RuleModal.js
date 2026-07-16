import React, { useState, useEffect, useRef } from "react";
import "./RuleModal.css";

const ACTIONS = [
  {
    value: "block",
    label: "BLOKIR",
    icon: "bi-ban",
    desc: "Tolak transaksi otomatis",
    cls: "sel-block",
  },
  {
    value: "flag",
    label: "FLAG",
    icon: "bi-flag-fill",
    desc: "Transaksi tetap berhasil dan masuk alert review",
    cls: "sel-flag",
  },
];

const FIELDS = [
  "Jumlah Transaksi (Rp)",
  "Frekuensi (per jam)",
  "Frekuensi (per hari)",
  "Usia Akun (hari)",
  "Jumlah Kumulatif (hari ini)",
  "Transaction Timestamp (jam transaksi)",
  "Jarak Lokasi (km)",
  "Tipe Merchant",
  "Kode Negara Tujuan",
];

const OPS = [">", "<", ">=", "<=", "=", "≠", "termasuk", "tidak termasuk"];

const EMPTY = {
  name: "",
  rule_key: "",
  description: "",
  priority: 5,
  action: "flag",
  service_scope: "ALL",
  severity: "MEDIUM",
  condField: FIELDS[0],
  condOp: ">",
  condValue: "",
  condValue2: "",
  enableTimeWindow: false,
  timeWindowHours: 1,
  timeWindowMinutes: 0,
  timeWindowSeconds: 0,
  notes: "",
};

const formatNumber = (val) => {
  const digits = String(val).replace(/\D/g, "");
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

const unformatNumber = (val) => String(val).replace(/\./g, "");

const getConditionHint = (field) => {
  if (
    field === "Transaction Timestamp (jam transaksi)" ||
    field === "Jam Transaksi"
  ) {
    return "Ini adalah waktu transaksi. Bisa jam saja, tapi lebih jelas bila ada tanggal dan jam, mis. 14:32 atau 2026-07-06 14:32.";
  }
  return null;
};

const Field = ({ label, req, opt, err, children }) => (
  <div className="rum-field">
    <label className="rum-label">
      {label}
      {req && <span className="rum-req"> *</span>}
      {opt && <span className="rum-opt"> (opsional)</span>}
    </label>
    {children}
    {err && (
      <span className="rum-field-err">
        <i className="bi bi-exclamation-circle-fill" /> {err}
      </span>
    )}
  </div>
);

const RuleModal = ({ isOpen, onClose, onSubmit, editData }) => {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const firstInputRef = useRef();

  const isEdit = Boolean(editData);

  useEffect(() => {
    if (isOpen) {
      setForm(
        isEdit
          ? {
              ...EMPTY,
              ...editData,
              action: editData?.action === "block" ? "block" : "flag",
            }
          : EMPTY,
      );
      setErrors({});
      setLoading(false);
      setTimeout(() => {
        firstInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, editData, isEdit]);

  useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const set = (f, v) => {
    setForm((p) => ({ ...p, [f]: v }));
    if (errors[f]) setErrors((p) => ({ ...p, [f]: undefined }));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Nama rule wajib diisi.";
    if (!isEdit && !form.rule_key.trim()) e.rule_key = "Rule key wajib diisi.";
    if (!form.condValue.trim()) e.condValue = "Nilai kondisi wajib diisi.";
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 450));
    const now = new Date().toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    onSubmit({
      ...form,
      id: editData?.id || Date.now(),
      enabled: editData?.enabled ?? true,
      hitCount: editData?.hitCount ?? 0,
      createdAt: editData?.createdAt || now,
      condition: buildConditionText(form),
    });
    setLoading(false);
    onClose();
  };

  const buildConditionText = (f) => {
    let text = `${f.condField} ${f.condOp} ${f.condValue}`;
    if (f.condValue2) text += ` dan ${f.condValue2}`;
    if (f.enableTimeWindow) {
      const parts = [];
      if (f.timeWindowHours) parts.push(`${f.timeWindowHours} jam`);
      if (f.timeWindowMinutes) parts.push(`${f.timeWindowMinutes} menit`);
      if (f.timeWindowSeconds) parts.push(`${f.timeWindowSeconds} detik`);
      text += ` (dalam ${parts.length ? parts.join(" ") : "0 detik"})`;
    }
    return text;
  };

  const previewText = buildConditionText(form);
  const conditionHint = getConditionHint(form.condField);

  return (
    <div
      className="rum-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="rum-box">
        <div className="rum-header">
          <div className="rum-header-left">
            <div className="rum-icon">
              <i className="bi bi-gear-fill" />
            </div>
            <div>
              <div className="rum-title">
                {isEdit ? "Edit Rule" : "Tambah Rule Baru"}
              </div>
              <div className="rum-subtitle">
                Definisikan kondisi dan aksi yang akan diterapkan
              </div>
            </div>
          </div>
          <button className="rum-close" onClick={onClose}>
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <div className="rum-body">
          <div className="rum-section">
            <span>Identitas Rule</span>
          </div>

          <Field label="Nama Rule" req err={errors.name}>
            <input
              ref={firstInputRef}
              className={`rum-input ${errors.name ? "err" : ""}`}
              type="text"
              placeholder="cth: Transaksi Besar Akun Baru"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </Field>

          <div className="rum-row">
            <Field
              label="Rule Key"
              req={!isEdit}
              opt={isEdit}
              err={errors.rule_key}
            >
              <input
                className={`rum-input ${errors.rule_key ? "err" : ""} rum-mono`}
                type="text"
                placeholder="cth: large_trx_new_account"
                value={form.rule_key}
                disabled={isEdit}
                onChange={(e) =>
                  set(
                    "rule_key",
                    e.target.value
                      .toLowerCase()
                      .replace(/\s+/g, "_")
                      .replace(/[^a-z0-9_]/g, ""),
                  )
                }
              />
            </Field>
            <Field label="Deskripsi" opt>
              <input
                className="rum-input"
                type="text"
                placeholder="cth: Nominal > 50jt dari akun < 7 hari"
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
              />
            </Field>
          </div>
          <div className="rum-row">
            <Field label="Prioritas (1=tertinggi)">
              <input
                className="rum-input"
                type="number"
                min={1}
                max={10}
                value={form.priority}
                onChange={(e) =>
                  set(
                    "priority",
                    Math.max(1, Math.min(10, Number(e.target.value))),
                  )
                }
              />
            </Field>
          </div>

          <div className="rum-row">
            <Field label="Service Scope">
              <div className="rum-select-wrap">
                <select
                  className="rum-select"
                  value={form.service_scope}
                  onChange={(e) => set("service_scope", e.target.value)}
                >
                  <option value="ALL">ALL</option>
                  <option value="AGENUSA">AGENUSA</option>
                  <option value="NUSABILL">NUSABILL</option>
                </select>
              </div>
            </Field>
            <Field label="Severity">
              <div className="rum-select-wrap">
                <select
                  className="rum-select"
                  value={form.severity}
                  onChange={(e) => set("severity", e.target.value)}
                >
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                  <option value="CRITICAL">CRITICAL</option>
                </select>
              </div>
            </Field>
          </div>

          <div className="rum-section">
            <span>Kondisi Pemicu</span>
          </div>

          <div className="rum-condition-builder">
            <div className="rum-cb-row">
              <span className="rum-cb-label">JIKA</span>
              <div style={{ position: "relative", flex: 1 }}>
                <select
                  className="rum-cb-select"
                  style={{ width: "100%" }}
                  value={form.condField}
                  onChange={(e) => set("condField", e.target.value)}
                >
                  {FIELDS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="rum-cb-row">
              <select
                className="rum-cb-select"
                value={form.condOp}
                onChange={(e) => set("condOp", e.target.value)}
              >
                {OPS.map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </select>
              <input
                className={`rum-cb-input ${errors.condValue ? "err" : ""}`}
                type="text"
                placeholder="Nilai"
                value={form.condValue}
                onChange={(e) => {
                  const raw = unformatNumber(e.target.value);

                  const isNumericField = [
                    "Jumlah Transaksi (Rp)",
                    "Frekuensi (per jam)",
                    "Frekuensi (per hari)",
                    "Usia Akun (hari)",
                    "Jumlah Kumulatif (hari ini)",
                    "Transaction Timestamp (jam transaksi)",
                    "Jarak Lokasi (km)",
                  ].includes(form.condField);
                  const formatted =
                    isNumericField && /^\d*$/.test(raw)
                      ? formatNumber(raw)
                      : e.target.value;
                  set("condValue", formatted);
                }}
                style={{ flex: 1, width: "auto" }}
              />
              {conditionHint && (
                <div
                  style={{
                    marginTop: 6,
                    fontSize: ".72rem",
                    color: "#6b7280",
                    lineHeight: 1.4,
                  }}
                >
                  <i className="bi bi-info-circle" /> {conditionHint}
                </div>
              )}
              {errors.condValue && (
                <span style={{ fontSize: ".72rem", color: "#dc2626" }}>
                  Wajib diisi
                </span>
              )}
            </div>
            <div className="rum-cb-row">
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: ".78rem",
                  color: "#6b7280",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={form.enableTimeWindow}
                  onChange={(e) => set("enableTimeWindow", e.target.checked)}
                />
                Dalam rentang waktu
              </label>
              {form.enableTimeWindow && (
                <>
                  <input
                    className="rum-cb-input"
                    type="number"
                    min={0}
                    max={23}
                    value={form.timeWindowHours}
                    onChange={(e) =>
                      set(
                        "timeWindowHours",
                        Math.max(0, Number(e.target.value)),
                      )
                    }
                    style={{ width: 52 }}
                  />
                  <span className="rum-cb-label">jam</span>
                  <input
                    className="rum-cb-input"
                    type="number"
                    min={0}
                    max={59}
                    value={form.timeWindowMinutes}
                    onChange={(e) =>
                      set(
                        "timeWindowMinutes",
                        Math.max(0, Math.min(59, Number(e.target.value))),
                      )
                    }
                    style={{ width: 52 }}
                  />
                  <span className="rum-cb-label">menit</span>
                  <input
                    className="rum-cb-input"
                    type="number"
                    min={0}
                    max={59}
                    value={form.timeWindowSeconds}
                    onChange={(e) =>
                      set(
                        "timeWindowSeconds",
                        Math.max(0, Math.min(59, Number(e.target.value))),
                      )
                    }
                    style={{ width: 52 }}
                  />
                  <span className="rum-cb-label">detik</span>
                </>
              )}
            </div>
            <div className="rum-preview-text">
              🔍 {previewText || "— isi kondisi di atas —"}
            </div>
          </div>

          <div className="rum-section">
            <span>Aksi yang Diambil</span>
          </div>

          <div className="rum-action-preview">
            {ACTIONS.map((a) => (
              <div
                key={a.value}
                className={`rum-ap-card ${form.action === a.value ? a.cls : ""}`}
                onClick={() => set("action", a.value)}
              >
                <i className={`bi ${a.icon} rum-ap-icon`} />
                <div className="rum-ap-label">{a.label}</div>
                <div className="rum-ap-desc">{a.desc}</div>
              </div>
            ))}
          </div>

          <Field label="Catatan Internal" opt>
            <textarea
              className="rum-textarea"
              placeholder="Referensi regulasi, alasan bisnis, dsb..."
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </Field>
        </div>

        <div className="rum-footer">
          <button
            className="rum-btn-cancel"
            onClick={onClose}
            disabled={loading}
          >
            Batal
          </button>
          <button
            className="rum-btn-submit"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="rum-spinner" />
                Menyimpan...
              </>
            ) : (
              <>
                <i
                  className={`bi ${isEdit ? "bi-check-lg" : "bi-gear-fill"}`}
                />
                {isEdit ? "Simpan Perubahan" : "Buat Rule"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RuleModal;
