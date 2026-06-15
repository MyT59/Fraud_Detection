import React, { useState, useEffect, useCallback, useRef } from "react";
import "./RuleBuilderModal.css";
import { api } from "../../services/apiService";

// ─── Field definitions per scope (match BE transaction model) ─────────────────
const FLD = {
  ALL: [
    { l: "Nominal transaksi", f: "amount", t: "number" },
    { l: "Waktu transaksi", f: "transaction_time", t: "text" },
    { l: "Alamat IP", f: "ip_address", t: "text" },
    { l: "ID transaksi asli", f: "original_trx_id", t: "text" },
    { l: "ID akun pengguna", f: "user_account_id", t: "text" },
    { l: "Kota asal", f: "city", t: "text" },
    { l: "Negara asal", f: "country", t: "text" },
    { l: "Skor risiko sistem", f: "risk_score", t: "number" },
    { l: "Skor anomali AI", f: "anomaly_score", t: "number" },
    {
      l: "Tingkat risiko",
      f: "risk_level",
      t: "sel",
      o: ["HIGH", "MEDIUM", "LOW"],
    },
  ],
  AGENUSA: [
    { l: "ID terminal / EDC", f: "terminal_id", t: "text" },
    { l: "ID agen / merchant", f: "merchant_id", t: "text" },
    { l: "Nomor rekening asal", f: "account_number", t: "text" },
    {
      l: "Bank penerbit kartu",
      f: "transaction_details.issuer_bank",
      t: "text",
      j: true,
    },
    {
      l: "Nomor rekening tujuan",
      f: "transaction_details.dest_account_number",
      t: "text",
      j: true,
    },
    {
      l: "Kode respons bank",
      f: "transaction_details.response_code",
      t: "text",
      j: true,
    },
    {
      l: "Kode proses finansial",
      f: "transaction_details.processing_code",
      t: "text",
      j: true,
    },
    { l: "Nomor urut STAN", f: "transaction_details.stan", t: "text", j: true },
    { l: "Tipe pesan MTI", f: "transaction_details.mti", t: "text", j: true },
    {
      l: "Kode bank tujuan",
      f: "transaction_details.dest_bank_code",
      t: "text",
      j: true,
    },
    {
      l: "Kode acquirer",
      f: "transaction_details.acquirer_code",
      t: "text",
      j: true,
    },
  ],
  NUSABILL: [
    { l: "Kode pembayaran / merchant", f: "merchant_id", t: "text" },
    {
      l: "Nama pelanggan",
      f: "transaction_details.nama_customer",
      t: "text",
      j: true,
    },
    {
      l: "Metode pembayaran (SOF)",
      f: "transaction_details.sof",
      t: "text",
      j: true,
    },
    {
      l: "Jalur transaksi (channel)",
      f: "transaction_details.channel",
      t: "text",
      j: true,
    },
    {
      l: "Total nominal tagihan",
      f: "transaction_details.bill_amount",
      t: "number",
      j: true,
    },
    {
      l: "Nominal yang dibayarkan",
      f: "transaction_details.payment_amount",
      t: "number",
      j: true,
    },
    {
      l: "Biaya administrasi",
      f: "transaction_details.biaya_admin",
      t: "number",
      j: true,
    },
    {
      l: "Status tagihan",
      f: "transaction_details.bill_status",
      t: "text",
      j: true,
    },
    {
      l: "Keterangan tagihan",
      f: "transaction_details.keterangan",
      t: "text",
      j: true,
    },
  ],
};

const OPS = ["=", "!=", ">", "<", ">=", "<="];

const RULE_GROUPS = [
  "VELOCITY",
  "AMOUNT_LIMIT",
  "LOCATION_CHECK",
  "TIME_PATTERN",
  "DEVICE_CHECK",
];

function getFields(scope) {
  const base = [...FLD.ALL];
  if (scope === "AGENUSA") return [...base, ...FLD.AGENUSA];
  if (scope === "NUSABILL") return [...base, ...FLD.NUSABILL];
  return base;
}

function fieldMeta(f, scope) {
  return getFields(scope).find((x) => x.f === f);
}

// ─── Condition Row ────────────────────────────────────────────────────────────
const ConditionRow = ({ cond, scope, onChange, onRemove, showRemove }) => {
  const fields = getFields(scope);
  const meta = fieldMeta(cond.field, scope);
  const isJsonb = meta?.j;

  const setField = (f) => {
    const newMeta = fieldMeta(f, scope);
    onChange({
      ...cond,
      field: f,
      value: newMeta?.t === "sel" ? newMeta.o[0] || "" : "",
    });
  };

  return (
    <div className="rbm-cond-wrap">
      <div className="rbm-cond-row">
        <select
          className="rbm-select"
          value={cond.field}
          onChange={(e) => setField(e.target.value)}
        >
          {fields.map((f) => (
            <option key={f.f} value={f.f}>
              {f.l}
              {f.j ? " ↳" : ""}
            </option>
          ))}
        </select>

        <select
          className="rbm-select rbm-select--op"
          value={cond.operator}
          onChange={(e) => onChange({ ...cond, operator: e.target.value })}
        >
          {OPS.map((op) => (
            <option key={op} value={op}>
              {op}
            </option>
          ))}
        </select>

        <div className="rbm-val-wrap">
          {meta?.t === "sel" ? (
            <select
              className="rbm-select"
              value={cond.value}
              onChange={(e) => onChange({ ...cond, value: e.target.value })}
            >
              {meta.o.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="rbm-input"
              type={meta?.t === "number" ? "number" : "text"}
              placeholder="nilai..."
              value={cond.value}
              onChange={(e) => {
                const v =
                  meta?.t === "number" ? e.target.value : e.target.value;
                onChange({ ...cond, value: v });
              }}
            />
          )}
        </div>

        {showRemove && (
          <button
            className="rbm-remove-btn"
            onClick={onRemove}
            title="Hapus kondisi"
          >
            <i className="bi bi-x" />
          </button>
        )}
      </div>
      {isJsonb && (
        <div className="rbm-jsonb-badge">
          <i className="bi bi-check2" /> JSONB — dot-notation traversal aktif
        </div>
      )}
    </div>
  );
};

// ─── Condition Group (recursive) ─────────────────────────────────────────────
const ConditionGroup = ({ group, scope, onChange, onRemove, depth = 1 }) => {
  const logic = group.AND ? "AND" : "OR";
  const items = group[logic] || [];

  const setLogic = (l) => {
    const current = group[logic];
    onChange({ [l]: current });
  };

  const updateItem = (i, val) => {
    const next = [...items];
    next[i] = val;
    onChange({ [logic]: next });
  };

  const removeItem = (i) => {
    const next = items.filter((_, idx) => idx !== i);
    onChange({ [logic]: next });
  };

  const addCondition = () => {
    const firstField = getFields(scope)[0].f;
    onChange({
      [logic]: [...items, { field: firstField, operator: "=", value: "" }],
    });
  };

  const addNestedGroup = () => {
    const firstField = getFields(scope)[0].f;
    onChange({
      [logic]: [
        ...items,
        { AND: [{ field: firstField, operator: "=", value: "" }] },
      ],
    });
  };

  return (
    <div className={`rbm-group rbm-group--d${depth}`}>
      <div className="rbm-group-header">
        <div className="rbm-logic-toggle">
          <button
            className={`rbm-logic-btn ${logic === "AND" ? "rbm-logic-btn--and active" : ""}`}
            onClick={() => setLogic("AND")}
          >
            AND
          </button>
          <button
            className={`rbm-logic-btn ${logic === "OR" ? "rbm-logic-btn--or active" : ""}`}
            onClick={() => setLogic("OR")}
          >
            OR
          </button>
        </div>
        <span className="rbm-group-label">
          {depth === 1 ? "Root ConditionGroup" : "Nested group"}
        </span>
        {onRemove && (
          <button
            className="rbm-remove-btn rbm-remove-btn--group"
            onClick={onRemove}
            title="Hapus grup"
          >
            <i className="bi bi-x" />
          </button>
        )}
      </div>

      <div className="rbm-group-items">
        {items.map((item, i) => {
          const isGroup = "AND" in item || "OR" in item;
          return isGroup ? (
            <ConditionGroup
              key={i}
              group={item}
              scope={scope}
              depth={depth + 1}
              onChange={(val) => updateItem(i, val)}
              onRemove={() => removeItem(i)}
            />
          ) : (
            <ConditionRow
              key={i}
              cond={item}
              scope={scope}
              onChange={(val) => updateItem(i, val)}
              onRemove={() => removeItem(i)}
              showRemove={items.length > 1}
            />
          );
        })}
      </div>

      <div className="rbm-group-actions">
        <button className="rbm-add-btn" onClick={addCondition}>
          <i className="bi bi-plus" /> Kondisi
        </button>
        {depth < 2 && (
          <button className="rbm-add-btn" onClick={addNestedGroup}>
            <i className="bi bi-diagram-2" /> Grup bersarang
          </button>
        )}
      </div>
    </div>
  );
};

// ─── Main Modal ───────────────────────────────────────────────────────────────
const EMPTY_FORM = {
  rule_name: "",
  rule_key: "",
  service_scope: "ALL",
  rule_group: "",
  action: "REVIEW",
  severity: "HIGH",
  priority: 0,
  description: "",
};

const RuleBuilderModal = ({
  isOpen,
  onClose,
  onSuccess,
  onUpdate,
  editData,
}) => {
  const isEdit = Boolean(editData);
  const [form, setForm] = useState(EMPTY_FORM);
  const [mode, setMode] = useState("simple");
  const [simpleConditions, setSimpleConditions] = useState([
    { field: "amount", operator: ">=", value: "" },
  ]);
  const [advancedGroup, setAdvancedGroup] = useState({
    AND: [{ field: "amount", operator: ">=", value: "" }],
  });
  const [showPreview, setShowPreview] = useState(false);
  const [keyError, setKeyError] = useState(false);
  const [keyErrorMsg, setKeyErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const nameRef = useRef();

  useEffect(() => {
    if (isOpen) {
      setShowPreview(false);
      setKeyError(false);
      setLoading(false);
      setShowBlockConfirm(false);

      if (isEdit && editData) {
        // Populate form dari editData
        setForm({
          rule_name: editData.name || "",
          rule_key: editData.rule_key || "",
          service_scope: editData.service_scope || "ALL",
          rule_group: editData.rule_group || "",
          action: (editData.action || "review").toUpperCase(),
          severity: editData.severity || "MEDIUM",
          priority: editData.priority ?? 0,
          description: editData.description || "",
        });

        // Populate kondisi dari rule_config atau condition_field
        const cfg = editData.rule_config;
        if (cfg && (cfg.AND || cfg.OR || cfg.field)) {
          // Builder rule — pakai advanced mode
          if (cfg.field) {
            // Single leaf — wrap ke simple
            setMode("simple");
            setSimpleConditions([
              {
                field: cfg.field,
                operator: cfg.operator || "=",
                value: String(cfg.value ?? ""),
              },
            ]);
          } else {
            setMode("advanced");
            setAdvancedGroup(cfg);
          }
        } else if (editData.condField) {
          // Simple rule
          setMode("simple");
          setSimpleConditions([
            {
              field: editData.condField,
              operator: editData.condOp || "=",
              value: String(editData.condValue ?? ""),
            },
          ]);
        } else {
          setMode("simple");
          setSimpleConditions([{ field: "amount", operator: ">=", value: "" }]);
        }
      } else {
        setForm(EMPTY_FORM);
        setMode("simple");
        setSimpleConditions([{ field: "amount", operator: ">=", value: "" }]);
        setAdvancedGroup({
          AND: [{ field: "amount", operator: ">=", value: "" }],
        });
      }

      setTimeout(() => nameRef.current?.focus(), 50);
    }
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

  const set = (k, v) => {
    setForm((p) => ({ ...p, [k]: v }));
    if (k === "rule_name" || k === "rule_key") setKeyError(false);
  };

  // Auto-generate rule_key dari rule_name
  const handleNameChange = (v) => {
    const key = v
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
    setForm((p) => ({ ...p, rule_name: v, rule_key: key }));
    setKeyError(false);
  };

  const handleKeyChange = (v) => {
    const clean = v.toLowerCase().replace(/[^a-z0-9_]/g, "");
    set("rule_key", clean);
  };

  // Check apakah semua kondisi terisi
  const conditionsValid = useCallback(() => {
    if (mode === "simple") {
      return (
        simpleConditions.length > 0 &&
        simpleConditions.every(
          (c) => c.field && c.operator && String(c.value).trim() !== "",
        )
      );
    }
    const checkGroup = (g) => {
      const logic = g.AND ? "AND" : "OR";
      const items = g[logic] || [];
      if (!items.length) return false;
      return items.every((item) =>
        "AND" in item || "OR" in item
          ? checkGroup(item)
          : item.field && item.operator && String(item.value).trim() !== "",
      );
    };
    return checkGroup(advancedGroup);
  }, [mode, simpleConditions, advancedGroup]);

  const isValid =
    form.rule_name.trim() &&
    form.rule_key.trim() &&
    conditionsValid() &&
    !keyError;

  // Build rule_config payload
  const buildRuleConfig = () => {
    if (mode === "simple") {
      if (simpleConditions.length === 1) {
        const c = simpleConditions[0];
        const meta = fieldMeta(c.field, form.service_scope);
        return {
          field: c.field,
          operator: c.operator,
          value:
            meta?.t === "number" && c.value !== "" && !isNaN(c.value)
              ? parseFloat(c.value)
              : c.value,
        };
      }
      return {
        AND: simpleConditions.map((c) => {
          const meta = fieldMeta(c.field, form.service_scope);
          return {
            field: c.field,
            operator: c.operator,
            value:
              meta?.t === "number" && c.value !== "" && !isNaN(c.value)
                ? parseFloat(c.value)
                : c.value,
          };
        }),
      };
    }
    return advancedGroup;
  };

  const buildPayload = () => {
    const p = {
      rule_name: form.rule_name,
      rule_key: form.rule_key,
      service_scope: form.service_scope,
      rule_config: buildRuleConfig(),
      action: form.action,
      severity: form.severity,
      priority: parseInt(form.priority) || 0,
    };
    if (form.rule_group.trim()) p.rule_group = form.rule_group.trim();
    if (form.description.trim()) p.description = form.description.trim();
    return p;
  };

  const hasDotFields = () => {
    const fields =
      mode === "simple"
        ? simpleConditions.map((c) => c.field)
        : (() => {
            const collect = (g) => {
              const logic = g.AND ? "AND" : "OR";
              return (g[logic] || []).flatMap((item) =>
                "AND" in item || "OR" in item ? collect(item) : [item.field],
              );
            };
            return collect(advancedGroup);
          })();
    return fields.filter((f) => fieldMeta(f, form.service_scope)?.j);
  };

  const dotFields = hasDotFields();

  const execSave = async () => {
    const p = buildPayload();
    setLoading(true);
    try {
      if (isEdit) {
        // UPDATE — pakai PUT /rules/{id}, tidak kirim rule_key
        const { rule_key, ...updatePayload } = p;
        const json = await api.put(`/rules/${editData.id}`, {
          rule_name: updatePayload.rule_name,
          service_scope: updatePayload.service_scope,
          action: updatePayload.action,
          severity: updatePayload.severity,
          priority: updatePayload.priority,
          rule_group: updatePayload.rule_group,
          description: updatePayload.description,
          rule_config: updatePayload.rule_config,
        });
        setLoading(false);
        onUpdate?.({ ...p, ...json, id: editData.id });
        onClose();
      } else {
        // CREATE — call BE POST /rules/builder
        const json = await api.post("/rules/builder", p);
        setLoading(false);
        onSuccess?.({ ...p, ...json });
        onClose();
      }
    } catch {
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

  return (
    <div
      className="rbm-overlay"
      onClick={(e) =>
        e.target === e.currentTarget && !showBlockConfirm && onClose()
      }
    >
      <div className="rbm-box">
        {/* Header */}
        <div className="rbm-header">
          <div className="rbm-header-left">
            <div className="rbm-header-icon">
              <i className="bi bi-diagram-3-fill" />
            </div>
            <div>
              <div className="rbm-header-title">
                {isEdit ? "Edit Rule" : "Rule Builder"}
              </div>
              <div className="rbm-header-sub">
                {isEdit
                  ? `Edit aturan: ${editData?.name || ""}`
                  : "Buat aturan deteksi fraud dengan kondisi bertingkat"}
              </div>
            </div>
          </div>
          <button className="rbm-close" onClick={onClose}>
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <div className="rbm-body">
          {/* Section 1 — Identitas */}
          <div className="rbm-section-head">
            <div className="rbm-step-badge">1</div>
            <span>Identitas &amp; ruang lingkup aturan</span>
          </div>
          <div className="rbm-card">
            <div className="rbm-grid">
              <div className="rbm-field rbm-field--full">
                <label className="rbm-label">
                  Nama aturan <span className="rbm-req">*</span>
                </label>
                <input
                  ref={nameRef}
                  className="rbm-input"
                  type="text"
                  placeholder="Contoh: Penarikan tunai besar di jam larut malam"
                  value={form.rule_name}
                  onChange={(e) => handleNameChange(e.target.value)}
                />
              </div>

              <div className="rbm-field rbm-field--full">
                <label className="rbm-label">
                  Kode aturan {!isEdit && <span className="rbm-req">*</span>}
                  <span className="rbm-label-meta">
                    (rule_key — unik, max 100 karakter)
                  </span>
                </label>
                <input
                  className={`rbm-input rbm-mono ${keyError ? "rbm-input--err" : ""} ${isEdit ? "rbm-input--disabled" : ""}`}
                  type="text"
                  placeholder="high_cashout_agenusa_night"
                  value={form.rule_key}
                  disabled={isEdit}
                  onChange={(e) => handleKeyChange(e.target.value)}
                />
                {isEdit ? (
                  <div className="rbm-field-hint">
                    Rule key tidak dapat diubah setelah dibuat.
                  </div>
                ) : keyError ? (
                  <div className="rbm-field-err">
                    <i className="bi bi-exclamation-circle-fill" />{" "}
                    {keyErrorMsg}
                  </div>
                ) : (
                  <div className="rbm-field-hint">
                    Hanya huruf kecil, angka, dan garis bawah. Unik di tabel{" "}
                    <code>global_rules</code>.
                  </div>
                )}
              </div>

              <div className="rbm-field">
                <label className="rbm-label">Cakupan layanan</label>
                <select
                  className="rbm-select rbm-select--full"
                  value={form.service_scope}
                  onChange={(e) => set("service_scope", e.target.value)}
                >
                  <option value="ALL">ALL — universal</option>
                  <option value="AGENUSA">AGENUSA — Mini ATM &amp; EDC</option>
                  <option value="NUSABILL">NUSABILL — Tagihan &amp; VA</option>
                </select>
                <div className="rbm-field-hint">
                  Sesuai <code>ServiceScopeEnum</code> &amp; filter{" "}
                  <code>service_source</code> di engine.
                </div>
              </div>

              <div className="rbm-field">
                <label className="rbm-label">Grup aturan</label>
                <div className="rbm-select-wrap">
                  <select
                    className="rbm-select"
                    style={{ width: "100%" }}
                    value={form.rule_group}
                    onChange={(e) => set("rule_group", e.target.value)}
                  >
                    <option value="">— Pilih grup —</option>
                    {RULE_GROUPS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="rbm-field-hint">
                  Dipakai <code>seen_groups</code> di engine untuk cegah alarm
                  beruntun.
                </div>
              </div>
            </div>
          </div>

          {/* Section 2 — Kondisi */}
          <div className="rbm-section-head">
            <div className="rbm-step-badge">2</div>
            <span>Penyusun kondisi risiko</span>
          </div>
          <div className="rbm-card">
            {dotFields.length > 0 && (
              <div className="rbm-jsonb-banner">
                <i className="bi bi-check-circle-fill" />
                <div>
                  Field{" "}
                  <strong>
                    {dotFields.map((f) => (
                      <code key={f}>{f}</code>
                    ))}
                  </strong>{" "}
                  membaca JSONB nested — dot-notation traversal sudah aktif di
                  engine.
                </div>
              </div>
            )}

            <div className="rbm-mode-tabs">
              <button
                className={`rbm-mode-tab ${mode === "simple" ? "active" : ""}`}
                onClick={() => setMode("simple")}
              >
                <i className="bi bi-lightning-fill" /> Simple rule
              </button>
              <button
                className={`rbm-mode-tab ${mode === "advanced" ? "active" : ""}`}
                onClick={() => setMode("advanced")}
              >
                <i className="bi bi-diagram-2" /> Advanced builder
              </button>
            </div>

            {mode === "simple" && (
              <div>
                {simpleConditions.map((cond, i) => (
                  <ConditionRow
                    key={i}
                    cond={cond}
                    scope={form.service_scope}
                    onChange={(val) => {
                      const next = [...simpleConditions];
                      next[i] = val;
                      setSimpleConditions(next);
                    }}
                    onRemove={() =>
                      setSimpleConditions((p) =>
                        p.filter((_, idx) => idx !== i),
                      )
                    }
                    showRemove={simpleConditions.length > 1}
                  />
                ))}
                <div className="rbm-simple-footer">
                  <button
                    className="rbm-add-btn"
                    onClick={() =>
                      setSimpleConditions((p) => [
                        ...p,
                        {
                          field: getFields(form.service_scope)[0].f,
                          operator: "=",
                          value: "",
                        },
                      ])
                    }
                  >
                    <i className="bi bi-plus" /> Kondisi
                  </button>
                  <span className="rbm-field-hint">
                    Beberapa kondisi otomatis digabung <code>AND</code> — selalu
                    valid sebagai <code>ConditionGroup</code>.
                  </span>
                </div>
              </div>
            )}

            {mode === "advanced" && (
              <ConditionGroup
                group={advancedGroup}
                scope={form.service_scope}
                onChange={setAdvancedGroup}
                depth={1}
              />
            )}
          </div>

          {/* Section 3 — Konsekuensi */}
          <div className="rbm-section-head">
            <div className="rbm-step-badge">3</div>
            <span>Konsekuensi &amp; mitigasi risiko</span>
          </div>
          <div className="rbm-card">
            <div className="rbm-grid">
              <div className="rbm-field rbm-field--full">
                <label className="rbm-label">
                  Tindakan mitigasi{" "}
                  <span className="rbm-label-meta">(RuleActionEnum)</span>
                </label>
                <div className="rbm-action-grid">
                  {[
                    {
                      v: "BLOCK",
                      icon: "bi-ban",
                      label: "BLOCK",
                      desc: "Tolak transaksi otomatis",
                    },
                    {
                      v: "REVIEW",
                      icon: "bi-eye",
                      label: "REVIEW",
                      desc: "Kirim ke Manual Review",
                    },
                    {
                      v: "FLAG",
                      icon: "bi-flag-fill",
                      label: "FLAG",
                      desc: "Tandai mencurigakan",
                    },
                  ].map((a) => (
                    <button
                      key={a.v}
                      className={`rbm-action-card rbm-action-card--${a.v.toLowerCase()} ${form.action === a.v ? "active" : ""}`}
                      onClick={() => set("action", a.v)}
                    >
                      <i className={`bi ${a.icon}`} />
                      <span className="rbm-action-label">{a.label}</span>
                      <span className="rbm-action-desc">{a.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rbm-field rbm-field--full">
                <label className="rbm-label">
                  Tingkat keparahan{" "}
                  <span className="rbm-label-meta">(RuleSeverityEnum)</span>
                </label>
                <div className="rbm-severity-grid">
                  {[
                    { v: "CRITICAL", color: "#dc2626", score: "52" },
                    { v: "HIGH", color: "#d97706", score: "28" },
                    { v: "MEDIUM", color: "#2563eb", score: "16" },
                    { v: "LOW", color: "#16a34a", score: "6" },
                  ].map((s) => (
                    <button
                      key={s.v}
                      className={`rbm-sev-card rbm-sev-card--${s.v.toLowerCase()} ${form.severity === s.v ? "active" : ""}`}
                      onClick={() => set("severity", s.v)}
                    >
                      <div
                        className="rbm-sev-dot"
                        style={{ background: s.color }}
                      />
                      <span>{s.v}</span>
                      <span className="rbm-sev-score">+{s.score} poin</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rbm-field">
                <label className="rbm-label">
                  Prioritas eksekusi{" "}
                  <span className="rbm-label-meta">(Integer, default 0)</span>
                </label>
                <div className="rbm-priority-row">
                  <input
                    className="rbm-input"
                    type="number"
                    min={0}
                    max={9999}
                    value={form.priority}
                    onChange={(e) =>
                      set(
                        "priority",
                        Math.max(0, parseInt(e.target.value) || 0),
                      )
                    }
                  />
                  <div className="rbm-priority-pills">
                    <button
                      className="rbm-priority-pill pp-high"
                      onClick={() => set("priority", 100)}
                    >
                      Tinggi · 100
                    </button>
                    <button
                      className="rbm-priority-pill pp-medium"
                      onClick={() => set("priority", 50)}
                    >
                      Sedang · 50
                    </button>
                    <button
                      className="rbm-priority-pill pp-low"
                      onClick={() => set("priority", 10)}
                    >
                      Rendah · 10
                    </button>
                  </div>
                </div>
                <div className="rbm-field-hint">
                  Nilai lebih tinggi dieksekusi lebih awal —{" "}
                  <code>order_by(priority.desc())</code>
                </div>
              </div>

              <div className="rbm-field rbm-field--full">
                <label className="rbm-label">
                  Deskripsi aturan{" "}
                  <span className="rbm-label-meta">(Text, opsional)</span>
                </label>
                <textarea
                  className="rbm-textarea"
                  placeholder="Jelaskan konteks dan tujuan aturan ini untuk analis lain..."
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Preview JSON */}
          {showPreview && (
            <div className="rbm-preview-wrap">
              <label className="rbm-label">
                Preview payload → <code>POST /rules/builder</code>
              </label>
              <pre className="rbm-preview-json">
                {JSON.stringify(buildPayload(), null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="rbm-footer">
          <button
            className="rbm-btn-cancel"
            onClick={onClose}
            disabled={loading}
          >
            Batal
          </button>
          <div className="rbm-footer-right">
            <button
              className="rbm-btn-preview"
              onClick={() => setShowPreview((p) => !p)}
            >
              <i className="bi bi-code-slash" />{" "}
              {showPreview ? "Tutup" : "Preview JSON"}
            </button>
            <button
              className={`rbm-btn-save ${form.action === "BLOCK" ? "rbm-btn-save--block" : ""} ${loading ? "rbm-btn-save--loading" : ""}`}
              disabled={!isValid || loading}
              onClick={handleSave}
            >
              {!loading && (
                <i className={`bi ${isEdit ? "bi-check-lg" : "bi-floppy"}`} />
              )}
              {loading
                ? "Menyimpan..."
                : isEdit
                  ? "Simpan Perubahan"
                  : "Simpan aturan"}
            </button>
          </div>
        </div>

        {/* Block confirm overlay */}
        {showBlockConfirm && (
          <div className="rbm-confirm-overlay">
            <div className="rbm-confirm-box">
              <div className="rbm-confirm-icon">
                <i className="bi bi-exclamation-triangle-fill" />
              </div>
              <h3 className="rbm-confirm-title">Konfirmasi tindakan BLOCK</h3>
              <p className="rbm-confirm-msg">
                Aturan <strong>BLOCK</strong> menggagalkan transaksi secara
                real-time. BLOCK rule dieksekusi engine lalu langsung{" "}
                <code>return</code> — rules sesudahnya tidak dievaluasi.
                Pastikan kondisi sudah benar sebelum menyimpan.
              </p>
              <div className="rbm-confirm-actions">
                <button
                  className="rbm-btn-cancel"
                  onClick={() => setShowBlockConfirm(false)}
                >
                  Cek ulang dulu
                </button>
                <button
                  className="rbm-btn-save rbm-btn-save--block"
                  onClick={() => {
                    setShowBlockConfirm(false);
                    execSave();
                  }}
                >
                  <i className="bi bi-ban" /> Ya, simpan BLOCK rule
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RuleBuilderModal;
