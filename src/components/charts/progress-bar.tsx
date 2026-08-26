// Plain div bar — no SVG needed. Clamped to 0-100 so a goal that overshoots
// its target renders full rather than overflowing its track.
export function ProgressBar({
  percent,
  color = "var(--accent)",
  height = 6,
  className = "",
  label,
}: {
  percent: number;
  color?: string;
  height?: number;
  className?: string;
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0));

  return (
    <div
      className={`w-full overflow-hidden rounded-full bg-background ${className}`}
      style={{ height }}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? "Progress"}
    >
      <div
        className="h-full rounded-full transition-[width] duration-300"
        style={{ width: `${clamped}%`, background: color }}
      />
    </div>
  );
}
