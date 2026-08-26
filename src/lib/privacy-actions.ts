"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

const PRIVACY_COOKIE = "privacy";

export async function togglePrivacy(formData: FormData) {
  const next = String(formData.get("privacy") ?? "") === "on" ? "on" : "off";
  const cookieStore = await cookies();
  cookieStore.set(PRIVACY_COOKIE, next, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  // Every page reads privacy mode, so the whole layout tree must re-render.
  revalidatePath("/", "layout");
}
