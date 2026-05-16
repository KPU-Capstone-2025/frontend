import { useEffect, useMemo, useState } from "react";
import "./alerts.css";
import { getStoredSession } from "../../services/authStorage.js";
import { getAlertRules, getServers, updateAlertRules } from "../../services/monitoringApi.js";

const MB = 1024 * 1024;

const DEFAULT_RULES = {
  cpuThreshold: 80,
  memoryThreshold: 85,
  diskThreshold: 90,
  networkThresholdMb: 10,
  durationSeconds: 10,
};

function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function normalizeServerName(server) {
  return server?.name || server?.hostName || server?.serverName || server?.hostname || "";
}

function fromBackend(data) {
  if (!data) return DEFAULT_RULES;

  return {
    cpuThreshold: data.cpuThreshold ?? DEFAULT_RULES.cpuThreshold,
    memoryThreshold: data.memoryThreshold ?? DEFAULT_RULES.memoryThreshold,
    diskThreshold: data.diskThreshold ?? DEFAULT_RULES.diskThreshold,
    networkThresholdMb: Math.round((data.networkThreshold ?? 10 * MB) / MB),
    durationSeconds: data.durationSeconds ?? DEFAULT_RULES.durationSeconds,
  };
}

function toBackend(rules, { companyId, monitoringId, hostName }) {
  return {
    companyId: String(companyId || monitoringId || ""),
    monitoringId: monitoringId || undefined,
    hostName: hostName || undefined,
    cpuThreshold: Number(rules.cpuThreshold),
    memoryThreshold: Number(rules.memoryThreshold),
    diskThreshold: Number(rules.diskThreshold),
    networkThreshold: Number(rules.networkThresholdMb) * MB,
    durationSeconds: Number(rules.durationSeconds),
  };
}

function Field({ label, hint, value, onChange, min = 0, max = 100000, unit }) {
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
          step="1"
          onChange={(e) => onChange(clamp(e.target.value, min, max))}
        />
        {unit && <span className="unit">{unit}</span>}
        <span className="suffix">초과 시</span>
      </div>
      {hint && <div className="fieldHint">{hint}</div>}
    </div>
  );
}

function Panel({ icon, title, sub, children }) {
  return (
    <section className="panel">
      <div className="panelHead">
        <div className="panelTitleRow">
          <div className="panelIcon">{icon}</div>
          <div>
            <div className="panelTitle">{title}</div>
            {sub && <div className="panelSub">{sub}</div>}
          </div>
        </div>
      </div>
      <div className="cardInner">{children}</div>
    </section>
  );
}

function AppliedRules({ rules }) {
  const items = [
    ["CPU", `${rules.cpuThreshold}%`],
    ["메모리", `${rules.memoryThreshold}%`],
    ["디스크", `${rules.diskThreshold}%`],
    ["네트워크", `${rules.networkThresholdMb} MB/s`],
    ["지속 시간", `${rules.durationSeconds}초`],
  ];

  return (
    <div className="appliedRules">
      <div className="appliedRulesTitle">현재 적용된 임계치</div>
      <div className="appliedRulesList">
        {items.map(([label, value]) => (
          <div key={label} className="appliedRuleChip">
            {label}: <b>{value}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Alerts() {
  const session = getStoredSession();
  const companyId = session?.companyId || session?.id || "";
  const monitoringId = session?.monitoringId || "";

  const [servers, setServers] = useState([]);
  const [selectedServer, setSelectedServer] = useState("");
  const [rules, setRules] = useState(DEFAULT_RULES);
  const [original, setOriginal] = useState(DEFAULT_RULES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [error, setError] = useState("");

  const selectedLabel = selectedServer || "전체 서버";
  const hasChanged = useMemo(
    () => JSON.stringify(rules) !== JSON.stringify(original),
    [rules, original]
  );

  useEffect(() => {
    if (!companyId) return;
    getServers(companyId)
      .then((list) => {
        const normalized = Array.isArray(list) ? list : [];
        setServers(normalized.filter((item) => normalizeServerName(item)));
      })
      .catch(() => setServers([]));
  }, [companyId]);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setSaveMsg("");
    setError("");

    getAlertRules(companyId, { hostName: selectedServer || undefined })
      .then((data) => {
        const next = fromBackend(data);
        setRules(next);
        setOriginal(next);
      })
      .catch((err) => {
        setError(err?.message || "알림 설정을 불러오지 못했습니다.");
        setRules(DEFAULT_RULES);
        setOriginal(DEFAULT_RULES);
      })
      .finally(() => setLoading(false));
  }, [companyId, selectedServer]);

  function setRule(key, value) {
    setRules((prev) => ({ ...prev, [key]: value }));
  }

  function onCancel() {
    setRules(original);
    setError("");
    setSaveMsg("");
  }

  async function onSave() {
    if (!companyId && !monitoringId) {
      setError("로그인 정보가 없어 알림 설정을 저장할 수 없습니다.");
      return;
    }

    setSaving(true);
    setError("");
    setSaveMsg("");

    try {
      const payload = toBackend(rules, {
        companyId,
        monitoringId,
        hostName: selectedServer || undefined,
      });
      await updateAlertRules(payload);
      setOriginal(rules);
      setSaveMsg(`${selectedLabel} 임계치가 저장되었습니다. 장애 발생 시 알림 메일이 발송됩니다.`);
    } catch (err) {
      setError(err?.message || "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="alertsPage">
        <div className="alertsWrap">
          <div className="alertsTitle">알림 설정</div>
          <div className="alertsDesc">설정을 불러오는 중입니다...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="alertsPage">
      <div className="alertsWrap">
        <div className="alertsTitle">알림 설정</div>
        <div className="alertsDesc">
         서버 리소스 사용량이 기준을 초과하면 알림을 받을 수 있습니다.
        </div>

        {servers.length > 0 && (
          <div className="serverTabs">
            <button
              type="button"
              className={`serverTab ${selectedServer === "" ? "isOn" : ""}`}
              onClick={() => setSelectedServer("")}
            >
              전체
            </button>
            {servers.map((server) => {
              const name = normalizeServerName(server);
              return (
                <button
                  key={server.id || name}
                  type="button"
                  className={`serverTab ${selectedServer === name ? "isOn" : ""}`}
                  onClick={() => setSelectedServer(name)}
                >
                  🖥️ {name}
                </button>
              );
            })}
          </div>
        )}

        {error && <div className="submitError">{error}</div>}
        {saveMsg && <div className="saveSuccess">{saveMsg}</div>}
        <AppliedRules rules={original} />

        <Panel icon="🚨" title={`호스트 서버 임계값 — ${selectedLabel}`} sub="CPU · 메모리 · 디스크 · 네트워크 초과 시 알림">
          <div className="grid2">
            <Field
              label="CPU 사용률"
              unit="%"
              min={1}
              max={100}
              hint="CPU 사용률이 이 수치를 넘으면 알림"
              value={rules.cpuThreshold}
              onChange={(v) => setRule("cpuThreshold", v)}
            />
            <Field
              label="메모리 사용률"
              unit="%"
              min={1}
              max={100}
              hint="메모리 사용률이 이 수치를 넘으면 알림"
              value={rules.memoryThreshold}
              onChange={(v) => setRule("memoryThreshold", v)}
            />
          </div>
          <div className="grid2">
            <Field
              label="디스크 사용량"
              unit="%"
              min={1}
              max={100}
              hint="디스크 사용률이 이 수치를 넘으면 알림"
              value={rules.diskThreshold}
              onChange={(v) => setRule("diskThreshold", v)}
            />
            <Field
              label="네트워크 트래픽"
              unit="MB/s"
              min={1}
              max={100000}
              hint="수신+송신 트래픽 합산 기준"
              value={rules.networkThresholdMb}
              onChange={(v) => setRule("networkThresholdMb", v)}
            />
          </div>
          <div className="grid1 thresholdSingle">
            <Field
              label="지속 시간"
              unit="초"
              min={1}
              max={3600}
              hint="임계값 초과가 이 시간 이상 유지되면 알림"
              value={rules.durationSeconds}
              onChange={(v) => setRule("durationSeconds", v)}
            />
          </div>
        </Panel>

        <div className="footerActions">
          <button type="button" className="btn" onClick={onCancel} disabled={saving || !hasChanged}>
            취소
          </button>
          <button type="button" className="btn btnPrimary" onClick={onSave} disabled={saving || (!companyId && !monitoringId)}>
            {saving ? "저장 중..." : hasChanged ? "임계치 저장" : "저장됨"}
          </button>
        </div>
      </div>
    </div>
  );
}
