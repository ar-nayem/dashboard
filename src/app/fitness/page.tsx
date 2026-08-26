import Link from "next/link";
import { verifySession } from "@/lib/session";
import { EmptyState } from "@/components/empty-state";
import {
  getLiveWorkout,
  getRecentWorkouts,
  getTemplatesByGroup,
  getWeekActivity,
} from "@/lib/data-fitness";
import { formatDurationShort, formatRelative } from "@/lib/format";
import { startEmptyWorkout, startFromTemplate, deleteWorkout } from "./actions";

export const dynamic = "force-dynamic";

const WEEKDAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];

export default async function FitnessPage() {
  await verifySession();

  const [live, groups, recent, week] = await Promise.all([
    getLiveWorkout(),
    getTemplatesByGroup(),
    getRecentWorkouts(),
    getWeekActivity(),
  ]);

  return (
    <div className="page">
      <h1 className="page-title">🏋 Fitness</h1>

      {live && (
        <Link
          href={`/fitness/${live.id}`}
          className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-accent bg-accent/10 px-4 py-3 transition-colors duration-150 hover:bg-accent/15"
        >
          <span className="text-sm text-foreground">
            <strong className="font-medium">{live.name}</strong> is in progress
          </span>
          <span className="text-xs font-medium text-accent">Resume →</span>
        </Link>
      )}

      {!live && (
        <form action={startEmptyWorkout} className="mt-5">
          <button type="submit" className="btn-primary w-full py-3 text-base">
            ▶ Start Workout
          </button>
        </form>
      )}

      {/* --- Week strip --------------------------------------------------- */}
      <section className="mt-6">
        <div className="flex justify-between gap-1">
          {week.map((day) => (
            <div key={day.date.toISOString()} className="flex flex-1 flex-col items-center gap-1.5">
              <span className="text-xs text-muted-foreground">
                {WEEKDAY_INITIALS[day.date.getDay()]}
              </span>
              <span
                className={`h-2 w-2 rounded-full ${day.worked ? "bg-accent" : "bg-border"}`}
                aria-label={day.worked ? "Trained" : "Rest"}
              />
            </div>
          ))}
        </div>
      </section>

      {/* --- Templates ---------------------------------------------------- */}
      <section className="mt-8">
        <h2 className="section-title">📖 Start from Template</h2>
        <div className="mt-3 flex flex-col gap-5">
          {groups.map((group) => (
            <div key={group.name}>
              <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {group.name}
              </h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {group.templates.map((template) => (
                  <div
                    key={template.id}
                    className="card flex flex-col transition-colors duration-150 hover:bg-surface-hover"
                  >
                    <span className="text-sm font-medium text-foreground">{template.name}</span>

                    {/* Body parts trained, in training order — the whole point
                        of a split is knowing what a day covers at a glance. */}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {template.muscleGroups.map((muscle) => (
                        <span
                          key={muscle}
                          className="rounded bg-accent/12 px-1.5 py-0.5 text-[10px] text-accent"
                        >
                          {muscle}
                        </span>
                      ))}
                    </div>

                    <span className="mt-2 block text-[11px] text-muted-foreground">
                      {template.exerciseCount} exercises · {template.totalSets} sets
                    </span>

                    {template.description && (
                      <span className="mt-1 block text-[11px] text-faint-foreground">
                        {template.description}
                      </span>
                    )}

                    <details className="mt-2">
                      <summary className="cursor-pointer text-[11px] text-muted-foreground hover:text-foreground">
                        Exercises
                      </summary>
                      <ul className="mt-1.5 flex flex-col gap-0.5">
                        {template.exercises.map((entry) => (
                          <li
                            key={entry.name}
                            className="flex items-baseline justify-between gap-2 text-[11px]"
                          >
                            <span className="text-foreground/80">{entry.name}</span>
                            <span className="tnum shrink-0 text-faint-foreground">
                              {entry.targetSets} × {entry.repRange}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </details>

                    <form action={startFromTemplate} className="mt-3">
                      <input type="hidden" name="templateId" value={template.id} />
                      <button type="submit" className="btn-ghost w-full py-1.5 text-xs">
                        Start this
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* --- History ------------------------------------------------------ */}
      <section className="mt-8">
        <h2 className="section-title">Recent Workouts</h2>
        <div className="mt-3 flex flex-col gap-2">
          {recent.length === 0 && <EmptyState message="No workouts logged yet." />}

          {recent.map((workout) => (
            <div key={workout.id} className="card flex items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <span className="block text-sm font-medium text-foreground">{workout.name}</span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {workout.exerciseNames.slice(0, 3).join(", ")}
                  {workout.exerciseNames.length > 3
                    ? ` +${workout.exerciseNames.length - 3}`
                    : ""}
                </span>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <span className="text-right">
                  <span className="block text-xs text-muted-foreground">
                    {formatRelative(workout.startedAt)}
                  </span>
                  {workout.durationSeconds !== null && (
                    <span className="tnum block text-xs text-foreground/80">
                      {formatDurationShort(workout.durationSeconds)}
                    </span>
                  )}
                </span>

                <form action={deleteWorkout}>
                  <input type="hidden" name="id" value={workout.id} />
                  <button
                    type="submit"
                    aria-label={`Delete ${workout.name}`}
                    className="cursor-pointer text-xs text-faint-foreground hover:text-danger"
                  >
                    ✕
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
