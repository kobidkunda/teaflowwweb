// 026: Update brand tagline to Orthodox & CTC Teas from Origin
export function up(db) {
  // 1. Update site_content_blocks for brand.tagline
  const hasContentBlocks = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='site_content_blocks'")
    .get();

  if (hasContentBlocks) {
    db.prepare(`
      UPDATE site_content_blocks
      SET content = 'Orthodox & CTC Teas from Origin', updated_at = datetime('now')
      WHERE key = 'brand.tagline'
    `).run();
  }

  // 2. Update store_settings if brand_tagline is present
  const hasStoreSettings = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='store_settings'")
    .get();

  if (hasStoreSettings) {
    db.prepare(`
      UPDATE store_settings
      SET value = 'Orthodox & CTC Teas from Origin', updated_at = CURRENT_TIMESTAMP
      WHERE key = 'brand_tagline'
    `).run();
  }
}

export function down() {}
