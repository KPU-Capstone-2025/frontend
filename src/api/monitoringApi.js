// src/api/monitoringApi.js

const BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080/api/monitoring";

async function request(path, { method = "GET", query } = {}) {
  const url = new URL(BASE_URL + path);

  if (query && typeof query === "object") {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });
  }

  const res = await fetch(url.toString(), { method });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API Error ${res.status}: ${text || res.statusText}`);
  }

  return res.json();
}

export function getCompanies() {
  return request("/companies");
}

export function getDashboardSummary(companyId) {
  return request("/dashboard/summary", { query: { companyId } });
}

/**
 * ✅ 로그 조회
 * 백엔드: GET /api/monitoring/logs?companyId=...&limit=...
 */
export function getLogs(companyId, { limit = 200 } = {}) {
  return request("/logs", { query: { companyId, limit } });
}