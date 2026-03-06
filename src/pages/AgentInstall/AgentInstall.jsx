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
  const [companyName, setCompanyName] = useState("");
  const [monitoringId, setMonitoringId] = useState("");
  const [collectorUrl, setCollectorUrl] = useState("");

  const companyNamePreview = companyName.trim() || "입력된 기업명 없음";
  const monitoringIdPreview = monitoringId.trim() || "your-monitoring-id";
  const collectorUrlPreview =
    collectorUrl.trim() || "http://collector.monittoring.co.kr:4318";

  const fullInstallCommand = useMemo(() => {
    return [
      "curl -fLO http://agent.monittoring.co.kr/metric-agent",
      "chmod +x metric-agent",
      `export MONITORING_ID="${monitoringIdPreview}"`,
      `export COLLECTOR_URL="${collectorUrlPreview}"`,
      "sudo -E nohup ./metric-agent > metric.log 2>&1 &",
    ].join("\n");
  }, [monitoringIdPreview, collectorUrlPreview]);

  const runCommandOnly = useMemo(() => {
    return [
      `export MONITORING_ID="${monitoringIdPreview}"`,
      `export COLLECTOR_URL="${collectorUrlPreview}"`,
      "sudo -E nohup ./metric-agent > metric.log 2>&1 &",
    ].join("\n");
  }, [monitoringIdPreview, collectorUrlPreview]);

  const isValid = companyName.trim() && monitoringId.trim() && collectorUrl.trim();

  return (
    <div className="agentPage">
      <div className="agentWrap">
        <div className="agentHero">
          <div className="agentHero__left">
            <div className="agentHero__eyebrow">Metric Agent · 직접 입력 방식</div>
            <h2 className="agentHero__title">설치 정보를 입력하고 실행 명령어를 생성하세요</h2>
            <p className="agentHero__desc">
              사용자가 직접 <strong>기업명</strong>, <strong>MONITORING_ID</strong>,
              <strong> COLLECTOR_URL</strong>을 입력하면 아래에서 curl 설치 명령어가
              자동으로 만들어집니다.
            </p>
          </div>

          <div className="agentHero__right">
            <div className="statusCard">
              <div className="statusCard__top">
                <span className="statusCard__dot" />
                입력 기반 설치 준비
              </div>
              <div className="statusCard__text">
                사용자가 값을 입력한 뒤
                <br />
                생성된 명령어를 그대로 서버에 붙여 넣는 흐름입니다.
              </div>
            </div>
          </div>
        </div>

        <SectionCard
          icon="📝"
          title="설치 정보 입력"
          sub="기업 선택 없이 사용자가 직접 설치 값을 입력합니다."
          right={<span className="agentChip">직접 입력</span>}
        >
          <div className="formGrid">
            <div className="fieldBox">
              <label className="fieldBox__label">기업명</label>
              <input
                className="fieldBox__input"
                type="text"
                placeholder="예: 모니또링"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
              <p className="fieldBox__hint">
                화면 표시용 기업명입니다. 발표/demo 때 어떤 기업인지 보여주기 좋습니다.
              </p>
            </div>

            <div className="fieldBox">
              <label className="fieldBox__label">MONITORING_ID</label>
              <input
                className="fieldBox__input"
                type="text"
                placeholder="예: momo-prod-01"
                value={monitoringId}
                onChange={(e) => setMonitoringId(e.target.value)}
              />
              <p className="fieldBox__hint">
                대시보드에서 서버를 식별하는 값입니다.
              </p>
            </div>

            <div className="fieldBox fieldBox--full">
              <label className="fieldBox__label">COLLECTOR_URL</label>
              <input
                className="fieldBox__input"
                type="text"
                placeholder="예: http://collector.monittoring.co.kr:4318"
                value={collectorUrl}
                onChange={(e) => setCollectorUrl(e.target.value)}
              />
              <p className="fieldBox__hint">
                에이전트가 데이터를 전송할 Collector 주소입니다.
              </p>
            </div>
          </div>

          <div className="previewPanel">
            <div className="previewPanel__head">입력값 미리보기</div>

            <div className="previewGrid">
              <div className="previewItem">
                <div className="previewItem__label">기업명</div>
                <div className="previewItem__value">{companyNamePreview}</div>
              </div>

              <div className="previewItem">
                <div className="previewItem__label">MONITORING_ID</div>
                <div className="previewItem__value">{monitoringIdPreview}</div>
              </div>

              <div className="previewItem previewItem--full">
                <div className="previewItem__label">COLLECTOR_URL</div>
                <div className="previewItem__value">{collectorUrlPreview}</div>
              </div>
            </div>

            {!isValid ? (
              <div className="previewNotice">
                아직 입력되지 않은 값이 있어요. 모두 입력하면 명령어를 바로 복사할 수 있습니다.
              </div>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard
          icon="⌨️"
          title="설치 명령어"
          sub="입력한 값 기준으로 명령어가 자동 생성됩니다."
        >
          <div className="stepList">
            <div className="stepItem">
              <div className="stepItem__num">1</div>
              <div className="stepItem__body">
                <div className="stepItem__title">에이전트 다운로드</div>
                <div className="stepItem__desc">
                  실행 파일을 서버에 내려받고 실행 권한을 부여합니다.
                </div>
                <CodeBlock
                  code={`curl -fLO http://agent.monittoring.co.kr/metric-agent\nchmod +x metric-agent`}
                  copyLabel="다운로드 명령 복사"
                />
              </div>
            </div>

            <div className="stepItem">
              <div className="stepItem__num">2</div>
              <div className="stepItem__body">
                <div className="stepItem__title">환경 변수 설정 및 실행</div>
                <div className="stepItem__desc">
                  입력한 MONITORING_ID와 COLLECTOR_URL이 자동 반영됩니다.
                </div>
                <CodeBlock code={runCommandOnly} copyLabel="실행 명령 복사" />
              </div>
            </div>

            <div className="stepItem">
              <div className="stepItem__num">3</div>
              <div className="stepItem__body">
                <div className="stepItem__title">한 번에 전체 실행</div>
                <div className="stepItem__desc">
                  아래 블록 전체를 복사해서 바로 서버에 붙여 넣어도 됩니다.
                </div>
                <CodeBlock code={fullInstallCommand} copyLabel="전체 설치 명령 복사" />
              </div>
            </div>
          </div>
        </SectionCard>

        <div className="agentCols">
          <SectionCard
            icon="📌"
            title="설치 전 준비 사항"
            sub="최소한 아래 조건은 맞는지 확인해 주세요."
          >
            <ul className="checkList">
              <li>운영체제 Linux 환경 사용 (Ubuntu 20.04 이상 권장)</li>
              <li>Collector 서버 4318 포트로 아웃바운드 HTTP 통신 허용</li>
              <li>실행 파일 권한 부여 후 실행</li>
              <li>Docker 실행 중이면 컨테이너 모니터링도 자동 활성화</li>
            </ul>
          </SectionCard>

          <SectionCard
            icon="✅"
            title="설치 후 확인 포인트"
            sub="설치 후 다음 항목들을 확인해주세요."
          >
            <ul className="checkList">
              <li>백그라운드 프로세스가 정상 실행 중인지 확인</li>
              <li><code>metric.log</code> 파일에 에러가 없는지 확인</li>
              <li>대시보드에서 서버 데이터가 들어오는지 확인</li>
              <li>로그 분석/서버 상태 페이지에서 반영 여부 확인</li>
            </ul>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}