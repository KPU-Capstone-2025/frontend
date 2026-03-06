const DEFAULT_BASE_URL = "http://localhost:8080/api";
export const API_BASE_URL =
  import.meta?.env?.VITE_API_BASE_URL || DEFAULT_BASE_URL;

async function fetchJson(url, { method = "GET", headers, body, signal } = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(headers || {}),
    },
    body,
    signal,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const msg =
      (data && (data.message || data.error)) || `요청 실패 (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

function makeSeries(length, min, max) {
  return Array.from({ length }).map((_, i) => ({
    t: i,
    v: Number((min + Math.random() * (max - min)).toFixed(1)),
  }));
}

function buildMockHost(companyId) {
  return {
    companyId,
    companyName: companyId,
    host: {
      id: "host-1",
      name: "main-host-01",
      ip: "10.0.0.12",
      os: "Ubuntu 22.04",
      status: "healthy",
      cpuUsage: 32,
      memoryUsage: 46,
      diskUsage: 39,
      networkTraffic: 6,
      lastUpdate: new Date().toISOString(),
      uptime: "12일 4시간",
    },
    hostMetrics: {
      cpu: makeSeries(32, 22, 48),
      memory: makeSeries(32, 35, 59),
      disk: makeSeries(32, 32, 45),
      network: makeSeries(32, 2, 9),
    },
  };
}

function buildMockContainers(companyId) {
  const names = [
    ["nginx", "nginx:1.25"],
    ["db", "mysql:8.0"],
    ["prometheus", "prom/prometheus:v2"],
    ["loki", "grafana/loki:2.9"],
    ["grafana", "grafana/grafana:10"],
  ];

  return names.map(([name, image], idx) => ({
    id: `${companyId}-${name}`,
    name,
    image,
    status: idx === 3 ? "warning" : "healthy",
    cpuUsage: [22, 37, 64, 45, 66][idx],
    memoryUsage: [14, 87, 24, 68, 40][idx],
    diskUsage: [31, 54, 28, 73, 46][idx],
    networkTraffic: [22, 25, 16, 21, 36][idx],
    restarts: idx === 1 ? 1 : 0,
    lastUpdate: new Date().toISOString(),
  }));
}

function buildMockContainerMetrics(containerId) {
  const seed = containerId.length % 5;

  const cpu = makeSeries(32, 18 + seed * 4, 50 + seed * 5);
  const memory = makeSeries(32, 20 + seed * 5, 58 + seed * 4);
  const disk = makeSeries(32, 16 + seed * 4, 48 + seed * 5);
  const network = makeSeries(32, 1.6 + seed * 0.2, 5.4 + seed * 0.4);

  return {
    containerId,
    metrics: {
      cpu,
      memory,
      disk,
      network,
    },
    summary: {
      cpuAvg: cpu.reduce((sum, item) => sum + item.v, 0) / cpu.length,
      memoryAvg: memory.reduce((sum, item) => sum + item.v, 0) / memory.length,
      diskAvg: disk.reduce((sum, item) => sum + item.v, 0) / disk.length,
      networkAvg: network.reduce((sum, item) => sum + item.v, 0) / network.length,
    },
  };
}

export async function getHostOverview(companyId, { signal } = {}) {
  try {
    return await fetchJson(`${API_BASE_URL}/dashboard/${companyId}/host`, {
      signal,
    });
  } catch {
    return buildMockHost(companyId);
  }
}

export async function getContainers(companyId, { signal } = {}) {
  try {
    return await fetchJson(`${API_BASE_URL}/dashboard/container/${companyId}`, {
      signal,
    });
  } catch {
    return buildMockContainers(companyId);
  }
}

export async function getContainerMetrics(
  companyId,
  containerId,
  range = "24h",
  { signal } = {}
) {
  try {
    const qs = new URLSearchParams({ range: String(range) }).toString();
    return await fetchJson(
      `${API_BASE_URL}/dashboard/${companyId}/${containerId}?${qs}`,
      {
        signal,
      }
    );
  } catch {
    return buildMockContainerMetrics(containerId);
  }
}