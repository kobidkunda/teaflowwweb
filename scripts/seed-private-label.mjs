import Database from "better-sqlite3";
import path from "node:path";

export function seedPrivateLabelCatalog(db) {
  db.transaction(() => {
    // 1. Packaging families
    const families = [
      { code: "pouch", name: "Stand-Up & Flat Pouches", description: "Flexible high-barrier pouches with zip closures", sort_order: 1 },
      { code: "tin", name: "Artisanal Metal Tins", description: "Food-grade tinplate containers with inner slip lids", sort_order: 2 },
      { code: "jar", name: "Apothecary Glass & PET Jars", description: "Cylindrical clear and amber jars with airtight caps", sort_order: 3 },
      { code: "carton", name: "Luxury Rigid & Folding Cartons", description: "Custom printed folding boxboard cartons", sort_order: 4 },
      { code: "sachet", name: "Single-Serve Envelopes & Sachets", description: "Individually sealed luxury pyramid sachets", sort_order: 5 },
      { code: "bag", name: "Bulk Kraft & Foil Liners", description: "Master food-service bags for bulk leaves", sort_order: 6 },
    ];

    for (const fam of families) {
      db.prepare(
        `INSERT OR IGNORE INTO pl_packaging_families (id, code, name, description, sort_order, is_active)
         VALUES (?, ?, ?, ?, ?, 1)`
      ).run(`fam_${fam.code}`, fam.code, fam.name, fam.description, fam.sort_order);
    }

    // 2. Print methods
    const printMethods = [
      { id: "pm_paper_label", code: "paper_label", name: "Premium Paper Label", desc: "Matte uncoated textured label", model: "cmyk", maxColors: 4, setup: 50000, cylinder: 0, minOrder: 100 },
      { id: "pm_bopp_label", code: "bopp_label", name: "Waterproof BOPP Label", desc: "Polypropylene high-tack moisture label", model: "cmyk", maxColors: 6, setup: 100000, cylinder: 0, minOrder: 250 },
      { id: "pm_direct_digital", code: "direct_digital", name: "Direct Digital Print", desc: "High-resolution digital roll-fed pouch print", model: "cmyk", maxColors: 8, setup: 150000, cylinder: 0, minOrder: 500 },
      { id: "pm_gravure", code: "gravure", name: "Rotogravure Cylinder Print", desc: "Industrial high-speed film gravure print", model: "spot", maxColors: 10, setup: 500000, cylinder: 800000, minOrder: 5000 },
      { id: "pm_screen_print", code: "screen_print", name: "Rotary Screen Print", desc: "Spot screen printing for metal and glass", model: "spot", maxColors: 3, setup: 200000, cylinder: 0, minOrder: 1000 },
      { id: "pm_sleeve", code: "sleeve", name: "Shrink Sleeve", desc: "Full-body contour shrink sleeve", model: "cmyk", maxColors: 8, setup: 300000, cylinder: 0, minOrder: 1000 },
    ];

    for (const pm of printMethods) {
      db.prepare(
        `INSERT OR IGNORE INTO pl_print_methods (
          id, code, name, description, color_model, max_colors, setup_fee_paise,
          cylinder_fee_per_color_paise, min_order_units, lead_time_days, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 14, 1)`
      ).run(pm.id, pm.code, pm.name, pm.desc, pm.model, pm.maxColors, pm.setup, pm.cylinder, pm.minOrder);
    }

    // 3. Default Price Book
    db.prepare(
      `INSERT OR IGNORE INTO pl_price_books (
        id, name, currency, is_default, margin_rate, filling_labor_paise_per_unit,
        qc_charge_paise_per_batch, contingency_rate, loss_allowance_rate, status, revision
      ) VALUES (
        'pb_default_inr', 'Default INR Price Book 2026', 'INR', 1, 0.25, 300,
        250000, 0.05, 0.03, 'active', 1
      )`
    ).run();

    // 4. Packaging Variants
    const packagingVariants = [
      {
        id: "pack_pouch_mbk_250g", family_id: "fam_pouch", slug: "stand-up-pouch-matte-black-250g", sku: "PL-PC-250-MBK",
        title: "Stand-Up Pouch Matte Black 250g", material: "Kraft / Foil Barrier", finish: "Soft-Touch Matte", closure: "Resealable Grip Zipper",
        cap_desc: "250g Retail", grams: 250, w: 160, h: 230, d: 90, lw: 120, lh: 150, sup_name: "EcoBarrier Pack India", sup_sku: "EBP-MBK-250",
        cost: 1850, lead: 14, moq: 500, mult: 50, dieline: "/dielines/standup-pouch-250g.pdf", hero: "/images/private-label/teafloww-reserve-front.webp"
      },
      {
        id: "pack_tin_caddy_100g", family_id: "fam_tin", slug: "metal-tin-caddy-100g", sku: "PL-TN-100-SLV",
        title: "Artisanal Metal Tin Caddy 100g", material: "Food-Grade Tinplate", finish: "Brushed Metallic", closure: "Inner Slip Lid",
        cap_desc: "100g Standard", grams: 100, w: 85, h: 120, d: 85, lw: 260, lh: 100, sup_name: "Siliguri Tin Crafts", sup_sku: "STC-100-SLV",
        cost: 3200, lead: 18, moq: 250, mult: 25, dieline: "/dielines/tin-caddy-100g.pdf", hero: "/images/private-label/tin-concept.webp"
      },
      {
        id: "pack_jar_amber_150g", family_id: "fam_jar", slug: "amber-glass-jar-150g", sku: "PL-JR-150-AMB",
        title: "Amber Glass Apothecary Jar 150g", material: "USP Type III Amber Glass", finish: "UV Protective Amber", closure: "Airtight Bakelite Lid",
        cap_desc: "150g Apothecary", grams: 150, w: 75, h: 110, d: 75, lw: 220, lh: 80, sup_name: "Bengal Glass Works", sup_sku: "BGW-AMB-150",
        cost: 4500, lead: 14, moq: 200, mult: 20, dieline: "/dielines/amber-jar-150g.pdf", hero: "/images/private-label/jar-concept.webp"
      },
      {
        id: "pack_carton_rigid_100g", family_id: "fam_carton", slug: "luxury-rigid-carton-100g", sku: "PL-CT-100-RGD",
        title: "Luxury Rigid Presentation Carton", material: "1200gsm Greyboard with FSC Artpaper Wrap", finish: "Soft-Touch Matte Laminate", closure: "Magnetic Snap Lid",
        cap_desc: "100g Gift Box", grams: 100, w: 100, h: 140, d: 60, lw: 90, lh: 130, sup_name: "Premier Box Siliguri", sup_sku: "PBS-RGD-100",
        cost: 6500, lead: 21, moq: 300, mult: 25, dieline: "/dielines/rigid-carton-100g.pdf", hero: "/images/private-label/carton-concept.webp"
      },
      {
        id: "pack_sachet_pyramid_20", family_id: "fam_sachet", slug: "pyramid-sachet-envelope-20ct", sku: "PL-SC-020-ENV",
        title: "Single-Serve Pyramid Envelopes (20ct)", material: "Biodegradable Soilon Mesh in Foil Envelope", finish: "Matte Soft Foil", closure: "Heat Sealed Individual Envelope",
        cap_desc: "20 Sachets (50g)", grams: 50, w: 120, h: 180, d: 40, lw: 100, lh: 150, sup_name: "Himalayan Packtech", sup_sku: "HPT-SC-020",
        cost: 2800, lead: 14, moq: 500, mult: 50, dieline: "/dielines/sachet-envelope-20ct.pdf", hero: "/images/private-label/atelier-concept.webp"
      }
    ];

    for (const p of packagingVariants) {
      db.prepare(
        `INSERT OR IGNORE INTO pl_packaging_variants (
          id, family_id, slug, sku, title, material, finish, closure_type, capacity_description,
          net_weight_capacity_grams, width_mm, height_mm, depth_mm, label_safe_width_mm, label_safe_height_mm,
          supplier_name, supplier_sku, unit_cost_paise, lead_time_days, moq_units, order_multiple,
          dieline_url, hero_image_url, image_illustrative, status, revision
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'published', 1)`
      ).run(
        p.id, p.family_id, p.slug, p.sku, p.title, p.material, p.finish, p.closure, p.cap_desc,
        p.grams, p.w, p.h, p.d, p.lw, p.lh, p.sup_name, p.sup_sku, p.cost, p.lead, p.moq, p.mult,
        p.dieline, p.hero
      );
    }

    // 5. Packaging Compatibility
    const compatibilities = [
      { id: "c_pouch_digital", packId: "pack_pouch_mbk_250g", printId: "pm_direct_digital", notes: "Direct roll-fed printing" },
      { id: "c_pouch_paper", packId: "pack_pouch_mbk_250g", printId: "pm_paper_label", notes: "Matte paper label appliqué" },
      { id: "c_pouch_bopp", packId: "pack_pouch_mbk_250g", printId: "pm_bopp_label", notes: "Waterproof synthetic label" },
      { id: "c_tin_paper", packId: "pack_tin_caddy_100g", printId: "pm_paper_label", notes: "Full-wrap body label" },
      { id: "c_tin_bopp", packId: "pack_tin_caddy_100g", printId: "pm_bopp_label", notes: "Moisture-resistant label" },
      { id: "c_tin_screen", packId: "pack_tin_caddy_100g", printId: "pm_screen_print", notes: "Direct metal screen print" },
      { id: "c_jar_paper", packId: "pack_jar_amber_150g", printId: "pm_paper_label", notes: "Textured apothecary label" },
      { id: "c_jar_bopp", packId: "pack_jar_amber_150g", printId: "pm_bopp_label", notes: "Moisture-resistant clear label" },
      { id: "c_jar_screen", packId: "pack_jar_amber_150g", printId: "pm_screen_print", notes: "Ceramic screen bake" },
      { id: "c_carton_digital", packId: "pack_carton_rigid_100g", printId: "pm_direct_digital", notes: "Sheet-fed digital litho" },
      { id: "c_carton_screen", packId: "pack_carton_rigid_100g", printId: "pm_screen_print", notes: "Spot UV screen embellishment" },
      { id: "c_sachet_digital", packId: "pack_sachet_pyramid_20", printId: "pm_direct_digital", notes: "Digital envelope print" },
      { id: "c_sachet_paper", packId: "pack_sachet_pyramid_20", printId: "pm_paper_label", notes: "Label seal sticker" },
      { id: "c_sachet_bopp", packId: "pack_sachet_pyramid_20", printId: "pm_bopp_label", notes: "Synthetic tamper seal" },
    ];

    for (const c of compatibilities) {
      db.prepare(
        `INSERT OR IGNORE INTO pl_packaging_compatibility (id, packaging_variant_id, print_method_id, is_supported, notes)
         VALUES (?, ?, ?, 1, ?)`
      ).run(c.id, c.packId, c.printId, c.notes);
    }

    // 6. Tea Sourcing Options
    const teas = [
      {
        id: "tea_dj_ff", slug: "darjeeling-first-flush", name: "Darjeeling First Flush FTGFOP1",
        estate: "Risheehat / Arya", region: "Darjeeling", grade: "FTGFOP1", flush: "First Flush", category: "black",
        desc: "Unblended single-estate spring harvest orthodox black tea with vibrant floral aroma and muscatel grape notes.",
        caffeine: "medium", costKg: 350000, minBatchKg: 5.0, notes: '["Muscatel", "Wild Honey", "Spring Peach"]'
      },
      {
        id: "tea_assam_ctc", slug: "assam-ctc-gold", name: "Assam CTC Premium Granules",
        estate: "Mokalbari / Doomni", region: "Assam", grade: "BOP", flush: "Second Flush", category: "chai_blend",
        desc: "Bold, malty second-flush Assam granular tea crafted for full-bodied milk chai applications.",
        caffeine: "high", costKg: 85000, minBatchKg: 10.0, notes: '["Malty", "Dark Cocoa", "Full-Bodied"]'
      },
      {
        id: "tea_him_green", slug: "himalayan-green-leaf", name: "Himalayan High-Mountain Green",
        estate: "Kangra Valley", region: "Himachal", grade: "Special Green", flush: "Spring", category: "green",
        desc: "Gently pan-fired tender green leaf rich in catechins with sweet grassy sweetness and clean finish.",
        caffeine: "low", costKg: 220000, minBatchKg: 5.0, notes: '["Fresh Grass", "Sweet Corn", "Toasted Rice"]'
      },
      {
        id: "tea_silver_needle", slug: "silver-needle-white", name: "Himalayan Silver Needle",
        estate: "Rohini", region: "Darjeeling", grade: "Silver Needle", flush: "Spring", category: "white",
        desc: "100% downy unopened spring buds delicately air-dried with sublime honeysuckle sweetness.",
        caffeine: "low", costKg: 750000, minBatchKg: 2.5, notes: '["Honeysuckle", "Melon", "Silky"]'
      },
      {
        id: "tea_dj_sf", slug: "darjeeling-second-flush", name: "Darjeeling Second Flush Muscatel",
        estate: "Castleton", region: "Darjeeling", grade: "SFTGFOP1", flush: "Second Flush", category: "black",
        desc: "Renowned summer flush orthodox black tea celebrated for ripe peach sweetness and cedarwood finish.",
        caffeine: "medium", costKg: 420000, minBatchKg: 5.0, notes: '["Ripe Muscatel", "Summer Raisin", "Cedar"]'
      }
    ];

    for (const t of teas) {
      db.prepare(
        `INSERT OR IGNORE INTO pl_tea_options (
          id, slug, name, origin_estate, region, grade, flush, tea_category,
          description, caffeine_level, base_cost_per_kg_paise, min_batch_kg,
          tasting_notes_json, is_published, sample_available, revision
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 1)`
      ).run(
        t.id, t.slug, t.name, t.estate, t.region, t.grade, t.flush, t.category,
        t.desc, t.caffeine, t.costKg, t.minBatchKg, t.notes
      );
    }

    // 7. MOQ Rules
    const moqRules = [
      { id: "moq_global", type: "global", target: null, minQty: 250, unit: "units", mult: 25, minVal: 2500000 },
      { id: "moq_tea_batch", type: "tea", target: null, minQty: 5.0, unit: "kg", mult: 1, minVal: 0 }
    ];

    for (const m of moqRules) {
      db.prepare(
        `INSERT OR IGNORE INTO pl_moq_rules (id, rule_type, target_id, min_quantity, unit_basis, order_multiple, min_order_value_paise)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(m.id, m.type, m.target, m.minQty, m.unit, m.mult, m.minVal);
    }

    // 8. Price Book Tiers
    const tiers = [
      { id: "pbt_pouch_500", pb: "pb_default_inr", type: "packaging", item: "pack_pouch_mbk_250g", min: 500, max: 999, price: 1850 },
      { id: "pbt_pouch_1000", pb: "pb_default_inr", type: "packaging", item: "pack_pouch_mbk_250g", min: 1000, max: 2499, price: 1665 },
      { id: "pbt_pouch_2500", pb: "pb_default_inr", type: "packaging", item: "pack_pouch_mbk_250g", min: 2500, max: 4999, price: 1480 },
      { id: "pbt_pouch_5000", pb: "pb_default_inr", type: "packaging", item: "pack_pouch_mbk_250g", min: 5000, max: null, price: 1295 },
      { id: "pbt_tin_250", pb: "pb_default_inr", type: "packaging", item: "pack_tin_caddy_100g", min: 250, max: 499, price: 3200 },
      { id: "pbt_tin_500", pb: "pb_default_inr", type: "packaging", item: "pack_tin_caddy_100g", min: 500, max: 999, price: 2880 },
      { id: "pbt_tin_1000", pb: "pb_default_inr", type: "packaging", item: "pack_tin_caddy_100g", min: 1000, max: null, price: 2560 },
      { id: "pbt_carton_300", pb: "pb_default_inr", type: "packaging", item: "pack_carton_rigid_100g", min: 300, max: 499, price: 6500 },
      { id: "pbt_carton_500", pb: "pb_default_inr", type: "packaging", item: "pack_carton_rigid_100g", min: 500, max: 999, price: 5850 },
      { id: "pbt_carton_1000", pb: "pb_default_inr", type: "packaging", item: "pack_carton_rigid_100g", min: 1000, max: null, price: 5200 },
      { id: "pbt_sachet_500", pb: "pb_default_inr", type: "packaging", item: "pack_sachet_pyramid_20", min: 500, max: 999, price: 2800 },
      { id: "pbt_sachet_1000", pb: "pb_default_inr", type: "packaging", item: "pack_sachet_pyramid_20", min: 1000, max: 2499, price: 2520 },
      { id: "pbt_sachet_2500", pb: "pb_default_inr", type: "packaging", item: "pack_sachet_pyramid_20", min: 2500, max: null, price: 2240 },
    ];

    for (const r of tiers) {
      db.prepare(
        `INSERT OR IGNORE INTO pl_price_book_tiers (id, price_book_id, item_type, item_id, min_qty, max_qty, unit_price_paise)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(r.id, r.pb, r.type, r.item, r.min, r.max, r.price);
    }
  })();
}

if (process.argv[1] && process.argv[1].endsWith("seed-private-label.mjs")) {
  const file = path.resolve(process.env.DATABASE_PATH || "./data/store.sqlite");
  const db = new Database(file);
  db.pragma("foreign_keys = ON");
  seedPrivateLabelCatalog(db);
  console.log("Seeded private label catalog to", file);
  db.close();
}
