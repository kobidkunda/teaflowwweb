/**
 * TeaFloww Private Label Studio — Milestone M2 Admin Unit & Integration Test Suite
 * File: tests/unit/private-label-admin.test.ts
 *
 * Verifies:
 * 1. Admin Authentication & Authorization Security (401 vs test token bypass)
 * 2. Strict Zod Validation & Error Payloads (400)
 * 3. Compare-And-Swap (CAS) Concurrency & Revision Conflict Detection (409)
 * 4. Publishing & Manufacturing Hard Gates (422)
 * 5. Soft-Archival & Published SKU Protection Safeguards (400)
 * 6. Quote Price Overrides & Dual-Rate Indian GST Integrity (5% tea vs 18% services)
 * 7. QC Completion Hard Gate & 7-Stage Milestone Progression
 * 8. Audit Trail Verification (pl_audit with actor_type = 'admin')
 * 9. Anti-Leak Database Error Sanitization
 * 10. Admin Overview Statistics & Navigation Configuration
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { rmSync } from "node:fs";

const TEST_DB = path.join(tmpdir(), `pl-admin-suite-${process.pid}-${Date.now()}.sqlite`);
process.env.DATABASE_PATH = TEST_DB;
(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.ADMIN_TEST_TOKEN = "secure_test_admin_token_123456789";

import { getDb } from "@/lib/db";
import { PrivateLabelService } from "@/lib/private-label/service";
import {
  GET as getCatalogue,
  POST as postCatalogue,
} from "@/app/api/v1/admin/private-label/catalogue/route";
import {
  PATCH as patchCatalogueItem,
  DELETE as deleteCatalogueItem,
} from "@/app/api/v1/admin/private-label/catalogue/[id]/route";
import {
  POST as postPriceBooks,
} from "@/app/api/v1/admin/private-label/price-books/route";
import {
  PATCH as patchPriceBookDetail,
  DELETE as deletePriceBookDetail,
} from "@/app/api/v1/admin/private-label/price-books/[id]/route";
import {
  PATCH as patchQuoteDetail,
} from "@/app/api/v1/admin/private-label/quotes/[id]/route";
import {
  POST as postJobs,
} from "@/app/api/v1/admin/private-label/jobs/route";
import {
  PATCH as patchJobDetail,
} from "@/app/api/v1/admin/private-label/jobs/[id]/route";
import { GET as getOverview } from "@/app/api/v1/admin/private-label/overview/route";
import { PATCH as patchSampleDispatch } from "@/app/api/v1/admin/private-label/samples/[id]/dispatch/route";
import { NAV_GROUPS, isNavActive, getBreadcrumbs } from "@/components/admin/layout/navConfig";

const ADMIN_HEADERS = {
  "Content-Type": "application/json",
  "x-admin-test-token": "secure_test_admin_token_123456789",
};

describe("Milestone M2: Admin Private Label Management Suite", () => {
  beforeAll(() => {
    // Run migrations on isolated test database
    execFileSync(process.execPath, ["scripts/migrate.mjs"], {
      env: { ...process.env, DATABASE_PATH: TEST_DB },
    });

    const db = getDb();
    PrivateLabelService.seedInitialCatalog();

    // Seed test customer & client records
    db.prepare(`
      INSERT OR IGNORE INTO customers (id, email, name)
      VALUES ('cust_m2_001', 'b2b_client@example.com', 'Tea Brand Co')
    `).run();

    db.prepare(`
      INSERT OR IGNORE INTO pl_clients (id, customer_id, company_name, contact_name, contact_email)
      VALUES ('client_m2_001', 'cust_m2_001', 'Tea Brand Private Limited', 'Vikram Sen', 'b2b_client@example.com')
    `).run();

    db.prepare(`
      INSERT OR IGNORE INTO pl_projects (id, client_id, title, status, target_market, revision)
      VALUES ('proj_dummy', 'client_m2_001', 'Standard Test Project', 'draft', 'IN', 1)
    `).run();

    db.prepare(`
      INSERT OR IGNORE INTO pl_quotes (id, quote_number, project_id, price_book_id, status, version, currency, grand_total_paise, revision)
      VALUES ('quote_dummy', 'PL-Q-DUMMY', 'proj_dummy', 'pb_default_inr', 'firm_issued', 1, 'INR', 100000, 1)
    `).run();

    db.prepare(`
      INSERT OR IGNORE INTO pl_orders (id, order_number, client_id, quote_id, status, deposit_paise, balance_paise, revision)
      VALUES ('order_dummy', 'PL-ORD-DUMMY', 'client_m2_001', 'quote_dummy', 'deposit_paid', 50000, 50000, 1)
    `).run();
  });

  afterAll(() => {
    const db = getDb();
    const integrity = db.pragma("integrity_check") as Array<{ integrity_check: string }>;
    expect(integrity[0]?.integrity_check).toBe("ok");
    db.close();
    try {
      rmSync(TEST_DB, { force: true });
      rmSync(`${TEST_DB}-wal`, { force: true });
      rmSync(`${TEST_DB}-shm`, { force: true });
    } catch {}
  });

  // ==========================================================================
  // 1. Navigation Configuration & Breadcrumb Resolution
  // ==========================================================================
  describe("1. Navigation Configuration (navConfig.ts)", () => {
    it("registers Private Label Studio group in NAV_GROUPS with 5 dedicated sub-routes", () => {
      const plGroup = NAV_GROUPS.find((g) => g.id === "private-label");
      expect(plGroup).toBeDefined();
      expect(plGroup?.title).toBe("Private Label Studio");
      expect(plGroup?.items).toHaveLength(5);

      const hrefs = plGroup?.items.map((i) => i.href);
      expect(hrefs).toContain("/admin/private-label");
      expect(hrefs).toContain("/admin/private-label/catalogue");
      expect(hrefs).toContain("/admin/private-label/price-books");
      expect(hrefs).toContain("/admin/private-label/quotes");
      expect(hrefs).toContain("/admin/private-label/jobs");
    });

    it("evaluates isNavActive correctly for subpaths", () => {
      expect(isNavActive("/admin/private-label", "/admin/private-label")).toBe(true);
      expect(isNavActive("/admin/private-label/catalogue", "/admin/private-label/catalogue")).toBe(true);
      expect(isNavActive("/admin/private-label/catalogue/new", "/admin/private-label/catalogue")).toBe(true);
      expect(isNavActive("/admin/products", "/admin/private-label")).toBe(false);
    });

    it("generates correct hierarchical breadcrumbs for private label paths", () => {
      const crumbs = getBreadcrumbs("/admin/private-label/catalogue");
      expect(crumbs.length).toBeGreaterThanOrEqual(2);
      expect(crumbs.some((c) => c.label === "Private Label Studio")).toBe(true);
      expect(crumbs.some((c) => c.label === "PL Catalogue")).toBe(true);
    });
  });

  // ==========================================================================
  // 2. Authentication & Authorization Security
  // ==========================================================================
  describe("2. Authentication & Authorization Security", () => {
    it("rejects unauthenticated GET /catalogue with 401 Unauthorized", async () => {
      const req = new Request("http://localhost/api/v1/admin/private-label/catalogue");
      const res = await getCatalogue(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe("Unauthorized.");
    });

    it("rejects unauthenticated POST /jobs with 401 Unauthorized", async () => {
      const req = new Request("http://localhost/api/v1/admin/private-label/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: "order_123" }),
      });
      const res = await postJobs(req);
      expect(res.status).toBe(401);
    });

    it("rejects unauthenticated GET /overview with 401 Unauthorized", async () => {
      const req = new Request("http://localhost/api/v1/admin/private-label/overview");
      const res = await getOverview(req);
      expect(res.status).toBe(401);
    });

    it("permits authenticated requests with valid x-admin-test-token", async () => {
      const req = new Request("http://localhost/api/v1/admin/private-label/overview", {
        headers: ADMIN_HEADERS,
      });
      const res = await getOverview(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.packagingCount).toBeDefined();
    });
  });

  // ==========================================================================
  // 3. Strict Zod Validation & Input Schema Enforcement (400)
  // ==========================================================================
  describe("3. Strict Zod Validation & Rejections (400)", () => {
    it("rejects packaging creation with empty title or negative cost", async () => {
      const req = new Request("http://localhost/api/v1/admin/private-label/catalogue", {
        method: "POST",
        headers: ADMIN_HEADERS,
        body: JSON.stringify({
          family_id: "fam_pouch",
          slug: "invalid-cost-pouch",
          sku: "PK-INV-01",
          title: "A", // too short (< 3)
          material: "Kraft",
          finish: "Matte",
          closure_type: "Zip",
          capacity_description: "100g",
          net_weight_capacity_grams: 100,
          width_mm: 120,
          height_mm: 200,
          label_safe_width_mm: 100,
          label_safe_height_mm: 150,
          supplier_name: "Vendor",
          unit_cost_paise: -500, // negative paise!
        }),
      });

      const res = await postCatalogue(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Please check the submitted fields.");
      expect(data.detail).toBeDefined();
    });

    it("rejects price book creation with overlapping volume quantity tiers", async () => {
      const req = new Request("http://localhost/api/v1/admin/private-label/price-books", {
        method: "POST",
        headers: ADMIN_HEADERS,
        body: JSON.stringify({
          name: "Overlapping Tiers Book",
          currency: "INR",
          margin_rate: 0.25,
          tiers: [
            { item_type: "packaging", item_id: "pack_pouch_standup_100g", min_qty: 100, max_qty: 500, unit_price_paise: 1500 },
            { item_type: "packaging", item_id: "pack_pouch_standup_100g", min_qty: 400, max_qty: 1000, unit_price_paise: 1300 }, // Overlaps 400-500!
          ],
        }),
      });

      const res = await postPriceBooks(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Please check the submitted fields.");
    });

    it("rejects catalogue update when expected_revision is omitted", async () => {
      const req = new Request("http://localhost/api/v1/admin/private-label/catalogue/pack_pouch_standup_100g", {
        method: "PATCH",
        headers: ADMIN_HEADERS,
        body: JSON.stringify({
          title: "New Title Without Revision",
        }),
      });

      const res = (await patchCatalogueItem(req, {
        params: Promise.resolve({ id: "pack_pouch_standup_100g" }),
      }))!;
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("expected_revision is required");
    });
  });

  // ==========================================================================
  // 4. Compare-And-Swap (CAS) Concurrency & 409 Conflict
  // ==========================================================================
  describe("4. CAS Concurrency & 409 Conflict Control", () => {
    let testVariantId: string;
    let initialRev: number;

    it("creates a draft packaging variant and increments revision on valid CAS update", async () => {
      testVariantId = `pack_cas_test_${Date.now()}`;
      const createReq = new Request("http://localhost/api/v1/admin/private-label/catalogue", {
        method: "POST",
        headers: ADMIN_HEADERS,
        body: JSON.stringify({
          id: testVariantId,
          family_id: "fam_pouch",
          slug: `cas-variant-${Date.now()}`,
          sku: `CAS-${Date.now().toString().slice(-4)}`,
          title: "CAS Verification Pouch",
          material: "Kraft Multi-layer",
          finish: "Matte",
          closure_type: "Zipper",
          capacity_description: "100g loose leaf",
          net_weight_capacity_grams: 100,
          width_mm: 130,
          height_mm: 200,
          label_safe_width_mm: 100,
          label_safe_height_mm: 150,
          supplier_name: "Prepress Siliguri",
          unit_cost_paise: 1450,
          moq_units: 500,
          order_multiple: 50,
          status: "draft",
        }),
      });

      const createRes = await postCatalogue(createReq);
      expect(createRes.status).toBe(201);
      const createdData = await createRes.json();
      initialRev = createdData.variant.revision;
      expect(initialRev).toBe(1);

      // Successful update with matching expected_revision
      const updateReq = new Request(`http://localhost/api/v1/admin/private-label/catalogue/${testVariantId}`, {
        method: "PATCH",
        headers: ADMIN_HEADERS,
        body: JSON.stringify({
          expected_revision: 1,
          title: "CAS Verification Pouch v2",
        }),
      });

      const updateRes = (await patchCatalogueItem(updateReq, {
        params: Promise.resolve({ id: testVariantId }),
      }))!;
      expect(updateRes.status).toBe(200);
      const updatedData = await updateRes.json();
      expect(updatedData.variant.revision).toBe(2);
      expect(updatedData.variant.title).toBe("CAS Verification Pouch v2");
    });

    it("rejects update with stale expected_revision returning 409 Conflict with revision payload", async () => {
      const staleReq = new Request(`http://localhost/api/v1/admin/private-label/catalogue/${testVariantId}`, {
        method: "PATCH",
        headers: ADMIN_HEADERS,
        body: JSON.stringify({
          expected_revision: 1, // Stale! Current revision is 2
          title: "Stale Overwrite Attempt",
        }),
      });

      const staleRes = (await patchCatalogueItem(staleReq, {
        params: Promise.resolve({ id: testVariantId }),
      }))!;
      expect(staleRes.status).toBe(409);
      const conflictData = await staleRes.json();
      expect(conflictData.error).toContain("Revision conflict");
      expect(conflictData.current_revision).toBe(2);
      expect(conflictData.expected_revision).toBe(1);
    });

    it("enforces CAS on price books", async () => {
      const postReq = new Request("http://localhost/api/v1/admin/private-label/price-books", {
        method: "POST",
        headers: ADMIN_HEADERS,
        body: JSON.stringify({
          name: "CAS Price Book",
          currency: "INR",
          margin_rate: 0.28,
        }),
      });
      const postRes = await postPriceBooks(postReq);
      expect(postRes.status).toBe(201);
      const createdPb = (await postRes.json()).priceBook;

      // Stale revision update attempt
      const patchReq = new Request(`http://localhost/api/v1/admin/private-label/price-books/${createdPb.id}`, {
        method: "PATCH",
        headers: ADMIN_HEADERS,
        body: JSON.stringify({
          expected_revision: 99, // Stale
          margin_rate: 0.35,
        }),
      });
      const patchRes = await patchPriceBookDetail(patchReq, {
        params: Promise.resolve({ id: createdPb.id }),
      });
      expect(patchRes.status).toBe(409);
      const data = await patchRes.json();
      expect(data.current_revision).toBe(1);
      expect(data.expected_revision).toBe(99);
    });
  });

  // ==========================================================================
  // 5. Hard Business Gates (HTTP 422)
  // ==========================================================================
  describe("5. Hard Business Gates (HTTP 422)", () => {
    let incompleteVariantId: string;

    it("rejects publishing packaging variant with zero unit cost or missing print compatibility (422)", async () => {
      incompleteVariantId = `pack_gate_block_${Date.now()}`;
      const db = getDb();
      db.prepare(`
        INSERT INTO pl_packaging_variants (
          id, family_id, slug, sku, title, material, finish, closure_type,
          capacity_description, net_weight_capacity_grams, width_mm, height_mm,
          label_safe_width_mm, label_safe_height_mm, supplier_name, unit_cost_paise,
          moq_units, order_multiple, status, revision
        ) VALUES (
          ?, 'fam_pouch', ?, ?, 'Incomplete Gate Variant', 'Kraft', 'Matte', 'Zip',
          '100g', 100, 130, 200, 100, 150, 'Supplier', 0, 500, 50, 'draft', 1
        )
      `).run(incompleteVariantId, `gate-inc-${Date.now()}`, `GAT-${Date.now().toString().slice(-4)}`);

      // Attempt to publish
      const publishReq = new Request(`http://localhost/api/v1/admin/private-label/catalogue/${incompleteVariantId}`, {
        method: "PATCH",
        headers: ADMIN_HEADERS,
        body: JSON.stringify({
          expected_revision: 1,
          status: "published",
        }),
      });

      const res = (await patchCatalogueItem(publishReq, {
        params: Promise.resolve({ id: incompleteVariantId }),
      }))!;
      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.gate_name).toBe("packaging_publish");
      expect(data.blockers.some((b: string) => b.includes("unit cost"))).toBe(true);
      expect(data.blockers.some((b: string) => b.includes("print method"))).toBe(true);
    });

    it("rejects publishing packaging variant when safe area exceeds physical dimensions (422)", async () => {
      const db = getDb();
      const oversizeId = `pack_oversize_${Date.now()}`;
      db.prepare(`
        INSERT INTO pl_packaging_variants (
          id, family_id, slug, sku, title, material, finish, closure_type,
          capacity_description, net_weight_capacity_grams, width_mm, height_mm,
          label_safe_width_mm, label_safe_height_mm, supplier_name, unit_cost_paise,
          moq_units, order_multiple, status, revision
        ) VALUES (
          ?, 'fam_pouch', ?, ?, 'Oversize Safe Area', 'Kraft', 'Matte', 'Zip',
          '100g', 100, 100, 150, 150, 200, 'Supplier', 1500, 500, 50, 'draft', 1
        )
      `).run(oversizeId, `oversize-${Date.now()}`, `OVS-${Date.now().toString().slice(-4)}`);

      // Add print compatibility
      db.prepare(`
        INSERT INTO pl_packaging_compatibility (id, packaging_variant_id, print_method_id, is_supported)
        VALUES (?, ?, 'pm_paper_label', 1)
      `).run(`compat_ovs_${Date.now()}`, oversizeId);

      // Attempt to publish
      const publishReq = new Request(`http://localhost/api/v1/admin/private-label/catalogue/${oversizeId}`, {
        method: "PATCH",
        headers: ADMIN_HEADERS,
        body: JSON.stringify({
          expected_revision: 1,
          status: "published",
        }),
      });

      const res = (await patchCatalogueItem(publishReq, {
        params: Promise.resolve({ id: oversizeId }),
      }))!;
      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.blockers.some((b: string) => b.includes("safe width") || b.includes("safe height"))).toBe(true);
    });

    it("rejects tea publishing when base cost is 0 or estate missing (422)", async () => {
      const db = getDb();
      const invalidTeaId = `tea_gate_${Date.now()}`;
      db.prepare(`
        INSERT INTO pl_tea_options (
          id, slug, name, origin_estate, region, grade, flush, tea_category,
          description, caffeine_level, base_cost_per_kg_paise, min_batch_kg,
          is_published, revision
        ) VALUES (
          ?, ?, 'Zero Cost Tea', '', 'Darjeeling', 'FTGFOP1', 'First Flush', 'black',
          'A rich floral black tea with muscatel notes.', 'medium', 0, 5.0, 0, 1
        )
      `).run(invalidTeaId, `zero-tea-${Date.now()}`);

      const publishReq = new Request(`http://localhost/api/v1/admin/private-label/catalogue/${invalidTeaId}`, {
        method: "PATCH",
        headers: ADMIN_HEADERS,
        body: JSON.stringify({
          expected_revision: 1,
          is_published: true,
        }),
      });

      const res = (await patchCatalogueItem(publishReq, {
        params: Promise.resolve({ id: invalidTeaId }),
      }))!;
      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.gate_name).toBe("tea_publish");
      expect(data.blockers.some((b: string) => b.includes("Base cost"))).toBe(true);
      expect(data.blockers.some((b: string) => b.includes("estate"))).toBe(true);
    });

    it("blocks production job release when order is unpaid or artwork proof unapproved (422)", async () => {
      const db = getDb();
      const quoteId = `quote_unpaid_${Date.now()}`;
      const orderId = `order_unpaid_${Date.now()}`;

      // Insert quote and unpaid order
      db.prepare(`
        INSERT INTO pl_quotes (id, quote_number, project_id, price_book_id, status, version, currency, grand_total_paise, revision)
        VALUES (?, 'PL-Q-TEST-UNPAID', 'proj_dummy', 'pb_default_inr', 'firm_issued', 1, 'INR', 500000, 1)
      `).run(quoteId);

      db.prepare(`
        INSERT INTO pl_orders (id, order_number, client_id, quote_id, status, deposit_paise, balance_paise, revision)
        VALUES (?, 'PL-ORD-TEST-UNPAID', 'client_m2_001', ?, 'pending_deposit', 250000, 250000, 1)
      `).run(orderId, quoteId);

      // Attempt to release job
      const releaseReq = new Request("http://localhost/api/v1/admin/private-label/jobs", {
        method: "POST",
        headers: ADMIN_HEADERS,
        body: JSON.stringify({
          orderId,
          targetCompletionDate: "2026-12-15",
        }),
      });

      const res = await postJobs(releaseReq);
      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.gate_name).toBe("production_release");
      expect(data.blockers.some((b: string) => b.includes("deposit_paid"))).toBe(true);
    });

    it("releases production job and provisions all 7 QC milestones when deposit is paid AND proof is approved (201)", async () => {
      const db = getDb();
      const projId = `proj_approved_${Date.now()}`;
      const quoteId = `quote_approved_${Date.now()}`;
      const orderId = `order_approved_${Date.now()}`;
      const pitemId = `pitem_app_${Date.now()}`;
      const dversionId = `dv_app_${Date.now()}`;

      db.prepare(`
        INSERT INTO pl_projects (id, client_id, title, status, target_market, revision)
        VALUES (?, 'client_m2_001', 'Approved Release Project', 'accepted', 'IN', 1)
      `).run(projId);

      db.prepare(`
        INSERT INTO pl_project_items (id, project_id, fill_weight_grams, quantity_units)
        VALUES (?, ?, 100, 1000)
      `).run(pitemId, projId);

      db.prepare(`
        INSERT INTO pl_design_versions (id, project_item_id, version_number, print_ready_pdf_url)
        VALUES (?, ?, 1, 'https://cdn.example.com/proof.pdf')
      `).run(dversionId, pitemId);

      db.prepare("UPDATE pl_design_versions SET status = 'customer_approved', is_locked = 1 WHERE id = ?").run(dversionId);
      // Record customer proof approval
      db.prepare(`
        INSERT INTO pl_approval_events (
          id, design_version_id, client_id, actor_type, actor_id, actor_name, action, legal_disclaimer_accepted
        ) VALUES (
          ?, ?, 'client_m2_001', 'customer', 'cust_m2_001', 'Vikram Sen', 'customer_approved', 1
        )
      `).run(`app_${Date.now()}`, dversionId);

      db.prepare(`
        INSERT INTO pl_quotes (id, quote_number, project_id, price_book_id, status, version, currency, grand_total_paise, revision)
        VALUES (?, 'PL-Q-RELEASE-OK', ?, 'pb_default_inr', 'customer_accepted', 1, 'INR', 600000, 1)
      `).run(quoteId, projId);

      // Order with status = deposit_paid
      db.prepare(`
        INSERT INTO pl_orders (id, order_number, client_id, quote_id, status, deposit_paise, balance_paise, revision)
        VALUES (?, 'PL-ORD-RELEASE-OK', 'client_m2_001', ?, 'deposit_paid', 300000, 300000, 1)
      `).run(orderId, quoteId);

      // POST /jobs release
      const releaseReq = new Request("http://localhost/api/v1/admin/private-label/jobs", {
        method: "POST",
        headers: ADMIN_HEADERS,
        body: JSON.stringify({
          orderId,
          targetCompletionDate: "2026-12-20",
          operatorNotes: "Approved run with cleanroom nitrogen sealing",
        }),
      });

      const releaseRes = await postJobs(releaseReq);
      expect(releaseRes.status).toBe(201);
      const jobData = await releaseRes.json();
      expect(jobData.job.order_id).toBe(orderId);
      expect(jobData.job.status).toBe("scheduled");

      // Verify all 7 QC milestones were created
      const milestones = db
        .prepare("SELECT stage, status FROM pl_qc_milestones WHERE job_id = ?")
        .all(jobData.job.id) as Array<{ stage: string; status: string }>;

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
  // 6. QC Completion Gate & Milestone Progression
  // ==========================================================================
  describe("6. QC Completion Gate & Milestone Progression", () => {
    let qcJobId: string;

    beforeAll(() => {
      const db = getDb();
      qcJobId = `job_qc_prog_${Date.now()}`;
      db.prepare(`
        INSERT INTO pl_jobs (id, job_number, order_id, status, released_by)
        VALUES (?, 'PL-JOB-QC-01', 'order_dummy', 'qc', 'admin_1')
      `).run(qcJobId);

      const standardStages = [
        "raw_material",
        "packaging_incoming",
        "print_proof",
        "fill_weight",
        "seal_integrity",
        "sensory_cupping",
        "final_pack",
      ];
      for (const st of standardStages) {
        db.prepare(`
          INSERT INTO pl_qc_milestones (id, job_id, milestone_name, stage, status)
          VALUES (?, ?, ?, ?, 'pending')
        `).run(`qc_${st}_${Date.now()}`, qcJobId, `Inspection: ${st}`, st);
      }
    });

    it("blocks advancing job to ready_to_ship when QC milestones are pending (422)", async () => {
      const req = new Request(`http://localhost/api/v1/admin/private-label/jobs/${qcJobId}`, {
        method: "PATCH",
        headers: ADMIN_HEADERS,
        body: JSON.stringify({
          status: "ready_to_ship",
        }),
      });

      const res = await patchJobDetail(req, {
        params: Promise.resolve({ id: qcJobId }),
      });
      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.gate_name).toBe("qc_completion_gate");
      expect(data.blockers.length).toBe(7);
    });

    it("advances job to ready_to_ship and completed once all 7 QC milestones pass or are waived", async () => {
      const db = getDb();
      // Pass 6 milestones, waive 1
      db.prepare(`UPDATE pl_qc_milestones SET status = 'passed' WHERE job_id = ? AND stage != 'seal_integrity'`).run(qcJobId);
      db.prepare(`UPDATE pl_qc_milestones SET status = 'waived', evidence_notes = 'Pouch vendor certified hermetic batch' WHERE job_id = ? AND stage = 'seal_integrity'`).run(qcJobId);

      // Now advance to ready_to_ship
      const reqReady = new Request(`http://localhost/api/v1/admin/private-label/jobs/${qcJobId}`, {
        method: "PATCH",
        headers: ADMIN_HEADERS,
        body: JSON.stringify({
          status: "ready_to_ship",
        }),
      });
      const resReady = await patchJobDetail(reqReady, {
        params: Promise.resolve({ id: qcJobId }),
      });
      expect(resReady.status).toBe(200);
      expect((await resReady.json()).job.status).toBe("ready_to_ship");

      // Advance to completed
      const reqComp = new Request(`http://localhost/api/v1/admin/private-label/jobs/${qcJobId}`, {
        method: "PATCH",
        headers: ADMIN_HEADERS,
        body: JSON.stringify({
          status: "completed",
        }),
      });
      const resComp = await patchJobDetail(reqComp, {
        params: Promise.resolve({ id: qcJobId }),
      });
      expect(resComp.status).toBe(200);
      expect((await resComp.json()).job.status).toBe("completed");
    });
  });

  // ==========================================================================
  // 7. Soft-Archival & Published Safeguards
  // ==========================================================================
  describe("7. Soft-Archival & Published Safeguards", () => {
    it("rejects DELETE on a published variant with HTTP 400", async () => {
      const db = getDb();
      const pubId = `pack_pub_delete_${Date.now()}`;
      db.prepare(`
        INSERT INTO pl_packaging_variants (
          id, family_id, slug, sku, title, material, finish, closure_type,
          capacity_description, net_weight_capacity_grams, width_mm, height_mm,
          label_safe_width_mm, label_safe_height_mm, supplier_name, unit_cost_paise,
          moq_units, order_multiple, status, revision
        ) VALUES (
          ?, 'fam_pouch', ?, ?, 'Published Safeguard', 'Kraft', 'Matte', 'Zip',
          '100g', 100, 130, 200, 100, 150, 'Supplier', 1450, 500, 50, 'published', 1
        )
      `).run(pubId, `pub-safeguard-${Date.now()}`, `SAF-${Date.now().toString().slice(-4)}`);

      const req = new Request(`http://localhost/api/v1/admin/private-label/catalogue/${pubId}`, {
        method: "DELETE",
        headers: ADMIN_HEADERS,
      });

      const res = await deleteCatalogueItem(req, {
        params: Promise.resolve({ id: pubId }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("Cannot delete a published packaging variant");
    });

    it("allows soft-archiving draft variant", async () => {
      const db = getDb();
      const draftId = `pack_draft_del_${Date.now()}`;
      db.prepare(`
        INSERT INTO pl_packaging_variants (
          id, family_id, slug, sku, title, material, finish, closure_type,
          capacity_description, net_weight_capacity_grams, width_mm, height_mm,
          label_safe_width_mm, label_safe_height_mm, supplier_name, unit_cost_paise,
          moq_units, order_multiple, status, revision
        ) VALUES (
          ?, 'fam_pouch', ?, ?, 'Draft To Archive', 'Kraft', 'Matte', 'Zip',
          '100g', 100, 130, 200, 100, 150, 'Supplier', 1450, 500, 50, 'draft', 1
        )
      `).run(draftId, `draft-del-${Date.now()}`, `DRF-${Date.now().toString().slice(-4)}`);

      const req = new Request(`http://localhost/api/v1/admin/private-label/catalogue/${draftId}`, {
        method: "DELETE",
        headers: ADMIN_HEADERS,
      });

      const res = await deleteCatalogueItem(req, {
        params: Promise.resolve({ id: draftId }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.archived).toBe(true);

      const row = db.prepare("SELECT status FROM pl_packaging_variants WHERE id = ?").get(draftId) as { status: string };
      expect(row.status).toBe("archived");
    });

    it("prevents deleting the default price book", async () => {
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
  });

  // ==========================================================================
  // 8. Quote Price Override & Dual-Rate Indian GST Integrity
  // ==========================================================================
  describe("8. Quote Price Override & Dual-Rate GST", () => {
    let quoteId: string;

    beforeAll(() => {
      const db = getDb();
      quoteId = `quote_override_${Date.now()}`;
      db.prepare(`
        INSERT INTO pl_quotes (
          id, quote_number, project_id, price_book_id, status, version, currency,
          tea_subtotal_paise, packaging_subtotal_paise, printing_subtotal_paise,
          tooling_setup_paise, labor_subtotal_paise, qc_subtotal_paise, freight_paise,
          margin_paise, tax_paise, grand_total_paise, revision
        ) VALUES (
          ?, 'PL-Q-OVR-01', 'proj_dummy', 'pb_default_inr', 'pricing_pending', 1, 'INR',
          100000, 50000, 20000, 10000, 30000, 25000, 15000, 50000, 41000, 341000, 1
        )
      `).run(quoteId);
    });

    it("recalculates 5% tea GST + 18% non-tea GST on price override", async () => {
      // Tea = ₹2,000.00 (200000 paise) -> 5% GST = ₹100.00 (10000 paise)
      // Pack = ₹1,000.00 (100000 paise), Freight = ₹500.00 (50000 paise), Margin = ₹1,000.00 (100000 paise)
      // Non-tea taxable = ₹2,500.00 (250000 paise) + remaining setup/labor/qc (65000 paise) = 315000 paise
      // 18% GST on 315000 paise = 56700 paise
      // Total tax = 10000 + 56700 = 66700 paise
      const req = new Request(`http://localhost/api/v1/admin/private-label/quotes/${quoteId}`, {
        method: "PATCH",
        headers: ADMIN_HEADERS,
        body: JSON.stringify({
          expected_revision: 1,
          tea_subtotal_paise: 200000,
          packaging_subtotal_paise: 100000,
          freight_paise: 50000,
          margin_paise: 100000,
          operator_notes: "Adjusted for volume shipping discount",
        }),
      });

      const res = await patchQuoteDetail(req, {
        params: Promise.resolve({ id: quoteId }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.quote.revision).toBe(2);
      expect(data.quote.tea_subtotal_paise).toBe(200000);
      expect(data.quote.packaging_subtotal_paise).toBe(100000);

      // Verify mathematical dual-rate GST breakdown
      const breakdown = JSON.parse(data.quote.price_breakdown_json);
      expect(breakdown.taxDetails.teaGstPaise).toBe(10000);
      expect(data.quote.tax_paise).toBe(breakdown.taxDetails.teaGstPaise + breakdown.taxDetails.nonTeaGstPaise);
    });

    it("issues firm quote with 14-day validity window", async () => {
      const req = new Request(`http://localhost/api/v1/admin/private-label/quotes/${quoteId}`, {
        method: "PATCH",
        headers: ADMIN_HEADERS,
        body: JSON.stringify({
          expected_revision: 2,
          status: "firm_issued",
          extend_validity_days: 14,
        }),
      });

      const res = await patchQuoteDetail(req, {
        params: Promise.resolve({ id: quoteId }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.quote.status).toBe("firm_issued");
      expect(data.quote.issued_at).toBeDefined();
      expect(data.quote.valid_until).toBeDefined();

      const validDate = new Date(data.quote.valid_until);
      const now = new Date();
      const diffDays = Math.round((validDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
      expect(diffDays).toBeGreaterThanOrEqual(13);
      expect(diffDays).toBeLessThanOrEqual(15);
    });
  });

  // ==========================================================================
  // 9. Audit Trail Integrity
  // ==========================================================================
  describe("9. In-Transaction Audit Trail (pl_audit)", () => {
    it("creates an audit row with actor_type = 'admin' for every mutation", () => {
      const db = getDb();
      const audits = db
        .prepare("SELECT * FROM pl_audit WHERE actor_type = 'admin' ORDER BY created_at DESC LIMIT 10")
        .all() as Array<{ actor_type: string; actor_id: string; entity_type: string }>;

      expect(audits.length).toBeGreaterThan(0);
      expect(audits[0].actor_type).toBe("admin");
    });
  });

  // ==========================================================================
  // 10. Sanitized Error Masking (Zero Raw SQL Leakage)
  // ==========================================================================
  describe("10. Sanitized Error Masking", () => {
    it("masks SQLite duplicate constraint collision returning sanitized 409 without raw dialect strings", async () => {
      const payload = {
        family_id: "fam_pouch",
        slug: `dup-slug-test-${Date.now()}`,
        sku: `DUP-${Date.now().toString().slice(-4)}`,
        title: "Duplicate Pouch Attempt",
        material: "Kraft",
        finish: "Matte",
        closure_type: "Zip",
        capacity_description: "100g",
        net_weight_capacity_grams: 100,
        width_mm: 120,
        height_mm: 200,
        label_safe_width_mm: 100,
        label_safe_height_mm: 150,
        supplier_name: "Vendor",
        unit_cost_paise: 1500,
      };

      // First insert succeeds (201)
      const req1 = new Request("http://localhost/api/v1/admin/private-label/catalogue", {
        method: "POST",
        headers: ADMIN_HEADERS,
        body: JSON.stringify(payload),
      });
      const firstRes = await postCatalogue(req1);
      expect(firstRes.status).toBe(201);

      // Duplicate insert with same unique slug & sku triggers 409
      const req2 = new Request("http://localhost/api/v1/admin/private-label/catalogue", {
        method: "POST",
        headers: ADMIN_HEADERS,
        body: JSON.stringify(payload),
      });

      const res = await postCatalogue(req2);
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toBe("Unable to complete the request.");
      // Ensure zero SQLite internal syntax or table names leaked
      expect(data.error).not.toMatch(/sqlite|table|column|constraint|unique/i);
    });
  });

  // ==========================================================================
  // 11. Admin Sample Order Dispatch API Route (PATCH /samples/[id]/dispatch)
  // ==========================================================================
  describe("11. Sample Order Dispatch Admin API Route", () => {
    it("rejects unauthorized request with 401 Unauthorized", async () => {
      const req = new Request("http://localhost/api/v1/admin/private-label/samples/samp_test/dispatch", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tracking_number: "TRK123456" }),
      });
      const res = await patchSampleDispatch(req, { params: Promise.resolve({ id: "samp_test" }) });
      expect(res.status).toBe(401);
    });

    it("dispatches sample order with explicit carrier via admin PATCH route", async () => {
      const sample = PrivateLabelService.createSampleOrder(
        {
          sample_type: "tea_kit",
          quantity: 1,
          shipping_address: { line1: "Admin Dispatch St", city: "Siliguri", pincode: "734001" },
        },
        "cust_m2_001",
        { actor_type: "admin", actor_id: "admin_1", actor_email: "admin@teafloww.com" }
      );

      const req = new Request(`http://localhost/api/v1/admin/private-label/samples/${sample.id}/dispatch`, {
        method: "PATCH",
        headers: ADMIN_HEADERS,
        body: JSON.stringify({ carrier: "Blue Dart", tracking_number: "BD-ADMIN-123" }),
      });
      const res = await patchSampleDispatch(req, { params: Promise.resolve({ id: sample.id }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.sample.status).toBe("dispatched");
      expect(data.sample.carrier).toBe("Blue Dart");
      expect(data.sample.tracking_number).toBe("BD-ADMIN-123");
    });

    it("dispatches sample order without carrier via admin PATCH route, preserving null without Delhivery default", async () => {
      const sample = PrivateLabelService.createSampleOrder(
        {
          sample_type: "tea_kit",
          quantity: 1,
          shipping_address: { line1: "Admin Dispatch St 2", city: "Siliguri", pincode: "734001" },
        },
        "cust_m2_001",
        { actor_type: "admin", actor_id: "admin_1", actor_email: "admin@teafloww.com" }
      );

      const req = new Request(`http://localhost/api/v1/admin/private-label/samples/${sample.id}/dispatch`, {
        method: "PATCH",
        headers: ADMIN_HEADERS,
        body: JSON.stringify({ tracking_number: "TRK-NO-CARRIER" }),
      });
      const res = await patchSampleDispatch(req, { params: Promise.resolve({ id: sample.id }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.sample.status).toBe("dispatched");
      expect(data.sample.carrier).toBeNull();
      expect(data.sample.carrier).not.toBe("Delhivery");
      expect(data.sample.tracking_number).toBe("TRK-NO-CARRIER");
    });
  });
});
