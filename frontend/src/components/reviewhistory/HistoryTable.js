import React, { useState } from 'react';
import './HistoryTable.css';

const fmt = (amount) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

const fmtTs = (ds) => {
  const d = new Date(ds);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const timeAgo = (ds) => {
  const diff = (Date.now() - new Date(ds).getTime()) / 1000;
  if (diff < 60)    return `${Math.floor(diff)}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

const ACTION_META = {
  approved:  { icon: 'bi-check-circle-fill',    label: 'Approved',  cls: 'approved' },
  rejected:  { icon: 'bi-x-circle-fill',        label: 'Rejected',  cls: 'rejected' },
  flagged:   { icon: 'bi-flag-fill',            label: 'Flagged',   cls: 'flagged' },
  escalated: { icon: 'bi-arrow-up-circle-fill', label: 'Escalated', cls: 'escalated' },
};

/* ── Service badge ── */
const ServiceBadge = ({ service }) => (
  <span style={{
    display: 'inline-block',
    padding: '2px 7px',
    borderRadius: '4px',
    fontSize: '.65rem',
    fontWeight: 700,
    letterSpacing: '.04em',
    background: service === 'agenusa' ? '#eff6ff' : '#fdf4ff',
    color:      service === 'agenusa' ? '#1d4ed8' : '#7c3aed',
    border: `1px solid ${service === 'agenusa' ? '#bfdbfe' : '#e9d5ff'}`,
  }}>
    {service === 'agenusa' ? 'AGENUSA' : 'NUSABILL'}
  </span>
);

const ROWS_PER_PAGE = 10;

/* ── Pagination ── */
const Pagination = ({ currentPage, totalPages, totalItems, perPage, onPageChange }) => {
  const start = totalItems === 0 ? 0 : (currentPage - 1) * perPage + 1;
  const end   = Math.min(currentPage * perPage, totalItems);
  const eff   = Math.max(1, totalPages);

  const getPages = () => {
    if (eff <= 7) return Array.from({ length: eff }, (_, i) => i + 1);
    const pages = [1];
    if (currentPage > 3) pages.push('...');
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(eff - 1, currentPage + 1); i++) pages.push(i);
    if (currentPage < eff - 2) pages.push('...');
    pages.push(eff);
    return pages;
  };

  return (
    <div className="htable-pagination">
      <span className="hpagination-info">
        Showing <strong>{start}–{end}</strong> of <strong>{totalItems}</strong> entries
      </span>
      <div className="hpagination-controls">
        <button className="hpage-btn nav" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}>
          <i className="bi bi-chevron-left"></i>
        </button>
        {getPages().map((p, i) =>
          p === '...'
            ? <span key={`dot${i}`} className="hpage-ellipsis">…</span>
            : <button key={p} className={`hpage-btn${p === currentPage ? ' active' : ''}`} onClick={() => onPageChange(p)}>{p}</button>
        )}
        <button className="hpage-btn nav" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === eff || totalItems === 0}>
          <i className="bi bi-chevron-right"></i>
        </button>
      </div>
    </div>
  );
};

/* ── Main Table ── */
const HistoryTable = ({ data, onViewDetail }) => {
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey]   = useState('timestamp');
  const [sortDir, setSortDir]   = useState('desc');

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
    setPage(1);
  };

  const sorted = [...data].sort((a, b) => {
    let av = a[sortKey], bv = b[sortKey];
    if (sortKey === 'timestamp') { av = new Date(av); bv = new Date(bv); }
    if (sortKey === 'amount' || sortKey === 'riskScore') { av = Number(av); bv = Number(bv); }
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ?  1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sorted.length / ROWS_PER_PAGE);
  const paginated  = sorted.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);

  const SortIcon = ({ col }) => (
    <i className={`bi sort-icon ${
      sortKey === col
        ? sortDir === 'asc' ? 'bi-sort-up-alt active' : 'bi-sort-down-alt active'
        : 'bi-arrow-down-up'
    }`}></i>
  );

  return (
    <div className="htable-section">
      <div className="htable-header">
        <span className="htable-title">
          <i className="bi bi-clock-history"></i>
          Review Audit Log
        </span>
        <span className="htable-meta">{data.length} entries</span>
      </div>

      <div className="htable-wrapper">
        {data.length === 0 ? (
          <div className="htable-empty">
            <i className="bi bi-inbox"></i>
            <p>No review history found</p>
            <span>Try adjusting your filters</span>
          </div>
        ) : (
          <table className="htable">
            <thead>
              <tr>
                <th className="sortable" onClick={() => handleSort('timestamp')}>
                  Timestamp <SortIcon col="timestamp" />
                </th>
                <th>Action</th>
                <th>Layanan</th>
                <th className="sortable" onClick={() => handleSort('transactionId')}>
                  Txn ID <SortIcon col="transactionId" />
                </th>
                <th className="hide-md">Account / Customer</th>
                <th className="sortable" onClick={() => handleSort('amount')}>
                  Amount <SortIcon col="amount" />
                </th>
                <th className="hide-md sortable" onClick={() => handleSort('riskScore')}>
                  Risk <SortIcon col="riskScore" />
                </th>
                <th className="hide-md">Reviewer</th>
                <th className="hide-lg">Duration</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map(item => {
                const meta     = ACTION_META[item.action] || ACTION_META.approved;
                const initials = item.reviewer.split(' ').map(n => n[0]).join('').slice(0, 2);
                return (
                  <tr key={item.id} className="htable-row" onClick={() => onViewDetail(item)}>
                    <td>
                      <div className="hcell-ts">{fmtTs(item.timestamp)}</div>
                      <div className="hcell-ts-ago">{timeAgo(item.timestamp)}</div>
                    </td>
                    <td>
                      <div className="haction-cell">
                        <span className={`haction-dot ${meta.cls}`}></span>
                        <span className={`haction-label ${meta.cls}`}>
                          <i className={`bi ${meta.icon}`}></i>
                          {meta.label}
                        </span>
                      </div>
                    </td>
                    {/* Layanan badge */}
                    <td>
                      {item.service
                        ? <ServiceBadge service={item.service} />
                        : <span style={{ color:'#94a3b8', fontSize:'.8rem' }}>—</span>
                      }
                    </td>
                    {/* Txn ID */}
                    <td>
                      <span className="hcell-txnid">{item.transactionId}</span>
                    </td>
                    {/* Account / Customer ID */}
                    <td className="hide-md">
                      <span style={{ fontFamily:'IBM Plex Mono, monospace', fontSize:'.75rem', color:'#334155', fontWeight:600 }}>
                        {item.accountId || '—'}
                      </span>
                    </td>
                    <td>
                      <span className="hcell-amount">{fmt(item.amount)}</span>
                    </td>
                    <td className="hide-md">
                      <span className="hcell-risk" style={{
                        color: item.riskScore >= 80 ? '#dc2626' : item.riskScore >= 60 ? '#d97706' : '#16a34a'
                      }}>
                        {item.riskScore}<span className="hcell-risk-max">/100</span>
                      </span>
                    </td>
                    <td className="hide-md">
                      <div className="hreviewer-row">
                        <div className="hreviewer-avatar">{initials}</div>
                        <div>
                          <div className="hreviewer-name">{item.reviewer}</div>
                          <div className="hreviewer-role">{item.reviewerRole}</div>
                        </div>
                      </div>
                    </td>
                    <td className="hide-lg">
                      <span className="hcell-duration">{item.duration}</span>
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      {item.notes
                        ? (
                          <button className="hbtn-view" onClick={() => onViewDetail(item)}>
                            <i className="bi bi-chat-left-text"></i>View Notes
                          </button>
                        )
                        : <span className="hcell-empty">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={data.length}
        perPage={ROWS_PER_PAGE}
        onPageChange={setPage}
      />
    </div>
  );
};

export default HistoryTable;