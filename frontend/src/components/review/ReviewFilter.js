import React, { useState, useEffect, useMemo, useRef } from "react";
import "./ReviewFilter.css";

const TXN_PER_PAGE = 10;

const ColumnDropdown = ({ options, value, onChange, onClose, anchorRef }) => {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => {
      if (
        ref.current &&
        !ref.current.contains(e.target) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target)
      )
        onClose();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose, anchorRef]);

  return (
    <div className="rf-col-dropdown" ref={ref}>
      {options.map((opt) => (
        <button
          key={opt.value}
          className={`rf-col-option ${value === opt.value ? "active" : ""}`}
          onClick={() => {
            onChange(opt.value);
            onClose();
          }}
        >
          <i className={`bi ${opt.icon}`}></i>
          <span>{opt.label}</span>
          {value === opt.value && <i className="bi bi-check2 rf-col-check"></i>}
        </button>
      ))}
    </div>
  );
};

export const ColHeader = ({
  label,
  colKey,
  sortKey,
  sortDir,
  onSort,
  filterOptions,
  filterValue,
  onFilterChange,
  className,
  sortable = true,
}) => {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const isActive = sortable && sortKey === colKey;
  const hasFilter =
    filterOptions && filterValue != null && filterValue !== "all";

  return (
    <th
      className={`rf-th-sortable ${className || ""} ${isActive ? "rf-th-sorted" : ""}`}
    >
      <div className="rf-th-inner">
        <span
          className="rf-th-label"
          onClick={sortable ? () => onSort(colKey) : undefined}
          style={!sortable ? { cursor: "default" } : {}}
        >
          {label}
          {sortable && (
            <span className="rf-sort-icons">
              {isActive ? (
                <i
                  className={`bi ${sortDir === "asc" ? "bi-sort-up-alt" : "bi-sort-down-alt"} rf-sort-active`}
                ></i>
              ) : (
                <i className="bi bi-arrow-down-up rf-sort-idle"></i>
              )}
            </span>
          )}
        </span>
        {filterOptions && (
          <div className="rf-th-filter-wrap" ref={btnRef}>
            <button
              className={`rf-th-filter-btn ${open ? "open" : ""} ${hasFilter ? "has-filter" : ""}`}
              onClick={() => setOpen((v) => !v)}
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
    <div className="rf-datepicker-overlay" onClick={onClose}>
      <div className="rf-datepicker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rf-datepicker-header">
          <i className="bi bi-calendar3"></i>
          <span>Filter by Date Range</span>
          <button className="rf-datepicker-close" onClick={onClose}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>
        <div className="rf-datepicker-body">
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
        <div className="rf-datepicker-footer">
          <button className="rf-datepicker-clear" onClick={clear}>
            Clear
          </button>
          <button className="rf-datepicker-apply" onClick={apply}>
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};

const ReviewFilter = ({ transactions = [], children }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");
  const [dateRange, setDateRange] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [amountFilter, setAmountFilter] = useState(null);

  const [sortKey, setSortKey] = useState("");
  const [sortDir, setSortDir] = useState("desc");

  const [txnPage, setTxnPage] = useState(1);

  useEffect(() => {
    setTxnPage(1);
  }, [
    searchTerm,
    serviceFilter,
    channelFilter,
    dateRange,
    sortKey,
    sortDir,
    amountFilter,
  ]);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
    setTxnPage(1);
  };

  const clearAllFilters = () => {
    setSearchTerm("");
    setServiceFilter("all");
    setChannelFilter("all");
    setDateRange(null);
    setAmountFilter(null);
    setSortKey("");
    setSortDir("desc");
    setTxnPage(1);
  };

  const activeFilterCount = [
    serviceFilter !== "all",
    channelFilter !== "all",
    !!dateRange,
    !!searchTerm.trim(),
    !!sortKey,
    !!amountFilter,
  ].filter(Boolean).length;

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    let arr = transactions
      .filter((t) => serviceFilter === "all" || t.service === serviceFilter)
      .filter((t) => {
        if (channelFilter === "all") return true;
        if (t.service === "agenusa") return false;
        return (t.CHANNEL || "").toLowerCase() === channelFilter.toLowerCase();
      })
      .filter((t) => {
        if (!dateRange) return true;
        if (!t.dateTime) return false;
        const d = new Date(t.dateTime);
        if (dateRange.from && d < new Date(dateRange.from)) return false;
        if (dateRange.to) {
          const to = new Date(dateRange.to);
          to.setHours(23, 59, 59, 999);
          if (d > to) return false;
        }
        return true;
      })
      .filter((t) => {
        if (!q) return true;
        const svc = t.service === "agenusa" ? "agenusa" : "nusabill";
        return (
          t.id.toLowerCase().includes(q) ||
          (t.accountId || "").toLowerCase().includes(q) ||
          (t.destOrBill || "").toLowerCase().includes(q) ||
          (t.typeOrChannel || "").toLowerCase().includes(q) ||
          (t.dateTime || "").toLowerCase().includes(q) ||
          svc.includes(q)
        );
      });

    const effectiveSortKey = amountFilter ? "amount" : sortKey;
    const effectiveSortDir = amountFilter || sortDir;

    if (effectiveSortKey) {
      arr = [...arr].sort((a, b) => {
        let av, bv;
        if (effectiveSortKey === "amount") {
          av = a.amount;
          bv = b.amount;
        }
        if (effectiveSortKey === "risk") {
          av = a.fraudScore;
          bv = b.fraudScore;
        }
        if (effectiveSortKey === "date") {
          av = a.dateTime ? new Date(a.dateTime) : 0;
          bv = b.dateTime ? new Date(b.dateTime) : 0;
        }
        if (effectiveSortKey === "channel") {
          av = (a.typeOrChannel || "").toLowerCase();
          bv = (b.typeOrChannel || "").toLowerCase();
        }
        if (effectiveSortKey === "service") {
          av = a.service;
          bv = b.service;
        }
        if (av < bv) return effectiveSortDir === "asc" ? -1 : 1;
        if (av > bv) return effectiveSortDir === "asc" ? 1 : -1;
        return 0;
      });
    }
    return arr;
  }, [
    transactions,
    serviceFilter,
    channelFilter,
    dateRange,
    searchTerm,
    sortKey,
    sortDir,
    amountFilter,
  ]);

  const totalTxnPages = Math.ceil(filtered.length / TXN_PER_PAGE);
  const paginatedTxns = filtered.slice(
    (txnPage - 1) * TXN_PER_PAGE,
    txnPage * TXN_PER_PAGE,
  );

  const filterBar = null;

  const sectionHeader = (
    <div className="section-header">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          flexShrink: 0,
        }}
      >
        <span className="section-title">
          <i className="bi bi-table"></i>Flagged for Review
        </span>
        <span className="section-count-badge">
          {filtered.length} / {transactions.length}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <div className="section-search-box">
          <i className="bi bi-search section-search-icon"></i>
          <input
            type="text"
            className="section-search-input"
            placeholder="Cari ID, account, dest/bill, channel…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              className="section-search-clear"
              onClick={() => setSearchTerm("")}
            >
              <i className="bi bi-x"></i>
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const tableHead = (
    <thead>
      <tr>
        <ColHeader
          label="Layanan"
          colKey="service"
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          sortable={false}
          filterOptions={[
            { value: "all", label: "Semua Layanan", icon: "bi-grid-3x3-gap" },
            { value: "agenusa", label: "AGENUSA", icon: "bi-building" },
            { value: "nusabill", label: "NUSABILL", icon: "bi-receipt" },
          ]}
          filterValue={serviceFilter}
          onFilterChange={(v) => {
            setServiceFilter(v);
            setTxnPage(1);
          }}
        />

        <th className="col-id">ID</th>

        <th>Account / Customer</th>

        <ColHeader
          label="Amount"
          colKey="amount"
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          sortable={false}
          filterOptions={[
            { value: "all", label: "Semua Amount", icon: "bi-dash-circle" },
            {
              value: "desc",
              label: "Terbesar (Highest)",
              icon: "bi-sort-numeric-down-alt",
            },
            {
              value: "asc",
              label: "Terkecil (Lowest)",
              icon: "bi-sort-numeric-up-alt",
            },
          ]}
          filterValue={amountFilter || "all"}
          onFilterChange={(v) => {
            setAmountFilter(v === "all" ? null : v);
            setTxnPage(1);
          }}
        />

        <th className="hide-sm">Dest / Bill ID</th>

        <ColHeader
          label="Type / Channel"
          colKey="channel"
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          sortable={false}
          className="hide-sm"
          filterOptions={[
            { value: "all", label: "All Channels", icon: "bi-broadcast" },
            { value: "API", label: "API", icon: "bi-code-square" },
            { value: "Web", label: "Web", icon: "bi-globe" },
            { value: "Mobile", label: "Mobile", icon: "bi-phone" },
          ]}
          filterValue={channelFilter}
          onFilterChange={(v) => {
            setChannelFilter(v);
            setTxnPage(1);
          }}
        />

        <ColHeader
          label="Date &amp; Time"
          colKey="date"
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          sortable={false}
          className="hide-sm"
          filterOptions={[
            { value: "desc", label: "Terbaru", icon: "bi-sort-down-alt" },
            { value: "asc", label: "Terlama", icon: "bi-sort-up-alt" },
            {
              value: "calendar",
              label: dateRange
                ? `📅 ${dateRange.from || ""}${dateRange.from && dateRange.to ? " → " : ""}${dateRange.to || ""}`
                : "Kalender",
              icon: "bi-calendar3",
            },
          ]}
          filterValue={
            dateRange ? "calendar" : sortKey === "date" ? sortDir : null
          }
          onFilterChange={(v) => {
            if (v === "calendar") {
              setShowDatePicker(true);
            } else {
              setDateRange(null);
              setSortKey("date");
              setSortDir(v);
              setTxnPage(1);
            }
          }}
        />

        <th>Patterns</th>

        <ColHeader
          label="Risk"
          colKey="risk"
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          sortable={false}
          className="center col-risk"
          filterOptions={[
            {
              value: "desc",
              label: "Tertinggi (Highest)",
              icon: "bi-arrow-up-circle-fill",
            },
            {
              value: "asc",
              label: "Terendah (Lowest)",
              icon: "bi-arrow-down-circle-fill",
            },
          ]}
          filterValue={sortKey === "risk" ? sortDir : null}
          onFilterChange={(dir) => {
            setSortKey("risk");
            setSortDir(dir);
            setTxnPage(1);
          }}
        />

        <th>Status</th>

        <th className="col-action"></th>
      </tr>
    </thead>
  );

  const datePickerPortal = showDatePicker ? (
    <DatePickerModal
      value={dateRange}
      onChange={(v) => {
        setDateRange(v);
        setTxnPage(1);
      }}
      onClose={() => setShowDatePicker(false)}
    />
  ) : null;

  const activeFilters = [];

  if (searchTerm.trim()) {
    activeFilters.push({
      key: "search",
      label: `Cari: "${searchTerm.trim()}"`,
      icon: "bi-search",
      color: "#2563eb",
      bg: "#eff6ff",
      border: "#bfdbfe",
      onRemove: () => setSearchTerm(""),
    });
  }
  if (serviceFilter !== "all") {
    activeFilters.push({
      key: "service",
      label: `Layanan: ${serviceFilter === "agenusa" ? "AGENUSA" : "NUSABILL"}`,
      icon: serviceFilter === "agenusa" ? "bi-building" : "bi-receipt",
      color: serviceFilter === "agenusa" ? "#1d4ed8" : "#7c3aed",
      bg: serviceFilter === "agenusa" ? "#eff6ff" : "#fdf4ff",
      border: serviceFilter === "agenusa" ? "#bfdbfe" : "#e9d5ff",
      onRemove: () => {
        setServiceFilter("all");
        setTxnPage(1);
      },
    });
  }
  if (channelFilter !== "all") {
    activeFilters.push({
      key: "channel",
      label: `Channel: ${channelFilter}`,
      icon:
        channelFilter === "API"
          ? "bi-code-square"
          : channelFilter === "Web"
            ? "bi-globe"
            : "bi-phone",
      color: "#0891b2",
      bg: "#ecfeff",
      border: "#a5f3fc",
      onRemove: () => {
        setChannelFilter("all");
        setTxnPage(1);
      },
    });
  }
  if (dateRange) {
    const from = dateRange.from || "";
    const to = dateRange.to || "";
    const label =
      from && to ? `${from} → ${to}` : from ? `Dari ${from}` : `Sampai ${to}`;
    activeFilters.push({
      key: "date",
      label: `Tanggal: ${label}`,
      icon: "bi-calendar3",
      color: "#7c3aed",
      bg: "#faf5ff",
      border: "#e9d5ff",
      onRemove: () => {
        setDateRange(null);
        setTxnPage(1);
      },
    });
  }
  if (amountFilter) {
    activeFilters.push({
      key: "amount",
      label: `Amount: ${amountFilter === "desc" ? "Terbesar" : "Terkecil"}`,
      icon:
        amountFilter === "desc"
          ? "bi-sort-numeric-down-alt"
          : "bi-sort-numeric-up-alt",
      color: "#d97706",
      bg: "#fffbeb",
      border: "#fde68a",
      onRemove: () => {
        setAmountFilter(null);
        setTxnPage(1);
      },
    });
  }
  if (sortKey && sortKey !== "amount") {
    const sortLabels = {
      date: "Tanggal",
      channel: "Channel",
      service: "Layanan",
    };
    let label;
    if (sortKey === "risk") {
      label = `Risk: ${sortDir === "desc" ? "Tertinggi" : "Terendah"}`;
    } else if (sortKey === "date") {
      label = `Tanggal: ${sortDir === "desc" ? "Terbaru" : "Terlama"}`;
    } else {
      label = `Urut: ${sortLabels[sortKey] || sortKey} ${sortDir === "asc" ? "↑" : "↓"}`;
    }
    activeFilters.push({
      key: "sort",
      label,
      icon: "bi-arrow-down-up",
      color: "#475569",
      bg: "#f1f5f9",
      border: "#cbd5e1",
      onRemove: () => {
        setSortKey("");
        setSortDir("desc");
        setTxnPage(1);
      },
    });
  }

  const activeFiltersBar =
    activeFilters.length > 0 ? (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.5rem",
          padding: "0.75rem 1.5rem",
          background: "#fafbfc",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <span
          style={{
            fontSize: "0.72rem",
            fontWeight: 700,
            color: "#94a3b8",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            flexShrink: 0,
            marginRight: "0.25rem",
          }}
        >
          <i className="bi bi-funnel-fill" style={{ marginRight: 4 }}></i>
          Filter aktif:
        </span>

        {activeFilters.map((f) => (
          <span
            key={f.key}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              padding: "0.3rem 0.5rem 0.3rem 0.7rem",
              background: f.bg,
              border: `1px solid ${f.border}`,
              borderRadius: "20px",
              fontSize: "0.75rem",
              fontWeight: 600,
              color: f.color,
              whiteSpace: "nowrap",
              animation: "filterChipIn 0.15s ease",
            }}
          >
            <i className={`bi ${f.icon}`} style={{ fontSize: "0.7rem" }}></i>
            {f.label}
            <button
              onClick={f.onRemove}
              title={`Hapus filter ${f.key}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 16,
                height: 16,
                border: "none",
                borderRadius: "50%",
                background: f.color,
                color: "#fff",
                cursor: "pointer",
                padding: 0,
                marginLeft: "0.1rem",
                flexShrink: 0,
                fontSize: "0.6rem",
                lineHeight: 1,
                opacity: 0.85,
                transition: "opacity 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = 1)}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = 0.85)}
            >
              <i className="bi bi-x-lg"></i>
            </button>
          </span>
        ))}

        <button
          onClick={clearAllFilters}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.3rem",
            padding: "0.3rem 0.75rem",
            background: "transparent",
            border: "1.5px solid #fca5a5",
            borderRadius: "20px",
            fontSize: "0.72rem",
            fontWeight: 700,
            color: "#e11d48",
            cursor: "pointer",
            marginLeft: "auto",
            flexShrink: 0,
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#fef2f2";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          <i className="bi bi-x-circle" style={{ fontSize: "0.8rem" }}></i>
          Reset semua
        </button>

        <style>{`
        @keyframes filterChipIn {
          from { opacity: 0; transform: scale(0.85); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
      </div>
    ) : null;

  return children({
    filtered,
    paginatedTxns,
    totalTxnPages,
    txnPage,
    setTxnPage,
    filterBar,
    sectionHeader,
    tableHead,
    datePickerPortal,
    activeFilterCount,
    clearAllFilters,
    activeFiltersBar,
  });
};

export default ReviewFilter;
