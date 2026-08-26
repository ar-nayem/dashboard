import Link from "next/link";
import { verifySession } from "@/lib/session";
import { Sparkline } from "@/components/charts/sparkline";
import { SegmentedControl } from "@/components/segmented-control";
import { EmptyState } from "@/components/empty-state";
import { StatusChip } from "@/components/chips";
import { Private } from "@/components/private";
import { getProjectCards } from "@/lib/data-projects";
import { DAY_WINDOWS, DAY_WINDOW_OPTIONS, type DayWindow } from "@/lib/periods";
import { PROJECT_STATUSES, parseEnum } from "@/lib/enums";
import { formatCurrency, formatNumber, formatPercentDelta, formatRelative } from "@/lib/format";
import { createProject } from "./actions";

export const dynamic = "force-dynamic";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string; status?: string }>;
}) {
  await verifySession();

  const params = await searchParams;
  const window = parseEnum(DAY_WINDOWS, params.window) as DayWindow;
  const statusFilter = params.status ?? "all";

  const cards = await getProjectCards(Number(window));
  const visible =
    statusFilter === "all" ? cards : cards.filter((card) => card.status === statusFilter);

  return (
    <div className="page">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-subtitle">{visible.length} tracked</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5">
            <Link
              href={`/projects?window=${window}`}
              className={`btn-ghost px-3 py-1 text-xs ${
                statusFilter === "all" ? "bg-surface-hover text-foreground" : ""
              }`}
            >
              All
            </Link>
            {PROJECT_STATUSES.map((status) => (
              <Link
                key={status}
                href={`/projects?window=${window}&status=${status}`}
                className={`btn-ghost px-3 py-1 text-xs ${
                  statusFilter === status ? "bg-surface-hover text-foreground" : ""
                }`}
              >
                {status}
              </Link>
            ))}
          </div>

          <SegmentedControl
            options={DAY_WINDOW_OPTIONS}
            value={window}
            paramName="window"
            basePath="/projects"
            otherParams={{ status: statusFilter === "all" ? undefined : statusFilter }}
            ariaLabel="Metrics window"
          />
        </div>
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.length === 0 && (
          <div className="md:col-span-2 xl:col-span-3">
            <EmptyState message="No projects match this filter." />
          </div>
        )}

        {visible.map((card) => {
          // Show whichever metric this project actually tracks.
          const primary =
            card.metrics.installs !== null
              ? { label: "Installs", value: formatNumber(card.metrics.installs), delta: card.metrics.installsDelta }
              : card.metrics.uniqueVisitors !== null
                ? {
                    label: "Unique visitors",
                    value: formatNumber(card.metrics.uniqueVisitors),
                    delta: card.metrics.visitorsDelta,
                  }
                : { label: "Revenue", value: formatCurrency(card.metrics.revenue), delta: card.metrics.revenueDelta };

          return (
            <Link
              key={card.id}
              href={`/projects/${card.slug}`}
              className="card flex flex-col transition-colors duration-150 hover:bg-surface-hover"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="truncate font-medium text-foreground">{card.name}</span>
                <StatusChip status={card.status} />
              </div>

              <span className="mt-1 text-xs text-faint-foreground">
                Updated {formatRelative(card.updatedAt)}
              </span>

              <div className="mt-4 flex items-end justify-between gap-3">
                <div>
                  <span className="tnum block text-2xl font-semibold text-foreground">
                    <Private chars={4}>{primary.value}</Private>
                  </span>
                  <span className="text-[11px] text-muted-foreground">{primary.label}</span>
                </div>

                {card.metrics.spark.length > 1 && (
                  <div className="w-28">
                    <Sparkline
                      values={card.metrics.spark}
                      color="var(--series-2)"
                      ariaLabel={`${card.name} trend`}
                    />
                  </div>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span className="tnum text-muted-foreground">
                  Revenue <Private chars={4}>{formatCurrency(card.metrics.revenue)}</Private>
                </span>
                {primary.delta !== null && (
                  <span className={primary.delta >= 0 ? "text-success" : "text-danger"}>
                    {formatPercentDelta(primary.delta)}
                  </span>
                )}
              </div>

              <div className="mt-3 border-t border-border pt-3 text-xs">
                {card.pendingProposals > 0 && (
                  <span className="text-accent">
                    ✦ {card.pendingProposals} advisor proposal
                    {card.pendingProposals === 1 ? "" : "s"} — review
                  </span>
                )}
                {card.pendingProposals === 0 && card.nextStep && (
                  <span className="line-clamp-2 text-muted-foreground">≡ {card.nextStep}</span>
                )}
                {card.pendingProposals === 0 && !card.nextStep && (
                  <span className="text-faint-foreground">No next steps yet</span>
                )}
              </div>
            </Link>
          );
        })}
      </section>

      <section className="mt-10">
        <h2 className="section-title">Add project</h2>
        <form action={createProject} className="card mt-3 grid gap-3 sm:grid-cols-6">
          <div className="sm:col-span-2">
            <label htmlFor="name" className="field-label">
              Name
            </label>
            <input id="name" name="name" required className="input mt-1" />
          </div>
          <div>
            <label htmlFor="status" className="field-label">
              Status
            </label>
            <select id="status" name="status" className="input mt-1" defaultValue="building">
              {PROJECT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="kind" className="field-label">
              Kind
            </label>
            <select id="kind" name="kind" className="input mt-1" defaultValue="app">
              <option value="app">app</option>
              <option value="site">site</option>
              <option value="store">store</option>
              <option value="other">other</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="url" className="field-label">
              URL
            </label>
            <input id="url" name="url" type="url" className="input mt-1" />
          </div>
          <div className="sm:col-span-6">
            <label htmlFor="description" className="field-label">
              Description
            </label>
            <input id="description" name="description" className="input mt-1" />
          </div>
          <div className="sm:col-span-6">
            <button type="submit" className="btn-primary">
              Add project
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
