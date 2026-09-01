"use server";

import { revalidatePath } from "next/cache";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/session";

// Outside public/ on purpose — see the route handler at
// src/app/api/media/file/[filename]/route.ts for why.
const UPLOAD_DIR = path.join(process.cwd(), "uploads", "media");
const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

export async function createMediaItem(formData: FormData) {
  await verifySession();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_BYTES) return;
  const ext = ALLOWED_TYPES[file.type];
  if (!ext) return;

  await mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `${randomUUID()}.${ext}`;
  await writeFile(path.join(UPLOAD_DIR, filename), Buffer.from(await file.arrayBuffer()));

  const last = await prisma.mediaItem.findFirst({
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  await prisma.mediaItem.create({
    data: {
      url: `/api/media/file/${filename}`,
      title: String(formData.get("title") ?? "").trim() || null,
      link: String(formData.get("link") ?? "").trim() || null,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });

  revalidatePath("/media");
}

export async function updateMediaItem(formData: FormData) {
  await verifySession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.mediaItem.update({
    where: { id },
    data: {
      title: String(formData.get("title") ?? "").trim() || null,
      link: String(formData.get("link") ?? "").trim() || null,
    },
  });
  revalidatePath("/media");
}

export async function deleteMediaItem(formData: FormData) {
  await verifySession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const item = await prisma.mediaItem.delete({ where: { id } }).catch(() => null);
  if (!item) return;

  // best-effort: an orphaned file on disk is harmless, a crashed delete isn't
  const filename = item.url.split("/").pop();
  if (filename) await unlink(path.join(UPLOAD_DIR, filename)).catch(() => {});

  revalidatePath("/media");
}

export async function reorderMediaItem(formData: FormData) {
  await verifySession();

  const id = String(formData.get("id") ?? "");
  const direction = String(formData.get("direction") ?? "");
  if (!id || (direction !== "up" && direction !== "down")) return;

  const items = await prisma.mediaItem.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, sortOrder: true },
  });

  const index = items.findIndex((item) => item.id === id);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapWith < 0 || swapWith >= items.length) return;

  // Swap the two sortOrder values in one transaction so a failure can't
  // leave both rows holding the same order.
  await prisma.$transaction([
    prisma.mediaItem.update({
      where: { id: items[index].id },
      data: { sortOrder: items[swapWith].sortOrder },
    }),
    prisma.mediaItem.update({
      where: { id: items[swapWith].id },
      data: { sortOrder: items[index].sortOrder },
    }),
  ]);

  revalidatePath("/media");
}
