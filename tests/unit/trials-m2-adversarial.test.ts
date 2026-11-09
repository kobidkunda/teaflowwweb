/**
 * TeaFloww Trials v3 — Milestone 2 Adversarial Stress & Concurrency Test Suite
 *
 * Adversarially challenges:
 * 1. Concurrency & CAS Revision Conflicts (HTTP 409):
 *    - 20-way async race on PATCH /api/v1/admin/trials/:id with expected_revision: 1
 *    - 10-way async race on PUT /api/v1/admin/trials/:id/components with expected_revision: 1
 *    - Cross-endpoint mutation race (PATCH, PUT components, POST assets, POST submit-review)
 *    - Stale revision checks across all mutating endpoints (returning HTTP 409 with current_revision & expected_revision)
 *    - Monotonic revision progression and stale recheck
 * 2. Idempotency Key Handling:
 *    - Header-based Idempotency-Key replay returning HTTP 200 with identical response
 *    - Body-based idempotencyKey replay
 *    - Concurrent burst requests with identical Idempotency-Key
 *    - Replay with altered payload returning cached response
 *    - Missing Idempotency-Key slug conflict (HTTP 409)
 * 3. Publish Gate HTTP 422 Unprocessable Entity:
 *    - Attempting to publish incomplete draft returns HTTP 422 with blockers array
 *    - GET /validate checklist evaluation
 *    - Non-published state and revision preservation on rejection
 *    - End-to-end publish gate pass after satisfying all criteria
 * 4. Component Weight Invariant (4x50g=200g):
 *    - Rejections with HTTP 422 on 3 sachets (150g), 5 sachets (250g), unbalanced weights [40g, 60g, 50g, 50g]
 * 5. Security, Authentication & Public Data Protection:
 *    - HTTP 401 on unauthenticated access across all admin endpoints
 *    - Draft protection (HTTP 404 on unauthenticated public PDP)
 *    - Whitelist projection redacting COGS, supplier info, and notes
 *    - Injection & boundary resistance (zero price, malformed JSON, SQL injection)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { createAdminSession } from "@/lib/adminSessions";
import { resetRateLimits } from "@/lib/rateLimit";

// Route handlers
import { GET as getPublicTrialBySlug } from "@/app/api/v1/trials/[slug]/route";
import { GET as getAdminTrials, POST as createAdminTrial } from "@/app/api/v1/admin/trials/route";
import {
  GET as getAdminTrial,
  PATCH as updateAdminTrial,
  DELETE as deleteAdminTrial,
} from "@/app/api/v1/admin/trials/[id]/route";
import { PUT as replaceComponents } from "@/app/api/v1/admin/trials/[id]/components/route";
import { POST as attachAsset, DELETE as detachAsset } from "@/app/api/v1/admin/trials/[id]/assets/route";
import { GET as validateTrial } from "@/app/api/v1/admin/trials/[id]/validate/route";
import { POST as submitReview } from "@/app/api/v1/admin/trials/[id]/submit-review/route";
import { POST as publishTrial } from "@/app/api/v1/admin/trials/[id]/publish/route";
import { POST as unpublishTrial } from "@/app/api/v1/admin/trials/[id]/unpublish/route";
import { POST as archiveTrial } from "@/app/api/v1/admin/trials/[id]/archive/route";
import { GET as getTrialHistory } from "@/app/api/v1/admin/trials/[id]/history/route";

describe("TeaFloww Trials v3 — Milestone 2 Adversarial & Concurrency Harness", () => {
  let adminCookie: string;
  const db = getDb();

  beforeEach(() => {
    resetRateLimits();
    vi.stubEnv("COMMERCE_MOCK_PROVIDERS", "1");
    vi.stubEnv("SESSION_SECRET", "test_session_secret_for_signing_cookies_32_bytes_long");

    // Ensure root admin user exists
    db.prepare(`
      INSERT OR IGNORE INTO admin_users (id, username, password_hash, role)
      VALUES (1, 'admin', 'hash', 'root')
    `).run();

    const session = createAdminSession(1);
    adminCookie = `admin_session=${session.cookieValue}`;

    // Clean up test records and idempotency cache
    db.prepare("DELETE FROM trials WHERE slug LIKE 'adv-%'").run();
    db.prepare("DELETE FROM admin_idempotency WHERE key LIKE 'adv-%'").run();
  });

  let ipCounter = 1;
  function adminReq(
    url: string,
    init?: { method?: string; body?: string; headers?: Record<string, string> }
  ): NextRequest {
    return new NextRequest(url, {
      method: init?.method || (init?.body ? "POST" : "GET"),
      body: init?.body,
      headers: {
        Cookie: adminCookie,
        "Content-Type": "application/json",
        "x-forwarded-for": `10.88.1.${(ipCounter++ % 250) + 1}`,
        ...(init?.headers || {}),
      },
    });
  }

  function publicReq(
    url: string,
    init?: { method?: string; body?: string; headers?: Record<string, string> }
  ): NextRequest {
    return new NextRequest(url, {
      method: init?.method || (init?.body ? "POST" : "GET"),
      body: init?.body,
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": `10.88.2.${(ipCounter++ % 250) + 1}`,
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

  async function createHelper(slug: string, title: string = "Adversarial Kit") {
    const res = await createAdminTrial(
      adminReq("http://localhost/api/v1/admin/trials", {
        method: "POST",
        body: JSON.stringify({
          title,
          slug,
          tagline: "Test kit tagline",
          price_paise: 49900,
        }),
      })
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    return data;
  }

  // ==========================================================================
  // Section 1: Concurrency & Revision Conflicts (HTTP 409)
  // ==========================================================================
  describe("1. Concurrency & Revision Conflicts (HTTP 409)", () => {
    it("20-way concurrent PATCH race on same expected_revision allows EXACTLY 1 winner and 19 HTTP 409 conflicts", async () => {
      const trial = await createHelper("adv-race-patch-20");
      expect(trial.revision).toBe(1);

      // Launch 20 concurrent updates all claiming expected_revision: 1
      const count = 20;
      const promises = Array.from({ length: count }, (_, i) =>
        updateAdminTrial(
          adminReq(`http://localhost/api/v1/admin/trials/${trial.id}`, {
            method: "PATCH",
            body: JSON.stringify({
              expected_revision: 1,
              title: `Winner Candidate ${i}`,
            }),
          }),
          p(trial.id)
        )
      );

      const responses = await Promise.all(promises);
      const results = await Promise.all(
        responses.map(async (r) => ({
          status: r.status,
          json: await r.json(),
        }))
      );

      const successes = results.filter((r) => r.status === 200);
      const conflicts = results.filter((r) => r.status === 409);

      // In atomic CAS concurrency, exactly 1 succeeds and 19 fail
      expect(successes).toHaveLength(1);
      expect(conflicts).toHaveLength(19);

      // Winning response bumped revision to 2
      expect(successes[0].json.revision).toBe(2);

      // All 19 rejected responses must return HTTP 409 with required payload contract
      for (const c of conflicts) {
        expect(c.json).toHaveProperty("error");
        expect(c.json.current_revision).toBe(2);
        expect(c.json.expected_revision).toBe(1);
      }

      // Verify DB state: revision is exactly 2
      const inDb = db.prepare("SELECT revision FROM trials WHERE id = ?").get(trial.id) as { revision: number };
      expect(inDb.revision).toBe(2);

      // Verify Audit trail: exactly 2 events (create_draft, update)
      const auditCount = db
        .prepare("SELECT COUNT(*) as count FROM trial_audit WHERE trial_id = ?")
        .get(trial.id) as { count: number };
      expect(auditCount.count).toBe(2);
    });

    it("10-way concurrent PUT /components race on same expected_revision allows EXACTLY 1 winner and 9 HTTP 409 conflicts", async () => {
      const trial = await createHelper("adv-race-comp-10");
      expect(trial.revision).toBe(1);

      const validComponents = [
        { slot_index: 0, name: "Autumn Flush", estate: "Rohini", weight_g: 50, quantity: 1 },
        { slot_index: 1, name: "Summer Muscatel", estate: "Gopaldhara", weight_g: 50, quantity: 1 },
        { slot_index: 2, name: "Spring First", estate: "Castleton", weight_g: 50, quantity: 1 },
        { slot_index: 3, name: "Green Pearl", estate: "Okayti", weight_g: 50, quantity: 1 },
      ];

      const promises = Array.from({ length: 10 }, (_, i) =>
        replaceComponents(
          adminReq(`http://localhost/api/v1/admin/trials/${trial.id}/components`, {
            method: "PUT",
            body: JSON.stringify({
              expected_revision: 1,
              components: validComponents.map((c) => ({ ...c, notes: `Racer ${i}` })),
            }),
          }),
          p(trial.id)
        )
      );

      const responses = await Promise.all(promises);
      const results = await Promise.all(
        responses.map(async (r) => ({
          status: r.status,
          json: await r.json(),
        }))
      );

      const successes = results.filter((r) => r.status === 200);
      const conflicts = results.filter((r) => r.status === 409);

      expect(successes).toHaveLength(1);
      expect(conflicts).toHaveLength(9);
      expect(successes[0].json.revision).toBe(2);

      for (const c of conflicts) {
        expect(c.json).toHaveProperty("error");
        expect(c.json.current_revision).toBe(2);
        expect(c.json.expected_revision).toBe(1);
      }

      const inDb = db.prepare("SELECT revision FROM trials WHERE id = ?").get(trial.id) as { revision: number };
      expect(inDb.revision).toBe(2);
    });

    it("cross-endpoint mutation race (PATCH metadata vs PUT components vs POST assets) allows only 1 winner", async () => {
      const trial = await createHelper("adv-race-cross");
      expect(trial.revision).toBe(1);

      const validComponents = [
        { slot_index: 0, name: "Tea A", estate: "Estate A", weight_g: 50, quantity: 1 },
        { slot_index: 1, name: "Tea B", estate: "Estate B", weight_g: 50, quantity: 1 },
        { slot_index: 2, name: "Tea C", estate: "Estate C", weight_g: 50, quantity: 1 },
        { slot_index: 3, name: "Tea D", estate: "Estate D", weight_g: 50, quantity: 1 },
      ];

      // Dispatch 3 different mutating endpoints simultaneously on expected_revision: 1
      const reqPatch = updateAdminTrial(
        adminReq(`http://localhost/api/v1/admin/trials/${trial.id}`, {
          method: "PATCH",
          body: JSON.stringify({ expected_revision: 1, title: "Cross Patch Win" }),
        }),
        p(trial.id)
      );

      const reqPutComponents = replaceComponents(
        adminReq(`http://localhost/api/v1/admin/trials/${trial.id}/components`, {
          method: "PUT",
          body: JSON.stringify({ expected_revision: 1, components: validComponents }),
        }),
        p(trial.id)
      );

      const reqPostAsset = attachAsset(
        adminReq(`http://localhost/api/v1/admin/trials/${trial.id}/assets`, {
          method: "POST",
          body: JSON.stringify({
            expected_revision: 1,
            stage: "packaging",
            asset_url: "https://images.teafloww.com/trials/pkg.webp",
            alt_text: "Packaging front box",
          }),
        }),
        p(trial.id)
      );

      const responses = await Promise.all([reqPatch, reqPutComponents, reqPostAsset]);
      const results = await Promise.all(
        responses.map(async (r) => ({
          status: r.status,
          json: await r.json(),
        }))
      );

      const successes = results.filter((r) => r.status === 200);
      const conflicts = results.filter((r) => r.status === 409);

      expect(successes).toHaveLength(1);
      expect(conflicts).toHaveLength(2);

      for (const c of conflicts) {
        expect(c.json).toHaveProperty("error");
        expect(c.json.current_revision).toBe(2);
        expect(c.json.expected_revision).toBe(1);
      }
    });

    it("40-way cross-endpoint collision storm (20 PATCH + 20 PUT components): exactly 1 winner, 39 conflicts, 0 deadlocks", async () => {
      const trial = await createHelper("adv-race-storm-40");
      expect(trial.revision).toBe(1);

      const validComponents = [
        { slot_index: 0, name: "Storm Pouch 0", estate: "Rohini", weight_g: 50, quantity: 1 },
        { slot_index: 1, name: "Storm Pouch 1", estate: "Gopaldhara", weight_g: 50, quantity: 1 },
        { slot_index: 2, name: "Storm Pouch 2", estate: "Castleton", weight_g: 50, quantity: 1 },
        { slot_index: 3, name: "Storm Pouch 3", estate: "Okayti", weight_g: 50, quantity: 1 },
      ];

      const patchReqs = Array.from({ length: 20 }, (_, i) =>
        updateAdminTrial(
          adminReq(`http://localhost/api/v1/admin/trials/${trial.id}`, {
            method: "PATCH",
            body: JSON.stringify({ expected_revision: 1, title: `Storm Patch ${i}` }),
          }),
          p(trial.id)
        )
      );

      const putReqs = Array.from({ length: 20 }, (_, i) =>
        replaceComponents(
          adminReq(`http://localhost/api/v1/admin/trials/${trial.id}/components`, {
            method: "PUT",
            body: JSON.stringify({
              expected_revision: 1,
              components: validComponents.map((c) => ({ ...c, notes: `Storm Component ${i}` })),
            }),
          }),
          p(trial.id)
        )
      );

      const allResponses = await Promise.all([...patchReqs, ...putReqs]);
      const results = await Promise.all(
        allResponses.map(async (r) => ({
          status: r.status,
          json: await r.json(),
        }))
      );

      const successes = results.filter((r) => r.status === 200);
      const conflicts = results.filter((r) => r.status === 409);
      const serverErrors = results.filter((r) => r.status >= 500);

      // In atomic CAS with .immediate() transactions, exactly 1 succeeds and 39 are rejected with 409
      expect(serverErrors).toHaveLength(0);
      expect(successes).toHaveLength(1);
      expect(conflicts).toHaveLength(39);

      // Verify DB revision is 2
      const inDb = db.prepare("SELECT revision FROM trials WHERE id = ?").get(trial.id) as { revision: number };
      expect(inDb.revision).toBe(2);
    });

    it("verifies HTTP 409 and error contract across ALL mutating endpoints on stale expected_revision", async () => {
      const trial = await createHelper("adv-stale-endpoints");
      expect(trial.revision).toBe(1);

      // Stale revision: 999
      const staleRev = 999;

      // 1. PATCH /api/v1/admin/trials/:id
      const resPatch = await updateAdminTrial(
        adminReq(`http://localhost/api/v1/admin/trials/${trial.id}`, {
          method: "PATCH",
          body: JSON.stringify({ expected_revision: staleRev, title: "Stale Patch" }),
        }),
        p(trial.id)
      );
      expect(resPatch.status).toBe(409);
      const jsonPatch = await resPatch.json();
      expect(jsonPatch.current_revision).toBe(1);
      expect(jsonPatch.expected_revision).toBe(staleRev);

      // 2. PUT /api/v1/admin/trials/:id/components
      const resComp = await replaceComponents(
        adminReq(`http://localhost/api/v1/admin/trials/${trial.id}/components`, {
          method: "PUT",
          body: JSON.stringify({
            expected_revision: staleRev,
            components: [
              { slot_index: 0, name: "Tea 1", estate: "E1", weight_g: 50, quantity: 1 },
              { slot_index: 1, name: "Tea 2", estate: "E2", weight_g: 50, quantity: 1 },
              { slot_index: 2, name: "Tea 3", estate: "E3", weight_g: 50, quantity: 1 },
              { slot_index: 3, name: "Tea 4", estate: "E4", weight_g: 50, quantity: 1 },
            ],
          }),
        }),
        p(trial.id)
      );
      expect(resComp.status).toBe(409);
      const jsonComp = await resComp.json();
      expect(jsonComp.current_revision).toBe(1);
      expect(jsonComp.expected_revision).toBe(staleRev);

      // 3. POST /api/v1/admin/trials/:id/assets
      const resAsset = await attachAsset(
        adminReq(`http://localhost/api/v1/admin/trials/${trial.id}/assets`, {
          method: "POST",
          body: JSON.stringify({
            expected_revision: staleRev,
            stage: "packaging",
            asset_url: "https://images.teafloww.com/trials/pkg.webp",
            alt_text: "Packaging box",
          }),
        }),
        p(trial.id)
      );
      expect(resAsset.status).toBe(409);
      const jsonAsset = await resAsset.json();
      expect(jsonAsset.current_revision).toBe(1);
      expect(jsonAsset.expected_revision).toBe(staleRev);

      // 4. POST /api/v1/admin/trials/:id/submit-review
      const resSubmit = await submitReview(
        adminReq(`http://localhost/api/v1/admin/trials/${trial.id}/submit-review`, {
          method: "POST",
          body: JSON.stringify({ expected_revision: staleRev }),
        }),
        p(trial.id)
      );
      expect(resSubmit.status).toBe(409);
      const jsonSubmit = await resSubmit.json();
      expect(jsonSubmit.current_revision).toBe(1);
      expect(jsonSubmit.expected_revision).toBe(staleRev);

      // 5. POST /api/v1/admin/trials/:id/archive
      const resArchive = await archiveTrial(
        adminReq(`http://localhost/api/v1/admin/trials/${trial.id}/archive`, {
          method: "POST",
          body: JSON.stringify({ expected_revision: staleRev }),
        }),
        p(trial.id)
      );
      expect(resArchive.status).toBe(409);
      const jsonArchive = await resArchive.json();
      expect(jsonArchive.current_revision).toBe(1);
      expect(jsonArchive.expected_revision).toBe(staleRev);
    });

    it("guarantees strictly monotonic revisions across 10 sequential edits and rejects earlier revisions", async () => {
      const trial = await createHelper("adv-monotonic-seq");

      let currentRev = trial.revision; // 1
      for (let i = 1; i <= 10; i++) {
        const res = await updateAdminTrial(
          adminReq(`http://localhost/api/v1/admin/trials/${trial.id}`, {
            method: "PATCH",
            body: JSON.stringify({
              expected_revision: currentRev,
              title: `Monotonic Step ${i}`,
            }),
          }),
          p(trial.id)
        );
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.revision).toBe(currentRev + 1);
        currentRev = data.revision;
      }
      expect(currentRev).toBe(11);

      // Attempting to update with revision 5 must fail with 409
      const staleRes = await updateAdminTrial(
        adminReq(`http://localhost/api/v1/admin/trials/${trial.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            expected_revision: 5,
            title: "Outdated Edit",
          }),
        }),
        p(trial.id)
      );
      expect(staleRes.status).toBe(409);
      const staleJson = await staleRes.json();
      expect(staleJson.current_revision).toBe(11);
      expect(staleJson.expected_revision).toBe(5);
    });
  });

  // ==========================================================================
  // Section 2: Idempotency Key Handling
  // ==========================================================================
  describe("2. Idempotency Key Handling", () => {
    it("enforces header-based Idempotency-Key replay: returns HTTP 200 with identical payload and ZERO duplicate DB rows", async () => {
      const key = "adv-idemp-hdr-001";
      const payload = {
        title: "Idempotent Kit Header",
        slug: "adv-idemp-kit-hdr",
        tagline: "First creation",
        price_paise: 59900,
      };

      // 1st request: Creates the trial
      const res1 = await createAdminTrial(
        adminReq("http://localhost/api/v1/admin/trials", {
          method: "POST",
          body: JSON.stringify(payload),
          headers: { "Idempotency-Key": key },
        })
      );
      expect(res1.status).toBe(201);
      const data1 = await res1.json();
      expect(data1.slug).toBe(payload.slug);
      expect(data1.revision).toBe(1);

      // Verify DB has exactly 1 row
      const count1 = db
        .prepare("SELECT COUNT(*) as cnt FROM trials WHERE slug = ?")
        .get(payload.slug) as { cnt: number };
      expect(count1.cnt).toBe(1);

      // 2nd request: Replay with identical key and payload
      const res2 = await createAdminTrial(
        adminReq("http://localhost/api/v1/admin/trials", {
          method: "POST",
          body: JSON.stringify(payload),
          headers: { "Idempotency-Key": key },
        })
      );
      expect(res2.status).toBe(200); // deduped returns 200
      const data2 = await res2.json();

      // Body must be identical
      expect(data2.id).toBe(data1.id);
      expect(data2.slug).toBe(data1.slug);
      expect(data2.title).toBe(data1.title);
      expect(data2.revision).toBe(data1.revision);

      // Verify DB STILL has exactly 1 row
      const count2 = db
        .prepare("SELECT COUNT(*) as cnt FROM trials WHERE slug = ?")
        .get(payload.slug) as { cnt: number };
      expect(count2.cnt).toBe(1);

      // Verify idempotency cache table has entry
      const cacheRow = db
        .prepare("SELECT key, resource FROM admin_idempotency WHERE key = ?")
        .get(key) as { key: string; resource: string };
      expect(cacheRow).toBeDefined();
      expect(cacheRow.resource).toBe("trial_create");
    });

    it("enforces body-based idempotencyKey field replay", async () => {
      const key = "adv-idemp-body-002";
      const payload = {
        idempotencyKey: key,
        title: "Idempotent Kit Body",
        slug: "adv-idemp-kit-body",
        tagline: "Created via body field",
        price_paise: 69900,
      };

      const res1 = await createAdminTrial(
        adminReq("http://localhost/api/v1/admin/trials", {
          method: "POST",
          body: JSON.stringify(payload),
        })
      );
      expect(res1.status).toBe(201);
      const data1 = await res1.json();

      // Replay
      const res2 = await createAdminTrial(
        adminReq("http://localhost/api/v1/admin/trials", {
          method: "POST",
          body: JSON.stringify(payload),
        })
      );
      expect(res2.status).toBe(200);
      const data2 = await res2.json();
      expect(data2.id).toBe(data1.id);

      const count = db
        .prepare("SELECT COUNT(*) as cnt FROM trials WHERE slug = ?")
        .get(payload.slug) as { cnt: number };
      expect(count.cnt).toBe(1);
    });

    it("concurrent burst flood with identical Idempotency-Key creates strictly 1 record and returns matching data", async () => {
      const key = "adv-idemp-burst-003";
      const payload = {
        title: "Idempotent Burst Kit",
        slug: "adv-idemp-kit-burst",
        tagline: "Burst test",
        price_paise: 79900,
      };

      // Dispatch 10 simultaneous POST requests with identical key
      const count = 10;
      const promises = Array.from({ length: count }, () =>
        createAdminTrial(
          adminReq("http://localhost/api/v1/admin/trials", {
            method: "POST",
            body: JSON.stringify(payload),
            headers: { "Idempotency-Key": key },
          })
        )
      );

      const responses = await Promise.all(promises);
      const results = await Promise.all(
        responses.map(async (r) => ({
          status: r.status,
          json: await r.json(),
        }))
      );

      // All returned responses must either be 201 (initial) or 200 (idempotent replay)
      for (const res of results) {
        expect([200, 201]).toContain(res.status);
        expect(res.json.slug).toBe(payload.slug);
      }

      // Check unique trial IDs returned across all 10 responses: MUST be exactly 1
      const uniqueIds = new Set(results.map((r) => r.json.id));
      expect(uniqueIds.size).toBe(1);

      // Verify DB row count is strictly 1
      const inDb = db
        .prepare("SELECT COUNT(*) as cnt FROM trials WHERE slug = ?")
        .get(payload.slug) as { cnt: number };
      expect(inDb.cnt).toBe(1);
    });

    it("replaying with altered payload under existing Idempotency-Key returns the cached original data", async () => {
      const key = "adv-idemp-altered-004";
      const originalPayload = {
        title: "Original Title",
        slug: "adv-idemp-kit-orig",
        tagline: "Original Tagline",
        price_paise: 39900,
      };

      const res1 = await createAdminTrial(
        adminReq("http://localhost/api/v1/admin/trials", {
          method: "POST",
          body: JSON.stringify(originalPayload),
          headers: { "Idempotency-Key": key },
        })
      );
      expect(res1.status).toBe(201);
      const data1 = await res1.json();
      expect(data1.title).toBe("Original Title");

      // Attempt replay with changed title and price under the same key
      const alteredPayload = {
        title: "Maliciously Altered Title",
        slug: "adv-idemp-kit-orig",
        tagline: "Altered Tagline",
        price_paise: 999900,
      };

      const res2 = await createAdminTrial(
        adminReq("http://localhost/api/v1/admin/trials", {
          method: "POST",
          body: JSON.stringify(alteredPayload),
          headers: { "Idempotency-Key": key },
        })
      );
      expect(res2.status).toBe(200);
      const data2 = await res2.json();

      // Must return cached response: original title and price preserved
      expect(data2.title).toBe("Original Title");
      expect(data2.price_paise).toBe(39900);

      // Verify DB was NOT overwritten
      const row = db.prepare("SELECT title, price_paise FROM trials WHERE id = ?").get(data1.id) as {
        title: string;
        price_paise: number;
      };
      expect(row.title).toBe("Original Title");
      expect(row.price_paise).toBe(39900);
    });

    it("replaying duplicate slug without Idempotency-Key returns HTTP 409 Conflict", async () => {
      const payload = {
        title: "Non Idempotent Duplicate",
        slug: "adv-no-idemp-dup",
        tagline: "First",
        price_paise: 45000,
      };

      const res1 = await createAdminTrial(
        adminReq("http://localhost/api/v1/admin/trials", {
          method: "POST",
          body: JSON.stringify(payload),
        })
      );
      expect(res1.status).toBe(201);

      // Second request without Idempotency-Key should collide on unique slug constraint
      const res2 = await createAdminTrial(
        adminReq("http://localhost/api/v1/admin/trials", {
          method: "POST",
          body: JSON.stringify(payload),
        })
      );
      expect(res2.status).toBe(409);
      const err = await res2.json();
      expect(err).toHaveProperty("error");
    });

    it("handles exotic and high-entropy Idempotency-Key values (UUID, base64, special symbols)", async () => {
      const keys = [
        "adv-uuid-e4eaaaf2-d142-11e1-b3e4-080027620cdd",
        "adv-special-key:!@#$%^&*()_+=-~",
        "adv-base64-aHR0cHM6Ly90ZWFmbG93dy5jb20vdHJpYWxzL3Rlc3Q=",
      ];

      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const payload = {
          title: `Exotic Key Kit ${i}`,
          slug: `adv-exotic-kit-${i}`,
          price_paise: 35000,
        };

        const res1 = await createAdminTrial(
          adminReq("http://localhost/api/v1/admin/trials", {
            method: "POST",
            body: JSON.stringify(payload),
            headers: { "Idempotency-Key": key },
          })
        );
        expect(res1.status).toBe(201);
        const data1 = await res1.json();

        // Replay
        const res2 = await createAdminTrial(
          adminReq("http://localhost/api/v1/admin/trials", {
            method: "POST",
            body: JSON.stringify(payload),
            headers: { "Idempotency-Key": key },
          })
        );
        expect(res2.status).toBe(200);
        const data2 = await res2.json();
        expect(data2.id).toBe(data1.id);
      }
    });
  });

  // ==========================================================================
  // Section 3: Publish Gate HTTP 422 Unprocessable Entity
  // ==========================================================================
  describe("3. Publish Gate HTTP 422 Unprocessable Entity", () => {
    it("POST /publish on incomplete draft returns HTTP 422 with blockers array and preserves draft state", async () => {
      const trial = await createHelper("adv-gate-incomplete");
      expect(trial.status).toBe("draft");
      expect(trial.revision).toBe(1);

      // Attempt to publish immediately (missing photography, alt text, etc.)
      const res = await publishTrial(
        adminReq(`http://localhost/api/v1/admin/trials/${trial.id}/publish`, {
          method: "POST",
          body: JSON.stringify({ expected_revision: 1 }),
        }),
        p(trial.id)
      );

      expect(res.status).toBe(422);
      const body = await res.json();

      // Must return { error, blockers: string[] }
      expect(body).toHaveProperty("error");
      expect(body.error).toMatch(/blocker|cannot publish/i);
      expect(Array.isArray(body.blockers)).toBe(true);
      expect(body.blockers.length).toBeGreaterThanOrEqual(1);

      // Specific blocker verification: packaging photograph required
      const hasPackagingBlocker = body.blockers.some((b: string) =>
        /packaging|hero|photograph/i.test(b)
      );
      expect(hasPackagingBlocker).toBe(true);

      // Invariant: Trial status remains 'draft'
      const inDb = db.prepare("SELECT status, revision FROM trials WHERE id = ?").get(trial.id) as {
        status: string;
        revision: number;
      };
      expect(inDb.status).toBe("draft");
      expect(inDb.revision).toBe(1);

      // Zero rows in trial_publications
      const pubCount = db
        .prepare("SELECT COUNT(*) as cnt FROM trial_publications WHERE trial_id = ?")
        .get(trial.id) as { cnt: number };
      expect(pubCount.cnt).toBe(0);
    });

    it("GET /validate evaluates blockers without mutating and matches POST /publish blockers", async () => {
      const trial = await createHelper("adv-gate-validate");

      const valRes = await validateTrial(
        adminReq(`http://localhost/api/v1/admin/trials/${trial.id}/validate`),
        p(trial.id)
      );
      expect(valRes.status).toBe(200);
      const valBody = await valRes.json();

      expect(valBody.can_publish).toBe(false);
      expect(Array.isArray(valBody.blockers)).toBe(true);
      expect(valBody.blockers.length).toBeGreaterThan(0);

      // Call POST /publish to ensure blockers match exactly
      const pubRes = await publishTrial(
        adminReq(`http://localhost/api/v1/admin/trials/${trial.id}/publish`, {
          method: "POST",
          body: JSON.stringify({ expected_revision: 1 }),
        }),
        p(trial.id)
      );
      expect(pubRes.status).toBe(422);
      const pubBody = await pubRes.json();

      expect(pubBody.blockers).toEqual(valBody.blockers);
    });

    it("partially completing draft still blocks publication if mandatory gates fail", async () => {
      const trial = await createHelper("adv-gate-partial");

      // Attach an asset with invalid empty/short alt text
      // Note: POST /assets rejects alt text < 2 chars with HTTP 400
      const badAssetRes = await attachAsset(
        adminReq(`http://localhost/api/v1/admin/trials/${trial.id}/assets`, {
          method: "POST",
          body: JSON.stringify({
            expected_revision: 1,
            stage: "packaging",
            asset_url: "https://images.teafloww.com/trials/pkg.webp",
            alt_text: " ",
          }),
        }),
        p(trial.id)
      );
      expect(badAssetRes.status).toBe(400);

      // Attach valid asset
      const goodAssetRes = await attachAsset(
        adminReq(`http://localhost/api/v1/admin/trials/${trial.id}/assets`, {
          method: "POST",
          body: JSON.stringify({
            expected_revision: 1,
            stage: "packaging",
            asset_url: "https://images.teafloww.com/trials/pkg.webp",
            alt_text: "Exterior packaging box front",
          }),
        }),
        p(trial.id)
      );
      expect(goodAssetRes.status).toBe(200);

      // Revision is now 2
      // Components generated at draft creation have default estates.
      // If we replace components with one missing estate provenance:
      const badComponents = [
        { slot_index: 0, name: "Autumn Flush", estate: "", weight_g: 50, quantity: 1 },
        { slot_index: 1, name: "Summer Muscatel", estate: "Gopaldhara", weight_g: 50, quantity: 1 },
        { slot_index: 2, name: "Spring First", estate: "Castleton", weight_g: 50, quantity: 1 },
        { slot_index: 3, name: "Green Pearl", estate: "Okayti", weight_g: 50, quantity: 1 },
      ];

      const compRes = await replaceComponents(
        adminReq(`http://localhost/api/v1/admin/trials/${trial.id}/components`, {
          method: "PUT",
          body: JSON.stringify({
            expected_revision: 2,
            components: badComponents,
          }),
        }),
        p(trial.id)
      );
      expect(compRes.status).toBe(200);

      // Now attempt publish with revision 3
      const pubRes = await publishTrial(
        adminReq(`http://localhost/api/v1/admin/trials/${trial.id}/publish`, {
          method: "POST",
          body: JSON.stringify({ expected_revision: 3 }),
        }),
        p(trial.id)
      );
      expect(pubRes.status).toBe(422);
      const pubBody = await pubRes.json();
      expect(pubBody.blockers.some((b: string) => /estate provenance/i.test(b))).toBe(true);
    });

    it("publishes successfully (HTTP 200) once all gates are satisfied and records publication snapshot", async () => {
      // Create with all required metadata for launch gates
      const createRes = await createAdminTrial(
        adminReq("http://localhost/api/v1/admin/trials", {
          method: "POST",
          body: JSON.stringify({
            title: "Adversarial Kit Full Pass",
            slug: "adv-gate-full-pass",
            tagline: "Artisanal 4x50g tea sampler",
            description: "Handcrafted orthodox teas sourced directly from Himalayan gardens.",
            meta_title: "TeaFloww Adversarial Full Pass | 4x50g Sampler",
            meta_description: "Pure whole leaf teas with laboratory verified origin.",
            price_paise: 49900,
            inventory_quantity: 50,
            inventory_policy: "track",
          }),
        })
      );
      expect(createRes.status).toBe(201);
      const trial = await createRes.json();

      // 1. Ensure valid 4x50g components with estate provenance
      const validComponents = [
        { slot_index: 0, name: "Rohini Autumn", estate: "Rohini", weight_g: 50, quantity: 1 },
        { slot_index: 1, name: "Gopaldhara Wonder", estate: "Gopaldhara", weight_g: 50, quantity: 1 },
        { slot_index: 2, name: "Castleton Moonlight", estate: "Castleton", weight_g: 50, quantity: 1 },
        { slot_index: 3, name: "Okayti Emerald", estate: "Okayti", weight_g: 50, quantity: 1 },
      ];
      const compRes = await replaceComponents(
        adminReq(`http://localhost/api/v1/admin/trials/${trial.id}/components`, {
          method: "PUT",
          body: JSON.stringify({ expected_revision: 1, components: validComponents }),
        }),
        p(trial.id)
      );
      expect(compRes.status).toBe(200);

      // 2. Attach packaging asset
      const assetRes = await attachAsset(
        adminReq(`http://localhost/api/v1/admin/trials/${trial.id}/assets`, {
          method: "POST",
          body: JSON.stringify({
            expected_revision: 2,
            stage: "packaging",
            asset_url: "https://images.teafloww.com/trials/full-pass-pkg.webp",
            alt_text: "Packaging box with airtight seal",
          }),
        }),
        p(trial.id)
      );
      expect(assetRes.status).toBe(200);

      // 3. Move to in_review
      const reviewRes = await submitReview(
        adminReq(`http://localhost/api/v1/admin/trials/${trial.id}/submit-review`, {
          method: "POST",
          body: JSON.stringify({ expected_revision: 3 }),
        }),
        p(trial.id)
      );
      expect(reviewRes.status).toBe(200);

      // 4. Validate readiness
      const valRes = await validateTrial(
        adminReq(`http://localhost/api/v1/admin/trials/${trial.id}/validate`),
        p(trial.id)
      );
      const valBody = await valRes.json();
      expect(valBody.can_publish).toBe(true);
      expect(valBody.blockers).toHaveLength(0);

      // 5. POST /publish succeeds with HTTP 200
      const pubRes = await publishTrial(
        adminReq(`http://localhost/api/v1/admin/trials/${trial.id}/publish`, {
          method: "POST",
          body: JSON.stringify({ expected_revision: 4 }),
        }),
        p(trial.id)
      );
      expect(pubRes.status).toBe(200);
      const pubBody = await pubRes.json();
      expect(pubBody.status).toBe("published");
      expect(pubBody.revision).toBe(5);

      // Verify publication snapshot in DB
      const snapshot = db
        .prepare("SELECT * FROM trial_publications WHERE trial_id = ? AND is_active = 1")
        .get(trial.id) as { snapshot_json: string; revision: number };
      expect(snapshot).toBeDefined();
      expect(snapshot.revision).toBe(5);
      const parsedSnapshot = JSON.parse(snapshot.snapshot_json);
      expect(parsedSnapshot.title).toBe("Adversarial Kit Full Pass");

      // 6. Attempting to publish again on already published trial fails
      const duplicatePub = await publishTrial(
        adminReq(`http://localhost/api/v1/admin/trials/${trial.id}/publish`, {
          method: "POST",
          body: JSON.stringify({ expected_revision: 5 }),
        }),
        p(trial.id)
      );
      expect(duplicatePub.status).toBe(409);
    });

    it("Gate 2 blocker: compare_at_price_paise < price_paise blocks publication with HTTP 422", async () => {
      const createRes = await createAdminTrial(
        adminReq("http://localhost/api/v1/admin/trials", {
          method: "POST",
          body: JSON.stringify({
            title: "Compare Price Kit",
            slug: "adv-gate-compare-err",
            tagline: "Invalid discount",
            description: "Selling price higher than compare-at price.",
            price_paise: 50000,
            compare_at_price_paise: 40000, // ILLEGAL: compare_at < price
            inventory_quantity: 50,
            inventory_policy: "track",
          }),
        })
      );
      const trial = await createRes.json();

      // Attach asset
      await attachAsset(
        adminReq(`http://localhost/api/v1/admin/trials/${trial.id}/assets`, {
          method: "POST",
          body: JSON.stringify({
            expected_revision: 1,
            stage: "packaging",
            asset_url: "https://images.teafloww.com/trials/compare-pkg.webp",
            alt_text: "Clean box",
          }),
        }),
        p(trial.id)
      );

      const pubRes = await publishTrial(
        adminReq(`http://localhost/api/v1/admin/trials/${trial.id}/publish`, {
          method: "POST",
          body: JSON.stringify({ expected_revision: 2 }),
        }),
        p(trial.id)
      );
      expect(pubRes.status).toBe(422);
      const pubBody = await pubRes.json();
      expect(pubBody.blockers.some((b: string) => /compare-at price/i.test(b))).toBe(true);
    });

    it("Gate 5 blocker: unverified claims block publication with HTTP 422", async () => {
      const createRes = await createAdminTrial(
        adminReq("http://localhost/api/v1/admin/trials", {
          method: "POST",
          body: JSON.stringify({
            title: "Unverified Claims Kit",
            slug: "adv-gate-claims-err",
            tagline: "Unsubstantiated claims test",
            description: "Must provide verifiable evidence for claims.",
            price_paise: 50000,
            inventory_quantity: 50,
            inventory_policy: "track",
          }),
        })
      );
      const trial = await createRes.json();

      // Insert unverified claim directly into trial_claims
      db.prepare(`
        INSERT INTO trial_claims (
          id, trial_id, claim_type, label, claim_text, verified, evidence_ref
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run("claim-adv-1", trial.id, "origin", "GI Tagged", "Certified Darjeeling", 0, "");

      // Attach asset
      await attachAsset(
        adminReq(`http://localhost/api/v1/admin/trials/${trial.id}/assets`, {
          method: "POST",
          body: JSON.stringify({
            expected_revision: 1,
            stage: "packaging",
            asset_url: "https://images.teafloww.com/trials/claims-pkg.webp",
            alt_text: "Airtight tin packaging",
          }),
        }),
        p(trial.id)
      );

      const pubRes = await publishTrial(
        adminReq(`http://localhost/api/v1/admin/trials/${trial.id}/publish`, {
          method: "POST",
          body: JSON.stringify({ expected_revision: 2 }),
        }),
        p(trial.id)
      );
      expect(pubRes.status).toBe(422);
      const pubBody = await pubRes.json();
      expect(pubBody.blockers.some((b: string) => /claims must have verified evidence/i.test(b))).toBe(true);
    });
  });

  // ==========================================================================
  // Section 4: Component Weight Invariant (4x50g=200g) & 422 Handling
  // ==========================================================================
  describe("4. Component Weight Invariant (4x50g=200g)", () => {
    it("rejects PUT /components with HTTP 422 when sum != 200g or count != 4", async () => {
      const trial = await createHelper("adv-weight-invariant");

      // 3 components (150g)
      const res3 = await replaceComponents(
        adminReq(`http://localhost/api/v1/admin/trials/${trial.id}/components`, {
          method: "PUT",
          body: JSON.stringify({
            expected_revision: 1,
            components: [
              { slot_index: 0, name: "Tea 1", estate: "E1", weight_g: 50, quantity: 1 },
              { slot_index: 1, name: "Tea 2", estate: "E2", weight_g: 50, quantity: 1 },
              { slot_index: 2, name: "Tea 3", estate: "E3", weight_g: 50, quantity: 1 },
            ],
          }),
        }),
        p(trial.id)
      );
      expect(res3.status).toBe(422);
      const err3 = await res3.json();
      expect(err3.error).toMatch(/4 sachets|200g/i);

      // 5 components (250g)
      const res5 = await replaceComponents(
        adminReq(`http://localhost/api/v1/admin/trials/${trial.id}/components`, {
          method: "PUT",
          body: JSON.stringify({
            expected_revision: 1,
            components: [
              { slot_index: 0, name: "Tea 1", estate: "E1", weight_g: 50, quantity: 1 },
              { slot_index: 1, name: "Tea 2", estate: "E2", weight_g: 50, quantity: 1 },
              { slot_index: 2, name: "Tea 3", estate: "E3", weight_g: 50, quantity: 1 },
              { slot_index: 3, name: "Tea 4", estate: "E4", weight_g: 50, quantity: 1 },
              { slot_index: 4, name: "Tea 5", estate: "E5", weight_g: 50, quantity: 1 },
            ],
          }),
        }),
        p(trial.id)
      );
      expect(res5.status).toBe(422);

      // 4 components summing to 200g but non-50g weights: [40g, 60g, 50g, 50g]
      const resUnbalanced = await replaceComponents(
        adminReq(`http://localhost/api/v1/admin/trials/${trial.id}/components`, {
          method: "PUT",
          body: JSON.stringify({
            expected_revision: 1,
            components: [
              { slot_index: 0, name: "Tea 1", estate: "E1", weight_g: 40, quantity: 1 },
              { slot_index: 1, name: "Tea 2", estate: "E2", weight_g: 60, quantity: 1 },
              { slot_index: 2, name: "Tea 3", estate: "E3", weight_g: 50, quantity: 1 },
              { slot_index: 3, name: "Tea 4", estate: "E4", weight_g: 50, quantity: 1 },
            ],
          }),
        }),
        p(trial.id)
      );
      expect(resUnbalanced.status).toBe(422);
      const errUnbalanced = await resUnbalanced.json();
      expect(errUnbalanced.error).toMatch(/50g/i);

      // Verify trial revision in DB did NOT change
      const inDb = db.prepare("SELECT revision FROM trials WHERE id = ?").get(trial.id) as { revision: number };
      expect(inDb.revision).toBe(1);
    });
  });

  // ==========================================================================
  // Section 5: Security, Authentication, Input Validation & Public Protection
  // ==========================================================================
  describe("5. Security, Authentication & Public Protection", () => {
    it("strictly blocks unauthenticated access across all 13 admin endpoints with HTTP 401", async () => {
      const dummyId = "dummy-unauth-id";
      const dummyP = p(dummyId);

      const endpoints = [
        getAdminTrials(publicReq("http://localhost/api/v1/admin/trials")),
        createAdminTrial(publicReq("http://localhost/api/v1/admin/trials", { method: "POST", body: "{}" })),
        getAdminTrial(publicReq(`http://localhost/api/v1/admin/trials/${dummyId}`), dummyP),
        updateAdminTrial(publicReq(`http://localhost/api/v1/admin/trials/${dummyId}`, { method: "PATCH", body: "{}" }), dummyP),
        deleteAdminTrial(publicReq(`http://localhost/api/v1/admin/trials/${dummyId}`, { method: "DELETE" }), dummyP),
        replaceComponents(publicReq(`http://localhost/api/v1/admin/trials/${dummyId}/components`, { method: "PUT", body: "{}" }), dummyP),
        attachAsset(publicReq(`http://localhost/api/v1/admin/trials/${dummyId}/assets`, { method: "POST", body: "{}" }), dummyP),
        detachAsset(publicReq(`http://localhost/api/v1/admin/trials/${dummyId}/assets`, { method: "DELETE" }), dummyP),
        validateTrial(publicReq(`http://localhost/api/v1/admin/trials/${dummyId}/validate`), dummyP),
        submitReview(publicReq(`http://localhost/api/v1/admin/trials/${dummyId}/submit-review`, { method: "POST", body: "{}" }), dummyP),
        publishTrial(publicReq(`http://localhost/api/v1/admin/trials/${dummyId}/publish`, { method: "POST", body: "{}" }), dummyP),
        unpublishTrial(publicReq(`http://localhost/api/v1/admin/trials/${dummyId}/unpublish`, { method: "POST", body: "{}" }), dummyP),
        archiveTrial(publicReq(`http://localhost/api/v1/admin/trials/${dummyId}/archive`, { method: "POST", body: "{}" }), dummyP),
        getTrialHistory(publicReq(`http://localhost/api/v1/admin/trials/${dummyId}/history`), dummyP),
      ];

      const responses = await Promise.all(endpoints);
      for (const res of responses) {
        expect(res.status).toBe(401);
      }
    });

    it("public PDP strictly returns HTTP 404 for draft trials, protecting confidential R&D", async () => {
      const trial = await createHelper("adv-draft-protect");

      // Public unauthenticated request to /api/v1/trials/:slug
      const res = await getPublicTrialBySlug(
        publicReq(`http://localhost/api/v1/trials/${trial.slug}`),
        slugP(trial.slug)
      );
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toMatch(/not found/i);

      // But an authenticated admin session can preview it
      const adminRes = await getPublicTrialBySlug(
        adminReq(`http://localhost/api/v1/trials/${trial.slug}`),
        slugP(trial.slug)
      );
      expect(adminRes.status).toBe(200);
      const adminJson = await adminRes.json();
      expect(adminJson.is_preview).toBe(true);
      expect(adminJson.title).toBe("Adversarial Kit");
    });

    it("whitelist public projection strictly redacts COGS, supplier information, and private notes", async () => {
      // Create and publish a trial with sensitive internal data
      const createRes = await createAdminTrial(
        adminReq("http://localhost/api/v1/admin/trials", {
          method: "POST",
          body: JSON.stringify({
            title: "Redaction Test Kit",
            slug: "adv-public-redact",
            tagline: "Testing redaction",
            description: "Detailed description for public view.",
            price_paise: 35000,
            inventory_quantity: 25,
            inventory_policy: "track",
          }),
        })
      );
      expect(createRes.status).toBe(201);
      const trial = await createRes.json();

      // Update internal fields in DB directly to simulate private admin/supplier data
      db.prepare(`
        UPDATE trials
        SET cost_paise = 25000
        WHERE id = ?
      `).run(trial.id);

      const prod = db.prepare("SELECT id FROM products LIMIT 1").get() as { id: number } | undefined;
      const variant = db.prepare("SELECT id FROM variants LIMIT 1").get() as { id: number } | undefined;
      if (prod && variant) {
        db.prepare(`
          UPDATE trial_components
          SET regular_product_id = ?,
              regular_variant_id = ?
          WHERE trial_id = ?
        `).run(prod.id, variant.id, trial.id);
      }

      // Attach asset & publish
      await attachAsset(
        adminReq(`http://localhost/api/v1/admin/trials/${trial.id}/assets`, {
          method: "POST",
          body: JSON.stringify({
            expected_revision: 1,
            stage: "packaging",
            asset_url: "https://images.teafloww.com/trials/redact-pkg.webp",
            alt_text: "Clean exterior box",
          }),
        }),
        p(trial.id)
      );

      const pubRes = await publishTrial(
        adminReq(`http://localhost/api/v1/admin/trials/${trial.id}/publish`, {
          method: "POST",
          body: JSON.stringify({ expected_revision: 2 }),
        }),
        p(trial.id)
      );
      expect(pubRes.status).toBe(200);

      // Now query public PDP
      const getRes = await getPublicTrialBySlug(
        publicReq(`http://localhost/api/v1/trials/${trial.slug}`),
        slugP(trial.slug)
      );
      expect(getRes.status).toBe(200);
      const pubData = await getRes.json();

      // Verify strict redaction
      expect(pubData.cost_paise).toBeUndefined();
      expect(pubData.admin_notes).toBeUndefined();
      expect(pubData.internal_notes).toBeUndefined();
      expect(pubData.audit).toBeUndefined();

      for (const comp of pubData.components) {
        expect(comp.cost_paise).toBeUndefined();
        expect(comp.regular_product_id).toBeUndefined();
        expect(comp.regular_variant_id).toBeUndefined();
      }
    });

    it("rejects prohibited commercial pricing (negative price) and malformed inputs with HTTP 400", async () => {
      // 1. Zero price is allowed for draft creation (pricing unfinalized until publication)
      const resZero = await createAdminTrial(
        adminReq("http://localhost/api/v1/admin/trials", {
          method: "POST",
          body: JSON.stringify({
            title: "Draft Zero Price Allowed",
            slug: "adv-price-zero",
            price_paise: 0,
          }),
        })
      );
      expect(resZero.status).toBe(201);

      // 2. Negative price
      const resNeg = await createAdminTrial(
        adminReq("http://localhost/api/v1/admin/trials", {
          method: "POST",
          body: JSON.stringify({
            title: "Negative Price Prohibited",
            slug: "adv-price-neg",
            price_paise: -500,
          }),
        })
      );
      expect(resNeg.status).toBe(400);

      // 3. Malformed JSON body
      const resBadJson = await createAdminTrial(
        adminReq("http://localhost/api/v1/admin/trials", {
          method: "POST",
          body: "{ not valid json ",
        })
      );
      expect(resBadJson.status).toBe(400);

      // 4. Empty title
      const resEmptyTitle = await createAdminTrial(
        adminReq("http://localhost/api/v1/admin/trials", {
          method: "POST",
          body: JSON.stringify({
            title: "   ",
            slug: "adv-empty-title",
            price_paise: 40000,
          }),
        })
      );
      expect(resEmptyTitle.status).toBe(400);
    });

    it("safely handles SQL injection payloads in search and route parameters without corruption", async () => {
      const sqlPayload = "adv-test' OR '1'='1' --";

      // GET /api/v1/admin/trials?search=payload
      const resSearch = await getAdminTrials(
        adminReq(`http://localhost/api/v1/admin/trials?search=${encodeURIComponent(sqlPayload)}`)
      );
      expect(resSearch.status).toBe(200);
      const searchData = await resSearch.json();
      expect(Array.isArray(searchData.trials)).toBe(true);

      // GET /api/v1/admin/trials/:id with SQL payload
      const resGet = await getAdminTrial(
        adminReq(`http://localhost/api/v1/admin/trials/${encodeURIComponent(sqlPayload)}`),
        p(sqlPayload)
      );
      expect(resGet.status).toBe(404);
    });

    it("blocks deletion of published trials with HTTP 400", async () => {
      // Create launch-ready trial
      const createRes = await createAdminTrial(
        adminReq("http://localhost/api/v1/admin/trials", {
          method: "POST",
          body: JSON.stringify({
            title: "Published Trial Protection",
            slug: "adv-del-published",
            tagline: "Trial to test delete guard",
            description: "Cannot be deleted once published.",
            price_paise: 30000,
            inventory_quantity: 10,
            inventory_policy: "track",
          }),
        })
      );
      expect(createRes.status).toBe(201);
      const trial = await createRes.json();

      // Setup and publish
      const assetRes = await attachAsset(
        adminReq(`http://localhost/api/v1/admin/trials/${trial.id}/assets`, {
          method: "POST",
          body: JSON.stringify({
            expected_revision: 1,
            stage: "packaging",
            asset_url: "https://images.teafloww.com/trials/del-pkg.webp",
            alt_text: "Packaging box",
          }),
        }),
        p(trial.id)
      );
      expect(assetRes.status).toBe(200);

      const pubRes = await publishTrial(
        adminReq(`http://localhost/api/v1/admin/trials/${trial.id}/publish`, {
          method: "POST",
          body: JSON.stringify({ expected_revision: 2 }),
        }),
        p(trial.id)
      );
      expect(pubRes.status).toBe(200);

      // Attempt DELETE on published trial
      const delRes = await deleteAdminTrial(
        adminReq(`http://localhost/api/v1/admin/trials/${trial.id}`, { method: "DELETE" }),
        p(trial.id)
      );
      expect(delRes.status).toBe(400);
      const delBody = await delRes.json();
      expect(delBody.error).toMatch(/cannot delete a published trial/i);

      // DB verification: still present and published
      const inDb = db.prepare("SELECT status FROM trials WHERE id = ?").get(trial.id) as { status: string };
      expect(inDb.status).toBe("published");
    });

    it("handles non-numeric or malformed expected_revision gracefully without 500 crashes", async () => {
      const trial = await createHelper("adv-malformed-rev");

      // Passing string "not_a_number" as expected_revision in PATCH
      const resNaN = await updateAdminTrial(
        adminReq(`http://localhost/api/v1/admin/trials/${trial.id}`, {
          method: "PATCH",
          body: JSON.stringify({ expected_revision: "not_a_number", title: "NaN Rev" }),
        }),
        p(trial.id)
      );
      // Either 400 (validation failure) or 409 (revision conflict NaN !== 1)
      expect([400, 409]).toContain(resNaN.status);
      expect(resNaN.status).toBeLessThan(500);

      // In PUT components: passing string expected_revision
      const resCompNaN = await replaceComponents(
        adminReq(`http://localhost/api/v1/admin/trials/${trial.id}/components`, {
          method: "PUT",
          body: JSON.stringify({
            expected_revision: "not_a_number",
            components: [
              { slot_index: 0, name: "Tea 1", estate: "E1", weight_g: 50, quantity: 1 },
              { slot_index: 1, name: "Tea 2", estate: "E2", weight_g: 50, quantity: 1 },
              { slot_index: 2, name: "Tea 3", estate: "E3", weight_g: 50, quantity: 1 },
              { slot_index: 3, name: "Tea 4", estate: "E4", weight_g: 50, quantity: 1 },
            ],
          }),
        }),
        p(trial.id)
      );
      expect([400, 409, 422]).toContain(resCompNaN.status);
      expect(resCompNaN.status).toBeLessThan(500);
    });
  });
});
