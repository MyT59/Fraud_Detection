import React, { useState, useEffect, useCallback } from "react";
import UserStats from "../components/superadmin/UserStats";
import UserTable from "../components/superadmin/UserTable";
import AddUserModal from "../components/superadmin/AddUserModal";
import "./SuperAdmin.css";
import PageLoader from "../components/common/PageLoader";
import { api, storage } from "../services/apiService";

const ROLE_FROM_API = {
  SUPER_ADMIN: "superadmin",
  RISK_MANAGER: "admin",
  FRAUD_ANALYST: "analyst",
};

const mapUser = (u) => ({
  id: u.id,
  name: u.full_name,
  email: u.email,
  phone: u.phone_number || "",
  department: u.department || "",
  notes: u.notes || "",
  role: ROLE_FROM_API[u.role] || "analyst",
  status: u.is_active ? "active" : "suspended",
  createdAt: u.created_at
    ? new Date(u.created_at).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—",
  lastActive: u.last_login_at
    ? new Date(u.last_login_at).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "Belum pernah",
});

let _toastId = 0;
const useToast = () => {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, type = "success") => {
    const id = ++_toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      3000,
    );
  }, []);
  return { toasts, push };
};

const checkIsSuperAdmin = (user) => {
  if (!user) return false;
  return user.role === "SUPER_ADMIN" || user.role === "superadmin";
};

const SuperAdmin = () => {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const { toasts, push: pushToast } = useToast();

  const [currentUser, setCurrentUser] = useState(() => storage.getUser());

  const isSuperAdmin = checkIsSuperAdmin(currentUser);
  const superadminCount = users.filter((u) => u.role === "superadmin").length;

  const fetchUsers = useCallback(async () => {
    try {
      const data = await api.get("/accounts/");
      setUsers(data.map(mapUser));
    } catch (err) {
      console.error("Gagal memuat akun:", err);
      pushToast(err.message || "Gagal memuat data pengguna.", "error");
    }
  }, [pushToast]);

  useEffect(() => {
    const init = async () => {
      let user = storage.getUser();
      if (!user) {
        try {
          user = await api.get("/accounts/me");
          storage.setUser(user);
          setCurrentUser(user);
        } catch (err) {
          console.error("Gagal memuat profil:", err);
        }
      }
      await fetchUsers();
      setLoading(false);
    };
    init();
  }, [fetchUsers]);

  const handleSubmit = (apiUser) => {
    const mapped = mapUser(apiUser);
    const isNew = !users.some((u) => u.id === mapped.id);
    if (isNew) {
      setUsers((prev) => [mapped, ...prev]);
      pushToast(`Pengguna ${mapped.name} berhasil ditambahkan!`, "success");
    } else {
      setUsers((prev) =>
        prev.map((u) => (u.id === mapped.id ? { ...u, ...mapped } : u)),
      );
      pushToast(`Pengguna ${mapped.name} berhasil diperbarui.`, "info");
    }
  };

  const handleEdit = (user) => {
    setEditData(user);
    setModalOpen(true);
  };

  const handleDelete = async (id) => {
    const user = users.find((u) => u.id === id);
    try {
      await api.delete(`/accounts/${id}`);
    } catch (err) {
      pushToast(err.message || "Gagal menghapus akun.", "error");
      return;
    }
    setUsers((prev) => prev.filter((u) => u.id !== id));
    pushToast(`Akun ${user?.name} telah dihapus.`, "error");
  };

  const handleToggleStatus = async (id) => {
    const user = users.find((u) => u.id === id);
    const newIsActive = user.status === "suspended";
    const newStatus = newIsActive ? "active" : "suspended";

    try {
      await api.patch(`/accounts/${id}/status?is_active=${newIsActive}`);
    } catch (err) {
      pushToast(err.message || "Gagal mengubah status akun.", "error");
      return;
    }

    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, status: newStatus } : u)),
    );
    pushToast(
      `Akun ${user?.name} berhasil ${newStatus === "suspended" ? "di-suspend" : "diaktifkan kembali"}.`,
      newStatus === "suspended" ? "error" : "success",
    );
  };

  if (loading) return <PageLoader message="Memuat Super Admin Panel..." />;

  return (
    <div className="superadmin-page">
      <div className="page-header">
        <div className="page-header-left">
          <div className="page-header-icon">
            <i className="bi bi-shield-lock-fill"></i>
          </div>
          <div>
            <h1 className="page-title">Super Admin Panel</h1>
            <p className="page-subtitle">
              Kelola pengguna dan hak akses sistem fraud detection
            </p>
          </div>
        </div>
        {isSuperAdmin && (
          <button
            className="btn-add-user"
            onClick={() => {
              setEditData(null);
              setModalOpen(true);
            }}
          >
            <i className="bi bi-plus-lg"></i>
            Tambah Pengguna
          </button>
        )}
      </div>

      <UserStats users={users} />

      <UserTable
        users={users}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onToggleStatus={handleToggleStatus}
        currentUser={currentUser}
      />

      <AddUserModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditData(null);
        }}
        onSubmit={handleSubmit}
        editData={editData}
        currentUser={currentUser}
        superadminCount={superadminCount}
      />

      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <i
              className={`bi ${
                t.type === "success"
                  ? "bi-check-circle-fill"
                  : t.type === "error"
                    ? "bi-trash-fill"
                    : "bi-info-circle-fill"
              }`}
            ></i>
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SuperAdmin;
