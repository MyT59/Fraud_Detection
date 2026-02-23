import React, { useState, useEffect } from 'react';
import ReportGenerator from '../components/reports/ReportGenerator';
import ReportList from '../components/reports/ReportList';
import ReportPreview from '../components/reports/ReportPreview';
import ReportStats from '../components/reports/ReportStats';
import ScheduledReports from '../components/reports/ScheduledReports';
import ReportShareModal from '../components/reports/ReportShareModal';
import BulkReportActions from '../components/reports/BulkReportActions';
import './Reports.css';
import PageLoader from '../components/common/PageLoader';

// Dummy data untuk report history
const generateReportHistory = () => {
  const types = ['Monthly Summary', 'Fraud Analysis', 'Transaction Report', 'Location Analysis', 'Custom Report'];
  const statuses = ['Completed', 'Processing', 'Failed'];
  const formats = ['PDF', 'Excel', 'CSV'];
  
  const reports = [];
  for (let i = 1; i <= 15; i++) {
    const randomDate = new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1);
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const weight = status === 'Completed' ? 8 : (status === 'Processing' ? 1.5 : 0.5);
    const weightedStatus = Math.random() < weight / 10 ? status : 'Completed';
    
    reports.push({
      id: `RPT${String(i).padStart(4, '0')}`,
      type: types[Math.floor(Math.random() * types.length)],
      format: formats[Math.floor(Math.random() * formats.length)],
      generatedDate: randomDate.toISOString(),
      status: weightedStatus,
      size: `${Math.floor(Math.random() * 5000) + 500} KB`,
      generatedBy: ['Admin', 'System', 'User'][Math.floor(Math.random() * 3)]
    });
  }
  
  return reports.sort((a, b) => new Date(b.generatedDate) - new Date(a.generatedDate));
};

/* ── Inline Report Preview Modal ── */
const ReportPreviewModal = ({ report, isOpen, onClose, onDownload, onShare }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen || !report) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(12,12,14,0.45)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          zIndex: 1050,
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1055,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          pointerEvents: 'none',
        }}
      >
        <div
          className="report-preview-modal-content"
          style={{ pointerEvents: 'all', width: '100%', maxWidth: '720px', margin: 0 }}
        >
          {/* Header */}
          <div className="preview-modal-header">
            <div className="preview-modal-title-group">
              <i className="bi bi-eye text-danger me-2"></i>
              <span>Report Preview</span>
            </div>
            <div className="preview-modal-header-actions">
              {report.status === 'Completed' && (
                <>
                  <button className="btn btn-sm btn-outline-danger" onClick={onShare}>
                    <i className="bi bi-share me-1"></i>Share
                  </button>
                  <button className="btn btn-sm btn-danger" onClick={onDownload}>
                    <i className="bi bi-download me-1"></i>Download
                  </button>
                </>
              )}
              <button className="btn-modal-close" onClick={onClose} title="Close">
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
          </div>

          {/* Body */}
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
  const [showScheduler, setShowScheduler] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedReports, setSelectedReports] = useState([]);
  const [activeTab, setActiveTab] = useState('reports'); // reports | scheduled

  const handleGenerateReport = (reportData) => {
    const newReport = {
      id: `RPT${String(reportHistory.length + 1).padStart(4, '0')}`,
      type: reportData.type,
      format: reportData.format,
      generatedDate: new Date().toISOString(),
      status: 'Processing',
      size: 'Generating...',
      generatedBy: 'Admin'
    };
    setReportHistory([newReport, ...reportHistory]);
    setTimeout(() => {
      setReportHistory(prev =>
        prev.map(report =>
          report.id === newReport.id
            ? { ...report, status: 'Completed', size: `${Math.floor(Math.random() * 5000) + 500} KB` }
            : report
        )
      );
    }, 3000);
    setShowGenerator(false);
    setActiveTab('reports');
  };

  const handleViewReport = (report) => {
    setSelectedReport(report);
    setShowPreviewModal(true);
  };

  const handleClosePreview = () => {
    setShowPreviewModal(false);
  };

  const handleDeleteReport = (reportId) => {
    setReportHistory(prev => prev.filter(report => report.id !== reportId));
    if (selectedReport && selectedReport.id === reportId) {
      setSelectedReport(null);
      setShowPreviewModal(false);
    }
    setSelectedReports(prev => prev.filter(id => id !== reportId));
  };

  const handleDownloadReport = (report) => {
    alert(`Downloading ${report.type} (${report.format})...`);
  };

  const handleToggleSelectReport = (reportId) => {
    setSelectedReports(prev =>
      prev.includes(reportId)
        ? prev.filter(id => id !== reportId)
        : [...prev, reportId]
    );
  };

  const handleBulkDownload = (reportIds, format) => {
    const reports = reportHistory.filter(r => reportIds.includes(r.id));
    alert(`Downloading ${reports.length} reports as ${format}...`);
    setSelectedReports([]);
  };

  const handleBulkDelete = (reportIds) => {
    setReportHistory(prev => prev.filter(r => !reportIds.includes(r.id)));
    setSelectedReports([]);
    if (selectedReport && reportIds.includes(selectedReport.id)) {
      setSelectedReport(null);
      setShowPreviewModal(false);
    }
  };

  const handleBulkShare = (reportIds) => {
    const report = reportHistory.find(r => reportIds.includes(r.id));
    setSelectedReport(report);
    setShowShareModal(true);
  };

  const filteredReports = filterStatus === 'all'
    ? reportHistory
    : reportHistory.filter(report => report.status === filterStatus);

  const stats = {
    total: reportHistory.length,
    completed: reportHistory.filter(r => r.status === 'Completed').length,
    processing: reportHistory.filter(r => r.status === 'Processing').length,
    failed: reportHistory.filter(r => r.status === 'Failed').length
  };

  const selectedReportObjects = reportHistory.filter(r => selectedReports.includes(r.id));

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  if (loading) return <PageLoader message="Memuat data laporan..." />;

  return (
    <div className="reports-page">
      <div className="container-fluid py-4">

        {/* ── Page Header ── */}
        <div className="page-header mb-4">
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
            <div>
              <h1 className="page-title">
                <i className="bi bi-file-earmark-text"></i> Reports
              </h1>
              <p className="page-subtitle">Generate, manage, and schedule fraud detection reports</p>
            </div>
            <div className="header-actions">
              <button
                className={`btn btn-outline-danger ${activeTab === 'scheduled' ? 'active' : ''}`}
                onClick={() => {
                  setShowScheduler(!showScheduler);
                  setShowGenerator(false);
                  setActiveTab(activeTab === 'scheduled' ? 'reports' : 'scheduled');
                }}
              >
                <i className="bi bi-calendar-event me-2"></i>Schedule
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  setShowGenerator(!showGenerator);
                  setShowScheduler(false);
                  setActiveTab('reports');
                }}
              >
                <i className="bi bi-plus-circle me-2"></i>New Report
              </button>
            </div>
          </div>
        </div>

        {/* ── Stats ── */}
        <ReportStats stats={stats} />

        {/* ── Scheduled tab ── */}
        {activeTab === 'scheduled' && showScheduler && (
          <div className="mb-4">
            <ScheduledReports />
          </div>
        )}

        {/* ── Report Generator ── */}
        {showGenerator && activeTab === 'reports' && (
          <div className="report-generator-container mb-4">
            <ReportGenerator
              onGenerate={handleGenerateReport}
              onCancel={() => setShowGenerator(false)}
            />
          </div>
        )}

        {/* ── Report History Table ── */}
        {activeTab === 'reports' && (
          <div className="row">
            <div className="col-12 mb-4">
              <div className="card reports-list-card reports-list-card--full">
                <div className="card-header">
                  <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                    <h5 className="card-title mb-0">
                      <i className="bi bi-table me-2"></i>
                      Report History
                      <span className="report-count-badge ms-2">{filteredReports.length}</span>
                    </h5>
                    <div className="filter-buttons">
                      <button
                        className={`btn btn-sm ${filterStatus === 'all' ? 'btn-danger' : 'btn-outline-secondary'}`}
                        onClick={() => setFilterStatus('all')}
                      >All</button>
                      <button
                        className={`btn btn-sm ${filterStatus === 'Completed' ? 'btn-success' : 'btn-outline-secondary'}`}
                        onClick={() => setFilterStatus('Completed')}
                      >Completed</button>
                      <button
                        className={`btn btn-sm ${filterStatus === 'Processing' ? 'btn-warning' : 'btn-outline-secondary'}`}
                        onClick={() => setFilterStatus('Processing')}
                      >Processing</button>
                      <button
                        className={`btn btn-sm ${filterStatus === 'Failed' ? 'btn-danger' : 'btn-outline-secondary'}`}
                        onClick={() => setFilterStatus('Failed')}
                      >Failed</button>
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
                    onToggleSelect={handleToggleSelectReport}
                    selectedReports={selectedReports}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ── Report Preview Modal ── */}
      <ReportPreviewModal
        report={selectedReport}
        isOpen={showPreviewModal}
        onClose={handleClosePreview}
        onDownload={() => selectedReport && handleDownloadReport(selectedReport)}
        onShare={() => { setShowShareModal(true); }}
      />

      {/* ── Share Modal ── */}
      <ReportShareModal
        report={selectedReport}
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        onShare={(data) => console.log('Share report:', data)}
      />

      {/* ── Bulk Actions ── */}
      <BulkReportActions
        selectedReports={selectedReportObjects}
        onBulkDownload={(reports, format) => handleBulkDownload(reports.map(r => r.id), format)}
        onBulkDelete={(reports) => handleBulkDelete(reports.map(r => r.id))}
        onBulkShare={(reports) => handleBulkShare(reports.map(r => r.id))}
        onClearSelection={() => setSelectedReports([])}
      />
    </div>
  );
};

export default Reports;