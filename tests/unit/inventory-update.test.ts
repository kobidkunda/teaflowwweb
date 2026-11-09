import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { rmSync } from "node:fs";
import Database from "better-sqlite3";
import { updateInventoryStock } from "../../src/lib/inventory";
import {
  inventoryUpdateSchema,
  normalizeInventoryInput,
} from "../../src/lib/validation";
import { dispatchToolCall, listToolDefinitions, McpError } from "../../src/lib/mcp";

// Isolated DB: temp file migrated fresh, so inventory tests never touch dev data.
const TEST_DB = path.join(tmpdir(), `inventory-test-${process.pid}.sqlite`);
process.env.DATABASE_PATH = TEST_DB;
process.env.SESSION_SECRET = process.env.SESSION_SECRET || "inventory-test-session-secret-0123456789abcdef";

function seedCatalog() {
  const db = new Database(TEST_DB);
  db.pragma("foreign_keys = ON");
  const prod = db.prepare(
    "INSERT INTO products (slug, name, category, origin, estate, flush, harvest_date, description, tasting_notes, floral, fruity, malty, body, brew_temp, brew_seconds, featured, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );
  const variant = db.prepare(
    "INSERT INTO variants (product_id, sku, grams, price_paise, stock, packaging_format, servings) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  const pOld = prod.run(
    "darjeeling-spring", "Older Darjeeling Listing", "Black", "Darjeeling",
    "Test estate", "First Flush", "Spring", "Desc", "Notes", 1, 1, 1, 1, 90, 180, 0, "published"
  ).lastInsertRowid as number;
  variant.run(pOld, "OLD-DJ-100G", 100, 19900, 42, "loose_leaf_pouch", 50);
  variant.run(pOld, "OLD-DJ-200G", 200, 29900, 7, "loose_leaf_pouch", 100);

  const pMulti = prod.run(
    "assam-test", "Assam Test", "Black", "Assam",
    "Test estate", "Summer", "Summer", "Desc", "Notes", 1, 1, 1, 1, 90, 180, 0, "published"
  ).lastInsertRowid as number;
  variant.run(pMulti, "AS-T-100G", 100, 19900, 30, "loose_leaf_pouch", 50);
  variant.run(pMulti, "AS-T-200G", 200, 29900, 20, "loose_leaf_pouch", 100);

  const pEmpty = prod.run(
    "empty-test", "Empty Test", "Green", "Nilgiri",
    "Test estate", "Spring", "Spring", "Desc", "Notes", 1, 1, 1, 1, 80, 150, 0, "published"
  ).lastInsertRowid as number;
  db.close();
  return { pOld, pMulti, pEmpty };
}

describe("inventory exact-quantity update action", () => {
  beforeAll(() => {
    for (const suffix of ["", "-shm", "-wal", "-journal"]) {
      try { rmSync(TEST_DB + suffix, { force: true }); } catch { /* ignore */ }
    }
    execFileSync(process.execPath, ["scripts/migrate.mjs"], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_PATH: TEST_DB },
      stdio: "ignore",
    });
    seedCatalog();
  });

  it("sets a single variant by SKU to the exact quantity", () => {
    const { body, deduped } = updateInventoryStock({ sku: "AS-T-100G", quantity: 5 });
    expect(deduped).toBe(false);
    expect(body.quantity).toBe(5);
    expect(body.updated).toBe(1);
    expect(body.variants).toEqual([{ id: expect.any(Number), sku: "AS-T-100G", stock: 5 }]);
    const db = new Database(TEST_DB, { readonly: true });
    expect((db.prepare("SELECT stock FROM variants WHERE sku=?").get("AS-T-100G") as { stock: number }).stock).toBe(5);
    // Sibling variant untouched.
    expect((db.prepare("SELECT stock FROM variants WHERE sku=?").get("AS-T-200G") as { stock: number }).stock).toBe(20);
    db.close();
  });

  it("accepts lowercase SKU and stock/inventory aliases", () => {
    const normalized = normalizeInventoryInput({ sku: "as-t-200g", stock: 5 });
    expect(normalized.sku).toBe("AS-T-200G");
    const parsed = inventoryUpdateSchema.safeParse(normalized);
    expect(parsed.success).toBe(true);
    const { body } = updateInventoryStock({ sku: "as-t-200g", quantity: 5 });
    expect(body.variants[0].stock).toBe(5);

    const invAlias = inventoryUpdateSchema.safeParse(normalizeInventoryInput({ sku: "AS-T-200G", inventory: 6 }));
    expect(invAlias.success).toBe(true);
    if (invAlias.success) expect(invAlias.data.quantity).toBe(6);
  });

  it("sets ALL variants of a product to the exact quantity", () => {
    const { body } = updateInventoryStock({ product: "assam-test", quantity: 5 });
    expect(body.updated).toBe(2);
    expect(body.createdDefaultVariant).toBe(false);
    const db = new Database(TEST_DB, { readonly: true });
    const rows = db.prepare("SELECT stock FROM variants WHERE product_id=? ORDER BY id").all(body.product.id) as { stock: number }[];
    expect(rows.map((r) => r.stock)).toEqual([5, 5]);
    db.close();
  });

  it("resolves numeric product ids and variantId targets", () => {
    const db = new Database(TEST_DB, { readonly: true });
    const prod = db.prepare("SELECT id FROM products WHERE slug=?").get("assam-test") as { id: number };
    const vari = db.prepare("SELECT id FROM variants WHERE sku=?").get("AS-T-100G") as { id: number };
    db.close();
    const byId = updateInventoryStock({ product: prod.id, quantity: 9 });
    expect(byId.body.updated).toBe(2);
    const byVariant = updateInventoryStock({ variantId: vari.id, quantity: 4 });
    expect(byVariant.body.variants[0].stock).toBe(4);
    // Restore exact-5 for later assertions.
    updateInventoryStock({ product: "assam-test", quantity: 5 });
  });

  it("creates one default variant at the exact quantity for variant-less products", () => {
    const { body } = updateInventoryStock({ product: "empty-test", quantity: 5 });
    expect(body.updated).toBe(1);
    expect(body.createdDefaultVariant).toBe(true);
    expect(body.variants[0].stock).toBe(5);
    const db = new Database(TEST_DB, { readonly: true });
    const rows = db.prepare("SELECT sku, stock, grams, price_paise FROM variants WHERE product_id=?").all(body.product.id) as {
      sku: string; stock: number; grams: number; price_paise: number;
    }[];
    expect(rows).toHaveLength(1);
    expect(rows[0].stock).toBe(5);
    expect(rows[0].grams).toBe(100);
    expect(rows[0].price_paise).toBe(19900);
    db.close();
  });

  it("rejects unknown products, unknown SKUs, mismatched pairs, and bad quantities", () => {
    expect(() => updateInventoryStock({ product: "no-such-tea", quantity: 5 })).toThrow("Product not found.");
    expect(() => updateInventoryStock({ sku: "NOPE-1G", quantity: 5 })).toThrow("Variant not found.");
    expect(() => updateInventoryStock({ variantId: 999999, quantity: 5 })).toThrow("Variant not found.");
    expect(() => updateInventoryStock({ product: "assam-test", sku: "OLD-DJ-100G", quantity: 5 })).toThrow(
      "does not belong"
    );
    expect(() => updateInventoryStock({ sku: "AS-T-100G", quantity: -1 })).toThrow("Quantity");
    expect(inventoryUpdateSchema.safeParse({ quantity: 5 }).success).toBe(false);
    expect(inventoryUpdateSchema.safeParse({ sku: "AS-T-100G", quantity: -1 }).success).toBe(false);
    expect(inventoryUpdateSchema.safeParse({ sku: "AS-T-100G", quantity: 1000000 }).success).toBe(false);
  });

  it("replays idempotency keys without double-applying", () => {
    const key = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const first = updateInventoryStock({ sku: "AS-T-100G", quantity: 5, idempotencyKey: key });
    expect(first.deduped).toBe(false);
    const replay = updateInventoryStock({ sku: "AS-T-100G", quantity: 5, idempotencyKey: key });
    expect(replay.deduped).toBe(true);
    expect(replay.body).toEqual(first.body);
  });

  it("exposes inventory.updateStock via MCP with aliases and leaves other listings unchanged", () => {
    const names = listToolDefinitions().map((t) => t.name);
    expect(names).toContain("inventory.updateStock");
    const tool = listToolDefinitions().find((t) => t.name === "inventory.updateStock");
    expect(tool?.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    });

    const viaCanonical = dispatchToolCall("inventory.updateStock", {
      product: "empty-test",
      quantity: 5,
    }) as { updated: number; quantity: number };
    expect(viaCanonical.quantity).toBe(5);

    const viaAlias = dispatchToolCall("admin.updateInventory", {
      sku: "AS-T-200G",
      stock: 5,
    }) as { variants: { sku: string; stock: number }[] };
    expect(viaAlias.variants[0]).toMatchObject({ sku: "AS-T-200G", stock: 5 });

    const viaUnderscore = dispatchToolCall("inventory_updateStock", {
      sku: "AS-T-100G",
      inventory: 5,
    }) as { variants: { stock: number }[] };
    expect(viaUnderscore.variants[0].stock).toBe(5);

    // Older Darjeeling listing was never in the update path above: still exact.
    const db = new Database(TEST_DB, { readonly: true });
    expect((db.prepare("SELECT stock FROM variants WHERE sku=?").get("OLD-DJ-100G") as { stock: number }).stock).toBe(42);
    expect((db.prepare("SELECT stock FROM variants WHERE sku=?").get("OLD-DJ-200G") as { stock: number }).stock).toBe(7);
    db.close();

    expect(() => dispatchToolCall("inventory.updateStock", { sku: "NOPE-1G", quantity: 5 })).toThrowError();
    try {
      dispatchToolCall("inventory.updateStock", { quantity: 5 });
      throw new Error("expected inventory.updateStock to fail");
    } catch (e) {
      expect(e).toBeInstanceOf(McpError);
      expect((e as McpError).code).toBe(-32602);
    }
  });
});

describe("POST /api/admin/inventory authorization and validation", () => {
  it("rejects unauthenticated callers", async () => {
    const { POST } = await import("../../src/app/api/admin/inventory/route");
    const res = await POST(
      new Request("http://x/api/admin/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku: "AS-T-100G", quantity: 5 }),
      })
    );
    expect(res.status).toBe(401);
  });

  it("rejects missing quantity and unknown SKUs for authenticated staff", async () => {
    const { hashPassword } = await import("../../src/lib/password");
    const setupDb = new Database(TEST_DB);
    setupDb.prepare(
      "INSERT OR IGNORE INTO admin_users (username, password_hash, role, is_active) VALUES (?, ?, ?, 1)"
    ).run("inventory_root", hashPassword("test-root-password-123456"), "root");
    setupDb.close();
    const { resetRateLimits } = await import("../../src/lib/rateLimit");
    resetRateLimits();
    const { POST: loginPOST } = await import("../../src/app/api/admin/login/route");
    const loginRes = await loginPOST(
      new Request("http://x/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "inventory_root", password: "test-root-password-123456" }),
      })
    );
    expect(loginRes.status).toBe(200);
    const cookie = (loginRes.headers.get("Set-Cookie") || "").split(";")[0];
    expect(cookie).toContain("=");

    const { POST } = await import("../../src/app/api/admin/inventory/route");
    const badRes = await POST(
      new Request("http://x/api/admin/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ sku: "AS-T-100G" }),
      })
    );
    expect(badRes.status).toBe(400);

    const missingRes = await POST(
      new Request("http://x/api/admin/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ sku: "NOPE-1G", quantity: 5 }),
      })
    );
    expect(missingRes.status).toBe(404);

    const okRes = await POST(
      new Request("http://x/api/admin/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ sku: "AS-T-100G", quantity: 5 }),
      })
    );
    expect([200, 201]).toContain(okRes.status);
    const okBody = (await okRes.json()) as { variants: { sku: string; stock: number }[]; quantity: number };
    expect(okBody.quantity).toBe(5);
    expect(okBody.variants[0]).toMatchObject({ sku: "AS-T-100G", stock: 5 });
  });
});

afterAll(() => {
  for (const suffix of ["", "-shm", "-wal", "-journal"]) {
    try { rmSync(TEST_DB + suffix, { force: true }); } catch { /* ignore */ }
  }
});
