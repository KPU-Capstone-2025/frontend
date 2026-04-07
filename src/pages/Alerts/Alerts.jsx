import { useState, useEffect } from "react";
import "./alerts.css";
import { getStoredSession } from "../../services/authStorage.js";
import { updateAlertRules } from "../../services/monitoringApi.js"; 

function ThresholdField({ label, hint, value, onChange, min = 0, max = 100, unit }) {
  return (
    <div className="field">
      <div className="fieldLabel">{label}</div>
      <div className="inputRow">
        <input className="numInput" type="number" value={value} min={min} max={max} onChange={e => onChange(Number(e.target.value))} />
        {unit && <span className="unit">{unit}</span>}
      </div>
      {hint && <div className="fieldHint">{hint}</div>}
    </div>
  );
}

export default function Alerts() {
  const session = getStoredSession();
  const monitoringId = session?.monitoringId;

  const [rules, setRules] = useState({ cpuThreshold: 80, memoryThreshold: 85, networkThreshold: 10485760, durationSeconds: 10 });
  const [saveStatus, setSaveStatus] = useState(null); // 저장 성공 여부 메시지

  const onSave = async () => {
    if (!monitoringId) return alert("로그인 정보가 없습니다.");
    try {
      setSaveStatus({ type: 'loading', msg: "설정을 AWS 서버에 동기화 중입니다..." });
      await updateAlertRules({ companyId: monitoringId, ...rules });
      setSaveStatus({ type: 'success', msg: "✅ 모니터링 서버에 임계치가 설정되었습니다! 이제 장애 발생 시 메일로 알림이 발송됩니다." });
      
      // 5초 뒤 성공 메시지 숨김
      setTimeout(() => setSaveStatus(null), 5000);
    } catch (err) { 
      setSaveStatus({ type: 'error', msg: "업데이트 실패: " + err.message });
    }
  };

  return (
    <div className="alertsPage">
      <div className="alertsWrap">
        <div className="alertsTitle">알림 임계치 설정</div>
        <div className="alertsDesc">지표별 임계값을 설정하여 장애 발생 시 AI 보고를 이메일로 받습니다.</div>

        {/* 🌟 초기 설정 경고 메시지 */}
        <div style={{ background: '#fff3cd', border: '1px solid #ffeeba', padding: '15px', borderRadius: '8px', marginBottom: '20px', color: '#856404' }}>
          <strong>⚠️ 주의:</strong> 최초 가입 시 임계치가 설정되어 있지 않아 알람이 비활성화 상태입니다. 모니터링을 시작하려면 <strong>반드시 아래 설정을 저장</strong>해주세요.
        </div>

        {/* 🌟 저장 상태 알림창 */}
        {saveStatus && (
          <div style={{ 
            background: saveStatus.type === 'success' ? '#d4edda' : saveStatus.type === 'error' ? '#f8d7da' : '#e2e3e5', 
            color: saveStatus.type === 'success' ? '#155724' : saveStatus.type === 'error' ? '#721c24' : '#383d41',
            padding: '15px', borderRadius: '8px', marginBottom: '20px', fontWeight: 'bold' 
          }}>
            {saveStatus.msg}
          </div>
        )}

        <section className="panel">
          <div className="panelHead">
            <div className="panelTitleRow">
              <div className="panelIcon">🚨</div>
              <div><div className="panelTitle">호스트 서버 임계값</div></div>
            </div>
          </div>
          <div className="cardInner">
            <div className="grid2">
              <ThresholdField label="CPU 사용률" value={rules.cpuThreshold} unit="%" hint="이 수치 초과 시 알람 발송" onChange={v => setRules({...rules, cpuThreshold: v})} />
              <ThresholdField label="메모리 사용률" value={rules.memoryThreshold} unit="%" hint="이 수치 초과 시 알람 발송" onChange={v => setRules({...rules, memoryThreshold: v})} />
            </div>
            <div className="grid2" style={{ marginTop: 20 }}>
              <ThresholdField label="네트워크 한계" value={rules.networkThreshold} unit="Bytes" hint="트래픽 과부하 기준치" onChange={v => setRules({...rules, networkThreshold: v})} />
              <ThresholdField label="지속 시간" value={rules.durationSeconds} unit="초" hint="해당 수치가 이 시간 동안 유지될 때 알람 발송" onChange={v => setRules({...rules, durationSeconds: v})} />
            </div>
          </div>
        </section>
        <div className="footerActions">
          <button className="btn btnPrimary" onClick={onSave}>설정 저장 및 알림 활성화</button>
        </div>
      </div>
    </div>
  );
}