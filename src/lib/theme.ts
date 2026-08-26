import { cookies } from "next/headers";

export type Theme = "light" | "dark";

const THEME_COOKIE = "theme";

// No cookie means dark — dark is the app's designed look, light is opt-in.
export async function getTheme(): Promise<Theme> {
  const cookieStore = await cookies();
  return cookieStore.get(THEME_COOKIE)?.value === "light" ? "light" : "dark";
}
