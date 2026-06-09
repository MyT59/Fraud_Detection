import React, { useState, useEffect, useCallback, useRef } from "react";
import AlertsHeader from "../components/alerts/AlertsHeader";
import AlertsStats from "../components/alerts/AlertsStats";
import AlertsFilter from "../components/alerts/AlertsFilter";
import AlertsFeed from "../components/alerts/AlertsFeed";
import PageLoader from "../components/common/PageLoader";
import AlertDetailModal from "../components/alerts/AlertDetailModal";
import "./AlertsLog.css";

// Import API Service
import {
  fetchAlerts as fetchAlertsService,
  fetchAlertMetrics,
  fetchAlertCount,
  fetchPriorityDistribution,
  fetchOpenQueue,
  fetchAlertDetail,
  resolveAlert,
  claimAlert,
} from "../services/AlertsService";

// ─── Konstanta ────────────────────────────────────────────────────

const DEFAULT_FILTERS = {
  search: "",
  type: "all",
  severity: "all",
  status: "all",
  sortBy: "priority_desc",
};

// Mapping filter FE → enum BE (langsung pakai nilai BE)
const SEVERITY_MAP = {
  all: null,
  CRITICAL: "CRITICAL",
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
};

const STATUS_MAP = {
  all: null,
  OPEN: "OPEN",
  IN_PROGRESS: "IN_PROGRESS",
  RESOLVED: "RESOLVED",
};

// ─── Normalisasi data BE → format internal FE ─────────────────────
// Tidak lagi menggunakan string lama (unread/read).
// Status disimpan apa adanya dari BE: OPEN | IN_PROGRESS | RESOLVED | REOPENED | OVERRIDDEN
const normalizeAlert = (raw) => ({
  id: String(raw.id ?? Math.random()),
  _backendId: raw.id,
  type: (raw.type || raw.alert_type || "UNKNOWN").toUpperCase(),
  severity: (raw.severity || "LOW").toUpperCase(),
  status: (raw.status || "OPEN").toUpperCase(),
  title: raw.title || "Alert",
  message: raw.message || "",
  transaction_id: raw.transaction_id ?? null,
  created_at: raw.created_at || null,
  priority: raw.priority ?? 0,
  priority_label: raw.priority_label || "",
  service: raw.service || "",
});

// ─── Komponen Utama ───────────────────────────────────────────────

const AlertsLog = () => {
  // Tab: "all" | "open"
  // My Queue DIHAPUS dari halaman ini — pindah ke ManualReview
  const [activeTab, setActiveTab] = useState("all");
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const LIMIT = 10;

  // State Data
  const [apiAlerts, setApiAlerts] = useState(null);
  const [apiStats, setApiStats] = useState(null);
  const [priorityStats, setPriorityStats] = useState(null);
  const [totalCount, setTotalCount] = useState(0);

  // State Loading & Error
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(false);

  // State aksi lokal (optimistic UI)
  const [localOverride, setLocalOverride] = useState({});
  const [pendingOps, setPendingOps] = useState({});
  const abortRef = useRef(null);

  // State Modal Detail
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDetail, setModalDetail] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [modalPendingOp, setModalPendingOp] = useState(null);

  // ─── Load Data ───────────────────────────────────────────────────

  const loadData = useCallback(
    async (signal) => {
      setLoading(true);
      setApiError(false);

      try {
        const [metricsData, countData, priorityData] = await Promise.all([
          fetchAlertMetrics(signal).catch(() => null),
          fetchAlertCount(signal).catch(() => null),
          fetchPriorityDistribution(signal).catch(() => null),
        ]);

        let feedData;

        if (activeTab === "open") {
          // Open Queue: hanya alert OPEN, untuk aksi Claim
          feedData = await fetchOpenQueue({ page, limit: LIMIT, signal });
        } else {
          // All Alerts: semua alert dengan filter
          const queryParams = {
            page,
            limit: LIMIT,
            severity: SEVERITY_MAP[filters.severity] || undefined,
            status: STATUS_MAP[filters.status] || undefined,
            type: filters.type !== "all" ? filters.type : undefined,
            signal,
          };
          feedData = await fetchAlertsService(queryParams);
        }

        // Ekstrak items dari berbagai bentuk response BE
        let items = [];
        if (Array.isArray(feedData)) {
          items = feedData;
        } else if (Array.isArray(feedData?.items)) {
          items = feedData.items;
        } else if (Array.isArray(feedData?.data)) {
          items = feedData.data;
        } else if (Array.isArray(feedData?.alerts)) {
          items = feedData.alerts;
        }

        setApiAlerts(items.map(normalizeAlert));
        setTotalCount(feedData?.total ?? countData?.count ?? items.length);
        setApiStats(metricsData?.data ?? metricsData ?? null);
        setPriorityStats(priorityData?.data ?? priorityData ?? null);
      } catch (err) {
        if (err.name === "AbortError") return;
        console.error("[AlertsLog] Gagal memuat data dari API:", err.message);
        // ❌ TIDAK fallback ke dummy data — tampilkan error state
        setApiError(true);
        setApiAlerts([]);
        setApiStats(null);
        setPriorityStats(null);
        setTotalCount(0);
      } finally {
        setLoading(false);
      }
    },
    [activeTab, page, filters.severity, filters.status, filters.type],
  );

  useEffect(() => {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    loadData(ctrl.signal);
    return () => ctrl.abort();
  }, [loadData]);

  // ─── Handlers ────────────────────────────────────────────────────

  const handleRetry = useCallback(() => {
    setLocalOverride({});
    setPendingOps({});
    setApiError(false);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    loadData(ctrl.signal);
  }, [loadData]);

  const handleFilterChange = useCallback((newFilters) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
    setPage(1);
    setLocalOverride({});
  }, []);

  const handleFilterReset = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setPage(1);
    setLocalOverride({});
  }, []);

  // ─── Modal Detail ─────────────────────────────────────────────────

  const handleOpenDetail = useCallback(
    async (id) => {
      const target = apiAlerts?.find(
        (a) => a.id === String(id) || a._backendId === id,
      );
      const backendId = target?._backendId ?? id;

      setModalDetail(null);
      setModalError(null);
      setModalPendingOp(null);
      setModalOpen(true);
      setModalLoading(true);

      try {
        const data = await fetchAlertDetail(backendId);
        setModalDetail(data?.data ?? data);
      } catch (err) {
        console.error("[AlertsLog] Gagal memuat detail alert:", err);
        setModalError("Gagal memuat detail alert. Silakan coba lagi.");
      } finally {
        setModalLoading(false);
      }
    },
    [apiAlerts],
  );

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setModalDetail(null);
    setModalError(null);
    setModalPendingOp(null);
  }, []);

  // ─── Resolve Alert ────────────────────────────────────────────────

  const handleResolve = useCallback(
    async (id) => {
      const target = apiAlerts?.find(
        (a) => a.id === String(id) || a._backendId === id,
      );
      if (!target) return;

      const frontendId = target.id;
      setPendingOps((prev) => ({ ...prev, [frontendId]: "resolving" }));
      if (modalOpen && modalDetail?.id === id) setModalPendingOp("resolving");

      try {
        await resolveAlert(target._backendId);
        setLocalOverride((prev) => ({
          ...prev,
          [frontendId]: { ...target, status: "RESOLVED" },
        }));
        if (modalOpen && modalDetail?.id === id) {
          setModalDetail((prev) =>
            prev ? { ...prev, status: "RESOLVED" } : prev,
          );
        }
      } catch (err) {
        console.error("[AlertsLog] Gagal resolve alert:", err);
        alert("Gagal menyelesaikan alert. Silakan coba lagi.");
      } finally {
        setPendingOps((prev) => {
          const next = { ...prev };
          delete next[frontendId];
          return next;
        });
        if (modalOpen) setModalPendingOp(null);
      }
    },
    [apiAlerts, modalOpen, modalDetail],
  );

  // ─── Claim Alert ──────────────────────────────────────────────────
  // Claim hanya tersedia di tab Open Queue.
  // Setelah claim berhasil, alert disembunyikan dari Open Queue
  // dan analis harus lanjut ke halaman Manual Review (My Queue).

  const handleClaim = useCallback(
    async (id) => {
      const target = apiAlerts?.find(
        (a) => a.id === String(id) || a._backendId === id,
      );
      if (!target) return;

      const frontendId = target.id;
      setPendingOps((prev) => ({ ...prev, [frontendId]: "claiming" }));
      if (modalOpen && modalDetail?.id === id) setModalPendingOp("claiming");

      try {
        await claimAlert(target._backendId);

        // Setelah claim, sembunyikan dari Open Queue (sudah pindah ke My Queue)
        setLocalOverride((prev) => ({
          ...prev,
          [frontendId]: {
            ...target,
            status: "IN_PROGRESS",
            _hidden: activeTab === "open",
          },
        }));

        if (modalOpen && modalDetail?.id === id) {
          setModalDetail((prev) =>
            prev ? { ...prev, status: "IN_PROGRESS" } : prev,
          );
        }
      } catch (err) {
        console.error("[AlertsLog] Gagal claim alert:", err);
        alert("Gagal mengklaim alert. Mungkin sudah diambil analis lain.");
      } finally {
        setPendingOps((prev) => {
          const next = { ...prev };
          delete next[frontendId];
          return next;
        });
        if (modalOpen) setModalPendingOp(null);
      }
    },
    [apiAlerts, modalOpen, modalDetail, activeTab],
  );

  // ─── Pemrosesan Data untuk Render ────────────────────────────────

  const combined = (apiAlerts || []).map((a) => ({
    ...a,
    ...(localOverride[a.id] || {}),
  }));

  const visibleAlerts = combined.filter((a) => !a._hidden);

  const filteredAlerts = visibleAlerts.filter((a) => {
    if (filters.type !== "all" && a.type !== filters.type) return false;
    if (filters.severity !== "all" && a.severity !== filters.severity)
      return false;
    if (filters.status !== "all" && a.status !== filters.status) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (
        !a.title?.toLowerCase().includes(q) &&
        !a.message?.toLowerCase().includes(q) &&
        !String(a.transaction_id || "")
          .toLowerCase()
          .includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  // Sorting
  const sortedAlerts = [...filteredAlerts].sort((a, b) => {
    switch (filters.sortBy) {
      case "oldest":
        return new Date(a.created_at) - new Date(b.created_at);
      case "priority_desc":
        return (b.priority || 0) - (a.priority || 0);
      case "priority_asc":
        return (a.priority || 0) - (b.priority || 0);
      case "newest":
      default:
        return new Date(b.created_at) - new Date(a.created_at);
    }
  });

  const totalPages = Math.max(1, Math.ceil(totalCount / LIMIT));
  const totalUnread = visibleAlerts.filter((a) => a.status === "OPEN").length;

  const getVisiblePages = () => {
    const delta = 2;
    const range = [];
    for (
      let i = Math.max(1, page - delta);
      i <= Math.min(totalPages, page + delta);
      i++
    ) {
      range.push(i);
    }
    return range;
  };

  if (loading && !apiAlerts) return <PageLoader text="Memuat Log Alert..." />;

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <div className="alerts-page">
      <AlertsHeader totalUnread={totalUnread} isLive={!apiError} />

      <AlertsStats stats={apiStats} priorityData={priorityStats} />

      {/* Banner Error API */}
      {apiError && (
        <div
          style={{
            backgroundColor: "#fef2f2",
            border: "1px solid #fca5a5",
            padding: "12px 16px",
            borderRadius: "8px",
            color: "#b91c1c",
            marginBottom: "20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <i
              className="bi bi-exclamation-triangle-fill"
              style={{ marginRight: 8 }}
            />
            <strong>Gagal memuat data.</strong> Tidak dapat terhubung ke server.
          </div>
          <button
            onClick={handleRetry}
            style={{
              background: "#dc2626",
              color: "#fff",
              border: "none",
              padding: "6px 12px",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            <i className="bi bi-arrow-clockwise" style={{ marginRight: 6 }} />
            Coba Lagi
          </button>
        </div>
      )}

      {/* Navigasi Tab — hanya All Alerts & Open Queue */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          marginBottom: "20px",
          borderBottom: "2px solid #e5e7eb",
          paddingBottom: "10px",
        }}
      >
        <button
          onClick={() => {
            setActiveTab("all");
            setPage(1);
          }}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontWeight: activeTab === "all" ? "bold" : "normal",
            color: activeTab === "all" ? "#2563eb" : "#6b7280",
            borderBottom: activeTab === "all" ? "2px solid #2563eb" : "none",
            padding: "8px 4px",
            fontSize: "0.9rem",
          }}
        >
          <i className="bi bi-list-ul" style={{ marginRight: 6 }} />
          All Alerts
        </button>

        <button
          onClick={() => {
            setActiveTab("open");
            setPage(1);
            setLocalOverride({});
          }}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontWeight: activeTab === "open" ? "bold" : "normal",
            color: activeTab === "open" ? "#d97706" : "#6b7280",
            borderBottom: activeTab === "open" ? "2px solid #d97706" : "none",
            padding: "8px 4px",
            fontSize: "0.9rem",
          }}
        >
          <i className="bi bi-inbox-fill" style={{ marginRight: 6 }} />
          Open Queue
          <span
            style={{
              marginLeft: 6,
              fontSize: "0.7rem",
              background: "#fef3c7",
              color: "#d97706",
              border: "1px solid #fde68a",
              borderRadius: 10,
              padding: "1px 7px",
              fontWeight: 700,
            }}
          >
            Claim di sini
          </span>
        </button>
      </div>

      {/* Filter — hanya tampil di tab All Alerts */}
      {activeTab === "all" && (
        <AlertsFilter
          filters={filters}
          onFilterChange={handleFilterChange}
          onReset={handleFilterReset}
          totalResults={sortedAlerts.length}
        />
      )}

      {/* Feed Data */}
      {apiError ? (
        <div className="alerts-empty">
          <i className="bi bi-wifi-off" />
          <h4>Data Tidak Tersedia</h4>
          <p>Tidak dapat memuat alert. Periksa koneksi atau coba lagi.</p>
        </div>
      ) : (
        <AlertsFeed
          alerts={sortedAlerts}
          pendingOps={pendingOps}
          onResolve={handleResolve}
          onClaim={activeTab === "open" ? handleClaim : null}
          onViewDetail={handleOpenDetail}
        />
      )}

      {/* Pagination */}
      {!apiError && totalPages > 1 && (
        <div className="alerts-pagination">
          <button
            className="alerts-page-btn"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <i className="bi bi-chevron-left" />
          </button>

          {page > 3 && (
            <>
              <button className="alerts-page-btn" onClick={() => setPage(1)}>
                1
              </button>
              <span className="alerts-page-dots">...</span>
            </>
          )}

          {getVisiblePages().map((num) => (
            <button
              key={num}
              className={
                page === num ? "alerts-page-btn active" : "alerts-page-btn"
              }
              onClick={() => setPage(num)}
            >
              {num}
            </button>
          ))}

          {page < totalPages - 2 && (
            <>
              <span className="alerts-page-dots">...</span>
              <button
                className="alerts-page-btn"
                onClick={() => setPage(totalPages)}
              >
                {totalPages}
              </button>
            </>
          )}

          <button
            className="alerts-page-btn"
            disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            <i className="bi bi-chevron-right" />
          </button>
        </div>
      )}

      {/* Alert Detail Modal */}
      <AlertDetailModal
        open={modalOpen}
        detail={modalDetail}
        loading={modalLoading}
        error={modalError}
        onClose={handleCloseModal}
        onResolve={handleResolve}
        onClaim={handleClaim}
        pendingOp={modalPendingOp}
        onStatusUpdated={(alertId, newStatus) => {
          const target = apiAlerts?.find(
            (a) => a._backendId === alertId || a.id === String(alertId),
          );
          if (!target) return;
          setLocalOverride((prev) => ({
            ...prev,
            [target.id]: { ...target, status: newStatus },
          }));
        }}
      />
    </div>
  );
};

export default AlertsLog;
