import { prisma } from "@/lib/prisma";
import { GSC_SCOPE, getGoogleAccessToken } from "../google-auth";
import { fetchJson, isoDate, utcDay, type AdapterResult } from "../types";

/**
 * Daily impressions, clicks, and average position per project, from Search
 * Console.
 *
 * Search Console data lags roughly two days, so the window ends two days back
 * — asking for today would return an empty tail and look like a broken sync.
 */

const LOOKBACK_DAYS = 90;
const REPORTING_LAG_DAYS = 2;

type SearchAnalyticsResponse = {
  rows?: {
    keys: string[];
    clicks: number;
    impressions: number;
    position: number;
  }[];
};

export async function runSearchConsole(): Promise<AdapterResult> {
  const token = await getGoogleAccessToken(GSC_SCOPE);

  const projects = await prisma.project.findMany({
    where: { gscSiteUrl: { not: null } },
    select: { id: true, name: true, gscSiteUrl: true },
  });

  if (projects.length === 0) {
    return {
      ok: false,
      error:
        'No project has a Search Console property set. Add one on the project\'s page, exactly as verified (often "sc-domain:example.com").',
    };
  }

  const end = utcDay(new Date());
  end.setUTCDate(end.getUTCDate() - REPORTING_LAG_DAYS);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - LOOKBACK_DAYS);

  let written = 0;
  const failures: string[] = [];

  for (const project of projects) {
    const siteUrl = project.gscSiteUrl!;

    try {
      const report = await fetchJson<SearchAnalyticsResponse>(
        `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            startDate: isoDate(start),
            endDate: isoDate(end),
            dimensions: ["date"],
            rowLimit: 500,
          }),
        },
      );

      for (const row of report.rows ?? []) {
        const raw = row.keys[0];
        if (!raw) continue;

        const date = new Date(`${raw}T00:00:00.000Z`);
        if (Number.isNaN(date.getTime())) continue;

        await prisma.projectMetric.upsert({
          where: { projectId_date: { projectId: project.id, date } },
          create: {
            projectId: project.id,
            date,
            impressions: Math.round(row.impressions),
            clicks: Math.round(row.clicks),
            avgPosition: row.position,
          },
          update: {
            impressions: Math.round(row.impressions),
            clicks: Math.round(row.clicks),
            avgPosition: row.position,
          },
        });
        written++;
      }
    } catch (error) {
      failures.push(
        `${project.name} (${siteUrl}): ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (written === 0) {
    return {
      ok: false,
      error:
        failures.join("; ") ||
        "Search Console returned no rows. Check the service account is added as a user on the property.",
    };
  }

  return {
    ok: true,
    recordsWritten: written,
    detail:
      failures.length > 0
        ? `Synced with failures: ${failures.join("; ")}`
        : `${projects.length} site${projects.length === 1 ? "" : "s"} synced through ${isoDate(end)}.`,
  };
}
