import React, { useState, useMemo, useRef, useEffect } from "react";
import { RoleBadge, StatusBadge } from "./RoleBadge";
import "./UserTable.css";

const ROLE_LABEL_MAP = {
  superadmin: {
    label: "Super Admin",
    icon: "bi-shield-fill",
    color: "#dc2626",
    bg: "#fef2f2",
    border: "#fecaca",
  },
  admin: {
    label: "Admin",
    icon: "bi-person-badge-fill",
    color: "#2563eb",
    bg: "#eff6ff",
    border: "#bfdbfe",
  },
  analyst: {
    label: "Fraud Analyst",
    icon: "bi-search",
    color: "#ea580c",
    bg: "#fff7ed",
    border: "#fed7aa",
  },
};
const STATUS_LABEL_MAP = {
  active: {
    label: "Active",
    dot: "#16a34a",
    bg: "#f0fdf4",
    border: "#bbf7d0",
    color: "#16a34a",
  },
  inactive: {
    label: "Inactive",
    dot: "#9ca3af",
    bg: "#f9fafb",
    border: "#e5e7eb",
    color: "#6b7280",
  },
  suspended: {
    label: "Suspended",
    dot: "#dc2626",
    bg: "#fef2f2",
    border: "#fecaca",
    color: "#dc2626",
  },
};

const ActiveFilters = ({ search, sort, roleFilter, statusFilter, onClear }) => {
  const pills = [];

  if (search.trim()) {
    pills.push({
      key: "search",
      icon: "bi-search",
      label: `"${search.length > 18 ? search.slice(0, 18) + "…" : search}"`,
      iconColor: "#6b7280",
      bg: "#f3f4f6",
      border: "#e5e7eb",
      color: "#374151",
      onRemove: () => onClear("search"),
    });
  }

  if (sort.field) {
    const isAsc = sort.dir === "asc";
    pills.push({
      key: "sort",
      icon: isAsc ? "bi-sort-alpha-down" : "bi-sort-alpha-up-alt",
      label: `Nama ${isAsc ? "A → Z" : "Z → A"}`,
      iconColor: "#7c3aed",
      bg: "#f5f3ff",
      border: "#ddd6fe",
      color: "#7c3aed",
      onRemove: () => onClear("sort"),
    });
  }

  if (roleFilter !== "all") {
    const m = ROLE_LABEL_MAP[roleFilter] || {};
    pills.push({
      key: "role",
      icon: m.icon,
      label: `Role: ${m.label}`,
      iconColor: m.color,
      bg: m.bg,
      border: m.border,
      color: m.color,
      onRemove: () => onClear("role"),
    });
  }

  if (statusFilter !== "all") {
    const m = STATUS_LABEL_MAP[statusFilter] || {};
    pills.push({
      key: "status",
      dot: m.dot,
      label: `Status: ${m.label}`,
      bg: m.bg,
      border: m.border,
      color: m.color,
      onRemove: () => onClear("status"),
    });
  }

  if (pills.length === 0) return null;

  return (
    <div className="active-filters-bar">
      <span className="af-label">
        <i className="bi bi-funnel-fill" />
        Filter aktif:
      </span>
      <div className="af-pills">
        {pills.map((p) => (
          <span
            key={p.key}
            className="af-pill"
            style={{ background: p.bg, borderColor: p.border, color: p.color }}
          >
            {p.dot ? (
              <span className="af-pill-dot" style={{ background: p.dot }} />
            ) : (
              <i
                className={`bi ${p.icon}`}
                style={{ color: p.iconColor, fontSize: "0.72rem" }}
              />
            )}
            {p.label}
            <button
              className="af-pill-remove"
              style={{ color: p.color }}
              onClick={p.onRemove}
              title="Hapus filter ini"
            >
              <i className="bi bi-x" />
            </button>
          </span>
        ))}
      </div>
      <button className="af-reset-btn" onClick={() => onClear("all")}>
        <i className="bi bi-arrow-counterclockwise" />
        Reset semua
      </button>
    </div>
  );
};

const AVATAR_COLORS = [
  "#dc2626",
  "#2563eb",
  "#16a34a",
  "#ea580c",
  "#7c3aed",
  "#0891b2",
  "#be185d",
  "#ca8a04",
];
const getAvatarColor = (name = "") =>
  AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
const getInitials = (name = "") =>
  name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

const PAGE_SIZE = 8;

const ThDropdown = ({ open, onClose, children }) => {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="th-dropdown" ref={ref}>
      {children}
    </div>
  );
};

const SortTh = ({ label, field, sort, onSort }) => {
  const active = sort.field === field;
  const icon = !active
    ? "bi-arrow-down-up"
    : sort.dir === "asc"
      ? "bi-sort-alpha-down"
      : "bi-sort-alpha-up-alt";
  return (
    <th>
      <span
        className={`th-inner ${active ? "active" : ""}`}
        onClick={() => onSort(field)}
      >
        {label}
        <i className={`bi ${icon} th-sort-icon`} />
      </span>
    </th>
  );
};

const FilterTh = ({ label, value, options, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const active = value !== "all";

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <th>
      <div className="th-filter-wrap" ref={ref}>
        <button
          className={`th-filter-btn ${active ? "active" : ""} ${open ? "open" : ""}`}
          onClick={() => setOpen((v) => !v)}
        >
          {active && <span className="th-active-dot" />}
          {label}
          <i className="bi bi-chevron-down th-filter-chevron" />
        </button>
        <ThDropdown open={open} onClose={() => setOpen(false)}>
          {options.map((opt, i) =>
            opt === "---" ? (
              <div key={i} className="th-dropdown-divider" />
            ) : (
              <div
                key={opt.value}
                className={`th-dropdown-item ${value === opt.value ? "selected" : ""}`}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                {opt.dot && (
                  <span className="th-dd-dot" style={{ background: opt.dot }} />
                )}
                {opt.icon && (
                  <i
                    className={`bi ${opt.icon}`}
                    style={{ color: opt.iconColor, fontSize: "0.8rem" }}
                  />
                )}
                {opt.label}
              </div>
            ),
          )}
        </ThDropdown>
      </div>
    </th>
  );
};

const ROLE_OPTIONS = [
  { value: "all", label: "Semua Role" },
  { value: "---" },
  {
    value: "superadmin",
    label: "Super Admin",
    icon: "bi-shield-fill",
    iconColor: "#dc2626",
  },
  {
    value: "admin",
    label: "Admin",
    icon: "bi-person-badge-fill",
    iconColor: "#2563eb",
  },
  {
    value: "analyst",
    label: "Fraud Analyst",
    icon: "bi-search",
    iconColor: "#ea580c",
  },
];
const STATUS_OPTIONS = [
  { value: "all", label: "Semua Status" },
  { value: "---" },
  { value: "active", label: "Active", dot: "#16a34a" },
  { value: "inactive", label: "Inactive", dot: "#9ca3af" },
  { value: "suspended", label: "Suspended", dot: "#dc2626" },
];

const UserTable = ({
  users,
  onEdit,
  onDelete,
  onToggleStatus,
  currentUser,
}) => {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState({ field: null, dir: "asc" });
  const [page, setPage] = useState(1);
  const [confirmId, setConfirmId] = useState(null);

  const isSuperAdmin = currentUser?.role === "superadmin";

  const handleSort = (field) => {
    setSort((prev) =>
      prev.field === field
        ? { field, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { field, dir: "asc" },
    );
    setPage(1);
  };

  const filtered = useMemo(() => {
    let list = users.filter((u) => {
      const matchSearch =
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase());
      const matchRole = roleFilter === "all" || u.role === roleFilter;
      const matchStatus = statusFilter === "all" || u.status === statusFilter;
      return matchSearch && matchRole && matchStatus;
    });

    if (sort.field === "name") {
      list = [...list].sort((a, b) => {
        const cmp = a.name.localeCompare(b.name, "id");
        return sort.dir === "asc" ? cmp : -cmp;
      });
    }
    return list;
  }, [users, search, roleFilter, statusFilter, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  const handleDelete = async (id) => {
    if (confirmId === id) {
      try {
        await fetch(`/users/${id}`, {
          method: "DELETE",
          headers: {
            "X-Actor-Role": currentUser?.role || "superadmin",
            "X-Actor-Id": currentUser?.id || "",
          },
        });
      } catch {}
      onDelete(id);
      setConfirmId(null);
    } else {
      setConfirmId(id);
    }
  };

  const handleClearFilter = (key) => {
    if (key === "search") {
      setSearch("");
      setPage(1);
    }
    if (key === "sort") {
      setSort({ field: null, dir: "asc" });
    }
    if (key === "role") {
      setRoleFilter("all");
      setPage(1);
    }
    if (key === "status") {
      setStatusFilter("all");
      setPage(1);
    }
    if (key === "all") {
      setSearch("");
      setSort({ field: null, dir: "asc" });
      setRoleFilter("all");
      setStatusFilter("all");
      setPage(1);
    }
  };

  const handleToggle = async (user) => {
    const newStatus = user.status === "suspended" ? "active" : "suspended";
    try {
      await fetch(`/users/${user.id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Actor-Role": currentUser?.role || "superadmin",
        },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch {}
    onToggleStatus(user.id);
  };

  return (
    <div className="user-table-wrapper">
      <div className="table-toolbar">
        <span className="table-title">
          Daftar Pengguna
          <span style={{ color: "#9ca3af", fontWeight: 400, marginLeft: 6 }}>
            ({filtered.length} pengguna)
          </span>
        </span>
        <div className="table-toolbar-right">
          <div className="search-box">
            <i className="bi bi-search" />
            <input
              type="text"
              placeholder="Cari nama atau email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
      </div>

      <ActiveFilters
        search={search}
        sort={sort}
        roleFilter={roleFilter}
        statusFilter={statusFilter}
        onClear={handleClearFilter}
      />

      <div className="table-scroll">
        <table className="user-table">
          <thead>
            <tr>
              <SortTh
                label="Pengguna"
                field="name"
                sort={sort}
                onSort={handleSort}
              />

              <FilterTh
                label="Role"
                value={roleFilter}
                options={ROLE_OPTIONS}
                onChange={(v) => {
                  setRoleFilter(v);
                  setPage(1);
                }}
              />

              <FilterTh
                label="Status"
                value={statusFilter}
                options={STATUS_OPTIONS}
                onChange={(v) => {
                  setStatusFilter(v);
                  setPage(1);
                }}
              />

              <th>Dibuat</th>
              <th>Terakhir Aktif</th>
              {isSuperAdmin && <th>Aksi</th>}
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={isSuperAdmin ? 6 : 5}>
                  <div className="table-empty">
                    <i className="bi bi-inbox" />
                    <p>Tidak ada pengguna ditemukan.</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginated.map((user) => (
                <tr
                  key={user.id}
                  className={confirmId === user.id ? "confirm-delete-row" : ""}
                >
                  <td>
                    <div className="user-cell">
                      <div
                        className="user-avatar-table"
                        style={{ background: getAvatarColor(user.name) }}
                      >
                        {getInitials(user.name)}
                      </div>
                      <div className="user-cell-info">
                        <span className="user-full-name">{user.name}</span>
                        <span className="user-email-text">{user.email}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <RoleBadge role={user.role} />
                  </td>
                  <td>
                    <StatusBadge status={user.status} />
                  </td>
                  <td className="last-active">{user.createdAt}</td>
                  <td className="last-active">{user.lastActive || "—"}</td>

                  {isSuperAdmin && (
                    <td>
                      {confirmId === user.id ? (
                        <div className="action-btns">
                          <button
                            className="btn-action btn-delete"
                            onClick={() => handleDelete(user.id)}
                            style={{
                              width: "auto",
                              padding: "0 10px",
                              fontSize: ".75rem",
                              color: "#dc2626",
                            }}
                          >
                            <i
                              className="bi bi-check-lg"
                              style={{ marginRight: 4 }}
                            />
                            Ya, Hapus
                          </button>
                          <button
                            className="btn-action"
                            onClick={() => setConfirmId(null)}
                          >
                            <i className="bi bi-x" />
                          </button>
                        </div>
                      ) : (
                        <div className="action-btns">
                          <button
                            className="btn-action btn-edit"
                            title="Edit pengguna"
                            onClick={() => onEdit(user)}
                          >
                            <i className="bi bi-pencil" />
                          </button>
                          <button
                            className="btn-action btn-suspend"
                            title={
                              user.status === "suspended"
                                ? "Aktifkan"
                                : "Suspend"
                            }
                            onClick={() => handleToggle(user)}
                          >
                            <i
                              className={`bi ${user.status === "suspended" ? "bi-play-circle" : "bi-pause-circle"}`}
                            />
                          </button>
                          <button
                            className="btn-action btn-delete"
                            title="Hapus pengguna"
                            onClick={() => handleDelete(user.id)}
                          >
                            <i className="bi bi-trash" />
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="table-pagination">
        <span>
          Menampilkan{" "}
          {filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–
          {Math.min(safePage * PAGE_SIZE, filtered.length)} dari{" "}
          {filtered.length} pengguna
        </span>
        <div className="pagination-btns">
          <button
            className="btn-page"
            disabled={safePage === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <i className="bi bi-chevron-left" />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(
              (p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1,
            )
            .reduce((acc, p, idx, arr) => {
              if (idx > 0 && p - arr[idx - 1] > 1) acc.push("...");
              acc.push(p);
              return acc;
            }, [])
            .map((p, idx) =>
              p === "..." ? (
                <span
                  key={`e-${idx}`}
                  style={{ padding: "0 4px", color: "#9ca3af" }}
                >
                  …
                </span>
              ) : (
                <button
                  key={p}
                  className={`btn-page ${safePage === p ? "active" : ""}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              ),
            )}
          <button
            className="btn-page"
            disabled={safePage === totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            <i className="bi bi-chevron-right" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserTable;
