import React from "react";
import { FILTER_CONFIG } from "./activityData";

const TIME_FILTERS = [
  { label: "All Time", value: "all_time", icon: "bi-calendar3" },
  { label: "Today", value: "today", icon: "bi-calendar-day" },
  { label: "This Week", value: "this_week", icon: "bi-calendar-week" },
  { label: "This Month", value: "this_month", icon: "bi-calendar-month" },
];

const ActivityToolbar = ({
  activeFilter,
  onFilterChange,
  searchQuery,
  onSearchChange,
  totalCount,
  timeFilter,
  onTimeFilterChange,
}) => {
  return (
    <div className="activity-toolbar">
      <div className="toolbar-top-row">
        <div className="toolbar-search">
          <i className="bi bi-search" />
          <input
            type="text"
            placeholder="Cari activity, target, admin, atau reason..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchQuery && (
            <button type="button" onClick={() => onSearchChange("")}>
              <i className="bi bi-x" />
            </button>
          )}
        </div>

        <p className="toolbar-count">
          <strong>{totalCount}</strong> activities
        </p>
      </div>

      <div className="toolbar-control-row">
        <div className="toolbar-group">
          <span className="toolbar-group-label">Periode</span>
          <div className="toolbar-time-filters">
            {TIME_FILTERS.map((time) => (
              <button
                key={time.value}
                className={`time-chip ${
                  timeFilter === time.value ? "time-chip-active" : ""
                }`}
                onClick={() => onTimeFilterChange(time.value)}
              >
                <i className={`bi ${time.icon}`} />
                {time.label}
              </button>
            ))}
          </div>
        </div>

        <div className="toolbar-group toolbar-group-wide">
          <span className="toolbar-group-label">Kategori</span>
          <div className="toolbar-filters">
            {FILTER_CONFIG.map((filter) => (
              <button
                key={filter.value}
                className={`filter-chip ${
                  activeFilter === filter.value ? `active-${filter.color}` : ""
                }`}
                onClick={() => onFilterChange(filter.value)}
              >
                <i className={`bi ${filter.icon}`} />
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivityToolbar;
