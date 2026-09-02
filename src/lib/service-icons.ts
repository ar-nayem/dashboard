// Fixed on purpose: the portfolio site maps each key to an already-imported
// phosphor-icons component. An arbitrary icon name here couldn't render
// anything there, so the <select> in src/app/services/page.tsx is
// restricted to exactly this set.
export const SERVICE_ICONS = [
  "ClipboardText",
  "Globe",
  "Package",
  "ChartLineUp",
  "Handshake",
  "Wallet",
] as const;

export type ServiceIcon = (typeof SERVICE_ICONS)[number];

export function isServiceIcon(value: string): value is ServiceIcon {
  return (SERVICE_ICONS as readonly string[]).includes(value);
}
