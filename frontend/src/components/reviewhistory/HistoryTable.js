import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import useRole from "../../hooks/useRole";

import { fmtTs, timeAgo } from "./historyHelpers";
import {
  DecisionBadge,
  StatusBadge,
  OverridableIndicator,
  ReviewerCell,
} from "./HistoryBadges";
import {
  ColDropdown,
  SkeletonRow,
  TIMESTAMP_OPTS,
  DECISION_OPTS,
} from "./HistoryTableParts";
import HistoryPagination from "./HistoryPagination";

import "./HistoryTable.css";

/**
 * HistoryTable
 * Tabel utama Review History — hanya render logic & layout.
 * Semua sub-komponen, badges, helpers, dan pagination sudah dipisah.
 *
 * Field yang dirender (sesuai BE ReviewHistoryItem schema):
 *   id, transaction_id, alert_id, decision, review_note,
 *   previous_status, final_status, reviewed_by, reviewer_name, created_at
 */
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
  onFiltersChange,
}) => {
  const { canManage } = useRole();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("createdAt-desc");
  const [filterDecision, setFilterDecision] = useState("all");

  // ─── Filter & Sort (client-side di atas 1 page data) ─────────────

  const processed = useMemo(() => {
    let result = [...data];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (r) =>
          r.transactionId?.toLowerCase().includes(q) ||
          String(r.alertId ?? "").includes(q) ||
          String(r.reviewedBy ?? "").includes(q) ||
          (r.reviewerName ?? "").toLowerCase().includes(q),
      );
    }

    if (filterDecision !== "all") {
      result = result.filter((r) => r.decision === filterDecision);
    }

    result.sort((a, b) =>
      sortKey === "createdAt-asc"
        ? new Date(a.createdAt) - new Date(b.createdAt)
        : new Date(b.createdAt) - new Date(a.createdAt),
    );

    return result;
  }, [data, search, sortKey, filterDecision]);

  const hasActiveFilters =
    search || filterDecision !== "all" || sortKey !== "createdAt-desc";

  const notifyFilters = (next) => {
    onFiltersChange?.(next);
  };

  const handleReset = () => {
    setSearch("");
    setSortKey("createdAt-desc");
    setFilterDecision("all");
    notifyFilters({ search: "", decision: "all", sortKey: "createdAt-desc" });
  };

  const handleGoToManagement = () => {
    navigate("/manual-review", { state: { activeTab: "management" } });
  };

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: "10px",
        overflow: "hidden",
      }}
    >
      {/* Banner canManage */}
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
            <strong>Fraud Analysts → Reviewer Operations</strong>.
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
        <div className="rh-search-wrap">
          <i className="bi bi-search rh-search-icon" />
          <input
            className="rh-search-input"
            placeholder="Cari Transaction ID, Alert ID, Reviewer..."
            value={search}
            onChange={(e) => {
              const value = e.target.value;
              setSearch(value);
              notifyFilters({ search: value, decision: filterDecision, sortKey });
            }}
          />
          {search && (
            <button className="rh-search-clear" onClick={() => {
              setSearch("");
              notifyFilters({ search: "", decision: filterDecision, sortKey });
            }}>
              <i className="bi bi-x" />
            </button>
          )}
        </div>

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
          onChange={(e) => {
            const value = e.target.value;
            setFilterDecision(value);
            notifyFilters({ search, decision: value, sortKey });
          }}
        >
          {DECISION_OPTS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        {hasActiveFilters && (
          <button className="rh-clear-all" onClick={handleReset}>
            <i className="bi bi-x-circle" /> Reset Filter
          </button>
        )}

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
            <p>Belum ada riwayat review</p>
            <span>
              Belum ada keputusan reviewer yang tercatat untuk filter ini.
            </span>
          </div>
        ) : (
          <table className="htable">
            <thead>
              <tr>
                <th>
                  <div className="htable-th-inner">
                    <span>Waktu</span>
                    <ColDropdown
                      options={TIMESTAMP_OPTS}
                      activeValue={sortKey}
                      onSelect={(value) => {
                        setSortKey(value);
                        notifyFilters({ search, decision: filterDecision, sortKey: value });
                      }}
                      isActive={sortKey !== "createdAt-desc"}
                    />
                  </div>
                </th>
                <th>
                  <div className="htable-th-inner">
                    <span>Transaction ID</span>
                  </div>
                </th>
                <th>
                  <div className="htable-th-inner">
                    <span>Alert ID</span>
                  </div>
                </th>
                <th>
                  <div className="htable-th-inner">
                    <span>Decision</span>
                    <ColDropdown
                      options={DECISION_OPTS}
                      activeValue={filterDecision}
                      onSelect={(value) => {
                        setFilterDecision(value);
                        notifyFilters({ search, decision: value, sortKey });
                      }}
                      isActive={filterDecision !== "all"}
                    />
                  </div>
                </th>
                <th className="hide-md">
                  <div className="htable-th-inner">
                    <span>Status</span>
                  </div>
                </th>
                <th className="hide-md">
                  <div className="htable-th-inner">
                    <span>Reviewer</span>
                  </div>
                </th>
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
                      <td>
                        <div className="hcell-ts">{fmtTs(item.createdAt)}</div>
                        <div className="hcell-ts-ago">
                          {timeAgo(item.createdAt)}
                        </div>
                      </td>
                      <td>
                        <span className="hcell-txnid">
                          {item.transactionId}
                        </span>
                      </td>
                      <td>
                        {item.alertId != null ? (
                          <span className="hcell-txnid">#{item.alertId}</span>
                        ) : (
                          <span className="hcell-empty">—</span>
                        )}
                      </td>
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
                      <td className="hide-md">
                        <ReviewerCell
                          reviewerName={item.reviewerName}
                          reviewedBy={item.reviewedBy}
                        />
                      </td>
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

      <HistoryPagination
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
