const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080/api";

async function request(path, { method = "GET", query, body } = {}) {
  const url = new URL(BASE_URL + path);
  if (query) Object.entries(query).forEach(([k, v]) => v && url.searchParams.set(k, String(v)));

  const res = await fetch(url.toString(), {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text().catch(() => "");
  if (!res.ok) throw new Error(`API Error ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

export const registerCompany = (data) => request("/company/register", { method: "POST", body: data });
export const loginCompany = (creds) => request("/company/login", { method: "POST", body: creds });

export const getAgentDestination = (id) => request(`/company/agent/${id}`);
export const getHostOverview = (id) => request(`/dashboard/${id}/host`).then(r => r.result);
export const getContainers = (id) => request(`/dashboard/container/${id}`).then(r => r.containers || []);
export const getContainerMetrics = (id, name) => request(`/dashboard/${id}/container/${name}/metrics`).then(r => r.result);

export const getLogs = (id, params) => request(`/dashboard/${id}/logs`, { query: params }).then(r => r.result || []);
export const analyzeLog = (logContent) => request(`/dashboard/logs/analyze`, { method: "POST", body: { logContent } }).then(r => r.analysis);

export const updateAlertRules = (data) => request("/rules/update", { method: "POST", body: data });
export const askChatbot = (monitoringId, question) => request(`/chat/ask`, { method: "POST", body: { monitoringId, question } });
export const getChatHistory = (monitoringId) => request(`/chat/history/${monitoringId}`);