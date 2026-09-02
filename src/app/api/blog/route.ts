import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withBasePath } from "@/lib/base-path";

export const dynamic = "force-dynamic";

// Public, unauthenticated, published posts only — see
// src/app/api/media/route.ts for why this needs no auth. Returns full
// bodies (not just a list) since the portfolio's post count is small; it
// looks the item up by slug client-side rather than hitting a second
// per-post endpoint, mirroring how this app's own PROJECTS array used to
// work locally before this feature existed.
export async function GET() {
  const posts = await prisma.blogPost.findMany({
    where: { published: true },
    orderBy: { publishedAt: "desc" },
  });

  return NextResponse.json({
    posts: posts.map((post) => ({
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      body: post.body,
      coverImage: post.coverImage ? withBasePath(post.coverImage) : null,
      publishedAt: post.publishedAt.toISOString(),
    })),
  });
}
