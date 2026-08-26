import Link from "next/link";
import { verifySession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/components/empty-state";
import { AreaBadge } from "@/components/chips";
import { IDEA_CATEGORIES, IDEA_STATUSES } from "@/lib/enums";
import { createIdea, deleteIdea, setIdeaStatus } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_COLOR: Record<string, string> = {
  open: "bg-warning",
  building: "bg-info",
  shipped: "bg-success",
  dropped: "bg-faint-foreground",
};

export default async function IdeasPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  await verifySession();

  const { category } = await searchParams;
  const active = (IDEA_CATEGORIES as readonly string[]).includes(category ?? "")
    ? category!
    : IDEA_CATEGORIES[0];

  const [ideas, areas] = await Promise.all([
    prisma.idea.findMany({
      where: { category: active },
      orderBy: [{ status: "asc" }, { sortOrder: "asc" }],
      include: { area: true },
    }),
    prisma.area.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <div className="page">
      <h1 className="page-title">Ideas Board</h1>
      <p className="page-subtitle">Everything worth maybe building.</p>

      <div className="mt-5 flex flex-wrap gap-1.5">
        {IDEA_CATEGORIES.map((entry) => (
          <Link
            key={entry}
            href={`/ideas?category=${entry}`}
            className={`btn-ghost px-3 py-1 text-xs capitalize ${
              active === entry ? "bg-surface-hover text-foreground" : ""
            }`}
          >
            {entry}
          </Link>
        ))}
      </div>

      <section className="mt-6 flex flex-col gap-3">
        {ideas.length === 0 && <EmptyState message={`No ${active} ideas yet.`} />}

        {ideas.map((idea) => (
          <div key={idea.id} className="card">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2.5">
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    STATUS_COLOR[idea.status] ?? STATUS_COLOR.open
                  }`}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <h2
                    className={`font-medium ${
                      idea.status === "dropped"
                        ? "text-muted-foreground line-through"
                        : "text-foreground"
                    }`}
                  >
                    {idea.title}
                  </h2>
                  {idea.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{idea.description}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <AreaBadge area={idea.area} />
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <form action={setIdeaStatus}>
                  <input type="hidden" name="id" value={idea.id} />
                  <select
                    name="status"
                    defaultValue={idea.status}
                    aria-label={`Status of ${idea.title}`}
                    className="input px-2 py-1 text-xs"
                  >
                    {IDEA_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="sr-only">
                    Save status
                  </button>
                </form>

                <form action={deleteIdea}>
                  <input type="hidden" name="id" value={idea.id} />
                  <button
                    type="submit"
                    aria-label={`Delete ${idea.title}`}
                    className="cursor-pointer text-xs text-faint-foreground hover:text-danger"
                  >
                    ✕
                  </button>
                </form>
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="mt-10">
        <h2 className="section-title">Add idea</h2>
        <form action={createIdea} className="card mt-3 grid gap-3 sm:grid-cols-6">
          <div className="sm:col-span-3">
            <label htmlFor="title" className="field-label">
              Title
            </label>
            <input id="title" name="title" required className="input mt-1" />
          </div>
          <div>
            <label htmlFor="category" className="field-label">
              Category
            </label>
            <select id="category" name="category" className="input mt-1" defaultValue={active}>
              {IDEA_CATEGORIES.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
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
          <div className="sm:col-span-6">
            <label htmlFor="description" className="field-label">
              Description
            </label>
            <textarea id="description" name="description" rows={2} className="input mt-1" />
          </div>
          <div className="sm:col-span-6">
            <button type="submit" className="btn-primary">
              Add idea
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
