import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import StatCard from "../components/dashboard/StatCard";
import TransactionChart from "../components/dashboard/TransactionChart";
import FraudChart from "../components/dashboard/FraudChart";
import RecentAlerts from "../components/dashboard/RecentAlerts";
import QuickActions from "../components/dashboard/QuickActions";
import SystemHealth from "../components/dashboard/SystemHealth";
import TopFraudPatterns from "../components/dashboard/TopFraudPatterns";
import ActivityTimeline from "../components/dashboard/ActivityTimeline";
import PageLoader from "../components/common/PageLoader";
import "./Dashboard.css";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8000";

const FALLBACK = {
  stats: {
    total_transactions: 1290,
    total_fraud: 56,
    fraud_rate: 4.34,
    model_accuracy: 98.7,
    total_agenusa: 720,
    total_nusabill: 570,
    agenusa_fraud: 31,
    nusabill_fraud: 25,
  },
  transactions_daily: [
    { label: "Mon", transactions: 120, fraud: 8, legit: 112 },
    { label: "Tue", transactions: 190, fraud: 15, legit: 175 },
    { label: "Wed", transactions: 150, fraud: 10, legit: 140 },
    { label: "Thu", transactions: 220, fraud: 18, legit: 202 },
    { label: "Fri", transactions: 180, fraud: 12, legit: 168 },
    { label: "Sat", transactions: 210, fraud: 20, legit: 190 },
    { label: "Sun", transactions: 165, fraud: 9, legit: 156 },
  ],
  recent_alerts: [],
  alerts_summary: { high: 0, medium: 0, low: 0 },
  recent_transactions: [
    {
      id: "#TXN-001234",
      amount: "Rp 2.450.000",
      date: "Jan 21, 2026",
      status: "safe",
      risk_level: "low",
    },
    {
      id: "#TXN-001233",
      amount: "Rp 12.450.000",
      date: "Jan 21, 2026",
      status: "fraud",
      risk_level: "high",
    },
    {
      id: "#TXN-001232",
      amount: "Rp 850.000",
      date: "Jan 21, 2026",
      status: "safe",
      risk_level: "low",
    },
    {
      id: "#TXN-001231",
      amount: "Rp 5.230.000",
      date: "Jan 20, 2026",
      status: "review",
      risk_level: "medium",
    },
    {
      id: "#TXN-001230",
      amount: "Rp 1.100.000",
      date: "Jan 20, 2026",
      status: "safe",
      risk_level: "low",
    },
  ],
};

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
  const navigate = useNavigate();

  const [dashData, setDashData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState("api");
  const [apiError, setApiError] = useState(null);
  const [activeModal, setActiveModal] = useState(null);

  const [rangeData, setRangeData] = useState(null);

  const handleRangeChange = useCallback((range, payload) => {
    if (range === "custom" && payload?.data) {
      setRangeData(payload.data);
    } else {
      setRangeData(null);
    }
  }, []);

  const loadData = useCallback(async (signal) => {
    setLoading(true);
    setApiError(null);
    try {
      const res = await fetch(`${API_BASE}/dashboard/all`, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDashData(data);
      setDataSource("api");
    } catch (err) {
      if (err.name === "AbortError") return;
      console.warn(
        "[Dashboard] API tidak tersedia, pakai fallback.",
        err.message,
      );
      setApiError(err.message);
      setDashData(FALLBACK);
      setDataSource("static");
    } finally {
      setLoading(false);
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

  const { stats, transactions_daily, recent_alerts, alerts_summary } = dashData;

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
              title={apiError || "Live data dari API"}
            >
              {dataSource === "api" ? (
                <>
                  <i className="bi bi-cloud-check me-1"></i>Live
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
            Pastikan server berjalan di <code>{API_BASE}</code>.
          </span>
        </div>
      )}

      <div
        className="stats-grid"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}
      >
        <StatCard
          title="Total Agenusa"
          value={(
            stats.total_agenusa ?? Math.round(stats.total_transactions * 0.558)
          ).toLocaleString()}
          icon="bi bi-building"
          type="secondary"
          change={10.2}
        />
        <StatCard
          title="Total Nusabill"
          value={(
            stats.total_nusabill ?? Math.round(stats.total_transactions * 0.442)
          ).toLocaleString()}
          icon="bi bi-receipt-cutoff"
          type="secondary"
          change={8.7}
        />
        <StatCard
          title="Agenusa Fraud"
          value={(
            stats.agenusa_fraud ?? Math.round(stats.total_fraud * 0.554)
          ).toLocaleString()}
          icon="bi bi-shield-fill-exclamation"
          type="primary"
          change={-5.1}
        />
        <StatCard
          title="Nusabill Fraud"
          value={(
            stats.nusabill_fraud ?? Math.round(stats.total_fraud * 0.446)
          ).toLocaleString()}
          icon="bi bi-shield-fill-x"
          type="primary"
          change={-3.8}
        />
        <StatCard
          title="Fraud Rate"
          value={`${stats.fraud_rate}%`}
          icon="bi bi-percent"
          type="secondary"
          change={-2.1}
        />
        <StatCard
          title="Model Accuracy"
          value={`${stats.model_accuracy}%`}
          icon="bi bi-graph-up"
          type="secondary"
          change={1.2}
        />
      </div>

      <div className="row mb-4">
        <div className="col-12">
          <QuickActions />
        </div>
      </div>

      <div className="charts-grid">
        <TransactionChart
          data={transactions_daily}
          onRangeChange={handleRangeChange}
        />
        <FraudChart
          total={stats.total_transactions}
          fraudCount={stats.total_fraud}
          rangeData={rangeData}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
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
              {activeModal === "health" && <SystemHealth />}
              {activeModal === "patterns" && (
                <TopFraudPatterns patterns={dashData.top_patterns} />
              )}
              {activeModal === "alerts" && (
                <RecentAlerts alerts={recent_alerts} summary={alerts_summary} />
              )}
              {activeModal === "timeline" && (
                <ActivityTimeline activities={dashData.activity_preview} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
