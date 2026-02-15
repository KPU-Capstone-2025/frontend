import { useMemo } from "react";
import "./ui.css";

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function toPoints(data) {
  if (!data?.length) return "";
  const xs = data.map((_, i) => i);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);

  const ys = data.map((d) => d.v);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const width = 240;
  const height = 40;
  const pad = 4;

  return data
    .map((d, i) => {
      const x =
        pad + ((i - minX) / (maxX - minX || 1)) * (width - pad * 2);
      const y =
        pad +
        (1 - (d.v - minY) / (maxY - minY || 1)) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export default function MetricLine({ title, unit, data }) {
  const last = data?.[0]?.v ?? 0;
  const avg = useMemo(() => {
    if (!data?.length) return 0;
    const s = data.reduce((acc, d) => acc + d.v, 0);
    return s / data.length;
  }, [data]);

  const points = useMemo(() => toPoints(data), [data]);

  const lastText = Number.isFinite(last) ? last.toFixed(1) : "0.0";
  const avgText = Number.isFinite(avg) ? avg.toFixed(1) : "0.0";

  const bar = clamp(last, 0, 100);

  return (
    <div className="metricLine">
      <div className="metricLine__top">
        <div className="metricLine__title">{title}</div>
        <div className="metricLine__nums">
          <span className="metricLine__num">
            최근 <span className="mono">{lastText}</span>
            <span className="metricLine__unit">{unit}</span>
          </span>
          <span className="metricLine__sep">·</span>
          <span className="metricLine__num">
            평균 <span className="mono">{avgText}</span>
            <span className="metricLine__unit">{unit}</span>
          </span>
        </div>
      </div>

      <div className="metricLine__body">
        <div className="metricLine__bar">
          <div className="metricLine__fill" style={{ width: `${bar}%` }} />
        </div>

        <svg
          className="metricLine__spark"
          viewBox="0 0 240 40"
          preserveAspectRatio="none"
        >
          <polyline points={points} fill="none" className="sparkLine" />
        </svg>
      </div>
    </div>
  );
}
