import React, { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useRole from "../../hooks/useRole";
import "./HistoryTable.css";

/**
 * HistoryTable
 *
 * Hanya merender field yang tersedia dari BE ReviewHistoryItem schema:
 *   id, transaction_id, alert_id, decision, review_note,
 *   previous_status, final_status, reviewed_by, created_at
 *
 * Kolom yang DIHAPUS karena tidak ada di BE:
 *   Layanan (service), Amount, Account/Customer, Risk Score,
 *   Reviewer name/role
 */

const fmtTs = (ds) => {
  if (!ds) return "—";
  return new Date(ds).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const timeAgo = (ds) => {
  if (!ds) return "";
  const diff = (Date.now() - new Date(ds).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

// Decision badge — sesuai enum BE: SAFE | FRAUD
const DECISION_META = {
  SAFE: { icon: "bi-check-circle-fill", label: "SAFE", cls: "approved" },
  FRAUD: { icon: "bi-x-circle-fill", label: "FRAUD", cls: "rejected" },
};

const DecisionBadge = ({ decision }) => {
  const meta =
    DECISION_META[(decision || "").toUpperCase()] || DECISION_META.SAFE;
  return (
    <span className={`rh-pill ${meta.cls}`}>
      <i className={`bi ${meta.icon}`} /> {meta.label}
    </span>
  );
};

// Status Badge — untuk previous_status / final_status
// Indicator bahwa review ini bisa di-override (hanya tampil untuk canManage)
// Mengarahkan user ke tab Review Management di ManualReview
const OverridableIndicator = ({ onClick }) => (
  <button
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    title="Kelola di Manual Review (Override / Delete)"
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: ".3rem",
      padding: "2px 7px",
      border: "1px solid #bfdbfe",
      borderRadius: "10px",
      background: "#eff6ff",
      color: "#1d4ed8",
      fontSize: ".68rem",
      fontWeight: 700,
      cursor: "pointer",
      transition: "all .15s",
      whiteSpace: "nowrap",
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = "#dbeafe";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = "#eff6ff";
    }}
  >
    <i className="bi bi-arrow-repeat" /> Override
  </button>
);

const StatusBadge = ({ status }) => {
  if (!status) return <span className="rh-empty">—</span>;
  const colorMap = {
    FRAUD: { bg: "#fee2e2", color: "#b91c1c" },
    SAFE: { bg: "#dcfce7", color: "#15803d" },
    UNDER_REVIEW: { bg: "#eff6ff", color: "#1d4ed8" },
    PENDING: { bg: "#f1f5f9", color: "#475569" },
    RESOLVED: { bg: "#f0fdf4", color: "#15803d" },
  };
  const style = colorMap[status.toUpperCase()] || {
    bg: "#f1f5f9",
    color: "#475569",
  };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "10px",
        fontSize: ".7rem",
        fontWeight: 700,
        background: style.bg,
        color: style.color,
      }}
    >
      {status}
    </span>
  );
};

// Sortable options
const TIMESTAMP_OPTS = [
  { value: "createdAt-desc", label: "Terbaru", icon: "bi-sort-down" },
  { value: "createdAt-asc", label: "Terlama", icon: "bi-sort-up" },
];

const DECISION_OPTS = [
  { value: "all", label: "Semua Keputusan", icon: "bi-grid" },
  { value: "SAFE", label: "SAFE", icon: "bi-check-circle" },
  { value: "FRAUD", label: "FRAUD", icon: "bi-x-circle" },
];

const ColDropdown = ({ options, activeValue, onSelect, isActive }) => {
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

const SkeletonRow = () => (
  <tr className="htable-row htable-row--skeleton">
    {[...Array(6)].map((_, i) => (
      <td key={i}>
        <div className="hcell-skeleton" />
      </td>
    ))}
  </tr>
);

const Pagination = ({
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
    )
      pages.push(i);
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

// ─── Main Table Component ─────────────────────────────────────────

const HistoryTable = ({
  data = [],
  loading,
  totalItems,
  page,
  totalPages,
  perPage,
  onPageChange,
  onViewDetail,
  onRefresh,
  apiError,
}) => {
  const { canManage } = useRole();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("createdAt-desc");
  const [filterDecision, setFilterDecision] = useState("all");

  // Filter & sort lokal (client-side) di atas data dari server
  const processed = useMemo(() => {
    let result = [...data];

    // Filter: search (transaction ID atau alert ID)
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (r) =>
          r.transactionId?.toLowerCase().includes(q) ||
          String(r.alertId ?? "").includes(q) ||
          String(r.reviewedBy ?? "").includes(q),
      );
    }

    // Filter: decision
    if (filterDecision !== "all") {
      result = result.filter((r) => r.decision === filterDecision);
    }

    // Sort
    result.sort((a, b) => {
      if (sortKey === "createdAt-asc")
        return new Date(a.createdAt) - new Date(b.createdAt);
      return new Date(b.createdAt) - new Date(a.createdAt); // default: desc
    });

    return result;
  }, [data, search, sortKey, filterDecision]);

  const hasActiveFilters =
    search || filterDecision !== "all" || sortKey !== "createdAt-desc";

  const handleGoToManagement = () => {
    navigate("/manual-review", { state: { activeTab: "management" } });
  };

  const handleReset = () => {
    setSearch("");
    setSortKey("createdAt-desc");
    setFilterDecision("all");
  };

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: "10px",
        overflow: "hidden",
      }}
    >
      {/* Banner for canManage — shortcut ke Review Management */}
      {canManage && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: ".75rem",
            padding: ".75rem 1.25rem",
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderBottom: "none",
            borderRadius: "10px 10px 0 0",
            fontSize: ".82rem",
            color: "#1d4ed8",
            flexWrap: "wrap",
          }}
        >
          <i
            className="bi bi-shield-fill-exclamation"
            style={{ flexShrink: 0 }}
          />
          <span style={{ flex: 1 }}>
            Sebagai <strong>Manager/Admin</strong>, kamu bisa melakukan Override
            atau Delete review dari halaman{" "}
            <strong>Manual Review → Review Management</strong>.
          </span>
          <button
            onClick={handleGoToManagement}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: ".4rem",
              padding: ".4rem .875rem",
              background: "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: "7px",
              fontSize: ".78rem",
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            <i className="bi bi-arrow-right-circle-fill" /> Kelola Review
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div
        className={`rh-filterbar${canManage ? " rh-filterbar--no-top-radius" : ""}`}
      >
        {/* Search */}
        <div className="rh-search-wrap">
          <i className="bi bi-search rh-search-icon" />
          <input
            className="rh-search-input"
            placeholder="Cari Transaction ID, Alert ID, Reviewer ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="rh-search-clear" onClick={() => setSearch("")}>
              <i className="bi bi-x" />
            </button>
          )}
        </div>

        {/* Filter Decision */}
        <select
          style={{
            height: 36,
            padding: "0 10px",
            border: "1.5px solid #e2e8f0",
            borderRadius: "8px",
            fontSize: ".85rem",
            color: "#374151",
            background: "#f8fafc",
            cursor: "pointer",
          }}
          value={filterDecision}
          onChange={(e) => setFilterDecision(e.target.value)}
        >
          {DECISION_OPTS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        {/* Reset */}
        {hasActiveFilters && (
          <button className="rh-clear-all" onClick={handleReset}>
            <i className="bi bi-x-circle" /> Reset Filter
          </button>
        )}

        {/* Refresh */}
        <button
          onClick={onRefresh}
          style={{
            display: "flex",
            alignItems: "center",
            gap: ".35rem",
            padding: ".4rem .75rem",
            border: "1px solid #e2e8f0",
            borderRadius: "7px",
            background: "#f8fafc",
            fontSize: ".8rem",
            fontWeight: 600,
            color: "#374151",
            cursor: "pointer",
            marginLeft: "auto",
          }}
        >
          <i className="bi bi-arrow-clockwise" /> Refresh
        </button>

        <span className="rh-result-count">
          <i className="bi bi-list-ul" /> {processed.length} entri
        </span>
      </div>

      {/* Table */}
      <div className="htable-wrapper">
        {apiError ? (
          <div className="htable-empty">
            <i className="bi bi-wifi-off" />
            <p>Data tidak tersedia</p>
            <span>
              Tidak dapat terhubung ke server. Klik Refresh untuk mencoba lagi.
            </span>
          </div>
        ) : !loading && processed.length === 0 ? (
          <div className="htable-empty">
            <i className="bi bi-inbox" />
            <p>Tidak ada riwayat review</p>
            <span>Belum ada review yang tercatat, atau coba ubah filter.</span>
          </div>
        ) : (
          <table className="htable">
            <thead>
              <tr>
                {/* Timestamp — sortable */}
                <th>
                  <div className="htable-th-inner">
                    <span>Waktu</span>
                    <ColDropdown
                      options={TIMESTAMP_OPTS}
                      activeValue={sortKey}
                      onSelect={setSortKey}
                      isActive={sortKey !== "createdAt-desc"}
                    />
                  </div>
                </th>
                {/* Transaction ID */}
                <th>
                  <div className="htable-th-inner">
                    <span>Transaction ID</span>
                  </div>
                </th>
                {/* Alert ID */}
                <th>
                  <div className="htable-th-inner">
                    <span>Alert ID</span>
                  </div>
                </th>
                {/* Decision — filterable */}
                <th>
                  <div className="htable-th-inner">
                    <span>Decision</span>
                    <ColDropdown
                      options={DECISION_OPTS}
                      activeValue={filterDecision}
                      onSelect={setFilterDecision}
                      isActive={filterDecision !== "all"}
                    />
                  </div>
                </th>
                {/* Previous → Final Status */}
                <th className="hide-md">
                  <div className="htable-th-inner">
                    <span>Status</span>
                  </div>
                </th>
                {/* Reviewer ID */}
                <th className="hide-md">
                  <div className="htable-th-inner">
                    <span>Reviewer ID</span>
                  </div>
                </th>
                {/* Notes */}
                <th>
                  <div className="htable-th-inner">
                    <span>Notes</span>
                  </div>
                </th>
              </tr>
            </thead>

            <tbody>
              {loading
                ? [...Array(perPage)].map((_, i) => <SkeletonRow key={i} />)
                : processed.map((item) => (
                    <tr
                      key={item.id}
                      className="htable-row"
                      onClick={() => onViewDetail(item)}
                      style={{ cursor: "pointer" }}
                    >
                      {/* Waktu */}
                      <td>
                        <div className="hcell-ts">{fmtTs(item.createdAt)}</div>
                        <div className="hcell-ts-ago">
                          {timeAgo(item.createdAt)}
                        </div>
                      </td>

                      {/* Transaction ID */}
                      <td>
                        <span className="hcell-txnid">
                          {item.transactionId}
                        </span>
                      </td>

                      {/* Alert ID */}
                      <td>
                        {item.alertId != null ? (
                          <span className="hcell-txnid">#{item.alertId}</span>
                        ) : (
                          <span className="hcell-empty">—</span>
                        )}
                      </td>

                      {/* Decision */}
                      <td>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: ".5rem",
                            flexWrap: "wrap",
                          }}
                        >
                          <DecisionBadge decision={item.decision} />
                          {canManage && (
                            <OverridableIndicator
                              onClick={handleGoToManagement}
                            />
                          )}
                        </div>
                      </td>

                      {/* Status: previous → final */}
                      <td className="hide-md">
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: ".4rem",
                            flexWrap: "wrap",
                          }}
                        >
                          <StatusBadge status={item.previousStatus} />
                          {item.previousStatus && item.finalStatus && (
                            <i
                              className="bi bi-arrow-right"
                              style={{ color: "#94a3b8", fontSize: ".75rem" }}
                            />
                          )}
                          <StatusBadge status={item.finalStatus} />
                        </div>
                      </td>

                      {/* Reviewer ID — nama tidak ada di BE */}
                      <td className="hide-md">
                        {item.reviewedBy != null ? (
                          <span
                            style={{
                              fontFamily: "IBM Plex Mono, monospace",
                              fontSize: ".78rem",
                              fontWeight: 600,
                              color: "#334155",
                            }}
                          >
                            <i
                              className="bi bi-person-fill"
                              style={{ marginRight: 4, color: "#7c3aed" }}
                            />
                            #{item.reviewedBy}
                          </span>
                        ) : (
                          <span className="hcell-empty">—</span>
                        )}
                      </td>

                      {/* Notes */}
                      <td onClick={(e) => e.stopPropagation()}>
                        {item.reviewNote ? (
                          <button
                            className="hbtn-view"
                            onClick={() => onViewDetail(item)}
                          >
                            <i className="bi bi-chat-left-text" /> Lihat
                          </button>
                        ) : (
                          <span className="hcell-empty">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        )}
      </div>

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={totalItems}
        perPage={perPage}
        onPageChange={onPageChange}
      />
    </div>
  );
};

export default HistoryTable;
