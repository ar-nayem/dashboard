import Link from "next/link";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/session";
import { MetricTile } from "@/components/metric-tile";
import { SegmentedControl } from "@/components/segmented-control";
import { LineChart } from "@/components/charts/line-chart";
import { BarChart } from "@/components/charts/bar-chart";
import { PieChart } from "@/components/charts/pie-chart";
import { ProgressBar } from "@/components/charts/progress-bar";
import { EmptyState } from "@/components/empty-state";
import { StatusChip } from "@/components/chips";
import { Private } from "@/components/private";
import { prisma } from "@/lib/prisma";
import {
  getBalancesByCurrency,
  getCurrenciesInUse,
  getExpenseBreakdownByCurrency,
  getExpensesByCurrency,
  getIncomeBreakdownByCurrency,
  getIncomeByCurrency,
  getInvestments,
  getMonthlyCashflowByCurrency,
  getNetSavingsByCurrency,
  getRecentTransactionsByCurrency,
  getTransfers,
} from "@/lib/data-finance";
import { MONEY_PERIODS, MONEY_PERIOD_OPTIONS, type MoneyPeriod } from "@/lib/periods";
import { ACCOUNT_KINDS, parseEnum } from "@/lib/enums";
import {
  createAccount,
  createLoan,
  createTransaction,
  deleteAccount,
  deleteHolding,
  deleteLoan,
  deleteTransaction,
  updateAccountBalance,
  updateLoanBalance,
  upsertHolding,
} from "./actions";
import {
  getAccountsWithBalances,
  getCurrentNetWorth,
  getExpenseBreakdown,
  getHoldings,
  getIncome,
  getIncomeBreakdown,
  getLoans,
  getMonthlyCashflow,
  getNetSavings,
  getNetWorthSeries,
  getSavingsRate,
  getSideProjectRevenue,
  getStocksValue,
} from "@/lib/data-finance";
import {
  formatCompactCurrency,
  formatCurrency,
  formatDate,
  formatShortDate,
  percentChange,
} from "@/lib/format";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "income", label: "Income" },
  { key: "investments", label: "Investments" },
  { key: "transfers", label: "Transfers" },
  { key: "accounts", label: "Accounts" },
  { key: "loans", label: "Loans" },
];

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; period?: string; currency?: string; breakdown?: string }>;
}) {
  await verifySession();

  const params = await searchParams;
  const tab = TABS.some((t) => t.key === params.tab) ? params.tab! : "overview";
  const period = parseEnum(MONEY_PERIODS, params.period) as MoneyPeriod;
  // Which currency the Income tab is filtered to, when arriving from an
  // Overview currency card. Validated against real data inside IncomeTab
  // itself, since the list of currencies in use requires a query.
  const currency = params.currency?.trim() || undefined;
  const breakdown = params.breakdown?.trim() || undefined;

  function hrefFor(nextTab: string) {
    return `/finance?tab=${nextTab}&period=${period}`;
  }

  return (
    <div className="page">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="page-title">Finance</h1>
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((entry) => (
            <Link
              key={entry.key}
              href={hrefFor(entry.key)}
              className={`btn-ghost px-3 py-1 text-xs ${
                tab === entry.key ? "bg-accent/15 text-accent" : ""
              }`}
            >
              {entry.label}
            </Link>
          ))}
        </div>
      </div>

      {tab === "overview" && <OverviewTab period={period} />}
      {tab === "income" && <IncomeTab period={period} currency={currency} breakdown={breakdown} />}
      {tab === "investments" && <InvestmentsTab />}
      {tab === "transfers" && <TransfersTab />}
      {tab === "accounts" && <AccountsTab />}
      {tab === "loans" && <LoansTab />}
    </div>
  );
}

// ---------------------------------------------------------------------------

async function OverviewTab({ period }: { period: MoneyPeriod }) {
  const [
    netWorth,
    series,
    income,
    savings,
    savingsRate,
    stocks,
    sideProjects,
    currencies,
    incomeByCurrency,
    expensesByCurrency,
    savingsByCurrency,
    balancesByCurrency,
  ] = await Promise.all([
    getCurrentNetWorth(),
    getNetWorthSeries(24),
    getIncome(period),
    getNetSavings(period),
    getSavingsRate(period),
    getStocksValue(),
    getSideProjectRevenue(period),
    getCurrenciesInUse(),
    getIncomeByCurrency(period),
    getExpensesByCurrency(period),
    getNetSavingsByCurrency(period),
    getBalancesByCurrency(),
  ]);

  // With more than one currency in play, the single-number tiles below would
  // be summing RMB and BDT into a figure that means nothing. In that case the
  // per-currency breakdown replaces them rather than sitting alongside.
  const multiCurrency = currencies.length > 1;

  const toggle = (
    <SegmentedControl
      options={MONEY_PERIOD_OPTIONS}
      value={period}
      paramName="period"
      basePath="/finance"
      otherParams={{ tab: "overview" }}
      ariaLabel="Period"
    />
  );

  return (
    <>
      {multiCurrency && (
        <>
          <div className="mt-6 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-foreground/90">
            <strong className="font-medium">
              {currencies.join(" and ")} are shown separately.
            </strong>{" "}
            There is no reliable rate between them in your data, so nothing is converted or added
            together — a combined total would look authoritative and mean nothing.
          </div>

          <div className="mt-4 flex justify-end">{toggle}</div>

          <section className="mt-3 flex flex-col gap-8">
            {currencies.map((currency) => (
              <CurrencySection
                key={currency}
                currency={currency}
                period={period}
                balance={balancesByCurrency.find((row) => row.currency === currency) ?? null}
                income={incomeByCurrency.find((row) => row.currency === currency) ?? null}
                expense={expensesByCurrency.find((row) => row.currency === currency) ?? null}
                saving={savingsByCurrency.find((row) => row.currency === currency) ?? null}
              />
            ))}
          </section>
        </>
      )}

      {/* The trajectory chart and the tiles below sum across every account
          regardless of currency, so they are only shown when a single
          currency is in play. */}
      {!multiCurrency && (
      <section className="mt-6">
        <div className="card">
          <h2 className="section-title">Net Worth Trajectory</h2>
          <div className="mt-4">
            <LineChart
              series={[
                {
                  name: "Net worth",
                  points: series.map((p) => ({ x: p.date.getTime(), y: p.total })),
                  color: "var(--series-1)",
                },
                {
                  name: "Liquid",
                  points: series.map((p) => ({ x: p.date.getTime(), y: p.liquid })),
                  color: "var(--faint-foreground)",
                },
              ]}
              height={280}
              showArea
              formatY={(v) => formatCompactCurrency(v)}
              formatX={(v) => formatShortDate(new Date(v))}
              ariaLabel="Net worth over the last 24 months"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: "var(--series-1)" }} />
              Net worth
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: "var(--faint-foreground)" }}
              />
              Liquid (bank + cash)
            </span>
          </div>
        </div>
      </section>
      )}

      {!multiCurrency && (
      <section className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricTile
          label="Net Worth"
          icon="$"
          value={formatCompactCurrency(netWorth)}
          target={formatCompactCurrency(100_000)}
          progressPercent={(netWorth / 100_000) * 100}
        />
        <MetricTile
          label="Gross Income"
          icon="↗"
          value={formatCompactCurrency(income.current)}
          delta={income.delta}
          deltaGood={income.delta === null ? null : income.delta >= 0}
          toggle={toggle}
        />
        <MetricTile
          label="Net Savings"
          icon="◎"
          value={formatCompactCurrency(savings.current)}
          delta={savings.delta}
          deltaGood={savings.delta === null ? null : savings.delta >= 0}
        />
        <MetricTile
          label="Savings Rate"
          icon="%"
          value={`${savingsRate.current.toFixed(1)}%`}
          delta={savingsRate.pointsDelta}
          deltaGood={savingsRate.pointsDelta >= 0}
          deltaSuffix="pts YoY"
        />
        <MetricTile
          label="Stocks"
          icon="📈"
          value={formatCompactCurrency(stocks.value)}
          delta={stocks.delta}
          deltaGood={stocks.delta === null ? null : stocks.delta >= 0}
          deltaSuffix="vs cost"
        />
        <MetricTile
          label="Side Projects"
          icon="🧰"
          value={formatCompactCurrency(sideProjects.current)}
          delta={sideProjects.delta}
          deltaGood={sideProjects.delta === null ? null : sideProjects.delta >= 0}
        />
      </section>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------

/**
 * Everything for one currency on the multi-currency Overview: a clickable
 * hero card, a trend chart, a spending breakdown, and a peek at recent
 * activity. This is the per-currency equivalent of finance-tracker's own
 * home page — same information, never summed across currencies.
 */
async function CurrencySection({
  currency,
  period,
  balance,
  income,
  expense,
  saving,
}: {
  currency: string;
  period: MoneyPeriod;
  balance: { total: number; accounts: number } | null;
  income: { current: number; delta: number | null } | null;
  expense: { current: number; delta: number | null } | null;
  saving: { current: number; delta: number | null } | null;
}) {
  const [cashflow, breakdown, recent] = await Promise.all([
    getMonthlyCashflowByCurrency(currency, 12),
    getExpenseBreakdownByCurrency(currency, period),
    getRecentTransactionsByCurrency(currency, 6),
  ]);

  const rate =
    income && income.current > 0 && saving ? (saving.current / income.current) * 100 : null;
  const incomeHref = `/finance?tab=income&period=${period}&currency=${encodeURIComponent(currency)}`;

  return (
    <div className="rounded-2xl border border-border">
      {/* Hero — the whole header is a stretched link into the filtered
          Income tab, same pattern as MetricTile's href. */}
      <Link
        href={incomeHref}
        className="relative block rounded-t-2xl border-b border-border bg-surface-hover/40 px-5 py-4 transition-colors duration-150 hover:bg-surface-hover"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {currency}
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="tnum text-2xl font-semibold text-foreground">
                <Private chars={6}>{formatCurrency(balance?.total ?? 0, currency)}</Private>
              </span>
              {balance && (
                <span className="text-xs text-faint-foreground">
                  across {balance.accounts} account{balance.accounts === 1 ? "" : "s"}
                </span>
              )}
            </div>
          </div>
          <span className="text-xs font-medium text-accent">View {currency} details →</span>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <dt className="text-[11px] text-muted-foreground">Income</dt>
            <dd className="tnum text-sm text-success">
              <Private chars={5}>{formatCurrency(income?.current ?? 0, currency)}</Private>
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-muted-foreground">Expenses</dt>
            <dd className="tnum text-sm text-danger">
              <Private chars={5}>{formatCurrency(expense?.current ?? 0, currency)}</Private>
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-muted-foreground">Net</dt>
            <dd
              className={`tnum text-sm font-medium ${
                (saving?.current ?? 0) >= 0 ? "text-foreground" : "text-danger"
              }`}
            >
              <Private chars={5}>{formatCurrency(saving?.current ?? 0, currency)}</Private>
            </dd>
          </div>
          {rate !== null && (
            <div>
              <dt className="text-[11px] text-muted-foreground">Savings rate</dt>
              <dd className="tnum text-sm text-foreground/80">{rate.toFixed(1)}%</dd>
            </div>
          )}
        </dl>
      </Link>

      <div className="grid gap-4 p-5 lg:grid-cols-2">
        <div>
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Income vs expenses — {currency}
          </h3>
          <div className="mt-3">
            <LineChart
              series={[
                {
                  name: "Income",
                  points: cashflow.map((m) => ({ x: m.date.getTime(), y: m.income })),
                  color: "var(--success)",
                },
                {
                  name: "Expenses",
                  points: cashflow.map((m) => ({ x: m.date.getTime(), y: m.expenses })),
                  color: "var(--danger)",
                },
              ]}
              height={200}
              zeroBased
              formatY={(v) => formatCompactCurrency(v, currency)}
              formatX={(v) => formatShortDate(new Date(v))}
              ariaLabel={`${currency} income versus expenses by month`}
            />
          </div>
        </div>

        <div>
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Spending by category — {currency}
          </h3>
          <div className="mt-3">
            <PieChart
              slices={breakdown.map((row) => ({ label: row.category, value: row.total }))}
              formatValue={(v) => formatCompactCurrency(v, currency)}
              ariaLabel={`${currency} spending by category`}
            />
          </div>
        </div>
      </div>

      {recent.length > 0 && (
        <div className="border-t border-border px-5 py-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Recent — {currency}
            </h3>
            <Link href={incomeHref} className="text-xs text-accent hover:underline">
              View all →
            </Link>
          </div>
          <div className="mt-2 flex flex-col gap-1.5">
            {recent.map((transaction) => (
              <div key={transaction.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 flex-1 truncate text-foreground/90">
                  {transaction.description || transaction.category || "—"}
                  <span className="ml-2 text-[11px] text-faint-foreground">
                    {formatShortDate(transaction.date)}
                    {transaction.account && ` · ${transaction.account.name}`}
                  </span>
                </span>
                <span
                  className={`tnum shrink-0 ${
                    transaction.kind === "income" ? "text-success" : "text-muted-foreground"
                  }`}
                >
                  {transaction.kind === "income" ? "+" : "−"}
                  <Private chars={4}>{formatCurrency(transaction.amount, currency)}</Private>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

async function IncomeTab({
  period,
  currency,
  breakdown: breakdownTabParam,
}: {
  period: MoneyPeriod;
  currency?: string;
  breakdown?: string;
}) {
  const breakdownTab = breakdownTabParam === "income" ? "income" : "spending";
  const allCurrencies = await getCurrenciesInUse();
  // A currency arriving via the query string is only trusted once it matches
  // something real.
  const requested = currency && allCurrencies.includes(currency) ? currency : undefined;

  // With more than one currency in play, this tab must never fall through to
  // the currency-blind sum functions below — that would blend RMB and BDT
  // into one figure and label it with whichever currency happened to be
  // requested, which is exactly the "confident, meaningless number" this
  // app's whole currency-safety design exists to prevent. So a multi-currency
  // visit with no (or an invalid) currency in the URL is redirected to the
  // first currency rather than silently rendering a blended view.
  if (!requested && allCurrencies.length > 1) {
    redirect(
      `/finance?tab=income&period=${period}&currency=${encodeURIComponent(allCurrencies[0])}`,
    );
  }

  const activeCurrency = requested;

  const breakdownReader =
    breakdownTab === "income"
      ? activeCurrency
        ? getIncomeBreakdownByCurrency(activeCurrency, period)
        : getIncomeBreakdown(period)
      : activeCurrency
        ? getExpenseBreakdownByCurrency(activeCurrency, period)
        : getExpenseBreakdown(period);

  const [cashflow, breakdown, income, incomeByCurrency, accounts, projects, recent] = await Promise.all([
    activeCurrency ? getMonthlyCashflowByCurrency(activeCurrency, 12) : getMonthlyCashflow(12),
    breakdownReader,
    getIncome(period),
    getIncomeByCurrency(period),
    getAccountsWithBalances(),
    prisma.project.findMany({
      where: { status: { not: "archived" } },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
    activeCurrency
      ? getRecentTransactionsByCurrency(activeCurrency, 15)
      : prisma.transaction.findMany({
          orderBy: { date: "desc" },
          take: 15,
          include: { account: { select: { name: true } } },
        }),
  ]);

  const biggest = breakdown[0]?.total ?? 0;
  // getIncome() sums blindly across every currency — only safe to show
  // as-is in the single-currency case. When filtered to one currency, the
  // matching row from the currency-aware version is used instead, so this
  // figure is never a blended total wearing one currency's label.
  const displayIncome = activeCurrency
    ? (incomeByCurrency.find((row) => row.currency === activeCurrency)?.current ?? 0)
    : income.current;
  const currencyHref = (value?: string) =>
    `/finance?tab=income&period=${period}${value ? `&currency=${encodeURIComponent(value)}` : ""}`;

  return (
    <>
      {allCurrencies.length > 1 && (
        <div className="mt-6 flex flex-wrap gap-1.5">
          {allCurrencies.map((entry) => (
            <Link
              key={entry}
              href={currencyHref(entry)}
              className={`btn-ghost px-3 py-1 text-xs ${
                activeCurrency === entry ? "bg-accent/15 text-accent" : ""
              }`}
            >
              {entry}
            </Link>
          ))}
        </div>
      )}

      <section className={`card ${allCurrencies.length > 1 ? "mt-3" : "mt-6"}`}>
        <h2 className="section-title">
          Income vs expenses{activeCurrency ? ` — ${activeCurrency}` : ""} — last 12 months
        </h2>
        <div className="mt-4">
          <LineChart
            series={[
              {
                name: "Income",
                points: cashflow.map((m) => ({ x: m.date.getTime(), y: m.income })),
                color: "var(--success)",
              },
              {
                name: "Expenses",
                points: cashflow.map((m) => ({ x: m.date.getTime(), y: m.expenses })),
                color: "var(--danger)",
              },
            ]}
            height={240}
            zeroBased
            formatY={(v) => formatCompactCurrency(v, activeCurrency)}
            formatX={(v) => formatShortDate(new Date(v))}
            ariaLabel="Monthly income versus expenses"
          />
        </div>
      </section>

      <section className="mt-4 card">
        <h2 className="section-title">Net per month{activeCurrency ? ` — ${activeCurrency}` : ""}</h2>
        <div className="mt-4">
          <BarChart
            bars={cashflow.map((m) => ({
              label: formatShortDate(m.date).split(" ")[0],
              value: Math.round(m.income - m.expenses),
              color: m.income - m.expenses >= 0 ? "var(--success)" : "var(--danger)",
            }))}
            formatY={(v) => formatCompactCurrency(v, activeCurrency)}
            ariaLabel="Net income per month"
          />
        </div>
      </section>

      <section className="mt-4 card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="section-title">
              {breakdownTab === "income" ? "Income" : "Spending"} by category
              {activeCurrency ? ` — ${activeCurrency}` : ""}
            </h2>
            <span className="text-xs text-muted-foreground">
              Income this period{" "}
              <Private chars={5}>{formatCurrency(displayIncome, activeCurrency)}</Private>
            </span>
          </div>
          <div className="flex gap-1">
            {(
              [
                ["spending", "Spending"],
                ["income", "Income"],
              ] as const
            ).map(([tabKey, label]) => (
              <Link
                key={tabKey}
                href={`/finance?tab=income&period=${period}${activeCurrency ? `&currency=${encodeURIComponent(activeCurrency)}` : ""}&breakdown=${tabKey}`}
                scroll={false}
                className={`btn-ghost px-2.5 py-1 text-xs ${
                  breakdownTab === tabKey ? "bg-accent/15 text-accent" : ""
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
        <div className="mt-4">
          {breakdown.length === 0 ? (
            <EmptyState
              message={
                breakdownTab === "income" ? "No income in this period." : "No expenses in this period."
              }
            />
          ) : (
            <PieChart
              slices={breakdown.map((row) => ({ label: row.category, value: row.total }))}
              formatValue={(v) => formatCompactCurrency(v, activeCurrency)}
              ariaLabel={`${breakdownTab === "income" ? "Income" : "Spending"} by category`}
            />
          )}
        </div>

        {/* The bars underneath give exact figures the pie's hover title
            would otherwise hide behind a mouse-only interaction. */}
        <div className="mt-5 flex flex-col gap-3">
          {breakdown.map((row) => (
            <div key={row.category} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground/90">{row.category}</span>
                <span className="tnum text-muted-foreground">
                  <Private chars={5}>{formatCurrency(row.total, activeCurrency)}</Private>
                </span>
              </div>
              <ProgressBar
                percent={biggest === 0 ? 0 : (row.total / biggest) * 100}
                color="var(--series-2)"
                height={4}
                label={`${row.category} share`}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="section-title">Add transaction</h2>
        <form action={createTransaction} className="card mt-3 grid gap-3 sm:grid-cols-6">
          <div>
            <label htmlFor="kind" className="field-label">
              Type
            </label>
            <select id="kind" name="kind" className="input mt-1" defaultValue="expense">
              <option value="expense">expense</option>
              <option value="income">income</option>
            </select>
          </div>
          <div>
            <label htmlFor="amount" className="field-label">
              Amount
            </label>
            <input id="amount" name="amount" type="number" step="any" required className="input mt-1" />
          </div>
          <div>
            <label htmlFor="currency" className="field-label">
              Currency
            </label>
            <input
              id="currency"
              name="currency"
              maxLength={6}
              defaultValue={activeCurrency ?? "USD"}
              className="input mt-1 uppercase"
            />
          </div>
          <div>
            <label htmlFor="date" className="field-label">
              Date
            </label>
            <input id="date" name="date" type="date" className="input mt-1" />
          </div>
          <div>
            <label htmlFor="category" className="field-label">
              Category
            </label>
            <input id="category" name="category" className="input mt-1" placeholder="Groceries" />
          </div>
          <div>
            <label htmlFor="accountId" className="field-label">
              Account
            </label>
            <select id="accountId" name="accountId" className="input mt-1" defaultValue="">
              <option value="">None</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="projectId" className="field-label">
              Project
            </label>
            <select id="projectId" name="projectId" className="input mt-1" defaultValue="">
              <option value="">None</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-6">
            <label htmlFor="description" className="field-label">
              Description
            </label>
            <input id="description" name="description" className="input mt-1" />
          </div>
          <div className="sm:col-span-6">
            <button type="submit" className="btn-primary">
              Add transaction
            </button>
          </div>
        </form>
        <p className="mt-2 text-xs text-faint-foreground">
          Enter the amount as a positive number — the type field carries the direction. This form
          is for one-off manual entries; anything entered at finance.arnayem.top arrives here on
          its own.
        </p>
      </section>

      <section className="mt-6 card">
        <h2 className="section-title">
          Recent transactions{activeCurrency ? ` — ${activeCurrency}` : ""}
        </h2>
        <div className="mt-3 flex flex-col gap-1.5">
          {recent.length === 0 && <p className="text-sm text-muted-foreground">None yet.</p>}
          {recent.map((transaction) => (
            <div key={transaction.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 flex-1 truncate text-foreground/90">
                {transaction.description || transaction.category || "—"}
                <span className="ml-2 text-[11px] text-faint-foreground">
                  {formatShortDate(transaction.date)}
                  {transaction.account && ` · ${transaction.account.name}`}
                </span>
              </span>
              <span
                className={`tnum shrink-0 ${
                  transaction.kind === "income" ? "text-success" : "text-muted-foreground"
                }`}
              >
                {transaction.kind === "income" ? "+" : "−"}
                <Private chars={4}>{formatCurrency(transaction.amount, transaction.currency)}</Private>
              </span>
              <form action={deleteTransaction} className="shrink-0">
                <input type="hidden" name="id" value={transaction.id} />
                <button
                  type="submit"
                  aria-label="Delete transaction"
                  className="cursor-pointer text-xs text-faint-foreground hover:text-danger"
                >
                  ✕
                </button>
              </form>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

// ---------------------------------------------------------------------------

async function InvestmentsTab() {
  const [holdings, stocks, accounts, investments] = await Promise.all([
    getHoldings(),
    getStocksValue(),
    getAccountsWithBalances(),
    getInvestments(),
  ]);

  // Only accounts that can actually hold securities.
  const investable = accounts.filter((account) => ["brokerage", "crypto"].includes(account.kind));

  return (
    <>
      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <MetricTile label="Market Value" icon="📈" value={formatCompactCurrency(stocks.value)} />
        <MetricTile label="Cost Basis" icon="🧾" value={formatCompactCurrency(stocks.costBasis)} />
        <MetricTile
          label="Unrealised P/L"
          icon="±"
          value={formatCompactCurrency(stocks.value - stocks.costBasis)}
          delta={stocks.delta}
          deltaGood={stocks.delta === null ? null : stocks.delta >= 0}
          deltaSuffix="vs cost"
        />
      </section>

      <section className="mt-4 card overflow-x-auto">
        <h2 className="section-title">Holdings</h2>
        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="pb-2 font-medium">Symbol</th>
              <th className="pb-2 font-medium">Account</th>
              <th className="pb-2 text-right font-medium">Shares</th>
              <th className="pb-2 text-right font-medium">Price</th>
              <th className="pb-2 text-right font-medium">Value</th>
              <th className="pb-2 text-right font-medium">P/L</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody>
            {holdings.length === 0 && (
              <tr>
                <td colSpan={7} className="py-4 text-center text-muted-foreground">
                  No holdings yet.
                </td>
              </tr>
            )}

            {holdings.map((holding) => {
              const value = holding.shares * (holding.currentPrice ?? 0);
              const delta = percentChange(value, holding.costBasis);
              return (
                <tr key={holding.id} className="border-b border-border last:border-0">
                  <td className="py-2.5 font-medium text-foreground">{holding.symbol}</td>
                  <td className="py-2.5 text-muted-foreground">{holding.account.name}</td>
                  <td className="tnum py-2.5 text-right text-foreground/90">{holding.shares}</td>
                  <td className="tnum py-2.5 text-right text-foreground/90">
                    {holding.currentPrice ? formatCurrency(holding.currentPrice, "USD", 2) : "—"}
                  </td>
                  <td className="tnum py-2.5 text-right text-foreground">
                    <Private chars={5}>{formatCurrency(value)}</Private>
                  </td>
                  <td
                    className={`tnum py-2.5 text-right ${
                      delta === null ? "text-muted-foreground" : delta >= 0 ? "text-success" : "text-danger"
                    }`}
                  >
                    {delta === null ? "—" : `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%`}
                  </td>
                  <td className="py-2.5 pl-3 text-right">
                    <form action={deleteHolding}>
                      <input type="hidden" name="id" value={holding.id} />
                      <button
                        type="submit"
                        aria-label={`Delete ${holding.symbol}`}
                        className="cursor-pointer text-xs text-faint-foreground hover:text-danger"
                      >
                        ✕
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {investments.length > 0 && (
        <section className="mt-8">
          <h2 className="section-title">Positions</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Capital that is not a listed security — private deals, lending, business stakes.
            Amounts stay in their own currency.
          </p>

          <div className="mt-3 flex flex-col gap-2">
            {investments.map((investment) => {
              // Cost is the original amount plus every top-up; returns are what
              // has come back. Both are only summed within a single currency.
              const toppedUp = investment.topUps
                .filter((t) => t.currency === investment.currency)
                .reduce((sum, t) => sum + t.amount, 0);
              const returned = investment.returns
                .filter((r) => r.currency === investment.currency)
                .reduce((sum, r) => sum + r.amount, 0);
              const invested = investment.amount + toppedUp;
              const net = returned - invested;

              return (
                <div key={investment.id} className="card py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="block truncate font-medium text-foreground">
                        {investment.name}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {formatShortDate(investment.date)}
                        {investment.account && ` · ${investment.account.name}`}
                        {investment.kind && ` · ${investment.kind}`}
                      </span>
                    </div>
                    <StatusChip status={investment.status} />
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div>
                      <span className="block text-[11px] text-muted-foreground">Invested</span>
                      <span className="tnum text-sm text-foreground">
                        <Private chars={5}>
                          {formatCurrency(invested, investment.currency)}
                        </Private>
                      </span>
                      {toppedUp > 0 && (
                        <span className="block text-[10px] text-faint-foreground">
                          incl. {formatCurrency(toppedUp, investment.currency)} in top-ups
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="block text-[11px] text-muted-foreground">Returned</span>
                      <span className="tnum text-sm text-foreground">
                        <Private chars={5}>
                          {formatCurrency(returned, investment.currency)}
                        </Private>
                      </span>
                    </div>
                    <div>
                      <span className="block text-[11px] text-muted-foreground">Net</span>
                      <span
                        className={`tnum text-sm font-medium ${
                          net >= 0 ? "text-success" : "text-danger"
                        }`}
                      >
                        <Private chars={5}>{formatCurrency(net, investment.currency)}</Private>
                      </span>
                    </div>
                  </div>

                  {investment.notes && (
                    <p className="mt-2 text-xs text-muted-foreground">{investment.notes}</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="mt-6">
        <h2 className="section-title">Add or update a holding</h2>
        {investable.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Add a brokerage or crypto account first, on the Accounts tab.
          </p>
        ) : (
          <form action={upsertHolding} className="card mt-3 grid gap-3 sm:grid-cols-5">
            <div>
              <label htmlFor="accountId" className="field-label">
                Account
              </label>
              <select id="accountId" name="accountId" className="input mt-1">
                {investable.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="symbol" className="field-label">
                Symbol
              </label>
              <input id="symbol" name="symbol" required className="input mt-1" placeholder="VOO" />
            </div>
            <div>
              <label htmlFor="shares" className="field-label">
                Shares
              </label>
              <input id="shares" name="shares" type="number" step="any" required className="input mt-1" />
            </div>
            <div>
              <label htmlFor="costBasis" className="field-label">
                Cost basis
              </label>
              <input
                id="costBasis"
                name="costBasis"
                type="number"
                step="any"
                required
                className="input mt-1"
              />
            </div>
            <div>
              <label htmlFor="currentPrice" className="field-label">
                Price
              </label>
              <input id="currentPrice" name="currentPrice" type="number" step="any" className="input mt-1" />
            </div>
            <div className="sm:col-span-5">
              <button type="submit" className="btn-primary">
                Save holding
              </button>
            </div>
          </form>
        )}
      </section>
    </>
  );
}

// ---------------------------------------------------------------------------

async function AccountsTab() {
  const [accounts, currencies] = await Promise.all([getAccountsWithBalances(), getCurrenciesInUse()]);
  const multiCurrency = currencies.length > 1;

  return (
    <>
      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {accounts.length === 0 && (
          <div className="sm:col-span-2 lg:col-span-3">
            <EmptyState message="No accounts yet — add your first one below." />
          </div>
        )}

        {accounts.map((account) => {
          const synced = account.source === "finance-tracker";
          return (
            <div key={account.id} className="tile">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm text-foreground">{account.name}</span>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="badge px-2 py-0.5 text-[10px]">{account.kind}</span>
                  {/* Deleting a synced account is harmless — the next push
                      recreates it, keyed on the same externalId — but the
                      control is hidden anyway so it doesn't read as a real
                      action to take here. */}
                  {!synced && (
                    <form action={deleteAccount}>
                      <input type="hidden" name="id" value={account.id} />
                      <button
                        type="submit"
                        aria-label={`Delete ${account.name}`}
                        className="cursor-pointer text-xs text-faint-foreground hover:text-danger"
                      >
                        ✕
                      </button>
                    </form>
                  )}
                </div>
              </div>

              <span
                className={`tnum mt-3 block text-xl font-semibold ${
                  account.balance < 0 ? "text-danger" : "text-foreground"
                }`}
              >
                <Private chars={6}>{formatCurrency(account.balance, account.currency)}</Private>
              </span>

              {synced ? (
                <span className="mt-1 flex items-center gap-1 text-xs text-info">
                  <span className="h-1.5 w-1.5 rounded-full bg-info" aria-hidden="true" />
                  live from finance.arnayem.top
                </span>
              ) : (
                account.asOf && (
                  <span className="mt-1 block text-xs text-faint-foreground">
                    as of {formatDate(account.asOf)}
                  </span>
                )
              )}

              {!synced && (
                <form action={updateAccountBalance} className="mt-3 flex gap-1.5">
                  <input type="hidden" name="accountId" value={account.id} />
                  <input
                    name="balance"
                    type="number"
                    step="any"
                    placeholder="New balance"
                    aria-label={`Update balance for ${account.name}`}
                    className="input flex-1 px-2 py-1 text-xs"
                  />
                  <button type="submit" className="btn-ghost px-2.5 py-1 text-xs">
                    Save
                  </button>
                </form>
              )}
            </div>
          );
        })}
      </section>

      <p className="mt-3 text-xs text-faint-foreground">
        {multiCurrency
          ? "Each account shows its own balance in its own currency — see Overview for the per-currency totals, since there is no reliable rate to combine them."
          : "Net worth is the sum of each account's most recent balance."}{" "}
        Loans are stored as negative, so enter them as a positive number and the sign is handled
        for you.
      </p>

      <section className="mt-6">
        <h2 className="section-title">Add account</h2>
        <form action={createAccount} className="card mt-3 grid gap-3 sm:grid-cols-4">
          <div>
            <label htmlFor="name" className="field-label">
              Name
            </label>
            <input id="name" name="name" required className="input mt-1" />
          </div>
          <div>
            <label htmlFor="kind" className="field-label">
              Kind
            </label>
            <select id="kind" name="kind" className="input mt-1" defaultValue="bank">
              {ACCOUNT_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {kind}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="currency" className="field-label">
              Currency
            </label>
            <input
              id="currency"
              name="currency"
              maxLength={3}
              defaultValue="USD"
              className="input mt-1"
            />
          </div>
          <div>
            <label htmlFor="balance" className="field-label">
              Balance now
            </label>
            <input id="balance" name="balance" type="number" step="any" className="input mt-1" />
          </div>
          <div className="sm:col-span-4">
            <button type="submit" className="btn-primary">
              Add account
            </button>
          </div>
        </form>
      </section>
    </>
  );
}

// ---------------------------------------------------------------------------

async function LoansTab() {
  const loans = await getLoans();

  return (
    <>
      <section className="mt-6 flex flex-col gap-3">
        {loans.length === 0 && <EmptyState message="No loans tracked." />}
        {loans.map((loan) => {
          const paid = loan.principal - loan.balance;
          const percentPaid = loan.principal === 0 ? 0 : (paid / loan.principal) * 100;
          return (
            <div key={loan.id} className="card">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-foreground">{loan.name}</span>
                <div className="flex items-center gap-3">
                  <span className="tnum text-sm text-muted-foreground">
                    <Private chars={5}>{formatCurrency(loan.balance)}</Private> remaining
                  </span>
                  <form action={deleteLoan}>
                    <input type="hidden" name="id" value={loan.id} />
                    <button
                      type="submit"
                      aria-label={`Delete ${loan.name}`}
                      className="cursor-pointer text-xs text-faint-foreground hover:text-danger"
                    >
                      ✕
                    </button>
                  </form>
                </div>
              </div>

              <ProgressBar
                percent={percentPaid}
                color="var(--success)"
                className="mt-3"
                label={`${loan.name} paid off`}
              />

              <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span>{percentPaid.toFixed(0)}% paid off</span>
                {loan.interestRate !== null && <span>{loan.interestRate}% APR</span>}
                {loan.monthlyPayment !== null && (
                  <span>{formatCurrency(loan.monthlyPayment)}/mo</span>
                )}
                {loan.payoffDate && <span>Payoff {formatDate(loan.payoffDate)}</span>}
              </div>

              <form action={updateLoanBalance} className="mt-3 flex gap-1.5">
                <input type="hidden" name="id" value={loan.id} />
                <input
                  name="balance"
                  type="number"
                  step="any"
                  placeholder="New balance"
                  aria-label={`Update balance for ${loan.name}`}
                  className="input max-w-[200px] px-2 py-1 text-xs"
                />
                <button type="submit" className="btn-ghost px-2.5 py-1 text-xs">
                  Save
                </button>
              </form>
            </div>
          );
        })}
      </section>

      <section className="mt-6">
        <h2 className="section-title">Add loan</h2>
        <form action={createLoan} className="card mt-3 grid gap-3 sm:grid-cols-5">
          <div>
            <label htmlFor="name" className="field-label">
              Name
            </label>
            <input id="name" name="name" required className="input mt-1" />
          </div>
          <div>
            <label htmlFor="principal" className="field-label">
              Original amount
            </label>
            <input id="principal" name="principal" type="number" step="any" required className="input mt-1" />
          </div>
          <div>
            <label htmlFor="balance" className="field-label">
              Balance now
            </label>
            <input id="balance" name="balance" type="number" step="any" required className="input mt-1" />
          </div>
          <div>
            <label htmlFor="interestRate" className="field-label">
              APR %
            </label>
            <input id="interestRate" name="interestRate" type="number" step="any" className="input mt-1" />
          </div>
          <div>
            <label htmlFor="monthlyPayment" className="field-label">
              Payment/mo
            </label>
            <input id="monthlyPayment" name="monthlyPayment" type="number" step="any" className="input mt-1" />
          </div>
          <div className="sm:col-span-5">
            <button type="submit" className="btn-primary">
              Add loan
            </button>
          </div>
        </form>
      </section>
    </>
  );
}


// ---------------------------------------------------------------------------

async function TransfersTab() {
  const transfers = await getTransfers(50);

  return (
    <>
      <p className="page-subtitle mt-6">
        Money moved between your own accounts. Never counted as income or expense — a transfer
        would otherwise inflate both sides.
      </p>

      <section className="mt-4 flex flex-col gap-2">
        {transfers.length === 0 && <EmptyState message="No transfers recorded." />}

        {transfers.map((transfer) => {
          // A cross-currency transfer carries its own implied rate. Showing it
          // beats making the reader divide two numbers in their head.
          const crossCurrency = transfer.fromCurrency !== transfer.toCurrency;
          const impliedRate =
            crossCurrency && transfer.fromAmount !== 0
              ? transfer.toAmount / transfer.fromAmount
              : null;

          return (
            <div key={transfer.id} className="card py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-foreground/90">{transfer.fromAccount.name}</span>
                  <span className="text-faint-foreground">to</span>
                  <span className="text-foreground/90">{transfer.toAccount.name}</span>
                </span>
                <span className="text-xs text-faint-foreground">
                  {formatShortDate(transfer.date)}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-baseline gap-2 text-sm">
                <span className="tnum text-danger">
                  −<Private chars={5}>{formatCurrency(transfer.fromAmount, transfer.fromCurrency)}</Private>
                </span>
                <span className="text-faint-foreground">→</span>
                <span className="tnum text-success">
                  +<Private chars={5}>{formatCurrency(transfer.toAmount, transfer.toCurrency)}</Private>
                </span>
                {impliedRate !== null && (
                  <span className="text-[11px] text-muted-foreground">
                    @ {impliedRate.toFixed(4)} {transfer.toCurrency}/{transfer.fromCurrency}
                  </span>
                )}
              </div>

              {transfer.note && (
                <p className="mt-1 text-xs text-muted-foreground">{transfer.note}</p>
              )}
            </div>
          );
        })}
      </section>
    </>
  );
}
