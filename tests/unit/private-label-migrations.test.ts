import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { rmSync } from "node:fs";

describe("Private Label Studio Database Migrations (045-047)", () => {
  let testDbPath: string;
  let db: Database.Database;

  beforeAll(() => {
    testDbPath = path.join(tmpdir(), `pl-mig-test-${process.pid}-${Date.now()}.sqlite`);

    // Run migration runner on clean temporary DB
    execFileSync(process.execPath, ["scripts/migrate.mjs"], {
      env: { ...process.env, DATABASE_PATH: testDbPath },
    });

    db = new Database(testDbPath);
    db.pragma("foreign_keys = ON");
  });

  afterAll(() => {
    try {
      db?.close();
      rmSync(testDbPath, { force: true });
      rmSync(testDbPath + "-wal", { force: true });
      rmSync(testDbPath + "-shm", { force: true });
    } catch {}
  });

  it("applies migrations 045, 046, and 047 and records them in schema_migrations", () => {
    const versions = (
      db
        .prepare(
          "SELECT version FROM schema_migrations WHERE version LIKE '045_%' OR version LIKE '046_%' OR version LIKE '047_%'"
        )
        .all() as { version: string }[]
    ).map((r) => r.version);

    expect(versions).toContain("045_private_label_core");
    expect(versions).toContain("046_private_label_quotes");
    expect(versions).toContain("047_private_label_artwork");
  });

  it("creates all 24 Private Label tables and views with clean PRAGMA integrity_check", () => {
    const integrity = db.pragma("integrity_check") as { integrity_check: string }[];
    expect(integrity).toEqual([{ integrity_check: "ok" }]);

    const expectedEntities = [
      "pl_clients",
      "pl_brands",
      "pl_tea_options",
      "pl_packaging_families",
      "pl_packaging_variants",
      "pl_print_methods",
      "pl_packaging_compatibility",
      "pl_print_compatibility",
      "pl_moq_rules",
      "pl_price_books",
      "pl_price_book_tiers",
      "pl_audit",
      "pl_projects",
      "pl_project_items",
      "pl_quotes",
      "pl_quote_items",
      "pl_samples",
      "pl_sample_items",
      "pl_orders",
      "pl_order_items",
      "pl_jobs",
      "pl_qc_milestones",
      "pl_artwork_assets",
      "pl_design_versions",
      "pl_preflight_reports",
      "pl_approval_events",
    ];

    const existingNames = new Set(
      (
        db.prepare("SELECT name FROM sqlite_master WHERE type IN ('table', 'view')").all() as { name: string }[]
      ).map((r) => r.name)
    );

    for (const entity of expectedEntities) {
      expect(existingNames.has(entity), `Expected entity ${entity} to exist in database`).toBe(true);
    }
  });

  it("verifies zero foreign key violations in Private Label schema", () => {
    const plTables = [
      "pl_clients",
      "pl_brands",
      "pl_tea_options",
      "pl_packaging_families",
      "pl_packaging_variants",
      "pl_print_methods",
      "pl_packaging_compatibility",
      "pl_moq_rules",
      "pl_price_books",
      "pl_price_book_tiers",
      "pl_audit",
      "pl_projects",
      "pl_project_items",
      "pl_quotes",
      "pl_quote_items",
      "pl_samples",
      "pl_sample_items",
      "pl_orders",
      "pl_order_items",
      "pl_jobs",
      "pl_qc_milestones",
      "pl_artwork_assets",
      "pl_design_versions",
      "pl_preflight_reports",
      "pl_approval_events",
    ];

    for (const table of plTables) {
      const violations = db.pragma(`foreign_key_check('${table}')`);
      expect(violations, `Foreign key violations found in ${table}`).toHaveLength(0);
    }
  });

  it("enforces CAS optimistic concurrency revision counter increment and rejection", () => {
    db.prepare(`
      INSERT INTO pl_clients (id, company_name, contact_name, contact_email)
      VALUES ('c_cas_test', 'CAS Corp', 'Alice', 'alice@cas.com')
    `).run();

    db.prepare(`
      INSERT INTO pl_projects (id, client_id, title, revision)
      VALUES ('proj_cas_test', 'c_cas_test', 'Original Title', 1)
    `).run();

    // Successful CAS update
    const firstUpdate = db.prepare(`
      UPDATE pl_projects
      SET title = 'Updated Title', revision = revision + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = 'proj_cas_test' AND revision = 1
    `).run();
    expect(firstUpdate.changes).toBe(1);

    // Stale CAS update fails
    const staleUpdate = db.prepare(`
      UPDATE pl_projects
      SET title = 'Stale Title', revision = revision + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = 'proj_cas_test' AND revision = 1
    `).run();
    expect(staleUpdate.changes).toBe(0);

    const record = db.prepare("SELECT revision, title FROM pl_projects WHERE id = 'proj_cas_test'").get() as {
      revision: number;
      title: string;
    };
    expect(record.revision).toBe(2);
    expect(record.title).toBe("Updated Title");
  });

  it("enforces CHECK constraints on single-quoted string enums and non-negative money", () => {
    // Negative price check failure
    expect(() => {
      db.prepare(`
        INSERT INTO pl_tea_options (
          id, slug, name, origin_estate, region, grade, flush,
          tea_category, description, caffeine_level, base_cost_per_kg_paise
        ) VALUES (
          'tea_neg', 'tea-neg', 'Neg Tea', 'Estate', 'Region', 'TGFOP', 'First',
          'black', 'Desc', 'medium', -100
        )
      `).run();
    }).toThrow();

    // Invalid enum string check failure
    expect(() => {
      db.prepare(`
        INSERT INTO pl_tea_options (
          id, slug, name, origin_estate, region, grade, flush,
          tea_category, description, caffeine_level, base_cost_per_kg_paise
        ) VALUES (
          'tea_bad_cat', 'tea-bad-cat', 'Bad Cat Tea', 'Estate', 'Region', 'TGFOP', 'First',
          'invalid_category', 'Desc', 'medium', 1000
        )
      `).run();
    }).toThrow();
  });

  it("enforces foreign key restrict on commercial quotes preventing project deletion", () => {
    // Insert client, project, price book, and quote
    db.prepare(`
      INSERT INTO pl_clients (id, company_name, contact_name, contact_email)
      VALUES ('c_fk_test', 'FK Corp', 'Bob', 'bob@fk.com')
    `).run();

    db.prepare(`
      INSERT INTO pl_projects (id, client_id, title)
      VALUES ('proj_fk_test', 'c_fk_test', 'Project With Quote')
    `).run();

    db.prepare(`
      INSERT INTO pl_price_books (id, name, margin_rate)
      VALUES ('pb_fk_test', 'Test PB', 0.25)
    `).run();

    db.prepare(`
      INSERT INTO pl_quotes (id, quote_number, project_id, price_book_id, status)
      VALUES ('q_fk_test', 'PL-Q-FK-001', 'proj_fk_test', 'pb_fk_test', 'draft')
    `).run();

    // Attempt to delete project with linked quote -> must fail due to ON DELETE RESTRICT
    expect(() => {
      db.prepare("DELETE FROM pl_projects WHERE id = 'proj_fk_test'").run();
    }).toThrow(/FOREIGN KEY constraint failed/);

    // Deleting quote first allows project deletion
    db.prepare("DELETE FROM pl_quotes WHERE id = 'q_fk_test'").run();
    const result = db.prepare("DELETE FROM pl_projects WHERE id = 'proj_fk_test'").run();
    expect(result.changes).toBe(1);
  });
});
