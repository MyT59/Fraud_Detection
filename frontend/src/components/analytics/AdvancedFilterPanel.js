import React, { useState } from 'react';
import './AdvancedFilterPanel.css';

const AdvancedFilterPanel = ({ onFilterApply, onFilterReset }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [filters, setFilters] = useState({
    dateRange: 'all',
    customDateFrom: '',
    customDateTo: '',
    location: 'all',
    fraudRateMin: '',
    fraudRateMax: '',
    transactionMin: '',
    transactionMax: '',
    riskLevel: 'all',
    sortBy: 'date'
  });

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleApply = () => {
    onFilterApply(filters);
  };

  const handleReset = () => {
    const resetFilters = {
      dateRange: 'all',
      customDateFrom: '',
      customDateTo: '',
      location: 'all',
      fraudRateMin: '',
      fraudRateMax: '',
      transactionMin: '',
      transactionMax: '',
      riskLevel: 'all',
      sortBy: 'date'
    };
    setFilters(resetFilters);
    onFilterReset();
  };

  const hasActiveFilters = () => {
    return filters.dateRange !== 'all' ||
           filters.customDateFrom ||
           filters.customDateTo ||
           filters.location !== 'all' ||
           filters.fraudRateMin ||
           filters.fraudRateMax ||
           filters.transactionMin ||
           filters.transactionMax ||
           filters.riskLevel !== 'all' ||
           filters.sortBy !== 'date';
  };

  return (
    <div className="advanced-filter-panel">
      <div className="filter-header" onClick={toggleExpand}>
        <div className="d-flex align-items-center gap-2">
          <i className="bi bi-sliders text-danger"></i>
          <h6 className="mb-0">Advanced Filters</h6>
          {hasActiveFilters() && (
            <span className="badge bg-danger">Active</span>
          )}
        </div>
        <button className="btn btn-sm btn-link">
          <i className={`bi bi-chevron-${isExpanded ? 'up' : 'down'}`}></i>
        </button>
      </div>

      {isExpanded && (
        <div className="filter-body">
          <div className="row g-3">
            {/* Date Range */}
            <div className="col-md-6">
              <label className="form-label">
                <i className="bi bi-calendar-range me-1"></i>
                Date Range
              </label>
              <select
                className="form-select form-select-sm"
                name="dateRange"
                value={filters.dateRange}
                onChange={handleInputChange}
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
                <option value="quarter">Last 90 Days</option>
                <option value="year">Last Year</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>

            {/* Location */}
            <div className="col-md-6">
              <label className="form-label">
                <i className="bi bi-geo-alt me-1"></i>
                Location
              </label>
              <select
                className="form-select form-select-sm"
                name="location"
                value={filters.location}
                onChange={handleInputChange}
              >
                <option value="all">All Locations</option>
                <option value="jakarta">Jakarta</option>
                <option value="surabaya">Surabaya</option>
                <option value="bandung">Bandung</option>
                <option value="medan">Medan</option>
                <option value="semarang">Semarang</option>
                <option value="makassar">Makassar</option>
                <option value="palembang">Palembang</option>
              </select>
            </div>

            {/* Custom Date Range */}
            {filters.dateRange === 'custom' && (
              <>
                <div className="col-md-6">
                  <label className="form-label">From Date</label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    name="customDateFrom"
                    value={filters.customDateFrom}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">To Date</label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    name="customDateTo"
                    value={filters.customDateTo}
                    onChange={handleInputChange}
                  />
                </div>
              </>
            )}

            {/* Fraud Rate Range */}
            <div className="col-md-6">
              <label className="form-label">
                <i className="bi bi-percent me-1"></i>
                Min Fraud Rate (%)
              </label>
              <input
                type="number"
                className="form-control form-control-sm"
                name="fraudRateMin"
                placeholder="0"
                min="0"
                max="100"
                value={filters.fraudRateMin}
                onChange={handleInputChange}
              />
            </div>

            <div className="col-md-6">
              <label className="form-label">
                <i className="bi bi-percent me-1"></i>
                Max Fraud Rate (%)
              </label>
              <input
                type="number"
                className="form-control form-control-sm"
                name="fraudRateMax"
                placeholder="100"
                min="0"
                max="100"
                value={filters.fraudRateMax}
                onChange={handleInputChange}
              />
            </div>

            {/* Transaction Count Range */}
            <div className="col-md-6">
              <label className="form-label">
                <i className="bi bi-graph-up me-1"></i>
                Min Transactions
              </label>
              <input
                type="number"
                className="form-control form-control-sm"
                name="transactionMin"
                placeholder="0"
                min="0"
                value={filters.transactionMin}
                onChange={handleInputChange}
              />
            </div>

            <div className="col-md-6">
              <label className="form-label">
                <i className="bi bi-graph-up me-1"></i>
                Max Transactions
              </label>
              <input
                type="number"
                className="form-control form-control-sm"
                name="transactionMax"
                placeholder="10000"
                min="0"
                value={filters.transactionMax}
                onChange={handleInputChange}
              />
            </div>

            {/* Risk Level */}
            <div className="col-md-6">
              <label className="form-label">
                <i className="bi bi-shield-exclamation me-1"></i>
                Risk Level
              </label>
              <select
                className="form-select form-select-sm"
                name="riskLevel"
                value={filters.riskLevel}
                onChange={handleInputChange}
              >
                <option value="all">All Risk Levels</option>
                <option value="high">High Risk</option>
                <option value="medium">Medium Risk</option>
                <option value="low">Low Risk</option>
              </select>
            </div>

            {/* Sort By */}
            <div className="col-md-6">
              <label className="form-label">
                <i className="bi bi-sort-down me-1"></i>
                Sort By
              </label>
              <select
                className="form-select form-select-sm"
                name="sortBy"
                value={filters.sortBy}
                onChange={handleInputChange}
              >
                <option value="date">Date (Newest First)</option>
                <option value="date-asc">Date (Oldest First)</option>
                <option value="fraud-rate-desc">Fraud Rate (High to Low)</option>
                <option value="fraud-rate-asc">Fraud Rate (Low to High)</option>
                <option value="transactions-desc">Transactions (High to Low)</option>
                <option value="transactions-asc">Transactions (Low to High)</option>
              </select>
            </div>

            {/* Action Buttons */}
            <div className="col-12">
              <div className="d-flex gap-2 justify-content-end">
                <button 
                  className="btn btn-sm btn-outline-secondary"
                  onClick={handleReset}
                  disabled={!hasActiveFilters()}
                >
                  <i className="bi bi-arrow-counterclockwise me-1"></i>
                  Reset
                </button>
                <button 
                  className="btn btn-sm btn-danger"
                  onClick={handleApply}
                >
                  <i className="bi bi-check2 me-1"></i>
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedFilterPanel;