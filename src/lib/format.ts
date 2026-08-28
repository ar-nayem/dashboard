import { differenceInCalendarDays, format, formatDistanceToNow, isBefore, startOfDay } from "date-fns";

// "Jan 5, 2026"
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  return format(new Date(date), "MMM d, yyyy");
}

// "Jan 5" — for axis ticks and dense list rows where the year is noise.
export function formatShortDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  return format(new Date(date), "MMM d");
}

// "Saturday, July 11" — the daily-briefing subtitle.
export function formatLongDate(date: Date | string): string {
  return format(new Date(date), "EEEE, MMMM d");
}

// True when the date is strictly before the start of today. Undated items are
// never overdue.
export function isOverdue(dueDate: Date | string | null | undefined): boolean {
  if (!dueDate) return false;
  return isBefore(new Date(dueDate), startOfDay(new Date()));
}

// "3 days ago" / "in 2 hours"
export function formatRelative(date: Date | string | null | undefined): string {
  if (!date) return "";
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

// Whole days from today to `date`. Negative once the date has passed.
// Used by the document-expiry and birthday countdown widgets.
export function daysUntil(date: Date | string): number {
  return differenceInCalendarDays(new Date(date), startOfDay(new Date()));
}

// Intl throws a RangeError on anything that is not a 3-letter code, and these
// formatters run inside server components — one malformed currency on one row
// would otherwise crash the whole page render rather than mis-render a cell.
// Mirrored data comes from an app whose currency field is free text, so this
// is a real input, not a hypothetical one.
function safeCurrencyFormat(
  value: number,
  currency: string,
  options: Intl.NumberFormatOptions,
): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, ...options }).format(
      value,
    );
  } catch {
    // Fall back to a plain number with the raw code appended, so the figure
    // still reads correctly and the bad code is visible rather than hidden.
    const formatted = new Intl.NumberFormat("en-US", options).format(value);
    return currency ? `${formatted} ${currency}` : formatted;
  }
}

// "$1,234" by default; pass decimals for cents.
export function formatCurrency(value: number, currency = "USD", decimals = 0): string {
  return safeCurrencyFormat(value, currency, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// "$1.2k" / "$140.0k" / "$1.4M" — the metric tiles are too narrow for full
// numbers.
export function formatCompactCurrency(value: number, currency = "USD"): string {
  return safeCurrencyFormat(value, currency, {
    notation: "compact",
    maximumFractionDigits: 1,
  });
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

// "+12.3%" / "-4.0%" — always signed, since these only ever appear as deltas.
export function formatPercentDelta(value: number, decimals = 1): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}

// Percent change from `previous` to `current`.
//
// Returns null when previous is 0: the change from nothing to something has
// no meaningful percentage, and returning Infinity would render as "+∞%".
// Callers show a dash instead.
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

// Seconds to "1:05:22" or "16:04" — the live-workout timer.
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
}

// "38m" / "2h 20m" — workout durations in the history list.
export function formatDurationShort(totalSeconds: number): string {
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}
