// 020: Set Darjeeling Spring live entry price to ₹199 (19,900 paise)
// Additive, versioned, 100% idempotent data migration.

export function up(db) {
  // Update Darjeeling spring first flush entry variants to ₹199 (19,900 paise)
  db.prepare(`
    UPDATE variants
    SET price_paise = 19900
    WHERE product_id IN (SELECT id FROM products WHERE slug = 'darjeeling-spring')
      AND (sku IN ('DJ-SP-50', 'DJ-SP-100') OR grams = 50)
  `).run();
}

export function down() {}
