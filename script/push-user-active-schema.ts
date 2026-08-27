import "dotenv/config";
import pg from "pg";

// Same rationale as push-curriculum-schema.ts: drizzle-kit push's interactive
// rename-or-create prompt can't be answered non-interactively here, so this
// purely additive change is applied directly instead.
const { Pool } = pg;

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_active" boolean NOT NULL DEFAULT true;
    `);
    console.log("users.is_active column ready.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
