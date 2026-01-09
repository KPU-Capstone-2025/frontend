import { useEffect, useRef, useState } from "react";
import "./home.css";

import imac from "./assets/imac.png";
import dashboard from "./assets/dashboard.png";

/* 상단 메뉴 데이터 */
const NAV = [
  { label: "제품", items: ["제품 소개", "에이전트", "대시보드"] },
  { label: "특징", items: ["실시간 모니터링", "이상탐지", "알림"] },
  { label: "데모", items: ["라이브 데모", "스크린샷"] },
  { label: "구매", items: ["요금제", "견적 문의"] },
];

function Dropdown({ label, items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDown = (e) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div className="dd" ref={ref}>
      <button
        className={`dd__btn ${open ? "isOpen" : ""}`}
        onClick={() => setOpen((v) => !v)}
      >
        {label} <span className={`dd__chev ${open ? "rot" : ""}`}>▼</span>
      </button>

      {open && (
        <div className="dd__menu">
          {items.map((t) => (
            <a
              key={t}
              href="#"
              className="dd__item"
              onClick={(e) => {
                e.preventDefault();
                setOpen(false);
              }}
            >
              {t}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <div className="page">
      {/* ===== TOP NAV ===== */}
      <header className="top">
        <div className="top__inner">
          <nav className="top__nav">
            {NAV.map((x) => (
              <Dropdown key={x.label} label={x.label} items={x.items} />
            ))}
          </nav>

          <button className="top__login">로그인/가입</button>
        </div>
      </header>

      {/* ===== HERO ===== */}
      <main className="hero">
        {/* LEFT : iMac mockup */}
        <section className="hero__left">
          <div className="imacWrap">
            {/* 대시보드 (아래) */}
            <img className="screen" src={dashboard} alt="dashboard" />

            {/* 아이맥 프레임 (위) */}
            <img className="imac" src={imac} alt="imac" />
          </div>
        </section>

        <section className="hero__right">
  <div className="hero__panel">
    <h1 className="title">
      <span className="blue">AI - based</span> +<br />
      server monitoring<br />
      system
    </h1>

    <ul className="desc">
      <li>- 지능형 리소스 수집</li>
      <li>- 실시간 커스터마이징 대시보드</li>
      <li>- 선제적 이상 징후 예측</li>
      <li>- GPT 연동 관리자 어시스턴트</li>
    </ul>

    <button className="startBtn" type="button">
  <span className="icon" aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3v10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M8 11l4 4 4-4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 21h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  </span>
  <span className="startText">시작</span>
</button>

  </div>
</section>

      </main>
    </div>
  );
}
