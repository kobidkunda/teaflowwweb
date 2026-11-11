import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { setupAdminTestEnv, type TestEnv } from "./admin-e2e/test-helper";
import { resolveWholesalePrice, upsertProduct, getProduct, deleteProduct, deleteVariant, getVariant, listAllVariants } from "@/lib/products";
import { getStoreSettings, updateStoreSettings } from "@/lib/storeSettings";
import { createDemoOrder } from "@/lib/checkout";
import { syncAbandonedCart } from "@/lib/abandonedCarts";
import type { Variant } from "@/lib/productModels";

describe("Wholesale Mode & Dynamic Pricing Slabs", () => {
  let env: TestEnv;

  beforeAll(() => {
    env = setupAdminTestEnv();
  });

  afterAll(() => {
    env.cleanup();
  });

  describe("resolveWholesalePrice utility", () => {
    const mockVariant: Variant = {
      id: 123,
      product_id: 123,
      sku: "TEST-VAR-100G",
      packaging_format: "loose_leaf_pouch",
      grams: 100,
      servings: 50,
      price_paise: 10000, // ₹100
      compare_at_price_paise: 12000,
      stock: 500,
      wholesale_slabs: [
        { variant_id: 123, min_qty: 50, price_paise: 9000 },  // ₹90 for 50-99 pcs
        { variant_id: 123, min_qty: 100, price_paise: 8000 }, // ₹80 for 100-249 pcs
        { variant_id: 123, min_qty: 250, price_paise: 7000 }, // ₹70 for 250+ pcs
      ],
    };

    it("returns base retail price if no wholesale slabs exist", () => {
      const retailOnly: Variant = { ...mockVariant, wholesale_slabs: [] };
      const res = resolveWholesalePrice(retailOnly, 100);
      expect(res.unitPricePaise).toBe(10000);
      expect(res.percentDiscount).toBe(0);
      expect(res.savingsPaise).toBe(0);
    });

    it("returns base retail price if quantity is below lowest slab MOQ", () => {
      expect(resolveWholesalePrice(mockVariant, 1).unitPricePaise).toBe(10000);
      expect(resolveWholesalePrice(mockVariant, 49).unitPricePaise).toBe(10000);
      expect(resolveWholesalePrice(mockVariant, 49).percentDiscount).toBe(0);
      expect(resolveWholesalePrice(mockVariant, 49).savingsPaise).toBe(0);
    });

    it("resolves tier 1 slab when quantity is exactly or above 50 but below 100", () => {
      const res50 = resolveWholesalePrice(mockVariant, 50);
      expect(res50.unitPricePaise).toBe(9000);
      expect(res50.percentDiscount).toBe(10);
      expect(res50.savingsPaise).toBe(50000); // (10000 - 9000) * 50 = 50,000 paise (₹500 total savings)

      const res75 = resolveWholesalePrice(mockVariant, 75);
      expect(res75.unitPricePaise).toBe(9000);
      expect(res75.savingsPaise).toBe(75000);

      const res99 = resolveWholesalePrice(mockVariant, 99);
      expect(res99.unitPricePaise).toBe(9000);
    });

    it("resolves tier 2 slab when quantity is 100 to 249", () => {
      const res100 = resolveWholesalePrice(mockVariant, 100);
      expect(res100.unitPricePaise).toBe(8000);
      expect(res100.percentDiscount).toBe(20);
      expect(res100.savingsPaise).toBe(200000); // (10000 - 8000) * 100 = 200,000 paise (₹2,000 total savings)

      expect(resolveWholesalePrice(mockVariant, 150).unitPricePaise).toBe(8000);
      expect(resolveWholesalePrice(mockVariant, 249).unitPricePaise).toBe(8000);
    });

    it("resolves highest tier slab when quantity is 250+", () => {
      const res250 = resolveWholesalePrice(mockVariant, 250);
      expect(res250.unitPricePaise).toBe(7000);
      expect(res250.percentDiscount).toBe(30);
      expect(res250.savingsPaise).toBe(750000); // (10000 - 7000) * 250 = 750,000 paise (₹7,500 total savings)

      expect(resolveWholesalePrice(mockVariant, 1000).unitPricePaise).toBe(7000);
    });

    it("handles unsorted slabs correctly", () => {
      const unsortedVariant: Variant = {
        ...mockVariant,
        wholesale_slabs: [
          { variant_id: 123, min_qty: 200, price_paise: 7500 },
          { variant_id: 123, min_qty: 50, price_paise: 9000 },
          { variant_id: 123, min_qty: 100, price_paise: 8000 },
        ],
      };
      expect(resolveWholesalePrice(unsortedVariant, 60).unitPricePaise).toBe(9000);
      expect(resolveWholesalePrice(unsortedVariant, 120).unitPricePaise).toBe(8000);
      expect(resolveWholesalePrice(unsortedVariant, 300).unitPricePaise).toBe(7500);
    });
  });

  describe("Store Settings Wholesale MOQ", () => {
    it("returns default wholesale_moq = 50", () => {
      const settings = getStoreSettings();
      expect(settings.wholesale_moq).toBe(50);
    });

    it("allows updating wholesale_moq in store settings", () => {
      updateStoreSettings({ wholesale_moq: 100 });
      const updated = getStoreSettings();
      expect(updated.wholesale_moq).toBe(100);

      // Reset back to 50
      updateStoreSettings({ wholesale_moq: 50 });
      expect(getStoreSettings().wholesale_moq).toBe(50);
    });
  });

  describe("Product & Variant Wholesale Slabs Persistence", () => {
    it("persists wholesale_moq on products and wholesale_slabs on variants", () => {
      const created = upsertProduct({
        name: "Darjeeling Reserve Whole Leaf",
        slug: "darjeeling-reserve-wholesale-test",
        category: "Black Tea",
        origin: "Darjeeling, India",
        estate: "Test Estate",
        flush: "First Flush",
        harvest_date: "Spring 2026",
        description: "Test description",
        tasting_notes: "Muscatel",
        brew_temp: 95,
        brew_seconds: 180,
        wholesale_moq: 100,
        variants: [
          {
            sku: "DJ-TEST-100G",
            grams: 100,
            packaging_format: "loose_leaf_pouch",
            price_paise: 12000, // ₹120
            stock: 2000,
            wholesale_slabs: [
              { min_qty: 100, price_paise: 9500 },
              { min_qty: 500, price_paise: 8000 },
            ],
          },
        ],
      });

      expect(created.id).toBeDefined();

      // Fetch from DB and verify hydration
      const fetched = getProduct(created.id);
      expect(fetched).not.toBeNull();
      expect(fetched!.wholesale_moq).toBe(100);
      expect(fetched!.variants.length).toBe(1);

      const variant = fetched!.variants[0];
      expect(variant.sku).toBe("DJ-TEST-100G");
      expect(variant.wholesale_slabs).toBeDefined();
      expect(variant.wholesale_slabs!.length).toBe(2);
      expect(variant.wholesale_slabs![0]).toMatchObject({ min_qty: 100, price_paise: 9500 });
      expect(variant.wholesale_slabs![1]).toMatchObject({ min_qty: 500, price_paise: 8000 });

      // Test getVariant and listAllVariants hydration
      const singleVar = getVariant(variant.id);
      expect(singleVar).not.toBeNull();
      expect(singleVar!.wholesale_slabs?.length).toBe(2);

      const allVars = listAllVariants(created.id);
      expect(allVars.length).toBe(1);
      expect(allVars[0].wholesale_slabs?.length).toBe(2);
    });

    it("cleans up wholesale slabs when variant or product is deleted", () => {
      const created = upsertProduct({
        name: "Temporary Cleanup Tea",
        slug: "temp-cleanup-tea",
        category: "Black Tea",
        origin: "Assam, India",
        estate: "Cleanup Estate",
        flush: "Second Flush",
        harvest_date: "Summer 2026",
        description: "Test description",
        tasting_notes: "Malty",
        brew_temp: 95,
        brew_seconds: 180,
        variants: [
          {
            sku: "CLEANUP-VAR-1",
            grams: 100,
            packaging_format: "loose_leaf_pouch",
            price_paise: 10000,
            stock: 500,
            wholesale_slabs: [
              { min_qty: 50, price_paise: 8000 },
            ],
          },
          {
            sku: "CLEANUP-VAR-2",
            grams: 250,
            packaging_format: "loose_leaf_pouch",
            price_paise: 22000,
            stock: 500,
            wholesale_slabs: [
              { min_qty: 30, price_paise: 18000 },
            ],
          },
        ],
      });

      const prod = getProduct(created.id)!;
      const var1 = prod.variants[0];
      const var2 = prod.variants[1];

      // Slabs exist initially
      const initialSlabs = env.db.prepare("SELECT COUNT(*) as count FROM wholesale_slabs WHERE product_id = ?").get(created.id) as { count: number };
      expect(initialSlabs.count).toBe(2);

      // Delete variant 1: its slabs should be removed
      deleteVariant(var1.id);
      const afterVar1 = env.db.prepare("SELECT COUNT(*) as count FROM wholesale_slabs WHERE variant_id = ?").get(var1.id) as { count: number };
      expect(afterVar1.count).toBe(0);

      // Variant 2 slabs still remain
      const var2Slabs = env.db.prepare("SELECT COUNT(*) as count FROM wholesale_slabs WHERE variant_id = ?").get(var2.id) as { count: number };
      expect(var2Slabs.count).toBe(1);

      // Delete whole product: all remaining slabs should be removed
      deleteProduct(created.id);
      const afterProd = env.db.prepare("SELECT COUNT(*) as count FROM wholesale_slabs WHERE product_id = ?").get(created.id) as { count: number };
      expect(afterProd.count).toBe(0);
    });
  });

  describe("Wholesale Checkout Logic & Freight Handling", () => {
    it("creates wholesale order with discounted slab unit price and waived online freight (To-Pay)", () => {
      const product = upsertProduct({
        name: "Assam Orthodox Bulk Lot",
        slug: "assam-orthodox-bulk-test",
        category: "Black Tea",
        origin: "Assam, India",
        estate: "Test Estate",
        flush: "Second Flush",
        harvest_date: "Summer 2026",
        description: "Test description",
        tasting_notes: "Malty",
        brew_temp: 95,
        brew_seconds: 180,
        wholesale_moq: 50,
        variants: [
          {
            sku: "ASM-BULK-250G",
            grams: 250,
            packaging_format: "loose_leaf_pouch",
            price_paise: 20000, // ₹200
            stock: 1000,
            wholesale_slabs: [
              { min_qty: 50, price_paise: 16000 },  // ₹160 (20% off)
              { min_qty: 100, price_paise: 14000 }, // ₹140 (30% off)
            ],
          },
        ],
      });

      const fetched = getProduct(product.id)!;
      const variant = fetched.variants[0];

      // Order 100 units via checkout
      const orderResult = createDemoOrder({
        name: "Wholesale Partner Inc",
        email: "partner@example.com",
        address: "12 Commercial Freight Road, Kolkata, West Bengal, 700001",
        idempotencyKey: randomUUID(),
        items: [
          {
            variantId: Number(variant.id),
            quantity: 100,
          },
        ],
      });

      expect(orderResult.orderId).toBeDefined();

      // Verify created order directly in the database
      const order = env.db.prepare("SELECT * FROM orders WHERE id = ?").get(orderResult.orderId) as any;
      expect(order).toBeDefined();

      // Unit price should be ₹140 (14000 paise) from the 100-qty slab, not ₹200 (20000 paise)
      const expectedSubtotal = 100 * 14000; // 1,400,000 paise = ₹14,000
      expect(order.subtotal_paise).toBe(expectedSubtotal);

      // Online shipping must be ₹0 (To-Pay transport)
      expect(order.shipping_paise).toBe(0);
      expect(order.shipping_method).toBe("wholesale_transport_topay");

      // Verify order items record
      const items = env.db.prepare("SELECT * FROM order_items WHERE order_id = ?").all(orderResult.orderId) as any[];
      expect(items.length).toBe(1);
      expect(items[0].quantity).toBe(100);
      expect(items[0].unit_price_paise).toBe(14000);
    });

    it("handles mixed cart (retail item + wholesale item) correctly with transport freight", () => {
      const retailProd = upsertProduct({
        name: "Retail Trial Pouch",
        slug: "retail-trial-pouch-test",
        category: "Black Tea",
        origin: "Darjeeling, India",
        estate: "Retail Estate",
        flush: "First Flush",
        harvest_date: "Spring 2026",
        description: "Retail only tea",
        tasting_notes: "Delicate",
        brew_temp: 90,
        brew_seconds: 150,
        variants: [
          {
            sku: "RET-POUCH-50G",
            grams: 50,
            packaging_format: "loose_leaf_pouch",
            price_paise: 5000, // ₹50
            stock: 100,
          },
        ],
      });

      const wholesaleProd = upsertProduct({
        name: "Wholesale Bulk Tin",
        slug: "wholesale-bulk-tin-test",
        category: "Black Tea",
        origin: "Assam, India",
        estate: "Wholesale Estate",
        flush: "Second Flush",
        harvest_date: "Summer 2026",
        description: "Wholesale bulk tea",
        tasting_notes: "Robust",
        brew_temp: 95,
        brew_seconds: 180,
        wholesale_moq: 50,
        variants: [
          {
            sku: "WHOLE-TIN-250G",
            grams: 250,
            packaging_format: "luxury_tin",
            price_paise: 18000, // ₹180
            stock: 1000,
            wholesale_slabs: [
              { min_qty: 50, price_paise: 15000 }, // ₹150 (16.7% off)
            ],
          },
        ],
      });

      const retVar = getProduct(retailProd.id)!.variants[0];
      const whoVar = getProduct(wholesaleProd.id)!.variants[0];

      // Mixed order: 2 retail items + 50 wholesale items
      const mixedOrder = createDemoOrder({
        name: "Mixed Buyer",
        email: "mixed@example.com",
        address: "7 Commerce Road, Siliguri, West Bengal, 734001",
        idempotencyKey: randomUUID(),
        items: [
          { variantId: retVar.id, quantity: 2 },
          { variantId: whoVar.id, quantity: 50 },
        ],
      });

      const order = env.db.prepare("SELECT * FROM orders WHERE id = ?").get(mixedOrder.orderId) as any;
      expect(order).toBeDefined();

      // Subtotal: (2 * 5000) + (50 * 15000) = 10,000 + 750,000 = 760,000 paise
      expect(order.subtotal_paise).toBe(760000);
      // Because order includes wholesale cargo, transport dispatch is To-Pay (₹0 online)
      expect(order.shipping_paise).toBe(0);
      expect(order.shipping_method).toBe("wholesale_transport_topay");
    });

    it("rejects wholesale purchase if quantity is below minimum order quantity (MOQ)", () => {
      const product = upsertProduct({
        name: "Kangra Green Bulk Lot",
        slug: "kangra-green-bulk-test",
        category: "Green Tea",
        origin: "Kangra, India",
        estate: "Test Estate",
        flush: "Spring Flush",
        harvest_date: "Spring 2026",
        description: "Test description",
        tasting_notes: "Vegetal",
        brew_temp: 80,
        brew_seconds: 120,
        wholesale_moq: 60,
        variants: [
          {
            sku: "KNG-GREEN-100G",
            grams: 100,
            packaging_format: "loose_leaf_pouch",
            price_paise: 15000,
            stock: 500,
            wholesale_slabs: [
              { min_qty: 60, price_paise: 11000 },
            ],
          },
        ],
      });

      const fetched = getProduct(product.id)!;
      const variant = fetched.variants[0];

      // Try purchasing 25 units in wholesale mode (below lowest slab of 60)
      expect(() => {
        createDemoOrder({
          name: "Small Buyer",
          email: "small@example.com",
          address: "5 Market Lane, Shimla, Himachal Pradesh, 171001",
          idempotencyKey: randomUUID(),
          items: [
            {
              variantId: Number(variant.id),
              quantity: 25,
            },
          ],
        });
      }).toThrow(/Minimum wholesale quantity is 60 units/);
    });
  });

  describe("Abandoned Carts Wholesale Sync", () => {
    it("accurately computes subtotal and unit price with wholesale slabs during cart sync", () => {
      const product = upsertProduct({
        name: "Abandoned Wholesale Lot",
        slug: "abandoned-wholesale-lot",
        category: "Black Tea",
        origin: "Darjeeling, India",
        estate: "Sync Estate",
        flush: "First Flush",
        harvest_date: "Spring 2026",
        description: "Cart sync test",
        tasting_notes: "Floral",
        brew_temp: 95,
        brew_seconds: 180,
        wholesale_moq: 50,
        variants: [
          {
            sku: "SYNC-VAR-100G",
            grams: 100,
            packaging_format: "loose_leaf_pouch",
            price_paise: 10000, // ₹100 retail
            stock: 1000,
            wholesale_slabs: [
              { min_qty: 50, price_paise: 7500 }, // ₹75 wholesale (25% off)
            ],
          },
        ],
      });

      const variant = getProduct(product.id)!.variants[0];

      const syncResult = syncAbandonedCart({
        sessionId: "session_wholesale_test_123",
        items: [
          { variantId: variant.id, quantity: 100 },
        ],
        geo: { ip: "127.0.0.1", country: "IN", region: "WB", city: "Siliguri", isLocal: true },
        userAgent: "Vitest Agent",
      });

      expect(syncResult.status).toBe("active");

      // Verify subtotal in abandoned_carts table
      const cart = env.db.prepare("SELECT * FROM abandoned_carts WHERE id = ?").get(syncResult.cartId) as any;
      expect(cart).toBeDefined();
      // 100 * ₹75 (7500 paise) = 750,000 paise (not retail 100 * 10000 = 1,000,000)
      expect(cart.subtotal_paise).toBe(750000);
      expect(cart.item_count).toBe(100);

      // Verify cart_items table
      const items = env.db.prepare("SELECT * FROM cart_items WHERE cart_id = ?").all(syncResult.cartId) as any[];
      expect(items.length).toBe(1);
      expect(items[0].quantity).toBe(100);
      expect(items[0].unit_price_paise).toBe(7500);
    });
  });
});
