/**
 * Migration 035: Test vs Production Modes for Payment & Shipping, plus Auto-Dispatch
 * Adds environment mode toggles (test/prod) for Razorpay & Shiprocket, separate
 * credential slots for test & production, and configurable order creation trigger (manual vs auto).
 */
export function up(db) {
  const defaults = [
    ["payment_mode", "test"],
    ["razorpay_test_key_id", process.env.RAZORPAY_TEST_KEY_ID || process.env.RAZORPAY_KEY_ID || ""],
    ["razorpay_test_key_secret", process.env.RAZORPAY_TEST_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET || ""],
    ["razorpay_test_webhook_secret", process.env.RAZORPAY_TEST_WEBHOOK_SECRET || process.env.RAZORPAY_WEBHOOK_SECRET || ""],
    ["razorpay_prod_key_id", process.env.RAZORPAY_PROD_KEY_ID || ""],
    ["razorpay_prod_key_secret", process.env.RAZORPAY_PROD_KEY_SECRET || ""],
    ["razorpay_prod_webhook_secret", process.env.RAZORPAY_PROD_WEBHOOK_SECRET || ""],
    ["shiprocket_mode", "test"],
    ["shiprocket_order_creation_mode", "manual"],
    ["shiprocket_test_email", process.env.SHIPROCKET_TEST_EMAIL || process.env.SHIPROCKET_EMAIL || ""],
    ["shiprocket_test_password", process.env.SHIPROCKET_TEST_PASSWORD || process.env.SHIPROCKET_PASSWORD || ""],
    ["shiprocket_prod_email", process.env.SHIPROCKET_PROD_EMAIL || ""],
    ["shiprocket_prod_password", process.env.SHIPROCKET_PROD_PASSWORD || ""],
  ];

  const insertStmt = db.prepare(
    "INSERT OR IGNORE INTO store_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)"
  );
  for (const [key, val] of defaults) {
    insertStmt.run(key, val);
  }
}

export function down(db) {
  const keys = [
    "payment_mode",
    "razorpay_test_key_id",
    "razorpay_test_key_secret",
    "razorpay_test_webhook_secret",
    "razorpay_prod_key_id",
    "razorpay_prod_key_secret",
    "razorpay_prod_webhook_secret",
    "shiprocket_mode",
    "shiprocket_order_creation_mode",
    "shiprocket_test_email",
    "shiprocket_test_password",
    "shiprocket_prod_email",
    "shiprocket_prod_password",
  ];
  const deleteStmt = db.prepare("DELETE FROM store_settings WHERE key = ?");
  for (const key of keys) {
    deleteStmt.run(key);
  }
}
