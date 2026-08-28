import Database from "better-sqlite3";
import { prisma } from "@/lib/prisma";
import { requireEnv, type AdapterResult } from "../types";

/**
 * Mirrors finance.arnayem.top into the dashboard's Finance tab.
 *
 * Both apps run on the same box and both are SQLite, so this reads the source
 * database directly rather than going over HTTP. The handle is opened
 * **readonly** — this adapter can never write to, lock, or corrupt the live
 * finance app, which is the whole reason for preferring a poll over adding a
 * webhook to that app's write path.
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

  let db: Database.Database;
  try {
    // readonly + fileMustExist: a typo'd path fails loudly here rather than
    // silently creating an empty database and reporting "0 rows synced".
    db = new Database(dbPath, { readonly: true, fileMustExist: true });
  } catch (error) {
    return {
      ok: false,
      error: `Cannot open ${dbPath}: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  try {
    const user = db
      .prepare("SELECT id FROM User WHERE email = ?")
      .get(userEmail) as { id: string } | undefined;

    if (!user) {
      return { ok: false, error: `No user with email ${userEmail} in the finance-tracker database.` };
    }
    const userId = user.id;

    // --- Read everything belonging to this user --------------------------
    const accounts = db
      .prepare("SELECT id, name, currency, type, role, createdAt FROM Account WHERE userId = ?")
      .all(userId) as SourceAccount[];

    const transactions = db
      .prepare(
        `SELECT t.id, t.date, t.amount, t.currency, t.type, t.category, t.note, t.accountId,
                s.name AS streamName, d.fileName AS fileName
         FROM "Transaction" t
         LEFT JOIN Stream   s ON s.id = t.streamId
         LEFT JOIN Document d ON d.id = t.documentId
         WHERE t.userId = ?`,
      )
      .all(userId) as SourceTransaction[];

    const investments = db
      .prepare(
        `SELECT i.id, i.name, i.amount, i.currency, i.date, i.type, i.status, i.notes, i.accountId,
                d.fileName AS fileName
         FROM Investment i
         LEFT JOIN Document d ON d.id = i.documentId
         WHERE i.userId = ?`,
      )
      .all(userId) as SourceInvestment[];

    const transfers = db
      .prepare(
        `SELECT id, date, fromAccountId, fromAmount, fromCurrency, toAccountId, toAmount,
                toCurrency, note
         FROM "Transfer" WHERE userId = ?`,
      )
      .all(userId) as SourceTransfer[];

    // Returns and top-ups have no userId column — they belong to an
    // Investment, so scope them by the investments already filtered above.
    const investmentIds = investments.map((row) => row.id);
    const placeholders = investmentIds.map(() => "?").join(",");

    const returns = investmentIds.length
      ? (db
          .prepare(
            `SELECT id, investmentId, date, amount, currency
             FROM InvestmentReturn WHERE investmentId IN (${placeholders})`,
          )
          .all(...investmentIds) as SourceInvestmentEntry[])
      : [];

    const topUps = investmentIds.length
      ? (db
          .prepare(
            `SELECT id, investmentId, date, amount, currency
             FROM InvestmentTopUp WHERE investmentId IN (${placeholders})`,
          )
          .all(...investmentIds) as SourceInvestmentEntry[])
      : [];

    db.close();

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
  } catch (error) {
    // The handle is closed on the success path; close it here too so a
    // mid-read failure can't leak a file descriptor across cron runs.
    try {
      db.close();
    } catch {
      // Already closed — nothing to do.
    }
    throw error;
  }
}
