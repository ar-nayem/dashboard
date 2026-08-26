import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

// Dev-only cache: Next's hot reload re-evaluates modules on every edit, and
// without this each reload would open another SQLite connection.
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
