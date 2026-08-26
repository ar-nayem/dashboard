import { getPrivacyMode } from "@/lib/privacy";

// Masks a sensitive value when privacy mode is on. This is a Server
// Component, so the real value is never serialised into the HTML while
// masked — the browser only ever receives the dots.
//
//   <Private>{formatCurrency(netWorth)}</Private>
//
// `chars` controls how many dots stand in, so a masked value keeps roughly
// the width of the real one and tiles don't reflow when you toggle.
export async function Private({
  children,
  chars = 6,
}: {
  children: React.ReactNode;
  chars?: number;
}) {
  const isPrivate = await getPrivacyMode();
  if (!isPrivate) return <>{children}</>;
  return (
    <span
      aria-label="Hidden while privacy mode is on"
      className="text-muted-foreground select-none"
    >
      {"•".repeat(chars)}
    </span>
  );
}
