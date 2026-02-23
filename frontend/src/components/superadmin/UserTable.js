import React, { useState, useMemo } from 'react';
import { RoleBadge, StatusBadge } from './RoleBadge';
import './UserTable.css';

// Generate consistent avatar color from name
const AVATAR_COLORS = [
  '#dc2626','#2563eb','#16a34a','#ea580c',
  '#7c3aed','#0891b2','#be185d','#ca8a04',
];
const getAvatarColor = (name = '') => {
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
};
const getInitials = (name = '') =>
  name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

const PAGE_SIZE = 8;

const UserTable = ({ users, onEdit, onDelete, onToggleStatus }) => {
  const [search, setSearch]         = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage]             = useState(1);
  const [confirmId, setConfirmId]   = useState(null);

  const filtered = useMemo(() => {
    return users.filter(u => {
      const matchSearch =
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase());
      const matchRole   = roleFilter   === 'all' || u.role   === roleFilter;
      const matchStatus = statusFilter === 'all' || u.status === statusFilter;
      return matchSearch && matchRole && matchStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const paginated  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleDelete = (id) => {
    if (confirmId === id) {
      onDelete(id);
      setConfirmId(null);
    } else {
      setConfirmId(id);
    }
  };

  return (
    <div className="user-table-wrapper">
      {/* Toolbar */}
      <div className="table-toolbar">
        <span className="table-title">
          Daftar Pengguna
          <span style={{ color: '#9ca3af', fontWeight: 400, marginLeft: 6 }}>
            ({filtered.length} pengguna)
          </span>
        </span>
        <div className="table-toolbar-right">
          <div className="search-box">
            <i className="bi bi-search"></i>
            <input
              type="text"
              placeholder="Cari nama atau email..."
              value={search}
              onChange={handleSearchChange}
            />
          </div>
          <select
            className="filter-select"
            value={roleFilter}
            onChange={e => { setRoleFilter(e.target.value); setPage(1); }}
          >
            <option value="all">Semua Role</option>
            <option value="admin">Admin</option>
            <option value="analyst">Fraud Analyst</option>
          </select>
          <select
            className="filter-select"
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          >
            <option value="all">Semua Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="table-scroll">
        <table className="user-table">
          <thead>
            <tr>
              <th>Pengguna</th>
              <th>Role</th>
              <th>Status</th>
              <th>Dibuat</th>
              <th>Terakhir Aktif</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className="table-empty">
                    <i className="bi bi-inbox"></i>
                    <p>Tidak ada pengguna ditemukan.</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginated.map(user => (
                <tr key={user.id} className={confirmId === user.id ? 'confirm-delete-row' : ''}>
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
                  <td><RoleBadge role={user.role} /></td>
                  <td><StatusBadge status={user.status} /></td>
                  <td className="last-active">{user.createdAt}</td>
                  <td className="last-active">{user.lastActive || '—'}</td>
                  <td>
                    {confirmId === user.id ? (
                      <div className="action-btns">
                        <button
                          className="btn-action btn-delete"
                          title="Konfirmasi hapus"
                          onClick={() => handleDelete(user.id)}
                          style={{ width: 'auto', padding: '0 10px', fontSize: '0.75rem', color: '#dc2626' }}
                        >
                          <i className="bi bi-check-lg" style={{ marginRight: 4 }}></i>Ya, Hapus
                        </button>
                        <button
                          className="btn-action"
                          title="Batal"
                          onClick={() => setConfirmId(null)}
                        >
                          <i className="bi bi-x"></i>
                        </button>
                      </div>
                    ) : (
                      <div className="action-btns">
                        <button
                          className="btn-action btn-edit"
                          title="Edit pengguna"
                          onClick={() => onEdit(user)}
                        >
                          <i className="bi bi-pencil"></i>
                        </button>
                        <button
                          className="btn-action btn-suspend"
                          title={user.status === 'suspended' ? 'Aktifkan' : 'Suspend'}
                          onClick={() => onToggleStatus(user.id)}
                        >
                          <i className={`bi ${user.status === 'suspended' ? 'bi-play-circle' : 'bi-pause-circle'}`}></i>
                        </button>
                        <button
                          className="btn-action btn-delete"
                          title="Hapus pengguna"
                          onClick={() => handleDelete(user.id)}
                        >
                          <i className="bi bi-trash"></i>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="table-pagination">
        <span>
          Menampilkan {Math.min((safePage - 1) * PAGE_SIZE + 1, filtered.length)}–
          {Math.min(safePage * PAGE_SIZE, filtered.length)} dari {filtered.length} pengguna
        </span>
        <div className="pagination-btns">
          <button
            className="btn-page"
            disabled={safePage === 1}
            onClick={() => setPage(p => p - 1)}
          >
            <i className="bi bi-chevron-left"></i>
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
            .reduce((acc, p, idx, arr) => {
              if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
              acc.push(p);
              return acc;
            }, [])
            .map((p, idx) =>
              p === '...' ? (
                <span key={`ellipsis-${idx}`} style={{ padding: '0 4px', color: '#9ca3af' }}>…</span>
              ) : (
                <button
                  key={p}
                  className={`btn-page ${safePage === p ? 'active' : ''}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              )
            )}
          <button
            className="btn-page"
            disabled={safePage === totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            <i className="bi bi-chevron-right"></i>
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserTable;