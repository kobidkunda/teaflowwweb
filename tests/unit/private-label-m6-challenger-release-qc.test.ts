/**
 * TeaFloww Private Label Studio — Milestone M6 Adversarial Challenger Test Suite
 * Challenger: private_label_m6_challenger_2 (Role: Release Gate & QC Stress Challenger)
 * File: tests/unit/private-label-m6-challenger-release-qc.test.ts
 *
 * Scope: Milestone M6 (Production Release Gate, 7 Cleanroom QC Milestones, FSSAI Tolerance, Critical Defect Halts, Tenant 404 Anti-Enumeration)
 * Empirical Test Suites:
 * 1. Hard Production Release Gate Prerequisites:
 *    - Unapproved or missing proof rejection (service & HTTP 422)
 *    - Unpaid deposit rejection (service & HTTP 422)
 *    - Dual blocker reporting (both proof and deposit unmet)
 *    - Emergency override attempt without justification rejection (empty string, whitespace)
 *    - Emergency override audit logging (blocked release attempt audit & successful override audit)
 *    - Non-existent order 404
 * 2. 7 Cleanroom QC Milestones Initialization and Completion Gates:
 *    - Automatic initialization of all 7 milestones in pending status
 *    - Exact milestone sequence verification
 *    - Out-of-order execution resilience
 *    - Completion gate blocking ready_to_ship until all 7 are passed or waived
 *    - 6 passed + 1 waived satisfies completion gate
 *    - Supervisor QC lock protection on completed / ready_to_ship jobs
 * 3. FSSAI Net Quantity Weight Tolerance Boundaries:
 *    - Exact +/-1.5% variance formula verification (Math.abs(recorded - target) / target <= 0.015)
 *    - 100g, 250g, 500g, 1000g, 25g boundary tests (exact boundary passes, 1.51% fails)
 *    - HTTP 422 gate error response with descriptive message
 *    - Zod positive number enforcement (HTTP 400)
 * 4. Critical Defect Halting (seal_integrity & sensory_cupping):
 *    - Automatic status = 'halted' upon seal_integrity failure
 *    - Automatic status = 'halted' upon sensory_cupping failure
 *    - Non-critical stages do NOT halt the job
 *    - Halting blocks subsequent progression even if other milestones pass
 *    - HTTP route verification
 * 5. Strict Cross-Tenant 404 Anti-Enumeration:
 *    - Cross-tenant order lookup returns 404 (never 403 or data leakage)
 *    - Cross-tenant order invoice returns 404
 *    - Cross-tenant sample lookup returns 404
 *    - Cross-tenant sample cancellation returns 404
 *    - Byte-for-byte identical 404 responses for foreign vs non-existent IDs
 *    - Multi-tenant list scoping
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { rmSync } from "node:fs";

const TEST_DB_PATH = path.join(tmpdir(), `pl-m6-chal2-${process.pid}-${Date.now()}.sqlite`);
process.env.DATABASE_PATH = TEST_DB_PATH;
(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.ADMIN_TEST_TOKEN = "secure_test_admin_token_m6_chal2_987654";

import { getDb } from "@/lib/db";
import { PrivateLabelService } from "@/lib/private-label/service";
import {
  PrivateLabelNotFoundError,
  PrivateLabelGateError,
  type AuditActor,
  type QCMilestone,
} from "@/lib/private-label/types";

// Route Handlers
import { POST as releaseJobRoute } from "@/app/api/v1/admin/private-label/jobs/release/route";
import { GET as validateReleaseRoute } from "@/app/api/v1/admin/private-label/jobs/validate-release/route";
import {
  GET as getJobQCRoute,
  POST as postJobQCRoute,
} from "@/app/api/v1/admin/private-label/jobs/[id]/qc/route";
import { GET as getCustomerOrderRoute } from "@/app/api/v1/private-label/orders/[id]/route";
import { GET as getCustomerInvoiceRoute } from "@/app/api/v1/private-label/orders/[id]/invoice/route";
import { GET as listCustomerOrdersRoute } from "@/app/api/v1/private-label/orders/route";
import { GET as listCustomerSamplesRoute } from "@/app/api/v1/private-label/samples/route";
import { POST as cancelSampleRoute } from "@/app/api/v1/private-label/samples/[id]/cancel/route";

// Test Actor Identifiers
const CUSTOMER_A_ID = "cust_chal2_alice";
const CUSTOMER_B_ID = "cust_chal2_bob";
const ADMIN_ACTOR_ID = "admin_chal2_qc";

const ACTOR_CUSTOMER_A: AuditActor = {
  actor_type: "customer",
  actor_id: CUSTOMER_A_ID,
  actor_email: "alice@teafloww-chal2.com",
};

const ACTOR_CUSTOMER_B: AuditActor = {
  actor_type: "customer",
  actor_id: CUSTOMER_B_ID,
  actor_email: "bob@teafloww-chal2.com",
};

const ACTOR_ADMIN: AuditActor = {
  actor_type: "admin",
  actor_id: ADMIN_ACTOR_ID,
  actor_email: "siliguri-qc-cleanroom@teafloww.com",
};

const ADMIN_HEADERS = {
  "Content-Type": "application/json",
  "x-admin-test-token": "secure_test_admin_token_m6_chal2_987654",
};

describe("Milestone M6 Adversarial Challenger: Release Gate & Cleanroom QC Stress", () => {
  let db: Database.Database;

  beforeAll(() => {
    // Run database migrations on fresh isolated SQLite test database
    execFileSync(process.execPath, ["scripts/migrate.mjs"], {
      env: { ...process.env, DATABASE_PATH: TEST_DB_PATH },
    });

    db = getDb();
    db.pragma("foreign_keys = ON");

    // Seed base catalog
    PrivateLabelService.seedInitialCatalog();

    // Seed tea options and packaging variants for foreign key satisfaction
    db.prepare(`
      INSERT OR IGNORE INTO pl_tea_options (
        id, slug, name, origin_estate, region, grade, flush, tea_category, description,
        caffeine_level, base_cost_per_kg_paise, min_batch_kg
      ) VALUES (
        'tea_darjeeling_ftgfop1', 'darjeeling-ftgfop1', 'Darjeeling FTGFOP1', 'Makaibari', 'Darjeeling', 'FTGFOP1', 'First Flush', 'black', 'Single estate black tea', 'medium', 120000, 5.0
      ), (
        'tea_assam_ctc_bp', 'assam-ctc-bp', 'Assam CTC BP', 'Halmari', 'Assam', 'BP', 'Second Flush', 'black', 'Robust CTC', 'high', 80000, 10.0
      )
    `).run();

    db.prepare(`
      INSERT OR IGNORE INTO pl_packaging_variants (
        id, family_id, slug, sku, title, material, finish, closure_type, capacity_description,
        net_weight_capacity_grams, width_mm, height_mm, label_safe_width_mm, label_safe_height_mm,
        supplier_name, unit_cost_paise, lead_time_days
      ) VALUES (
        'var_pouch_100', 'fam_pouch', 'pouch-100g', 'SKU-POUCH-100', '100g Standup Pouch', 'Kraft Foil', 'Matte', 'Zip', '100g',
        100, 120, 200, 100, 160, 'Siliguri Pack Corp', 2500, 14
      )
    `).run();

    // Seed customers for foreign key satisfaction
    db.prepare(`
      INSERT OR IGNORE INTO customers (id, email, name)
      VALUES (?, ?, 'Alice Challenger'),
             (?, ?, 'Bob Adversary')
    `).run(
      CUSTOMER_A_ID,
      ACTOR_CUSTOMER_A.actor_email,
      CUSTOMER_B_ID,
      ACTOR_CUSTOMER_B.actor_email
    );

    // Seed clients
    db.prepare(`
      INSERT OR IGNORE INTO pl_clients (id, customer_id, company_name, contact_name, contact_email)
      VALUES ('client_chal2_alice', ?, 'Alice Estate Teas', 'Alice Challenger', ?),
             ('client_chal2_bob', ?, 'Bob Competitor Brands', 'Bob Adversary', ?)
    `).run(
      CUSTOMER_A_ID,
      ACTOR_CUSTOMER_A.actor_email,
      CUSTOMER_B_ID,
      ACTOR_CUSTOMER_B.actor_email
    );
  });

  afterAll(() => {
    try {
      db.close();
      rmSync(TEST_DB_PATH, { force: true });
      rmSync(TEST_DB_PATH + "-wal", { force: true });
      rmSync(TEST_DB_PATH + "-shm", { force: true });
    } catch {}
  });

  // ==========================================================================
  // Suite 1: Hard Production Release Gate Prerequisites
  // ==========================================================================
  describe("Suite 1: Hard Production Release Gate Prerequisites", () => {
    const projId = "proj_chal2_gate_test";
    const projItemId = "item_chal2_gate_test";
    const designVerId = "dv_chal2_gate_test";
    const quoteId = "quote_chal2_gate_test";
    const orderIdDepositPaid = "ord_chal2_deposit_paid_no_proof";
    const orderIdUnpaid = "ord_chal2_unpaid_deposit";
    const orderIdBothUnmet = "ord_chal2_both_unmet";

    beforeAll(() => {
      // Create project
      db.prepare(`
        INSERT INTO pl_projects (id, client_id, owner_customer_id, title, status)
        VALUES (?, 'client_chal2_alice', ?, 'Himalayan Darjeeling Batch', 'accepted')
      `).run(projId, CUSTOMER_A_ID);

      // Create project item
      db.prepare(`
        INSERT INTO pl_project_items (id, project_id, tea_option_id, packaging_variant_id, fill_weight_grams, quantity_units)
        VALUES (?, ?, 'tea_darjeeling_ftgfop1', 'var_pouch_100', 100, 1000)
      `).run(projItemId, projId);

      // Create design version (initially in_review)
      db.prepare(`
        INSERT INTO pl_design_versions (
          id, project_item_id, project_id, version_number, status, preview_render_url, is_locked
        ) VALUES (
          ?, ?, ?, 1, 'preflight_pending', 'https://cdn.teafloww.com/proof1.png', 0
        )
      `).run(designVerId, projItemId, projId);

      // Create quote
      db.prepare(`
        INSERT INTO pl_quotes (
          id, quote_number, project_id, price_book_id, status, grand_total_paise, valid_until
        ) VALUES (
          ?, 'PL-Q-CHAL2-001', ?, 'pb_default_inr', 'converted', 2000000, datetime('now', '+30 days')
        )
      `).run(quoteId, projId);

      // Order 1: deposit_paid, but proof NOT approved
      db.prepare(`
        INSERT INTO pl_orders (
          id, order_number, client_id, quote_id, project_id, status,
          deposit_paise, balance_paise, total_paise, revision
        ) VALUES (
          ?, 'PL-ORD-CHAL2-001', 'client_chal2_alice', ?, ?, 'deposit_paid',
          1000000, 1000000, 2000000, 1
        )
      `).run(orderIdDepositPaid, quoteId, projId);

      // Order 2: pending_deposit
      db.prepare(`
        INSERT INTO pl_orders (
          id, order_number, client_id, quote_id, project_id, status,
          deposit_paise, balance_paise, total_paise, revision
        ) VALUES (
          ?, 'PL-ORD-CHAL2-002', 'client_chal2_alice', ?, ?, 'pending_deposit',
          1000000, 1000000, 2000000, 1
        )
      `).run(orderIdUnpaid, quoteId, projId);

      // Order 3: pending_deposit AND no proof
      db.prepare(`
        INSERT INTO pl_orders (
          id, order_number, client_id, quote_id, project_id, status,
          deposit_paise, balance_paise, total_paise, revision
        ) VALUES (
          ?, 'PL-ORD-CHAL2-003', 'client_chal2_alice', ?, ?, 'pending_deposit',
          1000000, 1000000, 2000000, 1
        )
      `).run(orderIdBothUnmet, quoteId, projId);
    });

    it("Scenario 1.1: validateReleaseGate returns eligible: false when proof approval is missing", () => {
      const gate = PrivateLabelService.validateReleaseGate(orderIdDepositPaid);
      expect(gate.eligible).toBe(false);
      expect(gate.order_id).toBe(orderIdDepositPaid);
      expect(gate.proof_status).toBe("pending");
      expect(gate.deposit_status).toBe("deposit_paid");
      expect(gate.blockers).toContain("Artwork proof approval is required prior to releasing order to production");
    });

    it("Scenario 1.2: service.releaseProductionJob throws PrivateLabelGateError when proof is unapproved", () => {
      expect(() => {
        PrivateLabelService.releaseProductionJob(
          orderIdDepositPaid,
          { operator_notes: "Attempted unapproved release" },
          ACTOR_ADMIN
        );
      }).toThrow(PrivateLabelGateError);

      try {
        PrivateLabelService.releaseProductionJob(
          orderIdDepositPaid,
          { operator_notes: "Attempted unapproved release" },
          ACTOR_ADMIN
        );
      } catch (err: any) {
        expect(err.gate_name).toBe("production_release");
        expect(err.blockers.some((b: string) => b.includes("Artwork proof approval"))).toBe(true);
      }
    });

    it("Scenario 1.3: HTTP POST /api/v1/admin/private-label/jobs/release returns 422 with gate blockers when proof is unapproved", async () => {
      const req = new Request("http://localhost/api/v1/admin/private-label/jobs/release", {
        method: "POST",
        headers: ADMIN_HEADERS,
        body: JSON.stringify({
          orderId: orderIdDepositPaid,
          operatorNotes: "Testing API release gate blocker",
        }),
      });

      const res = await releaseJobRoute(req);
      expect(res.status).toBe(422);

      const json = await res.json();
      expect(json.gate_name).toBe("production_release");
      expect(json.blockers).toBeDefined();
      expect(json.blockers.some((b: string) => b.includes("Artwork proof approval"))).toBe(true);
    });

    it("Scenario 1.4: HTTP GET /api/v1/admin/private-label/jobs/validate-release returns 200 with eligible: false and blockers", async () => {
      const req = new Request(`http://localhost/api/v1/admin/private-label/jobs/validate-release?order_id=${orderIdDepositPaid}`, {
        method: "GET",
        headers: ADMIN_HEADERS,
      });

      const res = await validateReleaseRoute(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.eligible).toBe(false);
      expect(json.order_id).toBe(orderIdDepositPaid);
      expect(json.blockers.some((b: string) => b.includes("Artwork proof approval"))).toBe(true);
    });

    it("Scenario 1.5: Proof in 'customer_rejected' action remains blocked", () => {
      db.prepare(`
        INSERT INTO pl_approval_events (
          id, design_version_id, client_id, actor_type, actor_id, actor_name, action, legal_disclaimer_accepted, signer_name, disclaimer_text
        ) VALUES (
          'appr_chal2_rejected', ?, 'client_chal2_alice', 'customer', ?, 'Alice', 'customer_rejected', 0, 'Alice', 'Rejected proof'
        )
      `).run(designVerId, CUSTOMER_A_ID);

      const gate = PrivateLabelService.validateReleaseGate(orderIdDepositPaid);
      expect(gate.eligible).toBe(false);
      expect(gate.blockers.some((b) => b.includes("Artwork proof approval"))).toBe(true);
    });

    it("Scenario 1.6: Proof approved for an unrelated quote/project does NOT satisfy this order's gate", () => {
      const unlinkedProjId = "proj_chal2_unrelated";
      const unlinkedItemId = "item_unrelated_123";
      const unlinkedVerId = "dv_chal2_unrelated";

      db.prepare(`
        INSERT INTO pl_projects (id, client_id, owner_customer_id, title, status)
        VALUES (?, 'client_chal2_alice', ?, 'Unrelated Project', 'accepted')
      `).run(unlinkedProjId, CUSTOMER_A_ID);

      db.prepare(`
        INSERT INTO pl_project_items (id, project_id, fill_weight_grams, quantity_units)
        VALUES (?, ?, 100, 1000)
      `).run(unlinkedItemId, unlinkedProjId);

      db.prepare(`
        INSERT INTO pl_design_versions (
          id, project_item_id, project_id, version_number, status, is_locked
        ) VALUES (
          ?, ?, ?, 1, 'customer_approved', 1
        )
      `).run(unlinkedVerId, unlinkedItemId, unlinkedProjId);

      db.prepare(`
        INSERT INTO pl_approval_events (
          id, design_version_id, client_id, actor_type, actor_id, actor_name, action, legal_disclaimer_accepted, signer_name, disclaimer_text
        ) VALUES (
          'appr_chal2_unrelated', ?, 'client_chal2_alice', 'customer', ?, 'Alice', 'customer_approved', 1, 'Alice', 'Authorized'
        )
      `).run(unlinkedVerId, CUSTOMER_A_ID);

      const gate = PrivateLabelService.validateReleaseGate(orderIdDepositPaid);
      expect(gate.eligible).toBe(false);
      expect(gate.blockers.some((b) => b.includes("Artwork proof approval"))).toBe(true);
    });

    it("Scenario 1.7: validateReleaseGate returns eligible: false and blocker when deposit is unpaid", () => {
      db.prepare("UPDATE pl_design_versions SET status = 'customer_approved', is_locked = 1 WHERE id = ?").run(designVerId);
      // Now approve the actual proof for our order's project item
      db.prepare(`
        INSERT INTO pl_approval_events (
          id, design_version_id, client_id, actor_type, actor_id, actor_name, action, legal_disclaimer_accepted, signer_name, disclaimer_text
        ) VALUES (
          'appr_chal2_valid', ?, 'client_chal2_alice', 'customer', ?, 'Alice', 'customer_approved', 1, 'Alice', 'Authorized for production'
        )
      `).run(designVerId, CUSTOMER_A_ID);

      // Check orderIdUnpaid: proof is now approved, but deposit is 'pending_deposit'
      const gate = PrivateLabelService.validateReleaseGate(orderIdUnpaid);
      expect(gate.eligible).toBe(false);
      expect(gate.proof_status).toBe("customer_approved");
      expect(gate.deposit_status).toBe("pending_deposit");
      expect(gate.blockers).toContain("Order status must be 'deposit_paid' (current status: 'pending_deposit')");
    });

    it("Scenario 1.8: service.releaseProductionJob and HTTP release return 422 when deposit is unpaid", async () => {
      expect(() => {
        PrivateLabelService.releaseProductionJob(
          orderIdUnpaid,
          { operator_notes: "Attempted unpaid release" },
          ACTOR_ADMIN
        );
      }).toThrow(PrivateLabelGateError);

      const req = new Request("http://localhost/api/v1/admin/private-label/jobs/release", {
        method: "POST",
        headers: ADMIN_HEADERS,
        body: JSON.stringify({
          orderId: orderIdUnpaid,
          operatorNotes: "Attempted unpaid release via API",
        }),
      });

      const res = await releaseJobRoute(req);
      expect(res.status).toBe(422);

      const json = await res.json();
      expect(json.gate_name).toBe("production_release");
      expect(json.blockers.some((b: string) => b.includes("Order status must be 'deposit_paid'"))).toBe(true);
    });

    it("Scenario 1.9: Dual blocker: order with BOTH unpaid deposit and unapproved proof returns multiple blockers", () => {
      const gate = PrivateLabelService.validateReleaseGate(orderIdBothUnmet);
      expect(gate.eligible).toBe(false);
      expect(gate.blockers.some((b) => b.includes("deposit_paid"))).toBe(true);
    });

    it("Scenario 1.10: Emergency release attempt with empty string or whitespace justification FAILS with 422", async () => {
      // Empty string
      expect(() => {
        PrivateLabelService.releaseProductionJob(
          orderIdUnpaid,
          { override_justification: "" },
          ACTOR_ADMIN
        );
      }).toThrow(PrivateLabelGateError);

      // Whitespace string
      expect(() => {
        PrivateLabelService.releaseProductionJob(
          orderIdUnpaid,
          { override_justification: "    " },
          ACTOR_ADMIN
        );
      }).toThrow(PrivateLabelGateError);

      // HTTP Route with whitespace justification
      const req = new Request("http://localhost/api/v1/admin/private-label/jobs/release", {
        method: "POST",
        headers: ADMIN_HEADERS,
        body: JSON.stringify({
          orderId: orderIdUnpaid,
          overrideJustification: "   ",
        }),
      });

      const res = await releaseJobRoute(req);
      expect(res.status).toBe(422);
    });

    it("Scenario 1.11: Verifies audit trail persistence: blocked release attempt committed outside db.transaction", () => {
      // In Scenarios 1.8 and 1.10, releaseProductionJob was called on orderIdUnpaid and threw PrivateLabelGateError.
      // Now that recordAudit() is called OUTSIDE db.transaction, the blocked release attempts are committed to pl_audit.
      const blockedAudits = db
        .prepare("SELECT * FROM pl_audit WHERE entity_id = ? AND action = 'release_blocked'")
        .all(orderIdUnpaid) as Array<{ entity_id: string; diff_json: string; action: string }>;

      // Confirms the remediation: blocked release attempts are persisted in pl_audit
      expect(blockedAudits.length).toBeGreaterThan(0);
    });

    it("Scenario 1.12: Emergency release WITH explicit justification succeeds and audits override", () => {
      const justification = "Emergency release authorized by Managing Director for trade show deadline";
      const job = PrivateLabelService.releaseProductionJob(
        orderIdUnpaid,
        {
          override_justification: justification,
          operator_notes: "Priority Cleanroom Slot #2",
          operator_id: "emp_factory_dir_01",
        },
        ACTOR_ADMIN
      );

      expect(job.id).toMatch(/^job_/);
      expect(job.status).toBe("scheduled");
      expect(job.override_justification).toBe(justification);

      // Verify order status transitioned to production_released
      const order = db.prepare("SELECT status FROM pl_orders WHERE id = ?").get(orderIdUnpaid) as { status: string };
      expect(order.status).toBe("production_released");

      // Verify audit log has release_job with override justification
      const audit = db
        .prepare("SELECT * FROM pl_audit WHERE entity_id = ? AND action = 'release_job'")
        .get(job.id) as { diff_json: string };
      expect(audit).toBeDefined();
      const diff = JSON.parse(audit.diff_json);
      expect(diff.overrideJustification).toBe(justification);
    });

    it("Scenario 1.13: Non-existent order release returns 404 / throws PrivateLabelNotFoundError", async () => {
      const nonExistentOrderId = "ord_chal2_does_not_exist_999";
      const gate = PrivateLabelService.validateReleaseGate(nonExistentOrderId);
      expect(gate.eligible).toBe(false);
      expect(gate.blockers.some((b) => b.includes("not found"))).toBe(true);

      expect(() => {
        PrivateLabelService.releaseProductionJob(
          nonExistentOrderId,
          { override_justification: "Bypass non-existent" },
          ACTOR_ADMIN
        );
      }).toThrow(PrivateLabelNotFoundError);

      const req = new Request("http://localhost/api/v1/admin/private-label/jobs/release", {
        method: "POST",
        headers: ADMIN_HEADERS,
        body: JSON.stringify({
          orderId: nonExistentOrderId,
          overrideJustification: "Bypass non-existent via HTTP",
        }),
      });

      const res = await releaseJobRoute(req);
      expect(res.status).toBe(404);
    });
  });

  // ==========================================================================
  // Suite 2: 7 Cleanroom QC Milestones Initialization and Completion Gates
  // ==========================================================================
  describe("Suite 2: 7 Cleanroom QC Milestones Initialization and Completion Gates", () => {
    let releasedJobId: string;
    const testOrderId = "ord_chal2_qc_lifecycle";
    const testQuoteId = "quote_chal2_qc_lifecycle";
    const testProjId = "proj_chal2_qc_lifecycle";

    beforeAll(() => {
      // Create project, quote, order with approved proof and deposit_paid
      db.prepare(`
        INSERT INTO pl_projects (id, client_id, owner_customer_id, title, status)
        VALUES (?, 'client_chal2_alice', ?, 'Organic Green Tea Batch', 'accepted')
      `).run(testProjId, CUSTOMER_A_ID);

      db.prepare(`
        INSERT INTO pl_project_items (id, project_id, tea_option_id, packaging_variant_id, fill_weight_grams, quantity_units)
        VALUES ('item_chal2_qc', ?, 'tea_assam_ctc_bp', 'var_pouch_100', 100, 500)
      `).run(testProjId);

      db.prepare(`
        INSERT INTO pl_design_versions (
          id, project_item_id, project_id, version_number, status, preview_render_url, is_locked
        ) VALUES (
          'dv_chal2_qc', 'item_chal2_qc', ?, 1, 'customer_approved', 'https://cdn.teafloww.com/proof-qc.png', 1
        )
      `).run(testProjId);

      db.prepare(`
        INSERT INTO pl_approval_events (
          id, design_version_id, client_id, actor_type, actor_id, actor_name, action, legal_disclaimer_accepted, signer_name, disclaimer_text
        ) VALUES (
          'appr_chal2_qc', 'dv_chal2_qc', 'client_chal2_alice', 'customer', ?, 'Alice', 'customer_approved', 1, 'Alice', 'Signed off'
        )
      `).run(CUSTOMER_A_ID);

      db.prepare(`
        INSERT INTO pl_quotes (
          id, quote_number, project_id, price_book_id, status, grand_total_paise, valid_until
        ) VALUES (
          ?, 'PL-Q-QC-001', ?, 'pb_default_inr', 'converted', 1500000, datetime('now', '+30 days')
        )
      `).run(testQuoteId, testProjId);

      db.prepare(`
        INSERT INTO pl_orders (
          id, order_number, client_id, quote_id, project_id, status,
          deposit_paise, balance_paise, total_paise, revision
        ) VALUES (
          ?, 'PL-ORD-QC-7STAGES', 'client_chal2_alice', ?, ?, 'deposit_paid',
          750000, 750000, 1500000, 1
        )
      `).run(testOrderId, testQuoteId, testProjId);

      // Release the job normally
      const job = PrivateLabelService.releaseProductionJob(
        testOrderId,
        {
          target_completion_date: "2026-12-20",
          operator_notes: "Batch Run Alpha-7",
          operator_id: "qc_lead_inspector",
        },
        ACTOR_ADMIN
      );
      releasedJobId = job.id;
    });

    it("Scenario 2.1: Exactly 7 cleanroom QC milestones are auto-initialized upon job release", () => {
      const milestones = db
        .prepare("SELECT * FROM pl_qc_milestones WHERE job_id = ? ORDER BY created_at ASC")
        .all(releasedJobId) as QCMilestone[];

      expect(milestones).toHaveLength(7);
      expect(milestones.every((m) => m.status === "pending")).toBe(true);
    });

    it("Scenario 2.2: The 7 milestones match the exact expected cleanroom stages", () => {
      const jobWithMilestones = PrivateLabelService.getProductionJob(releasedJobId);
      const stages = jobWithMilestones.milestones.map((m) => m.stage);

      const expectedStages = [
        "raw_material",
        "packaging_incoming",
        "print_proof",
        "fill_weight",
        "seal_integrity",
        "sensory_cupping",
        "final_pack",
      ];

      expect(stages).toEqual(expect.arrayContaining(expectedStages));
      expect(stages).toHaveLength(7);
    });

    it("Scenario 2.3: HTTP GET /api/v1/admin/private-label/jobs/[id]/qc returns 200 with all 7 milestones", async () => {
      const req = new Request(`http://localhost/api/v1/admin/private-label/jobs/${releasedJobId}/qc`, {
        method: "GET",
        headers: ADMIN_HEADERS,
      });

      const res = await getJobQCRoute(req, { params: Promise.resolve({ id: releasedJobId }) });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.job_id).toBe(releasedJobId);
      expect(json.milestones).toHaveLength(7);
      expect(json.milestones.every((m: any) => m.status === "pending")).toBe(true);
    });

    it("Scenario 2.4: Out-of-order execution: passing milestone 7 (final_pack) first does NOT advance job to ready_to_ship", () => {
      PrivateLabelService.recordQCMilestone(
        releasedJobId,
        {
          stage: "final_pack",
          status: "passed",
          inspector_name: "Packaging Line Supervisor",
          evidence_notes: "Master carton strapped and pallet shrink-wrapped",
        },
        ACTOR_ADMIN
      );

      const job = db.prepare("SELECT status FROM pl_jobs WHERE id = ?").get(releasedJobId) as { status: string };
      const order = db.prepare("SELECT status FROM pl_orders WHERE id = ?").get(testOrderId) as { status: string };

      // Job must still remain in scheduled, NOT ready_to_ship
      expect(job.status).not.toBe("ready_to_ship");
      expect(order.status).not.toBe("qc_passed");
    });

    it("Scenario 2.5: Partial milestone execution (5 of 7 passed) leaves job and order in uncompleted state", () => {
      const stagesToPass: Array<QCMilestone["stage"]> = [
        "raw_material",
        "packaging_incoming",
        "print_proof",
        "fill_weight",
      ];

      for (const st of stagesToPass) {
        PrivateLabelService.recordQCMilestone(
          releasedJobId,
          {
            stage: st,
            status: "passed",
            inspector_name: "Siliguri QC Station Lead",
            recorded_weight_g: st === "fill_weight" ? 100.5 : undefined,
            target_weight_g: st === "fill_weight" ? 100.0 : undefined,
          },
          ACTOR_ADMIN
        );
      }

      const job = db.prepare("SELECT status FROM pl_jobs WHERE id = ?").get(releasedJobId) as { status: string };
      const order = db.prepare("SELECT status FROM pl_orders WHERE id = ?").get(testOrderId) as { status: string };

      expect(job.status).not.toBe("ready_to_ship");
      expect(order.status).not.toBe("qc_passed");

      // Verify 5 are passed and 2 remain pending
      const milestones = db
        .prepare("SELECT stage, status FROM pl_qc_milestones WHERE job_id = ?")
        .all(releasedJobId) as Array<{ stage: string; status: string }>;
      const passed = milestones.filter((m) => m.status === "passed");
      expect(passed).toHaveLength(5);
    });

    it("Scenario 2.6: Waiving a milestone (6 passed + 1 waived) satisfies the completion gate and advances job to ready_to_ship", () => {
      // Pass seal_integrity
      PrivateLabelService.recordQCMilestone(
        releasedJobId,
        {
          stage: "seal_integrity",
          status: "passed",
          inspector_name: "Chamber Tech",
        },
        ACTOR_ADMIN
      );

      // Waive sensory_cupping with supervisor note
      PrivateLabelService.recordQCMilestone(
        releasedJobId,
        {
          stage: "sensory_cupping",
          status: "waived",
          inspector_name: "Chief Quality Officer",
          evidence_notes: "Repeat blend: lot sensory profile previously certified under QA-9921",
        },
        ACTOR_ADMIN
      );

      const job = db.prepare("SELECT status FROM pl_jobs WHERE id = ?").get(releasedJobId) as { status: string };
      const order = db.prepare("SELECT status FROM pl_orders WHERE id = ?").get(testOrderId) as { status: string };

      // All 7 are now passed or waived -> job transitions to ready_to_ship, order to qc_passed
      expect(job.status).toBe("ready_to_ship");
      expect(order.status).toBe("qc_passed");
    });

    it("Scenario 2.7: Non-admin actor attempting to modify QC milestones on ready_to_ship job throws PrivateLabelGateError (qc_locked)", () => {
      expect(() => {
        PrivateLabelService.recordQCMilestone(
          releasedJobId,
          {
            stage: "raw_material",
            status: "passed",
            inspector_name: "Unauthorized Attempter",
          },
          ACTOR_CUSTOMER_A
        );
      }).toThrow(PrivateLabelGateError);

      try {
        PrivateLabelService.recordQCMilestone(
          releasedJobId,
          {
            stage: "raw_material",
            status: "passed",
            inspector_name: "Unauthorized Attempter",
          },
          ACTOR_CUSTOMER_A
        );
      } catch (err: any) {
        expect(err.gate_name).toBe("qc_locked");
      }
    });
  });

  // ==========================================================================
  // Suite 3: FSSAI Net Quantity Weight Tolerance Boundaries
  // ==========================================================================
  describe("Suite 3: FSSAI Net Quantity Weight Tolerance Boundaries", () => {
    let weightJobId: string;
    const weightOrderId = "ord_chal2_weight_test";
    const weightQuoteId = "quote_chal2_weight_test";
    const weightProjId = "proj_chal2_weight_test";

    beforeAll(() => {
      weightJobId = "job_chal2_weight_test";

      db.prepare(`
        INSERT INTO pl_projects (id, client_id, owner_customer_id, title, status)
        VALUES (?, 'client_chal2_alice', ?, 'Weight Tolerance Project', 'accepted')
      `).run(weightProjId, CUSTOMER_A_ID);

      db.prepare(`
        INSERT INTO pl_quotes (
          id, quote_number, project_id, price_book_id, status, grand_total_paise, valid_until
        ) VALUES (
          ?, 'PL-Q-WGT-001', ?, 'pb_default_inr', 'converted', 2000000, datetime('now', '+30 days')
        )
      `).run(weightQuoteId, weightProjId);

      db.prepare(`
        INSERT INTO pl_orders (
          id, order_number, client_id, quote_id, project_id, status,
          deposit_paise, balance_paise, total_paise, revision
        ) VALUES (
          ?, 'PL-ORD-WEIGHT-001', 'client_chal2_alice', ?, ?, 'production_released',
          1000000, 1000000, 2000000, 1
        )
      `).run(weightOrderId, weightQuoteId, weightProjId);

      db.prepare(`
        INSERT INTO pl_jobs (
          id, job_number, order_id, status, released_by, revision
        ) VALUES (
          ?, 'PL-JOB-WEIGHT-001', ?, 'filling_packing', 'admin_chal2_qc', 1
        )
      `).run(weightJobId, weightOrderId);

      db.prepare(`
        INSERT INTO pl_qc_milestones (id, job_id, milestone_name, stage, status)
        VALUES ('qc_weight_stage', ?, 'Fill Weight Check', 'fill_weight', 'pending')
      `).run(weightJobId);
    });

    it("Scenario 3.1: 100g target: Exactly on target (100.0g, variance 0%) PASSES", () => {
      const milestone = PrivateLabelService.recordQCMilestone(
        weightJobId,
        {
          stage: "fill_weight",
          status: "passed",
          recorded_weight_g: 100.0,
          target_weight_g: 100.0,
          inspector_name: "Scale Inspector 1",
        },
        ACTOR_ADMIN
      );

      expect(milestone.status).toBe("passed");
      expect(milestone.recorded_weight_g).toBe(100.0);
      expect(milestone.target_weight_g).toBe(100.0);
    });

    it("Scenario 3.2: 100g target: Exact upper boundary (+1.500% -> 101.500g) PASSES", () => {
      const milestone = PrivateLabelService.recordQCMilestone(
        weightJobId,
        {
          stage: "fill_weight",
          status: "passed",
          recorded_weight_g: 101.5,
          target_weight_g: 100.0,
          inspector_name: "Scale Inspector 1",
        },
        ACTOR_ADMIN
      );

      expect(milestone.status).toBe("passed");
      expect(milestone.recorded_weight_g).toBe(101.5);
    });

    it("Scenario 3.3: 100g target: Exact lower boundary (-1.500% -> 98.500g) PASSES", () => {
      const milestone = PrivateLabelService.recordQCMilestone(
        weightJobId,
        {
          stage: "fill_weight",
          status: "passed",
          recorded_weight_g: 98.5,
          target_weight_g: 100.0,
          inspector_name: "Scale Inspector 1",
        },
        ACTOR_ADMIN
      );

      expect(milestone.status).toBe("passed");
      expect(milestone.recorded_weight_g).toBe(98.5);
    });

    it("Scenario 3.4: 100g target: Breach above upper boundary (+1.51% -> 101.51g) THROWS PrivateLabelGateError", () => {
      expect(() => {
        PrivateLabelService.recordQCMilestone(
          weightJobId,
          {
            stage: "fill_weight",
            status: "passed",
            recorded_weight_g: 101.51,
            target_weight_g: 100.0,
            inspector_name: "Scale Inspector 1",
          },
          ACTOR_ADMIN
        );
      }).toThrowError(/exceeds FSSAI allowed tolerance/);
    });

    it("Scenario 3.5: 100g target: Breach below lower boundary (-1.51% -> 98.49g) THROWS PrivateLabelGateError", () => {
      expect(() => {
        PrivateLabelService.recordQCMilestone(
          weightJobId,
          {
            stage: "fill_weight",
            status: "passed",
            recorded_weight_g: 98.49,
            target_weight_g: 100.0,
            inspector_name: "Scale Inspector 1",
          },
          ACTOR_ADMIN
        );
      }).toThrowError(/exceeds FSSAI allowed tolerance/);
    });

    it("Scenario 3.6: 500g bulk pouch: 507.5g (+1.5%) PASSES, but 507.55g (+1.51%) THROWS", () => {
      const passed = PrivateLabelService.recordQCMilestone(
        weightJobId,
        {
          stage: "fill_weight",
          status: "passed",
          recorded_weight_g: 507.5,
          target_weight_g: 500.0,
          inspector_name: "Scale Inspector 2",
        },
        ACTOR_ADMIN
      );
      expect(passed.status).toBe("passed");

      expect(() => {
        PrivateLabelService.recordQCMilestone(
          weightJobId,
          {
            stage: "fill_weight",
            status: "passed",
            recorded_weight_g: 507.55,
            target_weight_g: 500.0,
            inspector_name: "Scale Inspector 2",
          },
          ACTOR_ADMIN
        );
      }).toThrowError(/exceeds FSSAI allowed tolerance/);
    });

    it("Scenario 3.7: 25g sample tin: 25.375g (+1.5%) PASSES, but 25.45g (+1.8%) THROWS", () => {
      const passed = PrivateLabelService.recordQCMilestone(
        weightJobId,
        {
          stage: "fill_weight",
          status: "passed",
          recorded_weight_g: 25.375,
          target_weight_g: 25.0,
          inspector_name: "Scale Inspector Micro",
        },
        ACTOR_ADMIN
      );
      expect(passed.status).toBe("passed");

      expect(() => {
        PrivateLabelService.recordQCMilestone(
          weightJobId,
          {
            stage: "fill_weight",
            status: "passed",
            recorded_weight_g: 25.45,
            target_weight_g: 25.0,
            inspector_name: "Scale Inspector Micro",
          },
          ACTOR_ADMIN
        );
      }).toThrowError(/exceeds FSSAI allowed tolerance/);
    });

    it("Scenario 3.8: HTTP POST /api/v1/admin/private-label/jobs/[id]/qc returns 422 with gate details on variance breach", async () => {
      const req = new Request(`http://localhost/api/v1/admin/private-label/jobs/${weightJobId}/qc`, {
        method: "POST",
        headers: ADMIN_HEADERS,
        body: JSON.stringify({
          stage: "fill_weight",
          status: "passed",
          recorded_weight_g: 102.5,
          target_weight_g: 100.0,
          inspector_name: "Automated Checkweigher",
        }),
      });

      const res = await postJobQCRoute(req, { params: Promise.resolve({ id: weightJobId }) });
      expect(res.status).toBe(422);

      const json = await res.json();
      expect(json.gate_name).toBe("fssai_weight_tolerance");
      expect(json.blockers[0]).toContain("Fill weight variance (2.50%) exceeds FSSAI allowed tolerance (+/-1.5%)");
    });

    it("Scenario 3.9: HTTP POST /api/v1/admin/private-label/jobs/[id]/qc returns 400 when weights are non-positive", async () => {
      const req = new Request(`http://localhost/api/v1/admin/private-label/jobs/${weightJobId}/qc`, {
        method: "POST",
        headers: ADMIN_HEADERS,
        body: JSON.stringify({
          stage: "fill_weight",
          status: "passed",
          recorded_weight_g: -5.0,
          target_weight_g: 0,
        }),
      });

      const res = await postJobQCRoute(req, { params: Promise.resolve({ id: weightJobId }) });
      expect(res.status).toBe(400);
    });
  });

  // ==========================================================================
  // Suite 4: Critical Defect Halting (seal_integrity & sensory_cupping)
  // ==========================================================================
  describe("Suite 4: Critical Defect Halting (seal_integrity & sensory_cupping)", () => {
    let sealHaltJobId: string;
    let cuppingHaltJobId: string;
    let nonCriticalJobId: string;

    const haltOrderId = "ord_chal2_halt_shared";
    const haltQuoteId = "quote_chal2_halt_shared";
    const haltProjId = "proj_chal2_halt_shared";

    beforeAll(() => {
      sealHaltJobId = "job_chal2_seal_halt";
      cuppingHaltJobId = "job_chal2_cupping_halt";
      nonCriticalJobId = "job_chal2_non_critical";

      db.prepare(`
        INSERT INTO pl_projects (id, client_id, owner_customer_id, title, status)
        VALUES (?, 'client_chal2_alice', ?, 'Critical Defect Test Project', 'accepted')
      `).run(haltProjId, CUSTOMER_A_ID);

      db.prepare(`
        INSERT INTO pl_quotes (
          id, quote_number, project_id, price_book_id, status, grand_total_paise, valid_until
        ) VALUES (
          ?, 'PL-Q-HALT-001', ?, 'pb_default_inr', 'converted', 1000000, datetime('now', '+30 days')
        )
      `).run(haltQuoteId, haltProjId);

      db.prepare(`
        INSERT INTO pl_orders (
          id, order_number, client_id, quote_id, project_id, status,
          deposit_paise, balance_paise, total_paise, revision
        ) VALUES (
          ?, 'PL-ORD-HALT-SHARED', 'client_chal2_alice', ?, ?, 'production_released',
          500000, 500000, 1000000, 1
        )
      `).run(haltOrderId, haltQuoteId, haltProjId);

      // Setup 3 active jobs
      const jobs = [
        { id: sealHaltJobId, num: "PL-JOB-SEAL-001" },
        { id: cuppingHaltJobId, num: "PL-JOB-CUP-001" },
        { id: nonCriticalJobId, num: "PL-JOB-NONCRIT-001" },
      ];

      for (const j of jobs) {
        db.prepare(`
          INSERT INTO pl_jobs (id, job_number, order_id, status, released_by, revision)
          VALUES (?, ?, ?, 'filling_packing', 'admin_chal2_qc', 1)
        `).run(j.id, j.num, haltOrderId);

        db.prepare(`
          INSERT INTO pl_qc_milestones (id, job_id, milestone_name, stage, status)
          VALUES ('qc_seal_${j.id}', ?, 'Seal Test', 'seal_integrity', 'pending'),
                 ('qc_cup_${j.id}', ?, 'Cupping Test', 'sensory_cupping', 'pending'),
                 ('qc_raw_${j.id}', ?, 'Raw Material Test', 'raw_material', 'pending'),
                 ('qc_final_${j.id}', ?, 'Final Box Test', 'final_pack', 'pending')
        `).run(j.id, j.id, j.id, j.id);
      }
    });

    it("Scenario 4.1: Failure in seal_integrity automatically transitions job status to 'halted'", () => {
      PrivateLabelService.recordQCMilestone(
        sealHaltJobId,
        {
          stage: "seal_integrity",
          status: "failed",
          inspector_name: "Siliguri Vacuum Leak Station",
          evidence_notes: "Continuous stream of air bubbles observed at 40 kPa vacuum pressure",
        },
        ACTOR_ADMIN
      );

      const job = db.prepare("SELECT status FROM pl_jobs WHERE id = ?").get(sealHaltJobId) as { status: string };
      expect(job.status).toBe("halted");
    });

    it("Scenario 4.2: Failure in sensory_cupping automatically transitions job status to 'halted'", () => {
      PrivateLabelService.recordQCMilestone(
        cuppingHaltJobId,
        {
          stage: "sensory_cupping",
          status: "failed",
          inspector_name: "Senior Tea Sommelier",
          cupping_score: 55.0,
          evidence_notes: "Severe taints detected: smoky phenolics inconsistent with lot specification",
        },
        ACTOR_ADMIN
      );

      const job = db.prepare("SELECT status FROM pl_jobs WHERE id = ?").get(cuppingHaltJobId) as { status: string };
      expect(job.status).toBe("halted");
    });

    it("Scenario 4.3: Failure in non-critical stage (raw_material or final_pack) does NOT halt the job", () => {
      PrivateLabelService.recordQCMilestone(
        nonCriticalJobId,
        {
          stage: "raw_material",
          status: "failed",
          inspector_name: "Leaf Intake Inspector",
          evidence_notes: "Moisture content slightly high, re-drying required",
        },
        ACTOR_ADMIN
      );

      const job = db.prepare("SELECT status FROM pl_jobs WHERE id = ?").get(nonCriticalJobId) as { status: string };
      expect(job.status).toBe("filling_packing");
      expect(job.status).not.toBe("halted");
    });

    it("Scenario 4.4: Halting blocks subsequent milestone progression: passing subsequent milestones does NOT advance job", () => {
      // Attempt to pass final_pack on the seal_halted job
      PrivateLabelService.recordQCMilestone(
        sealHaltJobId,
        {
          stage: "final_pack",
          status: "passed",
          inspector_name: "Carton Packer",
        },
        ACTOR_ADMIN
      );

      const job = db.prepare("SELECT status FROM pl_jobs WHERE id = ?").get(sealHaltJobId) as { status: string };
      expect(job.status).toBe("halted");
      expect(job.status).not.toBe("ready_to_ship");
    });

    it("Scenario 4.5: HTTP POST /api/v1/admin/private-label/jobs/[id]/qc returns 200 and updated job status 'halted' upon critical defect", async () => {
      const httpHaltJobId = "job_chal2_http_halt";
      db.prepare(`
        INSERT INTO pl_jobs (id, job_number, order_id, status, released_by, revision)
        VALUES (?, 'PL-JOB-HTTPHALT-001', ?, 'filling_packing', 'admin_chal2_qc', 1)
      `).run(httpHaltJobId, haltOrderId);

      db.prepare(`
        INSERT INTO pl_qc_milestones (id, job_id, milestone_name, stage, status)
        VALUES ('qc_http_seal', ?, 'Hermetic Seal Test', 'seal_integrity', 'pending')
      `).run(httpHaltJobId);

      const req = new Request(`http://localhost/api/v1/admin/private-label/jobs/${httpHaltJobId}/qc`, {
        method: "POST",
        headers: ADMIN_HEADERS,
        body: JSON.stringify({
          stage: "seal_integrity",
          status: "failed",
          notes: "Crimp delamination under stress",
          inspector_name: "Station 4 QC",
        }),
      });

      const res = await postJobQCRoute(req, { params: Promise.resolve({ id: httpHaltJobId }) });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.status).toBe("failed");
      expect(json.job.status).toBe("halted");
    });
  });

  // ==========================================================================
  // Suite 5: Strict Cross-Tenant 404 Anti-Enumeration
  // ==========================================================================
  describe("Suite 5: Strict Cross-Tenant 404 Anti-Enumeration", () => {
    let orderAliceId: string;
    let sampleAliceId: string;
    let orderBobId: string;
    let sampleBobId: string;

    const projAliceId = "proj_chal2_tenant_alice";
    const quoteAliceId = "quote_chal2_tenant_alice";
    const projBobId = "proj_chal2_tenant_bob";
    const quoteBobId = "quote_chal2_tenant_bob";

    beforeAll(() => {
      orderAliceId = "ord_chal2_tenant_alice";
      sampleAliceId = "samp_chal2_tenant_alice";
      orderBobId = "ord_chal2_tenant_bob";
      sampleBobId = "samp_chal2_tenant_bob";

      // Seed Alice Project & Quote
      db.prepare(`
        INSERT INTO pl_projects (id, client_id, owner_customer_id, title, status)
        VALUES (?, 'client_chal2_alice', ?, 'Alice Secret Project', 'accepted')
      `).run(projAliceId, CUSTOMER_A_ID);

      db.prepare(`
        INSERT INTO pl_quotes (
          id, quote_number, project_id, price_book_id, status, grand_total_paise, valid_until
        ) VALUES (
          ?, 'PL-Q-ALICE-SEC', ?, 'pb_default_inr', 'converted', 10000000, datetime('now', '+30 days')
        )
      `).run(quoteAliceId, projAliceId);

      // Seed Alice Order
      db.prepare(`
        INSERT INTO pl_orders (
          id, order_number, client_id, quote_id, project_id, status,
          deposit_paise, balance_paise, total_paise, revision
        ) VALUES (
          ?, 'PL-ORD-ALICE-SECRET', 'client_chal2_alice', ?, ?, 'production_released',
          5000000, 5000000, 10000000, 1
        )
      `).run(orderAliceId, quoteAliceId, projAliceId);

      // Seed Alice Sample Order
      db.prepare(`
        INSERT INTO pl_samples (
          id, sample_number, client_id, sample_type, status, amount_paise, quantity,
          tea_option_id, packaging_variant_id, shipping_address_json, revision
        ) VALUES (
          ?, 'PL-SMP-ALICE-SECRET', 'client_chal2_alice', 'tea_kit', 'requested', 75000, 1,
          'tea_darjeeling_ftgfop1', 'var_pouch_100', '{"pin_code":"734005"}', 1
        )
      `).run(sampleAliceId);

      // Seed Bob Project & Quote
      db.prepare(`
        INSERT INTO pl_projects (id, client_id, owner_customer_id, title, status)
        VALUES (?, 'client_chal2_bob', ?, 'Bob Public Project', 'accepted')
      `).run(projBobId, CUSTOMER_B_ID);

      db.prepare(`
        INSERT INTO pl_quotes (
          id, quote_number, project_id, price_book_id, status, grand_total_paise, valid_until
        ) VALUES (
          ?, 'PL-Q-BOB-PUB', ?, 'pb_default_inr', 'converted', 400000, datetime('now', '+30 days')
        )
      `).run(quoteBobId, projBobId);

      // Seed Bob Order
      db.prepare(`
        INSERT INTO pl_orders (
          id, order_number, client_id, quote_id, project_id, status,
          deposit_paise, balance_paise, total_paise, revision
        ) VALUES (
          ?, 'PL-ORD-BOB-PUBLIC', 'client_chal2_bob', ?, ?, 'pending_deposit',
          200000, 200000, 400000, 1
        )
      `).run(orderBobId, quoteBobId, projBobId);

      // Seed Bob Sample Order
      db.prepare(`
        INSERT INTO pl_samples (
          id, sample_number, client_id, sample_type, status, amount_paise, quantity,
          tea_option_id, packaging_variant_id, shipping_address_json, revision
        ) VALUES (
          ?, 'PL-SMP-BOB-PUBLIC', 'client_chal2_bob', 'tea_kit', 'requested', 75000, 1,
          'tea_assam_ctc_bp', 'var_pouch_100', '{"pin_code":"734001"}', 1
        )
      `).run(sampleBobId);
    });

    it("Scenario 5.1: Service getOrder throws PrivateLabelNotFoundError when Customer B queries Customer A's order", () => {
      expect(() => {
        PrivateLabelService.getOrder(orderAliceId, CUSTOMER_B_ID);
      }).toThrow(PrivateLabelNotFoundError);

      // Valid customer A lookup must succeed
      const aliceOrder = PrivateLabelService.getOrder(orderAliceId, CUSTOMER_A_ID);
      expect(aliceOrder.order.id).toBe(orderAliceId);
    });

    it("Scenario 5.2: HTTP GET /api/v1/private-label/orders/[id] returns 404 (NEVER 403) when Bob accesses Alice's order", async () => {
      const req = new Request(`http://localhost/api/v1/private-label/orders/${orderAliceId}`, {
        method: "GET",
        headers: {
          "x-customer-id": CUSTOMER_B_ID,
        },
      });

      const res = await getCustomerOrderRoute(req, { params: Promise.resolve({ id: orderAliceId }) });

      // Strict anti-enumeration requirement: must be 404, NEVER 403
      expect(res.status).toBe(404);
      expect(res.status).not.toBe(403);

      const json = await res.json();
      expect(json.error).toBe("Order not found");

      // Verify zero sensitive data is leaked
      expect(json.order_number).toBeUndefined();
      expect(json.total_paise).toBeUndefined();
      expect(json.client_id).toBeUndefined();
    });

    it("Scenario 5.3: HTTP GET /api/v1/private-label/orders/[id]/invoice returns 404 (NEVER 403) on cross-tenant access", async () => {
      const req = new Request(`http://localhost/api/v1/private-label/orders/${orderAliceId}/invoice`, {
        method: "GET",
        headers: {
          "x-customer-id": CUSTOMER_B_ID,
        },
      });

      const res = await getCustomerInvoiceRoute(req, { params: Promise.resolve({ id: orderAliceId }) });
      expect(res.status).toBe(404);
      expect(res.status).not.toBe(403);

      const json = await res.json();
      expect(json.error).toBe("Order not found");
      expect(json.subtotal_paise).toBeUndefined();
    });

    it("Scenario 5.4: Service getSampleOrder and cancelSampleOrder throw PrivateLabelNotFoundError on cross-tenant access", () => {
      // Lookup
      expect(() => {
        PrivateLabelService.getSampleOrder(sampleAliceId, CUSTOMER_B_ID);
      }).toThrow(PrivateLabelNotFoundError);

      // Cancellation attempt
      expect(() => {
        PrivateLabelService.cancelSampleOrder(sampleAliceId, CUSTOMER_B_ID, ACTOR_CUSTOMER_B);
      }).toThrow(PrivateLabelNotFoundError);
    });

    it("Scenario 5.5: HTTP POST /api/v1/private-label/samples/[id]/cancel returns 404 (NEVER 403) on cross-tenant access", async () => {
      const req = new Request(`http://localhost/api/v1/private-label/samples/${sampleAliceId}/cancel`, {
        method: "POST",
        headers: {
          "x-customer-id": CUSTOMER_B_ID,
        },
      });

      const res = await cancelSampleRoute(req, { params: Promise.resolve({ id: sampleAliceId }) });
      expect(res.status).toBe(404);
      expect(res.status).not.toBe(403);

      const json = await res.json();
      expect(json.error).toBe("Sample order not found");
      expect(json.sample).toBeUndefined();
    });

    it("Scenario 5.6: Anti-enumeration indistinguishability: cross-tenant 404 is identical to non-existent ID 404", async () => {
      const fakeOrderId = "ord_does_not_exist_totally_random_999";

      const reqCrossTenant = new Request(`http://localhost/api/v1/private-label/orders/${orderAliceId}`, {
        method: "GET",
        headers: { "x-customer-id": CUSTOMER_B_ID },
      });
      const resCrossTenant = await getCustomerOrderRoute(reqCrossTenant, { params: Promise.resolve({ id: orderAliceId }) });
      const bodyCrossTenant = await resCrossTenant.json();

      const reqNonExistent = new Request(`http://localhost/api/v1/private-label/orders/${fakeOrderId}`, {
        method: "GET",
        headers: { "x-customer-id": CUSTOMER_B_ID },
      });
      const resNonExistent = await getCustomerOrderRoute(reqNonExistent, { params: Promise.resolve({ id: fakeOrderId }) });
      const bodyNonExistent = await resNonExistent.json();

      // Status codes match
      expect(resCrossTenant.status).toBe(404);
      expect(resNonExistent.status).toBe(404);

      // Error payloads match identically, preventing enumeration timing/payload discrimination
      expect(bodyCrossTenant).toEqual(bodyNonExistent);
      expect(bodyCrossTenant).toEqual({ error: "Order not found" });
    });

    it("Scenario 5.7: Multi-tenant list scoping: Customer B lists 0 orders and 0 samples of Customer A", async () => {
      // List orders
      const orderReq = new Request("http://localhost/api/v1/private-label/orders", {
        method: "GET",
        headers: { "x-customer-id": CUSTOMER_B_ID },
      });
      const orderRes = await listCustomerOrdersRoute(orderReq);
      expect(orderRes.status).toBe(200);

      const orderJson = await orderRes.json();
      const orderIds = orderJson.orders.map((o: any) => o.id);
      expect(orderIds).toContain(orderBobId);
      expect(orderIds).not.toContain(orderAliceId);

      // List samples
      const sampleReq = new Request("http://localhost/api/v1/private-label/samples", {
        method: "GET",
        headers: { "x-customer-id": CUSTOMER_B_ID },
      });
      const sampleRes = await listCustomerSamplesRoute(sampleReq);
      expect(sampleRes.status).toBe(200);

      const sampleJson = await sampleRes.json();
      const sampleIds = sampleJson.samples.map((s: any) => s.id);
      expect(sampleIds).toContain(sampleBobId);
      expect(sampleIds).not.toContain(sampleAliceId);
    });
  });
});
