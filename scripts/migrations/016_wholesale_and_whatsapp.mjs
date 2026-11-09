// 016: wholesale inquiries table & default whatsapp number in store_settings
export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS wholesale_inquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      business_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      interest TEXT NOT NULL,
      estimated_volume TEXT NOT NULL,
      location TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_wholesale_inquiries_created_at ON wholesale_inquiries(created_at DESC);
  `);

  db.prepare(`
    INSERT OR IGNORE INTO store_settings (key, value, updated_at)
    VALUES ('whatsapp_number', '+91 98320 12345', CURRENT_TIMESTAMP)
  `).run();
}

export function down() {}
