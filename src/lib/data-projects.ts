import { prisma } from "@/lib/prisma";
import { dayRange } from "@/lib/periods";
import { percentChange } from "@/lib/format";

export type ProjectMetricSummary = {
  installs: number | null;
  revenue: number;
  uniqueVisitors: number | null;
  installsDelta: number | null;
  revenueDelta: number | null;
  visitorsDelta: number | null;
  /** Daily values over the window, for the sparkline. */
  spark: number[];
};

export type ProjectCard = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  kind: string;
  url: string | null;
  updatedAt: Date;
  metrics: ProjectMetricSummary;
  openTodos: number;
  pendingProposals: number;
  nextStep: string | null;
};

/**
 * Sums a window of daily metric rows.
 *
 * Nullable columns stay null when a project never records that metric at all
 * (an Etsy store has no installs), rather than collapsing to a misleading 0.
 */
function summarize(
  rows: { installs: number | null; revenue: number | null; uniqueVisitors: number | null }[],
): { installs: number | null; revenue: number; visitors: number | null } {
  const hasInstalls = rows.some((row) => row.installs !== null);
  const hasVisitors = rows.some((row) => row.uniqueVisitors !== null);

  return {
    installs: hasInstalls ? rows.reduce((sum, row) => sum + (row.installs ?? 0), 0) : null,
    revenue: rows.reduce((sum, row) => sum + (row.revenue ?? 0), 0),
    visitors: hasVisitors ? rows.reduce((sum, row) => sum + (row.uniqueVisitors ?? 0), 0) : null,
  };
}

/** Project cards with metrics windowed to the last `days` days. */
export async function getProjectCards(days: number): Promise<ProjectCard[]> {
  const { current, previous } = dayRange(days);

  const projects = await prisma.project.findMany({
    where: { status: { not: "archived" } },
    orderBy: { sortOrder: "asc" },
    include: {
      metrics: {
        where: { date: { gte: previous.start, lte: current.end } },
        orderBy: { date: "asc" },
      },
      todos: { where: { done: false }, orderBy: { sortOrder: "asc" } },
      proposals: { where: { status: "pending" }, select: { id: true } },
    },
  });

  return projects.map((project) => {
    const currentRows = project.metrics.filter((row) => row.date >= current.start);
    const previousRows = project.metrics.filter((row) => row.date < current.start);

    const now = summarize(currentRows);
    const before = summarize(previousRows);

    return {
      id: project.id,
      name: project.name,
      slug: project.slug,
      description: project.description,
      status: project.status,
      kind: project.kind,
      url: project.url,
      updatedAt: project.updatedAt,
      metrics: {
        installs: now.installs,
        revenue: now.revenue,
        uniqueVisitors: now.visitors,
        installsDelta:
          now.installs === null || before.installs === null
            ? null
            : percentChange(now.installs, before.installs),
        revenueDelta: percentChange(now.revenue, before.revenue),
        visitorsDelta:
          now.visitors === null || before.visitors === null
            ? null
            : percentChange(now.visitors, before.visitors),
        // Whichever metric this project actually tracks drives its sparkline.
        spark: currentRows.map((row) =>
          row.installs !== null
            ? row.installs
            : row.uniqueVisitors !== null
              ? row.uniqueVisitors
              : (row.revenue ?? 0),
        ),
      },
      openTodos: project.todos.length,
      pendingProposals: project.proposals.length,
      nextStep: project.todos[0]?.text ?? null,
    };
  });
}

export async function getProjectBySlug(slug: string) {
  return prisma.project.findUnique({
    where: { slug },
    include: {
      todos: { orderBy: [{ done: "asc" }, { sortOrder: "asc" }] },
      proposals: { orderBy: [{ status: "asc" }, { createdAt: "desc" }] },
      notes: { orderBy: { createdAt: "desc" } },
      tasks: {
        where: { status: { not: "done" } },
        orderBy: { sortOrder: "asc" },
        include: { area: true, client: true, project: { select: { name: true } } },
      },
    },
  });
}

/** Daily metric rows for one project over a window, oldest first. */
export async function getProjectMetrics(projectId: string, days: number) {
  const { current } = dayRange(days);
  return prisma.projectMetric.findMany({
    where: { projectId, date: { gte: current.start, lte: current.end } },
    orderBy: { date: "asc" },
  });
}
