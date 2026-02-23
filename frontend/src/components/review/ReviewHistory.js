import React, { useState } from 'react';
import './ReviewHistory.css';

const fmt = (amount) =>
  new Intl.NumberFormat('id-ID', { style:'currency', currency:'IDR', minimumFractionDigits:0 }).format(amount);

const fmtTs = (ds) => {
  const d = new Date(ds);
  return d.toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
};

const timeAgo = (ds) => {
  const diff = (Date.now() - new Date(ds).getTime()) / 1000;
  if (diff < 60)    return `${Math.floor(diff)}s ago`;
  if (diff < 3600)  return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return `${Math.floor(diff/86400)}d ago`;
};

const ACTION_META = {
  approved:  { icon:'bi-check-circle-fill',    label:'Approved',  cls:'approved' },
  rejected:  { icon:'bi-x-circle-fill',        label:'Rejected',  cls:'rejected' },
  flagged:   { icon:'bi-flag-fill',            label:'Flagged',   cls:'flagged' },
  escalated: { icon:'bi-arrow-up-circle-fill', label:'Escalated', cls:'escalated' },
};

const SAMPLE = [
  { id:1,  transactionId:'TRX001234', action:'approved',  reviewer:'Admin User',  reviewerRole:'Senior Analyst',  timestamp:new Date().toISOString(),                      amount:15000000, riskScore:78, duration:'3 minutes', notes:'Verified with customer via phone call' },
  { id:2,  transactionId:'TRX001233', action:'rejected',  reviewer:'Jane Smith',  reviewerRole:'Fraud Analyst',   timestamp:new Date(Date.now()-3600000).toISOString(),    amount:25000000, riskScore:92, duration:'5 minutes', notes:'Multiple red flags, suspicious pattern detected' },
  { id:3,  transactionId:'TRX001232', action:'escalated', reviewer:'John Doe',    reviewerRole:'Junior Analyst',  timestamp:new Date(Date.now()-7200000).toISOString(),    amount:50000000, riskScore:88, duration:'8 minutes', notes:'Requires senior approval due to high amount' },
  { id:4,  transactionId:'TRX001231', action:'approved',  reviewer:'Sarah W.',    reviewerRole:'Fraud Analyst',   timestamp:new Date(Date.now()-10800000).toISOString(),   amount:8500000,  riskScore:45, duration:'2 minutes', notes:'Legitimate customer, verified transaction history' },
  { id:5,  transactionId:'TRX001230', action:'rejected',  reviewer:'Admin User',  reviewerRole:'Senior Analyst',  timestamp:new Date(Date.now()-18000000).toISOString(),   amount:32000000, riskScore:95, duration:'6 minutes', notes:'VPN detected, blacklisted IP confirmed' },
  { id:6,  transactionId:'TRX001229', action:'approved',  reviewer:'Rina Sari',   reviewerRole:'Fraud Analyst',   timestamp:new Date(Date.now()-21600000).toISOString(),   amount:4750000,  riskScore:40, duration:'2 minutes', notes:'Regular customer, transaction matches history' },
  { id:7,  transactionId:'TRX001228', action:'flagged',   reviewer:'John Doe',    reviewerRole:'Junior Analyst',  timestamp:new Date(Date.now()-25200000).toISOString(),   amount:18000000, riskScore:72, duration:'4 minutes', notes:'Needs further review — unusual location detected' },
  { id:8,  transactionId:'TRX001227', action:'rejected',  reviewer:'Jane Smith',  reviewerRole:'Fraud Analyst',   timestamp:new Date(Date.now()-28800000).toISOString(),   amount:60000000, riskScore:97, duration:'7 minutes', notes:'Critical risk score, fraudulent pattern confirmed' },
  { id:9,  transactionId:'TRX001226', action:'approved',  reviewer:'Admin User',  reviewerRole:'Senior Analyst',  timestamp:new Date(Date.now()-86400000).toISOString(),   amount:3200000,  riskScore:33, duration:'1 minute',  notes:'Low risk, approved automatically' },
  { id:10, transactionId:'TRX001225', action:'escalated', reviewer:'Budi S.',     reviewerRole:'Junior Analyst',  timestamp:new Date(Date.now()-90000000).toISOString(),   amount:42000000, riskScore:83, duration:'6 minutes', notes:'Escalated to senior team for final decision' },
  { id:11, transactionId:'TRX001224', action:'approved',  reviewer:'Sarah W.',    reviewerRole:'Fraud Analyst',   timestamp:new Date(Date.now()-172800000).toISOString(),  amount:7100000,  riskScore:51, duration:'3 minutes', notes:'Customer confirmed transaction via OTP' },
  { id:12, transactionId:'TRX001223', action:'rejected',  reviewer:'Rina Sari',   reviewerRole:'Fraud Analyst',   timestamp:new Date(Date.now()-180000000).toISOString(),  amount:29000000, riskScore:91, duration:'5 minutes', notes:'Account flagged previously, transaction rejected' },
];

const HIST_PER_PAGE = 5;

/* ── Pagination ── */
const Pagination = ({ currentPage, totalPages, totalItems, perPage, onPageChange }) => {
  const start = totalItems === 0 ? 0 : (currentPage - 1) * perPage + 1;
  const end   = Math.min(currentPage * perPage, totalItems);
  const effectivePages = Math.max(1, totalPages);
  const getPages = () => {
    if (effectivePages <= 7) return Array.from({ length: effectivePages }, (_, i) => i + 1);
    const pages = [1];
    if (currentPage > 3) pages.push('...');
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(effectivePages - 1, currentPage + 1); i++) pages.push(i);
    if (currentPage < effectivePages - 2) pages.push('...');
    pages.push(effectivePages);
    return pages;
  };
  return (
    <div className="pagination-bar">
      <span className="pagination-info">
        Showing <strong>{start}–{end}</strong> of <strong>{totalItems}</strong> entries
      </span>
      <div className="pagination-controls">
        <button className="page-btn page-nav" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}>
          <i className="bi bi-chevron-left"></i>
        </button>
        {getPages().map((p, i) =>
          p === '...'
            ? <span key={`dot${i}`} className="page-ellipsis">…</span>
            : <button key={p} className={`page-btn${p === currentPage ? ' active' : ''}`} onClick={() => onPageChange(p)}>{p}</button>
        )}
        <button className="page-btn page-nav" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === effectivePages || totalItems === 0}>
          <i className="bi bi-chevron-right"></i>
        </button>
      </div>
    </div>
  );
};

/* ── History Detail Modal ── */
const HistoryModal = ({ item, onClose }) => {
  const meta = ACTION_META[item.action] || ACTION_META.approved;
  const bgMap = { approved:'#dcfce7', rejected:'#fee2e2', escalated:'#dbeafe', flagged:'#fef3c7' };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="txn-modal audit-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-left">
            <span className="modal-txn-id">Audit Entry</span>
            <span className={`audit-action-label ${meta.cls}`} style={{ padding:'.2rem .6rem', borderRadius:'99px', fontSize:'.7rem', background: bgMap[meta.cls] || '#fef3c7' }}>
              {meta.label}
            </span>
          </div>
          <button className="modal-close-btn" onClick={onClose}><i className="bi bi-x-lg"></i></button>
        </div>
        <div className="audit-modal-hero">
          <div className={`audit-hero-icon ${meta.cls}`}><i className={`bi ${meta.icon}`}></i></div>
          <div>
            <div className="audit-hero-txn">{item.transactionId}</div>
            <div className="audit-hero-meta">{fmtTs(item.timestamp)} · {item.duration}</div>
          </div>
        </div>
        <div className="modal-body">
          <div className="audit-modal-grid">
            <div className="audit-kv"><div className="audit-kv-label">Amount</div><div className="audit-kv-value mono">{fmt(item.amount)}</div></div>
            <div className="audit-kv"><div className="audit-kv-label">Risk Score</div><div className="audit-kv-value mono">{item.riskScore}/100</div></div>
            <div className="audit-kv"><div className="audit-kv-label">Reviewed By</div><div className="audit-kv-value">{item.reviewer}</div></div>
            <div className="audit-kv"><div className="audit-kv-label">Role</div><div className="audit-kv-value">{item.reviewerRole}</div></div>
            <div className="audit-kv"><div className="audit-kv-label">Review Duration</div><div className="audit-kv-value">{item.duration}</div></div>
            <div className="audit-kv"><div className="audit-kv-label">Timestamp</div><div className="audit-kv-value mono" style={{ fontSize:'.75rem' }}>{fmtTs(item.timestamp)}</div></div>
          </div>
          {item.notes && (
            <div className="audit-notes-block">
              <i className="bi bi-chat-left-text"></i>
              <span className="audit-notes-text">{item.notes}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ── Main ── */
const ReviewHistory = ({ history }) => {
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [histPage, setHistPage]           = useState(1);
  const data = (history && history.length > 0) ? history : SAMPLE;

  const stats = {
    approved:  data.filter(d => d.action === 'approved').length,
    rejected:  data.filter(d => d.action === 'rejected').length,
    escalated: data.filter(d => d.action === 'escalated').length,
  };

  const totalHistPages = Math.ceil(data.length / HIST_PER_PAGE);
  const paginatedHist  = data.slice((histPage - 1) * HIST_PER_PAGE, histPage * HIST_PER_PAGE);

  return (
    <>
      <div className="review-section">
        <div className="section-header">
          <span className="section-title"><i className="bi bi-clock-history"></i>Review History</span>
          <span className="section-meta">{data.length} entries</span>
        </div>

        <div className="txn-table-wrapper">
          <table className="audit-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Txn ID</th>
                <th>Amount</th>
                <th className="hide-sm">Risk</th>
                <th className="hide-sm">Reviewer</th>
                <th className="hide-sm">Duration</th>
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {paginatedHist.map(item => {
                const meta     = ACTION_META[item.action] || ACTION_META.approved;
                const initials = item.reviewer.split(' ').map(n => n[0]).join('');
                return (
                  <tr key={item.id} onClick={() => setSelectedEntry(item)}>
                    <td>
                      <div className="audit-ts">{fmtTs(item.timestamp)}</div>
                      <div style={{ fontSize:'.68rem', color:'#94a3b8', marginTop:'.1rem' }}>{timeAgo(item.timestamp)}</div>
                    </td>
                    <td>
                      <div className="audit-action-cell">
                        <span className={`audit-dot ${meta.cls}`}></span>
                        <span className={`audit-action-label ${meta.cls}`}>{meta.label}</span>
                      </div>
                    </td>
                    <td><span className="audit-txn-id">{item.transactionId}</span></td>
                    <td><span className="audit-amount">{fmt(item.amount)}</span></td>
                    <td className="hide-sm">
                      <span style={{ fontFamily:'IBM Plex Mono, monospace', fontSize:'.775rem', fontWeight:'600', color: item.riskScore >= 80 ? '#dc2626' : item.riskScore >= 60 ? '#d97706' : '#16a34a' }}>
                        {item.riskScore}<span style={{ fontWeight:400, color:'#94a3b8' }}>/100</span>
                      </span>
                    </td>
                    <td className="hide-sm">
                      <div className="audit-reviewer">
                        <div className="audit-avatar">{initials}</div>
                        <span className="audit-reviewer-name">{item.reviewer}</span>
                      </div>
                    </td>
                    <td className="hide-sm">
                      <span style={{ fontFamily:'IBM Plex Mono, monospace', fontSize:'.75rem', color:'#475569' }}>{item.duration}</span>
                    </td>
                    <td>
                      {item.notes
                        ? <span className="audit-notes">{item.notes}</span>
                        : <span style={{ color:'#94a3b8', fontSize:'.8rem' }}>—</span>}
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <button className="btn-audit-detail" onClick={() => setSelectedEntry(item)}>
                        <i className="bi bi-eye"></i>View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={histPage}
          totalPages={totalHistPages}
          totalItems={data.length}
          perPage={HIST_PER_PAGE}
          onPageChange={setHistPage}
        />

        <div className="audit-footer">
          <div className="audit-footer-stats">
            <span className="audit-stat green"><i className="bi bi-check-circle-fill"></i>{stats.approved} Approved</span>
            <span className="audit-stat red"><i className="bi bi-x-circle-fill"></i>{stats.rejected} Rejected</span>
            <span className="audit-stat blue"><i className="bi bi-arrow-up-circle-fill"></i>{stats.escalated} Escalated</span>
          </div>
          <button className="btn-audit-detail">View Full Log <i className="bi bi-arrow-right"></i></button>
        </div>
      </div>

      {selectedEntry && <HistoryModal item={selectedEntry} onClose={() => setSelectedEntry(null)} />}
    </>
  );
};

export default ReviewHistory;