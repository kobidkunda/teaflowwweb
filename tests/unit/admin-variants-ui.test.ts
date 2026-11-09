import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { setupAdminTestEnv, getAuthCookie, type TestEnv } from "./admin-e2e/test-helper";
import { GET as variantsGET, POST as variantsPOST } from "@/app/api/admin/variants/route";
import { PATCH as variantDetailPATCH, DELETE as variantDetailDELETE } from "@/app/api/admin/variants/[id]/route";
import { VariantForm } from "@/components/admin/catalog/VariantForm";
import { getVariant } from "@/lib/products";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/admin/variants",
  useParams: () => ({ id: "1" }),
}));

describe("Admin Variants UI/UX & Inventory Management Unit Tests", () => {
  let env: TestEnv;
  let authCookie: string;
  let testProductId: number;
  let createdVariantId: number;

  beforeAll(() => {
    env = setupAdminTestEnv();
    authCookie = getAuthCookie(env.db, "root");

    // Insert a test tea product
    const stmt = env.db.prepare(`
      INSERT INTO products (
        slug, name, category, origin, estate, flush, harvest_date,
        description, tasting_notes, floral, fruity, malty, body, brew_temp, brew_seconds, featured
      ) VALUES (
        'single-estate-muscatel', 'Single Estate Muscatel Second Flush', 'Black',
        'Darjeeling', 'Gopaldhara', 'Second Flush', 'June 2026',
        'Remarkable muscatel grape notes with amber hue.', 'Muscatel, Apricot, Honey',
        3, 4, 2, 3, 90, 180, 1
      )
    `);
    const info = stmt.run();
    testProductId = Number(info.lastInsertRowid);
  });

  afterAll(() => {
    env.cleanup();
  });

  describe("API Data Contract & Enriched Metadata", () => {
    it("creates a multi-format variant via POST /api/admin/variants with packaging format and servings", async () => {
      const payload = {
        product_id: testProductId,
        sku: "GOP-MUSC-TIN-100G",
        packaging_format: "luxury_tin",
        grams: 100,
        servings: 50,
        price_paise: 145000, // ₹1,450.00
        stock: 28,
      };

      const req = new Request("http://localhost/api/admin/variants", {
        method: "POST",
        headers: { Cookie: authCookie, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const res = await variantsPOST(req);
      expect(res.status).toBe(201);
      const data = (await res.json()) as { id: number; sku: string };
      expect(data.id).toBeTypeOf("number");
      expect(data.sku).toBe("GOP-MUSC-TIN-100G");
      createdVariantId = data.id;
    });

    it("retrieves variants with joined product metadata and pricing", async () => {
      const req = new Request(`http://localhost/api/admin/variants?productId=${testProductId}`, {
        headers: { Cookie: authCookie },
      });
      const res = variantsGET(req);
      expect(res.status).toBe(200);
      const data = (await res.json()) as { variants: Array<{ id: number; sku: string; product_name?: string; packaging_format: string; stock: number }> };
      expect(data.variants.length).toBeGreaterThanOrEqual(1);

      const found = data.variants.find((v) => v.id === createdVariantId);
      expect(found).toBeDefined();
      expect(found?.sku).toBe("GOP-MUSC-TIN-100G");
      expect(found?.product_name).toBe("Single Estate Muscatel Second Flush");
      expect(found?.packaging_format).toBe("luxury_tin");
      expect(found?.stock).toBe(28);
    });

    it("updates stock units seamlessly via PATCH /api/admin/variants/[id] (quick adjuster endpoint)", async () => {
      const patchReq = new Request(`http://localhost/api/admin/variants/${createdVariantId}`, {
        method: "PATCH",
        headers: { Cookie: authCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ stock: 35 }),
      });

      const res = await variantDetailPATCH(patchReq, { params: Promise.resolve({ id: String(createdVariantId) }) });
      expect(res.status).toBe(200);
      const data = (await res.json()) as { variant: { stock: number } };
      expect(data.variant.stock).toBe(35);

      const verified = getVariant(createdVariantId);
      expect(verified?.stock).toBe(35);
    });

    it("returns 409 conflict when deleting variant referenced by orders", async () => {
      // Create test order and order item with real columns
      env.db.prepare(
        "INSERT INTO orders (id, idempotency_key, customer_name, customer_email, shipping_address, subtotal_paise, shipping_paise, total_paise) " +
        "VALUES ('order-dep-var-1', 'dep-key-var-1', 'Tea Customer', 'customer@example.com', '10 Estate Way', 145000, 9900, 154900)"
      ).run();

      env.db.prepare(
        "INSERT INTO order_items (order_id, variant_id, quantity, unit_price_paise) " +
        "VALUES ('order-dep-var-1', ?, 1, 145000)"
      ).run(createdVariantId);

      const delReq = new Request(`http://localhost/api/admin/variants/${createdVariantId}`, {
        method: "DELETE",
        headers: { Cookie: authCookie },
      });

      const delRes = await variantDetailDELETE(delReq, { params: Promise.resolve({ id: String(createdVariantId) }) });
      expect(delRes.status).toBe(409);
      const data = (await delRes.json()) as { error: string };
      expect(data.error).toContain("orders or line items reference it");
    });
  });

  describe("VariantForm UI Component Rendering & Accessibility", () => {
    it("renders create form with all accessible legends, format options, and price calculations", () => {
      const markup = renderToStaticMarkup(
        React.createElement(VariantForm, {
          isEdit: false,
          defaultProductId: testProductId,
        })
      );

      // Accessibility landmarks & legends
      expect(markup).toContain('aria-label="Create Variant"');
      expect(markup).toContain("Tea Lot &amp; Product Assignment");
      expect(markup).toContain("SKU Code &amp; Packaging Format");
      expect(markup).toContain("Specifications, Pricing &amp; Inventory");

      // Format options
      expect(markup).toContain("Loose Leaf Pouch");
      expect(markup).toContain("Luxury Brass Tin");
      expect(markup).toContain("Pyramid Tea Bags");

      // Input fields with accessible IDs
      expect(markup).toContain('id="variant-product-select"');
      expect(markup).toContain('id="variant-sku-input"');
      expect(markup).toContain('id="variant-grams-input"');
      expect(markup).toContain('id="variant-servings-input"');
      expect(markup).toContain('id="variant-price-input"');
      expect(markup).toContain('id="variant-stock-input"');

      // Smart SKU suggest button
      expect(markup).toContain("Suggest SKU");

      // Weight presets
      expect(markup).toContain("50g");
      expect(markup).toContain("100g");
      expect(markup).toContain("250g");
      expect(markup).toContain("500g");
      expect(markup).toContain("1000g");

      // Currency indication
      expect(markup).toContain("Retail Price (₹ Rupees)");
      expect(markup).toContain("paise</strong> on server.");
    });

    it("renders edit form pre-populated with existing variant attributes", () => {
      const markup = renderToStaticMarkup(
        React.createElement(VariantForm, {
          isEdit: true,
          variantId: 42,
          initialData: {
            id: 42,
            product_id: testProductId,
            sku: "TEST-TIN-250G",
            packaging_format: "luxury_tin",
            grams: 250,
            servings: 125,
            price_paise: 299900,
            stock: 12,
          },
        })
      );

      expect(markup).toContain('aria-label="Edit Variant"');
      expect(markup).toContain("Edit Variant: TEST-TIN-250G");
      expect(markup).toContain('value="TEST-TIN-250G"');
      expect(markup).toContain('value="250"');
      expect(markup).toContain('value="125"');
      expect(markup).toContain('value="2999.00"');
      expect(markup).toContain("299,900 paise</strong> on server.");
      expect(markup).toContain("Update Variant");
    });
  });
});
