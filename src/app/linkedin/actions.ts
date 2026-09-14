"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/session";

export async function createDraft(formData: FormData) {
  await verifySession();

  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;

  await prisma.linkedInPost.create({
    data: {
      body,
      sourceRepo: String(formData.get("sourceRepo") ?? "").trim() || null,
    },
  });

  revalidatePath("/linkedin");
}

export async function updateDraft(formData: FormData) {
  await verifySession();

  const id = String(formData.get("id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!id || !body) return;

  await prisma.linkedInPost.update({
    where: { id },
    data: { body, sourceRepo: String(formData.get("sourceRepo") ?? "").trim() || null },
  });

  revalidatePath("/linkedin");
}

export async function approveDraft(formData: FormData) {
  await verifySession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.linkedInPost.update({ where: { id }, data: { status: "approved" } });
  revalidatePath("/linkedin");
}

// Called once Claude has actually clicked Post in the browser — records the
// outcome, never triggers the post itself. Posting always happens
// interactively; this just closes the loop on a draft that already went out.
export async function markPosted(formData: FormData) {
  await verifySession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.linkedInPost.update({
    where: { id },
    data: {
      status: "posted",
      postedAt: new Date(),
      postUrl: String(formData.get("postUrl") ?? "").trim() || null,
    },
  });
  revalidatePath("/linkedin");
}

export async function skipDraft(formData: FormData) {
  await verifySession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.linkedInPost.update({ where: { id }, data: { status: "skipped" } });
  revalidatePath("/linkedin");
}

export async function deleteDraft(formData: FormData) {
  await verifySession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.linkedInPost.delete({ where: { id } });
  revalidatePath("/linkedin");
}
