/**
 * TeaFloww Trials v3 — Milestone 1 Adversarial Stress Test Suite
 *
 * Authored by: Empirical Challenger 1
 *
 * Adversarially stress-tests:
 * 1. Concurrency Control & Atomic CAS Revision Racing:
 *    - N-way concurrent race with identical expected_revision (guaranteeing exactly 1 winner, N-1 rejections)
 *    - Interleaved racing mutations across different operational methods (update vs replaceComponents vs attachAsset)
 *    - Out-of-bounds revisions (future, stale, 0, negative)
 *    - Monotonic continuity over 50 rapid sequential mutations
 * 2. 4x50g = 200g Weight Invariant Stress Harness:
 *    - Service-level rejections (3 comps, 5 comps, 49g/51g, 190g/210g, duplicate slots, disjoint slots, quantity != 1, float weights, empty names)
 *    - SQLite table CHECK constraints (weight_g = 50, quantity = 1, slot_index BETWEEN 0 AND 3, net_weight_g = 200, pack_format)
 *    - SQLite UNIQUE constraint (trial_id, slot_index)
 * 3. Database Triggers Stress Harness:
 *    - `trg_trials_publish_insert_guard`: Rejects direct INSERT with status = 'published'
 *    - `trg_trials_publish_weight_check`: Rejects status transition to 'published' for 0, 1, 2, 3 components; permits only exactly 200g
 *    - Edge case trigger activation across lifecycle states (draft -> published, in_review -> published, archived -> published)
 * 4. Publication Blocker Engine Adversarial Inputs:
 *    - Exhaustive edge cases (pricing, stock, SEO, provenance, photos, alt text, claims)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { getDb } from "@/lib/db";
import { TrialService } from "@/lib/trials/service";
import { validateComponentInvariant } from "@/lib/trials/validation";
import {
  TrialRevisionConflictError,
  TrialNotFoundError,
  TrialPublishGateError,
  type AuditActor,
  type ComponentInput,
  type AssetInput,
} from "@/lib/trials/types";

const challengerActor = (id: string = "challenger_1"): AuditActor => ({
  actor_type: "admin",
  actor_id: id,
  actor_email: `${id}@teafloww.com`,
  ip_address: "127.0.0.1",
  reason: "Adversarial stress harness execution",
});

describe("Adversarial Stress Test: TeaFloww Trials v3 Domain Foundation", () => {
  const db = getDb();

  beforeEach(() => {
    db.prepare("DELETE FROM trials WHERE slug LIKE 'adv-%'").run();
  });

  // ==========================================================================
  // Section 1: Concurrency Control & Atomic CAS Revision Racing
  // ==========================================================================
  describe("Section 1: Concurrency Control & Atomic CAS Revision Racing", () => {
    it("20-way async race condition on the same expected_revision allows EXACTLY 1 winner and 19 rejections", async () => {
      const trial = TrialService.createDraft(
        {
          slug: "adv-cas-race-20",
          title: "Initial Race Base Kit",
          price_paise: 20000,
        },
        challengerActor("seed")
      );

      expect(trial.revision).toBe(1);

      const concurrencyCount = 20;
      let successCount = 0;
      let conflictCount = 0;
      const errors: any[] = [];

      // Execute 20 concurrent update attempts, ALL specifying expected_revision = 1
      const promises = Array.from({ length: concurrencyCount }, (_, i) => {
        return new Promise<void>((resolve) => {
          setTimeout(() => {
            try {
              TrialService.update(
                trial.id,
                1,
                { title: `Contender #${i + 1} Update` },
                challengerActor(`worker_${i + 1}`)
              );
              successCount++;
            } catch (err: any) {
              errors.push(err);
              if (err instanceof TrialRevisionConflictError) {
                conflictCount++;
              }
            }
            resolve();
          }, Math.random() * 5); // Add micro-jitter to simulate network/thread arrival
        });
      });

      await Promise.all(promises);

      // In a strict atomic CAS model:
      // Exactly 1 update MUST succeed and advance revision from 1 to 2.
      // Exactly 19 updates MUST fail with TrialRevisionConflictError.
      expect(successCount).toBe(1);
      expect(conflictCount).toBe(19);
      expect(errors.length).toBe(19);

      // Verify the database state has revision = 2
      const postState = TrialService.getById(trial.id)!;
      expect(postState.revision).toBe(2);

      // Verify audit trail recorded exactly 2 events: create_draft (rev 1) and 1 update (rev 2)
      const audit = TrialService.getHistory(trial.id);
      expect(audit.length).toBe(2);
      expect(audit[0].revision).toBe(2);
      expect(audit[1].revision).toBe(1);
    });

    it("interleaved racing mutations across different methods (update vs replaceComponents vs attachAsset) reject stale caller", () => {
      const trial = TrialService.createDraft(
        {
          slug: "adv-interleaved-methods",
          title: "Interleaved Race Kit",
        },
        challengerActor("init")
      );
      expect(trial.revision).toBe(1);

      // Method A: update advances revision 1 -> 2
      const updated = TrialService.update(
        trial.id,
        1,
        { price_paise: 29900 },
        challengerActor("updater")
      );
      expect(updated.revision).toBe(2);

      // Method B: replaceComponents attempts with stale revision 1 -> MUST FAIL
      const newComps: ComponentInput[] = [
        { slot_index: 0, name: "Pouch 0", estate: "Est 0", grade: "BP", flush: "F1", weight_g: 50 },
        { slot_index: 1, name: "Pouch 1", estate: "Est 1", grade: "OF", flush: "F2", weight_g: 50 },
        { slot_index: 2, name: "Pouch 2", estate: "Est 2", grade: "PD", flush: "F3", weight_g: 50 },
        { slot_index: 3, name: "Pouch 3", estate: "Est 3", grade: "BOP", flush: "F4", weight_g: 50 },
      ];

      expect(() => {
        TrialService.replaceComponents(trial.id, 1, newComps, challengerActor("composer"));
      }).toThrowError(TrialRevisionConflictError);

      // Method C: attachAsset attempts with stale revision 1 -> MUST FAIL
      const asset: AssetInput = {
        stage: "packaging",
        asset_url: "/images/adv-test.jpg",
        alt_text: "Packaging box test image",
      };

      expect(() => {
        TrialService.attachAsset(trial.id, 1, asset, challengerActor("photographer"));
      }).toThrowError(TrialRevisionConflictError);

      // Method D: attachAsset with current revision 2 -> SUCCEEDS and advances to 3
      const attached = TrialService.attachAsset(trial.id, 2, asset, challengerActor("photographer"));
      expect(attached.revision).toBe(3);

      // Method E: submitReview with stale revision 2 -> MUST FAIL
      expect(() => {
        TrialService.submitReview(trial.id, 2, challengerActor("reviewer"));
      }).toThrowError(TrialRevisionConflictError);
    });

    it("rejects non-contiguous, future, negative, and zero revisions with TrialRevisionConflictError", () => {
      const trial = TrialService.createDraft(
        { slug: "adv-bad-revisions", title: "Bad Revisions Kit" },
        challengerActor()
      );
      expect(trial.revision).toBe(1);

      // Future revision: 2 when current is 1
      try {
        TrialService.update(trial.id, 2, { title: "Future 2" }, challengerActor());
        expect.unreachable("Expected error on future revision");
      } catch (err: any) {
        expect(err).toBeInstanceOf(TrialRevisionConflictError);
        expect(err.current_revision).toBe(1);
        expect(err.expected_revision).toBe(2);
        expect(err.status).toBe(409);
        expect(err.mcpCode).toBe(-32009);
      }

      // Absurdly high future revision: 999999
      expect(() => {
        TrialService.update(trial.id, 999999, { title: "High Future" }, challengerActor());
      }).toThrowError(TrialRevisionConflictError);

      // Stale revision: 0
      expect(() => {
        TrialService.update(trial.id, 0, { title: "Zero Rev" }, challengerActor());
      }).toThrowError(TrialRevisionConflictError);

      // Negative revision: -1
      expect(() => {
        TrialService.update(trial.id, -1, { title: "Negative Rev" }, challengerActor());
      }).toThrowError(TrialRevisionConflictError);
    });

    it("maintains strict monotonic sequence across 50 rapid sequential updates without skips or regressions", () => {
      const trial = TrialService.createDraft(
        { slug: "adv-monotonic-seq", title: "Monotonic Sequence Kit" },
        challengerActor()
      );

      let currentRev = trial.revision;
      expect(currentRev).toBe(1);

      for (let i = 1; i <= 50; i++) {
        const next = TrialService.update(
          trial.id,
          currentRev,
          { title: `Monotonic Step ${i}` },
          challengerActor(`step_${i}`)
        );
        expect(next.revision).toBe(currentRev + 1);
        currentRev = next.revision;
      }

      expect(currentRev).toBe(51);

      // Verify audit entries count is 51 (1 create_draft + 50 updates)
      const audit = TrialService.getHistory(trial.id);
      expect(audit.length).toBe(51);

      // Check strictly consecutive revisions from 51 down to 1
      for (let idx = 0; idx < 51; idx++) {
        expect(audit[idx].revision).toBe(51 - idx);
      }
    });
  });

  // ==========================================================================
  // Section 2: 4x50g = 200g Weight Invariant Stress Harness
  // ==========================================================================
  describe("Section 2: 4x50g = 200g Weight Invariant Stress Harness", () => {
    const baseComponents: ComponentInput[] = [
      { slot_index: 0, name: "Assam BP", estate: "Estate A", grade: "BP", flush: "First", weight_g: 50, quantity: 1 },
      { slot_index: 1, name: "Dooars OF", estate: "Estate B", grade: "OF", flush: "Second", weight_g: 50, quantity: 1 },
      { slot_index: 2, name: "Terai PD", estate: "Estate C", grade: "PD", flush: "Rain", weight_g: 50, quantity: 1 },
      { slot_index: 3, name: "Darjeeling BOP", estate: "Estate D", grade: "BOP", flush: "Autumn", weight_g: 50, quantity: 1 },
    ];

    it("service rejects 3 components (underweight kit, 150g)", () => {
      const threeComps = baseComponents.slice(0, 3);
      const inv = validateComponentInvariant(threeComps);
      expect(inv.valid).toBe(false);
      expect(inv.count).toBe(3);
      expect(inv.totalWeight).toBe(150);
      expect(inv.errors.some((e) => e.includes("exactly 4 sachets"))).toBe(true);
      expect(inv.errors.some((e) => e.includes("Total kit weight must be exactly 200g"))).toBe(true);
    });

    it("service rejects 5 components (overweight kit, 250g)", () => {
      const fiveComps = [
        ...baseComponents,
        { slot_index: 0, name: "Fifth Pouch", estate: "Estate E", grade: "BP", flush: "First", weight_g: 50, quantity: 1 },
      ];
      const inv = validateComponentInvariant(fiveComps);
      expect(inv.valid).toBe(false);
      expect(inv.count).toBe(5);
      expect(inv.totalWeight).toBe(250);
      expect(inv.errors.some((e) => e.includes("exactly 4 sachets"))).toBe(true);
    });

    it("service rejects 4 components summing to 200g but violating individual 50g sachet weight [49g, 51g, 50g, 50g]", () => {
      const skewedComps: ComponentInput[] = [
        { ...baseComponents[0], weight_g: 49 },
        { ...baseComponents[1], weight_g: 51 },
        { ...baseComponents[2], weight_g: 50 },
        { ...baseComponents[3], weight_g: 50 },
      ];
      const inv = validateComponentInvariant(skewedComps);
      expect(inv.valid).toBe(false);
      expect(inv.totalWeight).toBe(200); // Net sum is 200, BUT individual sachets violate 50g!
      expect(inv.errors.some((e) => e.includes("must be exactly 50g (got 49g)"))).toBe(true);
      expect(inv.errors.some((e) => e.includes("must be exactly 50g (got 51g)"))).toBe(true);
    });

    it("service rejects 4 components summing to 190g (e.g. 40g, 50g, 50g, 50g)", () => {
      const underComps: ComponentInput[] = [
        { ...baseComponents[0], weight_g: 40 },
        { ...baseComponents[1], weight_g: 50 },
        { ...baseComponents[2], weight_g: 50 },
        { ...baseComponents[3], weight_g: 50 },
      ];
      const inv = validateComponentInvariant(underComps);
      expect(inv.valid).toBe(false);
      expect(inv.totalWeight).toBe(190);
      expect(inv.errors.some((e) => e.includes("Total kit weight must be exactly 200g (got 190g)"))).toBe(true);
    });

    it("service rejects 4 components summing to 210g (e.g. 60g, 50g, 50g, 50g)", () => {
      const overComps: ComponentInput[] = [
        { ...baseComponents[0], weight_g: 60 },
        { ...baseComponents[1], weight_g: 50 },
        { ...baseComponents[2], weight_g: 50 },
        { ...baseComponents[3], weight_g: 50 },
      ];
      const inv = validateComponentInvariant(overComps);
      expect(inv.valid).toBe(false);
      expect(inv.totalWeight).toBe(210);
      expect(inv.errors.some((e) => e.includes("Total kit weight must be exactly 200g (got 210g)"))).toBe(true);
    });

    it("service rejects duplicate slot_index [0, 0, 1, 2]", () => {
      const dupSlotComps: ComponentInput[] = [
        { ...baseComponents[0], slot_index: 0 },
        { ...baseComponents[1], slot_index: 0 }, // Duplicate slot 0
        { ...baseComponents[2], slot_index: 1 },
        { ...baseComponents[3], slot_index: 2 },
      ];
      const inv = validateComponentInvariant(dupSlotComps);
      expect(inv.valid).toBe(false);
      expect(inv.errors.some((e) => e.includes("Duplicate slot_index 0 detected"))).toBe(true);
      expect(inv.errors.some((e) => e.includes("Missing component for slot_index 3"))).toBe(true);
    });

    it("service rejects out-of-range slot_index [0, 1, 2, 4]", () => {
      const oobSlotComps: ComponentInput[] = [
        { ...baseComponents[0], slot_index: 0 },
        { ...baseComponents[1], slot_index: 1 },
        { ...baseComponents[2], slot_index: 2 },
        { ...baseComponents[3], slot_index: 4 }, // Invalid slot 4
      ];
      const inv = validateComponentInvariant(oobSlotComps);
      expect(inv.valid).toBe(false);
      expect(inv.errors.some((e) => e.includes("invalid slot_index 4"))).toBe(true);
    });

    it("service rejects negative slot_index [-1, 0, 1, 2]", () => {
      const negSlotComps: ComponentInput[] = [
        { ...baseComponents[0], slot_index: -1 },
        { ...baseComponents[1], slot_index: 0 },
        { ...baseComponents[2], slot_index: 1 },
        { ...baseComponents[3], slot_index: 2 },
      ];
      const inv = validateComponentInvariant(negSlotComps);
      expect(inv.valid).toBe(false);
      expect(inv.errors.some((e) => e.includes("invalid slot_index -1"))).toBe(true);
    });

    it("service rejects quantity != 1 (e.g. quantity = 2 or quantity = 0)", () => {
      const q2Comps: ComponentInput[] = [
        { ...baseComponents[0], quantity: 2 },
        { ...baseComponents[1] },
        { ...baseComponents[2] },
        { ...baseComponents[3] },
      ];
      const inv2 = validateComponentInvariant(q2Comps);
      expect(inv2.valid).toBe(false);
      expect(inv2.errors.some((e) => e.includes("quantity must be exactly 1 (got 2)"))).toBe(true);

      const q0Comps: ComponentInput[] = [
        { ...baseComponents[0], quantity: 0 },
        { ...baseComponents[1] },
        { ...baseComponents[2] },
        { ...baseComponents[3] },
      ];
      const inv0 = validateComponentInvariant(q0Comps);
      expect(inv0.valid).toBe(false);
      expect(inv0.errors.some((e) => e.includes("quantity must be exactly 1 (got 0)"))).toBe(true);
    });

    it("service rejects floating point weights (e.g. 50.5g)", () => {
      const floatComps: ComponentInput[] = [
        { ...baseComponents[0], weight_g: 50.5 },
        { ...baseComponents[1], weight_g: 49.5 },
        { ...baseComponents[2] },
        { ...baseComponents[3] },
      ];
      const inv = validateComponentInvariant(floatComps);
      expect(inv.valid).toBe(false);
      expect(inv.errors.some((e) => e.includes("must be exactly 50g"))).toBe(true);
    });

    it("service rejects component with blank or single-character name", () => {
      const blankNameComps: ComponentInput[] = [
        { ...baseComponents[0], name: "" },
        { ...baseComponents[1], name: "X" }, // Only 1 char
        { ...baseComponents[2] },
        { ...baseComponents[3] },
      ];
      const inv = validateComponentInvariant(blankNameComps);
      expect(inv.valid).toBe(false);
      expect(inv.errors.some((e) => e.includes("missing a valid name"))).toBe(true);
    });

    // Database-level check constraints
    it("database CHECK constraints reject raw SQL insert with weight_g != 50", () => {
      const trial = TrialService.createDraft(
        { slug: "adv-sql-weight-chk", title: "SQL Check Kit" },
        challengerActor()
      );

      // Attempt raw INSERT into trial_components with weight_g = 49
      expect(() => {
        db.prepare(`
          INSERT INTO trial_components (id, trial_id, slot_index, name, weight_g, quantity)
          VALUES ('chk-49', ?, 0, 'Under 49g', 49, 1)
        `).run(trial.id);
      }).toThrow(/CHECK constraint failed/);

      // Attempt raw INSERT into trial_components with weight_g = 51
      expect(() => {
        db.prepare(`
          INSERT INTO trial_components (id, trial_id, slot_index, name, weight_g, quantity)
          VALUES ('chk-51', ?, 0, 'Over 51g', 51, 1)
        `).run(trial.id);
      }).toThrow(/CHECK constraint failed/);
    });

    it("database CHECK constraints reject raw SQL insert with quantity != 1", () => {
      const trial = TrialService.createDraft(
        { slug: "adv-sql-qty-chk", title: "SQL Qty Check Kit" },
        challengerActor()
      );

      // quantity = 2
      expect(() => {
        db.prepare(`
          INSERT INTO trial_components (id, trial_id, slot_index, name, weight_g, quantity)
          VALUES ('chk-q2', ?, 0, 'Double Qty', 50, 2)
        `).run(trial.id);
      }).toThrow(/CHECK constraint failed/);

      // quantity = 0
      expect(() => {
        db.prepare(`
          INSERT INTO trial_components (id, trial_id, slot_index, name, weight_g, quantity)
          VALUES ('chk-q0', ?, 0, 'Zero Qty', 50, 0)
        `).run(trial.id);
      }).toThrow(/CHECK constraint failed/);
    });

    it("database CHECK constraints reject raw SQL insert with slot_index NOT BETWEEN 0 AND 3", () => {
      const trial = TrialService.createDraft(
        { slug: "adv-sql-slot-chk", title: "SQL Slot Check Kit" },
        challengerActor()
      );

      // slot_index = 4
      expect(() => {
        db.prepare(`
          INSERT INTO trial_components (id, trial_id, slot_index, name, weight_g, quantity)
          VALUES ('chk-s4', ?, 4, 'Slot 4', 50, 1)
        `).run(trial.id);
      }).toThrow(/CHECK constraint failed/);

      // slot_index = -1
      expect(() => {
        db.prepare(`
          INSERT INTO trial_components (id, trial_id, slot_index, name, weight_g, quantity)
          VALUES ('chk-sneg', ?, -1, 'Slot -1', 50, 1)
        `).run(trial.id);
      }).toThrow(/CHECK constraint failed/);
    });

    it("database UNIQUE constraint rejects duplicate (trial_id, slot_index)", () => {
      const trial = TrialService.createDraft(
        { slug: "adv-sql-unique-slot", title: "SQL Unique Slot Kit" },
        challengerActor()
      );

      // slot 0 already exists from createDraft
      expect(() => {
        db.prepare(`
          INSERT INTO trial_components (id, trial_id, slot_index, name, weight_g, quantity)
          VALUES ('dup-s0', ?, 0, 'Duplicate Slot 0', 50, 1)
        `).run(trial.id);
      }).toThrow(/UNIQUE constraint failed: trial_components.trial_id, trial_components.slot_index/);
    });

    it("database CHECK constraints on trials table enforce net_weight_g = 200 and pack_format = '4x50g_sachets'", () => {
      // Direct insert with net_weight_g = 190
      expect(() => {
        db.prepare(`
          INSERT INTO trials (id, slug, title, net_weight_g, sku, price_paise)
          VALUES ('adv-w190', 'adv-w190', 'Bad Net Weight', 190, 'SKU-W190', 20000)
        `).run();
      }).toThrow(/CHECK constraint failed/);

      // Direct insert with net_weight_g = 210
      expect(() => {
        db.prepare(`
          INSERT INTO trials (id, slug, title, net_weight_g, sku, price_paise)
          VALUES ('adv-w210', 'adv-w210', 'Bad Net Weight', 210, 'SKU-W210', 20000)
        `).run();
      }).toThrow(/CHECK constraint failed/);

      // Direct insert with pack_format = '5x40g'
      expect(() => {
        db.prepare(`
          INSERT INTO trials (id, slug, title, pack_format, sku, price_paise)
          VALUES ('adv-fmt', 'adv-fmt', 'Bad Format', '5x40g', 'SKU-FMT', 20000)
        `).run();
      }).toThrow(/CHECK constraint failed/);
    });
  });

  // ==========================================================================
  // Section 3: SQLite Database Triggers Stress Harness
  // ==========================================================================
  describe("Section 3: SQLite Database Triggers Stress Harness", () => {
    it("trigger trg_trials_publish_insert_guard aborts direct SQL INSERT with status = 'published'", () => {
      expect(() => {
        db.prepare(`
          INSERT INTO trials (id, slug, title, status, sku, price_paise)
          VALUES ('adv-direct-pub-1', 'adv-direct-pub-1', 'Direct Published Trial', 'published', 'SKU-DIR-1', 20000)
        `).run();
      }).toThrow(/Cannot insert trial directly as published: must start as draft/);

      // Verify row was NOT inserted
      const check = db.prepare("SELECT id FROM trials WHERE slug = 'adv-direct-pub-1'").get();
      expect(check).toBeUndefined();
    });

    it("trigger trg_trials_publish_insert_guard allows direct SQL INSERT with status = 'draft'", () => {
      db.prepare(`
        INSERT INTO trials (id, slug, title, status, sku, price_paise)
        VALUES ('adv-direct-draft-1', 'adv-direct-draft-1', 'Direct Draft Trial', 'draft', 'SKU-DIR-DRAFT', 20000)
      `).run();

      const check = db.prepare("SELECT id, status FROM trials WHERE slug = 'adv-direct-draft-1'").get() as any;
      expect(check).toBeDefined();
      expect(check.status).toBe("draft");
    });

    it("trigger trg_trials_publish_weight_check blocks publishing trial with 0 components (sum 0g)", () => {
      // Insert draft trial directly without components
      const id = "adv-trg-0-comps";
      db.prepare(`
        INSERT INTO trials (id, slug, title, status, sku, price_paise)
        VALUES (?, 'adv-trg-0-comps', 'Zero Components Kit', 'draft', 'SKU-TRG-0', 20000)
      `).run(id);

      expect(() => {
        db.prepare("UPDATE trials SET status = 'published' WHERE id = ?").run(id);
      }).toThrow(/Cannot publish trial: component weights must sum to exactly 200g \(4x50g\)/);

      const check = db.prepare("SELECT status FROM trials WHERE id = ?").get(id) as any;
      expect(check.status).toBe("draft");
    });

    it("trigger trg_trials_publish_weight_check blocks publishing trial with 1 component (sum 50g)", () => {
      const id = "adv-trg-1-comp";
      db.prepare(`
        INSERT INTO trials (id, slug, title, status, sku, price_paise)
        VALUES (?, 'adv-trg-1-comp', 'One Component Kit', 'draft', 'SKU-TRG-1', 20000)
      `).run(id);

      db.prepare(`
        INSERT INTO trial_components (id, trial_id, slot_index, name, weight_g, quantity)
        VALUES ('c1', ?, 0, 'Solo Pouch', 50, 1)
      `).run(id);

      expect(() => {
        db.prepare("UPDATE trials SET status = 'published' WHERE id = ?").run(id);
      }).toThrow(/Cannot publish trial: component weights must sum to exactly 200g \(4x50g\)/);
    });

    it("trigger trg_trials_publish_weight_check blocks publishing trial with 2 components (sum 100g)", () => {
      const id = "adv-trg-2-comp";
      db.prepare(`
        INSERT INTO trials (id, slug, title, status, sku, price_paise)
        VALUES (?, 'adv-trg-2-comp', 'Two Component Kit', 'draft', 'SKU-TRG-2', 20000)
      `).run(id);

      db.prepare(`
        INSERT INTO trial_components (id, trial_id, slot_index, name, weight_g, quantity)
        VALUES ('c1', ?, 0, 'Pouch 0', 50, 1), ('c2', ?, 1, 'Pouch 1', 50, 1)
      `).run(id, id);

      expect(() => {
        db.prepare("UPDATE trials SET status = 'published' WHERE id = ?").run(id);
      }).toThrow(/Cannot publish trial: component weights must sum to exactly 200g \(4x50g\)/);
    });

    it("trigger trg_trials_publish_weight_check blocks publishing trial with 3 components (sum 150g)", () => {
      const id = "adv-trg-3-comp";
      db.prepare(`
        INSERT INTO trials (id, slug, title, status, sku, price_paise)
        VALUES (?, 'adv-trg-3-comp', 'Three Component Kit', 'draft', 'SKU-TRG-3', 20000)
      `).run(id);

      db.prepare(`
        INSERT INTO trial_components (id, trial_id, slot_index, name, weight_g, quantity)
        VALUES ('c1', ?, 0, 'Pouch 0', 50, 1), ('c2', ?, 1, 'Pouch 1', 50, 1), ('c3', ?, 2, 'Pouch 2', 50, 1)
      `).run(id, id, id);

      expect(() => {
        db.prepare("UPDATE trials SET status = 'published' WHERE id = ?").run(id);
      }).toThrow(/Cannot publish trial: component weights must sum to exactly 200g \(4x50g\)/);
    });

    it("trigger trg_trials_publish_weight_check allows transition to 'published' when sum is strictly 200g (4x50g)", () => {
      const id = "adv-trg-4-comp";
      db.prepare(`
        INSERT INTO trials (id, slug, title, status, sku, price_paise)
        VALUES (?, 'adv-trg-4-comp', 'Four Component Compliant Kit', 'draft', 'SKU-TRG-4', 20000)
      `).run(id);

      db.prepare(`
        INSERT INTO trial_components (id, trial_id, slot_index, name, weight_g, quantity)
        VALUES
          ('c1', ?, 0, 'Pouch 0', 50, 1),
          ('c2', ?, 1, 'Pouch 1', 50, 1),
          ('c3', ?, 2, 'Pouch 2', 50, 1),
          ('c4', ?, 3, 'Pouch 3', 50, 1)
      `).run(id, id, id, id);

      // Trigger allows the update
      expect(() => {
        db.prepare("UPDATE trials SET status = 'published' WHERE id = ?").run(id);
      }).not.toThrow();

      const check = db.prepare("SELECT status FROM trials WHERE id = ?").get(id) as any;
      expect(check.status).toBe("published");
    });

    it("trigger trg_trials_publish_weight_check also fires on transition from 'in_review' or 'archived' to 'published'", () => {
      const id = "adv-trg-archived-to-pub";
      db.prepare(`
        INSERT INTO trials (id, slug, title, status, sku, price_paise)
        VALUES (?, 'adv-trg-archived', 'Archived Kit', 'archived', 'SKU-ARCH-PUB', 20000)
      `).run(id);

      // No components -> Must abort
      expect(() => {
        db.prepare("UPDATE trials SET status = 'published' WHERE id = ?").run(id);
      }).toThrow(/Cannot publish trial: component weights must sum to exactly 200g \(4x50g\)/);
    });

    it("updating non-status columns on already published trial does not falsely trigger weight check", () => {
      const id = "adv-pub-title-update";
      db.prepare(`
        INSERT INTO trials (id, slug, title, status, sku, price_paise)
        VALUES (?, 'adv-pub-title-update', 'Published Kit', 'draft', 'SKU-PUB-TITLE', 20000)
      `).run(id);

      db.prepare(`
        INSERT INTO trial_components (id, trial_id, slot_index, name, weight_g, quantity)
        VALUES
          ('c1', ?, 0, 'P0', 50, 1),
          ('c2', ?, 1, 'P1', 50, 1),
          ('c3', ?, 2, 'P2', 50, 1),
          ('c4', ?, 3, 'P3', 50, 1)
      `).run(id, id, id, id);

      db.prepare("UPDATE trials SET status = 'published' WHERE id = ?").run(id);

      // Updating title on published trial should succeed
      expect(() => {
        db.prepare("UPDATE trials SET title = 'New Title For Published Kit' WHERE id = ?").run(id);
      }).not.toThrow();

      const check = db.prepare("SELECT title FROM trials WHERE id = ?").get(id) as any;
      expect(check.title).toBe("New Title For Published Kit");
    });
  });

  // ==========================================================================
  // Section 4: Publication Blocker Engine Adversarial Tests
  // ==========================================================================
  describe("Section 4: Publication Blocker Engine Adversarial Inputs", () => {
    it("detects and blocks publication on every individual missing required field", () => {
      const trial = TrialService.createDraft(
        {
          slug: "adv-blockers-matrix",
          title: "Adversarial Matrix Kit",
          price_paise: 20000,
        },
        challengerActor()
      );

      // Baseline validation: brand new draft without hero photo and complete metadata
      const v0 = TrialService.validate(trial.id);
      expect(v0.can_publish).toBe(false);
      expect(v0.blockers.some((b) => b.includes("Packaging or hero photograph"))).toBe(true);

      // Attack 1: Zero price
      TrialService.update(trial.id, 1, { price_paise: 0 }, challengerActor());
      const v1 = TrialService.validate(trial.id);
      expect(v1.can_publish).toBe(false);
      expect(v1.blockers.some((b) => b.includes("price must be greater than 0"))).toBe(true);

      // Attack 2: Compare-at lower than selling price
      TrialService.update(trial.id, 2, { price_paise: 25000, compare_at_price_paise: 20000 }, challengerActor());
      const v2 = TrialService.validate(trial.id);
      expect(v2.can_publish).toBe(false);
      expect(v2.blockers.some((b) => b.includes("Compare-at price cannot be lower than the selling price"))).toBe(true);

      // Attack 3: Track inventory with 0 quantity
      TrialService.update(trial.id, 3, { compare_at_price_paise: 30000, inventory_policy: "track", inventory_quantity: 0 }, challengerActor());
      const v3 = TrialService.validate(trial.id);
      expect(v3.can_publish).toBe(false);
      expect(v3.blockers.some((b) => b.includes("Inventory stock must be at least 1 unit"))).toBe(true);

      // Attack 4: Missing estate provenance on component
      TrialService.update(trial.id, 4, { inventory_quantity: 50 }, challengerActor());
      const compsMissingEstate: ComponentInput[] = [
        { slot_index: 0, name: "No Estate Pouch", estate: "", grade: "BP", flush: "F1", weight_g: 50 },
        { slot_index: 1, name: "Pouch 1", estate: "Estate B", grade: "OF", flush: "F2", weight_g: 50 },
        { slot_index: 2, name: "Pouch 2", estate: "Estate C", grade: "PD", flush: "F3", weight_g: 50 },
        { slot_index: 3, name: "Pouch 3", estate: "Estate D", grade: "BOP", flush: "F4", weight_g: 50 },
      ];
      TrialService.replaceComponents(trial.id, 5, compsMissingEstate, challengerActor());
      const v4 = TrialService.validate(trial.id);
      expect(v4.can_publish).toBe(false);
      expect(v4.blockers.some((b) => b.includes("missing estate provenance"))).toBe(true);

      // Attack 5: Asset with empty/whitespace alt text
      const compsWithEstate: ComponentInput[] = [
        { slot_index: 0, name: "Pouch 0", estate: "Estate A", grade: "BP", flush: "F1", weight_g: 50 },
        { slot_index: 1, name: "Pouch 1", estate: "Estate B", grade: "OF", flush: "F2", weight_g: 50 },
        { slot_index: 2, name: "Pouch 2", estate: "Estate C", grade: "PD", flush: "F3", weight_g: 50 },
        { slot_index: 3, name: "Pouch 3", estate: "Estate D", grade: "BOP", flush: "F4", weight_g: 50 },
      ];
      TrialService.replaceComponents(trial.id, 6, compsWithEstate, challengerActor());

      // Try attaching asset with empty alt text via service -> attachAsset rejects empty alt_text
      expect(() => {
        TrialService.attachAsset(
          trial.id,
          7,
          { stage: "packaging", asset_url: "/img.jpg", alt_text: " " },
          challengerActor()
        );
      }).toThrow(/requires asset_url, stage, and non-empty alt_text/);

      // Direct SQL insertion of bad asset bypassing service
      db.prepare(`
        INSERT INTO trial_assets (id, trial_id, stage, asset_url, alt_text)
        VALUES ('bad-alt-asset', ?, 'packaging', '/bad-img.jpg', '')
      `).run(trial.id);

      const v5 = TrialService.validate(trial.id);
      expect(v5.can_publish).toBe(false);
      expect(v5.blockers.some((b) => b.includes("missing required accessibility alt text"))).toBe(true);

      // Calling TrialService.publish directly throws TrialPublishGateError
      expect(() => {
        TrialService.publish(trial.id, 7, challengerActor());
      }).toThrowError(TrialPublishGateError);
    });

    it("TrialService.publish throws TrialPublishGateError when called with blockers and does not modify status", () => {
      const trial = TrialService.createDraft(
        { slug: "adv-blocked-publish-attempt", title: "Blocked Attempt Kit", price_paise: 0 },
        challengerActor()
      );

      try {
        TrialService.publish(trial.id, 1, challengerActor());
        expect.unreachable("Publish should fail due to blockers");
      } catch (err: any) {
        expect(err).toBeInstanceOf(TrialPublishGateError);
        expect(err.status).toBe(422);
        expect(err.mcpCode).toBe(-32009);
        expect(err.blockers.length).toBeGreaterThan(0);
      }

      // Verify trial is still in draft status
      const current = TrialService.getById(trial.id)!;
      expect(current.status).toBe("draft");
      expect(current.revision).toBe(1);
    });
  });

  // ==========================================================================
  // Section 5: Transaction Rollback & Extreme Boundary Hardening
  // ==========================================================================
  describe("Section 5: Transaction Rollback & Extreme Boundary Hardening", () => {
    it("invalid actor_type in audit trail triggers SQLite CHECK and rolls back the entire transaction", () => {
      const trial = TrialService.createDraft(
        { slug: "adv-audit-rollback", title: "Audit Rollback Kit", price_paise: 20000 },
        challengerActor()
      );

      expect(trial.revision).toBe(1);

      // Attempt update with illegal actor_type 'unauthorized_bot'
      const illegalActor: any = {
        actor_type: "unauthorized_bot",
        actor_id: "bot_99",
      };

      expect(() => {
        TrialService.update(trial.id, 1, { title: "Hacked Title" }, illegalActor);
      }).toThrow(/CHECK constraint failed: actor_type/);

      // Verify transaction rollback: title was NOT modified and revision is still 1
      const current = TrialService.getById(trial.id)!;
      expect(current.title).toBe("Audit Rollback Kit");
      expect(current.revision).toBe(1);

      // Verify no orphaned audit entry was written
      const history = TrialService.getHistory(trial.id);
      expect(history.length).toBe(1); // Only the initial create_draft
    });

    it("concurrently deleted trial during update throws TrialNotFoundError (404), not revision conflict", () => {
      const trial = TrialService.createDraft(
        { slug: "adv-deleted-race", title: "Deleted Race Kit" },
        challengerActor()
      );

      // Concurrently delete trial behind the service
      db.prepare("DELETE FROM trials WHERE id = ?").run(trial.id);

      try {
        TrialService.update(trial.id, 1, { title: "Update Deleted" }, challengerActor());
        expect.unreachable("Expected TrialNotFoundError");
      } catch (err: any) {
        expect(err).toBeInstanceOf(TrialNotFoundError);
        expect(err.status).toBe(404);
        expect(err.mcpCode).toBe(-32004);
      }
    });

    it("search and query endpoints parameterize raw SQL and resist SQL injection attempts", () => {
      TrialService.createDraft(
        { slug: "adv-sqli-target", title: "Legitimate Target Kit" },
        challengerActor()
      );

      // Attempt classic SQL injection payload
      const sqliSearch = "' OR '1'='1' --";
      const result = TrialService.list({ search: sqliSearch });

      // If SQL injection succeeded, it would return all rows in database.
      // With parameterization, it searches for the literal string and returns 0.
      expect(result.trials.length).toBe(0);

      // Another payload attempting to terminate query
      const dropAttempt = "test'; DROP TABLE trials; --";
      const dropRes = TrialService.list({ search: dropAttempt });
      expect(dropRes.trials.length).toBe(0);

      // Confirm trials table still exists and is untouched
      const count = db.prepare("SELECT count(*) as c FROM trials").get() as { c: number };
      expect(count.c).toBeGreaterThan(0);
    });

    it("database CHECK constraints reject negative price_paise and negative inventory_quantity", () => {
      expect(() => {
        db.prepare(`
          INSERT INTO trials (id, slug, title, price_paise, sku)
          VALUES ('adv-neg-price', 'adv-neg-price', 'Negative Price', -100, 'SKU-NEG-P')
        `).run();
      }).toThrow(/CHECK constraint failed: price_paise/);

      expect(() => {
        db.prepare(`
          INSERT INTO trials (id, slug, title, inventory_quantity, sku)
          VALUES ('adv-neg-inv', 'adv-neg-inv', 'Negative Inv', -5, 'SKU-NEG-INV')
        `).run();
      }).toThrow(/CHECK constraint failed: inventory_quantity/);
    });

    it("slug and SKU collisions are strictly prevented at both service and database layers", () => {
      const trial = TrialService.createDraft(
        { slug: "adv-slug-collision", title: "First Kit", sku: "SKU-DUP-1" },
        challengerActor()
      );
      expect(trial.id).toBeDefined();

      // Attempt to create second draft with identical slug -> service throws error
      expect(() => {
        TrialService.createDraft(
          { slug: "adv-slug-collision", title: "Second Kit", sku: "SKU-DUP-2" },
          challengerActor()
        );
      }).toThrow(/already exists/);

      // Direct SQL attempt with duplicate slug -> UNIQUE constraint throws
      expect(() => {
        db.prepare(`
          INSERT INTO trials (id, slug, title, sku, price_paise)
          VALUES ('dup-slug-sql', 'adv-slug-collision', 'SQL Dup', 'SKU-DUP-3', 20000)
        `).run();
      }).toThrow(/UNIQUE constraint failed: trials.slug/);

      // Direct SQL attempt with duplicate SKU -> UNIQUE constraint throws
      expect(() => {
        db.prepare(`
          INSERT INTO trials (id, slug, title, sku, price_paise)
          VALUES ('dup-sku-sql', 'adv-other-slug', 'SQL Dup SKU', 'SKU-DUP-1', 20000)
        `).run();
      }).toThrow(/UNIQUE constraint failed: trials.sku/);
    });
  });
});
