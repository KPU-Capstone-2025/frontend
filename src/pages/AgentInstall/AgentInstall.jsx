import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./agentInstall.css";
import { getStoredSession, buildCompanyDisplayName } from "../../services/authStorage.js";
import { getAgentDestination, getServers } from "../../services/monitoringApi.js";

function CopyButton({ text, label = "복사", className = "", disabled = false }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    if (!text || disabled) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
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

function buildDockerCommand(monitoringId, collectorUrl, serverName) {
  const collector = collectorUrl.replace("http://", "");
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
    `  -e COLLECTOR_URL="${collector}" \\`,
    serverName ? `  -e SERVER_NAME="${serverName}" \\` : null,
    "  kimhongseok/metric-agent:latest",
  ].filter(Boolean).join("\n");
}

function buildCurlCommand(monitoringId, collectorUrl, serverName) {
  const collector = collectorUrl.replace("http://", "");
  return [
    "curl -fLO http://agent.monittoring.co.kr/metric-agent",
    "chmod +x metric-agent",
    `export MONITORING_ID="${monitoringId}"`,
    `export COLLECTOR_URL="${collector}"`,
    serverName ? `export SERVER_NAME="${serverName}"` : null,
    "sudo -E nohup ./metric-agent > metric.log 2>&1 &",
  ].filter(Boolean).join("\n");
}

function ServerCommandCard({ server, monitoringId, collectorUrl }) {
  const [expanded, setExpanded] = useState(false);
  const dockerCmd = useMemo(() => buildDockerCommand(monitoringId, collectorUrl, server.name), [monitoringId, collectorUrl, server.name]);
  const curlCmd = useMemo(() => buildCurlCommand(monitoringId, collectorUrl, server.name), [monitoringId, collectorUrl, server.name]);

  return (
    <div className="serverCmdCard">
      <div className="serverCmdCard__header" onClick={() => setExpanded(v => !v)}>
        <div className="serverCmdCard__info">
          <span className="serverCmdCard__name">{server.name}</span>
          {server.description && <span className="serverCmdCard__desc">{server.description}</span>}
        </div>
        <span className="serverCmdCard__toggle">{expanded ? "▲ 접기" : "▼ 명령어 보기"}</span>
      </div>
      {expanded && (
        <div className="serverCmdCard__body">
          <div className="serverCmdCard__section">
            <div className="serverCmdCard__sectionTitle">🐳 Docker</div>
            <CodeBlock code={dockerCmd} />
          </div>
          <div className="serverCmdCard__section">
            <div className="serverCmdCard__sectionTitle">⌨️ 바이너리</div>
            <CodeBlock code={curlCmd} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function AgentInstall() {
  const navigate = useNavigate();
  const session = getStoredSession();
  const companyId = session?.id;
  const companyName = buildCompanyDisplayName(session);

  const [agentInfo, setAgentInfo] = useState(null);
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      if (!companyId) { setError("로그인 정보가 없습니다."); setLoading(false); return; }
      try {
        setLoading(true);
        const [info, serverList] = await Promise.all([
          getAgentDestination(companyId),
          getServers(companyId).catch(() => []),
        ]);
        if (info?.monitoringId) setAgentInfo(info);
        else setError("발급된 모니터링 정보를 찾을 수 없습니다.");
        setServers(Array.isArray(serverList) ? serverList : []);
      } catch (err) {
        setError("서버로부터 설치 정보를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [companyId]);

  const monitoringId = agentInfo?.monitoringId || "불러오는 중...";
  const collectorUrl = agentInfo?.collectorUrl || "data.monittoring.co.kr:80";

  const genericDockerCmd = useMemo(() => buildDockerCommand(monitoringId, collectorUrl, null), [monitoringId, collectorUrl]);
  const genericCurlCmd = useMemo(() => buildCurlCommand(monitoringId, collectorUrl, null), [monitoringId, collectorUrl]);

  return (
    <div className="agentPage">
      <div className="agentWrap">
        <div className="agentHero">
          <div className="agentHero__left">
            <div className="agentHero__eyebrow">Metric Agent · 설치 가이드</div>
            <h2 className="agentHero__title">에이전트 설치 명령어가 자동 생성되었습니다</h2>
            <p className="agentHero__desc">
              {companyName} 전용 ID와 수집 서버 주소가 포함되어 있습니다. 등록된 서버를 선택하거나 명령어를 직접 복사하세요.
            </p>
            {error ? <div className="agentError">{error}</div> : null}
          </div>
        </div>

        <SectionCard icon="🪪" title="발급된 인증 정보" sub="에이전트 인증에 사용되는 고유 값입니다.">
          <div className="installInfo">
            <div className="installInfo__text"><strong>MONITORING_ID:</strong> {monitoringId}</div>
            <div className="installInfo__text"><strong>COLLECTOR_URL:</strong> {collectorUrl}</div>
          </div>
        </SectionCard>

        {servers.length > 0 ? (
          <SectionCard
            icon="🗄️"
            title="등록된 서버별 설치 명령어"
            sub="SERVER_NAME이 자동으로 포함된 명령어입니다. 각 서버에 맞게 실행하세요."
          >
            <div className="serverCmdList">
              {servers.map(server => (
                <ServerCommandCard
                  key={server.id}
                  server={server}
                  monitoringId={monitoringId}
                  collectorUrl={collectorUrl}
                />
              ))}
            </div>
          </SectionCard>
        ) : (
          <SectionCard icon="🗄️" title="등록된 서버가 없습니다" sub="서버 관리 페이지에서 모니터링할 서버를 먼저 등록하세요.">
            <button className="agentBtn agentBtn--primary" type="button" onClick={() => navigate("/servers")}>
              서버 관리로 이동
            </button>
          </SectionCard>
        )}

        <SectionCard icon="🐳" title="방법 1. Docker로 실행 (권장)" sub="SERVER_NAME 없이 실행 시 호스트명이 자동 사용됩니다." right={<span className="agentChip">권장</span>}>
          <CodeBlock code={genericDockerCmd} disabled={loading || !agentInfo} />
        </SectionCard>

        <SectionCard icon="⌨️" title="방법 2. 바이너리 직접 실행" sub="Docker를 사용할 수 없는 환경에서 사용합니다.">
          <CodeBlock code={genericCurlCmd} disabled={loading || !agentInfo} />
        </SectionCard>
      </div>
    </div>
  );
}
