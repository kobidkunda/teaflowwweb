// 024: Add compare_at_price_paise to variants for promotional discount pricing
export function up(db) {
  const cols = (db.prepare("PRAGMA table_info(variants)").all()).map((c) => c.name);
  if (!cols.includes("compare_at_price_paise")) {
    db.exec(`
      ALTER TABLE variants ADD COLUMN compare_at_price_paise INTEGER CHECK(compare_at_price_paise IS NULL OR compare_at_price_paise >= 0);
    `);
  }

  // Set truthful, realistic promotional compare-at prices (MRP) on flagship harvest lots:
  // - Darjeeling Spring (₹199 selling price) -> compare-at ₹249 (20% discount)
  // - Assam Golden Breakfast (₹399 selling price) -> compare-at ₹499 (20% discount)
  // - Nilgiri Mist Green (₹699 selling price) -> compare-at ₹849 (18% discount)
  // - Masala Chai Reserve (₹379 selling price) -> compare-at ₹449 (16% discount)
  // - Himalayan White Peony (₹549 selling price) -> compare-at ₹649 (15% discount)
  db.prepare(`
    UPDATE variants
    SET compare_at_price_paise = CASE
      WHEN price_paise = 19900 THEN 24900
      WHEN price_paise = 39900 THEN 49900
      WHEN price_paise = 69900 THEN 84900
      WHEN price_paise = 37900 THEN 44900
      WHEN price_paise = 54900 THEN 64900
      ELSE NULL
    END
    WHERE compare_at_price_paise IS NULL
  `).run();
}

export function down() {}
