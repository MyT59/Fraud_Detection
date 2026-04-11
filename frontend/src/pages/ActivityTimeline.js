import React, { useState, useMemo, useEffect, useRef } from "react";
import { ALL_ACTIVITIES } from "../components/activity/activityData";
import ActivityStatsBar from "../components/activity/ActivityStatsBar";
import ActivityToolbar from "../components/activity/ActivityToolbar";
import ActivityFeed from "../components/activity/ActivityFeed";
import ActivitySidePanel from "../components/activity/ActivitySidePanel";
import PageLoader from "../components/common/PageLoader";
import "./ActivityTimeline.css";

const BASE_URL = process.env.REACT_APP_ML_API_URL || "http://localhost:8000";
const PAGE_SIZE = 8;

const flattenActivity = (a) => ({
  ID: a.id,
  Title: a.title,
  Type: a.type,
  Description: a.description,
  User: a.user,
  Timestamp: a.timestamp || a.time,
  ...Object.fromEntries(
    Object.entries(a.details || {}).map(([k, v]) => [
      k.replace(/([A-Z])/g, " $1").trim(),
      v,
    ]),
  ),
});

const exportCSV = (activities, filename = "activity_log.csv") => {
  if (!activities.length) return;
  const rows = activities.map(flattenActivity);
  const headers = [...new Set(rows.flatMap(Object.keys))];
  const csvContent = [
    headers.join(","),
    ...rows.map((r) =>
      headers
        .map((h) => {
          const val = r[h] ?? "";
          return `"${String(val).replace(/"/g, '""')}"`;
        })
        .join(","),
    ),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const exportExcel = (activities, filename = "activity_log.xls") => {
  if (!activities.length) return;
  const rows = activities.map(flattenActivity);
  const headers = [...new Set(rows.flatMap(Object.keys))];

  const tableRows = rows
    .map(
      (r) =>
        `<tr>${headers.map((h) => `<td>${r[h] ?? ""}</td>`).join("")}</tr>`,
    )
    .join("");

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="UTF-8">
    <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets>
    <x:ExcelWorksheet><x:Name>Activity Log</x:Name>
    <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
    </x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
    </head><body>
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
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const exportPDF = async (activities, filename = "activity_log.pdf") => {
  if (!activities.length) return;

  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const rows = activities.map(flattenActivity);

  const COLS = ["ID", "Title", "Type", "User", "Timestamp", "Description"];
  const colHeaders = COLS.filter((c) =>
    rows.some((r) => r[c] !== undefined && r[c] !== ""),
  );

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  doc.setFillColor(99, 102, 241);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 52, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Activity Timeline — Export", 32, 32);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Generated: ${new Date().toLocaleString()}   |   Total records: ${activities.length}`,
    32,
    46,
  );

  const TYPE_COLORS = {
    fraud_detected: [220, 38, 38],
    manual_review: [5, 150, 105],
    system: [37, 99, 235],
    rule_update: [217, 119, 6],
    alert: [234, 88, 12],
    report: [124, 58, 237],
    user_action: [75, 85, 99],
  };

  autoTable(doc, {
    startY: 64,
    head: [colHeaders],
    body: rows.map((r) => colHeaders.map((h) => r[h] ?? "")),
    styles: {
      fontSize: 8,
      cellPadding: { top: 5, right: 6, bottom: 5, left: 6 },
      lineColor: [229, 231, 235],
      lineWidth: 0.5,
      textColor: [55, 65, 81],
      font: "helvetica",
    },
    headStyles: {
      fillColor: [79, 70, 229],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8.5,
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251],
    },
    columnStyles: {
      0: { cellWidth: 30 },
      4: { cellWidth: 90 },
      5: { cellWidth: "auto" },
    },
    didParseCell(data) {
      if (data.section === "body" && data.column.index === 2) {
        const type = String(data.cell.raw);
        const color = TYPE_COLORS[type];
        if (color) {
          data.cell.styles.textColor = color;
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
    margin: { left: 32, right: 32 },
  });

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(156, 163, 175);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Fraud Detection System  |  Page ${i} of ${pageCount}`,
      32,
      doc.internal.pageSize.getHeight() - 14,
    );
  }

  doc.save(filename);
};

const isInPeriod = (activity, period) => {
  if (period === "all_time") return true;
  const ts = activity.timestamp ? new Date(activity.timestamp) : null;
  if (!ts || isNaN(ts)) return false;

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfDay);
  startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  if (period === "today") return ts >= startOfDay;
  if (period === "this_week") return ts >= startOfWeek;
  if (period === "this_month") return ts >= startOfMonth;
  return true;
};

const ActivityTimeline = () => {
  const [loading, setLoading] = useState(true);
  const [liveActivities, setLiveActivities] = useState([]);
  const [apiError, setApiError] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");
  const [timeFilter, setTimeFilter] = useState("all_time");
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef(null);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const res = await fetch(`${BASE_URL}/activity/feed?limit=100`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setLiveActivities(json.activities || []);
      } catch (err) {
        console.warn(
          "ActivityTimeline: backend offline, using static data.",
          err.message,
        );
        setApiError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchActivities();
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (exportRef.current && !exportRef.current.contains(e.target)) {
        setExportOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const allActivities = useMemo(() => {
    const combined = [...liveActivities, ...ALL_ACTIVITIES];
    const seen = new Set();
    const unique = combined.filter((a) => {
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    });
    unique.sort((a, b) => {
      const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return tb - ta;
    });
    return unique;
  }, [liveActivities]);

  const filtered = useMemo(() => {
    let result = allActivities.filter((a) => isInPeriod(a, timeFilter));

    if (activeFilter !== "all") {
      result = result.filter((a) => a.type === activeFilter);
    }

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
  }, [allActivities, activeFilter, timeFilter, searchQuery]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  const handleFilterChange = (val) => {
    setActiveFilter(val);
    setVisibleCount(PAGE_SIZE);
  };

  const handleTimeFilterChange = (val) => {
    setTimeFilter(val);
    setVisibleCount(PAGE_SIZE);
  };

  const handleSearchChange = (val) => {
    setSearchQuery(val);
    setVisibleCount(PAGE_SIZE);
  };

  const handleLoadMore = () => setVisibleCount((prev) => prev + PAGE_SIZE);

  const handleExport = (format) => {
    setExportOpen(false);
    const timestamp = new Date().toISOString().slice(0, 10);
    if (format === "csv") exportCSV(filtered, `activity_log_${timestamp}.csv`);
    else if (format === "excel")
      exportExcel(filtered, `activity_log_${timestamp}.xls`);
    else if (format === "pdf")
      exportPDF(filtered, `activity_log_${timestamp}.pdf`);
  };

  if (loading) return <PageLoader message="Memuat activity timeline..." />;

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
          {!apiError && liveActivities.length > 0 && (
            <span className="badge-live">
              <i
                className="bi bi-circle-fill"
                style={{ fontSize: ".45rem" }}
              ></i>
              {liveActivities.length} live events
            </span>
          )}
          {apiError && (
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
                  Export {filtered.length} activities
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
                <button
                  className="export-option"
                  onClick={() => handleExport("pdf")}
                >
                  <span className="export-option-icon pdf-icon">
                    <i className="bi bi-file-earmark-pdf"></i>
                  </span>
                  <div className="export-option-text">
                    <strong>PDF / Print</strong>
                    <span>Print-ready document</span>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <ActivityStatsBar activities={allActivities} />

      <ActivityToolbar
        activeFilter={activeFilter}
        onFilterChange={handleFilterChange}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        totalCount={filtered.length}
        timeFilter={timeFilter}
        onTimeFilterChange={handleTimeFilterChange}
      />

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
