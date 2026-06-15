import React, { useState, useEffect, useRef, useCallback } from "react";
import "./PatternFormModal.css";
import { api } from "../../services/apiService";

// ─── Constants ────────────────────────────────────────────────────────────────
const CAT_SVC = {
  VELOCITY: ["ALL", "AGENUSA", "NUSABILL"],
  AMOUNT: ["ALL", "AGENUSA", "NUSABILL"],
  NETWORK_FAN_IN: ["AGENUSA"],
  NETWORK_FAN_OUT: ["NUSABILL"],
  DECLINE_VELOCITY: ["AGENUSA"],
  SUPER_PATTERN: ["AGENUSA"],
};

const CAT_HINT = {
  VELOCITY: "Mendeteksi lonjakan jumlah transaksi dalam window waktu.",
  AMOUNT:
    "Mendeteksi transaksi dengan nominal di atas ambang batas — per transaksi (amount) atau akumulasi window (total_amount).",
  NETWORK_FAN_IN:
    "Mendeteksi banyak kartu berbeda digesek di satu mesin EDC (AGENUSA).",
  NETWORK_FAN_OUT:
    "Mendeteksi satu user tagih ke banyak customer berbeda (NUSABILL).",
  DECLINE_VELOCITY: "Mendeteksi rangkaian gagal transaksi beruntun (AGENUSA).",
  SUPER_PATTERN:
    "Kombinasi decline beruntun + velocity + sukses akhir (AGENUSA).",
};

const CAT_FIELDS = {
  VELOCITY: [
    { l: "Jumlah transaksi (tx_count)", f: "tx_count", t: "number", w: true },
  ],
  AMOUNT: [
    { l: "Nominal transaksi (amount)", f: "amount", t: "number", w: false },
    {
      l: "Total nominal dalam window (total_amount)",
      f: "total_amount",
      t: "number",
      w: true,
    },
  ],
  NETWORK_FAN_IN: [
    {
      l: "Jumlah kartu berbeda (distinct_account_count)",
      f: "distinct_account_count",
      t: "number",
      w: true,
    },
  ],
  NETWORK_FAN_OUT: [
    {
      l: "Jumlah customer berbeda (distinct_customer_count)",
      f: "distinct_customer_count",
      t: "number",
      w: true,
    },
  ],
  DECLINE_VELOCITY: [
    {
      l: "Jumlah gagal (failure_count)",
      f: "failure_count",
      t: "number",
      w: true,
    },
  ],
  SUPER_PATTERN: [
    {
      l: "Jumlah gagal (failure_count)",
      f: "failure_count",
      t: "number",
      w: true,
    },
    { l: "Jumlah transaksi (tx_count)", f: "tx_count", t: "number", w: true },
    {
      l: "Ada sukses setelah gagal (has_success_after_failure)",
      f: "has_success_after_failure",
      t: "bool",
      w: true,
    },
  ],
};

const OPS = ["==", "!=", ">", "<", ">=", "<="];

const EMPTY_COND = () => ({
  id: Date.now() + Math.random(),
  field: "",
  operator: "==",
  value: "",
});

const EMPTY_FORM = {
  pattern_name: "",
  service_source: "ALL",
  pattern_category: "",
  action: "REVIEW",
  risk_score: 50,
  priority: 1,
  is_active: true,
  logic: "AND",
  time_window_minutes: "",
};

// ─── Condition Row ────────────────────────────────────────────────────────────
const CondRow = ({ cond, fields, onChange, onRemove, showRemove }) => {
  const meta = fields.find((f) => f.f === cond.field);

  const handleFieldChange = (f) => {
    const newMeta = fields.find((x) => x.f === f);
    onChange({ ...cond, field: f, value: newMeta?.t === "bool" ? "true" : "" });
  };

  return (
    <div className="pfm-cond-row">
      <select
        className="pfm-select"
        value={cond.field}
        onChange={(e) => handleFieldChange(e.target.value)}
      >
        {fields.map((f) => (
          <option key={f.f} value={f.f}>
            {f.l}
          </option>
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
            placeholder="nilai..."
            value={cond.value}
            onChange={(e) => onChange({ ...cond, value: e.target.value })}
          />
        )}
      </div>

      {showRemove && (
        <button
          className="pfm-remove-btn"
          onClick={onRemove}
          title="Hapus kondisi"
        >
          <i className="bi bi-x" />
        </button>
      )}
    </div>
  );
};

// ─── Main Modal ───────────────────────────────────────────────────────────────
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

  const availableCategories = Object.entries(CAT_SVC)
    .filter(([, svcs]) => svcs.includes(form.service_source))
    .map(([cat]) => cat);

  const fields = CAT_FIELDS[form.pattern_category] || [];

  const needsWindow = conditions.some((c) => {
    const meta = fields.find((f) => f.f === c.field);
    return meta?.w === true;
  });

  // ── Populate saat edit ──────────────────────────────────────────────────────
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
        action: editData.action || "REVIEW",
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
      setConditions([]);
    }
    setTimeout(() => nameRef.current?.focus(), 50);
  }, [isOpen, editData]);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.key === "Escape") {
        if (showBlockConfirm) setShowBlockConfirm(false);
        else onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose, showBlockConfirm]);

  // Saat service_source berubah, reset category jika tidak kompatibel
  const handleServiceChange = (val) => {
    const stillValid = CAT_SVC[form.pattern_category]?.includes(val);
    setForm((p) => ({
      ...p,
      service_source: val,
      pattern_category: stillValid ? p.pattern_category : "",
    }));
    if (!stillValid) setConditions([]);
  };

  const handleCategoryChange = (val) => {
    setForm((p) => ({ ...p, pattern_category: val }));
    if (val) {
      const firstField = CAT_FIELDS[val]?.[0];
      setConditions([
        {
          id: Date.now(),
          field: firstField?.f || "",
          operator: "==",
          value: "",
        },
      ]);
    } else {
      setConditions([]);
    }
  };

  const updateCond = (id, val) => {
    setConditions((p) => p.map((c) => (c.id === id ? { ...c, ...val } : c)));
  };

  const addCond = () => {
    if (!fields.length) return;
    setConditions((p) => [
      ...p,
      { id: Date.now(), field: fields[0].f, operator: "==", value: "" },
    ]);
  };

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  // ── Validation ──────────────────────────────────────────────────────────────
  const isValid = useCallback(() => {
    if (!form.pattern_name.trim()) return false;
    if (!form.pattern_category) return false;
    if (!conditions.length) return false;
    const anyEmpty = conditions.some((c) => String(c.value).trim() === "");
    if (anyEmpty) return false;
    const prio = parseInt(form.priority);
    if (!(prio >= 1 && prio <= 10)) return false;
    if (needsWindow && !form.time_window_minutes) return false;
    return true;
  }, [form, conditions, needsWindow]);

  // ── Build payload ───────────────────────────────────────────────────────────
  const buildPayload = () => {
    const conds = conditions.map((c) => {
      const meta = fields.find((f) => f.f === c.field);
      let val = c.value;
      if (meta?.t === "bool") val = val === true || val === "true";
      else if (val !== "" && !isNaN(val)) val = parseFloat(val);
      return { field: c.field, operator: c.operator, value: val };
    });

    const rules = { logic: form.logic };
    if (form.time_window_minutes)
      rules.time_window_minutes = parseInt(form.time_window_minutes);
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

  // ── Save ────────────────────────────────────────────────────────────────────
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
        // Call BE langsung
        const json = await api.post("/patterns/manual", p);
        setLoading(false);
        onSuccess?.({ ...p, ...json });
        onClose();
      }
    } catch (err) {
      console.error("Save pattern error:", err);
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (form.action === "BLOCK") {
      setShowBlockConfirm(true);
      return;
    }
    execSave();
  };

  if (!isOpen) return null;

  const catHint = CAT_HINT[form.pattern_category] || "";

  return (
    <div
      className="pfm-overlay"
      onClick={(e) =>
        e.target === e.currentTarget && !showBlockConfirm && onClose()
      }
    >
      <div className="pfm-box">
        {/* Header */}
        <div className="pfm-header">
          <div className="pfm-header-left">
            <div className="pfm-header-icon">
              <i className="bi bi-shield-shaded" />
            </div>
            <div>
              <div className="pfm-header-title">
                {isEdit ? "Edit Pattern" : "Tambah Pattern Baru"}
              </div>
              <div className="pfm-header-sub">
                {isEdit
                  ? `Edit: ${editData?.pattern_name || ""}`
                  : "Buat aturan deteksi fraud berbasis pola transaksi"}
              </div>
            </div>
          </div>
          <button className="pfm-close" onClick={onClose}>
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <div className="pfm-body">
          {/* Section A — Informasi Umum */}
          <div className="pfm-section-head">
            <div className="pfm-step-badge">A</div>
            <span>Informasi umum pattern</span>
          </div>
          <div className="pfm-card">
            <div className="pfm-grid">
              {/* Nama pattern */}
              <div className="pfm-field pfm-field--full">
                <label className="pfm-label">
                  Nama pattern <span className="pfm-req">*</span>
                </label>
                <input
                  ref={nameRef}
                  className="pfm-input"
                  type="text"
                  placeholder="Contoh: Deteksi Spam Billing Akun Bot"
                  value={form.pattern_name}
                  onChange={(e) => set("pattern_name", e.target.value)}
                />
              </div>

              {/* Service source */}
              <div className="pfm-field">
                <label className="pfm-label">Service source</label>
                <div className="pfm-select-wrap">
                  <select
                    className="pfm-select"
                    value={form.service_source}
                    onChange={(e) => handleServiceChange(e.target.value)}
                  >
                    <option value="ALL">ALL — universal</option>
                    <option value="AGENUSA">AGENUSA — Mini ATM & EDC</option>
                    <option value="NUSABILL">NUSABILL — Tagihan & VA</option>
                  </select>
                </div>
                <div className="pfm-field-hint">
                  Menentukan kategori & field kondisi yang tersedia.
                </div>
              </div>

              {/* Kategori */}
              <div className="pfm-field">
                <label className="pfm-label">
                  Kategori pattern{" "}
                  <span className="pfm-label-meta">(pattern_category)</span>
                </label>
                <div className="pfm-select-wrap">
                  <select
                    className="pfm-select"
                    value={form.pattern_category}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                  >
                    <option value="">— Pilih kategori —</option>
                    {availableCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                {catHint && <div className="pfm-field-hint">{catHint}</div>}
              </div>

              {/* Action */}
              <div className="pfm-field pfm-field--full">
                <label className="pfm-label">
                  Tindakan eksekusi{" "}
                  <span className="pfm-label-meta">(action)</span>
                </label>
                <div className="pfm-action-grid">
                  {[
                    {
                      v: "BLOCK",
                      icon: "bi-ban",
                      desc: "Tolak transaksi otomatis",
                    },
                    {
                      v: "REVIEW",
                      icon: "bi-eye",
                      desc: "Kirim ke Manual Review",
                    },
                    {
                      v: "FLAG",
                      icon: "bi-flag-fill",
                      desc: "Tandai mencurigakan",
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
                <div className="pfm-field-hint" style={{ marginTop: 6 }}>
                  Lifecycle: auto-promote ke BLOCK (akurasi ≥ 85%) atau
                  downgrade ke FLAG (akurasi &lt; 40%).
                </div>
              </div>

              {/* Risk score */}
              <div className="pfm-field">
                <label className="pfm-label">
                  Risk score <span className="pfm-label-meta">(1–100)</span>
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
                  <div className="pfm-range-badges">
                    {[
                      { max: 33, cls: "low", label: "Rendah" },
                      { max: 66, cls: "medium", label: "Sedang" },
                      { max: 100, cls: "high", label: "Tinggi" },
                    ].map((b) => (
                      <button
                        key={b.label}
                        className={`pfm-range-badge pfm-range-badge--${b.cls}`}
                        onClick={() => set("risk_score", b.max)}
                      >
                        {b.label} · {b.max}
                      </button>
                    ))}
                  </div>
                  <div className="pfm-range-val">
                    <span
                      className={`pfm-score-chip ${form.risk_score >= 67 ? "high" : form.risk_score >= 34 ? "medium" : "low"}`}
                    >
                      {form.risk_score}
                    </span>
                  </div>
                </div>
                <div className="pfm-field-hint">
                  Engine: <code>max(risk_score, pattern.risk_score)</code>.
                  Decay tiap lifecycle × akurasi.
                </div>
              </div>

              {/* Prioritas */}
              <div className="pfm-field">
                <label className="pfm-label">
                  Prioritas <span className="pfm-label-meta">(1–10)</span>
                </label>
                <div className="pfm-priority-row">
                  <input
                    className="pfm-input pfm-input--sm"
                    type="number"
                    min={1}
                    max={10}
                    value={form.priority}
                    onChange={(e) =>
                      set(
                        "priority",
                        Math.max(
                          1,
                          Math.min(10, parseInt(e.target.value) || 1),
                        ),
                      )
                    }
                  />
                  <div className="pfm-priority-pills">
                    {[
                      { l: "Tinggi", v: 10, cls: "high" },
                      { l: "Sedang", v: 5, cls: "med" },
                      { l: "Rendah", v: 1, cls: "low" },
                    ].map((p) => (
                      <button
                        key={p.v}
                        className={`pfm-prio-pill pfm-prio-pill--${p.cls}`}
                        onClick={() => set("priority", p.v)}
                      >
                        {p.l} · {p.v}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="pfm-field-hint">
                  Engine order: <code>priority.desc(), risk_score.desc()</code>
                </div>
              </div>

              {/* Status */}
              <div className="pfm-field pfm-field--full">
                <label className="pfm-label">
                  Status awal{" "}
                  <span className="pfm-label-meta">(is_active)</span>
                </label>
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
                      ? "Live active — is_active: true"
                      : "Kandidat — is_active: false"}
                  </span>
                </div>
                <div className="pfm-field-hint">
                  Inactive = kandidat, tidak dievaluasi engine sampai
                  diaktifkan.
                </div>
              </div>
            </div>
          </div>

          {/* Section B — Aturan Agregasi Global */}
          <div className="pfm-section-head">
            <div className="pfm-step-badge">B</div>
            <span>Aturan agregasi global</span>
          </div>
          <div className="pfm-card">
            <div className="pfm-grid">
              <div className="pfm-field">
                <label className="pfm-label">
                  Gerbang logika <span className="pfm-label-meta">(logic)</span>
                </label>
                <div className="pfm-logic-tabs">
                  {["AND", "OR"].map((l) => (
                    <button
                      key={l}
                      className={`pfm-logic-tab ${form.logic === l ? `pfm-logic-tab--${l.toLowerCase()} active` : ""}`}
                      onClick={() => set("logic", l)}
                    >
                      {l}
                      <span className="pfm-logic-desc">
                        {l === "AND" ? "semua kondisi" : "cukup satu"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pfm-field">
                <label className="pfm-label">
                  Time window{" "}
                  <span className="pfm-label-meta">(time_window_minutes)</span>
                </label>
                <div className="pfm-twin-row">
                  <input
                    className={`pfm-input pfm-input--sm ${needsWindow && !form.time_window_minutes ? "pfm-input--warn" : ""}`}
                    type="number"
                    min={1}
                    max={1440}
                    placeholder="—"
                    value={form.time_window_minutes}
                    onChange={(e) => set("time_window_minutes", e.target.value)}
                  />
                  <span className="pfm-twin-unit">menit</span>
                </div>
                {needsWindow && !form.time_window_minutes && (
                  <div className="pfm-field-warn">
                    <i className="bi bi-exclamation-circle" /> Wajib diisi — ada
                    field berbasis time window dalam kondisi ini.
                  </div>
                )}
                {!needsWindow && (
                  <div className="pfm-field-hint">
                    Opsional — wajib jika ada field window dalam kondisi.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section C — Builder Kondisi */}
          <div className="pfm-section-head">
            <div className="pfm-step-badge">C</div>
            <span>Builder kondisi flat</span>
          </div>
          <div className="pfm-card">
            {!form.pattern_category ? (
              <div className="pfm-cat-notice">
                <i className="bi bi-info-circle" />
                Pilih kategori pattern di Section A untuk mengaktifkan builder
                kondisi.
              </div>
            ) : (
              <>
                <div className="pfm-field-hint" style={{ marginBottom: 10 }}>
                  Field tersedia:{" "}
                  {fields.map((f) => (
                    <code key={f.f} style={{ marginRight: 4 }}>
                      {f.f}
                    </code>
                  ))}
                </div>

                {conditions.length === 0 ? (
                  <div className="pfm-empty-cond">
                    <i className="bi bi-diagram-2" />
                    <span>Belum ada kondisi.</span>
                  </div>
                ) : (
                  <div className="pfm-cond-list">
                    {conditions.map((cond, i) => (
                      <CondRow
                        key={cond.id}
                        cond={cond}
                        fields={fields}
                        onChange={(val) => updateCond(cond.id, val)}
                        onRemove={() =>
                          setConditions((p) =>
                            p.filter((c) => c.id !== cond.id),
                          )
                        }
                        showRemove={conditions.length > 1}
                      />
                    ))}
                  </div>
                )}

                <div className="pfm-cond-footer">
                  <button className="pfm-add-btn" onClick={addCond}>
                    <i className="bi bi-plus" /> Tambah kondisi
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Preview JSON */}
          {showPreview && (
            <div className="pfm-preview-wrap">
              <label className="pfm-label">
                Preview payload → <code>POST /patterns/manual</code>
              </label>
              <pre className="pfm-preview-json">
                {JSON.stringify(buildPayload(), null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
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
              {showPreview ? "Tutup" : "Preview JSON"}
            </button>
            <button
              className={`pfm-btn-save ${form.action === "BLOCK" ? "pfm-btn-save--block" : ""} ${loading ? "pfm-btn-save--loading" : ""}`}
              disabled={!isValid() || loading}
              onClick={handleSave}
            >
              {!loading && (
                <i className={`bi ${isEdit ? "bi-check-lg" : "bi-floppy"}`} />
              )}
              {loading
                ? "Menyimpan..."
                : isEdit
                  ? "Simpan Perubahan"
                  : "Simpan pattern"}
            </button>
          </div>
        </div>

        {/* Block confirm overlay */}
        {showBlockConfirm && (
          <div className="pfm-confirm-overlay">
            <div className="pfm-confirm-box">
              <div className="pfm-confirm-icon">
                <i className="bi bi-exclamation-triangle-fill" />
              </div>
              <h3 className="pfm-confirm-title">Konfirmasi tindakan BLOCK</h3>
              <p className="pfm-confirm-msg">
                Pattern <strong>BLOCK</strong> menghentikan transaksi saat
                pattern cocok. Lifecycle engine bisa auto-promote ke BLOCK
                (akurasi ≥ 85%) atau downgrade ke FLAG (akurasi &lt; 40%).
                Pastikan kondisi sudah benar.
              </p>
              <div className="pfm-confirm-actions">
                <button
                  className="pfm-btn-cancel"
                  onClick={() => setShowBlockConfirm(false)}
                >
                  Cek ulang dulu
                </button>
                <button
                  className="pfm-btn-save pfm-btn-save--block"
                  onClick={() => {
                    setShowBlockConfirm(false);
                    execSave();
                  }}
                >
                  <i className="bi bi-ban" /> Ya, simpan BLOCK pattern
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PatternFormModal;
