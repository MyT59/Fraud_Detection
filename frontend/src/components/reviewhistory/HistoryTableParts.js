import React, { useState, useRef, useEffect } from "react";

/**
 * HistoryTableParts.js
 * Sub-komponen untuk HistoryTable:
 *  - ColDropdown  : filter dropdown per kolom header
 *  - SkeletonRow  : loading placeholder row
 *
 * Konstanta filter options juga di-export dari sini
 * agar HistoryTable tidak perlu mendefinisikan ulang.
 */

// ─── Filter Options ───────────────────────────────────────────────

export const TIMESTAMP_OPTS = [
  { value: "createdAt-desc", label: "Terbaru", icon: "bi-sort-down" },
  { value: "createdAt-asc", label: "Terlama", icon: "bi-sort-up" },
];

export const DECISION_OPTS = [
  { value: "all", label: "Semua Keputusan", icon: "bi-grid" },
  { value: "SAFE", label: "SAFE", icon: "bi-check-circle" },
  { value: "FRAUD", label: "FRAUD", icon: "bi-x-circle" },
];

// ─── ColDropdown ──────────────────────────────────────────────────

/**
 * Dropdown filter yang muncul di header kolom tabel.
 * Close otomatis jika klik di luar.
 */
export const ColDropdown = ({ options, activeValue, onSelect, isActive }) => {
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
      >
        <i className={`bi ${isActive ? "bi-funnel-fill" : "bi-funnel"}`} />
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
              <i className={`bi ${opt.icon}`} />
              {opt.label}
              {activeValue === opt.value && (
                <i className="bi bi-check2 htcol-check" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── SkeletonRow ──────────────────────────────────────────────────

/**
 * Placeholder row saat data sedang dimuat.
 * Jumlah kolom: 7 (sesuai HistoryTable header).
 */
export const SkeletonRow = () => (
  <tr className="htable-row htable-row--skeleton">
    {[...Array(7)].map((_, i) => (
      <td key={i}>
        <div className="hcell-skeleton" />
      </td>
    ))}
  </tr>
);
