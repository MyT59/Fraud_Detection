import { api } from "./apiService";

export const fetchAlerts = ({
  status,
  severity,
  service,
  priority,
  page = 1,
  limit = 10,
  signal,
} = {}) => {
  const params = new URLSearchParams({ page, limit });
  if (status) params.set("status", status);
  if (severity) params.set("severity", severity);
  if (service) params.set("service", service);
  if (priority) params.set("priority", priority);
  return api.get(`/alerts/?${params}`, { signal });
};

export const fetchAlertMetrics = (signal) =>
  api.get("/alerts/metrics", { signal });

export const fetchAlertCount = (signal) => api.get("/alerts/count", { signal });

export const fetchPriorityDistribution = (signal) =>
  api.get("/alerts/priority-distribution", { signal });

export const fetchOpenQueue = ({ priority, limit = 50, signal } = {}) => {
  const params = new URLSearchParams({ limit });
  if (priority) params.set("priority", priority);
  return api.get(`/alerts/open-queue?${params}`, { signal });
};

export const fetchMyQueue = (signal) => api.get("/alerts/my-queue", { signal });

export const fetchAlertDetail = (alertId, signal) =>
  api.get(`/alerts/${alertId}`, { signal });

export const claimAlert = (alertId) => api.post(`/alerts/${alertId}/claim`);

export const releaseAlert = (alertId) => api.post(`/alerts/${alertId}/release`);

export const resolveAlert = (alertId) =>
  api.patch(`/alerts/${alertId}/resolve`);

export const updateAlertStatus = (alertId, status) => {
  const params = new URLSearchParams({ status: status.toUpperCase() });
  return api.patch(`/alerts/${alertId}/status?${params}`);
};
