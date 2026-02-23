import React from 'react';
import { useNavigate } from 'react-router-dom';
import './TopFraudPatterns.css';

const TopFraudPatterns = ({ patterns }) => {
  const navigate = useNavigate();
  const fraudPatterns = patterns || [
    { id:1, pattern:'Multiple failed logins',       occurrences:156, riskLevel:'high',   description:'Brute force credential attempts' },
    { id:2, pattern:'Unusual transaction amounts',  occurrences:98,  riskLevel:'high',   description:'Significantly above user average' },
    { id:3, pattern:'Location mismatch',            occurrences:87,  riskLevel:'medium', description:'Different from user profile location' },
    { id:4, pattern:'Rapid successive txns',        occurrences:65,  riskLevel:'medium', description:'Multiple txns in short window' },
    { id:5, pattern:'New device detected',          occurrences:54,  riskLevel:'low',    description:'Previously unseen device' },
    { id:6, pattern:'Unusual time of day',          occurrences:43,  riskLevel:'low',    description:'Activity during abnormal hours' },
  ];

  const totalOccurrences = fraudPatterns.reduce((s, p) => s + p.occurrences, 0);

  return (
    <div className="tfp-wrapper">
      <div className="tfp-subheader">
        <span className="tfp-total">{totalOccurrences.toLocaleString()} total detections</span>
        <div className="tfp-legend">
          <span className="tfp-leg"><span className="tfp-dot high"></span>High</span>
          <span className="tfp-leg"><span className="tfp-dot medium"></span>Med</span>
          <span className="tfp-leg"><span className="tfp-dot low"></span>Low</span>
        </div>
      </div>

      {fraudPatterns.map((p, i) => {
        const pct = ((p.occurrences / totalOccurrences) * 100).toFixed(1);
        return (
          <div key={p.id} className="tfp-row">
            <span className="tfp-rank">{i + 1}</span>
            <span className={`tfp-risk-dot ${p.riskLevel}`}></span>
            <div>
              <div className="tfp-title">{p.pattern}</div>
              <div className="tfp-desc">{p.description}</div>
            </div>
            <div className="tfp-count">
              {p.occurrences}<span className="tfp-count-sub"> det</span>
            </div>
            <div className="tfp-bar-track">
              <div className={`tfp-bar-fill ${p.riskLevel}`} style={{ width: `${pct}%` }}></div>
            </div>
            <span className="tfp-pct">{pct}%</span>
          </div>
        );
      })}

      <div className="tfp-footer">
        <button className="tfp-footer-btn" onClick={() => navigate('/fraud-patterns')}>
          <i className="bi bi-file-earmark-text"></i>Full Pattern Report
        </button>
      </div>
    </div>
  );
};

export default TopFraudPatterns;