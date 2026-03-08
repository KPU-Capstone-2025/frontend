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

function clampNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round(value, digits = 1) {
  const n = clampNumber(value, 0);
  return Number(n.toFixed(digits));
}

function bytesToMb(value) {
  return clampNumber(value, 0) / (1024 * 1024);
}

function bytesToGb(value) {
  return clampNumber(value, 0) / (1024 * 1024 * 1024);
}

function normalizeUsage(value, { preferred = "percent", allowBytes = false } = {}) {
  const raw = clampNumber(value, 0);

  if (allowBytes && raw > 1024) {
    const mb = bytesToMb(raw);

    if (mb >= 1024) {
      return {
        raw,
        value: round(bytesToGb(raw), 2),
        unit: "GB",
      };
    }

    return {
      raw,
      value: round(mb, 2),
      unit: "MB",
    };
  }

  return {
    raw,
    value: round(raw, 1),
    unit: preferred === "percent" ? "%" : preferred,
  };
}

function normalizeNetwork(value) {
  const raw = clampNumber(value, 0);

  if (raw > 1024 * 1024) {
    return {
      raw,
      value: round(bytesToMb(raw), 2),
      unit: "MB/s",
    };
  }

  return {
    raw,
    value: round(raw, 2),
    unit: "MB/s",
  };
}

function mapBackendStatus(status) {
  const normalized = String(status || "").toUpperCase();

  if (["RUNNING", "STABLE", "NORMAL", "HEALTHY", "UP"].includes(normalized)) {
    return "healthy";
  }
  if (["WARNING", "WARN", "DEGRADED", "DANGER"].includes(normalized)) {
    return "warning";
  }
  return "bad";
}

function makeFlatSeries(value, length = 12) {
  const safe = round(value, 2);
  return Array.from({ length }, (_, idx) => ({
    t: idx,
    v: safe,
  }));
}

function normalizeHostResponse(payload, companyId) {
  const metrics = payload?.result || {};

  const cpu = normalizeUsage(metrics.cpuUsage, { preferred: "percent" });
  const memory = normalizeUsage(metrics.memoryUsage, {
    preferred: "percent",
    allowBytes: true,
  });
  const disk = normalizeUsage(metrics.diskUsage, {
    preferred: "percent",
    allowBytes: true,
  });
  const network = normalizeNetwork(metrics.networkTraffic);

  return {
    companyId,
    host: {
      id: `host-${companyId}`,
      name: "호스트 서버",
      status: mapBackendStatus(metrics.status),
      rawStatus: metrics.status || "UNKNOWN",
      cpuUsage: cpu.value,
      cpuUnit: cpu.unit,
      memoryUsage: memory.value,
      memoryUnit: memory.unit,
      diskUsage: disk.value,
      diskUnit: disk.unit,
      networkTraffic: network.value,
      networkUnit: network.unit,
      lastUpdate: new Date().toISOString(),
    },
    hostMetrics: {
      cpu: makeFlatSeries(cpu.value),
      memory: makeFlatSeries(memory.value),
      disk: makeFlatSeries(disk.value),
      network: makeFlatSeries(network.value),
    },
  };
}

function normalizeContainersResponse(payload) {
  const list = Array.isArray(payload?.containers) ? payload.containers : [];

  return list.map((item) => ({
    id: item.containerId,
    name: item.containerId,
    status: mapBackendStatus(item.status),
    rawStatus: item.status || "UNKNOWN",
  }));
}

function buildSummary(metrics) {
  return {
    cpuAvg: avgSeries(metrics.cpu),
    memoryAvg: avgSeries(metrics.memory),
    diskAvg: avgSeries(metrics.disk),
    networkAvg: avgSeries(metrics.network),
  };
}

function avgSeries(series = []) {
  if (!series.length) return 0;
  return round(
    series.reduce((sum, item) => sum + clampNumber(item.v, 0), 0) / series.length,
    2
  );
}

function normalizeContainerMetricsResponse(payload) {
  const metrics = payload?.results || {};

  const cpu = normalizeUsage(metrics.cpuUsage, { preferred: "percent" });
  const memory = normalizeUsage(metrics.memoryUsage, {
    preferred: "MB",
    allowBytes: true,
  });
  const disk = normalizeUsage(metrics.diskUsage, {
    preferred: "percent",
    allowBytes: true,
  });
  const network = normalizeNetwork(metrics.networkTraffic);

  const normalized = {
    status: mapBackendStatus(metrics.status),
    rawStatus: metrics.status || "UNKNOWN",
    metrics: {
      cpu: makeFlatSeries(cpu.value),
      memory: makeFlatSeries(memory.value),
      disk: makeFlatSeries(disk.value),
      network: makeFlatSeries(network.value),
    },
    units: {
      cpu: cpu.unit,
      memory: memory.unit,
      disk: disk.unit,
      network: network.unit,
    },
  };

  return {
    ...normalized,
    summary: buildSummary(normalized.metrics),
  };
}

export async function loginCompany({ email, password }, { signal } = {}) {
  const data = await fetchJson(`${API_BASE_URL}/company/login`, {
    method: "POST",
    body: JSON.stringify({ email, password }),
    signal,
  });

  const companyId = data?.id;

  if (!companyId) {
    throw new Error("로그인 응답에서 companyId를 찾지 못했습니다.");
  }

  return {
    companyId,
    companyName: `기업 #${companyId}`,
    email,
  };
}

export async function registerCompany(
  { name, email, password, ip, phone },
  { signal } = {}
) {
  return fetchJson(`${API_BASE_URL}/company/register`, {
    method: "POST",
    body: JSON.stringify({ name, email, password, ip, phone }),
    signal,
  });
}

export async function getAgentDestination(companyId, { signal } = {}) {
  const data = await fetchJson(`${API_BASE_URL}/agent/${companyId}`, {
    signal,
  });

  return data?.result || null;
}

export async function getHostOverview(companyId, { signal } = {}) {
  const data = await fetchJson(`${API_BASE_URL}/dashboard/${companyId}/host`, {
    signal,
  });

  return normalizeHostResponse(data, companyId);
}

export async function getContainers(companyId, { signal } = {}) {
  const data = await fetchJson(`${API_BASE_URL}/dashboard/container/${companyId}`, {
    signal,
  });

  return normalizeContainersResponse(data);
}

export async function getContainerMetrics(
  companyId,
  containerId,
  range = "1h",
  { signal } = {}
) {
  const qs = new URLSearchParams({ period: String(range) }).toString();
  const data = await fetchJson(
    `${API_BASE_URL}/dashboard/${companyId}/${encodeURIComponent(containerId)}?${qs}`,
    { signal }
  );

  return normalizeContainerMetricsResponse(data);
}