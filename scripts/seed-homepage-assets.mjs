import Database from "better-sqlite3";
import path from "node:path";

const db = new Database(path.resolve(process.env.DATABASE_PATH || "./data/store.sqlite"));

// 1. Insert media_uploads records
const uploads = [
  { filename: "hero-himalayan-tea.jpg", url: "/uploads/hero-himalayan-tea.jpg", alt: "Himalayan tea plantation at dawn with golden amber tea in glass cup", mime: "image/jpeg", size: 708752 },
  { filename: "product-darjeeling-tin.jpg", url: "/uploads/product-darjeeling-tin.jpg", alt: "Darjeeling First Flush emerald green tea tin caddy", mime: "image/jpeg", size: 746057 },
  { filename: "product-assam-tin.jpg", url: "/uploads/product-assam-tin.jpg", alt: "Assam Golden Breakfast champagne gold tea tin caddy", mime: "image/jpeg", size: 689354 },
  { filename: "product-nilgiri-tin.jpg", url: "/uploads/product-nilgiri-tin.jpg", alt: "Nilgiri Mist sage green tea tin caddy", mime: "image/jpeg", size: 673735 },
  { filename: "product-herbal-tin.jpg", url: "/uploads/product-herbal-tin.jpg", alt: "Himalayan Herbal terracotta tea tin caddy", mime: "image/jpeg", size: 613109 },
  { filename: "cat-green-tea.jpg", url: "/uploads/cat-green-tea.jpg", alt: "Green Tea loose leaf in ceramic dish", mime: "image/jpeg", size: 713483 },
  { filename: "cat-black-tea.jpg", url: "/uploads/cat-black-tea.jpg", alt: "Black Tea orthodox leaves in dish", mime: "image/jpeg", size: 647168 },
  { filename: "cat-herbal-infusions.jpg", url: "/uploads/cat-herbal-infusions.jpg", alt: "Herbal Infusions chamomile and botanicals", mime: "image/jpeg", size: 842225 },
  { filename: "cat-oolong-tea.jpg", url: "/uploads/cat-oolong-tea.jpg", alt: "Curled artisan Oolong tea leaves", mime: "image/jpeg", size: 747584 },
  { filename: "cat-tea-bags.jpg", url: "/uploads/cat-tea-bags.jpg", alt: "Pyramid silk tea bag with loose leaf tea", mime: "image/jpeg", size: 548938 },
  { filename: "cat-gift-sets.jpg", url: "/uploads/cat-gift-sets.jpg", alt: "Luxury tea gift set box with ribbon", mime: "image/jpeg", size: 745217 },
  { filename: "cat-iced-tea.jpg", url: "/uploads/cat-iced-tea.jpg", alt: "Cold brew iced tea with lemon and mint", mime: "image/jpeg", size: 623122 },
  { filename: "cat-accessories.jpg", url: "/uploads/cat-accessories.jpg", alt: "Artisan ceramic teapot and infuser strainer", mime: "image/jpeg", size: 730366 },
];

const checkUploadStmt = db.prepare("SELECT id FROM media_uploads WHERE filename=?");
const insertUploadStmt = db.prepare("INSERT INTO media_uploads (filename, url, alt_text, mime_type, file_size, sort_order) VALUES (?,?,?,?,?,?) ON CONFLICT(filename) DO UPDATE SET url=excluded.url");

for (let i = 0; i < uploads.length; i++) {
  const u = uploads[i];
  insertUploadStmt.run(u.filename, u.url, u.alt, u.mime, u.size, i);
}

// 2. Sliders table update (Curated 3 sliders with authentic high-res tea photography)
const heroSliders = [
  {
    id: 1,
    title: "Single-Estate Flushes & Mountain Terroirs.",
    subtitle: "Single-garden harvests, seasonal flushes, and micro-lots curated for those who seek purity, provenance and a deeper connection to tea.",
    image_url: "/uploads/upload_1791894845311_49cf0062f51c_teafloww_homepage_hero_1920x800.webp",
    fg_image_url: "/uploads/darjeeling-spring-hero-v2.webp",
    cta_label: "From Our Gardens to Your Cup",
    cta_href: "/shop",
    sort_order: 1,
  },
  {
    id: 2,
    title: "Fresh Harvest, Rich Flavour — Tea Inspiration",
    subtitle: "Tender downy buds plucked at dawn in misty Himalayan heights. Crisp muscatel notes with vibrant golden amber liquor.",
    image_url: "/uploads/upload_1791839388474_c26b4f4ddb2d_teafloww-fresh-harvest-1920x800.webp",
    fg_image_url: "",
    cta_label: "Origin Cupping & Ceremony",
    cta_href: "/shop?category=Black%20Tea",
    sort_order: 2,
  },
  {
    id: 3,
    title: "From Leaf to Cup — Discover the Tea Journey",
    subtitle: "Century-old clonal gardens along mist-shrouded mountain valleys. Deep honeyed malt, rich cocoa, and sweet vegetative vitality.",
    image_url: "/uploads/upload_1791839391093_8156e48d5836_teafloww-leaf-to-cup-1920x800.webp",
    fg_image_url: "",
    cta_label: "Crafted by Master Planters",
    cta_href: "/shop?category=Green%20Tea",
    sort_order: 3,
  },
];

const sliderUpsertStmt = db.prepare(`
  INSERT INTO sliders (id, title, subtitle, image_url, fg_image_url, cta_label, cta_href, sort_order, is_active)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
  ON CONFLICT(id) DO UPDATE SET
    title=excluded.title,
    subtitle=excluded.subtitle,
    image_url=excluded.image_url,
    fg_image_url=excluded.fg_image_url,
    cta_label=excluded.cta_label,
    cta_href=excluded.cta_href,
    sort_order=excluded.sort_order,
    is_active=1
`);

for (const s of heroSliders) {
  sliderUpsertStmt.run(s.id, s.title, s.subtitle, s.image_url, s.fg_image_url, s.cta_label, s.cta_href, s.sort_order);
}

// 3. Categories setup (8 categories from mockup)
const cats = [
  { slug: "green-tea", name: "Green Tea", file: "cat-green-tea.jpg", cover: "/uploads/cat-green-tea.jpg", order: 1 },
  { slug: "black-tea", name: "Black Tea", file: "cat-black-tea.jpg", cover: "/uploads/cat-black-tea.jpg", order: 2 },
  { slug: "herbal-infusions", name: "Herbal Infusions", file: "cat-herbal-infusions.jpg", cover: "/uploads/cat-herbal-infusions.jpg", order: 3 },
  { slug: "oolong-tea", name: "Oolong Tea", file: "cat-oolong-tea.jpg", cover: "/uploads/cat-oolong-tea.jpg", order: 4 },
  { slug: "tea-bags", name: "Tea Bags", file: "cat-tea-bags.jpg", cover: "/uploads/cat-tea-bags.jpg", order: 5 },
  { slug: "gift-sets", name: "Gift Sets", file: "cat-gift-sets.jpg", cover: "/uploads/cat-gift-sets.jpg", order: 6 },
  { slug: "iced-tea", name: "Iced Tea", file: "cat-iced-tea.jpg", cover: "/uploads/cat-iced-tea.jpg", order: 7 },
  { slug: "accessories", name: "Accessories", file: "cat-accessories.jpg", cover: "/uploads/cat-accessories.jpg", order: 8 },
];

const catStmt = db.prepare(`
  INSERT INTO categories (slug, name, sort_order, is_active, description, cover_image_url, media_id)
  VALUES (?, ?, ?, 1, ?, ?, ?)
  ON CONFLICT(slug) DO UPDATE SET
    name=excluded.name,
    sort_order=excluded.sort_order,
    is_active=1,
    cover_image_url=excluded.cover_image_url,
    media_id=excluded.media_id
`);

for (const c of cats) {
  const m = db.prepare("SELECT id FROM media_uploads WHERE filename=?").get(c.file);
  catStmt.run(c.slug, c.name, c.order, c.name + " collection", c.cover, m?.id ?? null);
}

// 4. Connect product_images
const prodImgStmt = db.prepare(`
  INSERT INTO product_images (product_id, media_id, url, alt_text, sort_order, is_primary)
  VALUES (?, ?, ?, ?, 0, 1)
`);

const prodMappings = [
  { slug: "darjeeling-spring", file: "product-darjeeling-tin.jpg", alt: "Darjeeling First Flush Tea Tin Caddy" },
  { slug: "assam-golden-breakfast", file: "product-assam-tin.jpg", alt: "Assam Golden Breakfast Tea Tin Caddy" },
  { slug: "nilgiri-mist-green", file: "product-nilgiri-tin.jpg", alt: "Nilgiri Mist Tea Tin Caddy" },
  { slug: "himalayan-white-peony", file: "product-herbal-tin.jpg", alt: "Himalayan Herbal Tea Tin Caddy" },
];

for (const p of prodMappings) {
  const prod = db.prepare("SELECT id FROM products WHERE slug=?").get(p.slug);
  const media = db.prepare("SELECT id, url FROM media_uploads WHERE filename=?").get(p.file);
  if (prod && media) {
    db.prepare("DELETE FROM product_images WHERE product_id=?").run(prod.id);
    prodImgStmt.run(prod.id, media.id, media.url, p.alt);
  }
}

console.log("Database successfully seeded with homepage assets!");
