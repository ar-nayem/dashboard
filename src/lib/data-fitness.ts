import { prisma } from "@/lib/prisma";
import { startOfDay, subDays } from "date-fns";

/** The one workout with no finishedAt, if a session is in progress. */
export async function getLiveWorkout() {
  return prisma.workout.findFirst({
    where: { finishedAt: null },
    orderBy: { startedAt: "desc" },
    select: { id: true, name: true, startedAt: true },
  });
}

export type TemplateCard = {
  id: string;
  name: string;
  description: string | null;
  exerciseCount: number;
  /** Total working sets across the template — the honest "how long is this". */
  totalSets: number;
  /** Distinct muscle groups, in the order they are first trained. */
  muscleGroups: string[];
  exercises: { name: string; targetSets: number; repRange: string; muscleGroup: string | null }[];
};

export async function getTemplatesByGroup(): Promise<{ name: string; templates: TemplateCard[] }[]> {
  const templates = await prisma.workoutTemplate.findMany({
    orderBy: [{ sortOrder: "asc" }, { groupName: "asc" }],
    include: {
      exercises: {
        orderBy: { sortOrder: "asc" },
        include: { exercise: { select: { name: true, muscleGroup: true } } },
      },
    },
  });

  const groups = new Map<string, TemplateCard[]>();

  for (const template of templates) {
    const card: TemplateCard = {
      id: template.id,
      name: template.name,
      description: template.description,
      exerciseCount: template.exercises.length,
      totalSets: template.exercises.reduce((sum, entry) => sum + entry.targetSets, 0),
      // A Set preserves insertion order, so this reads in training order
      // rather than alphabetically — which is what makes a "3-part" day
      // legible at a glance.
      muscleGroups: [
        ...new Set(
          template.exercises
            .map((entry) => entry.exercise.muscleGroup)
            .filter((group): group is string => Boolean(group)),
        ),
      ],
      exercises: template.exercises.map((entry) => ({
        name: entry.exercise.name,
        targetSets: entry.targetSets,
        repRange: entry.repRange,
        muscleGroup: entry.exercise.muscleGroup,
      })),
    };

    const list = groups.get(template.groupName) ?? [];
    list.push(card);
    groups.set(template.groupName, list);
  }

  return [...groups.entries()].map(([name, items]) => ({ name, templates: items }));
}

export type WorkoutSummary = {
  id: string;
  name: string;
  startedAt: Date;
  finishedAt: Date | null;
  durationSeconds: number | null;
  exerciseNames: string[];
  setCount: number;
};

/** Recent finished workouts with a one-line exercise summary. */
export async function getRecentWorkouts(limit = 8): Promise<WorkoutSummary[]> {
  const workouts = await prisma.workout.findMany({
    where: { finishedAt: { not: null } },
    orderBy: { startedAt: "desc" },
    take: limit,
    include: {
      sets: {
        orderBy: { id: "asc" },
        include: { exercise: { select: { name: true } } },
      },
    },
  });

  return workouts.map((workout) => ({
    id: workout.id,
    name: workout.name,
    startedAt: workout.startedAt,
    finishedAt: workout.finishedAt,
    durationSeconds: workout.finishedAt
      ? Math.round((workout.finishedAt.getTime() - workout.startedAt.getTime()) / 1000)
      : null,
    // Distinct, in the order the exercises were first performed.
    exerciseNames: [...new Set(workout.sets.map((set) => set.exercise.name))],
    setCount: workout.sets.length,
  }));
}

/** Which of the last 7 days had a workout — the week strip on the Fitness tab. */
export async function getWeekActivity(): Promise<{ date: Date; worked: boolean }[]> {
  const today = startOfDay(new Date());
  const start = subDays(today, 6);

  const workouts = await prisma.workout.findMany({
    where: { startedAt: { gte: start } },
    select: { startedAt: true },
  });

  const workedDays = new Set(workouts.map((w) => startOfDay(w.startedAt).toDateString()));

  return Array.from({ length: 7 }, (_, i) => {
    const date = subDays(today, 6 - i);
    return { date, worked: workedDays.has(date.toDateString()) };
  });
}

export type SessionExercise = {
  exerciseId: string;
  name: string;
  equipment: string;
  sets: {
    id: string;
    setNumber: number;
    weight: number | null;
    unit: string;
    reps: number | null;
    completed: boolean;
  }[];
  /** What was done for this exercise in the previous workout, per set. */
  previous: { setNumber: number; weight: number | null; unit: string; reps: number | null }[];
};

/**
 * A workout shaped for the live session view: sets grouped by exercise, each
 * with the matching sets from the last time that exercise was trained.
 *
 * The "previous" column is what makes progressive overload possible without
 * flipping back through history.
 */
export async function getWorkoutSession(workoutId: string) {
  const workout = await prisma.workout.findUnique({
    where: { id: workoutId },
    include: {
      sets: {
        orderBy: [{ exerciseId: "asc" }, { setNumber: "asc" }],
        include: { exercise: { select: { id: true, name: true, equipment: true } } },
      },
    },
  });
  if (!workout) return null;

  const exerciseIds = [...new Set(workout.sets.map((set) => set.exerciseId))];

  // Previous performance: the most recent OTHER workout containing each
  // exercise. Queried per exercise because "the last time I did this lift"
  // differs by lift — a single "previous workout" would be wrong.
  const previousByExercise = new Map<string, SessionExercise["previous"]>();
  await Promise.all(
    exerciseIds.map(async (exerciseId) => {
      const priorSet = await prisma.workoutSet.findFirst({
        where: { exerciseId, workoutId: { not: workoutId }, workout: { finishedAt: { not: null } } },
        orderBy: { workout: { startedAt: "desc" } },
        select: { workoutId: true },
      });
      if (!priorSet) return;

      const sets = await prisma.workoutSet.findMany({
        where: { exerciseId, workoutId: priorSet.workoutId },
        orderBy: { setNumber: "asc" },
        select: { setNumber: true, weight: true, unit: true, reps: true },
      });
      previousByExercise.set(exerciseId, sets);
    }),
  );

  const byExercise = new Map<string, SessionExercise>();
  for (const set of workout.sets) {
    const entry = byExercise.get(set.exerciseId) ?? {
      exerciseId: set.exerciseId,
      name: set.exercise.name,
      equipment: set.exercise.equipment,
      sets: [],
      previous: previousByExercise.get(set.exerciseId) ?? [],
    };
    entry.sets.push({
      id: set.id,
      setNumber: set.setNumber,
      weight: set.weight,
      unit: set.unit,
      reps: set.reps,
      completed: set.completed,
    });
    byExercise.set(set.exerciseId, entry);
  }

  return {
    id: workout.id,
    name: workout.name,
    startedAt: workout.startedAt,
    finishedAt: workout.finishedAt,
    exercises: [...byExercise.values()],
    totalSets: workout.sets.length,
    completedSets: workout.sets.filter((set) => set.completed).length,
  };
}

export async function getAllExercises() {
  return prisma.exercise.findMany({ orderBy: { name: "asc" } });
}
