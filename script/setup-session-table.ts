import "dotenv/config";
import pg from "pg";

// connect-pg-simple (the session store) isn't managed by Drizzle, so it never
// shows up in `npm run db:push`. Run this once per database (dev and
// production are separate on Replit) to create the table it needs.
const { Pool } = pg;

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL
      )
      WITH (OIDS=FALSE);
    `);
    await pool.query(`ALTER TABLE "session" DROP CONSTRAINT IF EXISTS "session_pkey";`);
    await pool.query(
      `ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;`
    );
    await pool.query(`CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");`);
    console.log("session table ready.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
