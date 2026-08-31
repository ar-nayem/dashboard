import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";

const KEY_LENGTH = 64;
const PASSWORD_HASH_KEY = "password_hash";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const hashBuffer = Buffer.from(hash, "hex");
  const candidate = scryptSync(password, salt, KEY_LENGTH);
  // Length check first: timingSafeEqual throws on a length mismatch rather
  // than returning false.
  if (candidate.length !== hashBuffer.length) return false;
  return timingSafeEqual(candidate, hashBuffer);
}

/**
 * The hash to check a login attempt against.
 *
 * A row in AppSetting — written when the password is changed from
 * Settings — always outranks the .env value, so a fresh deploy works
 * unmodified from APP_PASSWORD_HASH until the first in-app change, and every
 * change after that takes effect immediately with no restart: a running
 * process's own process.env can't be edited from outside it, which is
 * exactly the problem storing the override in the database avoids.
 */
export async function getStoredPasswordHash(): Promise<string | undefined> {
  const row = await prisma.appSetting.findUnique({ where: { key: PASSWORD_HASH_KEY } });
  return row?.value ?? process.env.APP_PASSWORD_HASH;
}

export async function setStoredPasswordHash(hash: string): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: PASSWORD_HASH_KEY },
    create: { key: PASSWORD_HASH_KEY, value: hash },
    update: { value: hash },
  });
}
