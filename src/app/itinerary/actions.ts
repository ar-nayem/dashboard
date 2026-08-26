"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/session";

export async function createTrip(formData: FormData) {
  await verifySession();

  const city = String(formData.get("city") ?? "").trim();
  const country = String(formData.get("country") ?? "").trim();
  const start = new Date(String(formData.get("startDate") ?? ""));
  const end = new Date(String(formData.get("endDate") ?? ""));

  if (!city || !country) return;
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;
  // A trip that ends before it starts would render as a negative-width bar
  // and break the "currently here" lookup.
  if (end < start) return;

  await prisma.trip.create({
    data: {
      city,
      country,
      flag: String(formData.get("flag") ?? "").trim() || null,
      startDate: start,
      endDate: end,
      notes: String(formData.get("notes") ?? "").trim() || null,
    },
  });

  revalidatePath("/itinerary");
  revalidatePath("/");
}

export async function deleteTrip(formData: FormData) {
  await verifySession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.trip.delete({ where: { id } });
  revalidatePath("/itinerary");
  revalidatePath("/");
}
