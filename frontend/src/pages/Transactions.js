import React, { useState, useEffect, useMemo } from "react";
import TransactionTable    from "../components/transactions/TransactionTable";
import FilterBar           from "../components/transactions/FilterBar";
import SearchBar           from "../components/transactions/SearchBar";
import PaginationComponent from "../components/transactions/PaginationComponent";
import TransactionDetailModal from "../components/transactions/TransactionDetailModal";
import ExportButton        from "../components/transactions/ExportButton";
import "./Transactions.css";
import PageLoader from "../components/common/PageLoader";

const BASE_URL      = process.env.REACT_APP_ML_API_URL || "http://localhost:8000";
const ITEMS_PER_PAGE = 10;

/* ════════════════════════════════════════════════════════════ */
const Transactions = () => {
  const [loading,     setLoading]     = useState(true);
  const [apiError,    setApiError]    = useState(false);
  const [allTxn,      setAllTxn]      = useState([]);   // raw from backend
  const [apiStats,    setApiStats]    = useState(null); // stats from backend
  const [currentPage, setCurrentPage] = useState(1);

  const [selectedTxn,  setSelectedTxn]  = useState(null);
  const [isModalOpen,  setIsModalOpen]  = useState(false);

  const [filters, setFilters] = useState({
    dateFrom: "", dateTo: "",
    amountMin: "", amountMax: "",
    status:  "all",
    service: "all",
    searchQuery: "",
  });

  /* ── Fetch semua transaksi dari backend ── */
  useEffect(() => {
    const fetchAll = async () => {
      try {
        // Ambil semua transaksi + feedback review secara paralel
        const [txnRes, feedbackRes] = await Promise.all([
          fetch(`${BASE_URL}/transactions/all?limit=10000&offset=0`),
          fetch(`${BASE_URL}/review/feedback`).catch(() => null),
        ]);
        if (!txnRes.ok) throw new Error(`HTTP ${txnRes.status}`);
        const json = await txnRes.json();
        let txns = json.transactions || [];

        // Terapkan keputusan reviewer ke status transaksi.
        // Transaksi yang di-approve/reject dari Manual Review ter-update di sini.
        if (feedbackRes && feedbackRes.ok) {
          const fb = await feedbackRes.json();
          const decisionMap = {};
          (fb.records || []).forEach((r) => {
            if (!decisionMap[r.transaction_id]) {
              decisionMap[r.transaction_id] = r.decision;
            }
          });
          txns = txns.map((t) =>
            decisionMap[t.transactionId]
              ? { ...t, status: decisionMap[t.transactionId], reviewedViaManual: true }
              : t,
          );
        }

        setAllTxn(txns);
        setApiStats(json.stats || null);
      } catch (err) {
        console.warn("Transactions: backend offline, pakai data generated.", err.message);
        setApiError(true);
        setAllTxn(generateFallback());
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  /* ── Filter + search (client-side) ── */
  const filtered = useMemo(() => {
    let arr = [...allTxn];

    if (filters.dateFrom)
      arr = arr.filter(t => t.timestamp && new Date(t.timestamp) >= new Date(filters.dateFrom));
    if (filters.dateTo)
      arr = arr.filter(t => t.timestamp && new Date(t.timestamp) <= new Date(filters.dateTo));
    if (filters.amountMin)
      arr = arr.filter(t => t.amount >= parseFloat(filters.amountMin));
    if (filters.amountMax)
      arr = arr.filter(t => t.amount <= parseFloat(filters.amountMax));
    if (filters.status !== "all")
      arr = arr.filter(t => t.status === filters.status);
    if (filters.service !== "all")
      arr = arr.filter(t => t.service === filters.service);
    if (filters.searchQuery.trim()) {
      const q = filters.searchQuery.toLowerCase();
      arr = arr.filter(t =>
        t.transactionId.toLowerCase().includes(q) ||
        t.accountId.toLowerCase().includes(q) ||
        (t.destId || "").toLowerCase().includes(q),
      );
    }

    return arr;
  }, [allTxn, filters]);

  /* ── Stats ── */
  const stats = useMemo(() => apiStats ?? {
    total:    allTxn.length,
    pending:  allTxn.filter(t => t.status === "pending").length,
    approved: allTxn.filter(t => t.status === "approved").length,
    rejected: allTxn.filter(t => t.status === "rejected").length,
    fraud:    allTxn.filter(t => t.isRealFraud).length,
    highRisk: allTxn.filter(t => t.riskScore >= 65).length,
  }, [apiStats, allTxn]);

  /* ── Pagination ── */
  const totalPages  = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const indexFirst  = (currentPage - 1) * ITEMS_PER_PAGE;
  const indexLast   = indexFirst + ITEMS_PER_PAGE;
  const currentRows = filtered.slice(indexFirst, indexLast);

  /* ── Handlers ── */
  const handleFilterChange  = f   => { setFilters(p => ({ ...p, ...f })); setCurrentPage(1); };
  const handleSearchChange  = q   => { setFilters(p => ({ ...p, searchQuery: q })); setCurrentPage(1); };
  const handleResetFilters  = ()  => {
    setFilters({ dateFrom:"", dateTo:"", amountMin:"", amountMax:"",
                 status:"all", service:"all", searchQuery:"" });
    setCurrentPage(1);
  };
  const handleViewDetails   = t   => { setSelectedTxn(t); setIsModalOpen(true); };

  if (loading) return <PageLoader message="Memuat data transaksi..." />;

  return (
    <div className="transactions-page">
      <div className="container-fluid py-4">

        {/* ── Header ── */}
        <div className="page-header mb-4">
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
            <div>
              <h1 className="page-title">
                <i className="bi bi-receipt"></i> Transactions
              </h1>
              <p className="page-subtitle">Monitor dan analisa semua transaksi</p>
            </div>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              {/* Live / offline badge */}
              {apiError ? (
                <span style={{
                  padding:"6px 14px", borderRadius:"20px",
                  background:"#fffbeb", border:"1px solid #fde68a",
                  color:"#92400e", fontSize:".775rem", fontWeight:600,
                  display:"flex", alignItems:"center", gap:6,
                }}>
                  <i className="bi bi-exclamation-triangle-fill"></i>Static data
                </span>
              ) : (
                <span style={{
                  padding:"6px 14px", borderRadius:"20px",
                  background:"#f0fdf4", border:"1px solid #bbf7d0",
                  color:"#059669", fontSize:".775rem", fontWeight:700,
                  display:"flex", alignItems:"center", gap:6,
                }}>
                  <i className="bi bi-circle-fill" style={{fontSize:".45rem"}}></i>
                  {allTxn.length.toLocaleString()} transaksi
                </span>
              )}
              <ExportButton data={filtered} filename="transactions" />
            </div>
          </div>
        </div>

        {/* ── Stats Cards ── */}
        <div className="row mb-4">
          {[
            { key:"total",    label:"Total",        icon:"bi-list-ul",            bg:"bg-primary" },
            { key:"pending",  label:"Pending",       icon:"bi-hourglass-split",    bg:"",style:{background:"linear-gradient(135deg,#f59e0b,#d97706)"}, note:"Transaksi masih dalam tahap review" },
            { key:"approved", label:"Approved",      icon:"bi-check-circle",       bg:"bg-success" },
            { key:"fraud",    label:"Fraud",         icon:"bi-shield-exclamation", bg:"",style:{background:"linear-gradient(135deg,#dc2626,#991b1b)"}, note:"Transaksi masih dalam tahap review" },
            { key:"filtered", label:"Hasil Filter",  icon:"bi-funnel",             bg:"bg-info",   val: filtered.length },
          ].map(s => (
            <div key={s.key} className="col-xl-3 col-md-4 col-6 mb-3">
              <div className="stat-card">
                <div className={`stat-icon ${s.bg}`} style={s.style}>
                  <i className={`bi ${s.icon}`}></i>
                </div>
                <div className="stat-content">
                  <div className="stat-value">{s.val ?? stats[s.key] ?? 0}</div>
                  <div className="stat-label">{s.label}</div>
                  {s.note && (
                    <div style={{fontSize:".7rem",color:"#94a3b8",marginTop:"2px",fontStyle:"italic"}}>
                      {s.note}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Search ── */}
        <SearchBar searchQuery={filters.searchQuery} onSearchChange={handleSearchChange} />

        {/* ── Filter ── */}
        <FilterBar
          filters={filters}
          onFilterChange={handleFilterChange}
          onResetFilters={handleResetFilters}
        />

        {/* ── Table ── */}
        <div className="card table-card">
          <TransactionTable
            transactions={currentRows}
            onViewDetails={handleViewDetails}
            onApprove={t => alert(`Transaction ${t.transactionId} approved!`)}
            onReject={t  => alert(`Transaction ${t.transactionId} rejected!`)}
          />
          <div className="card-footer">
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
              <div className="pagination-info">
                {filtered.length === 0
                  ? "Tidak ada transaksi ditemukan"
                  : `Menampilkan ${indexFirst + 1}–${Math.min(indexLast, filtered.length)} dari ${filtered.length} transaksi`}
              </div>
              <PaginationComponent
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Detail Modal ── */}
      <TransactionDetailModal
        transaction={selectedTxn}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
};

/* ── Fallback data kalau backend offline ── */
const seededRand = s => { const x = Math.sin(s+1)*10000; return x - Math.floor(x); };
const generateFallback = () => {
  const rows = [];
  for (let i = 1; i <= 60; i++) {
    const r = seededRand(i*7), r2 = seededRand(i*13), r3 = seededRand(i*17);
    const risk = Math.min(99, Math.max(5, Math.floor(r * 95)));
    rows.push({
      id:`AGN-${String(i).padStart(6,"0")}`, service:"agenusa",
      transactionId:`AGN-${String(i).padStart(6,"0")}`,
      accountId:`ACCT1${String(10000+((i*37)%900)).slice(1)}`,
      destId:`DST3${String(10000+((i*53)%900)).slice(1)}`,
      type:"Transfer", channel:null, refundFlag:false,
      amount: Math.floor(50000+r*950000), paymentAmount:null,
      timestamp: new Date(Date.now()-Math.floor(r3*60)*86400000).toISOString(),
      time: new Date(Date.now()-Math.floor(r3*60)*86400000).toISOString(),
      patterns:[], riskScore:risk,
      status: risk>=65 ? "pending" : (r2>0.4 ? "approved" : "pending"),
      isRealFraud: risk >= 65,
    });
  }
  for (let i = 1; i <= 40; i++) {
    const r = seededRand(i*11), r2 = seededRand(i*19), r3 = seededRand(i*29);
    const risk = Math.min(99, Math.max(5, Math.floor(r * 95)));
    const billAmt = Math.floor(50000+r*700000);
    rows.push({
      id:`NUS-${String(i).padStart(6,"0")}`, service:"nusabill",
      transactionId:`NUS-${String(i).padStart(6,"0")}`,
      accountId:`CUST1${String(10000+((i*61)%900)).slice(1)}`,
      destId:`BILL${String(100000+((i*97)%900000))}`,
      type:null, channel:["API","Web","Mobile"][Math.floor(r2*3)],
      refundFlag:false, amount:billAmt, paymentAmount:billAmt,
      timestamp: new Date(Date.now()-Math.floor(r3*60)*86400000).toISOString(),
      time: new Date(Date.now()-Math.floor(r3*60)*86400000).toISOString(),
      patterns:[], riskScore:risk,
      status: risk>=65 ? "pending" : (r2>0.4 ? "approved" : "pending"),
      isRealFraud: risk >= 65,
    });
  }
  return rows.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
};

export default Transactions;