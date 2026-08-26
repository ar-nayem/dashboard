#!/usr/bin/env node
/**
 * Interactive .env writer for integration credentials.
 *
 * Exists so secrets never have to travel through a chat log, a shell history,
 * or a copy-paste that mangles newlines. Values are typed straight into this
 * process and written to .env with 0600 permissions.
 *
 * Secret input is not echoed. File-backed credentials (the Google service
 * account JSON, the Apple .p8) are read from disk by path and escaped
 * correctly, which is the step people most often get wrong by hand.
 */

import { createInterface } from "node:readline";
import { readFileSync, writeFileSync, existsSync, chmodSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";

const ENV_PATH = resolve(process.cwd(), ".env");

// Control characters, named rather than embedded literally.
const CTRL_C = "\u0003";
const CTRL_D = "\u0004";
const BACKSPACE = "\u007f";

// --- input -----------------------------------------------------------------

/**
 * Two input modes, because they have genuinely different requirements.
 *
 * Interactive (a real terminal): readline for ordinary prompts, and raw-mode
 * keypress reading for secrets so they are never echoed to the screen or into
 * the scrollback buffer.
 *
 * Piped (a test, or `printf … | npm run setup:keys`): readline's queued
 * `question` callbacks are unreliable once stdin reaches EOF — pending prompts
 * simply never fire. So the whole of stdin is read up front and answers are
 * shifted off a list. There is no terminal to hide anything from in this mode,
 * so masking does not apply.
 */
const INTERACTIVE = Boolean(process.stdin.isTTY);

const rl = INTERACTIVE ? createInterface({ input: process.stdin, output: process.stdout }) : null;

let pipedLines = null;

function readPipedLines() {
  if (pipedLines) return pipedLines;
  let raw = "";
  try {
    // fd 0 — reads stdin to completion in one go.
    raw = readFileSync(0, "utf8");
  } catch {
    raw = "";
  }
  pipedLines = raw.split("\n");
  return pipedLines;
}

function ask(question) {
  if (!INTERACTIVE) {
    process.stdout.write(question);
    const answer = readPipedLines().shift() ?? "";
    process.stdout.write(`${answer}\n`);
    return Promise.resolve(answer);
  }
  return new Promise((done) => rl.question(question, done));
}

/** Prompts without echoing what is typed. See INTERACTIVE above. */
function askSecret(question) {
  if (!INTERACTIVE) return ask(question);

  return new Promise((done) => {
    process.stdout.write(question);

    // readline owns stdin; pause it so both aren't consuming keypresses.
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
        // Raw mode swallows the default SIGINT, so Ctrl-C is handled here.
        if (char === CTRL_C) return finish(130);
        if (char === "\n" || char === "\r" || char === CTRL_D) return finish();

        if (char === BACKSPACE || char === "\b") {
          value = value.slice(0, -1);
          continue;
        }

        // Skip remaining control characters — arrow keys arrive as escapes.
        if (char >= " ") value += char;
      }
    };

    process.stdin.on("data", onData);
  });
}

function closeInput() {
  rl?.close();
}

// --- .env read / write -----------------------------------------------------

function readEnv() {
  if (!existsSync(ENV_PATH)) return new Map();

  const map = new Map();
  for (const line of readFileSync(ENV_PATH, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!match) continue;
    // Strip surrounding quotes if present.
    map.set(match[1], match[2].replace(/^"(.*)"$/s, "$1"));
  }
  return map;
}

function writeEnv(values, comments) {
  const lines = ["# Written by `npm run setup:keys`. Never commit this file.", ""];

  for (const [key, value] of values) {
    const comment = comments.get(key);
    if (comment) lines.push(`# ${comment}`);
    // Escape only what would break parsing; the value is otherwise verbatim.
    lines.push(`${key}="${String(value).replace(/"/g, '\\"')}"`);
    lines.push("");
  }

  writeFileSync(ENV_PATH, lines.join("\n"));
  // The file now holds every secret — make it owner-only.
  chmodSync(ENV_PATH, 0o600);
}

// --- credential definitions ------------------------------------------------

const GROUPS = [
  {
    name: "GitHub — commit activity per project",
    setup:
      "github.com/settings/personal-access-tokens → fine-grained token, read-only Contents + Metadata",
    fields: [{ key: "GITHUB_TOKEN", label: "Token", secret: true }],
  },
  {
    name: "Google (Analytics + Search Console)",
    setup:
      "Cloud console → service account → Keys → Add key (JSON). Enable the Analytics Data API and Search Console API, then add the service-account email as a viewer on each property.",
    fields: [
      { key: "GA_SERVICE_ACCOUNT_JSON", label: "Path to the downloaded .json file", file: "json" },
    ],
  },
  {
    name: "App Store Connect — installs and proceeds",
    setup: "App Store Connect → Users and Access → Integrations → App Store Connect API",
    fields: [
      { key: "ASC_ISSUER_ID", label: "Issuer ID" },
      { key: "ASC_KEY_ID", label: "Key ID" },
      { key: "ASC_PRIVATE_KEY", label: "Path to the .p8 file", file: "pem" },
      { key: "ASC_VENDOR_NUMBER", label: "Vendor number" },
    ],
  },
  {
    name: "RevenueCat — MRR, subscriptions, trials",
    setup: "RevenueCat → Project settings → API keys → v2 secret key (sk_…)",
    fields: [{ key: "REVENUECAT_API_KEY", label: "Secret key", secret: true }],
  },
  {
    name: "Stripe — charges into Finance",
    setup:
      "Stripe → Developers → API keys. Prefer a RESTRICTED key with read access to Charges over a full secret key.",
    fields: [{ key: "STRIPE_SECRET_KEY", label: "Key", secret: true }],
  },
  {
    name: "YouTube — subscribers and views",
    setup:
      "Cloud console → enable YouTube Data API v3 → Credentials → API key. Channel ID is in YouTube Studio → Settings → Channel → Advanced.",
    fields: [
      { key: "YOUTUBE_API_KEY", label: "API key", secret: true },
      { key: "YOUTUBE_CHANNEL_ID", label: "Channel ID (UC…)" },
    ],
  },
];

/** Secrets generated rather than obtained, when not already present. */
const GENERATED = [
  ["SESSION_SECRET", "Signs the session JWT. Rotating it logs every session out."],
  ["CRON_SECRET", "Bearer token for GET /api/cron."],
  ["HEALTH_WEBHOOK_SECRET", "Sent by the iOS Shortcut as the x-webhook-secret header."],
];

const COMMENTS = new Map([
  ["DATABASE_URL", "SQLite file used by the Prisma adapter."],
  ["APP_PASSWORD_HASH", "scrypt hash of the app password, as salt:hash."],
  ...GENERATED,
]);

// --- field handling --------------------------------------------------------

/** Reads a credential that lives in a file, validating it looks like the right one. */
function readCredentialFile(field, path) {
  const resolved = resolve(path.replace(/^~/, process.env.HOME ?? "~"));

  if (!existsSync(resolved)) {
    console.log(`     ✗ No file at ${resolved} — skipped.`);
    return null;
  }

  const contents = readFileSync(resolved, "utf8");

  if (field.file === "json") {
    let parsed;
    try {
      parsed = JSON.parse(contents);
    } catch {
      console.log("     ✗ That file is not valid JSON — skipped.");
      return null;
    }
    if (!parsed.client_email || !parsed.private_key) {
      console.log("     ✗ That JSON has no client_email/private_key — is it the right file?");
      return null;
    }
    console.log(`     ✓ Read service account for ${parsed.client_email}`);
    // Minified to one line; the adapter un-escapes private_key itself.
    return JSON.stringify(parsed);
  }

  if (!contents.includes("PRIVATE KEY")) {
    console.log("     ✗ That does not look like a .p8 private key — skipped.");
    return null;
  }
  console.log("     ✓ Read private key");
  // Escape real newlines; the adapter converts them back before importing.
  return contents.trim().replace(/\r?\n/g, "\\n");
}

// --- main ------------------------------------------------------------------

async function main() {
  console.log("\n  Integration key setup");
  console.log("  Values are written to .env (chmod 600). Secrets are not echoed.");
  console.log("  Press Enter to skip a field or keep an existing value.\n");

  const values = readEnv();

  // Baseline entries so a fresh .env is still valid.
  if (!values.has("DATABASE_URL")) values.set("DATABASE_URL", "file:./dev.db");

  for (const [key, description] of GENERATED) {
    if (!values.get(key)) {
      values.set(key, randomBytes(32).toString("hex"));
      console.log(`  Generated ${key} — ${description}`);
    }
  }

  for (const group of GROUPS) {
    console.log(`\n  ── ${group.name}`);
    console.log(`     ${group.setup}\n`);

    const answer = await ask("     Configure this one? [y/N] ");
    if (!/^y(es)?$/i.test(answer.trim())) continue;

    for (const field of group.fields) {
      const existing = values.get(field.key);
      const suffix = existing ? " (already set — Enter keeps it)" : "";

      if (field.file) {
        const path = (await ask(`     ${field.label}${suffix}: `)).trim();
        if (!path) continue;

        const value = readCredentialFile(field, path);
        if (value !== null) values.set(field.key, value);
        continue;
      }

      const typed = field.secret
        ? await askSecret(`     ${field.label}${suffix}: `)
        : await ask(`     ${field.label}${suffix}: `);

      const trimmed = typed.trim();
      if (trimmed) values.set(field.key, trimmed);
    }
  }

  writeEnv(values, COMMENTS);

  console.log("\n  ✓ Wrote .env (chmod 600)");
  console.log("  Restart the server, then open Sync to confirm each source reads as connected.");
  console.log("  Set each project's repo / property IDs under Projects → a project → Data sources.\n");

  closeInput();
}

main().catch((error) => {
  console.error(error);
  closeInput();
  process.exit(1);
});
