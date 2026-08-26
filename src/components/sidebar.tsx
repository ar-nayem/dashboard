"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { NAV_ITEMS, isNavItemActive } from "@/lib/nav";
import { NavIcon } from "@/components/nav-icon";
import { logout } from "@/lib/auth-actions";
import { setTheme } from "@/lib/theme-actions";
import { togglePrivacy } from "@/lib/privacy-actions";
import type { Theme } from "@/lib/theme";

const EYE_OPEN =
  "M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z M12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z";
const EYE_OFF = "M3 3l18 18M10.6 10.7a2.5 2.5 0 0 0 3.4 3.6M6.5 6.7A11.7 11.7 0 0 0 2.5 12s3.5 6.5 9.5 6.5c1.6 0 3-.4 4.2-1M18.9 15.4A11.9 11.9 0 0 0 21.5 12S18 5.5 12 5.5c-.7 0-1.3.1-1.9.2";
const REFRESH = "M20.5 12a8.5 8.5 0 0 1-14.6 5.9M3.5 12a8.5 8.5 0 0 1 14.6-5.9M18.5 3v3.5H15M5.5 21v-3.5H9";

export function Sidebar({ theme, privacy }: { theme: Theme; privacy: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const navLinks = (
    <nav className="flex flex-col gap-0.5">
      {NAV_ITEMS.map((item) => {
        const active = isNavItemActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
              active
                ? "bg-surface-hover text-foreground"
                : "text-muted-foreground hover:bg-surface-hover/60 hover:text-foreground"
            }`}
          >
            <NavIcon path={item.icon} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const header = (
    <div className="flex items-center gap-2 px-3">
      <Link href="/" className="flex-1 text-xl font-semibold tracking-tight text-foreground">
        Dashboard
      </Link>

      {/* Server Components read fresh data on every navigation, so a refresh
          is just router.refresh() — no client cache to invalidate. */}
      <button
        type="button"
        onClick={() => router.refresh()}
        title="Refresh data"
        aria-label="Refresh data"
        className="cursor-pointer rounded-md p-1 text-muted-foreground transition-colors duration-150 hover:bg-surface-hover hover:text-foreground"
      >
        <NavIcon path={REFRESH} className="h-4 w-4" />
      </button>

      <form action={togglePrivacy}>
        <input type="hidden" name="privacy" value={privacy ? "off" : "on"} />
        <button
          type="submit"
          title={privacy ? "Show values" : "Hide values"}
          aria-label={privacy ? "Show values" : "Hide values"}
          aria-pressed={privacy}
          className="cursor-pointer rounded-md p-1 text-muted-foreground transition-colors duration-150 hover:bg-surface-hover hover:text-foreground"
        >
          <NavIcon path={privacy ? EYE_OFF : EYE_OPEN} className="h-4 w-4" />
        </button>
      </form>
    </div>
  );

  const footer = (
    <div className="flex items-center gap-2 border-t border-border px-3 pt-3">
      <form action={setTheme}>
        <input type="hidden" name="theme" value={theme === "dark" ? "light" : "dark"} />
        <button
          type="submit"
          className="btn-ghost px-2.5 py-1.5 text-xs"
          aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
      </form>
      <form action={logout} className="flex-1">
        <button type="submit" className="btn-ghost w-full px-2.5 py-1.5 text-xs">
          Logout
        </button>
      </form>
    </div>
  );

  return (
    <>
      {/* Mobile top bar — the sidebar itself is hidden below lg. */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-surface px-4 py-3 lg:hidden">
        <Link href="/" className="text-lg font-semibold tracking-tight text-foreground">
          Dashboard
        </Link>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          className="btn-ghost px-2.5 py-1.5"
        >
          {open ? "✕" : "☰"}
        </button>
      </div>

      {open && (
        <div className="border-b border-border bg-surface px-4 py-3 lg:hidden">
          {header}
          <div className="mt-3">{navLinks}</div>
          <div className="mt-3">{footer}</div>
        </div>
      )}

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col gap-4 border-r border-border bg-surface py-5 lg:flex">
        {header}
        <div className="flex-1 overflow-y-auto px-3">{navLinks}</div>
        {footer}
      </aside>
    </>
  );
}
