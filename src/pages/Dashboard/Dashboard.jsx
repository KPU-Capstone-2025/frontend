import { useEffect, useMemo, useRef, useState } from "react";
import "./dashboard.css";

import {
  getContainerMetrics,
  getContainers,
  getHostOverview,
  mergeContainerMetricsSnapshot,
  mergeHostSnapshot,
} from "../../services/monitoringApi.js";
import { getStoredSession } from "../../services/authStorage.js";

const POLLING_INTERVAL = 5000;
const CPU_ALERT_THRESHOLD = 85;
const CHART_HEIGHT = 180;
const CHART_WIDTH = 520;

const dashboardCache = new Map();

function getCachedDashboardState(companyId) {
  return dashboardCache.get(companyId) || null;
}

function lastOf(series = []) {
  if (!series.length) return 0;
  return Number(series[series.length - 1]?.v ?? 0);
}

function avgOf(series = []) {
  if (!series.length) return 0;
  return (
    series.reduce((acc, cur) => acc + Number(cur?.v || 0), 0) / series.length
  );
}

function formatDateTime(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("ko-KR", {
    hour12: false,
  });
}

function formatValue(value, unit) {
  const safe = Number.isFinite(Number(value)) ? Number(value) : 0;

  if (unit === "%") return `${safe.toFixed(1)}%`;
  if (unit === "GB") return `${safe.toFixed(2)} GB`;
  if (unit === "MB") return `${safe.toFixed(2)} MB`;
  if (unit === "KB/s") return `${safe.toFixed(2)} KB/s`;
  if (unit === "B/s") return `${safe.toFixed(2)} B/s`;

  return `${safe.toFixed(2)} ${unit || ""}`.trim();
}

function isCpuDanger(value) {
  return Number(value || 0) >= CPU_ALERT_THRESHOLD;
}

function statusMeta(status) {
  if (status === "healthy") {
    return { label: "정상", className: "is-good" };
  }
  if (status === "warning") {
    return { label: "주의", className: "is-warn" };
  }
  return { label: "오류", className: "is-bad" };
}

function getNoiseGate(unit) {
  if (unit === "%") return 0.25;
  if (unit === "GB") return 0.03;
  if (unit === "MB") return 3;
  if (unit === "KB/s") return 1.5;
  if (unit === "B/s") return 120;
  return 0.1;
}

function smoothSeries(series = [], unit = "%") {
  if (!Array.isArray(series) || series.length === 0) return [];

  const alpha = unit === "%" ? 0.42 : unit === "GB" || unit === "MB" ? 0.35 : 0.28;
  const gate = getNoiseGate(unit);

  let prev = Number(series[0]?.v || 0);

  return series.map((point, index) => {
    const current = Number(point?.v || 0);

    if (index === 0) {
      prev = current;
      return { ...point, sv: current };
    }

    const delta = current - prev;

    if (Math.abs(delta) < gate) {
      return { ...point, sv: prev };
    }

    const next = prev + delta * alpha;
    prev = next;

    return { ...point, sv: Number(next.toFixed(2)) };
  });
}

function createChartGeometry(series = [], { width = CHART_WIDTH, height = CHART_HEIGHT } = {}) {
  if (!series.length) {
    return {
      linePath: "",
      areaPath: "",
      points: [],
      min: 0,
      max: 100,
      mid: 50,
      labels: ["", "", ""],
    };
  }

  const values = series.map((item) => Number(item?.sv ?? item?.v ?? 0));
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const span = rawMax - rawMin;
  const topPad = span === 0 ? Math.max(rawMax * 0.12, 1) : span * 0.16;
  const bottomPad = span === 0 ? Math.max(rawMin * 0.08, 1) : span * 0.12;

  const min = Math.max(0, rawMin - bottomPad);
  const max = rawMax + topPad;
  const mid = (min + max) / 2;

  const left = 14;
  const right = width - 14;
  const top = 12;
  const bottom = height - 16;
  const innerWidth = right - left;
  const innerHeight = bottom - top;

  const stepX = innerWidth / Math.max(series.length - 1, 1);

  const points = series.map((item, index) => {
    const value = Number(item?.sv ?? item?.v ?? 0);
    const ratio = (value - min) / (max - min || 1);
    const x = left + stepX * index;
    const y = bottom - ratio * innerHeight;

    return {
      x,
      y,
      value,
      rawValue: Number(item?.v ?? 0),
      t: item?.t,
    };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  const areaPath = [
    linePath,
    `L ${points[points.length - 1]?.x ?? right} ${bottom}`,
    `L ${points[0]?.x ?? left} ${bottom}`,
    "Z",
  ].join(" ");

  const first = points[0];
  const center = points[Math.floor(points.length / 2)] || first;
  const last = points[points.length - 1] || first;

  const labels = [
    first?.t ? timeLabel(first.t) : "",
    center?.t ? timeLabel(center.t) : "",
    last?.t ? timeLabel(last.t) : "",
  ];

  return {
    linePath,
    areaPath,
    points,
    min,
    max,
    mid,
    labels,
  };
}

function timeLabel(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function calcTrend(series = []) {
  if (!series.length) return { direction: "flat", text: "변화 없음" };

  const last = Number(series[series.length - 1]?.v || 0);
  const prev = Number(series[series.length - 2]?.v ?? last);

  const diff = last - prev;

  if (Math.abs(diff) < 0.01) {
    return { direction: "flat", text: "직전 수집과 통일" };
  }

  if (diff > 0) {
    return {
      direction: "up",
      text: `직전 대비 +${diff.toFixed(2)}`,
    };
  }

  return {
    direction: "down",
    text: `직전 대비 ${diff.toFixed(2)}`,
  };
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

function LiveChartCard({
  title,
  currentValue,
  unit,
  rawSeries,
  footer,
  danger = false,
}) {
  const smoothed = useMemo(() => smoothSeries(rawSeries, unit), [rawSeries, unit]);
  const geometry = useMemo(
    () => createChartGeometry(smoothed, { width: CHART_WIDTH, height: CHART_HEIGHT }),
    [smoothed]
  );
  const trend = useMemo(() => calcTrend(rawSeries), [rawSeries]);

  const displayValue =
    unit === "%"
      ? Number(currentValue || 0).toFixed(1)
      : Number(currentValue || 0).toFixed(2);

  const gradientId = useMemo(
    () => `chartArea-${title.replace(/\s+/g, "-").replace(/[^\w-]/g, "")}`,
    [title]
  );

  return (
    <div className={`liveChartCard ${danger ? "is-danger" : ""}`}>
      <div className="liveChartCard__head">
        <div>
          <div className="liveChartCard__title">{title}</div>
        </div>

        <div className="liveChartCard__side">
          <div className="liveChartCard__value">
            {displayValue}
            <span className="liveChartCard__unit">{unit}</span>
          </div>
          <TrendChip trend={trend} />
        </div>
      </div>

      <div className="liveChartCard__body">
        <svg
          className="liveChartSvg"
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.10" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          <line x1="14" y1="16" x2={CHART_WIDTH - 14} y2="16" className="chartGridLine" />
          <line
            x1="14"
            y1={CHART_HEIGHT / 2}
            x2={CHART_WIDTH - 14}
            y2={CHART_HEIGHT / 2}
            className="chartGridLine"
          />
          <line
            x1="14"
            y1={CHART_HEIGHT - 16}
            x2={CHART_WIDTH - 14}
            y2={CHART_HEIGHT - 16}
            className="chartGridLine"
          />

          <path d={geometry.areaPath} fill={`url(#${gradientId})`} />
          <path d={geometry.linePath} className="chartLine" />

          {geometry.points.length ? (
            <circle
              cx={geometry.points[geometry.points.length - 1].x}
              cy={geometry.points[geometry.points.length - 1].y}
              r="4.5"
              className="chartDot"
            />
          ) : null}
        </svg>

        <div className="chartAxisY">
          <span>{geometry.max.toFixed(unit === "%" ? 1 : 2)}</span>
          <span>{geometry.mid.toFixed(unit === "%" ? 1 : 2)}</span>
          <span>{geometry.min.toFixed(unit === "%" ? 1 : 2)}</span>
        </div>
      </div>

      <div className="chartAxisX">
        <span>{geometry.labels[0]}</span>
        <span>{geometry.labels[1]}</span>
        <span>{geometry.labels[2]}</span>
      </div>

      <div className="liveChartCard__footer">{footer}</div>
    </div>
  );
}

function RefreshButton({ onClick, loading }) {
  return (
    <button
      type="button"
      className={`tableRefreshBtn ${loading ? "is-loading" : ""}`}
      onClick={onClick}
      disabled={loading}
      title="컨테이너 목록 새로고침"
      aria-label="컨테이너 목록 새로고침"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20 12a8 8 0 1 1-2.34-5.66" />
        <path d="M20 4v6h-6" />
      </svg>
    </button>
  );
}

export default function Dashboard() {
  const session = getStoredSession();
  const companyId = session?.id || "";
  const cached = getCachedDashboardState(companyId);

  const [loading, setLoading] = useState(!cached);
  const [loadingMetrics, setLoadingMetrics] = useState(!cached?.containerMetrics);
  const [refreshingContainers, setRefreshingContainers] = useState(false);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState(cached?.error || "");

  const [hostData, setHostData] = useState(cached?.hostData || null);
  const [containers, setContainers] = useState(cached?.containers || []);
  const [selectedContainerId, setSelectedContainerId] = useState(
    cached?.selectedContainerId || ""
  );
  const [containerMetrics, setContainerMetrics] = useState(
    cached?.containerMetrics || null
  );

  const hostPollingRef = useRef(null);
  const containerPollingRef = useRef(null);

  useEffect(() => {
    if (!companyId) return;

    dashboardCache.set(companyId, {
      loading,
      loadingMetrics,
      error,
      hostData,
      containers,
      selectedContainerId,
      containerMetrics,
    });
  }, [
    companyId,
    loading,
    loadingMetrics,
    error,
    hostData,
    containers,
    selectedContainerId,
    containerMetrics,
  ]);

  const selectedContainer = useMemo(() => {
    return containers.find((item) => item.id === selectedContainerId) || null;
  }, [containers, selectedContainerId]);

  async function loadContainersOnly() {
    if (!companyId) return;

    try {
      setRefreshingContainers(true);
      setError("");

      const containersRes = await getContainers(companyId);
      const nextContainers = Array.isArray(containersRes) ? containersRes : [];

      setContainers(nextContainers);
      setSelectedContainerId((prev) => {
        const hasPrev = nextContainers.some((item) => item.id === prev);
        return hasPrev ? prev : nextContainers[0]?.id || "";
      });
    } catch (e) {
      setError(e?.message || "컨테이너 목록을 새로고침하지 못했습니다.");
    } finally {
      setRefreshingContainers(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadPage() {
      if (!companyId) {
        setLoading(false);
        setError("로그인된 회사 정보가 없습니다.");
        return;
      }

      if (cached?.hostData && cached?.containers?.length) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const [hostRes, containersRes] = await Promise.all([
          getHostOverview(companyId),
          getContainers(companyId),
        ]);

        if (cancelled) return;

        const nextContainers = Array.isArray(containersRes) ? containersRes : [];

        setHostData(hostRes);
        setContainers(nextContainers);
        setSelectedContainerId((prev) => {
          if (prev && nextContainers.some((item) => item.id === prev)) {
            return prev;
          }
          return nextContainers[0]?.id || "";
        });
      } catch (e) {
        if (cancelled) return;
        setError(e?.message || "대시보드 데이터를 불러오지 못했습니다.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadPage();

    return () => {
      cancelled = true;
    };
  }, [cached, companyId]);

  useEffect(() => {
    if (!companyId || loading) return;

    let cancelled = false;

    async function pollHostAndContainers() {
      try {
        setPolling(true);

        const [nextHostData, nextContainers] = await Promise.all([
          getHostOverview(companyId),
          getContainers(companyId),
        ]);

        if (cancelled) return;

        setHostData((prev) => mergeHostSnapshot(prev, nextHostData));

        const safeContainers = Array.isArray(nextContainers) ? nextContainers : [];
        setContainers(safeContainers);

        setSelectedContainerId((prev) => {
          const hasPrev = safeContainers.some((item) => item.id === prev);
          return hasPrev ? prev : safeContainers[0]?.id || "";
        });
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || "자동 갱신 중 오류가 발생했습니다.");
        }
      } finally {
        if (!cancelled) {
          setPolling(false);
        }
      }
    }

    hostPollingRef.current = setInterval(pollHostAndContainers, POLLING_INTERVAL);

    return () => {
      cancelled = true;
      if (hostPollingRef.current) {
        clearInterval(hostPollingRef.current);
        hostPollingRef.current = null;
      }
    };
  }, [companyId, loading]);

  useEffect(() => {
    let cancelled = false;

    async function loadContainerMetrics(showLoading = true) {
      if (!companyId || !selectedContainerId) {
        setContainerMetrics(null);
        setLoadingMetrics(false);
        return;
      }

      try {
        if (showLoading) {
          setLoadingMetrics(true);
        }

        const res = await getContainerMetrics(companyId, selectedContainerId, "live");

        if (cancelled) return;

        setContainerMetrics((prev) => {
          if (showLoading || !prev) {
            return res;
          }
          return mergeContainerMetricsSnapshot(prev, res);
        });
      } catch (e) {
        if (!cancelled) {
          setContainerMetrics(null);
          setError(e?.message || "컨테이너 상세 리소스를 불러오지 못했습니다.");
        }
      } finally {
        if (!cancelled && showLoading) {
          setLoadingMetrics(false);
        }
      }
    }

    loadContainerMetrics(true);

    return () => {
      cancelled = true;
    };
  }, [companyId, selectedContainerId]);

  useEffect(() => {
    if (!companyId || !selectedContainerId) return;

    let cancelled = false;

    async function pollContainerMetrics() {
      try {
        const res = await getContainerMetrics(companyId, selectedContainerId, "live");

        if (cancelled) return;

        setContainerMetrics((prev) => mergeContainerMetricsSnapshot(prev, res));
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || "컨테이너 리소스 자동 갱신 중 오류가 발생했습니다.");
        }
      }
    }

    containerPollingRef.current = setInterval(pollContainerMetrics, POLLING_INTERVAL);

    return () => {
      cancelled = true;
      if (containerPollingRef.current) {
        clearInterval(containerPollingRef.current);
        containerPollingRef.current = null;
      }
    };
  }, [companyId, selectedContainerId]);

  const host = hostData?.host;
  const hostMetrics = hostData?.hostMetrics || {};

  const hostCpuDanger = isCpuDanger(host?.cpuUsage);
  const containerCpuDanger = isCpuDanger(lastOf(containerMetrics?.metrics?.cpu));

  const hostStatus = statusMeta(host?.status || (hostCpuDanger ? "bad" : "healthy"));
  const containerStatus = statusMeta(
    selectedContainer?.status ||
      containerMetrics?.status ||
      (containerCpuDanger ? "bad" : "healthy")
  );

  if (loading) {
    return (
      <div className="unifiedPage">
        <div className="unifiedIntro">
          <div>
            <h2 className="unifiedIntro__title">통합 모니터링 대시보드</h2>
            <p className="unifiedIntro__desc">
              회사의 호스트 및 컨테이너 정보를 불러오는 중입니다.
            </p>
          </div>
        </div>

        <div className="unifiedSkeleton" style={{ height: 180 }} />
        <div className="unifiedSkeleton" style={{ height: 260 }} />
        <div className="unifiedSkeleton" style={{ height: 420 }} />
      </div>
    );
  }

  return (
    <div className="unifiedPage">
      <div className="unifiedIntro">
        <div>
          <h2 className="unifiedIntro__title">통합 모니터링 대시보드</h2>
          <p className="unifiedIntro__desc">
            서버와 컨테이너의 리소스 변화를 실시간으로 확인할 수 있습니다.
          </p>
        </div>

        <div className="unifiedLiveBadge">
          {polling ? "실시간 갱신 중..." : "5초 실시간 수집"}
        </div>
      </div>

      {error ? <div className="unifiedError">{error}</div> : null}

      <section className={`unifiedPanel ${hostCpuDanger ? "unifiedPanel--danger" : ""}`}>
        <div className="unifiedPanel__head">
          <div>
            <div className="sectionEyebrow">HOST SERVER</div>
            <h3 className="sectionTitle">호스트 서버 전체 리소스</h3>
            <p className="sectionDesc">
              전체 서버의 현재 리소스 사용 상태입니다.
            </p>
          </div>

          <div className="detailHeadRight">
            <div className={`statusPill ${hostStatus.className}`}>{hostStatus.label}</div>
            <div className="tableSummary">
              {hostCpuDanger ? "CPU 임계치 초과" : "정상 수집 중"}
            </div>
          </div>
        </div>

        <div className="unifiedMetricGrid">
          <MetricCard
            title="CPU 사용률"
            value={formatValue(host?.cpuUsage, host?.cpuUnit || "%")}
            sub={
              hostCpuDanger
                ? `위험 수준 감지 · 마지막 수집: ${formatDateTime(host?.lastUpdate)}`
                : `마지막 수집: ${formatDateTime(host?.lastUpdate)}`
            }
            danger={hostCpuDanger}
          />
          <MetricCard
            title="메모리 사용량"
            value={formatValue(host?.memoryUsage, host?.memoryUnit || "MB")}
            sub="호스트 서버 전체 기준"
          />
          <MetricCard
            title="디스크 사용량"
            value={formatValue(host?.diskUsage, host?.diskUnit || "%")}
            sub="호스트 서버 전체 기준"
          />
          <MetricCard
            title="네트워크 트래픽"
            value={formatValue(host?.networkTraffic, host?.networkUnit || "MB/s")}
            sub="최근 수집 기준"
          />
        </div>

        <div className="chartGrid chartGrid--host">
          <LiveChartCard
            title="CPU 사용률"
            currentValue={lastOf(hostMetrics.cpu)}
            unit={host?.cpuUnit || "%"}
            rawSeries={hostMetrics.cpu}
            footer={
              hostCpuDanger
                ? `경고 임계치 ${CPU_ALERT_THRESHOLD}% 이상`
                : "5초 간격 실시간 포인트 누적"
            }
            danger={hostCpuDanger}
          />

          <LiveChartCard
            title="메모리 사용량"
            currentValue={lastOf(hostMetrics.memory)}
            unit={host?.memoryUnit || "MB"}
            rawSeries={hostMetrics.memory}
            footer="실제 수집값 기반 메모리 추이"
          />

          <LiveChartCard
            title="디스크 사용량"
            currentValue={lastOf(hostMetrics.disk)}
            unit={host?.diskUnit || "%"}
            rawSeries={hostMetrics.disk}
            footer="실제 수집값 기반 디스크 추이"
          />

          <LiveChartCard
            title="네트워크 트래픽"
            currentValue={lastOf(hostMetrics.network)}
            unit={host?.networkUnit || "MB/s"}
            rawSeries={hostMetrics.network}
            footer={`마지막 수집: ${formatDateTime(host?.lastUpdate)}`}
          />
        </div>
      </section>

      <section className={`unifiedPanel ${containerCpuDanger ? "unifiedPanel--danger" : ""}`}>
        <div className="unifiedPanel__head">
          <div>
            <div className="sectionEyebrow">CONTAINERS</div>
            <h3 className="sectionTitle">컨테이너 목록 + 상세 리소스</h3>
            <p className="sectionDesc">
              컨테이너별 리소스 상태를 선택하여 확인할 수 있습니다.
            </p>
          </div>

          <div className="tableSummaryWrap">
            <div className="tableSummary">
              총 <strong>{containers.length}</strong>개
            </div>
            <RefreshButton onClick={loadContainersOnly} loading={refreshingContainers} />
          </div>
        </div>

        <div className="containerWorkspace">
          <aside className="containerWorkspace__list">
            <div className="containerWorkspace__titleRow">
              <div>
                <div className="sectionEyebrow">CONTAINER LIST</div>
                <h4 className="containerWorkspace__title">컨테이너 목록</h4>
              </div>
            </div>

            <div className="containerNameList">
              {containers.map((container) => (
                <button
                  key={container.id}
                  type="button"
                  className={`containerNameItem ${
                    selectedContainerId === container.id ? "is-selected" : ""
                  }`}
                  onClick={() => setSelectedContainerId(container.id)}
                >
                  <span className="containerNameItem__name">{container.name}</span>
                  <span className={`statusPill ${statusMeta(container.status).className}`}>
                    {statusMeta(container.status).label}
                  </span>
                </button>
              ))}

              {containers.length === 0 ? (
                <div className="emptyNameList">조회된 컨테이너가 없습니다.</div>
              ) : null}
            </div>
          </aside>

          <div className="containerWorkspace__detail">
            <div className="containerDetailHead">
              <div>
                <div className="sectionEyebrow">CONTAINER DETAIL</div>
                <h3 className="sectionTitle">
                  {selectedContainer?.name || "컨테이너"} 상세 리소스
                </h3>
                <p className="sectionDesc">
                  선택한 컨테이너의 최신 실측값과 실시간 추이를 표시합니다.
                </p>
              </div>

              <div className="detailHeadRight">
                <div className={`statusPill ${containerStatus.className}`}>
                  {containerCpuDanger ? "CPU 위험" : containerStatus.label}
                </div>
                <div className="tableSummary">실시간 모드</div>
              </div>
            </div>

            <div className="detailSummaryRow">
              <div className={`detailSummaryCard ${containerCpuDanger ? "is-danger" : ""}`}>
                <div className="detailSummaryCard__label">평균 CPU</div>
                <div className="detailSummaryCard__value">
                  {(containerMetrics?.summary?.cpuAvg ?? avgOf(containerMetrics?.metrics?.cpu)).toFixed(1)}
                  <span className="detailSummaryCard__unit">
                    {containerMetrics?.units?.cpu || "%"}
                  </span>
                </div>
              </div>

              <div className="detailSummaryCard">
                <div className="detailSummaryCard__label">평균 메모리</div>
                <div className="detailSummaryCard__value">
                  {(containerMetrics?.summary?.memoryAvg ?? avgOf(containerMetrics?.metrics?.memory)).toFixed(2)}
                  <span className="detailSummaryCard__unit">
                    {containerMetrics?.units?.memory || "MB"}
                  </span>
                </div>
              </div>

              <div className="detailSummaryCard">
                <div className="detailSummaryCard__label">평균 디스크</div>
                <div className="detailSummaryCard__value">
                  {(containerMetrics?.summary?.diskAvg ?? avgOf(containerMetrics?.metrics?.disk)).toFixed(1)}
                  <span className="detailSummaryCard__unit">
                    {containerMetrics?.units?.disk || "%"}
                  </span>
                </div>
              </div>

              <div className="detailSummaryCard">
                <div className="detailSummaryCard__label">평균 네트워크 트래픽</div>
                <div className="detailSummaryCard__value">
                  {(containerMetrics?.summary?.networkAvg ?? avgOf(containerMetrics?.metrics?.network)).toFixed(2)}
                  <span className="detailSummaryCard__unit">
                    {containerMetrics?.units?.network || "MB/s"}
                  </span>
                </div>
              </div>
            </div>

            {loadingMetrics ? (
              <div className="unifiedSkeleton" style={{ height: 320 }} />
            ) : (
              <div className="chartGrid chartGrid--container">
                <LiveChartCard
                  title="컨테이너 CPU 사용률"
                  currentValue={lastOf(containerMetrics?.metrics?.cpu)}
                  unit={containerMetrics?.units?.cpu || "%"}
                  rawSeries={containerMetrics?.metrics?.cpu || []}
                  footer={
                    containerCpuDanger
                      ? `경고 임계치 ${CPU_ALERT_THRESHOLD}% 이상`
                      : "5초 간격 실시간 포인트 누적"
                  }
                  danger={containerCpuDanger}
                />

                <LiveChartCard
                  title="컨테이너 메모리 사용량"
                  currentValue={lastOf(containerMetrics?.metrics?.memory)}
                  unit={containerMetrics?.units?.memory || "MB"}
                  rawSeries={containerMetrics?.metrics?.memory || []}
                  footer="최근 메모리 사용량 추이"
                />

                <LiveChartCard
                  title="컨테이너 디스크 사용량"
                  currentValue={lastOf(containerMetrics?.metrics?.disk)}
                  unit={containerMetrics?.units?.disk || "%"}
                  rawSeries={containerMetrics?.metrics?.disk || []}
                  footer="최근 디스크 사용량 추이"
                />

                <LiveChartCard
                  title="컨테이너 네트워크 트래픽"
                  currentValue={lastOf(containerMetrics?.metrics?.network)}
                  unit={containerMetrics?.units?.network || "MB/s"}
                  rawSeries={containerMetrics?.metrics?.network || []}
                  footer={`마지막 수집: ${formatDateTime(containerMetrics?.lastUpdate)}`}
                />
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}