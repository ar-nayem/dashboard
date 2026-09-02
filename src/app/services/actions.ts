"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/session";
import { SERVICE_ICONS, isServiceIcon } from "@/lib/service-icons";

export async function createService(formData: FormData) {
  await verifySession();

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const rawIcon = String(formData.get("icon") ?? "");
  const icon = isServiceIcon(rawIcon) ? rawIcon : SERVICE_ICONS[0];

  const last = await prisma.service.findFirst({
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  await prisma.service.create({
    data: {
      icon,
      title,
      description: String(formData.get("description") ?? "").trim(),
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });

  revalidatePath("/services");
}

export async function updateService(formData: FormData) {
  await verifySession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const rawIcon = String(formData.get("icon") ?? "");
  const icon = isServiceIcon(rawIcon) ? rawIcon : SERVICE_ICONS[0];

  await prisma.service.update({
    where: { id },
    data: {
      icon,
      title: String(formData.get("title") ?? "").trim(),
      description: String(formData.get("description") ?? "").trim(),
    },
  });
  revalidatePath("/services");
}

export async function deleteService(formData: FormData) {
  await verifySession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.service.delete({ where: { id } }).catch(() => null);
  revalidatePath("/services");
}

export async function reorderService(formData: FormData) {
  await verifySession();

  const id = String(formData.get("id") ?? "");
  const direction = String(formData.get("direction") ?? "");
  if (!id || (direction !== "up" && direction !== "down")) return;

  const items = await prisma.service.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, sortOrder: true },
  });

  const index = items.findIndex((item) => item.id === id);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapWith < 0 || swapWith >= items.length) return;

  await prisma.$transaction([
    prisma.service.update({
      where: { id: items[index].id },
      data: { sortOrder: items[swapWith].sortOrder },
    }),
    prisma.service.update({
      where: { id: items[swapWith].id },
      data: { sortOrder: items[index].sortOrder },
    }),
  ]);

  revalidatePath("/services");
}
