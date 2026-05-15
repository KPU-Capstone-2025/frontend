import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./serverDetail.css";

import {
  fetchServerDetailMock,
  fetchServerMetricsMock,
} from "../../services/serverApiMock.js";

const PERIODS = [
  { key: "1h", label: "1h" },
  { key: "24h", label: "24h" },
  { key: "7d", label: "7d" },
];

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function statusTone(state) {
  if (state === "running") return "ok";
  if (state === "degraded") return "warn";
  if (state === "stopped") return "down";
  return "muted";
}

function statusLabel(state) {
  if (state === "running") return "정상";
  if (state === "degraded") return "경고";
  if (state === "stopped") return "중단";
  return "알 수 없음";
}

function serverStatusTone(health) {
  if (health === "ok") return "ok";
  if (health === "warn") return "warn";
  return "down";
}

function serverStatusLabel(health) {
  if (health === "ok") return "정상";
  if (health === "warn") return "주의";
  return "오프라인";
}

function avgOf(series) {
  if (!series?.length) return 0;
  const s = series.reduce((acc, d) => acc + (Number(d.v) || 0), 0);
  return s / series.length;
}

function lastOf(series) {
  if (!series?.length) return 0;
  return Number(series[series.length - 1]?.v ?? 0);
}

function buildSparkPath(data, w = 260, h = 70, pad = 8) {
  if (!data?.length) return "";
  const ys = data.map((d) => Number(d.v) || 0);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const n = data.length;
  const xStep = (w - pad * 2) / (n - 1 || 1);

  const points = data.map((d, i) => {
    const raw = Number(d.v) || 0;
    const t = (raw - minY) / (maxY - minY || 1);
    const x = pad + xStep * i;
    const y = pad + (1 - t) * (h - pad * 2);
    return [x, y];
  });

  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`).join(" ");
}

function ChartCard({ title, subtitle, valueText, unit, data, legend }) {
  const path = useMemo(() => buildSparkPath(data), [data]);
  const last = useMemo(() => lastOf(data), [data]);

  return (
    <div className="sdChartCard">
      <div className="sdChartHead">
        <div className="sdChartTitle">{title}</div>
        <div className="sdChartMeta">
          {valueText ? (
            <span className="sdChartValue">
              {valueText}
              {unit ? <span className="sdUnit">{unit}</span> : null}
            </span>
          ) : (
            <span className="sdChartValue">
              {Number.isFinite(last) ? last.toFixed(1) : "0.0"}
              {unit ? <span className="sdUnit">{unit}</span> : null}
            </span>
          )}
          {subtitle ? <span className="sdChartSub">{subtitle}</span> : null}
        </div>
      </div>

      <div className="sdChartBody">
        <svg className="sdSpark" viewBox="0 0 260 70" preserveAspectRatio="none">
          <path className="sdSparkPath" d={path} />
        </svg>

        {legend ? (
          <div className="sdLegend">
            {legend.map((it) => (
              <div key={it} className="sdLegendItem">
                <span className="sdLegendDot" />
                <span>{it}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PeriodTabs({ value, onChange }) {
  return (
    <div className="sdTabs">
      <span className="sdTabsLabel">기간:</span>
      {PERIODS.map((p) => (
        <button
          key={p.key}
          className={`sdTab ${value === p.key ? "isOn" : ""}`}
          type="button"
          onClick={() => onChange(p.key)}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

function SummaryRow({ serverAvgCpu, serverAvgMem, serverNetNow }) {
  return (
    <div className="sdSummaryRow">
      <div className="sdSummaryItem">
        <div className="sdSummaryLabel">서버 전체 리소스 요약</div>
        <div className="sdSummaryValue">
          {clamp((serverAvgCpu + serverAvgMem) / 2, 0, 100).toFixed(0)}%
          <span className="sdSummaryArrow">↗</span>
        </div>
      </div>

      <div className="sdSummaryItem">
        <div className="sdSummaryLabel">CPU 사용률</div>
        <div className="sdSummaryValue">
          {clamp(serverAvgCpu, 0, 100).toFixed(0)}%
          <span className="sdSummaryArrow">↗</span>
        </div>
      </div>

      <div className="sdSummaryItem">
        <div className="sdSummaryLabel">메모리 사용률</div>
        <div className="sdSummaryValue">
          {clamp(serverAvgMem, 0, 100).toFixed(0)}%
          <span className="sdSummaryArrow">↗</span>
        </div>
      </div>

      <div className="sdSummaryItem">
        <div className="sdSummaryLabel">네트워크 트래픽</div>
        <div className="sdSummaryValue">
          {Math.max(0, serverNetNow).toFixed(0)}
          <span className="sdSummaryUnit">MB/s</span>
        </div>
      </div>
    </div>
  );
}

export default function ServerDetail() {
  const { serverId } = useParams();
  const navigate = useNavigate();

  const [period, setPeriod] = useState("24h");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [server, setServer] = useState(null);
  const [containers, setContainers] = useState([]);
  const [selectedId, setSelectedId] = useState("");

  const [metrics, setMetrics] = useState(null);

  const selected = useMemo(() => {
    return containers.find((c) => c.id === selectedId) || null;
  }, [containers, selectedId]);

  async function loadAll() {
    setError("");
    setLoading(true);

    try {
      const detail = await fetchServerDetailMock(serverId);
      setServer(detail.server);
      setContainers(detail.containers || []);

      const defaultPick = detail.containers?.[0]?.id || "";
      setSelectedId((prev) => prev || defaultPick);

      const m = await fetchServerMetricsMock(serverId, period);
      setMetrics(m);
    } catch (e) {
      setError(
        e?.message ||
          "데이터를 불러오지 못함. 네트워크 상태 확인 요망."
      );
      setServer(null);
      setContainers([]);
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverId, period]);

  const serverTone = serverStatusTone(server?.health);
  const serverLabel = serverStatusLabel(server?.health);

  const serverAvgCpu = useMemo(() => avgOf(metrics?.cpu), [metrics]);
  const serverAvgMem = useMemo(() => avgOf(metrics?.mem), [metrics]);
  const serverNetNow = useMemo(() => lastOf(metrics?.net), [metrics]);

  // 컨테이너별 네트워크는 목업으로 간단히 만들어서 테이블에만 보여줌
  const containerRows = useMemo(() => {
    return (containers || []).map((c, idx) => {
      const base = 10 + (idx % 3) * 7;
      const net = c.state === "stopped" ? 0 : base + Math.random() * 15;
      const note =
        c.state === "degraded"
          ? "CPU 사용률 급등"
          : c.state === "stopped"
          ? "컨테이너 중단"
          : "-";

      return {
        ...c,
        net,
        note,
      };
    });
  }, [containers]);

  // 선택 컨테이너의 2x2 그래프(목업)
  // - CPU(%): server cpu
  // - Memory(GB): mem% -> 0~6.5GB로 변환
  // - Net IN/OUT: server net을 IN/OUT으로 분리
  const chartCpu = useMemo(() => metrics?.cpu || [], [metrics]);
  const chartMemGb = useMemo(() => {
    const mem = metrics?.mem || [];
    const maxGb = 6.5;
    return mem.map((d) => ({
      t: d.t,
      v: (clamp(Number(d.v) || 0, 0, 100) / 100) * maxGb,
    }));
  }, [metrics]);

  const chartNetIn = useMemo(() => {
    const net = metrics?.net || [];
    return net.map((d) => {
      const v = Number(d.v) || 0;
      return { t: d.t, v: v * 0.55 };
    });
  }, [metrics]);

  const chartNetOut = useMemo(() => {
    const net = metrics?.net || [];
    return net.map((d) => {
      const v = Number(d.v) || 0;
      return { t: d.t, v: v * 0.45 };
    });
  }, [metrics]);

  const chartNetTotal = useMemo(() => metrics?.net || [], [metrics]);

  if (loading) {
    return (
      <div className="serverDetailNew">
        <div className="sdTopBar">
          <div className="sdTopLeft">
            <div className="sdTitleLine">
              <div className="sdTitle">서버 상세</div>
              <span className="sdBadge sdBadge--muted">로딩 중</span>
            </div>
            <div className="sdSubTitle">서버 지표/로그를 확인합니다.</div>
          </div>
        </div>

        <div className="sdPanel sdSkeleton" style={{ height: 220 }} />
        <div className="sdPanel sdSkeleton" style={{ height: 360 }} />
        <div className="sdSummaryRow">
          <div className="sdSummaryItem sdSkeleton" style={{ height: 74 }} />
          <div className="sdSummaryItem sdSkeleton" style={{ height: 74 }} />
          <div className="sdSummaryItem sdSkeleton" style={{ height: 74 }} />
          <div className="sdSummaryItem sdSkeleton" style={{ height: 74 }} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="serverDetailNew">
        <div className="sdTopBar">
          <div className="sdTopLeft">
            <div className="sdTitleLine">
              <div className="sdTitle">서버 상세</div>
              <span className="sdBadge sdBadge--down">오류</span>
            </div>
            <div className="sdSubTitle">{error}</div>
          </div>

          <div className="sdTopRight">
            <button className="sdBtn" type="button" onClick={() => loadAll()}>
              새로고침
            </button>
            <button className="sdBtn" type="button" onClick={() => navigate(-1)}>
              뒤로가기
            </button>
          </div>
        </div>

        <div className="sdPanel">
          <div className="sdEmpty">
            <div className="sdEmptyTitle">데이터를 불러오지 못함</div>
            <div className="sdEmptyDesc">
               다시 시도. 재시도에도 같은 문제 발생시  목업/라우팅/서비스 파일 경로 확인.
            </div>
            <div className="sdEmptyActions">
              <button className="sdBtn sdBtn--primary" type="button" onClick={() => loadAll()}>
                재시도
              </button>
              <button className="sdBtn" type="button" onClick={() => navigate("/dashboard")}>
                대시보드로
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="serverDetailNew">
      {/* 상단 헤더 */}
      <div className="sdTopBar">
        <div className="sdTopLeft">
          <div className="sdTitleLine">
           

            <div className="sdServerName">
              {server?.name || `${serverId} 서버`}
            </div>

            <span className={`sdBadge sdBadge--${serverTone}`}>{serverLabel}</span>
          </div>

          <div className="sdSubTitle">
            {server?.ip ? <span className="sdMono">{server.ip}</span> : null}
            {server?.ip ? <span className="sdDot">·</span> : null}
            {server?.os || "OS 정보 없음"}
          </div>
        </div>

        <div className="sdTopRight">
          <button
            className="sdBtn"
            type="button"
            onClick={() => alert("로그 페이지는 다음 단계.")}
            disabled
            title="다음 단계"
          >
            로그 보기
          </button>
          
          <button className="sdIconBtn" type="button" onClick={() => loadAll()} title="새로고침">
            ↻
          </button>
        </div>
      </div>

      {/* 컨테이너 테이블 */}
      <div className="sdPanel">
        <div className="sdSectionTitle">컨테이너 리스트</div>

        <div className="sdTableWrap">
          <table className="sdTable">
            <thead>
              <tr>
                <th style={{ width: 220 }}>컨테이너</th>
                <th style={{ width: 110 }}>상태</th>
                <th style={{ width: 110 }}>CPU</th>
                <th style={{ width: 120 }}>메모리</th>
                <th style={{ width: 140 }}>네트워크</th>
                <th>비고</th>
              </tr>
            </thead>
            <tbody>
              {containerRows.map((c) => {
                const active = c.id === selectedId;
                return (
                  <tr
                    key={c.id}
                    className={`sdTr ${active ? "isActive" : ""}`}
                    onClick={() => setSelectedId(c.id)}
                  >
                    <td>
                      <div className="sdContainerName">{c.name}</div>
                      <div className="sdContainerSub">
                        <span className="sdMono">{c.image}</span>
                      </div>
                    </td>

                    <td>
                      <span className={`sdState sdState--${statusTone(c.state)}`}>
                        {statusLabel(c.state)}
                      </span>
                    </td>

                    <td className="sdMono">{clamp(c.cpu, 0, 100)}%</td>
                    <td className="sdMono">
                      {clamp(c.mem, 0, 100)}%
                    </td>
                    <td className="sdMono">{Math.max(0, c.net).toFixed(0)}MB/s</td>
                    <td className="sdNote">{c.note}</td>
                  </tr>
                );
              })}

              {containerRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="sdEmptyRow">
                    컨테이너 데이터가 없음
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {/* 선택 컨테이너 상세 */}
      <div className="sdPanel">
        <div className="sdDetailHead">
          <div>
            <div className="sdSectionTitle">
              {selected ? selected.name : "컨테이너"} 상세
            </div>
            <div className="sdSectionSub">
              테이블에서 컨테이너를 찍으면 아래 그래프가 바뀜
            </div>
          </div>

          <PeriodTabs value={period} onChange={setPeriod} />
        </div>

        <div className="sdChartsGrid">
          <ChartCard
            title="CPU 사용률 (%)"
            subtitle=""
            unit="%"
            data={chartCpu}
          />
          <ChartCard
            title="메모리 사용량 (GB)"
            subtitle=""
            unit="GB"
            data={chartMemGb}
          />
          <ChartCard
            title="네트워크 트래픽 IN (MB/s)"
            subtitle=""
            unit="MB/s"
            data={chartNetIn}
            legend={["IN"]}
          />
          <ChartCard
            title="네트워크 트래픽 OUT (MB/s)"
            subtitle=""
            unit="MB/s"
            data={chartNetOut}
            legend={["OUT"]}
          />
        </div>

        <div className="sdChartsGrid sdChartsGrid--single">
          <ChartCard
            title="네트워크 트래픽 (MB/s)"
            subtitle=""
            unit="MB/s"
            data={chartNetTotal}
            legend={["TOTAL"]}
          />
        </div>
      </div>

      {/* 하단 요약 KPI */}
      <SummaryRow
        serverAvgCpu={serverAvgCpu}
        serverAvgMem={serverAvgMem}
        serverNetNow={serverNetNow}
      />
    </div>
  );
}
