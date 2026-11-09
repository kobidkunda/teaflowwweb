// Additive SQLite migration. PostgreSQL equivalent is documented in docs/TEA_MOMENTS.md.
export function up(db) {
  const columns = db.prepare("PRAGMA table_info(products)").all();
  if (!columns.some((column) => column.name === "tea_moments")) {
    db.exec("ALTER TABLE products ADD COLUMN tea_moments TEXT DEFAULT NULL");
  }
}
