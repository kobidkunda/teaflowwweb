// 018: Google Tag Manager, GA4 & Meta Pixel tracking settings in store_settings
export function up(db) {
  const defaults = [
    ["gtm_container_id", "GTM-M5G27HSQ"],
    ["gtm_enabled", "1"],
    ["ga4_measurement_id", ""],
    ["ga4_enabled", "0"],
    ["meta_pixel_id", ""],
    ["meta_pixel_enabled", "0"],
    ["custom_head_script", ""],
    ["custom_body_script", ""],
  ];

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO store_settings (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
  `);

  for (const [key, value] of defaults) {
    stmt.run(key, value);
  }
}

export function down() {}
