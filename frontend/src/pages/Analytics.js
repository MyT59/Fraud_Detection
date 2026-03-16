import React, { useState, useEffect, useCallback } from "react";
import StatsOverview from "../components/analytics/StatsOverview";
import TransactionChart from "../components/analytics/TransactionChart";
import FraudChart from "../components/analytics/FraudChart";
import LocationChart from "../components/analytics/LocationChart";
import TimeRangeSelector from "../components/analytics/TimeRangeSelector";
import AnalyticsExportButton from "../components/analytics/AnalyticsExportButton";
import ComparisonChart from "../components/analytics/ComparisonChart";
import PageLoader from "../components/common/PageLoader";
import "./Analytics.css";

// ─── Config ──────────────────────────────────────────────────────────────────
const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8000";

// ─── Static fallback (tetap dipakai kalau API tidak tersedia) ────────────────
const generateStaticFallback = () => {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const locations = ["Jakarta", "Surabaya", "Bandung", "Medan", "Semarang", "Makassar", "Palembang"];

  const monthlyData = months.map((month) => ({
    month,
    label: month,
    transactions: Math.floor(Math.random() * 500) + 300,
    fraud:        Math.floor(Math.random() * 100) + 20,
    legit:        Math.floor(Math.random() * 400) + 280,
    amount:       Math.floor(Math.random() * 50000000) + 20000000,
  }));

  const previousMonthlyData = months.map((month) => ({
    month,
    label:        month,
    transactions: Math.floor(Math.random() * 450) + 250,
    fraud:        Math.floor(Math.random() * 90) + 15,
    legit:        Math.floor(Math.random() * 380) + 235,
  }));

  const locationData = locations.map((location) => ({
    location,
    total: Math.floor(Math.random() * 300) + 100,
    fraud: Math.floor(Math.random() * 50) + 10,
    legit: Math.floor(Math.random() * 250) + 90,
  }));

  return {
    monthlyData,
    previousMonthlyData,
    locationData,
    fraudStats:  { fraud: Math.floor(Math.random() * 300) + 150, legit: Math.floor(Math.random() * 1500) + 800 },
    dailyTrend:  Array.from({ length: 30 }, (_, i) => ({
      day: i + 1,
      transactions: Math.floor(Math.random() * 50) + 20,
      fraudRate: (Math.random() * 15 + 5).toFixed(2),
    })),
  };
};

// ─── Transform API response → format komponen ────────────────────────────────
const transformApiResponse = (apiData) => {
  const monthly = apiData.monthly || [];
  const previous = apiData.previousMonthly || [];

  // dailyTrend: derive dari monthly (atau kosong kalau tidak ada)
  const dailyTrend = monthly.map((m, i) => ({
    day:          i + 1,
    transactions: m.transactions,
    fraudRate:    m.transactions > 0
      ? ((m.fraud / m.transactions) * 100).toFixed(2)
      : "0.00",
  }));

  return {
    monthlyData:         monthly,
    previousMonthlyData: previous,
    locationData:        apiData.locations || [],
    fraudStats:          apiData.fraudStats || { fraud: 0, legit: 0 },
    dailyTrend,
  };
};

// ─── API fetch helper ─────────────────────────────────────────────────────────
const fetchAnalyticsFromAPI = async (signal) => {
  const res = await fetch(`${API_BASE}/analytics/all`, { signal });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
};

// ─── Component ───────────────────────────────────────────────────────────────
const Analytics = () => {
  const [analyticsData,   setAnalyticsData]   = useState(null);
  const [timeRange,       setTimeRange]        = useState("year");
  const [loading,         setLoading]          = useState(true);
  const [dataSource,      setDataSource]       = useState("api");   // "api" | "static"
  const [apiError,        setApiError]         = useState(null);
  const [lastRefreshed,   setLastRefreshed]    = useState(null);

  // ── Fetch data ─────────────────────────────────────────────────────────────
  const loadData = useCallback(async (signal) => {
    setLoading(true);
    setApiError(null);

    try {
      const apiData    = await fetchAnalyticsFromAPI(signal);
      const transformed = transformApiResponse(apiData);
      setAnalyticsData(transformed);
      setDataSource("api");
      setLastRefreshed(new Date());
    } catch (err) {
      if (err.name === "AbortError") return;

      // Fallback ke data statis
      console.warn("[Analytics] API tidak tersedia, pakai static fallback.", err.message);
      setApiError(err.message);
      setAnalyticsData(generateStaticFallback());
      setDataSource("static");
      setLastRefreshed(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Re-fetch saat timeRange berubah ───────────────────────────────────────
  useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal);
    return () => controller.abort();
  }, [timeRange, loadData]);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const totalTransactions = analyticsData
    ? analyticsData.monthlyData.reduce((s, m) => s + m.transactions, 0)
    : 0;
  const totalFraud = analyticsData
    ? analyticsData.monthlyData.reduce((s, m) => s + m.fraud, 0)
    : 0;
  const totalLegit = analyticsData
    ? analyticsData.monthlyData.reduce((s, m) => s + m.legit, 0)
    : 0;
  const fraudRate    = totalTransactions > 0
    ? ((totalFraud / totalTransactions) * 100).toFixed(2)
    : "0.00";
  const totalAmount  = analyticsData
    ? analyticsData.monthlyData.reduce((s, m) => s + (m.amount || 0), 0)
    : 0;

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading || !analyticsData) {
    return <PageLoader message="Memuat data analytics..." />;
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="analytics-page">
      <div className="container-fluid py-4">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="page-header mb-4">
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
            <div>
              <h1 className="page-title">
                <i className="bi bi-graph-up"></i> Analytics Dashboard
              </h1>
              <p className="page-subtitle">
                Comprehensive fraud analytics and insights
                {/* Data-source badge */}
                <span
                  className={`badge ms-2 ${dataSource === "api" ? "bg-success" : "bg-warning text-dark"}`}
                  style={{ fontSize: "0.7rem", verticalAlign: "middle" }}
                  title={dataSource === "api"
                    ? `Data live dari API backend. Diperbarui: ${lastRefreshed?.toLocaleTimeString()}`
                    : `API tidak tersedia (${apiError}). Menampilkan data statis.`}
                >
                  {dataSource === "api"
                    ? <><i className="bi bi-cloud-check me-1"></i>Live Data</>
                    : <><i className="bi bi-exclamation-triangle me-1"></i>Static Fallback</>
                  }
                </span>
              </p>
            </div>

            <div className="d-flex gap-2 align-items-center">
              {/* Refresh button */}
              <button
                className="btn btn-outline-secondary btn-sm"
                onClick={() => loadData(new AbortController().signal)}
                title="Refresh data dari API"
                style={{ borderRadius: 8 }}
              >
                <i className="bi bi-arrow-clockwise"></i>
              </button>

              <TimeRangeSelector
                selectedRange={timeRange}
                onRangeChange={setTimeRange}
              />
              <AnalyticsExportButton
                analyticsData={analyticsData}
                timeRange={timeRange}
              />
            </div>
          </div>

          {/* API error banner */}
          {apiError && (
            <div
              className="alert alert-warning alert-dismissible d-flex align-items-center gap-2 mt-3 py-2"
              style={{ fontSize: "0.85rem", borderRadius: 8 }}
            >
              <i className="bi bi-wifi-off"></i>
              <span>
                <strong>API backend tidak dapat dijangkau.</strong> Menampilkan data statis sebagai fallback.
                Pastikan server berjalan di <code>{API_BASE}</code>.
              </span>
            </div>
          )}
        </div>

        {/* ── Stats Overview ───────────────────────────────────────────────── */}
        <StatsOverview
          totalTransactions={totalTransactions}
          totalFraud={totalFraud}
          totalLegit={totalLegit}
          fraudRate={fraudRate}
          totalAmount={totalAmount}
        />

        {/* ── Charts Row 1 ─────────────────────────────────────────────────── */}
        <div className="row mb-4">
          <div className="col-lg-8 mb-4">
            <div className="card chart-card">
              <div className="card-header">
                <h5 className="card-title">
                  <i className="bi bi-graph-up me-2"></i>Transaction Trends
                </h5>
                <p className="card-subtitle">Monthly transaction overview</p>
              </div>
              <div className="card-body">
                <TransactionChart data={analyticsData.monthlyData} />
              </div>
            </div>
          </div>
          <div className="col-lg-4 mb-4">
            <div className="card chart-card">
              <div className="card-header">
                <h5 className="card-title">
                  <i className="bi bi-pie-chart me-2"></i>Fraud Distribution
                </h5>
                <p className="card-subtitle">Overall fraud vs legit</p>
              </div>
              <div className="card-body">
                <FraudChart data={analyticsData.fraudStats} />
              </div>
            </div>
          </div>
        </div>

        {/* ── Charts Row 2 ─────────────────────────────────────────────────── */}
        <div className="row mb-4">
          <div className="col-lg-7 mb-4">
            <div className="card chart-card">
              <div className="card-header">
                <h5 className="card-title">
                  <i className="bi bi-arrow-left-right me-2"></i>Period Comparison
                </h5>
                <p className="card-subtitle">Compare current vs previous period</p>
              </div>
              <div className="card-body">
                <ComparisonChart
                  currentPeriodData={analyticsData.monthlyData}
                  previousPeriodData={analyticsData.previousMonthlyData}
                />
              </div>
            </div>
          </div>
          <div className="col-lg-5 mb-4">
            <div className="card chart-card">
              <div className="card-header">
                <h5 className="card-title">
                  <i className="bi bi-geo-alt me-2"></i>Location Analysis
                </h5>
                <p className="card-subtitle">Geographic distribution</p>
              </div>
              <div className="card-body">
                <LocationChart data={analyticsData.locationData} />
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Analytics;