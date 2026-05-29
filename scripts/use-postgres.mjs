// Prisma can't pick the datasource provider from an env var (error P1012), and the SQLite and
// Postgres clients are dialect-specific. So for the prod (Neon) build we rewrite the committed
// `provider = "sqlite"` to `"postgresql"` right before `prisma generate`. Runs only in the Vercel
// build — the committed schema stays on sqlite so local dev is untouched. Idempotent.
import { readFileSync, writeFileSync } from "node:fs";

const SCHEMA = "prisma/schema.prisma";
const original = readFileSync(SCHEMA, "utf8");
const swapped = original.replace('provider = "sqlite"', 'provider = "postgresql"');

if (swapped === original) {
  console.log("[use-postgres] provider already postgresql (or pattern not found) — no change");
} else {
  writeFileSync(SCHEMA, swapped);
  console.log("[use-postgres] datasource provider → postgresql");
}
