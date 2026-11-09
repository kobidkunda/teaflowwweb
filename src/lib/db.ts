import Database from "better-sqlite3";
import { existsSync } from "node:fs";
import path from "node:path";
import { getPostgresDb } from "./postgresDriver";

let instance: Database.Database | undefined;
let currentDbPath: string | undefined;

export function getDb(): Database.Database {
  const isPostgres =
    process.env.DATABASE_TYPE === "postgres" ||
    Boolean(process.env.PGHOST) ||
    Boolean(process.env.DATABASE_URL?.startsWith("postgres"));

  if (isPostgres) {
    if (!instance) {
      instance = getPostgresDb() as unknown as Database.Database;
    }
    return instance;
  }

  const file = path.resolve(process.env.DATABASE_PATH || "./data/store.sqlite");
  if (!instance || currentDbPath !== file) {
    if (instance) {
      try { instance.close(); } catch {}
    }
    if (!existsSync(file)) {
      throw new Error("SQLite database missing. Run npm run db:setup first.");
    }
    const sqlite = new Database(file);
    sqlite.pragma("foreign_keys = ON");
    sqlite.pragma("busy_timeout = 5000");
    instance = sqlite;
    currentDbPath = file;
  }
  return instance;
}

