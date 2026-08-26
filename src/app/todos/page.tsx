import Link from "next/link";
import { verifySession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { TaskRow, type TaskRowData } from "@/components/task-row";
import { EmptyState } from "@/components/empty-state";
import { PRIORITIES } from "@/lib/enums";
import { createTask } from "./actions";

export const dynamic = "force-dynamic";

type Filter = { key: string; label: string };

export default async function TodosPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; show?: string }>;
}) {
  await verifySession();

  const { filter = "all", show = "open" } = await searchParams;
  const showDone = show === "done";

  const [areas, clients, projects] = await Promise.all([
    prisma.area.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.client.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.project.findMany({
      where: { status: { not: "archived" } },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  // Filter keys are either "area:<id>", "client:<id>", "projects", or "all".
  const filters: Filter[] = [
    { key: "all", label: "All" },
    ...areas.map((area) => ({ key: `area:${area.id}`, label: area.name })),
    { key: "projects", label: "Projects" },
    ...clients.map((client) => ({ key: `client:${client.id}`, label: client.name })),
  ];

  const [scope, id] = filter.split(":");
  const scopeWhere =
    scope === "area" && id
      ? { areaId: id }
      : scope === "client" && id
        ? { clientId: id }
        : filter === "projects"
          ? { projectId: { not: null } }
          : {};

  const tasks = await prisma.task.findMany({
    where: {
      ...scopeWhere,
      status: showDone ? "done" : { not: "done" },
    },
    orderBy: showDone
      ? { completedAt: "desc" }
      : [{ sprint: "desc" }, { sortOrder: "asc" }],
    include: {
      area: true,
      client: true,
      project: { select: { name: true } },
    },
  });

  const sprintTasks = tasks.filter((task) => task.sprint);
  const backlogTasks = tasks.filter((task) => !task.sprint);

  function hrefFor(nextFilter: string, nextShow: string) {
    const params = new URLSearchParams();
    if (nextFilter !== "all") params.set("filter", nextFilter);
    if (nextShow !== "open") params.set("show", nextShow);
    const query = params.toString();
    return query ? `/todos?${query}` : "/todos";
  }

  return (
    <div className="page">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Todos</h1>
          <p className="page-subtitle">
            {showDone ? `${tasks.length} completed` : `${tasks.length} open`}
          </p>
        </div>

        <div className="segment">
          <Link
            href={hrefFor(filter, "open")}
            className={`segment-item ${!showDone ? "segment-item-active" : ""}`}
          >
            Open
          </Link>
          <Link
            href={hrefFor(filter, "done")}
            className={`segment-item ${showDone ? "segment-item-active" : ""}`}
          >
            Done
          </Link>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-1.5">
        {filters.map((entry) => (
          <Link
            key={entry.key}
            href={hrefFor(entry.key, show)}
            className={`btn-ghost px-3 py-1 text-xs ${
              filter === entry.key ? "bg-surface-hover text-foreground" : ""
            }`}
          >
            {entry.label}
          </Link>
        ))}
      </div>

      {!showDone && sprintTasks.length > 0 && (
        <section className="mt-7">
          <h2 className="section-title text-accent">
            ⚡ SPRINT — RIGHT NOW ({sprintTasks.length})
          </h2>
          <div className="mt-3 flex flex-col gap-2">
            {sprintTasks.map((task) => (
              <TaskRow key={task.id} task={task as TaskRowData} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-7">
        {!showDone && sprintTasks.length > 0 && <h2 className="section-title">Backlog</h2>}
        <div className="mt-3 flex flex-col gap-2">
          {tasks.length === 0 && (
            <EmptyState message={showDone ? "Nothing completed yet." : "No open tasks here."} />
          )}
          {(showDone ? tasks : backlogTasks).map((task) => (
            <TaskRow key={task.id} task={task as TaskRowData} />
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="section-title">Add task</h2>
        <form action={createTask} className="card mt-3 grid gap-3 sm:grid-cols-6">
          <div className="sm:col-span-3">
            <label htmlFor="title" className="field-label">
              Title
            </label>
            <input id="title" name="title" required className="input mt-1" />
          </div>

          <div>
            <label htmlFor="priority" className="field-label">
              Priority
            </label>
            <select id="priority" name="priority" className="input mt-1" defaultValue="medium">
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="dueDate" className="field-label">
              Due
            </label>
            <input id="dueDate" name="dueDate" type="date" className="input mt-1" />
          </div>

          <div className="flex items-end pb-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" name="sprint" className="cursor-pointer" />
              Sprint
            </label>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="areaId" className="field-label">
              Area
            </label>
            <select id="areaId" name="areaId" className="input mt-1" defaultValue="">
              <option value="">None</option>
              {areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="clientId" className="field-label">
              Client
            </label>
            <select id="clientId" name="clientId" className="input mt-1" defaultValue="">
              <option value="">None</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="projectId" className="field-label">
              Project
            </label>
            <select id="projectId" name="projectId" className="input mt-1" defaultValue="">
              <option value="">None</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-6">
            <button type="submit" className="btn-primary">
              Add task
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
