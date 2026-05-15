import { useMemo, useState } from "react";
import "./alerts.css";

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clampNum(v, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function SegTabs({ value, onChange, items }) {
  return (
    <div className="segTabs" role="tablist" aria-label="알림 탭">
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          className={`segTab ${value === it.key ? "isOn" : ""}`}
          onClick={() => onChange(it.key)}
          role="tab"
          aria-selected={value === it.key}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

function ThresholdField({
  label,
  hint,
  value,
  onChange,
  min = 0,
  max = 100000,
  step = 1,
  unit,
  suffix = "이상",
}) {
  return (
    <div className="field">
      <div className="fieldLabel">{label}</div>

      <div className="inputRow">
        <input
          className="numInput"
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(clampNum(e.target.value, min, max))}
        />

        {unit ? <span className="unit">{unit}</span> : null}
        <span className="suffix">{suffix}</span>
      </div>

      {hint ? <div className="fieldHint">{hint}</div> : null}
    </div>
  );
}

function Panel({ icon, title, sub, right, children }) {
  return (
    <section className="panel">
      <div className="panelHead">
        <div>
          <div className="panelTitleRow">
            <div className="panelIcon">{icon}</div>
            <div>
              <div className="panelTitle">{title}</div>
              {sub ? <div className="panelSub">{sub}</div> : null}
            </div>
          </div>
        </div>

        {right ? <div className="panelActions">{right}</div> : null}
      </div>

      <div className="cardInner">{children}</div>
    </section>
  );
}

const TAB_ITEMS = [
  { key: "infra", label: "인프라/OS" },
  { key: "network", label: "네트워크" },
  { key: "external", label: "외부 관측" },
];

function defaultHostThresholds() {
  return {
    infra: {
      cpu: 80,
      mem: 85,
      disk: 90,
      diskIO: 500,
      loadAvg: 4,
    },
    network: {
      tcpEstablished: 1000,
      tcpTimeWait: 500,
      tcpCloseWait: 100,
      netIn: 1000,
      netOut: 1000,
      inboundSyn: 10000,
    },
    external: {
      responseMs: 1000,
      http5xxRate: 5,
      healthCheck: true,
    },
  };
}

function defaultContainerThresholds() {
  return {
    infra: {
      cpu: 80,
      mem: 85,
      disk: 90,
      diskIO: 500,
      loadAvg: 4,
    },
    network: {
      tcpEstablished: 1000,
      tcpTimeWait: 500,
      tcpCloseWait: 100,
      netIn: 1000,
      netOut: 1000,
      inboundSyn: 10000,
    },
    external: {
      responseMs: 1000,
      http5xxRate: 5,
      healthCheck: true,
    },
  };
}

function HostThresholdForm({ tab, value, onChange }) {
  if (tab === "infra") {
    return (
      <>
        <div className="grid2">
          <ThresholdField
            label="CPU 사용률 (%)"
            value={value.infra.cpu}
            min={1}
            max={100}
            unit="%"
            hint="CPU가 80% 이상일 때 알림"
            onChange={(v) =>
              onChange({
                ...value,
                infra: { ...value.infra, cpu: v },
              })
            }
          />

          <ThresholdField
            label="메모리 사용률 (%)"
            value={value.infra.mem}
            min={1}
            max={100}
            unit="%"
            hint="메모리가 85% 이상일 때 알림"
            onChange={(v) =>
              onChange({
                ...value,
                infra: { ...value.infra, mem: v },
              })
            }
          />
        </div>

        <div className="grid2">
          <ThresholdField
            label="디스크 사용량 (%)"
            value={value.infra.disk}
            min={1}
            max={100}
            unit="%"
            hint="디스크가 90% 이상 사용 시 알림 (공간 삭제 필요)"
            onChange={(v) =>
              onChange({
                ...value,
                infra: { ...value.infra, disk: v },
              })
            }
          />

          <ThresholdField
            label="디스크 IO (MB/s)"
            value={value.infra.diskIO}
            min={1}
            max={100000}
            unit="MB/s"
            hint="디스크 읽기/쓰기 500MB/s 이상일 때 알림"
            onChange={(v) =>
              onChange({
                ...value,
                infra: { ...value.infra, diskIO: v },
              })
            }
          />
        </div>

        <div className="grid2">
          <ThresholdField
            label="로드 애버리지"
            value={value.infra.loadAvg}
            min={1}
            max={128}
            hint="CPU 대비 작업이 4 이상일 때 알림 (I/O 병목 감지)"
            onChange={(v) =>
              onChange({
                ...value,
                infra: { ...value.infra, loadAvg: v },
              })
            }
          />
          <div />
        </div>
      </>
    );
  }

  if (tab === "network") {
    return (
      <>
        <div className="grid2">
          <ThresholdField
            label="TCP ESTABLISHED 연결 수"
            value={value.network.tcpEstablished}
            min={1}
            max={1000000}
            hint="활성 연결 수가 1000개 이상일 때 알림"
            onChange={(v) =>
              onChange({
                ...value,
                network: { ...value.network, tcpEstablished: v },
              })
            }
          />

          <ThresholdField
            label="TCP TIME_WAIT 연결 수"
            value={value.network.tcpTimeWait}
            min={1}
            max={1000000}
            hint="TIME_WAIT 상태가 500개 이상일 때 알림"
            onChange={(v) =>
              onChange({
                ...value,
                network: { ...value.network, tcpTimeWait: v },
              })
            }
          />
        </div>

        <div className="grid2">
          <ThresholdField
            label="TCP CLOSE_WAIT 연결 수"
            value={value.network.tcpCloseWait}
            min={1}
            max={1000000}
            hint="CLOSE_WAIT 상태가 100개 이상일 때 알림 (연결 누수 의심)"
            onChange={(v) =>
              onChange({
                ...value,
                network: { ...value.network, tcpCloseWait: v },
              })
            }
          />

          <ThresholdField
            label="네트워크 트래픽 In (MB/s)"
            value={value.network.netIn}
            min={1}
            max={100000}
            unit="MB/s"
            hint="수신 트래픽이 1000MB/s 이상일 때 알림 (DDoS 감지)"
            onChange={(v) =>
              onChange({
                ...value,
                network: { ...value.network, netIn: v },
              })
            }
          />
        </div>

        <div className="grid2">
          <ThresholdField
            label="네트워크 트래픽 Out (MB/s)"
            value={value.network.netOut}
            min={1}
            max={100000}
            unit="MB/s"
            hint="송신 트래픽이 1000MB/s 이상일 때 알림"
            onChange={(v) =>
              onChange({
                ...value,
                network: { ...value.network, netOut: v },
              })
            }
          />

          <ThresholdField
            label="인바운드 SYN 요청 수"
            value={value.network.inboundSyn}
            min={1}
            max={10000000}
            hint="초당 10000회 이상일 때 알림 (과도한 스캔/공격 감지)"
            onChange={(v) =>
              onChange({
                ...value,
                network: { ...value.network, inboundSyn: v },
              })
            }
          />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="grid2">
        <ThresholdField
          label="응답 시간 (ms)"
          value={value.external.responseMs}
          min={1}
          max={120000}
          unit="ms"
          hint="페이지 응답이 1000ms 이상일 때 알림 (사용자 체감 성능)"
          onChange={(v) =>
            onChange({
              ...value,
              external: { ...value.external, responseMs: v },
            })
          }
        />

        <ThresholdField
          label="HTTP 5xx 에러율 (%)"
          value={value.external.http5xxRate}
          min={0}
          max={100}
          unit="%"
          hint="서버 에러가 전체 요청의 5% 이상일 때 알림"
          onChange={(v) =>
            onChange({
              ...value,
              external: { ...value.external, http5xxRate: v },
            })
          }
        />
      </div>

      {/* 여기 핵심: grid2 안에 넣어서 체크가 왼쪽 컬럼에 딱 붙게 고정 */}
      <div className="grid2" style={{ marginTop: 10 }}>
        <div className="checkRowFull">
          <input
            type="checkbox"
            checked={!!value.external.healthCheck}
            onChange={(e) =>
              onChange({
                ...value,
                external: { ...value.external, healthCheck: e.target.checked },
              })
            }
          />

          <div className="checkTxt">
            <div className="checkTitle">가용성 체크 활성화</div>
            <div className="checkSub">
              서버가 다운되면 알림이 울려요 (Health Check)
            </div>
          </div>
        </div>

        <div />
      </div>
    </>
  );
}

function ContainerCard({ idx, container, onUpdate, onRemove }) {
  const [tab, setTab] = useState("infra");

  return (
    <div className="containerCard">
      <div className="containerHead">
        <div className="containerTitle">컨테이너 #{idx + 1}</div>
        <button
          type="button"
          className="iconBtn"
          aria-label="컨테이너 삭제"
          onClick={() => onRemove(container.id)}
          title="삭제"
        >
          🗑️
        </button>
      </div>

      <div className="nameBlock">
        <div className="fieldLabel">컨테이너 이름</div>
        <input
          className="numInput"
          type="text"
          value={container.name}
          placeholder="예: nginx-web-server"
          onChange={(e) => onUpdate(container.id, { name: e.target.value })}
        />
      </div>

      <SegTabs value={tab} onChange={setTab} items={TAB_ITEMS} />

      <HostThresholdForm
        tab={tab}
        value={container.thresholds}
        onChange={(next) => onUpdate(container.id, { thresholds: next })}
      />
    </div>
  );
}

export default function Alerts() {
  const [hostTab, setHostTab] = useState("infra");
  const [host, setHost] = useState(() => defaultHostThresholds());

  const [containers, setContainers] = useState([]);

  const hasContainers = containers.length > 0;

  const payload = useMemo(() => {
    return {
      hostThresholds: host,
      containerThresholds: containers.map((c) => ({
        id: c.id,
        name: c.name,
        thresholds: c.thresholds,
      })),
    };
  }, [host, containers]);

  function addContainer() {
    setContainers((prev) => [
      ...prev,
      {
        id: uid(),
        name: "",
        thresholds: defaultContainerThresholds(),
      },
    ]);
  }

  function updateContainer(id, patch) {
    setContainers((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch } : c))
    );
  }

  function removeContainer(id) {
    setContainers((prev) => prev.filter((c) => c.id !== id));
  }

  function onCancel() {
    setHost(defaultHostThresholds());
    setContainers([]);
    setHostTab("infra");
  }

  function onSave() {
    console.log("[알림 설정 저장]", payload);
    alert("설정이 저장됐다고 치자! (지금은 목업이라 콘솔에만 찍어놨어)");
  }

  return (
    <div className="alertsPage">
      <div className="alertsWrap">
        <div className="alertsTitle">알림 설정</div>
        <div className="alertsDesc">서버 모니터링 지표별 임계값을 설정합니다</div>

        <Panel
          icon="▦"
          title="호스트 임계값 설정"
          sub="서버 전체에 대한 모니터링 지표 별 임계값을 설정합니다"
        >
          <SegTabs value={hostTab} onChange={setHostTab} items={TAB_ITEMS} />
          <HostThresholdForm tab={hostTab} value={host} onChange={setHost} />
        </Panel>

        <Panel
          icon="▣"
          title="도커 컨테이너 임계값"
          sub="각 컨테이너별로 개별 알림 임계값을 설정합니다"
          right={
            <button type="button" className="btn btnBlack" onClick={addContainer}>
              + 컨테이너 추가
            </button>
          }
        >
          {hasContainers ? (
            <div className="dockerList">
              {containers.map((c, idx) => (
                <ContainerCard
                  key={c.id}
                  idx={idx}
                  container={c}
                  onUpdate={updateContainer}
                  onRemove={removeContainer}
                />
              ))}
            </div>
          ) : (
            <div className="dockerEmpty">
              <div className="cube">◻</div>
              <div style={{ fontWeight: 900 }}>설정된 컨테이너가 없습니다</div>
              <div style={{ fontSize: 12 }}>
                컨테이너를 추가하여 개별 임계값을 설정하세요
              </div>
            </div>
          )}
        </Panel>

        <div className="footerActions">
          <button type="button" className="btn" onClick={onCancel}>
            취소
          </button>
          <button type="button" className="btn btnPrimary" onClick={onSave}>
            설정 저장
          </button>
        </div>
      </div>
    </div>
  );
}
