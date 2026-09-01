import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withBasePath } from "@/lib/base-path";

export const dynamic = "force-dynamic";

/**
 * Public, unauthenticated on purpose: the portfolio site (a separate Next
 * app on the same domain, arnayem.top/) fetches this server-to-server to
 * populate its photography gallery. Nothing here that the owner hasn't
 * already chosen to publish by uploading it in /media.
 */
export async function GET() {
  const items = await prisma.mediaItem.findMany({
    orderBy: { sortOrder: "asc" },
    select: { url: true, link: true },
  });

  return NextResponse.json({
    images: items.map((item) => ({
      image: withBasePath(item.url),
      link: item.link ?? "",
    })),
  });
}
