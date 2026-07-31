import React from "react";

// Sesuai enum BE: AlertStatusEnum
const STATUS_OPTIONS = [
  { value: "all", label: "Semua Status" },
  { value: "OPEN", label: "Open" },
  { value: "IN_PROGRESS", label: "In Progress (Diklaim)" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "REOPENED", label: "Reopened" },
  { value: "OVERRIDDEN", label: "Overridden" },
];

// Sesuai enum BE: SeverityLevelEnum / field severity di FraudAlert
const SEVERITY_OPTIONS = [
  { value: "all", label: "Semua Level" },
  { value: "CRITICAL", label: "Critical" },
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
];

const TYPE_OPTIONS = [
  { value: "all", label: "Semua Tipe" },
  { value: "RULE", label: "Rule Engine" },
  { value: "PATTERN", label: "Pattern Detection (ML)" },
  { value: "COMBINED", label: "Combined Detection" },
  { value: "BLACKLIST", label: "Blacklist Hit" },
  { value: "ML", label: "ML Anomaly" },
  { value: "RULE_ML", label: "Rule + ML" },
  { value: "PATTERN_ML", label: "Pattern + ML" },
  { value: "COMBINED_ML", label: "Combined + ML" },
  { value: "SYSTEM", label: "System" },
];

const SORT_OPTIONS = [
  { value: "newest", label: "Terbaru" },
  { value: "oldest", label: "Terlama" },
  { value: "priority_desc", label: "Prioritas Tertinggi" },
  { value: "priority_asc", label: "Prioritas Terendah" },
];

const AlertsFilter = ({ filters, onFilterChange, onReset, totalResults }) => {
  return (
    <div className="alerts-filter-card">
      <div className="alerts-filter-row">
        {/* Search */}
        <div className="alerts-search-wrap">
          <i className="bi bi-search alerts-search-icon" />
          <input
            type="text"
            className="alerts-search-input"
            placeholder="Cari ID transaksi, akun, merchant, terminal, IP, rule/pattern..."
            value={filters.search}
            onChange={(e) => onFilterChange({ search: e.target.value })}
          />
          {filters.search && (
            <button
              className="alerts-search-clear"
              onClick={() => onFilterChange({ search: "" })}
            >
              <i className="bi bi-x-lg" />
            </button>
          )}
        </div>

        {/* Filter Tipe */}
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

        {/* Filter Severity */}
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

        {/* Filter Status */}
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

        {/* Sort */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label
            style={{
              fontSize: "0.85rem",
              fontWeight: "600",
              color: "#6b7280",
              whiteSpace: "nowrap",
            }}
          >
            Sort By
          </label>
          <select
            className="alerts-select"
            value={filters.sortBy || "newest"}
            onChange={(e) => onFilterChange({ sortBy: e.target.value })}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <button className="alerts-btn-outline" onClick={onReset}>
          <i className="bi bi-arrow-counterclockwise" /> Reset
        </button>
      </div>

      <div className="alerts-filter-meta">
        Menampilkan <strong>{totalResults}</strong> alert sesuai filter
      </div>
    </div>
  );
};

export default AlertsFilter;
