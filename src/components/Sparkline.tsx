"use client";

/**
 * A window's own price history, drawn from its fills.
 *
 * Every point is a real trade on that market — no smoothing, no synthesised
 * curve. A window that rolled a minute ago genuinely has nothing to draw, and
 * this renders that state as flat dashes rather than inventing a line, because
 * a fake sparkline is exactly the kind of decoration that makes a dashboard
 * look impressive and mean nothing.
 */
export function Sparkline({
  points,
  className = "",
  width = 96,
  height = 26,
}: {
  points: number[];
  className?: string;
  width?: number;
  height?: number;
}) {
  if (points.length < 2) {
    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className={className}
        role="img"
        aria-label="Sin operaciones todavía"
      >
        <line
          x1="0"
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="2 4"
          opacity="0.3"
        />
      </svg>
    );
  }

  // Scaled to the series' own range, not to 0-1: on a window that traded
  // between 0.46 and 0.51 the absolute scale is a flat line, and the shape of
  // the move is the whole point of the chart.
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const pad = 2;

  const xy = points.map((p, i) => {
    const x = (i / (points.length - 1)) * width;
    const y = height - pad - ((p - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });

  const line = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `0,${height} ${line} ${width},${height}`;

  // Rough path length, for the draw-in dash offset. Exact enough: it only has
  // to over-cover the stroke, never to measure it.
  const length = xy.reduce(
    (n, [x, y], i) =>
      i === 0 ? 0 : n + Math.hypot(x - xy[i - 1][0], y - xy[i - 1][1]),
    0,
  );

  const rising = points[points.length - 1] >= points[0];
  const stroke = rising ? "var(--up)" : "var(--down)";
  const id = `spark-${rising ? "up" : "down"}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className} role="img" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${id})`} />
      <polyline
        points={line}
        fill="none"
        stroke={stroke}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="spark-draw"
        style={{ "--len": length } as React.CSSProperties}
      />
      {/* The endpoint is where the market is now — the one dot worth drawing. */}
      <circle cx={xy[xy.length - 1][0]} cy={xy[xy.length - 1][1]} r="2" fill={stroke} />
    </svg>
  );
}
