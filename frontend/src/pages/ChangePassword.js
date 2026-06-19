import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authService } from "../services/AuthService"; // ✅ FIX: dari AuthService bukan apiService
import { storage } from "../services/apiService";
import "./ChangePassword.css";

const ChangePassword = () => {
  const navigate = useNavigate();
  const user = storage.getUser();

  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPw, setShowPw] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError("");
  };

  const toggleShow = (field) => {
    setShowPw((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (form.newPassword !== form.confirmPassword) {
      setError("Password baru tidak cocok.");
      return;
    }
    if (form.newPassword.length < 8) {
      setError("Password minimal 8 karakter.");
      return;
    }

    setSaving(true);
    try {
      await authService.changePassword(form.currentPassword, form.newPassword);

      // Update is_password_temporary di storage
      const current = storage.getUser();
      if (current) {
        storage.setUser({ ...current, is_password_temporary: false });
      }

      setSuccess(true);
      setTimeout(() => {
        navigate("/dashboard", { replace: true });
      }, 1500);
    } catch (err) {
      setError(err.message || "Gagal mengubah password. Coba lagi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="cp-page">
      <div className="cp-card">
        <div className="cp-icon-wrap">
          <i className="bi bi-shield-lock-fill"></i>
        </div>

        <h1 className="cp-title">Buat Password Baru</h1>
        <p className="cp-subtitle">
          Akun <strong>{user?.email}</strong> menggunakan password sementara.
          <br />
          Buat password baru sebelum melanjutkan.
        </p>

        {success && (
          <div className="cp-alert cp-alert-success">
            <i className="bi bi-check-circle-fill"></i>
            Password berhasil diubah! Mengarahkan ke dashboard...
          </div>
        )}

        {error && (
          <div className="cp-alert cp-alert-error">
            <i className="bi bi-exclamation-circle-fill"></i>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="cp-form">
          <div className="cp-field">
            <label className="cp-label">Password Sementara</label>
            <div className="cp-input-wrap">
              <input
                className="cp-input"
                type={showPw.current ? "text" : "password"}
                name="currentPassword"
                value={form.currentPassword}
                onChange={handleChange}
                placeholder="Masukkan password sementara"
                required
                disabled={saving || success}
              />
              <button
                type="button"
                className="cp-eye"
                onClick={() => toggleShow("current")}
              >
                <i className={`bi bi-eye${showPw.current ? "-slash" : ""}`}></i>
              </button>
            </div>
          </div>

          <div className="cp-field">
            <label className="cp-label">Password Baru</label>
            <div className="cp-input-wrap">
              <input
                className="cp-input"
                type={showPw.new ? "text" : "password"}
                name="newPassword"
                value={form.newPassword}
                onChange={handleChange}
                placeholder="Min. 8 karakter, huruf besar, angka, simbol"
                required
                disabled={saving || success}
              />
              <button
                type="button"
                className="cp-eye"
                onClick={() => toggleShow("new")}
              >
                <i className={`bi bi-eye${showPw.new ? "-slash" : ""}`}></i>
              </button>
            </div>
            <span className="cp-hint">
              Harus mengandung huruf besar, huruf kecil, angka, dan simbol
              (@$!%*?&)
            </span>
          </div>

          <div className="cp-field">
            <label className="cp-label">Konfirmasi Password Baru</label>
            <div className="cp-input-wrap">
              <input
                className="cp-input"
                type={showPw.confirm ? "text" : "password"}
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={handleChange}
                placeholder="Ulangi password baru"
                required
                disabled={saving || success}
              />
              <button
                type="button"
                className="cp-eye"
                onClick={() => toggleShow("confirm")}
              >
                <i className={`bi bi-eye${showPw.confirm ? "-slash" : ""}`}></i>
              </button>
            </div>
          </div>

          <button type="submit" className="cp-btn" disabled={saving || success}>
            {saving ? (
              <>
                <span className="cp-spinner"></span>
                Menyimpan...
              </>
            ) : success ? (
              <>
                <i className="bi bi-check-circle-fill"></i>
                Berhasil!
              </>
            ) : (
              <>
                <i className="bi bi-shield-check"></i>
                Simpan Password Baru
              </>
            )}
          </button>
        </form>

        <button
          className="cp-logout"
          onClick={() => authService.logout()}
          disabled={saving}
        >
          <i className="bi bi-box-arrow-right"></i>
          Keluar dan login dengan akun lain
        </button>
      </div>
    </div>
  );
};

export default ChangePassword;
