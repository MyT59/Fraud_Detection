import React from 'react';

const StatsOverview = ({ totalTransactions, totalFraud, totalLegit, fraudRate, totalAmount }) => {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="stats-overview mb-4">
      <div className="row">
        <div className="col-xl-3 col-md-6 mb-4">
          <div className="stat-card">
            <div className="stat-icon bg-primary">
              <i className="bi bi-receipt"></i>
            </div>
            <div className="stat-content">
              <div className="stat-label">Total Transaksi</div>
              <div className="stat-value">{totalTransactions.toLocaleString()}</div>
              <div className="stat-change positive">
                <i className="bi bi-arrow-up"></i> 12.5% dari bulan lalu
              </div>
            </div>
          </div>
        </div>

        <div className="col-xl-3 col-md-6 mb-4">
          <div className="stat-card">
            <div className="stat-icon bg-danger">
              <i className="bi bi-exclamation-triangle"></i>
            </div>
            <div className="stat-content">
              <div className="stat-label">Total Fraud</div>
              <div className="stat-value">{totalFraud.toLocaleString()}</div>
              <div className="stat-change negative">
                <i className="bi bi-arrow-up"></i> {fraudRate}% fraud rate
              </div>
            </div>
          </div>
        </div>

        <div className="col-xl-3 col-md-6 mb-4">
          <div className="stat-card">
            <div className="stat-icon bg-success">
              <i className="bi bi-check-circle"></i>
            </div>
            <div className="stat-content">
              <div className="stat-label">Total Legit</div>
              <div className="stat-value">{totalLegit.toLocaleString()}</div>
              <div className="stat-change positive">
                <i className="bi bi-arrow-down"></i> {(100 - parseFloat(fraudRate)).toFixed(2)}% success rate
              </div>
            </div>
          </div>
        </div>

        <div className="col-xl-3 col-md-6 mb-4">
          <div className="stat-card">
            <div className="stat-icon bg-info">
              <i className="bi bi-currency-dollar"></i>
            </div>
            <div className="stat-content">
              <div className="stat-label">Total Amount</div>
              <div className="stat-value">{formatCurrency(totalAmount)}</div>
              <div className="stat-change positive">
                <i className="bi bi-arrow-up"></i> 8.3% dari target
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatsOverview;