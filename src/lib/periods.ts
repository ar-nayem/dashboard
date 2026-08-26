import {
  endOfMonth,
  endOfYear,
  startOfDay,
  startOfMonth,
  startOfYear,
  subDays,
  subMonths,
  subYears,
} from "date-fns";

// The MTD / Prev / YTD toggle that sits on the money tiles.
export const MONEY_PERIODS = ["mtd", "prev", "ytd"] as const;
export type MoneyPeriod = (typeof MONEY_PERIODS)[number];

export const MONEY_PERIOD_OPTIONS = [
  { value: "mtd", label: "MTD" },
  { value: "prev", label: "Prev" },
  { value: "ytd", label: "YTD" },
];

// The 7D / 30D / 365D toggle on project tiles.
export const DAY_WINDOWS = ["7", "30", "365"] as const;
export type DayWindow = (typeof DAY_WINDOWS)[number];

export const DAY_WINDOW_OPTIONS = [
  { value: "7", label: "7D" },
  { value: "30", label: "30D" },
  { value: "365", label: "365D" },
];

// The 7d / 28d / 90d / All toggle on social analytics.
export const SOCIAL_WINDOWS = ["7", "28", "90", "all"] as const;
export type SocialWindow = (typeof SOCIAL_WINDOWS)[number];

export const SOCIAL_WINDOW_OPTIONS = [
  { value: "7", label: "7d" },
  { value: "28", label: "28d" },
  { value: "90", label: "90d" },
  { value: "all", label: "All" },
];

export type Range = { start: Date; end: Date };

/**
 * The date range for a money period, plus the range it should be compared
 * against for the year-over-year delta.
 *
 * - mtd:  this month so far      vs the same month last year
 * - prev: all of last month      vs that month last year
 * - ytd:  this year so far       vs the same span last year
 */
export function moneyRange(period: MoneyPeriod, now = new Date()): { current: Range; previous: Range } {
  const today = startOfDay(now);

  if (period === "prev") {
    const lastMonth = subMonths(today, 1);
    const start = startOfMonth(lastMonth);
    const end = endOfMonth(lastMonth);
    return {
      current: { start, end },
      previous: { start: subYears(start, 1), end: subYears(end, 1) },
    };
  }

  if (period === "ytd") {
    const start = startOfYear(today);
    return {
      current: { start, end: today },
      previous: { start: subYears(start, 1), end: subYears(today, 1) },
    };
  }

  const start = startOfMonth(today);
  return {
    current: { start, end: today },
    previous: { start: subYears(start, 1), end: subYears(today, 1) },
  };
}

/** Trailing N-day window ending today, plus the N days before it. */
export function dayRange(days: number, now = new Date()): { current: Range; previous: Range } {
  const end = startOfDay(now);
  const start = subDays(end, days - 1);
  return {
    current: { start, end },
    previous: { start: subDays(start, days), end: subDays(start, 1) },
  };
}

/** Full calendar year containing `now` — the x domain of the trajectory chart. */
export function yearRange(now = new Date()): Range {
  return { start: startOfYear(now), end: endOfYear(now) };
}

export function labelForMoneyPeriod(period: MoneyPeriod): string {
  return period === "mtd" ? "MTD" : period === "prev" ? "Prev month" : "YTD";
}
