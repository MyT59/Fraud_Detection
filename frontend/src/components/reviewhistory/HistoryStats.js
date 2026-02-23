import React from 'react';
import './HistoryStats.css';

const HistoryStats = ({ data }) => {
  const total     = data.length;
  const approved  = data.filter(d => d.action === 'approved').length;
  const rejected  = data.filter(d => d.action === 'rejected').length;
  const escalated = data.filter(d => d.action === 'escalated').length;
  const flagged   = data.filter(d => d.action === 'flagged').length;

  const approvalRate = total > 0 ? ((approved / total) * 100).toFixed(1) : 0;

  const cards = [
    { id:1, label:'Total Reviewed', value:total,     icon:'bi-clipboard-check', color:'purple',  sub:'All-time entries' },
    { id:2, label:'Approved',       value:approved,  icon:'bi-check-circle-fill',color:'success', sub:`${approvalRate}% approval rate` },
    { id:3, label:'Rejected',       value:rejected,  icon:'bi-x-circle-fill',    color:'danger',  sub:'Fraud confirmed' },
    { id:4, label:'Escalated',      value:escalated, icon:'bi-arrow-up-circle-fill', color:'info', sub:'Sent to senior team' },
    { id:5, label:'Flagged',        value:flagged,   icon:'bi-flag-fill',         color:'warning', sub:'Needs further review' },
  ];

  return (
    <div className="history-stats-container">
      {cards.map(card => (
        <div key={card.id} className={`hstat-card hstat-${card.color}`}>
          <div className={`hstat-icon bg-${card.color}`}>
            <i className={`bi ${card.icon}`}></i>
          </div>
          <div className="hstat-content">
            <span className="hstat-label">{card.label}</span>
            <span className="hstat-value">{card.value}</span>
            <span className="hstat-sub">{card.sub}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default HistoryStats;