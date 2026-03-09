const BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080/api";

async function request(path, { method = "GET", query } = {}) {
  const url = new URL(BASE_URL + path);

  if (query && typeof query === "object") {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
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
  return request("/auth/monitoring/companies");
}

export function getDashboardSummary(companyId) {
  return request("/monitoring/dashboard/summary", {
    query: { companyId },
  });
}

export function getLogs(companyId, { limit = 200, level, keyword } = {}) {
  return request("/monitoring/logs", {
    query: { companyId, limit, level, keyword },
  });
}