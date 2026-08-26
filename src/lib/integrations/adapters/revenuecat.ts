import { prisma } from "@/lib/prisma";
import { fetchJson, requireEnv, utcDay, type AdapterResult } from "../types";

/**
 * Subscription revenue and active trials per project, from RevenueCat.
 *
 * Uses the v2 Metrics overview endpoint, which returns current totals rather
 * than a daily series — so, like YouTube, this records one snapshot per day
 * and history accumulates from the first sync onward.
 */

type MetricsResponse = {
  metrics?: {
    id: string;
    value: number;
  }[];
};

/** RevenueCat metric IDs, kept here so a rename is a one-line fix. */
const MRR_METRIC = "mrr";
const ACTIVE_TRIALS_METRIC = "active_trials";
const ACTIVE_SUBSCRIPTIONS_METRIC = "active_subscriptions";

export async function runRevenueCat(): Promise<AdapterResult> {
  const apiKey = requireEnv("REVENUECAT_API_KEY");

  const projects = await prisma.project.findMany({
    where: { revenueCatId: { not: null } },
    select: { id: true, name: true, revenueCatId: true },
  });

  if (projects.length === 0) {
    return {
      ok: false,
      error:
        "No project has a RevenueCat project ID set. Add one on the project's page — find it in the RevenueCat dashboard URL.",
    };
  }

  const date = utcDay(new Date());
  let written = 0;
  const failures: string[] = [];

  for (const project of projects) {
    const revenueCatId = project.revenueCatId!;

    try {
      const data = await fetchJson<MetricsResponse>(
        `https://api.revenuecat.com/v2/projects/${encodeURIComponent(revenueCatId)}/metrics/overview`,
        { headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" } },
      );

      const byId = new Map((data.metrics ?? []).map((metric) => [metric.id, metric.value]));

      const mrr = byId.get(MRR_METRIC) ?? 0;
      const trials = byId.get(ACTIVE_TRIALS_METRIC) ?? 0;
      const subscriptions = byId.get(ACTIVE_SUBSCRIPTIONS_METRIC) ?? 0;

      await prisma.projectMetric.upsert({
        where: { projectId_date: { projectId: project.id, date } },
        create: {
          projectId: project.id,
          date,
          // MRR is a monthly figure; the daily revenue column wants a daily
          // one, so it is divided across an average month.
          revenue: Math.round((mrr / 30.44) * 100) / 100,
          activeUsers: Math.round(subscriptions + trials),
        },
        update: {
          revenue: Math.round((mrr / 30.44) * 100) / 100,
          activeUsers: Math.round(subscriptions + trials),
        },
      });
      written++;
    } catch (error) {
      failures.push(
        `${project.name}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (written === 0) {
    return { ok: false, error: failures.join("; ") || "RevenueCat returned no metrics." };
  }

  return {
    ok: true,
    recordsWritten: written,
    detail:
      failures.length > 0
        ? `Synced with failures: ${failures.join("; ")}`
        : `${written} project${written === 1 ? "" : "s"} snapshotted.`,
  };
}
