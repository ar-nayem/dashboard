// Shared maths for the hand-rolled SVG charts. No chart library — these few
// helpers plus a <path> are the whole engine.

export type Point = { x: number; y: number };

export type Series = {
  name: string;
  points: Point[];
  /** Any CSS colour. Defaults to the series ramp in globals.css. */
  color?: string;
};

/** The ordered series ramp from globals.css, for callers that don't set one. */
export const SERIES_COLORS = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
];

export function seriesColor(index: number): string {
  return SERIES_COLORS[index % SERIES_COLORS.length];
}

export type Extent = { min: number; max: number };

/** Min/max across every point of every series. */
export function extentOf(series: Series[], axis: "x" | "y"): Extent {
  let min = Infinity;
  let max = -Infinity;
  for (const s of series) {
    for (const p of s.points) {
      const v = p[axis];
      if (!Number.isFinite(v)) continue;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  // No finite points at all — hand back a unit range so callers can still
  // build a scale without dividing by zero.
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1 };
  return { min, max };
}

/**
 * Pads a value range so the line never touches the top or bottom edge, and
 * so a dead-flat series still gets a drawable band instead of a zero-height
 * one.
 */
export function padExtent({ min, max }: Extent, ratio = 0.08): Extent {
  if (min === max) {
    // Flat series: open a band around the value. Magnitude-relative so it
    // works for both 0.5 and 500000, with an absolute floor for exact zero.
    const pad = Math.abs(min) * 0.1 || 1;
    return { min: min - pad, max: max + pad };
  }
  const pad = (max - min) * ratio;
  return { min: min - pad, max: max + pad };
}

/** Linear map from a data range onto a pixel range. */
export function makeScale(domain: Extent, rangeMin: number, rangeMax: number) {
  const span = domain.max - domain.min || 1;
  return (value: number) => rangeMin + ((value - domain.min) / span) * (rangeMax - rangeMin);
}

/** Straight-segment path. Skips non-finite points rather than breaking the path. */
export function linePath(
  points: Point[],
  scaleX: (v: number) => number,
  scaleY: (v: number) => number,
): string {
  const usable = points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (usable.length === 0) return "";
  return usable
    .map((p, i) => `${i === 0 ? "M" : "L"}${scaleX(p.x).toFixed(2)},${scaleY(p.y).toFixed(2)}`)
    .join(" ");
}

/**
 * Catmull-Rom smoothed path, converted to cubic béziers. Used for the big
 * trajectory charts where a smooth curve reads better than segments.
 */
export function smoothLinePath(
  points: Point[],
  scaleX: (v: number) => number,
  scaleY: (v: number) => number,
): string {
  const pts = points
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
    .map((p) => ({ x: scaleX(p.x), y: scaleY(p.y) }));

  if (pts.length === 0) return "";
  if (pts.length < 3) return linePath(points, scaleX, scaleY);

  let d = `M${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    // Clamp the neighbour lookups at both ends so the first and last
    // segments reuse the endpoint as its own control neighbour.
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;

    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return d;
}

/** Closes a line path down to `baseline` so it can be filled as an area. */
export function areaPathFrom(
  linePathData: string,
  points: Point[],
  scaleX: (v: number) => number,
  baseline: number,
): string {
  const usable = points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (!linePathData || usable.length === 0) return "";
  const firstX = scaleX(usable[0].x).toFixed(2);
  const lastX = scaleX(usable[usable.length - 1].x).toFixed(2);
  return `${linePathData} L${lastX},${baseline.toFixed(2)} L${firstX},${baseline.toFixed(2)} Z`;
}

/**
 * "Nice" evenly spaced tick values across a range — rounded to 1/2/5 x 10^n
 * so axis labels read as round numbers instead of 8347.22.
 */
export function niceTicks({ min, max }: Extent, count = 4): number[] {
  if (min === max) return [min];
  const rawStep = (max - min) / Math.max(1, count);
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalized = rawStep / magnitude;
  const stepMultiple = normalized >= 5 ? 10 : normalized >= 2 ? 5 : normalized >= 1 ? 2 : 1;
  const step = stepMultiple * magnitude;

  const ticks: number[] = [];
  const start = Math.ceil(min / step) * step;
  for (let v = start; v <= max + step * 0.001; v += step) {
    // Re-round each tick: repeated addition of a float step drifts
    // (0.1 + 0.2 ...), which would surface as 0.30000000000000004 labels.
    ticks.push(Number(v.toFixed(10)));
  }
  return ticks;
}

/**
 * Picks at most `count` evenly spaced entries, always including the first and
 * last. For x-axis labels where every point would overlap.
 */
export function sampleEvenly<T>(items: T[], count: number): T[] {
  if (items.length <= count) return items;
  if (count <= 1) return items.slice(0, 1);
  const step = (items.length - 1) / (count - 1);
  const picked: T[] = [];
  for (let i = 0; i < count; i++) {
    picked.push(items[Math.round(i * step)]);
  }
  return picked;
}
