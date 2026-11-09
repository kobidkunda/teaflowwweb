import pg from "pg";
const { Client } = pg;

const pgConfig = {
  host: process.env.PGHOST || "localhost",
  port: parseInt(process.env.PGPORT || "5433", 10),
  user: process.env.PGUSER || "teafloww",
  password: process.env.PGPASSWORD || "teafloww",
  database: process.env.PGDATABASE || "teafloww",
};

export async function applyMigration033() {
  const client = new Client(pgConfig);
  await client.connect();
  console.log("Connected to PostgreSQL successfully.");

  try {
    await client.query("BEGIN");
    console.log("Applying 033_blend_lab_intake_projects on PostgreSQL...");

    await client.query(`
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
    const plans = [
      {
        code: "MATCH_QUOTE",
        name: "Match & Quote",
        paise: 29900,
        entitlements: {
          inboundShipments: 1,
          outboundShipments: 0,
          detailedPdf: false,
          developmentIncluded: false,
          includedRevisionRounds: 0,
          includedTrialCandidates: 0,
          turnaroundDays: 5,
          sampleWeightGrams: 100,
        },
      },
      {
        code: "QUALITY_AUDIT",
        name: "Tea Quality Audit",
        paise: 199900,
        entitlements: {
          inboundShipments: 1,
          outboundShipments: 0,
          detailedPdf: true,
          developmentIncluded: false,
          includedRevisionRounds: 0,
          includedTrialCandidates: 0,
          turnaroundDays: 7,
          sampleWeightGrams: 100,
        },
      },
      {
        code: "SIGNATURE",
        name: "Signature Blend Lab",
        paise: 299900,
        entitlements: {
          inboundShipments: 1,
          outboundShipments: 1,
          detailedPdf: true,
          developmentIncluded: true,
          includedRevisionRounds: 1,
          includedTrialCandidates: 2,
          turnaroundDays: 14,
          sampleWeightGrams: 200,
        },
      },
    ];

    for (const p of plans) {
      await client.query(
        `INSERT INTO bl_service_plans (code, public_name, version, total_paise, currency, entitlements_json, tax_classification, tax_rate_bps, active)
         VALUES ($1, $2, 1, $3, 'INR', $4, 'B2B_PROFESSIONAL_SERVICES', 1800, 1)
         ON CONFLICT (code) DO UPDATE SET
           public_name = EXCLUDED.public_name,
           total_paise = EXCLUDED.total_paise,
           entitlements_json = EXCLUDED.entitlements_json,
           tax_rate_bps = EXCLUDED.tax_rate_bps,
           updated_at = CURRENT_TIMESTAMP`,
        [p.code, p.name, p.paise, JSON.stringify(p.entitlements)]
      );
    }

    // Seed sample pincodes
    const pincodes = [
      ["734001", "Siliguri", "West Bengal", 1, "Local Pickup / Origin Lab", 1],
      ["734005", "Siliguri", "West Bengal", 1, "Local Pickup / Origin Lab", 1],
      ["700001", "Kolkata", "West Bengal", 1, "Blue Dart Express", 2],
      ["110001", "New Delhi", "Delhi", 1, "Blue Dart Express", 3],
      ["400001", "Mumbai", "Maharashtra", 1, "Delhivery Cargo", 3],
      ["560001", "Bengaluru", "Karnataka", 1, "Delhivery Cargo", 3],
    ];

    for (const [pin, city, state, serv, carrier, days] of pincodes) {
      await client.query(
        `INSERT INTO bl_pincode_coverage (pincode, city, state, serviceable, carrier, estimated_days)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (pincode) DO NOTHING`,
        [pin, city, state, serv, carrier, days]
      );
    }

    await client.query(`
      INSERT INTO schema_migrations (version, applied_at)
      VALUES ('033_blend_lab_intake_projects', CURRENT_TIMESTAMP)
      ON CONFLICT (version) DO NOTHING
    `);

    await client.query("COMMIT");
    console.log("Migration 033 applied successfully to PostgreSQL!");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Migration 033 failed, rolled back:", error);
    throw error;
  } finally {
    await client.end();
  }
}

if (process.argv[1]?.endsWith("apply-pg-migration-033.mjs")) {
  applyMigration033().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
