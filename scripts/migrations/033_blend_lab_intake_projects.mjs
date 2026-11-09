/**
 * Migration 033: TeaFloww Blend Lab Service Plans, Projects, Briefs & Coverage
 * Versioned additive schema for Milestones A & B.
 */
export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS bl_service_plans (
      code TEXT PRIMARY KEY,
      public_name TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      total_paise INTEGER NOT NULL CHECK (total_paise >= 0),
      currency TEXT NOT NULL DEFAULT 'INR',
      entitlements_json TEXT NOT NULL,
      tax_classification TEXT NOT NULL DEFAULT 'B2B_PROFESSIONAL_SERVICES',
      tax_rate_bps INTEGER NOT NULL DEFAULT 1800,
      active INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bl_projects (
      id TEXT PRIMARY KEY,
      public_id TEXT UNIQUE NOT NULL,
      owner_customer_id TEXT NOT NULL,
      plan_code TEXT NOT NULL REFERENCES bl_service_plans(code),
      plan_version INTEGER NOT NULL,
      plan_entitlements_snapshot TEXT NOT NULL,
      total_paise INTEGER NOT NULL CHECK (total_paise >= 0),
      tax_snapshot TEXT NOT NULL,
      payment_state TEXT NOT NULL DEFAULT 'draft',
      workflow_state TEXT NOT NULL DEFAULT 'draft_submitted',
      business_name TEXT,
      contact_name TEXT NOT NULL,
      contact_email TEXT NOT NULL,
      contact_phone TEXT NOT NULL,
      pickup_pincode TEXT NOT NULL,
      pickup_address TEXT NOT NULL,
      pickup_serviceable INTEGER NOT NULL DEFAULT 1,
      terms_version TEXT NOT NULL,
      idempotency_key TEXT UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_bl_projects_owner ON bl_projects(owner_customer_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_bl_projects_public_id ON bl_projects(public_id);
    CREATE INDEX IF NOT EXISTS idx_bl_projects_idempotency ON bl_projects(idempotency_key);

    CREATE TABLE IF NOT EXISTS bl_project_briefs (
      project_id TEXT PRIMARY KEY REFERENCES bl_projects(id) ON DELETE CASCADE,
      tea_category TEXT NOT NULL,
      leaf_grade TEXT,
      current_price_per_kg INTEGER,
      sample_weight_grams INTEGER NOT NULL DEFAULT 100,
      primary_use_case TEXT NOT NULL,
      goal_type TEXT NOT NULL,
      target_price_per_kg INTEGER,
      sensory_targets_json TEXT,
      notes TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bl_pincode_coverage (
      pincode TEXT PRIMARY KEY,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      serviceable INTEGER NOT NULL DEFAULT 1,
      carrier TEXT NOT NULL DEFAULT 'Express Cargo',
      estimated_days INTEGER NOT NULL DEFAULT 3
    );
  `);

  // Seed standard plans into bl_service_plans
  const insertPlan = db.prepare(`
    INSERT INTO bl_service_plans (code, public_name, version, total_paise, currency, entitlements_json, tax_classification, tax_rate_bps, active)
    VALUES (?, ?, 1, ?, 'INR', ?, 'B2B_PROFESSIONAL_SERVICES', 1800, 1)
    ON CONFLICT(code) DO UPDATE SET
      public_name = excluded.public_name,
      total_paise = excluded.total_paise,
      entitlements_json = excluded.entitlements_json,
      tax_rate_bps = excluded.tax_rate_bps,
      updated_at = CURRENT_TIMESTAMP
  `);

  insertPlan.run(
    'MATCH_QUOTE',
    'Match & Quote',
    29900,
    JSON.stringify({
      inboundShipments: 1,
      outboundShipments: 0,
      detailedPdf: false,
      developmentIncluded: false,
      includedRevisionRounds: 0,
      includedTrialCandidates: 0,
      turnaroundDays: 5,
      sampleWeightGrams: 100,
    })
  );

  insertPlan.run(
    'QUALITY_AUDIT',
    'Tea Quality Audit',
    199900,
    JSON.stringify({
      inboundShipments: 1,
      outboundShipments: 0,
      detailedPdf: true,
      developmentIncluded: false,
      includedRevisionRounds: 0,
      includedTrialCandidates: 0,
      turnaroundDays: 7,
      sampleWeightGrams: 100,
    })
  );

  insertPlan.run(
    'SIGNATURE',
    'Signature Blend Lab',
    299900,
    JSON.stringify({
      inboundShipments: 1,
      outboundShipments: 1,
      detailedPdf: true,
      developmentIncluded: true,
      includedRevisionRounds: 1,
      includedTrialCandidates: 2,
      turnaroundDays: 14,
      sampleWeightGrams: 200,
    })
  );

  // Seed sample pincodes for testing and demo
  const insertPin = db.prepare(`
    INSERT INTO bl_pincode_coverage (pincode, city, state, serviceable, carrier, estimated_days)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(pincode) DO NOTHING
  `);

  // Siliguri (origin), Kolkata, Delhi, Mumbai, Bangalore
  insertPin.run('734001', 'Siliguri', 'West Bengal', 1, 'Local Pickup / Origin Lab', 1);
  insertPin.run('734005', 'Siliguri', 'West Bengal', 1, 'Local Pickup / Origin Lab', 1);
  insertPin.run('700001', 'Kolkata', 'West Bengal', 1, 'Blue Dart Express', 2);
  insertPin.run('110001', 'New Delhi', 'Delhi', 1, 'Blue Dart Express', 3);
  insertPin.run('400001', 'Mumbai', 'Maharashtra', 1, 'Delhivery Cargo', 3);
  insertPin.run('560001', 'Bengaluru', 'Karnataka', 1, 'Delhivery Cargo', 3);
}

export function down() {}
