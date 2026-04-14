const DEFAULT_BASE_URL = "http://localhost:8080/api";
export const API_BASE_URL =
  import.meta?.env?.VITE_API_BASE_URL || DEFAULT_BASE_URL;

const USE_MOCK = import.meta?.env?.VITE_USE_MOCK === "true";
const ENABLE_FALLBACK =
  import.meta?.env?.VITE_ENABLE_API_FALLBACK !== "false";

// 실시간 그래프
// 실제로 수집된 스냅샷 쌓이도록 .
const HISTORY_LIMIT = 80;

const mockRuntime = {
  hostTick: 0,
  containerTick: {},
  containerStatus: {},
};

function createApiError(message, extras = {}) {
  const err = new Error(message);
  Object.assign(err, extras);
  return err;
}

function shouldFallbackToMock(err) {
  if (!ENABLE_FALLBACK) return false;
  if (!err) return false;
  if (err.name === "AbortError") return false;
  if (err.isNetworkError) return true;
  if (typeof err.status === "number" && err.status >= 500) return true;
  return false;
}

async function withMockFallback(realFn, mockFn) {
  if (USE_MOCK) {
    return mockFn();
  }

  try {
    return await realFn();
  } catch (err) {
    if (shouldFallbackToMock(err)) {
      console.warn("[monitoringApi] real API 실패 → mock fallback", err);
      return mockFn();
    }
    throw err;
  }
}

async function fetchJson(url, { method = "GET", headers, body, signal } = {}) {
  let res;

  try {
    res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(headers || {}),
      },
      body,
      signal,
    });
  } catch (err) {
    throw createApiError("백엔드 서버에 연결할 수 없습니다.", {
      cause: err,
      isNetworkError: true,
    });
  }

  let text = "";
  try {
    text = await res.text();
  } catch {
    text = "";
  }

  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    const msg =
      (data && (data.message || data.error)) || `요청 실패 (${res.status})`;

    throw createApiError(msg, {
      status: res.status,
      data,
      isNetworkError: false,
    });
  }

  return data;
}

function sleep(ms = 180) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

  if (raw >= 1024 * 1024) {
    return {
      raw,
      value: round(bytesToMb(raw), 2),
      unit: "MB/s",
    };
  }

  if (raw >= 1024) {
    return {
      raw,
      value: round(raw / 1024, 2),
      unit: "KB/s",
    };
  }

  return {
    raw,
    value: round(raw, 2),
    unit: "B/s",
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

function appendSeriesPoint(series = [], value, timestamp = Date.now(), limit = HISTORY_LIMIT) {
  const safeValue = round(value, 2);
  const next = Array.isArray(series) ? [...series] : [];

  const last = next[next.length - 1];

  if (last && Number(last.t) === Number(timestamp)) {
    return next;
  }

  next.push({
    t: timestamp,
    v: safeValue,
  });

  if (next.length > limit) {
    return next.slice(next.length - limit);
  }

  return next;
}

function makeInitialSeries(value) {
  return [
    {
      t: Date.now(),
      v: round(value, 2),
    },
  ];
}

function avgSeries(series = []) {
  if (!series.length) return 0;
  return round(
    series.reduce((sum, item) => sum + clampNumber(item.v, 0), 0) / series.length,
    2
  );
}

function buildSummary(metrics) {
  return {
    cpuAvg: avgSeries(metrics.cpu),
    memoryAvg: avgSeries(metrics.memory),
    diskAvg: avgSeries(metrics.disk),
    networkAvg: avgSeries(metrics.network),
  };
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
      cpu: makeInitialSeries(cpu.value),
      memory: makeInitialSeries(memory.value),
      disk: makeInitialSeries(disk.value),
      network: makeInitialSeries(network.value),
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
      cpu: makeInitialSeries(cpu.value),
      memory: makeInitialSeries(memory.value),
      disk: makeInitialSeries(disk.value),
      network: makeInitialSeries(network.value),
    },
    current: {
      cpu: cpu.value,
      memory: memory.value,
      disk: disk.value,
      network: network.value,
    },
    units: {
      cpu: cpu.unit,
      memory: memory.unit,
      disk: disk.unit,
      network: network.unit,
    },
    lastUpdate: new Date().toISOString(),
  };

  return {
    ...normalized,
    summary: buildSummary(normalized.metrics),
  };
}

function mockWave(base, tick, amplitude, min = 0, max = 100) {
  const noise = (Math.random() - 0.5) * amplitude * 0.55;
  const swing = Math.sin(tick / 2.8) * amplitude;
  return Math.max(min, Math.min(max, base + swing + noise));
}

function getMockHostPayload() {
  mockRuntime.hostTick += 1;

  const cpu = mockWave(26, mockRuntime.hostTick, 8, 6, 92);
  const memoryPercent = mockWave(58, mockRuntime.hostTick + 4, 6, 20, 95);
  const diskPercent = mockWave(44, mockRuntime.hostTick + 9, 4, 15, 88);
  const networkKb = mockWave(280, mockRuntime.hostTick + 3, 180, 30, 2200);

  return {
    result: {
      status: cpu >= 85 ? "WARNING" : "HEALTHY",
      cpuUsage: cpu,
      memoryUsage: memoryPercent,
      diskUsage: diskPercent,
      networkTraffic: networkKb * 1024,
    },
  };
}

function getMockContainerList(companyId) {
  const base = [
    { id: "frontend", bias: 18 },
    { id: "backend", bias: 34 },
    { id: "db", bias: 23 },
    { id: "redis", bias: 14 },
    { id: "nginx", bias: 11 },
  ];

  return {
    containers: base.map((item, idx) => {
      const tick = (mockRuntime.hostTick || 1) + idx * 2;
      const cpu = mockWave(item.bias, tick, 18, 0, 100);

      let status = "RUNNING";
      if (cpu >= 82) status = "WARNING";
      if (companyId === "mock-down-company" && item.id === "backend") {
        status = "DANGER";
      }

      mockRuntime.containerStatus[item.id] = status;

      return {
        containerId: item.id,
        status,
      };
    }),
  };
}

function getMockContainerMetricPayload(containerId) {
  const nextTick = (mockRuntime.containerTick[containerId] || 0) + 1;
  mockRuntime.containerTick[containerId] = nextTick;

  const profileMap = {
    frontend: { cpu: 14, mem: 220, disk: 28, net: 120 },
    backend: { cpu: 38, mem: 420, disk: 36, net: 320 },
    db: { cpu: 24, mem: 680, disk: 52, net: 210 },
    redis: { cpu: 16, mem: 180, disk: 18, net: 140 },
    nginx: { cpu: 12, mem: 120, disk: 20, net: 170 },
  };

  const profile = profileMap[containerId] || {
    cpu: 20,
    mem: 256,
    disk: 30,
    net: 160,
  };

  const cpu = mockWave(profile.cpu, nextTick, 13, 0, 100);
  const memoryMb = mockWave(profile.mem, nextTick + 1, profile.mem * 0.08, 40, 4096);
  const disk = mockWave(profile.disk, nextTick + 4, 4.5, 1, 100);
  const networkKb = mockWave(profile.net, nextTick + 2, profile.net * 0.2, 8, 4096);

  const status = cpu >= 85 ? "WARNING" : "RUNNING";

  return {
    results: {
      status,
      cpuUsage: cpu,
      memoryUsage: memoryMb * 1024 * 1024,
      diskUsage: disk,
      networkTraffic: networkKb * 1024,
    },
  };
}

function buildMockAgentDestination(companyId) {
  return {
    apiKey: `mock-monitor-${companyId}`,
    collectorUrl: "http://localhost:4318",
  };
}

function buildMockLogs(companyId, limit = 100) {
  const sources = ["frontend", "backend", "db", "redis", "nginx"];
  const severities = ["INFO", "INFO", "INFO", "WARN", "ERROR"];

  const rows = Array.from({ length: Math.min(limit, 100) }).map((_, idx) => {
    const severity = severities[idx % severities.length];
    const sourceName = sources[idx % sources.length];
    const sourceType = sourceName === "db" ? "host" : "container";
    const ts = new Date(Date.now() - idx * 1000 * 60 * 7).toISOString();

    let body = "정상 동작 중입니다.";
    let interpretation = null;

    if (severity === "WARN") {
      body = `${sourceName} 컨테이너의 메모리 사용량이 평소보다 높습니다.`;
      interpretation = {
        title: "메모리 사용량 증가",
        detail: "최근 수집 구간에서 메모리 사용량이 기준선보다 높게 유지되고 있습니다.",
        action: "불필요한 프로세스, 누수 가능성, 캐시 증가 여부를 확인하세요.",
        risk: "warn",
      };
    }

    if (severity === "ERROR") {
      body = `${sourceName} 컨테이너에서 일시적인 오류가 감지되었습니다.`;
      interpretation = {
        title: "오류 이벤트 감지",
        detail: "컨테이너 응답 실패 또는 내부 예외 로그가 감지되었습니다.",
        action: "직전 배포 이력과 에러 로그 원문을 함께 확인하세요.",
        risk: "danger",
      };
    }

    return {
      id: `${companyId}-${sourceName}-${idx + 1}`,
      timestamp: ts,
      severity,
      sourceType,
      sourceName,
      body,
      interpretation,
    };
  });

  return {
    results: rows,
  };
}

export function mergeHostSnapshot(prevHostData, nextHostData) {
  if (!prevHostData) return nextHostData;

  const timestamp = Date.now();

  return {
    ...nextHostData,
    hostMetrics: {
      cpu: appendSeriesPoint(
        prevHostData?.hostMetrics?.cpu,
        nextHostData?.host?.cpuUsage,
        timestamp
      ),
      memory: appendSeriesPoint(
        prevHostData?.hostMetrics?.memory,
        nextHostData?.host?.memoryUsage,
        timestamp
      ),
      disk: appendSeriesPoint(
        prevHostData?.hostMetrics?.disk,
        nextHostData?.host?.diskUsage,
        timestamp
      ),
      network: appendSeriesPoint(
        prevHostData?.hostMetrics?.network,
        nextHostData?.host?.networkTraffic,
        timestamp
      ),
    },
  };
}

export function mergeContainerMetricsSnapshot(prevMetrics, nextMetrics) {
  if (!prevMetrics) return nextMetrics;

  const timestamp = Date.now();

  const merged = {
    ...nextMetrics,
    metrics: {
      cpu: appendSeriesPoint(
        prevMetrics?.metrics?.cpu,
        nextMetrics?.current?.cpu,
        timestamp
      ),
      memory: appendSeriesPoint(
        prevMetrics?.metrics?.memory,
        nextMetrics?.current?.memory,
        timestamp
      ),
      disk: appendSeriesPoint(
        prevMetrics?.metrics?.disk,
        nextMetrics?.current?.disk,
        timestamp
      ),
      network: appendSeriesPoint(
        prevMetrics?.metrics?.network,
        nextMetrics?.current?.network,
        timestamp
      ),
    },
  };

  return {
    ...merged,
    summary: buildSummary(merged.metrics),
  };
}

export async function loginCompany({ email, password }, { signal } = {}) {
  return withMockFallback(
    async () => {
      const data = await fetchJson(`${API_BASE_URL}/company/login`, {
        method: "POST",
        body: JSON.stringify({ email, password }),
        signal,
      });

      const id = data?.id;
      const name = data?.name;

      if (!id) {
        throw createApiError("로그인 응답에서 id를 찾지 못했습니다.");
      }

      return {
        id,
        name: name || "",
        email,
      };
    },
    async () => {
      await sleep();
      return {
        id: 9999,
        name: "Mock Company",
        email,
      };
    }
  );
}

export async function registerCompany(
  { name, email, password, ip, phone },
  { signal } = {}
) {
  return withMockFallback(
    async () => {
      return fetchJson(`${API_BASE_URL}/company/register`, {
        method: "POST",
        body: JSON.stringify({ name, email, password, ip, phone }),
        signal,
      });
    },
    async () => {
      await sleep();
      return {
        success: true,
        id: Date.now(),
        name,
        email,
        ip,
      };
    }
  );
}

export async function getAgentDestination(companyId, { signal } = {}) {
  return withMockFallback(
    async () => {
      const data = await fetchJson(`${API_BASE_URL}/agent/${companyId}`, {
        signal,
      });

      return data?.result || null;
    },
    async () => {
      await sleep(120);
      return buildMockAgentDestination(companyId);
    }
  );
}

export async function getHostOverview(companyId, { signal } = {}) {
  return withMockFallback(
    async () => {
      const data = await fetchJson(`${API_BASE_URL}/dashboard/${companyId}/host`, {
        signal,
      });

      return normalizeHostResponse(data, companyId);
    },
    async () => {
      await sleep(140);
      return normalizeHostResponse(getMockHostPayload(), companyId);
    }
  );
}

export async function getContainers(companyId, { signal } = {}) {
  return withMockFallback(
    async () => {
      const data = await fetchJson(`${API_BASE_URL}/dashboard/container/${companyId}`, {
        signal,
      });

      return normalizeContainersResponse(data);
    },
    async () => {
      await sleep(140);
      return normalizeContainersResponse(getMockContainerList(companyId));
    }
  );
}

export async function getContainerMetrics(
  companyId,
  containerId,
  range = "live",
  { signal } = {}
) {
  return withMockFallback(
    async () => {
      const qs = new URLSearchParams({ period: String(range) }).toString();
      const data = await fetchJson(
        `${API_BASE_URL}/dashboard/${companyId}/${encodeURIComponent(containerId)}?${qs}`,
        { signal }
      );

      return normalizeContainerMetricsResponse(data);
    },
    async () => {
      await sleep(120);
      return normalizeContainerMetricsResponse(getMockContainerMetricPayload(containerId));
    }
  );
}

export async function getLogs(
  companyId,
  { limit = 100, query, demo, signal } = {}
) {
  return withMockFallback(
    async () => {
      const qs = new URLSearchParams();
      qs.set("limit", String(limit));
      if (query) qs.set("query", String(query));
      if (demo !== undefined) qs.set("demo", String(demo));

      return fetchJson(`${API_BASE_URL}/dashboard/${companyId}/logs?${qs.toString()}`, {
        signal,
      });
    },
    async () => {
      await sleep(120);
      return buildMockLogs(companyId, limit);
    }
  );
}