import { api } from "./apiService";

const query = (params) => {
  const search = new URLSearchParams(params);
  return search.toString();
};

export const simulatorService = {
  getStatus: () => api.get("/simulator/status"),
  getScenarios: () => api.get("/simulator/scenarios"),
  getScenarioPreview: (scenario, service) =>
    api.get(
      `/simulator/scenarios/${encodeURIComponent(scenario)}/preview?${query({
        service,
      })}`,
    ),
  getScenarioTransactions: (scenario, service) =>
    api.get(
      `/simulator/scenarios/${encodeURIComponent(scenario)}/transactions?${query({
        service,
      })}`,
    ),
  start: (domain, scenario) =>
    api.post("/simulator/generate", {
      domain,
      scenario: scenario || null,
    }),
  stop: () => api.post("/simulator/stop", {}),
  manual: (service, payload) =>
    api.post(`/simulator/manual/${service}`, payload),
  bulk: (service, payload) =>
    api.post(`/simulator/bulk/${service}`, payload),
  replay: (payload) => api.post("/simulator/replay", payload),
  reset: (target) =>
    api.deleteWithBody("/simulator/reset", { confirm: true, target }),
};

export default simulatorService;
