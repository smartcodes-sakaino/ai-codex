import "dotenv/config";
import pg from "pg";

// drizzle-kit push's interactive rename-or-create prompt can't be answered
// non-interactively in this environment (it reads raw keypresses, which a
// piped "yes" can't satisfy), and it always asks here because the `session`
// table (owned by connect-pg-simple, not Drizzle) confuses its diff heuristic.
// So these two small, purely additive changes are applied directly instead.
const { Pool } = pg;

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "self_review_submissions" (
        "id" text PRIMARY KEY NOT NULL,
        "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "problem_id" text NOT NULL REFERENCES "problems"("id") ON DELETE CASCADE,
        "verdict" text NOT NULL,
        "review" text NOT NULL,
        "submitted_at" timestamp DEFAULT now() NOT NULL
      );
    `);
    await pool.query(`
      ALTER TABLE "video_progress"
      ADD COLUMN IF NOT EXISTS "completed" boolean DEFAULT false NOT NULL;
    `);
    console.log("Curriculum schema changes applied.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
