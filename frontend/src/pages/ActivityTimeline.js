import React, { useState, useEffect, useRef, useCallback } from "react";
import { getActivityGroup } from "../components/activity/activityData";
import { ACTION_GROUPS } from "../services/activityLogService";
import ActivityStatsBar from "../components/activity/ActivityStatsBar";
import ActivityToolbar from "../components/activity/ActivityToolbar";
import ActivityFeed from "../components/activity/ActivityFeed";
import ActivitySidePanel from "../components/activity/ActivitySidePanel";
import PageLoader from "../components/common/PageLoader";
import activityLogService from "../services/activityLogService";
import { storage } from "../services/apiService";
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

const ActivityTimeline = () => {
  const role = storage.getUser()?.role;
  const canAccessReports = role === "SUPER_ADMIN" || role === "RISK_MANAGER";

  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [apiError, setApiError] = useState("");

  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);

  // Stats — fetch sekali tanpa filter untuk total count per group
  const [statsGroupCounts, setStatsGroupCounts] = useState({});
  const [statsTotal, setStatsTotal] = useState(0);

  const [activeFilter, setActiveFilter] = useState("all");
  const [timeFilter, setTimeFilter] = useState("all_time");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

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
      const res = await activityLogService.getTimelineLogs({
        ...buildParams(1),
        signal: abortRef.current.signal,
      });
      const fetched = res.items || [];
      setItems(fetched);
      setTotal(res.total || 0);
      setHasMore(
        fetched.length === PAGE_LIMIT && fetched.length < (res.total || 0),
      );
      setApiError("");
    } catch (err) {
      if (err.name === "AbortError") return;
      console.warn(
        "ActivityTimeline: fetch gagal, pakai fallback.",
        err.message,
      );
      setApiError(err.message || "Activity Log tidak dapat dimuat.");
      setItems([]);
      setTotal(0);
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
        { ...buildParams(nextPage), signal: abortRef.current?.signal },
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
      .getSummary()
      .then((res) => {
        const counts = {};
        Object.entries(res.action_counts || {}).forEach(([action, count]) => {
          const group = getActivityGroup(action);
          counts[group] = (counts[group] || 0) + count;
        });
        setStatsGroupCounts(counts);
        setStatsTotal(res.total || 0);
      })
      .catch(() => {
        setStatsGroupCounts({});
        setStatsTotal(0);
      });
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

  useEffect(() => () => clearTimeout(debounceTimer.current), []);

  if (initialLoading)
    return <PageLoader message="Memuat activity timeline..." />;

  return (
    <div className="activity-page">
      <div className="activity-page-header">
        <div className="activity-page-header-left">
          <h1 className="activity-page-title">
            <i className="bi bi-clock-history"></i>
            {role === "FRAUD_ANALYST" ? "My Activity" : "Activity Timeline"}
          </h1>
          <p className="activity-page-subtitle">
            {role === "FRAUD_ANALYST"
              ? "Riwayat aktivitas yang dilakukan oleh akunmu."
              : (
                <>
            Full system activity log — fraud events, reviews, alerts, and more
                </>
              )}
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
              Activity Log unavailable
            </span>
          )}

          {canAccessReports && (
            <a
              href="/reports"
              className="btn-outline-indigo"
              title="Export via Reports"
            >
              <i className="bi bi-download"></i>
              Export Log
              <i
                className="bi bi-box-arrow-up-right ms-1"
                style={{ fontSize: ".7rem" }}
              ></i>
            </a>
          )}
        </div>
      </div>

      {apiError && (
        <div className="alert alert-warning mb-3" role="alert">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          {apiError}
        </div>
      )}

      <ActivityStatsBar groupCounts={statsGroupCounts} />

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
            <div>
              <h3 className="feed-header-title">System Activity Feed</h3>
              <p className="feed-header-subtitle">
                Event terbaru berdasarkan filter dan periode yang dipilih.
              </p>
            </div>
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
          activities={items}
          groupCounts={statsGroupCounts}
          totalCount={statsTotal}
          activeFilter={activeFilter}
          onFilterChange={handleFilterChange}
        />
      </div>
    </div>
  );
};

export default ActivityTimeline;
