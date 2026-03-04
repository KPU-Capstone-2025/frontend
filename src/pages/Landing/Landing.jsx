import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./landing.css";

import ImacMock from "../../components/common/ImacMock.jsx";

import dashboard from "../../assets/images/dashboard.png";
import section2 from "../../assets/images/색션2.jpg";

export default function Landing() {
  const navigate = useNavigate();

  // 스크롤 기반 등장 애니메이션
  useEffect(() => {
    const els = Array.from(document.querySelectorAll(".reveal"));
    if (els.length === 0) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      },
      { threshold: 0.15 }
    );

    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const [scrollHintHidden, setScrollHintHidden] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrollHintHidden(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToId = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="landingRoot">
      {/* ===== HERO (LIGHT) ===== */}
      <section className="lp-section lp-hero" aria-label="Hero">
        <div className="lp-container heroGrid">
          <div className="heroCopy reveal">
            <div className="badge">AI 기반 통합 관측</div>

            <h1 className="title">
              <span className="blue">실시간</span> 서버 모니터링
              <br />
              & 로그 분석 플랫폼
            </h1>

            <p className="lead">
              CPU · Memory · Disk · Network 지표와 로그를 한 화면에서 보고,
              이상 징후는 빠르게 알림으로 받아보세요.
            </p>

            <ul className="pillList reveal" style={{ transitionDelay: "80ms" }}>
              <li>지능형 리소스 수집</li>
              <li>실시간 커스터마이징 대시보드</li>
              <li>선제적 이상 징후 탐지</li>
              <li>GPT 운영 어시스턴트</li>
            </ul>

            <div className="ctaRow reveal" style={{ transitionDelay: "140ms" }}>
              <button className="btnPrimary" onClick={() => navigate("/login")}>
                시작하기
              </button>
              <button className="btnGhost" onClick={() => scrollToId("features")}>
                서비스 소개
              </button>
            </div>
          </div>

          <div className="heroVisual reveal" style={{ transitionDelay: "120ms" }}>
            <ImacMock screenSrc={dashboard} />
          </div>
        </div>

        <button
          className={`scrollHint ${scrollHintHidden ? "hide" : ""}`}
          onClick={() => scrollToId("problem")}
          aria-label="Scroll to next section"
          type="button"
        >
          <span className="mouse" aria-hidden="true" />
          <span className="scrollText">Scroll</span>
        </button>
      </section>

      {/* ===== PROBLEM ===== */}
      <section className="lp-section lp-problem" id="problem" aria-label="Problem">
        <div className="lp-container">
          <div className="sec__head reveal">
            <h2 className="sec__title">운영자는 늘 “문제”를 늦게 봅니다</h2>
            <p className="sec__sub">
              지표와 로그가 흩어져 있으면 장애 원인 파악과 대응이 늦어집니다.
              운영자가 즉시 판단할 수 있는 화면을 제공합니다.
            </p>
          </div>

          <div className="problemGrid">
            <div className="pCard reveal" style={{ transitionDelay: "0ms" }}>
              <div className="pIcon">⏱️</div>
              <div className="pT">장애 인지 지연</div>
              <div className="pD">서버 상태를 수동으로 확인하다 늦게 발견</div>
            </div>
            <div className="pCard reveal" style={{ transitionDelay: "80ms" }}>
              <div className="pIcon">🧩</div>
              <div className="pT">도구 분산</div>
              <div className="pD">모니터링/로그/알림이 분리돼 흐름이 끊김</div>
            </div>
            <div className="pCard reveal" style={{ transitionDelay: "160ms" }}>
              <div className="pIcon">🔎</div>
              <div className="pT">원인 파악 어려움</div>
              <div className="pD">로그 검색·필터가 복잡해 핵심만 보기 어려움</div>
            </div>
            <div className="pCard reveal" style={{ transitionDelay: "240ms" }}>
              <div className="pIcon">📣</div>
              <div className="pT">알림 기준 부재</div>
              <div className="pD">임계값/업무시간 정책이 없어 놓치거나 과다 알림</div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section className="lp-section lp-features" id="features" aria-label="Features">
        <div className="lp-container">
          <div className="sec__head reveal">
            <h2 className="sec__title">한 번에 연결되는 관측 흐름</h2>
            <p className="sec__sub">수집 → 분석 → 알림 → 조치 가이드까지 끊김 없이 이어집니다.</p>
          </div>

          <div className="grid2">
            <div className="cards">
              <div className="fcard reveal" style={{ transitionDelay: "0ms" }}>
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

              <div className="fcard reveal" style={{ transitionDelay: "80ms" }}>
                <div className="ficon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M4 19V5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M4 19h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path
                      d="M7 15l3-4 3 2 4-6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div>
                  <div className="fcard__t">이상 탐지 & 예측</div>
                  <div className="fcard__d">임계치 + 패턴 기반으로 이상을 감지하고 선제 알림을 제공합니다.</div>
                </div>
              </div>

              <div className="fcard reveal" style={{ transitionDelay: "160ms" }}>
                <div className="ficon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M12 3v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path
                      d="M8 11l4 4 4-4"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path d="M5 21h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <div className="fcard__t">운영 정책/스케줄</div>
                  <div className="fcard__d">업무/비업무 시간에 맞춰 수집 주기·알림 정책을 설정합니다.</div>
                </div>
              </div>

              <div className="fcard reveal" style={{ transitionDelay: "240ms" }}>
                <div className="ficon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 2a6 6 0 016 6v3a4 4 0 01-4 4h-2"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <path
                      d="M8 15h6a4 4 0 014 4v2H6v-2a4 4 0 014-4z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path d="M9 8a3 3 0 106 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <div className="fcard__t">GPT 운영 어시스턴트</div>
                  <div className="fcard__d">이슈 원인 후보/조치 체크리스트를 요약해 대응을 돕습니다.</div>
                </div>
              </div>
            </div>

            <div className="shot reveal" style={{ transitionDelay: "120ms" }}>
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
                  <div className="stat__k">Assist</div>
                  <div className="stat__v">가이드</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FLOW / ARCH ===== */}
      <section className="lp-section lp-flow" aria-label="Flow">
        <div className="lp-container sec">
          <div className="sec__head reveal">
            <h2 className="sec__title">한 화면에서 이해되는 운영 흐름</h2>
            <p className="sec__sub">수집 → 분석 → 알림 → 조치(가이드)까지 업무 흐름을 그대로 담았습니다.</p>
          </div>

          <div className="flow">
            <div className="step reveal" style={{ transitionDelay: "0ms" }}>
              <div className="step__n">01</div>
              <div className="step__t">수집</div>
              <div className="step__d">서버 리소스/로그/이벤트를 주기적으로 수집</div>
            </div>
            <div className="step reveal" style={{ transitionDelay: "80ms" }}>
              <div className="step__n">02</div>
              <div className="step__t">분석</div>
              <div className="step__d">임계치 + 패턴 기반 이상 탐지 / 트렌드 분석</div>
            </div>
            <div className="step reveal" style={{ transitionDelay: "160ms" }}>
              <div className="step__n">03</div>
              <div className="step__t">알림</div>
              <div className="step__d">즉시 알림 + 리포트 제공</div>
            </div>
            <div className="step reveal" style={{ transitionDelay: "240ms" }}>
              <div className="step__n">04</div>
              <div className="step__t">가이드</div>
              <div className="step__d">GPT가 원인 후보/조치 체크리스트를 요약</div>
            </div>
          </div>

          <div className="arch reveal" style={{ transitionDelay: "120ms" }}>
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

      {/* ===== FOOTER (CTA는 아주 약하게) ===== */}
      <section className="lp-section lp-cta" aria-label="Footer">
        <div className="lp-container">
          <footer className="lpFooter reveal">
            <div className="lpFooter__top">
              <div className="lpFooter__brand">
                <div className="lpFooter__logoRow">
                  <div className="lpFooter__logoBox" aria-hidden="true">🖥️</div>
                  <div className="lpFooter__brandName">모니또링</div>
                </div>
              </div>

              <div className="lpFooter__cols">
                <div className="lpFooter__col">
                  <div className="lpFooter__title">CONTACT INFORMATION</div>

                  <div className="lpFooter__item">
                    <span className="lpFooter__icon">✉️</span>
                    <span>1234@tukorea.ac.kr</span>
                  </div>

                  <div className="lpFooter__item">
                    <span className="lpFooter__icon">📞</span>
                    <span>010-1234-5678</span>
                  </div>
                </div>

                <div className="lpFooter__col">
                  <div className="lpFooter__title">COMPANY</div>
                  <button className="lpFooter__link" type="button" onClick={() => scrollToId("features")}>Features</button>
                  <button className="lpFooter__link" type="button" onClick={() => scrollToId("problem")}>About Us</button>
                  <button className="lpFooter__link" type="button" onClick={() => scrollToId("features")}>Contact</button>
                  <button className="lpFooter__link" type="button" onClick={() => scrollToId("features")}>Pricing</button>
                </div>

                <div className="lpFooter__col">
                  <div className="lpFooter__title">HELP</div>
                  <button className="lpFooter__link" type="button">FAQ</button>
                  <button className="lpFooter__link" type="button">Help Center</button>
                  <button className="lpFooter__link" type="button">Support</button>
                </div>

                <div className="lpFooter__col">
                  <div className="lpFooter__title">FOLLOW US</div>
                  <div className="lpFooter__social">
                    <a className="lpFooter__socialBtn" href="#" aria-label="Facebook" onClick={(e) => e.preventDefault()}>f</a>
                    <a className="lpFooter__socialBtn" href="#" aria-label="Instagram" onClick={(e) => e.preventDefault()}>⌁</a>
                    <a className="lpFooter__socialBtn" href="#" aria-label="YouTube" onClick={(e) => e.preventDefault()}>▶</a>
                  </div>
                </div>
              </div>
            </div>

            <div className="lpFooter__divider" />

            <div className="lpFooter__bottom">
              <div className="lpFooter__legal">
                <button className="lpFooter__legalLink" type="button">이용약관</button>
                <span className="lpFooter__dot">|</span>
                <button className="lpFooter__legalLink" type="button">개인정보처리방침</button>
                <span className="lpFooter__dot">|</span>
                <button className="lpFooter__legalLink" type="button">회원가입</button>
              </div>

              <div className="lpFooter__copy">
                © {new Date().getFullYear()} Monittoring. All rights reserved.
              </div>
            </div>

            {/* ✅ 존재감 낮은 미니 CTA */}
            <div className="miniCta">
              <span className="miniCta__text">Ready to start?</span>
              <button className="miniCta__btn" onClick={() => navigate("/login")}>
                시작하기
              </button>
            </div>
          </footer>
        </div>
      </section>
    </div>
  );
}