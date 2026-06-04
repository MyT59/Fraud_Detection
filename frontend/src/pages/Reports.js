import React, { useState, useEffect } from "react";
import ReportGenerator from "../components/reports/ReportGenerator";
import ReportList from "../components/reports/ReportList";
import ReportPreview from "../components/reports/ReportPreview";
import ReportShareModal from "../components/reports/ReportShareModal";
import "./Reports.css";
import PageLoader from "../components/common/PageLoader";

const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randPick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const CHANNELS = ["Mobile", "Web", "ATM", "EDC"];
const LOCATIONS = [
  "Jakarta",
  "Surabaya",
  "Bandung",
  "Medan",
  "Makassar",
  "Palembang",
  "Denpasar",
];

const generateRows = (dateFrom, dateTo, count = 40) => {
  const from = new Date(dateFrom).getTime();
  const to = new Date(dateTo).getTime();
  const range = to - from || 1;
  return Array.from({ length: count }, (_, i) => ({
    id: `TXN${String(i + 1).padStart(5, "0")}`,
    date: new Date(from + Math.random() * range).toISOString().split("T")[0],
    amount: randInt(50_000, 10_000_000),
    status: Math.random() > 0.15 ? "Legit" : "Fraud",
    channel: randPick(CHANNELS),
    location: randPick(LOCATIONS),
    agent: `AGT${String(randInt(1, 200)).padStart(4, "0")}`,
  }));
};

const buildPreviewData = (reportTypes, dateFrom, dateTo) => {
  const rows = generateRows(dateFrom, dateTo, 40);
  const fraudRows = rows.filter((r) => r.status === "Fraud");
  const legitRows = rows.filter((r) => r.status === "Legit");
  const total = rows.length;
  const fraudCount = fraudRows.length;
  const legitCount = legitRows.length;
  const fraudRate = (fraudCount / total) * 100;
  const legitRate = (legitCount / total) * 100;

  const sum = (arr) => arr.reduce((s, r) => s + r.amount, 0);
  const totalAmount = sum(rows);
  const fraudAmount = sum(fraudRows);
  const legitAmount = sum(legitRows);

  const byLocation = {};
  rows.forEach((r) => {
    byLocation[r.location] = (byLocation[r.location] || 0) + 1;
  });

  const byChannel = {};
  rows.forEach((r) => {
    byChannel[r.channel] = (byChannel[r.channel] || 0) + 1;
  });

  const byDateMap = {};
  rows.forEach((r) => {
    if (!byDateMap[r.date])
      byDateMap[r.date] = {
        date: r.date,
        total: 0,
        fraudCount: 0,
        legitCount: 0,
      };
    byDateMap[r.date].total++;
    if (r.status === "Fraud") byDateMap[r.date].fraudCount++;
    else byDateMap[r.date].legitCount++;
  });
  const byDate = Object.values(byDateMap)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({
      ...d,
      fraudRate: d.total ? (d.fraudCount / d.total) * 100 : 0,
      legitRate: d.total ? (d.legitCount / d.total) * 100 : 0,
    }));

  const baseData = {
    total,
    fraudCount,
    legitCount,
    fraudRate,
    legitRate,
    totalAmount,
    fraudAmount,
    legitAmount,
    byChannel,
    byLocation,
    byDate,
    rows,
  };

  const preview = {};
  reportTypes.forEach((rt) => {
    preview[rt] = { ...baseData };
  });
  return preview;
};

const generateReportHistory = () => {
  const types = [
    "Monthly Summary",
    "Fraud Analysis",
    "Transaction Report",
    "Location Analysis",
    "Custom Report",
  ];
  const statuses = ["Completed", "Processing", "Failed"];
  const formats = ["PDF", "Excel", "CSV"];
  const reports = [];
  for (let i = 1; i <= 15; i++) {
    const randomDate = new Date(
      2026,
      Math.floor(Math.random() * 12),
      Math.floor(Math.random() * 28) + 1,
    );
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const weight =
      status === "Completed" ? 8 : status === "Processing" ? 1.5 : 0.5;
    const weightedStatus = Math.random() < weight / 10 ? status : "Completed";
    reports.push({
      id: `RPT${String(i).padStart(4, "0")}`,
      type: types[Math.floor(Math.random() * types.length)],
      format: formats[Math.floor(Math.random() * formats.length)],
      generatedDate: randomDate.toISOString(),
      status: weightedStatus,
      size: `${Math.floor(Math.random() * 5000) + 500} KB`,
      generatedBy: ["Admin", "System", "User"][Math.floor(Math.random() * 3)],
    });
  }
  return reports.sort(
    (a, b) => new Date(b.generatedDate) - new Date(a.generatedDate),
  );
};

const ReportPreviewModal = ({
  report,
  isOpen,
  onClose,
  onDownload,
  onShare,
}) => {
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen || !report) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(12,12,14,0.45)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          zIndex: 1050,
        }}
      />
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1055,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
          pointerEvents: "none",
        }}
      >
        <div
          className="report-preview-modal-content"
          style={{
            pointerEvents: "all",
            width: "100%",
            maxWidth: "760px",
            margin: 0,
          }}
        >
          <div className="preview-modal-header">
            <div className="preview-modal-title-group">
              <i className="bi bi-eye text-danger me-2"></i>
              <span>Report Preview</span>
            </div>
            <div className="preview-modal-header-actions">
              <button
                className="btn-modal-close"
                onClick={onClose}
                title="Close"
              >
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
          </div>
          <div className="preview-modal-body">
            <ReportPreview report={report} onDownload={onDownload} />
          </div>
        </div>
      </div>
    </>
  );
};

const Reports = () => {
  const [loading, setLoading] = useState(true);
  const [reportHistory, setReportHistory] = useState(generateReportHistory());
  const [selectedReport, setSelectedReport] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);

  const [showShareModal, setShowShareModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [activeTab, setActiveTab] = useState("reports");

  const handleGenerateReport = (reportData) => {
    const { layanan, reportTypes, format, dateFrom, dateTo } = reportData;

    const layananLabel = layanan === "agenusa" ? "Agenusa" : "Nusabill";
    const typeLabel = `${layananLabel} — ${reportTypes
      .map(
        (rt) =>
          ({
            fraud: "Fraud",
            legit: "Legit",
            fraud_rate: "Fraud Rate",
            legit_rate: "Legit Rate",
            transactions: "Transactions",
          })[rt] ?? rt,
      )
      .join(", ")}`;

    const previewData = buildPreviewData(reportTypes, dateFrom, dateTo);

    const newReport = {
      id: `RPT${String(reportHistory.length + 1).padStart(4, "0")}`,
      type: typeLabel,
      format,
      generatedDate: new Date().toISOString(),
      status: "Processing",
      size: "Generating...",
      generatedBy: "Admin",

      layanan,
      reportTypes,
      dateFrom,
      dateTo,
      previewData,
    };

    setReportHistory((prev) => [newReport, ...prev]);

    setTimeout(() => {
      setReportHistory((prev) =>
        prev.map((r) =>
          r.id === newReport.id
            ? {
                ...r,
                status: "Completed",
                size: `${Math.floor(Math.random() * 5000) + 500} KB`,
              }
            : r,
        ),
      );

      setSelectedReport((prev) =>
        prev && prev.id === newReport.id
          ? {
              ...prev,
              status: "Completed",
              size: `${Math.floor(Math.random() * 5000) + 500} KB`,
            }
          : prev,
      );
    }, 3000);

    setShowGenerator(false);
    setActiveTab("reports");
  };

  const handleViewReport = (report) => {
    setSelectedReport(report);
    setShowPreviewModal(true);
  };

  const handleClosePreview = () => setShowPreviewModal(false);

  const handleDeleteReport = (reportId) => {
    setReportHistory((prev) => prev.filter((r) => r.id !== reportId));
    if (selectedReport?.id === reportId) {
      setSelectedReport(null);
      setShowPreviewModal(false);
    }
  };

  const handleDownloadReport = (report) => {
    alert(`Downloading ${report.type} (${report.format})...`);
  };

  const filteredReports =
    filterStatus === "all"
      ? reportHistory
      : reportHistory.filter((r) => r.status === filterStatus);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  if (loading) return <PageLoader message="Memuat data laporan..." />;

  return (
    <div className="reports-page">
      <div className="container-fluid py-4">
        <div className="page-header mb-3">
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
            <div>
              <h1 className="page-title">
                <i className="bi bi-file-earmark-text"></i> Reports
              </h1>
              <p className="page-subtitle">
                Generate and manage fraud detection reports
              </p>
            </div>
            <div className="header-actions">
              <button
                className="btn btn-danger"
                onClick={() => {
                  setShowGenerator(!showGenerator);

                  setActiveTab("reports");
                }}
              >
                <i className="bi bi-plus-circle me-2"></i>New Report
              </button>
            </div>
          </div>
        </div>

        {showGenerator && activeTab === "reports" && (
          <div className="report-generator-container mb-4">
            <ReportGenerator
              onGenerate={handleGenerateReport}
              onCancel={() => setShowGenerator(false)}
            />
          </div>
        )}

        {activeTab === "reports" && (
          <div className="row">
            <div className="col-12 mb-4">
              <div className="card reports-list-card reports-list-card--full">
                <div className="card-header">
                  <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                    <h5 className="card-title mb-0">
                      <i className="bi bi-table me-2"></i>
                      Report History
                      <span className="report-count-badge ms-2">
                        {filteredReports.length}
                      </span>
                    </h5>
                    <div className="filter-buttons">
                      {["all", "Completed", "Processing", "Failed"].map((s) => (
                        <button
                          key={s}
                          className={`btn btn-sm ${
                            filterStatus === s
                              ? s === "all"
                                ? "btn-danger"
                                : s === "Completed"
                                  ? "btn-success"
                                  : s === "Processing"
                                    ? "btn-warning"
                                    : "btn-danger"
                              : "btn-outline-secondary"
                          }`}
                          onClick={() => setFilterStatus(s)}
                        >
                          {s === "all" ? "All" : s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="card-body p-0">
                  <ReportList
                    reports={filteredReports}
                    onViewReport={handleViewReport}
                    onDeleteReport={handleDeleteReport}
                    onDownloadReport={handleDownloadReport}
                    selectedReportId={selectedReport?.id}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <ReportPreviewModal
        report={selectedReport}
        isOpen={showPreviewModal}
        onClose={handleClosePreview}
        onDownload={() =>
          selectedReport && handleDownloadReport(selectedReport)
        }
        onShare={() => setShowShareModal(true)}
      />

      <ReportShareModal
        report={selectedReport}
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        onShare={(data) => console.log("Share report:", data)}
      />
    </div>
  );
};

export default Reports;
