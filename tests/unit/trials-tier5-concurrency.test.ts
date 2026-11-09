/**
 * TeaFloww Trials v3 — Milestone 6 Phase 2 Adversarial Hardening
 * Tier 5 Concurrency, Race Condition, CAS Optimistic Locking & Chaos Harness
 *
 * Authored by: Milestone 6 Challenger 2 (Empirical Challenger)
 * Verification Scope:
 * 1. Cross-Channel Simultaneous Concurrency: Admin REST PATCH ↔ MCP trial_update race resolution
 * 2. Multi-Actor Contention Barrage: 10 concurrent writes targeting identical expected_revision
 * 3. Stale & Future Revision Replay Attacks: Exact CAS 409 and MCP -32009 conflict envelopes
 * 4. Monotonic Revision Chain: Alternating Admin/MCP sequential mutations with audit log parity
 * 5. State Machine Invariants & Illegal Transition Chaos:
 *    - Direct draft -> published publication gate bypass block (HTTP 422 & MCP -32009)
 *    - DB Trigger trg_trials_publish_insert_guard aborting direct published insertions
 *    - DB Trigger trg_trials_publish_weight_check aborting direct publication with corrupted weights
 *    - Illegal transition guards on draft/in_review/published/archived
 *    - Complete write lockdown on archived trials
 * 6. Parallel Component Replacement & 200g Invariant Hardening:
 *    - 20-request parallel chaos barrage (10 valid, 10 corrupt)
 *    - Invariant SUM(weight_g * quantity) == 200g and COUNT(*) == 4 strictly preserved
 * 7. Transactional Atomicity & Rollback Immutability:
 *    - Zero orphan audit rows on aborted component replace, asset attach, or gate failures
 *    - Zero dirty partial writes
 *    - In-transaction crash rollback verification
 * 8. SQLite PRAGMA Integrity & Foreign Key Consistency Verification
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { rmSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";

const TEST_DB = path.join(tmpdir(), `trials-tier5-concurrency-${process.pid}-${Date.now()}.sqlite`);
process.env.DATABASE_PATH = TEST_DB;

import { getDb } from "@/lib/db";
import { createAdminSession } from "@/lib/adminSessions";
import { resetRateLimits } from "@/lib/rateLimit";
import { TrialService } from "@/lib/trials/service";
import { dispatchToolCall, McpError } from "@/lib/mcp";
import { type AuditActor } from "@/lib/trials/types";

// Route Handlers
import { POST as createAdminTrial } from "@/app/api/v1/admin/trials/route";
import { PATCH as updateAdminTrial } from "@/app/api/v1/admin/trials/[id]/route";
import { PUT as replaceComponentsAdmin } from "@/app/api/v1/admin/trials/[id]/components/route";
import { POST as attachAssetAdmin } from "@/app/api/v1/admin/trials/[id]/assets/route";
import { POST as submitReviewAdmin } from "@/app/api/v1/admin/trials/[id]/submit-review/route";
import { POST as publishAdmin } from "@/app/api/v1/admin/trials/[id]/publish/route";
import { POST as unpublishAdmin } from "@/app/api/v1/admin/trials/[id]/unpublish/route";
import { POST as archiveAdmin } from "@/app/api/v1/admin/trials/[id]/archive/route";

const VALID_4X50G_COMPONENTS = [
  {
    slot_index: 0,
    name: "Gopaldhara Red Thunder",
    estate: "Gopaldhara",
    grade: "FTGFOP1",
    flush: "Autumn Flush",
    elevation: "1800m",
    weight_g: 50,
    quantity: 1,
    tasting_notes: ["Muscatel", "Honey"],
    brew_temp_c: 90,
    brew_time_sec: 210,
    leaf_dose_g: 2.5,
  },
  {
    slot_index: 1,
    name: "Makaibari Silver Tips",
    estate: "Makaibari",
    grade: "Silver Needles",
    flush: "Spring Clonal",
    elevation: "1500m",
    weight_g: 50,
    quantity: 1,
    tasting_notes: ["Jasmine", "Floral"],
    brew_temp_c: 80,
    brew_time_sec: 240,
    leaf_dose_g: 3.0,
  },
  {
    slot_index: 2,
    name: "Castleton Muscatel Reserve",
    estate: "Castleton",
    grade: "FTGFOP1",
    flush: "Second Flush",
    elevation: "1600m",
    weight_g: 50,
    quantity: 1,
    tasting_notes: ["Muscat Grape", "Wood Smoke"],
    brew_temp_c: 95,
    brew_time_sec: 180,
    leaf_dose_g: 2.5,
  },
  {
    slot_index: 3,
    name: "Rohini Moonlight Oolong",
    estate: "Rohini",
    grade: "Special Clonal",
    flush: "Summer Flush",
    elevation: "1400m",
    weight_g: 50,
    quantity: 1,
    tasting_notes: ["Peach", "Gardenia"],
    brew_temp_c: 85,
    brew_time_sec: 210,
    leaf_dose_g: 2.5,
  },
];

const ADMIN_ACTOR: AuditActor = {
  actor_type: "admin",
  actor_id: "admin-tester",
  actor_email: "admin@teafloww.com",
  reason: "Tier 5 Concurrency Test Action",
};

describe("Milestone 6 Tier 5: Adversarial Concurrency, CAS Locking & Chaos Hardening", () => {
  let adminCookie: string;

  beforeAll(() => {
    // Run complete migrations on isolated test database
    execFileSync(process.execPath, ["scripts/migrate.mjs"], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_PATH: TEST_DB },
      stdio: "ignore",
    });

    const db = getDb();
    db.prepare(`
      INSERT OR IGNORE INTO admin_users (id, username, password_hash, role)
      VALUES (1, 'admin', 'hash', 'root')
    `).run();

    const session = createAdminSession(1);
    adminCookie = `admin_session=${session.cookieValue}`;
  });

  afterAll(() => {
    const db = getDb();
    try {
      // PRAGMA checks before closing
      const integrity = db.pragma("integrity_check") as Array<{ integrity_check: string }>;
      expect(integrity[0].integrity_check).toBe("ok");

      const fkCheck = db.pragma("foreign_key_check") as unknown[];
      expect(fkCheck.length).toBe(0);

      db.close();
    } catch {}

    for (const suffix of ["", "-shm", "-wal", "-journal"]) {
      try {
        rmSync(TEST_DB + suffix, { force: true });
      } catch {}
    }
  });

  beforeEach(() => {
    resetRateLimits();
    const db = getDb();
    db.prepare("DELETE FROM trials WHERE slug LIKE 'tier5-%'").run();
  });

  // Helpers
  function adminReq(
    url: string,
    init?: { method?: string; body?: unknown; headers?: Record<string, string> }
  ): NextRequest {
    const bodyStr =
      init?.body !== undefined
        ? typeof init.body === "string"
          ? init.body
          : JSON.stringify(init.body)
        : undefined;

    return new NextRequest(url, {
      method: init?.method || "GET",
      body: bodyStr,
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
        "x-admin-test-token": "trials-test-admin-secret-token",
        ...init?.headers,
      },
    });
  }

  function mcpCall<T = any>(name: string, args: unknown): T {
    return dispatchToolCall(name, args) as T;
  }

  function mcpFailsWith(name: string, args: unknown): McpError {
    try {
      dispatchToolCall(name, args);
    } catch (error) {
      expect(error).toBeInstanceOf(McpError);
      return error as McpError;
    }
    throw new Error(`Expected tool "${name}" to fail with McpError`);
  }

  // =========================================================================
  // Suite 1: Cross-Channel Concurrency & Optimistic Locking (Admin REST vs MCP)
  // =========================================================================
  describe("Suite 1: Cross-Channel Concurrency & Optimistic CAS Concurrency", () => {
    it("1.1: Simultaneous Admin REST PATCH vs MCP trial_update race resolves cleanly with 1 winner and 1 CAS conflict", async () => {
      const slug = `tier5-race-${Date.now()}`;
      const trial = TrialService.createDraft(
        {
          title: "Initial Concurrency Race Kit",
          slug,
          price_paise: 24000,
          components: VALID_4X50G_COMPONENTS,
        },
        ADMIN_ACTOR
      );
      expect(trial.revision).toBe(1);

      // Prepare concurrent Admin PATCH and MCP update targeting expected_revision = 1
      const adminPromise = updateAdminTrial(
        adminReq(`http://localhost/api/v1/admin/trials/${trial.id}`, {
          method: "PATCH",
          body: {
            expected_revision: 1,
            title: "Updated Title via Admin REST",
          },
        }),
        { params: Promise.resolve({ id: trial.id }) }
      );

      const mcpPromise = new Promise<{ winner: "mcp"; data: any } | { winner: "mcp_failed"; error: McpError }>(
        (resolve) => {
          try {
            const res = mcpCall("trial_update", {
              id: trial.id,
              expected_revision: 1,
              title: "Updated Title via MCP Tool",
            });
            resolve({ winner: "mcp", data: res });
          } catch (err) {
            resolve({ winner: "mcp_failed", error: err as McpError });
          }
        }
      );

      const [adminResult, mcpResult] = await Promise.all([adminPromise, mcpPromise]);

      const adminJson = await adminResult.json();
      const adminWon = adminResult.status === 200;
      const mcpWon = mcpResult.winner === "mcp";

      // Exactly ONE channel must win, the other MUST fail with CAS revision conflict
      expect(adminWon !== mcpWon).toBe(true);

      if (adminWon) {
        expect(adminResult.status).toBe(200);
        if (mcpResult.winner === "mcp_failed") {
          expect(mcpResult.error.code).toBe(-32009);
          expect(mcpResult.error.message).toMatch(/conflict|revision mismatch/i);
        } else {
          expect.fail("Expected MCP request to fail with McpError");
        }
      } else {
        expect(mcpWon).toBe(true);
        expect(adminResult.status).toBe(409);
        expect(adminJson.error).toMatch(/revision conflict/i);
        expect(adminJson.current_revision).toBe(2);
        expect(adminJson.expected_revision).toBe(1);
      }

      // Verify Database state
      const refreshed = TrialService.getById(trial.id)!;
      expect(refreshed.revision).toBe(2);
      expect(refreshed.title).toBe(
        adminWon ? "Updated Title via Admin REST" : "Updated Title via MCP Tool"
      );

      // Verify Audit Log: exactly 2 entries (create_draft at rev 1 + 1 update at rev 2)
      const history = TrialService.getHistory(trial.id);
      expect(history.length).toBe(2);
      expect(history[0].revision).toBe(2);
      expect(history[0].actor_type).toBe(adminWon ? "admin" : "mcp");
      expect(history[1].revision).toBe(1);
      expect(history[1].action).toBe("create_draft");
    });

    it("1.2: Multi-Actor 10-write contention burst permits exactly 1 write and traps remaining 9 with 409 or -32009", async () => {
      const slug = `tier5-burst-${Date.now()}`;
      const trial = TrialService.createDraft(
        {
          title: "Multi-Actor Contention Burst Kit",
          slug,
          price_paise: 29900,
          components: VALID_4X50G_COMPONENTS,
        },
        ADMIN_ACTOR
      );
      expect(trial.revision).toBe(1);

      // Launch 5 Admin PATCH requests and 5 MCP requests simultaneously, all with expected_revision = 1
      const workers = Array.from({ length: 10 }, (_, i) => {
        if (i % 2 === 0) {
          // Admin REST worker
          return (async () => {
            const res = await updateAdminTrial(
              adminReq(`http://localhost/api/v1/admin/trials/${trial.id}`, {
                method: "PATCH",
                body: {
                  expected_revision: 1,
                  title: `Admin Worker ${i} Title`,
                },
              }),
              { params: Promise.resolve({ id: trial.id }) }
            );
            return {
              channel: "admin",
              status: res.status,
              body: await res.json(),
            };
          })();
        } else {
          // MCP worker
          return (async () => {
            try {
              const res = mcpCall("trial_update", {
                id: trial.id,
                expected_revision: 1,
                title: `MCP Worker ${i} Title`,
              });
              return { channel: "mcp", status: 200, body: res };
            } catch (err) {
              const mcpErr = err as McpError;
              return { channel: "mcp", status: mcpErr.code, body: { error: mcpErr.message } };
            }
          })();
        }
      });

      const results = await Promise.all(workers);

      const successes = results.filter((r) => r.status === 200);
      const conflicts = results.filter((r) => r.status === 409 || r.status === -32009);

      expect(successes.length).toBe(1);
      expect(conflicts.length).toBe(9);

      // Verify each conflict payload
      for (const conf of conflicts) {
        if (conf.channel === "admin") {
          expect(conf.status).toBe(409);
          expect(conf.body.current_revision).toBe(2);
          expect(conf.body.expected_revision).toBe(1);
        } else {
          expect(conf.status).toBe(-32009);
        }
      }

      // Database state verification
      const refreshed = TrialService.getById(trial.id)!;
      expect(refreshed.revision).toBe(2);

      const auditRows = TrialService.getHistory(trial.id);
      expect(auditRows.length).toBe(2); // create_draft (rev 1) + exactly 1 update (rev 2)
      expect(auditRows[0].revision).toBe(2);
    });

    it("1.3: Stale and future revision replay attacks are strictly rejected across Admin REST and MCP", async () => {
      const slug = `tier5-replay-${Date.now()}`;
      const trial = TrialService.createDraft(
        {
          title: "Revision Replay Attack Kit",
          slug,
          price_paise: 25000,
          components: VALID_4X50G_COMPONENTS,
        },
        ADMIN_ACTOR
      );

      // Advance through 3 valid sequential updates: revision 1 -> 2 -> 3 -> 4
      TrialService.update(trial.id, 1, { title: "Rev 2 Title" }, ADMIN_ACTOR);
      TrialService.update(trial.id, 2, { title: "Rev 3 Title" }, ADMIN_ACTOR);
      TrialService.update(trial.id, 3, { title: "Rev 4 Title" }, ADMIN_ACTOR);

      const current = TrialService.getById(trial.id)!;
      expect(current.revision).toBe(4);

      // Attack A: Stale Admin PATCH with revision 1
      const staleRes1 = await updateAdminTrial(
        adminReq(`http://localhost/api/v1/admin/trials/${trial.id}`, {
          method: "PATCH",
          body: { expected_revision: 1, title: "Malicious Overwrite Rev 1" },
        }),
        { params: Promise.resolve({ id: trial.id }) }
      );
      expect(staleRes1.status).toBe(409);
      const staleBody1 = await staleRes1.json();
      expect(staleBody1.current_revision).toBe(4);
      expect(staleBody1.expected_revision).toBe(1);

      // Attack B: Stale MCP trial_update with revision 2
      const mcpErr2 = mcpFailsWith("trial_update", {
        id: trial.id,
        expected_revision: 2,
        title: "Malicious MCP Overwrite Rev 2",
      });
      expect(mcpErr2.code).toBe(-32009);

      // Attack C: Stale Admin PUT components with revision 3
      const staleCompRes = await replaceComponentsAdmin(
        adminReq(`http://localhost/api/v1/admin/trials/${trial.id}/components`, {
          method: "PUT",
          body: { expected_revision: 3, components: VALID_4X50G_COMPONENTS },
        }),
        { params: Promise.resolve({ id: trial.id }) }
      );
      expect(staleCompRes.status).toBe(409);
      const staleCompBody = await staleCompRes.json();
      expect(staleCompBody.current_revision).toBe(4);
      expect(staleCompBody.expected_revision).toBe(3);

      // Attack D: Future revision replay (expected_revision = 999) via MCP
      const mcpFutureErr = mcpFailsWith("trial_components_replace", {
        id: trial.id,
        expected_revision: 999,
        components: VALID_4X50G_COMPONENTS,
      });
      expect(mcpFutureErr.code).toBe(-32009);

      // Assert zero mutation on state or audit trail
      const unchanged = TrialService.getById(trial.id)!;
      expect(unchanged.revision).toBe(4);
      expect(unchanged.title).toBe("Rev 4 Title");
      const audit = TrialService.getHistory(trial.id);
      expect(audit.length).toBe(4); // Only the 4 valid transitions
    });

    it("1.4: Monotonic lockstep handoff preserves strict sequential revision chain and audit attribution", async () => {
      const slug = `tier5-lockstep-${Date.now()}`;

      // 1. Admin creates draft -> rev 1
      const created = TrialService.createDraft(
        {
          title: "Lockstep Handoff Kit",
          slug,
          price_paise: 28000,
          components: VALID_4X50G_COMPONENTS,
        },
        ADMIN_ACTOR
      );
      expect(created.revision).toBe(1);

      // 2. Admin REST updates title -> rev 2
      const resAdminPatch = await updateAdminTrial(
        adminReq(`http://localhost/api/v1/admin/trials/${created.id}`, {
          method: "PATCH",
          body: { expected_revision: 1, title: "Lockstep Title (Admin)" },
        }),
        { params: Promise.resolve({ id: created.id }) }
      );
      expect(resAdminPatch.status).toBe(200);

      // 3. MCP updates description -> rev 3
      const resMcpUpdate = mcpCall("trial_update", {
        id: created.id,
        expected_revision: 2,
        description: "Curated blend notes updated by MCP tea specialist.",
      });
      expect(resMcpUpdate.revision).toBe(3);

      // 4. Admin REST replaces components -> rev 4
      const resAdminComp = await replaceComponentsAdmin(
        adminReq(`http://localhost/api/v1/admin/trials/${created.id}/components`, {
          method: "PUT",
          body: { expected_revision: 3, components: VALID_4X50G_COMPONENTS },
        }),
        { params: Promise.resolve({ id: created.id }) }
      );
      expect(resAdminComp.status).toBe(200);

      // 5. MCP attaches media asset -> rev 5
      const resMcpAsset = mcpCall("trial_media_attach", {
        id: created.id,
        expected_revision: 4,
        asset_url: "/images/trials/discovery-packaging.jpg",
        stage: "packaging",
        alt_text: "Exterior 4-sachet discovery box packaging front view",
      });
      expect(resMcpAsset.revision).toBe(5);

      // Verify audit log has strict sequential monotonic revisions: [5, 4, 3, 2, 1]
      const auditLog = TrialService.getHistory(created.id);
      expect(auditLog.length).toBe(5);
      expect(auditLog.map((a) => a.revision)).toEqual([5, 4, 3, 2, 1]);
      expect(auditLog.map((a) => a.actor_type)).toEqual(["mcp", "admin", "mcp", "admin", "admin"]);
    });

    it("1.5: 50-request high-volume concurrent storm permits exactly 1 write and traps 49 with CAS conflicts", async () => {
      const slug = `tier5-storm-${Date.now()}`;
      const trial = TrialService.createDraft(
        {
          title: "50-Request Storm Kit",
          slug,
          price_paise: 35000,
          components: VALID_4X50G_COMPONENTS,
        },
        ADMIN_ACTOR
      );
      expect(trial.revision).toBe(1);

      // Launch 25 Admin PATCH + 25 MCP update requests simultaneously targeting expected_revision = 1
      const requests = Array.from({ length: 50 }, (_, i) => {
        if (i % 2 === 0) {
          return (async () => {
            const res = await updateAdminTrial(
              adminReq(`http://localhost/api/v1/admin/trials/${trial.id}`, {
                method: "PATCH",
                body: { expected_revision: 1, title: `Storm Admin ${i}` },
              }),
              { params: Promise.resolve({ id: trial.id }) }
            );
            return { channel: "admin", status: res.status, body: await res.json() };
          })();
        } else {
          return (async () => {
            try {
              const res = mcpCall("trial_update", {
                id: trial.id,
                expected_revision: 1,
                title: `Storm MCP ${i}`,
              });
              return { channel: "mcp", status: 200, body: res };
            } catch (err) {
              const mcpErr = err as McpError;
              return { channel: "mcp", status: mcpErr.code, body: { error: mcpErr.message } };
            }
          })();
        }
      });

      const results = await Promise.all(requests);
      const successes = results.filter((r) => r.status === 200);
      const conflicts = results.filter((r) => r.status === 409 || r.status === -32009);

      expect(successes.length).toBe(1);
      expect(conflicts.length).toBe(49);

      const refreshed = TrialService.getById(trial.id)!;
      expect(refreshed.revision).toBe(2);

      const audit = TrialService.getHistory(trial.id);
      expect(audit.length).toBe(2); // create_draft + single winner update
      expect(audit[0].revision).toBe(2);
    });

    it("1.6: Concurrent slug collision race allows exactly one registration and rejects the duplicate", async () => {
      const sharedSlug = `tier5-slug-race-${Date.now()}`;

      const createP1 = createAdminTrial(
        adminReq("http://localhost/api/v1/admin/trials", {
          method: "POST",
          body: {
            title: "Slug Race Competitor 1",
            slug: sharedSlug,
            price_paise: 20000,
          },
        })
      );

      const createP2 = createAdminTrial(
        adminReq("http://localhost/api/v1/admin/trials", {
          method: "POST",
          body: {
            title: "Slug Race Competitor 2",
            slug: sharedSlug,
            price_paise: 22000,
          },
        })
      );

      const [res1, res2] = await Promise.all([createP1, createP2]);
      const statuses = [res1.status, res2.status];

      expect(statuses).toContain(201);
      expect(statuses).toContain(409);

      const db = getDb();
      const records = db.prepare("SELECT id FROM trials WHERE slug = ?").all(sharedSlug);
      expect(records.length).toBe(1);
    });
  });

  // =========================================================================
  // Suite 2: State Machine Invariants & Illegal State Transition Chaos
  // =========================================================================
  describe("Suite 2: State-Machine Invariants & Illegal State Transitions", () => {
    it("2.1: Illegal state transition directly bypassing publish gate is rejected with 422 & -32009", async () => {
      const slug = `tier5-gate-bypass-${Date.now()}`;
      // Incomplete draft (no hero image, inventory=0, no SEO)
      const trial = TrialService.createDraft(
        {
          title: "Incomplete Bare Draft Kit",
          slug,
          price_paise: 20000,
          inventory_quantity: 0,
          inventory_policy: "track",
        },
        ADMIN_ACTOR
      );

      // Attempt A: Admin POST /publish directly
      const publishRes = await publishAdmin(
        adminReq(`http://localhost/api/v1/admin/trials/${trial.id}/publish`, {
          method: "POST",
          body: { expected_revision: 1 },
        }),
        { params: Promise.resolve({ id: trial.id }) }
      );
      expect(publishRes.status).toBe(422);
      const pubBody = await publishRes.json();
      expect(pubBody.blockers).toBeDefined();
      expect(pubBody.blockers.length).toBeGreaterThan(0);

      // Attempt B: MCP trial_publish directly
      const mcpErr = mcpFailsWith("trial_publish", {
        id: trial.id,
        expected_revision: 1,
      });
      expect(mcpErr.code).toBe(-32009);
      expect(mcpErr.message).toMatch(/cannot publish|blocker/i);

      // State remains strictly draft, revision unchanged
      const current = TrialService.getById(trial.id)!;
      expect(current.status).toBe("draft");
      expect(current.revision).toBe(1);

      // Ensure no snapshot was created
      const db = getDb();
      const pubRows = db.prepare("SELECT * FROM trial_publications WHERE trial_id = ?").all(trial.id);
      expect(pubRows.length).toBe(0);
    });

    it("2.2: Direct SQL trigger trg_trials_publish_insert_guard aborts raw direct 'published' insertion", () => {
      const db = getDb();
      const directId = randomUUID();
      const directSlug = `tier5-direct-pub-${Date.now()}`;

      expect(() => {
        db.prepare(`
          INSERT INTO trials (
            id, slug, title, status, pack_format, net_weight_g, price_paise, sku, revision
          ) VALUES (?, ?, 'Direct Published Attempt', 'published', '4x50g_sachets', 200, 20000, ?, 1)
        `).run(directId, directSlug, `SKU-DIRECT-${Date.now()}`);
      }).toThrow(/Cannot insert trial directly as published: must start as draft/);

      const check = db.prepare("SELECT id FROM trials WHERE id = ?").get(directId);
      expect(check).toBeUndefined();
    });

    it("2.3: Illegal lifecycle state transitions are blocked with 409 / -32009", async () => {
      const slug = `tier5-lifecycle-${Date.now()}`;
      const trial = TrialService.createDraft(
        {
          title: "Lifecycle Transition Test Kit",
          slug,
          price_paise: 22000,
          components: VALID_4X50G_COMPONENTS,
        },
        ADMIN_ACTOR
      );

      // Case A: Unpublish a draft -> Invalid transition
      const unpubRes = await unpublishAdmin(
        adminReq(`http://localhost/api/v1/admin/trials/${trial.id}/unpublish`, {
          method: "POST",
          body: { expected_revision: 1 },
        }),
        { params: Promise.resolve({ id: trial.id }) }
      );
      expect(unpubRes.status).toBe(409);

      // Case B: Transition draft -> in_review
      const reviewRes = await submitReviewAdmin(
        adminReq(`http://localhost/api/v1/admin/trials/${trial.id}/submit-review`, {
          method: "POST",
          body: { expected_revision: 1 },
        }),
        { params: Promise.resolve({ id: trial.id }) }
      );
      expect(reviewRes.status).toBe(200);

      // Case C: Attempt submit-review AGAIN on an already in_review trial
      const doubleReviewRes = await submitReviewAdmin(
        adminReq(`http://localhost/api/v1/admin/trials/${trial.id}/submit-review`, {
          method: "POST",
          body: { expected_revision: 2 },
        }),
        { params: Promise.resolve({ id: trial.id }) }
      );
      expect(doubleReviewRes.status).toBe(409);

      // Case D: Archive the trial
      const archiveRes = await archiveAdmin(
        adminReq(`http://localhost/api/v1/admin/trials/${trial.id}/archive`, {
          method: "POST",
          body: { expected_revision: 2 },
        }),
        { params: Promise.resolve({ id: trial.id }) }
      );
      expect(archiveRes.status).toBe(200);

      const archived = TrialService.getById(trial.id)!;
      expect(archived.status).toBe("archived");
      expect(archived.revision).toBe(3);

      // Case E: Attempt mutations on archived trial (all must fail with 409 / -32009)
      const patchArchived = await updateAdminTrial(
        adminReq(`http://localhost/api/v1/admin/trials/${trial.id}`, {
          method: "PATCH",
          body: { expected_revision: 3, title: "Cannot Mutate Archived" },
        }),
        { params: Promise.resolve({ id: trial.id }) }
      );
      expect(patchArchived.status).toBe(409);

      const compArchived = await replaceComponentsAdmin(
        adminReq(`http://localhost/api/v1/admin/trials/${trial.id}/components`, {
          method: "PUT",
          body: { expected_revision: 3, components: VALID_4X50G_COMPONENTS },
        }),
        { params: Promise.resolve({ id: trial.id }) }
      );
      expect(compArchived.status).toBe(409);

      const mcpArchivedErr = mcpFailsWith("trial_update", {
        id: trial.id,
        expected_revision: 3,
        title: "MCP Mutate Archived",
      });
      expect(mcpArchivedErr.code).toBe(-32009);
    });

    it("2.4: Direct SQL trigger trg_trials_publish_weight_check aborts publication if component weights != 200g", () => {
      const db = getDb();
      const slug = `tier5-weight-trg-${Date.now()}`;
      const trial = TrialService.createDraft(
        {
          title: "Corrupt Weight Kit",
          slug,
          price_paise: 25000,
          components: VALID_4X50G_COMPONENTS,
        },
        ADMIN_ACTOR
      );

      // Directly corrupt kit weight in SQLite by deleting slot 0 component (total becomes 150g != 200g)
      db.prepare("DELETE FROM trial_components WHERE trial_id = ? AND slot_index = 0").run(
        trial.id
      );

      // Attempt direct SQL status update to 'published'
      expect(() => {
        db.prepare("UPDATE trials SET status = 'published' WHERE id = ?").run(trial.id);
      }).toThrow(/Cannot publish trial: component weights must sum to exactly 200g/);

      // Verify trial status remains 'draft'
      const check = db.prepare("SELECT status FROM trials WHERE id = ?").get(trial.id) as { status: string };
      expect(check.status).toBe("draft");
    });

    it("2.5: Rapid publish -> unpublish -> republish lifecycle preserves snapshot history and is_active flag", async () => {
      const slug = `tier5-pub-cycle-${Date.now()}`;
      // Fully formed valid kit
      const trial = TrialService.createDraft(
        {
          title: "Full Lifecycle Cycle Kit",
          slug,
          tagline: "Authentic Himalayan harvest collection",
          description: "Curated 4-estate discovery box containing four 50g vacuum sealed pouches.",
          price_paise: 29900,
          inventory_policy: "continue",
          components: VALID_4X50G_COMPONENTS,
        },
        ADMIN_ACTOR
      );

      // Attach required packaging photo
      TrialService.attachAsset(
        trial.id,
        1,
        {
          asset_url: "/images/trials/discovery-packaging.jpg",
          stage: "packaging",
          alt_text: "Exterior presentation box with batch stamps",
        },
        ADMIN_ACTOR
      );

      // Gate check
      const gate = TrialService.validate(trial.id);
      expect(gate.can_publish).toBe(true);

      // Step 1: Submit Review (rev 2 -> 3)
      const inRev = TrialService.submitReview(trial.id, 2, ADMIN_ACTOR);
      expect(inRev.status).toBe("in_review");
      expect(inRev.revision).toBe(3);

      // Step 2: Publish (rev 3 -> 4)
      const published = TrialService.publish(trial.id, 3, ADMIN_ACTOR);
      expect(published.status).toBe("published");
      expect(published.revision).toBe(4);

      const db = getDb();
      const pub1 = db.prepare("SELECT * FROM trial_publications WHERE trial_id = ?").all(trial.id) as any[];
      expect(pub1.length).toBe(1);
      expect(pub1[0].is_active).toBe(1);
      expect(pub1[0].revision).toBe(4);

      // Step 3: Unpublish back to draft (rev 4 -> 5)
      const unpublished = TrialService.unpublish(trial.id, 4, ADMIN_ACTOR);
      expect(unpublished.status).toBe("draft");
      expect(unpublished.revision).toBe(5);

      const pubAfterUnpub = db.prepare("SELECT * FROM trial_publications WHERE trial_id = ?").all(trial.id) as any[];
      expect(pubAfterUnpub.length).toBe(1);
      expect(pubAfterUnpub[0].is_active).toBe(0); // Deactivated

      // Step 4: Re-submit review (rev 5 -> 6)
      TrialService.submitReview(trial.id, 5, ADMIN_ACTOR);

      // Step 5: Republish (rev 6 -> 7)
      const repub = TrialService.publish(trial.id, 6, ADMIN_ACTOR);
      expect(repub.status).toBe("published");
      expect(repub.revision).toBe(7);

      const pubAfterRepub = db
        .prepare("SELECT * FROM trial_publications WHERE trial_id = ? ORDER BY revision ASC")
        .all(trial.id) as any[];
      expect(pubAfterRepub.length).toBe(2);
      expect(pubAfterRepub[0].revision).toBe(4);
      expect(pubAfterRepub[0].is_active).toBe(0); // Old snapshot stays inactive
      expect(pubAfterRepub[1].revision).toBe(7);
      expect(pubAfterRepub[1].is_active).toBe(1); // Latest snapshot is active
    });
  });

  // =========================================================================
  // Suite 3: Parallel Component Replacement & 200g Invariant Hardening
  // =========================================================================
  describe("Suite 3: Parallel Component Replacement & 200g Invariant Hardening", () => {
    it("3.1: 20-request parallel chaos barrage guarantees 200g net weight invariant is NEVER breached", async () => {
      const slug = `tier5-comp-chaos-${Date.now()}`;
      const trial = TrialService.createDraft(
        {
          title: "Component Chaos Stress Kit",
          slug,
          price_paise: 32000,
          components: VALID_4X50G_COMPONENTS,
        },
        ADMIN_ACTOR
      );
      expect(trial.revision).toBe(1);

      // Build 10 valid payloads with slight variations in blend names
      const validPayloads = Array.from({ length: 10 }, (_, i) =>
        VALID_4X50G_COMPONENTS.map((c) => ({
          ...c,
          name: `${c.name} Iteration ${i}`,
        }))
      );

      // Build 10 corrupt payloads violating the 4x50g=200g invariant
      const corruptPayloads = [
        VALID_4X50G_COMPONENTS.slice(0, 3), // Only 3 sachets (150g)
        [...VALID_4X50G_COMPONENTS, { ...VALID_4X50G_COMPONENTS[0], slot_index: 4 }], // 5 sachets (250g)
        VALID_4X50G_COMPONENTS.map((c) => ({ ...c, weight_g: 40 })), // 4x40g = 160g
        VALID_4X50G_COMPONENTS.map((c) => ({ ...c, weight_g: 60 })), // 4x60g = 240g
        [
          { ...VALID_4X50G_COMPONENTS[0], slot_index: 0, weight_g: 100 },
          { ...VALID_4X50G_COMPONENTS[1], slot_index: 1, weight_g: 100 },
        ], // 2x100g = 200g but count=2 != 4
        VALID_4X50G_COMPONENTS.map((c) => ({ ...c, slot_index: 0 })), // Duplicate slot_index 0
        [], // Empty array
        VALID_4X50G_COMPONENTS.map((c) => ({ ...c, weight_g: -50 })), // Negative weight
        VALID_4X50G_COMPONENTS.map((c) => ({ ...c, name: "" })), // Missing name
        VALID_4X50G_COMPONENTS.map((c) => ({ ...c, brew_temp_c: -10 })), // Negative brew temp
      ];

      // Fire all 20 requests concurrently targeting expected_revision = 1
      const requests = [
        ...validPayloads.map((comps, idx) =>
          idx % 2 === 0
            ? replaceComponentsAdmin(
                adminReq(`http://localhost/api/v1/admin/trials/${trial.id}/components`, {
                  method: "PUT",
                  body: { expected_revision: 1, components: comps },
                }),
                { params: Promise.resolve({ id: trial.id }) }
              ).then(async (r) => ({ type: "valid", status: r.status, body: await r.json() }))
            : Promise.resolve().then(() => {
                try {
                  const res = mcpCall("trial_components_replace", {
                    id: trial.id,
                    expected_revision: 1,
                    components: comps,
                  });
                  return { type: "valid", status: 200, body: res };
                } catch (err) {
                  return { type: "valid", status: (err as McpError).code, body: { error: (err as Error).message } };
                }
              })
        ),
        ...corruptPayloads.map((comps, idx) =>
          idx % 2 === 0
            ? replaceComponentsAdmin(
                adminReq(`http://localhost/api/v1/admin/trials/${trial.id}/components`, {
                  method: "PUT",
                  body: { expected_revision: 1, components: comps },
                }),
                { params: Promise.resolve({ id: trial.id }) }
              ).then(async (r) => ({ type: "corrupt", status: r.status, body: await r.json() }))
            : Promise.resolve().then(() => {
                try {
                  const res = mcpCall("trial_components_replace", {
                    id: trial.id,
                    expected_revision: 1,
                    components: comps,
                  });
                  return { type: "corrupt", status: 200, body: res };
                } catch (err) {
                  return { type: "corrupt", status: (err as McpError).code, body: { error: (err as Error).message } };
                }
              })
        ),
      ];

      const responses = await Promise.all(requests);

      // Verify outcomes:
      // 1. None of the corrupt payloads succeeded (status must be 400, 422, or -32602)
      const corruptSuccesses = responses.filter((r) => r.type === "corrupt" && r.status === 200);
      expect(corruptSuccesses.length).toBe(0);

      // 2. Exactly ONE valid payload succeeded, and the rest were trapped by CAS 409 / -32009
      const validSuccesses = responses.filter((r) => r.type === "valid" && r.status === 200);
      const validConflicts = responses.filter(
        (r) => r.type === "valid" && (r.status === 409 || r.status === -32009)
      );

      expect(validSuccesses.length).toBe(1);
      expect(validConflicts.length).toBe(9);

      // 3. Database Invariant Check: The DB MUST have exactly 4 components with sum(weight_g * quantity) == 200g
      const db = getDb();
      const summary = db
        .prepare(
          `SELECT COUNT(*) as count, SUM(weight_g * quantity) as total_weight
           FROM trial_components WHERE trial_id = ?`
        )
        .get(trial.id) as { count: number; total_weight: number };

      expect(summary.count).toBe(4);
      expect(summary.total_weight).toBe(200);

      // 4. Slots are strictly 0, 1, 2, 3
      const slots = db
        .prepare("SELECT slot_index FROM trial_components WHERE trial_id = ? ORDER BY slot_index ASC")
        .all(trial.id) as Array<{ slot_index: number }>;
      expect(slots.map((s) => s.slot_index)).toEqual([0, 1, 2, 3]);

      // 5. Revision is exactly 2
      const trialCheck = TrialService.getById(trial.id)!;
      expect(trialCheck.revision).toBe(2);
    });

    it("3.2: Rapid slot permutation preserves slot_index uniqueness and order", () => {
      const slug = `tier5-slot-perm-${Date.now()}`;
      const trial = TrialService.createDraft(
        {
          title: "Slot Permutation Kit",
          slug,
          price_paise: 25000,
          components: VALID_4X50G_COMPONENTS,
        },
        ADMIN_ACTOR
      );

      // Permute slots: reverse the order of estates and tasting notes across slots 0..3
      const reversed = VALID_4X50G_COMPONENTS.map((c, idx) => ({
        ...c,
        slot_index: idx,
        name: `Permuted ${VALID_4X50G_COMPONENTS[3 - idx].name}`,
        estate: VALID_4X50G_COMPONENTS[3 - idx].estate,
      }));

      const updated = TrialService.replaceComponents(trial.id, 1, reversed, ADMIN_ACTOR);
      expect(updated.revision).toBe(2);

      const db = getDb();
      const slots = db
        .prepare("SELECT slot_index, name FROM trial_components WHERE trial_id = ? ORDER BY slot_index ASC")
        .all(trial.id) as Array<{ slot_index: number; name: string }>;

      expect(slots.map((s) => s.slot_index)).toEqual([0, 1, 2, 3]);
      expect(slots[0].name).toContain(VALID_4X50G_COMPONENTS[3].name);
      expect(slots[3].name).toContain(VALID_4X50G_COMPONENTS[0].name);
    });
  });

  // =========================================================================
  // Suite 4: Transactional Atomicity, Rollback Immutability & Audit Trail Integrity
  // =========================================================================
  describe("Suite 4: Transactional Atomicity & Rollback Immutability", () => {
    it("4.1: Aborted component replacement rolls back atomically with ZERO orphan audit rows", async () => {
      const slug = `tier5-rollback-comp-${Date.now()}`;
      const trial = TrialService.createDraft(
        {
          title: "Rollback Component Test Kit",
          slug,
          price_paise: 26000,
          components: VALID_4X50G_COMPONENTS,
        },
        ADMIN_ACTOR
      );

      const preHistory = TrialService.getHistory(trial.id);
      expect(preHistory.length).toBe(1); // create_draft only

      const db = getDb();
      const preComponents = db
        .prepare("SELECT * FROM trial_components WHERE trial_id = ? ORDER BY slot_index ASC")
        .all(trial.id);

      // Attempt invalid component replacement (e.g. 150g total)
      const badComps = VALID_4X50G_COMPONENTS.slice(0, 3);
      const res = await replaceComponentsAdmin(
        adminReq(`http://localhost/api/v1/admin/trials/${trial.id}/components`, {
          method: "PUT",
          body: { expected_revision: 1, components: badComps },
        }),
        { params: Promise.resolve({ id: trial.id }) }
      );
      expect(res.status).toBe(422);

      // Verify post-state: NO orphan audit rows!
      const postHistory = TrialService.getHistory(trial.id);
      expect(postHistory.length).toBe(1);
      expect(postHistory[0].action).toBe("create_draft");

      // Verify components completely unchanged
      const postComponents = db
        .prepare("SELECT * FROM trial_components WHERE trial_id = ? ORDER BY slot_index ASC")
        .all(trial.id);
      expect(postComponents).toEqual(preComponents);

      // Verify revision unchanged
      const current = TrialService.getById(trial.id)!;
      expect(current.revision).toBe(1);
    });

    it("4.2: Aborted asset attachment rolls back atomically with ZERO orphan audit rows", async () => {
      const slug = `tier5-rollback-asset-${Date.now()}`;
      const trial = TrialService.createDraft(
        {
          title: "Rollback Asset Test Kit",
          slug,
          price_paise: 27000,
          components: VALID_4X50G_COMPONENTS,
        },
        ADMIN_ACTOR
      );

      // Attempt asset attach with empty alt_text
      const res = await attachAssetAdmin(
        adminReq(`http://localhost/api/v1/admin/trials/${trial.id}/assets`, {
          method: "POST",
          body: {
            expected_revision: 1,
            asset: {
              asset_url: "/images/trials/discovery-dry-leaf.jpg",
              stage: "dry_leaf",
              alt_text: "   ", // Blank alt text
            },
          },
        }),
        { params: Promise.resolve({ id: trial.id }) }
      );
      expect(res.status).toBe(400);

      // Assert zero asset records created
      const db = getDb();
      const assets = db.prepare("SELECT * FROM trial_assets WHERE trial_id = ?").all(trial.id);
      expect(assets.length).toBe(0);

      // Assert zero orphan audit rows
      const history = TrialService.getHistory(trial.id);
      expect(history.length).toBe(1);
      expect(history[0].action).toBe("create_draft");

      // Revision remains 1
      const current = TrialService.getById(trial.id)!;
      expect(current.revision).toBe(1);
    });

    it("4.3: CAS revision conflict rolls back cleanly with ZERO orphan audit rows and zero dirty writes", async () => {
      const slug = `tier5-rollback-cas-${Date.now()}`;
      const trial = TrialService.createDraft(
        {
          title: "Rollback CAS Test Kit",
          slug,
          price_paise: 28000,
          components: VALID_4X50G_COMPONENTS,
        },
        ADMIN_ACTOR
      );

      // Attempt PATCH with wrong expected_revision = 99
      const res = await updateAdminTrial(
        adminReq(`http://localhost/api/v1/admin/trials/${trial.id}`, {
          method: "PATCH",
          body: {
            expected_revision: 99,
            title: "Should Never Persist",
          },
        }),
        { params: Promise.resolve({ id: trial.id }) }
      );
      expect(res.status).toBe(409);

      // Verify no changes persisted
      const current = TrialService.getById(trial.id)!;
      expect(current.title).toBe("Rollback CAS Test Kit");
      expect(current.revision).toBe(1);

      // Zero new audit rows
      const history = TrialService.getHistory(trial.id);
      expect(history.length).toBe(1);
    });

    it("4.4: In-transaction catastrophic abort simulation guarantees zero dirty writes and zero orphan audit rows", () => {
      const db = getDb();
      const slug = `tier5-abort-sim-${Date.now()}`;
      const trial = TrialService.createDraft(
        {
          title: "Abrupt Abort Test Kit",
          slug,
          price_paise: 30000,
          components: VALID_4X50G_COMPONENTS,
        },
        ADMIN_ACTOR
      );

      expect(() => {
        db.transaction(() => {
          // Mutate trial revision
          db.prepare("UPDATE trials SET revision = 999 WHERE id = ?").run(trial.id);

          // Mutate existing component to ghost name
          db.prepare("UPDATE trial_components SET name = 'Ghost Component' WHERE trial_id = ? AND slot_index = 0").run(trial.id);

          // Insert orphan audit row
          db.prepare(`
            INSERT INTO trial_audit (id, trial_id, revision, action, actor_type, actor_id)
            VALUES (?, ?, 999, 'ghost_action', 'admin', 'ghost')
          `).run(randomUUID(), trial.id);

          // Force abrupt transaction rollback
          throw new Error("Simulated catastrophic crash");
        })();
      }).toThrow("Simulated catastrophic crash");

      // Verify all changes were rolled back completely
      const current = TrialService.getById(trial.id)!;
      expect(current.revision).toBe(1);

      const ghostAudit = db.prepare("SELECT * FROM trial_audit WHERE action = 'ghost_action'").all();
      expect(ghostAudit.length).toBe(0);

      const ghostComps = db.prepare("SELECT * FROM trial_components WHERE name = 'Ghost Component'").all();
      expect(ghostComps.length).toBe(0);
    });

    it("4.5: PRAGMA integrity check, foreign key check, and relational consistency pass with zero defects", () => {
      const db = getDb();

      // 1. SQLite PRAGMA integrity check
      const integrity = db.pragma("integrity_check") as Array<{ integrity_check: string }>;
      expect(integrity).toEqual([{ integrity_check: "ok" }]);

      // 2. SQLite PRAGMA foreign key check
      const fkCheck = db.pragma("foreign_key_check") as unknown[];
      expect(fkCheck).toEqual([]);

      // 3. Relational orphan checks across all 8 satellite tables
      const orphanAudits = db
        .prepare("SELECT COUNT(*) as count FROM trial_audit WHERE trial_id NOT IN (SELECT id FROM trials)")
        .get() as { count: number };
      expect(orphanAudits.count).toBe(0);

      const orphanComponents = db
        .prepare("SELECT COUNT(*) as count FROM trial_components WHERE trial_id NOT IN (SELECT id FROM trials)")
        .get() as { count: number };
      expect(orphanComponents.count).toBe(0);

      const orphanAssets = db
        .prepare("SELECT COUNT(*) as count FROM trial_assets WHERE trial_id NOT IN (SELECT id FROM trials)")
        .get() as { count: number };
      expect(orphanAssets.count).toBe(0);

      const orphanPubs = db
        .prepare("SELECT COUNT(*) as count FROM trial_publications WHERE trial_id NOT IN (SELECT id FROM trials)")
        .get() as { count: number };
      expect(orphanPubs.count).toBe(0);

      const orphanGuides = db
        .prepare("SELECT COUNT(*) as count FROM trial_brew_guides WHERE trial_id NOT IN (SELECT id FROM trials)")
        .get() as { count: number };
      expect(orphanGuides.count).toBe(0);

      const orphanSensory = db
        .prepare("SELECT COUNT(*) as count FROM trial_sensory_tests WHERE trial_id NOT IN (SELECT id FROM trials)")
        .get() as { count: number };
      expect(orphanSensory.count).toBe(0);

      const orphanClaims = db
        .prepare("SELECT COUNT(*) as count FROM trial_claims WHERE trial_id NOT IN (SELECT id FROM trials)")
        .get() as { count: number };
      expect(orphanClaims.count).toBe(0);

      const orphanBulk = db
        .prepare("SELECT COUNT(*) as count FROM trial_bulk_links WHERE trial_id NOT IN (SELECT id FROM trials)")
        .get() as { count: number };
      expect(orphanBulk.count).toBe(0);
    });
  });
});
