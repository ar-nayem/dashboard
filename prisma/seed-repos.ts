#!/usr/bin/env -S npx tsx
// Seeds/reseeds the Repo table from the GitHub portfolio cleanup. Idempotent
// (upsert on slug), safe to rerun after editing this file to add a repo.
// Run via tsx (not plain node) — same reason as scripts/set-password.ts: the
// generated Prisma client is TypeScript, not compiled JS.
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
const prisma = new PrismaClient({ adapter });

const REPOS = [
  {
    slug: "student-portal",
    name: "Student Portal",
    description:
      "Multi-tenant SaaS for study-abroad agencies: applications, documents, campaigns, billing.",
    category: "saas",
    tech: "Next.js,Prisma,SQLite,NextAuth,Tailwind",
    githubUrl: "https://github.com/ar-nayem/student-portal",
    liveUrl: "https://portal.arnayem.top",
    status: "live",
    pm2Name: "student-portal",
    public: true,
  },
  {
    slug: "salonbd",
    name: "SalonBD",
    description:
      "Barber & salon booking marketplace for Bangladesh — shop discovery, booking, owner dashboard, platform admin.",
    category: "marketplace",
    tech: "Next.js,Prisma,Tailwind",
    githubUrl: "https://github.com/ar-nayem/salonbd",
    liveUrl: "https://salon.arnayem.top",
    status: "live",
    pm2Name: "salonbd",
    public: true,
  },
  {
    slug: "localfoodhub",
    name: "Local Food Hub",
    description:
      "Multi-vendor local food marketplace — QR ordering, delivery/pickup/dine-in, vendor dashboard, platform admin.",
    category: "marketplace",
    tech: "Next.js,Prisma,Tailwind",
    githubUrl: "https://github.com/ar-nayem/localfoodhub",
    liveUrl: "https://menu.arnayem.top",
    status: "live",
    pm2Name: "localfoodhub",
    public: true,
  },
  {
    slug: "scanserve",
    name: "ScanServe",
    description: "QR code ordering & payment system for restaurants and food carts.",
    category: "marketplace",
    tech: "Next.js,QR codes",
    githubUrl: "https://github.com/ar-nayem/scanserve",
    liveUrl: null,
    status: "superseded",
    pm2Name: "scanserve",
    public: true,
  },
  {
    slug: "marketiachina",
    name: "Marketia China",
    description:
      "E-commerce storefront & admin panel — plain Node/Express, SQLite, manual payment verification.",
    category: "marketplace",
    tech: "Node.js,Express,SQLite",
    githubUrl: "https://github.com/ar-nayem/marketiachina",
    liveUrl: "https://marketiachina.arnayem.top",
    status: "live",
    pm2Name: "marketiachina",
    public: true,
  },
  {
    slug: "dashboard",
    name: "Dashboard",
    description: "Personal & business life dashboard — content CMS, finance sync, goals, integrations.",
    category: "personal",
    tech: "Next.js,Prisma,Tailwind",
    githubUrl: "https://github.com/ar-nayem/dashboard",
    liveUrl: "https://arnayem.top/dashboard",
    status: "live",
    pm2Name: "dashboard",
    public: true,
  },
  {
    slug: "finance-tracker",
    name: "Finance Tracker",
    description: "Personal & multi-tenant finance tracker — accounts, budgets, reports, PWA, live sync to dashboard.",
    category: "personal",
    tech: "Next.js,Prisma,Recharts,PWA",
    githubUrl: "https://github.com/ar-nayem/finance-tracker",
    liveUrl: "https://finance.arnayem.top",
    status: "live",
    pm2Name: "finance-tracker",
    public: true,
  },
  {
    slug: "hsk4-practice",
    name: "HSK4 Practice",
    description: "Offline HSK4 exam practice app with account sync — vanilla JS + Express/SQLite server, Android build.",
    category: "education",
    tech: "JavaScript,Express,SQLite,Android",
    githubUrl: "https://github.com/ar-nayem/hsk4-practice",
    liveUrl: "https://hsk.arnayem.top",
    status: "live",
    pm2Name: "hsk4",
    public: true,
  },
  {
    slug: "schedule",
    name: "Schedule → Calendar",
    description: "Turn a screenshot of a class timetable into an .ics calendar file — no login, no Google API.",
    category: "education",
    tech: "Express,OCR",
    githubUrl: "https://github.com/ar-nayem/schedule",
    liveUrl: "https://schedule.arnayem.top",
    status: "live",
    pm2Name: null,
    public: true,
  },
  {
    slug: "lead-crm",
    name: "Lead CRM",
    description: "Personal lead CRM — pipeline tracking, automated follow-up sequences, Gmail-integrated cold outreach.",
    category: "personal",
    tech: "Next.js,Prisma,Gmail API",
    githubUrl: "https://github.com/ar-nayem/lead-crm",
    liveUrl: null,
    status: "building",
    pm2Name: null,
    public: true,
  },
  {
    slug: "home",
    name: "Home",
    description: "Personal goals/habits/journal/tasks tracker — superseded by Dashboard.",
    category: "personal",
    tech: "Next.js,Prisma,Tailwind",
    githubUrl: "https://github.com/ar-nayem/home",
    liveUrl: null,
    status: "superseded",
    pm2Name: "home",
    public: false,
  },
  {
    slug: "vpn-admin",
    name: "VPN Admin",
    description: "Web panel for managing AmneziaWG (obfuscated WireGuard) client peers — runs on the VPN server itself.",
    category: "infra",
    tech: "Node.js,Express,WireGuard",
    githubUrl: "https://github.com/ar-nayem/vpn-admin",
    liveUrl: null,
    status: "live",
    pm2Name: "vpn-admin",
    public: true,
  },
  {
    slug: "nayem-portfolio",
    name: "Portfolio",
    description: "Personal portfolio — Next.js, dark theme with gold accents, PM & international operations focus.",
    category: "site",
    tech: "Next.js,Tailwind,Framer Motion",
    githubUrl: "https://github.com/ar-nayem/nayem-portfolio",
    liveUrl: "https://arnayem.top",
    status: "live",
    pm2Name: "nayem-portfolio",
    public: true,
  },
];

async function main() {
  for (let i = 0; i < REPOS.length; i++) {
    const repo = REPOS[i];
    await prisma.repo.upsert({
      where: { slug: repo.slug },
      create: { ...repo, sortOrder: i },
      update: { ...repo, sortOrder: i },
    });
    console.log(`  ok ${repo.name}`);
  }
  console.log(`Seeded ${REPOS.length} repos.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
