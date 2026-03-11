import React, { useState, useEffect } from "react";
import StatsOverview from "../components/analytics/StatsOverview";
import TransactionChart from "../components/analytics/TransactionChart";
import FraudChart from "../components/analytics/FraudChart";
import LocationChart from "../components/analytics/LocationChart";
import TimeRangeSelector from "../components/analytics/TimeRangeSelector";
import AnalyticsExportButton from "../components/analytics/AnalyticsExportButton";
import ComparisonChart from "../components/analytics/ComparisonChart";
import PageLoader from "../components/common/PageLoader";
import "./Analytics.css";

const generateAnalyticsData = () => {
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

  const fraudStats = {
    fraud: Math.floor(Math.random() * 300) + 150,
    legit: Math.floor(Math.random() * 1500) + 800,
  };

  const dailyTrend = Array.from({ length: 30 }, (_, i) => ({
    day: i + 1,
    transactions: Math.floor(Math.random() * 50) + 20,
    fraudRate: (Math.random() * 15 + 5).toFixed(2),
  }));

  return {
    monthlyData,
    previousMonthlyData,
    locationData,
    fraudStats,
    dailyTrend,
  };
};

const Analytics = () => {
  const [analyticsData, setAnalyticsData] = useState(null);
  const [timeRange, setTimeRange] = useState("year");
  const [loading, setLoading] = useState(true);
  const [filters] = useState(null);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      setAnalyticsData(generateAnalyticsData());
      setLoading(false);
    }, 600);
    return () => clearTimeout(timer);
  }, [timeRange, filters]);

  if (loading || !analyticsData) {
    return <PageLoader message="Memuat data analytics..." />;
  }

  const totalTransactions = analyticsData.monthlyData.reduce(
    (sum, item) => sum + item.transactions,
    0,
  );
  const totalFraud = analyticsData.monthlyData.reduce(
    (sum, item) => sum + item.fraud,
    0,
  );
  const totalLegit = analyticsData.monthlyData.reduce(
    (sum, item) => sum + item.legit,
    0,
  );
  const fraudRate = ((totalFraud / totalTransactions) * 100).toFixed(2);
  const totalAmount = analyticsData.monthlyData.reduce(
    (sum, item) => sum + item.amount,
    0,
  );

  return (
    <div className="analytics-page">
      <div className="container-fluid py-4">
        {/* Header */}
        <div className="page-header mb-4">
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
            <div>
              <h1 className="page-title">
                <i className="bi bi-graph-up"></i> Analytics Dashboard
              </h1>
              <p className="page-subtitle">
                Comprehensive fraud analytics and insights
              </p>
            </div>
            <div className="d-flex gap-2">
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
        </div>

        {/* Stats Overview */}
        <StatsOverview
          totalTransactions={totalTransactions}
          totalFraud={totalFraud}
          totalLegit={totalLegit}
          fraudRate={fraudRate}
          totalAmount={totalAmount}
        />

        {/* Charts Row 1 */}
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

        {/* Charts Row 2 */}
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
