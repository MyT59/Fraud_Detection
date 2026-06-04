import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
} from "react";
import AlertsHeader from "../components/alerts/AlertsHeader";
import AlertsStats from "../components/alerts/AlertsStats";
import AlertsFilter from "../components/alerts/AlertsFilter";
import AlertsFeed from "../components/alerts/AlertsFeed";
import PageLoader from "../components/common/PageLoader";
import { SEED_ALERTS } from "../components/alerts/alertsData";
import { api } from "../services/apiService";
import "./AlertsLog.css";

const DEFAULT_FILTERS = {
  search: "",
  type: "all",
  severity: "all",
  status: "all",
};

const SEVERITY_MAP = {
  all: null,
  critical: "CRITICAL",
  high: "HIGH",
  medium: "MEDIUM",
  low: "LOW",
};
const STATUS_MAP = {
  all: null,
  unread: "OPEN",
  read: "OPEN",
  resolved: "RESOLVED",
  approved: "RESOLVED",
  rejected: "OPEN",
};

const normalizeAlert = (raw) => ({
  id: String(raw.id),
  _backendId: raw.id,
  type: detectType(raw),
  severity: (raw.severity || "LOW").toLowerCase(),
  status: detectStatus(raw),
  title: raw.title || "Alert",
  message: raw.description || raw.message_raw || raw.title || "",
  txnId: raw.trx_id || null,
  time: raw.created_at,
  _raw: raw,
});

const detectType = (raw) => {
  const t = (raw.type || "").toUpperCase();
  if (t === "FRAUD" || t === "COMBINED") return "fraud";
  if (t === "RULE" || t === "VELOCITY") return "rule";
  if (t === "BLACKLIST") return "blacklist";
  if (t === "REVIEW") return "review";
  return "system";
};

const detectStatus = (raw) => {
  const s = (raw.status || "").toUpperCase();
  if (s === "RESOLVED" || s === "OVERRIDDEN") return "resolved";
  if (s === "IN_PROGRESS") return "read";
  return "unread";
};

const AlertsLog = () => {
  const [loading, setLoading] = useState(true);
  const [apiAlerts, setApiAlerts] = useState(null);
  const [apiStats, setApiStats] = useState(null);
  const [apiError, setApiError] = useState(false);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const LIMIT = 20;

  const [localOverride, setLocalOverride] = useState({});
  const [pendingOps, setPendingOps] = useState({});

  const abortRef = useRef(null);

  const fetchAlerts = useCallback(
    async (signal) => {
      setLoading(true);
      setApiError(false);

      try {
        const params = new URLSearchParams({ page, limit: LIMIT });
        if (SEVERITY_MAP[filters.severity])
          params.set("severity", SEVERITY_MAP[filters.severity]);
        if (STATUS_MAP[filters.status])
          params.set("status", STATUS_MAP[filters.status]);

        const [feedData, metricsData, countData] = await Promise.all([
          api.get(`/alerts/?${params}`, { signal }),
          api.get("/alerts/metrics", { signal }),
          api.get("/alerts/count", { signal }),
        ]);

        const items = feedData?.items || feedData?.alerts || feedData || [];
        setApiAlerts(Array.isArray(items) ? items.map(normalizeAlert) : []);
        setTotalCount(feedData?.total || countData?.count || items.length);
        setApiStats(metricsData);
      } catch (err) {
        if (err.name === "AbortError") return;
        console.warn("[AlertsLog] API offline, pakai seed data.", err.message);
        setApiError(true);
        setApiAlerts(null);
        setApiStats(null);
      } finally {
        setLoading(false);
      }
    },
    [page, filters.severity, filters.status],
  );

  useEffect(() => {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    fetchAlerts(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchAlerts]);

  const baseAlerts = apiAlerts ?? SEED_ALERTS;

  const alerts = useMemo(() => {
    const seen = new Set();
    return baseAlerts
      .map((a) => (localOverride[a.id] ? { ...a, ...localOverride[a.id] } : a))
      .filter((a) => {
        if (seen.has(a.id)) return false;
        seen.add(a.id);
        return true;
      });
  }, [baseAlerts, localOverride]);

  const computedStats = useMemo(
    () => ({
      total: alerts.length,
      critical: alerts.filter((a) => a.severity === "critical").length,
      high: alerts.filter((a) => a.severity === "high").length,
      medium: alerts.filter((a) => a.severity === "medium").length,
      low: alerts.filter((a) => a.severity === "low").length,
      approved: alerts.filter((a) => a.status === "approved").length,
      rejected: alerts.filter((a) => a.status === "rejected").length,
      unread: alerts.filter((a) => a.status === "unread").length,
      resolved: alerts.filter((a) => a.status === "resolved").length,
    }),
    [alerts],
  );

  const displayStats = useMemo(() => {
    if (!apiStats) return computedStats;
    return {
      total: apiStats.total_alerts ?? computedStats.total,
      critical: computedStats.critical,
      high: computedStats.high,
      medium: computedStats.medium,
      low: computedStats.low,
      approved: apiStats.resolved_alerts ?? computedStats.approved,
      rejected: computedStats.rejected,
      unread: apiStats.open_alerts ?? computedStats.unread,
      resolved: apiStats.resolved_alerts ?? computedStats.resolved,
    };
  }, [apiStats, computedStats]);

  const filtered = useMemo(() => {
    return alerts.filter((a) => {
      if (filters.type !== "all" && a.type !== filters.type) return false;
      if (filters.severity !== "all" && a.severity !== filters.severity)
        return false;
      if (filters.status !== "all" && a.status !== filters.status) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (
          !a.title.toLowerCase().includes(q) &&
          !(a.message || "").toLowerCase().includes(q) &&
          !(a.txnId || "").toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [alerts, filters]);

  const visibleFiltered = filtered.filter(
    (a) => !localOverride[a.id]?._deleted,
  );

  const totalUnread = alerts.filter(
    (a) => a.status === "unread" && !localOverride[a.id]?._deleted,
  ).length;

  const patchLocal = (id, patch) =>
    setLocalOverride((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), ...patch },
    }));

  const setPending = (id, op) =>
    setPendingOps((prev) => ({ ...prev, [id]: op }));
  const clearPending = (id) =>
    setPendingOps((prev) => {
      const n = { ...prev };
      delete n[id];
      return n;
    });

  const handleMarkRead = useCallback((id) => {
    patchLocal(id, { status: "read" });
  }, []);

  const handleResolve = useCallback(
    async (id) => {
      const alert = alerts.find((a) => a.id === id);
      if (!alert || alert.status === "resolved") return;

      patchLocal(id, { status: "resolved" });
      setPending(id, "resolving");

      if (!apiError && alert._backendId) {
        try {
          await api.patch(`/alerts/${alert._backendId}/resolve`);
        } catch (err) {
          console.warn("[AlertsLog] resolve failed:", err.message);

          patchLocal(id, { status: alert.status });
        } finally {
          clearPending(id);
        }
      } else {
        clearPending(id);
      }
    },
    [alerts, apiError],
  );

  const handleClaim = useCallback(
    async (id) => {
      const alert = alerts.find((a) => a.id === id);
      if (!alert) return;

      patchLocal(id, { status: "read" });
      setPending(id, "claiming");

      if (!apiError && alert._backendId) {
        try {
          await api.post(`/alerts/${alert._backendId}/claim`);
        } catch (err) {
          console.warn("[AlertsLog] claim failed:", err.message);
          patchLocal(id, { status: alert.status });
        } finally {
          clearPending(id);
        }
      } else {
        clearPending(id);
      }
    },
    [alerts, apiError],
  );

  const handleDelete = useCallback((id) => {
    setLocalOverride((prev) => ({
      ...prev,
      [id]: { ...prev[id], _deleted: true },
    }));
  }, []);

  const handleMarkAllRead = useCallback(() => {
    const patch = {};
    alerts.forEach((a) => {
      if (a.status === "unread") patch[a.id] = { status: "read" };
    });
    setLocalOverride((prev) => ({ ...prev, ...patch }));
  }, [alerts]);

  const handleClearAll = useCallback(() => {
    const patch = {};
    alerts.forEach((a) => {
      patch[a.id] = { _deleted: true };
    });
    setLocalOverride((prev) => ({ ...prev, ...patch }));
  }, [alerts]);

  const handleRetry = useCallback(() => {
    setLocalOverride({});
    setPendingOps({});
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    fetchAlerts(ctrl.signal);
  }, [fetchAlerts]);

  const totalPages = Math.ceil(totalCount / LIMIT);
  const handlePageChange = (newPage) => {
    setPage(newPage);
    setLocalOverride({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (loading) return <PageLoader message="Memuat Alerts Log..." />;

  return (
    <div className="alerts-page">
      {apiError && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 16px",
            marginBottom: 16,
            borderRadius: 8,
            background: "#fffbeb",
            border: "1px solid #fde68a",
            fontSize: "0.85rem",
            color: "#92400e",
          }}
        >
          <i className="bi bi-wifi-off"></i>
          <span>
            <strong>API tidak dapat dijangkau.</strong> Menampilkan data contoh.
          </span>
          <button
            onClick={handleRetry}
            style={{
              marginLeft: "auto",
              background: "none",
              border: "1px solid #d97706",
              borderRadius: 6,
              padding: "4px 10px",
              color: "#d97706",
              cursor: "pointer",
              fontSize: "0.8rem",
              fontWeight: 600,
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
        onFilterChange={(partial) => {
          setFilters((prev) => ({ ...prev, ...partial }));
          setPage(1);
          setLocalOverride({});
        }}
        onReset={() => {
          setFilters(DEFAULT_FILTERS);
          setPage(1);
          setLocalOverride({});
        }}
        totalResults={visibleFiltered.length}
      />

      <AlertsFeed
        alerts={visibleFiltered}
        pendingOps={pendingOps}
        onMarkRead={handleMarkRead}
        onResolve={handleResolve}
        onClaim={handleClaim}
        onDelete={handleDelete}
      />

      {!apiError && totalPages > 1 && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 8,
            padding: "24px 0",
          }}
        >
          <button
            className="alerts-btn-outline"
            onClick={() => handlePageChange(page - 1)}
            disabled={page === 1}
          >
            <i className="bi bi-chevron-left"></i> Prev
          </button>
          <span
            style={{ fontSize: "0.9rem", color: "var(--text-muted, #6b7280)" }}
          >
            Halaman {page} / {totalPages}
          </span>
          <button
            className="alerts-btn-outline"
            onClick={() => handlePageChange(page + 1)}
            disabled={page === totalPages}
          >
            Next <i className="bi bi-chevron-right"></i>
          </button>
        </div>
      )}
    </div>
  );
};

export default AlertsLog;
