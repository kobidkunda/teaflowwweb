// 010: Dynamic media management, entity associations & site placements (additive, versioned).
export function up(db) {
  // 1. Expand media_uploads table with metadata columns
  const mediaTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='media_uploads'").get();
  if (mediaTable) {
    const mediaCols = new Set(
      db.prepare("PRAGMA table_info(media_uploads)").all().map((c) => c.name)
    );
    if (!mediaCols.has("original_name")) {
      db.exec("ALTER TABLE media_uploads ADD COLUMN original_name TEXT NOT NULL DEFAULT '';");
    }
    if (!mediaCols.has("caption")) {
      db.exec("ALTER TABLE media_uploads ADD COLUMN caption TEXT NOT NULL DEFAULT '';");
    }
    if (!mediaCols.has("width")) {
      db.exec("ALTER TABLE media_uploads ADD COLUMN width INTEGER DEFAULT NULL;");
    }
    if (!mediaCols.has("height")) {
      db.exec("ALTER TABLE media_uploads ADD COLUMN height INTEGER DEFAULT NULL;");
    }
    if (!mediaCols.has("updated_at")) {
      db.exec("ALTER TABLE media_uploads ADD COLUMN updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP;");
    }

    // 2. Recreate media_assets view with all new columns + size_bytes compatibility
    db.exec("DROP VIEW IF EXISTS media_assets;");
    db.exec(`
      CREATE VIEW media_assets AS
      SELECT
        id,
        filename,
        original_name,
        url,
        mime_type,
        file_size,
        file_size AS size_bytes,
        width,
        height,
        alt_text,
        caption,
        sort_order,
        created_at,
        updated_at
      FROM media_uploads;
    `);
  }

  // 3. Link product_images to media_uploads
  const prodImgTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='product_images'").get();
  if (prodImgTable) {
    const prodImgCols = new Set(
      db.prepare("PRAGMA table_info(product_images)").all().map((c) => c.name)
    );
    if (!prodImgCols.has("media_id")) {
      db.exec("ALTER TABLE product_images ADD COLUMN media_id INTEGER REFERENCES media_uploads(id);");
      db.exec("CREATE INDEX IF NOT EXISTS idx_product_images_media ON product_images(media_id);");
    }
  }

  // 4. Link categories to media_uploads
  const catTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='categories'").get();
  if (catTable) {
    const catCols = new Set(
      db.prepare("PRAGMA table_info(categories)").all().map((c) => c.name)
    );
    if (!catCols.has("media_id")) {
      db.exec("ALTER TABLE categories ADD COLUMN media_id INTEGER REFERENCES media_uploads(id);");
      db.exec("CREATE INDEX IF NOT EXISTS idx_categories_media ON categories(media_id);");
    }
  }

  // 5. Link sliders to media_uploads
  const sliderTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sliders'").get();
  if (sliderTable) {
    const sliderCols = new Set(
      db.prepare("PRAGMA table_info(sliders)").all().map((c) => c.name)
    );
    if (!sliderCols.has("media_id")) {
      db.exec("ALTER TABLE sliders ADD COLUMN media_id INTEGER REFERENCES media_uploads(id);");
      db.exec("CREATE INDEX IF NOT EXISTS idx_sliders_media ON sliders(media_id);");
    }
  }

  // 6. Link blog_posts to media_uploads
  const blogTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='blog_posts'").get();
  if (blogTable) {
    const blogCols = new Set(
      db.prepare("PRAGMA table_info(blog_posts)").all().map((c) => c.name)
    );
    if (!blogCols.has("cover_media_id")) {
      db.exec("ALTER TABLE blog_posts ADD COLUMN cover_media_id INTEGER REFERENCES media_uploads(id);");
      db.exec("CREATE INDEX IF NOT EXISTS idx_blog_posts_cover_media ON blog_posts(cover_media_id);");
    }
  }

  // 7. Site Placements table for Homepage Hero, Story Art, and Site Sections
  db.exec(`
    CREATE TABLE IF NOT EXISTS site_placements (
      section_key TEXT PRIMARY KEY,
      media_id INTEGER REFERENCES media_uploads(id),
      image_url TEXT NOT NULL DEFAULT '',
      alt_text TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL DEFAULT '',
      subtitle TEXT NOT NULL DEFAULT '',
      cta_label TEXT NOT NULL DEFAULT '',
      cta_href TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_site_placements_media ON site_placements(media_id);
  `);

  // 8. Seed default site placements (idempotent)
  const insertPlacement = db.prepare(`
    INSERT OR IGNORE INTO site_placements (section_key, image_url, alt_text, title, subtitle)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertPlacement.run(
    "home_hero",
    "",
    "Fine tea cup against misty mountain shapes",
    "Closer to the garden. Better in the cup.",
    "Explore extraordinary tea through the language of origin, season and taste."
  );
  insertPlacement.run(
    "home_story",
    "",
    "Lush single-estate tea bushes nestled in Himalayan ridges",
    "Every tea has a story to tell.",
    "From source to ritual"
  );
}

export function down() {}
