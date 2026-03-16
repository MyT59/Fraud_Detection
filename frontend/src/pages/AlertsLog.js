import React, { useState, useMemo, useEffect, useCallback } from "react";
import AlertsHeader from "../components/alerts/AlertsHeader";
import AlertsStats  from "../components/alerts/AlertsStats";
import AlertsFilter from "../components/alerts/AlertsFilter";
import AlertsFeed   from "../components/alerts/AlertsFeed";
import PageLoader   from "../components/common/PageLoader";
import { SEED_ALERTS } from "../components/alerts/alertsData";
import "./AlertsLog.css";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8000";

const DEFAULT_FILTERS = { search: "", type: "all", severity: "all", status: "all" };

const AlertsLog = () => {
  const [loading,    setLoading]    = useState(true);
  const [apiAlerts,  setApiAlerts]  = useState(null);   // null = belum load
  const [apiStats,   setApiStats]   = useState(null);
  const [apiError,   setApiError]   = useState(false);
  const [filters,    setFilters]    = useState(DEFAULT_FILTERS);

  // State lokal untuk dismiss / resolve / mark-read (tidak disimpan ke backend)
  const [localOverride, setLocalOverride] = useState({});  // id → { status }

  // ── Fetch dari API ────────────────────────────────────────────────────────
  const fetchAlerts = useCallback(async (signal) => {
    setLoading(true);
    setApiError(false);
    try {
      const [feedRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/alerts/feed?limit=200`, { signal }),
        fetch(`${API_BASE}/alerts/stats`,          { signal }),
      ]);
      if (!feedRes.ok || !statsRes.ok) throw new Error("HTTP error");
      const feed  = await feedRes.json();
      const stats = await statsRes.json();
      setApiAlerts(feed.alerts || []);
      setApiStats(stats);
    } catch (err) {
      if (err.name === "AbortError") return;
      console.warn("[AlertsLog] API offline, pakai seed data.", err.message);
      setApiError(true);
      setApiAlerts(null);
      setApiStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchAlerts(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchAlerts]);

  // ── Merge API / fallback + local overrides ────────────────────────────────
  const baseAlerts = apiAlerts ?? SEED_ALERTS;
  const alerts = useMemo(() => {
    const seen = new Set();
    return baseAlerts
      .map(a => localOverride[a.id] ? { ...a, ...localOverride[a.id] } : a)
      .filter(a => {
        if (seen.has(a.id)) return false;
        seen.add(a.id);
        return true;
      });
  }, [baseAlerts, localOverride]);

  // ── Stats: API stats override saat live, hitung ulang kalau ada local changes ──
  const computedStats = useMemo(() => ({
    total:    alerts.length,
    critical: alerts.filter(a => a.severity === "critical").length,
    unread:   alerts.filter(a => a.status   === "unread").length,
    resolved: alerts.filter(a => a.status   === "resolved").length,
  }), [alerts]);

  const displayStats = apiStats && !Object.keys(localOverride).length
    ? apiStats
    : computedStats;

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return alerts.filter(a => {
      if (filters.type     !== "all" && a.type     !== filters.type)     return false;
      if (filters.severity !== "all" && a.severity !== filters.severity) return false;
      if (filters.status   !== "all" && a.status   !== filters.status)   return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (
          !a.title.toLowerCase().includes(q) &&
          !(a.message || "").toLowerCase().includes(q) &&
          !(a.txnId   || "").toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [alerts, filters]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const patchLocal = (id, patch) =>
    setLocalOverride(prev => ({ ...prev, [id]: { ...(prev[id] || {}), ...patch } }));

  const handleMarkRead  = id => patchLocal(id, { status: "read" });
  const handleResolve   = id => patchLocal(id, { status: "resolved" });
  const handleDelete    = id =>
    setLocalOverride(prev => ({ ...prev, [id]: { ...prev[id], _deleted: true } }));

  const handleMarkAllRead = () => {
    const patch = {};
    alerts.forEach(a => { if (a.status === "unread") patch[a.id] = { status: "read" }; });
    setLocalOverride(prev => ({ ...prev, ...patch }));
  };

  const handleClearAll = () => {
    const patch = {};
    alerts.forEach(a => { patch[a.id] = { _deleted: true }; });
    setLocalOverride(prev => ({ ...prev, ...patch }));
  };

  // Filter out deleted
  const visibleFiltered = filtered.filter(a => !localOverride[a.id]?._deleted);

  const totalUnread = alerts.filter(
    a => a.status === "unread" && !localOverride[a.id]?._deleted
  ).length;

  if (loading) return <PageLoader message="Memuat Alerts Log..." />;

  return (
    <div className="alerts-page">

      {/* API error banner */}
      {apiError && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "10px 16px", marginBottom: 16, borderRadius: 8,
          background: "#fffbeb", border: "1px solid #fde68a",
          fontSize: "0.85rem", color: "#92400e",
        }}>
          <i className="bi bi-wifi-off"></i>
          <span>
            <strong>API tidak dapat dijangkau.</strong>{" "}
            Menampilkan data contoh. Pastikan server berjalan di{" "}
            <code>{API_BASE}</code>.
          </span>
          <button
            onClick={() => fetchAlerts(new AbortController().signal)}
            style={{
              marginLeft: "auto", background: "none", border: "1px solid #d97706",
              borderRadius: 6, padding: "4px 10px", color: "#d97706",
              cursor: "pointer", fontSize: "0.8rem", fontWeight: 600,
            }}
          >
            <i className="bi bi-arrow-clockwise me-1"></i> Retry
          </button>
        </div>
      )}

      <AlertsHeader
        totalUnread={totalUnread}
        onMarkAllRead={handleMarkAllRead}
        onClearAll={handleClearAll}
        isLive={!apiError && apiAlerts !== null}
      />

      <AlertsStats alerts={null} stats={displayStats} />

      <AlertsFilter
        filters={filters}
        onFilterChange={partial => setFilters(prev => ({ ...prev, ...partial }))}
        onReset={() => setFilters(DEFAULT_FILTERS)}
        totalResults={visibleFiltered.length}
      />

      <AlertsFeed
        alerts={visibleFiltered}
        onMarkRead={handleMarkRead}
        onResolve={handleResolve}
        onDelete={handleDelete}
      />
    </div>
  );
};

export default AlertsLog;