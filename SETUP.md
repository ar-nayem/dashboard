# Dashboard — setup

A single-user personal dashboard. Next.js 16, Prisma 7, SQLite, no chart library.

## Running locally

```bash
npm install
cp .env.example .env      # then fill in SESSION_SECRET
npx prisma db push
npm run db:reset          # empty database, ready for your data
npm run set:password      # sets APP_PASSWORD_HASH — prompts, doesn't echo
npm run dev
```

Generate `SESSION_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Database commands

| Command | What it does |
|---|---|
| `npm run db:reset` | **Deletes everything**, then recreates only the integration registry. The intended starting state. |
| `npm run db:seed:demo` | Fills every table with invented placeholder data so the charts have a shape. Not real records. |
| `npm run db:push` | Applies schema changes to the database. |
| `npm run db:studio` | Prisma's table browser. |

## Entering your own data

Everything is enterable through the UI — nothing requires editing the database.

| What | Where |
|---|---|
| Areas, clients, documents, birthdays, exercises, shipped log | **Settings** |
| Accounts, balances, transactions, holdings, loans | **Finance** → Accounts / Income / Investments / Loans |
| Habits, goals, tasks, projects, videos, articles, trips, ideas | Their own tabs, at the bottom of each page |
| Health readings | **Health** → Log a reading |
| Workouts | **Fitness** → Start Workout |

## Automatic tracking

Each adapter stays switched off until its keys are in `.env`. The **Sync** tab
lists exactly what each one still needs.

### Entering keys

```bash
npm run setup:keys
```

Prompts for each credential, skipping any group you say no to, and writes
`.env` with `chmod 600`. Secrets are never echoed to the terminal.

For the two file-based credentials — the Google service account JSON and the
Apple `.p8` — give it the **path to the file** and it reads and escapes them
for you. Doing that by hand is the most common cause of a silent auth failure,
since both need their newlines escaped to survive a single-line `.env` value.

Re-running is safe: existing values are kept unless you type a new one, and
generated secrets are never regenerated.

> Never paste these keys into a chat window, an issue, or a commit. A leaked
> Stripe key moves money; an Apple `.p8` can only be downloaded once, so
> rotating it is genuinely painful.

| Source | Fills in | Needs |
|---|---|---|
| GitHub | Commit activity per project | One token |
| Google Analytics | Daily unique visitors | Service account JSON |
| Search Console | Impressions, clicks, position | Same service account |
| App Store Connect | Installs, developer proceeds | Issuer ID, key ID, `.p8`, vendor number |
| RevenueCat | MRR, subscriptions, trials | One secret key |
| Stripe | Charges → income | One restricted key |
| YouTube | Subscribers, daily views | API key + channel ID |
| Apple Health | Weight, HR, HRV, steps | Webhook secret + an iOS Shortcut |

After adding keys, **also set each project's external IDs** on its own page
(Projects → a project → Data sources). Without them an adapter has no way to
know which repo or property belongs to which project, and it will say so
rather than guessing.

### Two honest caveats

- **YouTube and RevenueCat only expose current totals**, not per-day history.
  Both record one snapshot per day, so their charts start filling from the
  first sync — the app never fabricates history it wasn't given.
- **GitHub reports weekly commit totals.** Those are spread evenly across the
  week's days so the shape is right, but a single day's figure is an estimate.

## Deploying to a server with cron

### 1. Get the code onto the box

```bash
git clone <your-repo> /var/www/dashboard
cd /var/www/dashboard
npm ci
```

### 2. Configure

```bash
cp .env.example .env
```

Fill in `SESSION_SECRET`, `APP_PASSWORD_HASH`, `CRON_SECRET`, and whichever
integration keys you have. Lock the file down — it holds every secret:

```bash
chmod 600 .env
```

### 3. Build and start

```bash
npx prisma db push
npm run db:reset
npm run build
pm2 start npm --name dashboard -- start
pm2 save
```

SQLite is genuinely fine here: one user, one process, one file. Back it up by
copying `dev.db`.

> If you later run more than one app process, move to Postgres first — SQLite
> does not tolerate concurrent writers from separate processes.

### 4. Put it behind TLS

Serve it through nginx with a Let's Encrypt certificate. The session cookie is
set `secure` in production, so **the app will not log you in over plain HTTP**.

### 5. Schedule the sync

```bash
crontab -e
```

Every six hours:

```
0 */6 * * * curl -fsS -m 280 -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-host/api/cron >> /var/log/dashboard-sync.log 2>&1
```

The endpoint returns `200` when everything succeeded and `207` when some
adapters failed, so `curl -f` surfaces real problems. Every run is recorded in
the database and shown under **Sync → Recent runs**, including how many rows
each adapter actually wrote.

### 6. Apple Health (optional)

On the phone: Shortcuts → new shortcut → **Find Health Samples** → **Get
Contents of URL**.

- URL `https://your-host/api/health-webhook`
- Method `POST`
- Header `x-webhook-secret` = your `HEALTH_WEBHOOK_SECRET`
- Body (JSON):

```json
{ "readings": [ { "type": "weight", "value": 74.2, "date": "2026-08-25" } ] }
```

Valid `type` values: `weight`, `resting_hr`, `hrv`, `vo2max`, `steps`,
`active_energy`, `sleep`. Then add a daily trigger under the Automation tab.

## Changing the password

Day to day, do it from inside the app: **Settings → Security**. It asks for
the current password, takes effect immediately for future logins, and needs
neither SSH nor a restart — a running server can't rewrite its own `.env`,
so this writes to a small `AppSetting` database row instead, which
`getStoredPasswordHash()` (`src/lib/password.ts`) checks before falling back
to `APP_PASSWORD_HASH`. That row always wins once it exists.

Locked out and can't get to Settings? That's what the SSH path is for:

```bash
npm run set:password
```

This is the **only** thing that can reset a forgotten password, since the
in-app form requires knowing the current one. It rewrites `.env` and — this
part matters — also deletes the `AppSetting` row, so `.env` actually takes
back over. Skipping that second step would make the reset silently do
nothing, since the in-app row would keep outranking it.

`npm run db:reset` never touches either of these: `AppSetting` is excluded
on purpose (it's auth configuration, not personal data) so wiping your
records can never revert your password out from under you as a side effect.

## Security notes

- One shared password, no user table. Rotating the password does **not**
  invalidate existing sessions — rotate `SESSION_SECRET` to force everyone out.
- `/api/cron` and `/api/health-webhook` authenticate with constant-time secret
  comparison and refuse all requests when their secret is unset.
- The privacy toggle (the eye icon) masks values **server-side**, so hidden
  numbers are never sent to the browser at all.
