import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  fetchServerDetailMock,
  fetchServerMetricsMock,
} from "../../services/serverApiMock.js";

import PeriodTabs from "../../components/ui/PeriodTabs.jsx";
import MetricLine from "../../components/ui/MetricLine.jsx";
import ContainerTable from "../../components/servers/ContainerTable.jsx";
import ContainerInfoPanel from "../../components/servers/ContainerInfoPanel.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";

import "./serverDetail.css";

const PERIODS = [
  { key: "1h", label: "1시간" },
  { key: "6h", label: "6시간" },
  { key: "24h", label: "24시간" },
  { key: "7d", label: "7일" },
];

export default function ServerDetail() {
  const { serverId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [period, setPeriod] = useState("6h");

  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState("");

  const [server, setServer] = useState(null);
  const [containers, setContainers] = useState([]);
  const [selectedContainerId, setSelectedContainerId] = useState("");
  const [metrics, setMetrics] = useState(null);

  const selectedContainer = useMemo(() => {
    return containers.find((c) => c.id === selectedContainerId) || null;
  }, [containers, selectedContainerId]);

  async function loadAll({ isRetry = false } = {}) {
    setError("");
    if (isRetry) setRetrying(true);
    else setLoading(true);

    try {
      const detail = await fetchServerDetailMock(serverId);

      setServer(detail.server);
      setContainers(detail.containers);

      const firstId = detail.containers?.[0]?.id || "";
      setSelectedContainerId((prev) => prev || firstId);

      const m = await fetchServerMetricsMock(serverId, period);
      setMetrics(m);
    } catch (e) {
      setError(
        e?.message ||
          "데이터를 불러오지 못함."
      );
      setServer(null);
      setContainers([]);
      setMetrics(null);
    } finally {
      setLoading(false);
      setRetrying(false);
    }
  }

  useEffect(() => {
    // 서버 리스트에서 state로 넘어온 정보가 있으면 로딩 전에 화면 제목부터 자연스럽게 보여주려고 먼저 세팅해둠
    const quickServer = location.state?.server;
    if (quickServer) setServer((prev) => prev || quickServer);

    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverId]);

  useEffect(() => {
    // 기간 변경 버튼 클릭 -> 데이터 재조회
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const headerTitle = server?.name ? server.name : `서버 ${serverId}`;
  const headerSub = server?.ip ? `IP ${server.ip}` : "서버 상세";

  if (loading) {
    return (
      <div className="serverDetail">
        <div className="sdHeader">
          <div>
            <div className="sdTitle">{headerTitle}</div>
            <div className="sdSub">{headerSub}</div>
          </div>
          <div className="sdRight">
            <PeriodTabs periods={PERIODS} value={period} onChange={setPeriod} disabled />
          </div>
        </div>

        <div className="sdGrid">
          <section className="card skeleton" />
          <section className="card skeleton" />
          <section className="card skeleton sdSpan2" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="serverDetail">
        <div className="sdHeader">
          <div>
            <div className="sdTitle">{headerTitle}</div>
            <div className="sdSub">{headerSub}</div>
          </div>
          <div className="sdRight">
            <PeriodTabs periods={PERIODS} value={period} onChange={setPeriod} />
          </div>
        </div>

        <EmptyState
          title="데이터를 불러오지 못했음"
          desc={error}
          primaryText={retrying ? "재시도 중..." : "재시도"}
          onPrimary={() => loadAll({ isRetry: true })}
          secondaryText="뒤로 가기"
          onSecondary={() => navigate(-1)}
        />
      </div>
    );
  }

  const onlineTone =
    server?.health === "ok" ? "ok" : server?.health === "warn" ? "warn" : "down";
  const onlineLabel =
    server?.health === "ok"
      ? "정상"
      : server?.health === "warn"
      ? "주의"
      : "오프라인";

  return (
    <div className="serverDetail">
      <div className="sdHeader">
        <div className="sdHeaderLeft">
          <div className="sdTitleRow">
            <div className="sdTitle">{headerTitle}</div>
            <span className={`sdPill sdPill--${onlineTone}`}>{onlineLabel}</span>
          </div>
          <div className="sdSub">
            {server?.ip ? (
              <>
                <span className="mono">{server.ip}</span>
                <span className="sdDot">·</span>
              </>
            ) : null}
            {server?.os || "운영체제 정보 없음"}
          </div>
        </div>

        <div className="sdRight">
          <PeriodTabs periods={PERIODS} value={period} onChange={setPeriod} />
        </div>
      </div>

      <div className="sdGrid">
        <section className="card">
          <div className="card__head">
            <div>
              <div className="card__title">리소스 추이</div>
              <div className="card__sub">
                기간에 따라 CPU/RAM/Disk/Network 흐름을 확인용
              </div>
            </div>
            <button
              className="btn btn--ghost"
              onClick={() => loadAll({ isRetry: true })}
              disabled={retrying}
            >
              {retrying ? "새로고침 중..." : "새로고침"}
            </button>
          </div>

          <div className="metricStack">
            <MetricLine title="CPU Usage (%)" unit="%" data={metrics?.cpu || []} />
            <MetricLine title="Memory Usage (%)" unit="%" data={metrics?.mem || []} />
            <MetricLine title="Disk Used (%)" unit="%" data={metrics?.disk || []} />
            <MetricLine title="Network RX/TX (MB/s)" unit="MB/s" data={metrics?.net || []} />
          </div>
        </section>

        <section className="card">
          <div className="card__head">
            <div>
              <div className="card__title">컨테이너 상태</div>
              <div className="card__sub">
                테이블에서 빠르게 비교하고, 하나를 찍으면 아래 상세 바꾸게 구현
              </div>
            </div>
            <div className="sdHintChip">컨테이너 {containers.length}개</div>
          </div>

          <ContainerTable
            containers={containers}
            selectedId={selectedContainerId}
            onSelect={setSelectedContainerId}
          />
        </section>

        <section className="card sdSpan2">
          <div className="card__head">
            <div>
              <div className="card__title">선택 컨테이너 상세</div>
              <div className="card__sub">
                선택된 컨테이너의 상태/포트/이미지/최근 이벤트를 요약
              </div>
            </div>

            <div className="sdActions">
              <button
                className="btn btn--primary"
                onClick={() => {
                  alert("로그 분석 페이지는 다음 단계에서 ");
                }}
              >
                로그 보기(다음 단계)
              </button>

              <button className="btn" onClick={() => navigate(-1)}>
                뒤로 가기
              </button>
            </div>
          </div>

          <ContainerInfoPanel
            server={server}
            container={selectedContainer}
            periodLabel={PERIODS.find((p) => p.key === period)?.label || ""}
          />
        </section>
      </div>
    </div>
  );
}
