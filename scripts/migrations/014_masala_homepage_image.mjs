// Repair a demo content association, preserving all operator replacements.
// Online backup precedes application; restore it to roll back content.
export function up(db) {
  const hasImages = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='product_images'").get();
  if (!hasImages) return;
  const product = db.prepare("SELECT id FROM products WHERE slug=?").get("masala-chai-reserve");
  if (!product) return;
  db.prepare("UPDATE product_images SET url=?,alt_text=?,media_id=NULL WHERE product_id=? AND url=?")
    .run("/images/home/masala-chai.webp", "Decorative AI still life of spiced tea, cardamom, cinnamon and ginger; actual product packaging may differ.", product.id, "/uploads/product-assam-tin.jpg");
}
