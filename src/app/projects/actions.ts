"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/session";
import { PROJECT_KINDS, PROJECT_STATUSES, parseEnum } from "@/lib/enums";

/** URL-safe slug from a project name, used as the detail-page segment. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function createProject(formData: FormData) {
  await verifySession();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const base = slugify(name);
  if (!base) return;

  // slug is unique — suffix until free, so two projects named similarly don't
  // collide and throw at write time.
  let slug = base;
  for (let n = 2; await prisma.project.findUnique({ where: { slug } }); n++) {
    slug = `${base}-${n}`;
  }

  const last = await prisma.project.findFirst({
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  await prisma.project.create({
    data: {
      name,
      slug,
      description: String(formData.get("description") ?? "").trim() || null,
      status: parseEnum(PROJECT_STATUSES, String(formData.get("status") ?? "")),
      kind: parseEnum(PROJECT_KINDS, String(formData.get("kind") ?? "")),
      url: String(formData.get("url") ?? "").trim() || null,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });

  revalidatePath("/projects");
}

/**
 * Sets the external identifiers the sync adapters use to find this project's
 * data. A blank field is stored as null, which is how an adapter knows to
 * skip this project entirely rather than guessing from its name.
 */
export async function updateProjectSources(formData: FormData) {
  await verifySession();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const field = (name: string) => String(formData.get(name) ?? "").trim() || null;

  await prisma.project.update({
    where: { id },
    data: {
      githubRepo: field("githubRepo"),
      gaPropertyId: field("gaPropertyId"),
      gscSiteUrl: field("gscSiteUrl"),
      appStoreAppId: field("appStoreAppId"),
      revenueCatId: field("revenueCatId"),
    },
  });

  revalidatePath("/projects", "layout");
}

export async function setProjectStatus(formData: FormData) {
  await verifySession();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const status = parseEnum(PROJECT_STATUSES, String(formData.get("status") ?? ""));
  await prisma.project.update({ where: { id }, data: { status } });

  revalidatePath("/projects");
}

export async function addProjectTodo(formData: FormData) {
  await verifySession();

  const projectId = String(formData.get("projectId") ?? "");
  const text = String(formData.get("text") ?? "").trim();
  if (!projectId || !text) return;

  const last = await prisma.projectTodo.findFirst({
    where: { projectId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  await prisma.projectTodo.create({
    data: { projectId, text, sortOrder: (last?.sortOrder ?? -1) + 1 },
  });

  revalidatePath("/projects", "layout");
}

export async function toggleProjectTodo(formData: FormData) {
  await verifySession();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const todo = await prisma.projectTodo.findUnique({ where: { id }, select: { done: true } });
  if (!todo) return;

  await prisma.projectTodo.update({ where: { id }, data: { done: !todo.done } });
  revalidatePath("/projects", "layout");
}

export async function deleteProjectTodo(formData: FormData) {
  await verifySession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.projectTodo.delete({ where: { id } });
  revalidatePath("/projects", "layout");
}

/**
 * Accepting a proposal turns it into a real todo and marks it accepted.
 *
 * The proposal row is kept rather than deleted, so the advisor history stays
 * auditable — you can see what was suggested and what you did with it.
 */
export async function acceptProposal(formData: FormData) {
  await verifySession();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const proposal = await prisma.advisorProposal.findUnique({ where: { id } });
  if (!proposal || proposal.status !== "pending") return;

  const last = await prisma.projectTodo.findFirst({
    where: { projectId: proposal.projectId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  await prisma.$transaction([
    prisma.projectTodo.create({
      data: {
        projectId: proposal.projectId,
        text: proposal.text,
        sortOrder: (last?.sortOrder ?? -1) + 1,
      },
    }),
    prisma.advisorProposal.update({ where: { id }, data: { status: "accepted" } }),
  ]);

  revalidatePath("/projects", "layout");
}

export async function dismissProposal(formData: FormData) {
  await verifySession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.advisorProposal.update({ where: { id }, data: { status: "dismissed" } });
  revalidatePath("/projects", "layout");
}

export async function addProjectNote(formData: FormData) {
  await verifySession();

  const projectId = String(formData.get("projectId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!projectId || !body) return;

  await prisma.projectNote.create({ data: { projectId, body } });
  revalidatePath("/projects", "layout");
}

export async function deleteProjectNote(formData: FormData) {
  await verifySession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.projectNote.delete({ where: { id } });
  revalidatePath("/projects", "layout");
}
