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
          <NavItem to="/dashboard" icon="📊" label="대시보드" />
          <NavItem to="/servers/a" icon="🖥️" label="서버 상세" />

          <NavItem to="/logs" icon="📄" label="로그 분석" badge="준비중" />
          <NavItem to="/alerts" icon="🔔" label="알림 설정" />
        </nav>

        <div className="navFooter">
          <span>© KPU Capstone</span>
          <span>v0.1</span>
        </div>
      </aside>
    </>
  );
}
