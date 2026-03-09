// src/services/logApi.js
// ✅ 백엔드(/api/monitoring/logs) 연동 + 프론트 UI용 가공(필터/검색/페이징)

import { getLogs } from "../api/monitoringApi";

const LEVELS = ["ERROR", "WARN", "INFO"];

function includesIgnoreCase(haystack, needle) {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function timeRangeToMs(rangeKey) {
  if (rangeKey === "1h") return 1 * 60 * 60 * 1000;
  if (rangeKey === "6h") return 6 * 60 * 60 * 1000;
  if (rangeKey === "24h") return 24 * 60 * 60 * 1000;
  if (rangeKey === "7d") return 7 * 24 * 60 * 60 * 1000;
  return 24 * 60 * 60 * 1000;
}

function parseTimeToMs(tsText) {
  // 기대 포맷: "yyyy-MM-dd HH:mm:ss"
  // 실패하면 null
  if (!tsText || typeof tsText !== "string") return null;
  const normalized = tsText.replace(" ", "T");
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return null;
  return d.getTime();
}

function detectLevel(message) {
  const m = (message || "").toLowerCase();
  if (["error", "exception", "failed", "panic", "fatal", "stacktrace", "oom", "killed"].some((k) => m.includes(k))) {
    return "ERROR";
  }
  if (["warn", "warning", "retry", "timeout", "throttle", "slow"].some((k) => m.includes(k))) {
    return "WARN";
  }
  return "INFO";
}

function buildTag(level, message) {
  const m = (message || "").toLowerCase();

  if (level === "ERROR") {
    if (m.includes("oom") || m.includes("killed")) return "OOM";
    if (m.includes("timeout")) return "TIMEOUT";
    if (m.includes("5xx") || m.includes("500") || m.includes("502") || m.includes("503")) return "HTTP 5xx";
    if (m.includes("db") || m.includes("sql") || m.includes("connection")) return "DB";
    return "원인 추적";
  }

  if (level === "WARN") {
    if (m.includes("retry")) return "재시도";
    if (m.includes("latency") || m.includes("slow")) return "지연";
    if (m.includes("memory")) return "메모리";
    return "성능 경고";
  }

  return "이벤트";
}

function buildDetail({ tsText, level, container, message }) {
  const relatedMetric =
    level === "ERROR" ? "에러/예외" : level === "WARN" ? "경고/지연" : "이벤트";

  const suggestion =
    level === "ERROR"
      ? "에러 발생 시점의 배포/트래픽/리소스 변화 여부를 먼저 확인하고, 동일 패턴이 반복되는지 확인하세요."
      : level === "WARN"
        ? "임계치 근접 상태일 수 있습니다. 직전/직후의 리소스 추이와 함께 확인하세요."
        : "정상 이벤트 로그입니다.";

  return {
    summary: message,
    occurredAt: tsText,
    container,
    relatedMetric,
    suggestion,
  };
}

function normalizeLogEntry(it, idx) {
  // ✅ 백엔드가 어떤 필드를 주더라도 최대한 살려서 UI 형태로 맞춘다.
  // 1) ts/tsText가 있으면 사용
  // 2) time 같은 필드만 있어도 파싱
  // 3) 둘 다 없으면 “현재시각 - idx초”로 대체

  const message = it?.message ?? it?.log ?? it?.line ?? "";
  const tsText = it?.tsText ?? it?.time ?? it?.timestamp ?? "";

  let ts = null;

  if (typeof it?.ts === "number") ts = it.ts;
  if (!ts) ts = parseTimeToMs(tsText);
  if (!ts) ts = Date.now() - idx * 1000;

  const level = it?.level ?? detectLevel(message);
  const container = it?.container ?? it?.app ?? it?.service ?? it?.job ?? "unknown";
  const tag = it?.tag ?? buildTag(level, message);

  return {
    id: `log-${ts}-${idx}`,
    level,
    container,
    ts,
    tsText: tsText || new Date(ts).toISOString().replace("T", " ").slice(0, 19),
    message,
    tag,
    host: "-",
    ip: "-",
    service: container,
    detail: buildDetail({ tsText: tsText || "", level, container, message }),
  };
}

export function getLogFilterOptions(containers = []) {
  const unique = Array.from(new Set(containers.filter(Boolean)));
  unique.sort();

  return {
    containers: ["all", ...unique],
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
  companyId,
  limit = 500,
  timeRange = "24h",
  container = "all",
  level = "all",
  q = "",
  page = 1,
  pageSize = 20,
}) {
  if (!companyId) {
    return {
      items: [],
      total: 0,
      totalPages: 1,
      page: 1,
      pageSize,
      counts: { total: 0, ERROR: 0, WARN: 0, INFO: 0 },
      containers: [],
    };
  }

  // 1) 백엔드에서 최신 N개 가져오기
  const raw = await getLogs(companyId, { limit });
  const list = Array.isArray(raw) ? raw : [];

  // 2) 프론트에서 UI용 형태로 정규화
  const normalized = list.map((it, idx) => normalizeLogEntry(it, idx));

  // 3) 시간 필터
  const now = Date.now();
  const windowMs = timeRangeToMs(timeRange);
  const minTs = now - windowMs;

  let filtered = normalized.filter((row) => row.ts >= minTs);

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

  // 4) 카운트
  const counts = filtered.reduce(
    (acc, row) => {
      acc.total += 1;
      acc[row.level] += 1;
      return acc;
    },
    { total: 0, ERROR: 0, WARN: 0, INFO: 0 }
  );

  // 5) 페이징
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize;
  const end = start + pageSize;

  const items = filtered.slice(start, end);

  // 컨테이너 옵션은 “전체(normalized)” 기준으로 만들면 더 안정적
  const containers = Array.from(new Set(normalized.map((d) => d.container)));

  return {
    items,
    total,
    totalPages,
    page: safePage,
    pageSize,
    counts,
    containers,
  };
}