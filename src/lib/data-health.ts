import { prisma } from "@/lib/prisma";
import { subDays, startOfDay } from "date-fns";
import {
  HEALTH_HIGHER_IS_BETTER,
  HEALTH_METRIC_LABELS,
  HEALTH_METRIC_TYPES,
  type HealthMetricType,
} from "@/lib/enums";
import { percentChange } from "@/lib/format";

export type MetricPoint = { date: Date; value: number };

export type MetricSummary = {
  type: HealthMetricType;
  label: string;
  unit: string;
  /** Most recent reading, or null when nothing has ever been logged. */
  latest: number | null;
  latestDate: Date | null;
  /** Mean over the recent window, which is what the tiles show. */
  average: number | null;
  /** Percent change of the recent window against the window before it. */
  delta: number | null;
  /** True when `delta` moves in the direction that is good for this metric. */
  trendGood: boolean | null;
  points: MetricPoint[];
};

/** Every reading of one metric, oldest first. */
export async function getMetricSeries(
  type: HealthMetricType,
  days?: number,
): Promise<MetricPoint[]> {
  const rows = await prisma.healthMetric.findMany({
    where: {
      type,
      ...(days ? { date: { gte: subDays(startOfDay(new Date()), days) } } : {}),
    },
    orderBy: { date: "asc" },
    select: { date: true, value: true },
  });
  return rows.map((row) => ({ date: row.date, value: row.value }));
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Summarises one metric over a trailing window.
 *
 * The delta compares the window against the equally sized window before it,
 * and `trendGood` folds in whether rising is good for this particular metric
 * — resting HR going up is bad, VO₂ max going up is good.
 */
export async function getMetricSummary(
  type: HealthMetricType,
  windowDays = 30,
): Promise<MetricSummary> {
  const today = startOfDay(new Date());
  const windowStart = subDays(today, windowDays);
  const previousStart = subDays(windowStart, windowDays);

  const [all, unitRow] = await Promise.all([
    prisma.healthMetric.findMany({
      where: { type, date: { gte: previousStart } },
      orderBy: { date: "asc" },
      select: { date: true, value: true, unit: true },
    }),
    prisma.healthMetric.findFirst({
      where: { type },
      orderBy: { date: "desc" },
      select: { unit: true, value: true, date: true },
    }),
  ]);

  const current = all.filter((row) => row.date >= windowStart);
  const previous = all.filter((row) => row.date < windowStart);

  const currentMean = mean(current.map((r) => r.value));
  const previousMean = mean(previous.map((r) => r.value));
  const delta =
    currentMean === null || previousMean === null ? null : percentChange(currentMean, previousMean);

  const higherIsBetter = HEALTH_HIGHER_IS_BETTER[type];

  return {
    type,
    label: HEALTH_METRIC_LABELS[type],
    unit: unitRow?.unit ?? "",
    latest: unitRow?.value ?? null,
    latestDate: unitRow?.date ?? null,
    average: currentMean,
    delta,
    trendGood: delta === null ? null : higherIsBetter ? delta >= 0 : delta <= 0,
    points: current.map((row) => ({ date: row.date, value: row.value })),
  };
}

/** Summaries for every metric type, for the tile grid. */
export async function getAllMetricSummaries(windowDays = 30): Promise<MetricSummary[]> {
  return Promise.all(HEALTH_METRIC_TYPES.map((type) => getMetricSummary(type, windowDays)));
}

/** Formats a value with the precision that metric deserves. */
export function formatMetricValue(type: HealthMetricType, value: number | null): string {
  if (value === null) return "—";
  if (type === "steps" || type === "active_energy" || type === "resting_hr" || type === "hrv") {
    return Math.round(value).toLocaleString("en-US");
  }
  return value.toFixed(1);
}
