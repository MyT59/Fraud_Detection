import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './ActivityTimeline.css';

const ALL_ACTIVITIES = [
  {
    id: 1,
    type: 'fraud_detected',
    title: 'High-Risk Transaction Blocked',
    description: 'TRX001234 automatically blocked by system',
    user: 'System',
    time: '2 min ago',
    icon: 'bi-shield-exclamation',
    color: 'red',
    details: { amount: 'Rp 25.000.000', user: 'USR12345' }
  },
  {
    id: 2,
    type: 'manual_review',
    title: 'Transaction Approved',
    description: 'TRX001230 approved after manual review',
    user: 'Admin User',
    time: '15 min ago',
    icon: 'bi-check-circle',
    color: 'green',
    details: { reviewTime: '3 minutes' }
  },
  {
    id: 3,
    type: 'rule_update',
    title: 'Fraud Rule Updated',
    description: 'Velocity check threshold increased to 10',
    user: 'Security Team',
    time: '1 hr ago',
    icon: 'bi-gear',
    color: 'blue',
    details: { rule: 'Velocity Check' }
  },
  {
    id: 4,
    type: 'alert',
    title: 'Multiple Failed Login Attempts',
    description: 'USR67890 had 5 failed login attempts',
    user: 'System',
    time: '2 hr ago',
    icon: 'bi-exclamation-triangle',
    color: 'orange',
    details: { attempts: '5 attempts', location: 'Jakarta' }
  },
  {
    id: 5,
    type: 'report',
    title: 'Monthly Report Generated',
    description: 'January 2026 fraud analysis completed',
    user: 'System',
    time: '3 hr ago',
    icon: 'bi-file-earmark-text',
    color: 'purple',
    details: { reportId: 'RPT0015' }
  },
  {
    id: 6,
    type: 'user_action',
    title: 'User Settings Updated',
    description: 'Email notifications enabled',
    user: 'Admin User',
    time: '5 hr ago',
    icon: 'bi-person-gear',
    color: 'gray',
    details: { setting: 'Notifications' }
  },
  {
    id: 7,
    type: 'fraud_detected',
    title: 'Suspicious Pattern Detected',
    description: 'Geographic anomaly detected in TRX001225',
    user: 'System',
    time: '6 hr ago',
    icon: 'bi-geo-alt',
    color: 'red',
    details: { location: 'Unknown' }
  },
  {
    id: 8,
    type: 'system',
    title: 'ML Model Retrained',
    description: 'Updated with new training data',
    user: 'System',
    time: '8 hr ago',
    icon: 'bi-cpu',
    color: 'blue',
    details: { accuracy: '98.9%' }
  }
];

const FILTERS = [
  { label: 'All',     value: 'all' },
  { label: 'Fraud',   value: 'fraud_detected' },
  { label: 'Reviews', value: 'manual_review' },
  { label: 'System',  value: 'system' },
];

const ActivityTimeline = () => {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState('all');

  const filtered = activeFilter === 'all'
    ? ALL_ACTIVITIES
    : ALL_ACTIVITIES.filter(a => a.type === activeFilter);

  return (
    <div className="activity-timeline-card">

      {/* ── Header ── */}
      <div className="timeline-header">
        <div className="header-left">
          <h3 className="timeline-title">
            <i className="bi bi-clock-history"></i>
            Activity Timeline
          </h3>
          <p className="timeline-subtitle">Recent system activities</p>
        </div>
        <div className="timeline-filter">
          {FILTERS.map(f => (
            <button
              key={f.value}
              className={`filter-btn${activeFilter === f.value ? ' active' : ''}`}
              onClick={() => setActiveFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── List ── */}
      <div className="timeline-content">
        {filtered.map((activity, index) => {
          const isLast = index === filtered.length - 1;
          return (
            <div key={activity.id} className="timeline-item">

              {/* Icon + connector */}
              <div className="timeline-icon-col">
                <div className={`timeline-marker activity-${activity.color}`}>
                  <i className={activity.icon}></i>
                </div>
                {!isLast && <div className="timeline-connector" />}
              </div>

              {/* Content */}
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
                      <strong>{key.replace(/([A-Z])/g, ' $1').trim()}:</strong>
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
        })}
      </div>

      {/* ── Footer ── */}
      <div className="timeline-footer">
        <button
          className="btn-load-more"
          onClick={() => navigate('/activity-timeline')}
        >
          <i className="bi bi-arrow-right-circle"></i>
          View All Activities
        </button>
      </div>

    </div>
  );
};

export default ActivityTimeline;