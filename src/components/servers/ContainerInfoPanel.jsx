import "./serversUi.css";

function tone(state) {
  if (state === "running") return "ok";
  if (state === "degraded") return "warn";
  if (state === "stopped") return "down";
  return "muted";
}

export default function ContainerInfoPanel({ server, container, periodLabel }) {
  if (!container) {
    return (
      <div className="infoPanel">
        <div className="infoEmpty">컨테이너를 하나 선택하면 여기에 상세가 보여</div>
      </div>
    );
  }

  return (
    <div className="infoPanel">
      <div className="infoTop">
        <div>
          <div className="infoTitleRow">
            <div className="infoTitle">{container.name}</div>
            <span className={`infoPill infoPill--${tone(container.state)}`}>
              {container.state}
            </span>
          </div>
          <div className="infoSub">
            서버: <span className="mono">{server?.name || "-"}</span>
            <span className="infoDot">·</span>
            기간: <span className="mono">{periodLabel}</span>
          </div>
        </div>

        <div className="infoKpis">
          <div className="kpi">
            <div className="kpi__label">CPU</div>
            <div className="kpi__value mono">{container.cpu}%</div>
          </div>
          <div className="kpi">
            <div className="kpi__label">RAM</div>
            <div className="kpi__value mono">{container.mem}%</div>
          </div>
          <div className="kpi">
            <div className="kpi__label">Restarts</div>
            <div className="kpi__value mono">{container.restarts}</div>
          </div>
        </div>
      </div>

      <div className="infoGrid">
        <div className="infoCard">
          <div className="infoCard__label">컨테이너 ID</div>
          <div className="mono">{container.id}</div>
        </div>

        <div className="infoCard">
          <div className="infoCard__label">이미지</div>
          <div className="mono">{container.image}</div>
        </div>

        <div className="infoCard">
          <div className="infoCard__label">포트</div>
          <div className="mono">{container.ports.join(", ")}</div>
        </div>

        <div className="infoCard">
          <div className="infoCard__label">최근 업데이트</div>
          <div className="mono">{container.updatedAt}</div>
        </div>
      </div>

      <div className="eventBox">
        <div className="eventBox__title">최근 이벤트</div>
        <div className="eventList">
          {container.events?.map((ev, idx) => (
            <div key={idx} className="eventRow">
              <div className="eventRow__ts">{ev.ts}</div>
              <div className="eventRow__msg">{ev.msg}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
