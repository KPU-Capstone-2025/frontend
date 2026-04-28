import { useState, useEffect } from "react";
import "./alerts.css";
import { getStoredSession } from "../../services/authStorage.js";
import { updateAlertRules, getServers } from "../../services/monitoringApi.js";

const STORAGE_KEY = "monittoring_alert_rules";
const DEFAULT_RULES = {
  cpuThreshold: 80,
  memoryThreshold: 85,
  diskThreshold: 90,
  networkThreshold: 10485760,
  durationSeconds: 10,
};

function storageKey(serverName) {
  return serverName ? `${STORAGE_KEY}_${serverName}` : STORAGE_KEY;
}

function loadSavedRules(serverName) {
  try {
    const raw = localStorage.getItem(storageKey(serverName));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function ThresholdField({ label, hint, value, onChange, min = 0, max = 100, unit }) {
  const handleChange = (event) => {
    onChange(event.target.value.replace(/[^\d]/g, ""));
  };

  return (
    <div className="field">
      <div className="fieldLabel">{label}</div>
      <div className="inputRow">
        <input
          className="numInput"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value}
          min={min}
          max={max}
          onChange={handleChange}
        />
        {unit && <span className="unit">{unit}</span>}
      </div>
      {hint && <div className="fieldHint">{hint}</div>}
    </div>
  );
}

function normalizeRules(rules) {
  const entries = Object.entries(rules);
  if (entries.some(([, value]) => String(value).trim() === "")) return null;

  return entries.reduce((acc, [key, value]) => {
    acc[key] = Number(value);
    return acc;
  }, {});
}

function CurrentRulesCard({ saved }) {
  const items = [
    { label: "CPU", value: `${saved.cpuThreshold}%` },
    { label: "메모리", value: `${saved.memoryThreshold}%` },
    { label: "디스크", value: `${saved.diskThreshold}%` },
    { label: "네트워크", value: `${(saved.networkThreshold / 1024 / 1024).toFixed(1)} MB/s` },
    { label: "지속 시간", value: `${saved.durationSeconds}초` },
  ];
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "14px 16px", marginBottom: "20px" }}>
      <div style={{ fontWeight: 900, color: "var(--good)", marginBottom: "10px", fontSize: "13px" }}>✅ 현재 적용된 임계치</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        {items.map(({ label, value }) => (
          <div key={label} style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "8px", padding: "6px 12px", fontSize: "12px", color: "var(--text)", fontWeight: 800 }}>
            {label}: <span style={{ color: "var(--good)" }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Alerts() {
  const session = getStoredSession();
  const monitoringId = session?.monitoringId;
  const companyId = session?.id;

  const [servers, setServers] = useState([]);
  const [selectedServer, setSelectedServer] = useState(null);
  const [savedRules, setSavedRules] = useState(() => loadSavedRules(null));
  const [rules, setRules] = useState(() => loadSavedRules(null) ?? DEFAULT_RULES);
  const [saveStatus, setSaveStatus] = useState(null);

  useEffect(() => {
    if (!companyId) return;
    getServers(companyId).then(list => setServers(Array.isArray(list) ? list : [])).catch(() => {});
  }, [companyId]);

  useEffect(() => {
    const loaded = loadSavedRules(selectedServer);
    setSavedRules(loaded);
    setRules(loaded ?? DEFAULT_RULES);
  }, [selectedServer]);

  // 다른 탭에서 저장 시 동기화
  useEffect(() => {
    const onStorage = () => {
      const loaded = loadSavedRules(selectedServer);
      if (loaded) { setSavedRules(loaded); setRules(loaded); }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [selectedServer]);

  const onSave = async () => {
    if (!monitoringId) return alert("로그인 정보가 없습니다.");
    const normalizedRules = normalizeRules(rules);
    if (!normalizedRules) {
      alert("임계값을 모두 입력해주세요.");
      return;
    }

    try {
      setSaveStatus({ type: "loading", msg: "설정을 AWS 서버에 동기화 중입니다..." });
      await updateAlertRules({ companyId: monitoringId, hostName: selectedServer ?? undefined, ...normalizedRules });
      localStorage.setItem(storageKey(selectedServer), JSON.stringify(normalizedRules));
      setRules(normalizedRules);
      setSavedRules({ ...normalizedRules });
      const targetDesc = selectedServer ? `[${selectedServer}]` : "전체";
      setSaveStatus({ type: "success", msg: `${targetDesc} 모니터링 서버에 임계치가 적용되었습니다. 장애 발생 시 이메일로 알림이 발송됩니다.` });
      setTimeout(() => setSaveStatus(null), 4000);
    } catch (err) {
      setSaveStatus({ type: "error", msg: "업데이트 실패: " + err.message });
    }
  };

  return (
    <div className="alertsPage">
      <div className="alertsWrap">
        <div className="alertsTitle">알림 임계치 설정</div>
        <div className="alertsDesc">지표별 임계값을 설정하여 장애 발생 시 AI 보고를 이메일로 받습니다.</div>

        {servers.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>서버 선택</span>
            <button onClick={() => setSelectedServer(null)}
              style={{ padding: "6px 16px", borderRadius: 20, border: "1px solid", fontSize: 13, cursor: "pointer", background: !selectedServer ? "#146ef5" : "var(--surface2)", color: !selectedServer ? "#fff" : "var(--text)", borderColor: !selectedServer ? "#146ef5" : "var(--border)" }}>
              전체
            </button>
            {servers.map(s => (
              <button key={s.id} onClick={() => setSelectedServer(s.name)}
                style={{ padding: "6px 16px", borderRadius: 20, border: "1px solid", fontSize: 13, cursor: "pointer", background: selectedServer === s.name ? "#146ef5" : "var(--surface2)", color: selectedServer === s.name ? "#fff" : "var(--text)", borderColor: selectedServer === s.name ? "#146ef5" : "var(--border)" }}>
                🖥️ {s.name}
              </button>
            ))}
          </div>
        )}

        {/* 미설정 경고 — 한 번도 저장한 적 없을 때만 표시 */}
        {!savedRules && (
          <div style={{ background: "var(--surface)", border: "1px solid var(--warn)", padding: "14px 16px", borderRadius: "10px", marginBottom: "18px", color: "var(--warn)", fontSize: "13px" }}>
            <strong>⚠️ 임계치가 아직 설정되지 않았습니다.</strong> 모니터링을 시작하려면 아래 값을 확인하고 저장해주세요.
          </div>
        )}

        {/* 현재 적용 임계치 요약 */}
        {savedRules && <CurrentRulesCard saved={savedRules} />}

        {/* 저장 결과 알림 */}
        {saveStatus && (
          <div style={{
            background: "var(--surface)",
            border: `1px solid ${saveStatus.type === "success" ? "var(--good)" : saveStatus.type === "error" ? "var(--error)" : "var(--border)"}`,
            color: saveStatus.type === "success" ? "var(--good)" : saveStatus.type === "error" ? "var(--error)" : "var(--muted)",
            padding: "13px 16px", borderRadius: "10px", marginBottom: "18px", fontWeight: 800, fontSize: "13px",
          }}>
            {saveStatus.msg}
          </div>
        )}

        <section className="panel">
          <div className="panelHead">
            <div className="panelTitleRow">
              <div className="panelIcon">🚨</div>
              <div><div className="panelTitle">호스트 서버 임계값{selectedServer ? ` — ${selectedServer}` : " — 전체"}</div></div>
            </div>
          </div>
          <div className="cardInner">
            <div className="grid2">
              <ThresholdField label="CPU 사용률" value={rules.cpuThreshold} unit="%" hint="이 수치 초과 시 알람 발송" onChange={v => setRules({ ...rules, cpuThreshold: v })} />
              <ThresholdField label="메모리 사용률" value={rules.memoryThreshold} unit="%" hint="이 수치 초과 시 알람 발송" onChange={v => setRules({ ...rules, memoryThreshold: v })} />
            </div>
            <div className="grid2" style={{ marginTop: 20 }}>
              <ThresholdField label="디스크 사용량" value={rules.diskThreshold} unit="%" hint="저장 공간 부족 알람 기준" onChange={v => setRules({ ...rules, diskThreshold: v })} />
              <ThresholdField label="지속 시간" value={rules.durationSeconds} unit="초" hint="해당 수치가 이 시간 동안 유지될 때 알람 발송" onChange={v => setRules({ ...rules, durationSeconds: v })} />
            </div>
            <div className="grid1" style={{ marginTop: 20 }}>
              <ThresholdField label="네트워크 한계" value={rules.networkThreshold} unit="Bytes" hint="트래픽 과부하 기준치 (In/Out 합계)" onChange={v => setRules({ ...rules, networkThreshold: v })} />
            </div>
          </div>
        </section>

        <div className="footerActions">
          <button className="btn btnPrimary" onClick={onSave} disabled={saveStatus?.type === "loading"}>
            {saveStatus?.type === "loading" ? "동기화 중..." : savedRules ? "임계치 수정 저장" : "설정 저장 및 알림 활성화"}
          </button>
        </div>
      </div>
    </div>
  );
}
