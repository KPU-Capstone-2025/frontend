import { Outlet } from "react-router-dom";
import { useState } from "react";
import SideNav from "../components/navigation/SideNav.jsx";
import TopBar from "../components/navigation/TopBar.jsx";
import "./layout.css";

export default function AppLayout() {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="appShell">
      <SideNav open={navOpen} onClose={() => setNavOpen(false)} />

      <div className="appMain">
        {/* TopBar도 컨테이너 폭에 맞추고 싶으면 감싸는 걸 추천 */}
        <div className="appContainer">
          <TopBar onOpenNav={() => setNavOpen(true)} />
        </div>

        <main className="appContent">
          <div className="appContainer">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
