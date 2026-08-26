import Link from "next/link";
import { verifySession } from "@/lib/session";
import { MetricTile } from "@/components/metric-tile";
import { SegmentedControl } from "@/components/segmented-control";
import { EmptyState } from "@/components/empty-state";
import { AreaBadge, ClientChip, PriorityChip } from "@/components/chips";
import { Private } from "@/components/private";
import {
  MONEY_PERIODS,
  MONEY_PERIOD_OPTIONS,
  DAY_WINDOWS,
  DAY_WINDOW_OPTIONS,
  type MoneyPeriod,
  type DayWindow,
} from "@/lib/periods";
import { parseEnum } from "@/lib/enums";
import {
  getCurrentNetWorth,
  getHourlyRate,
  getIncome,
  getNetSavings,
  getSideProjectRevenue,
  getStocksValue,
} from "@/lib/data-finance";
import {
  getAppTotals,
  getAppsLaunchedThisYear,
  getContentThisWeek,
  getCurrentTrip,
  getExpiringDocuments,
  getRecentShips,
  getThisWeekTasks,
  getTodayTasks,
  getUpcomingBirthdays,
} from "@/lib/data-home";
import {
  daysUntil,
  formatCompactCurrency,
  formatDate,
  formatLongDate,
  formatNumber,
  formatRelative,
  formatShortDate,
  isOverdue,
} from "@/lib/format";

export const dynamic = "force-dynamic";

// The net-worth goal the tile measures against. Lives here rather than in the
// Goal table because the tile must render even with no goals defined.
const NET_WORTH_TARGET = 100_000;
const APPS_TARGET = 12;

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ income?: string; savings?: string; apps?: string }>;
}) {
  await verifySession();

  const params = await searchParams;
  const incomePeriod = parseEnum(MONEY_PERIODS, params.income) as MoneyPeriod;
  const savingsPeriod = parseEnum(MONEY_PERIODS, params.savings) as MoneyPeriod;
  const appsWindow = parseEnum(DAY_WINDOWS, params.apps) as DayWindow;

  const [
    netWorth,
    income,
    savings,
    sideProjects,
    hourlyRate,
    stocks,
    appTotals,
    appsLaunched,
    trip,
    todayTasks,
    weekTasks,
    ships,
    documents,
    birthdays,
    content,
  ] = await Promise.all([
    getCurrentNetWorth(),
    getIncome(incomePeriod),
    getNetSavings(savingsPeriod),
    getSideProjectRevenue("ytd"),
    getHourlyRate("mtd"),
    getStocksValue(),
    getAppTotals(Number(appsWindow)),
    getAppsLaunchedThisYear(),
    getCurrentTrip(),
    getTodayTasks(),
    getThisWeekTasks(),
    getRecentShips(),
    getExpiringDocuments(),
    getUpcomingBirthdays(),
    getContentThisWeek(),
  ]);

  // Toggles write their own search param and carry the others through, so
  // changing one tile's window doesn't reset the rest.
  const carry = { income: incomePeriod, savings: savingsPeriod, apps: appsWindow };

  return (
    <div className="page">
      <h1 className="page-title">Daily Briefing</h1>
      <p className="page-subtitle">{formatLongDate(new Date())}</p>

      {/* --- Metric tiles ------------------------------------------------ */}
      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricTile
          label="Net Worth"
          icon="$"
          value={formatCompactCurrency(netWorth)}
          target={formatCompactCurrency(NET_WORTH_TARGET)}
          progressPercent={(netWorth / NET_WORTH_TARGET) * 100}
        />

        <MetricTile
          label="Gross Income"
          icon="↗"
          value={formatCompactCurrency(income.current)}
          delta={income.delta}
          deltaGood={income.delta === null ? null : income.delta >= 0}
          toggle={
            <SegmentedControl
              options={MONEY_PERIOD_OPTIONS}
              value={incomePeriod}
              paramName="income"
              basePath="/"
              otherParams={carry}
              ariaLabel="Gross income period"
            />
          }
        />

        <MetricTile
          label="Net Savings"
          icon="◎"
          value={formatCompactCurrency(savings.current)}
          delta={savings.delta}
          deltaGood={savings.delta === null ? null : savings.delta >= 0}
          toggle={
            <SegmentedControl
              options={MONEY_PERIOD_OPTIONS}
              value={savingsPeriod}
              paramName="savings"
              basePath="/"
              otherParams={carry}
              ariaLabel="Net savings period"
            />
          }
        />

        <MetricTile
          label="Side Projects"
          icon="🧰"
          value={formatCompactCurrency(sideProjects.current)}
          footnote="Apps + Etsy · YTD"
        />

        <MetricTile
          label="Hourly Rate"
          icon="⏱"
          value={formatCompactCurrency(hourlyRate.current, "USD")}
          delta={hourlyRate.delta}
          deltaGood={hourlyRate.delta === null ? null : hourlyRate.delta >= 0}
          footnote="Estimated from client income ÷ assumed billable hours"
        />

        <MetricTile
          label="Stocks"
          icon="📈"
          value={formatCompactCurrency(stocks.value)}
          delta={stocks.delta}
          deltaGood={stocks.delta === null ? null : stocks.delta >= 0}
          deltaSuffix="vs cost"
          footnote="USD"
        />

        <MetricTile
          label="App Downloads"
          icon="⬇"
          value={formatNumber(appTotals.installs)}
          delta={appTotals.installsDelta}
          deltaGood={appTotals.installsDelta === null ? null : appTotals.installsDelta >= 0}
          deltaSuffix="vs prev"
          sensitive={false}
          toggle={
            <SegmentedControl
              options={DAY_WINDOW_OPTIONS}
              value={appsWindow}
              paramName="apps"
              basePath="/"
              otherParams={carry}
              ariaLabel="App metrics window"
            />
          }
        />

        <MetricTile
          label="App Revenue"
          icon="💵"
          value={formatCompactCurrency(appTotals.revenue)}
          delta={appTotals.revenueDelta}
          deltaGood={appTotals.revenueDelta === null ? null : appTotals.revenueDelta >= 0}
          deltaSuffix="vs prev"
        />

        <MetricTile
          label="12 Apps in 12 Months"
          icon="🚀"
          value={`${appsLaunched}`}
          target={`${APPS_TARGET}`}
          progressPercent={(appsLaunched / APPS_TARGET) * 100}
          progressColor="var(--info)"
          sensitive={false}
        />
      </section>

      {/* --- Currently in ------------------------------------------------ */}
      {trip && (
        <section className="mt-4">
          <div className="card flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-sm text-foreground">
              <span aria-hidden="true">📍</span>
              Currently in{" "}
              <strong className="font-semibold">
                {trip.city}, {trip.country}
              </strong>
            </span>
            <span className="text-right">
              <span className="tnum block text-xl font-semibold text-foreground">
                {Math.max(0, daysUntil(trip.endDate))}d
              </span>
              <span className="text-xs text-muted-foreground">remaining</span>
            </span>
          </div>
        </section>
      )}

      {/* --- Today ------------------------------------------------------- */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="section-title">Today</h2>
          <span className="text-xs text-muted-foreground">{todayTasks.length} tasks</span>
        </div>

        <div className="mt-3 flex flex-col gap-2">
          {todayTasks.length === 0 && <EmptyState message="Nothing due today — you're clear." />}

          {todayTasks.map((task) => (
            <div
              key={task.id}
              className="card flex items-center justify-between gap-3 py-3"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <span className="truncate text-sm font-medium text-foreground">{task.title}</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <PriorityChip priority={task.priority} />
                  <AreaBadge area={task.area} />
                  <ClientChip client={task.client} />
                  {task.dueDate && (
                    <span
                      className={`text-[11px] ${isOverdue(task.dueDate) ? "text-danger" : "text-muted-foreground"}`}
                    >
                      {isOverdue(task.dueDate) ? "Overdue " : "Due "}
                      {formatShortDate(task.dueDate)}
                    </span>
                  )}
                </div>
              </div>
              {task.sprint && (
                <span className="shrink-0 text-[11px] font-medium text-accent">⚡ Sprint</span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* --- This week --------------------------------------------------- */}
      {weekTasks.length > 0 && (
        <section className="mt-8">
          <h2 className="section-title">This week ({weekTasks.length})</h2>
          <div className="card mt-3 flex flex-col gap-2">
            {weekTasks.map((task) => (
              <div key={task.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-foreground/90">{task.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatShortDate(task.dueDate)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* --- Recently shipped -------------------------------------------- */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="section-title">🚢 Recently Shipped</h2>
          <Link href="/projects" className="text-xs text-muted-foreground hover:text-foreground">
            View all →
          </Link>
        </div>
        <div className="card mt-3 flex flex-col gap-2">
          {ships.length === 0 && <p className="text-sm text-muted-foreground">Nothing logged yet.</p>}
          {ships.map((ship) => (
            <div key={ship.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate text-foreground/90">
                <span aria-hidden="true" className="mr-1.5 text-accent">
                  ✦
                </span>
                {ship.title}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatRelative(ship.shippedAt)}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* --- Documents + birthdays --------------------------------------- */}
      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <div>
          <h2 className="section-title">📄 Documents &amp; Cards</h2>
          <div className="mt-3 flex flex-col gap-2">
            {documents.map((document) => {
              const days = document.expiresAt ? daysUntil(document.expiresAt) : null;
              // Under 60 days is the point where renewals need starting.
              const urgent = days !== null && days < 60;
              return (
                <div
                  key={document.id}
                  className="card flex items-center justify-between gap-3 py-3"
                >
                  <span className="truncate text-sm text-foreground/90">{document.name}</span>
                  <span className="shrink-0 text-right">
                    <span
                      className={`tnum block text-sm font-semibold ${urgent ? "text-danger" : "text-foreground"}`}
                    >
                      {days}d
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {formatShortDate(document.expiresAt)}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <h2 className="section-title">🎂 Upcoming Birthdays</h2>
          <div className="mt-3 flex flex-col gap-2">
            {birthdays.map((birthday) => (
              <div key={birthday.id} className="card flex items-center justify-between gap-3 py-3">
                <span className="flex items-center gap-2 truncate text-sm text-foreground/90">
                  {birthday.name}
                  {birthday.turningAge !== null && (
                    <span className="badge px-1.5 py-0 text-[10px]">{birthday.turningAge}</span>
                  )}
                </span>
                <span className="shrink-0 text-right">
                  <span className="tnum block text-sm font-semibold text-foreground">
                    {birthday.daysAway}d
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {formatDate(birthday.date).replace(/, \d{4}$/, "")}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- Content this week ------------------------------------------- */}
      <section className="mt-8">
        <h2 className="section-title">📣 Content This Week</h2>
        <div className="card mt-3 flex flex-wrap gap-3">
          {content.map((entry) => (
            <span key={entry.platform} className="badge">
              <Private chars={3}>{entry.posts}</Private>
              <span className="text-muted-foreground">{entry.platform}</span>
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
