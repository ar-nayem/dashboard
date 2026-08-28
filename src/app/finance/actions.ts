"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/session";
import { ACCOUNT_KINDS, parseEnum } from "@/lib/enums";
import { toUtcDay } from "@/lib/data-habits";

function revalidateFinance() {
  revalidatePath("/finance", "layout");
  revalidatePath("/");
}

// --- Accounts --------------------------------------------------------------

export async function createAccount(formData: FormData) {
  await verifySession();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const kind = parseEnum(ACCOUNT_KINDS, String(formData.get("kind") ?? ""));
  const balanceRaw = String(formData.get("balance") ?? "").trim();
  const balance = balanceRaw === "" ? null : Number(balanceRaw);

  const last = await prisma.account.findFirst({
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const account = await prisma.account.create({
    data: {
      name,
      kind,
      currency: String(formData.get("currency") ?? "USD").trim().toUpperCase() || "USD",
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });

  // An opening balance is optional, but without at least one snapshot the
  // account contributes nothing to net worth and won't appear on the chart.
  if (balance !== null && Number.isFinite(balance)) {
    await prisma.accountSnapshot.create({
      data: {
        accountId: account.id,
        date: toUtcDay(new Date()),
        // Liabilities are stored negative so net worth stays a plain sum.
        balance: kind === "loan" ? -Math.abs(balance) : balance,
      },
    });
  }

  revalidateFinance();
}

/**
 * Records today's balance for an account.
 *
 * Upserts on [accountId, date]: updating twice in one day corrects the figure
 * rather than creating a second snapshot the chart would have to disambiguate.
 */
export async function updateAccountBalance(formData: FormData) {
  await verifySession();

  const accountId = String(formData.get("accountId") ?? "");
  const balanceRaw = String(formData.get("balance") ?? "").trim();
  if (!accountId || balanceRaw === "") return;

  const balance = Number(balanceRaw);
  if (!Number.isFinite(balance)) return;

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { kind: true },
  });
  if (!account) return;

  const dateRaw = String(formData.get("date") ?? "");
  const parsed = dateRaw ? new Date(dateRaw) : new Date();
  if (Number.isNaN(parsed.getTime())) return;
  const date = toUtcDay(parsed);

  const signed = account.kind === "loan" ? -Math.abs(balance) : balance;

  await prisma.accountSnapshot.upsert({
    where: { accountId_date: { accountId, date } },
    create: { accountId, date, balance: signed },
    update: { balance: signed },
  });

  revalidateFinance();
}

export async function deleteAccount(formData: FormData) {
  await verifySession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  // Cascades to snapshots and holdings; transactions are only un-linked.
  await prisma.account.delete({ where: { id } });
  revalidateFinance();
}

// --- Transactions ----------------------------------------------------------

export async function createTransaction(formData: FormData) {
  await verifySession();

  const amountRaw = String(formData.get("amount") ?? "").trim();
  if (amountRaw === "") return;

  const amount = Number(amountRaw);
  if (!Number.isFinite(amount)) return;

  const dateRaw = String(formData.get("date") ?? "");
  const date = dateRaw ? new Date(dateRaw) : new Date();
  if (Number.isNaN(date.getTime())) return;

  const currency = String(formData.get("currency") ?? "USD").trim().toUpperCase() || "USD";

  await prisma.transaction.create({
    data: {
      // Amounts are stored positive; `kind` carries the direction, so a
      // typed minus sign doesn't double-negate an expense.
      amount: Math.abs(amount),
      currency,
      kind: String(formData.get("kind") ?? "") === "income" ? "income" : "expense",
      date,
      category: String(formData.get("category") ?? "").trim() || null,
      description: String(formData.get("description") ?? "").trim() || null,
      accountId: String(formData.get("accountId") ?? "") || null,
      projectId: String(formData.get("projectId") ?? "") || null,
    },
  });

  revalidateFinance();
}

export async function deleteTransaction(formData: FormData) {
  await verifySession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.transaction.delete({ where: { id } });
  revalidateFinance();
}

// --- Holdings --------------------------------------------------------------

export async function upsertHolding(formData: FormData) {
  await verifySession();

  const accountId = String(formData.get("accountId") ?? "");
  const symbol = String(formData.get("symbol") ?? "").trim().toUpperCase();
  if (!accountId || !symbol) return;

  const shares = Number(formData.get("shares"));
  const costBasis = Number(formData.get("costBasis"));
  if (!Number.isFinite(shares) || !Number.isFinite(costBasis)) return;

  const priceRaw = String(formData.get("currentPrice") ?? "").trim();
  const currentPrice = priceRaw === "" ? null : Number(priceRaw);

  await prisma.holding.upsert({
    where: { accountId_symbol: { accountId, symbol } },
    create: {
      accountId,
      symbol,
      shares,
      costBasis,
      currentPrice: currentPrice !== null && Number.isFinite(currentPrice) ? currentPrice : null,
    },
    update: {
      shares,
      costBasis,
      currentPrice: currentPrice !== null && Number.isFinite(currentPrice) ? currentPrice : null,
    },
  });

  revalidateFinance();
}

export async function deleteHolding(formData: FormData) {
  await verifySession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.holding.delete({ where: { id } });
  revalidateFinance();
}

// --- Loans -----------------------------------------------------------------

export async function createLoan(formData: FormData) {
  await verifySession();

  const name = String(formData.get("name") ?? "").trim();
  const principal = Number(formData.get("principal"));
  const balance = Number(formData.get("balance"));
  if (!name || !Number.isFinite(principal) || !Number.isFinite(balance)) return;

  const rateRaw = String(formData.get("interestRate") ?? "").trim();
  const paymentRaw = String(formData.get("monthlyPayment") ?? "").trim();
  const payoffRaw = String(formData.get("payoffDate") ?? "");
  const payoffDate = payoffRaw ? new Date(payoffRaw) : null;

  await prisma.loan.create({
    data: {
      name,
      principal: Math.abs(principal),
      balance: Math.abs(balance),
      interestRate: rateRaw === "" ? null : Number(rateRaw),
      monthlyPayment: paymentRaw === "" ? null : Number(paymentRaw),
      payoffDate: payoffDate && !Number.isNaN(payoffDate.getTime()) ? payoffDate : null,
    },
  });

  revalidateFinance();
}

export async function updateLoanBalance(formData: FormData) {
  await verifySession();

  const id = String(formData.get("id") ?? "");
  const balance = Number(formData.get("balance"));
  if (!id || !Number.isFinite(balance)) return;

  await prisma.loan.update({ where: { id }, data: { balance: Math.abs(balance) } });
  revalidateFinance();
}

export async function deleteLoan(formData: FormData) {
  await verifySession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.loan.delete({ where: { id } });
  revalidateFinance();
}
