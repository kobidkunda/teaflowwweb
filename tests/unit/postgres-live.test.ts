import { describe, it, expect, afterAll } from "vitest";
import { getPostgresDb } from "../../src/lib/postgresDriver";

const runLive = process.env.TEST_POSTGRES === "1";

describe.skipIf(!runLive)("PostgreSQL Driver Integration", () => {
  const db = runLive ? getPostgresDb() : (null as any);

  afterAll(() => {
    if (runLive && db) {
      db.close();
    }
  });

  it("should query products correctly from PostgreSQL", () => {
    const stmt = db.prepare("SELECT id, slug, name, category FROM products WHERE slug = ?");
    const row = stmt.get("darjeeling-spring") as { id: number; slug: string; name: string } | undefined;
    expect(row).toBeDefined();
    expect(row?.slug).toBe("darjeeling-spring");
    expect(row?.name).toContain("Darjeeling Spring");
  });

  it("should list variants for a product correctly", () => {
    const stmt = db.prepare("SELECT id, sku, grams, price_paise FROM variants WHERE product_id = ? ORDER BY grams ASC");
    const rows = stmt.all(1) as { id: number; sku: string; grams: number }[];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].grams).toBeGreaterThan(0);
  });

  it("should support table existence queries (sqlite_master normalized to pg_tables)", () => {
    const stmt = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='products'");
    const row = stmt.get() as { name: string } | undefined;
    expect(row).toBeDefined();
    expect(row?.name).toBe("products");
  });

  it("should support case-insensitive ILIKE search", () => {
    const stmt = db.prepare("SELECT id, name FROM products WHERE name LIKE ?");
    const rows = stmt.all("%darjeeling%") as { id: number; name: string }[];
    expect(rows.length).toBeGreaterThan(0);
  });

  it("should handle transactions and rollbacks properly", () => {
    const tx = db.transaction(() => {
      db.prepare("INSERT INTO coupons (code, kind, value) VALUES (?, ?, ?)").run("TEMPTEST99", "flat", 100);
      throw new Error("Force Rollback");
    });

    expect(() => tx()).toThrow("Force Rollback");

    const check = db.prepare("SELECT code FROM coupons WHERE code = ?").get("TEMPTEST99");
    expect(check).toBeUndefined();
  });

  it("should support .immediate(), .deferred(), and .exclusive() transaction invocation", () => {
    let executed = false;
    const tx = db.transaction(() => {
      executed = true;
      return 42;
    });

    expect(typeof tx.immediate).toBe("function");
    expect(typeof tx.deferred).toBe("function");
    expect(typeof tx.exclusive).toBe("function");
    expect(tx.immediate()).toBe(42);
    expect(executed).toBe(true);
  });
});
