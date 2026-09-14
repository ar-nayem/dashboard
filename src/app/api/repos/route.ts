import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseList } from "@/lib/enums";

export const dynamic = "force-dynamic";

// Public, unauthenticated — see src/app/api/media/route.ts for why. Only
// rows marked public are returned, and only public-safe fields: no pm2Name,
// no internal status like "superseded" is filtered client-side either since
// it's not sensitive, just not interesting to show.
export async function GET() {
  const repos = await prisma.repo.findMany({
    where: { public: true },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json({
    items: repos.map((repo) => ({
      slug: repo.slug,
      name: repo.name,
      description: repo.description,
      category: repo.category,
      tech: parseList(repo.tech),
      githubUrl: repo.githubUrl,
      liveUrl: repo.liveUrl,
      status: repo.status,
    })),
  });
}
