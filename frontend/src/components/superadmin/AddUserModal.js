import React, { useState, useEffect, useRef } from "react";
import "./AddUserModal.css";
import { api } from "../../services/apiService";

const ROLES = [
  {
    value: "superadmin",
    roleName: "SUPER_ADMIN",
    label: "Super Admin",
    desc: "Kontrol penuh sistem",
    icon: "bi-shield-fill",
    colorClass: "c-superadmin",
  },
  {
    value: "riskmanager",
    roleName: "RISK_MANAGER",
    label: "Risk Manager",
    desc: "Hak akses penuh",
    icon: "bi-person-badge-fill",
    colorClass: "c-risk-manager",
  },
  {
    value: "analyst",
    roleName: "FRAUD_ANALYST",
    label: "Fraud Analyst",
    desc: "Review & investigasi",
    icon: "bi-search",
    colorClass: "c-analyst",
  },
];

const DEPARTMENTS = ["Risk Management", "Fraud Prevention"];

const EMPTY = {
  name: "",
  email: "",
  phone: "",
  department: "",
  role: "",
  password: "",
  confirmPassword: "",
  notes: "",
};

const F = ({ label, req, opt, err, children }) => (
  <div className="aum-field">
    <label className="aum-label">
      {label}
      {req && <span className="aum-req"> *</span>}
      {opt && <span className="aum-opt"> (opsional)</span>}
    </label>
    {children}
    {err && (
      <span className="aum-field-error">
        <i className="bi bi-exclamation-circle-fill" /> {err}
      </span>
    )}
  </div>
);

const AddUserModal = ({
  isOpen,
  onClose,
  onSubmit,
  editData,
  currentUser,
  superadminCount,
  roles = [],
}) => {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [showPw, setShowPw] = useState(false);
  const [showCpw, setShowCpw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const nameRef = useRef(null);

  const isEdit = Boolean(editData);
  const availableRoles = ROLES.map((role) => ({
    ...role,
    roleId: roles.find((item) => item.role_name === role.roleName)?.id,
  })).filter((role) => Number.isInteger(role.roleId));

  const isSelf = isEdit && editData?.id === currentUser?.id;
  const lockRole =
    isSelf && editData?.role === "superadmin" && superadminCount <= 1;

  useEffect(() => {
    if (isOpen) {
      setForm(
        isEdit
          ? { ...EMPTY, ...editData, password: "", confirmPassword: "" }
          : EMPTY,
      );
      setErrors({});
      setApiError("");
      setShowPw(false);
      setShowCpw(false);
      setTimeout(() => nameRef.current?.focus(), 50);
    }
  }, [isOpen, isEdit, editData]);

  if (!isOpen) return null;

  const set = (field, value) => {
    setForm((p) => ({ ...p, [field]: value }));
    if (errors[field]) setErrors((p) => ({ ...p, [field]: undefined }));
    setApiError("");
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Nama wajib diisi.";
    if (!form.email.trim()) e.email = "Email wajib diisi.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = "Format email tidak valid.";
    if (!form.role) e.role = "Pilih salah satu role.";
    if (!isEdit) {
      if (!form.password) e.password = "Password wajib diisi.";
      else if (
        form.password.length < 8 ||
        !/[A-Z]/.test(form.password) ||
        !/[a-z]/.test(form.password) ||
        !/[0-9]/.test(form.password) ||
        !/[@$!%*?&]/.test(form.password)
      ) e.password = "Minimal 8 karakter, huruf besar/kecil, angka, dan simbol @$!%*?&.";
      if (form.password !== form.confirmPassword)
        e.confirmPassword = "Password tidak cocok.";
    }
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    setLoading(true);
    setApiError("");

    try {
      let data;

      if (isEdit) {
        data = await api.patch(`/accounts/${editData.id}`, {
          full_name: form.name.trim(),
          role_id: availableRoles.find((role) => role.value === form.role)?.roleId,
          department: form.department || null,
          phone_number: form.phone || null,
          notes: form.notes || null,
        });
      } else {
        data = await api.post("/accounts/", {
          full_name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          confirm_password: form.confirmPassword,
          role_id: availableRoles.find((role) => role.value === form.role)?.roleId,
          department: form.department || null,
          phone_number: form.phone || null,
          notes: form.notes || null,
        });
      }

      onSubmit(data);
      onClose();
    } catch (err) {
      setApiError(err.message || "Terjadi kesalahan pada server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="aum-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="aum-box">
        <div className="aum-header">
          <div className="aum-header-left">
            <div className="aum-icon">
              <i
                className={`bi ${isEdit ? "bi-pencil-square" : "bi-person-plus-fill"}`}
              />
            </div>
            <div>
              <p className="aum-title">
                {isEdit ? "Edit Pengguna" : "Tambah Pengguna Baru"}
              </p>
              <p className="aum-subtitle">
                {isEdit
                  ? "Perbarui informasi pengguna yang ada"
                  : "Isi detail untuk membuat akun baru"}
              </p>
            </div>
          </div>
          <button className="aum-close" onClick={onClose}>
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <div className="aum-body">
          {apiError && (
            <div className="aum-api-error">
              <i className="bi bi-exclamation-triangle-fill" /> {apiError}
            </div>
          )}

          <div className="aum-section">
            <span>Informasi Dasar</span>
          </div>
          <div className="aum-row">
            <F label="Nama Lengkap" req err={errors.name}>
              <input
                className={`aum-input ${errors.name ? "is-error" : ""}`}
                type="text"
                placeholder="cth: Budi Santoso"
                value={form.name}
                ref={nameRef}
                onChange={(e) => set("name", e.target.value)}
              />
            </F>
            <F label="Email" req err={errors.email}>
              <input
                className={`aum-input ${errors.email ? "is-error" : ""}`}
                type="email"
                placeholder="cth: budi@company.com"
                value={form.email}
                disabled={isEdit}
                style={isEdit ? { opacity: 0.6, cursor: "not-allowed" } : {}}
                onChange={(e) => set("email", e.target.value)}
              />
            </F>
          </div>
          <div className="aum-row">
            <F label="No. Telepon" opt>
              <input
                className="aum-input"
                type="text"
                placeholder="cth: 08123456789"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
            </F>
            <F label="Departemen">
              <div className="aum-select-wrap">
                <select
                  className="aum-select"
                  value={form.department}
                  onChange={(e) => set("department", e.target.value)}
                >
                  <option value="">— Pilih Departemen —</option>
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </F>
          </div>

          <div className="aum-section">
            <span>Hak Akses</span>
          </div>
          <div className="aum-field">
            <label className="aum-label">
              Role <span className="aum-req">*</span>
            </label>
            <div className="aum-roles">
              {availableRoles.map((r) => {
                const locked = lockRole && r.value !== "superadmin";
                return (
                  <div
                    key={r.value}
                    className={`aum-role-card ${form.role === r.value ? "is-selected" : ""} ${locked ? "is-locked" : ""}`}
                    onClick={() => !locked && set("role", r.value)}
                    title={
                      locked
                        ? "Tidak bisa dipilih — kamu satu-satunya Super Admin"
                        : ""
                    }
                  >
                    {locked && (
                      <div className="aum-role-lock">
                        <i className="bi bi-lock-fill" />
                      </div>
                    )}
                    <div className={`aum-role-icon ${r.colorClass}`}>
                      <i className={`bi ${r.icon}`} />
                    </div>
                    <div className="aum-role-name">{r.label}</div>
                    <div className="aum-role-desc">{r.desc}</div>
                  </div>
                );
              })}
            </div>
            {lockRole && (
              <div className="aum-role-lock-msg">
                <i className="bi bi-info-circle-fill" />
                &nbsp;Kamu satu-satunya Super Admin. Tambah Super Admin lain
                untuk bisa mengubah role-mu sendiri.
              </div>
            )}
            {errors.role && (
              <span className="aum-role-error">
                <i className="bi bi-exclamation-circle-fill" /> {errors.role}
              </span>
            )}
          </div>

          {!isEdit && (
            <>
              <div className="aum-section">
                <span>Keamanan Akun</span>
              </div>
              <div className="aum-row">
                <F label="Password" req err={errors.password}>
                  <div className="aum-pw-wrap">
                    <input
                      className={`aum-input ${errors.password ? "is-error" : ""}`}
                      type={showPw ? "text" : "password"}
                      placeholder="Min. 8 karakter"
                      value={form.password}
                      onChange={(e) => set("password", e.target.value)}
                    />
                    <button
                      className="aum-pw-toggle"
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPw((v) => !v)}
                    >
                      <i
                        className={`bi ${showPw ? "bi-eye-slash" : "bi-eye"}`}
                      />
                    </button>
                  </div>
                </F>
                <F label="Konfirmasi Password" req err={errors.confirmPassword}>
                  <div className="aum-pw-wrap">
                    <input
                      className={`aum-input ${errors.confirmPassword ? "is-error" : ""}`}
                      type={showCpw ? "text" : "password"}
                      placeholder="Ulangi password"
                      value={form.confirmPassword}
                      onChange={(e) => set("confirmPassword", e.target.value)}
                    />
                    <button
                      className="aum-pw-toggle"
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowCpw((v) => !v)}
                    >
                      <i
                        className={`bi ${showCpw ? "bi-eye-slash" : "bi-eye"}`}
                      />
                    </button>
                  </div>
                </F>
              </div>
            </>
          )}

          <F label="Catatan" opt>
            <textarea
              className="aum-textarea"
              placeholder="Catatan tambahan mengenai pengguna ini..."
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </F>
        </div>

        <div className="aum-footer">
          <button
            className="aum-btn-cancel"
            onClick={onClose}
            disabled={loading}
          >
            Batal
          </button>
          <button
            className="aum-btn-submit"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="aum-spinner" />
                Menyimpan...
              </>
            ) : (
              <>
                <i className={`bi ${isEdit ? "bi-check-lg" : "bi-plus-lg"}`} />
                {isEdit ? "Simpan Perubahan" : "Buat Pengguna"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddUserModal;
