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

  console.log("[API Request]", method, url.toString());

  const res = await fetch(url.toString(), {
    method,
    headers: {
      "Content-Type": "application/json",
    },
  });

  const text = await res.text().catch(() => "");
  console.log("[API Response]", res.status, text.slice(0, 200));

  if (!res.ok) {
    throw new Error(`API Error ${res.status}: ${text || res.statusText}`);
  }

  return text ? JSON.parse(text) : null;
}

export function getCompanies() {
  return request("/auth/monitoring/companies");
}

export function getDashboardSummary(companyId) {
  return request("/monitoring/dashboard/summary", {
    query: { companyId },
  });
}

export function getLogs(companyId, { limit = 100, query, demo } = {}) {
  return request(`/dashboard/${companyId}/logs`, {
    query: { limit, query, demo },
  });
}