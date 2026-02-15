import "./serversUi.css";

function pillTone(state) {
  if (state === "running") return "ok";
  if (state === "degraded") return "warn";
  if (state === "stopped") return "down";
  return "muted";
}

function pillLabel(state) {
  if (state === "running") return "RUNNING";
  if (state === "degraded") return "DEGRADED";
  if (state === "stopped") return "STOPPED";
  return "UNKNOWN";
}

export default function ContainerTable({ containers, selectedId, onSelect }) {
  return (
    <div className="ctWrap">
      <table className="ctTable">
        <thead>
          <tr>
            <th>상태</th>
            <th>컨테이너</th>
            <th>이미지</th>
            <th>CPU</th>
            <th>RAM</th>
            <th>재시작</th>
            <th>업데이트</th>
          </tr>
        </thead>
        <tbody>
          {containers.map((c) => {
            const active = c.id === selectedId;
            return (
              <tr
                key={c.id}
                className={"ctRow" + (active ? " isActive" : "")}
                onClick={() => onSelect(c.id)}
              >
                <td>
                  <span className={`miniPill miniPill--${pillTone(c.state)}`}>
                    {pillLabel(c.state)}
                  </span>
                </td>
                <td>
                  <div className="ctName">{c.name}</div>
                  <div className="ctMeta">
                    <span className="mono">{c.id}</span>
                    <span className="ctDot">·</span>
                    <span className="mono">ports {c.ports.join(", ")}</span>
                  </div>
                </td>
                <td className="mono ctImage">{c.image}</td>
                <td className="mono">{c.cpu}%</td>
                <td className="mono">{c.mem}%</td>
                <td className="mono">{c.restarts}</td>
                <td className="mono">{c.updatedAt}</td>
              </tr>
            );
          })}

          {containers.length === 0 ? (
            <tr>
              <td colSpan={7} className="ctEmpty">
                컨테이너 데이터가 없어
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
