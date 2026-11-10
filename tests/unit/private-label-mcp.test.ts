import { prepareProofForApproval } from "./private-label-proof-fixture";
/**
 * TeaFloww Private Label Studio — Milestone M7 MCP Unit Test Suite
 * File: tests/unit/private-label-mcp.test.ts
 *
 * 12 comprehensive test suites (48+ unit tests) verifying:
 * - Tool registration, JSON Schema compliance, annotations, and dot/alias dispatch
 * - Catalog and specification query tools with DTO sanitization
 * - Project draft management, CAS revision incrementing, and soft archiving
 * - Quotation snapshot creation, itemization, and CAS acceptance
 * - Artwork preflight validation, 2D preview generation, legal proof approval, and rejection
 * - Sample orders, order conversion, production release hard gates, and 7-stage QC
 * - Append-only pl_audit history with actor_type = 'mcp' and dashboard metrics
 * - Parameter validation (-32602) and method not found (-32601) protocol boundaries
 * - CAS concurrency conflicts (-32009) with current vs expected revision reporting
 * - Manufacturing gate blocker enforcement (-32009)
 * - Strict multi-tenant isolation and anti-enumeration (-32004)
 * - Parallel race conditions and cross-channel concurrency
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { rmSync } from "node:fs";
import {
  dispatchToolCall,
  listToolDefinitions,
  listTools,
  McpError,
} from "@/lib/mcp";
import { PrivateLabelService } from "@/lib/private-label/service";
import { getDb } from "@/lib/db";
import type {
  MoqEvaluationResult,
  AuditRecord,
  PublicQuoteWithItemsDto,
} from "@/lib/private-label/types";
import type {
  PublicPackagingVariantDto,
  PublicProjectDto,
  PublicDesignVersionDto,
  PublicApprovalEventDto,
  PublicSampleOrderDto,
  PublicProductionOrderDto,
  PublicQCMilestoneDto,
} from "@/lib/private-label/public-dto";

const TEST_DB = path.join(
  tmpdir(),
  `pl-mcp-unit-${process.pid}-${Date.now()}.sqlite`
);
process.env.DATABASE_PATH = TEST_DB;

// Generic test dispatch helper
function call<T = unknown>(name: string, args?: unknown): T {
  return dispatchToolCall(name, args ?? {}) as T;
}

// Generic test failure assertion helper
function failsWith(name: string, args: unknown): McpError {
  try {
    dispatchToolCall(name, args);
  } catch (error) {
    expect(error).toBeInstanceOf(McpError);
    return error as McpError;
  }
  throw new Error(`Expected tool "${name}" to fail with McpError`);
}

const CANONICAL_PL_TOOLS = [
  "private_label_list_catalogue",
  "private_label_get_packaging",
  "private_label_upsert_packaging",
  "private_label_set_moq",
  "private_label_upsert_price_rule",
  "private_label_calculate_moq",
  "private_label_calculate_quote",
  "private_label_create_project",
  "private_label_get_project",
  "private_label_save_project",
  "private_label_archive_project",
  "private_label_create_quote",
  "private_label_get_quote",
  "private_label_accept_quote",
  "private_label_validate_preflight",
  "private_label_generate_preview",
  "private_label_approve_proof",
  "private_label_reject_proof",
  "private_label_order_sample",
  "private_label_release_job",
] as const;

describe("TeaFloww Private Label Studio — Milestone M7 MCP Specification", () => {
  beforeAll(() => {
    // Run all database migrations on isolated SQLite database
    execFileSync(process.execPath, ["scripts/migrate.mjs"], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_PATH: TEST_DB },
      stdio: "ignore",
    });

    const db = getDb();
    // Seed initial catalog data (families, print methods, default price book)
    PrivateLabelService.seedInitialCatalog();

    // 1. Seed tenant customer accounts
    db.prepare(`
      INSERT OR IGNORE INTO customers (id, email, name)
      VALUES ('client_alpha', 'alpha@teafloww.com', 'Client Alpha'),
             ('client_beta', 'beta@teafloww.com', 'Client Beta')
    `).run();

    // 2. Seed client organizations
    db.prepare(`
      INSERT OR IGNORE INTO pl_clients (id, customer_id, company_name, contact_name, contact_email)
      VALUES ('client_alpha', 'client_alpha', 'Alpha Organic Tea Co', 'Alpha Admin', 'alpha@teafloww.com'),
             ('client_beta', 'client_beta', 'Beta Global Blends', 'Beta Admin', 'beta@teafloww.com')
    `).run();

    // 3. Seed primary packaging variant
    db.prepare(`
      INSERT OR IGNORE INTO pl_packaging_variants (
        id, family_id, slug, sku, title, material, finish, closure_type,
        capacity_description, net_weight_capacity_grams, width_mm, height_mm, depth_mm,
        label_safe_width_mm, label_safe_height_mm, supplier_name, supplier_sku,
        unit_cost_paise, lead_time_days, moq_units, order_multiple, status, revision
      ) VALUES (
        'pack_pouch_standup_250g_01', 'fam_pouch', 'stand-up-pouch-matte-black-250g', 'PK-POUCH-250-MB',
        'Stand-Up Pouch Matte Black 250g', 'Kraft/Foil', 'Matte', 'Zipper',
        '250g / 8.8oz', 250, 160, 230, 80,
        140, 150, 'Siliguri Pack Corp', 'SPC-MB-250',
        2500, 14, 500, 50, 'published', 1
      )
    `).run();

    // 4. Seed primary tea option
    db.prepare(`
      INSERT OR IGNORE INTO pl_tea_options (
        id, slug, name, origin_estate, region, grade, flush, tea_category,
        description, caffeine_level, base_cost_per_kg_paise, min_batch_kg,
        tasting_notes_json, is_published, sample_available, revision
      ) VALUES (
        'tea_darjeeling_first_flush', 'darjeeling-first-flush-organic', 'Darjeeling First Flush Organic',
        'Makaibari Estate', 'Darjeeling', 'FTGFOP1', 'First Flush 2026', 'black',
        'Floral muscatel profile with orchid notes', 'medium', 120000, 5.0,
        '["Orchid", "Muscatel", "Fresh Hay"]', 1, 1, 1
      )
    `).run();

    // 5. Seed print compatibility
    db.prepare(`
      INSERT OR IGNORE INTO pl_packaging_compatibility (id, packaging_variant_id, print_method_id, is_supported)
      VALUES ('compat_pouch_paper_label', 'pack_pouch_standup_250g_01', 'pm_paper_label', 1)
    `).run();

    // 6. Seed active price book tiers
    db.prepare(`
      INSERT OR IGNORE INTO pl_price_book_tiers (id, price_book_id, item_type, item_id, min_qty, max_qty, unit_price_paise)
      VALUES ('pbt_pack_test', 'pb_default_inr', 'packaging', 'pack_pouch_standup_250g_01', 100, 10000, 3500),
             ('pbt_print_test', 'pb_default_inr', 'print_method', 'pm_paper_label', 100, 10000, 1500),
             ('pbt_tea_test', 'pb_default_inr', 'tea_markup', 'tea_darjeeling_first_flush', 1, 10000, 150000)
    `).run();
  });

  afterAll(() => {
    try {
      getDb().close();
    } catch {}
    for (const suffix of ["", "-shm", "-wal", "-journal"]) {
      try {
        rmSync(TEST_DB + suffix, { force: true });
      } catch {}
    }
  });

  // =========================================================================
  // Suite 1: Tool Registration & Schema Compliance
  // =========================================================================
  describe("Suite 1: Tool Registration & Schema Compliance", () => {
    it("1.1: listTools() and listToolDefinitions() export all 20 canonical tools under private_label_*", () => {
      expect(listTools).toBe(listToolDefinitions);
      const tools = listTools();
      const toolNames = tools.map((t) => t.name);

      for (const name of CANONICAL_PL_TOOLS) {
        expect(toolNames).toContain(name);
      }
      expect(toolNames.filter((n) => n.startsWith("private_label_")).length).toBeGreaterThanOrEqual(20);
    });

    it("1.2: Tool naming aliases and dot notation dispatch resolve properly", () => {
      // Dot notation dispatch
      const resDot = call<{ total: number }>("private_label.list_catalogue", { limit: 5 });
      expect(resDot.total).toBeGreaterThanOrEqual(1);

      // Ergonomic pl_* prefix
      const resPl = call<{ total: number }>("pl_list_packaging_catalog", { limit: 5 });
      expect(resPl.total).toBeGreaterThanOrEqual(1);

      // Descriptive aliases
      const moqRes = call<MoqEvaluationResult>("private_label_validate", {
        packaging_variant_id: "pack_pouch_standup_250g_01",
        quantity: 1000,
      });
      expect(moqRes.eligible).toBe(true);

      const quoteEstimate = call<any>("private_label_get_estimate", {
        packaging_variant_id: "pack_pouch_standup_250g_01",
        quantity: 1000,
      });
      expect(quoteEstimate.estimated_total_paise).toBeGreaterThan(0);
    });

    it("1.3: JSON Schema compliance: inputSchema is object and descriptions are non-empty", () => {
      const tools = listTools().filter((t) => t.name.startsWith("private_label_"));
      for (const tool of tools) {
        expect(tool.inputSchema.type).toBe("object");
        expect(tool.description.length).toBeGreaterThanOrEqual(15);
      }

      const saveProjectDef = tools.find((t) => t.name === "private_label_save_project");
      expect(saveProjectDef?.inputSchema.required).toContain("id");
      expect(saveProjectDef?.inputSchema.required).toContain("expected_revision");

      const releaseJobDef = tools.find((t) => t.name === "private_label_release_job");
      expect(releaseJobDef?.inputSchema.required).toContain("order_id");
    });

    it("1.4: Tool annotations metadata properly distinguishes read-only vs mutating tools", () => {
      const tools = listTools();

      const readTools = ["private_label_list_catalogue", "private_label_get_packaging", "private_label_calculate_moq"];
      for (const name of readTools) {
        const tool = tools.find((t) => t.name === name);
        expect(tool?.annotations?.readOnlyHint).toBe(true);
        expect(tool?.annotations?.idempotentHint).toBe(true);
      }

      const mutatingTools = ["private_label_create_project", "private_label_save_project", "private_label_release_job"];
      for (const name of mutatingTools) {
        const tool = tools.find((t) => t.name === name);
        expect(tool?.annotations?.readOnlyHint).toBe(false);
      }
    });
  });

  // =========================================================================
  // Suite 2: Catalog & Specification Read Tools (F1–F4)
  // =========================================================================
  describe("Suite 2: Catalog & Specification Read Tools", () => {
    it("2.1: private_label_list_catalogue returns structured catalogue data", () => {
      const result = call<{ packaging: PublicPackagingVariantDto[]; total: number }>(
        "private_label_list_catalogue",
        { limit: 10 }
      );
      expect(result.packaging.length).toBeGreaterThanOrEqual(1);
      expect(result.total).toBeGreaterThanOrEqual(1);
      expect(result.packaging[0]?.sku).toBe("PK-POUCH-250-MB");
    });

    it("2.2: Public Whitelist DTO parity: strips supplier confidential COGS and vendor names", () => {
      const result = call<{ packaging: Record<string, unknown>[] }>("private_label_list_catalogue", {});
      const pack = result.packaging[0];
      expect(pack).toBeDefined();
      expect(pack).not.toHaveProperty("unit_cost_paise");
      expect(pack).not.toHaveProperty("supplier_name");
      expect(pack).not.toHaveProperty("supplier_sku");
      expect(pack).not.toHaveProperty("cogs_paise");
    });

    it("2.3: private_label_get_packaging retrieves dimensions and compatible print methods", () => {
      const result = call<any>("private_label_get_packaging", {
        slug: "stand-up-pouch-matte-black-250g",
      });
      expect(result.variant.sku).toBe("PK-POUCH-250-MB");
      expect(result.variant.dimensions_mm.width).toBe(160);
      expect(result.variant.dimensions_mm.height).toBe(230);
      expect(result.compatible_print_methods.length).toBeGreaterThanOrEqual(1);
      expect(result.compatible_print_methods[0]?.code).toBe("paper_label");
    });

    it("2.4: private_label_calculate_moq evaluates multi-dimensional constraints", () => {
      // Eligible scenario (1000 >= 500)
      const eligibleRes = call<MoqEvaluationResult>("private_label_calculate_moq", {
        packaging_variant_id: "pack_pouch_standup_250g_01",
        quantity: 1000,
        tea_option_id: "tea_darjeeling_first_flush",
        print_method_id: "pm_paper_label",
      });
      expect(eligibleRes.eligible).toBe(true);

      // Ineligible scenario (50 < 500)
      const ineligibleRes = call<MoqEvaluationResult>("private_label_calculate_moq", {
        packaging_variant_id: "pack_pouch_standup_250g_01",
        quantity: 50,
        tea_option_id: "tea_darjeeling_first_flush",
        print_method_id: "pm_paper_label",
      });
      expect(ineligibleRes.eligible).toBe(false);
      expect(ineligibleRes.minUnits).toBeGreaterThanOrEqual(500);
    });

    it("2.5: private_label_calculate_quote produces itemized cost estimate with positive grand total", () => {
      const estimate = call<any>("private_label_calculate_quote", {
        packaging_variant_id: "pack_pouch_standup_250g_01",
        quantity: 1000,
        tea_option_id: "tea_darjeeling_first_flush",
        print_method_id: "pm_paper_label",
        color_count: 4,
      });
      expect(estimate.estimated_total_paise).toBeGreaterThan(0);
      expect(estimate.breakdown.packaging_subtotal_paise).toBeGreaterThan(0);
      expect(estimate.breakdown.tea_subtotal_paise).toBeGreaterThan(0);
      expect(estimate.taxDetails.teaGstPaise).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // Suite 3: Project Draft Management & CAS Revision Tracking (F5–F8)
  // =========================================================================
  describe("Suite 3: Project Draft Management & CAS Revision Tracking", () => {
    let createdProjectId: string;

    it("3.1: private_label_create_project initializes draft with revision 1 and logs audit entry", () => {
      const project = call<PublicProjectDto>("private_label_create_project", {
        client_id: "client_alpha",
        title: "Alpha Himalayan Gold",
        target_market: "IN",
      });
      expect(project.id).toMatch(/^proj_/);
      expect(project.revision).toBe(1);
      expect(project.status).toBe("draft");
      createdProjectId = project.id;

      // Assert audit log record in pl_audit
      const db = getDb();
      const audit = db
        .prepare("SELECT * FROM pl_audit WHERE entity_id = ? AND action = 'create_draft'")
        .get(project.id) as AuditRecord | undefined;
      expect(audit).toBeDefined();
      expect(audit?.actor_type).toBe("mcp");
      expect(audit?.actor_id).toBe("mcp-agent");
    });

    it("3.2: private_label_get_project retrieves project dossier and items", () => {
      const project = call<PublicProjectDto & { items: unknown[] }>("private_label_get_project", {
        id: createdProjectId,
        client_id: "client_alpha",
      });
      expect(project.id).toBe(createdProjectId);
      expect(project.title).toBe("Alpha Himalayan Gold");
      expect(Array.isArray(project.items)).toBe(true);
    });

    it("3.3: private_label_save_project updates draft configuration under CAS guard (advances to rev 2)", () => {
      const updated = call<PublicProjectDto>("private_label_save_project", {
        id: createdProjectId,
        expected_revision: 1,
        title: "Alpha Himalayan Gold Reserve",
        client_id: "client_alpha",
      });
      expect(updated.revision).toBe(2);
      expect(updated.title).toBe("Alpha Himalayan Gold Reserve");
    });

    it("3.4: private_label_archive_project transitions project to archived under CAS guard (advances to rev 3)", () => {
      const archived = call<{ status: string; revision: number }>("private_label_archive_project", {
        id: createdProjectId,
        expected_revision: 2,
        client_id: "client_alpha",
      });
      expect(archived.status).toBe("archived");
      expect(archived.revision).toBe(3);
    });
  });

  // =========================================================================
  // Suite 4: Quotation Lifecycle via MCP (F9–F11)
  // =========================================================================
  describe("Suite 4: Quotation Lifecycle via MCP", () => {
    let quoteProjectId: string;
    let quoteId: string;

    beforeAll(() => {
      const proj = call<PublicProjectDto>("private_label_create_project", {
        client_id: "client_alpha",
        title: "Quote Test Project",
        items: [
          {
            packaging_variant_id: "pack_pouch_standup_250g_01",
            tea_option_id: "tea_darjeeling_first_flush",
            print_method_id: "pm_paper_label",
            target_quantity: 1000,
            fill_weight_grams: 250,
          },
        ],
      });
      quoteProjectId = proj.id;
    });

    it("4.1: private_label_create_quote issues price-locked quotation snapshot", () => {
      const quote = call<PublicQuoteWithItemsDto>("private_label_create_quote", {
        project_id: quoteProjectId,
        validity_days: 14,
        client_id: "client_alpha",
      });
      expect(quote.id).toMatch(/^quote_/);
      expect(quote.quote_number).toMatch(/^(PL-QTE-|TF-PLQ-)/);
      expect(quote.valid_until).toBeDefined();
      expect(quote.grand_total_paise).toBeGreaterThan(0);
      quoteId = quote.id;
    });

    it("4.2: private_label_get_quote retrieves full quotation breakdown", () => {
      const quote = call<PublicQuoteWithItemsDto>("private_label_get_quote", {
        id: quoteId,
        client_id: "client_alpha",
      });
      expect(quote.id).toBe(quoteId);
      expect(quote.items.length).toBeGreaterThanOrEqual(1);
      expect(quote.grand_total_paise).toBeGreaterThan(0);
    });

    it("4.3: private_label_accept_quote customer accepts quote under CAS revision guard", () => {
      const accepted = call<PublicQuoteWithItemsDto & { order_id?: string }>("private_label_accept_quote", {
        id: quoteId,
        expected_revision: 1,
        client_id: "client_alpha",
        acceptance_notes: "Accepted via MCP pipeline",
      });
      expect(accepted.status).toBe("customer_accepted");
      expect(accepted.revision).toBe(2);
      expect(accepted.order_id).toBeDefined();
    });

    it("4.4: private_label_get_quote throws -32004 when quote does not exist", () => {
      const err = failsWith("private_label_get_quote", {
        id: "quote_nonexistent_00000000",
        client_id: "client_alpha",
      });
      expect(err.code).toBe(-32004);
    });
  });

  // =========================================================================
  // Suite 5: Artwork, Preflight & Proof Approvals (F12–F15)
  // =========================================================================
  describe("Suite 5: Artwork, Preflight & Proof Approvals", () => {
    let proofProjectId: string;
    let designVersionId: string;

    beforeAll(() => {
      const proj = call<PublicProjectDto>("private_label_create_project", {
        client_id: "client_alpha",
        title: "Proof Studio Project",
      });
      proofProjectId = proj.id;
    });

    it("5.1: private_label_validate_preflight evaluates resolution and executable script sanitization", () => {
      // Valid high-resolution asset
      const validPreflight = call<{ valid: boolean; status: string; dpi: number }>(
        "private_label_validate_preflight",
        { dpi: 300, width_px: 2400, target_width_mm: 200 }
      );
      expect(validPreflight.valid).toBe(true);
      expect(validPreflight.status).toBe("approved");

      // Inadequate resolution (72 DPI)
      const lowDpiPreflight = call<{ valid: boolean; errors: string[] }>(
        "private_label_validate_preflight",
        { dpi: 72 }
      );
      expect(lowDpiPreflight.valid).toBe(false);
      expect(lowDpiPreflight.errors[0]).toContain("300 DPI");

      // Malicious SVG payload with script tag
      const scriptPreflight = call<{ valid: boolean; errors: string[] }>(
        "private_label_validate_preflight",
        { svg_content: "<svg><script>alert('xss')</script></svg>" }
      );
      expect(scriptPreflight.valid).toBe(false);
      expect(scriptPreflight.errors[0]).toContain("executable script tags");
    });

    it("5.2: private_label_generate_preview creates versioned DesignVersion with scene JSON", () => {
      const version = call<PublicDesignVersionDto>("private_label_generate_preview", {
        project_id: proofProjectId,
        scene_data: { front_label: { x: 50, y: 100, width: 300, height: 200 } },
        client_id: "client_alpha",
      });
      expect(version.id).toMatch(/^des_/);
      expect(version.version_number).toBe(1);
      expect(version.is_locked).toBe(false);
      designVersionId = version.id;
    });

    it("5.3: private_label_approve_proof legally approves proof revision and locks design version", () => {
      const approval = call<PublicApprovalEventDto & { design_version: PublicDesignVersionDto }>(
        "private_label_approve_proof",
        {
          proof_id: prepareProofForApproval(designVersionId),
          expected_revision: 1,
          disclaimer_accepted: true,
          signer_name: "Alexander Director",
          client_id: "client_alpha",
        }
      );
      expect(approval.action).toBe("customer_approved");
      expect(approval.signer_name).toBe("Alexander Director");
      expect(approval.design_version.is_locked).toBe(true);
    });

    it("5.4: private_label_reject_proof records change request on draft proof", () => {
      // Create new draft version for rejection test
      const v2 = call<PublicDesignVersionDto>("private_label_generate_preview", {
        project_id: proofProjectId,
        scene_data: { front_label: { color: "#ff0000" } },
        client_id: "client_alpha",
      });

      const rejection = call<PublicApprovalEventDto>("private_label_reject_proof", {
        proof_id: prepareProofForApproval(v2.id),
        expected_revision: 2,
        reason: "CMYK color saturation too intense on Kraft substrate",
        client_id: "client_alpha",
      });
      expect(["customer_rejected", "rejected"]).toContain(rejection.action);
    });
  });

  // =========================================================================
  // Suite 6: Samples, Orders & Production Release Gates (F16–F19)
  // =========================================================================
  describe("Suite 6: Samples, Orders & Production Release Gates", () => {
    let orderId: string;
    let releasedJobId: string;

    it("6.1: private_label_order_sample creates physical sample order with Indian PIN validation", () => {
      const sample = call<PublicSampleOrderDto>("private_label_order_sample", {
        client_id: "client_alpha",
        sample_type: "tea_kit",
        quantity: 2,
        shipping_address: {
          line1: "123 Tea Plantation Rd",
          city: "Siliguri",
          state: "West Bengal",
          pincode: "734001",
        },
      });
      expect(sample.id).toMatch(/^samp_/);
      expect(sample.sample_number).toMatch(/^PL-SMP-/);
      expect(sample.status).toBe("requested");
    });

    it("6.2: private_label_convert_quote_to_order converts accepted quote to production order", () => {
      // Create and accept fresh quote
      const proj = call<PublicProjectDto>("private_label_create_project", {
        client_id: "client_alpha",
        title: "Order Conversion Project",
        items: [
          {
            packaging_variant_id: "pack_pouch_standup_250g_01",
            tea_option_id: "tea_darjeeling_first_flush",
            print_method_id: "pm_paper_label",
            target_quantity: 1000,
          },
        ],
      });
      const quote = call<PublicQuoteWithItemsDto>("private_label_create_quote", {
        project_id: proj.id,
        client_id: "client_alpha",
      });
      call("private_label_accept_quote", {
        id: quote.id,
        client_id: "client_alpha",
      });

      const order = call<PublicProductionOrderDto>("private_label_convert_quote_to_order", {
        quote_id: quote.id,
        client_id: "client_alpha",
        idempotency_key: `idem_${Date.now()}`,
      });
      expect(order.id).toMatch(/^order_/);
      expect(order.order_number).toMatch(/^PL-ORD-/);
      expect(["pending_deposit", "deposit_pending"]).toContain(order.status);
      orderId = order.id;
    });

    it("6.3: private_label_release_job validates hard gates and releases job with 7 QC milestones", () => {
      const db = getDb();
      // Prepare order: mark deposit paid and attach approved proof
      db.prepare("UPDATE pl_orders SET status = 'deposit_paid' WHERE id = ?").run(orderId);

      // Create and approve proof linked to order's quote
      const orderRow = db.prepare("SELECT quote_id FROM pl_orders WHERE id = ?").get(orderId) as { quote_id: string };
      const quoteRow = db.prepare("SELECT project_id FROM pl_quotes WHERE id = ?").get(orderRow.quote_id) as { project_id: string };
      const proof = call<PublicDesignVersionDto>("private_label_generate_preview", {
        project_id: quoteRow.project_id,
        scene_data: { certified: true },
        client_id: "client_alpha",
      });
      call("private_label_approve_proof", {
        proof_id: prepareProofForApproval(proof.id),
        expected_revision: proof.version_number,
        disclaimer_accepted: true,
        client_id: "client_alpha",
      });

      const job = call<{ id: string; job_number: string; status: string }>("private_label_release_job", {
        order_id: orderId,
        target_completion_date: "2026-12-01",
      });
      expect(job.id).toMatch(/^job_/);
      expect(job.job_number).toMatch(/^PL-JOB-/);
      expect(job.status).toBe("scheduled");
      releasedJobId = job.id;

      // Verify all 7 QC milestones provisioned
      const milestones = db
        .prepare("SELECT * FROM pl_qc_milestones WHERE job_id = ? ORDER BY created_at ASC")
        .all(job.id);
      expect(milestones.length).toBe(7);
    });

    it("6.4: private_label_record_qc records inspection milestone status and inspector name", () => {
      const qc = call<PublicQCMilestoneDto>("private_label_record_qc", {
        job_id: releasedJobId,
        stage: "raw_material_incoming",
        status: "passed",
        inspector_name: "Chief Inspector Sharma",
        notes: "Moisture content 4.2% within acceptable FSSAI parameters",
      });
      expect(qc.stage).toBe("raw_material");
      expect(qc.status).toBe("passed");
      expect(qc.inspector_name).toBe("Chief Inspector Sharma");
    });
  });

  // =========================================================================
  // Suite 7: Operations & Audit History (F20)
  // =========================================================================
  describe("Suite 7: Operations & Audit History", () => {
    it("7.1: private_label_get_audit_history retrieves chronological immutable trail with actor_type = mcp", () => {
      // Create project to generate deterministic audit trail
      const proj = call<PublicProjectDto>("private_label_create_project", {
        client_id: "client_alpha",
        title: "Audit History Test Project",
      });

      const historyRes = call<{ history: AuditRecord[]; total: number }>(
        "private_label_get_audit_history",
        {
          entity_type: "project",
          entity_id: proj.id,
        }
      );
      expect(historyRes.total).toBeGreaterThanOrEqual(1);
      expect(historyRes.history[0]?.actor_type).toBe("mcp");
      expect(historyRes.history[0]?.actor_id).toBe("mcp-agent");
    });

    it("7.2: private_label_report_dashboard returns operational overview metrics", () => {
      const dashboard = call<{
        active_projects: number;
        open_quotes: number;
        pending_proofs: number;
        in_production_jobs: number;
      }>("private_label_report_dashboard");
      expect(typeof dashboard.active_projects).toBe("number");
      expect(typeof dashboard.open_quotes).toBe("number");
      expect(typeof dashboard.pending_proofs).toBe("number");
      expect(typeof dashboard.in_production_jobs).toBe("number");
    });
  });

  // =========================================================================
  // Suite 8: Protocol Boundary & Parameter Validation (-32602 & -32601)
  // =========================================================================
  describe("Suite 8: Protocol Boundary & Parameter Validation", () => {
    it("8.1: missing required arguments throws -32602 (Invalid Params)", () => {
      // Missing expected_revision on save project
      const errSave = failsWith("private_label_save_project", { id: "proj_test_001" });
      expect(errSave.code).toBe(-32602);

      // Missing order_id on release job
      const errRelease = failsWith("private_label_release_job", {});
      expect(errRelease.code).toBe(-32602);
    });

    it("8.2: out-of-bounds or negative numeric values throw -32602 before service execution", () => {
      // Negative quantity in MOQ calculation
      const errMoq = failsWith("private_label_calculate_moq", {
        packaging_variant_id: "pack_pouch_standup_250g_01",
        quantity: -10,
      });
      expect(errMoq.code).toBe(-32602);

      // Negative expected_revision in project update
      const errRev = failsWith("private_label_save_project", {
        id: "proj_test_001",
        expected_revision: -1,
      });
      expect(errRev.code).toBe(-32602);
    });

    it("8.3: proof sign-off without disclaimer_accepted throws -32602", () => {
      const errProof = failsWith("private_label_approve_proof", {
        proof_id: "des_test_001",
        disclaimer_accepted: false,
      });
      expect(errProof.code).toBe(-32602);
    });

    it("8.4: invalid QC stage name throws -32602", () => {
      const errQc = failsWith("private_label_record_qc", {
        job_id: "job_test_001",
        stage: "invalid_unrecognized_stage",
        status: "passed",
      });
      expect(errQc.code).toBe(-32602);
    });

    it("8.5: unknown MCP tool invocation throws -32601 (Method Not Found)", () => {
      const errUnknown = failsWith("private_label_nonexistent_tool_xyz", {});
      expect(errUnknown.code).toBe(-32601);
    });
  });

  // =========================================================================
  // Suite 9: Compare-And-Swap (CAS) Concurrency & Revision Conflict (-32009)
  // =========================================================================
  describe("Suite 9: Compare-And-Swap (CAS) Concurrency & Revision Conflict", () => {
    let casProjectId: string;

    beforeAll(() => {
      const proj = call<PublicProjectDto>("private_label_create_project", {
        client_id: "client_alpha",
        title: "CAS Conflict Baseline Project",
      });
      casProjectId = proj.id;
    });

    it("9.1: stale expected_revision on project update throws -32009 without modifying state", () => {
      // Stale revision 999 against current revision 1
      const err = failsWith("private_label_save_project", {
        id: casProjectId,
        expected_revision: 999,
        title: "Should Not Apply",
        client_id: "client_alpha",
      });
      expect(err.code).toBe(-32009);

      // Confirm project remains unmodified
      const proj = call<PublicProjectDto>("private_label_get_project", {
        id: casProjectId,
        client_id: "client_alpha",
      });
      expect(proj.revision).toBe(1);
      expect(proj.title).toBe("CAS Conflict Baseline Project");
    });

    it("9.2: stale expected_revision on proof approval throws -32009", () => {
      const proof = call<PublicDesignVersionDto>("private_label_generate_preview", {
        project_id: casProjectId,
        scene_data: { revision: 1 },
        client_id: "client_alpha",
      });

      const err = failsWith("private_label_approve_proof", {
        proof_id: prepareProofForApproval(proof.id),
        expected_revision: 999,
        disclaimer_accepted: true,
        client_id: "client_alpha",
      });
      expect(err.code).toBe(-32009);
    });

    it("9.3: stale expected_revision on quote acceptance throws -32009", () => {
      const quote = call<PublicQuoteWithItemsDto>("private_label_create_quote", {
        project_id: casProjectId,
        client_id: "client_alpha",
      });

      const err = failsWith("private_label_accept_quote", {
        id: quote.id,
        expected_revision: 999,
        client_id: "client_alpha",
      });
      expect(err.code).toBe(-32009);
    });

    it("9.4: error -32009 message preserves current vs expected revision conflict diagnostic", () => {
      // expected_revision: 0 against current revision: 1
      const err = failsWith("private_label_save_project", {
        id: casProjectId,
        expected_revision: 0,
        title: "Conflict Inspection",
        client_id: "client_alpha",
      });
      expect(err.code).toBe(-32009);
      expect(err.message).toMatch(/current revision: \d+, expected: 0/i);
    });
  });

  // =========================================================================
  // Suite 10: Manufacturing Gate Blocker Errors (-32009)
  // =========================================================================
  describe("Suite 10: Manufacturing Gate Blocker Errors", () => {
    let gateOrderId: string;

    beforeAll(() => {
      const proj = call<PublicProjectDto>("private_label_create_project", {
        client_id: "client_alpha",
        title: "Gate Test Order Project",
        items: [
          {
            packaging_variant_id: "pack_pouch_standup_250g_01",
            tea_option_id: "tea_darjeeling_first_flush",
            target_quantity: 1000,
          },
        ],
      });
      const quote = call<PublicQuoteWithItemsDto>("private_label_create_quote", {
        project_id: proj.id,
        client_id: "client_alpha",
      });
      call("private_label_accept_quote", { id: quote.id, client_id: "client_alpha" });
      const order = call<PublicProductionOrderDto>("private_label_convert_quote_to_order", {
        quote_id: quote.id,
        client_id: "client_alpha",
      });
      gateOrderId = order.id;
    });

    it("10.1: release job on order without approved proof throws -32009", () => {
      // Mark deposit paid, but leave proof unapproved
      const db = getDb();
      db.prepare("UPDATE pl_orders SET status = 'deposit_paid' WHERE id = ?").run(gateOrderId);

      const err = failsWith("private_label_release_job", { order_id: gateOrderId });
      expect(err.code).toBe(-32009);
      expect(err.message).toMatch(/proof approval/i);
    });

    it("10.2: release job on order without deposit paid throws -32009", () => {
      const db = getDb();
      // Revert status to pending_deposit
      db.prepare("UPDATE pl_orders SET status = 'pending_deposit' WHERE id = ?").run(gateOrderId);

      const err = failsWith("private_label_release_job", { order_id: gateOrderId });
      expect(err.code).toBe(-32009);
      expect(err.message).toMatch(/deposit_paid/i);
    });

    it("10.3: update QC milestone with fill weight variance > 1.5% throws -32009", () => {
      // Release a job with emergency supervisor override
      const job = call<{ id: string }>("private_label_release_job", {
        order_id: gateOrderId,
        override_justification: "Director signed emergency authorization",
      });

      // Target 100g, recorded 102.5g (variance 2.5% > 1.5% FSSAI tolerance)
      const err = failsWith("private_label_record_qc", {
        job_id: job.id,
        stage: "fill_weight",
        status: "passed",
        target_weight_g: 100,
        recorded_weight_g: 102.5,
      });
      expect(err.code).toBe(-32009);
      expect(err.message).toMatch(/FSSAI/i);
    });

    it("10.4: approving an already approved proof revision throws -32009", () => {
      const proj = call<PublicProjectDto>("private_label_create_project", {
        client_id: "client_alpha",
        title: "Duplicate Approval Test",
      });
      const proof = call<PublicDesignVersionDto>("private_label_generate_preview", {
        project_id: proj.id,
        scene_data: { test: true },
        client_id: "client_alpha",
      });

      // First approval succeeds
      call("private_label_approve_proof", {
        proof_id: prepareProofForApproval(proof.id),
        expected_revision: 1,
        disclaimer_accepted: true,
        client_id: "client_alpha",
      });

      // Second approval attempt fails with -32009
      const err = failsWith("private_label_approve_proof", {
        proof_id: prepareProofForApproval(proof.id),
        expected_revision: 1,
        disclaimer_accepted: true,
        client_id: "client_alpha",
      });
      expect(err.code).toBe(-32009);
      expect(err.message).toMatch(/already approved and locked/i);
    });
  });

  // =========================================================================
  // Suite 11: Multi-Tenant Isolation & Anti-Enumeration (-32004)
  // =========================================================================
  describe("Suite 11: Multi-Tenant Isolation & Anti-Enumeration", () => {
    let tenantAProjectId: string;
    let tenantAQuoteId: string;
    let tenantAProofId: string;

    beforeAll(() => {
      const proj = call<PublicProjectDto>("private_label_create_project", {
        client_id: "client_alpha",
        title: "Confidential Project Alpha",
      });
      tenantAProjectId = proj.id;

      const quote = call<PublicQuoteWithItemsDto>("private_label_create_quote", {
        project_id: tenantAProjectId,
        client_id: "client_alpha",
      });
      tenantAQuoteId = quote.id;

      const proof = call<PublicDesignVersionDto>("private_label_generate_preview", {
        project_id: tenantAProjectId,
        scene_data: { proprietary: true },
        client_id: "client_alpha",
      });
      tenantAProofId = proof.id;
    });

    it("11.1: cross-tenant project inspect returns -32004 (Not Found)", () => {
      const err = failsWith("private_label_get_project", {
        id: tenantAProjectId,
        client_id: "client_beta",
      });
      expect(err.code).toBe(-32004);
    });

    it("11.2: cross-tenant project update returns -32004", () => {
      const err = failsWith("private_label_save_project", {
        id: tenantAProjectId,
        expected_revision: 1,
        title: "Intruder Update",
        client_id: "client_beta",
      });
      expect(err.code).toBe(-32004);
    });

    it("11.3: cross-tenant quote inspect returns -32004", () => {
      const err = failsWith("private_label_get_quote", {
        id: tenantAQuoteId,
        client_id: "client_beta",
      });
      expect(err.code).toBe(-32004);
    });

    it("11.4: cross-tenant proof approval returns -32004", () => {
      const err = failsWith("private_label_approve_proof", {
        proof_id: prepareProofForApproval(tenantAProofId),
        expected_revision: 1,
        disclaimer_accepted: true,
        client_id: "client_beta",
      });
      expect(err.code).toBe(-32004);
    });

    it("11.5: zero data leakage on non-existent or cross-tenant query", () => {
      const nonExistentErr = failsWith("private_label_get_project", {
        id: "proj_fictional_random_9999",
      });
      expect(nonExistentErr.code).toBe(-32004);
      expect(nonExistentErr.message).not.toContain("Confidential");
    });
  });

  // =========================================================================
  // Suite 12: Race Condition Stress Testing via MCP Calls
  // =========================================================================
  describe("Suite 12: Race Condition Stress Testing via MCP Calls", () => {
    it("12.1: concurrent MCP project updates (Promise.allSettled) yields exactly one success and one -32009", async () => {
      const proj = call<PublicProjectDto>("private_label_create_project", {
        client_id: "client_alpha",
        title: "Race Condition Project",
      });
      expect(proj.revision).toBe(1);

      const opA = () =>
        new Promise<{ success: boolean; result?: unknown; error?: unknown }>((resolve) => {
          try {
            const res = call("private_label_save_project", {
              id: proj.id,
              expected_revision: 1,
              title: "Branch A Winner",
              client_id: "client_alpha",
            });
            resolve({ success: true, result: res });
          } catch (error) {
            resolve({ success: false, error });
          }
        });

      const opB = () =>
        new Promise<{ success: boolean; result?: unknown; error?: unknown }>((resolve) => {
          try {
            const res = call("private_label_save_project", {
              id: proj.id,
              expected_revision: 1,
              title: "Branch B Winner",
              client_id: "client_alpha",
            });
            resolve({ success: true, result: res });
          } catch (error) {
            resolve({ success: false, error });
          }
        });

      const [res1, res2] = await Promise.all([opA(), opB()]);
      const results = [res1, res2];
      const successes = results.filter((r) => r.success);
      const failures = results.filter((r) => !r.success);

      expect(successes).toHaveLength(1);
      expect(failures).toHaveLength(1);
      expect((failures[0]?.error as McpError).code).toBe(-32009);

      // Verify project is now at revision 2
      const finalProj = call<PublicProjectDto>("private_label_get_project", {
        id: proj.id,
        client_id: "client_alpha",
      });
      expect(finalProj.revision).toBe(2);
    });

    it("12.2: cross-channel concurrency race: Admin service update causes subsequent MCP update to fail with -32009", () => {
      const proj = call<PublicProjectDto>("private_label_create_project", {
        client_id: "client_alpha",
        title: "Cross-Channel Race",
      });

      // Admin directly advances project to revision 2
      PrivateLabelService.updateProjectDraft(
        proj.id,
        1,
        { title: "Admin Modified" },
        { actor_type: "admin", actor_id: "admin-root" }
      );

      // MCP agent calls with stale expected_revision: 1
      const err = failsWith("private_label_save_project", {
        id: proj.id,
        expected_revision: 1,
        title: "MCP Stale Attempt",
        client_id: "client_alpha",
      });
      expect(err.code).toBe(-32009);
    });

    it("12.3: in-transaction audit attribution: all MCP mutations write actor_type = 'mcp' and actor_id = 'mcp-agent'", () => {
      const proj = call<PublicProjectDto>("private_label_create_project", {
        client_id: "client_alpha",
        title: "Audit Attribution Test",
      });

      call("private_label_save_project", {
        id: proj.id,
        expected_revision: 1,
        title: "Audit Attribution Test Modified",
        client_id: "client_alpha",
      });

      const db = getDb();
      const records = db
        .prepare("SELECT * FROM pl_audit WHERE entity_id = ? ORDER BY revision ASC")
        .all(proj.id) as AuditRecord[];

      expect(records.length).toBeGreaterThanOrEqual(2);
      for (const rec of records) {
        expect(rec.actor_type).toBe("mcp");
        expect(rec.actor_id).toBe("mcp-agent");
      }
    });
  });
});
