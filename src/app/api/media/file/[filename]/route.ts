import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

// Uploaded files live OUTSIDE public/ and are served through this route
// rather than Next's static public-folder handler: verified live that a
// file dropped into public/ after the server process started 404s until
// pm2 restarts — Next resolves public assets against a listing taken at
// process boot, not a live directory scan. A route handler reads the
// filesystem fresh on every request, so a just-uploaded file is servable
// immediately, no restart required.
const UPLOAD_DIR = path.join(process.cwd(), "uploads", "media");

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
};

// Matches exactly what createMediaItem (../../../media/actions.ts) names a
// file as — randomUUID() plus one of the allowed extensions. Anything else
// (including "..", "/") is rejected before it ever reaches path.join.
const FILENAME_RE = /^[a-f0-9-]+\.(jpg|png|webp|gif|svg)$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  if (!FILENAME_RE.test(filename)) {
    return new NextResponse(null, { status: 404 });
  }

  let data: Buffer;
  try {
    data = await readFile(path.join(UPLOAD_DIR, filename));
  } catch {
    return new NextResponse(null, { status: 404 });
  }

  const ext = filename.split(".").pop()!.toLowerCase();
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": MIME[ext] ?? "application/octet-stream",
      // filenames are random and content-addressed in practice (never
      // reused), so this is safe to cache forever
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
