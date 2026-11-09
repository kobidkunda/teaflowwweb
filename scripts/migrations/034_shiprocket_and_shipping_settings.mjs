/**
 * Migration 034: Shiprocket Logistics Configuration & Free Delivery Threshold
 * Sets default ₹599 free shipping threshold (59900 paise) and standard ₹99 flat fee (9900 paise),
 * synchronizes the India ('IN') market document, and establishes shiprocket defaults.
 */
export function up(db) {
  // 1. Ensure default shipping and payment keys in store_settings
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

  const insertStmt = db.prepare(
    "INSERT OR IGNORE INTO store_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)"
  );
  for (const [key, val] of defaults) {
    insertStmt.run(key, val);
  }

  // 2. Synchronize commerce_markets document for 'IN' (India)
  try {
    const inRow = db.prepare("SELECT document FROM commerce_markets WHERE code = 'IN'").get();
    if (inRow && inRow.document) {
      const doc = JSON.parse(inRow.document);
      doc.freeAbovePaise = 59900; // Free above ₹599
      doc.flatPaise = 9900;       // Flat ₹99
      db.prepare(
        "UPDATE commerce_markets SET document = ?, version = version + 1 WHERE code = 'IN'"
      ).run(JSON.stringify(doc));
    }
  } catch {
    // commerce_markets might not exist in early tests
  }

  // 3. Ensure default package configuration in commerce_config if not present
  try {
    const pkgRow = db.prepare("SELECT document FROM commerce_config WHERE key = 'package'").get();
    if (!pkgRow) {
      const defaultPackage = {
        pickupPostcode: "734015",
        pickupLocation: "Primary",
        length: 10,
        breadth: 10,
        height: 10,
        tareGrams: 100,
        maxGrams: 5000,
        hsn: "090230",
        origin: "IN",
      };
      db.prepare("INSERT INTO commerce_config (key, document) VALUES (?, ?)").run(
        "package",
        JSON.stringify(defaultPackage)
      );
    }
  } catch {
    // commerce_config might not exist
  }
}

export function down() {}
