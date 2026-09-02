import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Public, unauthenticated — see src/app/api/media/route.ts for why.
export async function GET() {
  const items = await prisma.service.findMany({ orderBy: { sortOrder: "asc" } });

  return NextResponse.json({
    items: items.map((item) => ({
      icon: item.icon,
      title: item.title,
      description: item.description,
    })),
  });
}
