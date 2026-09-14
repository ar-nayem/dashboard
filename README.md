# Dashboard

A single private dashboard that runs both a personal life-tracking system and the
public content CMS for [arnayem.top](https://arnayem.top) — one app, one login, one
SQLite database.

Live at [arnayem.top/dashboard](https://arnayem.top/dashboard).

## What it does

**Personal side** — goals, habits, todos, journal/ideas, fitness, health, media
(written/video watch lists), projects and an itinerary planner, all in one place
instead of scattered across separate apps.

**Business side** — the CMS behind the public portfolio site: Work items, Blog
posts, Services, FAQ and Photography, authored here and rendered on the live site.

**Finance sync** — receives a live push from [finance-tracker](https://github.com/ar-nayem/finance-tracker)
via a Prisma hook whenever a transaction is added there, so balances stay current
without a manual import. Multi-tenant aware: sync is gated on both the sender and
receiver side, and per-currency totals (RMB/BDT) are never summed together.

**Integrations** — a settings area walks through connecting external services
(Google service account, Apple credentials) and storing them safely.

## Stack

Next.js 16 (App Router) · Prisma 7 + better-sqlite3 · Tailwind CSS 4 · TypeScript

## Getting started

```bash
npm install
npm run set:password   # sets the single login password (scrypt hash, nothing plaintext)
npm run db:reset        # empty DB in the intended starting state
npm run db:seed:demo    # optional generic placeholder data
npm run dev
```

`APP_PASSWORD_HASH` starts empty on purpose — every route stays locked until
`set:password` is run once. `BASE_PATH` controls whether the app serves from `/`
(local dev) or a subpath like `/dashboard` (production).
