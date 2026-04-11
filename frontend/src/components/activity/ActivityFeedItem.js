import React from "react";
import { TYPE_BADGE_CLASS, TYPE_LABEL } from "./activityData";

const ActivityFeedItem = ({ activity, isLast }) => {
  return (
    <div className="timeline-item-full">
      <div className="tf-icon-col">
        <div className={`tf-marker activity-${activity.color}`}>
          <i className={`bi ${activity.icon}`}></i>
        </div>
        {!isLast && <div className="tf-connector" />}
      </div>

      <div className="tf-content">
        <div className="tf-top-row">
          <h4 className="tf-title">{activity.title}</h4>
          <span className="tf-time-badge">
            <i className="bi bi-clock"></i>
            {activity.time}
          </span>
        </div>

        <p className="tf-description">{activity.description}</p>

        <div className="tf-meta">
          <span
            className={`tf-type-badge ${TYPE_BADGE_CLASS[activity.type] || ""}`}
          >
            {TYPE_LABEL[activity.type] || activity.type}
          </span>

          {Object.entries(activity.details).map(([key, value]) => (
            <span key={key} className="tf-tag">
              <strong>{key.replace(/([A-Z])/g, " $1").trim()}:</strong>
              {value}
            </span>
          ))}

          <span className="tf-user">
            <i className="bi bi-person-fill"></i>
            {activity.user}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ActivityFeedItem;
