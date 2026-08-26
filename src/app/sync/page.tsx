import { verifySession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { StatusChip } from "@/components/chips";
import { ADAPTERS, deriveStatus, isRunnable, missingCredentials } from "@/lib/integrations";
import { formatRelative, daysUntil, formatNumber } from "@/lib/format";
import { syncAll, syncIntegration } from "./actions";

export const dynamic = "force-dynamic";

export default async function SyncPage() {
  await verifySession();

  const [rows, recentRuns] = await Promise.all([
    prisma.integration.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.syncRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 12,
      include: { integration: { select: { name: true } } },
    }),
  ]);

  const entries = rows.map((row) => {
    const adapter = ADAPTERS.find((a) => a.key === row.key);
    return {
      ...row,
      adapter,
      missing: adapter ? missingCredentials(adapter) : [],
      runnable: adapter ? isRunnable(adapter) : false,
      status: deriveStatus(row.status, row.lastSyncedAt, adapter?.staleAfterHours ?? 24),
    };
  });

  const readyCount = entries.filter((entry) => entry.runnable).length;

  return (
    <div className="page">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Sync Status</h1>
          <p className="page-subtitle">
            {readyCount} of {entries.length} sources connected.
          </p>
        </div>

        <form action={syncAll}>
          <button type="submit" className="btn-primary" disabled={readyCount === 0}>
            Sync all
          </button>
        </form>
      </div>

      <div className="mt-5 rounded-xl border border-info/30 bg-info/10 px-4 py-3 text-sm text-foreground/90">
        <strong className="font-medium">Connecting a source.</strong> Add its keys to{" "}
        <code className="rounded bg-background px-1 py-0.5 text-xs">.env</code>, restart the server,
        then set the matching ID on each project (GitHub repo, GA property, App Store ID). Keys are
        read server-side only and never reach the browser.
      </div>

      <section className="mt-6 flex flex-col gap-2">
        {entries.map((entry) => (
          <div key={entry.id} className="card py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">{entry.name}</span>
                  <StatusChip status={entry.status} />
                  {entry.adapter?.pushOnly && (
                    <span className="rounded bg-info/15 px-1.5 py-0.5 text-[10px] text-info">
                      push only
                    </span>
                  )}
                  {entry.runnable && (
                    <span className="rounded bg-success/15 px-1.5 py-0.5 text-[10px] text-success">
                      connected
                    </span>
                  )}
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  <span>
                    {entry.lastSyncedAt
                      ? `last synced ${formatRelative(entry.lastSyncedAt)}`
                      : "never synced"}
                  </span>
                  {entry.expiresAt && (
                    <span className={daysUntil(entry.expiresAt) < 14 ? "text-danger" : undefined}>
                      token expires in {daysUntil(entry.expiresAt)}d
                    </span>
                  )}
                </div>

                {entry.adapter?.note && (
                  <p className="mt-1 text-[11px] text-faint-foreground">{entry.adapter.note}</p>
                )}

                {entry.lastError && (
                  <p className="mt-1.5 text-[11px] text-danger">{entry.lastError}</p>
                )}
              </div>

              {!entry.adapter?.pushOnly && (
                <form action={syncIntegration} className="shrink-0">
                  <input type="hidden" name="key" value={entry.key} />
                  <button
                    type="submit"
                    disabled={!entry.runnable}
                    className="btn-ghost px-3 py-1.5 text-xs"
                  >
                    Sync
                  </button>
                </form>
              )}
            </div>

            {entry.missing.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-warning">
                  Needs {entry.missing.length} value{entry.missing.length === 1 ? "" : "s"} in .env
                </summary>
                <ul className="mt-2 flex flex-col gap-2">
                  {entry.missing.map((spec) => (
                    <li key={spec.env} className="text-[11px]">
                      <code className="rounded bg-background px-1 py-0.5 text-foreground">
                        {spec.env}
                      </code>
                      <p className="mt-0.5 text-muted-foreground">{spec.hint}</p>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {entry.key === "apple_health" && entry.missing.length === 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-info">
                  iOS Shortcut setup
                </summary>
                <ol className="mt-2 flex list-decimal flex-col gap-1 pl-4 text-[11px] text-muted-foreground">
                  <li>Shortcuts app → new shortcut → Health → Find Health Samples.</li>
                  <li>
                    Add a <em>Get Contents of URL</em> action pointing at{" "}
                    <code className="rounded bg-background px-1">/api/health-webhook</code> on this
                    server.
                  </li>
                  <li>
                    Method POST, header{" "}
                    <code className="rounded bg-background px-1">x-webhook-secret</code> set to your
                    HEALTH_WEBHOOK_SECRET.
                  </li>
                  <li>
                    Body JSON:{" "}
                    <code className="rounded bg-background px-1">
                      {'{"readings":[{"type":"weight","value":74.2,"date":"2026-08-25"}]}'}
                    </code>
                  </li>
                  <li>Automation tab → daily trigger → run this shortcut.</li>
                </ol>
              </details>
            )}
          </div>
        ))}
      </section>

      <section className="mt-8">
        <h2 className="section-title">Recent runs</h2>
        <div className="card mt-3 flex flex-col gap-1.5">
          {recentRuns.length === 0 && (
            <p className="text-sm text-muted-foreground">Nothing has run yet.</p>
          )}

          {recentRuns.map((run) => (
            <div key={run.id} className="flex items-start justify-between gap-3 text-xs">
              <span className="flex min-w-0 items-center gap-2">
                <span className={run.ok ? "text-success" : "text-danger"}>{run.ok ? "✓" : "✕"}</span>
                <span className="text-foreground/90">{run.integration.name}</span>
                <span className="text-faint-foreground">{run.trigger}</span>
              </span>

              <span className="flex shrink-0 items-center gap-3">
                {run.ok && (
                  <span className="tnum text-muted-foreground">
                    {formatNumber(run.recordsWritten)} rows
                  </span>
                )}
                <span className="text-faint-foreground">{formatRelative(run.startedAt)}</span>
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
