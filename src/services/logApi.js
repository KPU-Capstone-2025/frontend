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

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sanitizeLogText(rawText, source) {
  let text = String(rawText ?? "").trim();

  // ISO-like timestamp prefix
  text = text.replace(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?\s+/, "");
  // Syslog-like timestamp prefix
  text = text.replace(/^[A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}\s+/, "");

  if (source && source !== "Unknown") {
    const sourcePattern = new RegExp(`^(?:${escapeRegExp(source)}|\\[${escapeRegExp(source)}\\])[:\\s-]*`, "i");
    text = text.replace(sourcePattern, "");
  }

  return text.trim() || String(rawText ?? "");
}

function parseMessagePayload(rawMessage) {
  const fallbackText = typeof rawMessage === "string" ? rawMessage : String(rawMessage ?? "");

  let text = fallbackText;
  let level = "INFO";
  let source = "Unknown";
  let sourceType = "host";

  try {
    const parsed = JSON.parse(fallbackText);
    if (parsed && typeof parsed === "object") {
      text = parsed.body ? String(parsed.body) : fallbackText;
      level = normalizeSeverity(parsed.severity || parsed.severity_text || parsed.severityText);

      const attributes = parsed.attributes && typeof parsed.attributes === "object" ? parsed.attributes : {};
      const resources = parsed.resources && typeof parsed.resources === "object" ? parsed.resources : {};

      if (attributes["container.name"]) {
        source = String(attributes["container.name"]);
        sourceType = "container";
      } else if (resources["host.name"]) {
        source = String(resources["host.name"]);
        sourceType = "host";
      }
    }
  } catch {
    // message가 일반 텍스트인 경우는 그대로 사용한다.
  }

  return { text, level, source, sourceType };
}

function inferInterpretation(text, level, sourceType) {
  const normalized = String(text || "").toLowerCase();

  function findEvidence(matchers) {
    for (const matcher of matchers) {
      if (matcher.pattern.test(normalized)) {
        return matcher.label;
      }
    }
    return "";
  }

  const timeoutMatched = findEvidence([
    { pattern: /\btimeout\b/, label: "timeout" },
    { pattern: /\btimed out\b/, label: "timed out" },
    { pattern: /\blatency\b/, label: "latency" },
    { pattern: /\bslow\b/, label: "slow" },
    { pattern: /연결\s*지연/, label: "연결 지연" },
  ]);
  if (timeoutMatched) {
    return {
      title: "응답 지연",
      detail: "네트워크 또는 외부 서비스 응답 시간이 증가한 상태로 보입니다.",
      risk: level === "ERROR" ? "danger" : "warn",
      evidence: timeoutMatched,
      remedy: "최근 배포/트래픽 증가 여부를 확인하고, 외부 API 지연 구간을 추적하세요.",
      needsAction: true,
    };
  }

  const failureMatched = findEvidence([
    { pattern: /\bfailed\b/, label: "failed" },
    { pattern: /\berror\b/, label: "error" },
    { pattern: /\bexception\b/, label: "exception" },
    { pattern: /\bpanic\b/, label: "panic" },
    { pattern: /\bfatal\b/, label: "fatal" },
    { pattern: /\btraceback\b/, label: "traceback" },
  ]);
  if (failureMatched) {
    return {
      title: "실패 이벤트",
      detail: "요청 또는 작업이 실패한 로그입니다. 실패 원인 문구를 우선 확인하세요.",
      risk: "danger",
      evidence: failureMatched,
      remedy: "동일 시간대의 직전 로그를 함께 확인하고, 예외 스택/에러 코드를 기준으로 원인을 분류하세요.",
      needsAction: true,
    };
  }

  const storageMatched = findEvidence([
    { pattern: /\bdisk\b/, label: "disk" },
    { pattern: /\bstorage\b/, label: "storage" },
    { pattern: /\bno\s+space\b/, label: "no space" },
    { pattern: /\bfull\b/, label: "full" },
    { pattern: /\bi\/o\b/, label: "i/o" },
  ]);
  if (storageMatched) {
    return {
      title: "스토리지 이슈",
      detail: "디스크 용량 또는 입출력 관련 경고/오류 가능성이 있습니다.",
      risk: level === "ERROR" ? "danger" : "warn",
      evidence: storageMatched,
      remedy: "디스크 사용량 및 inode 상태를 점검하고, 불필요한 로그/임시 파일 정리를 우선 수행하세요.",
      needsAction: true,
    };
  }

  const resourceMatched = findEvidence([
    { pattern: /\bcpu\b/, label: "cpu" },
    { pattern: /\bmemory\b/, label: "memory" },
    { pattern: /\boom\b/, label: "oom" },
    { pattern: /\bkilled\b/, label: "killed" },
    { pattern: /\bresource\b/, label: "resource" },
    { pattern: /\bthrottle\b/, label: "throttle" },
  ]);
  if (resourceMatched) {
    return {
      title: "리소스 압박",
      detail: "CPU/메모리 사용량 증가 또는 리소스 제한 영향 가능성이 큽니다.",
      risk: level === "ERROR" ? "danger" : "warn",
      evidence: resourceMatched,
      remedy: "자원 사용 상위 프로세스를 확인하고 필요 시 오토스케일/리소스 제한값 조정을 검토하세요.",
      needsAction: true,
    };
  }

  const scheduleMatched = findEvidence([
    { pattern: /\bcron\b/, label: "cron" },
    { pattern: /\bscheduled\b/, label: "scheduled" },
    { pattern: /\bjob\b/, label: "job" },
    { pattern: /\bbatch\b/, label: "batch" },
  ]);
  if (scheduleMatched) {
    return {
      title: "정상 스케줄 이벤트",
      detail: "정기 실행 작업에서 발생한 일반 로그로 보이며, 별도 조치가 필요하지 않습니다.",
      risk: "normal",
      evidence: scheduleMatched,
      remedy: "",
      needsAction: false,
    };
  }

  const defaultRisk = level === "ERROR" ? "danger" : level === "WARN" ? "warn" : "normal";

  return {
    title: defaultRisk === "normal" ? "정상 이벤트" : sourceType === "container" ? "컨테이너 이벤트" : "호스트 이벤트",
    detail:
      defaultRisk === "normal"
        ? "문제가 감지되지 않은 일반 로그입니다."
        : "이상 징후 가능성이 있어 추가 확인이 필요합니다.",
    risk: defaultRisk,
    evidence: "pattern-default",
    remedy: defaultRisk === "normal" ? "" : "관련 메트릭(CPU/메모리/네트워크)과 같은 시간대 로그를 함께 비교해 원인을 좁혀보세요.",
    needsAction: defaultRisk !== "normal",
  };
}

function normalizeLogEntry(log, idx) {
  const tsMs = Math.floor(Number(log?.timestamp) / 1_000_000);
  const ts = Number.isFinite(tsMs) && tsMs > 0 ? tsMs : Date.now() - idx * 1000;

  const parsed = parseMessagePayload(log?.message ?? "");
  const labels = log?.labels && typeof log.labels === "object" ? log.labels : {};
  const fallbackContainer = labels["container.name"] || labels.job || labels.container;
  const fallbackHost = labels["host.name"] || labels.host;
  const fallbackSource = fallbackContainer || fallbackHost || "Unknown";
  const source = parsed.source !== "Unknown" ? parsed.source : fallbackSource;
  const sourceType = parsed.source !== "Unknown"
    ? parsed.sourceType
    : fallbackContainer
      ? "container"
      : "host";
  const cleanText = sanitizeLogText(parsed.text, source);
  const { timeText, dateText } = formatTime(ts);
  const interpretation = inferInterpretation(cleanText, parsed.level, sourceType);

  return {
    id: log?.id || `log-${ts}-${idx}`,
    ts,
    time: timeText,
    date: dateText,
    level: parsed.level,
    source,
    sourceType,
    sourceLabel: sourceType === "container" ? "컨테이너" : "호스트",
    text: cleanText,
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
        includesIgnoreCase(row.sourceLabel, q) ||
        includesIgnoreCase(row.level, q) ||
        includesIgnoreCase(row.interpretation?.title || "", q)
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