import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaNeon } from "@prisma/adapter-neon";

import { PrismaClient } from "../generated/prisma/client";

const url = process.env.DATABASE_URL ?? "file:./dev.db";

// One codebase, two databases: SQLite for local dev, Neon Postgres in prod. The connection string
// tells us which — a "file:" URL is SQLite, anything else (postgres://, postgresql://) is Neon.
// Prisma 7's driver adapters are provider-specific, so we pick the matching one here. (The schema's
// `provider` is also provider-specific and can't be env-driven — see the deploy note in CLAUDE.md.)
// PrismaNeon uses a WebSocket pool, which supports the interactive $transaction calls this app makes.
function createAdapter() {
  if (url.startsWith("file:")) {
    return new PrismaBetterSqlite3({ url });
  }
  return new PrismaNeon({ connectionString: url });
}

// Reuse the client across hot reloads in dev so we don't exhaust connections.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter: createAdapter() });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
