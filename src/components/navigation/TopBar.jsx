import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  buildCompanyDisplayName,
  clearStoredSession,
  getStoredSession,
} from "../../services/authStorage.js";

const TOP_NAV_ITEMS = [
  { to: "/dashboard", label: "대시보드" },
  { to: "/servers", label: "서버 관리" },
  { to: "/logs", label: "로그 분석" },
  { to: "/chatbot", label: "챗봇" },
  { to: "/alerts", label: "알림 설정" },
  { to: "/agent-install", label: "에이전트 설치" },
];

export default function TopBar() {
  const navigate = useNavigate();
  const session = getStoredSession();
  const companyName = buildCompanyDisplayName(session);
  const [profileOpen, setProfileOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("monittoring_theme") || "light");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("monittoring_theme", theme);
  }, [theme]);

  const handleLogout = () => {
    clearStoredSession();
    navigate("/login", { replace: true });
  };

  return (
    <header className="topBar">
      <div className="topBar__left">
        <img src="/logo.png" alt="모니또링" className="topBar__logo" draggable="false" />
      </div>

      <nav className="topNav" aria-label="주요 메뉴">
        {TOP_NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} title={item.label} aria-label={item.label} className={({ isActive }) => `topNav__item ${isActive ? "is-active" : ""}`}>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="topBar__right">
        <button className="profileButton" type="button" onClick={() => setProfileOpen((prev) => !prev)} aria-label="프로필 메뉴">
          <span className="profileButton__avatar">{companyName?.[0] || "M"}</span>
        </button>
        {profileOpen ? (
          <div className="profileMenu">
            <div className="profileMenu__company">
              <span>현재 회사</span>
              <strong>{companyName}</strong>
            </div>
            <button className="profileMenu__item" type="button" onClick={() => setTheme((prev) => prev === "dark" ? "light" : "dark")}>
              {theme === "dark" ? "라이트 모드" : "다크 모드"}
            </button>
            <button className="profileMenu__item is-danger" type="button" onClick={handleLogout}>
              로그아웃
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
