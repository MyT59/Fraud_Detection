import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import StatCard        from "../components/dashboard/StatCard";
import TransactionChart from "../components/dashboard/TransactionChart";
import FraudChart      from "../components/dashboard/FraudChart";
import RecentAlerts    from "../components/dashboard/RecentAlerts";
import QuickActions    from "../components/dashboard/QuickActions";
import SystemHealth    from "../components/dashboard/SystemHealth";
import TopFraudPatterns from "../components/dashboard/TopFraudPatterns";
import ActivityTimeline from "../components/dashboard/ActivityTimeline";
import PageLoader      from "../components/common/PageLoader";
import "./Dashboard.css";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8000";

// ─── Static fallback ──────────────────────────────────────────────────────────
const FALLBACK = {
  stats: {
    total_transactions: 1290,
    total_fraud:        56,
    fraud_rate:         4.34,
    model_accuracy:     98.7,
  },
  transactions_daily: [
    { label: "Mon", transactions: 120, fraud: 8,  legit: 112 },
    { label: "Tue", transactions: 190, fraud: 15, legit: 175 },
    { label: "Wed", transactions: 150, fraud: 10, legit: 140 },
    { label: "Thu", transactions: 220, fraud: 18, legit: 202 },
    { label: "Fri", transactions: 180, fraud: 12, legit: 168 },
    { label: "Sat", transactions: 210, fraud: 20, legit: 190 },
    { label: "Sun", transactions: 165, fraud: 9,  legit: 156 },
  ],
  recent_alerts: [],
  alerts_summary: { high: 0, medium: 0, low: 0 },
  recent_transactions: [
    { id: "#TXN-001234", amount: "Rp 2.450.000",  date: "Jan 21, 2026", status: "safe",   risk_level: "low"    },
    { id: "#TXN-001233", amount: "Rp 12.450.000", date: "Jan 21, 2026", status: "fraud",  risk_level: "high"   },
    { id: "#TXN-001232", amount: "Rp 850.000",    date: "Jan 21, 2026", status: "safe",   risk_level: "low"    },
    { id: "#TXN-001231", amount: "Rp 5.230.000",  date: "Jan 20, 2026", status: "review", risk_level: "medium" },
    { id: "#TXN-001230", amount: "Rp 1.100.000",  date: "Jan 20, 2026", status: "safe",   risk_level: "low"    },
  ],
};

// ─── Component ────────────────────────────────────────────────────────────────
const Dashboard = () => {
  const navigate = useNavigate();

  const [dashData,    setDashData]    = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [dataSource,  setDataSource]  = useState("api");
  const [apiError,    setApiError]    = useState(null);

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
      console.warn("[Dashboard] API tidak tersedia, pakai fallback.", err.message);
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

  if (loading || !dashData) return <PageLoader message="Memuat dashboard..." />;

  const { stats, transactions_daily, recent_alerts, alerts_summary, recent_transactions } = dashData;

  return (
    <div className="dashboard-simple">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
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
              {dataSource === "api"
                ? <><i className="bi bi-cloud-check me-1"></i>Live</>
                : <><i className="bi bi-exclamation-triangle me-1"></i>Fallback</>}
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

      {/* API error banner */}
      {apiError && (
        <div className="alert alert-warning d-flex align-items-center gap-2 mb-3 py-2"
          style={{ fontSize: "0.85rem", borderRadius: 8 }}>
          <i className="bi bi-wifi-off"></i>
          <span>
            <strong>API tidak dapat dijangkau.</strong> Menampilkan data statis.
            Pastikan server berjalan di <code>{API_BASE}</code>.
          </span>
        </div>
      )}

      {/* ── Stat Cards ─────────────────────────────────────────────────────── */}
      <div className="stats-grid">
        <StatCard
          title="Total Transactions"
          value={stats.total_transactions.toLocaleString()}
          icon="bi bi-receipt"
          type="primary"
          change={12.5}
        />
        <StatCard
          title="Fraud Detected"
          value={stats.total_fraud.toLocaleString()}
          icon="bi bi-shield-exclamation"
          type="primary"
          change={-8.3}
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

      {/* ── Quick Actions ───────────────────────────────────────────────────── */}
      <div className="row mb-4">
        <div className="col-12">
          <QuickActions />
        </div>
      </div>

      {/* ── Charts ─────────────────────────────────────────────────────────── */}
      <div className="charts-grid">
        <TransactionChart data={transactions_daily} />
        <FraudChart
          total={stats.total_transactions}
          fraudCount={stats.total_fraud}
        />
      </div>

      {/* ── System Health & Recent Alerts ──────────────────────────────────── */}
      <div className="row mb-4">
        <div className="col-lg-6 mb-4">
          <SystemHealth />
        </div>
        <div className="col-lg-6 mb-4">
          <RecentAlerts alerts={recent_alerts} summary={alerts_summary} />
        </div>
      </div>

      {/* ── Top Fraud Patterns & Activity Timeline ─────────────────────────── */}
      <div className="row mb-4 align-items-stretch">
        <div className="col-lg-6 mb-4 d-flex flex-column">
          <TopFraudPatterns patterns={dashData.top_patterns} />
        </div>
        <div className="col-lg-6 mb-4 d-flex flex-column">
          <ActivityTimeline activities={dashData.activity_preview} />
        </div>
      </div>


    </div>
  );
};

export default Dashboard;