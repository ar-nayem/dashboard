import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runAll } from "@/lib/integrations";

export const dynamic = "force-dynamic";
// Adapters walk paged APIs; the default serverless timeout is too short.
export const maxDuration = 300;

/**
 * Runs every connected adapter. Intended for a cron job:
 *
 *   curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://your-host/api/cron
 *
 * Authenticated with a shared secret rather than the session cookie, because
 * cron has no browser. The secret is compared in constant time so the
 * endpoint can't be brute-forced by timing.
 */
function isAuthorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  // No secret configured means the endpoint stays shut, rather than open.
  if (!expected || expected.trim() === "") return false;

  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!provided) return false;

  const a = Buffer.from(provided);
  const b = Buffer.from(expected.trim());
  // timingSafeEqual throws on length mismatch, so check that first — the
  // length of a secret is not itself sensitive.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const outcomes = await runAll("cron");

  const failed = outcomes.filter((outcome) => !outcome.ok);

  return NextResponse.json(
    {
      ran: outcomes.length,
      succeeded: outcomes.length - failed.length,
      failed: failed.length,
      durationMs: Date.now() - startedAt,
      outcomes,
    },
    // 207 when some adapters failed, so a monitoring cron can alert on it
    // without parsing the body.
    { status: failed.length > 0 ? 207 : 200 },
  );
}
