"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/session";
import { HEALTH_METRIC_TYPES, HEALTH_METRIC_UNITS, parseEnum } from "@/lib/enums";
import { toUtcDay } from "@/lib/data-habits";

export async function logHealthMetric(formData: FormData) {
  await verifySession();

  const type = parseEnum(HEALTH_METRIC_TYPES, String(formData.get("type") ?? ""));
  const value = Number(formData.get("value"));
  if (!Number.isFinite(value)) return;

  const dateRaw = String(formData.get("date") ?? "");
  const parsed = dateRaw ? new Date(dateRaw) : new Date();
  if (Number.isNaN(parsed.getTime())) return;
  const date = toUtcDay(parsed);

  // The form only offers a unit choice for weight (kg/lb); everything else has
  // one sensible unit, so fall back to the canonical one.
  const submittedUnit = String(formData.get("unit") ?? "").trim();
  const unit = submittedUnit || HEALTH_METRIC_UNITS[type];

  // Upsert on [type, date, source]: re-logging the same day corrects the
  // reading rather than creating a duplicate that would skew the average.
  await prisma.healthMetric.upsert({
    where: { type_date_source: { type, date, source: "manual" } },
    create: { type, date, value, unit, source: "manual" },
    update: { value, unit },
  });

  revalidatePath("/health");
  revalidatePath("/");
}

/**
 * Deletes one reading.
 *
 * Needed because a fat-fingered weight (720 instead of 72) drags the 30-day
 * average and the chart's y-axis so far that every other reading flattens
 * into a line — and until now there was no way to take it back.
 */
export async function deleteHealthMetric(formData: FormData) {
  await verifySession();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.healthMetric.delete({ where: { id } });

  revalidatePath("/health");
  revalidatePath("/");
}
