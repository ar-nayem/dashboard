import "dotenv/config";
import { readFileSync } from "node:fs";
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
  await prisma.investmentReturn.deleteMany();
  await prisma.investmentTopUp.deleteMany();
  await prisma.investment.deleteMany();
  await prisma.transfer.deleteMany();
  await prisma.exchangeRate.deleteMany();
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
  await prisma.syncRun.deleteMany();
  await prisma.integration.deleteMany();
  await prisma.task.deleteMany();
  await prisma.client.deleteMany();
  await prisma.goal.deleteMany();
  await prisma.habit.deleteMany();
  await prisma.project.deleteMany();
  await prisma.area.deleteMany();

  // Guard against the list above drifting out of date. It silently missed
  // Transfer, Investment, InvestmentReturn, InvestmentTopUp and SyncRun once
  // already — a reset that reports "empty" while leaving rows behind is worse
  // than one that fails, because the leftovers surface later as phantom data.
  // Model names come from the schema file rather than Prisma.dmmf, which the
  // generated client in Prisma 7 does not expose.
  //
  // AppSetting is deliberately exempt: it holds the in-app password override
  // (see src/lib/password.ts), which is auth configuration, not personal
  // data — wiping it on every reset would silently revert the password to
  // whatever is in .env, an unpleasant surprise to discover by being locked
  // out. It is excluded from both the deleteMany() calls above and this
  // check, on purpose.
  const PRESERVED_MODELS = new Set(["AppSetting"]);

  const schema = readFileSync(new URL("schema.prisma", import.meta.url), "utf8");
  const modelNames = [...schema.matchAll(/^model\s+(\w+)/gm)]
    .map((match) => match[1])
    .filter((name) => !PRESERVED_MODELS.has(name));

  const leftovers: string[] = [];
  for (const name of modelNames) {
    const delegate = (prisma as unknown as Record<string, { count?: () => Promise<number> }>)[
      name.charAt(0).toLowerCase() + name.slice(1)
    ];
    if (!delegate?.count) continue;
    const remaining = await delegate.count();
    if (remaining > 0) leftovers.push(`${name} (${remaining})`);
  }

  if (leftovers.length > 0) {
    throw new Error(
      `Reset left rows behind in: ${leftovers.join(", ")}.\n` +
        "Add the missing deleteMany() calls above — the database is NOT empty.",
    );
  }

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
