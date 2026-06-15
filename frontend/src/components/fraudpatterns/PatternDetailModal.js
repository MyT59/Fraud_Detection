import React from "react";
import "./PatternDetailModal.css";

const RISK_META = {
  high: { label: "High Risk", color: "#dc2626", bg: "#fef2f2" },
  medium: { label: "Medium Risk", color: "#d97706", bg: "#fffbeb" },
  low: { label: "Low Risk", color: "#0284c7", bg: "#f0f9ff" },
};

const STATUS_META = {
  active: { label: "Active", bg: "#dcfce7", color: "#16a34a" },
  inactive: { label: "Inactive", bg: "#f1f5f9", color: "#64748b" },
  review: { label: "Under Review", bg: "#fef3c7", color: "#92400e" },
};

// [FIX] Export sederhana untuk satu pattern sebagai JSON.
// Tombol "Export Report" sebelumnya tidak punya handler sama sekali.
function exportPatternReport(pattern) {
  const payload = {
    id: pattern.id,
    name: pattern.name,
    category: pattern.category,
    risk_level: pattern.riskLevel,
    status: pattern.status,
    occurrences: pattern.occurrences,
    accuracy: pattern.accuracy,
    false_positive_rate: pattern.falsePositiveRate,
    avg_loss_idr: pattern.avgLossIDR,
    share_of_flagged_pct: pattern.trend,
    last_updated: pattern.lastUpdated,
    indicators: pattern.indicators,
    recommended_actions: pattern.recommendedActions,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pattern-report_${pattern.id}_${pattern.name
    .toLowerCase()
    .replace(/\s+/g, "-")}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

const PatternDetailModal = ({ pattern, onClose }) => {
  if (!pattern) return null;
  const risk = RISK_META[pattern.riskLevel] || RISK_META.medium;
  const status = STATUS_META[pattern.status] || STATUS_META.active;

  return (
    <div className="pdm-overlay" onClick={onClose}>
      <div className="pdm-box" onClick={(e) => e.stopPropagation()}>
        <div className="pdm-topbar" style={{ background: risk.color }}></div>

        <div className="pdm-header">
          <div className="pdm-header-left">
            <span className="pdm-category">{pattern.category}</span>
            <h3 className="pdm-title">{pattern.name}</h3>
          </div>
          <button className="pdm-close" onClick={onClose}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        <div className="pdm-badges">
          <span
            className="pdm-risk-chip"
            style={{ background: risk.bg, color: risk.color }}
          >
            <i className="bi bi-exclamation-triangle-fill"></i>
            {risk.label}
          </span>
          <span
            className="pdm-status-chip"
            style={{ background: status.bg, color: status.color }}
          >
            {pattern.status === "active" && (
              <i className="bi bi-check-circle-fill"></i>
            )}
            {pattern.status === "inactive" && (
              <i className="bi bi-pause-circle-fill"></i>
            )}
            {pattern.status === "review" && (
              <i className="bi bi-clock-fill"></i>
            )}
            {status.label}
          </span>
        </div>

        <div className="pdm-body">
          <p className="pdm-desc">{pattern.description}</p>

          <div className="pdm-metrics-grid">
            <div className="pdm-metric">
              <div className="pdm-metric-val" style={{ color: risk.color }}>
                {pattern.occurrences.toLocaleString()}
              </div>
              <div className="pdm-metric-lbl">Total Detections</div>
            </div>
            <div className="pdm-metric">
              <div className="pdm-metric-val">{pattern.accuracy}%</div>
              <div className="pdm-metric-lbl">Accuracy</div>
            </div>
            <div className="pdm-metric">
              <div className="pdm-metric-val">{pattern.falsePositiveRate}%</div>
              <div className="pdm-metric-lbl">False Positive Rate</div>
            </div>
            <div className="pdm-metric">
              <div className="pdm-metric-val">{pattern.avgLossIDR}</div>
              <div className="pdm-metric-lbl">Avg. Loss (IDR)</div>
            </div>
          </div>

          <div className="pdm-section">
            <div className="pdm-section-title">
              <i className="bi bi-radar"></i>Detection Indicators
            </div>
            <ul className="pdm-indicator-list">
              {pattern.indicators.map((ind, i) => (
                <li key={i} className="pdm-indicator-item">
                  <i className="bi bi-dot" style={{ color: risk.color }}></i>
                  {ind}
                </li>
              ))}
            </ul>
          </div>

          <div className="pdm-section">
            <div className="pdm-section-title">
              <i className="bi bi-lightning-charge-fill"></i>Recommended Actions
            </div>
            <div className="pdm-actions-list">
              {pattern.recommendedActions.map((act, i) => (
                <div key={i} className="pdm-action-item">
                  <div className="pdm-action-num">{i + 1}</div>
                  <span>{act}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pdm-section">
            <div className="pdm-section-title">
              <i className="bi bi-bar-chart-line"></i>Detection Share
            </div>
            <div className="pdm-trend-row">
              {/*
                [FIX] Label sebelumnya "This month vs last month" tidak sesuai
                dengan data dari BE. Field `trend` dihitung BE sebagai:
                (tx_count_pattern_ini / total_flagged_transactions) * 100
                yaitu proporsi pattern ini terhadap seluruh transaksi yang
                ter-flag, bukan perbandingan antar bulan.
              */}
              <span className="pdm-trend-label">
                Share dari total transaksi flagged
              </span>
              <span className="pdm-trend-val up">
                <i className="bi bi-pie-chart-fill"></i>
                {pattern.trend}%
              </span>
            </div>
            <div className="pdm-trend-bar-wrap">
              <div
                className="pdm-trend-bar-fill"
                style={{
                  width: `${Math.min(100, pattern.trend)}%`,
                  background: risk.color,
                }}
              ></div>
            </div>
          </div>

          <div className="pdm-meta-row">
            <span>
              <i className="bi bi-calendar-event"></i> Last updated:{" "}
              {pattern.lastUpdated}
            </span>
            <span>
              <i className="bi bi-tag"></i> ID: {pattern.id}
            </span>
          </div>
        </div>

        <div className="pdm-footer">
          <button className="pdm-btn-close" onClick={onClose}>
            <i className="bi bi-x-circle"></i>Close
          </button>
          {/* [FIX] Tombol sebelumnya tidak punya onClick handler */}
          <button
            className="pdm-btn-report"
            onClick={() => exportPatternReport(pattern)}
          >
            <i className="bi bi-file-earmark-text"></i>Export Report
          </button>
        </div>
      </div>
    </div>
  );
};

export default PatternDetailModal;
