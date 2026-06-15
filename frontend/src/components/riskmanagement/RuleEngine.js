import React, { useState, useMemo, useRef, useEffect } from "react";
import "./RuleEngine.css";

const PAGE_SIZE = 10;

const ACTION_CONFIG = {
  block: {
    label: "BLOKIR",
    cls: "act-block",
    icon: "bi-ban",
    condCls: "cond-block",
    order: 1,
  },
  flag: {
    label: "FLAG",
    cls: "act-flag",
    icon: "bi-flag-fill",
    condCls: "cond-flag",
    order: 2,
  },
  review: {
    label: "REVIEW",
    cls: "act-review",
    icon: "bi-clipboard-check",
    condCls: "cond-review",
    order: 3,
  },
};

const getPriorityCls = (p) => (p <= 3 ? "p-high" : p <= 6 ? "p-med" : "p-low");
const nextDir = (cur) => (cur === null ? "asc" : cur === "asc" ? "desc" : null);

const SortIcon = ({ dir }) => {
  if (dir === "asc") return <i className="bi bi-sort-up re-sort-icon active" />;
  if (dir === "desc")
    return <i className="bi bi-sort-down re-sort-icon active" />;
  return <i className="bi bi-arrow-down-up re-sort-icon" />;
};

const getHit = (rule, field) => rule[field] ?? rule.hitCount ?? 0;

const ColDropdown = ({ isOpen, onClose, children }) => {
  const ref = useRef();
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, onClose]);
  if (!isOpen) return null;
  return (
    <div className="re-col-dropdown" ref={ref}>
      {children}
    </div>
  );
};

const RuleEngine = ({ rules, onAdd, onEdit, onDelete, onToggle, onDetail }) => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const [sortKey, setSortKey] = useState(null);
  const [sortPDir, setSortPDir] = useState(null);
  const [filterAction, setFilterAction] = useState(null);
  const [sortHDir, setSortHDir] = useState(null);
  const [period, setPeriod] = useState(null);

  const [openDrop, setOpenDrop] = useState(null);

  const resetPage = () => setPage(1);
  const closeDrop = () => setOpenDrop(null);

  const toggleDrop = (name) => setOpenDrop((p) => (p === name ? null : name));

  const activeFilters = useMemo(() => {
    const chips = [];
    if (sortKey === "priority" && sortPDir)
      chips.push({
        key: "sort-p",
        label: `Prioritas: ${sortPDir === "asc" ? "Tertinggi (1)" : "Terendah (10)"}`,
        onRemove: () => {
          setSortPDir(null);
          setSortKey(null);
        },
      });
    if (filterAction)
      chips.push({
        key: "filter-a",
        label: `Aksi: ${ACTION_CONFIG[filterAction]?.label ?? filterAction}`,
        onRemove: () => setFilterAction(null),
      });
    if (sortKey === "hit") {
      if (sortHDir)
        chips.push({
          key: "sort-h",
          label: sortHDir === "desc" ? "Hit Terbanyak" : "Paling Sedikit",
          onRemove: () => {
            setSortHDir(null);
            setSortKey(null);
          },
        });
      if (period)
        chips.push({
          key: "period",
          label:
            period === "today"
              ? "Hari Ini"
              : period === "week"
                ? "Minggu Ini"
                : "Bulan Ini",
          onRemove: () => setPeriod(null),
        });
    } else if (period) {
      chips.push({
        key: "period",
        label:
          period === "today"
            ? "Hari Ini"
            : period === "week"
              ? "Minggu Ini"
              : "Bulan Ini",
        onRemove: () => setPeriod(null),
      });
    }
    return chips;
  }, [sortKey, sortPDir, filterAction, sortHDir, period]);

  const resetAll = () => {
    setSortKey(null);
    setSortPDir(null);
    setFilterAction(null);
    setSortHDir(null);
    setPeriod(null);
    setSearch("");
    resetPage();
  };

  const applyPSort = (dir) => {
    setSortPDir(dir);
    setSortHDir(null);
    setSortKey(dir ? "priority" : null);
    resetPage();
    closeDrop();
  };
  const applyAFilter = (val) => {
    setFilterAction((prev) => (prev === val ? null : val));
    resetPage();
    closeDrop();
  };
  const applyHSort = (dir) => {
    setSortHDir(dir);
    setSortPDir(null);
    setSortKey(dir ? "hit" : null);
    resetPage();
    closeDrop();
  };
  const applyPeriod = (val) => {
    setPeriod(val === period ? null : val);
    if (val && sortKey !== "hit") {
      setSortHDir("desc");
      setSortPDir(null);
      setSortKey("hit");
    }
    resetPage();
    closeDrop();
  };

  const hitField =
    period === "today"
      ? "hitToday"
      : period === "week"
        ? "hitWeek"
        : period === "month"
          ? "hitMonth"
          : "hitCount";
  const periodLabel =
    period === "today"
      ? "Hari Ini"
      : period === "week"
        ? "Minggu Ini"
        : period === "month"
          ? "Bulan Ini"
          : null;

  const processed = useMemo(() => {
    const q = search.toLowerCase();
    let result = (rules || []).filter(
      (r) =>
        (!q ||
          r.name.toLowerCase().includes(q) ||
          (r.description || "").toLowerCase().includes(q)) &&
        (!filterAction || r.action === filterAction),
    );
    if (sortKey === "priority" && sortPDir) {
      result = [...result].sort((a, b) =>
        sortPDir === "asc" ? a.priority - b.priority : b.priority - a.priority,
      );
    } else if (sortKey === "hit" && sortHDir) {
      result = [...result].sort((a, b) => {
        const ah = getHit(a, hitField);
        const bh = getHit(b, hitField);
        return sortHDir === "asc" ? ah - bh : bh - ah;
      });
    }
    return result;
  }, [rules, search, sortKey, sortPDir, filterAction, sortHDir, hitField]);

  const totalPages = Math.max(1, Math.ceil(processed.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const rows = processed.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  const isHitActive = sortKey === "hit" && (sortHDir || period);
  const isPActive = sortKey === "priority" && sortPDir;
  const isAActive = Boolean(filterAction);

  return (
    <div className="re-wrap">
      <div className="re-toolbar">
        <div className="re-toolbar-left">
          <span className="re-title">
            Rule Engine — Deteksi Berbasis Aturan
            <span style={{ color: "#9ca3af", fontWeight: 400, marginLeft: 6 }}>
              ({(rules || []).filter((r) => r.enabled).length} aktif /{" "}
              {(rules || []).length} total)
            </span>
          </span>
          <span className="re-subtitle">
            Transaksi yang cocok akan otomatis diblokir, diflag, atau dikirim ke
            Manual Review
          </span>
        </div>
        <div className="re-toolbar-right">
          <div className="re-search">
            <i className="bi bi-search" />
            <input
              type="text"
              placeholder="Cari nama rule..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                resetPage();
              }}
            />
            {search && (
              <button
                className="re-search-clear"
                onClick={() => {
                  setSearch("");
                  resetPage();
                }}
                title="Hapus pencarian"
              >
                <i className="bi bi-x" />
              </button>
            )}
          </div>
          <button className="re-btn primary" onClick={onAdd}>
            <i className="bi bi-plus-lg" /> Tambah Rule
          </button>
        </div>
      </div>

      {(activeFilters.length > 0 || search) && (
        <div className="re-filter-bar">
          <span className="re-filter-bar-label">
            <i className="bi bi-funnel-fill" /> Filter aktif:
          </span>
          {search && (
            <span className="re-filter-chip">
              <i className="bi bi-search" /> "{search}"
              <button
                onClick={() => {
                  setSearch("");
                  resetPage();
                }}
              >
                <i className="bi bi-x" />
              </button>
            </span>
          )}
          {activeFilters.map((f) => (
            <span key={f.key} className="re-filter-chip">
              {f.label}
              <button
                onClick={() => {
                  f.onRemove();
                  resetPage();
                }}
              >
                <i className="bi bi-x" />
              </button>
            </span>
          ))}
          <button className="re-filter-reset" onClick={resetAll}>
            <i className="bi bi-arrow-counterclockwise" /> Reset semua
          </button>
        </div>
      )}

      <div className="re-table-scroll">
        <table className="re-table">
          <thead>
            <tr>
              <th style={{ position: "relative" }}>
                <button
                  className={`re-sort-th${isPActive ? " re-sort-th--active" : ""}`}
                  onClick={() => toggleDrop("P")}
                  title="Filter Prioritas"
                >
                  Prioritas{" "}
                  <SortIcon dir={sortKey === "priority" ? sortPDir : null} />
                </button>
                <ColDropdown isOpen={openDrop === "P"} onClose={closeDrop}>
                  <div className="re-col-drop-title">Urutkan Prioritas</div>
                  <button
                    className={`re-col-drop-item${sortPDir === "asc" && sortKey === "priority" ? " selected" : ""}`}
                    onClick={() => applyPSort("asc")}
                  >
                    <i className="bi bi-sort-numeric-up" /> Tertinggi (1 → 10)
                  </button>
                  <button
                    className={`re-col-drop-item${sortPDir === "desc" && sortKey === "priority" ? " selected" : ""}`}
                    onClick={() => applyPSort("desc")}
                  >
                    <i className="bi bi-sort-numeric-down-alt" /> Terendah (10 →
                    1)
                  </button>
                  {sortKey === "priority" && sortPDir && (
                    <button
                      className="re-col-drop-item re-col-drop-clear"
                      onClick={() => applyPSort(null)}
                    >
                      <i className="bi bi-x-circle" /> Hapus filter
                    </button>
                  )}
                </ColDropdown>
              </th>

              <th>Nama Rule</th>
              <th>Kondisi</th>

              <th style={{ position: "relative" }}>
                <button
                  className={`re-sort-th${isAActive ? " re-sort-th--active" : ""}`}
                  onClick={() => toggleDrop("Aksi")}
                  title="Filter Aksi"
                >
                  Aksi{" "}
                  <i
                    className={`bi bi-funnel${filterAction ? "-fill" : ""} re-sort-icon${filterAction ? " active" : ""}`}
                    style={{ fontSize: "0.75rem" }}
                  />
                </button>
                <ColDropdown isOpen={openDrop === "Aksi"} onClose={closeDrop}>
                  <div className="re-col-drop-title">Filter Aksi</div>
                  {[
                    { val: "block", label: "Blokir", icon: "bi-ban" },
                    { val: "flag", label: "Flag", icon: "bi-flag-fill" },
                    {
                      val: "review",
                      label: "Review",
                      icon: "bi-clipboard-check",
                    },
                  ].map((o) => (
                    <button
                      key={o.val}
                      className={`re-col-drop-item${filterAction === o.val ? " selected" : ""}`}
                      onClick={() => applyAFilter(o.val)}
                    >
                      <i className={`bi ${o.icon}`} /> {o.label}
                    </button>
                  ))}
                  {filterAction && (
                    <button
                      className="re-col-drop-item re-col-drop-clear"
                      onClick={() => {
                        setFilterAction(null);
                        closeDrop();
                        resetPage();
                      }}
                    >
                      <i className="bi bi-x-circle" /> Hapus filter
                    </button>
                  )}
                </ColDropdown>
              </th>

              <th style={{ position: "relative" }}>
                <button
                  className={`re-sort-th${isHitActive ? " re-sort-th--active" : ""}`}
                  onClick={() => toggleDrop("Hit")}
                  title="Filter Hit"
                >
                  <span className="re-hit-th-label">
                    Total Hit
                    {periodLabel && (
                      <span className="re-hit-period-badge">{periodLabel}</span>
                    )}
                  </span>
                  <SortIcon dir={sortKey === "hit" ? sortHDir : null} />
                </button>
                <ColDropdown isOpen={openDrop === "Hit"} onClose={closeDrop}>
                  <div className="re-col-drop-title">Urutkan Hit</div>
                  <button
                    className={`re-col-drop-item${sortHDir === "desc" && sortKey === "hit" ? " selected" : ""}`}
                    onClick={() => applyHSort("desc")}
                  >
                    <i className="bi bi-sort-numeric-down-alt" /> Hit Terbanyak
                  </button>
                  <button
                    className={`re-col-drop-item${sortHDir === "asc" && sortKey === "hit" ? " selected" : ""}`}
                    onClick={() => applyHSort("asc")}
                  >
                    <i className="bi bi-sort-numeric-up" /> Paling Sedikit
                  </button>
                  <div className="re-col-drop-divider" />
                  <div className="re-col-drop-title">Periode</div>
                  {[
                    { val: "today", label: "Hari Ini", icon: "bi-sun" },
                    {
                      val: "week",
                      label: "Minggu Ini",
                      icon: "bi-calendar-week",
                    },
                    {
                      val: "month",
                      label: "Bulan Ini",
                      icon: "bi-calendar-month",
                    },
                  ].map((o) => (
                    <button
                      key={o.val}
                      className={`re-col-drop-item${period === o.val ? " selected" : ""}`}
                      onClick={() => applyPeriod(o.val)}
                    >
                      <i className={`bi ${o.icon}`} /> {o.label}
                    </button>
                  ))}
                  {(sortKey === "hit" || period) && (
                    <button
                      className="re-col-drop-item re-col-drop-clear"
                      onClick={() => {
                        setSortHDir(null);
                        setPeriod(null);
                        setSortKey(null);
                        closeDrop();
                        resetPage();
                      }}
                    >
                      <i className="bi bi-x-circle" /> Hapus filter
                    </button>
                  )}
                </ColDropdown>
              </th>

              <th>Dibuat</th>
              <th>Aktif</th>
              <th>Kelola</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <div className="re-empty">
                    {search ? (
                      <>
                        <i className="bi bi-search" />
                        <p>
                          Tidak ada rule yang cocok dengan{" "}
                          <strong>"{search}"</strong>.
                        </p>
                      </>
                    ) : (
                      <>
                        <i className="bi bi-gear" />
                        <p>Belum ada rule. Tambah rule pertama kamu.</p>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((rule) => {
                const act = ACTION_CONFIG[rule.action] || ACTION_CONFIG.flag;
                const displayHit = getHit(rule, hitField);
                return (
                  <tr
                    key={rule.id}
                    style={{
                      opacity: rule.enabled ? 1 : 0.5,
                      cursor: "pointer",
                    }}
                    className="re-row-clickable"
                    onClick={() => onDetail && onDetail(rule)}
                  >
                    <td onClick={(e) => e.stopPropagation()}>
                      <span
                        className={`re-priority ${getPriorityCls(rule.priority)}`}
                      >
                        {rule.priority}
                      </span>
                    </td>
                    <td>
                      <div className="re-rule-name">
                        <span className="re-name-text">{rule.name}</span>
                        <span className="re-name-desc">{rule.description}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`re-condition ${act.condCls}`}>
                        <i className={`bi ${act.icon}`} /> {rule.condition}
                      </span>
                    </td>
                    <td>
                      <span className={`re-action ${act.cls}`}>
                        <i className={`bi ${act.icon}`} /> {act.label}
                      </span>
                    </td>
                    <td>
                      <div className="re-hit-cell">
                        <span
                          className={`re-hit ${displayHit === 0 ? "zero" : ""}`}
                        >
                          {displayHit === 0
                            ? "—"
                            : displayHit.toLocaleString("id-ID")}
                        </span>
                        {period && displayHit > 0 && (
                          <span className="re-hit-sub">{periodLabel}</span>
                        )}
                      </div>
                    </td>
                    <td
                      style={{
                        fontSize: ".78rem",
                        color: "#9ca3af",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {rule.createdAt}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <label className="re-toggle">
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          onChange={() => onToggle(rule.id)}
                        />
                        <span className="re-toggle-track" />
                      </label>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="re-actions">
                        <button
                          className="re-action-btn detail"
                          title="Lihat detail rule"
                          onClick={() => onDetail && onDetail(rule)}
                        >
                          <i className="bi bi-eye" />
                        </button>
                        <button
                          className="re-action-btn edit"
                          title="Edit rule"
                          onClick={() => onEdit(rule)}
                        >
                          <i className="bi bi-pencil" />
                        </button>
                        <button
                          className="re-action-btn del"
                          title="Hapus rule"
                          onClick={() => onDelete(rule.id)}
                        >
                          <i className="bi bi-trash" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="re-pagination">
        <span>
          {processed.length === 0
            ? "Tidak ada data"
            : `${Math.min((safePage - 1) * PAGE_SIZE + 1, processed.length)}–${Math.min(safePage * PAGE_SIZE, processed.length)} dari ${processed.length}`}
        </span>
        <div className="re-pg-btns">
          <button
            className="re-pg-btn"
            disabled={safePage === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <i className="bi bi-chevron-left" />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(
              (p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1,
            )
            .reduce((acc, p, idx, arr) => {
              if (idx > 0 && p - arr[idx - 1] > 1) acc.push("…");
              acc.push(p);
              return acc;
            }, [])
            .map((p, idx) =>
              p === "…" ? (
                <span
                  key={`e${idx}`}
                  style={{
                    padding: "0 3px",
                    color: "#9ca3af",
                    fontSize: "0.75rem",
                  }}
                >
                  …
                </span>
              ) : (
                <button
                  key={p}
                  className={`re-pg-btn ${safePage === p ? "active" : ""}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              ),
            )}
          <button
            className="re-pg-btn"
            disabled={safePage === totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            <i className="bi bi-chevron-right" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default RuleEngine;
