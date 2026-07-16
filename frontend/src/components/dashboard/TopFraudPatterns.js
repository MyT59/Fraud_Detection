import React from "react";
import { useNavigate } from "react-router-dom";
import "./TopFraudPatterns.css";

const ICON_MAP = {
  high: { icon: "bi-shield-exclamation", severity: "severity-high" },
  medium: { icon: "bi-exclamation-triangle", severity: "severity-medium" },
  low: { icon: "bi-info-circle", severity: "severity-low" },
};

const TREND_MAP = {
  up: { class: "trend-up", icon: "bi-arrow-up", label: "+12%" },
  down: { class: "trend-down", icon: "bi-arrow-down", label: "-5%" },
  stable: { class: "trend-stable", icon: "bi-dash", label: "0%" },
};

const TopFraudPatterns = ({ patterns }) => {
  const navigate = useNavigate();

  const fraudPatterns = Array.isArray(patterns) ? patterns : [];

  return (
    <div className="fraud-patterns-card">
      <div className="patterns-header">
        <div className="header-left">
          <h3 className="patterns-title">
            <i className="bi bi-bug-fill"></i>
            Top Fraud Patterns
          </h3>
          <p className="patterns-subtitle">
            Most frequent detection triggers
            {patterns && patterns.length > 0 && (
              <span
                style={{
                  marginLeft: 8,
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#dc2626",
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
        <button
          className="btn-details"
          onClick={() => navigate("/fraud-patterns")}
        >
          <i className="bi bi-arrow-right"></i>
          View Details
        </button>
      </div>

      <div
        className="patterns-list"
        style={{ maxHeight: 420, overflowY: "auto", flex: "none" }}
      >
        {fraudPatterns.length === 0 ? (
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
            <i className="bi bi-bug" style={{ fontSize: "2rem", opacity: 0.4 }}></i>
            <p style={{ margin: 0, fontSize: "0.875rem" }}>
              No fraud patterns detected yet
            </p>
          </div>
        ) : (
          fraudPatterns.map((p, i) => {
          const iconCfg = ICON_MAP[p.riskLevel] || ICON_MAP.low;
          const trendCfg = TREND_MAP[p.trend] || TREND_MAP.stable;

          return (
            <div key={p.id} className="pattern-item">
              <div className="pattern-rank">
                <span className={`rank-number ${i < 3 ? "top-three" : ""}`}>
                  {i + 1}
                </span>
              </div>

              <div className={`pattern-icon ${iconCfg.severity}`}>
                <i className={`bi ${iconCfg.icon}`}></i>
              </div>

              <div className="pattern-info">
                <div className="pattern-header-row">
                  <h4 className="pattern-name">{p.pattern}</h4>
                  <span className={`severity-indicator ${iconCfg.severity}`}>
                    {"●".repeat(
                      p.riskLevel === "high"
                        ? 3
                        : p.riskLevel === "medium"
                          ? 2
                          : 1,
                    )}
                  </span>
                </div>
                <p className="pattern-description">{p.description}</p>
                {p.examples && (
                  <div className="pattern-examples">
                    {p.examples.map((ex) => (
                      <span key={ex} className="example-tag">
                        {ex}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="pattern-stats">
                <div className="count-display">
                  <span className="count-value">{p.occurrences}</span>
                  <span className="count-label">detected</span>
                </div>
                <span className={`trend-indicator ${trendCfg.class}`}>
                  <i className={`bi ${trendCfg.icon}`}></i>
                  {trendCfg.label}
                </span>
              </div>
            </div>
          );
          })
        )}
      </div>

      <div className="patterns-footer">
        <div className="legend">
          <span className="legend-item">
            <i className="bi bi-circle-fill severity-high"></i>
            High Risk
          </span>
          <span className="legend-item">
            <i className="bi bi-circle-fill severity-medium"></i>
            Medium Risk
          </span>
          <span className="legend-item">
            <i className="bi bi-circle-fill severity-low"></i>
            Safe
          </span>
        </div>
      </div>
    </div>
  );
};

export default TopFraudPatterns;
