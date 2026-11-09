/**
 * TeaFloww Trials v3 — Milestone 1 Domain Unit Tests
 *
 * Verifies:
 * 1. Migration 035 applied cleanly (9 normalized tables, triggers, indexes, cascades)
 * 2. 4x50g component invariant check (passes on 4x50g=200g, rejects any other count or weight)
 * 3. CAS optimistic concurrency control (stale update throws TrialRevisionConflictError)
 * 4. Atomic transaction rollback (failed operation rolls back completely)
 * 5. Atomic audit logging (mutation generates matching row in trial_audit with incremented revision)
 * 6. Whitelist public projection (strictly redacts COGS, supplier info, and unpublished trials)
 * 7. Publication blocker engine (blocks when missing required data, passes when complete)
 * 8. Development seed data (seedTrials idempotency)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { getDb } from "@/lib/db";
import { TrialService } from "@/lib/trials/service";
import {
  validateComponentInvariant,
  validatePublication,
  toPublicDto,
} from "@/lib/trials/validation";
import { seedTrials } from "@/lib/trials/seed";
import {
  TrialRevisionConflictError,
  TrialNotFoundError,
  TrialPublishGateError,
  TrialWeightInvariantError,
  TrialInvalidStateTransitionError,
  type AuditActor,
  type ComponentInput,
  type AssetInput,
} from "@/lib/trials/types";

const testActor: AuditActor = {
  actor_type: "admin",
  actor_id: "admin_tester",
  actor_email: "tester@teafloww.com",
  ip_address: "127.0.0.1",
  reason: "Automated unit test execution",
};

describe("TeaFloww Trials v3 — Milestone 1 Domain Foundation", () => {
  const db = getDb();

  // Clean up any test-created trial records before each test
  beforeEach(() => {
    db.prepare("DELETE FROM trials WHERE slug LIKE 'test-%'").run();
  });

  // ==========================================================================
  // 1. Migration 035 Clean Application & Schema Verification
  // ==========================================================================
  describe("1. Database Schema & Migration 035", () => {
    it("creates all 9 normalized tables", () => {
      const rows = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'trial%'")
        .all() as { name: string }[];
      const tableNames = rows.map((r) => r.name).sort();

      const expectedTables = [
        "trial_assets",
        "trial_audit",
        "trial_brew_guides",
        "trial_bulk_links",
        "trial_claims",
        "trial_components",
        "trial_publications",
        "trial_sensory_tests",
        "trials",
      ];

      for (const expected of expectedTables) {
        expect(tableNames).toContain(expected);
      }
    });

    it("creates publication and insertion guard triggers", () => {
      const triggers = db
        .prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE 'trg_trials_%'")
        .all() as { name: string }[];
      const triggerNames = triggers.map((t) => t.name);

      expect(triggerNames).toContain("trg_trials_publish_weight_check");
      expect(triggerNames).toContain("trg_trials_publish_insert_guard");
    });

    it("enforces ON DELETE CASCADE from trials to trial_components and trial_audit", () => {
      const trial = TrialService.createDraft(
        {
          slug: "test-cascade-deletion",
          title: "Test Cascade Deletion Kit",
          price_paise: 20000,
        },
        testActor
      );

      const compCountBefore = (
        db.prepare("SELECT count(*) as c FROM trial_components WHERE trial_id = ?").get(trial.id) as { c: number }
      ).c;
      expect(compCountBefore).toBe(4);

      const auditCountBefore = (
        db.prepare("SELECT count(*) as c FROM trial_audit WHERE trial_id = ?").get(trial.id) as { c: number }
      ).c;
      expect(auditCountBefore).toBeGreaterThanOrEqual(1);

      // Delete trial directly from db
      db.prepare("DELETE FROM trials WHERE id = ?").run(trial.id);

      const compCountAfter = (
        db.prepare("SELECT count(*) as c FROM trial_components WHERE trial_id = ?").get(trial.id) as { c: number }
      ).c;
      expect(compCountAfter).toBe(0);

      const auditCountAfter = (
        db.prepare("SELECT count(*) as c FROM trial_audit WHERE trial_id = ?").get(trial.id) as { c: number }
      ).c;
      expect(auditCountAfter).toBe(0);
    });

    it("direct insert with status='published' is blocked by database trigger", () => {
      expect(() => {
        db.prepare(`
          INSERT INTO trials (id, slug, title, status, sku, price_paise)
          VALUES ('direct-pub-test', 'test-direct-pub', 'Direct Pub', 'published', 'SKU-PUB-TEST', 20000)
        `).run();
      }).toThrow(/Cannot insert trial directly as published: must start as draft/);
    });
  });

  // ==========================================================================
  // 2. 4x50g Component Invariant Engine
  // ==========================================================================
  describe("2. 4x50g Component Invariant Engine", () => {
    const validComponents: ComponentInput[] = [
      { slot_index: 0, name: "Moran CTC BP", estate: "Moran", grade: "BP", flush: "First", weight_g: 50, quantity: 1 },
      { slot_index: 1, name: "Batabari CTC OF", estate: "Batabari", grade: "OF", flush: "Second", weight_g: 50, quantity: 1 },
      { slot_index: 2, name: "Sonitpur CTC PD", estate: "Sonitpur", grade: "PD", flush: "Rain", weight_g: 50, quantity: 1 },
      { slot_index: 3, name: "Cinnamara CTC BOP", estate: "Cinnamara", grade: "BOP", flush: "Autumn", weight_g: 50, quantity: 1 },
    ];

    it("passes validation on genuine 4x50g=200g kit", () => {
      const result = validateComponentInvariant(validComponents);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.totalWeight).toBe(200);
      expect(result.count).toBe(4);
    });

    it("rejects when component count is not exactly 4", () => {
      // 3 components
      const threeComps = validComponents.slice(0, 3);
      const resThree = validateComponentInvariant(threeComps);
      expect(resThree.valid).toBe(false);
      expect(resThree.errors.some((e) => e.includes("must contain exactly 4 sachets"))).toBe(true);

      // 5 components
      const fiveComps = [
        ...validComponents,
        { slot_index: 0, name: "Extra Pouch", estate: "Extra", grade: "BP", flush: "First", weight_g: 50, quantity: 1 },
      ];
      const resFive = validateComponentInvariant(fiveComps);
      expect(resFive.valid).toBe(false);
      expect(resFive.errors.some((e) => e.includes("must contain exactly 4 sachets"))).toBe(true);
    });

    it("rejects when any sachet weight is not 50g", () => {
      const invalidWeight = validComponents.map((c, i) =>
        i === 0 ? { ...c, weight_g: 60 } : i === 1 ? { ...c, weight_g: 40 } : c
      );
      const res = validateComponentInvariant(invalidWeight);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes("must be exactly 50g"))).toBe(true);
    });

    it("rejects when sum of weights does not equal 200g", () => {
      const underweight = validComponents.map((c) => ({ ...c, weight_g: 45 }));
      const res = validateComponentInvariant(underweight);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes("Total kit weight must be exactly 200g"))).toBe(true);
      expect(res.totalWeight).toBe(180);
    });

    it("rejects duplicate or out-of-range slot indexes", () => {
      const dupSlots = [
        { ...validComponents[0], slot_index: 0 },
        { ...validComponents[1], slot_index: 0 }, // Duplicate slot 0
        { ...validComponents[2], slot_index: 2 },
        { ...validComponents[3], slot_index: 3 },
      ];
      const res = validateComponentInvariant(dupSlots);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes("Duplicate slot_index 0"))).toBe(true);
    });

    it("TrialService.replaceComponents throws TrialWeightInvariantError on invalid input", () => {
      const trial = TrialService.createDraft(
        { slug: "test-invariant-replace", title: "Test Invariant Kit" },
        testActor
      );

      const invalidComps = [
        { slot_index: 0, name: "Tea 1", estate: "A", weight_g: 60 },
        { slot_index: 1, name: "Tea 2", estate: "B", weight_g: 60 },
        { slot_index: 2, name: "Tea 3", estate: "C", weight_g: 40 },
        { slot_index: 3, name: "Tea 4", estate: "D", weight_g: 40 },
      ];

      expect(() => {
        TrialService.replaceComponents(trial.id, 1, invalidComps as any, testActor);
      }).toThrowError(TrialWeightInvariantError);
    });
  });

  // ==========================================================================
  // 3. CAS Optimistic Concurrency Control
  // ==========================================================================
  describe("3. CAS Optimistic Concurrency Control", () => {
    it("creates draft with revision 1, increments on update, and traps stale writes", () => {
      const trial = TrialService.createDraft(
        {
          slug: "test-cas-concurrency",
          title: "Initial Draft Title",
          price_paise: 20000,
        },
        testActor
      );

      expect(trial.revision).toBe(1);

      // First update with expected_revision = 1 -> succeeds, returns revision 2
      const updated1 = TrialService.update(
        trial.id,
        1,
        { title: "Revision 2 Title", price_paise: 22000 },
        testActor
      );

      expect(updated1.revision).toBe(2);
      expect(updated1.title).toBe("Revision 2 Title");
      expect(updated1.price_paise).toBe(22000);

      // Concurrent/Stale update with expected_revision = 1 -> throws TrialRevisionConflictError
      expect(() => {
        TrialService.update(
          trial.id,
          1,
          { title: "Stale Override Attempt" },
          { ...testActor, actor_type: "mcp", actor_id: "mcp_client_1" }
        );
      }).toThrowError(TrialRevisionConflictError);

      try {
        TrialService.update(
          trial.id,
          1,
          { title: "Stale Override Attempt" },
          testActor
        );
      } catch (err: any) {
        expect(err).toBeInstanceOf(TrialRevisionConflictError);
        expect(err.current_revision).toBe(2);
        expect(err.expected_revision).toBe(1);
        expect(err.status).toBe(409);
        expect(err.mcpCode).toBe(-32009);
      }

      // Valid update with expected_revision = 2 -> succeeds, returns revision 3
      const updated2 = TrialService.update(
        trial.id,
        2,
        { title: "Revision 3 Title" },
        testActor
      );
      expect(updated2.revision).toBe(3);
    });

    it("replaceComponents enforces parent CAS revision check", () => {
      const trial = TrialService.createDraft(
        { slug: "test-cas-components", title: "Test CAS Components" },
        testActor
      );

      // Advance parent revision to 2
      TrialService.update(trial.id, 1, { tagline: "Updated Tagline" }, testActor);

      const newComps: ComponentInput[] = [
        { slot_index: 0, name: "Pouch 0", estate: "Est 0", grade: "BP", flush: "F1", weight_g: 50 },
        { slot_index: 1, name: "Pouch 1", estate: "Est 1", grade: "OF", flush: "F2", weight_g: 50 },
        { slot_index: 2, name: "Pouch 2", estate: "Est 2", grade: "PD", flush: "F3", weight_g: 50 },
        { slot_index: 3, name: "Pouch 3", estate: "Est 3", grade: "BOP", flush: "F4", weight_g: 50 },
      ];

      // Calling with stale expected_revision = 1 must throw
      expect(() => {
        TrialService.replaceComponents(trial.id, 1, newComps, testActor);
      }).toThrowError(TrialRevisionConflictError);

      // Calling with correct revision 2 succeeds and increments to 3
      const updated = TrialService.replaceComponents(trial.id, 2, newComps, testActor);
      expect(updated.revision).toBe(3);
    });

    it("attachAsset enforces parent CAS revision check", () => {
      const trial = TrialService.createDraft(
        { slug: "test-cas-assets", title: "Test CAS Assets" },
        testActor
      );

      const asset: AssetInput = {
        stage: "packaging",
        asset_url: "/images/test-pack.jpg",
        alt_text: "Packaging box for test kit",
      };

      // Stale revision 999 must throw
      expect(() => {
        TrialService.attachAsset(trial.id, 999, asset, testActor);
      }).toThrowError(TrialRevisionConflictError);

      // Revision 1 succeeds and increments to 2
      const updated = TrialService.attachAsset(trial.id, 1, asset, testActor);
      expect(updated.revision).toBe(2);
    });
  });

  // ==========================================================================
  // 4. Atomic Transaction Rollback
  // ==========================================================================
  describe("4. Atomic Transaction Rollback", () => {
    it("rolls back completely when child insert fails during replaceComponents", () => {
      const trial = TrialService.createDraft(
        { slug: "test-atomic-rollback", title: "Test Atomic Rollback" },
        testActor
      );

      const initialComps = db
        .prepare("SELECT * FROM trial_components WHERE trial_id = ? ORDER BY slot_index")
        .all(trial.id) as any[];
      expect(initialComps.length).toBe(4);

      // Attempt replace with invalid components (e.g. 3 sachets)
      const invalidComps: any[] = [
        { slot_index: 0, name: "Short Kit 1", estate: "A", weight_g: 50 },
        { slot_index: 1, name: "Short Kit 2", estate: "B", weight_g: 50 },
        { slot_index: 2, name: "Short Kit 3", estate: "C", weight_g: 50 },
      ];

      expect(() => {
        TrialService.replaceComponents(trial.id, 1, invalidComps, testActor);
      }).toThrow();

      // Verify trial revision did NOT increment
      const afterTrial = db.prepare("SELECT revision FROM trials WHERE id = ?").get(trial.id) as any;
      expect(afterTrial.revision).toBe(1);

      // Verify original components are completely intact
      const afterComps = db
        .prepare("SELECT * FROM trial_components WHERE trial_id = ? ORDER BY slot_index")
        .all(trial.id) as any[];
      expect(afterComps.length).toBe(4);
      expect(afterComps[0].name).toBe(initialComps[0].name);

      // Verify no extra audit entry was written
      const auditEntries = db
        .prepare("SELECT * FROM trial_audit WHERE trial_id = ?")
        .all(trial.id) as any[];
      expect(auditEntries.length).toBe(1); // Only the initial create_draft
    });

    it("trigger aborts status update to published if total weight != 200g", () => {
      const trial = TrialService.createDraft(
        { slug: "test-trigger-abort", title: "Trigger Abort Kit" },
        testActor
      );

      // Corrupt kit total weight by removing one component so sum = 150g (not 200g)
      db.prepare("DELETE FROM trial_components WHERE trial_id = ? AND slot_index = 3").run(trial.id);

      // Attempting to update status to 'published' triggers abort
      expect(() => {
        db.prepare("UPDATE trials SET status = 'published' WHERE id = ?").run(trial.id);
      }).toThrow(/Cannot publish trial: component weights must sum to exactly 200g/);

      // Verify status is still draft
      const check = db.prepare("SELECT status FROM trials WHERE id = ?").get(trial.id) as any;
      expect(check.status).toBe("draft");
    });
  });

  // ==========================================================================
  // 5. Atomic Audit Logging & History
  // ==========================================================================
  describe("5. Atomic Audit Logging & History", () => {
    it("records full chronological audit history with matching revisions and actor attribution", () => {
      const trial = TrialService.createDraft(
        { slug: "test-audit-trail", title: "Audit Trail Trial" },
        testActor
      );

      // Update 1 (rev 2)
      TrialService.update(trial.id, 1, { price_paise: 25000 }, testActor);

      // Replace components (rev 3)
      const validComps: ComponentInput[] = [
        { slot_index: 0, name: "Chai A", estate: "Est A", grade: "BP", flush: "F1", weight_g: 50 },
        { slot_index: 1, name: "Chai B", estate: "Est B", grade: "OF", flush: "F2", weight_g: 50 },
        { slot_index: 2, name: "Chai C", estate: "Est C", grade: "PD", flush: "F3", weight_g: 50 },
        { slot_index: 3, name: "Chai D", estate: "Est D", grade: "BOP", flush: "F4", weight_g: 50 },
      ];
      TrialService.replaceComponents(trial.id, 2, validComps, testActor);

      // Attach asset (rev 4)
      TrialService.attachAsset(
        trial.id,
        3,
        {
          stage: "packaging",
          asset_url: "/images/audit-pack.jpg",
          alt_text: "Packaging box for audit test",
        },
        testActor
      );

      // Submit review (rev 5)
      TrialService.submitReview(trial.id, 4, testActor);

      // Query history
      const history = TrialService.getHistory(trial.id);

      expect(history.length).toBe(5);

      // Sorted by revision DESC
      expect(history[0].action).toBe("submit_review");
      expect(history[0].revision).toBe(5);
      expect(history[0].actor_id).toBe("admin_tester");

      expect(history[1].action).toBe("attach_asset");
      expect(history[1].revision).toBe(4);

      expect(history[2].action).toBe("replace_components");
      expect(history[2].revision).toBe(3);

      expect(history[3].action).toBe("update");
      expect(history[3].revision).toBe(2);

      expect(history[4].action).toBe("create_draft");
      expect(history[4].revision).toBe(1);
    });
  });

  // ==========================================================================
  // 6. Whitelist Public Projection Engine
  // ==========================================================================
  describe("6. Whitelist Public Projection Engine", () => {
    it("throws TrialNotFoundError when projecting an unpublished draft without allowDraftPreview", () => {
      const trial = TrialService.createDraft(
        { slug: "test-draft-redaction", title: "Unpublished Draft" },
        testActor
      );

      const details = TrialService.getById(trial.id)!;
      expect(details.status).toBe("draft");

      expect(() => {
        toPublicDto(details);
      }).toThrowError(TrialNotFoundError);

      // With allowDraftPreview: true, succeeds
      const previewDto = toPublicDto(details, { allowDraftPreview: true });
      expect(previewDto.id).toBe(trial.id);
      expect(previewDto.title).toBe("Unpublished Draft");
    });

    it("strictly redacts internal COGS, supplier IDs, inventory quantities, and private notes", () => {
      const trial = TrialService.createDraft(
        {
          slug: "test-public-whitelist",
          title: "Public Whitelist Kit",
          tagline: "Customer-facing tagline",
          description: "Full editorial description",
          price_paise: 24000,
          compare_at_price_paise: 30000,
          cost_paise: 9500, // COGS must be REDACTED
          sku: "TRIAL-WHITELIST-4X50G",
          inventory_quantity: 42, // Quantity must be REDACTED
          inventory_policy: "track",
        },
        testActor
      );

      // Add asset
      TrialService.attachAsset(
        trial.id,
        1,
        {
          stage: "packaging",
          asset_url: "/images/trials/pack.jpg",
          alt_text: "Packaging box with golden tea leaf logo",
        },
        testActor
      );

      const details = TrialService.getById(trial.id)!;
      const publicDto = toPublicDto(details, { allowDraftPreview: true });

      // Verifying whitelist fields
      expect(publicDto.id).toBe(trial.id);
      expect(publicDto.slug).toBe("test-public-whitelist");
      expect(publicDto.title).toBe("Public Whitelist Kit");
      expect(publicDto.tagline).toBe("Customer-facing tagline");
      expect(publicDto.description).toBe("Full editorial description");
      expect(publicDto.status).toBe("published");
      expect(publicDto.pack_format).toBe("4x50g_sachets");
      expect(publicDto.net_weight_g).toBe(200);
      expect(publicDto.price_paise).toBe(24000);
      expect(publicDto.compare_at_price_paise).toBe(30000);
      expect(publicDto.sku).toBe("TRIAL-WHITELIST-4X50G");
      expect(publicDto.in_stock).toBe(true);
      expect(publicDto.hero_image).toEqual({
        url: "/images/trials/pack.jpg",
        alt_text: "Packaging box with golden tea leaf logo",
      });
      expect(publicDto.components.length).toBe(4);

      // STRICT REDACTION VERIFICATION: internal fields must NOT exist on public DTO
      expect((publicDto as any).cost_paise).toBeUndefined();
      expect((publicDto as any).inventory_quantity).toBeUndefined();
      expect((publicDto as any).revision).toBeUndefined();
      expect((publicDto as any).created_at).toBeUndefined();
      expect((publicDto as any).hero_image_id).toBeUndefined();

      for (const comp of publicDto.components) {
        expect((comp as any).regular_product_id).toBeUndefined();
        expect((comp as any).regular_variant_id).toBeUndefined();
        expect(comp.weight_g).toBe(50);
        expect(comp.brewing).toBeDefined();
      }
    });

    it("listPublic returns only published records", () => {
      // Create draft trial
      TrialService.createDraft({ slug: "test-draft-hidden", title: "Hidden Draft" }, testActor);

      // Query public list
      const publicList = TrialService.listPublic({ search: "Hidden Draft" });
      expect(publicList.trials.length).toBe(0);
      expect(publicList.total).toBe(0);
    });
  });

  // ==========================================================================
  // 7. Publication Blocker Engine & Lifecycle State Machine
  // ==========================================================================
  describe("7. Publication Blocker Engine & State Machine", () => {
    it("detects publication blockers when required fields are missing", () => {
      const trial = TrialService.createDraft(
        {
          slug: "test-blockers-check",
          title: "Incomplete Trial Kit",
          price_paise: 0, // Blocker: price <= 0
        },
        testActor
      );

      const validation = TrialService.validate(trial.id);
      expect(validation.can_publish).toBe(false);
      expect(validation.blockers.length).toBeGreaterThan(0);
      expect(
        validation.blockers.some((b) => b.includes("price must be greater than 0"))
      ).toBe(true);
      expect(
        validation.blockers.some((b) => b.includes("Packaging or hero photograph"))
      ).toBe(true);

      // Direct validation function check
      const directVal = validatePublication(TrialService.getById(trial.id)!);
      expect(directVal.can_publish).toBe(false);
    });

    it("publishes cleanly when all launch criteria are satisfied", () => {
      // 1. Create draft with complete metadata
      const trial = TrialService.createDraft(
        {
          slug: "test-ready-to-publish",
          title: "Complete Publication Ready Kit",
          tagline: "A fully verified four-tea discovery kit for testing",
          description: "Full editorial description exceeding minimum requirements for testing",
          price_paise: 25000,
          inventory_quantity: 100,
          inventory_policy: "track",
          meta_title: "Complete Publication Ready Kit | TeaFloww",
          meta_description: "Taste four genuine teas with full estate verification.",
        },
        testActor
      );

      // 2. Replace components with complete estate provenance
      const components: ComponentInput[] = [
        { slot_index: 0, name: "Moran CTC BP", estate: "Moran Estate", grade: "BP", flush: "First", weight_g: 50 },
        { slot_index: 1, name: "Batabari CTC OF", estate: "Batabari Estate", grade: "OF", flush: "Second", weight_g: 50 },
        { slot_index: 2, name: "Sonitpur CTC PD", estate: "Sonitpur Estate", grade: "PD", flush: "Rain", weight_g: 50 },
        { slot_index: 3, name: "Cinnamara CTC BOP", estate: "Cinnamara Estate", grade: "BOP", flush: "Autumn", weight_g: 50 },
      ];
      TrialService.replaceComponents(trial.id, 1, components, testActor);

      // 3. Attach packaging hero photo with accessibility alt text
      TrialService.attachAsset(
        trial.id,
        2,
        {
          stage: "packaging",
          asset_url: "/images/trials/complete-kit.jpg",
          alt_text: "Complete four pouch discovery kit in gift box",
        },
        testActor
      );

      // 4. Validate readiness
      const validation = TrialService.validate(trial.id);
      expect(validation.can_publish).toBe(true);
      expect(validation.blockers).toEqual([]);

      // 5. Submit for review: draft -> in_review (rev 3 -> 4)
      const inReview = TrialService.submitReview(trial.id, 3, testActor);
      expect(inReview.status).toBe("in_review");
      expect(inReview.revision).toBe(4);

      // 6. Publish: in_review -> published (rev 4 -> 5)
      const published = TrialService.publish(trial.id, 4, testActor);
      expect(published.status).toBe("published");
      expect(published.published_at).not.toBeNull();
      expect(published.revision).toBe(5);

      // 7. Verify immutable publication snapshot in trial_publications
      const pubRow = db
        .prepare("SELECT * FROM trial_publications WHERE trial_id = ? AND revision = 5")
        .get(trial.id) as any;
      expect(pubRow).toBeDefined();
      expect(pubRow.is_active).toBe(1);
      const snapshot = JSON.parse(pubRow.snapshot_json);
      expect(snapshot.id).toBe(trial.id);
      expect(snapshot.title).toBe("Complete Publication Ready Kit");

      // 8. Public detail query by slug succeeds
      const publicDto = TrialService.getPublicBySlug("test-ready-to-publish");
      expect(publicDto).not.toBeNull();
      expect(publicDto?.title).toBe("Complete Publication Ready Kit");
      expect(publicDto?.components.length).toBe(4);

      // 9. Unpublish: published -> draft (rev 5 -> 6)
      const unpublished = TrialService.unpublish(trial.id, 5, testActor);
      expect(unpublished.status).toBe("draft");
      expect(unpublished.revision).toBe(6);

      // Public detail query now returns null
      const hiddenDto = TrialService.getPublicBySlug("test-ready-to-publish");
      expect(hiddenDto).toBeNull();

      // 10. Archive: draft -> archived (rev 6 -> 7)
      const archived = TrialService.archive(trial.id, 6, testActor);
      expect(archived.status).toBe("archived");
      expect(archived.archived_at).not.toBeNull();
      expect(archived.revision).toBe(7);
    });

    it("publish fails if called with blockers", () => {
      const trial = TrialService.createDraft(
        { slug: "test-publish-blocked", title: "Blocked Kit", price_paise: 0 },
        testActor
      );

      expect(() => {
        TrialService.publish(trial.id, 1, testActor);
      }).toThrowError(TrialPublishGateError);
    });

    it("rejects invalid state transitions", () => {
      const trial = TrialService.createDraft(
        { slug: "test-invalid-transitions", title: "Transition Test Kit" },
        testActor
      );

      // Cannot unpublish a draft
      expect(() => {
        TrialService.unpublish(trial.id, 1, testActor);
      }).toThrowError(TrialInvalidStateTransitionError);
    });
  });

  // ==========================================================================
  // 8. Development Seed Data
  // ==========================================================================
  describe("8. Development Seed Data (`seedTrials`)", () => {
    it("seeds development kits idempotently", () => {
      // First seed run
      const result1 = seedTrials();
      expect(result1.seeded + result1.skipped).toBe(3);

      // Second seed run should be strictly idempotent (0 seeded, 3 skipped)
      const result2 = seedTrials();
      expect(result2.seeded).toBe(0);
      expect(result2.skipped).toBe(3);

      // Verify the 3 seeded trial slugs exist in database
      const slugs = [
        "four-tea-discovery-kit",
        "himalayan-high-altitude-ctc-orthodox-sampler",
        "siliguri-junction-kadak-chai-assortment",
      ];

      for (const slug of slugs) {
        const found = TrialService.getBySlug(slug);
        expect(found).not.toBeNull();
        expect(found?.status).toBe("draft"); // Seeded in draft status per guarded lifecycle
        expect(found?.components.length).toBe(4); // 4x50g sachets
        expect(found?.net_weight_g).toBe(200);
      }
    });
  });

  // ==========================================================================
  // 9. Query Filtering, Search, Pagination & Zod Schemas
  // ==========================================================================
  describe("9. Query Filtering, Search & Zod Validation Schemas", () => {
    it("filters trials by status, search term, and applies pagination", () => {
      // Create 3 distinct trials
      TrialService.createDraft(
        { slug: "test-query-alpha", title: "Alpha Masala Chai Trial", price_paise: 15000 },
        testActor
      );
      TrialService.createDraft(
        { slug: "test-query-beta", title: "Beta CTC Kadak Trial", price_paise: 25000 },
        testActor
      );
      const gamma = TrialService.createDraft(
        { slug: "test-query-gamma", title: "Gamma Green Tea Trial", price_paise: 35000 },
        testActor
      );

      // Submit gamma to in_review
      TrialService.submitReview(gamma.id, 1, testActor);

      // Filter by status 'in_review'
      const inReviewList = TrialService.list({ status: "in_review" });
      expect(inReviewList.trials.some((t) => t.slug === "test-query-gamma")).toBe(true);
      expect(inReviewList.trials.some((t) => t.slug === "test-query-alpha")).toBe(false);

      // Filter by search query
      const searchRes = TrialService.list({ search: "Alpha Masala" });
      expect(searchRes.trials.length).toBe(1);
      expect(searchRes.trials[0].slug).toBe("test-query-alpha");

      // Pagination
      const page1 = TrialService.list({ limit: 1, offset: 0, sort_by: "price_paise", sort_dir: "asc" });
      expect(page1.trials.length).toBe(1);

      // Non-existent lookup
      const notFoundById = TrialService.getById("non-existent-uuid-12345");
      expect(notFoundById).toBeNull();

      const notFoundBySlug = TrialService.getBySlug("non-existent-slug");
      expect(notFoundBySlug).toBeNull();
    });
  });

  // ==========================================================================
  // 10. Remediation: Archived State Immutability & Rights Status Filtering
  // ==========================================================================
  describe("10. Archived State Immutability & Rights Status Filtering", () => {
    it("rejects mutations (update, replaceComponents, attachAsset) on archived trials with TrialInvalidStateTransitionError", () => {
      const trial = TrialService.createDraft(
        { slug: "test-archived-lockout", title: "Archived Lockout Trial", price_paise: 20000 },
        testActor
      );
      // Archive the trial (rev 1 -> 2)
      const archived = TrialService.archive(trial.id, 1, testActor);
      expect(archived.status).toBe("archived");
      expect(archived.revision).toBe(2);

      // Attempt update: must throw TrialInvalidStateTransitionError
      expect(() => {
        TrialService.update(trial.id, 2, { title: "Mutated Title" }, testActor);
      }).toThrowError(TrialInvalidStateTransitionError);

      // Attempt replaceComponents: must throw TrialInvalidStateTransitionError
      const validComps: ComponentInput[] = [
        { slot_index: 0, name: "Sachet 1", estate: "E1", grade: "G1", flush: "F1", weight_g: 50 },
        { slot_index: 1, name: "Sachet 2", estate: "E2", grade: "G2", flush: "F2", weight_g: 50 },
        { slot_index: 2, name: "Sachet 3", estate: "E3", grade: "G3", flush: "F3", weight_g: 50 },
        { slot_index: 3, name: "Sachet 4", estate: "E4", grade: "G4", flush: "F4", weight_g: 50 },
      ];
      expect(() => {
        TrialService.replaceComponents(trial.id, 2, validComps, testActor);
      }).toThrowError(TrialInvalidStateTransitionError);

      // Attempt attachAsset: must throw TrialInvalidStateTransitionError
      expect(() => {
        TrialService.attachAsset(
          trial.id,
          2,
          { stage: "packaging", asset_url: "/img.jpg", alt_text: "Box" },
          testActor
        );
      }).toThrowError(TrialInvalidStateTransitionError);
    });

    it("toPublicDto filters component assets for approved rights status", () => {
      const trial = TrialService.createDraft(
        { slug: "test-rights-filtering", title: "Rights Status Filtering Kit", price_paise: 22000 },
        testActor
      );

      // Attach approved asset to slot 0
      TrialService.attachAsset(
        trial.id,
        1,
        {
          stage: "dry_leaf",
          asset_url: "/images/approved-leaf.jpg",
          alt_text: "Approved dry leaf photo",
          rights_status: "approved",
          slot_index: 0,
        },
        testActor
      );

      // Attach pending/rejected assets directly in DB
      const db = getDb();
      db.prepare(`
        INSERT INTO trial_assets (
          id, trial_id, slot_index, asset_url, stage, alt_text, rights_status, sort_order, created_at, updated_at
        ) VALUES ('asset-unapproved-1', ?, 0, '/images/pending-leaf.jpg', 'infused_leaf', 'Pending review leaf', 'pending', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(trial.id);

      db.prepare(`
        INSERT INTO trial_assets (
          id, trial_id, slot_index, asset_url, stage, alt_text, rights_status, sort_order, created_at, updated_at
        ) VALUES ('asset-unapproved-2', ?, 0, '/images/rejected-leaf.jpg', 'liquor', 'Rejected leaf photo', 'rejected', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(trial.id);

      const details = TrialService.getById(trial.id)!;
      const publicDto = toPublicDto(details, { allowDraftPreview: true });

      const slot0 = publicDto.components.find((c) => c.slot_index === 0);
      expect(slot0).toBeDefined();
      expect(slot0?.assets.length).toBe(1);
      expect(slot0?.assets[0].url).toBe("/images/approved-leaf.jpg");
      expect(slot0?.assets[0].alt_text).toBe("Approved dry leaf photo");

      // Verify unapproved assets are not present
      const allAssetUrls = slot0?.assets.map((a) => a.url) || [];
      expect(allAssetUrls).not.toContain("/images/pending-leaf.jpg");
      expect(allAssetUrls).not.toContain("/images/rejected-leaf.jpg");
    });
  });
});
