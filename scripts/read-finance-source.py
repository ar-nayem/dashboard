#!/usr/bin/env python3
"""Read one user's rows out of the finance.arnayem.top SQLite database.

Prints JSON on stdout. Exits non-zero with a message on stderr on failure.

    read-finance-source.py <dbPath> <userEmail>

Why Python rather than Node: better-sqlite3's native binding segfaults on the
production box outside the Next.js runtime — both inside the server process
(which took the dashboard down) and as a standalone `node` script (exit 139).
Python's sqlite3 is stdlib, needs no build step, and is already proven working
on that machine.

The database is opened read-only through a URI with mode=ro, so this can never
write to, lock, or corrupt the live finance app.
"""

import json
import sqlite3
import sys
from pathlib import Path


def fail(message: str, code: int) -> None:
    print(message, file=sys.stderr)
    sys.exit(code)


def main() -> None:
    if len(sys.argv) != 3:
        fail("Usage: read-finance-source.py <dbPath> <userEmail>", 2)

    db_path, user_email = sys.argv[1], sys.argv[2]

    # mode=ro fails outright on a missing file rather than creating an empty
    # one, so a typo'd path surfaces here instead of as "0 rows synced".
    if not Path(db_path).is_file():
        fail(f"Cannot open {db_path}: no such file", 3)

    try:
        conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    except sqlite3.Error as error:
        fail(f"Cannot open {db_path}: {error}", 3)

    conn.row_factory = sqlite3.Row

    try:
        row = conn.execute("SELECT id FROM User WHERE email = ?", (user_email,)).fetchone()
        if row is None:
            fail(f"No user with email {user_email} in the finance-tracker database.", 4)
        user_id = row["id"]

        def rows(sql: str, params: tuple) -> list:
            return [dict(r) for r in conn.execute(sql, params).fetchall()]

        accounts = rows(
            "SELECT id, name, currency, type, role, createdAt FROM Account WHERE userId = ?",
            (user_id,),
        )

        transactions = rows(
            """SELECT t.id, t.date, t.amount, t.currency, t.type, t.category, t.note,
                      t.accountId, s.name AS streamName, d.fileName AS fileName
               FROM "Transaction" t
               LEFT JOIN Stream   s ON s.id = t.streamId
               LEFT JOIN Document d ON d.id = t.documentId
               WHERE t.userId = ?""",
            (user_id,),
        )

        investments = rows(
            """SELECT i.id, i.name, i.amount, i.currency, i.date, i.type, i.status,
                      i.notes, i.accountId, d.fileName AS fileName
               FROM Investment i
               LEFT JOIN Document d ON d.id = i.documentId
               WHERE i.userId = ?""",
            (user_id,),
        )

        transfers = rows(
            """SELECT id, date, fromAccountId, fromAmount, fromCurrency, toAccountId,
                      toAmount, toCurrency, note
               FROM "Transfer" WHERE userId = ?""",
            (user_id,),
        )

        # Returns and top-ups have no userId column — they belong to an
        # Investment, so scope them by the investments already filtered above.
        # Neither table has a `note` column.
        investment_ids = [i["id"] for i in investments]

        if investment_ids:
            placeholders = ",".join("?" for _ in investment_ids)
            returns = rows(
                f"""SELECT id, investmentId, date, amount, currency
                    FROM InvestmentReturn WHERE investmentId IN ({placeholders})""",
                tuple(investment_ids),
            )
            top_ups = rows(
                f"""SELECT id, investmentId, date, amount, currency
                    FROM InvestmentTopUp WHERE investmentId IN ({placeholders})""",
                tuple(investment_ids),
            )
        else:
            returns, top_ups = [], []

        json.dump(
            {
                "accounts": accounts,
                "transactions": transactions,
                "investments": investments,
                "transfers": transfers,
                "returns": returns,
                "topUps": top_ups,
            },
            sys.stdout,
        )
    except sqlite3.Error as error:
        fail(str(error), 5)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
