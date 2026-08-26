import type { Metadata } from "next";
import { getOptionalUser } from "@/lib/session";
import { getTheme } from "@/lib/theme";
import { getPrivacyMode } from "@/lib/privacy";
import { Sidebar } from "@/components/sidebar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Personal life and business dashboard.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [authenticated, theme, privacy] = await Promise.all([
    getOptionalUser(),
    getTheme(),
    getPrivacyMode(),
  ]);

  return (
    <html lang="en" className={theme === "light" ? "light" : "dark"}>
      <body>
        {/* The login page renders through this same layout, so the shell is
            conditional rather than the layout being duplicated. */}
        {authenticated ? (
          <div className="min-h-screen">
            <Sidebar theme={theme} privacy={privacy} />
            <main className="lg:pl-60">{children}</main>
          </div>
        ) : (
          <main>{children}</main>
        )}
      </body>
    </html>
  );
}
