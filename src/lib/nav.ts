// Single source of truth for the sidebar. Adding a tab means adding a row
// here plus the matching route folder under src/app — nothing else.
export type NavItem = {
  href: string;
  label: string;
  /** Inline SVG path data, drawn on a 24x24 viewBox by <NavIcon>. */
  icon: string;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home", icon: "M3 10.5 12 3l9 7.5M5.25 9.75V21h13.5V9.75" },
  { href: "/habits", label: "Habits", icon: "M17 3l4 4-4 4M21 7H8a4 4 0 0 0-4 4M7 21l-4-4 4-4M3 17h13a4 4 0 0 0 4-4" },
  { href: "/fitness", label: "Fitness", icon: "M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11" },
  { href: "/health", label: "Health", icon: "M12 20.5S3.5 15 3.5 9.2A4.7 4.7 0 0 1 12 6.4a4.7 4.7 0 0 1 8.5 2.8c0 5.8-8.5 11.3-8.5 11.3Z" },
  { href: "/todos", label: "Todos", icon: "M4 4.5h16v15H4zM8.5 12l2.25 2.25L15.5 9.5" },
  { href: "/finance", label: "Finance", icon: "M3 17.5 9.5 11l4 4L21 7.5M21 7.5h-4.5M21 7.5V12" },
  { href: "/projects", label: "Projects", icon: "M3 7.5h7l1.75 2.5H21v9.5H3zM3 7.5V5h5.5l1.5 2.5" },
  { href: "/video", label: "Video", icon: "M3 6.5h12v11H3zM15 10.5l6-3.5v10l-6-3.5z" },
  { href: "/media", label: "Media", icon: "M4 5.5h16v13H4zM4 15l4.5-4.5 3 3L16 9l4 4M9 9.5a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5Z" },
  { href: "/written", label: "Written", icon: "M6 3.5h8.5L19 8v12.5H6zM14 3.5V8h5M9 12.5h7M9 16h7" },
  { href: "/itinerary", label: "Itinerary", icon: "M12 21.5s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" },
  { href: "/goals", label: "Goals", icon: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Z M12 13.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" },
  { href: "/ideas", label: "Ideas", icon: "M9.5 18.5h5M10 21.5h4M12 2.5a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.9v.2h5v-.2c0-.8.4-1.5 1-1.9A6 6 0 0 0 12 2.5Z" },
  { href: "/sync", label: "Sync", icon: "M20.5 12a8.5 8.5 0 0 1-14.6 5.9M3.5 12a8.5 8.5 0 0 1 14.6-5.9M18.5 3v3.5H15M5.5 21v-3.5H9" },
  { href: "/settings", label: "Settings", icon: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-3-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.3 5l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.9-1.2V1a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.2a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.6 1Z" },
];

// Longest-prefix match, so /projects/goalbar keeps Projects highlighted while
// "/" only ever matches the home route exactly.
export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
