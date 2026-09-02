"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/session";
import { saveUploadedImage, deleteUploadedImage } from "@/lib/upload";
import { serializeList } from "@/lib/enums";

function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// Appends -2, -3, ... until the slug is free. `excludeId` lets an edit keep
// its own existing slug without colliding with itself.
async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const root = base || "work-item";
  let candidate = root;
  let n = 2;
  for (;;) {
    const clash = await prisma.workItem.findFirst({
      where: { slug: candidate, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    if (!clash) return candidate;
    candidate = `${root}-${n++}`;
  }
}

export async function createWorkItem(formData: FormData) {
  await verifySession();

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const slug = await uniqueSlug(slugify(title));
  const image = await saveUploadedImage(formData.get("file"));

  const last = await prisma.workItem.findFirst({
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  await prisma.workItem.create({
    data: {
      slug,
      title,
      role: String(formData.get("role") ?? "").trim(),
      description: String(formData.get("description") ?? "").trim(),
      tech: serializeList(String(formData.get("tech") ?? "").split(",")),
      image,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });

  revalidatePath("/work");
}

export async function updateWorkItem(formData: FormData) {
  await verifySession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const existing = await prisma.workItem.findUnique({ where: { id } });
  if (!existing) return;

  const title = String(formData.get("title") ?? "").trim() || existing.title;
  const slug = title === existing.title ? existing.slug : await uniqueSlug(slugify(title), id);

  const newImage = await saveUploadedImage(formData.get("file"));
  if (newImage) await deleteUploadedImage(existing.image);

  await prisma.workItem.update({
    where: { id },
    data: {
      title,
      slug,
      role: String(formData.get("role") ?? "").trim(),
      description: String(formData.get("description") ?? "").trim(),
      tech: serializeList(String(formData.get("tech") ?? "").split(",")),
      image: newImage ?? existing.image,
    },
  });

  revalidatePath("/work");
}

export async function deleteWorkItem(formData: FormData) {
  await verifySession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const item = await prisma.workItem.delete({ where: { id } }).catch(() => null);
  if (!item) return;

  await deleteUploadedImage(item.image);
  revalidatePath("/work");
}

export async function reorderWorkItem(formData: FormData) {
  await verifySession();

  const id = String(formData.get("id") ?? "");
  const direction = String(formData.get("direction") ?? "");
  if (!id || (direction !== "up" && direction !== "down")) return;

  const items = await prisma.workItem.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, sortOrder: true },
  });

  const index = items.findIndex((item) => item.id === id);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapWith < 0 || swapWith >= items.length) return;

  await prisma.$transaction([
    prisma.workItem.update({
      where: { id: items[index].id },
      data: { sortOrder: items[swapWith].sortOrder },
    }),
    prisma.workItem.update({
      where: { id: items[swapWith].id },
      data: { sortOrder: items[index].sortOrder },
    }),
  ]);

  revalidatePath("/work");
}
