// 051: Master toggle for online payments (UPI, Cards, Netbanking via Razorpay/YouPI) vs COD-only mode
export function up(db) {
  const defaults = [
    ["online_payment_enabled", "1"],
  ];

  const stmt = db.prepare(
    "INSERT OR IGNORE INTO store_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)"
  );
  for (const [k, v] of defaults) {
    stmt.run(k, v);
  }
}

export function down(db) {
  try {
    db.prepare("DELETE FROM store_settings WHERE key = 'online_payment_enabled'").run();
  } catch {}
}
