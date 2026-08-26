import { verifySession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { HabitGrid } from "@/components/habit-grid";
import { EmptyState } from "@/components/empty-state";
import { ProgressBar } from "@/components/charts/progress-bar";
import { completionRate, getHabitsWithLogs, recentDays } from "@/lib/data-habits";
import { createHabit } from "./actions";
import { HABIT_KINDS } from "@/lib/enums";

export const dynamic = "force-dynamic";

// How many day-columns the grid shows. 14 fits a phone without horizontal
// scrolling being the only way to read it, and still shows a fortnight's shape.
const GRID_DAYS = 14;

export default async function HabitsPage() {
  await verifySession();

  const [habits, areas] = await Promise.all([
    getHabitsWithLogs(GRID_DAYS),
    prisma.area.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  const days = recentDays(GRID_DAYS);

  return (
    <div className="page">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Habits</h1>
          <p className="page-subtitle">
            Tap a cell to log. Green = success, red = fail, grey = not logged.
          </p>
        </div>
      </div>

      <section className="mt-6">
        {habits.length === 0 ? (
          <EmptyState message="No habits yet — add your first one below." />
        ) : (
          <HabitGrid habits={habits} days={days} />
        )}
      </section>

      {habits.length > 0 && (
        <section className="mt-8">
          <h2 className="section-title">Last {GRID_DAYS} days</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {habits.map((habit) => {
              const rate = completionRate(habit.logsByDay, days);
              return (
                <div key={habit.id} className="tile">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm text-foreground">
                      {habit.emoji && <span className="mr-1.5">{habit.emoji}</span>}
                      {habit.name}
                    </span>
                    <span className="tnum shrink-0 text-xs text-muted-foreground">
                      {Math.round(rate)}%
                    </span>
                  </div>
                  <ProgressBar
                    percent={rate}
                    // Green once you're mostly hitting it, amber below that.
                    color={rate >= 70 ? "var(--success)" : "var(--warning)"}
                    className="mt-3"
                    label={`${habit.name} completion`}
                  />
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="mt-10">
        <h2 className="section-title">Add habit</h2>
        <form action={createHabit} className="card mt-3 grid gap-3 sm:grid-cols-5">
          <div className="sm:col-span-2">
            <label htmlFor="name" className="field-label">
              Name
            </label>
            <input id="name" name="name" required className="input mt-1" placeholder="Read 20 pages" />
          </div>

          <div>
            <label htmlFor="emoji" className="field-label">
              Emoji
            </label>
            <input id="emoji" name="emoji" className="input mt-1" placeholder="📖" maxLength={4} />
          </div>

          <div>
            <label htmlFor="kind" className="field-label">
              Kind
            </label>
            <select id="kind" name="kind" className="input mt-1" defaultValue="do">
              {HABIT_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {kind}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="areaId" className="field-label">
              Area
            </label>
            <select id="areaId" name="areaId" className="input mt-1" defaultValue="">
              <option value="">None</option>
              {areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-5">
            <button type="submit" className="btn-primary">
              Add habit
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
