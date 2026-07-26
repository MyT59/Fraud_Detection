import React from "react";
import "./ActivityFeed.css";

const TYPE_CONFIG = {
  create: {
    icon: "bi-person-plus-fill",
    cls: "afd-type-create",
    label: "Dibuat",
  },
  edit: { icon: "bi-pencil-fill", cls: "afd-type-edit", label: "Diedit" },
  suspend: {
    icon: "bi-pause-circle-fill",
    cls: "afd-type-suspend",
    label: "Disuspend",
  },
  delete: { icon: "bi-trash-fill", cls: "afd-type-delete", label: "Dihapus" },
};

const PAGE_SIZE = 10;

const ActivityFeed = ({ logs, page = 1, total = logs.length, onPageChange }) => {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = logs;

  if (logs.length === 0) {
    return (
      <div className="afd-empty">
        <i className="bi bi-journal-x"></i>
        <p>Tidak ada log aktivitas ditemukan</p>
      </div>
    );
  }

  return (
    <div className="afd-wrapper">
      <div className="afd-list">
        {paginated.map((item, i) => {
          const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.edit;
          return (
            <div className="afd-item" key={i}>
              <div className="afd-left">
                <div className={`afd-icon-wrap ${cfg.cls}`}>
                  <i className={`bi ${cfg.icon}`}></i>
                </div>
                {i < paginated.length - 1 && <div className="afd-line"></div>}
              </div>

              <div className="afd-content">
                <div className="afd-top">
                  <span className={`afd-type-badge ${cfg.cls}`}>
                    {cfg.label}
                  </span>
                  <span className="afd-time">
                    <i className="bi bi-clock me-1"></i>
                    {item.time}
                  </span>
                </div>
                <p className="afd-desc">{item.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="afd-pagination">
          <span className="afd-page-info">
            {(safePage - 1) * PAGE_SIZE + 1}–
            {Math.min(safePage * PAGE_SIZE, total)} dari {total} log
          </span>
          <div className="afd-page-btns">
            <button
              className="afd-page-btn"
              disabled={safePage === 1}
              onClick={() => onPageChange?.(safePage - 1)}
            >
              <i className="bi bi-chevron-left"></i>
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                className={`afd-page-btn ${safePage === p ? "afd-page-active" : ""}`}
              onClick={() => onPageChange?.(p)}
              >
                {p}
              </button>
            ))}
            <button
              className="afd-page-btn"
              disabled={safePage === totalPages}
              onClick={() => onPageChange?.(safePage + 1)}
            >
              <i className="bi bi-chevron-right"></i>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityFeed;
