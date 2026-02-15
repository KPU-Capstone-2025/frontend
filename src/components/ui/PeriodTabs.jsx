import "./ui.css";

export default function PeriodTabs({ periods, value, onChange, disabled }) {
  return (
    <div className={"tabs" + (disabled ? " tabs--disabled" : "")}>
      {periods.map((p) => (
        <button
          key={p.key}
          className={"tabs__btn" + (value === p.key ? " isOn" : "")}
          onClick={() => onChange(p.key)}
          disabled={disabled}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
