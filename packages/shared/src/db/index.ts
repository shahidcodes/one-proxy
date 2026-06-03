import Database from "better-sqlite3";
import type BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schemas from "./schemas.js";
import path from "path";
import fs from "fs";

export function createDb(dbPath?: string): { db: ReturnType<typeof drizzle<typeof schemas>>; sqlite: BetterSqlite3.Database } {
  const resolvedPath = dbPath || path.join(process.cwd(), "data", "one-proxy.db");
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const sqlite = new Database(resolvedPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema: schemas });
  return { db, sqlite };
}

export type Database = ReturnType<typeof createDb>["db"];
