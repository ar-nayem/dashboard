"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/session";
import { WEIGHT_UNITS, parseEnum } from "@/lib/enums";

/**
 * Starts an empty workout and jumps to its session page.
 *
 * Only one session may be live at a time — an existing unfinished workout is
 * reopened instead of starting a second, so the "live workout" lookup can
 * stay a single-row query.
 */
export async function startEmptyWorkout(formData: FormData) {
  await verifySession();

  const existing = await prisma.workout.findFirst({
    where: { finishedAt: null },
    orderBy: { startedAt: "desc" },
    select: { id: true },
  });
  if (existing) redirect(`/fitness/${existing.id}`);

  const name = String(formData.get("name") ?? "").trim() || "Workout";
  const workout = await prisma.workout.create({ data: { name } });

  redirect(`/fitness/${workout.id}`);
}

/** Starts a workout pre-filled with the template's exercises and target sets. */
export async function startFromTemplate(formData: FormData) {
  await verifySession();

  const templateId = String(formData.get("templateId") ?? "");
  if (!templateId) return;

  const existing = await prisma.workout.findFirst({
    where: { finishedAt: null },
    orderBy: { startedAt: "desc" },
    select: { id: true },
  });
  if (existing) redirect(`/fitness/${existing.id}`);

  const template = await prisma.workoutTemplate.findUnique({
    where: { id: templateId },
    include: { exercises: { orderBy: { sortOrder: "asc" } } },
  });
  if (!template) return;

  const workout = await prisma.workout.create({
    data: { name: `${template.name} Workout`, templateId: template.id },
  });

  // Empty placeholder sets — weight and reps stay null until you log them,
  // which is what makes the row render as an unfilled input.
  const setRows = template.exercises.flatMap((entry) =>
    Array.from({ length: entry.targetSets }, (_, i) => ({
      workoutId: workout.id,
      exerciseId: entry.exerciseId,
      setNumber: i + 1,
      completed: false,
    })),
  );
  if (setRows.length > 0) await prisma.workoutSet.createMany({ data: setRows });

  redirect(`/fitness/${workout.id}`);
}

export async function logSet(formData: FormData) {
  await verifySession();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const weightRaw = String(formData.get("weight") ?? "").trim();
  const repsRaw = String(formData.get("reps") ?? "").trim();

  const weight = weightRaw === "" ? null : Number(weightRaw);
  const reps = repsRaw === "" ? null : Number(repsRaw);

  await prisma.workoutSet.update({
    where: { id },
    data: {
      weight: weight !== null && Number.isFinite(weight) ? weight : null,
      reps: reps !== null && Number.isFinite(reps) ? Math.round(reps) : null,
      unit: parseEnum(WEIGHT_UNITS, String(formData.get("unit") ?? "")),
      // Logging a set marks it done; a set with neither number is not.
      completed: weightRaw !== "" || repsRaw !== "",
    },
  });

  revalidatePath(`/fitness`, "layout");
}

export async function toggleSetComplete(formData: FormData) {
  await verifySession();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const set = await prisma.workoutSet.findUnique({ where: { id }, select: { completed: true } });
  if (!set) return;

  await prisma.workoutSet.update({ where: { id }, data: { completed: !set.completed } });
  revalidatePath(`/fitness`, "layout");
}

export async function addSet(formData: FormData) {
  await verifySession();

  const workoutId = String(formData.get("workoutId") ?? "");
  const exerciseId = String(formData.get("exerciseId") ?? "");
  if (!workoutId || !exerciseId) return;

  const last = await prisma.workoutSet.findFirst({
    where: { workoutId, exerciseId },
    orderBy: { setNumber: "desc" },
    select: { setNumber: true, unit: true },
  });

  await prisma.workoutSet.create({
    data: {
      workoutId,
      exerciseId,
      setNumber: (last?.setNumber ?? 0) + 1,
      // Inherit the unit already in use for this exercise, so adding a set
      // doesn't silently switch lb to kg.
      unit: last?.unit ?? "lb",
    },
  });

  revalidatePath(`/fitness`, "layout");
}

export async function deleteSet(formData: FormData) {
  await verifySession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.workoutSet.delete({ where: { id } });
  revalidatePath(`/fitness`, "layout");
}

export async function addExerciseToWorkout(formData: FormData) {
  await verifySession();

  const workoutId = String(formData.get("workoutId") ?? "");
  const exerciseId = String(formData.get("exerciseId") ?? "");
  if (!workoutId || !exerciseId) return;

  const already = await prisma.workoutSet.findFirst({
    where: { workoutId, exerciseId },
    select: { id: true },
  });
  if (already) return;

  await prisma.workoutSet.createMany({
    data: Array.from({ length: 3 }, (_, i) => ({
      workoutId,
      exerciseId,
      setNumber: i + 1,
      completed: false,
    })),
  });

  revalidatePath(`/fitness`, "layout");
}

export async function finishWorkout(formData: FormData) {
  await verifySession();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  // Unlogged placeholder sets are removed on finish, so a template's three
  // planned sets don't become three empty rows in the history.
  await prisma.$transaction([
    prisma.workoutSet.deleteMany({
      where: { workoutId: id, completed: false, weight: null, reps: null },
    }),
    prisma.workout.update({ where: { id }, data: { finishedAt: new Date() } }),
  ]);

  revalidatePath("/fitness", "layout");
  redirect("/fitness");
}

export async function renameWorkout(formData: FormData) {
  await verifySession();

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) return;

  await prisma.workout.update({ where: { id }, data: { name } });
  revalidatePath(`/fitness`, "layout");
}

export async function deleteWorkout(formData: FormData) {
  await verifySession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.workout.delete({ where: { id } });
  revalidatePath("/fitness", "layout");
}
