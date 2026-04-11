import React from "react";
import "./PatternTrendChart.css";

const PatternTrendChart = ({ patterns }) => {
  const maxOccurrences = Math.max(...patterns.map((p) => p.occurrences));

  const RISK_COLOR = { high: "#dc2626", medium: "#f59e0b", low: "#0284c7" };

  return (
    <div className="ptc-wrapper">
      <div className="ptc-header">
        <span className="ptc-title">
          <i className="bi bi-bar-chart-line"></i>
          Pattern Detection Volume
        </span>
        <span className="ptc-subtitle">
          Occurrences per pattern (descending)
        </span>
      </div>

      <div className="ptc-chart">
        {[...patterns]
          .sort((a, b) => b.occurrences - a.occurrences)
          .map((pattern, i) => {
            const pct = (pattern.occurrences / maxOccurrences) * 100;
            const color = RISK_COLOR[pattern.riskLevel];
            return (
              <div key={pattern.id} className="ptc-row">
                <div className="ptc-rank">{i + 1}</div>
                <div className="ptc-label-wrap">
                  <span className="ptc-label">{pattern.name}</span>
                  <span className={`ptc-risk-dot ${pattern.riskLevel}`}></span>
                </div>
                <div className="ptc-bar-wrap">
                  <div
                    className="ptc-bar"
                    style={{ width: `${pct}%`, background: color }}
                  >
                    <span className="ptc-bar-label">{pattern.occurrences}</span>
                  </div>
                </div>
                <span className="ptc-pct">
                  {(
                    (pattern.occurrences /
                      patterns.reduce((s, p) => s + p.occurrences, 0)) *
                    100
                  ).toFixed(1)}
                  %
                </span>
              </div>
            );
          })}
      </div>

      <div className="ptc-legend">
        <span className="ptc-leg-item">
          <span className="ptc-leg-dot high"></span>High Risk
        </span>
        <span className="ptc-leg-item">
          <span className="ptc-leg-dot medium"></span>Medium Risk
        </span>
        <span className="ptc-leg-item">
          <span className="ptc-leg-dot low"></span>Low Risk
        </span>
      </div>
    </div>
  );
};

export default PatternTrendChart;
