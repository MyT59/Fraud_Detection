import React from 'react';
import { useNavigate } from 'react-router-dom';
import './TopFraudPatterns.css';

// ── Config maps ────────────────────────────────────────────────────────────
const ICON_MAP = {
  high:   { icon: 'bi-shield-exclamation', severity: 'severity-high'   },
  medium: { icon: 'bi-exclamation-triangle', severity: 'severity-medium' },
  low:    { icon: 'bi-info-circle',          severity: 'severity-low'    },
};

const TREND_MAP = {
  up:     { class: 'trend-up',     icon: 'bi-arrow-up',    label: '+12%' },
  down:   { class: 'trend-down',   icon: 'bi-arrow-down',  label: '-5%'  },
  stable: { class: 'trend-stable', icon: 'bi-dash',        label: '0%'   },
};

// ── Fallback statis ────────────────────────────────────────────────────────
const DEFAULT_PATTERNS = [
  {
    id: 1, pattern: 'Multiple Failed Logins',
    description: 'Brute force credential attempts detected',
    examples: ['5+ attempts', 'Same IP', 'Short interval'],
    occurrences: 156, riskLevel: 'high', trend: 'up',
  },
  {
    id: 2, pattern: 'Unusual Transaction Amount',
    description: 'Transaction significantly above user average',
    examples: ['>3x avg', 'New merchant', 'Single session'],
    occurrences: 98, riskLevel: 'high', trend: 'up',
  },
  {
    id: 3, pattern: 'Location Mismatch',
    description: 'Different from user\'s registered profile location',
    examples: ['New city', 'Foreign IP', 'VPN detected'],
    occurrences: 87, riskLevel: 'medium', trend: 'stable',
  },
  {
    id: 4, pattern: 'Rapid Successive Transactions',
    description: 'Multiple transactions within a short time window',
    examples: ['<2 min gap', 'Same merchant', 'Velocity breach'],
    occurrences: 65, riskLevel: 'medium', trend: 'down',
  },
  {
    id: 5, pattern: 'New Device Detected',
    description: 'Transaction from a previously unseen device',
    examples: ['Unknown UA', 'New fingerprint', 'No history'],
    occurrences: 54, riskLevel: 'low', trend: 'stable',
  },
  {
    id: 6, pattern: 'Unusual Time of Day',
    description: 'Activity during abnormal hours for this user',
    examples: ['2AM–4AM', 'Outside pattern', 'Dormant account'],
    occurrences: 43, riskLevel: 'low', trend: 'down',
  },
];

// ── Component ──────────────────────────────────────────────────────────────
const TopFraudPatterns = ({ patterns }) => {
  const navigate = useNavigate();

  // Gunakan data API; fallback ke statis kalau kosong
  const fraudPatterns = (patterns && patterns.length > 0) ? patterns : DEFAULT_PATTERNS;

  return (
    <div className="fraud-patterns-card">

      {/* Header */}
      <div className="patterns-header">
        <div className="header-left">
          <h3 className="patterns-title">
            <i className="bi bi-bug-fill"></i>
            Top Fraud Patterns
          </h3>
          <p className="patterns-subtitle">
            Most frequent detection triggers
            {patterns && patterns.length > 0 && (
              <span style={{
                marginLeft: 8,
                background: '#fef2f2', border: '1px solid #fecaca',
                color: '#dc2626', fontSize: '0.68rem', fontWeight: 700,
                padding: '1px 8px', borderRadius: 10,
              }}>
                Live
              </span>
            )}
          </p>
        </div>
        <button className="btn-details" onClick={() => navigate('/fraud-patterns')}>
          <i className="bi bi-arrow-right"></i>
          View Details
        </button>
      </div>

      {/* List — height terkunci 420px, overflow scroll */}
      <div
        className="patterns-list"
        style={{ maxHeight: 420, overflowY: 'auto', flex: 'none' }}
      >
        {fraudPatterns.map((p, i) => {
          const iconCfg  = ICON_MAP[p.riskLevel]  || ICON_MAP.low;
          const trendCfg = TREND_MAP[p.trend]      || TREND_MAP.stable;

          return (
            <div key={p.id} className="pattern-item">

              {/* Rank */}
              <div className="pattern-rank">
                <span className={`rank-number ${i < 3 ? 'top-three' : ''}`}>
                  {i + 1}
                </span>
              </div>

              {/* Icon */}
              <div className={`pattern-icon ${iconCfg.severity}`}>
                <i className={`bi ${iconCfg.icon}`}></i>
              </div>

              {/* Info */}
              <div className="pattern-info">
                <div className="pattern-header-row">
                  <h4 className="pattern-name">{p.pattern}</h4>
                  <span className={`severity-indicator ${iconCfg.severity}`}>
                    {'●'.repeat(p.riskLevel === 'high' ? 3 : p.riskLevel === 'medium' ? 2 : 1)}
                  </span>
                </div>
                <p className="pattern-description">{p.description}</p>
                {p.examples && (
                  <div className="pattern-examples">
                    {p.examples.map(ex => (
                      <span key={ex} className="example-tag">{ex}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Stats */}
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
        })}
      </div>

      {/* Footer */}
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
            Low Risk
          </span>
        </div>
      </div>
    </div>
  );
};

export default TopFraudPatterns;