import type { NextConfig } from "next";

/**
 * Served at arnayem.top/dashboard — a path under the existing root site
 * rather than its own subdomain, so basePath makes every Link, redirect, and
 * /_next asset URL carry the prefix automatically.
 *
 * It is read from the environment so a local `npm run dev` still serves from
 * "/" (BASE_PATH unset) while production sets BASE_PATH=/dashboard. Hard-coding
 * it would mean every local URL needed the prefix too.
 */
const basePath = process.env.BASE_PATH ?? "";

const nextConfig: NextConfig = {
  ...(basePath ? { basePath } : {}),

  // better-sqlite3 is a native module — it must stay external to the server
  // bundle or Next tries to bundle the .node binary and the build fails.
  serverExternalPackages: ["better-sqlite3", "@prisma/adapter-better-sqlite3"],
};

export default nextConfig;
