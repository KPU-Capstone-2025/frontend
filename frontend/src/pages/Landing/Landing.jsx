import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./landing.css";

import ImacMock from "../../components/common/ImacMock.jsx";

import dashboard from "../../assets/images/dashboard.png";
import section2 from "../../assets/images/색션2.jpg";

export default function Landing() {
  const navigate = useNavigate();

  const sectionRefs = useRef([]);
  const lockRef = useRef(false);
  const touchStartY = useRef(0);

  const [active, setActive] = useState(0);
  const sectionsCount = useMemo(() => 3, []);

  const scrollTo = (nextIndex) => {
    const clamped = Math.max(0, Math.min(sectionsCount - 1, nextIndex));
    const el = sectionRefs.current[clamped];
    if (!el) return;

    setActive(clamped);
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    const isDesktop = window.matchMedia("(min-width: 64rem)").matches;
    if (!isDesktop) return;

    const LOCK_MS = 900;
    const THRESHOLD = 10;

    const onWheel = (e) => {
      e.preventDefault();
      if (lockRef.current) return;

      const dy = e.deltaY;
      if (Math.abs(dy) < THRESHOLD) return;

      lockRef.current = true;
      if (dy > 0) scrollTo(active + 1);
      else scrollTo(active - 1);

      window.setTimeout(() => (lockRef.current = false), LOCK_MS);
    };

    const onKeyDown = (e) => {
      if (lockRef.current) return;

      if (e.key === "ArrowDown" || e.key === "PageDown") {
        lockRef.current = true;
        scrollTo(active + 1);
        window.setTimeout(() => (lockRef.current = false), LOCK_MS);
      }

      if (e.key === "ArrowUp" || e.key === "PageUp") {
        lockRef.current = true;
        scrollTo(active - 1);
        window.setTimeout(() => (lockRef.current = false), LOCK_MS);
      }

      if (e.key === "Home") scrollTo(0);
      if (e.key === "End") scrollTo(sectionsCount - 1);
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKeyDown);

    scrollTo(active);

    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [active, sectionsCount]);

  const onTouchStart = (e) => {
    touchStartY.current = e.touches?.[0]?.clientY ?? 0;
  };
  const onTouchEnd = (e) => {
    const isDesktop = window.matchMedia("(min-width: 64rem)").matches;
    if (isDesktop) return;

    const endY = e.changedTouches?.[0]?.clientY ?? 0;
    const diff = touchStartY.current - endY;
    const SWIPE = 50;
    if (Math.abs(diff) < SWIPE) return;

    if (diff > 0) scrollTo(active + 1);
    else scrollTo(active - 1);
  };

  return (
    <div className="fullpage" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {/* ===== 0) HERO ===== */}
      <section className="fp-section" ref={(el) => (sectionRefs.current[0] = el)}>
        <div className="page">
          <main className="hero">
            <section className="hero__left">
              <ImacMock screenSrc={dashboard} />
            </section>

            <section className="hero__right">
              <div className="hero__panel">
                <h1 className="title">
                  <span className="blue">AI - Based</span> +
                  <br />
                  Server
                  <img src="/favicon.png" alt="logo" className="titleLogo" />
                  <br />
                  Monitoring
                  <br />
                  System
                </h1>

                <ul className="desc">
                  <li>- 지능형 리소스 수집</li>
                  <li>- 실시간 커스터마이징 대시보드</li>
                  <li>- 선제적 이상 징후 예측</li>
                  <li>- GPT 연동 관리자 어시스턴트</li>
                </ul>

                <button className="top__login" onClick={() => navigate("/login")}>
                  <span className="userIcon">👤 </span>
                  시작하기
                </button>
              </div>
            </section>
          </main>
        </div>
      </section>

      {/* ===== 1) 섹션2 ===== */}
      <section className="fp-section sec2" ref={(el) => (sectionRefs.current[1] = el)}>
        <div className="fp-inner sec">
          <div className="sec__head">
            <h2 className="sec__title">
              운영 중인 서버를<br />“끊지 않고” 안전하게
            </h2>
            <p className="sec__sub">
              서비스 중단 없이 지표를 수집하고, 이상 징후를 조기에 탐지해
              장애 대응 시간을 줄입니다.
            </p>
          </div>

          <div className="grid2">
            <div className="cards">
              <div className="fcard">
                <div className="ficon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M7 7v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <div className="fcard__t">지능형 리소스 수집</div>
                  <div className="fcard__d">CPU/메모리/디스크/네트워크를 자동 수집하고 표준화합니다.</div>
                </div>
              </div>

              <div className="fcard">
                <div className="ficon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M4 19V5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M4 19h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M7 15l3-4 3 2 4-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <div className="fcard__t">이상 탐지 & 예측</div>
                  <div className="fcard__d">임계치 + 패턴 기반으로 이상을 감지하고 선제 알림을 제공합니다.</div>
                </div>
              </div>

              <div className="fcard">
                <div className="ficon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M12 3v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M8 11l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M5 21h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <div className="fcard__t">운영 정책/스케줄</div>
                  <div className="fcard__d">업무/비업무 시간에 맞춰 수집 주기·알림 정책을 유연하게 설정합니다.</div>
                </div>
              </div>

              <div className="fcard">
                <div className="ficon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M12 2a6 6 0 016 6v3a4 4 0 01-4 4h-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M8 15h6a4 4 0 014 4v2H6v-2a4 4 0 014-4z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M9 8a3 3 0 106 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <div className="fcard__t">GPT 관리자 어시스턴트</div>
                  <div className="fcard__d">이슈 원인/조치 가이드를 요약해 운영자의 대응을 돕습니다.</div>
                </div>
              </div>
            </div>

            <div className="shot">
              <div className="shot__frame">
                <img src={section2} alt="대시보드 미리보기" className="shot__img" />
              </div>

              <div className="stats">
                <div className="stat">
                  <div className="stat__k">Real-time</div>
                  <div className="stat__v">모니터링</div>
                </div>
                <div className="stat">
                  <div className="stat__k">Alert</div>
                  <div className="stat__v">알림/리포트</div>
                </div>
                <div className="stat">
                  <div className="stat__k">Policy</div>
                  <div className="stat__v">운영 정책</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== 2) 섹션3 ===== */}
      <section className="fp-section sec3" ref={(el) => (sectionRefs.current[2] = el)}>
        <div className="fp-inner sec">
          <div className="sec__head">
            <h2 className="sec__title">한 번에 이해되는 운영 흐름</h2>
            <p className="sec__sub">수집 → 분석 → 알림 → 조치(가이드)까지 한 화면에서 연결합니다.</p>
          </div>

          <div className="flow">
            <div className="step">
              <div className="step__n">01</div>
              <div className="step__t">수집</div>
              <div className="step__d">서버 리소스/로그/이벤트를 주기적으로 수집</div>
            </div>
            <div className="step">
              <div className="step__n">02</div>
              <div className="step__t">분석</div>
              <div className="step__d">임계치 + 패턴 기반 이상 탐지 / 트렌드 분석</div>
            </div>
            <div className="step">
              <div className="step__n">03</div>
              <div className="step__t">알림</div>
              <div className="step__d">이메일/슬랙 등 채널로 즉시 알림 + 리포트</div>
            </div>
            <div className="step">
              <div className="step__n">04</div>
              <div className="step__t">가이드</div>
              <div className="step__d">GPT가 원인 후보/조치 체크리스트를 요약</div>
            </div>
          </div>

          <div className="arch">
            <div className="arch__col">
              <div className="arch__box">
                <div className="arch__h">서버(대상)</div>
                <div className="arch__p">리소스 · 로그 · 이벤트</div>
              </div>
              <div className="arch__hint">서비스 운영을 유지한 채 수집</div>
            </div>

            <div className="arch__mid">
              <div className="arch__pipe">수집기</div>
              <div className="arch__pipe">분석 엔진</div>
              <div className="arch__pipe">알림/정책</div>
            </div>

            <div className="arch__col">
              <div className="arch__box">
                <div className="arch__h">대시보드</div>
                <div className="arch__p">현황 · 추이 · 이상</div>
              </div>
              <div className="arch__box ghost">
                <div className="arch__h">GPT 어시스턴트</div>
                <div className="arch__p">원인/조치 가이드</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
