import React, { useState, useEffect, useCallback } from "react";
import UserStats from "../components/superadmin/UserStats";
import UserTable from "../components/superadmin/UserTable";
import AddUserModal from "../components/superadmin/AddUserModal";
import "./SuperAdmin.css";
import PageLoader from "../components/common/PageLoader";

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

const postAuditLog = async (payload) => {
  try {
    await fetch("/audit-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {}
};

const ROLE_LABEL = {
  superadmin: "Super Admin",
  admin: "Admin",
  analyst: "Fraud Analyst",
};

const SuperAdmin = () => {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const { toasts, push: pushToast } = useToast();

  const [currentUser] = useState(() => {
    try {
      const stored = localStorage.getItem("currentUser");
      if (stored) return JSON.parse(stored);
    } catch {}
    return { id: "usr-010", name: "Irwan Setiawan", role: "superadmin" };
  });

  const isSuperAdmin = currentUser?.role === "superadmin";
  const superadminCount = users.filter((u) => u.role === "superadmin").length;

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/users?page_size=100");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setUsers(data.users);
    } catch {
      setUsers(SEED_USERS);
    }
  }, []);

  useEffect(() => {
    fetchUsers().finally(() => setLoading(false));
  }, [fetchUsers]);

  const handleSubmit = (userData) => {
    const isNew = !users.some((u) => u.id === userData.id);

    if (isNew) {
      const now = new Date().toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      setUsers((prev) => [
        {
          ...userData,
          status: "active",
          createdAt: now,
          lastActive: "Baru saja",
        },
        ...prev,
      ]);
      pushToast(`Pengguna ${userData.name} berhasil ditambahkan!`, "success");

      postAuditLog({
        type: "create",
        actor_name: currentUser.name,
        actor_role: currentUser.role,
        target_name: userData.name,
        target_role: userData.role,
        detail: `Membuat akun baru untuk ${userData.name} (${ROLE_LABEL[userData.role] || userData.role}) — Departemen: ${userData.department || "—"}`,
      });
    } else {
      const old = users.find((u) => u.id === userData.id);
      setUsers((prev) =>
        prev.map((u) => (u.id === userData.id ? { ...u, ...userData } : u)),
      );
      pushToast(`Pengguna ${userData.name} berhasil diperbarui.`, "info");

      const changes = [];
      if (old?.role !== userData.role)
        changes.push(
          `role: ${ROLE_LABEL[old?.role] || old?.role} → ${ROLE_LABEL[userData.role] || userData.role}`,
        );
      if (old?.department !== userData.department)
        changes.push(
          `departemen: ${old?.department || "—"} → ${userData.department || "—"}`,
        );
      if (old?.email !== userData.email) changes.push("email diperbarui");
      if (old?.name !== userData.name)
        changes.push(`nama: ${old?.name} → ${userData.name}`);

      postAuditLog({
        type: "edit",
        actor_name: currentUser.name,
        actor_role: currentUser.role,
        target_name: userData.name,
        target_role: userData.role,
        detail: `Memperbarui akun ${userData.name}: ${changes.length ? changes.join(", ") : "informasi diperbarui"}`,
      });
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

    postAuditLog({
      type: "delete",
      actor_name: currentUser.name,
      actor_role: currentUser.role,
      target_name: user?.name || id,
      target_role: user?.role || "",
      detail: `Menghapus akun ${user?.name} (${ROLE_LABEL[user?.role] || "—"}) — ${user?.department || "—"}`,
    });
  };

  const handleToggleStatus = (id) => {
    const user = users.find((u) => u.id === id);
    const newStatus = user.status === "suspended" ? "active" : "suspended";
    const isSuspend = newStatus === "suspended";

    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, status: newStatus } : u)),
    );
    pushToast(
      `Akun ${user?.name} berhasil ${isSuspend ? "di-suspend" : "diaktifkan kembali"}.`,
      isSuspend ? "error" : "success",
    );

    postAuditLog({
      type: "suspend",
      actor_name: currentUser.name,
      actor_role: currentUser.role,
      target_name: user?.name || id,
      target_role: user?.role || "",
      detail: isSuspend
        ? `Men-suspend akun ${user?.name} (${ROLE_LABEL[user?.role] || "—"})`
        : `Mengaktifkan kembali akun ${user?.name} (${ROLE_LABEL[user?.role] || "—"})`,
    });
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

      {isSuperAdmin && (
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
      )}

      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <i
              className={`bi ${t.type === "success" ? "bi-check-circle-fill" : t.type === "error" ? "bi-trash-fill" : "bi-info-circle-fill"}`}
            ></i>
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
};

const SEED_USERS = [
  {
    id: "usr-001",
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
    id: "usr-002",
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
    id: "usr-003",
    name: "Budi Santoso",
    email: "budi.santoso@nusacita.id",
    phone: "08133333333",
    department: "Risk Management",
    role: "analyst",
    status: "active",
    createdAt: "10 Jan 2024",
    lastActive: "1 hari lalu",
  },
  {
    id: "usr-004",
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
    id: "usr-005",
    name: "Rizky Pratama",
    email: "rizky.pratama@nusacita.id",
    phone: "08155555555",
    department: "Risk Management",
    role: "admin",
    status: "active",
    createdAt: "20 Jan 2024",
    lastActive: "5 menit lalu",
  },
  {
    id: "usr-006",
    name: "Lina Kusuma",
    email: "lina.kusuma@nusacita.id",
    phone: "08166666666",
    department: "Fraud Prevention",
    role: "analyst",
    status: "suspended",
    createdAt: "25 Jan 2024",
    lastActive: "1 minggu lalu",
  },
  {
    id: "usr-007",
    name: "Dian Permata",
    email: "dian.permata@nusacita.id",
    phone: "08177777777",
    department: "Risk Management",
    role: "analyst",
    status: "active",
    createdAt: "01 Feb 2024",
    lastActive: "30 menit lalu",
  },
  {
    id: "usr-008",
    name: "Fajar Nugroho",
    email: "fajar.nugroho@nusacita.id",
    phone: "08188888888",
    department: "Fraud Prevention",
    role: "analyst",
    status: "active",
    createdAt: "05 Feb 2024",
    lastActive: "1 jam lalu",
  },
  {
    id: "usr-009",
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
    id: "usr-010",
    name: "Irwan Setiawan",
    email: "irwan.setiawan@nusacita.id",
    phone: "08100000000",
    department: "Risk Management",
    role: "superadmin",
    status: "active",
    createdAt: "15 Feb 2024",
    lastActive: "2 minggu lalu",
  },
  {
    id: "usr-011",
    name: "Dewi Rahayu",
    email: "dewi.rahayu@nusacita.id",
    phone: "08111222333",
    department: "Risk Management",
    role: "superadmin",
    status: "active",
    createdAt: "20 Feb 2024",
    lastActive: "1 jam lalu",
  },
];

export default SuperAdmin;
