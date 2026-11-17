// 063: TeaFloww Trade (/tea-shops) UTM Attribution on Enquiries, 8 Pan-India Locales,
// Trial 4x25g Weight Consistency & Core Milk-Chai Trade Offer Alignment.
// Additive, versioned, idempotent for SQLite.

export function up(db) {
  // 1. Add UTM & CTA attribution columns to trade_enquiries
  const enqCols = new Set(
    db.prepare("PRAGMA table_info(trade_enquiries)").all().map((c) => c.name)
  );
  if (enqCols.size > 0) {
    const columns = [
      ["utm_source", "TEXT NOT NULL DEFAULT ''"],
      ["utm_medium", "TEXT NOT NULL DEFAULT ''"],
      ["utm_campaign", "TEXT NOT NULL DEFAULT ''"],
      ["utm_term", "TEXT NOT NULL DEFAULT ''"],
      ["utm_content", "TEXT NOT NULL DEFAULT ''"],
      ["gclid", "TEXT NOT NULL DEFAULT ''"],
      ["fbclid", "TEXT NOT NULL DEFAULT ''"],
      ["landing_page", "TEXT NOT NULL DEFAULT ''"],
      ["referrer", "TEXT NOT NULL DEFAULT ''"],
      ["funnel_name", "TEXT NOT NULL DEFAULT 'trade_tea_shops'"],
      ["cta_source", "TEXT NOT NULL DEFAULT ''"],
    ];
    for (const [col, def] of columns) {
      if (!enqCols.has(col)) {
        db.exec(`ALTER TABLE trade_enquiries ADD COLUMN ${col} ${def};`);
      }
    }
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_trade_enquiries_campaign
      ON trade_enquiries(utm_campaign, utm_source, created_at DESC);
    `);
  }

  // 2. Enable all 8 planned Pan-India trade locales in trade_settings when still at starter defaults
  try {
    const settingsRow = db
      .prepare("SELECT enabled_locales_json, featured_trial_id FROM trade_settings WHERE id = 'default'")
      .get();
    if (settingsRow) {
      let enabled = [];
      try {
        enabled = JSON.parse(String(settingsRow.enabled_locales_json || "[]"));
      } catch {
        enabled = [];
      }
      const targetEight = ["en", "hi", "bn", "pa", "mr", "gu", "ta", "te"];
      const isStarterFive =
        Array.isArray(enabled) &&
        enabled.length === 5 &&
        ["en", "bn", "hi", "gu", "mr"].every((l) => enabled.includes(l));

      if (isStarterFive || enabled.length === 0) {
        db.prepare(
          "UPDATE trade_settings SET enabled_locales_json = ?, staged_locales_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 'default'"
        ).run(JSON.stringify(targetEight), JSON.stringify(["kn"]));
      }

      // Pin featured trial to 4-x-25-gm when unset and that published kit exists
      if (!settingsRow.featured_trial_id) {
        const fourBy25 = db
          .prepare("SELECT id FROM trials WHERE (slug = '4-x-25-gm' OR sku = 'KIT-4-X-25-GM') AND status = 'published' LIMIT 1")
          .get();
        if (fourBy25?.id) {
          db.prepare(
            "UPDATE trade_settings SET featured_trial_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 'default'"
          ).run(fourBy25.id);
        }
      }
    }
  } catch {
    // Non-fatal in minimal test schemas without trials table
  }

  // 3. Reconcile 4-x-25-gm trial component weights (4 x 25 g = 100 g) so title & pouch weights agree
  try {
    const trialRow = db
      .prepare("SELECT id FROM trials WHERE slug = '4-x-25-gm' OR sku = 'KIT-4-X-25-GM' LIMIT 1")
      .get();
    if (trialRow?.id) {
      db.prepare("UPDATE trials SET net_weight_g = 100 WHERE id = ? AND net_weight_g != 100").run(
        trialRow.id
      );
      db.prepare("UPDATE trial_components SET weight_g = 25 WHERE trial_id = ? AND weight_g != 25").run(
        trialRow.id
      );
    }
  } catch {
    // Non-fatal in minimal test schemas
  }

  // 4. Prioritize core Tea-Shop Milk Chai blends in trade_offers if they exist and are not yet featured
  try {
    const coreSlugs = [
      { slug: "everyday-strong-milk-chai", order: 1, badge: "Daily Stall Blend", imageUrl: "/uploads/upload_1791926804286_d7cf40b2f1c2_teafloww-product-everyday-strong-milk-chai-1200x1200.webp" },
      { slug: "elaichi-milk-chai", order: 2, badge: "Cardamom Chai", imageUrl: "/uploads/upload_1791926805750_13912cf9d9e8_teafloww-product-elaichi-milk-chai-1200x1200.webp" },
      { slug: "ginger-milk-chai", order: 3, badge: "Adrak Chai", imageUrl: "/uploads/upload_1791926831927_0f12501ac96c_teafloww-product-ginger-milk-chai-1200x1200.webp" },
      { slug: "balanced-masala-milk-chai", order: 4, badge: "Spiced Chai", imageUrl: "/images/ctc-brew/method-02-masala-chai.webp" },
    ];

    const hasMilkChaiOffer = db
      .prepare(
        `SELECT o.id FROM trade_offers o
         JOIN products p ON p.id = o.product_id
         WHERE p.slug IN ('everyday-strong-milk-chai','elaichi-milk-chai','ginger-milk-chai','balanced-masala-milk-chai')
         LIMIT 1`
      )
      .get();

    if (!hasMilkChaiOffer) {
      // Shift starter sample offers (IDs 1..8) down so Milk Chai blends lead the trade shelf
      db.prepare("UPDATE trade_offers SET featured_order = featured_order + 10").run();
      for (const item of coreSlugs) {
        const prod = db
          .prepare("SELECT id, name FROM products WHERE slug = ? LIMIT 1")
          .get(item.slug);
        if (!prod?.id) continue;
        db.prepare(`
          INSERT INTO trade_offers (product_id, featured_order, published, badge_text, updated_at)
          VALUES (?, ?, 1, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(product_id) DO UPDATE SET
            featured_order = excluded.featured_order,
            published = 1,
            badge_text = COALESCE(trade_offers.badge_text, excluded.badge_text),
            updated_at = CURRENT_TIMESTAMP
        `).run(prod.id, item.order, item.badge);

        // Attach a product_image only if none exists yet for this product
        const hasImg = db
          .prepare("SELECT id FROM product_images WHERE product_id = ? LIMIT 1")
          .get(prod.id);
        if (!hasImg) {
          db.prepare(
            "INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary) VALUES (?, ?, ?, 0, 1)"
          ).run(prod.id, item.imageUrl, `${prod.name} pack`);
        }
      }
    }
  } catch {
    // Non-fatal in minimal test schemas
  }
}

export function down() {
  // Additive-only policy
}
