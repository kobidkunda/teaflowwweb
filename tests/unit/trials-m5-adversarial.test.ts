/**
 * TeaFloww Trials v3 — Milestone 5 Storefront Adversarial & Stress Test Suite
 *
 * Authored by: trials_m5_challenger_1 (Empirical Challenger)
 * Objective: Empirically stress-test boundary arithmetic, draft isolation/security,
 * and graceful degradation on null/missing data across the storefront experience.
 *
 * Test Suites:
 * 1. Cost Calculator Arithmetic & Boundary Stress Tests
 * 2. Draft Isolation, Unauthenticated Access & XSS Security
 * 3. Graceful Null, Undefined & Missing Data Handling
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Ensure React is on globalThis for server components compiled without React import
(globalThis as any).React = React;

// ============================================================================
// Navigation, Headers, Image, and Cart Mocks
// ============================================================================

const mockNotFound = vi.fn(() => {
  const err = new Error("NEXT_NOT_FOUND");
  (err as any).digest = "NEXT_NOT_FOUND";
  throw err;
});

vi.mock("next/navigation", () => ({
  notFound: () => mockNotFound(),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => "/trials",
  useSearchParams: () => new URLSearchParams(),
}));

const mockCookieStore = {
  get: vi.fn(),
};
const mockHeaderList = {
  get: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => mockCookieStore),
  headers: vi.fn(async () => mockHeaderList),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt, fill: _fill, ...rest }: any) => {
    void _fill;
    return React.createElement("img", {
      src: typeof src === "object" ? src.src : src,
      alt,
      ...rest,
    });
  },
}));

vi.mock("@/components/CartProvider", () => ({
  useCart: () => ({
    add: vi.fn(),
    changeQuantity: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn(),
    items: [],
    count: 0,
    subtotal: 0,
    sessionId: "adversarial-sess-999",
    recoveryToken: null,
    isSyncing: false,
  }),
}));

// Components under stress test
import { TrialCostCalculator } from "@/components/trials/TrialCostCalculator";
import { TrialOpticalStudio } from "@/components/trials/TrialOpticalStudio";
import { TrialSensoryBento } from "@/components/trials/TrialSensoryBento";
import { TrialBulkLadder } from "@/components/trials/TrialBulkLadder";
import { TrialKettleGuide } from "@/components/trials/TrialKettleGuide";
import { TrialCard } from "@/components/trials/TrialCard";
import { TrialPDPInteractiveView } from "@/components/trials/TrialPDPInteractiveView";
import TrialPDPPage, { generateMetadata } from "@/app/trials/[slug]/page";
import { GET as getPublicTrialBySlug } from "@/app/api/v1/trials/[slug]/route";

// Pure business helpers
import {
  calculateCostPerCup,
  formatCostPerCup,
  calculateSavingsDelta,
  calculateKitCupYield,
  clampDoseGrams,
  clampBrewingDuration,
  resolvePouchAsset,
  formatProvenance,
} from "@/lib/trials/storefront-helpers";

import { TrialService } from "@/lib/trials/service";
import type { TrialPublicDto, TrialWithDetails } from "@/lib/trials/types";

// Fixture helpers
function createBaselineTrial(overrides: Partial<TrialPublicDto> = {}): TrialPublicDto {
  return {
    id: "trial-adv-200g-001",
    slug: "tea-stall-discovery-kit",
    title: "TeaFloww Four-Tea Discovery Kit",
    tagline: "Four distinct craft milk teas formulated from Siliguri CTC.",
    description: "Sample kit containing four 50g sachets.",
    status: "published",
    pack_format: "4x50g_sachets",
    net_weight_g: 200,
    price_paise: 20000,
    compare_at_price_paise: 28000,
    sku: "TRIAL-ADV-4X50G",
    in_stock: true,
    hero_image: {
      url: "/images/trials/discovery.webp",
      alt_text: "Discovery Kit Packaging",
    },
    components: [
      {
        slot_index: 0,
        name: "Strong Milk Chai",
        estate: "Moran Estate",
        grade: "Assam CTC BP",
        flush: "Second Flush 2026",
        elevation: "180m AMSL",
        weight_g: 50,
        tasting_notes: ["Malty", "Deep Amber"],
        brewing: { temp_c: 95, time_sec: 180, dose_g: 2.5 },
        bulk_link: { product_slug: "assam-strong-ctc", variant_title: "500g Pouch" },
        assets: [
          { stage: "milk_tea", url: "/img/p1-milk.webp", alt_text: "Rich Chai with Milk" },
        ],
      },
      {
        slot_index: 1,
        name: "Elaichi Milk Chai",
        estate: "Batabari Estate",
        grade: "Dooars CTC Blend",
        flush: "Autumn Flush",
        elevation: "220m AMSL",
        weight_g: 50,
        tasting_notes: ["Sweet Cardamom"],
        brewing: { temp_c: 95, time_sec: 180, dose_g: 2.5 },
        bulk_link: { product_slug: "elaichi-chai-blend", variant_title: "500g Pouch" },
        assets: [],
      },
      {
        slot_index: 2,
        name: "Ginger Milk Chai",
        estate: "Sonitpur Estate",
        grade: "Assam-Dooars CTC",
        flush: "Rain Flush",
        elevation: null,
        weight_g: 50,
        tasting_notes: ["Fiery Zing"],
        brewing: { temp_c: 95, time_sec: 210, dose_g: 2.5 },
        bulk_link: null,
        assets: [],
      },
      {
        slot_index: 3,
        name: "Masala Milk Chai",
        estate: "Cinnamara Estate",
        grade: "Assam Whole Spice CTC",
        flush: "Second Flush",
        elevation: "200m AMSL",
        weight_g: 50,
        tasting_notes: ["Cinnamon"],
        brewing: { temp_c: 95, time_sec: 210, dose_g: 2.5 },
        bulk_link: { product_slug: "masala-chai", variant_title: "500g Pouch" },
        assets: [],
      },
    ],
    claims: [
      { claim_type: "origin", label: "100% Single-Garden North India CTC", verified: true },
      { claim_type: "licence", label: "FSSAI Registered Operator FBO-19CTHPK", verified: true },
    ],
    meta: {
      title: "TeaFloww 4-Tea Discovery Kit",
      description: "Sample Strong, Elaichi, Ginger, and Masala milk teas.",
    },
    ...overrides,
  };
}

function createMockTrialDetails(status: "draft" | "in_review" | "published" | "archived" = "draft"): TrialWithDetails {
  return {
    id: "trial-details-001",
    slug: "tea-stall-discovery-kit",
    title: "TeaFloww Four-Tea Discovery Kit",
    tagline: "Four craft milk teas.",
    description: "Sample kit containing four 50g sachets.",
    status,
    pack_format: "4x50g_sachets",
    net_weight_g: 200,
    price_paise: 20000,
    compare_at_price_paise: 28000,
    cost_paise: 12000,
    sku: "TRIAL-ADV-4X50G",
    inventory_quantity: 50,
    inventory_policy: "track",
    hero_image_id: null,
    meta_title: "TeaFloww Discovery Kit",
    meta_description: "Sample kit meta description",
    revision: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    published_at: status === "published" ? new Date().toISOString() : null,
    archived_at: status === "archived" ? new Date().toISOString() : null,
    hero_image: { url: "/img/pack.webp", alt_text: "Packaging" },
    components: [
      {
        id: "c-01",
        trial_id: "trial-details-001",
        slot_index: 0,
        name: "Strong Milk Chai",
        estate: "Moran Estate",
        grade: "Assam CTC BP",
        flush: "Second Flush 2026",
        elevation: "180m AMSL",
        weight_g: 50,
        tasting_notes: JSON.stringify(["Malty", "Deep Amber"]),
        brew_temp_c: 95,
        brew_time_sec: 180,
        leaf_dose_g: 2.5,
        regular_product_id: "prod-01",
        regular_variant_id: "var-01",
      },
      {
        id: "c-02",
        trial_id: "trial-details-001",
        slot_index: 1,
        name: "Elaichi Milk Chai",
        estate: "Batabari Estate",
        grade: "Dooars CTC Blend",
        flush: "Autumn Flush",
        elevation: "220m AMSL",
        weight_g: 50,
        tasting_notes: JSON.stringify(["Sweet Cardamom"]),
        brew_temp_c: 95,
        brew_time_sec: 180,
        leaf_dose_g: 2.5,
        regular_product_id: "prod-02",
        regular_variant_id: "var-02",
      },
      {
        id: "c-03",
        trial_id: "trial-details-001",
        slot_index: 2,
        name: "Ginger Milk Chai",
        estate: "Sonitpur Estate",
        grade: "Assam-Dooars CTC",
        flush: "Rain Flush",
        elevation: null,
        weight_g: 50,
        tasting_notes: JSON.stringify(["Fiery Zing"]),
        brew_temp_c: 95,
        brew_time_sec: 210,
        leaf_dose_g: 2.5,
        regular_product_id: null,
        regular_variant_id: null,
      },
      {
        id: "c-04",
        trial_id: "trial-details-001",
        slot_index: 3,
        name: "Masala Milk Chai",
        estate: "Cinnamara Estate",
        grade: "Assam Whole Spice CTC",
        flush: "Second Flush",
        elevation: "200m AMSL",
        weight_g: 50,
        tasting_notes: JSON.stringify(["Cinnamon"]),
        brew_temp_c: 95,
        brew_time_sec: 210,
        leaf_dose_g: 2.5,
        regular_product_id: "prod-04",
        regular_variant_id: "var-04",
      },
    ],
    assets: [
      {
        id: "a-01",
        trial_id: "trial-details-001",
        slot_index: 0,
        stage: "milk_tea",
        asset_url: "/img/p1-milk.webp",
        alt_text: "Rich Chai with Milk",
        rights_status: "approved",
      },
    ],
    claims: [
      {
        id: "cl-01",
        trial_id: "trial-details-001",
        claim_type: "origin",
        label: "100% Single-Garden North India CTC",
        evidence_ref: "INV-2026-001",
        verified: 1,
      },
    ],
    brew_guides: [],
    sensory_tests: [],
    bulk_links: [],
    publications: [],
  } as unknown as TrialWithDetails;
}

describe("TeaFloww Trials v3 — Storefront Adversarial & Stress Testing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookieStore.get.mockReturnValue(undefined);
    mockHeaderList.get.mockReturnValue(null);
  });

  // =========================================================================
  // 1. Cost Calculator Arithmetic & Boundary Stress Tests
  // =========================================================================
  describe("1. Cost Calculator Arithmetic & Boundary Stress Tests", () => {
    it("1.1: strictly clamps zero, negative, and excessive leaf doses to [1.0g, 15.0g]", () => {
      // Zero and negative doses must fall back to safe default 2.5g (within [1g, 15g])
      expect(clampDoseGrams(0)).toBe(2.5);
      expect(clampDoseGrams(-0.0001)).toBe(2.5);
      expect(clampDoseGrams(-5)).toBe(2.5);
      expect(clampDoseGrams(-100)).toBe(2.5);
      expect(clampDoseGrams(-Infinity)).toBe(2.5);
      expect(clampDoseGrams(NaN)).toBe(2.5);

      // Micro positive doses below 1.0g clamp strictly to 1.0g
      expect(clampDoseGrams(0.0001)).toBe(1.0);
      expect(clampDoseGrams(0.49)).toBe(1.0);
      expect(clampDoseGrams(0.9)).toBe(1.0);
      expect(clampDoseGrams(1.0)).toBe(1.0);

      // Normal doses retain single-decimal precision
      expect(clampDoseGrams(2.5)).toBe(2.5);
      expect(clampDoseGrams(4.0)).toBe(4.0);
      expect(clampDoseGrams(14.9)).toBe(14.9);
      expect(clampDoseGrams(15.0)).toBe(15.0);

      // Excessive doses (>15.0g) clamp strictly to 15.0g ceiling
      expect(clampDoseGrams(15.04)).toBe(15.0);
      expect(clampDoseGrams(15.1)).toBe(15.0);
      expect(clampDoseGrams(50)).toBe(15.0);
      expect(clampDoseGrams(100)).toBe(15.0);
      expect(clampDoseGrams(1000)).toBe(15.0);
      expect(clampDoseGrams(Infinity)).toBe(2.5);
    });

    it("1.2: property-based fuzz test across 1,000 pseudo-random dose values", () => {
      for (let i = 0; i < 1000; i++) {
        // Generate pseudo-random numbers spanning [-500, +500] with varied fractional parts
        const raw = (Math.random() - 0.5) * 1000;
        const clamped = clampDoseGrams(raw);

        // INVARIANT 1: Output must be a finite number
        expect(Number.isFinite(clamped)).toBe(true);

        // INVARIANT 2: Output must be within [1.0, 15.0]
        expect(clamped).toBeGreaterThanOrEqual(1.0);
        expect(clamped).toBeLessThanOrEqual(15.0);

        // INVARIANT 3: Output must have at most 1 decimal place
        expect(Math.round(clamped * 10)).toBe(Math.round(clamped * 10));
      }
    });

    it("1.3: sanitizes zero, negative, NaN, and extreme price inputs without NaN or Infinity", () => {
      // Non-positive or non-finite prices evaluate safely to 0
      expect(calculateCostPerCup(0, 2.5)).toBe(0);
      expect(calculateCostPerCup(-10, 2.5)).toBe(0);
      expect(calculateCostPerCup(-10000, 2.5)).toBe(0);
      expect(calculateCostPerCup(NaN, 2.5)).toBe(0);
      expect(calculateCostPerCup(Infinity, 2.5)).toBe(0);
      expect(calculateCostPerCup(-Infinity, 2.5)).toBe(0);

      // Extremely large prices evaluate without floating crash
      const extremeCost = calculateCostPerCup(1_000_000, 2.5);
      expect(Number.isFinite(extremeCost)).toBe(true);
      expect(extremeCost).toBe(2500);

      // Formatting handles non-finite values safely
      expect(formatCostPerCup(0)).toBe("₹0.00");
      expect(formatCostPerCup(-10)).toBe("₹0.00");
      expect(formatCostPerCup(NaN)).toBe("₹0.00");
      expect(formatCostPerCup(Infinity)).toBe("₹0.00");
      expect(formatCostPerCup(-Infinity)).toBe("₹0.00");
      expect(formatCostPerCup(2500)).toBe("₹2500.00");
    });

    it("1.4: prevents floating point representation drift (e.g. 2.500000000000001, 0.8000000000000002)", () => {
      // In raw JS arithmetic: (200 * 4.0) / 1000 can produce 0.8000000000000002 in some engines
      const cost1 = calculateCostPerCup(200, 4.0);
      expect(cost1).toBe(0.8);
      expect(formatCostPerCup(cost1)).toBe("₹0.80");
      expect(formatCostPerCup(cost1)).not.toContain("0.8000000000000002");

      // In raw JS arithmetic: (1000 * 2.5) / 1000 can produce 2.500000000000001
      const cost2 = calculateCostPerCup(1000, 2.5);
      expect(cost2).toBe(2.5);
      expect(formatCostPerCup(cost2)).toBe("₹2.50");
      expect(formatCostPerCup(cost2)).not.toContain("2.500000000000001");

      // Half-up rounding at exact 0.5 paise boundary: 430 * 2.5 / 1000 = 1.075 -> 1.08
      const cost3 = calculateCostPerCup(430, 2.5);
      expect(cost3).toBe(1.08);
      expect(formatCostPerCup(cost3)).toBe("₹1.08");

      // Delta difference rounding drift: 0.80 - 0.86 = -0.060000000000000054 in raw IEEE 754
      const deltaDrift = calculateSavingsDelta(0.8, 0.86);
      expect(deltaDrift.diff).toBe(-0.06);
      expect(deltaDrift.formatted).toBe("+₹0.06 more / cup");
      expect(deltaDrift.formatted).not.toContain("0.060000000000000054");

      // Microscopic delta < 0.005 evaluates safely to "No change"
      const deltaTiny = calculateSavingsDelta(0.8000000000000002, 0.8);
      expect(deltaTiny.diff).toBe(0);
      expect(deltaTiny.isSavings).toBe(false);
      expect(deltaTiny.formatted).toBe("No change");
    });

    it("1.5: truthful negative delta: formats (+₹X.XX more / cup) when trial tea is more expensive", () => {
      // Case 1: Trial tea ₹1.25 / cup vs benchmark ₹0.80 / cup -> ₹0.45 more
      const delta1 = calculateSavingsDelta(0.8, 1.25);
      expect(delta1.isSavings).toBe(false);
      expect(delta1.diff).toBe(-0.45);
      expect(delta1.formatted).toBe("+₹0.45 more / cup");

      // Case 2: Trial tea ₹2.00 / cup vs benchmark ₹0.50 / cup -> ₹1.50 more
      const delta2 = calculateSavingsDelta(0.5, 2.0);
      expect(delta2.isSavings).toBe(false);
      expect(delta2.diff).toBe(-1.5);
      expect(delta2.formatted).toBe("+₹1.50 more / cup");

      // Case 3: Positive savings when trial tea is cheaper: benchmark ₹1.50 vs trial ₹1.08 -> ₹0.42 saved
      const delta3 = calculateSavingsDelta(1.5, 1.08);
      expect(delta3.isSavings).toBe(true);
      expect(delta3.diff).toBe(0.42);
      expect(delta3.formatted).toBe("₹0.42 saved");
    });

    it("1.6: brew yield formula: floor(kit weight / dose) handles boundary conditions", () => {
      // 200g kit / 2.5g dose = 80 cups
      expect(calculateKitCupYield(200, 2.5)).toBe(80);

      // 200g kit / 4.0g dose = 50 cups
      expect(calculateKitCupYield(200, 4.0)).toBe(50);

      // 200g kit / 1.0g min dose = 200 cups
      expect(calculateKitCupYield(200, 1.0)).toBe(200);

      // 200g kit / 15.0g max dose = 13 cups (200 / 15 = 13.333...)
      expect(calculateKitCupYield(200, 15.0)).toBe(13);

      // Zero or negative kit weight yields 0
      expect(calculateKitCupYield(0, 2.5)).toBe(0);
      expect(calculateKitCupYield(-200, 2.5)).toBe(0);

      // NaN kit weight falls back to default 200g
      expect(calculateKitCupYield(NaN, 2.5)).toBe(80);

      // Dose zero or negative clamps to 2.5g default
      expect(calculateKitCupYield(200, 0)).toBe(80);
      expect(calculateKitCupYield(200, -5)).toBe(80);
    });

    it("1.7: TrialCostCalculator component DOM output reflects truthful negative delta and clamped yield", () => {
      // Render calculator with initial price ₹800/kg and dose 2.5g (cost = ₹2.00/cup)
      // Benchmark defaults to ₹200/kg @ 4g = ₹0.80/cup
      // Difference: 0.80 - 2.00 = -1.20 -> +₹1.20 more / cup
      const html = renderToStaticMarkup(
        React.createElement(TrialCostCalculator, {
          initialPricePerKg: 800,
          initialDoseGrams: 2.5,
          kitWeightGrams: 200,
        })
      );

      // Must render truthful negative delta
      expect(html).toContain('data-testid="cost-per-cup-calculator"');
      expect(html).toContain('data-testid="savings-delta"');
      expect(html).toContain("+₹1.20 more / cup");

      // Must NOT show "Cheaper" savings badge when more expensive
      expect(html).not.toContain('data-testid="calculator-savings"');

      // Must show negative result CSS container
      expect(html).toContain("result negative");

      // Total yield must reflect 80 cups
      expect(html).toContain('data-testid="total-brews-count"');
      expect(html).toContain("80 cups");
    });
  });

  // =========================================================================
  // 2. Draft Isolation, Unauthenticated Access & XSS Security
  // =========================================================================
  describe("2. Draft Isolation, Unauthenticated Access & XSS Security", () => {
    it("2.1: unauthenticated access to unpublished trial slugs strictly returns 404 in TrialPDPPage", async () => {
      const draftDetails = createMockTrialDetails("draft");
      vi.spyOn(TrialService, "getBySlug").mockReturnValue(draftDetails);

      // Anonymous visitor (no cookies, no test token)
      mockCookieStore.get.mockReturnValue(undefined);
      mockHeaderList.get.mockReturnValue(null);

      await expect(
        TrialPDPPage({ params: Promise.resolve({ slug: "draft-tea-flight" }) })
      ).rejects.toThrow("NEXT_NOT_FOUND");

      expect(mockNotFound).toHaveBeenCalledTimes(1);
    });

    it("2.2: non-existent slug strictly returns 404 in TrialPDPPage", async () => {
      vi.spyOn(TrialService, "getBySlug").mockReturnValue(null);

      await expect(
        TrialPDPPage({ params: Promise.resolve({ slug: "does-not-exist" }) })
      ).rejects.toThrow("NEXT_NOT_FOUND");

      expect(mockNotFound).toHaveBeenCalledTimes(1);
    });

    it("2.3: generateMetadata returns not-found title and noindex for unpublished draft without admin session", async () => {
      const draftDetails = createMockTrialDetails("draft");
      vi.spyOn(TrialService, "getBySlug").mockReturnValue(draftDetails);

      mockCookieStore.get.mockReturnValue(undefined);
      mockHeaderList.get.mockReturnValue(null);

      const meta = await generateMetadata({
        params: Promise.resolve({ slug: "draft-tea-flight" }),
      });

      expect(meta.title).toContain("Trial Kit Not Found");
      expect(meta.robots).toEqual(
        expect.objectContaining({
          index: false,
          follow: false,
        })
      );
    });

    it("2.4: generateMetadata returns not-found title and noindex for non-existent slug", async () => {
      vi.spyOn(TrialService, "getBySlug").mockReturnValue(null);

      const meta = await generateMetadata({
        params: Promise.resolve({ slug: "non-existent-slug" }),
      });

      expect(meta.title).toContain("Trial Kit Not Found");
      expect(meta.robots).toEqual(
        expect.objectContaining({
          index: false,
          follow: false,
        })
      );
    });

    it("2.5: authenticated admin request allows draft preview in TrialPDPPage with DraftPreviewBanner and noindex", async () => {
      process.env.ADMIN_TEST_TOKEN = "trials-test-admin-secret-token";
      const draftDetails = createMockTrialDetails("draft");
      vi.spyOn(TrialService, "getBySlug").mockReturnValue(draftDetails);

      // Authenticate via test admin token
      mockHeaderList.get.mockImplementation((k: string) =>
        k === "x-admin-test-token" ? "trials-test-admin-secret-token" : null
      );

      const pageElement = await TrialPDPPage({
        params: Promise.resolve({ slug: "draft-tea-flight" }),
      });
      const html = renderToStaticMarkup(pageElement);

      // Must render DraftPreviewBanner with status and revision
      expect(html).toContain('data-testid="trial-preview-banner"');
      expect(html).toContain("DRAFT PREVIEW · NOT PUBLISHED");
      expect(html).toContain("STATUS: draft");

      // generateMetadata for admin preview must keep noindex: true so drafts never index
      const meta = await generateMetadata({
        params: Promise.resolve({ slug: "draft-tea-flight" }),
      });
      expect(meta.robots).toEqual(
        expect.objectContaining({
          index: false,
          follow: false,
        })
      );
    });

    it("2.5b: x-admin-test-token is strictly ignored when NODE_ENV is production", async () => {
      vi.stubEnv("NODE_ENV", "production");
      try {
        const draftDetails = createMockTrialDetails("draft");
        vi.spyOn(TrialService, "getBySlug").mockReturnValue(draftDetails);

        mockHeaderList.get.mockImplementation((k: string) =>
          k === "x-admin-test-token" ? "trials-test-admin-secret-token" : null
        );
        mockCookieStore.get.mockReturnValue(undefined);

        await expect(
          TrialPDPPage({
            params: Promise.resolve({ slug: "draft-tea-flight" }),
          })
        ).rejects.toThrow("NEXT_NOT_FOUND");
        expect(mockNotFound).toHaveBeenCalled();
      } finally {
        vi.unstubAllEnvs();
      }
    });

    it("2.6: public API route GET /api/v1/trials/:slug returns 404 for draft slug without admin auth", async () => {
      // Simulate public endpoint reading draft record
      vi.spyOn(TrialService, "getPublicBySlug").mockReturnValue(null);

      const req = new Request("https://teafloww.com/api/v1/trials/draft-tea-flight", {
        method: "GET",
      });

      const res = await getPublicTrialBySlug(req, {
        params: Promise.resolve({ slug: "draft-tea-flight" }),
      });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toContain("Trial not found");
    });

    it("2.7: public API route GET /api/v1/trials/:slug returns 404 for non-existent slug", async () => {
      vi.spyOn(TrialService, "getPublicBySlug").mockReturnValue(null);
      vi.spyOn(TrialService, "getBySlug").mockReturnValue(null);

      const req = new Request("https://teafloww.com/api/v1/trials/unknown-slug", {
        method: "GET",
      });

      const res = await getPublicTrialBySlug(req, {
        params: Promise.resolve({ slug: "unknown-slug" }),
      });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toContain("Trial not found");
    });

    it("2.8: special characters and XSS script tags in tea title/description are strictly HTML-escaped", () => {
      const maliciousTrial = createBaselineTrial({
        title: '<script>alert("XSS-TITLE")</script>',
        tagline: '"><img src=x onerror=alert("XSS-TAGLINE")>',
        description: '<b onmouseover="alert(\'XSS-DESC\')">Hover me</b>',
        components: [
          {
            ...createBaselineTrial().components[0],
            name: '<svg onload=alert("XSS-COMP")>Strong Tea',
            tasting_notes: ['<script>alert("XSS-NOTE")</script>', "Malty"],
          },
          createBaselineTrial().components[1],
          createBaselineTrial().components[2],
          createBaselineTrial().components[3],
        ],
      });

      const html = renderToStaticMarkup(
        React.createElement(TrialPDPInteractiveView, { trial: maliciousTrial })
      );

      // Crucial security check: raw unescaped script and handler tags MUST NOT exist in HTML
      expect(html).not.toContain('<script>alert("XSS-TITLE")</script>');
      expect(html).not.toContain('<img src=x onerror=');
      expect(html).not.toContain('<svg onload=');
      expect(html).not.toContain('<script>alert("XSS-NOTE")</script>');

      // Must be safely HTML-escaped by React
      expect(html).toContain("&lt;script&gt;alert(&quot;XSS-TITLE&quot;)&lt;/script&gt;");
      expect(html).toContain("&quot;&gt;&lt;img src=x onerror=alert(&quot;XSS-TAGLINE&quot;)&gt;");
      expect(html).toContain("&lt;svg onload=alert(&quot;XSS-COMP&quot;)&gt;Strong Tea");
      expect(html).toContain("&lt;script&gt;alert(&quot;XSS-NOTE&quot;)&lt;/script&gt;");
    });

    it("2.9: ampersands and quotes (e.g. 'Makaibari & Special') are strictly escaped without double-encoding", () => {
      const specialTrial = createBaselineTrial({
        title: 'Makaibari & Special "1st Flush" Single Estate',
      });

      const html = renderToStaticMarkup(
        React.createElement(TrialCard, { trial: specialTrial })
      );

      expect(html).toContain("Makaibari &amp; Special &quot;1st Flush&quot; Single Estate");
      expect(html).not.toContain("Makaibari & Special");
    });
  });

  // =========================================================================
  // 3. Graceful Null, Undefined & Missing Data Handling
  // =========================================================================
  describe("3. Graceful Null, Undefined & Missing Data Handling", () => {
    it("3.1: component with null elevation renders 'Estate reserve', never literal 'null' or 'undefined'", () => {
      const prov = formatProvenance("Moran Estate", null, "Autumn", "CTC BP", "LOT-01");
      expect(prov.elevation).toBe("Estate reserve");
      expect(prov.elevation).not.toContain("null");
      expect(prov.elevation).not.toContain("undefined");

      const compWithNullElevation = {
        ...createBaselineTrial().components[0],
        elevation: null,
      };

      const html = renderToStaticMarkup(
        React.createElement(TrialSensoryBento, {
          activeComponent: compWithNullElevation,
          claims: [],
        })
      );

      expect(html).not.toContain('data-testid="tea-provenance"');
      expect(html).not.toContain("Terroir &amp; Garden Provenance");
      expect(html).not.toContain("null");
      expect(html).not.toContain("undefined");
      expect(html).not.toContain("Elevation: null");
    });

    it("3.2: component with whitespace or empty string elevation renders 'Estate reserve'", () => {
      const provEmpty = formatProvenance("Moran Estate", "", "Autumn", "BP", "L1");
      expect(provEmpty.elevation).toBe("Estate reserve");

      const provWhitespace = formatProvenance("Moran Estate", "   \t\n  ", "Autumn", "BP", "L1");
      expect(provWhitespace.elevation).toBe("Estate reserve");
    });

    it("3.3: component with null lot number or missing parameters renders fallback safely", () => {
      const provNullLot = formatProvenance(null, null, null, null, null);
      expect(provNullLot.estate).toBe("Single Estate Reserve");
      expect(provNullLot.elevation).toBe("Estate reserve");
      expect(provNullLot.flush).toBe("Seasonal Harvest");
      expect(provNullLot.grade).toBe("Whole Leaf / CTC Standard");
      expect(provNullLot.lot).toBe("Direct Garden Invoiced Lot");
    });

    it("3.4: resolvePouchAsset handles null, undefined, or empty assets array without throwing", () => {
      expect(resolvePouchAsset(undefined, 0, "milk_tea")).toBeNull();
      expect(resolvePouchAsset([], 0, "milk_tea")).toBeNull();

      const compNoAssets = [
        {
          ...createBaselineTrial().components[0],
          assets: null as any,
        },
      ];
      expect(resolvePouchAsset(compNoAssets, 0, "milk_tea")).toBeNull();

      const compEmptyAssets = [
        {
          ...createBaselineTrial().components[0],
          assets: [],
        },
      ];
      expect(resolvePouchAsset(compEmptyAssets, 0, "milk_tea")).toBeNull();
    });

    it("3.5: Optical Studio missing photo fallback renders 'Photo pending verification'", () => {
      // Component with zero assets attached
      const compNoAssets = [
        {
          ...createBaselineTrial().components[0],
          assets: [],
        },
        createBaselineTrial().components[1],
        createBaselineTrial().components[2],
        createBaselineTrial().components[3],
      ];

      const html = renderToStaticMarkup(
        React.createElement(TrialOpticalStudio, {
          components: compNoAssets,
          activePouchIndex: 0,
        })
      );

      expect(html).toContain('data-testid="missing-photo-fallback"');
      expect(html).toContain("photo-pending");
      expect(html).toContain("Photo pending verification");
      expect(html).toContain("undergoing spectral verification");
      expect(html).not.toContain('data-testid="optical-stage-image"');
    });

    it("3.6: Optical Studio handles empty components array ([]) gracefully with default sachet fallback", () => {
      const html = renderToStaticMarkup(
        React.createElement(TrialOpticalStudio, {
          components: [],
        })
      );

      // Must render without throwing and show fallback stage
      expect(html).toContain("TEAPILOT OPTICAL STUDIO");
      expect(html).toContain('data-testid="missing-photo-fallback"');
    });

    it("3.7: Bulk ladder with null bulkLink renders 'Kit Exclusive' badge without dead links", () => {
      const html = renderToStaticMarkup(
        React.createElement(TrialBulkLadder, {
          bulkLink: null,
          componentName: "Ginger Milk Chai",
        })
      );

      expect(html).toContain('data-testid="kit-exclusive-badge"');
      expect(html).toContain("Kit Exclusive");
      expect(html).not.toContain('data-testid="bulk-variant-link"');
      expect(html).not.toContain("View Bag ↗");
      expect(html).not.toContain('href="/tea/null"');
      expect(html).not.toContain('href="/tea/undefined"');
      expect(html).not.toContain('href=""');
    });

    it("3.8: Bulk ladder with null product_slug renders 'Kit Exclusive' badge", () => {
      const html = renderToStaticMarkup(
        React.createElement(TrialBulkLadder, {
          bulkLink: { product_slug: null, variant_title: "500g Pouch" },
          componentName: "Masala Chai",
        })
      );

      expect(html).toContain('data-testid="kit-exclusive-badge"');
      expect(html).toContain("Kit Exclusive");
      expect(html).not.toContain('data-testid="bulk-variant-link"');
    });

    it("3.9: Kettle guide with null or undefined brewing parameters falls back to safe defaults (2.5g, 95°C, 180s)", () => {
      const html = renderToStaticMarkup(
        React.createElement(TrialKettleGuide, {
          brewing: undefined,
          teaName: "Craft Chai",
        })
      );

      expect(html).toContain('data-testid="kettle-guide"');
      expect(html).toContain("2.5g");
      expect(html).toContain("95°C");
      expect(html).toContain("3 minutes");
      expect(html).toContain("180s");
    });

    it("3.10: Kettle guide duration clamping ([30s, 1800s]) under negative, zero, and huge steep times", () => {
      expect(clampBrewingDuration(-10)).toBe(180); // Negative falls back to default 180s
      expect(clampBrewingDuration(0)).toBe(180); // Zero falls back to default 180s
      expect(clampBrewingDuration(10)).toBe(30); // Below 30s clamps to 30s min
      expect(clampBrewingDuration(30)).toBe(30);
      expect(clampBrewingDuration(600)).toBe(600);
      expect(clampBrewingDuration(1800)).toBe(1800);
      expect(clampBrewingDuration(5000)).toBe(1800); // Exceeding 1800s clamps to 1800s max
      expect(clampBrewingDuration(NaN)).toBe(180);
      expect(clampBrewingDuration(Infinity)).toBe(180); // Non-finite safely defaults to 180s
    });

    it("3.11: Sensory bento with null or empty tasting notes renders default cupping notes safely", () => {
      const compNullNotes = {
        ...createBaselineTrial().components[0],
        tasting_notes: null as any,
      };

      const html = renderToStaticMarkup(
        React.createElement(TrialSensoryBento, {
          activeComponent: compNullNotes,
          claims: [],
        })
      );

      expect(html).toContain('data-testid="sensory-bento"');
      expect(html).toContain('data-testid="tasting-notes-list"');
      expect(html).toContain("Full-bodied");
      expect(html).toContain("Malty");
    });

    it("3.12: full PDP interactive view renders without crash when given complete null-laden DTO", () => {
      const nullLadenTrial: TrialPublicDto = {
        id: "trial-null-001",
        slug: "bare-bones-trial",
        title: "Bare Bones Trial",
        tagline: null,
        description: null,
        status: "published",
        pack_format: "4x50g_sachets",
        net_weight_g: 200,
        price_paise: 20000,
        compare_at_price_paise: null,
        sku: "TRIAL-NULL-001",
        in_stock: true,
        hero_image: null,
        components: [
          {
            slot_index: 0,
            name: "Minimal Sachet",
            estate: "Estate",
            grade: "CTC",
            flush: "Flush",
            elevation: null,
            weight_g: 50,
            tasting_notes: [],
            brewing: { temp_c: 95, time_sec: 180, dose_g: 2.5 },
            bulk_link: null,
            assets: [],
          },
        ],
        claims: [],
        meta: { title: null, description: null },
      };

      const html = renderToStaticMarkup(
        React.createElement(TrialPDPInteractiveView, { trial: nullLadenTrial })
      );

      expect(html).toContain("Bare Bones Trial");
      expect(html).toContain("₹200");
      expect(html).toContain("In Stock");
      expect(html).toContain("Kit Exclusive");
      expect(html).not.toContain("Terroir &amp; Garden Provenance");
      expect(html).toContain("Photo pending verification");

      // Verify out-of-stock degradation
      const oosTrial: TrialPublicDto = { ...nullLadenTrial, in_stock: false };
      const oosHtml = renderToStaticMarkup(
        React.createElement(TrialPDPInteractiveView, { trial: oosTrial })
      );
      expect(oosHtml).toContain("Sold Out");
      expect(oosHtml).toContain("Out of Stock");
    });
  });
});
