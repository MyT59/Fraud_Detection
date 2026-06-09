import { useState, useCallback, useEffect } from "react";
import api from "../../services/apiService";
import { EMPTY_FORM, adaptSchedule, buildCronExpr } from "./scheduleConstants";

const parseError = (err) => {
  if (err?.data?.detail) {
    if (typeof err.data.detail === "string") return err.data.detail;
    if (Array.isArray(err.data.detail)) {
      return err.data.detail
        .map((e) => e.msg || e.message || JSON.stringify(e))
        .join(", ");
    }
  }
  return err?.message || "Terjadi kesalahan, silakan coba lagi.";
};

export function useSchedule() {
  const [schedules, setSchedules] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editTargetId, setEditTargetId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [detailTarget, setDetailTarget] = useState(null);
  const [runTarget, setRunTarget] = useState(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [submitLoading, setSubmitLoading] = useState(false);

  const [filterStatus, setFilterStatus] = useState("all");
  const [filterFreq, setFilterFreq] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  }, []);

  const fetchSchedules = useCallback(async () => {
    setDataLoading(true);
    setDataError(null);
    try {
      const raw = await api.get("/retrain/schedules");
      setSchedules((raw || []).map(adaptSchedule));
    } catch (err) {
      const msg = parseError(err);
      setDataError(msg);
      showToast(`Gagal memuat data: ${msg}`, "danger");
    } finally {
      setDataLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const updateForm = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFormErrors((prev) => ({ ...prev, [field]: undefined }));
  }, []);

  const validateForm = (f) => {
    const errors = {};
    if (!f.name.trim()) errors.name = "Nama schedule wajib diisi.";
    if (!f.domain) errors.domain = "Pilih domain.";
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
      domain: schedule.domain || "agenusa",
      frequency: schedule.frequency,
      dayOfWeek: schedule.dayOfWeek ?? "Monday",
      dayOfMonth: schedule.dayOfMonth ?? "1",
      time: schedule.time,
      is_active: schedule.is_active,
      description: schedule.description || "",
    });
    setFormErrors({});
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditTargetId(null);
    setFormErrors({});
  }, []);

  const handleSubmit = useCallback(async () => {
    const errors = validateForm(form);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setSubmitLoading(true);
    const cron_expr = buildCronExpr(form);
    const payload = {
      name: form.name.trim(),
      cron_expr,
      domain: form.domain,
      is_active: form.is_active,
    };

    try {
      if (editTargetId !== null) {
        const updated = await api.put(
          `/retrain/schedules/${editTargetId}`,
          payload,
        );
        setSchedules((prev) =>
          prev.map((s) => (s.id === editTargetId ? adaptSchedule(updated) : s)),
        );
        showToast(`Schedule "${form.name}" berhasil diperbarui.`, "success");
      } else {
        const created = await api.post("/retrain/schedules", payload);
        setSchedules((prev) => [...prev, adaptSchedule(created)]);
        showToast(`Schedule "${form.name}" berhasil dibuat.`, "success");
      }
      closeModal();
    } catch (err) {
      const msg = parseError(err);
      showToast(`Gagal menyimpan: ${msg}`, "danger");
    } finally {
      setSubmitLoading(false);
    }
  }, [form, editTargetId, closeModal, showToast]);

  const openDelete = useCallback((schedule) => setDeleteTarget(schedule), []);
  const cancelDelete = useCallback(() => setDeleteTarget(null), []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    const { id, name } = deleteTarget;
    setDeleteTarget(null);
    try {
      await api.delete(`/retrain/schedules/${id}`);
      setSchedules((prev) => prev.filter((s) => s.id !== id));
      showToast(`Schedule "${name}" berhasil dihapus.`, "danger");
    } catch (err) {
      showToast(`Gagal menghapus: ${parseError(err)}`, "danger");
    }
  }, [deleteTarget, showToast]);

  const toggleStatus = useCallback(
    async (schedule) => {
      const newIsActive = schedule.status !== "active";
      try {
        await api.patch(`/retrain/schedules/${schedule.id}/status`, {
          is_active: newIsActive,
        });
        setSchedules((prev) =>
          prev.map((s) =>
            s.id === schedule.id
              ? {
                  ...s,
                  is_active: newIsActive,
                  status: newIsActive ? "active" : "paused",
                  nextRun: newIsActive ? s.nextRun : "—",
                }
              : s,
          ),
        );
        const verb = newIsActive ? "diaktifkan kembali" : "di-pause";
        showToast(`Schedule "${schedule.name}" ${verb}.`, "info");
      } catch (err) {
        showToast(`Gagal mengubah status: ${parseError(err)}`, "danger");
      }
    },
    [showToast],
  );

  const openManualRun = useCallback((schedule) => setRunTarget(schedule), []);
  const cancelManualRun = useCallback(() => setRunTarget(null), []);

  const confirmManualRun = useCallback(async () => {
    if (!runTarget) return;
    const { id, name } = runTarget;
    setRunTarget(null);
    try {
      await api.post(`/retrain/schedules/${id}/run`);

      showToast(`"${name}" dijalankan secara manual!`, "run");
      fetchSchedules();
    } catch (err) {
      showToast(`Gagal menjalankan: ${parseError(err)}`, "danger");
    }
  }, [runTarget, showToast, fetchSchedules]);

  const openDetail = useCallback((s) => setDetailTarget(s), []);
  const closeDetail = useCallback(() => setDetailTarget(null), []);

  const filteredSchedules = schedules.filter((s) => {
    if (filterStatus !== "all" && s.status !== filterStatus) return false;
    if (filterFreq !== "all" && s.frequency !== filterFreq) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (
        !s.name.toLowerCase().includes(q) &&
        !s.model.toLowerCase().includes(q) &&
        !(s.domain || "").toLowerCase().includes(q)
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
  };
}
