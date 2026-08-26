import { prisma } from "@/lib/prisma";
import { startOfDay, endOfDay, addDays as addCalendarDays, startOfYear } from "date-fns";
import { dayRange } from "@/lib/periods";
import { percentChange } from "@/lib/format";

/** The trip whose date span contains today, if any. */
export async function getCurrentTrip() {
  const today = startOfDay(new Date());
  return prisma.trip.findFirst({
    where: { startDate: { lte: endOfDay(today) }, endDate: { gte: today } },
    orderBy: { startDate: "asc" },
  });
}

export async function getUpcomingTrips(limit = 6) {
  return prisma.trip.findMany({
    where: { endDate: { gte: startOfDay(new Date()) } },
    orderBy: { startDate: "asc" },
    take: limit,
  });
}

/** Sprint tasks plus anything due today or already overdue. */
export async function getTodayTasks() {
  const endToday = endOfDay(new Date());
  return prisma.task.findMany({
    where: {
      status: { not: "done" },
      OR: [{ sprint: true }, { dueDate: { lte: endToday } }],
    },
    orderBy: [{ sprint: "desc" }, { sortOrder: "asc" }],
    include: { area: true, client: true, project: { select: { name: true } } },
  });
}

/** Undone tasks due in the next 7 days, excluding what "today" already shows. */
export async function getThisWeekTasks() {
  const tomorrow = startOfDay(addCalendarDays(new Date(), 1));
  const weekEnd = endOfDay(addCalendarDays(new Date(), 7));
  return prisma.task.findMany({
    where: { status: { not: "done" }, dueDate: { gte: tomorrow, lte: weekEnd } },
    orderBy: { dueDate: "asc" },
    include: { area: true, client: true },
  });
}

export async function getRecentShips(limit = 5) {
  return prisma.shipLog.findMany({ orderBy: { shippedAt: "desc" }, take: limit });
}

/** Documents with an expiry date, soonest first. */
export async function getExpiringDocuments(limit = 5) {
  return prisma.document.findMany({
    where: { expiresAt: { not: null } },
    orderBy: { expiresAt: "asc" },
    take: limit,
  });
}

export type UpcomingBirthday = {
  id: string;
  name: string;
  /** The next occurrence, this year or next. */
  date: Date;
  daysAway: number;
  turningAge: number | null;
};

/**
 * Birthdays sorted by how soon they next occur.
 *
 * Stored as month/day without a year, so the next occurrence is computed by
 * trying this year first and rolling to next year once the date has passed.
 * Sorting in SQL isn't possible for the same reason — a December birthday is
 * "sooner" than a January one in November.
 */
export async function getUpcomingBirthdays(limit = 5): Promise<UpcomingBirthday[]> {
  const birthdays = await prisma.birthday.findMany();
  const today = startOfDay(new Date());

  return birthdays
    .map((birthday) => {
      // Month is 1-12 in the DB, 0-11 in Date.
      let next = new Date(today.getFullYear(), birthday.month - 1, birthday.day);
      if (next < today) next = new Date(today.getFullYear() + 1, birthday.month - 1, birthday.day);

      const daysAway = Math.round((next.getTime() - today.getTime()) / 86_400_000);

      return {
        id: birthday.id,
        name: birthday.name,
        date: next,
        daysAway,
        turningAge: birthday.birthYear ? next.getFullYear() - birthday.birthYear : null,
      };
    })
    .sort((a, b) => a.daysAway - b.daysAway)
    .slice(0, limit);
}

/** Posts published per platform over the last 7 days. */
export async function getContentThisWeek() {
  const { current } = dayRange(7);
  const stats = await prisma.socialStat.groupBy({
    by: ["platform"],
    _sum: { posts: true },
    where: { date: { gte: current.start, lte: current.end } },
  });
  return stats.map((row) => ({ platform: row.platform, posts: row._sum.posts ?? 0 }));
}

/** Lifetime installs and revenue across every project. */
export async function getAppTotals(days?: number) {
  const where = days ? { date: { gte: dayRange(days).current.start } } : {};
  const [totals, previous] = await Promise.all([
    prisma.projectMetric.aggregate({ _sum: { installs: true, revenue: true }, where }),
    days
      ? prisma.projectMetric.aggregate({
          _sum: { installs: true, revenue: true },
          where: { date: { gte: dayRange(days).previous.start, lte: dayRange(days).previous.end } },
        })
      : null,
  ]);

  const installs = totals._sum.installs ?? 0;
  const revenue = totals._sum.revenue ?? 0;

  return {
    installs,
    revenue,
    installsDelta: previous ? percentChange(installs, previous._sum.installs ?? 0) : null,
    revenueDelta: previous ? percentChange(revenue, previous._sum.revenue ?? 0) : null,
  };
}

/** Projects launched since Jan 1 — the "12 apps in 12 months" tile. */
export async function getAppsLaunchedThisYear(): Promise<number> {
  return prisma.project.count({ where: { launchedAt: { gte: startOfYear(new Date()) } } });
}

export async function getIntegrations() {
  return prisma.integration.findMany({ orderBy: { sortOrder: "asc" } });
}

/** How many integrations are not currently healthy — the Sync badge count. */
export async function getStaleIntegrationCount(): Promise<number> {
  return prisma.integration.count({ where: { status: { in: ["stale", "error"] } } });
}
