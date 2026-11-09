import Database from "better-sqlite3";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readSync,
  closeSync,
  rmSync,
} from "node:fs";
import path from "node:path";

// Restore a SQLite backup created by scripts/backup.mjs (VACUUM INTO output).
// Safety-first: refuses to overwrite the live database without --force, and
// always snapshots the current database aside first. Usage:
//   node scripts/restore.mjs <backup-file> [--db <path>] [--force]
// Env: DATABASE_PATH (default ./data/store.sqlite).
// After copying, runs PRAGMA integrity_check and refuses on failure.
const args = process.argv.slice(2);
function flagValue(name) {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : undefined;
}
const positional = args.find((a) => !a.startsWith("--"));
const force = args.includes("--force") || process.env.RESTORE_FORCE === "1";

if (!positional) {
  console.error(
    "Usage: node scripts/restore.mjs <backup-file> [--db <path>] [--force]"
  );
  process.exit(1);
}
const backupFile = path.resolve(positional);
const dbFile = path.resolve(
  flagValue("--db") || process.env.DATABASE_PATH || "./data/store.sqlite"
);

if (!existsSync(backupFile)) {
  console.error(`Restore failed: backup not found: ${backupFile}`);
  process.exit(1);
}
// Validate SQLite header ("SQLite format 3\0") before touching live data.
let isSqlite = false;
try {
  const fd = openSync(backupFile, "r");
  try {
    const buf = Buffer.alloc(16);
    readSync(fd, buf, 0, 16, 0);
    isSqlite = buf.equals(Buffer.from("SQLite format 3\0", "latin1"));
  } finally {
    closeSync(fd);
  }
} catch {
  isSqlite = false;
}
if (!isSqlite) {
  console.error("Restore failed: file is not a SQLite database (bad header).");
  process.exit(1);
}
if (existsSync(dbFile) && !force) {
  console.error(
    `Refusing to overwrite live database ${dbFile} without --force. ` +
      "Stop the server, take a backup (npm run db:backup), then retry with --force."
  );
  process.exit(1);
}
mkdirSync(path.dirname(dbFile), { recursive: true });
if (existsSync(dbFile)) {
  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .slice(0, 19);
  const snapshot = `${dbFile}.pre-restore-${stamp}`;
  copyFileSync(dbFile, snapshot);
  console.log("Pre-restore snapshot:", snapshot);
}
// Remove stale WAL sidecars so the restored image opens cleanly.
for (const suffix of ["-wal", "-shm", "-journal"]) {
  try {
    rmSync(dbFile + suffix, { force: true });
  } catch {
    /* absent sidecar: fine */
  }
}
copyFileSync(backupFile, dbFile);
const db = new Database(dbFile, { readonly: true });
try {
  const row = db.prepare("PRAGMA integrity_check").get();
  const ok = row && Object.values(row)[0] === "ok";
  if (!ok) {
    console.error("Restore failed: integrity_check did not return ok:", row);
    process.exitCode = 1;
  }
} finally {
  db.close();
}
if (process.exitCode) process.exit(process.exitCode);
console.log("Restored:", dbFile);
