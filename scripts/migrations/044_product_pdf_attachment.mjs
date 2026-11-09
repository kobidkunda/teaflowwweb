// 044: Add pdf_url and pdf_title columns to products table for estate tasting sheets, batch certificates & lab reports.
export function up(db) {
  const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='products'").get();
  if (table) {
    const cols = new Set(
      db.prepare("PRAGMA table_info(products)").all().map((c) => c.name)
    );

    if (!cols.has("pdf_url")) {
      db.exec("ALTER TABLE products ADD COLUMN pdf_url TEXT DEFAULT NULL;");
    }

    if (!cols.has("pdf_title")) {
      db.exec("ALTER TABLE products ADD COLUMN pdf_title TEXT DEFAULT NULL;");
    }
  }
}

export function down() {}
