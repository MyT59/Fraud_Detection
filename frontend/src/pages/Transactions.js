import React, { useState, useEffect, useMemo } from "react";
import TransactionTable from "../components/transactions/TransactionTable";
import PaginationComponent from "../components/transactions/PaginationComponent";
import TransactionDetailModal from "../components/transactions/TransactionDetailModal";
import "./Transactions.css";
import PageLoader from "../components/common/PageLoader";

const BASE_URL = process.env.REACT_APP_ML_API_URL || "http://localhost:8000";
const ITEMS_PER_PAGE = 10;

const Transactions = () => {
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(false);
  const [allTxn, setAllTxn] = useState([]);
  const [apiStats, setApiStats] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [colSort, setColSort] = useState({ key: null, dir: "asc" });
  const [colFilter, setColFilter] = useState({
    service: "all",
    status: "all",
    type: "all",
    dateFrom: "",
    dateTo: "",
  });

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [txnRes, feedbackRes] = await Promise.all([
          fetch(`${BASE_URL}/transactions/all?limit=10000&offset=0`),
          fetch(`${BASE_URL}/review/feedback`).catch(() => null),
        ]);
        if (!txnRes.ok) throw new Error(`HTTP ${txnRes.status}`);
        const json = await txnRes.json();
        let txns = json.transactions || [];

        if (feedbackRes && feedbackRes.ok) {
          const fb = await feedbackRes.json();
          const decisionMap = {};
          (fb.records || []).forEach((r) => {
            if (!decisionMap[r.transaction_id])
              decisionMap[r.transaction_id] = r.decision;
          });
          txns = txns.map((t) =>
            decisionMap[t.transactionId]
              ? {
                  ...t,
                  status: decisionMap[t.transactionId],
                  reviewedViaManual: true,
                }
              : t,
          );
        }
        setAllTxn(txns);
        setApiStats(json.stats || null);
      } catch (err) {
        console.warn(
          "Transactions: backend offline, pakai data generated.",
          err.message,
        );
        setApiError(true);
        setAllTxn(generateFallback());
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const filtered = useMemo(() => {
    let arr = [...allTxn];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      arr = arr.filter(
        (t) =>
          t.transactionId.toLowerCase().includes(q) ||
          t.accountId.toLowerCase().includes(q) ||
          (t.destId || "").toLowerCase().includes(q),
      );
    }

    if (colFilter.service !== "all")
      arr = arr.filter((t) => t.service === colFilter.service);
    if (colFilter.status !== "all")
      arr = arr.filter((t) => t.status === colFilter.status);
    if (colFilter.type !== "all")
      arr = arr.filter((t) => (t.type || t.channel || "") === colFilter.type);
    if (colFilter.dateFrom)
      arr = arr.filter(
        (t) =>
          t.timestamp && new Date(t.timestamp) >= new Date(colFilter.dateFrom),
      );
    if (colFilter.dateTo)
      arr = arr.filter(
        (t) =>
          t.timestamp &&
          new Date(t.timestamp) <= new Date(colFilter.dateTo + "T23:59:59"),
      );

    if (colSort.key) {
      const dir = colSort.dir === "asc" ? 1 : -1;
      arr = [...arr].sort((a, b) => {
        if (colSort.key === "amount") return (a.amount - b.amount) * dir;
        if (colSort.key === "risk") return (a.riskScore - b.riskScore) * dir;
        if (colSort.key === "date") {
          const ta = new Date(a.timestamp || a.time).getTime();
          const tb = new Date(b.timestamp || b.time).getTime();
          return (ta - tb) * dir;
        }
        return 0;
      });
    }

    return arr;
  }, [allTxn, searchQuery, colFilter, colSort]);

  const stats = useMemo(
    () =>
      apiStats ?? {
        total: allTxn.length,
        pending: allTxn.filter((t) => t.status === "pending").length,
        approved: allTxn.filter((t) => t.status === "approved").length,
        rejected: allTxn.filter((t) => t.status === "rejected").length,
        fraud: allTxn.filter((t) => t.isRealFraud).length,
        highRisk: allTxn.filter((t) => t.riskScore >= 65).length,
      },
    [apiStats, allTxn],
  );

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const indexFirst = (currentPage - 1) * ITEMS_PER_PAGE;
  const indexLast = indexFirst + ITEMS_PER_PAGE;
  const currentRows = filtered.slice(indexFirst, indexLast);

  const handleSortChange = (key, dir) => {
    setColSort({ key, dir: key ? dir : "asc" });
    setCurrentPage(1);
  };
  const handleColFilterChange = (updates) => {
    setColFilter((prev) => ({ ...prev, ...updates }));
    setCurrentPage(1);
  };

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (colFilter.service !== "all") n++;
    if (colFilter.status !== "all") n++;
    if (colFilter.type !== "all") n++;
    if (colFilter.dateFrom) n++;
    if (colFilter.dateTo) n++;
    if (colSort.key) n++;
    return n;
  }, [colFilter, colSort]);

  const handleResetAll = () => {
    setColFilter({
      service: "all",
      status: "all",
      type: "all",
      dateFrom: "",
      dateTo: "",
    });
    setColSort({ key: null, dir: "asc" });
    setSearchQuery("");
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
    if (searchQuery.trim())
      chips.push({
        id: "search",
        icon: "bi-search",
        label: `"${searchQuery.trim()}"`,
        onRemove: () => {
          setSearchQuery("");
          setCurrentPage(1);
        },
      });
    if (colFilter.service !== "all")
      chips.push({
        id: "service",
        icon: "bi-grid-1x2",
        label: colFilter.service === "agenusa" ? "AGENUSA" : "NUSABILL",
        onRemove: () => {
          handleColFilterChange({ service: "all" });
        },
      });
    if (colFilter.status !== "all")
      chips.push({
        id: "status",
        icon: "bi-flag",
        label:
          colFilter.status.charAt(0).toUpperCase() + colFilter.status.slice(1),
        onRemove: () => {
          handleColFilterChange({ status: "all" });
        },
      });
    if (colFilter.type !== "all")
      chips.push({
        id: "type",
        icon: "bi-tag",
        label: colFilter.type,
        onRemove: () => {
          handleColFilterChange({ type: "all" });
        },
      });
    if (colFilter.dateFrom)
      chips.push({
        id: "dateFrom",
        icon: "bi-calendar-event",
        label: `Dari ${fmtDateChip(colFilter.dateFrom)}`,
        onRemove: () => {
          handleColFilterChange({ dateFrom: "" });
        },
      });
    if (colFilter.dateTo)
      chips.push({
        id: "dateTo",
        icon: "bi-calendar-check",
        label: `S/d ${fmtDateChip(colFilter.dateTo)}`,
        onRemove: () => {
          handleColFilterChange({ dateTo: "" });
        },
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
  }, [searchQuery, colFilter, colSort]);

  const handleViewDetails = (t) => {
    setSelectedTxn(t);
    setIsModalOpen(true);
  };

  if (loading) return <PageLoader message="Memuat data transaksi..." />;

  const STAT_ITEMS = [
    { key: "total", label: "Total", icon: "bi-list-ul", color: "#3b82f6" },
    {
      key: "pending",
      label: "Pending",
      icon: "bi-hourglass-split",
      color: "#f59e0b",
    },
    {
      key: "approved",
      label: "Approved",
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
      val: filtered.length,
    },
  ];

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
                  {allTxn.length.toLocaleString()} transaksi
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
                placeholder="Cari ID, Account, atau Dest…"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
              />
              {searchQuery && (
                <button
                  className="txn-search-clear"
                  onClick={() => setSearchQuery("")}
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

          <TransactionTable
            transactions={currentRows}
            onViewDetails={handleViewDetails}
            colSort={colSort}
            colFilter={colFilter}
            onSortChange={handleSortChange}
            onColFilterChange={handleColFilterChange}
            onApprove={(t) => alert(`Transaction ${t.transactionId} approved!`)}
            onReject={(t) => alert(`Transaction ${t.transactionId} rejected!`)}
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

      <TransactionDetailModal
        transaction={selectedTxn}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
};

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
      id: `AGN-${String(i).padStart(6, "0")}`,
      service: "agenusa",
      transactionId: `AGN-${String(i).padStart(6, "0")}`,
      accountId: `ACCT1${String(10000 + ((i * 37) % 900)).slice(1)}`,
      destId: `DST3${String(10000 + ((i * 53) % 900)).slice(1)}`,
      type: "Transfer",
      channel: null,
      refundFlag: false,
      amount: Math.floor(50000 + r * 950000),
      paymentAmount: null,
      timestamp: new Date(
        Date.now() - Math.floor(r3 * 60) * 86400000,
      ).toISOString(),
      time: new Date(Date.now() - Math.floor(r3 * 60) * 86400000).toISOString(),
      patterns: [],
      riskScore: risk,
      status: risk >= 65 ? "pending" : r2 > 0.4 ? "approved" : "pending",
      isRealFraud: risk >= 65,
    });
  }
  for (let i = 1; i <= 40; i++) {
    const r = seededRand(i * 11),
      r2 = seededRand(i * 19),
      r3 = seededRand(i * 29);
    const risk = Math.min(99, Math.max(5, Math.floor(r * 95)));
    const billAmt = Math.floor(50000 + r * 700000);
    rows.push({
      id: `NUS-${String(i).padStart(6, "0")}`,
      service: "nusabill",
      transactionId: `NUS-${String(i).padStart(6, "0")}`,
      accountId: `CUST1${String(10000 + ((i * 61) % 900)).slice(1)}`,
      destId: `BILL${String(100000 + ((i * 97) % 900000))}`,
      type: null,
      channel: ["API", "Web", "Mobile"][Math.floor(r2 * 3)],
      refundFlag: false,
      amount: billAmt,
      paymentAmount: billAmt,
      timestamp: new Date(
        Date.now() - Math.floor(r3 * 60) * 86400000,
      ).toISOString(),
      time: new Date(Date.now() - Math.floor(r3 * 60) * 86400000).toISOString(),
      patterns: [],
      riskScore: risk,
      status: risk >= 65 ? "pending" : r2 > 0.4 ? "approved" : "pending",
      isRealFraud: risk >= 65,
    });
  }
  return rows.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
};

export default Transactions;
