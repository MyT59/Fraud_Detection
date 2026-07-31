import React, { useState, useEffect, useCallback } from "react";
import ReportGenerator from "../components/reports/ReportGenerator";
import ReportList from "../components/reports/ReportList";
import "./Reports.css";
import PageLoader from "../components/common/PageLoader";
import reportService from "../services/reportService";

const Reports = () => {
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState([]);
  const [totalReports, setTotalReports] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterFormat, setFilterFormat] = useState(null);
  const [showGenerator, setShowGenerator] = useState(false);

  const fetchReports = useCallback(async (page = 1, status = "all", format = null, limit = 20) => {
    try {
      const params = { page, limit };
      if (status !== "all") params.status = status.toUpperCase();
      if (format) params.format = format;
      const res = await reportService.getReports(params);
      setReports(res.items || []);
      setTotalReports(res.total || 0);
    } catch (err) {
      console.error("Failed to fetch reports:", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports(currentPage, filterStatus, filterFormat, pageSize);
  }, [fetchReports, currentPage, filterStatus, filterFormat, pageSize]);

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
    setCurrentPage(1);
    fetchReports(1, filterStatus, filterFormat, pageSize);
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
      const nextPage = reports.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage;
      setCurrentPage(nextPage);
      fetchReports(nextPage, filterStatus, filterFormat, pageSize);
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
                      {totalReports}
                    </span>
                  </h5>
                  <div className="filter-buttons">
                    {["all", "PENDING", "PROCESSING", "COMPLETED", "FAILED"].map((s) => (
                      <button
                        key={s}
                        className={`btn btn-sm ${
                          filterStatus === s
                            ? s === "all"
                              ? "btn-danger"
                              : s === "COMPLETED"
                                ? "btn-success"
                              : s === "PROCESSING" || s === "PENDING"
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
                  reports={reports}
                  totalRecords={totalReports}
                  currentPage={currentPage}
                  rowsPerPage={pageSize}
                  onPageChange={setCurrentPage}
                  onRowsPerPageChange={(size) => {
                    setPageSize(size);
                    setCurrentPage(1);
                  }}
                  filterFormat={filterFormat}
                  onFormatChange={(value) => {
                    setFilterFormat(value);
                    setCurrentPage(1);
                  }}
                  filterStatus={filterStatus === "all" ? null : filterStatus}
                  onStatusChange={(value) => {
                    setFilterStatus(value || "all");
                    setCurrentPage(1);
                  }}
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
