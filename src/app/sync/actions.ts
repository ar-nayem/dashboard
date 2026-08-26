"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/session";
import { runAll, runOne } from "@/lib/integrations";

function revalidateSync() {
  revalidatePath("/sync");
  revalidatePath("/", "layout");
}

export async function syncIntegration(formData: FormData) {
  await verifySession();

  const key = String(formData.get("key") ?? "");
  if (!key) return;

  await runOne(key, "manual");
  revalidateSync();
}

export async function syncAll() {
  await verifySession();
  await runAll("manual");
  revalidateSync();
}
