"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/session";
import { GOAL_CATEGORIES, GOAL_KINDS, parseEnum } from "@/lib/enums";

export async function createGoal(formData: FormData) {
  await verifySession();

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const kind = parseEnum(GOAL_KINDS, String(formData.get("kind") ?? ""));
  const category = parseEnum(GOAL_CATEGORIES, String(formData.get("category") ?? ""));

  const targetRaw = formData.get("targetValue");
  const targetValue = targetRaw === null || targetRaw === "" ? null : Number(targetRaw);

  const currentRaw = formData.get("currentValue");
  const currentValue = currentRaw === null || currentRaw === "" ? null : Number(currentRaw);

  const dateRaw = String(formData.get("targetDate") ?? "");
  const targetDate = dateRaw ? new Date(dateRaw) : null;

  // A habit-streak goal without a habit would have nothing to measure, so the
  // link is only kept when the kind actually uses it.
  const habitId = kind === "habit_streak" ? String(formData.get("habitId") ?? "") || null : null;

  await prisma.goal.create({
    data: {
      title,
      description: String(formData.get("description") ?? "").trim() || null,
      kind,
      category,
      unit: String(formData.get("unit") ?? "").trim() || null,
      targetValue: targetValue !== null && Number.isFinite(targetValue) ? targetValue : null,
      currentValue: currentValue !== null && Number.isFinite(currentValue) ? currentValue : null,
      targetDate: targetDate && !Number.isNaN(targetDate.getTime()) ? targetDate : null,
      habitId,
    },
  });

  revalidatePath("/goals");
}

/** Updates the measured value of a metric goal, or the percent of a manual one. */
export async function updateGoalProgress(formData: FormData) {
  await verifySession();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const goal = await prisma.goal.findUnique({ where: { id }, select: { kind: true } });
  if (!goal) return;

  const value = Number(formData.get("value"));
  if (!Number.isFinite(value)) return;

  if (goal.kind === "manual") {
    await prisma.goal.update({
      where: { id },
      data: { progress: Math.max(0, Math.min(100, Math.round(value))) },
    });
  } else if (goal.kind === "metric") {
    await prisma.goal.update({ where: { id }, data: { currentValue: value } });
  }
  // habit_streak goals derive their value from logs — nothing to write.

  revalidatePath("/goals");
}

export async function deleteGoal(formData: FormData) {
  await verifySession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.goal.delete({ where: { id } });
  revalidatePath("/goals");
}
