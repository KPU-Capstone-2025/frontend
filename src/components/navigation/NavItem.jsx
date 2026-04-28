import { NavLink } from "react-router-dom";

export default function NavItem({ to, icon, label, badge, onClick }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `navItem ${isActive ? "active" : ""}`}
      onClick={onClick}
    >
      <div className="navItem__icon" aria-hidden="true">
        {icon}
      </div>
      <div className="navItem__label">{label}</div>
      {badge ? <div className="navItem__badge">{badge}</div> : null}
    </NavLink>
  );
}
