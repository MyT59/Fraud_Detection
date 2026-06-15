import React, { useState, useEffect, useCallback, useRef } from "react";
import ActivityStats from "../components/auditlog/ActivityStats";
import ActivityFilters from "../components/auditlog/ActivityFilters";
import ActivityFeed from "../components/auditlog/ActivityFeed";
import "./AuditLog.css";
import PageLoader from "../components/common/PageLoader";
import activityLogService, {
  AUDIT_LOG_ACTIONS,
} from "../services/activityLogService";

// Mapping action_type BE → type display FE
const ACTION_TYPE_MAP = {
  ACCOUNT_CREATED: "create",
  ACCOUNT_ROLE_CHANGED: "edit",
  ACCOUNT_SUSPENDED: "suspend",
};

// Konversi log BE ke format feed
const toFeedItem = (log) => {
  const type = ACTION_TYPE_MAP[log.action_type] || "edit";
  const details = log.details || {};

  // Nama target — prioritas: details.email, details.full_name, target_id
  const targetName = details.email || details.full_name || log.target_id || "—";

  let desc = "";
  if (typeof details === "string") {
    desc = details;
  } else if (type === "create") {
    desc = `Membuat akun baru untuk ${targetName}${details.department ? ` — Departemen: ${details.department}` : ""}`;
  } else if (type === "edit") {
    const before = details.before || {};
    const after = details.after || {};
    const changes = Object.keys(after)
      .filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]))
      .map((k) => `${k}: ${before[k] ?? "—"} → ${after[k]}`)
      .join(", ");
    desc = `Memperbarui akun ${targetName}${changes ? `: ${changes}` : ""}`;
  } else if (type === "suspend") {
    const isActive = details.target_status_active;
    if (isActive === true) desc = `Mengaktifkan kembali akun ${targetName}`;
    else if (isActive === false) desc = `Men-suspend akun ${targetName}`;
    else desc = details.reason || `Akun ${targetName} diarsipkan`;
  }

  return {
    id: log.id,
    type,
    action_type: log.action_type,
    desc,
    time: log.created_at
      ? new Date(log.created_at).toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "—",
    created_at: log.created_at,
    actor: log.admin_name || "System",
    actor_email: log.admin_email,
    actor_display:
      log.admin_name && log.admin_email
        ? `${log.admin_name} (${log.admin_email})`
        : log.admin_name || "System",
  };
};

const FALLBACK_LOGS = [
  {
    id: "f-01",
    type: "create",
    desc: "Membuat akun baru untuk Hani Puspita (Fraud Analyst) — Departemen: Risk Management",
    time: "10 Feb 2024",
    actor: "Super Admin",
  },
  {
    id: "f-02",
    type: "edit",
    desc: "Memperbarui akun Rizky Pratama: role: Fraud Analyst → Admin",
    time: "08 Feb 2024",
    actor: "Super Admin",
  },
  {
    id: "f-03",
    type: "suspend",
    desc: "Men-suspend akun Lina Kusuma (Fraud Analyst)",
    time: "05 Feb 2024",
    actor: "Super Admin",
  },
  {
    id: "f-04",
    type: "create",
    desc: "Membuat akun baru untuk Dian Permata (Fraud Analyst) — Departemen: Risk Management",
    time: "01 Feb 2024",
    actor: "Super Admin",
  },
  {
    id: "f-05",
    type: "edit",
    desc: "Memperbarui akun Fajar Nugroho: departemen: Risk Management → Fraud Prevention",
    time: "30 Jan 2024",
    actor: "Super Admin",
  },
  {
    id: "f-06",
    type: "suspend",
    desc: "Menghapus akun Toni Hidayat (Fraud Analyst) — Risk Management",
    time: "28 Jan 2024",
    actor: "Super Admin",
  },
];

const ACTION_TYPE_FILTER = {
  create: ["ACCOUNT_CREATED"],
  edit: ["ACCOUNT_ROLE_CHANGED"],
  suspend: ["ACCOUNT_SUSPENDED"],
};

// ---- Main Page ----
const AuditLog = () => {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [apiError, setApiError] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const debounceTimer = useRef(null);

  const fetchLogs = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setLoading(true);
      try {
        const params = {
          page: 1,
          limit: 200,
          action_types:
            typeFilter === "all"
              ? AUDIT_LOG_ACTIONS
              : ACTION_TYPE_FILTER[typeFilter] || AUDIT_LOG_ACTIONS,
        };
        if (debouncedSearch.trim()) params.search = debouncedSearch.trim();

        const res = await activityLogService.getAuditLogs(params);
        const items = (res.items || []).map(toFeedItem);
        setLogs(items);
        setTotalRecords(res.total || items.length);
        setApiError(false);
      } catch {
        setApiError(true);
        setLogs(FALLBACK_LOGS);
        setTotalRecords(FALLBACK_LOGS.length);
      } finally {
        setLoading(false);
      }
    },
    [typeFilter, debouncedSearch],
  );

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleSearch = (val) => {
    setSearch(val);
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedSearch(val), 400);
  };

  const handleReset = () => {
    setSearch("");
    setDebouncedSearch("");
    setTypeFilter("all");
  };

  if (loading) return <PageLoader message="Memuat Audit Log..." />;

  return (
    <div className="auditlog-page">
      <div className="al-header">
        <div className="al-header-left">
          <div className="al-header-icon">
            <i className="bi bi-clock-history"></i>
          </div>
          <div>
            <h1 className="al-title">Audit Log</h1>
            <p className="al-subtitle">
              Riwayat seluruh aktivitas dan perubahan sistem
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <a
            href="/reports"
            className="al-export-btn"
            title="Export via Reports"
          >
            <i className="bi bi-download"></i>Export Log
            <i
              className="bi bi-box-arrow-up-right ms-1"
              style={{ fontSize: ".7rem" }}
            ></i>
          </a>
          <button
            onClick={() => fetchLogs(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "9px 16px",
              border: "1.5px solid #e5e7eb",
              borderRadius: 8,
              background: "#fff",
              cursor: "pointer",
              fontSize: ".85rem",
              fontWeight: 600,
              color: "#6b7280",
              fontFamily: "inherit",
            }}
          >
            <i className="bi bi-arrow-clockwise"></i>Refresh
          </button>
        </div>
      </div>

      {apiError && (
        <div
          style={{
            marginBottom: 16,
            padding: "10px 16px",
            borderRadius: 8,
            background: "#fffbeb",
            border: "1px solid #fde68a",
            color: "#92400e",
            fontSize: ".82rem",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <i className="bi bi-exclamation-triangle-fill"></i>
          API tidak tersedia — menampilkan data historis sementara.
        </div>
      )}

      <ActivityStats logs={logs} />

      <ActivityFilters
        search={search}
        onSearch={handleSearch}
        typeFilter={typeFilter}
        onTypeFilter={setTypeFilter}
        onReset={handleReset}
      />

      <div className="al-card">
        <div className="al-card-header">
          <h2 className="al-card-title">
            <i className="bi bi-list-ul"></i>
            Log Aktivitas
            <span className="al-count">
              ({logs.length} dari {totalRecords.toLocaleString()} entri)
            </span>
          </h2>
        </div>
        <ActivityFeed logs={logs} />
      </div>
    </div>
  );
};

export default AuditLog;
