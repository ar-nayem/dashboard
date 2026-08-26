"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/session";
import { ARTICLE_STAGES, parseEnum } from "@/lib/enums";

/** Word count derived from the body, so it can never disagree with the text. */
function countWords(body: string): number {
  const trimmed = body.trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
}

export async function createArticle(formData: FormData) {
  await verifySession();

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const body = String(formData.get("body") ?? "");
  const stage = parseEnum(ARTICLE_STAGES, String(formData.get("stage") ?? ""));

  const last = await prisma.article.findFirst({
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  await prisma.article.create({
    data: {
      title,
      stage,
      platform: String(formData.get("platform") ?? "").trim() || null,
      body: body || null,
      wordCount: countWords(body),
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });

  revalidatePath("/written");
}

export async function setArticleStage(formData: FormData) {
  await verifySession();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const stage = parseEnum(ARTICLE_STAGES, String(formData.get("stage") ?? ""));
  await prisma.article.update({
    where: { id },
    data: {
      stage,
      // Moving to published stamps the date; moving back out clears it, so a
      // draft never keeps a stale publish date.
      publishDate: stage === "published" ? new Date() : null,
    },
  });

  revalidatePath("/written");
}

export async function deleteArticle(formData: FormData) {
  await verifySession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.article.delete({ where: { id } });
  revalidatePath("/written");
}
