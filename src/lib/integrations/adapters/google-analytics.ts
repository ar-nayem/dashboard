import { prisma } from "@/lib/prisma";
import { GA_SCOPE, getGoogleAccessToken } from "../google-auth";
import { fetchJson, isoDate, utcDay, type AdapterResult } from "../types";

/**
 * Daily unique visitors per project, from the GA4 Data API.
 *
 * Each project carries its own `gaPropertyId`, so one service account can
 * cover several sites and each one's numbers land against the right project.
 */

const LOOKBACK_DAYS = 90;

type RunReportResponse = {
  rows?: {
    dimensionValues: { value: string }[];
    metricValues: { value: string }[];
  }[];
};

export async function runGoogleAnalytics(): Promise<AdapterResult> {
  const token = await getGoogleAccessToken(GA_SCOPE);

  const projects = await prisma.project.findMany({
    where: { gaPropertyId: { not: null } },
    select: { id: true, name: true, gaPropertyId: true },
  });

  if (projects.length === 0) {
    return {
      ok: false,
      error:
        "No project has a GA4 property ID set. Add one on the project's page — it is the numeric ID from GA4 admin.",
    };
  }

  const end = utcDay(new Date());
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - LOOKBACK_DAYS);

  let written = 0;
  const failures: string[] = [];

  for (const project of projects) {
    const propertyId = project.gaPropertyId!;

    try {
      const report = await fetchJson<RunReportResponse>(
        `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            dateRanges: [{ startDate: isoDate(start), endDate: isoDate(end) }],
            dimensions: [{ name: "date" }],
            metrics: [{ name: "totalUsers" }, { name: "activeUsers" }],
            limit: 400,
          }),
        },
      );

      for (const row of report.rows ?? []) {
        // GA returns dates as "20260825".
        const raw = row.dimensionValues[0]?.value ?? "";
        if (raw.length !== 8) continue;

        const date = new Date(
          Date.UTC(Number(raw.slice(0, 4)), Number(raw.slice(4, 6)) - 1, Number(raw.slice(6, 8))),
        );

        const uniqueVisitors = Number(row.metricValues[0]?.value ?? 0);
        const activeUsers = Number(row.metricValues[1]?.value ?? 0);

        await prisma.projectMetric.upsert({
          where: { projectId_date: { projectId: project.id, date } },
          create: { projectId: project.id, date, uniqueVisitors, activeUsers },
          // Only GA's own columns — installs and revenue from other adapters
          // stay untouched for this same project/day row.
          update: { uniqueVisitors, activeUsers },
        });
        written++;
      }
    } catch (error) {
      failures.push(
        `${project.name} (${propertyId}): ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (written === 0) {
    return {
      ok: false,
      error:
        failures.join("; ") ||
        "GA returned no rows. Check the service account has Viewer access on the property.",
    };
  }

  return {
    ok: true,
    recordsWritten: written,
    detail:
      failures.length > 0
        ? `Synced with failures: ${failures.join("; ")}`
        : `${projects.length} propert${projects.length === 1 ? "y" : "ies"} synced.`,
  };
}
