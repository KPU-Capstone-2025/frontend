<<<<<<< HEAD
const DEFAULT_BASE_URL = "http://capstone-elb-2051343563.ap-northeast-2.elb.amazonaws.com:8080/api";
const BASE_URL = (import.meta.env.VITE_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
=======
const BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://capstone-elb-2051343563.ap-northeast-2.elb.amazonaws.com:8080/api";

function getStoredAuthToken() {
  try {
    const raw = window.sessionStorage.getItem("monittoring_session");
    const session = raw ? JSON.parse(raw) : null;
    return session?.token || session?.accessToken || session?.jwt || "";
  } catch {
    return "";
  }
}
>>>>>>> e282a8a90d05afd9cbee554fb5307f8d44a8453a

async function request(path, { method = "GET", query, body, auth = true } = {}) {
  const url = new URL(`${BASE_URL}${path}`);

  if (query && typeof query === "object") {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const token = localStorage.getItem("monitoring_access_token");

  const res = await fetch(url.toString(), {
    method,
    headers: {
      "Content-Type": "application/json",
<<<<<<< HEAD
      ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
=======
      ...(getStoredAuthToken() ? { Authorization: `Bearer ${getStoredAuthToken()}` } : {}),
>>>>>>> e282a8a90d05afd9cbee554fb5307f8d44a8453a
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
  return request("/company/login", {
    method: "POST",
    body: { email, password },
    auth: false,
  });
}

export function registerCompany({ name, email, password, ip, phone }) {
  return request("/company/register", {
    method: "POST",
    body: { name, email, password, ip, phone },
    auth: false,
  });
}

export function getAgentDestination(companyId) {
  return request(`/company/agent/${companyId}`);
}

export function getHostOverview(companyId, { hostName } = {}) {
  return request(`/dashboard/${companyId}/host`, {
    query: { hostName },
  });
}

export function getContainers(companyId, { hostName } = {}) {
  return request(`/dashboard/container/${companyId}`, {
    query: { hostName },
  });
}

export function getContainerMetrics(companyId, containerName) {
  return request(`/dashboard/${companyId}/container/${encodeURIComponent(containerName)}/metrics`);
}

export function getLogs(companyId, { limit = 100, query, severity, hostName } = {}) {
  return request(`/dashboard/${companyId}/logs`, {
    query: { limit, keyword: query, severity, hostName },
  });
}
