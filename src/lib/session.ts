import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { cache } from "react";
import { redirect } from "next/navigation";

const SESSION_COOKIE = "session";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// There is no User table (single shared password — see password.ts), so the
// JWT carries no per-user identity, just this fixed marker as its subject.
// verifySession only checks the signature and this marker, never the DB.
const SESSION_SUBJECT = "dashboard-authenticated";

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return new TextEncoder().encode(secret);
}

async function encrypt(): Promise<string> {
  return new SignJWT({ sub: SESSION_SUBJECT })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecretKey());
}

async function decrypt(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), { algorithms: ["HS256"] });
    return payload.sub === SESSION_SUBJECT;
  } catch {
    return false;
  }
}

export async function createSession() {
  const session = await encrypt();
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: new Date(Date.now() + SESSION_DURATION_MS),
    path: "/",
  });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  // Path must match what createSession set — a delete with a mismatched path
  // silently no-ops in the browser.
  cookieStore.delete({ name: SESSION_COOKIE, path: "/" });
}

// Defense in depth: call this inside every mutating Server Action, not only
// in pages — Server Actions are reachable by direct POST.
//
// NOTE on rotation: changing APP_PASSWORD_HASH does NOT invalidate sessions
// already issued; a valid cookie stays valid until its 30-day expiry, since
// there is no DB-backed session version to bump. To force every session to
// log out at once (e.g. after a suspected leak), rotate SESSION_SECRET.
export const verifySession = cache(async (): Promise<void> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!(await decrypt(token))) {
    redirect("/login");
  }
});

// Same check, boolean instead of redirect — for the root layout, which wraps
// the login page itself and cannot redirect there without a loop.
export const getOptionalUser = cache(async (): Promise<boolean> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  return decrypt(token);
});
