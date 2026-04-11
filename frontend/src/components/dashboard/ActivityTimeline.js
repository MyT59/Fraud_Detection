import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./ActivityTimeline.css";

const STATIC_ACTIVITIES = [
  {
    id: 1,
    type: "fraud_detected",
    title: "High-Risk Transaction Blocked",
    description: "TRX001234 automatically blocked by system",
    user: "System",
    time: "2 min ago",
    icon: "bi-shield-exclamation",
    color: "red",
    details: { amount: "Rp 25.000.000", user: "USR12345" },
  },
  {
    id: 2,
    type: "manual_review",
    title: "Transaction Approved",
    description: "TRX001230 approved after manual review",
    user: "Admin User",
    time: "15 min ago",
    icon: "bi-check-circle",
    color: "green",
    details: { reviewTime: "3 minutes" },
  },
  {
    id: 3,
    type: "rule_update",
    title: "Fraud Rule Updated",
    description: "Velocity check threshold increased to 10",
    user: "Security Team",
    time: "1 hr ago",
    icon: "bi-gear",
    color: "blue",
    details: { rule: "Velocity Check" },
  },
  {
    id: 4,
    type: "alert",
    title: "Multiple Failed Login Attempts",
    description: "USR67890 had 5 failed login attempts",
    user: "System",
    time: "2 hr ago",
    icon: "bi-exclamation-triangle",
    color: "orange",
    details: { attempts: "5 attempts", location: "Jakarta" },
  },
  {
    id: 5,
    type: "report",
    title: "Monthly Report Generated",
    description: "January 2026 fraud analysis completed",
    user: "System",
    time: "3 hr ago",
    icon: "bi-file-earmark-text",
    color: "purple",
    details: { reportId: "RPT0015" },
  },
  {
    id: 6,
    type: "user_action",
    title: "User Settings Updated",
    description: "Email notifications enabled",
    user: "Admin User",
    time: "5 hr ago",
    icon: "bi-person-gear",
    color: "gray",
    details: { setting: "Notifications" },
  },
  {
    id: 7,
    type: "fraud_detected",
    title: "Suspicious Pattern Detected",
    description: "Geographic anomaly detected in TRX001225",
    user: "System",
    time: "6 hr ago",
    icon: "bi-geo-alt",
    color: "red",
    details: { location: "Unknown" },
  },
  {
    id: 8,
    type: "system",
    title: "ML Model Retrained",
    description: "Updated with new training data",
    user: "System",
    time: "8 hr ago",
    icon: "bi-cpu",
    color: "blue",
    details: { accuracy: "98.9%" },
  },
];

const FILTERS = [
  { label: "All", value: "all" },
  { label: "Fraud", value: "fraud_detected" },
  { label: "Reviews", value: "manual_review" },
  { label: "System", value: "system" },
];

const normaliseActivity = (a) => ({
  id: a.id,
  type: a.type,
  title: a.title,
  description: a.description,
  user: a.user || "System",
  time: a.time || "recently",
  icon: a.icon || "bi-clock",

  color:
    a.color ||
    (a.type === "fraud_detected"
      ? "red"
      : a.type === "manual_review"
        ? "green"
        : a.type === "system"
          ? "blue"
          : a.type === "alert"
            ? "orange"
            : a.type === "report"
              ? "purple"
              : "gray"),
  details: a.details || {},
});

const ActivityTimeline = ({ activities }) => {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState("all");

  const source =
    activities && activities.length > 0
      ? activities.map(normaliseActivity)
      : STATIC_ACTIVITIES;

  const filtered =
    activeFilter === "all"
      ? source
      : source.filter((a) => a.type === activeFilter);

  return (
    <div className="activity-timeline-card">
      <div className="timeline-header">
        <div className="header-left">
          <h3 className="timeline-title">
            <i className="bi bi-clock-history"></i>
            Activity Timeline
          </h3>
          <p className="timeline-subtitle">
            Recent system activities
            {activities && activities.length > 0 && (
              <span
                style={{
                  marginLeft: 8,
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  color: "#059669",
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  padding: "1px 8px",
                  borderRadius: 10,
                }}
              >
                Live
              </span>
            )}
          </p>
        </div>
        <div className="timeline-filter">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              className={`filter-btn${activeFilter === f.value ? " active" : ""}`}
              onClick={() => setActiveFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div
        className="timeline-content"
        style={{ maxHeight: 400, overflowY: "auto", flex: "none" }}
      >
        {filtered.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "40px 24px",
              color: "#9ca3af",
              gap: 8,
            }}
          >
            <i
              className="bi bi-clock-history"
              style={{ fontSize: "2rem", opacity: 0.4 }}
            ></i>
            <p style={{ margin: 0, fontSize: "0.875rem" }}>
              No activities found
            </p>
          </div>
        ) : (
          filtered.map((activity, index) => {
            const isLast = index === filtered.length - 1;
            return (
              <div key={activity.id} className="timeline-item">
                <div className="timeline-icon-col">
                  <div className={`timeline-marker activity-${activity.color}`}>
                    <i className={activity.icon}></i>
                  </div>
                  {!isLast && <div className="timeline-connector" />}
                </div>

                <div className="timeline-body">
                  <div className="timeline-row-top">
                    <h4 className="activity-title">{activity.title}</h4>
                    <span className="activity-time">
                      <i className="bi bi-clock"></i>
                      {activity.time}
                    </span>
                  </div>

                  <p className="activity-description">{activity.description}</p>

                  <div className="activity-tags">
                    {Object.entries(activity.details).map(([key, value]) => (
                      <span key={key} className="tag-detail">
                        <strong>
                          {key.replace(/([A-Z])/g, " $1").trim()}:
                        </strong>
                        {value}
                      </span>
                    ))}
                    <span className="tag-user">
                      <i className="bi bi-person-fill"></i>
                      {activity.user}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="timeline-footer">
        <button
          className="btn-load-more"
          onClick={() => navigate("/activity-timeline")}
        >
          <i className="bi bi-arrow-right-circle"></i>
          View All Activities
        </button>
      </div>
    </div>
  );
};

export default ActivityTimeline;
