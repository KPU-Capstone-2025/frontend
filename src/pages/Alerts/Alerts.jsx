import { useEffect, useState } from "react";
import "./alerts.css";
import { getStoredSession } from "../../services/authStorage.js";
import { getAlertRules, updateAlertRules } from "../../services/monitoringApi.js";

const MB = 1024 * 1024;

function defaultSettings() {
  return {
    cpu: 80,
    mem: 85,
    disk: 90,
    diskIoMb: 100,
    userCount: 10,
    netInMb: 10,
    netOutMb: 10,
    duration: 10,
  };
}

function fromBackend(data) {
  if (!data) return defaultSettings();
  return {
    cpu: data.cpuThreshold ?? 80,
    mem: data.memoryThreshold ?? 85,
    disk: data.diskThreshold ?? 90,
    diskIoMb: Math.round((data.diskIoThreshold ?? 100 * MB) / MB),
    userCount: data.userCountThreshold ?? 10,
    netInMb: Math.round((data.networkInThreshold ?? 10 * MB) / MB),
    netOutMb: Math.round((data.networkOutThreshold ?? 10 * MB) / MB),
    duration: data.durationSeconds ?? 10,
  };
}

function toBackend(settings, companyId) {
  return {
    companyId: String(companyId),
    cpuThreshold: Number(settings.cpu),
    memoryThreshold: Number(settings.mem),
    diskThreshold: Number(settings.disk),
    diskIoThreshold: Number(settings.diskIoMb) * MB,
    userCountThreshold: Number(settings.userCount),
    networkInThreshold: Number(settings.netInMb) * MB,
    networkOutThreshold: Number(settings.netOutMb) * MB,
    durationSeconds: Number(settings.duration),
  };
}

function clamp(v, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function Field({ label, hint, value, onChange, min = 0, max = 100000, step = 1, unit }) {
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
          onChange={(e) => onChange(clamp(e.target.value, min, max))}
        />
        {unit && <span className="unit">{unit}</span>}
        <span className="suffix">이상</span>
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

export default function Alerts() {
  const session = getStoredSession();
  const companyId = session?.companyId || session?.id || "";

  const [settings, setSettings] = useState(defaultSettings());
  const [original, setOriginal] = useState(defaultSettings());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    getAlertRules(companyId)
      .then((data) => {
        const s = fromBackend(data);
        setSettings(s);
        setOriginal(s);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [companyId]);

  function set(key, val) {
    setSettings((prev) => ({ ...prev, [key]: val }));
  }

  function onCancel() {
    setSettings(original);
    setSaveMsg("");
    setError("");
  }

  async function onSave() {
    if (!companyId) return;
    setSaving(true);
    setSaveMsg("");
    setError("");
    try {
      await updateAlertRules(toBackend(settings, companyId));
      setOriginal(settings);
      setSaveMsg("저장되었습니다.");
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
        <div className="alertsDesc">임계값을 초과하면 Prometheus가 알림을 발송합니다.</div>

        {error && <div className="submitError">{error}</div>}
        {saveMsg && <div className="saveSuccess">{saveMsg}</div>}

        <Panel icon="▦" title="리소스 임계값" sub="CPU · 메모리 · 디스크 초과 시 알림">
          <div className="grid2">
            <Field
              label="CPU 사용률"
              unit="%" min={1} max={100}
              hint="이 수치를 넘으면 알림"
              value={settings.cpu}
              onChange={(v) => set("cpu", v)}
            />
            <Field
              label="메모리 사용률"
              unit="%" min={1} max={100}
              hint="이 수치를 넘으면 알림"
              value={settings.mem}
              onChange={(v) => set("mem", v)}
            />
          </div>
          <div className="grid2">
            <Field
              label="디스크 사용량"
              unit="%" min={1} max={100}
              hint="이 수치를 넘으면 알림"
              value={settings.disk}
              onChange={(v) => set("disk", v)}
            />
            <Field
              label="디스크 I/O"
              unit="MB/s" min={1} max={100000}
              hint="읽기+쓰기 합산 기준"
              value={settings.diskIoMb}
              onChange={(v) => set("diskIoMb", v)}
            />
          </div>
        </Panel>

        <Panel icon="▣" title="접속자 · 네트워크" sub="동시 접속자 수 및 네트워크 트래픽 초과 시 알림">
          <div className="grid2">
            <Field
              label="동시 접속자 수"
              unit="명" min={1} max={10000}
              hint="로그인 사용자 수 기준"
              value={settings.userCount}
              onChange={(v) => set("userCount", v)}
            />
            <Field
              label="지속 시간"
              unit="초" min={1} max={3600}
              hint="임계값 초과가 이 시간 지속되면 알림"
              value={settings.duration}
              onChange={(v) => set("duration", v)}
            />
          </div>
          <div className="grid2">
            <Field
              label="네트워크 수신량"
              unit="MB/s" min={1} max={100000}
              hint="인바운드 트래픽 기준"
              value={settings.netInMb}
              onChange={(v) => set("netInMb", v)}
            />
            <Field
              label="네트워크 송신량"
              unit="MB/s" min={1} max={100000}
              hint="아웃바운드 트래픽 기준"
              value={settings.netOutMb}
              onChange={(v) => set("netOutMb", v)}
            />
          </div>
        </Panel>

        <div className="footerActions">
          <button type="button" className="btn" onClick={onCancel} disabled={saving}>
            취소
          </button>
          <button type="button" className="btn btnPrimary" onClick={onSave} disabled={saving || !companyId}>
            {saving ? "저장 중..." : "설정 저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
