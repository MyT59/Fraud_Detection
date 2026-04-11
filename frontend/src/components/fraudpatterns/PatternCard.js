import React from "react";
import "./PatternCard.css";

const CATEGORY_ICON = {
  Credential: "bi-key-fill",
  Transaction: "bi-cash-stack",
  Location: "bi-geo-alt-fill",
  Device: "bi-phone-fill",
  Behavioral: "bi-person-dash",
  Network: "bi-globe2",
};

const STATUS_META = {
  active: { label: "Active", cls: "active" },
  inactive: { label: "Inactive", cls: "inactive" },
  review: { label: "Under Review", cls: "review" },
};

const PatternCard = ({ pattern, onViewDetail }) => {
  const statusMeta = STATUS_META[pattern.status] || STATUS_META.active;
  const icon = CATEGORY_ICON[pattern.category] || "bi-bug-fill";

  const RISK_COLOR = { high: "#dc2626", medium: "#d97706", low: "#0284c7" };
  const riskColor = RISK_COLOR[pattern.riskLevel] || "#64748b";

  return (
    <div
      className={`fp-card fp-card-${pattern.riskLevel}`}
      onClick={() => onViewDetail(pattern)}
    >
      <div className="fp-card-topbar" style={{ background: riskColor }}></div>

      <div className="fp-card-inner">
        <div className="fp-card-header">
          <div
            className="fp-card-icon-wrap"
            style={{ background: `${riskColor}18`, color: riskColor }}
          >
            <i className={`bi ${icon}`}></i>
          </div>
          <div className="fp-card-badges">
            <span className={`fp-risk-badge fp-risk-${pattern.riskLevel}`}>
              {pattern.riskLevel.charAt(0).toUpperCase() +
                pattern.riskLevel.slice(1)}
            </span>
            <span className={`fp-status-badge ${statusMeta.cls}`}>
              {statusMeta.label}
            </span>
          </div>
        </div>

        <h4 className="fp-card-title">{pattern.name}</h4>
        <p className="fp-card-desc">{pattern.description}</p>

        <div className="fp-card-metrics">
          <div className="fp-metric">
            <span className="fp-metric-value" style={{ color: riskColor }}>
              {pattern.occurrences.toLocaleString()}
            </span>
            <span className="fp-metric-label">Detections</span>
          </div>
          <div className="fp-metric">
            <span className="fp-metric-value">{pattern.accuracy}%</span>
            <span className="fp-metric-label">Accuracy</span>
          </div>
          <div className="fp-metric">
            <span className="fp-metric-value">
              {pattern.falsePositiveRate}%
            </span>
            <span className="fp-metric-label">False Pos.</span>
          </div>
        </div>

        <div className="fp-card-footer">
          <span className="fp-category-tag">
            <i className={`bi ${icon}`}></i>
            {pattern.category}
          </span>
          <button
            className="fp-card-detail-btn"
            onClick={(e) => {
              e.stopPropagation();
              onViewDetail(pattern);
            }}
          >
            View Details <i className="bi bi-arrow-right"></i>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PatternCard;
