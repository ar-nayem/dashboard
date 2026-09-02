import { verifySession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/components/empty-state";
import { SERVICE_ICONS } from "@/lib/service-icons";
import { createService, deleteService, reorderService, updateService } from "./actions";

export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  await verifySession();

  const items = await prisma.service.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <div className="page">
      <h1 className="page-title">Services</h1>
      <p className="page-subtitle">The service tiles shown on the portfolio homepage.</p>

      <section className="mt-6 flex flex-col gap-3">
        {items.length === 0 && <EmptyState message="No services yet." />}

        {items.map((item, index) => (
          <div key={item.id} className="card flex items-start gap-4">
            <form action={updateService} className="grid min-w-0 flex-1 gap-2 sm:grid-cols-6">
              <input type="hidden" name="id" value={item.id} />
              <select
                name="icon"
                defaultValue={item.icon}
                aria-label="Icon"
                className="input sm:col-span-2"
              >
                {SERVICE_ICONS.map((icon) => (
                  <option key={icon} value={icon}>
                    {icon}
                  </option>
                ))}
              </select>
              <input
                name="title"
                defaultValue={item.title}
                placeholder="Title"
                aria-label="Title"
                className="input sm:col-span-4"
              />
              <textarea
                name="description"
                defaultValue={item.description}
                placeholder="Description"
                aria-label="Description"
                rows={2}
                className="input sm:col-span-6"
              />
              <div className="sm:col-span-6">
                <button type="submit" className="btn-ghost px-3 py-1 text-xs">
                  Save
                </button>
              </div>
            </form>

            <div className="flex shrink-0 flex-col items-end gap-2">
              <div className="flex gap-1">
                <form action={reorderService}>
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
                <form action={reorderService}>
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
              <form action={deleteService}>
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
        ))}
      </section>

      <section className="mt-10">
        <h2 className="section-title">Add service</h2>
        <form action={createService} className="card mt-3 grid gap-3 sm:grid-cols-6">
          <div className="sm:col-span-2">
            <label htmlFor="icon" className="field-label">
              Icon
            </label>
            <select id="icon" name="icon" className="input mt-1" defaultValue={SERVICE_ICONS[0]}>
              {SERVICE_ICONS.map((icon) => (
                <option key={icon} value={icon}>
                  {icon}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-4">
            <label htmlFor="title" className="field-label">
              Title
            </label>
            <input id="title" name="title" required className="input mt-1" />
          </div>
          <div className="sm:col-span-6">
            <label htmlFor="description" className="field-label">
              Description
            </label>
            <textarea id="description" name="description" rows={2} className="input mt-1" />
          </div>
          <div className="sm:col-span-6">
            <button type="submit" className="btn-primary">
              Add service
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
