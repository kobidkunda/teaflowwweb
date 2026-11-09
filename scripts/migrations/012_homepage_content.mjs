import { readFileSync } from "node:fs";
// Additive content migration; never replaces an editor's existing homepage.
// Roll back application code or restore the pre-migration online backup; no destructive down migration.
export function up(db) {
  const content = JSON.parse(readFileSync(new URL("../content/homepage.json", import.meta.url), "utf8"));
  // Resolve categories by semantic slug, never assume IDs in deployed databases.
  content.discovery.tiles = content.discovery.tiles.flatMap((tile, index) => {
    const row = db.prepare("SELECT id FROM categories WHERE slug=?").get(index === 0 ? "black" : "green");
    return row ? [{ ...tile, category_id: row.id }] : [];
  });
  db.prepare("INSERT OR IGNORE INTO store_settings (key,value) VALUES (?,?)")
    .run("homepage_content_v1", JSON.stringify(content));
}
