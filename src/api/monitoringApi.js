const BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://capstone-elb-2051343563.ap-northeast-2.elb.amazonaws.com:8080/api").replace(/\/$/, "");

function getStoredAuthToken() {
  try {
    const raw = window.sessionStorage.getItem("monittoring_session");
    const session = raw ? JSON.parse(raw) : null;
    return session?.token || "";
  } catch {
    return "";
  }
}

async function request(path, { method = "GET", query, body, auth = true } = {}) {
  const url = new URL(`${BASE_URL}${path}`);

  if (query && typeof query === "object") {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const token = getStoredAuthToken();

  const res = await fetch(url.toString(), {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text().catch(() => "");

  if (!res.ok) {
    throw new Error(`API Error ${res.status}: ${text || res.statusText}`);
  }

  return text ? JSON.parse(text) : null;
}

export function loginCompany({ email, password }) {
  return request("/company/login", { method: "POST", body: { email, password }, auth: false });
}

export function registerCompany({ name, email, password, phone }) {
  return request("/company/register", { method: "POST", body: { name, email, password, phone }, auth: false });
}

export function getAgentDestination(companyId) {
  return request(`/company/agent/${companyId}`);
}

export function getHostOverview(companyId, { hostName } = {}) {
  return request(`/dashboard/${companyId}/host`, { query: { hostName } });
}

export function getContainers(companyId, { hostName } = {}) {
  return request(`/dashboard/container/${companyId}`, { query: { hostName } });
}

export function getContainerMetrics(companyId, containerName) {
  return request(`/dashboard/${companyId}/container/${encodeURIComponent(containerName)}/metrics`);
}

export function getLogs(companyId, { limit = 100, query, severity, hostName } = {}) {
  return request(`/dashboard/${companyId}/logs`, { query: { limit, keyword: query, severity, hostName } });
}
