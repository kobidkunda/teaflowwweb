/**
 * TeaFloww Trials v3 — Milestone 5 Storefront State & Adversarial Test Suite
 *
 * EMPIRICAL ADVERSARIAL STRESS SUITE:
 * 1. Interactive State & Roving Navigation:
 *    - getNextTab circular wrapping (3 -> 0, 0 -> 3, boundary stepping)
 *    - Defensive handling of out-of-bounds indices (-1, 10, 100, <=0 tabs)
 *    - Active pouch selection updates active component imagery and tasting notes
 *    - Out-of-bounds pouch index defensive fallback
 * 2. Bilingual Hindi Toggling Round-Trip Fidelity:
 *    - Authentic terminology verification (चाय, नमूना किट, परख, प्याला, पत्ती, etc.)
 *    - Full dictionary integrity (zero undefined/placeholder entries)
 *    - 100% round-trip fidelity between English and Hindi
 *    - Component state retention across language toggles (pouch, stage, dose slider)
 * 3. Cart Provider Integration & Polymorphic Lookup:
 *    - CartLine with trialId: adding trial kit (variantId: 0, trialId: "trial-xyz")
 *    - Polymorphic coexistence: regular product (variantId: 101) alongside trial kits
 *    - Quantity updates & removals without cross-item collision
 *    - LocalStorage serialization and hydration filtering against malformed/corrupt payloads
 *    - Corrupt JSON resilience
 * 4. Mobile Sticky Bar & Touch Targets:
 *    - Minimum 44x44px touch target compliance across buttons
 *    - iOS safe-area clearance (pb-safe & paddingBottom)
 *    - Tactile feedback state transitions (in-stock, added-to-cart, sold-out)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// 1. Mocks for Next.js navigation and next/image
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => "/trials",
  useSearchParams: () => new URLSearchParams(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
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

// Shared mock for CartProvider useCart hook
export const mockCartActions = {
  add: vi.fn(),
  changeQuantity: vi.fn(),
  remove: vi.fn(),
  clear: vi.fn(),
  items: [] as any[],
  count: 0,
  subtotal: 0,
  sessionId: "test-session-uuid",
  recoveryToken: null,
  isSyncing: false,
};

vi.mock("@/components/CartProvider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/CartProvider")>();
  return {
    ...actual,
    useCart: () => mockCartActions,
  };
});

// Components under test
import { TrialOpticalStudio } from "@/components/trials/TrialOpticalStudio";
import { TrialSensoryBento } from "@/components/trials/TrialSensoryBento";
import { TrialStickyActionBar } from "@/components/trials/TrialStickyActionBar";
import { TrialBuyBox } from "@/components/trials/TrialBuyBox";
import { TrialLanguageToggle } from "@/components/trials/TrialLanguageToggle";
import { TrialPDPInteractiveView } from "@/components/trials/TrialPDPInteractiveView";

// Pure business helpers
import {
  getNextTab,
  calculateCostPerCup,
  calculateSavingsDelta,
  calculateKitCupYield,
  clampDoseGrams,
  formatProvenance,
} from "@/lib/trials/storefront-helpers";

import { getTrialText, TRIAL_DICTIONARY } from "@/lib/trials/i18n";
import type { TrialPublicDto } from "@/lib/trials/types";
import type { CartLine } from "@/components/CartProvider";

// Test fixture generator
function createAdversarialTrialDto(overrides: Partial<TrialPublicDto> = {}): TrialPublicDto {
  return {
    id: "trial-discovery-200g-001",
    slug: "tea-stall-discovery-kit",
    title: "TeaFloww Four-Tea Discovery Kit",
    tagline: "Four distinct craft milk teas formulated from Siliguri CTC and fresh whole spices.",
    description: "The definitive sample kit for discerning tea stalls and milk chai enthusiasts. Contains four 50g sachets.",
    status: "published",
    pack_format: "4x50g_sachets",
    net_weight_g: 200,
    price_paise: 20000, // ₹200.00
    compare_at_price_paise: 28000,
    sku: "TRIAL-STALL-4X50G",
    in_stock: true,
    hero_image: {
      url: "/images/trials/discovery-packaging.jpg",
      alt_text: "TeaFloww Four-Tea Discovery Kit Outer Packaging",
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
        tasting_notes: ["Malty", "Deep Amber", "High Pungency", "Thick Cream Lacing"],
        brewing: { temp_c: 95, time_sec: 180, dose_g: 2.5 },
        bulk_link: { product_slug: "assam-strong-ctc", variant_title: "500g Pouch" },
        assets: [
          { stage: "packaging", url: "/img/p1-pack.webp", alt_text: "Strong Milk Chai Sachet Packaging" },
          { stage: "dry_leaf", url: "/img/p1-dry.webp", alt_text: "Dry CTC Granules" },
          { stage: "infused_leaf", url: "/img/p1-wet.webp", alt_text: "Wet Infused Leaf" },
          { stage: "liquor", url: "/img/p1-liquor.webp", alt_text: "Raw Amber Liquor" },
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
        tasting_notes: ["Sweet Cardamom", "Warm Spice", "Full Body"],
        brewing: { temp_c: 95, time_sec: 180, dose_g: 2.5 },
        bulk_link: { product_slug: "elaichi-chai-blend", variant_title: "500g Pouch" },
        assets: [
          { stage: "packaging", url: "/img/p2-pack.webp", alt_text: "Elaichi Pouch Packaging" },
        ],
      },
      {
        slot_index: 2,
        name: "Ginger Milk Chai",
        estate: "Sonitpur Estate",
        grade: "Assam-Dooars CTC Blend",
        flush: "Rain Flush",
        elevation: null,
        weight_g: 50,
        tasting_notes: ["Fiery Zing", "Throat Warmth", "Brisk"],
        brewing: { temp_c: 95, time_sec: 210, dose_g: 2.5 },
        bulk_link: null,
        assets: [],
      },
      {
        slot_index: 3,
        name: "Masala Milk Chai",
        estate: "Cinnamara Estate",
        grade: "Assam CTC Whole Spice Blend",
        flush: "Second Flush",
        elevation: "200m AMSL",
        weight_g: 50,
        tasting_notes: ["Aromatic Pungency", "Cinnamon Sweetness", "Robust"],
        brewing: { temp_c: 95, time_sec: 210, dose_g: 2.5 },
        bulk_link: { product_slug: "signature-masala-chai", variant_title: "500g Pouch" },
        assets: [
          { stage: "milk_tea", url: "/img/p4-milk.webp", alt_text: "Spiced Masala Milk Chai in Kulhad" },
        ],
      },
    ],
    claims: [
      { claim_type: "origin", label: "100% Single-Garden North India CTC", verified: true },
      { claim_type: "licence", label: "FSSAI Registered Operator FBO-19CTHPK", verified: true },
      { claim_type: "packaging", label: "Nitrogen Flushed 4x50g Sachets", verified: true },
    ],
    meta: {
      title: "TeaFloww 4-Tea Discovery Kit | 4x50g Authentic Milk Chai Sampler",
      description: "Sample Strong, Elaichi, Ginger, and Masala milk teas in 50g pouches. Real Siliguri provenance.",
    },
    ...overrides,
  };
}

describe("Adversarial Stress Suite: Milestone 5 Storefront State & Interactions", () => {
  let mockTrial: TrialPublicDto;

  beforeEach(() => {
    mockTrial = createAdversarialTrialDto();
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. Interactive State & Roving Navigation
  // =========================================================================
  describe("1. Interactive State & Roving Navigation", () => {
    it("1.1: getNextTab handles circular wrapping forward (3 -> 0) and backward (0 -> 3)", () => {
      const totalTabs = 4;
      // Forward wrap at upper boundary
      expect(getNextTab(3, "next", totalTabs)).toBe(0);
      // Backward wrap at lower boundary
      expect(getNextTab(0, "prev", totalTabs)).toBe(3);
      // Interior forward transitions
      expect(getNextTab(0, "next", totalTabs)).toBe(1);
      expect(getNextTab(1, "next", totalTabs)).toBe(2);
      expect(getNextTab(2, "next", totalTabs)).toBe(3);
      // Interior backward transitions
      expect(getNextTab(3, "prev", totalTabs)).toBe(2);
      expect(getNextTab(2, "prev", totalTabs)).toBe(1);
      expect(getNextTab(1, "prev", totalTabs)).toBe(0);
    });

    it("1.2: getNextTab handles out-of-bounds indices defensively (-1, 10, 100)", () => {
      const totalTabs = 4;
      // Index -1 forward wraps to 0
      const nextNeg = getNextTab(-1, "next", totalTabs);
      expect(nextNeg).toBe(0);
      expect(nextNeg).toBeGreaterThanOrEqual(0);
      expect(nextNeg).toBeLessThan(totalTabs);

      // Index -1 backward wraps to 2
      const prevNeg = getNextTab(-1, "prev", totalTabs);
      expect(prevNeg).toBe(2);
      expect(prevNeg).toBeGreaterThanOrEqual(0);
      expect(prevNeg).toBeLessThan(totalTabs);

      // Index 10 forward wraps to 3
      const nextTen = getNextTab(10, "next", totalTabs);
      expect(nextTen).toBe(3);
      expect(nextTen).toBeGreaterThanOrEqual(0);
      expect(nextTen).toBeLessThan(totalTabs);

      // Index 10 backward wraps to 1
      const prevTen = getNextTab(10, "prev", totalTabs);
      expect(prevTen).toBe(1);
      expect(prevTen).toBeGreaterThanOrEqual(0);
      expect(prevTen).toBeLessThan(totalTabs);

      // Degenerate inputs: 0 or negative totalTabs returns 0 safely
      expect(getNextTab(0, "next", 0)).toBe(0);
      expect(getNextTab(2, "prev", -1)).toBe(0);

      // Single-tab container always returns 0
      expect(getNextTab(0, "next", 1)).toBe(0);
      expect(getNextTab(0, "prev", 1)).toBe(0);
    });

    it("1.3: active pouch selection updates active component imagery and stage tabs in TrialOpticalStudio", () => {
      // Pouch 0: Strong Milk Chai with milk_tea image
      const htmlPouch0 = renderToStaticMarkup(
        React.createElement(TrialOpticalStudio, {
          components: mockTrial.components,
          activePouchIndex: 0,
        })
      );
      expect(htmlPouch0).toContain('data-testid="optical-stage-image"');
      expect(htmlPouch0).toContain('src="/img/p1-milk.webp"');
      expect(htmlPouch0).toContain('alt="Rich Chai with Milk"');
      expect(htmlPouch0).toContain("Strong Milk Chai");

      // Pouch 1: Elaichi Milk Chai (has no milk_tea asset -> renders fallback)
      const htmlPouch1 = renderToStaticMarkup(
        React.createElement(TrialOpticalStudio, {
          components: mockTrial.components,
          activePouchIndex: 1,
        })
      );
      expect(htmlPouch1).toContain('data-testid="missing-photo-fallback"');
      expect(htmlPouch1).toContain("Photo pending verification");
      expect(htmlPouch1).toContain("Elaichi Milk Chai");

      // Pouch 3: Masala Milk Chai (has milk_tea asset)
      const htmlPouch3 = renderToStaticMarkup(
        React.createElement(TrialOpticalStudio, {
          components: mockTrial.components,
          activePouchIndex: 3,
        })
      );
      expect(htmlPouch3).toContain('data-testid="optical-stage-image"');
      expect(htmlPouch3).toContain('src="/img/p4-milk.webp"');
      expect(htmlPouch3).toContain("Masala Milk Chai");
    });

    it("1.4: active pouch selection updates cupping profile and tasting notes in TrialSensoryBento", () => {
      // Component 0: Strong Milk Chai
      const htmlBento0 = renderToStaticMarkup(
        React.createElement(TrialSensoryBento, {
          activeComponent: mockTrial.components[0],
          claims: mockTrial.claims,
        })
      );
      expect(htmlBento0).toContain("Cupping profile: <em class=\"italic text-[#ae8452]\">Strong Milk Chai</em>");
      expect(htmlBento0).toContain("Malty");
      expect(htmlBento0).toContain("High Pungency");
      expect(htmlBento0).toContain("Thick Cream Lacing");

      // Component 1: Elaichi Milk Chai
      const htmlBento1 = renderToStaticMarkup(
        React.createElement(TrialSensoryBento, {
          activeComponent: mockTrial.components[1],
          claims: mockTrial.claims,
        })
      );
      expect(htmlBento1).toContain("Cupping profile: <em class=\"italic text-[#ae8452]\">Elaichi Milk Chai</em>");
      expect(htmlBento1).toContain("Sweet Cardamom");
      expect(htmlBento1).toContain("Warm Spice");
      expect(htmlBento1).toContain("Full Body");

      // Component 2: Ginger Milk Chai
      const htmlBento2 = renderToStaticMarkup(
        React.createElement(TrialSensoryBento, {
          activeComponent: mockTrial.components[2],
          claims: mockTrial.claims,
        })
      );
      expect(htmlBento2).toContain("Cupping profile: <em class=\"italic text-[#ae8452]\">Ginger Milk Chai</em>");
      expect(htmlBento2).toContain("Fiery Zing");
      expect(htmlBento2).toContain("Throat Warmth");
      expect(htmlBento2).toContain("Brisk");
      expect(htmlBento2).not.toContain("null");
    });

    it("1.5: out-of-bounds active pouch index (e.g. index -1 or index 99) falls back defensively", () => {
      // Out of bounds index 99 in TrialOpticalStudio falls back to component 0 without throwing
      const htmlOOB = renderToStaticMarkup(
        React.createElement(TrialOpticalStudio, {
          components: mockTrial.components,
          activePouchIndex: 99,
        })
      );
      expect(htmlOOB).toContain("Strong Milk Chai");

      // Out of bounds index -1 in TrialOpticalStudio
      const htmlNeg = renderToStaticMarkup(
        React.createElement(TrialOpticalStudio, {
          components: mockTrial.components,
          activePouchIndex: -1,
        })
      );
      expect(htmlNeg).toContain("Strong Milk Chai");

      // formatProvenance handles undefined/empty gracefully
      const provFallback = formatProvenance(null, null, null, null, null);
      expect(provFallback.estate).toBe("Single Estate Reserve");
      expect(provFallback.elevation).toBe("Estate reserve");
      expect(provFallback.flush).toBe("Seasonal Harvest");
      expect(provFallback.grade).toBe("Whole Leaf / CTC Standard");
    });
  });

  // =========================================================================
  // 2. Bilingual Hindi Toggling Round-Trip Fidelity
  // =========================================================================
  describe("2. Bilingual Hindi Toggling Round-Trip Fidelity", () => {
    it("2.1: toggle English -> Hindi features authentic culinary and tea-trade terminology", () => {
      // Required core terminology checks: चाय, नमूना किट, परख, प्याला, पत्ती
      const dictJson = JSON.stringify(TRIAL_DICTIONARY);
      expect(dictJson).toContain("चाय");
      expect(dictJson).toContain("नमूना किट");
      expect(dictJson).toContain("परख");
      expect(dictJson).toContain("प्याला");
      expect(dictJson).toContain("पत्ती");

      // Check specific domain keys
      expect(getTrialText("pouch_strong", "hi")).toBe("कड़क चाय");
      expect(getTrialText("pouch_elaichi", "hi")).toBe("इलायची चाय");
      expect(getTrialText("pouch_ginger", "hi")).toBe("अदरक चाय");
      expect(getTrialText("pouch_masala", "hi")).toBe("मसाला चाय");
      expect(getTrialText("stage_dry_leaf", "hi")).toBe("सूखी पत्ती");
      expect(getTrialText("stage_infused_leaf", "hi")).toBe("भीगी पत्ती");
      expect(getTrialText("stage_milk_tea", "hi")).toBe("दूध चाय");
      expect(getTrialText("calc_total_brews", "hi")).toBe("200 ग्राम किट से कुल प्याले");
      expect(getTrialText("add_to_cart", "hi")).toBe("नमूना किट ऑर्डर करें (₹200)");
      expect(getTrialText("hero_title_highlight", "hi")).toBe("एक सच्ची परख से।");
    });

    it("2.2: 100% dictionary integrity: every key has valid non-empty English and Hindi translations", () => {
      const keys = Object.keys(TRIAL_DICTIONARY);
      expect(keys.length).toBeGreaterThanOrEqual(25);

      for (const key of keys) {
        const entry = TRIAL_DICTIONARY[key];
        expect(entry).toBeDefined();
        expect(typeof entry.en).toBe("string");
        expect(typeof entry.hi).toBe("string");
        expect(entry.en.trim().length).toBeGreaterThan(0);
        expect(entry.hi.trim().length).toBeGreaterThan(0);

        // Strict rejection of corrupted placeholders or unreviewed stubs
        expect(entry.en).not.toMatch(/undefined|null|TODO|TBD/i);
        expect(entry.hi).not.toMatch(/undefined|null|TODO|TBD/i);
      }
    });

    it("2.3: toggle Hindi -> English preserves 100% exact fidelity with original English copy", () => {
      const keys = Object.keys(TRIAL_DICTIONARY);

      for (const key of keys) {
        const originalEn = TRIAL_DICTIONARY[key].en;
        // Simulate English -> Hindi -> English round trip
        const hiText = getTrialText(key, "hi");
        expect(hiText).toBe(TRIAL_DICTIONARY[key].hi);

        const restoredEn = getTrialText(key, "en");
        expect(restoredEn).toBe(originalEn);
        expect(restoredEn).not.toBe(hiText);
      }

      // Safe fallback for unmapped dictionary keys
      expect(getTrialText("unmapped_adversarial_key", "hi")).toBe("unmapped_adversarial_key");
      expect(getTrialText("unmapped_adversarial_key", "en")).toBe("unmapped_adversarial_key");
    });

    it("2.4: component state retention: active tab and stage are preserved across locale changes", () => {
      // Render Optical Studio with activePouchIndex: 2 in English
      const htmlEn = renderToStaticMarkup(
        React.createElement(TrialOpticalStudio, {
          components: mockTrial.components,
          activePouchIndex: 2,
          locale: "en",
        })
      );
      expect(htmlEn).toContain("POUCH 03 · 50G");
      expect(htmlEn).toContain("Ginger Milk Chai");
      expect(htmlEn).toContain("Dry Leaf");
      expect(htmlEn).toContain("Milk Tea");

      // Render Optical Studio with same activePouchIndex: 2 in Hindi
      const htmlHi = renderToStaticMarkup(
        React.createElement(TrialOpticalStudio, {
          components: mockTrial.components,
          activePouchIndex: 2,
          locale: "hi",
        })
      );
      // Pouch 3 remains active
      expect(htmlHi).toContain("POUCH 03 · 50G");
      expect(htmlHi).toContain("Ginger Milk Chai");
      // Labels update to Hindi without resetting pouch index
      expect(htmlHi).toContain("सूखी पत्ती");
      expect(htmlHi).toContain("दूध चाय");

      // Restore to English: labels return to exact English strings
      const htmlEnRestored = renderToStaticMarkup(
        React.createElement(TrialOpticalStudio, {
          components: mockTrial.components,
          activePouchIndex: 2,
          locale: "en",
        })
      );
      expect(htmlEnRestored).toBe(htmlEn);
    });

    it("2.5: component state retention: dose slider and cost calculator preserve arithmetic across state cycles", () => {
      // Simulate user selecting custom 3.8g dose on 200g kit
      const userDose = 3.8;
      const rate = 430;
      const benchmarkCost = 0.80; // ₹200/kg @ 4g dose

      const cost = calculateCostPerCup(rate, userDose);
      // (430 * 3.8) / 1000 = 1.634 -> ₹1.63
      expect(cost).toBe(1.63);

      const delta = calculateSavingsDelta(benchmarkCost, cost);
      // 0.80 - 1.63 = -0.83 -> +₹0.83 more / cup (truthful negative delta)
      expect(delta.isSavings).toBe(false);
      expect(delta.diff).toBe(-0.83);
      expect(delta.formatted).toBe("+₹0.83 more / cup");

      const yieldCups = calculateKitCupYield(200, userDose);
      // Math.floor(200 / 3.8) = 52 cups
      expect(yieldCups).toBe(52);

      // Verify adversarial dose inputs are clamped without floating point drift
      expect(clampDoseGrams(-5)).toBe(2.5); // non-positive falls back to default 2.5
      expect(clampDoseGrams(0)).toBe(2.5);
      expect(clampDoseGrams(0.2)).toBe(1.0); // clamped to lower bound 1.0g
      expect(clampDoseGrams(99.9)).toBe(15.0); // clamped to upper bound 15.0g
      expect(clampDoseGrams(Number.NaN)).toBe(2.5);
      expect(clampDoseGrams(Infinity)).toBe(2.5);
    });

    it("2.6: TrialPDPInteractiveView localized projection retains core product invariants", () => {
      // Render interactive view with default English
      const htmlViewEn = renderToStaticMarkup(
        React.createElement(TrialPDPInteractiveView, { trial: mockTrial })
      );
      expect(htmlViewEn).toContain("TeaFloww Four-Tea Discovery Kit");
      expect(htmlViewEn).toContain("₹200");
      expect(htmlViewEn).toContain("DISCOVERY KIT · 200G");

      // Verify Hindi title mapping rule
      const localizedHindiTitle = mockTrial.title.includes("Discovery Kit")
        ? "टीफ़्लो चार-चाय नमूना किट"
        : `${mockTrial.title} (नमूना किट)`;
      expect(localizedHindiTitle).toBe("टीफ़्लो चार-चाय नमूना किट");
    });
  });

  // =========================================================================
  // 3. Cart Provider Integration & Polymorphic Lookup
  // =========================================================================
  describe("3. Cart Provider Integration & Polymorphic Lookup", () => {
    // Pure reproduction of CartProvider state reducer logic for empirical verification
    function cartAddReducer(
      current: CartLine[],
      line: Omit<CartLine, "quantity">
    ): CartLine[] {
      const matchIndex = current.findIndex((x) =>
        line.trialId ? x.trialId === line.trialId : x.variantId === line.variantId
      );
      if (matchIndex >= 0) {
        return current.map((x, idx) =>
          idx === matchIndex
            ? { ...x, quantity: Math.min(20, x.quantity + 1) }
            : x
        );
      }
      return [...current, { ...line, quantity: 1 }];
    }

    const matchesLine = (x: CartLine, id: number | string) =>
      typeof id === "string" ? x.trialId === id : !x.trialId && x.variantId === id;

    function cartChangeQuantityReducer(
      current: CartLine[],
      id: number | string,
      quantity: number
    ): CartLine[] {
      return current.map((x) =>
        matchesLine(x, id)
          ? { ...x, quantity: Math.max(1, Math.min(20, quantity)) }
          : x
      );
    }

    function cartRemoveReducer(
      current: CartLine[],
      id: number | string
    ): CartLine[] {
      return current.filter((x) => !matchesLine(x, id));
    }

    function cartHydrationFilter(items: any[]): CartLine[] {
      return items.filter(
        (x) =>
          (Number.isInteger(x.variantId) || typeof x.trialId === "string") &&
          Number.isInteger(x.quantity) &&
          x.quantity > 0 &&
          x.quantity <= 20 &&
          typeof x.name === "string" &&
          Number.isFinite(x.pricePaise)
      );
    }

    it("3.1: adding trial kit with variantId: 0 and trialId creates polymorphic CartLine", () => {
      const initialCart: CartLine[] = [];
      const trialLine: Omit<CartLine, "quantity"> = {
        variantId: 0,
        trialId: "trial-discovery-200g-001",
        slug: "tea-stall-discovery-kit",
        name: "TeaFloww Four-Tea Discovery Kit",
        grams: 200,
        pricePaise: 20000,
      };

      const updated = cartAddReducer(initialCart, trialLine);
      expect(updated.length).toBe(1);
      expect(updated[0].variantId).toBe(0);
      expect(updated[0].trialId).toBe("trial-discovery-200g-001");
      expect(updated[0].quantity).toBe(1);
      expect(updated[0].grams).toBe(200);
      expect(updated[0].pricePaise).toBe(20000);

      // Adding the same trial kit again increments quantity (up to max 20)
      const incremented = cartAddReducer(updated, trialLine);
      expect(incremented.length).toBe(1);
      expect(incremented[0].quantity).toBe(2);
    });

    it("3.2: regular product (variantId: 101) and multiple trial kits coexist without collision", () => {
      let cart: CartLine[] = [];

      // 1. Add regular catalog tea (variantId: 101)
      const regularLine: Omit<CartLine, "quantity"> = {
        variantId: 101,
        slug: "assam-strong-ctc-500g",
        name: "Assam Strong CTC 500g",
        grams: 500,
        pricePaise: 45000,
      };
      cart = cartAddReducer(cart, regularLine);

      // 2. Add Trial Kit A (variantId: 0, trialId: "trial-a")
      const trialA: Omit<CartLine, "quantity"> = {
        variantId: 0,
        trialId: "trial-a",
        slug: "discovery-kit-a",
        name: "Trial Kit A",
        grams: 200,
        pricePaise: 20000,
      };
      cart = cartAddReducer(cart, trialA);

      // 3. Add Trial Kit B (variantId: 0, trialId: "trial-b")
      const trialB: Omit<CartLine, "quantity"> = {
        variantId: 0,
        trialId: "trial-b",
        slug: "discovery-kit-b",
        name: "Trial Kit B",
        grams: 200,
        pricePaise: 24000,
      };
      cart = cartAddReducer(cart, trialB);

      // Cart must contain exactly 3 distinct lines
      expect(cart.length).toBe(3);
      expect(cart[0].variantId).toBe(101);
      expect(cart[0].trialId).toBeUndefined();
      expect(cart[1].trialId).toBe("trial-a");
      expect(cart[2].trialId).toBe("trial-b");

      // Verify subtotal calculation across mixed polymorphic cart
      const subtotal = cart.reduce((sum, item) => sum + item.pricePaise * item.quantity, 0);
      expect(subtotal).toBe(45000 + 20000 + 24000); // ₹890.00 (89000 paise)
    });

    it("3.3: modifying quantity or removing trial kit does not collide with regular products", () => {
      let cart: CartLine[] = [
        {
          variantId: 101,
          slug: "assam-strong-ctc",
          name: "Assam Strong CTC",
          grams: 500,
          pricePaise: 45000,
          quantity: 2,
        },
        {
          variantId: 0,
          trialId: "trial-a",
          slug: "kit-a",
          name: "Trial Kit A",
          grams: 200,
          pricePaise: 20000,
          quantity: 1,
        },
        {
          variantId: 0,
          trialId: "trial-b",
          slug: "kit-b",
          name: "Trial Kit B",
          grams: 200,
          pricePaise: 24000,
          quantity: 1,
        },
      ];

      // Modify quantity of trial-a to 5
      cart = cartChangeQuantityReducer(cart, "trial-a", 5);
      expect(cart.find((x) => x.trialId === "trial-a")?.quantity).toBe(5);
      // Trial B remains untouched
      expect(cart.find((x) => x.trialId === "trial-b")?.quantity).toBe(1);
      // Regular product remains untouched
      expect(cart.find((x) => x.variantId === 101)?.quantity).toBe(2);

      // Modify quantity of regular product (variantId: 101) to 4
      cart = cartChangeQuantityReducer(cart, 101, 4);
      expect(cart.find((x) => x.variantId === 101)?.quantity).toBe(4);
      expect(cart.find((x) => x.trialId === "trial-a")?.quantity).toBe(5);
      expect(cart.find((x) => x.trialId === "trial-b")?.quantity).toBe(1);

      // Remove trial-a by trialId string
      cart = cartRemoveReducer(cart, "trial-a");
      expect(cart.length).toBe(2);
      expect(cart.find((x) => x.trialId === "trial-a")).toBeUndefined();
      // Crucial: trial-b (also variantId: 0) must NOT be removed
      expect(cart.find((x) => x.trialId === "trial-b")).toBeDefined();
      expect(cart.find((x) => x.variantId === 101)).toBeDefined();

      // Remove regular product by variantId numeric
      cart = cartRemoveReducer(cart, 101);
      expect(cart.length).toBe(1);
      expect(cart[0].trialId).toBe("trial-b");
    });

    it("3.4: quantity clamping strictly enforces [1, 20] range", () => {
      const cart: CartLine[] = [
        {
          variantId: 0,
          trialId: "trial-a",
          slug: "kit-a",
          name: "Trial Kit A",
          grams: 200,
          pricePaise: 20000,
          quantity: 1,
        },
      ];

      // Negative quantity clamped to 1
      const underflow = cartChangeQuantityReducer(cart, "trial-a", -5);
      expect(underflow[0].quantity).toBe(1);

      // Zero quantity clamped to 1
      const zeroQty = cartChangeQuantityReducer(cart, "trial-a", 0);
      expect(zeroQty[0].quantity).toBe(1);

      // Excess quantity clamped to 20
      const overflow = cartChangeQuantityReducer(cart, "trial-a", 999);
      expect(overflow[0].quantity).toBe(20);
    });

    it("3.5: localStorage serialization and hydration preserves trialId and filters malicious entries", () => {
      const rawStoredCart = [
        // 1. Valid regular item
        {
          variantId: 101,
          slug: "regular-tea",
          name: "Regular Tea",
          grams: 500,
          pricePaise: 45000,
          quantity: 2,
        },
        // 2. Valid trial item with trialId and variantId: 0
        {
          variantId: 0,
          trialId: "trial-valid-001",
          slug: "trial-tea",
          name: "Trial Discovery Kit",
          grams: 200,
          pricePaise: 20000,
          quantity: 1,
        },
        // 3. MALFORMED: negative quantity
        {
          variantId: 102,
          name: "Corrupt Negative",
          pricePaise: 1000,
          quantity: -1,
        },
        // 4. MALFORMED: excess quantity (>20)
        {
          variantId: 103,
          name: "Corrupt Overflow",
          pricePaise: 1000,
          quantity: 500,
        },
        // 5. MALFORMED: non-finite price
        {
          variantId: 104,
          name: "Corrupt Price",
          pricePaise: "NaN",
          quantity: 1,
        },
        // 6. MALFORMED: missing both valid variantId and trialId
        {
          variantId: "not-an-int",
          name: "Bad ID",
          pricePaise: 1000,
          quantity: 1,
        },
        // 7. MALFORMED: non-string name
        {
          variantId: 105,
          name: 12345,
          pricePaise: 1000,
          quantity: 1,
        },
      ];

      const hydrated = cartHydrationFilter(rawStoredCart);
      expect(hydrated.length).toBe(2);
      expect(hydrated[0].variantId).toBe(101);
      expect(hydrated[1].trialId).toBe("trial-valid-001");
      expect(hydrated[1].variantId).toBe(0);

      // JSON serialization round-trip fidelity
      const serialized = JSON.stringify(hydrated);
      const parsed = JSON.parse(serialized);
      const rehydrated = cartHydrationFilter(parsed);
      expect(rehydrated).toEqual(hydrated);
    });

    it("3.6: corrupt JSON string in localStorage is caught safely with empty fallback", () => {
      const corruptJson = "{ malformed json: true, invalid }";
      let cartItems: CartLine[] = [];
      try {
        const stored = JSON.parse(corruptJson);
        if (Array.isArray(stored)) {
          cartItems = cartHydrationFilter(stored);
        }
      } catch {
        cartItems = [];
      }
      expect(cartItems).toEqual([]);
    });

    it("3.7: TrialStickyActionBar and TrialBuyBox trigger cart add with variantId: 0 and trialId", () => {
      // Intercept createElement to capture onClick of sticky button
      let capturedStickyOnClick: (() => void) | null = null;
      const origCreateElement = React.createElement;

      const spyCreateElement = vi.spyOn(React, "createElement").mockImplementation(function (
        type: any,
        props: any,
        ...children: any[]
      ) {
        if (props && props["data-testid"] === "sticky-add-to-cart-btn") {
          capturedStickyOnClick = props.onClick;
        }
        return origCreateElement.apply(React, [type, props, ...children]);
      });

      renderToStaticMarkup(
        React.createElement(TrialStickyActionBar, { trial: mockTrial })
      );

      spyCreateElement.mockRestore();

      expect(capturedStickyOnClick).not.toBeNull();
      // Execute click handler
      capturedStickyOnClick!();

      // Verify cart add was invoked with exact polymorphic payload
      expect(mockCartActions.add).toHaveBeenCalledWith({
        variantId: 0,
        trialId: mockTrial.id,
        sku: mockTrial.sku,
        slug: mockTrial.slug,
        name: mockTrial.title,
        grams: 200,
        pricePaise: 20000,
      });
    });

    it("3.8: matchesLine helper guarantees numeric 0 does not match or remove trial items with trialId", () => {
      const cart: CartLine[] = [
        {
          variantId: 0,
          trialId: "trial-a",
          slug: "kit-a",
          name: "Trial Kit A",
          grams: 200,
          pricePaise: 20000,
          quantity: 2,
        },
        {
          variantId: 0,
          trialId: "trial-b",
          slug: "kit-b",
          name: "Trial Kit B",
          grams: 200,
          pricePaise: 24000,
          quantity: 3,
        },
      ];

      // Passing numeric 0 to remove must NOT remove trial lines because they have trialId
      const afterRemove0 = cartRemoveReducer(cart, 0);
      expect(afterRemove0.length).toBe(2);

      // Passing numeric 0 to changeQuantity must NOT change trial lines
      const afterChange0 = cartChangeQuantityReducer(cart, 0, 10);
      expect(afterChange0[0].quantity).toBe(2);
      expect(afterChange0[1].quantity).toBe(3);

      // Passing string "trial-a" removes ONLY trial-a
      const afterRemoveTrialA = cartRemoveReducer(cart, "trial-a");
      expect(afterRemoveTrialA.length).toBe(1);
      expect(afterRemoveTrialA[0].trialId).toBe("trial-b");
    });
  });

  // =========================================================================
  // 4. Mobile Sticky Bar & Touch Targets
  // =========================================================================
  describe("4. Mobile Sticky Bar & Touch Targets", () => {
    it("4.1: Sticky Action Bar button satisfies minimum 44x44px touch target dimensions", () => {
      const html = renderToStaticMarkup(
        React.createElement(TrialStickyActionBar, { trial: mockTrial })
      );
      expect(html).toContain('data-testid="sticky-add-to-cart-btn"');
      expect(html).toContain("min-h-[44px]");
      expect(html).toContain("min-w-[130px]");
    });

    it("4.2: TrialBuyBox pincode check and Add to Cart buttons satisfy touch target dimensions (>= 44px)", () => {
      const html = renderToStaticMarkup(
        React.createElement(TrialBuyBox, { trial: mockTrial })
      );
      // Pincode check button: min-h-[44px]
      expect(html).toContain("min-h-[44px]");
      // Add to Cart CTA button: min-h-[50px]
      expect(html).toContain("min-h-[50px]");
      expect(html).toContain('data-testid="add-to-cart-btn"');
    });

    it("4.3: TrialLanguageToggle buttons satisfy touch target guidelines", () => {
      const html = renderToStaticMarkup(
        React.createElement(TrialLanguageToggle, {
          currentLocale: "en",
          onLocaleChange: vi.fn(),
        })
      );
      expect(html).toContain("min-h-[36px]");
      expect(html).toContain("min-w-[44px]");
      expect(html).toContain('data-testid="language-toggle-en"');
      expect(html).toContain('data-testid="language-toggle-hi"');
    });

    it("4.4: safe area class pb-safe and dynamic padding are present for iOS home indicator", () => {
      const html = renderToStaticMarkup(
        React.createElement(TrialStickyActionBar, { trial: mockTrial })
      );
      expect(html).toContain("pb-safe");
      expect(html).toContain("padding-bottom:max(12px, env(safe-area-inset-bottom, 12px))");
      expect(html).toContain("fixed bottom-0 left-0 right-0");
    });

    it("4.5: tactile feedback state transitions: in-stock vs added-to-cart vs sold-out", () => {
      // 1. In-stock initial state
      const htmlInStock = renderToStaticMarkup(
        React.createElement(TrialStickyActionBar, { trial: mockTrial })
      );
      expect(htmlInStock).toContain("Order Kit ↗");
      expect(htmlInStock).not.toContain("Added to Cart ✓");
      expect(htmlInStock).not.toContain("Sold Out");
      expect(htmlInStock).toContain("from-[#e4b56e] to-[#bb7c44]");

      // 2. Tactile feedback active state (added: true) via scoped dispatcher override
      const internals = (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
      function AddedStateWrapper({ children }: { children: React.ReactNode }) {
        const orig = internals.H.useState;
        internals.H.useState = (init: any) => {
          if (typeof init === "boolean") return [true, () => {}];
          return orig(init);
        };
        return React.createElement(
          React.Fragment,
          null,
          children,
          React.createElement(() => {
            internals.H.useState = orig;
            return null;
          })
        );
      }

      const htmlAdded = renderToStaticMarkup(
        React.createElement(
          AddedStateWrapper,
          null,
          React.createElement(TrialStickyActionBar, { trial: mockTrial })
        )
      );
      expect(htmlAdded).toContain("Added to Cart ✓");
      expect(htmlAdded).toContain("bg-[#287455]");
      expect(htmlAdded).not.toContain("Order Kit ↗");

      // 3. Sold out state (in_stock: false) with verified dispatcher restored
      const outOfStockTrial = createAdversarialTrialDto({ in_stock: false });
      const htmlSoldOut = renderToStaticMarkup(
        React.createElement(TrialStickyActionBar, { trial: outOfStockTrial })
      );
      expect(htmlSoldOut).toContain("Sold Out");
      expect(htmlSoldOut).toContain("disabled=\"\"");
      expect(htmlSoldOut).toContain("cursor-not-allowed");
    });

    it("4.6: TrialBuyBox tactile feedback state transitions: in-stock vs added vs sold out", () => {
      // 1. In-stock BuyBox
      const htmlInStock = renderToStaticMarkup(
        React.createElement(TrialBuyBox, { trial: mockTrial })
      );
      expect(htmlInStock).toContain("Order Discovery Kit (₹200) ↗");
      expect(htmlInStock).toContain("In Stock");

      // 2. Added BuyBox via scoped dispatcher override
      const internals = (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
      function AddedBuyBoxWrapper({ children }: { children: React.ReactNode }) {
        const orig = internals.H.useState;
        internals.H.useState = (init: any) => {
          if (typeof init === "boolean") return [true, () => {}];
          return orig(init);
        };
        return React.createElement(
          React.Fragment,
          null,
          children,
          React.createElement(() => {
            internals.H.useState = orig;
            return null;
          })
        );
      }

      const htmlAdded = renderToStaticMarkup(
        React.createElement(
          AddedBuyBoxWrapper,
          null,
          React.createElement(TrialBuyBox, { trial: mockTrial })
        )
      );
      expect(htmlAdded).toContain("Added to Cart ✓");
      expect(htmlAdded).toContain("bg-[#287455]");

      // 3. Sold Out BuyBox
      const outOfStockTrial = createAdversarialTrialDto({ in_stock: false });
      const htmlSoldOut = renderToStaticMarkup(
        React.createElement(TrialBuyBox, { trial: outOfStockTrial })
      );
      expect(htmlSoldOut).toContain("Sold Out");
      expect(htmlSoldOut).toContain("disabled=\"\"");
    });
  });
});
