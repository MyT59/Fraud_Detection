import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import UserStats from "../components/superadmin/UserStats";
import UserTable from "../components/superadmin/UserTable";
import AddUserModal from "../components/superadmin/AddUserModal";
import "./SuperAdmin.css";
import PageLoader from "../components/common/PageLoader";
import { api, storage } from "../services/apiService";

const ROLE_FROM_API = {
  SUPER_ADMIN: "superadmin",
  RISK_MANAGER: "riskmanager",
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
  const push = useCallback((message, type = "success", duration = 3000) => {
    const id = ++_toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      duration,
    );
  }, []);
  return { toasts, push };
};

const checkIsSuperAdmin = (user) => {
  if (!user) return false;
  return user.role === "SUPER_ADMIN" || user.role === "superadmin";
};

// ── Reset Password Modal ──────────────────────────────────────────
const ResetPasswordModal = ({ data, onClose }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(data.password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!data) return null;

  return createPortal(
    <div className="rp-overlay" onClick={onClose}>
      <div className="rp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rp-header">
          <div className="rp-header-left">
            <div className="rp-icon">
              <i className="bi bi-key-fill"></i>
            </div>
            <div>
              <p className="rp-title">Password Sementara</p>
              <p className="rp-subtitle">
                {data.name} · {data.email}
              </p>
            </div>
          </div>
          <button className="rp-close" onClick={onClose}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        <div className="rp-body">
          <p className="rp-info">
            <i className="bi bi-info-circle-fill"></i>
            Bagikan password ini kepada pengguna. Mereka akan diminta membuat
            password baru saat login.
          </p>

          <div className="rp-pw-wrap">
            <span className="rp-pw-label">Password Sementara</span>
            <div className="rp-pw-box">
              <code className="rp-pw-value">{data.password}</code>
              <button
                className={`rp-copy-btn ${copied ? "copied" : ""}`}
                onClick={handleCopy}
              >
                <i className={`bi bi-${copied ? "check-lg" : "clipboard"}`}></i>
                {copied ? "Tersalin!" : "Salin"}
              </button>
            </div>
          </div>

          <p className="rp-warning">
            <i className="bi bi-exclamation-triangle-fill"></i>
            Password ini hanya ditampilkan sekali. Pastikan sudah disalin
            sebelum menutup.
          </p>
        </div>

        <div className="rp-footer">
          <button className="rp-btn-close" onClick={onClose}>
            Tutup
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

// ── Main Component ────────────────────────────────────────────────
const SuperAdmin = () => {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [resetModal, setResetModal] = useState(null); // { name, email, password }
  const { toasts, push: pushToast } = useToast();

  const [currentUser, setCurrentUser] = useState(() => storage.getUser());

  const isSuperAdmin = checkIsSuperAdmin(currentUser);
  const superadminCount = users.filter((u) => u.role === "superadmin").length;

  const fetchUsers = useCallback(async () => {
    try {
      const data = await api.get("/accounts/");
      setUsers(data.map(mapUser));
    } catch (err) {
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

  const handleResetPassword = async (id) => {
    const user = users.find((u) => u.id === id);
    try {
      const res = await api.post(`/accounts/${id}/reset-password`);
      setResetModal({
        name: user?.name,
        email: user?.email,
        password: res.temporary_password,
      });
    } catch (err) {
      pushToast(err.message || "Gagal mereset password.", "error");
    }
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
    <>
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
          onResetPassword={handleResetPassword}
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
      </div>

      <ResetPasswordModal
        data={resetModal}
        onClose={() => setResetModal(null)}
      />

      {createPortal(
        <div className="sa-toast-container">
          {toasts.map((t) => (
            <div key={t.id} className={`sa-toast sa-toast-${t.type}`}>
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
        </div>,
        document.body,
      )}
    </>
  );
};

export default SuperAdmin;
