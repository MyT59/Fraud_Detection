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
      <div className="toolbar-search">
        <i className="bi bi-search"></i>
        <input
          type="text"
          placeholder="Search activities..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="toolbar-divider"></div>

      <div className="toolbar-time-filters">
        {TIME_FILTERS.map((t) => (
          <button
            key={t.value}
            className={`time-chip ${timeFilter === t.value ? "time-chip-active" : ""}`}
            onClick={() => onTimeFilterChange(t.value)}
          >
            <i className={`bi ${t.icon}`}></i>
            {t.label}
          </button>
        ))}
      </div>

      <div className="toolbar-divider"></div>

      <div className="toolbar-filters">
        {FILTER_CONFIG.map((f) => (
          <button
            key={f.value}
            className={`filter-chip ${activeFilter === f.value ? `active-${f.color}` : ""}`}
            onClick={() => onFilterChange(f.value)}
          >
            <i className={`bi ${f.icon}`}></i>
            {f.label}
          </button>
        ))}
      </div>

      <p className="toolbar-count">
        Showing <strong>{totalCount}</strong> activities
      </p>
    </div>
  );
};

export default ActivityToolbar;
