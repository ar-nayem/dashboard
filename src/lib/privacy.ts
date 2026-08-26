import { cookies } from "next/headers";

const PRIVACY_COOKIE = "privacy";

// Privacy mode masks every money/metric value behind dots — the eye toggle in
// the sidebar. Off by default; it exists for screen-sharing and recording.
//
// The masking happens server-side in <Private>, so masked values are never
// sent to the browser at all. That means it also holds up against someone
// reading the page source, not just someone watching the screen.
export async function getPrivacyMode(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get(PRIVACY_COOKIE)?.value === "on";
}
