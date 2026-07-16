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
   * GET /reports/fraud-analysts
   */
  getFraudAnalysts: async () => {
    return api.get("/reports/fraud-analysts");
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
   * DELETE /reports/{id}
   */
  deleteReport: async (id) => {
    return api.delete(`/reports/${id}`);
  },

  /**
   * GET /reports/{id}/download
   * BE return JSON { download_url }.
   * - Jika Supabase aktif: signed URL Supabase (full URL, public, langsung window.open)
   * - Jika fallback lokal: path relatif "/reports/{id}/raw" yang butuh auth header,
   *   jadi di-fetch manual sebagai blob (window.open tidak bisa kirim Bearer token)
   */
  downloadReport: async (id) => {
    const res = await api.get(`/reports/${id}/download`);
    if (!res?.download_url) {
      throw new Error("Download URL tidak tersedia dari server.");
    }

    const isLocalFallback = res.download_url.startsWith("/");
    const format = (res.format || "").toUpperCase();

    // PDF bisa langsung dibuka di tab baru — browser punya PDF viewer built-in.
    // CSV/XLSX tidak punya viewer built-in, browser akan tampilkan sebagai teks
    // mentah kalau dibuka langsung, jadi harus di-force download sebagai file.
    const shouldForceDownload = format === "CSV" || format === "XLSX";

    if (!isLocalFallback && !shouldForceDownload) {
      // Supabase signed URL untuk PDF — public, langsung buka di tab baru
      window.open(res.download_url, "_blank");
      return res;
    }

    // CSV/XLSX (Supabase atau lokal) ATAU semua format dari local fallback
    // -> fetch sebagai blob lalu force download
    const fileUrl = isLocalFallback
      ? `${process.env.REACT_APP_API_URL || "http://localhost:8000"}${res.download_url}`
      : res.download_url;

    const fetchOptions = isLocalFallback
      ? { headers: { Authorization: `Bearer ${storage.getAccessToken()}` } }
      : {};

    const fileRes = await fetch(fileUrl, fetchOptions);
    if (!fileRes.ok) {
      throw new Error(`Gagal mengambil file (HTTP ${fileRes.status})`);
    }

    const blob = await fileRes.blob();
    const ext = format.toLowerCase() || "pdf";
    const filename = `${res.report_name?.replace(/[^a-z0-9]+/gi, "_") || "report"}.${ext}`;

    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    }, 100);

    return res;
  },
};

export default reportService;
