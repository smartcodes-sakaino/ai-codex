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
      CREATE TABLE IF NOT EXISTS "ai_questions" (
        "id" text PRIMARY KEY NOT NULL,
        "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "problem_id" text NOT NULL REFERENCES "problems"("id") ON DELETE CASCADE,
        "question" text NOT NULL,
        "answer" text NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
      );
    `);
    console.log("ai_questions table ready.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
