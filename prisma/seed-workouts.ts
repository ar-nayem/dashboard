import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { EXERCISES, TEMPLATES } from "./workout-library";

/**
 * Installs the stock exercise library and workout templates.
 *
 * Idempotent and additive: exercises are upserted by name and templates by
 * [name, groupName], so re-running updates the stock content without
 * duplicating it. It never deletes a Workout or WorkoutSet — your logged
 * history is untouched, and exercises you added yourself are left alone.
 *
 * Safe to run against a live database. Exported so `db:reset` can install it
 * too: unlike demo data, an exercise library is something the Fitness tab
 * needs in order to be usable at all.
 */
export async function installWorkoutLibrary(
  prisma: PrismaClient,
  log: (message: string) => void = console.log,
): Promise<{ exercisesCreated: number; templatesCreated: number }> {
  const exerciseIds = new Map<string, string>();
  let exercisesCreated = 0;

  for (const seed of EXERCISES) {
    const existing = await prisma.exercise.findUnique({
      where: { name: seed.name },
      select: { id: true },
    });

    if (existing) {
      // Update the metadata but keep the row, so every WorkoutSet referencing
      // this exercise keeps its history.
      await prisma.exercise.update({
        where: { id: existing.id },
        data: { equipment: seed.equipment, muscleGroup: seed.muscleGroup },
      });
      exerciseIds.set(seed.name, existing.id);
    } else {
      const created = await prisma.exercise.create({ data: seed });
      exerciseIds.set(seed.name, created.id);
      exercisesCreated++;
    }
  }

  log(`  ${EXERCISES.length} exercises (${exercisesCreated} new)`);

  let templatesCreated = 0;

  for (const [index, seed] of TEMPLATES.entries()) {
    // A template's exercise list is fully replaced on re-run so library edits
    // take effect. Past workouts are unaffected — they store their own sets
    // and keep templateId only as provenance.
    const existing = await prisma.workoutTemplate.findFirst({
      where: { name: seed.name, groupName: seed.groupName },
      select: { id: true },
    });

    const entries = seed.exercises
      .map(([name, targetSets, repRange], order) => {
        const exerciseId = exerciseIds.get(name);
        if (!exerciseId) {
          // A template naming an exercise the library doesn't define is a bug
          // in workout-library.ts, not a reason to abort the whole seed.
          log(`  ! "${seed.name}" references unknown exercise "${name}" — skipped`);
          return null;
        }
        return { exerciseId, sortOrder: order, targetSets, repRange };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    if (existing) {
      await prisma.$transaction([
        prisma.templateExercise.deleteMany({ where: { templateId: existing.id } }),
        prisma.workoutTemplate.update({
          where: { id: existing.id },
          data: { description: seed.description, sortOrder: index, exercises: { create: entries } },
        }),
      ]);
    } else {
      await prisma.workoutTemplate.create({
        data: {
          name: seed.name,
          groupName: seed.groupName,
          description: seed.description,
          sortOrder: index,
          exercises: { create: entries },
        },
      });
      templatesCreated++;
    }
  }

  log(`  ${TEMPLATES.length} templates (${templatesCreated} new)`);

  return { exercisesCreated, templatesCreated };
}

// --- CLI entry point -------------------------------------------------------

// Only runs when invoked directly (`npm run seed:workouts`), not when
// reset.ts imports installWorkoutLibrary.
if (process.argv[1]?.includes("seed-workouts")) {
  const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
  const prisma = new PrismaClient({ adapter });

  console.log("Installing workout library…");

  installWorkoutLibrary(prisma)
    .then(() => {
      const groups = [...new Set(TEMPLATES.map((template) => template.groupName))];
      console.log(`\nTemplate groups on the Fitness tab: ${groups.join(", ")}`);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
