import React from "react";
import { STATS_BAR, getActivityGroup } from "./activityData";

const ActivityStatsBar = ({ activities = [], groupCounts: providedCounts }) => {
  // Count per group berdasarkan action_type
  const groupCounts = {};
  activities.forEach((a) => {
    const group = getActivityGroup(a.action_type);
    groupCounts[group] = (groupCounts[group] || 0) + 1;
  });

  const counts = STATS_BAR.map((stat) => ({
    ...stat,
    count: (providedCounts || groupCounts)[stat.key] || 0,
  }));

  return (
    <div className="activity-stats-bar">
      {counts.map((stat) => (
        <div className="stat-bar-item" key={stat.key}>
          <div className={`stat-bar-icon ${stat.color}`}>
            <i className={`bi ${stat.icon}`}></i>
          </div>
          <div className="stat-bar-info">
            <p className="stat-bar-value">{stat.count}</p>
            <p className="stat-bar-label">{stat.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ActivityStatsBar;
