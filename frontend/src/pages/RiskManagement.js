import React, { useState, useEffect, useCallback, useRef } from "react";
import BlacklistPanel from "../components/riskmanagement/BlacklistPanel";
import BlacklistFormModal from "../components/riskmanagement/BlacklistFormModal";
import RuleEngine from "../components/riskmanagement/RuleEngine";
import RuleBuilderModal from "../components/riskmanagement/RuleBuilderModal";
import RuleDetailModal from "../components/riskmanagement/RuleDetailModal";
import RiskStats from "../components/riskmanagement/RiskStats";
import PatternPanel from "../components/riskmanagement/PatternPanel";
import PatternFormModal from "../components/riskmanagement/PatternFormModal";
import PageLoader from "../components/common/PageLoader";
import { api } from "../services/apiService";
import "./RiskManagement.css";

const ruleFromApi = (r) => ({
  id: r.id,
  name: r.rule_name || "Rule Tanpa Nama",
  description: r.description || "",
  priority: r.priority ?? 0,
  action: (r.action || "FLAG").toLowerCase(),
  enabled: r.is_active ?? true,
  condition: buildConditionText(r),
  condField: r.condition_field || "",
  condOp: r.operator || ">",
  condValue: r.threshold_value || "",
  rule_key: r.rule_key || "",
  service_scope: r.service_scope || "ALL",
  severity: r.severity || "MEDIUM",
  rule_group: r.rule_group || null,
  hitCount: r.hit_count ?? 0,
  hitToday: 0,
  hitWeek: 0,
  hitMonth: 0,
  createdBy: r.created_by_name || null,
  createdByRole: r.created_by_role || null,
  createdById: r.created_by || null,
  createdAt: r.created_at
    ? new Date(r.created_at).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—",
});

function buildConditionText(r) {
  // Simple rule — punya condition_field
  if (r.condition_field) {
    const field = r.condition_field;
    const op = r.operator || ">";
    const val = r.threshold_value || "";
    return `${field} ${op} ${val}`.trim();
  }

  // Builder rule — punya rule_config (JSONB)
  if (r.rule_config) {
    const cfg = r.rule_config;
    const logic = cfg.AND ? "AND" : cfg.OR ? "OR" : null;

    // Single leaf condition
    if (cfg.field) {
      return `${cfg.field} ${cfg.operator} ${cfg.value}`;
    }

    // Group condition — ringkas: tampilkan jumlah kondisi dan logic
    if (logic) {
      const items = cfg[logic] || [];
      const count = items.length;
      if (count === 1 && items[0].field) {
        return `${items[0].field} ${items[0].operator} ${items[0].value}`;
      }
      return `${count} kondisi (${logic})`;
    }
  }

  return "—";
}

const ruleToCreatePayload = (form) => ({
  rule_name: form.name,
  rule_key: form.rule_key,
  service_scope: form.service_scope || "ALL",
  condition_field: form.condField || null,
  operator: form.condOp || null,
  threshold_value: form.condValue || null,
  action: (form.action || "flag").toUpperCase(),
  severity: form.severity || "MEDIUM",
  priority: form.priority || 5,
  rule_group: form.rule_group || null,
  description: form.description || null,
});

const ruleToUpdatePayload = (form) => ({
  // rule_key sengaja tidak disertakan — BE tidak izinkan update unique key
  rule_name: form.name,
  service_scope: form.service_scope || "ALL",
  condition_field: form.condField || null,
  operator: form.condOp || null,
  threshold_value: form.condValue || null,
  action: (form.action || "flag").toUpperCase(),
  severity: form.severity || "MEDIUM",
  priority: form.priority || 5,
  rule_group: form.rule_group || null,
  description: form.description || null,
});

const resolveBlStatus = (item) => {
  if (item.status === "PENDING") return "pending";
  if (item.status === "APPROVED" && item.is_active) return "active";
  return "inactive";
};

const blFromApi = (item) => ({
  id: item.id,
  accountNumber: item.value,
  accountName: "",
  type: item.type,
  bank: item.type, // kolom "Tipe" di tabel — diisi dari BlacklistTypeEnum
  reason: item.reason,
  reasonDetail: item.review_note || "",
  review_note: item.review_note || "",
  source: (item.source || "MANUAL").toLowerCase(),
  status: resolveBlStatus(item),
  hitCount: item.hit_count || 0,
  service_scope: item.service_scope || "ALL",
  addedBy: item.added_by_name || null,
  addedByRole: item.added_by_role || null,
  addedById: item.added_by || null,
  addedAt: item.created_at
    ? new Date(item.created_at).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—",

  _apiStatus: item.status,
  _isActive: item.is_active,
});

const blToApiPayload = (form) => ({
  // AddForm kirim { value, type, service_scope, reason }
  // EditForm kirim { accountNumber, reason, ... } — map ke field BE
  value: form.value ?? form.accountNumber,
  type: form.type ?? "ACCOUNT_NUMBER",
  service_scope: (form.service_scope ?? "ALL").toUpperCase(),
  reason: form.reason || "Penipuan Online",
});

let _tid = 0;
const useToast = () => {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const push = useCallback((msg, type = "success", key = null) => {
    const id = ++_tid;
    if (key && timers.current[key]) {
      clearTimeout(timers.current[key]);
      delete timers.current[key];
    }
    setToasts((p) => {
      const filtered = key ? p.filter((t) => t._key !== key) : p;
      return [...filtered, { id, msg, type, _key: key }];
    });
    const timerId = setTimeout(() => {
      setToasts((p) => p.filter((t) => t.id !== id));
      if (key) delete timers.current[key];
    }, 3100);
    if (key) timers.current[key] = timerId;
    else timers.current[id] = timerId;
  }, []);

  const dismiss = useCallback((id) => {
    setToasts((p) => {
      const toast = p.find((t) => t.id === id);
      if (toast?._key && timers.current[toast._key]) {
        clearTimeout(timers.current[toast._key]);
        delete timers.current[toast._key];
      }
      return p.filter((t) => t.id !== id);
    });
  }, []);

  return { toasts, push, dismiss };
};

const RiskManagement = () => {
  const [pageLoading, setPageLoading] = useState(true);

  const [rules, setRules] = useState([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [rulesError, setRulesError] = useState(null);

  const [blacklist, setBlacklist] = useState([]);
  const [blLoading, setBlLoading] = useState(false);
  const [blError, setBlError] = useState(null);

  const [blModal, setBlModal] = useState({
    open: false,
    mode: "single",
    editData: null,
  });
  const [builderModal, setBuilderModal] = useState({
    open: false,
    editData: null,
  });
  const [activeTab, setActiveTab] = useState("blacklist"); // "blacklist" | "rules" | "patterns"
  const [patterns, setPatterns] = useState([]);
  const [effectiveness, setEffectiveness] = useState([]);
  const [patternsLoading, setPatternsLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [patternModal, setPatternModal] = useState({
    open: false,
    editData: null,
  });
  const [ruleDetailModal, setRuleDetailModal] = useState({
    open: false,
    rule: null,
  });

  const { toasts, push, dismiss } = useToast();

  const fetchRules = useCallback(async (filters = {}) => {
    setRulesLoading(true);
    setRulesError(null);
    try {
      const params = new URLSearchParams();
      if (filters.service_scope)
        params.append("service_scope", filters.service_scope);
      if (filters.is_active !== undefined && filters.is_active !== null)
        params.append("is_active", filters.is_active);
      if (filters.rule_group) params.append("rule_group", filters.rule_group);
      if (filters.severity) params.append("severity", filters.severity);
      const qs = params.toString();
      const data = await api.get(`/rules/${qs ? `?${qs}` : ""}`);
      setRules((data || []).map(ruleFromApi));
    } catch (err) {
      console.warn("[RiskManagement] Gagal memuat rules:", err.message);
      setRulesError(err.message);
      setRules([]);
    } finally {
      setRulesLoading(false);
    }
  }, []);

  const fetchPatterns = useCallback(async () => {
    setPatternsLoading(true);
    try {
      const [active, candidates, eff] = await Promise.all([
        api.get("/patterns/"),
        api.get("/patterns/candidates"),
        api.get("/patterns/effectiveness"),
      ]);
      const all = [
        ...(active || []).map((p) => ({ ...p, is_active: true })),
        ...(candidates || []).map((p) => ({ ...p, is_active: false })),
      ];
      setPatterns(all);
      setEffectiveness(eff || []);
    } catch (err) {
      console.warn("[RiskManagement] Gagal memuat patterns:", err.message);
      setPatterns([]);
    } finally {
      setPatternsLoading(false);
    }
  }, []);

  const fetchBlacklist = useCallback(async () => {
    setBlLoading(true);
    setBlError(null);
    try {
      const data = await api.get("/blacklist/?skip=0&limit=100");
      const items = data?.data || [];
      setBlacklist(items.map(blFromApi));
    } catch (err) {
      console.warn("[RiskManagement] Gagal memuat blacklist:", err.message);
      setBlError(err.message);
      setBlacklist([]);
    } finally {
      setBlLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await Promise.all([fetchRules(), fetchBlacklist(), fetchPatterns()]);
      setPageLoading(false);
    };
    init();
  }, [fetchRules, fetchBlacklist, fetchPatterns]);

  const handleRuleSubmit = async (formData) => {
    const isEdit = Boolean(
      formData.id && rules.find((r) => r.id === formData.id),
    );
    const payload = isEdit
      ? ruleToUpdatePayload(formData)
      : ruleToCreatePayload(formData);
    try {
      if (isEdit) {
        const updated = await api.put(`/rules/${formData.id}`, payload);
        setRules((p) =>
          p.map((r) => (r.id === formData.id ? ruleFromApi(updated) : r)),
        );
        push(`Rule "${formData.name}" berhasil diperbarui.`, "info");
      } else {
        const created = await api.post("/rules/", payload);
        setRules((p) => [ruleFromApi(created), ...p]);
        push(`Rule "${formData.name}" berhasil dibuat.`, "success");
      }
    } catch (err) {
      push(`Gagal menyimpan rule: ${err.message}`, "error");
    }
  };

  const handleRuleDelete = async (id) => {
    const rule = rules.find((r) => r.id === id);
    try {
      await api.del(`/rules/${id}`);
      setRules((p) => p.filter((r) => r.id !== id));
      push(`Rule "${rule?.name}" dihapus.`, "error");
    } catch (err) {
      push(`Gagal menghapus rule: ${err.message}`, "error");
    }
  };

  const handleRuleToggle = async (id) => {
    const rule = rules.find((r) => r.id === id);
    if (!rule) return;

    setRules((p) =>
      p.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)),
    );
    try {
      const updated = await api.patch(`/rules/${id}/toggle`);
      setRules((p) => p.map((r) => (r.id === id ? ruleFromApi(updated) : r)));
      const next = !rule.enabled;
      push(
        `Rule "${rule.name}" ${next ? "diaktifkan" : "dinonaktifkan"}.`,
        next ? "success" : "warn",
        "rule-toggle",
      );
    } catch (err) {
      setRules((p) =>
        p.map((r) => (r.id === id ? { ...r, enabled: rule.enabled } : r)),
      );
      push(`Gagal toggle rule: ${err.message}`, "error");
    }
  };

  const handleRuleDetail = (rule) => setRuleDetailModal({ open: true, rule });

  // ── Pattern handlers ──────────────────────────────────────────────────────
  const handlePatternActivate = async (id) => {
    setPatterns((p) =>
      p.map((x) => (x.id === id ? { ...x, is_active: true } : x)),
    );
    try {
      await api.patch(`/patterns/${id}/activate`);
      push("Pattern berhasil diaktifkan.", "success");
    } catch (err) {
      setPatterns((p) =>
        p.map((x) => (x.id === id ? { ...x, is_active: false } : x)),
      );
      push(`Gagal mengaktifkan pattern: ${err.message}`, "error");
    }
  };

  const handlePatternDeactivate = async (id) => {
    setPatterns((p) =>
      p.map((x) => (x.id === id ? { ...x, is_active: false } : x)),
    );
    try {
      await api.patch(`/patterns/${id}/deactivate`);
      push("Pattern dinonaktifkan.", "warn");
    } catch (err) {
      setPatterns((p) =>
        p.map((x) => (x.id === id ? { ...x, is_active: true } : x)),
      );
      push(`Gagal menonaktifkan: ${err.message}`, "error");
    }
  };

  const handlePatternDelete = async (id) => {
    const prev = patterns;
    setPatterns((p) => p.filter((x) => x.id !== id));
    try {
      await api.del(`/patterns/${id}`);
      push("Pattern dihapus.", "warn");
    } catch (err) {
      setPatterns(prev);
      push(`Gagal menghapus: ${err.message}`, "error");
    }
  };

  const handlePatternGenerate = async () => {
    setGenerating(true);
    try {
      const res = await api.post("/patterns/generate");
      push(
        `${res.generated_count ?? 0} pattern kandidat berhasil di-generate.`,
        "success",
      );
      await fetchPatterns();
    } catch (err) {
      push(`Gagal generate pattern: ${err.message}`, "error");
    } finally {
      setGenerating(false);
    }
  };

  const handleBlSubmit = async (mode, items) => {
    if (mode === "edit") {
      const item = items[0];
      try {
        await api.put(`/blacklist/${item.id}`, blToApiPayload(item));

        await fetchBlacklist();
        push(
          `Rekening ${item.accountNumber} diperbarui. Status kembali ke Pending verifikasi.`,
          "info",
        );
      } catch (err) {
        push(`Gagal memperbarui: ${err.message}`, "error");
      }
      return;
    }

    if (mode === "single") {
      const item = items[0];
      try {
        const created = await api.post("/blacklist/", blToApiPayload(item));

        setBlacklist((p) => [blFromApi(created), ...p]);
        push(
          `Rekening ${item.accountNumber} ditambahkan, menunggu verifikasi.`,
          "success",
        );
      } catch (err) {
        if (err.status === 409) {
          push(
            `Rekening ${item.accountNumber} sudah ada di blacklist.`,
            "warn",
          );
        } else {
          push(`Gagal menambahkan: ${err.message}`, "error");
        }
      }
      return;
    }

    if (mode === "bulk") {
      let success = 0;
      let failed = 0;
      for (const item of items) {
        try {
          await api.post("/blacklist/", blToApiPayload(item));
          success++;
        } catch {
          failed++;
        }
      }
      await fetchBlacklist();
      if (failed === 0) {
        push(
          `${success} rekening berhasil diimport, menunggu verifikasi.`,
          "success",
        );
      } else {
        push(
          `${success} berhasil, ${failed} gagal (mungkin sudah terdaftar).`,
          "warn",
        );
      }
    }
  };

  const handleBlDelete = async (id) => {
    const item = blacklist.find((b) => b.id === id);

    setBlacklist((p) => p.filter((b) => b.id !== id));
    try {
      await api.del(`/blacklist/${id}`);
      push(`Rekening ${item?.accountNumber} dihapus permanen.`, "error");
    } catch (err) {
      if (item) setBlacklist((p) => [item, ...p]);
      push(`Gagal menghapus: ${err.message}`, "error");
    }
  };

  const handleBlApprove = async (id) => {
    const item = blacklist.find((b) => b.id === id);

    setBlacklist((p) =>
      p.map((b) =>
        b.id === id
          ? { ...b, status: "active", _apiStatus: "APPROVED", _isActive: true }
          : b,
      ),
    );
    try {
      await api.patch(`/blacklist/${id}/approve`, {
        review_note: "Disetujui melalui dashboard",
      });
      push(
        `Rekening ${item?.accountNumber} disetujui dan aktif diblokir.`,
        "success",
      );
    } catch (err) {
      setBlacklist((p) =>
        p.map((b) =>
          b.id === id ? { ...b, status: item?.status ?? "pending" } : b,
        ),
      );
      push(`Gagal menyetujui: ${err.message}`, "error");
    }
  };

  const handleBlReject = async (id, reviewNote) => {
    const item = blacklist.find((b) => b.id === id);

    setBlacklist((p) =>
      p.map((b) =>
        b.id === id
          ? {
              ...b,
              status: "inactive",
              _apiStatus: "REJECTED",
              _isActive: false,
            }
          : b,
      ),
    );
    try {
      await api.patch(`/blacklist/${id}/reject`, {
        review_note: reviewNote || "Ditolak melalui dashboard",
      });
      push(`Rekening ${item?.accountNumber} ditolak.`, "warn");
    } catch (err) {
      setBlacklist((p) =>
        p.map((b) =>
          b.id === id ? { ...b, status: item?.status ?? "pending" } : b,
        ),
      );
      push(`Gagal menolak: ${err.message}`, "error");
    }
  };

  const handleBlEdit = (item) => {
    setBlModal({ open: true, mode: "single", editData: item });
  };

  const handleBlToggleStatus = async (id, newStatus) => {
    const item = blacklist.find((b) => b.id === id);

    setBlacklist((p) =>
      p.map((b) => (b.id === id ? { ...b, status: newStatus } : b)),
    );
    try {
      if (newStatus === "active") {
        await api.patch(`/blacklist/${id}/activate`);
      } else {
        await api.patch(`/blacklist/${id}/deactivate`);
      }
      push(
        `Rekening ${item?.accountNumber} ${
          newStatus === "active" ? "diaktifkan kembali" : "dinonaktifkan"
        }.`,
        newStatus === "active" ? "success" : "warn",
        "bl-toggle",
      );
    } catch (err) {
      setBlacklist((p) =>
        p.map((b) =>
          b.id === id ? { ...b, status: item?.status ?? "inactive" } : b,
        ),
      );
      push(`Gagal mengubah status: ${err.message}`, "error");
    }
  };

  const toastIcon = (t) =>
    t === "success"
      ? "bi-check-circle-fill"
      : t === "error"
        ? "bi-trash-fill"
        : t === "warn"
          ? "bi-exclamation-triangle-fill"
          : "bi-info-circle-fill";

  if (pageLoading) return <PageLoader message="Memuat Risk Management..." />;

  const liveRule = ruleDetailModal.rule
    ? (rules.find((r) => r.id === ruleDetailModal.rule.id) ??
      ruleDetailModal.rule)
    : null;

  return (
    <div className="rm-page">
      <div className="rm-header">
        <div className="rm-header-left">
          <div className="rm-header-icon">
            <i className="bi bi-shield-fill-exclamation" />
          </div>
          <div>
            <h1 className="rm-page-title">Risk Management</h1>
            <p className="rm-page-subtitle">
              Blacklist rekening penipu &amp; konfigurasi rule otomatis sebelum
              transaksi masuk ke Manual Review
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          {activeTab === "blacklist" && (
            <RefreshBtn
              onClick={fetchBlacklist}
              loading={blLoading}
              label="Refresh Blacklist"
            />
          )}
          {activeTab === "rules" && (
            <RefreshBtn
              onClick={fetchRules}
              loading={rulesLoading}
              label="Refresh Rules"
            />
          )}
          {activeTab === "patterns" && (
            <RefreshBtn
              onClick={fetchPatterns}
              loading={patternsLoading}
              label="Refresh Patterns"
            />
          )}
        </div>
      </div>

      {blError && (
        <ErrorBanner
          msg="Blacklist tidak dapat dimuat dari server."
          onRetry={fetchBlacklist}
        />
      )}
      {rulesError && (
        <ErrorBanner
          msg="Rules tidak dapat dimuat dari server. Pastikan backend berjalan."
          onRetry={fetchRules}
        />
      )}

      <RiskStats
        blacklist={blacklist}
        rules={rules}
        patterns={patterns}
        activeTab={activeTab}
      />

      {/* Tab switcher */}
      <div className="rm-tabs">
        <button
          className={`rm-tab ${activeTab === "blacklist" ? "rm-tab--active" : ""}`}
          onClick={() => setActiveTab("blacklist")}
        >
          <i className="bi bi-ban" />
          Blacklist Management
          {blacklist.filter((b) => b.status === "pending").length > 0 && (
            <span className="rm-tab-badge">
              {blacklist.filter((b) => b.status === "pending").length}
            </span>
          )}
        </button>
        <button
          className={`rm-tab ${activeTab === "rules" ? "rm-tab--active" : ""}`}
          onClick={() => setActiveTab("rules")}
        >
          <i className="bi bi-gear-fill" />
          Rule Engine
          <span className="rm-tab-count">
            {rules.filter((r) => r.enabled).length} aktif
          </span>
        </button>
        <button
          className={`rm-tab ${activeTab === "patterns" ? "rm-tab--active" : ""}`}
          onClick={() => setActiveTab("patterns")}
        >
          <i className="bi bi-shield-shaded" />
          Pattern Management
          {patterns.filter((p) => !p.is_active).length > 0 && (
            <span className="rm-tab-badge rm-tab-badge--pink">
              {patterns.filter((p) => !p.is_active).length}
            </span>
          )}
        </button>
      </div>

      {/* Tab content */}
      {activeTab === "blacklist" && (
        <BlacklistPanel
          data={blacklist}
          onAdd={() =>
            setBlModal({ open: true, mode: "single", editData: null })
          }
          onBulkImport={() =>
            setBlModal({ open: true, mode: "bulk", editData: null })
          }
          onDelete={handleBlDelete}
          onApprove={handleBlApprove}
          onReject={handleBlReject}
          onEdit={handleBlEdit}
          onToggleStatus={handleBlToggleStatus}
        />
      )}

      {activeTab === "rules" &&
        (rulesLoading && rules.length === 0 ? (
          <div
            style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              padding: "48px 20px",
              textAlign: "center",
              color: "#9ca3af",
            }}
          >
            <i
              className="bi bi-gear"
              style={{
                fontSize: "2rem",
                display: "block",
                marginBottom: 8,
                opacity: 0.4,
              }}
            />
            <p style={{ margin: 0, fontSize: "0.875rem" }}>
              Memuat rules dari server...
            </p>
          </div>
        ) : (
          <RuleEngine
            rules={rules}
            onAdd={() => setBuilderModal({ open: true, editData: null })}
            onEdit={(rule) => setBuilderModal({ open: true, editData: rule })}
            onDelete={handleRuleDelete}
            onToggle={handleRuleToggle}
            onDetail={handleRuleDetail}
          />
        ))}

      {activeTab === "patterns" && (
        <PatternPanel
          data={patterns}
          effectiveness={effectiveness}
          onAdd={() => setPatternModal({ open: true, editData: null })}
          onEdit={(p) => setPatternModal({ open: true, editData: p })}
          onActivate={handlePatternActivate}
          onDeactivate={handlePatternDeactivate}
          onDelete={handlePatternDelete}
          onGenerate={handlePatternGenerate}
          generating={generating}
        />
      )}

      <PatternFormModal
        isOpen={patternModal.open}
        editData={patternModal.editData}
        onClose={() => setPatternModal({ open: false, editData: null })}
        onSuccess={(pattern) => {
          setPatterns((p) => [pattern, ...p]);
          push(`Pattern "${pattern.pattern_name}" berhasil dibuat.`, "success");
        }}
        onUpdate={(pattern) => {
          setPatterns((p) =>
            p.map((x) => (x.id === pattern.id ? { ...x, ...pattern } : x)),
          );
          push(
            `Pattern "${pattern.pattern_name}" berhasil diperbarui.`,
            "info",
          );
        }}
      />

      <BlacklistFormModal
        isOpen={blModal.open}
        mode={blModal.mode}
        editData={blModal.editData}
        onClose={() =>
          setBlModal({ open: false, mode: "single", editData: null })
        }
        onSubmit={handleBlSubmit}
      />

      <RuleBuilderModal
        isOpen={builderModal.open}
        editData={builderModal.editData}
        onClose={() => setBuilderModal({ open: false, editData: null })}
        onSuccess={(rule) => {
          setRules((p) => [ruleFromApi(rule), ...p]);
          push(`Rule "${rule.rule_name}" berhasil dibuat.`, "success");
        }}
        onUpdate={(rule) => {
          setRules((p) =>
            p.map((r) => (r.id === rule.id ? ruleFromApi(rule) : r)),
          );
          push(`Rule "${rule.rule_name}" berhasil diperbarui.`, "info");
        }}
      />

      <RuleDetailModal
        isOpen={ruleDetailModal.open}
        rule={liveRule}
        onClose={() => setRuleDetailModal({ open: false, rule: null })}
        onEdit={(rule) => {
          setRuleDetailModal({ open: false, rule: null });
          setBuilderModal({ open: true, editData: rule });
        }}
        onDelete={handleRuleDelete}
        onToggle={handleRuleToggle}
      />

      <div className="rm-toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`rm-toast t-${t.type}`}>
            <i className={`bi ${toastIcon(t.type)}`} />
            <span style={{ flex: 1 }}>{t.msg}</span>
            <button
              className="rm-toast-close"
              onClick={() => dismiss(t.id)}
              title="Tutup"
            >
              <i className="bi bi-x" />
            </button>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

const RefreshBtn = ({ onClick, loading, label }) => (
  <button
    onClick={onClick}
    disabled={loading}
    style={{
      display: "flex",
      alignItems: "center",
      gap: 6,
      padding: "8px 14px",
      borderRadius: 7,
      border: "1.5px solid #e5e7eb",
      background: "#fff",
      fontSize: "0.83rem",
      fontWeight: 600,
      color: loading ? "#9ca3af" : "#374151",
      cursor: loading ? "not-allowed" : "pointer",
    }}
    title={label}
  >
    <i
      className="bi bi-arrow-clockwise"
      style={loading ? { animation: "spin 1s linear infinite" } : {}}
    />
    {loading ? "Memuat..." : label}
  </button>
);

const ErrorBanner = ({ msg, onRetry }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "10px 16px",
      marginBottom: 16,
      background: "#fffbeb",
      border: "1px solid #fde68a",
      borderRadius: 8,
      fontSize: "0.85rem",
      color: "#92400e",
    }}
  >
    <i className="bi bi-exclamation-triangle-fill" />
    <span>
      <strong>{msg}</strong>{" "}
      <button
        onClick={onRetry}
        style={{
          background: "none",
          border: "none",
          color: "#b45309",
          fontWeight: 700,
          cursor: "pointer",
          padding: 0,
          textDecoration: "underline",
          fontFamily: "inherit",
        }}
      >
        Coba lagi
      </button>
    </span>
  </div>
);

export default RiskManagement;
