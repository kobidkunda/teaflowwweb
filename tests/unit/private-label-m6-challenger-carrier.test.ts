/**
 * TeaFloww Private Label Studio — Milestone M6 Adversarial Carrier Stress Test
 * Challenger: private_label_m6_iter3_challenger_1
 * Role: critic, specialist
 * File: tests/unit/private-label-m6-challenger-carrier.test.ts
 *
 * Dedicated verification for dispatchSampleOrder carrier handling:
 * 1. Pass { tracking_number: "TRK12345" } (omitted carrier/courier) -> carrier strictly null in DB and DTO.
 * 2. Pass { tracking_number: "TRK12345", courier: "  " } (whitespace courier) -> carrier strictly null.
 * 3. Pass { tracking_number: "TRK12345", carrier: null } -> carrier strictly null.
 * 4. Pass { tracking_number: "TRK12345", courier: "DHL Express" } -> carrier is "DHL Express".
 * 5. Pass { tracking_number: "TRK12345", carrier: "Blue Dart" } -> carrier is "Blue Dart".
 * 6. Inspect raw SQLite database table pl_samples to confirm column carrier is NULL.
 * 7. Inspect pl_audit.diff_json string to ensure "Delhivery" is nowhere present.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { rmSync } from "node:fs";

import { PrivateLabelService } from "@/lib/private-label/service";
import { toPublicSampleOrderDto } from "@/lib/private-label/public-dto";
import type { AuditActor } from "@/lib/private-label/types";

describe("Milestone M6 Challenger 1: Carrier & Courier Adversarial Stress Suite", () => {
  let testDbPath: string;
  let db: Database.Database;

  const ACTOR_ADMIN: AuditActor = {
    actor_type: "admin",
    actor_id: "admin-chal1",
    actor_email: "ops@teafloww.com",
  };

  const ACTOR_CUSTOMER: AuditActor = {
    actor_type: "customer",
    actor_id: "cust-carrier-stress",
    actor_email: "test-carrier@teafloww.com",
  };

  beforeAll(() => {
    testDbPath = path.join(tmpdir(), `pl-m6-carrier-${process.pid}-${Date.now()}.sqlite`);
    process.env.DATABASE_PATH = testDbPath;
    (process.env as Record<string, string | undefined>).NODE_ENV = "test";

    // Run database migrations through 049
    execFileSync(process.execPath, ["scripts/migrate.mjs"], {
      env: { ...process.env, DATABASE_PATH: testDbPath },
    });

    db = new Database(testDbPath);
    db.pragma("foreign_keys = ON");
    db.pragma("journal_mode = WAL");

    // Seed initial catalog
    PrivateLabelService.seedInitialCatalog();

    // Seed customer and client
    db.prepare(`
      INSERT OR IGNORE INTO customers (id, email, name, is_active)
      VALUES (?, 'test-carrier@teafloww.com', 'Carrier Test User', 1)
    `).run(ACTOR_CUSTOMER.actor_id);

    db.prepare(`
      INSERT OR IGNORE INTO pl_clients (id, customer_id, company_name, contact_name, contact_email)
      VALUES ('client_carrier_test', ?, 'Carrier Stress Co', 'Carrier Tester', 'test-carrier@teafloww.com')
    `).run(ACTOR_CUSTOMER.actor_id);
  });

  afterAll(() => {
    try {
      db?.close();
      rmSync(testDbPath, { force: true });
      rmSync(testDbPath + "-wal", { force: true });
      rmSync(testDbPath + "-shm", { force: true });
    } catch {}
  });

  function createTestSample(addressLine: string = "100 Tea Way") {
    return PrivateLabelService.createSampleOrder(
      {
        sample_type: "tea_kit",
        quantity: 1,
        shipping_address: { line1: addressLine, city: "Siliguri", pincode: "734005" },
      },
      ACTOR_CUSTOMER.actor_id,
      ACTOR_CUSTOMER
    );
  }

  it("1. Omitted carrier/courier: { tracking_number: 'TRK12345' } -> carrier strictly null in domain, DB, and DTO", () => {
    const sample = createTestSample("Case 1 Road");

    const dispatched = PrivateLabelService.dispatchSampleOrder(
      sample.id,
      { tracking_number: "TRK12345" },
      ACTOR_ADMIN
    );

    // Domain DTO check
    expect(dispatched.carrier).toBeNull();
    expect(dispatched.carrier).not.toBe("Delhivery");
    expect(dispatched.tracking_number).toBe("TRK12345");

    // Raw SQLite inspection
    const row = db.prepare("SELECT carrier, tracking_number, status FROM pl_samples WHERE id = ?").get(sample.id) as {
      carrier: string | null;
      tracking_number: string;
      status: string;
    };
    expect(row.carrier).toBeNull();
    expect(row.tracking_number).toBe("TRK12345");
    expect(row.status).toBe("dispatched");

    // Public DTO inspection
    const publicDto = toPublicSampleOrderDto(dispatched);
    expect(publicDto.carrier).toBeNull();
    expect(publicDto.carrier).not.toBe("Delhivery");

    // pl_audit raw inspection
    const audit = db.prepare(
      "SELECT diff_json FROM pl_audit WHERE entity_id = ? AND action = 'dispatch_sample_order'"
    ).get(sample.id) as { diff_json: string };
    expect(audit).toBeDefined();
    expect(audit.diff_json).not.toContain("Delhivery");
    const diff = JSON.parse(audit.diff_json);
    expect(diff.carrier).toBeNull();
    expect(diff.trackingNumber).toBe("TRK12345");
  });

  it("2. Whitespace courier: { tracking_number: 'TRK12345', courier: '   ' } -> carrier strictly null in domain, DB, and DTO", () => {
    const sample = createTestSample("Case 2 Road");

    const dispatched = PrivateLabelService.dispatchSampleOrder(
      sample.id,
      { tracking_number: "TRK12345", courier: "   " },
      ACTOR_ADMIN
    );

    // Domain DTO check
    expect(dispatched.carrier).toBeNull();
    expect(dispatched.carrier).not.toBe("Delhivery");

    // Raw SQLite inspection
    const row = db.prepare("SELECT carrier, tracking_number FROM pl_samples WHERE id = ?").get(sample.id) as {
      carrier: string | null;
      tracking_number: string;
    };
    expect(row.carrier).toBeNull();
    expect(row.tracking_number).toBe("TRK12345");

    // Public DTO check
    const publicDto = toPublicSampleOrderDto(dispatched);
    expect(publicDto.carrier).toBeNull();
    expect(publicDto.carrier).not.toBe("Delhivery");

    // pl_audit check
    const audit = db.prepare(
      "SELECT diff_json FROM pl_audit WHERE entity_id = ? AND action = 'dispatch_sample_order'"
    ).get(sample.id) as { diff_json: string };
    expect(audit.diff_json).not.toContain("Delhivery");
    const diff = JSON.parse(audit.diff_json);
    expect(diff.carrier).toBeNull();
  });

  it("3. Explicit carrier null: { tracking_number: 'TRK12345', carrier: null } -> carrier strictly null in domain, DB, and DTO", () => {
    const sample = createTestSample("Case 3 Road");

    const dispatched = PrivateLabelService.dispatchSampleOrder(
      sample.id,
      { tracking_number: "TRK12345", carrier: null },
      ACTOR_ADMIN
    );

    // Domain DTO check
    expect(dispatched.carrier).toBeNull();
    expect(dispatched.carrier).not.toBe("Delhivery");

    // Raw SQLite inspection
    const row = db.prepare("SELECT carrier, tracking_number FROM pl_samples WHERE id = ?").get(sample.id) as {
      carrier: string | null;
      tracking_number: string;
    };
    expect(row.carrier).toBeNull();
    expect(row.tracking_number).toBe("TRK12345");

    // Public DTO check
    const publicDto = toPublicSampleOrderDto(dispatched);
    expect(publicDto.carrier).toBeNull();

    // pl_audit check
    const audit = db.prepare(
      "SELECT diff_json FROM pl_audit WHERE entity_id = ? AND action = 'dispatch_sample_order'"
    ).get(sample.id) as { diff_json: string };
    expect(audit.diff_json).not.toContain("Delhivery");
    const diff = JSON.parse(audit.diff_json);
    expect(diff.carrier).toBeNull();
  });

  it("4. Courier alias: { tracking_number: 'TRK12345', courier: 'DHL Express' } -> carrier is 'DHL Express'", () => {
    const sample = createTestSample("Case 4 Road");

    const dispatched = PrivateLabelService.dispatchSampleOrder(
      sample.id,
      { tracking_number: "TRK12345", courier: "DHL Express" },
      ACTOR_ADMIN
    );

    // Domain DTO check
    expect(dispatched.carrier).toBe("DHL Express");
    expect(dispatched.tracking_number).toBe("TRK12345");

    // Raw SQLite inspection
    const row = db.prepare("SELECT carrier, tracking_number FROM pl_samples WHERE id = ?").get(sample.id) as {
      carrier: string | null;
      tracking_number: string;
    };
    expect(row.carrier).toBe("DHL Express");
    expect(row.tracking_number).toBe("TRK12345");

    // Public DTO check
    const publicDto = toPublicSampleOrderDto(dispatched);
    expect(publicDto.carrier).toBe("DHL Express");

    // pl_audit check
    const audit = db.prepare(
      "SELECT diff_json FROM pl_audit WHERE entity_id = ? AND action = 'dispatch_sample_order'"
    ).get(sample.id) as { diff_json: string };
    const diff = JSON.parse(audit.diff_json);
    expect(diff.carrier).toBe("DHL Express");
  });

  it("5. Explicit carrier: { tracking_number: 'TRK12345', carrier: 'Blue Dart' } -> carrier is 'Blue Dart'", () => {
    const sample = createTestSample("Case 5 Road");

    const dispatched = PrivateLabelService.dispatchSampleOrder(
      sample.id,
      { tracking_number: "TRK12345", carrier: "Blue Dart" },
      ACTOR_ADMIN
    );

    // Domain DTO check
    expect(dispatched.carrier).toBe("Blue Dart");
    expect(dispatched.tracking_number).toBe("TRK12345");

    // Raw SQLite inspection
    const row = db.prepare("SELECT carrier, tracking_number FROM pl_samples WHERE id = ?").get(sample.id) as {
      carrier: string | null;
      tracking_number: string;
    };
    expect(row.carrier).toBe("Blue Dart");
    expect(row.tracking_number).toBe("TRK12345");

    // Public DTO check
    const publicDto = toPublicSampleOrderDto(dispatched);
    expect(publicDto.carrier).toBe("Blue Dart");

    // pl_audit check
    const audit = db.prepare(
      "SELECT diff_json FROM pl_audit WHERE entity_id = ? AND action = 'dispatch_sample_order'"
    ).get(sample.id) as { diff_json: string };
    const diff = JSON.parse(audit.diff_json);
    expect(diff.carrier).toBe("Blue Dart");
  });

  it("6. Raw SQLite table pl_samples confirms carrier column is strictly NULL across unsupplied orders", () => {
    const nullSamples = db.prepare(`
      SELECT id, carrier, tracking_number
      FROM pl_samples
      WHERE carrier IS NULL
    `).all() as Array<{ id: string; carrier: string | null; tracking_number: string }>;

    // We have created 3 unsupplied carrier orders (Cases 1, 2, 3)
    expect(nullSamples.length).toBeGreaterThanOrEqual(3);
    for (const s of nullSamples) {
      expect(s.carrier).toBeNull();
    }
  });

  it("7. Global audit inspection: pl_audit.diff_json string confirms 'Delhivery' is nowhere present across all audit entries", () => {
    const delhiveryAudits = db.prepare(`
      SELECT *
      FROM pl_audit
      WHERE diff_json LIKE '%Delhivery%'
    `).all();

    expect(delhiveryAudits).toHaveLength(0);
  });
});
