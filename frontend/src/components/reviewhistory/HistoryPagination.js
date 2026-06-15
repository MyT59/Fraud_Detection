import React from "react";

/**
 * HistoryPagination.js
 * Komponen pagination untuk Review History table.
 * Menampilkan info entri + kontrol halaman dengan ellipsis.
 */

const HistoryPagination = ({
  currentPage,
  totalPages,
  totalItems,
  perPage,
  onPageChange,
}) => {
  const start = totalItems === 0 ? 0 : (currentPage - 1) * perPage + 1;
  const end = Math.min(currentPage * perPage, totalItems);
  const eff = Math.max(1, totalPages);

  const getPages = () => {
    if (eff <= 7) return Array.from({ length: eff }, (_, i) => i + 1);
    const pages = [1];
    if (currentPage > 3) pages.push("...");
    for (
      let i = Math.max(2, currentPage - 1);
      i <= Math.min(eff - 1, currentPage + 1);
      i++
    ) {
      pages.push(i);
    }
    if (currentPage < eff - 2) pages.push("...");
    pages.push(eff);
    return pages;
  };

  return (
    <div className="htable-pagination">
      <span className="hpagination-info">
        Showing{" "}
        <strong>
          {start}–{end}
        </strong>{" "}
        of <strong>{totalItems}</strong> entries
      </span>

      <div className="hpagination-controls">
        <button
          className="hpage-btn nav"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <i className="bi bi-chevron-left" />
        </button>

        {getPages().map((p, i) =>
          p === "..." ? (
            <span key={`dot${i}`} className="hpage-ellipsis">
              …
            </span>
          ) : (
            <button
              key={p}
              className={`hpage-btn${p === currentPage ? " active" : ""}`}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          ),
        )}

        <button
          className="hpage-btn nav"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === eff || totalItems === 0}
        >
          <i className="bi bi-chevron-right" />
        </button>
      </div>
    </div>
  );
};

export default HistoryPagination;
