import { readFileSync } from "node:fs";
// Additive migration. Back up first; rollback by restoring the online backup.
// Existing editorial sections are never replaced. No fake testimonials are seeded.
export function up(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS newsletter_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    consent_version TEXT NOT NULL,
    consent_text TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  const row = db.prepare("SELECT value FROM store_settings WHERE key=?").get("homepage_content_v1");
  if (!row) return;
  const content = JSON.parse(row.value);
  const additions = JSON.parse(readFileSync(new URL("../content/homepage-completion.json", import.meta.url), "utf8"));
  for (const [key, value] of Object.entries(additions)) if (!(key in content)) content[key] = value;
  // Add the two missing discovery destinations only when there is room.
  const tiles = content.discovery?.tiles;
  if (Array.isArray(tiles)) for (const [slug, title, image] of [
    ["herbal-infusions", "Herbal infusions.", "/images/cat-herbal-infusions.jpg"],
    ["oolong", "Oolong tea.", "/images/cat-oolong-tea.jpg"],
  ]) {
    const category = db.prepare("SELECT id FROM categories WHERE slug=?").get(slug);
    if (category && tiles.length < 4 && !tiles.some((t) => t.category_id === category.id)) tiles.push({ category_id:category.id, eyebrow:"EXPLORE THE COLLECTION", title, image_url:image, image_alt:"Illustrative loose-leaf tea still life.", cta_label:"Explore teas", tone:"dark" });
  }
  db.prepare("UPDATE store_settings SET value=? WHERE key=?").run(JSON.stringify(content), "homepage_content_v1");
}
