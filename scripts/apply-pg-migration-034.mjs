import pg from "pg";
const { Client } = pg;

const pgConfig = {
  host: process.env.PGHOST || "localhost",
  port: parseInt(process.env.PGPORT || "5433", 10),
  user: process.env.PGUSER || "teafloww",
  password: process.env.PGPASSWORD || "teafloww",
  database: process.env.PGDATABASE || "teafloww",
};

export async function applyMigration034() {
  const client = new Client(pgConfig);
  await client.connect();
  console.log("Connected to PostgreSQL successfully.");

  try {
    await client.query("BEGIN");
    console.log("Applying 034_shiprocket_and_shipping_settings on PostgreSQL...");

    const defaults = [
      ["free_shipping_threshold_paise", "59900"],
      ["shipping_flat_fee_paise", "9900"],
      ["shipping_calculation_mode", "flat"],
      ["shiprocket_enabled", "1"],
      ["shiprocket_email", process.env.SHIPROCKET_EMAIL || ""],
      ["shiprocket_password", process.env.SHIPROCKET_PASSWORD || ""],
      ["shiprocket_pickup_location", "Primary"],
      ["shiprocket_pickup_postcode", "734015"],
      ["shiprocket_default_length", "10"],
      ["shiprocket_default_breadth", "10"],
      ["shiprocket_default_height", "10"],
      ["shiprocket_default_tare_grams", "100"],
      ["shiprocket_default_hsn", "090230"],
      ["razorpay_enabled", "1"],
      ["cod_enabled", "1"],
      ["cod_fee_paise", "0"],
      ["cod_min_paise", "0"],
      ["cod_max_paise", "100000"],
      ["announcement_auto_sync", "1"],
    ];

    for (const [key, val] of defaults) {
      await client.query(
        "INSERT INTO store_settings (key, value, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT (key) DO NOTHING",
        [key, val]
      );
    }

    // Update threshold to 59900 if it was 150000
    await client.query(
      "UPDATE store_settings SET value = '59900', updated_at = CURRENT_TIMESTAMP WHERE key = 'free_shipping_threshold_paise' AND value = '150000'"
    );

    // Update commerce_markets 'IN'
    const res = await client.query("SELECT document FROM commerce_markets WHERE code = 'IN'");
    if (res.rows.length > 0) {
      const doc = JSON.parse(res.rows[0].document);
      doc.freeAbovePaise = 59900;
      doc.flatPaise = 9900;
      await client.query(
        "UPDATE commerce_markets SET document = $1, version = version + 1 WHERE code = 'IN'",
        [JSON.stringify(doc)]
      );
    }

    await client.query("COMMIT");
    console.log("Migration 034 applied successfully to PostgreSQL.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Migration 034 failed on PostgreSQL:", err);
    throw err;
  } finally {
    await client.end();
  }
}

if (process.argv[1]?.endsWith("apply-pg-migration-034.mjs")) {
  applyMigration034().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
