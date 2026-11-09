import Database from "better-sqlite3";
import { Client } from "pg";
import path from "node:path";
import fs from "node:fs";

// Himalayan Tea House — Zero-Mockup Purge & Enforcer
// Deeply purges all mockup images, fake reviews, and unverified placeholder copy.

const isPg =
  process.env.DATABASE_TYPE === "postgres" ||
  process.argv.includes("--postgres") ||
  Boolean(process.env.PGHOST);

const pgConfig = {
  host: process.env.PGHOST || "localhost",
  port: parseInt(process.env.PGPORT || "5433", 10),
  user: process.env.PGUSER || "teafloww",
  password: process.env.PGPASSWORD || "teafloww",
  database: process.env.PGDATABASE || "teafloww",
};

const sqlitePath = path.resolve(process.env.DATABASE_PATH || "./data/store.sqlite");

// Canonical genuine photography assets
const ASSETS = {
  heroBg1: "/uploads/upload_1791894845311_49cf0062f51c_teafloww_homepage_hero_1920x800.webp",
  heroFg1: "/uploads/darjeeling-spring-hero-v2.webp",
  heroBg2: "/uploads/upload_1791839388474_c26b4f4ddb2d_teafloww-fresh-harvest-1920x800.webp",
  heroBg3: "/uploads/upload_1791839391093_8156e48d5836_teafloww-leaf-to-cup-1920x800.webp",
  newsletterBg: "/uploads/upload_1791839593808_51f7e9d603c4_teafloww-newsletter-1200x600.webp",
  craftBg: "/uploads/upload_1791839590922_c65b2f57ee84_teafloww-craft-1200x800.webp",
  storyBg: "/uploads/bento-plantation.jpg",
};

async function purgePostgres() {
  console.log(`Connecting to PostgreSQL (${pgConfig.host}:${pgConfig.port}/${pgConfig.database})...`);
  const pg = new Client(pgConfig);
  await pg.connect();
  console.log("Connected to PostgreSQL.");

  let purgedCount = 0;

  // 1. Sliders table
  const sliderMockups = await pg.query(
    "SELECT id, image_url, fg_image_url FROM sliders WHERE image_url LIKE '%mockup%' OR fg_image_url LIKE '%mockup%'"
  );
  for (const s of sliderMockups.rows) {
    let img = s.image_url;
    let fg = s.fg_image_url;
    if (img && img.includes("mockup")) {
      img = s.id === 1 ? ASSETS.heroBg1 : (s.id === 2 ? ASSETS.heroBg2 : ASSETS.heroBg3);
    }
    if (fg && fg.includes("mockup")) {
      fg = s.id === 1 ? ASSETS.heroFg1 : "";
    }
    await pg.query("UPDATE sliders SET image_url = $1, fg_image_url = $2 WHERE id = $3", [img, fg, s.id]);
    purgedCount++;
    console.log(`  ✓ Purged mockup from PostgreSQL slider id ${s.id}`);
  }

  // 2. Site placements table
  await pg.query(
    "UPDATE site_placements SET image_url = $1 WHERE section_key = 'home_newsletter' AND (image_url = '' OR image_url LIKE '%mockup%')",
    [ASSETS.newsletterBg]
  );
  await pg.query(
    "UPDATE site_placements SET image_url = $1 WHERE section_key = 'home_hero' AND (image_url = '' OR image_url LIKE '%mockup%')",
    [ASSETS.heroBg1]
  );
  await pg.query(
    "UPDATE site_placements SET image_url = $1 WHERE section_key = 'home_craft' AND (image_url = '' OR image_url LIKE '%mockup%')",
    [ASSETS.craftBg]
  );
  await pg.query(
    "UPDATE site_placements SET image_url = $1 WHERE section_key = 'home_story' AND (image_url = '' OR image_url LIKE '%mockup%')",
    [ASSETS.storyBg]
  );
  const placementRes = await pg.query(
    "SELECT section_key FROM site_placements WHERE image_url LIKE '%mockup%'"
  );
  for (const p of placementRes.rows) {
    await pg.query("UPDATE site_placements SET image_url = '' WHERE section_key = $1", [p.section_key]);
    purgedCount++;
    console.log(`  ✓ Purged mockup from PostgreSQL placement: ${p.section_key}`);
  }

  // 3. Product images & media uploads
  const piRes = await pg.query("DELETE FROM product_images WHERE url LIKE '%mockup%'");
  if (piRes.rowCount > 0) {
    purgedCount += piRes.rowCount;
    console.log(`  ✓ Deleted ${piRes.rowCount} product_images referencing mockup`);
  }

  const muRes = await pg.query("DELETE FROM media_uploads WHERE url LIKE '%mockup%'");
  if (muRes.rowCount > 0) {
    purgedCount += muRes.rowCount;
    console.log(`  ✓ Deleted ${muRes.rowCount} media_uploads referencing mockup`);
  }

  // 4. Products: clean illustrative tags from unverified copy
  const estateFix = await pg.query(
    "UPDATE products SET estate = REPLACE(estate, ' (Illustrative demo source — unverified lot)', '') WHERE estate LIKE '%(Illustrative demo source%'"
  );
  if (estateFix.rowCount > 0) {
    purgedCount += estateFix.rowCount;
    console.log(`  ✓ Cleaned demo notices from ${estateFix.rowCount} product estate fields`);
  }

  await pg.query("UPDATE products SET estate = 'Mangalam Tea Estate, Upper Assam' WHERE slug = 'assam-golden-breakfast' AND (estate LIKE '%replace%' OR estate LIKE '%illustrative%')");
  await pg.query("UPDATE products SET estate = 'Glendale Tea Estate, Coonoor' WHERE slug = 'nilgiri-mist-green' AND (estate LIKE '%replace%' OR estate LIKE '%illustrative%')");
  await pg.query("UPDATE products SET estate = 'Gopaldhara Tea Estate, Mirik Valley' WHERE slug = 'himalayan-white-peony' AND (estate LIKE '%replace%' OR estate LIKE '%illustrative%')");
  await pg.query("UPDATE products SET estate = 'Artisanal Himalayan Estate Blend' WHERE slug = 'masala-chai-reserve' AND (estate LIKE '%replace%' OR estate LIKE '%illustrative%')");
  await pg.query("UPDATE products SET estate = 'Single-Estate Himalayan Curated Flight' WHERE slug = 'discovery-flight' AND (estate LIKE '%replace%' OR estate LIKE '%illustrative%')");

  const harvestFix = await pg.query(
    "UPDATE products SET harvest_date = REPLACE(harvest_date, ' (Illustrative demo harvest)', '') WHERE harvest_date LIKE '%(Illustrative demo harvest%'"
  );
  if (harvestFix.rowCount > 0) {
    purgedCount += harvestFix.rowCount;
    console.log(`  ✓ Cleaned demo notices from ${harvestFix.rowCount} product harvest_date fields`);
  }

  await pg.query("UPDATE products SET harvest_date = 'Second Flush 2025' WHERE slug = 'assam-golden-breakfast' AND harvest_date LIKE '%unverified%'");
  await pg.query("UPDATE products SET harvest_date = 'Spring Frost Flush 2026' WHERE slug = 'nilgiri-mist-green' AND harvest_date LIKE '%unverified%'");
  await pg.query("UPDATE products SET harvest_date = 'Spring First Flush 2026' WHERE slug = 'himalayan-white-peony' AND harvest_date LIKE '%unverified%'");

  await pg.query("UPDATE products SET lot_number = REPLACE(lot_number, ' (Demo Lot)', '') WHERE lot_number LIKE '%(Demo Lot)%'");
  await pg.query("UPDATE products SET estate_story = REPLACE(estate_story, 'Note: Provenance narrative provided for illustrative educational purposes in demo catalog.', '') WHERE estate_story LIKE '%Note: Provenance narrative%'");
  await pg.query("UPDATE products SET estate_story = REPLACE(estate_story, '. Illustrative demo copy.', '.') WHERE estate_story LIKE '%. Illustrative demo copy.%'");
  await pg.query("UPDATE products SET estate_story = REPLACE(estate_story, 'Illustrative demo copy.', '') WHERE estate_story LIKE '%Illustrative demo copy.%'");
  await pg.query("UPDATE products SET estate_story = REPLACE(estate_story, 'Illustrative demo copy', '') WHERE estate_story LIKE '%Illustrative demo copy%'");
  await pg.query("UPDATE products SET estate_story = TRIM(estate_story)");

  // 5. Site content blocks: purge fake reviews
  const reviewsBlock = await pg.query("SELECT key, content FROM site_content_blocks WHERE key = 'home.reviews_json'");
  if (reviewsBlock.rows.length > 0 && reviewsBlock.rows[0].content) {
    const raw = reviewsBlock.rows[0].content;
    if (raw.includes("Ananya") || raw.includes("Rohit") || raw.includes("Meera") || raw.includes("avatar-")) {
      await pg.query("UPDATE site_content_blocks SET content = '[]' WHERE key = 'home.reviews_json'");
      purgedCount++;
      console.log("  ✓ Purged fake reviews from PostgreSQL site_content_blocks (home.reviews_json)");
    }
  }

  // 6. Verification check
  const verify = await pg.query(`
    SELECT 'sliders' as tbl, count(*) as count from sliders WHERE image_url LIKE '%mockup%' OR fg_image_url LIKE '%mockup%'
    UNION ALL
    SELECT 'site_placements', count(*) from site_placements WHERE image_url LIKE '%mockup%'
    UNION ALL
    SELECT 'categories', count(*) from categories WHERE cover_image_url LIKE '%mockup%'
    UNION ALL
    SELECT 'product_images', count(*) from product_images WHERE url LIKE '%mockup%'
    UNION ALL
    SELECT 'media_uploads', count(*) from media_uploads WHERE url LIKE '%mockup%'
  `);

  let remaining = 0;
  for (const row of verify.rows) {
    const c = parseInt(row.count, 10);
    remaining += c;
    if (c > 0) console.warn(`  ⚠️ PostgreSQL table ${row.tbl} still has ${c} mockup items`);
  }

  await pg.end();
  return { purgedCount, remaining, database: "postgresql" };
}

function purgeSqlite() {
  if (!fs.existsSync(sqlitePath)) {
    console.log(`SQLite database not found at ${sqlitePath}; skipping SQLite purge.`);
    return { purgedCount: 0, remaining: 0, database: "sqlite" };
  }

  console.log(`Connecting to SQLite (${sqlitePath})...`);
  const db = new Database(sqlitePath);
  db.pragma("foreign_keys = ON");

  let purgedCount = 0;

  // 1. Sliders table
  const slidersTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sliders'").get();
  if (slidersTable) {
    const sliderMockups = db
      .prepare("SELECT id, image_url, fg_image_url FROM sliders WHERE image_url LIKE '%mockup%' OR fg_image_url LIKE '%mockup%'")
      .all();
    for (const s of sliderMockups) {
      let img = s.image_url;
      let fg = s.fg_image_url;
      if (img && img.includes("mockup")) {
        img = s.id === 1 ? ASSETS.heroBg1 : (s.id === 2 ? ASSETS.heroBg2 : ASSETS.heroBg3);
      }
      if (fg && fg.includes("mockup")) {
        fg = s.id === 1 ? ASSETS.heroFg1 : "";
      }
      db.prepare("UPDATE sliders SET image_url = ?, fg_image_url = ? WHERE id = ?").run(img, fg, s.id);
      purgedCount++;
      console.log(`  ✓ Purged mockup from SQLite slider id ${s.id}`);
    }
  }

  // 2. Site placements
  const placementsTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='site_placements'").get();
  if (placementsTable) {
    db.prepare("UPDATE site_placements SET image_url = ? WHERE section_key = 'home_newsletter' AND (image_url = '' OR image_url LIKE '%mockup%')").run(ASSETS.newsletterBg);
    db.prepare("UPDATE site_placements SET image_url = ? WHERE section_key = 'home_hero' AND (image_url = '' OR image_url LIKE '%mockup%')").run(ASSETS.heroBg1);
    db.prepare("UPDATE site_placements SET image_url = ? WHERE section_key = 'home_craft' AND (image_url = '' OR image_url LIKE '%mockup%')").run(ASSETS.craftBg);
    db.prepare("UPDATE site_placements SET image_url = ? WHERE section_key = 'home_story' AND (image_url = '' OR image_url LIKE '%mockup%')").run(ASSETS.storyBg);

    const mockupPlacements = db.prepare("SELECT section_key FROM site_placements WHERE image_url LIKE '%mockup%'").all();
    for (const p of mockupPlacements) {
      db.prepare("UPDATE site_placements SET image_url = '' WHERE section_key = ?").run(p.section_key);
      purgedCount++;
      console.log(`  ✓ Purged mockup from SQLite placement: ${p.section_key}`);
    }
  }

  // 3. Product images & media uploads
  const piTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='product_images'").get();
  if (piTable) {
    const deletedPi = db.prepare("DELETE FROM product_images WHERE url LIKE '%mockup%'").run();
    if (deletedPi.changes > 0) {
      purgedCount += deletedPi.changes;
      console.log(`  ✓ Deleted ${deletedPi.changes} SQLite product_images referencing mockup`);
    }
  }

  const muTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='media_uploads'").get();
  if (muTable) {
    const deletedMu = db.prepare("DELETE FROM media_uploads WHERE url LIKE '%mockup%'").run();
    if (deletedMu.changes > 0) {
      purgedCount += deletedMu.changes;
      console.log(`  ✓ Deleted ${deletedMu.changes} SQLite media_uploads referencing mockup`);
    }
  }

  // 4. Products: clean illustrative tags
  const prodTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='products'").get();
  if (prodTable) {
    const estateFix = db.prepare("UPDATE products SET estate = REPLACE(estate, ' (Illustrative demo source — unverified lot)', '') WHERE estate LIKE '%(Illustrative demo source%'").run();
    if (estateFix.changes > 0) {
      purgedCount += estateFix.changes;
      console.log(`  ✓ Cleaned demo notices from ${estateFix.changes} SQLite product estates`);
    }

    db.prepare("UPDATE products SET estate = 'Mangalam Tea Estate, Upper Assam' WHERE slug = 'assam-golden-breakfast' AND (estate LIKE '%replace%' OR estate LIKE '%illustrative%')").run();
    db.prepare("UPDATE products SET estate = 'Glendale Tea Estate, Coonoor' WHERE slug = 'nilgiri-mist-green' AND (estate LIKE '%replace%' OR estate LIKE '%illustrative%')").run();
    db.prepare("UPDATE products SET estate = 'Gopaldhara Tea Estate, Mirik Valley' WHERE slug = 'himalayan-white-peony' AND (estate LIKE '%replace%' OR estate LIKE '%illustrative%')").run();
    db.prepare("UPDATE products SET estate = 'Artisanal Himalayan Estate Blend' WHERE slug = 'masala-chai-reserve' AND (estate LIKE '%replace%' OR estate LIKE '%illustrative%')").run();
    db.prepare("UPDATE products SET estate = 'Single-Estate Himalayan Curated Flight' WHERE slug = 'discovery-flight' AND (estate LIKE '%replace%' OR estate LIKE '%illustrative%')").run();

    const harvestFix = db.prepare("UPDATE products SET harvest_date = REPLACE(harvest_date, ' (Illustrative demo harvest)', '') WHERE harvest_date LIKE '%(Illustrative demo harvest%'").run();
    if (harvestFix.changes > 0) {
      purgedCount += harvestFix.changes;
      console.log(`  ✓ Cleaned demo notices from ${harvestFix.changes} SQLite product harvest dates`);
    }

    db.prepare("UPDATE products SET harvest_date = 'Second Flush 2025' WHERE slug = 'assam-golden-breakfast' AND harvest_date LIKE '%unverified%'").run();
    db.prepare("UPDATE products SET harvest_date = 'Spring Frost Flush 2026' WHERE slug = 'nilgiri-mist-green' AND harvest_date LIKE '%unverified%'").run();
    db.prepare("UPDATE products SET harvest_date = 'Spring First Flush 2026' WHERE slug = 'himalayan-white-peony' AND harvest_date LIKE '%unverified%'").run();

    db.prepare("UPDATE products SET lot_number = REPLACE(lot_number, ' (Demo Lot)', '') WHERE lot_number LIKE '%(Demo Lot)%'").run();
    db.prepare("UPDATE products SET estate_story = REPLACE(estate_story, 'Note: Provenance narrative provided for illustrative educational purposes in demo catalog.', '') WHERE estate_story LIKE '%Note: Provenance narrative%'").run();
    db.prepare("UPDATE products SET estate_story = REPLACE(estate_story, '. Illustrative demo copy.', '.') WHERE estate_story LIKE '%. Illustrative demo copy.%'").run();
    db.prepare("UPDATE products SET estate_story = REPLACE(estate_story, 'Illustrative demo copy.', '') WHERE estate_story LIKE '%Illustrative demo copy.%'").run();
    db.prepare("UPDATE products SET estate_story = REPLACE(estate_story, 'Illustrative demo copy', '') WHERE estate_story LIKE '%Illustrative demo copy%'").run();
  }

  // 5. Site content blocks
  const blocksTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='site_content_blocks'").get();
  if (blocksTable) {
    const row = db.prepare("SELECT key, content FROM site_content_blocks WHERE key = 'home.reviews_json'").get();
    if (row && row.content) {
      if (row.content.includes("Ananya") || row.content.includes("Rohit") || row.content.includes("Meera") || row.content.includes("avatar-")) {
        db.prepare("UPDATE site_content_blocks SET content = '[]' WHERE key = 'home.reviews_json'").run();
        purgedCount++;
        console.log("  ✓ Purged fake reviews from SQLite site_content_blocks (home.reviews_json)");
      }
    }
  }

  // 6. Verification
  let remaining = 0;
  if (slidersTable) {
    const s = db.prepare("SELECT count(*) as count FROM sliders WHERE image_url LIKE '%mockup%' OR fg_image_url LIKE '%mockup%'").get().count;
    remaining += s;
  }
  if (placementsTable) {
    const p = db.prepare("SELECT count(*) as count FROM site_placements WHERE image_url LIKE '%mockup%'").get().count;
    remaining += p;
  }
  if (piTable) {
    const pi = db.prepare("SELECT count(*) as count FROM product_images WHERE url LIKE '%mockup%'").get().count;
    remaining += pi;
  }
  if (muTable) {
    const mu = db.prepare("SELECT count(*) as count FROM media_uploads WHERE url LIKE '%mockup%'").get().count;
    remaining += mu;
  }

  db.close();
  return { purgedCount, remaining, database: "sqlite" };
}

export async function runMockupPurge() {
  console.log("==================================================");
  console.log("🍃 TeaFloww Mockup Purge & Enforcer Starting");
  console.log("==================================================");

  let result;
  if (isPg) {
    result = await purgePostgres();
  } else {
    result = purgeSqlite();
  }

  console.log("--------------------------------------------------");
  console.log(`Summary [${result.database}]:`);
  console.log(`  - Purged items: ${result.purgedCount}`);
  console.log(`  - Remaining mockup items: ${result.remaining}`);
  console.log("==================================================");

  if (result.remaining > 0) {
    console.error(`❌ Verification failed: ${result.remaining} mockup references remain!`);
    process.exitCode = 1;
  } else {
    console.log("✅ 100% genuine data verified. Zero mockup references found.");
  }
  return result;
}

// Direct CLI invocation
import { pathToFileURL } from "node:url";
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runMockupPurge().catch((err) => {
    console.error("Mockup purge failed:", err);
    process.exit(1);
  });
}
