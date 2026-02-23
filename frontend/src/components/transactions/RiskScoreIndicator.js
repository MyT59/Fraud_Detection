import React from 'react';
import './RiskScoreIndicator.css';

const RiskScoreIndicator = ({ score, size = 'medium', showLabel = true }) => {
  const getRiskLevel = () => {
    if (score >= 70) return { level: 'High', class: 'danger', icon: 'exclamation-triangle-fill' };
    if (score >= 40) return { level: 'Medium', class: 'warning', icon: 'exclamation-circle-fill' };
    return { level: 'Low', class: 'success', icon: 'check-circle-fill' };
  };

  const risk = getRiskLevel();
  const sizeClass = `risk-indicator-${size}`;

  return (
    <div className={`risk-score-indicator ${sizeClass}`}>
      {/* Circular Progress */}
      <div className="risk-circle-container">
        <svg className="risk-circle" viewBox="0 0 36 36">
          {/* Background circle */}
          <path
            className="circle-bg"
            d="M18 2.0845
              a 15.9155 15.9155 0 0 1 0 31.831
              a 15.9155 15.9155 0 0 1 0 -31.831"
          />
          {/* Progress circle */}
          <path
            className={`circle-progress circle-${risk.class}`}
            strokeDasharray={`${score}, 100`}
            d="M18 2.0845
              a 15.9155 15.9155 0 0 1 0 31.831
              a 15.9155 15.9155 0 0 1 0 -31.831"
          />
        </svg>
        
        {/* Score Number */}
        <div className="risk-score-number">
          <span className="score-value">{score}</span>
          {size !== 'small' && <span className="score-max">/100</span>}
        </div>
      </div>

      {/* Risk Label */}
      {showLabel && (
        <div className="risk-label">
          <i className={`bi bi-${risk.icon} text-${risk.class} me-1`}></i>
          <span className={`text-${risk.class} fw-medium`}>{risk.level} Risk</span>
        </div>
      )}
    </div>
  );
};

export default RiskScoreIndicator;