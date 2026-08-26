"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/session";
import { toUtcDay } from "@/lib/data-habits";
import { HABIT_KINDS, parseEnum } from "@/lib/enums";

/**
 * Cycles one cell: unlogged → success → fail → unlogged.
 *
 * "skip" is deliberately not in the click cycle — it's a rarer, deliberate
 * choice, so it would cost two extra taps on every normal log. It is set
 * from the habit's own page instead.
 */
export async function cycleHabitLog(formData: FormData) {
  await verifySession();

  const habitId = String(formData.get("habitId") ?? "");
  const dateRaw = String(formData.get("date") ?? "");
  if (!habitId || !dateRaw) return;

  const parsed = new Date(dateRaw);
  if (Number.isNaN(parsed.getTime())) return;
  const date = toUtcDay(parsed);

  // Never let a future day be logged — it would silently break streaks by
  // creating rows ahead of today.
  if (date.getTime() > toUtcDay(new Date()).getTime()) return;

  const existing = await prisma.habitLog.findUnique({
    where: { habitId_date: { habitId, date } },
  });

  if (!existing) {
    await prisma.habitLog.create({ data: { habitId, date, status: "success" } });
  } else if (existing.status === "success") {
    await prisma.habitLog.update({ where: { id: existing.id }, data: { status: "fail" } });
  } else {
    await prisma.habitLog.delete({ where: { id: existing.id } });
  }

  revalidatePath("/habits");
  revalidatePath("/");
}

export async function createHabit(formData: FormData) {
  await verifySession();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const emoji = String(formData.get("emoji") ?? "").trim() || null;
  const kind = parseEnum(HABIT_KINDS, String(formData.get("kind") ?? ""));
  const areaId = String(formData.get("areaId") ?? "") || null;

  // New habits go to the end of the list.
  const last = await prisma.habit.findFirst({
    where: { archived: false },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  await prisma.habit.create({
    data: { name, emoji, kind, areaId, sortOrder: (last?.sortOrder ?? -1) + 1 },
  });

  revalidatePath("/habits");
}

export async function archiveHabit(formData: FormData) {
  await verifySession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  // Archive rather than delete: deleting would cascade the whole log history
  // and silently destroy streak records.
  await prisma.habit.update({ where: { id }, data: { archived: true } });
  revalidatePath("/habits");
}

export async function reorderHabit(formData: FormData) {
  await verifySession();

  const id = String(formData.get("id") ?? "");
  const direction = String(formData.get("direction") ?? "");
  if (!id || (direction !== "up" && direction !== "down")) return;

  const habits = await prisma.habit.findMany({
    where: { archived: false },
    orderBy: { sortOrder: "asc" },
    select: { id: true, sortOrder: true },
  });

  const index = habits.findIndex((habit) => habit.id === id);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapWith < 0 || swapWith >= habits.length) return;

  // Swap the two sortOrder values in one transaction so a failure can't
  // leave both rows holding the same order.
  await prisma.$transaction([
    prisma.habit.update({
      where: { id: habits[index].id },
      data: { sortOrder: habits[swapWith].sortOrder },
    }),
    prisma.habit.update({
      where: { id: habits[swapWith].id },
      data: { sortOrder: habits[index].sortOrder },
    }),
  ]);

  revalidatePath("/habits");
}
