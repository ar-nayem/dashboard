import { verifySession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/components/empty-state";
import { StatusChip } from "@/components/chips";
import { formatRelative } from "@/lib/format";
import { approveDraft, createDraft, deleteDraft, markPosted, skipDraft, updateDraft } from "./actions";

export const dynamic = "force-dynamic";

export default async function LinkedInPage() {
  await verifySession();

  const posts = await prisma.linkedInPost.findMany({ orderBy: { createdAt: "desc" } });
  const pending = posts.filter((p) => p.status === "draft" || p.status === "approved");
  const history = posts.filter((p) => p.status === "posted" || p.status === "skipped");

  return (
    <div className="page">
      <h1 className="page-title">LinkedIn</h1>
      <p className="page-subtitle">
        A weekly job drafts a post from what actually shipped. Nothing goes live until you
        approve it here and Claude posts it with you, in a session where you can watch.
      </p>

      <section className="mt-6 flex flex-col gap-3">
        {pending.length === 0 && (
          <EmptyState message="No drafts waiting. The weekly job posts one here after each week with shipped work." />
        )}

        {pending.map((post) => (
          <div key={post.id} className="card flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <StatusChip status={post.status} />
                {post.sourceRepo && (
                  <span className="text-xs text-faint-foreground">re: {post.sourceRepo}</span>
                )}
              </div>
              <span className="text-xs text-faint-foreground">{formatRelative(post.createdAt)}</span>
            </div>

            <form action={updateDraft} className="grid gap-2">
              <input type="hidden" name="id" value={post.id} />
              <textarea
                name="body"
                defaultValue={post.body}
                rows={6}
                className="input font-mono text-xs"
                aria-label="Post body"
              />
              <input type="hidden" name="sourceRepo" value={post.sourceRepo ?? ""} />
              <div className="flex flex-wrap gap-2">
                <button type="submit" className="btn-ghost px-3 py-1 text-xs">
                  Save edit
                </button>
              </div>
            </form>

            <div className="flex flex-wrap gap-2 border-t border-border pt-3">
              {post.status === "draft" && (
                <form action={approveDraft}>
                  <input type="hidden" name="id" value={post.id} />
                  <button type="submit" className="btn-primary px-3 py-1 text-xs">
                    Approve — ready to post
                  </button>
                </form>
              )}
              {post.status === "approved" && (
                <span className="rounded bg-success/15 px-2 py-1 text-xs text-success">
                  Approved — say the word and Claude will open LinkedIn and post it
                </span>
              )}
              <form action={skipDraft}>
                <input type="hidden" name="id" value={post.id} />
                <button type="submit" className="btn-ghost px-3 py-1 text-xs">
                  Skip this week
                </button>
              </form>
              <form action={deleteDraft}>
                <input type="hidden" name="id" value={post.id} />
                <button type="submit" className="cursor-pointer px-3 py-1 text-xs text-faint-foreground hover:text-danger">
                  Delete
                </button>
              </form>
            </div>
          </div>
        ))}
      </section>

      <section className="mt-10">
        <h2 className="section-title">Write a draft manually</h2>
        <form action={createDraft} className="card mt-3 grid gap-3">
          <div>
            <label htmlFor="sourceRepo" className="field-label">About (optional)</label>
            <input id="sourceRepo" name="sourceRepo" placeholder="e.g. salonbd, or a general theme" className="input mt-1" />
          </div>
          <div>
            <label htmlFor="body" className="field-label">Post body</label>
            <textarea id="body" name="body" rows={5} className="input mt-1" />
          </div>
          <div>
            <button type="submit" className="btn-primary">
              Add draft
            </button>
          </div>
        </form>
      </section>

      {history.length > 0 && (
        <section className="mt-10">
          <h2 className="section-title">History</h2>
          <div className="mt-3 flex flex-col gap-2">
            {history.map((post) => (
              <div key={post.id} className="card flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <StatusChip status={post.status} />
                    <span className="text-xs text-faint-foreground">
                      {post.postedAt ? formatRelative(post.postedAt) : formatRelative(post.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{post.body}</p>
                  {post.postUrl && (
                    <a href={post.postUrl} target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline">
                      View on LinkedIn ↗
                    </a>
                  )}
                </div>
                {post.status !== "posted" && (
                  <form action={markPosted} className="flex shrink-0 items-center gap-2">
                    <input type="hidden" name="id" value={post.id} />
                    <button type="submit" className="btn-ghost px-2 py-1 text-[11px]">
                      Mark posted
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
