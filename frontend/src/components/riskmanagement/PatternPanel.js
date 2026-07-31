import React, { useState, useMemo, useEffect } from "react";
import "./PatternPanel.css";
import PatternDetailModal from "./PatternDetailModal";

const ACTION_CFG = {
  BLOCK: { cls: "act-block", icon: "bi-ban", label: "BLOCK" },
  FLAG: { cls: "act-flag", icon: "bi-flag-fill", label: "FLAG" },
};

const normalizeMitigationAction = (action) =>
  String(action || "FLAG").toUpperCase() === "BLOCK" ? "BLOCK" : "FLAG";

const STATUS_CFG = {
  active: { cls: "st-active", dot: "#16a34a", label: "Aktif" },
  inactive: { cls: "st-inactive", dot: "#9ca3af", label: "Kandidat" },
};

const LIFECYCLE = {
  MIN_SAMPLE: 5,
  DISABLE_THRESHOLD: 0.4,
  PROMOTE_THRESHOLD: 0.85,
  DISABLE_MIN_SAMPLE: 10,
  PROMOTE_MIN_SAMPLE: 20,
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
  const combinedRows = useMemo(
    () => [...enriched, ...enrichedCandidates],
    [enriched, enrichedCandidates],
  );
  const avgAccuracy = useMemo(() => {
    const values = combinedRows
      .map((p) => p.accuracy_score ?? p._eff?.accuracy_score)
      .filter((v) => typeof v === "number");
    if (values.length === 0) return null;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }, [combinedRows]);
  const highRiskCount = combinedRows.filter(
    (p) => (p.risk_score ?? 0) >= 70,
  ).length;
  const blockCount = data.filter((p) => p.action === "BLOCK").length;
  const topCandidate = useMemo(() => {
    return [...filteredCandidates].sort((a, b) => {
      const bAcc = b.accuracy_score ?? b._eff?.accuracy_score ?? 0;
      const aAcc = a.accuracy_score ?? a._eff?.accuracy_score ?? 0;
      return (b.risk_score ?? 0) + bAcc * 100 - ((a.risk_score ?? 0) + aAcc * 100);
    })[0];
  }, [filteredCandidates]);

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
  const accLabel = (v) => (v == null ? "â€”" : `${Math.round(v * 100)}%`);
  const scoreColor = (s) =>
    s >= 70 ? "#dc2626" : s >= 40 ? "#d97706" : "#16a34a";
  const performanceLabel = (value) =>
    value == null ? "Belum ada review" : accLabel(value);

  const summaryCards = [
    {
      icon: "bi-shield-check",
      label: "Pattern Aktif",
      value: data.length,
      meta: `${blockCount} auto-block`,
      tone: "green",
    },
    {
      icon: "bi-hourglass-split",
      label: "Antrian Review",
      value: candidates.length,
      meta: hasCandidates ? "Perlu keputusan" : "Tidak ada kandidat",
      tone: "amber",
    },
    {
      icon: "bi-speedometer2",
      label: "Rata-rata Precision",
      value: performanceLabel(avgAccuracy),
      meta: "Ketepatan dari feedback TP/FP",
      tone: "blue",
    },
    {
      icon: "bi-exclamation-octagon",
      label: "High Risk",
      value: highRiskCount,
      meta: "Risk score >= 70",
      tone: "red",
    },
  ];

  const renderPatternRow = (p) => {
    const act = ACTION_CFG[normalizeMitigationAction(p.action)];
    const st = p.is_active ? STATUS_CFG.active : STATUS_CFG.inactive;
    const eff = p._eff;
    const acc = p.accuracy_score ?? eff?.accuracy_score ?? null;
    const truePositive = eff?.true_positive ?? p.true_positive ?? 0;
    const falsePositive = eff?.false_positive ?? p.false_positive ?? 0;
    const hasFeedback = Number(truePositive) + Number(falsePositive) > 0;
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
          <div className="ptp-scope-cell">
            {p.pattern_category ? (
              <span className="ptp-cat-pill">{p.pattern_category}</span>
            ) : (
              <span className="ptp-muted">-</span>
            )}
            <span
              className={`ptp-svc ptp-svc--${(p.service_source || "all").toLowerCase()}`}
            >
              {p.service_source || "ALL"}
            </span>
          </div>
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
          <div className="ptp-performance">
            <span className="ptp-acc" style={{ color: accColor(acc) }}>
              {hasFeedback ? performanceLabel(acc) : "Belum ada review"}
            </span>
            <div className="ptp-tpfp">
              <span className="ptp-tp">
                TP {truePositive}
              </span>
              <span className="ptp-fp">
                FP {falsePositive}
              </span>
            </div>
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
      {/* Header */}
      <div className="ptp-toolbar">
        <div className="ptp-toolbar-left">
          <span className="ptp-title">
            <i className="bi bi-shield-shaded" /> Pattern Management
          </span>
          <span className="ptp-subtitle">
            Kelola pattern aktif, kandidat hasil review, dan lifecycle engine.
          </span>
        </div>
        <div className="ptp-toolbar-right">
          <button
            className="ptp-btn ghost"
            onClick={() => setShowLifecycle(true)}
            title="Info lifecycle engine"
          >
            <i className="bi bi-info-circle" /> Lifecycle
          </button>
          <button className="ptp-btn primary" onClick={onAdd}>
            <i className="bi bi-plus-lg" /> Tambah Pattern
          </button>
        </div>
      </div>

      <div className="ptp-filter-panel">
        <div className="ptp-filter-left">
          <div className="ptp-view-toggle" aria-label="Filter status pattern">
            {[
              ["all", "Semua"],
              ["active", "Aktif"],
              ["inactive", "Kandidat"],
            ].map(([value, label]) => (
              <button
                key={value}
                className={filterStatus === value ? "active" : ""}
                onClick={() => setFilterStatus(value)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>

          <div className="ptp-search">
            <i className="bi bi-search" />
            <input
              placeholder="Cari pattern..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                className="ptp-search-clear"
                type="button"
                onClick={() => setSearch("")}
                title="Bersihkan pencarian"
              >
                <i className="bi bi-x" />
              </button>
            )}
          </div>
        </div>

        <div className="ptp-filter-right">
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
        </div>
      </div>
      <div className="ptp-insight-grid">
        {summaryCards.map((card) => (
          <div className="ptp-insight-card" key={card.label}>
            <div className={`ptp-insight-icon ${card.tone}`}>
              <i className={`bi ${card.icon}`} />
            </div>
            <div>
              <span className="ptp-insight-value">{card.value}</span>
              <span className="ptp-insight-label">{card.label}</span>
              <span className="ptp-insight-meta">{card.meta}</span>
            </div>
          </div>
        ))}
      </div>

      {hasCandidates && filterStatus !== "active" && (
        <div className="ptp-review-callout">
          <div className="ptp-review-main">
            <div className="ptp-review-icon">
              <i className="bi bi-lightbulb" />
            </div>
            <div>
              <strong>{candidateCount} kandidat menunggu review.</strong>
              <span>
                Prioritaskan kandidat dengan risk score dan precision tertinggi
                sebelum diaktifkan ke engine.
              </span>
            </div>
          </div>
          {topCandidate && (
            <button
              className="ptp-review-btn"
              type="button"
              onClick={() => setDetailPattern(topCandidate)}
            >
              Review kandidat teratas
              <i className="bi bi-arrow-right" />
            </button>
          )}
        </div>
      )}

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
                  <th>Scope</th>
                  <th>Decision</th>
                  <th>Risk Score</th>
                  <th>Performance</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {paged.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
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
                {(safePage - 1) * PER_PAGE + 1}â€“
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
                    if (idx > 0 && p - arr[idx - 1] > 1) acc.push("â€¦");
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    p === "â€¦" ? (
                      <span key={`e${i}`} className="ptp-pg-ellipsis">
                        â€¦
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
                pattern yang sedang nonaktif. Cek precision, TP/FP, dan risk score
                sebelum diaktifkan ke engine.
              </p>
            </div>
            <div className="ptp-section-actions">
              <span className="ptp-section-badge">{candidateCount}</span>
              <button
                className={`ptp-btn secondary ${generating ? "ptp-btn--loading" : ""}`}
                onClick={onGenerate}
                disabled={generating}
                title="Generate pola kandidat dari review manual dan retraining"
              >
                {!generating && <i className="bi bi-stars" />}
                {generating ? "Generating..." : "Generate kandidat"}
              </button>
            </div>
          </div>
          <div className="ptp-table-scroll">
            <table className="ptp-table">
              <thead>
                <tr>
                  <th>Pattern</th>
                  <th>Scope</th>
                  <th>Decision</th>
                  <th>Risk Score</th>
                  <th>Performance</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {candidateCount === 0 ? (
                  <tr>
                    <td colSpan={7}>
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
                  label: "Auto-Promote menjadi BLOCK",
                  desc: `Pattern aktif dengan precision minimal ${LIFECYCLE.PROMOTE_THRESHOLD * 100}% dan minimal ${LIFECYCLE.PROMOTE_MIN_SAMPLE} sampel akan dipromosikan.`,
                },
                {
                  icon: "bi-shield-exclamation",
                  color: "#dc2626",
                  label: "Auto-Disable dan FLAG",
                  desc: `Pattern dengan precision di bawah ${LIFECYCLE.DISABLE_THRESHOLD * 100}% setelah minimal ${LIFECYCLE.DISABLE_MIN_SAMPLE} sampel akan dinonaktifkan dan aksinya menjadi FLAG.`,
                },
                {
                  icon: "bi-person-check",
                  color: "#2563eb",
                  label: "Aktivasi Terkendali",
                  desc: "Pattern nonaktif hanya dapat diaktifkan kembali oleh Risk Manager atau Super Admin melalui dashboard.",
                },
                {
                  icon: "bi-bar-chart-line",
                  color: "#d97706",
                  label: "Akumulasi Feedback",
                  desc: "Counter TP/FP diperbarui dari hasil Manual Review dan dikoreksi bila keputusan di-override.",
                },
                {
                  icon: "bi-database",
                  color: "#6d28d9",
                  label: "Min Sample Evaluasi",
                  desc: `Minimal ${LIFECYCLE.MIN_SAMPLE} sampel sebelum aksi lifecycle otomatis dipertimbangkan.`,
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
