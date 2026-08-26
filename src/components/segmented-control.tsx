import Link from "next/link";

export type SegmentOption = { value: string; label: string };

/**
 * The MTD / Prev / YTD and 7D / 30D / 365D toggles.
 *
 * Implemented as links that set a search param rather than client state, so
 * the page stays a Server Component and the selected window survives a
 * reload or a shared URL. `paramName` is the query key each option writes.
 */
export function SegmentedControl({
  options,
  value,
  paramName,
  basePath,
  otherParams,
  className = "",
  ariaLabel,
}: {
  options: SegmentOption[];
  value: string;
  paramName: string;
  basePath: string;
  /** Other search params to carry through, so toggles don't clobber each other. */
  otherParams?: Record<string, string | undefined>;
  className?: string;
  ariaLabel?: string;
}) {
  function hrefFor(optionValue: string) {
    const params = new URLSearchParams();
    for (const [key, entry] of Object.entries(otherParams ?? {})) {
      if (entry) params.set(key, entry);
    }
    params.set(paramName, optionValue);
    return `${basePath}?${params.toString()}`;
  }

  return (
    <div className={`segment ${className}`} role="group" aria-label={ariaLabel ?? paramName}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Link
            key={option.value}
            href={hrefFor(option.value)}
            scroll={false}
            aria-current={active ? "true" : undefined}
            className={`segment-item ${active ? "segment-item-active" : ""}`}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}
