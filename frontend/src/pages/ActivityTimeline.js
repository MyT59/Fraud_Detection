import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ALL_ACTIVITIES } from "../components/activity/activityData";
import ActivityStatsBar from "../components/activity/ActivityStatsBar";
import ActivityToolbar from "../components/activity/ActivityToolbar";
import ActivityFeed from "../components/activity/ActivityFeed";
import ActivitySidePanel from "../components/activity/ActivitySidePanel";
import PageLoader from "../components/common/PageLoader";
import "./ActivityTimeline.css";

const PAGE_SIZE = 8;

const ActivityTimeline = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  const filtered = useMemo(() => {
    let result =
      activeFilter === "all"
        ? ALL_ACTIVITIES
        : ALL_ACTIVITIES.filter((a) => a.type === activeFilter);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          a.user.toLowerCase().includes(q),
      );
    }

    return result;
  }, [activeFilter, searchQuery]);

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

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + PAGE_SIZE);
  };

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

      {/* Stats Bar */}
      <ActivityStatsBar />

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
          activeFilter={activeFilter}
          onFilterChange={handleFilterChange}
        />
      </div>
    </div>
  );
};

export default ActivityTimeline;
