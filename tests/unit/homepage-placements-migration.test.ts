import { it, expect } from "vitest";
import Database from "better-sqlite3";
import { up } from "../../scripts/migrations/015_repair_homepage_placements.mjs";

it("repairs deprecated bento crop while preserving titles and custom operator placements", () => {
  const db = new Database(":memory:");
  try {
    db.exec(`
      CREATE TABLE media_uploads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL UNIQUE,
        original_name TEXT NOT NULL,
        url TEXT NOT NULL,
        alt_text TEXT NOT NULL,
        caption TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE site_placements (
        section_key TEXT PRIMARY KEY,
        media_id INTEGER,
        image_url TEXT NOT NULL,
        alt_text TEXT NOT NULL,
        title TEXT NOT NULL,
        subtitle TEXT NOT NULL,
        cta_label TEXT NOT NULL DEFAULT '',
        cta_href TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Insert demo seed values
    const insertPlacement = db.prepare(`
      INSERT INTO site_placements (section_key, media_id, image_url, alt_text, title, subtitle)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertPlacement.run("home_hero", 1, "/uploads/hero-himalayan-tea.jpg", "Fine tea cup", "Closer to the garden. Better in the cup.", "Old subtitle");
    insertPlacement.run("home_story", 2, "/uploads/bento-plantation.jpg", "Lush bushes", "Every tea has a story to tell.", "From source to ritual");

    // Run migration
    up(db);

    const hero = db.prepare("SELECT * FROM site_placements WHERE section_key = 'home_hero'").get() as any;
    expect(hero.image_url).toBe("/uploads/ritual-hero.webp");
    expect(hero.title).toBe("Closer to the garden. Better in the cup.");

    const story = db.prepare("SELECT * FROM site_placements WHERE section_key = 'home_story'").get() as any;
    expect(story.image_url).toBe("/uploads/ritual-story.webp");
    expect(story.title).toBe("Every tea has a story to tell.");

    // Verify idempotency
    up(db);
    const heroAfter = db.prepare("SELECT * FROM site_placements WHERE section_key = 'home_hero'").get() as any;
    expect(heroAfter.image_url).toBe("/uploads/ritual-hero.webp");

    // Verify operator custom image preservation
    db.prepare("UPDATE site_placements SET image_url = '/uploads/my-custom-story.jpg', title = 'My Custom Story' WHERE section_key = 'home_story'").run();
    up(db);
    const storyCustom = db.prepare("SELECT * FROM site_placements WHERE section_key = 'home_story'").get() as any;
    expect(storyCustom.image_url).toBe("/uploads/my-custom-story.jpg");
    expect(storyCustom.title).toBe("My Custom Story");
  } finally {
    db.close();
  }
});
