import { NavLink } from "react-router-dom";
import "./nav.css";

const items = [
  { to: "/dashboard", label: "대시보드", icon: "📊" },
  { to: "/servers", label: "서버 상태", icon: "🖥️", disabled: true },
  { to: "/logs", label: "로그 분석", icon: "🧾", disabled: true },
  { to: "/alerts", label: "알림 설정", icon: "🔔", disabled: true },
];

export default function SideNav() {
  return (
    <div className="sideNav">
      <div className="sideNav__brand">
        <div className="sideNav__logo">M</div>
        <div>
          <div className="sideNav__name">Monittoring</div>
          <div className="sideNav__sub">AI Monitoring</div>
        </div>
      </div>

      <nav className="sideNav__menu">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.disabled ? "#" : it.to}
            className={({ isActive }) =>
              "navItem" +
              (isActive ? " isActive" : "") +
              (it.disabled ? " isDisabled" : "")
            }
            onClick={(e) => {
              if (it.disabled) e.preventDefault();
            }}
          >
            <span className="navItem__icon" aria-hidden="true">
              {it.icon}
            </span>
            <span className="navItem__label">{it.label}</span>
            {it.disabled && <span className="navItem__tag">준비중</span>}
          </NavLink>
        ))}
      </nav>

      <div className="sideNav__footer">
        <div className="sideNav__hint">© KPU Capstone</div>
      </div>
    </div>
  );
}
