import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  // Throwing at import time would crash any route that touches the DB; instead
  // we lazy-fail in getDb() so non-DB routes (like the legacy /api/extract)
  // continue to work without DATABASE_URL set.
}

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set in .env.local");
  }
  const sql = neon(url);
  _db = drizzle(sql, { schema });
  return _db;
}

export { schema };
