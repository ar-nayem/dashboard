import { SignJWT, importPKCS8 } from "jose";
import { requireEnv } from "./types";

/**
 * Google service-account auth, shared by the Analytics and Search Console
 * adapters.
 *
 * Implemented directly against the OAuth token endpoint rather than pulling
 * in googleapis: the whole flow is one signed JWT exchanged for an access
 * token, and `jose` is already a dependency for session handling.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";

type ServiceAccount = {
  client_email: string;
  private_key: string;
};

function readServiceAccount(): ServiceAccount {
  const raw = requireEnv("GA_SERVICE_ACCOUNT_JSON");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      "GA_SERVICE_ACCOUNT_JSON is not valid JSON. Paste the whole key file as one line, with newlines in private_key escaped as \\n.",
    );
  }

  const account = parsed as Partial<ServiceAccount>;
  if (!account.client_email || !account.private_key) {
    throw new Error("GA_SERVICE_ACCOUNT_JSON is missing client_email or private_key.");
  }

  return {
    client_email: account.client_email,
    // A key pasted into .env usually arrives with literal backslash-n rather
    // than real newlines; importPKCS8 rejects that, so normalise here.
    private_key: account.private_key.replace(/\\n/g, "\n"),
  };
}

// Access tokens last an hour. Cached in module scope so a cron run that
// touches both Google adapters mints one token, not two.
let cached: { token: string; expiresAt: number; scope: string } | null = null;

export async function getGoogleAccessToken(scope: string): Promise<string> {
  // 60s of slack so a token can't expire mid-request.
  if (cached && cached.scope === scope && cached.expiresAt > Date.now() + 60_000) {
    return cached.token;
  }

  const account = readServiceAccount();
  const key = await importPKCS8(account.private_key, "RS256");

  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({ scope })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(account.client_email)
    .setAudience(TOKEN_URL)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Google token exchange failed: ${response.status} ${body.slice(0, 300)}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  cached = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    scope,
  };

  return data.access_token;
}

export const GA_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
export const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
