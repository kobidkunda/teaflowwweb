import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { rmSync } from "node:fs";
import {
  dispatchToolCall,
  McpError,
} from "../../src/lib/mcp";
import { TrialService } from "../../src/lib/trials/service";
import {
  TrialRevisionConflictError,
  type AuditActor,
  type Trial,
  type TrialWithDetails,
  type TrialAuditEntry,
} from "../../src/lib/trials/types";
import { getDb } from "../../src/lib/db";

const TEST_DB = path.join(tmpdir(), `trials-m3-adv-${process.pid}-${Date.now()}.sqlite`);
process.env.DATABASE_PATH = TEST_DB;

function call<T = any>(name: string, args: unknown): T {
  return dispatchToolCall(name, args) as T;
}

function failsWith(name: string, args: unknown): McpError {
  try {
    dispatchToolCall(name, args);
  } catch (error) {
    expect(error).toBeInstanceOf(McpError);
    return error as McpError;
  }
  throw new Error(`expected tool "${name}" to fail with McpError`);
}

const VALID_4X50G_COMPONENTS = [
  {
    slot_index: 0,
    name: "Gopaldhara Red Thunder",
    estate: "Gopaldhara Estate",
    grade: "FTGFOP1",
    flush: "Autumn Flush 2026",
    elevation: "1800m",
    weight_g: 50,
    quantity: 1,
    tasting_notes: ["Muscatel", "Ripe Apricot", "Honey"],
    brew_temp_c: 90,
    brew_time_sec: 210,
    leaf_dose_g: 2.5,
  },
  {
    slot_index: 1,
    name: "Makaibari Silver Tips",
    estate: "Makaibari Estate",
    grade: "Silver Needles",
    flush: "Spring Clonal",
    elevation: "1500m",
    weight_g: 50,
    quantity: 1,
    tasting_notes: ["Wild Jasmine", "Dew Hay", "Raw Pine"],
    brew_temp_c: 80,
    brew_time_sec: 240,
    leaf_dose_g: 3.0,
  },
  {
    slot_index: 2,
    name: "Castleton Muscatel Reserve",
    estate: "Castleton Estate",
    grade: "FTGFOP1 Special",
    flush: "Second Flush 2026",
    elevation: "1600m",
    weight_g: 50,
    quantity: 1,
    tasting_notes: ["Muscat Grape", "Wood Smoke", "Dark Cherry"],
    brew_temp_c: 95,
    brew_time_sec: 180,
    leaf_dose_g: 2.5,
  },
  {
    slot_index: 3,
    name: "Rohini Moonlight Oolong",
    estate: "Rohini Estate",
    grade: "Special Clonal",
    flush: "Summer Flush 2026",
    elevation: "1400m",
    weight_g: 50,
    quantity: 1,
    tasting_notes: ["Peachy Cream", "Gardenia", "Brioche"],
    brew_temp_c: 85,
    brew_time_sec: 210,
    leaf_dose_g: 2.5,
  },
];

const ADMIN_ACTOR: AuditActor = {
  actor_type: "admin",
  actor_id: "admin-tester",
  actor_email: "admin@teafloww.com",
  reason: "Adversarial test harness action",
};

describe("Milestone 3 — Adversarial Stress Harness (MCP Tool Parity & Concurrency)", () => {
  beforeAll(() => {
    execFileSync(process.execPath, ["scripts/migrate.mjs"], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_PATH: TEST_DB },
      stdio: "ignore",
    });
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

  beforeEach(() => {
    const db = getDb();
    db.prepare("DELETE FROM trials WHERE slug LIKE 'adv-mcp-%'").run();
  });

  // ===========================================================================
  // Task 1: Concurrent CAS Race via MCP
  // ===========================================================================
  describe("Task 1: Concurrent CAS Race via MCP", () => {
    it("1.1: fires 10 parallel trial_update calls competing on revision 1: exactly ONE succeeds, 9 fail with -32009, 0 deadlocks", async () => {
      const slug = `adv-mcp-race-1-${Date.now()}`;
      const created = call<Trial>("trial_create", {
        title: "Race Target Kit",
        slug,
        price_paise: 25000,
        components: VALID_4X50G_COMPONENTS,
      });

      expect(created.id).toBeDefined();
      expect(created.revision).toBe(1);

      // Launch 10 simultaneous parallel update requests with expected_revision: 1
      const PARALLEL_COUNT = 10;
      const racePromises = Array.from({ length: PARALLEL_COUNT }, (_, idx) => {
        return Promise.resolve().then(() => {
          return dispatchToolCall("trial_update", {
            id: created.id,
            expected_revision: 1,
            title: `Winning Race Title Candidate #${idx + 1}`,
            price_paise: 26000 + idx * 100,
          }) as Trial;
        });
      });

      const settled = await Promise.allSettled(racePromises);

      // Assertions on the settled promises
      const fulfilled = settled.filter((r): r is PromiseFulfilledResult<Trial> => r.status === "fulfilled");
      const rejected = settled.filter((r): r is PromiseRejectedResult => r.status === "rejected");

      // Exactly ONE succeeds
      expect(fulfilled).toHaveLength(1);
      expect(fulfilled[0].value.revision).toBe(2);
      expect(fulfilled[0].value.title).toMatch(/^Winning Race Title Candidate #\d+$/);

      // Exactly N-1 fail with McpError(-32009)
      expect(rejected).toHaveLength(PARALLEL_COUNT - 1);
      for (const rej of rejected) {
        expect(rej.reason).toBeInstanceOf(McpError);
        const err = rej.reason as McpError;
        expect(err.code).toBe(-32009);
        expect(err.message).toMatch(/conflict|revision mismatch/i);
      }

      // Assert database integrity: 0 deadlocks, clean state
      const db = getDb();
      const current = db.prepare("SELECT revision, title, price_paise FROM trials WHERE id = ?").get(created.id) as {
        revision: number;
        title: string;
        price_paise: number;
      };

      expect(current.revision).toBe(2);
      expect(current.title).toBe(fulfilled[0].value.title);
      expect(current.price_paise).toBe(fulfilled[0].value.price_paise);

      // Audit table must have exactly 2 entries (create_draft rev 1, update rev 2)
      const audits = db.prepare("SELECT revision, action, actor_type FROM trial_audit WHERE trial_id = ? ORDER BY revision ASC").all(created.id) as Array<{
        revision: number;
        action: string;
        actor_type: string;
      }>;

      expect(audits).toHaveLength(2);
      expect(audits[0]).toEqual({ revision: 1, action: "create_draft", actor_type: "mcp" });
      expect(audits[1]).toEqual({ revision: 2, action: "update", actor_type: "mcp" });
    });

    it("1.2: fires 10 parallel calls on revision 2 (second wave): exactly ONE succeeds to rev 3, 9 fail with -32009", async () => {
      const slug = `adv-mcp-race-2-${Date.now()}`;
      const created = call<Trial>("trial_create", {
        title: "Wave Race Kit",
        slug,
        price_paise: 25000,
        components: VALID_4X50G_COMPONENTS,
      });

      // Advance to rev 2
      const rev2 = call<Trial>("trial_update", {
        id: created.id,
        expected_revision: 1,
        title: "Wave Revision 2",
      });
      expect(rev2.revision).toBe(2);

      // Second wave: 10 parallel promises with expected_revision: 2
      const settledWave2 = await Promise.allSettled(
        Array.from({ length: 10 }, (_, idx) => {
          return Promise.resolve().then(() => {
            return dispatchToolCall("trial_update", {
              id: created.id,
              expected_revision: 2,
              title: `Wave 2 Winner #${idx}`,
            }) as Trial;
          });
        })
      );

      const fulfilledWave2 = settledWave2.filter((r): r is PromiseFulfilledResult<Trial> => r.status === "fulfilled");
      const rejectedWave2 = settledWave2.filter((r): r is PromiseRejectedResult => r.status === "rejected");

      expect(fulfilledWave2).toHaveLength(1);
      expect(fulfilledWave2[0].value.revision).toBe(3);
      expect(rejectedWave2).toHaveLength(9);
      for (const rej of rejectedWave2) {
        expect(rej.reason).toBeInstanceOf(McpError);
        expect((rej.reason as McpError).code).toBe(-32009);
      }

      // Third wave with completely stale revision: 10 calls on expected_revision: 1
      const settledStale = await Promise.allSettled(
        Array.from({ length: 10 }, () => {
          return Promise.resolve().then(() => {
            return dispatchToolCall("trial_update", {
              id: created.id,
              expected_revision: 1,
              title: "Stale Zombie Update",
            }) as Trial;
          });
        })
      );

      // ALL 10 MUST FAIL with -32009
      expect(settledStale.filter((r) => r.status === "fulfilled")).toHaveLength(0);
      expect(settledStale.filter((r) => r.status === "rejected")).toHaveLength(10);
      for (const rej of settledStale) {
        if (rej.status === "rejected") {
          expect(rej.reason).toBeInstanceOf(McpError);
          expect((rej.reason as McpError).code).toBe(-32009);
        }
      }

      // Verify trial revision is still 3
      const fetched = call<TrialWithDetails>("trial_get", { id: created.id });
      expect(fetched.revision).toBe(3);
    });

    it("1.3: concurrent CAS race on trial_components_replace: exactly 1 succeeds, 9 fail with -32009", async () => {
      const slug = `adv-mcp-comp-race-${Date.now()}`;
      const created = call<Trial>("trial_create", {
        title: "Comp Race Kit",
        slug,
        price_paise: 25000,
        components: VALID_4X50G_COMPONENTS,
      });

      const racePromises = Array.from({ length: 10 }, (_, idx) => {
        const replacement = VALID_4X50G_COMPONENTS.map((c, i) => ({
          ...c,
          name: i === 0 ? `Custom Winner Comp #${idx}` : c.name,
        }));
        return Promise.resolve().then(() => {
          return dispatchToolCall("trial_components_replace", {
            id: created.id,
            expected_revision: 1,
            components: replacement,
          }) as Trial;
        });
      });

      const settled = await Promise.allSettled(racePromises);
      const fulfilled = settled.filter((r): r is PromiseFulfilledResult<Trial> => r.status === "fulfilled");
      const rejected = settled.filter((r): r is PromiseRejectedResult => r.status === "rejected");

      expect(fulfilled).toHaveLength(1);
      expect(fulfilled[0].value.revision).toBe(2);
      expect(rejected).toHaveLength(9);
      for (const rej of rejected) {
        expect(rej.reason).toBeInstanceOf(McpError);
        expect((rej.reason as McpError).code).toBe(-32009);
      }
    });
  });

  // ===========================================================================
  // Task 2: Cross-Channel Conflict Collision
  // ===========================================================================
  describe("Task 2: Cross-Channel Conflict Collision", () => {
    it("2.1: MCP create -> Admin service update -> Stale MCP update fails with -32009 -> MCP re-read and update succeeds to rev 3", () => {
      const slug = `adv-mcp-cross-1-${Date.now()}`;

      // Step 1: Create trial via MCP trial_create (starts at revision 1)
      const mcpTrial = call<Trial>("trial_create", {
        title: "Cross Channel Test Trial",
        slug,
        price_paise: 29900,
        components: VALID_4X50G_COMPONENTS,
      });
      expect(mcpTrial.revision).toBe(1);

      // Step 2: Mutate trial via Admin service (TrialService.update) -> increments to revision 2
      const adminUpdated = TrialService.update(
        mcpTrial.id,
        1,
        {
          title: "Mutated by Admin Studio",
          price_paise: 31000,
        },
        ADMIN_ACTOR
      );
      expect(adminUpdated.revision).toBe(2);
      expect(adminUpdated.title).toBe("Mutated by Admin Studio");

      // Step 3: Stale MCP client attempts trial_update with expected_revision: 1 -> MUST FAIL with -32009
      const staleError = failsWith("trial_update", {
        id: mcpTrial.id,
        expected_revision: 1,
        title: "Stale MCP Overwrite Attempt",
      });
      expect(staleError.code).toBe(-32009);
      expect(staleError.message).toMatch(/conflict|revision mismatch/i);

      // Step 4: MCP client queries trial_get, sees revision 2 and current data
      const fetched = call<TrialWithDetails>("trial_get", { id: mcpTrial.id });
      expect(fetched.revision).toBe(2);
      expect(fetched.title).toBe("Mutated by Admin Studio");
      expect(fetched.price_paise).toBe(31000);

      // Step 5: MCP client updates with expected_revision: 2 -> succeeds, revision increments to 3
      const mcpUpdated = call<Trial>("trial_update", {
        id: mcpTrial.id,
        expected_revision: 2,
        title: "Reconciled MCP Title Update",
        price_paise: 32000,
      });
      expect(mcpUpdated.revision).toBe(3);
      expect(mcpUpdated.title).toBe("Reconciled MCP Title Update");
      expect(mcpUpdated.price_paise).toBe(32000);

      // Step 6: Stale Admin update attempt with expected_revision: 2 -> throws TrialRevisionConflictError
      expect(() => {
        TrialService.update(
          mcpTrial.id,
          2,
          { title: "Late Admin Attempt" },
          ADMIN_ACTOR
        );
      }).toThrowError(TrialRevisionConflictError);

      // Verify audit history reflects interleaved actors with complete non-repudiation (ORDER BY revision DESC)
      const history = call<{ history: TrialAuditEntry[] }>("trial_history", { id: mcpTrial.id }).history;
      expect(history).toHaveLength(3);

      // history[0] is latest (revision 3, mcp update)
      expect(history[0].revision).toBe(3);
      expect(history[0].action).toBe("update");
      expect(history[0].actor_type).toBe("mcp");

      // history[1] is middle (revision 2, admin update)
      expect(history[1].revision).toBe(2);
      expect(history[1].action).toBe("update");
      expect(history[1].actor_type).toBe("admin");
      expect(history[1].actor_id).toBe("admin-tester");

      // history[2] is initial (revision 1, mcp create_draft)
      expect(history[2].revision).toBe(1);
      expect(history[2].action).toBe("create_draft");
      expect(history[2].actor_type).toBe("mcp");
    });

    it("2.2: Cross-channel lifecycle transition race: Admin submits review -> Stale MCP submit review rejected with -32009", () => {
      const slug = `adv-mcp-cross-lifecycle-${Date.now()}`;
      const trial = call<Trial>("trial_create", {
        title: "Lifecycle Collision Trial",
        slug,
        price_paise: 29900,
        components: VALID_4X50G_COMPONENTS,
      });
      expect(trial.revision).toBe(1);
      expect(trial.status).toBe("draft");

      // Admin submits for review
      const adminReviewed = TrialService.submitReview(trial.id, 1, ADMIN_ACTOR);
      expect(adminReviewed.revision).toBe(2);
      expect(adminReviewed.status).toBe("in_review");

      // Stale MCP attempt to submit for review with expected_revision: 1
      const staleReviewErr = failsWith("trial_submit_review", {
        id: trial.id,
        expected_revision: 1,
      });
      expect(staleReviewErr.code).toBe(-32009);

      // Even if MCP tries with expected_revision: 2, trial is already in_review -> fails with -32009
      const alreadyInReviewErr = failsWith("trial_submit_review", {
        id: trial.id,
        expected_revision: 2,
      });
      expect(alreadyInReviewErr.code).toBe(-32009);
      expect(alreadyInReviewErr.message).toMatch(/draft|state transition/i);
    });
  });

  // ===========================================================================
  // Task 3: Component Invariant Stress
  // ===========================================================================
  describe("Task 3: Component Invariant Stress", () => {
    it("3.1: attempts trialComponentsReplace with 3 components, 5 components, negative weight, non-50g weights, 199g, 201g -> all rejected with -32602, components untouched", () => {
      const slug = `adv-mcp-invariant-${Date.now()}`;
      const created = call<Trial>("trial_create", {
        title: "Invariant Stress Trial",
        slug,
        price_paise: 25000,
        components: VALID_4X50G_COMPONENTS,
      });
      expect(created.revision).toBe(1);

      // Snapshot original components in DB
      const db = getDb();
      const originalComponents = db
        .prepare("SELECT slot_index, name, weight_g, quantity FROM trial_components WHERE trial_id = ? ORDER BY slot_index ASC")
        .all(created.id);
      expect(originalComponents).toHaveLength(4);

      // Adversarial Case A: Exactly 3 components (too few)
      const threeComponents = VALID_4X50G_COMPONENTS.slice(0, 3);
      const err3 = failsWith("trial_components_replace", {
        id: created.id,
        expected_revision: 1,
        components: threeComponents,
      });
      expect(err3.code).toBe(-32602);

      // Adversarial Case B: Exactly 5 components (too many)
      const fiveComponents = [
        ...VALID_4X50G_COMPONENTS,
        {
          slot_index: 4,
          name: "Extra Fifth Sachet",
          estate: "Extra Estate",
          grade: "BOP",
          flush: "Rain Flush",
          weight_g: 50,
          quantity: 1,
          tasting_notes: [],
          brew_temp_c: 90,
          brew_time_sec: 180,
          leaf_dose_g: 2.5,
        },
      ];
      const err5 = failsWith("trial_components_replace", {
        id: created.id,
        expected_revision: 1,
        components: fiveComponents,
      });
      expect(err5.code).toBe(-32602);

      // Adversarial Case C: Total weight 199g (50g, 50g, 50g, 49g)
      const weight199Components = [
        VALID_4X50G_COMPONENTS[0],
        VALID_4X50G_COMPONENTS[1],
        VALID_4X50G_COMPONENTS[2],
        { ...VALID_4X50G_COMPONENTS[3], weight_g: 49 },
      ];
      const err199 = failsWith("trial_components_replace", {
        id: created.id,
        expected_revision: 1,
        components: weight199Components,
      });
      expect(err199.code).toBe(-32602);

      // Adversarial Case D: Total weight 201g (50g, 50g, 50g, 51g)
      const weight201Components = [
        VALID_4X50G_COMPONENTS[0],
        VALID_4X50G_COMPONENTS[1],
        VALID_4X50G_COMPONENTS[2],
        { ...VALID_4X50G_COMPONENTS[3], weight_g: 51 },
      ];
      const err201 = failsWith("trial_components_replace", {
        id: created.id,
        expected_revision: 1,
        components: weight201Components,
      });
      expect(err201.code).toBe(-32602);

      // Adversarial Case E: Negative weight (-50g)
      const negativeWeightComponents = [
        VALID_4X50G_COMPONENTS[0],
        VALID_4X50G_COMPONENTS[1],
        VALID_4X50G_COMPONENTS[2],
        { ...VALID_4X50G_COMPONENTS[3], weight_g: -50 },
      ];
      const errNegative = failsWith("trial_components_replace", {
        id: created.id,
        expected_revision: 1,
        components: negativeWeightComponents,
      });
      expect(errNegative.code).toBe(-32602);

      // Adversarial Case F: Non-50g weights totaling 200g (25g + 75g + 50g + 50g = 200g)
      const non50gSum200Components = [
        { ...VALID_4X50G_COMPONENTS[0], weight_g: 25 },
        { ...VALID_4X50G_COMPONENTS[1], weight_g: 75 },
        VALID_4X50G_COMPONENTS[2],
        VALID_4X50G_COMPONENTS[3],
      ];
      const errNon50 = failsWith("trial_components_replace", {
        id: created.id,
        expected_revision: 1,
        components: non50gSum200Components,
      });
      expect(errNon50.code).toBe(-32602);
      expect(errNon50.message).toMatch(/50g/);

      // Adversarial Case G: Duplicate slot index (slots 0, 0, 1, 2)
      const duplicateSlots = [
        { ...VALID_4X50G_COMPONENTS[0], slot_index: 0 },
        { ...VALID_4X50G_COMPONENTS[1], slot_index: 0 },
        { ...VALID_4X50G_COMPONENTS[2], slot_index: 1 },
        { ...VALID_4X50G_COMPONENTS[3], slot_index: 2 },
      ];
      const errDupSlots = failsWith("trial_components_replace", {
        id: created.id,
        expected_revision: 1,
        components: duplicateSlots,
      });
      expect(errDupSlots.code).toBe(-32602);

      // Adversarial Case H: Empty / short component name (< 2 chars)
      const emptyNameComponents = [
        { ...VALID_4X50G_COMPONENTS[0], name: "" },
        VALID_4X50G_COMPONENTS[1],
        VALID_4X50G_COMPONENTS[2],
        VALID_4X50G_COMPONENTS[3],
      ];
      const errEmptyName = failsWith("trial_components_replace", {
        id: created.id,
        expected_revision: 1,
        components: emptyNameComponents,
      });
      expect(errEmptyName.code).toBe(-32602);

      // CRITICAL ASSERTION: All components in database remain completely untouched
      const afterStressComponents = db
        .prepare("SELECT slot_index, name, weight_g, quantity FROM trial_components WHERE trial_id = ? ORDER BY slot_index ASC")
        .all(created.id);
      expect(afterStressComponents).toEqual(originalComponents);

      // Revision is still 1
      const afterTrial = db.prepare("SELECT revision FROM trials WHERE id = ?").get(created.id) as { revision: number };
      expect(afterTrial.revision).toBe(1);
    });
  });

  // ===========================================================================
  // Task 4: Lifecycle State Transition Constraints & Publication Blockers
  // ===========================================================================
  describe("Task 4: Lifecycle State Transition Constraints", () => {
    it("4.1: rejects invalid transition trial_unpublish on draft with -32009", () => {
      const slug = `adv-mcp-unpub-draft-${Date.now()}`;
      const trial = call<Trial>("trial_create", {
        title: "Unpublish Draft Trial",
        slug,
        price_paise: 25000,
        components: VALID_4X50G_COMPONENTS,
      });

      const err = failsWith("trial_unpublish", {
        id: trial.id,
        expected_revision: 1,
      });
      expect(err.code).toBe(-32009);
      expect(err.message).toMatch(/cannot unpublish|Must be 'published'/i);
    });

    it("4.2: blocks trial_publish on incomplete draft due to publication gate blockers with -32009", () => {
      const slug = `adv-mcp-blocker-pub-${Date.now()}`;
      const trial = call<Trial>("trial_create", {
        title: "Incomplete Trial",
        slug,
        price_paise: 25000,
        components: VALID_4X50G_COMPONENTS,
      });

      // Draft without hero image, meta tags, or inventory tracking stock -> gate blockers exist
      const validation = call<{ can_publish: boolean; blockers: string[] }>("trial_validate", { id: trial.id });
      expect(validation.can_publish).toBe(false);
      expect(validation.blockers.length).toBeGreaterThan(0);

      // Attempt publish -> must be rejected with -32009
      const err = failsWith("trial_publish", {
        id: trial.id,
        expected_revision: 1,
      });
      expect(err.code).toBe(-32009);
      expect(err.message).toMatch(/cannot publish|blocker/i);
    });

    it("4.3: transitions through full lifecycle to archived, then asserts ALL mutating tools on archived fail with -32009", () => {
      const slug = `adv-mcp-archived-terminal-${Date.now()}`;
      const trial = call<Trial>("trial_create", {
        title: "Archived Terminal Trial",
        slug,
        price_paise: 25000,
        components: VALID_4X50G_COMPONENTS,
      });

      // Archive directly from draft (allowed transition draft -> archived)
      const archived = call<Trial>("trial_archive", {
        id: trial.id,
        expected_revision: 1,
      });
      expect(archived.status).toBe("archived");
      expect(archived.revision).toBe(2);

      // 1. trial_publish on archived -> MUST FAIL with -32009
      const pubErr = failsWith("trial_publish", {
        id: trial.id,
        expected_revision: 2,
      });
      expect(pubErr.code).toBe(-32009);

      // 2. trial_unpublish on archived -> MUST FAIL with -32009
      const unpubErr = failsWith("trial_unpublish", {
        id: trial.id,
        expected_revision: 2,
      });
      expect(unpubErr.code).toBe(-32009);

      // 3. trial_submit_review on archived -> MUST FAIL with -32009
      const subReviewErr = failsWith("trial_submit_review", {
        id: trial.id,
        expected_revision: 2,
      });
      expect(subReviewErr.code).toBe(-32009);

      // 4. trial_archive on already-archived -> MUST FAIL with -32009
      const archErr = failsWith("trial_archive", {
        id: trial.id,
        expected_revision: 2,
      });
      expect(archErr.code).toBe(-32009);
      expect(archErr.message).toMatch(/already archived/i);

      // 5. trial_update on archived -> MUST FAIL with -32009
      const updateErr = failsWith("trial_update", {
        id: trial.id,
        expected_revision: 2,
        title: "Attempted Edit on Archived",
      });
      expect(updateErr.code).toBe(-32009);
      expect(updateErr.message).toMatch(/archived/i);

      // 6. trial_components_replace on archived -> MUST FAIL with -32009
      const compErr = failsWith("trial_components_replace", {
        id: trial.id,
        expected_revision: 2,
        components: VALID_4X50G_COMPONENTS,
      });
      expect(compErr.code).toBe(-32009);
      expect(compErr.message).toMatch(/archived/i);

      // 7. trial_media_attach on archived -> MUST FAIL with -32009
      const mediaErr = failsWith("trial_media_attach", {
        id: trial.id,
        expected_revision: 2,
        stage: "packaging",
        asset_url: "/uploads/trials/test.jpg",
        alt_text: "Packaging photo",
      });
      expect(mediaErr.code).toBe(-32009);
      expect(mediaErr.message).toMatch(/archived/i);
    });

    it("4.4: missing or malformed expected_revision fails with -32602 on all state transition tools", () => {
      const slug = `adv-mcp-schema-err-${Date.now()}`;
      const trial = call<Trial>("trial_create", {
        title: "Schema Malform Trial",
        slug,
        price_paise: 25000,
        components: VALID_4X50G_COMPONENTS,
      });

      // Missing expected_revision
      expect(failsWith("trial_submit_review", { id: trial.id }).code).toBe(-32602);
      expect(failsWith("trial_publish", { id: trial.id }).code).toBe(-32602);
      expect(failsWith("trial_unpublish", { id: trial.id }).code).toBe(-32602);
      expect(failsWith("trial_archive", { id: trial.id }).code).toBe(-32602);
      expect(failsWith("trial_update", { id: trial.id }).code).toBe(-32602);
      expect(failsWith("trial_components_replace", { id: trial.id, components: VALID_4X50G_COMPONENTS }).code).toBe(-32602);

      // Non-integer expected_revision
      expect(failsWith("trial_submit_review", { id: trial.id, expected_revision: "one" }).code).toBe(-32602);
      expect(failsWith("trial_publish", { id: trial.id, expected_revision: 1.5 }).code).toBe(-32602);
    });

    it("4.5: non-existent trial UUID returns -32004 for all management tools", () => {
      const ghostId = "00000000-0000-0000-0000-000000000000";
      expect(failsWith("trial_get", { id: ghostId }).code).toBe(-32004);
      expect(failsWith("trial_update", { id: ghostId, expected_revision: 1, title: "Ghost" }).code).toBe(-32004);
      expect(failsWith("trial_components_replace", { id: ghostId, expected_revision: 1, components: VALID_4X50G_COMPONENTS }).code).toBe(-32004);
      expect(failsWith("trial_media_attach", { id: ghostId, expected_revision: 1, stage: "packaging", asset_url: "/test.jpg", alt_text: "Alt" }).code).toBe(-32004);
      expect(failsWith("trial_submit_review", { id: ghostId, expected_revision: 1 }).code).toBe(-32004);
      expect(failsWith("trial_publish", { id: ghostId, expected_revision: 1 }).code).toBe(-32004);
      expect(failsWith("trial_unpublish", { id: ghostId, expected_revision: 1 }).code).toBe(-32004);
      expect(failsWith("trial_archive", { id: ghostId, expected_revision: 1 }).code).toBe(-32004);
      expect(failsWith("trial_validate", { id: ghostId }).code).toBe(-32004);
    });
  });

  // ===========================================================================
  // Task 5: Advanced Parity & Invariant Boundaries
  // ===========================================================================
  describe("Task 5: Advanced Parity & Invariant Boundaries", () => {
    it("5.1: concurrent CAS race using dot-notation alias trial.update preserves exact concurrency semantics", async () => {
      const slug = `adv-mcp-dot-race-${Date.now()}`;
      const created = call<Trial>("trial.create", {
        title: "Dot Notation Race Kit",
        slug,
        price_paise: 25000,
        components: VALID_4X50G_COMPONENTS,
      });

      const promises = Array.from({ length: 10 }, (_, i) => {
        return Promise.resolve().then(() => {
          return dispatchToolCall("trial.update", {
            id: created.id,
            expected_revision: 1,
            title: `Dot Race Winner #${i}`,
          }) as Trial;
        });
      });

      const settled = await Promise.allSettled(promises);
      const fulfilled = settled.filter((r): r is PromiseFulfilledResult<Trial> => r.status === "fulfilled");
      const rejected = settled.filter((r): r is PromiseRejectedResult => r.status === "rejected");

      expect(fulfilled).toHaveLength(1);
      expect(fulfilled[0].value.revision).toBe(2);
      expect(rejected).toHaveLength(9);
      for (const rej of rejected) {
        expect(rej.reason).toBeInstanceOf(McpError);
        expect((rej.reason as McpError).code).toBe(-32009);
      }
    });

    it("5.2: cross-channel component replacement race between MCP and Admin", () => {
      const slug = `adv-mcp-comp-cross-${Date.now()}`;
      const trial = call<Trial>("trial_create", {
        title: "Comp Cross Channel Trial",
        slug,
        price_paise: 25000,
        components: VALID_4X50G_COMPONENTS,
      });

      // Admin mutates components first (increments to rev 2)
      const adminReplaced = TrialService.replaceComponents(
        trial.id,
        1,
        VALID_4X50G_COMPONENTS.map((c, i) => ({ ...c, name: `Admin Pouch #${i}` })),
        ADMIN_ACTOR
      );
      expect(adminReplaced.revision).toBe(2);

      // Stale MCP component replace attempt with expected_revision: 1 -> must fail with -32009
      const staleMcpErr = failsWith("trial_components_replace", {
        id: trial.id,
        expected_revision: 1,
        components: VALID_4X50G_COMPONENTS,
      });
      expect(staleMcpErr.code).toBe(-32009);

      // Admin components remain intact
      const fetched = call<TrialWithDetails>("trial_get", { id: trial.id });
      expect(fetched.revision).toBe(2);
      expect(fetched.components[0].name).toBe("Admin Pouch #0");
    });

    it("5.3: media attachment enforces mandatory alt text (>=2 chars), slot_index (0..3), and url requirement", () => {
      const slug = `adv-mcp-media-stress-${Date.now()}`;
      const trial = call<Trial>("trial_create", {
        title: "Media Stress Trial",
        slug,
        price_paise: 25000,
        components: VALID_4X50G_COMPONENTS,
      });

      // Missing alt text
      expect(failsWith("trial_media_attach", {
        id: trial.id,
        expected_revision: 1,
        stage: "packaging",
        asset_url: "/test.jpg",
      }).code).toBe(-32602);

      // Single-character alt text (< 2 chars)
      expect(failsWith("trial_media_attach", {
        id: trial.id,
        expected_revision: 1,
        stage: "packaging",
        asset_url: "/test.jpg",
        alt_text: "A",
      }).code).toBe(-32602);

      // Missing url / asset_url
      expect(failsWith("trial_media_attach", {
        id: trial.id,
        expected_revision: 1,
        stage: "packaging",
        alt_text: "Valid alt text",
      }).code).toBe(-32602);

      // Slot index out of bounds (> 3)
      expect(failsWith("trial_media_attach", {
        id: trial.id,
        expected_revision: 1,
        stage: "packaging",
        asset_url: "/test.jpg",
        alt_text: "Valid alt text",
        slot_index: 4,
      }).code).toBe(-32602);

      // Negative slot index
      expect(failsWith("trial_media_attach", {
        id: trial.id,
        expected_revision: 1,
        stage: "packaging",
        asset_url: "/test.jpg",
        alt_text: "Valid alt text",
        slot_index: -1,
      }).code).toBe(-32602);
    });
  });
});
