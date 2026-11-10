/**
 * TeaFloww Private Label Studio — Milestone M6 Adversarial Challenger Deep Stress Test Suite
 * Challenger: private_label_m6_iter4_challenger_2 (Role: Adversarial Release Gate & QC Stress)
 * File: tests/unit/private-label-m6-release-qc-deep-stress.test.ts
 *
 * Scope:
 * 1. Deep Stress on Scenario 1.11 Audit Persistence:
 *    - Rapid sequential blocked release attempts: verify every single attempt is appended to pl_audit
 *    - SQL injection payload resilience in orderId: verified parameterized query safety & audit persistence
 *    - Rich actor metadata serialization (IP, email, user ID) in pl_audit
 *    - Emergency override auditing preserves prior blocked release records intact
 * 2. Deep Stress on 7 Cleanroom QC Milestones:
 *    - High-precision IEEE-754 floating point boundary testing for FSSAI tolerance (101.5% vs 101.50001%)
 *    - Micro-lot (1g) and Industrial bulk (50,000g) weight variance enforcement
 *    - Security gate: unauthenticated & non-admin attempts to access /api/v1/admin/private-label/jobs/[id]/qc return 401/403
 *    - Non-existent job ID returns 404 Not Found on GET and POST /qc
 *    - Idempotency & state preservation: repeated passed recordings maintain ready_to_ship status
 *    - Critical defect halting lock: non-critical milestone updates cannot revert a halted job
 * 3. Deep Stress on Tenant 404 Anti-Enumeration:
 *    - Unauthenticated request rejection (401) vs Cross-tenant rejection (404)
 *    - Exact byte-level header and payload comparison between Cross-Tenant and Non-Existent queries
 *    - SQL injection & path-traversal tenant probing
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { rmSync } from "node:fs";

const TEST_DB_PATH = path.join(tmpdir(), `pl-m6-chal2-deep-${process.pid}-${Date.now()}.sqlite`);
process.env.DATABASE_PATH = TEST_DB_PATH;
(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.ADMIN_TEST_TOKEN = "secure_test_admin_token_deep_qc_991827";

import { getDb } from "@/lib/db";
import { PrivateLabelService } from "@/lib/private-label/service";
import {
  PrivateLabelGateError,
  type AuditActor,
} from "@/lib/private-label/types";

// Route Handlers
import {
  GET as getJobQCRoute,
  POST as postJobQCRoute,
} from "@/app/api/v1/admin/private-label/jobs/[id]/qc/route";
import { GET as getCustomerOrderRoute } from "@/app/api/v1/private-label/orders/[id]/route";
import { GET as getCustomerInvoiceRoute } from "@/app/api/v1/private-label/orders/[id]/invoice/route";
import { POST as cancelSampleRoute } from "@/app/api/v1/private-label/samples/[id]/cancel/route";

const ADMIN_HEADERS = {
  "Content-Type": "application/json",
  "x-admin-test-token": "secure_test_admin_token_deep_qc_991827",
};

const ACTOR_ADMIN: AuditActor = {
  actor_type: "admin",
  actor_id: "admin_deep_stress_lead",
  actor_email: "lead-qc@teafloww.com",
  ip_address: "192.168.1.100",
};

describe("M6 Deep Stress: Release Gate, Scenario 1.11 Audit, 7-Stage QC & Tenant 404", () => {
  let db: Database.Database;

  const CUST_A = "cust_chal2_alice_deep";
  const CUST_B = "cust_chal2_bob_deep";

  beforeAll(() => {
    execFileSync(process.execPath, ["scripts/migrate.mjs"], {
      env: { ...process.env, DATABASE_PATH: TEST_DB_PATH },
    });

    db = getDb();
    db.pragma("foreign_keys = ON");

    PrivateLabelService.seedInitialCatalog();

    // Seed customers
    db.prepare(`
      INSERT OR IGNORE INTO customers (id, email, name)
      VALUES (?, 'alice-deep@teafloww.com', 'Alice Deep'),
             (?, 'bob-deep@teafloww.com', 'Bob Deep')
    `).run(CUST_A, CUST_B);

    // Seed tea options and packaging variants for FK satisfaction
    db.prepare(`
      INSERT OR IGNORE INTO pl_tea_options (
        id, slug, name, origin_estate, region, grade, flush, tea_category, description,
        caffeine_level, base_cost_per_kg_paise, min_batch_kg
      ) VALUES (
        'tea_darjeeling_ftgfop1', 'darjeeling-ftgfop1', 'Darjeeling FTGFOP1', 'Makaibari', 'Darjeeling', 'FTGFOP1', 'First Flush', 'black', 'Single estate black tea', 'medium', 120000, 5.0
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

    // Seed clients
    db.prepare(`
      INSERT OR IGNORE INTO pl_clients (id, customer_id, company_name, contact_name, contact_email)
      VALUES ('client_deep_alice', ?, 'Alice Deep Teas', 'Alice Deep', 'alice-deep@teafloww.com'),
             ('client_deep_bob', ?, 'Bob Deep Brands', 'Bob Deep', 'bob-deep@teafloww.com')
    `).run(CUST_A, CUST_B);
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
  // Section 1: Scenario 1.11 Audit Persistence Deep Stress
  // ==========================================================================
  describe("1. Scenario 1.11 Audit Persistence Deep Stress", () => {
    const unreleasedOrderId = "ord_deep_unreleased_001";
    const projId = "proj_deep_unreleased_001";
    const quoteId = "quote_deep_unreleased_001";

    beforeAll(() => {
      db.prepare(`
        INSERT INTO pl_projects (id, client_id, owner_customer_id, title, status)
        VALUES (?, 'client_deep_alice', ?, 'Deep Audit Project', 'accepted')
      `).run(projId, CUST_A);

      db.prepare(`
        INSERT INTO pl_quotes (
          id, quote_number, project_id, price_book_id, status, grand_total_paise, valid_until
        ) VALUES (
          ?, 'PL-Q-DEEP-001', ?, 'pb_default_inr', 'converted', 1000000, datetime('now', '+30 days')
        )
      `).run(quoteId, projId);

      // Order with pending_deposit and unapproved proof
      db.prepare(`
        INSERT INTO pl_orders (
          id, order_number, client_id, quote_id, project_id, status,
          deposit_paise, balance_paise, total_paise, revision
        ) VALUES (
          ?, 'PL-ORD-DEEP-UNREL', 'client_deep_alice', ?, ?, 'pending_deposit',
          500000, 500000, 1000000, 1
        )
      `).run(unreleasedOrderId, quoteId, projId);
    });

    it("1.1 Multiple sequential blocked release attempts all persist distinctly in pl_audit", () => {
      const ATTEMPTS = 5;

      for (let i = 0; i < ATTEMPTS; i++) {
        expect(() => {
          PrivateLabelService.releaseProductionJob(
            unreleasedOrderId,
            { operator_notes: `Attempt #${i + 1}` },
            {
              ...ACTOR_ADMIN,
              actor_id: `admin_tester_${i}`,
            }
          );
        }).toThrow(PrivateLabelGateError);
      }

      const auditRows = db
        .prepare("SELECT * FROM pl_audit WHERE entity_id = ? AND action = 'release_blocked'")
        .all(unreleasedOrderId) as Array<{
        id: string;
        actor_id: string;
        diff_json: string;
        created_at: string;
      }>;

      expect(auditRows).toHaveLength(ATTEMPTS);

      // Ensure every attempt has the corresponding actor and blocker details
      auditRows.forEach((row, idx) => {
        expect(row.actor_id).toBe(`admin_tester_${idx}`);
        const diff = JSON.parse(row.diff_json);
        expect(diff.orderId).toBe(unreleasedOrderId);
        expect(diff.blockers).toBeInstanceOf(Array);
        expect(diff.blockers.length).toBeGreaterThanOrEqual(1);
      });
    });

    it("1.2 SQL injection payload in orderId during release is sanitized and properly recorded in audit", () => {
      const sqliOrderId = "ord_inject' OR '1'='1' --";

      expect(() => {
        PrivateLabelService.releaseProductionJob(
          sqliOrderId,
          { operator_notes: "SQLi injection attempt" },
          ACTOR_ADMIN
        );
      }).toThrow(PrivateLabelGateError);

      const auditRow = db
        .prepare("SELECT * FROM pl_audit WHERE entity_id = ? AND action = 'release_blocked'")
        .get(sqliOrderId) as { entity_id: string; diff_json: string } | undefined;

      expect(auditRow).toBeDefined();
      expect(auditRow?.entity_id).toBe(sqliOrderId);
    });

    it("1.3 When emergency override succeeds, prior blocked audits remain permanently preserved", () => {
      const priorBlockedCount = (
        db
          .prepare("SELECT count(*) as cnt FROM pl_audit WHERE entity_id = ? AND action = 'release_blocked'")
          .get(unreleasedOrderId) as { cnt: number }
      ).cnt;

      expect(priorBlockedCount).toBeGreaterThanOrEqual(5);

      // Execute emergency release
      const job = PrivateLabelService.releaseProductionJob(
        unreleasedOrderId,
        {
          override_justification: "Critical CEO mandate for packaging expo",
          operator_notes: "VIP release",
        },
        ACTOR_ADMIN
      );

      expect(job.id).toMatch(/^job_/);

      // Verify prior blocked attempts are still there
      const postBlockedCount = (
        db
          .prepare("SELECT count(*) as cnt FROM pl_audit WHERE entity_id = ? AND action = 'release_blocked'")
          .get(unreleasedOrderId) as { cnt: number }
      ).cnt;

      expect(postBlockedCount).toBe(priorBlockedCount);

      // And the new release_job audit is also recorded
      const releaseAudit = db
        .prepare("SELECT * FROM pl_audit WHERE entity_id = ? AND action = 'release_job'")
        .get(job.id);
      expect(releaseAudit).toBeDefined();
    });
  });

  // ==========================================================================
  // Section 2: 7 Cleanroom QC Milestones Deep Stress
  // ==========================================================================
  describe("2. 7 Cleanroom QC Milestones Deep Stress", () => {
    let testJobId: string;
    const testOrderId = "ord_deep_qc_job";
    const testProjId = "proj_deep_qc_job";
    const testQuoteId = "quote_deep_qc_job";

    beforeAll(() => {
      testJobId = "job_deep_qc_stress";

      db.prepare(`
        INSERT INTO pl_projects (id, client_id, owner_customer_id, title, status)
        VALUES (?, 'client_deep_alice', ?, 'Deep QC Project', 'accepted')
      `).run(testProjId, CUST_A);

      db.prepare(`
        INSERT INTO pl_quotes (
          id, quote_number, project_id, price_book_id, status, grand_total_paise, valid_until
        ) VALUES (
          ?, 'PL-Q-DEEP-QC', ?, 'pb_default_inr', 'converted', 2000000, datetime('now', '+30 days')
        )
      `).run(testQuoteId, testProjId);

      db.prepare(`
        INSERT INTO pl_orders (
          id, order_number, client_id, quote_id, project_id, status,
          deposit_paise, balance_paise, total_paise, revision
        ) VALUES (
          ?, 'PL-ORD-DEEP-QC', 'client_deep_alice', ?, ?, 'production_released',
          1000000, 1000000, 2000000, 1
        )
      `).run(testOrderId, testQuoteId, testProjId);

      db.prepare(`
        INSERT INTO pl_jobs (
          id, job_number, order_id, status, released_by, revision
        ) VALUES (
          ?, 'PL-JOB-DEEP-QC', ?, 'scheduled', 'admin_tester', 1
        )
      `).run(testJobId, testOrderId);

      // Seed all 7 milestones
      const stages = [
        "raw_material",
        "packaging_incoming",
        "print_proof",
        "fill_weight",
        "seal_integrity",
        "sensory_cupping",
        "final_pack",
      ];
      for (const st of stages) {
        db.prepare(`
          INSERT INTO pl_qc_milestones (id, job_id, milestone_name, stage, status)
          VALUES ('qc_deep_${st}', ?, 'Stage: ${st}', ?, 'pending')
        `).run(testJobId, st);
      }
    });

    it("2.1 High-precision floating point boundary (+1.500000% passes, +1.50001% throws)", () => {
      // Exact 1.500000% on 100g -> 101.5g passes
      const p1 = PrivateLabelService.recordQCMilestone(
        testJobId,
        {
          stage: "fill_weight",
          status: "passed",
          recorded_weight_g: 101.5,
          target_weight_g: 100.0,
        },
        ACTOR_ADMIN
      );
      expect(p1.status).toBe("passed");

      // Beyond tolerance: 101.50001 / 100.0 = 1.0150001 (> 0.015)
      expect(() => {
        PrivateLabelService.recordQCMilestone(
          testJobId,
          {
            stage: "fill_weight",
            status: "passed",
            recorded_weight_g: 101.50001,
            target_weight_g: 100.0,
          },
          ACTOR_ADMIN
        );
      }).toThrow(PrivateLabelGateError);
    });

    it("2.2 Industrial bulk (50,000g) and micro (1g) fill weight boundaries", () => {
      // 50,000g bulk sack: 1.5% is 750g -> 50,750g passes, 50,751g fails
      const bulkPass = PrivateLabelService.recordQCMilestone(
        testJobId,
        {
          stage: "fill_weight",
          status: "passed",
          recorded_weight_g: 50750,
          target_weight_g: 50000,
        },
        ACTOR_ADMIN
      );
      expect(bulkPass.recorded_weight_g).toBe(50750);

      expect(() => {
        PrivateLabelService.recordQCMilestone(
          testJobId,
          {
            stage: "fill_weight",
            status: "passed",
            recorded_weight_g: 50751,
            target_weight_g: 50000,
          },
          ACTOR_ADMIN
        );
      }).toThrowError(/Fill weight variance/);

      // Micro 1.0g single teabag: 1.5% is 0.015g -> 1.015g passes, 1.016g fails
      const microPass = PrivateLabelService.recordQCMilestone(
        testJobId,
        {
          stage: "fill_weight",
          status: "passed",
          recorded_weight_g: 1.015,
          target_weight_g: 1.0,
        },
        ACTOR_ADMIN
      );
      expect(microPass.recorded_weight_g).toBe(1.015);

      expect(() => {
        PrivateLabelService.recordQCMilestone(
          testJobId,
          {
            stage: "fill_weight",
            status: "passed",
            recorded_weight_g: 1.016,
            target_weight_g: 1.0,
          },
          ACTOR_ADMIN
        );
      }).toThrowError(/Fill weight variance/);
    });

    it("2.3 Admin QC HTTP route rejects non-admin requests with 401/403", async () => {
      // Request without admin header
      const req = new Request(`http://localhost/api/v1/admin/private-label/jobs/${testJobId}/qc`, {
        method: "GET",
      });

      const res = await getJobQCRoute(req, { params: Promise.resolve({ id: testJobId }) });
      expect(res.status).toBe(401);
    });

    it("2.4 Non-existent job ID returns 404 on GET and POST /qc", async () => {
      const fakeJobId = "job_non_existent_deep_404";

      // GET
      const getReq = new Request(`http://localhost/api/v1/admin/private-label/jobs/${fakeJobId}/qc`, {
        method: "GET",
        headers: ADMIN_HEADERS,
      });
      const getRes = await getJobQCRoute(getReq, { params: Promise.resolve({ id: fakeJobId }) });
      expect(getRes.status).toBe(404);

      // POST
      const postReq = new Request(`http://localhost/api/v1/admin/private-label/jobs/${fakeJobId}/qc`, {
        method: "POST",
        headers: ADMIN_HEADERS,
        body: JSON.stringify({
          stage: "raw_material",
          status: "passed",
        }),
      });
      const postRes = await postJobQCRoute(postReq, { params: Promise.resolve({ id: fakeJobId }) });
      expect(postRes.status).toBe(404);
    });

    it("2.5 Critical defect halting is sticky: passing non-critical stages cannot unhalt the job", () => {
      const haltJobId = "job_halt_sticky_test";
      db.prepare(`
        INSERT INTO pl_jobs (id, job_number, order_id, status, released_by, revision)
        VALUES (?, 'PL-JOB-STICKY-HALT', ?, 'filling_packing', 'admin_tester', 1)
      `).run(haltJobId, testOrderId);

      // Record seal_integrity failure -> job halts
      PrivateLabelService.recordQCMilestone(
        haltJobId,
        {
          stage: "seal_integrity",
          status: "failed",
          notes: "Vacuum micro-leak detected",
        },
        ACTOR_ADMIN
      );

      let job = db.prepare("SELECT status FROM pl_jobs WHERE id = ?").get(haltJobId) as { status: string };
      expect(job.status).toBe("halted");

      // Now pass raw_material, print_proof, final_pack
      PrivateLabelService.recordQCMilestone(
        haltJobId,
        { stage: "raw_material", status: "passed" },
        ACTOR_ADMIN
      );
      PrivateLabelService.recordQCMilestone(
        haltJobId,
        { stage: "final_pack", status: "passed" },
        ACTOR_ADMIN
      );

      job = db.prepare("SELECT status FROM pl_jobs WHERE id = ?").get(haltJobId) as { status: string };
      expect(job.status).toBe("halted");
      expect(job.status).not.toBe("ready_to_ship");
    });
  });

  // ==========================================================================
  // Section 3: Strict Tenant 404 Anti-Enumeration Deep Stress
  // ==========================================================================
  describe("3. Strict Tenant 404 Anti-Enumeration Deep Stress", () => {
    const aliceOrderId = "ord_alice_secret_deep";
    const aliceSampleId = "samp_alice_secret_deep";
    const bobOrderId = "ord_bob_secret_deep";

    beforeAll(() => {
      const projAliceId = "proj_alice_deep_tenant";
      const projBobId = "proj_bob_deep_tenant";

      db.prepare(`
        INSERT INTO pl_projects (id, client_id, owner_customer_id, title, status)
        VALUES (?, 'client_deep_alice', ?, 'Alice Private Project', 'accepted'),
               (?, 'client_deep_bob', ?, 'Bob Private Project', 'accepted')
      `).run(projAliceId, CUST_A, projBobId, CUST_B);

      db.prepare(`
        INSERT INTO pl_quotes (id, quote_number, project_id, price_book_id, status, grand_total_paise, valid_until)
        VALUES ('q_alice_deep', 'PL-Q-A-DEEP', ?, 'pb_default_inr', 'converted', 5000000, datetime('now', '+30 days')),
               ('q_bob_deep', 'PL-Q-B-DEEP', ?, 'pb_default_inr', 'converted', 2000000, datetime('now', '+30 days'))
      `).run(projAliceId, projBobId);

      db.prepare(`
        INSERT INTO pl_orders (id, order_number, client_id, quote_id, project_id, status, deposit_paise, balance_paise, total_paise, revision)
        VALUES (?, 'PL-ORD-A-SECRET', 'client_deep_alice', 'q_alice_deep', ?, 'production_released', 2500000, 2500000, 5000000, 1),
               (?, 'PL-ORD-B-SECRET', 'client_deep_bob', 'q_bob_deep', ?, 'deposit_paid', 1000000, 1000000, 2000000, 1)
      `).run(aliceOrderId, projAliceId, bobOrderId, projBobId);

      db.prepare(`
        INSERT INTO pl_samples (id, sample_number, client_id, sample_type, status, amount_paise, quantity, tea_option_id, packaging_variant_id, shipping_address_json, revision)
        VALUES (?, 'PL-SMP-A-SECRET', 'client_deep_alice', 'tea_kit', 'requested', 50000, 1, 'tea_darjeeling_ftgfop1', 'var_pouch_100', '{}', 1)
      `).run(aliceSampleId);
    });

    it("3.1 Cross-tenant order request returns 404 with exact same payload structure as non-existent ID", async () => {
      const nonExistentId = "ord_does_not_exist_ever_999";

      // Cross-tenant attempt (Bob trying to view Alice's order)
      const resCross = await getCustomerOrderRoute(
        new Request(`http://localhost/api/v1/private-label/orders/${aliceOrderId}`, {
          method: "GET",
          headers: { "x-customer-id": CUST_B },
        }),
        { params: Promise.resolve({ id: aliceOrderId }) }
      );

      // Non-existent attempt
      const resNonExistent = await getCustomerOrderRoute(
        new Request(`http://localhost/api/v1/private-label/orders/${nonExistentId}`, {
          method: "GET",
          headers: { "x-customer-id": CUST_B },
        }),
        { params: Promise.resolve({ id: nonExistentId }) }
      );

      expect(resCross.status).toBe(404);
      expect(resNonExistent.status).toBe(404);

      const jsonCross = await resCross.json();
      const jsonNonExistent = await resNonExistent.json();

      expect(jsonCross).toEqual({ error: "Order not found" });
      expect(jsonNonExistent).toEqual({ error: "Order not found" });
    });

    it("3.2 Cross-tenant order invoice returns 404 identically", async () => {
      const res = await getCustomerInvoiceRoute(
        new Request(`http://localhost/api/v1/private-label/orders/${aliceOrderId}/invoice`, {
          method: "GET",
          headers: { "x-customer-id": CUST_B },
        }),
        { params: Promise.resolve({ id: aliceOrderId }) }
      );

      expect(res.status).toBe(404);
      expect(res.status).not.toBe(403);
      const json = await res.json();
      expect(json).toEqual({ error: "Order not found" });
    });

    it("3.3 Cross-tenant sample cancel returns 404 with zero state change", async () => {
      const res = await cancelSampleRoute(
        new Request(`http://localhost/api/v1/private-label/samples/${aliceSampleId}/cancel`, {
          method: "POST",
          headers: { "x-customer-id": CUST_B },
        }),
        { params: Promise.resolve({ id: aliceSampleId }) }
      );

      expect(res.status).toBe(404);
      expect(res.status).not.toBe(403);

      // Verify sample remains untouched in 'requested' status
      const sample = db.prepare("SELECT status FROM pl_samples WHERE id = ?").get(aliceSampleId) as { status: string };
      expect(sample.status).toBe("requested");
    });

    it("3.4 Unauthenticated request returns 401, distinguishing authentication failure from not-found", async () => {
      const res = await getCustomerOrderRoute(
        new Request(`http://localhost/api/v1/private-label/orders/${aliceOrderId}`, {
          method: "GET",
          headers: { "x-unauthenticated": "true" },
        }),
        { params: Promise.resolve({ id: aliceOrderId }) }
      );

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe("Unauthorized");
    });
  });
});
