import { getLogs } from "../api/monitoringApi";

const LEVELS = ["ERROR", "WARN", "INFO"];

function includesIgnoreCase(haystack, needle) {
  return String(haystack).toLowerCase().includes(String(needle).toLowerCase());
}

function timeRangeToMs(rangeKey) {
  if (rangeKey === "all") return Number.POSITIVE_INFINITY;
  if (rangeKey === "1h") return 1 * 60 * 60 * 1000;
  if (rangeKey === "6h") return 6 * 60 * 60 * 1000;
  if (rangeKey === "24h") return 24 * 60 * 60 * 1000;
  if (rangeKey === "7d") return 7 * 24 * 60 * 60 * 1000;
  return 24 * 60 * 60 * 1000;
}

function normalizeSeverity(rawSeverity) {
  const value = String(rawSeverity || "INFO").toUpperCase();
  if (value.includes("ERROR") || value.includes("FATAL")) return "ERROR";
  if (value.includes("WARN")) return "WARN";
  return "INFO";
}

function normalizeRisk(rawRisk, severity) {
  const value = String(rawRisk || "").toLowerCase();
  if (value === "danger" || value === "error" || value === "critical") return "danger";
  if (value === "warn" || value === "warning") return "warn";
  if (value === "normal" || value === "ok" || value === "info") return "normal";

  if (severity === "ERROR") return "danger";
  if (severity === "WARN") return "warn";
  return "normal";
}

function formatTime(ms) {
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) {
    return { timeText: "-", dateText: "-" };
  }

  const timeText = date.toLocaleTimeString("ko-KR", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const dateText = date.toLocaleDateString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });

  return { timeText, dateText };
}

function parseTimestampToMs(rawTimestamp, fallbackMs) {
  const value = Number(rawTimestamp);
  if (!Number.isFinite(value) || value <= 0) return fallbackMs;

  // 16+ digits: ns, 13-15 digits: us, 11-13 digits: ms, <=10 digits: seconds
  if (value >= 1e16) return Math.floor(value / 1_000_000);
  if (value >= 1e13) return Math.floor(value / 1_000);
  if (value >= 1e11) return Math.floor(value);
  return Math.floor(value * 1_000);
}

function normalizeInterpretation(rawInterpretation, severity) {
  if (!rawInterpretation || typeof rawInterpretation !== "object") {
    return null;
  }

  const action = String(rawInterpretation.action || rawInterpretation.remedy || "");
  const detail = String(rawInterpretation.description || rawInterpretation.detail || "");
  const evidence = Array.isArray(rawInterpretation.evidence)
    ? rawInterpretation.evidence.map((it) => String(it)).join(", ")
    : String(rawInterpretation.evidence || "");

  const risk = normalizeRisk(rawInterpretation.status || rawInterpretation.risk, severity);

  return {
    title: String(rawInterpretation.title || rawInterpretation.name || "로그 해석"),
    detail,
    action,
    evidence,
    risk,
    needsAction: Boolean(action),
  };
}

function normalizeLogEntry(log, idx) {
  const fallbackTs = Date.now() - idx * 1000;
  const ts = parseTimestampToMs(log?.timestamp, fallbackTs);

  const level = normalizeSeverity(log?.severity);
  const sourceTypeRaw = String(log?.sourceType || "").toLowerCase();
  const sourceType = sourceTypeRaw === "container" ? "container" : "host";

  const source =
    String(log?.sourceName || "") ||
    String(sourceType === "container" ? log?.containerName || "" : log?.hostName || "") ||
    String(log?.containerName || log?.hostName || "Unknown");

  const body = String(log?.body || "");
  const { timeText, dateText } = formatTime(ts);
  const interpretation = normalizeInterpretation(log?.interpretation, level);

  return {
    id: log?.id || `log-${ts}-${idx}`,
    ts,
    time: timeText,
    date: dateText,
    level,
    source,
    sourceType,
    sourceLabel: sourceType === "container" ? "컨테이너" : "호스트",
    text: body,
    rawMessage: String(log?.rawMessage || ""),
    interpretation,
  };
}

export function getLogFilterOptions(containers = []) {
  const unique = Array.from(new Set(containers.filter(Boolean)));
  unique.sort();

  return {
    containers: ["all", ...unique],
    levels: ["all", ...LEVELS],
    timeRanges: [
      { key: "all", label: "전체" },
      { key: "1h", label: "1시간" },
      { key: "6h", label: "6시간" },
      { key: "24h", label: "24시간" },
      { key: "7d", label: "7일" },
    ],
  };
}

export async function fetchLogs({
  companyId,
  limit = 100,
  timeRange = "24h",
  sourceType = "all",
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

  const response = await getLogs(companyId, { limit });
  const list = Array.isArray(response?.results)
    ? response.results
    : Array.isArray(response?.containers)
      ? response.containers
      : [];

  const normalized = list
    .map((it, idx) => normalizeLogEntry(it, idx))
    .sort((a, b) => b.ts - a.ts);

  const now = Date.now();
  const windowMs = timeRangeToMs(timeRange);
  const minTs = Number.isFinite(windowMs) ? now - windowMs : Number.NEGATIVE_INFINITY;

  let filtered = normalized.filter((row) => Number.isFinite(row.ts) && row.ts >= minTs);

  if (sourceType !== "all") {
    filtered = filtered.filter((row) => row.sourceType === sourceType);
  }
  if (level !== "all") {
    filtered = filtered.filter((row) => row.level === level);
  }
  if (q.trim()) {
    filtered = filtered.filter(
      (row) =>
        includesIgnoreCase(row.text, q) ||
        includesIgnoreCase(row.source, q) ||
        includesIgnoreCase(row.level, q) ||
        includesIgnoreCase(row.interpretation?.title || "", q) ||
        includesIgnoreCase(row.interpretation?.detail || "", q)
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
  const containers = Array.from(new Set(normalized.map((d) => d.source))).sort();

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
