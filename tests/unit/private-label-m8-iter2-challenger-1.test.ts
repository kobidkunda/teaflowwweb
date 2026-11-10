/**
 * TeaFloww Private Label Studio — Milestone M8 Iteration 2 Adversarial Challenger Suite
 * Agent: private_label_m8_iter2_challenger_1
 *
 * Verification Areas:
 * 1. qcMilestoneSchema and PATCH /api/v1/admin/private-label/jobs/:id URL validation
 *    - Invalid URLs: "javascript:alert(1)", "ftp://foo.com", "://invalid", "not-a-valid-http-url"
 *    - Valid URLs: "https://teafloww.com/qc/seal.jpg", "", null, undefined
 *    - Across all evidence URL alias fields: evidencePhotoUrl, evidence_photo_url, evidence_url
 * 2. MCP Companion Tool private_label_record_qc URL validation
 *    - Rejects invalid URLs: "javascript:alert(1)", "ftp://foo.com"
 * 3. Unauthenticated endpoint denial on administrative routes without token headers
 *    - /api/v1/admin/private-label/catalogue (GET, POST)
 *    - /api/v1/admin/private-label/jobs/release (POST)
 *    - /api/v1/admin/private-label/jobs/:id (GET, PATCH)
 * 4. CAS concurrency and tenant isolation
 *    - Unowned projects throw 404 for tenant customers
 *    - Unapproved order release throws PrivateLabelGateError
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { rmSync } from "node:fs";

const TEST_DB = path.join(tmpdir(), `pl-m8-iter2-challenger-1-${process.pid}-${Date.now()}.sqlite`);
process.env.DATABASE_PATH = TEST_DB;
(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.ADMIN_TEST_TOKEN = "challenger_admin_m8_token_123";

import { getDb } from "@/lib/db";
import { PrivateLabelService } from "@/lib/private-label/service";
import { qcMilestoneSchema } from "@/lib/private-label/schemas";
import { dispatchToolCall, McpError } from "@/lib/mcp";
import {
  GET as getJobDetail,
  PATCH as patchJobDetail,
} from "@/app/api/v1/admin/private-label/jobs/[id]/route";
import {
  GET as getCatalogue,
  POST as postCatalogue,
} from "@/app/api/v1/admin/private-label/catalogue/route";
import {
  POST as postReleaseJob,
} from "@/app/api/v1/admin/private-label/jobs/release/route";
import {
  PrivateLabelNotFoundError,
  PrivateLabelGateError,
  type AuditActor,
} from "@/lib/private-label/types";

const ADMIN_HEADERS = {
  "Content-Type": "application/json",
  "x-admin-test-token": "challenger_admin_m8_token_123",
};

const UNAUTH_HEADERS = {
  "Content-Type": "application/json",
};

const ACTOR_ADMIN: AuditActor = {
  actor_type: "admin",
  actor_id: "admin_challenger",
  actor_email: "challenger_m8@teafloww.com",
};

describe("Milestone M8 Iteration 2 Adversarial Challenger Suite", () => {
  let jobId: string;
  let unapprovedOrderId: string;
  const unownedProjectId = "proj_unowned_m8_iter2";

  beforeAll(() => {
    execFileSync(process.execPath, ["scripts/migrate.mjs"], {
      env: { ...process.env, DATABASE_PATH: TEST_DB },
    });

    const db = getDb();
    PrivateLabelService.seedInitialCatalog();

    // Seed test customer, client, project, quote, order, job
    db.prepare(`
      INSERT OR IGNORE INTO customers (id, email, name)
      VALUES ('cust_tenant_alpha', 'alpha@example.com', 'Tenant Alpha'),
             ('cust_tenant_beta', 'beta@example.com', 'Tenant Beta')
    `).run();

    db.prepare(`
      INSERT OR IGNORE INTO pl_clients (id, customer_id, company_name, contact_name, contact_email)
      VALUES ('client_alpha', 'cust_tenant_alpha', 'Alpha Brand Co', 'Alice', 'alpha@example.com')
    `).run();

    db.prepare(`
      INSERT OR IGNORE INTO pl_projects (id, client_id, owner_customer_id, title, status, target_market, revision)
      VALUES ('proj_alpha_01', 'client_alpha', 'cust_tenant_alpha', 'Alpha Project', 'draft', 'IN', 1)
    `).run();

    db.prepare(`
      INSERT OR IGNORE INTO pl_quotes (id, quote_number, project_id, price_book_id, status, version, currency, grand_total_paise, revision)
      VALUES ('quote_alpha_01', 'PL-Q-ALPHA-01', 'proj_alpha_01', 'pb_default_inr', 'firm_issued', 1, 'INR', 150000, 1)
    `).run();

    unapprovedOrderId = `order_unapproved_${Date.now()}`;
    db.prepare(`
      INSERT OR IGNORE INTO pl_orders (id, order_number, client_id, quote_id, status, deposit_paise, balance_paise, revision)
      VALUES (?, 'PL-ORD-ALPHA-01', 'client_alpha', 'quote_alpha_01', 'deposit_paid', 75000, 75000, 1)
    `).run(unapprovedOrderId);

    jobId = `job_qc_adversarial_${Date.now()}`;
    db.prepare(`
      INSERT OR IGNORE INTO pl_jobs (id, job_number, order_id, status, released_by)
      VALUES (?, 'PL-JOB-ADV-01', ?, 'qc', 'admin_challenger')
    `).run(jobId, unapprovedOrderId);

    // Insert 1 initial milestone row
    db.prepare(`
      INSERT OR IGNORE INTO pl_qc_milestones (id, job_id, stage, status)
      VALUES ('mil_seal_01', ?, 'seal_integrity', 'pending')
    `).run(jobId);

    // Insert unowned project (owner_customer_id = NULL)
    db.prepare(`
      INSERT INTO pl_projects (
        id, client_id, owner_customer_id, title, status, target_market, revision, created_at, updated_at
      ) VALUES (
        ?, NULL, NULL, 'Unowned Internal Project', 'draft', 'IN', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `).run(unownedProjectId);
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
  // Suite 1: URL Validation Stress Tests on qcMilestoneSchema & PATCH /jobs/:id
  // ============================================================================
  describe("Suite 1: URL Validation Stress Tests", () => {
    const invalidUrls = [
      "javascript:alert(1)",
      "ftp://foo.com",
      "://invalid",
      "not-a-valid-http-url",
    ];

    it("1.1 qcMilestoneSchema rejects invalid URLs across evidencePhotoUrl, evidence_photo_url, evidence_url", () => {
      for (const field of ["evidencePhotoUrl", "evidence_photo_url", "evidence_url"] as const) {
        for (const badUrl of invalidUrls) {
          const result = qcMilestoneSchema.safeParse({
            stage: "seal_integrity",
            status: "passed",
            inspectorName: "QC Lead",
            [field]: badUrl,
          });

          expect(
            result.success,
            `Expected qcMilestoneSchema to REJECT invalid URL "${badUrl}" for field "${field}", but it succeeded!`
          ).toBe(false);
        }
      }
    });

    it("1.2 qcMilestoneSchema accepts valid HTTP/HTTPS URLs, empty strings, null, and undefined", () => {
      const validCases = [
        { val: "https://teafloww.com/qc/seal.jpg", expected: "https://teafloww.com/qc/seal.jpg" },
        { val: "http://teafloww.com/qc/seal.png", expected: "http://teafloww.com/qc/seal.png" },
        { val: "", expected: undefined },
        { val: null, expected: undefined },
        { val: undefined, expected: undefined },
      ];

      for (const field of ["evidencePhotoUrl", "evidence_photo_url", "evidence_url"] as const) {
        for (const { val, expected } of validCases) {
          const result = qcMilestoneSchema.safeParse({
            stage: "seal_integrity",
            status: "passed",
            inspectorName: "QC Lead",
            [field]: val,
          });

          expect(result.success, `Expected qcMilestoneSchema to ACCEPT "${val}" for "${field}"`).toBe(true);
          if (result.success) {
            expect(result.data[field]).toBe(expected);
          }
        }
      }
    });

    it("1.3 PATCH /api/v1/admin/private-label/jobs/:id with invalid URLs returns HTTP 400 Bad Request", async () => {
      for (const field of ["evidencePhotoUrl", "evidence_photo_url", "evidence_url"] as const) {
        for (const badUrl of invalidUrls) {
          const req = new Request(`http://localhost/api/v1/admin/private-label/jobs/${jobId}`, {
            method: "PATCH",
            headers: ADMIN_HEADERS,
            body: JSON.stringify({
              stage: "seal_integrity",
              status: "passed",
              inspectorName: "Inspector Vikram",
              [field]: badUrl,
            }),
          });

          const res = await patchJobDetail(req, { params: Promise.resolve({ id: jobId }) });
          expect(
            res.status,
            `Expected HTTP 400 when submitting invalid URL "${badUrl}" in "${field}", got HTTP ${res.status}`
          ).toBe(400);
        }
      }
    });

    it("1.4 PATCH /api/v1/admin/private-label/jobs/:id with valid URLs, empty string, and null returns HTTP 200", async () => {
      const validPayloads = [
        { label: "valid https", evidencePhotoUrl: "https://teafloww.com/qc/seal.jpg" },
        { label: "empty string", evidencePhotoUrl: "" },
        { label: "null", evidencePhotoUrl: null },
      ];

      for (const p of validPayloads) {
        const req = new Request(`http://localhost/api/v1/admin/private-label/jobs/${jobId}`, {
          method: "PATCH",
          headers: ADMIN_HEADERS,
          body: JSON.stringify({
            stage: "seal_integrity",
            status: "passed",
            inspectorName: "Inspector Vikram",
            evidencePhotoUrl: p.evidencePhotoUrl,
          }),
        });

        const res = await patchJobDetail(req, { params: Promise.resolve({ id: jobId }) });
        expect(res.status, `Expected HTTP 200 for ${p.label}, got HTTP ${res.status}`).toBe(200);
      }
    });

    it("1.5 MCP tool private_label_record_qc rejects invalid URLs ('javascript:alert(1)', 'ftp://foo.com')", () => {
      for (const badUrl of invalidUrls) {
        expect(() => {
          dispatchToolCall("private_label_record_qc", {
            job_id: jobId,
            stage: "seal_integrity",
            status: "passed",
            inspector_name: "QC Lead",
            evidence_url: badUrl,
          });
        }).toThrowError();
      }
    });
  });

  // ============================================================================
  // Suite 2: Unauthenticated Endpoint Denial (HTTP 401 Unauthorized)
  // ============================================================================
  describe("Suite 2: Unauthenticated Endpoint Denial", () => {
    it("2.1 GET /api/v1/admin/private-label/catalogue returns 401 without tokens", async () => {
      const req = new Request("http://localhost/api/v1/admin/private-label/catalogue", {
        method: "GET",
        headers: UNAUTH_HEADERS,
      });
      const res = await getCatalogue(req);
      expect(res.status).toBe(401);
    });

    it("2.2 POST /api/v1/admin/private-label/catalogue returns 401 without tokens (never 400 or 422)", async () => {
      // Even with completely empty/invalid payload that would fail validation if parsed
      const req = new Request("http://localhost/api/v1/admin/private-label/catalogue", {
        method: "POST",
        headers: UNAUTH_HEADERS,
        body: JSON.stringify({}),
      });
      const res = await postCatalogue(req);
      expect(res.status).toBe(401);
    });

    it("2.3 POST /api/v1/admin/private-label/jobs/release returns 401 without tokens (never 400 or 422)", async () => {
      // Empty body
      const reqEmpty = new Request("http://localhost/api/v1/admin/private-label/jobs/release", {
        method: "POST",
        headers: UNAUTH_HEADERS,
        body: JSON.stringify({}),
      });
      const resEmpty = await postReleaseJob(reqEmpty);
      expect(resEmpty.status).toBe(401);

      // Valid body structure
      const reqValid = new Request("http://localhost/api/v1/admin/private-label/jobs/release", {
        method: "POST",
        headers: UNAUTH_HEADERS,
        body: JSON.stringify({ orderId: unapprovedOrderId }),
      });
      const resValid = await postReleaseJob(reqValid);
      expect(resValid.status).toBe(401);
    });

    it("2.4 GET and PATCH /api/v1/admin/private-label/jobs/:id returns 401 without tokens", async () => {
      const reqGet = new Request(`http://localhost/api/v1/admin/private-label/jobs/${jobId}`, {
        method: "GET",
        headers: UNAUTH_HEADERS,
      });
      const resGet = await getJobDetail(reqGet, { params: Promise.resolve({ id: jobId }) });
      expect(resGet.status).toBe(401);

      const reqPatch = new Request(`http://localhost/api/v1/admin/private-label/jobs/${jobId}`, {
        method: "PATCH",
        headers: UNAUTH_HEADERS,
        body: JSON.stringify({ status: "ready_to_ship" }),
      });
      const resPatch = await patchJobDetail(reqPatch, { params: Promise.resolve({ id: jobId }) });
      expect(resPatch.status).toBe(401);
    });
  });

  // ============================================================================
  // Suite 3: Tenant Isolation & Unapproved Order Release Gate
  // ============================================================================
  describe("Suite 3: Tenant Isolation and Gate Enforcement", () => {
    it("3.1 Unowned project (owner_customer_id = NULL) throws 404 for tenant customers", () => {
      // Querying with tenant alpha customer ID
      expect(() => {
        PrivateLabelService.getProject(unownedProjectId, "cust_tenant_alpha");
      }).toThrowError(PrivateLabelNotFoundError);

      // Querying with tenant beta customer ID
      expect(() => {
        PrivateLabelService.getProject(unownedProjectId, "cust_tenant_beta");
      }).toThrowError(PrivateLabelNotFoundError);

      // Admin access (no customer ID filter) succeeds
      const adminProject = PrivateLabelService.getProject(unownedProjectId);
      expect(adminProject).toBeDefined();
      expect(adminProject.id).toBe(unownedProjectId);
    });

    it("3.2 Cross-tenant access: Tenant Beta querying Tenant Alpha's project throws 404", () => {
      expect(() => {
        PrivateLabelService.getProject("proj_alpha_01", "cust_tenant_beta");
      }).toThrowError(PrivateLabelNotFoundError);

      // Owner tenant alpha succeeds
      const alphaProject = PrivateLabelService.getProject("proj_alpha_01", "cust_tenant_alpha");
      expect(alphaProject).toBeDefined();
      expect(alphaProject.id).toBe("proj_alpha_01");
    });

    it("3.3 Unapproved order release strictly throws PrivateLabelGateError", () => {
      // Release order to production without artwork proof approval
      expect(() => {
        PrivateLabelService.releaseProductionJob(unapprovedOrderId, {}, ACTOR_ADMIN);
      }).toThrowError(PrivateLabelGateError);

      // Verify gate diagnostic blockers
      const gate = PrivateLabelService.validateReleaseGate(unapprovedOrderId);
      expect(gate.eligible).toBe(false);
      expect(gate.blockers).toContain(
        "Artwork proof approval is required prior to releasing order to production"
      );
    });
  });
});
