function mulberry32(seed) {
  let t = seed;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260217);

const LEVELS = ["ERROR", "WARN", "INFO"];
const CONTAINERS = ["container-1", "container-2", "container-3", "nginx", "api", "worker"];

const ERROR_MESSAGES = [
  "CPU usage exceeded limit of 80%, current usage at 85%.",
  "Unexpected container restart detected.",
  "Disk space critically low. Cleanup required.",
  "Database connection timeout occurred.",
  "OOMKill detected in container.",
  "HTTP 5xx spike detected (upstream error).",
];

const WARN_MESSAGES = [
  "High memory usage detected, reaching 90% of limit.",
  "Response latency increased above baseline.",
  "Retry count increased; possible upstream instability.",
  "TCP TIME_WAIT increased; check connection reuse.",
  "Disk I/O saturated; consider throttling background jobs.",
];

const INFO_MESSAGES = [
  "Health check passed.",
  "Deployment completed successfully.",
  "Autoscaler adjusted replicas.",
  "Scheduled job executed.",
  "Configuration reloaded.",
];

function pick(arr) {
  return arr[Math.floor(rand() * arr.length)];
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatTs(date) {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const mm = pad2(date.getMinutes());
  const ss = pad2(date.getSeconds());
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

function minutesAgoDate(minsAgo) {
  const now = new Date();
  return new Date(now.getTime() - minsAgo * 60 * 1000);
}

function buildDataset() {
  const rows = [];
  const total = 1258;

  for (let i = 0; i < total; i++) {
    const r = rand();
    let level = "INFO";
    if (r < 0.08) level = "ERROR";
    else if (r < 0.25) level = "WARN";

    const container = pick(CONTAINERS);

    // 최근 24시간~7일 사이 섞어서 만들어 둠
    const minsAgo =
      Math.floor(rand() * (7 * 24 * 60)) + Math.floor(rand() * 120);

    const tsDate = minutesAgoDate(minsAgo);

    let message = "";
    if (level === "ERROR") message = pick(ERROR_MESSAGES);
    if (level === "WARN") message = pick(WARN_MESSAGES);
    if (level === "INFO") message = pick(INFO_MESSAGES);

    const tag =
      level === "ERROR"
        ? pick(["원인 추적", "동작 분석", "CPU 병목", "롤백 필요"])
        : level === "WARN"
          ? pick(["성능 경고", "임계 근접", "재시도 증가"])
          : pick(["정상", "상태 변경", "이벤트"]);

    rows.push({
      id: `log-${i + 1}`,
      level,
      container,
      ts: tsDate.getTime(),
      tsText: formatTs(tsDate),
      message,
      tag,
      host: "host-01",
      ip: "10.0.12.34",
      service: container.includes("nginx") ? "web" : "backend",
      detail: {
        summary: message,
        occurredAt: formatTs(tsDate),
        container,
        relatedMetric:
          level === "ERROR"
            ? "CPU limit 초과"
            : level === "WARN"
              ? "메모리 사용률 증가"
              : "Health Check",
        suggestion:
          level === "ERROR"
            ? "리소스 스파이크 원인을 확인하고, 배포/트래픽/크론 작업 여부를 점검하세요."
            : level === "WARN"
              ? "임계치 근접 상태입니다. 트래픽 변화와 리소스 추이를 함께 확인하세요."
              : "정상 상태입니다.",
      },
    });
  }

  // 최신 로그가 위로 오게 정렬
  rows.sort((a, b) => b.ts - a.ts);
  return rows;
}

const DATASET = buildDataset();

function timeRangeToMs(rangeKey) {
  if (rangeKey === "1h") return 1 * 60 * 60 * 1000;
  if (rangeKey === "6h") return 6 * 60 * 60 * 1000;
  if (rangeKey === "24h") return 24 * 60 * 60 * 1000;
  if (rangeKey === "7d") return 7 * 24 * 60 * 60 * 1000;
  return 24 * 60 * 60 * 1000;
}

function includesIgnoreCase(haystack, needle) {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

export function getLogFilterOptions() {
  return {
    containers: ["all", ...Array.from(new Set(DATASET.map((d) => d.container)))],
    levels: ["all", ...LEVELS],
    timeRanges: [
      { key: "1h", label: "최근 1시간" },
      { key: "6h", label: "최근 6시간" },
      { key: "24h", label: "최근 24시간" },
      { key: "7d", label: "최근 7일" },
    ],
  };
}

export async function fetchLogs({
  timeRange = "24h",
  container = "all",
  level = "all",
  q = "",
  page = 1,
  pageSize = 20,
}) {
  // 프론트에서 “조회” 느낌 주려고 딜레이 살짝
  await new Promise((r) => setTimeout(r, 180));

  const now = Date.now();
  const windowMs = timeRangeToMs(timeRange);
  const minTs = now - windowMs;

  let filtered = DATASET.filter((row) => row.ts >= minTs);

  if (container !== "all") {
    filtered = filtered.filter((row) => row.container === container);
  }
  if (level !== "all") {
    filtered = filtered.filter((row) => row.level === level);
  }
  if (q.trim()) {
    filtered = filtered.filter(
      (row) =>
        includesIgnoreCase(row.message, q) ||
        includesIgnoreCase(row.container, q) ||
        includesIgnoreCase(row.level, q) ||
        includesIgnoreCase(row.tag, q)
    );
  }

  const counts = filtered.reduce(
    (acc, row) => {
      acc.total += 1;
      acc[row.level] += 1;
      return acc;
    },
    { total: 0, ERROR: 0, WARN: 0, INFO: 0 }
  );

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize;
  const end = start + pageSize;

  const items = filtered.slice(start, end);

  return {
    items,
    total,
    totalPages,
    page: safePage,
    pageSize,
    counts,
  };
}
