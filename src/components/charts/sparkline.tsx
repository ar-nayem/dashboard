import { extentOf, linePath, makeScale, padExtent, smoothLinePath } from "@/lib/chart";

// Tiny inline trend line for project tiles and metric cards. Deliberately
// axis-free and label-free: it only has to show the shape.
export function Sparkline({
  values,
  color = "var(--series-2)",
  width = 160,
  height = 40,
  smooth = true,
  fill = false,
  className = "",
  ariaLabel = "Trend",
}: {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
  smooth?: boolean;
  fill?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const points = values
    .filter((v) => Number.isFinite(v))
    .map((y, x) => ({ x, y }));

  // One point has no shape to draw, so treat it the same as no data.
  if (points.length < 2) {
    return <div style={{ height }} className={className} aria-hidden="true" />;
  }

  const pad = 3;
  const xExtent = extentOf([{ name: "s", points }], "x");
  const yExtent = padExtent(extentOf([{ name: "s", points }], "y"), 0.12);
  const scaleX = makeScale(xExtent, pad, width - pad);
  const scaleY = makeScale(yExtent, height - pad, pad);

  const d = (smooth ? smoothLinePath : linePath)(points, scaleX, scaleY);
  const gradientId = `spark-${ariaLabel.replace(/\W+/g, "-")}-${values.length}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={`h-auto w-full ${className}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={ariaLabel}
    >
      {fill && (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={`${d} L${width - pad},${height} L${pad},${height} Z`} fill={`url(#${gradientId})`} />
        </>
      )}
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        // preserveAspectRatio="none" stretches the viewBox non-uniformly,
        // which would distort the stroke without this.
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
