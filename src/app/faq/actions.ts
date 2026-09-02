"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/session";

export async function createFaq(formData: FormData) {
  await verifySession();

  const question = String(formData.get("question") ?? "").trim();
  if (!question) return;

  const last = await prisma.faq.findFirst({
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  await prisma.faq.create({
    data: {
      question,
      answer: String(formData.get("answer") ?? "").trim(),
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });

  revalidatePath("/faq");
}

export async function updateFaq(formData: FormData) {
  await verifySession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.faq.update({
    where: { id },
    data: {
      question: String(formData.get("question") ?? "").trim(),
      answer: String(formData.get("answer") ?? "").trim(),
    },
  });
  revalidatePath("/faq");
}

export async function deleteFaq(formData: FormData) {
  await verifySession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.faq.delete({ where: { id } }).catch(() => null);
  revalidatePath("/faq");
}

export async function reorderFaq(formData: FormData) {
  await verifySession();

  const id = String(formData.get("id") ?? "");
  const direction = String(formData.get("direction") ?? "");
  if (!id || (direction !== "up" && direction !== "down")) return;

  const items = await prisma.faq.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, sortOrder: true },
  });

  const index = items.findIndex((item) => item.id === id);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapWith < 0 || swapWith >= items.length) return;

  await prisma.$transaction([
    prisma.faq.update({
      where: { id: items[index].id },
      data: { sortOrder: items[swapWith].sortOrder },
    }),
    prisma.faq.update({
      where: { id: items[swapWith].id },
      data: { sortOrder: items[index].sortOrder },
    }),
  ]);

  revalidatePath("/faq");
}
