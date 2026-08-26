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

  // Upsert on [type, date, source]: re-logging the same day corrects the
  // reading rather than creating a duplicate that would skew the average.
  await prisma.healthMetric.upsert({
    where: { type_date_source: { type, date, source: "manual" } },
    create: { type, date, value, unit: HEALTH_METRIC_UNITS[type], source: "manual" },
    update: { value },
  });

  revalidatePath("/health");
}
