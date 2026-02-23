import React from 'react';
import { FILTER_CONFIG } from './activityData';

const ActivityToolbar = ({ activeFilter, onFilterChange, searchQuery, onSearchChange, totalCount }) => {
  return (
    <div className="activity-toolbar">
      {/* Search */}
      <div className="toolbar-search">
        <i className="bi bi-search"></i>
        <input
          type="text"
          placeholder="Search activities..."
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
        />
      </div>

      <div className="toolbar-divider"></div>

      {/* Filter chips */}
      <div className="toolbar-filters">
        {FILTER_CONFIG.map(f => (
          <button
            key={f.value}
            className={`filter-chip ${activeFilter === f.value ? `active-${f.color}` : ''}`}
            onClick={() => onFilterChange(f.value)}
          >
            <i className={`bi ${f.icon}`}></i>
            {f.label}
          </button>
        ))}
      </div>

      {/* Count */}
      <p className="toolbar-count">
        Showing <strong>{totalCount}</strong> activities
      </p>
    </div>
  );
};

export default ActivityToolbar;