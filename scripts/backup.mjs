import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

// Online SQLite backup. Uses VACUUM INTO so the live database (WAL mode) can
// be snapshotted without stopping the server and without copying -wal/-shm
// mid-write. Usage:
//   node scripts/backup.mjs [--out <dir>] [--db <path>]
// Env: DATABASE_PATH (default ./data/store.sqlite), BACKUP_DIR (default ./data/backups).
// Prints the backup path on stdout; exits non-zero on failure.
const args = process.argv.slice(2);
function flagValue(name) {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : undefined;
}

const dbFile = path.resolve(
  flagValue("--db") || process.env.DATABASE_PATH || "./data/store.sqlite"
);
const outDir = path.resolve(
  flagValue("--out") || process.env.BACKUP_DIR || "./data/backups"
);

if (!existsSync(dbFile)) {
  console.error(`Backup failed: database missing: ${dbFile}. Run npm run db:migrate first.`);
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);
const dest = path.join(outDir, `store-${stamp}.sqlite`);

const db = new Database(dbFile, { readonly: true });
try {
  // Checkpoint WAL so the snapshot includes recent writes.
  try {
    db.pragma("wal_checkpoint(TRUNCATE)");
  } catch {
    /* non-WAL databases: snapshot below is still consistent */
  }
  // Quote the destination: VACUUM INTO takes a filename literal.
  const quoted = `'${dest.replace(/'/g, "''")}'`;
  db.exec(`VACUUM INTO ${quoted}`);
} catch (error) {
  console.error("Backup failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  db.close();
}
if (process.exitCode) process.exit(process.exitCode);
console.log(dest);
