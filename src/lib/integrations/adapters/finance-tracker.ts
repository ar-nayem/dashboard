import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { requireEnv, type AdapterResult } from "../types";

const execFileAsync = promisify(execFile);

// Overridable because the interpreter is not always on PATH under pm2's
// environment, and "python3" alone would fail there with a bare ENOENT.
const PYTHON = process.env.PYTHON_BIN ?? "python3";

/**
 * Mirrors finance.arnayem.top into the dashboard's Finance tab.
 *
 * Both apps run on the same box and both are SQLite, so this reads the source
 * database directly rather than going over HTTP. The handle is opened
 * **readonly** — this adapter can never write to, lock, or corrupt the live
 * finance app, which is the whole reason for preferring a poll over adding a
 * webhook to that app's write path.
 *
 * The read happens in a CHILD PROCESS running Python (scripts/read-finance-source.py).
 *
 * Two reasons, both learned the hard way on the production box:
 *   1. Opening a second better-sqlite3 handle inside the Next.js server —
 *      which already holds one via the Prisma adapter — segfaulted the whole
 *      process and took the dashboard offline.
 *   2. better-sqlite3 also segfaults there as a standalone `node` script
 *      (exit 139), so moving it to a child process was necessary but not
 *      sufficient.
 *
 * Python's sqlite3 is stdlib, needs no native build, and is proven working on
 * that machine. A child process additionally means any future crash in the
 * reader kills only the child and surfaces as a failed sync, not a dead site.
 *
 * finance.arnayem.top is multi-tenant. Only the configured user's rows are
 * mirrored; the other accounts on that install belong to other people and
 * must never appear here.
 *
 * The mirror is authoritative and one-way: rows carry source="finance-tracker"
 * and an externalId, are upserted on every run, and any previously mirrored
 * row whose source record has since been deleted is removed. Anything typed
 * into the dashboard's own finance forms stays untouched, because it has
 * source="manual".
 */

const PREFIX = "ft";
const SOURCE = "finance-tracker";

/** finance-tracker Account.type → dashboard Account.kind. */
const ACCOUNT_KIND: Record<string, string> = {
  bank: "bank",
  cash: "cash",
  // A digital wallet (Alipay, WeChat) is spendable balance, not a brokerage
  // or a property — "cash" is the honest bucket for it here.
  wallet: "cash",
};

type SourceAccount = {
  id: string;
  name: string;
  currency: string;
  type: string;
  role: string;
  createdAt: string;
};

type SourceTransaction = {
  id: string;
  date: string;
  amount: number;
  currency: string;
  type: string;
  category: string | null;
  note: string | null;
  accountId: string;
  streamName: string | null;
  fileName: string | null;
};

type SourceInvestment = {
  id: string;
  name: string;
  amount: number;
  currency: string;
  date: string;
  type: string | null;
  status: string;
  notes: string | null;
  accountId: string;
  fileName: string | null;
};

// Returns and top-ups carry no note at the source — unlike Transaction and
// Transfer, those two tables are just (date, amount, currency).
type SourceInvestmentEntry = {
  id: string;
  investmentId: string;
  date: string;
  amount: number;
  currency: string;
};

type SourceTransfer = {
  id: string;
  date: string;
  fromAccountId: string;
  fromAmount: number;
  fromCurrency: string;
  toAccountId: string;
  toAmount: number;
  toCurrency: string;
  note: string | null;
};

const external = (kind: string, id: string) => `${PREFIX}:${kind}:${id}`;

export async function runFinanceTracker(): Promise<AdapterResult> {
  const dbPath = requireEnv("FINANCE_TRACKER_DB");
  const userEmail = requireEnv("FINANCE_TRACKER_USER_EMAIL");

  type SourcePayload = {
    accounts: SourceAccount[];
    transactions: SourceTransaction[];
    investments: SourceInvestment[];
    transfers: SourceTransfer[];
    returns: SourceInvestmentEntry[];
    topUps: SourceInvestmentEntry[];
  };

  let payload: SourcePayload;
  try {
    const script = path.join(process.cwd(), "scripts", "read-finance-source.py");
    const { stdout } = await execFileAsync(PYTHON, [script, dbPath, userEmail], {
      timeout: 60_000,
      // The whole source dataset arrives as one JSON blob; the default 1MB
      // buffer would truncate it into a parse error as the data grows.
      maxBuffer: 64 * 1024 * 1024,
    });
    payload = JSON.parse(stdout) as SourcePayload;
  } catch (error) {
    // execFile surfaces the child's stderr, which carries the precise reason
    // (bad path, unknown user, or a segfault signal).
    const detail =
      error && typeof error === "object" && "stderr" in error && String(error.stderr).trim()
        ? String(error.stderr).trim()
        : error instanceof Error
          ? error.message
          : String(error);
    return { ok: false, error: `Reading ${dbPath} failed: ${detail}` };
  }

  const { accounts, transactions, investments, transfers, returns, topUps } = payload;

  {

    // --- Accounts ---------------------------------------------------------
    // Written first: everything below needs the source→dashboard id mapping.
    const accountIdByExternal = new Map<string, string>();
    let written = 0;

    for (const [index, account] of accounts.entries()) {
      const externalId = external("account", account.id);
      const data = {
        name: account.name,
        kind: ACCOUNT_KIND[account.type] ?? "bank",
        // Mirrored verbatim rather than normalised. The source install does
        // contain one account whose currency is the literal string "8000" —
        // a data-entry bug — but it belongs to a different tenant and so is
        // filtered out before it reaches here. Should a bad value ever land
        // in the mirrored user's data, passing it through keeps it visible
        // instead of hiding it behind a guess.
        currency: account.currency,
        sortOrder: index,
        source: SOURCE,
      };

      const row = await prisma.account.upsert({
        where: { externalId },
        create: { ...data, externalId },
        update: data,
      });

      accountIdByExternal.set(account.id, row.id);
      written++;
    }

    // --- Transactions -----------------------------------------------------
    for (const transaction of transactions) {
      const externalId = external("tx", transaction.id);
      const data = {
        date: new Date(transaction.date),
        amount: transaction.amount,
        currency: transaction.currency,
        kind: transaction.type === "income" ? "income" : "expense",
        // The source's own category when it has one, otherwise the income
        // stream's name — for income rows the stream ("VPN Business",
        // "July Job") IS the meaningful category, and category is often null.
        category: transaction.category ?? transaction.streamName,
        description: transaction.note,
        // The receipt file itself stays on the origin server; only its name
        // is mirrored, since no stable public URL for it was verified.
        receiptName: transaction.fileName,
        accountId: accountIdByExternal.get(transaction.accountId) ?? null,
        source: SOURCE,
      };

      await prisma.transaction.upsert({
        where: { externalId },
        create: { ...data, externalId },
        update: data,
      });
      written++;
    }

    // --- Investments ------------------------------------------------------
    const investmentIdByExternal = new Map<string, string>();

    for (const investment of investments) {
      const externalId = external("inv", investment.id);
      const data = {
        name: investment.name,
        amount: investment.amount,
        currency: investment.currency,
        date: new Date(investment.date),
        kind: investment.type,
        status: investment.status,
        notes: investment.notes,
        receiptName: investment.fileName,
        accountId: accountIdByExternal.get(investment.accountId) ?? null,
        source: SOURCE,
      };

      const row = await prisma.investment.upsert({
        where: { externalId },
        create: { ...data, externalId },
        update: data,
      });

      investmentIdByExternal.set(investment.id, row.id);
      written++;
    }

    for (const entry of returns) {
      const investmentId = investmentIdByExternal.get(entry.investmentId);
      if (!investmentId) continue;

      const externalId = external("ret", entry.id);
      const data = {
        investmentId,
        date: new Date(entry.date),
        amount: entry.amount,
        currency: entry.currency,
        source: SOURCE,
      };

      await prisma.investmentReturn.upsert({
        where: { externalId },
        create: { ...data, externalId },
        update: data,
      });
      written++;
    }

    for (const entry of topUps) {
      const investmentId = investmentIdByExternal.get(entry.investmentId);
      if (!investmentId) continue;

      const externalId = external("top", entry.id);
      const data = {
        investmentId,
        date: new Date(entry.date),
        amount: entry.amount,
        currency: entry.currency,
        source: SOURCE,
      };

      await prisma.investmentTopUp.upsert({
        where: { externalId },
        create: { ...data, externalId },
        update: data,
      });
      written++;
    }

    // --- Transfers --------------------------------------------------------
    let skippedTransfers = 0;

    for (const transfer of transfers) {
      const fromAccountId = accountIdByExternal.get(transfer.fromAccountId);
      const toAccountId = accountIdByExternal.get(transfer.toAccountId);

      // Both sides are required. A transfer touching an account outside this
      // user's set would mean crossing a tenant boundary — skip it rather
      // than inventing a placeholder account.
      if (!fromAccountId || !toAccountId) {
        skippedTransfers++;
        continue;
      }

      const externalId = external("xfer", transfer.id);
      const data = {
        date: new Date(transfer.date),
        fromAccountId,
        fromAmount: transfer.fromAmount,
        fromCurrency: transfer.fromCurrency,
        toAccountId,
        toAmount: transfer.toAmount,
        toCurrency: transfer.toCurrency,
        note: transfer.note,
        source: SOURCE,
      };

      await prisma.transfer.upsert({
        where: { externalId },
        create: { ...data, externalId },
        update: data,
      });
      written++;
    }

    // --- Remove rows deleted at the source --------------------------------
    // Without this the mirror only ever grows: delete a transaction in
    // finance.arnayem.top and its copy here would linger forever, quietly
    // inflating every total. Scoped to source=finance-tracker, so anything
    // entered by hand in the dashboard is never touched.
    const keep = {
      accounts: accounts.map((row) => external("account", row.id)),
      transactions: transactions.map((row) => external("tx", row.id)),
      investments: investments.map((row) => external("inv", row.id)),
      returns: returns.map((row) => external("ret", row.id)),
      topUps: topUps.map((row) => external("top", row.id)),
      transfers: transfers.map((row) => external("xfer", row.id)),
    };

    // Children before parents, so a stale account's cascade can't take live
    // rows with it.
    const [staleTx, staleRet, staleTop, staleXfer, staleInv, staleAcct] = await prisma.$transaction([
      prisma.transaction.deleteMany({
        where: { source: SOURCE, externalId: { notIn: keep.transactions } },
      }),
      prisma.investmentReturn.deleteMany({
        where: { source: SOURCE, externalId: { notIn: keep.returns } },
      }),
      prisma.investmentTopUp.deleteMany({
        where: { source: SOURCE, externalId: { notIn: keep.topUps } },
      }),
      prisma.transfer.deleteMany({
        where: { source: SOURCE, externalId: { notIn: keep.transfers } },
      }),
      prisma.investment.deleteMany({
        where: { source: SOURCE, externalId: { notIn: keep.investments } },
      }),
      prisma.account.deleteMany({
        where: { source: SOURCE, externalId: { notIn: keep.accounts } },
      }),
    ]);

    const removed =
      staleTx.count + staleRet.count + staleTop.count + staleXfer.count + staleInv.count + staleAcct.count;

    const parts = [
      `${accounts.length} accounts`,
      `${transactions.length} transactions`,
      `${investments.length} investments`,
      `${transfers.length} transfers`,
    ];
    if (removed > 0) parts.push(`${removed} removed`);
    if (skippedTransfers > 0) parts.push(`${skippedTransfers} transfers skipped (account outside this user)`);

    return { ok: true, recordsWritten: written, detail: parts.join(", ") + "." };
  }
}
