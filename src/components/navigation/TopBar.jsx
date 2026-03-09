import { useNavigate } from "react-router-dom";
import {
  buildCompanyDisplayName,
  clearStoredSession,
  getStoredSession,
} from "../../services/authStorage.js";

export default function TopBar({ title, desc }) {
  const navigate = useNavigate();
  const session = getStoredSession();

  const companyName = buildCompanyDisplayName(session);
  const userName = companyName;

  const handleLogout = () => {
    clearStoredSession();
    navigate("/login", { replace: true });
  };

  return (
    <header className="topBar">
      <div className="topBar__left">
        <div className="pageTitle">
          <h1 className="pageTitle__h">{title}</h1>
          <p className="pageTitle__p">{desc}</p>
        </div>
      </div>

      <div className="topBar__right">
        <div className="pill" title="현재 로그인 회사">
          <span style={{ color: "var(--blue)", fontWeight: 900 }}>회사</span>
          <span>{companyName}</span>
        </div>

        <div className="pill" title="상태">
          <span className="pillDot" />
          실시간 수집 연동
        </div>

        <div className="userChip">
          <div className="userAvatar">{userName?.[0] || "A"}</div>
          <div className="userMeta">
            <div className="userName">{userName}</div>
            <div className="userRole">{companyName}</div>
          </div>
        </div>

        <button className="logoutBtn" type="button" onClick={handleLogout}>
          로그아웃
        </button>
      </div>
    </header>
  );
}