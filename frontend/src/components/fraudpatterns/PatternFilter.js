import React from "react";
import "./PatternFilter.css";

const RISK_FILTERS = [
  { value: "all", label: "All Patterns", icon: "bi-list-ul" },
  { value: "high", label: "High Risk", icon: "bi-exclamation-triangle" },
  { value: "medium", label: "Medium Risk", icon: "bi-exclamation-circle" },
  { value: "low", label: "Low Risk", icon: "bi-info-circle" },
];

const STATUS_FILTERS = [
  { value: "all", label: "All Status" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "review", label: "Under Review" },
];

const SORT_OPTIONS = [
  { value: "occurrences_desc", label: "Most Detected" },
  { value: "occurrences_asc", label: "Least Detected" },
  { value: "accuracy_desc", label: "Highest Accuracy" },
  { value: "name_asc", label: "Name A–Z" },
];

const PatternFilter = ({
  riskFilter,
  setRiskFilter,
  statusFilter,
  setStatusFilter,
  searchTerm,
  setSearchTerm,
  sortBy,
  setSortBy,
  totalResults,
}) => {
  return (
    <div className="pf-container">
      <div className="pf-top">
        <div className="pf-tabs">
          {RISK_FILTERS.map((f) => (
            <button
              key={f.value}
              className={`pf-tab ${f.value} ${riskFilter === f.value ? "active" : ""}`}
              onClick={() => setRiskFilter(f.value)}
            >
              <i className={`bi ${f.icon}`}></i>
              <span>{f.label}</span>
            </button>
          ))}
        </div>

        <div className="pf-controls">
          <select
            className="pf-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          <select
            className="pf-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            {SORT_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="pf-bottom">
        <div className="pf-search">
          <i className="bi bi-search"></i>
          <input
            type="text"
            placeholder="Search pattern name or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="pf-clear" onClick={() => setSearchTerm("")}>
              <i className="bi bi-x"></i>
            </button>
          )}
        </div>
        <span className="pf-results">
          <i className="bi bi-funnel"></i>
          {totalResults} patterns found
        </span>
      </div>
    </div>
  );
};

export default PatternFilter;
