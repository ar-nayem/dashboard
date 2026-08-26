import { ProgressBar } from "@/components/charts/progress-bar";
import { Sparkline } from "@/components/charts/sparkline";
import { Private } from "@/components/private";
import { formatPercentDelta } from "@/lib/format";

/**
 * The tile used across Home, Finance, Health, and Projects.
 *
 * `deltaGood` decides the colour of the delta independently of its sign,
 * because "up" is not always good — resting heart rate rising is bad, net
 * worth rising is good. Pass null for a neutral grey delta.
 */
export function MetricTile({
  label,
  icon,
  value,
  target,
  delta,
  deltaGood,
  deltaSuffix = "YoY",
  progressPercent,
  progressColor,
  sparkValues,
  sparkColor,
  footnote,
  badge,
  toggle,
  sensitive = true,
  maskChars = 6,
}: {
  label: string;
  icon?: string;
  value: React.ReactNode;
  /** Rendered after the value as "/ $100.0k". */
  target?: React.ReactNode;
  delta?: number | null;
  deltaGood?: boolean | null;
  deltaSuffix?: string;
  progressPercent?: number;
  progressColor?: string;
  sparkValues?: number[];
  sparkColor?: string;
  footnote?: string;
  badge?: React.ReactNode;
  /** A <SegmentedControl>, shown top-right. */
  toggle?: React.ReactNode;
  /** Hide the value under privacy mode. True for money, false for counts. */
  sensitive?: boolean;
  maskChars?: number;
}) {
  const deltaColor =
    deltaGood === null || deltaGood === undefined
      ? "text-muted-foreground"
      : deltaGood
        ? "text-success"
        : "text-danger";

  return (
    <div className="tile flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <span className="tile-label">
          {icon && <span aria-hidden="true">{icon}</span>}
          {label}
        </span>
        {toggle ?? badge}
      </div>

      <div className="flex flex-wrap items-baseline gap-1.5">
        <span className="tile-value">
          {sensitive ? <Private chars={maskChars}>{value}</Private> : value}
        </span>
        {target && <span className="tnum text-sm text-muted-foreground">/ {target}</span>}
      </div>

      {delta !== undefined && delta !== null && (
        <span className={`tnum mt-1 text-xs font-medium ${deltaColor}`}>
          {formatPercentDelta(delta)} {deltaSuffix}
        </span>
      )}

      {progressPercent !== undefined && (
        <ProgressBar
          percent={progressPercent}
          color={progressColor}
          className="mt-3"
          label={`${label} progress`}
        />
      )}

      {sparkValues && sparkValues.length > 1 && (
        <div className="mt-3">
          <Sparkline values={sparkValues} color={sparkColor} ariaLabel={`${label} trend`} />
        </div>
      )}

      {footnote && <span className="mt-2 text-xs text-faint-foreground">{footnote}</span>}
    </div>
  );
}
