import { prepareProofForApproval } from "./private-label-proof-fixture";
/**
 * TeaFloww Private Label Studio — Adversarial Deposit Math & MCP Response Verification
 * Milestone M7: Empirical Challenger Suite
 * File: tests/unit/private-label-m7-deposit-math-challenger.test.ts
 *
 * Adversarially challenges:
 * 1. Default 50% upfront deposit / 50% on dispatch balance math via MCP tools.
 * 2. Exact integer precision without rounding loss: deposit_paise + balance_paise === total_paise on odd/even totals.
 * 3. Consistent response payloads across private_label_convert_quote_to_order, private_label_accept_quote, and private_label_get_order.
 * 4. Production release gate blocking when deposit is unpaid (-32009).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { rmSync } from "node:fs";
import { dispatchToolCall, McpError } from "@/lib/mcp";
import { PrivateLabelService } from "@/lib/private-label/service";
import { getDb } from "@/lib/db";
import type {
  PublicProjectDto,
  PublicProductionOrderDto,
  PublicDesignVersionDto,
} from "@/lib/private-label/public-dto";
import type { PublicQuoteWithItemsDto } from "@/lib/private-label/types";

const TEST_DB = path.join(
  tmpdir(),
  `pl-mcp-deposit-challenger-${process.pid}-${Date.now()}.sqlite`
);
process.env.DATABASE_PATH = TEST_DB;

function call<T = unknown>(name: string, args?: unknown): T {
  return dispatchToolCall(name, args ?? {}) as T;
}

function failsWith(name: string, args: unknown): McpError {
  try {
    dispatchToolCall(name, args);
  } catch (error) {
    expect(error).toBeInstanceOf(McpError);
    return error as McpError;
  }
  throw new Error(`Expected tool "${name}" to fail with McpError`);
}

describe("Milestone M7 Deposit Math & Financial Invariant Verification via MCP", () => {
  beforeAll(() => {
    execFileSync(process.execPath, ["scripts/migrate.mjs"], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_PATH: TEST_DB },
      stdio: "ignore",
    });

    PrivateLabelService.seedInitialCatalog();
    const db = getDb();

    db.prepare(`
      INSERT OR IGNORE INTO customers (id, email, name)
      VALUES ('client_deposit_test', 'deposit@teafloww.com', 'Deposit Tester')
    `).run();

    db.prepare(`
      INSERT OR IGNORE INTO pl_clients (id, customer_id, company_name, contact_name, contact_email)
      VALUES ('client_deposit_test', 'client_deposit_test', 'Deposit Test Co', 'Finance Tester', 'deposit@teafloww.com')
    `).run();

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

    db.prepare(`
      INSERT OR IGNORE INTO pl_packaging_compatibility (id, packaging_variant_id, print_method_id, is_supported)
      VALUES ('compat_pouch_paper_label', 'pack_pouch_standup_250g_01', 'pm_paper_label', 1)
    `).run();

    db.prepare(`
      INSERT OR IGNORE INTO pl_price_book_tiers (id, price_book_id, item_type, item_id, min_qty, max_qty, unit_price_paise)
      VALUES ('pbt_pack_test', 'pb_default_inr', 'packaging', 'pack_pouch_standup_250g_01', 100, 10000, 3500),
             ('pbt_print_test', 'pb_default_inr', 'print_method', 'pm_paper_label', 100, 10000, 1500),
             ('pbt_tea_test', 'pb_default_inr', 'tea', 'tea_darjeeling_first_flush', 100, 10000, 4500)
    `).run();
  });

  afterAll(() => {
    try {
      rmSync(TEST_DB, { force: true });
      rmSync(`${TEST_DB}-wal`, { force: true });
      rmSync(`${TEST_DB}-shm`, { force: true });
    } catch {}
  });

  it("1: 50% deposit and 50% balance exact math on standard production quote via convertQuoteToOrder", () => {
    const proj = call<PublicProjectDto>("private_label_create_project", {
      client_id: "client_deposit_test",
      title: "Deposit Standard Order Project",
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
      client_id: "client_deposit_test",
    });
    expect(quote.grand_total_paise).toBeGreaterThan(0);

    const order = call<PublicProductionOrderDto>("private_label_convert_quote_to_order", {
      quote_id: quote.id,
      client_id: "client_deposit_test",
      idempotency_key: `idem_std_${Date.now()}`,
    });

    expect(order.status).toBe("pending_deposit");
    expect(order.total_paise).toBe(quote.grand_total_paise);
    expect(order.deposit_paise).toBe(Math.round(quote.grand_total_paise * 0.5));
    expect(order.balance_paise).toBe(quote.grand_total_paise - order.deposit_paise);
    expect(order.deposit_paise + order.balance_paise).toBe(quote.grand_total_paise);
  });

  it("2: 50% deposit math on odd-paise grand totals preserves exact sum with zero rounding loss", () => {
    const oddTotals = [
      1,          // ₹0.01 -> deposit: 1 paise, balance: 0 paise
      3,          // ₹0.03 -> deposit: 2 paise, balance: 1 paise
      100001,     // ₹1,000.01 -> deposit: 50001 paise, balance: 50000 paise
      3422001,    // ₹34,220.01 -> deposit: 1711001 paise, balance: 1711000 paise
      9999999,    // ₹99,999.99 -> deposit: 5000000 paise, balance: 4999999 paise
      123456789,  // ₹12,34,567.89 -> deposit: 61728395 paise, balance: 61728394 paise
    ];

    const db = getDb();

    for (let i = 0; i < oddTotals.length; i++) {
      const total = oddTotals[i];
      const proj = call<PublicProjectDto>("private_label_create_project", {
        client_id: "client_deposit_test",
        title: `Odd Total Test ${i}`,
      });

      const quote = call<PublicQuoteWithItemsDto>("private_label_create_quote", {
        project_id: proj.id,
        client_id: "client_deposit_test",
      });

      // Update quote with odd grand total
      db.prepare("UPDATE pl_quotes SET grand_total_paise = ? WHERE id = ?").run(total, quote.id);

      const order = call<PublicProductionOrderDto>("private_label_convert_quote_to_order", {
        quote_id: quote.id,
        client_id: "client_deposit_test",
        idempotency_key: `idem_odd_${i}_${Date.now()}`,
      });

      const expectedDeposit = Math.round(total * 0.5);
      const expectedBalance = total - expectedDeposit;

      expect(order.total_paise).toBe(total);
      expect(order.deposit_paise).toBe(expectedDeposit);
      expect(order.balance_paise).toBe(expectedBalance);
      // Strict equality invariant: deposit + balance === total
      expect(order.deposit_paise + order.balance_paise).toBe(total);
      // Disparity between deposit and balance on odd totals is strictly 1 paisa
      expect(Math.abs(order.deposit_paise - order.balance_paise)).toBe(1);
    }
  });

  it("3: private_label_accept_quote creates order with identical 50/50 deposit schedule", () => {
    const proj = call<PublicProjectDto>("private_label_create_project", {
      client_id: "client_deposit_test",
      title: "Accept Quote Deposit Project",
      items: [
        {
          packaging_variant_id: "pack_pouch_standup_250g_01",
          tea_option_id: "tea_darjeeling_first_flush",
          target_quantity: 500,
        },
      ],
    });

    const quote = call<PublicQuoteWithItemsDto>("private_label_create_quote", {
      project_id: proj.id,
      client_id: "client_deposit_test",
    });

    const acceptRes = call<{ order_id: string }>("private_label_accept_quote", {
      id: quote.id,
      expected_revision: 1,
      client_id: "client_deposit_test",
    });
    expect(acceptRes.order_id).toBeTruthy();

    const order = call<PublicProductionOrderDto>("private_label_get_order", {
      id: acceptRes.order_id,
      client_id: "client_deposit_test",
    });

    expect(order.status).toBe("pending_deposit");
    expect(order.deposit_paise).toBe(Math.round(quote.grand_total_paise * 0.5));
    expect(order.balance_paise).toBe(quote.grand_total_paise - order.deposit_paise);
    expect(order.deposit_paise + order.balance_paise).toBe(order.total_paise);
  });

  it("4: private_label_release_job strictly enforces deposit_paid hard gate blocker (-32009)", () => {
    const proj = call<PublicProjectDto>("private_label_create_project", {
      client_id: "client_deposit_test",
      title: "Gate Test Project",
      items: [
        {
          packaging_variant_id: "pack_pouch_standup_250g_01",
          tea_option_id: "tea_darjeeling_first_flush",
          target_quantity: 500,
        },
      ],
    });

    const quote = call<PublicQuoteWithItemsDto>("private_label_create_quote", {
      project_id: proj.id,
      client_id: "client_deposit_test",
    });

    const order = call<PublicProductionOrderDto>("private_label_convert_quote_to_order", {
      quote_id: quote.id,
      client_id: "client_deposit_test",
      idempotency_key: `idem_gate_${Date.now()}`,
    });
    expect(order.status).toBe("pending_deposit");

    // Also approve proof so proof gate is passed, isolating the deposit gate
    const proof = call<PublicDesignVersionDto>("private_label_generate_preview", {
      project_id: proj.id,
      scene_data: { test: true },
      client_id: "client_deposit_test",
    });
    call("private_label_approve_proof", {
      proof_id: prepareProofForApproval(proof.id),
      expected_revision: 1,
      disclaimer_accepted: true,
      client_id: "client_deposit_test",
    });

    // Attempt releasing production job while deposit is pending -> must fail with -32009
    const err = failsWith("private_label_release_job", {
      order_id: order.id,
      target_completion_date: "2026-12-15",
    });

    expect(err.code).toBe(-32009);
    expect(err.message).toMatch(/Order status must be 'deposit_paid'/i);

    // Now update deposit to paid in database
    const db = getDb();
    db.prepare("UPDATE pl_orders SET status = 'deposit_paid' WHERE id = ?").run(order.id);

    // Releasing job now succeeds
    const job = call<{ id: string; status: string }>("private_label_release_job", {
      order_id: order.id,
      target_completion_date: "2026-12-15",
    });
    expect(job.status).toBe("scheduled");
  });
});
