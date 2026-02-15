import "./ui.css";

export default function EmptyState({
  title,
  desc,
  primaryText,
  onPrimary,
  secondaryText,
  onSecondary,
}) {
  return (
    <div className="empty">
      <div className="empty__box">
        <div className="empty__title">{title}</div>
        <div className="empty__desc">{desc}</div>

        <div className="empty__actions">
          {primaryText ? (
            <button className="btn btn--primary" onClick={onPrimary}>
              {primaryText}
            </button>
          ) : null}
          {secondaryText ? (
            <button className="btn" onClick={onSecondary}>
              {secondaryText}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
