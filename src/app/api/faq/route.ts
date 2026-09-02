import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Public, unauthenticated — see src/app/api/media/route.ts for why.
export async function GET() {
  const items = await prisma.faq.findMany({ orderBy: { sortOrder: "asc" } });

  return NextResponse.json({
    items: items.map((item) => ({
      question: item.question,
      answer: item.answer,
    })),
  });
}
