/**
 * TeaFloww Trials v3 — Milestone 6 Final: Tier 5 Adversarial Hardening Test Suite
 *
 * Comprehensive empirical challenger test harness stress-testing:
 * - Part 1: Extreme Inputs, Fuzzing & Malformed Payloads (10 tests)
 * - Part 2: High-Concurrency, CAS Races & Multi-Channel Collision (8 tests)
 * - Part 3: SQL Injection, Special Characters & Boundary Conditions (8 tests)
 * - Part 4: Corrupted State Recovery & Database Invariant Enforcement (8 tests)
 * - Part 5: Storefront Security, Arithmetic & Boundary Logic (8 tests)
 * Total: 42 Adversarial Stress Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { createAdminSession } from "@/lib/adminSessions";
import { resetRateLimits } from "@/lib/rateLimit";
import { TrialService } from "@/lib/trials/service";
import { dispatchToolCall, McpError } from "@/lib/mcp";
import {
  TrialRevisionConflictError,
  TrialInvalidStateTransitionError,
  type AuditActor,
  type ComponentInput,
} from "@/lib/trials/types";
import {
  calculateCostPerCup,
  formatCostPerCup,
  calculateSavingsDelta,
  calculateKitCupYield,
  clampDoseGrams,
  clampBrewingDuration,
  formatProvenance,
  getNextTab,
} from "@/lib/trials/storefront-helpers";

// Route handlers
import { GET as getPublicTrialBySlug } from "@/app/api/v1/trials/[slug]/route";
import { POST as getShippingQuote } from "@/app/api/v1/trials/[slug]/shipping-quote/route";
import { POST as createAdminTrial } from "@/app/api/v1/admin/trials/route";
import {
  PATCH as updateAdminTrial,
  DELETE as deleteAdminTrial,
} from "@/app/api/v1/admin/trials/[id]/route";
import { PUT as replaceComponents } from "@/app/api/v1/admin/trials/[id]/components/route";
import { POST as attachAsset } from "@/app/api/v1/admin/trials/[id]/assets/route";
import { POST as publishTrial } from "@/app/api/v1/admin/trials/[id]/publish/route";

const adminActor: AuditActor = {
  actor_type: "admin",
  actor_id: "challenger_admin",
  actor_email: "challenger@teafloww.com",
  ip_address: "127.0.0.1",
  reason: "Milestone 6 Tier 5 Adversarial Harness",
};

describe("TeaFloww Trials v3 — Milestone 6 Tier 5 Adversarial Hardening Suite", () => {
  let adminCookie: string;
  const db = getDb();
  let ipCounter = 1;

  beforeEach(() => {
    resetRateLimits();
    vi.stubEnv("COMMERCE_MOCK_PROVIDERS", "1");
    vi.stubEnv("SESSION_SECRET", "tier5_adversarial_hardening_secret_key_32_bytes_len");

    // Ensure root admin exists
    db.prepare(`
      INSERT OR IGNORE INTO admin_users (id, username, password_hash, role)
      VALUES (1, 'admin', 'hash', 'root')
    `).run();

    const session = createAdminSession(1);
    adminCookie = `admin_session=${session.cookieValue}`;

    // Clean up test records
    db.prepare("DELETE FROM trials WHERE slug LIKE 'tier5-%'").run();
    db.prepare("DELETE FROM admin_idempotency WHERE key LIKE 'tier5-%'").run();
  });

  function adminReq(
    url: string,
    init?: { method?: string; body?: string; headers?: Record<string, string> }
  ): NextRequest {
    return new NextRequest(url, {
      method: init?.method || (init?.body !== undefined ? "POST" : "GET"),
      body: init?.body,
      headers: {
        Cookie: adminCookie,
        "x-admin-test-token": "trials-test-admin-secret-token",
        "Content-Type": "application/json",
        "x-forwarded-for": `10.99.1.${(ipCounter++ % 250) + 1}`,
        ...(init?.headers || {}),
      },
    });
  }

  function publicReq(
    url: string,
    init?: { method?: string; body?: string; headers?: Record<string, string> }
  ): NextRequest {
    return new NextRequest(url, {
      method: init?.method || (init?.body !== undefined ? "POST" : "GET"),
      body: init?.body,
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": `192.168.1.${(ipCounter++ % 250) + 1}`,
        ...(init?.headers || {}),
      },
    });
  }

  function p(id: string) {
    return { params: Promise.resolve({ id }) };
  }

  function slugP(slug: string) {
    return { params: Promise.resolve({ slug }) };
  }

  function createValidComponents(): ComponentInput[] {
    return [
      {
        slot_index: 0,
        name: "Darjeeling First Flush",
        estate: "Castleton Estate",
        grade: "FTGFOP1",
        flush: "First Flush",
        elevation: "1500m",
        weight_g: 50,
        quantity: 1,
        tasting_notes: ["Floral", "Muscatel"],
        brew_temp_c: 90,
        brew_time_sec: 180,
        leaf_dose_g: 2.5,
      },
      {
        slot_index: 1,
        name: "Assam Golden Tips",
        estate: "Halmari Estate",
        grade: "TGFOP",
        flush: "Second Flush",
        elevation: "100m",
        weight_g: 50,
        quantity: 1,
        tasting_notes: ["Malty", "Honey"],
        brew_temp_c: 95,
        brew_time_sec: 240,
        leaf_dose_g: 2.5,
      },
      {
        slot_index: 2,
        name: "Nilgiri Frost Tea",
        estate: "Glendale Estate",
        grade: "BOP",
        flush: "Winter Flush",
        elevation: "1800m",
        weight_g: 50,
        quantity: 1,
        tasting_notes: ["Crisp", "Lemon"],
        brew_temp_c: 92,
        brew_time_sec: 210,
        leaf_dose_g: 2.5,
      },
      {
        slot_index: 3,
        name: "Kangra Mountain Brew",
        estate: "Dharmsala Tea Garden",
        grade: "Orange Pekoe",
        flush: "Spring Flush",
        elevation: "1400m",
        weight_g: 50,
        quantity: 1,
        tasting_notes: ["Nutty", "Woody"],
        brew_temp_c: 94,
        brew_time_sec: 200,
        leaf_dose_g: 2.5,
      },
    ];
  }

  function makePublishReadyTrial(slug: string) {
    const trial = TrialService.createDraft(
      {
        slug,
        title: "Tier 5 Publish Ready Flight",
        tagline: "Rigorous adversarial qualification kit",
        description: "Tested under extreme conditions.",
        price_paise: 29900,
        compare_at_price_paise: 39900,
        inventory_quantity: 50,
        inventory_policy: "track",
        components: createValidComponents(),
      },
      adminActor
    );

    // Attach required packaging photo
    TrialService.attachAsset(
      trial.id,
      1,
      {
        stage: "packaging",
        asset_url: "/images/trials/discovery-packaging.jpg",
        alt_text: "Packaging box of Tier 5 Flight",
      },
      adminActor
    );

    // Add verified regulatory claim
    db.prepare(`
      INSERT INTO trial_claims (
        id, trial_id, claim_type, label, claim_text, verified, evidence_ref
      ) VALUES (?, ?, 'origin', '100% Single Origin', 'Harvested directly from certified estates', 1, 'CERT-T5-8899')
    `).run(randomUUID(), trial.id);

    return TrialService.getById(trial.id)!;
  }

  // ==========================================================================
  // PART 1: Extreme Inputs, Fuzzing & Malformed Payloads
  // ==========================================================================
  describe("Part 1: Extreme Inputs, Fuzzing & Malformed Payloads", () => {
    it("T5.1.1: giant 100KB payload in title/description is cleanly rejected with HTTP 400 without crashing", async () => {
      const hugeString = "A".repeat(100 * 1024); // 100KB
      const req = adminReq("http://127.0.0.1:3000/api/v1/admin/trials", {
        method: "POST",
        body: JSON.stringify({
          title: hugeString,
          slug: "tier5-huge-title",
        }),
      });

      const res = await createAdminTrial(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBeDefined();
    });

    it("T5.1.2: boundary price_paise validation: negative values and floats rejected cleanly", async () => {
      // Negative price
      const negReq = adminReq("http://127.0.0.1:3000/api/v1/admin/trials", {
        method: "POST",
        body: JSON.stringify({
          title: "Tier 5 Negative Price",
          slug: "tier5-neg-price",
          price_paise: -500,
        }),
      });
      const negRes = await createAdminTrial(negReq);
      expect(negRes.status).toBe(400);

      // Float price
      const floatReq = adminReq("http://127.0.0.1:3000/api/v1/admin/trials", {
        method: "POST",
        body: JSON.stringify({
          title: "Tier 5 Float Price",
          slug: "tier5-float-price",
          price_paise: 299.99,
        }),
      });
      const floatRes = await createAdminTrial(floatReq);
      expect(floatRes.status).toBe(400);
    });

    it("T5.1.3: extreme brewing parameters rejected by component validation schema", async () => {
      const draft = TrialService.createDraft(
        { slug: "tier5-extreme-brew", title: "Extreme Brew Test" },
        adminActor
      );

      const invalidComps = createValidComponents();
      invalidComps[0].brew_temp_c = 400; // max is 100
      invalidComps[1].brew_time_sec = 10; // min is 30
      invalidComps[2].leaf_dose_g = 0.1; // min is 0.5

      const req = adminReq(
        `http://127.0.0.1:3000/api/v1/admin/trials/${draft.id}/components`,
        {
          method: "PUT",
          body: JSON.stringify({
            expected_revision: draft.revision,
            components: invalidComps,
          }),
        }
      );

      const res = await replaceComponents(req, p(draft.id));
      expect(res.status).toBe(400);
    });

    it("T5.1.4: malformed, empty, array, and non-JSON bodies cleanly rejected across mutation endpoints", async () => {
      // 1. Non-JSON string
      const rawReq = adminReq("http://127.0.0.1:3000/api/v1/admin/trials", {
        method: "POST",
        body: "NOT_A_VALID_JSON_STRING{{{",
      });
      const rawRes = await createAdminTrial(rawReq);
      expect(rawRes.status).toBe(400);

      // 2. Empty string
      const emptyReq = adminReq("http://127.0.0.1:3000/api/v1/admin/trials", {
        method: "POST",
        body: "",
      });
      const emptyRes = await createAdminTrial(emptyReq);
      expect(emptyRes.status).toBe(400);

      // 3. Array instead of object
      const arrayReq = adminReq("http://127.0.0.1:3000/api/v1/admin/trials", {
        method: "POST",
        body: JSON.stringify(["not", "an", "object"]),
      });
      const arrayRes = await createAdminTrial(arrayReq);
      expect(arrayRes.status).toBe(400);

      // 4. Null primitive
      const nullReq = adminReq("http://127.0.0.1:3000/api/v1/admin/trials", {
        method: "POST",
        body: "null",
      });
      const nullRes = await createAdminTrial(nullReq);
      expect(nullRes.status).toBe(400);
    });

    it("T5.1.5: PIN code fuzzing in shipping quote API rejects invalid, alphanumeric, and out-of-range PINs", async () => {
      const trial = makePublishReadyTrial("tier5-pincode-test");

      const testPincodes = [
        "012345", // Starts with 0
        "11000", // 5 digits
        "1100001", // 7 digits
        "11000A", // Alphanumeric
        "<script>", // XSS
        "-11000", // Negative
        "999999999999", // Overflow
      ];

      for (const pin of testPincodes) {
        const req = publicReq(
          `http://127.0.0.1:3000/api/v1/trials/${trial.slug}/shipping-quote`,
          {
            method: "POST",
            body: JSON.stringify({ pincode: pin, quantity: 1 }),
          }
        );
        const res = await getShippingQuote(req, slugP(trial.slug));
        expect(res.status).toBe(400);
      }

      // Quantity boundary checks: quantity 0 and 51
      const zeroQtyReq = publicReq(
        `http://127.0.0.1:3000/api/v1/trials/${trial.slug}/shipping-quote`,
        {
          method: "POST",
          body: JSON.stringify({ pincode: "110001", quantity: 0 }),
        }
      );
      expect((await getShippingQuote(zeroQtyReq, slugP(trial.slug))).status).toBe(400);

      const maxQtyReq = publicReq(
        `http://127.0.0.1:3000/api/v1/trials/${trial.slug}/shipping-quote`,
        {
          method: "POST",
          body: JSON.stringify({ pincode: "110001", quantity: 51 }),
        }
      );
      expect((await getShippingQuote(maxQtyReq, slugP(trial.slug))).status).toBe(400);
    });

    it("T5.1.6: empty string and whitespace-only field validation fails cleanly", async () => {
      const req = adminReq("http://127.0.0.1:3000/api/v1/admin/trials", {
        method: "POST",
        body: JSON.stringify({
          title: "    ",
          slug: "tier5-blank-title",
        }),
      });
      const res = await createAdminTrial(req);
      expect(res.status).toBe(400);
    });

    it("T5.1.7: prototype pollution attempts (__proto__, constructor) are safely neutralized", async () => {
      const maliciousBody = JSON.parse(`{
        "title": "Tier 5 Prototype Immunity",
        "slug": "tier5-proto-safe",
        "__proto__": { "polluted": "yes" },
        "constructor": { "prototype": { "admin": true } }
      }`);

      const req = adminReq("http://127.0.0.1:3000/api/v1/admin/trials", {
        method: "POST",
        body: JSON.stringify(maliciousBody),
      });

      const res = await createAdminTrial(req);
      expect(res.status).toBe(201);

      // Verify global Object prototype was not polluted
      expect((Object.prototype as any).polluted).toBeUndefined();
      expect((Object.prototype as any).admin).toBeUndefined();
    });

    it("T5.1.8: search query fuzzing with SQL wildcards and regex symbols runs cleanly without SQL errors", () => {
      const fuzzTerms = ["%", "_", "\\", "%%%", "';--", ".*", "(a|b)", "[0-9]"];
      for (const term of fuzzTerms) {
        const result = TrialService.list({ search: term });
        expect(result).toBeDefined();
        expect(Array.isArray(result.trials)).toBe(true);

        const pubResult = TrialService.listPublic({ search: term });
        expect(pubResult).toBeDefined();
        expect(Array.isArray(pubResult.trials)).toBe(true);
      }
    });

    it("T5.1.9: extreme pagination parameters are safely clamped within bounds", () => {
      TrialService.createDraft({ slug: "tier5-page-test", title: "Page Test" }, adminActor);

      // Negative limit and offset
      const clamped1 = TrialService.list({ limit: -10, offset: -5 });
      expect(clamped1.trials.length).toBeGreaterThanOrEqual(0);

      // Giant limit (should be capped at 100)
      const clamped2 = TrialService.list({ limit: 99999999 });
      expect(clamped2.trials.length).toBeLessThanOrEqual(100);

      // Public list limit (should be capped at 50)
      const clamped3 = TrialService.listPublic({ limit: 99999999 });
      expect(clamped3.trials.length).toBeLessThanOrEqual(50);
    });

    it("T5.1.10: Zod schema strictly rejects unexpected types in numeric fields", async () => {
      const req = adminReq("http://127.0.0.1:3000/api/v1/admin/trials", {
        method: "POST",
        body: JSON.stringify({
          title: "Type Check Kit",
          slug: "tier5-type-check",
          price_paise: "NOT_A_NUMBER",
        }),
      });
      const res = await createAdminTrial(req);
      expect(res.status).toBe(400);
    });
  });

  // ==========================================================================
  // PART 2: High-Concurrency, CAS Races & Multi-Channel Collision
  // ==========================================================================
  describe("Part 2: High-Concurrency, CAS Races & Multi-Channel Collision", () => {
    it("T5.2.1: 25-way simultaneous CAS race on TrialService.update: exactly 1 succeeds, 24 fail with TrialRevisionConflictError", async () => {
      const draft = TrialService.createDraft(
        { slug: "tier5-cas-race-25", title: "CAS Race Baseline" },
        adminActor
      );
      expect(draft.revision).toBe(1);

      // Launch 25 concurrent updates with expected_revision: 1
      const updatePromises = Array.from({ length: 25 }, (_, i) => {
        return Promise.resolve().then(() => {
          return TrialService.update(
            draft.id,
            1,
            { title: `CAS Race Winner Candidate #${i}` },
            adminActor
          );
        });
      });

      const results = await Promise.allSettled(updatePromises);
      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(24);

      // Assert all rejections are TrialRevisionConflictError
      for (const rej of rejected) {
        if (rej.status === "rejected") {
          expect(rej.reason).toBeInstanceOf(TrialRevisionConflictError);
          expect((rej.reason as TrialRevisionConflictError).current_revision).toBe(2);
          expect((rej.reason as TrialRevisionConflictError).expected_revision).toBe(1);
        }
      }

      // Assert final trial revision in database is exactly 2
      const finalTrial = TrialService.getById(draft.id)!;
      expect(finalTrial.revision).toBe(2);
    });

    it("T5.2.2: 15-way simultaneous PUT race on replaceComponents: exactly 1 succeeds, 14 fail with HTTP 409", async () => {
      const draft = TrialService.createDraft(
        { slug: "tier5-comps-race-15", title: "Component Race Baseline" },
        adminActor
      );

      const promises = Array.from({ length: 15 }, (_, i) => {
        const comps = createValidComponents();
        comps[0].name = `Concurrent Sachet #${i}`;
        const req = adminReq(
          `http://127.0.0.1:3000/api/v1/admin/trials/${draft.id}/components`,
          {
            method: "PUT",
            body: JSON.stringify({
              expected_revision: 1,
              components: comps,
            }),
          }
        );
        return replaceComponents(req, p(draft.id));
      });

      const responses = await Promise.all(promises);
      const statuses = responses.map((r) => r.status);
      const count200 = statuses.filter((s) => s === 200).length;
      const count409 = statuses.filter((s) => s === 409).length;

      expect(count200).toBe(1);
      expect(count409).toBe(14);

      const finalTrial = TrialService.getById(draft.id)!;
      expect(finalTrial.revision).toBe(2);
      expect(finalTrial.components.length).toBe(4);
    });

    it("T5.2.3: 15-way simultaneous POST race on attachAsset: exactly 1 succeeds, 14 fail with HTTP 409", async () => {
      const draft = TrialService.createDraft(
        { slug: "tier5-assets-race-15", title: "Asset Race Baseline" },
        adminActor
      );

      const promises = Array.from({ length: 15 }, (_, i) => {
        const req = adminReq(
          `http://127.0.0.1:3000/api/v1/admin/trials/${draft.id}/assets`,
          {
            method: "POST",
            body: JSON.stringify({
              expected_revision: 1,
              stage: "packaging",
              asset_url: `/images/trials/pkg-${i}.jpg`,
              alt_text: `Alt Text for Asset #${i}`,
            }),
          }
        );
        return attachAsset(req, p(draft.id));
      });

      const responses = await Promise.all(promises);
      const statuses = responses.map((r) => r.status);
      const count200 = statuses.filter((s) => s === 200).length;
      const count409 = statuses.filter((s) => s === 409).length;

      expect(count200).toBe(1);
      expect(count409).toBe(14);
      expect(TrialService.getById(draft.id)!.revision).toBe(2);
    });

    it("T5.2.4: 30-way heterogeneous race (10 update, 10 replaceComponents, 10 attachAsset): exactly 1 wins, 29 fail", async () => {
      const draft = TrialService.createDraft(
        { slug: "tier5-hetero-race-30", title: "Heterogeneous Baseline" },
        adminActor
      );

      const updateTasks = Array.from({ length: 10 }, (_, i) => {
        const req = adminReq(`http://127.0.0.1:3000/api/v1/admin/trials/${draft.id}`, {
          method: "PATCH",
          body: JSON.stringify({ expected_revision: 1, title: `Update #${i}` }),
        });
        return updateAdminTrial(req, p(draft.id));
      });

      const compTasks = Array.from({ length: 10 }, () => {
        const req = adminReq(`http://127.0.0.1:3000/api/v1/admin/trials/${draft.id}/components`, {
          method: "PUT",
          body: JSON.stringify({ expected_revision: 1, components: createValidComponents() }),
        });
        return replaceComponents(req, p(draft.id));
      });

      const assetTasks = Array.from({ length: 10 }, (_, i) => {
        const req = adminReq(`http://127.0.0.1:3000/api/v1/admin/trials/${draft.id}/assets`, {
          method: "POST",
          body: JSON.stringify({
            expected_revision: 1,
            stage: "packaging",
            asset_url: `/images/trials/art-${i}.jpg`,
            alt_text: `Alt #${i}`,
          }),
        });
        return attachAsset(req, p(draft.id));
      });

      const allResponses = await Promise.all([...updateTasks, ...compTasks, ...assetTasks]);
      const statuses = allResponses.map((r) => r.status);
      const count200 = statuses.filter((s) => s === 200).length;
      const count409 = statuses.filter((s) => s === 409).length;

      expect(count200).toBe(1);
      expect(count409).toBe(29);
      expect(TrialService.getById(draft.id)!.revision).toBe(2);
    });

    it("T5.2.5: high-speed sequential CAS chain: 30 sequential updates with monotonic revision progression (revision 1 -> 31)", () => {
      const draft = TrialService.createDraft(
        { slug: "tier5-seq-chain-30", title: "Sequential Step 0" },
        adminActor
      );

      let currentRev = draft.revision;
      for (let step = 1; step <= 30; step++) {
        const updated = TrialService.update(
          draft.id,
          currentRev,
          { title: `Sequential Step ${step}` },
          adminActor
        );
        expect(updated.revision).toBe(currentRev + 1);
        currentRev = updated.revision;
      }

      expect(currentRev).toBe(31);

      // Verify audit history contains exactly 31 entries (1 create + 30 updates)
      const history = TrialService.getHistory(draft.id);
      expect(history.length).toBe(31);
      expect(history[0].revision).toBe(31);
      expect(history[history.length - 1].revision).toBe(1);
    });

    it("T5.2.6: cross-channel concurrency: Admin REST PATCH and MCP trial_update race simultaneously", async () => {
      const draft = TrialService.createDraft(
        { slug: "tier5-cross-channel-race", title: "Cross-Channel Baseline" },
        adminActor
      );

      // Race 1: Admin REST PATCH
      const adminPromise = Promise.resolve().then(async () => {
        const req = adminReq(`http://127.0.0.1:3000/api/v1/admin/trials/${draft.id}`, {
          method: "PATCH",
          body: JSON.stringify({ expected_revision: 1, title: "Title via Admin REST" }),
        });
        const res = await updateAdminTrial(req, p(draft.id));
        return { channel: "admin", status: res.status };
      });

      // Race 2: MCP trial_update
      const mcpPromise = Promise.resolve().then(() => {
        try {
          const res = dispatchToolCall("trial_update", {
            id: draft.id,
            expected_revision: 1,
            title: "Title via MCP Tool",
          });
          return { channel: "mcp", status: 200, res };
        } catch (err) {
          if (err instanceof McpError) {
            return { channel: "mcp", status: err.code, message: err.message };
          }
          throw err;
        }
      });

      const [adminResult, mcpResult] = await Promise.all([adminPromise, mcpPromise]);

      const adminWon = adminResult.status === 200;
      const mcpWon = mcpResult.status === 200;

      // Exactly one must win
      expect(adminWon !== mcpWon).toBe(true);

      if (adminWon) {
        expect(mcpResult.status).toBe(-32009); // McpError revision conflict
      } else {
        expect(adminResult.status).toBe(409); // HTTP 409 revision conflict
      }

      expect(TrialService.getById(draft.id)!.revision).toBe(2);
    });

    it("T5.2.7: concurrent publish race: exactly 1 succeeds, others conflict", async () => {
      const trial = makePublishReadyTrial("tier5-publish-race");
      expect(trial.status).toBe("draft");
      const rev = trial.revision;

      const promises = Array.from({ length: 5 }, () => {
        const req = adminReq(`http://127.0.0.1:3000/api/v1/admin/trials/${trial.id}/publish`, {
          method: "POST",
          body: JSON.stringify({ expected_revision: rev }),
        });
        return publishTrial(req, p(trial.id));
      });

      const responses = await Promise.all(promises);
      const statuses = responses.map((r) => r.status);
      const count200 = statuses.filter((s) => s === 200).length;
      const countFail = statuses.filter((s) => s === 409).length;

      expect(count200).toBe(1);
      expect(countFail).toBe(4);

      const published = TrialService.getById(trial.id)!;
      expect(published.status).toBe("published");
      expect(published.revision).toBe(rev + 1);
    });

    it("T5.2.8: idempotent creation race: 10 concurrent POST requests with identical Idempotency-Key return identical created record", async () => {
      const idempotencyKey = `tier5-key-${randomUUID()}`;
      const payload = {
        title: "Idempotent Race Kit",
        slug: "tier5-idempotent-race",
        idempotencyKey,
      };

      const promises = Array.from({ length: 10 }, () => {
        const req = adminReq("http://127.0.0.1:3000/api/v1/admin/trials", {
          method: "POST",
          body: JSON.stringify(payload),
          headers: { "Idempotency-Key": idempotencyKey },
        });
        return createAdminTrial(req);
      });

      const responses = await Promise.all(promises);
      const jsonList = await Promise.all(responses.map((r) => r.json()));

      // All responses must report success (either 201 or 200 deduped)
      for (const res of responses) {
        expect([200, 201]).toContain(res.status);
      }

      // All responses return the identical trial ID
      const firstId = jsonList[0].id || jsonList[0].trial.id;
      for (const json of jsonList) {
        const id = json.id || json.trial?.id;
        expect(id).toBe(firstId);
      }

      // In database, exactly 1 row exists with this slug
      const countRow = db
        .prepare("SELECT COUNT(*) as cnt FROM trials WHERE slug = 'tier5-idempotent-race'")
        .get() as { cnt: number };
      expect(countRow.cnt).toBe(1);
    });
  });

  // ==========================================================================
  // PART 3: SQL Injection, Special Characters & Boundary Conditions
  // ==========================================================================
  describe("Part 3: SQL Injection, Special Characters & Boundary Conditions", () => {
    it("T5.3.1: SQL injection payload in title is safely stored as literal text without executing SQL", () => {
      const injectionTitle = "'; DROP TABLE trials; --";
      const created = TrialService.createDraft(
        { slug: "tier5-sqli-title", title: injectionTitle },
        adminActor
      );

      // Verify trial exists with exact verbatim title
      const fetched = TrialService.getById(created.id)!;
      expect(fetched.title).toBe(injectionTitle);

      // Verify trials table is completely intact
      const tableCheck = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='trials'")
        .get();
      expect(tableCheck).toBeDefined();
    });

    it("T5.3.2: SQL injection in slug is rejected by kebab-case validation regex", async () => {
      const maliciousSlugs = [
        "' OR '1'='1",
        "admin'--",
        "union select 1",
        "slug;DROP TABLE",
        "slug/*comment*/",
      ];

      for (const slug of maliciousSlugs) {
        const req = adminReq("http://127.0.0.1:3000/api/v1/admin/trials", {
          method: "POST",
          body: JSON.stringify({ title: "Valid Title", slug }),
        });
        const res = await createAdminTrial(req);
        expect(res.status).toBe(400);
      }
    });

    it("T5.3.3: SQL injection in search parameters is parameterized safely", () => {
      const sqliQueries = [
        "%' UNION SELECT 1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22 FROM admin_users --",
        "admin' OR '1'='1",
        "1; ATTACH DATABASE '/tmp/pwned' AS pwned; --",
      ];

      for (const q of sqliQueries) {
        const adminRes = TrialService.list({ search: q });
        expect(adminRes.trials).toBeDefined();

        const pubRes = TrialService.listPublic({ search: q });
        expect(pubRes.trials).toBeDefined();
      }
    });

    it("T5.3.4: Unicode tea garden names and multi-byte scripts preserved faithfully without corruption", () => {
      const unicodeNames = [
        "দার্জিলিং গোল্ডেন ফ্লাশ (Darjeeling)", // Bengali
        "दार्जिलिंग स्पेशल चाई (Darjeeling Chai)", // Devanagari
        "རྒྱལ་ཁབ་ཇ་ (Kangra Tea)", // Tibetan
        "Organic Reserve 🍵 🌿 ✨", // Emoji
      ];

      for (let i = 0; i < unicodeNames.length; i++) {
        const name = unicodeNames[i];
        const trial = TrialService.createDraft(
          { slug: `tier5-unicode-${i}`, title: name },
          adminActor
        );
        const fetched = TrialService.getById(trial.id)!;
        expect(fetched.title).toBe(name);
      }
    });

    it("T5.3.5: zero-width characters and RTL override marks handled safely", () => {
      const rtlText = "Himalayan \u202EReverse\u202C Tea";
      const zwjText = "Chai\u200DLatte\u200BBlend";

      const t1 = TrialService.createDraft({ slug: "tier5-rtl", title: rtlText }, adminActor);
      expect(TrialService.getById(t1.id)!.title).toBe(rtlText);

      const t2 = TrialService.createDraft({ slug: "tier5-zwj", title: zwjText }, adminActor);
      expect(TrialService.getById(t2.id)!.title).toBe(zwjText);
    });

    it("T5.3.6: NUL byte handling in search and text fields does not crash service", () => {
      const result = TrialService.list({ search: "tea\0null" });
      expect(result).toBeDefined();
      expect(Array.isArray(result.trials)).toBe(true);
    });

    it("T5.3.7: duplicate slug collision returns HTTP 409 Conflict", async () => {
      TrialService.createDraft({ slug: "tier5-dup-slug", title: "First Instance" }, adminActor);

      const req = adminReq("http://127.0.0.1:3000/api/v1/admin/trials", {
        method: "POST",
        body: JSON.stringify({ slug: "tier5-dup-slug", title: "Second Instance" }),
      });
      const res = await createAdminTrial(req);
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error).toMatch(/already exists|taken|UNIQUE/i);
    });

    it("T5.3.8: SQLite foreign key cascade deletion cleanly removes all child rows", () => {
      const trial = makePublishReadyTrial("tier5-cascade-del");

      // Verify children exist
      const compCount = db
        .prepare("SELECT COUNT(*) as cnt FROM trial_components WHERE trial_id = ?")
        .get(trial.id) as { cnt: number };
      expect(compCount.cnt).toBe(4);

      const assetCount = db
        .prepare("SELECT COUNT(*) as cnt FROM trial_assets WHERE trial_id = ?")
        .get(trial.id) as { cnt: number };
      expect(assetCount.cnt).toBeGreaterThanOrEqual(1);

      // Draft trial can be directly deleted
      TrialService.delete(trial.id, adminActor);

      // Assert parent is gone
      expect(TrialService.getById(trial.id)).toBeNull();

      // Assert all children are cascaded
      const compsAfter = db
        .prepare("SELECT COUNT(*) as cnt FROM trial_components WHERE trial_id = ?")
        .get(trial.id) as { cnt: number };
      expect(compsAfter.cnt).toBe(0);

      const assetsAfter = db
        .prepare("SELECT COUNT(*) as cnt FROM trial_assets WHERE trial_id = ?")
        .get(trial.id) as { cnt: number };
      expect(assetsAfter.cnt).toBe(0);
    });
  });

  // ==========================================================================
  // PART 4: Corrupted State Recovery & Database Invariant Enforcement
  // ==========================================================================
  describe("Part 4: Corrupted State Recovery & Database Invariant Enforcement", () => {
    it("T5.4.1: database trigger trg_trials_publish_insert_guard aborts direct INSERT with status='published'", () => {
      const trialId = randomUUID();
      expect(() => {
        db.prepare(`
          INSERT INTO trials (
            id, slug, title, status, pack_format, net_weight_g, price_paise, sku, revision
          ) VALUES (?, 'tier5-direct-pub', 'Direct Pub', 'published', '4x50g_sachets', 200, 20000, 'TRIAL-DIR', 1)
        `).run(trialId);
      }).toThrow(/Cannot insert trial directly as published: must start as draft/i);
    });

    it("T5.4.2: database trigger trg_trials_publish_weight_check aborts UPDATE to status='published' when components sum != 200g", () => {
      const trial = TrialService.createDraft(
        { slug: "tier5-bad-weight-trigger", title: "Bad Weight Trigger" },
        adminActor
      );

      // Delete one component directly from DB so sum is 150g
      db.prepare("DELETE FROM trial_components WHERE trial_id = ? AND slot_index = 3").run(trial.id);

      // Direct SQL attempt to set status = 'published'
      expect(() => {
        db.prepare("UPDATE trials SET status = 'published' WHERE id = ?").run(trial.id);
      }).toThrow(/Cannot publish trial: component weights must sum to exactly 200g/i);
    });

    it("T5.4.3: corrupted tasting_notes in trial_components gracefully handled by toPublicDto without throwing", () => {
      const trial = makePublishReadyTrial("tier5-corrupt-notes");
      TrialService.publish(trial.id, trial.revision, adminActor);

      // Corrupt tasting_notes in DB with non-JSON string
      db.prepare(
        "UPDATE trial_components SET tasting_notes = 'Corrupted, Unquoted, Notes' WHERE trial_id = ? AND slot_index = 0"
      ).run(trial.id);

      const dto = TrialService.getPublicBySlug("tier5-corrupt-notes");
      expect(dto).toBeDefined();
      expect(dto!.components[0].tasting_notes).toContain("Corrupted");
    });

    it("T5.4.4: corrupted diff_json in trial_audit: document behavior on getHistory", () => {
      const trial = TrialService.createDraft({ slug: "tier5-corrupt-diff", title: "Diff Test" }, adminActor);

      // Manually inject invalid non-JSON into trial_audit diff_json
      db.prepare("UPDATE trial_audit SET diff_json = 'INVALID_JSON_{{[' WHERE trial_id = ?").run(trial.id);

      // When getHistory is called, JSON.parse will encounter invalid syntax
      expect(() => {
        TrialService.getHistory(trial.id);
      }).toThrow(SyntaxError);
    });

    it("T5.4.5: zero-component kit resilience: validate returns all missing slot blockers, toPublicDto returns empty array", () => {
      const trial = TrialService.createDraft(
        { slug: "tier5-zero-comps", title: "Zero Comps Test" },
        adminActor
      );

      // Delete all components directly
      db.prepare("DELETE FROM trial_components WHERE trial_id = ?").run(trial.id);

      const validation = TrialService.validate(trial.id);
      expect(validation.can_publish).toBe(false);
      expect(validation.blockers.some((b) => b.includes("exactly 4 sachets"))).toBe(true);

      const details = TrialService.getById(trial.id)!;
      const previewDto = TrialService.toPublicDto(details, { allowDraftPreview: true });
      expect(previewDto.components).toEqual([]);
    });

    it("T5.4.6: archived kit state lock: all mutating operations rejected with TrialInvalidStateTransitionError", () => {
      const trial = TrialService.createDraft({ slug: "tier5-archived-lock", title: "Archive Lock" }, adminActor);
      TrialService.archive(trial.id, 1, adminActor);

      const archived = TrialService.getById(trial.id)!;
      expect(archived.status).toBe("archived");

      // 1. update rejected
      expect(() => {
        TrialService.update(archived.id, archived.revision, { title: "New Title" }, adminActor);
      }).toThrow(TrialInvalidStateTransitionError);

      // 2. replaceComponents rejected
      expect(() => {
        TrialService.replaceComponents(archived.id, archived.revision, createValidComponents(), adminActor);
      }).toThrow(TrialInvalidStateTransitionError);

      // 3. attachAsset rejected
      expect(() => {
        TrialService.attachAsset(
          archived.id,
          archived.revision,
          { stage: "packaging", asset_url: "/img.jpg", alt_text: "Alt" },
          adminActor
        );
      }).toThrow(TrialInvalidStateTransitionError);

      // 4. detachAsset rejected
      expect(() => {
        TrialService.detachAsset(archived.id, archived.revision, "any-id", adminActor);
      }).toThrow(TrialInvalidStateTransitionError);

      // 5. archive again rejected
      expect(() => {
        TrialService.archive(archived.id, archived.revision, adminActor);
      }).toThrow(TrialInvalidStateTransitionError);
    });

    it("T5.4.7: published trial deletion blocked: DELETE /api/v1/admin/trials/:id on published trial rejected with HTTP 400", async () => {
      const trial = makePublishReadyTrial("tier5-pub-del-block");
      TrialService.publish(trial.id, trial.revision, adminActor);

      const req = adminReq(`http://127.0.0.1:3000/api/v1/admin/trials/${trial.id}`, {
        method: "DELETE",
      });

      const res = await deleteAdminTrial(req, p(trial.id));
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/Cannot delete a published trial/i);

      // Assert trial is still in DB
      expect(TrialService.getById(trial.id)).toBeDefined();
    });

    it("T5.4.8: missing hero image and empty assets array gracefully projects hero_image: null", () => {
      const trial = TrialService.createDraft({ slug: "tier5-no-hero", title: "No Hero" }, adminActor);
      const details = TrialService.getById(trial.id)!;
      const preview = TrialService.toPublicDto(details, { allowDraftPreview: true });

      expect(preview.hero_image).toBeNull();
      expect(preview.components.every((c) => c.assets.length === 0)).toBe(true);
    });
  });

  // ==========================================================================
  // PART 5: Storefront Security, Arithmetic & Boundary Logic
  // ==========================================================================
  describe("Part 5: Storefront Security, Arithmetic & Boundary Logic", () => {
    it("T5.5.1: whitelist projection zero-leakage audit: recursive JSON inspection asserting absence of sensitive fields", async () => {
      const trial = makePublishReadyTrial("tier5-zero-leakage");

      // Inject sensitive internal fields into database
      db.prepare(`
        UPDATE trials
        SET cost_paise = 14500
        WHERE id = ?
      `).run(trial.id);

      TrialService.publish(trial.id, trial.revision, adminActor);

      const req = publicReq(`http://127.0.0.1:3000/api/v1/trials/${trial.slug}`);
      const res = await getPublicTrialBySlug(req, slugP(trial.slug));
      expect(res.status).toBe(200);

      const jsonStr = await res.text();
      const jsonObj = JSON.parse(jsonStr);

      // 1. Text grep on raw response
      expect(jsonStr).not.toContain("cost_paise");
      expect(jsonStr).not.toContain("14500");
      expect(jsonStr).not.toContain("margin");

      // 2. Recursive key check
      function assertNoSensitiveKeys(obj: any) {
        if (!obj || typeof obj !== "object") return;
        for (const [key, val] of Object.entries(obj)) {
          expect(key).not.toBe("cost_paise");
          expect(key).not.toBe("cost");
          expect(key).not.toBe("supplier_id");
          expect(key).not.toBe("internal_notes");
          if (typeof val === "object") {
            assertNoSensitiveKeys(val);
          }
        }
      }
      assertNoSensitiveKeys(jsonObj);
    });

    it("T5.5.2: public route status isolation: unauthenticated requests to draft, in_review, and archived trials strictly return HTTP 404", async () => {
      // 1. Draft
      const draft = TrialService.createDraft({ slug: "tier5-iso-draft", title: "Draft" }, adminActor);
      const resDraft = await getPublicTrialBySlug(
        publicReq(`http://127.0.0.1:3000/api/v1/trials/${draft.slug}`),
        slugP(draft.slug)
      );
      expect(resDraft.status).toBe(404);

      // 2. In-Review
      TrialService.submitReview(draft.id, draft.revision, adminActor);
      const resReview = await getPublicTrialBySlug(
        publicReq(`http://127.0.0.1:3000/api/v1/trials/${draft.slug}`),
        slugP(draft.slug)
      );
      expect(resReview.status).toBe(404);

      // 3. Archived
      const archivedTrial = TrialService.createDraft({ slug: "tier5-iso-archived", title: "Archived" }, adminActor);
      TrialService.archive(archivedTrial.id, archivedTrial.revision, adminActor);
      const resArchived = await getPublicTrialBySlug(
        publicReq(`http://127.0.0.1:3000/api/v1/trials/${archivedTrial.slug}`),
        slugP(archivedTrial.slug)
      );
      expect(resArchived.status).toBe(404);
    });

    it("T5.5.3: authenticated admin draft preview returns HTTP 200 with is_preview: true and no-store headers", async () => {
      const draft = TrialService.createDraft({ slug: "tier5-preview-draft", title: "Admin Preview" }, adminActor);

      const req = adminReq(`http://127.0.0.1:3000/api/v1/trials/${draft.slug}`);
      const res = await getPublicTrialBySlug(req, slugP(draft.slug));
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.is_preview).toBe(true);
      expect(json.slug).toBe(draft.slug);
      expect(res.headers.get("cache-control")).toContain("no-store");
    });

    it("T5.5.4: truthful Cost-Per-Cup arithmetic: exact half-up paise rounding without floating-point drift", () => {
      // 333 ₹/kg at 2.5g = (333 * 2.5) / 1000 = 0.8325 -> rounds to 0.83
      expect(calculateCostPerCup(333, 2.5)).toBe(0.83);
      expect(formatCostPerCup(0.83)).toBe("₹0.83");

      // 430 ₹/kg at 2.5g = (430 * 2.5) / 1000 = 1.075 -> rounds to 1.08
      expect(calculateCostPerCup(430, 2.5)).toBe(1.08);
      expect(formatCostPerCup(1.08)).toBe("₹1.08");

      // Invalid inputs
      expect(calculateCostPerCup(NaN, 2.5)).toBe(0);
      expect(calculateCostPerCup(-500, 2.5)).toBe(0);
      expect(calculateCostPerCup(1000, NaN)).toBe(2.5); // dose defaults to 2.5
    });

    it("T5.5.5: truthful Savings Delta: negative savings returns '+₹X.XX more / cup' and isSavings: false", () => {
      // Benchmark tea ₹0.80/cup, Trial tea ₹1.25/cup -> trial is more expensive
      const negativeDelta = calculateSavingsDelta(0.8, 1.25);
      expect(negativeDelta.isSavings).toBe(false);
      expect(negativeDelta.diff).toBe(-0.45);
      expect(negativeDelta.formatted).toBe("+₹0.45 more / cup");

      // Benchmark tea ₹1.50/cup, Trial tea ₹1.00/cup -> trial is cheaper
      const positiveDelta = calculateSavingsDelta(1.5, 1.0);
      expect(positiveDelta.isSavings).toBe(true);
      expect(positiveDelta.diff).toBe(0.5);
      expect(positiveDelta.formatted).toBe("₹0.50 saved");

      // Equal costs
      const zeroDelta = calculateSavingsDelta(1.0, 1.0);
      expect(zeroDelta.isSavings).toBe(false);
      expect(zeroDelta.formatted).toBe("No change");
    });

    it("T5.5.6: cup yield calculation: zero, negative, or extreme inputs clamp safely", () => {
      // Standard 200g kit / 2.5g dose = 80 cups
      expect(calculateKitCupYield(200, 2.5)).toBe(80);

      // Zero weight
      expect(calculateKitCupYield(0, 2.5)).toBe(0);

      // Negative weight fallback
      expect(calculateKitCupYield(-100, 2.5)).toBe(0);

      // Dose clamped to [1.0, 15.0]
      expect(clampDoseGrams(0.1)).toBe(1.0);
      expect(clampDoseGrams(25.0)).toBe(15.0);
      expect(clampDoseGrams(NaN)).toBe(2.5);

      // Steep duration clamped to [30, 1800]
      expect(clampBrewingDuration(10)).toBe(30);
      expect(clampBrewingDuration(3600)).toBe(1800);
      expect(clampBrewingDuration(NaN)).toBe(180);
    });

    it("T5.5.7: accessible keyboard navigation: circular tab wrapping (getNextTab) handles edge cases", () => {
      // Total 4 tabs
      expect(getNextTab(0, "prev", 4)).toBe(3); // wraps backward to last
      expect(getNextTab(3, "next", 4)).toBe(0); // wraps forward to first
      expect(getNextTab(1, "next", 4)).toBe(2);
      expect(getNextTab(2, "prev", 4)).toBe(1);

      // 0 tabs edge case
      expect(getNextTab(0, "next", 0)).toBe(0);
      expect(getNextTab(0, "prev", 0)).toBe(0);

      // 1 tab edge case
      expect(getNextTab(0, "next", 1)).toBe(0);
      expect(getNextTab(0, "prev", 1)).toBe(0);
    });

    it("T5.5.8: storefront terroir provenance formatter: formatProvenance never renders literal 'null' or 'undefined'", () => {
      const prov = formatProvenance(null, undefined, "", null, undefined);

      expect(prov.estate).not.toBe("null");
      expect(prov.estate).not.toBe("undefined");
      expect(prov.estate.length).toBeGreaterThan(0);

      expect(prov.elevation).not.toBe("null");
      expect(prov.elevation).not.toBe("undefined");
      expect(prov.elevation.length).toBeGreaterThan(0);

      expect(prov.flush).not.toBe("null");
      expect(prov.flush).not.toBe("undefined");

      expect(prov.grade).not.toBe("null");
      expect(prov.grade).not.toBe("undefined");

      expect(prov.lot).not.toBe("null");
      expect(prov.lot).not.toBe("undefined");
    });
  });
});
