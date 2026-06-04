import React, { useState, useMemo, useRef, useEffect } from "react";
import "./HistoryTable.css";

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
  approved: { icon: "bi-check-circle-fill", label: "Safe", cls: "approved" },
  rejected: { icon: "bi-x-circle-fill", label: "Fraud", cls: "rejected" },
  flagged: { icon: "bi-flag-fill", label: "Flagged", cls: "flagged" },
  escalated: {
    icon: "bi-arrow-up-circle-fill",
    label: "Escalated",
    cls: "escalated",
  },
};

const ServiceBadge = ({ service }) => (
  <span
    style={{
      display: "inline-block",
      padding: "2px 7px",
      borderRadius: "4px",
      fontSize: ".65rem",
      fontWeight: 700,
      letterSpacing: ".04em",
      background: service === "agenusa" ? "#eff6ff" : "#fdf4ff",
      color: service === "agenusa" ? "#1d4ed8" : "#7c3aed",
      border: `1px solid ${service === "agenusa" ? "#bfdbfe" : "#e9d5ff"}`,
    }}
  >
    {service === "agenusa" ? "AGENUSA" : "NUSABILL"}
  </span>
);

const ColDropdown = ({ options, activeValue, onSelect, isActive }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="htcol-dd-wrap" ref={ref}>
      <button
        className={`htcol-filter-btn${open ? " open" : ""}${isActive ? " has-filter" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        title="Filter / Urutkan"
      >
        <i className={`bi ${isActive ? "bi-funnel-fill" : "bi-funnel"}`}></i>
      </button>

      {open && (
        <div className="htcol-dropdown">
          {options.map((opt) => (
            <button
              key={opt.value}
              className={`htcol-option${activeValue === opt.value ? " active" : ""}`}
              onClick={() => {
                onSelect(opt.value);
                setOpen(false);
              }}
            >
              <i className={`bi ${opt.icon}`}></i>
              {opt.label}
              {activeValue === opt.value && (
                <i className="bi bi-check2 htcol-check"></i>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const SkeletonRow = () => (
  <tr className="htable-row htable-row--skeleton">
    {[...Array(9)].map((_, i) => (
      <td key={i}>
        <div className="hcell-skeleton" />
      </td>
    ))}
  </tr>
);

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
    <div className="htable-pagination">
      <span className="hpagination-info">
        Showing{" "}
        <strong>
          {start}–{end}
        </strong>{" "}
        of <strong>{totalItems}</strong> entries
      </span>
      <div className="hpagination-controls">
        <button
          className="hpage-btn nav"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <i className="bi bi-chevron-left"></i>
        </button>
        {getPages().map((p, i) =>
          p === "..." ? (
            <span key={`dot${i}`} className="hpage-ellipsis">
              …
            </span>
          ) : (
            <button
              key={p}
              className={`hpage-btn${p === currentPage ? " active" : ""}`}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          ),
        )}
        <button
          className="hpage-btn nav"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === eff || totalItems === 0}
        >
          <i className="bi bi-chevron-right"></i>
        </button>
      </div>
    </div>
  );
};

const TIMESTAMP_OPTS = [
  { value: "timestamp-desc", label: "Terbaru", icon: "bi-sort-down" },
  { value: "timestamp-asc", label: "Terlama", icon: "bi-sort-up" },
];
const LAYANAN_OPTS = [
  { value: "all", label: "Semua Layanan", icon: "bi-grid" },
  { value: "agenusa", label: "Agenusa", icon: "bi-building" },
  { value: "nusabill", label: "Nusabill", icon: "bi-receipt" },
];
const AMOUNT_OPTS = [
  {
    value: "amount-desc",
    label: "Terbanyak",
    icon: "bi-sort-numeric-down-alt",
  },
  { value: "amount-asc", label: "Terkecil", icon: "bi-sort-numeric-up" },
];
const RISK_OPTS = [
  {
    value: "riskScore-desc",
    label: "Tertinggi",
    icon: "bi-sort-numeric-down-alt",
  },
  { value: "riskScore-asc", label: "Terendah", icon: "bi-sort-numeric-up" },
];

const DEFAULT_COL = "timestamp";
const DEFAULT_DIR = "desc";

const PILL_META = {
  "layanan:agenusa": {
    label: "Agenusa",
    group: "Layanan",
    icon: "bi-building",
    bg: "#eff6ff",
    color: "#1d4ed8",
    border: "#bfdbfe",
  },
  "layanan:nusabill": {
    label: "Nusabill",
    group: "Layanan",
    icon: "bi-receipt",
    bg: "#fdf4ff",
    color: "#7c3aed",
    border: "#e9d5ff",
  },
  "sort:timestamp-desc": {
    label: "Terbaru",
    group: "Waktu",
    icon: "bi-sort-down",
    bg: "#f0fdf4",
    color: "#15803d",
    border: "#bbf7d0",
  },
  "sort:timestamp-asc": {
    label: "Terlama",
    group: "Waktu",
    icon: "bi-sort-up",
    bg: "#f0fdf4",
    color: "#15803d",
    border: "#bbf7d0",
  },
  "sort:amount-desc": {
    label: "Amount Terbanyak",
    group: "Amount",
    icon: "bi-sort-numeric-down-alt",
    bg: "#fff7ed",
    color: "#c2410c",
    border: "#fed7aa",
  },
  "sort:amount-asc": {
    label: "Amount Terkecil",
    group: "Amount",
    icon: "bi-sort-numeric-up",
    bg: "#fff7ed",
    color: "#c2410c",
    border: "#fed7aa",
  },
  "sort:riskScore-desc": {
    label: "Risk Tertinggi",
    group: "Risk",
    icon: "bi-sort-numeric-down-alt",
    bg: "#fef2f2",
    color: "#b91c1c",
    border: "#fecaca",
  },
  "sort:riskScore-asc": {
    label: "Risk Terendah",
    group: "Risk",
    icon: "bi-sort-numeric-up",
    bg: "#fef2f2",
    color: "#b91c1c",
    border: "#fecaca",
  },
};

const HistoryTable = ({
  data = [],
  loading = false,
  totalItems = 0,
  page = 1,
  totalPages = 1,
  perPage = 10,
  onPageChange,
  onViewDetail,
  onRefresh,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterLayanan, setFilterLayanan] = useState("all");
  const [sortList, setSortList] = useState([]);

  useEffect(() => {}, [data]);

  const handleSort = (sortVal) => {
    const lastDash = sortVal.lastIndexOf("-");
    const col = sortVal.slice(0, lastDash);
    const dir = sortVal.slice(lastDash + 1);
    const isDefault = col === DEFAULT_COL && dir === DEFAULT_DIR;

    setSortList((prev) => {
      const filtered = prev.filter((s) => s.col !== col);
      if (isDefault) return filtered;
      return [...filtered, { col, dir }];
    });
  };

  const handleLayanan = (val) => setFilterLayanan(val);

  const getSortActiveVal = (col) => {
    const entry = sortList.find((s) => s.col === col);
    if (entry) return `${entry.col}-${entry.dir}`;
    if (col === DEFAULT_COL) return `${DEFAULT_COL}-${DEFAULT_DIR}`;
    return null;
  };

  const isSortActive = (col) => sortList.some((s) => s.col === col);

  const activePills = useMemo(() => {
    const pills = [];
    if (filterLayanan !== "all")
      pills.push({
        key: `layanan:${filterLayanan}`,
        type: "layanan",
        col: null,
      });
    sortList.forEach(({ col, dir }) =>
      pills.push({ key: `sort:${col}-${dir}`, type: "sort", col }),
    );
    return pills;
  }, [filterLayanan, sortList]);

  const hasActiveFilters = activePills.length > 0;

  const handleRemovePill = (pill) => {
    if (pill.type === "layanan") setFilterLayanan("all");
    else if (pill.type === "sort")
      setSortList((prev) => prev.filter((s) => s.col !== pill.col));
  };

  const handleResetAll = () => {
    setFilterLayanan("all");
    setSortList([]);
    setSearchTerm("");
  };

  const processed = useMemo(() => {
    let arr = [...data];

    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      arr = arr.filter(
        (d) =>
          d.transactionId.toLowerCase().includes(q) ||
          (d.accountId && d.accountId.toLowerCase().includes(q)) ||
          (d.reviewer && d.reviewer.toLowerCase().includes(q)),
      );
    }

    if (filterLayanan !== "all")
      arr = arr.filter((d) => d.service === filterLayanan);

    const sortCols = [...sortList].reverse();
    const hasTimestamp = sortList.some((s) => s.col === DEFAULT_COL);
    if (!hasTimestamp) sortCols.push({ col: DEFAULT_COL, dir: DEFAULT_DIR });

    arr.sort((a, b) => {
      for (const { col, dir } of sortCols) {
        let av = a[col],
          bv = b[col];
        if (col === "timestamp") {
          av = new Date(av);
          bv = new Date(bv);
        }
        if (av < bv) return dir === "asc" ? -1 : 1;
        if (av > bv) return dir === "asc" ? 1 : -1;
      }
      return 0;
    });

    return arr;
  }, [data, searchTerm, filterLayanan, sortList]);

  return (
    <div className="htable-section">
      <div className="htable-header">
        <span className="htable-title">
          <i className="bi bi-clock-history"></i>
          Review Audit Log
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: ".75rem" }}>
          <span className="htable-meta">{totalItems} Total entries</span>
          {onRefresh && (
            <button
              className="htable-refresh-btn"
              onClick={onRefresh}
              title="Refresh data"
              disabled={loading}
            >
              <i
                className={`bi bi-arrow-clockwise${loading ? " spin" : ""}`}
              ></i>
            </button>
          )}
        </div>
      </div>

      <div className="htable-searchbar">
        <div className="htable-search-wrap">
          <i className="bi bi-search htable-search-icon"></i>
          <input
            type="text"
            className="htable-search-input"
            placeholder="Cari txn ID, account, reviewer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              className="htable-search-clear"
              onClick={() => setSearchTerm("")}
            >
              <i className="bi bi-x"></i>
            </button>
          )}
        </div>
        <span className="htable-search-count">
          <i className="bi bi-funnel"></i>
          {processed.length} entries shown
        </span>
      </div>

      <div
        className={`htable-active-filters${!hasActiveFilters ? " htable-active-filters--empty" : ""}`}
      >
        <span className="htaf-label">
          <i className="bi bi-funnel-fill"></i>
          Filter Aktif:
        </span>

        <div className="htaf-pills">
          {!hasActiveFilters ? (
            <span className="htaf-empty">
              <i className="bi bi-dash-circle"></i>
              Belum ada filter dipilih
            </span>
          ) : (
            activePills.map((pill) => {
              const meta = PILL_META[pill.key];
              if (!meta) return null;
              return (
                <span
                  key={pill.key}
                  className="htaf-pill"
                  style={{
                    background: meta.bg,
                    color: meta.color,
                    borderColor: meta.border,
                  }}
                >
                  <i className={`bi ${meta.icon}`}></i>
                  <span className="htaf-pill-group">{meta.group}:</span>
                  <span className="htaf-pill-label">{meta.label}</span>
                  <button
                    className="htaf-pill-remove"
                    onClick={() => handleRemovePill(pill)}
                    title={`Hapus filter ${meta.label}`}
                    style={{ color: meta.color }}
                  >
                    <i className="bi bi-x"></i>
                  </button>
                </span>
              );
            })
          )}
        </div>

        <button
          className={`htaf-reset-btn${!hasActiveFilters ? " htaf-reset-btn--disabled" : ""}`}
          onClick={hasActiveFilters ? handleResetAll : undefined}
          disabled={!hasActiveFilters}
        >
          <i className="bi bi-arrow-counterclockwise"></i>
          Reset Semua
        </button>
      </div>

      <div className="htable-wrapper">
        {!loading && processed.length === 0 ? (
          <div className="htable-empty">
            <i className="bi bi-inbox"></i>
            <p>No review history found</p>
            <span>Try adjusting your filters or check back later.</span>
          </div>
        ) : (
          <table className="htable">
            <thead>
              <tr>
                <th>
                  <div className="htable-th-inner">
                    <span>Timestamp</span>
                    <ColDropdown
                      options={TIMESTAMP_OPTS}
                      activeValue={getSortActiveVal("timestamp")}
                      onSelect={handleSort}
                      isActive={isSortActive("timestamp")}
                    />
                  </div>
                </th>
                <th>
                  <div className="htable-th-inner">
                    <span>Layanan</span>
                    <ColDropdown
                      options={LAYANAN_OPTS}
                      activeValue={filterLayanan}
                      onSelect={handleLayanan}
                      isActive={filterLayanan !== "all"}
                    />
                  </div>
                </th>
                <th>
                  <div className="htable-th-inner">
                    <span>Transaction ID</span>
                  </div>
                </th>
                <th className="hide-md">
                  <div className="htable-th-inner">
                    <span>Account / Customer</span>
                  </div>
                </th>
                <th>
                  <div className="htable-th-inner">
                    <span>Amount</span>
                    <ColDropdown
                      options={AMOUNT_OPTS}
                      activeValue={getSortActiveVal("amount")}
                      onSelect={handleSort}
                      isActive={isSortActive("amount")}
                    />
                  </div>
                </th>
                <th className="hide-md">
                  <div className="htable-th-inner">
                    <span>Risk</span>
                    <ColDropdown
                      options={RISK_OPTS}
                      activeValue={getSortActiveVal("riskScore")}
                      onSelect={handleSort}
                      isActive={isSortActive("riskScore")}
                    />
                  </div>
                </th>
                <th className="hide-md">
                  <div className="htable-th-inner">
                    <span>Reviewer</span>
                  </div>
                </th>
                <th>
                  <div className="htable-th-inner">
                    <span>Notes</span>
                  </div>
                </th>
                <th>
                  <div className="htable-th-inner">
                    <span>Decision</span>
                  </div>
                </th>
              </tr>
            </thead>

            <tbody>
              {loading
                ? [...Array(perPage)].map((_, i) => <SkeletonRow key={i} />)
                : processed.map((item) => {
                    const meta =
                      ACTION_META[item.action] ?? ACTION_META.approved;
                    const initials = (item.reviewer || "?")
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase();

                    return (
                      <tr
                        key={item.id}
                        className="htable-row"
                        onClick={() => onViewDetail(item)}
                      >
                        <td>
                          <div className="hcell-ts">
                            {fmtTs(item.timestamp)}
                          </div>
                          <div className="hcell-ts-ago">
                            {timeAgo(item.timestamp)}
                          </div>
                        </td>
                        <td>
                          {item.service ? (
                            <ServiceBadge service={item.service} />
                          ) : (
                            <span
                              style={{ color: "#94a3b8", fontSize: ".8rem" }}
                            >
                              —
                            </span>
                          )}
                        </td>
                        <td>
                          <span className="hcell-txnid">
                            {item.transactionId}
                          </span>
                        </td>
                        <td className="hide-md">
                          <span
                            style={{
                              fontFamily: "IBM Plex Mono, monospace",
                              fontSize: ".75rem",
                              color: "#334155",
                              fontWeight: 600,
                            }}
                          >
                            {item.accountId || "—"}
                          </span>
                        </td>
                        <td>
                          <span className="hcell-amount">
                            {item.amount ? fmt(item.amount) : "—"}
                          </span>
                        </td>
                        <td className="hide-md">
                          {item.riskScore > 0 ? (
                            <span
                              className="hcell-risk"
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
                              <span className="hcell-risk-max">/100</span>
                            </span>
                          ) : (
                            <span
                              style={{ color: "#94a3b8", fontSize: ".8rem" }}
                            >
                              —
                            </span>
                          )}
                        </td>
                        <td className="hide-md">
                          <div className="hreviewer-row">
                            <div className="hreviewer-avatar">{initials}</div>
                            <div>
                              <div className="hreviewer-name">
                                {item.reviewer}
                              </div>
                              <div className="hreviewer-role">
                                {item.reviewerRole}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          {item.notes ? (
                            <button
                              className="hbtn-view"
                              onClick={() => onViewDetail(item)}
                            >
                              <i className="bi bi-chat-left-text"></i>View Notes
                            </button>
                          ) : (
                            <span className="hcell-empty">—</span>
                          )}
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
        totalItems={totalItems}
        perPage={perPage}
        onPageChange={onPageChange}
      />
    </div>
  );
};

export default HistoryTable;
