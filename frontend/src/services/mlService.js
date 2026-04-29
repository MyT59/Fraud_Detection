export const BASE_URL =
  process.env.REACT_APP_ML_API_URL || "http://localhost:8000";

const post = async (endpoint, body) => {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json();
};

export const labelHistory = async (domain, records, thresholds = {}) => {
  return post(`/isolation/${domain}/score-history`, {
    records,
    review_score_threshold: thresholds.review || null,
    high_risk_score_threshold: thresholds.high_risk || null,
  });
};

export const scoreIsolation = async (domain, records) => {
  return post(`/isolation/${domain}/score-history`, { records });
};
