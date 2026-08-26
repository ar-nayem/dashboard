import { prisma } from "@/lib/prisma";
import { fetchJson, requireEnv, utcDay, type AdapterResult } from "../types";

/**
 * Subscriber and lifetime-view counts for your own channel.
 *
 * Uses the YouTube Data API with a plain API key, which returns only
 * cumulative totals — not per-day analytics. Per-day figures would need the
 * YouTube Analytics API, which requires an OAuth consent flow rather than a
 * key, so this records one snapshot per day and the views chart is built from
 * the difference between consecutive snapshots.
 *
 * That means the first sync produces a single point and the chart fills in
 * from there. It is honest: the app never invents history it wasn't given.
 */

type ChannelResponse = {
  items?: {
    statistics: {
      subscriberCount?: string;
      viewCount?: string;
      videoCount?: string;
    };
  }[];
};

export async function runYouTube(): Promise<AdapterResult> {
  const apiKey = requireEnv("YOUTUBE_API_KEY");
  const channelId = requireEnv("YOUTUBE_CHANNEL_ID");

  const data = await fetchJson<ChannelResponse>(
    `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${encodeURIComponent(channelId)}&key=${encodeURIComponent(apiKey)}`,
  );

  const stats = data.items?.[0]?.statistics;
  if (!stats) {
    return {
      ok: false,
      error: `No channel found for YOUTUBE_CHANNEL_ID=${channelId}. It should start with "UC".`,
    };
  }

  const date = utcDay(new Date());
  const followers = Number(stats.subscriberCount ?? 0);
  const lifetimeViews = Number(stats.viewCount ?? 0);

  // Yesterday's snapshot turns a cumulative total into a daily delta. Without
  // a prior row there is nothing to subtract, so the first day records null
  // views rather than claiming the entire lifetime count happened today.
  const yesterday = new Date(date);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);

  const previous = await prisma.socialStat.findUnique({
    where: { platform_date: { platform: "youtube", date: yesterday } },
    select: { lifetimeViews: true },
  });

  const dailyViews =
    previous?.lifetimeViews != null ? Math.max(0, lifetimeViews - previous.lifetimeViews) : null;

  await prisma.socialStat.upsert({
    where: { platform_date: { platform: "youtube", date } },
    create: { platform: "youtube", date, followers, views: dailyViews, lifetimeViews },
    update: { followers, views: dailyViews, lifetimeViews },
  });

  return {
    ok: true,
    recordsWritten: 1,
    detail: `${followers.toLocaleString("en-US")} subscribers${
      dailyViews === null
        ? " — first snapshot, daily views start tomorrow"
        : `, ${dailyViews.toLocaleString("en-US")} views today`
    }.`,
  };
}
