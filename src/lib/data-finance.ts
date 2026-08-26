import { prisma } from "@/lib/prisma";
import { moneyRange, type MoneyPeriod, type Range } from "@/lib/periods";
import { percentChange } from "@/lib/format";

export type PeriodTotal = {
  current: number;
  previous: number;
  /** null when the comparison period was zero — callers render a dash. */
  delta: number | null;
};

async function sumTransactions(kind: "income" | "expense", range: Range): Promise<number> {
  const result = await prisma.transaction.aggregate({
    _sum: { amount: true },
    where: { kind, date: { gte: range.start, lte: range.end } },
  });
  return result._sum.amount ?? 0;
}

function toPeriodTotal(current: number, previous: number): PeriodTotal {
  return { current, previous, delta: percentChange(current, previous) };
}

export async function getIncome(period: MoneyPeriod): Promise<PeriodTotal> {
  const { current, previous } = moneyRange(period);
  const [now, before] = await Promise.all([
    sumTransactions("income", current),
    sumTransactions("income", previous),
  ]);
  return toPeriodTotal(now, before);
}

export async function getExpenses(period: MoneyPeriod): Promise<PeriodTotal> {
  const { current, previous } = moneyRange(period);
  const [now, before] = await Promise.all([
    sumTransactions("expense", current),
    sumTransactions("expense", previous),
  ]);
  return toPeriodTotal(now, before);
}

/** Income minus expenses over the period. */
export async function getNetSavings(period: MoneyPeriod): Promise<PeriodTotal> {
  const [income, expenses] = await Promise.all([getIncome(period), getExpenses(period)]);
  return toPeriodTotal(income.current - expenses.current, income.previous - expenses.previous);
}

/**
 * Savings as a percentage of income. Reported in percentage POINTS of change
 * rather than percent-of-a-percent, since "savings rate up 36.8 points" is
 * the meaningful reading.
 */
export async function getSavingsRate(
  period: MoneyPeriod,
): Promise<{ current: number; previous: number; pointsDelta: number }> {
  const [income, savings] = await Promise.all([getIncome(period), getNetSavings(period)]);
  const rateNow = income.current === 0 ? 0 : (savings.current / income.current) * 100;
  const rateBefore = income.previous === 0 ? 0 : (savings.previous / income.previous) * 100;
  return { current: rateNow, previous: rateBefore, pointsDelta: rateNow - rateBefore };
}

/** Income tagged to a project — the "Side Projects" tile. */
export async function getSideProjectRevenue(period: MoneyPeriod): Promise<PeriodTotal> {
  const { current, previous } = moneyRange(period);

  async function sumForRange(range: Range) {
    const result = await prisma.transaction.aggregate({
      _sum: { amount: true },
      where: {
        kind: "income",
        projectId: { not: null },
        date: { gte: range.start, lte: range.end },
      },
    });
    return result._sum.amount ?? 0;
  }

  const [now, before] = await Promise.all([sumForRange(current), sumForRange(previous)]);
  return toPeriodTotal(now, before);
}

/**
 * Net worth = the most recent snapshot of every active account, summed.
 * Liability accounts carry negative balances, so this is a plain sum.
 *
 * Reading the LATEST snapshot per account (rather than snapshots on one
 * shared date) means an account that wasn't updated this month still
 * contributes its last known value instead of dropping to zero.
 */
export async function getCurrentNetWorth(): Promise<number> {
  const accounts = await prisma.account.findMany({
    where: { active: true },
    select: {
      snapshots: { orderBy: { date: "desc" }, take: 1, select: { balance: true } },
    },
  });
  return accounts.reduce((total, account) => total + (account.snapshots[0]?.balance ?? 0), 0);
}

export type NetWorthPoint = { date: Date; total: number; liquid: number };

/** Account kinds that count as spendable-today money for the "liquid" line. */
const LIQUID_KINDS = new Set(["bank", "cash"]);

/**
 * Monthly net-worth series, with a second "liquid" line for cash on hand.
 *
 * For each month that has any snapshot, every account contributes its most
 * recent snapshot at or before that month — carried forward — so an account
 * updated quarterly doesn't make the line sawtooth down to zero in between.
 */
export async function getNetWorthSeries(months = 24): Promise<NetWorthPoint[]> {
  const snapshots = await prisma.accountSnapshot.findMany({
    orderBy: { date: "asc" },
    select: { accountId: true, date: true, balance: true, account: { select: { kind: true } } },
  });
  if (snapshots.length === 0) return [];

  const monthKeys = Array.from(
    new Set(snapshots.map((s) => `${s.date.getUTCFullYear()}-${s.date.getUTCMonth()}`)),
  ).slice(-months);
  const wanted = new Set(monthKeys);

  // Walk forward through time carrying the last known balance per account.
  const latestPerAccount = new Map<string, { balance: number; kind: string }>();
  const byMonth = new Map<string, NetWorthPoint>();

  for (const snapshot of snapshots) {
    const key = `${snapshot.date.getUTCFullYear()}-${snapshot.date.getUTCMonth()}`;
    latestPerAccount.set(snapshot.accountId, {
      balance: snapshot.balance,
      kind: snapshot.account.kind,
    });

    if (!wanted.has(key)) continue;

    let total = 0;
    let liquid = 0;
    for (const entry of latestPerAccount.values()) {
      total += entry.balance;
      if (LIQUID_KINDS.has(entry.kind)) liquid += entry.balance;
    }
    byMonth.set(key, { date: snapshot.date, total, liquid });
  }

  return monthKeys
    .map((key) => byMonth.get(key))
    .filter((point): point is NetWorthPoint => Boolean(point));
}

/** Total market value of every holding, for the Stocks tile. */
export async function getStocksValue(): Promise<{ value: number; costBasis: number; delta: number | null }> {
  const holdings = await prisma.holding.findMany();
  const value = holdings.reduce((sum, h) => sum + h.shares * (h.currentPrice ?? 0), 0);
  const costBasis = holdings.reduce((sum, h) => sum + h.costBasis, 0);
  return { value, costBasis, delta: percentChange(value, costBasis) };
}

/**
 * Effective hourly rate: client income over the period divided by an assumed
 * billable-hours figure. There is no time-tracking table in v1, so this is
 * derived from a constant rather than measured — shown as an estimate.
 */
export const ASSUMED_BILLABLE_HOURS_PER_MONTH = 90;

export async function getHourlyRate(period: MoneyPeriod): Promise<PeriodTotal> {
  const income = await getIncome(period);
  const monthsIn = period === "ytd" ? new Date().getMonth() + 1 : 1;
  const hours = ASSUMED_BILLABLE_HOURS_PER_MONTH * monthsIn;
  return toPeriodTotal(income.current / hours, income.previous / hours);
}

export async function getAccountsWithBalances() {
  const accounts = await prisma.account.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    include: { snapshots: { orderBy: { date: "desc" }, take: 1 } },
  });
  return accounts.map((account) => ({
    ...account,
    balance: account.snapshots[0]?.balance ?? 0,
    asOf: account.snapshots[0]?.date ?? null,
  }));
}

export async function getHoldings() {
  return prisma.holding.findMany({
    orderBy: { symbol: "asc" },
    include: { account: { select: { name: true } } },
  });
}

export async function getLoans() {
  return prisma.loan.findMany({ orderBy: { balance: "desc" } });
}

/** Expense totals by category over a period, largest first. */
export async function getExpenseBreakdown(period: MoneyPeriod) {
  const { current } = moneyRange(period);
  const grouped = await prisma.transaction.groupBy({
    by: ["category"],
    _sum: { amount: true },
    where: { kind: "expense", date: { gte: current.start, lte: current.end } },
  });
  return grouped
    .map((row) => ({ category: row.category ?? "Uncategorised", total: row._sum.amount ?? 0 }))
    .sort((a, b) => b.total - a.total);
}

/** Monthly income vs expense totals for the last N months. */
export async function getMonthlyCashflow(months = 12) {
  const transactions = await prisma.transaction.findMany({
    orderBy: { date: "asc" },
    select: { date: true, amount: true, kind: true },
  });

  const byMonth = new Map<string, { date: Date; income: number; expenses: number }>();
  for (const transaction of transactions) {
    const date = new Date(
      Date.UTC(transaction.date.getUTCFullYear(), transaction.date.getUTCMonth(), 1),
    );
    const key = date.toISOString();
    const entry = byMonth.get(key) ?? { date, income: 0, expenses: 0 };
    if (transaction.kind === "income") entry.income += transaction.amount;
    else entry.expenses += transaction.amount;
    byMonth.set(key, entry);
  }

  return [...byMonth.values()].sort((a, b) => a.date.getTime() - b.date.getTime()).slice(-months);
}
