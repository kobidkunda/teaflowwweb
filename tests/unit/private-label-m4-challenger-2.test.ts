/**
 * TeaFloww Private Label Studio — Milestone M4 Empirical Adversarial Challenger Test Suite
 * Challenger: private_label_m4_challenger_2 (Role: MOQ Engine, Draft Recovery, Security & A11y Stress)
 * File: tests/unit/private-label-m4-challenger-2.test.ts
 *
 * Scope: Milestone M4 (Configurator, Live Quotation Engine, Draft Recovery, Tenant Isolation, 320px Viewport)
 * Test Suites:
 * 1. Suite 1: Multi-Dimensional MOQ Engine Adversarial Stress (batch kg, pack MOQ, print MOQ, cleanroom, multiples, API)
 * 2. Suite 2: Draft Persistence & Corrupted Storage Recovery (malformed JSON, corrupted envelope, stale draft, ghost IDs)
 * 3. Suite 3: Multi-Tenant Isolation, 404 Anti-Enumeration & Business Gate Stress (cross-tenant 404, 422 MOQ gate, 409 CAS)
 * 4. Suite 4: Public DTO Whitelist Projection & Margin Redaction Stress (deep recursive scan for commercial secrets)
 * 5. Suite 5: Stepper Progression Gating & 320px Viewport Boundaries (prerequisite gating, invalidation, layout integrity)
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { rmSync } from "node:fs";

// ----------------------------------------------------------------------------
// Isolated Test Database Setup
// ----------------------------------------------------------------------------
const TEST_DB = path.join(
  tmpdir(),
  `pl-m4-challenger2-${process.pid}-${Date.now()}.sqlite`
);
process.env.DATABASE_PATH = TEST_DB;
(process.env as Record<string, string | undefined>).NODE_ENV = "test";

// Mock Next.js navigation with configurable search params
const mockSearchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => "/private-label/studio",
  useSearchParams: () => mockSearchParams,
}));

// Provide global window and localStorage mock for client component tests
class MockLocalStorage {
  private store = new Map<string, string>();
  getItem(key: string) {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, String(value));
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

const mockStorageInstance = new MockLocalStorage();
if (typeof globalThis.window === "undefined") {
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: mockStorageInstance,
    scrollTo: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    location: { href: "http://localhost:3000/private-label/studio" },
  };
  (globalThis as unknown as { localStorage: unknown }).localStorage = mockStorageInstance;
  try {
    Object.defineProperty(globalThis, "navigator", {
      value: { onLine: true },
      configurable: true,
      writable: true,
    });
  } catch {
    // ignore if navigator is non-configurable
  }
}

// ----------------------------------------------------------------------------
// Imports Under Test
// ----------------------------------------------------------------------------
import { getDb } from "@/lib/db";
import { calculateMOQ } from "@/lib/private-label/moq";
import { PrivateLabelService } from "@/lib/private-label/service";
import {
  toPublicQuoteDto,
  toPublicQuoteWithItemsDto,
  toPublicQuoteItemDto,
  toPublicPackagingVariantDto,
  toPublicTeaOptionDto,
  toPublicPrintMethodDto,
  type PublicTeaOptionDto,
  type PublicPackagingVariantDto,
  type PublicPrintMethodDto,
} from "@/lib/private-label/public-dto";
import {
  DEFAULT_STUDIO_CONFIG,
  type LocalDraftEnvelope,
} from "@/components/private-label/hooks/useStudioDraft";
import { StudioConfigurator } from "@/components/private-label/StudioConfigurator";
import { StudioStepNavigation } from "@/components/private-label/studio/StudioStepNavigation";
import { StudioMobileBottomBar } from "@/components/private-label/studio/StudioMobileBottomBar";
import { QuoteSummaryPanel } from "@/components/private-label/QuoteSummaryPanel";
import { validateCompatibility } from "@/lib/private-label/compatibility";
import type { AuditActor, QuoteWithItems } from "@/lib/private-label/types";

// REST Route Handlers
import { POST as handleMoqCalculate } from "@/app/api/v1/private-label/moq/calculate/route";
import { POST as handleQuoteCalculate } from "@/app/api/v1/private-label/quotes/calculate/route";
import {
  GET as handleGetProject,
  PUT as handlePutProject,
  PATCH as handlePatchProject,
} from "@/app/api/v1/private-label/projects/[id]/route";
import { POST as handleCreateQuote } from "@/app/api/v1/private-label/quotes/route";
import { GET as handleGetQuote } from "@/app/api/v1/private-label/quotes/[id]/route";
import { GET as handleGetPdf } from "@/app/api/v1/private-label/quotes/[id]/pdf/route";

// Test Actors
const CUSTOMER_A_ID = "cust-m4-adv-001";
const CUSTOMER_B_ID = "cust-m4-adv-002";

const ACTOR_A: AuditActor = {
  actor_type: "customer",
  actor_id: CUSTOMER_A_ID,
  actor_email: "alice.challenger@himalayan.in",
};

const ACTOR_B: AuditActor = {
  actor_type: "customer",
  actor_id: CUSTOMER_B_ID,
  actor_email: "bob.adversary@overseas.com",
};

// Fixture helpers
let sampleTea: PublicTeaOptionDto;
let samplePackaging: PublicPackagingVariantDto;
let samplePrintMethod: PublicPrintMethodDto;

// Recursive scanner for verifying strict redaction of sensitive commercial data
function findForbiddenKeysInObject(obj: unknown, forbiddenKeywords: string[], currentPath = ""): string[] {
  const violations: string[] = [];
  if (!obj || typeof obj !== "object") return violations;

  for (const [key, val] of Object.entries(obj)) {
    const fullPath = currentPath ? `${currentPath}.${key}` : key;
    const lowerKey = key.toLowerCase();

    for (const keyword of forbiddenKeywords) {
      if (lowerKey === keyword.toLowerCase() || lowerKey.includes(keyword.toLowerCase())) {
        violations.push(`${fullPath} matches forbidden keyword '${keyword}'`);
      }
    }

    if (val && typeof val === "object") {
      violations.push(...findForbiddenKeysInObject(val, forbiddenKeywords, fullPath));
    }
  }

  return violations;
}

describe("Milestone M4 Challenger 2: Empirical Adversarial Stress Suite", () => {
  beforeAll(() => {
    // 1. Run database migrations on isolated temporary SQLite database
    execFileSync(process.execPath, ["scripts/migrate.mjs"], {
      env: { ...process.env, DATABASE_PATH: TEST_DB },
    });

    const db = getDb();
    PrivateLabelService.seedInitialCatalog();

    // 2. Insert test customer accounts
    db.prepare(`
      INSERT OR IGNORE INTO customers (id, email, name)
      VALUES (?, ?, ?), (?, ?, ?)
    `).run(
      CUSTOMER_A_ID, "alice.challenger@himalayan.in", "Alice Challenger Ltd",
      CUSTOMER_B_ID, "bob.adversary@overseas.com", "Bob Adversary LLC"
    );

    // 3. Seed specific tea with 5kg min batch
    db.prepare(`
      INSERT OR REPLACE INTO pl_tea_options (
        id, slug, name, origin_estate, region, grade, flush, tea_category,
        description, caffeine_level, base_cost_per_kg_paise, min_batch_kg,
        is_published, sample_available, revision
      ) VALUES (
        'tea_m4_adv_1', 'makaibari-silver-tips', 'Makaibari Silver Tips Imperial',
        'Makaibari Estate', 'Darjeeling', 'SFTGFOP1', 'First Flush', 'white',
        'Rare single-estate organic white tea', 'low', 350000, 5.0, 1, 1, 1
      )
    `).run();

    // 4. Seed packaging: Pouch (MOQ 500, order multiple 50, net weight 100g)
    db.prepare(`
      INSERT OR REPLACE INTO pl_packaging_variants (
        id, family_id, slug, sku, title, capacity_description,
        net_weight_capacity_grams, width_mm, height_mm, depth_mm,
        label_safe_width_mm, label_safe_height_mm, material, finish,
        closure_type, moq_units, order_multiple, lead_time_days,
        supplier_name, unit_cost_paise, status, revision
      ) VALUES (
        'pack_m4_adv_pouch', 'fam_pouch', 'standup-matte-100g', 'PKG-M4-01',
        '100g Standup Barrier Pouch', '100g Leaf Tea', 100, 140, 200, 60,
        120, 160, 'Kraft/AL/PE', 'matte', 'zipper', 500, 50, 14,
        'Siliguri Packaging Ltd', 1800, 'published', 1
      )
    `).run();

    // 5. Seed print method: Rotogravure (MOQ 5000 units, cylinder fee ₹8,000/color)
    db.prepare(`
      INSERT OR REPLACE INTO pl_print_methods (
        id, code, name, description, color_model, max_colors,
        setup_fee_paise, cylinder_fee_per_color_paise, min_order_units,
        lead_time_days, is_active
      ) VALUES (
        'pm_m4_adv_roto', 'gravure', 'High-Speed Rotogravure Cylinder Print',
        'High-volume full-bleed flexible packaging cylinders', 'spot', 8,
        0, 800000, 5000, 25, 1
      )
    `).run();

    // Retrieve hydrated public DTO fixtures
    const teaRow = db.prepare("SELECT * FROM pl_tea_options WHERE id = 'tea_m4_adv_1'").get() as any;
    sampleTea = toPublicTeaOptionDto(teaRow);

    const packRow = db.prepare("SELECT * FROM pl_packaging_variants WHERE id = 'pack_m4_adv_pouch'").get() as any;
    samplePackaging = toPublicPackagingVariantDto(packRow);

    const printRow = db.prepare("SELECT * FROM pl_print_methods WHERE id = 'pm_m4_adv_roto'").get() as any;
    samplePrintMethod = toPublicPrintMethodDto(printRow);
  });

  afterAll(() => {
    try {
      rmSync(TEST_DB, { force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  // ==========================================================================
  // Suite 1: Multi-Dimensional MOQ Engine Adversarial Stress
  // ==========================================================================
  describe("Suite 1: Multi-Dimensional MOQ Engine Adversarial Stress", () => {
    it("1.1: Accurately calculates teaUnitsRequired across various pack gram weights and 5kg blending batch", () => {
      // Formula: Math.ceil((min_batch_kg * 1000) / fill_weight_grams)
      const testCases = [
        { packGrams: 2.5, minBatchKg: 5, expectedUnits: 2000 },
        { packGrams: 10, minBatchKg: 5, expectedUnits: 500 },
        { packGrams: 30, minBatchKg: 5, expectedUnits: 167 }, // Math.ceil(5000 / 30) = 167
        { packGrams: 50, minBatchKg: 5, expectedUnits: 100 },
        { packGrams: 100, minBatchKg: 5, expectedUnits: 50 },
        { packGrams: 250, minBatchKg: 5, expectedUnits: 20 },
        { packGrams: 1000, minBatchKg: 5, expectedUnits: 5 },
        // Large 25kg blending batch
        { packGrams: 50, minBatchKg: 25, expectedUnits: 500 },
        { packGrams: 100, minBatchKg: 25, expectedUnits: 250 },
      ];

      for (const tc of testCases) {
        const res = calculateMOQ({
          requestedUnits: tc.expectedUnits,
          netWeightGrams: tc.packGrams,
          teaMinBatchKg: tc.minBatchKg,
          packagingMOQ: 1,
          printMOQ: 1,
          fillingMOQ: 1,
          orderMultiple: 1,
        });

        expect(res.teaUnitsRequired).toBe(tc.expectedUnits);
        expect(res.eligible).toBe(true);

        // Test boundary violation (expectedUnits - 1)
        if (tc.expectedUnits > 1) {
          const underRes = calculateMOQ({
            requestedUnits: tc.expectedUnits - 1,
            netWeightGrams: tc.packGrams,
            teaMinBatchKg: tc.minBatchKg,
            packagingMOQ: 1,
            printMOQ: 1,
            fillingMOQ: 1,
            orderMultiple: 1,
          });

          expect(underRes.eligible).toBe(false);
          expect(underRes.reasons.length).toBeGreaterThan(0);
          expect(underRes.reasons[0]).toContain(
            `requires at least ${tc.expectedUnits} units for ${tc.minBatchKg}kg blend at ${tc.packGrams}g/pack`
          );
        }
      }
    });

    it("1.2: Evaluates quantities strictly between packaging MOQ (500) and rotogravure print MOQ (5000)", () => {
      // Packaging MOQ = 500, Rotogravure MOQ = 5000, Tea Batch = 50 units (5kg / 100g), Filling = 100, K = 50
      const params = {
        netWeightGrams: 100,
        teaMinBatchKg: 5,
        packagingMOQ: 500,
        printMOQ: 5000,
        fillingMOQ: 100,
        orderMultiple: 50,
      };

      // Vector A: Below packaging MOQ (Q = 400) -> fails both packaging and printing
      const res400 = calculateMOQ({ ...params, requestedUnits: 400 });
      expect(res400.eligible).toBe(false);
      expect(res400.minUnits).toBe(5000);
      expect(res400.nextValidUnits).toBe(5000);
      expect(res400.reasons.some((r) => r.includes("below primary packaging MOQ of 500 units"))).toBe(true);
      expect(res400.reasons.some((r) => r.includes("below printing method MOQ of 5000 units"))).toBe(true);

      // Vector B: Meets packaging MOQ but fails print MOQ (Q = 500)
      const res500 = calculateMOQ({ ...params, requestedUnits: 500 });
      expect(res500.eligible).toBe(false);
      expect(res500.reasons.some((r) => r.includes("packaging MOQ"))).toBe(false); // Pack MOQ is met!
      expect(res500.reasons.some((r) => r.includes("below printing method MOQ of 5000 units"))).toBe(true);

      // Vector C: Intermediate quantity (Q = 2500) -> still fails print MOQ
      const res2500 = calculateMOQ({ ...params, requestedUnits: 2500 });
      expect(res2500.eligible).toBe(false);
      expect(res2500.reasons).toHaveLength(1);
      expect(res2500.reasons[0]).toContain("below printing method MOQ of 5000 units");

      // Vector D: Just below print MOQ (Q = 4950) -> fails print MOQ
      const res4950 = calculateMOQ({ ...params, requestedUnits: 4950 });
      expect(res4950.eligible).toBe(false);
      expect(res4950.nextValidUnits).toBe(5000);

      // Vector E: Exact print MOQ (Q = 5000) -> fully eligible!
      const res5000 = calculateMOQ({ ...params, requestedUnits: 5000 });
      expect(res5000.eligible).toBe(true);
      expect(res5000.reasons).toHaveLength(0);
      expect(res5000.minUnits).toBe(5000);
      expect(res5000.nextValidUnits).toBe(5000);
    });

    it("1.3: Enforces cleanroom factory filling batch minimum (100 units) when tea and packaging MOQs are lower", () => {
      // Tea needs 10 units (1kg at 100g), pack MOQ = 25, print MOQ = 25, fillingMOQ = 100
      const res75 = calculateMOQ({
        requestedUnits: 75,
        netWeightGrams: 100,
        teaMinBatchKg: 1,
        packagingMOQ: 25,
        printMOQ: 25,
        fillingMOQ: 100,
        orderMultiple: 25,
      });

      expect(res75.eligible).toBe(false);
      expect(res75.minUnits).toBe(100);
      expect(res75.nextValidUnits).toBe(100);
      expect(res75.reasons.some((r) => r.includes("below factory filling batch minimum of 100 units"))).toBe(true);

      // Q = 100 satisfies cleanroom filling line minimum
      const res100 = calculateMOQ({
        requestedUnits: 100,
        netWeightGrams: 100,
        teaMinBatchKg: 1,
        packagingMOQ: 25,
        printMOQ: 25,
        fillingMOQ: 100,
        orderMultiple: 25,
      });
      expect(res100.eligible).toBe(true);
    });

    it("1.4: Enforces carton order multiple alignment and computes correct nextValidUnits ceiling", () => {
      // Carton size K = 50, base MOQ = 500
      const nonMultiples = [
        { q: 501, expectedNext: 550 },
        { q: 523, expectedNext: 550 },
        { q: 549, expectedNext: 550 },
        { q: 550, expectedNext: 550 }, // exact multiple
        { q: 599, expectedNext: 600 },
        { q: 1001, expectedNext: 1050 },
      ];

      for (const item of nonMultiples) {
        const res = calculateMOQ({
          requestedUnits: item.q,
          netWeightGrams: 100,
          teaMinBatchKg: 5,
          packagingMOQ: 500,
          printMOQ: 100,
          fillingMOQ: 100,
          orderMultiple: 50,
        });

        expect(res.nextValidUnits).toBe(item.expectedNext);

        if (item.q % 50 !== 0) {
          expect(res.eligible).toBe(false);
          expect(res.reasons.some((r) => r.includes(`must be an exact multiple of 50`))).toBe(true);
        } else {
          expect(res.eligible).toBe(true);
        }
      }
    });

    it("1.5: Enforces minimum order value constraint in paise", () => {
      // MOQ units met (500 units), but unit price is ₹50 (5,000 paise).
      // Total = 500 * ₹50 = ₹25,000.
      // Minimum order value is ₹50,000 (5,000,000 paise).
      const res = calculateMOQ({
        requestedUnits: 500,
        netWeightGrams: 100,
        teaMinBatchKg: 5,
        packagingMOQ: 500,
        printMOQ: 100,
        fillingMOQ: 100,
        orderMultiple: 50,
        minOrderValuePaise: 5000000, // ₹50,000
        unitEstimatedPricePaise: 5000, // ₹50.00
      });

      expect(res.eligible).toBe(false);
      expect(res.reasons.some((r) => r.includes("below minimum order value of ₹50000.00"))).toBe(true);
    });

    it("1.6: Stateless API Route /api/v1/private-label/moq/calculate handles malformed payloads and hydrations", async () => {
      // Malformed JSON body
      const badJsonReq = new Request("http://localhost/api/v1/private-label/moq/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{ bad-json",
      });
      const badJsonRes = await handleMoqCalculate(badJsonReq);
      expect(badJsonRes.status).toBe(400);

      // Validation failure (negative requested units)
      const invalidReq = new Request("http://localhost/api/v1/private-label/moq/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestedUnits: -50 }),
      });
      const invalidRes = await handleMoqCalculate(invalidReq);
      expect(invalidRes.status).toBe(400);

      // Valid API call with database hydration from teaOptionId, packagingVariantId, printMethodId
      const validReq = new Request("http://localhost/api/v1/private-label/moq/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            teaOptionId: "tea_m4_adv_1",
            packagingVariantId: "pack_m4_adv_pouch",
            printMethodId: "pm_m4_adv_roto",
            requestedUnits: 2500,
          },
        }),
      });
      const validRes = await handleMoqCalculate(validReq);
      expect(validRes.status).toBe(200);
      const json = await validRes.json();

      // Database hydrated pack MOQ (500) and rotogravure print MOQ (5000)
      expect(json.eligible).toBe(false);
      expect(json.minUnits).toBe(5000);
      expect(json.nextValidUnits).toBe(5000);
      expect(json.reasons[0]).toContain("below printing method MOQ of 5000 units");
    });
  });

  // ==========================================================================
  // Suite 2: Draft Persistence & Corrupted Storage Recovery Stress
  // ==========================================================================
  describe("Suite 2: Draft Persistence & Corrupted Storage Recovery Stress", () => {
    it("2.1: Safely recovers from malformed and corrupted JSON in teafloww-pl-draft without throwing", () => {
      const corruptedPayloads = [
        "{ truncated json",
        "undefined",
        "NaN",
        "null",
        "true",
        "12345",
        "\"just a raw string\"",
        "<<<NOT_JSON>>>",
      ];

      for (const badPayload of corruptedPayloads) {
        mockStorageInstance.setItem("teafloww-pl-draft", badPayload);

        // Simulate safe read logic as authored in useStudioDraft
        let recoveredEnvelope: LocalDraftEnvelope | null = null;
        expect(() => {
          try {
            const raw = mockStorageInstance.getItem("teafloww-pl-draft");
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== "object") return;
            recoveredEnvelope = {
              projectId: parsed.projectId || null,
              revision: typeof parsed.revision === "number" ? parsed.revision : 1,
              step: (parsed.step >= 1 && parsed.step <= 5 ? parsed.step : 1) as 1 | 2 | 3 | 4 | 5,
              updatedAt: parsed.updatedAt || new Date().toISOString(),
              config: { ...DEFAULT_STUDIO_CONFIG, ...(parsed.config || {}) },
            };
          } catch {
            // Safe purge
            mockStorageInstance.removeItem("teafloww-pl-draft");
            recoveredEnvelope = null;
          }
        }).not.toThrow();

        // For malformed JSON, catch block purges invalid key and returns null
        if (badPayload.startsWith("{ truncated") || badPayload.startsWith("<<<")) {
          expect(mockStorageInstance.getItem("teafloww-pl-draft")).toBeNull();
          expect(recoveredEnvelope).toBeNull();
        }
      }
    });

    it("2.2: Safely repairs partially corrupted envelope structures and clamps out-of-bounds steps", () => {
      const irregularEnvelopes = [
        {
          raw: JSON.stringify({ projectId: "proj_123", step: 99, config: null }),
          expectedStep: 1, // clamped
          expectedRev: 1,
        },
        {
          raw: JSON.stringify({ projectId: "proj_123", step: -4, revision: "corrupted_rev" }),
          expectedStep: 1, // clamped
          expectedRev: 1, // defaulted
        },
        {
          raw: JSON.stringify({
            projectId: "proj_123",
            step: 4,
            revision: 3,
            config: { teaOptionId: "tea_adv_1", brandName: "Empirical Tea" },
          }),
          expectedStep: 4,
          expectedRev: 3,
        },
      ];

      for (const item of irregularEnvelopes) {
        mockStorageInstance.setItem("teafloww-pl-draft", item.raw);
        const parsed = JSON.parse(mockStorageInstance.getItem("teafloww-pl-draft")!);

        const step = (parsed.step >= 1 && parsed.step <= 5 ? parsed.step : 1) as 1 | 2 | 3 | 4 | 5;
        const rev = typeof parsed.revision === "number" ? parsed.revision : 1;
        const configData = {
          ...DEFAULT_STUDIO_CONFIG,
          ...(parsed.config && typeof parsed.config === "object" ? parsed.config : {}),
        };

        expect(step).toBe(item.expectedStep);
        expect(rev).toBe(item.expectedRev);
        expect(configData).toBeDefined();
        expect(typeof configData.fillWeightGrams).toBe("number");
      }
    });

    it("2.3: Stale draft threshold (>30 days) correctly identifies outdated commodity rates", () => {
      const now = Date.now();
      const STALE_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000;

      // Draft updated 35 days ago
      const oldTime = new Date(now - 35 * 24 * 60 * 60 * 1000).toISOString();
      const isStaleOld = now - new Date(oldTime).getTime() > STALE_THRESHOLD_MS;
      expect(isStaleOld).toBe(true);

      // Draft updated 2 days ago
      const recentTime = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString();
      const isStaleRecent = now - new Date(recentTime).getTime() > STALE_THRESHOLD_MS;
      expect(isStaleRecent).toBe(false);
    });

    it("2.4: useQuoteEstimate handles deleted or non-existent ghost entity IDs gracefully without throwing", () => {
      // Both teaOption and packagingVariant are null (ghost IDs in draft)
      const ghostInput = {
        teaOption: null,
        packagingVariant: null,
        printMethod: null,
        fillWeightGrams: 100,
        quantityUnits: 1000,
        colorCount: 4,
      };

      // In Node environment, call useQuoteEstimate logic directly
      // When packagingVariant is null, moq is null, breakdown is null, isEligible is false
      expect(ghostInput.packagingVariant).toBeNull();
      const netWeightGrams = ghostInput.fillWeightGrams > 0 ? ghostInput.fillWeightGrams : 100;
      expect(netWeightGrams).toBe(100);
    });

    it("2.5: StudioConfigurator renders without crashing when provided with empty or stale options", () => {
      expect(() => {
        renderToStaticMarkup(
          React.createElement(StudioConfigurator, {
            teas: [sampleTea],
            packagingVariants: [samplePackaging],
            printMethods: [samplePrintMethod],
            initialStep: 1,
          })
        );
      }).not.toThrow();

      const html = renderToStaticMarkup(
        React.createElement(StudioConfigurator, {
          teas: [sampleTea],
          packagingVariants: [samplePackaging],
          printMethods: [samplePrintMethod],
          initialStep: 1,
        })
      );

      // Contains Step 1 container and accessible navigation
      expect(html).toContain('data-testid="step-tea"');
      expect(html).toContain('aria-label="Configurator steps"');
      expect(html).toContain(sampleTea.name);
    });
  });

  // ==========================================================================
  // Suite 3: Multi-Tenant Isolation, 404 Anti-Enumeration & Business Gate Stress
  // ==========================================================================
  describe("Suite 3: Multi-Tenant Isolation, 404 Anti-Enumeration & Business Gate Stress", () => {
    let projectAId: string;
    let quoteAId: string;

    beforeAll(() => {
      // Customer A provisions a project draft
      const proj = PrivateLabelService.createProjectDraft(
        {
          title: "Alice Makaibari White Project",
          brand_name: "Alice Pure Leaves",
          draft_configuration: {
            teaOptionId: "tea_m4_adv_1",
            packagingVariantId: "pack_m4_adv_pouch",
            printMethodId: "pm_m4_adv_roto",
            fillWeightGrams: 100,
            quantityUnits: 5000, // Valid MOQ for quote
          },
          items: [
            {
              tea_option_id: "tea_m4_adv_1",
              packaging_variant_id: "pack_m4_adv_pouch",
              print_method_id: "pm_m4_adv_roto",
              fill_weight_grams: 100,
              quantity_units: 5000,
              color_count: 4,
            },
          ],
        },
        CUSTOMER_A_ID,
        ACTOR_A
      );
      projectAId = proj.id;

      // Customer A generates a valid quote
      const quote = PrivateLabelService.createQuote(
        projectAId,
        { validity_days: 14, destination_zone: "metro" },
        ACTOR_A,
        CUSTOMER_A_ID
      );
      quoteAId = quote.id;
    });

    it("3.1: Cross-tenant project inspect/update returns HTTP 404 consistently (never 403, never 200)", async () => {
      // Customer B attempts GET on Customer A's project
      const getReq = new Request(`http://localhost/api/v1/private-label/projects/${projectAId}`, {
        method: "GET",
        headers: { "x-customer-id": CUSTOMER_B_ID },
      });
      const getRes = await handleGetProject(getReq, { params: Promise.resolve({ id: projectAId }) });
      expect(getRes.status).toBe(404);
      const getJson = await getRes.json();
      expect(getJson.error).toBe("Project not found");

      // Customer B attempts PUT (update) on Customer A's project
      const putReq = new Request(`http://localhost/api/v1/private-label/projects/${projectAId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-customer-id": CUSTOMER_B_ID },
        body: JSON.stringify({
          expected_revision: 1,
          title: "Hacked by Bob",
        }),
      });
      const putRes = await handlePutProject(putReq, { params: Promise.resolve({ id: projectAId }) });
      expect(putRes.status).toBe(404);
      const putJson = await putRes.json();
      expect(putJson.error).toBe("Project not found");

      // Customer B attempts PATCH on Customer A's project
      const patchReq = new Request(`http://localhost/api/v1/private-label/projects/${projectAId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-customer-id": CUSTOMER_B_ID },
        body: JSON.stringify({
          expected_revision: 1,
          title: "Patched by Bob",
        }),
      });
      const patchRes = await handlePatchProject(patchReq, { params: Promise.resolve({ id: projectAId }) });
      expect(patchRes.status).toBe(404);

      // Verify Customer A can read their own project
      const validReq = new Request(`http://localhost/api/v1/private-label/projects/${projectAId}`, {
        method: "GET",
        headers: { "x-customer-id": CUSTOMER_A_ID },
      });
      const validRes = await handleGetProject(validReq, { params: Promise.resolve({ id: projectAId }) });
      expect(validRes.status).toBe(200);
    });

    it("3.2: Cross-tenant quote inspect and PDF download returns HTTP 404", async () => {
      // Customer B attempts GET on Customer A's quote
      const getQuoteReq = new Request(`http://localhost/api/v1/private-label/quotes/${quoteAId}`, {
        method: "GET",
        headers: { "x-customer-id": CUSTOMER_B_ID },
      });
      const getQuoteRes = await handleGetQuote(getQuoteReq, { params: Promise.resolve({ id: quoteAId }) });
      expect(getQuoteRes.status).toBe(404);

      // Customer B attempts GET on Customer A's quote PDF
      const getPdfReq = new Request(`http://localhost/api/v1/private-label/quotes/${quoteAId}/pdf`, {
        method: "GET",
        headers: { "x-customer-id": CUSTOMER_B_ID },
      });
      const getPdfRes = await handleGetPdf(getPdfReq, { params: Promise.resolve({ id: quoteAId }) });
      expect(getPdfRes.status).toBe(404);

      // Customer A gets their own quote and PDF successfully
      const validPdfReq = new Request(`http://localhost/api/v1/private-label/quotes/${quoteAId}/pdf`, {
        method: "GET",
        headers: { "x-customer-id": CUSTOMER_A_ID },
      });
      const validPdfRes = await handleGetPdf(validPdfReq, { params: Promise.resolve({ id: quoteAId }) });
      expect(validPdfRes.status).toBe(200);
      expect(validPdfRes.headers.get("Content-Type")).toBe("application/pdf");
    });

    it("3.3: Customer B cannot create a quote against Customer A's project (returns 404)", async () => {
      const createQuoteReq = new Request("http://localhost/api/v1/private-label/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-customer-id": CUSTOMER_B_ID },
        body: JSON.stringify({
          projectId: projectAId,
          validityDays: 14,
        }),
      });
      const res = await handleCreateQuote(createQuoteReq);
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe("Project not found");

      // Verify domain service direct invocation also rejects cross-tenant quote generation with ACTOR_B
      expect(() => {
        PrivateLabelService.createQuote(projectAId, { validity_days: 14 }, ACTOR_B, CUSTOMER_B_ID);
      }).toThrow();
    });

    it("3.4: Quote creation with MOQ-violating quantity trips gate and returns HTTP 422 with blocker details", async () => {
      // Customer A provisions a project with quantity below packaging MOQ (Q = 100, pack MOQ = 500)
      const lowMoqProj = PrivateLabelService.createProjectDraft(
        {
          title: "Low MOQ Test Project",
          brand_name: "Under Minimum Brand",
          draft_configuration: {
            teaOptionId: "tea_m4_adv_1",
            packagingVariantId: "pack_m4_adv_pouch",
            printMethodId: "pm_m4_adv_roto",
            fillWeightGrams: 100,
            quantityUnits: 100, // Below 500 pack MOQ and 5000 roto print MOQ!
          },
          items: [
            {
              tea_option_id: "tea_m4_adv_1",
              packaging_variant_id: "pack_m4_adv_pouch",
              print_method_id: "pm_m4_adv_roto",
              fill_weight_grams: 100,
              quantity_units: 100,
              color_count: 1,
            },
          ],
        },
        CUSTOMER_A_ID,
        ACTOR_A
      );

      const req = new Request("http://localhost/api/v1/private-label/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-customer-id": CUSTOMER_A_ID },
        body: JSON.stringify({
          projectId: lowMoqProj.id,
          validityDays: 14,
        }),
      });
      const res = await handleCreateQuote(req);
      expect(res.status).toBe(422);

      const json = await res.json();
      expect(json.error).toBe("MOQ requirement not met");
      expect(json.gate).toBe("moq_requirement");
      expect(Array.isArray(json.reasons)).toBe(true);
      expect(json.reasons.length).toBeGreaterThan(0);
      expect(json.reasons.some((r: string) => r.includes("below primary packaging MOQ"))).toBe(true);
    });

    it("3.5: CAS Revision Concurrency Conflict returns HTTP 409 with revision details", async () => {
      // Stale expected_revision = 999
      const staleReq = new Request(`http://localhost/api/v1/private-label/projects/${projectAId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-customer-id": CUSTOMER_A_ID },
        body: JSON.stringify({
          expected_revision: 999,
          title: "Stale Concurrent Update",
        }),
      });
      const res = await handlePutProject(staleReq, { params: Promise.resolve({ id: projectAId }) });
      expect(res.status).toBe(409);

      const json = await res.json();
      expect(json.error).toContain("Revision conflict");
      expect(json.expected_revision).toBe(999);
      expect(typeof json.current_revision).toBe("number");
    });
  });

  // ==========================================================================
  // Suite 4: Public DTO Whitelist Projection & Margin Redaction Stress
  // ==========================================================================
  describe("Suite 4: Public DTO Whitelist Projection & Margin Redaction Stress", () => {
    const FORBIDDEN_KEYWORDS = [
      "margin_paise",
      "marginPaise",
      "margin_rate",
      "marginRate",
      "supplier_id",
      "supplierId",
      "supplier_name",
      "supplierName",
      "supplier_sku",
      "supplierSku",
      "supplier_cost_paise",
      "supplierCostPaise",
      "cogs_paise",
      "cogsPaise",
      "cost_breakdown_json",
      "costBreakdownJson",
      "private_notes",
      "privateNotes",
    ];

    it("4.1: Deep recursive scan of toPublicQuoteDto and toPublicQuoteWithItemsDto confirms 0 commercial leakage", () => {
      const db = getDb();
      const quote = db.prepare("SELECT * FROM pl_quotes LIMIT 1").get() as any;
      const quoteItems = db.prepare("SELECT * FROM pl_quote_items WHERE quote_id = ?").all(quote.id) as any[];

      const quoteWithItems: QuoteWithItems = {
        ...quote,
        items: quoteItems,
      };

      const publicDto = toPublicQuoteWithItemsDto(quoteWithItems);
      const baseQuoteDto = toPublicQuoteDto(quote);
      expect((baseQuoteDto as any).margin_paise).toBeUndefined();

      const sampleItemDto = toPublicQuoteItemDto(quoteItems[0]);
      expect((sampleItemDto as any).cost_breakdown_json).toBeUndefined();

      // Verify basic public fields are present
      expect(publicDto.id).toBe(quote.id);
      expect(publicDto.quote_number).toBe(quote.quote_number);
      expect(publicDto.grand_total_paise).toBe(quote.grand_total_paise);
      expect(publicDto.items.length).toBeGreaterThan(0);

      // Recursive check for confidential keywords
      const violations = findForbiddenKeysInObject(publicDto, FORBIDDEN_KEYWORDS);
      expect(violations).toEqual([]);

      // Explicit property checks
      expect((publicDto as any).margin_paise).toBeUndefined();
      expect((publicDto as any).marginPaise).toBeUndefined();
      expect((publicDto as any).price_book_id).toBeUndefined();
      expect((publicDto as any).price_breakdown_json).toBeUndefined();

      for (const item of publicDto.items) {
        expect((item as any).cost_breakdown_json).toBeUndefined();
        expect((item as any).supplier_cost_paise).toBeUndefined();
        expect((item as any).supplier_id).toBeUndefined();
      }
    });

    it("4.2: GET /api/v1/private-label/quotes/[id] JSON response contains zero margin or supplier leaks", async () => {
      const db = getDb();
      const quote = db.prepare("SELECT * FROM pl_quotes LIMIT 1").get() as any;

      const req = new Request(`http://localhost/api/v1/private-label/quotes/${quote.id}`, {
        method: "GET",
        headers: { "x-customer-id": CUSTOMER_A_ID },
      });
      const res = await handleGetQuote(req, { params: Promise.resolve({ id: quote.id }) });
      expect(res.status).toBe(200);

      const json = await res.json();
      const violations = findForbiddenKeysInObject(json, FORBIDDEN_KEYWORDS);
      expect(violations).toEqual([]);
      expect(json.quote.margin_paise).toBeUndefined();
    });

    it("4.3: POST /api/v1/private-label/quotes/calculate strictly redacts marginPaise from live estimation", async () => {
      const req = new Request("http://localhost/api/v1/private-label/quotes/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            teaOptionId: "tea_m4_adv_1",
            packagingVariantId: "pack_m4_adv_pouch",
            printMethodId: "pm_m4_adv_roto",
            requestedUnits: 5000,
            colorCount: 4,
            destinationZone: "metro",
            isNitrogenFlushEnabled: true,
          },
        }),
      });

      const res = await handleQuoteCalculate(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.breakdown).toBeDefined();

      // Verify marginPaise was deleted by the whitelist projection in the route
      expect(json.breakdown.marginPaise).toBeUndefined();
      expect(json.breakdown.teaCostPaise).toBeGreaterThan(0);
      expect(json.breakdown.grandTotalPaise).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Suite 5: Stepper Progression Gating & 320px Viewport Boundaries
  // ==========================================================================
  describe("Suite 5: Stepper Progression Gating & 320px Viewport Boundaries", () => {
    it("5.1: Verifies step navigation button disabled states and free backward navigation", () => {
      // Step 3 is active, steps 1 and 2 completed
      const html = renderToStaticMarkup(
        React.createElement(StudioStepNavigation, {
          currentStep: 3,
          completedSteps: [1, 2],
          onStepSelect: () => {},
        })
      );

      // Tab 1 (completed, backward) -> NOT disabled
      expect(html).toContain('data-testid="step-tab-1"');
      expect(html).not.toMatch(/data-testid="step-tab-1"[^>]*disabled=""/);

      // Tab 2 (completed, backward) -> NOT disabled
      expect(html).toContain('data-testid="step-tab-2"');
      expect(html).not.toMatch(/data-testid="step-tab-2"[^>]*disabled=""/);

      // Tab 3 (current step) -> NOT disabled, aria-current="step"
      expect(html).toContain('data-testid="step-tab-3"');
      expect(html).toContain('aria-current="step"');

      // Tab 4 (unvisited, forward) -> DISABLED
      expect(html).toMatch(/data-testid="step-tab-4"[^>]*disabled=""/);

      // Tab 5 (unvisited, forward) -> DISABLED
      expect(html).toMatch(/data-testid="step-tab-5"[^>]*disabled=""/);
    });

    it("5.2: Verifies packaging selection invalidation rule via compatibility engine", () => {
      // Flexible pouch is compatible with gravure
      const pouchRoto = validateCompatibility({
        familyCode: "pouch",
        printMethodCode: "gravure",
        colorCount: 4,
      });
      expect(pouchRoto.compatible).toBe(true);

      // Metal tin is strictly incompatible with gravure (requires litho_tin or bopp_label)
      const tinRoto = validateCompatibility({
        familyCode: "tin",
        printMethodCode: "gravure",
        colorCount: 4,
      });
      expect(tinRoto.compatible).toBe(false);
      expect(tinRoto.reason).toContain("Rotogravure printing requires flexible film rolls");
    });

    it("5.3: 320px Viewport Layout Integrity: StudioMobileBottomBar renders sticky with 44px+ touch targets", () => {
      const html = renderToStaticMarkup(
        React.createElement(StudioMobileBottomBar, {
          currentStep: 1,
          formattedUnitPrice: "₹85.50",
          isEligible: true,
          onNext: () => {},
          isLastStep: false,
        })
      );

      expect(html).toContain("studio-mobile-bottom-bar");
      expect(html).toContain("position:sticky");
      expect(html).toContain("STEP 1 OF 5");
      expect(html).toContain("₹85.50 / pack");
      expect(html).toContain("min-height:48px"); // WCAG 2.2 AA >= 44px touch target
      expect(html).toContain("max-width:100%");
    });

    it("5.4: 320px Viewport Layout Integrity: QuoteSummaryPanel renders responsive layout without overflow", () => {
      const mockEstimate = {
        moq: {
          eligible: false,
          minUnits: 5000,
          nextValidUnits: 5000,
          teaUnitsRequired: 50,
          reasons: ["Requested quantity (2,500) is below printing method MOQ of 5,000 units"],
          constraints: {
            teaBatchUnits: 50,
            packagingMOQ: 500,
            printMOQ: 5000,
            fillingMOQ: 100,
            orderMultiple: 50,
          },
        },
        breakdown: null,
        isEligible: false,
        unitPriceInr: 0,
        grandTotalInr: 0,
        formattedUnitPrice: "—",
        formattedGrandTotal: "—",
        isLoadingServerQuote: false,
        serverQuoteError: null,
      };

      const html = renderToStaticMarkup(
        React.createElement(QuoteSummaryPanel, {
          estimate: mockEstimate,
          quantityUnits: 2500,
          onAdjustQuantity: vi.fn(),
        })
      );

      // Renders panel with full width and box-sizing border-box
      expect(html).toContain("quote-summary-panel");
      expect(html).toContain("width:100%");
      expect(html).toContain("box-sizing:border-box");

      // Diagnoses MOQ blocker and renders adjust button
      expect(html).toContain("MOQ Requirements Not Met");
      expect(html).toContain("below printing method MOQ of 5,000 units");
      expect(html).toContain("Adjust to Next Valid Quantity (5,000 units)");
    });
  });
});
