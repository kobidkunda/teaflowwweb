// 011: SEO metadata fields for products, categories, and blog posts (additive, versioned).
export function up(db) {
  // 1. Add SEO columns to products
  const productCols = new Set(
    db.prepare("PRAGMA table_info(products)").all().map((c) => c.name)
  );
  if (!productCols.has("seo_title")) {
    db.exec("ALTER TABLE products ADD COLUMN seo_title TEXT DEFAULT NULL;");
  }
  if (!productCols.has("seo_description")) {
    db.exec("ALTER TABLE products ADD COLUMN seo_description TEXT DEFAULT NULL;");
  }
  if (!productCols.has("canonical_override")) {
    db.exec("ALTER TABLE products ADD COLUMN canonical_override TEXT DEFAULT NULL;");
  }
  if (!productCols.has("noindex")) {
    db.exec("ALTER TABLE products ADD COLUMN noindex INTEGER NOT NULL DEFAULT 0;");
  }

  // 2. Add SEO columns to categories
  const catTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='categories'").get();
  if (catTable) {
    const catCols = new Set(
      db.prepare("PRAGMA table_info(categories)").all().map((c) => c.name)
    );
    if (!catCols.has("seo_title")) {
      db.exec("ALTER TABLE categories ADD COLUMN seo_title TEXT DEFAULT NULL;");
    }
    if (!catCols.has("seo_description")) {
      db.exec("ALTER TABLE categories ADD COLUMN seo_description TEXT DEFAULT NULL;");
    }
    if (!catCols.has("canonical_override")) {
      db.exec("ALTER TABLE categories ADD COLUMN canonical_override TEXT DEFAULT NULL;");
    }
    if (!catCols.has("noindex")) {
      db.exec("ALTER TABLE categories ADD COLUMN noindex INTEGER NOT NULL DEFAULT 0;");
    }
  }

  // 3. Add SEO columns to blog_posts
  const blogTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='blog_posts'").get();
  if (blogTable) {
    const blogCols = new Set(
      db.prepare("PRAGMA table_info(blog_posts)").all().map((c) => c.name)
    );
    if (!blogCols.has("seo_title")) {
      db.exec("ALTER TABLE blog_posts ADD COLUMN seo_title TEXT DEFAULT NULL;");
    }
    if (!blogCols.has("seo_description")) {
      db.exec("ALTER TABLE blog_posts ADD COLUMN seo_description TEXT DEFAULT NULL;");
    }
    if (!blogCols.has("canonical_override")) {
      db.exec("ALTER TABLE blog_posts ADD COLUMN canonical_override TEXT DEFAULT NULL;");
    }
    if (!blogCols.has("noindex")) {
      db.exec("ALTER TABLE blog_posts ADD COLUMN noindex INTEGER NOT NULL DEFAULT 0;");
    }
  }
}
