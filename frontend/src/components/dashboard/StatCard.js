import React from 'react';
import './StatCard.css';

const StatCard = ({ title, value, icon, type, change }) => {
  return (
    <div className={`stat-card-simple ${type}`}>
      <div className="stat-card-header">
        <div className="stat-icon">
          <i className={icon}></i>
        </div>
        {change && (
          <span className={`stat-change ${change >= 0 ? 'positive' : 'negative'}`}>
            {change >= 0 ? '+' : ''}{change}%
          </span>
        )}
      </div>
      <div className="stat-content">
        <p className="stat-title">{title}</p>
        <h2 className="stat-value">{value}</h2>
      </div>
    </div>
  );
};

export default StatCard;