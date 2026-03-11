import React from 'react';
import './HistoryFilter.css';

const ACTION_FILTERS = [
  { value: 'all',       label: 'All Actions',  icon: 'bi-list-ul' },
  { value: 'approved',  label: 'Approved',     icon: 'bi-check-circle' },
  { value: 'rejected',  label: 'Rejected',     icon: 'bi-x-circle' },
];

const DATE_RANGES = [
  { value: 'all',   label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'week',  label: 'This Week' },
  { value: 'month', label: 'This Month' },
];

const HistoryFilter = ({
  actionFilter, setActionFilter,
  dateRange,    setDateRange,
  searchTerm,   setSearchTerm,
  totalResults,
}) => {
  return (
    <div className="hfilter-container">
      <div className="hfilter-top">
        {/* Action tabs */}
        <div className="hfilter-tabs">
          {ACTION_FILTERS.map(f => (
            <button
              key={f.value}
              className={`hfilter-tab ${f.value} ${actionFilter === f.value ? 'active' : ''}`}
              onClick={() => setActionFilter(f.value)}
            >
              <i className={`bi ${f.icon}`}></i>
              <span>{f.label}</span>
            </button>
          ))}
        </div>

        {/* Date range */}
        <div className="hfilter-daterange">
          {DATE_RANGES.map(d => (
            <button
              key={d.value}
              className={`hdate-btn ${dateRange === d.value ? 'active' : ''}`}
              onClick={() => setDateRange(d.value)}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className="hfilter-bottom">
        <div className="hfilter-search">
          <i className="bi bi-search"></i>
          <input
            type="text"
            placeholder="Search by txn ID, account number, customer ID, reviewer..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="hfilter-clear" onClick={() => setSearchTerm('')}>
              <i className="bi bi-x"></i>
            </button>
          )}
        </div>
        <span className="hfilter-results">
          <i className="bi bi-funnel"></i>
          {totalResults} entries found
        </span>
      </div>
    </div>
  );
};

export default HistoryFilter;