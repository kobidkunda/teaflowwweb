import { prepareProofForApproval } from "./private-label-proof-fixture";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { rmSync } from "node:fs";
import { validatePreflight, sanitizeSvg } from "@/lib/private-label/preflight";
import { PrivateLabelService } from "@/lib/private-label/service";
import {
  PrivateLabelNotFoundError,
  PrivateLabelRevisionConflictError,
  PrivateLabelGateError,
  type AuditActor,
} from "@/lib/private-label/types";
import {
  resolvePackagingSilhouette,
} from "@/components/private-label/StudioCanvas2D";
import { calculateSafeZone } from "@/lib/private-label/compatibility";

const ACTOR_CUSTOMER_A: AuditActor = {
  actor_type: "customer",
  actor_id: "cust-m5-001",
  actor_email: "alice@m5tea.com",
};

const ACTOR_CUSTOMER_B: AuditActor = {
  actor_type: "customer",
  actor_id: "cust-m5-002",
  actor_email: "bob@m5tea.com",
};

describe("Milestone M5: 2D Design Studio, Preflight Engine & Proof Approval Suite", () => {
  let testDbPath: string;
  let db: Database.Database;

  beforeAll(() => {
    testDbPath = path.join(tmpdir(), `pl-m5-test-${process.pid}-${Date.now()}.sqlite`);
    process.env.DATABASE_PATH = testDbPath;

    // Execute migrations runner including 048
    execFileSync(process.execPath, ["scripts/migrate.mjs"], {
      env: { ...process.env, DATABASE_PATH: testDbPath },
    });

    db = new Database(testDbPath);
    db.pragma("foreign_keys = ON");
  });

  afterAll(() => {
    try {
      db?.close();
      rmSync(testDbPath, { force: true });
      rmSync(testDbPath + "-wal", { force: true });
      rmSync(testDbPath + "-shm", { force: true });
    } catch {}
  });

  // ==========================================================================
  // 1. Migration 048 Schema & Index Integrity
  // ==========================================================================
  describe("1. Migration 048 Schema Verification", () => {
    it("applies migration 048_private_label_proof_enhancements to schema_migrations", () => {
      const row = db
        .prepare("SELECT version FROM schema_migrations WHERE version LIKE '048_%'")
        .get() as { version: string } | undefined;
      expect(row).toBeDefined();
      expect(row?.version).toBe("048_private_label_proof_enhancements");
    });

    it("verifies pl_design_versions has all M5 additive columns and indexes", () => {
      const cols = db
        .prepare("PRAGMA table_info(pl_design_versions)")
        .all()
        .map((c: any) => c.name);

      expect(cols).toContain("project_id");
      expect(cols).toContain("status");
      expect(cols).toContain("asset_url");
      expect(cols).toContain("preflight_report_json");
      expect(cols).toContain("revision");

      const indexes = db
        .prepare("PRAGMA index_list(pl_design_versions)")
        .all()
        .map((i: any) => i.name);
      expect(indexes).toContain("idx_pl_des_project");
      expect(indexes).toContain("idx_pl_des_status");
    });

    it("verifies pl_approval_events has signer_name and disclaimer_text columns", () => {
      const cols = db
        .prepare("PRAGMA table_info(pl_approval_events)")
        .all()
        .map((c: any) => c.name);

      expect(cols).toContain("signer_name");
      expect(cols).toContain("disclaimer_text");

      const indexes = db
        .prepare("PRAGMA index_list(pl_approval_events)")
        .all()
        .map((i: any) => i.name);
      expect(indexes.some((n: string) => n.includes("design_ver") || n.includes("version"))).toBe(
        true
      );
    });

    it("enforces check constraint on pl_design_versions status enum", () => {
      // Valid statuses: preflight_pending, preflight_passed, preflight_failed, customer_approved, production_locked
      db.prepare(`
        INSERT OR IGNORE INTO pl_clients (id, company_name, contact_name, contact_email)
        VALUES ('client_chk_test', 'Check Corp', 'Charlie', 'charlie@test.com')
      `).run();

      const proj = db
        .prepare("INSERT INTO pl_projects (id, client_id, title) VALUES ('proj_chk_test', 'client_chk_test', 'Chk')")
        .run();
      expect(proj.changes).toBe(1);

      const item = db
        .prepare("INSERT INTO pl_project_items (id, project_id, fill_weight_grams, quantity_units) VALUES ('item_chk_test', 'proj_chk_test', 100, 1000)")
        .run();
      expect(item.changes).toBe(1);

      // Inserting invalid status enum must throw SQLite CHECK constraint error
      expect(() => {
        db.prepare(
          "INSERT INTO pl_design_versions (id, project_item_id, status) VALUES ('des_invalid_status', 'item_chk_test', 'invalid_status_enum')"
        ).run();
      }).toThrow();
    });
  });

  // ==========================================================================
  // 2. Preflight Validation Engine
  // ==========================================================================
  describe("2. Preflight Validation Engine", () => {
    it("accepts valid raster image formats (PNG, JPEG, WebP) with >= 300 DPI", async () => {
      const result = await validatePreflight({
        mimeType: "image/png",
        widthPx: 3000,
        heightPx: 4000,
        fileSizeBytes: 4_500_000,
        targetWidthMm: 160,
        targetHeightMm: 230,
      });

      expect(result.valid).toBe(true);
      expect(result.status).toBe("passed");
      expect(result.dpi).toBeGreaterThanOrEqual(300);
      expect(result.is_vector).toBe(false);
      expect(result.errors).toHaveLength(0);
      expect(result.dimensions_mm.width).toBeGreaterThan(0);
      expect(result.dimensions_mm.height).toBeGreaterThan(0);
    });

    it("accepts vector formats (SVG and PDF) with lossless vector status", async () => {
      const result = await validatePreflight({
        mimeType: "image/svg+xml",
        svgContent: '<svg viewBox="0 0 500 500"><circle cx="250" cy="250" r="200" fill="green"/></svg>',
        fileSizeBytes: 120_000,
      });

      expect(result.valid).toBe(true);
      expect(result.status).toBe("passed");
      expect(result.is_vector).toBe(true);
      expect(result.dpi).toBe(300);
      expect(result.prohibited_scripts_detected).toBe(false);
    });

    it("emits warning for sub-300 DPI assets between 150 and 299 DPI", async () => {
      // 160mm = 6.299 inches. 1200 px / 6.299 in = 190 DPI (in warning zone)
      const result = await validatePreflight({
        mimeType: "image/jpeg",
        widthPx: 1200,
        heightPx: 1600,
        fileSizeBytes: 350_000,
        targetWidthMm: 160,
        targetHeightMm: 230,
      });

      expect(result.valid).toBe(true);
      expect(result.status).toBe("warning");
      expect(result.dpi).toBeGreaterThanOrEqual(150);
      expect(result.dpi).toBeLessThan(300);
      expect(result.warnings.some((w) => w.includes("DPI"))).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("hard rejects critically low resolution assets (< 150 DPI)", async () => {
      // 160mm = 6.299 inches. 400 px / 6.299 in = 63 DPI (< 150 DPI hard reject)
      const result = await validatePreflight({
        mimeType: "image/jpeg",
        widthPx: 400,
        heightPx: 600,
        fileSizeBytes: 50_000,
        targetWidthMm: 160,
        targetHeightMm: 230,
      });

      expect(result.valid).toBe(false);
      expect(result.status).toBe("rejected");
      expect(result.dpi).toBeLessThan(150);
      expect(result.errors.some((e) => e.includes("below the 150 DPI minimum"))).toBe(true);
    });

    it("strictly accepts 25MB boundary and rejects files > 25MB", async () => {
      const exact25MB = 25 * 1024 * 1024; // 26,214,400 bytes
      const passResult = await validatePreflight({
        mimeType: "image/png",
        widthPx: 4000,
        heightPx: 4000,
        fileSizeBytes: exact25MB,
      });
      expect(passResult.valid).toBe(true);

      const over25MB = exact25MB + 1;
      const failResult = await validatePreflight({
        mimeType: "image/png",
        widthPx: 4000,
        heightPx: 4000,
        fileSizeBytes: over25MB,
      });
      expect(failResult.valid).toBe(false);
      expect(failResult.errors.some((e) => e.includes("exceeds 25MB"))).toBe(true);
    });

    it("rejects 0-byte or negative size files", async () => {
      const zeroResult = await validatePreflight({
        mimeType: "image/png",
        fileSizeBytes: 0,
      });
      expect(zeroResult.valid).toBe(false);
      expect(zeroResult.errors.some((e) => e.includes("greater than 0"))).toBe(true);
    });

    it("rejects unauthorized and spoofed MIME types (e.g. application/x-executable)", async () => {
      const result = await validatePreflight({
        mimeType: "application/x-executable",
        filename: "malicious.png.exe",
        fileSizeBytes: 1024,
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("not supported") || e.includes("executable"))).toBe(
        true
      );
    });

    it("sanitizes SVG vector assets: detects and rejects embedded <script> tags", () => {
      const maliciousSvg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert("XSS")</script><rect width="100" height="100"/></svg>';
      const check = sanitizeSvg(maliciousSvg);
      expect(check.safe).toBe(false);
      expect(check.violations.some((v) => v.includes("<script>"))).toBe(true);
    });

    it("sanitizes SVG vector assets: detects and rejects inline event handlers (onload, onerror)", () => {
      const maliciousSvg = '<svg xmlns="http://www.w3.org/2000/svg" onload="fetch(\'/steal\')"><circle r="50"/></svg>';
      const check = sanitizeSvg(maliciousSvg);
      expect(check.safe).toBe(false);
      expect(check.violations.some((v) => v.includes("Inline JavaScript"))).toBe(true);
    });

    it("sanitizes SVG vector assets: detects and rejects XML External Entity (XXE) attacks", () => {
      const maliciousSvg = '<!DOCTYPE svg [ <!ENTITY xxe SYSTEM "file:///etc/passwd"> ]><svg>&xxe;</svg>';
      const check = sanitizeSvg(maliciousSvg);
      expect(check.safe).toBe(false);
      expect(check.violations.some((v) => v.includes("XXE"))).toBe(true);
    });

    it("detects and rejects password-protected / encrypted PDF files", async () => {
      const result = await validatePreflight({
        mimeType: "application/pdf",
        isEncrypted: true,
        fileSizeBytes: 500_000,
      });
      expect(result.valid).toBe(false);
      expect(result.status).toBe("rejected");
      expect(result.errors.some((e) => e.includes("Password-protected"))).toBe(true);
    });

    it("safely handles extreme resolution assets (10,000 x 10,000 px) without memory overflow", async () => {
      const result = await validatePreflight({
        mimeType: "image/png",
        widthPx: 10000,
        heightPx: 10000,
        fileSizeBytes: 18_000_000,
        targetWidthMm: 160,
        targetHeightMm: 230,
      });
      expect(result.valid).toBe(true);
      expect(result.dpi).toBeGreaterThan(1000);
      expect(result.dimensions_mm.width).toBeGreaterThan(800);
    });

    it("evaluates required 3mm bleed margin reporting accurate bleed status", async () => {
      // 160mm wide by 230mm tall. Required with 3mm bleed is 166mm x 236mm.
      // At 300 DPI: min width = (166 / 25.4) * 300 = 1961 px.
      // If asset is only 1500 px wide, has_bleed will be false and emit a warning.
      const result = await validatePreflight({
        mimeType: "image/png",
        widthPx: 1500,
        heightPx: 2000,
        fileSizeBytes: 2_000_000,
        targetWidthMm: 160,
        targetHeightMm: 230,
      });
      expect(result.has_bleed).toBe(false);
      expect(result.warnings.some((w) => w.includes("bleed margin"))).toBe(true);
    });
  });

  // ==========================================================================
  // 3. Backend Services & Versioned Proof Management
  // ==========================================================================
  describe("Production proof readiness boundaries", () => {
    it("rejects pending or failed preflight even when legal rights are accepted", () => {
      const project = PrivateLabelService.createProjectDraft({ title: "Preflight readiness guard" }, "cust-m5-001", ACTOR_CUSTOMER_A);
      const pending = PrivateLabelService.createDesignVersion(project.id, { scene_json: {} }, ACTOR_CUSTOMER_A, "cust-m5-001");
      expect(() => PrivateLabelService.approveProof(pending.id, { disclaimer_accepted: true }, ACTOR_CUSTOMER_A, "cust-m5-001")).toThrow(/preflight review/);
      const failed = PrivateLabelService.createDesignVersion(project.id, { scene_json: {}, preflight_report: { valid: false } }, ACTOR_CUSTOMER_A, "cust-m5-001");
      expect(() => PrivateLabelService.approveProof(failed.id, { disclaimer_accepted: true }, ACTOR_CUSTOMER_A, "cust-m5-001")).toThrow(/preflight review/);
    });

    it("does not allow a project revision to substitute for the displayed proof revision", () => {
      const project = PrivateLabelService.createProjectDraft({ title: "Exact proof revision guard" }, "cust-m5-001", ACTOR_CUSTOMER_A);
      const proof = PrivateLabelService.createDesignVersion(project.id, { scene_json: {}, preflight_report: { valid: true } }, ACTOR_CUSTOMER_A, "cust-m5-001");
      db.prepare("UPDATE pl_design_versions SET revision = 3 WHERE id = ?").run(proof.id);
      expect(() => PrivateLabelService.approveProof(proof.id, { disclaimer_accepted: true, expected_revision: 2 }, ACTOR_CUSTOMER_A, "cust-m5-001")).toThrow(PrivateLabelRevisionConflictError);
      expect(() => PrivateLabelService.approveProof(proof.id, { disclaimer_accepted: true, expected_revision: 3 }, ACTOR_CUSTOMER_A, "cust-m5-001")).not.toThrow();
    });

    it("does not trust a customer-supplied preflight success report", async () => {
      const project = PrivateLabelService.createProjectDraft({ title: "Customer preflight spoof" }, "cust-m5-001", ACTOR_CUSTOMER_A);
      const { POST } = await import("@/app/api/v1/private-label/projects/[id]/design-versions/route");
      const response = await POST(new Request("http://localhost/api/v1/private-label/projects/test/design-versions", { method: "POST", headers: { "Content-Type": "application/json", "x-customer-id": "cust-m5-001" }, body: JSON.stringify({ scene_json: {}, preflight_report: { status: "passed", valid: true } }) }), { params: Promise.resolve({ id: project.id }) });
      expect(response.status).toBe(201);
      expect((await response.json()).status).toBe("preflight_pending");
    });
  });

  describe("3. Versioned Proof Management & Auto-Increment", () => {
    it("creates design version with auto-incrementing version_number for project", () => {
      const project = PrivateLabelService.createProjectDraft(
        { title: "Versioned Proof Project", target_market: "IN" },
        "cust-m5-001",
        ACTOR_CUSTOMER_A
      );

      // Create Version 1
      const v1 = PrivateLabelService.createDesignVersion(
        project.id,
        {
          scene_json: { label: "Design v1", background: "#FFFFFF" },
          asset_url: "https://cdn.example.com/art_v1.png",
          preflight_report: { status: "passed", valid: true, dpi: 300 },
        },
        ACTOR_CUSTOMER_A,
        "cust-m5-001"
      );
      expect(v1.version_number).toBe(1);
      expect(v1.status).toBe("preflight_passed");
      expect(v1.is_locked).toBe(0);

      // Create Version 2
      const v2 = PrivateLabelService.createDesignVersion(
        project.id,
        {
          scene_json: { label: "Design v2", background: "#000000" },
          asset_url: "https://cdn.example.com/art_v2.png",
        },
        ACTOR_CUSTOMER_A,
        "cust-m5-001"
      );
      expect(v2.version_number).toBe(2);
      expect(v2.status).toBe("preflight_pending");

      // Verify list returns ordered versions
      const list = PrivateLabelService.listDesignVersions(project.id, "cust-m5-001", ACTOR_CUSTOMER_A);
      expect(list).toHaveLength(2);
      expect(list[0].version_number).toBe(1);
      expect(list[1].version_number).toBe(2);

      // Verify latest returns v2
      const latest = PrivateLabelService.getLatestDesignVersion(
        project.id,
        "cust-m5-001",
        ACTOR_CUSTOMER_A
      );
      expect(latest?.version_number).toBe(2);
    });

    it("atomically increments project revision upon creating a new design version", () => {
      const project = PrivateLabelService.createProjectDraft(
        { title: "Revision Invalidation Project", target_market: "IN" },
        "cust-m5-001",
        ACTOR_CUSTOMER_A
      );
      const initialRev = project.revision;

      PrivateLabelService.createDesignVersion(
        project.id,
        { scene_json: { brand: "Test" } },
        ACTOR_CUSTOMER_A,
        "cust-m5-001"
      );

      const refreshed = PrivateLabelService.getProject(project.id, "cust-m5-001");
      expect(refreshed.revision).toBe(initialRev + 1);
    });

    it("enforces CAS expected_revision concurrency check when creating design version", () => {
      const project = PrivateLabelService.createProjectDraft(
        { title: "CAS Design Version Project", target_market: "IN" },
        "cust-m5-001",
        ACTOR_CUSTOMER_A
      );

      // Calling with stale expected_revision must throw PrivateLabelRevisionConflictError (409)
      expect(() => {
        PrivateLabelService.createDesignVersion(
          project.id,
          { scene_json: {}, expected_revision: 999 }, // Stale revision!
          ACTOR_CUSTOMER_A,
          "cust-m5-001"
        );
      }).toThrow(PrivateLabelRevisionConflictError);
    });

    it("strictly isolates tenants: Customer B cannot create or view Customer A's design versions (404)", () => {
      const projectA = PrivateLabelService.createProjectDraft(
        { title: "Tenant A Project", target_market: "IN" },
        "cust-m5-001",
        ACTOR_CUSTOMER_A
      );

      // Customer B attempting to create design version on Project A throws 404 Not Found
      expect(() => {
        PrivateLabelService.createDesignVersion(
          projectA.id,
          { scene_json: {} },
          ACTOR_CUSTOMER_B,
          "cust-m5-002"
        );
      }).toThrow(PrivateLabelNotFoundError);

      // Customer B attempting to list design versions for Project A throws 404 Not Found
      expect(() => {
        PrivateLabelService.listDesignVersions(projectA.id, "cust-m5-002", ACTOR_CUSTOMER_B);
      }).toThrow(PrivateLabelNotFoundError);
    });
  });

  // ==========================================================================
  // 4. Proof Approval & CAS Concurrency State Machine
  // ==========================================================================
  describe("4. Proof Approval & Legal Sign-off State Machine", () => {
    it("requires explicit legal disclaimer acceptance, throwing 422 if false", () => {
      const project = PrivateLabelService.createProjectDraft(
        { title: "Disclaimer Test Project", target_market: "IN" },
        "cust-m5-001",
        ACTOR_CUSTOMER_A
      );

      const v1 = PrivateLabelService.createDesignVersion(
        project.id,
        { scene_json: { test: true } },
        ACTOR_CUSTOMER_A,
        "cust-m5-001"
      );

      expect(() => {
        PrivateLabelService.approveProof(prepareProofForApproval(v1.id),
          {
            disclaimer_accepted: false,
            legal_disclaimer_accepted: false,
            actor_name: "Alice",
          },
          ACTOR_CUSTOMER_A,
          "cust-m5-001"
        );
      }).toThrow(PrivateLabelGateError);
    });

    it("successfully approves proof: sets status to customer_approved, locks proof, and records audit trail", () => {
      const project = PrivateLabelService.createProjectDraft(
        { title: "Proof Sign-off Test", target_market: "IN" },
        "cust-m5-001",
        ACTOR_CUSTOMER_A
      );

      const v1 = PrivateLabelService.createDesignVersion(
        project.id,
        { scene_json: { test: true }, asset_url: "https://cdn.example.com/logo.png" },
        ACTOR_CUSTOMER_A,
        "cust-m5-001"
      );

      const approval = PrivateLabelService.approveProof(prepareProofForApproval(v1.id),
        {
          disclaimer_accepted: true,
          signer_name: "Alice M5",
          notes: "Approved for rotogravure cylinders",
        },
        ACTOR_CUSTOMER_A,
        "cust-m5-001"
      );

      expect(approval).toBeDefined();
      expect(approval.action).toBe("customer_approved");
      expect(approval.legal_disclaimer_accepted).toBe(1);
      expect(approval.signer_name).toBe("Alice M5");
      expect(approval.disclaimer_text).toContain("commercial intellectual property rights");

      // Verify design version is locked and status updated
      const locked = db
        .prepare("SELECT is_locked, status FROM pl_design_versions WHERE id = ?")
        .get(v1.id) as { is_locked: number; status: string };
      expect(locked.is_locked).toBe(1);
      expect(locked.status).toBe("customer_approved");

      // Verify immutable row in pl_approval_events
      const eventRow = db
        .prepare("SELECT * FROM pl_approval_events WHERE id = ?")
        .get(approval.id) as any;
      expect(eventRow.action).toBe("customer_approved");
      expect(eventRow.notes).toBe("Approved for rotogravure cylinders");
    });

    it("rejects approval of a stale revision (submitting rev 1 when rev 2 exists) with 409 Conflict", () => {
      const project = PrivateLabelService.createProjectDraft(
        { title: "Stale Revision Approval Test", target_market: "IN" },
        "cust-m5-001",
        ACTOR_CUSTOMER_A
      );

      // Create Version 1
      const v1 = PrivateLabelService.createDesignVersion(
        project.id,
        { scene_json: { rev: 1 } },
        ACTOR_CUSTOMER_A,
        "cust-m5-001"
      );

      // Create Version 2 (supersedes Version 1)
      PrivateLabelService.createDesignVersion(
        project.id,
        { scene_json: { rev: 2 } },
        ACTOR_CUSTOMER_A,
        "cust-m5-001"
      );

      // Attempting to approve superseded Version 1 MUST fail with 409 Conflict
      expect(() => {
        PrivateLabelService.approveProof(prepareProofForApproval(v1.id),
          { disclaimer_accepted: true, revision: 1 },
          ACTOR_CUSTOMER_A,
          "cust-m5-001"
        );
      }).toThrow(PrivateLabelRevisionConflictError);
    });

    it("rejects duplicate approval of an already locked proof with 409 Conflict", () => {
      const project = PrivateLabelService.createProjectDraft(
        { title: "Duplicate Approval Test", target_market: "IN" },
        "cust-m5-001",
        ACTOR_CUSTOMER_A
      );

      const v1 = PrivateLabelService.createDesignVersion(
        project.id,
        { scene_json: { test: true } },
        ACTOR_CUSTOMER_A,
        "cust-m5-001"
      );

      // First approval succeeds
      PrivateLabelService.approveProof(prepareProofForApproval(v1.id),
        { disclaimer_accepted: true },
        ACTOR_CUSTOMER_A,
        "cust-m5-001"
      );

      // Second approval on same version MUST fail with 409 Conflict
      expect(() => {
        PrivateLabelService.approveProof(prepareProofForApproval(v1.id),
          { disclaimer_accepted: true },
          ACTOR_CUSTOMER_A,
          "cust-m5-001"
        );
      }).toThrow(PrivateLabelRevisionConflictError);
    });

    it("handles proof rejection with customer notes, setting status to preflight_failed", () => {
      const project = PrivateLabelService.createProjectDraft(
        { title: "Proof Rejection Test", target_market: "IN" },
        "cust-m5-001",
        ACTOR_CUSTOMER_A
      );

      const v1 = PrivateLabelService.createDesignVersion(
        project.id,
        { scene_json: { test: true } },
        ACTOR_CUSTOMER_A,
        "cust-m5-001"
      );

      const rejection = PrivateLabelService.rejectProof(
        v1.id,
        {
          reason: "Color temperature is too warm; adjust Pantone bronze",
          revision: 1,
        },
        ACTOR_CUSTOMER_A,
        "cust-m5-001"
      );

      expect(rejection).toBeDefined();
      expect(rejection.action).toBe("customer_rejected");
      expect(rejection.notes).toBe("Color temperature is too warm; adjust Pantone bronze");

      // Verify status is preflight_failed and is_locked is 0
      const row = db
        .prepare("SELECT status, is_locked FROM pl_design_versions WHERE id = ?")
        .get(v1.id) as { status: string; is_locked: number };
      expect(row.status).toBe("preflight_failed");
      expect(row.is_locked).toBe(0);
    });
  });

  // ==========================================================================
  // 5. 2D Visual Canvas Geometry & Mathematical Safe-Zone Breach
  // ==========================================================================
  describe("5. 2D Visual Canvas Silhouettes & Breach Math", () => {
    it("accurately classifies all 5 packaging structural silhouettes", () => {
      expect(resolvePackagingSilhouette({ slug: "stand-up-pouch-100g", category: "pouch" })).toBe(
        "stand_up_pouch"
      );
      expect(resolvePackagingSilhouette({ slug: "quad-seal-side-gusset", title: "Side Gusset Pouch" })).toBe(
        "side_gusset_pouch"
      );
      expect(resolvePackagingSilhouette({ slug: "box-pouch-flat-bottom", category: "pouch" })).toBe(
        "flat_bottom_pouch"
      );
      expect(resolvePackagingSilhouette({ slug: "metal-tin-caddy-100g", category: "tin" })).toBe(
        "tin_canister"
      );
      expect(resolvePackagingSilhouette({ slug: "kraft-carton-folding-box", category: "box" })).toBe(
        "kraft_box"
      );
    });

    it("calculates accurate mechanical safe-zone margins and bleed per packaging family", () => {
      // Pouch: top 35mm, bottom 15mm, sides 10mm, bleed 3mm
      const pouchSafe = calculateSafeZone("pouch", 160, 230);
      expect(pouchSafe.marginsMm.top).toBe(35);
      expect(pouchSafe.marginsMm.bottom).toBe(15);
      expect(pouchSafe.marginsMm.left).toBe(10);
      expect(pouchSafe.marginsMm.right).toBe(10);
      expect(pouchSafe.bleedMm).toBe(3);
      expect(pouchSafe.labelSafeWidthMm).toBe(140);
      expect(pouchSafe.labelSafeHeightMm).toBe(180);

      // Tin: top 10mm, bottom 10mm, sides 5mm, bleed 2mm
      const tinSafe = calculateSafeZone("tin", 85, 120);
      expect(tinSafe.marginsMm.top).toBe(10);
      expect(tinSafe.marginsMm.bottom).toBe(10);
      expect(tinSafe.marginsMm.left).toBe(5);
      expect(tinSafe.marginsMm.right).toBe(5);
      expect(tinSafe.bleedMm).toBe(2);

      // Jar: top 12mm, bottom 8mm, sides 4mm, bleed 2mm
      const jarSafe = calculateSafeZone("jar", 70, 90);
      expect(jarSafe.marginsMm.top).toBe(12);
      expect(jarSafe.marginsMm.bottom).toBe(8);
      expect(tinSafe.bleedMm).toBe(2);
    });

    it("mathematically detects safe-zone boundary breach when artwork extends past margins", () => {
      const widthMm = 160;
      const heightMm = 230;
      const safe = calculateSafeZone("pouch", widthMm, heightMm);
      const safeLeft = safe.marginsMm.left; // 10
      const safeRight = widthMm - safe.marginsMm.right; // 150
      const safeTop = safe.marginsMm.top; // 35
      const safeBottom = heightMm - safe.marginsMm.bottom; // 215

      const baseW = widthMm * 0.45; // 72mm
      const baseH = baseW * 0.75; // 54mm

      // Test 1: Centered placement (x=0, y=0, scale=1.0)
      // Center = (80, 115). Bounds: [44 to 116, 88 to 142] -> strictly inside [10..150, 35..215]
      const centeredCenterX = 80;
      const centeredCenterY = 115;
      const isCenteredBreached =
        centeredCenterX - baseW / 2 < safeLeft ||
        centeredCenterX + baseW / 2 > safeRight ||
        centeredCenterY - baseH / 2 < safeTop ||
        centeredCenterY + baseH / 2 > safeBottom;
      expect(isCenteredBreached).toBe(false);

      // Test 2: Nudge upward into top zipper seal reserve (yMm = -90mm)
      // CenterY = 115 - 90 = 25. artTop = 25 - 27 = -2 < safeTop (35) -> BREACH!
      const nudgedY = -90;
      const nudgedCenterY = 115 + nudgedY;
      const isTopBreached = nudgedCenterY - baseH / 2 < safeTop;
      expect(isTopBreached).toBe(true);

      // Test 3: Excessive zoom scale (scale = 2.5)
      // artW = 72 * 2.5 = 180mm. 180mm > 160mm total width! -> BREACH!
      const zoomedW = baseW * 2.5;
      const isZoomBreached = 80 - zoomedW / 2 < safeLeft || 80 + zoomedW / 2 > safeRight;
      expect(isZoomBreached).toBe(true);
    });
  });
});
