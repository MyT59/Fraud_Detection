import React from "react";

/* ═══════════════════════════════════════════
   ScheduleFilters — Search + filter pills
═══════════════════════════════════════════ */
const ScheduleFilters = ({
  filterStatus, setFilterStatus,
  filterFreq,   setFilterFreq,
  searchQuery,  setSearchQuery,
  totalShown,
}) => {
  const statusOpts = [
    { value: "all",    label: "Semua" },
    { value: "active", label: "Aktif" },
    { value: "paused", label: "Paused" },
  ];

  const freqOpts = [
    { value: "all",     label: "Semua" },
    { value: "daily",   label: "Harian" },
    { value: "weekly",  label: "Mingguan" },
    { value: "monthly", label: "Bulanan" },
  ];

  return (
    <div className="rs-filters-bar">
      {/* Search */}
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
          <button className="rs-search-clear" onClick={() => setSearchQuery("")}>
            <i className="bi bi-x" />
          </button>
        )}
      </div>

      {/* Status filter */}
      <div className="rs-filter-group">
        <span className="rs-filter-label">Status</span>
        <div className="rs-pills">
          {statusOpts.map((o) => (
            <button
              key={o.value}
              className={`rs-pill ${filterStatus === o.value ? "rs-pill--active" : ""}`}
              onClick={() => setFilterStatus(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Frequency filter */}
      <div className="rs-filter-group">
        <span className="rs-filter-label">Frekuensi</span>
        <div className="rs-pills">
          {freqOpts.map((o) => (
            <button
              key={o.value}
              className={`rs-pill ${filterFreq === o.value ? "rs-pill--active" : ""}`}
              onClick={() => setFilterFreq(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Result count */}
      <span className="rs-result-count">
        <i className="bi bi-funnel" /> {totalShown} schedule
      </span>
    </div>
  );
};

export default ScheduleFilters;