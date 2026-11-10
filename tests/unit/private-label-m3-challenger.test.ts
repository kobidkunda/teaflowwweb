/**
 * TeaFloww Private Label Studio — Milestone M3 Adversarial Challenger Test Suite
 * File: tests/unit/private-label-m3-challenger.test.ts
 *
 * EMPIRICAL ADVERSARIAL STRESS HARNESS
 * Agent: private_label_m3_challenger_1
 *
 * Rigorously stress-tests:
 * 1. Vector 1: Parameter Tampering & Data Leakage Probing
 *    - Query parameter pollution, field expansion attempts (?fields=cogs,margin,supplier_cost),
 *      prototype pollution strings, and JSON injection probing.
 *    - Stringent zero-leakage assertions verifying that confidential internal fields
 *      (unit_cost_paise, supplier_name, supplier_sku, margin_rate, notes, internal_cogs)
 *      never leak in response bodies.
 * 2. Vector 2: Anti-Enumeration & Status Quarantine
 *    - Strict quarantine of draft and archived packaging items across /catalogue and /packaging/[slug].
 *    - Anti-enumeration timing and message indistinguishability (identical HTTP 404 responses for
 *      draft, archived, and non-existent variants).
 *    - Dynamic sitemap isolation.
 * 3. Vector 3: SQL Injection & Boundary Probing
 *    - SQLi payloads across search, q, material, and category parameters.
 *    - Boundary limit, capacity_min, capacity_max, and offset stress testing.
 *    - String length limits (max 100) and wildcard fuzzing.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { rmSync } from "node:fs";

const TEST_DB = path.join(
  tmpdir(),
  `pl-m3-challenger-${process.pid}-${Date.now()}.sqlite`
);
process.env.DATABASE_PATH = TEST_DB;
(process.env as Record<string, string | undefined>).NODE_ENV = "test";

import { getDb } from "@/lib/db";
import { PrivateLabelService } from "@/lib/private-label/service";
import { PrivateLabelNotFoundError } from "@/lib/private-label/types";
import { publicPackagingVariantDtoSchema } from "@/lib/private-label/schemas";
import { GET as getCatalogue } from "@/app/api/v1/private-label/catalogue/route";
import { GET as getPackagingDetail } from "@/app/api/v1/private-label/packaging/[slug]/route";
import { getCatalogSitemapEntries } from "@/lib/seo/sitemap";

// Redacted sensitive tokens that must NEVER appear in any public payload
const CONFIDENTIAL_TOKENS = [
  "Confidential Packaging Corp",
  "Secret Tin Mills Ltd",
  "Hidden Glassworks",
  "Secret Bag Co",
  "Leaky Supplier Inc",
  "Retired Supplier Ltd",
  "SUP-KRF-250",
  "SUP-TIN-100",
  "SUP-JAR-150",
  "SUP-BAG-1000",
  "SUP-DRAFT-999",
  "SUP-OLD-50",
  "supplier_name",
  "supplier_sku",
  "unit_cost_paise",
  "margin_rate",
  "margin_pct",
  "internal_cogs",
  "supplier_cost_paise",
  "cogs_paise",
  "private_notes",
];

describe("Milestone M3 Adversarial Challenger: API & DTO Security Stress", () => {
  beforeAll(() => {
    // 1. Initialize isolated test database via migration script
    execFileSync(process.execPath, ["scripts/migrate.mjs"], {
      env: { ...process.env, DATABASE_PATH: TEST_DB },
    });

    const db = getDb();
    PrivateLabelService.seedInitialCatalog();

    // 2. Seed diverse packaging items with known confidential fields
    const seedPackaging = [
      {
        id: "pack_ch_pouch_250",
        family_id: "fam_pouch",
        slug: "challenger-pouch-matte-black-250g",
        sku: "PL-CH-PC-250",
        title: "Challenger Stand-Up Pouch Matte Black 250g",
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
        id: "pack_ch_tin_100",
        family_id: "fam_tin",
        slug: "challenger-metal-tin-caddy-100g",
        sku: "PL-CH-TN-100",
        title: "Challenger Metal Tin Caddy 100g",
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
        id: "pack_ch_jar_150",
        family_id: "fam_jar",
        slug: "challenger-amber-glass-jar-150g",
        sku: "PL-CH-JR-150",
        title: "Challenger Amber Glass Jar 150g",
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
        id: "pack_ch_bag_1000",
        family_id: "fam_bag",
        slug: "challenger-bulk-kraft-bag-1kg",
        sku: "PL-CH-BG-1000",
        title: "Challenger Bulk Kraft Bag 1kg",
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
      // Draft variant: must remain in quarantine
      {
        id: "pack_ch_draft_001",
        family_id: "fam_pouch",
        slug: "challenger-draft-pouch-variant-001",
        sku: "PL-CH-DRAFT-001",
        title: "Challenger Confidential R&D Pouch Prototype",
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
      // Archived variant: must remain in quarantine
      {
        id: "pack_ch_archived_002",
        family_id: "fam_tin",
        slug: "challenger-archived-tin-old-002",
        sku: "PL-CH-ARCHIVED-002",
        title: "Challenger Discontinued Tin Caddy 2024",
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

    // 3. Seed compatibility
    const insertCompat = db.prepare(`
      INSERT OR REPLACE INTO pl_packaging_compatibility (
        id, packaging_variant_id, print_method_id, is_supported
      ) VALUES (?, ?, ?, 1)
    `);
    insertCompat.run("cmp_ch_1", "pack_ch_pouch_250", "pm_direct_digital");
    insertCompat.run("cmp_ch_2", "pack_ch_pouch_250", "pm_paper_label");
    insertCompat.run("cmp_ch_3", "pack_ch_tin_100", "pm_screen_print");

    // 4. Seed price book tiers
    const insertTier = db.prepare(`
      INSERT OR REPLACE INTO pl_price_book_tiers (
        id, price_book_id, item_type, item_id, min_qty, max_qty, unit_price_paise
      ) VALUES (?, 'pb_default_inr', 'packaging', ?, ?, ?, ?)
    `);
    insertTier.run("tier_ch_pouch_500", "pack_ch_pouch_250", 500, 999, 1850);
    insertTier.run("tier_ch_tin_250", "pack_ch_tin_100", 250, 499, 4200);
  });

  afterAll(() => {
    try {
      rmSync(TEST_DB, { force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  // ==========================================================================
  // VECTOR 1: Parameter Tampering & Data Leakage Probing
  // ==========================================================================
  describe("Vector 1: Parameter Tampering & Data Leakage Probing", () => {
    it("V1.1: rejects or completely ignores ?fields= expansion attempts and never leaks COGS/supplier info", async () => {
      const probeUrls = [
        "http://localhost:3000/api/v1/private-label/catalogue?fields=cogs,margin,supplier_cost,supplier_name,unit_cost_paise",
        "http://localhost:3000/api/v1/private-label/catalogue?include=supplier,cost_breakdown,margins",
        "http://localhost:3000/api/v1/private-label/catalogue?select=*&expand=all",
        "http://localhost:3000/api/v1/private-label/catalogue?attributes=all,internal_cogs",
      ];

      for (const url of probeUrls) {
        const req = new Request(url);
        const res = await getCatalogue(req);
        // Endpoint either succeeds (ignoring extraneous fields) or returns 400
        expect([200, 400]).toContain(res.status);

        const bodyText = await res.text();
        for (const token of CONFIDENTIAL_TOKENS) {
          expect(bodyText).not.toContain(token);
        }
      }
    });

    it("V1.2: handles query parameter pollution with duplicate keys without leaking state or crashing", async () => {
      // Attacker attempts parameter pollution: duplicate category, duplicate search, duplicate status
      const pollutedUrls = [
        "http://localhost:3000/api/v1/private-label/catalogue?category=pouch&category=tin",
        "http://localhost:3000/api/v1/private-label/catalogue?category=pouch&category=draft",
        "http://localhost:3000/api/v1/private-label/catalogue?status=published&status=draft",
        "http://localhost:3000/api/v1/private-label/catalogue?fields[]=unit_cost_paise&fields[]=supplier_name",
      ];

      for (const url of pollutedUrls) {
        const req = new Request(url);
        const res = await getCatalogue(req);
        expect([200, 400]).toContain(res.status);

        const bodyText = await res.text();
        for (const token of CONFIDENTIAL_TOKENS) {
          expect(bodyText).not.toContain(token);
        }
      }
    });

    it("V1.3: prototype pollution payloads in query strings do not alter Object.prototype or leak data", async () => {
      const protoPollutionUrls = [
        "http://localhost:3000/api/v1/private-label/catalogue?__proto__[polluted]=true",
        "http://localhost:3000/api/v1/private-label/catalogue?constructor.prototype.leaked=true",
        "http://localhost:3000/api/v1/private-label/catalogue?__proto__[unit_cost_paise]=9999",
      ];

      for (const url of protoPollutionUrls) {
        const req = new Request(url);
        const res = await getCatalogue(req);
        expect([200, 400]).toContain(res.status);

        // Verify global Object.prototype was NOT polluted
        expect((Object.prototype as any).polluted).toBeUndefined();
        expect((Object.prototype as any).leaked).toBeUndefined();
        expect((Object.prototype as any).unit_cost_paise).toBeUndefined();

        const bodyText = await res.text();
        for (const token of CONFIDENTIAL_TOKENS) {
          expect(bodyText).not.toContain(token);
        }
      }
    });

    it("V1.4: JSON injection probing in query parameters is safely handled without leaking schema", async () => {
      const jsonProbeUrls = [
        'http://localhost:3000/api/v1/private-label/catalogue?q={"$gt":""}',
        'http://localhost:3000/api/v1/private-label/catalogue?filter={"status":"draft"}',
        'http://localhost:3000/api/v1/private-label/catalogue?search={"supplier_name":"Confidential"}',
      ];

      for (const url of jsonProbeUrls) {
        const req = new Request(url);
        const res = await getCatalogue(req);
        expect([200, 400]).toContain(res.status);

        const bodyText = await res.text();
        for (const token of CONFIDENTIAL_TOKENS) {
          expect(bodyText).not.toContain(token);
        }
      }
    });

    it("V1.5: PDP route /packaging/[slug] strictly redacts all internal supplier details and notes under parameter tampering", async () => {
      const tamperingUrls = [
        "http://localhost:3000/api/v1/private-label/packaging/challenger-pouch-matte-black-250g?fields=all,supplier_name,unit_cost_paise",
        "http://localhost:3000/api/v1/private-label/packaging/challenger-pouch-matte-black-250g?expand=supplier&debug=true",
        "http://localhost:3000/api/v1/private-label/packaging/challenger-pouch-matte-black-250g?include=cogs,margin",
      ];

      for (const url of tamperingUrls) {
        const req = new Request(url);
        const res = await getPackagingDetail(req, {
          params: Promise.resolve({ slug: "challenger-pouch-matte-black-250g" }),
        });
        expect(res.status).toBe(200);

        const bodyText = await res.text();
        for (const token of CONFIDENTIAL_TOKENS) {
          expect(bodyText).not.toContain(token);
        }
      }
    });

    it("V1.6: DTO schema validation ensures exact structural compliance without extra properties", async () => {
      const req = new Request("http://localhost:3000/api/v1/private-label/catalogue?limit=10");
      const res = await getCatalogue(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.items).toBeDefined();
      expect(Array.isArray(json.items)).toBe(true);
      expect(json.items.length).toBeGreaterThanOrEqual(4);

      for (const item of json.items) {
        // Must parse cleanly against strict DTO schema
        const parseResult = publicPackagingVariantDtoSchema.safeParse(item);
        expect(parseResult.success).toBe(true);

        // Verify forbidden keys are absent
        expect((item as any).supplier_name).toBeUndefined();
        expect((item as any).supplier_sku).toBeUndefined();
        expect((item as any).unit_cost_paise).toBeUndefined();
        expect((item as any).margin_rate).toBeUndefined();
        expect((item as any).notes).toBeUndefined();
        expect((item as any).created_at).toBeUndefined();
        expect((item as any).updated_at).toBeUndefined();
        expect((item as any).revision).toBeUndefined();
      }
    });

    it("V1.7: starting price calculation exposes only consumer retail pricing without supplier cost or margin rate", async () => {
      const req = new Request("http://localhost:3000/api/v1/private-label/packaging/challenger-pouch-matte-black-250g");
      const res = await getPackagingDetail(req, {
        params: Promise.resolve({ slug: "challenger-pouch-matte-black-250g" }),
      });
      expect(res.status).toBe(200);

      const item = await res.json();
      expect(item.starting_price).toBeDefined();
      expect(item.starting_price.currency).toBe("INR");
      expect(item.starting_price.unit_price_paise).toBe(1850);
      expect(item.starting_price.formatted_unit_price).toBe("₹18.50");

      // Verify no internal pricing fields are leaked in starting_price object
      expect((item.starting_price as any).cost_paise).toBeUndefined();
      expect((item.starting_price as any).supplier_cost).toBeUndefined();
      expect((item.starting_price as any).margin).toBeUndefined();
      expect((item.starting_price as any).margin_rate).toBeUndefined();
    });
  });

  // ==========================================================================
  // VECTOR 2: Anti-Enumeration & Status Quarantine
  // ==========================================================================
  describe("Vector 2: Anti-Enumeration & Status Quarantine", () => {
    it("V2.1: draft packaging variants never appear in public catalogue listing", async () => {
      const req = new Request("http://localhost:3000/api/v1/private-label/catalogue?limit=50");
      const res = await getCatalogue(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      const draftItem = json.items.find(
        (i: any) => i.slug === "challenger-draft-pouch-variant-001" || i.id === "pack_ch_draft_001"
      );
      expect(draftItem).toBeUndefined();
    });

    it("V2.2: archived packaging variants never appear in public catalogue listing", async () => {
      const req = new Request("http://localhost:3000/api/v1/private-label/catalogue?limit=50");
      const res = await getCatalogue(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      const archivedItem = json.items.find(
        (i: any) => i.slug === "challenger-archived-tin-old-002" || i.id === "pack_ch_archived_002"
      );
      expect(archivedItem).toBeUndefined();
    });

    it("V2.3: searching explicitly for draft titles, SKUs, or suppliers returns 0 items", async () => {
      const probeSearches = [
        "challenger-draft-pouch-variant-001",
        "Challenger Confidential R&D Pouch Prototype",
        "PL-CH-DRAFT-001",
        "Leaky Supplier Inc",
        "SUP-DRAFT-999",
      ];

      for (const query of probeSearches) {
        const req = new Request(
          `http://localhost:3000/api/v1/private-label/catalogue?search=${encodeURIComponent(query)}`
        );
        const res = await getCatalogue(req);
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.items.length).toBe(0);
        expect(json.total).toBe(0);
      }
    });

    it("V2.4: searching explicitly for archived titles or SKUs returns 0 items", async () => {
      const probeSearches = [
        "challenger-archived-tin-old-002",
        "Challenger Discontinued Tin Caddy 2024",
        "PL-CH-ARCHIVED-002",
        "Retired Supplier Ltd",
      ];

      for (const query of probeSearches) {
        const req = new Request(
          `http://localhost:3000/api/v1/private-label/catalogue?q=${encodeURIComponent(query)}`
        );
        const res = await getCatalogue(req);
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.items.length).toBe(0);
        expect(json.total).toBe(0);
      }
    });

    it("V2.5: PDP slug probing for draft variant strictly returns HTTP 404", async () => {
      const req = new Request(
        "http://localhost:3000/api/v1/private-label/packaging/challenger-draft-pouch-variant-001"
      );
      const res = await getPackagingDetail(req, {
        params: Promise.resolve({ slug: "challenger-draft-pouch-variant-001" }),
      });
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBeDefined();
    });

    it("V2.6: PDP slug probing for archived variant strictly returns HTTP 404", async () => {
      const req = new Request(
        "http://localhost:3000/api/v1/private-label/packaging/challenger-archived-tin-old-002"
      );
      const res = await getPackagingDetail(req, {
        params: Promise.resolve({ slug: "challenger-archived-tin-old-002" }),
      });
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBeDefined();
    });

    it("V2.7: PDP slug probing for non-existent variant strictly returns HTTP 404", async () => {
      const req = new Request(
        "http://localhost:3000/api/v1/private-label/packaging/totally-nonexistent-slug-xyz"
      );
      const res = await getPackagingDetail(req, {
        params: Promise.resolve({ slug: "totally-nonexistent-slug-xyz" }),
      });
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBeDefined();
    });

    it("V2.8: Anti-Enumeration indistinguishability — draft, archived, and non-existent slugs yield identical 404 response shape", async () => {
      const slugs = [
        "challenger-draft-pouch-variant-001",
        "challenger-archived-tin-old-002",
        "totally-nonexistent-slug-xyz",
      ];

      const responses = [];
      for (const slug of slugs) {
        const req = new Request(`http://localhost:3000/api/v1/private-label/packaging/${slug}`);
        const res = await getPackagingDetail(req, {
          params: Promise.resolve({ slug }),
        });
        expect(res.status).toBe(404);
        const json = await res.json();
        responses.push(json);
      }

      // Verify that all return exactly { error: `Packaging variant '${slug}' not found` }
      for (let i = 0; i < slugs.length; i++) {
        expect(responses[i]).toEqual({
          error: `Packaging variant '${slugs[i]}' not found`,
        });
      }
    });

    it("V2.9: Direct domain service throws PrivateLabelNotFoundError for draft and archived items", () => {
      expect(() => {
        PrivateLabelService.getPublicPackagingVariantBySlug("challenger-draft-pouch-variant-001");
      }).toThrow(PrivateLabelNotFoundError);

      expect(() => {
        PrivateLabelService.getPublicPackagingVariantBySlug("challenger-archived-tin-old-002");
      }).toThrow(PrivateLabelNotFoundError);

      expect(() => {
        PrivateLabelService.getPublicPackagingVariantBySlug("non-existent-variant");
      }).toThrow(PrivateLabelNotFoundError);
    });

    it("V2.10: Sitemap registry strictly isolates draft and archived items from indexing", () => {
      const entries = getCatalogSitemapEntries();
      const urls = entries.map((e) => e.url);

      // Must contain published items
      expect(
        urls.some((u) => u.includes("challenger-pouch-matte-black-250g"))
      ).toBe(true);

      // Must NEVER contain draft or archived items
      expect(
        urls.some((u) => u.includes("challenger-draft-pouch-variant-001"))
      ).toBe(false);
      expect(
        urls.some((u) => u.includes("challenger-archived-tin-old-002"))
      ).toBe(false);
    });

    it("V2.11: Malformed and path-traversal slugs return 400 or 404 without crashing or escaping", async () => {
      const probeSlugs = [
        { slug: "", expectedStatus: 400 },
        { slug: "   ", expectedStatus: 400 },
        { slug: "../../etc/passwd", expectedStatus: 404 },
        { slug: "..%2F..%2Fdata%2Fstore.sqlite", expectedStatus: 404 },
        { slug: "<script>alert(1)</script>", expectedStatus: 404 },
        { slug: "slug-with-null\0byte", expectedStatus: 404 },
      ];

      for (const { slug, expectedStatus } of probeSlugs) {
        const req = new Request(`http://localhost:3000/api/v1/private-label/packaging/${encodeURIComponent(slug)}`);
        const res = await getPackagingDetail(req, {
          params: Promise.resolve({ slug }),
        });
        expect([expectedStatus, 400, 404]).toContain(res.status);
      }
    });
  });

  // ==========================================================================
  // VECTOR 3: SQL Injection & Boundary Probing
  // ==========================================================================
  describe("Vector 3: SQL Injection & Boundary Probing", () => {
    it("V3.1: SQL injection attempts in 'search' parameter are safely neutralized", async () => {
      const sqliPayloads = [
        "' OR '1'='1",
        "' OR '1'='1' --",
        '" OR ""="',
        "admin'--",
        "1' ORDER BY 1--",
        "'; DROP TABLE pl_packaging_variants; --",
        "' UNION SELECT 1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26 --",
        "' OR (SELECT count(*) FROM pl_packaging_variants)>0 --",
      ];

      const db = getDb();

      for (const payload of sqliPayloads) {
        const req = new Request(
          `http://localhost:3000/api/v1/private-label/catalogue?search=${encodeURIComponent(payload)}`
        );
        const res = await getCatalogue(req);
        expect(res.status).toBe(200);

        const json = await res.json();
        // Since payload searches for literal string, it should match nothing
        expect(json.items.length).toBe(0);
        expect(json.total).toBe(0);

        // Verify table integrity (no DROP occurred)
        const tableCheck = db
          .prepare("SELECT count(*) as count FROM pl_packaging_variants")
          .get() as { count: number };
        expect(tableCheck.count).toBeGreaterThan(0);
      }
    });

    it("V3.2: SQL injection attempts in 'q' parameter are safely neutralized", async () => {
      const validLengthPayloads = [
        "Kraft') OR ('1'='1",
        "' OR status='draft' --",
        "') UNION SELECT 1,2,3--",
      ];

      for (const payload of validLengthPayloads) {
        const req = new Request(
          `http://localhost:3000/api/v1/private-label/catalogue?q=${encodeURIComponent(payload)}`
        );
        const res = await getCatalogue(req);
        expect(res.status).toBe(200);

        const json = await res.json();
        expect(json.items.length).toBe(0);
      }

      // Overlength SQLi payload (> 100 chars) is intercepted and rejected by Zod boundary check (HTTP 400)
      const overlengthPayload =
        "') UNION ALL SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL--";
      const overlengthRes = await getCatalogue(
        new Request(
          `http://localhost:3000/api/v1/private-label/catalogue?q=${encodeURIComponent(overlengthPayload)}`
        )
      );
      expect(overlengthRes.status).toBe(400);
      const errJson = await overlengthRes.json();
      expect(errJson.error).toContain("Invalid catalogue query parameters");
    });

    it("V3.3: SQL injection attempts in 'material' parameter are safely neutralized", async () => {
      const sqliPayloads = [
        "Kraft' OR '1'='1",
        "Tin' UNION SELECT * FROM pl_packaging_variants--",
        "'; DELETE FROM pl_price_books; --",
      ];

      for (const payload of sqliPayloads) {
        const req = new Request(
          `http://localhost:3000/api/v1/private-label/catalogue?material=${encodeURIComponent(payload)}`
        );
        const res = await getCatalogue(req);
        expect(res.status).toBe(200);

        const json = await res.json();
        expect(json.items.length).toBe(0);
      }
    });

    it("V3.4: SQL injection attempts in 'category' parameter are rejected by Zod enum validation", async () => {
      const sqliPayloads = [
        "pouch' OR '1'='1",
        "pouch'--",
        "' UNION SELECT 1--",
        "admin",
        "SELECT",
      ];

      for (const payload of sqliPayloads) {
        const req = new Request(
          `http://localhost:3000/api/v1/private-label/catalogue?category=${encodeURIComponent(payload)}`
        );
        const res = await getCatalogue(req);
        expect(res.status).toBe(400);

        const json = await res.json();
        expect(json.error).toContain("Invalid catalogue query parameters");
      }
    });

    it("V3.5: Boundary stress testing on 'capacity_min'", async () => {
      // Negative numbers must fail validation
      const negRes = await getCatalogue(
        new Request("http://localhost:3000/api/v1/private-label/catalogue?capacity_min=-1")
      );
      expect(negRes.status).toBe(400);

      const hugeNegRes = await getCatalogue(
        new Request("http://localhost:3000/api/v1/private-label/catalogue?capacity_min=-999999999")
      );
      expect(hugeNegRes.status).toBe(400);

      // Non-numeric must fail validation
      const nonNumRes = await getCatalogue(
        new Request("http://localhost:3000/api/v1/private-label/catalogue?capacity_min=invalid")
      );
      expect(nonNumRes.status).toBe(400);

      // Zero is valid
      const zeroRes = await getCatalogue(
        new Request("http://localhost:3000/api/v1/private-label/catalogue?capacity_min=0")
      );
      expect(zeroRes.status).toBe(200);

      // Extremely large number returns empty list cleanly
      const hugeRes = await getCatalogue(
        new Request("http://localhost:3000/api/v1/private-label/catalogue?capacity_min=999999999")
      );
      expect(hugeRes.status).toBe(200);
      const hugeJson = await hugeRes.json();
      expect(hugeJson.items.length).toBe(0);
      expect(hugeJson.total).toBe(0);

      // Decimal values are supported
      const decRes = await getCatalogue(
        new Request("http://localhost:3000/api/v1/private-label/catalogue?capacity_min=99.5")
      );
      expect(decRes.status).toBe(200);
    });

    it("V3.6: Boundary stress testing on 'capacity_max'", async () => {
      // Negative must fail validation
      const negRes = await getCatalogue(
        new Request("http://localhost:3000/api/v1/private-label/catalogue?capacity_max=-10")
      );
      expect(negRes.status).toBe(400);

      // Zero returns empty results
      const zeroRes = await getCatalogue(
        new Request("http://localhost:3000/api/v1/private-label/catalogue?capacity_max=0")
      );
      expect(zeroRes.status).toBe(200);
      const zeroJson = await zeroRes.json();
      expect(zeroJson.items.length).toBe(0);

      // Inverted range (min > max) returns empty array without error
      const invertedRes = await getCatalogue(
        new Request("http://localhost:3000/api/v1/private-label/catalogue?capacity_min=500&capacity_max=100")
      );
      expect(invertedRes.status).toBe(200);
      const invJson = await invertedRes.json();
      expect(invJson.items.length).toBe(0);
    });

    it("V3.7: Boundary stress testing on 'limit'", async () => {
      // Negative limit
      const negRes = await getCatalogue(
        new Request("http://localhost:3000/api/v1/private-label/catalogue?limit=-1")
      );
      expect(negRes.status).toBe(400);

      // Zero limit (must be min 1)
      const zeroRes = await getCatalogue(
        new Request("http://localhost:3000/api/v1/private-label/catalogue?limit=0")
      );
      expect(zeroRes.status).toBe(400);

      // Exactly min limit (1)
      const minRes = await getCatalogue(
        new Request("http://localhost:3000/api/v1/private-label/catalogue?limit=1")
      );
      expect(minRes.status).toBe(200);
      const minJson = await minRes.json();
      expect(minJson.items.length).toBe(1);
      expect(minJson.limit).toBe(1);

      // Exactly max limit (100)
      const maxRes = await getCatalogue(
        new Request("http://localhost:3000/api/v1/private-label/catalogue?limit=100")
      );
      expect(maxRes.status).toBe(200);
      const maxJson = await maxRes.json();
      expect(maxJson.limit).toBe(100);

      // Exceeds max limit (> 100)
      const overMaxRes = await getCatalogue(
        new Request("http://localhost:3000/api/v1/private-label/catalogue?limit=101")
      );
      expect(overMaxRes.status).toBe(400);

      // Decimal limit
      const decRes = await getCatalogue(
        new Request("http://localhost:3000/api/v1/private-label/catalogue?limit=10.5")
      );
      expect(decRes.status).toBe(400);

      // String limit
      const strRes = await getCatalogue(
        new Request("http://localhost:3000/api/v1/private-label/catalogue?limit=unlimited")
      );
      expect(strRes.status).toBe(400);
    });

    it("V3.8: Boundary stress testing on 'offset'", async () => {
      // Negative offset
      const negRes = await getCatalogue(
        new Request("http://localhost:3000/api/v1/private-label/catalogue?offset=-5")
      );
      expect(negRes.status).toBe(400);

      // Decimal offset
      const decRes = await getCatalogue(
        new Request("http://localhost:3000/api/v1/private-label/catalogue?offset=2.5")
      );
      expect(decRes.status).toBe(400);

      // Massive offset returns empty items cleanly with has_more: false
      const hugeRes = await getCatalogue(
        new Request("http://localhost:3000/api/v1/private-label/catalogue?offset=99999999")
      );
      expect(hugeRes.status).toBe(200);
      const hugeJson = await hugeRes.json();
      expect(hugeJson.items.length).toBe(0);
      expect(hugeJson.has_more).toBe(false);
      expect(hugeJson.offset).toBe(99999999);
    });

    it("V3.9: String length boundary enforcement (max 100 characters)", async () => {
      const str100 = "a".repeat(100);
      const str101 = "a".repeat(101);

      // search length enforcement
      const searchOk = await getCatalogue(
        new Request(`http://localhost:3000/api/v1/private-label/catalogue?search=${str100}`)
      );
      expect(searchOk.status).toBe(200);

      const searchTooLong = await getCatalogue(
        new Request(`http://localhost:3000/api/v1/private-label/catalogue?search=${str101}`)
      );
      expect(searchTooLong.status).toBe(400);

      // q length enforcement
      const qOk = await getCatalogue(
        new Request(`http://localhost:3000/api/v1/private-label/catalogue?q=${str100}`)
      );
      expect(qOk.status).toBe(200);

      const qTooLong = await getCatalogue(
        new Request(`http://localhost:3000/api/v1/private-label/catalogue?q=${str101}`)
      );
      expect(qTooLong.status).toBe(400);

      // material length enforcement
      const matOk = await getCatalogue(
        new Request(`http://localhost:3000/api/v1/private-label/catalogue?material=${str100}`)
      );
      expect(matOk.status).toBe(200);

      const matTooLong = await getCatalogue(
        new Request(`http://localhost:3000/api/v1/private-label/catalogue?material=${str101}`)
      );
      expect(matTooLong.status).toBe(400);
    });

    it("V3.10: Wildcard characters and unicode strings do not break query logic or bypass quarantine", async () => {
      const specialInputs = [
        "%",
        "%%",
        "_",
        "__",
        "🍵",
        "茶",
        "🔥✨",
        "test%20test",
        "\t\n",
      ];

      for (const input of specialInputs) {
        const req = new Request(
          `http://localhost:3000/api/v1/private-label/catalogue?search=${encodeURIComponent(input)}`
        );
        const res = await getCatalogue(req);
        expect(res.status).toBe(200);

        const json = await res.json();
        // Even with wildcards %, draft/archived items MUST NEVER leak
        const draftOrArchived = json.items.find(
          (i: any) =>
            i.slug === "challenger-draft-pouch-variant-001" ||
            i.slug === "challenger-archived-tin-old-002"
        );
        expect(draftOrArchived).toBeUndefined();

        const rawText = JSON.stringify(json);
        for (const token of CONFIDENTIAL_TOKENS) {
          expect(rawText).not.toContain(token);
        }
      }
    });

    it("V3.11: Extreme boundary and special numeric values (Infinity, -Infinity, NaN)", async () => {
      // NaN should be rejected by Zod as invalid number
      const nanRes = await getCatalogue(
        new Request("http://localhost:3000/api/v1/private-label/catalogue?capacity_min=NaN")
      );
      expect(nanRes.status).toBe(400);

      // Infinity is >= 0, returns 200 with 0 items (no grams >= Infinity)
      const infRes = await getCatalogue(
        new Request("http://localhost:3000/api/v1/private-label/catalogue?capacity_min=Infinity")
      );
      expect([200, 400]).toContain(infRes.status);
      if (infRes.status === 200) {
        const json = await infRes.json();
        expect(json.items.length).toBe(0);
      }

      // -Infinity is negative, rejected with 400
      const negInfRes = await getCatalogue(
        new Request("http://localhost:3000/api/v1/private-label/catalogue?capacity_min=-Infinity")
      );
      expect(negInfRes.status).toBe(400);
    });

    it("V3.12: High-concurrency burst (50 parallel requests) maintains 100% data integrity, anti-enumeration, and zero leakage", async () => {
      const probeRequests = Array.from({ length: 50 }, (_, i) => {
        const mode = i % 5;
        if (mode === 0) {
          // Standard public catalogue query
          return getCatalogue(new Request("http://localhost:3000/api/v1/private-label/catalogue?limit=10"));
        } else if (mode === 1) {
          // Sensitive field tampering probe
          return getCatalogue(
            new Request(
              "http://localhost:3000/api/v1/private-label/catalogue?fields=cogs,margin_rate,supplier_name"
            )
          );
        } else if (mode === 2) {
          // Draft SKU anti-enumeration probe on PDP
          return getPackagingDetail(
            new Request(
              "http://localhost:3000/api/v1/private-label/packaging/challenger-draft-pouch-variant-001"
            ),
            { params: Promise.resolve({ slug: "challenger-draft-pouch-variant-001" }) }
          );
        } else if (mode === 3) {
          // Published SKU PDP
          return getPackagingDetail(
            new Request(
              "http://localhost:3000/api/v1/private-label/packaging/challenger-pouch-matte-black-250g"
            ),
            { params: Promise.resolve({ slug: "challenger-pouch-matte-black-250g" }) }
          );
        } else {
          // SQL injection probe
          return getCatalogue(
            new Request("http://localhost:3000/api/v1/private-label/catalogue?search=' OR 1=1 --")
          );
        }
      });

      const responses = await Promise.all(probeRequests);
      expect(responses.length).toBe(50);

      for (let i = 0; i < responses.length; i++) {
        const res = responses[i];
        const mode = i % 5;
        if (mode === 2) {
          // Draft probe must be 404
          expect(res.status).toBe(404);
        } else {
          expect([200, 400]).toContain(res.status);
        }

        const text = await res.text();
        for (const token of CONFIDENTIAL_TOKENS) {
          expect(text).not.toContain(token);
        }
      }
    });
  });
});

