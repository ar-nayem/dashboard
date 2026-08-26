import Link from "next/link";
import { verifySession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ProgressBar } from "@/components/charts/progress-bar";
import { EmptyState } from "@/components/empty-state";
import { Private } from "@/components/private";
import { getGoals } from "@/lib/data-goals";
import { GOAL_CATEGORIES, GOAL_KINDS } from "@/lib/enums";
import { formatCompactCurrency, formatDate, formatNumber } from "@/lib/format";
import { createGoal, deleteGoal, updateGoalProgress } from "./actions";

export const dynamic = "force-dynamic";

const FILTERS = ["all", ...GOAL_CATEGORIES] as const;

/** Money goals show as currency; everything else as a plain count. */
function formatGoalValue(value: number | null, unit: string | null): string {
  if (value === null) return "—";
  if (unit === "USD") return formatCompactCurrency(value);
  return formatNumber(Math.round(value * 10) / 10);
}

export default async function GoalsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  await verifySession();

  const { category = "all" } = await searchParams;
  const active = (FILTERS as readonly string[]).includes(category) ? category : "all";

  const [goals, habits] = await Promise.all([
    getGoals(active),
    prisma.habit.findMany({
      where: { archived: false },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, emoji: true },
    }),
  ]);

  return (
    <div className="page">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Goals</h1>
          <p className="page-subtitle">
            Habit-streak goals recompute from your logs — no manual updating.
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-1.5">
        {FILTERS.map((entry) => (
          <Link
            key={entry}
            href={entry === "all" ? "/goals" : `/goals?category=${entry}`}
            className={`btn-ghost px-3 py-1 text-xs capitalize ${
              active === entry ? "bg-surface-hover text-foreground" : ""
            }`}
          >
            {entry}
          </Link>
        ))}
      </div>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        {goals.length === 0 && (
          <div className="lg:col-span-2">
            <EmptyState message="No goals in this category yet." />
          </div>
        )}

        {goals.map((goal) => (
          <div key={goal.id} className="card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate font-medium text-foreground">
                  {goal.kind === "habit_streak" && <span className="mr-1.5">🔁</span>}
                  {goal.title}
                </h2>
                {goal.description && (
                  <p className="mt-1 text-xs text-muted-foreground">{goal.description}</p>
                )}
              </div>

              <form action={deleteGoal} className="shrink-0">
                <input type="hidden" name="id" value={goal.id} />
                <button
                  type="submit"
                  aria-label={`Delete ${goal.title}`}
                  className="cursor-pointer text-xs text-faint-foreground hover:text-danger"
                >
                  ✕
                </button>
              </form>
            </div>

            <div className="mt-4 flex items-baseline gap-2">
              <span className="tnum text-3xl font-semibold text-foreground">
                {goal.kind === "habit_streak" && <span className="mr-1 text-xl">🔥</span>}
                <Private chars={5}>{formatGoalValue(goal.currentValue, goal.unit)}</Private>
              </span>
              {goal.targetValue !== null && (
                <span className="tnum text-sm text-muted-foreground">
                  / {formatGoalValue(goal.targetValue, goal.unit)}
                  {goal.kind === "habit_streak" && " days"}
                </span>
              )}
            </div>

            <ProgressBar
              percent={goal.percent}
              color={goal.percent >= 100 ? "var(--success)" : "var(--accent)"}
              className="mt-3"
              height={8}
              label={`${goal.title} progress`}
            />

            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="tnum">{goal.percent.toFixed(0)}%</span>
              <span>started {formatDate(goal.startedAt)}</span>
              {goal.targetLabel && <span>{goal.targetLabel}</span>}
              {!goal.targetLabel && goal.targetDate && (
                <span>target {formatDate(goal.targetDate)}</span>
              )}
              {goal.habit && (
                <span className="badge px-2 py-0.5 text-[10px]">
                  Tracks: {goal.habit.emoji} {goal.habit.name}
                </span>
              )}
            </div>

            {/* habit_streak goals have nothing to type in — their value comes
                from the logs. */}
            {goal.kind !== "habit_streak" && (
              <form action={updateGoalProgress} className="mt-4 flex items-center gap-2">
                <input type="hidden" name="id" value={goal.id} />
                <input
                  name="value"
                  type="number"
                  step="any"
                  defaultValue={
                    goal.kind === "manual" ? goal.percent : (goal.currentValue ?? undefined)
                  }
                  aria-label={`Update ${goal.title}`}
                  className="input flex-1 py-1.5 text-xs"
                />
                <button type="submit" className="btn-ghost px-3 py-1.5 text-xs">
                  {goal.kind === "manual" ? "Set %" : "Update"}
                </button>
              </form>
            )}
          </div>
        ))}
      </section>

      <section className="mt-10">
        <h2 className="section-title">Add goal</h2>
        <form action={createGoal} className="card mt-3 grid gap-3 sm:grid-cols-6">
          <div className="sm:col-span-3">
            <label htmlFor="title" className="field-label">
              Title
            </label>
            <input id="title" name="title" required className="input mt-1" />
          </div>

          <div>
            <label htmlFor="kind" className="field-label">
              Kind
            </label>
            <select id="kind" name="kind" className="input mt-1" defaultValue="metric">
              {GOAL_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {kind.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="category" className="field-label">
              Category
            </label>
            <select id="category" name="category" className="input mt-1" defaultValue="business">
              {GOAL_CATEGORIES.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="unit" className="field-label">
              Unit
            </label>
            <input id="unit" name="unit" className="input mt-1" placeholder="USD, subs, apps" />
          </div>

          <div>
            <label htmlFor="currentValue" className="field-label">
              Current
            </label>
            <input id="currentValue" name="currentValue" type="number" step="any" className="input mt-1" />
          </div>

          <div>
            <label htmlFor="targetValue" className="field-label">
              Target
            </label>
            <input id="targetValue" name="targetValue" type="number" step="any" className="input mt-1" />
          </div>

          <div>
            <label htmlFor="targetDate" className="field-label">
              Target date
            </label>
            <input id="targetDate" name="targetDate" type="date" className="input mt-1" />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="habitId" className="field-label">
              Habit (streak goals)
            </label>
            <select id="habitId" name="habitId" className="input mt-1" defaultValue="">
              <option value="">None</option>
              {habits.map((habit) => (
                <option key={habit.id} value={habit.id}>
                  {habit.emoji ? `${habit.emoji} ` : ""}
                  {habit.name}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-6">
            <button type="submit" className="btn-primary">
              Add goal
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
