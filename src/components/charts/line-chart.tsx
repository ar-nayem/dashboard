import {
  areaPathFrom,
  extentOf,
  linePath,
  makeScale,
  niceTicks,
  padExtent,
  sampleEvenly,
  seriesColor,
  smoothLinePath,
  type Series,
} from "@/lib/chart";

// The SVG is drawn on a fixed coordinate grid and scaled by CSS
// (`w-full h-auto`), so the component never needs to measure the DOM and
// stays a Server Component. Strokes carry vector-effect="non-scaling-stroke"
// so they stay 1.5px however wide the container gets.
const VIEW_WIDTH = 800;

type LineChartProps = {
  series: Series[];
  height?: number;
  /** Reserve left gutter for y labels. Set 0 to hide the y axis entirely. */
  yAxisWidth?: number;
  showYAxis?: boolean;
  showXAxis?: boolean;
  showGrid?: boolean;
  showArea?: boolean;
  showDots?: boolean;
  smooth?: boolean;
  formatY?: (value: number) => string;
  formatX?: (value: number) => string;
  /** Forces the y domain to start at zero instead of hugging the data. */
  zeroBased?: boolean;
  className?: string;
  ariaLabel?: string;
};

export function LineChart({
  series,
  height = 260,
  yAxisWidth = 52,
  showYAxis = true,
  showXAxis = true,
  showGrid = true,
  showArea = false,
  showDots = false,
  smooth = true,
  formatY = (v) => String(Math.round(v)),
  formatX,
  zeroBased = false,
  className = "",
  ariaLabel,
}: LineChartProps) {
  const withPoints = series.filter((s) => s.points.length > 0);

  if (withPoints.length === 0) {
    return (
      <div
        style={{ height }}
        className={`flex items-center justify-center text-sm text-faint-foreground ${className}`}
      >
        No data yet
      </div>
    );
  }

  const left = showYAxis ? yAxisWidth : 8;
  const right = 12;
  const top = 12;
  const bottom = showXAxis ? 26 : 10;

  const xExtent = extentOf(withPoints, "x");
  const rawY = extentOf(withPoints, "y");
  const yExtent = padExtent(zeroBased ? { min: Math.min(0, rawY.min), max: rawY.max } : rawY);

  const scaleX = makeScale(xExtent, left, VIEW_WIDTH - right);
  const scaleY = makeScale(yExtent, height - bottom, top);

  const yTicks = showGrid || showYAxis ? niceTicks(yExtent, 4) : [];

  // X labels come from the densest series so gaps in a sparser one don't
  // thin out the axis.
  const densest = withPoints.reduce((a, b) => (b.points.length > a.points.length ? b : a));
  const xTicks = formatX && showXAxis ? sampleEvenly(densest.points, 6) : [];

  const build = smooth ? smoothLinePath : linePath;

  return (
    <svg
      viewBox={`0 0 ${VIEW_WIDTH} ${height}`}
      className={`h-auto w-full ${className}`}
      role="img"
      aria-label={ariaLabel ?? `Line chart: ${withPoints.map((s) => s.name).join(", ")}`}
    >
      {showArea && (
        <defs>
          {withPoints.map((s, i) => (
            <linearGradient key={s.name} id={`area-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color ?? seriesColor(i)} stopOpacity={0.25} />
              <stop offset="100%" stopColor={s.color ?? seriesColor(i)} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
      )}

      {showGrid &&
        yTicks.map((tick) => (
          <line
            key={`grid-${tick}`}
            x1={left}
            x2={VIEW_WIDTH - right}
            y1={scaleY(tick)}
            y2={scaleY(tick)}
            stroke="var(--border)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}

      {showYAxis &&
        yTicks.map((tick) => (
          <text
            key={`ylabel-${tick}`}
            x={left - 8}
            y={scaleY(tick)}
            textAnchor="end"
            dominantBaseline="middle"
            fontSize={11}
            fill="var(--faint-foreground)"
          >
            {formatY(tick)}
          </text>
        ))}

      {formatX &&
        xTicks.map((point, i) => (
          <text
            key={`xlabel-${point.x}-${i}`}
            x={scaleX(point.x)}
            y={height - 8}
            textAnchor="middle"
            fontSize={11}
            fill="var(--faint-foreground)"
          >
            {formatX(point.x)}
          </text>
        ))}

      {withPoints.map((s, i) => {
        const color = s.color ?? seriesColor(i);
        const d = build(s.points, scaleX, scaleY);
        return (
          <g key={s.name}>
            {showArea && (
              <path d={areaPathFrom(d, s.points, scaleX, height - bottom)} fill={`url(#area-${i})`} />
            )}
            <path
              d={d}
              fill="none"
              stroke={color}
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            {showDots &&
              s.points.map((p, pi) => (
                <circle
                  key={`${s.name}-${pi}`}
                  cx={scaleX(p.x)}
                  cy={scaleY(p.y)}
                  r={2.5}
                  fill={color}
                />
              ))}
          </g>
        );
      })}
    </svg>
  );
}
