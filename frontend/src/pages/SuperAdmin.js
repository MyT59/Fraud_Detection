import React, { useState, useEffect, useCallback } from "react";
import UserStats from "../components/superadmin/UserStats";
import UserTable from "../components/superadmin/UserTable";
import AddUserModal from "../components/superadmin/AddUserModal";
import "./SuperAdmin.css";
import PageLoader from "../components/common/PageLoader";

/* ── Seed data ── */
const SEED_USERS = [
  {
    id: 1,
    name: "Andi Wijaya",
    email: "andi.wijaya@nusacita.id",
    phone: "08111111111",
    department: "Risk Management",
    role: "admin",
    status: "active",
    createdAt: "01 Jan 2024",
    lastActive: "10 menit lalu",
  },
  {
    id: 2,
    name: "Sari Dewi",
    email: "sari.dewi@nusacita.id",
    phone: "08122222222",
    department: "Fraud Prevention",
    role: "analyst",
    status: "active",
    createdAt: "05 Jan 2024",
    lastActive: "2 jam lalu",
  },
  {
    id: 3,
    name: "Budi Santoso",
    email: "budi.santoso@nusacita.id",
    phone: "08133333333",
    department: "Customer Service",
    role: "support",
    status: "active",
    createdAt: "10 Jan 2024",
    lastActive: "1 hari lalu",
  },
  {
    id: 4,
    name: "Maya Indah",
    email: "maya.indah@nusacita.id",
    phone: "08144444444",
    department: "Fraud Prevention",
    role: "analyst",
    status: "inactive",
    createdAt: "15 Jan 2024",
    lastActive: "3 hari lalu",
  },
  {
    id: 5,
    name: "Rizky Pratama",
    email: "rizky.pratama@nusacita.id",
    phone: "08155555555",
    department: "IT Security",
    role: "admin",
    status: "active",
    createdAt: "20 Jan 2024",
    lastActive: "5 menit lalu",
  },
  {
    id: 6,
    name: "Lina Kusuma",
    email: "lina.kusuma@nusacita.id",
    phone: "08166666666",
    department: "Customer Service",
    role: "support",
    status: "suspended",
    createdAt: "25 Jan 2024",
    lastActive: "1 minggu lalu",
  },
  {
    id: 7,
    name: "Dian Permata",
    email: "dian.permata@nusacita.id",
    phone: "08177777777",
    department: "Operations",
    role: "support",
    status: "active",
    createdAt: "01 Feb 2024",
    lastActive: "30 menit lalu",
  },
  {
    id: 8,
    name: "Fajar Nugroho",
    email: "fajar.nugroho@nusacita.id",
    phone: "08188888888",
    department: "Compliance",
    role: "analyst",
    status: "active",
    createdAt: "05 Feb 2024",
    lastActive: "1 jam lalu",
  },
  {
    id: 9,
    name: "Hani Puspita",
    email: "hani.puspita@nusacita.id",
    phone: "08199999999",
    department: "Risk Management",
    role: "analyst",
    status: "active",
    createdAt: "10 Feb 2024",
    lastActive: "Baru saja",
  },
  {
    id: 10,
    name: "Irwan Setiawan",
    email: "irwan.setiawan@nusacita.id",
    phone: "08100000000",
    department: "IT Security",
    role: "admin",
    status: "inactive",
    createdAt: "15 Feb 2024",
    lastActive: "2 minggu lalu",
  },
];

/* ── Toast hook ── */
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

/* ── Main Page ── */
const SuperAdmin = () => {
  const [loading, setLoading] = useState(true);

  const [users, setUsers] = useState(SEED_USERS);
  const [modalOpen, setModalOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const { toasts, push: pushToast } = useToast();

  /* ── CRUD handlers ── */
  const handleSubmit = (formData) => {
    const now = new Date().toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    if (formData.id) {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === formData.id
            ? { ...u, ...formData, lastActive: u.lastActive }
            : u,
        ),
      );
      pushToast(`Pengguna ${formData.name} berhasil diperbarui.`, "info");
    } else {
      const newUser = {
        ...formData,
        id: Date.now(),
        status: "active",
        createdAt: now,
        lastActive: "Baru saja",
      };
      setUsers((prev) => [newUser, ...prev]);
      pushToast(`Pengguna ${formData.name} berhasil ditambahkan!`, "success");
    }
  };

  const handleEdit = (user) => {
    setEditData(user);
    setModalOpen(true);
  };

  const handleDelete = (id) => {
    const user = users.find((u) => u.id === id);
    setUsers((prev) => prev.filter((u) => u.id !== id));
    pushToast(`Akun ${user?.name} telah dihapus.`, "error");
  };

  const handleToggleStatus = (id) => {
    const user = users.find((u) => u.id === id);
    const newStatus = user.status === "suspended" ? "active" : "suspended";
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, status: newStatus } : u)),
    );
    const label =
      newStatus === "suspended" ? "di-suspend" : "diaktifkan kembali";
    pushToast(
      `Akun ${user?.name} berhasil ${label}.`,
      newStatus === "suspended" ? "error" : "success",
    );
  };

  const handleOpenAdd = () => {
    setEditData(null);
    setModalOpen(true);
  };

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  if (loading) return <PageLoader message="Memuat Super Admin Panel..." />;

  return (
    <div className="superadmin-page">
      {/* Header */}
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
        <button className="btn-add-user" onClick={handleOpenAdd}>
          <i className="bi bi-plus-lg"></i>
          Tambah Pengguna
        </button>
      </div>

      {/* Stats */}
      <UserStats users={users} />

      {/* Table */}
      <UserTable
        users={users}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onToggleStatus={handleToggleStatus}
      />

      {/* Modal */}
      <AddUserModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditData(null);
        }}
        onSubmit={handleSubmit}
        editData={editData}
      />

      {/* Toasts */}
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
