"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/session";
import { PRIORITIES, TASK_STATUSES, parseEnum } from "@/lib/enums";

function revalidateTaskViews() {
  revalidatePath("/todos");
  revalidatePath("/");
}

export async function createTask(formData: FormData) {
  await verifySession();

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const dueRaw = String(formData.get("dueDate") ?? "");
  const dueDate = dueRaw ? new Date(dueRaw) : null;

  const last = await prisma.task.findFirst({
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  await prisma.task.create({
    data: {
      title,
      notes: String(formData.get("notes") ?? "").trim() || null,
      priority: parseEnum(PRIORITIES, String(formData.get("priority") ?? "")),
      sprint: formData.get("sprint") === "on",
      // An unparseable date string yields an Invalid Date, which Prisma would
      // reject at write time — treat it as "no due date" instead.
      dueDate: dueDate && !Number.isNaN(dueDate.getTime()) ? dueDate : null,
      areaId: String(formData.get("areaId") ?? "") || null,
      clientId: String(formData.get("clientId") ?? "") || null,
      projectId: String(formData.get("projectId") ?? "") || null,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });

  revalidateTaskViews();
}

/** Checkbox toggle: done <-> todo, stamping completedAt on the way in. */
export async function toggleTaskDone(formData: FormData) {
  await verifySession();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const task = await prisma.task.findUnique({ where: { id }, select: { status: true } });
  if (!task) return;

  const done = task.status === "done";
  await prisma.task.update({
    where: { id },
    data: {
      status: done ? "todo" : "done",
      completedAt: done ? null : new Date(),
      // Completing a task takes it out of the sprint automatically — a done
      // item sitting in "RIGHT NOW" is just noise.
      sprint: done ? undefined : false,
    },
  });

  revalidateTaskViews();
}

export async function setTaskStatus(formData: FormData) {
  await verifySession();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const status = parseEnum(TASK_STATUSES, String(formData.get("status") ?? ""));
  await prisma.task.update({
    where: { id },
    data: { status, completedAt: status === "done" ? new Date() : null },
  });

  revalidateTaskViews();
}

export async function toggleTaskSprint(formData: FormData) {
  await verifySession();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const task = await prisma.task.findUnique({ where: { id }, select: { sprint: true } });
  if (!task) return;

  await prisma.task.update({ where: { id }, data: { sprint: !task.sprint } });
  revalidateTaskViews();
}

export async function deleteTask(formData: FormData) {
  await verifySession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.task.delete({ where: { id } });
  revalidateTaskViews();
}
