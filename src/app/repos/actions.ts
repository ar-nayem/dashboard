"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/session";
import { REPO_CATEGORIES, REPO_STATUSES, parseEnum, serializeList } from "@/lib/enums";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function createRepo(formData: FormData) {
  await verifySession();

  const name = String(formData.get("name") ?? "").trim();
  const githubUrl = String(formData.get("githubUrl") ?? "").trim();
  if (!name || !githubUrl) return;

  const base = slugify(name);
  if (!base) return;

  let slug = base;
  for (let n = 2; await prisma.repo.findUnique({ where: { slug } }); n++) {
    slug = `${base}-${n}`;
  }

  const last = await prisma.repo.findFirst({
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const tech = String(formData.get("tech") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  await prisma.repo.create({
    data: {
      name,
      slug,
      description: String(formData.get("description") ?? "").trim(),
      category: parseEnum(REPO_CATEGORIES, String(formData.get("category") ?? "")),
      status: parseEnum(REPO_STATUSES, String(formData.get("status") ?? "")),
      tech: serializeList(tech),
      githubUrl,
      liveUrl: String(formData.get("liveUrl") ?? "").trim() || null,
      pm2Name: String(formData.get("pm2Name") ?? "").trim() || null,
      public: formData.get("public") === "on",
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });

  revalidatePath("/repos");
}

export async function updateRepo(formData: FormData) {
  await verifySession();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const tech = String(formData.get("tech") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  await prisma.repo.update({
    where: { id },
    data: {
      name: String(formData.get("name") ?? "").trim(),
      description: String(formData.get("description") ?? "").trim(),
      category: parseEnum(REPO_CATEGORIES, String(formData.get("category") ?? "")),
      status: parseEnum(REPO_STATUSES, String(formData.get("status") ?? "")),
      tech: serializeList(tech),
      githubUrl: String(formData.get("githubUrl") ?? "").trim(),
      liveUrl: String(formData.get("liveUrl") ?? "").trim() || null,
      pm2Name: String(formData.get("pm2Name") ?? "").trim() || null,
      public: formData.get("public") === "on",
    },
  });

  revalidatePath("/repos");
  revalidatePath("/api/repos");
}

export async function deleteRepo(formData: FormData) {
  await verifySession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.repo.delete({ where: { id } });
  revalidatePath("/repos");
  revalidatePath("/api/repos");
}

export async function reorderRepo(formData: FormData) {
  await verifySession();

  const id = String(formData.get("id") ?? "");
  const direction = String(formData.get("direction") ?? "");
  if (!id || (direction !== "up" && direction !== "down")) return;

  const items = await prisma.repo.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, sortOrder: true },
  });

  const index = items.findIndex((item) => item.id === id);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapWith < 0 || swapWith >= items.length) return;

  await prisma.$transaction([
    prisma.repo.update({
      where: { id: items[index].id },
      data: { sortOrder: items[swapWith].sortOrder },
    }),
    prisma.repo.update({
      where: { id: items[swapWith].id },
      data: { sortOrder: items[index].sortOrder },
    }),
  ]);

  revalidatePath("/repos");
  revalidatePath("/api/repos");
}
