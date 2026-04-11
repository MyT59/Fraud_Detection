import React, { useState, useEffect, useRef } from "react";
import "./AnalyticsExportButton.css";

const exportAnalyticsPDF = async (analyticsData, timeRange, filename) => {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const timestamp = new Date().toLocaleString();

  doc.setFillColor(220, 38, 38);
  doc.rect(0, 0, pageW, 58, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Analytics Report — Fraud Detection System", 32, 34);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Time Range: ${timeRange.toUpperCase()}   |   Generated: ${timestamp}`,
    32,
    50,
  );

  const sectionTitle = (label, y) => {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(220, 38, 38);
    doc.text(label, 32, y);
    doc.setDrawColor(220, 38, 38);
    doc.setLineWidth(0.8);
    doc.line(32, y + 3, pageW - 32, y + 3);
  };

  const tableDefaults = {
    styles: {
      fontSize: 8.5,
      cellPadding: { top: 5, right: 8, bottom: 5, left: 8 },
      lineColor: [229, 231, 235],
      lineWidth: 0.4,
      textColor: [55, 65, 81],
    },
    headStyles: {
      fillColor: [220, 38, 38],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
    },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    margin: { left: 32, right: 32 },
  };

  let cursorY = 76;
  sectionTitle("1. Monthly Transaction Data", cursorY);

  const monthlyBody = (analyticsData.monthlyData || []).map((item) => {
    const rate =
      item.transactions > 0
        ? ((item.fraud / item.transactions) * 100).toFixed(2) + "%"
        : "0.00%";
    return [
      item.month || item.label || "",
      (item.transactions || 0).toLocaleString(),
      (item.fraud || 0).toLocaleString(),
      (item.legit || 0).toLocaleString(),
      rate,
    ];
  });

  autoTable(doc, {
    ...tableDefaults,
    startY: cursorY + 10,
    head: [["Month", "Total Transactions", "Fraud", "Legit", "Fraud Rate"]],
    body: monthlyBody,
    didParseCell(data) {
      if (data.section === "body" && data.column.index === 2)
        data.cell.styles.textColor = [220, 38, 38];
      if (data.section === "body" && data.column.index === 3)
        data.cell.styles.textColor = [5, 150, 105];
    },
  });

  cursorY = doc.lastAutoTable.finalY + 22;
  sectionTitle("2. Location Analysis", cursorY);

  const locationBody = (analyticsData.locationData || []).map((item) => {
    const rate =
      item.total > 0
        ? ((item.fraud / item.total) * 100).toFixed(2) + "%"
        : "0.00%";
    return [
      item.location || "",
      (item.total || 0).toLocaleString(),
      (item.fraud || 0).toLocaleString(),
      (item.legit || 0).toLocaleString(),
      rate,
    ];
  });

  autoTable(doc, {
    ...tableDefaults,
    startY: cursorY + 10,
    head: [["Location", "Total", "Fraud", "Legit", "Fraud Rate"]],
    body: locationBody,
    didParseCell(data) {
      if (data.section === "body" && data.column.index === 2)
        data.cell.styles.textColor = [220, 38, 38];
      if (data.section === "body" && data.column.index === 3)
        data.cell.styles.textColor = [5, 150, 105];
    },
  });

  cursorY = doc.lastAutoTable.finalY + 22;

  if (cursorY > doc.internal.pageSize.getHeight() - 120) {
    doc.addPage();
    cursorY = 40;
  }

  sectionTitle("3. Fraud Summary", cursorY);

  const fs = analyticsData.fraudStats || {};
  const total = (fs.fraud || 0) + (fs.legit || 0);
  const fraudRate = total > 0 ? ((fs.fraud / total) * 100).toFixed(2) : "0.00";

  autoTable(doc, {
    ...tableDefaults,
    startY: cursorY + 10,
    head: [["Metric", "Value"]],
    body: [
      ["Total Transactions", total.toLocaleString()],
      ["Fraud Transactions", (fs.fraud || 0).toLocaleString()],
      ["Legit Transactions", (fs.legit || 0).toLocaleString()],
      ["Overall Fraud Rate", `${fraudRate}%`],
      [
        "ML Model Accuracy",
        analyticsData.modelAccuracy ? `${analyticsData.modelAccuracy}%` : "—",
      ],
    ],
    columnStyles: { 0: { fontStyle: "bold" } },
  });

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(156, 163, 175);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Fraud Detection System  |  Analytics Report  |  Page ${i} of ${pageCount}`,
      32,
      doc.internal.pageSize.getHeight() - 14,
    );
  }

  doc.save(filename);
};

const AnalyticsExportButton = ({ analyticsData, timeRange }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportingFormat, setExportingFormat] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const timestamp = new Date().getTime();

  const handleExport = async (format) => {
    if (isExporting) return;
    setIsExporting(true);
    setExportingFormat(format);

    try {
      if (format === "csv") {
        let csv = `Analytics Report\nTime Range: ${timeRange}\nExport Date: ${new Date().toLocaleString()}\n\n`;
        csv +=
          "MONTHLY TRANSACTION DATA\nMonth,Total Transactions,Fraud,Legit,Fraud Rate\n";
        (analyticsData.monthlyData || []).forEach((item) => {
          const rate =
            item.transactions > 0
              ? ((item.fraud / item.transactions) * 100).toFixed(2)
              : "0.00";
          csv += `${item.month || item.label},${item.transactions},${item.fraud},${item.legit},${rate}%\n`;
        });
        csv += "\nLOCATION ANALYSIS\nLocation,Total,Fraud,Legit,Fraud Rate\n";
        (analyticsData.locationData || []).forEach((item) => {
          const rate =
            item.total > 0
              ? ((item.fraud / item.total) * 100).toFixed(2)
              : "0.00";
          csv += `${item.location},${item.total},${item.fraud},${item.legit},${rate}%\n`;
        });

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `analytics_report_${timeRange}_${timestamp}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (format === "excel") {
        const monthlyRows = (analyticsData.monthlyData || [])
          .map((item) => {
            const rate =
              item.transactions > 0
                ? ((item.fraud / item.transactions) * 100).toFixed(2)
                : "0.00";
            return `<tr>
            <td>${item.month || item.label}</td>
            <td>${item.transactions}</td>
            <td style="color:#ef4444">${item.fraud}</td>
            <td style="color:#10b981">${item.legit}</td>
            <td>${rate}%</td>
          </tr>`;
          })
          .join("");

        const locationRows = (analyticsData.locationData || [])
          .map((item) => {
            const rate =
              item.total > 0
                ? ((item.fraud / item.total) * 100).toFixed(2)
                : "0.00";
            return `<tr>
            <td>${item.location}</td>
            <td>${item.total}</td>
            <td style="color:#ef4444">${item.fraud}</td>
            <td style="color:#10b981">${item.legit}</td>
            <td>${rate}%</td>
          </tr>`;
          })
          .join("");

        const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns="http://www.w3.org/TR/REC-html40">
          <head><meta charset="UTF-8"></head><body>
          <table border="1"><thead>
            <tr><th colspan="5" style="background:#dc2626;color:white">MONTHLY TRANSACTION DATA</th></tr>
            <tr><th>Month</th><th>Total</th><th>Fraud</th><th>Legit</th><th>Fraud Rate</th></tr>
          </thead><tbody>${monthlyRows}</tbody></table>
          <br/>
          <table border="1"><thead>
            <tr><th colspan="5" style="background:#dc2626;color:white">LOCATION ANALYSIS</th></tr>
            <tr><th>Location</th><th>Total</th><th>Fraud</th><th>Legit</th><th>Fraud Rate</th></tr>
          </thead><tbody>${locationRows}</tbody></table>
          </body></html>`;

        const blob = new Blob([html], {
          type: "application/vnd.ms-excel;charset=utf-8;",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `analytics_report_${timeRange}_${timestamp}.xls`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (format === "pdf") {
        await exportAnalyticsPDF(
          analyticsData,
          timeRange,
          `analytics_report_${timeRange}_${timestamp}.pdf`,
        );
      }

      setShowDropdown(false);
    } catch (err) {
      console.error(`Export ${format} error:`, err);
    } finally {
      setIsExporting(false);
      setExportingFormat(null);
    }
  };

  const options = [
    {
      format: "csv",
      icon: "bi-filetype-csv",
      title: "CSV Report",
      desc: "Comma-separated values for spreadsheets",
      iconColor: "#059669",
      iconBg: "#f0fdf4",
    },
    {
      format: "excel",
      icon: "bi-file-earmark-spreadsheet",
      title: "Excel Report",
      desc: "Formatted Excel spreadsheet (.xls)",
      iconColor: "#16a34a",
      iconBg: "#f0fdf4",
    },
    {
      format: "pdf",
      icon: "bi-file-earmark-pdf",
      title: "PDF Report",
      desc: "Full report with tables, direct download",
      iconColor: "#dc2626",
      iconBg: "#fef2f2",
    },
  ];

  return (
    <div className="analytics-export-container" ref={containerRef}>
      <button
        className="btn btn-danger analytics-export-btn"
        onClick={() => setShowDropdown((v) => !v)}
        disabled={isExporting}
      >
        {isExporting ? (
          <>
            <span className="spinner-border spinner-border-sm me-2"></span>
            Exporting {exportingFormat?.toUpperCase()}...
          </>
        ) : (
          <>
            <i className="bi bi-file-earmark-arrow-down me-2"></i>
            Export Report
            <i
              className={`bi bi-chevron-${showDropdown ? "up" : "down"} ms-2`}
              style={{ fontSize: "0.65rem" }}
            ></i>
          </>
        )}
      </button>

      {showDropdown && (
        <div className="analytics-export-dropdown">
          <div className="dropdown-header">
            <i className="bi bi-download me-2"></i>
            Choose Export Format
          </div>

          {options.map((opt) => (
            <button
              key={opt.format}
              className="dropdown-item"
              onClick={() => handleExport(opt.format)}
              disabled={isExporting}
            >
              <div className="export-option">
                <div className="export-icon" style={{ background: opt.iconBg }}>
                  <i
                    className={`bi ${opt.icon}`}
                    style={{ color: opt.iconColor }}
                  ></i>
                </div>
                <div className="export-info">
                  <div className="export-title">{opt.title}</div>
                  <div className="export-desc">{opt.desc}</div>
                </div>
                {exportingFormat === opt.format && (
                  <span
                    className="spinner-border spinner-border-sm ms-auto"
                    style={{ color: opt.iconColor, flexShrink: 0 }}
                  ></span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default AnalyticsExportButton;
