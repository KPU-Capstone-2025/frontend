import { useEffect, useMemo, useState } from "react";
import "./dashboard.css";

import {
  getContainerMetrics,
  getContainers,
  getHostOverview,
} from "../../services/monitoringApi.js";
import { getStoredSession } from "../../services/authStorage.js";

const RANGE_OPTIONS = [
  { key: "1h", label: "1h" },
  { key: "24h", label: "24h" },
  { key: "7d", label: "7d" },
];

function lastOf(series = []) {
  if (!series.length) return 0;
  return Number(series[series.length - 1]?.v ?? 0);
}

function avgOf(series = []) {
  if (!series.length) return 0;
  return series.reduce((acc, cur) => acc + Number(cur.v || 0), 0) / series.length;
}

function buildSparkPath(data, w = 320, h = 86, pad = 8) {
  if (!data?.length) return "";
  const ys = data.map((d) => Number(d.v) || 0);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const xStep = (w - pad * 2) / Math.max(data.length - 1, 1);

  return data
    .map((d, i) => {
      const raw = Number(d.v) || 0;
      const ratio = (raw - minY) / (maxY - minY || 1);
      const x = pad + i * xStep;
      const y = pad + (1 - ratio) * (h - pad * 2);
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
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

function MetricCard({ title, value, sub }) {
  return (
    <div className="unifiedMetricCard">
      <div className="unifiedMetricCard__title">{title}</div>
      <div className="unifiedMetricCard__value">{value}</div>
      <div className="unifiedMetricCard__sub">{sub}</div>
    </div>
  );
}

function MiniChartCard({ title, value, unit, data, footer }) {
  const path = useMemo(() => buildSparkPath(data), [data]);

  return (
    <div className="miniChartCard">
      <div className="miniChartCard__head">
        <div className="miniChartCard__title">{title}</div>
        <div className="miniChartCard__value">
          {value}
          {unit ? <span className="miniChartCard__unit">{unit}</span> : null}
        </div>
      </div>

      <div className="miniChartCard__body">
        <svg viewBox="0 0 320 86" preserveAspectRatio="none" className="miniChartSvg">
          <path d={path} className="miniChartSvg__path" />
        </svg>
      </div>

      <div className="miniChartCard__footer">{footer}</div>
    </div>
  );
}

function RangeTabs({ value, onChange }) {
  return (
    <div className="rangeTabs">
      {RANGE_OPTIONS.map((item) => (
        <button
          key={item.key}
          type="button"
          className={`rangeTabs__item ${value === item.key ? "is-active" : ""}`}
          onClick={() => onChange(item.key)}
        >
          {item.label}
        </button>
      ))}
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

  const [range, setRange] = useState("24h");

  const [loading, setLoading] = useState(true);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [refreshingContainers, setRefreshingContainers] = useState(false);
  const [error, setError] = useState("");

  const [hostData, setHostData] = useState(null);
  const [containers, setContainers] = useState([]);
  const [selectedContainerId, setSelectedContainerId] = useState("");
  const [containerMetrics, setContainerMetrics] = useState(null);

  const companyId = session?.companyId || "";
  const companyName = session?.companyName || "";

  const selectedContainer = useMemo(() => {
    return containers.find((item) => item.id === selectedContainerId) || null;
  }, [containers, selectedContainerId]);

  async function loadContainersOnly() {
    if (!companyId) return;

    try {
      setRefreshingContainers(true);
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
    let alive = true;

    async function loadPage() {
      if (!companyId) return;

      try {
        setLoading(true);
        setError("");

        const [hostRes, containersRes] = await Promise.all([
          getHostOverview(companyId),
          getContainers(companyId),
        ]);

        if (!alive) return;

        const nextContainers = Array.isArray(containersRes) ? containersRes : [];

        setHostData(hostRes);
        setContainers(nextContainers);
        setSelectedContainerId(nextContainers[0]?.id || "");
      } catch (e) {
        if (!alive) return;
        setError(e?.message || "대시보드 데이터를 불러오지 못했습니다.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadPage();

    return () => {
      alive = false;
    };
  }, [companyId]);

  useEffect(() => {
    let alive = true;

    async function loadContainerMetrics() {
      if (!companyId || !selectedContainerId) {
        setContainerMetrics(null);
        return;
      }

      try {
        setLoadingMetrics(true);
        const res = await getContainerMetrics(companyId, selectedContainerId, range);
        if (!alive) return;
        setContainerMetrics(res);
      } catch {
        if (!alive) return;
        setContainerMetrics(null);
      } finally {
        if (alive) setLoadingMetrics(false);
      }
    }

    loadContainerMetrics();

    return () => {
      alive = false;
    };
  }, [companyId, selectedContainerId, range]);

  const host = hostData?.host;
  const hostMetrics = hostData?.hostMetrics || {};

  const hostStatus = statusMeta(host?.status || "healthy");
  const containerStatus = statusMeta(selectedContainer?.status || "healthy");

  if (loading) {
    return (
      <div className="unifiedPage">
        <div className="unifiedIntro">
          <h2 className="unifiedIntro__title">통합 모니터링</h2>
          <p className="unifiedIntro__desc">회사의 호스트 및 컨테이너 정보를 불러오는 중입니다.</p>
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
            로그인한 회사 기준으로 호스트 서버와 컨테이너 리소스를 한 번에 확인합니다.
          </p>
        </div>

        <div className="unifiedCompanyChip">
          <span className="unifiedCompanyChip__label">현재 회사</span>
          <strong>{companyName || companyId}</strong>
        </div>
      </div>

      {error ? <div className="unifiedError">{error}</div> : null}

      <section className="unifiedPanel">
        <div className="unifiedPanel__head">
          <div>
            <div className="sectionEyebrow">HOST SERVER</div>
            <h3 className="sectionTitle">호스트 서버 전체 리소스</h3>
            <p className="sectionDesc">
              최상단에는 전체 서버 상태를 먼저 보여주고, 아래에서 컨테이너별 상세를 확인합니다.
            </p>
          </div>

          <div className={`statusPill ${hostStatus.className}`}>{hostStatus.label}</div>
        </div>

        <div className="unifiedMetricGrid">
          <MetricCard
            title="CPU 사용률"
            value={`${host?.cpuUsage ?? 0}%`}
            sub="호스트 서버 전체 기준"
          />
          <MetricCard
            title="메모리 사용률"
            value={`${host?.memoryUsage ?? 0}%`}
            sub="호스트 서버 전체 기준"
          />
          <MetricCard
            title="디스크 사용률"
            value={`${host?.diskUsage ?? 0}%`}
            sub="호스트 서버 전체 기준"
          />
          <MetricCard
            title="네트워크 트래픽"
            value={`${host?.networkTraffic ?? 0} MB/s`}
            sub="최근 수집 기준"
          />
        </div>

        <div className="chartGrid chartGrid--host">
          <MiniChartCard
            title="CPU 사용률 (%)"
            value={lastOf(hostMetrics.cpu).toFixed(1)}
            unit="%"
            data={hostMetrics.cpu}
            footer="호스트 전체 CPU 추이"
          />
          <MiniChartCard
            title="메모리 사용률 (%)"
            value={lastOf(hostMetrics.memory).toFixed(1)}
            unit="%"
            data={hostMetrics.memory}
            footer="호스트 전체 메모리 추이"
          />
          <MiniChartCard
            title="디스크 사용률 (%)"
            value={lastOf(hostMetrics.disk).toFixed(1)}
            unit="%"
            data={hostMetrics.disk}
            footer="호스트 전체 디스크 추이"
          />
          <MiniChartCard
            title="네트워크 트래픽 (MB/s)"
            value={lastOf(hostMetrics.network).toFixed(1)}
            unit="MB/s"
            data={hostMetrics.network}
            footer="호스트 전체 네트워크 추이"
          />
        </div>
      </section>

      <section className="unifiedPanel">
        <div className="unifiedPanel__head">
          <div>
            <div className="sectionEyebrow">CONTAINERS</div>
            <h3 className="sectionTitle">컨테이너 목록</h3>
            <p className="sectionDesc">
              로그인한 회사의 컨테이너가 자동 조회되고, 이름을 클릭하면 하단 상세가 바뀝니다.
            </p>
          </div>

          <div className="tableSummaryWrap">
            <div className="tableSummary">
              총 <strong>{containers.length}</strong>개
            </div>
            <RefreshButton onClick={loadContainersOnly} loading={refreshingContainers} />
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
              {container.name}
            </button>
          ))}

          {containers.length === 0 ? (
            <div className="emptyNameList">조회된 컨테이너가 없습니다.</div>
          ) : null}
        </div>
      </section>

      <section className="unifiedPanel">
        <div className="unifiedPanel__head">
          <div>
            <div className="sectionEyebrow">CONTAINER DETAIL</div>
            <h3 className="sectionTitle">
              {selectedContainer?.name || "컨테이너"} 상세 리소스
            </h3>
            <p className="sectionDesc">
              선택한 컨테이너 기준 CPU, 메모리, 디스크, 네트워크 트래픽 추이를 확인합니다.
            </p>
          </div>

          <div className="detailHeadRight">
            <div className={`statusPill ${containerStatus.className}`}>{containerStatus.label}</div>
            <RangeTabs value={range} onChange={setRange} />
          </div>
        </div>

        <div className="detailSummaryRow">
          <div className="detailSummaryCard">
            <div className="detailSummaryCard__label">평균 CPU</div>
            <div className="detailSummaryCard__value">
              {containerMetrics?.summary?.cpuAvg?.toFixed?.(1) ??
                avgOf(containerMetrics?.metrics?.cpu).toFixed(1)}
              %
            </div>
          </div>

          <div className="detailSummaryCard">
            <div className="detailSummaryCard__label">평균 메모리</div>
            <div className="detailSummaryCard__value">
              {containerMetrics?.summary?.memoryAvg?.toFixed?.(1) ??
                avgOf(containerMetrics?.metrics?.memory).toFixed(1)}
              <span className="detailSummaryCard__unit">%</span>
            </div>
          </div>

          <div className="detailSummaryCard">
            <div className="detailSummaryCard__label">평균 디스크</div>
            <div className="detailSummaryCard__value">
              {containerMetrics?.summary?.diskAvg?.toFixed?.(1) ??
                avgOf(containerMetrics?.metrics?.disk).toFixed(1)}
              <span className="detailSummaryCard__unit">%</span>
            </div>
          </div>

          <div className="detailSummaryCard">
            <div className="detailSummaryCard__label">평균 네트워크 트래픽</div>
            <div className="detailSummaryCard__value">
              {containerMetrics?.summary?.networkAvg?.toFixed?.(1) ??
                avgOf(containerMetrics?.metrics?.network).toFixed(1)}
              <span className="detailSummaryCard__unit">MB/s</span>
            </div>
          </div>
        </div>

        {loadingMetrics ? (
          <div className="unifiedSkeleton" style={{ height: 320 }} />
        ) : (
          <div className="chartGrid chartGrid--container">
            <MiniChartCard
              title="CPU 사용률 (%)"
              value={lastOf(containerMetrics?.metrics?.cpu).toFixed(1)}
              unit="%"
              data={containerMetrics?.metrics?.cpu || []}
              footer="선택 컨테이너 CPU 추이"
            />
            <MiniChartCard
              title="메모리 사용률 (%)"
              value={lastOf(containerMetrics?.metrics?.memory).toFixed(1)}
              unit="%"
              data={containerMetrics?.metrics?.memory || []}
              footer="선택 컨테이너 메모리 추이"
            />
            <MiniChartCard
              title="디스크 사용률 (%)"
              value={lastOf(containerMetrics?.metrics?.disk).toFixed(1)}
              unit="%"
              data={containerMetrics?.metrics?.disk || []}
              footer="선택 컨테이너 디스크 추이"
            />
            <MiniChartCard
              title="네트워크 트래픽 (MB/s)"
              value={lastOf(containerMetrics?.metrics?.network).toFixed(1)}
              unit="MB/s"
              data={containerMetrics?.metrics?.network || []}
              footer="선택 컨테이너 전체 네트워크 추이"
            />
          </div>
        )}
      </section>
    </div>
  );
}