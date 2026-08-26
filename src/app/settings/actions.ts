"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/session";
import { DOCUMENT_KINDS, parseEnum } from "@/lib/enums";

// Reference data touches nearly every page, so mutations here revalidate the
// whole layout rather than one route.
function revalidateAll() {
  revalidatePath("/", "layout");
}

// --- Areas -----------------------------------------------------------------

export async function createArea(formData: FormData) {
  await verifySession();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const last = await prisma.area.findFirst({
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  await prisma.area.create({
    data: {
      name,
      color: String(formData.get("color") ?? "#4f8cff"),
      icon: String(formData.get("icon") ?? "").trim(),
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });

  revalidateAll();
}

export async function deleteArea(formData: FormData) {
  await verifySession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  // Every relation is onDelete: SetNull, so this un-tags rather than deleting
  // the tasks, goals, and habits that referenced it.
  await prisma.area.delete({ where: { id } });
  revalidateAll();
}

// --- Clients ---------------------------------------------------------------

export async function createClient(formData: FormData) {
  await verifySession();

  const name = String(formData.get("name") ?? "").trim();
  const shortCode = String(formData.get("shortCode") ?? "").trim().toUpperCase();
  if (!name || !shortCode) return;

  await prisma.client.create({
    data: { name, shortCode, color: String(formData.get("color") ?? "#4f8cff") },
  });

  revalidateAll();
}

export async function deleteClient(formData: FormData) {
  await verifySession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.client.delete({ where: { id } });
  revalidateAll();
}

// --- Documents -------------------------------------------------------------

export async function createDocument(formData: FormData) {
  await verifySession();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const expiryRaw = String(formData.get("expiresAt") ?? "");
  const expiresAt = expiryRaw ? new Date(expiryRaw) : null;

  await prisma.document.create({
    data: {
      name,
      kind: parseEnum(DOCUMENT_KINDS, String(formData.get("kind") ?? "")),
      expiresAt: expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null,
      notes: String(formData.get("notes") ?? "").trim() || null,
    },
  });

  revalidateAll();
}

export async function deleteDocument(formData: FormData) {
  await verifySession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.document.delete({ where: { id } });
  revalidateAll();
}

// --- Birthdays -------------------------------------------------------------

export async function createBirthday(formData: FormData) {
  await verifySession();

  const name = String(formData.get("name") ?? "").trim();
  const month = Number(formData.get("month"));
  const day = Number(formData.get("day"));
  if (!name || !Number.isFinite(month) || !Number.isFinite(day)) return;
  // Guard the ranges: an out-of-range month would make the "next occurrence"
  // maths silently roll into the wrong year.
  if (month < 1 || month > 12 || day < 1 || day > 31) return;

  const yearRaw = String(formData.get("birthYear") ?? "").trim();
  const birthYear = yearRaw ? Number(yearRaw) : null;

  await prisma.birthday.create({
    data: {
      name,
      month: Math.round(month),
      day: Math.round(day),
      birthYear: birthYear && Number.isFinite(birthYear) ? Math.round(birthYear) : null,
    },
  });

  revalidateAll();
}

export async function deleteBirthday(formData: FormData) {
  await verifySession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.birthday.delete({ where: { id } });
  revalidateAll();
}

// --- Ship log --------------------------------------------------------------

export async function createShipLog(formData: FormData) {
  await verifySession();

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const dateRaw = String(formData.get("shippedAt") ?? "");
  const shippedAt = dateRaw ? new Date(dateRaw) : new Date();

  await prisma.shipLog.create({
    data: {
      title,
      shippedAt: Number.isNaN(shippedAt.getTime()) ? new Date() : shippedAt,
    },
  });

  revalidateAll();
}

export async function deleteShipLog(formData: FormData) {
  await verifySession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.shipLog.delete({ where: { id } });
  revalidateAll();
}

// --- Exercises -------------------------------------------------------------

export async function createExercise(formData: FormData) {
  await verifySession();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  // name is unique — a duplicate would throw, so skip silently instead.
  const existing = await prisma.exercise.findUnique({ where: { name }, select: { id: true } });
  if (existing) return;

  await prisma.exercise.create({
    data: {
      name,
      equipment: String(formData.get("equipment") ?? "other"),
      muscleGroup: String(formData.get("muscleGroup") ?? "").trim() || null,
    },
  });

  revalidateAll();
}

export async function deleteExercise(formData: FormData) {
  await verifySession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  // Cascades to WorkoutSet — deleting an exercise erases its logged history.
  await prisma.exercise.delete({ where: { id } });
  revalidateAll();
}
