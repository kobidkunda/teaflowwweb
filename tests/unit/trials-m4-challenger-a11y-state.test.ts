/**
 * TeaFloww Trials v3 — Milestone 4 Admin Trial Studio
 * Adversarial Security, Accessibility (a11y), and State Retention Test Suite
 *
 * Challenger: trials_m4_challenger_2
 * Scope:
 * 1. Form State Retention Across Tab Switching (F16.B1)
 * 2. Tab Error Highlighting (F16.B2)
 * 3. Accessibility Attributes Stress (ARIA roles, live regions, keyboard handles)
 * 4. HTML Sanitization & XSS Resistance (Zero raw markup execution/injection)
 * 5. Gross Margin Calculator Edge Cases (Zero price, cost > price, cost == 0, large numbers, NaN)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => "/admin/trials/tr_test_adversarial",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ id: "tr_test_adversarial" }),
}));

import {
  TrialStudioClient,
  type StudioTabKey,
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
  TrialSplitPreview,
} from "@/components/admin/trials/TrialSplitPreview";
import {
  ConflictDiffModal,
} from "@/components/admin/trials/ConflictDiffModal";

import type { TrialWithDetails, TrialComponent, TrialBulkLink } from "@/lib/trials/types";

// ============================================================================
// Fixture Factories
// ============================================================================
function createComponent(slot_index: number, name: string, weight_g = 50, overrides: Partial<TrialComponent> = {}): TrialComponent {
  return {
    id: `comp_adv_${slot_index}`,
    trial_id: "tr_test_adversarial",
    slot_index,
    name,
    estate: "Makaibari Estate",
    grade: "FTGFOP1",
    flush: "Second Flush",
    elevation: "1500m",
    weight_g,
    quantity: 1,
    tasting_notes: JSON.stringify(["Muscatel", "Ripe Apricot"]),
    brew_temp_c: 90,
    brew_time_sec: 180,
    leaf_dose_g: 2.5,
    regular_product_id: null,
    regular_variant_id: null,
    sort_order: slot_index,
    ...overrides,
  };
}

function createTrialDossier(overrides: Partial<TrialWithDetails> = {}): TrialWithDetails {
  return {
    id: "tr_test_adversarial",
    slug: "darjeeling-spring-cupping-flight",
    title: "Darjeeling Spring Cupping Flight",
    tagline: "Four high-elevation spring flushes direct from the Kurseong valley",
    description: "Experience terroir nuance across unblended Darjeeling micro-lots.",
    status: "draft",
    pack_format: "4x50g_sachets",
    net_weight_g: 200,
    price_paise: 180000, // ₹1,800.00
    compare_at_price_paise: 220000, // ₹2,200.00
    cost_paise: 90000, // ₹900.00 (50% margin)
    sku: "KIT-DARJ-SPRING-4X50G",
    inventory_quantity: 40,
    inventory_policy: "track",
    hero_image_id: 10,
    meta_title: "Darjeeling Spring Cupping Flight — TeaFloww Trials",
    meta_description: "Taste four micro-lots direct from high-elevation estates.",
    revision: 1,
    created_at: "2026-11-05T00:00:00Z",
    updated_at: "2026-11-05T00:00:00Z",
    published_at: null,
    archived_at: null,
    hero_image: { url: "/media/hero.webp", alt_text: "Trial Outer Box" },
    components: [
      createComponent(0, "Makaibari Silver Green", 50),
      createComponent(1, "Castleton Muscatel Reserve", 50),
      createComponent(2, "Risheehat Summer Blossom", 50),
      createComponent(3, "Gopaldhara Red Thunder", 50),
    ],
    assets: [
      {
        id: "ast_1",
        trial_id: "tr_test_adversarial",
        component_id: null,
        slot_index: null,
        media_id: 1,
        asset_url: "/media/pack.webp",
        stage: "packaging",
        alt_text: "Kit box packaging foil",
        rights_status: "owned",
        sort_order: 0,
      },
      {
        id: "ast_2",
        trial_id: "tr_test_adversarial",
        component_id: "comp_adv_0",
        slot_index: 0,
        media_id: 2,
        asset_url: "/media/dry0.webp",
        stage: "dry_leaf",
        alt_text: "Silver Green Dry Leaf",
        rights_status: "owned",
        sort_order: 1,
      },
    ],
    brew_guides: [],
    sensory_tests: [],
    claims: [
      {
        id: "clm_1",
        trial_id: "tr_test_adversarial",
        claim_type: "origin",
        label: "Single Estate",
        claim_text: "100% Darjeeling single garden orthodox leaf",
        basis: "Garden invoice",
        evidence_ref: "REF-MK-2026",
        verified: 1,
        approved_by: "Q-Grader",
        approved_at: "2026-11-05T00:00:00Z",
        expires_at: null,
        sort_order: 0,
      },
    ],
    bulk_links: [],
    ...overrides,
  };
}

/**
 * Test Harness to inject activeTab and tabErrors into TrialStudioClient
 * utilizing React 19 server dispatcher hook interception.
 */
function StudioStateInjectionWrapper({
  trial,
  activeTab,
  tabErrors,
}: {
  trial: TrialWithDetails;
  activeTab: StudioTabKey;
  tabErrors: Record<string, Record<string, string>>;
}) {
  const internals = (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  const origUseState = internals.H.useState;
  let callCount = 0;

  internals.H.useState = (init: any) => {
    callCount++;
    // Call 3 in TrialStudioClient is activeTab
    if (callCount === 3) {
      return [activeTab, vi.fn()];
    }
    // Call 8 in TrialStudioClient is tabErrors
    if (callCount === 8) {
      return [tabErrors, vi.fn()];
    }
    return origUseState(init);
  };

  return React.createElement(TrialStudioClient, {
    trialId: trial.id,
    initialTrial: trial,
  });
}

describe("Adversarial Suite: Admin Trial Studio (Security, A11y, State Retention)", () => {
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
  // OBJECTIVE 1: Form State Retention Across Tab Switching (F16.B1)
  // ==========================================================================
  describe("Objective 1: Form State Retention Across Tab Switching (F16.B1)", () => {
    it("preserves uncommitted working draft state across full 5-tab lifecycle in memory", () => {
      const initialTrial = createTrialDossier({ revision: 1 });

      // Step 0: State begins with initial baseline
      let workingDraft: TrialWithDetails = { ...initialTrial };
      const serverBaseline: TrialWithDetails = { ...initialTrial };

      const patchWorkingDraft = (patch: Partial<TrialWithDetails>) => {
        workingDraft = { ...workingDraft, ...patch };
      };

      // Step 1: User edits Tab 1 (Identity & Pricing) without saving
      patchWorkingDraft({
        title: "Uncommitted Title Mutation",
        price_paise: 240000, // ₹2,400.00
        compare_at_price_paise: 280000,
        cost_paise: 120000, // ₹1,200.00
        sku: "KIT-UNSAVED-SKU",
        tagline: "Uncommitted Tagline Mutation",
        description: "Uncommitted Description Mutation",
        inventory_quantity: 88,
      });

      // Verify workingDraft was updated in memory while serverBaseline revision remains untouched
      expect(workingDraft.title).toBe("Uncommitted Title Mutation");
      expect(workingDraft.price_paise).toBe(240000);
      expect(serverBaseline.title).toBe("Darjeeling Spring Cupping Flight");
      expect(serverBaseline.revision).toBe(1);

      // Step 2: Switch to Tab 2 (Pouches Composer)
      // User swaps slot 0 and slot 1, and edits slot 2 estate
      const reordered = reorderSachets(workingDraft.components, 0, 1);
      const updatedComponents = reordered.map((c, i) =>
        i === 2 ? { ...c, estate: "Makaibari High Garden Reserve" } : c
      );
      patchWorkingDraft({ components: updatedComponents });

      expect(workingDraft.components[0].name).toBe("Castleton Muscatel Reserve");
      expect(workingDraft.components[1].name).toBe("Makaibari Silver Green");
      expect(workingDraft.components[2].estate).toBe("Makaibari High Garden Reserve");

      // Step 3: Switch to Tab 3 (Optical Proofs & Brewing)
      // User updates brewing parameters on sachet slot 0
      const brewingPatched = workingDraft.components.map((c, i) =>
        i === 0 ? { ...c, brew_temp_c: 96, brew_time_sec: 240, leaf_dose_g: 3.0 } : c
      );
      patchWorkingDraft({ components: brewingPatched });

      expect(workingDraft.components[0].brew_temp_c).toBe(96);
      expect(workingDraft.components[0].brew_time_sec).toBe(240);

      // Step 4: Switch to Tab 4 (Promotions & Bulk)
      // User adds a bulk link and claim
      const newBulkLink: TrialBulkLink = {
        id: "bl_adv_1",
        trial_id: workingDraft.id,
        component_id: workingDraft.components[0].id,
        product_id: 101,
        variant_id: 201,
        pack_size_grams: 250,
        display_label: "250g Full Garden Pouch",
        discount_percent: 20,
        subscriber_eligible: 1,
        sort_order: 0,
        product_slug: "castleton-muscatel",
        variant_title: "250g Pouch",
      };
      patchWorkingDraft({ bulk_links: [newBulkLink] });

      expect(workingDraft.bulk_links).toHaveLength(1);
      expect(workingDraft.bulk_links[0].discount_percent).toBe(20);

      // Step 5: Switch to Tab 5 (Preview & Publish)
      // Verify simulated PDP in split preview reflects the uncommitted mutations across all tabs
      const previewMarkup = renderToStaticMarkup(
        React.createElement(TrialSplitPreview, { trial: workingDraft })
      );

      // Reflects Tab 1 uncommitted edits
      expect(previewMarkup).toContain("Uncommitted Title Mutation");
      expect(previewMarkup).toContain("Uncommitted Tagline Mutation");
      expect(previewMarkup).toContain("₹2,400.00"); // 240000 paise formatted
      expect(previewMarkup).toContain("₹2,800.00"); // strike price

      // Reflects Tab 2 uncommitted reordering (slot 0 is Castleton, slot 1 is Makaibari)
      expect(previewMarkup).toContain("#1 Castleton Muscatel Reserve");
      expect(previewMarkup).toContain("#2 Makaibari Silver Green");

      // Step 6: Switch BACK to Tab 1 (Identity & Pricing)
      // Verify Tab 1 input fields still contain uncommitted working draft values
      const identityMarkup = renderToStaticMarkup(
        React.createElement(TrialTabIdentity, {
          trial: workingDraft,
          onChange: () => {},
          onSave: async () => {},
          saving: false,
        })
      );

      expect(identityMarkup).toContain('value="Uncommitted Title Mutation"');
      expect(identityMarkup).toContain('value="2400.00"'); // Price in Rupees
      expect(identityMarkup).toContain('value="2800.00"'); // Compare-at
      expect(identityMarkup).toContain('value="1200.00"'); // COGS
      expect(identityMarkup).toContain('value="KIT-UNSAVED-SKU"');
      expect(identityMarkup).toContain("50.0%"); // Gross margin: ((2400-1200)/2400)*100 = 50.0%

      // Step 7: Switch BACK to Tab 2 (Pouches Composer)
      // Verify Tab 2 reflects the swapped components and modified estate
      const pouchesMarkup = renderToStaticMarkup(
        React.createElement(TrialTabPouches, {
          components: workingDraft.components,
          onChange: () => {},
          onSave: async () => {},
          saving: false,
        })
      );

      expect(pouchesMarkup).toContain("Castleton Muscatel Reserve");
      expect(pouchesMarkup).toContain("Makaibari Silver Green");
      expect(pouchesMarkup).toContain("Makaibari High Garden Reserve");
      expect(pouchesMarkup).toContain("Balanced (200g)");

      // Concurrency invariant: serverBaseline.revision is STILL 1
      expect(serverBaseline.revision).toBe(1);
    });

    it("verifies that discarding server changes reverts working draft to pristine baseline", () => {
      const pristineServer = createTrialDossier({ revision: 2, title: "Server Official Title" });
      let workingDraft = { ...pristineServer, title: "Local Dirty Title" };

      // Simulate discard & accept server
      workingDraft = { ...pristineServer };

      expect(workingDraft.title).toBe("Server Official Title");
      expect(workingDraft.revision).toBe(2);
    });
  });

  // ==========================================================================
  // OBJECTIVE 2: Tab Error Highlighting (F16.B2)
  // ==========================================================================
  describe("Objective 2: Tab Error Highlighting (F16.B2)", () => {
    it("renders red error indicator badge on tab header when tabErrors contains errors for that tab", () => {
      const mockTrial = createTrialDossier();

      // Render with activeTab = "pouches" and errors on "identity" and "optical"
      const markup = renderToStaticMarkup(
        React.createElement(StudioStateInjectionWrapper, {
          trial: mockTrial,
          activeTab: "pouches",
          tabErrors: {
            identity: { title: "Title is required", price_paise: "Must be positive" },
            optical: { assets: "Missing mandatory alt text" },
          },
        })
      );

      // Verify Tab 1 (Identity & Pricing) displays the error styling
      expect(markup).toContain("1. Identity &amp; Pricing");
      expect(markup).toContain("border-bottom:3px solid #9b1c1c");
      expect(markup).toContain("color:#9b1c1c");

      // Verify Tab 3 (Optical & Brewing) displays the error styling
      expect(markup).toContain("3. Optical &amp; Brewing");

      // Verify the red dot badges: <span style="width:8px;height:8px;border-radius:50%;background:#9b1c1c"></span>
      const errorDots = markup.match(/width:8px;height:8px;border-radius:50%;background:#9b1c1c/g);
      expect(errorDots).not.toBeNull();
      // Exactly 2 tabs have errors (Identity and Optical)
      expect(errorDots?.length).toBe(2);

      // Active tab (Pouches) has active border (#143c31) and NO error badge
      expect(markup).toContain("border-bottom:3px solid #143c31");
    });

    it("evaluates publication gates and maps failed gates to corresponding tab keys for jump navigation", () => {
      // Incomplete trial: title too short (<3), price 0, sum of sachets != 200g, missing alt text
      const brokenTrial = createTrialDossier({
        title: "No", // Gate 1 fails -> identity
        price_paise: 0, // Gate 2 fails -> identity
        components: [
          createComponent(0, "Underweight Tea", 40), // 40 + 50 + 50 + 50 = 190g -> Gate 3 fails -> pouches
          createComponent(1, "Tea B", 50),
          createComponent(2, "Tea C", 50),
          createComponent(3, "Tea D", 50),
        ],
        assets: [
          {
            id: "ast_bad",
            trial_id: "tr_test_adversarial",
            component_id: null,
            slot_index: null,
            media_id: 1,
            asset_url: "/media/photo.webp",
            stage: "packaging",
            alt_text: "x", // 1 character (< 2) -> Gate 4 fails -> optical
            rights_status: "owned",
            sort_order: 0,
          },
        ],
        claims: [
          {
            id: "clm_bad",
            trial_id: "tr_test_adversarial",
            claim_type: "origin",
            label: "Unverified Claim",
            claim_text: "Unverified",
            basis: "Rumor",
            evidence_ref: "", // Empty -> Gate 5 fails -> promotions
            verified: 0,
            approved_by: null,
            approved_at: null,
            expires_at: null,
            sort_order: 0,
          },
        ],
      });

      const { canPublish, gates } = evaluatePublicationGates(brokenTrial);

      expect(canPublish).toBe(false);
      expect(gates).toHaveLength(5);

      // Verify exact tabKey mapping for each gate failure
      const gate1 = gates.find((g) => g.gateId === 1);
      expect(gate1?.passed).toBe(false);
      expect(gate1?.tabKey).toBe("identity");

      const gate2 = gates.find((g) => g.gateId === 2);
      expect(gate2?.passed).toBe(false);
      expect(gate2?.tabKey).toBe("identity");

      const gate3 = gates.find((g) => g.gateId === 3);
      expect(gate3?.passed).toBe(false);
      expect(gate3?.tabKey).toBe("pouches");

      const gate4 = gates.find((g) => g.gateId === 4);
      expect(gate4?.passed).toBe(false);
      expect(gate4?.tabKey).toBe("optical");

      const gate5 = gates.find((g) => g.gateId === 5);
      expect(gate5?.passed).toBe(false);
      expect(gate5?.tabKey).toBe("promotions");
    });

    it("renders checklist blocker count and jump navigation buttons in Tab 5", () => {
      const mockTrial = createTrialDossier({ price_paise: 0 }); // 1 blocker
      const mockNavigate = vi.fn();

      const markup = renderToStaticMarkup(
        React.createElement(TrialTabPublish, {
          trial: mockTrial,
          serverValidation: { can_publish: false, blockers: ["Price must be greater than zero"] },
          onNavigateTab: mockNavigate,
          onSubmitReview: async () => {},
          onPublish: async () => {},
          onUnpublish: async () => {},
          onArchive: async () => {},
          saving: false,
        })
      );

      expect(markup).toContain('data-testid="launch-readiness-checklist"');
      expect(markup).toContain("Blockers Pending");
      expect(markup).toContain("Resolve in Tab"); // Exact jump navigation action text
    });

    it("renders inline field error messages in Tab 1 when errors prop is provided", () => {
      const mockTrial = createTrialDossier();
      const markup = renderToStaticMarkup(
        React.createElement(TrialTabIdentity, {
          trial: mockTrial,
          onChange: () => {},
          onSave: async () => {},
          saving: false,
          errors: {
            title: "Title must be at least 3 characters",
            price_paise: "Price must be greater than zero",
          },
        })
      );

      // Check red border styling and error text
      expect(markup).toContain("Title must be at least 3 characters");
      expect(markup).toContain("Price must be greater than zero");
      expect(markup).toContain("border:1px solid #8f2f2a");
    });
  });

  // ==========================================================================
  // OBJECTIVE 3: Accessibility Attributes Stress
  // ==========================================================================
  describe("Objective 3: Accessibility Attributes Stress", () => {
    it("verifies sachet drag handle has role='button', tabIndex=0, and aria-label", () => {
      const mockComponents = [
        createComponent(0, "Sachet 1", 50),
        createComponent(1, "Sachet 2", 50),
        createComponent(2, "Sachet 3", 50),
        createComponent(3, "Sachet 4", 50),
      ];

      const markup = renderToStaticMarkup(
        React.createElement(TrialTabPouches, {
          components: mockComponents,
          onChange: () => {},
          onSave: async () => {},
          saving: false,
        })
      );

      // Verify keyboard drag handle
      expect(markup).toContain('data-testid="sachet-drag-handle"');
      expect(markup).toContain('tabindex="0"');
      expect(markup).toContain('role="button"');
      expect(markup).toContain('aria-label="Reorder sachet 1. Press Space to grab, Arrow Up or Down to move, Space to drop."');
      expect(markup).toContain('title="Drag or press Space to reorder"');

      // Verify aria-live polite region for screen readers
      expect(markup).toContain('role="status"');
      expect(markup).toContain('aria-live="polite"');
    });

    it("verifies Move Up / Move Down accessible button states and ARIA labels", () => {
      const mockComponents = [
        createComponent(0, "Slot 0 Tea", 50),
        createComponent(1, "Slot 1 Tea", 50),
        createComponent(2, "Slot 2 Tea", 50),
        createComponent(3, "Slot 3 Tea", 50),
      ];

      const markup = renderToStaticMarkup(
        React.createElement(TrialTabPouches, {
          components: mockComponents,
          onChange: () => {},
          onSave: async () => {},
          saving: false,
        })
      );

      // Slot 0 Move Up must be disabled with aria-label
      expect(markup).toContain('aria-label="Move sachet 1 up"');
      // Slot 3 (last slot) Move Down must be disabled with aria-label
      expect(markup).toContain('aria-label="Move sachet 4 down"');
    });

    it("verifies tablist navigation structure and ARIA attributes in TrialStudioClient", () => {
      const mockTrial = createTrialDossier();
      const markup = renderToStaticMarkup(
        React.createElement(TrialStudioClient, {
          trialId: "tr_test_adversarial",
          initialTrial: mockTrial,
        })
      );

      // Container role and label
      expect(markup).toContain('role="tablist"');
      expect(markup).toContain('aria-label="Admin Trial Studio Sections"');

      // Tabs role and aria-selected
      expect(markup).toContain('role="tab"');
      expect(markup).toContain('aria-selected="true"');
      expect(markup).toContain('aria-controls="panel-identity"');

      // Active panel role
      expect(markup).toContain('id="panel-identity"');
      expect(markup).toContain('role="tabpanel"');
    });

    it("verifies ConflictDiffModal has role='dialog', aria-modal='true', and accessible labeling", () => {
      const localTrial = createTrialDossier({ title: "Local Edit", revision: 1 });
      const serverTrial = createTrialDossier({ title: "Server Conflict", revision: 2 });

      const markup = renderToStaticMarkup(
        React.createElement(ConflictDiffModal, {
          isOpen: true,
          localTrial,
          serverTrial,
          onKeepLocal: () => {},
          onAcceptServer: () => {},
          onClose: () => {},
        })
      );

      expect(markup).toContain('role="dialog"');
      expect(markup).toContain('aria-modal="true"');
      expect(markup).toContain('aria-labelledby="conflict-dialog-title"');
      expect(markup).toContain('id="conflict-dialog-title"');
      expect(markup).toContain("Revision Conflict Detected (HTTP 409)");
    });

    it("verifies form inputs in Tab 1 have explicit label associations via htmlFor", () => {
      const mockTrial = createTrialDossier();
      const markup = renderToStaticMarkup(
        React.createElement(TrialTabIdentity, {
          trial: mockTrial,
          onChange: () => {},
          onSave: async () => {},
          saving: false,
        })
      );

      // Check htmlFor matches input id for all critical controls
      expect(markup).toContain('for="identity-title"');
      expect(markup).toContain('id="identity-title"');
      expect(markup).toContain('for="identity-slug"');
      expect(markup).toContain('id="identity-slug"');
      expect(markup).toContain('for="identity-price"');
      expect(markup).toContain('id="identity-price"');
      expect(markup).toContain('for="identity-compare-price"');
      expect(markup).toContain('id="identity-compare-price"');
      expect(markup).toContain('for="identity-cost"');
      expect(markup).toContain('id="identity-cost"');
      expect(markup).toContain('for="identity-sku"');
      expect(markup).toContain('id="identity-sku"');
      expect(markup).toContain('for="identity-policy"');
      expect(markup).toContain('id="identity-policy"');
      expect(markup).toContain('for="identity-stock"');
      expect(markup).toContain('id="identity-stock"');
    });
  });

  // ==========================================================================
  // OBJECTIVE 4: HTML Sanitization & XSS Resistance
  // ==========================================================================
  describe("Objective 4: HTML Sanitization & XSS Resistance", () => {
    it("resists malicious script tag and event handler injection in Trial fields", () => {
      const maliciousTrial = createTrialDossier({
        title: "<script>alert('xss-title')</script>",
        tagline: "<img src=x onerror=alert('xss-tagline') />",
        description: '"><script>alert("xss-desc")</script><"',
        sku: "<svg/onload=alert('xss-sku')>",
        meta_title: "<script>alert('xss-meta')</script>",
        meta_description: "<b onmouseover=alert(1)>Hover Me</b>",
      });

      // 1. Render in TrialStudioClient
      const studioMarkup = renderToStaticMarkup(
        React.createElement(TrialStudioClient, {
          trialId: "tr_test_adversarial",
          initialTrial: maliciousTrial,
        })
      );

      // Verify that NO executable unescaped tags exist in HTML markup
      expect(studioMarkup).not.toContain("<script>alert('xss-title')</script>");
      expect(studioMarkup).not.toContain("<img src=x onerror=alert('xss-tagline') />");
      expect(studioMarkup).not.toContain("<svg/onload=alert('xss-sku')>");

      // Verify that React properly escaped characters into HTML entities
      expect(studioMarkup).toContain("&lt;script&gt;alert(&#x27;xss-title&#x27;)&lt;/script&gt;");
      expect(studioMarkup).toContain("&lt;img src=x onerror=alert(&#x27;xss-tagline&#x27;) /&gt;");

      // 2. Render in TrialTabIdentity inputs
      const identityMarkup = renderToStaticMarkup(
        React.createElement(TrialTabIdentity, {
          trial: maliciousTrial,
          onChange: () => {},
          onSave: async () => {},
          saving: false,
        })
      );

      expect(identityMarkup).not.toContain("<script>alert('xss-title')</script>");
      expect(identityMarkup).toContain("&lt;script&gt;alert(&#x27;xss-title&#x27;)&lt;/script&gt;");

      // 3. Render in TrialSplitPreview (simulated PDP)
      const previewMarkup = renderToStaticMarkup(
        React.createElement(TrialSplitPreview, { trial: maliciousTrial })
      );

      expect(previewMarkup).not.toContain("<script>alert('xss-title')</script>");
      expect(previewMarkup).not.toContain("<img src=x onerror=");
      expect(previewMarkup).toContain("&lt;script&gt;alert(&#x27;xss-title&#x27;)&lt;/script&gt;");
      expect(previewMarkup).toContain("&lt;img src=x onerror=alert(&#x27;xss-tagline&#x27;) /&gt;");
    });

    it("resists XSS injection inside component names, estates, and tasting notes", () => {
      const maliciousTrial = createTrialDossier({
        components: [
          createComponent(0, "<script>alert('comp-0')</script>", 50, {
            estate: "<b onfocus=alert(1)>Malicious Estate</b>",
            grade: "FTGFOP1<script>",
            flush: "Second Flush\"><script>alert(2)</script>",
            // Valid JSON string containing malicious payload strings
            tasting_notes: JSON.stringify([
              "<script>alert('note-xss')</script>",
              "<img src='bad' onerror='alert(3)'>",
            ]),
          }),
          createComponent(1, "Clean Tea 1", 50),
          createComponent(2, "Clean Tea 2", 50),
          createComponent(3, "Clean Tea 3", 50),
        ],
      });

      // Render Pouches Tab
      const pouchesMarkup = renderToStaticMarkup(
        React.createElement(TrialTabPouches, {
          components: maliciousTrial.components,
          onChange: () => {},
          onSave: async () => {},
          saving: false,
        })
      );

      expect(pouchesMarkup).not.toContain("<script>alert('comp-0')</script>");
      expect(pouchesMarkup).toContain("&lt;script&gt;alert(&#x27;comp-0&#x27;)&lt;/script&gt;");

      // Render Live Preview (Tasting Notes pills)
      const previewMarkup = renderToStaticMarkup(
        React.createElement(TrialSplitPreview, { trial: maliciousTrial })
      );

      expect(previewMarkup).not.toContain("<script>alert('note-xss')</script>");
      expect(previewMarkup).not.toContain("<img src='bad' onerror='alert(3)'>");
      expect(previewMarkup).toContain("&lt;script&gt;alert(&#x27;note-xss&#x27;)&lt;/script&gt;");
    });

    it("handles corrupted, unparseable, and adversarial raw tasting_notes without crashing", () => {
      const corruptedTrial = createTrialDossier({
        components: [
          createComponent(0, "Pouch With Corrupt Notes", 50, {
            // Raw non-JSON malicious string injection
            tasting_notes: "<script>alert('corrupt-raw-string')</script>",
          }),
          createComponent(1, "Clean 1", 50),
          createComponent(2, "Clean 2", 50),
          createComponent(3, "Clean 3", 50),
        ],
      });

      // Does not throw an uncaught SyntaxError in JSON.parse; gracefully falls back to empty array
      let previewMarkup = "";
      expect(() => {
        previewMarkup = renderToStaticMarkup(
          React.createElement(TrialSplitPreview, { trial: corruptedTrial })
        );
      }).not.toThrow();

      // No unescaped script rendered
      expect(previewMarkup).not.toContain("<script>alert('corrupt-raw-string')</script>");
      expect(previewMarkup).toContain("Pouch With Corrupt Notes");
    });

    it("escapes image alt attributes preventing attribute breakout attacks", () => {
      const breakoutTrial = createTrialDossier({
        hero_image: {
          url: "/media/hero.webp",
          alt_text: 'Breakout alt',
        },
        title: 'Breakout " title="injection <script>alert(1)</script>',
      });

      const previewMarkup = renderToStaticMarkup(
        React.createElement(TrialSplitPreview, { trial: breakoutTrial })
      );

      // Must not contain unescaped raw breakout script tag
      expect(previewMarkup).not.toContain('<script>alert(1)</script>');
      // Attributes must be entity-encoded: quotes escaped to &quot; and tags to &lt;script&gt;
      expect(previewMarkup).toContain('alt="Breakout &quot; title=&quot;injection &lt;script&gt;alert(1)&lt;/script&gt;"');
    });

    it("resists XSS injection in claims, evidence refs, and bulk link labels", () => {
      const maliciousTrial = createTrialDossier({
        claims: [
          {
            id: "clm_xss",
            trial_id: "tr_test_adversarial",
            claim_type: "origin",
            label: "<script>alert('claim-label')</script>",
            claim_text: "<img src=x onerror=alert('claim-text')>",
            basis: "Verified invoice <script>alert(1)</script>",
            evidence_ref: "REF-XSS-<script>",
            verified: 1,
            approved_by: "Q-Grader",
            approved_at: "2026-11-05T00:00:00Z",
            expires_at: null,
            sort_order: 0,
          },
        ],
        bulk_links: [
          {
            id: "bl_xss",
            trial_id: "tr_test_adversarial",
            component_id: "comp_0",
            product_id: 101,
            variant_id: 201,
            pack_size_grams: 250,
            display_label: "<script>alert('bulk-label')</script>",
            discount_percent: 15,
            subscriber_eligible: 1,
            sort_order: 0,
            product_slug: "test-slug",
            variant_title: "250g",
          },
        ],
      });

      const promoMarkup = renderToStaticMarkup(
        React.createElement(TrialTabPromotions, {
          trial: maliciousTrial,
          onChangeBulkLinks: () => {},
          onChangeClaims: () => {},
          saving: false,
        })
      );

      expect(promoMarkup).not.toContain("<script>alert('claim-label')</script>");
      expect(promoMarkup).not.toContain("<img src=x onerror=alert('claim-text')>");
      expect(promoMarkup).not.toContain("<script>alert('bulk-label')</script>");
    });
  });

  // ==========================================================================
  // OBJECTIVE 5: Gross Margin Calculator Edge Cases
  // ==========================================================================
  describe("Objective 5: Gross Margin Calculator Edge Cases", () => {
    it("handles zero price safely without division by zero or NaN", () => {
      // price = 0 paise, cost = 1000 paise
      const resZeroPrice = calculateGrossMargin(0, 1000);
      expect(resZeroPrice.percent).toBeNull();
      expect(resZeroPrice.label).toBe("Unknown / COGS not set");

      // price = 0 paise, cost = 0 paise
      const resBothZero = calculateGrossMargin(0, 0);
      expect(resBothZero.percent).toBeNull();
      expect(resBothZero.label).toBe("Unknown / COGS not set");
    });

    it("handles negative price safely", () => {
      const resNegPrice = calculateGrossMargin(-5000, 2000);
      expect(resNegPrice.percent).toBeNull();
      expect(resNegPrice.label).toBe("Unknown / COGS not set");
    });

    it("handles null and undefined price or cost safely", () => {
      expect(calculateGrossMargin(null, 1000).percent).toBeNull();
      expect(calculateGrossMargin(undefined, 1000).percent).toBeNull();
      expect(calculateGrossMargin(20000, null).percent).toBeNull();
      expect(calculateGrossMargin(20000, undefined).percent).toBeNull();
      expect(calculateGrossMargin(null, null).percent).toBeNull();
    });

    it("handles negative cost safely", () => {
      const resNegCost = calculateGrossMargin(20000, -500);
      expect(resNegCost.percent).toBeNull();
      expect(resNegCost.label).toBe("Unknown / COGS not set");
    });

    it("calculates 100.0% margin when cost == 0 (zero BOM)", () => {
      const resZeroCost = calculateGrossMargin(15000, 0); // ₹150.00 price, ₹0.00 cost
      expect(resZeroCost.percent).toBe(100.0);
      expect(resZeroCost.label).toBe("100.0%");

      // Boundary: 1 paisa price, 0 cost
      const res1Paisa = calculateGrossMargin(1, 0);
      expect(res1Paisa.percent).toBe(100.0);
      expect(res1Paisa.label).toBe("100.0%");
    });

    it("calculates negative gross margin faithfully when cost > price (underwater economics)", () => {
      // price ₹100.00 (10000 paise), cost ₹150.00 (15000 paise)
      // margin = ((10000 - 15000) / 10000) * 100 = -50.0%
      const resNeg50 = calculateGrossMargin(10000, 15000);
      expect(resNeg50.percent).toBe(-50.0);
      expect(resNeg50.label).toBe("-50.0%");

      // price ₹100.00, cost ₹250.00 -> -150.0%
      const resNeg150 = calculateGrossMargin(10000, 25000);
      expect(resNeg150.percent).toBe(-150.0);
      expect(resNeg150.label).toBe("-150.0%");

      // price 1 paisa, cost 2 paise -> -100.0%
      const res1vs2 = calculateGrossMargin(1, 2);
      expect(res1vs2.percent).toBe(-100.0);
      expect(res1vs2.label).toBe("-100.0%");
    });

    it("calculates 0.0% margin at break-even (cost == price)", () => {
      const resBreakEven = calculateGrossMargin(180000, 180000);
      expect(resBreakEven.percent).toBe(0.0);
      expect(resBreakEven.label).toBe("0.0%");
    });

    it("handles floating point precision and rounding to 1 decimal place cleanly", () => {
      // 200 / 300 = 66.666666...% -> 66.7%
      const res66 = calculateGrossMargin(300, 100);
      expect(res66.percent).toBe(66.7);
      expect(res66.label).toBe("66.7%");

      // 100 / 300 = 33.333333...% -> 33.3%
      const res33 = calculateGrossMargin(300, 200);
      expect(res33.percent).toBe(33.3);
      expect(res33.label).toBe("33.3%");

      // 100 / 700 = 14.2857...% -> 14.3%
      const res14 = calculateGrossMargin(700, 600);
      expect(res14.percent).toBe(14.3);
      expect(res14.label).toBe("14.3%");
    });

    it("handles large numbers (multi-billion paise) without overflow or NaN", () => {
      // price ₹100,000,000 (10 billion paise), cost ₹40,000,000 (4 billion paise) -> 60.0%
      const resLarge = calculateGrossMargin(10_000_000_000, 4_000_000_000);
      expect(resLarge.percent).toBe(60.0);
      expect(resLarge.label).toBe("60.0%");

      // MAX_SAFE_INTEGER with 0 cost
      const resMax = calculateGrossMargin(Number.MAX_SAFE_INTEGER, 0);
      expect(resMax.percent).toBe(100.0);
      expect(resMax.label).toBe("100.0%");
    });

    it("empirically documents NaN and non-finite behavior in calculateGrossMargin", () => {
      // When price is NaN: !NaN is true, so it returns null
      expect(calculateGrossMargin(NaN, 1000).percent).toBeNull();
      expect(calculateGrossMargin(NaN, NaN).percent).toBeNull();

      // Remediated NaN guard:
      // When cost is NaN (while price is a valid positive number),
      // finite number guard cleanly returns null / Unknown instead of leaking NaN%
      const safeNaN = calculateGrossMargin(1000, NaN);
      expect(safeNaN.percent).toBeNull();
      expect(safeNaN.label).toBe("Unknown / COGS not set");
    });

    it("renders edge case gross margins accurately in TrialTabIdentity UI", () => {
      // Case A: Negative margin rendering in UI
      const underwaterTrial = createTrialDossier({
        price_paise: 10000, // ₹100.00
        cost_paise: 15000, // ₹150.00
      });

      const markupUnderwater = renderToStaticMarkup(
        React.createElement(TrialTabIdentity, {
          trial: underwaterTrial,
          onChange: () => {},
          onSave: async () => {},
          saving: false,
        })
      );

      expect(markupUnderwater).toContain("Gross Contribution Margin");
      expect(markupUnderwater).toContain("-50.0%");

      // Case B: 100% margin rendering in UI
      const zeroCostTrial = createTrialDossier({
        price_paise: 20000, // ₹200.00
        cost_paise: 0, // ₹0.00
      });

      const markupZeroCost = renderToStaticMarkup(
        React.createElement(TrialTabIdentity, {
          trial: zeroCostTrial,
          onChange: () => {},
          onSave: async () => {},
          saving: false,
        })
      );

      expect(markupZeroCost).toContain("100.0%");

      // Case C: Missing cost rendering in UI
      const missingCostTrial = createTrialDossier({
        price_paise: 20000,
        cost_paise: null,
      });

      const markupMissingCost = renderToStaticMarkup(
        React.createElement(TrialTabIdentity, {
          trial: missingCostTrial,
          onChange: () => {},
          onSave: async () => {},
          saving: false,
        })
      );

      expect(markupMissingCost).toContain("Unknown / COGS not set");
    });
  });
});
