#!/usr/bin/env node
/**
 * Reads one user's rows out of the finance.arnayem.top SQLite database and
 * prints them as JSON on stdout.
 *
 * This exists as a separate process for one reason: opening a second
 * better-sqlite3 handle inside the Next.js server — which already holds one
 * through the Prisma adapter — segfaults the whole process on the production
 * box, taking the dashboard down with it. A child process contains that. If
 * the native binding dies here, the parent sees a non-zero exit and reports a
 * failed sync instead of disappearing.
 *
 * Usage:  node read-finance-source.mjs <dbPath> <userEmail>
 *
 * The database is opened readonly, so this can never write to, lock, or
 * corrupt the live finance app.
 */

import Database from "better-sqlite3";

const [dbPath, userEmail] = process.argv.slice(2);

if (!dbPath || !userEmail) {
  console.error("Usage: read-finance-source.mjs <dbPath> <userEmail>");
  process.exit(2);
}

let db;
try {
  // fileMustExist: a typo'd path fails loudly rather than silently creating an
  // empty database and reporting "0 rows".
  db = new Database(dbPath, { readonly: true, fileMustExist: true });
} catch (error) {
  console.error(`Cannot open ${dbPath}: ${error.message}`);
  process.exit(3);
}

try {
  const user = db.prepare("SELECT id FROM User WHERE email = ?").get(userEmail);
  if (!user) {
    console.error(`No user with email ${userEmail} in the finance-tracker database.`);
    process.exit(4);
  }
  const userId = user.id;

  const accounts = db
    .prepare("SELECT id, name, currency, type, role, createdAt FROM Account WHERE userId = ?")
    .all(userId);

  const transactions = db
    .prepare(
      `SELECT t.id, t.date, t.amount, t.currency, t.type, t.category, t.note, t.accountId,
              s.name AS streamName, d.fileName AS fileName
       FROM "Transaction" t
       LEFT JOIN Stream   s ON s.id = t.streamId
       LEFT JOIN Document d ON d.id = t.documentId
       WHERE t.userId = ?`,
    )
    .all(userId);

  const investments = db
    .prepare(
      `SELECT i.id, i.name, i.amount, i.currency, i.date, i.type, i.status, i.notes, i.accountId,
              d.fileName AS fileName
       FROM Investment i
       LEFT JOIN Document d ON d.id = i.documentId
       WHERE i.userId = ?`,
    )
    .all(userId);

  const transfers = db
    .prepare(
      `SELECT id, date, fromAccountId, fromAmount, fromCurrency, toAccountId, toAmount,
              toCurrency, note
       FROM "Transfer" WHERE userId = ?`,
    )
    .all(userId);

  // Returns and top-ups have no userId column — they belong to an Investment,
  // so scope them by the investments already filtered above. Note neither
  // table has a `note` column.
  const investmentIds = investments.map((row) => row.id);
  const placeholders = investmentIds.map(() => "?").join(",");

  const returns = investmentIds.length
    ? db
        .prepare(
          `SELECT id, investmentId, date, amount, currency
           FROM InvestmentReturn WHERE investmentId IN (${placeholders})`,
        )
        .all(...investmentIds)
    : [];

  const topUps = investmentIds.length
    ? db
        .prepare(
          `SELECT id, investmentId, date, amount, currency
           FROM InvestmentTopUp WHERE investmentId IN (${placeholders})`,
        )
        .all(...investmentIds)
    : [];

  db.close();

  process.stdout.write(
    JSON.stringify({ accounts, transactions, investments, transfers, returns, topUps }),
  );
} catch (error) {
  try {
    db.close();
  } catch {
    // Already closed.
  }
  console.error(error.message);
  process.exit(5);
}
