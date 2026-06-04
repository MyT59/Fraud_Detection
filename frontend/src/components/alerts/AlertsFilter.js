import React from "react";

const TYPE_OPTIONS = [
  { value: "all", label: "Semua Tipe" },
  { value: "fraud", label: "Fraud Detected" },
  { value: "rule", label: "Rule Triggered" },
  { value: "blacklist", label: "Blacklist Hit" },
  { value: "review", label: "Manual Review" },
  { value: "system", label: "System Alert" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "Semua Status" },
  { value: "unread", label: "Belum Dibaca (OPEN)" },
  { value: "read", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const SEVERITY_OPTIONS = [
  { value: "all", label: "Semua Level" },
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const AlertsFilter = ({ filters, onFilterChange, onReset, totalResults }) => {
  return (
    <div className="alerts-filter-card">
      <div className="alerts-filter-row">
        <div className="alerts-search-wrap">
          <i className="bi bi-search alerts-search-icon"></i>
          <input
            type="text"
            className="alerts-search-input"
            placeholder="Cari pesan, ID transaksi..."
            value={filters.search}
            onChange={(e) => onFilterChange({ search: e.target.value })}
          />
          {filters.search && (
            <button
              className="alerts-search-clear"
              onClick={() => onFilterChange({ search: "" })}
            >
              <i className="bi bi-x-lg"></i>
            </button>
          )}
        </div>

        <select
          className="alerts-select"
          value={filters.type}
          onChange={(e) => onFilterChange({ type: e.target.value })}
        >
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <select
          className="alerts-select"
          value={filters.severity}
          onChange={(e) => onFilterChange({ severity: e.target.value })}
        >
          {SEVERITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <select
          className="alerts-select"
          value={filters.status}
          onChange={(e) => onFilterChange({ status: e.target.value })}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <button className="alerts-btn-outline" onClick={onReset}>
          <i className="bi bi-arrow-counterclockwise"></i> Reset
        </button>
      </div>

      <div className="alerts-filter-meta">
        <i className="bi bi-funnel"></i>
        Menampilkan <strong>{totalResults}</strong> alert
      </div>
    </div>
  );
};

export default AlertsFilter;
