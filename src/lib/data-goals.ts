import { prisma } from "@/lib/prisma";
import { computeStreak, dayKey } from "@/lib/data-habits";
import type { HabitStatus } from "@/lib/enums";

export type ResolvedGoal = {
  id: string;
  title: string;
  description: string | null;
  kind: string;
  category: string;
  unit: string | null;
  status: string;
  startedAt: Date;
  targetDate: Date | null;
  targetLabel: string | null;
  targetValue: number | null;
  /** Whatever the goal currently measures — a metric value, or a streak length. */
  currentValue: number | null;
  percent: number;
  habit: { id: string; name: string; emoji: string | null; kind: string } | null;
};

/**
 * Loads goals and resolves each one's progress according to its kind.
 *
 * Progress is computed at read time rather than stored, so a habit-streak
 * goal is never stale: it reflects the logs as they are right now, with no
 * background job to keep a cached percentage in sync.
 */
export async function getGoals(category?: string): Promise<ResolvedGoal[]> {
  const goals = await prisma.goal.findMany({
    where: category && category !== "all" ? { category } : {},
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    include: {
      habit: {
        select: {
          id: true,
          name: true,
          emoji: true,
          kind: true,
          logs: { orderBy: { date: "desc" }, take: 400, select: { date: true, status: true } },
        },
      },
    },
  });

  return goals.map((goal) => {
    let currentValue = goal.currentValue;
    let percent: number;

    if (goal.kind === "habit_streak" && goal.habit) {
      const logsByDay = new Map<string, HabitStatus>();
      for (const log of goal.habit.logs) {
        logsByDay.set(dayKey(log.date), log.status as HabitStatus);
      }
      currentValue = computeStreak(logsByDay);
      percent = goal.targetValue ? (currentValue / goal.targetValue) * 100 : 0;
    } else if (goal.kind === "metric") {
      percent =
        goal.targetValue && goal.currentValue !== null
          ? (goal.currentValue / goal.targetValue) * 100
          : 0;
    } else {
      percent = goal.progress;
    }

    return {
      id: goal.id,
      title: goal.title,
      description: goal.description,
      kind: goal.kind,
      category: goal.category,
      unit: goal.unit,
      status: goal.status,
      startedAt: goal.startedAt,
      targetDate: goal.targetDate,
      targetLabel: goal.targetLabel,
      targetValue: goal.targetValue,
      currentValue,
      // Clamped so an overshot goal renders as a full bar rather than
      // overflowing its track.
      percent: Math.max(0, Math.min(100, percent)),
      habit: goal.habit
        ? {
            id: goal.habit.id,
            name: goal.habit.name,
            emoji: goal.habit.emoji,
            kind: goal.habit.kind,
          }
        : null,
    };
  });
}
