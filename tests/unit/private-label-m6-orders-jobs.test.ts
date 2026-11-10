import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { rmSync } from "node:fs";
import { PrivateLabelService } from "@/lib/private-label/service";
import {
  PrivateLabelNotFoundError,
  PrivateLabelRevisionConflictError,
  PrivateLabelGateError,
  type AuditActor,
  type SampleOrder,
  type ProductionOrder,
  type ProductionJob,
} from "@/lib/private-label/types";
import {
  toPublicSampleOrderDto,
  toPublicProductionOrderDto,
  toPublicProductionJobDto,
} from "@/lib/private-label/public-dto";

const ACTOR_CUSTOMER_A: AuditActor = {
  actor_type: "customer",
  actor_id: "cust_m6_alice",
  actor_email: "alice@teafloww-test.com",
};

const ACTOR_CUSTOMER_B: AuditActor = {
  actor_type: "customer",
  actor_id: "cust_m6_bob",
  actor_email: "bob@teafloww-test.com",
};

const ACTOR_ADMIN: AuditActor = {
  actor_type: "admin",
  actor_id: "admin_m6_qc",
  actor_email: "siliguri-cleanroom@teafloww.com",
};

describe("Milestone M6: Samples, Orders & Production Lifecycle", () => {
  let testDbPath: string;
  let db: Database.Database;

  beforeAll(() => {
    testDbPath = path.join(tmpdir(), `pl-m6-test-${process.pid}-${Date.now()}.sqlite`);
    process.env.DATABASE_PATH = testDbPath;

    // Apply all migrations up through 049
    execFileSync(process.execPath, ["scripts/migrate.mjs"], {
      env: { ...process.env, DATABASE_PATH: testDbPath },
    });

    db = new Database(testDbPath);
    db.pragma("foreign_keys = ON");

    // Seed initial catalog (price books, packaging families, print methods)
    PrivateLabelService.seedInitialCatalog();

    // Seed required test customer records (for foreign key satisfaction)
    db.prepare(`
      INSERT OR IGNORE INTO customers (id, email, name)
      VALUES (?, ?, 'Alice Smith'),
             (?, ?, 'Bob Jones')
    `).run(
      ACTOR_CUSTOMER_A.actor_id,
      ACTOR_CUSTOMER_A.actor_email,
      ACTOR_CUSTOMER_B.actor_id,
      ACTOR_CUSTOMER_B.actor_email
    );

    // Seed test clients
    db.prepare(`
      INSERT OR IGNORE INTO pl_clients (id, customer_id, company_name, contact_name, contact_email)
      VALUES ('client_m6_alice', ?, 'Alice Fine Teas', 'Alice Smith', ?),
             ('client_m6_bob', ?, 'Bob Tea Merchants', 'Bob Jones', ?)
    `).run(
      ACTOR_CUSTOMER_A.actor_id,
      ACTOR_CUSTOMER_A.actor_email,
      ACTOR_CUSTOMER_B.actor_id,
      ACTOR_CUSTOMER_B.actor_email
    );
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
  // 1. Migration 049 Schema Verification
  // ==========================================================================
  describe("1. Migration 049 Schema & DDL Integrity", () => {
    it("verifies migration 049_private_label_orders_production is registered in schema_migrations", () => {
      const row = db
        .prepare("SELECT version FROM schema_migrations WHERE version LIKE '049_%'")
        .get() as { version: string } | undefined;
      expect(row).toBeDefined();
      expect(row?.version).toBe("049_private_label_orders_production");
    });

    it("verifies pl_orders has all additive M6 columns and indexes", () => {
      const cols = db
        .prepare("PRAGMA table_info(pl_orders)")
        .all()
        .map((c: any) => c.name);

      expect(cols).toContain("project_id");
      expect(cols).toContain("idempotency_key");
      expect(cols).toContain("currency");
      expect(cols).toContain("total_paise");
      expect(cols).toContain("shipping_address_json");
      expect(cols).toContain("notes");

      const indexes = db
        .prepare("PRAGMA index_list(pl_orders)")
        .all()
        .map((i: any) => i.name);
      expect(indexes).toContain("idx_pl_orders_idempotency");
      expect(indexes).toContain("idx_pl_orders_project");
    });

    it("verifies pl_samples has all additive M6 columns and indexes", () => {
      const cols = db
        .prepare("PRAGMA table_info(pl_samples)")
        .all()
        .map((c: any) => c.name);

      expect(cols).toContain("quantity");
      expect(cols).toContain("coupon_code");
      expect(cols).toContain("revision");
      expect(cols).toContain("tea_recipe_ids_json");
      expect(cols).toContain("notes");

      const indexes = db
        .prepare("PRAGMA index_list(pl_samples)")
        .all()
        .map((i: any) => i.name);
      expect(indexes).toContain("idx_pl_samples_coupon");
    });

    it("verifies pl_jobs and pl_qc_milestones have additive M6 columns", () => {
      const jobCols = db
        .prepare("PRAGMA table_info(pl_jobs)")
        .all()
        .map((c: any) => c.name);
      expect(jobCols).toContain("override_justification");
      expect(jobCols).toContain("revision");

      const qcCols = db
        .prepare("PRAGMA table_info(pl_qc_milestones)")
        .all()
        .map((c: any) => c.name);
      expect(qcCols).toContain("cupping_score");
      expect(qcCols).toContain("recorded_weight_g");
      expect(qcCols).toContain("target_weight_g");
      expect(qcCols).toContain("notes");
      expect(qcCols).toContain("updated_at");
    });

    it("verifies pl_sample_orders view exists and is queryable", () => {
      const rows = db.prepare("SELECT * FROM pl_sample_orders LIMIT 1").all();
      expect(Array.isArray(rows)).toBe(true);
    });
  });

  // ==========================================================================
  // 2. Sample Orders Domain
  // ==========================================================================
  describe("2. Sample Orders Domain", () => {
    it("creates sample order with standard pricing and valid address", () => {
      const sample = PrivateLabelService.createSampleOrder(
        {
          sample_type: "tea_kit",
          quantity: 2,
          amount_paise: 75000, // Client passes untrusted 75000, server computes authoritatively 75000 * 2 = 150000
          shipping_address: {
            line1: "123 Darjeeling Way",
            city: "Siliguri",
            state: "West Bengal",
            pincode: "734005",
          },
          notes: "Focus on Spring First Flush lots",
        },
        ACTOR_CUSTOMER_A.actor_id,
        ACTOR_CUSTOMER_A
      );

      expect(sample.id).toMatch(/^samp_/);
      expect(sample.status).toBe("requested");
      expect(sample.quantity).toBe(2);
      expect(sample.amount_paise).toBe(150000); // Server-authoritative: 75,000 paise * 2
      expect(sample.sample_number).toContain("PL-SMP-");

      // Verify sample items were created
      const fetched = PrivateLabelService.getSampleOrder(sample.id, ACTOR_CUSTOMER_A.actor_id);
      expect(fetched.id).toBe(sample.id);
      expect(fetched.items).toBeDefined();
    });

    it("rejects sample order request with quantity > 10 (capping rule)", () => {
      expect(() => {
        PrivateLabelService.createSampleOrder(
          {
            sample_type: "packaged_mockup",
            quantity: 11, // Exceeds 10 limit
            amount_paise: 49900,
            shipping_address: {
              line1: "123 Darjeeling Way",
              city: "Siliguri",
              state: "West Bengal",
              pincode: "734005",
            },
          },
          ACTOR_CUSTOMER_A.actor_id,
          ACTOR_CUSTOMER_A
        );
      }).toThrowError(/Maximum sample quantity/);
    });

    it("rejects invalid Indian PIN code (< 6 digits or non-numeric)", () => {
      expect(() => {
        PrivateLabelService.createSampleOrder(
          {
            sample_type: "packaged_mockup",
            quantity: 1,
            shipping_address: {
              line1: "123 Darjeeling Way",
              city: "Siliguri",
              state: "West Bengal",
              pincode: "123", // invalid pin
            },
          },
          ACTOR_CUSTOMER_A.actor_id,
          ACTOR_CUSTOMER_A
        );
      }).toThrowError(/valid 6-digit Indian PIN code/);
    });

    it("applies SAMPLEFREE100 coupon code for 100% discount and enforces single-use per client", () => {
      // First order with coupon should succeed and set amount_paise to 0
      const freeSample = PrivateLabelService.createSampleOrder(
        {
          sample_type: "full_pack_sample",
          quantity: 1,
          amount_paise: 250000,
          coupon_code: "SAMPLEFREE100",
          shipping_address: {
            line1: "123 Darjeeling Way",
            city: "Siliguri",
            state: "West Bengal",
            pincode: "734005",
          },
        },
        ACTOR_CUSTOMER_A.actor_id,
        ACTOR_CUSTOMER_A
      );

      expect(freeSample.amount_paise).toBe(0);
      expect(freeSample.coupon_code).toBe("SAMPLEFREE100");

      // Second attempt by the same client with SAMPLEFREE100 must throw coupon_already_used
      expect(() => {
        PrivateLabelService.createSampleOrder(
          {
            sample_type: "tea_kit",
            quantity: 1,
            amount_paise: 75000,
            coupon_code: "SAMPLEFREE100",
            shipping_address: {
              line1: "123 Darjeeling Way",
              city: "Siliguri",
              state: "West Bengal",
              pincode: "734005",
            },
          },
          ACTOR_CUSTOMER_A.actor_id,
          ACTOR_CUSTOMER_A
        );
      }).toThrowError(/already been used/);
    });

    it("allows customer cancellation while in requested status, but blocks cancellation after dispatch", () => {
      const cancellable = PrivateLabelService.createSampleOrder(
        {
          sample_type: "tea_kit",
          quantity: 1,
          shipping_address: { line1: "Test St", city: "Siliguri", pincode: "734001" },
        },
        ACTOR_CUSTOMER_A.actor_id,
        ACTOR_CUSTOMER_A
      );

      const cancelled = PrivateLabelService.cancelSampleOrder(
        cancellable.id,
        ACTOR_CUSTOMER_A.actor_id,
        ACTOR_CUSTOMER_A
      );
      expect(cancelled.status).toBe("rejected");

      // Now create another sample and dispatch it
      const dispatchedSample = PrivateLabelService.createSampleOrder(
        {
          sample_type: "tea_kit",
          quantity: 1,
          shipping_address: { line1: "Test St", city: "Siliguri", pincode: "734001" },
        },
        ACTOR_CUSTOMER_A.actor_id,
        ACTOR_CUSTOMER_A
      );

      const dispatchedResult = PrivateLabelService.dispatchSampleOrder(
        dispatchedSample.id,
        { carrier: "BlueDart", tracking_number: "BD12345678IN" },
        ACTOR_ADMIN
      );
      expect(dispatchedResult.status).toBe("dispatched");
      expect(dispatchedResult.carrier).toBe("BlueDart");
      expect(dispatchedResult.tracking_number).toBe("BD12345678IN");

      // Attempting to cancel dispatched sample must be rejected with PrivateLabelGateError
      expect(() => {
        PrivateLabelService.cancelSampleOrder(
          dispatchedSample.id,
          ACTOR_CUSTOMER_A.actor_id,
          ACTOR_CUSTOMER_A
        );
      }).toThrowError(/Cannot cancel sample order in status 'dispatched'/);
    });

    it("enforces multi-tenant anti-enumeration: Customer B cannot access Customer A's sample", () => {
      const sampleA = PrivateLabelService.createSampleOrder(
        {
          sample_type: "tea_kit",
          quantity: 1,
          shipping_address: { line1: "Secret St", city: "Siliguri", pincode: "734001" },
        },
        ACTOR_CUSTOMER_A.actor_id,
        ACTOR_CUSTOMER_A
      );

      // Customer B trying to fetch Customer A's sample must throw PrivateLabelNotFoundError (404)
      expect(() => {
        PrivateLabelService.getSampleOrder(sampleA.id, ACTOR_CUSTOMER_B.actor_id);
      }).toThrow(PrivateLabelNotFoundError);

      // Customer B trying to cancel Customer A's sample must throw PrivateLabelNotFoundError
      expect(() => {
        PrivateLabelService.cancelSampleOrder(sampleA.id, ACTOR_CUSTOMER_B.actor_id, ACTOR_CUSTOMER_B);
      }).toThrow(PrivateLabelNotFoundError);
    });

    it("dispatches sample order with explicit carrier, storing carrier in pl_samples and pl_audit", () => {
      // 1. Create a sample order
      const sample = PrivateLabelService.createSampleOrder(
        {
          sample_type: "tea_kit",
          quantity: 1,
          shipping_address: { line1: "123 Hill Road", city: "Siliguri", pincode: "734001" },
        },
        ACTOR_CUSTOMER_A.actor_id,
        ACTOR_CUSTOMER_A
      );
      expect(sample.status).toBe("requested");
      expect(sample.carrier).toBeNull();
      expect(sample.tracking_number).toBeNull();

      // 2. Dispatch with explicit carrier 'Blue Dart'
      const dispatched = PrivateLabelService.dispatchSampleOrder(
        sample.id,
        { carrier: "Blue Dart", tracking_number: "BD-9876543210" },
        ACTOR_ADMIN
      );

      // Verify returned domain model
      expect(dispatched.status).toBe("dispatched");
      expect(dispatched.carrier).toBe("Blue Dart");
      expect(dispatched.tracking_number).toBe("BD-9876543210");

      // Verify direct database persistence in pl_samples
      const dbRow = db.prepare("SELECT status, carrier, tracking_number FROM pl_samples WHERE id = ?").get(sample.id) as {
        status: string;
        carrier: string | null;
        tracking_number: string | null;
      };
      expect(dbRow.status).toBe("dispatched");
      expect(dbRow.carrier).toBe("Blue Dart");
      expect(dbRow.tracking_number).toBe("BD-9876543210");

      // Verify audit record in pl_audit
      const audit = db.prepare(
        "SELECT action, diff_json FROM pl_audit WHERE entity_id = ? AND action = 'dispatch_sample_order' ORDER BY created_at DESC LIMIT 1"
      ).get(sample.id) as { action: string; diff_json: string };
      expect(audit).toBeDefined();
      const diff = JSON.parse(audit.diff_json);
      expect(diff.carrier).toBe("Blue Dart");
      expect(diff.trackingNumber).toBe("BD-9876543210");

      // Verify public DTO projection passes authentic carrier
      const publicDto = toPublicSampleOrderDto(dispatched);
      expect(publicDto.carrier).toBe("Blue Dart");
      expect(publicDto.tracking_number).toBe("BD-9876543210");
    });

    it("dispatches sample order without carrier, storing null and NEVER defaulting to Delhivery", () => {
      // 1. Create a sample order
      const sample = PrivateLabelService.createSampleOrder(
        {
          sample_type: "packaged_mockup",
          quantity: 1,
          shipping_address: { line1: "456 Valley View", city: "Darjeeling", pincode: "734101" },
        },
        ACTOR_CUSTOMER_A.actor_id,
        ACTOR_CUSTOMER_A
      );
      expect(sample.status).toBe("requested");
      expect(sample.carrier).toBeNull();

      // 2. Dispatch with tracking number only (carrier/courier omitted)
      const dispatched = PrivateLabelService.dispatchSampleOrder(
        sample.id,
        { tracking_number: "SPEEDPOST-771122" },
        ACTOR_ADMIN
      );

      // Verify returned domain model: carrier is strictly null, never 'Delhivery'
      expect(dispatched.status).toBe("dispatched");
      expect(dispatched.carrier).toBeNull();
      expect(dispatched.carrier).not.toBe("Delhivery");
      expect(dispatched.tracking_number).toBe("SPEEDPOST-771122");

      // Verify direct database persistence in pl_samples: carrier is NULL in SQLite
      const dbRow = db.prepare("SELECT status, carrier, tracking_number FROM pl_samples WHERE id = ?").get(sample.id) as {
        status: string;
        carrier: string | null;
        tracking_number: string | null;
      };
      expect(dbRow.status).toBe("dispatched");
      expect(dbRow.carrier).toBeNull();
      expect(dbRow.carrier).not.toBe("Delhivery");
      expect(dbRow.tracking_number).toBe("SPEEDPOST-771122");

      // Verify audit record in pl_audit: carrier recorded as null without fabrication
      const audit = db.prepare(
        "SELECT action, diff_json FROM pl_audit WHERE entity_id = ? AND action = 'dispatch_sample_order' ORDER BY created_at DESC LIMIT 1"
      ).get(sample.id) as { action: string; diff_json: string };
      expect(audit).toBeDefined();
      const diff = JSON.parse(audit.diff_json);
      expect(diff.carrier).toBeNull();
      expect(diff.carrier).not.toBe("Delhivery");
      expect(diff.trackingNumber).toBe("SPEEDPOST-771122");
      expect(audit.diff_json).not.toContain("Delhivery");

      // Verify public DTO projection does not fabricate carrier
      const publicDto = toPublicSampleOrderDto(dispatched);
      expect(publicDto.carrier).toBeNull();
      expect(publicDto.carrier).not.toBe("Delhivery");
      expect(publicDto.tracking_number).toBe("SPEEDPOST-771122");
    });

    it("dispatches sample order with courier property alias", () => {
      const sample = PrivateLabelService.createSampleOrder(
        {
          sample_type: "tea_kit",
          quantity: 1,
          shipping_address: { line1: "789 Pine Grove", city: "Kurseong", pincode: "734203" },
        },
        ACTOR_CUSTOMER_A.actor_id,
        ACTOR_CUSTOMER_A
      );

      // Pass tracking object using courier alias
      const dispatched = PrivateLabelService.dispatchSampleOrder(
        sample.id,
        { courier: "DHL Express", tracking_number: "DHL-554433221" },
        ACTOR_ADMIN
      );

      expect(dispatched.carrier).toBe("DHL Express");
      expect(dispatched.tracking_number).toBe("DHL-554433221");
    });

    it("throws PrivateLabelNotFoundError when dispatching non-existent sample order", () => {
      expect(() => {
        PrivateLabelService.dispatchSampleOrder(
          "samp_nonexistent_99999",
          { tracking_number: "TRK-000000" },
          ACTOR_ADMIN
        );
      }).toThrow(PrivateLabelNotFoundError);
    });
  });

  // ==========================================================================
  // 3. Quote-to-Order Conversion, CAS & Idempotency
  // ==========================================================================
  describe("3. Quote-to-Order Conversion, CAS & Idempotency", () => {
    let projectId: string;
    let quoteId: string;
    let clientAId: string;

    beforeAll(() => {
      clientAId = "client_m6_alice";
      projectId = "proj_m6_001";
      quoteId = "quote_m6_001";

      db.prepare(`
        INSERT OR IGNORE INTO pl_projects (id, client_id, owner_customer_id, title, status)
        VALUES (?, ?, ?, 'Alice Royal Reserve Earl Grey', 'accepted')
      `).run(projectId, clientAId, ACTOR_CUSTOMER_A.actor_id);

      db.prepare(`
        INSERT OR IGNORE INTO pl_project_items (id, project_id, fill_weight_grams, quantity_units)
        VALUES ('pitem_m6_001', ?, 100, 1000)
      `).run(projectId);

      db.prepare(`
        INSERT OR IGNORE INTO pl_quotes (
          id, quote_number, project_id, price_book_id, status, version, revision,
          currency, tea_subtotal_paise, packaging_subtotal_paise, printing_subtotal_paise,
          tooling_setup_paise, labor_subtotal_paise, qc_subtotal_paise, freight_paise,
          tax_paise, grand_total_paise, issued_at, valid_until
        ) VALUES (
          ?, 'PL-Q-2026-9001', ?, 'pb_default_inr', 'customer_accepted', 1, 1,
          'INR', 1500000, 600000, 300000,
          100000, 200000, 100000, 100000,
          522000, 3422000, CURRENT_TIMESTAMP, datetime('now', '+30 days')
        )
      `).run(quoteId, projectId);
    });

    it("converts valid quote into production order with pending_deposit status", () => {
      const result = PrivateLabelService.convertQuoteToOrder(
        quoteId,
        {
          expected_revision: 1,
          idempotency_key: "idem_m6_test_001",
          shipping_address: {
            line1: "456 High Street",
            city: "Siliguri",
            state: "West Bengal",
            pincode: "734005",
          },
          notes: "Handle with humidity monitoring",
        },
        ACTOR_CUSTOMER_A.actor_id,
        ACTOR_CUSTOMER_A
      );

      expect(result.order).toBeDefined();
      expect(result.order.id).toMatch(/^order_/);
      expect(result.order.status).toBe("pending_deposit");
      expect(result.order.deposit_paise).toBe(1711000); // 50% of 3422000
      expect(result.order.balance_paise).toBe(1711000);
      expect(result.order.quote_id).toBe(quoteId);
      expect(result.order.project_id).toBe(projectId);
      expect(result.deduped).toBeFalsy();
      const invoice = PrivateLabelService.getOrderInvoice(result.order.id, ACTOR_CUSTOMER_A.actor_id);
      expect(invoice.tax_paise).toBe(522000);
      expect(invoice.subtotal_paise + invoice.tax_paise).toBe(invoice.total_paise);
      expect(invoice.total_paise).toBe(3422000);
      expect(invoice.deposit_paid).toBe(false);

      // Verify quote is marked as converted
      const updatedQuote = db.prepare("SELECT status, revision FROM pl_quotes WHERE id = ?").get(quoteId) as {
        status: string;
        revision: number;
      };
      expect(updatedQuote.status).toBe("converted");
      expect(updatedQuote.revision).toBe(2);
    });

    it("idempotency check: re-submitting with identical idempotency_key returns existing order", () => {
      const result = PrivateLabelService.convertQuoteToOrder(
        quoteId,
        {
          idempotency_key: "idem_m6_test_001", // same key as previous test
        },
        ACTOR_CUSTOMER_A.actor_id,
        ACTOR_CUSTOMER_A
      );

      expect(result.deduped).toBe(true);
      expect(result.order.idempotency_key).toBe("idem_m6_test_001");
      expect(result.order.status).toBe("pending_deposit");
    });

    it("enforces CAS optimistic concurrency revision check", () => {
      const casProjId = "proj_m6_cas";
      const qId = "quote_m6_cas_test";

      db.prepare(`
        INSERT INTO pl_projects (id, client_id, owner_customer_id, title, status)
        VALUES (?, 'client_m6_alice', ?, 'CAS Test', 'accepted')
      `).run(casProjId, ACTOR_CUSTOMER_A.actor_id);

      db.prepare(`
        INSERT INTO pl_quotes (
          id, quote_number, project_id, price_book_id, status, version, revision,
          currency, grand_total_paise, valid_until
        ) VALUES (
          ?, 'PL-Q-CAS-001', ?, 'pb_default_inr', 'customer_accepted', 1, 3,
          'INR', 100000, datetime('now', '+10 days')
        )
      `).run(qId, casProjId);

      // Pass expected_revision: 2 when actual is 3 -> must throw PrivateLabelRevisionConflictError
      expect(() => {
        PrivateLabelService.convertQuoteToOrder(
          qId,
          { expected_revision: 2 },
          ACTOR_CUSTOMER_A.actor_id,
          ACTOR_CUSTOMER_A
        );
      }).toThrow(PrivateLabelRevisionConflictError);
    });

    it("rejects expired quote conversion with PrivateLabelGateError", () => {
      const expProjId = "proj_m6_exp";
      const expId = "quote_m6_expired";

      db.prepare(`
        INSERT INTO pl_projects (id, client_id, owner_customer_id, title, status)
        VALUES (?, 'client_m6_alice', ?, 'Expired Test', 'accepted')
      `).run(expProjId, ACTOR_CUSTOMER_A.actor_id);

      db.prepare(`
        INSERT INTO pl_quotes (
          id, quote_number, project_id, price_book_id, status, version, revision,
          currency, grand_total_paise, valid_until
        ) VALUES (
          ?, 'PL-Q-EXP-001', ?, 'pb_default_inr', 'customer_accepted', 1, 1,
          'INR', 100000, datetime('now', '-2 days')
        )
      `).run(expId, expProjId);

      expect(() => {
        PrivateLabelService.convertQuoteToOrder(
          expId,
          {},
          ACTOR_CUSTOMER_A.actor_id,
          ACTOR_CUSTOMER_A
        );
      }).toThrowError(/expired/);
    });
  });

  // ==========================================================================
  // 4. Deposit Payment Intent & Production Release Gate
  // ==========================================================================
  describe("4. Deposit Payment Intent & Release Gate Validation", () => {
    let orderId: string;
    let quoteId: string;
    let projectId: string;
    let designVersionId: string;

    beforeAll(() => {
      quoteId = "quote_m6_release_test";
      projectId = "proj_m6_release_test";
      orderId = "ord_m6_release_test";
      designVersionId = "dv_m6_release_test";

      db.prepare(`
        INSERT OR IGNORE INTO pl_projects (id, client_id, owner_customer_id, title, status)
        VALUES (?, 'client_m6_alice', ?, 'Cleanroom Gate Test', 'accepted')
      `).run(projectId, ACTOR_CUSTOMER_A.actor_id);

      db.prepare(`
        INSERT OR IGNORE INTO pl_project_items (id, project_id, fill_weight_grams, quantity_units)
        VALUES ('pitem_m6_gate', ?, 100, 1000)
      `).run(projectId);

      db.prepare(`
        INSERT OR IGNORE INTO pl_quotes (
          id, quote_number, project_id, price_book_id, status, grand_total_paise, valid_until
        ) VALUES (
          ?, 'PL-Q-REL-001', ?, 'pb_default_inr', 'converted', 2000000, datetime('now', '+30 days')
        )
      `).run(quoteId, projectId);

      db.prepare(`
        INSERT OR IGNORE INTO pl_orders (
          id, order_number, client_id, quote_id, project_id, status,
          deposit_paise, balance_paise, total_paise, revision, created_at, updated_at
        ) VALUES (
          ?, 'PL-ORD-REL-001', 'client_m6_alice', ?, ?, 'pending_deposit',
          1000000, 1000000, 2000000, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `).run(orderId, quoteId, projectId);

      db.prepare(`
        INSERT OR IGNORE INTO pl_design_versions (
          id, project_item_id, project_id, version_number, status, is_locked
        ) VALUES (
          ?, 'pitem_m6_gate', ?, 1, 'customer_approved', 1
        )
      `).run(designVersionId, projectId);
    });

    it("computes a deposit estimate without inventing a payment intent or settling the order", () => {
      const intent = PrivateLabelService.createOrderPaymentIntent(
        { orderId },
        ACTOR_CUSTOMER_A.actor_id
      );

      expect(intent.order_id).toBe(orderId);
      expect(intent.amount_paise).toBe(1000000); // 50% deposit
      expect(intent.deposit_percentage).toBe(50);
      expect(intent.currency).toBe("INR");
      expect(intent.available).toBe(false);
      expect(intent.status).toBe("payment_unavailable");
      expect(intent.client_secret).toBeUndefined();
      expect(intent.payment_intent_id).toBeUndefined();
      expect((db.prepare("SELECT status FROM pl_orders WHERE id = ?").get(orderId) as { status: string }).status).toBe("pending_deposit");

      // Mark order as deposit_paid to simulate settlement
      db.prepare(
        "UPDATE pl_orders SET status = 'deposit_paid', deposit_paid_at = CURRENT_TIMESTAMP WHERE id = ?"
      ).run(orderId);

      const order = db.prepare("SELECT status, deposit_paid_at FROM pl_orders WHERE id = ?").get(orderId) as {
        status: string;
        deposit_paid_at: string | null;
      };
      expect(order.status).toBe("deposit_paid");
      expect(order.deposit_paid_at).toBeTruthy();
    });

    it("validates release gates: deposit paid + proof approved", () => {
      // First, without approval event: should report blocker
      db.prepare("DELETE FROM pl_approval_events WHERE design_version_id = ?").run(designVersionId);

      const blockedGate = PrivateLabelService.validateReleaseGate(orderId);
      expect(blockedGate.eligible).toBe(false);
      expect(blockedGate.blockers.some((b) => b.includes("Artwork proof approval"))).toBe(true);

      // Now record customer approval event
      db.prepare(`
        INSERT INTO pl_approval_events (
          id, design_version_id, client_id, actor_type, actor_id, actor_name, action, signer_name, disclaimer_text, created_at
        ) VALUES (
          'appr_m6_test', ?, 'client_m6_alice', 'customer', 'cust_m6_alice', 'Alice Smith', 'customer_approved',
          'Alice Smith', 'Authorized for production', CURRENT_TIMESTAMP
        )
      `).run(designVersionId);

      const satisfiedGate = PrivateLabelService.validateReleaseGate(orderId);
      expect(satisfiedGate.eligible).toBe(true);
      expect(satisfiedGate.blockers).toHaveLength(0);
      expect(satisfiedGate.deposit_status).toBe("deposit_paid");
      expect(satisfiedGate.proof_status).toBe("customer_approved");
    });

    it("releases production job, creates 7 QC milestones, and transitions order to production_released", () => {
      const job = PrivateLabelService.releaseProductionJob(
        orderId,
        {
          target_completion_date: "2026-12-15",
          operator_notes: "Cleanroom Line 1 Nitrogen Flush",
          operator_id: ACTOR_ADMIN.actor_id,
        },
        ACTOR_ADMIN
      );

      expect(job.id).toMatch(/^job_/);
      expect(job.job_number).toContain("PL-JOB-");
      expect(job.status).toBe("scheduled");

      // Verify order transitioned to production_released
      const order = db.prepare("SELECT status FROM pl_orders WHERE id = ?").get(orderId) as { status: string };
      expect(order.status).toBe("production_released");

      // Verify all 7 QC milestones were initialized in pending status
      const jobWithMilestones = PrivateLabelService.getProductionJob(job.id);
      expect(jobWithMilestones.milestones).toHaveLength(7);
      const stages = jobWithMilestones.milestones.map((m) => m.stage);
      expect(stages).toContain("raw_material");
      expect(stages).toContain("packaging_incoming");
      expect(stages).toContain("print_proof");
      expect(stages).toContain("fill_weight");
      expect(stages).toContain("seal_integrity");
      expect(stages).toContain("sensory_cupping");
      expect(stages).toContain("final_pack");
      expect(jobWithMilestones.milestones.every((m) => m.status === "pending")).toBe(true);
    });

    it("allows emergency release with override justification when prerequisites are unfulfilled", () => {
      const emergQuoteId = "quote_m6_emergency";
      const blockedOrderId = "ord_m6_emergency_test";

      db.prepare(`
        INSERT INTO pl_quotes (
          id, quote_number, project_id, price_book_id, status, grand_total_paise, valid_until
        ) VALUES (
          ?, 'PL-Q-EMERG-001', 'proj_m6_release_test', 'pb_default_inr', 'converted', 1000000, datetime('now', '+30 days')
        )
      `).run(emergQuoteId);

      db.prepare(`
        INSERT INTO pl_orders (
          id, order_number, client_id, quote_id, project_id, status,
          deposit_paise, balance_paise, total_paise, revision, created_at, updated_at
        ) VALUES (
          ?, 'PL-ORD-EMERG-001', 'client_m6_alice', ?, 'proj_m6_release_test', 'pending_deposit',
          500000, 500000, 1000000, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `).run(blockedOrderId, emergQuoteId);

      // Attempting release without override must throw PrivateLabelGateError
      expect(() => {
        PrivateLabelService.releaseProductionJob(
          blockedOrderId,
          { operator_notes: "Unapproved rush" },
          ACTOR_ADMIN
        );
      }).toThrow(PrivateLabelGateError);

      // Attempting release with override_justification must succeed
      const emergencyJob = PrivateLabelService.releaseProductionJob(
        blockedOrderId,
        {
          operator_notes: "VIP signed physical agreement offline",
          override_justification: "Authorized by Factory Director per Offline Agreement #8821",
        },
        ACTOR_ADMIN
      );

      expect(emergencyJob.id).toMatch(/^job_/);
      expect(emergencyJob.override_justification).toBe(
        "Authorized by Factory Director per Offline Agreement #8821"
      );
    });
  });

  // ==========================================================================
  // 5. Cleanroom QC Milestones & Quality Gates
  // ==========================================================================
  describe("5. Cleanroom QC Milestones, FSSAI Tolerance & Critical Halts", () => {
    let jobId: string;
    let orderId: string;

    beforeAll(() => {
      orderId = "ord_m6_qc_testing";
      jobId = "job_m6_qc_testing";

      db.prepare(`
        INSERT INTO pl_orders (
          id, order_number, client_id, quote_id, project_id, status,
          deposit_paise, balance_paise, total_paise, revision, created_at, updated_at
        ) VALUES (
          ?, 'PL-ORD-QC-001', 'client_m6_alice', 'quote_m6_release_test', 'proj_m6_release_test', 'production_released',
          1000000, 1000000, 2000000, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `).run(orderId);

      db.prepare(`
        INSERT INTO pl_jobs (
          id, job_number, order_id, status, released_by, revision, created_at, updated_at
        ) VALUES (
          ?, 'PL-JOB-QC-001', ?, 'filling_packing', 'admin_m6_qc', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `).run(jobId, orderId);

      // Insert the 7 milestones
      const stages = [
        "raw_material",
        "packaging_incoming",
        "print_proof",
        "fill_weight",
        "seal_integrity",
        "sensory_cupping",
        "final_pack",
      ];
      for (const s of stages) {
        db.prepare(`
          INSERT INTO pl_qc_milestones (id, job_id, milestone_name, stage, status, created_at)
          VALUES ('qc_${s}_${Date.now()}', ?, 'Stage: ${s}', ?, 'pending', CURRENT_TIMESTAMP)
        `).run(jobId, s);
      }
    });

    it("enforces FSSAI +/-1.5% net weight tolerance rule on fill_weight stage", () => {
      // Case A: 100g target, 101.2g actual -> variance 1.2% (within 1.5% limit) -> ACCEPTED
      const passedMilestone = PrivateLabelService.recordQCMilestone(
        jobId,
        {
          stage: "fill_weight",
          status: "passed",
          inspector_name: "Siliguri QC Station 3",
          recorded_weight_g: 101.2,
          target_weight_g: 100.0,
          evidence_notes: "Line calibrated at 22C",
        },
        ACTOR_ADMIN
      );

      expect(passedMilestone.status).toBe("passed");
      expect(passedMilestone.recorded_weight_g).toBe(101.2);
      expect(passedMilestone.target_weight_g).toBe(100.0);

      // Case B: 100g target, 102.5g actual -> variance 2.5% (> 1.5% limit) -> REJECTED with fssai_weight_tolerance
      expect(() => {
        PrivateLabelService.recordQCMilestone(
          jobId,
          {
            stage: "fill_weight",
            status: "passed",
            inspector_name: "Siliguri QC Station 3",
            recorded_weight_g: 102.5,
            target_weight_g: 100.0,
          },
          ACTOR_ADMIN
        );
      }).toThrowError(/Fill weight variance .* exceeds FSSAI allowed tolerance/);
    });

    it("records sensory cupping milestone with master taster cupping score", () => {
      const cuppingMilestone = PrivateLabelService.recordQCMilestone(
        jobId,
        {
          stage: "sensory_cupping",
          status: "passed",
          inspector_name: "Senior Tea Sommelier",
          cupping_score: 91.5,
          evidence_notes: "Exceptional muscatel aroma with lingering honey finish",
        },
        ACTOR_ADMIN
      );

      expect(cuppingMilestone.status).toBe("passed");
      expect(cuppingMilestone.cupping_score).toBe(91.5);
    });

    it("automatically halts production job upon critical defect failure (seal_integrity or sensory_cupping)", () => {
      const haltJobId = "job_m6_critical_halt";
      db.prepare(`
        INSERT INTO pl_jobs (id, job_number, order_id, status, released_by, revision, created_at, updated_at)
        VALUES (?, 'PL-JOB-HALT-001', 'ord_m6_qc_testing', 'filling_packing', 'admin_m6_qc', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(haltJobId);

      db.prepare(`
        INSERT INTO pl_qc_milestones (id, job_id, milestone_name, stage, status, created_at)
        VALUES ('qc_seal_halt', ?, 'Seal Integrity Vacuum', 'seal_integrity', 'pending', CURRENT_TIMESTAMP)
      `).run(haltJobId);

      // Fail seal_integrity -> must auto-halt job
      PrivateLabelService.recordQCMilestone(
        haltJobId,
        {
          stage: "seal_integrity",
          status: "failed",
          inspector_name: "Vacuum Chamber Operator",
          evidence_notes: "Micro-leaks detected in pouch top crimp under 50 kPa vacuum",
        },
        ACTOR_ADMIN
      );

      const job = db.prepare("SELECT status FROM pl_jobs WHERE id = ?").get(haltJobId) as { status: string };
      expect(job.status).toBe("halted");
    });

    it("automatically advances job to ready_to_ship and order to qc_passed when all 7 milestones pass", () => {
      const completeJobId = "job_m6_full_pass";
      const completeOrderId = "ord_m6_full_pass";

      db.prepare(`
        INSERT INTO pl_orders (
          id, order_number, client_id, quote_id, project_id, status,
          deposit_paise, balance_paise, total_paise, revision, created_at, updated_at
        ) VALUES (
          ?, 'PL-ORD-PASS-001', 'client_m6_alice', 'quote_m6_release_test', 'proj_m6_release_test', 'in_production',
          1000000, 1000000, 2000000, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `).run(completeOrderId);

      db.prepare(`
        INSERT INTO pl_jobs (id, job_number, order_id, status, released_by, revision, created_at, updated_at)
        VALUES (?, 'PL-JOB-PASS-001', ?, 'qc', 'admin_m6_qc', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(completeJobId, completeOrderId);

      const stages = [
        "raw_material",
        "packaging_incoming",
        "print_proof",
        "fill_weight",
        "seal_integrity",
        "sensory_cupping",
        "final_pack",
      ];

      for (const s of stages) {
        PrivateLabelService.recordQCMilestone(
          completeJobId,
          {
            stage: s as any,
            status: "passed",
            inspector_name: "Chief Quality Inspector",
            recorded_weight_g: s === "fill_weight" ? 100.1 : undefined,
            target_weight_g: s === "fill_weight" ? 100.0 : undefined,
            cupping_score: s === "sensory_cupping" ? 89.0 : undefined,
          },
          ACTOR_ADMIN
        );
      }

      const updatedJob = db.prepare("SELECT status FROM pl_jobs WHERE id = ?").get(completeJobId) as { status: string };
      const updatedOrder = db.prepare("SELECT status FROM pl_orders WHERE id = ?").get(completeOrderId) as { status: string };

      expect(updatedJob.status).toBe("ready_to_ship");
      expect(updatedOrder.status).toBe("qc_passed");
    });
  });

  // ==========================================================================
  // 6. Public DTO Redaction & Reorder Workflow
  // ==========================================================================
  describe("6. Public DTO Redaction & Reordering", () => {
    it("toPublicSampleOrderDto redacts client ID and internal costs", () => {
      const mockSample: SampleOrder = {
        id: "samp_test_dto",
        sample_number: "PL-SMP-2026-1234",
        client_id: "client_super_secret_id",
        project_id: "proj_secret",
        sample_type: "tea_kit",
        status: "requested",
        amount_paise: 75000,
        quantity: 1,
        tea_option_id: "tea_darjeeling_ftgfop1",
        packaging_variant_id: "var_pouch_100",
        shipping_address_json: "{}",
        tracking_number: "TRK123",
        carrier: "BlueDart",
        notes: "Customer notes",
        feedback_notes: null,
        payment_reference: null,
        coupon_code: null,
        revision: 1,
        tea_recipe_ids_json: "[]",
        created_at: "2026-11-10T00:00:00Z",
        updated_at: "2026-11-10T00:00:00Z",
      };

      const publicDto = toPublicSampleOrderDto(mockSample);

      expect(publicDto.id).toBe("samp_test_dto");
      expect(publicDto.sample_number).toBe("PL-SMP-2026-1234");
      expect((publicDto as any).client_id).toBeUndefined();
      expect((publicDto as any).supplier_cost).toBeUndefined();
    });

    it("toPublicProductionOrderDto redacts supplier vendor ID, COGS, and private margins", () => {
      const mockOrder: ProductionOrder = {
        id: "ord_test_dto",
        order_number: "PL-ORD-2026-8888",
        client_id: "client_secret",
        quote_id: "quote_secret",
        project_id: "proj_secret",
        idempotency_key: null,
        status: "production_released",
        currency: "INR",
        total_paise: 5000000,
        deposit_paise: 2500000,
        balance_paise: 2500000,
        deposit_paid_at: "2026-11-10T00:00:00Z",
        full_paid_at: null,
        deposit_payment_id: "pay_dep_secret",
        final_payment_id: null,
        shipping_address_json: "{}",
        notes: "Notes",
        revision: 1,
        created_at: "2026-11-10T00:00:00Z",
        updated_at: "2026-11-10T00:00:00Z",
      };

      const publicDto = toPublicProductionOrderDto(mockOrder);

      expect(publicDto.id).toBe("ord_test_dto");
      expect(publicDto.order_number).toBe("PL-ORD-2026-8888");
      expect((publicDto as any).client_id).toBeUndefined();
      expect((publicDto as any).supplier_vendor_id).toBeUndefined();
      expect((publicDto as any).cogs_breakdown).toBeUndefined();
      expect((publicDto as any).cost_breakdown_json).toBeUndefined();
      expect((publicDto as any).margin_paise).toBeUndefined();
    });

    it("toPublicProductionJobDto redacts released_by employee ID and internal factory routings", () => {
      const mockJob: ProductionJob = {
        id: "job_test_dto",
        job_number: "PL-JOB-2026-7777",
        order_id: "ord_test_dto",
        status: "qc",
        target_completion_date: "2026-12-01",
        actual_completion_date: null,
        operator_notes: "Cleanroom Batch",
        override_justification: "Special bypass reason",
        released_by: "emp_internal_siliguri_04",
        released_at: "2026-11-10T00:00:00Z",
        revision: 1,
        created_at: "2026-11-10T00:00:00Z",
        updated_at: "2026-11-10T00:00:00Z",
      };

      const publicDto = toPublicProductionJobDto(mockJob);

      expect(publicDto.id).toBe("job_test_dto");
      expect(publicDto.job_number).toBe("PL-JOB-2026-7777");
      expect((publicDto as any).released_by).toBeUndefined();
      expect((publicDto as any).override_justification).toBeUndefined();
    });

    it("reorder creates duplicate quote with identical recipe and packaging specifications", () => {
      const originalOrderId = "ord_m6_release_test";
      const result = PrivateLabelService.reorder(
        originalOrderId,
        2000,
        ACTOR_CUSTOMER_A.actor_id,
        ACTOR_CUSTOMER_A
      );

      expect(result.quote).toBeDefined();
      expect(result.quote.quote_number).toContain("PL-QTE-");
      expect(result.quote.status).toBe("firm_issued");
      expect(result.quote.project_id).toBe("proj_m6_release_test");
    });
  });

  // ==========================================================================
  // 7. Milestone M6 Remediation Verifications
  // ==========================================================================
  describe("7. Milestone M6 Remediation Verifications", () => {
    it("persists release_blocked audit event outside transaction when release gate validation fails", () => {
      const blockedOrderId = "ord_m6_audit_rollback_verify";
      const quoteId = "quote_m6_audit_rollback_verify";
      const projectId = "proj_m6_audit_rollback_verify";

      db.prepare(`
        INSERT INTO pl_projects (id, client_id, owner_customer_id, title, status)
        VALUES (?, 'client_m6_alice', ?, 'Rollback Verification Project', 'accepted')
      `).run(projectId, ACTOR_CUSTOMER_A.actor_id);

      db.prepare(`
        INSERT INTO pl_quotes (
          id, quote_number, project_id, price_book_id, status, grand_total_paise, valid_until
        ) VALUES (
          ?, 'PL-Q-VERIFY-001', ?, 'pb_default_inr', 'converted', 2000000, datetime('now', '+30 days')
        )
      `).run(quoteId, projectId);

      db.prepare(`
        INSERT INTO pl_orders (
          id, order_number, client_id, quote_id, project_id, status,
          deposit_paise, balance_paise, total_paise, revision, created_at, updated_at
        ) VALUES (
          ?, 'PL-ORD-VERIFY-001', 'client_m6_alice', ?, ?, 'pending_deposit',
          1000000, 1000000, 2000000, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `).run(blockedOrderId, quoteId, projectId);

      // Attempt release without override - must throw PrivateLabelGateError
      expect(() => {
        PrivateLabelService.releaseProductionJob(
          blockedOrderId,
          { operator_notes: "Attempt without deposit or proof" },
          ACTOR_ADMIN
        );
      }).toThrow(PrivateLabelGateError);

      // Query audit table - the release_blocked audit record MUST exist outside the rollback
      const auditRows = db
        .prepare("SELECT * FROM pl_audit WHERE entity_id = ? AND action = 'release_blocked'")
        .all(blockedOrderId) as Array<{
        entity_id: string;
        action: string;
        diff_json: string;
      }>;

      expect(auditRows.length).toBeGreaterThan(0);
      const audit = auditRows[0];
      expect(audit.action).toBe("release_blocked");
      const details = JSON.parse(audit.diff_json);
      expect(Array.isArray(details.blockers)).toBe(true);
      expect(details.blockers.length).toBeGreaterThan(0);
    });

    it("calculates authoritative server-side sample pricing for all sample types and ignores untrusted client price", () => {
      // 1. tea_kit with quantity 3 and client spoofed price
      const teaKitSample = PrivateLabelService.createSampleOrder(
        {
          sample_type: "tea_kit",
          quantity: 3,
          amount_paise: 1234, // Spoofed / untrusted client price
          shipping_address: {
            line1: "123 Tea Garden Rd",
            city: "Darjeeling",
            state: "WB",
            pincode: "734101",
          },
        },
        ACTOR_CUSTOMER_A.actor_id,
        ACTOR_CUSTOMER_A
      );
      // Authoritative calculation: 75,000 paise * 3 = 225,000 paise
      expect(teaKitSample.amount_paise).toBe(225000);
      expect(teaKitSample.quantity).toBe(3);

      // 2. packaged_mockup with quantity 2
      const mockupSample = PrivateLabelService.createSampleOrder(
        {
          sample_type: "packaged_mockup",
          quantity: 2,
          shipping_address: {
            line1: "123 Tea Garden Rd",
            city: "Darjeeling",
            state: "WB",
            pincode: "734101",
          },
        },
        ACTOR_CUSTOMER_A.actor_id,
        ACTOR_CUSTOMER_A
      );
      // Authoritative calculation: 49,900 paise * 2 = 99,800 paise
      expect(mockupSample.amount_paise).toBe(99800);
      expect(mockupSample.quantity).toBe(2);

      // 3. full_pack_sample with quantity 2
      const fullPackSample = PrivateLabelService.createSampleOrder(
        {
          sample_type: "full_pack_sample",
          quantity: 2,
          shipping_address: {
            line1: "123 Tea Garden Rd",
            city: "Darjeeling",
            state: "WB",
            pincode: "734101",
          },
        },
        ACTOR_CUSTOMER_A.actor_id,
        ACTOR_CUSTOMER_A
      );
      // Authoritative calculation: 250,000 paise * 2 = 500,000 paise
      expect(fullPackSample.amount_paise).toBe(500000);

      // 4. printed_proof with quantity 1
      const printedProofSample = PrivateLabelService.createSampleOrder(
        {
          sample_type: "printed_proof",
          quantity: 1,
          shipping_address: {
            line1: "123 Tea Garden Rd",
            city: "Darjeeling",
            state: "WB",
            pincode: "734101",
          },
        },
        ACTOR_CUSTOMER_A.actor_id,
        ACTOR_CUSTOMER_A
      );
      // Authoritative calculation: 250,000 paise * 1 = 250,000 paise
      expect(printedProofSample.amount_paise).toBe(250000);
    });

    it("enforces SAMPLEFREE100 coupon discounting amount_paise to 0 and prevents duplicate usage", () => {
      // Create new customer for isolated coupon test
      const couponCustomerId = "cust_m6_coupon_tester";
      const couponClientId = "client_m6_coupon_tester";

      db.prepare(`
        INSERT INTO customers (id, email, name)
        VALUES (?, 'coupon@test.com', 'Coupon Tester')
      `).run(couponCustomerId);

      db.prepare(`
        INSERT INTO pl_clients (id, customer_id, company_name, contact_name, contact_email)
        VALUES (?, ?, 'Coupon Test Corp', 'Coupon Tester', 'coupon@test.com')
      `).run(couponClientId, couponCustomerId);

      const couponActor: AuditActor = {
        actor_type: "customer",
        actor_id: couponCustomerId,
      };

      // 1. First use with whitespace and lowercase: "  samplefree100  "
      const freeSample = PrivateLabelService.createSampleOrder(
        {
          sample_type: "tea_kit",
          quantity: 1,
          coupon_code: "  samplefree100  ",
          shipping_address: {
            line1: "123 Hill Cart Rd",
            city: "Kurseong",
            state: "WB",
            pincode: "734203",
          },
        },
        couponCustomerId,
        couponActor
      );
      expect(freeSample.amount_paise).toBe(0);
      expect(freeSample.coupon_code).toBe("SAMPLEFREE100");

      // 2. Second use by same client must be rejected with coupon_already_used
      expect(() => {
        PrivateLabelService.createSampleOrder(
          {
            sample_type: "tea_kit",
            quantity: 1,
            coupon_code: "SAMPLEFREE100",
            shipping_address: {
              line1: "123 Hill Cart Rd",
              city: "Kurseong",
              state: "WB",
              pincode: "734203",
            },
          },
          couponCustomerId,
          couponActor
        );
      }).toThrow(PrivateLabelGateError);
    });

    it("enforces strict sample quantity boundaries between 1 and 10", () => {
      // Quantity 0
      expect(() => {
        PrivateLabelService.createSampleOrder(
          {
            sample_type: "tea_kit",
            quantity: 0,
            shipping_address: {
              line1: "123 Station Rd",
              city: "Siliguri",
              state: "WB",
              pincode: "734001",
            },
          },
          ACTOR_CUSTOMER_A.actor_id,
          ACTOR_CUSTOMER_A
        );
      }).toThrow(PrivateLabelGateError);

      // Quantity -2
      expect(() => {
        PrivateLabelService.createSampleOrder(
          {
            sample_type: "tea_kit",
            quantity: -2,
            shipping_address: {
              line1: "123 Station Rd",
              city: "Siliguri",
              state: "WB",
              pincode: "734001",
            },
          },
          ACTOR_CUSTOMER_A.actor_id,
          ACTOR_CUSTOMER_A
        );
      }).toThrow(PrivateLabelGateError);

      // Quantity 11 (exceeds cap of 10)
      expect(() => {
        PrivateLabelService.createSampleOrder(
          {
            sample_type: "tea_kit",
            quantity: 11,
            shipping_address: {
              line1: "123 Station Rd",
              city: "Siliguri",
              state: "WB",
              pincode: "734001",
            },
          },
          ACTOR_CUSTOMER_A.actor_id,
          ACTOR_CUSTOMER_A
        );
      }).toThrow(PrivateLabelGateError);
    });

    it("returns null for tracking details when not recorded, without fabricated carriers or tracking numbers", () => {
      const mockOrder: ProductionOrder = {
        id: "ord_tracking_test",
        order_number: "PL-ORD-TRK-001",
        client_id: "client_m6_alice",
        quote_id: "quote_m6_test",
        project_id: "proj_m6_test",
        idempotency_key: null,
        status: "production_released",
        currency: "INR",
        total_paise: 2000000,
        deposit_paise: 1000000,
        balance_paise: 1000000,
        deposit_paid_at: "2026-11-10T00:00:00Z",
        full_paid_at: null,
        deposit_payment_id: "pay_dep_001",
        final_payment_id: null,
        shipping_address_json: JSON.stringify({ line1: "123 Hill Road", city: "Siliguri", state: "WB" }),
        notes: null,
        revision: 1,
        created_at: "2026-11-10T00:00:00Z",
        updated_at: "2026-11-10T00:00:00Z",
      };

      // When tracking is omitted / undefined
      const dtoWithoutTracking = toPublicProductionOrderDto(mockOrder);
      expect(dtoWithoutTracking.tracking_number).toBeNull();
      expect(dtoWithoutTracking.carrier).toBeNull();

      // When tracking info is empty / null
      const dtoWithNullTracking = toPublicProductionOrderDto(mockOrder, [], null, [], null, {
        carrier: null,
        tracking_number: null,
      });
      expect(dtoWithNullTracking.tracking_number).toBeNull();
      expect(dtoWithNullTracking.carrier).toBeNull();

      // When tracking info is legitimately recorded
      const dtoWithRealTracking = toPublicProductionOrderDto(mockOrder, [], null, [], null, {
        carrier: "Blue Dart Express",
        tracking_number: "BDE-9918273645",
      });
      expect(dtoWithRealTracking.tracking_number).toBe("BDE-9918273645");
      expect(dtoWithRealTracking.carrier).toBe("Blue Dart Express");
    });

    it("verifies sample order tracking null handling without fabricated Delhivery carrier", () => {
      // 1. Create a sample order
      const sample = PrivateLabelService.createSampleOrder(
        {
          sample_type: "tea_kit",
          quantity: 1,
          shipping_address: { line1: "Remediation Rd", city: "Siliguri", pincode: "734001" },
        },
        ACTOR_CUSTOMER_A.actor_id,
        ACTOR_CUSTOMER_A
      );

      // 2. Dispatch with whitespace / omitted carrier
      const dispatched = PrivateLabelService.dispatchSampleOrder(
        sample.id,
        { carrier: "   ", tracking_number: "INDIA-POST-12345" },
        ACTOR_ADMIN
      );

      expect(dispatched.carrier).toBeNull();
      expect(dispatched.carrier).not.toBe("Delhivery");

      // Verify DB row has NULL
      const row = db.prepare("SELECT carrier FROM pl_samples WHERE id = ?").get(sample.id) as { carrier: string | null };
      expect(row.carrier).toBeNull();
      expect(row.carrier).not.toBe("Delhivery");
    });
  });
});

