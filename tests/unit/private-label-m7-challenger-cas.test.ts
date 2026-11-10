import { prepareProofForApproval } from "./private-label-proof-fixture";
/**
 * TeaFloww Private Label Studio — Adversarial CAS Concurrency & Race Condition Verification
 * Milestone M7: MCP Tool Parity Challenger Suite
 * File: tests/unit/private-label-m7-challenger-cas.test.ts
 *
 * Adversarially challenges:
 * 1. 10-way concurrent Promise.allSettled project updates via dispatchToolCall("private_label_save_project")
 *    targeting the exact same expected_revision. Asserts EXACTLY 1 succeeds and 9 fail with McpError -32009.
 * 2. Multi-generation chained 10-way races (revisions 1->2->3->4) verifying strict monotonic revision progression.
 * 3. Cross-channel race: concurrent mutation via PrivateLabelService.updateProjectDraft (Admin) vs MCP tool call
 *    with stale revision, verifying immediate -32009 rejection and zero silent overwrites.
 * 4. Concurrent proof approval races on design version: 10-way Promise.allSettled approvals on the exact same
 *    proof revision, asserting EXACTLY 1 succeeds, 9 fail with -32009, pl_approval_events has exactly 1 row,
 *    and linked project revision is incremented exactly once.
 * 5. Stale, expired, and concurrent quote acceptance races:
 *    - 10-way concurrent acceptance on quote: exactly 1 succeeds, 9 fail with -32009, exactly 1 order generated.
 *    - Expired quote acceptance rejection with -32009.
 *    - Already-converted quote acceptance rejection with -32009.
 *    - Stale revision acceptance rejection with -32009.
 * 6. Direct SQLite database integrity inspection:
 *    - Revision counters match exact successful update counts with zero silent overwrites.
 *    - Append-only pl_audit verification: all MCP mutations record actor_type = 'mcp' and actor_id = 'mcp-agent'.
 *    - Zero orphaned or corrupt records.
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
  PublicDesignVersionDto,
} from "@/lib/private-label/public-dto";
import type {
  AuditRecord,
  Project,
  Quote,
  DesignVersion,
  PublicQuoteWithItemsDto,
} from "@/lib/private-label/types";

const TEST_DB = path.join(
  tmpdir(),
  `pl-mcp-cas-adversarial-${process.pid}-${Date.now()}.sqlite`
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

describe("Milestone M7 Adversarial CAS Concurrency & Race Verification", () => {
  beforeAll(() => {
    // 1. Run migrations against isolated SQLite database
    execFileSync(process.execPath, ["scripts/migrate.mjs"], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_PATH: TEST_DB },
      stdio: "ignore",
    });

    const db = getDb();

    // 2. Seed initial catalog (packaging, teas, print methods, price books)
    PrivateLabelService.seedInitialCatalog();

    // 3. Seed test tenants
    db.prepare(`
      INSERT OR IGNORE INTO customers (id, email, name)
      VALUES ('client_alpha', 'alpha@teafloww.com', 'Client Alpha'),
             ('client_beta', 'beta@teafloww.com', 'Client Beta')
    `).run();

    db.prepare(`
      INSERT OR IGNORE INTO pl_clients (id, customer_id, company_name, contact_name, contact_email)
      VALUES ('client_alpha', 'client_alpha', 'Alpha Organic Tea Co', 'Alpha Admin', 'alpha@teafloww.com'),
             ('client_beta', 'client_beta', 'Beta Global Blends', 'Beta Admin', 'beta@teafloww.com')
    `).run();

    // 4. Seed packaging variant
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

    // 5. Seed tea option
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

    // 6. Seed compatibility
    db.prepare(`
      INSERT OR IGNORE INTO pl_packaging_compatibility (id, packaging_variant_id, print_method_id, is_supported)
      VALUES ('compat_pouch_paper_label', 'pack_pouch_standup_250g_01', 'pm_paper_label', 1)
    `).run();

    // 7. Seed active price book tiers
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

  // =========================================================================
  // Challenge 1: 10-Way Concurrent Project Updates via dispatchToolCall
  // =========================================================================
  describe("Challenge 1: 10-Way Concurrent Project Updates (Promise.allSettled)", () => {
    it("1.1: 10-way concurrent save on revision 1 yields EXACTLY 1 success and 9 rejections with -32009", async () => {
      const proj = call<PublicProjectDto>("private_label_create_project", {
        client_id: "client_alpha",
        title: "10-Way CAS Baseline",
        notes: "Initial state",
      });
      expect(proj.revision).toBe(1);

      // Verify baseline in SQLite
      const db = getDb();
      const initialRow = db.prepare("SELECT * FROM pl_projects WHERE id = ?").get(proj.id) as Project;
      expect(initialRow.revision).toBe(1);
      expect(initialRow.title).toBe("10-Way CAS Baseline");

      // Spawn 10 concurrent update attempts targeting expected_revision = 1
      const concurrencyLevel = 10;
      const tasks = Array.from({ length: concurrencyLevel }, (_, idx) => {
        return new Promise<{ winnerId: number; result: unknown }>((resolve, reject) => {
          setImmediate(() => {
            try {
              const res = dispatchToolCall("private_label_save_project", {
                id: proj.id,
                expected_revision: 1,
                title: `Attempt #${idx} Winner`,
                notes: `Updated by concurrent task #${idx}`,
                client_id: "client_alpha",
              });
              resolve({ winnerId: idx, result: res });
            } catch (err) {
              reject(err);
            }
          });
        });
      });

      const settled = await Promise.allSettled(tasks);

      const fulfilled = settled.filter((s) => s.status === "fulfilled");
      const rejected = settled.filter((s) => s.status === "rejected");

      // EXACTLY 1 must succeed and EXACTLY 9 must fail
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(9);

      // Verify every rejected promise failed with McpError and code -32009
      for (const rej of rejected) {
        if (rej.status === "rejected") {
          expect(rej.reason).toBeInstanceOf(McpError);
          const mcpErr = rej.reason as McpError;
          expect(mcpErr.code).toBe(-32009);
          expect(mcpErr.message).toMatch(/revision conflict/i);
          expect(mcpErr.message).toMatch(/current revision: 2, expected: 1/i);
        }
      }

      // DIRECT SQLITE INSPECTION:
      // Revision counter must be strictly 2 (1 initial + 1 successful update)
      const finalRow = db.prepare("SELECT * FROM pl_projects WHERE id = ?").get(proj.id) as Project;
      expect(finalRow.revision).toBe(2);

      // Zero silent overwrites: title must match the unique winner
      const winner = (fulfilled[0] as PromiseFulfilledResult<{ winnerId: number; result: PublicProjectDto }>).value;
      expect(finalRow.title).toBe(`Attempt #${winner.winnerId} Winner`);
      expect(winner.result.revision).toBe(2);

      // pl_audit verification:
      // Exactly 1 'update_draft' (rev 2) recorded
      const auditRows = db
        .prepare("SELECT * FROM pl_audit WHERE entity_id = ? ORDER BY revision ASC, created_at ASC")
        .all(proj.id) as AuditRecord[];

      const updateAudits = auditRows.filter((a) => a.action === "update_draft");
      expect(updateAudits).toHaveLength(1);
      expect(updateAudits[0].revision).toBe(2);
      expect(updateAudits[0].actor_type).toBe("mcp");
      expect(updateAudits[0].actor_id).toBe("mcp-agent");

      // Total records: 1 create log (service create_draft) + 1 update_draft = 2
      expect(auditRows).toHaveLength(2);
      for (const rec of auditRows) {
        expect(rec.actor_type).toBe("mcp");
        expect(rec.actor_id).toBe("mcp-agent");
      }
    });

    it("1.2: Multi-generation chained 10-way races (revisions 1 -> 2 -> 3 -> 4) enforce monotonic CAS", async () => {
      const proj = call<PublicProjectDto>("private_label_create_project", {
        client_id: "client_alpha",
        title: "Multi-Gen Project",
      });
      expect(proj.revision).toBe(1);

      const db = getDb();

      // Run 3 successive generation races (each with 10 concurrent contestants)
      for (let currentRev = 1; currentRev <= 3; currentRev++) {
        const nextRev = currentRev + 1;
        const tasks = Array.from({ length: 10 }, (_, idx) => {
          return new Promise<PublicProjectDto>((resolve, reject) => {
            setImmediate(() => {
              try {
                const res = call<PublicProjectDto>("private_label_save_project", {
                  id: proj.id,
                  expected_revision: currentRev,
                  title: `Gen ${currentRev} Winner #${idx}`,
                  client_id: "client_alpha",
                });
                resolve(res);
              } catch (err) {
                reject(err);
              }
            });
          });
        });

        const settled = await Promise.allSettled(tasks);
        const fulfilled = settled.filter((s) => s.status === "fulfilled");
        const rejected = settled.filter((s) => s.status === "rejected");

        expect(fulfilled).toHaveLength(1);
        expect(rejected).toHaveLength(9);

        for (const rej of rejected) {
          if (rej.status === "rejected") {
            const err = rej.reason as McpError;
            expect(err).toBeInstanceOf(McpError);
            expect(err.code).toBe(-32009);
          }
        }

        const row = db.prepare("SELECT revision FROM pl_projects WHERE id = ?").get(proj.id) as { revision: number };
        expect(row.revision).toBe(nextRev);
      }

      // After 3 generations, project revision must be strictly 4
      const finalRow = db.prepare("SELECT revision FROM pl_projects WHERE id = ?").get(proj.id) as { revision: number };
      expect(finalRow.revision).toBe(4);

      // pl_audit: exactly 3 'update_draft' records (rev 2, 3, 4) plus initial creation
      const auditRows = db
        .prepare("SELECT * FROM pl_audit WHERE entity_id = ? ORDER BY revision ASC")
        .all(proj.id) as AuditRecord[];

      const updates = auditRows.filter((a) => a.action === "update_draft");
      expect(updates).toHaveLength(3);
      expect(updates.map((u) => u.revision)).toEqual([2, 3, 4]);
      expect(auditRows).toHaveLength(4); // 1 create record + 3 update records
      for (const rec of auditRows) {
        expect(rec.actor_type).toBe("mcp");
      }
    });
  });

  // =========================================================================
  // Challenge 2: Cross-Channel Concurrency Race
  // =========================================================================
  describe("Challenge 2: Cross-Channel Concurrency Race (Admin Service vs MCP)", () => {
    it("2.1: Mutating project revision via PrivateLabelService causes concurrent MCP call with stale revision to fail with -32009", () => {
      const proj = call<PublicProjectDto>("private_label_create_project", {
        client_id: "client_alpha",
        title: "Cross-Channel Base",
      });
      expect(proj.revision).toBe(1);

      // Channel A (Admin direct service mutation) advances revision from 1 to 2
      const adminUpdated = PrivateLabelService.updateProjectDraft(
        proj.id,
        1,
        { title: "Direct Admin Modification", notes: "Admin updated via internal service" },
        { actor_type: "admin", actor_id: "admin-superuser", actor_email: "admin@teafloww.com" }
      );
      expect(adminUpdated.revision).toBe(2);

      // Channel B (MCP tool call) attempts mutation with stale expected_revision = 1
      const mcpErr = failsWith("private_label_save_project", {
        id: proj.id,
        expected_revision: 1,
        title: "MCP Stale Overwrite Attempt",
        client_id: "client_alpha",
      });

      expect(mcpErr.code).toBe(-32009);
      expect(mcpErr.message).toMatch(/revision conflict on project/i);
      expect(mcpErr.message).toMatch(/current revision: 2, expected: 1/i);

      // Direct SQLite check: Admin mutation is preserved intact, no MCP overwrite occurred
      const db = getDb();
      const row = db.prepare("SELECT * FROM pl_projects WHERE id = ?").get(proj.id) as Project;
      expect(row.revision).toBe(2);
      expect(row.title).toBe("Direct Admin Modification");
      expect(row.notes).toBe("Admin updated via internal service");

      // Verify audit logs: 1 MCP create log + 1 Admin update, zero MCP updates committed
      const auditTrail = db
        .prepare("SELECT action, revision, actor_type, actor_id FROM pl_audit WHERE entity_id = ? ORDER BY revision ASC, created_at ASC")
        .all(proj.id) as AuditRecord[];

      expect(auditTrail).toHaveLength(2);
      const adminUpdates = auditTrail.filter((a) => a.action === "update_draft");
      expect(adminUpdates).toHaveLength(1);
      expect(adminUpdates[0].actor_type).toBe("admin");
      expect(adminUpdates[0].actor_id).toBe("admin-superuser");
      expect(adminUpdates[0].revision).toBe(2);
    });

    it("2.2: Concurrent cross-channel race between Admin service and MCP yields exactly one winner and one conflict error", async () => {
      const proj = call<PublicProjectDto>("private_label_create_project", {
        client_id: "client_alpha",
        title: "Cross-Channel Simultaneous Race",
      });
      expect(proj.revision).toBe(1);

      const opAdmin = () =>
        new Promise<{ channel: "admin"; result?: unknown; error?: unknown }>((resolve) => {
          setImmediate(() => {
            try {
              const res = PrivateLabelService.updateProjectDraft(
                proj.id,
                1,
                { title: "Admin Won The Race" },
                { actor_type: "admin", actor_id: "admin-fast" }
              );
              resolve({ channel: "admin", result: res });
            } catch (error) {
              resolve({ channel: "admin", error });
            }
          });
        });

      const opMcp = () =>
        new Promise<{ channel: "mcp"; result?: unknown; error?: unknown }>((resolve) => {
          setImmediate(() => {
            try {
              const res = dispatchToolCall("private_label_save_project", {
                id: proj.id,
                expected_revision: 1,
                title: "MCP Won The Race",
                client_id: "client_alpha",
              });
              resolve({ channel: "mcp", result: res });
            } catch (error) {
              resolve({ channel: "mcp", error });
            }
          });
        });

      const [res1, res2] = await Promise.all([opAdmin(), opMcp()]);
      const results = [res1, res2];

      const winners = results.filter((r) => r.result !== undefined);
      const losers = results.filter((r) => r.error !== undefined);

      expect(winners).toHaveLength(1);
      expect(losers).toHaveLength(1);

      const loser = losers[0];
      if (loser.channel === "mcp") {
        expect(loser.error).toBeInstanceOf(McpError);
        expect((loser.error as McpError).code).toBe(-32009);
      } else {
        expect((loser.error as Error).name).toBe("PrivateLabelRevisionConflictError");
      }

      // SQLite database must have advanced by exactly 1 revision (1 -> 2)
      const db = getDb();
      const row = db.prepare("SELECT revision, title FROM pl_projects WHERE id = ?").get(proj.id) as Project;
      expect(row.revision).toBe(2);

      const winner = winners[0];
      if (winner.channel === "admin") {
        expect(row.title).toBe("Admin Won The Race");
      } else {
        expect(row.title).toBe("MCP Won The Race");
      }
    });
  });

  // =========================================================================
  // Challenge 3: Concurrent Proof Approval Races on Design Version
  // =========================================================================
  describe("Challenge 3: Concurrent Proof Approval Races on Design Version", () => {
    it("3.1: 10-way concurrent proof approval on same revision yields EXACTLY 1 success and 9 rejections with -32009", async () => {
      const proj = call<PublicProjectDto>("private_label_create_project", {
        client_id: "client_alpha",
        title: "Proof Race Project",
      });

      const proof = call<PublicDesignVersionDto>("private_label_generate_preview", {
        project_id: proj.id,
        scene_data: { canvas: "artwork_layer_v1" },
        client_id: "client_alpha",
      });
      expect(proof.version_number).toBe(1);
      expect(proof.is_locked).toBe(false);

      const db = getDb();

      // Project revision prior to approval
      const projBefore = db.prepare("SELECT revision FROM pl_projects WHERE id = ?").get(proj.id) as { revision: number };

      // 10 concurrent approval attempts targeting the same proof revision
      const tasks = Array.from({ length: 10 }, (_, idx) => {
        return new Promise<{ signerIdx: number; result: unknown }>((resolve, reject) => {
          setImmediate(() => {
            try {
              const res = dispatchToolCall("private_label_approve_proof", {
                proof_id: prepareProofForApproval(proof.id),
                expected_revision: 1,
                disclaimer_accepted: true,
                signer_name: `Authorized Director #${idx}`,
                client_id: "client_alpha",
              });
              resolve({ signerIdx: idx, result: res });
            } catch (err) {
              reject(err);
            }
          });
        });
      });

      const settled = await Promise.allSettled(tasks);
      const fulfilled = settled.filter((s) => s.status === "fulfilled");
      const rejected = settled.filter((s) => s.status === "rejected");

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(9);

      // All 9 rejections must have code -32009 and diagnostic reason
      for (const rej of rejected) {
        if (rej.status === "rejected") {
          const err = rej.reason as McpError;
          expect(err).toBeInstanceOf(McpError);
          expect(err.code).toBe(-32009);
          expect(err.message).toMatch(/already approved and locked|revision conflict/i);
        }
      }

      // Direct SQLite Database Inspection:
      // 1. pl_approval_events must have EXACTLY 1 row (no duplicate legal signature rows)
      const approvalEvents = db
        .prepare("SELECT * FROM pl_approval_events WHERE design_version_id = ?")
        .all(proof.id) as Array<{ id: string; signer_name: string; action: string; actor_type: string }>;
      expect(approvalEvents).toHaveLength(1);
      expect(approvalEvents[0].action).toBe("customer_approved");
      expect(approvalEvents[0].actor_type).toBe("mcp");

      // 2. pl_design_versions must be locked
      const dvRow = db
        .prepare("SELECT status, is_locked, version_number FROM pl_design_versions WHERE id = ?")
        .get(proof.id) as DesignVersion;
      expect(dvRow.status).toBe("customer_approved");
      expect(dvRow.is_locked).toBe(1);

      // 3. Linked project revision must have incremented by exactly 1
      const projAfter = db.prepare("SELECT revision FROM pl_projects WHERE id = ?").get(proj.id) as { revision: number };
      expect(projAfter.revision).toBe(projBefore.revision + 1);

      // 4. Audit trail in pl_audit for design version must have actor_type = 'mcp'
      const auditRecs = db
        .prepare("SELECT * FROM pl_audit WHERE entity_id = ? AND action = 'approve_proof'")
        .all(proof.id) as AuditRecord[];
      expect(auditRecs).toHaveLength(1);
      expect(auditRecs[0].actor_type).toBe("mcp");
      expect(auditRecs[0].actor_id).toBe("mcp-agent");
    });

    it("3.2: Stale expected_revision or missing disclaimer on proof approval fails immediately", () => {
      const proj = call<PublicProjectDto>("private_label_create_project", {
        client_id: "client_alpha",
        title: "Proof Stale Revision Test",
      });
      const proof = call<PublicDesignVersionDto>("private_label_generate_preview", {
        project_id: proj.id,
        scene_data: { test: true },
        client_id: "client_alpha",
      });

      // A: Outdated revision (0 instead of 1) -> -32009
      const errStale = failsWith("private_label_approve_proof", {
        proof_id: prepareProofForApproval(proof.id),
        expected_revision: 0,
        disclaimer_accepted: true,
        client_id: "client_alpha",
      });
      expect(errStale.code).toBe(-32009);

      // B: Future revision (999 instead of 1) -> -32009
      const errFuture = failsWith("private_label_approve_proof", {
        proof_id: prepareProofForApproval(proof.id),
        expected_revision: 999,
        disclaimer_accepted: true,
        client_id: "client_alpha",
      });
      expect(errFuture.code).toBe(-32009);

      // C: disclaimer_accepted = false -> -32602
      const errDisclaimer = failsWith("private_label_approve_proof", {
        proof_id: prepareProofForApproval(proof.id),
        expected_revision: 1,
        disclaimer_accepted: false,
        client_id: "client_alpha",
      });
      expect(errDisclaimer.code).toBe(-32602);
    });
  });

  // =========================================================================
  // Challenge 4: Stale Quote Acceptance Races
  // =========================================================================
  describe("Challenge 4: Stale Quote Acceptance Races", () => {
    it("4.1: 10-way concurrent quote acceptance yields EXACTLY 1 success and 9 rejections with -32009", async () => {
      const proj = call<PublicProjectDto>("private_label_create_project", {
        client_id: "client_alpha",
        title: "Quote Acceptance Project",
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
      expect(quote.revision).toBe(1);
      expect(quote.status).toBe("estimated");

      const db = getDb();

      // 10 concurrent accept attempts targeting expected_revision = 1
      const tasks = Array.from({ length: 10 }, (_, idx) => {
        return new Promise<{ idx: number; result: unknown }>((resolve, reject) => {
          setImmediate(() => {
            try {
              const res = dispatchToolCall("private_label_accept_quote", {
                id: quote.id,
                expected_revision: 1,
                client_id: "client_alpha",
                acceptance_notes: `Accepted by runner #${idx}`,
              });
              resolve({ idx, result: res });
            } catch (err) {
              reject(err);
            }
          });
        });
      });

      const settled = await Promise.allSettled(tasks);
      const fulfilled = settled.filter((s) => s.status === "fulfilled");
      const rejected = settled.filter((s) => s.status === "rejected");

      // Exactly 1 success and 9 rejections
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(9);

      for (const rej of rejected) {
        if (rej.status === "rejected") {
          const err = rej.reason as McpError;
          expect(err).toBeInstanceOf(McpError);
          expect(err.code).toBe(-32009);
        }
      }

      // CRITICAL COMMERCE INVARIANT:
      // Exactly 1 production order MUST be created from this quote. Zero duplicates.
      const orders = db
        .prepare("SELECT * FROM pl_orders WHERE quote_id = ?")
        .all(quote.id) as Array<{ id: string; status: string; total_paise: number }>;

      expect(orders).toHaveLength(1);
      expect(orders[0].status).toBe("pending_deposit");
      expect(orders[0].total_paise).toBeGreaterThan(0);

      // Quote revision must be exactly 2 and status 'customer_accepted'
      const quoteRow = db.prepare("SELECT * FROM pl_quotes WHERE id = ?").get(quote.id) as Quote;
      expect(quoteRow.revision).toBe(2);
      expect(quoteRow.status).toBe("customer_accepted");

      // pl_audit must record exactly 1 'accept_quote' mutation with actor_type = 'mcp'
      const auditRows = db
        .prepare("SELECT * FROM pl_audit WHERE entity_id = ? AND action = 'accept_quote'")
        .all(quote.id) as AuditRecord[];
      expect(auditRows).toHaveLength(1);
      expect(auditRows[0].actor_type).toBe("mcp");
      expect(auditRows[0].actor_id).toBe("mcp-agent");
    });

    it("4.2: Expired quote acceptance attempt is blocked with -32009 gate error and creates zero orders", () => {
      const proj = call<PublicProjectDto>("private_label_create_project", {
        client_id: "client_alpha",
        title: "Expired Quote Project",
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

      const db = getDb();
      // Manually backdate expiration to 2 days in the past
      db.prepare("UPDATE pl_quotes SET valid_until = datetime('now', '-2 days') WHERE id = ?").run(quote.id);

      // Attempt accepting expired quote via MCP
      const err = failsWith("private_label_accept_quote", {
        id: quote.id,
        expected_revision: 1,
        client_id: "client_alpha",
      });

      expect(err.code).toBe(-32009);
      expect(err.message).toMatch(/expired/i);

      // Assert zero production orders created
      const orderCount = db
        .prepare("SELECT COUNT(*) as count FROM pl_orders WHERE quote_id = ?")
        .get(quote.id) as { count: number };
      expect(orderCount.count).toBe(0);

      // Quote remains estimated and revision 1
      const qRow = db.prepare("SELECT status, revision FROM pl_quotes WHERE id = ?").get(quote.id) as Quote;
      expect(qRow.status).toBe("estimated");
      expect(qRow.revision).toBe(1);
    });

    it("4.3: Accepting an already-converted quote is blocked with -32009", () => {
      const proj = call<PublicProjectDto>("private_label_create_project", {
        client_id: "client_alpha",
        title: "Converted Quote Project",
      });
      const quote = call<PublicQuoteWithItemsDto>("private_label_create_quote", {
        project_id: proj.id,
        client_id: "client_alpha",
      });

      const db = getDb();
      // Set status to 'converted'
      db.prepare("UPDATE pl_quotes SET status = 'converted' WHERE id = ?").run(quote.id);

      const err = failsWith("private_label_accept_quote", {
        id: quote.id,
        expected_revision: 1,
        client_id: "client_alpha",
      });

      expect(err.code).toBe(-32009);
      expect(err.message).toMatch(/already converted/i);
    });

    it("4.4: Stale expected_revision on quote acceptance throws -32009 diagnostic error", () => {
      const proj = call<PublicProjectDto>("private_label_create_project", {
        client_id: "client_alpha",
        title: "Stale Revision Quote Project",
      });
      const quote = call<PublicQuoteWithItemsDto>("private_label_create_quote", {
        project_id: proj.id,
        client_id: "client_alpha",
      });

      const err = failsWith("private_label_accept_quote", {
        id: quote.id,
        expected_revision: 999,
        client_id: "client_alpha",
      });

      expect(err.code).toBe(-32009);
      expect(err.message).toMatch(/revision conflict on quote/i);
      expect(err.message).toMatch(/current revision: 1, expected: 999/i);
    });
  });

  // =========================================================================
  // Challenge 5: System-wide pl_audit Actor Attribution Verification
  // =========================================================================
  describe("Challenge 5: SQLite Database Integrity & pl_audit Actor Attribution", () => {
    it("5.1: Every MCP mutation records durable actor_type = 'mcp' and actor_id = 'mcp-agent'", () => {
      const db = getDb();

      // Query all audit records generated by MCP calls across our test suites
      const mcpRecords = db
        .prepare("SELECT * FROM pl_audit WHERE actor_type = 'mcp'")
        .all() as AuditRecord[];

      expect(mcpRecords.length).toBeGreaterThanOrEqual(10);

      for (const rec of mcpRecords) {
        expect(rec.actor_type).toBe("mcp");
        expect(rec.actor_id).toBe("mcp-agent");
        expect(rec.actor_email).toBe("mcp-agent@teafloww.com");
        expect(rec.entity_type).toBeTruthy();
        expect(rec.entity_id).toBeTruthy();
        expect(rec.revision).toBeGreaterThanOrEqual(1);

        // Verify diff_json is valid JSON
        expect(() => JSON.parse(rec.diff_json)).not.toThrow();
      }

      // Assert zero null or empty actor_type records anywhere in pl_audit
      const invalidActors = db
        .prepare("SELECT COUNT(*) as count FROM pl_audit WHERE actor_type IS NULL OR actor_type = ''")
        .get() as { count: number };
      expect(invalidActors.count).toBe(0);
    });

    it("5.2: Direct SQL check: revision increments match exact successful mutation counts (zero silent overwrites)", () => {
      const db = getDb();

      // For draft-only projects, verify revision strictly equals 1 + count of successful 'update_draft' audits
      const projects = db.prepare("SELECT id, revision FROM pl_projects").all() as Array<{
        id: string;
        revision: number;
      }>;

      for (const p of projects) {
        const updateAudits = db
          .prepare(
            "SELECT COUNT(*) as count FROM pl_audit WHERE entity_id = ? AND action = 'update_draft'"
          )
          .get(p.id) as { count: number };

        // Check if project has design version activities (which increment project revision)
        const dvCount = db
          .prepare("SELECT COUNT(*) as count FROM pl_design_versions WHERE project_id = ?")
          .get(p.id) as { count: number };

        const approvalCount = db
          .prepare(
            `SELECT COUNT(*) as count FROM pl_approval_events ae
             JOIN pl_design_versions dv ON dv.id = ae.design_version_id
             WHERE dv.project_id = ?`
          )
          .get(p.id) as { count: number };

        // Expected revision = 1 (at creation) + update_draft count + dv count + approval count
        const expectedRevision = 1 + updateAudits.count + dvCount.count + approvalCount.count;
        expect(p.revision).toBe(expectedRevision);
      }

      // Also verify quotes: quote.revision = 1 + count of 'accept_quote' actions
      const quotes = db.prepare("SELECT id, revision FROM pl_quotes").all() as Array<{
        id: string;
        revision: number;
      }>;

      for (const q of quotes) {
        const acceptAudits = db
          .prepare(
            "SELECT COUNT(*) as count FROM pl_audit WHERE entity_id = ? AND action = 'accept_quote'"
          )
          .get(q.id) as { count: number };

        expect(q.revision).toBe(1 + acceptAudits.count);
      }
    });
  });
});
