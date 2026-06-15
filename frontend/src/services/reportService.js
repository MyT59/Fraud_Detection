// src/services/reportService.js
import { api, storage } from "./apiService";

const reportService = {
  /**
   * POST /reports/generate
   */
  generateReport: async (payload) => {
    return api.post("/reports/generate", payload);
  },

  /**
   * GET /reports
   */
  getReports: async ({ report_type, status, page = 1, limit = 20 } = {}) => {
    const params = new URLSearchParams();
    params.append("page", page);
    params.append("limit", limit);
    if (report_type) params.append("report_type", report_type);
    if (status) params.append("status", status);
    return api.get(`/reports?${params.toString()}`);
  },

  /**
   * GET /reports/{id}
   */
  getReportById: async (id) => {
    return api.get(`/reports/${id}`);
  },

  /**
   * GET /reports/{id}/download
   * Download file dengan auth header, lalu trigger save sebagai blob.
   */
  downloadReport: async (id, fallbackFilename = "report") => {
    const base = process.env.REACT_APP_API_URL || "http://localhost:8000";
    const token = storage.getAccessToken();

    const res = await fetch(`${base}/reports/${id}/download`, {
      method: "GET",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.detail || `HTTP ${res.status}`);
    }

    // Ambil filename dari Content-Disposition header jika ada
    const disposition = res.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename="?([^"]+)"?/);
    const filename = match ? match[1] : fallbackFilename;

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  },
};

export default reportService;
