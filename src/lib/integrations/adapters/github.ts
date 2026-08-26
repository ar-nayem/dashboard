import { prisma } from "@/lib/prisma";
import { fetchJson, isoDate, requireEnv, utcDay, type AdapterResult } from "../types";

/**
 * Daily commit counts per project, from GitHub's participation stats.
 *
 * Uses /stats/participation rather than listing commits: it returns 52 weekly
 * totals in one request per repo, where paging the commits API would be
 * dozens of requests and burn the rate limit for the same number.
 *
 * Weekly totals are spread evenly across their seven days. That is an
 * approximation — the metric is "roughly how active was this repo", not an
 * audit trail — and it keeps one row per project per day like every other
 * source.
 */

const WEEKS_TO_IMPORT = 12;

type ParticipationResponse = {
  /** 52 weekly commit counts, oldest first, ending with the current week. */
  owner: number[];
  all: number[];
};

export async function runGitHub(): Promise<AdapterResult> {
  const token = requireEnv("GITHUB_TOKEN");

  const projects = await prisma.project.findMany({
    where: { githubRepo: { not: null } },
    select: { id: true, name: true, githubRepo: true },
  });

  if (projects.length === 0) {
    return {
      ok: false,
      error:
        "No project has a GitHub repo set. Add one on a project's page (Settings → external IDs) as owner/repo.",
    };
  }

  let written = 0;
  const failures: string[] = [];

  for (const project of projects) {
    const repo = project.githubRepo!;

    try {
      const stats = await fetchJson<ParticipationResponse>(
        `https://api.github.com/repos/${repo}/stats/participation`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
        },
      );

      const weekly = stats.owner ?? stats.all ?? [];
      if (weekly.length === 0) {
        failures.push(`${repo}: GitHub returned no stats (it may still be computing them)`);
        continue;
      }

      // The array ends with the current week, so index i counts back from now.
      const recent = weekly.slice(-WEEKS_TO_IMPORT);
      const today = utcDay(new Date());

      for (const [index, weekTotal] of recent.entries()) {
        const weeksBack = recent.length - 1 - index;

        for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
          const date = new Date(today);
          date.setUTCDate(date.getUTCDate() - (weeksBack * 7 + dayOffset));
          if (date > today) continue;

          // Spread the week's total across its days, giving the remainder to
          // the earliest days so the week still sums to the reported total.
          const base = Math.floor(weekTotal / 7);
          const remainder = weekTotal % 7;
          const commits = base + (dayOffset < remainder ? 1 : 0);

          await prisma.projectMetric.upsert({
            where: { projectId_date: { projectId: project.id, date } },
            create: { projectId: project.id, date, commits },
            // Only this adapter's column is touched — installs, revenue, and
            // visitors written by other sources are left alone.
            update: { commits },
          });
          written++;
        }
      }
    } catch (error) {
      failures.push(`${repo}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (written === 0) {
    return { ok: false, error: failures.join("; ") || "No commit data returned." };
  }

  return {
    ok: true,
    recordsWritten: written,
    detail:
      failures.length > 0
        ? `${projects.length - failures.length}/${projects.length} repos synced. Failed: ${failures.join("; ")}`
        : `${projects.length} repo${projects.length === 1 ? "" : "s"} synced through ${isoDate(new Date())}.`,
  };
}
