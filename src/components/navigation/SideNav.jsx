import NavItem from "./NavItem.jsx";

export default function SideNav({ open, onClose }) {
  return (
    <>
      {open ? <div className="navOverlay" onClick={onClose} /> : null}

      <aside className={`sideNav ${open ? "open" : ""}`}>
        <div className="brand">
          <div className="brand__logo">
            <img
              src="/logo.png"
              alt="모니또링 로고"
              className="brand__logoImg"
              draggable="false"
            />
          </div>

          <div className="brand__txt">
            <div className="brand__title">Monittoring</div>
            <div className="brand__sub">AI Monitoring</div>
          </div>
        </div>

        <nav className="navGroup">
          <NavItem to="/dashboard" icon="🖥️" label="통합 모니터링" />
          <NavItem to="/agent-install" icon="🧩" label="에이전트 설치" />
          <NavItem to="/logs" icon="📄" label="로그 분석" />
          <NavItem to="/alerts" icon="🔔" label="알림 설정" />
        </nav>

        <div className="navFooter">
          <span>© KPU Capstone</span>
          <span>v0.2</span>
        </div>
      </aside>
    </>
  );
}