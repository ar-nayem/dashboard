import Link from "next/link";
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
 *
 * `href` uses the "stretched link" pattern rather than wrapping the whole
 * tile in a <Link>: a toggle is itself a row of <Link>s, and nesting an
 * anchor inside another anchor is invalid HTML. The stretched link sits
 * beneath everything (z-0) and the toggle sits above it (z-10), so the whole
 * card is a click target except where a more specific control already is.
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
  href,
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
  /** Makes the whole tile a link to more detail — see note above. */
  href?: string;
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
    <div
      className={`tile relative flex flex-col ${
        href ? "transition-colors duration-150 hover:bg-surface-hover" : ""
      }`}
    >
      {href && (
        <Link href={href} className="absolute inset-0 z-0" aria-label={`View ${label} details`} />
      )}

      <div className="relative z-10 flex items-start justify-between gap-2">
        <span className="tile-label">
          {icon && <span aria-hidden="true">{icon}</span>}
          {label}
        </span>
        {(toggle ?? badge) && <span className="relative z-10">{toggle ?? badge}</span>}
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
