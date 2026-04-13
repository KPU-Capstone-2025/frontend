import { useEffect, useMemo, useState } from "react";
import "./agentInstall.css";
import { getStoredSession, buildCompanyDisplayName } from "../../services/authStorage.js";
import { getAgentDestination } from "../../services/monitoringApi.js";

/**
 * [수정사항]
 * 1. collectorUrl의 http:// 중복 방지 로직 적용
 * 2. 도메인 data.monittoring.co.kr 기반의 깔끔한 명령어 생성
 */
function CopyButton({ text, label = "복사", className = "", disabled = false }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    if (!text || disabled) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch (error) {
      alert("복사에 실패했습니다.");
    }
  }
  return (
    <button type="button" className={`agentBtn ${copied ? "agentBtn--done" : ""} ${className}`} onClick={handleCopy} disabled={disabled}>
      {copied ? "복사 완료" : label}
    </button>
  );
}

function SectionCard({ icon, title, sub, right, children }) {
  return (
    <section className="agentCard">
      <div className="agentCard__head">
        <div className="agentCard__titleWrap">
          <div className="agentCard__icon">{icon}</div>
          <div>
            <div className="agentCard__title">{title}</div>
            {sub ? <div className="agentCard__sub">{sub}</div> : null}
          </div>
        </div>
        {right ? <div className="agentCard__actions">{right}</div> : null}
      </div>
      <div className="agentCard__body">{children}</div>
    </section>
  );
}

function CodeBlock({ code, copyLabel = "전체 복사", disabled = false }) {
  return (
    <div className="codeBlockWrap">
      <pre className="codeBlock"><code>{code}</code></pre>
      <div className="codeBlock__actions">
        <CopyButton text={code} label={copyLabel} className="agentBtn--primary" disabled={disabled} />
      </div>
    </div>
  );
}

export default function AgentInstall() {
  const session = getStoredSession();
  const companyId = session?.id;
  const companyName = buildCompanyDisplayName(session);

  const [agentInfo, setAgentInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadAgentInfo() {
      if (!companyId) {
        setError("로그인 정보가 없습니다.");
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const data = await getAgentDestination(companyId);
        setAgentInfo(data); 
      } catch (err) {
        setError("설치 정보를 불러오지 못했습니다. 서버 상태를 확인하세요.");
      } finally {
        setLoading(false);
      }
    }
    loadAgentInfo();
  }, [companyId]);

  const monitoringId = agentInfo?.monitoringId || "불러오는 중...";
  const collectorUrl = agentInfo?.collectorUrl || "data.monittoring.co.kr:80";

  const dockerRunCommand = useMemo(() => {
    return [
      "sudo docker run -d \\",
      "  --name metric-agent \\",
      "  --restart always \\",
      "  --privileged \\",
      "  -v /var/run/docker.sock:/var/run/docker.sock \\",
      "  -v /var/log:/var/log \\",
      "  -v /proc:/host/proc:ro \\",
      "  -v /sys:/host/sys:ro \\",
      `  -e MONITORING_ID="${monitoringId}" \\`,
      `  -e COLLECTOR_URL="${collectorUrl.replace("http://", "")}" \\`,
      "  kimhongseok/metric-agent:latest",
    ].join("\n");
  }, [collectorUrl, monitoringId]);

  const curlCommand = useMemo(() => {
    return [
      "curl -fLO http://agent.monittoring.co.kr/metric-agent",
      "chmod +x metric-agent",
      `export MONITORING_ID="${monitoringId}"`,
      `export COLLECTOR_URL="${collectorUrl.replace("http://", "")}"`,
      "sudo -E nohup ./metric-agent > metric.log 2>&1 &",
    ].join("\n");
  }, [collectorUrl, monitoringId]);

  return (
    <div className="agentPage">
      <div className="agentWrap">
        <div className="agentHero">
          <div className="agentHero__left">
            <div className="agentHero__eyebrow">Metric Agent · 설치 가이드</div>
            <h2 className="agentHero__title">에이전트 설치 명령어가 자동 생성되었습니다</h2>
            <p className="agentHero__desc">가입하신 기업 전용 ID와 수집 서버 주소가 포함되어 있습니다.</p>
          </div>
          <div className="agentHero__right">
            <div className="statusCard">
              <div className="statusCard__top">
                <span className="statusCard__dot" />
                {loading ? "정보 불러오는 중" : "준비 완료"}
              </div>
              <div className="statusCard__text">
                {companyName}<br />
                {error ? <span style={{color: 'red'}}>{error}</span> : "명령어를 복사하여 서버에서 실행하세요."}
              </div>
            </div>
          </div>
        </div>

        <SectionCard icon="🪪" title="발급된 인증 정보" sub="에이전트 인증에 사용되는 고유 값입니다.">
          <div className="installInfo">
            <div className="installInfo__text"><strong>MONITORING_ID:</strong> {monitoringId}</div>
            <div className="installInfo__text"><strong>COLLECTOR_URL:</strong> {collectorUrl}</div>
          </div>
        </SectionCard>

        <SectionCard icon="🐳" title="방법 1. Docker로 실행 (권장)" sub="가장 빠르고 안정적인 설치 방법입니다." right={<span className="agentChip">권장</span>}>
          <div className="stepList">
            <div className="stepItem">
              <div className="stepItem__num">1</div>
              <div className="stepItem__body">
                <div className="stepItem__title">명령어 실행</div>
                <CodeBlock code={dockerRunCommand} disabled={loading || !!error} />
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard icon="⌨️" title="방법 2. 바이너리 직접 실행" sub="Docker를 사용할 수 없는 환경에서 사용합니다.">
          <div className="stepList">
            <div className="stepItem">
              <div className="stepItem__num">1</div>
              <div className="stepItem__body">
                <div className="stepItem__title">스크립트 실행</div>
                <CodeBlock code={curlCommand} disabled={loading || !!error} />
              </div>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}