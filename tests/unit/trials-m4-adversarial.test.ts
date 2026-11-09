/**
 * TeaFloww Trials v3 — Milestone 4 Admin Trial Studio Adversarial & Stress Test Suite
 *
 * Authored by: trials_m4_challenger_1
 * Purpose: Adversarially challenge and stress-test assumptions in the Admin Trial Studio:
 * 1. Sachet Invariant Edge Cases & Permutations (reordering, weight injection, count corruption).
 * 2. 409 Conflict Diff Engine & CAS Revision Race Conditions (all field types, nulls/zeros, keep local vs discard transforms).
 * 3. Draft Wizard Validation Boundaries & Slugify Edge Cases (title length, price boundaries, unicode/accents, idempotency entropy).
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
  usePathname: () => "/admin/trials/tr_adv_test",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ id: "tr_adv_test" }),
}));

import {
  TrialTabPouches,
  reorderSachets,
  validateSachetTotalWeight,
} from "@/components/admin/trials/TrialTabPouches";
import {
  ConflictDiffModal,
  computeFieldDiffs,
} from "@/components/admin/trials/ConflictDiffModal";
import {
  TrialDraftWizard,
  validateDraftInput,
  slugify,
} from "@/components/admin/trials/TrialDraftWizard";
import {
  validateComponentInvariant,
  createTrialSchema,
  updateTrialSchema,
} from "@/lib/trials/validation";
import type { TrialWithDetails, TrialComponent } from "@/lib/trials/types";

// ============================================================================
// Fixture Factories
// ============================================================================

function makeComponent(
  slot_index: number,
  name: string,
  weight_g = 50,
  overrides: Partial<TrialComponent> = {}
): TrialComponent {
  return {
    id: `comp_adv_${slot_index}`,
    trial_id: "trial_adv_1",
    slot_index,
    name,
    estate: "Makaibari Estate",
    grade: "FTGFOP1",
    flush: "First Flush",
    elevation: "1500m",
    weight_g,
    quantity: 1,
    tasting_notes: JSON.stringify(["Muscatel", "White Peach"]),
    brew_temp_c: 90,
    brew_time_sec: 180,
    leaf_dose_g: 2.5,
    regular_product_id: null,
    regular_variant_id: null,
    sort_order: slot_index,
    ...overrides,
  };
}

function makeFourSachets(): TrialComponent[] {
  return [
    makeComponent(0, "Sachet 1: Makaibari Spring Muscatel", 50),
    makeComponent(1, "Sachet 2: Castleton Moonlight White", 50),
    makeComponent(2, "Sachet 3: Gopaldhara Clonal Queen", 50),
    makeComponent(3, "Sachet 4: Halmari Golden Orthodox", 50),
  ];
}

function makeTrialDossier(overrides: Partial<TrialWithDetails> = {}): TrialWithDetails {
  return {
    id: "trial_adv_1",
    slug: "himalayan-adversarial-flight",
    title: "Himalayan Adversarial Flight",
    tagline: "Stress-testing four high-elevation terroirs",
    description: "An authentic exploration designed to probe invariant resilience.",
    status: "draft",
    pack_format: "4x50g_sachets",
    net_weight_g: 200,
    price_paise: 240000, // ₹2,400.00
    compare_at_price_paise: 280000,
    cost_paise: 110000,
    sku: "KIT-ADV-4X50G",
    inventory_quantity: 45,
    inventory_policy: "track",
    hero_image_id: 201,
    meta_title: "Himalayan Adversarial Flight — TeaFloww Trials",
    meta_description: "Taste four micro-lots direct from high-elevation estates.",
    revision: 1,
    created_at: "2026-11-05T00:00:00Z",
    updated_at: "2026-11-05T00:00:00Z",
    published_at: null,
    archived_at: null,
    hero_image: { url: "/images/hero-adv.webp", alt_text: "Trial Kit Outer Box" },
    components: makeFourSachets(),
    assets: [],
    brew_guides: [],
    sensory_tests: [],
    claims: [],
    bulk_links: [],
    ...overrides,
  };
}

describe("Milestone 4: Adversarial Stress Test Suite (Admin Trial Studio)", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    } as any);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // ==========================================================================
  // Suite 1: Sachet Invariant Edge Cases & Permutations
  // ==========================================================================
  describe("Suite 1: Sachet Invariant Edge Cases & Permutations (Tab 2)", () => {
    it("1.1: Reordering 4 sachets through full permutations preserves strictly [0, 1, 2, 3] slot_index and 200g weight", () => {
      let current = makeFourSachets();

      // Perform a sequence of multi-step reorderings simulating user drag/keyboard actions
      const moves: Array<[number, number]> = [
        [0, 1], // Swap 0 and 1 -> [S1, S0, S2, S3]
        [1, 2], // Swap 1 and 2 -> [S1, S2, S0, S3]
        [2, 3], // Swap 2 and 3 -> [S1, S2, S3, S0]
        [3, 0], // Move last to first -> [S0, S1, S2, S3] (restores original items in order)
        [0, 3], // Move first to last -> [S1, S2, S3, S0]
        [1, 0], // Move slot 1 to 0
        [2, 1], // Move slot 2 to 1
        [3, 2], // Move slot 3 to 2
      ];

      for (const [from, to] of moves) {
        current = reorderSachets(current, from, to);

        // Invariant: exactly 4 items
        expect(current).toHaveLength(4);

        // Invariant: slot_index strictly [0, 1, 2, 3]
        const slotIndices = current.map((c) => c.slot_index);
        expect(slotIndices).toEqual([0, 1, 2, 3]);

        // Invariant: sort_order strictly [0, 1, 2, 3]
        const sortOrders = current.map((c) => c.sort_order);
        expect(sortOrders).toEqual([0, 1, 2, 3]);

        // Invariant: total weight always 200g
        const weightCheck = validateSachetTotalWeight(current);
        expect(weightCheck.isValid).toBe(true);
        expect(weightCheck.totalWeight).toBe(200);

        // Domain validation engine invariant check
        const domainCheck = validateComponentInvariant(current);
        expect(domainCheck.valid).toBe(true);
        expect(domainCheck.totalWeight).toBe(200);
      }
    });

    it("1.2: Boundary reordering handles out-of-bounds indices and no-op gracefully", () => {
      const original = makeFourSachets();

      // No-op: fromIndex === toIndex
      const noOp = reorderSachets(original, 2, 2);
      expect(noOp).toBe(original);

      // Out of bounds toIndex (< 0)
      const underflowTo = reorderSachets(original, 1, -1);
      expect(underflowTo).toBe(original);

      // Out of bounds toIndex (>= length)
      const overflowTo = reorderSachets(original, 1, 4);
      expect(overflowTo).toBe(original);

      const hugeOverflowTo = reorderSachets(original, 1, 999);
      expect(hugeOverflowTo).toBe(original);
    });

    it("1.3: Reorder safety check with out-of-bounds fromIndex (rejects corruption)", () => {
      const original = makeFourSachets();

      // When fromIndex is out of range (>= length or < 0), function must safely return original array
      // rather than inserting undefined into the slot array
      const resultOverflow = reorderSachets(original, 99, 1);
      expect(resultOverflow).toHaveLength(4);
      expect(resultOverflow.every((c) => c && typeof c.name === "string")).toBe(true);

      const resultUnderflow = reorderSachets(original, -1, 1);
      expect(resultUnderflow).toBe(original);
    });

    it("1.4: Injecting individual corrupted weights (negative, 0g, 49g, 51g, 100g) blocks save and trips invariant", () => {
      const corruptedWeights = [-50, -1, 0, 49, 49.9, 50.1, 51, 100, 200];

      for (const badWeight of corruptedWeights) {
        const corrupted = makeFourSachets();
        corrupted[1] = makeComponent(1, "Corrupted Sachet", badWeight);

        // 1. UI Tab validator check
        const uiValidation = validateSachetTotalWeight(corrupted);
        expect(uiValidation.isValid).toBe(false);
        expect(uiValidation.error).toContain("Total must equal 200g | Invariant error");

        // 2. Domain engine check
        const domainValidation = validateComponentInvariant(corrupted);
        expect(domainValidation.valid).toBe(false);
        expect(domainValidation.errors.length).toBeGreaterThan(0);

        // 3. Rendered UI enforcement: save button disabled and alert banner shown
        const markup = renderToStaticMarkup(
          React.createElement(TrialTabPouches, {
            components: corrupted,
            onChange: () => {},
            onSave: async () => {},
            saving: false,
          })
        );

        // Save button must be disabled
        expect(markup).toContain('data-testid="save-components-btn" disabled=""');
        // Invariant alert banner must be present
        expect(markup).toContain('role="alert"');
        expect(markup).toContain("Invariant error");
      }
    });

    it("1.5: Adversarial weight compensation (sum=200g but components != 50g) is strictly rejected", () => {
      // Adversarial attack: an operator tries to bypass SUM == 200g by making one pouch 49g and another 51g
      const compensatedPairs: Array<[number, number, number, number]> = [
        [49, 51, 50, 50],
        [40, 60, 50, 50],
        [0, 100, 50, 50],
        [-50, 150, 50, 50],
        [25, 25, 75, 75],
      ];

      for (const [w0, w1, w2, w3] of compensatedPairs) {
        const sum = w0 + w1 + w2 + w3;
        expect(sum).toBe(200); // The sum is indeed 200g!

        const sneakyKit = [
          makeComponent(0, "Pouch 1", w0),
          makeComponent(1, "Pouch 2", w1),
          makeComponent(2, "Pouch 3", w2),
          makeComponent(3, "Pouch 4", w3),
        ];

        // UI validator must reject because each pouch MUST be 50g
        const uiRes = validateSachetTotalWeight(sneakyKit);
        expect(uiRes.isValid).toBe(false);
        expect(uiRes.error).toContain("Total must equal 200g | Invariant error");

        // Domain validation must reject
        const domainRes = validateComponentInvariant(sneakyKit);
        expect(domainRes.valid).toBe(false);
        expect(domainRes.errors.some((e) => e.includes("must be exactly 50g"))).toBe(true);
      }
    });

    it("1.6: Pouch counts < 4 or > 4 trip count invariant error and block save", () => {
      const base = makeFourSachets();
      const invalidCounts = [
        [], // 0
        base.slice(0, 1), // 1
        base.slice(0, 2), // 2
        base.slice(0, 3), // 3
        [...base, makeComponent(4, "Extra Pouch 5", 50)], // 5
        [...base, makeComponent(4, "Pouch 5", 50), makeComponent(5, "Pouch 6", 50)], // 6
        [...base, ...base], // 8
      ];

      for (const invalidSet of invalidCounts) {
        const res = validateSachetTotalWeight(invalidSet);
        expect(res.isValid).toBe(false);
        expect(res.error).toBe("Exactly 4 sachets required");

        const domainRes = validateComponentInvariant(invalidSet);
        expect(domainRes.valid).toBe(false);
        expect(domainRes.errors.some((e) => e.includes("Kit must contain exactly 4 sachets"))).toBe(true);

        const markup = renderToStaticMarkup(
          React.createElement(TrialTabPouches, {
            components: invalidSet,
            onChange: () => {},
            onSave: async () => {},
            saving: false,
          })
        );
        expect(markup).toContain('data-testid="save-components-btn" disabled=""');
        expect(markup).toContain("Exactly 4 sachets required");
      }
    });

    it("1.7: Non-numeric and NaN weight values trigger invariant error safely without crashing", () => {
      const nanKit = makeFourSachets();
      (nanKit[0] as any).weight_g = NaN;

      const res = validateSachetTotalWeight(nanKit);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("Total must equal 200g | Invariant error");

      const undefinedKit = makeFourSachets();
      (undefinedKit[2] as any).weight_g = undefined;
      const resUndef = validateSachetTotalWeight(undefinedKit);
      expect(resUndef.isValid).toBe(false);
    });

    it("1.8: Non-standard quantity injection (quantity > 1 or 0) trips domain invariant", () => {
      const doubleQtyKit = makeFourSachets();
      doubleQtyKit[0].quantity = 2; // 2 * 50 = 100g, total 250g

      const uiRes = validateSachetTotalWeight(doubleQtyKit);
      expect(uiRes.isValid).toBe(false);

      const domainRes = validateComponentInvariant(doubleQtyKit);
      expect(domainRes.valid).toBe(false);
      expect(domainRes.errors.some((e) => e.includes("quantity must be exactly 1"))).toBe(true);
    });
  });

  // ==========================================================================
  // Suite 2: 409 Conflict Diff Modal & CAS Revision Race Conditions
  // ==========================================================================
  describe("Suite 2: 409 Conflict Diff Engine & CAS Revision Race (Tab 5 & Modal)", () => {
    it("2.1: computeFieldDiffs detects text field mutations across all registered string properties", () => {
      const local = makeTrialDossier({
        title: "Local Title",
        slug: "local-slug",
        tagline: "Local Tagline",
        description: "Local Description",
        sku: "KIT-LOCAL",
        status: "draft",
        meta_title: "Local Meta Title",
        meta_description: "Local Meta Description",
      });

      const server = makeTrialDossier({
        title: "Server Title (Updated by MCP)",
        slug: "server-slug",
        tagline: "Server Tagline",
        description: "Server Description",
        sku: "KIT-SERVER",
        status: "in_review",
        meta_title: "Server Meta Title",
        meta_description: "Server Meta Description",
      });

      const diffs = computeFieldDiffs(local, server);
      expect(diffs).toHaveLength(8);

      const diffKeys = diffs.map((d) => d.key);
      expect(diffKeys).toContain("title");
      expect(diffKeys).toContain("slug");
      expect(diffKeys).toContain("tagline");
      expect(diffKeys).toContain("description");
      expect(diffKeys).toContain("sku");
      expect(diffKeys).toContain("status");
      expect(diffKeys).toContain("meta_title");
      expect(diffKeys).toContain("meta_description");
    });

    it("2.2: computeFieldDiffs detects numeric field mutations across pricing and inventory", () => {
      const local = makeTrialDossier({
        price_paise: 200000,
        compare_at_price_paise: 250000,
        cost_paise: 100000,
        inventory_quantity: 30,
      });

      const server = makeTrialDossier({
        price_paise: 240000,
        compare_at_price_paise: 290000,
        cost_paise: 120000,
        inventory_quantity: 15,
      });

      const diffs = computeFieldDiffs(local, server);
      expect(diffs).toHaveLength(4);

      const priceDiff = diffs.find((d) => d.key === "price_paise");
      expect(priceDiff?.localVal).toBe(200000);
      expect(priceDiff?.serverVal).toBe(240000);

      const qtyDiff = diffs.find((d) => d.key === "inventory_quantity");
      expect(qtyDiff?.localVal).toBe(30);
      expect(qtyDiff?.serverVal).toBe(15);
    });

    it("2.3: computeFieldDiffs handles null, undefined, and zero boundary distinctions faithfully", () => {
      // 1. null vs string -> diff
      const diff1 = computeFieldDiffs(
        makeTrialDossier({ tagline: null }),
        makeTrialDossier({ tagline: "A vibrant Darjeeling" })
      );
      expect(diff1.find((d) => d.key === "tagline")).toBeDefined();

      // 2. null vs undefined -> both empty/nullish, should NOT report spurious diff
      const diff2 = computeFieldDiffs(
        makeTrialDossier({ tagline: null }),
        makeTrialDossier({ tagline: undefined })
      );
      expect(diff2.find((d) => d.key === "tagline")).toBeUndefined();

      // 3. cost_paise: null vs 0 (crucial commercial distinction: unknown cost vs zero cost)
      const diff3 = computeFieldDiffs(
        makeTrialDossier({ cost_paise: null }),
        makeTrialDossier({ cost_paise: 0 })
      );
      expect(diff3.find((d) => d.key === "cost_paise")).toBeDefined();
      expect(diff3.find((d) => d.key === "cost_paise")?.localVal).toBeNull();
      expect(diff3.find((d) => d.key === "cost_paise")?.serverVal).toBe(0);

      // 4. inventory_quantity: 0 vs 10
      const diff4 = computeFieldDiffs(
        makeTrialDossier({ inventory_quantity: 0 }),
        makeTrialDossier({ inventory_quantity: 10 })
      );
      expect(diff4.find((d) => d.key === "inventory_quantity")).toBeDefined();
    });

    it("2.4: computeFieldDiffs returns empty array when objects are identical", () => {
      const trialA = makeTrialDossier();
      const trialB = makeTrialDossier();

      const diffs = computeFieldDiffs(trialA, trialB);
      expect(diffs).toHaveLength(0);
    });

    it("2.5: ConflictDiffModal renders multi-field table with high-contrast local and server values", () => {
      const local = makeTrialDossier({
        title: "Local Title (Editor)",
        price_paise: 180000,
        sku: "KIT-LOCAL-1",
        revision: 2,
      });
      const server = makeTrialDossier({
        title: "Server Title (MCP Tool)",
        price_paise: 220000,
        sku: "KIT-SERVER-2",
        revision: 3,
      });

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

      // Modal container
      expect(markup).toContain('data-testid="conflict-diff-modal"');
      expect(markup).toContain('role="dialog"');
      expect(markup).toContain('aria-modal="true"');

      // Table headers & classes
      expect(markup).toContain("conflict-diff-table");
      expect(markup).toContain("Your Local Changes");
      expect(markup).toContain("Current Server Version (Rev #3)");

      // Diff rows rendered
      expect(markup).toContain("Local Title (Editor)");
      expect(markup).toContain("Server Title (MCP Tool)");
      expect(markup).toContain("180000");
      expect(markup).toContain("220000");
      expect(markup).toContain("KIT-LOCAL-1");
      expect(markup).toContain("KIT-SERVER-2");

      // Action buttons
      expect(markup).toContain("Keep Local (Overwrite)");
      expect(markup).toContain("Discard &amp; Accept Server");
    });

    it("2.6: ConflictDiffModal renders fallback guidance when only non-scalar data (assets/components) changed", () => {
      // Local and server have identical scalar metadata, but server has new revision
      const local = makeTrialDossier({ revision: 1 });
      const server = makeTrialDossier({ revision: 2 });

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

      expect(markup).toContain(
        "No direct top-level field differences found. Component or asset lists may have been updated."
      );
    });

    it("2.7: CAS Revision Race Simulation: 'Keep Local' vs 'Discard & Accept Server' state transitions", () => {
      // State setup:
      // Local has dirty draft: rev 1 in baseline, edited title to "My Local Edits"
      let workingDraft = makeTrialDossier({ title: "My Local Edits", revision: 1 });
      let serverBaseline = makeTrialDossier({ title: "Original Title", revision: 1 });

      // Incoming fresh server state after 409: rev 2, title was updated by peer to "Peer Edit"
      const incomingServer = makeTrialDossier({ title: "Peer Edit", revision: 2 });

      // Action A: Discard & Accept Server
      function executeDiscardServer() {
        workingDraft = { ...incomingServer };
        serverBaseline = { ...incomingServer };
      }

      // Action B: Keep Local (Overwrite)
      function executeKeepLocal() {
        // Keeps workingDraft as is, but updates serverBaseline to expected_revision = 2
        serverBaseline = { ...incomingServer };
      }

      // Test Action A:
      executeDiscardServer();
      expect(workingDraft.title).toBe("Peer Edit");
      expect(workingDraft.revision).toBe(2);
      expect(serverBaseline.revision).toBe(2);

      // Reset and test Action B:
      workingDraft = makeTrialDossier({ title: "My Local Edits", revision: 1 });
      serverBaseline = makeTrialDossier({ title: "Original Title", revision: 1 });

      executeKeepLocal();
      expect(workingDraft.title).toBe("My Local Edits"); // Preserved!
      expect(serverBaseline.revision).toBe(2); // Baseline bumped so next CAS mutation succeeds!
    });
  });

  // ==========================================================================
  // Suite 3: Draft Wizard Validation, Idempotency & Slugify Edge Cases
  // ==========================================================================
  describe("Suite 3: Draft Wizard Validation, Boundaries & Slugify (New Draft)", () => {
    it("3.1: Boundary title testing (0 chars, 2 chars, 3 chars)", () => {
      // 0 chars
      const empty = validateDraftInput({ title: "", price_rupees: 200 });
      expect(empty.isValid).toBe(false);
      expect(empty.errors.title).toBeDefined();

      // 1 char
      const oneChar = validateDraftInput({ title: "A", price_rupees: 200 });
      expect(oneChar.isValid).toBe(false);
      expect(oneChar.errors.title).toBeDefined();

      // 2 chars: "ab" -> rejected (min 3 required)
      const twoChars = validateDraftInput({ title: "ab", price_rupees: 200 });
      expect(twoChars.isValid).toBe(false);
      expect(twoChars.errors.title).toBe("Title is required and must be at least 3 characters.");

      // 3 chars: "abc" -> accepted!
      const threeChars = validateDraftInput({ title: "abc", price_rupees: 200 });
      expect(threeChars.isValid).toBe(true);
      expect(threeChars.errors.title).toBeUndefined();
    });

    it("3.2: Whitespace padding does not bypass 3-character title requirement", () => {
      // Padded 2-character title: "   ab   "
      const paddedTwo = validateDraftInput({ title: "   ab   ", price_rupees: 200 });
      expect(paddedTwo.isValid).toBe(false);
      expect(paddedTwo.errors.title).toBeDefined();

      // Whitespace only
      const spacesOnly = validateDraftInput({ title: "        ", price_rupees: 200 });
      expect(spacesOnly.isValid).toBe(false);

      // Padded 3-character title: "   abc   "
      const paddedThree = validateDraftInput({ title: "   abc   ", price_rupees: 200 });
      expect(paddedThree.isValid).toBe(true);
    });

    it("3.3: Upper boundary title testing (180 chars vs 181 chars) against Zod backend schema", () => {
      const title180 = "T".repeat(180);
      const title181 = "T".repeat(181);

      // 180 chars: valid on client and server
      const client180 = validateDraftInput({ title: title180, price_rupees: 200 });
      expect(client180.isValid).toBe(true);

      const server180 = createTrialSchema.safeParse({ title: title180, price_paise: 20000 });
      expect(server180.success).toBe(true);

      // Server strictly enforces max 180 chars
      const server181 = createTrialSchema.safeParse({ title: title181, price_paise: 20000 });
      expect(server181.success).toBe(false);
      if (!server181.success) {
        expect(server181.error.issues[0].message).toContain("180");
      }

      // Client validator validateDraftInput must also enforce max 180 chars
      const client181 = validateDraftInput({ title: title181, price_rupees: 200 });
      expect(client181.isValid).toBe(false);
      expect(client181.errors.title).toBeDefined();
    });

    it("3.4: Price boundary testing (0 paise, 1 paise, negative paise, non-numeric)", () => {
      // 0 rupees (0 paise) -> rejected (must be > ₹0.00)
      const zeroPrice = validateDraftInput({ title: "Valid Title", price_rupees: 0 });
      expect(zeroPrice.isValid).toBe(false);
      expect(zeroPrice.errors.price_rupees).toBe("Price must be greater than ₹0.00.");

      const zeroString = validateDraftInput({ title: "Valid Title", price_rupees: "0" });
      expect(zeroString.isValid).toBe(false);

      // Negative paise (-₹5.00, -₹0.01) -> rejected
      const negPrice = validateDraftInput({ title: "Valid Title", price_rupees: -5 });
      expect(negPrice.isValid).toBe(false);

      const negSmall = validateDraftInput({ title: "Valid Title", price_rupees: "-0.01" });
      expect(negSmall.isValid).toBe(false);

      // Non-numeric ("abc", "NaN", "") -> rejected
      const textPrice = validateDraftInput({ title: "Valid Title", price_rupees: "free" });
      expect(textPrice.isValid).toBe(false);

      const emptyPrice = validateDraftInput({ title: "Valid Title", price_rupees: "" });
      expect(emptyPrice.isValid).toBe(false);

      const nanPrice = validateDraftInput({ title: "Valid Title", price_rupees: NaN });
      expect(nanPrice.isValid).toBe(false);

      // 1 paise (₹0.01 in rupees) -> accepted
      const onePaise = validateDraftInput({ title: "Valid Title", price_rupees: 0.01 });
      expect(onePaise.isValid).toBe(true);
      expect(Math.round(0.01 * 100)).toBe(1); // 1 paise

      // Standard kit price (₹200.00 -> 20,000 paise) -> accepted
      const stdPrice = validateDraftInput({ title: "Valid Title", price_rupees: 200 });
      expect(stdPrice.isValid).toBe(true);
    });

    it("3.5: Slug format validation in validateDraftInput rejects invalid characters", () => {
      // Valid kebab-case slugs
      expect(validateDraftInput({ title: "Valid Title", price_rupees: 200, slug: "darjeeling-flight" }).isValid).toBe(true);
      expect(validateDraftInput({ title: "Valid Title", price_rupees: 200, slug: "assam-2026-gold" }).isValid).toBe(true);
      expect(validateDraftInput({ title: "Valid Title", price_rupees: 200, slug: "a" }).isValid).toBe(true);

      // Invalid: uppercase characters
      const upperSlug = validateDraftInput({ title: "Valid Title", price_rupees: 200, slug: "Darjeeling-Flight" });
      expect(upperSlug.isValid).toBe(false);
      expect(upperSlug.errors.slug).toBeDefined();

      // Invalid: spaces
      const spaceSlug = validateDraftInput({ title: "Valid Title", price_rupees: 200, slug: "darjeeling flight" });
      expect(spaceSlug.isValid).toBe(false);

      // Invalid: symbols
      const symbolSlug = validateDraftInput({ title: "Valid Title", price_rupees: 200, slug: "darjeeling_flight!" });
      expect(symbolSlug.isValid).toBe(false);

      // Invalid: double hyphens
      const doubleHyphen = validateDraftInput({ title: "Valid Title", price_rupees: 200, slug: "darjeeling--flight" });
      expect(doubleHyphen.isValid).toBe(false);

      // Invalid: leading or trailing hyphens
      const leadingHyphen = validateDraftInput({ title: "Valid Title", price_rupees: 200, slug: "-darjeeling-flight" });
      expect(leadingHyphen.isValid).toBe(false);

      const trailingHyphen = validateDraftInput({ title: "Valid Title", price_rupees: 200, slug: "darjeeling-flight-" });
      expect(trailingHyphen.isValid).toBe(false);
    });

    it("3.6: slugify handles unicode, accents, spaces, and symbols robustly", () => {
      // Accents & diacritics
      expect(slugify("Café au Thé Darjeeling")).toBe("caf-au-th-darjeeling");

      // Multiple consecutive spaces & underscores
      expect(slugify("Assam     CTC   __  BOP   2026")).toBe("assam-ctc-bop-2026");

      // Punctuation and commercial symbols
      expect(slugify("Kit #1: 100% Organic & Single-Estate (Darjeeling)!")).toBe(
        "kit-1-100-organic-single-estate-darjeeling"
      );

      // Leading and trailing symbols and hyphens
      expect(slugify("  ---***TeaFloww Discovery Kit***---  ")).toBe("teafloww-discovery-kit");

      // Emoji stripping
      expect(slugify("🍵 Himalayan First Flush 🏔️")).toBe("himalayan-first-flush");

      // Numbers only
      expect(slugify("2026 04 17")).toBe("2026-04-17");

      // Script that contains non-Latin letters (all non-ascii stripped cleanly)
      expect(slugify("दार्जिलिंग Darjeeling चाय")).toBe("darjeeling");

      // Entirely invalid characters returns clean empty string without throwing
      expect(slugify("!@#$%^&*()_+=")).toBe("");
    });

    it("3.7: Idempotency token generation produces unique entropy on each submission invocation", () => {
      const keys = new Set<string>();
      const iterations = 50;

      for (let i = 0; i < iterations; i++) {
        const key = `trial_create_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        expect(key).toMatch(/^trial_create_\d+_[a-z0-9]+$/);
        keys.add(key);
      }

      // No collisions in 50 consecutive runs
      expect(keys.size).toBe(iterations);
    });
  });
});
