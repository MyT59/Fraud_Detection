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

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8000";

const generateStaticFallback = () => {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const locations = [
    "Jakarta",
    "Surabaya",
    "Bandung",
    "Medan",
    "Semarang",
    "Makassar",
    "Palembang",
  ];

  const monthlyData = months.map((month) => ({
    month,
    label: month,
    transactions: Math.floor(Math.random() * 500) + 300,
    fraud: Math.floor(Math.random() * 100) + 20,
    legit: Math.floor(Math.random() * 400) + 280,
    amount: Math.floor(Math.random() * 50000000) + 20000000,
  }));

  const previousMonthlyData = months.map((month) => ({
    month,
    label: month,
    transactions: Math.floor(Math.random() * 450) + 250,
    fraud: Math.floor(Math.random() * 90) + 15,
    legit: Math.floor(Math.random() * 380) + 235,
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
    fraudStats: {
      fraud: Math.floor(Math.random() * 300) + 150,
      legit: Math.floor(Math.random() * 1500) + 800,
    },
    dailyTrend: Array.from({ length: 30 }, (_, i) => ({
      day: i + 1,
      transactions: Math.floor(Math.random() * 50) + 20,
      fraudRate: (Math.random() * 15 + 5).toFixed(2),
    })),
    domainStats: {
      agenusa: { transactions: 5000, fraud: 250, legit: 4750 },
      nusabill: { transactions: 5000, fraud: 300, legit: 4700 },
    },
    modelAccuracy: "96.5",
  };
};

const transformApiResponse = (apiData, modelPerf) => {
  const monthly = apiData.monthly || [];
  const previous = apiData.previousMonthly || [];

  const dailyTrend = monthly.map((m, i) => ({
    day: i + 1,
    transactions: m.transactions,
    fraudRate:
      m.transactions > 0
        ? ((m.fraud / m.transactions) * 100).toFixed(2)
        : "0.00",
  }));

  let modelAccuracy = null;
  if (modelPerf?.isolation_evaluation) {
    const accA =
      modelPerf.isolation_evaluation.agenusa?.review_threshold_metrics
        ?.accuracy || 0;
    const accN =
      modelPerf.isolation_evaluation.nusabill?.review_threshold_metrics
        ?.accuracy || 0;
    if (accA && accN) modelAccuracy = (((accA + accN) / 2) * 100).toFixed(1);
    else if (accA) modelAccuracy = (accA * 100).toFixed(1);
    else if (accN) modelAccuracy = (accN * 100).toFixed(1);
  }

  return {
    monthlyData: monthly,
    previousMonthlyData: previous,
    locationData: apiData.locations || [],
    fraudStats: apiData.fraudStats || { fraud: 0, legit: 0 },
    dailyTrend,
    domainStats: apiData.overview?.by_domain || null,
    modelAccuracy,
  };
};

const fetchAnalyticsFromAPI = async (signal) => {
  const [resAll, resModelPerf] = await Promise.all([
    fetch(`${API_BASE}/analytics/all`, { signal }),
    fetch(`${API_BASE}/analytics/model-performance`, { signal }),
  ]);
  if (!resAll.ok) throw new Error(`API error: ${resAll.status}`);
  const allData = await resAll.json();
  const modelPerf = resModelPerf.ok ? await resModelPerf.json() : null;

  const resOverview = await fetch(`${API_BASE}/analytics/overview`, { signal });
  const overview = resOverview.ok ? await resOverview.json() : null;
  if (overview) allData.overview = overview;

  return { allData, modelPerf };
};

const Analytics = () => {
  const [analyticsData, setAnalyticsData] = useState(null);
  const [timeRange, setTimeRange] = useState("year");
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState("api");
  const [apiError, setApiError] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  const loadData = useCallback(async (signal) => {
    setLoading(true);
    setApiError(null);

    try {
      const { allData, modelPerf } = await fetchAnalyticsFromAPI(signal);
      const transformed = transformApiResponse(allData, modelPerf);
      setAnalyticsData(transformed);
      setDataSource("api");
      setLastRefreshed(new Date());
    } catch (err) {
      if (err.name === "AbortError") return;
      console.warn(
        "[Analytics] API tidak tersedia, pakai static fallback.",
        err.message,
      );
      setApiError(err.message);
      setAnalyticsData(generateStaticFallback());
      setDataSource("static");
      setLastRefreshed(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal);
    return () => controller.abort();
  }, [timeRange, loadData]);

  if (loading || !analyticsData) {
    return <PageLoader message="Memuat data analytics..." />;
  }

  return (
    <div className="analytics-page">
      <div className="container-fluid py-4">
        <div className="analytics-page-header mb-4">
          <div className="analytics-header-top">
            <div className="analytics-title-group">
              <h1 className="page-title">
                <i className="bi bi-graph-up"></i> Analytics Dashboard
              </h1>
              <div className="analytics-meta">
                <span
                  className={`data-source-badge ${dataSource === "api" ? "live" : "static"}`}
                  title={
                    dataSource === "api"
                      ? `Live API data. Updated: ${lastRefreshed?.toLocaleTimeString()}`
                      : `API unavailable (${apiError}). Showing static data.`
                  }
                >
                  {dataSource === "api" ? (
                    <>
                      <i className="bi bi-cloud-check"></i> Live Data
                    </>
                  ) : (
                    <>
                      <i className="bi bi-exclamation-triangle"></i> Static
                      Fallback
                    </>
                  )}
                </span>
                {lastRefreshed && (
                  <span className="last-updated">
                    Updated {lastRefreshed.toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>

            <button
              className="analytics-refresh-btn"
              onClick={() => loadData(new AbortController().signal)}
              title="Refresh data"
            >
              <i className="bi bi-arrow-clockwise"></i>
              <span>Refresh</span>
            </button>
          </div>

          <div className="analytics-controls-row">
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

        {apiError && (
          <div
            className="alert alert-warning d-flex align-items-center gap-2 mb-4 py-2"
            style={{ fontSize: "0.85rem", borderRadius: 8 }}
          >
            <i className="bi bi-wifi-off"></i>
            <span>
              <strong>API backend tidak dapat dijangkau.</strong> Menampilkan
              data statis sebagai fallback. Pastikan server berjalan di{" "}
              <code>{API_BASE}</code>.
            </span>
          </div>
        )}

        <StatsOverview
          domainStats={analyticsData.domainStats}
          modelAccuracy={analyticsData.modelAccuracy}
        />

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

        <div className="row mb-4">
          <div className="col-lg-7 mb-4">
            <div className="card chart-card">
              <div className="card-header">
                <h5 className="card-title">
                  <i className="bi bi-arrow-left-right me-2"></i>Period
                  Comparison
                </h5>
                <p className="card-subtitle">
                  Compare current vs previous period
                </p>
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
