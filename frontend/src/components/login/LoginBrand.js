import React from "react";
import { BRAND, BRAND_STATS } from "./loginData";

const LoginBrand = () => {
  return (
    <div className="login-brand-panel">
      <div className="login-brand-logo">
        <div className="brand-logo-icon">
          <i className="bi bi-shield-check"></i>
        </div>
        <div className="brand-logo-name">
          {BRAND.name}
          <span>{BRAND.company}</span>
        </div>
      </div>

      <div className="login-brand-headline">
        <h1>
          {BRAND.tagline.split("\n").map((line, i) =>
            line ? (
              <span key={i}>
                {line}
                <br />
              </span>
            ) : null,
          )}
          <em>{BRAND.taglineAccent}</em>
        </h1>
        <p>{BRAND.description}</p>
      </div>

      {BRAND_STATS && BRAND_STATS.length > 0 && (
        <div className="login-brand-stats">
          {BRAND_STATS.map((stat, i) => (
            <div className="brand-stat" key={i}>
              <div className="brand-stat-value">
                {stat.value}
                <span>{stat.suffix}</span>
              </div>
              <div className="brand-stat-label">{stat.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LoginBrand;
