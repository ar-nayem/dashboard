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
  const [accounts, computed] = await Promise.all([
    prisma.account.findMany({
      where: { active: true },
      select: {
        id: true,
        snapshots: { orderBy: { date: "desc" }, take: 1, select: { balance: true } },
      },
    }),
    getComputedBalances(),
  ]);
  return accounts.reduce(
    (total, account) => total + (computed.get(account.id) ?? account.snapshots[0]?.balance ?? 0),
    0,
  );
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

/**
 * Live balance for every finance-tracker-mirrored account, computed from its
 * transaction ledger rather than a stored snapshot.
 *
 * The push never writes AccountSnapshot rows — finance-tracker has no such
 * concept, and neither does its own home page: it computes "available
 * balance" the same way every time it renders. Without this, every mirrored
 * account silently reads as a $0 balance, which is exactly what the Net
 * Worth tile showed before this existed.
 *
 * The formula is copied verbatim from finance-tracker's own
 * computeAvailableBalance() (src/lib/data.ts) rather than approximated, so
 * the two apps agree on what an account is actually worth:
 *
 *   available = (income − expense on this account)
 *             − (amount invested from this account, incl. top-ups)
 *             + (returns paid back to this account)
 *             + (transfers in) − (transfers out)
 *
 * Manually-entered accounts are untouched — those still use AccountSnapshot,
 * because a manual account has no promise that every transaction against it
 * was ever logged, so deriving its balance from a partial ledger would be
 * worse than the number you typed in yourself.
 */
async function getComputedBalances(): Promise<Map<string, number>> {
  const accounts = await prisma.account.findMany({
    where: { source: "finance-tracker" },
    select: {
      id: true,
      transactions: { select: { kind: true, amount: true } },
      investments: {
        select: {
          amount: true,
          topUps: { select: { amount: true } },
          returns: { select: { amount: true } },
        },
      },
      transfersOut: { select: { fromAmount: true } },
      transfersIn: { select: { toAmount: true } },
    },
  });

  const balances = new Map<string, number>();

  for (const account of accounts) {
    const transactionBalance = account.transactions.reduce(
      (sum, t) => sum + (t.kind === "income" ? t.amount : -t.amount),
      0,
    );
    const totalInvested = account.investments.reduce(
      (sum, i) => sum + i.amount + i.topUps.reduce((s, t) => s + t.amount, 0),
      0,
    );
    const totalReturned = account.investments.reduce(
      (sum, i) => sum + i.returns.reduce((s, r) => s + r.amount, 0),
      0,
    );
    const transferredOut = account.transfersOut.reduce((sum, t) => sum + t.fromAmount, 0);
    const transferredIn = account.transfersIn.reduce((sum, t) => sum + t.toAmount, 0);

    balances.set(
      account.id,
      transactionBalance - totalInvested + totalReturned + transferredIn - transferredOut,
    );
  }

  return balances;
}

export async function getAccountsWithBalances() {
  const [accounts, computed] = await Promise.all([
    prisma.account.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      include: { snapshots: { orderBy: { date: "desc" }, take: 1 } },
    }),
    getComputedBalances(),
  ]);

  return accounts.map((account) => {
    const live = computed.get(account.id);
    return {
      ...account,
      balance: live ?? account.snapshots[0]?.balance ?? 0,
      // A live-computed balance has no meaningful "as of" date — it reflects
      // this instant, not a snapshot moment — so that field stays null for it.
      asOf: live !== undefined ? null : (account.snapshots[0]?.date ?? null),
    };
  });
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

/** Income totals by category over a period, largest first. */
export async function getIncomeBreakdown(period: MoneyPeriod) {
  const { current } = moneyRange(period);
  const grouped = await prisma.transaction.groupBy({
    by: ["category"],
    _sum: { amount: true },
    where: { kind: "income", date: { gte: current.start, lte: current.end } },
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

// ---------------------------------------------------------------------------
// Currency-aware reads
// ---------------------------------------------------------------------------
//
// The functions above sum every transaction regardless of currency, which is
// only correct while a single currency is in play. Data mirrored from
// finance.arnayem.top is RMB and BDT, and there is no trustworthy USD rate
// for either — so these return one row PER CURRENCY and the UI renders them
// side by side. Adding 30,420 RMB to 59,320 BDT would produce a number that
// looks authoritative and means nothing.

export type CurrencyTotal = {
  currency: string;
  current: number;
  previous: number;
  /** null when the comparison period was zero. */
  delta: number | null;
};

async function sumByCurrency(
  kind: "income" | "expense",
  range: Range,
): Promise<Map<string, number>> {
  const rows = await prisma.transaction.groupBy({
    by: ["currency"],
    _sum: { amount: true },
    where: { kind, date: { gte: range.start, lte: range.end } },
  });
  return new Map(rows.map((row) => [row.currency, row._sum.amount ?? 0]));
}

function mergeCurrencyTotals(
  now: Map<string, number>,
  before: Map<string, number>,
): CurrencyTotal[] {
  // Union of both windows: a currency used last month but not this one still
  // deserves a row showing it fell to zero, rather than vanishing silently.
  const currencies = [...new Set([...now.keys(), ...before.keys()])].sort();

  return currencies.map((currency) => {
    const current = now.get(currency) ?? 0;
    const previous = before.get(currency) ?? 0;
    return { currency, current, previous, delta: percentChange(current, previous) };
  });
}

export async function getIncomeByCurrency(period: MoneyPeriod): Promise<CurrencyTotal[]> {
  const { current, previous } = moneyRange(period);
  const [now, before] = await Promise.all([
    sumByCurrency("income", current),
    sumByCurrency("income", previous),
  ]);
  return mergeCurrencyTotals(now, before);
}

export async function getExpensesByCurrency(period: MoneyPeriod): Promise<CurrencyTotal[]> {
  const { current, previous } = moneyRange(period);
  const [now, before] = await Promise.all([
    sumByCurrency("expense", current),
    sumByCurrency("expense", previous),
  ]);
  return mergeCurrencyTotals(now, before);
}

/** Income minus expenses, per currency. */
export async function getNetSavingsByCurrency(period: MoneyPeriod): Promise<CurrencyTotal[]> {
  const [income, expenses] = await Promise.all([
    getIncomeByCurrency(period),
    getExpensesByCurrency(period),
  ]);

  const byCurrency = new Map<string, CurrencyTotal>();
  for (const row of income) {
    byCurrency.set(row.currency, { ...row });
  }
  for (const row of expenses) {
    const existing = byCurrency.get(row.currency) ?? {
      currency: row.currency,
      current: 0,
      previous: 0,
      delta: null,
    };
    existing.current -= row.current;
    existing.previous -= row.previous;
    byCurrency.set(row.currency, existing);
  }

  return [...byCurrency.values()]
    .map((row) => ({ ...row, delta: percentChange(row.current, row.previous) }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

export type CurrencyBalance = { currency: string; total: number; accounts: number };

/**
 * Latest balance per account, grouped by the account's own currency.
 *
 * There is deliberately no single net-worth figure here — see the note at the
 * top of this section.
 */
export async function getBalancesByCurrency(): Promise<CurrencyBalance[]> {
  const [accounts, computed] = await Promise.all([
    prisma.account.findMany({
      where: { active: true },
      select: {
        id: true,
        currency: true,
        snapshots: { orderBy: { date: "desc" }, take: 1, select: { balance: true } },
      },
    }),
    getComputedBalances(),
  ]);

  const byCurrency = new Map<string, CurrencyBalance>();
  for (const account of accounts) {
    const balance = computed.get(account.id) ?? account.snapshots[0]?.balance;
    // An account with neither a live-computed balance nor a snapshot has no
    // known balance. Counting it as zero would understate the total and look
    // like a real reading rather than an absence of data.
    if (balance === undefined) continue;

    const entry = byCurrency.get(account.currency) ?? {
      currency: account.currency,
      total: 0,
      accounts: 0,
    };
    entry.total += balance;
    entry.accounts++;
    byCurrency.set(account.currency, entry);
  }

  return [...byCurrency.values()].sort((a, b) => a.currency.localeCompare(b.currency));
}

/** Every currency that appears anywhere in the finance data. */
export async function getCurrenciesInUse(): Promise<string[]> {
  const [transactions, accounts] = await Promise.all([
    prisma.transaction.groupBy({ by: ["currency"] }),
    prisma.account.groupBy({ by: ["currency"] }),
  ]);
  return [
    ...new Set([...transactions.map((t) => t.currency), ...accounts.map((a) => a.currency)]),
  ].sort();
}

/** Mirrored investments, newest first. */
export async function getInvestments() {
  return prisma.investment.findMany({
    orderBy: { date: "desc" },
    include: {
      account: { select: { name: true } },
      returns: { orderBy: { date: "desc" } },
      topUps: { orderBy: { date: "desc" } },
    },
  });
}

/** Mirrored transfers, newest first. */
export async function getTransfers(limit = 25) {
  return prisma.transfer.findMany({
    orderBy: { date: "desc" },
    take: limit,
    include: {
      fromAccount: { select: { name: true, currency: true } },
      toAccount: { select: { name: true, currency: true } },
    },
  });
}

// ---------------------------------------------------------------------------
// Currency-aware breakdowns and trends
// ---------------------------------------------------------------------------

export type CategoryTotal = { category: string; total: number };

/** Expense totals by category, filtered to one currency — largest first. */
export async function getExpenseBreakdownByCurrency(
  currency: string,
  period: MoneyPeriod,
): Promise<CategoryTotal[]> {
  const { current } = moneyRange(period);
  const grouped = await prisma.transaction.groupBy({
    by: ["category"],
    _sum: { amount: true },
    where: { kind: "expense", currency, date: { gte: current.start, lte: current.end } },
  });
  return grouped
    .map((row) => ({ category: row.category ?? "Uncategorised", total: row._sum.amount ?? 0 }))
    .sort((a, b) => b.total - a.total);
}

/** Income totals by category, filtered to one currency — largest first. */
export async function getIncomeBreakdownByCurrency(
  currency: string,
  period: MoneyPeriod,
): Promise<CategoryTotal[]> {
  const { current } = moneyRange(period);
  const grouped = await prisma.transaction.groupBy({
    by: ["category"],
    _sum: { amount: true },
    where: { kind: "income", currency, date: { gte: current.start, lte: current.end } },
  });
  return grouped
    .map((row) => ({ category: row.category ?? "Uncategorised", total: row._sum.amount ?? 0 }))
    .sort((a, b) => b.total - a.total);
}

export type MonthlyCashflow = { date: Date; income: number; expenses: number };

/** Monthly income vs expense totals for one currency over the last N months. */
export async function getMonthlyCashflowByCurrency(
  currency: string,
  months = 12,
): Promise<MonthlyCashflow[]> {
  const transactions = await prisma.transaction.findMany({
    where: { currency },
    orderBy: { date: "asc" },
    select: { date: true, amount: true, kind: true },
  });

  const byMonth = new Map<string, MonthlyCashflow>();
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

/** Recent transactions in one currency, newest first. */
export async function getRecentTransactionsByCurrency(currency: string, limit = 8) {
  return prisma.transaction.findMany({
    where: { currency },
    orderBy: { date: "desc" },
    take: limit,
    include: { account: { select: { name: true } } },
  });
}

// ---------------------------------------------------------------------------
// Cross-currency conversion — the one deliberate exception
// ---------------------------------------------------------------------------
//
// Every function above this point refuses to sum across currencies, on
// purpose: there is no reliable rate baked into this app, and inventing one
// would produce a confident, meaningless number. This section is the single,
// explicit exception — it uses the rate the user sets themselves at
// finance.arnayem.top (mirrored via ExchangeRate) and ONLY that rate. It never
// invents or estimates one.
//
// Every caller of convertToCombinedTotal must still show the untouched
// per-currency figures alongside the converted one — this is a headline
// on top of the real numbers, never a replacement for them.

export type CombinedTotal = {
  /** The converted grand total, in `rate.toCurrency`. */
  total: number;
  targetCurrency: string;
  rate: number;
  rateDate: Date;
} | null;

/** The most recent rate for one currency pair, or null if none has ever been set. */
export async function getLatestExchangeRate(
  fromCurrency: string,
  toCurrency: string,
): Promise<{ rate: number; date: Date } | null> {
  const row = await prisma.exchangeRate.findFirst({
    where: { fromCurrency, toCurrency },
    orderBy: { date: "desc" },
  });
  return row ? { rate: row.rate, date: row.date } : null;
}

/**
 * Converts a set of per-currency figures into one combined total, using a
 * mirrored exchange rate — returns null when no usable rate exists, rather
 * than silently falling back to treating the missing currency as zero.
 *
 * Only handles exactly two currencies, because that is the only shape a rate
 * can convert: `rows` is expected to already be the real set of currencies in
 * use, and any currency this app has no rate for makes the whole total
 * unknown rather than partially wrong.
 */
export async function convertToCombinedTotal(
  rows: { currency: string; current: number }[],
): Promise<CombinedTotal> {
  const distinctCurrencies = [...new Set(rows.map((row) => row.currency))];
  if (distinctCurrencies.length !== 2) return null;

  const [a, b] = distinctCurrencies;
  const rateAtoB = await getLatestExchangeRate(a, b);
  const rateBtoA = rateAtoB ? null : await getLatestExchangeRate(b, a);

  const forward = rateAtoB ? { from: a, to: b, ...rateAtoB } : null;
  const reverse = rateBtoA ? { from: b, to: a, ...rateBtoA } : null;
  const usable = forward ?? reverse;
  if (!usable) return null;

  const total = rows.reduce((sum, row) => {
    if (row.currency === usable.to) return sum + row.current;
    return sum + row.current * usable.rate;
  }, 0);

  return { total, targetCurrency: usable.to, rate: usable.rate, rateDate: usable.date };
}
