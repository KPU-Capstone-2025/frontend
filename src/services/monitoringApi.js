const DEFAULT_BASE_URL = "http://localhost:8080/api/monitoring";
export const API_BASE_URL = import.meta?.env?.VITE_API_BASE_URL || DEFAULT_BASE_URL;

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
    const msg = (data && (data.message || data.error)) || `요청 실패 (${res.status})`;
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
    status: "healthy",
    cpuUsage: [22, 37, 64, 45, 66][idx],
    memoryUsage: [14, 87, 24, 68, 40][idx],
    networkTraffic: [22, 25, 16, 21, 36][idx],
    restarts: idx === 1 ? 1 : 0,
    lastUpdate: new Date().toISOString(),
  }));
}

function buildMockContainerMetrics(containerId) {
  const seed = containerId.length % 5;

  return {
    containerId,
    metrics: {
      cpu: makeSeries(32, 18 + seed * 4, 50 + seed * 5),
      memory: makeSeries(32, 1.2 + seed * 0.2, 3.8 + seed * 0.3),
      networkIn: makeSeries(32, 0.8 + seed * 0.1, 3.2 + seed * 0.3),
      networkOut: makeSeries(32, 0.5 + seed * 0.1, 2.6 + seed * 0.3),
      networkTotal: makeSeries(32, 1.6 + seed * 0.2, 5.4 + seed * 0.4),
    },
    summary: {
      cpuAvg: 33 + seed * 3,
      memoryAvg: 2.4 + seed * 0.2,
      networkAvg: 3.2 + seed * 0.4,
    },
  };
}

/**
 * 실제 API 붙일 때 예시
 *
 * 1) 호스트 서버 전체 조회
 * GET /dashboard/summary?companyId=...
 *
 * 2) 해당 회사 컨테이너 목록 조회
 * GET /containers?companyId=...
 *
 * 3) 특정 컨테이너 메트릭 조회
 * GET /containers/{containerId}/metrics?companyId=...&range=24h
 */

export async function getHostOverview(companyId, { signal } = {}) {
  try {
    const qs = new URLSearchParams({ companyId: String(companyId) }).toString();
    return await fetchJson(`${API_BASE_URL}/dashboard/summary?${qs}`, { signal });
  } catch {
    return buildMockHost(companyId);
  }
}

export async function getContainers(companyId, { signal } = {}) {
  try {
    const qs = new URLSearchParams({ companyId: String(companyId) }).toString();
    return await fetchJson(`${API_BASE_URL}/containers?${qs}`, { signal });
  } catch {
    return buildMockContainers(companyId);
  }
}

export async function getContainerMetrics(companyId, containerId, range = "24h", { signal } = {}) {
  try {
    const qs = new URLSearchParams({
      companyId: String(companyId),
      range: String(range),
    }).toString();
    return await fetchJson(
      `${API_BASE_URL}/containers/${containerId}/metrics?${qs}`,
      { signal }
    );
  } catch {
    return buildMockContainerMetrics(containerId);
  }
}