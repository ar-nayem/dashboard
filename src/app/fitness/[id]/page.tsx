import Link from "next/link";
import { notFound } from "next/navigation";
import { verifySession } from "@/lib/session";
import { WorkoutTimer } from "@/components/workout-timer";
import { EmptyState } from "@/components/empty-state";
import { getAllExercises, getWorkoutSession } from "@/lib/data-fitness";
import { WEIGHT_UNITS } from "@/lib/enums";
import { formatDate } from "@/lib/format";
import {
  addExerciseToWorkout,
  addSet,
  deleteSet,
  finishWorkout,
  logSet,
  renameWorkout,
  toggleSetComplete,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function WorkoutSessionPage({ params }: { params: Promise<{ id: string }> }) {
  await verifySession();

  const { id } = await params;
  const [session, exercises] = await Promise.all([getWorkoutSession(id), getAllExercises()]);
  if (!session) notFound();

  const live = session.finishedAt === null;

  return (
    <div className="page">
      <Link href="/fitness" className="text-xs text-muted-foreground hover:text-foreground">
        ← Fitness
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <form action={renameWorkout} className="flex items-center gap-2">
            <input type="hidden" name="id" value={session.id} />
            <input
              name="name"
              defaultValue={session.name}
              aria-label="Workout name"
              className="border-none bg-transparent p-0 text-3xl font-semibold tracking-tight text-foreground outline-none focus:ring-0"
            />
            <button type="submit" className="btn-ghost px-2 py-1 text-xs">
              ✎
            </button>
          </form>

          <div className="mt-1 flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {formatDate(session.startedAt)}
            </span>
            {live && <WorkoutTimer startedAtMs={session.startedAt.getTime()} />}
            <span className="tnum text-sm text-muted-foreground">
              {session.completedSets}/{session.totalSets}
            </span>
          </div>
        </div>

        {live && (
          <form action={finishWorkout}>
            <input type="hidden" name="id" value={session.id} />
            <button type="submit" className="btn bg-success text-white hover:bg-success/90">
              Finish
            </button>
          </form>
        )}
      </div>

      <section className="mt-6 flex flex-col gap-4">
        {session.exercises.length === 0 && (
          <EmptyState message="No exercises yet — add one below." />
        )}

        {session.exercises.map((exercise) => (
          <div key={exercise.exerciseId} className="card p-0">
            <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-3">
              <span className="font-medium text-foreground">{exercise.name}</span>
              <span className="badge px-2 py-0.5 text-[10px]">{exercise.equipment}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="text-left text-[11px] tracking-wide text-muted-foreground uppercase">
                    <th className="px-5 py-2 font-medium">Set</th>
                    <th className="py-2 font-medium">Previous</th>
                    <th className="py-2 font-medium">Weight</th>
                    <th className="py-2 font-medium">Reps</th>
                    <th className="px-5 py-2 text-right font-medium">✓</th>
                  </tr>
                </thead>
                <tbody>
                  {exercise.sets.map((set) => {
                    const previous = exercise.previous.find(
                      (entry) => entry.setNumber === set.setNumber,
                    );
                    return (
                      <tr key={set.id} className="border-t border-border">
                        <td className="tnum px-5 py-2 text-muted-foreground">{set.setNumber}</td>

                        <td className="py-2 text-muted-foreground">
                          {previous && previous.weight !== null
                            ? `${previous.weight} ${previous.unit} × ${previous.reps ?? "—"}`
                            : previous
                              ? `× ${previous.reps ?? "—"}`
                              : "—"}
                        </td>

                        {/* One form per row: weight, reps, and unit save
                            together, so a half-typed row is never persisted. */}
                        <td className="py-2">
                          <form
                            action={logSet}
                            id={`set-${set.id}`}
                            className="flex items-center gap-1"
                          >
                            <input type="hidden" name="id" value={set.id} />
                            <input
                              name="weight"
                              type="number"
                              step="any"
                              defaultValue={set.weight ?? ""}
                              placeholder="—"
                              aria-label={`Weight for set ${set.setNumber}`}
                              className="input w-20 px-2 py-1 text-xs"
                            />
                            <select
                              name="unit"
                              defaultValue={set.unit}
                              aria-label="Unit"
                              className="input w-14 px-1 py-1 text-xs"
                            >
                              {WEIGHT_UNITS.map((unit) => (
                                <option key={unit} value={unit}>
                                  {unit}
                                </option>
                              ))}
                            </select>
                          </form>
                        </td>

                        <td className="py-2">
                          <input
                            form={`set-${set.id}`}
                            name="reps"
                            type="number"
                            defaultValue={set.reps ?? ""}
                            placeholder="8-12"
                            aria-label={`Reps for set ${set.setNumber}`}
                            className="input w-20 px-2 py-1 text-xs"
                          />
                        </td>

                        <td className="px-5 py-2">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              form={`set-${set.id}`}
                              type="submit"
                              aria-label={`Save set ${set.setNumber}`}
                              className="cursor-pointer rounded px-1.5 py-0.5 text-xs text-faint-foreground hover:text-foreground"
                            >
                              save
                            </button>

                            <form action={toggleSetComplete}>
                              <input type="hidden" name="id" value={set.id} />
                              <button
                                type="submit"
                                aria-label={
                                  set.completed
                                    ? `Mark set ${set.setNumber} incomplete`
                                    : `Mark set ${set.setNumber} complete`
                                }
                                className={`h-6 w-6 cursor-pointer rounded border text-xs ${
                                  set.completed
                                    ? "border-success bg-success/20 text-success"
                                    : "border-border text-transparent hover:border-faint-foreground"
                                }`}
                              >
                                ✓
                              </button>
                            </form>

                            <form action={deleteSet}>
                              <input type="hidden" name="id" value={set.id} />
                              <button
                                type="submit"
                                aria-label={`Delete set ${set.setNumber}`}
                                className="cursor-pointer rounded px-1 text-xs text-faint-foreground hover:text-danger"
                              >
                                ✕
                              </button>
                            </form>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <form action={addSet} className="border-t border-border px-5 py-2">
              <input type="hidden" name="workoutId" value={session.id} />
              <input type="hidden" name="exerciseId" value={exercise.exerciseId} />
              <button
                type="submit"
                className="cursor-pointer text-xs text-muted-foreground hover:text-foreground"
              >
                + Add Set
              </button>
            </form>
          </div>
        ))}
      </section>

      <section className="mt-6">
        <form action={addExerciseToWorkout} className="card flex flex-wrap items-end gap-3">
          <input type="hidden" name="workoutId" value={session.id} />
          <div className="min-w-[220px] flex-1">
            <label htmlFor="exerciseId" className="field-label">
              Add exercise
            </label>
            <select id="exerciseId" name="exerciseId" className="input mt-1" defaultValue="">
              <option value="" disabled>
                Choose an exercise…
              </option>
              {exercises.map((exercise) => (
                <option key={exercise.id} value={exercise.id}>
                  {exercise.name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-ghost">
            Add
          </button>
        </form>
      </section>
    </div>
  );
}
