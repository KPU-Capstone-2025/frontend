import "./nav.css";

export default function TopBar({ title, desc }) {
  return (
    <header className="topBar">
      <div>
        <div className="topBar__title">{title}</div>
        {desc ? <div className="topBar__desc">{desc}</div> : null}
      </div>

      <div className="topBar__right">
        <button className="topBar__btn" type="button">
          환경 선택 ▾
        </button>
        <div className="topBar__user">
          <div className="topBar__avatar">👤</div>
          <div className="topBar__userText">
            <div className="topBar__userName">admin</div>
            <div className="topBar__userRole">관리자</div>
          </div>
        </div>
      </div>
    </header>
  );
}
