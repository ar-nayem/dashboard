// The integration registry. These rows are infrastructure, not user data —
// they exist so the Sync page has something to list, and they are recreated
// by both `db:reset` and the demo seed.
//
// Keep the keys in sync with ADAPTERS in src/lib/integrations.ts.
export const INTEGRATION_SEED = [
  { key: "github", name: "GitHub", status: "never", sortOrder: 0 },
  { key: "google_analytics", name: "Google Analytics", status: "never", sortOrder: 1 },
  { key: "search_console", name: "Google Search Console", status: "never", sortOrder: 2 },
  { key: "app_store", name: "App Store Connect", status: "never", sortOrder: 3 },
  { key: "revenuecat", name: "RevenueCat", status: "never", sortOrder: 4 },
  { key: "stripe", name: "Stripe", status: "never", sortOrder: 5 },
  { key: "youtube", name: "YouTube", status: "never", sortOrder: 6 },
  { key: "ibkr", name: "IBKR Portfolio", status: "never", sortOrder: 7 },
  { key: "apple_health", name: "Apple Health", status: "never", sortOrder: 8 },
];
