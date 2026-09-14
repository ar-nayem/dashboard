import { verifySession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/components/empty-state";
import { StatusChip } from "@/components/chips";
import { REPO_CATEGORIES, REPO_CATEGORY_LABELS, REPO_STATUSES, parseList } from "@/lib/enums";
import { getPm2Status, getDiskUsage, findPm2Status } from "@/lib/vps-health";
import { createRepo, deleteRepo, reorderRepo, updateRepo } from "./actions";

export const dynamic = "force-dynamic";

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "—";
  return `${(bytes / 1024 / 1024).toFixed(0)} MB`;
}

function formatUptime(ms: number | null): string {
  if (ms === null) return "—";
  const days = Math.floor(ms / 86_400_000);
  if (days > 0) return `${days}d`;
  const hours = Math.floor(ms / 3_600_000);
  if (hours > 0) return `${hours}h`;
  return `${Math.floor(ms / 60_000)}m`;
}

export default async function ReposPage() {
  await verifySession();

  const [repos, pm2Statuses, disk] = await Promise.all([
    prisma.repo.findMany({ orderBy: { sortOrder: "asc" } }),
    getPm2Status(),
    getDiskUsage(),
  ]);

  return (
    <div className="page">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Repos</h1>
          <p className="page-subtitle">
            {repos.length} tracked · {repos.filter((r) => r.public).length} public on arnayem.top
          </p>
        </div>

        {disk && (
          <div className="card px-4 py-2 text-xs">
            <span className="text-muted-foreground">Disk </span>
            <span
              className={`tnum font-medium ${
                disk.usedPercent >= 90 ? "text-danger" : disk.usedPercent >= 80 ? "text-warning" : "text-foreground"
              }`}
            >
              {disk.usedPercent}%
            </span>
            <span className="text-faint-foreground"> · {disk.available} free of {disk.size}</span>
          </div>
        )}
        {!disk && (
          <div className="card px-4 py-2 text-xs text-faint-foreground">
            Disk/pm2 unavailable (not running on the VPS)
          </div>
        )}
      </div>

      <section className="mt-6 flex flex-col gap-3">
        {repos.length === 0 && <EmptyState message="No repos tracked yet." />}

        {repos.map((repo, index) => {
          const health = findPm2Status(pm2Statuses, repo.pm2Name);

          return (
            <div key={repo.id} className="card flex flex-col gap-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">{repo.name}</span>
                    <StatusChip status={repo.status} />
                    {repo.public && (
                      <span className="badge px-2 py-0.5 text-[10px] text-accent">public</span>
                    )}
                    {repo.pm2Name && (
                      <span className="badge px-2 py-0.5 text-[10px]">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            health?.status === "online"
                              ? "bg-success"
                              : health
                                ? "bg-danger"
                                : "bg-faint-foreground"
                          }`}
                        />
                        {health ? `${health.status} · ${formatUptime(health.uptimeMs)} · ${formatBytes(health.memoryBytes)}` : "not found"}
                        {health && health.restarts > 0 && ` · ${health.restarts} restarts`}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{repo.description}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {parseList(repo.tech).map((t) => (
                      <span key={t} className="rounded border border-border px-1.5 py-0.5 text-[10px] text-faint-foreground">
                        {t}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs">
                    <a href={repo.githubUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                      GitHub ↗
                    </a>
                    {repo.liveUrl && (
                      <a href={repo.liveUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                        Live ↗
                      </a>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <form action={reorderRepo}>
                    <input type="hidden" name="id" value={repo.id} />
                    <input type="hidden" name="direction" value="up" />
                    <button type="submit" disabled={index === 0} aria-label="Move up" className="btn-ghost px-2 py-1 text-xs disabled:opacity-30">
                      ↑
                    </button>
                  </form>
                  <form action={reorderRepo}>
                    <input type="hidden" name="id" value={repo.id} />
                    <input type="hidden" name="direction" value="down" />
                    <button type="submit" disabled={index === repos.length - 1} aria-label="Move down" className="btn-ghost px-2 py-1 text-xs disabled:opacity-30">
                      ↓
                    </button>
                  </form>
                  <form action={deleteRepo}>
                    <input type="hidden" name="id" value={repo.id} />
                    <button type="submit" aria-label="Delete" className="cursor-pointer text-xs text-faint-foreground hover:text-danger">
                      Delete
                    </button>
                  </form>
                </div>
              </div>

              <details className="text-xs">
                <summary className="cursor-pointer text-faint-foreground hover:text-foreground">Edit</summary>
                <form action={updateRepo} className="mt-3 grid gap-3 sm:grid-cols-6">
                  <input type="hidden" name="id" value={repo.id} />
                  <div className="sm:col-span-2">
                    <label className="field-label">Name</label>
                    <input name="name" defaultValue={repo.name} required className="input mt-1" />
                  </div>
                  <div>
                    <label className="field-label">Category</label>
                    <select name="category" defaultValue={repo.category} className="input mt-1">
                      {REPO_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {REPO_CATEGORY_LABELS[c]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="field-label">Status</label>
                    <select name="status" defaultValue={repo.status} className="input mt-1">
                      {REPO_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="field-label">pm2 process name</label>
                    <input name="pm2Name" defaultValue={repo.pm2Name ?? ""} placeholder="e.g. salonbd" className="input mt-1" />
                  </div>
                  <div className="flex items-end pb-2">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" name="public" defaultChecked={repo.public} />
                      <span className="field-label">Public</span>
                    </label>
                  </div>
                  <div className="sm:col-span-3">
                    <label className="field-label">GitHub URL</label>
                    <input name="githubUrl" defaultValue={repo.githubUrl} required type="url" className="input mt-1" />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="field-label">Live URL</label>
                    <input name="liveUrl" defaultValue={repo.liveUrl ?? ""} type="url" className="input mt-1" />
                  </div>
                  <div className="sm:col-span-6">
                    <label className="field-label">Tech (comma-separated)</label>
                    <input name="tech" defaultValue={parseList(repo.tech).join(", ")} className="input mt-1" />
                  </div>
                  <div className="sm:col-span-6">
                    <label className="field-label">Description</label>
                    <textarea name="description" defaultValue={repo.description} rows={2} className="input mt-1" />
                  </div>
                  <div className="sm:col-span-6">
                    <button type="submit" className="btn-ghost px-3 py-1 text-xs">
                      Save
                    </button>
                  </div>
                </form>
              </details>
            </div>
          );
        })}
      </section>

      <section className="mt-10">
        <h2 className="section-title">Add repo</h2>
        <form action={createRepo} className="card mt-3 grid gap-3 sm:grid-cols-6">
          <div className="sm:col-span-2">
            <label htmlFor="name" className="field-label">Name</label>
            <input id="name" name="name" required className="input mt-1" />
          </div>
          <div>
            <label htmlFor="category" className="field-label">Category</label>
            <select id="category" name="category" className="input mt-1" defaultValue="site">
              {REPO_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {REPO_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="status" className="field-label">Status</label>
            <select id="status" name="status" className="input mt-1" defaultValue="live">
              {REPO_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="pm2Name" className="field-label">pm2 process name</label>
            <input id="pm2Name" name="pm2Name" className="input mt-1" />
          </div>
          <div className="sm:col-span-3">
            <label htmlFor="githubUrl" className="field-label">GitHub URL</label>
            <input id="githubUrl" name="githubUrl" required type="url" className="input mt-1" />
          </div>
          <div className="sm:col-span-3">
            <label htmlFor="liveUrl" className="field-label">Live URL</label>
            <input id="liveUrl" name="liveUrl" type="url" className="input mt-1" />
          </div>
          <div className="sm:col-span-6">
            <label htmlFor="tech" className="field-label">Tech (comma-separated)</label>
            <input id="tech" name="tech" placeholder="Next.js, Prisma, Tailwind" className="input mt-1" />
          </div>
          <div className="sm:col-span-6">
            <label htmlFor="description" className="field-label">Description</label>
            <textarea id="description" name="description" rows={2} className="input mt-1" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="public" name="public" />
            <label htmlFor="public" className="field-label">Show on arnayem.top</label>
          </div>
          <div className="sm:col-span-6">
            <button type="submit" className="btn-primary">
              Add repo
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
