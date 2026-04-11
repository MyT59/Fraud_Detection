import React, { useState } from "react";

const FilterBar = ({ filters, onFilterChange, onResetFilters }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    onFilterChange({ [name]: value });
  };

  const hasActiveFilters = () =>
    filters.dateFrom ||
    filters.dateTo ||
    filters.amountMin ||
    filters.amountMax ||
    filters.status !== "all" ||
    filters.service !== "all";

  return (
    <div className="card filter-card mb-4">
      <div className="card-header d-flex justify-content-between align-items-center">
        <h5 className="mb-0">
          <i className="bi bi-funnel me-2"></i>
          Filter Transaksi
          {hasActiveFilters() && (
            <span className="badge bg-primary ms-2">Active</span>
          )}
        </h5>
        <button
          className="btn btn-sm btn-link"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? (
            <>
              <i className="bi bi-chevron-up"></i> Sembunyikan
            </>
          ) : (
            <>
              <i className="bi bi-chevron-down"></i> Tampilkan
            </>
          )}
        </button>
      </div>

      {isExpanded && (
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label">
                <i className="bi bi-grid-1x2 me-1"></i>Layanan
              </label>
              <select
                className="form-select"
                name="service"
                value={filters.service}
                onChange={handleInputChange}
              >
                <option value="all">Semua Layanan</option>
                <option value="agenusa">AGENUSA</option>
                <option value="nusabill">NUSABILL</option>
              </select>
            </div>

            <div className="col-md-6">
              <label className="form-label">
                <i className="bi bi-flag me-1"></i>Status
              </label>
              <select
                className="form-select"
                name="status"
                value={filters.status}
                onChange={handleInputChange}
              >
                <option value="all">Semua Status</option>
                <option value="pending">⏳ Pending</option>
                <option value="approved">✓ Approved</option>
                <option value="rejected">✗ Rejected</option>
              </select>
            </div>

            <div className="col-md-6">
              <label className="form-label">
                <i className="bi bi-calendar-range me-1"></i>Tanggal Mulai
              </label>
              <input
                type="date"
                className="form-control"
                name="dateFrom"
                value={filters.dateFrom}
                onChange={handleInputChange}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">
                <i className="bi bi-calendar-check me-1"></i>Tanggal Akhir
              </label>
              <input
                type="date"
                className="form-control"
                name="dateTo"
                value={filters.dateTo}
                onChange={handleInputChange}
              />
            </div>

            <div className="col-md-6">
              <label className="form-label">
                <i className="bi bi-currency-dollar me-1"></i>Jumlah Minimal
                (IDR)
              </label>
              <input
                type="number"
                className="form-control"
                name="amountMin"
                placeholder="0"
                value={filters.amountMin}
                onChange={handleInputChange}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">
                <i className="bi bi-currency-dollar me-1"></i>Jumlah Maksimal
                (IDR)
              </label>
              <input
                type="number"
                className="form-control"
                name="amountMax"
                placeholder="1000000000"
                value={filters.amountMax}
                onChange={handleInputChange}
              />
            </div>

            <div className="col-12">
              <div className="d-flex gap-2 align-items-center">
                <button
                  className="btn btn-outline-secondary"
                  onClick={onResetFilters}
                  disabled={!hasActiveFilters()}
                >
                  <i className="bi bi-arrow-counterclockwise me-1"></i>Reset
                  Filter
                </button>
                <span className="text-muted small ms-auto">
                  Filter aktif: {hasActiveFilters() ? "Ya" : "Tidak"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterBar;
