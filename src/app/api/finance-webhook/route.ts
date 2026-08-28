import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Receives finance entities pushed from finance.arnayem.top.
 *
 * The origin app is multi-tenant and holds four users' real financial
 * records. This endpoint therefore enforces the tenant **itself**, rejecting
 * any row whose sourceUserId is not FINANCE_SOURCE_USER_ID — a bug or a later
 * change on the sending side must not be able to leak another person's
 * finances into this dashboard.
 *
 * Body:
 *   { "changes": [ { "op": "upsert"|"delete",
 *                    "entity": "account"|"transaction"|"transfer"|
 *                              "investment"|"investment_return"|
 *                              "investment_topup",
 *                    "sourceUserId": "...",
 *                    "data": { ... } } ] }
 *
 * Batched so one push and a 55-row backfill use the same path. Every write is
 * an upsert keyed on externalId, so a retry after a network failure corrects
 * rather than duplicating — which matters because the sender retries.
 */

const PREFIX = "ft";

type Change = {
  op?: unknown;
  entity?: unknown;
  sourceUserId?: unknown;
  data?: Record<string, unknown>;
};

function isAuthorized(request: Request): boolean {
  const expected = process.env.FINANCE_WEBHOOK_SECRET;
  if (!expected || expected.trim() === "") return false;

  const provided = request.headers.get("x-webhook-secret") ?? "";
  if (!provided) return false;

  const a = Buffer.from(provided);
  const b = Buffer.from(expected.trim());
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

const externalId = (entity: string, id: string) => `${PREFIX}:${entity}:${id}`;

/** finance-tracker account types → this app's Account.kind vocabulary. */
function mapAccountKind(type: unknown): string {
  switch (String(type)) {
    case "bank":
      return "bank";
    case "cash":
      return "cash";
    // A mobile wallet (Alipay, WeChat Pay) is spendable balance, not a bank
    // relationship — "cash" is the closest honest fit in this app's vocabulary.
    case "wallet":
      return "cash";
    default:
      return "bank";
  }
}

function toDate(value: unknown): Date | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Resolves a source account id to the mirrored local row. */
async function localAccountId(sourceId: unknown): Promise<string | null> {
  if (typeof sourceId !== "string" || !sourceId) return null;
  const row = await prisma.account.findUnique({
    where: { externalId: externalId("acc", sourceId) },
    select: { id: true },
  });
  return row?.id ?? null;
}

async function localInvestmentId(sourceId: unknown): Promise<string | null> {
  if (typeof sourceId !== "string" || !sourceId) return null;
  const row = await prisma.investment.findUnique({
    where: { externalId: externalId("inv", sourceId) },
    select: { id: true },
  });
  return row?.id ?? null;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowedUser = process.env.FINANCE_SOURCE_USER_ID?.trim();
  if (!allowedUser) {
    return NextResponse.json(
      { error: "FINANCE_SOURCE_USER_ID is not configured — refusing to accept data." },
      { status: 503 },
    );
  }

  let body: { changes?: Change[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const changes = Array.isArray(body.changes) ? body.changes : null;
  if (!changes) {
    return NextResponse.json({ error: 'Expected { "changes": [ … ] }.' }, { status: 400 });
  }
  if (changes.length > 1000) {
    return NextResponse.json({ error: "At most 1000 changes per request." }, { status: 413 });
  }

  let applied = 0;
  let deleted = 0;
  const rejected: string[] = [];
  const skipped: string[] = [];

  // Accounts first: transactions, transfers and investments all resolve
  // against them, and a single backfill payload arrives unordered.
  const ordered = [...changes].sort((a, b) => {
    const rank = (c: Change) => (String(c.entity) === "account" ? 0 : String(c.entity) === "investment" ? 1 : 2);
    return rank(a) - rank(b);
  });

  for (const change of ordered) {
    const entity = String(change.entity ?? "");
    const op = String(change.op ?? "upsert");
    const data = change.data ?? {};
    const id = typeof data.id === "string" ? data.id : "";

    // Tenant gate — the whole reason this endpoint validates rather than trusts.
    if (String(change.sourceUserId ?? "") !== allowedUser) {
      rejected.push(`${entity}:${id || "?"} — not the configured user`);
      continue;
    }

    if (!id) {
      skipped.push(`${entity} — missing id`);
      continue;
    }

    try {
      switch (entity) {
        case "account": {
          const key = externalId("acc", id);
          if (op === "delete") {
            deleted += (await prisma.account.deleteMany({ where: { externalId: key } })).count;
            break;
          }
          const name = String(data.name ?? "").trim();
          if (!name) {
            skipped.push(`account:${id} — missing name`);
            break;
          }
          await prisma.account.upsert({
            where: { externalId: key },
            create: {
              externalId: key,
              source: "finance-tracker",
              name,
              kind: mapAccountKind(data.type),
              currency: String(data.currency ?? "USD"),
            },
            update: {
              name,
              kind: mapAccountKind(data.type),
              currency: String(data.currency ?? "USD"),
            },
          });
          applied++;
          break;
        }

        case "transaction": {
          const key = externalId("tx", id);
          if (op === "delete") {
            deleted += (await prisma.transaction.deleteMany({ where: { externalId: key } })).count;
            break;
          }
          const amount = toNumber(data.amount);
          const date = toDate(data.date);
          if (amount === null || !date) {
            skipped.push(`transaction:${id} — bad amount or date`);
            break;
          }
          const fields = {
            date,
            // Stored positive; `kind` carries direction, matching how this
            // app's own manual entry works.
            amount: Math.abs(amount),
            currency: String(data.currency ?? "USD"),
            kind: String(data.type) === "income" ? "income" : "expense",
            category: data.category ? String(data.category) : null,
            description: data.note ? String(data.note) : null,
            receiptName: data.receiptName ? String(data.receiptName) : null,
            receiptUrl: data.receiptUrl ? String(data.receiptUrl) : null,
            accountId: await localAccountId(data.accountId),
          };
          await prisma.transaction.upsert({
            where: { externalId: key },
            create: { externalId: key, source: "finance-tracker", ...fields },
            update: fields,
          });
          applied++;
          break;
        }

        case "transfer": {
          const key = externalId("trf", id);
          if (op === "delete") {
            deleted += (await prisma.transfer.deleteMany({ where: { externalId: key } })).count;
            break;
          }
          const fromAccountId = await localAccountId(data.fromAccountId);
          const toAccountId = await localAccountId(data.toAccountId);
          const fromAmount = toNumber(data.fromAmount);
          const toAmount = toNumber(data.toAmount);
          const date = toDate(data.date);

          // Both accounts are required — a transfer with a dangling side would
          // silently distort one account's balance.
          if (!fromAccountId || !toAccountId || fromAmount === null || toAmount === null || !date) {
            skipped.push(`transfer:${id} — unresolved account or bad amounts`);
            break;
          }
          const fields = {
            date,
            fromAccountId,
            toAccountId,
            fromAmount: Math.abs(fromAmount),
            toAmount: Math.abs(toAmount),
            fromCurrency: String(data.fromCurrency ?? "USD"),
            toCurrency: String(data.toCurrency ?? "USD"),
            note: data.note ? String(data.note) : null,
          };
          await prisma.transfer.upsert({
            where: { externalId: key },
            create: { externalId: key, source: "finance-tracker", ...fields },
            update: fields,
          });
          applied++;
          break;
        }

        case "investment": {
          const key = externalId("inv", id);
          if (op === "delete") {
            deleted += (await prisma.investment.deleteMany({ where: { externalId: key } })).count;
            break;
          }
          const amount = toNumber(data.amount);
          const date = toDate(data.date);
          const name = String(data.name ?? "").trim();
          if (amount === null || !date || !name) {
            skipped.push(`investment:${id} — bad name, amount or date`);
            break;
          }
          const fields = {
            name,
            amount: Math.abs(amount),
            currency: String(data.currency ?? "USD"),
            date,
            kind: data.type ? String(data.type) : null,
            status: String(data.status ?? "active"),
            notes: data.notes ? String(data.notes) : null,
            receiptName: data.receiptName ? String(data.receiptName) : null,
            receiptUrl: data.receiptUrl ? String(data.receiptUrl) : null,
            accountId: await localAccountId(data.accountId),
          };
          await prisma.investment.upsert({
            where: { externalId: key },
            create: { externalId: key, source: "finance-tracker", ...fields },
            update: fields,
          });
          applied++;
          break;
        }

        // Returns and top-ups are structurally identical, but the two Prisma
        // delegates cannot be unified into one callable variable, so each
        // branch calls its own.
        case "investment_return":
        case "investment_topup": {
          const isReturn = entity === "investment_return";
          const key = externalId(isReturn ? "invret" : "invtop", id);

          if (op === "delete") {
            deleted += isReturn
              ? (await prisma.investmentReturn.deleteMany({ where: { externalId: key } })).count
              : (await prisma.investmentTopUp.deleteMany({ where: { externalId: key } })).count;
            break;
          }

          const investmentId = await localInvestmentId(data.investmentId);
          const amount = toNumber(data.amount);
          const date = toDate(data.date);
          if (!investmentId || amount === null || !date) {
            skipped.push(`${entity}:${id} — unresolved investment or bad amount/date`);
            break;
          }

          const fields = {
            investmentId,
            date,
            amount: Math.abs(amount),
            currency: String(data.currency ?? "USD"),
          };

          if (isReturn) {
            await prisma.investmentReturn.upsert({
              where: { externalId: key },
              create: { externalId: key, source: "finance-tracker", ...fields },
              update: fields,
            });
          } else {
            await prisma.investmentTopUp.upsert({
              where: { externalId: key },
              create: { externalId: key, source: "finance-tracker", ...fields },
              update: fields,
            });
          }
          applied++;
          break;
        }

        default:
          skipped.push(`unknown entity "${entity}"`);
      }
    } catch (error) {
      skipped.push(`${entity}:${id} — ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  await prisma.integration.updateMany({
    where: { key: "finance_tracker" },
    data: {
      status: rejected.length > 0 ? "error" : "ok",
      lastSyncedAt: new Date(),
      lastError:
        rejected.length > 0
          ? `Refused ${rejected.length} row(s) from another user: ${rejected.slice(0, 3).join("; ")}`
          : null,
    },
  });

  return NextResponse.json({
    applied,
    deleted,
    rejected: rejected.length,
    skipped: skipped.length,
    details: [...rejected.slice(0, 5), ...skipped.slice(0, 5)],
  });
}
