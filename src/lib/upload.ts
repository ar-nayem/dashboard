import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

// Shared by every feature that lets the owner upload an image (Media,
// Work, Blog covers). Outside public/ on purpose — see the route handler
// at src/app/api/media/file/[filename]/route.ts, which is what actually
// serves these back out, for why.
const UPLOAD_DIR = path.join(process.cwd(), "uploads", "media");
const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

// Returns the stored file's public URL (server-relative, BASE_PATH not yet
// applied — callers use withBasePath()), or null for an empty field / a
// disallowed type. Never throws on a bad upload — callers treat null as
// "no new file was provided" rather than failing the whole mutation.
export async function saveUploadedImage(file: FormDataEntryValue | null): Promise<string | null> {
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_BYTES) return null;
  const ext = ALLOWED_TYPES[file.type];
  if (!ext) return null;

  await mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `${randomUUID()}.${ext}`;
  await writeFile(path.join(UPLOAD_DIR, filename), Buffer.from(await file.arrayBuffer()));
  return `/api/media/file/${filename}`;
}

// Best-effort: an orphaned file on disk is harmless, a crashed mutation isn't.
export async function deleteUploadedImage(url: string | null | undefined) {
  if (!url) return;
  const filename = url.split("/").pop();
  if (!filename) return;
  await unlink(path.join(UPLOAD_DIR, filename)).catch(() => {});
}
