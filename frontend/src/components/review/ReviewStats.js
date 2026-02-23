import React from 'react';
import './ReviewStats.css';

const ReviewStats = ({ stats }) => {
  const calculatePercentage = (value, total) => {
    return total > 0 ? ((value / total) * 100).toFixed(1) : 0;
  };

  const reviewedTotal = stats.approved + stats.rejected;
  const approvalRate = calculatePercentage(stats.approved, reviewedTotal);
  const rejectionRate = calculatePercentage(stats.rejected, reviewedTotal);
  const avgReviewTime = stats.avgReviewTime || '2.5';

  const statsData = [
    {
      id: 1,
      label: 'Total Pending',
      value: stats.pending,
      icon: 'bi-clock-history',
      color: 'warning',
      trend: stats.pendingTrend || 0,
      subtitle: 'Awaiting review'
    },
    {
      id: 2,
      label: 'Approved Today',
      value: stats.approvedToday || 0,
      icon: 'bi-check-circle-fill',
      color: 'success',
      trend: stats.approvedTrend || 0,
      subtitle: `${approvalRate}% approval rate`
    },
    {
      id: 3,
      label: 'Rejected Today',
      value: stats.rejectedToday || 0,
      icon: 'bi-x-circle-fill',
      color: 'danger',
      trend: stats.rejectedTrend || 0,
      subtitle: `${rejectionRate}% rejection rate`
    },
  ];

  return (
    <div className="review-stats-container">
      <div className="stats-header">
        <div className="header-content">
          <h3 className="stats-title">
            <i className="bi bi-graph-up"></i>
            Review Performance
          </h3>
          <p className="stats-subtitle">Today's review metrics and statistics</p>
        </div>
        <div className="time-filter">
          <button className="time-btn active">Today</button>
          <button className="time-btn">Week</button>
          <button className="time-btn">Month</button>
        </div>
      </div>

      <div className="stats-grid">
        {statsData.map((stat) => (
          <div key={stat.id} className={`stat-box stat-${stat.color}`}>
            <div className="stat-icon-wrapper">
              <div className={`stat-icon bg-${stat.color}`}>
                <i className={stat.icon}></i>
              </div>
            </div>

            <div className="stat-content">
              <span className="stat-label">{stat.label}</span>
              <div className="stat-value-row">
                <span className="stat-value">{stat.value}</span>
                {stat.trend !== 0 && (
                  <span className={`stat-trend ${stat.trend > 0 ? 'trend-up' : 'trend-down'}`}>
                    <i className={`bi bi-arrow-${stat.trend > 0 ? 'up' : 'down'}`}></i>
                    {Math.abs(stat.trend)}%
                  </span>
                )}
              </div>
              <span className="stat-subtitle">{stat.subtitle}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Progress Bar */}
      <div className="progress-section">
        <div className="progress-header">
          <span className="progress-label">Review Progress</span>
          <span className="progress-value">
            {reviewedTotal} / {stats.pending + reviewedTotal} transactions reviewed
          </span>
        </div>
        <div className="progress-bar">
          <div 
            className="progress-fill approved"
            style={{ width: `${calculatePercentage(stats.approved, stats.pending + reviewedTotal)}%` }}
          ></div>
          <div 
            className="progress-fill rejected"
            style={{ width: `${calculatePercentage(stats.rejected, stats.pending + reviewedTotal)}%` }}
          ></div>
        </div>
        <div className="progress-legend">
          <span className="legend-item">
            <span className="legend-dot approved"></span>
            Approved ({stats.approved})
          </span>
          <span className="legend-item">
            <span className="legend-dot rejected"></span>
            Rejected ({stats.rejected})
          </span>
          <span className="legend-item">
            <span className="legend-dot pending"></span>
            Pending ({stats.pending})
          </span>
        </div>
      </div>
    </div>
  );
};

export default ReviewStats;