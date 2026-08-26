"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/session";
import { IDEA_CATEGORIES, IDEA_STATUSES, parseEnum } from "@/lib/enums";

export async function createIdea(formData: FormData) {
  await verifySession();

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const category = parseEnum(IDEA_CATEGORIES, String(formData.get("category") ?? ""));

  const last = await prisma.idea.findFirst({
    where: { category },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  await prisma.idea.create({
    data: {
      title,
      description: String(formData.get("description") ?? "").trim() || null,
      category,
      areaId: String(formData.get("areaId") ?? "") || null,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });

  revalidatePath("/ideas");
}

export async function setIdeaStatus(formData: FormData) {
  await verifySession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const status = parseEnum(IDEA_STATUSES, String(formData.get("status") ?? ""));
  await prisma.idea.update({ where: { id }, data: { status } });
  revalidatePath("/ideas");
}

export async function deleteIdea(formData: FormData) {
  await verifySession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.idea.delete({ where: { id } });
  revalidatePath("/ideas");
}
