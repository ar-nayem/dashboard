import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withBasePath } from "@/lib/base-path";
import { parseList } from "@/lib/enums";

export const dynamic = "force-dynamic";

// Public, unauthenticated — see src/app/api/media/route.ts for why.
export async function GET() {
  const items = await prisma.workItem.findMany({ orderBy: { sortOrder: "asc" } });

  return NextResponse.json({
    items: items.map((item) => ({
      slug: item.slug,
      title: item.title,
      role: item.role,
      description: item.description,
      tech: parseList(item.tech),
      image: item.image ? withBasePath(item.image) : null,
    })),
  });
}
