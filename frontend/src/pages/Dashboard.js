import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import StatCard from '../components/dashboard/StatCard';
import TransactionChart from '../components/dashboard/TransactionChart';
import FraudChart from '../components/dashboard/FraudChart';
import RecentAlerts from '../components/dashboard/RecentAlerts';
import QuickActions from '../components/dashboard/QuickActions';
import SystemHealth from '../components/dashboard/SystemHealth';
import TopFraudPatterns from '../components/dashboard/TopFraudPatterns';
import ActivityTimeline from '../components/dashboard/ActivityTimeline';
import './Dashboard.css';
import PageLoader from '../components/common/PageLoader';

const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({
    totalTransactions: 1290,
    totalFraud: 56,
    fraudRate: 4.34,
    modelAccuracy: 98.7
  });

  useEffect(() => {
    // TODO: Fetch data dari API backend
    const timer = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  if (loading) return <PageLoader message="Memuat dashboard..." />;

  return (
    <div className="dashboard-simple">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Fraud Detection System Overview</p>
        </div>
        <div className="header-actions">
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="stats-grid">
        <StatCard
          title="Total Transactions"
          value={stats.totalTransactions.toLocaleString()}
          icon="bi bi-receipt"
          type="primary"
          change={12.5}
        />
        <StatCard
          title="Fraud Detected"
          value={stats.totalFraud}
          icon="bi bi-shield-exclamation"
          type="primary"
          change={-8.3}
        />
        <StatCard
          title="Fraud Rate"
          value={`${stats.fraudRate}%`}
          icon="bi bi-percent"
          type="secondary"
          change={-2.1}
        />
        <StatCard
          title="Model Accuracy"
          value={`${stats.modelAccuracy}%`}
          icon="bi bi-graph-up"
          type="secondary"
          change={1.2}
        />
      </div>

      {/* Quick Actions */}
      <div className="row mb-4">
        <div className="col-12">
          <QuickActions />
        </div>
      </div>

      {/* Charts Section */}
      <div className="charts-grid">
        <TransactionChart />
        <FraudChart />
      </div>

      {/* System Health & Recent Alerts */}
      <div className="row mb-4 align-items-stretch">
        <div className="col-lg-6 mb-4 d-flex flex-column">
          <SystemHealth />
        </div>
        <div className="col-lg-6 mb-4 d-flex flex-column">
          <RecentAlerts />
        </div>
      </div>

      {/* Top Fraud Patterns & Activity Timeline */}
      <div className="row mb-4 align-items-stretch">
        <div className="col-lg-6 mb-4 d-flex flex-column">
          <TopFraudPatterns />
        </div>
        <div className="col-lg-6 mb-4 d-flex flex-column">
          <ActivityTimeline />
        </div>
      </div>

      {/* Summary Table */}
      <div className="summary-section">
        <div className="section-header">
          <h2 className="section-title">Recent Transactions</h2>
          <button className="btn-link" onClick={() => navigate('/transactions')}>View All</button>
        </div>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Transaction ID</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Status</th>
                <th>Risk Level</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><span className="mono">#TXN-001234</span></td>
                <td><strong>$2,450.00</strong></td>
                <td>Feb 13, 2026</td>
                <td><span className="status-badge safe">Safe</span></td>
                <td><span className="risk-low">Low</span></td>
              </tr>
              <tr>
                <td><span className="mono">#TXN-001233</span></td>
                <td><strong>$12,450.00</strong></td>
                <td>Feb 13, 2026</td>
                <td><span className="status-badge fraud">Fraud</span></td>
                <td><span className="risk-high">High</span></td>
              </tr>
              <tr>
                <td><span className="mono">#TXN-001232</span></td>
                <td><strong>$850.00</strong></td>
                <td>Feb 13, 2026</td>
                <td><span className="status-badge safe">Safe</span></td>
                <td><span className="risk-low">Low</span></td>
              </tr>
              <tr>
                <td><span className="mono">#TXN-001231</span></td>
                <td><strong>$5,230.00</strong></td>
                <td>Feb 12, 2026</td>
                <td><span className="status-badge review">Review</span></td>
                <td><span className="risk-medium">Medium</span></td>
              </tr>
              <tr>
                <td><span className="mono">#TXN-001230</span></td>
                <td><strong>$1,100.00</strong></td>
                <td>Feb 12, 2026</td>
                <td><span className="status-badge safe">Safe</span></td>
                <td><span className="risk-low">Low</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;