import { useEffect, useId, useMemo, useRef, useState } from "react";
import "./dashboard.css";
import { getContainerMetrics, getContainers, getDailyAlertSummary, getHostOverview, getMonthlyMetrics } from "../../services/monitoringApi.js";
import { getStoredSession } from "../../services/authStorage.js";

/**
 * [수정사항]
 * 1. 백엔드 MonitoringModule의 API 엔드포인트(/api/dashboard/{id}/host 등)와 데이터 매핑
 * 2. 네트워크 트래픽 단위를 KB/s로 정규화
 */
const POLLING_INTERVAL = 3000;
const CPU_ALERT_THRESHOLD = 85;
const CHART_HEIGHT = 220;
const CHART_WIDTH = 520;
const MAX_DATA_POINTS = 30;
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const dashboardRuntimeStore = new Map();

function createInitialSnapshot() {
  return {
    loading: true, refreshingContainers: false, polling: false, error: "",
    hostData: null, containers: [], selectedContainerId: "",
    containerMetricsById: {}, loadingMetricsById: {},
  };
}

function getRuntime(companyId) {
  if (!dashboardRuntimeStore.has(companyId)) {
    dashboardRuntimeStore.set(companyId, { snapshot: createInitialSnapshot(), listeners: new Set(), started: false, hostTimer: null, containerTimer: null });
  }
  return dashboardRuntimeStore.get(companyId);
}

function emitRuntime(companyId) {
  const runtime = getRuntime(companyId);
  runtime.listeners.forEach((listener) => listener(runtime.snapshot));
}

function patchRuntimeSnapshot(companyId, updater) {
  const runtime = getRuntime(companyId);
  runtime.snapshot = typeof updater === "function" ? updater(runtime.snapshot) : updater;
  emitRuntime(companyId);
}

function subscribeRuntime(companyId, listener) {
  const runtime = getRuntime(companyId);
  runtime.listeners.add(listener);
  listener(runtime.snapshot);
  return () => { runtime.listeners.delete(listener); };
}

function lastOf(series = []) { return Number(series[series.length - 1]?.v ?? 0); }

function formatValue(value, unit) {
  const safe = Number.isFinite(Number(value)) ? Number(value) : 0;
  if (unit === "%") return `${safe.toFixed(1)}%`;
  if (unit === "GB" || unit === "MB" || unit === "KB/s") return `${safe.toFixed(2)} ${unit}`;
  return `${safe.toFixed(2)} ${unit || ""}`.trim();
}

function isCpuDanger(value) { return Number(value || 0) >= CPU_ALERT_THRESHOLD; }

function statusMeta(status) {
  if (status === "STABLE" || status === "RUNNING") return { label: "정상", className: "is-good" };
  if (status === "WARNING" || status === "warning") return { label: "주의", className: "is-warn" };
  return { label: "오류", className: "is-bad" };
}

function getNoiseGate(unit, sensitivity = "normal") {
  const factor = sensitivity === "high" ? 0.18 : sensitivity === "medium" ? 0.45 : 1;
  if (unit === "%") return 0.25 * factor;
  if (unit === "GB") return 0.03 * factor;
  if (unit === "MB") return 3 * factor;
  if (unit === "KB/s") return 1.5 * factor;
  return 0.1 * factor;
}

function smoothSeries(series = [], unit = "%", options = {}) {
  if (!Array.isArray(series) || series.length === 0) return [];
  const { sensitivity = "normal" } = options;
  const alpha = sensitivity === "high" ? 0.78 : 0.42;
  const gate = getNoiseGate(unit, sensitivity);
  let prev = Number(series[0]?.v || 0);

  return series.map((point, index) => {
    const current = Number(point?.v || 0);
    if (index === 0) { prev = current; return { ...point, sv: current }; }
    const delta = current - prev;
    if (Math.abs(delta) < gate && sensitivity !== "high") return { ...point, sv: prev };
    let next = prev + delta * alpha;
    prev = next;
    return { ...point, sv: Number(next.toFixed(3)) };
  });
}

function createChartGeometry(series = [], { width = CHART_WIDTH, height = CHART_HEIGHT } = {}) {
  if (!series.length) return { linePath: "", areaPath: "", points: [], min: 0, max: 100, mid: 50, labels: ["", "", ""] };
  const values = series.map((item) => Number(item?.sv ?? item?.v ?? 0));
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const span = rawMax - rawMin;
  const topPad = span === 0 ? 10 : span * 0.2;
  const min = Math.max(0, rawMin - topPad * 0.5);
  const max = rawMax + topPad;
  const mid = (min + max) / 2;
  const left = 14; const right = width - 14; const top = 12; const bottom = height - 16;
  const innerWidth = right - left; const innerHeight = bottom - top;
  const stepX = innerWidth / Math.max(series.length - 1, 1);

  const points = series.map((item, index) => {
    const value = Number(item?.sv ?? item?.v ?? 0);
    const ratio = (value - min) / (max - min || 1);
    const x = left + stepX * index;
    const y = bottom - ratio * innerHeight;
    return { x, y, value, rawValue: Number(item?.v ?? 0), t: item?.t };
  });

  const linePath = createSmoothPath(points);
  const areaPath = [linePath, `L ${points[points.length - 1]?.x ?? right} ${bottom}`, `L ${points[0]?.x ?? left} ${bottom}`, "Z"].join(" ");
  const first = points[0]; const center = points[Math.floor(points.length / 2)] || first; const last = points[points.length - 1] || first;
  const labels = [timeLabel(first?.t), timeLabel(center?.t), timeLabel(last?.t)];
  return { linePath, areaPath, points, min, max, mid, labels };
}

function monthlyStatusMeta(status) {
  if (status === "STABLE") return { label: "정상", className: "is-stable" };
  if (status === "WARNING") return { label: "주의", className: "is-warning" };
  if (status === "CRITICAL") return { label: "위험", className: "is-critical" };
  return { label: "데이터 없음", className: "is-empty" };
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function buildMonthCells(year, month, days = []) {
  const daysByDate = new Map(days.map((day) => [day.date, day]));
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  const cells = [];

  for (let i = 0; i < first.getDay(); i += 1) cells.push({ kind: "blank", key: `blank-start-${i}` });
  for (let day = 1; day <= last.getDate(); day += 1) {
    const date = new Date(year, month - 1, day);
    const dateKey = toDateKey(date);
    cells.push({ kind: "day", key: dateKey, day: daysByDate.get(dateKey) || { date: dateKey, hasData: false, worstStatus: "NO_DATA", alertCount: 0, containers: [] } });
  }
  while (cells.length % 7 !== 0) cells.push({ kind: "blank", key: `blank-end-${cells.length}` });
  return cells;
}

function formatMetricAvg(metric, unit) {
  const value = Number(metric?.avg);
  if (!Number.isFinite(value)) return "-";
  return `${value.toFixed(unit === "%" ? 1 : 2)} ${unit}`;
}

function createSmoothPath(points = []) {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  return points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const prev = points[index - 1];
    const controlX = (prev.x + point.x) / 2;
    return `${path} C ${controlX} ${prev.y}, ${controlX} ${point.y}, ${point.x} ${point.y}`;
  }, "");
}

function timeLabel(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function calcTrend(series = []) {
  if (series.length < 2) return { direction: "flat", text: "수집 중" };
  const last = Number(series[series.length - 1]?.v || 0);
  const prev = Number(series[series.length - 2]?.v ?? last);
  const diff = last - prev;
  if (Math.abs(diff) < 0.01) return { direction: "flat", text: "변화 없음" };
  return { direction: diff > 0 ? "up" : "down", text: `직전 대비 ${diff > 0 ? "+" : ""}${diff.toFixed(2)}` };
}

async function fetchHostAndContainers(companyId) {
  const [hostRes, containersRes] = await Promise.all([
    getHostOverview(companyId),
    getContainers(companyId)
  ]);

  patchRuntimeSnapshot(companyId, (prev) => {
    const now = Date.now();
    const prevHostMetrics = prev.hostData?.hostMetrics || { cpu: [], memory: [], disk: [], network: [] };
    
    const nextHostMetrics = {
      cpu: [...prevHostMetrics.cpu, { t: now, v: hostRes?.cpuUsage || 0 }].slice(-MAX_DATA_POINTS),
      memory: [...prevHostMetrics.memory, { t: now, v: hostRes?.memoryUsage || 0 }].slice(-MAX_DATA_POINTS),
      disk: [...prevHostMetrics.disk, { t: now, v: hostRes?.diskUsage || 0 }].slice(-MAX_DATA_POINTS),
      network: [...prevHostMetrics.network, { t: now, v: hostRes?.networkTraffic || 0 }].slice(-MAX_DATA_POINTS)
    };

    return {
      ...prev,
      loading: false,
      hostData: { host: hostRes, hostMetrics: nextHostMetrics, lastUpdate: now },
      containers: containersRes,
      selectedContainerId: prev.selectedContainerId,
    };
  });
}

async function fetchContainerMetricsSnapshot(companyId, containerId, { showLoading = false } = {}) {
  if (!companyId || !containerId) return;
  if (showLoading) patchRuntimeSnapshot(companyId, (prev) => ({ ...prev, loadingMetricsById: { ...prev.loadingMetricsById, [containerId]: true } }));

  try {
    const res = await getContainerMetrics(companyId, containerId);
    patchRuntimeSnapshot(companyId, (prev) => {
      const now = Date.now();
      const prevMetricsObj = prev.containerMetricsById[containerId] || { metrics: { cpu: [], memory: [], network: [] } };
      
      const nextMetrics = {
        cpu: [...prevMetricsObj.metrics.cpu, { t: now, v: res?.cpuUsage || 0 }].slice(-MAX_DATA_POINTS),
        memory: [...prevMetricsObj.metrics.memory, { t: now, v: res?.memoryUsage || 0 }].slice(-MAX_DATA_POINTS),
        network: [...prevMetricsObj.metrics.network, { t: now, v: res?.networkTraffic || 0 }].slice(-MAX_DATA_POINTS)
      };

      return {
        ...prev,
        containerMetricsById: { ...prev.containerMetricsById, [containerId]: { status: res.status, metrics: nextMetrics, lastUpdate: now } },
        loadingMetricsById: { ...prev.loadingMetricsById, [containerId]: false },
      };
    });
  } catch {
    patchRuntimeSnapshot(companyId, (prev) => ({ ...prev, loadingMetricsById: { ...prev.loadingMetricsById, [containerId]: false } }));
  }
}

function ensureHostPolling(companyId) {
  const runtime = getRuntime(companyId);
  if (runtime.hostTimer) return;
  runtime.hostTimer = setInterval(async () => {
    patchRuntimeSnapshot(companyId, (prev) => ({ ...prev, polling: true }));
    try { await fetchHostAndContainers(companyId); } 
    catch {}
    finally { patchRuntimeSnapshot(companyId, (prev) => ({ ...prev, polling: false })); }
  }, POLLING_INTERVAL);
}

function ensureContainerPolling(companyId) {
  const runtime = getRuntime(companyId);
  if (runtime.containerTimer) return;
  runtime.containerTimer = setInterval(async () => {
    const { selectedContainerId } = runtime.snapshot;
    if (selectedContainerId) await fetchContainerMetricsSnapshot(companyId, selectedContainerId);
  }, POLLING_INTERVAL);
}

async function ensureDashboardStarted(companyId) {
  const runtime = getRuntime(companyId);
  if (runtime.started) return;
  runtime.started = true;
  await fetchHostAndContainers(companyId);
  const selectedId = getRuntime(companyId).snapshot.selectedContainerId;
  if (selectedId) await fetchContainerMetricsSnapshot(companyId, selectedId, { showLoading: true });
  ensureHostPolling(companyId);
  ensureContainerPolling(companyId);
}

function MetricCard({ title, value, sub, danger = false }) {
  return (
    <div className={`unifiedMetricCard ${danger ? "is-danger" : ""}`}>
      <div className="unifiedMetricCard__title">{title}</div>
      <div className="unifiedMetricCard__value">{value}</div>
      <div className="unifiedMetricCard__sub">{sub}</div>
    </div>
  );
}

function TrendChip({ trend }) {
  return (
    <span className={`trendChip is-${trend.direction}`}>
      {trend.direction === "up" ? "▲" : trend.direction === "down" ? "▼" : "•"} {trend.text}
    </span>
  );
}

function calcStats(series = [], unit = "%") {
  if (!series.length) return null;
  const values = series.map((p) => Number(p?.v ?? 0));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const fmt = (v) => unit === "%" ? v.toFixed(1) : v.toFixed(2);
  return { min: fmt(min), avg: fmt(avg), max: fmt(max) };
}

function LiveChartCard({ title, currentValue, unit, rawSeries, danger = false, sensitivity = "normal" }) {
  const chartUid = useId();
  const [showStats, setShowStats] = useState(false);
  const smoothed = useMemo(() => smoothSeries(rawSeries, unit, { sensitivity }), [rawSeries, unit, sensitivity]);
  const geometry = useMemo(() => createChartGeometry(smoothed, { width: CHART_WIDTH, height: CHART_HEIGHT }), [smoothed]);
  const trend = useMemo(() => calcTrend(rawSeries), [rawSeries]);
  const stats = useMemo(() => calcStats(rawSeries, unit), [rawSeries, unit]);
  const displayValue = unit === "%" ? Number(currentValue || 0).toFixed(1) : Number(currentValue || 0).toFixed(2);
  const gradientId = useMemo(() => `chartArea-${chartUid.replace(/:/g, "")}`, [chartUid]);
  const lineColor = danger ? "#ee1d36" : "#146ef5";

  return (
    <div className={`liveChartCard ${danger ? "is-danger" : ""}`} style={{ "--chart-color": lineColor }}>
      <div className="liveChartCard__head">
        <div className="liveChartCard__title">{title}</div>
        <div className="liveChartCard__meta">
          <span className="liveChartCard__value">
            {displayValue}<span className="liveChartCard__unit">{unit}</span>
          </span>
          <TrendChip trend={trend} />
        </div>
      </div>

      <div className="liveChartCard__plot">
        <div className="liveChartCard__yAxis">
          <span>{geometry.max.toFixed(unit === "%" ? 0 : 1)}</span>
          <span>{geometry.mid.toFixed(unit === "%" ? 0 : 1)}</span>
          <span>{geometry.min.toFixed(unit === "%" ? 0 : 1)}</span>
        </div>

        <svg className="liveChartSvg" viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity="0.18" />
              <stop offset="100%" stopColor={lineColor} stopOpacity="0.01" />
            </linearGradient>
          </defs>
          <line className="liveChartSvg__grid" x1="14" y1="16" x2={CHART_WIDTH - 14} y2="16" />
          <line className="liveChartSvg__grid" x1="14" y1={CHART_HEIGHT / 2} x2={CHART_WIDTH - 14} y2={CHART_HEIGHT / 2} />
          <line className="liveChartSvg__grid" x1="14" y1={CHART_HEIGHT - 16} x2={CHART_WIDTH - 14} y2={CHART_HEIGHT - 16} />
          <path className="liveChartSvg__area" d={geometry.areaPath} fill={`url(#${gradientId})`} />
          <path className="liveChartSvg__line" d={geometry.linePath} />
          {geometry.points.length > 0 && (
            <circle
              cx={geometry.points[geometry.points.length - 1].x}
              cy={geometry.points[geometry.points.length - 1].y}
              r="4" className="liveChartSvg__dot"
            />
          )}
        </svg>

        <div className="liveChartCard__xAxis">
          <span>{geometry.labels[0]}</span>
          <span>{geometry.labels[1]}</span>
          <span>{geometry.labels[2]}</span>
        </div>
      </div>

      {stats ? (
        <div className="liveChartDetails">
          <button className="liveChartDetails__toggle" type="button" onClick={() => setShowStats((prev) => !prev)}>
            {showStats ? "상세정보 닫기" : "상세정보"}
          </button>
          {showStats ? (
            <div className="liveChartStats">
              {[["최소", stats.min], ["평균", stats.avg], ["최대", stats.max]].map(([label, val]) => (
                <div key={label} className="liveChartStats__item">
                  <div className="liveChartStats__label">{label}</div>
                  <div className="liveChartStats__value">{val}<span>{unit}</span></div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="liveChartCard__empty">데이터 수집 중...</div>
      )}
    </div>
  );
}

function ContainerEmptyState({ hasContainers }) {
  return (
    <div className="containerEmptyState">
      <div className="containerEmptyState__icon">+</div>
      <div>
        <div className="containerEmptyState__title">
          {hasContainers ? "컨테이너를 선택하세요" : "연결된 컨테이너가 없습니다"}
        </div>
        <p className="containerEmptyState__desc">
          {hasContainers
            ? "왼쪽 목록에서 컨테이너를 클릭하면 CPU, 메모리, 네트워크 그래프가 표시됩니다."
            : "컨테이너가 감지되면 이 영역에서 상세 리소스를 확인할 수 있습니다."}
        </p>
      </div>
    </div>
  );
}

function MonthlyMetricRow({ label, metric, unit }) {
  return (
    <div className="monthlyMetricRow">
      <span>{label}</span>
      <strong>{formatMetricAvg(metric, unit)}</strong>
    </div>
  );
}

function MonthlyCalendar({ companyId, monthDate, monthlyData, selectedDate, onSelectDate, onMoveMonth, loading, error, onAlertClick }) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth() + 1;
  const cells = useMemo(() => buildMonthCells(year, month, monthlyData?.days || []), [year, month, monthlyData]);
  const selectedDay = (monthlyData?.days || []).find((day) => day.date === selectedDate) || cells.find((cell) => cell.kind === "day" && cell.day.date === selectedDate)?.day || null;

  return (
    <section className="unifiedPanel monthlyPanel">
      <div className="monthlyPanel__head">
        <div>
          <div className="sectionEyebrow">MONTHLY VIEW</div>
          <h3 className="sectionTitle">월간 일별 리소스</h3>
        </div>
        <div className="monthControls">
          <button type="button" onClick={() => onMoveMonth(-1)}>이전달</button>
          <strong>{year}년 {month}월</strong>
          <button type="button" onClick={() => onMoveMonth(1)}>다음달</button>
        </div>
      </div>

      {error ? <div className="monthlyError">{error}</div> : null}
      <div className="monthlyGridWrap">
        <div className="monthlyCalendar">
          <div className="monthlyWeekdays">
            {WEEKDAYS.map((day) => <div key={day}>{day}</div>)}
          </div>
          <div className="monthlyCells">
            {cells.map((cell) => {
              if (cell.kind === "blank") return <div key={cell.key} className="monthlyDay is-blank" />;
              const meta = monthlyStatusMeta(cell.day.worstStatus);
              const dayNumber = Number(cell.day.date.slice(-2));
              return (
                <button
                  key={cell.key}
                  type="button"
                  className={`monthlyDay ${meta.className} ${selectedDate === cell.day.date ? "is-selected" : ""}`}
                  onClick={() => onSelectDate(cell.day.date)}
                >
                  <span className="monthlyDay__num">{dayNumber}</span>
                  <span className="monthlyDay__status">{meta.label}</span>
                  {cell.day.alertCount > 0 ? <span className="monthlyDay__badge" onClick={(e) => { e.stopPropagation(); onAlertClick?.(cell.day.date); }}>{cell.day.alertCount}</span> : null}
                </button>
              );
            })}
          </div>
          {loading ? <div className="monthlyLoading">월간 데이터를 불러오는 중...</div> : null}
        </div>

        <aside className="monthlyDetail">
          {selectedDay ? (
            <>
              <div className="monthlyDetail__head">
                <div>
                  <div className="monthlyDetail__date">{selectedDay.date}</div>
                  <div className={`monthlyDetail__status ${monthlyStatusMeta(selectedDay.worstStatus).className}`}>{monthlyStatusMeta(selectedDay.worstStatus).label}</div>
                </div>
                {selectedDay.alertCount > 0 ? <span className="monthlyDetail__alert">알림 {selectedDay.alertCount}</span> : null}
              </div>

              {selectedDay.hasData ? (
                <>
                  <div className="monthlyDetail__block">
                    <div className="monthlyDetail__title">Host 평균</div>
                    <MonthlyMetricRow label="CPU" metric={selectedDay.host?.cpu} unit="%" />
                    <MonthlyMetricRow label="Memory" metric={selectedDay.host?.memory} unit="%" />
                    <MonthlyMetricRow label="Disk" metric={selectedDay.host?.disk} unit="%" />
                    <MonthlyMetricRow label="Network" metric={selectedDay.host?.network} unit="KB/s" />
                  </div>
                  <div className="monthlyDetail__block">
                    <div className="monthlyDetail__title">Containers</div>
                    <div className="monthlyContainerList">
                      {(selectedDay.containers || []).length ? selectedDay.containers.map((container) => (
                        <div key={container.containerId} className="monthlyContainerItem">
                          <div className="monthlyContainerItem__head">
                            <strong>{container.containerId}</strong>
                            <span>{container.status}</span>
                          </div>
                          <MonthlyMetricRow label="CPU" metric={container.cpu} unit="%" />
                          <MonthlyMetricRow label="Memory" metric={container.memory} unit="%" />
                          <MonthlyMetricRow label="Network" metric={container.network} unit="KB/s" />
                        </div>
                      )) : <div className="monthlyNoData">컨테이너 데이터가 없습니다.</div>}
                    </div>
                  </div>
                </>
              ) : (
                <div className="monthlyNoData">선택한 날짜에 수집된 데이터가 없습니다.</div>
              )}
            </>
          ) : (
            <div className="monthlyNoData">날짜를 선택하세요.</div>
          )}
        </aside>
      </div>
    </section>
  );
}

export default function Dashboard() {
  const session = getStoredSession();
  const companyId = session?.id || "";
  const [view, setView] = useState(() => companyId ? getRuntime(companyId).snapshot : createInitialSnapshot());
  const [monthDate, setMonthDate] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [monthlyData, setMonthlyData] = useState(null);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [monthlyError, setMonthlyError] = useState("");
  const [selectedMonthlyDate, setSelectedMonthlyDate] = useState(() => toDateKey(new Date()));
  const [alertModal, setAlertModal] = useState(null);
  const [alertModalLoading, setAlertModalLoading] = useState(false);

  useEffect(() => {
    if (!companyId) { setView(createInitialSnapshot()); return; }
    const unsubscribe = subscribeRuntime(companyId, setView);
    ensureDashboardStarted(companyId);
    return () => unsubscribe();
  }, [companyId]);

  const { loading, polling, hostData, containers, selectedContainerId, containerMetricsById, loadingMetricsById } = view;

  useEffect(() => {
    if (companyId && selectedContainerId) {
      fetchContainerMetricsSnapshot(companyId, selectedContainerId, { showLoading: true });
    }
  }, [companyId, selectedContainerId]);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    async function loadMonthlyMetrics() {
      setMonthlyLoading(true);
      setMonthlyError("");
      try {
        const year = monthDate.getFullYear();
        const month = monthDate.getMonth() + 1;
        const result = await getMonthlyMetrics(companyId, { year, month });
        if (cancelled) return;
        setMonthlyData(result);
        const todayKey = toDateKey(new Date());
        const firstDayKey = `${year}-${String(month).padStart(2, "0")}-01`;
        setSelectedMonthlyDate((prev) => prev?.startsWith(`${year}-${String(month).padStart(2, "0")}`) ? prev : (todayKey.startsWith(`${year}-${String(month).padStart(2, "0")}`) ? todayKey : firstDayKey));
      } catch {
        if (!cancelled) {
          setMonthlyData(null);
          setMonthlyError("월간 리소스 데이터를 불러오지 못했습니다.");
        }
      } finally {
        if (!cancelled) setMonthlyLoading(false);
      }
    }
    loadMonthlyMetrics();
    return () => { cancelled = true; };
  }, [companyId, monthDate]);

  const containerMetrics = containerMetricsById[selectedContainerId] || null;
  const loadingMetrics = !!loadingMetricsById[selectedContainerId];
  const selectedContainer = useMemo(() => containers.find((item) => item.containerId === selectedContainerId) || null, [containers, selectedContainerId]);

  const hostMetrics = hostData?.hostMetrics || {};
  const hostCpuDanger = isCpuDanger(lastOf(hostMetrics.cpu));
  const containerCpuDanger = isCpuDanger(lastOf(containerMetrics?.metrics?.cpu));

  const hostStatus = statusMeta(hostData?.host?.status || (hostCpuDanger ? "bad" : "STABLE"));
  const containerStatus = statusMeta(selectedContainer?.status || containerMetrics?.status || (containerCpuDanger ? "bad" : "RUNNING"));

  if (loading) return <div className="unifiedPage"><div className="unifiedIntro"><div><h2 className="unifiedIntro__title">대시보드</h2><p className="unifiedIntro__desc">로딩 중...</p></div></div></div>;

  return (
    <div className="unifiedPage">
      <div className="unifiedIntro">
        <div><h2 className="unifiedIntro__title">모니또링 대시보드</h2><p className="unifiedIntro__desc">서버와 컨테이너의 실시간 리소스 변화를 확인합니다.</p></div>
        <div className="unifiedLiveBadge">{polling ? "갱신 중..." : "실시간 수집 중"}</div>
      </div>

      <MonthlyCalendar
        companyId={companyId}
        monthDate={monthDate}
        monthlyData={monthlyData}
        selectedDate={selectedMonthlyDate}
        onSelectDate={setSelectedMonthlyDate}
        onMoveMonth={(amount) => setMonthDate((prev) => addMonths(prev, amount))}
        loading={monthlyLoading}
        error={monthlyError}
        onAlertClick={async (date) => {
          setAlertModalLoading(true);
          setAlertModal({ date, loading: true });
          try {
            const data = await getDailyAlertSummary(companyId, date);
            setAlertModal({ ...data, loading: false });
          } catch {
            setAlertModal({ date, loading: false, summary: "데이터를 불러오지 못했습니다.", alerts: [], errorLogs: [] });
          } finally {
            setAlertModalLoading(false);
          }
        }}
      />

      {alertModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setAlertModal(null)}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 32, maxWidth: 640, width: "90%", maxHeight: "80vh", overflowY: "auto", boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, color: "#080808" }}>🚨 {alertModal.date} 위험 알림 요약</h3>
              <button onClick={() => setAlertModal(null)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#888" }}>✕</button>
            </div>
            {alertModal.loading ? (
              <div style={{ textAlign: "center", padding: 40, color: "#888" }}>AI 분석 중...</div>
            ) : (
              <>
                <div style={{ background: "#f8fbff", border: "1px solid rgba(20,110,245,0.2)", borderRadius: 8, padding: 16, marginBottom: 20, fontSize: 14, lineHeight: 1.7, color: "#1a1a1a", whiteSpace: "pre-wrap" }}>
                  <strong style={{ display: "block", marginBottom: 8, color: "#146ef5" }}>AI 요약 분석</strong>
                  {alertModal.summary}
                </div>
                {alertModal.alerts?.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <strong style={{ fontSize: 13, color: "#555", display: "block", marginBottom: 8 }}>임계치 초과 알람</strong>
                    {alertModal.alerts.map((a, i) => (
                      <div key={i} style={{ background: a.severity === "critical" ? "#fff1f0" : "#fffbe6", border: `1px solid ${a.severity === "critical" ? "#ffccc7" : "#ffe58f"}`, borderRadius: 6, padding: "8px 12px", marginBottom: 6, fontSize: 13 }}>
                        <span style={{ fontWeight: 600 }}>[{a.time}] {a.alertName}</span> — {a.description}
                      </div>
                    ))}
                  </div>
                )}
                {alertModal.errorLogs?.length > 0 && (
                  <div>
                    <strong style={{ fontSize: 13, color: "#555", display: "block", marginBottom: 8 }}>ERROR / WARN 로그</strong>
                    {alertModal.errorLogs.map((l, i) => (
                      <div key={i} style={{ background: l.severity === "ERROR" ? "#fff1f0" : "#fffbe6", borderLeft: `3px solid ${l.severity === "ERROR" ? "#ff4d4f" : "#faad14"}`, padding: "6px 10px", marginBottom: 4, fontSize: 12, fontFamily: "monospace", borderRadius: "0 4px 4px 0" }}>
                        <span style={{ fontWeight: 700, marginRight: 6 }}>[{l.severity}]</span>{l.body}
                      </div>
                    ))}
                  </div>
                )}
                {!alertModal.alerts?.length && !alertModal.errorLogs?.length && (
                  <div style={{ color: "#888", fontSize: 14 }}>해당 날짜에 기록된 위험 항목이 없습니다.</div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <section className={`unifiedPanel ${hostCpuDanger ? "unifiedPanel--danger" : ""}`}>
        <div className="unifiedPanel__head">
          <div><div className="sectionEyebrow">HOST SERVER</div><h3 className="sectionTitle">호스트 서버 전체 리소스</h3></div>
          <div className={`statusPill ${hostStatus.className}`}>{hostStatus.label}</div>
        </div>
        <div className="unifiedMetricGrid">
          <MetricCard title="CPU 사용률" value={formatValue(lastOf(hostMetrics.cpu), "%")} sub={hostCpuDanger ? "위험" : "정상"} danger={hostCpuDanger} />
          <MetricCard title="메모리 사용량" value={formatValue(lastOf(hostMetrics.memory), "%")} sub="물리적 점유" />
          <MetricCard title="디스크 사용량" value={formatValue(lastOf(hostMetrics.disk), "%")} sub="전체 용량 대비" />
          <MetricCard title="네트워크" value={formatValue(lastOf(hostMetrics.network), "KB/s")} sub="In/Out 합계" />
        </div>
        <div className="chartGrid chartGrid--host">
          <LiveChartCard title="CPU 사용률" currentValue={lastOf(hostMetrics.cpu)} unit="%" rawSeries={hostMetrics.cpu} danger={hostCpuDanger} />
          <LiveChartCard title="메모리 사용량" currentValue={lastOf(hostMetrics.memory)} unit="%" rawSeries={hostMetrics.memory} />
          <LiveChartCard title="디스크 사용량" currentValue={lastOf(hostMetrics.disk)} unit="%" rawSeries={hostMetrics.disk} />
          <LiveChartCard title="네트워크 트래픽" currentValue={lastOf(hostMetrics.network)} unit="KB/s" rawSeries={hostMetrics.network} />
        </div>
      </section>

      <section className={`unifiedPanel ${containerCpuDanger ? "unifiedPanel--danger" : ""}`}>
        <div className="unifiedPanel__head">
          <div><div className="sectionEyebrow">CONTAINERS</div><h3 className="sectionTitle">컨테이너 상세 리소스</h3></div>
          {selectedContainerId ? <div className={`statusPill ${containerStatus.className}`}>{containerStatus.label}</div> : null}
        </div>
        <div className="containerWorkspace">
          <aside className="containerWorkspace__list">
            <div className="containerNameList">
              {containers.map((c) => (
                <button key={c.containerId} type="button" className={`containerNameItem ${selectedContainerId === c.containerId ? "is-selected" : ""}`} onClick={() => patchRuntimeSnapshot(companyId, prev => ({ ...prev, selectedContainerId: c.containerId }))}>
                  <span className="containerNameItem__name">{c.containerId}</span>
                  <span className={`statusPill ${statusMeta(c.status).className}`}>{statusMeta(c.status).label}</span>
                </button>
              ))}
              {!containers.length ? <ContainerEmptyState hasContainers={false} /> : null}
            </div>
          </aside>
          <div className="containerWorkspace__detail">
            {!selectedContainerId ? (
              <ContainerEmptyState hasContainers={containers.length > 0} />
            ) : !loadingMetrics ? (
              <div className="chartGrid chartGrid--container">
                <LiveChartCard title="컨테이너 CPU" currentValue={lastOf(containerMetrics?.metrics?.cpu)} unit="%" rawSeries={containerMetrics?.metrics?.cpu || []} danger={containerCpuDanger} sensitivity="high" />
                <LiveChartCard title="컨테이너 메모리" currentValue={lastOf(containerMetrics?.metrics?.memory)} unit="%" rawSeries={containerMetrics?.metrics?.memory || []} sensitivity="high" />
                <LiveChartCard title="컨테이너 네트워크" currentValue={lastOf(containerMetrics?.metrics?.network)} unit="KB/s" rawSeries={containerMetrics?.metrics?.network || []} sensitivity="high" />
              </div>
            ) : <div className="unifiedSkeleton" style={{ height: 200 }} />}
          </div>
        </div>
      </section>
    </div>
  );
}
