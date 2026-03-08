import { useEffect, useMemo, useState } from "react";
import "./agentInstall.css";
import { getStoredSession, buildCompanyDisplayName } from "../../services/authStorage.js";
import { getAgentDestination } from "../../services/monitoringApi.js";

function CopyButton({ text, label = "복사", className = "", disabled = false }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!text || disabled) return;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch (error) {
      console.error("복사 실패:", error);
      alert("복사에 실패했습니다.");
    }
  }

  return (
    <button
      type="button"
      className={`agentBtn ${copied ? "agentBtn--done" : ""} ${className}`}
      onClick={handleCopy}
      disabled={disabled}
    >
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
      <pre className="codeBlock">
        <code>{code}</code>
      </pre>

      <div className="codeBlock__actions">
        <CopyButton
          text={code}
          label={copyLabel}
          className="agentBtn--primary"
          disabled={disabled}
        />
      </div>
    </div>
  );
}

export default function AgentInstall() {
  const session = getStoredSession();
  const companyId = session?.companyId;
  const companyName = buildCompanyDisplayName(session);

  const [agentInfo, setAgentInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    async function loadAgentInfo() {
      if (!companyId) {
        setError("로그인된 회사 정보가 없습니다.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");
        const data = await getAgentDestination(companyId);
        if (!alive) return;
        setAgentInfo(data);
      } catch (err) {
        if (!alive) return;
        setError(err?.message || "에이전트 설치 정보를 불러오지 못했습니다.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadAgentInfo();

    return () => {
      alive = false;
    };
  }, [companyId]);

  const dockerPullCommand = useMemo(() => {
    return `sudo docker pull kimhongseok/metric-agent:latest`;
  }, []);

  const monitoringId = agentInfo?.apiKey || "불러오는 중";
  const collectorUrl = agentInfo?.collectorUrl || "불러오는 중";

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
      `  -e COLLECTOR_URL="${collectorUrl}" \\`,
      "  kimhongseok/metric-agent:latest",
    ].join("\n");
  }, [collectorUrl, monitoringId]);

  const curlCommand = useMemo(() => {
    return [
      "curl -fLO http://agent.monittoring.co.kr/metric-agent",
      "chmod +x metric-agent",
      `export MONITORING_ID="${monitoringId}"`,
      `export COLLECTOR_URL="${collectorUrl}"`,
      "sudo -E nohup ./metric-agent > metric.log 2>&1 &",
    ].join("\n");
  }, [collectorUrl, monitoringId]);

  return (
    <div className="agentPage">
      <div className="agentWrap">
        <div className="agentHero">
          <div className="agentHero__left">
            <div className="agentHero__eyebrow">Metric Agent · 설치 가이드</div>
            <h2 className="agentHero__title">에이전트 설치 방법을 확인하고 바로 실행하세요</h2>
            <p className="agentHero__desc">
              로그인한 회사 기준으로 발급된 MONITORING_ID와 COLLECTOR_URL을 자동으로 불러옵니다.
            </p>
          </div>

          <div className="agentHero__right">
            <div className="statusCard">
              <div className="statusCard__top">
                <span className="statusCard__dot" />
                {loading ? "설치 정보 불러오는 중" : "설치 정보 준비 완료"}
              </div>
              <div className="statusCard__text">
                {companyName}
                <br />
                {error ? error : `MONITORING_ID와 COLLECTOR_URL이 자동 반영됩니다.`}
              </div>
            </div>
          </div>
        </div>

        <SectionCard
          icon="🪪"
          title="현재 발급 정보"
          sub="백엔드의 /api/agent/{companyId} 응답값을 그대로 사용합니다."
        >
          <div className="installInfo">
            <div className="installInfo__title">회사 정보</div>
            <div className="installInfo__text">회사: {companyName}</div>
            <div className="installInfo__text">companyId: {companyId || "-"}</div>
            <div className="installInfo__text">MONITORING_ID: {monitoringId}</div>
            <div className="installInfo__text">COLLECTOR_URL: {collectorUrl}</div>
          </div>
        </SectionCard>

        <SectionCard
          icon="🐳"
          title="방법 1. Docker 이미지로 실행 (권장)"
          sub="서버에 Docker가 설치되어 있다면 가장 간단하게 실행할 수 있습니다."
          right={<span className="agentChip">권장</span>}
        >
          <div className="installInfo">
            <div className="installInfo__title">설명</div>
            <div className="installInfo__text">
              Docker 이미지를 내려받은 뒤 컨테이너를 실행하면 서버 자원, 시스템 로그,
              Docker 환경 정보를 함께 수집할 수 있습니다.
            </div>
          </div>

          <div className="stepList">
            <div className="stepItem">
              <div className="stepItem__num">1</div>
              <div className="stepItem__body">
                <div className="stepItem__title">이미지 다운로드</div>
                <div className="stepItem__desc">최신 Metric Agent 이미지를 서버에 내려받습니다.</div>
                <CodeBlock code={dockerPullCommand} copyLabel="이미지 다운로드 복사" />
              </div>
            </div>

            <div className="stepItem">
              <div className="stepItem__num">2</div>
              <div className="stepItem__body">
                <div className="stepItem__title">에이전트 실행</div>
                <div className="stepItem__desc">
                  백엔드에서 내려준 MONITORING_ID와 COLLECTOR_URL이 자동으로 반영됩니다.
                </div>
                <CodeBlock
                  code={dockerRunCommand}
                  copyLabel="Docker 실행 명령 복사"
                  disabled={loading || !!error}
                />
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          icon="⌨️"
          title="방법 2. curl 명령어로 설치 및 실행"
          sub="Docker가 없는 환경에서는 실행 파일을 내려받아 직접 실행할 수 있습니다."
        >
          <div className="installInfo">
            <div className="installInfo__title">설명</div>
            <div className="installInfo__text">
              아래 명령어를 그대로 실행하면 에이전트 다운로드, 권한 부여, 환경 변수 설정,
              실행까지 한 번에 진행할 수 있습니다.
            </div>
          </div>

          <div className="stepList">
            <div className="stepItem">
              <div className="stepItem__num">1</div>
              <div className="stepItem__body">
                <div className="stepItem__title">에이전트 실행</div>
                <div className="stepItem__desc">
                  백엔드에서 내려준 MONITORING_ID와 COLLECTOR_URL을 그대로 사용합니다.
                </div>
                <CodeBlock
                  code={curlCommand}
                  copyLabel="curl 설치 명령 복사"
                  disabled={loading || !!error}
                />
              </div>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}