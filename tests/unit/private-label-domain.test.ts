import { prepareProofForApproval } from "./private-label-proof-fixture";
/**
 * TeaFloww Private Label Studio — Milestone M1 Domain Unit Test Suite
 * File: tests/unit/private-label-domain.test.ts
 *
 * Comprehensive domain verification testing:
 * 1. Compare-And-Swap (CAS) optimistic locking & revision conflict detection (409 / -32009)
 * 2. In-transaction atomic append-only audit logging (pl_audit)
 * 3. Tenant isolation & 404 anti-enumeration security posture
 * 4. Whitelisted public DTO projections (COGS & supplier data sanitization)
 * 5. Production release hard gate & publishing gate validation
 * 6. Multi-dimensional MOQ validation (tea batch kg conversions, pack MOQ, print MOQ, order multiple rounding, blocker reasons)
 * 7. Packaging x print method compatibility matrix validation and rejection
 * 8. 12-component tiered price calculations with dual-rate GST and fallback to manual_quote_required
 * 9. Strict Zod input validation schemas
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { rmSync } from "node:fs";

const TEST_DB = path.join(tmpdir(), `pl-domain-test-${process.pid}-${Date.now()}.sqlite`);
process.env.DATABASE_PATH = TEST_DB;

import { getDb } from "@/lib/db";
import { PrivateLabelService } from "@/lib/private-label/service";
import {
  PrivateLabelRevisionConflictError,
  PrivateLabelNotFoundError,
  PrivateLabelGateError,
  type AuditActor,
} from "@/lib/private-label/types";
import {
  toPublicPackagingVariantDto,
  toPublicPackagingDto,
  toPublicTeaOptionDto,
  toPublicQuoteDto,
  toPublicProjectDto,
} from "@/lib/private-label/public-dto";
import { evaluateMoq, calculateMOQ } from "@/lib/private-label/moq";
import {
  validatePackagingPrintCompatibility,
  validateCompatibility,
  calculateSafeZone,
} from "@/lib/private-label/compatibility";
import { calculateItemizedQuote, calculateQuote } from "@/lib/private-label/pricing";
import {
  moqInputSchema,
  proofApprovalSchema,
  priceBookTierAdminSchema,
  artworkUploadIntentSchema,
} from "@/lib/private-label/schemas";

const ACTOR_CUSTOMER_A: AuditActor = {
  actor_type: "customer",
  actor_id: "cust-uuid-001",
  actor_email: "client_a@example.com",
};

const ACTOR_CUSTOMER_B: AuditActor = {
  actor_type: "customer",
  actor_id: "cust-uuid-002",
  actor_email: "client_b@example.com",
};

const ACTOR_ADMIN: AuditActor = {
  actor_type: "admin",
  actor_id: "admin-uuid-001",
  actor_email: "admin@teafloww.com",
};

describe("PrivateLabelService Domain Suite", () => {
  beforeAll(() => {
    // Run migrations on isolated test DB
    execFileSync(process.execPath, ["scripts/migrate.mjs"], {
      env: { ...process.env, DATABASE_PATH: TEST_DB },
    });

    const db = getDb();
    // Seed initial catalog data
    PrivateLabelService.seedInitialCatalog();

    // Insert test customer accounts
    db.prepare(`
      INSERT OR IGNORE INTO customers (id, email, name)
      VALUES ('cust-uuid-001', 'client_a@example.com', 'Client A'),
             ('cust-uuid-002', 'client_b@example.com', 'Client B')
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

  // --------------------------------------------------------------------------
  // Suite 1: Compare-And-Swap (CAS) Concurrency & Revision Locking
  // --------------------------------------------------------------------------
  describe("1. CAS Revision Concurrency Control", () => {
    it("successfully increments revision from 1 to 2 on expected_revision match", () => {
      const project = PrivateLabelService.createProjectDraft(
        { title: "Project Alpha", target_market: "IN" },
        "cust-uuid-001",
        ACTOR_CUSTOMER_A
      );
      expect(project.revision).toBe(1);

      const updated = PrivateLabelService.updateProjectDraft(
        project.id,
        1,
        { title: "Project Alpha Renamed" },
        ACTOR_CUSTOMER_A,
        "cust-uuid-001"
      );
      expect(updated.revision).toBe(2);
      expect(updated.title).toBe("Project Alpha Renamed");
    });

    it("throws PrivateLabelRevisionConflictError with 409 and -32009 on stale expected_revision", () => {
      const project = PrivateLabelService.createProjectDraft(
        { title: "Project Beta", target_market: "IN" },
        "cust-uuid-001",
        ACTOR_CUSTOMER_A
      );

      // Mutate once to move revision to 2
      PrivateLabelService.updateProjectDraft(
        project.id,
        1,
        { title: "Project Beta V2" },
        ACTOR_CUSTOMER_A,
        "cust-uuid-001"
      );

      // Stale attempt with expected_revision: 1
      expect(() => {
        PrivateLabelService.updateProjectDraft(
          project.id,
          1,
          { title: "Stale Overwrite Attempt" },
          ACTOR_CUSTOMER_A,
          "cust-uuid-001"
        );
      }).toThrow(PrivateLabelRevisionConflictError);

      try {
        PrivateLabelService.updateProjectDraft(
          project.id,
          1,
          { title: "Stale Overwrite Attempt" },
          ACTOR_CUSTOMER_A,
          "cust-uuid-001"
        );
      } catch (err) {
        const error = err as PrivateLabelRevisionConflictError;
        expect(error.code).toBe("REVISION_CONFLICT");
        expect(error.status).toBe(409);
        expect(error.mcpCode).toBe(-32009);
        expect(error.current_revision).toBe(2);
        expect(error.expected_revision).toBe(1);
      }
    });

    it("throws PrivateLabelNotFoundError on non-existent project update", () => {
      expect(() => {
        PrivateLabelService.updateProjectDraft(
          "non-existent-id",
          1,
          { title: "Ghost" },
          ACTOR_CUSTOMER_A,
          "cust-uuid-001"
        );
      }).toThrow(PrivateLabelNotFoundError);

      try {
        PrivateLabelService.updateProjectDraft(
          "non-existent-id",
          1,
          { title: "Ghost" },
          ACTOR_CUSTOMER_A,
          "cust-uuid-001"
        );
      } catch (err) {
        const error = err as PrivateLabelNotFoundError;
        expect(error.code).toBe("NOT_FOUND");
        expect(error.status).toBe(404);
        expect(error.mcpCode).toBe(-32004);
      }
    });
  });

  // --------------------------------------------------------------------------
  // Suite 2: In-Transaction Audit Logging (pl_audit)
  // --------------------------------------------------------------------------
  describe("2. In-Transaction Audit Trail Logging", () => {
    it("creates an audit row in pl_audit atomically alongside the mutation", () => {
      const project = PrivateLabelService.createProjectDraft(
        { title: "Audit Target Project", target_market: "IN" },
        "cust-uuid-001",
        ACTOR_CUSTOMER_A
      );

      PrivateLabelService.updateProjectDraft(
        project.id,
        1,
        { title: "Audit Updated Title" },
        ACTOR_CUSTOMER_A,
        "cust-uuid-001"
      );

      const auditEntries = PrivateLabelService.getAuditHistory("project", project.id);
      expect(auditEntries.length).toBe(2); // create + update

      const updateAudit = auditEntries[0]; // descending order
      expect(updateAudit.action).toBe("update_draft");
      expect(updateAudit.revision).toBe(2);
      expect(updateAudit.actor_type).toBe("customer");
      expect(updateAudit.actor_id).toBe("cust-uuid-001");
      expect(JSON.parse(updateAudit.diff_json).title).toBe("Audit Updated Title");
    });

    it("rolls back audit rows completely if the mutation transaction aborts", () => {
      const db = getDb();
      const initialCount = (
        db.prepare("SELECT count(*) as count FROM pl_audit").get() as { count: number }
      ).count;

      expect(() => {
        db.transaction(() => {
          PrivateLabelService.createProjectDraft(
            { title: "Doomed Project", target_market: "IN" },
            "cust-uuid-001",
            ACTOR_CUSTOMER_A
          );
          throw new Error("Simulated Transaction Crash");
        })();
      }).toThrow("Simulated Transaction Crash");

      const finalCount = (
        db.prepare("SELECT count(*) as count FROM pl_audit").get() as { count: number }
      ).count;
      expect(finalCount).toBe(initialCount); // Zero orphan audit rows
    });
  });

  // --------------------------------------------------------------------------
  // Suite 3: Tenant Isolation & Anti-Enumeration
  // --------------------------------------------------------------------------
  describe("3. Tenant Isolation & Anti-Enumeration Security", () => {
    it("prevents Customer B from accessing Customer A's project, returning 404", () => {
      const projectA = PrivateLabelService.createProjectDraft(
        { title: "Confidential Project A", target_market: "IN" },
        "cust-uuid-001",
        ACTOR_CUSTOMER_A
      );

      // Customer B attempts to get Customer A's project
      expect(() => {
        PrivateLabelService.getProject(projectA.id, "cust-uuid-002");
      }).toThrow(PrivateLabelNotFoundError);

      try {
        PrivateLabelService.getProject(projectA.id, "cust-uuid-002");
      } catch (err) {
        const error = err as PrivateLabelNotFoundError;
        expect(error.status).toBe(404);
        expect(error.mcpCode).toBe(-32004);
      }
    });

    it("prevents Customer B from mutating Customer A's project, returning 404", () => {
      const projectA = PrivateLabelService.createProjectDraft(
        { title: "Tamper Proof Project A", target_market: "IN" },
        "cust-uuid-001",
        ACTOR_CUSTOMER_A
      );

      expect(() => {
        PrivateLabelService.updateProjectDraft(
          projectA.id,
          1,
          { title: "Malicious Tampering" },
          ACTOR_CUSTOMER_B,
          "cust-uuid-002"
        );
      }).toThrow(PrivateLabelNotFoundError);
    });

    it("allows Admin actor to access project across tenants with audit trace", () => {
      const projectA = PrivateLabelService.createProjectDraft(
        { title: "Admin Inspected Project A", target_market: "IN" },
        "cust-uuid-001",
        ACTOR_CUSTOMER_A
      );

      // Calling without customerId restriction (Admin path)
      const fetched = PrivateLabelService.getProject(projectA.id);
      expect(fetched.id).toBe(projectA.id);
      expect(fetched.title).toBe("Admin Inspected Project A");
    });

    it("returns 404 when customer session attempts to read or update unowned/admin project with null owner_customer_id", () => {
      const db = getDb();
      const adminProjId = `proj_admin_unowned_${Date.now()}`;
      db.prepare(`
        INSERT INTO pl_projects (
          id, client_id, owner_customer_id, title, status, target_market, revision, created_at, updated_at
        ) VALUES (
          ?, NULL, NULL, 'Unowned Internal Project', 'draft', 'IN', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `).run(adminProjId);

      // Customer session must receive 404 (anti-enumeration)
      expect(() => {
        PrivateLabelService.getProject(adminProjId, "cust-uuid-001");
      }).toThrow(PrivateLabelNotFoundError);

      expect(() => {
        PrivateLabelService.updateProjectDraft(
          adminProjId,
          1,
          { title: "Customer Hijack" },
          ACTOR_CUSTOMER_A,
          "cust-uuid-001"
        );
      }).toThrow(PrivateLabelNotFoundError);

      // Admin access (no customerId) can read the project
      const adminFetched = PrivateLabelService.getProject(adminProjId);
      expect(adminFetched.id).toBe(adminProjId);
      expect(adminFetched.title).toBe("Unowned Internal Project");
    });
  });

  // --------------------------------------------------------------------------
  // Suite 4: Whitelisted Public DTO Projections
  // --------------------------------------------------------------------------
  describe("4. Whitelisted Public DTO Projections", () => {
    it("redacts supplier identity, supplier SKU, and internal unit cost from packaging variants", () => {
      const rawVariant = {
        id: "pack-001",
        family_id: "family-pouch",
        family_code: "pouch" as const,
        slug: "stand-up-pouch-matte-black-100g",
        sku: "PK-SUP-MB-100G",
        title: "Stand-up Pouch Matte Black 100g",
        material: "Matte BOPP / Foil / PE",
        finish: "Matte",
        closure_type: "Zip Lock",
        capacity_description: "100g Loose Leaf",
        net_weight_capacity_grams: 100,
        width_mm: 120,
        height_mm: 200,
        depth_mm: 60,
        label_safe_width_mm: 90,
        label_safe_height_mm: 140,
        supplier_name: "Confidential Packaging Corp",
        supplier_sku: "CPC-INT-9921",
        unit_cost_paise: 850, // 8.50 INR COGS
        lead_time_days: 14,
        moq_units: 500,
        order_multiple: 50,
        dieline_url: "/dielines/sup-100g.pdf",
        hero_image_url: "/images/pouch-black.png",
        image_illustrative: 1,
        status: "published" as const,
        revision: 1,
        created_at: "2026-11-09 20:00:00",
        updated_at: "2026-11-09 20:00:00",
      };

      const publicDto = toPublicPackagingVariantDto(rawVariant);
      expect(toPublicPackagingDto(rawVariant)).toEqual(publicDto);

      expect((publicDto as any).supplier_name).toBeUndefined();
      expect((publicDto as any).supplier_sku).toBeUndefined();
      expect((publicDto as any).unit_cost_paise).toBeUndefined();
      expect(publicDto.slug).toBe("stand-up-pouch-matte-black-100g");
      expect(publicDto.dimensions_mm.width).toBe(120);
      expect(publicDto.moq_units).toBe(500);
      expect(publicDto.image_illustrative).toBe(true);
    });

    it("redacts base purchase cost per kg from tea options", () => {
      const rawTea = {
        id: "tea-001",
        slug: "gopaldhara-red-thunder",
        name: "Gopaldhara Red Thunder Autumn Flush",
        origin_estate: "Gopaldhara",
        region: "Darjeeling",
        grade: "FTGFOP1",
        flush: "Autumn Flush",
        tea_category: "black" as const,
        description: "Rare autumnal Darjeeling with deep muscatel character.",
        caffeine_level: "medium" as const,
        base_cost_per_kg_paise: 180000, // 1800 INR/kg COGS
        min_batch_kg: 5.0,
        tasting_notes_json: '["Muscatel", "Honey", "Dried Apricot"]',
        regular_product_id: null,
        is_published: 1,
        sample_available: 1,
        revision: 1,
        created_at: "2026-11-09 20:00:00",
        updated_at: "2026-11-09 20:00:00",
      };

      const publicDto = toPublicTeaOptionDto(rawTea);

      expect((publicDto as any).base_cost_per_kg_paise).toBeUndefined();
      expect(publicDto.slug).toBe("gopaldhara-red-thunder");
      expect(publicDto.tasting_notes).toEqual(["Muscatel", "Honey", "Dried Apricot"]);
      expect(publicDto.min_batch_kg).toBe(5.0);
    });

    it("redacts internal margin paise and detailed COGS JSON from customer quotes", () => {
      const rawQuote = {
        id: "quote-001",
        quote_number: "PL-Q-2026-0001",
        project_id: "proj-001",
        price_book_id: "pb-standard",
        status: "firm_issued" as const,
        version: 1,
        currency: "INR",
        tea_subtotal_paise: 900000,
        packaging_subtotal_paise: 425000,
        printing_subtotal_paise: 250000,
        tooling_setup_paise: 500000,
        labor_subtotal_paise: 150000,
        qc_subtotal_paise: 250000,
        freight_paise: 120000,
        margin_paise: 650000, // Confidential margin
        tax_paise: 450000,
        grand_total_paise: 3695000,
        price_breakdown_json: '{"supplier_rates":{"pack_cogs":425000,"tea_cogs":900000},"margin_pct":0.25}',
        issued_at: "2026-11-09 20:00:00",
        valid_until: "2026-11-23 20:00:00",
        accepted_at: null,
        pdf_summary_url: "/quotes/PL-Q-2026-0001.pdf",
        revision: 1,
        created_at: "2026-11-09 20:00:00",
        updated_at: "2026-11-09 20:00:00",
      };

      const publicDto = toPublicQuoteDto(rawQuote);

      expect((publicDto as any).margin_paise).toBeUndefined();
      expect((publicDto as any).price_breakdown_json).toBeUndefined();
      expect((publicDto as any).price_book_id).toBeUndefined();
      expect(publicDto.grand_total_paise).toBe(3695000);
      expect(publicDto.quote_number).toBe("PL-Q-2026-0001");
    });

    it("redacts client ID, customer ID, and private notes from public project DTO", () => {
      const rawProject = {
        id: "proj-001",
        client_id: "client-001",
        owner_customer_id: "cust-001",
        brand_id: "brand-001",
        title: "Secret Startup Brand",
        status: "draft" as const,
        target_market: "IN",
        notes: "Confidential internal notes",
        draft_configuration_json: '{"teaId":"tea-1","packId":"pack-1"}',
        revision: 1,
        created_at: "2026-11-09 20:00:00",
        updated_at: "2026-11-09 20:00:00",
      };

      const publicDto = toPublicProjectDto(rawProject);

      expect((publicDto as any).client_id).toBeUndefined();
      expect((publicDto as any).owner_customer_id).toBeUndefined();
      expect((publicDto as any).notes).toBeUndefined();
      expect(publicDto.title).toBe("Secret Startup Brand");
      expect(publicDto.draft_configuration).toEqual({ teaId: "tea-1", packId: "pack-1" });
    });
  });

  // --------------------------------------------------------------------------
  // Suite 5: Business Gates & Rules
  // --------------------------------------------------------------------------
  describe("5. Business Gate Enforcement", () => {
    it("blocks production job release when order or proof approval is missing", () => {
      expect(() => {
        PrivateLabelService.releaseProductionJob(
          "unapproved-order-id",
          { target_completion_date: "2026-12-01" },
          ACTOR_ADMIN
        );
      }).toThrow(PrivateLabelGateError);

      try {
        PrivateLabelService.releaseProductionJob(
          "unapproved-order-id",
          { target_completion_date: "2026-12-01" },
          ACTOR_ADMIN
        );
      } catch (err) {
        const error = err as PrivateLabelGateError;
        expect(error.code).toBe("GATE_FAILED");
        expect(error.status).toBe(422);
        expect(error.mcpCode).toBe(-32009);
        expect(error.gate_name).toBe("production_release");
      }
    });

    it("validates packaging publish gate checking missing attributes and print compatibility", () => {
      const db = getDb();
      const variantId = "pack_gate_test";
      db.prepare(`
        INSERT INTO pl_packaging_variants (
          id, family_id, slug, sku, title, material, finish, closure_type,
          capacity_description, net_weight_capacity_grams, width_mm, height_mm,
          label_safe_width_mm, label_safe_height_mm, supplier_name, unit_cost_paise,
          moq_units, order_multiple
        ) VALUES (
          '${variantId}', 'fam_pouch', 'gate-test-pack', 'PK-GATE-01', 'Gate Pack',
          'Kraft', 'Matte', 'Zip', '100g', 100, 120, 200, 100, 150, 'Supplier', 1000, 500, 50
        )
      `).run();

      // No print compatibility yet
      const gateNoCompat = PrivateLabelService.validatePublishGate(variantId);
      expect(gateNoCompat.canPublish).toBe(false);
      expect(gateNoCompat.blockers.some((b) => b.includes("print method"))).toBe(true);

      // Add compatible print method
      db.prepare(`
        INSERT INTO pl_packaging_compatibility (id, packaging_variant_id, print_method_id, is_supported)
        VALUES ('compat_gate_1', '${variantId}', 'pm_paper_label', 1)
      `).run();

      const gatePass = PrivateLabelService.validatePublishGate(variantId);
      expect(gatePass.canPublish).toBe(true);
      expect(gatePass.blockers).toHaveLength(0);
    });

    it("enforces proof gate correlation: approval on Project A does not satisfy release gate for Project B", () => {
      const db = getDb();

      // Set up Project A with proof approval
      const projA = PrivateLabelService.createProjectDraft(
        { title: "Project A With Proof", target_market: "IN" },
        "cust-uuid-001",
        ACTOR_CUSTOMER_A
      );
      const itemAId = `item_gate_a_${Date.now()}`;
      db.prepare(`
        INSERT INTO pl_project_items (id, project_id, fill_weight_grams, quantity_units)
        VALUES (?, ?, 100, 500)
      `).run(itemAId, projA.id);

      const dvAId = `dv_gate_a_${Date.now()}`;
      db.prepare(`
        INSERT INTO pl_design_versions (id, project_item_id, version_number, print_ready_pdf_url)
        VALUES (?, ?, 1, 'https://cdn.example.com/proof_a.pdf')
      `).run(dvAId, itemAId);

      // Customer approves Project A
      PrivateLabelService.approveProof(prepareProofForApproval(dvAId),
        { actor_name: "Customer A", legal_disclaimer_accepted: true, notes: "Approved Project A" },
        ACTOR_CUSTOMER_A,
        "cust-uuid-001"
      );

      // Verify approval exists for Project A
      const approvalCount = db
        .prepare("SELECT count(*) as c FROM pl_approval_events WHERE action = 'customer_approved'")
        .get() as { c: number };
      expect(approvalCount.c).toBeGreaterThan(0);

      // Set up Project B with NO proof approval
      const projB = PrivateLabelService.createProjectDraft(
        { title: "Project B Without Proof", target_market: "IN" },
        "cust-uuid-002",
        ACTOR_CUSTOMER_B
      );
      const itemBId = `item_gate_b_${Date.now()}`;
      db.prepare(`
        INSERT INTO pl_project_items (id, project_id, fill_weight_grams, quantity_units)
        VALUES (?, ?, 100, 500)
      `).run(itemBId, projB.id);

      const quoteB = PrivateLabelService.createQuote(projB.id, {}, ACTOR_CUSTOMER_B, "cust-uuid-002");
      const orderBId = `ord_gate_b_${Date.now()}`;
      db.prepare(`
        INSERT INTO pl_orders (id, order_number, client_id, quote_id, status, deposit_paise, balance_paise)
        VALUES (?, 'PL-ORD-CORR-B', ?, ?, 'deposit_paid', 500000, 500000)
      `).run(orderBId, projB.client_id, quoteB.id);

      // Attempt to release Order B — MUST fail with PrivateLabelGateError because Project B has no approved proof
      expect(() => {
        PrivateLabelService.releaseProductionJob(orderBId, {}, ACTOR_ADMIN);
      }).toThrow(PrivateLabelGateError);

      try {
        PrivateLabelService.releaseProductionJob(orderBId, {}, ACTOR_ADMIN);
      } catch (err) {
        const gateErr = err as PrivateLabelGateError;
        expect(gateErr.gate_name).toBe("production_release");
        expect(gateErr.blockers.some((b) => b.includes("proof approval"))).toBe(true);
      }

      // Now create design version and approve proof for Project B
      const dvBId = `dv_gate_b_${Date.now()}`;
      db.prepare(`
        INSERT INTO pl_design_versions (id, project_item_id, version_number, print_ready_pdf_url)
        VALUES (?, ?, 1, 'https://cdn.example.com/proof_b.pdf')
      `).run(dvBId, itemBId);

      PrivateLabelService.approveProof(prepareProofForApproval(dvBId),
        { actor_name: "Customer B", legal_disclaimer_accepted: true, notes: "Approved Project B" },
        ACTOR_CUSTOMER_B,
        "cust-uuid-002"
      );

      // Now releasing Order B must succeed
      const jobB = PrivateLabelService.releaseProductionJob(orderBId, {}, ACTOR_ADMIN);
      expect(jobB).toBeDefined();
      expect(jobB.order_id).toBe(orderBId);
      expect(jobB.status).toBe("scheduled");
    });
  });

  // --------------------------------------------------------------------------
  // Suite 6: Multi-Dimensional MOQ Engine
  // --------------------------------------------------------------------------
  describe("6. Multi-Dimensional MOQ Engine", () => {
    const baseMoqConfig = {
      requestedUnits: 500,
      netWeightGrams: 50,
      teaMinBatchKg: 10, // requires 200 units
      packagingMOQ: 500,
      printMOQ: 100,
      fillingMOQ: 100,
      orderMultiple: 50,
    };

    it("approves exact valid minimum order matching all constraints", () => {
      const result = evaluateMoq(baseMoqConfig);
      expect(result.eligible).toBe(true);
      expect(result.minUnits).toBe(500);
      expect(result.nextValidUnits).toBe(500);
      expect(result.reasons).toHaveLength(0);
      expect(calculateMOQ(baseMoqConfig)).toEqual(result);
    });

    it("identifies tea batch shortage and calculates required units from kg", () => {
      // 10kg tea batch with 25g packs requires ceil(10,000 / 25) = 400 units
      // Customer requests 250 units against packaging MOQ 200
      const result = evaluateMoq({
        ...baseMoqConfig,
        netWeightGrams: 25,
        teaMinBatchKg: 10,
        packagingMOQ: 200,
        requestedUnits: 250,
      });

      expect(result.eligible).toBe(false);
      expect(result.teaUnitsRequired).toBe(400);
      expect(result.nextValidUnits).toBe(400);
      expect(result.reasons[0]).toContain("below minimum tea blending batch");
    });

    it("enforces order multiples above the minimum threshold", () => {
      // Customer requests 520 units when multiple is 50
      const result = evaluateMoq({
        ...baseMoqConfig,
        requestedUnits: 520,
      });

      expect(result.eligible).toBe(false);
      expect(result.nextValidUnits).toBe(550);
      expect(result.reasons[0]).toContain("must be an exact multiple of 50");
    });

    it("handles compound multi-constraint failures simultaneously", () => {
      // Sub-tea (needs 200), sub-pack (needs 500), sub-print (gravure needs 5000), non-multiple
      const result = evaluateMoq({
        ...baseMoqConfig,
        printMOQ: 5000,
        requestedUnits: 153,
      });

      expect(result.eligible).toBe(false);
      expect(result.minUnits).toBe(5000);
      expect(result.nextValidUnits).toBe(5000);
      expect(result.reasons.length).toBeGreaterThanOrEqual(4);
      expect(result.reasons.some((r) => r.includes("tea blending batch"))).toBe(true);
      expect(result.reasons.some((r) => r.includes("packaging MOQ"))).toBe(true);
      expect(result.reasons.some((r) => r.includes("printing method MOQ"))).toBe(true);
      expect(result.reasons.some((r) => r.includes("exact multiple of 50"))).toBe(true);
    });

    it("evaluates minimum order value threshold if configured", () => {
      const result = evaluateMoq({
        ...baseMoqConfig,
        minOrderValuePaise: 1000000, // ₹10,000
        unitEstimatedPricePaise: 1500, // ₹15.00 * 500 = ₹7,500
      });

      expect(result.eligible).toBe(false);
      expect(result.reasons.some((r) => r.includes("below minimum order value"))).toBe(true);
    });

    it("defensively prevents division-by-zero when orderMultiple K is 0", () => {
      const result = evaluateMoq({
        ...baseMoqConfig,
        orderMultiple: 0 as any,
      });

      expect(Number.isNaN(result.minUnits)).toBe(false);
      expect(Number.isNaN(result.nextValidUnits)).toBe(false);
      expect(result.constraints.orderMultiple).toBe(1);
    });
  });

  // --------------------------------------------------------------------------
  // Suite 7: Packaging & Print Compatibility Matrix
  // --------------------------------------------------------------------------
  describe("7. Packaging & Print Compatibility Matrix", () => {
    it("confirms pouch compatibility with paper label, BOPP, and direct digital", () => {
      const paper = validatePackagingPrintCompatibility({
        familyCode: "pouch",
        variantSubstrate: "kraft_paper",
        printMethodCode: "paper_label",
      });
      expect(paper.compatible).toBe(true);
      expect(paper.maxColors).toBe(4);

      const bopp = validatePackagingPrintCompatibility({
        familyCode: "pouch",
        variantSubstrate: "matte_bopp",
        printMethodCode: "bopp_label",
      });
      expect(bopp.compatible).toBe(true);
      expect(bopp.maxColors).toBe(6);

      const digital = validateCompatibility({
        familyCode: "pouch",
        variantSubstrate: "matte_bopp",
        printMethodCode: "direct_digital",
      });
      expect(digital.compatible).toBe(true);
      expect(digital.maxColors).toBe(8);
    });

    it("rejects screen printing and shrink sleeve on flexible pouches", () => {
      const screen = validatePackagingPrintCompatibility({
        familyCode: "pouch",
        printMethodCode: "screen_print",
      });
      expect(screen.compatible).toBe(false);
      expect(screen.reason).toContain("not supported on flexible pouches");

      const sleeve = validatePackagingPrintCompatibility({
        familyCode: "pouch",
        printMethodCode: "sleeve",
      });
      expect(sleeve.compatible).toBe(false);
      expect(sleeve.reason).toContain("Shrink sleeves cannot be heat-shrunk over flexible pouches");
    });

    it("rejects direct digital and gravure on pre-formed metal tins", () => {
      const digital = validatePackagingPrintCompatibility({
        familyCode: "tin",
        printMethodCode: "direct_digital",
      });
      expect(digital.compatible).toBe(false);
      expect(digital.reason).toContain("Direct UV flatbed digital print is not feasible on pre-formed cylindrical tins");

      const gravure = validatePackagingPrintCompatibility({
        familyCode: "tin",
        printMethodCode: "gravure",
      });
      expect(gravure.compatible).toBe(false);
      expect(gravure.reason).toContain("Rotogravure printing requires flexible film rolls");
    });

    it("calculates accurate mechanical safe-zone margins and bleed", () => {
      // 120mm x 200mm pouch
      const pouchSafe = calculateSafeZone("pouch", 120, 200);
      expect(pouchSafe.marginsMm.top).toBe(35); // zipper seal clearance
      expect(pouchSafe.marginsMm.bottom).toBe(15); // gusset clearance
      expect(pouchSafe.marginsMm.left).toBe(10);
      expect(pouchSafe.labelSafeWidthMm).toBe(100);
      expect(pouchSafe.labelSafeHeightMm).toBe(150);
      expect(pouchSafe.bleedMm).toBe(3);
    });
  });

  // --------------------------------------------------------------------------
  // Suite 8: Tiered Price Book & 12-Component Pricing Engine
  // --------------------------------------------------------------------------
  describe("8. Tiered Price Book Engine", () => {
    const mockPricingParams = {
      requestedUnits: 1000,
      netWeightGrams: 50,
      teaOption: {
        id: "tea_darjeeling_ftgfop1",
        baseCostPerKgPaise: 240000, // ₹2,400.00 / kg
      },
      packagingVariant: {
        id: "pack_pouch_100g_matte",
        unitCostPaise: 1200, // ₹12.00
        closureRatePaise: 150, // ₹1.50
        tareWeightGrams: 14,
        packsPerCarton: 24,
      },
      printMethod: {
        id: "print_bopp_digital",
        code: "bopp_label" as const,
        setupFeePaise: 150000, // ₹1,500.00
        cylinderFeePerColorPaise: 0,
      },
      colorCount: 4,
      priceBook: {
        id: "pb_default_inr",
        marginRate: 0.25,
        fillingLaborPaisePerUnit: 300, // ₹3.00
        qcChargePaisePerBatch: 250000, // ₹2,500.00
        lossAllowanceRate: 0.03, // 3%
      },
      destinationZone: "metro" as const,
    };

    it("calculates all 12 cost components accurately with integer arithmetic", () => {
      const quote = calculateItemizedQuote(mockPricingParams);
      expect(calculateQuote(mockPricingParams)).toEqual(quote);

      expect(quote.status).toBe("firm_issued");
      expect(quote.breakdown).toBeDefined();

      const b = quote.breakdown!;
      // 1. Tea cost: 1000 * 50g = 50kg * 1.03 loss = 51.5kg * 240000 = 12,360,000 paise
      expect(b.teaCostPaise).toBe(12360000);
      // 2. Packaging cost: 1000 * 1200 = 1,200,000 paise
      expect(b.packagingCostPaise).toBe(1200000);
      // 4. Closure: 1000 * 150 = 150,000 paise
      expect(b.closureCostPaise).toBe(150000);
      // 6. Setup fee: 150,000 paise
      expect(b.setupFeePaise).toBe(150000);
      // 7. Cylinders (BOPP label): 0 paise
      expect(b.gravureCylinderFeePaise).toBe(0);
      // 8. Labor: 1000 * 300 = 300,000 paise
      expect(b.laborCostPaise).toBe(300000);
      // 9. QC charge: 250,000 paise
      expect(b.qcCostPaise).toBe(250000);
      // 10. Cartons: ceil(1000/24) = 42 cartons * 6000 = 252,000 paise
      expect(b.cartonCostPaise).toBe(252000);

      // Verify Dual-Rate GST
      // Tea GST: 5% of 12,360,000 = 618,000 paise
      expect(b.taxDetails.teaGstPaise).toBe(618000);
      // Non-tea GST: 18% of non-tea subtotal + setup + cylinders + margin
      expect(b.taxDetails.nonTeaGstPaise).toBeGreaterThan(0);
      expect(b.taxPaise).toBe(b.taxDetails.teaGstPaise + b.taxDetails.nonTeaGstPaise);

      // Grand Total = directSubtotal + setup + cylinders + margin + tax
      expect(b.grandTotalPaise).toBe(
        b.subtotalPaise + b.setupFeePaise + b.gravureCylinderFeePaise + b.marginPaise + b.taxPaise
      );
    });

    it("computes cylinder tooling fees strictly for rotogravure printing", () => {
      const gravureQuote = calculateItemizedQuote({
        ...mockPricingParams,
        printMethod: {
          id: "print_gravure",
          code: "gravure",
          setupFeePaise: 500000, // ₹5,000.00
          cylinderFeePerColorPaise: 800000, // ₹8,000.00 / cylinder
        },
        colorCount: 5, // 5 cylinders = ₹40,000.00 = 4,000,000 paise
      });

      expect(gravureQuote.breakdown!.gravureCylinderFeePaise).toBe(4000000);
    });

    it("emits manual_quote_required when rate data is missing", () => {
      const incompleteQuote = calculateItemizedQuote({
        ...mockPricingParams,
        packagingVariant: {
          ...mockPricingParams.packagingVariant,
          unitCostPaise: 0, // Unverified rate
        },
      });

      expect(incompleteQuote.status).toBe("manual_quote_required");
      expect(incompleteQuote.requiresOperatorReview).toBe(true);
      expect(incompleteQuote.missingRates).toContain("packaging_unit_cost_unverified");
    });

    it("normalizes snake_case rate properties from SQLite and avoids NaN poisoning", () => {
      const rawDbTea = {
        id: "tea_raw_snake",
        base_cost_per_kg_paise: 240000, // snake_case from DB
        // baseCostPerKgPaise is undefined
      };
      const rawDbPackaging = {
        id: "pack_raw_snake",
        unit_cost_paise: 1200, // snake_case from DB
        closure_rate_paise: 150,
        tare_weight_grams: 14,
        packs_per_carton: 24,
      };

      const quote = calculateQuote({
        requestedUnits: 1000,
        netWeightGrams: 50,
        teaOption: rawDbTea as any,
        packagingVariant: rawDbPackaging as any,
        printMethod: {
          id: "pm_paper_label",
          code: "paper_label",
          setupFeePaise: 100000,
          cylinderFeePerColorPaise: 0,
        },
      });

      expect(quote.status).toBe("firm_issued");
      expect(quote.breakdown).toBeDefined();
      expect(Number.isNaN(quote.breakdown!.teaCostPaise)).toBe(false);
      expect(Number.isNaN(quote.breakdown!.packagingCostPaise)).toBe(false);
      expect(Number.isNaN(quote.breakdown!.grandTotalPaise)).toBe(false);
      expect(Number.isNaN(quote.breakdown!.unitPricePaise)).toBe(false);
      expect(quote.breakdown!.teaCostPaise).toBe(12360000);
      expect(quote.breakdown!.packagingCostPaise).toBe(1200000);
    });

    it("handles zero or negative rates safely and falls back to manual_quote_required without NaN", () => {
      const unverifiedQuote = calculateQuote({
        requestedUnits: 1000,
        netWeightGrams: 50,
        teaOption: { id: "tea_zero", baseCostPerKgPaise: 0 } as any,
        packagingVariant: { id: "pack_valid", unitCostPaise: 1200 } as any,
        printMethod: { id: "pm_paper", code: "paper_label", setupFeePaise: 0, cylinderFeePerColorPaise: 0 },
      });

      expect(unverifiedQuote.status).toBe("manual_quote_required");
      expect(unverifiedQuote.missingRates).toContain("tea_base_cost_unverified");
      expect(unverifiedQuote.breakdown).toBeUndefined();
    });

    it("prevents division-by-zero when requestedUnits is zero", () => {
      const zeroQtyQuote = calculateQuote({
        requestedUnits: 0,
        netWeightGrams: 50,
        teaOption: { id: "tea_valid", baseCostPerKgPaise: 240000 } as any,
        packagingVariant: { id: "pack_valid", unitCostPaise: 1200 } as any,
        printMethod: { id: "pm_paper", code: "paper_label", setupFeePaise: 0, cylinderFeePerColorPaise: 0 },
      });

      expect(zeroQtyQuote.status).toBe("firm_issued");
      expect(zeroQtyQuote.breakdown!.unitPricePaise).toBe(0);
      expect(Number.isNaN(zeroQtyQuote.breakdown!.unitPricePaise)).toBe(false);
    });

    it("acceptQuote resolves clientId from project when omitted in input, avoiding FK errors", () => {
      const project = PrivateLabelService.createProjectDraft(
        { title: "Accept Quote Client Test", target_market: "IN" },
        "cust-uuid-001",
        ACTOR_CUSTOMER_A
      );
      const quote = PrivateLabelService.createQuote(project.id, {}, ACTOR_CUSTOMER_A, "cust-uuid-001");

      // Accept quote without passing clientId in input
      const accepted = PrivateLabelService.acceptQuote(quote.id, quote.revision, {}, ACTOR_CUSTOMER_A, "cust-uuid-001");
      expect(accepted.quote.status).toBe("customer_accepted");
      expect(accepted.orderId).toBeDefined();

      const db = getDb();
      const order = db.prepare("SELECT * FROM pl_orders WHERE id = ?").get(accepted.orderId) as any;
      expect(order).toBeDefined();
      expect(order.client_id).toBeDefined();
      expect(order.client_id).not.toBe("");
    });
  });

  // --------------------------------------------------------------------------
  // Suite 9: Zod Validation Schemas
  // --------------------------------------------------------------------------
  describe("9. Zod Validation Schemas", () => {
    it("rejects non-positive numbers in moqInputSchema", () => {
      expect(
        moqInputSchema.safeParse({
          requestedUnits: 0,
          netWeightGrams: 50,
          teaMinBatchKg: 10,
          packagingMOQ: 500,
          printMOQ: 100,
        }).success
      ).toBe(false);
    });

    it("strictly requires legal disclaimer attestation in proofApprovalSchema", () => {
      const payload = {
        designVersionId: "des_ver_123",
        clientId: "client_456",
        legalDisclaimerAccepted: false,
      };
      const result = proofApprovalSchema.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("Legal proof disclaimer must be explicitly accepted");
      }
    });

    it("validates price book quantity tier constraints (maxQty >= minQty)", () => {
      // Invalid: maxQty (500) < minQty (1000)
      const invalidTier = {
        priceBookId: "pb_1",
        itemType: "packaging" as const,
        itemId: "pack_1",
        minQty: 1000,
        maxQty: 500,
        unitPricePaise: 1200,
      };
      expect(priceBookTierAdminSchema.safeParse(invalidTier).success).toBe(false);

      // Valid: open-ended tier (maxQty null)
      const validTier = { ...invalidTier, maxQty: null };
      expect(priceBookTierAdminSchema.safeParse(validTier).success).toBe(true);
    });

    it("rejects unauthorized file extensions and sizes in artworkUploadIntentSchema", () => {
      const oversized = {
        originalFilename: "logo.png",
        fileSizeBytes: 30_000_000, // > 25MB
        mimeType: "image/png" as const,
        fileSha256: "a".repeat(64),
        rightsAttestation: true,
      };
      expect(artworkUploadIntentSchema.safeParse(oversized).success).toBe(false);

      const invalidMime = {
        ...oversized,
        fileSizeBytes: 1000,
        mimeType: "image/bmp",
      };
      expect(artworkUploadIntentSchema.safeParse(invalidMime).success).toBe(false);
    });
  });
});
