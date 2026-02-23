import React, { useState, useEffect } from 'react';
import StatsOverview from '../components/analytics/StatsOverview';
import TransactionChart from '../components/analytics/TransactionChart';
import FraudChart from '../components/analytics/FraudChart';
import LocationChart from '../components/analytics/LocationChart';
import TrendAnalysis from '../components/analytics/TrendAnalysis';
import TimeRangeSelector from '../components/analytics/TimeRangeSelector';
import AnalyticsExportButton from '../components/analytics/AnalyticsExportButton';
import ComparisonChart from '../components/analytics/ComparisonChart';
import TopFraudPatterns from '../components/analytics/TopFraudPatterns';
import AlertsPanel from '../components/analytics/AlertsPanel';
import AdvancedFilterPanel from '../components/analytics/AdvancedFilterPanel';
import './Analytics.css';

// Dummy data generator
const generateAnalyticsData = () => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const locations = ['Jakarta', 'Surabaya', 'Bandung', 'Medan', 'Semarang', 'Makassar', 'Palembang'];
  
  // Monthly transaction data
  const monthlyData = months.map((month, index) => ({
    month,
    label: month,
    transactions: Math.floor(Math.random() * 500) + 300,
    fraud: Math.floor(Math.random() * 100) + 20,
    legit: Math.floor(Math.random() * 400) + 280,
    amount: Math.floor(Math.random() * 50000000) + 20000000
  }));

  // Previous period data for comparison
  const previousMonthlyData = months.map((month, index) => ({
    month,
    label: month,
    transactions: Math.floor(Math.random() * 450) + 250,
    fraud: Math.floor(Math.random() * 90) + 15,
    legit: Math.floor(Math.random() * 380) + 235
  }));

  // Location-based data
  const locationData = locations.map(location => ({
    location,
    total: Math.floor(Math.random() * 300) + 100,
    fraud: Math.floor(Math.random() * 50) + 10,
    legit: Math.floor(Math.random() * 250) + 90
  }));

  // Fraud vs Legit overall
  const fraudStats = {
    fraud: Math.floor(Math.random() * 300) + 150,
    legit: Math.floor(Math.random() * 1500) + 800
  };

  // Daily trend (last 30 days)
  const dailyTrend = Array.from({ length: 30 }, (_, i) => ({
    day: i + 1,
    transactions: Math.floor(Math.random() * 50) + 20,
    fraudRate: (Math.random() * 15 + 5).toFixed(2)
  }));

  return {
    monthlyData,
    previousMonthlyData,
    locationData,
    fraudStats,
    dailyTrend
  };
};

const Analytics = () => {
  const [analyticsData, setAnalyticsData] = useState(null);
  const [timeRange, setTimeRange] = useState('year'); // year, month, week
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(null);

  useEffect(() => {
    // Simulate data loading
    setLoading(true);
    setTimeout(() => {
      const data = generateAnalyticsData();
      setAnalyticsData(data);
      setLoading(false);
    }, 500);
  }, [timeRange, filters]);

  const handleTimeRangeChange = (range) => {
    setTimeRange(range);
  };

  const handleFilterApply = (newFilters) => {
    setFilters(newFilters);
    console.log('Filters applied:', newFilters);
    // In real app, this would trigger API call with filters
  };

  const handleFilterReset = () => {
    setFilters(null);
    console.log('Filters reset');
  };

  if (loading || !analyticsData) {
    return (
      <div className="analytics-page">
        <div className="container-fluid py-4">
          <div className="loading-state">
            <div className="spinner-border text-danger" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-3">Memuat data analytics...</p>
          </div>
        </div>
      </div>
    );
  }

  // Calculate totals
  const totalTransactions = analyticsData.monthlyData.reduce((sum, item) => sum + item.transactions, 0);
  const totalFraud = analyticsData.monthlyData.reduce((sum, item) => sum + item.fraud, 0);
  const totalLegit = analyticsData.monthlyData.reduce((sum, item) => sum + item.legit, 0);
  const fraudRate = ((totalFraud / totalTransactions) * 100).toFixed(2);
  const totalAmount = analyticsData.monthlyData.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="analytics-page">
      <div className="container-fluid py-4">
        {/* Header with Export */}
        <div className="page-header mb-4">
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
            <div>
              <h1 className="page-title">
                <i className="bi bi-graph-up"></i> Analytics Dashboard
              </h1>
              <p className="page-subtitle">Comprehensive fraud analytics and insights</p>
            </div>
            <div className="d-flex gap-2">
              <TimeRangeSelector 
                selectedRange={timeRange}
                onRangeChange={handleTimeRangeChange}
              />
              <AnalyticsExportButton 
                analyticsData={analyticsData}
                timeRange={timeRange}
              />
            </div>
          </div>
        </div>

        {/* Advanced Filters */}
        <AdvancedFilterPanel 
          onFilterApply={handleFilterApply}
          onFilterReset={handleFilterReset}
        />

        {/* Stats Overview */}
        <StatsOverview 
          totalTransactions={totalTransactions}
          totalFraud={totalFraud}
          totalLegit={totalLegit}
          fraudRate={fraudRate}
          totalAmount={totalAmount}
        />

        {/* Charts Row 1 - Main Trends */}
        <div className="row mb-4">
          <div className="col-lg-8 mb-4">
            <div className="card chart-card">
              <div className="card-header">
                <h5 className="card-title">
                  <i className="bi bi-graph-up me-2"></i>
                  Transaction Trends
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
                  <i className="bi bi-pie-chart me-2"></i>
                  Fraud Distribution
                </h5>
                <p className="card-subtitle">Overall fraud vs legit</p>
              </div>
              <div className="card-body">
                <FraudChart data={analyticsData.fraudStats} />
              </div>
            </div>
          </div>
        </div>

        {/* Charts Row 2 - Comparison and Location */}
        <div className="row mb-4">
          <div className="col-lg-7 mb-4">
            <div className="card chart-card">
              <div className="card-header">
                <h5 className="card-title">
                  <i className="bi bi-arrow-left-right me-2"></i>
                  Period Comparison
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
                  <i className="bi bi-geo-alt me-2"></i>
                  Location Analysis
                </h5>
                <p className="card-subtitle">Geographic distribution</p>
              </div>
              <div className="card-body">
                <LocationChart data={analyticsData.locationData} />
              </div>
            </div>
          </div>
        </div>

        {/* Charts Row 3 - Patterns, Predictions, and Alerts */}
        <div className="row mb-4">
          <div className="col-lg-4 mb-4">
            <div className="card chart-card">
              <div className="card-header">
                <h5 className="card-title">
                  <i className="bi bi-bug me-2"></i>
                  Top Fraud Patterns
                </h5>
                <p className="card-subtitle">Most common detection patterns</p>
              </div>
              <div className="card-body">
                <TopFraudPatterns />
              </div>
            </div>
          </div>

          <div className="col-lg-4 mb-4">
            <div className="card chart-card">
              <div className="card-header">
                <h5 className="card-title">
                  <i className="bi bi-bell me-2"></i>
                  Active Alerts
                </h5>
                <p className="card-subtitle">Real-time notifications</p>
              </div>
              <div className="card-body">
                <AlertsPanel />
              </div>
            </div>
          </div>
        </div>

        {/* Charts Row 4 - Trend Analysis */}
        <div className="row mb-4">
          <div className="col-12">
            <div className="card chart-card">
              <div className="card-header">
                <h5 className="card-title">
                  <i className="bi bi-activity me-2"></i>
                  Daily Trend Analysis
                </h5>
                <p className="card-subtitle">30-day fraud rate trends</p>
              </div>
              <div className="card-body">
                <TrendAnalysis data={analyticsData.dailyTrend} />
              </div>
            </div>
          </div>
        </div>


      </div>
    </div>
  );
};

export default Analytics;