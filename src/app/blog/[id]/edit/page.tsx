import Link from "next/link";
import { notFound } from "next/navigation";
import { verifySession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { withBasePath } from "@/lib/base-path";
import { updateBlogPost } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditBlogPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await verifySession();
  const { id } = await params;

  const post = await prisma.blogPost.findUnique({ where: { id } });
  if (!post) notFound();

  return (
    <div className="page">
      <Link href="/blog" className="text-xs text-faint-foreground hover:text-foreground">
        ← Blog
      </Link>
      <h1 className="page-title mt-2">Edit post</h1>

      <form
        action={updateBlogPost}
        encType="multipart/form-data"
        className="card mt-6 grid gap-4"
      >
        <input type="hidden" name="id" value={post.id} />

        <div>
          <label htmlFor="title" className="field-label">
            Title
          </label>
          <input id="title" name="title" defaultValue={post.title} required className="input mt-1" />
        </div>

        <div>
          <label htmlFor="excerpt" className="field-label">
            Excerpt (shown in the post list, optional)
          </label>
          <input id="excerpt" name="excerpt" defaultValue={post.excerpt ?? ""} className="input mt-1" />
        </div>

        {post.coverImage && (
          <div>
            <span className="field-label">Current cover</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={withBasePath(post.coverImage)}
              alt=""
              className="mt-1 h-32 w-full max-w-sm rounded-lg object-cover"
            />
          </div>
        )}

        <div>
          <label htmlFor="file" className="field-label">
            Replace cover image (optional)
          </label>
          <input id="file" name="file" type="file" accept="image/*" className="input mt-1" />
        </div>

        <div>
          <label htmlFor="body" className="field-label">
            Body (Markdown)
          </label>
          <textarea
            id="body"
            name="body"
            defaultValue={post.body}
            rows={18}
            className="input mt-1 font-mono text-sm"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            name="published"
            defaultChecked={post.published}
            className="h-4 w-4"
          />
          Published
        </label>

        <div>
          <button type="submit" className="btn-primary">
            Save changes
          </button>
        </div>
      </form>
    </div>
  );
}
