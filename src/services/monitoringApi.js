const DEFAULT_BASE_URL = "http://capstone-elb-2051343563.ap-northeast-2.elb.amazonaws.com:8080/api";
export const API_BASE_URL =
  (import.meta?.env?.VITE_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");

const USE_MOCK = import.meta?.env?.VITE_USE_MOCK === "true";
const ENABLE_FALLBACK =
  import.meta?.env?.VITE_ENABLE_API_FALLBACK !== "false";

const SESSION_KEY = "monittoring_session";

function getStoredAuthToken() {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    const session = raw ? JSON.parse(raw) : null;
    return session?.token || session?.accessToken || session?.jwt || "";
  } catch {
    return "";
  }
}

function buildAuthHeaders(headers = {}) {
  const token = getStoredAuthToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(headers || {}),
  };
}

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

function getAuthHeaders() {
  const token = getStoredAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchJson(url, { method = "GET", headers, body, signal, auth = true } = {}) {
  let res;

  try {
    res = await fetch(url, {
      method,
      headers: buildAuthHeaders(headers),
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
  const metrics = payload?.result || payload?.results || payload || {};

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


function toDateKey(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function normalizeMetricStats(stats = {}) {
  return {
    avg: round(stats.avg, 2),
    min: round(stats.min, 2),
    max: round(stats.max, 2),
    latest: round(stats.latest, 2),
  };
}

function normalizeMonthlyMetricsResponse(payload = {}) {
  const raw = payload?.result || payload || {};
  const days = Array.isArray(raw.days) ? raw.days : [];

  return {
    year: raw.year,
    month: raw.month,
    startDate: raw.startDate,
    endDate: raw.endDate,
    days: days.map((day) => ({
      date: day.date,
      hasData: !!day.hasData,
      worstStatus: mapBackendStatus(day.worstStatus),
      rawWorstStatus: day.worstStatus || "UNKNOWN",
      alertCount: clampNumber(day.alertCount, 0),
      host: day.host
        ? {
            cpu: normalizeMetricStats(day.host.cpu),
            memory: normalizeMetricStats(day.host.memory),
            disk: normalizeMetricStats(day.host.disk),
            network: normalizeMetricStats(day.host.network),
          }
        : null,
      containers: Array.isArray(day.containers)
        ? day.containers.map((container) => ({
            containerId: container.containerId,
            status: mapBackendStatus(container.status),
            rawStatus: container.status || "UNKNOWN",
            cpu: normalizeMetricStats(container.cpu),
            memory: normalizeMetricStats(container.memory),
            network: normalizeMetricStats(container.network),
          }))
        : [],
    })),
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


function buildMockMonthlyMetricsPayload(year, month) {
  const now = new Date();
  const safeYear = Number(year) || now.getFullYear();
  const safeMonth = Number(month) || now.getMonth() + 1;
  const lastDay = new Date(safeYear, safeMonth, 0).getDate();

  const days = Array.from({ length: lastDay }).map((_, index) => {
    const day = index + 1;
    const date = `${safeYear}-${String(safeMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const seed = index + safeMonth * 3;
    const cpuAvg = round(24 + Math.sin(seed / 2) * 7 + (index % 5), 2);
    const memoryAvg = round(50 + Math.cos(seed / 3) * 9, 2);
    const diskAvg = round(41 + (index % 7) * 1.4, 2);
    const networkAvg = round(180 + Math.sin(seed / 4) * 80, 2);
    const alertCount = cpuAvg >= 32 || day % 9 === 0 ? 1 : 0;

    return {
      date,
      hasData: true,
      worstStatus: alertCount ? "WARNING" : "HEALTHY",
      alertCount,
      host: {
        cpu: { avg: cpuAvg, min: Math.max(0, cpuAvg - 8), max: cpuAvg + 12, latest: cpuAvg + 2 },
        memory: { avg: memoryAvg, min: Math.max(0, memoryAvg - 5), max: memoryAvg + 7, latest: memoryAvg + 1 },
        disk: { avg: diskAvg, min: Math.max(0, diskAvg - 2), max: diskAvg + 3, latest: diskAvg },
        network: { avg: networkAvg, min: Math.max(0, networkAvg - 80), max: networkAvg + 120, latest: networkAvg + 18 },
      },
      containers: ["frontend", "backend", "db"].map((name, idx) => ({
        containerId: name,
        status: idx === 1 && alertCount ? "WARNING" : "RUNNING",
        cpu: { avg: round(cpuAvg / (idx + 1.5), 2), min: 2, max: round(cpuAvg + idx * 4, 2), latest: round(cpuAvg / (idx + 1.2), 2) },
        memory: { avg: round(memoryAvg / (idx + 1.4), 2), min: 8, max: round(memoryAvg + idx * 5, 2), latest: round(memoryAvg / (idx + 1.2), 2) },
        network: { avg: round(networkAvg / (idx + 1.8), 2), min: 0, max: round(networkAvg + idx * 30, 2), latest: round(networkAvg / (idx + 1.5), 2) },
      })),
    };
  });

  return { result: { year: safeYear, month: safeMonth, days } };
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
        auth: false,
      });

      const payload = data?.result || data?.data || data || {};
      const id = payload.id || payload.companyId || payload.company_id;
      const name = payload.name || payload.companyName || payload.company_name;
      const monitoringId =
        payload.monitoringId || payload.monitoring_id || payload.monitoringID || "";
      const token = payload.token || payload.accessToken || payload.access_token || payload.jwt || "";

      if (!id) {
        throw createApiError("로그인 응답에서 id를 찾지 못했습니다.");
      }

      return {
        id,
        companyId: id,
        name: name || "",
        email,
        monitoringId,
        token,
      };
    },
    async () => {
      await sleep();
      return {
        id: 9999,
        companyId: 9999,
        name: "Mock Company",
        email,
        monitoringId: "mock-monitoring-id",
        token: "",
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
        auth: false,
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
      const data = await fetchJson(`${API_BASE_URL}/company/agent/${companyId}`, {
        signal,
      });

      const raw = data?.result || data || null;
      if (!raw) return null;
      return {
        apiKey: raw.monitoringId || raw.apiKey || "",
        collectorUrl: raw.collector_url || raw.collectorUrl || "",
      };
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
      const data = await fetchJson(
        `${API_BASE_URL}/dashboard/${companyId}/container/${encodeURIComponent(containerId)}/metrics`,
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


export async function getMonthlyMetrics(
  companyId,
  { year, month, startDate, endDate, signal } = {}
) {
  return withMockFallback(
    async () => {
      const qs = new URLSearchParams();
      if (year) qs.set("year", String(year));
      if (month) qs.set("month", String(month));
      if (startDate) qs.set("startDate", String(startDate));
      if (endDate) qs.set("endDate", String(endDate));

      const query = qs.toString();
      const data = await fetchJson(
        `${API_BASE_URL}/dashboard/${companyId}/metrics/monthly${query ? `?${query}` : ""}`,
        { signal }
      );

      return normalizeMonthlyMetricsResponse(data);
    },
    async () => {
      await sleep(140);
      const base = startDate ? new Date(startDate) : new Date();
      return normalizeMonthlyMetricsResponse(
        buildMockMonthlyMetricsPayload(year || base.getFullYear(), month || base.getMonth() + 1)
      );
    }
  );
}

export async function getAlertRules(companyId, { hostName, signal } = {}) {
  const qs = new URLSearchParams();
  if (hostName) qs.set("hostName", String(hostName));
  const query = qs.toString();
  return fetchJson(`${API_BASE_URL}/rules/${companyId}${query ? `?${query}` : ""}`, { signal });
}

export async function updateAlertRules(request, { signal } = {}) {
  return fetchJson(`${API_BASE_URL}/rules/update`, {
    method: "POST",
    body: JSON.stringify(request),
    signal,
  });
}


export async function getServers(companyId, { signal } = {}) {
  return withMockFallback(
    async () => {
      const data = await fetchJson(`${API_BASE_URL}/servers/${companyId}`, { signal });
      if (Array.isArray(data)) return data;
      if (Array.isArray(data?.result)) return data.result;
      if (Array.isArray(data?.servers)) return data.servers;
      return [];
    },
    async () => {
      await sleep(120);
      return [];
    }
  );
}

export async function askChatbot(monitoringId, question, { signal } = {}) {
  return fetchJson(`${API_BASE_URL}/chat/ask`, {
    method: "POST",
    body: JSON.stringify({ monitoringId, question }),
    signal,
  });
}

export async function getChatHistory(monitoringId, { signal } = {}) {
  const data = await fetchJson(`${API_BASE_URL}/chat/history/${encodeURIComponent(monitoringId)}`, {
    signal,
  });
  return Array.isArray(data) ? data : [];
}

export async function analyzeLog(logContent, { signal } = {}) {
  return fetchJson(`${API_BASE_URL}/dashboard/logs/analyze`, {
    method: "POST",
    body: JSON.stringify({ logContent }),
    signal,
  });
}

export async function getUserUsage(companyId, { signal } = {}) {
  return withMockFallback(
    async () => {
      const data = await fetchJson(`${API_BASE_URL}/dashboard/${companyId}/users`, { signal });
      return Array.isArray(data) ? data : [];
    },
    async () => {
      await sleep(120);
      return [
        { username: "ubuntu", cpuUsage: 12.5, memoryBytes: 256 * 1024 * 1024 },
        { username: "root", cpuUsage: 3.2, memoryBytes: 64 * 1024 * 1024 },
      ];
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
      if (query) qs.set("keyword", String(query));
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