import React, { useEffect, useState } from "react";
import reportService from "../../services/reportService";

// ─── Constants ───────────────────────────────────────────────────────────────

const LAYANAN_OPTIONS = [
  {
    value: "AGENUSA",
    label: "Agenusa",
    icon: "shield-check",
    color: "#dc2626",
    desc: "Agen & Mitra Network",
  },
  {
    value: "NUSABILL",
    label: "Nusabill",
    icon: "receipt",
    color: "#2563eb",
    desc: "Billing & Payment Platform",
  },
];

const REPORT_TYPE_OPTIONS = [
  {
    value: "TRANSACTION",
    label: "All Transactions",
    icon: "arrow-left-right",
    color: "#7c3aed",
    desc: "Seluruh riwayat transaksi",
    finalStatus: null,
    group: "transaction",
  },
  {
    value: "TRANSACTION_FRAUD",
    label: "Transaction Rejected",
    icon: "exclamation-octagon-fill",
    color: "#dc2626",
    desc: "Transaksi terindikasi fraud",
    finalStatus: "FRAUD",
    group: "transaction",
  },
  {
    value: "TRANSACTION_SAFE",
    label: "Transaction Success",
    icon: "check-circle-fill",
    color: "#16a34a",
    desc: "Transaksi aman & valid",
    finalStatus: "SAFE",
    group: "transaction",
  },
  {
    value: "TRANSACTION_REVIEW",
    label: "Flagged Transactions",
    icon: "hourglass-split",
    color: "#ea580c",
    desc: "Transaksi sukses yang ditandai untuk review",
    finalStatus: "FLAGGED",
    group: "transaction",
  },
  {
    value: "FRAUD_DETECTION",
    label: "Fraud Summary Report",
    icon: "graph-up-arrow",
    color: "#0891b2",
    desc: "Ringkasan statistik fraud",
    finalStatus: null,
    group: "fraud_summary",
  },
  {
    value: "FRAUD_PATTERN",
    label: "Pattern List Report",
    icon: "diagram-3",
    color: "#7c3aed",
    desc: "Daftar & analisis pola fraud",
    finalStatus: null,
    group: "pattern",
  },
  {
    value: "GLOBAL_RULE",
    label: "Global Rule Report",
    icon: "list-check",
    color: "#f59e0b",
    desc: "Konfigurasi dan efektivitas Global Rule",
    finalStatus: null,
    group: "global_rule",
  },
  {
    value: "BLACKLIST",
    label: "Blacklist Report",
    icon: "ban",
    color: "#ea580c",
    desc: "Daftar item blacklist sistem",
    finalStatus: null,
    group: "blacklist",
  },
  {
    value: "ML_PERFORMANCE",
    label: "ML Performance",
    icon: "cpu",
    color: "#0d9488",
    desc: "Evaluasi model & retrain history",
    finalStatus: null,
    group: "ml",
  },
  {
    value: "ACTIVITY_LOG",
    label: "Activity Log",
    icon: "clock-history",
    color: "#6366f1",
    desc: "Log aktivitas admin & sistem",
    finalStatus: null,
    group: "activity",
  },
  {
    value: "MANUAL_REVIEW",
    label: "Manual Review",
    icon: "clipboard-check",
    color: "#0d9488",
    desc: "Riwayat keputusan fraud analyst",
    finalStatus: null,
    group: "review",
  },
];

const FORMAT_OPTIONS = [
  { value: "PDF", icon: "file-pdf-fill", color: "#dc2626" },
  { value: "XLSX", icon: "file-excel-fill", color: "#16a34a" },
  { value: "CSV", icon: "file-text-fill", color: "#2563eb" },
];

const RISK_LEVEL_OPTIONS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const BLACKLIST_TYPES_BY_SCOPE = {
  "": ["", "USER_ID", "CUSTOMER_ID", "ACCOUNT_NUMBER", "IP_ADDRESS", "TERMINAL_ID", "MERCHANT_ID"],
  ALL: ["", "CUSTOMER_ID", "MERCHANT_ID"],
  AGENUSA: ["", "USER_ID", "IP_ADDRESS", "TERMINAL_ID", "MERCHANT_ID", "ACCOUNT_NUMBER"],
  NUSABILL: ["", "CUSTOMER_ID", "IP_ADDRESS"],
};
const RISK_LEVEL_COLORS = {
  LOW: "#16a34a",
  MEDIUM: "#d97706",
  HIGH: "#ea580c",
  CRITICAL: "#dc2626",
};

// Action groups untuk Activity Log multi-select
const ACTIVITY_ACTION_GROUPS = [
  {
    group: "Fraud & Deteksi",
    color: "#dc2626",
    icon: "shield-exclamation",
    actions: [
      "ALERT_CREATED",
      "ALERT_UPDATED",
      "BLACKLIST_HIT",
      "PATTERN_TRIGGERED",
      "RULE_TRIGGERED",
      "FLAG_TRANSACTION",
    ],
  },
  {
    group: "Reviews",
    color: "#16a34a",
    icon: "eye",
    actions: [
      "REVIEW_APPROVED",
      "REVIEW_REJECTED",
      "REVIEW_OVERRIDDEN",
      "SOFT_DELETE_REVIEW",
      "REPORT_FALSE_NEGATIVE",
      "ALERT_CLAIMED",
      "ALERT_RELEASED",
    ],
  },
  {
    group: "Rules",
    color: "#2563eb",
    icon: "gear",
    actions: ["RULE_CREATED", "RULE_UPDATED", "RULE_DELETED", "RULE_TRIGGERED"],
  },
  {
    group: "Patterns",
    color: "#7c3aed",
    icon: "diagram-3",
    actions: [
      "PATTERN_CREATED",
      "PATTERN_UPDATED",
      "PATTERN_AUTO_DISABLE",
      "PATTERN_AUTO_PROMOTE",
      "PATTERN_REACTIVATED",
      "PATTERN_ACTIVATED",
      "PATTERN_DEACTIVATED",
      "PATTERN_TRIGGERED",
    ],
  },
  {
    group: "Blacklist",
    color: "#ea580c",
    icon: "ban",
    actions: [
      "BLACKLIST_ADD", "BLACKLIST_REMOVE", "BLACKLIST_CREATED",
      "BLACKLIST_UPDATED", "BLACKLIST_DELETED", "BLACKLIST_APPROVED",
      "BLACKLIST_REJECTED", "BLACKLIST_ACTIVATED", "BLACKLIST_DEACTIVATED",
      "BLACKLIST_BULK_IMPORT",
    ],
  },
  {
    group: "Auth & Session",
    color: "#6b7280",
    icon: "shield-lock",
    actions: [
      "LOGIN",
      "LOGIN_FAILED",
      "LOGOUT",
      "SESSION_REVOKED",
      "TOKEN_REFRESHED",
    ],
  },
  {
    group: "ML & Retrain",
    color: "#0d9488",
    icon: "cpu",
    actions: ["ML_SCORING_COMPLETED"],
  },
  {
    group: "Reports",
    color: "#2563eb",
    icon: "file-earmark-text",
    actions: ["REPORT_GENERATED", "REPORT_DOWNLOADED", "REPORT_DELETED"],
  },
  {
    group: "System",
    color: "#9ca3af",
    icon: "hdd-stack",
    actions: ["SLA_ESCALATION"],
  },
  {
    group: "User Actions",
    color: "#0891b2",
    icon: "person-gear",
    actions: [
      "ACCOUNT_CREATED", "ACCOUNT_SUSPENDED", "ACCOUNT_ROLE_CHANGED", "ACCOUNT_LOCKED",
      "ACCOUNT_ACTIVATED", "ACCOUNT_UPDATED", "ACCOUNT_DELETED", "PASSWORD_CHANGED", "PASSWORD_RESET",
    ],
  },
];

// Mapping Module Source (BE EventSourceEnum) → group names di ACTIVITY_ACTION_GROUPS
const MODULE_TO_GROUPS = {
  AUTH: ["Auth & Session", "User Actions"],
  RULE_ENGINE: ["Rules", "Fraud & Deteksi"],
  PATTERN_ENGINE: ["Patterns", "Fraud & Deteksi"],
  MANUAL_REVIEW: ["Reviews"],
  BLACKLIST: ["Blacklist", "Fraud & Deteksi"],
  ML: ["ML & Retrain"],
  SYSTEM: ["System", "User Actions"],
  REPORTS: ["Reports"],
};

const MODULE_OPTIONS = [
  "AUTH",
  "RULE_ENGINE",
  "PATTERN_ENGINE",
  "MANUAL_REVIEW",
  "BLACKLIST",
  "ML",
  "SYSTEM",
  "REPORTS",
];
const SEVERITY_OPTIONS = [
  { value: "INFO", color: "#6b7280" },
  { value: "WARNING", color: "#d97706" },
  { value: "HIGH", color: "#ea580c" },
  { value: "CRITICAL", color: "#dc2626" },
];

// ─── Shared styles ────────────────────────────────────────────────────────────
const labelStyle = {
  fontSize: ".75rem",
  letterSpacing: ".06em",
  color: "#525252",
  fontWeight: 600,
};
const inputStyle = {
  fontSize: ".875rem",
  borderRadius: 8,
  border: "1.5px solid #e5e5e5",
  padding: "8px 12px",
  width: "100%",
  outline: "none",
  fontFamily: "inherit",
};

const toJakartaDateTime = (date, isEndOfDay = false) =>
  `${date}T${isEndOfDay ? "23:59:59.999999" : "00:00:00"}+07:00`;

const getJakartaDate = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

// ─── Component ────────────────────────────────────────────────────────────────
const ReportGenerator = ({ onGenerate, onCancel }) => {
  const [reportType, setReportType] = useState("");
  const [layanan, setLayanan] = useState("");
  const [format, setFormat] = useState("PDF");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Transaction advanced filters
  const [riskLevel, setRiskLevel] = useState("");
  const [userAccountId, setUserAccountId] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [minRiskScore, setMinRiskScore] = useState("");
  const [maxRiskScore, setMaxRiskScore] = useState("");

  // Fraud Summary filters
  const [fraudSummaryService, setFraudSummaryService] = useState("");

  // Fraud Pattern filters
  const [patternRiskLevel, setPatternRiskLevel] = useState("");
  const [patternStatus, setPatternStatus] = useState("");
  const [patternCategory, setPatternCategory] = useState("");
  const [patternCategories, setPatternCategories] = useState([]);

  // Global Rule filters
  const [ruleScope, setRuleScope] = useState("");
  const [ruleIsActive, setRuleIsActive] = useState("");

  // Blacklist filters
  const [blType, setBlType] = useState("");
  const [blScope, setBlScope] = useState("");
  const [blIsActive, setBlIsActive] = useState("");
  const [blSource, setBlSource] = useState("");

  // Activity Log filters
  const [selectedActions, setSelectedActions] = useState(new Set());
  const [moduleSource, setModuleSource] = useState("");
  const [severity, setSeverity] = useState("");

  // Manual Review filters
  const [fraudAnalysts, setFraudAnalysts] = useState([]);
  const [analystsLoading, setAnalystsLoading] = useState(false);
  const [selectedReviewerId, setSelectedReviewerId] = useState("");

  const [generating, setGenerating] = useState(false);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState(null);

  const isActivityLog = reportType === "ACTIVITY_LOG";
  const isManualReview = reportType === "MANUAL_REVIEW";
  const isFraudPattern = reportType === "FRAUD_PATTERN";
  const isGlobalRule = reportType === "GLOBAL_RULE";
  const isFraudSummary = reportType === "FRAUD_DETECTION";
  const isBlacklist = reportType === "BLACKLIST";
  const isMLPerformance = reportType === "ML_PERFORMANCE";
  const isTransaction =
    reportType &&
    !isActivityLog &&
    !isManualReview &&
    !isFraudPattern &&
    !isGlobalRule &&
    !isFraudSummary &&
    !isBlacklist &&
    !isMLPerformance;
  const selectedOpt = REPORT_TYPE_OPTIONS.find((o) => o.value === reportType);
  const selectedAnalyst = fraudAnalysts.find(
    (analyst) => String(analyst.id) === String(selectedReviewerId),
  );
  const blacklistTypes = BLACKLIST_TYPES_BY_SCOPE[blScope] || BLACKLIST_TYPES_BY_SCOPE[""];

  const handleBlacklistScopeChange = (scope) => {
    setBlScope(scope);
    if (!(BLACKLIST_TYPES_BY_SCOPE[scope] || []).includes(blType)) {
      setBlType("");
    }
  };

  useEffect(() => {
    let ignore = false;

    const loadAnalysts = async () => {
      setAnalystsLoading(true);
      try {
        const data = await reportService.getFraudAnalysts();
        if (!ignore) setFraudAnalysts(Array.isArray(data) ? data : []);
      } catch {
        if (!ignore) setFraudAnalysts([]);
      } finally {
        if (!ignore) setAnalystsLoading(false);
      }
    };

    loadAnalysts();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!isFraudPattern) return;
    let ignore = false;

    reportService
      .getPatternCategories()
      .then((data) => {
        if (!ignore) {
          setPatternCategories(
            Array.isArray(data)
              ? data.filter((category) => typeof category === "string" && category.trim())
              : [],
          );
        }
      })
      .catch(() => {
        if (!ignore) setPatternCategories([]);
      });

    return () => {
      ignore = true;
    };
  }, [isFraudPattern]);

  // Reset filters saat ganti tipe laporan
  const handleReportTypeChange = (val) => {
    setReportType(val);
    setShowAdvanced(false);
    // Reset semua filter opsional
    setRiskLevel("");
    setUserAccountId("");
    setMinAmount("");
    setMaxAmount("");
    setMinRiskScore("");
    setMaxRiskScore("");
    setFraudSummaryService("");
    setPatternRiskLevel("");
    setPatternStatus("");
    setPatternCategory("");
    setRuleScope("");
    setRuleIsActive("");
    setBlType("");
    setBlScope("");
    setBlIsActive("");
    setBlSource("");
    setSelectedActions(new Set());
    setModuleSource("");
    setSeverity("");
    setSelectedReviewerId("");
  };

  const toggleAction = (action) => {
    setSelectedActions((prev) => {
      const next = new Set(prev);
      next.has(action) ? next.delete(action) : next.add(action);
      return next;
    });
  };

  const toggleGroupActions = (actions) => {
    const allSelected = actions.every((a) => selectedActions.has(a));
    setSelectedActions((prev) => {
      const next = new Set(prev);
      if (allSelected) actions.forEach((a) => next.delete(a));
      else actions.forEach((a) => next.add(a));
      return next;
    });
  };

  // Saat ganti Module Source, bersihkan selected actions yang tidak relevan
  const handleModuleSourceChange = (newModule) => {
    setModuleSource(newModule);
    if (!newModule) return; // clear filter — biarkan semua selection

    const allowedGroups = MODULE_TO_GROUPS[newModule] || [];
    const allowedActions = new Set(
      ACTIVITY_ACTION_GROUPS.filter(({ group }) =>
        allowedGroups.includes(group),
      ).flatMap(({ actions }) => actions),
    );
    setSelectedActions((prev) => {
      const next = new Set();
      prev.forEach((a) => {
        if (allowedActions.has(a)) next.add(a);
      });
      return next;
    });
  };

  const hasActivityAdvanced =
    selectedActions.size > 0 || moduleSource || severity;
  const hasTransactionAdvanced =
    riskLevel ||
    userAccountId ||
    minAmount ||
    maxAmount ||
    minRiskScore ||
    maxRiskScore;

  const validate = () => {
    const errs = {};
    if (!reportType) errs.reportType = "Pilih tipe laporan";
    if (isTransaction && !layanan)
      errs.layanan = "Pilih layanan terlebih dahulu";
    if (!isGlobalRule && !dateFrom) errs.dateFrom = "Tanggal mulai wajib diisi";
    if (!isGlobalRule && !dateTo) errs.dateTo = "Tanggal selesai wajib diisi";
    if (!isGlobalRule && dateFrom && dateTo && dateFrom > dateTo)
      errs.dateTo = "Tanggal selesai harus setelah tanggal mulai";
    if (minAmount && maxAmount && Number(minAmount) > Number(maxAmount))
      errs.maxAmount = "Max amount harus lebih besar dari min";
    if (
      minRiskScore &&
      maxRiskScore &&
      Number(minRiskScore) > Number(maxRiskScore)
    )
      errs.maxRiskScore = "Max risk score harus lebih besar dari min";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setGenerating(true);
    setApiError(null);

    const beReportType = [
      "TRANSACTION_FRAUD",
      "TRANSACTION_SAFE",
      "TRANSACTION_REVIEW",
    ].includes(reportType)
      ? "TRANSACTION"
      : reportType;

    const layananLabel =
      LAYANAN_OPTIONS.find((l) => l.value === layanan)?.label || "";
    const typeLabel = selectedOpt?.label || reportType;
    const reportName = isActivityLog
      ? `Activity Log (${dateFrom} s/d ${dateTo})`
      : isGlobalRule
        ? "Global Rule Report"
      : `${layananLabel} — ${typeLabel} (${dateFrom} s/d ${dateTo})`;

    const finalReportName = isManualReview
      ? `Manual Review${selectedAnalyst ? ` - ${selectedAnalyst.full_name}` : ""} (${dateFrom} s/d ${dateTo})`
      : reportName;

    const payload = {
      report_name: finalReportName,
      report_type: beReportType,
      format,
      // Report persistence still requires a date range. A configuration
      // snapshot uses a neutral range and the backend deliberately ignores it.
      date_from: toJakartaDateTime(isGlobalRule ? "2000-01-01" : dateFrom),
      date_to: toJakartaDateTime(isGlobalRule ? getJakartaDate() : dateTo, true),
    };

    if (isTransaction) {
      payload.service_source = layanan;
      if (selectedOpt?.finalStatus)
        payload.final_status = selectedOpt.finalStatus;
      if (riskLevel) payload.risk_level = riskLevel;
      if (userAccountId) payload.user_account_id = userAccountId.trim();
      if (minAmount) payload.min_amount = Number(minAmount);
      if (maxAmount) payload.max_amount = Number(maxAmount);
      if (minRiskScore) payload.min_risk_score = Number(minRiskScore);
      if (maxRiskScore) payload.max_risk_score = Number(maxRiskScore);
    }

    if (isFraudSummary) {
      if (fraudSummaryService) payload.service_source = fraudSummaryService;
    }

    if (isBlacklist) {
      if (blType) payload.blacklist_type = blType;
      if (blScope) payload.service_scope = blScope;
      if (blSource) payload.source = blSource;
      if (blIsActive !== "") payload.is_active = blIsActive === "true";
    }

    if (isFraudPattern) {
      // Backend schema uses RiskLevelEnum values in uppercase, while the UI
      // keeps these values lowercase for display/filter state.
      if (patternRiskLevel) payload.risk_level = patternRiskLevel.toUpperCase();
      if (patternStatus) payload.status = patternStatus;
      if (patternCategory) payload.category = patternCategory;
    }

    if (isGlobalRule) {
      if (ruleScope) payload.service_scope = ruleScope;
      if (ruleIsActive !== "") payload.is_active = ruleIsActive === "true";
    }

    if (isActivityLog) {
      // BE expect single action_type per request — kirim sebagai filter_criteria
      // Kalau ada multiple selections, kirim yang pertama saja (BE belum support array untuk activity log filter)
      if (selectedActions.size > 0)
        payload.action_types = [...selectedActions];
      if (moduleSource) payload.module_source = moduleSource;
      if (severity) payload.severity = severity;
    }

    if (isManualReview && selectedReviewerId) {
      payload.reviewer_id = Number(selectedReviewerId);
    }

    try {
      const report = await reportService.generateReport(payload);
      onGenerate(report);
    } catch (err) {
      setApiError(err.message || "Gagal generate report. Coba lagi.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="card report-generator-card">
      <div className="card-header">
        <h5 className="card-title mb-0">
          <i className="bi bi-magic me-2"></i>Generate New Report
        </h5>
      </div>

      <div className="card-body">
        {apiError && (
          <div
            className="alert alert-danger d-flex align-items-center gap-2 mb-3"
            style={{ fontSize: ".85rem" }}
          >
            <i className="bi bi-exclamation-triangle-fill"></i>
            {apiError}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* TIPE LAPORAN */}
          <div className="mb-4">
            <label className="form-label" style={labelStyle}>
              <i className="bi bi-file-earmark-bar-graph me-1 text-danger"></i>
              TIPE LAPORAN
            </label>
            <div className="d-flex gap-2 flex-wrap">
              {REPORT_TYPE_OPTIONS.map((opt) => {
                const active = reportType === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleReportTypeChange(opt.value)}
                    style={{
                      padding: "0.5rem 1rem",
                      border: active
                        ? `2px solid ${opt.color}`
                        : "2px solid #e5e5e5",
                      borderRadius: 8,
                      background: active ? `${opt.color}10` : "white",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      fontWeight: active ? 700 : 500,
                      fontSize: ".875rem",
                      color: active ? opt.color : "#525252",
                      transition: "all .18s",
                    }}
                  >
                    <i
                      className={`bi bi-${opt.icon}`}
                      style={{ fontSize: "1rem" }}
                    ></i>
                    {opt.label}
                    {active && (
                      <i
                        className="bi bi-check-circle-fill ms-1"
                        style={{ fontSize: ".8rem" }}
                      ></i>
                    )}
                  </button>
                );
              })}
            </div>
            {errors.reportType && (
              <div className="text-danger mt-1" style={{ fontSize: ".8rem" }}>
                <i className="bi bi-exclamation-circle me-1"></i>
                {errors.reportType}
              </div>
            )}
          </div>

          {/* LAYANAN — hanya tampil untuk Transaction types */}
          {isTransaction && (
            <div className="mb-4">
              <label className="form-label" style={labelStyle}>
                <i className="bi bi-grid-1x2 me-1 text-danger"></i>LAYANAN
              </label>
              <div className="d-flex gap-3 flex-wrap">
                {LAYANAN_OPTIONS.map((opt) => {
                  const active = layanan === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setLayanan(opt.value)}
                      style={{
                        flex: "1 1 200px",
                        padding: "1rem 1.25rem",
                        border: active
                          ? `2px solid ${opt.color}`
                          : "2px solid #e5e5e5",
                        borderRadius: 10,
                        background: active ? `${opt.color}08` : "white",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: ".875rem",
                        transition: "all .2s",
                        textAlign: "left",
                      }}
                    >
                      <span
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 9,
                          background: active ? `${opt.color}15` : "#f5f5f5",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <i
                          className={`bi bi-${opt.icon}`}
                          style={{
                            fontSize: "1.15rem",
                            color: active ? opt.color : "#737373",
                          }}
                        ></i>
                      </span>
                      <div>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: ".9rem",
                            color: active ? opt.color : "#262626",
                          }}
                        >
                          {opt.label}
                        </div>
                        <div
                          style={{
                            fontSize: ".75rem",
                            color: "#737373",
                            marginTop: 2,
                          }}
                        >
                          {opt.desc}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {errors.layanan && (
                <div className="text-danger mt-1" style={{ fontSize: ".8rem" }}>
                  <i className="bi bi-exclamation-circle me-1"></i>
                  {errors.layanan}
                </div>
              )}
            </div>
          )}

          {/* TANGGAL */}
          {!isGlobalRule && <>
          <div className="row g-3 mb-2">
            <div className="col-md-6">
              <label className="form-label" style={labelStyle}>
                <i className="bi bi-calendar-range me-1 text-danger"></i>TANGGAL
                MULAI
              </label>
              <input
                type="date"
                className="form-control"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
              {errors.dateFrom && (
                <div className="text-danger mt-1" style={{ fontSize: ".8rem" }}>
                  <i className="bi bi-exclamation-circle me-1"></i>
                  {errors.dateFrom}
                </div>
              )}
            </div>
            <div className="col-md-6">
              <label className="form-label" style={labelStyle}>
                <i className="bi bi-calendar-check me-1 text-danger"></i>TANGGAL
                SELESAI
              </label>
              <input
                type="date"
                className="form-control"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(e) => setDateTo(e.target.value)}
              />
              {errors.dateTo && (
                <div className="text-danger mt-1" style={{ fontSize: ".8rem" }}>
                  <i className="bi bi-exclamation-circle me-1"></i>
                  {errors.dateTo}
                </div>
              )}
            </div>
          </div>
          {isMLPerformance ? (
            <div
              style={{
                fontSize: ".75rem",
                color: "#6b7280",
                marginBottom: "1rem",
                display: "flex",
                alignItems: "center",
                gap: ".35rem",
              }}
            >
              <i className="bi bi-info-circle"></i>
              Tanggal hanya memfilter <strong>Retrain History</strong>. Info
              model & fitur selalu menampilkan data terkini.
            </div>
          ) : (
            <div className="mb-2"></div>
          )}
          </>}

          {isManualReview && (
            <div className="mb-4">
              <label className="form-label" style={labelStyle}>
                <i className="bi bi-person-check me-1 text-danger"></i>FRAUD
                ANALYST
              </label>
              <select
                className="form-select"
                style={inputStyle}
                value={selectedReviewerId}
                onChange={(e) => setSelectedReviewerId(e.target.value)}
                disabled={analystsLoading}
              >
                <option value="">
                  {analystsLoading
                    ? "Memuat fraud analyst..."
                    : "Semua Fraud Analyst"}
                </option>
                {fraudAnalysts.map((analyst) => (
                  <option key={analyst.id} value={analyst.id}>
                    {analyst.full_name} - {analyst.email}
                  </option>
                ))}
              </select>
              <div
                style={{
                  fontSize: ".75rem",
                  color: "#6b7280",
                  marginTop: ".45rem",
                  display: "flex",
                  alignItems: "center",
                  gap: ".35rem",
                }}
              >
                <i className="bi bi-info-circle"></i>
                Kosongkan untuk membuat laporan seluruh review. Pilih satu
                analyst untuk laporan review milik analyst tersebut saja.
              </div>
            </div>
          )}

          {/* FORMAT */}
          <div className="mb-4">
            <label className="form-label" style={labelStyle}>
              <i className="bi bi-filetype-pdf me-1 text-danger"></i>FORMAT
              EXPORT
            </label>
            <div className="d-flex gap-2 flex-wrap">
              {FORMAT_OPTIONS.map((opt) => {
                const active = format === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFormat(opt.value)}
                    style={{
                      padding: "0.6rem 1.25rem",
                      border: active
                        ? `2px solid ${opt.color}`
                        : "2px solid #e5e5e5",
                      borderRadius: 8,
                      background: active ? `${opt.color}10` : "white",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: ".5rem",
                      fontWeight: active ? 700 : 500,
                      fontSize: ".875rem",
                      color: active ? opt.color : "#525252",
                      transition: "all .18s",
                    }}
                  >
                    <i
                      className={`bi bi-${opt.icon}`}
                      style={{ fontSize: "1rem" }}
                    ></i>
                    {opt.value}
                    {active && (
                      <i
                        className="bi bi-check-circle-fill ms-1"
                        style={{ fontSize: ".8rem" }}
                      ></i>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── ADVANCED FILTERS: TRANSACTION ── */}
          {isTransaction && (
            <div className="mb-4">
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: ".5rem",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  fontSize: ".85rem",
                  fontWeight: 600,
                  color: hasTransactionAdvanced ? "#dc2626" : "#737373",
                }}
              >
                <i
                  className={`bi bi-${showAdvanced ? "chevron-up" : "sliders"}`}
                ></i>
                Advanced Filters
                {hasTransactionAdvanced && (
                  <span
                    style={{
                      background: "#dc2626",
                      color: "#fff",
                      borderRadius: 20,
                      padding: "1px 8px",
                      fontSize: ".7rem",
                    }}
                  >
                    Aktif
                  </span>
                )}
              </button>

              {showAdvanced && (
                <div
                  style={{
                    marginTop: "1rem",
                    padding: "1rem",
                    background: "#fafafa",
                    borderRadius: 10,
                    border: "1px solid #e5e5e5",
                  }}
                >
                  <div className="row g-3">
                    {/* Risk Level */}
                    <div className="col-md-6">
                      <label className="form-label" style={labelStyle}>
                        RISK LEVEL
                      </label>
                      <div className="d-flex gap-2 flex-wrap">
                        {RISK_LEVEL_OPTIONS.map((lvl) => {
                          const active = riskLevel === lvl;
                          return (
                            <button
                              key={lvl}
                              type="button"
                              onClick={() => setRiskLevel(active ? "" : lvl)}
                              style={{
                                padding: "4px 12px",
                                border: active
                                  ? `2px solid ${RISK_LEVEL_COLORS[lvl]}`
                                  : "1.5px solid #e5e5e5",
                                borderRadius: 20,
                                background: active
                                  ? `${RISK_LEVEL_COLORS[lvl]}15`
                                  : "white",
                                cursor: "pointer",
                                fontSize: ".78rem",
                                fontWeight: active ? 700 : 500,
                                color: active
                                  ? RISK_LEVEL_COLORS[lvl]
                                  : "#525252",
                              }}
                            >
                              {lvl}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* User Account ID */}
                    <div className="col-md-6">
                      <label className="form-label" style={labelStyle}>
                        USER ACCOUNT ID
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: user999"
                        style={inputStyle}
                        value={userAccountId}
                        onChange={(e) => setUserAccountId(e.target.value)}
                      />
                    </div>

                    {/* Amount Range */}
                    <div className="col-md-3">
                      <label className="form-label" style={labelStyle}>
                        MIN AMOUNT (Rp)
                      </label>
                      <input
                        type="number"
                        placeholder="50000"
                        style={inputStyle}
                        value={minAmount}
                        onChange={(e) => setMinAmount(e.target.value)}
                        min={0}
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label" style={labelStyle}>
                        MAX AMOUNT (Rp)
                      </label>
                      <input
                        type="number"
                        placeholder="10000000"
                        style={inputStyle}
                        value={maxAmount}
                        onChange={(e) => setMaxAmount(e.target.value)}
                        min={0}
                      />
                      {errors.maxAmount && (
                        <div
                          className="text-danger mt-1"
                          style={{ fontSize: ".75rem" }}
                        >
                          {errors.maxAmount}
                        </div>
                      )}
                    </div>

                    {/* Risk Score Range */}
                    <div className="col-md-3">
                      <label className="form-label" style={labelStyle}>
                        MIN RISK SCORE
                      </label>
                      <input
                        type="number"
                        placeholder="0"
                        style={inputStyle}
                        value={minRiskScore}
                        onChange={(e) => setMinRiskScore(e.target.value)}
                        min={0}
                        max={100}
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label" style={labelStyle}>
                        MAX RISK SCORE
                      </label>
                      <input
                        type="number"
                        placeholder="100"
                        style={inputStyle}
                        value={maxRiskScore}
                        onChange={(e) => setMaxRiskScore(e.target.value)}
                        min={0}
                        max={100}
                      />
                      {errors.maxRiskScore && (
                        <div
                          className="text-danger mt-1"
                          style={{ fontSize: ".75rem" }}
                        >
                          {errors.maxRiskScore}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── FILTERS: BLACKLIST ── */}
          {isBlacklist && (
            <div className="mb-4">
              <label className="form-label" style={labelStyle}>
                <i className="bi bi-funnel me-1 text-danger"></i>FILTER
                BLACKLIST
              </label>
              <div
                style={{
                  padding: "1rem",
                  background: "#fafafa",
                  borderRadius: 10,
                  border: "1px solid #e5e5e5",
                }}
              >
                <div className="row g-3">
                  {/* Type */}
                  <div className="col-12">
                    <label
                      className="form-label"
                      style={{ ...labelStyle, fontSize: ".7rem" }}
                    >
                      TYPE
                    </label>
                    <div className="d-flex gap-2 flex-wrap">
                      {blacklistTypes.map((t) => {
                        const active = blType === t;
                        return (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setBlType(t)}
                            style={{
                              padding: "3px 12px",
                              border: active
                                ? "1.5px solid #ea580c"
                                : "1.5px solid #e5e5e5",
                              borderRadius: 20,
                              background: active ? "#fff7ed" : "white",
                              cursor: "pointer",
                              fontSize: ".72rem",
                              fontWeight: active ? 700 : 400,
                              color: active ? "#ea580c" : "#525252",
                            }}
                          >
                            {t || "Semua"}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Service Scope */}
                  <div className="col-md-4">
                    <label
                      className="form-label"
                      style={{ ...labelStyle, fontSize: ".7rem" }}
                    >
                      SERVICE SCOPE
                    </label>
                    <div className="d-flex gap-2 flex-wrap">
                      {[
                        { value: "", label: "Semua", color: "#6b7280" },
                        { value: "ALL", label: "ALL", color: "#6b7280" },
                        {
                          value: "AGENUSA",
                          label: "AGENUSA",
                          color: "#dc2626",
                        },
                        {
                          value: "NUSABILL",
                          label: "NUSABILL",
                          color: "#2563eb",
                        },
                      ].map((opt) => {
                        const active = blScope === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => handleBlacklistScopeChange(opt.value)}
                            style={{
                              padding: "3px 12px",
                              border: active
                                ? `1.5px solid ${opt.color}`
                                : "1.5px solid #e5e5e5",
                              borderRadius: 20,
                              background: active ? `${opt.color}12` : "white",
                              cursor: "pointer",
                              fontSize: ".75rem",
                              fontWeight: active ? 700 : 400,
                              color: active ? opt.color : "#525252",
                            }}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Status Active */}
                  <div className="col-md-4">
                    <label
                      className="form-label"
                      style={{ ...labelStyle, fontSize: ".7rem" }}
                    >
                      STATUS
                    </label>
                    <div className="d-flex gap-2 flex-wrap">
                      {[
                        { value: "", label: "Semua", color: "#6b7280" },
                        { value: "true", label: "Active", color: "#16a34a" },
                        { value: "false", label: "Inactive", color: "#9ca3af" },
                      ].map((opt) => {
                        const active = blIsActive === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setBlIsActive(opt.value)}
                            style={{
                              padding: "3px 12px",
                              border: active
                                ? `1.5px solid ${opt.color}`
                                : "1.5px solid #e5e5e5",
                              borderRadius: 20,
                              background: active ? `${opt.color}12` : "white",
                              cursor: "pointer",
                              fontSize: ".75rem",
                              fontWeight: active ? 700 : 400,
                              color: active ? opt.color : "#525252",
                            }}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Source */}
                  <div className="col-md-4">
                    <label
                      className="form-label"
                      style={{ ...labelStyle, fontSize: ".7rem" }}
                    >
                      SOURCE
                    </label>
                    <div className="d-flex gap-2 flex-wrap">
                      {[
                        { value: "", label: "Semua", color: "#6b7280" },
                        { value: "MANUAL", label: "Manual", color: "#7c3aed" },
                        { value: "IMPORT", label: "Import", color: "#0891b2" },
                      ].map((opt) => {
                        const active = blSource === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setBlSource(opt.value)}
                            style={{
                              padding: "3px 12px",
                              border: active
                                ? `1.5px solid ${opt.color}`
                                : "1.5px solid #e5e5e5",
                              borderRadius: 20,
                              background: active ? `${opt.color}12` : "white",
                              cursor: "pointer",
                              fontSize: ".75rem",
                              fontWeight: active ? 700 : 400,
                              color: active ? opt.color : "#525252",
                            }}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── FILTERS: FRAUD SUMMARY ── */}
          {isFraudSummary && (
            <div className="mb-4">
              <label className="form-label" style={labelStyle}>
                <i className="bi bi-grid-1x2 me-1 text-danger"></i>
                FILTER LAYANAN
                <span
                  style={{
                    fontWeight: 400,
                    color: "#9ca3af",
                    textTransform: "none",
                    letterSpacing: 0,
                    marginLeft: 6,
                  }}
                >
                  — opsional, kosongkan untuk semua layanan
                </span>
              </label>
              <div className="d-flex gap-2 flex-wrap">
                {[
                  { value: "", label: "Semua Layanan", color: "#6b7280" },
                  { value: "AGENUSA", label: "Agenusa", color: "#dc2626" },
                  { value: "NUSABILL", label: "Nusabill", color: "#2563eb" },
                ].map((opt) => {
                  const active = fraudSummaryService === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setFraudSummaryService(opt.value)}
                      style={{
                        padding: "6px 16px",
                        border: active
                          ? `2px solid ${opt.color}`
                          : "2px solid #e5e5e5",
                        borderRadius: 20,
                        background: active ? `${opt.color}10` : "white",
                        cursor: "pointer",
                        fontSize: ".85rem",
                        fontWeight: active ? 700 : 500,
                        color: active ? opt.color : "#525252",
                      }}
                    >
                      {active && (
                        <i
                          className="bi bi-check-circle-fill me-1"
                          style={{ fontSize: ".75rem" }}
                        ></i>
                      )}
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── FILTERS: GLOBAL RULE ── */}
          {isGlobalRule && (
            <div className="mb-4">
              <label className="form-label" style={labelStyle}>
                <i className="bi bi-funnel me-1 text-danger"></i>FILTER GLOBAL RULE
              </label>
              <div
                style={{
                  padding: "1rem",
                  background: "#fffbeb",
                  borderRadius: 10,
                  border: "1px solid #fde68a",
                }}
              >
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label" style={{ ...labelStyle, fontSize: ".7rem" }}>
                      SERVICE SCOPE
                    </label>
                    <div className="d-flex gap-2 flex-wrap">
                      {[
                        { value: "", label: "Semua", color: "#6b7280" },
                        { value: "ALL", label: "ALL", color: "#6b7280" },
                        { value: "AGENUSA", label: "AGENUSA", color: "#dc2626" },
                        { value: "NUSABILL", label: "NUSABILL", color: "#2563eb" },
                      ].map((opt) => {
                        const active = ruleScope === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setRuleScope(opt.value)}
                            style={{
                              padding: "3px 12px",
                              border: active ? `1.5px solid ${opt.color}` : "1.5px solid #e5e5e5",
                              borderRadius: 20,
                              background: active ? `${opt.color}12` : "white",
                              cursor: "pointer",
                              fontSize: ".75rem",
                              fontWeight: active ? 700 : 400,
                              color: active ? opt.color : "#525252",
                            }}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" style={{ ...labelStyle, fontSize: ".7rem" }}>
                      STATUS
                    </label>
                    <div className="d-flex gap-2 flex-wrap">
                      {[
                        { value: "", label: "Semua", color: "#6b7280" },
                        { value: "true", label: "Active", color: "#16a34a" },
                        { value: "false", label: "Inactive", color: "#9ca3af" },
                      ].map((opt) => {
                        const active = ruleIsActive === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setRuleIsActive(opt.value)}
                            style={{
                              padding: "3px 12px",
                              border: active ? `1.5px solid ${opt.color}` : "1.5px solid #e5e5e5",
                              borderRadius: 20,
                              background: active ? `${opt.color}12` : "white",
                              cursor: "pointer",
                              fontSize: ".75rem",
                              fontWeight: active ? 700 : 400,
                              color: active ? opt.color : "#525252",
                            }}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── FILTERS: FRAUD PATTERN ── */}
          {isFraudPattern && (
            <div className="mb-4">
              <label className="form-label" style={labelStyle}>
                <i className="bi bi-funnel me-1 text-danger"></i>FILTER PATTERN
              </label>
              <div
                style={{
                  padding: "1rem",
                  background: "#fafafa",
                  borderRadius: 10,
                  border: "1px solid #e5e5e5",
                }}
              >
                <div className="row g-3">
                  {/* Risk Level */}
                  <div className="col-md-4">
                    <label
                      className="form-label"
                      style={{ ...labelStyle, fontSize: ".7rem" }}
                    >
                      RISK LEVEL
                    </label>
                    <div className="d-flex gap-2 flex-wrap">
                      {[
                        { value: "", label: "Semua", color: "#6b7280" },
                        { value: "high", label: "High", color: "#dc2626" },
                        { value: "medium", label: "Medium", color: "#d97706" },
                        { value: "low", label: "Low", color: "#2563eb" },
                      ].map((opt) => {
                        const active = patternRiskLevel === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setPatternRiskLevel(opt.value)}
                            style={{
                              padding: "3px 12px",
                              border: active
                                ? `1.5px solid ${opt.color}`
                                : "1.5px solid #e5e5e5",
                              borderRadius: 20,
                              background: active ? `${opt.color}12` : "white",
                              cursor: "pointer",
                              fontSize: ".75rem",
                              fontWeight: active ? 700 : 400,
                              color: active ? opt.color : "#525252",
                            }}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Status */}
                  <div className="col-md-4">
                    <label
                      className="form-label"
                      style={{ ...labelStyle, fontSize: ".7rem" }}
                    >
                      STATUS
                    </label>
                    <div className="d-flex gap-2 flex-wrap">
                      {[
                        { value: "", label: "Semua", color: "#6b7280" },
                        { value: "active", label: "Active", color: "#16a34a" },
                        {
                          value: "inactive",
                          label: "Inactive",
                          color: "#9ca3af",
                        },
                      ].map((opt) => {
                        const active = patternStatus === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setPatternStatus(opt.value)}
                            style={{
                              padding: "3px 12px",
                              border: active
                                ? `1.5px solid ${opt.color}`
                                : "1.5px solid #e5e5e5",
                              borderRadius: 20,
                              background: active ? `${opt.color}12` : "white",
                              cursor: "pointer",
                              fontSize: ".75rem",
                              fontWeight: active ? 700 : 400,
                              color: active ? opt.color : "#525252",
                            }}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Category */}
                  <div className="col-md-4">
                    <label
                      className="form-label"
                      style={{ ...labelStyle, fontSize: ".7rem" }}
                    >
                      CATEGORY
                    </label>
                    <div className="d-flex gap-2 flex-wrap">
                      {["", ...patternCategories].map((cat) => {
                        const active = patternCategory === cat;
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setPatternCategory(cat)}
                            style={{
                              padding: "3px 12px",
                              border: active
                                ? "1.5px solid #7c3aed"
                                : "1.5px solid #e5e5e5",
                              borderRadius: 20,
                              background: active ? "#f5f3ff" : "white",
                              cursor: "pointer",
                              fontSize: ".72rem",
                              fontWeight: active ? 700 : 400,
                              color: active ? "#7c3aed" : "#525252",
                            }}
                          >
                            {cat || "Semua"}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── ADVANCED FILTERS: ACTIVITY LOG ── */}
          {isActivityLog && (
            <div className="mb-4">
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: ".5rem",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  fontSize: ".85rem",
                  fontWeight: 600,
                  color: hasActivityAdvanced ? "#6366f1" : "#737373",
                }}
              >
                <i
                  className={`bi bi-${showAdvanced ? "chevron-up" : "sliders"}`}
                ></i>
                Filter Activity Log
                {hasActivityAdvanced && (
                  <span
                    style={{
                      background: "#6366f1",
                      color: "#fff",
                      borderRadius: 20,
                      padding: "1px 8px",
                      fontSize: ".7rem",
                    }}
                  >
                    {selectedActions.size +
                      (moduleSource ? 1 : 0) +
                      (severity ? 1 : 0)}{" "}
                    aktif
                  </span>
                )}
              </button>

              {showAdvanced && (
                <div
                  style={{
                    marginTop: "1rem",
                    padding: "1rem",
                    background: "#fafafa",
                    borderRadius: 10,
                    border: "1px solid #e5e5e5",
                  }}
                >
                  <div className="row g-3 mb-3">
                    {/* Module Source */}
                    <div className="col-md-6">
                      <label className="form-label" style={labelStyle}>
                        MODULE SOURCE
                      </label>
                      <div className="d-flex gap-2 flex-wrap">
                        {MODULE_OPTIONS.map((m) => {
                          const active = moduleSource === m;
                          return (
                            <button
                              key={m}
                              type="button"
                              onClick={() =>
                                handleModuleSourceChange(active ? "" : m)
                              }
                              style={{
                                padding: "4px 12px",
                                border: active
                                  ? "1.5px solid #6366f1"
                                  : "1.5px solid #e5e5e5",
                                borderRadius: 20,
                                background: active ? "#eef2ff" : "white",
                                cursor: "pointer",
                                fontSize: ".75rem",
                                fontWeight: active ? 700 : 400,
                                color: active ? "#6366f1" : "#525252",
                              }}
                            >
                              {m}
                            </button>
                          );
                        })}
                      </div>
                      {moduleSource && (
                        <div
                          style={{
                            fontSize: ".72rem",
                            color: "#6366f1",
                            marginTop: 4,
                          }}
                        >
                          <i className="bi bi-funnel me-1"></i>
                          Action Type di bawah otomatis difilter sesuai modul
                          ini
                        </div>
                      )}
                    </div>

                    {/* Severity */}
                    <div className="col-md-6">
                      <label className="form-label" style={labelStyle}>
                        SEVERITY MINIMUM
                        <span
                          style={{
                            fontWeight: 400,
                            color: "#9ca3af",
                            textTransform: "none",
                            letterSpacing: 0,
                            marginLeft: 4,
                          }}
                        >
                          — ke atas
                        </span>
                      </label>
                      <div className="d-flex gap-2 flex-wrap">
                        {SEVERITY_OPTIONS.map(({ value, color }) => {
                          const active = severity === value;
                          return (
                            <button
                              key={value}
                              type="button"
                              onClick={() => setSeverity(active ? "" : value)}
                              style={{
                                padding: "4px 12px",
                                border: active
                                  ? `1.5px solid ${color}`
                                  : "1.5px solid #e5e5e5",
                                borderRadius: 20,
                                background: active ? `${color}12` : "white",
                                cursor: "pointer",
                                fontSize: ".75rem",
                                fontWeight: active ? 700 : 400,
                                color: active ? color : "#525252",
                              }}
                              title={`Tampilkan ${value} ke atas`}
                            >
                              {value}
                              {active && (
                                <span
                                  style={{ marginLeft: 4, fontSize: ".65rem" }}
                                >
                                  +
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      {severity && (
                        <div
                          style={{
                            fontSize: ".72rem",
                            color: "#6b7280",
                            marginTop: 4,
                          }}
                        >
                          <i className="bi bi-info-circle me-1"></i>
                          Menampilkan:{" "}
                          {SEVERITY_OPTIONS.slice(
                            SEVERITY_OPTIONS.findIndex(
                              (s) => s.value === severity,
                            ),
                          )
                            .map((s) => s.value)
                            .join(", ")}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Type Multi-select per group */}
                  <div className="mb-3">
                    <label
                      className="form-label d-flex align-items-center justify-content-between"
                      style={labelStyle}
                    >
                      <span>
                        ACTION TYPE{" "}
                        <span
                          style={{
                            fontWeight: 400,
                            color: "#9ca3af",
                            textTransform: "none",
                            letterSpacing: 0,
                          }}
                        >
                          — pilih satu atau lebih
                        </span>
                        {moduleSource && (
                          <span
                            style={{
                              marginLeft: 6,
                              fontWeight: 400,
                              color: "#6366f1",
                              textTransform: "none",
                              letterSpacing: 0,
                              fontSize: ".72rem",
                            }}
                          >
                            (difilter: {moduleSource})
                          </span>
                        )}
                      </span>
                      {selectedActions.size > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedActions(new Set())}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            fontSize: ".75rem",
                            color: "#dc2626",
                            padding: 0,
                          }}
                        >
                          <i className="bi bi-x-circle me-1"></i>Reset (
                          {selectedActions.size})
                        </button>
                      )}
                    </label>

                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: ".75rem",
                      }}
                    >
                      {ACTIVITY_ACTION_GROUPS.filter(
                        ({ group }) =>
                          !moduleSource ||
                          (MODULE_TO_GROUPS[moduleSource] || []).includes(group),
                      ).map(({ group, color, icon, actions }) => {
                        const allSelected = actions.every((a) =>
                          selectedActions.has(a),
                        );
                        const someSelected = actions.some((a) =>
                          selectedActions.has(a),
                        );
                        return (
                          <div key={group}>
                            {/* Group header */}
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: ".5rem",
                                marginBottom: ".35rem",
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => toggleGroupActions(actions)}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: ".35rem",
                                  background: allSelected
                                    ? `${color}10`
                                    : someSelected
                                      ? `${color}06`
                                      : "#f5f5f5",
                                  border: `1.5px solid ${allSelected || someSelected ? color : "#e5e5e5"}`,
                                  borderRadius: 6,
                                  padding: "3px 10px",
                                  cursor: "pointer",
                                  fontSize: ".75rem",
                                  fontWeight: 700,
                                  color:
                                    allSelected || someSelected
                                      ? color
                                      : "#737373",
                                }}
                              >
                                <i className={`bi bi-${icon}`}></i>
                                {group}
                                {someSelected && !allSelected && (
                                  <span style={{ fontSize: ".65rem" }}>
                                    (
                                    {
                                      actions.filter((a) =>
                                        selectedActions.has(a),
                                      ).length
                                    }
                                    /{actions.length})
                                  </span>
                                )}
                                {allSelected && (
                                  <i
                                    className="bi bi-check-circle-fill ms-1"
                                    style={{ fontSize: ".7rem" }}
                                  ></i>
                                )}
                              </button>
                            </div>

                            {/* Action chips */}
                            <div
                              style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: ".35rem",
                                paddingLeft: ".5rem",
                              }}
                            >
                              {actions.map((action) => {
                                const active = selectedActions.has(action);
                                return (
                                  <button
                                    key={action}
                                    type="button"
                                    onClick={() => toggleAction(action)}
                                    style={{
                                      padding: "3px 10px",
                                      border: active
                                        ? `1.5px solid ${color}`
                                        : "1.5px solid #e5e5e5",
                                      borderRadius: 20,
                                      background: active
                                        ? `${color}12`
                                        : "white",
                                      cursor: "pointer",
                                      fontSize: ".72rem",
                                      fontWeight: active ? 700 : 400,
                                      color: active ? color : "#525252",
                                      transition: "all .15s",
                                    }}
                                  >
                                    {action.replace(/_/g, " ")}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Summary preview */}
          {reportType &&
            (isGlobalRule || (dateFrom && dateTo)) &&
            (isActivityLog ||
              isFraudPattern ||
              isGlobalRule ||
              isFraudSummary ||
              isBlacklist ||
              isMLPerformance ||
              isManualReview ||
              layanan) && (
              <div
                style={{
                  padding: ".875rem 1rem",
                  background: isActivityLog
                    ? "#eef2ff"
                    : isFraudPattern
                      ? "#f5f3ff"
                      : isGlobalRule
                        ? "#fffbeb"
                      : isFraudSummary
                        ? "#f0f9ff"
                        : isBlacklist
                          ? "#fff7ed"
                          : isMLPerformance
                            ? "#f0fdfa"
                            : isManualReview
                              ? "#f0fdfa"
                              : "#fef2f2",
                  border: `1px solid ${isActivityLog ? "#c7d2fe" : isFraudPattern ? "#ddd6fe" : isGlobalRule ? "#fde68a" : isFraudSummary ? "#bae6fd" : isBlacklist ? "#fed7aa" : isMLPerformance || isManualReview ? "#99f6e4" : "#fecaca"}`,
                  borderRadius: 8,
                  marginBottom: "1.25rem",
                  fontSize: ".82rem",
                  color: isActivityLog
                    ? "#4338ca"
                    : isFraudPattern
                      ? "#6d28d9"
                      : isGlobalRule
                        ? "#92400e"
                      : isFraudSummary
                        ? "#0369a1"
                        : isBlacklist
                          ? "#c2410c"
                          : isMLPerformance
                            ? "#0f766e"
                            : isManualReview
                              ? "#0f766e"
                              : "#991b1b",
                  display: "flex",
                  alignItems: "center",
                  gap: ".625rem",
                }}
              >
                <i
                  className="bi bi-info-circle-fill"
                  style={{ fontSize: "1rem", flexShrink: 0 }}
                ></i>
                <span>
                  {isActivityLog ? (
                    <>
                      Akan generate <strong>Activity Log</strong> format{" "}
                      <strong>{format}</strong> — periode{" "}
                      <strong>
                        {dateFrom} s/d {dateTo}
                      </strong>
                      {selectedActions.size > 0 && (
                        <>
                          {" "}
                          · <strong>{selectedActions.size}</strong> action type
                          dipilih
                        </>
                      )}
                    </>
                  ) : isFraudPattern ? (
                    <>
                      Akan generate <strong>Pattern List Report</strong> format{" "}
                      <strong>{format}</strong>
                      {patternRiskLevel && (
                        <>
                          {" "}
                          · Risk: <strong>{patternRiskLevel}</strong>
                        </>
                      )}
                      {patternStatus && (
                        <>
                          {" "}
                          · Status: <strong>{patternStatus}</strong>
                        </>
                      )}
                    </>
                  ) : isGlobalRule ? (
                    <>
                      Akan generate <strong>Global Rule Report</strong> format{" "}
                      <strong>{format}</strong> — snapshot konfigurasi saat ini
                      {ruleScope && (
                        <> · Layanan: <strong>{ruleScope}</strong></>
                      )}
                      {ruleIsActive !== "" && (
                        <>
                          {" "}· Status: <strong>{ruleIsActive === "true" ? "Active" : "Inactive"}</strong>
                        </>
                      )}
                    </>
                  ) : isFraudSummary ? (
                    <>
                      Akan generate <strong>Fraud Summary Report</strong> format{" "}
                      <strong>{format}</strong> — periode{" "}
                      <strong>
                        {dateFrom} s/d {dateTo}
                      </strong>{" "}
                      · Layanan:{" "}
                      <strong>{fraudSummaryService || "Semua"}</strong>
                    </>
                  ) : isBlacklist ? (
                    <>
                      Akan generate <strong>Blacklist Report</strong> format{" "}
                      <strong>{format}</strong>
                      {blType && (
                        <>
                          {" "}
                          · Type: <strong>{blType}</strong>
                        </>
                      )}
                      {blScope && (
                        <>
                          {" "}
                          · Scope: <strong>{blScope}</strong>
                        </>
                      )}
                      {blIsActive !== "" && (
                        <>
                          {" "}
                          · Status:{" "}
                          <strong>
                            {blIsActive === "true" ? "Active" : "Inactive"}
                          </strong>
                        </>
                      )}
                    </>
                  ) : isMLPerformance ? (
                    <>
                      Akan generate <strong>ML Performance Report</strong>{" "}
                      format <strong>{format}</strong> — info model & fitur
                      (snapshot terkini) + retrain history periode{" "}
                      <strong>
                        {dateFrom} s/d {dateTo}
                      </strong>
                    </>
                  ) : isManualReview ? (
                    <>
                      Akan generate <strong>Manual Review Report</strong>{" "}
                      format <strong>{format}</strong> - periode{" "}
                      <strong>
                        {dateFrom} s/d {dateTo}
                      </strong>{" "}
                      - Analyst:{" "}
                      <strong>{selectedAnalyst?.full_name || "Semua"}</strong>
                    </>
                  ) : (
                    <>
                      Akan generate laporan{" "}
                      <strong>{selectedOpt?.label}</strong> dari{" "}
                      <strong>
                        {
                          LAYANAN_OPTIONS.find((l) => l.value === layanan)
                            ?.label
                        }
                      </strong>{" "}
                      format <strong>{format}</strong> — periode{" "}
                      <strong>
                        {dateFrom} s/d {dateTo}
                      </strong>
                    </>
                  )}
                </span>
              </div>
            )}

          <div className="d-flex gap-2 justify-content-end">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={onCancel}
              disabled={generating}
            >
              <i className="bi bi-x-circle me-1"></i>Cancel
            </button>
            <button
              type="submit"
              className="btn btn-danger"
              disabled={generating}
            >
              {generating ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-1"
                    role="status"
                  ></span>
                  Generating…
                </>
              ) : (
                <>
                  <i className="bi bi-file-earmark-arrow-down me-1"></i>Generate
                  Report
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReportGenerator;
