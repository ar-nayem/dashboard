const SERIES_COLORS = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
];

export type PieSlice = { label: string; value: number };

const RADIUS = 80;
const CENTER = 100;
const VIEW_SIZE = CENTER * 2;
// A ring rather than a filled disc — the hole leaves room for a headline
// figure in the middle, which is where the total ends up below.
const INNER_RADIUS = 46;

function arcPath(startAngle: number, endAngle: number): string {
  // A slice that fills the entire circle has no visible seam between its
  // start and end point, which SVG's arc flag can't express — draw it as two
  // half-arcs instead of one 360° arc.
  if (endAngle - startAngle >= Math.PI * 2 - 1e-6) {
    endAngle = startAngle + Math.PI * 2 - 1e-6;
  }

  const point = (angle: number, radius: number) => [
    CENTER + radius * Math.sin(angle),
    CENTER - radius * Math.cos(angle),
  ];

  const [x1, y1] = point(startAngle, RADIUS);
  const [x2, y2] = point(endAngle, RADIUS);
  const [x3, y3] = point(endAngle, INNER_RADIUS);
  const [x4, y4] = point(startAngle, INNER_RADIUS);

  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;

  return [
    `M ${x1} ${y1}`,
    `A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${INNER_RADIUS} ${INNER_RADIUS} 0 ${largeArc} 0 ${x4} ${y4}`,
    "Z",
  ].join(" ");
}

/**
 * A donut chart with a legend — category breakdowns (spending, income) across
 * the app. Hand-rolled SVG rather than a charting library, matching the
 * style of line-chart.tsx and bar-chart.tsx: theme-aware via CSS custom
 * properties, no client-side bundle weight for something this small.
 */
export function PieChart({
  slices,
  formatValue = (v: number) => String(Math.round(v)),
  className = "",
  ariaLabel = "Breakdown",
}: {
  slices: PieSlice[];
  formatValue?: (value: number) => string;
  className?: string;
  ariaLabel?: string;
}) {
  const positive = slices.filter((slice) => slice.value > 0);
  const total = positive.reduce((sum, slice) => sum + slice.value, 0);

  if (positive.length === 0 || total === 0) {
    return (
      <div className={`flex h-48 items-center justify-center text-sm text-faint-foreground ${className}`}>
        No data yet
      </div>
    );
  }

  // Built by folding a running cursor through the accumulator rather than
  // mutating a captured outer-scope variable during render — mutating one is
  // exactly the pattern the React Compiler's lint rule flags as unsafe to
  // memoize, even in a plain (non-hook) component function like this one.
  const arcs = positive.reduce<
    { cursor: number; slices: Array<PieSlice & { fraction: number; path: string; color: string }> }
  >(
    (acc, slice, index) => {
      const fraction = slice.value / total;
      const startAngle = acc.cursor * Math.PI * 2;
      const nextCursor = acc.cursor + fraction;
      const endAngle = nextCursor * Math.PI * 2;
      return {
        cursor: nextCursor,
        slices: [
          ...acc.slices,
          {
            ...slice,
            fraction,
            path: arcPath(startAngle, endAngle),
            color: SERIES_COLORS[index % SERIES_COLORS.length],
          },
        ],
      };
    },
    { cursor: 0, slices: [] },
  ).slices;

  return (
    <div className={`flex flex-col items-center gap-4 sm:flex-row sm:items-center ${className}`}>
      <svg
        viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
        className="h-44 w-44 shrink-0"
        role="img"
        aria-label={ariaLabel}
      >
        {arcs.map((arc) => (
          <path
            key={arc.label}
            d={arc.path}
            fill={arc.color}
            stroke="var(--surface)"
            strokeWidth={1.5}
          >
            <title>
              {arc.label}: {formatValue(arc.value)} ({(arc.fraction * 100).toFixed(1)}%)
            </title>
          </path>
        ))}
        <text
          x={CENTER}
          y={CENTER}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={15}
          fontWeight={600}
          fill="var(--foreground)"
        >
          {formatValue(total)}
        </text>
      </svg>

      <ul className="flex min-w-0 flex-1 flex-col gap-1.5">
        {arcs.map((arc) => (
          <li key={arc.label} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: arc.color }}
                aria-hidden="true"
              />
              <span className="truncate text-foreground/80">{arc.label}</span>
            </span>
            <span className="tnum shrink-0 text-faint-foreground">
              {(arc.fraction * 100).toFixed(0)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
