import { gunzipSync } from "node:zlib";
import { SignJWT, importPKCS8 } from "jose";
import { prisma } from "@/lib/prisma";
import { isoDate, requireEnv, utcDay, type AdapterResult } from "../types";

/**
 * Installs and proceeds per app, from App Store Connect sales reports.
 *
 * Two things make this adapter unusual:
 *
 * 1. Auth is an ES256 JWT signed with the .p8 key, minted per run (Apple caps
 *    token lifetime at 20 minutes).
 * 2. The sales endpoint returns a gzipped TSV, not JSON — so the response is
 *    decompressed and parsed by column name rather than position, since Apple
 *    changes column order between report versions.
 *
 * Reports are only available for complete days, and land about a day late, so
 * the window ends two days back.
 */

const REPORT_LAG_DAYS = 2;
const DAYS_TO_IMPORT = 14;

async function mintToken(): Promise<string> {
  const issuerId = requireEnv("ASC_ISSUER_ID");
  const keyId = requireEnv("ASC_KEY_ID");
  // A .p8 pasted into .env arrives with literal \n; importPKCS8 needs real ones.
  const privateKey = requireEnv("ASC_PRIVATE_KEY").replace(/\\n/g, "\n");

  const key = await importPKCS8(privateKey, "ES256");
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId, typ: "JWT" })
    .setIssuer(issuerId)
    .setIssuedAt(now)
    // Apple rejects anything longer than 20 minutes.
    .setExpirationTime(now + 15 * 60)
    .setAudience("appstoreconnect-v1")
    .sign(key);
}

type ParsedRow = Record<string, string>;

function parseTsv(text: string): ParsedRow[] {
  const lines = text.split("\n").filter((line) => line.trim() !== "");
  if (lines.length < 2) return [];

  const headers = lines[0].split("\t").map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split("\t");
    const row: ParsedRow = {};
    headers.forEach((header, index) => {
      row[header] = (cells[index] ?? "").trim();
    });
    return row;
  });
}

/**
 * Fetches one day's sales report.
 *
 * A 404 means "no sales that day", which Apple uses instead of an empty
 * report — so it is a normal outcome, not an error.
 */
async function fetchReport(token: string, vendorNumber: string, date: Date): Promise<ParsedRow[]> {
  const params = new URLSearchParams({
    "filter[frequency]": "DAILY",
    "filter[reportDate]": isoDate(date),
    "filter[reportSubType]": "SUMMARY",
    "filter[reportType]": "SALES",
    "filter[vendorNumber]": vendorNumber,
  });

  const response = await fetch(`https://api.appstoreconnect.apple.com/v1/salesReports?${params}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/a-gzip" },
  });

  if (response.status === 404) return [];

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`${response.status} ${response.statusText} — ${body.slice(0, 200)}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return parseTsv(gunzipSync(buffer).toString("utf8"));
}

export async function runAppStore(): Promise<AdapterResult> {
  const vendorNumber = requireEnv("ASC_VENDOR_NUMBER");
  const token = await mintToken();

  const projects = await prisma.project.findMany({
    where: { appStoreAppId: { not: null } },
    select: { id: true, name: true, appStoreAppId: true },
  });

  if (projects.length === 0) {
    return {
      ok: false,
      error:
        "No project has an App Store app ID set. Add one on the project's page — it is the numeric ID from the App Store URL.",
    };
  }

  const byAppleId = new Map(projects.map((project) => [project.appStoreAppId!, project.id]));

  const end = utcDay(new Date());
  end.setUTCDate(end.getUTCDate() - REPORT_LAG_DAYS);

  let written = 0;
  let daysWithSales = 0;
  const failures: string[] = [];

  for (let dayOffset = 0; dayOffset < DAYS_TO_IMPORT; dayOffset++) {
    const date = new Date(end);
    date.setUTCDate(date.getUTCDate() - dayOffset);

    try {
      const rows = await fetchReport(token, vendorNumber, date);
      if (rows.length === 0) continue;
      daysWithSales++;

      // Several rows per app per day (one per territory), so accumulate.
      const totals = new Map<string, { units: number; proceeds: number }>();

      for (const row of rows) {
        const appleId = row["Apple Identifier"];
        if (!appleId || !byAppleId.has(appleId)) continue;

        const units = Number(row["Units"] ?? 0);
        const perUnit = Number(row["Developer Proceeds"] ?? 0);

        const entry = totals.get(appleId) ?? { units: 0, proceeds: 0 };
        entry.units += Number.isFinite(units) ? units : 0;
        // "Developer Proceeds" is per unit, so the row total is unit × count.
        entry.proceeds += (Number.isFinite(perUnit) ? perUnit : 0) * (Number.isFinite(units) ? units : 0);
        totals.set(appleId, entry);
      }

      for (const [appleId, totalsForApp] of totals) {
        const projectId = byAppleId.get(appleId)!;
        await prisma.projectMetric.upsert({
          where: { projectId_date: { projectId, date } },
          create: {
            projectId,
            date,
            installs: totalsForApp.units,
            revenue: Math.round(totalsForApp.proceeds * 100) / 100,
          },
          update: {
            installs: totalsForApp.units,
            revenue: Math.round(totalsForApp.proceeds * 100) / 100,
          },
        });
        written++;
      }
    } catch (error) {
      failures.push(`${isoDate(date)}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (written === 0 && failures.length > 0) {
    return { ok: false, error: failures.slice(0, 3).join("; ") };
  }

  return {
    ok: true,
    recordsWritten: written,
    detail:
      written === 0
        ? `No sales in the last ${DAYS_TO_IMPORT} days — App Store returned empty reports.`
        : `${written} app-day rows across ${daysWithSales} days with sales.`,
  };
}
