import { useState, useCallback } from "react";
import {
  INITIAL_SCHEDULES,
  EMPTY_FORM,
  getNextId,
  getNowString,
} from "./scheduleConstants";

export function useSchedule() {
  const [schedules, setSchedules] = useState(INITIAL_SCHEDULES);

  const [modalOpen, setModalOpen] = useState(false);
  const [editTargetId, setEditTargetId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [detailTarget, setDetailTarget] = useState(null);
  const [runTarget, setRunTarget] = useState(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});

  const [filterStatus, setFilterStatus] = useState("all");
  const [filterFreq, setFilterFreq] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  }, []);

  const updateForm = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFormErrors((prev) => ({ ...prev, [field]: undefined }));
  }, []);

  const validateForm = (f) => {
    const errors = {};
    if (!f.name.trim()) errors.name = "Nama schedule wajib diisi.";
    if (!f.model) errors.model = "Pilih model.";
    if (!f.time) errors.time = "Waktu wajib diisi.";
    return errors;
  };

  const openCreate = useCallback(() => {
    setEditTargetId(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((schedule) => {
    setEditTargetId(schedule.id);
    setForm({
      name: schedule.name,
      model: schedule.model,
      frequency: schedule.frequency,
      dayOfWeek: schedule.dayOfWeek ?? "Monday",
      dayOfMonth: schedule.dayOfMonth ?? "1",
      time: schedule.time,
      status: schedule.status,
      description: schedule.description,
    });
    setFormErrors({});
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditTargetId(null);
    setFormErrors({});
  }, []);

  const handleSubmit = useCallback(() => {
    const errors = validateForm(form);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const today = new Date().toISOString().slice(0, 10);

    if (editTargetId !== null) {
      setSchedules((prev) =>
        prev.map((s) =>
          s.id === editTargetId
            ? {
                ...s,
                name: form.name,
                model: form.model,
                frequency: form.frequency,
                dayOfWeek: form.frequency === "weekly" ? form.dayOfWeek : null,
                dayOfMonth:
                  form.frequency === "monthly" ? form.dayOfMonth : null,
                time: form.time,
                status: form.status,
                description: form.description,
              }
            : s,
        ),
      );
      showToast(`Schedule "${form.name}" berhasil diperbarui.`, "success");
    } else {
      const newSchedule = {
        id: getNextId(),
        name: form.name,
        model: form.model,
        frequency: form.frequency,
        dayOfWeek: form.frequency === "weekly" ? form.dayOfWeek : null,
        dayOfMonth: form.frequency === "monthly" ? form.dayOfMonth : null,
        time: form.time,
        status: form.status,
        description: form.description,
        lastRun: "—",
        nextRun: form.status === "active" ? `${today} ${form.time}` : "—",
        createdAt: today,
      };
      setSchedules((prev) => [...prev, newSchedule]);
      showToast(`Schedule "${form.name}" berhasil dibuat.`, "success");
    }

    closeModal();
  }, [form, editTargetId, closeModal, showToast]);

  const openDelete = useCallback((schedule) => {
    setDeleteTarget(schedule);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    const name = deleteTarget.name;
    setSchedules((prev) => prev.filter((s) => s.id !== deleteTarget.id));
    setDeleteTarget(null);
    showToast(`Schedule "${name}" berhasil dihapus.`, "danger");
  }, [deleteTarget, showToast]);

  const cancelDelete = useCallback(() => setDeleteTarget(null), []);

  const toggleStatus = useCallback(
    (schedule) => {
      const nextStatus = schedule.status === "active" ? "paused" : "active";
      setSchedules((prev) =>
        prev.map((s) =>
          s.id === schedule.id
            ? {
                ...s,
                status: nextStatus,
                nextRun: nextStatus === "paused" ? "—" : s.nextRun,
              }
            : s,
        ),
      );
      const verb = nextStatus === "active" ? "diaktifkan kembali" : "di-pause";
      showToast(`Schedule "${schedule.name}" ${verb}.`, "info");
    },
    [showToast],
  );

  const openManualRun = useCallback((schedule) => setRunTarget(schedule), []);

  const confirmManualRun = useCallback(() => {
    if (!runTarget) return;
    const nowStr = getNowString();
    setSchedules((prev) =>
      prev.map((s) => (s.id === runTarget.id ? { ...s, lastRun: nowStr } : s)),
    );
    showToast(`"${runTarget.name}" dijalankan secara manual!`, "run");
    setRunTarget(null);
  }, [runTarget, showToast]);

  const cancelManualRun = useCallback(() => setRunTarget(null), []);

  const openDetail = useCallback((s) => setDetailTarget(s), []);
  const closeDetail = useCallback(() => setDetailTarget(null), []);

  const filteredSchedules = schedules.filter((s) => {
    if (filterStatus !== "all" && s.status !== filterStatus) return false;
    if (filterFreq !== "all" && s.frequency !== filterFreq) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (
        !s.name.toLowerCase().includes(q) &&
        !s.model.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  const stats = {
    total: schedules.length,
    active: schedules.filter((s) => s.status === "active").length,
    paused: schedules.filter((s) => s.status === "paused").length,
    daily: schedules.filter((s) => s.frequency === "daily").length,
    weekly: schedules.filter((s) => s.frequency === "weekly").length,
    monthly: schedules.filter((s) => s.frequency === "monthly").length,
  };

  return {
    schedules,
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
  };
}
