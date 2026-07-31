import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Line, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { api } from "../../services/apiService";
import "./ChartCard.css";
import "./TransactionChart.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

const emptyToday = () =>
  Array.from({ length: 24 }, (_, h) => ({
    label: `${String(h).padStart(2, "0")}:00`,
    transactions: 0,
    fraud: 0,
  }));

const emptyLastNDays = (n) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (n - 1 - i));
    return {
      label: `${d.getDate()}/${d.getMonth() + 1}`,
      transactions: 0,
      fraud: 0,
    };
  });
};

const emptyLast12Months = () => {
  const MONTHS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    return {
      label: MONTHS[d.getMonth()],
      transactions: 0,
      fraud: 0,
    };
  });
};

const buildEmptyData = () => ({
  today: emptyToday(),
  "7d": emptyLastNDays(7),
  "30d": emptyLastNDays(30),
  "1y": emptyLast12Months(),
});

const mapTrendResponse = (raw, range) => {
  if (!Array.isArray(raw) || raw.length === 0) return null;

  return raw.map((d) => {
    if (d.hour !== undefined) {
      return {
        label: `${String(d.hour).padStart(2, "0")}:00`,
        transactions: d.total || d.transactions || 0,
        fraud: d.fraud || 0,
      };
    }

    if (d.date !== undefined) {
      const dt = new Date(d.date);
      return {
        label: `${dt.getDate()}/${dt.getMonth() + 1}`,
        transactions: d.total || d.transactions || 0,
        fraud: d.fraud || 0,
      };
    }

    if (d.month !== undefined) {
      const MONTHS = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      return {
        label: MONTHS[(d.month - 1) % 12] || String(d.month),
        transactions: d.total || d.transactions || 0,
        fraud: d.fraud || 0,
      };
    }

    return {
      label: d.day || d.label || "",
      transactions: d.total || d.transactions || 0,
      fraud: d.fraud || 0,
    };
  });
};

const RANGE_OPTIONS = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "1y", label: "1 year" },
  { key: "custom", label: "Custom", isCalendar: true },
];

const RANGE_TO_API = {
  today: "today",
  "7d": "weekly",
  "30d": "monthly",
  "1y": "yearly",
};

const CARD_TITLES = {
  today: "Transactions Today",
  "7d": "Transactions Per Week",
  "30d": "Transactions Per Month",
  "1y": "Transactions Per One Year",
  custom: "Transactions Per Date",
};

const CARD_SUBTITLES = {
  today: (() => {
    const d = new Date();
    return `${d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} — hourly`;
  })(),
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "1y": "Last 12 months",
  custom: "Custom date range",
};

const DEFAULT_RANGE = "today";

const TransactionChart = ({ data, onRangeChange }) => {
  const [activeRange, setActiveRange] = useState(DEFAULT_RANGE);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(new Date().toISOString().split("T")[0]);

  const [apiData, setApiData] = useState({});
  const [customData, setCustomData] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [isFetchingRange, setIsFetchingRange] = useState(false);
  const [rangeError, setRangeError] = useState(null);

  const emptyData = useMemo(() => buildEmptyData(), []);

  useEffect(() => {
    if (!expanded) return;
    const handler = (e) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [expanded]);

  useEffect(() => {
    document.body.style.overflow = expanded ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [expanded]);

  const fetchRangeData = useCallback(
    async (range) => {
      if (!RANGE_TO_API[range] || range === "today") return;

      if (apiData[range]) return;

      setIsFetchingRange(true);
      try {
        const raw = await api.get(
          `/dashboard/transactions/trend/detail?range=${RANGE_TO_API[range]}`,
        );
        const mapped = mapTrendResponse(raw, range);
        if (mapped && mapped.length > 0) {
          setApiData((prev) => ({ ...prev, [range]: mapped }));
          if (onRangeChange) onRangeChange(range, { data: mapped });
        } else if (onRangeChange) {
          onRangeChange(range, { data: emptyData[range] || [] });
        }
      } catch (err) {
        console.warn(
          `[TransactionChart] Gagal fetch range "${range}":`,
          err.message,
        );
        if (onRangeChange) onRangeChange(range, { data: emptyData[range] || [] });
      } finally {
        setIsFetchingRange(false);
      }
    },
    [apiData, emptyData, onRangeChange],
  );

  const chartData = useMemo(() => {
    if (activeRange === "today") {
      return data && data.length > 0 ? data : emptyData.today;
    }
    if (activeRange === "custom" && customData) return customData;

    return (
      apiData[activeRange] ||
      emptyData[activeRange] ||
      emptyData[DEFAULT_RANGE]
    );
  }, [activeRange, customData, data, emptyData, apiData]);

  const handleRangeClick = (key) => {
    setRangeError(null);
    if (key === "custom") {
      setShowDatePicker((p) => !p);
      return;
    }
    setShowDatePicker(false);
    setActiveRange(key);
    if (key === "today") {
      if (onRangeChange) onRangeChange(key, { data: data || emptyData.today });
    } else if (apiData[key]) {
      if (onRangeChange) onRangeChange(key, { data: apiData[key] });
    } else if (onRangeChange) {
      onRangeChange(key, { data: emptyData[key] || [] });
    }

    fetchRangeData(key);
  };

  const handleReset = () => {
    setRangeError(null);
    setActiveRange(DEFAULT_RANGE);
    setShowDatePicker(false);
    setCustomData(null);
    const d = new Date();
    d.setDate(d.getDate() - 7);
    setDateFrom(d.toISOString().split("T")[0]);
    setDateTo(new Date().toISOString().split("T")[0]);
    if (onRangeChange) onRangeChange(DEFAULT_RANGE, { data: data || emptyData.today });
  };

  const handleApplyCustom = async () => {
    if (!dateFrom || !dateTo || dateTo < dateFrom) {
      setRangeError("Tanggal awal harus sebelum atau sama dengan tanggal akhir.");
      return;
    }

    setRangeError(null);

    setIsFetchingRange(true);
    try {
      const raw = await api.get(
        `/dashboard/transactions/trend/detail?range=custom&start=${dateFrom}&end=${dateTo}`,
      );
      const mapped = mapTrendResponse(raw, "custom");
      if (mapped && mapped.length > 0) {
        setCustomData(mapped);
        setActiveRange("custom");
        setShowDatePicker(false);
        if (onRangeChange)
          onRangeChange("custom", { from: dateFrom, to: dateTo, data: mapped });
        return;
      }
      setCustomData([]);
      setActiveRange("custom");
      setShowDatePicker(false);
      if (onRangeChange)
        onRangeChange("custom", { from: dateFrom, to: dateTo, data: [] });
    } catch (err) {
      console.warn("[TransactionChart] Gagal fetch custom range:", err.message);
      setRangeError(err?.data?.detail || err?.message || "Gagal memuat rentang transaksi.");
    } finally {
      setIsFetchingRange(false);
    }
  };

  const buildChart = (fullLabels = false) => {
    const isToday = activeRange === "today";

    const datasets = isToday
      ? [
          {
            label: "Transactions",
            data: chartData.map((d) => d.transactions),
            backgroundColor: "rgba(220,38,38,0.72)",
            borderColor: "#dc2626",
            borderWidth: 1,
            borderRadius: 3,
            yAxisID: "y",
          },
          {
            label: "Fraud",
            data: chartData.map((d) => d.fraud || 0),
            backgroundColor: "rgba(252,165,165,0.85)",
            borderColor: "#fca5a5",
            borderWidth: 1,
            borderRadius: 3,
            yAxisID: "y1",
          },
        ]
      : [
          {
            label: "Transactions",
            data: chartData.map((d) => d.transactions),
            borderColor: "#dc2626",
            backgroundColor: "rgba(220,38,38,0.08)",
            borderWidth: 2,
            tension: 0.3,
            fill: true,
            pointRadius: activeRange === "1y" ? 4 : 3,
            pointHoverRadius: 6,
            pointBackgroundColor: "#dc2626",
            pointBorderColor: "#ffffff",
            pointBorderWidth: 2,
            yAxisID: "y",
          },
          {
            label: "Fraud",
            data: chartData.map((d) => d.fraud || 0),
            borderColor: "#fca5a5",
            backgroundColor: "rgba(252,165,165,0.05)",
            borderWidth: 1.5,
            tension: 0.3,
            fill: false,
            pointRadius: 2,
            pointHoverRadius: 4,
            pointBackgroundColor: "#fca5a5",
            pointBorderColor: "#ffffff",
            pointBorderWidth: 1.5,
            yAxisID: "y1",
          },
        ];

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#262626",
          padding: 12,
          titleFont: { size: 13, weight: "600" },
          bodyFont: { size: 14, weight: "600" },
          displayColors: true,
          cornerRadius: 6,
          callbacks: {
            label: (ctx) =>
              `${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString()}`,
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          position: "left",
          border: { display: false },
          grid: { color: "#f5f5f5", drawBorder: false },
          ticks: {
            font: { size: 12, weight: "500" },
            color: "#737373",
            padding: 8,
          },
        },
        y1: {
          beginAtZero: true,
          position: "right",
          border: { display: false },
          grid: { display: false },
          ticks: {
            font: { size: 12, weight: "500" },
            color: "#fca5a5",
            padding: 8,
          },
        },
        x: {
          border: { display: false },
          grid: { display: false },
          ticks: {
            font: { size: 12, weight: "600" },
            color: "#525252",
            padding: 8,
            maxRotation: 45,
            autoSkip: !fullLabels && chartData.length > 20,
            maxTicksLimit:
              !fullLabels && chartData.length > 20 ? 12 : undefined,
          },
        },
      },
    };

    return {
      Component: isToday ? Bar : Line,
      data: { labels: chartData.map((d) => d.label), datasets },
      options,
    };
  };

  const isDefault = activeRange === DEFAULT_RANGE && !showDatePicker;

  const LegendRow = () => (
    <div
      style={{
        display: "flex",
        gap: 10,
        marginTop: 8,
        flexWrap: "wrap",
        alignItems: "center",
      }}
    >
      {[
        { color: "#dc2626", label: "Transactions" },
        { color: "#fca5a5", label: "Fraud" },
      ].map(({ color, label }) => (
        <span
          key={label}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            fontSize: 11,
            color: "#737373",
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              background: color,
              display: "inline-block",
            }}
          />
          {label}
        </span>
      ))}

      {isFetchingRange && (
        <span
          style={{
            fontSize: 11,
            color: "#9ca3af",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <i
            className="bi bi-arrow-repeat"
            style={{ animation: "spin 1s linear infinite", fontSize: 10 }}
          ></i>
          Loading…
        </span>
      )}
    </div>
  );

  const FilterControls = ({ alignEnd = true }) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: alignEnd ? "flex-end" : "flex-start",
        gap: 8,
      }}
    >
      <div className="txn-filter-bar">
        {RANGE_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            className={`txn-filter-btn${
              activeRange === opt.key ||
              (opt.key === "custom" && showDatePicker)
                ? " active"
                : ""
            }${opt.isCalendar ? " calendar-btn" : ""}`}
            onClick={() => handleRangeClick(opt.key)}
            disabled={isFetchingRange}
            title={opt.isCalendar ? "Pick custom date range" : undefined}
          >
            {opt.isCalendar && (
              <i className="bi bi-calendar3" style={{ fontSize: 11 }} />
            )}
            {opt.label}
          </button>
        ))}
        {!isDefault && (
          <button
            className="txn-filter-btn txn-reset-btn"
            onClick={handleReset}
            title="Reset to Today"
            disabled={isFetchingRange}
          >
            <i
              className="bi bi-arrow-counterclockwise"
              style={{ fontSize: 11 }}
            />
            Reset
          </button>
        )}
      </div>

      {showDatePicker && (
        <div>
          <div className="txn-date-row">
          <input
            type="date"
            value={dateFrom}
            max={dateTo}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <span style={{ fontSize: 11, color: "#9ca3af" }}>→</span>
          <input
            type="date"
            value={dateTo}
            min={dateFrom}
            max={new Date().toISOString().split("T")[0]}
            onChange={(e) => setDateTo(e.target.value)}
          />
          <button
            className="txn-apply-btn"
            onClick={handleApplyCustom}
            disabled={isFetchingRange}
          >
            {isFetchingRange ? "..." : "Apply"}
          </button>
          </div>
          {rangeError && (
            <div style={{ color: "#dc2626", fontSize: 11 }}>{rangeError}</div>
          )}
        </div>
      )}
    </div>
  );

  const ExpandedView = () => {
    const { Component: EC, data: ed, options: eo } = buildChart(true);
    const colLabel =
      activeRange === "today"
        ? "Hour"
        : activeRange === "1y"
          ? "Month"
          : "Date";

    return (
      <div className="txn-expand-overlay" onClick={() => setExpanded(false)}>
        <div className="txn-expand-modal" onClick={(e) => e.stopPropagation()}>
          <div className="txn-expand-header">
            <div>
              <h3 className="chart-title" style={{ fontSize: 16 }}>
                {CARD_TITLES[activeRange] || "Transactions"}
              </h3>
              <p className="chart-subtitle">{CARD_SUBTITLES[activeRange]}</p>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <FilterControls />
              <button
                className="txn-icon-btn"
                onClick={() => setExpanded(false)}
                title="Close (Esc)"
              >
                <i className="bi bi-x-lg" style={{ fontSize: 14 }} />
              </button>
            </div>
          </div>

          <div style={{ position: "relative", height: 360, marginTop: 8 }}>
            <EC data={ed} options={{ ...eo, maintainAspectRatio: false }} />
          </div>
          <LegendRow />

          <div className="txn-expand-table-wrap">
            <table className="txn-expand-table">
              <thead>
                <tr>
                  <th>{colLabel}</th>
                  <th>Transactions</th>
                  <th>Fraud</th>
                  <th>Legitimate</th>
                  <th>Fraud Rate</th>
                </tr>
              </thead>
              <tbody>
                {chartData.map((row, i) => {
                  const fraud = row.fraud || 0;
                  const legit = row.transactions - fraud;
                  const rate =
                    row.transactions > 0
                      ? ((fraud / row.transactions) * 100).toFixed(1)
                      : "0.0";
                  const rateClass =
                    parseFloat(rate) >= 10
                      ? "high"
                      : parseFloat(rate) >= 5
                        ? "medium"
                        : "low";
                  return (
                    <tr key={i}>
                      <td className="txn-tbl-label">{row.label}</td>
                      <td>{row.transactions.toLocaleString()}</td>
                      <td style={{ color: "#dc2626", fontWeight: 600 }}>
                        {fraud.toLocaleString()}
                      </td>
                      <td style={{ color: "#16a34a" }}>
                        {legit.toLocaleString()}
                      </td>
                      <td>
                        <span className={`txn-rate-badge ${rateClass}`}>
                          {rate}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const { Component, data: cData, options: cOptions } = buildChart(false);

  return (
    <>
      <div className="chart-card-simple">
        <div className="chart-header" style={{ flexWrap: "wrap", gap: 12 }}>
          <div>
            <h3 className="chart-title">
              {CARD_TITLES[activeRange] || "Transactions"}
            </h3>
            <p className="chart-subtitle">{CARD_SUBTITLES[activeRange]}</p>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <FilterControls />
            <button
              className="txn-icon-btn"
              onClick={() => setExpanded(true)}
              title="Expand chart"
            >
              <i className="bi bi-arrows-fullscreen" style={{ fontSize: 13 }} />
            </button>
          </div>
        </div>

        <div className="chart-container">
          <Component data={cData} options={cOptions} />
          {chartData.every((d) => (d.transactions || 0) === 0 && (d.fraud || 0) === 0) && (
            <div className="txn-empty-overlay">No transaction data for this range</div>
          )}
        </div>

        <LegendRow />
      </div>

      {expanded && <ExpandedView />}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
};

export default TransactionChart;
