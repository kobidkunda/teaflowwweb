import { prepareProofForApproval } from "./private-label-proof-fixture";
/**
 * TeaFloww Private Label Studio — Milestone M7 Empirical Adversarial Challenger Test Suite
 * Challenger: private_label_m7_challenger_2 (Role: Multi-Tenant Isolation & Fuzzing Stress Tester)
 * File: tests/unit/private-label-m7-challenger-2.test.ts
 *
 * Scope: Milestone M7 (MCP Tool Parity — Multi-Tenant Isolation, Parameter Fuzzing, Manufacturing Release Gates)
 *
 * Test Suites:
 * 1. Suite 1: Multi-Tenant Isolation Attacks & Anti-Enumeration (-32004)
 *    - Cross-tenant access attacks against projects, quotes, proofs, orders across Tenant A, B, C
 *    - Verification of 100% anti-enumeration (-32004) with zero sensitive metadata leakage
 *    - Mutation immunity: Tenant B cannot alter Tenant A's projects, quotes, or proofs
 * 2. Suite 2: Adversarial Parameter Fuzzing & Protocol Boundary Defense (-32602, -32601)
 *    - Negative CAS revisions (-1, -100, -9999) across all mutation tools -> -32602
 *    - Missing required parameters across canonical & companion tools -> -32602
 *    - Malicious string injection, SQL payloads, NaN, Infinity, negative quantities -> -32602
 *    - Unknown and invalid tool names -> -32601
 * 3. Suite 3: Manufacturing Release Gate Enforcement (-32009 & `release_blocked` Audit Trail)
 *    - Unapproved proof + unpaid deposit -> -32009 & durable `release_blocked` audit log in pl_audit
 *    - Paid deposit + unapproved proof -> -32009 & audit log
 *    - Approved proof + unpaid deposit -> -32009 & audit log
 *    - Emergency supervisor override bypass -> succeeds, creates 7 QC milestones, records justification
 *    - Fully compliant release (both gates satisfied) -> succeeds cleanly
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { rmSync } from "node:fs";
import {
  dispatchToolCall,
  McpError,
} from "@/lib/mcp";
import { PrivateLabelService } from "@/lib/private-label/service";
import { getDb } from "@/lib/db";
import type {
  PublicQuoteWithItemsDto,
} from "@/lib/private-label/types";
import type {
  PublicProjectDto,
  PublicDesignVersionDto,
  PublicProductionOrderDto,
  PublicProductionJobDto,
} from "@/lib/private-label/public-dto";

// ----------------------------------------------------------------------------
// Isolated Test Database Setup
// ----------------------------------------------------------------------------
const TEST_DB = path.join(
  tmpdir(),
  `pl-m7-challenger2-${process.pid}-${Date.now()}.sqlite`
);
process.env.DATABASE_PATH = TEST_DB;
(process.env as Record<string, string | undefined>).NODE_ENV = "test";

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

describe("Milestone M7 Challenger 2: Multi-Tenant Isolation & Fuzzing Stress Suite", () => {
  beforeAll(() => {
    // 1. Run migrations synchronously on clean temp SQLite database
    execFileSync(process.execPath, ["scripts/migrate.mjs"], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_PATH: TEST_DB },
      stdio: "ignore",
    });

    const db = getDb();
    // 2. Seed catalogue primitives
    PrivateLabelService.seedInitialCatalog();

    // 3. Seed 3 distinct tenants: Tenant A (Alpha), Tenant B (Beta), Tenant C (Gamma Adversary)
    db.prepare(`
      INSERT OR IGNORE INTO customers (id, email, name)
      VALUES 
        ('client_alpha', 'alpha@teafloww.com', 'Alpha Organic Co'),
        ('client_beta',  'beta@teafloww.com',  'Beta Global Blends'),
        ('client_gamma', 'gamma@attacker.com', 'Gamma Adversary Labs')
    `).run();

    db.prepare(`
      INSERT OR IGNORE INTO pl_clients (id, customer_id, company_name, contact_name, contact_email)
      VALUES
        ('client_alpha', 'client_alpha', 'Alpha Organic Co', 'Alice Alpha', 'alpha@teafloww.com'),
        ('client_beta',  'client_beta',  'Beta Global Blends', 'Bob Beta',   'beta@teafloww.com'),
        ('client_gamma', 'client_gamma', 'Gamma Adversary Labs', 'G. Attacker', 'gamma@attacker.com')
    `).run();

    // 4. Seed primary packaging variant
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

    // 5. Seed primary tea option
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

    // 6. Seed print compatibility
    db.prepare(`
      INSERT OR IGNORE INTO pl_packaging_compatibility (id, packaging_variant_id, print_method_id, is_supported)
      VALUES ('compat_pouch_paper_label', 'pack_pouch_standup_250g_01', 'pm_paper_label', 1)
    `).run();

    // 7. Seed active price book tiers
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
  // Suite 1: Multi-Tenant Isolation Attacks & Anti-Enumeration (-32004)
  // =========================================================================
  describe("Suite 1: Multi-Tenant Isolation Attacks & Anti-Enumeration (-32004)", () => {
    let tenantAProjectId: string;
    let tenantAQuoteId: string;
    let tenantAProofId: string;
    let tenantAOrderId: string;

    const SECRET_ALPHA_TITLE = "Alpha Sacred Himalayan Silver Needle Reserve";
    const SECRET_ALPHA_NOTES = "CONFIDENTIAL_ORGANIC_SOURCING_CERT_987654";
    const SECRET_ALPHA_ADDRESS = "Plot 77, Alpha Estate, Kurseong, Darjeeling 734203";

    beforeAll(() => {
      // 1. Create Tenant A Project
      const proj = call<PublicProjectDto>("private_label_create_project", {
        client_id: "client_alpha",
        customer_id: "client_alpha",
        title: SECRET_ALPHA_TITLE,
        notes: SECRET_ALPHA_NOTES,
        items: [
          {
            packaging_variant_id: "pack_pouch_standup_250g_01",
            tea_option_id: "tea_darjeeling_first_flush",
            print_method_id: "pm_paper_label",
            target_quantity: 1000,
          },
        ],
      });
      tenantAProjectId = proj.id;

      // 2. Create Tenant A Quote
      const quote = call<PublicQuoteWithItemsDto>("private_label_create_quote", {
        project_id: tenantAProjectId,
        client_id: "client_alpha",
        customer_id: "client_alpha",
      });
      tenantAQuoteId = quote.id;

      // 3. Create Tenant A Proof Revision
      const proof = call<PublicDesignVersionDto>("private_label_generate_preview", {
        project_id: tenantAProjectId,
        client_id: "client_alpha",
        customer_id: "client_alpha",
        scene_data: { proprietary_cmyk: "Alpha_CMYK_Gold_Pantone_871" },
      });
      tenantAProofId = proof.id;

      // 4. Accept Quote & Convert to Order for Tenant A
      call("private_label_accept_quote", {
        id: tenantAQuoteId,
        client_id: "client_alpha",
        customer_id: "client_alpha",
        signer_name: "Alice Alpha",
      });

      const order = call<PublicProductionOrderDto>("private_label_convert_quote_to_order", {
        quote_id: tenantAQuoteId,
        client_id: "client_alpha",
        customer_id: "client_alpha",
        shipping_address: {
          line1: SECRET_ALPHA_ADDRESS,
          city: "Kurseong",
          state: "West Bengal",
          pincode: "734203",
        },
      });
      tenantAOrderId = order.id;
    });

    // --- 1.1 private_label_get_project Isolation ---
    it("1.1: private_label_get_project rejects Tenant B, Tenant C, and unauthenticated callers with -32004", () => {
      // Tenant B attack via client_id
      const errB = failsWith("private_label_get_project", {
        id: tenantAProjectId,
        client_id: "client_beta",
      });
      expect(errB.code).toBe(-32004);

      // Tenant B attack via customer_id
      const errBCust = failsWith("private_label_get_project", {
        id: tenantAProjectId,
        customer_id: "client_beta",
      });
      expect(errBCust.code).toBe(-32004);

      // Tenant C (Adversary) attack via client_id
      const errC = failsWith("private_label_get_project", {
        id: tenantAProjectId,
        client_id: "client_gamma",
      });
      expect(errC.code).toBe(-32004);

      // Attacker queries non-existent ID
      const errGhost = failsWith("private_label_get_project", {
        id: "proj_fictional_random_99999",
        client_id: "client_beta",
      });
      expect(errGhost.code).toBe(-32004);

      // Anti-enumeration assertion: error message format must be identical for cross-tenant vs ghost ID
      expect(errB.message).toBe(errGhost.message.replace("proj_fictional_random_99999", tenantAProjectId));

      // Zero sensitive data leakage
      expect(errB.message).not.toContain(SECRET_ALPHA_TITLE);
      expect(errB.message).not.toContain(SECRET_ALPHA_NOTES);
      expect(errB.message).not.toContain("client_alpha");
    });

    // --- 1.2 private_label_save_project Isolation ---
    it("1.2: private_label_save_project rejects cross-tenant mutations with -32004 and leaves state untouched", () => {
      const db = getDb();
      const beforeRow = db.prepare("SELECT * FROM pl_projects WHERE id = ?").get(tenantAProjectId) as {
        revision: number;
        title: string;
        notes: string;
      };

      // Attacker attempts to hijack project title and notes
      const err = failsWith("private_label_save_project", {
        id: tenantAProjectId,
        expected_revision: beforeRow.revision,
        title: "Hacked by Tenant Beta",
        notes: "Tampered notes",
        client_id: "client_beta",
      });
      expect(err.code).toBe(-32004);

      // Attacker C attempts via customer_id
      const errC = failsWith("private_label_save_project", {
        id: tenantAProjectId,
        expected_revision: beforeRow.revision,
        title: "Hacked by Tenant Gamma",
        customer_id: "client_gamma",
      });
      expect(errC.code).toBe(-32004);

      // Assert project in database remained 100% unaltered
      const afterRow = db.prepare("SELECT * FROM pl_projects WHERE id = ?").get(tenantAProjectId) as {
        revision: number;
        title: string;
        notes: string;
      };
      expect(afterRow.revision).toBe(beforeRow.revision);
      expect(afterRow.title).toBe(SECRET_ALPHA_TITLE);
      expect(afterRow.notes).toBe(SECRET_ALPHA_NOTES);
    });

    // --- 1.3 private_label_get_quote Isolation ---
    it("1.3: private_label_get_quote rejects cross-tenant inspection with -32004 without leaking commercial rates", () => {
      const errB = failsWith("private_label_get_quote", {
        id: tenantAQuoteId,
        client_id: "client_beta",
      });
      expect(errB.code).toBe(-32004);

      const errC = failsWith("private_label_get_quote", {
        id: tenantAQuoteId,
        customer_id: "client_gamma",
      });
      expect(errC.code).toBe(-32004);

      // Ensure no price numbers or terms appear in error
      expect(errB.message).not.toContain("paise");
      expect(errB.message).not.toContain("client_alpha");
      expect(errB.message).not.toContain(SECRET_ALPHA_TITLE);
    });

    // --- 1.4 private_label_accept_quote Isolation ---
    it("1.4: private_label_accept_quote rejects cross-tenant acceptance with -32004 and leaves quote intact", () => {
      // Create a fresh quote for Tenant A to test acceptance hijacking
      const freshQuote = call<PublicQuoteWithItemsDto>("private_label_create_quote", {
        project_id: tenantAProjectId,
        client_id: "client_alpha",
      });

      const errB = failsWith("private_label_accept_quote", {
        id: freshQuote.id,
        client_id: "client_beta",
        signer_name: "Attacker Bob",
      });
      expect(errB.code).toBe(-32004);

      const errC = failsWith("private_label_accept_quote", {
        id: freshQuote.id,
        customer_id: "client_gamma",
        signer_name: "Attacker Gamma",
      });
      expect(errC.code).toBe(-32004);

      // Verify in DB that quote remains in draft / presented / estimated state
      const db = getDb();
      const quoteRow = db.prepare("SELECT * FROM pl_quotes WHERE id = ?").get(freshQuote.id) as {
        status: string;
        accepted_at: string | null;
      };
      expect(["draft", "presented", "estimated"]).toContain(quoteRow.status);
      expect(quoteRow.accepted_at).toBeNull();
    });

    // --- 1.5 private_label_approve_proof Isolation ---
    it("1.5: private_label_approve_proof rejects cross-tenant approval with -32004 and keeps proof unapproved", () => {
      const errB = failsWith("private_label_approve_proof", {
        proof_id: prepareProofForApproval(tenantAProofId),
        expected_revision: 1,
        disclaimer_accepted: true,
        client_id: "client_beta",
        signer_name: "Intruder Bob",
      });
      expect(errB.code).toBe(-32004);

      const errC = failsWith("private_label_approve_proof", {
        proof_id: prepareProofForApproval(tenantAProofId),
        expected_revision: 1,
        disclaimer_accepted: true,
        customer_id: "client_gamma",
        signer_name: "Intruder Gamma",
      });
      expect(errC.code).toBe(-32004);

      // Verify in DB that proof is neither locked nor approved
      const db = getDb();
      const proofRow = db.prepare("SELECT * FROM pl_design_versions WHERE id = ?").get(tenantAProofId) as {
        status: string;
        is_locked: number;
      };
      expect(proofRow.status).not.toBe("customer_approved");
      expect(proofRow.is_locked).toBe(0);

      // Ensure no approval events logged
      const approvals = db
        .prepare("SELECT * FROM pl_approval_events WHERE design_version_id = ?")
        .all(tenantAProofId);
      expect(approvals.length).toBe(0);
    });

    // --- 1.6 private_label_get_order Isolation ---
    it("1.6: private_label_get_order rejects cross-tenant inspection with -32004 with zero PII/address leakage", () => {
      const errB = failsWith("private_label_get_order", {
        id: tenantAOrderId,
        client_id: "client_beta",
      });
      expect(errB.code).toBe(-32004);

      const errC = failsWith("private_label_get_order", {
        id: tenantAOrderId,
        customer_id: "client_gamma",
      });
      expect(errC.code).toBe(-32004);

      // Anti-enumeration: test non-existent order
      const errGhost = failsWith("private_label_get_order", {
        id: "order_ghost_nonexistent_9999",
        client_id: "client_beta",
      });
      expect(errGhost.code).toBe(-32004);

      // Verify zero sensitive data leakage: shipping address, customer name, postal code
      expect(errB.message).not.toContain(SECRET_ALPHA_ADDRESS);
      expect(errB.message).not.toContain("Kurseong");
      expect(errB.message).not.toContain("734203");
      expect(errB.message).not.toContain("Alice Alpha");
    });

    // --- 1.7 Companion Tool Cross-Tenant Attacks ---
    it("1.7: companion tools (archive_project, reject_proof, convert_quote_to_order) enforce anti-enumeration -32004", () => {
      // Cross-tenant archive
      const errArchive = failsWith("private_label_archive_project", {
        id: tenantAProjectId,
        expected_revision: 1,
        client_id: "client_beta",
      });
      expect(errArchive.code).toBe(-32004);

      // Cross-tenant proof rejection
      const errReject = failsWith("private_label_reject_proof", {
        proof_id: prepareProofForApproval(tenantAProofId),
        expected_revision: 1,
        reason: "Adversarial rejection attempt",
        client_id: "client_beta",
      });
      expect(errReject.code).toBe(-32004);

      // Cross-tenant convert quote to order
      const errConvert = failsWith("private_label_convert_quote_to_order", {
        quote_id: tenantAQuoteId,
        client_id: "client_beta",
      });
      expect(errConvert.code).toBe(-32004);
    });

    // --- 1.8 Cross-Tenant Creation Attacks (create_quote, generate_preview) ---
    it("1.8: cross-tenant creation attacks (create_quote, generate_preview) on foreign project return -32004", () => {
      // Tenant B tries to create quote on Tenant A's project
      const errCreateQuote = failsWith("private_label_create_quote", {
        project_id: tenantAProjectId,
        client_id: "client_beta",
      });
      expect(errCreateQuote.code).toBe(-32004);

      // Tenant C tries to generate preview on Tenant A's project
      const errPreview = failsWith("private_label_generate_preview", {
        project_id: tenantAProjectId,
        client_id: "client_gamma",
        scene_data: { attacker: true },
      });
      expect(errPreview.code).toBe(-32004);
    });
  });

  // =========================================================================
  // Suite 2: Adversarial Parameter Fuzzing & Protocol Boundary Defense (-32602, -32601)
  // =========================================================================
  describe("Suite 2: Adversarial Parameter Fuzzing & Protocol Boundary Defense (-32602, -32601)", () => {
    let fuzzProjectId: string;
    let fuzzQuoteId: string;
    let fuzzProofId: string;

    beforeAll(() => {
      const proj = call<PublicProjectDto>("private_label_create_project", {
        client_id: "client_alpha",
        title: "Fuzz Target Project",
      });
      fuzzProjectId = proj.id;

      const quote = call<PublicQuoteWithItemsDto>("private_label_create_quote", {
        project_id: fuzzProjectId,
        client_id: "client_alpha",
      });
      fuzzQuoteId = quote.id;

      const proof = call<PublicDesignVersionDto>("private_label_generate_preview", {
        project_id: fuzzProjectId,
        client_id: "client_alpha",
        scene_data: { fuzz: true },
      });
      fuzzProofId = proof.id;
    });

    // --- 2.1 Negative Revision Fuzzing ---
    it("2.1: negative revisions (-1, -100, -9999) trigger immediate -32602 schema validation failure", () => {
      // 1. private_label_save_project with -1 and -100
      const errSave1 = failsWith("private_label_save_project", {
        id: fuzzProjectId,
        expected_revision: -1,
        client_id: "client_alpha",
      });
      expect(errSave1.code).toBe(-32602);

      const errSave100 = failsWith("private_label_save_project", {
        id: fuzzProjectId,
        expected_revision: -100,
        client_id: "client_alpha",
      });
      expect(errSave100.code).toBe(-32602);

      // 2. private_label_accept_quote with negative revision
      const errAccept = failsWith("private_label_accept_quote", {
        id: fuzzQuoteId,
        expected_revision: -1,
        client_id: "client_alpha",
      });
      expect(errAccept.code).toBe(-32602);

      // 3. private_label_approve_proof with negative revision
      const errApprove = failsWith("private_label_approve_proof", {
        proof_id: prepareProofForApproval(fuzzProofId),
        expected_revision: -5,
        disclaimer_accepted: true,
        client_id: "client_alpha",
      });
      expect(errApprove.code).toBe(-32602);

      // 4. private_label_upsert_packaging with negative revision
      const errUpsertPack = failsWith("private_label_upsert_packaging", {
        family_id: "fam_standup_pouch",
        name: "Negative Rev Pouch",
        capacity_description: "250g",
        net_weight_capacity_grams: 250,
        material: "Kraft",
        expected_revision: -1,
      });
      expect(errUpsertPack.code).toBe(-32602);

      // 5. private_label_convert_quote_to_order with negative revision
      const errConvert = failsWith("private_label_convert_quote_to_order", {
        quote_id: fuzzQuoteId,
        expected_revision: -999,
        client_id: "client_alpha",
      });
      expect(errConvert.code).toBe(-32602);

      // 6. private_label_archive_project with negative revision
      const errArchive = failsWith("private_label_archive_project", {
        id: fuzzProjectId,
        expected_revision: -1,
        client_id: "client_alpha",
      });
      expect(errArchive.code).toBe(-32602);
    });

    // --- 2.1b Expected Revision = 0 CAS Conflict (-32009) vs Schema Validation (-32602) ---
    it("2.1b: expected_revision = 0 passes schema validation (min 0) but returns -32009 (CAS conflict) when current revision >= 1", () => {
      // 1. private_label_save_project with expected_revision: 0
      const errSave = failsWith("private_label_save_project", {
        id: fuzzProjectId,
        expected_revision: 0,
        title: "Zero Revision Update",
        client_id: "client_alpha",
      });
      expect(errSave.code).toBe(-32009);
      expect(errSave.message).toMatch(/current revision: \d+, expected: 0/i);

      // 2. private_label_accept_quote with expected_revision: 0
      const errAccept = failsWith("private_label_accept_quote", {
        id: fuzzQuoteId,
        expected_revision: 0,
        client_id: "client_alpha",
      });
      expect(errAccept.code).toBe(-32009);

      // 3. private_label_approve_proof with expected_revision: 0
      const errApprove = failsWith("private_label_approve_proof", {
        proof_id: prepareProofForApproval(fuzzProofId),
        expected_revision: 0,
        disclaimer_accepted: true,
        client_id: "client_alpha",
      });
      expect(errApprove.code).toBe(-32009);

      // 4. private_label_archive_project with expected_revision: 0
      const errArchive = failsWith("private_label_archive_project", {
        id: fuzzProjectId,
        expected_revision: 0,
        client_id: "client_alpha",
      });
      expect(errArchive.code).toBe(-32009);
    });

    // --- 2.2 Missing Required Arguments Fuzzing ---
    it("2.2: missing required arguments trigger -32602 across tools", () => {
      // 1. private_label_get_project missing id
      expect(failsWith("private_label_get_project", {}).code).toBe(-32602);

      // 2. private_label_save_project missing expected_revision
      expect(failsWith("private_label_save_project", { id: fuzzProjectId }).code).toBe(-32602);

      // 3. private_label_save_project missing id
      expect(failsWith("private_label_save_project", { expected_revision: 1 }).code).toBe(-32602);

      // 4. private_label_create_quote missing project_id
      expect(failsWith("private_label_create_quote", {}).code).toBe(-32602);

      // 5. private_label_get_quote missing id
      expect(failsWith("private_label_get_quote", {}).code).toBe(-32602);

      // 6. private_label_release_job missing order_id
      expect(failsWith("private_label_release_job", {}).code).toBe(-32602);

      // 7. private_label_get_order missing id
      expect(failsWith("private_label_get_order", {}).code).toBe(-32602);

      // 8. private_label_calculate_moq missing tea_id / packaging_id
      expect(failsWith("private_label_calculate_moq", {}).code).toBe(-32602);

      // 9. private_label_calculate_quote missing quantity
      expect(
        failsWith("private_label_calculate_quote", {
          tea_id: "tea_darjeeling_first_flush",
          packaging_id: "pack_pouch_standup_250g_01",
        }).code
      ).toBe(-32602);

      // 10. private_label_upsert_packaging missing family_id and name
      expect(failsWith("private_label_upsert_packaging", {}).code).toBe(-32602);

      // 11. private_label_approve_proof missing proof_id, design_version_id, or id
      expect(failsWith("private_label_approve_proof", { disclaimer_accepted: true }).code).toBe(-32602);

      // 12. private_label_order_sample missing sample_type and shipping_address
      expect(failsWith("private_label_order_sample", { client_id: "client_alpha" }).code).toBe(-32602);

      // 13. private_label_record_qc missing milestone_id
      expect(failsWith("private_label_record_qc", { job_id: "job_xyz" }).code).toBe(-32602);
    });

    // --- 2.3 String Injection & Malformed Payloads ---
    it("2.3: string injection, SQL payloads, NaN, and out-of-bounds limits trigger -32602", () => {
      // 1. String injection in expected_revision
      expect(
        failsWith("private_label_save_project", {
          id: fuzzProjectId,
          expected_revision: "abc_not_a_number",
        }).code
      ).toBe(-32602);

      // 2. SQL injection attempt in expected_revision
      expect(
        failsWith("private_label_save_project", {
          id: fuzzProjectId,
          expected_revision: "' OR '1'='1",
        }).code
      ).toBe(-32602);

      // 3. String injection in calculate_quote quantity
      expect(
        failsWith("private_label_calculate_quote", {
          tea_id: "tea_darjeeling_first_flush",
          packaging_id: "pack_pouch_standup_250g_01",
          quantity: "MALICIOUS_DROP_TABLE",
        }).code
      ).toBe(-32602);

      // 4. NaN in quantity
      expect(
        failsWith("private_label_calculate_quote", {
          tea_id: "tea_darjeeling_first_flush",
          packaging_id: "pack_pouch_standup_250g_01",
          quantity: NaN,
        }).code
      ).toBe(-32602);

      // 5. Negative quantity (-500)
      expect(
        failsWith("private_label_calculate_quote", {
          tea_id: "tea_darjeeling_first_flush",
          packaging_id: "pack_pouch_standup_250g_01",
          quantity: -500,
        }).code
      ).toBe(-32602);

      // 6. Zero quantity (must be >= 1)
      expect(
        failsWith("private_label_calculate_quote", {
          tea_id: "tea_darjeeling_first_flush",
          packaging_id: "pack_pouch_standup_250g_01",
          quantity: 0,
        }).code
      ).toBe(-32602);

      // 7. Non-numeric in MOQ rule min_quantity
      expect(
        failsWith("private_label_set_moq", {
          rule_type: "packaging",
          unit_basis: "units",
          min_quantity: "NaN",
        }).code
      ).toBe(-32602);

      // 8. Negative limit in list_catalogue
      expect(failsWith("private_label_list_catalogue", { limit: -10 }).code).toBe(-32602);

      // 9. Oversized limit (max 100) in list_catalogue
      expect(failsWith("private_label_list_catalogue", { limit: 500 }).code).toBe(-32602);

      // 10. Negative offset in list_catalogue
      expect(failsWith("private_label_list_catalogue", { offset: -5 }).code).toBe(-32602);

      // 11. Invalid enum value in category
      expect(
        failsWith("private_label_list_catalogue", { category: "invalid_category_xyz" }).code
      ).toBe(-32602);

      // 12. Negative dpi in preflight validation
      expect(
        failsWith("private_label_validate_preflight", { dpi: -300 }).code
      ).toBe(-32602);
    });

    // --- 2.4 Unknown Tools & Method Not Found ---
    it("2.4: unknown tool names, non-string identifiers, and arbitrary calls trigger -32601", () => {
      // Unknown tool string
      expect(failsWith("private_label_delete_all_data", {}).code).toBe(-32601);
      expect(failsWith("unknown_tool_foobar", {}).code).toBe(-32601);
      expect(failsWith("private_label_execute_sql", { query: "DROP TABLE pl_projects" }).code).toBe(-32601);

      // Blank tool name
      expect(failsWith("", {}).code).toBe(-32601);

      // Non-string tool name
      expect(failsWith(null as unknown as string, {}).code).toBe(-32601);
      expect(failsWith(12345 as unknown as string, {}).code).toBe(-32601);
      expect(failsWith(undefined as unknown as string, {}).code).toBe(-32601);
    });
  });

  // =========================================================================
  // Suite 3: Manufacturing Release Gate Enforcement (-32009 & Audit Trail)
  // =========================================================================
  describe("Suite 3: Manufacturing Release Gate Enforcement (-32009 & Audit Trail)", () => {
    let unapprovedOrderId: string;
    let unapprovedQuoteId: string;
    let unapprovedProjectId: string;

    beforeAll(() => {
      // Create project, quote, and convert to order WITHOUT approving proof or paying deposit
      const proj = call<PublicProjectDto>("private_label_create_project", {
        client_id: "client_alpha",
        customer_id: "client_alpha",
        title: "Gate Enforcement Test Project",
        items: [
          {
            packaging_variant_id: "pack_pouch_standup_250g_01",
            tea_option_id: "tea_darjeeling_first_flush",
            target_quantity: 1000,
          },
        ],
      });
      unapprovedProjectId = proj.id;

      const quote = call<PublicQuoteWithItemsDto>("private_label_create_quote", {
        project_id: unapprovedProjectId,
        client_id: "client_alpha",
        customer_id: "client_alpha",
      });
      unapprovedQuoteId = quote.id;

      call("private_label_accept_quote", {
        id: unapprovedQuoteId,
        client_id: "client_alpha",
        customer_id: "client_alpha",
      });

      const order = call<PublicProductionOrderDto>("private_label_convert_quote_to_order", {
        quote_id: unapprovedQuoteId,
        client_id: "client_alpha",
        customer_id: "client_alpha",
      });
      unapprovedOrderId = order.id;
    });

    // --- 3.1 Unapproved Proof + Unpaid Deposit ---
    it("3.1: release job on unapproved proof AND unpaid deposit returns -32009 and writes 'release_blocked' audit log", () => {
      const db = getDb();
      const auditCountBefore = (
        db
          .prepare("SELECT COUNT(*) as c FROM pl_audit WHERE action = 'release_blocked' AND entity_id = ?")
          .get(unapprovedOrderId) as { c: number }
      ).c;

      // Attempt release
      const err = failsWith("private_label_release_job", {
        order_id: unapprovedOrderId,
      });

      expect(err.code).toBe(-32009);
      expect(err.message).toMatch(/proof approval/i);
      expect(err.message).toMatch(/deposit_paid/i);

      // Verify audit record was durably written to pl_audit
      const auditRecords = db
        .prepare(
          "SELECT * FROM pl_audit WHERE action = 'release_blocked' AND entity_id = ? ORDER BY rowid DESC"
        )
        .all(unapprovedOrderId) as Array<{
          action: string;
          entity_type: string;
          entity_id: string;
          actor_type: string;
          actor_id: string;
          diff_json: string;
        }>;

      expect(auditRecords.length).toBe(auditCountBefore + 1);
      const latest = auditRecords[0];
      expect(latest.entity_type).toBe("production_job");
      expect(latest.entity_id).toBe(unapprovedOrderId);
      expect(latest.action).toBe("release_blocked");
      expect(latest.actor_type).toBe("mcp");
      expect(latest.actor_id).toBe("mcp-agent");

      // Verify diff payload contains exact blockers
      const diffObj = JSON.parse(latest.diff_json);
      expect(diffObj.orderId).toBe(unapprovedOrderId);
      expect(Array.isArray(diffObj.blockers)).toBe(true);
      expect(diffObj.blockers.some((b: string) => /deposit_paid/i.test(b))).toBe(true);
      expect(diffObj.blockers.some((b: string) => /proof approval/i.test(b))).toBe(true);
    });

    // --- 3.2 Paid Deposit + Unapproved Proof ---
    it("3.2: release job on paid deposit but unapproved proof returns -32009 and records audit trail", () => {
      const db = getDb();
      // Set status to deposit_paid, proof remains unapproved
      db.prepare("UPDATE pl_orders SET status = 'deposit_paid' WHERE id = ?").run(unapprovedOrderId);

      const auditCountBefore = (
        db
          .prepare("SELECT COUNT(*) as c FROM pl_audit WHERE action = 'release_blocked' AND entity_id = ?")
          .get(unapprovedOrderId) as { c: number }
      ).c;

      const err = failsWith("private_label_release_job", {
        order_id: unapprovedOrderId,
      });

      expect(err.code).toBe(-32009);
      expect(err.message).toMatch(/proof approval/i);
      expect(err.message).not.toMatch(/deposit_paid/i);

      // Verify new release_blocked audit entry
      const auditRecords = db
        .prepare(
          "SELECT * FROM pl_audit WHERE action = 'release_blocked' AND entity_id = ? ORDER BY rowid DESC"
        )
        .all(unapprovedOrderId) as Array<{ action: string; diff_json: string }>;

      expect(auditRecords.length).toBe(auditCountBefore + 1);
      const diffObj = JSON.parse(auditRecords[0].diff_json);
      expect(diffObj.blockers.length).toBe(1);
      expect(diffObj.blockers[0]).toMatch(/proof approval/i);
    });

    // --- 3.3 Approved Proof + Unpaid Deposit ---
    it("3.3: release job on approved proof but unpaid deposit returns -32009 and records audit trail", () => {
      const db = getDb();
      // Revert deposit status to pending_deposit
      db.prepare("UPDATE pl_orders SET status = 'pending_deposit' WHERE id = ?").run(unapprovedOrderId);

      // Generate and approve proof
      const proof = call<PublicDesignVersionDto>("private_label_generate_preview", {
        project_id: unapprovedProjectId,
        client_id: "client_alpha",
        customer_id: "client_alpha",
        scene_data: { approved_proof_test: true },
      });
      call("private_label_approve_proof", {
        proof_id: prepareProofForApproval(proof.id),
        expected_revision: 1,
        disclaimer_accepted: true,
        client_id: "client_alpha",
        customer_id: "client_alpha",
      });

      const auditCountBefore = (
        db
          .prepare("SELECT COUNT(*) as c FROM pl_audit WHERE action = 'release_blocked' AND entity_id = ?")
          .get(unapprovedOrderId) as { c: number }
      ).c;

      const err = failsWith("private_label_release_job", {
        order_id: unapprovedOrderId,
      });

      expect(err.code).toBe(-32009);
      expect(err.message).toMatch(/deposit_paid/i);
      expect(err.message).not.toMatch(/proof approval/i);

      // Verify audit entry
      const auditRecords = db
        .prepare(
          "SELECT * FROM pl_audit WHERE action = 'release_blocked' AND entity_id = ? ORDER BY rowid DESC"
        )
        .all(unapprovedOrderId) as Array<{ action: string; diff_json: string }>;

      expect(auditRecords.length).toBe(auditCountBefore + 1);
      const diffObj = JSON.parse(auditRecords[0].diff_json);
      expect(diffObj.blockers.length).toBe(1);
      expect(diffObj.blockers[0]).toMatch(/deposit_paid/i);
    });

    // --- 3.4 Emergency Override Bypass ---
    it("3.4: emergency operator override bypasses gate blocker and creates scheduled job with 7 QC milestones", () => {
      const db = getDb();
      // Ensure deposit is still pending_deposit
      db.prepare("UPDATE pl_orders SET status = 'pending_deposit' WHERE id = ?").run(unapprovedOrderId);

      const justification = "Executive emergency fast-track waiver authorized by Head of Operations";
      const job = call<PublicProductionJobDto>("private_label_release_job", {
        order_id: unapprovedOrderId,
        operator_id: "ops_supervisor_01",
        override_justification: justification,
      });

      expect(job.id).toMatch(/^job_/);
      expect(job.job_number).toMatch(/^PL-JOB-/);
      expect(job.status).toBe("scheduled");

      // Verify override logged in pl_audit
      const auditLog = db
        .prepare("SELECT * FROM pl_audit WHERE entity_id = ? AND action = 'release_job'")
        .get(job.id) as { diff_json: string; action: string } | undefined;
      expect(auditLog).toBeDefined();
      const diffObj = JSON.parse(auditLog!.diff_json);
      expect(diffObj.overrideJustification).toBe(justification);

      // Verify all 7 QC milestones were initialized
      const milestones = db
        .prepare("SELECT * FROM pl_qc_milestones WHERE job_id = ? ORDER BY id ASC")
        .all(job.id);
      expect(milestones.length).toBe(7);
    });

    // --- 3.5 Fully Compliant Gate Release ---
    it("3.5: fully compliant release (both gates satisfied, no override) succeeds and transitions order status", () => {
      const db = getDb();
      // Create fresh project and quote
      const proj = call<PublicProjectDto>("private_label_create_project", {
        client_id: "client_alpha",
        customer_id: "client_alpha",
        title: "Clean Release Compliant Project",
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
        customer_id: "client_alpha",
      });
      call("private_label_accept_quote", {
        id: quote.id,
        client_id: "client_alpha",
        customer_id: "client_alpha",
      });
      const order = call<PublicProductionOrderDto>("private_label_convert_quote_to_order", {
        quote_id: quote.id,
        client_id: "client_alpha",
        customer_id: "client_alpha",
      });

      // 1. Approve proof
      const proof = call<PublicDesignVersionDto>("private_label_generate_preview", {
        project_id: proj.id,
        client_id: "client_alpha",
        customer_id: "client_alpha",
        scene_data: { clean: true },
      });
      call("private_label_approve_proof", {
        proof_id: prepareProofForApproval(proof.id),
        expected_revision: 1,
        disclaimer_accepted: true,
        client_id: "client_alpha",
        customer_id: "client_alpha",
      });

      // 2. Mark deposit paid
      db.prepare("UPDATE pl_orders SET status = 'deposit_paid' WHERE id = ?").run(order.id);

      // 3. Release job without any override
      const job = call<PublicProductionJobDto>("private_label_release_job", {
        order_id: order.id,
        operator_id: "plant_manager_01",
      });

      expect(job.id).toMatch(/^job_/);
      expect(job.status).toBe("scheduled");

      // Verify order status updated to production_released
      const orderRow = db.prepare("SELECT status FROM pl_orders WHERE id = ?").get(order.id) as { status: string };
      expect(orderRow.status).toBe("production_released");

      // Verify audit entry
      const auditLog = db
        .prepare("SELECT * FROM pl_audit WHERE entity_id = ? AND action = 'release_job'")
        .get(job.id) as { action: string };
      expect(auditLog).toBeDefined();
    });
  });
});
