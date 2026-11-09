import Database from "better-sqlite3";
import { mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Migration discipline: bootstrap schema (001, idempotent) lives here and is
// NEVER edited for new work. Every schema change lands as a versioned,
// additive file in scripts/migrations/NNN_<name>.mjs exporting `up(db)`.
// Each file runs once, in filename order, inside its own transaction, tracked
// in schema_migrations(version PRIMARY KEY). Down migrations are no-ops by
// policy (additive only) — roll back by deploying the previous build, never by
// editing deployed schema silently.
//
// Migrate-on-boot safety: the app NEVER auto-migrates inside a request path.
// Deploy flow is: `npm run db:migrate` (or `db:migrate -- --check` in CI) then
// start the server. /api/ready reports pending migrations instead.
const args = process.argv.slice(2);
const checkOnly = args.includes("--check") || args.includes("--dry-run");

const file = path.resolve(process.env.DATABASE_PATH || "./data/store.sqlite");

function listMigrationFiles() {
  const dir = path.resolve(process.cwd(), "scripts/migrations");
  return {
    dir,
    files: readdirSync(dir)
      .filter((f) => f.endsWith(".mjs"))
      .sort(),
  };
}

if (checkOnly) {
  // Read-only check: exit 0 when fully migrated, 2 when migrations pending.
  // Never creates the database file.
  const { files } = listMigrationFiles();
  let db;
  try {
    db = new Database(file, { readonly: true });
  } catch {
    if (files.length > 0) {
      console.log("Migrations pending: database missing:", file);
      process.exit(2);
    }
    console.log("Migration check: no migrations, no database.");
    process.exit(0);
  }
  try {
    const hasTable = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'"
      )
      .get();
    if (!hasTable) {
      console.log("Migrations pending: schema_migrations table absent.");
      process.exit(2);
    }
    const applied = new Set(
      db
        .prepare("SELECT version FROM schema_migrations")
        .all()
        .map((r) => r.version)
    );
    const pending = files
      .map((f) => f.replace(/\.mjs$/, ""))
      .filter((v) => !applied.has(v));
    if (pending.length > 0) {
      console.log("Migrations pending:", pending.join(", "));
      process.exit(2);
    }
    console.log("Migration check: up to date.");
    process.exit(0);
  } finally {
    db.close();
  }
}

mkdirSync(path.dirname(file), { recursive: true });
const db = new Database(file);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
try {
  // Bootstrap schema (001, idempotent). Never edited for new work — use scripts/migrations/.
  db.exec(
    [
      "CREATE TABLE IF NOT EXISTS products (",
      "id INTEGER PRIMARY KEY AUTOINCREMENT,",
      "slug TEXT NOT NULL UNIQUE,",
      "name TEXT NOT NULL, category TEXT NOT NULL, origin TEXT NOT NULL,",
      "estate TEXT NOT NULL, flush TEXT NOT NULL, harvest_date TEXT NOT NULL,",
      "description TEXT NOT NULL, tasting_notes TEXT NOT NULL,",
      "floral INTEGER NOT NULL DEFAULT 0, fruity INTEGER NOT NULL DEFAULT 0,",
      "malty INTEGER NOT NULL DEFAULT 0, body INTEGER NOT NULL DEFAULT 0,",
      "brew_temp INTEGER NOT NULL, brew_seconds INTEGER NOT NULL,",
      "featured INTEGER NOT NULL DEFAULT 0",
      ");",
      "CREATE TABLE IF NOT EXISTS variants (",
      "id INTEGER PRIMARY KEY AUTOINCREMENT,",
      "product_id INTEGER NOT NULL REFERENCES products(id),",
      "sku TEXT NOT NULL UNIQUE, grams INTEGER NOT NULL,",
      "price_paise INTEGER NOT NULL CHECK(price_paise >= 0),",
      "stock INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0)",
      ");",
      "CREATE INDEX IF NOT EXISTS idx_variants_product ON variants(product_id);",
      "CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);",
      "CREATE TABLE IF NOT EXISTS orders (",
      "id TEXT PRIMARY KEY, idempotency_key TEXT NOT NULL UNIQUE,",
      "customer_name TEXT NOT NULL, customer_email TEXT NOT NULL,",
      "shipping_address TEXT NOT NULL, subtotal_paise INTEGER NOT NULL,",
      "shipping_paise INTEGER NOT NULL, total_paise INTEGER NOT NULL,",
      "status TEXT NOT NULL DEFAULT 'demo_unpaid',",
      "created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP",
      ");",
      "CREATE TABLE IF NOT EXISTS order_items (",
      "id INTEGER PRIMARY KEY AUTOINCREMENT,",
      "order_id TEXT NOT NULL REFERENCES orders(id),",
      "variant_id INTEGER NOT NULL REFERENCES variants(id),",
      "quantity INTEGER NOT NULL CHECK(quantity > 0),",
      "unit_price_paise INTEGER NOT NULL",
      ");",
      "CREATE TABLE IF NOT EXISTS schema_migrations (",
      "version TEXT PRIMARY KEY,",
      "applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP",
      ");",
    ].join("\n")
  );
  // Versioned additive migrations, in filename order, each in a transaction.
  // Single-writer safety: SQLite serializes writers; each migration runs in
  // IMMEDIATE-transaction semantics via better-sqlite3 db.transaction, so a
  // concurrent migrate fails fast instead of half-applying. Run ONE migrator
  // per database file during deploy (see docs/OPERATIONS.md).
  const { dir, files } = listMigrationFiles();
  const applied = new Set(
    db
      .prepare("SELECT version FROM schema_migrations")
      .all()
      .map((r) => r.version)
  );
  for (const f of files) {
    const version = f.replace(/\.mjs$/, "");
    if (applied.has(version)) continue;
    const mod = await import(pathToFileURL(path.join(dir, f)).href);
    if (typeof mod.up !== "function") {
      throw new Error(`Migration ${version} does not export up(db).`);
    }
    const tx = db.transaction(() => {
      mod.up(db);
      db.prepare("INSERT INTO schema_migrations (version) VALUES (?)").run(
        version
      );
    });
    tx();
    console.log("Applied migration:", version);
  }
  console.log("SQLite schema ready:", file);
} catch (error) {
  // Fail fast: version row is inside the same transaction, so a failed
  // migration leaves no applied record — safe to retry after fixing.
  console.error("Migration failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  db.close();
}

// Auto-enforce zero-mockup guard on every database migration update
if (process.exitCode !== 1) {
  try {
    const { runMockupPurge } = await import("./purge-mockup-data.mjs");
    await runMockupPurge();
  } catch (err) {
    console.error("Mockup purge guard error:", err);
  }
}
