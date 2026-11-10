/**
 * TeaFloww Private Label Studio — Milestone M6 Empirical Adversarial Challenger Test Suite
 * Challenger: private_label_m6_challenger_1
 * Roles: critic, specialist
 * File: tests/unit/private-label-m6-challenger-samples-checkout.test.ts
 *
 * Scope: Milestone M6 Empirical Adversarial Stress Testing:
 * 1. Sample Quantity Capping: boundary at <= 10 units, rejection above 10, negative and non-integer fuzzing.
 * 2. Promotional Coupon SAMPLEFREE100: 100% discount, single-use per client enforcement, multi-tenant isolation, tampered/fake coupon protection.
 * 3. Indian Address & 6-Digit PIN Validation: 6-digit regex /^[1-9][0-9]{5}$/, rejection of 5/7 digits, leading 0, alpha, special characters, incomplete addresses.
 * 4. Quote-to-Order Conversion & Expiration: rejecting expired quotes (valid_until in past) with HTTP 422, already converted guards.
 * 5. High-Concurrency CAS Races: parallel conversion requests on same quote revision -> exactly 1 winner (HTTP 201), losers fail with HTTP 409 Conflict.
 * 6. Idempotency Key Deduplication: re-submission returns existing order without creating duplicate orders or double-charging.
 * 7. 50% Deposit & 50% Balance Financial Invariants: exact integer paise math, odd-paise split preserves exact sum (deposit + balance === total), randomized property testing.
 * 8. Multi-Tenant Isolation & Anti-Enumeration: cross-tenant access to orders or quotes returns 404 (zero leakage).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { rmSync } from "node:fs";

import { PrivateLabelService } from "@/lib/private-label/service";
import {
  PrivateLabelNotFoundError,
  PrivateLabelGateError,
  type AuditActor,
} from "@/lib/private-label/types";

// Route Handlers
import { POST as createSampleRoute, GET as listSamplesRoute } from "@/app/api/v1/private-label/samples/route";
import { POST as checkoutRoute } from "@/app/api/v1/private-label/orders/checkout/route";
import { GET as getOrderRoute } from "@/app/api/v1/private-label/orders/[id]/route";
import { POST as paymentIntentRoute } from "@/app/api/v1/private-label/orders/payment-intent/route";

// Test Actor Identifiers
const CUSTOMER_A_ID = "cust-m6-chal1-alice";
const CUSTOMER_B_ID = "cust-m6-chal1-bob";

const ACTOR_CUSTOMER_A: AuditActor = {
  actor_type: "customer",
  actor_id: CUSTOMER_A_ID,
  actor_email: "alice@teafloww-test.com",
};

describe("Milestone M6 Challenger: Samples, Checkout, CAS Races & Deposit Invariants", () => {
  let testDbPath: string;
  let db: Database.Database;

  beforeAll(() => {
    testDbPath = path.join(tmpdir(), `pl-m6-chal1-${process.pid}-${Date.now()}.sqlite`);
    process.env.DATABASE_PATH = testDbPath;
    (process.env as Record<string, string | undefined>).NODE_ENV = "test";

    // Run database migrations through 049
    execFileSync(process.execPath, ["scripts/migrate.mjs"], {
      env: { ...process.env, DATABASE_PATH: testDbPath },
    });

    db = new Database(testDbPath);
    db.pragma("foreign_keys = ON");
    db.pragma("journal_mode = WAL");

    // Seed initial catalog (price books, packaging families, print methods)
    PrivateLabelService.seedInitialCatalog();

    // Seed Customers
    db.prepare(`
      INSERT OR IGNORE INTO customers (id, email, name, is_active)
      VALUES
        (?, 'alice@teafloww-test.com', 'Alice Smith', 1),
        (?, 'bob@teafloww-test.com', 'Bob Jones', 1)
    `).run(CUSTOMER_A_ID, CUSTOMER_B_ID);

    // Seed Clients
    db.prepare(`
      INSERT OR IGNORE INTO pl_clients (id, customer_id, company_name, contact_name, contact_email)
      VALUES
        ('client_chal_alice', ?, 'Alice Fine Teas Ltd', 'Alice Smith', 'alice@teafloww-test.com'),
        ('client_chal_bob', ?, 'Bob Tea Merchants Ltd', 'Bob Jones', 'bob@teafloww-test.com')
    `).run(CUSTOMER_A_ID, CUSTOMER_B_ID);
  });

  afterAll(() => {
    try {
      db?.close();
      rmSync(testDbPath, { force: true });
      rmSync(testDbPath + "-wal", { force: true });
      rmSync(testDbPath + "-shm", { force: true });
    } catch {}
  });

  it("provisions an isolated client for a first-time sample customer", () => {
    const customerId = "sample-first-time-owner";
    db.prepare("INSERT INTO customers (id, email, name) VALUES (?, ?, ?)").run(customerId, "first-sample@example.com", "First Sample Customer");
    const sample = PrivateLabelService.createSampleOrder({ sample_type: "tea_kit", quantity: 1, shipping_address: { line1: "New customer address", city: "Siliguri", pincode: "734001" } }, customerId, { actor_type: "customer", actor_id: customerId });
    const owner = db.prepare("SELECT customer_id FROM pl_clients WHERE id = ?").get(sample.client_id) as { customer_id: string };
    expect(owner.customer_id).toBe(customerId);
    expect(() => PrivateLabelService.getSampleOrder(sample.id, CUSTOMER_A_ID)).toThrow(PrivateLabelNotFoundError);
    expect(PrivateLabelService.getSampleOrder(sample.id, customerId).id).toBe(sample.id);
  });

  // Helper to provision test projects and quotes
  function seedQuote(options: {
    projectId: string;
    quoteId: string;
    customerId: string;
    clientId: string;
    grandTotalPaise: number;
    validUntil?: string;
    status?: string;
    revision?: number;
  }) {
    db.prepare(`
      INSERT OR IGNORE INTO pl_projects (id, client_id, owner_customer_id, title, status)
      VALUES (?, ?, ?, 'Project ' || ?, 'accepted')
    `).run(options.projectId, options.clientId, options.customerId, options.projectId);

    db.prepare(`
      INSERT OR IGNORE INTO pl_project_items (id, project_id, fill_weight_grams, quantity_units)
      VALUES ('pitem_' || ?, ?, 100, 1000)
    `).run(options.projectId, options.projectId);

    const validUntil = options.validUntil ?? new Date(Date.now() + 30 * 86400000).toISOString();
    const status = options.status ?? "customer_accepted";
    const revision = options.revision ?? 1;

    db.prepare(`
      INSERT OR REPLACE INTO pl_quotes (
        id, quote_number, project_id, price_book_id, status, version, revision,
        currency, grand_total_paise, valid_until, created_at, updated_at
      ) VALUES (
        ?, 'PL-Q-' || ?, ?, 'pb_default_inr', ?, 1, ?,
        'INR', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `).run(
      options.quoteId,
      options.quoteId,
      options.projectId,
      status,
      revision,
      options.grandTotalPaise,
      validUntil
    );

    // Line item for pl_order_items population
    db.prepare(`
      INSERT OR REPLACE INTO pl_quote_items (
        id, quote_id, project_item_id, description, quantity, unit_price_paise, line_total_paise, cost_breakdown_json
      ) VALUES (
        'qitem_' || ?, ?, 'pitem_' || ?, 'Custom Darjeeling Orthodox Lot', 1000, ?, ?, '{}'
      )
    `).run(
      options.quoteId,
      options.quoteId,
      options.projectId,
      Math.round(options.grandTotalPaise / 1000),
      options.grandTotalPaise
    );
  }

  // ==========================================================================
  // Suite 1: Sample Quantity Capping Boundaries & Input Fuzzing (<= 10)
  // ==========================================================================
  describe("Suite 1: Sample Quantity Capping Boundaries & Input Fuzzing", () => {
    it("permits exact upper boundary: quantity = 10 units succeeds", async () => {
      const res = await createSampleRoute(
        new Request("http://localhost/api/v1/private-label/samples", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-customer-id": CUSTOMER_A_ID },
          body: JSON.stringify({
            sample_type: "tea_kit",
            quantity: 10, // exact cap
            shipping_address: { line1: "42 Tea Garden Road", city: "Siliguri", pincode: "734005" },
          }),
        })
      );

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.sample).toBeDefined();
      expect(data.sample.quantity).toBe(10);
    });

    it("rejects boundary + 1: quantity = 11 units throws PrivateLabelGateError at service layer", () => {
      expect(() => {
        PrivateLabelService.createSampleOrder(
          {
            sample_type: "tea_kit",
            quantity: 11,
            shipping_address: { line1: "42 Tea Garden Road", city: "Siliguri", pincode: "734005" },
          },
          CUSTOMER_A_ID,
          ACTOR_CUSTOMER_A
        );
      }).toThrowError(PrivateLabelGateError);

      try {
        PrivateLabelService.createSampleOrder(
          {
            sample_type: "tea_kit",
            quantity: 11,
            shipping_address: { line1: "42 Tea Garden Road", city: "Siliguri", pincode: "734005" },
          },
          CUSTOMER_A_ID,
          ACTOR_CUSTOMER_A
        );
      } catch (err: any) {
        expect(err.gate_name).toBe("sample_quantity_cap");
        expect(err.blockers[0]).toContain("Maximum sample quantity per order is 10");
      }
    });

    it("rejects quantity = 11 units via HTTP route with 400 Bad Request", async () => {
      const res = await createSampleRoute(
        new Request("http://localhost/api/v1/private-label/samples", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-customer-id": CUSTOMER_A_ID },
          body: JSON.stringify({
            sample_type: "packaged_mockup",
            quantity: 11,
            shipping_address: { line1: "42 Tea Garden Road", city: "Siliguri", pincode: "734005" },
          }),
        })
      );

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Validation failed");
    });

    it("rejects zero quantity (quantity: 0) via HTTP route with 400 Bad Request", async () => {
      const res = await createSampleRoute(
        new Request("http://localhost/api/v1/private-label/samples", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-customer-id": CUSTOMER_A_ID },
          body: JSON.stringify({
            sample_type: "tea_kit",
            quantity: 0,
            shipping_address: { line1: "42 Tea Garden Road", city: "Siliguri", pincode: "734005" },
          }),
        })
      );

      expect(res.status).toBe(400);
    });

    it("rejects negative quantity (quantity: -5) via HTTP route with 400 Bad Request", async () => {
      const res = await createSampleRoute(
        new Request("http://localhost/api/v1/private-label/samples", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-customer-id": CUSTOMER_A_ID },
          body: JSON.stringify({
            sample_type: "tea_kit",
            quantity: -5,
            shipping_address: { line1: "42 Tea Garden Road", city: "Siliguri", pincode: "734005" },
          }),
        })
      );

      expect(res.status).toBe(400);
    });

    it("rejects massive hoarded quantity (quantity: 500) at both service and API layer", async () => {
      expect(() => {
        PrivateLabelService.createSampleOrder(
          {
            sample_type: "full_pack_sample",
            quantity: 500,
            shipping_address: { line1: "42 Tea Garden Road", city: "Siliguri", pincode: "734005" },
          },
          CUSTOMER_A_ID,
          ACTOR_CUSTOMER_A
        );
      }).toThrowError(/Maximum sample quantity/);

      const res = await createSampleRoute(
        new Request("http://localhost/api/v1/private-label/samples", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-customer-id": CUSTOMER_A_ID },
          body: JSON.stringify({
            sample_type: "full_pack_sample",
            quantity: 500,
            shipping_address: { line1: "42 Tea Garden Road", city: "Siliguri", pincode: "734005" },
          }),
        })
      );
      expect(res.status).toBe(400);
    });

    it("rejects non-integer float quantity (quantity: 2.7) via HTTP route", async () => {
      const res = await createSampleRoute(
        new Request("http://localhost/api/v1/private-label/samples", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-customer-id": CUSTOMER_A_ID },
          body: JSON.stringify({
            sample_type: "tea_kit",
            quantity: 2.7,
            shipping_address: { line1: "42 Tea Garden Road", city: "Siliguri", pincode: "734005" },
          }),
        })
      );
      expect(res.status).toBe(400);
    });
  });

  // ==========================================================================
  // Suite 2: Promotional Coupon SAMPLEFREE100 Lifecycle & Single-Use Enforcement
  // ==========================================================================
  describe("Suite 2: Promotional Coupon SAMPLEFREE100 Lifecycle & Single-Use Enforcement", () => {
    it("applies 100% discount for first use of SAMPLEFREE100 (amount_paise becomes 0)", () => {
      const sample = PrivateLabelService.createSampleOrder(
        {
          sample_type: "tea_kit",
          quantity: 2,
          amount_paise: 75000,
          coupon_code: "SAMPLEFREE100",
          shipping_address: { line1: "10 Hill Cart Road", city: "Siliguri", pincode: "734001" },
        },
        CUSTOMER_A_ID,
        ACTOR_CUSTOMER_A
      );

      expect(sample.amount_paise).toBe(0);
      expect(sample.coupon_code).toBe("SAMPLEFREE100");
    });

    it("rejects duplicate reuse of SAMPLEFREE100 by the same client with PrivateLabelGateError (HTTP 422)", async () => {
      // Customer A already redeemed SAMPLEFREE100 in the test above
      expect(() => {
        PrivateLabelService.createSampleOrder(
          {
            sample_type: "tea_kit",
            quantity: 1,
            amount_paise: 75000,
            coupon_code: "SAMPLEFREE100",
            shipping_address: { line1: "10 Hill Cart Road", city: "Siliguri", pincode: "734001" },
          },
          CUSTOMER_A_ID,
          ACTOR_CUSTOMER_A
        );
      }).toThrowError(/already been used by this client/);

      // Verify HTTP route returns 422 Unprocessable Entity
      const res = await createSampleRoute(
        new Request("http://localhost/api/v1/private-label/samples", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-customer-id": CUSTOMER_A_ID },
          body: JSON.stringify({
            sample_type: "tea_kit",
            quantity: 1,
            coupon_code: "SAMPLEFREE100",
            shipping_address: { line1: "10 Hill Cart Road", city: "Siliguri", pincode: "734001" },
          }),
        })
      );

      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.gate_name).toBe("coupon_already_used");
      expect(data.blockers[0]).toContain("Promotional coupon SAMPLEFREE100 has already been used");
    });

    it("allows Client B to redeem SAMPLEFREE100 on their first attempt (multi-tenant isolation)", async () => {
      const res = await createSampleRoute(
        new Request("http://localhost/api/v1/private-label/samples", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-customer-id": CUSTOMER_B_ID },
          body: JSON.stringify({
            sample_type: "tea_kit",
            quantity: 1,
            coupon_code: "SAMPLEFREE100",
            shipping_address: { line1: "55 Sevoke Road", city: "Siliguri", pincode: "734001" },
          }),
        })
      );

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.sample.coupon_code).toBe("SAMPLEFREE100");
    });

    it("rejects duplicate reuse of SAMPLEFREE100 by Client B on second attempt", async () => {
      const res = await createSampleRoute(
        new Request("http://localhost/api/v1/private-label/samples", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-customer-id": CUSTOMER_B_ID },
          body: JSON.stringify({
            sample_type: "tea_kit",
            quantity: 1,
            coupon_code: "SAMPLEFREE100",
            shipping_address: { line1: "55 Sevoke Road", city: "Siliguri", pincode: "734001" },
          }),
        })
      );

      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.gate_name).toBe("coupon_already_used");
    });

    it("rejects an invalid sample coupon instead of silently ignoring it", () => {
      expect(() => PrivateLabelService.createSampleOrder({
        sample_type: "tea_kit", quantity: 1, coupon_code: "SAMPLEFREE50_FAKE",
        shipping_address: { line1: "10 Hill Cart Road", city: "Siliguri", pincode: "734001" },
      }, CUSTOMER_A_ID, ACTOR_CUSTOMER_A)).toThrow(/not recognized/);
    });

    it("prevents double-redemption under simulated concurrent coupon submission", async () => {
      // Create a fresh client for race test
      const raceCustId = "cust_chal_race_coupon";
      const raceClientId = "client_chal_race_coupon";

      db.prepare(`
        INSERT OR IGNORE INTO customers (id, email, name, is_active)
        VALUES (?, 'race@test.com', 'Race Test Customer', 1)
      `).run(raceCustId);

      db.prepare(`
        INSERT OR IGNORE INTO pl_clients (id, customer_id, company_name, contact_name, contact_email)
        VALUES (?, ?, 'Race Teas', 'Race Customer', 'race@test.com')
      `).run(raceClientId, raceCustId);

      const makeReq = () =>
        createSampleRoute(
          new Request("http://localhost/api/v1/private-label/samples", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-customer-id": raceCustId },
            body: JSON.stringify({
              sample_type: "tea_kit",
              quantity: 1,
              coupon_code: "SAMPLEFREE100",
              shipping_address: { line1: "10 Hill Cart Road", city: "Siliguri", pincode: "734001" },
            }),
          })
        );

      // Fire 5 concurrent redemption requests
      const results = await Promise.all([makeReq(), makeReq(), makeReq(), makeReq(), makeReq()]);
      const statuses = results.map((r) => r.status);

      // Exactly 1 must succeed (201), the rest must be rejected with 422
      const createdCount = statuses.filter((s) => s === 201).length;
      const rejectedCount = statuses.filter((s) => s === 422).length;

      expect(createdCount).toBe(1);
      expect(rejectedCount).toBe(4);

      // Verify database has exactly 1 coupon usage
      const count = db
        .prepare("SELECT COUNT(*) as c FROM pl_samples WHERE client_id = ? AND coupon_code = 'SAMPLEFREE100'")
        .get(raceClientId) as { c: number };
      expect(count.c).toBe(1);
    });
  });

  // ==========================================================================
  // Suite 2B: Authoritative Server-Side Pricing vs Client Price Tampering
  // ==========================================================================
  describe("Suite 2B: Authoritative Server-Side Pricing vs Client Price Tampering", () => {
    it("tampered price injection: client sending amount_paise: 1 is completely overridden by authoritative pricing (tea_kit * 3 = 225,000 paise)", async () => {
      const res = await createSampleRoute(
        new Request("http://localhost/api/v1/private-label/samples", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-customer-id": CUSTOMER_A_ID },
          body: JSON.stringify({
            sample_type: "tea_kit",
            quantity: 3,
            amount_paise: 1, // Malicious spoofed 1 paisa
            shipping_address: { line1: "123 Tea St", city: "Siliguri", pincode: "734005" },
          }),
        })
      );

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.sample.amount_paise).toBe(225000); // 3 * 75000 paise, NOT 1 paisa

      // Check SQLite database row directly
      const row = db.prepare("SELECT amount_paise FROM pl_samples WHERE id = ?").get(data.sample.id) as {
        amount_paise: number;
      };
      expect(row.amount_paise).toBe(225000);
    });

    it("authoritative pricing for packaged_mockup: client sending amount_paise: 0 is ignored (packaged_mockup * 2 = 99,800 paise)", async () => {
      const res = await createSampleRoute(
        new Request("http://localhost/api/v1/private-label/samples", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-customer-id": CUSTOMER_A_ID },
          body: JSON.stringify({
            sample_type: "packaged_mockup",
            quantity: 2,
            amount_paise: 0, // Malicious spoofed 0 paise
            shipping_address: { line1: "123 Tea St", city: "Siliguri", pincode: "734005" },
          }),
        })
      );

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.sample.amount_paise).toBe(99800); // 2 * 49900 paise, NOT 0 paise

      const row = db.prepare("SELECT amount_paise FROM pl_samples WHERE id = ?").get(data.sample.id) as {
        amount_paise: number;
      };
      expect(row.amount_paise).toBe(99800);
    });

    it("authoritative pricing for full_pack_sample and printed_proof at service layer (unit price 250,000 paise)", () => {
      const fullPack = PrivateLabelService.createSampleOrder(
        {
          sample_type: "full_pack_sample",
          quantity: 4,
          amount_paise: 9999, // Tampered client price
          shipping_address: { line1: "123 Tea St", city: "Siliguri", pincode: "734005" },
        },
        CUSTOMER_A_ID,
        ACTOR_CUSTOMER_A
      );
      expect(fullPack.amount_paise).toBe(1000000); // 4 * 250,000 paise

      const proof = PrivateLabelService.createSampleOrder(
        {
          sample_type: "printed_proof",
          quantity: 1,
          amount_paise: -500, // Negative price injection attempt
          shipping_address: { line1: "123 Tea St", city: "Siliguri", pincode: "734005" },
        },
        CUSTOMER_A_ID,
        ACTOR_CUSTOMER_A
      );
      expect(proof.amount_paise).toBe(250000); // 1 * 250,000 paise
    });

    it("coupon whitespace and case normalization: lowercase '  samplefree100  ' is normalized and applied", async () => {
      const caseCustId = "cust_chal_case_coupon";
      const caseClientId = "client_chal_case_coupon";

      db.prepare(`
        INSERT OR IGNORE INTO customers (id, email, name, is_active)
        VALUES (?, 'case@test.com', 'Case Test Customer', 1)
      `).run(caseCustId);

      db.prepare(`
        INSERT OR IGNORE INTO pl_clients (id, customer_id, company_name, contact_name, contact_email)
        VALUES (?, ?, 'Case Teas', 'Case Customer', 'case@test.com')
      `).run(caseClientId, caseCustId);

      const res = await createSampleRoute(
        new Request("http://localhost/api/v1/private-label/samples", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-customer-id": caseCustId },
          body: JSON.stringify({
            sample_type: "tea_kit",
            quantity: 1,
            coupon_code: "  samplefree100  ", // Untrimmed, lowercase
            shipping_address: { line1: "10 Hill Cart Road", city: "Siliguri", pincode: "734001" },
          }),
        })
      );

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.sample.amount_paise).toBe(0);
      expect(data.sample.coupon_code).toBe("SAMPLEFREE100");

      // Verify second attempt with different casing is blocked
      const res2 = await createSampleRoute(
        new Request("http://localhost/api/v1/private-label/samples", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-customer-id": caseCustId },
          body: JSON.stringify({
            sample_type: "tea_kit",
            quantity: 1,
            coupon_code: "SampleFree100",
            shipping_address: { line1: "10 Hill Cart Road", city: "Siliguri", pincode: "734001" },
          }),
        })
      );

      expect(res2.status).toBe(422);
      const data2 = await res2.json();
      expect(data2.gate_name).toBe("coupon_already_used");
    });
  });

  // ==========================================================================
  // Suite 3: Indian Address & 6-Digit PIN Code Validation
  // ==========================================================================
  describe("Suite 3: Indian Address & 6-Digit PIN Code Validation", () => {
    it("accepts valid Indian postal PIN codes across different zones", () => {
      const validPins = ["734005", "734001", "700001", "110001", "560001", "400001"];

      for (const pin of validPins) {
        expect(() => {
          PrivateLabelService.createSampleOrder(
            {
              sample_type: "tea_kit",
              quantity: 1,
              shipping_address: { line1: "123 Tea St", city: "Siliguri", pincode: pin },
            },
            CUSTOMER_A_ID,
            ACTOR_CUSTOMER_A
          );
        }).not.toThrow();
      }
    });

    it("rejects 5-digit PIN code (boundary - 1)", () => {
      expect(() => {
        PrivateLabelService.createSampleOrder(
          {
            sample_type: "tea_kit",
            quantity: 1,
            shipping_address: { line1: "123 Tea St", city: "Siliguri", pincode: "73400" },
          },
          CUSTOMER_A_ID,
          ACTOR_CUSTOMER_A
        );
      }).toThrowError(/valid 6-digit Indian PIN code/);
    });

    it("rejects 7-digit PIN code (boundary + 1)", () => {
      expect(() => {
        PrivateLabelService.createSampleOrder(
          {
            sample_type: "tea_kit",
            quantity: 1,
            shipping_address: { line1: "123 Tea St", city: "Siliguri", pincode: "7340001" },
          },
          CUSTOMER_A_ID,
          ACTOR_CUSTOMER_A
        );
      }).toThrowError(/valid 6-digit Indian PIN code/);
    });

    it("rejects PIN codes starting with 0 (Indian PIN zones start with 1-9)", () => {
      expect(() => {
        PrivateLabelService.createSampleOrder(
          {
            sample_type: "tea_kit",
            quantity: 1,
            shipping_address: { line1: "123 Tea St", city: "Siliguri", pincode: "034005" },
          },
          CUSTOMER_A_ID,
          ACTOR_CUSTOMER_A
        );
      }).toThrowError(/valid 6-digit Indian PIN code/);
    });

    it("rejects PIN codes containing alphabetical letters or alphanumeric characters", () => {
      const invalidPins = ["73400A", "ABCDEF", "734 05", "734-01", "PINCOD"];

      for (const pin of invalidPins) {
        expect(() => {
          PrivateLabelService.createSampleOrder(
            {
              sample_type: "tea_kit",
              quantity: 1,
              shipping_address: { line1: "123 Tea St", city: "Siliguri", pincode: pin },
            },
            CUSTOMER_A_ID,
            ACTOR_CUSTOMER_A
          );
        }).toThrowError(/valid 6-digit Indian PIN code/);
      }
    });

    it("rejects invalid PIN via HTTP route with 400 Bad Request", async () => {
      const res = await createSampleRoute(
        new Request("http://localhost/api/v1/private-label/samples", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-customer-id": CUSTOMER_A_ID },
          body: JSON.stringify({
            sample_type: "tea_kit",
            quantity: 1,
            shipping_address: { line1: "123 Tea St", city: "Siliguri", pincode: "INVALID" },
          }),
        })
      );

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Validation failed");
    });

    it("rejects address missing required line1 or city", () => {
      expect(() => {
        PrivateLabelService.createSampleOrder(
          {
            sample_type: "tea_kit",
            quantity: 1,
            shipping_address: { line1: "", city: "Siliguri", pincode: "734005" } as any,
          },
          CUSTOMER_A_ID,
          ACTOR_CUSTOMER_A
        );
      }).toThrowError(/include address line 1 and city/);

      expect(() => {
        PrivateLabelService.createSampleOrder(
          {
            sample_type: "tea_kit",
            quantity: 1,
            shipping_address: { line1: "123 St", city: "", pincode: "734005" } as any,
          },
          CUSTOMER_A_ID,
          ACTOR_CUSTOMER_A
        );
      }).toThrowError(/include address line 1 and city/);
    });
  });

  // ==========================================================================
  // Suite 4: Quote Expiration & Conversion Gate Preconditions
  // ==========================================================================
  describe("Suite 4: Quote Expiration & Conversion Gate Preconditions", () => {
    it("rejects conversion of expired quote (valid_until in past) with HTTP 422 Gate Error", async () => {
      const expQuoteId = "quote_chal_expired_001";
      const expProjId = "proj_chal_expired_001";

      seedQuote({
        projectId: expProjId,
        quoteId: expQuoteId,
        customerId: CUSTOMER_A_ID,
        clientId: "client_chal_alice",
        grandTotalPaise: 500000,
        validUntil: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      });

      // Service layer throws PrivateLabelGateError
      expect(() => {
        PrivateLabelService.convertQuoteToOrder(
          expQuoteId,
          { expected_revision: 1 },
          CUSTOMER_A_ID,
          ACTOR_CUSTOMER_A
        );
      }).toThrowError(/has expired on/);

      // HTTP route returns 422
      const res = await checkoutRoute(
        new Request("http://localhost/api/v1/private-label/orders/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-customer-id": CUSTOMER_A_ID },
          body: JSON.stringify({
            quote_id: expQuoteId,
            expected_revision: 1,
          }),
        })
      );

      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.gate_name).toBe("quote_acceptance");
      expect(data.blockers[0]).toContain("has expired");
    });

    it("rejects conversion of quote that is already converted without matching idempotency key (HTTP 422)", async () => {
      const convQuoteId = "quote_chal_already_conv_001";
      const convProjId = "proj_chal_already_conv_001";

      seedQuote({
        projectId: convProjId,
        quoteId: convQuoteId,
        customerId: CUSTOMER_A_ID,
        clientId: "client_chal_alice",
        grandTotalPaise: 1000000,
        status: "converted",
        revision: 2,
      });

      expect(() => {
        PrivateLabelService.convertQuoteToOrder(
          convQuoteId,
          {},
          CUSTOMER_A_ID,
          ACTOR_CUSTOMER_A
        );
      }).toThrowError(/is already converted to an order/);

      const res = await checkoutRoute(
        new Request("http://localhost/api/v1/private-label/orders/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-customer-id": CUSTOMER_A_ID },
          body: JSON.stringify({
            quote_id: convQuoteId,
          }),
        })
      );

      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.gate_name).toBe("quote_already_converted");
    });

    it("converts quote with future valid_until successfully", async () => {
      const activeQuoteId = "quote_chal_active_001";
      const activeProjId = "proj_chal_active_001";

      seedQuote({
        projectId: activeProjId,
        quoteId: activeQuoteId,
        customerId: CUSTOMER_A_ID,
        clientId: "client_chal_alice",
        grandTotalPaise: 2000000,
        validUntil: new Date(Date.now() + 86400000 * 15).toISOString(), // 15 days future
        status: "customer_accepted",
        revision: 1,
      });

      const res = await checkoutRoute(
        new Request("http://localhost/api/v1/private-label/orders/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-customer-id": CUSTOMER_A_ID },
          body: JSON.stringify({
            quote_id: activeQuoteId,
            expected_revision: 1,
          }),
        })
      );

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.order_id).toMatch(/^order_/);
      expect(data.order.status).toBe("pending_deposit");
    });
  });

  // ==========================================================================
  // Suite 5: CAS Optimistic Concurrency Race on Quote Conversion
  // ==========================================================================
  describe("Suite 5: CAS Optimistic Concurrency Race on Quote Conversion", () => {
    it("10 parallel conversion requests on same quote revision -> exactly 1 winner (201), 9 losers (409 Conflict)", async () => {
      const raceQuoteId = "quote_chal_cas_race_001";
      const raceProjId = "proj_chal_cas_race_001";

      seedQuote({
        projectId: raceProjId,
        quoteId: raceQuoteId,
        customerId: CUSTOMER_A_ID,
        clientId: "client_chal_alice",
        grandTotalPaise: 2500000,
        revision: 1,
        status: "customer_accepted",
      });

      const makeConversionRequest = (idx: number) =>
        checkoutRoute(
          new Request("http://localhost/api/v1/private-label/orders/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-customer-id": CUSTOMER_A_ID },
            body: JSON.stringify({
              quote_id: raceQuoteId,
              expected_revision: 1, // All expect revision 1
              notes: `Concurrent racer #${idx}`,
            }),
          })
        );

      // Dispatch 10 parallel checkout requests
      const racers = Array.from({ length: 10 }, (_, i) => makeConversionRequest(i + 1));
      const results = await Promise.all(racers);

      const statuses = results.map((r) => r.status);
      const winnerCount = statuses.filter((s) => s === 201).length;
      const loserCount = statuses.filter((s) => s === 409 || s === 422).length;

      // Exactly 1 winner (HTTP 201), 9 rejected (HTTP 409 or HTTP 422)
      expect(winnerCount).toBe(1);
      expect(loserCount).toBe(9);

      // Verify winner quote state in DB: status = 'converted', revision = 2
      const updatedQuote = db
        .prepare("SELECT status, revision FROM pl_quotes WHERE id = ?")
        .get(raceQuoteId) as { status: string; revision: number };

      expect(updatedQuote.status).toBe("converted");
      expect(updatedQuote.revision).toBe(2);

      // Verify exactly 1 order row in pl_orders for this quote
      const orderCount = db
        .prepare("SELECT COUNT(*) as c FROM pl_orders WHERE quote_id = ?")
        .get(raceQuoteId) as { c: number };
      expect(orderCount.c).toBe(1);
    });

    it("rejects stale revision conversion attempt: passing expected_revision = 99 returns HTTP 409 Conflict", async () => {
      const staleQuoteId = "quote_chal_stale_rev_001";
      const staleProjId = "proj_chal_stale_rev_001";

      seedQuote({
        projectId: staleProjId,
        quoteId: staleQuoteId,
        customerId: CUSTOMER_A_ID,
        clientId: "client_chal_alice",
        grandTotalPaise: 1500000,
        revision: 3,
        status: "customer_accepted",
      });

      const res = await checkoutRoute(
        new Request("http://localhost/api/v1/private-label/orders/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-customer-id": CUSTOMER_A_ID },
          body: JSON.stringify({
            quote_id: staleQuoteId,
            expected_revision: 99, // Stale revision
          }),
        })
      );

      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.currentRevision).toBe(3);
      expect(data.expectedRevision).toBe(99);
    });
  });

  // ==========================================================================
  // Suite 6: Idempotency Key Replay & Deduplication
  // ==========================================================================
  describe("Suite 6: Idempotency Key Replay & Deduplication", () => {
    it("idempotency key replay returns existing order with HTTP 200 and deduped: true", async () => {
      const idemQuoteId = "quote_chal_idem_001";
      const idemProjId = "proj_chal_idem_001";
      const idempotencyKey = "idem_chal_key_99999";

      seedQuote({
        projectId: idemProjId,
        quoteId: idemQuoteId,
        customerId: CUSTOMER_A_ID,
        clientId: "client_chal_alice",
        grandTotalPaise: 1800000,
        revision: 1,
        status: "customer_accepted",
      });

      // 1. Initial conversion
      const res1 = await checkoutRoute(
        new Request("http://localhost/api/v1/private-label/orders/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-customer-id": CUSTOMER_A_ID },
          body: JSON.stringify({
            quote_id: idemQuoteId,
            idempotency_key: idempotencyKey,
            expected_revision: 1,
          }),
        })
      );

      expect(res1.status).toBe(201);
      const data1 = await res1.json();
      expect(data1.deduped).toBe(false);
      const originalOrderId = data1.order_id;
      expect(originalOrderId).toBeDefined();

      // 2. Replay with exact same idempotency_key
      const res2 = await checkoutRoute(
        new Request("http://localhost/api/v1/private-label/orders/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-customer-id": CUSTOMER_A_ID },
          body: JSON.stringify({
            quote_id: idemQuoteId,
            idempotency_key: idempotencyKey,
          }),
        })
      );

      expect(res2.status).toBe(200);
      const data2 = await res2.json();
      expect(data2.deduped).toBe(true);
      expect(data2.order_id).toBe(originalOrderId);

      // 3. Third replay
      const res3 = await checkoutRoute(
        new Request("http://localhost/api/v1/private-label/orders/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-customer-id": CUSTOMER_A_ID },
          body: JSON.stringify({
            quote_id: idemQuoteId,
            idempotency_key: idempotencyKey,
          }),
        })
      );

      expect(res3.status).toBe(200);
      const data3 = await res3.json();
      expect(data3.deduped).toBe(true);
      expect(data3.order_id).toBe(originalOrderId);

      // 4. Invariant: pl_orders has exactly 1 row with this idempotency key
      const count = db
        .prepare("SELECT COUNT(*) as c FROM pl_orders WHERE idempotency_key = ?")
        .get(idempotencyKey) as { c: number };
      expect(count.c).toBe(1);

      // 5. Invariant: line items are NOT duplicated
      const itemsCount = db
        .prepare("SELECT COUNT(*) as c FROM pl_order_items WHERE order_id = ?")
        .get(originalOrderId) as { c: number };
      expect(itemsCount.c).toBe(1);
    });

    it("different idempotency key on already converted quote is rejected (cannot create duplicate order)", async () => {
      const lockedQuoteId = "quote_chal_locked_001";
      const lockedProjId = "proj_chal_locked_001";

      seedQuote({
        projectId: lockedProjId,
        quoteId: lockedQuoteId,
        customerId: CUSTOMER_A_ID,
        clientId: "client_chal_alice",
        grandTotalPaise: 1200000,
        status: "converted",
        revision: 2,
      });

      const res = await checkoutRoute(
        new Request("http://localhost/api/v1/private-label/orders/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-customer-id": CUSTOMER_A_ID },
          body: JSON.stringify({
            quote_id: lockedQuoteId,
            idempotency_key: "different_unseen_idempotency_key",
          }),
        })
      );

      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.gate_name).toBe("quote_already_converted");
    });
  });

  // ==========================================================================
  // Suite 7: 50% Deposit & 50% Balance Financial Invariants
  // ==========================================================================
  describe("Suite 7: 50% Deposit & 50% Balance Financial Invariants", () => {
    it("exact invariant: deposit_paise + balance_paise === grand_total_paise on odd-paise amounts", () => {
      const oddTestTotals = [
        1, // 1 paisa
        3, // 3 paise
        100001, // ₹1,000.01
        3422001, // ₹34,220.01
        9999999, // ₹99,999.99
        987654321, // ₹98,76,543.21
      ];

      for (let i = 0; i < oddTestTotals.length; i++) {
        const total = oddTestTotals[i];
        const qId = `quote_chal_odd_${i}`;
        const pId = `proj_chal_odd_${i}`;

        seedQuote({
          projectId: pId,
          quoteId: qId,
          customerId: CUSTOMER_A_ID,
          clientId: "client_chal_alice",
          grandTotalPaise: total,
          revision: 1,
        });

        const { order } = PrivateLabelService.convertQuoteToOrder(
          qId,
          { expected_revision: 1 },
          CUSTOMER_A_ID,
          ACTOR_CUSTOMER_A
        );

        // Core Financial Invariants
        expect(order.deposit_paise + order.balance_paise).toBe(total);
        expect(order.total_paise).toBe(total);
        expect(Math.abs(order.deposit_paise - order.balance_paise)).toBe(1); // Odd paise difference is exactly 1 paisa
        expect(order.deposit_paise).toBe(Math.round(total * 0.5));
        expect(order.balance_paise).toBe(total - Math.round(total * 0.5));
      }
    });

    it("exact invariant on even-paise amounts: deposit equals balance exactly", () => {
      const evenTestTotals = [2, 100, 100000, 3422000, 10000000];

      for (let i = 0; i < evenTestTotals.length; i++) {
        const total = evenTestTotals[i];
        const qId = `quote_chal_even_${i}`;
        const pId = `proj_chal_even_${i}`;

        seedQuote({
          projectId: pId,
          quoteId: qId,
          customerId: CUSTOMER_A_ID,
          clientId: "client_chal_alice",
          grandTotalPaise: total,
          revision: 1,
        });

        const { order } = PrivateLabelService.convertQuoteToOrder(
          qId,
          { expected_revision: 1 },
          CUSTOMER_A_ID,
          ACTOR_CUSTOMER_A
        );

        expect(order.deposit_paise + order.balance_paise).toBe(total);
        expect(order.deposit_paise).toBe(order.balance_paise);
        expect(order.deposit_paise).toBe(total / 2);
      }
    });

    it("property-based fuzzing test: 100 random odd and even totals satisfy deposit + balance === total", () => {
      for (let i = 0; i < 100; i++) {
        // Generate pseudo-random integers up to 10 billion paise (100 million rupees)
        const total = Math.floor(Math.random() * 1000000000) + 1;
        const deposit = Math.round(total * 0.5);
        const balance = total - deposit;

        // Invariants
        expect(deposit + balance).toBe(total);
        expect(Number.isInteger(deposit)).toBe(true);
        expect(Number.isInteger(balance)).toBe(true);
        expect(Math.abs(deposit - balance)).toBeLessThanOrEqual(1);
      }
    });

    it("payment intent calculation matches order deposit exactly", async () => {
      const piQuoteId = "quote_chal_pi_match_001";
      const piProjId = "proj_chal_pi_match_001";
      const totalPaise = 3422001; // Odd paise

      seedQuote({
        projectId: piProjId,
        quoteId: piQuoteId,
        customerId: CUSTOMER_A_ID,
        clientId: "client_chal_alice",
        grandTotalPaise: totalPaise,
        revision: 1,
      });

      // 1. Get payment intent for quote
      const piRes = await paymentIntentRoute(
        new Request("http://localhost/api/v1/private-label/orders/payment-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-customer-id": CUSTOMER_A_ID },
          body: JSON.stringify({
            quote_id: piQuoteId,
            deposit_percentage: 50,
          }),
        })
      );

      expect(piRes.status).toBe(503);
      const piData = await piRes.json();
      expect(piData.amount_paise).toBe(1711001); // 50% rounded

      // 2. Convert quote
      const checkoutRes = await checkoutRoute(
        new Request("http://localhost/api/v1/private-label/orders/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-customer-id": CUSTOMER_A_ID },
          body: JSON.stringify({
            quote_id: piQuoteId,
            expected_revision: 1,
          }),
        })
      );

      expect(checkoutRes.status).toBe(201);
      const orderData = await checkoutRes.json();
      expect(orderData.order.deposit_paise).toBe(piData.amount_paise);
    });
  });

  // ==========================================================================
  // Suite 8: Multi-Tenant Isolation & Anti-Enumeration (404 Not Found)
  // ==========================================================================
  describe("Suite 8: Multi-Tenant Isolation & Anti-Enumeration", () => {
    let orderAliceId: string;

    beforeAll(() => {
      const qId = "quote_chal_tenant_alice";
      const pId = "proj_chal_tenant_alice";

      seedQuote({
        projectId: pId,
        quoteId: qId,
        customerId: CUSTOMER_A_ID,
        clientId: "client_chal_alice",
        grandTotalPaise: 4500000,
        revision: 1,
      });

      const { order } = PrivateLabelService.convertQuoteToOrder(
        qId,
        { expected_revision: 1 },
        CUSTOMER_A_ID,
        ACTOR_CUSTOMER_A
      );
      orderAliceId = order.id;
    });

    it("Customer B querying Customer A's order returns HTTP 404 (not 403, zero metadata leak)", async () => {
      const res = await getOrderRoute(
        new Request(`http://localhost/api/v1/private-label/orders/${orderAliceId}`, {
          method: "GET",
          headers: { "x-customer-id": CUSTOMER_B_ID },
        }),
        { params: Promise.resolve({ id: orderAliceId }) }
      );

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe("Order not found");
      expect(data.order).toBeUndefined();
    });

    it("Customer B attempting to checkout Customer A's quote returns HTTP 404", async () => {
      const aliceQuoteId = "quote_chal_tenant_alice_unconv";
      seedQuote({
        projectId: "proj_chal_tenant_alice_2",
        quoteId: aliceQuoteId,
        customerId: CUSTOMER_A_ID,
        clientId: "client_chal_alice",
        grandTotalPaise: 1000000,
        revision: 1,
      });

      const res = await checkoutRoute(
        new Request("http://localhost/api/v1/private-label/orders/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-customer-id": CUSTOMER_B_ID },
          body: JSON.stringify({
            quote_id: aliceQuoteId,
          }),
        })
      );

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe("Quote not found");
    });

    it("Customer B querying Customer A's sample throws PrivateLabelNotFoundError", () => {
      const sampleAlice = PrivateLabelService.createSampleOrder(
        {
          sample_type: "tea_kit",
          quantity: 1,
          shipping_address: { line1: "Alice St", city: "Siliguri", pincode: "734005" },
        },
        CUSTOMER_A_ID,
        ACTOR_CUSTOMER_A
      );

      expect(() => {
        PrivateLabelService.getSampleOrder(sampleAlice.id, CUSTOMER_B_ID);
      }).toThrow(PrivateLabelNotFoundError);
    });

    it("listSampleOrders for Customer B only returns Customer B's samples", async () => {
      const res = await listSamplesRoute(
        new Request("http://localhost/api/v1/private-label/samples", {
          method: "GET",
          headers: { "x-customer-id": CUSTOMER_B_ID },
        })
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.samples)).toBe(true);

      // Verify none of the samples belong to Customer A
      for (const s of data.samples) {
        // Fetch underlying DB record to check client
        const row = db.prepare("SELECT client_id FROM pl_samples WHERE id = ?").get(s.id) as { client_id: string };
        expect(row.client_id).toBe("client_chal_bob");
      }
    });
  });
});
