// Only Next-aware helpers (Link, Image, its own emitted asset URLs) get
// BASE_PATH auto-prepended — a hand-built <img src> or a JSON API response
// does not. Read server-side only: BASE_PATH isn't NEXT_PUBLIC_-prefixed, so
// this only resolves correctly from Server Components/Actions/route handlers.
export function withBasePath(path: string): string {
  const base = process.env.BASE_PATH ?? "";
  return path.startsWith("/") ? `${base}${path}` : `${base}/${path}`;
}
