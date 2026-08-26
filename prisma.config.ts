// Prisma 7 reads the datasource URL from here, not from the schema's
// datasource block. `dotenv/config` is what puts DATABASE_URL on the
// environment when the CLI runs outside Next.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // `prisma migrate reset` should leave you with an empty database, not
    // someone else's demo rows. Demo data is opt-in via `npm run db:seed:demo`.
    seed: "tsx prisma/reset.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
