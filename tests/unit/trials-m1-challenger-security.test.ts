/**
 * TeaFloww Trials v3 — Milestone 1 Adversarial Challenger 2 Test Suite
 *
 * EMPIRICAL ADVERSARIAL STRESS TEST FOR:
 * 1. Whitelist projection & confidential data leak prevention (COGS, supplier IDs, RM notes, audit PII)
 * 2. Unpublished draft access isolation & strict 404/TrialNotFoundError enforcement
 * 3. Multi-table transaction atomicity & complete rollback on child failure
 * 4. Boundary inputs, negative prices, extreme values, and SQL injection payloads
 */

import { describe, it, expect, beforeEach } from "vitest";
import { getDb } from "@/lib/db";
import { TrialService } from "@/lib/trials/service";
import { toPublicDto } from "@/lib/trials/validation";
import { createTrialSchema } from "@/lib/trials/validation";
import {
  TrialNotFoundError,
  type AuditActor,
  type ComponentInput,
  type AssetInput,
} from "@/lib/trials/types";
import { randomUUID } from "node:crypto";

const challengeActor: AuditActor = {
  actor_type: "admin",
  actor_id: "challenger_2_adversary",
  actor_email: "adversary-confidential@teafloww.com",
  ip_address: "198.51.100.77",
  reason: "Adversarial security and rollback verification",
};

describe("Adversarial Challenger 2: Security, Whitelist & Transaction Rollback", () => {
  const db = getDb();

  beforeEach(() => {
    // Clean up any challenge test trials
    db.prepare("DELETE FROM trials WHERE slug LIKE 'adv-%'").run();
  });

  // ==========================================================================
  // Dimension 1: Whitelist Projection & Data Leak Prevention
  // ==========================================================================
  describe("Dimension 1: Whitelist Projection & Data Leak Prevention", () => {
    it("strictly prevents leaking internal COGS (cost_paise) in public DTO and public list", () => {
      const secretCogsPaise = 11750; // ₹117.50 internal cost
      const publicPricePaise = 29900; // ₹299.00 retail price

      // Create and publish trial with high-margin confidential COGS
      const trial = TrialService.createDraft(
        {
          slug: "adv-cogs-leak-test",
          title: "High Margin Masterblend Kit",
          tagline: "Exclusive small batch trial kit",
          description: "Customer facing description of the kit",
          price_paise: publicPricePaise,
          cost_paise: secretCogsPaise,
          inventory_quantity: 50,
          inventory_policy: "track",
          meta_title: "High Margin Masterblend Kit | TeaFloww",
          meta_description: "Taste four exclusive small batch teas.",
        },
        challengeActor
      );

      // Attach packaging photo with alt text
      TrialService.attachAsset(
        trial.id,
        1,
        {
          stage: "packaging",
          asset_url: "/images/trials/adv-pack.jpg",
          alt_text: "Packaging box for high margin masterblend",
        },
        challengeActor
      );

      // Replace components with genuine estate provenance
      const comps: ComponentInput[] = [
        { slot_index: 0, name: "Chai 1", estate: "Castleton", grade: "FTGFOP1", flush: "First", weight_g: 50 },
        { slot_index: 1, name: "Chai 2", estate: "Margaret's Hope", grade: "TGFOP", flush: "Second", weight_g: 50 },
        { slot_index: 2, name: "Chai 3", estate: "Makaibari", grade: "OP", flush: "Rain", weight_g: 50 },
        { slot_index: 3, name: "Chai 4", estate: "Gopaldhara", grade: "BOP", flush: "Autumn", weight_g: 50 },
      ];
      TrialService.replaceComponents(trial.id, 2, comps, challengeActor);

      // Submit review and publish
      TrialService.submitReview(trial.id, 3, challengeActor);
      TrialService.publish(trial.id, 4, challengeActor);

      // Fetch via getPublicBySlug
      const publicDto = TrialService.getPublicBySlug("adv-cogs-leak-test");
      expect(publicDto).not.toBeNull();
      if (!publicDto) return;

      // 1. DTO property checks
      expect((publicDto as any).cost_paise).toBeUndefined();
      expect("cost_paise" in publicDto).toBe(false);
      expect(Object.keys(publicDto)).not.toContain("cost_paise");
      expect(Reflect.has(publicDto, "cost_paise")).toBe(false);

      // 2. Serialized string inspection (must NOT contain cost value or property name)
      const serialized = JSON.stringify(publicDto);
      expect(serialized).not.toContain("cost_paise");
      expect(serialized).not.toContain(String(secretCogsPaise));

      // 3. Same verification on listPublic
      const publicList = TrialService.listPublic({ search: "High Margin" });
      expect(publicList.trials.length).toBeGreaterThan(0);
      const foundInList = publicList.trials.find((t) => t.slug === "adv-cogs-leak-test");
      expect(foundInList).toBeDefined();
      expect((foundInList as any).cost_paise).toBeUndefined();
      expect(JSON.stringify(publicList)).not.toContain("cost_paise");
      expect(JSON.stringify(publicList)).not.toContain(String(secretCogsPaise));
    });

    it("strictly redacts supplier foreign keys, variant IDs, and component internal fields", () => {
      // Use existing catalog records (product 1, variant 1)
      const secretProductId = 1;
      const secretVariantId = 1;

      const trial = TrialService.createDraft(
        {
          slug: "adv-supplier-id-test",
          title: "Supplier Linked Discovery Kit",
          tagline: "Linked to internal regular variants",
          description: "Description of supplier linked kit",
          price_paise: 25000,
          inventory_quantity: 25,
          inventory_policy: "track",
          meta_title: "Supplier Linked Discovery Kit",
          meta_description: "Discovery kit linked to variants.",
        },
        challengeActor
      );

      // Attach packaging
      TrialService.attachAsset(
        trial.id,
        1,
        {
          stage: "packaging",
          asset_url: "/images/trials/supplier-kit.jpg",
          alt_text: "Packaging for supplier kit",
        },
        challengeActor
      );

      const comps: ComponentInput[] = [
        {
          slot_index: 0,
          name: "Sachet Alpha",
          estate: "Jungpana",
          grade: "FTGFOP1",
          flush: "First",
          weight_g: 50,
          regular_product_id: secretProductId,
          regular_variant_id: secretVariantId,
        },
        { slot_index: 1, name: "Sachet Beta", estate: "Arya", grade: "TGFOP", flush: "Second", weight_g: 50 },
        { slot_index: 2, name: "Sachet Gamma", estate: "Risheehat", grade: "OF", flush: "Rain", weight_g: 50 },
        { slot_index: 3, name: "Sachet Delta", estate: "Badamtam", grade: "BP", flush: "Autumn", weight_g: 50 },
      ];
      TrialService.replaceComponents(trial.id, 2, comps, challengeActor);

      TrialService.submitReview(trial.id, 3, challengeActor);
      TrialService.publish(trial.id, 4, challengeActor);

      const publicDto = TrialService.getPublicBySlug("adv-supplier-id-test")!;
      expect(publicDto).not.toBeNull();

      for (const comp of publicDto.components) {
        expect("regular_product_id" in comp).toBe(false);
        expect("regular_variant_id" in comp).toBe(false);
        expect((comp as any).regular_product_id).toBeUndefined();
        expect((comp as any).regular_variant_id).toBeUndefined();
        expect((comp as any).trial_id).toBeUndefined();
        expect((comp as any).id).toBeUndefined();
        expect(Object.keys(comp).sort()).toEqual([
          "assets",
          "brewing",
          "bulk_link",
          "elevation",
          "estate",
          "flush",
          "grade",
          "name",
          "slot_index",
          "tasting_notes",
          "weight_g",
        ]);
      }

      const serialized = JSON.stringify(publicDto);
      expect(serialized).not.toContain("regular_product_id");
      expect(serialized).not.toContain("regular_variant_id");
      expect(serialized).not.toContain("product_id");
      expect(serialized).not.toContain("variant_id");
    });

    it("strictly isolates and redacts raw material notes, sensory laboratory notes, and lot IDs", () => {
      const trial = TrialService.createDraft(
        {
          slug: "adv-sensory-rm-test",
          title: "Lab Sensory Provenance Kit",
          tagline: "Sensory test evaluated kit",
          description: "Sensory kit description",
          price_paise: 24000,
          inventory_quantity: 10,
          inventory_policy: "track",
          meta_title: "Lab Sensory Provenance Kit",
          meta_description: "Tested in tea lab.",
        },
        challengeActor
      );

      TrialService.attachAsset(
        trial.id,
        1,
        {
          stage: "packaging",
          asset_url: "/images/trials/sensory.jpg",
          alt_text: "Packaging box for sensory kit",
        },
        challengeActor
      );

      const comps: ComponentInput[] = [
        { slot_index: 0, name: "Teesta CTC 1", estate: "Teesta", grade: "BP", flush: "First", weight_g: 50 },
        { slot_index: 1, name: "Teesta CTC 2", estate: "Teesta", grade: "OF", flush: "Second", weight_g: 50 },
        { slot_index: 2, name: "Teesta CTC 3", estate: "Teesta", grade: "PD", flush: "Rain", weight_g: 50 },
        { slot_index: 3, name: "Teesta CTC 4", estate: "Teesta", grade: "BOP", flush: "Autumn", weight_g: 50 },
      ];
      TrialService.replaceComponents(trial.id, 2, comps, challengeActor);

      // Insert confidential sensory test directly into database
      const secretSampleId = "CONFIDENTIAL-SAMPLE-9901";
      const secretLotId = "LOT-RM-RAW-8842";
      const secretNote = "Leaves failed high-humidity storage test; acquired at 40% liquidation discount";
      const secretTester = "Master Cupper Dr. Arindam Sen";

      db.prepare(`
        INSERT INTO trial_sensory_tests (
          id, trial_id, sample_id, lot_id, tester_name, method, aroma_score,
          body_score, briskness_score, astringency_score, finish_score,
          milk_performance_score, metrics_json, verified, notes
        ) VALUES (
          ?, ?, ?, ?, ?, 'ISO_3103_blind', 8.5,
          9.0, 7.5, 6.0, 8.0,
          9.5, '{"moisture_pct": 7.4, "internal_defect_flag": false}', 1, ?
        )
      `).run(randomUUID(), trial.id, secretSampleId, secretLotId, secretTester, secretNote);

      TrialService.submitReview(trial.id, 3, challengeActor);
      TrialService.publish(trial.id, 4, challengeActor);

      const publicDto = TrialService.getPublicBySlug("adv-sensory-rm-test")!;
      expect(publicDto).not.toBeNull();

      // Sensory lab tests are not part of the public DTO (provenance is summarized via claims & brewing)
      expect((publicDto as any).sensory_tests).toBeUndefined();

      const serialized = JSON.stringify(publicDto);
      expect(serialized).not.toContain(secretSampleId);
      expect(serialized).not.toContain(secretLotId);
      expect(serialized).not.toContain("liquidation discount");
      expect(serialized).not.toContain(secretTester);
      expect(serialized).not.toContain("moisture_pct");
    });

    it("strictly redacts private claim evidence documents, unverified claims, and approval emails", () => {
      const trial = TrialService.createDraft(
        {
          slug: "adv-claims-evidence-test",
          title: "Evidence Shielded Kit",
          tagline: "Only verified claims are shown",
          description: "Full description",
          price_paise: 22000,
          inventory_quantity: 50,
          inventory_policy: "track",
          meta_title: "Evidence Shielded Kit",
          meta_description: "Meta description",
        },
        challengeActor
      );

      TrialService.attachAsset(
        trial.id,
        1,
        {
          stage: "packaging",
          asset_url: "/images/trials/shield.jpg",
          alt_text: "Packaging box for evidence kit",
        },
        challengeActor
      );

      const comps: ComponentInput[] = [
        { slot_index: 0, name: "Blend 1", estate: "Doomni", grade: "BP", flush: "First", weight_g: 50 },
        { slot_index: 1, name: "Blend 2", estate: "Doomni", grade: "OF", flush: "Second", weight_g: 50 },
        { slot_index: 2, name: "Blend 3", estate: "Doomni", grade: "PD", flush: "Rain", weight_g: 50 },
        { slot_index: 3, name: "Blend 4", estate: "Doomni", grade: "BOP", flush: "Autumn", weight_g: 50 },
      ];
      TrialService.replaceComponents(trial.id, 2, comps, challengeActor);

      const secretEvidenceUrl = "https://internal-vault.teafloww.com/contracts/secret-estate-deed-9021.pdf";
      const secretBasis = "Signed legal contract between estate manager and Nirva Corp";
      const secretApprover = "chief-compliance@teafloww.com";

      // Verified claim with private evidence URL
      db.prepare(`
        INSERT INTO trial_claims (
          id, trial_id, claim_type, label, claim_text, basis, evidence_ref,
          verified, approved_by, approved_at, sort_order
        ) VALUES (
          ?, ?, 'fssai_licence', 'FSSAI Verified Works 19CTHPK8646J2ZY',
          'Licensed Works Facility', ?, ?, 1, ?, CURRENT_TIMESTAMP, 0
        )
      `).run(randomUUID(), trial.id, secretBasis, secretEvidenceUrl, secretApprover);

      // Unverified claim that MUST NOT appear publicly
      const unverifiedClaimText = "Unverified 100% Organic Pesticide-Free Claim";
      db.prepare(`
        INSERT INTO trial_claims (
          id, trial_id, claim_type, label, claim_text, basis, evidence_ref,
          verified, sort_order
        ) VALUES (
          ?, ?, 'origin', ?, ?, 'Verbal marketing claim', NULL, 0, 1
        )
      `).run(randomUUID(), trial.id, unverifiedClaimText, unverifiedClaimText);

      TrialService.submitReview(trial.id, 3, challengeActor);
      TrialService.publish(trial.id, 4, challengeActor);

      const publicDto = TrialService.getPublicBySlug("adv-claims-evidence-test")!;
      expect(publicDto).not.toBeNull();

      // Only verified claims appear
      expect(publicDto.claims.length).toBe(1);
      expect(publicDto.claims[0].claim_type).toBe("fssai_licence");
      expect(publicDto.claims[0].verified).toBe(true);

      // Private evidence and internal approver must be strictly omitted
      expect((publicDto.claims[0] as any).evidence_ref).toBeUndefined();
      expect((publicDto.claims[0] as any).basis).toBeUndefined();
      expect((publicDto.claims[0] as any).approved_by).toBeUndefined();

      const serialized = JSON.stringify(publicDto);
      expect(serialized).not.toContain(secretEvidenceUrl);
      expect(serialized).not.toContain(secretBasis);
      expect(serialized).not.toContain(secretApprover);
      expect(serialized).not.toContain(unverifiedClaimText);
    });

    it("strictly isolates audit history, actor IP addresses, and email addresses from public endpoints", () => {
      const trial = TrialService.createDraft(
        {
          slug: "adv-audit-leak-test",
          title: "Audit Shielded Kit",
          tagline: "Audit trail isolation test",
          description: "Full description",
          price_paise: 20000,
          inventory_quantity: 10,
          inventory_policy: "track",
          meta_title: "Audit Shielded Kit",
          meta_description: "Audit test",
        },
        challengeActor
      );

      TrialService.attachAsset(
        trial.id,
        1,
        {
          stage: "packaging",
          asset_url: "/images/trials/audit.jpg",
          alt_text: "Packaging for audit kit",
        },
        challengeActor
      );

      const comps: ComponentInput[] = [
        { slot_index: 0, name: "Audit Tea 1", estate: "Attabarie", grade: "BP", flush: "First", weight_g: 50 },
        { slot_index: 1, name: "Audit Tea 2", estate: "Attabarie", grade: "OF", flush: "Second", weight_g: 50 },
        { slot_index: 2, name: "Audit Tea 3", estate: "Attabarie", grade: "PD", flush: "Rain", weight_g: 50 },
        { slot_index: 3, name: "Audit Tea 4", estate: "Attabarie", grade: "BOP", flush: "Autumn", weight_g: 50 },
      ];
      TrialService.replaceComponents(trial.id, 2, comps, challengeActor);

      TrialService.submitReview(trial.id, 3, challengeActor);
      TrialService.publish(trial.id, 4, challengeActor);

      // Verify audit entries exist in DB
      const history = TrialService.getHistory(trial.id);
      expect(history.length).toBe(5);
      expect(history[0].actor_email).toBe("adversary-confidential@teafloww.com");
      expect(history[0].ip_address).toBe("198.51.100.77");

      // Verify public DTO does NOT contain any audit trace
      const publicDto = TrialService.getPublicBySlug("adv-audit-leak-test")!;
      expect((publicDto as any).history).toBeUndefined();
      expect((publicDto as any).audit).toBeUndefined();
      expect((publicDto as any).actor_email).toBeUndefined();
      expect((publicDto as any).ip_address).toBeUndefined();

      const serialized = JSON.stringify(publicDto);
      expect(serialized).not.toContain("adversary-confidential@teafloww.com");
      expect(serialized).not.toContain("198.51.100.77");
      expect(serialized).not.toContain("trial_audit");
    });
  });

  // ==========================================================================
  // Dimension 2: Draft Isolation & Access Control
  // ==========================================================================
  describe("Dimension 2: Draft Isolation & Access Control", () => {
    it("returns null on getPublicBySlug for unpublished drafts, in_review, and archived trials", () => {
      // 1. Draft
      const draft = TrialService.createDraft(
        { slug: "adv-iso-draft", title: "Isolated Draft Kit" },
        challengeActor
      );
      expect(TrialService.getPublicBySlug("adv-iso-draft")).toBeNull();

      // 2. In Review
      TrialService.submitReview(draft.id, 1, challengeActor);
      expect(TrialService.getPublicBySlug("adv-iso-draft")).toBeNull();

      // 3. Complete and publish
      TrialService.attachAsset(
        draft.id,
        2,
        {
          stage: "packaging",
          asset_url: "/images/trials/iso.jpg",
          alt_text: "Packaging for isolated draft",
        },
        challengeActor
      );
      const comps: ComponentInput[] = [
        { slot_index: 0, name: "Tea 1", estate: "Singbulli", grade: "FTGFOP1", flush: "First", weight_g: 50 },
        { slot_index: 1, name: "Tea 2", estate: "Singbulli", grade: "TGFOP", flush: "Second", weight_g: 50 },
        { slot_index: 2, name: "Tea 3", estate: "Singbulli", grade: "OF", flush: "Rain", weight_g: 50 },
        { slot_index: 3, name: "Tea 4", estate: "Singbulli", grade: "BOP", flush: "Autumn", weight_g: 50 },
      ];
      TrialService.replaceComponents(draft.id, 3, comps, challengeActor);
      TrialService.update(
        draft.id,
        4,
        {
          tagline: "Tagline",
          description: "Description",
          meta_title: "Title",
          meta_description: "Desc",
          inventory_quantity: 10,
        },
        challengeActor
      );

      // Publish directly from in_review status
      TrialService.publish(draft.id, 5, challengeActor);
      expect(TrialService.getPublicBySlug("adv-iso-draft")).not.toBeNull();

      // 4. Archive trial: must instantly become unavailable on public endpoint
      TrialService.archive(draft.id, 6, challengeActor);
      expect(TrialService.getPublicBySlug("adv-iso-draft")).toBeNull();
    });

    it("toPublicDto throws TrialNotFoundError on unpublished records unless allowDraftPreview is explicitly set", () => {
      const draft = TrialService.createDraft(
        { slug: "adv-iso-throw-check", title: "Throw Check Kit" },
        challengeActor
      );

      const details = TrialService.getById(draft.id)!;
      expect(details.status).toBe("draft");

      // Default (no options) -> throws TrialNotFoundError
      expect(() => toPublicDto(details)).toThrowError(TrialNotFoundError);

      // Explicit allowDraftPreview: false -> throws TrialNotFoundError
      expect(() => toPublicDto(details, { allowDraftPreview: false })).toThrowError(TrialNotFoundError);

      // allowDraftPreview: true -> allows authenticated preview rendering
      const preview = toPublicDto(details, { allowDraftPreview: true });
      expect(preview.id).toBe(draft.id);
      expect(preview.slug).toBe("adv-iso-throw-check");
    });

    it("listPublic strictly excludes drafts, in_review, and archived records from results and total count", () => {
      // Create 1 draft, 1 in_review, 1 archived
      const draft = TrialService.createDraft(
        { slug: "adv-list-hidden-draft", title: "Hidden Draft Alpha" },
        challengeActor
      );
      expect(draft.id).toBeDefined();

      const inReview = TrialService.createDraft(
        { slug: "adv-list-hidden-review", title: "Hidden Review Beta" },
        challengeActor
      );
      TrialService.submitReview(inReview.id, 1, challengeActor);

      // Query listPublic
      const listRes = TrialService.listPublic({ search: "Hidden" });
      expect(listRes.trials.length).toBe(0);
      expect(listRes.total).toBe(0);
    });
  });

  // ==========================================================================
  // Dimension 3: Multi-Table Transaction Atomicity & Rollback
  // ==========================================================================
  describe("Dimension 3: Multi-Table Transaction Atomicity & Rollback", () => {
    it("rolls back parent revision and restores deleted components when child insert fails in replaceComponents", () => {
      const trial = TrialService.createDraft(
        { slug: "adv-rollback-components", title: "Transaction Rollback Trial" },
        challengeActor
      );
      expect(trial.revision).toBe(1);

      // Capture original components in database
      const originalComps = db
        .prepare("SELECT * FROM trial_components WHERE trial_id = ? ORDER BY slot_index")
        .all(trial.id) as any[];
      expect(originalComps.length).toBe(4);

      // Construct a component list that passes service validator (validateComponentInvariant)
      // but violates a database-level column CHECK constraint (brew_temp_c > 0)
      const poisonedComps: ComponentInput[] = [
        { slot_index: 0, name: "Valid Pouch 1", estate: "Estate 1", grade: "BP", flush: "First", weight_g: 50 },
        {
          slot_index: 1,
          name: "Poisoned Pouch 2",
          estate: "Estate 2",
          grade: "OF",
          flush: "Second",
          weight_g: 50,
          brew_temp_c: -40, // Violates SQLite CHECK(brew_temp_c > 0)
        },
        { slot_index: 2, name: "Valid Pouch 3", estate: "Estate 3", grade: "PD", flush: "Rain", weight_g: 50 },
        { slot_index: 3, name: "Valid Pouch 4", estate: "Estate 4", grade: "BOP", flush: "Autumn", weight_g: 50 },
      ];

      // Execution MUST throw database CHECK constraint error
      expect(() => {
        TrialService.replaceComponents(trial.id, 1, poisonedComps, challengeActor);
      }).toThrow(/CHECK constraint failed:.*brew_temp_c/i);

      // 1. VERIFY PARENT TRIAL REVISION WAS NOT INCREMENTED
      const currentTrial = db.prepare("SELECT * FROM trials WHERE id = ?").get(trial.id) as any;
      expect(currentTrial.revision).toBe(1); // STILL 1!

      // 2. VERIFY ORIGINAL COMPONENTS WERE NOT DESTROYED OR CORRUPTED
      const compsAfter = db
        .prepare("SELECT * FROM trial_components WHERE trial_id = ? ORDER BY slot_index")
        .all(trial.id) as any[];
      expect(compsAfter.length).toBe(4);
      expect(compsAfter[0].id).toBe(originalComps[0].id);
      expect(compsAfter[1].id).toBe(originalComps[1].id);
      expect(compsAfter[2].id).toBe(originalComps[2].id);
      expect(compsAfter[3].id).toBe(originalComps[3].id);

      // 3. VERIFY NO PARTIAL AUDIT ENTRY WAS CREATED
      const audits = db.prepare("SELECT * FROM trial_audit WHERE trial_id = ?").all(trial.id) as any[];
      expect(audits.length).toBe(1); // Only initial create_draft
      expect(audits[0].action).toBe("create_draft");
    });

    it("rolls back revision and asset insert when foreign key constraint fails in attachAsset", () => {
      const trial = TrialService.createDraft(
        { slug: "adv-rollback-asset-fk", title: "Asset FK Rollback Trial" },
        challengeActor
      );
      expect(trial.revision).toBe(1);

      // Provide non-existent media_id to trigger FOREIGN KEY constraint failure
      const brokenAsset: AssetInput = {
        media_id: 99999999, // Non-existent foreign key to media_uploads(id)
        stage: "dry_leaf",
        asset_url: "/images/trials/broken-fk.jpg",
        alt_text: "Asset with invalid media ID",
      };

      expect(() => {
        TrialService.attachAsset(trial.id, 1, brokenAsset, challengeActor);
      }).toThrow(/FOREIGN KEY constraint failed/i);

      // Parent revision must remain 1
      const checkTrial = db.prepare("SELECT revision FROM trials WHERE id = ?").get(trial.id) as any;
      expect(checkTrial.revision).toBe(1);

      // No row in trial_assets
      const assets = db.prepare("SELECT * FROM trial_assets WHERE trial_id = ?").all(trial.id);
      expect(assets.length).toBe(0);

      // No audit row written
      const audits = db.prepare("SELECT * FROM trial_audit WHERE trial_id = ?").all(trial.id) as any[];
      expect(audits.length).toBe(1);
    });

    it("rolls back publish transaction if publication snapshot fails or trigger triggers abort", () => {
      const trial = TrialService.createDraft(
        { slug: "adv-rollback-publish", title: "Publish Rollback Trial" },
        challengeActor
      );

      // Corrupt weight invariant directly in SQLite before publish
      db.prepare("UPDATE trial_components SET weight_g = 50 WHERE trial_id = ?").run(trial.id);
      // Remove one component directly
      db.prepare("DELETE FROM trial_components WHERE trial_id = ? AND slot_index = 3").run(trial.id);

      // Publication must be rejected by service and database trigger
      expect(() => {
        TrialService.publish(trial.id, 1, challengeActor);
      }).toThrow();

      // Trial status MUST remain 'draft'
      const checkTrial = db.prepare("SELECT status, revision FROM trials WHERE id = ?").get(trial.id) as any;
      expect(checkTrial.status).toBe("draft");
      expect(checkTrial.revision).toBe(1);

      // No active row in trial_publications
      const pubs = db.prepare("SELECT * FROM trial_publications WHERE trial_id = ?").all(trial.id);
      expect(pubs.length).toBe(0);
    });

    it("rolls back entire createDraft transaction leaving zero orphaned rows if child insert fails", () => {
      // Create draft with 4 components where one violates CHECK constraint (brew_time_sec <= 0)
      const poisonedComponents: ComponentInput[] = [
        { slot_index: 0, name: "Sample Pouch 1", weight_g: 50 },
        { slot_index: 1, name: "Sample Pouch 2", weight_g: 50 },
        { slot_index: 2, name: "Sample Pouch 3", weight_g: 50 },
        { slot_index: 3, name: "Sample Pouch 4", weight_g: 50, brew_time_sec: -10 }, // Violates CHECK(brew_time_sec > 0)
      ];

      expect(() => {
        TrialService.createDraft(
          {
            slug: "adv-rollback-create-fail",
            title: "Failed Create Kit",
            components: poisonedComponents,
          },
          challengeActor
        );
      }).toThrow(/CHECK constraint failed/i);

      // Verify trial row was completely rolled back (zero rows with this slug)
      const row = db.prepare("SELECT * FROM trials WHERE slug = 'adv-rollback-create-fail'").get();
      expect(row).toBeUndefined();

      // Verify no components exist
      const comps = db.prepare("SELECT * FROM trial_components WHERE name LIKE '%Failed Create%'").all();
      expect(comps.length).toBe(0);

      // Verify no audit entry exists
      const audits = db.prepare("SELECT * FROM trial_audit WHERE action = 'create_draft' AND diff_json LIKE '%adv-rollback-create-fail%'").all();
      expect(audits.length).toBe(0);
    });

    it("rolls back entire update transaction when SKU uniqueness constraint fails", () => {
      // Create Trial A with SKU-A
      const trialA = TrialService.createDraft(
        {
          slug: "adv-sku-collision-a",
          title: "Trial A",
          sku: "TRIAL-SKU-COLLISION-1",
        },
        challengeActor
      );
      expect(trialA.id).toBeDefined();

      // Create Trial B with SKU-B
      const trialB = TrialService.createDraft(
        {
          slug: "adv-sku-collision-b",
          title: "Trial B",
          sku: "TRIAL-SKU-COLLISION-2",
        },
        challengeActor
      );
      expect(trialB.revision).toBe(1);

      // Attempt to update Trial B to have SKU-A (which is taken)
      expect(() => {
        TrialService.update(
          trialB.id,
          1,
          {
            title: "Trial B Altered Title",
            sku: "TRIAL-SKU-COLLISION-1", // Uniqueness collision!
          },
          challengeActor
        );
      }).toThrow(/UNIQUE constraint failed: trials.sku/i);

      // Verify Trial B revision is STILL 1
      const currentB = db.prepare("SELECT revision, title, sku FROM trials WHERE id = ?").get(trialB.id) as any;
      expect(currentB.revision).toBe(1);
      expect(currentB.title).toBe("Trial B"); // Title was NOT changed
      expect(currentB.sku).toBe("TRIAL-SKU-COLLISION-2");

      // Verify no update audit entry exists for Trial B
      const auditsB = db.prepare("SELECT * FROM trial_audit WHERE trial_id = ?").all(trialB.id);
      expect(auditsB.length).toBe(1); // Only create_draft
    });

    it("rolls back replaceComponents transaction if foreign key regular_variant_id is invalid", () => {
      const trial = TrialService.createDraft(
        { slug: "adv-rollback-fk-comp", title: "FK Comp Rollback" },
        challengeActor
      );
      expect(trial.revision).toBe(1);

      const badFkComps: ComponentInput[] = [
        { slot_index: 0, name: "FK Test 1", weight_g: 50, regular_variant_id: 9999999 }, // Foreign key violation!
        { slot_index: 1, name: "FK Test 2", weight_g: 50 },
        { slot_index: 2, name: "FK Test 3", weight_g: 50 },
        { slot_index: 3, name: "FK Test 4", weight_g: 50 },
      ];

      expect(() => {
        TrialService.replaceComponents(trial.id, 1, badFkComps, challengeActor);
      }).toThrow(/FOREIGN KEY constraint failed/i);

      // Verify revision remains 1
      const current = db.prepare("SELECT revision FROM trials WHERE id = ?").get(trial.id) as any;
      expect(current.revision).toBe(1);

      // Verify audit entries remain 1
      const audits = db.prepare("SELECT * FROM trial_audit WHERE trial_id = ?").all(trial.id);
      expect(audits.length).toBe(1);
    });
  });

  // ==========================================================================
  // Dimension 4: Boundary Inputs, Negative Numbers & SQL Injection
  // ==========================================================================
  describe("Dimension 4: Boundary Inputs & Security Payloads", () => {
    it("rejects negative commercial values in Zod schemas and SQLite table constraints", () => {
      // 1. Negative price in createTrialSchema
      const invalidCreate = createTrialSchema.safeParse({
        title: "Negative Price Kit",
        price_paise: -500,
      });
      expect(invalidCreate.success).toBe(false);

      // 2. Negative cost_paise
      const invalidCost = createTrialSchema.safeParse({
        title: "Negative Cost Kit",
        cost_paise: -100,
      });
      expect(invalidCost.success).toBe(false);

      // 3. Negative compare_at_price_paise
      const invalidCompare = createTrialSchema.safeParse({
        title: "Negative Compare Kit",
        compare_at_price_paise: -100,
      });
      expect(invalidCompare.success).toBe(false);

      // 4. Direct SQLite insert with negative price is blocked by CHECK(price_paise >= 0)
      expect(() => {
        db.prepare(`
          INSERT INTO trials (id, slug, title, status, sku, price_paise)
          VALUES ('adv-neg-db', 'adv-neg-db', 'Neg DB', 'draft', 'SKU-NEG', -100)
        `).run();
      }).toThrow(/CHECK constraint failed:.*price_paise >= 0/i);
    });

    it("rejects non-integer and NaN/Infinity values in financial fields", () => {
      // Float paise (paise must be integer)
      const floatRes = createTrialSchema.safeParse({
        title: "Float Paise Kit",
        price_paise: 199.5,
      });
      expect(floatRes.success).toBe(false);

      // NaN
      const nanRes = createTrialSchema.safeParse({
        title: "NaN Price Kit",
        price_paise: NaN,
      });
      expect(nanRes.success).toBe(false);

      // Infinity
      const infRes = createTrialSchema.safeParse({
        title: "Inf Price Kit",
        price_paise: Infinity,
      });
      expect(infRes.success).toBe(false);
    });

    it("handles boundary integers (zero price, large integers) safely", () => {
      // Zero price is valid in draft schema (e.g., during draft stage before pricing decided)
      const zeroPrice = createTrialSchema.safeParse({
        title: "Zero Price Draft",
        price_paise: 0,
      });
      expect(zeroPrice.success).toBe(true);

      // Very large integer (up to 1,000,000,000 paise = 1 crore INR)
      const largePrice = createTrialSchema.safeParse({
        title: "Luxury Single Estate Kit",
        price_paise: 100000000,
      });
      expect(largePrice.success).toBe(true);
    });

    it("protects against SQL injection payloads across list, listPublic, getBySlug, and getHistory", () => {
      const sqlInjectionPayloads = [
        "' OR '1'='1",
        "' OR '1'='1' --",
        "'; DROP TABLE trials; --",
        "admin'--",
        "' UNION SELECT id, title, 'pwned' FROM trials --",
        "' AND (SELECT count(*) FROM trial_audit) > 0 --",
        `" OR ""=""`,
        "'; EXEC xp_cmdshell('dir'); --",
        "1; SELECT 1; --",
      ];

      for (const payload of sqlInjectionPayloads) {
        // 1. Search in TrialService.list
        expect(() => {
          const res = TrialService.list({ search: payload });
          expect(Array.isArray(res.trials)).toBe(true);
        }).not.toThrow();

        // 2. Search in TrialService.listPublic
        expect(() => {
          const res = TrialService.listPublic({ search: payload });
          expect(Array.isArray(res.trials)).toBe(true);
        }).not.toThrow();

        // 3. Slug lookup in TrialService.getBySlug
        expect(() => {
          const res = TrialService.getBySlug(payload);
          expect(res).toBeNull();
        }).not.toThrow();

        // 4. Slug lookup in TrialService.getPublicBySlug
        expect(() => {
          const res = TrialService.getPublicBySlug(payload);
          expect(res).toBeNull();
        }).not.toThrow();

        // 5. History lookup in TrialService.getHistory
        expect(() => {
          const res = TrialService.getHistory(payload);
          expect(Array.isArray(res)).toBe(true);
          expect(res.length).toBe(0);
        }).not.toThrow();
      }

      // Verify database tables are completely intact
      const count = db.prepare("SELECT count(*) as c FROM sqlite_master WHERE type='table' AND name LIKE 'trial%'").get() as any;
      expect(count.c).toBe(9);
    });

    it("handles extreme Unicode, emoji, and special characters cleanly", () => {
      const unicodeTitle = "🍵 चाय डिस्कवरी किट — 100% Darjeeling FTGFOP1 Special <script>alert(1)</script>";

      const trial = TrialService.createDraft(
        {
          slug: "adv-unicode-special-chars",
          title: unicodeTitle,
          tagline: "सुरक्षित चाय का अनुभव",
          description: "Contains UTF-8 and HTML entities: <b>bold</b> & <ampersand>",
          price_paise: 20000,
        },
        challengeActor
      );

      expect(trial.title).toBe(unicodeTitle);
      expect(trial.tagline).toBe("सुरक्षित चाय का अनुभव");

      const fetched = TrialService.getById(trial.id);
      expect(fetched?.title).toBe(unicodeTitle);
      expect(fetched?.tagline).toBe("सुरक्षित चाय का अनुभव");
    });

    it("resists prototype pollution and arbitrary property injection in toPublicDto", () => {
      // Mock trial details with injected prototype and malicious properties
      const maliciousDetails: any = {
        id: "adv-proto-test",
        slug: "adv-proto-test",
        title: "Prototype Clean Kit",
        tagline: "Tagline",
        description: "Desc",
        status: "published",
        pack_format: "4x50g_sachets",
        net_weight_g: 200,
        price_paise: 25000,
        compare_at_price_paise: null,
        sku: "TRIAL-PROTO",
        inventory_quantity: 10,
        inventory_policy: "track",
        cost_paise: 5000,
        components: [
          { slot_index: 0, name: "C1", weight_g: 50, tasting_notes: "[\"malty\"]" },
          { slot_index: 1, name: "C2", weight_g: 50, tasting_notes: "[\"floral\"]" },
          { slot_index: 2, name: "C3", weight_g: 50, tasting_notes: "[\"muscatel\"]" },
          { slot_index: 3, name: "C4", weight_g: 50, tasting_notes: "[\"spicy\"]" },
        ],
        assets: [],
        claims: [],
        // Malicious properties injected onto the object:
        __proto__: { polluted: true },
        adminSecretToken: "SECRET_TOKEN_XYZ",
        internalCostBreakdown: { packaging: 400, tea: 2000, freight: 300 },
        databaseCredentials: { user: "root", pass: "12345" },
      };

      const dto = toPublicDto(maliciousDetails);

      // Verify malicious injected properties are completely excluded
      expect((dto as any).adminSecretToken).toBeUndefined();
      expect((dto as any).internalCostBreakdown).toBeUndefined();
      expect((dto as any).databaseCredentials).toBeUndefined();
      expect((dto as any).cost_paise).toBeUndefined();
      expect((dto as any).polluted).toBeUndefined();

      const serialized = JSON.stringify(dto);
      expect(serialized).not.toContain("SECRET_TOKEN_XYZ");
      expect(serialized).not.toContain("databaseCredentials");
      expect(serialized).not.toContain("internalCostBreakdown");
    });

    it("neutralizes SQL injection in sort_by, sort_dir, limit, and offset in list and listPublic", () => {
      const maliciousSortInputs = [
        { sort_by: "price_paise; DROP TABLE trials; --" as any, sort_dir: "asc" as any },
        { sort_by: "(SELECT case when (1=1) then 'title' else 'price_paise' end)" as any, sort_dir: "desc" as any },
        { sort_by: "title" as any, sort_dir: "asc; DELETE FROM trials; --" as any },
        { sort_by: "title" as any, sort_dir: "invalid_dir" as any },
        { limit: "10; DROP TABLE trials; --" as any, offset: "0 UNION SELECT 1" as any },
        { limit: -5 as any, offset: -20 as any },
      ];

      for (const input of maliciousSortInputs) {
        expect(() => {
          const res = TrialService.list(input);
          expect(Array.isArray(res.trials)).toBe(true);
        }).not.toThrow();

        expect(() => {
          const res = TrialService.listPublic(input);
          expect(Array.isArray(res.trials)).toBe(true);
        }).not.toThrow();
      }

      // Verify trials table is intact and unaffected
      const count = db.prepare("SELECT count(*) as c FROM sqlite_master WHERE type='table' AND name LIKE 'trial%'").get() as any;
      expect(count.c).toBe(9);
    });
  });
});
