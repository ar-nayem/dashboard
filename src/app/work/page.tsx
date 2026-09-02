import { verifySession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/components/empty-state";
import { withBasePath } from "@/lib/base-path";
import { parseList } from "@/lib/enums";
import { createWorkItem, deleteWorkItem, reorderWorkItem, updateWorkItem } from "./actions";

export const dynamic = "force-dynamic";

export default async function WorkPage() {
  await verifySession();

  const items = await prisma.workItem.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <div className="page">
      <h1 className="page-title">Work</h1>
      <p className="page-subtitle">
        Project case studies shown on the portfolio site&apos;s Work section.
      </p>

      <section className="mt-6 flex flex-col gap-4">
        {items.length === 0 && <EmptyState message="No work items yet." />}

        {items.map((item, index) => (
          <div key={item.id} className="card">
            <div className="flex items-start gap-4">
              {item.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={withBasePath(item.image)}
                  alt={item.title}
                  className="h-20 w-28 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-20 w-28 shrink-0 items-center justify-center rounded-lg border border-dashed border-border text-xs text-faint-foreground">
                  No image
                </div>
              )}

              <form
                action={updateWorkItem}
                encType="multipart/form-data"
                className="grid min-w-0 flex-1 gap-2 sm:grid-cols-6"
              >
                <input type="hidden" name="id" value={item.id} />
                <input
                  name="title"
                  defaultValue={item.title}
                  placeholder="Title"
                  aria-label="Title"
                  className="input sm:col-span-3"
                />
                <input
                  name="role"
                  defaultValue={item.role}
                  placeholder="Role"
                  aria-label="Role"
                  className="input sm:col-span-3"
                />
                <textarea
                  name="description"
                  defaultValue={item.description}
                  placeholder="Description"
                  aria-label="Description"
                  rows={2}
                  className="input sm:col-span-6"
                />
                <input
                  name="tech"
                  defaultValue={parseList(item.tech).join(", ")}
                  placeholder="Tech tags, comma-separated"
                  aria-label="Tech tags"
                  className="input sm:col-span-4"
                />
                <input name="file" type="file" accept="image/*" className="input sm:col-span-2" />
                <div className="flex items-center gap-3 sm:col-span-6">
                  <button type="submit" className="btn-ghost px-3 py-1 text-xs">
                    Save
                  </button>
                  <span className="text-xs text-faint-foreground">/work/{item.slug}</span>
                </div>
              </form>

              <div className="flex shrink-0 flex-col items-end gap-2">
                <div className="flex gap-1">
                  <form action={reorderWorkItem}>
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="direction" value="up" />
                    <button
                      type="submit"
                      disabled={index === 0}
                      aria-label="Move up"
                      className="btn-ghost px-2 py-1 text-xs disabled:opacity-30"
                    >
                      ↑
                    </button>
                  </form>
                  <form action={reorderWorkItem}>
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="direction" value="down" />
                    <button
                      type="submit"
                      disabled={index === items.length - 1}
                      aria-label="Move down"
                      className="btn-ghost px-2 py-1 text-xs disabled:opacity-30"
                    >
                      ↓
                    </button>
                  </form>
                </div>
                <form action={deleteWorkItem}>
                  <input type="hidden" name="id" value={item.id} />
                  <button
                    type="submit"
                    aria-label={`Delete ${item.title}`}
                    className="cursor-pointer text-xs text-faint-foreground hover:text-danger"
                  >
                    Delete
                  </button>
                </form>
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="mt-10">
        <h2 className="section-title">Add work item</h2>
        <form
          action={createWorkItem}
          encType="multipart/form-data"
          className="card mt-3 grid gap-3 sm:grid-cols-6"
        >
          <div className="sm:col-span-3">
            <label htmlFor="title" className="field-label">
              Title
            </label>
            <input id="title" name="title" required className="input mt-1" />
          </div>
          <div className="sm:col-span-3">
            <label htmlFor="role" className="field-label">
              Role
            </label>
            <input id="role" name="role" className="input mt-1" />
          </div>
          <div className="sm:col-span-6">
            <label htmlFor="description" className="field-label">
              Description
            </label>
            <textarea id="description" name="description" rows={3} className="input mt-1" />
          </div>
          <div className="sm:col-span-4">
            <label htmlFor="tech" className="field-label">
              Tech tags (comma-separated)
            </label>
            <input id="tech" name="tech" placeholder="Logistics, Vendor Management" className="input mt-1" />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="file" className="field-label">
              Image
            </label>
            <input id="file" name="file" type="file" accept="image/*" className="input mt-1" />
          </div>
          <div className="sm:col-span-6">
            <button type="submit" className="btn-primary">
              Add work item
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
