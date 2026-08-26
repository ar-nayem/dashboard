// Renders the path data from lib/nav.ts. Stroke-only on a 24x24 grid so every
// icon shares one weight and inherits currentColor from the nav link.
export function NavIcon({ path, className = "" }: { path: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`h-[18px] w-[18px] shrink-0 ${className}`}
    >
      <path d={path} />
    </svg>
  );
}
