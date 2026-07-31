import React, { useState, useEffect, useRef, useCallback } from "react";
import "./PatternFormModal.css";
import { api } from "../../services/apiService";

// ─── Definisi Data Master Field Berdasarkan Karakteristik Layanan ─────────────────
const FIELD_GROUPS = [
  {
    group: "Metrik Finansial Umum (Universal)",
    services: ["ALL", "AGENUSA", "NUSABILL"],
    items: [
      { l: "Jumlah Transaksi (tx_count)", f: "tx_count", t: "number", w: true, hint: "Jumlah transaksi dalam Time Window. Contoh: >= 3 dalam 5 menit.", example: ">= 3" },
      { l: "Nominal Per Transaksi (amount)", f: "amount", t: "number", w: false, hint: "Nominal transaksi yang sedang dievaluasi. Contoh: >= 500000.", example: ">= 500000" },
      { l: "Akumulasi Nominal Window (total_amount)", f: "total_amount", t: "number", w: true, hint: "Total nominal seluruh transaksi dalam Time Window. Contoh: >= 2000000.", example: ">= 2000000" },
    ],
  },
  {
    group: "Metrik Perangkat Mini ATM (Khusus Agenusa)",
    services: ["AGENUSA"],
    items: [
      { l: "Jumlah Gagal Beruntun (failure_count)", f: "failure_count", t: "number", w: true, hint: "Jumlah transaksi gagal beruntun dalam Time Window. Contoh: >= 3.", example: ">= 3" },
      { l: "Jumlah Kartu Unik di EDC (distinct_account_count)", f: "distinct_account_count", t: "number", w: true, hint: "Jumlah rekening/kartu unik pada terminal EDC yang sama. Contoh: >= 5 dalam 10 menit.", example: ">= 5" },
      { l: "Ada Sukses Setelah Gagal (has_success_after_failure)", f: "has_success_after_failure", t: "bool", w: true, hint: "Pilih true bila harus ada transaksi sukses setelah rangkaian kegagalan.", op: "==", value: "true" },
      { l: "Processing Code", f: "PROCESSING_CODE", t: "text", w: false, hint: "Kode jenis transaksi ISO 8583. Isi persis seperti data, misalnya 200000 untuk transfer.", op: "==" },
      { l: "Response Code", f: "RESPONSE_CODE", t: "text", w: false, hint: "00 berarti berhasil. Gunakan != 00 untuk mendeteksi transaksi gagal.", example: "!= 00" },
      { l: "Transaksi Malam", f: "IS_NIGHT_TX", t: "number", w: false, hint: "Nilai 1 = transaksi malam, 0 = bukan. Gunakan == 1.", op: "==", value: "1" },
      { l: "Rasio Nominal vs Rata-rata", f: "AMOUNT_OVER_AVG_RATIO", t: "number", w: false, hint: "Nominal transaksi dibanding rata-rata sebelumnya. Contoh: >= 3 berarti tiga kali rata-rata.", example: ">= 3" },
      { l: "Transaksi Ditolak", f: "IS_DECLINED", t: "number", w: false, hint: "Nilai 1 = ditolak, 0 = berhasil. Gunakan == 1.", op: "==", value: "1" },
      { l: "Jeda Transaksi (menit)", f: "GAP_MINUTES", t: "number", w: false, hint: "Jarak dari transaksi sebelumnya dalam menit. Contoh burst: <= 5.", example: "<= 5" },
      { l: "Rekening Tujuan", f: "dest_account_number", t: "text", w: false, hint: "Nomor rekening tujuan transfer. Gunakan == untuk mencocokkan rekening tertentu.", op: "==" },
      { l: "Pindah Terminal Cepat", f: "TERMINAL_SWITCH_FAST", t: "number", w: false, hint: "Nilai 1 = terminal berubah cepat, 0 = tidak. Gunakan == 1.", op: "==", value: "1" },
      { l: "Rantai Decline lalu Burst Sukses", f: "chain_decline_success_burst", t: "bool", w: true, hint: "Pilih true untuk rangkaian transaksi gagal yang diikuti burst transaksi sukses.", op: "==", value: "true" },
    ],
  },
  {
    group: "Metrik Distribusi Invoice & VA (Khusus Nusabill)",
    services: ["NUSABILL"],
    items: [
      { l: "Jumlah Customer Unik Tagihan (distinct_customer_count)", f: "distinct_customer_count", t: "number", w: true, hint: "Jumlah customer tagihan berbeda dalam Time Window. Contoh: >= 20 dalam 5 menit.", example: ">= 20" },
      { l: "Jeda Pembayaran (menit)", f: "PAYMENT_GAP_MINUTES", t: "number", w: false, hint: "Jarak dari pembayaran sebelumnya. Untuk mendeteksi burst, gunakan <= 5.", example: "<= 5" },
      { l: "Rasio Pembayaran vs Tagihan", f: "PAYMENT_TO_BILL_RATIO", t: "number", w: false, hint: "1 = sesuai tagihan; < 0.3 = underpayment; > 4 = overpayment mencurigakan.", example: "< 0.3 atau > 4" },
      { l: "Channel Pembayaran", f: "CHANNEL", t: "text", w: false, hint: "Isi persis sesuai channel transaksi, misalnya API, WEB, MOBILE, atau ATM.", op: "==", example: "== API" },
      { l: "Channel API", f: "CHANNEL_API_FLAG", t: "number", w: false, hint: "Nilai 1 = channel saat ini API, 0 = bukan API. Gunakan == 1.", op: "==", value: "1" },
      { l: "Keterlambatan Pembayaran (hari)", f: "PAYMENT_DELAY_DAYS", t: "number", w: false, hint: "Negatif berarti bayar sebelum tanggal tagihan. Anomali dini: < -1.", example: "< -1" },
      { l: "Pindah Channel ke API", f: "CHANNEL_SWITCH_TO_API", t: "number", w: false, hint: "Nilai 1 bila channel sebelumnya bukan API lalu transaksi sekarang API. Gunakan == 1; >= 0 selalu benar.", op: "==", value: "1" },
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

const PATTERN_CATEGORY_OPTIONS = [
  { value: "VELOCITY", label: "Velocity & Transaksi Berulang" },
  { value: "AMOUNT_ANOMALY", label: "Anomali Nominal" },
  { value: "NETWORK", label: "Network, Merchant & Terminal" },
  { value: "CREDENTIAL", label: "Credential & Account Takeover" },
  { value: "LOCATION_DEVICE", label: "Lokasi & Perangkat" },
  { value: "BEHAVIORAL_TIME", label: "Perilaku & Waktu" },
  { value: "COMPOSITE", label: "Pola Gabungan / Syndicate" },
];

// ─── Komponen Row Kondisi Dinamis ─────────────────────────────────────────────
const CondRow = ({ cond, currentService, onChange, onRemove, showRemove }) => {
  const availableGroups = FIELD_GROUPS.filter((g) =>
    g.services.includes(currentService),
  );
  const meta = ALL_FIELDS_FLAT.find((f) => f.f === cond.field);

  const handleFieldChange = (f) => {
    const newMeta = ALL_FIELDS_FLAT.find((x) => x.f === f);
    onChange({
      ...cond,
      field: f,
      operator: newMeta?.op || ">=",
      value: newMeta?.value ?? (newMeta?.t === "bool" ? "true" : ""),
    });
  };

  return (
    <div className="pfm-cond-row">
      <label className="pfm-cond-control pfm-cond-control--metric">
        <span>Indikator</span>
        <select className="pfm-select" value={cond.field} onChange={(e) => handleFieldChange(e.target.value)}>
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
      </label>

      <label className="pfm-cond-control pfm-cond-control--operator">
        <span>Operator</span>
        <select className="pfm-select pfm-select--op" value={cond.operator} onChange={(e) => onChange({ ...cond, operator: e.target.value })}>
        {OPS.map((op) => (
          <option key={op} value={op}>
            {op}
          </option>
        ))}
        </select>
      </label>

      <label className="pfm-cond-control pfm-cond-control--value">
        <span>Nilai</span>
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
            type={meta?.t === "text" ? "text" : "number"}
            placeholder="Nilai..."
            value={cond.value}
            onChange={(e) => onChange({ ...cond, value: e.target.value })}
          />
        )}
        </div>
      </label>

      {meta && (
        <div className="pfm-cond-help">
          <div className="pfm-cond-meta">
            <span>{meta.w ? "Butuh Time Window" : "Nilai transaksi saat ini"}</span>
            <code>{meta.f}</code>
          </div>
          <p>{meta.hint || "Isi operator dan nilai sesuai indikator yang dipilih."}</p>
          {meta.example && <small>Contoh: <strong>{meta.example}</strong></small>}
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
  onError,
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
          const fallbackMeta = ALL_FIELDS_FLAT.find((item) => item.f === fallbackField);
          return {
            ...c,
            field: fallbackField,
            operator: fallbackMeta?.op || ">=",
            value: fallbackMeta?.value ?? "",
          };
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
      onError?.(err.message || "Gagal menyimpan pattern.");
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
                  Kategori Pattern <span className="pfm-req">*</span>
                </label>
                <select
                  className="pfm-select"
                  value={form.pattern_category}
                  onChange={(e) => set("pattern_category", e.target.value)}
                >
                  <option value="" disabled>
                    Pilih kategori pattern
                  </option>
                  {!PATTERN_CATEGORY_OPTIONS.some(
                    (option) => option.value === form.pattern_category,
                  ) && form.pattern_category && (
                    <option value={form.pattern_category}>
                      Kategori lama: {form.pattern_category}
                    </option>
                  )}
                  {PATTERN_CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <div className="pfm-field-hint">
                  Gunakan kategori standar; detail skenario tetap ditulis pada nama pattern.
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
            <span>Susun Kondisi Pattern ({form.service_source})</span>
          </div>
          <div className="pfm-card">
            <div className="pfm-condition-intro">
              <i className="bi bi-lightbulb" />
              <span>Pilih indikator, operator, lalu nilai. Untuk field bernilai 0/1, gunakan <strong>== 1</strong> agar kondisi tidak selalu terpenuhi.</span>
            </div>
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
