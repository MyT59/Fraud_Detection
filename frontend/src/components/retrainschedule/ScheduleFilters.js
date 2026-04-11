import React from "react";

const FREQ_LABELS = { daily: "Harian", weekly: "Mingguan", monthly: "Bulanan" };
const STATUS_LABELS = { active: "Aktif", paused: "Paused" };

const ScheduleFilters = ({
  searchQuery,
  setSearchQuery,
  filterStatus,
  setFilterStatus,
  filterFreq,
  setFilterFreq,
  totalShown,
}) => {
  const activeFilters = [
    searchQuery.trim() && {
      key: "search",
      icon: "bi-search",
      label: `"${searchQuery.trim()}"`,
      onRemove: () => setSearchQuery(""),
    },
    filterStatus !== "all" && {
      key: "status",
      icon: "bi-circle-fill",
      label: `Status: ${STATUS_LABELS[filterStatus]}`,
      onRemove: () => setFilterStatus("all"),
    },
    filterFreq !== "all" && {
      key: "freq",
      icon: "bi-calendar",
      label: `Frekuensi: ${FREQ_LABELS[filterFreq]}`,
      onRemove: () => setFilterFreq("all"),
    },
  ].filter(Boolean);

  const hasFilters = activeFilters.length > 0;

  const resetAll = () => {
    setSearchQuery("");
    setFilterStatus("all");
    setFilterFreq("all");
  };

  return (
    <div className="rs-filters-wrap">
      <div className="rs-filters-bar">
        <div className="rs-search-wrap">
          <i className="bi bi-search rs-search-icon" />
          <input
            type="text"
            className="rs-search-input"
            placeholder="Cari nama schedule atau model..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="rs-search-clear"
              onClick={() => setSearchQuery("")}
            >
              <i className="bi bi-x" />
            </button>
          )}
        </div>

        <span className="rs-result-count">
          <i className="bi bi-funnel" /> {totalShown} schedule
        </span>
      </div>

      {hasFilters && (
        <div className="rs-active-filters">
          <span className="rs-active-filters__label">Filter aktif:</span>

          <div className="rs-active-filters__chips">
            {activeFilters.map((f) => (
              <span key={f.key} className="rs-filter-chip">
                <i className={`bi ${f.icon} rs-filter-chip__icon`} />
                {f.label}
                <button
                  className="rs-filter-chip__remove"
                  onClick={f.onRemove}
                  title="Hapus filter"
                >
                  <i className="bi bi-x" />
                </button>
              </span>
            ))}
          </div>

          <button className="rs-reset-btn" onClick={resetAll}>
            <i className="bi bi-arrow-counterclockwise" />
            Reset semua
          </button>
        </div>
      )}
    </div>
  );
};

export default ScheduleFilters;
