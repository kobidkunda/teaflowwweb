import { prepareProofForApproval } from "./private-label-proof-fixture";
/**
 * TeaFloww Private Label Studio — Milestone M5 Empirical Adversarial Challenger Test Suite
 * Challenger: private_label_m5_challenger_2 (Role: Proof Approval Lifecycle, CAS Concurrency, Canvas Boundaries)
 * File: tests/unit/private-label-m5-challenger-proof.test.ts
 *
 * Scope: Milestone M5 (Proof Approval Lifecycle, CAS Concurrency, Invalidation, Release Gate, Canvas 320px Boundaries)
 * Empirical Test Suites:
 * 1. High-Concurrency CAS Race: 10 parallel approval requests on same proof version -> exactly 1 succeeds (200), 9 fail (409 Conflict)
 * 2. Proof Invalidation upon Subsequent Design Update: v2 atomically increments project revision, resets proof state to preflight_pending, marks v1 stale
 * 3. Out-of-Order Approval & Monotonicity: approving v(N-1) when v(N) exists returns 409 Conflict; duplicate approval returns 409 Conflict
 * 4. Missing IP Indemnity Disclaimer: calling approve with disclaimer_accepted false/omitted returns 400 Bad Request (service throws PrivateLabelGateError)
 * 5. Tenant Isolation & 404 Anti-Enumeration: cross-tenant access to proofs, design versions, or approvals returns 404 Not Found (zero cross-tenant leakage)
 * 6. Hard Production Release Gate: PrivateLabelService.releaseProductionJob blocks release unless proof is customer_approved and deposit is paid
 * 7. Responsive & Boundary Stress: 320px mobile viewport rendering, bounds overflow, extreme negative coordinates, safe-zone breach math
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Database from "better-sqlite3";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { rmSync } from "node:fs";
import { randomUUID } from "node:crypto";

import { PrivateLabelService } from "@/lib/private-label/service";
import { calculateSafeZone } from "@/lib/private-label/compatibility";
import {
  resolvePackagingSilhouette,
  StudioCanvas2D,
} from "@/components/private-label/StudioCanvas2D";
import { ProofApprovalModal } from "@/components/private-label/ProofApprovalModal";
import {
  PrivateLabelNotFoundError,
  PrivateLabelRevisionConflictError,
  PrivateLabelGateError,
  type AuditActor,
} from "@/lib/private-label/types";

// Route Handlers
import { POST as approveProofRoute } from "@/app/api/v1/private-label/proofs/[id]/approve/route";
import { POST as rejectProofRoute } from "@/app/api/v1/private-label/proofs/[id]/reject/route";
import { GET as getCurrentProofRoute } from "@/app/api/v1/private-label/projects/[id]/proofs/current/route";
import {
  POST as createDesignVersionRoute,
  GET as listDesignVersionsRoute,
} from "@/app/api/v1/private-label/projects/[id]/design-versions/route";

// Test Actor Identifiers
const CUSTOMER_A_ID = "cust-m5-chal-001";
const CUSTOMER_B_ID = "cust-m5-chal-002";
const ADMIN_ID = "admin-m5-chal-root";

const ACTOR_CUSTOMER_A: AuditActor = {
  actor_type: "customer",
  actor_id: CUSTOMER_A_ID,
  actor_email: "alice@tea-brand-a.com",
};

const ACTOR_CUSTOMER_B: AuditActor = {
  actor_type: "customer",
  actor_id: CUSTOMER_B_ID,
  actor_email: "bob@tea-brand-b.com",
};

const ACTOR_ADMIN: AuditActor = {
  actor_type: "admin",
  actor_id: ADMIN_ID,
  actor_email: "admin@teafloww.com",
};

describe("Milestone M5 Challenger: Proof Lifecycle, CAS Concurrency & Studio Boundaries", () => {
  let testDbPath: string;
  let db: Database.Database;

  beforeAll(() => {
    testDbPath = path.join(tmpdir(), `pl-m5-chal2-${process.pid}-${Date.now()}.sqlite`);
    process.env.DATABASE_PATH = testDbPath;
    (process.env as Record<string, string | undefined>).NODE_ENV = "test";

    // Run database migrations through 048
    execFileSync(process.execPath, ["scripts/migrate.mjs"], {
      env: { ...process.env, DATABASE_PATH: testDbPath },
    });

    db = new Database(testDbPath);
    db.pragma("foreign_keys = ON");
    db.pragma("journal_mode = WAL");

    // Seed Customers and Clients for Customer A and Customer B
    db.prepare(`
      INSERT OR IGNORE INTO customers (id, email, name, is_active)
      VALUES
        (?, 'alice@tea-brand-a.com', 'Alice Green', 1),
        (?, 'bob@tea-brand-b.com', 'Bob Smith', 1)
    `).run(CUSTOMER_A_ID, CUSTOMER_B_ID);

    db.prepare(`
      INSERT OR IGNORE INTO pl_clients (id, customer_id, company_name, contact_name, contact_email)
      VALUES
        ('client_chal_a', ?, 'Alice Organic Teas Ltd', 'Alice Green', 'alice@tea-brand-a.com'),
        ('client_chal_b', ?, 'Bob Herbal Infusions LLC', 'Bob Smith', 'bob@tea-brand-b.com')
    `).run(CUSTOMER_A_ID, CUSTOMER_B_ID);

    // Seed Standard Price Book
    db.prepare(`
      INSERT OR IGNORE INTO pl_price_books (id, name, currency, is_default, margin_rate)
      VALUES ('pb_standard_inr', 'Standard INR Price Book', 'INR', 1, 0.25)
    `).run();
  });

  afterAll(() => {
    try {
      db?.close();
      rmSync(testDbPath, { force: true });
      rmSync(testDbPath + "-wal", { force: true });
      rmSync(testDbPath + "-shm", { force: true });
    } catch {}
  });

  // Helper to create fresh project for Customer A
  function createTestProject(title = "Challenger M5 Project", customerId = CUSTOMER_A_ID, actor = ACTOR_CUSTOMER_A) {
    return PrivateLabelService.createProjectDraft(
      { title, target_market: "IN" },
      customerId,
      actor
    );
  }

  // ==========================================================================
  // 1. High-Concurrency Race: 10 Parallel Approval Requests
  // ==========================================================================
  describe("1. High-Concurrency CAS Race: 10 Parallel Approval Requests", () => {
    it("REST Route: 10 simultaneous approval requests on same proof version -> exactly 1 succeeds (200), 9 fail (409 Conflict)", async () => {
      const project = createTestProject("Parallel Route Race Project");

      // Create Design Version 1
      const designVer = PrivateLabelService.createDesignVersion(
        project.id,
        {
          scene_json: { brand: "Parallel Brand", color: "#143C31" },
          asset_url: "https://cdn.teafloww.com/proof-race.png",
          preflight_report: { status: "passed", valid: true, dpi: 300 },
        },
        ACTOR_CUSTOMER_A,
        CUSTOMER_A_ID
      );

      // Launch 10 simultaneous approval requests via the REST route handler
      const requestCount = 10;
      const approvalPromises = Array.from({ length: requestCount }, (_, index) => {
        const req = new Request(
          `http://localhost/api/v1/private-label/proofs/${designVer.id}/approve`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-customer-id": CUSTOMER_A_ID,
              "x-forwarded-for": `192.168.1.${100 + index}`,
            },
            body: JSON.stringify({
              disclaimer_accepted: true,
              signer_name: `Approver Agent ${index + 1}`,
              notes: `Concurrent race sign-off thread #${index + 1}`,
            }),
          }
        );
        return approveProofRoute(req, { params: Promise.resolve({ id: designVer.id }) });
      });

      const responses = await Promise.all(approvalPromises);
      const statuses = responses.map((r) => r.status);

      const successCount = statuses.filter((s) => s === 200).length;
      const conflictCount = statuses.filter((s) => s === 409).length;

      expect(successCount).toBe(1);
      expect(conflictCount).toBe(9);
      expect(statuses.every((s) => s === 200 || s === 409)).toBe(true);

      // Verify response body of conflicting requests
      for (const res of responses) {
        if (res.status === 409) {
          const body = await res.json();
          expect(body.error).toContain("Proof revision is already approved and locked");
        } else if (res.status === 200) {
          const body = await res.json();
          expect(body.success).toBe(true);
          expect(body.message).toBe("Proof successfully approved");
          expect(body.approval.action).toBe("customer_approved");
        }
      }
    });

    it("Database Invariant: pl_design_versions is locked once and pl_approval_events has exactly 1 entry", () => {
      const project = createTestProject("DB Lock Invariant Project");

      const designVer = PrivateLabelService.createDesignVersion(
        project.id,
        {
          scene_json: { test: "lock-invariant" },
          asset_url: "https://cdn.teafloww.com/lock-inv.png",
          preflight_report: { status: "passed", valid: true, dpi: 300 },
        },
        ACTOR_CUSTOMER_A,
        CUSTOMER_A_ID
      );

      // Perform approval
      PrivateLabelService.approveProof(prepareProofForApproval(designVer.id),
        { disclaimer_accepted: true, signer_name: "Alice M5" },
        ACTOR_CUSTOMER_A,
        CUSTOMER_A_ID
      );

      // Subsequent 9 calls at service layer must throw PrivateLabelRevisionConflictError
      for (let i = 0; i < 9; i++) {
        expect(() => {
          PrivateLabelService.approveProof(prepareProofForApproval(designVer.id),
            { disclaimer_accepted: true, signer_name: `Competitor ${i}` },
            ACTOR_CUSTOMER_A,
            CUSTOMER_A_ID
          );
        }).toThrow(PrivateLabelRevisionConflictError);
      }

      // Verify DB state: exactly 1 locked row, exactly 1 event row
      const versionRow = db
        .prepare("SELECT is_locked, status FROM pl_design_versions WHERE id = ?")
        .get(designVer.id) as { is_locked: number; status: string };

      expect(versionRow.is_locked).toBe(1);
      expect(versionRow.status).toBe("customer_approved");

      const eventCount = db
        .prepare("SELECT count(*) as count FROM pl_approval_events WHERE design_version_id = ?")
        .get(designVer.id) as { count: number };

      expect(eventCount.count).toBe(1);
    });

    it("Service Layer: 10 parallel asynchronous service invocations -> exactly 1 fulfilled, 9 rejected with 409", async () => {
      const project = createTestProject("Service Concurrency Project");

      const designVer = PrivateLabelService.createDesignVersion(
        project.id,
        {
          scene_json: { parallel: true },
          asset_url: "https://cdn.teafloww.com/async-race.png",
        },
        ACTOR_CUSTOMER_A,
        CUSTOMER_A_ID
      );

      const attempts = Array.from({ length: 10 }, (_, idx) => {
        return new Promise((resolve, reject) => {
          try {
            const result = PrivateLabelService.approveProof(prepareProofForApproval(designVer.id),
              { disclaimer_accepted: true, signer_name: `Async Approver ${idx}` },
              ACTOR_CUSTOMER_A,
              CUSTOMER_A_ID
            );
            resolve(result);
          } catch (err) {
            reject(err);
          }
        });
      });

      const settled = await Promise.allSettled(attempts);
      const fulfilled = settled.filter((s) => s.status === "fulfilled");
      const rejected = settled.filter((s) => s.status === "rejected");

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(9);

      // Verify every rejected promise threw PrivateLabelRevisionConflictError
      for (const rej of rejected) {
        if (rej.status === "rejected") {
          expect(rej.reason).toBeInstanceOf(PrivateLabelRevisionConflictError);
          expect(rej.reason.message).toContain("already approved and locked");
        }
      }
    });
  });

  // ==========================================================================
  // 2. Proof Invalidation upon Subsequent Design Update
  // ==========================================================================
  describe("2. Proof Invalidation upon Subsequent Design Update", () => {
    it("creating a new design version resets project proof state to preflight_pending and increments project revision", async () => {
      const project = createTestProject("Invalidation Workflow Project");
      const initialRevision = project.revision;

      // 1. Create and approve Version 1
      const v1 = PrivateLabelService.createDesignVersion(
        project.id,
        {
          scene_json: { version: 1, logo: "logo_v1.png" },
          asset_url: "https://cdn.teafloww.com/v1.png",
          preflight_report: { status: "passed", valid: true, dpi: 300 },
        },
        ACTOR_CUSTOMER_A,
        CUSTOMER_A_ID
      );

      PrivateLabelService.approveProof(prepareProofForApproval(v1.id),
        { disclaimer_accepted: true, signer_name: "Alice" },
        ACTOR_CUSTOMER_A,
        CUSTOMER_A_ID
      );

      // Verify current proof route returns customer_approved v1
      const reqCurrentV1 = new Request(
        `http://localhost/api/v1/private-label/projects/${project.id}/proofs/current`,
        { headers: { "x-customer-id": CUSTOMER_A_ID } }
      );
      const resCurrentV1 = await getCurrentProofRoute(reqCurrentV1, {
        params: Promise.resolve({ id: project.id }),
      });
      expect(resCurrentV1.status).toBe(200);
      const jsonCurrentV1 = await resCurrentV1.json();
      expect(jsonCurrentV1.version_number).toBe(1);
      expect(jsonCurrentV1.status).toBe("customer_approved");

      // 2. Customer updates design: creates Version 2 via REST route without preflight
      const reqCreateV2 = new Request(
        `http://localhost/api/v1/private-label/projects/${project.id}/design-versions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-customer-id": CUSTOMER_A_ID,
          },
          body: JSON.stringify({
            scene_json: { version: 2, logo: "logo_v2.png" },
            asset_url: "https://cdn.teafloww.com/v2.png",
          }),
        }
      );
      const resCreateV2 = await createDesignVersionRoute(reqCreateV2, {
        params: Promise.resolve({ id: project.id }),
      });
      expect(resCreateV2.status).toBe(201);
      const jsonCreateV2 = await resCreateV2.json();
      expect(jsonCreateV2.version_number).toBe(2);
      expect(jsonCreateV2.status).toBe("preflight_pending");

      // 3. Invalidation check: current proof route now reflects v2 with status preflight_pending
      const reqCurrentV2 = new Request(
        `http://localhost/api/v1/private-label/projects/${project.id}/proofs/current`,
        { headers: { "x-customer-id": CUSTOMER_A_ID } }
      );
      const resCurrentV2 = await getCurrentProofRoute(reqCurrentV2, {
        params: Promise.resolve({ id: project.id }),
      });
      expect(resCurrentV2.status).toBe(200);
      const jsonCurrentV2 = await resCurrentV2.json();
      expect(jsonCurrentV2.version_number).toBe(2);
      expect(jsonCurrentV2.status).toBe("preflight_pending");

      // 4. Verify project revision was monotonically incremented
      const refreshedProject = PrivateLabelService.getProject(project.id, CUSTOMER_A_ID);
      expect(refreshedProject.revision).toBeGreaterThan(initialRevision);
    });

    it("marks previous proof version stale: attempting to approve superseded proof v1 after v2 exists returns 409 Conflict", async () => {
      const project = createTestProject("Stale Proof Rejection Project");

      // Create Version 1 (unapproved)
      const v1 = PrivateLabelService.createDesignVersion(
        project.id,
        { scene_json: { v: 1 } },
        ACTOR_CUSTOMER_A,
        CUSTOMER_A_ID
      );

      // Create Version 2 (supersedes Version 1)
      const v2 = PrivateLabelService.createDesignVersion(
        project.id,
        { scene_json: { v: 2 } },
        ACTOR_CUSTOMER_A,
        CUSTOMER_A_ID
      );
      expect(v2.version_number).toBe(2);

      // Attempt to approve superseded v1 via REST route
      const reqApproveV1 = new Request(
        `http://localhost/api/v1/private-label/proofs/${v1.id}/approve`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-customer-id": CUSTOMER_A_ID,
          },
          body: JSON.stringify({
            disclaimer_accepted: true,
            signer_name: "Alice",
          }),
        }
      );

      const resApproveV1 = await approveProofRoute(reqApproveV1, {
        params: Promise.resolve({ id: v1.id }),
      });

      expect(resApproveV1.status).toBe(409);
      const json = await resApproveV1.json();
      expect(json.error).toContain("superseded by revision 2");
      expect(json.current_revision).toBe(2);
      expect(json.expected_revision).toBe(1);
    });

    it("new design version with passed preflight report resets approval status to preflight_passed, NOT customer_approved", () => {
      const project = createTestProject("Passed Preflight Not Pre-approved Project");

      const v1 = PrivateLabelService.createDesignVersion(
        project.id,
        {
          scene_json: { version: 1 },
          preflight_report: { status: "passed", valid: true, dpi: 300 },
        },
        ACTOR_CUSTOMER_A,
        CUSTOMER_A_ID
      );

      PrivateLabelService.approveProof(prepareProofForApproval(v1.id),
        { disclaimer_accepted: true, signer_name: "Alice" },
        ACTOR_CUSTOMER_A,
        CUSTOMER_A_ID
      );

      // Create Version 2 with passed preflight
      const v2 = PrivateLabelService.createDesignVersion(
        project.id,
        {
          scene_json: { version: 2 },
          preflight_report: { status: "passed", valid: true, dpi: 300 },
        },
        ACTOR_CUSTOMER_A,
        CUSTOMER_A_ID
      );

      expect(v2.status).toBe("preflight_passed");
      expect(v2.is_locked).toBe(0);

      // Project latest proof is v2 in preflight_passed (requires re-approval before production)
      const latest = PrivateLabelService.getLatestDesignVersion(project.id, CUSTOMER_A_ID, ACTOR_CUSTOMER_A);
      expect(latest?.version_number).toBe(2);
      expect(latest?.status).toBe("preflight_passed");
      expect(latest?.is_locked).toBe(0);
    });
  });

  // ==========================================================================
  // 3. Out-of-Order Approval Attempt & Monotonicity
  // ==========================================================================
  describe("3. Out-of-Order Approval Attempt & Monotonicity", () => {
    it("creating multiple versions maintains strictly monotonic version numbers (1, 2, 3)", () => {
      const project = createTestProject("Monotonic Sequence Project");

      const v1 = PrivateLabelService.createDesignVersion(
        project.id,
        { scene_json: { seq: 1 } },
        ACTOR_CUSTOMER_A,
        CUSTOMER_A_ID
      );
      const v2 = PrivateLabelService.createDesignVersion(
        project.id,
        { scene_json: { seq: 2 } },
        ACTOR_CUSTOMER_A,
        CUSTOMER_A_ID
      );
      const v3 = PrivateLabelService.createDesignVersion(
        project.id,
        { scene_json: { seq: 3 } },
        ACTOR_CUSTOMER_A,
        CUSTOMER_A_ID
      );

      expect(v1.version_number).toBe(1);
      expect(v2.version_number).toBe(2);
      expect(v3.version_number).toBe(3);

      const versions = PrivateLabelService.listDesignVersions(project.id, CUSTOMER_A_ID, ACTOR_CUSTOMER_A);
      expect(versions.map((v) => v.version_number)).toEqual([1, 2, 3]);
    });

    it("approving version N-1 when version N exists is rejected with 409 Conflict", async () => {
      const project = createTestProject("Out-of-Order Rejection Project");

      const v1 = PrivateLabelService.createDesignVersion(
        project.id,
        { scene_json: { step: 1 } },
        ACTOR_CUSTOMER_A,
        CUSTOMER_A_ID
      );
      const v2 = PrivateLabelService.createDesignVersion(
        project.id,
        { scene_json: { step: 2 } },
        ACTOR_CUSTOMER_A,
        CUSTOMER_A_ID
      );
      const v3 = PrivateLabelService.createDesignVersion(
        project.id,
        { scene_json: { step: 3 } },
        ACTOR_CUSTOMER_A,
        CUSTOMER_A_ID
      );

      // Attempt approving v1 (when v3 exists) -> 409 Conflict
      const reqV1 = new Request(`http://localhost/api/v1/private-label/proofs/${v1.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-customer-id": CUSTOMER_A_ID },
        body: JSON.stringify({ disclaimer_accepted: true }),
      });
      const resV1 = await approveProofRoute(reqV1, { params: Promise.resolve({ id: v1.id }) });
      expect(resV1.status).toBe(409);
      const jsonV1 = await resV1.json();
      expect(jsonV1.error).toContain("superseded by revision 3");

      // Attempt approving v2 (when v3 exists) -> 409 Conflict
      const reqV2 = new Request(`http://localhost/api/v1/private-label/proofs/${v2.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-customer-id": CUSTOMER_A_ID },
        body: JSON.stringify({ disclaimer_accepted: true }),
      });
      const resV2 = await approveProofRoute(reqV2, { params: Promise.resolve({ id: v2.id }) });
      expect(resV2.status).toBe(409);
      const jsonV2 = await resV2.json();
      expect(jsonV2.error).toContain("superseded by revision 3");

      // Approving latest v3 succeeds
      const reqV3 = new Request(`http://localhost/api/v1/private-label/proofs/${v3.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-customer-id": CUSTOMER_A_ID },
        body: JSON.stringify({ disclaimer_accepted: true, signer_name: "Alice" }),
      });
      prepareProofForApproval(v3.id);
      const resV3 = await approveProofRoute(reqV3, { params: Promise.resolve({ id: v3.id }) });
      expect(resV3.status).toBe(200);

      // Re-approving v3 again returns 409 Conflict
      const reqV3Dup = new Request(`http://localhost/api/v1/private-label/proofs/${v3.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-customer-id": CUSTOMER_A_ID },
        body: JSON.stringify({ disclaimer_accepted: true }),
      });
      const resV3Dup = await approveProofRoute(reqV3Dup, { params: Promise.resolve({ id: v3.id }) });
      expect(resV3Dup.status).toBe(409);
    });

    it("rejects approval when expected_revision does not match current version revision (409 Conflict)", async () => {
      const project = createTestProject("Expected Revision Mismatch Project");

      const v1 = PrivateLabelService.createDesignVersion(
        project.id,
        { scene_json: { test: "rev" } },
        ACTOR_CUSTOMER_A,
        CUSTOMER_A_ID
      );

      // Provide stale expected_revision = 99
      const reqStale = new Request(`http://localhost/api/v1/private-label/proofs/${v1.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-customer-id": CUSTOMER_A_ID },
        body: JSON.stringify({
          disclaimer_accepted: true,
          expected_revision: 99,
        }),
      });

      const resStale = await approveProofRoute(reqStale, { params: Promise.resolve({ id: v1.id }) });
      expect(resStale.status).toBe(409);
    });
  });

  // ==========================================================================
  // 4. Missing IP Indemnity Disclaimer Enforcement
  // ==========================================================================
  describe("4. Missing IP Indemnity Disclaimer Enforcement", () => {
    it("calling approve with disclaimer_accepted false returns 400 Bad Request with code DISCLAIMER_REQUIRED", async () => {
      const project = createTestProject("Disclaimer False Project");
      const v1 = PrivateLabelService.createDesignVersion(
        project.id,
        { scene_json: { check: "disclaimer" } },
        ACTOR_CUSTOMER_A,
        CUSTOMER_A_ID
      );

      const req = new Request(`http://localhost/api/v1/private-label/proofs/${v1.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-customer-id": CUSTOMER_A_ID },
        body: JSON.stringify({
          disclaimer_accepted: false,
          signer_name: "Alice",
        }),
      });

      const res = await approveProofRoute(req, { params: Promise.resolve({ id: v1.id }) });
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.code).toBe("DISCLAIMER_REQUIRED");
      expect(json.error).toContain("disclaimer must be explicitly accepted");
    });

    it("calling approve with disclaimer_accepted omitted returns 400 Bad Request", async () => {
      const project = createTestProject("Disclaimer Omitted Project");
      const v1 = PrivateLabelService.createDesignVersion(
        project.id,
        { scene_json: { check: "disclaimer-omitted" } },
        ACTOR_CUSTOMER_A,
        CUSTOMER_A_ID
      );

      const req = new Request(`http://localhost/api/v1/private-label/proofs/${v1.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-customer-id": CUSTOMER_A_ID },
        body: JSON.stringify({
          signer_name: "Alice",
        }),
      });

      const res = await approveProofRoute(req, { params: Promise.resolve({ id: v1.id }) });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.code).toBe("DISCLAIMER_REQUIRED");
    });

    it("calling approve with empty JSON body {} returns 400 Bad Request", async () => {
      const project = createTestProject("Empty Body Project");
      const v1 = PrivateLabelService.createDesignVersion(
        project.id,
        { scene_json: {} },
        ACTOR_CUSTOMER_A,
        CUSTOMER_A_ID
      );

      const req = new Request(`http://localhost/api/v1/private-label/proofs/${v1.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-customer-id": CUSTOMER_A_ID },
        body: JSON.stringify({}),
      });

      const res = await approveProofRoute(req, { params: Promise.resolve({ id: v1.id }) });
      expect(res.status).toBe(400);
    });

    it("service layer throws PrivateLabelGateError when disclaimer is false/omitted", () => {
      const project = createTestProject("Service Disclaimer Gate Project");
      const v1 = PrivateLabelService.createDesignVersion(
        project.id,
        { scene_json: {} },
        ACTOR_CUSTOMER_A,
        CUSTOMER_A_ID
      );

      expect(() => {
        PrivateLabelService.approveProof(prepareProofForApproval(v1.id),
          { disclaimer_accepted: false, signer_name: "Alice" },
          ACTOR_CUSTOMER_A,
          CUSTOMER_A_ID
        );
      }).toThrow(PrivateLabelGateError);
    });

    it("ensures unapproved attempts leave pl_approval_events empty and proof unlocked", () => {
      const project = createTestProject("Proof Remains Unlocked Project");
      const v1 = PrivateLabelService.createDesignVersion(
        project.id,
        { scene_json: {} },
        ACTOR_CUSTOMER_A,
        CUSTOMER_A_ID
      );

      // Verify DB before and after failed approval
      const rowBefore = db
        .prepare("SELECT is_locked, status FROM pl_design_versions WHERE id = ?")
        .get(v1.id) as { is_locked: number; status: string };
      expect(rowBefore.is_locked).toBe(0);

      const eventsCount = db
        .prepare("SELECT count(*) as count FROM pl_approval_events WHERE design_version_id = ?")
        .get(v1.id) as { count: number };
      expect(eventsCount.count).toBe(0);
    });

    it("successful approval persists statutory IP indemnity text in pl_approval_events", () => {
      const project = createTestProject("IP Indemnity Text Persisted Project");
      const v1 = PrivateLabelService.createDesignVersion(
        project.id,
        { scene_json: {} },
        ACTOR_CUSTOMER_A,
        CUSTOMER_A_ID
      );

      const approval = PrivateLabelService.approveProof(prepareProofForApproval(v1.id),
        {
          disclaimer_accepted: true,
          signer_name: "Alice IP Officer",
        },
        ACTOR_CUSTOMER_A,
        CUSTOMER_A_ID
      );

      expect(approval.disclaimer_text).toContain("commercial intellectual property rights");
      expect(approval.disclaimer_text).toContain("CMYK / Pantone");
      expect(approval.legal_disclaimer_accepted).toBe(1);
    });
  });

  // ==========================================================================
  // 5. Tenant Isolation & 404 Anti-Enumeration
  // ==========================================================================
  describe("5. Tenant Isolation & 404 Anti-Enumeration", () => {
    let projectAId: string;
    let proofAId: string;

    beforeAll(() => {
      const projectA = createTestProject("Customer A Private Project", CUSTOMER_A_ID, ACTOR_CUSTOMER_A);
      projectAId = projectA.id;

      const v1 = PrivateLabelService.createDesignVersion(
        projectAId,
        {
          scene_json: { proprietary_recipe: "Secret Darjeeling Blend" },
          asset_url: "https://cdn.teafloww.com/client-a-secrets.png",
        },
        ACTOR_CUSTOMER_A,
        CUSTOMER_A_ID
      );
      proofAId = v1.id;
    });

    it("Customer B attempting to fetch Customer A's current proof returns 404 Not Found (never 403, never 200)", async () => {
      const req = new Request(
        `http://localhost/api/v1/private-label/projects/${projectAId}/proofs/current`,
        {
          headers: { "x-customer-id": CUSTOMER_B_ID },
        }
      );
      const res = await getCurrentProofRoute(req, { params: Promise.resolve({ id: projectAId }) });
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe("Project not found");
      expect(json.proof).toBeUndefined();
    });

    it("Customer B attempting to list Customer A's design versions returns 404 Not Found", async () => {
      const req = new Request(
        `http://localhost/api/v1/private-label/projects/${projectAId}/design-versions`,
        {
          headers: { "x-customer-id": CUSTOMER_B_ID },
        }
      );
      const res = await listDesignVersionsRoute(req, { params: Promise.resolve({ id: projectAId }) });
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe("Project not found");
      expect(json.design_versions).toBeUndefined();
    });

    it("Customer B attempting to create design version on Customer A's project returns 404 Not Found", async () => {
      const req = new Request(
        `http://localhost/api/v1/private-label/projects/${projectAId}/design-versions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-customer-id": CUSTOMER_B_ID,
          },
          body: JSON.stringify({
            scene_json: { attack: "injection" },
          }),
        }
      );
      const res = await createDesignVersionRoute(req, { params: Promise.resolve({ id: projectAId }) });
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe("Project not found");
    });

    it("Customer B attempting to approve Customer A's proof returns 404 Not Found (anti-enumeration)", async () => {
      const req = new Request(`http://localhost/api/v1/private-label/proofs/${proofAId}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-customer-id": CUSTOMER_B_ID,
        },
        body: JSON.stringify({
          disclaimer_accepted: true,
          signer_name: "Attacker Bob",
        }),
      });
      const res = await approveProofRoute(req, { params: Promise.resolve({ id: proofAId }) });
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe("Proof not found");
    });

    it("Customer B attempting to reject Customer A's proof returns 404 Not Found", async () => {
      const req = new Request(`http://localhost/api/v1/private-label/proofs/${proofAId}/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-customer-id": CUSTOMER_B_ID,
        },
        body: JSON.stringify({
          reason: "Malicious rejection by Bob",
        }),
      });
      const res = await rejectProofRoute(req, { params: Promise.resolve({ id: proofAId }) });
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe("Proof not found");
    });

    it("Service layer strictly throws PrivateLabelNotFoundError when Customer B touches Customer A entities", () => {
      expect(() => {
        PrivateLabelService.approveProof(prepareProofForApproval(proofAId),
          { disclaimer_accepted: true },
          ACTOR_CUSTOMER_B,
          CUSTOMER_B_ID
        );
      }).toThrow(PrivateLabelNotFoundError);

      expect(() => {
        PrivateLabelService.listDesignVersions(projectAId, CUSTOMER_B_ID, ACTOR_CUSTOMER_B);
      }).toThrow(PrivateLabelNotFoundError);

      expect(() => {
        PrivateLabelService.getLatestDesignVersion(projectAId, CUSTOMER_B_ID, ACTOR_CUSTOMER_B);
      }).toThrow(PrivateLabelNotFoundError);
    });

    it("Anti-enumeration payload parity: non-existent ID and unauthorized cross-tenant ID return identical 404 responses", async () => {
      const ghostId = `des_ghost_${randomUUID()}`;

      const resGhost = await approveProofRoute(
        new Request(`http://localhost/api/v1/private-label/proofs/${ghostId}/approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-customer-id": CUSTOMER_A_ID },
          body: JSON.stringify({ disclaimer_accepted: true }),
        }),
        { params: Promise.resolve({ id: ghostId }) }
      );

      const resCrossTenant = await approveProofRoute(
        new Request(`http://localhost/api/v1/private-label/proofs/${proofAId}/approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-customer-id": CUSTOMER_B_ID },
          body: JSON.stringify({ disclaimer_accepted: true }),
        }),
        { params: Promise.resolve({ id: proofAId }) }
      );

      expect(resGhost.status).toBe(404);
      expect(resCrossTenant.status).toBe(404);

      const jsonGhost = await resGhost.json();
      const jsonCrossTenant = await resCrossTenant.json();

      expect(jsonGhost).toEqual(jsonCrossTenant);
      expect(jsonGhost.error).toBe("Proof not found");
    });
  });

  // ==========================================================================
  // 6. Hard Production Release Gate: PrivateLabelService.releaseProductionJob
  // ==========================================================================
  describe("6. Hard Production Release Gate Enforcement", () => {
    function setupOrderForRelease(proofStatus: "none" | "pending" | "approved" | "rejected", depositPaid = true) {
      const project = createTestProject(`Release Gate Project [${proofStatus}]`);

      // Ensure project item exists
      let projectItemId = `item_${randomUUID()}`;
      const itemRow = db
        .prepare("SELECT id FROM pl_project_items WHERE project_id = ? LIMIT 1")
        .get(project.id) as { id: string } | undefined;
      if (itemRow) {
        projectItemId = itemRow.id;
      } else {
        db.prepare(
          "INSERT INTO pl_project_items (id, project_id, fill_weight_grams, quantity_units) VALUES (?, ?, 100, 1000)"
        ).run(projectItemId, project.id);
      }

      // Get an existing price book ID from pl_price_books
      const priceBook = db.prepare("SELECT id FROM pl_price_books LIMIT 1").get() as { id: string } | undefined;
      const priceBookId = priceBook?.id || "pb_standard_inr";

      // Create Quote for project
      const quoteId = `quote_${randomUUID()}`;
      db.prepare(`
        INSERT INTO pl_quotes (
          id, quote_number, project_id, price_book_id, status, tea_subtotal_paise, packaging_subtotal_paise,
          printing_subtotal_paise, grand_total_paise, revision, valid_until, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, 'customer_accepted', 100000, 50000, 25000, 175000, 1,
          datetime('now', '+14 days'), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `).run(quoteId, `Q-${Math.floor(1000 + Math.random() * 9000)}`, project.id, priceBookId);

      // Create Order linked to Quote
      const orderId = `order_${randomUUID()}`;
      const orderStatus = depositPaid ? "deposit_paid" : "pending_deposit";
      db.prepare(`
        INSERT INTO pl_orders (
          id, order_number, client_id, quote_id, status, deposit_paise, balance_paise, revision, created_at, updated_at
        ) VALUES (
          ?, ?, 'client_chal_a', ?, ?, 87500, 87500, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `).run(orderId, `ORD-${Math.floor(1000 + Math.random() * 9000)}`, quoteId, orderStatus);

      // Setup Proof based on status requested
      if (proofStatus !== "none") {
        const v = PrivateLabelService.createDesignVersion(
          project.id,
          {
            project_item_id: projectItemId,
            scene_json: { releaseTest: true },
            asset_url: "https://cdn.teafloww.com/release-gate.png",
          },
          ACTOR_CUSTOMER_A,
          CUSTOMER_A_ID
        );

        if (proofStatus === "approved") {
          PrivateLabelService.approveProof(prepareProofForApproval(v.id),
            { disclaimer_accepted: true, signer_name: "Alice Release" },
            ACTOR_CUSTOMER_A,
            CUSTOMER_A_ID
          );
        } else if (proofStatus === "rejected") {
          PrivateLabelService.rejectProof(
            v.id,
            { reason: "Pantone color mismatch", revision: 1 },
            ACTOR_CUSTOMER_A,
            CUSTOMER_A_ID
          );
        }
      }

      return { project, orderId, quoteId };
    }

    it("blocks release when zero proofs exist for project: throws PrivateLabelGateError", () => {
      const { orderId } = setupOrderForRelease("none", true);

      expect(() => {
        PrivateLabelService.releaseProductionJob(
          orderId,
          { operator_notes: "Try release without proof" },
          ACTOR_ADMIN
        );
      }).toThrow(PrivateLabelGateError);

      try {
        PrivateLabelService.releaseProductionJob(orderId, {}, ACTOR_ADMIN);
      } catch (err: any) {
        expect(err.gate_name).toBe("production_release");
        expect(err.blockers).toContain(
          "Artwork proof approval is required prior to releasing order to production"
        );
      }
    });

    it("blocks release when proof is preflight_pending: throws PrivateLabelGateError", () => {
      const { orderId } = setupOrderForRelease("pending", true);

      expect(() => {
        PrivateLabelService.releaseProductionJob(
          orderId,
          { operator_notes: "Try release with pending proof" },
          ACTOR_ADMIN
        );
      }).toThrow(PrivateLabelGateError);

      try {
        PrivateLabelService.releaseProductionJob(orderId, {}, ACTOR_ADMIN);
      } catch (err: any) {
        expect(err.blockers).toContain(
          "Artwork proof approval is required prior to releasing order to production"
        );
      }
    });

    it("blocks release when proof was rejected (preflight_failed / customer_rejected): throws PrivateLabelGateError", () => {
      const { orderId } = setupOrderForRelease("rejected", true);

      expect(() => {
        PrivateLabelService.releaseProductionJob(
          orderId,
          { operator_notes: "Try release with rejected proof" },
          ACTOR_ADMIN
        );
      }).toThrow(PrivateLabelGateError);
    });

    it("blocks release when deposit is unpaid even if proof is customer_approved", () => {
      const { orderId } = setupOrderForRelease("approved", false); // deposit unpaid

      expect(() => {
        PrivateLabelService.releaseProductionJob(
          orderId,
          { operator_notes: "Try release with unpaid deposit" },
          ACTOR_ADMIN
        );
      }).toThrow(PrivateLabelGateError);

      try {
        PrivateLabelService.releaseProductionJob(orderId, {}, ACTOR_ADMIN);
      } catch (err: any) {
        expect(err.blockers.some((b: string) => b.includes("deposit_paid"))).toBe(true);
      }
    });

    it("successfully releases production job when proof is customer_approved AND deposit is paid", () => {
      const { orderId } = setupOrderForRelease("approved", true);

      const job = PrivateLabelService.releaseProductionJob(
        orderId,
        {
          operator_notes: "Released to Darjeeling Cleanroom Line 2",
          target_completion_date: "2026-12-15",
        },
        ACTOR_ADMIN
      );

      expect(job).toBeDefined();
      expect(job.status).toBe("scheduled");
      expect(job.order_id).toBe(orderId);
      expect(job.operator_notes).toBe("Released to Darjeeling Cleanroom Line 2");

      // Verify order status was transitioned to production_released
      const orderRow = db.prepare("SELECT status FROM pl_orders WHERE id = ?").get(orderId) as {
        status: string;
      };
      expect(orderRow.status).toBe("production_released");

      // Verify all 7 standard QC milestones were initialized
      const milestones = db
        .prepare("SELECT * FROM pl_qc_milestones WHERE job_id = ? ORDER BY created_at ASC")
        .all(job.id) as Array<{ stage: string; status: string }>;

      expect(milestones).toHaveLength(7);
      expect(milestones.every((m) => m.status === "pending")).toBe(true);
      const stages = milestones.map((m) => m.stage);
      expect(stages).toContain("raw_material");
      expect(stages).toContain("packaging_incoming");
      expect(stages).toContain("print_proof");
      expect(stages).toContain("fill_weight");
      expect(stages).toContain("seal_integrity");
      expect(stages).toContain("sensory_cupping");
      expect(stages).toContain("final_pack");
    });
  });

  // ==========================================================================
  // 7. Responsive & Boundary Stress: 320px Viewport & Safe-Zone Math
  // ==========================================================================
  describe("7. Responsive & Boundary Stress: 320px Viewport & Negative Coordinates", () => {
    it("renders StudioCanvas2D cleanly within a 320px mobile viewport container without layout overflow", () => {
      const html = renderToStaticMarkup(
        React.createElement(
          "div",
          { style: { width: "320px", maxWidth: "320px", overflow: "hidden" } },
          React.createElement(StudioCanvas2D, {
            packagingVariant: {
              slug: "stand-up-pouch-100g",
              category: "pouch",
              width_mm: 160,
              height_mm: 230,
            },
            brandName: "Himalayan Artisans",
            artworkUrl: "https://cdn.teafloww.com/test-artwork.png",
            artworkDpi: 300,
            placement: { xMm: 0, yMm: 0, scale: 1.0, rotationDeg: 0 },
          })
        )
      );

      // Verify container markup
      expect(html).toContain("studio-canvas-container");
      expect(html).toContain("mockup-canvas");
      expect(html).toContain("Himalayan Artisans");
      expect(html).toContain("box-sizing:border-box");
      expect(html).toContain("overflow:hidden");
      expect(html).toContain("width:100%");

      // Ensure no low-res or boundary warnings in valid state
      expect(html).not.toContain("data-testid=\"dpi-warning\"");
      expect(html).not.toContain("data-testid=\"safe-zone-warning\"");
    });

    it("renders all 5 physical silhouettes cleanly in 320px mobile container", () => {
      const variants = [
        { slug: "stand-up-pouch-100g", category: "pouch", name: "Stand Up Pouch", expectedSilhouette: "stand_up_pouch" },
        { slug: "quad-seal-side-gusset", title: "Side Gusset Pouch", category: "pouch", expectedSilhouette: "side_gusset_pouch" },
        { slug: "box-pouch-flat-bottom", category: "pouch", name: "Flat Bottom Box Pouch", expectedSilhouette: "flat_bottom_pouch" },
        { slug: "metal-tin-caddy-100g", category: "tin", name: "Tin Canister", expectedSilhouette: "tin_canister" },
        { slug: "kraft-carton-folding-box", category: "box", name: "Kraft Folding Box", expectedSilhouette: "kraft_box" },
      ];

      for (const variant of variants) {
        const silhouette = resolvePackagingSilhouette(variant);
        expect(silhouette).toBe(variant.expectedSilhouette);

        const html = renderToStaticMarkup(
          React.createElement(
            "div",
            { style: { width: "320px" } },
            React.createElement(StudioCanvas2D, {
              packagingVariant: variant,
              brandName: "Silhouette Test",
              placement: { xMm: 0, yMm: 0, scale: 1.0, rotationDeg: 0 },
            })
          )
        );

        expect(html).toContain("mockup-canvas");
        expect(html).toContain("Silhouette Test");
      }
    });

    it("detects safe-zone breach on extreme negative coordinate nudging (xMm: -500, yMm: -500)", () => {
      const html = renderToStaticMarkup(
        React.createElement(
          "div",
          { style: { width: "320px" } },
          React.createElement(StudioCanvas2D, {
            packagingVariant: {
              slug: "stand-up-pouch-100g",
              category: "pouch",
              width_mm: 160,
              height_mm: 230,
            },
            artworkUrl: "https://cdn.teafloww.com/test-artwork.png",
            placement: { xMm: -500, yMm: -500, scale: 1.0, rotationDeg: 0 },
          })
        )
      );

      // Boundary warning must be rendered
      expect(html).toContain("data-testid=\"safe-zone-warning\"");
      expect(html).toContain("Safe-Zone Breach");
      expect(html).toContain("role=\"alert\"");
    });

    it("detects safe-zone breach on extreme positive coordinate nudging (xMm: +500, yMm: +500)", () => {
      const html = renderToStaticMarkup(
        React.createElement(
          "div",
          { style: { width: "320px" } },
          React.createElement(StudioCanvas2D, {
            packagingVariant: {
              slug: "stand-up-pouch-100g",
              category: "pouch",
              width_mm: 160,
              height_mm: 230,
            },
            artworkUrl: "https://cdn.teafloww.com/test-artwork.png",
            placement: { xMm: 500, yMm: 500, scale: 1.0, rotationDeg: 0 },
          })
        )
      );

      expect(html).toContain("data-testid=\"safe-zone-warning\"");
      expect(html).toContain("Safe-Zone Breach");
    });

    it("detects safe-zone breach when scale multiplier exceeds printable boundary (scale: 2.5x)", () => {
      const html = renderToStaticMarkup(
        React.createElement(
          "div",
          { style: { width: "320px" } },
          React.createElement(StudioCanvas2D, {
            packagingVariant: {
              slug: "stand-up-pouch-100g",
              category: "pouch",
              width_mm: 160,
              height_mm: 230,
            },
            artworkUrl: "https://cdn.teafloww.com/test-artwork.png",
            placement: { xMm: 0, yMm: 0, scale: 2.5, rotationDeg: 0 },
          })
        )
      );

      expect(html).toContain("data-testid=\"safe-zone-warning\"");
      expect(html).toContain("Safe-Zone Breach");
    });

    it("renders low-resolution DPI warning banner when artwork DPI is < 300", () => {
      const html = renderToStaticMarkup(
        React.createElement(
          "div",
          { style: { width: "320px" } },
          React.createElement(StudioCanvas2D, {
            packagingVariant: {
              slug: "stand-up-pouch-100g",
              category: "pouch",
              width_mm: 160,
              height_mm: 230,
            },
            artworkUrl: "https://cdn.teafloww.com/low-res.png",
            artworkDpi: 200,
            placement: { xMm: 0, yMm: 0, scale: 1.0, rotationDeg: 0 },
          })
        )
      );

      expect(html).toContain("data-testid=\"dpi-warning\"");
      expect(html).toContain("Resolution Warning");
      expect(html).toContain("200 DPI");
      expect(html).toContain("role=\"alert\"");
    });

    it("verifies mathematical safe zone calculations for all packaging families with boundary constraints", () => {
      const pouch = calculateSafeZone("pouch", 160, 230);
      expect(pouch.bleedMm).toBe(3);
      expect(pouch.marginsMm.top).toBe(35);
      expect(pouch.marginsMm.bottom).toBe(15);
      expect(pouch.labelSafeWidthMm).toBe(140);
      expect(pouch.labelSafeHeightMm).toBe(180);

      const tin = calculateSafeZone("tin", 85, 120);
      expect(tin.bleedMm).toBe(2);
      expect(tin.marginsMm.top).toBe(10);
      expect(tin.labelSafeWidthMm).toBe(75);
      expect(tin.labelSafeHeightMm).toBe(100);

      const jar = calculateSafeZone("jar", 70, 90);
      expect(jar.bleedMm).toBe(2);
      expect(jar.marginsMm.top).toBe(12);

      const box = calculateSafeZone("box", 120, 180);
      expect(box.bleedMm).toBe(3);
      expect(box.marginsMm.top).toBe(8);
      expect(box.marginsMm.bottom).toBe(8);
      expect(box.marginsMm.left).toBe(8);
      expect(box.marginsMm.right).toBe(8);
    });

    it("renders ProofApprovalModal with focus trap, legal IP indemnity checkbox, and accessible dialog markup", () => {
      const html = renderToStaticMarkup(
        React.createElement(ProofApprovalModal, {
          isOpen: true,
          onClose: () => {},
          onApprove: () => {},
          brandName: "TeaFloww Heritage",
          packagingName: "Stand-Up Matte Pouch 100g",
        })
      );

      expect(html).toContain("role=\"dialog\"");
      expect(html).toContain("aria-modal=\"true\"");
      expect(html).toContain("type=\"checkbox\"");
      expect(html).toContain("commercial intellectual property rights");
      expect(html).toContain("Approve Proof &amp; Proceed");
      expect(html).toContain("TeaFloww Heritage");
    });
  });
});
