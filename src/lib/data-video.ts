import { prisma } from "@/lib/prisma";
import { subDays, startOfDay } from "date-fns";
import { percentChange } from "@/lib/format";
import type { SocialWindow } from "@/lib/periods";

export type PlatformSummary = {
  platform: string;
  followers: number;
  /** Change in followers across the window, in absolute count. */
  followerGrowth: number;
  views: number;
  viewsDelta: number | null;
  watchHours: number;
  points: { date: Date; views: number }[];
  asOf: Date | null;
};

/** Turns the 7 / 28 / 90 / all toggle into a day count, or null for all-time. */
export function windowDays(window: SocialWindow): number | null {
  return window === "all" ? null : Number(window);
}

/**
 * Per-platform stats over a window.
 *
 * Followers are a running total, so the headline is the LAST value in the
 * window, not a sum — and growth is last minus first. Views are per-day, so
 * they do sum.
 */
export async function getPlatformSummaries(window: SocialWindow): Promise<PlatformSummary[]> {
  const days = windowDays(window);
  const today = startOfDay(new Date());
  const windowStart = days ? subDays(today, days) : null;
  const previousStart = days && windowStart ? subDays(windowStart, days) : null;

  const rows = await prisma.socialStat.findMany({
    where: previousStart ? { date: { gte: previousStart } } : {},
    orderBy: { date: "asc" },
  });

  const byPlatform = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = byPlatform.get(row.platform) ?? [];
    list.push(row);
    byPlatform.set(row.platform, list);
  }

  return [...byPlatform.entries()].map(([platform, all]) => {
    const current = windowStart ? all.filter((row) => row.date >= windowStart) : all;
    const previous = windowStart ? all.filter((row) => row.date < windowStart) : [];

    const views = current.reduce((sum, row) => sum + (row.views ?? 0), 0);
    const previousViews = previous.reduce((sum, row) => sum + (row.views ?? 0), 0);

    const first = current[0];
    const last = current[current.length - 1];

    return {
      platform,
      followers: last?.followers ?? 0,
      followerGrowth: (last?.followers ?? 0) - (first?.followers ?? 0),
      views,
      // No prior window to compare against (all-time view) yields null, which
      // the UI renders as a dash rather than a misleading 0%.
      viewsDelta: previous.length === 0 ? null : percentChange(views, previousViews),
      watchHours: current.reduce((sum, row) => sum + (row.watchHours ?? 0), 0),
      points: current.map((row) => ({ date: row.date, views: row.views ?? 0 })),
      asOf: last?.date ?? null,
    };
  });
}

export async function getVideosByStage() {
  const videos = await prisma.video.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: { subtasks: { orderBy: { sortOrder: "asc" } } },
  });

  return {
    idea: videos.filter((video) => video.stage === "idea"),
    in_progress: videos.filter((video) => video.stage === "in_progress"),
    published: videos.filter((video) => video.stage === "published"),
  };
}

/** Published videos, most recent first — the "top videos" list. */
export async function getPublishedVideos(limit = 5) {
  return prisma.video.findMany({
    where: { stage: "published" },
    orderBy: { postDate: "desc" },
    take: limit,
  });
}
