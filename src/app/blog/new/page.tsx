import Link from "next/link";
import { verifySession } from "@/lib/session";
import { createBlogPost } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewBlogPostPage() {
  await verifySession();

  return (
    <div className="page">
      <Link href="/blog" className="text-xs text-faint-foreground hover:text-foreground">
        ← Blog
      </Link>
      <h1 className="page-title mt-2">New post</h1>

      <form
        action={createBlogPost}
        encType="multipart/form-data"
        className="card mt-6 grid gap-4"
      >
        <div>
          <label htmlFor="title" className="field-label">
            Title
          </label>
          <input id="title" name="title" required autoFocus className="input mt-1" />
        </div>

        <div>
          <label htmlFor="excerpt" className="field-label">
            Excerpt (shown in the post list, optional)
          </label>
          <input id="excerpt" name="excerpt" className="input mt-1" />
        </div>

        <div>
          <label htmlFor="file" className="field-label">
            Cover image (optional)
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
            rows={18}
            className="input mt-1 font-mono text-sm"
            placeholder={"## Heading\n\nParagraph text with **bold**, *italic*, `code`, and [links](https://example.com).\n\n- list item\n- another item"}
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" name="published" defaultChecked className="h-4 w-4" />
          Published
        </label>

        <div>
          <button type="submit" className="btn-primary">
            Create post
          </button>
        </div>
      </form>
    </div>
  );
}
