import React, { useState, useEffect, useCallback } from "react";
import api, { authService } from "../../services/apiService";

const SecuritySettings = () => {
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [sessionError, setSessionError] = useState(false);
  const [revokingId, setRevokingId] = useState(null);

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordError, setPasswordError] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const fetchSessions = useCallback(async () => {
    setLoadingSessions(true);
    setSessionError(false);
    try {
      const data = await api.get("/sessions");
      setSessions(Array.isArray(data) ? data : []);
    } catch {
      setSessionError(true);
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleRevokeSession = async (sessionId) => {
    setRevokingId(sessionId);
    try {
      await api.post(`/sessions/${sessionId}/revoke`);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch {
      alert("Gagal mencabut sesi. Coba lagi.");
    } finally {
      setRevokingId(null);
    }
  };

  const handlePasswordChange = (e) => {
    setPasswordData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setPasswordError("");
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordError("");

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError("Password baru tidak cocok!");
      return;
    }
    if (passwordData.newPassword.length < 8) {
      setPasswordError("Password minimal 8 karakter.");
      return;
    }

    setPasswordSaving(true);
    try {
      await authService.changePassword(
        passwordData.currentPassword,
        passwordData.newPassword,
      );
      setPasswordSuccess(true);
      setTimeout(() => {
        setPasswordSuccess(false);
        setShowPasswordModal(false);
        setPasswordData({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
      }, 1500);
    } catch (err) {
      setPasswordError(err.message || "Gagal mengubah password. Coba lagi.");
    } finally {
      setPasswordSaving(false);
    }
  };

  const formatLastUsed = (dateStr) => {
    if (!dateStr) return "Tidak diketahui";
    const d = new Date(dateStr);
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return "Aktif sekarang";
    if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
    return d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getDeviceIcon = (device) => {
    if (!device) return "bi-display";
    const d = device.toLowerCase();
    if (d.includes("iphone") || d.includes("android") || d.includes("mobile"))
      return "bi-phone";
    if (d.includes("ipad") || d.includes("tablet")) return "bi-tablet";
    return "bi-laptop";
  };

  return (
    <>
      <div className="card settings-card">
        <div className="card-header">
          <h5 className="card-title mb-0">
            <i className="bi bi-shield-lock me-2"></i>
            Security Settings
          </h5>
        </div>
        <div className="card-body">
          <div className="setting-item border-0 pb-0">
            <div className="setting-info">
              <div className="setting-icon bg-danger">
                <i className="bi bi-key"></i>
              </div>
              <div className="setting-details">
                <h6>Password</h6>
                <p>Ubah password akun Anda secara berkala untuk keamanan</p>
              </div>
            </div>
            <div className="setting-control">
              <button
                className="btn btn-sm btn-outline-danger"
                onClick={() => setShowPasswordModal(true)}
              >
                Change Password
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card settings-card mt-4">
        <div className="card-header d-flex align-items-center justify-content-between">
          <h5 className="card-title mb-0">
            <i className="bi bi-laptop me-2"></i>
            Active Sessions
          </h5>
          {!loadingSessions && !sessionError && (
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={fetchSessions}
            >
              <i className="bi bi-arrow-clockwise me-1"></i>
              Refresh
            </button>
          )}
        </div>
        <div className="card-body">
          {sessionError && (
            <div className="alert alert-danger d-flex align-items-center justify-content-between">
              <span>
                <i className="bi bi-exclamation-triangle me-2" />
                Gagal memuat sesi aktif.
              </span>
              <button
                className="btn btn-sm btn-outline-danger"
                onClick={fetchSessions}
              >
                <i className="bi bi-arrow-clockwise me-1" />
                Coba Lagi
              </button>
            </div>
          )}

          {loadingSessions ? (
            [1, 2].map((i) => (
              <div key={i} className="session-item" style={{ opacity: 0.5 }}>
                <div className="session-info">
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: "#e5e7eb",
                    }}
                  />
                  <div>
                    <div
                      style={{
                        height: 14,
                        width: 160,
                        background: "#e5e7eb",
                        borderRadius: 6,
                        marginBottom: 6,
                      }}
                    />
                    <div
                      style={{
                        height: 12,
                        width: 220,
                        background: "#f3f4f6",
                        borderRadius: 6,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))
          ) : sessions.length === 0 && !sessionError ? (
            <p className="text-muted text-center py-3">
              Tidak ada sesi aktif lainnya.
            </p>
          ) : (
            sessions.map((session) => (
              <div key={session.id} className="session-item">
                <div className="session-info">
                  <i
                    className={`bi ${getDeviceIcon(session.device)} session-device-icon`}
                  ></i>
                  <div>
                    <h6>{session.device || "Unknown Device"}</h6>
                    <p
                      className="text-muted mb-0"
                      style={{ fontSize: "0.85rem" }}
                    >
                      {session.ip && (
                        <>
                          <i className="bi bi-geo-alt"></i> {session.ip}
                          <span className="mx-2">•</span>
                        </>
                      )}
                      <i className="bi bi-clock"></i>{" "}
                      {formatLastUsed(session.last_used)}
                    </p>
                  </div>
                </div>
                {session.is_current ? (
                  <span className="badge bg-success">Sesi Ini</span>
                ) : (
                  <button
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => handleRevokeSession(session.id)}
                    disabled={revokingId === session.id}
                  >
                    {revokingId === session.id ? (
                      <span className="spinner-border spinner-border-sm" />
                    ) : (
                      "Revoke"
                    )}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {showPasswordModal && (
        <div
          className="modal-overlay"
          onClick={() => !passwordSaving && setShowPasswordModal(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h5>Change Password</h5>
              <button
                className="btn-close"
                onClick={() => setShowPasswordModal(false)}
                disabled={passwordSaving}
              ></button>
            </div>
            <form onSubmit={handlePasswordSubmit}>
              <div className="modal-body">
                {passwordSuccess && (
                  <div className="alert alert-success">
                    <i className="bi bi-check-circle me-2" />
                    Password berhasil diubah!
                  </div>
                )}
                {passwordError && (
                  <div className="alert alert-danger">
                    <i className="bi bi-exclamation-circle me-2" />
                    {passwordError}
                  </div>
                )}
                <div className="mb-3">
                  <label className="form-label">Current Password</label>
                  <input
                    type="password"
                    className="form-control"
                    name="currentPassword"
                    value={passwordData.currentPassword}
                    onChange={handlePasswordChange}
                    required
                    disabled={passwordSaving || passwordSuccess}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">New Password</label>
                  <input
                    type="password"
                    className="form-control"
                    name="newPassword"
                    value={passwordData.newPassword}
                    onChange={handlePasswordChange}
                    required
                    minLength={8}
                    disabled={passwordSaving || passwordSuccess}
                  />
                  <small className="text-muted">Minimal 8 karakter</small>
                </div>
                <div className="mb-3">
                  <label className="form-label">Confirm New Password</label>
                  <input
                    type="password"
                    className="form-control"
                    name="confirmPassword"
                    value={passwordData.confirmPassword}
                    onChange={handlePasswordChange}
                    required
                    disabled={passwordSaving || passwordSuccess}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setShowPasswordModal(false)}
                  disabled={passwordSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-danger"
                  disabled={passwordSaving || passwordSuccess}
                >
                  {passwordSaving ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" />
                      Menyimpan...
                    </>
                  ) : (
                    "Update Password"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default SecuritySettings;
