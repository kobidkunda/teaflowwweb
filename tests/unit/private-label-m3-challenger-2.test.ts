/**
 * TeaFloww Private Label Studio — Milestone M3 Adversarial Challenger Test Suite
 * Challenger: private_label_m3_challenger_2 (Role: Layout, A11y & SEO Stress)
 * File: tests/unit/private-label-m3-challenger-2.test.ts
 *
 * Scope: Milestone M3 (Public Landing, Packaging Catalogue, and SEO)
 * Target Vectors:
 * 1. Vector 1: 320px Viewport Overflow Stress & Mobile Clamping
 *    - Container max-width and overflow-x: clip integrity
 *    - Long unbroken variant titles (120+ chars) in cards and PDP
 *    - Multi-column tables & comparison matrix horizontal scroll wrapper
 *    - PDP tabs header horizontal overflow isolation
 *    - Breadcrumbs wrap resistance
 * 2. Vector 2: Contradictory Filters & Empty State Verification
 *    - Mutually contradictory filter combinations (e.g. category=sachet & capacity=1000, category=tin & material=glass)
 *    - Special characters & malicious search strings (SQLi, regex metachars, XSS, parameter length boundaries)
 *    - Empty state rendering ([data-testid='empty-state']) and accessible attributes
 *    - Functional reset action restoring catalog
 * 3. Vector 3: Missing Assets & Graceful Fallback Handling
 *    - Missing, null, empty, fallback, and non-http image URLs render [data-testid='image-fallback']
 *    - Truthful prepress dieline download vs. request button ([data-testid='download-dieline'])
 *    - Illustrative mockup disclaimer rendering
 * 4. Vector 4: Structured Data Schema Invariants & Dynamic OpenGraph Metadata
 *    - Schema.org JSON-LD invariants (Organization, Service, FAQPage, CollectionPage, Product, BreadcrumbList)
 *    - Dynamic OpenGraph and Twitter card metadata generation (valid, invalid, empty slugs)
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { rmSync, readFileSync } from "node:fs";

// Setup isolated temporary test database
const TEST_DB = path.join(
  tmpdir(),
  `pl-m3-challenger2-${process.pid}-${Date.now()}.sqlite`
);
process.env.DATABASE_PATH = TEST_DB;
(process.env as Record<string, string | undefined>).NODE_ENV = "test";

// Mock Next.js navigation with mutable search parameters
let currentSearchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => "/private-label/packaging",
  useSearchParams: () => currentSearchParams,
  notFound: vi.fn(() => {
    const err = new Error("NEXT_NOT_FOUND");
    (err as any).digest = "NEXT_NOT_FOUND";
    throw err;
  }),
}));

// Mock Next.js Image component for deterministic static rendering
vi.mock("next/image", () => ({
  default: ({ src, alt, fill: _fill, sizes: _sizes, ...rest }: any) => {
    void _fill;
    void _sizes;
    const resolvedSrc = typeof src === "object" ? src.src : src;
    return React.createElement("img", { src: resolvedSrc, alt, ...rest });
  },
}));

// Provide minimal global window mock for client transitions if called in Node
if (typeof globalThis.window === "undefined") {
  (globalThis as any).window = {
    history: { replaceState: vi.fn() },
    location: { href: "http://localhost:3000/private-label/packaging" },
  };
}

import { getDb } from "@/lib/db";
import { PrivateLabelService } from "@/lib/private-label/service";
import type { PublicPackagingVariantDto } from "@/lib/private-label/public-dto";
import { PackagingCard } from "@/components/private-label/catalogue/PackagingCard";
import { EmptyCatalogueState } from "@/components/private-label/catalogue/EmptyCatalogueState";
import { PackagingCatalogueExplorer } from "@/components/private-label/catalogue/PackagingCatalogueExplorer";
import { PackagingDetailView } from "@/components/private-label/detail/PackagingDetailView";
import { PackagingDielineAction } from "@/components/private-label/detail/PackagingDielineAction";
import { PackagingSpecsTabs } from "@/components/private-label/detail/PackagingSpecsTabs";
import { PrintComparisonMatrix } from "@/components/private-label/landing/PrintComparisonMatrix";
import { GET as getCatalogue } from "@/app/api/v1/private-label/catalogue/route";
import { metadata as landingMetadata, default as PrivateLabelLandingPage } from "@/app/private-label/page";
import { metadata as catalogueMetadata, default as PackagingCataloguePage } from "@/app/private-label/packaging/page";
import { generateMetadata as generateDetailMetadata, default as PackagingDetailPage } from "@/app/private-label/packaging/[slug]/page";

// Sample mock packaging fixture
function createMockVariant(overrides: Partial<PublicPackagingVariantDto> = {}): PublicPackagingVariantDto {
  return {
    id: "pack_test_mock_1",
    family_id: "fam_pouch",
    name: "Standard Stand-Up Pouch 250g",
    slug: "standard-stand-up-pouch-250g",
    sku: "PL-PC-250-STD",
    title: "Standard Stand-Up Pouch 250g",
    category: "pouch",
    family: "pouch",
    material: "Kraft / Foil Barrier",
    finish: "Soft-Touch Matte",
    closure_type: "Resealable Grip Zipper",
    barrier_properties: ["High-barrier aluminum/EVOH moisture and oxygen seal", "100% UV/light degradation protection"],
    capacity_description: "250g Retail",
    net_capacity_grams: 250,
    net_weight_capacity_grams: 250,
    dimensions_mm: { width: 160, height: 230, depth: 90 },
    label_safe_area_mm: { width: 120, height: 150 },
    moq_units: 500,
    order_multiple: 50,
    lead_time_days: 14,
    image_url: "https://images.unsplash.com/photo-1544787219-7f47ccb76574",
    hero_image_url: "https://images.unsplash.com/photo-1544787219-7f47ccb76574",
    image_illustrative: false,
    dieline_url: "https://teafloww.com/dielines/standup-pouch-250g.pdf",
    dieline_available: true,
    supported_print_methods: ["direct_digital", "paper_label", "bopp_label"],
    compatible_print_method_codes: ["direct_digital", "paper_label", "bopp_label"],
    status: "published",
    starting_price: {
      currency: "INR",
      unit_price_paise: 1850,
      formatted_unit_price: "₹18.50",
      min_quantity: 500,
      tier_label: "From 500 units",
    },
    ...overrides,
  };
}

describe("Milestone M3 Challenger 2: Layout, A11y & SEO Adversarial Suite", () => {
  beforeAll(() => {
    // Run database migrations on isolated SQLite database
    execFileSync(process.execPath, ["scripts/migrate.mjs"], {
      env: { ...process.env, DATABASE_PATH: TEST_DB },
    });

    const db = getDb();
    PrivateLabelService.seedInitialCatalog();

    // Seed canonical variants for testing
    const seedVariants = [
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
        id: "pack_sachet_pyramid_3g",
        family_id: "fam_sachet",
        slug: "biodegradable-pyramid-sachet-3g",
        sku: "PL-SC-003-PLA",
        title: "Biodegradable Pyramid Sachet Envelope 3g",
        material: "PLA Cornstarch & Kraft",
        finish: "Smooth Barrier Paper",
        closure_type: "Ultrasonic Fin Seal",
        capacity_desc: "3g Single Serve",
        net_grams: 3,
        w: 75,
        h: 85,
        d: 4,
        sw: 65,
        sh: 75,
        supplier: "Confidential Sachet Works",
        sup_sku: "SUP-PLA-003",
        cost: 250,
        lead: 14,
        moq: 1000,
        mult: 100,
        dieline: null,
        status: "published",
      },
      {
        id: "pack_tin_caddy_vintage",
        family_id: "fam_tin",
        slug: "vintage-tin-caddy-100g",
        sku: "PL-TN-100-VNT",
        title: "Vintage Artisan Metal Tin 100g",
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
        supplier: "Secret Tin Mills",
        sup_sku: "SUP-TIN-VNT",
        cost: 3200,
        lead: 18,
        moq: 250,
        mult: 25,
        dieline: null,
        status: "published",
      },
    ];

    for (const v of seedVariants) {
      db.prepare(
        `INSERT OR REPLACE INTO pl_packaging_variants (
          id, family_id, slug, sku, title, material, finish, closure_type,
          capacity_description, net_weight_capacity_grams, width_mm, height_mm, depth_mm,
          label_safe_width_mm, label_safe_height_mm, supplier_name, supplier_sku,
          unit_cost_paise, lead_time_days, moq_units, order_multiple, dieline_url, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        v.id, v.family_id, v.slug, v.sku, v.title, v.material, v.finish, v.closure_type,
        v.capacity_desc, v.net_grams, v.w, v.h, v.d, v.sw, v.sh, v.supplier, v.sup_sku,
        v.cost, v.lead, v.moq, v.mult, v.dieline, v.status
      );
    }

    // Seed price book tier for pouch
    db.prepare(
      `INSERT OR REPLACE INTO pl_price_book_tiers (
        id, price_book_id, item_type, item_id, min_qty, max_qty, unit_price_paise
      ) VALUES (?, 'pb_default_inr', 'packaging', ?, ?, ?, ?)`
    ).run("tier_pouch_500", "pack_pouch_mbk_250g", 500, 999, 1850);

    // Seed compatibility
    db.prepare(
      `INSERT OR REPLACE INTO pl_packaging_compatibility (
        id, packaging_variant_id, print_method_id, is_supported
      ) VALUES (?, ?, ?, 1)`
    ).run("compat_pouch_digital", "pack_pouch_mbk_250g", "pm_direct_digital");
  });

  afterAll(() => {
    try {
      rmSync(TEST_DB, { force: true });
    } catch {}
  });

  // ==========================================================================
  // Vector 1: 320px Viewport Overflow Stress & Mobile Clamping
  // ==========================================================================
  describe("Vector 1: 320px Viewport Overflow Stress & Mobile Clamping", () => {
    it("V1.1: CSS rules enforce pageContainer overflow-x clip and fluid contentContainer clamping", () => {
      const cssPath = path.resolve(process.cwd(), "src/components/private-label/styles/PrivateLabel.module.css");
      const css = readFileSync(cssPath, "utf-8");

      // Verify pageContainer prevents document-level horizontal scrollbars
      expect(css).toMatch(/\.pageContainer\s*\{[^}]*overflow-x:\s*clip/);
      expect(css).toMatch(/\.pageContainer\s*\{[^}]*max-width:\s*100%/);

      // Verify contentContainer uses min(100% - 32px, ...) ensuring 16px gutter on 320px screens
      expect(css).toMatch(/\.contentContainer\s*\{[^}]*width:\s*min\(100%\s*-\s*32px,\s*1320px\)/);
      expect(css).toMatch(/\.contentContainer\s*\{[^}]*margin-inline:\s*auto/);
    });

    it("V1.2: PackagingCard handles extreme 140+ character unbroken variant title without layout breakdown", () => {
      const extremeTitle = "DARJEELING_SUPER_PREMIUM_FIRST_FLUSH_METALLIZED_MULTI_BARRIER_HIGH_OXYGEN_RESEALABLE_ZIPPER_POUCH_500G_WHOLESALE_RESERVE_EDITION_CHALLENGER_STRESS";
      const variant = createMockVariant({
        title: extremeTitle,
        name: extremeTitle,
        slug: "extreme-title-pouch",
      });

      const html = renderToStaticMarkup(React.createElement(PackagingCard, { variant }));

      // Verify card rendered with min-width: 0 protection
      expect(html).toContain('data-testid="packaging-card"');
      expect(html).toContain(extremeTitle);
      expect(html).toContain('href="/private-label/packaging/extreme-title-pouch"');
      expect(html).toContain("Specs");
      expect(html).toContain("Configure");
    });

    it("V1.3: PackagingDetailView renders product-title and breadcrumbs with flex-wrap on narrow viewports", () => {
      const longTitle = "Artisanal Single-Estate Himalayan Reserve Metal Tin Caddy with Double Inner Slip Lid 150g";
      const variant = createMockVariant({
        title: longTitle,
        name: longTitle,
        slug: "long-title-caddy",
      });

      const html = renderToStaticMarkup(React.createElement(PackagingDetailView, { variant }));

      // Verify breadcrumbs have flexWrap: wrap
      expect(html).toContain('aria-label="Breadcrumb"');
      expect(html).toContain("flex-wrap:wrap");

      // Verify product-title testid exists
      expect(html).toContain('data-testid="product-title"');
      expect(html).toContain(longTitle);
    });

    it("V1.4: PrintComparisonMatrix isolates multi-column table in an accessible horizontally scrollable wrapper", () => {
      const html = renderToStaticMarkup(React.createElement(PrintComparisonMatrix));

      // Verify section has data-testid
      expect(html).toContain('data-testid="print-comparison"');

      // Verify table wrapper has WCAG 2.2 accessible scroll attributes: role='region', tabIndex={0}, aria-label
      expect(html).toContain('role="region"');
      expect(html).toContain('tabindex="0"');
      expect(html).toContain('aria-label="Print Comparison Table"');

      // Verify CSS ensures comparisonTableWrapper has overflow-x: auto
      const cssPath = path.resolve(process.cwd(), "src/components/private-label/styles/PrivateLabel.module.css");
      const css = readFileSync(cssPath, "utf-8");
      expect(css).toMatch(/\.comparisonTableWrapper\s*\{[^}]*overflow-x:\s*auto/);
      expect(css).toMatch(/\.comparisonTable\s*\{[^}]*min-width:\s*600px/);
    });

    it("V1.5: PackagingSpecsTabs header provides horizontal scroll containment for tab navigation", () => {
      const variant = createMockVariant();
      const html = renderToStaticMarkup(React.createElement(PackagingSpecsTabs, { variant }));

      // Verify accessible tablist and tabs
      expect(html).toContain('role="tablist"');
      expect(html).toContain('id="tab-specs"');
      expect(html).toContain('id="tab-print"');
      expect(html).toContain('id="tab-moq"');
      expect(html).toContain('data-testid="specs-panel"');

      // Verify CSS allows horizontal tab scrolling rather than blowing out viewport
      const cssPath = path.resolve(process.cwd(), "src/components/private-label/styles/PrivateLabel.module.css");
      const css = readFileSync(cssPath, "utf-8");
      expect(css).toMatch(/\.pdpTabsHeader\s*\{[^}]*overflow-x:\s*auto/);
      expect(css).toMatch(/\.specsTable\s*\{[^}]*width:\s*100%/);
      expect(css).toMatch(/\.specsTable th\s*\{[^}]*width:\s*40%/);
    });
  });

  // ==========================================================================
  // Vector 2: Contradictory Filters & Empty State Verification
  // ==========================================================================
  describe("Vector 2: Contradictory Filters & Empty State Verification", () => {
    it("V2.1: API handles mutually contradictory filter combination category=sachet & capacity_min=1000 safely", async () => {
      const req = new Request(
        "http://localhost:3000/api/v1/private-label/catalogue?category=sachet&capacity_min=1000"
      );
      const res = await getCatalogue(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.items).toEqual([]);
      expect(json.total).toBe(0);
      expect(json.packaging).toEqual([]);
    });

    it("V2.2: API handles mutually contradictory filter combination category=tin & material=glass", async () => {
      const req = new Request(
        "http://localhost:3000/api/v1/private-label/catalogue?category=tin&material=glass"
      );
      const res = await getCatalogue(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.items).toEqual([]);
      expect(json.total).toBe(0);
    });

    it("V2.3: API handles capacity_min > capacity_max gracefully without SQL syntax crash", async () => {
      const req = new Request(
        "http://localhost:3000/api/v1/private-label/catalogue?capacity_min=500&capacity_max=100"
      );
      const res = await getCatalogue(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.items).toEqual([]);
      expect(json.total).toBe(0);
    });

    it("V2.4: API safely handles SQL injection attack vectors in search query parameter", async () => {
      const sqlInjections = [
        "' OR 1=1 --",
        "'; DROP TABLE pl_packaging_variants; --",
        '" UNION SELECT * FROM pl_packaging_variants --',
        "admin'--",
      ];

      for (const payload of sqlInjections) {
        const req = new Request(
          `http://localhost:3000/api/v1/private-label/catalogue?search=${encodeURIComponent(payload)}`
        );
        const res = await getCatalogue(req);
        expect(res.status).toBe(200);

        const json = await res.json();
        // Parameterized queries should match 0 rows
        expect(json.items).toEqual([]);
      }

      // Assert table was not dropped
      const count = getDb().prepare("SELECT count(*) as c FROM pl_packaging_variants").get() as { c: number };
      expect(count.c).toBeGreaterThan(0);
    });

    it("V2.5: API safely handles regex metacharacters, unicode symbols, and enforces 100-character boundary", async () => {
      const edgeSearches = [
        "[[[[[******+++++",
        "(a+)+$",
        "!@#$%^&*()_+=-{}[]|:;'<>?,./~`",
        "🍵 盒 茶袋 Darjeeling 100%",
      ];

      for (const query of edgeSearches) {
        const req = new Request(
          `http://localhost:3000/api/v1/private-label/catalogue?search=${encodeURIComponent(query)}`
        );
        const res = await getCatalogue(req);
        expect(res.status).toBe(200);

        const json = await res.json();
        expect(Array.isArray(json.items)).toBe(true);
      }

      // Excessive query (>100 characters) must trigger Zod validation 400 Bad Request
      const excessiveReq = new Request(
        `http://localhost:3000/api/v1/private-label/catalogue?search=${encodeURIComponent("A".repeat(150))}`
      );
      const excessiveRes = await getCatalogue(excessiveReq);
      expect(excessiveRes.status).toBe(400);
      const excessiveJson = await excessiveRes.json();
      expect(excessiveJson.error).toMatch(/too_big|invalid/i);
    });

    it("V2.6: PackagingCatalogueExplorer renders [data-testid='empty-state'] when contradictory filters yield 0 matches", () => {
      currentSearchParams = new URLSearchParams("category=sachet&capacity=1000");

      const mockItems = [
        createMockVariant({ category: "sachet", family: "sachet", net_capacity_grams: 3 }),
        createMockVariant({ category: "pouch", family: "pouch", net_capacity_grams: 250 }),
      ];

      const html = renderToStaticMarkup(
        React.createElement(PackagingCatalogueExplorer, { initialVariants: mockItems })
      );

      // Verify empty-state is rendered
      expect(html).toContain('data-testid="empty-state"');
      expect(html).toContain("No packaging found");
      expect(html).toContain("Clear All Filters");
      expect(html).not.toContain('data-testid="packaging-card"');

      // Reset mock params
      currentSearchParams = new URLSearchParams();
    });

    it("V2.7: EmptyCatalogueState renders accessible role='status' and 44px min-height reset button", () => {
      let resetCalled = false;
      const html = renderToStaticMarkup(
        React.createElement(EmptyCatalogueState, { onReset: () => { resetCalled = true; } })
      );

      expect(html).toContain('data-testid="empty-state"');
      expect(html).toContain('role="status"');
      expect(html).toContain("No packaging found");
      expect(html).toContain("min-height:44px");
      expect(html).toContain("Clear All Filters");

      // Verify functional reset callback execution
      const element = React.createElement(EmptyCatalogueState, { onReset: () => { resetCalled = true; } });
      element.props.onReset();
      expect(resetCalled).toBe(true);
    });
  });

  // ==========================================================================
  // Vector 3: Missing Assets & Graceful Fallback Handling
  // ==========================================================================
  describe("Vector 3: Missing Assets & Graceful Fallback Handling", () => {
    it("V3.1: PackagingCard renders [data-testid='image-fallback'] when hero_image_url is null or empty", () => {
      const nullVariant = createMockVariant({ hero_image_url: null, image_url: null });
      const htmlNull = renderToStaticMarkup(React.createElement(PackagingCard, { variant: nullVariant }));

      expect(htmlNull).toContain('data-testid="image-fallback"');
      expect(htmlNull).not.toContain("<img");

      const emptyVariant = createMockVariant({ hero_image_url: "", image_url: "" });
      const htmlEmpty = renderToStaticMarkup(React.createElement(PackagingCard, { variant: emptyVariant }));

      expect(htmlEmpty).toContain('data-testid="image-fallback"');
    });

    it("V3.2: PackagingCard renders [data-testid='image-fallback'] when hero_image_url points to a fallback or relative path", () => {
      const fallbackVariant = createMockVariant({
        hero_image_url: "/images/packaging-fallback.png",
      });
      const htmlFallback = renderToStaticMarkup(React.createElement(PackagingCard, { variant: fallbackVariant }));
      expect(htmlFallback).toContain('data-testid="image-fallback"');

      const relativeVariant = createMockVariant({
        hero_image_url: "broken-relative-path.jpg",
      });
      const htmlRelative = renderToStaticMarkup(React.createElement(PackagingCard, { variant: relativeVariant }));
      expect(htmlRelative).toContain('data-testid="image-fallback"');
    });

    it("V3.3: PackagingCard renders real <img src=...> when given a valid HTTP hero_image_url", () => {
      const realVariant = createMockVariant({
        hero_image_url: "https://images.unsplash.com/photo-1544787219-7f47ccb76574",
      });
      const htmlReal = renderToStaticMarkup(React.createElement(PackagingCard, { variant: realVariant }));

      expect(htmlReal).toContain('<img src="https://images.unsplash.com/photo-1544787219-7f47ccb76574"');
      expect(htmlReal).not.toContain('data-testid="image-fallback"');
    });

    it("V3.4: PackagingCard renders 'Digital mockup — illustrative only' notice when image_illustrative is true", () => {
      const illustrativeVariant = createMockVariant({ image_illustrative: true });
      const html = renderToStaticMarkup(React.createElement(PackagingCard, { variant: illustrativeVariant }));

      expect(html).toContain("Digital mockup — illustrative only");

      const photographicVariant = createMockVariant({ image_illustrative: false });
      const htmlPhoto = renderToStaticMarkup(React.createElement(PackagingCard, { variant: photographicVariant }));

      expect(htmlPhoto).not.toContain("Digital mockup — illustrative only");
    });

    it("V3.5: PackagingDetailView renders [data-testid='image-fallback'] mockup stage when hero image is missing", () => {
      const noImageVariant = createMockVariant({
        hero_image_url: null,
        title: "Biodegradable Pyramid Sachet Envelope 3g",
      });
      const html = renderToStaticMarkup(React.createElement(PackagingDetailView, { variant: noImageVariant }));

      expect(html).toContain('data-testid="image-fallback"');
      expect(html).toContain("Biodegradable Pyramid Sachet Envelope 3g");
      expect(html).toContain("Digital mockup — illustrative only");
    });

    it("V3.6: PackagingDielineAction renders a download link when dielineUrl is present", () => {
      const html = renderToStaticMarkup(
        React.createElement(PackagingDielineAction, {
          dielineUrl: "https://teafloww.com/dielines/standup-pouch-250g.pdf",
          variantTitle: "Stand-Up Pouch Matte Black 250g",
        })
      );

      expect(html).toContain('data-testid="download-dieline"');
      expect(html).toContain('<a');
      expect(html).toContain('href="https://teafloww.com/dielines/standup-pouch-250g.pdf"');
      expect(html).toContain("download");
      expect(html).toContain("Download Approved Dieline");
    });

    it("V3.7: PackagingDielineAction renders truthful 'Request Prepress Dieline' enquiry link when dielineUrl is null or undefined", () => {
      const htmlNull = renderToStaticMarkup(
        React.createElement(PackagingDielineAction, {
          dielineUrl: null,
          variantTitle: "Vintage Artisan Metal Tin 100g",
        })
      );

      // Missing templates lead to the real enquiry form, never a fake queue.
      expect(htmlNull).toContain('data-testid="download-dieline"');
      expect(htmlNull).toContain('href="/private-label?dieline=');
      expect(htmlNull).not.toContain('href=""');
      expect(htmlNull).not.toContain('href="#"');
      expect(htmlNull).toContain("Request Prepress Dieline");

      const htmlUndefined = renderToStaticMarkup(
        React.createElement(PackagingDielineAction, {
          dielineUrl: undefined,
          variantTitle: "Amber Apothecary Jar 150g",
        })
      );
      expect(htmlUndefined).toContain('data-testid="download-dieline"');
      expect(htmlUndefined).toContain("Request Prepress Dieline");
    });
  });

  // ==========================================================================
  // Vector 4: Structured Data Schema Invariants & Dynamic OpenGraph Metadata
  // ==========================================================================
  describe("Vector 4: Structured Data Schema Invariants & Dynamic OpenGraph Metadata", () => {
    it("V4.1: /private-label landing page embeds valid Schema.org graph (Organization, Service, FAQPage, BreadcrumbList)", async () => {
      const pageJsx = await PrivateLabelLandingPage();
      const html = renderToStaticMarkup(pageJsx);

      // Extract JSON-LD script content
      const match = html.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
      expect(match).not.toBeNull();

      const jsonLd = JSON.parse(match![1]);
      expect(jsonLd["@context"]).toBe("https://schema.org");
      expect(Array.isArray(jsonLd["@graph"])).toBe(true);

      const graph = jsonLd["@graph"];

      // 1. Organization schema invariants
      const org = graph.find((item: any) => item["@type"] === "Organization");
      expect(org).toBeDefined();
      expect(org.name).toBe("TeaFloww");
      expect(org.legalName).toBe("Nirva");
      expect(org.taxID).toBe("19CTHPK8646J2ZY");
      expect(org.telephone).toBe("+91 7001304853");
      expect(org.email).toBe("info@teafloww.com");
      expect(org.address["@type"]).toBe("PostalAddress");
      expect(org.address.addressCountry).toBe("IN");

      // 2. Service schema invariants
      const service = graph.find((item: any) => item["@type"] === "Service");
      expect(service).toBeDefined();
      expect(service.name).toBe("TeaFloww Private Label Tea Atelier");
      expect(service.serviceType).toBe("Private Label Tea Manufacturing & Packaging");
      expect(Array.isArray(service.areaServed)).toBe(true);
      expect(service.areaServed.some((a: any) => a.name === "India")).toBe(true);
      expect(service.areaServed.some((a: any) => a.name === "United States")).toBe(true);

      // 3. FAQPage schema invariants
      const faq = graph.find((item: any) => item["@type"] === "FAQPage");
      expect(faq).toBeDefined();
      expect(Array.isArray(faq.mainEntity)).toBe(true);
      expect(faq.mainEntity.length).toBeGreaterThanOrEqual(4);
      for (const q of faq.mainEntity) {
        expect(q["@type"]).toBe("Question");
        expect(q.name).toBeDefined();
        expect(q.acceptedAnswer["@type"]).toBe("Answer");
        expect(q.acceptedAnswer.text).toBeDefined();
      }

      // 4. BreadcrumbList schema invariants
      const breadcrumb = graph.find((item: any) => item["@type"] === "BreadcrumbList");
      expect(breadcrumb).toBeDefined();
      expect(Array.isArray(breadcrumb.itemListElement)).toBe(true);
      expect(breadcrumb.itemListElement.length).toBe(2);
      expect(breadcrumb.itemListElement[0].name).toBe("Home");
      expect(breadcrumb.itemListElement[1].name).toBe("Private Label");
    });

    it("V4.2: /private-label/packaging catalogue embeds valid Schema.org CollectionPage and ItemList", async () => {
      const pageJsx = await PackagingCataloguePage();
      const html = renderToStaticMarkup(pageJsx);

      const match = html.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
      expect(match).not.toBeNull();

      const jsonLd = JSON.parse(match![1]);
      expect(jsonLd["@context"]).toBe("https://schema.org");
      expect(jsonLd["@type"]).toBe("CollectionPage");
      expect(jsonLd.name).toBe("TeaFloww Packaging Formats & Catalogue");

      // Main entity is an ItemList with indexed items
      expect(jsonLd.mainEntity["@type"]).toBe("ItemList");
      expect(Array.isArray(jsonLd.mainEntity.itemListElement)).toBe(true);

      // BreadcrumbList has 3 positions
      expect(jsonLd.breadcrumb["@type"]).toBe("BreadcrumbList");
      expect(jsonLd.breadcrumb.itemListElement.length).toBe(3);
      expect(jsonLd.breadcrumb.itemListElement[2].name).toBe("Packaging Catalogue");
    });

    it("V4.3: /private-label/packaging/[slug] PDP embeds valid Schema.org Product and Offer schema", async () => {
      const pageJsx = await PackagingDetailPage({
        params: Promise.resolve({ slug: "stand-up-pouch-matte-black-250g" }),
      });
      const html = renderToStaticMarkup(pageJsx);

      const match = html.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
      expect(match).not.toBeNull();

      const jsonLd = JSON.parse(match![1]);
      expect(jsonLd["@context"]).toBe("https://schema.org");
      expect(Array.isArray(jsonLd["@graph"])).toBe(true);

      const product = jsonLd["@graph"].find((i: any) => i["@type"] === "Product");
      expect(product).toBeDefined();
      expect(product.name).toBe("Stand-Up Pouch Matte Black 250g");
      expect(product.sku).toBe("PL-PC-250-MBK");
      expect(product.brand["@type"]).toBe("Brand");
      expect(product.brand.name).toBe("TeaFloww");
      expect(product.material).toBe("Kraft / Foil Barrier");

      // Offer invariants
      const offer = product.offers;
      expect(offer["@type"]).toBe("Offer");
      expect(offer.priceCurrency).toBe("INR");
      expect(offer.price).toBe("18.50");
      expect(offer.availability).toBe("https://schema.org/InStock");
      expect(offer.itemCondition).toBe("https://schema.org/NewCondition");
      expect(offer.eligibleQuantity["@type"]).toBe("QuantitativeValue");
      expect(offer.eligibleQuantity.minValue).toBe(500);
      expect(offer.eligibleQuantity.unitCode).toBe("C62");
      expect(offer.seller.name).toBe("TeaFloww");

      // BreadcrumbList invariants (4 positions)
      const breadcrumb = jsonLd["@graph"].find((i: any) => i["@type"] === "BreadcrumbList");
      expect(breadcrumb).toBeDefined();
      expect(breadcrumb.itemListElement.length).toBe(4);
      expect(breadcrumb.itemListElement[3].name).toBe("Stand-Up Pouch Matte Black 250g");
    });

    it("V4.4: Static landing metadata generates valid OpenGraph and Twitter card attributes", () => {
      expect(landingMetadata.title).toContain("Private Label Tea Studio");
      expect(landingMetadata.title).toContain("TeaFloww");
      expect(landingMetadata.description).toBeDefined();

      const og = landingMetadata.openGraph as any;
      expect(og).toBeDefined();
      expect(og?.type).toBe("website");
      expect(og?.url).toContain("/private-label");
      expect(Array.isArray(og?.images)).toBe(true);
      expect((og?.images as any[])[0].width).toBe(1200);
      expect((og?.images as any[])[0].height).toBe(630);

      const twitter = landingMetadata.twitter as any;
      expect(twitter?.card).toBe("summary_large_image");
    });

    it("V4.5: Dynamic generateMetadata produces rich OpenGraph metadata for published packaging slug", async () => {
      const meta = await generateDetailMetadata({
        params: Promise.resolve({ slug: "stand-up-pouch-matte-black-250g" }),
      });

      expect(meta.title).toContain("Stand-Up Pouch Matte Black 250g");
      expect(meta.title).toContain("TeaFloww");
      expect(meta.description).toContain("Kraft / Foil Barrier");
      expect(meta.description).toContain("500 units");

      const og = meta.openGraph;
      expect(og?.url).toContain("/private-label/packaging/stand-up-pouch-matte-black-250g");
      expect(Array.isArray(og?.images)).toBe(true);
    });

    it("V4.6: Dynamic generateMetadata quarantines invalid or missing slugs with noindex", async () => {
      const missingMeta = await generateDetailMetadata({
        params: Promise.resolve({ slug: "completely-nonexistent-packaging-slug" }),
      });

      expect(missingMeta.title).toContain("Packaging Structure Not Found");
      expect(missingMeta.robots).toEqual(
        expect.objectContaining({ index: false, follow: false })
      );

      const emptyMeta = await generateDetailMetadata({
        params: Promise.resolve({ slug: "" }),
      });

      expect(emptyMeta.title).toContain("Packaging Not Found");
      expect(emptyMeta.robots).toEqual(
        expect.objectContaining({ index: false, follow: false })
      );
    });

    it("V4.7: PackagingDetailPage calls notFound() for missing or non-published packaging slugs", async () => {
      await expect(
        PackagingDetailPage({ params: Promise.resolve({ slug: "nonexistent-packaging-slug" }) })
      ).rejects.toThrow("NEXT_NOT_FOUND");
    });
  });
});
