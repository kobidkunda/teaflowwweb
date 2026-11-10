/**
 * TeaFloww Private Label Studio — Milestone M2 Adversarial Test Suite
 * Agent: private_label_m2_challenger_2
 * Focus:
 *  1. QC Completion Gate Enforcement (all 7 stages, pending/failed blockers, HTTP 422, passed/waived transitions)
 *  2. Quote Price Overrides & Indian Dual-Rate GST Mathematics (zero cost, 1 paisa rounding edges, huge quantities, 5% tea vs 18% services/materials/margin, NaN/null safety, exact paise arithmetic)
 *  3. Price Book Tier Validations (overlapping quantity tier detection, negative rates, default price book deletion safeguards)
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { rmSync } from "node:fs";

const TEST_DB = path.join(tmpdir(), `pl-m2-challenger-2-${process.pid}-${Date.now()}.sqlite`);
process.env.DATABASE_PATH = TEST_DB;
(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.ADMIN_TEST_TOKEN = "challenger_admin_token_xyz987";

import { getDb } from "@/lib/db";
import { PrivateLabelService } from "@/lib/private-label/service";
import {
  GET as getQuotes,
  POST as postQuotes,
} from "@/app/api/v1/admin/private-label/quotes/route";
import {
  GET as getQuoteDetail,
  PATCH as patchQuoteDetail,
} from "@/app/api/v1/admin/private-label/quotes/[id]/route";
import {
  GET as getJobs,
  POST as postJobs,
} from "@/app/api/v1/admin/private-label/jobs/route";
import {
  GET as getJobDetail,
  PATCH as patchJobDetail,
} from "@/app/api/v1/admin/private-label/jobs/[id]/route";
import {
  GET as getPriceBooks,
  POST as postPriceBooks,
} from "@/app/api/v1/admin/private-label/price-books/route";
import {
  GET as getPriceBookDetail,
  PATCH as patchPriceBookDetail,
  DELETE as deletePriceBookDetail,
} from "@/app/api/v1/admin/private-label/price-books/[id]/route";
import {
  adminCreatePriceBookSchema,
  adminUpdatePriceBookSchema,
  adminQuotePriceOverrideSchema,
  adminUpdateQuoteSchema,
  adminUpdateJobSchema,
  qcMilestoneSchema,
} from "@/lib/private-label/schemas";
import {
  PrivateLabelGateError,
  PrivateLabelNotFoundError,
  PrivateLabelRevisionConflictError,
  type AuditActor,
} from "@/lib/private-label/types";

const ADMIN_HEADERS = {
  "Content-Type": "application/json",
  "x-admin-test-token": "challenger_admin_token_xyz987",
};

const ACTOR: AuditActor = {
  actor_type: "admin",
  actor_id: "admin_challenger",
  actor_email: "challenger2@teafloww.com",
};

const STANDARD_QC_STAGES = [
  "raw_material",
  "packaging_incoming",
  "print_proof",
  "fill_weight",
  "seal_integrity",
  "sensory_cupping",
  "final_pack",
] as const;

describe("Milestone M2 Adversarial Challenger 2 Suite", () => {
  beforeAll(() => {
    execFileSync(process.execPath, ["scripts/migrate.mjs"], {
      env: { ...process.env, DATABASE_PATH: TEST_DB },
    });

    const db = getDb();
    PrivateLabelService.seedInitialCatalog();

    // Seed test customer & client records
    db.prepare(`
      INSERT OR IGNORE INTO customers (id, email, name)
      VALUES ('cust_ch2_001', 'b2b_client@example.com', 'Tea Brand Co')
    `).run();

    db.prepare(`
      INSERT OR IGNORE INTO pl_clients (id, customer_id, company_name, contact_name, contact_email)
      VALUES ('client_ch2_001', 'cust_ch2_001', 'Tea Brand Private Limited', 'Vikram Sen', 'b2b_client@example.com')
    `).run();

    db.prepare(`
      INSERT OR IGNORE INTO pl_projects (id, client_id, title, status, target_market, revision)
      VALUES ('proj_ch2_001', 'client_ch2_001', 'Challenger Test Project', 'draft', 'IN', 1)
    `).run();

    db.prepare(`
      INSERT OR IGNORE INTO pl_quotes (id, quote_number, project_id, price_book_id, status, version, currency, grand_total_paise, revision)
      VALUES ('quote_ch2_dummy', 'PL-Q-CH2-DUMMY', 'proj_ch2_001', 'pb_default_inr', 'firm_issued', 1, 'INR', 100000, 1)
    `).run();

    db.prepare(`
      INSERT OR IGNORE INTO pl_orders (id, order_number, client_id, quote_id, status, deposit_paise, balance_paise, revision)
      VALUES ('order_ch2_dummy_1', 'PL-ORD-CH2-01', 'client_ch2_001', 'quote_ch2_dummy', 'deposit_paid', 50000, 50000, 1),
             ('order_ch2_dummy_2', 'PL-ORD-CH2-02', 'client_ch2_001', 'quote_ch2_dummy', 'deposit_paid', 50000, 50000, 1),
             ('order_ch2_dummy_3', 'PL-ORD-CH2-03', 'client_ch2_001', 'quote_ch2_dummy', 'deposit_paid', 50000, 50000, 1)
    `).run();
  });

  afterAll(() => {
    try {
      rmSync(TEST_DB, { force: true });
      rmSync(`${TEST_DB}-wal`, { force: true });
      rmSync(`${TEST_DB}-shm`, { force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  // ============================================================================
  // Suite 1: QC Completion Gate Enforcement Stress Testing
  // ============================================================================
  describe("Suite 1: QC Completion Gate Enforcement Stress Testing", () => {
    let freshJobId: string;

    beforeAll(() => {
      const db = getDb();
      freshJobId = `job_qc_fresh_${Date.now()}`;
      db.prepare(`
        INSERT INTO pl_jobs (id, job_number, order_id, status, released_by)
        VALUES (?, 'PL-JOB-CH2-01', 'order_ch2_dummy_1', 'scheduled', 'admin_challenger')
      `).run(freshJobId);

      for (const st of STANDARD_QC_STAGES) {
        db.prepare(`
          INSERT INTO pl_qc_milestones (id, job_id, milestone_name, stage, status)
          VALUES (?, ?, ?, ?, 'pending')
        `).run(`qc_fresh_${st}_${Date.now()}`, freshJobId, `Inspection for ${st}`, st);
      }
    });

    it("1.1 Fresh job with 7 pending milestones blocks ready_to_ship with 422 & 7 blockers", async () => {
      // 1. Service level check
      const gateResult = PrivateLabelService.validateQCGate(freshJobId);
      expect(gateResult.canPublish).toBe(false);
      expect(gateResult.blockers).toHaveLength(7);
      for (const st of STANDARD_QC_STAGES) {
        expect(gateResult.blockers.some((b) => b.includes(st) && b.includes("pending"))).toBe(true);
      }

      // Throws PrivateLabelGateError directly
      expect(() => {
        PrivateLabelService.updateJobStatus(freshJobId, "ready_to_ship", ACTOR);
      }).toThrowError(PrivateLabelGateError);

      try {
        PrivateLabelService.updateJobStatus(freshJobId, "ready_to_ship", ACTOR);
      } catch (err) {
        const gateErr = err as PrivateLabelGateError;
        expect(gateErr.gate_name).toBe("qc_completion_gate");
        expect(gateErr.blockers).toHaveLength(7);
      }

      // 2. API level check
      const req = new Request(`http://localhost/api/v1/admin/private-label/jobs/${freshJobId}`, {
        method: "PATCH",
        headers: ADMIN_HEADERS,
        body: JSON.stringify({ status: "ready_to_ship" }),
      });
      const res = await patchJobDetail(req, { params: Promise.resolve({ id: freshJobId }) });
      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.gate_name).toBe("qc_completion_gate");
      expect(data.blockers).toHaveLength(7);
    });

    it("1.2 Fresh job with 7 pending milestones blocks completed with 422 & 7 blockers", async () => {
      // Throws PrivateLabelGateError on completed
      expect(() => {
        PrivateLabelService.updateJobStatus(freshJobId, "completed", ACTOR);
      }).toThrowError(PrivateLabelGateError);

      // API level check
      const req = new Request(`http://localhost/api/v1/admin/private-label/jobs/${freshJobId}`, {
        method: "PATCH",
        headers: ADMIN_HEADERS,
        body: JSON.stringify({ status: "completed" }),
      });
      const res = await patchJobDetail(req, { params: Promise.resolve({ id: freshJobId }) });
      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.gate_name).toBe("qc_completion_gate");
      expect(data.blockers).toHaveLength(7);
    });

    it("1.3 Non-completion status transitions (procurement, printing, blending, filling_packing, qc, halted) are permitted without gate blockers, while invalid statuses are rejected", async () => {
      // Invalid status rejected
      const reqInvalid = new Request(`http://localhost/api/v1/admin/private-label/jobs/${freshJobId}`, {
        method: "PATCH",
        headers: ADMIN_HEADERS,
        body: JSON.stringify({ status: "in_production" }), // invalid enum value
      });
      const resInvalid = await patchJobDetail(reqInvalid, { params: Promise.resolve({ id: freshJobId }) });
      expect(resInvalid.status).toBe(400);

      // Valid intermediate statuses
      const validIntermediateStatuses: Array<"procurement" | "printing" | "blending" | "filling_packing" | "qc" | "halted"> = [
        "procurement",
        "printing",
        "blending",
        "filling_packing",
        "qc",
        "halted",
      ];

      for (const st of validIntermediateStatuses) {
        const req = new Request(`http://localhost/api/v1/admin/private-label/jobs/${freshJobId}`, {
          method: "PATCH",
          headers: ADMIN_HEADERS,
          body: JSON.stringify({ status: st, operator_notes: `Shifted to ${st}` }),
        });
        const res = await patchJobDetail(req, { params: Promise.resolve({ id: freshJobId }) });
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.job.status).toBe(st);
      }
    });

    it("1.4 Partial milestone progression (1 to 6 passed) still strictly blocks ready_to_ship & completed", async () => {
      const db = getDb();

      // Pass 1 milestone
      db.prepare("UPDATE pl_qc_milestones SET status = 'passed' WHERE job_id = ? AND stage = 'raw_material'").run(freshJobId);

      let req = new Request(`http://localhost/api/v1/admin/private-label/jobs/${freshJobId}`, {
        method: "PATCH",
        headers: ADMIN_HEADERS,
        body: JSON.stringify({ status: "ready_to_ship" }),
      });
      let res = await patchJobDetail(req, { params: Promise.resolve({ id: freshJobId }) });
      expect(res.status).toBe(422);
      let data = await res.json();
      expect(data.blockers).toHaveLength(6);
      expect(data.blockers.some((b: string) => b.includes("raw_material"))).toBe(false);

      // Pass 5 milestones total, waive 1 milestone, leave 1 pending ('final_pack')
      db.prepare(`
        UPDATE pl_qc_milestones
        SET status = 'passed'
        WHERE job_id = ? AND stage IN ('packaging_incoming', 'print_proof', 'fill_weight', 'sensory_cupping')
      `).run(freshJobId);

      db.prepare(`
        UPDATE pl_qc_milestones
        SET status = 'waived', evidence_notes = 'Supplier vacuum certificate on file'
        WHERE job_id = ? AND stage = 'seal_integrity'
      `).run(freshJobId);

      // Now 6/7 are passed/waived. 1 ('final_pack') remains pending
      req = new Request(`http://localhost/api/v1/admin/private-label/jobs/${freshJobId}`, {
        method: "PATCH",
        headers: ADMIN_HEADERS,
        body: JSON.stringify({ status: "ready_to_ship" }),
      });
      res = await patchJobDetail(req, { params: Promise.resolve({ id: freshJobId }) });
      expect(res.status).toBe(422);
      data = await res.json();
      expect(data.blockers).toHaveLength(1);
      expect(data.blockers[0]).toContain("final_pack");
      expect(data.blockers[0]).toContain("pending");

      // Verify completed is also blocked
      req = new Request(`http://localhost/api/v1/admin/private-label/jobs/${freshJobId}`, {
        method: "PATCH",
        headers: ADMIN_HEADERS,
        body: JSON.stringify({ status: "completed" }),
      });
      res = await patchJobDetail(req, { params: Promise.resolve({ id: freshJobId }) });
      expect(res.status).toBe(422);
      data = await res.json();
      expect(data.blockers).toHaveLength(1);
      expect(data.blockers[0]).toContain("final_pack");
    });

    it("1.5 A single failed milestone strictly blocks transition with diagnostic message", async () => {
      const db = getDb();
      // Fail final_pack
      db.prepare("UPDATE pl_qc_milestones SET status = 'failed' WHERE job_id = ? AND stage = 'final_pack'").run(freshJobId);

      const req = new Request(`http://localhost/api/v1/admin/private-label/jobs/${freshJobId}`, {
        method: "PATCH",
        headers: ADMIN_HEADERS,
        body: JSON.stringify({ status: "ready_to_ship" }),
      });
      const res = await patchJobDetail(req, { params: Promise.resolve({ id: freshJobId }) });
      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.blockers).toHaveLength(1);
      expect(data.blockers[0]).toBe("QC milestone 'final_pack' is not passed or waived (current status: 'failed')");
    });

    it("1.6 Once all 7 milestones are passed or waived, transitions to ready_to_ship and completed succeed", async () => {
      const db = getDb();
      // Re-inspect final_pack to passed
      db.prepare("UPDATE pl_qc_milestones SET status = 'passed' WHERE job_id = ? AND stage = 'final_pack'").run(freshJobId);

      // Verify validateQCGate returns true
      const gateResult = PrivateLabelService.validateQCGate(freshJobId);
      expect(gateResult.canPublish).toBe(true);
      expect(gateResult.blockers).toHaveLength(0);

      // Transition to ready_to_ship
      const reqReady = new Request(`http://localhost/api/v1/admin/private-label/jobs/${freshJobId}`, {
        method: "PATCH",
        headers: ADMIN_HEADERS,
        body: JSON.stringify({ status: "ready_to_ship" }),
      });
      const resReady = await patchJobDetail(reqReady, { params: Promise.resolve({ id: freshJobId }) });
      expect(resReady.status).toBe(200);
      const readyData = await resReady.json();
      expect(readyData.job.status).toBe("ready_to_ship");

      // Transition to completed
      const reqComp = new Request(`http://localhost/api/v1/admin/private-label/jobs/${freshJobId}`, {
        method: "PATCH",
        headers: ADMIN_HEADERS,
        body: JSON.stringify({ status: "completed" }),
      });
      const resComp = await patchJobDetail(reqComp, { params: Promise.resolve({ id: freshJobId }) });
      expect(resComp.status).toBe(200);
      const compData = await resComp.json();
      expect(compData.job.status).toBe("completed");
      expect(compData.job.actual_completion_date).toBeDefined();
      expect(new Date(compData.job.actual_completion_date).getTime()).toBeGreaterThan(0);
    });

    it("1.7 Job with 100% waived milestones cleanly passes the QC gate", async () => {
      const db = getDb();
      const waivedJobId = `job_qc_all_waived_${Date.now()}`;
      db.prepare(`
        INSERT INTO pl_jobs (id, job_number, order_id, status, released_by)
        VALUES (?, 'PL-JOB-WAIVE-01', 'order_ch2_dummy_2', 'qc', 'admin_challenger')
      `).run(waivedJobId);

      for (const st of STANDARD_QC_STAGES) {
        db.prepare(`
          INSERT INTO pl_qc_milestones (id, job_id, milestone_name, stage, status, evidence_notes)
          VALUES (?, ?, ?, ?, 'waived', 'Waived under vendor SLA warranty')
        `).run(`qc_w_${st}_${Date.now()}`, waivedJobId, `Waived ${st}`, st);
      }

      const gateResult = PrivateLabelService.validateQCGate(waivedJobId);
      expect(gateResult.canPublish).toBe(true);
      expect(gateResult.blockers).toHaveLength(0);

      const req = new Request(`http://localhost/api/v1/admin/private-label/jobs/${waivedJobId}`, {
        method: "PATCH",
        headers: ADMIN_HEADERS,
        body: JSON.stringify({ status: "completed" }),
      });
      const res = await patchJobDetail(req, { params: Promise.resolve({ id: waivedJobId }) });
      expect(res.status).toBe(200);
      expect((await res.json()).job.status).toBe("completed");
    });

    it("1.8 Missing milestone row from database triggers missing blocker", async () => {
      const db = getDb();
      const missingJobId = `job_qc_missing_${Date.now()}`;
      db.prepare(`
        INSERT INTO pl_jobs (id, job_number, order_id, status, released_by)
        VALUES (?, 'PL-JOB-MISS-01', 'order_ch2_dummy_3', 'qc', 'admin_challenger')
      `).run(missingJobId);

      // Insert only 5 of 7 stages, missing raw_material and sensory_cupping
      for (const st of STANDARD_QC_STAGES) {
        if (st === "raw_material" || st === "sensory_cupping") continue;
        db.prepare(`
          INSERT INTO pl_qc_milestones (id, job_id, milestone_name, stage, status)
          VALUES (?, ?, ?, ?, 'passed')
        `).run(`qc_m_${st}_${Date.now()}`, missingJobId, `Passed ${st}`, st);
      }

      const gate = PrivateLabelService.validateQCGate(missingJobId);
      expect(gate.canPublish).toBe(false);
      expect(gate.blockers).toHaveLength(2);
      expect(gate.blockers).toContain("QC milestone 'raw_material' is not passed or waived (current status: 'missing')");
      expect(gate.blockers).toContain("QC milestone 'sensory_cupping' is not passed or waived (current status: 'missing')");

      const req = new Request(`http://localhost/api/v1/admin/private-label/jobs/${missingJobId}`, {
        method: "PATCH",
        headers: ADMIN_HEADERS,
        body: JSON.stringify({ status: "ready_to_ship" }),
      });
      const res = await patchJobDetail(req, { params: Promise.resolve({ id: missingJobId }) });
      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.blockers).toHaveLength(2);
    });

    it("1.9 QC Milestone input validation rejects malformed payload (invalid stage, status, URL)", async () => {
      // Invalid stage
      let req = new Request(`http://localhost/api/v1/admin/private-label/jobs/${freshJobId}`, {
        method: "PATCH",
        headers: ADMIN_HEADERS,
        body: JSON.stringify({
          milestoneName: "Stage",
          stage: "non_existent_stage",
          status: "passed",
          inspectorName: "QC Lead",
        }),
      });
      let res = await patchJobDetail(req, { params: Promise.resolve({ id: freshJobId }) });
      expect(res.status).toBe(400);

      // Invalid status
      req = new Request(`http://localhost/api/v1/admin/private-label/jobs/${freshJobId}`, {
        method: "PATCH",
        headers: ADMIN_HEADERS,
        body: JSON.stringify({
          milestoneName: "Stage",
          stage: "seal_integrity",
          status: "approved", // not in enum
          inspectorName: "QC Lead",
        }),
      });
      res = await patchJobDetail(req, { params: Promise.resolve({ id: freshJobId }) });
      expect(res.status).toBe(400);

      // Invalid photo URL
      req = new Request(`http://localhost/api/v1/admin/private-label/jobs/${freshJobId}`, {
        method: "PATCH",
        headers: ADMIN_HEADERS,
        body: JSON.stringify({
          milestoneName: "Stage",
          stage: "seal_integrity",
          status: "passed",
          inspectorName: "QC Lead",
          evidencePhotoUrl: "not-a-valid-http-url",
        }),
      });
      res = await patchJobDetail(req, { params: Promise.resolve({ id: freshJobId }) });
      expect(res.status).toBe(400);

      // Valid milestone inspection record via API
      req = new Request(`http://localhost/api/v1/admin/private-label/jobs/${freshJobId}`, {
        method: "PATCH",
        headers: ADMIN_HEADERS,
        body: JSON.stringify({
          milestoneName: "Seal Integrity Vacuum Chamber Check",
          stage: "seal_integrity",
          status: "passed",
          inspectorName: "Vikram Sen",
          evidenceNotes: "0 bar pressure loss at 30 seconds",
          evidencePhotoUrl: "https://teafloww.com/qc/seal-vacuum-test.jpg",
        }),
      });
      res = await patchJobDetail(req, { params: Promise.resolve({ id: freshJobId }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      const updatedMilestone = data.milestones.find((m: { stage: string }) => m.stage === "seal_integrity");
      expect(updatedMilestone.status).toBe("passed");
      expect(updatedMilestone.inspector_name).toBe("Vikram Sen");
      expect(updatedMilestone.evidence_photo_url).toBe("https://teafloww.com/qc/seal-vacuum-test.jpg");
    });

    it("1.10 Cross-job milestone isolation: Job A's passed milestones never satisfy Job B's QC gate", async () => {
      const db = getDb();
      const jobAId = `job_isolated_A_${Date.now()}`;
      const jobBId = `job_isolated_B_${Date.now()}`;

      // Insert both jobs
      db.prepare(`
        INSERT INTO pl_jobs (id, job_number, order_id, status, released_by)
        VALUES (?, 'PL-JOB-ISO-A', 'order_ch2_dummy_1', 'qc', 'admin_challenger'),
               (?, 'PL-JOB-ISO-B', 'order_ch2_dummy_2', 'qc', 'admin_challenger')
      `).run(jobAId, jobBId);

      // All 7 passed for Job A
      for (const st of STANDARD_QC_STAGES) {
        db.prepare(`
          INSERT INTO pl_qc_milestones (id, job_id, milestone_name, stage, status)
          VALUES (?, ?, ?, ?, 'passed')
        `).run(`qc_isoA_${st}_${Date.now()}`, jobAId, `Inspection ${st}`, st);
      }

      // All 7 pending for Job B
      for (const st of STANDARD_QC_STAGES) {
        db.prepare(`
          INSERT INTO pl_qc_milestones (id, job_id, milestone_name, stage, status)
          VALUES (?, ?, ?, ?, 'pending')
        `).run(`qc_isoB_${st}_${Date.now()}`, jobBId, `Inspection ${st}`, st);
      }

      // Job A can transition
      const gateA = PrivateLabelService.validateQCGate(jobAId);
      expect(gateA.canPublish).toBe(true);

      // Job B MUST be blocked despite Job A having passed rows
      const gateB = PrivateLabelService.validateQCGate(jobBId);
      expect(gateB.canPublish).toBe(false);
      expect(gateB.blockers).toHaveLength(7);

      const req = new Request(`http://localhost/api/v1/admin/private-label/jobs/${jobBId}`, {
        method: "PATCH",
        headers: ADMIN_HEADERS,
        body: JSON.stringify({ status: "ready_to_ship" }),
      });
      const res = await patchJobDetail(req, { params: Promise.resolve({ id: jobBId }) });
      expect(res.status).toBe(422);
    });
  });

  // ============================================================================
  // Suite 2: Quote Price Overrides & Dual-Rate GST Mathematics
  // ============================================================================
  describe("Suite 2: Quote Price Overrides & Dual-Rate GST Mathematics", () => {
    let quoteId: string;

    beforeAll(() => {
      const db = getDb();
      quoteId = `quote_gst_stress_${Date.now()}`;
      db.prepare(`
        INSERT INTO pl_quotes (
          id, quote_number, project_id, price_book_id, status, version, currency,
          tea_subtotal_paise, packaging_subtotal_paise, printing_subtotal_paise,
          tooling_setup_paise, labor_subtotal_paise, qc_subtotal_paise, freight_paise,
          margin_paise, tax_paise, grand_total_paise, revision
        ) VALUES (
          ?, 'PL-Q-STRESS-01', 'proj_ch2_001', 'pb_default_inr', 'pricing_pending', 1, 'INR',
          100000, 50000, 20000, 10000, 30000, 25000, 15000, 50000, 41000, 341000, 1
        )
      `).run(quoteId);
    });

    it("2.1 Zero-Cost Override produces 0 tax, 0 grand total, with zero NaN or nulls", () => {
      const updated = PrivateLabelService.overrideQuotePrice(
        quoteId,
        {
          tea_subtotal_paise: 0,
          packaging_subtotal_paise: 0,
          printing_subtotal_paise: 0,
          tooling_setup_paise: 0,
          labor_subtotal_paise: 0,
          qc_subtotal_paise: 0,
          freight_paise: 0,
          margin_paise: 0,
        },
        ACTOR,
        1
      );

      expect(updated.tea_subtotal_paise).toBe(0);
      expect(updated.packaging_subtotal_paise).toBe(0);
      expect(updated.printing_subtotal_paise).toBe(0);
      expect(updated.tooling_setup_paise).toBe(0);
      expect(updated.labor_subtotal_paise).toBe(0);
      expect(updated.qc_subtotal_paise).toBe(0);
      expect(updated.freight_paise).toBe(0);
      expect(updated.margin_paise).toBe(0);
      expect(updated.tax_paise).toBe(0);
      expect(updated.grand_total_paise).toBe(0);

      const breakdown = JSON.parse(updated.price_breakdown_json || "{}");
      expect(breakdown.taxDetails.teaGstPaise).toBe(0);
      expect(breakdown.taxDetails.nonTeaGstPaise).toBe(0);

      expect(Number.isInteger(updated.tax_paise)).toBe(true);
      expect(Number.isInteger(updated.grand_total_paise)).toBe(true);
      expect(Number.isNaN(updated.tax_paise)).toBe(false);
      expect(Number.isNaN(updated.grand_total_paise)).toBe(false);
    });

    it("2.2 Pure Tea Only (0 non-tea) taxes at exactly 5% with zero non-tea GST", () => {
      // Tea: ₹10,000 (1,000,000 paise). 5% GST = 50,000 paise
      const updated = PrivateLabelService.overrideQuotePrice(
        quoteId,
        {
          tea_subtotal_paise: 1_000_000,
          packaging_subtotal_paise: 0,
          printing_subtotal_paise: 0,
          tooling_setup_paise: 0,
          labor_subtotal_paise: 0,
          qc_subtotal_paise: 0,
          freight_paise: 0,
          margin_paise: 0,
        },
        ACTOR,
        2
      );

      expect(updated.tea_subtotal_paise).toBe(1_000_000);
      expect(updated.tax_paise).toBe(50_000);
      expect(updated.grand_total_paise).toBe(1_050_000);

      const breakdown = JSON.parse(updated.price_breakdown_json || "{}");
      expect(breakdown.taxDetails.teaGstPaise).toBe(50_000);
      expect(breakdown.taxDetails.nonTeaGstPaise).toBe(0);
      expect(updated.grand_total_paise).toBe(updated.tea_subtotal_paise + updated.tax_paise);
    });

    it("2.3 Every non-tea cost component individually attracts exactly 18% GST", () => {
      const components = [
        "packaging_subtotal_paise",
        "printing_subtotal_paise",
        "tooling_setup_paise",
        "labor_subtotal_paise",
        "qc_subtotal_paise",
        "freight_paise",
        "margin_paise",
      ] as const;

      let rev = 3;
      for (const comp of components) {
        const overrides: Record<string, number> = {
          tea_subtotal_paise: 0,
          packaging_subtotal_paise: 0,
          printing_subtotal_paise: 0,
          tooling_setup_paise: 0,
          labor_subtotal_paise: 0,
          qc_subtotal_paise: 0,
          freight_paise: 0,
          margin_paise: 0,
        };
        // Set exactly 100,000 paise (₹1,000) for this component
        overrides[comp] = 100_000;

        const updated = PrivateLabelService.overrideQuotePrice(
          quoteId,
          overrides,
          ACTOR,
          rev
        );

        // 18% of 100,000 is 18,000
        expect(updated.tax_paise).toBe(18_000);
        expect(updated.grand_total_paise).toBe(118_000);

        const breakdown = JSON.parse(updated.price_breakdown_json || "{}");
        expect(breakdown.taxDetails.teaGstPaise).toBe(0);
        expect(breakdown.taxDetails.nonTeaGstPaise).toBe(18_000);
        expect(updated.grand_total_paise).toBe(100_000 + updated.tax_paise);
        rev++;
      }
    });

    it("2.4 1-Paisa Rounding Matrix & Edge Case Fuzzing", () => {
      // Test rounding boundary transitions for 5% and 18% GST
      // Tea:
      //  1 paise * 0.05 = 0.05 -> Math.round = 0 paise
      //  9 paise * 0.05 = 0.45 -> Math.round = 0 paise
      // 10 paise * 0.05 = 0.50 -> Math.round = 1 paise
      // 11 paise * 0.05 = 0.55 -> Math.round = 1 paise
      // 29 paise * 0.05 = 1.45 -> Math.round = 1 paise
      // 30 paise * 0.05 = 1.50 -> Math.round = 2 paise
      // Non-Tea:
      //  1 paise * 0.18 = 0.18 -> Math.round = 0 paise
      //  2 paise * 0.18 = 0.36 -> Math.round = 0 paise
      //  3 paise * 0.18 = 0.54 -> Math.round = 1 paise
      //  5 paise * 0.18 = 0.90 -> Math.round = 1 paise
      //  8 paise * 0.18 = 1.44 -> Math.round = 1 paise
      //  9 paise * 0.18 = 1.62 -> Math.round = 2 paise

      const testCases = [
        { tea: 1, nonTea: 1, expTeaGst: 0, expNonTeaGst: 0 },
        { tea: 9, nonTea: 2, expTeaGst: 0, expNonTeaGst: 0 },
        { tea: 10, nonTea: 3, expTeaGst: 1, expNonTeaGst: 1 },
        { tea: 11, nonTea: 5, expTeaGst: 1, expNonTeaGst: 1 },
        { tea: 29, nonTea: 8, expTeaGst: 1, expNonTeaGst: 1 },
        { tea: 30, nonTea: 9, expTeaGst: 2, expNonTeaGst: 2 },
        { tea: 333, nonTea: 777, expTeaGst: 17, expNonTeaGst: 140 }, // 333*0.05=16.65->17, 777*0.18=139.86->140
        { tea: 999, nonTea: 9999, expTeaGst: 50, expNonTeaGst: 1800 }, // 999*0.05=49.95->50, 9999*0.18=1799.82->1800
      ];

      const db = getDb();
      for (const tc of testCases) {
        const curr = db.prepare("SELECT revision FROM pl_quotes WHERE id = ?").get(quoteId) as { revision: number };
        const updated = PrivateLabelService.overrideQuotePrice(
          quoteId,
          {
            tea_subtotal_paise: tc.tea,
            packaging_subtotal_paise: tc.nonTea,
            printing_subtotal_paise: 0,
            tooling_setup_paise: 0,
            labor_subtotal_paise: 0,
            qc_subtotal_paise: 0,
            freight_paise: 0,
            margin_paise: 0,
          },
          ACTOR,
          curr.revision
        );

        const expTax = tc.expTeaGst + tc.expNonTeaGst;
        const expGrand = tc.tea + tc.nonTea + expTax;

        expect(updated.tax_paise).toBe(expTax);
        expect(updated.grand_total_paise).toBe(expGrand);
        expect(Number.isInteger(updated.tax_paise)).toBe(true);
        expect(Number.isInteger(updated.grand_total_paise)).toBe(true);
        expect(Number.isNaN(updated.tax_paise)).toBe(false);
        expect(Number.isNaN(updated.grand_total_paise)).toBe(false);

        const breakdown = JSON.parse(updated.price_breakdown_json || "{}");
        expect(breakdown.taxDetails.teaGstPaise).toBe(tc.expTeaGst);
        expect(breakdown.taxDetails.nonTeaGstPaise).toBe(tc.expNonTeaGst);
        expect(updated.grand_total_paise).toBe(
          updated.tea_subtotal_paise + updated.packaging_subtotal_paise + updated.tax_paise
        );
      }
    });

    it("2.5 Massive Volume Order (₹80 Crores) evaluates with exact safe integer precision", () => {
      const db = getDb();
      const curr = db.prepare("SELECT revision FROM pl_quotes WHERE id = ?").get(quoteId) as { revision: number };

      // Tea: ₹50 Crores = 5,000,000,000 paise
      // Packaging: ₹20 Crores = 2,000,000,000 paise
      // Margin: ₹10 Crores = 1,000,000,000 paise
      // Non-tea total = 3,000,000,000 paise
      // Tea GST 5% = 250,000,000 paise
      // Non-tea GST 18% = 540,000,000 paise
      // Total GST = 790,000,000 paise
      // Grand Total = 8,790,000,000 paise
      const updated = PrivateLabelService.overrideQuotePrice(
        quoteId,
        {
          tea_subtotal_paise: 5_000_000_000,
          packaging_subtotal_paise: 2_000_000_000,
          printing_subtotal_paise: 0,
          tooling_setup_paise: 0,
          labor_subtotal_paise: 0,
          qc_subtotal_paise: 0,
          freight_paise: 0,
          margin_paise: 1_000_000_000,
        },
        ACTOR,
        curr.revision
      );

      expect(updated.tea_subtotal_paise).toBe(5_000_000_000);
      expect(updated.tax_paise).toBe(790_000_000);
      expect(updated.grand_total_paise).toBe(8_790_000_000);

      expect(Number.isSafeInteger(updated.grand_total_paise)).toBe(true);
      expect(Number.isSafeInteger(updated.tax_paise)).toBe(true);
      expect(updated.grand_total_paise).toBe(
        5_000_000_000 + 2_000_000_000 + 1_000_000_000 + 790_000_000
      );
    });

    it("2.6 Negative, floating point, and malformed inputs are strictly rejected with HTTP 400", async () => {
      const db = getDb();
      const curr = db.prepare("SELECT revision FROM pl_quotes WHERE id = ?").get(quoteId) as { revision: number };

      // Negative tea subtotal
      let req = new Request(`http://localhost/api/v1/admin/private-label/quotes/${quoteId}`, {
        method: "PATCH",
        headers: ADMIN_HEADERS,
        body: JSON.stringify({
          expected_revision: curr.revision,
          tea_subtotal_paise: -500,
        }),
      });
      let res = await patchQuoteDetail(req, { params: Promise.resolve({ id: quoteId }) });
      expect(res.status).toBe(400);

      // Negative margin
      req = new Request(`http://localhost/api/v1/admin/private-label/quotes/${quoteId}`, {
        method: "PATCH",
        headers: ADMIN_HEADERS,
        body: JSON.stringify({
          expected_revision: curr.revision,
          margin_paise: -1,
        }),
      });
      res = await patchQuoteDetail(req, { params: Promise.resolve({ id: quoteId }) });
      expect(res.status).toBe(400);

      // Fractional floating-point paise
      req = new Request(`http://localhost/api/v1/admin/private-label/quotes/${quoteId}`, {
        method: "PATCH",
        headers: ADMIN_HEADERS,
        body: JSON.stringify({
          expected_revision: curr.revision,
          packaging_subtotal_paise: 99.99,
        }),
      });
      res = await patchQuoteDetail(req, { params: Promise.resolve({ id: quoteId }) });
      expect(res.status).toBe(400);

      // String value
      req = new Request(`http://localhost/api/v1/admin/private-label/quotes/${quoteId}`, {
        method: "PATCH",
        headers: ADMIN_HEADERS,
        body: JSON.stringify({
          expected_revision: curr.revision,
          freight_paise: "not_a_number",
        }),
      });
      res = await patchQuoteDetail(req, { params: Promise.resolve({ id: quoteId }) });
      expect(res.status).toBe(400);
    });

    it("2.7 CAS optimistic locking rejects stale revision with HTTP 409 Conflict", async () => {
      const db = getDb();
      const curr = db.prepare("SELECT revision FROM pl_quotes WHERE id = ?").get(quoteId) as { revision: number };

      const req = new Request(`http://localhost/api/v1/admin/private-label/quotes/${quoteId}`, {
        method: "PATCH",
        headers: ADMIN_HEADERS,
        body: JSON.stringify({
          expected_revision: curr.revision + 999, // Stale revision
          tea_subtotal_paise: 500000,
        }),
      });
      const res = await patchQuoteDetail(req, { params: Promise.resolve({ id: quoteId }) });
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.expected_revision).toBe(curr.revision + 999);
      expect(data.current_revision).toBe(curr.revision);
    });

    it("2.8 Quote price override via API PATCH recalculates GST and grand total accurately over the wire", async () => {
      const db = getDb();
      const curr = db.prepare("SELECT revision FROM pl_quotes WHERE id = ?").get(quoteId) as { revision: number };

      // Tea = 300,000 paise (5% = 15,000 paise)
      // Packaging = 150,000 paise
      // Printing = 50,000 paise
      // Labor = 20,000 paise
      // QC = 30,000 paise
      // Freight = 10,000 paise
      // Margin = 40,000 paise
      // Non-tea subtotal = 300,000 paise (18% = 54,000 paise)
      // Total tax = 15,000 + 54,000 = 69,000 paise
      // Grand total = 300,000 + 300,000 + 69,000 = 669,000 paise
      const req = new Request(`http://localhost/api/v1/admin/private-label/quotes/${quoteId}`, {
        method: "PATCH",
        headers: ADMIN_HEADERS,
        body: JSON.stringify({
          expected_revision: curr.revision,
          tea_subtotal_paise: 300000,
          packaging_subtotal_paise: 150000,
          printing_subtotal_paise: 50000,
          tooling_setup_paise: 0,
          labor_subtotal_paise: 20000,
          qc_subtotal_paise: 30000,
          freight_paise: 10000,
          margin_paise: 40000,
          operator_notes: "Adversarial Wire Price Recalculation Check",
        }),
      });

      const res = await patchQuoteDetail(req, { params: Promise.resolve({ id: quoteId }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.quote.tea_subtotal_paise).toBe(300000);
      expect(data.quote.packaging_subtotal_paise).toBe(150000);
      expect(data.quote.tax_paise).toBe(69000);
      expect(data.quote.grand_total_paise).toBe(669000);
      expect(data.quote.revision).toBe(curr.revision + 1);

      const breakdown = JSON.parse(data.quote.price_breakdown_json);
      expect(breakdown.taxDetails.teaGstPaise).toBe(15000);
      expect(breakdown.taxDetails.nonTeaGstPaise).toBe(54000);
      expect(breakdown.admin_override.operator_notes).toBe("Adversarial Wire Price Recalculation Check");
    });

    it("2.9 Overriding price on non-existent quote returns HTTP 404", async () => {
      const req = new Request("http://localhost/api/v1/admin/private-label/quotes/quote_non_existent", {
        method: "PATCH",
        headers: ADMIN_HEADERS,
        body: JSON.stringify({
          expected_revision: 1,
          tea_subtotal_paise: 100000,
        }),
      });
      const res = await patchQuoteDetail(req, { params: Promise.resolve({ id: "quote_non_existent" }) });
      expect(res.status).toBe(404);
    });

    it("2.10 Transitioning quote to firm_issued without price override issues 14-day validity", async () => {
      const db = getDb();
      const curr = db.prepare("SELECT revision FROM pl_quotes WHERE id = ?").get(quoteId) as { revision: number };

      const req = new Request(`http://localhost/api/v1/admin/private-label/quotes/${quoteId}`, {
        method: "PATCH",
        headers: ADMIN_HEADERS,
        body: JSON.stringify({
          expected_revision: curr.revision,
          status: "firm_issued",
          extend_validity_days: 14,
        }),
      });
      const res = await patchQuoteDetail(req, { params: Promise.resolve({ id: quoteId }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.quote.status).toBe("firm_issued");
      expect(data.quote.valid_until).toBeDefined();

      const validDate = new Date(data.quote.valid_until);
      const diffDays = Math.round((validDate.getTime() - Date.now()) / (1000 * 3600 * 24));
      expect(diffDays).toBeGreaterThanOrEqual(13);
      expect(diffDays).toBeLessThanOrEqual(15);
    });
  });

  // ============================================================================
  // Suite 3: Price Book Tier Validations & Safeguards
  // ============================================================================
  describe("Suite 3: Price Book Tier Validations & Safeguards", () => {
    it("3.1 Rejects price book creation with overlapping quantity brackets [100-500] and [400-1000] (400)", async () => {
      const req = new Request("http://localhost/api/v1/admin/private-label/price-books", {
        method: "POST",
        headers: ADMIN_HEADERS,
        body: JSON.stringify({
          name: "Overlapping Tiers PB",
          currency: "INR",
          tiers: [
            {
              item_type: "packaging",
              item_id: "var_pouch_100_kraft",
              min_qty: 100,
              max_qty: 500,
              unit_price_paise: 2500,
            },
            {
              item_type: "packaging",
              item_id: "var_pouch_100_kraft",
              min_qty: 400, // Overlaps with 500
              max_qty: 1000,
              unit_price_paise: 2000,
            },
          ],
        }),
      });

      const res = await postPriceBooks(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(JSON.stringify(data)).toContain("Overlapping quantity brackets detected");
    });

    it("3.2 Rejects boundary collision where max_qty equals next tier min_qty (400)", async () => {
      // Tier 1: 100..500, Tier 2: 500..1000 (collision at 500)
      const parsed = adminCreatePriceBookSchema.safeParse({
        name: "Boundary Collision PB",
        currency: "INR",
        tiers: [
          {
            item_type: "packaging",
            item_id: "var_tin_100_round",
            min_qty: 100,
            max_qty: 500,
            unit_price_paise: 3500,
          },
          {
            item_type: "packaging",
            item_id: "var_tin_100_round",
            min_qty: 500,
            max_qty: 1000,
            unit_price_paise: 3000,
          },
        ],
      });

      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues.some((i) => i.message.includes("Overlapping quantity brackets"))).toBe(true);
      }
    });

    it("3.3 Rejects unbounded tier (max_qty = null) followed by another tier (400)", async () => {
      // Tier 1 has null max_qty (unbounded Infinity), followed by Tier 2
      const parsed = adminCreatePriceBookSchema.safeParse({
        name: "Unbounded Collision PB",
        currency: "INR",
        tiers: [
          {
            item_type: "packaging",
            item_id: "var_pouch_100_kraft",
            min_qty: 100,
            max_qty: null,
            unit_price_paise: 2000,
          },
          {
            item_type: "packaging",
            item_id: "var_pouch_100_kraft",
            min_qty: 500,
            max_qty: 1000,
            unit_price_paise: 1800,
          },
        ],
      });

      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues.some((i) => i.message.includes("Overlapping quantity brackets"))).toBe(true);
      }
    });

    it("3.4 Rejects tier where max_qty is less than min_qty (400)", async () => {
      const parsed = adminCreatePriceBookSchema.safeParse({
        name: "Inverted Bracket PB",
        currency: "INR",
        tiers: [
          {
            item_type: "packaging",
            item_id: "var_pouch_100_kraft",
            min_qty: 500,
            max_qty: 200, // Invalid: max < min
            unit_price_paise: 2000,
          },
        ],
      });

      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues.some((i) => i.message.includes("max_qty cannot be less than min_qty"))).toBe(true);
      }
    });

    it("3.5 Same quantity brackets across DIFFERENT item types or items are accepted without collision", async () => {
      // Packaging var_1 has [100-500], Print method pm_1 has [100-500]
      const parsed = adminCreatePriceBookSchema.safeParse({
        name: "Multi Item Disjoint PB",
        currency: "INR",
        tiers: [
          {
            item_type: "packaging",
            item_id: "var_pouch_100_kraft",
            min_qty: 100,
            max_qty: 500,
            unit_price_paise: 2000,
          },
          {
            item_type: "print_method",
            item_id: "pm_direct_digital",
            min_qty: 100,
            max_qty: 500,
            unit_price_paise: 800,
          },
        ],
      });

      expect(parsed.success).toBe(true);
    });

    it("3.6 Valid non-overlapping contiguous tiers are accepted (HTTP 201)", async () => {
      // Tier 1: 100..499, Tier 2: 500..999, Tier 3: 1000..null
      const req = new Request("http://localhost/api/v1/admin/private-label/price-books", {
        method: "POST",
        headers: ADMIN_HEADERS,
        body: JSON.stringify({
          name: "Contiguous Valid Tiers PB",
          currency: "INR",
          margin_rate: 0.20,
          tiers: [
            {
              item_type: "packaging",
              item_id: "var_pouch_100_kraft",
              min_qty: 100,
              max_qty: 499,
              unit_price_paise: 2500,
            },
            {
              item_type: "packaging",
              item_id: "var_pouch_100_kraft",
              min_qty: 500,
              max_qty: 999,
              unit_price_paise: 2200,
            },
            {
              item_type: "packaging",
              item_id: "var_pouch_100_kraft",
              min_qty: 1000,
              max_qty: null,
              unit_price_paise: 1900,
            },
          ],
        }),
      });

      const res = await postPriceBooks(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.priceBook.name).toBe("Contiguous Valid Tiers PB");
      expect(data.priceBook.tiers).toHaveLength(3);
    });

    it("3.7 Rejects negative tier rate and out-of-bound margin rates (400)", async () => {
      // Negative unit_price_paise
      let parsed = adminCreatePriceBookSchema.safeParse({
        name: "Negative Rate PB",
        tiers: [
          {
            item_type: "packaging",
            item_id: "var_pouch_100_kraft",
            min_qty: 100,
            max_qty: 500,
            unit_price_paise: -100,
          },
        ],
      });
      expect(parsed.success).toBe(false);

      // Margin rate >= 1.0 (max is 0.99)
      parsed = adminCreatePriceBookSchema.safeParse({
        name: "Excessive Margin PB",
        margin_rate: 1.0,
      });
      expect(parsed.success).toBe(false);

      // Margin rate negative
      parsed = adminCreatePriceBookSchema.safeParse({
        name: "Negative Margin PB",
        margin_rate: -0.1,
      });
      expect(parsed.success).toBe(false);

      // Margin rate 0 (allowed)
      parsed = adminCreatePriceBookSchema.safeParse({
        name: "Zero Margin PB",
        margin_rate: 0,
      });
      expect(parsed.success).toBe(true);
    });

    it("3.8 Default price book deletion is strictly prevented at service and API layer (HTTP 400)", async () => {
      // Direct service call
      expect(() => {
        PrivateLabelService.deletePriceBook("pb_default_inr", ACTOR);
      }).toThrowError(/Cannot delete the default price book/);

      // API DELETE call
      const req = new Request("http://localhost/api/v1/admin/private-label/price-books/pb_default_inr", {
        method: "DELETE",
        headers: ADMIN_HEADERS,
      });
      const res = await deletePriceBookDetail(req, {
        params: Promise.resolve({ id: "pb_default_inr" }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("Cannot delete the default price book");
    });

    it("3.9 Non-default price book with linked quotes is soft-archived rather than hard-deleted", async () => {
      const db = getDb();
      const linkedPbId = `pb_linked_${Date.now()}`;

      // Create a non-default price book
      PrivateLabelService.upsertPriceBook(
        {
          id: linkedPbId,
          name: "Linked Price Book",
          currency: "INR",
          is_default: false,
        },
        ACTOR
      );

      // Link a quote to it
      db.prepare(`
        INSERT INTO pl_quotes (id, quote_number, project_id, price_book_id, status, version, currency, grand_total_paise, revision)
        VALUES ('q_linked_pb', 'PL-Q-LINK-01', 'proj_ch2_001', ?, 'pricing_pending', 1, 'INR', 100000, 1)
      `).run(linkedPbId);

      // Attempt DELETE via API
      const req = new Request(`http://localhost/api/v1/admin/private-label/price-books/${linkedPbId}`, {
        method: "DELETE",
        headers: ADMIN_HEADERS,
      });
      const res = await deletePriceBookDetail(req, {
        params: Promise.resolve({ id: linkedPbId }),
      });
      expect(res.status).toBe(200);

      // Verify it was soft-archived and not wiped from DB
      const pbRow = db.prepare("SELECT * FROM pl_price_books WHERE id = ?").get(linkedPbId) as { status: string };
      expect(pbRow).toBeDefined();
      expect(pbRow.status).toBe("archived");
    });

    it("3.10 Non-default price book without linked quotes is hard-deleted", async () => {
      const db = getDb();
      const orphanPbId = `pb_orphan_${Date.now()}`;

      // Create a non-default price book
      PrivateLabelService.upsertPriceBook(
        {
          id: orphanPbId,
          name: "Orphan Price Book",
          currency: "INR",
          is_default: false,
        },
        ACTOR
      );

      // Delete via API
      const req = new Request(`http://localhost/api/v1/admin/private-label/price-books/${orphanPbId}`, {
        method: "DELETE",
        headers: ADMIN_HEADERS,
      });
      const res = await deletePriceBookDetail(req, {
        params: Promise.resolve({ id: orphanPbId }),
      });
      expect(res.status).toBe(200);

      // Verify hard delete
      const pbRow = db.prepare("SELECT * FROM pl_price_books WHERE id = ?").get(orphanPbId);
      expect(pbRow).toBeUndefined();
    });

    it("3.11 Modifying existing price book with overlapping tiers via PATCH returns HTTP 400", async () => {
      const db = getDb();
      const patchPbId = `pb_patch_${Date.now()}`;
      PrivateLabelService.upsertPriceBook(
        {
          id: patchPbId,
          name: "Original PB",
          currency: "INR",
          is_default: false,
        },
        ACTOR
      );

      const req = new Request(`http://localhost/api/v1/admin/private-label/price-books/${patchPbId}`, {
        method: "PATCH",
        headers: ADMIN_HEADERS,
        body: JSON.stringify({
          expected_revision: 1,
          tiers: [
            {
              item_type: "packaging",
              item_id: "var_pouch_100_kraft",
              min_qty: 100,
              max_qty: 600,
              unit_price_paise: 2500,
            },
            {
              item_type: "packaging",
              item_id: "var_pouch_100_kraft",
              min_qty: 500, // Overlaps [100-600]
              max_qty: 1000,
              unit_price_paise: 2200,
            },
          ],
        }),
      });

      const res = await patchPriceBookDetail(req, {
        params: Promise.resolve({ id: patchPbId }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(JSON.stringify(data)).toContain("Overlapping quantity brackets detected");
    });

    it("3.12 Deleting non-existent price book returns HTTP 400 with descriptive error", async () => {
      const req = new Request("http://localhost/api/v1/admin/private-label/price-books/pb_non_existent", {
        method: "DELETE",
        headers: ADMIN_HEADERS,
      });
      const res = await deletePriceBookDetail(req, {
        params: Promise.resolve({ id: "pb_non_existent" }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("PriceBook not found: pb_non_existent");
    });

    it("3.13 Atomically changing default price book allows the previous default to be safely managed", async () => {
      const db = getDb();
      const newDefaultId = `pb_new_def_${Date.now()}`;
      const tempOldDefId = `pb_temp_old_${Date.now()}`;

      // Create two price books, one marked as default
      PrivateLabelService.upsertPriceBook(
        {
          id: tempOldDefId,
          name: "Temporary Default PB",
          is_default: true,
        },
        ACTOR
      );

      PrivateLabelService.upsertPriceBook(
        {
          id: newDefaultId,
          name: "New Successor Default PB",
          is_default: false,
        },
        ACTOR
      );

      // Verify tempOldDefId is default and cannot be deleted
      let req = new Request(`http://localhost/api/v1/admin/private-label/price-books/${tempOldDefId}`, {
        method: "DELETE",
        headers: ADMIN_HEADERS,
      });
      let res = await deletePriceBookDetail(req, { params: Promise.resolve({ id: tempOldDefId }) });
      expect(res.status).toBe(400);

      // Switch default to newDefaultId
      PrivateLabelService.setDefaultPriceBook(newDefaultId, ACTOR);

      const oldRow = db.prepare("SELECT is_default FROM pl_price_books WHERE id = ?").get(tempOldDefId) as { is_default: number };
      const newRow = db.prepare("SELECT is_default FROM pl_price_books WHERE id = ?").get(newDefaultId) as { is_default: number };
      expect(oldRow.is_default).toBe(0);
      expect(newRow.is_default).toBe(1);

      // Now tempOldDefId is no longer default and can be deleted cleanly!
      req = new Request(`http://localhost/api/v1/admin/private-label/price-books/${tempOldDefId}`, {
        method: "DELETE",
        headers: ADMIN_HEADERS,
      });
      res = await deletePriceBookDetail(req, { params: Promise.resolve({ id: tempOldDefId }) });
      expect(res.status).toBe(200);

      const deleted = db.prepare("SELECT * FROM pl_price_books WHERE id = ?").get(tempOldDefId);
      expect(deleted).toBeUndefined();
    });
  });
});
