import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Kept small deliberately: on Cloudflare Workers each isolate gets its own Pool,
// and Hyperdrive already pools connections to Postgres on Cloudflare's side, so a
// large per-isolate pool just risks exhausting the database's own connection limit
// under bursty concurrent traffic.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  connectionTimeoutMillis: 10_000,
});
export const db = drizzle(pool, { schema });
