import React, { useState, useMemo, useRef, useEffect } from "react";
import "./PatternPanel.css";
import PatternDetailModal from "./PatternDetailModal";

const ACTION_CFG = {
  BLOCK: { cls: "act-block", icon: "bi-ban", label: "BLOCK" },
  REVIEW: { cls: "act-review", icon: "bi-eye", label: "REVIEW" },
  FLAG: { cls: "act-flag", icon: "bi-flag-fill", label: "FLAG" },
};

const STATUS_CFG = {
  active: { cls: "st-active", dot: "#16a34a", label: "Aktif" },
  inactive: { cls: "st-inactive", dot: "#9ca3af", label: "Nonaktif" },
};

const LIFECYCLE = {
  MIN_SAMPLE: 5,
  DISABLE_THRESHOLD: 0.4,
  PROMOTE_THRESHOLD: 0.85,
  DISABLE_MIN_SAMPLE: 10,
  PROMOTE_MIN_SAMPLE: 20,
  COOLDOWN_DAYS: 7,
};

const PatternPanel = ({
  data = [],
  candidates = [],
  effectiveness = [],
  onAdd,
  onEdit,
  onActivate,
  onDeactivate,
  onDelete,
  onGenerate,
  generating,
}) => {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCat, setFilterCat] = useState("");
  const [filterSvc, setFilterSvc] = useState("");
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [detailPattern, setDetailPattern] = useState(null);
  const [showLifecycle, setShowLifecycle] = useState(false);
  const PER_PAGE = 10;

  // Join effectiveness by pattern_name
  const effMap = useMemo(() => {
    const m = {};
    effectiveness.forEach((e) => {
      m[e.pattern_name] = e;
    });
    return m;
  }, [effectiveness]);

  const enriched = useMemo(
    () => data.map((p) => ({ ...p, _eff: effMap[p.pattern_name] || null })),
    [data, effMap],
  );

  const categories = useMemo(
    () => [
      ...new Set(
        [...data, ...candidates].map((p) => p.pattern_category).filter(Boolean),
      ),
    ],
    [data, candidates],
  );

  const enrichedCandidates = useMemo(
    () =>
      candidates.map((p) => ({
        ...p,
        _eff: effMap[p.pattern_name] || null,
        _isCandidate: true,
      })),
    [candidates, effMap],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return enriched.filter((p) => {
      if (
        q &&
        !p.pattern_name.toLowerCase().includes(q) &&
        !(p.pattern_category || "").toLowerCase().includes(q)
      )
        return false;
      if (filterStatus === "active" && !p.is_active) return false;
      if (filterStatus === "inactive" && p.is_active) return false;
      if (filterCat && p.pattern_category !== filterCat) return false;
      if (filterSvc && p.service_source !== filterSvc) return false;
      return true;
    });
  }, [enriched, search, filterStatus, filterCat, filterSvc]);

  const filteredCandidates = useMemo(() => {
    const q = search.toLowerCase();
    return enrichedCandidates.filter((p) => {
      if (
        q &&
        !p.pattern_name.toLowerCase().includes(q) &&
        !(p.pattern_category || "").toLowerCase().includes(q)
      )
        return false;
      if (filterCat && p.pattern_category !== filterCat) return false;
      if (filterSvc && p.service_source !== filterSvc) return false;
      return true;
    });
  }, [enrichedCandidates, search, filterCat, filterSvc]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);
  const candidateCount = filteredCandidates.length;
  const hasCandidates = candidateCount > 0;

  useEffect(() => {
    setPage(1);
  }, [search, filterStatus, filterCat, filterSvc]);

  const activeFilters = [
    filterStatus !== "all" && {
      key: "status",
      label: `Status: ${filterStatus}`,
    },
    filterCat && { key: "cat", label: `Kategori: ${filterCat}` },
    filterSvc && { key: "svc", label: `Service: ${filterSvc}` },
  ].filter(Boolean);

  const resetAll = () => {
    setFilterStatus("all");
    setFilterCat("");
    setFilterSvc("");
    setSearch("");
  };

  const accColor = (v) =>
    v == null
      ? "#9ca3af"
      : v >= 0.85
        ? "#16a34a"
        : v >= 0.6
          ? "#d97706"
          : "#dc2626";
  const accLabel = (v) => (v == null ? "—" : `${Math.round(v * 100)}%`);
  const scoreColor = (s) =>
    s >= 70 ? "#dc2626" : s >= 40 ? "#d97706" : "#16a34a";

  const renderPatternRow = (p) => {
    const act = ACTION_CFG[p.action] || ACTION_CFG.FLAG;
    const st = p.is_active ? STATUS_CFG.active : STATUS_CFG.inactive;
    const eff = p._eff;
    const acc = p.accuracy_score ?? eff?.accuracy_score ?? null;
    const isCandidate = Boolean(p._isCandidate);

    return (
      <tr
        key={p.id}
        className={`ptp-row${isCandidate ? " ptp-row--candidate" : ""}`}
      >
        <td>
          <div className="ptp-pattern-name">{p.pattern_name}</div>
          <div className="ptp-pattern-prio">prioritas {p.priority}</div>
        </td>
        <td>
          {p.pattern_category ? (
            <span className="ptp-cat-pill">{p.pattern_category}</span>
          ) : (
            <span className="ptp-muted">—</span>
          )}
        </td>
        <td>
          <span
            className={`ptp-svc ptp-svc--${(p.service_source || "all").toLowerCase()}`}
          >
            {p.service_source || "ALL"}
          </span>
        </td>
        <td>
          <span className={`ptp-action ${act.cls}`}>
            <i className={`bi ${act.icon}`} />
            {act.label}
          </span>
        </td>
        <td>
          <span
            className="ptp-score"
            style={{ color: scoreColor(p.risk_score) }}
          >
            {p.risk_score}
          </span>
        </td>
        <td>
          <span className="ptp-acc" style={{ color: accColor(acc) }}>
            {accLabel(acc)}
          </span>
        </td>
        <td>
          <div className="ptp-tpfp">
            <span className="ptp-tp">
              TP {eff?.true_positive ?? p.true_positive ?? 0}
            </span>
            <span className="ptp-fp">
              FP {eff?.false_positive ?? p.false_positive ?? 0}
            </span>
          </div>
        </td>
        <td>
          <span className={`ptp-status ${st.cls}`}>
            <span className="ptp-status-dot" style={{ background: st.dot }} />
            {st.label}
          </span>
        </td>
        <td>
          <div className="ptp-actions">
            <button
              className="ptp-action-btn detail"
              title="Lihat detail"
              onClick={() => setDetailPattern(p)}
            >
              <i className="bi bi-eye" />
            </button>
            <button
              className="ptp-action-btn edit"
              title="Edit"
              onClick={() => onEdit(p)}
            >
              <i className="bi bi-pencil" />
            </button>

            {p.is_active ? (
              <button
                className="ptp-action-btn deactivate"
                title="Nonaktifkan"
                onClick={() => onDeactivate(p.id)}
              >
                <i className="bi bi-pause-circle" />
              </button>
            ) : (
              <button
                className={`ptp-action-btn activate${isCandidate ? " candidate-activate" : ""}`}
                title={isCandidate ? "Aktifkan kandidat" : "Aktifkan"}
                onClick={() => onActivate(p.id)}
              >
                <i
                  className={`bi ${isCandidate ? "bi-check-circle" : "bi-play-circle"}`}
                />
              </button>
            )}

            <button
              className="ptp-action-btn del"
              title="Hapus"
              onClick={() => setDeleteTarget(p)}
            >
              <i className="bi bi-trash3" />
            </button>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="ptp-wrap">
      {/* Toolbar */}
      <div className="ptp-toolbar">
        <div className="ptp-toolbar-left">
          <span className="ptp-title">Pattern Management</span>
          <span className="ptp-subtitle">
            {data.length} aktif / {candidates.length} kandidat
          </span>
        </div>
        <div className="ptp-toolbar-right">
          <div className="ptp-search">
            <i className="bi bi-search" />
            <input
              placeholder="Cari pattern..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Filter status */}
          <div className="ptp-select-wrap">
            <select
              className="ptp-select"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">Semua status</option>
              <option value="active">Aktif</option>
              <option value="inactive">Kandidat</option>
            </select>
          </div>

          {/* Filter kategori */}
          <div className="ptp-select-wrap">
            <select
              className="ptp-select"
              value={filterCat}
              onChange={(e) => setFilterCat(e.target.value)}
            >
              <option value="">Semua kategori</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Filter service */}
          <div className="ptp-select-wrap">
            <select
              className="ptp-select"
              value={filterSvc}
              onChange={(e) => setFilterSvc(e.target.value)}
            >
              <option value="">Semua service</option>
              <option value="ALL">ALL</option>
              <option value="AGENUSA">AGENUSA</option>
              <option value="NUSABILL">NUSABILL</option>
            </select>
          </div>

          <button
            className="ptp-btn secondary"
            onClick={() => setShowLifecycle(true)}
            title="Info lifecycle engine"
          >
            <i className="bi bi-info-circle" /> Lifecycle
          </button>

          <button
            className={`ptp-btn secondary ${generating ? "ptp-btn--loading" : ""}`}
            onClick={onGenerate}
            disabled={generating}
            title="Generate pola kandidat dari review manual dan retraining"
          >
            {!generating && <i className="bi bi-stars" />}
            {generating ? "Generating..." : "Generate kandidat"}
          </button>

          <button className="ptp-btn primary" onClick={onAdd}>
            <i className="bi bi-plus-lg" /> Tambah Pattern
          </button>
        </div>
      </div>

      {/* Active filters */}
      {activeFilters.length > 0 && (
        <div className="ptp-filter-bar">
          <span className="ptp-filter-bar-label">
            <i className="bi bi-funnel-fill" /> Filter:
          </span>
          {activeFilters.map((f) => (
            <span key={f.key} className="ptp-filter-chip">
              {f.label}
              <button
                onClick={() => {
                  if (f.key === "status") setFilterStatus("all");
                  if (f.key === "cat") setFilterCat("");
                  if (f.key === "svc") setFilterSvc("");
                }}
              >
                <i className="bi bi-x" />
              </button>
            </span>
          ))}
          <button className="ptp-filter-reset" onClick={resetAll}>
            <i className="bi bi-x-circle" /> Reset
          </button>
        </div>
      )}

      {(filterStatus === "all" || filterStatus === "active") && (
        <>
          <div className="ptp-section-header">
            <span className="ptp-section-title">Daftar Pattern Aktif</span>
            <span className="ptp-section-badge">{filtered.length}</span>
          </div>
          <div className="ptp-table-scroll">
            <table className="ptp-table">
              <thead>
                <tr>
                  <th>Pattern</th>
                  <th>Kategori</th>
                  <th>Service</th>
                  <th>Action</th>
                  <th>Risk Score</th>
                  <th>Akurasi</th>
                  <th>TP / FP</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {paged.length === 0 ? (
                  <tr>
                    <td colSpan={9}>
                      <div className="ptp-empty">
                        <i className="bi bi-shield-slash" />
                        <p>Tidak ada pattern ditemukan.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paged.map((p) => renderPatternRow(p))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="ptp-pagination">
              <span>
                {(safePage - 1) * PER_PAGE + 1}–
                {Math.min(safePage * PER_PAGE, filtered.length)} dari{" "}
                {filtered.length}
              </span>
              <div className="ptp-pg-btns">
                <button
                  className="ptp-pg-btn"
                  disabled={safePage === 1}
                  onClick={() => setPage(safePage - 1)}
                >
                  <i className="bi bi-chevron-left" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(
                    (p) =>
                      p === 1 ||
                      p === totalPages ||
                      Math.abs(p - safePage) <= 1,
                  )
                  .reduce((acc, p, idx, arr) => {
                    if (idx > 0 && p - arr[idx - 1] > 1) acc.push("…");
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    p === "…" ? (
                      <span key={`e${i}`} className="ptp-pg-ellipsis">
                        …
                      </span>
                    ) : (
                      <button
                        key={p}
                        className={`ptp-pg-btn ${p === safePage ? "active" : ""}`}
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </button>
                    ),
                  )}
                <button
                  className="ptp-pg-btn"
                  disabled={safePage === totalPages}
                  onClick={() => setPage(safePage + 1)}
                >
                  <i className="bi bi-chevron-right" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {(filterStatus === "all" || filterStatus === "inactive") && (
        <div className="ptp-candidate-section">
          <div className="ptp-section-header">
            <div>
              <span className="ptp-section-title">Pattern Kandidat</span>
              <p className="ptp-section-note">
                Pattern ini berasal dari review manual, proses retraining, atau
                status nonaktif. Aktifkan untuk menambahkannya ke daftar pattern
                aktif.
              </p>
            </div>
            <span className="ptp-section-badge">{candidateCount}</span>
          </div>
          <div className="ptp-table-scroll">
            <table className="ptp-table">
              <thead>
                <tr>
                  <th>Pattern</th>
                  <th>Kategori</th>
                  <th>Service</th>
                  <th>Action</th>
                  <th>Risk Score</th>
                  <th>Akurasi</th>
                  <th>TP / FP</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {candidateCount === 0 ? (
                  <tr>
                    <td colSpan={9}>
                      <div className="ptp-empty">
                        <i className="bi bi-shield-slash" />
                        <p>Tidak ada pattern kandidat.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredCandidates.map((p) => renderPatternRow(p))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {totalPages > 1 && (
        <div className="ptp-pagination">
          <span>
            {(safePage - 1) * PER_PAGE + 1}–
            {Math.min(safePage * PER_PAGE, filtered.length)} dari{" "}
            {filtered.length}
          </span>
          <div className="ptp-pg-btns">
            <button
              className="ptp-pg-btn"
              disabled={safePage === 1}
              onClick={() => setPage(safePage - 1)}
            >
              <i className="bi bi-chevron-left" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(
                (p) =>
                  p === 1 || p === totalPages || Math.abs(p - safePage) <= 1,
              )
              .reduce((acc, p, idx, arr) => {
                if (idx > 0 && p - arr[idx - 1] > 1) acc.push("…");
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === "…" ? (
                  <span key={`e${i}`} className="ptp-pg-ellipsis">
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    className={`ptp-pg-btn ${p === safePage ? "active" : ""}`}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </button>
                ),
              )}
            <button
              className="ptp-pg-btn"
              disabled={safePage === totalPages}
              onClick={() => setPage(safePage + 1)}
            >
              <i className="bi bi-chevron-right" />
            </button>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div
          className="ptp-del-overlay"
          onClick={(e) => e.target === e.currentTarget && setDeleteTarget(null)}
        >
          <div className="ptp-del-box">
            <div className="ptp-del-icon">
              <i className="bi bi-exclamation-triangle-fill" />
            </div>
            <h3 className="ptp-del-title">Hapus Pattern?</h3>
            <p className="ptp-del-msg">
              Pattern <strong>"{deleteTarget.pattern_name}"</strong> akan
              dinonaktifkan (soft delete). Pattern tidak akan dievaluasi engine.
            </p>
            <div className="ptp-del-actions">
              <button
                className="ptp-del-btn-cancel"
                onClick={() => setDeleteTarget(null)}
              >
                <i className="bi bi-arrow-left" /> Batal
              </button>
              <button
                className="ptp-del-btn-confirm"
                onClick={() => {
                  onDelete(deleteTarget.id);
                  setDeleteTarget(null);
                }}
              >
                <i className="bi bi-trash3-fill" /> Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lifecycle info modal */}
      {showLifecycle && (
        <div
          className="ptp-del-overlay"
          onClick={(e) =>
            e.target === e.currentTarget && setShowLifecycle(false)
          }
        >
          <div className="ptp-lc-box">
            <div className="ptp-lc-header">
              <span className="ptp-lc-title">
                <i className="bi bi-arrow-repeat" /> Lifecycle Engine
              </span>
              <button
                className="pfm-close"
                onClick={() => setShowLifecycle(false)}
              >
                <i className="bi bi-x-lg" />
              </button>
            </div>
            <div className="ptp-lc-grid">
              {[
                {
                  icon: "bi-shield-check",
                  color: "#16a34a",
                  label: "Auto-Promote → BLOCK",
                  desc: `Akurasi ≥ ${LIFECYCLE.PROMOTE_THRESHOLD * 100}% dengan min ${LIFECYCLE.PROMOTE_MIN_SAMPLE} sample`,
                },
                {
                  icon: "bi-shield-exclamation",
                  color: "#dc2626",
                  label: "Auto-Disable → FLAG",
                  desc: `Akurasi < ${LIFECYCLE.DISABLE_THRESHOLD * 100}% dengan min ${LIFECYCLE.DISABLE_MIN_SAMPLE} sample`,
                },
                {
                  icon: "bi-arrow-repeat",
                  color: "#2563eb",
                  label: "Cooldown Reaktivasi",
                  desc: `${LIFECYCLE.COOLDOWN_DAYS} hari setelah disabled_at, pattern di-reactivate otomatis`,
                },
                {
                  icon: "bi-graph-down",
                  color: "#d97706",
                  label: "Decay TP/FP",
                  desc: `Tiap lifecycle × ${LIFECYCLE.DECAY_RATE ?? 0.98} — mencegah data lama terlalu mendominasi`,
                },
                {
                  icon: "bi-database",
                  color: "#6d28d9",
                  label: "Min Sample Evaluasi",
                  desc: `${LIFECYCLE.MIN_SAMPLE} sample minimum sebelum lifecycle dievaluasi`,
                },
              ].map((item) => (
                <div key={item.label} className="ptp-lc-item">
                  <div
                    className="ptp-lc-icon"
                    style={{ background: `${item.color}18`, color: item.color }}
                  >
                    <i className={`bi ${item.icon}`} />
                  </div>
                  <div>
                    <div className="ptp-lc-item-label">{item.label}</div>
                    <div className="ptp-lc-item-desc">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <PatternDetailModal
        isOpen={Boolean(detailPattern)}
        pattern={detailPattern}
        onClose={() => setDetailPattern(null)}
        onEdit={(p) => {
          onEdit(p);
          setDetailPattern(null);
        }}
        onActivate={(id) => {
          onActivate(id);
          setDetailPattern(null);
        }}
        onDeactivate={(id) => {
          onDeactivate(id);
          setDetailPattern(null);
        }}
      />
    </div>
  );
};

export default PatternPanel;
