import React from 'react';
import './PatternStats.css';

const PatternStats = ({ patterns }) => {
  const total       = patterns.reduce((s, p) => s + p.occurrences, 0);
  const highRisk    = patterns.filter(p => p.riskLevel === 'high').reduce((s, p) => s + p.occurrences, 0);
  const active      = patterns.filter(p => p.status === 'active').length;
  const avgAccuracy = (patterns.reduce((s, p) => s + p.accuracy, 0) / patterns.length).toFixed(1);

  const cards = [
    {
      id: 1,
      label: 'Total Detections',
      value: total.toLocaleString(),
      icon: 'bi-shield-exclamation',
      color: 'purple',
      sub: 'All-time pattern matches',
    },
    {
      id: 2,
      label: 'High Risk Events',
      value: highRisk.toLocaleString(),
      icon: 'bi-exclamation-triangle-fill',
      color: 'danger',
      sub: `${((highRisk / total) * 100).toFixed(1)}% of total detections`,
    },
    {
      id: 3,
      label: 'Active Patterns',
      value: active,
      icon: 'bi-activity',
      color: 'success',
      sub: `${patterns.length} patterns total`,
    },
    {
      id: 4,
      label: 'Avg. Accuracy',
      value: `${avgAccuracy}%`,
      icon: 'bi-bullseye',
      color: 'info',
      sub: 'Detection model accuracy',
    },
  ];

  return (
    <div className="fp-stats-grid">
      {cards.map(card => (
        <div key={card.id} className={`fp-stat-card fp-stat-${card.color}`}>
          <div className={`fp-stat-icon bg-${card.color}`}>
            <i className={`bi ${card.icon}`}></i>
          </div>
          <div className="fp-stat-body">
            <span className="fp-stat-label">{card.label}</span>
            <span className="fp-stat-value">{card.value}</span>
            <span className="fp-stat-sub">{card.sub}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default PatternStats;