import Link from "next/link";
import { verifySession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/components/empty-state";
import { deleteBlogPost } from "./actions";

export const dynamic = "force-dynamic";

export default async function BlogPage() {
  await verifySession();

  const posts = await prisma.blogPost.findMany({ orderBy: { publishedAt: "desc" } });

  return (
    <div className="page">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Blog</h1>
          <p className="page-subtitle">Posts shown on the portfolio site&apos;s /blog.</p>
        </div>
        <Link href="/blog/new" className="btn-primary">
          New post
        </Link>
      </div>

      <section className="mt-6 flex flex-col gap-3">
        {posts.length === 0 && <EmptyState message="No posts yet." />}

        {posts.map((post) => (
          <div key={post.id} className="card flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate font-medium text-foreground">{post.title}</h2>
                {!post.published && (
                  <span className="rounded-full bg-surface-hover px-2 py-0.5 text-[10px] uppercase tracking-wide text-faint-foreground">
                    Draft
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-faint-foreground">
                /blog/{post.slug} · {post.publishedAt.toLocaleDateString()}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <Link href={`/blog/${post.id}/edit`} className="btn-ghost px-3 py-1 text-xs">
                Edit
              </Link>
              <form action={deleteBlogPost}>
                <input type="hidden" name="id" value={post.id} />
                <button
                  type="submit"
                  aria-label={`Delete ${post.title}`}
                  className="cursor-pointer text-xs text-faint-foreground hover:text-danger"
                >
                  Delete
                </button>
              </form>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
