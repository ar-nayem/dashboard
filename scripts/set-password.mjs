#!/usr/bin/env node
/**
 * Sets the app password by writing APP_PASSWORD_HASH into .env.
 *
 * The password is typed into this process and never echoed, never stored in
 * shell history, and never written anywhere in plaintext — only the scrypt
 * salt:hash goes into .env.
 *
 * Kept separate from setup-keys.mjs because this is the one credential you
 * choose rather than obtain, and it is the thing standing between the public
 * internet and your finances once the app is deployed.
 */

import { createInterface } from "node:readline";
import { readFileSync, writeFileSync, existsSync, chmodSync } from "node:fs";
import { resolve } from "node:path";
import { scryptSync, randomBytes } from "node:crypto";

const ENV_PATH = resolve(process.cwd(), ".env");
const KEY_LENGTH = 64;

const CTRL_C = "\u0003";
const CTRL_D = "\u0004";
const BACKSPACE = "\u007f";

// Mirrors hashPassword() in src/lib/password.ts. Duplicated rather than
// imported because this is a plain .mjs script and that module is TypeScript —
// if the format there changes, change it here too.
function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${salt}:${hash}`;
}

const rl = createInterface({ input: process.stdin, output: process.stdout });

/** Reads a line without echoing it. Requires a terminal. */
function askSecret(question) {
  return new Promise((done) => {
    process.stdout.write(question);
    rl.pause();
    const wasRaw = process.stdin.isRaw;
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    let value = "";

    const finish = (exitCode) => {
      process.stdin.removeListener("data", onData);
      process.stdin.setRawMode(wasRaw);
      process.stdout.write("\n");
      if (exitCode !== undefined) process.exit(exitCode);
      rl.resume();
      done(value);
    };

    const onData = (chunk) => {
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

function readEnvLines() {
  if (!existsSync(ENV_PATH)) return [];
  return readFileSync(ENV_PATH, "utf8").split("\n");
}

function main() {
  if (!process.stdin.isTTY) {
    console.error(
      "\n  This script needs an interactive terminal so the password is not echoed.\n" +
        "  Run it directly: npm run set:password\n",
    );
    process.exit(1);
  }

  console.log("\n  Set the dashboard password");
  console.log("  Only the scrypt hash is written to .env — the password itself is never stored.\n");

  askSecret("  New password: ").then(async (password) => {
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

    console.log("\n  ✓ Password set. Restart the server for it to take effect.");
    console.log("    On the server, this must be set in its own .env — deploying does not copy it.\n");

    rl.close();
  });
}

main();
