// 009: Admin portal expansion (additive, versioned).
// Expands categories and orders; creates blog_posts, media_uploads, store_settings,
// analytics_events, and mcp_logs.
export function up(db) {
  // 1. Expand categories (description, cover image, parent category)
  const categoryCols = db.prepare("PRAGMA table_info(categories)").all().map((c) => c.name);
  if (!categoryCols.includes("description")) {
    db.exec("ALTER TABLE categories ADD COLUMN description TEXT NOT NULL DEFAULT '';");
  }
  if (!categoryCols.includes("cover_image_url")) {
    db.exec("ALTER TABLE categories ADD COLUMN cover_image_url TEXT;");
  }
  if (!categoryCols.includes("parent_id")) {
    db.exec("ALTER TABLE categories ADD COLUMN parent_id INTEGER REFERENCES categories(id);");
    db.exec("CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);");
  }

  // 2. Expand orders with admin notes
  const orderCols = db.prepare("PRAGMA table_info(orders)").all().map((c) => c.name);
  if (!orderCols.includes("admin_notes")) {
    db.exec("ALTER TABLE orders ADD COLUMN admin_notes TEXT NOT NULL DEFAULT '';");
  }

  // 3. Blog articles table
  db.exec([
    "CREATE TABLE IF NOT EXISTS blog_posts (",
    "  id INTEGER PRIMARY KEY AUTOINCREMENT,",
    "  slug TEXT NOT NULL UNIQUE,",
    "  title TEXT NOT NULL,",
    "  excerpt TEXT NOT NULL DEFAULT '',",
    "  summary TEXT DEFAULT '',",
    "  content TEXT NOT NULL,",
    "  cover_image_url TEXT,",
    "  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),",
    "  author_name TEXT NOT NULL DEFAULT 'Himalayan Tea House',",
    "  published_at TEXT,",
    "  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,",
    "  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP",
    ");",
    "CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);",
    "CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status, published_at);",
  ].join("\n"));

  // 4. Standalone media uploads library
  db.exec([
    "CREATE TABLE IF NOT EXISTS media_uploads (",
    "  id INTEGER PRIMARY KEY AUTOINCREMENT,",
    "  filename TEXT NOT NULL UNIQUE,",
    "  url TEXT NOT NULL,",
    "  alt_text TEXT NOT NULL DEFAULT '',",
    "  mime_type TEXT NOT NULL,",
    "  file_size INTEGER NOT NULL,",
    "  sort_order INTEGER NOT NULL DEFAULT 0,",
    "  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP",
    ");",
    "CREATE INDEX IF NOT EXISTS idx_media_uploads_created ON media_uploads(created_at DESC);",
    "CREATE INDEX IF NOT EXISTS idx_media_uploads_filename ON media_uploads(filename);",
    "CREATE VIEW IF NOT EXISTS media_assets AS",
    "  SELECT id, filename, url, mime_type, file_size AS size_bytes, alt_text, created_at",
    "  FROM media_uploads;",
  ].join("\n"));

  // 5. Store operational settings
  db.exec([
    "CREATE TABLE IF NOT EXISTS store_settings (",
    "  key TEXT PRIMARY KEY,",
    "  value TEXT NOT NULL,",
    "  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP",
    ");",
  ].join("\n"));

  // Seed default operational settings (idempotent)
  const insertSetting = db.prepare("INSERT OR IGNORE INTO store_settings (key, value) VALUES (?, ?)");
  insertSetting.run("currency", "INR");
  insertSetting.run("tax_rate_percent", "5");
  insertSetting.run("shipping_flat_paise", "9900");
  insertSetting.run("shipping_fee_paise", "9900");
  insertSetting.run("free_shipping_threshold_paise", "150000");
  insertSetting.run("contact_email", "support@himalayantea.com");
  insertSetting.run("store_name", "Himalayan Tea House");

  // 6. Analytics events
  db.exec([
    "CREATE TABLE IF NOT EXISTS analytics_events (",
    "  id INTEGER PRIMARY KEY AUTOINCREMENT,",
    "  session_id TEXT NOT NULL,",
    "  event_type TEXT NOT NULL DEFAULT 'pageview',",
    "  path TEXT NOT NULL,",
    "  referrer TEXT NOT NULL DEFAULT '',",
    "  user_agent TEXT NOT NULL DEFAULT '',",
    "  ip_hash TEXT NOT NULL DEFAULT '',",
    "  metadata TEXT NOT NULL DEFAULT '{}',",
    "  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP",
    ");",
    "CREATE INDEX IF NOT EXISTS idx_analytics_created_type ON analytics_events(created_at, event_type);",
    "CREATE INDEX IF NOT EXISTS idx_analytics_path ON analytics_events(path);",
    "CREATE VIEW IF NOT EXISTS visitor_events AS",
    "  SELECT id, session_id, path, referrer, user_agent, created_at",
    "  FROM analytics_events;",
  ].join("\n"));

  // 7. MCP execution logs
  db.exec([
    "CREATE TABLE IF NOT EXISTS mcp_logs (",
    "  id INTEGER PRIMARY KEY AUTOINCREMENT,",
    "  method TEXT NOT NULL,",
    "  tool_name TEXT NOT NULL DEFAULT '',",
    "  arguments TEXT NOT NULL DEFAULT '{}',",
    "  status TEXT NOT NULL DEFAULT 'success' CHECK(status IN ('success','error')),",
    "  error_code INTEGER,",
    "  error_message TEXT,",
    "  duration_ms INTEGER NOT NULL DEFAULT 0,",
    "  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP",
    ");",
    "CREATE INDEX IF NOT EXISTS idx_mcp_logs_created ON mcp_logs(created_at DESC);",
  ].join("\n"));
}

export function down() {}
