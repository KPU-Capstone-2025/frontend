import "./logs.css";
import { getStoredSession, buildCompanyDisplayName } from "../../services/authStorage.js";

export default function Logs() {
  const session = getStoredSession();
  const companyId = session?.companyId || "-";
  const companyName = buildCompanyDisplayName(session);

  return (
    <div className="logsPage">
      <div className="logsWrap">
        <div className="logsTitle">로그 분석</div>
        <div className="logsDesc">
          업로드된 백엔드 코드 기준으로는 로그 조회 API가 아직 포함되어 있지 않아,
          현재 페이지는 연동 대기 상태로 표시했습니다.
        </div>

        <section className="logPanel" style={{ marginTop: 12 }}>
          <div className="logPanelHead">
            <div className="logPanelLeft">
              <div className="panelIconMini">ℹ️</div>
              <div className="panelText">
                <div className="panelH">현재 상태</div>
                <div className="panelP">
                  로그인된 회사 기준 정보만 표시하고 있습니다.
                </div>
              </div>
            </div>
          </div>

          <div style={{ padding: "18px 4px 6px", lineHeight: 1.8, color: "#475467" }}>
            <div><strong>회사명:</strong> {companyName}</div>
            <div><strong>companyId:</strong> {companyId}</div>
            <div><strong>사유:</strong> backend zip 안에는 /api/monitoring/logs, /api/auth/monitoring/companies 구현이 없습니다.</div>
            <div><strong>다음 단계:</strong> 백엔드에 로그 조회 API가 추가되면 그 스펙에 맞춰 바로 붙이면 됩니다.</div>
          </div>
        </section>
      </div>
    </div>
  );
}