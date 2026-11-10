/**
 * TeaFloww Private Label Studio — Catalogue Create, Edit & Image Upload Test Suite
 * File: tests/unit/private-label-catalogue-create-edit-images.test.ts
 *
 * Verifies:
 * 1. Admin POST /api/v1/admin/private-label/catalogue (Create packaging variant with image & print methods)
 * 2. Admin PATCH /api/v1/admin/private-label/catalogue/:id (Edit packaging variant with CAS revision guard)
 * 3. Admin POST /api/v1/admin/private-label/catalogue/upload (Media upload via multipart and base64)
 * 4. Admin POST /api/v1/admin/private-label/catalogue/:id/image (Direct image upload to packaging variant)
 * 5. MCP Tool: private_label_upsert_packaging (Create & Update)
 * 6. MCP Tool: private_label_upload_packaging_image (Hero image & Dieline upload via MCP)
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { rmSync } from "node:fs";

const TEST_DB = path.join(tmpdir(), `pl-cat-edit-suite-${process.pid}-${Date.now()}.sqlite`);
process.env.DATABASE_PATH = TEST_DB;
(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.ADMIN_TEST_TOKEN = "secure_test_admin_token_123456789";

import { getDb } from "@/lib/db";
import { PrivateLabelService } from "@/lib/private-label/service";
import { dispatchToolCall } from "@/lib/mcp";
import {
  POST as postCatalogue,
  GET as getCatalogue,
} from "@/app/api/v1/admin/private-label/catalogue/route";
import {
  PATCH as patchCatalogueItem,
  GET as getCatalogueItem,
} from "@/app/api/v1/admin/private-label/catalogue/[id]/route";
import {
  POST as uploadCatalogueMedia,
} from "@/app/api/v1/admin/private-label/catalogue/upload/route";
import {
  POST as uploadVariantImage,
} from "@/app/api/v1/admin/private-label/catalogue/[id]/image/route";

const ADMIN_HEADERS = {
  "Content-Type": "application/json",
  "x-admin-test-token": "secure_test_admin_token_123456789",
};

// 1x1 transparent PNG base64 fixture
const SAMPLE_PNG_BASE64 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

describe("Private Label Catalogue: Create, Edit & Image Upload", () => {
  beforeAll(() => {
    execFileSync(process.execPath, ["scripts/migrate.mjs"], {
      env: { ...process.env, DATABASE_PATH: TEST_DB },
    });

    const db = getDb();
    // Seed families & print methods
    PrivateLabelService.seedInitialCatalog();
  });

  afterAll(() => {
    try {
      rmSync(TEST_DB, { force: true });
    } catch {}
  });

  describe("1. Admin API: Packaging Creation", () => {
    it("creates a new packaging variant with hero_image_url and print compatibility", async () => {
      const payload = {
        family_id: "fam_pouch",
        slug: "artisan-matte-white-pouch-100g",
        sku: "PL-PC-100-WHT",
        title: "Artisan Matte White Pouch 100g",
        material: "Food-Grade Barrier Foil",
        finish: "Soft-Touch Matte",
        closure_type: "Resealable Zip",
        capacity_description: "100g Loose Leaf",
        net_weight_capacity_grams: 100,
        width_mm: 140,
        height_mm: 200,
        depth_mm: 70,
        label_safe_width_mm: 110,
        label_safe_height_mm: 140,
        supplier_name: "EcoBarrier Pack",
        unit_cost_paise: 1650,
        lead_time_days: 14,
        moq_units: 500,
        order_multiple: 50,
        hero_image_url: "/uploads/white-pouch-sample.webp",
        status: "published",
        compatible_print_method_ids: ["pm_paper_label", "pm_direct_digital"],
      };

      const req = new Request("http://localhost/api/v1/admin/private-label/catalogue", {
        method: "POST",
        headers: ADMIN_HEADERS,
        body: JSON.stringify(payload),
      });

      const res = await postCatalogue(req);
      expect(res.status).toBe(201);
      const data = await res.json();

      expect(data.variant).toBeDefined();
      expect(data.variant.sku).toBe("PL-PC-100-WHT");
      expect(data.variant.hero_image_url).toBe("/uploads/white-pouch-sample.webp");
      expect(data.variant.status).toBe("published");
      expect(data.variant.revision).toBe(1);

      // Verify print method compatibility was synchronized
      const db = getDb();
      const compat = db
        .prepare(
          "SELECT print_method_id FROM pl_packaging_compatibility WHERE packaging_variant_id = ? AND is_supported = 1"
        )
        .all(data.variant.id) as { print_method_id: string }[];
      expect(compat.map((c) => c.print_method_id).sort()).toEqual(["pm_direct_digital", "pm_paper_label"].sort());
    });
  });

  describe("2. Admin API: Packaging Edit & CAS Revision Guard", () => {
    it("updates packaging variant fields and increments revision", async () => {
      // Fetch created variant
      const db = getDb();
      const existing = db
        .prepare("SELECT * FROM pl_packaging_variants WHERE sku = ?")
        .get("PL-PC-100-WHT") as { id: string; revision: number };
      expect(existing).toBeDefined();

      const patchReq = new Request(
        `http://localhost/api/v1/admin/private-label/catalogue/${existing.id}`,
        {
          method: "PATCH",
          headers: ADMIN_HEADERS,
          body: JSON.stringify({
            expected_revision: existing.revision,
            title: "Artisan Matte White Pouch 100g (Updated)",
            unit_cost_paise: 1750,
            hero_image_url: "/uploads/white-pouch-updated.webp",
          }),
        }
      );

      const patchRes = await patchCatalogueItem(patchReq, {
        params: Promise.resolve({ id: existing.id }),
      });
      expect(patchRes.status).toBe(200);
      const patchData = await patchRes.json();
      expect(patchData.variant.title).toBe("Artisan Matte White Pouch 100g (Updated)");
      expect(patchData.variant.unit_cost_paise).toBe(1750);
      expect(patchData.variant.hero_image_url).toBe("/uploads/white-pouch-updated.webp");
      expect(patchData.variant.revision).toBe(existing.revision + 1);
    });

    it("rejects edit when expected_revision is stale (409 Conflict)", async () => {
      const db = getDb();
      const existing = db
        .prepare("SELECT * FROM pl_packaging_variants WHERE sku = ?")
        .get("PL-PC-100-WHT") as { id: string; revision: number };

      const staleReq = new Request(
        `http://localhost/api/v1/admin/private-label/catalogue/${existing.id}`,
        {
          method: "PATCH",
          headers: ADMIN_HEADERS,
          body: JSON.stringify({
            expected_revision: 999, // Stale!
            title: "Will Fail",
          }),
        }
      );

      const res = await patchCatalogueItem(staleReq, {
        params: Promise.resolve({ id: existing.id }),
      });
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.current_revision).toBe(existing.revision);
    });
  });

  describe("3. Admin API: Image Upload Endpoints", () => {
    it("POST /catalogue/upload uploads image from base64 and attaches to packaging", async () => {
      const db = getDb();
      const variant = db
        .prepare("SELECT * FROM pl_packaging_variants WHERE sku = ?")
        .get("PL-PC-100-WHT") as { id: string };

      const uploadReq = new Request(
        "http://localhost/api/v1/admin/private-label/catalogue/upload",
        {
          method: "POST",
          headers: ADMIN_HEADERS,
          body: JSON.stringify({
            packaging_id: variant.id,
            filename: "hero-pouch.png",
            base64_data: SAMPLE_PNG_BASE64,
            type: "hero",
          }),
        }
      );

      const res = await uploadCatalogueMedia(uploadReq);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.url).toMatch(/^\/uploads\//);
      expect(data.variant).toBeDefined();
      expect(data.variant.hero_image_url).toBe(data.url);
    });

    it("POST /catalogue/:id/image directly uploads and updates variant image", async () => {
      const db = getDb();
      const variant = db
        .prepare("SELECT * FROM pl_packaging_variants WHERE sku = ?")
        .get("PL-PC-100-WHT") as { id: string };

      const req = new Request(
        `http://localhost/api/v1/admin/private-label/catalogue/${variant.id}/image`,
        {
          method: "POST",
          headers: ADMIN_HEADERS,
          body: JSON.stringify({
            filename: "direct-hero.png",
            base64_data: SAMPLE_PNG_BASE64,
            image_type: "hero",
          }),
        }
      );

      const res = await uploadVariantImage(req, {
        params: Promise.resolve({ id: variant.id }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.url).toMatch(/^\/uploads\//);
      expect(data.variant.hero_image_url).toBe(data.url);
    });
  });

  describe("4. MCP Tools: Packaging Upsert & Image Upload", () => {
    it("creates packaging variant via private_label_upsert_packaging", () => {
      const result = dispatchToolCall("private_label_upsert_packaging", {
        family_id: "fam_tin",
        name: "Vintage Brass Tin Caddy 150g",
        capacity_description: "150g",
        net_weight_capacity_grams: 150,
        material: "Food-Grade Brass Plated Tin",
        unit_cost_paise: 3500,
        moq_units: 250,
        status: "draft",
        image_url: "/uploads/brass-caddy.png",
      }) as { id: string; title: string; hero_image_url: string; status: string };

      expect(result).toBeDefined();
      expect(result.title).toBe("Vintage Brass Tin Caddy 150g");
      expect(result.hero_image_url).toBe("/uploads/brass-caddy.png");
      expect(result.status).toBe("draft");
    });

    it("uploads packaging image via private_label_upload_packaging_image MCP tool", async () => {
      const db = getDb();
      const variant = db
        .prepare("SELECT * FROM pl_packaging_variants WHERE sku = ?")
        .get("PL-PC-100-WHT") as { id: string };

      const result = (await dispatchToolCall("private_label_upload_packaging_image", {
        id: variant.id,
        filename: "mcp-render.png",
        base64_data: SAMPLE_PNG_BASE64,
        image_type: "hero",
      })) as { success: boolean; url: string; variant: { hero_image_url: string } };

      expect(result.success).toBe(true);
      expect(result.url).toMatch(/^\/uploads\//);
      expect(result.variant.hero_image_url).toBe(result.url);
    });
  });
});
