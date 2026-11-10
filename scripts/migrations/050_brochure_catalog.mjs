// 050: Brochure & Product Catalogue settings in store_settings
export function up(db) {
  const defaults = [
    ["brochure_url", "/uploads/teafloww-tea-catalog-brochure-2026.pdf"],
    ["brochure_title", "TeaFloww Sourcing & Product Brochure Catalogue 2026"],
    ["brochure_description", "Direct-from-origin single-estate orthodox teas, harvest profiles, wholesale packaging specifications, and procurement guide."],
    ["brochure_button_label", "Download Brochure"],
    ["brochure_enabled", "1"],
    ["brochure_file_size", "3230"],
  ];

  const stmt = db.prepare(
    "INSERT OR IGNORE INTO store_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)"
  );
  for (const [k, v] of defaults) {
    stmt.run(k, v);
  }
}

export function down() {}
