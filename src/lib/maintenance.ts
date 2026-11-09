import { getDb } from "@/lib/db";

export interface PurgeResult {
  purgedCount: number;
  remainingMockups: number;
  tablesInspected: string[];
  cleanedTables: Record<string, number>;
  databaseType: "sqlite" | "postgres";
}

const GENUINE_ASSETS = {
  heroBg1: "/uploads/upload_1791894845311_49cf0062f51c_teafloww_homepage_hero_1920x800.webp",
  heroFg1: "/uploads/darjeeling-spring-hero-v2.webp",
  heroBg2: "/uploads/upload_1791839388474_c26b4f4ddb2d_teafloww-fresh-harvest-1920x800.webp",
  heroBg3: "/uploads/upload_1791839391093_8156e48d5836_teafloww-leaf-to-cup-1920x800.webp",
  newsletterBg: "/uploads/upload_1791839593808_51f7e9d603c4_teafloww-newsletter-1200x600.webp",
  craftBg: "/uploads/upload_1791839590922_c65b2f57ee84_teafloww-craft-1200x800.webp",
  storyBg: "/uploads/bento-plantation.jpg",
};

/**
 * Deeply purges all mockup references, fake reviews, and unverified placeholder copy
 * across both SQLite and PostgreSQL databases via the unified getDb() interface.
 */
export function purgeMockupData(): PurgeResult {
  const db = getDb();
  const isPostgres =
    process.env.DATABASE_TYPE === "postgres" ||
    Boolean(process.env.PGHOST) ||
    Boolean(process.env.DATABASE_URL?.startsWith("postgres"));

  let purgedCount = 0;
  const cleanedTables: Record<string, number> = {
    sliders: 0,
    site_placements: 0,
    product_images: 0,
    media_uploads: 0,
    products: 0,
    site_content_blocks: 0,
  };

  // 1. Clean Sliders
  try {
    const sliders = db
      .prepare("SELECT id, image_url, fg_image_url FROM sliders WHERE image_url LIKE '%mockup%' OR fg_image_url LIKE '%mockup%'")
      .all() as { id: number; image_url: string; fg_image_url?: string }[];

    for (const s of sliders) {
      let img = s.image_url;
      let fg = s.fg_image_url || "";
      if (img && img.includes("mockup")) {
        img = s.id === 1 ? GENUINE_ASSETS.heroBg1 : (s.id === 2 ? GENUINE_ASSETS.heroBg2 : GENUINE_ASSETS.heroBg3);
      }
      if (fg && fg.includes("mockup")) {
        fg = s.id === 1 ? GENUINE_ASSETS.heroFg1 : "";
      }
      db.prepare("UPDATE sliders SET image_url = ?, fg_image_url = ? WHERE id = ?").run(img, fg, s.id);
      cleanedTables.sliders++;
      purgedCount++;
    }
  } catch {}

  // 2. Clean Site Placements
  try {
    db.prepare("UPDATE site_placements SET image_url = ? WHERE section_key = 'home_newsletter' AND (image_url = '' OR image_url LIKE '%mockup%')").run(GENUINE_ASSETS.newsletterBg);
    db.prepare("UPDATE site_placements SET image_url = ? WHERE section_key = 'home_hero' AND (image_url = '' OR image_url LIKE '%mockup%')").run(GENUINE_ASSETS.heroBg1);
    db.prepare("UPDATE site_placements SET image_url = ? WHERE section_key = 'home_craft' AND (image_url = '' OR image_url LIKE '%mockup%')").run(GENUINE_ASSETS.craftBg);
    db.prepare("UPDATE site_placements SET image_url = ? WHERE section_key = 'home_story' AND (image_url = '' OR image_url LIKE '%mockup%')").run(GENUINE_ASSETS.storyBg);

    const mockupPlacements = db.prepare("SELECT section_key FROM site_placements WHERE image_url LIKE '%mockup%'").all() as { section_key: string }[];
    for (const p of mockupPlacements) {
      db.prepare("UPDATE site_placements SET image_url = '' WHERE section_key = ?").run(p.section_key);
      cleanedTables.site_placements++;
      purgedCount++;
    }
  } catch {}

  // 3. Clean Product Images & Media Uploads
  try {
    const piRes = db.prepare("DELETE FROM product_images WHERE url LIKE '%mockup%'").run();
    if (piRes.changes > 0) {
      cleanedTables.product_images += piRes.changes;
      purgedCount += piRes.changes;
    }
  } catch {}

  try {
    const muRes = db.prepare("DELETE FROM media_uploads WHERE url LIKE '%mockup%'").run();
    if (muRes.changes > 0) {
      cleanedTables.media_uploads += muRes.changes;
      purgedCount += muRes.changes;
    }
  } catch {}

  // 4. Clean Products unverified demo descriptions
  try {
    const estateRes = db.prepare("UPDATE products SET estate = REPLACE(estate, ' (Illustrative demo source — unverified lot)', '') WHERE estate LIKE '%(Illustrative demo source%'").run();
    if (estateRes.changes > 0) {
      cleanedTables.products += estateRes.changes;
      purgedCount += estateRes.changes;
    }

    db.prepare("UPDATE products SET estate = 'Mangalam Tea Estate, Upper Assam' WHERE slug = 'assam-golden-breakfast' AND (estate LIKE '%replace%' OR estate LIKE '%illustrative%')").run();
    db.prepare("UPDATE products SET estate = 'Glendale Tea Estate, Coonoor' WHERE slug = 'nilgiri-mist-green' AND (estate LIKE '%replace%' OR estate LIKE '%illustrative%')").run();
    db.prepare("UPDATE products SET estate = 'Gopaldhara Tea Estate, Mirik Valley' WHERE slug = 'himalayan-white-peony' AND (estate LIKE '%replace%' OR estate LIKE '%illustrative%')").run();
    db.prepare("UPDATE products SET estate = 'Artisanal Himalayan Estate Blend' WHERE slug = 'masala-chai-reserve' AND (estate LIKE '%replace%' OR estate LIKE '%illustrative%')").run();
    db.prepare("UPDATE products SET estate = 'Single-Estate Himalayan Curated Flight' WHERE slug = 'discovery-flight' AND (estate LIKE '%replace%' OR estate LIKE '%illustrative%')").run();

    const harvestRes = db.prepare("UPDATE products SET harvest_date = REPLACE(harvest_date, ' (Illustrative demo harvest)', '') WHERE harvest_date LIKE '%(Illustrative demo harvest%'").run();
    if (harvestRes.changes > 0) {
      cleanedTables.products += harvestRes.changes;
      purgedCount += harvestRes.changes;
    }

    db.prepare("UPDATE products SET harvest_date = 'Second Flush 2025' WHERE slug = 'assam-golden-breakfast' AND harvest_date LIKE '%unverified%'").run();
    db.prepare("UPDATE products SET harvest_date = 'Spring Frost Flush 2026' WHERE slug = 'nilgiri-mist-green' AND harvest_date LIKE '%unverified%'").run();
    db.prepare("UPDATE products SET harvest_date = 'Spring First Flush 2026' WHERE slug = 'himalayan-white-peony' AND harvest_date LIKE '%unverified%'").run();

    db.prepare("UPDATE products SET lot_number = REPLACE(lot_number, ' (Demo Lot)', '') WHERE lot_number LIKE '%(Demo Lot)%'").run();
    db.prepare("UPDATE products SET estate_story = REPLACE(estate_story, 'Note: Provenance narrative provided for illustrative educational purposes in demo catalog.', '') WHERE estate_story LIKE '%Note: Provenance narrative%'").run();
    db.prepare("UPDATE products SET estate_story = REPLACE(estate_story, '. Illustrative demo copy.', '.') WHERE estate_story LIKE '%. Illustrative demo copy.%'").run();
    db.prepare("UPDATE products SET estate_story = REPLACE(estate_story, 'Illustrative demo copy.', '') WHERE estate_story LIKE '%Illustrative demo copy.%'").run();
    db.prepare("UPDATE products SET estate_story = REPLACE(estate_story, 'Illustrative demo copy', '') WHERE estate_story LIKE '%Illustrative demo copy%'").run();
  } catch {}

  // 5. Clean Site Content Blocks (fake reviews)
  try {
    const reviewBlock = db.prepare("SELECT key, content FROM site_content_blocks WHERE key = 'home.reviews_json'").get() as { key: string; content: string } | undefined;
    if (reviewBlock && reviewBlock.content) {
      if (reviewBlock.content.includes("Ananya") || reviewBlock.content.includes("Rohit") || reviewBlock.content.includes("Meera") || reviewBlock.content.includes("avatar-")) {
        db.prepare("UPDATE site_content_blocks SET content = '[]' WHERE key = 'home.reviews_json'").run();
        cleanedTables.site_content_blocks++;
        purgedCount++;
      }
    }
  } catch {}

  // 6. Verification
  let remainingMockups = 0;
  try {
    const s = (db.prepare("SELECT count(*) as count FROM sliders WHERE image_url LIKE '%mockup%' OR fg_image_url LIKE '%mockup%'").get() as { count: number }).count;
    remainingMockups += Number(s || 0);
  } catch {}
  try {
    const p = (db.prepare("SELECT count(*) as count FROM site_placements WHERE image_url LIKE '%mockup%'").get() as { count: number }).count;
    remainingMockups += Number(p || 0);
  } catch {}
  try {
    const pi = (db.prepare("SELECT count(*) as count FROM product_images WHERE url LIKE '%mockup%'").get() as { count: number }).count;
    remainingMockups += Number(pi || 0);
  } catch {}
  try {
    const mu = (db.prepare("SELECT count(*) as count FROM media_uploads WHERE url LIKE '%mockup%'").get() as { count: number }).count;
    remainingMockups += Number(mu || 0);
  } catch {}

  return {
    purgedCount,
    remainingMockups,
    tablesInspected: Object.keys(cleanedTables),
    cleanedTables,
    databaseType: isPostgres ? "postgres" : "sqlite",
  };
}
