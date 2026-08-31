#!/usr/bin/env -S npx tsx
/**
 * The "I'm locked out" recovery path for the app password. Sets
 * APP_PASSWORD_HASH in .env AND clears any password set from Settings.
 *
 * The password is typed into this process and never echoed, never stored in
 * shell history, and never written anywhere in plaintext — only the scrypt
 * salt:hash goes into .env.
 *
 * Why this has to touch the database, not just .env: changing the password
 * from inside the running app (Settings → Security) writes an override row
 * to AppSetting rather than .env, because a running Node process cannot
 * rewrite its own environment — see getStoredPasswordHash() in
 * src/lib/password.ts. That row outranks .env by design, so if this script
 * only rewrote .env, a forgotten in-app password would keep winning and the
 * "reset" would silently do nothing. Clearing the row is what makes this a
 * real reset rather than a no-op.
 *
 * Run via tsx (not plain node) because the generated Prisma client is
 * TypeScript, not compiled JS.
 */

import { createInterface } from "node:readline";
import { readFileSync, writeFileSync, existsSync, chmodSync } from "node:fs";
import { resolve } from "node:path";
import { scryptSync, randomBytes } from "node:crypto";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const ENV_PATH = resolve(process.cwd(), ".env");
const KEY_LENGTH = 64;

const CTRL_C = "\u0003";
const CTRL_D = "\u0004";
const BACKSPACE = "\u007f";

// Mirrors hashPassword() in src/lib/password.ts. Duplicated rather than
// imported so this script has no dependency on that module's other exports.
function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${salt}:${hash}`;
}

const rl = createInterface({ input: process.stdin, output: process.stdout });

/** Reads a line without echoing it. Requires a terminal. */
function askSecret(question: string): Promise<string> {
  return new Promise((done) => {
    process.stdout.write(question);
    rl.pause();
    const wasRaw = process.stdin.isRaw;
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    let value = "";

    const finish = (exitCode?: number) => {
      process.stdin.removeListener("data", onData);
      process.stdin.setRawMode(wasRaw);
      process.stdout.write("\n");
      if (exitCode !== undefined) process.exit(exitCode);
      rl.resume();
      done(value);
    };

    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === CTRL_C) return finish(130);
        if (char === "\n" || char === "\r" || char === CTRL_D) return finish();
        if (char === BACKSPACE || char === "\b") {
          value = value.slice(0, -1);
          continue;
        }
        if (char >= " ") value += char;
      }
    };

    process.stdin.on("data", onData);
  });
}

function readEnvLines(): string[] {
  if (!existsSync(ENV_PATH)) return [];
  return readFileSync(ENV_PATH, "utf8").split("\n");
}

/**
 * Deletes the in-app password override, if one exists.
 *
 * A missing row is the success case (nothing to clear) — this must not throw
 * just because the password was never changed from Settings.
 */
async function clearStoredPasswordOverride(): Promise<void> {
  const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
  const prisma = new PrismaClient({ adapter });

  try {
    const { count } = await prisma.appSetting.deleteMany({ where: { key: "password_hash" } });
    if (count > 0) {
      console.log("  ✓ Cleared the password set from Settings — .env takes over again.");
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  if (!process.stdin.isTTY) {
    console.error(
      "\n  This script needs an interactive terminal so the password is not echoed.\n" +
        "  Run it directly: npm run set:password\n",
    );
    process.exit(1);
  }

  console.log("\n  Set the dashboard password");
  console.log("  Only the scrypt hash is written to .env — the password itself is never stored.\n");

  const password = await askSecret("  New password: ");

  if (password.length < 12) {
    console.error(
      `\n  ✗ Too short (${password.length} characters). This app is reachable from the public\n` +
        "    internet and holds your finances — use at least 12 characters.\n",
    );
    rl.close();
    process.exit(1);
  }

  const again = await askSecret("  Confirm:      ");
  if (again !== password) {
    console.error("\n  ✗ They don't match. Nothing was changed.\n");
    rl.close();
    process.exit(1);
  }

  const hash = hashPassword(password);

  const lines = readEnvLines().filter(
    (line) => !/^\s*APP_PASSWORD_HASH\s*=/.test(line) && !/^# scrypt hash of the app/.test(line),
  );
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();

  lines.push("", "# scrypt hash of the app password, as salt:hash.", `APP_PASSWORD_HASH="${hash}"`, "");

  writeFileSync(ENV_PATH, lines.join("\n"));
  chmodSync(ENV_PATH, 0o600);

  console.log("\n  ✓ Wrote .env.");
  await clearStoredPasswordOverride();
  console.log("\n  Restart the server for it to take effect.");
  console.log("  On the server, this must be set in its own .env — deploying does not copy it.\n");

  rl.close();
}

main().catch((error) => {
  console.error(error);
  rl.close();
  process.exit(1);
});
