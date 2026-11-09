/**
 * Postgres companion script for Migration 035
 * Test vs Production Modes for Payment & Shipping, plus Auto-Dispatch
 */
export async function upPg(sql) {
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

  for (const [key, val] of defaults) {
    await sql`
      INSERT INTO store_settings (key, value, updated_at)
      VALUES (${key}, ${val}, CURRENT_TIMESTAMP)
      ON CONFLICT (key) DO NOTHING
    `;
  }
}
