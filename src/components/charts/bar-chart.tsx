import { niceTicks, padExtent } from "@/lib/chart";

const VIEW_WIDTH = 800;

export type Bar = { label: string; value: number; color?: string };

// Vertical bars for monthly income/expense breakdowns. Bars are laid out on
// an even grid rather than a continuous x scale, since the categories are
// discrete.
export function BarChart({
  bars,
  height = 220,
  yAxisWidth = 52,
  formatY = (v: number) => String(Math.round(v)),
  color = "var(--series-1)",
  className = "",
  ariaLabel = "Bar chart",
}: {
  bars: Bar[];
  height?: number;
  yAxisWidth?: number;
  formatY?: (value: number) => string;
  color?: string;
  className?: string;
  ariaLabel?: string;
}) {
  if (bars.length === 0) {
    return (
      <div
        style={{ height }}
        className={`flex items-center justify-center text-sm text-faint-foreground ${className}`}
      >
        No data yet
      </div>
    );
  }

  const left = yAxisWidth;
  const right = 12;
  const top = 12;
  const bottom = 28;

  const values = bars.map((b) => b.value);
  // Always anchored at zero — a bar chart that doesn't start at zero
  // misrepresents the ratios between bars.
  const domain = padExtent({ min: Math.min(0, ...values), max: Math.max(0, ...values) }, 0.05);
  const plotHeight = height - top - bottom;
  const scaleY = (v: number) =>
    height - bottom - ((v - domain.min) / (domain.max - domain.min || 1)) * plotHeight;

  const plotWidth = VIEW_WIDTH - left - right;
  const slot = plotWidth / bars.length;
  const barWidth = Math.min(48, slot * 0.6);
  const zeroY = scaleY(0);
  const ticks = niceTicks(domain, 4);

  return (
    <svg
      viewBox={`0 0 ${VIEW_WIDTH} ${height}`}
      className={`h-auto w-full ${className}`}
      role="img"
      aria-label={ariaLabel}
    >
      {ticks.map((tick) => (
        <g key={tick}>
          <line
            x1={left}
            x2={VIEW_WIDTH - right}
            y1={scaleY(tick)}
            y2={scaleY(tick)}
            stroke="var(--border)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          <text
            x={left - 8}
            y={scaleY(tick)}
            textAnchor="end"
            dominantBaseline="middle"
            fontSize={11}
            fill="var(--faint-foreground)"
          >
            {formatY(tick)}
          </text>
        </g>
      ))}

      {bars.map((bar, i) => {
        const centerX = left + slot * i + slot / 2;
        const valueY = scaleY(bar.value);
        // Negative bars hang below the zero line, so the rect's y is
        // whichever of the two is higher on screen.
        const barTop = Math.min(valueY, zeroY);
        const barHeight = Math.max(1, Math.abs(zeroY - valueY));

        return (
          <g key={`${bar.label}-${i}`}>
            <rect
              x={centerX - barWidth / 2}
              y={barTop}
              width={barWidth}
              height={barHeight}
              rx={3}
              fill={bar.color ?? color}
            />
            <text
              x={centerX}
              y={height - 9}
              textAnchor="middle"
              fontSize={11}
              fill="var(--faint-foreground)"
            >
              {bar.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
