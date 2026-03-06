import { Outlet, useLocation, Navigate } from "react-router-dom";
import SideNav from "../components/navigation/SideNav.jsx";
import TopBar from "../components/navigation/TopBar.jsx";
import { getStoredSession } from "../services/authStorage.js";
import "./layout.css";

const TITLE_MAP = {
  "/dashboard": {
    title: "통합 모니터링",
    desc: "호스트 서버와 컨테이너 리소스를 한 화면에서 확인합니다.",
  },
  "/agent-install": {
    title: "에이전트 설치",
    desc: "모니터링 에이전트 설치 방법을 안내합니다.",
  },
  "/logs": {
    title: "로그 분석",
    desc: "에러/레벨/검색으로 원인을 빠르게 찾습니다.",
  },
  "/alerts": {
    title: "알림 설정",
    desc: "임계치/채널/스케줄을 설정합니다.",
  },
};

function getTopBarMeta(pathname) {
  return TITLE_MAP[pathname] || { title: "모니또링", desc: "" };
}

export default function AppLayout() {
  const { pathname } = useLocation();
  const meta = getTopBarMeta(pathname);
  const session = getStoredSession();

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="appShell">
      <aside className="appShell__nav">
        <SideNav />
      </aside>

      <div className="appShell__main">
        <TopBar title={meta.title} desc={meta.desc} />
        <main className="appShell__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}