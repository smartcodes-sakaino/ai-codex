import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

// Applies any migration files under ./migrations that this database hasn't
// seen yet (tracked via drizzle's own drizzle.__drizzle_migrations table).
// Replaces the old pattern of one-off script/push-*.ts files: going forward,
// a schema change is `shared/schema.ts` edit -> `npx drizzle-kit generate`
// -> `npm run db:migrate`.
async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);
  try {
    await migrate(db, { migrationsFolder: "./migrations" });
    console.log("migrations applied.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
