import type { Adapter } from "./types";
import { runGitHub } from "./adapters/github";
import { runYouTube } from "./adapters/youtube";
import { runStripe } from "./adapters/stripe";
import { runGoogleAnalytics } from "./adapters/google-analytics";
import { runSearchConsole } from "./adapters/search-console";
import { runAppStore } from "./adapters/app-store";
import { runRevenueCat } from "./adapters/revenuecat";
import { runFinanceTracker } from "./adapters/finance-tracker";

/**
 * Every data source the app knows about.
 *
 * `credentials` drives the Sync page's setup checklist, so the hints are
 * written to be followed literally by someone who has never opened that
 * provider's console before.
 */
export const ADAPTERS: Adapter[] = [
  {
    key: "github",
    name: "GitHub",
    staleAfterHours: 24,
    note: "Commit activity per repo → Projects.",
    implemented: true,
    credentials: [
      {
        env: "GITHUB_TOKEN",
        hint: "github.com/settings/personal-access-tokens → Generate new token → grant read-only Contents + Metadata on the repos you want.",
      },
    ],
    run: runGitHub,
  },
  {
    key: "google_analytics",
    name: "Google Analytics",
    staleAfterHours: 24,
    note: "Daily unique visitors and active users → Projects.",
    implemented: true,
    credentials: [
      {
        env: "GA_SERVICE_ACCOUNT_JSON",
        hint: "Google Cloud console → IAM → Service Accounts → create one → Keys → Add key (JSON). Paste the whole file as one line. Then enable the Google Analytics Data API for the project.",
      },
    ],
    run: runGoogleAnalytics,
  },
  {
    key: "search_console",
    name: "Google Search Console",
    staleAfterHours: 24,
    note: "Impressions, clicks, average position → Projects.",
    implemented: true,
    credentials: [
      {
        env: "GA_SERVICE_ACCOUNT_JSON",
        hint: "Same service account as Analytics. Add its email as a user on each Search Console property, and enable the Search Console API.",
      },
    ],
    run: runSearchConsole,
  },
  {
    key: "app_store",
    name: "App Store Connect",
    staleAfterHours: 24,
    note: "Installs and developer proceeds per app → Projects.",
    implemented: true,
    credentials: [
      {
        env: "ASC_ISSUER_ID",
        hint: "App Store Connect → Users and Access → Integrations → App Store Connect API. The issuer ID is above the key list.",
      },
      { env: "ASC_KEY_ID", hint: "The Key ID column next to the key you generated." },
      {
        env: "ASC_PRIVATE_KEY",
        hint: "Contents of the downloaded .p8 file, as one line with newlines written as \\n. Apple lets you download it once only.",
      },
      {
        env: "ASC_VENDOR_NUMBER",
        hint: "App Store Connect → Payments and Financial Reports — the number shown next to your name.",
      },
    ],
    run: runAppStore,
  },
  {
    key: "revenuecat",
    name: "RevenueCat",
    staleAfterHours: 24,
    note: "MRR, active subscriptions and trials → Projects.",
    implemented: true,
    credentials: [
      {
        env: "REVENUECAT_API_KEY",
        hint: "RevenueCat → Project settings → API keys → a v2 secret key (starts with sk_).",
      },
    ],
    run: runRevenueCat,
  },
  {
    key: "stripe",
    name: "Stripe",
    staleAfterHours: 24,
    note: "Successful charges → Finance income.",
    implemented: true,
    credentials: [
      {
        env: "STRIPE_SECRET_KEY",
        hint: "Stripe → Developers → API keys → create a restricted key with read access to Charges. A full secret key works too but grants far more than needed.",
      },
    ],
    run: runStripe,
  },
  {
    key: "youtube",
    name: "YouTube",
    staleAfterHours: 24,
    note: "Subscribers and daily views → Video analytics.",
    implemented: true,
    credentials: [
      {
        env: "YOUTUBE_API_KEY",
        hint: "Google Cloud console → enable YouTube Data API v3 → Credentials → Create API key.",
      },
      {
        env: "YOUTUBE_CHANNEL_ID",
        hint: 'Your channel ID, starting with "UC". YouTube Studio → Settings → Channel → Advanced settings.',
      },
    ],
    run: runYouTube,
  },
  {
    key: "finance_tracker",
    name: "finance.arnayem.top",
    // Polled every 5 minutes by cron, so anything older than an hour means
    // the job stopped rather than that you simply haven't entered anything.
    staleAfterHours: 1,
    note: "Accounts, transactions, investments and transfers → Finance. One-way mirror; enter data at the source.",
    implemented: true,
    credentials: [
      {
        env: "FINANCE_TRACKER_DB",
        hint: "Absolute path to that app's SQLite file on this server — /root/finance-tracker/dev.db. Opened read-only.",
      },
      {
        env: "FINANCE_TRACKER_USER_EMAIL",
        hint: "Which account to mirror. That install is multi-tenant, so only this user's rows are copied.",
      },
    ],
    run: runFinanceTracker,
  },
  {
    key: "apple_health",
    name: "Apple Health",
    staleAfterHours: 48,
    // Apple exposes no server API for Health data, so this source pushes to
    // the app rather than being polled — hence pushOnly and no run().
    note: "Weight, HR, HRV, steps → Health. Pushed from an iOS Shortcut; there is nothing to pull.",
    implemented: true,
    pushOnly: true,
    credentials: [
      {
        env: "HEALTH_WEBHOOK_SECRET",
        hint: "Any long random string you invent. The iOS Shortcut sends it as the x-webhook-secret header so only your phone can post readings.",
      },
    ],
    run: async () => ({
      ok: false,
      error: "Apple Health pushes data in. Configure the iOS Shortcut instead of syncing here.",
    }),
  },
];

export function getAdapter(key: string): Adapter | undefined {
  return ADAPTERS.find((adapter) => adapter.key === key);
}
