import { useMemo, useState } from "react";
import "./agentInstall.css";

function CopyButton({ text, label = "복사", className = "" }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
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

function CodeBlock({ code, copyLabel = "전체 복사" }) {
  return (
    <div className="codeBlockWrap">
      <pre className="codeBlock">
        <code>{code}</code>
      </pre>

      <div className="codeBlock__actions">
        <CopyButton text={code} label={copyLabel} className="agentBtn--primary" />
      </div>
    </div>
  );
}

export default function AgentInstall() {
  const dockerPullCommand = useMemo(() => {
    return `sudo docker pull kimhongseok/metric-agent:latest`;
  }, []);

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
      '  -e MONITORING_ID="귀사의_고유_코드" \\',
      '  -e COLLECTOR_URL="수집_서버_주소:4318" \\',
      "  kimhongseok/metric-agent:latest",
    ].join("\n");
  }, []);

  const curlCommand = useMemo(() => {
    return [
      "curl -fLO http://agent.monittoring.co.kr/metric-agent",
      "chmod +x metric-agent",
      'export MONITORING_ID="귀사의_고유_코드"',
      'export COLLECTOR_URL="수집_서버_주소:4318"',
      "sudo -E nohup ./metric-agent > metric.log 2>&1 &",
    ].join("\n");
  }, []);

  return (
    <div className="agentPage">
      <div className="agentWrap">
        <div className="agentHero">
          <div className="agentHero__left">
            <div className="agentHero__eyebrow">Metric Agent · 설치 가이드</div>
            <h2 className="agentHero__title">에이전트 설치 방법을 확인하고 바로 실행하세요</h2>
            <p className="agentHero__desc">
              서버 환경에 맞는 설치 방법을 선택한 뒤 명령어를 그대로 복사해 실행하면 됩니다.
            </p>
          </div>

          <div className="agentHero__right">
            <div className="statusCard">
              <div className="statusCard__top">
                <span className="statusCard__dot" />
                설치 가이드 제공
              </div>
              <div className="statusCard__text">
                Docker 방식과 curl 방식 중 하나를 선택해
                <br />
                서버에서 그대로 실행하면 됩니다.
              </div>
            </div>
          </div>
        </div>

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
                <div className="stepItem__desc">
                  최신 Metric Agent 이미지를 서버에 내려받습니다.
                </div>
                <CodeBlock
                  code={dockerPullCommand}
                  copyLabel="이미지 다운로드 복사"
                />
              </div>
            </div>

            <div className="stepItem">
              <div className="stepItem__num">2</div>
              <div className="stepItem__body">
                <div className="stepItem__title">에이전트 실행</div>
                <div className="stepItem__desc">
                  MONITORING_ID와 COLLECTOR_URL 값을 넣어 컨테이너를 실행합니다.
                </div>
                <CodeBlock
                  code={dockerRunCommand}
                  copyLabel="Docker 실행 명령 복사"
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
                  MONITORING_ID와 COLLECTOR_URL 값을 설정한 뒤 에이전트를 실행합니다.
                </div>
                <CodeBlock
                  code={curlCommand}
                  copyLabel="curl 설치 명령 복사"
                />
              </div>
            </div>
          </div>
        </SectionCard>

        <div className="agentCols">
          <SectionCard
            icon="📌"
            title="설치 전 준비 사항"
            sub="실행 전에 아래 조건을 확인해 주세요."
          >
            <ul className="checkList">
              <li>운영체제는 Linux 환경 사용 (Ubuntu 20.04 이상 권장)</li>
              <li>Collector 서버의 4318 포트로 아웃바운드 HTTP 통신 허용</li>
              <li>MONITORING_ID와 COLLECTOR_URL 값을 미리 확인</li>
              <li>Docker 방식 사용 시 서버에 Docker가 설치되어 있어야 함</li>
            </ul>
          </SectionCard>

          <SectionCard
            icon="✅"
            title="설치 후 확인 포인트"
            sub="설치가 정상적으로 되었는지 아래 항목을 확인해 주세요."
          >
            <ul className="checkList">
              <li>에이전트 또는 컨테이너가 정상 실행 중인지 확인</li>
              <li>로그 파일 또는 Docker 로그에 에러가 없는지 확인</li>
              <li>대시보드에서 서버 데이터가 수집되는지 확인</li>
              <li>서버 상태 페이지에서 CPU, RAM, 네트워크 정보 반영 여부 확인</li>
            </ul>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}