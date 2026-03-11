import React, { useState, useEffect } from "react";
import TransactionTable from "../components/transactions/TransactionTable";
import FilterBar from "../components/transactions/FilterBar";
import SearchBar from "../components/transactions/SearchBar";
import PaginationComponent from "../components/transactions/PaginationComponent";
import TransactionDetailModal from "../components/transactions/TransactionDetailModal";
import ExportButton from "../components/transactions/ExportButton";
import "./Transactions.css";
import PageLoader from "../components/common/PageLoader";

/* ── Pattern definitions ── */
const AGN_PATTERNS = [
  "rapid_retry_declined",
  "bruteforce_pin_pattern",
  "money_mule_destination",
  "impossible_travel_terminal_switch",
  "midnight_unusual_amount",
];
const NUS_PATTERNS = [
  "sudden_channel_switch_to_api",
  "burst_payment_pattern",
  "refund_abuse_pattern",
  "payment_spike",
  "underpayment",
];

// Thresholds from evaluation report
const AGN_REVIEW_THRESHOLD = 0.5378;
const AGN_HIGH_THRESHOLD = 0.5378;
const NUS_REVIEW_THRESHOLD = 0.4862;
const NUS_HIGH_THRESHOLD = 0.9321;

/* ── Deterministic pseudo-random helper ── */
const seededRand = (seed) => {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
};

/* ── Data generator ── */
const generateTransactions = () => {
  const data = [];
  let id = 1;

  // ── AGENUSA rows (60 txn) ──
  for (let i = 1; i <= 60; i++) {
    const r = seededRand(i * 7);
    const r2 = seededRand(i * 13);
    const r3 = seededRand(i * 17);
    const r4 = seededRand(i * 23);

    // Pick 0–4 patterns based on seed
    const numPat = Math.floor(r * 4);
    const shuffled = [...AGN_PATTERNS].sort(
      (a, b) => seededRand(i + a.length) - 0.5,
    );
    const patterns = shuffled.slice(0, numPat);

    // Risk score: pattern count drives base, add noise
    const baseScore = patterns.length * 20 + Math.floor(r2 * 25);
    const riskScore = Math.min(99, Math.max(10, baseScore));

    // Status from risk
    let status = "pending";
    if (riskScore >= 85) status = r4 > 0.3 ? "pending" : "rejected";
    else if (riskScore < 45) status = r4 > 0.6 ? "approved" : "pending";

    const types = ["Transfer", "Withdrawal", "Transfer", "Transfer"];
    const daysBack = Math.floor(r3 * 60);
    const ts = new Date(
      Date.now() - daysBack * 86400000 - Math.floor(r * 43200000),
    );

    data.push({
      id: `AGN-${String(i).padStart(6, "0")}`,
      service: "agenusa",
      transactionId: `AGN-${String(i).padStart(6, "0")}`,
      accountId: `ACCT1${String(10000 + ((i * 37) % 900)).slice(1)}`,
      destId: `DST3${String(10000 + ((i * 53) % 900)).slice(1)}`,
      type: types[Math.floor(r2 * types.length)],
      channel: null,
      refundFlag: false,
      amount: Math.floor(50000 + r * 950000),
      paymentAmount: null,
      timestamp: ts.toISOString(),
      time: ts.toISOString(),
      patterns,
      riskScore,
      status,
      // legacy fields for modal compat
      user: `ACCT1${String(10000 + ((i * 37) % 900)).slice(1)}`,
      location: null,
    });
    id++;
  }

  // ── NUSABILL rows (40 txn) ──
  for (let i = 1; i <= 40; i++) {
    const r = seededRand(i * 11);
    const r2 = seededRand(i * 19);
    const r3 = seededRand(i * 29);
    const r4 = seededRand(i * 41);

    const numPat = Math.floor(r * 4);
    const shuffled = [...NUS_PATTERNS].sort(
      (a, b) => seededRand(i + a.length + 100) - 0.5,
    );
    const patterns = shuffled.slice(0, numPat);

    const baseScore = patterns.length * 22 + Math.floor(r2 * 20);
    const riskScore = Math.min(99, Math.max(8, baseScore));

    let status = "pending";
    if (riskScore >= 85) status = r4 > 0.4 ? "pending" : "rejected";
    else if (riskScore < 40) status = r4 > 0.5 ? "approved" : "pending";

    const channels = ["API", "Web", "Mobile", "API", "Web"];
    const daysBack = Math.floor(r3 * 60);
    const ts = new Date(
      Date.now() - daysBack * 86400000 - Math.floor(r * 43200000),
    );
    const billAmt = Math.floor(50000 + r * 700000);
    const hasUnder = patterns.includes("underpayment");

    data.push({
      id: `NUS-${String(i).padStart(6, "0")}`,
      service: "nusabill",
      transactionId: `NUS-${String(i).padStart(6, "0")}`,
      accountId: `CUST1${String(10000 + ((i * 61) % 900)).slice(1)}`,
      destId: `BILL${String(100000 + ((i * 97) % 900000))}`,
      type: null,
      channel: channels[Math.floor(r2 * channels.length)],
      refundFlag: patterns.includes("refund_abuse_pattern"),
      amount: billAmt,
      paymentAmount: hasUnder
        ? Math.floor(billAmt * (0.5 + r * 0.45))
        : billAmt,
      timestamp: ts.toISOString(),
      time: ts.toISOString(),
      patterns,
      riskScore,
      status,
      user: `CUST1${String(10000 + ((i * 61) % 900)).slice(1)}`,
      location: null,
    });
    id++;
  }

  return data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
};

/* ─── Component ────────────────────────────────────────── */
const Transactions = () => {
  const [loading, setLoading] = useState(true);
  const [allTransactions] = useState(generateTransactions);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [filters, setFilters] = useState({
    dateFrom: "",
    dateTo: "",
    amountMin: "",
    amountMax: "",
    status: "all",
    service: "all",
    searchQuery: "",
  });

  /* ── Apply filters ── */
  useEffect(() => {
    let result = [...allTransactions];

    if (filters.dateFrom)
      result = result.filter(
        (t) => new Date(t.timestamp) >= new Date(filters.dateFrom),
      );
    if (filters.dateTo)
      result = result.filter(
        (t) => new Date(t.timestamp) <= new Date(filters.dateTo),
      );
    if (filters.amountMin)
      result = result.filter((t) => t.amount >= parseFloat(filters.amountMin));
    if (filters.amountMax)
      result = result.filter((t) => t.amount <= parseFloat(filters.amountMax));
    if (filters.status !== "all")
      result = result.filter((t) => t.status === filters.status);
    if (filters.service !== "all")
      result = result.filter((t) => t.service === filters.service);
    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.transactionId.toLowerCase().includes(q) ||
          t.accountId.toLowerCase().includes(q) ||
          (t.destId || "").toLowerCase().includes(q) ||
          (t.patterns || []).some((p) => p.toLowerCase().includes(q)),
      );
    }

    setFilteredTransactions(result);
    setCurrentPage(1);
    setLoading(false);
  }, [filters, allTransactions]);

  if (loading) return <PageLoader message="Memuat data transaksi..." />;

  /* ── Pagination ── */
  const indexOfLast = currentPage * itemsPerPage;
  const indexOfFirst = indexOfLast - itemsPerPage;
  const currentPage_ = filteredTransactions.slice(indexOfFirst, indexOfLast);
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);

  /* ── Stats ── */
  const stats = {
    total: allTransactions.length,
    pending: allTransactions.filter((t) => t.status === "pending").length,
    approved: allTransactions.filter((t) => t.status === "approved").length,
    rejected: allTransactions.filter((t) => t.status === "rejected").length,
    agenusa: allTransactions.filter((t) => t.service === "agenusa").length,
    nusabill: allTransactions.filter((t) => t.service === "nusabill").length,
    highRisk: allTransactions.filter((t) => t.riskScore >= 80).length,
    filtered: filteredTransactions.length,
  };

  /* ── Handlers ── */
  const handleFilterChange = (f) => setFilters((prev) => ({ ...prev, ...f }));
  const handleSearchChange = (q) =>
    setFilters((prev) => ({ ...prev, searchQuery: q }));
  const handleResetFilters = () =>
    setFilters({
      dateFrom: "",
      dateTo: "",
      amountMin: "",
      amountMax: "",
      status: "all",
      service: "all",
      searchQuery: "",
    });
  const handlePageChange = (p) => setCurrentPage(p);

  const handleViewDetails = (t) => {
    setSelectedTransaction(t);
    setIsModalOpen(true);
  };
  const handleApprove = (t) =>
    alert(`Transaction ${t.transactionId} approved!`);
  const handleReject = (t) => alert(`Transaction ${t.transactionId} rejected!`);

  return (
    <div className="transactions-page">
      <div className="container-fluid py-4">
        {/* ── Header ── */}
        <div className="page-header mb-4">
          <div className="d-flex justify-content-between align-items-start">
            <div>
              <h1 className="page-title">
                <i className="bi bi-receipt"></i> Transactions
              </h1>
              <p className="page-subtitle">
                Monitor dan analisa semua transaksi
              </p>
            </div>
            <ExportButton data={filteredTransactions} filename="transactions" />
          </div>
        </div>

        {/* ── Stats Cards ── */}
        <div className="row mb-4">
          <div className="col-xl-2 col-md-4 col-6 mb-3">
            <div className="stat-card">
              <div className="stat-icon bg-primary">
                <i className="bi bi-list-ul"></i>
              </div>
              <div className="stat-content">
                <div className="stat-value">{stats.total}</div>
                <div className="stat-label">Total</div>
              </div>
            </div>
          </div>
          <div className="col-xl-2 col-md-4 col-6 mb-3">
            <div className="stat-card">
              <div
                className="stat-icon"
                style={{
                  background: "linear-gradient(135deg,#f59e0b,#d97706)",
                }}
              >
                <i className="bi bi-hourglass-split"></i>
              </div>
              <div className="stat-content">
                <div className="stat-value">{stats.pending}</div>
                <div className="stat-label">Pending</div>
              </div>
            </div>
          </div>
          <div className="col-xl-2 col-md-4 col-6 mb-3">
            <div className="stat-card">
              <div className="stat-icon bg-success">
                <i className="bi bi-check-circle"></i>
              </div>
              <div className="stat-content">
                <div className="stat-value">{stats.approved}</div>
                <div className="stat-label">Approved</div>
              </div>
            </div>
          </div>
          <div className="col-xl-2 col-md-4 col-6 mb-3">
            <div className="stat-card">
              <div className="stat-icon bg-danger">
                <i className="bi bi-x-circle"></i>
              </div>
              <div className="stat-content">
                <div className="stat-value">{stats.rejected}</div>
                <div className="stat-label">Rejected</div>
              </div>
            </div>
          </div>
          <div className="col-xl-2 col-md-4 col-6 mb-3">
            <div className="stat-card">
              <div
                className="stat-icon"
                style={{
                  background: "linear-gradient(135deg,#dc2626,#991b1b)",
                }}
              >
                <i className="bi bi-shield-exclamation"></i>
              </div>
              <div className="stat-content">
                <div className="stat-value">{stats.highRisk}</div>
                <div className="stat-label">High Risk</div>
              </div>
            </div>
          </div>
          <div className="col-xl-2 col-md-4 col-6 mb-3">
            <div className="stat-card">
              <div className="stat-icon bg-info">
                <i className="bi bi-funnel"></i>
              </div>
              <div className="stat-content">
                <div className="stat-value">{stats.filtered}</div>
                <div className="stat-label">Hasil Filter</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Search ── */}
        <SearchBar
          searchQuery={filters.searchQuery}
          onSearchChange={handleSearchChange}
        />

        {/* ── Filter ── */}
        <FilterBar
          filters={filters}
          onFilterChange={handleFilterChange}
          onResetFilters={handleResetFilters}
        />

        {/* ── Table ── */}
        <div className="card table-card">
          <TransactionTable
            transactions={currentPage_}
            onViewDetails={handleViewDetails}
            onApprove={handleApprove}
            onReject={handleReject}
          />

          <div className="card-footer">
            <div className="d-flex justify-content-between align-items-center">
              <div className="pagination-info">
                {filteredTransactions.length === 0
                  ? "Tidak ada transaksi ditemukan"
                  : `Menampilkan ${indexOfFirst + 1} - ${Math.min(indexOfLast, filteredTransactions.length)} dari ${filteredTransactions.length} transaksi`}
              </div>
              <PaginationComponent
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Detail Modal ── */}
      <TransactionDetailModal
        transaction={selectedTransaction}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
};

export default Transactions;
