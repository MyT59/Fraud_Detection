import React, { useState, useRef, useEffect } from "react";

const TimeRangeSelector = ({ selectedRange, onRangeChange }) => {
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [customLabel, setCustomLabel] = useState("Custom");
  const pickerRef = useRef(null);

  const ranges = [
    { value: "today", label: "Today" },
    { value: "week", label: "7 days" },
    { value: "month", label: "30 days" },
    { value: "year", label: "1 year" },
  ];

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setShowCustomPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const applyCustomRange = () => {
    if (!customStart || !customEnd) return;
    const fmt = (d) => {
      const date = new Date(d);
      return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
      });
    };
    setCustomLabel(`${fmt(customStart)} – ${fmt(customEnd)}`);
    onRangeChange("custom");
    setShowCustomPicker(false);
  };

  return (
    <div
      style={{ position: "relative", display: "inline-flex", gap: 0 }}
      ref={pickerRef}
    >
      <div
        style={{
          display: "inline-flex",
          background: "#f3f4f6",
          borderRadius: 10,
          padding: "3px",
          gap: 2,
        }}
      >
        {ranges.map((range) => {
          const isActive = selectedRange === range.value;
          return (
            <button
              key={range.value}
              type="button"
              onClick={() => {
                onRangeChange(range.value);
                setShowCustomPicker(false);
              }}
              style={{
                padding: "6px 14px",
                borderRadius: 7,
                border: "none",
                cursor: "pointer",
                fontSize: "0.82rem",
                fontWeight: 600,
                transition: "all 0.18s ease",
                background: isActive ? "#fff" : "transparent",
                color: isActive ? "#dc2626" : "#6b7280",
                boxShadow: isActive
                  ? "0 1px 4px rgba(0,0,0,0.12), 0 0 0 1px rgba(220,38,38,0.15)"
                  : "none",
                whiteSpace: "nowrap",
              }}
            >
              {range.label}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setShowCustomPicker((p) => !p)}
          style={{
            padding: "6px 12px",
            borderRadius: 7,
            border: "none",
            cursor: "pointer",
            fontSize: "0.82rem",
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            transition: "all 0.18s ease",
            background: selectedRange === "custom" ? "#fff" : "transparent",
            color: selectedRange === "custom" ? "#dc2626" : "#6b7280",
            boxShadow:
              selectedRange === "custom"
                ? "0 1px 4px rgba(0,0,0,0.12), 0 0 0 1px rgba(220,38,38,0.15)"
                : "none",
            whiteSpace: "nowrap",
          }}
        >
          <i className="bi bi-calendar3" style={{ fontSize: "0.8rem" }}></i>
          {selectedRange === "custom" ? customLabel : "Custom"}
          <i
            className={`bi bi-chevron-${showCustomPicker ? "up" : "down"}`}
            style={{ fontSize: "0.65rem" }}
          ></i>
        </button>
      </div>

      {showCustomPicker && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            padding: "1rem 1.25rem",
            zIndex: 1050,
            minWidth: 280,
            animation: "fadeSlideDown 0.18s ease",
          }}
        >
          <style>{`
            @keyframes fadeSlideDown {
              from { opacity: 0; transform: translateY(-6px); }
              to   { opacity: 1; transform: translateY(0); }
            }
          `}</style>

          <div
            style={{
              fontSize: "0.78rem",
              fontWeight: 600,
              color: "#6b7280",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              marginBottom: "0.75rem",
            }}
          >
            <i className="bi bi-calendar-range me-1"></i>Custom Range
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.78rem",
                  fontWeight: 500,
                  color: "#374151",
                  marginBottom: 4,
                }}
              >
                Start Date
              </label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                max={customEnd || undefined}
                style={{
                  width: "100%",
                  padding: "7px 10px",
                  border: "1.5px solid #e5e7eb",
                  borderRadius: 8,
                  fontSize: "0.85rem",
                  color: "#262626",
                  outline: "none",
                  transition: "border-color 0.15s",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#dc2626")}
                onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
              />
            </div>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.78rem",
                  fontWeight: 500,
                  color: "#374151",
                  marginBottom: 4,
                }}
              >
                End Date
              </label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                min={customStart || undefined}
                style={{
                  width: "100%",
                  padding: "7px 10px",
                  border: "1.5px solid #e5e7eb",
                  borderRadius: 8,
                  fontSize: "0.85rem",
                  color: "#262626",
                  outline: "none",
                  transition: "border-color 0.15s",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#dc2626")}
                onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
              />
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              marginTop: "0.875rem",
            }}
          >
            <button
              type="button"
              onClick={() => setShowCustomPicker(false)}
              style={{
                flex: 1,
                padding: "7px",
                border: "1.5px solid #e5e7eb",
                borderRadius: 8,
                background: "#fff",
                color: "#6b7280",
                fontSize: "0.82rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={applyCustomRange}
              disabled={!customStart || !customEnd}
              style={{
                flex: 1,
                padding: "7px",
                border: "none",
                borderRadius: 8,
                background: customStart && customEnd ? "#dc2626" : "#f3f4f6",
                color: customStart && customEnd ? "#fff" : "#9ca3af",
                fontSize: "0.82rem",
                fontWeight: 600,
                cursor: customStart && customEnd ? "pointer" : "not-allowed",
                transition: "all 0.15s",
              }}
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimeRangeSelector;
