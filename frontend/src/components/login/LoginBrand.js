import React from 'react';
import { BRAND, BRAND_STATS, BRAND_FEATURES } from './loginData';

const LoginBrand = () => {
  return (
    <div className="login-brand-panel">
      {/* Logo */}
      <div className="login-brand-logo">
        <div className="brand-logo-icon">
          <i className="bi bi-shield-check"></i>
        </div>
        <div className="brand-logo-name">
          {BRAND.name}
          <span>{BRAND.company}</span>
        </div>
      </div>

      {/* Headline */}
      <div className="login-brand-headline">
        <h1>
          {BRAND.tagline.split('\n').map((line, i) =>
            line ? <span key={i}>{line}<br /></span> : null
          )}
          <em>{BRAND.taglineAccent}</em>
        </h1>
        <p>{BRAND.description}</p>
      </div>

      {/* Stats */}
      <div className="login-brand-stats">
        {BRAND_STATS.map((stat, i) => (
          <div className="brand-stat" key={i}>
            <span className="brand-stat-value">
              {stat.value}<span>{stat.suffix}</span>
            </span>
            <span className="brand-stat-label">{stat.label}</span>
          </div>
        ))}
      </div>

      {/* Feature chips */}
      <div className="login-brand-features">
        {BRAND_FEATURES.map((f, i) => (
          <span className="brand-feature-chip" key={i}>
            <i className={`bi ${f.icon}`}></i>
            {f.label}
          </span>
        ))}
      </div>
    </div>
  );
};

export default LoginBrand;