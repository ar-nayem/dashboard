import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Receives a LinkedIn post draft from the weekly cloud routine (see the
 * LinkedIn tab's own note, and the routine at claude.ai/code/routines).
 *
 * Deliberately narrow: this secret can only create a draft row. It cannot
 * read anything, cannot approve/post anything, and is unrelated to
 * CRON_SECRET or any other credential — a leaked LINKEDIN_DRAFT_SECRET is
 * a spam-drafts nuisance, not a real compromise. Posting to LinkedIn itself
 * never happens from here or from the routine — only interactively, with
 * explicit approval, from the LinkedIn tab.
 *
 * Expected body: { "body": "...", "sourceRepo": "salonbd" }
 */
function isAuthorized(request: Request): boolean {
  const expected = process.env.LINKEDIN_DRAFT_SECRET;
  if (!expected || expected.trim() === "") return false;

  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!provided) return false;

  const a = Buffer.from(provided);
  const b = Buffer.from(expected.trim());
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: { body?: unknown; sourceRepo?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const body = String(payload.body ?? "").trim();
  if (!body) {
    return NextResponse.json({ error: '"body" is required.' }, { status: 400 });
  }
  // A generous cap — LinkedIn's own limit is ~3000 chars — mostly to stop a
  // malformed run from writing something absurd.
  if (body.length > 3000) {
    return NextResponse.json({ error: "body too long (max 3000 chars)." }, { status: 413 });
  }

  const sourceRepo = payload.sourceRepo ? String(payload.sourceRepo).trim().slice(0, 200) : null;

  const post = await prisma.linkedInPost.create({ data: { body, sourceRepo } });

  return NextResponse.json({ ok: true, id: post.id });
}
