import React, { useState, useMemo } from 'react';
import HistoryStats       from '../components/reviewhistory/HistoryStats';
import HistoryFilter      from '../components/reviewhistory/HistoryFilter';
import HistoryTable       from '../components/reviewhistory/HistoryTable';
import HistoryDetailModal from '../components/reviewhistory/HistoryDetailModal';
import './ReviewHistory.css';

/* ── Sample seed data ── */
const SAMPLE_HISTORY = [
  { id:1,  transactionId:'TRX001234', action:'approved',  reviewer:'Admin User',  reviewerRole:'Senior Analyst',  timestamp:new Date().toISOString(),                     amount:15000000, riskScore:78, duration:'3 minutes', notes:'Verified with customer via phone call' },
  { id:2,  transactionId:'TRX001233', action:'rejected',  reviewer:'Jane Smith',  reviewerRole:'Fraud Analyst',   timestamp:new Date(Date.now()-3600000).toISOString(),   amount:25000000, riskScore:92, duration:'5 minutes', notes:'Multiple red flags, suspicious pattern detected' },
  { id:3,  transactionId:'TRX001232', action:'escalated', reviewer:'John Doe',    reviewerRole:'Junior Analyst',  timestamp:new Date(Date.now()-7200000).toISOString(),   amount:50000000, riskScore:88, duration:'8 minutes', notes:'Requires senior approval due to high amount' },
  { id:4,  transactionId:'TRX001231', action:'approved',  reviewer:'Sarah W.',    reviewerRole:'Fraud Analyst',   timestamp:new Date(Date.now()-10800000).toISOString(),  amount:8500000,  riskScore:45, duration:'2 minutes', notes:'Legitimate customer, verified transaction history' },
  { id:5,  transactionId:'TRX001230', action:'rejected',  reviewer:'Admin User',  reviewerRole:'Senior Analyst',  timestamp:new Date(Date.now()-18000000).toISOString(),  amount:32000000, riskScore:95, duration:'6 minutes', notes:'VPN detected, blacklisted IP confirmed' },
  { id:6,  transactionId:'TRX001229', action:'approved',  reviewer:'Rina Sari',   reviewerRole:'Fraud Analyst',   timestamp:new Date(Date.now()-21600000).toISOString(),  amount:4750000,  riskScore:40, duration:'2 minutes', notes:'Regular customer, transaction matches history' },
  { id:7,  transactionId:'TRX001228', action:'flagged',   reviewer:'John Doe',    reviewerRole:'Junior Analyst',  timestamp:new Date(Date.now()-25200000).toISOString(),  amount:18000000, riskScore:72, duration:'4 minutes', notes:'Needs further review — unusual location detected' },
  { id:8,  transactionId:'TRX001227', action:'rejected',  reviewer:'Jane Smith',  reviewerRole:'Fraud Analyst',   timestamp:new Date(Date.now()-28800000).toISOString(),  amount:60000000, riskScore:97, duration:'7 minutes', notes:'Critical risk score, fraudulent pattern confirmed' },
  { id:9,  transactionId:'TRX001226', action:'approved',  reviewer:'Admin User',  reviewerRole:'Senior Analyst',  timestamp:new Date(Date.now()-86400000).toISOString(),  amount:3200000,  riskScore:33, duration:'1 minute',  notes:'Low risk, approved automatically' },
  { id:10, transactionId:'TRX001225', action:'escalated', reviewer:'Budi S.',     reviewerRole:'Junior Analyst',  timestamp:new Date(Date.now()-90000000).toISOString(),  amount:42000000, riskScore:83, duration:'6 minutes', notes:'Escalated to senior team for final decision' },
  { id:11, transactionId:'TRX001224', action:'approved',  reviewer:'Sarah W.',    reviewerRole:'Fraud Analyst',   timestamp:new Date(Date.now()-172800000).toISOString(), amount:7100000,  riskScore:51, duration:'3 minutes', notes:'Customer confirmed transaction via OTP' },
  { id:12, transactionId:'TRX001223', action:'rejected',  reviewer:'Rina Sari',   reviewerRole:'Fraud Analyst',   timestamp:new Date(Date.now()-180000000).toISOString(), amount:29000000, riskScore:91, duration:'5 minutes', notes:'Account flagged previously, transaction rejected' },
  { id:13, transactionId:'TRX001222', action:'flagged',   reviewer:'John Doe',    reviewerRole:'Junior Analyst',  timestamp:new Date(Date.now()-259200000).toISOString(), amount:11000000, riskScore:68, duration:'3 minutes', notes:'Unusual device fingerprint, sent for review' },
  { id:14, transactionId:'TRX001221', action:'approved',  reviewer:'Admin User',  reviewerRole:'Senior Analyst',  timestamp:new Date(Date.now()-345600000).toISOString(), amount:6200000,  riskScore:38, duration:'2 minutes', notes:'Verified customer, consistent behavior' },
  { id:15, transactionId:'TRX001220', action:'escalated', reviewer:'Jane Smith',  reviewerRole:'Fraud Analyst',   timestamp:new Date(Date.now()-432000000).toISOString(), amount:75000000, riskScore:86, duration:'9 minutes', notes:'High-value transaction, needs manager sign-off' },
];

/* ── Date filter helper ── */
const isInRange = (timestamp, range) => {
  if (range === 'all') return true;
  const diff = Date.now() - new Date(timestamp).getTime();
  if (range === 'today') return diff < 86400000;
  if (range === 'week')  return diff < 604800000;
  if (range === 'month') return diff < 2592000000;
  return true;
};

const ReviewHistory = ({ liveHistory = [] }) => {
  const [actionFilter, setActionFilter] = useState('all');
  const [dateRange,    setDateRange]    = useState('all');
  const [searchTerm,   setSearchTerm]   = useState('');
  const [selectedEntry, setSelectedEntry] = useState(null);

  /* Merge live entries (from ManualReview actions) on top of sample data */
  const allData = useMemo(() => {
    const live = liveHistory.map((h, i) => ({ ...h, id: `live-${i}` }));
    return [...live, ...SAMPLE_HISTORY];
  }, [liveHistory]);

  const filtered = useMemo(() => {
    return allData.filter(item => {
      if (actionFilter !== 'all' && item.action !== actionFilter) return false;
      if (!isInRange(item.timestamp, dateRange)) return false;
      const q = searchTerm.toLowerCase();
      if (q && !item.transactionId.toLowerCase().includes(q) && !item.reviewer.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [allData, actionFilter, dateRange, searchTerm]);

  return (
    <div className="review-history-page">
      {/* Page header */}
      <div className="rh-page-header">
        <div className="rh-header-content">
          <div className="rh-header-icon">
            <i className="bi bi-clock-history"></i>
          </div>
          <div>
            <h1>Review History</h1>
            <p className="rh-subtitle">Complete audit log of all manual review decisions</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <HistoryStats data={allData} />

      {/* Filter */}
      <HistoryFilter
        actionFilter={actionFilter} setActionFilter={setActionFilter}
        dateRange={dateRange}       setDateRange={setDateRange}
        searchTerm={searchTerm}     setSearchTerm={setSearchTerm}
        totalResults={filtered.length}
      />

      {/* Table */}
      <HistoryTable data={filtered} onViewDetail={setSelectedEntry} />

      {/* Detail modal */}
      {selectedEntry && (
        <HistoryDetailModal item={selectedEntry} onClose={() => setSelectedEntry(null)} />
      )}
    </div>
  );
};

export default ReviewHistory;