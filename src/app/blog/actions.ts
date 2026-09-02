"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/session";
import { saveUploadedImage, deleteUploadedImage } from "@/lib/upload";

function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const root = base || "post";
  let candidate = root;
  let n = 2;
  for (;;) {
    const clash = await prisma.blogPost.findFirst({
      where: { slug: candidate, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    if (!clash) return candidate;
    candidate = `${root}-${n++}`;
  }
}

export async function createBlogPost(formData: FormData) {
  await verifySession();

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const slug = await uniqueSlug(slugify(title));
  const coverImage = await saveUploadedImage(formData.get("file"));

  await prisma.blogPost.create({
    data: {
      slug,
      title,
      excerpt: String(formData.get("excerpt") ?? "").trim() || null,
      body: String(formData.get("body") ?? ""),
      coverImage,
      published: formData.get("published") === "on",
    },
  });

  revalidatePath("/blog");
  redirect("/blog");
}

export async function updateBlogPost(formData: FormData) {
  await verifySession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const existing = await prisma.blogPost.findUnique({ where: { id } });
  if (!existing) return;

  const title = String(formData.get("title") ?? "").trim() || existing.title;
  const slug = title === existing.title ? existing.slug : await uniqueSlug(slugify(title), id);

  const newCover = await saveUploadedImage(formData.get("file"));
  if (newCover) await deleteUploadedImage(existing.coverImage);

  await prisma.blogPost.update({
    where: { id },
    data: {
      title,
      slug,
      excerpt: String(formData.get("excerpt") ?? "").trim() || null,
      body: String(formData.get("body") ?? ""),
      coverImage: newCover ?? existing.coverImage,
      published: formData.get("published") === "on",
    },
  });

  revalidatePath("/blog");
  redirect("/blog");
}

export async function deleteBlogPost(formData: FormData) {
  await verifySession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const post = await prisma.blogPost.delete({ where: { id } }).catch(() => null);
  if (!post) return;

  await deleteUploadedImage(post.coverImage);
  revalidatePath("/blog");
}
