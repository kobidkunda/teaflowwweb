import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { up } from "../../scripts/migrations/026_update_brand_tagline.mjs";

describe("Migration 026: Update Brand Tagline", () => {
  it("updates brand.tagline in site_content_blocks and store_settings", () => {
    const db = new Database(":memory:");
    try {
      db.exec(`
        CREATE TABLE site_content_blocks (
          key TEXT PRIMARY KEY,
          content TEXT NOT NULL,
          content_type TEXT NOT NULL DEFAULT 'text',
          description TEXT NOT NULL DEFAULT '',
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE store_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      db.prepare("INSERT INTO site_content_blocks (key, content) VALUES (?, ?)").run(
        "brand.tagline",
        "Single-Estate Himalayan Orthodox Teas from Origin"
      );
      db.prepare("INSERT INTO store_settings (key, value) VALUES (?, ?)").run(
        "brand_tagline",
        "Single-Estate Himalayan Orthodox Teas from Origin"
      );

      up(db);

      const block = db.prepare("SELECT content FROM site_content_blocks WHERE key = 'brand.tagline'").get() as { content: string };
      expect(block.content).toBe("Orthodox & CTC Teas from Origin");

      const setting = db.prepare("SELECT value FROM store_settings WHERE key = 'brand_tagline'").get() as { value: string };
      expect(setting.value).toBe("Orthodox & CTC Teas from Origin");
    } finally {
      db.close();
    }
  });

  it("handles empty or missing tables gracefully (additive & idempotent)", () => {
    const db = new Database(":memory:");
    try {
      expect(() => up(db)).not.toThrow();
    } finally {
      db.close();
    }
  });
});
