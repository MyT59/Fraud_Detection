import React, { useState, useEffect, useRef, useCallback } from "react";
import "./PatternFormModal.css";
import { api } from "../../services/apiService";

// ─── Definisi Data Master Field Berdasarkan Karakteristik Layanan ─────────────────
const FIELD_GROUPS = [
  {
    group: "Metrik Finansial Umum (Universal)",
    services: ["ALL", "AGENUSA", "NUSABILL"],
    items: [
      { l: "Jumlah Transaksi (tx_count)", f: "tx_count", t: "number", w: true },
      {
        l: "Nominal Per Transaksi (amount)",
        f: "amount",
        t: "number",
        w: false,
      },
      {
        l: "Akumulasi Nominal Window (total_amount)",
        f: "total_amount",
        t: "number",
        w: true,
      },
    ],
  },
  {
    group: "Metrik Perangkat Mini ATM (Khusus Agenusa)",
    services: ["AGENUSA"],
    items: [
      {
        l: "Jumlah Gagal Beruntun (failure_count)",
        f: "failure_count",
        t: "number",
        w: true,
      },
      {
        l: "Jumlah Kartu Unik di EDC (distinct_account_count)",
        f: "distinct_account_count",
        t: "number",
        w: true,
      },
      {
        l: "Ada Sukses Setelah Gagal (has_success_after_failure)",
        f: "has_success_after_failure",
        t: "bool",
        w: true,
      },
    ],
  },
  {
    group: "Metrik Distribusi Invoice & VA (Khusus Nusabill)",
    services: ["NUSABILL"],
    items: [
      {
        l: "Jumlah Customer Unik Tagihan (distinct_customer_count)",
        f: "distinct_customer_count",
        t: "number",
        w: true,
      },
    ],
  },
];

// Flat list global untuk helper utility pencarian meta data tipe
const ALL_FIELDS_FLAT = FIELD_GROUPS.reduce(
  (acc, curr) => [...acc, ...curr.items],
  [],
);

const OPS = ["==", "!=", ">", "<", ">=", "<="];

const EMPTY_FORM = {
  pattern_name: "",
  service_source: "ALL",
  pattern_category: "",
  action: "FLAG",
  risk_score: 50,
  priority: 1,
  is_active: true,
  logic: "AND",
  time_window_minutes: "",
};

const normalizeMitigationAction = (action) => {
  const normalized = String(action || "FLAG").toUpperCase();
  return normalized === "BLOCK" ? "BLOCK" : "FLAG";
};

// ─── Komponen Row Kondisi Dinamis ─────────────────────────────────────────────
const CondRow = ({ cond, currentService, onChange, onRemove, showRemove }) => {
  const availableGroups = FIELD_GROUPS.filter((g) =>
    g.services.includes(currentService),
  );
  const meta = ALL_FIELDS_FLAT.find((f) => f.f === cond.field);

  const handleFieldChange = (f) => {
    const newMeta = ALL_FIELDS_FLAT.find((x) => x.f === f);
    onChange({ ...cond, field: f, value: newMeta?.t === "bool" ? "true" : "" });
  };

  return (
    <div className="pfm-cond-row">
      <select
        className="pfm-select"
        value={cond.field}
        onChange={(e) => handleFieldChange(e.target.value)}
      >
        <option value="" disabled>
          — Pilih Indikator Matriks —
        </option>
        {availableGroups.map((grp) => (
          <optgroup key={grp.group} label={grp.group}>
            {grp.items.map((f) => (
              <option key={f.f} value={f.f}>
                {f.l}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      <select
        className="pfm-select pfm-select--op"
        value={cond.operator}
        onChange={(e) => onChange({ ...cond, operator: e.target.value })}
      >
        {OPS.map((op) => (
          <option key={op} value={op}>
            {op}
          </option>
        ))}
      </select>

      <div className="pfm-val-wrap">
        {meta?.t === "bool" ? (
          <select
            className="pfm-select"
            value={String(cond.value)}
            onChange={(e) =>
              onChange({ ...cond, value: e.target.value === "true" })
            }
          >
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        ) : (
          <input
            className="pfm-input"
            type="number"
            placeholder="Nilai..."
            value={cond.value}
            onChange={(e) => onChange({ ...cond, value: e.target.value })}
          />
        )}
      </div>

      {meta && (
        <div className="pfm-cond-meta">
          <span>{meta.w ? "Window metric" : "Static field"}</span>
          <code>{meta.f}</code>
        </div>
      )}

      {showRemove && (
        <button
          className="pfm-remove-btn"
          onClick={onRemove}
          title="Hapus baris"
        >
          <i className="bi bi-x" />
        </button>
      )}
    </div>
  );
};

// ─── Main Modal Component ─────────────────────────────────────────────────────
const PatternFormModal = ({
  isOpen,
  onClose,
  onSuccess,
  onUpdate,
  editData,
}) => {
  const isEdit = Boolean(editData);
  const [form, setForm] = useState(EMPTY_FORM);
  const [conditions, setConditions] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const nameRef = useRef();

  const needsWindow = conditions.some((c) => {
    const meta = ALL_FIELDS_FLAT.find((f) => f.f === c.field);
    return meta?.w === true;
  });

  const handleServiceChange = (newService) => {
    setForm((prev) => ({ ...prev, service_source: newService }));

    const validGroups = FIELD_GROUPS.filter((g) =>
      g.services.includes(newService),
    );
    const fallbackField = validGroups[0]?.items[0]?.f || "tx_count";

    setConditions((prevConditions) =>
      prevConditions.map((c) => {
        const isFieldValidForNewService = validGroups.some((g) =>
          g.items.some((item) => item.f === c.field),
        );

        if (!isFieldValidForNewService) {
          return { ...c, field: fallbackField, value: "" };
        }
        return c;
      }),
    );
  };

  useEffect(() => {
    if (!isOpen) return;
    setShowPreview(false);
    setShowBlockConfirm(false);
    setLoading(false);

    if (isEdit && editData) {
      const rules = editData.pattern_rules || {};
      setForm({
        pattern_name: editData.pattern_name || "",
        service_source: editData.service_source || "ALL",
        pattern_category: editData.pattern_category || "",
        action: normalizeMitigationAction(editData.action),
        risk_score: editData.risk_score ?? 50,
        priority: editData.priority ?? 1,
        is_active: editData.is_active ?? true,
        logic: rules.logic || "AND",
        time_window_minutes: rules.time_window_minutes || "",
      });
      const conds = (rules.conditions || []).map((c) => ({
        id: Date.now() + Math.random(),
        field: c.field,
        operator: c.operator,
        value: c.value,
      }));
      setConditions(conds.length ? conds : []);
    } else {
      setForm(EMPTY_FORM);
      setConditions([
        { id: Date.now(), field: "tx_count", operator: ">=", value: "" },
      ]);
    }
    setTimeout(() => nameRef.current?.focus(), 50);
  }, [isOpen, editData, isEdit]);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  const updateCond = (id, val) => {
    setConditions((p) => p.map((c) => (c.id === id ? { ...c, ...val } : c)));
  };

  const addCond = () => {
    setConditions((p) => [
      ...p,
      {
        id: Date.now() + Math.random(),
        field: "tx_count",
        operator: ">=",
        value: "",
      },
    ]);
  };

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const isValid = useCallback(() => {
    if (!form.pattern_name.trim()) return false;
    if (!form.pattern_category.trim()) return false;
    if (!conditions.length) return false;

    const anyInvalidCond = conditions.some(
      (c) => !c.field || String(c.value).trim() === "",
    );
    if (anyInvalidCond) return false;

    const prio = parseInt(form.priority);
    if (!(prio >= 1 && prio <= 10)) return false;
    if (needsWindow && !form.time_window_minutes) return false;

    return true;
  }, [form, conditions, needsWindow]);

  const buildPayload = () => {
    const conds = conditions.map((c) => {
      const meta = ALL_FIELDS_FLAT.find((f) => f.f === c.field);
      let val = c.value;
      if (meta?.t === "bool") val = val === true || val === "true";
      else if (val !== "" && !isNaN(val)) val = parseFloat(val);
      return { field: c.field, operator: c.operator, value: val };
    });

    const rules = { logic: form.logic };
    if (form.time_window_minutes) {
      rules.time_window_minutes = parseInt(form.time_window_minutes);
    }
    rules.conditions = conds;

    return {
      pattern_name: form.pattern_name,
      pattern_category: form.pattern_category,
      service_source: form.service_source,
      action: form.action,
      risk_score: parseInt(form.risk_score),
      priority: parseInt(form.priority),
      is_active: form.is_active,
      pattern_rules: rules,
    };
  };

  const execSave = async () => {
    const p = buildPayload();
    setLoading(true);
    try {
      if (isEdit) {
        const json = await api.put(`/patterns/${editData.id}`, p);
        setLoading(false);
        onUpdate?.({ ...p, ...json, id: editData.id });
        onClose();
      } else {
        const json = await api.post("/patterns/manual", p);
        setLoading(false);
        onSuccess?.({ ...p, ...json });
        onClose();
      }
    } catch (err) {
      console.error("Error saving fraud pattern:", err);
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="pfm-overlay"
      onClick={(e) =>
        e.target === e.currentTarget && !showBlockConfirm && onClose()
      }
    >
      <div className="pfm-box">
        <div className="pfm-header">
          <div className="pfm-header-left">
            <div className="pfm-header-icon">
              <i className="bi bi-shield-shaded" />
            </div>
            <div>
              <div className="pfm-header-title">
                {isEdit ? "Edit Fraud Pattern" : "Tambah Fraud Pattern"}
              </div>
              <div className="pfm-header-sub">
                Susun pola risiko berbasis indikator transaksi per layanan
              </div>
            </div>
          </div>
          <button className="pfm-close" onClick={onClose}>
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <div className="pfm-body">
          <div className="pfm-section-head">
            <div className="pfm-step-badge">A</div>
            <span>Informasi Klasifikasi Pattern</span>
          </div>
          <div className="pfm-card">
            <div className="pfm-grid">
              <div className="pfm-field pfm-field--full">
                <label className="pfm-label">
                  Nama Pattern / Skenario Kasus{" "}
                  <span className="pfm-req">*</span>
                </label>
                <input
                  className="pfm-input"
                  type="text"
                  placeholder="Masukkan nama skenario..."
                  value={form.pattern_name}
                  onChange={(e) => set("pattern_name", e.target.value)}
                />
              </div>

              <div className="pfm-field">
                <label className="pfm-label">Scope Service Source</label>
                <select
                  className="pfm-select"
                  value={form.service_source}
                  onChange={(e) => handleServiceChange(e.target.value)}
                >
                  <option value="ALL">ALL — Lintas Layanan (Universal)</option>
                  <option value="AGENUSA">AGENUSA — Mini ATM & EDC</option>
                  <option value="NUSABILL">NUSABILL — Tagihan & VA</option>
                </select>
              </div>

              {/* Ruangan Input Kategori Menggunakan Fitur DataList */}
              <div className="pfm-field">
                <label className="pfm-label">
                  Label Kategori Analisis <span className="pfm-req">*</span>
                </label>
                <input
                  className="pfm-input"
                  type="text"
                  list="category-suggestions" // <-- Disambungkan ke ID datalist di bawah
                  placeholder="Misal: Money Laundering & Split Transaction"
                  value={form.pattern_category}
                  onChange={(e) => set("pattern_category", e.target.value)}
                />

                {/* Koleksi data cadangan untuk mempermudah kemasukan data */}
                <datalist id="category-suggestions">
                  <option value="Money Laundering & Split Transaction" />
                  <option value="Velocity Spike Attack" />
                  <option value="Amount Threshold Anomaly" />
                  <option value="Decline Velocity Anomaly" />
                  <option value="High Risk Card Testing" />
                  <option value="Account Takeover Suspect" />
                </datalist>

                <div className="pfm-field-hint">
                  Boleh pilih cadangan industri atau taip terus jenis fraud
                  baharu.
                </div>
              </div>

              <div className="pfm-field pfm-field--full">
                <label className="pfm-label">
                  Tindakan Mitigasi Otomatis (Action)
                </label>
                <div className="pfm-action-grid">
                  {[
                    {
                      v: "BLOCK",
                      icon: "bi-ban",
                      desc: "Langsung fraud/block",
                    },
                    {
                      v: "FLAG",
                      icon: "bi-flag-fill",
                      desc: "Tetap berhasil, buat alert",
                    },
                  ].map((a) => (
                    <button
                      key={a.v}
                      className={`pfm-action-card pfm-action-card--${a.v.toLowerCase()} ${form.action === a.v ? "active" : ""}`}
                      onClick={() => set("action", a.v)}
                    >
                      <i className={`bi ${a.icon}`} />
                      <span className="pfm-action-label">{a.v}</span>
                      <span className="pfm-action-desc">{a.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pfm-field">
                <label className="pfm-label">
                  Risk Score Intensitas (1–100)
                </label>
                <div className="pfm-slider-wrap">
                  <input
                    className="pfm-range"
                    type="range"
                    min={1}
                    max={100}
                    value={form.risk_score}
                    onChange={(e) =>
                      set("risk_score", parseInt(e.target.value))
                    }
                  />
                  <div className="pfm-range-val">
                    <span
                      className={`pfm-score-chip ${form.risk_score >= 67 ? "high" : form.risk_score >= 34 ? "medium" : "low"}`}
                    >
                      {form.risk_score}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pfm-field">
                <label className="pfm-label">
                  Prioritas Antrean Eksekusi (1–10)
                </label>
                <input
                  className="pfm-input"
                  type="number"
                  min={1}
                  max={10}
                  value={form.priority}
                  onChange={(e) =>
                    set(
                      "priority",
                      Math.max(1, Math.min(10, parseInt(e.target.value) || 1)),
                    )
                  }
                />
              </div>

              <div className="pfm-field pfm-field--full">
                <div className="pfm-toggle-row">
                  <label className="pfm-toggle">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) => set("is_active", e.target.checked)}
                    />
                    <span className="pfm-toggle-track" />
                  </label>
                  <span
                    className={`pfm-toggle-label ${form.is_active ? "on" : ""}`}
                  >
                    {form.is_active
                      ? "Live Active — Dievaluasi Engine"
                      : "Draft — Non-Aktif"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="pfm-section-head">
            <div className="pfm-step-badge">B</div>
            <span>Aturan Konfigurasi Logika Agregasi</span>
          </div>
          <div className="pfm-card">
            <div className="pfm-grid">
              <div className="pfm-field">
                <label className="pfm-label">
                  Hubungan Kondisi Evaluasi (Logic Gate)
                </label>
                <div className="pfm-logic-tabs">
                  {["AND", "OR"].map((l) => (
                    <button
                      key={l}
                      className={`pfm-logic-tab ${form.logic === l ? `pfm-logic-tab--${l.toLowerCase()} active` : ""}`}
                      onClick={() => set("logic", l)}
                    >
                      {l}{" "}
                      <span className="pfm-logic-desc">
                        {l === "AND"
                          ? "Wajib lolos semua"
                          : "Cukup salah satu lolos"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pfm-field">
                <label className="pfm-label">Time Window Durasi</label>
                <div className="pfm-twin-row">
                  <input
                    className={`pfm-input ${needsWindow && !form.time_window_minutes ? "pfm-input--warn" : ""}`}
                    type="number"
                    min={1}
                    placeholder="10"
                    value={form.time_window_minutes}
                    onChange={(e) => set("time_window_minutes", e.target.value)}
                  />
                  <span className="pfm-twin-unit">Menit</span>
                </div>
                {needsWindow && !form.time_window_minutes && (
                  <div className="pfm-field-warn">
                    <i className="bi bi-exclamation-circle" /> Wajib diisi
                    (Metrik berbasis deret waktu).
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="pfm-section-head">
            <div className="pfm-step-badge">C</div>
            <span>Advanced Condition Builder ({form.service_source})</span>
          </div>
          <div className="pfm-card">
            <div className="pfm-cond-list">
              {conditions.map((cond) => (
                <CondRow
                  key={cond.id}
                  cond={cond}
                  currentService={form.service_source}
                  onChange={(val) => updateCond(cond.id, val)}
                  onRemove={() =>
                    setConditions((p) => p.filter((c) => c.id !== cond.id))
                  }
                  showRemove={conditions.length > 1}
                />
              ))}
            </div>
            <div className="pfm-cond-footer">
              <button className="pfm-add-btn" onClick={addCond}>
                <i className="bi bi-plus" /> Tambah Batasan Kondisi
              </button>
            </div>
          </div>

          {showPreview && (
            <div className="pfm-preview-wrap">
              <label className="pfm-label">
                Live Sync JSON Payload Preview
              </label>
              <pre className="pfm-preview-json">
                {JSON.stringify(buildPayload(), null, 2)}
              </pre>
            </div>
          )}
        </div>

        <div className="pfm-footer">
          <button
            className="pfm-btn-cancel"
            onClick={onClose}
            disabled={loading}
          >
            Batal
          </button>
          <div className="pfm-footer-right">
            <button
              className="pfm-btn-preview"
              onClick={() => setShowPreview((p) => !p)}
            >
              <i className="bi bi-code-slash" />{" "}
              {showPreview ? "Sembunyikan JSON" : "Preview JSON"}
            </button>
            <button
              className={`pfm-btn-save ${form.action === "BLOCK" ? "pfm-btn-save--block" : ""}`}
              disabled={!isValid() || loading}
              onClick={() => execSave()}
            >
              {loading
                ? "Menyimpan..."
                : isEdit
                  ? "Perbarui Pattern"
                  : "Simpan Pattern"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatternFormModal;
