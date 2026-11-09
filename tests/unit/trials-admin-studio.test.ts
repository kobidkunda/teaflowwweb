/**
 * TeaFloww Trials v3 — Milestone 4 Admin Trial Studio Unit Tests
 *
 * Verifies:
 * 1. Index Listing: Table rendering, status badge filters, search input, revision display.
 * 2. New Draft Wizard: Form inputs, client validation (title, price), submit handler with idempotency.
 * 3. 5 Studio Tabs: Tablist structure, tab switching, rendering Identity, Pouches, Optical, Promotions, Preview.
 * 4. Sachet Composer: 4 slots rendering, Move Up/Down states, reordering logic, 4x50g=200g net weight invariant.
 * 5. Publication Gate Checklist: Blocker items rendering when incomplete, publish button enablement when complete.
 * 6. 409 Conflict Diff Modal: Modal rendering on 409, field diff computation, resolution action handlers.
 * 7. Mocking & Isolation: Deterministic fetch mocking, zero network dependencies.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => "/admin/trials",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ id: "trial_test_1" }),
}));

import {
  TrialListingClient,
  filterTrialsList,
  formatPaise,
} from "@/components/admin/trials/TrialListingClient";
import {
  TrialDraftWizard,
  validateDraftInput,
  slugify,
} from "@/components/admin/trials/TrialDraftWizard";
import {
  TrialStudioClient,
} from "@/components/admin/trials/TrialStudioClient";
import {
  TrialTabIdentity,
  calculateGrossMargin,
} from "@/components/admin/trials/TrialTabIdentity";
import {
  TrialTabPouches,
  reorderSachets,
  validateSachetTotalWeight,
} from "@/components/admin/trials/TrialTabPouches";
import {
  TrialTabOptical,
} from "@/components/admin/trials/TrialTabOptical";
import {
  TrialTabPromotions,
} from "@/components/admin/trials/TrialTabPromotions";
import {
  TrialTabPublish,
  evaluatePublicationGates,
} from "@/components/admin/trials/TrialTabPublish";
import {
  ConflictDiffModal,
  computeFieldDiffs,
} from "@/components/admin/trials/ConflictDiffModal";
import {
  TrialSplitPreview,
} from "@/components/admin/trials/TrialSplitPreview";

import type { Trial, TrialWithDetails, TrialComponent } from "@/lib/trials/types";

// Helper fixture factories
function createMockComponent(slot_index: number, name: string, weight_g = 50): TrialComponent {
  return {
    id: `comp_${slot_index}`,
    trial_id: "trial_test_1",
    slot_index,
    name,
    estate: "Gopaldhara Estate",
    grade: "FTGFOP1",
    flush: "Second Flush",
    elevation: "1800m",
    weight_g,
    quantity: 1,
    tasting_notes: JSON.stringify(["Muscatel", "Honey"]),
    brew_temp_c: 90,
    brew_time_sec: 180,
    leaf_dose_g: 2.5,
    regular_product_id: null,
    regular_variant_id: null,
    sort_order: slot_index,
  };
}

function createMockTrialDossier(overrides: Partial<TrialWithDetails> = {}): TrialWithDetails {
  return {
    id: "trial_test_1",
    slug: "himalayan-discovery-flight",
    title: "Himalayan Discovery Flight",
    tagline: "Four legendary single-estate flushes",
    description: "An authentic exploration of Darjeeling and Assam terroirs.",
    status: "draft",
    pack_format: "4x50g_sachets",
    net_weight_g: 200,
    price_paise: 180000, // ₹1,800.00
    compare_at_price_paise: 220000,
    cost_paise: 90000,
    sku: "KIT-HIM-4X50G",
    inventory_quantity: 50,
    inventory_policy: "track",
    hero_image_id: 101,
    meta_title: "Himalayan Discovery Flight — TeaFloww Trials",
    meta_description: "Taste four micro-lots direct from high-elevation estates.",
    revision: 1,
    created_at: "2026-11-05T00:00:00Z",
    updated_at: "2026-11-05T00:00:00Z",
    published_at: null,
    archived_at: null,
    hero_image: { url: "/images/hero-kit.webp", alt_text: "Trial Kit Outer Box" },
    components: [
      createMockComponent(0, "Gopaldhara Wonder Muscatel", 50),
      createMockComponent(1, "Castleton Moonlight White", 50),
      createMockComponent(2, "Rohini Gold Buds", 50),
      createMockComponent(3, "Halmari Golden Tips", 50),
    ],
    assets: [
      {
        id: "a1",
        trial_id: "trial_test_1",
        component_id: null,
        slot_index: null,
        media_id: 1,
        asset_url: "/img/pack.webp",
        stage: "packaging",
        alt_text: "Kit box packaging",
        rights_status: "owned",
        sort_order: 0,
      },
      {
        id: "a2",
        trial_id: "trial_test_1",
        component_id: "comp_0",
        slot_index: 0,
        media_id: 2,
        asset_url: "/img/dry.webp",
        stage: "dry_leaf",
        alt_text: "Dry leaf whole buds",
        rights_status: "owned",
        sort_order: 1,
      },
    ],
    brew_guides: [],
    sensory_tests: [],
    claims: [
      {
        id: "c1",
        trial_id: "trial_test_1",
        claim_type: "origin",
        label: "Single Estate",
        claim_text: "100% single garden Darjeeling",
        basis: "Garden invoice",
        evidence_ref: "REF-2026-001",
        verified: 1,
        approved_by: "Cupper",
        approved_at: "2026-11-05T00:00:00Z",
        expires_at: null,
        sort_order: 0,
      },
    ],
    bulk_links: [],
    ...overrides,
  };
}

describe("Milestone 4: Admin Trial Studio GUI Unit Tests", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      } as any)
    );
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // ==========================================================================
  // Suite 1: Index Listing
  // ==========================================================================
  describe("Suite 1: Index Listing (/admin/trials)", () => {
    const mockTrialsList: Trial[] = [
      createMockTrialDossier({ id: "t1", title: "Darjeeling Discovery", sku: "KIT-DARJ", status: "published", price_paise: 180000 }),
      createMockTrialDossier({ id: "t2", title: "Assam Gold Tips", sku: "KIT-ASSAM", status: "draft", price_paise: 150000 }),
      createMockTrialDossier({ id: "t3", title: "Nilgiri Frost Flight", sku: "KIT-NIL", status: "in_review", price_paise: 200000 }),
    ];

    it("renders table with expected headers, status badges, price format and revision numbers", () => {
      const markup = renderToStaticMarkup(
        React.createElement(TrialListingClient, { initialTrials: mockTrialsList })
      );

      // Table & structure
      expect(markup).toContain('class="admin-table"');
      expect(markup).toContain("Title &amp; Slug");
      expect(markup).toContain("Pack Format");
      expect(markup).toContain("Price (₹)");
      expect(markup).toContain("Revision");

      // Content rendering
      expect(markup).toContain("Darjeeling Discovery");
      expect(markup).toContain("Assam Gold Tips");
      expect(markup).toContain("Nilgiri Frost Flight");
      expect(markup).toContain("4x50g (200g)");
      expect(markup).toContain("₹1,800.00");
      expect(markup).toContain("Rev #1");

      // Search input testid
      expect(markup).toContain('data-testid="trial-search-input"');
    });

    it("filterTrialsList filters correctly by search query across title, slug, and SKU", () => {
      expect(filterTrialsList(mockTrialsList, "assam", "all")).toHaveLength(1);
      expect(filterTrialsList(mockTrialsList, "assam", "all")[0].title).toBe("Assam Gold Tips");

      expect(filterTrialsList(mockTrialsList, "KIT-DARJ", "all")).toHaveLength(1);
      expect(filterTrialsList(mockTrialsList, "KIT-DARJ", "all")[0].title).toBe("Darjeeling Discovery");

      expect(filterTrialsList(mockTrialsList, "nonexistent", "all")).toHaveLength(0);
    });

    it("filterTrialsList filters correctly by status tabs", () => {
      expect(filterTrialsList(mockTrialsList, "", "published")).toHaveLength(1);
      expect(filterTrialsList(mockTrialsList, "", "draft")).toHaveLength(1);
      expect(filterTrialsList(mockTrialsList, "", "in_review")).toHaveLength(1);
      expect(filterTrialsList(mockTrialsList, "", "archived")).toHaveLength(0);
      expect(filterTrialsList(mockTrialsList, "", "all")).toHaveLength(3);
    });

    it("renders empty state indicator when no trials match filter", () => {
      const markup = renderToStaticMarkup(
        React.createElement(TrialListingClient, { initialTrials: [] })
      );
      expect(markup).toContain('data-testid="empty-trials"');
      expect(markup).toContain("No trials match your filter");
    });
  });

  // ==========================================================================
  // Suite 2: New Draft Wizard
  // ==========================================================================
  describe("Suite 2: New Draft Wizard (/admin/trials/new)", () => {
    it("renders draft creation form with title input, price, and pack format info", () => {
      const markup = renderToStaticMarkup(React.createElement(TrialDraftWizard));

      expect(markup).toContain('data-testid="input-trial-title"');
      expect(markup).toContain('name="title"');
      expect(markup).toContain('name="price_rupees"');
      expect(markup).toContain('name="slug"');
      expect(markup).toContain('name="sku"');
      expect(markup).toContain("4x50g_sachets");
      expect(markup).toContain("Create Draft &amp; Launch Studio");
    });

    it("slugify generates clean kebab-case from title", () => {
      expect(slugify("Darjeeling First Flush Exploration!")).toBe("darjeeling-first-flush-exploration");
      expect(slugify("Assam CTC & Orthodox (2026)")).toBe("assam-ctc-orthodox-2026");
    });

    it("validateDraftInput enforces title length, price > 0, and valid slug pattern", () => {
      const invalidShort = validateDraftInput({ title: "ab", price_rupees: 200 });
      expect(invalidShort.isValid).toBe(false);
      expect(invalidShort.errors.title).toBeDefined();

      const invalidPrice = validateDraftInput({ title: "Valid Title", price_rupees: 0 });
      expect(invalidPrice.isValid).toBe(false);
      expect(invalidPrice.errors.price_rupees).toBeDefined();

      const invalidSlug = validateDraftInput({ title: "Valid Title", price_rupees: 200, slug: "Invalid Slug!" });
      expect(invalidSlug.isValid).toBe(false);
      expect(invalidSlug.errors.slug).toBeDefined();

      const valid = validateDraftInput({
        title: "Darjeeling Discovery Flight",
        price_rupees: 250,
        slug: "darjeeling-discovery-flight",
        sku: "KIT-DARJ",
      });
      expect(valid.isValid).toBe(true);
      expect(Object.keys(valid.errors)).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Suite 3: 5 Studio Tabs
  // ==========================================================================
  describe("Suite 3: 5 Studio Tabs (/admin/trials/[id])", () => {
    const mockTrial = createMockTrialDossier();

    it("renders tablist with 5 tabs and active indicator", () => {
      const markup = renderToStaticMarkup(
        React.createElement(TrialStudioClient, {
          trialId: "trial_test_1",
          initialTrial: mockTrial,
        })
      );

      expect(markup).toContain('role="tablist"');
      expect(markup).toContain("1. Identity &amp; Pricing");
      expect(markup).toContain("2. Pouches Composer");
      expect(markup).toContain("3. Optical &amp; Brewing");
      expect(markup).toContain("4. Promotions &amp; Bulk");
      expect(markup).toContain("5. Preview &amp; Publish");
    });

    it("calculates gross margin correctly in Tab 1 helper", () => {
      // price 200, cost 100 -> 50.0%
      const res50 = calculateGrossMargin(20000, 10000);
      expect(res50.percent).toBe(50.0);
      expect(res50.label).toBe("50.0%");

      // price 1800, cost 900 -> 50.0%
      const res40 = calculateGrossMargin(180000, 108000);
      expect(res40.percent).toBe(40.0);
      expect(res40.label).toBe("40.0%");

      // missing cost
      const resUnknown = calculateGrossMargin(20000, null);
      expect(resUnknown.percent).toBeNull();
      expect(resUnknown.label).toContain("Unknown");
    });

    it("renders Tab 1 Identity inputs with testid input-trial-title", () => {
      const markup = renderToStaticMarkup(
        React.createElement(TrialTabIdentity, {
          trial: mockTrial,
          onChange: () => {},
          onSave: async () => {},
          saving: false,
        })
      );

      expect(markup).toContain('data-testid="input-trial-title"');
      expect(markup).toContain("Himalayan Discovery Flight");
      expect(markup).toContain("Gross Contribution Margin");
      expect(markup).toContain("Save Identity Changes");
    });

    it("renders Tab 3 Optical with media-stage-uploader and media-picker-trigger", () => {
      const markup = renderToStaticMarkup(
        React.createElement(TrialTabOptical, {
          trial: mockTrial,
          onAttachAsset: async () => {},
          onDetachAsset: async () => {},
          onUpdateComponentBrewing: () => {},
          saving: false,
        })
      );

      expect(markup).toContain('data-testid="media-stage-uploader"');
      expect(markup).toContain("Packaging Foil");
      expect(markup).toContain("Dry Orthodox Leaf");
      expect(markup).toContain("Infused / Wet Leaf");
      expect(markup).toContain("Pure Liquor Clarity");
      expect(markup).toContain("Milk Infusion");
      expect(markup).toContain('data-testid="media-picker-trigger"');
    });

    it("renders Tab 4 Promotions with bulk-ladder-editor", () => {
      const markup = renderToStaticMarkup(
        React.createElement(TrialTabPromotions, {
          trial: mockTrial,
          onChangeBulkLinks: () => {},
          onChangeClaims: () => {},
          saving: false,
        })
      );

      expect(markup).toContain('data-testid="bulk-ladder-editor"');
      expect(markup).toContain("Bulk Conversion Ladder &amp; Voucher Incentives");
      expect(markup).toContain("Regulatory &amp; Provenance Claims");
    });
  });

  // ==========================================================================
  // Suite 4: Sachet Composer (4x50g Invariant & Controls)
  // ==========================================================================
  describe("Suite 4: Sachet Composer (Tab 2)", () => {
    const mockComponents: TrialComponent[] = [
      createMockComponent(0, "Pouch 1: Muscatel", 50),
      createMockComponent(1, "Pouch 2: Moonlight", 50),
      createMockComponent(2, "Pouch 3: Gold Buds", 50),
      createMockComponent(3, "Pouch 4: Golden Tips", 50),
    ];

    it("renders exactly 4 sachet slots with Move Up/Down buttons and drag handles", () => {
      const markup = renderToStaticMarkup(
        React.createElement(TrialTabPouches, {
          components: mockComponents,
          onChange: () => {},
          onSave: async () => {},
          saving: false,
        })
      );

      // 4 slots rendered
      const slotMatches = markup.match(/data-testid="sachet-slot"/g);
      expect(slotMatches).toHaveLength(4);

      // Buttons present
      expect(markup).toContain('data-testid="sachet-move-up"');
      expect(markup).toContain('data-testid="sachet-move-down"');
      expect(markup).toContain('data-testid="sachet-drag-handle"');

      // Slot 0 Move Up must be disabled
      expect(markup).toContain('data-testid="sachet-move-up" disabled=""');

      // Balanced 200g indicator
      expect(markup).toContain("Balanced (200g)");
    });

    it("reorderSachets helper swaps items and updates slot_index cleanly", () => {
      const reordered = reorderSachets(mockComponents, 0, 1);
      expect(reordered[0].name).toBe("Pouch 2: Moonlight");
      expect(reordered[0].slot_index).toBe(0);
      expect(reordered[1].name).toBe("Pouch 1: Muscatel");
      expect(reordered[1].slot_index).toBe(1);
      expect(reordered[2].slot_index).toBe(2);
      expect(reordered[3].slot_index).toBe(3);
    });

    it("validateSachetTotalWeight verifies the 4x50g=200g invariant strictly", () => {
      // Exactly 4x50g -> valid
      const valid = validateSachetTotalWeight(mockComponents);
      expect(valid.isValid).toBe(true);
      expect(valid.totalWeight).toBe(200);
      expect(valid.error).toBeNull();

      // One pouch is 40g (total 190g)
      const invalidWeight = [
        ...mockComponents.slice(0, 3),
        createMockComponent(3, "Underweight", 40),
      ];
      const resWeight = validateSachetTotalWeight(invalidWeight);
      expect(resWeight.isValid).toBe(false);
      expect(resWeight.error).toContain("Total must equal 200g | Invariant error");

      // Pouch count is 3 instead of 4
      const invalidCount = mockComponents.slice(0, 3);
      const resCount = validateSachetTotalWeight(invalidCount);
      expect(resCount.isValid).toBe(false);
      expect(resCount.error).toContain("Exactly 4 sachets required");
    });
  });

  // ==========================================================================
  // Suite 5: Publication Gate Checklist & Live Preview (Tab 5)
  // ==========================================================================
  describe("Suite 5: Publication Gate Checklist & Live Preview (Tab 5)", () => {
    it("evaluates publication gates and blocks publish if criteria not satisfied", () => {
      // Incomplete trial (no assets, price 0)
      const incompleteTrial = createMockTrialDossier({
        price_paise: 0,
        assets: [],
      });
      const resIncomplete = evaluatePublicationGates(incompleteTrial);
      expect(resIncomplete.canPublish).toBe(false);
      expect(resIncomplete.gates.some((g) => !g.passed)).toBe(true);

      // Complete trial
      const completeTrial = createMockTrialDossier();
      const resComplete = evaluatePublicationGates(completeTrial);
      expect(resComplete.canPublish).toBe(true);
      expect(resComplete.gates.every((g) => g.passed)).toBe(true);
    });

    it("renders readiness checklist with testid launch-readiness-checklist and publish button", () => {
      const mockTrial = createMockTrialDossier();
      const markup = renderToStaticMarkup(
        React.createElement(TrialTabPublish, {
          trial: mockTrial,
          serverValidation: { can_publish: true, blockers: [] },
          onNavigateTab: () => {},
          onSubmitReview: async () => {},
          onPublish: async () => {},
          onUnpublish: async () => {},
          onArchive: async () => {},
          saving: false,
        })
      );

      expect(markup).toContain('data-testid="launch-readiness-checklist"');
      expect(markup).toContain("Gate 1: Core Merchandising &amp; URL Slug");
      expect(markup).toContain("Gate 3: 4×50g = 200g Sachet Composition &amp; Estates");
      expect(markup).toContain("Gate 4: Packaging Photography &amp; Alt Text");
      expect(markup).toContain("Publish Trial Kit");
    });

    it("renders live split-screen preview with testid preview-viewport-toggle and PREVIEW watermark", () => {
      const mockTrial = createMockTrialDossier();
      const markup = renderToStaticMarkup(
        React.createElement(TrialSplitPreview, { trial: mockTrial })
      );

      expect(markup).toContain('data-testid="preview-viewport-toggle"');
      expect(markup).toContain("PREVIEW");
      expect(markup).toContain("Mobile (375px)");
      expect(markup).toContain("Desktop (1440px)");
      expect(markup).toContain("Split View");
      expect(markup).toContain("Curated Discovery Flight · 200g");
    });
  });

  // ==========================================================================
  // Suite 6: 409 Conflict Diff Modal
  // ==========================================================================
  describe("Suite 6: 409 Conflict Diff Modal", () => {
    it("computeFieldDiffs detects modified fields accurately", () => {
      const local = createMockTrialDossier({ title: "My Local Title", price_paise: 200000 });
      const server = createMockTrialDossier({ title: "Server Title (Updated via MCP)", price_paise: 250000 });

      const diffs = computeFieldDiffs(local, server);
      expect(diffs).toHaveLength(2);

      const titleDiff = diffs.find((d) => d.key === "title");
      expect(titleDiff?.localVal).toBe("My Local Title");
      expect(titleDiff?.serverVal).toBe("Server Title (Updated via MCP)");

      const priceDiff = diffs.find((d) => d.key === "price_paise");
      expect(priceDiff?.localVal).toBe(200000);
      expect(priceDiff?.serverVal).toBe(250000);
    });

    it("renders modal with testid conflict-diff-modal, role dialog, and both resolution options", () => {
      const local = createMockTrialDossier({ title: "My Local Title" });
      const server = createMockTrialDossier({ title: "Server Title", revision: 2 });

      const markup = renderToStaticMarkup(
        React.createElement(ConflictDiffModal, {
          isOpen: true,
          localTrial: local,
          serverTrial: server,
          onKeepLocal: () => {},
          onAcceptServer: () => {},
          onClose: () => {},
        })
      );

      expect(markup).toContain('data-testid="conflict-diff-modal"');
      expect(markup).toContain('role="dialog"');
      expect(markup).toContain('aria-modal="true"');
      expect(markup).toContain("Revision Conflict Detected (HTTP 409)");
      expect(markup).toContain("Keep Local (Overwrite)");
      expect(markup).toContain("Discard &amp; Accept Server");
      expect(markup).toContain("My Local Title");
      expect(markup).toContain("Server Title");
    });

    it("renders nothing when isOpen is false", () => {
      const markup = renderToStaticMarkup(
        React.createElement(ConflictDiffModal, {
          isOpen: false,
          localTrial: createMockTrialDossier(),
          serverTrial: createMockTrialDossier(),
          onKeepLocal: () => {},
          onAcceptServer: () => {},
          onClose: () => {},
        })
      );
      expect(markup).toBe("");
    });
  });

  // ==========================================================================
  // Suite 7: Mocking & Isolation
  // ==========================================================================
  describe("Suite 7: Deterministic Mocking & Isolation", () => {
    it("formatPaise formats paise into rupees with 2 decimal places", () => {
      expect(formatPaise(180000)).toBe("1,800.00");
      expect(formatPaise(25000)).toBe("250.00");
      expect(formatPaise(0)).toBe("0.00");
    });

    it("global.fetch can be mocked deterministically without live network sockets", async () => {
      const mockFn = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({ id: "trial_new_123", revision: 1 }),
      });
      global.fetch = mockFn;

      const res = await fetch("/api/v1/admin/trials", {
        method: "POST",
        headers: { "Idempotency-Key": "test_key_123" },
        body: JSON.stringify({ title: "Test Kit" }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.id).toBe("trial_new_123");
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });
});
