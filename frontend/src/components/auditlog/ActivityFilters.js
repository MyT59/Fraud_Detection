import React from 'react';
import './ActivityFilters.css';

const TYPE_OPTIONS = [
  { value: 'all',     label: 'Semua Tipe' },
  { value: 'create',  label: 'Dibuat' },
  { value: 'edit',    label: 'Diedit' },
  { value: 'suspend', label: 'Disuspend' },
  { value: 'delete',  label: 'Dihapus' },
];

const ActivityFilters = ({ search, onSearch, typeFilter, onTypeFilter, onReset }) => {
  const hasFilter = search || typeFilter !== 'all';

  return (
    <div className="af-bar">
      {/* Search */}
      <div className="af-search-wrap">
        <i className="bi bi-search af-search-icon"></i>
        <input
          className="af-search"
          type="text"
          placeholder="Cari aktivitas, nama pengguna..."
          value={search}
          onChange={e => onSearch(e.target.value)}
        />
        {search && (
          <button className="af-clear" onClick={() => onSearch('')}>
            <i className="bi bi-x"></i>
          </button>
        )}
      </div>

      {/* Type filter pills */}
      <div className="af-pills">
        {TYPE_OPTIONS.map(opt => (
          <button
            key={opt.value}
            className={`af-pill ${typeFilter === opt.value ? 'af-pill-active' : ''}`}
            onClick={() => onTypeFilter(opt.value)}
          >
            {opt.value !== 'all' && (
              <span className={`af-dot af-dot-${opt.value}`}></span>
            )}
            {opt.label}
          </button>
        ))}
      </div>

      {/* Reset */}
      {hasFilter && (
        <button className="af-reset" onClick={onReset}>
          <i className="bi bi-arrow-counterclockwise"></i>
          Reset
        </button>
      )}
    </div>
  );
};

export default ActivityFilters;