import Link from "next/link";
import { notFound } from "next/navigation";
import { verifySession } from "@/lib/session";
import { LineChart } from "@/components/charts/line-chart";
import { MetricTile } from "@/components/metric-tile";
import { SegmentedControl } from "@/components/segmented-control";
import { EmptyState } from "@/components/empty-state";
import { StatusChip } from "@/components/chips";
import { TaskRow, type TaskRowData } from "@/components/task-row";
import { getProjectBySlug, getProjectMetrics } from "@/lib/data-projects";
import { DAY_WINDOWS, DAY_WINDOW_OPTIONS, type DayWindow } from "@/lib/periods";
import { PROJECT_STATUSES, parseEnum } from "@/lib/enums";
import { formatCurrency, formatNumber, formatShortDate } from "@/lib/format";
import {
  acceptProposal,
  addProjectNote,
  addProjectTodo,
  deleteProjectNote,
  deleteProjectTodo,
  dismissProposal,
  setProjectStatus,
  toggleProjectTodo,
  updateProjectSources,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ window?: string }>;
}) {
  await verifySession();

  const { slug } = await params;
  const { window: windowParam } = await searchParams;
  const window = parseEnum(DAY_WINDOWS, windowParam) as DayWindow;

  const project = await getProjectBySlug(slug);
  if (!project) notFound();

  const metrics = await getProjectMetrics(project.id, Number(window));

  const totals = metrics.reduce(
    (acc, row) => ({
      installs: acc.installs + (row.installs ?? 0),
      revenue: acc.revenue + (row.revenue ?? 0),
      visitors: acc.visitors + (row.uniqueVisitors ?? 0),
    }),
    { installs: 0, revenue: 0, visitors: 0 },
  );

  const tracksInstalls = metrics.some((row) => row.installs !== null);
  const tracksVisitors = metrics.some((row) => row.uniqueVisitors !== null);

  const pending = project.proposals.filter((p) => p.status === "pending");
  const handled = project.proposals.filter((p) => p.status !== "pending");

  return (
    <div className="page">
      <Link href="/projects" className="text-xs text-muted-foreground hover:text-foreground">
        ← Projects
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="page-title">{project.name}</h1>
            <StatusChip status={project.status} />
          </div>
          {project.description && <p className="page-subtitle">{project.description}</p>}
          {project.url && (
            <a
              href={project.url}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-1 inline-block text-xs text-info hover:underline"
            >
              {project.url} ↗
            </a>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <form action={setProjectStatus}>
            <input type="hidden" name="id" value={project.id} />
            <select
              name="status"
              defaultValue={project.status}
              aria-label="Project status"
              className="input px-2 py-1 text-xs"
            >
              {PROJECT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <button type="submit" className="sr-only">
              Save status
            </button>
          </form>

          <SegmentedControl
            options={DAY_WINDOW_OPTIONS}
            value={window}
            paramName="window"
            basePath={`/projects/${project.slug}`}
            ariaLabel="Metrics window"
          />
        </div>
      </div>

      {/* --- Metrics ------------------------------------------------------ */}
      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        {tracksInstalls && (
          <MetricTile
            label="Installs"
            icon="⬇"
            value={formatNumber(totals.installs)}
            footnote={`Last ${window} days`}
            sensitive={false}
          />
        )}
        {tracksVisitors && (
          <MetricTile
            label="Unique Visitors"
            icon="👥"
            value={formatNumber(totals.visitors)}
            footnote={`Last ${window} days`}
            sensitive={false}
          />
        )}
        <MetricTile
          label="Revenue"
          icon="💵"
          value={formatCurrency(totals.revenue)}
          footnote={`Last ${window} days`}
        />
      </section>

      <section className="mt-4 card">
        <h2 className="section-title">Trend</h2>
        <div className="mt-4">
          {metrics.length === 0 ? (
            <EmptyState message="No metrics recorded in this window." />
          ) : (
            <LineChart
              series={[
                ...(tracksInstalls
                  ? [
                      {
                        name: "Installs",
                        points: metrics.map((row) => ({
                          x: row.date.getTime(),
                          y: row.installs ?? 0,
                        })),
                        color: "var(--series-2)",
                      },
                    ]
                  : []),
                ...(tracksVisitors
                  ? [
                      {
                        name: "Visitors",
                        points: metrics.map((row) => ({
                          x: row.date.getTime(),
                          y: row.uniqueVisitors ?? 0,
                        })),
                        color: "var(--series-3)",
                      },
                    ]
                  : []),
              ]}
              height={240}
              zeroBased
              showArea
              formatY={(v) => formatNumber(Math.round(v))}
              formatX={(v) => formatShortDate(new Date(v))}
              ariaLabel={`${project.name} metrics over ${window} days`}
            />
          )}
        </div>
      </section>

      {/* --- Data sources -------------------------------------------------- */}
      <section className="mt-8">
        <h2 className="section-title">Data sources</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Where the sync adapters should look for this project&apos;s numbers. Leave a field blank
          if this project has nothing at that source.
        </p>

        <form action={updateProjectSources} className="card mt-3 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="id" value={project.id} />

          <div>
            <label htmlFor="githubRepo" className="field-label">
              GitHub repo
            </label>
            <input
              id="githubRepo"
              name="githubRepo"
              defaultValue={project.githubRepo ?? ""}
              placeholder="owner/repo"
              className="input mt-1"
            />
          </div>

          <div>
            <label htmlFor="gaPropertyId" className="field-label">
              GA4 property ID
            </label>
            <input
              id="gaPropertyId"
              name="gaPropertyId"
              defaultValue={project.gaPropertyId ?? ""}
              placeholder="123456789"
              className="input mt-1"
            />
          </div>

          <div>
            <label htmlFor="gscSiteUrl" className="field-label">
              Search Console property
            </label>
            <input
              id="gscSiteUrl"
              name="gscSiteUrl"
              defaultValue={project.gscSiteUrl ?? ""}
              placeholder="sc-domain:example.com"
              className="input mt-1"
            />
          </div>

          <div>
            <label htmlFor="appStoreAppId" className="field-label">
              App Store app ID
            </label>
            <input
              id="appStoreAppId"
              name="appStoreAppId"
              defaultValue={project.appStoreAppId ?? ""}
              placeholder="6448001234"
              className="input mt-1"
            />
          </div>

          <div>
            <label htmlFor="revenueCatId" className="field-label">
              RevenueCat project ID
            </label>
            <input
              id="revenueCatId"
              name="revenueCatId"
              defaultValue={project.revenueCatId ?? ""}
              className="input mt-1"
            />
          </div>

          <div className="sm:col-span-2">
            <button type="submit" className="btn-primary">
              Save sources
            </button>
          </div>
        </form>
      </section>

      {/* --- Advisor proposals -------------------------------------------- */}
      <section className="mt-8">
        <h2 className="section-title">✦ Advisor proposals</h2>
        <div className="mt-3 flex flex-col gap-2">
          {pending.length === 0 && (
            <EmptyState message="No pending proposals." className="py-6" />
          )}

          {pending.map((proposal) => (
            <div key={proposal.id} className="card flex items-start gap-3 py-4">
              <p className="flex-1 text-sm text-foreground/90">{proposal.text}</p>
              <div className="flex shrink-0 gap-1">
                <form action={acceptProposal}>
                  <input type="hidden" name="id" value={proposal.id} />
                  <button
                    type="submit"
                    title="Accept — creates a to-do"
                    aria-label="Accept proposal"
                    className="cursor-pointer rounded px-1.5 py-0.5 text-sm text-faint-foreground hover:text-success"
                  >
                    ✓
                  </button>
                </form>
                <form action={dismissProposal}>
                  <input type="hidden" name="id" value={proposal.id} />
                  <button
                    type="submit"
                    title="Dismiss"
                    aria-label="Dismiss proposal"
                    className="cursor-pointer rounded px-1.5 py-0.5 text-sm text-faint-foreground hover:text-danger"
                  >
                    ✕
                  </button>
                </form>
              </div>
            </div>
          ))}

          {handled.length > 0 && (
            <details className="mt-1">
              <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                {handled.length} handled
              </summary>
              <div className="mt-2 flex flex-col gap-1.5">
                {handled.map((proposal) => (
                  <div key={proposal.id} className="flex items-start gap-2 text-xs">
                    <span
                      className={
                        proposal.status === "accepted" ? "text-success" : "text-faint-foreground"
                      }
                    >
                      {proposal.status === "accepted" ? "✓" : "✕"}
                    </span>
                    <span className="text-muted-foreground">{proposal.text}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      </section>

      {/* --- To-dos -------------------------------------------------------- */}
      <section className="mt-8">
        <h2 className="section-title">≡ To-do</h2>
        <div className="card mt-3 flex flex-col gap-2">
          {project.todos.length === 0 && (
            <p className="text-sm text-muted-foreground">Nothing yet.</p>
          )}

          {project.todos.map((todo) => (
            <div key={todo.id} className="flex items-start gap-2.5">
              <form action={toggleProjectTodo} className="mt-0.5 shrink-0">
                <input type="hidden" name="id" value={todo.id} />
                <button
                  type="submit"
                  aria-label={todo.done ? "Mark not done" : "Mark done"}
                  className={`h-4 w-4 cursor-pointer rounded border text-[10px] leading-none ${
                    todo.done
                      ? "border-success bg-success/20 text-success"
                      : "border-border hover:border-faint-foreground"
                  }`}
                >
                  {todo.done ? "✓" : ""}
                </button>
              </form>

              <span
                className={`flex-1 text-sm ${
                  todo.done ? "text-muted-foreground line-through" : "text-foreground/90"
                }`}
              >
                {todo.text}
              </span>

              <form action={deleteProjectTodo} className="shrink-0">
                <input type="hidden" name="id" value={todo.id} />
                <button
                  type="submit"
                  aria-label="Delete to-do"
                  className="cursor-pointer text-xs text-faint-foreground hover:text-danger"
                >
                  ✕
                </button>
              </form>
            </div>
          ))}

          <form action={addProjectTodo} className="mt-2 flex gap-2">
            <input type="hidden" name="projectId" value={project.id} />
            <input
              name="text"
              placeholder="Add a to-do…"
              aria-label="New to-do"
              className="input flex-1 py-1.5 text-xs"
            />
            <button type="submit" className="btn-ghost px-3 py-1.5 text-xs">
              +
            </button>
          </form>
        </div>
      </section>

      {/* --- Linked tasks -------------------------------------------------- */}
      {project.tasks.length > 0 && (
        <section className="mt-8">
          <h2 className="section-title">Linked tasks</h2>
          <div className="mt-3 flex flex-col gap-2">
            {project.tasks.map((task) => (
              <TaskRow key={task.id} task={task as TaskRowData} />
            ))}
          </div>
        </section>
      )}

      {/* --- Next version notes -------------------------------------------- */}
      <section className="mt-8">
        <h2 className="section-title">Next version notes</h2>
        <div className="card mt-3 flex flex-col gap-2">
          {project.notes.length === 0 && (
            <p className="text-sm text-muted-foreground">No notes yet.</p>
          )}

          {project.notes.map((note) => (
            <div key={note.id} className="flex items-start justify-between gap-2">
              <span className="text-sm text-foreground/90">- {note.body}</span>
              <form action={deleteProjectNote} className="shrink-0">
                <input type="hidden" name="id" value={note.id} />
                <button
                  type="submit"
                  aria-label="Delete note"
                  className="cursor-pointer text-xs text-faint-foreground hover:text-danger"
                >
                  ✕
                </button>
              </form>
            </div>
          ))}

          <form action={addProjectNote} className="mt-2 flex gap-2">
            <input type="hidden" name="projectId" value={project.id} />
            <input
              name="body"
              placeholder="Add a note…"
              aria-label="New note"
              className="input flex-1 py-1.5 text-xs"
            />
            <button type="submit" className="btn-ghost px-3 py-1.5 text-xs">
              +
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
