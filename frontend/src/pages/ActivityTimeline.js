import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ALL_ACTIVITIES } from "../components/activity/activityData";
import ActivityStatsBar  from "../components/activity/ActivityStatsBar";
import ActivityToolbar   from "../components/activity/ActivityToolbar";
import ActivityFeed      from "../components/activity/ActivityFeed";
import ActivitySidePanel from "../components/activity/ActivitySidePanel";
import PageLoader        from "../components/common/PageLoader";
import "./ActivityTimeline.css";

const BASE_URL  = process.env.REACT_APP_ML_API_URL || "http://localhost:8000";
const PAGE_SIZE = 8;

const ActivityTimeline = () => {
  const navigate = useNavigate();
  const [loading,      setLoading]      = useState(true);
  const [liveActivities, setLiveActivities] = useState([]);   // dari backend
  const [apiError,     setApiError]     = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchQuery,  setSearchQuery]  = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  /* ── Fetch review activities dari backend ── */
  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const res = await fetch(`${BASE_URL}/activity/feed?limit=100`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setLiveActivities(json.activities || []);
      } catch (err) {
        console.warn("ActivityTimeline: backend offline, pakai static data saja.", err.message);
        setApiError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
  }, []);

  /* ── Merge static + live, sort terbaru dulu ── */
  const allActivities = useMemo(() => {
    const combined = [...liveActivities, ...ALL_ACTIVITIES];

    // Deduplicate by id
    const seen = new Set();
    const unique = combined.filter(a => {
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    });

    // Sort: live (ISO timestamp) dulu, lalu static (pakai urutan array)
    unique.sort((a, b) => {
      const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return tb - ta;
    });

    return unique;
  }, [liveActivities]);

  /* ── Filter + search ── */
  const filtered = useMemo(() => {
    let result =
      activeFilter === "all"
        ? allActivities
        : allActivities.filter(a => a.type === activeFilter);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        a =>
          a.title.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          a.user.toLowerCase().includes(q),
      );
    }

    return result;
  }, [allActivities, activeFilter, searchQuery]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  const handleFilterChange = (val) => {
    setActiveFilter(val);
    setVisibleCount(PAGE_SIZE);
  };

  const handleSearchChange = (val) => {
    setSearchQuery(val);
    setVisibleCount(PAGE_SIZE);
  };

  const handleLoadMore = () => setVisibleCount(prev => prev + PAGE_SIZE);

  if (loading) return <PageLoader message="Memuat activity timeline..." />;

  return (
    <div className="activity-page">

      {/* Page Header */}
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
          {/* Live badge */}
          {!apiError && liveActivities.length > 0 && (
            <span style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "6px 14px", borderRadius: "20px",
              background: "#f0fdf4", border: "1px solid #bbf7d0",
              color: "#059669", fontSize: ".775rem", fontWeight: 700,
            }}>
              <i className="bi bi-circle-fill" style={{ fontSize: ".45rem" }}></i>
              {liveActivities.length} live events
            </span>
          )}
          {apiError && (
            <span style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "6px 14px", borderRadius: "20px",
              background: "#fffbeb", border: "1px solid #fde68a",
              color: "#92400e", fontSize: ".775rem", fontWeight: 600,
            }}>
              <i className="bi bi-exclamation-triangle-fill"></i>
              Static data only
            </span>
          )}
          <button className="btn-ghost" onClick={() => navigate("/dashboard")}>
            <i className="bi bi-arrow-left"></i>
            Back to Dashboard
          </button>
          <button className="btn-outline-indigo">
            <i className="bi bi-download"></i>
            Export Log
          </button>
        </div>
      </div>

      {/* Stats Bar — pakai allActivities supaya hitung data real */}
      <ActivityStatsBar activities={allActivities} />

      {/* Toolbar */}
      <ActivityToolbar
        activeFilter={activeFilter}
        onFilterChange={handleFilterChange}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        totalCount={filtered.length}
      />

      {/* Main Content */}
      <div className="activity-main-content">
        <ActivityFeed
          activities={visible}
          onLoadMore={handleLoadMore}
          hasMore={hasMore}
        />
        <ActivitySidePanel
          activities={allActivities}
          activeFilter={activeFilter}
          onFilterChange={handleFilterChange}
        />
      </div>
    </div>
  );
};

export default ActivityTimeline;