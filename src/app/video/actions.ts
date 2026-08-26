"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/session";
import {
  PLATFORMS,
  PRIORITIES,
  VIDEO_FORMATS,
  VIDEO_STAGES,
  parseEnum,
  serializeList,
} from "@/lib/enums";

export async function createVideo(formData: FormData) {
  await verifySession();

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  // Checkbox group — getAll returns one entry per checked platform. Filtered
  // against the allow-list so a crafted POST can't write arbitrary strings.
  const platforms = formData
    .getAll("platforms")
    .map(String)
    .filter((value): value is (typeof PLATFORMS)[number] =>
      (PLATFORMS as readonly string[]).includes(value),
    );

  const workOnRaw = String(formData.get("workOnDate") ?? "");
  const postRaw = String(formData.get("postDate") ?? "");
  const workOn = workOnRaw ? new Date(workOnRaw) : null;
  const post = postRaw ? new Date(postRaw) : null;

  const last = await prisma.video.findFirst({
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  await prisma.video.create({
    data: {
      title,
      stage: parseEnum(VIDEO_STAGES, String(formData.get("stage") ?? "")),
      format: parseEnum(VIDEO_FORMATS, String(formData.get("format") ?? "")),
      priority: parseEnum(PRIORITIES, String(formData.get("priority") ?? "")),
      platforms: serializeList(platforms.length > 0 ? platforms : ["youtube"]),
      workOnDate: workOn && !Number.isNaN(workOn.getTime()) ? workOn : null,
      postDate: post && !Number.isNaN(post.getTime()) ? post : null,
      script: String(formData.get("script") ?? "").trim() || null,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });

  revalidatePath("/video");
}

export async function setVideoStage(formData: FormData) {
  await verifySession();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const stage = parseEnum(VIDEO_STAGES, String(formData.get("stage") ?? ""));
  const video = await prisma.video.findUnique({ where: { id }, select: { postDate: true } });

  await prisma.video.update({
    where: { id },
    data: {
      stage,
      // Stamp a post date on first publish, but never overwrite one that is
      // already set — re-publishing shouldn't rewrite history.
      postDate: stage === "published" ? (video?.postDate ?? new Date()) : video?.postDate,
    },
  });

  revalidatePath("/video");
}

export async function deleteVideo(formData: FormData) {
  await verifySession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.video.delete({ where: { id } });
  revalidatePath("/video");
}

export async function toggleVideoSubtask(formData: FormData) {
  await verifySession();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const subtask = await prisma.videoSubtask.findUnique({ where: { id }, select: { done: true } });
  if (!subtask) return;

  await prisma.videoSubtask.update({ where: { id }, data: { done: !subtask.done } });
  revalidatePath("/video");
}

export async function addVideoSubtask(formData: FormData) {
  await verifySession();

  const videoId = String(formData.get("videoId") ?? "");
  const text = String(formData.get("text") ?? "").trim();
  if (!videoId || !text) return;

  const last = await prisma.videoSubtask.findFirst({
    where: { videoId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  await prisma.videoSubtask.create({
    data: { videoId, text, sortOrder: (last?.sortOrder ?? -1) + 1 },
  });

  revalidatePath("/video");
}
