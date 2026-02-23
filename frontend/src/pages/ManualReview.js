import React, { useState, useEffect, useCallback } from 'react';
import PageLoader from '../components/common/PageLoader';
import ReviewFilter from '../components/review/ReviewFilter';
import ReviewStats from '../components/review/ReviewStats';
import BulkActions from '../components/review/BulkActions';
import './ManualReview.css';

const fmt = (amount) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

const fmtDate = (ds) => {
  const d = new Date(ds);
  return d.toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
};

const RISK_COLOR = { low:'#16a34a', medium:'#d97706', high:'#ea580c', critical:'#dc2626' };
const getRiskColor = (l) => RISK_COLOR[l] || '#475569';
const TXN_PER_PAGE = 5;

const StatusTag = ({ status }) => {
  const map = {
    pending:  { icon:'bi-clock-history',    label:'Pending' },
    approved: { icon:'bi-check-circle-fill', label:'Approved' },
    rejected: { icon:'bi-x-circle-fill',     label:'Rejected' },
  };
  const { icon, label } = map[status] || map.pending;
  return <span className={`status-tag ${status}`}><i className={`bi ${icon}`}></i>{label}</span>;
};

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
        Showing <strong>{start}–{end}</strong> of <strong>{totalItems}</strong> records
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

/* ── Transaction Detail Modal ── */
const TxnModal = ({ transaction, onClose, onReview }) => {
  const [decision, setDecision] = useState('');
  const [notes, setNotes] = useState('');
  const [confirming, setConfirming] = useState(false);
  const rColor = getRiskColor(transaction.riskLevel);
  const isPending = transaction.status === 'pending';
  const handleDecide = (d) => { setDecision(d); setConfirming(true); };
  const handleConfirm = () => { onReview(transaction.id, decision, notes); };
  const handleCancelConfirm = () => { setDecision(''); setConfirming(false); };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="txn-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-left">
            <span className="modal-txn-id">{transaction.id}</span>
            <StatusTag status={transaction.status} />
          </div>
          <button className="modal-close-btn" onClick={onClose}><i className="bi bi-x-lg"></i></button>
        </div>
        <div className="modal-body">
          <div className="modal-grid" style={{ marginBottom: '1.25rem' }}>
            <div className="modal-risk-block">
              <div className="modal-risk-circle" style={{ borderColor: rColor, color: rColor }}>
                <span className="modal-risk-num">{transaction.fraudScore}</span>
                <span className="modal-risk-sub">/100</span>
              </div>
              <div>
                <div className="modal-risk-info-label">Fraud Risk Score</div>
                <div className="modal-risk-level" style={{ color: rColor }}>{transaction.riskLevel.toUpperCase()} RISK</div>
              </div>
            </div>
            <div className="modal-info-block">
              <div className="modal-block-title"><i className="bi bi-arrow-left-right"></i>Transaction</div>
              <div className="modal-field-row"><span className="modal-field-label">Amount</span><span className="modal-field-value amount">{fmt(transaction.amount)}</span></div>
              <div className="modal-field-row"><span className="modal-field-label">Type</span><span className="modal-field-value">{transaction.transactionType}</span></div>
              <div className="modal-field-row"><span className="modal-field-label">Date & Time</span><span className="modal-field-value mono">{fmtDate(transaction.date)}</span></div>
            </div>
          </div>
          <div className="modal-grid" style={{ marginBottom: '1.25rem' }}>
            <div className="modal-info-block">
              <div className="modal-block-title"><i className="bi bi-person-circle"></i>User</div>
              <div className="modal-field-row"><span className="modal-field-label">Name</span><span className="modal-field-value">{transaction.userName}</span></div>
              <div className="modal-field-row"><span className="modal-field-label">User ID</span><span className="modal-field-value mono">{transaction.userId}</span></div>
            </div>
            <div className="modal-info-block">
              <div className="modal-block-title"><i className="bi bi-cpu"></i>Device & Network</div>
              <div className="modal-field-row"><span className="modal-field-label">Device</span><span className="modal-field-value">{transaction.device}</span></div>
              <div className="modal-field-row"><span className="modal-field-label">IP Address</span><span className="modal-field-value mono">{transaction.ipAddress}</span></div>
              <div className="modal-field-row"><span className="modal-field-label">Location</span><span className="modal-field-value">{transaction.location}</span></div>
            </div>
          </div>
          {transaction.anomalies?.length > 0 && (
            <div className="modal-info-block" style={{ marginBottom: '1.25rem' }}>
              <div className="modal-block-title"><i className="bi bi-exclamation-triangle"></i>Detected Anomalies ({transaction.anomalies.length})</div>
              <ul className="modal-anomaly-list">
                {transaction.anomalies.map((a, i) => <li key={i} className="modal-anomaly-item"><i className="bi bi-dot"></i>{a}</li>)}
              </ul>
            </div>
          )}
          {!isPending && (
            <div className="modal-reviewed-state">
              <i className={`bi ${transaction.status === 'approved' ? 'bi-check-circle-fill' : 'bi-x-circle-fill'} modal-reviewed-icon`} style={{ color: transaction.status === 'approved' ? '#16a34a' : '#dc2626' }}></i>
              <h4>Already {transaction.status === 'approved' ? 'Approved' : 'Rejected'}</h4>
              <p>This transaction was reviewed on {fmtDate(transaction.reviewedAt || transaction.date)}</p>
              {transaction.reviewNotes && <div className="audit-notes-block" style={{ marginTop: '.75rem', textAlign: 'left' }}><i className="bi bi-chat-left-text"></i><span className="audit-notes-text">{transaction.reviewNotes}</span></div>}
            </div>
          )}
          {isPending && (
            <div className="modal-decision">
              <div className="modal-decision-title">Make Decision</div>
              {!confirming ? (
                <div className="modal-decision-btns">
                  <button className="modal-btn-approve" onClick={() => handleDecide('approved')}><i className="bi bi-check-circle"></i>Approve Transaction</button>
                  <button className="modal-btn-reject" onClick={() => handleDecide('rejected')}><i className="bi bi-x-circle"></i>Reject Transaction</button>
                </div>
              ) : (
                <div className="modal-confirm-section">
                  <div className="modal-notes-input">
                    <label>Review Notes (Optional)</label>
                    <textarea rows="3" placeholder="Add notes about your decision..." value={notes} onChange={e => setNotes(e.target.value)} />
                  </div>
                  <div className="modal-confirm-row">
                    <button className="modal-btn-cancel" onClick={handleCancelConfirm}>Cancel</button>
                    <button className={decision === 'approved' ? 'modal-btn-confirm-approve' : 'modal-btn-confirm-reject'} onClick={handleConfirm}>
                      Confirm {decision === 'approved' ? 'Approval' : 'Rejection'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ── Main ── */
const ManualReview = () => {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions]                 = useState([]);
  const [selectedTxn, setSelectedTxn]                   = useState(null);
  const [selectedTransactions, setSelectedTransactions] = useState([]);
  const [filterStatus, setFilterStatus]                 = useState('all');
  const [searchTerm, setSearchTerm]                     = useState('');
  const [txnPage, setTxnPage]                           = useState(1);
  const [stats, setStats] = useState({
    pending:0, approved:0, rejected:0,
    approvedToday:0, rejectedToday:0,
    avgReviewTime:2.5,
    pendingTrend:10, approvedTrend:-5, rejectedTrend:8, timeTrend:-12
  });

  useEffect(() => {
    const sample = [
      { id:'TRX001', userId:'USR12345', userName:'John Doe',         amount:15000000,  date:'2026-02-13 14:23:00', fraudScore:78, riskLevel:'high',     status:'pending',  location:'Jakarta, Indonesia',   ipAddress:'103.140.25.12',  device:'iPhone 14 Pro',          transactionType:'Transfer',   anomalies:['Unusual transaction amount','New device detected','Different location than usual'] },
      { id:'TRX002', userId:'USR67890', userName:'Jane Smith',       amount:5000000,   date:'2026-02-13 13:45:00', fraudScore:65, riskLevel:'medium',    status:'pending',  location:'Surabaya, Indonesia',  ipAddress:'180.251.74.88',  device:'Samsung Galaxy S23',     transactionType:'Payment',    anomalies:['Multiple failed attempts','Unusual time of transaction'] },
      { id:'TRX003', userId:'USR11223', userName:'Ahmad Rahman',     amount:25000000,  date:'2026-02-13 12:30:00', fraudScore:85, riskLevel:'high',      status:'pending',  location:'Bandung, Indonesia',   ipAddress:'114.122.45.67',  device:'Xiaomi Redmi Note 12',   transactionType:'Withdrawal', anomalies:['Account age less than 7 days','High amount for new account','Suspicious IP pattern'] },
      { id:'TRX004', userId:'USR44556', userName:'Sarah Williams',   amount:3500000,   date:'2026-02-13 11:15:00', fraudScore:52, riskLevel:'medium',    status:'approved', location:'Bali, Indonesia',      ipAddress:'36.85.91.123',   device:'MacBook Pro',            transactionType:'Purchase',   anomalies:['First international purchase'] },
      { id:'TRX005', userId:'USR77889', userName:'Michael Chen',     amount:50000000,  date:'2026-02-13 10:00:00', fraudScore:92, riskLevel:'critical',  status:'rejected', location:'Unknown',              ipAddress:'45.76.123.45',   device:'Unknown Device',         transactionType:'Transfer',   anomalies:['VPN detected','Blacklisted IP range','Extremely high amount'] },
      { id:'TRX006', userId:'USR33211', userName:'Budi Santoso',     amount:8750000,   date:'2026-02-13 09:30:00', fraudScore:71, riskLevel:'high',      status:'pending',  location:'Medan, Indonesia',     ipAddress:'125.160.77.22',  device:'OPPO Reno 8',            transactionType:'Transfer',   anomalies:['Unusual location','New device'] },
      { id:'TRX007', userId:'USR55678', userName:'Dewi Kusuma',      amount:12000000,  date:'2026-02-13 08:55:00', fraudScore:58, riskLevel:'medium',    status:'pending',  location:'Yogyakarta, Indonesia',ipAddress:'103.28.13.44',   device:'iPhone 13',              transactionType:'Payment',    anomalies:['Unusual transaction time'] },
      { id:'TRX008', userId:'USR99001', userName:'Reza Pratama',     amount:75000000,  date:'2026-02-12 22:10:00', fraudScore:94, riskLevel:'critical',  status:'pending',  location:'Unknown',              ipAddress:'212.45.99.1',    device:'Unknown Device',         transactionType:'Withdrawal', anomalies:['VPN detected','Blacklisted IP','Critical amount threshold exceeded'] },
      { id:'TRX009', userId:'USR20034', userName:'Siti Rahayu',      amount:2000000,   date:'2026-02-12 21:00:00', fraudScore:35, riskLevel:'low',       status:'approved', location:'Semarang, Indonesia',  ipAddress:'180.241.55.10',  device:'Samsung A54',            transactionType:'Purchase',   anomalies:[] },
      { id:'TRX010', userId:'USR45678', userName:'Kevin Tanaka',     amount:18500000,  date:'2026-02-12 19:45:00', fraudScore:80, riskLevel:'high',      status:'pending',  location:'Jakarta, Indonesia',   ipAddress:'103.140.88.99',  device:'iPad Pro',               transactionType:'Transfer',   anomalies:['High value transfer','Rapid successive transactions'] },
      { id:'TRX011', userId:'USR66543', userName:'Nurul Hidayah',    amount:4300000,   date:'2026-02-12 18:20:00', fraudScore:47, riskLevel:'medium',    status:'rejected', location:'Makassar, Indonesia',  ipAddress:'36.91.100.5',    device:'Xiaomi Poco X5',         transactionType:'Payment',    anomalies:['Multiple failed attempts'] },
      { id:'TRX012', userId:'USR88123', userName:'Andika Wijaya',    amount:30000000,  date:'2026-02-12 16:05:00', fraudScore:88, riskLevel:'critical',  status:'pending',  location:'Batam, Indonesia',     ipAddress:'114.79.22.33',   device:'Unknown Device',         transactionType:'Transfer',   anomalies:['Account age less than 7 days','Suspicious IP pattern','Critical amount'] },
      { id:'TRX013', userId:'USR10293', userName:'Hana Pertiwi',     amount:9600000,   date:'2026-02-12 14:30:00', fraudScore:62, riskLevel:'medium',    status:'pending',  location:'Surabaya, Indonesia',  ipAddress:'180.252.66.44',  device:'iPhone 12',              transactionType:'Withdrawal', anomalies:['Unusual withdrawal amount'] },
      { id:'TRX014', userId:'USR37412', userName:'Dimas Aditya',     amount:6200000,   date:'2026-02-12 12:00:00', fraudScore:55, riskLevel:'medium',    status:'approved', location:'Bandung, Indonesia',   ipAddress:'125.165.44.11',  device:'ASUS Zenfone',           transactionType:'Purchase',   anomalies:['First large purchase'] },
      { id:'TRX015', userId:'USR58900', userName:'Laras Wulandari',  amount:45000000,  date:'2026-02-12 10:15:00', fraudScore:90, riskLevel:'critical',  status:'pending',  location:'Unknown',              ipAddress:'89.45.200.1',    device:'Unknown Device',         transactionType:'Transfer',   anomalies:['VPN detected','Blacklisted IP','Extremely high amount','New account'] },
    ];
    setTransactions(sample);
    const pending  = sample.filter(t => t.status === 'pending').length;
    const approved = sample.filter(t => t.status === 'approved').length;
    const rejected = sample.filter(t => t.status === 'rejected').length;
    setStats(p => ({ ...p, pending, approved, rejected, approvedToday:approved, rejectedToday:rejected }));
    setLoading(false);
  }, []);

  useEffect(() => { setTxnPage(1); }, [filterStatus, searchTerm]);

  const handleReview = useCallback((txnId, decision, notes) => {
    setTransactions(prev => {
      const updated = prev.map(t => t.id === txnId ? { ...t, status:decision, reviewNotes:notes, reviewedAt:new Date().toISOString() } : t);
      const p = updated.filter(t => t.status==='pending').length;
      const a = updated.filter(t => t.status==='approved').length;
      const r = updated.filter(t => t.status==='rejected').length;
      setStats(prev => ({ ...prev, pending:p, approved:a, rejected:r, approvedToday:a, rejectedToday:r }));
      return updated;
    });
    setSelectedTxn(null);
  }, []);

  const handleSelectTransaction = (t) => {
    setSelectedTransactions(prev => prev.find(x => x.id === t.id) ? prev.filter(x => x.id !== t.id) : [...prev, t]);
  };

  const handleBulkAction = (action, notes) => {
    if (action === 'export') { alert(`Exporting ${selectedTransactions.length} transactions...`); setSelectedTransactions([]); return; }
    const ids = selectedTransactions.map(t => t.id);
    setTransactions(prev => {
      const updated = prev.map(t => ids.includes(t.id) ? { ...t, status:action, reviewNotes:notes, reviewedAt:new Date().toISOString() } : t);
      const p = updated.filter(t=>t.status==='pending').length;
      const a = updated.filter(t=>t.status==='approved').length;
      const r = updated.filter(t=>t.status==='rejected').length;
      setStats(prev => ({ ...prev, pending:p, approved:a, rejected:r, approvedToday:a, rejectedToday:r }));
      return updated;
    });
    setSelectedTransactions([]);
  };

  const filtered = transactions
    .filter(t => filterStatus==='all' || t.status===filterStatus)
    .filter(t =>
      t.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.userId.toLowerCase().includes(searchTerm.toLowerCase())
    );

  const totalTxnPages = Math.ceil(filtered.length / TXN_PER_PAGE);
  const paginatedTxns = filtered.slice((txnPage - 1) * TXN_PER_PAGE, txnPage * TXN_PER_PAGE);

  if (loading) return <PageLoader message="Memuat Manual Review..." />;

  return (
    <div className="manual-review-page">
      <div className="review-header">
        <div className="header-content">
          <h1>Manual Review</h1>
          <p className="subtitle">Review and verify flagged transactions</p>
        </div>
      </div>

      <ReviewStats stats={stats} />

      {selectedTransactions.length > 0 && (
        <BulkActions
          selectedTransactions={selectedTransactions}
          onBulkAction={handleBulkAction}
          onClearSelection={() => setSelectedTransactions([])}
        />
      )}

      <ReviewFilter filterStatus={filterStatus} setFilterStatus={setFilterStatus} searchTerm={searchTerm} setSearchTerm={setSearchTerm} />

      <div className="review-section">
        <div className="section-header">
          <span className="section-title"><i className="bi bi-table"></i>Flagged Transactions</span>
          <span className="section-meta">{filtered.length} records</span>
        </div>
        <div className="txn-table-wrapper">
          {filtered.length === 0 ? (
            <div className="txn-empty">
              <i className="bi bi-inbox"></i>
              <p>No transactions match the current filter</p>
            </div>
          ) : (
            <table className="txn-table">
              <thead>
                <tr>
                  <th className="col-check">
                    <input type="checkbox" className="txn-check"
                      checked={selectedTransactions.length === filtered.filter(t=>t.status==='pending').length && filtered.filter(t=>t.status==='pending').length > 0}
                      onChange={(e) => {
                        const pendingRows = filtered.filter(t => t.status==='pending');
                        setSelectedTransactions(e.target.checked ? pendingRows : []);
                      }}
                    />
                  </th>
                  <th className="col-id">Txn ID</th>
                  <th>User</th>
                  <th>Amount</th>
                  <th className="hide-sm">Type</th>
                  <th className="hide-sm">Date & Time</th>
                  <th className="hide-sm">Location</th>
                  <th>Anomalies</th>
                  <th className="col-risk center">Risk</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {paginatedTxns.map(t => {
                  const rColor = getRiskColor(t.riskLevel);
                  const isMSel = selectedTransactions.some(x => x.id === t.id);
                  return (
                    <tr key={t.id} className={isMSel ? 'row-selected' : ''} onClick={() => setSelectedTxn(t)}>
                      <td className="col-check" onClick={e => e.stopPropagation()}>
                        {t.status === 'pending' && (
                          <input type="checkbox" className="txn-check" checked={isMSel} onChange={() => handleSelectTransaction(t)} />
                        )}
                      </td>
                      <td><span className="cell-id">{t.id}</span></td>
                      <td><div className="cell-user-name">{t.userName}</div><div className="cell-user-id">{t.userId}</div></td>
                      <td><span className="cell-amount">{fmt(t.amount)}</span></td>
                      <td className="hide-sm">{t.transactionType}</td>
                      <td className="hide-sm"><span className="cell-date">{fmtDate(t.date)}</span></td>
                      <td className="hide-sm" style={{ color:'#475569', fontSize:'.85rem' }}>{t.location}</td>
                      <td>
                        {t.anomalies?.length > 0
                          ? <span className="anomaly-pill"><i className="bi bi-exclamation-triangle-fill"></i>{t.anomalies.length}</span>
                          : <span style={{ color:'#94a3b8', fontSize:'.8rem' }}>—</span>}
                      </td>
                      <td className="center">
                        <span className={`risk-badge risk-${t.riskLevel}`}>
                          <span className="risk-score-num">{t.fraudScore}</span>
                          <span className="risk-label-text">{t.riskLevel}</span>
                        </span>
                      </td>
                      <td><StatusTag status={t.status} /></td>
                      <td onClick={e => e.stopPropagation()}>
                        <button className="btn-detail" onClick={() => setSelectedTxn(t)}><i className="bi bi-eye"></i>Detail</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <Pagination
          currentPage={txnPage}
          totalPages={totalTxnPages}
          totalItems={filtered.length}
          perPage={TXN_PER_PAGE}
          onPageChange={setTxnPage}
        />
      </div>

      {selectedTxn && (
        <TxnModal transaction={selectedTxn} onClose={() => setSelectedTxn(null)} onReview={handleReview} />
      )}
    </div>
  );
};

export default ManualReview;