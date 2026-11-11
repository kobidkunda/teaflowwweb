// 054: Wholesale order advance payment percent (x%) and bank account transfer configuration
export function up(db) {
  const defaults = [
    ["wholesale_advance_percent", "0"],
    ["wholesale_bank_beneficiary", "Nirva"],
    ["wholesale_bank_name", "HDFC Bank"],
    ["wholesale_bank_account_number", ""],
    ["wholesale_bank_ifsc", ""],
    ["wholesale_bank_branch", "Siliguri"],
    ["wholesale_bank_upi_id", ""],
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
    db.prepare(`
      DELETE FROM store_settings WHERE key IN (
        'wholesale_advance_percent',
        'wholesale_bank_beneficiary',
        'wholesale_bank_name',
        'wholesale_bank_account_number',
        'wholesale_bank_ifsc',
        'wholesale_bank_branch',
        'wholesale_bank_upi_id'
      )
    `).run();
  } catch {}
}
