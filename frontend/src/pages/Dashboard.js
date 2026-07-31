import React, { useState, useEffect, useCallback, useRef } from "react";
import StatCard from "../components/dashboard/StatCard";
import TransactionChart from "../components/dashboard/TransactionChart";
import FraudChart from "../components/dashboard/FraudChart";
import RecentAlerts from "../components/dashboard/RecentAlerts";
import QuickActions from "../components/dashboard/QuickActions";
import SystemHealth from "../components/dashboard/SystemHealth";
import TopFraudPatterns from "../components/dashboard/TopFraudPatterns";
import ActivityTimeline from "../components/dashboard/ActivityTimeline";
import PageLoader from "../components/common/PageLoader";
import { api } from "../services/apiService";
import "./Dashboard.css";

const severityToType = (s = "") => {
  const u = s.toUpperCase();
  if (u === "CRITICAL" || u === "HIGH") return "high";
  if (u === "MEDIUM" || u === "WARNING") return "medium";
  return "low";
};

const scoreToRisk = (score = 50) => {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
};

const activityTypeMap = {
  FRAUD: "fraud_detected",
  TIMELINE_FRAUD: "fraud_detected",
  REVIEW: "manual_review",
  TIMELINE_REVIEW: "manual_review",
  SECURITY: "rule_update",
  TIMELINE_SECURITY: "system",
  ALERT: "alert",
  TIMELINE_ALERT: "alert",
  SYSTEM: "system",
  TIMELINE_SYSTEM: "system",
};

const typeToIcon = (type = "") => {
  switch (type.toUpperCase()) {
    case "FRAUD":
    case "TIMELINE_FRAUD":
      return "bi-shield-exclamation";
    case "REVIEW":
    case "TIMELINE_REVIEW":
      return "bi-check-circle";
    case "SECURITY":
    case "TIMELINE_SECURITY":
      return "bi-gear";
    case "ALERT":
    case "TIMELINE_ALERT":
      return "bi-exclamation-triangle";
    case "SYSTEM":
    case "TIMELINE_SYSTEM":
      return "bi-cpu";
    default:
      return "bi-clock";
  }
};

const typeToColor = (type = "") => {
  switch (type.toUpperCase()) {
    case "FRAUD":
    case "TIMELINE_FRAUD":
      return "red";
    case "REVIEW":
    case "TIMELINE_REVIEW":
      return "green";
    case "SECURITY":
    case "TIMELINE_SECURITY":
      return "blue";
    case "ALERT":
    case "TIMELINE_ALERT":
      return "orange";
    case "SYSTEM":
    case "TIMELINE_SYSTEM":
      return "purple";
    default:
      return "gray";
  }
};

const alertIcon = (a) => {
  if (a.icon === "fraud" || a.type === "COMBINED")
    return "bi-shield-exclamation";
  const badge = (a.badge || "").toUpperCase();
  if (badge === "BLACKLIST") return "bi-ban";
  if (badge === "RULE") return "bi-gear-fill";
  return "bi-exclamation-triangle-fill";
};

const normalizeFraudRate = (raw) => {
  if (!raw && raw !== 0) return 0;

  const rate = raw < 1 ? raw * 100 : raw;
  return parseFloat(rate.toFixed(2));
};

const normalizeAnomalyRate = (raw) => {
  if (raw === null || raw === undefined) return null;
  const rate = raw < 1 ? raw * 100 : raw;
  return parseFloat(rate.toFixed(2));
};

const normalizeApiResponse = (data) => {
  const kpi = data.kpi || {};

  const trend = (data.transaction_trend || []).map((d) => ({
    label: `${String(d.hour).padStart(2, "0")}:00`,
    transactions: d.total || 0,
    fraud: d.fraud || 0,
  }));

  const alerts = (data.recent_alerts || []).map((a) => ({
    id: a.id,
    type: severityToType(a.severity),
    title: a.title || a.title_raw || "Alert",
    description: a.description || a.message_raw || "",
    time: a.time || "recently",
    userId: a.trx_id || null,
    amount: null,
    icon: alertIcon(a),
  }));

  const alertsSummary = alerts.reduce(
    (acc, a) => ({ ...acc, [a.type]: (acc[a.type] || 0) + 1 }),
    { high: 0, medium: 0, low: 0 },
  );

  const patterns = (data.top_patterns || []).map((p, i) => ({
    id: p.pattern_id ?? i + 1,
    pattern: p.pattern_name || "Unknown Pattern",
    description: p.category
      ? `${p.category.replace(/_/g, " ")} pattern`
      : "Detected fraud pattern",
    examples: p.category ? [p.category.replace(/_/g, " ")] : [],
    occurrences: p.count || 0,
    riskLevel: scoreToRisk(p.risk_score),
    trend: "stable",
  }));

  const activities = (data.activity || []).map((a, i) => ({
    id: i + 1,
    type: activityTypeMap[a.type?.toUpperCase()] || "system",
    title: a.title || "Activity",
    description: a.description || "",
    user: a.actor || "System",
    time: a.time || "recently",
    icon: typeToIcon(a.type),
    color: typeToColor(a.type),
    details: a.metadata || {},
  }));

  const totalAgenusa = kpi.total_agenusa || 0;
  const totalNusabill = kpi.total_nusabill || 0;
  const fraudAgenusa = kpi.fraud_agenusa || 0;
  const fraudNusabill = kpi.fraud_nusabill || 0;

  return {
    stats: {
      total_agenusa: totalAgenusa,
      total_nusabill: totalNusabill,
      agenusa_fraud: fraudAgenusa,
      nusabill_fraud: fraudNusabill,
      total_transactions: totalAgenusa + totalNusabill,
      total_fraud: fraudAgenusa + fraudNusabill,

      fraud_rate: normalizeFraudRate(kpi.fraud_rate),
      anomaly_rate: normalizeAnomalyRate(kpi.anomaly_rate),
    },
    transactions_daily: trend,
    fraud_distribution: data.fraud_distribution || null,
    recent_alerts: alerts,
    alerts_summary: alertsSummary,
    top_patterns: patterns,
    activity_preview: activities,
    system_health: data.system_health || null,
  };
};

const FALLBACK = normalizeApiResponse({
  kpi: {
    total_agenusa: 0,
    total_nusabill: 0,
    fraud_agenusa: 0,
    fraud_nusabill: 0,
    fraud_rate: 0,
    anomaly_rate: null,
  },
  transaction_trend: Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    total: 0,
    fraud: 0,
  })),
  fraud_distribution: { total: 0, fraud: 0, legit: 0 },
  recent_alerts: [],
  top_patterns: [],
  activity: [],
  system_health: null,
});

const PANEL_CARDS = [
  {
    key: "health",
    title: "System Health",
    icon: "bi-heart-pulse-fill",
    iconColor: "#10b981",
    iconBg: "#f0fdf4",
  },
  {
    key: "patterns",
    title: "Top Fraud Patterns",
    icon: "bi-bug-fill",
    iconColor: "#dc2626",
    iconBg: "#fef2f2",
  },
  {
    key: "alerts",
    title: "Recent Alerts",
    icon: "bi-bell-fill",
    iconColor: "#dc2626",
    iconBg: "#fef2f2",
  },
  {
    key: "timeline",
    title: "Activity Timeline",
    icon: "bi-clock-history",
    iconColor: "#6366f1",
    iconBg: "#eef2ff",
  },
];

const Dashboard = () => {
  const [dashData, setDashData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState("api");
  const [apiError, setApiError] = useState(null);
  const [activeModal, setActiveModal] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const requestSequence = useRef(0);

  const loadData = useCallback(async (signal) => {
    const requestId = ++requestSequence.current;
    setLoading(true);
    setApiError(null);
    try {
      const raw = await api.get("/dashboard/summary", { signal });
      if (requestId !== requestSequence.current) return;
      setDashData(normalizeApiResponse(raw));
      setDataSource("api");
      setLastUpdated(new Date());
    } catch (err) {
      if (err.name === "AbortError") return;
      if (requestId !== requestSequence.current) return;
      console.warn(
        "[Dashboard] API tidak tersedia, pakai fallback.",
        err.message,
      );
      setApiError(err.message);
      setDashData(FALLBACK);
      setDataSource("static");
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    loadData(ctrl.signal);
    return () => ctrl.abort();
  }, [loadData]);

  useEffect(() => {
    if (!activeModal) return;
    const handler = (e) => {
      if (e.key === "Escape") setActiveModal(null);
    };
    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [activeModal]);

  if (loading || !dashData) return <PageLoader message="Memuat dashboard..." />;

  const {
    stats,
    transactions_daily,
    recent_alerts,
    alerts_summary,
    fraud_distribution,
    top_patterns,
    activity_preview,
  } = dashData;

  const fraudTotal = fraud_distribution?.total ?? stats.total_transactions;
  const fraudCount = fraud_distribution?.fraud ?? stats.total_fraud;

  return (
    <div className="dashboard-simple">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            Fraud Detection System Overview
            <span
              className={`badge ms-2 ${dataSource === "api" ? "bg-success" : "bg-warning text-dark"}`}
              style={{ fontSize: "0.7rem", verticalAlign: "middle" }}
              title={apiError || "Data dari API pada refresh terakhir"}
            >
              {dataSource === "api" ? (
                <>
                  <i className="bi bi-cloud-check me-1"></i>
                  Updated {lastUpdated?.toLocaleTimeString() || "now"}
                </>
              ) : (
                <>
                  <i className="bi bi-exclamation-triangle me-1"></i>Fallback
                </>
              )}
            </span>
          </p>
        </div>
        <div className="header-actions">
          <button
            className="btn-secondary"
            onClick={() => loadData(new AbortController().signal)}
            title="Refresh data"
          >
            <i className="bi bi-arrow-clockwise"></i>
            Refresh
          </button>
        </div>
      </div>

      {apiError && (
        <div
          className="alert alert-warning d-flex align-items-center gap-2 mb-3 py-2"
          style={{ fontSize: "0.85rem", borderRadius: 8 }}
        >
          <i className="bi bi-wifi-off"></i>
          <span>
            <strong>API tidak dapat dijangkau.</strong> Menampilkan data statis.
            Pastikan server berjalan di{" "}
            <code>
              {process.env.REACT_APP_API_URL || "http://localhost:8000"}
            </code>
            .
          </span>
        </div>
      )}

      <div
        className="stats-grid"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}
      >
        <StatCard
          title="Total Agenusa"
          value={(stats.total_agenusa ?? 0).toLocaleString()}
          icon="bi bi-building"
          type="secondary"
          change={null}
        />
        <StatCard
          title="Total Nusabill"
          value={(stats.total_nusabill ?? 0).toLocaleString()}
          icon="bi bi-receipt-cutoff"
          type="secondary"
          change={null}
        />
        <StatCard
          title="Agenusa Fraud"
          value={(stats.agenusa_fraud ?? 0).toLocaleString()}
          icon="bi bi-shield-fill-exclamation"
          type="primary"
          change={null}
        />
        <StatCard
          title="Nusabill Fraud"
          value={(stats.nusabill_fraud ?? 0).toLocaleString()}
          icon="bi bi-shield-fill-x"
          type="primary"
          change={null}
        />
        <StatCard
          title="Fraud Rate"
          value={`${stats.fraud_rate}%`}
          icon="bi bi-percent"
          type="secondary"
          change={null}
        />
        <StatCard
          title="Anomaly Rate"
          value={
            stats.anomaly_rate !== null && stats.anomaly_rate !== undefined
              ? `${stats.anomaly_rate}%`
              : "—"
          }
          icon="bi bi-activity"
          type="secondary"
          change={null}
        />
      </div>

      <div className="row mb-4">
        <div className="col-12">
          <QuickActions />
        </div>
      </div>

      <div className="charts-grid">
        <TransactionChart data={transactions_daily} />
        <FraudChart
          total={fraudTotal}
          fraudCount={fraudCount}
          flaggedCount={fraud_distribution?.flagged ?? 0}
          safeCount={fraud_distribution?.safe ?? 0}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 32,
        }}
      >
        {PANEL_CARDS.map((card) => {
          const badges = {
            health: {
              label: "Live Monitoring",
              color: "#10b981",
              bg: "#f0fdf4",
            },
            patterns: {
              label: "Most Frequent Triggers",
              color: "#dc2626",
              bg: "#fef2f2",
            },
            alerts: {
              label: `${alerts_summary?.high ?? 0} High Risk`,
              color: "#dc2626",
              bg: "#fef2f2",
            },
            timeline: {
              label: "Recent Activities",
              color: "#6366f1",
              bg: "#eef2ff",
            },
          }[card.key];

          return (
            <button
              key={card.key}
              onClick={() => setActiveModal(card.key)}
              style={{
                background: "#ffffff",
                border: "1px solid #e5e5e5",
                borderRadius: 12,
                padding: "20px 16px",
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.2s ease",
                display: "flex",
                flexDirection: "column",
                gap: 12,
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.1)";
                e.currentTarget.style.borderColor = "#d4d4d4";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)";
                e.currentTarget.style.borderColor = "#e5e5e5";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: card.iconBg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <i
                    className={`bi ${card.icon}`}
                    style={{ color: card.iconColor, fontSize: 18 }}
                  ></i>
                </div>
                <i
                  className="bi bi-box-arrow-up-right"
                  style={{ color: "#d4d4d4", fontSize: 13 }}
                ></i>
              </div>

              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#262626",
                    marginBottom: 4,
                  }}
                >
                  {card.title}
                </div>
                <div
                  style={{
                    display: "inline-block",
                    fontSize: 11,
                    fontWeight: 600,
                    color: badges.color,
                    background: badges.bg,
                    padding: "2px 8px",
                    borderRadius: 20,
                  }}
                >
                  {badges.label}
                </div>
              </div>

              <div
                style={{
                  fontSize: 11,
                  color: "#9ca3af",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <i className="bi bi-hand-index" style={{ fontSize: 10 }}></i>
                Click to view details
              </div>
            </button>
          );
        })}
      </div>

      {activeModal && (
        <div
          onClick={() => setActiveModal(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 1050,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#ffffff",
              borderRadius: 16,
              width: "100%",
              maxWidth: 720,
              maxHeight: "90vh",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "16px 24px",
                borderBottom: "1px solid #f0f0f0",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {(() => {
                  const card = PANEL_CARDS.find((c) => c.key === activeModal);
                  return (
                    <>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          background: card.iconBg,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <i
                          className={`bi ${card.icon}`}
                          style={{ color: card.iconColor, fontSize: 15 }}
                        ></i>
                      </div>
                      <span
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          color: "#262626",
                        }}
                      >
                        {card.title}
                      </span>
                    </>
                  );
                })()}
              </div>
              <button
                onClick={() => setActiveModal(null)}
                style={{
                  background: "none",
                  border: "1px solid #e5e5e5",
                  borderRadius: 8,
                  width: 32,
                  height: 32,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#737373",
                }}
              >
                <i className="bi bi-x-lg" style={{ fontSize: 13 }}></i>
              </button>
            </div>

            <div style={{ overflowY: "auto", flex: 1 }}>
              {activeModal === "health" && <SystemHealth health={dashData.system_health} onRefresh={loadData} />}
              {activeModal === "patterns" && (
                <TopFraudPatterns patterns={top_patterns} />
              )}
              {activeModal === "alerts" && (
                <RecentAlerts
                  alerts={recent_alerts}
                  summary={alerts_summary}
                  variant="modal"
                />
              )}
              {activeModal === "timeline" && (
                <ActivityTimeline activities={activity_preview} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
