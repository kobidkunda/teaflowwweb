import pg from "pg";
const { Client } = pg;

const pgConfig = {
  host: process.env.PGHOST || "localhost",
  port: parseInt(process.env.PGPORT || "5433", 10),
  user: process.env.PGUSER || "teafloww",
  password: process.env.PGPASSWORD || "teafloww",
  database: process.env.PGDATABASE || "teafloww",
};

export async function applyMigration031() {
  const client = new Client(pgConfig);
  await client.connect();
  console.log("Connected to PostgreSQL successfully.");

  try {
    await client.query("BEGIN");
    console.log("Applying 031_international_commerce on PostgreSQL...");

    await client.query(`
      CREATE TABLE IF NOT EXISTS commerce_markets (
        code TEXT PRIMARY KEY,
        document TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE IF NOT EXISTS commerce_config (
        key TEXT PRIMARY KEY,
        document TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS commerce_fx (
        id TEXT PRIMARY KEY,
        document TEXT NOT NULL,
        updated_ms BIGINT NOT NULL,
        next_ms BIGINT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS commerce_quotes (
        id TEXT PRIMARY KEY,
        owner TEXT NOT NULL,
        document TEXT NOT NULL,
        expires_ms BIGINT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS commerce_orders (
        id TEXT PRIMARY KEY,
        owner TEXT NOT NULL,
        idempotency_key TEXT NOT NULL UNIQUE,
        quote_id TEXT NOT NULL UNIQUE REFERENCES commerce_quotes(id),
        document TEXT NOT NULL,
        payment_status TEXT NOT NULL,
        fulfillment_status TEXT NOT NULL DEFAULT 'unfulfilled',
        gateway_order_id TEXT UNIQUE,
        gateway_payment_id TEXT UNIQUE,
        reserved_until BIGINT NOT NULL,
        inventory_status TEXT NOT NULL DEFAULT 'reserved',
        refund_minor BIGINT NOT NULL DEFAULT 0,
        created_ms BIGINT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS commerce_reservations (
        order_id TEXT NOT NULL REFERENCES commerce_orders(id),
        variant_id INTEGER NOT NULL REFERENCES variants(id),
        quantity INTEGER NOT NULL CHECK(quantity > 0),
        PRIMARY KEY(order_id, variant_id)
      );
      CREATE TABLE IF NOT EXISTS commerce_coupon_holds (
        order_id TEXT PRIMARY KEY REFERENCES commerce_orders(id),
        code TEXT NOT NULL REFERENCES coupons(code)
      );
      CREATE TABLE IF NOT EXISTS commerce_events (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        document TEXT NOT NULL,
        created_ms BIGINT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS commerce_shipments (
        order_id TEXT PRIMARY KEY REFERENCES commerce_orders(id),
        document TEXT NOT NULL,
        status TEXT NOT NULL,
        updated_ms BIGINT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS commerce_translations (
        id TEXT PRIMARY KEY,
        resource TEXT NOT NULL,
        locale TEXT NOT NULL,
        source_hash TEXT NOT NULL,
        source TEXT NOT NULL,
        draft TEXT,
        published TEXT,
        published_hash TEXT,
        revision INTEGER NOT NULL DEFAULT 1,
        updated_ms BIGINT NOT NULL,
        UNIQUE(resource, locale)
      );
      CREATE TABLE IF NOT EXISTS commerce_translation_history (
        id TEXT PRIMARY KEY,
        translation_id TEXT NOT NULL REFERENCES commerce_translations(id),
        document TEXT NOT NULL,
        created_ms BIGINT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS commerce_jobs (
        id TEXT PRIMARY KEY,
        dedupe_key TEXT NOT NULL UNIQUE,
        kind TEXT NOT NULL,
        document TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'queued',
        attempts INTEGER NOT NULL DEFAULT 0,
        run_ms BIGINT NOT NULL,
        lease_ms BIGINT NOT NULL DEFAULT 0,
        error TEXT,
        created_ms BIGINT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS commerce_campaigns (
        id TEXT PRIMARY KEY,
        document TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS commerce_audit (
        id TEXT PRIMARY KEY,
        actor TEXT NOT NULL,
        action TEXT NOT NULL,
        document TEXT NOT NULL,
        created_ms BIGINT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS commerce_jobs_ready ON commerce_jobs(status, run_ms);
      CREATE INDEX IF NOT EXISTS commerce_orders_expiry ON commerce_orders(inventory_status, reserved_until);
    `);

    // Seed default packaging preset
    const defaultPackage = {
      pickupPostcode: "734005",
      pickupLocation: "Siliguri Works",
      length: 20,
      breadth: 15,
      height: 10,
      tareGrams: 100,
      maxGrams: 5000,
      hsn: "090210",
      origin: "IN",
    };
    await client.query(
      "INSERT INTO commerce_config (key, document) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING",
      ["package", JSON.stringify(defaultPackage)]
    );

    // Seed baseline FX snapshot
    const baselineFx = {
      id: "fx-seed-baseline",
      rates: {
        INR: "1", USD: "0.0118", EUR: "0.0110", GBP: "0.0094", AED: "0.0433",
        CAD: "0.0163", AUD: "0.0182", JPY: "1.815", SGD: "0.0157", SAR: "0.0442",
        CHF: "0.0105", NZD: "0.0198", SEK: "0.126", NOK: "0.128", DKK: "0.082",
        PLN: "0.047", QAR: "0.043", KWD: "0.00363", BHD: "0.00445", OMR: "0.00454",
        ZAR: "0.215", BRL: "0.067", MXN: "0.235", HKD: "0.092", KRW: "16.2",
        TWD: "0.38", THB: "0.41", MYR: "0.052", PHP: "0.68", IDR: "188",
        VND: "298", TRY: "0.41", EGP: "0.58",
      },
      updated: Date.now(),
      next: Date.now() + 86400000 * 365,
    };
    await client.query(
      "INSERT INTO commerce_fx (id, document, updated_ms, next_ms) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING",
      [baselineFx.id, JSON.stringify(baselineFx), baselineFx.updated, baselineFx.next]
    );

    // Fetch existing settings if present for defaults
    const flatRes = await client.query("SELECT value FROM store_settings WHERE key = 'shipping_flat_fee_paise'");
    const freeRes = await client.query("SELECT value FROM store_settings WHERE key = 'free_shipping_threshold_paise'");

    const flatPaise = Number(flatRes.rows[0]?.value || 9900);
    const freeAbovePaise = Number(freeRes.rows[0]?.value || 150000);

    const defaultMarket = {
      code: "IN",
      name: "India",
      covered: true,
      enabled: true,
      currency: "INR",
      language: "en",
      approvedCurrencies: ["INR"],
      taxApproved: true,
      taxPercent: 0,
      taxInclusive: true,
      exportApproved: true,
      duties: "recipient",
      shipping: "flat",
      flatPaise,
      freeAbovePaise,
      handlingPaise: 0,
      subsidyPaise: 0,
      fxMarkupBps: 0,
      roundingMinor: 1,
      blockedPostcodes: [],
      blockedStates: [],
      blockedSkus: [],
      cod: {
        enabled: true,
        postcodes: ["734001", "734005", "700001", "110001", "400001", "560001"],
        minPaise: 50000,
        maxPaise: 100000,
        feePaise: 5000,
        blockedSkus: [],
      },
    };

    await client.query(
      "INSERT INTO commerce_markets (code, document) VALUES ($1, $2) ON CONFLICT (code) DO UPDATE SET document=EXCLUDED.document",
      ["IN", JSON.stringify(defaultMarket)]
    );

    await client.query(`
      INSERT INTO schema_migrations (version, applied_at)
      VALUES ('031_international_commerce', CURRENT_TIMESTAMP)
      ON CONFLICT (version) DO NOTHING
    `);

    await client.query("COMMIT");
    console.log("Migration 031 applied successfully to PostgreSQL!");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Migration 031 failed, rolled back:", error);
    throw error;
  } finally {
    await client.end();
  }
}

if (process.argv[1]?.endsWith("apply-pg-migration-031.mjs")) {
  applyMigration031().catch(() => process.exit(1));
}
