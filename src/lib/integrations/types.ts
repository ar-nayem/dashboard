/**
 * What an adapter returns.
 *
 * `recordsWritten` is deliberately part of the success shape: a sync that
 * succeeds but writes zero rows is a real failure mode (wrong property ID,
 * expired scope, empty date range) that a bare `ok: true` would hide.
 */
export type AdapterResult =
  | { ok: true; recordsWritten: number; detail?: string }
  | { ok: false; error: string };

export type CredentialSpec = {
  /** Environment variable name, read server-side only. */
  env: string;
  /** What it is and where to get it. */
  hint: string;
  /**
   * When false, the adapter still runs without it — used for optional
   * narrowing values like a comma-separated ID allow-list.
   */
  required?: boolean;
};

export type Adapter = {
  key: string;
  name: string;
  /** Hours after a successful sync before the data is considered stale. */
  staleAfterHours: number;
  /** What it pulls in, and which tab it lands on. */
  note: string;
  credentials: CredentialSpec[];
  /** False while the fetch logic is still a stub. */
  implemented: boolean;
  /**
   * Push-only sources (Apple Health) have no pull to run — the Sync button is
   * hidden for them and setup instructions are shown instead.
   */
  pushOnly?: boolean;
  run: () => Promise<AdapterResult>;
};

/** Narrow an unknown thrown value into a message worth storing. */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * fetch + JSON with an explicit timeout and a readable error.
 *
 * Every adapter talks to a third party, so a hung request would otherwise
 * hold a cron run open indefinitely.
 */
export async function fetchJson<T>(
  url: string,
  init: RequestInit = {},
  timeoutMs = 20_000,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });

    if (!response.ok) {
      // Include a slice of the body — APIs put the actual reason there, and
      // "403" alone is not actionable.
      const body = await response.text().catch(() => "");
      throw new Error(
        `${response.status} ${response.statusText}${body ? ` — ${body.slice(0, 300)}` : ""}`,
      );
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms: ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/** UTC midnight — every metric date in this app is normalised to it. */
export function utcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** "YYYY-MM-DD", the date format every one of these APIs expects. */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Reads a required env var, throwing a message that names what is missing. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`${name} is not set in .env`);
  }
  return value.trim();
}

/** Comma-separated env var to a trimmed array. */
export function envList(name: string): string[] {
  const value = process.env[name];
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}
