import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "./servers.css";

function StatusPill({ tone, label }) {
  return <span className={`pill pill--${tone}`}>{label}</span>;
}

function formatUptime(hours) {
  if (hours <= 0) return "-";
  if (hours < 24) return `${hours}시간`;
  const days = Math.floor(hours / 24);
  const remain = hours % 24;
  return remain ? `${days}일 ${remain}시간` : `${days}일`;
}

export default function Servers() {
  const navigate = useNavigate();

  const servers = useMemo(
    () => [
      {
        id: "a",
        name: "a 중소기업 서버",
        ip: "10.0.1.3",
        os: "Ubuntu 22.04",
        containers: 7,
        health: "ok",
        cpu: 18,
        mem: 41,
        disk: 52,
        uptimeHours: 216,
        lastSeen: "방금 전",
      },
      {
        id: "b",
        name: "b 중소기업 서버",
        ip: "10.0.1.4",
        os: "Ubuntu 22.04",
        containers: 5,
        health: "warn",
        cpu: 72,
        mem: 83,
        disk: 64,
        uptimeHours: 98,
        lastSeen: "2분 전",
      },
      {
        id: "c",
        name: "c 중소기업 서버",
        ip: "10.0.1.5",
        os: "Ubuntu 22.04",
        containers: 6,
        health: "down",
        cpu: 0,
        mem: 0,
        disk: 0,
        uptimeHours: 0,
        lastSeen: "연결 끊김",
      },
    ],
    []
  );

  const summary = useMemo(() => {
    const total = servers.length;
    const ok = servers.filter((s) => s.health === "ok").length;
    const warn = servers.filter((s) => s.health === "warn").length;
    const down = servers.filter((s) => s.health === "down").length;
    return { total, ok, warn, down };
  }, [servers]);

  return (
    <div className="servers">
      <div className="servers__grid">
        <section className="card">
          <div className="card__title">서버 요약</div>
          <div className="stats">
            <div className="stat">
              <div className="stat__label">전체</div>
              <div className="stat__value">{summary.total}</div>
            </div>
            <div className="stat">
              <div className="stat__label">정상</div>
              <div className="stat__value">{summary.ok}</div>
            </div>
            <div className="stat">
              <div className="stat__label">주의</div>
              <div className="stat__value">{summary.warn}</div>
            </div>
            <div className="stat">
              <div className="stat__label">오프라인</div>
              <div className="stat__value">{summary.down}</div>
            </div>
          </div>
          <div className="card__hint">
            지금은 목업 데이터로 보여주고 있고, API 붙이면 그대로 실데이터로 바뀌게
            구조 잡아놨어.
          </div>
        </section>

        <section className="card card--table">
          <div className="card__head">
            <div>
              <div className="card__title">서버 목록</div>
              <div className="card__sub">서버를 클릭하면 상세 페이지로 이동</div>
            </div>
            <div className="chip">VPC: 10.0.0.0/16</div>
          </div>

          <div className="tableWrap">
            <table className="table">
              <thead>
                <tr>
                  <th>상태</th>
                  <th>서버</th>
                  <th>IP</th>
                  <th>컨테이너</th>
                  <th>CPU</th>
                  <th>RAM</th>
                  <th>Disk</th>
                  <th>업타임</th>
                  <th>마지막 수집</th>
                </tr>
              </thead>
              <tbody>
                {servers.map((s) => (
                  <tr
                    key={s.id}
                    className="row"
                    onClick={() => {
                      navigate(`/servers/${s.id}`, { state: { server: s } });
                    }}
                  >
                    <td>
                      {s.health === "ok" && <StatusPill tone="ok" label="정상" />}
                      {s.health === "warn" && <StatusPill tone="warn" label="주의" />}
                      {s.health === "down" && (
                        <StatusPill tone="down" label="오프라인" />
                      )}
                    </td>

                    <td>
                      <div className="serverName">{s.name}</div>
                      <div className="serverMeta">{s.os}</div>
                    </td>

                    <td className="mono">{s.ip}</td>
                    <td className="mono">{s.containers}</td>
                    <td className="mono">{s.cpu}%</td>
                    <td className="mono">{s.mem}%</td>
                    <td className="mono">{s.disk}%</td>
                    <td className="mono">{formatUptime(s.uptimeHours)}</td>
                    <td>{s.lastSeen}</td>
                  </tr>
                ))}

                {servers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="emptyRow">
                      서버 데이터가 없어
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="tableHint">
            서버 상세 페이지에서는 컨테이너별 상태 비교, 기간별 지표 확인까지 한 번에
            가능하게 설계.
          </div>
        </section>
      </div>
    </div>
  );
}
