import { api } from "./apiService";

/**
 * Semua dashboard API calls terpusat di sini.
 * Memudahkan debugging & testing.
 */
export const dashboardService = {
  /**
   * GET /dashboard/summary
   * Satu endpoint untuk semua data dashboard sekaligus.
   * Pakai ini di load awal Dashboard.
   */
  getSummary: (signal) => api.get("/dashboard/summary", { signal }),

  /**
   * GET /dashboard/transactions/trend/detail
   * @param {"today"|"weekly"|"monthly"} range
   * @param {string} [start]  format: YYYY-MM-DD (hanya jika range=custom)
   * @param {string} [end]    format: YYYY-MM-DD (hanya jika range=custom)
   */
  getTransactionTrendDetail: ({ range = "today", start, end } = {}) => {
    const params = new URLSearchParams({ range });
    if (start) params.set("start", start);
    if (end) params.set("end", end);
    return api.get(`/dashboard/transactions/trend/detail?${params}`);
  },

  /**
   * GET /dashboard/kpi
   * Jika butuh refresh KPI saja tanpa reload semua.
   */
  getKpi: () => api.get("/dashboard/kpi"),

  /**
   * GET /dashboard/alerts/recent
   */
  getRecentAlerts: () => api.get("/dashboard/alerts/recent"),

  /**
   * GET /dashboard/activity?type=...
   * @param {string} [type]  "FRAUD"|"ALERT"|"REVIEW"|"SECURITY"|"SYSTEM"
   */
  getActivity: (type) => {
    const url = type
      ? `/dashboard/activity?type=${type}`
      : "/dashboard/activity";
    return api.get(url);
  },

  /**
   * GET /dashboard/system-health
   */
  getSystemHealth: () => api.get("/dashboard/system-health"),
};

export default dashboardService;
