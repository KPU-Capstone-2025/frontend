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

  const handleLogout = () => {
    clearStoredSession();
    navigate("/login", { replace: true });
  };

  return (
    <header className="topBar">
      <div className="topBar__left">
        <div className="pageTitle">
          <h1 className="pageTitle__h">{title}</h1>
          {desc ? <p className="pageTitle__p">{desc}</p> : null}
        </div>
      </div>

      <div className="topBar__right">
        <div className="topBarCompany" title="현재 로그인 회사">
          <span className="topBarCompany__label">현재 회사</span>
          <span className="topBarCompany__name">{companyName}</span>
        </div>

        <div className="topBarStatus" title="실시간 수집 상태">
          <span className="topBarStatus__dot" />
          <span>실시간 수집 연동</span>
        </div>

        <button className="logoutBtn" type="button" onClick={handleLogout}>
          로그아웃
        </button>
      </div>
    </header>
  );
}