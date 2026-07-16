import React, { useState, useEffect, useCallback, useRef } from "react";
import "./RuleBuilderModal.css";
import { api } from "../../services/apiService";

const FLD = {
  ALL: [
    { l: "Nominal transaksi", f: "amount", t: "number", d: "Amount" },
    {
      l: "Waktu transaksi",
      f: "transaction_time",
      t: "text",
      d: "Transaction Timestamp",
    },
    { l: "Alamat IP", f: "ip_address", t: "text", d: "IP Address" },
    { l: "Kota asal", f: "city", t: "text", d: "GeoIP City" },
    { l: "Negara asal", f: "country", t: "text", d: "GeoIP Country" },
    { l: "Skor risiko sistem", f: "risk_score", t: "number", d: "Risk Score" },
    { l: "Skor anomali AI", f: "anomaly_score", t: "number", d: "ML Anomaly Score" },
    {
      l: "Tingkat risiko",
      f: "risk_level",
      t: "sel",
      o: ["HIGH", "MEDIUM", "LOW"],
      d: "Risk Level",
    },
  ],
  AGENUSA: [
    { l: "ID agen / merchant", f: "merchant_id", t: "text", d: "Merchant ID" },
    { l: "ID terminal / EDC", f: "terminal_id", t: "text", d: "Terminal ID" },
    { l: "Nomor rekening asal", f: "account_number", t: "text", d: "Source Account" },
    {
      l: "Bank penerbit kartu",
      f: "transaction_details.issuer_bank",
      t: "text",
      j: true,
      d: "Issuer Bank",
    },
    {
      l: "Nomor rekening penerbit",
      f: "transaction_details.issuer_account_number",
      t: "text",
      j: true,
      d: "Issuer Account",
    },
    {
      l: "Nomor rekening tujuan",
      f: "transaction_details.dest_account_number",
      t: "text",
      j: true,
      d: "Destination Account",
    },
  ],
  NUSABILL: [
    { l: "Kode pembayaran / merchant", f: "merchant_id", t: "text", d: "Payment/Merchant Code" },
    {
      l: "Metode pembayaran (SOF)",
      f: "transaction_details.sof",
      t: "text",
      j: true,
      d: "Source of Fund",
    },
    {
      l: "Jalur transaksi (channel)",
      f: "transaction_details.channel",
      t: "text",
      j: true,
      d: "Transaction Channel",
    },
    {
      l: "Total nominal tagihan",
      f: "transaction_details.bill_amount",
      t: "number",
      j: true,
      d: "Bill Amount",
    },
    {
      l: "Nominal yang dibayarkan",
      f: "transaction_details.payment_amount",
      t: "number",
      j: true,
      d: "Payment Amount",
    },
    {
      l: "Biaya administrasi",
      f: "transaction_details.biaya_admin",
      t: "number",
      j: true,
      d: "Admin Fee",
    },
    {
      l: "Status tagihan",
      f: "transaction_details.bill_status",
      t: "sel",
      o: ["terbayar", "belum_terbayar", "gagal", "pending"],
      j: true,
      d: "Bill Status",
    },
  ],
};

const OPS = ["=", "!=", ">", "<", ">=", "<="];

const RULE_GROUPS_BY_SCOPE = {
  ALL: [
    "AMOUNT_LIMIT",
    "LOCATION_CHECK",
    "TIME_PATTERN",
    "IP_RISK",
    "RISK_SCORE",
  ],
  AGENUSA: [
    "AGENUSA_AMOUNT_LIMIT",
    "AGENUSA_TERMINAL_RISK",
    "AGENUSA_MERCHANT_RISK",
    "AGENUSA_ACCOUNT_RISK",
    "AGENUSA_BANK_RISK",
  ],
  NUSABILL: [
    "NUSABILL_BILL_AMOUNT",
    "NUSABILL_PAYMENT_MISMATCH",
    "NUSABILL_CHANNEL_RISK",
    "NUSABILL_SOF_RISK",
    "NUSABILL_BILL_STATUS",
  ],
};

// Sentinel value for "custom input" option
const CUSTOM_VALUE = "__CUSTOM__";

function getFields(scope) {
  const base = [...FLD.ALL];
  if (scope === "AGENUSA") return [...base, ...FLD.AGENUSA];
  if (scope === "NUSABILL") return [...base, ...FLD.NUSABILL];
  return base;
}

function getRuleGroups(scope) {
  return RULE_GROUPS_BY_SCOPE[scope] || RULE_GROUPS_BY_SCOPE.ALL;
}

function fieldMeta(f, scope) {
  return getFields(scope).find((x) => x.f === f);
}

const getTimestampHint = (field) => {
  if (field === "transaction_time") {
    return "Isi waktu transaksi. Bisa jam saja, tapi lebih jelas bila pakai tanggal dan jam, mis. 14:32 atau 2026-07-06 14:32.";
  }
  return null;
};

function smartParseValue(raw) {
  if (typeof raw !== "string") return raw;
  const trimmed = raw.trim();
  if (trimmed.toLowerCase() === "true") return true;
  if (trimmed.toLowerCase() === "false") return false;
  if (trimmed !== "" && !isNaN(trimmed)) return Number(trimmed);
  return raw;
}

const Combobox = ({ options, value, onChange, placeholder, className }) => {
  const isCustom = value !== "" && !options.includes(value);
  const [mode, setMode] = useState(isCustom ? "custom" : "select");
  const inputRef = useRef();

  // When a parent resets value to empty or a known option, sync mode
  useEffect(() => {
    if (value === "" || options.includes(value)) {
      setMode("select");
    }
  }, [value, options]);

  const handleSelectChange = (e) => {
    const v = e.target.value;
    if (v === CUSTOM_VALUE) {
      setMode("custom");
      onChange("");
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setMode("select");
      onChange(v);
    }
  };

  const handleBackToSelect = () => {
    setMode("select");
    onChange("");
  };

  if (mode === "custom") {
    return (
      <div className="rbm-combobox-custom">
        <input
          ref={inputRef}
          className={`rbm-input ${className || ""}`}
          placeholder={placeholder || "Ketik nilai kustom..."}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          className="rbm-combobox-back"
          onClick={handleBackToSelect}
          title="Kembali ke daftar"
          type="button"
        >
          <i className="bi bi-arrow-left-short" />
        </button>
      </div>
    );
  }

  return (
    <div className="rbm-select-wrap">
      <select
        className={`rbm-select ${className || ""}`}
        value={isCustom ? CUSTOM_VALUE : value}
        onChange={handleSelectChange}
        style={{ width: "100%" }}
      >
        <option value="">-- Pilih --</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
        <option value={CUSTOM_VALUE}>Kustom Baru...</option>
      </select>
    </div>
  );
};

const FieldCombobox = ({ fields, value, onChange, scope }) => {
  const knownField = fields.find((f) => f.f === value);
  const isCustom = !knownField && value !== "";
  const [mode, setMode] = useState(isCustom ? "custom" : "select");
  const inputRef = useRef();

  useEffect(() => {
    const found = fields.find((f) => f.f === value);
    if (found || value === "") setMode("select");
  }, [value, fields]);

  const handleSelectChange = (e) => {
    const v = e.target.value;
    if (v === CUSTOM_VALUE) {
      setMode("custom");
      onChange("");
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setMode("select");
      onChange(v);
    }
  };

  if (mode === "custom") {
    return (
      <div className="rbm-combobox-custom">
        <input
          ref={inputRef}
          className="rbm-input rbm-mono"
          placeholder="e.g. transaction_details.custom_key"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          className="rbm-combobox-back"
          onClick={() => {
            setMode("select");
            onChange("");
          }}
          title="Kembali ke daftar"
          type="button"
        >
          <i className="bi bi-arrow-left-short" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="rbm-select-wrap">
        <select
          className="rbm-select"
          value={isCustom ? CUSTOM_VALUE : value}
          onChange={handleSelectChange}
        >
          {fields.map((f) => (
            <option key={f.f} value={f.f}>
              {f.l} - {f.d || f.f}
            </option>
          ))}
          <option value={CUSTOM_VALUE}>Field dot-notation kustom...</option>
        </select>
      </div>
      {knownField && (
        <div className="rbm-field-path">
          <span>{knownField.d || knownField.l}</span>
          <code>{knownField.f}</code>
        </div>
      )}
    </div>
  );
};

const ConditionRow = ({
  cond,
  scope,
  onChange,
  onRemove,
  showRemove,
  index,
  logicOp,
}) => {
  const fields = getFields(scope);
  const meta = fieldMeta(cond.field, scope);
  const effectiveMeta = meta || (cond.field ? { t: "text" } : null);
  const isJsonb = meta?.j || (cond.field && cond.field.includes("."));
  const timestampHint = getTimestampHint(cond.field);

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
      {/* Logic operator badge between rows */}
      {index > 0 && logicOp && (
        <div className="rbm-cond-logic-badge rbm-cond-logic-badge--between">
          <span
            className={`rbm-logic-badge-pill rbm-logic-badge-pill--${logicOp.toLowerCase()}`}
          >
            {logicOp}
          </span>
        </div>
      )}
      <div className="rbm-cond-row">
        <FieldCombobox
          fields={fields}
          value={cond.field}
          onChange={setField}
          scope={scope}
        />

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
          {effectiveMeta?.t === "sel" ? (
            <select
              className="rbm-select"
              value={cond.value}
              onChange={(e) => onChange({ ...cond, value: e.target.value })}
            >
              {effectiveMeta.o.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="rbm-input"
              type="text"
              placeholder={
                effectiveMeta?.t === "number" ? "angka..." : "nilai..."
              }
              value={cond.value}
              onChange={(e) => onChange({ ...cond, value: e.target.value })}
            />
          )}
          {timestampHint && (
            <div
              style={{
                marginTop: 6,
                fontSize: ".72rem",
                color: "#6b7280",
                lineHeight: 1.4,
              }}
            >
              <i className="bi bi-info-circle" /> {timestampHint}
            </div>
          )}
        </div>

        {showRemove && (
          <button
            className="rbm-remove-btn"
            onClick={onRemove}
            title="Hapus kondisi"
            type="button"
          >
            <i className="bi bi-x" />
          </button>
        )}
      </div>
      {isJsonb && (
        <div className="rbm-jsonb-badge">
          <i className="bi bi-check2" /> JSONB - dot-notation traversal aktif
        </div>
      )}
    </div>
  );
};

const ConditionGroup = ({ group, scope, onChange, onRemove, depth = 1 }) => {
  const logic = group.AND ? "AND" : "OR";
  const items = group[logic] || [];

  const setLogic = (l) => {
    onChange({ [l]: group[logic] });
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
            type="button"
          >
            AND
          </button>
          <button
            className={`rbm-logic-btn ${logic === "OR" ? "rbm-logic-btn--or active" : ""}`}
            onClick={() => setLogic("OR")}
            type="button"
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
            type="button"
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
              index={i}
              logicOp={logic}
            />
          );
        })}
      </div>

      <div className="rbm-group-actions">
        <button className="rbm-add-btn" onClick={addCondition} type="button">
          <i className="bi bi-plus" /> Kondisi
        </button>
        {depth < 2 && (
          <button
            className="rbm-add-btn"
            onClick={addNestedGroup}
            type="button"
          >
            <i className="bi bi-diagram-2" /> Grup bersarang
          </button>
        )}
      </div>
    </div>
  );
};

const EMPTY_FORM = {
  rule_name: "",
  rule_key: "",
  service_scope: "ALL",
  rule_group: "",
  action: "FLAG",
  severity: "HIGH",
  priority: 0,
  description: "",
};

const normalizeMitigationAction = (action) => {
  const normalized = String(action || "FLAG").toUpperCase();
  return normalized === "BLOCK" ? "BLOCK" : "FLAG";
};

const DEFAULT_SIMPLE_LOGIC = "AND";

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

  // Simple mode: multi-row conditions + global logic operator
  const [simpleLogic, setSimpleLogic] = useState(DEFAULT_SIMPLE_LOGIC);
  const [simpleConditions, setSimpleConditions] = useState([
    { field: "amount", operator: ">=", value: "" },
  ]);

    // Advanced mode - deep-parse values in the group tree
  const [advancedGroup, setAdvancedGroup] = useState({
    AND: [{ field: "amount", operator: ">=", value: "" }],
  });

  const [showPreview, setShowPreview] = useState(false);
  const [keyError, setKeyError] = useState(false);
  const keyErrorMsg = "";
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
        setForm({
          rule_name: editData.name || "",
          rule_key: editData.rule_key || "",
          service_scope: editData.service_scope || "ALL",
          rule_group: editData.rule_group || "",
          action: normalizeMitigationAction(editData.action),
          severity: editData.severity || "MEDIUM",
          priority: editData.priority ?? 0,
          description: editData.description || "",
        });

        const cfg = editData.rule_config;
        if (cfg && (cfg.AND || cfg.OR || cfg.field)) {
          if (cfg.field) {
            setMode("simple");
            setSimpleLogic("AND");
            setSimpleConditions([
              {
                field: cfg.field,
                operator: cfg.operator || "=",
                value: String(cfg.value ?? ""),
              },
            ]);
          } else {
            // Detect if it's a simple-wrapped config (flat array with AND/OR key)
            const logicKey = cfg.AND ? "AND" : "OR";
            const items = cfg[logicKey] || [];
            const isFlat = items.every((item) => item.field !== undefined);
            if (isFlat) {
              setMode("simple");
              setSimpleLogic(logicKey);
              setSimpleConditions(
                items.map((c) => ({
                  field: c.field,
                  operator: c.operator || "=",
                  value: String(c.value ?? ""),
                })),
              );
            } else {
              setMode("advanced");
              setAdvancedGroup(cfg);
            }
          }
        } else if (editData.condField) {
          setMode("simple");
          setSimpleLogic("AND");
          setSimpleConditions([
            {
              field: editData.condField,
              operator: editData.condOp || "=",
              value: String(editData.condValue ?? ""),
            },
          ]);
        } else {
          setMode("simple");
          setSimpleLogic("AND");
          setSimpleConditions([{ field: "amount", operator: ">=", value: "" }]);
        }
      } else {
        setForm(EMPTY_FORM);
        setMode("simple");
        setSimpleLogic("AND");
        setSimpleConditions([{ field: "amount", operator: ">=", value: "" }]);
        setAdvancedGroup({
          AND: [{ field: "amount", operator: ">=", value: "" }],
        });
      }

      setTimeout(() => nameRef.current?.focus(), 50);
    }
  }, [isOpen, editData, isEdit]);

  // Prevent body scroll when open
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  // Escape key
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

  const normalizeConditionForScope = useCallback((condition, nextScope) => {
    const validFields = getFields(nextScope).map((f) => f.f);
    const fallbackField = validFields[0] || "amount";

    if ("AND" in condition || "OR" in condition) {
      const logic = condition.AND ? "AND" : "OR";
      return {
        [logic]: (condition[logic] || []).map((item) =>
          normalizeConditionForScope(item, nextScope),
        ),
      };
    }

    const isKnownForScope = validFields.includes(condition.field);
    const isCustomDotField =
      condition.field &&
      condition.field.includes(".") &&
      !Object.values(FLD)
        .flat()
        .some((field) => field.f === condition.field);

    if (isKnownForScope || isCustomDotField) return condition;

    return {
      ...condition,
      field: fallbackField,
      operator: condition.operator || "=",
      value: "",
    };
  }, []);

  const handleServiceScopeChange = (nextScope) => {
    setForm((prev) => {
      const allPresetGroups = Object.values(RULE_GROUPS_BY_SCOPE).flat();
      const nextPresetGroups = getRuleGroups(nextScope);
      const group = prev.rule_group;
      const shouldResetGroup =
        group && allPresetGroups.includes(group) && !nextPresetGroups.includes(group);
      return {
        ...prev,
        service_scope: nextScope,
        rule_group: shouldResetGroup ? "" : group,
      };
    });
    setSimpleConditions((conditions) =>
      conditions.map((condition) =>
        normalizeConditionForScope(condition, nextScope),
      ),
    );
    setAdvancedGroup((group) => normalizeConditionForScope(group, nextScope));
  };

  // Auto-generate rule_key from rule_name
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

  const addSimpleCondition = () => {
    setSimpleConditions((p) => [
      ...p,
      { field: getFields(form.service_scope)[0].f, operator: "=", value: "" },
    ]);
  };

  const removeSimpleCondition = (i) => {
    setSimpleConditions((p) => p.filter((_, idx) => idx !== i));
  };

  const updateSimpleCondition = (i, val) => {
    setSimpleConditions((p) => {
      const next = [...p];
      next[i] = val;
      return next;
    });
  };

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

  // Req 3: smart type parser for value
  // Req 4: wrap array under {AND: [...]} or {OR: [...]} key
  const buildRuleConfig = () => {
    if (mode === "simple") {
      const mapped = simpleConditions.map((c) => ({
        field: c.field,
        operator: c.operator,
        value: smartParseValue(c.value),
      }));

      if (mapped.length === 1) {
        return { [simpleLogic]: mapped };
      }
      return { [simpleLogic]: mapped };
    }

    const parseGroup = (g) => {
      const logic = g.AND ? "AND" : "OR";
      return {
        [logic]: (g[logic] || []).map((item) =>
          "AND" in item || "OR" in item
            ? parseGroup(item)
            : { ...item, value: smartParseValue(item.value) },
        ),
      };
    };
    return parseGroup(advancedGroup);
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
    return fields.filter(
      (f) => fieldMeta(f, form.service_scope)?.j || (f && f.includes(".")),
    );
  };

  const dotFields = hasDotFields();

  const execSave = async () => {
    const p = buildPayload();
    setLoading(true);
    try {
      if (isEdit) {
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

  const countConditions = (group) => {
    const logic = group.AND ? "AND" : "OR";
    return (group[logic] || []).reduce(
      (sum, item) =>
        sum + ("AND" in item || "OR" in item ? countConditions(item) : 1),
      0,
    );
  };
  const conditionCount =
    mode === "simple" ? simpleConditions.length : countConditions(advancedGroup);
  const scopeLabel =
    form.service_scope === "AGENUSA"
      ? "AGENUSA"
      : form.service_scope === "NUSABILL"
        ? "NUSABILL"
        : "Universal";
  const actionSummary =
    {
      BLOCK: {
        icon: "bi-ban",
        label: "Block transaction",
        tone: "danger",
        desc: "Transaksi langsung ditolak saat kondisi match.",
      },
      FLAG: {
        icon: "bi-flag-fill",
        label: "Flag transaction",
        tone: "warning",
        desc: "Transaksi tetap berhasil, alert dibuat untuk Fraud Analyst.",
      },
    }[form.action] || {
      icon: "bi-flag-fill",
      label: "Flag transaction",
      tone: "warning",
      desc: "Transaksi tetap berhasil, alert dibuat untuk Fraud Analyst.",
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
          <button className="rbm-close" onClick={onClose} type="button">
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <div className="rbm-body">
          <div className="rbm-workspace">
            <div className="rbm-main">
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
                    (rule_key - unik, max 100 karakter)
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
                  onChange={(e) => handleServiceScopeChange(e.target.value)}
                >
                  <option value="ALL">ALL - universal</option>
                  <option value="AGENUSA">AGENUSA - Mini ATM &amp; EDC</option>
                  <option value="NUSABILL">NUSABILL - Tagihan &amp; VA</option>
                </select>
                <div className="rbm-field-hint">
                  Field kondisi akan disaring sesuai layanan. Field teknis
                  mentah tetap bisa dipakai lewat dot-notation kustom jika
                  benar-benar dibutuhkan.
                </div>
              </div>

              {/* Req 2: Combobox for rule_group */}
              <div className="rbm-field">
                <label className="rbm-label">Grup aturan</label>
                <Combobox
                  options={getRuleGroups(form.service_scope)}
                  value={form.rule_group}
                  onChange={(v) => set("rule_group", v)}
                  placeholder="Ketik nama grup baru..."
                />
                <div className="rbm-field-hint">
                  Preset grup mengikuti cakupan layanan. Dipakai{" "}
                  <code>seen_groups</code> di engine untuk cegah alarm beruntun.
                  Tetap bisa ketik grup kustom jika perlu.
                </div>
              </div>
            </div>
          </div>

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
                  membaca JSONB nested - dot-notation traversal sudah aktif di
                  engine.
                </div>
              </div>
            )}

            <div className="rbm-mode-tabs">
              <button
                className={`rbm-mode-tab ${mode === "simple" ? "active" : ""}`}
                onClick={() => setMode("simple")}
                type="button"
              >
                <i className="bi bi-lightning-fill" /> Simple rule
              </button>
              <button
                className={`rbm-mode-tab ${mode === "advanced" ? "active" : ""}`}
                onClick={() => setMode("advanced")}
                type="button"
              >
                <i className="bi bi-diagram-2" /> Advanced builder
              </button>
            </div>

            {mode === "simple" && (
              <div>
                {/* Global logic operator toggle above conditions */}
                {simpleConditions.length > 1 && (
                  <div className="rbm-simple-logic-bar">
                    <span className="rbm-simple-logic-label">
                      Gabungkan semua kondisi dengan:
                    </span>
                    <div className="rbm-logic-toggle">
                      <button
                        type="button"
                        className={`rbm-logic-btn ${simpleLogic === "AND" ? "rbm-logic-btn--and active" : ""}`}
                        onClick={() => setSimpleLogic("AND")}
                      >
                        AND
                      </button>
                      <button
                        type="button"
                        className={`rbm-logic-btn ${simpleLogic === "OR" ? "rbm-logic-btn--or active" : ""}`}
                        onClick={() => setSimpleLogic("OR")}
                      >
                        OR
                      </button>
                    </div>
                    <span className="rbm-simple-logic-hint">
                      {simpleLogic === "AND"
                        ? "Semua kondisi harus terpenuhi"
                        : "Cukup satu kondisi yang terpenuhi"}
                    </span>
                  </div>
                )}

                <div className="rbm-simple-conditions">
                  {simpleConditions.map((cond, i) => (
                    <ConditionRow
                      key={i}
                      index={i}
                      cond={cond}
                      scope={form.service_scope}
                      onChange={(val) => updateSimpleCondition(i, val)}
                      onRemove={() => removeSimpleCondition(i)}
                      showRemove={simpleConditions.length > 1}
                      logicOp={simpleConditions.length > 1 ? simpleLogic : null}
                    />
                  ))}
                </div>

                <div className="rbm-simple-footer">
                  <button
                    className="rbm-add-btn"
                    onClick={addSimpleCondition}
                    type="button"
                  >
                    <i className="bi bi-plus" /> Kondisi
                  </button>
                  <span className="rbm-field-hint">
                    Kondisi digabung dengan operator <code>{simpleLogic}</code>{" "}
                    - valid sebagai <code>rule_config.{simpleLogic}</code>.
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

          <div className="rbm-section-head">
            <div className="rbm-step-badge">3</div>
            <span>Konsekuensi &amp; mitigasi risiko</span>
          </div>
          <div className="rbm-card">
            <div className="rbm-grid">
              <div className="rbm-field rbm-field--full">
                <label className="rbm-label">
                  Tindakan mitigasi{" "}
                  <span className="rbm-label-meta">(BLOCK / FLAG)</span>
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
                      v: "FLAG",
                      icon: "bi-flag-fill",
                      label: "FLAG",
                      desc: "Tetap berhasil, buat alert untuk Fraud Analyst",
                    },
                  ].map((a) => (
                    <button
                      key={a.v}
                      type="button"
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
                      type="button"
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
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={form.priority}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, "");
                      set("priority", raw);
                    }}
                    onBlur={(e) => {
                      const parsed = parseInt(e.target.value, 10);
                      set("priority", isNaN(parsed) ? 0 : Math.max(0, parsed));
                    }}
                  />
                  <div className="rbm-priority-pills">
                    <button
                      type="button"
                      className="rbm-priority-pill pp-high"
                      onClick={() => set("priority", 100)}
                    >
                      Tinggi - 100
                    </button>
                    <button
                      type="button"
                      className="rbm-priority-pill pp-medium"
                      onClick={() => set("priority", 50)}
                    >
                      Sedang - 50
                    </button>
                    <button
                      type="button"
                      className="rbm-priority-pill pp-low"
                      onClick={() => set("priority", 10)}
                    >
                      Rendah - 10
                    </button>
                  </div>
                </div>
                <div className="rbm-field-hint">
                  Nilai lebih tinggi dieksekusi lebih awal -{" "}
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

            </div>

            <aside className="rbm-side">
              <div className="rbm-side-card rbm-side-card--summary">
                <div className="rbm-side-title">
                  <i className="bi bi-clipboard-check" />
                  Ringkasan Rule
                </div>
                <div className="rbm-summary-name">
                  {form.rule_name.trim() || "Rule belum diberi nama"}
                </div>
                <div className="rbm-summary-key">
                  {form.rule_key.trim() || "rule_key_otomatis"}
                </div>

                <div className="rbm-summary-list">
                  <div className="rbm-summary-item">
                    <span>Cakupan</span>
                    <strong>{scopeLabel}</strong>
                  </div>
                  <div className="rbm-summary-item">
                    <span>Kondisi</span>
                    <strong>
                      {conditionCount} kondisi -{" "}
                      {mode === "simple" ? simpleLogic : "Nested"}
                    </strong>
                  </div>
                  <div className="rbm-summary-item">
                    <span>Severity</span>
                    <strong>{form.severity}</strong>
                  </div>
                  <div className="rbm-summary-item">
                    <span>Prioritas</span>
                    <strong>{form.priority || 0}</strong>
                  </div>
                </div>
              </div>

              <div
                className={`rbm-side-card rbm-impact rbm-impact--${actionSummary.tone}`}
              >
                <div className="rbm-impact-head">
                  <i className={`bi ${actionSummary.icon}`} />
                  <span>{actionSummary.label}</span>
                </div>
                <p>{actionSummary.desc}</p>
              </div>

              <div className="rbm-side-card">
                <div className="rbm-side-title">
                  <i className="bi bi-list-check" />
                  Kesiapan Simpan
                </div>
                <div className="rbm-check-list">
                  <div className={`rbm-check ${form.rule_name.trim() ? "ok" : ""}`}>
                    <i
                      className={`bi ${form.rule_name.trim() ? "bi-check-circle-fill" : "bi-circle"}`}
                    />
                    Nama aturan
                  </div>
                  <div className={`rbm-check ${form.rule_key.trim() ? "ok" : ""}`}>
                    <i
                      className={`bi ${form.rule_key.trim() ? "bi-check-circle-fill" : "bi-circle"}`}
                    />
                    Rule key
                  </div>
                  <div className={`rbm-check ${conditionsValid() ? "ok" : ""}`}>
                    <i
                      className={`bi ${conditionsValid() ? "bi-check-circle-fill" : "bi-circle"}`}
                    />
                    Kondisi valid
                  </div>
                </div>
              </div>

              <div className="rbm-side-card rbm-preview-side">
                <button
                  className="rbm-preview-toggle"
                  onClick={() => setShowPreview((p) => !p)}
                  type="button"
                >
                  <span>
                    <i className="bi bi-code-slash" /> Preview Payload
                  </span>
                  <i
                    className={`bi ${showPreview ? "bi-chevron-up" : "bi-chevron-down"}`}
                  />
                </button>
                {showPreview && (
                  <pre className="rbm-preview-json">
                    {JSON.stringify(buildPayload(), null, 2)}
                  </pre>
                )}
              </div>
            </aside>
          </div>
        </div>

        {/* Footer */}
        <div className="rbm-footer">
          <button
            className="rbm-btn-cancel"
            onClick={onClose}
            disabled={loading}
            type="button"
          >
            Batal
          </button>
          <div className="rbm-footer-right">
            <button
              type="button"
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
                <code>return</code> - rules sesudahnya tidak dievaluasi.
                Pastikan kondisi sudah benar sebelum menyimpan.
              </p>
              <div className="rbm-confirm-actions">
                <button
                  type="button"
                  className="rbm-btn-cancel"
                  onClick={() => setShowBlockConfirm(false)}
                >
                  Cek ulang dulu
                </button>
                <button
                  type="button"
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

