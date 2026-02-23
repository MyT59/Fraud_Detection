import React from 'react';
import { ALL_ACTIVITIES, STATS_BAR } from './activityData';

const ActivityStatsBar = () => {
  const counts = STATS_BAR.map(stat => ({
    ...stat,
    count: ALL_ACTIVITIES.filter(a => a.type === stat.key).length,
  }));

  return (
    <div className="activity-stats-bar">
      {counts.map(stat => (
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