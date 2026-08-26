"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export async function setTheme(formData: FormData) {
  const theme = String(formData.get("theme") ?? "") === "light" ? "light" : "dark";
  const cookieStore = await cookies();
  cookieStore.set("theme", theme, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  // The theme class lives on <html> in the root layout, so the whole layout
  // tree has to re-render, not just the current page.
  revalidatePath("/", "layout");
}
