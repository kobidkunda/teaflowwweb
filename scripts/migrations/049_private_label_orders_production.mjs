/**
 * Migration 049: Private Label Orders & Production Lifecycle Columns
 *
 * Additive schema changes for Milestone M6:
 * 1. pl_orders: add project_id, idempotency_key, currency, total_paise, shipping_address_json, notes
 * 2. pl_samples: add quantity, coupon_code, revision, tea_recipe_ids_json, notes
 * 3. pl_jobs: add revision, override_justification
 * 4. pl_qc_milestones: add cupping_score, recorded_weight_g, target_weight_g, notes, updated_at
 * 5. Unique index on pl_orders(idempotency_key)
 * 6. Compatibility view pl_sample_orders -> pl_samples
 */

export function up(db) {
  // 1. Additive columns on pl_orders
  const orderCols = db.prepare("PRAGMA table_info(pl_orders)").all().map((c) => c.name);

  if (!orderCols.includes("project_id")) {
    db.exec(`
      ALTER TABLE pl_orders ADD COLUMN project_id TEXT REFERENCES pl_projects(id) ON DELETE RESTRICT;
      CREATE INDEX IF NOT EXISTS idx_pl_orders_project ON pl_orders(project_id);
    `);
  }

  if (!orderCols.includes("idempotency_key")) {
    db.exec(`ALTER TABLE pl_orders ADD COLUMN idempotency_key TEXT;`);
  }

  if (!orderCols.includes("currency")) {
    db.exec(`ALTER TABLE pl_orders ADD COLUMN currency TEXT NOT NULL DEFAULT 'INR';`);
  }

  if (!orderCols.includes("total_paise")) {
    db.exec(`ALTER TABLE pl_orders ADD COLUMN total_paise INTEGER NOT NULL DEFAULT 0;`);
  }

  if (!orderCols.includes("shipping_address_json")) {
    db.exec(`ALTER TABLE pl_orders ADD COLUMN shipping_address_json TEXT NOT NULL DEFAULT '{}';`);
  }

  if (!orderCols.includes("notes")) {
    db.exec(`ALTER TABLE pl_orders ADD COLUMN notes TEXT;`);
  }

  // Create unique index for idempotency_key (ignoring nulls)
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_pl_orders_idempotency ON pl_orders(idempotency_key) WHERE idempotency_key IS NOT NULL;
  `);

  // Backfill project_id and total_paise for existing orders if any
  db.exec(`
    UPDATE pl_orders
    SET project_id = (
      SELECT project_id FROM pl_quotes WHERE pl_quotes.id = pl_orders.quote_id
    )
    WHERE project_id IS NULL;

    UPDATE pl_orders
    SET total_paise = (deposit_paise + balance_paise)
    WHERE total_paise = 0 AND (deposit_paise > 0 OR balance_paise > 0);
  `);

  // 2. Additive columns on pl_samples
  const sampleCols = db.prepare("PRAGMA table_info(pl_samples)").all().map((c) => c.name);

  if (!sampleCols.includes("quantity")) {
    db.exec(`ALTER TABLE pl_samples ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1;`);
  }

  if (!sampleCols.includes("coupon_code")) {
    db.exec(`ALTER TABLE pl_samples ADD COLUMN coupon_code TEXT;`);
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_pl_samples_coupon ON pl_samples(client_id, coupon_code);
  `);

  if (!sampleCols.includes("revision")) {
    db.exec(`ALTER TABLE pl_samples ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;`);
  }

  if (!sampleCols.includes("tea_recipe_ids_json")) {
    db.exec(`ALTER TABLE pl_samples ADD COLUMN tea_recipe_ids_json TEXT NOT NULL DEFAULT '[]';`);
  }

  if (!sampleCols.includes("notes")) {
    db.exec(`ALTER TABLE pl_samples ADD COLUMN notes TEXT;`);
  }

  // 3. Additive columns on pl_jobs
  const jobCols = db.prepare("PRAGMA table_info(pl_jobs)").all().map((c) => c.name);

  if (!jobCols.includes("revision")) {
    db.exec(`ALTER TABLE pl_jobs ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;`);
  }

  if (!jobCols.includes("override_justification")) {
    db.exec(`ALTER TABLE pl_jobs ADD COLUMN override_justification TEXT;`);
  }

  // 4. Additive columns on pl_qc_milestones
  const qcCols = db.prepare("PRAGMA table_info(pl_qc_milestones)").all().map((c) => c.name);

  if (!qcCols.includes("cupping_score")) {
    db.exec(`ALTER TABLE pl_qc_milestones ADD COLUMN cupping_score REAL;`);
  }

  if (!qcCols.includes("recorded_weight_g")) {
    db.exec(`ALTER TABLE pl_qc_milestones ADD COLUMN recorded_weight_g REAL;`);
  }

  if (!qcCols.includes("target_weight_g")) {
    db.exec(`ALTER TABLE pl_qc_milestones ADD COLUMN target_weight_g REAL;`);
  }

  if (!qcCols.includes("notes")) {
    db.exec(`ALTER TABLE pl_qc_milestones ADD COLUMN notes TEXT;`);
  }

  if (!qcCols.includes("updated_at")) {
    db.exec(`ALTER TABLE pl_qc_milestones ADD COLUMN updated_at TEXT;`);
  }

  // 5. Compatibility View pl_sample_orders
  db.exec(`
    DROP VIEW IF EXISTS pl_sample_orders;
    CREATE VIEW pl_sample_orders AS SELECT * FROM pl_samples;
  `);
}

export function down(_db) {
  // Additive only
}
