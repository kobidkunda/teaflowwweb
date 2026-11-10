/**
 * Migration 048: Private Label Proof Enhancements & Legal Sign-off Columns
 *
 * Additive schema changes for Milestone M5:
 * 1. pl_design_versions: add project_id, status enum, asset_url, preflight_report_json, revision
 * 2. pl_approval_events: add signer_name, disclaimer_text
 * 3. Helpful indexes on pl_design_versions(project_id), pl_design_versions(status), pl_approval_events(design_version_id)
 */

export function up(db) {
  // 1. Additive columns on pl_design_versions
  const dvCols = db.prepare("PRAGMA table_info(pl_design_versions)").all().map((c) => c.name);

  if (!dvCols.includes("project_id")) {
    db.exec(`
      ALTER TABLE pl_design_versions ADD COLUMN project_id TEXT REFERENCES pl_projects(id) ON DELETE CASCADE;
      CREATE INDEX IF NOT EXISTS idx_pl_des_project ON pl_design_versions(project_id);
    `);
  }

  if (!dvCols.includes("status")) {
    db.exec(`
      ALTER TABLE pl_design_versions ADD COLUMN status TEXT NOT NULL DEFAULT 'preflight_pending'
        CHECK(status IN ('preflight_pending', 'preflight_passed', 'preflight_failed', 'customer_approved', 'production_locked'));
      CREATE INDEX IF NOT EXISTS idx_pl_des_status ON pl_design_versions(status);
    `);
  }

  if (!dvCols.includes("asset_url")) {
    db.exec(`ALTER TABLE pl_design_versions ADD COLUMN asset_url TEXT;`);
  }

  if (!dvCols.includes("preflight_report_json")) {
    db.exec(`ALTER TABLE pl_design_versions ADD COLUMN preflight_report_json TEXT NOT NULL DEFAULT '{}';`);
  }

  if (!dvCols.includes("revision")) {
    db.exec(`ALTER TABLE pl_design_versions ADD COLUMN revision INTEGER NOT NULL DEFAULT 1 CHECK(revision >= 1);`);
  }

  // Backfill project_id from pl_project_items for existing records
  db.exec(`
    UPDATE pl_design_versions
    SET project_id = (
      SELECT project_id FROM pl_project_items WHERE pl_project_items.id = pl_design_versions.project_item_id
    )
    WHERE project_id IS NULL;
  `);

  // 2. Additive columns on pl_approval_events
  const apprCols = db.prepare("PRAGMA table_info(pl_approval_events)").all().map((c) => c.name);

  if (!apprCols.includes("signer_name")) {
    db.exec(`ALTER TABLE pl_approval_events ADD COLUMN signer_name TEXT;`);
  }

  if (!apprCols.includes("disclaimer_text")) {
    db.exec(`ALTER TABLE pl_approval_events ADD COLUMN disclaimer_text TEXT;`);
  }

  // Ensure index on pl_approval_events(design_version_id)
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_pl_appr_design_ver ON pl_approval_events(design_version_id);
  `);
}

export function down(_db) {
  // Additive only: down is a no-op
}
