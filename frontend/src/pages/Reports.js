import React, { useState, useEffect, useCallback } from "react";
import ReportGenerator from "../components/reports/ReportGenerator";
import ReportList from "../components/reports/ReportList";
import "./Reports.css";
import PageLoader from "../components/common/PageLoader";
import reportService from "../services/reportService";

const Reports = () => {
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState("all");
  const [showGenerator, setShowGenerator] = useState(false);

  const fetchReports = useCallback(async (page = 1, status = "all") => {
    try {
      const params = { page, limit: 20 };
      if (status !== "all") params.status = status.toUpperCase();
      const res = await reportService.getReports(params);
      setReports(res.items || []);
    } catch (err) {
      console.error("Failed to fetch reports:", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports(currentPage, filterStatus);
  }, [fetchReports, currentPage, filterStatus]);

  // Poll status untuk report yang masih PROCESSING/PENDING
  useEffect(() => {
    const processingIds = reports
      .filter((r) => r.status === "PROCESSING" || r.status === "PENDING")
      .map((r) => r.id);

    if (processingIds.length === 0) return;

    const interval = setInterval(async () => {
      let anyChange = false;
      const updated = await Promise.all(
        reports.map(async (r) => {
          if (r.status !== "PROCESSING" && r.status !== "PENDING") return r;
          try {
            const fresh = await reportService.getReportById(r.id);
            if (fresh.status !== r.status) anyChange = true;
            return fresh;
          } catch {
            return r;
          }
        }),
      );
      if (anyChange) setReports(updated);
    }, 3000);

    return () => clearInterval(interval);
  }, [reports]);

  const handleGenerateReport = (newReport) => {
    setReports((prev) => [newReport, ...prev]);
    setShowGenerator(false);
  };

  const handleDownloadReport = async (report) => {
    try {
      await reportService.downloadReport(report.id);
    } catch (err) {
      console.error("Download failed:", err.message);
      alert(`Gagal download report: ${err.message}`);
    }
  };

  const handleDeleteReport = async (reportId) => {
    try {
      await reportService.deleteReport(reportId);
      setReports((prev) => prev.filter((r) => r.id !== reportId));
    } catch (err) {
      console.error("Delete failed:", err.message);
      alert(`Gagal menghapus report: ${err.message}`);
    }
  };

  const handleViewReport = (report) => {
    // Buka download langsung jika COMPLETED
    if (report.status === "COMPLETED") {
      handleDownloadReport(report);
    }
  };

  const filteredReports =
    filterStatus === "all"
      ? reports
      : reports.filter((r) => r.status === filterStatus.toUpperCase());

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
                onClick={() => setShowGenerator(!showGenerator)}
              >
                <i className="bi bi-plus-circle me-2"></i>New Report
              </button>
            </div>
          </div>
        </div>

        {showGenerator && (
          <div className="report-generator-container mb-4">
            <ReportGenerator
              onGenerate={handleGenerateReport}
              onCancel={() => setShowGenerator(false)}
            />
          </div>
        )}

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
                    {["all", "COMPLETED", "PROCESSING", "FAILED"].map((s) => (
                      <button
                        key={s}
                        className={`btn btn-sm ${
                          filterStatus === s
                            ? s === "all"
                              ? "btn-danger"
                              : s === "COMPLETED"
                                ? "btn-success"
                                : s === "PROCESSING"
                                  ? "btn-warning"
                                  : "btn-danger"
                            : "btn-outline-secondary"
                        }`}
                        onClick={() => {
                          setFilterStatus(s);
                          setCurrentPage(1);
                        }}
                      >
                        {s === "all"
                          ? "All"
                          : s.charAt(0) + s.slice(1).toLowerCase()}
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
                  selectedReportId={null}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
