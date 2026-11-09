// Additive availability flag; publication state, stock and order history are preserved.
export function up(db) {
  const columns = db.prepare("PRAGMA table_info(products)").all();
  if (!columns.some((column) => column.name === "is_enabled")) {
    db.exec("ALTER TABLE products ADD COLUMN is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1))");
  }
}
export function down() {}
