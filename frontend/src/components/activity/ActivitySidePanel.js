import React from "react";
import { FILTER_CONFIG } from "./activityData";

const ActivitySidePanel = ({
  activities = [],
  activeFilter,
  onFilterChange,
}) => {
  const typeCounts = {};
  activities.forEach((a) => {
    typeCounts[a.type] = (typeCounts[a.type] || 0) + 1;
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
                    : typeCounts[f.value] || 0}
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
            {recent.map((activity, idx) => (
              <div className="summary-list-item" key={activity.id ?? idx}>
                <div className={`summary-icon activity-${activity.color}`}>
                  <i className={`bi ${activity.icon}`}></i>
                </div>
                <div className="summary-text">
                  <p className="summary-name">{activity.title}</p>
                  <p className="summary-time">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivitySidePanel;
