import { useLocation } from "react-router-dom";

const TITLE_MAP = {
  "/dashboard": { title: "대시보드", desc: "전체 서버 현황을 한눈에 확인합니다." },
  "/servers": { title: "서버 상태", desc: "서버 목록/상태를 확인합니다." },
  "/logs": { title: "로그 분석", desc: "로그 필터/검색/스트림 확인" },
  "/alerts": { title: "알림 설정", desc: "임계값/채널/스케줄을 설정합니다." },
};

export default function TopBar({ onOpenNav }) {
  const { pathname } = useLocation();

  const meta =
    TITLE_MAP[pathname] ||
    (pathname.startsWith("/servers/") ? { title: "서버 상세", desc: "서버 지표/로그를 확인합니다." } : { title: "Monittoring", desc: "AI Monitoring System" });

  return (
    <header className="topBar">
      <div className="topBar__left">
        <button className="burger" onClick={onOpenNav} aria-label="메뉴 열기">
          ☰
        </button>

        <div className="pageTitle">
          <h1 className="pageTitle__h">{meta.title}</h1>
          <p className="pageTitle__p">{meta.desc}</p>
        </div>
      </div>

      <div className="topBar__right">
        <div className="pill" title="상태">
          <span className="pillDot" />
          시스템 정상
        </div>

        <div className="pill" title="환경 선택">
          <span style={{ color: "var(--blue)", fontWeight: 900 }}>환경</span>
          <select className="pillSelect" defaultValue="dev">
            <option value="dev">DEV</option>
            <option value="staging">STAGING</option>
            <option value="prod">PROD</option>
          </select>
        </div>

        <div className="userChip">
          <div className="userAvatar">A</div>
          <div className="userMeta">
            <div className="userName">admin</div>
            <div className="userRole">관리자</div>
          </div>
        </div>
      </div>
    </header>
  );
}
