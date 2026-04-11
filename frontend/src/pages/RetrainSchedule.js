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
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  const {
    filteredSchedules,
    stats,
    modalOpen,
    editTargetId,
    deleteTarget,
    detailTarget,
    runTarget,
    form,
    formErrors,
    updateForm,
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

  if (loading) return <PageLoader message="Memuat Retrain Schedule..." />;

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
              Kelola jadwal pelatihan ulang model machine learning secara
              otomatis
            </p>
          </div>
        </div>
        <button className="rs-btn rs-btn--primary" onClick={openCreate}>
          <i className="bi bi-plus-lg" />
          Buat Schedule
        </button>
      </div>

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
