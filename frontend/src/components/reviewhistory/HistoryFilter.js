import React from "react";
import "./HistoryFilter.css";

const FILTER_DEFS = {
  action: {
    label: "Status",
    icon: "bi-shield-check",
    options: [
      {
        value: "approved",
        label: "Approved",
        icon: "bi-check-circle-fill",
        color: { bg: "#ecfdf5", color: "#059669", border: "#6ee7b7" },
      },
      {
        value: "rejected",
        label: "Rejected",
        icon: "bi-x-circle-fill",
        color: { bg: "#fef2f2", color: "#dc2626", border: "#fca5a5" },
      },
    ],
  },
  service: {
    label: "Layanan",
    icon: "bi-layers",
    options: [
      {
        value: "agenusa",
        label: "Agenusa",
        icon: "bi-building",
        color: { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
      },
      {
        value: "nusabill",
        label: "Nusabill",
        icon: "bi-receipt",
        color: { bg: "#fdf4ff", color: "#7c3aed", border: "#e9d5ff" },
      },
    ],
  },
  risk: {
    label: "Risk Level",
    icon: "bi-exclamation-triangle",
    options: [
      {
        value: "critical",
        label: "Critical (≥80)",
        icon: "bi-fire",
        color: { bg: "#fef2f2", color: "#dc2626", border: "#fca5a5" },
      },
      {
        value: "high",
        label: "High (60–79)",
        icon: "bi-exclamation-circle-fill",
        color: { bg: "#fffbeb", color: "#d97706", border: "#fde68a" },
      },
      {
        value: "low",
        label: "Low (<60)",
        icon: "bi-check2-circle",
        color: { bg: "#ecfdf5", color: "#059669", border: "#6ee7b7" },
      },
    ],
  },
};

const FilterGroup = ({ groupKey, def, activeValues, onToggle }) => {
  return (
    <div className="hfilter-group">
      <div className="hfilter-group-label">
        <i className={`bi ${def.icon}`}></i>
        {def.label}
      </div>
      <div className="hfilter-group-options">
        {def.options.map((opt) => {
          const isActive = activeValues.includes(opt.value);
          return (
            <button
              key={opt.value}
              className={`hfilter-option${isActive ? " active" : ""}`}
              style={
                isActive
                  ? {
                      background: opt.color.bg,
                      color: opt.color.color,
                      borderColor: opt.color.border,
                    }
                  : {}
              }
              onClick={() => onToggle(groupKey, opt.value)}
            >
              <i className={`bi ${opt.icon}`}></i>
              <span>{opt.label}</span>
              {isActive && <i className="bi bi-check2 hfilter-opt-check"></i>}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const HistoryFilter = ({ filters, onToggle, onRemove, onReset }) => {
  const activePills = [];
  Object.entries(filters).forEach(([groupKey, values]) => {
    const def = FILTER_DEFS[groupKey];
    values.forEach((val) => {
      const opt = def?.options.find((o) => o.value === val);
      if (opt) {
        activePills.push({ groupKey, val, opt, def });
      }
    });
  });

  const hasActiveFilters = activePills.length > 0;

  return (
    <div className="hfilter-container">
      <div className="hfilter-groups-row">
        {Object.entries(FILTER_DEFS).map(([groupKey, def]) => (
          <FilterGroup
            key={groupKey}
            groupKey={groupKey}
            def={def}
            activeValues={filters[groupKey] || []}
            onToggle={onToggle}
          />
        ))}
      </div>

      <div className="hfilter-active-bar">
        <span className="hfilter-active-label">
          <i className="bi bi-funnel-fill"></i>
          Filter Aktif:
        </span>

        <div className="hfilter-pills">
          {!hasActiveFilters ? (
            <span className="hfilter-pill-empty">
              <i className="bi bi-dash-circle"></i>
              Belum ada filter dipilih
            </span>
          ) : (
            activePills.map(({ groupKey, val, opt }) => (
              <span
                key={`${groupKey}-${val}`}
                className="hfilter-pill"
                style={{
                  background: opt.color.bg,
                  color: opt.color.color,
                  borderColor: opt.color.border,
                }}
              >
                <i className={`bi ${opt.icon}`}></i>
                <span className="hfilter-pill-group-name">
                  {FILTER_DEFS[groupKey].label}:
                </span>
                {opt.label}
                <button
                  className="hfilter-pill-remove"
                  onClick={() => onRemove(groupKey, val)}
                  title={`Hapus filter ${opt.label}`}
                  style={{ color: opt.color.color }}
                >
                  <i className="bi bi-x"></i>
                </button>
              </span>
            ))
          )}
        </div>

        <button
          className={`hfilter-reset-all${!hasActiveFilters ? " disabled" : ""}`}
          onClick={hasActiveFilters ? onReset : undefined}
          disabled={!hasActiveFilters}
        >
          <i className="bi bi-arrow-counterclockwise"></i>
          Reset Semua
        </button>
      </div>
    </div>
  );
};

export default HistoryFilter;
