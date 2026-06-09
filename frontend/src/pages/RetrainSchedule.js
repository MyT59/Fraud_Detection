import React, { useState, useEffect } from "react";
import { useSchedule } from "../components/retrainschedule/useSchedule";
import ScheduleStats from "../components/retrainschedule/ScheduleStats";
import ScheduleFilters from "../components/retrainschedule/ScheduleFilters";
import ScheduleTable from "../components/retrainschedule/ScheduleTable";
import ScheduleModal from "../components/retrainschedule/ScheduleModal";
import DeleteModal from "../components/retrainschedule/DeleteModal";
import DetailModal from "../components/retrainschedule/DetailModal";
import RunModal from "../components/retrainschedule/RunModal";
import Toast from "../components/retrainschedule/Toast";
import PageLoader from "../components/common/PageLoader";
import "./RetrainSchedule.css";

const RetrainSchedule = () => {
  const [pageReady, setPageReady] = useState(false);
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
            <h1 className="rs-page-header__title">Retrain Schedule</h1>
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
          <button className="rs-btn rs-btn--primary" onClick={openCreate}>
            <i className="bi bi-plus-lg" />
            Buat Schedule
          </button>
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
        filterFreq={filterFreq}
        setFilterFreq={setFilterFreq}
        filterStatus={filterStatus}
        setFilterStatus={setFilterStatus}
      />

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
      />

      <RunModal
        schedule={runTarget}
        onConfirm={confirmManualRun}
        onCancel={cancelManualRun}
      />
    </div>
  );
};

export default RetrainSchedule;
