import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import TransactionTable from "../components/transactions/TransactionTable";
import PaginationComponent from "../components/transactions/PaginationComponent";
import TransactionDetailModal from "../components/transactions/TransactionDetailModal";
import "./Transactions.css";
import PageLoader from "../components/common/PageLoader";
import transactionService from "../services/transactionService";

const ITEMS_PER_PAGE = 10;
const SEARCH_DEBOUNCE_MS = 400;

const STATUS_LABEL = {
  PENDING: "Pending",
  UNDER_REVIEW: "Under Review",
  SAFE: "Safe",
  FRAUD: "Fraud",
};

// Sort key FE → field name BE
const SORT_BY_MAP = {
  amount: "amount",
  risk: "risk_score",
  date: "transaction_time",
};

const Transactions = () => {
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [apiError, setApiError] = useState(false);

  const [rows, setRows] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [stats, setStats] = useState({
    total: 0,
    fraud: 0,
    safe: 0,
    under_review: 0,
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [colSort, setColSort] = useState({ key: null, dir: "asc" });
  const [colFilter, setColFilter] = useState({
    service: "all",
    status: "all",
    dateFrom: "",
    dateTo: "",
  });

  // Debounce search input
  const debounceTimer = useRef(null);
  const handleSearchChange = (val) => {
    setSearchQuery(val);
    setCurrentPage(1);
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(val);
    }, SEARCH_DEBOUNCE_MS);
  };

  // Build query params dari state
  const buildParams = useCallback(() => {
    const params = {
      page: currentPage,
      size: ITEMS_PER_PAGE,
      sort_by: SORT_BY_MAP[colSort.key] || "transaction_time",
      sort_order: colSort.key ? colSort.dir : "desc",
    };

    if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
    if (colFilter.service !== "all") params.service_source = colFilter.service;
    if (colFilter.status !== "all") params.final_status = colFilter.status;
    if (colFilter.dateFrom)
      params.start_date = colFilter.dateFrom + "T00:00:00";
    if (colFilter.dateTo) params.end_date = colFilter.dateTo + "T23:59:59";

    return params;
  }, [currentPage, colSort, debouncedSearch, colFilter]);

  // Fetch dari BE
  const fetchTransactions = useCallback(
    async (isInitial = false) => {
      if (isInitial) setLoading(true);
      else setTableLoading(true);

      try {
        const response =
          await transactionService.getTransactions(buildParams());

        setRows(response.data || []);
        setTotalRecords(response.total_records || 0);
        setTotalPages(response.total_pages || 0);
        setStats({
          total: response.summary?.total_transactions || 0,
          fraud: response.summary?.fraud || 0,
          safe: response.summary?.safe || 0,
          under_review: response.summary?.under_review || 0,
        });
        setApiError(false);
      } catch (err) {
        console.error("Transactions: fetch gagal.", err.message);
        if (isInitial) {
          setApiError(true);
          const fallback = generateFallback();
          setRows(fallback.slice(0, ITEMS_PER_PAGE));
          setTotalRecords(fallback.length);
          setTotalPages(Math.ceil(fallback.length / ITEMS_PER_PAGE));
          setStats({
            total: fallback.length,
            fraud: fallback.filter((t) => t.final_status === "FRAUD").length,
            safe: fallback.filter((t) => t.final_status === "SAFE").length,
            under_review: fallback.filter(
              (t) => t.final_status === "UNDER_REVIEW",
            ).length,
          });
        }
      } finally {
        setLoading(false);
        setTableLoading(false);
      }
    },
    [buildParams],
  );

  // Initial load
  useEffect(() => {
    fetchTransactions(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch saat filter / sort / page / search berubah (bukan initial)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    fetchTransactions(false);
  }, [fetchTransactions]);

  const handleSortChange = (key, dir) => {
    setColSort({ key, dir: key ? dir : "asc" });
    setCurrentPage(1);
  };

  const handleColFilterChange = (updates) => {
    setColFilter((prev) => ({ ...prev, ...updates }));
    setCurrentPage(1);
  };

  const handleResetAll = () => {
    setColFilter({ service: "all", status: "all", dateFrom: "", dateTo: "" });
    setColSort({ key: null, dir: "asc" });
    setSearchQuery("");
    setDebouncedSearch("");
    setCurrentPage(1);
  };

  const fmtDateChip = (ds) => {
    if (!ds) return "";
    const [y, m, d] = ds.split("-");
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "Mei",
      "Jun",
      "Jul",
      "Agu",
      "Sep",
      "Okt",
      "Nov",
      "Des",
    ];
    return `${d} ${months[parseInt(m, 10) - 1]} ${y}`;
  };

  const activeChips = useMemo(() => {
    const chips = [];
    if (debouncedSearch.trim())
      chips.push({
        id: "search",
        icon: "bi-search",
        label: `"${debouncedSearch.trim()}"`,
        onRemove: () => {
          setSearchQuery("");
          setDebouncedSearch("");
          setCurrentPage(1);
        },
      });
    if (colFilter.service !== "all")
      chips.push({
        id: "service",
        icon: "bi-grid-1x2",
        label: colFilter.service,
        onRemove: () => handleColFilterChange({ service: "all" }),
      });
    if (colFilter.status !== "all")
      chips.push({
        id: "status",
        icon: "bi-flag",
        label: STATUS_LABEL[colFilter.status] || colFilter.status,
        onRemove: () => handleColFilterChange({ status: "all" }),
      });
    if (colFilter.dateFrom)
      chips.push({
        id: "dateFrom",
        icon: "bi-calendar-event",
        label: `Dari ${fmtDateChip(colFilter.dateFrom)}`,
        onRemove: () => handleColFilterChange({ dateFrom: "" }),
      });
    if (colFilter.dateTo)
      chips.push({
        id: "dateTo",
        icon: "bi-calendar-check",
        label: `S/d ${fmtDateChip(colFilter.dateTo)}`,
        onRemove: () => handleColFilterChange({ dateTo: "" }),
      });
    if (colSort.key) {
      const sortLabel =
        {
          amount:
            colSort.dir === "asc" ? "Amount: Terkecil" : "Amount: Terbanyak",
          risk: colSort.dir === "asc" ? "Risk: Terendah" : "Risk: Tertinggi",
          date: colSort.dir === "asc" ? "Tanggal: Terlama" : "Tanggal: Terbaru",
        }[colSort.key] || colSort.key;
      chips.push({
        id: "sort",
        icon: colSort.dir === "asc" ? "bi-sort-up-alt" : "bi-sort-down-alt",
        label: sortLabel,
        onRemove: () => {
          setColSort({ key: null, dir: "asc" });
          setCurrentPage(1);
        },
      });
    }
    return chips;
  }, [debouncedSearch, colFilter, colSort]);

  const handleViewDetails = (t) => {
    setSelectedTxn(t);
    setIsModalOpen(true);
  };

  const indexFirst = (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const indexLast = Math.min(currentPage * ITEMS_PER_PAGE, totalRecords);

  const STAT_ITEMS = [
    { key: "total", label: "Total", icon: "bi-list-ul", color: "#3b82f6" },
    {
      key: "under_review",
      label: "Under Review",
      icon: "bi-hourglass-split",
      color: "#f59e0b",
    },
    {
      key: "safe",
      label: "Safe",
      icon: "bi-check-circle-fill",
      color: "#10b981",
    },
    {
      key: "fraud",
      label: "Fraud",
      icon: "bi-shield-exclamation",
      color: "#dc2626",
    },
    {
      key: "filtered",
      label: "Hasil Filter",
      icon: "bi-funnel-fill",
      color: "#06b6d4",
      val: totalRecords,
    },
  ];

  if (loading) return <PageLoader message="Memuat data transaksi..." />;

  return (
    <div className="transactions-page">
      <div className="container-fluid py-4">
        <div className="page-header mb-3">
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div>
              <h1 className="page-title">
                <i className="bi bi-receipt"></i> Transactions
              </h1>
              <p className="page-subtitle">
                Monitor dan analisa semua transaksi
              </p>
            </div>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              {apiError ? (
                <span className="txn-status-pill txn-pill-warn">
                  <i className="bi bi-exclamation-triangle-fill"></i>Static data
                </span>
              ) : (
                <span className="txn-status-pill txn-pill-ok">
                  <i
                    className="bi bi-circle-fill"
                    style={{ fontSize: ".45rem" }}
                  ></i>
                  {stats.total.toLocaleString()} transaksi
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="txn-stats-bar mb-4">
          {STAT_ITEMS.map((s) => (
            <div className="txn-stat-item" key={s.key}>
              <i className={`bi ${s.icon}`} style={{ color: s.color }}></i>
              <span className="txn-stat-value">
                {(s.val ?? stats[s.key] ?? 0).toLocaleString()}
              </span>
              <span className="txn-stat-label">{s.label}</span>
            </div>
          ))}
        </div>

        <div className="card table-card">
          <div className="txn-table-toolbar">
            <div className="txn-search-wrap">
              <i className="bi bi-search txn-search-icon"></i>
              <input
                type="text"
                className="txn-search-input"
                placeholder="Cari Transaction ID atau User Account…"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
              {searchQuery && (
                <button
                  className="txn-search-clear"
                  onClick={() => {
                    setSearchQuery("");
                    setDebouncedSearch("");
                    setCurrentPage(1);
                  }}
                >
                  <i className="bi bi-x-circle"></i>
                </button>
              )}
            </div>

            {activeChips.length > 0 && (
              <button className="txn-reset-btn" onClick={handleResetAll}>
                <i className="bi bi-arrow-counterclockwise"></i>
                Reset Semua
                <span className="txn-reset-badge">{activeChips.length}</span>
              </button>
            )}
          </div>

          {activeChips.length > 0 && (
            <div className="txn-filter-chips">
              <span className="txn-chips-label">
                <i className="bi bi-funnel-fill"></i> Filter aktif:
              </span>
              {activeChips.map((chip) => (
                <span className="txn-chip" key={chip.id}>
                  <i className={`bi ${chip.icon} txn-chip-icon`}></i>
                  <span className="txn-chip-label">{chip.label}</span>
                  <button
                    className="txn-chip-remove"
                    onClick={chip.onRemove}
                    title={`Hapus filter ${chip.id}`}
                  >
                    <i className="bi bi-x"></i>
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Overlay loading saat ganti page/filter — tanpa replace seluruh tabel */}
          <div style={{ position: "relative" }}>
            {tableLoading && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(255,255,255,0.6)",
                  zIndex: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "8px",
                }}
              >
                <div className="spinner-border text-danger" role="status">
                  <span className="visually-hidden">Memuat...</span>
                </div>
              </div>
            )}
            <TransactionTable
              transactions={rows}
              onViewDetails={handleViewDetails}
              colSort={colSort}
              colFilter={colFilter}
              onSortChange={handleSortChange}
              onColFilterChange={handleColFilterChange}
            />
          </div>

          <div className="card-footer">
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
              <div className="pagination-info">
                {totalRecords === 0
                  ? "Tidak ada transaksi ditemukan"
                  : `Menampilkan ${indexFirst}–${indexLast} dari ${totalRecords.toLocaleString()} transaksi`}
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

      <TransactionDetailModal
        transaction={selectedTxn}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
};

// --- Fallback Seeded Random Generator ---
const seededRand = (s) => {
  const x = Math.sin(s + 1) * 10000;
  return x - Math.floor(x);
};

const generateFallback = () => {
  const rows = [];
  for (let i = 1; i <= 60; i++) {
    const r = seededRand(i * 7),
      r2 = seededRand(i * 13),
      r3 = seededRand(i * 17);
    const risk = Math.min(99, Math.max(5, Math.floor(r * 95)));
    rows.push({
      id: i,
      original_trx_id: `AGN-${String(i).padStart(6, "0")}`,
      service_source: "AGENUSA",
      user_account_id: `ACCT1${String(10000 + ((i * 37) % 900)).slice(1)}`,
      amount: Math.floor(50000 + r * 950000),
      risk_score: risk,
      risk_level:
        risk >= 80
          ? "CRITICAL"
          : risk >= 60
            ? "HIGH"
            : risk >= 40
              ? "MEDIUM"
              : "LOW",
      final_status: risk >= 65 ? "FRAUD" : r2 > 0.6 ? "SAFE" : "UNDER_REVIEW",
      transaction_time: new Date(
        Date.now() - Math.floor(r3 * 60) * 86400000,
      ).toISOString(),
      city: ["Jakarta", "Surabaya", "Bandung", "Medan"][Math.floor(r2 * 4)],
      country: "Indonesia",
    });
  }
  for (let i = 1; i <= 40; i++) {
    const r = seededRand(i * 11),
      r2 = seededRand(i * 19),
      r3 = seededRand(i * 29);
    const risk = Math.min(99, Math.max(5, Math.floor(r * 95)));
    rows.push({
      id: i + 60,
      original_trx_id: `NUS-${String(i).padStart(6, "0")}`,
      service_source: "NUSABILL",
      user_account_id: `CUST1${String(10000 + ((i * 61) % 900)).slice(1)}`,
      amount: Math.floor(50000 + r * 700000),
      risk_score: risk,
      risk_level:
        risk >= 80
          ? "CRITICAL"
          : risk >= 60
            ? "HIGH"
            : risk >= 40
              ? "MEDIUM"
              : "LOW",
      final_status: risk >= 65 ? "FRAUD" : r2 > 0.6 ? "SAFE" : "PENDING",
      transaction_time: new Date(
        Date.now() - Math.floor(r3 * 60) * 86400000,
      ).toISOString(),
      city: ["Bali", "Yogyakarta", "Makassar", "Semarang"][Math.floor(r2 * 4)],
      country: "Indonesia",
    });
  }
  return rows.sort(
    (a, b) => new Date(b.transaction_time) - new Date(a.transaction_time),
  );
};

export default Transactions;
