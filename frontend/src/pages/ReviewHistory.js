import React, { useState, useMemo, useRef, useEffect } from "react";
import PageLoader from "../components/common/PageLoader";
import "./ReviewHistory.css";

const fmt = (amount) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);

const fmtTs = (ds) => {
  const d = new Date(ds);
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const timeAgo = (ds) => {
  const diff = (Date.now() - new Date(ds).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

const ACTION_META = {
  approved: {
    icon: "bi-check-circle-fill",
    label: "Approved",
    cls: "approved",
  },
  rejected: { icon: "bi-x-circle-fill", label: "Rejected", cls: "rejected" },
};

const SAMPLE = [
  {
    id: 1,
    transactionId: "AGN-000008",
    action: "rejected",
    reviewer: "Admin User",
    reviewerRole: "Senior Analyst",
    timestamp: new Date().toISOString(),
    amount: 895000,
    riskScore: 96,
    duration: "4 min",
    notes:
      "Multiple patterns confirmed: bruteforce PIN + money mule destination. Account blocked.",
  },
  {
    id: 2,
    transactionId: "NUS-000009",
    action: "rejected",
    reviewer: "Jane Smith",
    reviewerRole: "Fraud Analyst",
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    amount: 315845,
    riskScore: 95,
    duration: "5 min",
    notes:
      "Refund abuse + burst payment pattern via API channel. Transaction reversed.",
  },
  {
    id: 3,
    transactionId: "AGN-000003",
    action: "approved",
    reviewer: "John Doe",
    reviewerRole: "Junior Analyst",
    timestamp: new Date(Date.now() - 7200000).toISOString(),
    amount: 234802,
    riskScore: 78,
    duration: "8 min",
    notes:
      "Midnight withdrawal pattern — reviewed and verified, no conclusive fraud confirmed.",
  },
  {
    id: 4,
    transactionId: "AGN-000007",
    action: "approved",
    reviewer: "Sarah W.",
    reviewerRole: "Fraud Analyst",
    timestamp: new Date(Date.now() - 10800000).toISOString(),
    amount: 130227,
    riskScore: 52,
    duration: "2 min",
    notes:
      "Score above threshold but no pattern matched. Verified with account holder.",
  },
  {
    id: 5,
    transactionId: "NUS-000001",
    action: "rejected",
    reviewer: "Admin User",
    reviewerRole: "Senior Analyst",
    timestamp: new Date(Date.now() - 18000000).toISOString(),
    amount: 412500,
    riskScore: 94,
    duration: "6 min",
    notes:
      "Burst payment + sudden API channel switch + refund abuse. Customer account suspended.",
  },
  {
    id: 6,
    transactionId: "NUS-000008",
    action: "approved",
    reviewer: "Rina Sari",
    reviewerRole: "Fraud Analyst",
    timestamp: new Date(Date.now() - 21600000).toISOString(),
    amount: 280575,
    riskScore: 50,
    duration: "2 min",
    notes:
      "Customer confirmed API channel change was intentional — migrating from Web.",
  },
  {
    id: 7,
    transactionId: "AGN-000004",
    action: "rejected",
    reviewer: "John Doe",
    reviewerRole: "Junior Analyst",
    timestamp: new Date(Date.now() - 25200000).toISOString(),
    amount: 226048,
    riskScore: 61,
    duration: "4 min",
    notes:
      "Impossible terminal switch + rapid_retry_declined — fraud pattern confirmed, rejected.",
  },
  {
    id: 8,
    transactionId: "NUS-000002",
    action: "rejected",
    reviewer: "Jane Smith",
    reviewerRole: "Fraud Analyst",
    timestamp: new Date(Date.now() - 28800000).toISOString(),
    amount: 275000,
    riskScore: 87,
    duration: "5 min",
    notes:
      "REFUND_FLAG=1 combined with underpayment and burst pattern. Rejected.",
  },
  {
    id: 9,
    transactionId: "AGN-000006",
    action: "approved",
    reviewer: "Admin User",
    reviewerRole: "Senior Analyst",
    timestamp: new Date(Date.now() - 86400000).toISOString(),
    amount: 184311,
    riskScore: 57,
    duration: "3 min",
    notes: "Midnight flag but single pattern only. Customer OTP verified.",
  },
  {
    id: 10,
    transactionId: "NUS-000003",
    action: "approved",
    reviewer: "Budi S.",
    reviewerRole: "Junior Analyst",
    timestamp: new Date(Date.now() - 90000000).toISOString(),
    amount: 198000,
    riskScore: 76,
    duration: "6 min",
    notes:
      "Payment spike + burst pattern — reviewed and verified, no conclusive fraud evidence.",
  },
  {
    id: 11,
    transactionId: "AGN-000005",
    action: "approved",
    reviewer: "Sarah W.",
    reviewerRole: "Fraud Analyst",
    timestamp: new Date(Date.now() - 172800000).toISOString(),
    amount: 142014,
    riskScore: 60,
    duration: "3 min",
    notes:
      "Terminal switch detected but geo-verified. Approved after confirmation.",
  },
  {
    id: 12,
    transactionId: "NUS-000004",
    action: "rejected",
    reviewer: "Rina Sari",
    reviewerRole: "Fraud Analyst",
    timestamp: new Date(Date.now() - 180000000).toISOString(),
    amount: 357477,
    riskScore: 65,
    duration: "4 min",
    notes:
      "Sudden API channel switch + identity mismatch — rejected after failed verification.",
  },
];

const HIST_PER_PAGE = 10;

const ColumnDropdown = ({ options, value, onChange, onClose, anchorRef }) => {
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => {
      if (
        ref.current &&
        !ref.current.contains(e.target) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose, anchorRef]);
  return (
    <div className="rh-col-dropdown" ref={ref}>
      {options.map((opt) => (
        <button
          key={opt.value}
          className={`rh-col-option ${value === opt.value ? "active" : ""}`}
          onClick={() => {
            onChange(opt.value);
            onClose();
          }}
        >
          <i className={`bi ${opt.icon}`}></i>
          {opt.label}
          {value === opt.value && <i className="bi bi-check2 rh-col-check"></i>}
        </button>
      ))}
    </div>
  );
};

const ColHeader = ({
  label,
  colKey,
  sortKey,
  sortDir,
  onSort,
  filterOptions,
  filterValue,
  onFilterChange,
  className,
}) => {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const isActive = sortKey === colKey;
  const hasFilter = filterOptions && filterValue && filterValue !== "all";
  return (
    <th
      className={`rh-th-sortable ${className || ""} ${isActive ? "rh-th-sorted" : ""}`}
    >
      <div className="rh-th-inner">
        <span className="rh-th-label" onClick={() => onSort(colKey)}>
          {label}
          <span className="rh-sort-icons">
            {isActive ? (
              <i
                className={`bi ${sortDir === "asc" ? "bi-sort-up-alt" : "bi-sort-down-alt"} rh-sort-active`}
              ></i>
            ) : (
              <i className="bi bi-arrow-down-up rh-sort-idle"></i>
            )}
          </span>
        </span>
        {filterOptions && (
          <div className="rh-th-filter-wrap" ref={btnRef}>
            <button
              className={`rh-th-filter-btn ${open ? "open" : ""} ${hasFilter ? "has-filter" : ""}`}
              onClick={() => setOpen((v) => !v)}
              title="Filter column"
            >
              <i
                className={`bi ${hasFilter ? "bi-funnel-fill" : "bi-funnel"}`}
              ></i>
            </button>
            {open && (
              <ColumnDropdown
                options={filterOptions}
                value={filterValue}
                onChange={onFilterChange}
                onClose={() => setOpen(false)}
                anchorRef={btnRef}
              />
            )}
          </div>
        )}
      </div>
    </th>
  );
};

const DatePickerModal = ({ value, onChange, onClose }) => {
  const [from, setFrom] = useState(value?.from || "");
  const [to, setTo] = useState(value?.to || "");
  const apply = () => {
    onChange(from || to ? { from, to } : null);
    onClose();
  };
  const clear = () => {
    onChange(null);
    onClose();
  };
  return (
    <div className="rh-datepicker-overlay" onClick={onClose}>
      <div className="rh-datepicker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rh-datepicker-header">
          <i className="bi bi-calendar3"></i>
          <span>Filter by Date Range</span>
          <button className="rh-datepicker-close" onClick={onClose}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>
        <div className="rh-datepicker-body">
          <label>
            <span>From</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            <span>To</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
        </div>
        <div className="rh-datepicker-footer">
          <button className="rh-datepicker-clear" onClick={clear}>
            Clear
          </button>
          <button className="rh-datepicker-apply" onClick={apply}>
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};

const Pagination = ({
  currentPage,
  totalPages,
  totalItems,
  perPage,
  onPageChange,
}) => {
  const start = totalItems === 0 ? 0 : (currentPage - 1) * perPage + 1;
  const end = Math.min(currentPage * perPage, totalItems);
  const eff = Math.max(1, totalPages);
  const getPages = () => {
    if (eff <= 7) return Array.from({ length: eff }, (_, i) => i + 1);
    const pages = [1];
    if (currentPage > 3) pages.push("...");
    for (
      let i = Math.max(2, currentPage - 1);
      i <= Math.min(eff - 1, currentPage + 1);
      i++
    )
      pages.push(i);
    if (currentPage < eff - 2) pages.push("...");
    pages.push(eff);
    return pages;
  };
  return (
    <div className="pagination-bar">
      <span className="pagination-info">
        Showing{" "}
        <strong>
          {start}–{end}
        </strong>{" "}
        of <strong>{totalItems}</strong> entries
      </span>
      <div className="pagination-controls">
        <button
          className="page-btn page-nav"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <i className="bi bi-chevron-left"></i>
        </button>
        {getPages().map((p, i) =>
          p === "..." ? (
            <span key={`dot${i}`} className="page-ellipsis">
              …
            </span>
          ) : (
            <button
              key={p}
              className={`page-btn${p === currentPage ? " active" : ""}`}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          ),
        )}
        <button
          className="page-btn page-nav"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === eff || totalItems === 0}
        >
          <i className="bi bi-chevron-right"></i>
        </button>
      </div>
    </div>
  );
};

const HistoryModal = ({ item, onClose }) => {
  const meta = ACTION_META[item.action] || ACTION_META.approved;
  const heroBg = { approved: "#dcfce7", rejected: "#fee2e2" };
  const heroColor = { approved: "#16a34a", rejected: "#dc2626" };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="txn-modal audit-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-header-left">
            <span className="modal-txn-id">Audit Entry</span>
            <span className={`rh-pill ${meta.cls}`}>
              <i className={`bi ${meta.icon}`}></i>
              {meta.label}
            </span>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>
        <div
          className="audit-modal-hero"
          style={{
            background: heroBg[item.action],
            borderBottom: `3px solid ${heroColor[item.action]}`,
          }}
        >
          <div
            className="audit-hero-icon"
            style={{ background: heroColor[item.action] }}
          >
            <i className={`bi ${meta.icon}`}></i>
          </div>
          <div>
            <div className="audit-hero-txn">{item.transactionId}</div>
            <div className="audit-hero-meta">
              {fmtTs(item.timestamp)} · {item.duration}
            </div>
          </div>
        </div>
        <div className="modal-body">
          <div className="audit-modal-grid">
            <div className="audit-kv">
              <div className="audit-kv-label">
                <i className="bi bi-cash-stack"></i> Amount
              </div>
              <div className="audit-kv-value mono">{fmt(item.amount)}</div>
            </div>
            <div className="audit-kv">
              <div className="audit-kv-label">
                <i className="bi bi-shield-exclamation"></i> Risk Score
              </div>
              <div
                className="audit-kv-value mono"
                style={{
                  color:
                    item.riskScore >= 80
                      ? "#dc2626"
                      : item.riskScore >= 60
                        ? "#d97706"
                        : "#16a34a",
                }}
              >
                {item.riskScore}
                <span style={{ color: "#94a3b8", fontWeight: 400 }}>/100</span>
              </div>
            </div>
            <div className="audit-kv">
              <div className="audit-kv-label">
                <i className="bi bi-person-badge"></i> Reviewed By
              </div>
              <div className="audit-kv-value">{item.reviewer}</div>
            </div>
            <div className="audit-kv">
              <div className="audit-kv-label">
                <i className="bi bi-briefcase"></i> Role
              </div>
              <div className="audit-kv-value">{item.reviewerRole}</div>
            </div>
            <div className="audit-kv">
              <div className="audit-kv-label">
                <i className="bi bi-stopwatch"></i> Duration
              </div>
              <div className="audit-kv-value">{item.duration}</div>
            </div>
            <div className="audit-kv">
              <div className="audit-kv-label">
                <i className="bi bi-calendar-event"></i> Timestamp
              </div>
              <div
                className="audit-kv-value mono"
                style={{ fontSize: ".75rem" }}
              >
                {fmtTs(item.timestamp)}
              </div>
            </div>
          </div>
          {item.notes && (
            <div className="audit-notes-block">
              <i className="bi bi-chat-left-text-fill"></i>
              <span className="audit-notes-text">{item.notes}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Highlight = ({ text, query }) => {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rh-highlight">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
};

/* ── Main Component ── */
const ReviewHistory = ({ history }) => {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  const [selectedEntry, setSelectedEntry] = useState(null);
  const [histPage, setHistPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState("timestamp");
  const [sortDir, setSortDir] = useState("desc");
  const [actionFilter, setActionFilter] = useState("all");
  const [txnFilter, setTxnFilter] = useState("all");
  const [dateRange, setDateRange] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const rawData = history && history.length > 0 ? history : SAMPLE;

  const handleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
    setHistPage(1);
  };

  const processed = useMemo(() => {
    let arr = [...rawData];
    if (actionFilter !== "all")
      arr = arr.filter((d) => d.action === actionFilter);
    if (txnFilter === "agn")
      arr = arr.filter((d) => d.transactionId.startsWith("AGN"));
    else if (txnFilter === "nus")
      arr = arr.filter((d) => d.transactionId.startsWith("NUS"));
    if (dateRange) {
      if (dateRange.from) {
        const from = new Date(dateRange.from);
        arr = arr.filter((d) => new Date(d.timestamp) >= from);
      }
      if (dateRange.to) {
        const to = new Date(dateRange.to);
        to.setHours(23, 59, 59, 999);
        arr = arr.filter((d) => new Date(d.timestamp) <= to);
      }
    }
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      arr = arr.filter(
        (d) =>
          d.transactionId.toLowerCase().includes(q) ||
          (d.accountId && d.accountId.toLowerCase().includes(q)),
      );
    }
    arr.sort((a, b) => {
      let av = a[sortKey],
        bv = b[sortKey];
      if (sortKey === "timestamp") {
        av = new Date(av);
        bv = new Date(bv);
      }
      if (sortKey === "amount" || sortKey === "riskScore") {
        av = Number(av);
        bv = Number(bv);
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [
    rawData,
    actionFilter,
    txnFilter,
    dateRange,
    searchTerm,
    sortKey,
    sortDir,
  ]);

  const stats = {
    approved: rawData.filter((d) => d.action === "approved").length,
    rejected: rawData.filter((d) => d.action === "rejected").length,
  };

  const totalHistPages = Math.ceil(processed.length / HIST_PER_PAGE);
  const paginatedHist = processed.slice(
    (histPage - 1) * HIST_PER_PAGE,
    histPage * HIST_PER_PAGE,
  );

  const activeFiltersCount = [
    actionFilter !== "all",
    txnFilter !== "all",
    !!dateRange,
    !!searchTerm.trim(),
    sortKey !== "timestamp" || sortDir !== "desc",
  ].filter(Boolean).length;

  const clearAll = () => {
    setActionFilter("all");
    setTxnFilter("all");
    setDateRange(null);
    setSearchTerm("");
    setSortKey("timestamp");
    setSortDir("desc");
    setHistPage(1);
  };

  const ACTION_OPTS = [
    { value: "all", label: "All Actions", icon: "bi-list-ul" },
    { value: "approved", label: "Approved", icon: "bi-check-circle-fill" },
    { value: "rejected", label: "Rejected", icon: "bi-x-circle-fill" },
  ];
  const TXN_OPTS = [
    { value: "all", label: "All Services", icon: "bi-grid" },
    { value: "agn", label: "AGN / AgeNusa", icon: "bi-building" },
    { value: "nus", label: "NUS / NusaBill", icon: "bi-receipt" },
  ];

  if (loading) return <PageLoader message="Memuat Review History..." />;

  return (
    <>
      <div className="rh-page-wrapper">
        <div className="review-section">
          <div className="section-header">
            <span className="section-title">
              <i className="bi bi-clock-history"></i>Review History
            </span>
            <span className="section-meta">{rawData.length} entries</span>
          </div>

          <div className="rh-filterbar">
            <div className="rh-search-wrap">
              <i className="bi bi-search rh-search-icon"></i>
              <input
                className="rh-search-input"
                type="text"
                placeholder="Search Txn ID (e.g. AGN-000008, NUS-000001)…"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setHistPage(1);
                }}
              />
              {searchTerm && (
                <button
                  className="rh-search-clear"
                  onClick={() => {
                    setSearchTerm("");
                    setHistPage(1);
                  }}
                >
                  <i className="bi bi-x"></i>
                </button>
              )}
            </div>
            <button
              className={`rh-filter-pill ${dateRange ? "active" : ""}`}
              onClick={() => setShowDatePicker(true)}
            >
              <i
                className={`bi ${dateRange ? "bi-calendar-check-fill" : "bi-calendar3"}`}
              ></i>
              {dateRange
                ? `${dateRange.from || "…"} → ${dateRange.to || "…"}`
                : "Date Range"}
            </button>
            {activeFiltersCount > 0 && (
              <button className="rh-clear-all" onClick={clearAll}>
                <i className="bi bi-x-circle"></i>Clear all (
                {activeFiltersCount})
              </button>
            )}
            <span className="rh-result-count">
              <i className="bi bi-funnel"></i>
              {processed.length} / {rawData.length}
            </span>
          </div>

          <div className="txn-table-wrapper">
            <table className="audit-table rh-table">
              <thead>
                <tr>
                  <ColHeader
                    label="Timestamp"
                    colKey="timestamp"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={handleSort}
                    filterOptions={[
                      {
                        value: "desc",
                        label: "Terbaru (Newest)",
                        icon: "bi-sort-down-alt",
                      },
                      {
                        value: "asc",
                        label: "Terlama (Oldest)",
                        icon: "bi-sort-up-alt",
                      },
                    ]}
                    filterValue={sortKey === "timestamp" ? sortDir : null}
                    onFilterChange={(dir) => {
                      setSortKey("timestamp");
                      setSortDir(dir);
                      setHistPage(1);
                    }}
                  />
                  <ColHeader
                    label="Action"
                    colKey="action"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={handleSort}
                    filterOptions={ACTION_OPTS}
                    filterValue={actionFilter}
                    onFilterChange={(v) => {
                      setActionFilter(v);
                      setHistPage(1);
                    }}
                  />
                  <ColHeader
                    label="Txn ID"
                    colKey="transactionId"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={handleSort}
                    filterOptions={TXN_OPTS}
                    filterValue={txnFilter}
                    onFilterChange={(v) => {
                      setTxnFilter(v);
                      setHistPage(1);
                    }}
                  />
                  <ColHeader
                    label="Amount"
                    colKey="amount"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={handleSort}
                    filterOptions={[
                      {
                        value: "desc",
                        label: "Terbanyak (Highest)",
                        icon: "bi-sort-numeric-down-alt",
                      },
                      {
                        value: "asc",
                        label: "Terdikit (Lowest)",
                        icon: "bi-sort-numeric-up-alt",
                      },
                    ]}
                    filterValue={sortKey === "amount" ? sortDir : null}
                    onFilterChange={(dir) => {
                      setSortKey("amount");
                      setSortDir(dir);
                      setHistPage(1);
                    }}
                  />
                  <ColHeader
                    label="Risk"
                    colKey="riskScore"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={handleSort}
                    className="hide-sm"
                    filterOptions={[
                      {
                        value: "desc",
                        label: "Paling Tinggi (Highest)",
                        icon: "bi-arrow-up-circle-fill",
                      },
                      {
                        value: "asc",
                        label: "Paling Rendah (Lowest)",
                        icon: "bi-arrow-down-circle-fill",
                      },
                    ]}
                    filterValue={sortKey === "riskScore" ? sortDir : null}
                    onFilterChange={(dir) => {
                      setSortKey("riskScore");
                      setSortDir(dir);
                      setHistPage(1);
                    }}
                  />
                  <th className="hide-sm">Reviewer</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {paginatedHist.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="rh-empty-state">
                      <i className="bi bi-inbox"></i>
                      <p>No entries match your filters</p>
                      <button onClick={clearAll}>Clear all filters</button>
                    </td>
                  </tr>
                ) : (
                  paginatedHist.map((item) => {
                    const meta =
                      ACTION_META[item.action] || ACTION_META.approved;
                    const initials = item.reviewer
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2);
                    const riskColor =
                      item.riskScore >= 80
                        ? "#dc2626"
                        : item.riskScore >= 60
                          ? "#d97706"
                          : "#16a34a";
                    return (
                      <tr
                        key={item.id}
                        className="rh-row"
                        onClick={() => setSelectedEntry(item)}
                      >
                        <td>
                          <div className="rh-ts">{fmtTs(item.timestamp)}</div>
                          <div className="rh-ts-ago">
                            {timeAgo(item.timestamp)}
                          </div>
                        </td>
                        <td>
                          <span className={`rh-pill ${meta.cls}`}>
                            <i className={`bi ${meta.icon}`}></i>
                            {meta.label}
                          </span>
                        </td>
                        <td>
                          <span className="rh-txn-id">
                            <Highlight
                              text={item.transactionId}
                              query={searchTerm}
                            />
                          </span>
                        </td>
                        <td>
                          <span className="rh-amount">{fmt(item.amount)}</span>
                        </td>
                        <td className="hide-sm">
                          <span
                            className="rh-risk"
                            style={{ color: riskColor }}
                          >
                            {item.riskScore}
                            <span className="rh-risk-max">/100</span>
                          </span>
                        </td>
                        <td className="hide-sm">
                          <div className="rh-reviewer">
                            <div className="rh-avatar">{initials}</div>
                            <div className="rh-reviewer-info">
                              <span className="rh-reviewer-name">
                                {item.reviewer}
                              </span>
                              <span className="rh-reviewer-role">
                                {item.reviewerRole}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          {item.notes ? (
                            <button
                              className="btn-audit-detail"
                              onClick={() => setSelectedEntry(item)}
                            >
                              <i className="bi bi-chat-left-text"></i>View Notes
                            </button>
                          ) : (
                            <span className="rh-empty">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
                {paginatedHist.length > 0 &&
                  Array.from({
                    length: HIST_PER_PAGE - paginatedHist.length,
                  }).map((_, i) => (
                    <tr key={`empty-${i}`} className="rh-row-empty">
                      <td colSpan={7}>&nbsp;</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={histPage}
            totalPages={totalHistPages}
            totalItems={processed.length}
            perPage={HIST_PER_PAGE}
            onPageChange={setHistPage}
          />

          <div className="audit-footer">
            <div className="audit-footer-stats">
              <span className="audit-stat green">
                <i className="bi bi-check-circle-fill"></i>
                {stats.approved} Approved
              </span>
              <span className="audit-stat red">
                <i className="bi bi-x-circle-fill"></i>
                {stats.rejected} Rejected
              </span>
            </div>
          </div>
        </div>
      </div>

      {showDatePicker && (
        <DatePickerModal
          value={dateRange}
          onChange={(v) => {
            setDateRange(v);
            setHistPage(1);
          }}
          onClose={() => setShowDatePicker(false)}
        />
      )}
      {selectedEntry && (
        <HistoryModal
          item={selectedEntry}
          onClose={() => setSelectedEntry(null)}
        />
      )}
    </>
  );
};

export default ReviewHistory;
