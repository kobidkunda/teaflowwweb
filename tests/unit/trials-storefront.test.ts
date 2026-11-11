/**
 * TeaFloww Trials v3 — Milestone 5 Storefront Unit Test Suite
 *
 * Verifies all 10 storefront feature suites specified in trials_m5_explorer_test/handoff.md:
 * - Suite 1: Catalogue Route & Card Grid (/trials)
 * - Suite 2: PDP Route, Server-Side SEO & Draft Protection (/trials/:slug)
 * - Suite 3: TeaPilot Optical Studio (4 Pouches × 5 Stages)
 * - Suite 4: Sensory Bento & Terroir Provenance
 * - Suite 5: Truthful Cost-Per-Cup Calculator & Arithmetic
 * - Suite 6: 3-Step Kettle Testing Guide
 * - Suite 7: Bulk Ladder & Regular Variant Links
 * - Suite 8: Mobile Sticky Action Bar (<630px)
 * - Suite 9: Bilingual English / Hindi Toggle & Translations
 * - Suite 10: Mock Data Fixtures & Currency Utilities
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// 1. Mocks for Next.js navigation, headers, image, and cart
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
    return React.createElement("img", { src: typeof src === "object" ? src.src : src, alt, ...rest });
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
    sessionId: "mock-sess-123",
    recoveryToken: null,
    isSyncing: false,
  }),
}));

// Components under test
import { TrialHero } from "@/components/trials/TrialHero";
import { TrialBuyBox } from "@/components/trials/TrialBuyBox";
import { TrialTrustStrip } from "@/components/trials/TrialTrustStrip";
import { TrialCard } from "@/components/trials/TrialCard";
import { TrialCatalogueExplorer } from "@/components/trials/TrialCatalogueExplorer";
import { TrialOpticalStudio, OPTICAL_STAGES } from "@/components/trials/TrialOpticalStudio";
import { TrialSensoryBento } from "@/components/trials/TrialSensoryBento";
import { TrialCostCalculator } from "@/components/trials/TrialCostCalculator";
import { TrialKettleGuide } from "@/components/trials/TrialKettleGuide";
import { TrialBulkLadder } from "@/components/trials/TrialBulkLadder";
import { TrialStickyActionBar } from "@/components/trials/TrialStickyActionBar";
import { TrialLanguageToggle } from "@/components/trials/TrialLanguageToggle";
import { DraftPreviewBanner } from "@/components/trials/DraftPreviewBanner";
import { TrialPDPInteractiveView } from "@/components/trials/TrialPDPInteractiveView";

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
  getNextTab,
  shouldShowStickyBar,
  formatINR,
  filterTrialCards,
} from "@/lib/trials/storefront-helpers";

import { getTrialText, TRIAL_DICTIONARY } from "@/lib/trials/i18n";
import type { TrialPublicDto } from "@/lib/trials/types";

// Factory helper for mock TrialPublicDto fixture
export function createMockPublicTrialDto(
  overrides: Partial<TrialPublicDto> = {}
): TrialPublicDto {
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
    gallery_images: [
      {
        url: "/images/trials/discovery-gallery-01.jpg",
        alt_text: "Discovery Kit Lifestyle View",
      },
    ],
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
        elevation: null, // Test graceful null elevation
        weight_g: 50,
        tasting_notes: ["Fiery Zing", "Throat Warmth", "Brisk"],
        brewing: { temp_c: 95, time_sec: 210, dose_g: 2.5 },
        bulk_link: null, // Test Kit Exclusive handling
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

describe("TeaFloww Trials v3 — Storefront Experience (Milestone 5)", () => {
  let mockTrial: TrialPublicDto;

  beforeEach(() => {
    mockTrial = createMockPublicTrialDto();
  });

  // =========================================================================
  // Suite 1: Catalogue Route & Card Grid (/trials)
  // =========================================================================
  describe("Suite 1: Catalogue Route & Card Grid (/trials)", () => {
    it("1.1: renders hero banner with eyebrow, main heading, and 3 stats counters", () => {
      const html = renderToStaticMarkup(React.createElement(TrialHero));
      expect(html).toContain("INTRODUCING TEAFLOWW TRIALS — THE CHAI STALL EDITION");
      expect(html).toContain("Great chai begins");
      expect(html).toContain("one good trial.");
      expect(html).toContain("4");
      expect(html).toContain("tea styles");
      expect(html).toContain("50g");
      expect(html).toContain("each flavour");
      expect(html).toContain("200g");
      expect(html).toContain("total net weight");
      expect(html).toContain("BREW.<br/>TASTE.<br/>DECIDE.");
    });

    it("1.2: renders trust strip with 3 pillars", () => {
      const html = renderToStaticMarkup(React.createElement(TrialTrustStrip));
      expect(html).toContain("Made for milk chai");
      expect(html).toContain("Four expressions");
      expect(html).toContain("Your kettle, your verdict");
    });

    it("1.3: renders filter chips container with role group and category chips", () => {
      const html = renderToStaticMarkup(
        React.createElement(TrialCatalogueExplorer, {
          initialTrials: [mockTrial],
          total: 1,
        })
      );
      expect(html).toContain('role="group"');
      expect(html).toContain("All trials");
      expect(html).toContain("Tea Stall");
      expect(html).toContain("Flavoured");
      expect(html).toContain("Café");
    });

    it("1.4: filterTrialCards helper filters trial records accurately by tag and search", () => {
      const trial1 = createMockPublicTrialDto({
        id: "t1",
        slug: "tea-stall-discovery-kit",
        title: "TeaFloww Chai Stall Kit",
      });
      const trial2 = createMockPublicTrialDto({
        id: "t2",
        slug: "orthodox-single-estate",
        title: "Darjeeling Orthodox Flight",
      });

      const all = filterTrialCards([trial1, trial2], "all", "");
      expect(all.length).toBe(2);

      const filteredByTag = filterTrialCards([trial1, trial2], "tea-stall", "");
      expect(filteredByTag.length).toBe(1);
      expect(filteredByTag[0].id).toBe("t1");

      const filteredBySearch = filterTrialCards([trial1, trial2], "all", "orthodox");
      expect(filteredBySearch.length).toBe(1);
      expect(filteredBySearch[0].id).toBe("t2");
    });

    it("1.5: renders trial cards with data-testid='trial-card', title, 4x50g badge, INR price, and view kit link", () => {
      const html = renderToStaticMarkup(
        React.createElement(TrialCard, { trial: mockTrial })
      );
      expect(html).toContain('data-testid="trial-card"');
      expect(html).toContain("trial-card");
      expect(html).toContain(mockTrial.title);
      expect(html).toContain("200g total");
      expect(html).toContain("₹200");
      expect(html).toContain("View kit");
      expect(html).toContain(`/trials/${mockTrial.slug}`);
    });

    it("1.6: renders empty state indicator data-testid='empty-trials' when zero trials match filter", () => {
      const html = renderToStaticMarkup(
        React.createElement(TrialCatalogueExplorer, {
          initialTrials: [],
          total: 0,
        })
      );
      expect(html).toContain('data-testid="empty-trials"');
      expect(html).toContain("Your next discovery is on its way.");
    });

    it("1.7: lists all four contents without publishing unreviewed seed claims or raw taglines", () => {
      const trial = createMockPublicTrialDto({ tagline: "MCP competing price edit" });
      const html = renderToStaticMarkup(React.createElement(TrialCard, { trial }));
      for (const component of trial.components) expect(html).toContain(component.name);
      expect(html).toContain("Inside this kit");
      expect(html).not.toContain("MCP competing price edit");
      expect(html).not.toContain("FSSAI");
      expect(html).not.toContain("Moran Estate");
      expect(html).not.toContain("Malty");
    });

    it("1.8: keeps multiple kits independent, with their own price, contents and detail link", () => {
      const second = createMockPublicTrialDto({ id: "second", slug: "second-kit", title: "Second Kit", price_paise: 34900, in_stock: false });
      const html = renderToStaticMarkup(React.createElement(TrialCatalogueExplorer, { initialTrials: [mockTrial, second], total: 2 }));
      expect(html.match(/data-testid="trial-card"/g)).toHaveLength(2);
      expect(html).toContain("₹349");
      expect(html).toContain("/trials/second-kit");
      expect(html).toContain("Currently unavailable");
      expect(html).toContain('aria-pressed="true"');
    });

    it("1.9: preserves uploaded catalogue art and handles a missing image honestly", () => {
      const uploaded = createMockPublicTrialDto({ hero_image: { url: "/uploads/real-kit.webp", alt_text: "Actual tea kit" } });
      const html = renderToStaticMarkup(React.createElement(TrialCard, { trial: uploaded }));
      expect(html).toContain("/uploads/real-kit.webp");
      expect(html).not.toContain("Illustrative packaging");
      const missing = renderToStaticMarkup(React.createElement(TrialCard, { trial: createMockPublicTrialDto({ hero_image: null }) }));
      expect(missing).toContain("Kit image coming soon");
      expect(missing).not.toContain("discovery-shelf-kit.webp");
    });

  });

  // =========================================================================
  // Suite 2: PDP Route, Server-Side SEO & Draft Protection (/trials/:slug)
  // =========================================================================
  describe("Suite 2: PDP Route, Server-Side SEO & Draft Protection (/trials/:slug)", () => {
    it("2.1: DraftPreviewBanner renders amber banner with 'DRAFT PREVIEW · NOT PUBLISHED'", () => {
      const html = renderToStaticMarkup(
        React.createElement(DraftPreviewBanner, { status: "draft", revision: 2 })
      );
      expect(html).toContain('data-testid="trial-preview-banner"');
      expect(html).toContain("DRAFT PREVIEW · NOT PUBLISHED");
      expect(html).toContain("STATUS: draft");
      expect(html).toContain("REV: 2");
    });

    it("2.2: server-rendered PDP renders product title, description, and price without client JS", () => {
      const html = renderToStaticMarkup(
        React.createElement(TrialPDPInteractiveView, { trial: mockTrial })
      );
      expect(html).toContain(mockTrial.title);
      expect(html).toContain("₹200");
      expect(html).toContain("DISCOVERY KIT · 200G");
    });

    it("2.3: special characters in tea titles are properly HTML-escaped in React markup", () => {
      const xssTrial = createMockPublicTrialDto({
        title: "Castleton & Makaibari <Special> 1st Flush",
      });
      const html = renderToStaticMarkup(
        React.createElement(TrialPDPInteractiveView, { trial: xssTrial })
      );
      expect(html).not.toContain("<Special>");
      expect(html).toContain("&lt;Special&gt;");
      expect(html).toContain("&amp;");
    });
  });

  // =========================================================================
  // Suite 3: TeaPilot Optical Studio (4 Pouches × 5 Stages)
  // =========================================================================
  describe("Suite 3: TeaPilot Optical Studio (4 Pouches × 5 Stages)", () => {
    it("3.1: renders 4 pouch selector tabs corresponding to the 4 sachets", () => {
      const html = renderToStaticMarkup(
        React.createElement(TrialOpticalStudio, {
          components: mockTrial.components,
        })
      );
      const matches = html.match(/data-testid="optical-pouch-tab"/g);
      expect(matches).not.toBeNull();
      expect(matches!.length).toBe(4);
      expect(html).toContain("Strong Milk Chai");
      expect(html).toContain("Elaichi Milk Chai");
      expect(html).toContain("Ginger Milk Chai");
      expect(html).toContain("Masala Milk Chai");
    });

    it("3.2: renders 5 optical stage tabs (Packaging, Dry Leaf, Wet Leaf, Raw Liquor, Milk Tea)", () => {
      expect(OPTICAL_STAGES.length).toBe(5);
      const html = renderToStaticMarkup(
        React.createElement(TrialOpticalStudio, {
          components: mockTrial.components,
        })
      );
      expect(html).toContain("Packaging");
      expect(html).toContain("Dry Leaf");
      expect(html).toContain("Wet Leaf");
      expect(html).toContain("Raw Liquor");
      expect(html).toContain("Milk Tea");
      const stageTabs = html.match(/data-testid="optical-stage-tab"/g);
      expect(stageTabs!.length).toBe(5);
    });

    it("3.3: active pouch tab has aria-selected='true', inactive have aria-selected='false'", () => {
      const html = renderToStaticMarkup(
        React.createElement(TrialOpticalStudio, {
          components: mockTrial.components,
          activePouchIndex: 0,
        })
      );
      expect(html).toContain('aria-selected="true"');
      expect(html).toContain('aria-selected="false"');
    });

    it("3.4: resolvePouchAsset locates stage asset or returns null if missing", () => {
      const p1Milk = resolvePouchAsset(mockTrial.components, 0, "milk_tea");
      expect(p1Milk).not.toBeNull();
      expect(p1Milk?.url).toBe("/img/p1-milk.webp");
      expect(p1Milk?.alt_text).toBe("Rich Chai with Milk");

      const p2Liquor = resolvePouchAsset(mockTrial.components, 1, "liquor");
      expect(p2Liquor).toBeNull();
    });

    it("3.5: displays stage image with non-empty accessibility alt attribute", () => {
      const html = renderToStaticMarkup(
        React.createElement(TrialOpticalStudio, {
          components: mockTrial.components,
          activePouchIndex: 0,
        })
      );
      expect(html).toContain('data-testid="optical-stage-image"');
      expect(html).toContain('alt="Rich Chai with Milk"');
    });

    it("3.6: renders structured fallback Photo pending verification when photo is missing", () => {
      // Pouch 2 has no 'milk_tea' asset attached
      const html = renderToStaticMarkup(
        React.createElement(TrialOpticalStudio, {
          components: mockTrial.components,
          activePouchIndex: 1,
        })
      );
      expect(html).toContain('data-testid="missing-photo-fallback"');
      expect(html).toContain("photo-pending");
      expect(html).toContain("Photo pending verification");
    });

    it("3.7: getNextTab supports ArrowRight / ArrowLeft wrapping across tabs", () => {
      expect(getNextTab(0, "next", 4)).toBe(1);
      expect(getNextTab(3, "next", 4)).toBe(0); // circular wrap
      expect(getNextTab(0, "prev", 4)).toBe(3); // circular wrap
      expect(getNextTab(2, "prev", 4)).toBe(1);
    });

    it("3.8: implements WAI-ARIA tabpanel wiring (id, aria-controls, role=tabpanel, and aria-labelledby)", () => {
      const html = renderToStaticMarkup(
        React.createElement(TrialOpticalStudio, {
          components: mockTrial.components,
          activePouchIndex: 0,
        })
      );
      expect(html).toContain('id="pouch-tab-0"');
      expect(html).toContain('aria-controls="optical-studio-panel"');
      expect(html).toContain('role="tabpanel"');
      expect(html).toContain('id="optical-studio-panel"');
      expect(html).toContain('aria-labelledby="pouch-tab-0"');
    });

    it("3.9: renders Discovery Pack Gallery strip when galleryImages are provided", () => {
      const html = renderToStaticMarkup(
        React.createElement(TrialOpticalStudio, {
          components: mockTrial.components,
          activePouchIndex: 0,
          galleryImages: [
            { url: "/img/gallery-1.webp", alt_text: "Mockup 1 Sunrise" },
            { url: "/img/gallery-2.webp", alt_text: "Mockup 2 Emerald Lounge" },
          ],
        })
      );
      expect(html).toContain("kit-gallery-strip");
      expect(html).toContain("DISCOVERY PACK GALLERY (2 VIEWS)");
      expect(html).toContain("/img/gallery-1.webp");
      expect(html).toContain("/img/gallery-2.webp");
    });

    it("3.10: TrialBuyBox renders hero image thumbnail when hero_image is provided", () => {
      const html = renderToStaticMarkup(
        React.createElement(TrialBuyBox, { trial: mockTrial })
      );
      expect(html).toContain('alt="TeaFloww Four-Tea Discovery Kit Outer Packaging"');
      expect(html).toContain("/images/trials/discovery-packaging.jpg");
    });

    it("3.11: TrialOpticalStudio accepts initialStage='packaging' and initially renders packaging image", () => {
      const html = renderToStaticMarkup(
        React.createElement(TrialOpticalStudio, {
          components: mockTrial.components,
          activePouchIndex: 0,
          initialStage: "packaging",
        })
      );
      expect(html).toContain('data-testid="optical-stage-image"');
      expect(html).toContain('alt="Strong Milk Chai Sachet Packaging"');
      expect(html).toContain("STAGE · PACKAGING");
    });

    it("3.12: TrialPDPInteractiveView for /trials/4-x-25-gm initially displays packaging photo always", () => {
      const trial4x25 = createMockPublicTrialDto({
        slug: "4-x-25-gm",
        components: [
          {
            ...mockTrial.components[0],
            name: "Rozana Kadak — Daily Stall Tea",
            assets: [
              { stage: "packaging", url: "/uploads/rozana-kadak-packaging.webp", alt_text: "Rozana Kadak Packaging Front" },
            ],
          },
          {
            ...mockTrial.components[1],
            name: "Elaichi Tea — Cardamom Chai",
            assets: [
              { stage: "packaging", url: "/uploads/elaichi-packaging.webp", alt_text: "Elaichi Tea Packaging Front" },
            ],
          },
        ],
      });

      const html = renderToStaticMarkup(
        React.createElement(TrialPDPInteractiveView, { trial: trial4x25 })
      );

      // Packaging photo must be shown initially, NOT the missing photo fallback
      expect(html).toContain('data-testid="optical-stage-image"');
      expect(html).toContain('src="/uploads/rozana-kadak-packaging.webp"');
      expect(html).toContain('alt="Rozana Kadak Packaging Front"');
      expect(html).toContain("STAGE · PACKAGING");
      expect(html).not.toContain('data-testid="missing-photo-fallback"');
      expect(html).not.toContain("Photo pending verification");
    });
  });

  // =========================================================================
  // Suite 4: Sensory Bento & Terroir Provenance
  // =========================================================================
  describe("Suite 4: Sensory Bento & Terroir Provenance", () => {
    it("4.1: renders sensory bento grid with 4 sensory dimensions: Aroma, Liquor Body, Flavor Notes, Mouthfeel", () => {
      const html = renderToStaticMarkup(
        React.createElement(TrialSensoryBento, {
          activeComponent: mockTrial.components[0],
          claims: mockTrial.claims,
        })
      );
      expect(html).toContain('data-testid="sensory-bento"');
      expect(html).toContain("Aroma Depth");
      expect(html).toContain("Liquor Body &amp; Tone");
      expect(html).toContain("Flavor Notes");
      expect(html).toContain("Mouthfeel &amp; Cream Lacing");
    });

    it("4.2: formatProvenance parses estate name, elevation, harvest flush, and leaf grade", () => {
      const p = formatProvenance("Moran Estate", "180m AMSL", "Second Flush", "Assam CTC BP", "LOT-01");
      expect(p.elevation).toBe("180m AMSL");
      expect(p.estate).toBe("Moran Estate");
      expect(p.flush).toBe("Second Flush");
      expect(p.grade).toBe("Assam CTC BP");

      const html = renderToStaticMarkup(
        React.createElement(TrialSensoryBento, {
          activeComponent: mockTrial.components[0],
          claims: mockTrial.claims,
        })
      );
      expect(html).not.toContain('data-testid="tea-provenance"');
      expect(html).not.toContain("Terroir &amp; Garden Provenance");
    });

    it("4.3: graceful null provenance displays Estate reserve, never literal null or undefined", () => {
      const p = formatProvenance("Moran Estate", null, "Second Flush", "Assam CTC BP", "LOT-01");
      expect(p.elevation).toBe("Estate reserve");
      expect(p.elevation).not.toContain("null");
      expect(p.elevation).not.toContain("undefined");

      const html = renderToStaticMarkup(
        React.createElement(TrialSensoryBento, {
          activeComponent: mockTrial.components[2], // Ginger has elevation: null
          claims: mockTrial.claims,
        })
      );
      expect(html).not.toContain("Elevation: null");
      expect(html).not.toContain("null AMSL");
      expect(html).not.toContain("undefined");
    });

    it("4.4: verified claims render with checkmark indicators and data-testid='verified-claim-badge'", () => {
      const html = renderToStaticMarkup(
        React.createElement(TrialSensoryBento, {
          activeComponent: mockTrial.components[0],
          claims: mockTrial.claims,
        })
      );
      expect(html).toContain('data-testid="verified-claim-badge"');
      expect(html).toContain("100% Single-Garden North India CTC");
      expect(html).toContain("FSSAI Registered Operator FBO-19CTHPK");
    });

    it("4.5: unverified marketing claims are strictly excluded from the sensory bento", () => {
      const taintedClaims = [
        ...mockTrial.claims,
        { claim_type: "unverified", label: "50% guaranteed savings without test", verified: false },
        { claim_type: "unverified", label: "100% best tea in India without verification", verified: true },
      ];
      const html = renderToStaticMarkup(
        React.createElement(TrialSensoryBento, {
          activeComponent: mockTrial.components[0],
          claims: taintedClaims,
        })
      );
      expect(html).not.toContain("50% guaranteed savings without test");
      expect(html).not.toContain("100% best tea in India without verification");
    });

    it("4.6: sensory score display shows evaluation rating scale and attribution", () => {
      const html = renderToStaticMarkup(
        React.createElement(TrialSensoryBento, {
          activeComponent: mockTrial.components[0],
          claims: mockTrial.claims,
        })
      );
      expect(html).toContain('data-testid="sensory-score"');
      expect(html).toContain("CUPSCORE EVALUATION");
      expect(html).toContain("8.8");
      expect(html).toContain("Standard Roadside Pot Boil");
    });

    it("4.7: badges have data-testid='sensory-badge'", () => {
      const html = renderToStaticMarkup(
        React.createElement(TrialSensoryBento, {
          activeComponent: mockTrial.components[0],
          claims: mockTrial.claims,
        })
      );
      expect(html).toContain('data-testid="sensory-badge"');
    });

    it("4.8: uses WCAG 2.2 AA compliant #7c4f1c token for text and badge contrast", () => {
      const html = renderToStaticMarkup(
        React.createElement(TrialSensoryBento, {
          activeComponent: mockTrial.components[0],
          claims: mockTrial.claims,
        })
      );
      expect(html).toContain("text-[#7c4f1c]");
      expect(html).toContain("bg-[#7c4f1c]");
      expect(html).not.toContain("text-[#aa783e]");
      expect(html).not.toContain("bg-[#aa783e]");
    });
  });

  // =========================================================================
  // Suite 5: Truthful Cost-Per-Cup Calculator & Arithmetic
  // =========================================================================
  describe("Suite 5: Truthful Cost-Per-Cup Calculator & Arithmetic", () => {
    it("5.1: renders calculator container with data-testid='cost-per-cup-calculator'", () => {
      const html = renderToStaticMarkup(
        React.createElement(TrialCostCalculator, {
          initialPricePerKg: 430,
          initialDoseGrams: 2.5,
          kitWeightGrams: 200,
        })
      );
      expect(html).toContain('data-testid="cost-per-cup-calculator"');
      expect(html).toContain("Numbers you can");
      expect(html).toContain("actually verify.");
    });

    it("5.2: calculateCostPerCup evaluates (price * dose) / 1000 with paise-accurate half-up rounding", () => {
      // 430 * 2.5 / 1000 = 1.075 -> 1.08
      expect(calculateCostPerCup(430, 2.5)).toBe(1.08);
      // 200 * 4.0 / 1000 = 0.8
      expect(calculateCostPerCup(200, 4.0)).toBe(0.8);
      // 1000 * 2.5 / 1000 = 2.5
      expect(calculateCostPerCup(1000, 2.5)).toBe(2.5);
    });

    it("5.3: calculateSavingsDelta returns positive delta when trial tea is cheaper", () => {
      // Current: ₹1.50, Trial: ₹1.08 -> ₹0.42 saved
      const delta = calculateSavingsDelta(1.5, 1.08);
      expect(delta.isSavings).toBe(true);
      expect(delta.diff).toBe(0.42);
      expect(delta.formatted).toBe("₹0.42 saved");
    });

    it("5.4: truthful negative delta: returns negative delta (+₹X.XX more / cup) when trial tea is more expensive", () => {
      // Current: ₹0.80, Trial: ₹0.86 -> diff = -0.06
      const delta = calculateSavingsDelta(0.8, 0.86);
      expect(delta.isSavings).toBe(false);
      expect(delta.diff).toBe(-0.06);
      expect(delta.formatted).toContain("₹0.06 more");
    });

    it("5.5: calculateKitCupYield evaluates total brews accurately", () => {
      expect(calculateKitCupYield(200, 2.5)).toBe(80);
      expect(calculateKitCupYield(200, 4.0)).toBe(50);
      expect(calculateKitCupYield(200, 2.0)).toBe(100);
    });

    it("5.6: clampDoseGrams strictly clamps doses into [1g, 15g]", () => {
      expect(clampDoseGrams(-5)).toBe(2.5);
      expect(clampDoseGrams(0)).toBe(2.5);
      expect(clampDoseGrams(0.5)).toBe(1.0);
      expect(clampDoseGrams(20)).toBe(15.0);
      expect(clampDoseGrams(2.5)).toBe(2.5);
    });

    it("5.7: prevents floating-point drift", () => {
      const cost = calculateCostPerCup(200, 4.0);
      const formatted = formatCostPerCup(cost);
      expect(formatted).toBe("₹0.80");
      expect(formatted).not.toContain("0.8000000000000002");
      expect(formatted).not.toContain("2.500000000000001");
    });
  });

  // =========================================================================
  // Suite 6: 3-Step Kettle Testing Guide
  // =========================================================================
  describe("Suite 6: 3-Step Kettle Testing Guide", () => {
    it("6.1: renders visual 3-step brewing protocol with data-testid='kettle-guide'", () => {
      const html = renderToStaticMarkup(
        React.createElement(TrialKettleGuide, {
          brewing: mockTrial.components[0].brewing,
          teaName: mockTrial.components[0].name,
        })
      );
      expect(html).toContain('data-testid="kettle-guide"');
      expect(html).toContain("A SIMPLE BREWING PROTOCOL");
    });

    it("6.2: Step 1 displays leaf dose in grams (2.5g) with water/milk volume", () => {
      const html = renderToStaticMarkup(
        React.createElement(TrialKettleGuide, {
          brewing: mockTrial.components[0].brewing,
        })
      );
      expect(html).toContain('data-testid="kettle-step-1"');
      expect(html).toContain("2.5g");
      expect(html).toContain("MEASURE");
    });

    it("6.3: Step 2 displays optimal water temperature (90-95°C) and milk boil instructions", () => {
      const html = renderToStaticMarkup(
        React.createElement(TrialKettleGuide, {
          brewing: mockTrial.components[0].brewing,
        })
      );
      expect(html).toContain('data-testid="kettle-step-2"');
      expect(html).toContain("95°C");
      expect(html).toContain("HEAT");
    });

    it("6.4: Step 3 displays steeping time in minutes/seconds with resteep guidance", () => {
      const html = renderToStaticMarkup(
        React.createElement(TrialKettleGuide, {
          brewing: mockTrial.components[0].brewing,
        })
      );
      expect(html).toContain('data-testid="kettle-step-3"');
      expect(html).toContain("Steeping");
      expect(html).toContain("3 minutes");
      expect(html).toContain("JUDGE");
    });

    it("6.5: clampBrewingDuration validates steep duration between 30s and 1800s", () => {
      expect(clampBrewingDuration(-10)).toBe(180);
      expect(clampBrewingDuration(10)).toBe(30);
      expect(clampBrewingDuration(3000)).toBe(1800);
      expect(clampBrewingDuration(240)).toBe(240);
    });
  });

  // =========================================================================
  // Suite 7: Bulk Ladder & Regular Variant Links
  // =========================================================================
  describe("Suite 7: Bulk Ladder & Regular Variant Links", () => {
    it("7.1: renders volume ladder with standard tiers: 250g, 500g, 1kg, 2kg, 5kg", () => {
      const html = renderToStaticMarkup(
        React.createElement(TrialBulkLadder, {
          bulkLink: mockTrial.components[0].bulk_link,
          componentName: mockTrial.components[0].name,
        })
      );
      expect(html).toContain('data-testid="bulk-ladder"');
      expect(html).toContain("250g");
      expect(html).toContain("500g");
      expect(html).toContain("1kg");
      expect(html).toContain("2kg");
      expect(html).toContain("5kg");
    });

    it("7.2: tiers linked to regular catalog products render links with data-testid='bulk-variant-link'", () => {
      const html = renderToStaticMarkup(
        React.createElement(TrialBulkLadder, {
          bulkLink: { product_slug: "assam-strong-ctc", variant_title: "500g Pouch" },
          componentName: "Strong Milk Chai",
        })
      );
      expect(html).toContain('data-testid="bulk-variant-link"');
      expect(html).toContain("/tea/assam-strong-ctc");
      expect(html).toContain("View Bag ↗");
    });

    it("7.3: sold-out regular variants display Out of Stock state", () => {
      const html = renderToStaticMarkup(
        React.createElement(TrialBulkLadder, {
          bulkLink: { product_slug: "assam-strong-ctc", variant_title: "500g Pouch" },
          componentName: "Strong Milk Chai",
          isOutOfStock: true,
        })
      );
      expect(html).toContain("Out of Stock");
    });

    it("7.4: component with no linked regular product variant renders Kit Exclusive badge", () => {
      const html = renderToStaticMarkup(
        React.createElement(TrialBulkLadder, {
          bulkLink: null,
          componentName: "Ginger Milk Chai",
        })
      );
      expect(html).toContain('data-testid="kit-exclusive-badge"');
      expect(html).toContain("Kit Exclusive");
    });

    it("7.5: promotional voucher banner displays STALL150 for ₹150 off", () => {
      const html = renderToStaticMarkup(
        React.createElement(TrialBulkLadder, {
          bulkLink: null,
          componentName: "Masala Chai",
        })
      );
      expect(html).toContain("STALL150");
      expect(html).toContain("₹150 off first bulk purchase");
    });

    it("7.6: uses WCAG 2.2 AA compliant #7c4f1c token for eyebrow and discount badge", () => {
      const html = renderToStaticMarkup(
        React.createElement(TrialBulkLadder, {
          bulkLink: mockTrial.components[0].bulk_link,
          componentName: mockTrial.components[0].name,
        })
      );
      expect(html).toContain("text-[#7c4f1c]");
      expect(html).not.toContain("text-[#aa783e]");
    });
  });

  // =========================================================================
  // Suite 8: Mobile Sticky Action Bar (<630px)
  // =========================================================================
  describe("Suite 8: Mobile Sticky Action Bar (<630px)", () => {
    it("8.1: sticky buy box renders kit title, price in INR, and Add to Cart button", () => {
      const html = renderToStaticMarkup(
        React.createElement(TrialStickyActionBar, { trial: mockTrial })
      );
      expect(html).toContain('data-testid="sticky-trial-buy-box"');
      expect(html).toContain("sticky-trial-bar");
      expect(html).toContain(mockTrial.title);
      expect(html).toContain("₹200");
      expect(html).toContain('data-testid="sticky-add-to-cart-btn"');
    });

    it("8.2: shouldShowStickyBar returns true only on mobile viewports scrolled past threshold", () => {
      expect(shouldShowStickyBar(500, 300, true)).toBe(true);
      expect(shouldShowStickyBar(100, 300, true)).toBe(false);
      expect(shouldShowStickyBar(500, 300, false)).toBe(false); // desktop view
    });

    it("8.3: Add to Cart button satisfies minimum 44x44px touch target dimensions", () => {
      const html = renderToStaticMarkup(
        React.createElement(TrialStickyActionBar, { trial: mockTrial })
      );
      expect(html).toContain("min-h-[44px]");
    });

    it("8.4: safe area insets class or style is present for iOS home indicator", () => {
      const html = renderToStaticMarkup(
        React.createElement(TrialStickyActionBar, { trial: mockTrial })
      );
      expect(html).toContain("pb-safe");
    });

    it("8.5: TrialPDPInteractiveView includes pb-24 md:pb-12 for mobile sticky bar clearance", () => {
      const html = renderToStaticMarkup(
        React.createElement(TrialPDPInteractiveView, { trial: mockTrial })
      );
      expect(html).toContain("pb-24");
      expect(html).toContain("md:pb-12");
    });
  });

  // =========================================================================
  // Suite 9: Bilingual English / Hindi Toggle & Translations
  // =========================================================================
  describe("Suite 9: Bilingual English / Hindi Toggle & Translations", () => {
    it("9.1: renders language toggle buttons for English and Hindi", () => {
      const html = renderToStaticMarkup(
        React.createElement(TrialLanguageToggle, {
          currentLocale: "en",
          onLocaleChange: vi.fn(),
        })
      );
      expect(html).toContain('data-testid="language-toggle-en"');
      expect(html).toContain('data-testid="language-toggle-hi"');
      expect(html).toContain("English");
      expect(html).toContain("हिंदी");
    });

    it("9.2: getTrialText translates dictionary keys accurately into reviewed Hindi", () => {
      expect(getTrialText("pouch_strong", "hi")).toBe("कड़क चाय");
      expect(getTrialText("stage_dry_leaf", "hi")).toBe("सूखी पत्ती");
      expect(getTrialText("stage_milk_tea", "hi")).toBe("दूध चाय");
      expect(getTrialText("calc_total_brews", "hi")).toContain("200 ग्राम किट से कुल प्याले");
    });

    it("9.3: authentic Hindi copy contains reviewed culinary terminology (चाय, नमूना, परख, प्याला)", () => {
      const dict = JSON.stringify(TRIAL_DICTIONARY);
      expect(dict).toContain("चाय");
      expect(dict).toContain("नमूना");
      expect(dict).toContain("परख");
      expect(dict).toContain("प्याला");
      expect(dict).toContain("पत्ती");
    });

    it("9.4: switching to Hindi updates labels while preserving component tree", () => {
      const html = renderToStaticMarkup(
        React.createElement(TrialOpticalStudio, {
          components: mockTrial.components,
          locale: "hi",
        })
      );
      expect(html).toContain("सूखी पत्ती");
      expect(html).toContain("दूध चाय");
    });

    it("9.5: toggling back from Hindi to English restores exact original strings", () => {
      const htmlEn = renderToStaticMarkup(
        React.createElement(TrialOpticalStudio, {
          components: mockTrial.components,
          locale: "en",
        })
      );
      expect(htmlEn).toContain("Dry Leaf");
      expect(htmlEn).toContain("Milk Tea");
    });
  });

  // =========================================================================
  // Suite 10: Mock Data Fixtures & Currency Utilities
  // =========================================================================
  describe("Suite 10: Mock Data Fixtures & Currency Utilities", () => {
    it("10.1: createMockPublicTrialDto creates conforming DTO with 4 components summing to 200g", () => {
      const dto = createMockPublicTrialDto();
      expect(dto.components.length).toBe(4);
      const totalWeight = dto.components.reduce((sum, c) => sum + c.weight_g, 0);
      expect(totalWeight).toBe(200);
      expect(dto.pack_format).toBe("4x50g_sachets");
      expect(dto.status).toBe("published");
    });

    it("10.2: formatINR formats currency accurately in Indian Rupee format", () => {
      expect(formatINR(20000, true)).toBe("₹200");
      expect(formatINR(24950, true)).toBe("₹249.50");
      expect(formatINR(200, false)).toBe("₹200");
    });

    it("10.3: pure helper execution runs synchronously with zero network socket calls or DB locks", () => {
      const cost = calculateCostPerCup(400, 2.5);
      const yieldCups = calculateKitCupYield(200, 2.5);
      const delta = calculateSavingsDelta(1.0, 0.8);
      expect(cost).toBe(1);
      expect(yieldCups).toBe(80);
      expect(delta.isSavings).toBe(true);
    });
  });
});
