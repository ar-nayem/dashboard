import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { HEALTH_METRIC_TYPES, HEALTH_METRIC_UNITS, type HealthMetricType } from "@/lib/enums";

export const dynamic = "force-dynamic";

/**
 * Receives Health readings pushed from an iOS Shortcut.
 *
 * Apple exposes no server API for Health data, so this is the only way to get
 * it in automatically: the phone posts here on a schedule.
 *
 * Expected body:
 *   { "readings": [ { "type": "weight", "value": 74.2, "date": "2026-08-25" } ] }
 *
 * `date` is optional and defaults to today. Unknown metric types are skipped
 * and counted, rather than failing the whole batch — a Shortcut sending one
 * bad field should still deliver the other readings.
 */

type IncomingReading = {
  type?: unknown;
  value?: unknown;
  date?: unknown;
  unit?: unknown;
};

function isAuthorized(request: Request): boolean {
  const expected = process.env.HEALTH_WEBHOOK_SECRET;
  if (!expected || expected.trim() === "") return false;

  const provided = request.headers.get("x-webhook-secret") ?? "";
  if (!provided) return false;

  const a = Buffer.from(provided);
  const b = Buffer.from(expected.trim());
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function utcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { readings?: IncomingReading[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const readings = Array.isArray(body.readings) ? body.readings : null;
  if (!readings) {
    return NextResponse.json(
      { error: 'Expected { "readings": [ … ] }.' },
      { status: 400 },
    );
  }

  // A runaway Shortcut loop shouldn't be able to post a million rows.
  if (readings.length > 500) {
    return NextResponse.json({ error: "At most 500 readings per request." }, { status: 413 });
  }

  let written = 0;
  const skipped: string[] = [];

  for (const reading of readings) {
    const type = String(reading.type ?? "");
    if (!(HEALTH_METRIC_TYPES as readonly string[]).includes(type)) {
      skipped.push(`unknown type "${type}"`);
      continue;
    }

    const value = Number(reading.value);
    if (!Number.isFinite(value)) {
      skipped.push(`non-numeric value for "${type}"`);
      continue;
    }

    const parsed = reading.date ? new Date(String(reading.date)) : new Date();
    if (Number.isNaN(parsed.getTime())) {
      skipped.push(`bad date for "${type}"`);
      continue;
    }

    const metricType = type as HealthMetricType;
    const date = utcDay(parsed);
    const unit = reading.unit ? String(reading.unit) : HEALTH_METRIC_UNITS[metricType];

    // Upsert on [type, date, source]: re-sending a day corrects the reading
    // instead of adding a duplicate that would skew the averages.
    await prisma.healthMetric.upsert({
      where: { type_date_source: { type: metricType, date, source: "apple_health" } },
      create: { type: metricType, date, value, unit, source: "apple_health" },
      update: { value, unit },
    });
    written++;
  }

  // Record the push against the integration so the Sync page reflects it.
  await prisma.integration.updateMany({
    where: { key: "apple_health" },
    data: {
      status: written > 0 ? "ok" : "error",
      lastSyncedAt: written > 0 ? new Date() : undefined,
      lastError: written > 0 ? null : `No valid readings. ${skipped.slice(0, 3).join("; ")}`,
    },
  });

  return NextResponse.json({ written, skipped: skipped.length, details: skipped.slice(0, 10) });
}
