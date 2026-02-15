import { Outlet, useLocation } from "react-router-dom";
import SideNav from "../components/navigation/SideNav.jsx";
import TopBar from "../components/navigation/TopBar.jsx";
import "./layout.css";

const TITLE_MAP = {
  "/dashboard": { title: "대시보드", desc: "전체 서버 현황을 한눈에 확인합니다." },
  "/servers": { title: "서버 상태", desc: "서버 목록과 상세 지표를 확인합니다." },
  "/logs": { title: "로그 분석", desc: "에러/레벨/검색으로 원인을 빠르게 찾습니다." },
  "/alerts": { title: "알림 설정", desc: "임계치/채널/스케줄을 설정합니다." },
};

function getTopBarMeta(pathname) {
  if (TITLE_MAP[pathname]) return TITLE_MAP[pathname];

  if (pathname.startsWith("/servers/")) {
    return {
      title: "서버 상세",
      desc: "컨테이너 상태 비교와 시간 흐름 기반 지표를 확인합니다.",
    };
  }

  return { title: "모니터링", desc: "" };
}

export default function AppLayout() {
  const { pathname } = useLocation();
  const meta = getTopBarMeta(pathname);

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
