import { verifySession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/components/empty-state";
import { withBasePath } from "@/lib/base-path";
import { createMediaItem, deleteMediaItem, reorderMediaItem, updateMediaItem } from "./actions";

export const dynamic = "force-dynamic";

export default async function MediaPage() {
  await verifySession();

  const items = await prisma.mediaItem.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <div className="page">
      <h1 className="page-title">Media</h1>
      <p className="page-subtitle">
        Pictures shown on the portfolio site&apos;s photography gallery.
      </p>

      <section className="mt-6 flex flex-col gap-3">
        {items.length === 0 && <EmptyState message="No media yet." />}

        {items.map((item, index) => (
          <div key={item.id} className="card flex items-start gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={withBasePath(item.url)}
              alt={item.title ?? ""}
              className="h-20 w-28 shrink-0 rounded-lg object-cover"
            />

            <form action={updateMediaItem} className="flex min-w-0 flex-1 flex-wrap gap-2">
              <input type="hidden" name="id" value={item.id} />
              <input
                name="title"
                defaultValue={item.title ?? ""}
                placeholder="Title (optional)"
                aria-label="Title"
                className="input flex-1 basis-40"
              />
              <input
                name="link"
                defaultValue={item.link ?? ""}
                placeholder="Link (optional)"
                aria-label="Link"
                className="input flex-1 basis-40"
              />
              <button type="submit" className="btn-ghost px-3 py-1 text-xs">
                Save
              </button>
            </form>

            <div className="flex shrink-0 flex-col items-end gap-2">
              <div className="flex gap-1">
                <form action={reorderMediaItem}>
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
                <form action={reorderMediaItem}>
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
              <form action={deleteMediaItem}>
                <input type="hidden" name="id" value={item.id} />
                <button
                  type="submit"
                  aria-label={`Delete ${item.title ?? "media item"}`}
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
        <h2 className="section-title">Add media</h2>
        <form
          action={createMediaItem}
          encType="multipart/form-data"
          className="card mt-3 grid gap-3 sm:grid-cols-6"
        >
          <div className="sm:col-span-3">
            <label htmlFor="file" className="field-label">
              File (JPEG, PNG, WebP, GIF, SVG — up to 20MB)
            </label>
            <input
              id="file"
              name="file"
              type="file"
              accept="image/*"
              required
              className="input mt-1"
            />
          </div>
          <div className="sm:col-span-3">
            <label htmlFor="title" className="field-label">
              Title
            </label>
            <input id="title" name="title" className="input mt-1" />
          </div>
          <div className="sm:col-span-6">
            <label htmlFor="link" className="field-label">
              Link (optional — opens when a viewer clicks this photo)
            </label>
            <input id="link" name="link" type="url" placeholder="https://…" className="input mt-1" />
          </div>
          <div className="sm:col-span-6">
            <button type="submit" className="btn-primary">
              Upload
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
