import React, { useState, useEffect, useCallback } from "react";
import api from "../../services/apiService";

const FIELD_MAP = {
  fraudAlerts: "fraud_alerts_enabled",
  pushNotifications: "push_notifications_enabled",
};

const NOTIFICATION_CONFIG = [
  {
    key: "fraudAlerts",
    icon: "exclamation-triangle",
    color: "danger",
    title: "Fraud Alerts",
    description: "Notifikasi segera saat terdeteksi aktivitas fraud",
  },
  {
    key: "pushNotifications",
    icon: "bell",
    color: "warning",
    title: "Push Notifications",
    description: "Notifikasi push di browser atau mobile",
  },
];

const SkeletonItem = () => (
  <div className="setting-item" style={{ opacity: 0.5 }}>
    <div className="setting-info">
      <div
        className="setting-icon"
        style={{ background: "#e5e7eb", borderRadius: 10 }}
      />
      <div className="setting-details">
        <div
          style={{
            height: 14,
            width: 120,
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
    <div
      style={{
        width: 48,
        height: 24,
        background: "#e5e7eb",
        borderRadius: 12,
      }}
    />
  </div>
);

const NotificationSettings = () => {
  const [prefs, setPrefs] = useState({
    fraudAlerts: false,
    pushNotifications: false,
  });
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState(null);
  const [toast, setToast] = useState(null);
  const [fetchError, setFetchError] = useState(false);

  const fetchPrefs = useCallback(async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const data = await api.get("/notifications/");
      setPrefs({
        fraudAlerts: data.fraud_alerts_enabled,
        pushNotifications: data.push_notifications_enabled,
      });
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrefs();
  }, [fetchPrefs]);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const handleToggle = async (field) => {
    if (savingKey) return;

    const newValue = !prefs[field];
    const apiKey = FIELD_MAP[field];

    setPrefs((prev) => ({ ...prev, [field]: newValue }));
    setSavingKey(field);

    try {
      await api.patch("/notifications/", { [apiKey]: newValue });
      showToast(
        newValue ? "Notifikasi diaktifkan." : "Notifikasi dinonaktifkan.",
        newValue ? "success" : "info",
      );
    } catch {
      setPrefs((prev) => ({ ...prev, [field]: !newValue }));
      showToast("Gagal menyimpan. Coba lagi.", "error");
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="card settings-card">
      <div className="card-header d-flex align-items-center justify-content-between">
        <h5 className="card-title mb-0">
          <i className="bi bi-bell me-2"></i>
          Notification Preferences
        </h5>

        {toast && (
          <span
            style={{
              fontSize: "0.8rem",
              fontWeight: 600,
              padding: "4px 12px",
              borderRadius: 20,
              background:
                toast.type === "success"
                  ? "#f0fdf4"
                  : toast.type === "error"
                    ? "#fef2f2"
                    : "#eff6ff",
              color:
                toast.type === "success"
                  ? "#16a34a"
                  : toast.type === "error"
                    ? "#dc2626"
                    : "#2563eb",
              border: `1px solid ${
                toast.type === "success"
                  ? "#bbf7d0"
                  : toast.type === "error"
                    ? "#fecaca"
                    : "#bfdbfe"
              }`,
              display: "flex",
              alignItems: "center",
              gap: 6,
              animation: "fadeIn .2s ease",
            }}
          >
            <i
              className={`bi bi-${
                toast.type === "success"
                  ? "check-circle-fill"
                  : toast.type === "error"
                    ? "x-circle-fill"
                    : "info-circle-fill"
              }`}
            />
            {toast.msg}
          </span>
        )}
      </div>

      <div className="card-body">
        {fetchError && (
          <div
            className="alert alert-danger d-flex align-items-center justify-content-between"
            style={{ borderRadius: 8 }}
          >
            <span>
              <i className="bi bi-exclamation-triangle me-2" />
              Gagal memuat preferensi notifikasi.
            </span>
            <button
              className="btn btn-sm btn-outline-danger"
              onClick={fetchPrefs}
            >
              <i className="bi bi-arrow-clockwise me-1" />
              Coba Lagi
            </button>
          </div>
        )}

        {!fetchError && (
          <>
            <p className="text-muted mb-4">
              Pilih jenis notifikasi yang ingin Anda terima
            </p>

            {loading
              ? NOTIFICATION_CONFIG.map((n) => <SkeletonItem key={n.key} />)
              : NOTIFICATION_CONFIG.map((n, index) => {
                  const isSaving = savingKey === n.key;
                  return (
                    <div
                      key={n.key}
                      className={`setting-item ${
                        index === NOTIFICATION_CONFIG.length - 1
                          ? "border-0 pb-0"
                          : ""
                      }`}
                      style={{
                        transition: "opacity .2s",
                        opacity: isSaving ? 0.7 : 1,
                      }}
                    >
                      <div className="setting-info">
                        <div className={`setting-icon bg-${n.color}`}>
                          <i className={`bi bi-${n.icon}`}></i>
                        </div>
                        <div className="setting-details">
                          <h6 style={{ marginBottom: "0.2rem" }}>{n.title}</h6>
                          <p style={{ margin: 0 }}>{n.description}</p>
                        </div>
                      </div>

                      <div className="setting-control d-flex align-items-center gap-2">
                        {isSaving && (
                          <div
                            style={{
                              width: 14,
                              height: 14,
                              border: "2px solid #e5e7eb",
                              borderTopColor: "#dc2626",
                              borderRadius: "50%",
                              animation: "spin .6s linear infinite",
                            }}
                          />
                        )}
                        <div className="form-check form-switch mb-0">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={prefs[n.key]}
                            onChange={() => handleToggle(n.key)}
                            disabled={isSaving || !!savingKey}
                            style={{
                              cursor: savingKey ? "not-allowed" : "pointer",
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
          </>
        )}
      </div>

      <style>{`
        @keyframes spin   { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
};

export default NotificationSettings;
