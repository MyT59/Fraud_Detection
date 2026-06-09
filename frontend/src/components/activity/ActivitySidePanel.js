import React from "react";
import {
  FILTER_CONFIG,
  ACTION_META,
  DEFAULT_META,
  getActivityGroup,
} from "./activityData";

const fmtRelative = (isoString) => {
  if (!isoString) return "—";
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)} day ago`;
};

const ActivitySidePanel = ({
  activities = [],
  activeFilter,
  onFilterChange,
}) => {
  // Count per group
  const groupCounts = {};
  activities.forEach((a) => {
    const group = getActivityGroup(a.action_type);
    groupCounts[group] = (groupCounts[group] || 0) + 1;
  });

  const recent = activities.slice(0, 5);

  const dotColorMap = {
    red: "dot-red",
    green: "dot-green",
    blue: "dot-blue",
    orange: "dot-orange",
    purple: "dot-purple",
    gray: "dot-gray",
  };

  return (
    <div className="activity-sidebar-panel">
      <div className="side-card">
        <div className="side-card-header">
          <i className="bi bi-funnel"></i>
          Filter by Type
        </div>
        <div className="side-card-body">
          <div className="type-filter-list">
            {FILTER_CONFIG.map((f) => (
              <div
                key={f.value}
                className={`type-filter-item ${activeFilter === f.value ? "active" : ""}`}
                onClick={() => onFilterChange(f.value)}
              >
                <div className="type-filter-left">
                  {f.dot ? (
                    <span className={`type-dot ${dotColorMap[f.dot]}`}></span>
                  ) : (
                    <span
                      className="type-dot"
                      style={{ background: "#c7d2fe" }}
                    ></span>
                  )}
                  <span className="type-filter-label">{f.label}</span>
                </div>
                <span className="type-filter-count">
                  {f.value === "all"
                    ? activities.length
                    : groupCounts[f.value] || 0}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="side-card">
        <div className="side-card-header">
          <i className="bi bi-clock-history"></i>
          Recent Activity
        </div>
        <div className="side-card-body">
          <div className="summary-list">
            {recent.map((activity, idx) => {
              const meta = ACTION_META[activity.action_type] || DEFAULT_META;
              return (
                <div className="summary-list-item" key={activity.id ?? idx}>
                  <div className={`summary-icon activity-${meta.color}`}>
                    <i className={`bi ${meta.icon}`}></i>
                  </div>
                  <div className="summary-text">
                    <p className="summary-name">{meta.title}</p>
                    <p className="summary-time">
                      {fmtRelative(activity.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivitySidePanel;
