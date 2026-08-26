import { prisma } from "@/lib/prisma";
import type { HabitStatus } from "@/lib/enums";

/** UTC midnight for a date — the normalisation every habit date uses. */
export function toUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/** The last `count` days ending today, oldest first — the grid's columns. */
export function recentDays(count: number, now = new Date()): Date[] {
  const today = toUtcDay(now);
  return Array.from({ length: count }, (_, i) => addDays(today, -(count - 1 - i)));
}

export type HabitWithLogs = {
  id: string;
  name: string;
  emoji: string | null;
  kind: string;
  sortOrder: number;
  areaId: string | null;
  /** ISO day string -> status, for O(1) cell lookup while rendering. */
  logsByDay: Map<string, HabitStatus>;
  streak: number;
};

export function dayKey(date: Date): string {
  return toUtcDay(date).toISOString();
}

/**
 * Current streak: consecutive days ending today whose status is "success".
 *
 * Two rules that aren't obvious:
 * - "skip" is transparent. It neither extends nor breaks a streak, so a
 *   deliberately excused day (illness, travel) doesn't cost you the run.
 * - Today being unlogged does NOT break the streak — the day isn't over yet,
 *   so counting starts from yesterday in that case. Any OTHER unlogged day
 *   does break it.
 */
export function computeStreak(logsByDay: Map<string, HabitStatus>, now = new Date()): number {
  const today = toUtcDay(now);
  let cursor = logsByDay.has(dayKey(today)) ? today : addDays(today, -1);
  let streak = 0;

  // Bounded so a corrupt map can never spin forever.
  for (let guard = 0; guard < 3650; guard++) {
    const status = logsByDay.get(dayKey(cursor));
    if (status === "success") {
      streak++;
    } else if (status === "skip") {
      // Transparent: move on without incrementing.
    } else {
      break;
    }
    cursor = addDays(cursor, -1);
  }

  return streak;
}

/** Habits plus their logs over the last `days` days, with streaks computed. */
export async function getHabitsWithLogs(days = 30): Promise<HabitWithLogs[]> {
  const since = addDays(toUtcDay(new Date()), -(days - 1));

  const habits = await prisma.habit.findMany({
    where: { archived: false },
    orderBy: { sortOrder: "asc" },
    include: {
      // The streak needs history from before the visible window, so pull a
      // generous tail rather than only the rendered days.
      logs: {
        where: { date: { gte: addDays(since, -400) } },
        select: { date: true, status: true },
      },
    },
  });

  return habits.map((habit) => {
    const logsByDay = new Map<string, HabitStatus>();
    for (const log of habit.logs) {
      logsByDay.set(dayKey(log.date), log.status as HabitStatus);
    }
    return {
      id: habit.id,
      name: habit.name,
      emoji: habit.emoji,
      kind: habit.kind,
      sortOrder: habit.sortOrder,
      areaId: habit.areaId,
      logsByDay,
      streak: computeStreak(logsByDay),
    };
  });
}

/** Just the streaks, for the home page and habit-streak goals. */
export async function getHabitStreaks(): Promise<{ id: string; name: string; emoji: string | null; streak: number }[]> {
  const habits = await getHabitsWithLogs(1);
  return habits.map(({ id, name, emoji, streak }) => ({ id, name, emoji, streak }));
}

export async function getHabitStreak(habitId: string): Promise<number> {
  const logs = await prisma.habitLog.findMany({
    where: { habitId },
    orderBy: { date: "desc" },
    take: 400,
    select: { date: true, status: true },
  });
  const logsByDay = new Map<string, HabitStatus>();
  for (const log of logs) logsByDay.set(dayKey(log.date), log.status as HabitStatus);
  return computeStreak(logsByDay);
}

/** Share of logged days in the window that were successes. */
export function completionRate(logsByDay: Map<string, HabitStatus>, days: Date[]): number {
  let logged = 0;
  let success = 0;
  for (const day of days) {
    const status = logsByDay.get(dayKey(day));
    if (!status || status === "skip") continue;
    logged++;
    if (status === "success") success++;
  }
  return logged === 0 ? 0 : (success / logged) * 100;
}
