/**
 * TeaFloww Private Label Studio — Milestone M3 Storefront Unit & Integration Test Suite
 * File: tests/unit/private-label-storefront.test.ts
 *
 * Verifies:
 * 1. Whitelist DTO Projections & Zero Sensitive Data Leakage
 * 2. Draft & Archived SKU Quarantine (404 Anti-Enumeration)
 * 3. Multi-Parameter Catalogue Filtering (Category, Capacity, Material, Search, Pagination)
 * 4. Packaging Detail (PDP) Enriched Specs, Barrier Properties & Starting Price
 * 5. Zod Input Validation & Parameter Clamping (400 Bad Request)
 * 6. Deterministic Barrier Properties Domain Synthesis
 * 7. Navigation & Dynamic Sitemap Registry Integration
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { rmSync } from "node:fs";

const TEST_DB = path.join(
  tmpdir(),
  `pl-storefront-suite-${process.pid}-${Date.now()}.sqlite`
);
process.env.DATABASE_PATH = TEST_DB;
(process.env as Record<string, string | undefined>).NODE_ENV = "test";

import { getDb } from "@/lib/db";
import { PrivateLabelService } from "@/lib/private-label/service";
import { PrivateLabelNotFoundError } from "@/lib/private-label/types";
import { deriveBarrierProperties } from "@/lib/private-label/public-dto";
import { GET as getCatalogue } from "@/app/api/v1/private-label/catalogue/route";
import { GET as getPackagingDetail } from "@/app/api/v1/private-label/packaging/[slug]/route";
import { DEFAULT_NAV } from "@/components/StorefrontHeader";
import { getSiteNavigation } from "@/lib/contentBlocks";
import { getCatalogSitemapEntries } from "@/lib/seo/sitemap";

describe("Milestone M3: Private Label Storefront, Catalogue & SEO Suite", () => {
  beforeAll(() => {
    // 1. Run migrations on isolated test database
    execFileSync(process.execPath, ["scripts/migrate.mjs"], {
      env: { ...process.env, DATABASE_PATH: TEST_DB },
    });

    const db = getDb();
    PrivateLabelService.seedInitialCatalog();

    // 2. Seed published packaging variants across diverse families
    const seedPackaging = [
      {
        id: "pack_pouch_mbk_250g",
        family_id: "fam_pouch",
        slug: "stand-up-pouch-matte-black-250g",
        sku: "PL-PC-250-MBK",
        title: "Stand-Up Pouch Matte Black 250g",
        material: "Kraft / Foil Barrier",
        finish: "Soft-Touch Matte",
        closure_type: "Resealable Grip Zipper",
        capacity_desc: "250g Retail",
        net_grams: 250,
        w: 160,
        h: 230,
        d: 90,
        sw: 120,
        sh: 150,
        supplier: "Confidential Packaging Corp",
        sup_sku: "SUP-KRF-250",
        cost: 1200,
        lead: 14,
        moq: 500,
        mult: 50,
        dieline: "https://teafloww.com/dielines/standup-pouch-250g.pdf",
        status: "published",
      },
      {
        id: "pack_tin_caddy_100g",
        family_id: "fam_tin",
        slug: "metal-tin-caddy-100g",
        sku: "PL-TN-100-SLV",
        title: "Artisanal Metal Tin Caddy 100g",
        material: "Food-Grade Tinplate",
        finish: "Brushed Metallic",
        closure_type: "Inner Slip Lid",
        capacity_desc: "100g Standard",
        net_grams: 100,
        w: 85,
        h: 120,
        d: 85,
        sw: 260,
        sh: 100,
        supplier: "Secret Tin Mills Ltd",
        sup_sku: "SUP-TIN-100",
        cost: 2800,
        lead: 18,
        moq: 250,
        mult: 25,
        dieline: null,
        status: "published",
      },
      {
        id: "pack_jar_amber_150g",
        family_id: "fam_jar",
        slug: "amber-glass-jar-150g",
        sku: "PL-JR-150-AMB",
        title: "Amber Apothecary Glass Jar 150g",
        material: "Borosilicate Amber Glass",
        finish: "UV-Protective Amber",
        closure_type: "Airtight Silicone Gasket",
        capacity_desc: "150g Reserve",
        net_grams: 150,
        w: 75,
        h: 110,
        d: 75,
        sw: 220,
        sh: 70,
        supplier: "Hidden Glassworks",
        sup_sku: "SUP-JAR-150",
        cost: 3500,
        lead: 14,
        moq: 250,
        mult: 25,
        dieline: null,
        status: "published",
      },
      {
        id: "pack_bag_bulk_kraft_1kg",
        family_id: "fam_bag",
        slug: "bulk-kraft-barrier-bag-1kg",
        sku: "PL-BG-1KG-KRF",
        title: "Master Bulk Foodservice Kraft Bag 1kg",
        material: "Heavy 4-Ply Barrier Kraft",
        finish: "Natural Uncoated Kraft",
        closure_type: "Tin-Tie & Heat Seal Strip",
        capacity_desc: "1kg Commercial Bulk",
        net_grams: 1000,
        w: 220,
        h: 380,
        d: 120,
        sw: 180,
        sh: 260,
        supplier: "Secret Bag Co",
        sup_sku: "SUP-BAG-1000",
        cost: 2400,
        lead: 10,
        moq: 100,
        mult: 10,
        dieline: null,
        status: "published",
      },
      // 3. Draft SKU that must NOT leak to public storefront
      {
        id: "pack_draft_pouch_001",
        family_id: "fam_pouch",
        slug: "draft-pouch-variant-001",
        sku: "PL-PC-DRAFT-001",
        title: "Confidential R&D Pouch Prototype",
        material: "Experimental Biodegradable Film",
        finish: "Matte",
        closure_type: "Grip Zipper",
        capacity_desc: "100g Prototype",
        net_grams: 100,
        w: 120,
        h: 180,
        d: 60,
        sw: 100,
        sh: 120,
        supplier: "Leaky Supplier Inc",
        sup_sku: "SUP-DRAFT-999",
        cost: 999,
        lead: 30,
        moq: 500,
        mult: 50,
        dieline: null,
        status: "draft",
      },
      // 4. Archived SKU that must NOT appear in public catalogue
      {
        id: "pack_archived_tin_002",
        family_id: "fam_tin",
        slug: "archived-tin-old-002",
        sku: "PL-TN-ARCHIVED-002",
        title: "Discontinued Tin Caddy 2024",
        material: "Standard Tinplate",
        finish: "Gloss",
        closure_type: "Plug Lid",
        capacity_desc: "50g Discontinued",
        net_grams: 50,
        w: 60,
        h: 80,
        d: 60,
        sw: 160,
        sh: 60,
        supplier: "Retired Supplier Ltd",
        sup_sku: "SUP-OLD-50",
        cost: 888,
        lead: 20,
        moq: 100,
        mult: 10,
        dieline: null,
        status: "archived",
      },
    ];

    const insertPack = db.prepare(`
      INSERT OR REPLACE INTO pl_packaging_variants (
        id, family_id, slug, sku, title, material, finish, closure_type,
        capacity_description, net_weight_capacity_grams, width_mm, height_mm, depth_mm,
        label_safe_width_mm, label_safe_height_mm, supplier_name, supplier_sku,
        unit_cost_paise, lead_time_days, moq_units, order_multiple, dieline_url,
        hero_image_url, image_illustrative, status, revision
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        null, 1, ?, 1
      )
    `);

    for (const p of seedPackaging) {
      insertPack.run(
        p.id,
        p.family_id,
        p.slug,
        p.sku,
        p.title,
        p.material,
        p.finish,
        p.closure_type,
        p.capacity_desc,
        p.net_grams,
        p.w,
        p.h,
        p.d,
        p.sw,
        p.sh,
        p.supplier,
        p.sup_sku,
        p.cost,
        p.lead,
        p.moq,
        p.mult,
        p.dieline,
        p.status
      );
    }

    // 5. Seed packaging compatibility with print methods
    const insertCompat = db.prepare(`
      INSERT OR REPLACE INTO pl_packaging_compatibility (
        id, packaging_variant_id, print_method_id, is_supported
      ) VALUES (?, ?, ?, 1)
    `);

    insertCompat.run("cmp_1", "pack_pouch_mbk_250g", "pm_direct_digital");
    insertCompat.run("cmp_2", "pack_pouch_mbk_250g", "pm_paper_label");
    insertCompat.run("cmp_3", "pack_pouch_mbk_250g", "pm_bopp_label");
    insertCompat.run("cmp_4", "pack_tin_caddy_100g", "pm_screen_print");
    insertCompat.run("cmp_5", "pack_tin_caddy_100g", "pm_paper_label");

    // 6. Seed price book tiers for starting price calculations
    const insertTier = db.prepare(`
      INSERT OR REPLACE INTO pl_price_book_tiers (
        id, price_book_id, item_type, item_id, min_qty, max_qty, unit_price_paise
      ) VALUES (?, 'pb_default_inr', 'packaging', ?, ?, ?, ?)
    `);

    insertTier.run("tier_pouch_500", "pack_pouch_mbk_250g", 500, 999, 1850);
    insertTier.run("tier_pouch_1000", "pack_pouch_mbk_250g", 1000, 4999, 1600);
    insertTier.run("tier_tin_250", "pack_tin_caddy_100g", 250, 499, 4200);
  });

  afterAll(() => {
    try {
      rmSync(TEST_DB, { force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  // ==========================================================================
  // 1. Whitelist DTO Projections & Zero Sensitive Data Leakage
  // ==========================================================================
  describe("Security: Whitelist DTO Projections & Zero Data Leakage", () => {
    it("T3.1: /api/v1/private-label/catalogue strictly redacts all internal supplier details and COGS", async () => {
      const req = new Request("http://localhost:3000/api/v1/private-label/catalogue");
      const res = await getCatalogue(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.items).toBeDefined();
      expect(Array.isArray(json.items)).toBe(true);
      expect(json.items.length).toBeGreaterThanOrEqual(4);

      // Verify canonical M3 fields on item
      const item = json.items.find((i: any) => i.slug === "stand-up-pouch-matte-black-250g");
      expect(item).toBeDefined();
      expect(item.name).toBe("Stand-Up Pouch Matte Black 250g");
      expect(item.category).toBe("pouch");
      expect(item.net_capacity_grams).toBe(250);
      expect(item.status).toBe("published");
      expect(item.dimensions_mm).toEqual({ width: 160, height: 230, depth: 90 });
      expect(item.label_safe_area_mm).toEqual({ width: 120, height: 150 });
      expect(Array.isArray(item.barrier_properties)).toBe(true);
      expect(Array.isArray(item.supported_print_methods)).toBe(true);

      // Verify backward-compatible aliases
      expect(item.title).toBe("Stand-Up Pouch Matte Black 250g");
      expect(item.sku).toBe("PL-PC-250-MBK");
      expect(item.family).toBe("pouch");
      expect(item.moq_units).toBe(500);
      expect(item.order_multiple).toBe(50);

      // Verify starting price exists without revealing supplier unit cost
      expect(item.starting_price).toBeDefined();
      expect(item.starting_price.currency).toBe("INR");
      expect(item.starting_price.unit_price_paise).toBe(1850);
      expect(item.starting_price.formatted_unit_price).toBe("₹18.50");

      // STRICT ZERO-LEAKAGE ASSERTION: Stringify entire payload
      const rawText = JSON.stringify(json);
      expect(rawText).not.toContain("Confidential Packaging Corp");
      expect(rawText).not.toContain("Secret Tin Mills");
      expect(rawText).not.toContain("Hidden Glassworks");
      expect(rawText).not.toContain("supplier_name");
      expect(rawText).not.toContain("supplier_sku");
      expect(rawText).not.toContain("SUP-KRF-250");
      expect(rawText).not.toContain("unit_cost_paise");
      expect(rawText).not.toContain("cogs");
      expect(rawText).not.toContain("margin_rate");
      expect(rawText).not.toContain("margin_pct");
      expect(rawText).not.toContain("internal_cogs");
      expect(rawText).not.toContain("private_notes");
    });

    it("T3.2: malicious query parameters attempting field expansion are wholly ignored", async () => {
      const maliciousUrl =
        "http://localhost:3000/api/v1/private-label/catalogue?fields=cogs,margin_rate,supplier_name,unit_cost_paise";
      const req = new Request(maliciousUrl);
      const res = await getCatalogue(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      const rawText = JSON.stringify(json);
      expect(rawText).not.toContain("Confidential Packaging Corp");
      expect(rawText).not.toContain("supplier_name");
      expect(rawText).not.toContain("unit_cost_paise");
    });

    it("T3.3: PDP route /packaging/[slug] returns zero internal supplier costs or notes", async () => {
      const req = new Request(
        "http://localhost:3000/api/v1/private-label/packaging/stand-up-pouch-matte-black-250g"
      );
      const res = await getPackagingDetail(req, {
        params: Promise.resolve({ slug: "stand-up-pouch-matte-black-250g" }),
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.slug).toBe("stand-up-pouch-matte-black-250g");

      const rawText = JSON.stringify(json);
      expect(rawText).not.toContain("Confidential Packaging Corp");
      expect(rawText).not.toContain("supplier_name");
      expect(rawText).not.toContain("unit_cost_paise");
      expect(rawText).not.toContain("SUP-KRF-250");
    });
  });

  // ==========================================================================
  // 2. Draft & Archived SKU Quarantine (404 Anti-Enumeration)
  // ==========================================================================
  describe("Anti-Enumeration: Draft & Archived SKU Isolation", () => {
    it("T3.4: draft packaging variants never appear in public catalogue listing", async () => {
      const req = new Request("http://localhost:3000/api/v1/private-label/catalogue");
      const res = await getCatalogue(req);
      const json = await res.json();

      const slugs = json.items.map((i: any) => i.slug);
      expect(slugs).not.toContain("draft-pouch-variant-001");
      expect(slugs).not.toContain("archived-tin-old-002");
    });

    it("T3.5: requesting a draft packaging slug returns HTTP 404 Not Found", async () => {
      const req = new Request(
        "http://localhost:3000/api/v1/private-label/packaging/draft-pouch-variant-001"
      );
      const res = await getPackagingDetail(req, {
        params: Promise.resolve({ slug: "draft-pouch-variant-001" }),
      });
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toMatch(/not found/i);
    });

    it("T3.6: requesting an archived packaging slug returns HTTP 404 Not Found", async () => {
      const req = new Request(
        "http://localhost:3000/api/v1/private-label/packaging/archived-tin-old-002"
      );
      const res = await getPackagingDetail(req, {
        params: Promise.resolve({ slug: "archived-tin-old-002" }),
      });
      expect(res.status).toBe(404);
    });

    it("T3.7: requesting a non-existent packaging slug returns identical HTTP 404 Not Found", async () => {
      const req = new Request(
        "http://localhost:3000/api/v1/private-label/packaging/completely-random-slug-999"
      );
      const res = await getPackagingDetail(req, {
        params: Promise.resolve({ slug: "completely-random-slug-999" }),
      });
      expect(res.status).toBe(404);
    });

    it("T3.8: direct service call throws PrivateLabelNotFoundError for draft records", () => {
      expect(() => {
        PrivateLabelService.getPublicPackagingVariantBySlug("draft-pouch-variant-001");
      }).toThrowError(PrivateLabelNotFoundError);
    });
  });

  // ==========================================================================
  // 3. Multi-Parameter Catalogue Filtering
  // ==========================================================================
  describe("Catalogue Filtering: Category, Capacity, Material, Search & Pagination", () => {
    it("T3.9: category filter restricts results to requested packaging family", async () => {
      const req = new Request("http://localhost:3000/api/v1/private-label/catalogue?category=pouch");
      const res = await getCatalogue(req);
      const json = await res.json();

      expect(json.items.length).toBeGreaterThan(0);
      for (const item of json.items) {
        expect(item.category).toBe("pouch");
      }
    });

    it("T3.10: category filter for tin returns tin caddy", async () => {
      const req = new Request("http://localhost:3000/api/v1/private-label/catalogue?category=tin");
      const res = await getCatalogue(req);
      const json = await res.json();

      expect(json.items.length).toBe(1);
      expect(json.items[0].slug).toBe("metal-tin-caddy-100g");
    });

    it("T3.11: capacity range filter (capacity_min and capacity_max) filters correctly", async () => {
      const req = new Request(
        "http://localhost:3000/api/v1/private-label/catalogue?capacity_min=200&capacity_max=500"
      );
      const res = await getCatalogue(req);
      const json = await res.json();

      expect(json.items.length).toBe(1);
      expect(json.items[0].net_capacity_grams).toBe(250);
    });

    it("T3.12: material filter performs case-insensitive substring matching", async () => {
      const req = new Request(
        "http://localhost:3000/api/v1/private-label/catalogue?material=tinplate"
      );
      const res = await getCatalogue(req);
      const json = await res.json();

      expect(json.items.length).toBe(1);
      expect(json.items[0].material).toContain("Tinplate");
    });

    it("T3.13: keyword search matches title or description", async () => {
      const req = new Request("http://localhost:3000/api/v1/private-label/catalogue?search=amber");
      const res = await getCatalogue(req);
      const json = await res.json();

      expect(json.items.length).toBe(1);
      expect(json.items[0].slug).toBe("amber-glass-jar-150g");
    });

    it("T3.14: type=print_methods returns public print methods catalog", async () => {
      const req = new Request(
        "http://localhost:3000/api/v1/private-label/catalogue?type=print_methods"
      );
      const res = await getCatalogue(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.print_methods).toBeDefined();
      expect(json.print_methods.length).toBeGreaterThanOrEqual(5);

      const digital = json.print_methods.find((m: any) => m.code === "direct_digital");
      expect(digital).toBeDefined();
      expect(digital.name).toBe("Direct Digital Print");
      expect(digital.color_model).toBe("cmyk");
    });

    it("T3.15: pagination limit and offset paginate results accurately", async () => {
      const req = new Request(
        "http://localhost:3000/api/v1/private-label/catalogue?limit=2&offset=1"
      );
      const res = await getCatalogue(req);
      const json = await res.json();

      expect(json.items.length).toBeLessThanOrEqual(2);
      expect(json.limit).toBe(2);
      expect(json.offset).toBe(1);
      expect(typeof json.has_more).toBe("boolean");
    });
  });

  // ==========================================================================
  // 4. Packaging Detail (PDP) Enriched Specs & Starting Price
  // ==========================================================================
  describe("PDP Specifications: Enriched Specs, Compatibility & Starting Price", () => {
    it("T3.16: PDP returns compatible print methods with public metadata", async () => {
      const req = new Request(
        "http://localhost:3000/api/v1/private-label/packaging/stand-up-pouch-matte-black-250g"
      );
      const res = await getPackagingDetail(req, {
        params: Promise.resolve({ slug: "stand-up-pouch-matte-black-250g" }),
      });
      const json = await res.json();

      expect(json.compatible_print_methods).toBeDefined();
      expect(Array.isArray(json.compatible_print_methods)).toBe(true);
      expect(json.compatible_print_methods.length).toBe(3);

      const codes = json.compatible_print_methods.map((m: any) => m.code);
      expect(codes).toContain("direct_digital");
      expect(codes).toContain("paper_label");
      expect(codes).toContain("bopp_label");
    });

    it("T3.17: PDP calculates starting price from active price book tiers", async () => {
      const req = new Request(
        "http://localhost:3000/api/v1/private-label/packaging/stand-up-pouch-matte-black-250g"
      );
      const res = await getPackagingDetail(req, {
        params: Promise.resolve({ slug: "stand-up-pouch-matte-black-250g" }),
      });
      const json = await res.json();

      expect(json.starting_price).toBeDefined();
      expect(json.starting_price.currency).toBe("INR");
      expect(json.starting_price.unit_price_paise).toBe(1850);
      expect(json.starting_price.formatted_unit_price).toBe("₹18.50");
      expect(json.starting_price.min_quantity).toBe(500);
    });

    it("T3.18: PDP starting price falls back to margin formula when no tier row is configured", async () => {
      // amber glass jar has no tier seeded in price book, but has unit_cost_paise = 3500 and price book margin_rate = 0.25
      // 3500 / (1 - 0.25) = 4667 paise (₹46.67)
      const req = new Request(
        "http://localhost:3000/api/v1/private-label/packaging/amber-glass-jar-150g"
      );
      const res = await getPackagingDetail(req, {
        params: Promise.resolve({ slug: "amber-glass-jar-150g" }),
      });
      const json = await res.json();

      expect(json.starting_price).toBeDefined();
      expect(json.starting_price.unit_price_paise).toBe(4667);
      expect(json.starting_price.formatted_unit_price).toBe("₹46.67");
      expect(json.starting_price.min_quantity).toBe(250);
    });
  });

  // ==========================================================================
  // 5. Zod Input Validation & Parameter Clamping
  // ==========================================================================
  describe("Validation & Clamping: Zod Enforcement", () => {
    it("T3.19: invalid category query returns HTTP 400 Bad Request", async () => {
      const req = new Request(
        "http://localhost:3000/api/v1/private-label/catalogue?category=unsupported_category"
      );
      const res = await getCatalogue(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toMatch(/invalid/i);
    });

    it("T3.20: negative capacity returns HTTP 400 Bad Request", async () => {
      const req = new Request(
        "http://localhost:3000/api/v1/private-label/catalogue?capacity_min=-20"
      );
      const res = await getCatalogue(req);
      expect(res.status).toBe(400);
    });

    it("T3.21: excessive limit query is clamped cleanly to maximum 100", async () => {
      const req = new Request(
        "http://localhost:3000/api/v1/private-label/catalogue?limit=1000"
      );
      const res = await getCatalogue(req);
      // safeParse defaults limit max to 100
      expect(res.status).toBe(400); // Exceeds z.max(100)
    });

    it("T3.22: empty slug to packaging PDP route returns HTTP 400", async () => {
      const req = new Request("http://localhost:3000/api/v1/private-label/packaging/");
      const res = await getPackagingDetail(req, {
        params: Promise.resolve({ slug: "  " }),
      });
      expect(res.status).toBe(400);
    });
  });

  // ==========================================================================
  // 6. Deterministic Barrier Properties Domain Synthesis
  // ==========================================================================
  describe("Domain Logic: Barrier Properties Synthesis", () => {
    it("T3.23: foil and aluminum substrates produce high-barrier EVOH & UV traits", () => {
      const traits = deriveBarrierProperties("Kraft / Foil Barrier", "Matte", "pouch");
      expect(traits.some((t) => t.includes("aluminum") || t.includes("EVOH"))).toBe(true);
      expect(traits.some((t) => t.includes("UV"))).toBe(true);
    });

    it("T3.24: tinplate containers produce airtight light block traits", () => {
      const traits = deriveBarrierProperties("Tinplate", "Metallic", "tin");
      expect(traits.some((t) => t.includes("tinplate"))).toBe(true);
      expect(traits.some((t) => t.includes("terpene"))).toBe(true);
    });

    it("T3.25: glass containers produce impermeable hermetic traits", () => {
      const traits = deriveBarrierProperties("Borosilicate Glass", "Amber", "jar");
      expect(traits.some((t) => t.includes("gasket"))).toBe(true);
      expect(traits.some((t) => t.includes("glass"))).toBe(true);
    });
  });

  // ==========================================================================
  // 7. Navigation & Sitemap Registry Integration
  // ==========================================================================
  describe("Storefront Navigation & Dynamic Sitemap Registry", () => {
    it("T3.26: DEFAULT_NAV in StorefrontHeader includes Private Label", () => {
      const plLink = DEFAULT_NAV.find((item) => item.href === "/private-label");
      expect(plLink).toBeDefined();
      expect(plLink?.label).toBe("Private Label");
    });

    it("T3.27: defaultNav and defaultFooterLinks in contentBlocks include Private Label", () => {
      const nav = getSiteNavigation();
      const headerPl = nav.header_links.find((item) => item.href === "/private-label");
      expect(headerPl).toBeDefined();

      const footerPl = nav.footer_links.find((item) => item.href === "/private-label");
      expect(footerPl).toBeDefined();
    });

    it("T3.28: sitemap entries include /private-label, /private-label/packaging, and published variants", () => {
      const entries = getCatalogSitemapEntries();
      const urls = entries.map((e) => e.url);

      expect(urls.some((u) => u.endsWith("/private-label"))).toBe(true);
      expect(urls.some((u) => u.endsWith("/private-label/packaging"))).toBe(true);
      expect(
        urls.some((u) => u.endsWith("/private-label/packaging/stand-up-pouch-matte-black-250g"))
      ).toBe(true);
      expect(
        urls.some((u) => u.endsWith("/private-label/packaging/metal-tin-caddy-100g"))
      ).toBe(true);

      // Verify draft and archived variants are NOT present in sitemap
      expect(
        urls.some((u) => u.endsWith("/private-label/packaging/draft-pouch-variant-001"))
      ).toBe(false);
      expect(
        urls.some((u) => u.endsWith("/private-label/packaging/archived-tin-old-002"))
      ).toBe(false);
    });
  });
});
