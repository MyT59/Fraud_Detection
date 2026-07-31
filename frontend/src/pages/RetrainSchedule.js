import React, { useState, useEffect, useCallback } from "react";
import { useSchedule } from "../components/retrainschedule/useSchedule";
import ScheduleStats from "../components/retrainschedule/ScheduleStats";
import MLModelStats from "../components/retrainschedule/MLModelStats";
import RetrainHistory from "../components/retrainschedule/RetrainHistory";
import ScheduleFilters from "../components/retrainschedule/ScheduleFilters";
import ScheduleTable from "../components/retrainschedule/ScheduleTable";
import ScheduleModal from "../components/retrainschedule/ScheduleModal";
import DeleteModal from "../components/retrainschedule/DeleteModal";
import DetailModal from "../components/retrainschedule/DetailModal";
import RunModal from "../components/retrainschedule/RunModal";
import UploadDatasetModal from "../components/retrainschedule/UploadDatasetModal";
import Toast from "../components/retrainschedule/Toast";
import PageLoader from "../components/common/PageLoader";
import api, { storage } from "../services/apiService";
import "./RetrainSchedule.css";

const RetrainSchedule = () => {
  const [pageReady, setPageReady] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("schedules");
  const [healthStatus, setHealthStatus] = useState(null); // null=loading, true=healthy, false=unhealthy
  useEffect(() => {
    const timer = setTimeout(() => setPageReady(true), 400);
    return () => clearTimeout(timer);
  }, []);

  const {
    filteredSchedules,
    stats,
    dataLoading,
    dataError,
    fetchSchedules,

    modalOpen,
    editTargetId,
    deleteTarget,
    detailTarget,
    runTarget,

    form,
    formErrors,
    updateForm,
    submitLoading,

    filterStatus,
    setFilterStatus,
    filterFreq,
    setFilterFreq,
    searchQuery,
    setSearchQuery,

    openCreate,
    openEdit,
    closeModal,
    handleSubmit,
    openDelete,
    confirmDelete,
    cancelDelete,
    toggleStatus,
    openManualRun,
    confirmManualRun,
    cancelManualRun,
    openDetail,
    closeDetail,

    toast,
  } = useSchedule();

  const isSuperAdmin = storage.getUser()?.role === "SUPER_ADMIN";

  const fetchHealth = useCallback(async () => {
    try {
      const data = await api.get("/retrain/health");
      setHealthStatus(data?.status === "healthy");
    } catch {
      setHealthStatus(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000); // poll setiap 30 detik
    return () => clearInterval(interval);
  }, [fetchHealth]);

  if (!pageReady || dataLoading) {
    return <PageLoader message="Memuat Retrain Schedule..." />;
  }

  return (
    <div className="rs-page">
      <Toast toast={toast} />

      <div className="rs-page-header">
        <div className="rs-page-header__left">
          <div className="rs-page-header__icon">
            <i className="bi bi-cpu" />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h1 className="rs-page-header__title">Retrain Schedule</h1>
              <span
                title={
                  healthStatus === null
                    ? "Mengecek status..."
                    : healthStatus
                      ? "Sistem berjalan normal"
                      : "Sistem tidak merespons"
                }
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "3px 10px",
                  borderRadius: 20,
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  background:
                    healthStatus === null
                      ? "#f1f5f9"
                      : healthStatus
                        ? "#f0fdf4"
                        : "#fef2f2",
                  color:
                    healthStatus === null
                      ? "#94a3b8"
                      : healthStatus
                        ? "#16a34a"
                        : "#dc2626",
                  border: `1px solid ${healthStatus === null ? "#e2e8f0" : healthStatus ? "#bbf7d0" : "#fecaca"}`,
                  transition: "all 0.3s",
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background:
                      healthStatus === null
                        ? "#94a3b8"
                        : healthStatus
                          ? "#16a34a"
                          : "#dc2626",
                    boxShadow: healthStatus ? "0 0 0 2px #bbf7d0" : "none",
                    animation: healthStatus ? "rs-pulse 2s infinite" : "none",
                  }}
                />
                {healthStatus === null
                  ? "Checking..."
                  : healthStatus
                    ? "Healthy"
                    : "Unhealthy"}
              </span>
            </div>
            <p className="rs-page-header__sub">
              Kelola jadwal pelatihan ulang model Isolation Forest secara
              otomatis
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            className="rs-btn rs-btn--ghost"
            onClick={fetchSchedules}
            title="Refresh data"
          >
            <i className="bi bi-arrow-clockwise" />
            Refresh
          </button>
          {isSuperAdmin && (
            <button
              className="rs-btn rs-btn--ghost"
              onClick={() => setUploadModalOpen(true)}
              title="Upload dataset CSV untuk training"
            >
              <i className="bi bi-cloud-upload" />
              Upload Dataset
            </button>
          )}
          {isSuperAdmin && (
            <button className="rs-btn rs-btn--primary" onClick={openCreate}>
              <i className="bi bi-plus-lg" />
              Buat Schedule
            </button>
          )}
        </div>
      </div>

      {dataError && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fca5a5",
            borderRadius: "10px",
            padding: "14px 18px",
            marginBottom: "18px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "0.8125rem",
            color: "#dc2626",
          }}
        >
          <i className="bi bi-exclamation-triangle-fill" />
          <span>
            Gagal memuat data dari server: <strong>{dataError}</strong>
          </span>
          <button
            onClick={fetchSchedules}
            style={{
              marginLeft: "auto",
              background: "none",
              border: "1px solid #fca5a5",
              color: "#dc2626",
              borderRadius: "6px",
              padding: "4px 12px",
              fontSize: "0.775rem",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Coba lagi
          </button>
        </div>
      )}

      <MLModelStats />

      {/* Tab bar */}
      <div className="rs-tabs">
        <button
          className={`rs-tab ${activeTab === "schedules" ? "rs-tab--active" : ""}`}
          onClick={() => setActiveTab("schedules")}
        >
          <i className="bi bi-calendar2-check" />
          Schedules
        </button>
        <button
          className={`rs-tab ${activeTab === "history" ? "rs-tab--active" : ""}`}
          onClick={() => setActiveTab("history")}
        >
          <i className="bi bi-clock-history" />
          Riwayat Retrain
        </button>
      </div>

      {/* Tab content */}
      {activeTab === "schedules" && (
        <>
          <ScheduleStats stats={stats} />

          <ScheduleFilters
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
            filterFreq={filterFreq}
            setFilterFreq={setFilterFreq}
            totalShown={filteredSchedules.length}
          />

          <ScheduleTable
            schedules={filteredSchedules}
            onEdit={openEdit}
            onDelete={openDelete}
            onToggleStatus={toggleStatus}
            onDetail={openDetail}
            onManualRun={openManualRun}
            isSuperAdmin={isSuperAdmin}
            filterFreq={filterFreq}
            setFilterFreq={setFilterFreq}
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
          />
        </>
      )}

      {activeTab === "history" && <RetrainHistory />}

      <ScheduleModal
        isOpen={modalOpen}
        isEdit={editTargetId !== null}
        form={form}
        formErrors={formErrors}
        onClose={closeModal}
        onSubmit={handleSubmit}
        updateForm={updateForm}
        submitLoading={submitLoading}
      />

      <DeleteModal
        schedule={deleteTarget}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />

      <DetailModal
        schedule={detailTarget}
        onClose={closeDetail}
        onEdit={openEdit}
        isSuperAdmin={isSuperAdmin}
      />

      <RunModal
        schedule={runTarget}
        onConfirm={confirmManualRun}
        onCancel={cancelManualRun}
      />

      <UploadDatasetModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onSuccess={() => {
          fetchSchedules();
        }}
      />
    </div>
  );
};

export default RetrainSchedule;
