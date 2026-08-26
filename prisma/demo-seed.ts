import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { INTEGRATION_SEED } from "./integration-seed";
import { installWorkoutLibrary } from "./seed-workouts";

// DEMO DATA ONLY.
//
// Every name, project, and figure below is invented placeholder content whose
// only job is to give the charts a shape to draw while you evaluate the UI.
// It is not anyone's real data and it is not yours. Run `npm run db:reset`
// to clear it before entering your own.

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
const prisma = new PrismaClient({ adapter });

// Seeded PRNG (mulberry32) rather than Math.random, so re-running reproduces
// the same database and charts stay comparable between runs.
function makeRng(seed: number) {
  let state = seed >>> 0;
  return function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = makeRng(1234567);
const randomBetween = (min: number, max: number) => min + rng() * (max - min);
const randomInt = (min: number, max: number) => Math.floor(randomBetween(min, max + 1));
const chance = (probability: number) => rng() < probability;
const pick = <T,>(items: readonly T[]): T => items[Math.floor(rng() * items.length)];

// UTC midnight everywhere — a local-midnight Date would land on a different
// UTC day depending on the machine's timezone and break the unique
// constraints on [habitId, date] and [projectId, date].
function utcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

const TODAY = utcMidnight(new Date());

function daysAgo(n: number): Date {
  const d = new Date(TODAY);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

const daysAhead = (n: number) => daysAgo(-n);

function monthsAgo(n: number): Date {
  const d = new Date(TODAY);
  d.setUTCMonth(d.getUTCMonth() - n, 1);
  return utcMidnight(d);
}

async function clearAll() {
  await prisma.habitLog.deleteMany();
  await prisma.workoutSet.deleteMany();
  await prisma.workout.deleteMany();
  await prisma.templateExercise.deleteMany();
  await prisma.workoutTemplate.deleteMany();
  await prisma.exercise.deleteMany();
  await prisma.healthMetric.deleteMany();
  await prisma.accountSnapshot.deleteMany();
  await prisma.holding.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.account.deleteMany();
  await prisma.loan.deleteMany();
  await prisma.projectMetric.deleteMany();
  await prisma.projectTodo.deleteMany();
  await prisma.advisorProposal.deleteMany();
  await prisma.projectNote.deleteMany();
  await prisma.videoSubtask.deleteMany();
  await prisma.video.deleteMany();
  await prisma.socialStat.deleteMany();
  await prisma.article.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.idea.deleteMany();
  await prisma.document.deleteMany();
  await prisma.birthday.deleteMany();
  await prisma.shipLog.deleteMany();
  await prisma.integration.deleteMany();
  await prisma.task.deleteMany();
  await prisma.client.deleteMany();
  await prisma.goal.deleteMany();
  await prisma.habit.deleteMany();
  await prisma.project.deleteMany();
  await prisma.area.deleteMany();
}

async function main() {
  console.log("⚠  Seeding DEMO data — invented placeholders, not real records.");
  console.log("   Run `npm run db:reset` to clear it before entering your own.\n");

  await clearAll();

  // --- Areas ---------------------------------------------------------------
  const areaData = [
    { name: "Personal", color: "#4f8cff", icon: "🏠", sortOrder: 0 },
    { name: "Business", color: "#f0b429", icon: "💼", sortOrder: 1 },
    { name: "Health", color: "#34d399", icon: "💚", sortOrder: 2 },
    { name: "Content", color: "#c084fc", icon: "🎬", sortOrder: 3 },
    { name: "Finance", color: "#22d3ee", icon: "📈", sortOrder: 4 },
  ];
  const areas: Record<string, string> = {};
  for (const data of areaData) {
    areas[data.name] = (await prisma.area.create({ data })).id;
  }

  // --- Clients -------------------------------------------------------------
  const clients: Record<string, string> = {};
  for (const data of [
    { name: "Demo Client A", shortCode: "CA", color: "#4f8cff" },
    { name: "Demo Client B", shortCode: "CB", color: "#34d399" },
  ]) {
    clients[data.shortCode] = (await prisma.client.create({ data })).id;
  }

  // --- Projects ------------------------------------------------------------
  const projectSeeds = [
    { name: "Sample App One", slug: "sample-app-one", kind: "app", status: "live", installs: 20, revenue: 0, visitors: null, launched: 120 },
    { name: "Sample App Two", slug: "sample-app-two", kind: "app", status: "live", installs: 12, revenue: 90, visitors: null, launched: 95 },
    { name: "Sample App Three", slug: "sample-app-three", kind: "app", status: "building", installs: 3, revenue: 0, visitors: null, launched: 40 },
    { name: "Sample Site", slug: "sample-site", kind: "site", status: "live", installs: null, revenue: 150, visitors: 480, launched: 210 },
    { name: "Parked Site", slug: "parked-site", kind: "site", status: "parked", installs: null, revenue: 0, visitors: 0, launched: 400 },
    { name: "Sample Store", slug: "sample-store", kind: "store", status: "live", installs: null, revenue: 380, visitors: 220, launched: 150 },
  ];

  const projects: Record<string, string> = {};
  for (const [index, seed] of projectSeeds.entries()) {
    const project = await prisma.project.create({
      data: {
        name: seed.name,
        slug: seed.slug,
        description: "Demo project — replace with your own.",
        status: seed.status,
        kind: seed.kind,
        launchedAt: daysAgo(seed.launched),
        sortOrder: index,
        areaId: areas.Business,
      },
    });
    projects[seed.slug] = project.id;

    // 365 days of daily metrics so the 7D / 30D / 365D toggles all have data.
    const rows = [];
    for (let i = 364; i >= 0; i--) {
      const date = daysAgo(i);
      const progress = (364 - i) / 364;
      const weekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;
      const growth = seed.status === "parked" ? 0 : progress;

      rows.push({
        projectId: project.id,
        date,
        installs:
          seed.installs === null
            ? null
            : Math.max(0, Math.round(seed.installs * (0.2 + growth) * randomBetween(0.4, 1.6))),
        revenue:
          seed.revenue === 0
            ? 0
            : Math.round((seed.revenue / 30) * (0.3 + growth) * randomBetween(0.2, 1.9) * 100) / 100,
        uniqueVisitors:
          seed.visitors === null
            ? null
            : Math.max(
                0,
                Math.round((seed.visitors / 30) * (0.3 + growth) * randomBetween(0.5, 1.7) * (weekend ? 0.7 : 1)),
              ),
        activeUsers:
          seed.installs === null
            ? null
            : Math.max(0, Math.round(seed.installs * growth * randomBetween(0.5, 1.4))),
      });
    }
    await prisma.projectMetric.createMany({ data: rows });
  }

  await prisma.projectTodo.createMany({
    data: [
      { projectId: projects["sample-site"], text: "Demo to-do — write the first article.", sortOrder: 0 },
      { projectId: projects["sample-app-one"], text: "Demo to-do — add onboarding.", sortOrder: 0 },
      { projectId: projects["sample-app-one"], text: "Demo to-do — ship v1.1.", sortOrder: 1, done: true },
    ],
  });

  await prisma.advisorProposal.createMany({
    data: [
      { projectId: projects["sample-app-one"], text: "Demo proposal — add a trial before the paywall." },
      { projectId: projects["sample-app-two"], text: "Demo proposal — prompt for reviews after three sessions." },
      { projectId: projects["sample-site"], text: "Demo proposal — add FAQ schema to the top landing page." },
    ],
  });

  await prisma.projectNote.createMany({
    data: [{ projectId: projects["sample-app-one"], body: "Demo note — ideas for the next version." }],
  });

  // --- Tasks ---------------------------------------------------------------
  const taskSeeds = [
    { title: "Demo task — review this week's numbers", sprint: true, area: "Business", priority: "medium" },
    { title: "Demo task — send the monthly invoice", sprint: true, client: "CA", priority: "high" },
    { title: "Demo task — fix the reported crash", sprint: true, client: "CB", project: "sample-app-one", priority: "high" },
    { title: "Demo task — draft the content calendar", sprint: false, area: "Content", priority: "medium" },
    { title: "Demo task — rebalance the portfolio", sprint: false, area: "Finance", priority: "low" },
    { title: "Demo task — renew the domain", sprint: true, area: "Personal", priority: "high", dueIn: 2 },
    { title: "Demo task — export last month's books", sprint: false, area: "Finance", priority: "medium", dueIn: -3 },
  ];

  for (const [index, seed] of taskSeeds.entries()) {
    await prisma.task.create({
      data: {
        title: seed.title,
        sprint: seed.sprint,
        priority: seed.priority,
        sortOrder: index,
        dueDate: seed.dueIn === undefined ? null : daysAhead(seed.dueIn),
        areaId: seed.area ? areas[seed.area] : null,
        clientId: seed.client ? clients[seed.client] : null,
        projectId: seed.project ? projects[seed.project] : null,
      },
    });
  }

  for (let i = 0; i < 6; i++) {
    await prisma.task.create({
      data: {
        title: `Demo completed task ${i + 1}`,
        status: "done",
        completedAt: daysAgo(randomInt(1, 20)),
        areaId: areas.Business,
      },
    });
  }

  // --- Habits --------------------------------------------------------------
  const habitSeeds = [
    { name: "Workout", emoji: "🏋", kind: "auto", area: "Health", rate: 0.55 },
    { name: "Make Bed", emoji: "🛏", kind: "do", area: "Personal", rate: 0.5 },
    { name: "Supplements", emoji: "💊", kind: "do", area: "Health", rate: 0.45 },
    { name: "Skincare", emoji: "💧", kind: "do", area: "Personal", rate: 0.8 },
    { name: "Floss", emoji: "🦷", kind: "do", area: "Health", rate: 0.75 },
    { name: "Read 20 Pages", emoji: "📖", kind: "do", area: "Personal", rate: 0.6 },
    { name: "No Alcohol", emoji: "🍷", kind: "abstain", area: "Health", rate: 0.85 },
    { name: "Deep Work Block", emoji: "🎯", kind: "do", area: "Business", rate: 0.65 },
  ];

  for (const [index, seed] of habitSeeds.entries()) {
    const habit = await prisma.habit.create({
      data: {
        name: seed.name,
        emoji: seed.emoji,
        kind: seed.kind,
        sortOrder: index,
        areaId: areas[seed.area],
      },
    });

    // ~10% of days left unlogged, which is what produces the grey cells.
    const logs = [];
    for (let i = 119; i >= 0; i--) {
      if (chance(0.1)) continue;
      logs.push({
        habitId: habit.id,
        date: daysAgo(i),
        status: chance(seed.rate) ? "success" : chance(0.9) ? "fail" : "skip",
      });
    }
    await prisma.habitLog.createMany({ data: logs });
  }

  // --- Goals ---------------------------------------------------------------
  const deepWork = await prisma.habit.findFirst({ where: { name: "Deep Work Block" } });
  const noAlcohol = await prisma.habit.findFirst({ where: { name: "No Alcohol" } });

  await prisma.goal.createMany({
    data: [
      {
        title: "Demo goal — net worth",
        kind: "metric",
        category: "financial",
        targetValue: 100000,
        currentValue: 42000,
        unit: "USD",
        targetDate: daysAhead(200),
        areaId: areas.Finance,
      },
      {
        title: "Demo goal — annual income",
        kind: "metric",
        category: "financial",
        targetValue: 120000,
        currentValue: 58000,
        unit: "USD",
        targetDate: daysAhead(127),
        areaId: areas.Finance,
      },
      {
        title: "Demo goal — deep work streak",
        kind: "habit_streak",
        category: "habits",
        targetValue: 7,
        habitId: deepWork?.id ?? null,
        areaId: areas.Business,
      },
      {
        title: "Demo goal — 30 days no alcohol",
        kind: "habit_streak",
        category: "habits",
        targetValue: 30,
        habitId: noAlcohol?.id ?? null,
        areaId: areas.Health,
      },
      {
        title: "Demo goal — ship 12 projects",
        kind: "metric",
        category: "business",
        targetValue: 12,
        currentValue: 4,
        unit: "projects",
        targetDate: daysAhead(180),
        areaId: areas.Business,
      },
      {
        title: "Demo goal — body composition",
        kind: "manual",
        category: "health",
        progress: 45,
        targetDate: daysAhead(90),
        areaId: areas.Health,
      },
    ],
  });

  // --- Fitness -------------------------------------------------------------
  // The exercise library and templates come from the shared definition rather
  // than a second copy here — Exercise.name is unique, so a duplicate list
  // would collide, and the stock templates are real reference data anyway.
  // Only the fake workout *history* below is demo content.
  await installWorkoutLibrary(prisma, () => {});

  const allExercises = await prisma.exercise.findMany({
    select: { id: true, name: true, equipment: true },
  });
  const exerciseByName = new Map(allExercises.map((exercise) => [exercise.name, exercise]));

  const allTemplates = await prisma.workoutTemplate.findMany({
    include: { exercises: { orderBy: { sortOrder: "asc" }, include: { exercise: true } } },
  });

  for (let w = 0; w < 18; w++) {
    const startedAt = new Date(daysAgo(2 + w * 3 + randomInt(0, 2)));
    startedAt.setUTCHours(randomInt(7, 19), randomInt(0, 59), 0, 0);
    const finishedAt = new Date(startedAt.getTime() + randomInt(28, 84) * 60_000);

    const template = pick(allTemplates);
    const workout = await prisma.workout.create({
      data: {
        name: `${template.name} Workout`,
        startedAt,
        finishedAt,
        templateId: template.id,
      },
    });

    // Older workouts are lighter, so the previous-performance column in the
    // live session shows a real progression rather than noise.
    const progression = (18 - w) / 18;
    const setRows = [];

    for (const entry of template.exercises.slice(0, randomInt(4, 6))) {
      const exercise = exerciseByName.get(entry.exercise.name);
      if (!exercise) continue;

      const bodyweight = exercise.equipment === "bodyweight";
      const unit = chance(0.65) ? "lb" : "kg";
      const base = bodyweight ? 0 : randomBetween(unit === "lb" ? 45 : 20, unit === "lb" ? 135 : 60);

      for (let s = 1; s <= randomInt(3, 4); s++) {
        setRows.push({
          workoutId: workout.id,
          exerciseId: exercise.id,
          setNumber: s,
          weight: bodyweight ? null : Math.round((base * (0.85 + progression * 0.2)) / 5) * 5,
          unit,
          reps: randomInt(6, 12),
          completed: true,
        });
      }
    }

    if (setRows.length > 0) await prisma.workoutSet.createMany({ data: setRows });
  }

  // --- Health --------------------------------------------------------------
  const healthRows = [];

  let weight = 74;
  for (let i = 730; i >= 0; i -= 3) {
    const phase = (730 - i) / 730;
    const trend = phase < 0.6 ? phase * 12 : 7.2 + (phase - 0.6) * 6;
    weight = 74 + trend + randomBetween(-0.8, 0.8);
    healthRows.push({
      type: "weight",
      value: Math.round(weight * 10) / 10,
      unit: "kg",
      date: daysAgo(i),
      source: "manual",
    });
  }

  for (let i = 180; i >= 0; i--) {
    const date = daysAgo(i);
    const weekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;
    healthRows.push(
      { type: "resting_hr", value: Math.round(randomBetween(52, 64)), unit: "bpm", date, source: "manual" },
      { type: "hrv", value: Math.round(randomBetween(38, 72) - (180 - i) * 0.02), unit: "ms", date, source: "manual" },
      { type: "steps", value: Math.round(randomBetween(2200, 9800) * (weekend ? 1.15 : 1)), unit: "steps", date, source: "manual" },
      { type: "active_energy", value: Math.round(randomBetween(240, 780)), unit: "kcal", date, source: "manual" },
      { type: "sleep", value: Math.round(randomBetween(5.4, 8.6) * 10) / 10, unit: "h", date, source: "manual" },
    );
  }

  for (let i = 180; i >= 0; i -= 7) {
    healthRows.push({
      type: "vo2max",
      value: Math.round(randomBetween(38, 44) * 10) / 10,
      unit: "ml/kg/min",
      date: daysAgo(i),
      source: "manual",
    });
  }

  await prisma.healthMetric.createMany({ data: healthRows });

  // --- Finance -------------------------------------------------------------
  const accountSeeds = [
    { name: "Demo Chequing", kind: "bank", start: 6200, growth: 1.01, sortOrder: 0 },
    { name: "Demo Savings", kind: "bank", start: 3100, growth: 1.02, sortOrder: 1 },
    { name: "Demo Brokerage", kind: "brokerage", start: 12500, growth: 1.05, sortOrder: 2 },
    { name: "Demo Crypto", kind: "crypto", start: 2200, growth: 1.04, sortOrder: 3 },
    { name: "Demo Cash", kind: "cash", start: 700, growth: 1.0, sortOrder: 4 },
    // Liability: negative balances make net worth a plain sum.
    { name: "Demo Loan", kind: "loan", start: -14000, growth: 0.975, sortOrder: 5 },
  ];

  const accounts: Record<string, string> = {};
  for (const seed of accountSeeds) {
    const account = await prisma.account.create({
      data: { name: seed.name, kind: seed.kind, sortOrder: seed.sortOrder },
    });
    accounts[seed.name] = account.id;

    const snapshots = [];
    let balance = seed.start;
    for (let m = 23; m >= 0; m--) {
      balance = balance * seed.growth * randomBetween(0.985, 1.02);
      snapshots.push({
        accountId: account.id,
        date: monthsAgo(m),
        balance: Math.round(balance * 100) / 100,
      });
    }
    await prisma.accountSnapshot.createMany({ data: snapshots });
  }

  await prisma.holding.createMany({
    data: [
      { accountId: accounts["Demo Brokerage"], symbol: "DEMO1", shares: 20, costBasis: 8000, currentPrice: 480 },
      { accountId: accounts["Demo Brokerage"], symbol: "DEMO2", shares: 12, costBasis: 3200, currentPrice: 265 },
      { accountId: accounts["Demo Crypto"], symbol: "DEMO3", shares: 0.05, costBasis: 2000, currentPrice: 62000 },
    ],
  });

  await prisma.loan.create({
    data: {
      name: "Demo Loan",
      principal: 28000,
      balance: 11400,
      interestRate: 4.6,
      monthlyPayment: 400,
      startedAt: daysAgo(2100),
      payoffDate: daysAhead(990),
    },
  });

  const expenseCategories = ["Rent", "Groceries", "Eating Out", "Transport", "Software", "Health", "Travel", "Misc"];
  const transactionRows = [];
  for (let m = 17; m >= 0; m--) {
    const monthStart = monthsAgo(m);
    const monthProgress = (17 - m) / 17;

    for (let i = 0; i < 2; i++) {
      const day = new Date(monthStart);
      day.setUTCDate(i === 0 ? 5 : 20);
      transactionRows.push({
        date: day,
        amount: Math.round(randomBetween(2400, 4600) * (0.7 + monthProgress * 0.6)),
        kind: "income",
        category: "Client Work",
        description: "Demo invoice",
        accountId: accounts["Demo Chequing"],
      });
    }

    const revenueDay = new Date(monthStart);
    revenueDay.setUTCDate(28);
    transactionRows.push({
      date: revenueDay,
      amount: Math.round(randomBetween(40, 520) * (0.4 + monthProgress)),
      kind: "income",
      category: "Side Projects",
      description: "Demo product revenue",
      accountId: accounts["Demo Savings"],
      projectId: projects["sample-store"],
    });

    for (let i = 0; i < randomInt(14, 24); i++) {
      const day = new Date(monthStart);
      day.setUTCDate(randomInt(1, 28));
      const category = pick(expenseCategories);
      transactionRows.push({
        date: day,
        amount: Math.round(category === "Rent" ? randomBetween(650, 780) : randomBetween(8, 240)),
        kind: "expense",
        category,
        accountId: accounts["Demo Chequing"],
      });
    }
  }
  await prisma.transaction.createMany({ data: transactionRows });

  // --- Video ---------------------------------------------------------------
  const videoSeeds = [
    { title: "Demo video idea one", stage: "idea", format: "long", platforms: "youtube" },
    { title: "Demo video idea two", stage: "idea", format: "short", platforms: "youtube,instagram" },
    { title: "Demo video idea three", stage: "idea", format: "long", platforms: "youtube,x" },
    { title: "Demo video in progress", stage: "in_progress", format: "long", platforms: "youtube,tiktok" },
    { title: "Demo video published one", stage: "published", format: "long", platforms: "youtube" },
    { title: "Demo video published two", stage: "published", format: "short", platforms: "youtube,instagram" },
  ];

  for (const [index, seed] of videoSeeds.entries()) {
    const video = await prisma.video.create({
      data: {
        title: seed.title,
        stage: seed.stage,
        format: seed.format,
        platforms: seed.platforms,
        sortOrder: index,
        postDate: seed.stage === "published" ? daysAgo(randomInt(10, 70)) : null,
        workOnDate: seed.stage === "in_progress" ? daysAhead(randomInt(1, 6)) : null,
      },
    });

    if (seed.stage === "in_progress") {
      await prisma.videoSubtask.createMany({
        data: [
          { videoId: video.id, text: "Write the script", done: true, sortOrder: 0 },
          { videoId: video.id, text: "Record", done: false, sortOrder: 1 },
          { videoId: video.id, text: "Edit", done: false, sortOrder: 2 },
          { videoId: video.id, text: "Thumbnail", done: false, sortOrder: 3 },
        ],
      });
    }
  }

  const socialSeeds = [
    { platform: "youtube", start: 240, views: [0, 14] as const },
    { platform: "instagram", start: 1850, views: [40, 320] as const },
    { platform: "x", start: 620, views: [20, 200] as const },
    { platform: "tiktok", start: 410, views: [10, 480] as const },
  ];

  const socialRows = [];
  for (const seed of socialSeeds) {
    let followers = seed.start;
    for (let i = 119; i >= 0; i--) {
      followers += randomInt(0, 2);
      socialRows.push({
        platform: seed.platform,
        date: daysAgo(i),
        followers,
        views: randomInt(seed.views[0], seed.views[1]),
        watchHours: seed.platform === "youtube" ? Math.round(randomBetween(0, 3.5) * 10) / 10 : null,
        posts: chance(0.25) ? 1 : 0,
      });
    }
  }
  await prisma.socialStat.createMany({ data: socialRows });

  // --- Written -------------------------------------------------------------
  await prisma.article.createMany({
    data: [
      { title: "Demo article — idea stage", stage: "idea", platform: "Blog", wordCount: 0, sortOrder: 0 },
      { title: "Demo article — drafting", stage: "drafting", platform: "Blog", wordCount: 1240, sortOrder: 1 },
      { title: "Demo article — editing", stage: "editing", platform: "Newsletter", wordCount: 2100, sortOrder: 2 },
      { title: "Demo article — published", stage: "published", platform: "Newsletter", wordCount: 1680, publishDate: daysAgo(24), sortOrder: 3 },
    ],
  });

  // --- Itinerary -----------------------------------------------------------
  await prisma.trip.createMany({
    data: [
      { city: "Demo City A", country: "Country A", flag: "🏳", startDate: daysAgo(20), endDate: daysAhead(7) },
      { city: "Demo City B", country: "Country B", flag: "🏳", startDate: daysAhead(8), endDate: daysAhead(40) },
      { city: "Demo City C", country: "Country C", flag: "🏳", startDate: daysAhead(62), endDate: daysAhead(71) },
    ],
  });

  // --- Ideas ---------------------------------------------------------------
  await prisma.idea.createMany({
    data: [
      { title: "Demo business idea", description: "Replace with your own.", category: "business", sortOrder: 0, areaId: areas.Business },
      { title: "Demo tool idea", description: "Replace with your own.", category: "tools", sortOrder: 1, areaId: areas.Business },
      { title: "Demo content idea", description: "Replace with your own.", category: "content", sortOrder: 2, areaId: areas.Content },
      { title: "Demo shipped idea", description: "Replace with your own.", category: "business", status: "shipped", sortOrder: 3, areaId: areas.Business },
    ],
  });

  // --- Home widgets --------------------------------------------------------
  await prisma.document.createMany({
    data: [
      { name: "Demo passport", kind: "passport", expiresAt: daysAhead(1290) },
      { name: "Demo ID card", kind: "card", expiresAt: daysAhead(356) },
      { name: "Demo driving licence", kind: "license", expiresAt: daysAhead(210) },
      { name: "Demo visa", kind: "visa", expiresAt: daysAhead(45) },
    ],
  });

  await prisma.birthday.createMany({
    data: [
      { name: "Demo Contact A", month: 3, day: 14 },
      { name: "Demo Contact B", month: 7, day: 2, birthYear: 1994 },
      { name: "Demo Contact C", month: 11, day: 23 },
    ],
  });

  await prisma.shipLog.createMany({
    data: [
      { title: "Demo shipped item — analytics integration", shippedAt: daysAgo(14) },
      { title: "Demo shipped item — health tab", shippedAt: daysAgo(21) },
      { title: "Demo shipped item — habit streaks", shippedAt: daysAgo(30) },
    ],
  });

  // --- Integrations --------------------------------------------------------
  await prisma.integration.createMany({ data: INTEGRATION_SEED });

  console.log("Demo seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
