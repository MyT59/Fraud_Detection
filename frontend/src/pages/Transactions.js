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
  PENDING: "Flagged",
  FLAGGED: "Flagged",
  UNDER_REVIEW: "Flagged",
  SAFE: "Safe",
  FRAUD: "Blocked",
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
  const [apiErrorMessage, setApiErrorMessage] = useState("");

  const [rows, setRows] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [stats, setStats] = useState({
    total: 0,
    fraud: 0,
    safe: 0,
    flagged: 0,
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
  const requestRef = useRef(null);
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
      requestRef.current?.abort();
      const controller = new AbortController();
      requestRef.current = controller;
      if (isInitial) setLoading(true);
      else setTableLoading(true);

      try {
        const response =
          await transactionService.getTransactions({
            ...buildParams(),
            requestOptions: { signal: controller.signal },
          });

        setRows(response.data || []);
        setTotalRecords(response.total_records || 0);
        setTotalPages(response.total_pages || 0);
        setStats({
          total: response.summary?.total_transactions || 0,
          fraud: response.summary?.fraud || 0,
          safe: response.summary?.safe || 0,
          flagged:
            response.summary?.flagged ?? response.summary?.under_review ?? 0,
        });
        setApiError(false);
        setApiErrorMessage("");
      } catch (err) {
        if (err.name === "AbortError") return;
        console.error("Transactions: fetch gagal.", err.message);
        setApiError(true);
        setApiErrorMessage(err.message || "Gagal memuat data transaksi.");
        if (isInitial) {
          setRows([]);
          setTotalRecords(0);
          setTotalPages(0);
        }
      } finally {
        if (requestRef.current === controller) {
          setLoading(false);
          setTableLoading(false);
        }
      }
    },
    [buildParams],
  );

  // Initial load
  useEffect(() => {
    fetchTransactions(true);
    return () => requestRef.current?.abort();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => clearTimeout(debounceTimer.current), []);

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
      key: "flagged",
      label: "Flagged",
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
      label: "Blocked",
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
                Monitor status transaksi: berhasil, flagged, dan blocked
              </p>
            </div>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              {apiError ? (
                <span className="txn-status-pill txn-pill-warn">
                  <i className="bi bi-exclamation-triangle-fill"></i>Data belum tersinkron
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
          {apiError && (
            <div className="rh-offline-banner" style={{ margin: "1rem" }}>
              <i className="bi bi-exclamation-triangle-fill" />
              <span>
                <strong>Gagal memuat transaksi.</strong> {apiErrorMessage}
                {rows.length > 0 && " Menampilkan data terakhir yang berhasil dimuat."}
              </span>
              <button className="rh-refresh-btn" onClick={() => fetchTransactions(rows.length === 0)}>
                <i className="bi bi-arrow-clockwise" /> Coba Lagi
              </button>
            </div>
          )}
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
                  ? "Tidak ada transaksi sesuai filter saat ini"
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
        onFalseNegativeReported={() => fetchTransactions(false)}
      />
    </div>
  );
};

export default Transactions;
