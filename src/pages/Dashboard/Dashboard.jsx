import { useEffect, useMemo, useState } from "react";
import "./dashboard.css";
import { getContainerMetrics, getContainers, getHostOverview } from "../../services/monitoringApi.js";
import { getStoredSession } from "../../services/authStorage.js";

/**
 * [수정사항]
 * 1. 백엔드 MonitoringModule의 API 엔드포인트(/api/dashboard/{id}/host 등)와 데이터 매핑
 * 2. 네트워크 트래픽 단위를 KB/s로 정규화
 */
const POLLING_INTERVAL = 3000;
const CPU_ALERT_THRESHOLD = 85;
const CHART_HEIGHT = 180;
const CHART_WIDTH = 520;
const MAX_DATA_POINTS = 30;

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
function avgOf(series = []) { return series.length ? series.reduce((acc, cur) => acc + Number(cur?.v || 0), 0) / series.length : 0; }

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

  const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const areaPath = [linePath, `L ${points[points.length - 1]?.x ?? right} ${bottom}`, `L ${points[0]?.x ?? left} ${bottom}`, "Z"].join(" ");
  const first = points[0]; const center = points[Math.floor(points.length / 2)] || first; const last = points[points.length - 1] || first;
  const labels = [timeLabel(first?.t), timeLabel(center?.t), timeLabel(last?.t)];
  return { linePath, areaPath, points, min, max, mid, labels };
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
      selectedContainerId: prev.selectedContainerId || containersRes[0]?.containerId || "",
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
  } catch (e) {
    patchRuntimeSnapshot(companyId, (prev) => ({ ...prev, loadingMetricsById: { ...prev.loadingMetricsById, [containerId]: false } }));
  }
}

function ensureHostPolling(companyId) {
  const runtime = getRuntime(companyId);
  if (runtime.hostTimer) return;
  runtime.hostTimer = setInterval(async () => {
    patchRuntimeSnapshot(companyId, (prev) => ({ ...prev, polling: true }));
    try { await fetchHostAndContainers(companyId); } 
    catch (e) {} 
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

function LiveChartCard({ title, currentValue, unit, rawSeries, footer, danger = false, sensitivity = "normal" }) {
  const smoothed = useMemo(() => smoothSeries(rawSeries, unit, { sensitivity }), [rawSeries, unit, sensitivity]);
  const geometry = useMemo(() => createChartGeometry(smoothed, { width: CHART_WIDTH, height: CHART_HEIGHT }), [smoothed]);
  const trend = useMemo(() => calcTrend(rawSeries), [rawSeries]);
  const displayValue = unit === "%" ? Number(currentValue || 0).toFixed(1) : Number(currentValue || 0).toFixed(2);
  const gradientId = useMemo(() => `chartArea-${title.replace(/\s+/g, "-").replace(/[^\w-]/g, "")}`, [title]);

  return (
    <div className={`liveChartCard ${danger ? "is-danger" : ""}`}>
      <div className="liveChartCard__head">
        <div><div className="liveChartCard__title">{title}</div></div>
        <div className="liveChartCard__side">
          <div className="liveChartCard__value">{displayValue}<span className="liveChartCard__unit">{unit}</span></div>
          <TrendChip trend={trend} />
        </div>
      </div>
      
      <div className="liveChartCard__body" style={{ position: 'relative', height: '120px', paddingBottom: '20px' }}>
        <div className="chartAxisY" style={{ position: 'absolute', left: 0, top: '10px', bottom: '30px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: '10px', color: '#94a3b8', zIndex: 2 }}>
          <span>{geometry.max.toFixed(unit === "%" ? 1 : 2)}</span>
          <span>{geometry.mid.toFixed(unit === "%" ? 1 : 2)}</span>
          <span>{geometry.min.toFixed(unit === "%" ? 1 : 2)}</span>
        </div>

        <svg className="liveChartSvg" viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} preserveAspectRatio="none" style={{ width: '100%', height: '100px' }}>
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={danger ? "#ef4444" : "#3b82f6"} stopOpacity="0.15" />
              <stop offset="100%" stopColor={danger ? "#ef4444" : "#3b82f6"} stopOpacity="0.01" />
            </linearGradient>
          </defs>
          <line x1="14" y1="16" x2={CHART_WIDTH - 14} y2="16" stroke="#e2e8f0" strokeDasharray="4" />
          <line x1="14" y1={CHART_HEIGHT - 16} x2={CHART_WIDTH - 14} y2={CHART_HEIGHT - 16} stroke="#e2e8f0" strokeDasharray="4" />
          <path d={geometry.areaPath} fill={`url(#${gradientId})`} />
          <path d={geometry.linePath} fill="none" stroke={danger ? "#ef4444" : "#3b82f6"} strokeWidth="2.5" strokeLinecap="round" />
          {geometry.points.length ? <circle cx={geometry.points[geometry.points.length - 1].x} cy={geometry.points[geometry.points.length - 1].y} r="4.5" fill={danger ? "#ef4444" : "#3b82f6"} stroke="#fff" strokeWidth="2" /> : null}
        </svg>

        <div className="chartAxisX" style={{ position: 'absolute', bottom: 0, left: '14px', right: '14px', display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#94a3b8' }}>
          <span>{geometry.labels[0]}</span>
          <span>{geometry.labels[1]}</span>
          <span>{geometry.labels[2]}</span>
        </div>
      </div>
      <div className="liveChartCard__footer" style={{ marginTop: '5px' }}>{footer}</div>
    </div>
  );
}

export default function Dashboard() {
  const session = getStoredSession();
  const companyId = session?.id || "";
  const [view, setView] = useState(() => companyId ? getRuntime(companyId).snapshot : createInitialSnapshot());

  useEffect(() => {
    if (!companyId) { setView(createInitialSnapshot()); return; }
    const unsubscribe = subscribeRuntime(companyId, setView);
    ensureDashboardStarted(companyId);
    return () => unsubscribe();
  }, [companyId]);

  const { loading, polling, error, hostData, containers, selectedContainerId, containerMetricsById, loadingMetricsById } = view;

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
        <div><h2 className="unifiedIntro__title">통합 모니터링 대시보드</h2><p className="unifiedIntro__desc">서버와 컨테이너의 실시간 리소스 변화를 확인합니다.</p></div>
        <div className="unifiedLiveBadge">{polling ? "갱신 중..." : "실시간 수집 중"}</div>
      </div>

      <section className={`unifiedPanel ${hostCpuDanger ? "unifiedPanel--danger" : ""}`}>
        <div className="unifiedPanel__head">
          <div><div className="sectionEyebrow">HOST SERVER</div><h3 className="sectionTitle">호스트 서버 전체 리소스</h3></div>
          <div className={`statusPill ${hostStatus.className}`}>{hostStatus.label}</div>
        </div>
        <div className="unifiedMetricGrid">
          <MetricCard title="CPU 사용률" value={formatValue(lastOf(hostMetrics.cpu), "%")} sub={hostCpuDanger ? "위험" : "정상"} danger={hostCpuDanger} />
          <MetricCard title="메모리 사용량" value={formatValue(lastOf(hostMetrics.memory), "MB")} sub="물리적 점유" />
          <MetricCard title="디스크 사용량" value={formatValue(lastOf(hostMetrics.disk), "%")} sub="전체 용량 대비" />
          <MetricCard title="네트워크" value={formatValue(lastOf(hostMetrics.network), "KB/s")} sub="In/Out 합계" />
        </div>
        <div className="chartGrid chartGrid--host">
          <LiveChartCard title="CPU 사용률" currentValue={lastOf(hostMetrics.cpu)} unit="%" rawSeries={hostMetrics.cpu} danger={hostCpuDanger} />
          <LiveChartCard title="메모리 사용량" currentValue={lastOf(hostMetrics.memory)} unit="MB" rawSeries={hostMetrics.memory} />
          <LiveChartCard title="디스크 사용량" currentValue={lastOf(hostMetrics.disk)} unit="%" rawSeries={hostMetrics.disk} />
          <LiveChartCard title="네트워크 트래픽" currentValue={lastOf(hostMetrics.network)} unit="KB/s" rawSeries={hostMetrics.network} />
        </div>
      </section>

      <section className={`unifiedPanel ${containerCpuDanger ? "unifiedPanel--danger" : ""}`}>
        <div className="unifiedPanel__head">
          <div><div className="sectionEyebrow">CONTAINERS</div><h3 className="sectionTitle">컨테이너 상세 리소스</h3></div>
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
            </div>
          </aside>
          <div className="containerWorkspace__detail">
            {!loadingMetrics ? (
              <div className="chartGrid chartGrid--container">
                <LiveChartCard title="컨테이너 CPU" currentValue={lastOf(containerMetrics?.metrics?.cpu)} unit="%" rawSeries={containerMetrics?.metrics?.cpu || []} danger={containerCpuDanger} sensitivity="high" />
                <LiveChartCard title="컨테이너 메모리" currentValue={lastOf(containerMetrics?.metrics?.memory)} unit="MB" rawSeries={containerMetrics?.metrics?.memory || []} sensitivity="high" />
                <LiveChartCard title="컨테이너 네트워크" currentValue={lastOf(containerMetrics?.metrics?.network)} unit="KB/s" rawSeries={containerMetrics?.metrics?.network || []} sensitivity="high" />
              </div>
            ) : <div className="unifiedSkeleton" style={{ height: 200 }} />}
          </div>
        </div>
      </section>
    </div>
  );
}