import { prepareProofForApproval } from "./private-label-proof-fixture";
/**
 * TeaFloww Private Label Studio — Milestone M1 Adversarial Challenger Test Suite
 * File: tests/unit/private-label-challenger.test.ts
 *
 * EMPIRICAL ADVERSARIAL STRESS HARNESS
 * Agent: private_label_m1_challenger_1
 *
 * Probes and rigorously stress-tests:
 * 1. Compare-And-Swap (CAS) Concurrency Stress (multi-caller collision, 409 conflict, -32009 error)
 * 2. Transactional Rollback Integrity (mid-flight failure, zero orphan records in entity or audit tables)
 * 3. 11-point Foreign Key Restrict Integrity (rejection of parent deletions with active dependents)
 * 4. Monotonic Revision Increment Integrity (anti-decrement, anti-jump, strict monotonic progression)
 * 5. Tenant Scoping Anti-Enumeration & Cross-Tenant Intrusion Defense
 * 6. SQL Injection Attack Probing in Filters & Search
 * 7. Schema CHECK Constraints on Money, Status Enums, and Physical Metrics
 * 8. Commercial & Manufacturing Hard Gates (Unpaid orders, missing proofs, expired quotes, disclaimer evasion)
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { rmSync } from "node:fs";
import Database from "better-sqlite3";

const TEST_DB = path.join(tmpdir(), `pl-adversarial-stress-${process.pid}-${Date.now()}.sqlite`);
process.env.DATABASE_PATH = TEST_DB;

import { getDb } from "@/lib/db";
import { PrivateLabelService } from "@/lib/private-label/service";
import {
  PrivateLabelRevisionConflictError,
  PrivateLabelNotFoundError,
  PrivateLabelGateError,
  type AuditActor,
} from "@/lib/private-label/types";

const ACTOR_CUSTOMER_A: AuditActor = {
  actor_type: "customer",
  actor_id: "cust-adv-001",
  actor_email: "alice@adversary-test.com",
};

const ACTOR_CUSTOMER_B: AuditActor = {
  actor_type: "customer",
  actor_id: "cust-adv-002",
  actor_email: "bob@adversary-test.com",
};

const ACTOR_ADMIN: AuditActor = {
  actor_type: "admin",
  actor_id: "admin-adv-001",
  actor_email: "ops@teafloww.com",
};

describe("Milestone M1 Adversarial Challenger Stress Suite", () => {
  beforeAll(() => {
    // Run migrations on isolated test database
    execFileSync(process.execPath, ["scripts/migrate.mjs"], {
      env: { ...process.env, DATABASE_PATH: TEST_DB },
    });

    const db = getDb();
    PrivateLabelService.seedInitialCatalog();

    // Insert genuine customer accounts in base customers table
    db.prepare(`
      INSERT OR IGNORE INTO customers (id, email, name)
      VALUES ('cust-adv-001', 'alice@adversary-test.com', 'Alice Enterprise'),
             ('cust-adv-002', 'bob@adversary-test.com', 'Bob Organics')
    `).run();

    // Insert baseline fallback client for testing fallback mechanisms
    db.prepare(`
      INSERT OR IGNORE INTO pl_clients (id, customer_id, company_name, contact_name, contact_email)
      VALUES ('client_default', 'cust-adv-001', 'Default Client Entity', 'Operations', 'ops@teafloww.com')
    `).run();
  });

  afterAll(() => {
    const db = getDb();
    const integrity = db.pragma("integrity_check") as Array<{ integrity_check: string }>;
    expect(integrity[0]?.integrity_check).toBe("ok");
    db.close();

    for (const suffix of ["", "-shm", "-wal", "-journal"]) {
      try {
        rmSync(TEST_DB + suffix, { force: true });
      } catch {}
    }
  });

  // ==========================================================================
  // Suite 1: Compare-And-Swap (CAS) Concurrency Stress
  // ==========================================================================
  describe("1. CAS Revision Concurrency Stress & Collision", () => {
    it("handles 10 parallel concurrent update attempts with the same expected_revision: exactly 1 succeeds, 9 fail with 409 / -32009", async () => {
      // Create initial project draft at revision 1
      const project = PrivateLabelService.createProjectDraft(
        { title: "Parallel Race Project", target_market: "IN" },
        "cust-adv-001",
        ACTOR_CUSTOMER_A
      );
      expect(project.revision).toBe(1);

      // Launch 10 parallel update promises with expected_revision: 1
      const attempts = Array.from({ length: 10 }, (_, i) => {
        return Promise.resolve().then(() => {
          return PrivateLabelService.updateProjectDraft(
            project.id,
            1, // All 10 competing callers attempt updating revision 1
            { title: `Race Attempt #${i + 1}` },
            ACTOR_CUSTOMER_A,
            "cust-adv-001"
          );
        });
      });

      const settled = await Promise.allSettled(attempts);

      const fulfilled = settled.filter((r) => r.status === "fulfilled");
      const rejected = settled.filter((r) => r.status === "rejected");

      // Invariant: Exactly one must succeed
      expect(fulfilled.length).toBe(1);
      // Invariant: Exactly nine must be rejected
      expect(rejected.length).toBe(9);

      // Verify each rejection is a genuine PrivateLabelRevisionConflictError with HTTP 409 and MCP -32009
      for (const rej of rejected) {
        if (rej.status === "rejected") {
          const err = rej.reason as PrivateLabelRevisionConflictError;
          expect(err).toBeInstanceOf(PrivateLabelRevisionConflictError);
          expect(err.code).toBe("REVISION_CONFLICT");
          expect(err.status).toBe(409);
          expect(err.mcpCode).toBe(-32009);
          expect(err.entity_type).toBe("Project");
          expect(err.entity_id).toBe(project.id);
          expect(err.expected_revision).toBe(1);
          expect(err.current_revision).toBe(2);
        }
      }

      // Verify database state: revision is strictly 2
      const db = getDb();
      const current = db.prepare("SELECT revision, title FROM pl_projects WHERE id = ?").get(project.id) as {
        revision: number;
        title: string;
      };
      expect(current.revision).toBe(2);

      // Verify audit trail: exactly ONE audit record for revision 2 exists
      const audits = db
        .prepare("SELECT * FROM pl_audit WHERE entity_id = ? AND action = 'update_draft'")
        .all(project.id) as Array<{ revision: number }>;
      expect(audits.length).toBe(1);
      expect(audits[0].revision).toBe(2);
    });

    it("executes 25 rapid sequential revisions without lost updates, token drift, or gap", () => {
      const project = PrivateLabelService.createProjectDraft(
        { title: "Sequential March Project", target_market: "IN" },
        "cust-adv-001",
        ACTOR_CUSTOMER_A
      );
      expect(project.revision).toBe(1);

      let currentRev = 1;
      for (let step = 1; step <= 25; step++) {
        const updated = PrivateLabelService.updateProjectDraft(
          project.id,
          currentRev,
          { title: `Sequential Step ${step}`, notes: `Note ${step}` },
          ACTOR_CUSTOMER_A,
          "cust-adv-001"
        );
        currentRev = updated.revision;
        expect(currentRev).toBe(step + 1);
      }

      // Check final state
      expect(currentRev).toBe(26);
      const db = getDb();
      const row = db.prepare("SELECT revision FROM pl_projects WHERE id = ?").get(project.id) as {
        revision: number;
      };
      expect(row.revision).toBe(26);

      // Verify audit trail records all 25 update steps monotonically
      const audits = db
        .prepare("SELECT revision FROM pl_audit WHERE entity_id = ? AND action = 'update_draft' ORDER BY revision ASC")
        .all(project.id) as Array<{ revision: number }>;
      expect(audits.length).toBe(25);
      for (let i = 0; i < 25; i++) {
        expect(audits[i].revision).toBe(i + 2); // revisions 2 through 26
      }
    });

    it("enforces CAS collision on packaging variant catalog updates", () => {
      const created = PrivateLabelService.upsertPackagingVariant(
        {
          family_id: "fam_pouch",
          slug: "test-cas-pouch-100g",
          sku: "TEST-CAS-P-100",
          title: "CAS Test Pouch 100g",
          material: "Kraft Paper / Bio Foil",
          finish: "Matte",
          closure_type: "Zip Lock",
          capacity_description: "100g whole leaf",
          net_weight_capacity_grams: 100,
          width_mm: 120,
          height_mm: 200,
          label_safe_width_mm: 90,
          label_safe_height_mm: 140,
          supplier_name: "EcoPack India",
          unit_cost_paise: 1800,
        },
        ACTOR_ADMIN
      );
      expect(created.revision).toBe(1);

      // Competing update 1 succeeds
      const v2 = PrivateLabelService.upsertPackagingVariant(
        {
          id: created.id,
          family_id: created.family_id,
          slug: created.slug,
          sku: created.sku,
          title: "CAS Test Pouch 100g Updated",
          material: created.material,
          finish: created.finish,
          closure_type: created.closure_type,
          capacity_description: created.capacity_description,
          net_weight_capacity_grams: created.net_weight_capacity_grams,
          width_mm: created.width_mm,
          height_mm: created.height_mm,
          label_safe_width_mm: created.label_safe_width_mm,
          label_safe_height_mm: created.label_safe_height_mm,
          supplier_name: created.supplier_name,
          unit_cost_paise: 1950,
        },
        ACTOR_ADMIN,
        1 // expected_revision: 1
      );
      expect(v2.revision).toBe(2);

      // Competing update 2 with stale revision 1 must throw 409
      expect(() => {
        PrivateLabelService.upsertPackagingVariant(
          {
            id: created.id,
            family_id: created.family_id,
            slug: created.slug,
            sku: created.sku,
            title: "Stale Overwrite Attempt",
            material: created.material,
            finish: created.finish,
            closure_type: created.closure_type,
            capacity_description: created.capacity_description,
            net_weight_capacity_grams: created.net_weight_capacity_grams,
            width_mm: created.width_mm,
            height_mm: created.height_mm,
            label_safe_width_mm: created.label_safe_width_mm,
            label_safe_height_mm: created.label_safe_height_mm,
            supplier_name: created.supplier_name,
            unit_cost_paise: 2000,
          },
          ACTOR_ADMIN,
          1 // Stale revision!
        );
      }).toThrow(PrivateLabelRevisionConflictError);
    });

    it("enforces CAS collision on quote acceptance", () => {
      const project = PrivateLabelService.createProjectDraft(
        { title: "Quote CAS Project", target_market: "IN" },
        "cust-adv-001",
        ACTOR_CUSTOMER_A
      );

      const quote = PrivateLabelService.createQuote(
        project.id,
        { price_book_id: "pb_default_inr", validity_days: 14 },
        ACTOR_CUSTOMER_A,
        "cust-adv-001"
      );
      expect(quote.revision).toBe(1);

      // Client A accepts quote with revision 1
      const accepted = PrivateLabelService.acceptQuote(
        quote.id,
        1,
        { acceptance_notes: "Accepted" },
        ACTOR_CUSTOMER_A,
        "cust-adv-001"
      );
      expect(accepted.quote.status).toBe("customer_accepted");
      expect(accepted.quote.revision).toBe(2);

      // Second competing acceptance with expected_revision: 1 must fail with 409 / -32009
      expect(() => {
        PrivateLabelService.acceptQuote(
          quote.id,
          1, // Stale!
          { acceptance_notes: "Double accept attempt" },
          ACTOR_CUSTOMER_A,
          "cust-adv-001"
        );
      }).toThrow(PrivateLabelRevisionConflictError);
    });
  });

  // ==========================================================================
  // Suite 2: Transactional Rollback & Zero Orphan Guarantee
  // ==========================================================================
  describe("2. Transactional Rollback Integrity", () => {
    it("completely rolls back and leaves zero orphan records if quote acceptance fails mid-flight", () => {
      const project = PrivateLabelService.createProjectDraft(
        { title: "Rollback Quote Project", target_market: "IN" },
        "cust-adv-001",
        ACTOR_CUSTOMER_A
      );

      const quote = PrivateLabelService.createQuote(
        project.id,
        { price_book_id: "pb_default_inr", validity_days: 14 },
        ACTOR_CUSTOMER_A,
        "cust-adv-001"
      );
      expect(quote.status).toBe("draft");
      expect(quote.revision).toBe(1);

      const db = getDb();
      const initialOrdersCount = (db.prepare("SELECT count(*) as c FROM pl_orders").get() as { c: number }).c;
      const initialAuditsCount = (db.prepare("SELECT count(*) as c FROM pl_audit WHERE entity_id = ?").get(quote.id) as { c: number }).c;

      // Adversarially inject an invalid foreign key for client_id in acceptQuote
      // This will cause the INSERT INTO pl_orders to fail with SQLITE_CONSTRAINT_FOREIGNKEY
      // after the UPDATE pl_quotes has already executed in memory!
      expect(() => {
        PrivateLabelService.acceptQuote(
          quote.id,
          1,
          { clientId: "non_existent_client_fk_uuid_9999" }, // Triggers foreign key failure!
          ACTOR_CUSTOMER_A,
          "cust-adv-001"
        );
      }).toThrow();

      // VERIFY COMPLETE ROLLBACK:
      // 1. Quote status must STILL be 'draft'
      const quoteAfter = db.prepare("SELECT status, revision FROM pl_quotes WHERE id = ?").get(quote.id) as {
        status: string;
        revision: number;
      };
      expect(quoteAfter.status).toBe("draft");
      expect(quoteAfter.revision).toBe(1);

      // 2. Zero orphan orders were inserted
      const ordersCountAfter = (db.prepare("SELECT count(*) as c FROM pl_orders").get() as { c: number }).c;
      expect(ordersCountAfter).toBe(initialOrdersCount);

      // 3. Zero orphan audit records were committed
      const auditsCountAfter = (db.prepare("SELECT count(*) as c FROM pl_audit WHERE entity_id = ?").get(quote.id) as { c: number }).c;
      expect(auditsCountAfter).toBe(initialAuditsCount);
    });

    it("completely rolls back production job release if any QC milestone insert fails", () => {
      const db = getDb();

      // Provision order ready for production release
      const project = PrivateLabelService.createProjectDraft(
        { title: "Job Rollback Project", target_market: "IN" },
        "cust-adv-001",
        ACTOR_CUSTOMER_A
      );

      // Get project's provisioned client
      const projRow = db.prepare("SELECT client_id FROM pl_projects WHERE id = ?").get(project.id) as { client_id: string };
      const clientId = projRow.client_id;

      // Create design version and approved proof event
      const itemRowId = `pitem_roll_${Date.now()}`;
      db.prepare(`
        INSERT INTO pl_project_items (id, project_id, fill_weight_grams, quantity_units, color_count)
        VALUES (?, ?, 100, 1000, 4)
      `).run(itemRowId, project.id);

      const desVer = PrivateLabelService.createDesignVersion(
        itemRowId,
        { scene_json: { dieline: "pouch" } },
        ACTOR_CUSTOMER_A
      );

      PrivateLabelService.approveProof(prepareProofForApproval(desVer.id),
        { actor_name: "Alice", legal_disclaimer_accepted: true },
        ACTOR_CUSTOMER_A,
        "cust-adv-001"
      );

      const quote = PrivateLabelService.createQuote(
        project.id,
        { price_book_id: "pb_default_inr" },
        ACTOR_CUSTOMER_A,
        "cust-adv-001"
      );

      // Create order with deposit_paid
      const orderId = `order_roll_${Date.now()}`;
      db.prepare(`
        INSERT INTO pl_orders (id, order_number, client_id, quote_id, status, deposit_paise, balance_paise)
        VALUES (?, 'PL-ORD-ROLLBACK', ?, ?, 'deposit_paid', 500000, 500000)
      `).run(orderId, clientId, quote.id);

      const initialJobsCount = (db.prepare("SELECT count(*) as c FROM pl_jobs").get() as { c: number }).c;
      const initialQcCount = (db.prepare("SELECT count(*) as c FROM pl_qc_milestones").get() as { c: number }).c;

      // Temporarily install an adversarial trigger that simulates mid-flight failure at milestone stage 'sensory_cupping'
      db.exec(`
        CREATE TRIGGER IF NOT EXISTS trg_adversarial_qc_crash
        BEFORE INSERT ON pl_qc_milestones
        WHEN NEW.stage = 'sensory_cupping'
        BEGIN
          SELECT RAISE(ABORT, 'Simulated mid-flight cleanroom failure during sensory cupping milestone');
        END;
      `);

      try {
        expect(() => {
          PrivateLabelService.releaseProductionJob(
            orderId,
            { operator_notes: "Adversarial test run" },
            ACTOR_ADMIN
          );
        }).toThrow(/Simulated mid-flight cleanroom failure/);

        // VERIFY COMPLETE ROLLBACK:
        // 1. Order status must still be 'deposit_paid' (NOT 'production_released')
        const orderAfter = db.prepare("SELECT status FROM pl_orders WHERE id = ?").get(orderId) as { status: string };
        expect(orderAfter.status).toBe("deposit_paid");

        // 2. Zero jobs created
        const jobsCountAfter = (db.prepare("SELECT count(*) as c FROM pl_jobs").get() as { c: number }).c;
        expect(jobsCountAfter).toBe(initialJobsCount);

        // 3. Zero milestones created (even the 5 stages that preceded sensory_cupping must be rolled back!)
        const qcCountAfter = (db.prepare("SELECT count(*) as c FROM pl_qc_milestones").get() as { c: number }).c;
        expect(qcCountAfter).toBe(initialQcCount);

        // 4. Zero orphan audit entries for production_job
        const auditJobs = db.prepare("SELECT count(*) as c FROM pl_audit WHERE entity_type = 'production_job'").get() as { c: number };
        expect(auditJobs.c).toBe(0);
      } finally {
        // Clean up adversarial trigger
        db.exec("DROP TRIGGER IF EXISTS trg_adversarial_qc_crash;");
      }
    });

    it("rolls back atomic project draft mutations if custom audit trigger throws", () => {
      const db = getDb();
      const project = PrivateLabelService.createProjectDraft(
        { title: "Original Uncorrupted Title", target_market: "IN" },
        "cust-adv-001",
        ACTOR_CUSTOMER_A
      );
      expect(project.revision).toBe(1);

      // Adversarially inject a trigger that fails on action = 'fail_test_action'
      db.exec(`
        CREATE TRIGGER IF NOT EXISTS trg_adversarial_audit_fail
        BEFORE INSERT ON pl_audit
        WHEN NEW.diff_json LIKE '%CRASH_AUDIT%'
        BEGIN
          SELECT RAISE(ABORT, 'Simulated audit storage hardware fault');
        END;
      `);

      try {
        expect(() => {
          PrivateLabelService.updateProjectDraft(
            project.id,
            1,
            { title: "Corrupted Title", notes: "CRASH_AUDIT" },
            ACTOR_CUSTOMER_A,
            "cust-adv-001"
          );
        }).toThrow(/Simulated audit storage hardware fault/);

        // Verify title was NOT updated and revision was NOT bumped
        const reverted = db.prepare("SELECT title, revision FROM pl_projects WHERE id = ?").get(project.id) as {
          title: string;
          revision: number;
        };
        expect(reverted.title).toBe("Original Uncorrupted Title");
        expect(reverted.revision).toBe(1);
      } finally {
        db.exec("DROP TRIGGER IF EXISTS trg_adversarial_audit_fail;");
      }
    });
  });

  // ==========================================================================
  // Suite 3: Foreign Key Restrict Integrity (11 Critical Foreign Keys)
  // ==========================================================================
  describe("3. Foreign Key Restrict Integrity", () => {
    it("1. prevents deleting a parent project that has an active commercial quote", () => {
      const db = getDb();
      const project = PrivateLabelService.createProjectDraft(
        { title: "Parent Project FK1", target_market: "IN" },
        "cust-adv-001",
        ACTOR_CUSTOMER_A
      );
      PrivateLabelService.createQuote(project.id, {}, ACTOR_CUSTOMER_A, "cust-adv-001");

      expect(() => {
        db.prepare("DELETE FROM pl_projects WHERE id = ?").run(project.id);
      }).toThrow(/FOREIGN KEY constraint failed/);

      // Verify project was NOT deleted
      const check = db.prepare("SELECT id FROM pl_projects WHERE id = ?").get(project.id);
      expect(check).toBeDefined();
    });

    it("2. prevents deleting a parent quote that has an active production order", () => {
      const db = getDb();
      const project = PrivateLabelService.createProjectDraft(
        { title: "Parent Project FK2", target_market: "IN" },
        "cust-adv-001",
        ACTOR_CUSTOMER_A
      );
      const quote = PrivateLabelService.createQuote(project.id, {}, ACTOR_CUSTOMER_A, "cust-adv-001");
      PrivateLabelService.acceptQuote(quote.id, 1, {}, ACTOR_CUSTOMER_A, "cust-adv-001");

      expect(() => {
        db.prepare("DELETE FROM pl_quotes WHERE id = ?").run(quote.id);
      }).toThrow(/FOREIGN KEY constraint failed/);

      const check = db.prepare("SELECT id FROM pl_quotes WHERE id = ?").get(quote.id);
      expect(check).toBeDefined();
    });

    it("3. prevents deleting a packaging family that has linked variants", () => {
      const db = getDb();
      // fam_pouch has test variants
      expect(() => {
        db.prepare("DELETE FROM pl_packaging_families WHERE code = 'pouch'").run();
      }).toThrow(/FOREIGN KEY constraint failed/);
    });

    it("4. prevents deleting a packaging variant linked to active project items", () => {
      const db = getDb();
      const project = PrivateLabelService.createProjectDraft(
        { title: "Variant Ref Project", target_market: "IN" },
        "cust-adv-001",
        ACTOR_CUSTOMER_A
      );

      const pack = db.prepare("SELECT id FROM pl_packaging_variants LIMIT 1").get() as { id: string };
      const itemId = `item_p_${Date.now()}`;
      db.prepare(`
        INSERT INTO pl_project_items (id, project_id, packaging_variant_id, fill_weight_grams, quantity_units)
        VALUES (?, ?, ?, 100, 500)
      `).run(itemId, project.id, pack.id);

      expect(() => {
        db.prepare("DELETE FROM pl_packaging_variants WHERE id = ?").run(pack.id);
      }).toThrow(/FOREIGN KEY constraint failed/);
    });

    it("5. prevents deleting a tea option linked to active project items", () => {
      const db = getDb();
      const project = PrivateLabelService.createProjectDraft(
        { title: "Tea Ref Project", target_market: "IN" },
        "cust-adv-001",
        ACTOR_CUSTOMER_A
      );

      const tea = PrivateLabelService.upsertTeaOption(
        {
          slug: "fk-test-tea-option",
          name: "FK Test Tea",
          origin_estate: "Gopaldhara",
          region: "Darjeeling",
          grade: "FTGFOP1",
          flush: "First Flush",
          tea_category: "black",
          description: "FK test description",
          caffeine_level: "medium",
          base_cost_per_kg_paise: 450000,
        },
        ACTOR_ADMIN
      );

      const itemId = `item_t_${Date.now()}`;
      db.prepare(`
        INSERT INTO pl_project_items (id, project_id, tea_option_id, fill_weight_grams, quantity_units)
        VALUES (?, ?, ?, 100, 500)
      `).run(itemId, project.id, tea.id);

      expect(() => {
        db.prepare("DELETE FROM pl_tea_options WHERE id = ?").run(tea.id);
      }).toThrow(/FOREIGN KEY constraint failed/);
    });

    it("6. prevents deleting a print method linked to active project items", () => {
      const db = getDb();
      const project = PrivateLabelService.createProjectDraft(
        { title: "Print Ref Project", target_market: "IN" },
        "cust-adv-001",
        ACTOR_CUSTOMER_A
      );

      const pm = db.prepare("SELECT id FROM pl_print_methods LIMIT 1").get() as { id: string };
      const itemId = `item_pm_${Date.now()}`;
      db.prepare(`
        INSERT INTO pl_project_items (id, project_id, print_method_id, fill_weight_grams, quantity_units)
        VALUES (?, ?, ?, 100, 500)
      `).run(itemId, project.id, pm.id);

      expect(() => {
        db.prepare("DELETE FROM pl_print_methods WHERE id = ?").run(pm.id);
      }).toThrow(/FOREIGN KEY constraint failed/);
    });

    it("7. prevents deleting a price book linked to active commercial quotes", () => {
      const db = getDb();
      const project = PrivateLabelService.createProjectDraft(
        { title: "PB Ref Project", target_market: "IN" },
        "cust-adv-001",
        ACTOR_CUSTOMER_A
      );
      const quote = PrivateLabelService.createQuote(project.id, { price_book_id: "pb_default_inr" }, ACTOR_CUSTOMER_A, "cust-adv-001");

      expect(() => {
        db.prepare("DELETE FROM pl_price_books WHERE id = 'pb_default_inr'").run();
      }).toThrow(/FOREIGN KEY constraint failed/);
    });

    it("8. prevents deleting a client with active production orders", () => {
      const db = getDb();
      const project = PrivateLabelService.createProjectDraft(
        { title: "Client Ref Project", target_market: "IN" },
        "cust-adv-001",
        ACTOR_CUSTOMER_A
      );
      const quote = PrivateLabelService.createQuote(project.id, {}, ACTOR_CUSTOMER_A, "cust-adv-001");
      const accepted = PrivateLabelService.acceptQuote(quote.id, 1, {}, ACTOR_CUSTOMER_A, "cust-adv-001");

      const orderRow = db.prepare("SELECT client_id FROM pl_orders WHERE id = ?").get(accepted.orderId) as { client_id: string };

      expect(() => {
        db.prepare("DELETE FROM pl_clients WHERE id = ?").run(orderRow.client_id);
      }).toThrow(/FOREIGN KEY constraint failed/);
    });

    it("9. prevents deleting a design version with an active proof approval event", () => {
      const db = getDb();
      const project = PrivateLabelService.createProjectDraft(
        { title: "Design Version Ref", target_market: "IN" },
        "cust-adv-001",
        ACTOR_CUSTOMER_A
      );
      const itemRowId = `pitem_dv_${Date.now()}`;
      db.prepare(`
        INSERT INTO pl_project_items (id, project_id, fill_weight_grams, quantity_units)
        VALUES (?, ?, 100, 500)
      `).run(itemRowId, project.id);

      const desVer = PrivateLabelService.createDesignVersion(
        itemRowId,
        { scene_json: {} },
        ACTOR_CUSTOMER_A
      );

      PrivateLabelService.approveProof(prepareProofForApproval(desVer.id),
        { actor_name: "Alice", legal_disclaimer_accepted: true },
        ACTOR_CUSTOMER_A,
        "cust-adv-001"
      );

      expect(() => {
        db.prepare("DELETE FROM pl_design_versions WHERE id = ?").run(desVer.id);
      }).toThrow(/FOREIGN KEY constraint failed/);
    });

    it("10. prevents deleting a project item linked to quote items", () => {
      const db = getDb();
      const project = PrivateLabelService.createProjectDraft(
        { title: "Quote Item Ref", target_market: "IN" },
        "cust-adv-001",
        ACTOR_CUSTOMER_A
      );
      const itemId = `item_qi_${Date.now()}`;
      db.prepare(`
        INSERT INTO pl_project_items (id, project_id, fill_weight_grams, quantity_units)
        VALUES (?, ?, 100, 500)
      `).run(itemId, project.id);

      const quote = PrivateLabelService.createQuote(project.id, {}, ACTOR_CUSTOMER_A, "cust-adv-001");
      db.prepare(`
        INSERT INTO pl_quote_items (id, quote_id, project_item_id, description, quantity, unit_price_paise, line_total_paise)
        VALUES ('qi_test_01', ?, ?, 'Test item', 500, 1500, 750000)
      `).run(quote.id, itemId);

      expect(() => {
        db.prepare("DELETE FROM pl_project_items WHERE id = ?").run(itemId);
      }).toThrow(/FOREIGN KEY constraint failed/);
    });

    it("11. prevents deleting a client with recorded legal proof approval events", () => {
      const db = getDb();
      const approval = db.prepare("SELECT client_id FROM pl_approval_events LIMIT 1").get() as { client_id: string } | undefined;
      if (approval) {
        expect(() => {
          db.prepare("DELETE FROM pl_clients WHERE id = ?").run(approval.client_id);
        }).toThrow(/FOREIGN KEY constraint failed/);
      }
    });
  });

  // ==========================================================================
  // Suite 4: Monotonic Revision Increment Integrity
  // ==========================================================================
  describe("4. Revision Monotonicity & Anti-Tampering", () => {
    it("rejects negative and zero revisions at the SQLite schema level (CHECK revision >= 1)", () => {
      const db = getDb();
      const project = PrivateLabelService.createProjectDraft(
        { title: "Schema Check Revision", target_market: "IN" },
        "cust-adv-001",
        ACTOR_CUSTOMER_A
      );

      // Attempt setting revision = 0 via raw SQL
      expect(() => {
        db.prepare("UPDATE pl_projects SET revision = 0 WHERE id = ?").run(project.id);
      }).toThrow(/CHECK constraint failed/);

      // Attempt setting revision = -5 via raw SQL
      expect(() => {
        db.prepare("UPDATE pl_projects SET revision = -5 WHERE id = ?").run(project.id);
      }).toThrow(/CHECK constraint failed/);

      // Attempt inserting entity with revision = 0
      expect(() => {
        db.prepare(`
          INSERT INTO pl_projects (id, title, status, revision)
          VALUES ('proj_neg_rev', 'Negative Revision Probe', 'draft', 0)
        `).run();
      }).toThrow(/CHECK constraint failed/);
    });

    it("rejects arbitrary upward revision jumping (e.g. attempting to jump from 1 to 10)", () => {
      const project = PrivateLabelService.createProjectDraft(
        { title: "Anti Jump Project", target_market: "IN" },
        "cust-adv-001",
        ACTOR_CUSTOMER_A
      );
      expect(project.revision).toBe(1);

      // Caller attempts to jump revision to 10 by claiming expected_revision: 9
      expect(() => {
        PrivateLabelService.updateProjectDraft(
          project.id,
          9, // Current is 1!
          { title: "Jump Attempt" },
          ACTOR_CUSTOMER_A,
          "cust-adv-001"
        );
      }).toThrow(PrivateLabelRevisionConflictError);

      try {
        PrivateLabelService.updateProjectDraft(
          project.id,
          9,
          { title: "Jump Attempt" },
          ACTOR_CUSTOMER_A,
          "cust-adv-001"
        );
      } catch (e) {
        const err = e as PrivateLabelRevisionConflictError;
        expect(err.current_revision).toBe(1);
        expect(err.expected_revision).toBe(9);
      }
    });

    it("rejects downward revision tampering (e.g. attempting expected_revision: 0 or past revision)", () => {
      const project = PrivateLabelService.createProjectDraft(
        { title: "Anti Decrement Project", target_market: "IN" },
        "cust-adv-001",
        ACTOR_CUSTOMER_A
      );
      // Advance to revision 3
      PrivateLabelService.updateProjectDraft(project.id, 1, { title: "V2" }, ACTOR_CUSTOMER_A, "cust-adv-001");
      PrivateLabelService.updateProjectDraft(project.id, 2, { title: "V3" }, ACTOR_CUSTOMER_A, "cust-adv-001");

      // Attempt to decrement or supply stale expected_revision: 1
      expect(() => {
        PrivateLabelService.updateProjectDraft(
          project.id,
          1,
          { title: "Rewind Attempt" },
          ACTOR_CUSTOMER_A,
          "cust-adv-001"
        );
      }).toThrow(PrivateLabelRevisionConflictError);

      // Attempt expected_revision: 0
      expect(() => {
        PrivateLabelService.updateProjectDraft(
          project.id,
          0,
          { title: "Zero Attempt" },
          ACTOR_CUSTOMER_A,
          "cust-adv-001"
        );
      }).toThrow(PrivateLabelRevisionConflictError);
    });
  });

  // ==========================================================================
  // Suite 5: Tenant Isolation & Anti-Enumeration Security
  // ==========================================================================
  describe("5. Tenant Isolation & Anti-Enumeration Posture", () => {
    it("returns 404 (NOT 403) when Customer B probes Customer A's project ID, concealing entity existence", () => {
      const projA = PrivateLabelService.createProjectDraft(
        { title: "Alice Confidential Tea Project", target_market: "IN" },
        "cust-adv-001", // Customer A
        ACTOR_CUSTOMER_A
      );

      // Customer B probes Customer A's project
      expect(() => {
        PrivateLabelService.getProject(projA.id, "cust-adv-002");
      }).toThrow(PrivateLabelNotFoundError);

      try {
        PrivateLabelService.getProject(projA.id, "cust-adv-002");
      } catch (e) {
        const err = e as PrivateLabelNotFoundError;
        expect(err.code).toBe("NOT_FOUND");
        expect(err.status).toBe(404);
        expect(err.mcpCode).toBe(-32004);
      }
    });

    it("blocks Customer B from mutating Customer A's project via updateProjectDraft with 404 anti-enumeration", () => {
      const projA = PrivateLabelService.createProjectDraft(
        { title: "Alice Confidential Mutate Target", target_market: "IN" },
        "cust-adv-001",
        ACTOR_CUSTOMER_A
      );

      expect(() => {
        PrivateLabelService.updateProjectDraft(
          projA.id,
          1,
          { title: "Bob Hostile Takeover" },
          ACTOR_CUSTOMER_B,
          "cust-adv-002" // Customer B
        );
      }).toThrow(PrivateLabelNotFoundError);

      // Verify title was not changed
      const db = getDb();
      const current = db.prepare("SELECT title FROM pl_projects WHERE id = ?").get(projA.id) as { title: string };
      expect(current.title).toBe("Alice Confidential Mutate Target");
    });

    it("blocks Customer B from reading or accepting Customer A's commercial quote with 404 anti-enumeration", () => {
      const projA = PrivateLabelService.createProjectDraft(
        { title: "Alice Commercial Target", target_market: "IN" },
        "cust-adv-001",
        ACTOR_CUSTOMER_A
      );
      const quoteA = PrivateLabelService.createQuote(projA.id, {}, ACTOR_CUSTOMER_A, "cust-adv-001");

      // Customer B inspects quote
      expect(() => {
        PrivateLabelService.getQuote(quoteA.id, "cust-adv-002");
      }).toThrow(PrivateLabelNotFoundError);

      // Customer B accepts quote
      expect(() => {
        PrivateLabelService.acceptQuote(quoteA.id, 1, {}, ACTOR_CUSTOMER_B, "cust-adv-002");
      }).toThrow(PrivateLabelNotFoundError);
    });

    it("permits Admin actor to inspect and manage projects across all tenants with full audit trail", () => {
      const projA = PrivateLabelService.createProjectDraft(
        { title: "Alice Admin Inspected Project", target_market: "IN" },
        "cust-adv-001",
        ACTOR_CUSTOMER_A
      );

      // Admin accesses without customerId restriction
      const adminView = PrivateLabelService.getProject(projA.id);
      expect(adminView.id).toBe(projA.id);
      expect(adminView.title).toBe("Alice Admin Inspected Project");
    });
  });

  // ==========================================================================
  // Suite 6: SQL Injection Attack Probing in Filters & Search
  // ==========================================================================
  describe("6. SQL Injection Probing on Parameterized Queries", () => {
    it("safely neutralizes classic SQL injection in packaging catalog search", () => {
      const db = getDb();
      const initialCount = (db.prepare("SELECT count(*) as c FROM pl_audit").get() as { c: number }).c;

      // Hostile search payload attempting table drop and tautology
      const hostileSearch = "'; DROP TABLE pl_audit; --";
      const result = PrivateLabelService.listPackaging({ search: hostileSearch });

      expect(result.items.length).toBe(0);
      expect(result.total).toBe(0);

      // Verify pl_audit was NOT dropped or modified
      const auditCountAfter = (db.prepare("SELECT count(*) as c FROM pl_audit").get() as { c: number }).c;
      expect(auditCountAfter).toBe(initialCount);
    });

    it("safely neutralizes SQL injection in packaging family code filter", () => {
      const hostileFamily = "pouch' OR '1'='1";
      const result = PrivateLabelService.listPackaging({ familyCode: hostileFamily });

      expect(result.items.length).toBe(0);
      expect(result.total).toBe(0);
    });

    it("safely neutralizes SQL injection in tea options search", () => {
      const db = getDb();
      const initialTeas = (db.prepare("SELECT count(*) as c FROM pl_tea_options").get() as { c: number }).c;

      const hostileSearch = "' UNION SELECT id, slug, name, origin_estate, region, grade, flush, tea_category, description, caffeine_level, base_cost_per_kg_paise, min_batch_kg, tasting_notes_json, regular_product_id, is_published, sample_available, revision, created_at, updated_at FROM pl_tea_options WHERE '1'='1";
      const result = PrivateLabelService.listTeaOptions({ search: hostileSearch });

      // Clean execution via parameterized LIKE '%...%' without SQL syntax error
      const teasCountAfter = (db.prepare("SELECT count(*) as c FROM pl_tea_options").get() as { c: number }).c;
      expect(teasCountAfter).toBe(initialTeas);
    });
  });

  // ==========================================================================
  // Suite 7: Schema CHECK Constraints Enforcement
  // ==========================================================================
  describe("7. SQLite CHECK Constraints Enforcement", () => {
    it("rejects invalid status enum on pl_projects", () => {
      const db = getDb();
      expect(() => {
        db.prepare(`
          INSERT INTO pl_projects (id, title, status)
          VALUES ('proj_bad_status', 'Bad Status Probe', 'hacked_status')
        `).run();
      }).toThrow(/CHECK constraint failed/);
    });

    it("rejects invalid tea_category on pl_tea_options", () => {
      const db = getDb();
      expect(() => {
        db.prepare(`
          INSERT INTO pl_tea_options (
            id, slug, name, origin_estate, region, grade, flush,
            tea_category, description, caffeine_level, base_cost_per_kg_paise
          ) VALUES (
            'tea_bad_cat', 'bad-cat-tea', 'Bad Cat', 'Estate', 'Region', 'TGFOP', 'Flush',
            'fizzy_beverage', 'Desc', 'medium', 100000
          )
        `).run();
      }).toThrow(/CHECK constraint failed/);
    });

    it("rejects negative money in base_cost_per_kg_paise", () => {
      const db = getDb();
      expect(() => {
        db.prepare(`
          INSERT INTO pl_tea_options (
            id, slug, name, origin_estate, region, grade, flush,
            tea_category, description, caffeine_level, base_cost_per_kg_paise
          ) VALUES (
            'tea_neg_money', 'neg-money-tea', 'Neg Money', 'Estate', 'Region', 'TGFOP', 'Flush',
            'black', 'Desc', 'medium', -500
          )
        `).run();
      }).toThrow(/CHECK constraint failed/);
    });

    it("rejects zero or negative dimensions on packaging variants", () => {
      const db = getDb();
      expect(() => {
        db.prepare(`
          INSERT INTO pl_packaging_variants (
            id, family_id, slug, sku, title, material, finish, closure_type,
            capacity_description, net_weight_capacity_grams, width_mm, height_mm,
            label_safe_width_mm, label_safe_height_mm, supplier_name, unit_cost_paise
          ) VALUES (
            'pack_bad_dim', 'fam_pouch', 'bad-dim-pack', 'BAD-DIM-SKU', 'Bad Dim', 'Pouch', 'Matte', 'Zip',
            '100g', 100, -10, 200, 50, 50, 'Supplier', 1000
          )
        `).run();
      }).toThrow(/CHECK constraint failed/);
    });

    it("rejects invalid MIME type on artwork assets", () => {
      const db = getDb();
      expect(() => {
        db.prepare(`
          INSERT INTO pl_artwork_assets (
            id, client_id, original_filename, file_size_bytes, mime_type, storage_key, file_sha256
          ) VALUES (
            'art_bad_mime', 'client_default', 'malicious.exe', 1024,
            'application/x-msdos-program', 'storage_key_malicious', 'dummyhash'
          )
        `).run();
      }).toThrow(/CHECK constraint failed/);
    });

    it("rejects invalid actor_type on audit records", () => {
      const db = getDb();
      expect(() => {
        db.prepare(`
          INSERT INTO pl_audit (
            id, entity_type, entity_id, revision, action, actor_type, actor_id
          ) VALUES (
            'audit_bad_actor', 'project', 'proj_01', 1, 'update', 'unauthorized_hacker', 'anon'
          )
        `).run();
      }).toThrow(/CHECK constraint failed/);
    });
  });

  // ==========================================================================
  // Suite 8: Commercial & Manufacturing Hard Business Gates
  // ==========================================================================
  describe("8. Commercial & Manufacturing Hard Gates", () => {
    it("blocks production job release when order status is pending_deposit (throws PrivateLabelGateError)", () => {
      const db = getDb();
      const project = PrivateLabelService.createProjectDraft(
        { title: "Gate Project Unpaid", target_market: "IN" },
        "cust-adv-001",
        ACTOR_CUSTOMER_A
      );
      const quote = PrivateLabelService.createQuote(project.id, {}, ACTOR_CUSTOMER_A, "cust-adv-001");
      const orderId = `ord_gate_unpaid_${Date.now()}`;
      db.prepare(`
        INSERT INTO pl_orders (id, order_number, client_id, quote_id, status, deposit_paise, balance_paise)
        VALUES (?, 'PL-ORD-UNPAID', 'client_default', ?, 'pending_deposit', 500000, 500000)
      `).run(orderId, quote.id);

      expect(() => {
        PrivateLabelService.releaseProductionJob(orderId, {}, ACTOR_ADMIN);
      }).toThrow(PrivateLabelGateError);

      try {
        PrivateLabelService.releaseProductionJob(orderId, {}, ACTOR_ADMIN);
      } catch (e) {
        const err = e as PrivateLabelGateError;
        expect(err.code).toBe("GATE_FAILED");
        expect(err.status).toBe(422);
        expect(err.mcpCode).toBe(-32009);
        expect(err.gate_name).toBe("production_release");
        expect(err.blockers.some((b) => b.includes("deposit_paid"))).toBe(true);
      }
    });

    it("correctly blocks production job release when pl_approval_events is completely empty", () => {
      const db = getDb();
      // Temporarily stash approval events
      const savedApprovals = db.prepare("SELECT * FROM pl_approval_events").all();
      db.prepare("DELETE FROM pl_approval_events").run();

      try {
        const project = PrivateLabelService.createProjectDraft(
          { title: "Gate Project Truly No Proof", target_market: "IN" },
          "cust-adv-001",
          ACTOR_CUSTOMER_A
        );
        const quote = PrivateLabelService.createQuote(project.id, {}, ACTOR_CUSTOMER_A, "cust-adv-001");

        const orderId = `ord_gate_truly_noproof_${Date.now()}`;
        db.prepare(`
          INSERT INTO pl_orders (id, order_number, client_id, quote_id, status, deposit_paise, balance_paise)
          VALUES (?, 'PL-ORD-TRULY-NOPROOF', 'client_default', ?, 'deposit_paid', 500000, 500000)
        `).run(orderId, quote.id);

        expect(() => {
          PrivateLabelService.releaseProductionJob(orderId, {}, ACTOR_ADMIN);
        }).toThrow(PrivateLabelGateError);

        try {
          PrivateLabelService.releaseProductionJob(orderId, {}, ACTOR_ADMIN);
        } catch (e) {
          const err = e as PrivateLabelGateError;
          expect(err.gate_name).toBe("production_release");
          expect(err.blockers.some((b) => b.includes("Artwork proof approval is required"))).toBe(true);
        }
      } finally {
        for (const ev of savedApprovals as any[]) {
          db.prepare(`
            INSERT INTO pl_approval_events (id, design_version_id, client_id, actor_type, actor_id, actor_name, action, legal_disclaimer_accepted)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(ev.id, ev.design_version_id, ev.client_id, ev.actor_type, ev.actor_id, ev.actor_name, ev.action, ev.legal_disclaimer_accepted);
        }
      }
    });

    it("REMEDIATED: releaseProductionJob strictly blocks unapproved orders even when unrelated approvals exist in pl_approval_events", () => {
      const db = getDb();

      // Ensure at least one approval event exists from another project
      const existingApprovals = db.prepare("SELECT count(*) as c FROM pl_approval_events WHERE action = 'customer_approved'").get() as { c: number };
      expect(existingApprovals.c).toBeGreaterThan(0);

      // Create a brand new project and quote with NO artwork, NO design version, and NO approval
      const newProject = PrivateLabelService.createProjectDraft(
        { title: "Completely Unapproved Order", target_market: "IN" },
        "cust-adv-002",
        ACTOR_CUSTOMER_B
      );
      const newQuote = PrivateLabelService.createQuote(newProject.id, {}, ACTOR_CUSTOMER_B, "cust-adv-002");

      const unapprovedOrderId = `ord_leak_${Date.now()}`;
      db.prepare(`
        INSERT INTO pl_orders (id, order_number, client_id, quote_id, status, deposit_paise, balance_paise)
        VALUES (?, 'PL-ORD-LEAK', 'client_default', ?, 'deposit_paid', 500000, 500000)
      `).run(unapprovedOrderId, newQuote.id);

      // REMEDIATED: The gate query properly joins pl_design_versions and pl_project_items to pl_quotes,
      // so unrelated approval events do NOT leak, and unapproved orders are strictly blocked.
      expect(() => {
        PrivateLabelService.releaseProductionJob(unapprovedOrderId, {}, ACTOR_ADMIN);
      }).toThrowError(PrivateLabelGateError);

      const gate = PrivateLabelService.validateReleaseGate(unapprovedOrderId);
      expect(gate.eligible).toBe(false);
      expect(gate.blockers).toContain(
        "Artwork proof approval is required prior to releasing order to production"
      );
    });

    it("blocks proof approval if legal_disclaimer_accepted is false", () => {
      const project = PrivateLabelService.createProjectDraft(
        { title: "Proof Disclaimer Project", target_market: "IN" },
        "cust-adv-001",
        ACTOR_CUSTOMER_A
      );
      const itemRowId = `pitem_proof_${Date.now()}`;
      const db = getDb();
      db.prepare(`
        INSERT INTO pl_project_items (id, project_id, fill_weight_grams, quantity_units)
        VALUES (?, ?, 100, 500)
      `).run(itemRowId, project.id);

      const desVer = PrivateLabelService.createDesignVersion(
        itemRowId,
        { scene_json: {} },
        ACTOR_CUSTOMER_A
      );

      expect(() => {
        PrivateLabelService.approveProof(prepareProofForApproval(desVer.id),
          { actor_name: "Alice", legal_disclaimer_accepted: false }, // Disclaimer refused!
          ACTOR_CUSTOMER_A,
          "cust-adv-001"
        );
      }).toThrow(PrivateLabelGateError);

      try {
        PrivateLabelService.approveProof(prepareProofForApproval(desVer.id),
          { actor_name: "Alice", legal_disclaimer_accepted: false },
          ACTOR_CUSTOMER_A,
          "cust-adv-001"
        );
      } catch (e) {
        const err = e as PrivateLabelGateError;
        expect(err.gate_name).toBe("proof_approval");
        expect(err.blockers.some((b) => b.includes("Legal proof disclaimer must be explicitly accepted"))).toBe(true);
      }
    });

    it("blocks quote acceptance if quote has expired (valid_until in the past)", () => {
      const db = getDb();
      const project = PrivateLabelService.createProjectDraft(
        { title: "Expired Quote Project", target_market: "IN" },
        "cust-adv-001",
        ACTOR_CUSTOMER_A
      );
      const quote = PrivateLabelService.createQuote(project.id, {}, ACTOR_CUSTOMER_A, "cust-adv-001");

      // Manually set valid_until to yesterday
      const yesterday = new Date(Date.now() - 86400000).toISOString();
      db.prepare("UPDATE pl_quotes SET valid_until = ? WHERE id = ?").run(yesterday, quote.id);

      expect(() => {
        PrivateLabelService.acceptQuote(quote.id, 1, {}, ACTOR_CUSTOMER_A, "cust-adv-001");
      }).toThrow(PrivateLabelGateError);

      try {
        PrivateLabelService.acceptQuote(quote.id, 1, {}, ACTOR_CUSTOMER_A, "cust-adv-001");
      } catch (e) {
        const err = e as PrivateLabelGateError;
        expect(err.gate_name).toBe("quote_acceptance");
        expect(err.blockers.some((b) => b.includes("has expired"))).toBe(true);
      }
    });
  });
});
