import { differenceInHours } from "date-fns";
import { prisma } from "@/lib/prisma";
import { ADAPTERS, getAdapter } from "./registry";
import { errorMessage, type Adapter, type CredentialSpec } from "./types";

/** Which of an adapter's required env vars are unset or blank right now. */
export function missingCredentials(adapter: Adapter): CredentialSpec[] {
  return adapter.credentials.filter((spec) => {
    if (spec.required === false) return false;
    const value = process.env[spec.env];
    return !value || value.trim() === "";
  });
}

export function isConfigured(adapter: Adapter): boolean {
  return missingCredentials(adapter).length === 0;
}

/** An adapter that can actually be run right now. */
export function isRunnable(adapter: Adapter): boolean {
  return adapter.implemented && !adapter.pushOnly && isConfigured(adapter);
}

/**
 * Derives display status from the stored row rather than trusting the stored
 * `status` column alone — a row marked "ok" three days ago is stale now, and
 * nothing would have written that transition.
 */
export function deriveStatus(
  stored: string,
  lastSyncedAt: Date | null,
  staleAfterHours: number,
): "ok" | "stale" | "error" | "never" {
  if (stored === "error") return "error";
  if (!lastSyncedAt) return "never";
  return differenceInHours(new Date(), lastSyncedAt) >= staleAfterHours ? "stale" : "ok";
}

export type RunOutcome = {
  key: string;
  ok: boolean;
  recordsWritten: number;
  detail?: string;
  error?: string;
};

/**
 * Runs one adapter, recording a SyncRun row whatever happens.
 *
 * The run row is written even on failure, and especially on an unexpected
 * throw — otherwise a crashing adapter would leave the Integration frozen at
 * its last success and look healthy.
 */
export async function runOne(key: string, trigger: "manual" | "cron"): Promise<RunOutcome> {
  const adapter = getAdapter(key);
  if (!adapter) return { key, ok: false, recordsWritten: 0, error: "Unknown integration." };

  const integration = await prisma.integration.findUnique({ where: { key }, select: { id: true } });
  if (!integration) {
    return { key, ok: false, recordsWritten: 0, error: "Integration row missing — run db:reset." };
  }

  const missing = missingCredentials(adapter);
  if (missing.length > 0) {
    const error = `Missing in .env: ${missing.map((spec) => spec.env).join(", ")}`;
    await prisma.integration.update({ where: { key }, data: { status: "error", lastError: error } });
    return { key, ok: false, recordsWritten: 0, error };
  }

  const run = await prisma.syncRun.create({
    data: { integrationId: integration.id, trigger },
  });

  try {
    const result = await adapter.run();

    await prisma.$transaction([
      prisma.syncRun.update({
        where: { id: run.id },
        data: {
          finishedAt: new Date(),
          ok: result.ok,
          recordsWritten: result.ok ? result.recordsWritten : 0,
          detail: result.ok ? (result.detail ?? null) : null,
          error: result.ok ? null : result.error,
        },
      }),
      prisma.integration.update({
        where: { key },
        data: result.ok
          ? { status: "ok", lastSyncedAt: new Date(), lastError: null }
          : { status: "error", lastError: result.error },
      }),
    ]);

    return result.ok
      ? { key, ok: true, recordsWritten: result.recordsWritten, detail: result.detail }
      : { key, ok: false, recordsWritten: 0, error: result.error };
  } catch (error) {
    const message = errorMessage(error);

    await prisma.$transaction([
      prisma.syncRun.update({
        where: { id: run.id },
        data: { finishedAt: new Date(), ok: false, error: message },
      }),
      prisma.integration.update({
        where: { key },
        data: { status: "error", lastError: message },
      }),
    ]);

    return { key, ok: false, recordsWritten: 0, error: message };
  }
}

/**
 * Runs every runnable adapter in sequence.
 *
 * Sequential rather than parallel on purpose: these are rate-limited third
 * party APIs, and a personal dashboard has no deadline worth risking a 429
 * for.
 */
export async function runAll(trigger: "manual" | "cron"): Promise<RunOutcome[]> {
  const outcomes: RunOutcome[] = [];

  for (const adapter of ADAPTERS) {
    if (!isRunnable(adapter)) continue;
    outcomes.push(await runOne(adapter.key, trigger));
  }

  return outcomes;
}
