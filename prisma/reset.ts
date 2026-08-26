import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { INTEGRATION_SEED } from "./integration-seed";
import { installWorkoutLibrary } from "./seed-workouts";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
const prisma = new PrismaClient({ adapter });

/**
 * Empties every table, then re-creates only the rows the app cannot work
 * without: the integration registry.
 *
 * This — not the demo seed — is the intended starting state. Everything else
 * is yours to enter.
 */
async function main() {
  console.log("Deleting all data…");

  // Children before parents. Cascades would cover most of this, but being
  // explicit means the reset behaves the same whether or not SQLite has
  // foreign keys enforced.
  await prisma.habitLog.deleteMany();
  await prisma.workoutSet.deleteMany();
  await prisma.workout.deleteMany();
  await prisma.templateExercise.deleteMany();
  await prisma.workoutTemplate.deleteMany();
  await prisma.exercise.deleteMany();
  await prisma.healthMetric.deleteMany();
  await prisma.accountSnapshot.deleteMany();
  await prisma.holding.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.account.deleteMany();
  await prisma.loan.deleteMany();
  await prisma.projectMetric.deleteMany();
  await prisma.projectTodo.deleteMany();
  await prisma.advisorProposal.deleteMany();
  await prisma.projectNote.deleteMany();
  await prisma.videoSubtask.deleteMany();
  await prisma.video.deleteMany();
  await prisma.socialStat.deleteMany();
  await prisma.article.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.idea.deleteMany();
  await prisma.document.deleteMany();
  await prisma.birthday.deleteMany();
  await prisma.shipLog.deleteMany();
  await prisma.integration.deleteMany();
  await prisma.task.deleteMany();
  await prisma.client.deleteMany();
  await prisma.goal.deleteMany();
  await prisma.habit.deleteMany();
  await prisma.project.deleteMany();
  await prisma.area.deleteMany();

  console.log("Creating the integration registry…");
  await prisma.integration.createMany({ data: INTEGRATION_SEED });

  // Reinstalled rather than left empty: an exercise library and workout
  // templates are reference data the Fitness tab needs to function, not
  // someone's personal records. Demo projects and fake revenue stay opt-in.
  console.log("Installing the workout library…");
  await installWorkoutLibrary(prisma);

  console.log("\nDone. No personal data — ready for your own.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
