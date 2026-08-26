import Link from "next/link";
import { verifySession } from "@/lib/session";
import { LineChart } from "@/components/charts/line-chart";
import { Sparkline } from "@/components/charts/sparkline";
import { Private } from "@/components/private";
import { EmptyState } from "@/components/empty-state";
import {
  getAllMetricSummaries,
  getMetricSeries,
  formatMetricValue,
} from "@/lib/data-health";
import { HEALTH_METRIC_LABELS, HEALTH_METRIC_TYPES, parseEnum, type HealthMetricType } from "@/lib/enums";
import { formatDate, formatShortDate, formatPercentDelta } from "@/lib/format";
import { logHealthMetric } from "./actions";

export const dynamic = "force-dynamic";

const CHART_RANGES = [
  { key: "90", label: "90d", days: 90 },
  { key: "365", label: "1y", days: 365 },
  { key: "all", label: "All time", days: undefined },
];

export default async function HealthPage({
  searchParams,
}: {
  searchParams: Promise<{ metric?: string; range?: string }>;
}) {
  await verifySession();

  const params = await searchParams;
  const metric = parseEnum(HEALTH_METRIC_TYPES, params.metric) as HealthMetricType;
  const range = CHART_RANGES.find((r) => r.key === params.range) ?? CHART_RANGES[2];

  const [summaries, series] = await Promise.all([
    getAllMetricSummaries(30),
    getMetricSeries(metric, range.days),
  ]);

  const featured = summaries.find((s) => s.type === metric)!;

  return (
    <div className="page">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">💚 Health</h1>
          <p className="page-subtitle">30-day averages, with the trend against the prior 30.</p>
        </div>

        <div className="segment">
          {CHART_RANGES.map((entry) => (
            <Link
              key={entry.key}
              href={`/health?metric=${metric}&range=${entry.key}`}
              scroll={false}
              className={`segment-item ${range.key === entry.key ? "segment-item-active" : ""}`}
            >
              {entry.label}
            </Link>
          ))}
        </div>
      </div>

      {/* --- Featured chart ---------------------------------------------- */}
      <section className="mt-6 card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="section-title">{featured.label}</h2>
            <span className="tnum mt-1 block text-2xl font-semibold text-foreground">
              <Private chars={4}>
                {formatMetricValue(metric, featured.latest)} {featured.unit}
              </Private>
            </span>
            {featured.latestDate && (
              <span className="text-xs text-faint-foreground">
                last measured {formatDate(featured.latestDate)}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {HEALTH_METRIC_TYPES.map((type) => (
              <Link
                key={type}
                href={`/health?metric=${type}&range=${range.key}`}
                scroll={false}
                className={`btn-ghost px-2.5 py-1 text-[11px] ${
                  metric === type ? "bg-accent/15 text-accent" : ""
                }`}
              >
                {HEALTH_METRIC_LABELS[type]}
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-5">
          {series.length === 0 ? (
            <EmptyState message={`No ${featured.label.toLowerCase()} readings logged yet.`} />
          ) : (
            <LineChart
              series={[
                {
                  name: featured.label,
                  points: series.map((p) => ({ x: p.date.getTime(), y: p.value })),
                  color: "var(--series-1)",
                },
              ]}
              height={280}
              showArea
              formatY={(v) => formatMetricValue(metric, v)}
              formatX={(v) => formatShortDate(new Date(v))}
              ariaLabel={`${featured.label} over ${range.label}`}
            />
          )}
        </div>
      </section>

      {/* --- All metrics -------------------------------------------------- */}
      <section className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {summaries.map((summary) => (
          <Link
            key={summary.type}
            href={`/health?metric=${summary.type}&range=${range.key}`}
            scroll={false}
            className={`tile transition-colors duration-150 hover:bg-surface-hover ${
              summary.type === metric ? "ring-1 ring-accent" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="tile-label">{summary.label}</span>
              {summary.delta !== null && (
                <span
                  className={`text-[10px] font-medium ${
                    summary.trendGood ? "text-success" : "text-danger"
                  }`}
                >
                  {summary.trendGood ? "" : "⚠ "}
                  {formatPercentDelta(summary.delta)}
                </span>
              )}
            </div>

            <span className="tile-value">
              <Private chars={4}>{formatMetricValue(summary.type, summary.average)}</Private>
            </span>
            <span className="text-xs text-faint-foreground">
              {summary.unit} · 30d avg
            </span>

            {summary.points.length > 1 && (
              <div className="mt-3">
                <Sparkline
                  values={summary.points.map((p) => p.value)}
                  color={summary.trendGood === false ? "var(--danger)" : "var(--success)"}
                  ariaLabel={`${summary.label} 30-day trend`}
                />
              </div>
            )}
          </Link>
        ))}
      </section>

      {/* --- Manual log --------------------------------------------------- */}
      <section className="mt-10">
        <h2 className="section-title">Log a reading</h2>
        <form action={logHealthMetric} className="card mt-3 grid gap-3 sm:grid-cols-4">
          <div>
            <label htmlFor="type" className="field-label">
              Metric
            </label>
            <select id="type" name="type" className="input mt-1" defaultValue={metric}>
              {HEALTH_METRIC_TYPES.map((type) => (
                <option key={type} value={type}>
                  {HEALTH_METRIC_LABELS[type]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="value" className="field-label">
              Value
            </label>
            <input
              id="value"
              name="value"
              type="number"
              step="0.1"
              required
              className="input mt-1"
            />
          </div>

          <div>
            <label htmlFor="date" className="field-label">
              Date
            </label>
            <input id="date" name="date" type="date" className="input mt-1" />
          </div>

          <div className="flex items-end">
            <button type="submit" className="btn-primary w-full">
              Log
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
