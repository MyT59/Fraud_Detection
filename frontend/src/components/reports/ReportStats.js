import React from 'react';

const ReportStats = ({ stats }) => {
  return (
    <div className="report-stats mb-4">
      <div className="row">
        <div className="col-xl-3 col-md-6 mb-3">
          <div className="stat-card">
            <div className="stat-icon bg-primary">
              <i className="bi bi-files"></i>
            </div>
            <div className="stat-content">
              <div className="stat-label">Total Reports</div>
              <div className="stat-value">{stats.total}</div>
              <div className="stat-change">
                <i className="bi bi-graph-up"></i>
                All time
              </div>
            </div>
            <div className="bg-number">{stats.total}</div>
          </div>
        </div>

        <div className="col-xl-3 col-md-6 mb-3">
          <div className="stat-card">
            <div className="stat-icon bg-success">
              <i className="bi bi-check-circle"></i>
            </div>
            <div className="stat-content">
              <div className="stat-label">Completed</div>
              <div className="stat-value">{stats.completed}</div>
              <div className="stat-change positive">
                <i className="bi bi-arrow-up"></i>
                {stats.total > 0 ? ((stats.completed / stats.total) * 100).toFixed(1) : 0}% success rate
              </div>
            </div>
            <div className="bg-number">{stats.completed}</div>
          </div>
        </div>

        <div className="col-xl-3 col-md-6 mb-3">
          <div className="stat-card">
            <div className="stat-icon bg-warning">
              <i className="bi bi-hourglass-split"></i>
            </div>
            <div className="stat-content">
              <div className="stat-label">Processing</div>
              <div className="stat-value">{stats.processing}</div>
              <div className="stat-change">
                <i className="bi bi-clock"></i>
                In progress
              </div>
            </div>
            <div className="bg-number">{stats.processing}</div>
          </div>
        </div>

        <div className="col-xl-3 col-md-6 mb-3">
          <div className="stat-card">
            <div className="stat-icon bg-danger">
              <i className="bi bi-x-circle"></i>
            </div>
            <div className="stat-content">
              <div className="stat-label">Failed</div>
              <div className="stat-value">{stats.failed}</div>
              <div className="stat-change negative">
                {stats.failed > 0 ? (
                  <>
                    <i className="bi bi-exclamation-triangle"></i>
                    Needs attention
                  </>
                ) : (
                  <>
                    <i className="bi bi-check"></i>
                    No errors
                  </>
                )}
              </div>
            </div>
            <div className="bg-number">{stats.failed}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportStats;