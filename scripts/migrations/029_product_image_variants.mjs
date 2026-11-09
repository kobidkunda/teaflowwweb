// Images may be shared by several pack variants. Empty assignments mean shared.
export function up(db) {
  const columns = db.prepare("PRAGMA table_info(product_images)").all();
  if (!columns.some((column) => column.name === "variant_skus")) {
    db.exec("ALTER TABLE product_images ADD COLUMN variant_skus TEXT NOT NULL DEFAULT '[]'");
  }
}
export function down() {}
