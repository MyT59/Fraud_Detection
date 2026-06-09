import React, { useState, useEffect, useRef, useCallback } from "react";
import { FALLBACK_ACTIVITIES } from "../components/activity/activityData";
import { ACTION_GROUPS } from "../services/activityLogService";
import ActivityStatsBar from "../components/activity/ActivityStatsBar";
import ActivityToolbar from "../components/activity/ActivityToolbar";
import ActivityFeed from "../components/activity/ActivityFeed";
import ActivitySidePanel from "../components/activity/ActivitySidePanel";
import PageLoader from "../components/common/PageLoader";
import activityLogService from "../services/activityLogService";
import "./ActivityTimeline.css";

const PAGE_LIMIT = 30;
const SEARCH_DEBOUNCE_MS = 400;

// Time period → start_date param untuk BE
const getPeriodStartDate = (period) => {
  if (period === "all_time") return null;
  const now = new Date();
  if (period === "today") {
    return new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).toISOString();
  }
  if (period === "this_week") {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    d.setDate(d.getDate() - d.getDay());
    return d.toISOString();
  }
  if (period === "this_month") {
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  }
  return null;
};

const exportCSV = (logs) => {
  activityLogService.exportToCSV(
    logs,
    `activity_timeline_${new Date().toISOString().slice(0, 10)}`,
  );
};

const exportExcel = (logs) => {
  if (!logs.length) return;
  const headers = [
    "ID",
    "Tanggal",
    "Action Type",
    "Module",
    "Severity",
    "Admin",
    "Email",
    "Target Type",
    "Target ID",
    "Details",
  ];
  const escape = (val) => {
    if (val === null || val === undefined) return "";
    return typeof val === "object" ? JSON.stringify(val) : String(val);
  };
  const rows = logs.map((a) => [
    a.id,
    new Date(a.created_at).toLocaleString("id-ID"),
    a.action_type,
    a.module_source,
    a.severity,
    a.admin_name,
    a.admin_email,
    a.target_type,
    a.target_id,
    escape(a.details),
  ]);
  const tableRows = rows
    .map((r) => `<tr>${r.map((v) => `<td>${escape(v)}</td>`).join("")}</tr>`)
    .join("");
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
    xmlns:x="urn:schemas-microsoft-com:office:excel"
    xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="UTF-8"></head><body>
    <table border="1">
      <thead><tr>${headers.map((h) => `<th style="background:#6366f1;color:#fff;font-weight:bold">${h}</th>`).join("")}</tr></thead>
      <tbody>${tableRows}</tbody>
    </table></body></html>`;
  const blob = new Blob([html], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `activity_timeline_${new Date().toISOString().slice(0, 10)}.xls`;
  a.click();
  URL.revokeObjectURL(url);
};

const ActivityTimeline = () => {
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [apiError, setApiError] = useState(false);

  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);

  // Stats — fetch sekali tanpa filter untuk total count per group
  const [statsItems, setStatsItems] = useState([]);

  const [activeFilter, setActiveFilter] = useState("all");
  const [timeFilter, setTimeFilter] = useState("all_time");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [exportOpen, setExportOpen] = useState(false);

  const exportRef = useRef(null);
  const sentinelRef = useRef(null);
  const debounceTimer = useRef(null);
  const abortRef = useRef(null);

  // Build params dari state filter aktif
  const buildParams = useCallback(
    (pageNum) => {
      const params = { page: pageNum, limit: PAGE_LIMIT };

      if (activeFilter !== "all") {
        params.action_types = ACTION_GROUPS[activeFilter] || [];
      }

      const startDate = getPeriodStartDate(timeFilter);
      if (startDate) params.start_date = startDate;

      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();

      return params;
    },
    [activeFilter, timeFilter, debouncedSearch],
  );

  // Fetch page pertama — reset items
  const fetchFirst = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setInitialLoading(true);
    setItems([]);
    setPage(1);
    setHasMore(true);

    try {
      const res = await activityLogService.getTimelineLogs(buildParams(1));
      const fetched = res.items || [];
      setItems(fetched);
      setTotal(res.total || 0);
      setHasMore(
        fetched.length === PAGE_LIMIT && fetched.length < (res.total || 0),
      );
      setApiError(false);
    } catch (err) {
      if (err.name === "AbortError") return;
      console.warn(
        "ActivityTimeline: fetch gagal, pakai fallback.",
        err.message,
      );
      setApiError(true);
      setItems(FALLBACK_ACTIVITIES);
      setTotal(FALLBACK_ACTIVITIES.length);
      setHasMore(false);
    } finally {
      setInitialLoading(false);
    }
  }, [buildParams]);

  // Fetch page berikutnya — append items
  const fetchMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const res = await activityLogService.getTimelineLogs(
        buildParams(nextPage),
      );
      const fetched = res.items || [];
      setItems((prev) => {
        const ids = new Set(prev.map((i) => i.id));
        return [...prev, ...fetched.filter((i) => !ids.has(i.id))];
      });
      setPage(nextPage);
      setHasMore(
        fetched.length === PAGE_LIMIT &&
          items.length + fetched.length < (res.total || 0),
      );
    } catch (err) {
      console.error("fetchMore error:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, page, buildParams, items.length]);

  // Re-fetch saat filter berubah
  useEffect(() => {
    fetchFirst();
  }, [fetchFirst]);

  // Fetch stats sekali (tanpa filter) untuk ActivityStatsBar & SidePanel count
  useEffect(() => {
    activityLogService
      .getTimelineLogs({ page: 1, limit: 200 })
      .then((res) => setStatsItems(res.items || []))
      .catch(() => setStatsItems(FALLBACK_ACTIVITIES));
  }, []);

  // IntersectionObserver untuk infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          hasMore &&
          !loadingMore &&
          !initialLoading
        ) {
          fetchMore();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, initialLoading, fetchMore]);

  // Close export dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (exportRef.current && !exportRef.current.contains(e.target))
        setExportOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Debounce search
  const handleSearchChange = (val) => {
    setSearchQuery(val);
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(
      () => setDebouncedSearch(val),
      SEARCH_DEBOUNCE_MS,
    );
  };

  const handleFilterChange = (val) => setActiveFilter(val);
  const handleTimeFilterChange = (val) => setTimeFilter(val);

  const handleExport = (format) => {
    setExportOpen(false);
    if (format === "csv") exportCSV(items);
    else if (format === "excel") exportExcel(items);
  };

  if (initialLoading)
    return <PageLoader message="Memuat activity timeline..." />;

  return (
    <div className="activity-page">
      <div className="activity-page-header">
        <div className="activity-page-header-left">
          <h1 className="activity-page-title">
            <i className="bi bi-clock-history"></i>
            Activity Timeline
          </h1>
          <p className="activity-page-subtitle">
            Full system activity log — fraud events, reviews, alerts, and more
          </p>
        </div>

        <div className="activity-page-actions">
          {!apiError ? (
            <span className="badge-live">
              <i
                className="bi bi-circle-fill"
                style={{ fontSize: ".45rem" }}
              ></i>
              {total.toLocaleString()} events
            </span>
          ) : (
            <span className="badge-static">
              <i className="bi bi-exclamation-triangle-fill"></i>
              Static data only
            </span>
          )}

          <div className="export-wrapper" ref={exportRef}>
            <button
              className="btn-outline-indigo"
              onClick={() => setExportOpen((v) => !v)}
            >
              <i className="bi bi-download"></i>
              Export Log
              <i
                className={`bi bi-chevron-${exportOpen ? "up" : "down"} export-chevron`}
              ></i>
            </button>

            {exportOpen && (
              <div className="export-dropdown">
                <div className="export-dropdown-header">
                  Export {items.length} loaded activities
                </div>
                <button
                  className="export-option"
                  onClick={() => handleExport("csv")}
                >
                  <span className="export-option-icon csv-icon">
                    <i className="bi bi-filetype-csv"></i>
                  </span>
                  <div className="export-option-text">
                    <strong>CSV File</strong>
                    <span>Comma-separated values</span>
                  </div>
                </button>
                <button
                  className="export-option"
                  onClick={() => handleExport("excel")}
                >
                  <span className="export-option-icon excel-icon">
                    <i className="bi bi-file-earmark-spreadsheet"></i>
                  </span>
                  <div className="export-option-text">
                    <strong>Excel File</strong>
                    <span>Microsoft Excel format</span>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <ActivityStatsBar activities={statsItems} />

      <ActivityToolbar
        activeFilter={activeFilter}
        onFilterChange={handleFilterChange}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        totalCount={total}
        timeFilter={timeFilter}
        onTimeFilterChange={handleTimeFilterChange}
      />

      <div className="activity-main-content">
        {/* Feed dengan sentinel untuk infinite scroll */}
        <div className="timeline-feed-card">
          <div className="feed-header">
            <h3 className="feed-header-title">Activity Feed</h3>
            <span className="feed-count-badge">
              {items.length} / {total.toLocaleString()} events
            </span>
          </div>

          <ActivityFeed
            activities={items}
            onLoadMore={fetchMore}
            hasMore={false} /* tombol Load More diganti sentinel */
          />

          {/* Sentinel — IntersectionObserver target */}
          <div ref={sentinelRef} style={{ height: 1 }} />

          {loadingMore && (
            <div className="text-center py-3">
              <div
                className="spinner-border spinner-border-sm text-secondary"
                role="status"
              >
                <span className="visually-hidden">Memuat...</span>
              </div>
              <span className="ms-2 text-muted" style={{ fontSize: "0.85rem" }}>
                Memuat lebih banyak...
              </span>
            </div>
          )}

          {!hasMore && items.length > 0 && (
            <div
              className="text-center py-3 text-muted"
              style={{ fontSize: "0.82rem" }}
            >
              <i className="bi bi-check-all me-1"></i>
              Semua {total.toLocaleString()} events sudah dimuat
            </div>
          )}
        </div>

        <ActivitySidePanel
          activities={statsItems}
          activeFilter={activeFilter}
          onFilterChange={handleFilterChange}
        />
      </div>
    </div>
  );
};

export default ActivityTimeline;
