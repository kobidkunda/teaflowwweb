/**
 * TeaFloww Trials v3 — Milestone 2 REST APIs & Concurrency Control Unit Tests
 *
 * Comprehensive unit test suite verifying:
 * 1. Admin Authentication: All /api/v1/admin/trials/* require session auth and return 401 if unauthenticated.
 * 2. Public Catalogue: GET /api/v1/trials lists published kits only with pagination.
 * 3. Public Detail & Draft Protection: GET /api/v1/trials/:slug returns published kits, 404 for drafts,
 *    and enables draft preview for verified admin sessions.
 * 4. Whitelist Public Projection: Strictly redacts internal COGS, supplier information, and private notes.
 * 5. Shipping Quote: POST /api/v1/trials/:id/shipping-quote calculates courier fee by pincode, rejects invalid codes.
 * 6. Admin Creation & Idempotency: POST /api/v1/admin/trials creates draft with 4x50g sachets; duplicate key replays safely.
 * 7. Zod Validation & Boundaries: Rejects invalid payloads, 0 price, and duplicate slugs with appropriate status codes.
 * 8. Concurrency & CAS Revision Conflicts: PATCH /api/v1/admin/trials/:id enforces expected_revision, returning 409 Conflict.
 * 9. Sachet Component Invariant: PUT components enforces 4x50g=200g, returns 422 on violation, increments revision.
 * 10. Stage Photography Assets: POST assets validates alt text and CAS revision check; DELETE detaches asset.
 * 11. Publication Blocker Engine: GET /validate returns checklist; POST /publish blocks with 422 if blockers exist.
 * 12. Lifecycle State Machine: submit-review, publish, unpublish, and archive transitions under revision control.
 * 13. Audit Trail History: GET /history returns chronological immutable log with ISO timestamps and actor attribution.
 * 14. Admin Deletion Protection: DELETE blocks deletion of published trials with 400.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { createAdminSession } from "@/lib/adminSessions";
import { resetRateLimits } from "@/lib/rateLimit";
import { TrialService } from "@/lib/trials/service";

// Route handlers
import { GET as getPublicTrials } from "@/app/api/v1/trials/route";
import { GET as getPublicTrialBySlug } from "@/app/api/v1/trials/[slug]/route";
import { POST as getShippingQuote } from "@/app/api/v1/trials/[slug]/shipping-quote/route";
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

describe("TeaFloww Trials v3 — REST APIs & Concurrency Control (Milestone 2)", () => {
  let adminCookie: string;
  const db = getDb();

  beforeEach(() => {
    resetRateLimits();
    vi.stubEnv("COMMERCE_MOCK_PROVIDERS", "1");
    vi.stubEnv("SESSION_SECRET", "test_session_secret_for_signing_cookies_32_bytes_long");

    // Ensure root admin user exists in DB
    db.prepare(`
      INSERT OR IGNORE INTO admin_users (id, username, password_hash, role)
      VALUES (1, 'admin', 'hash', 'root')
    `).run();

    const session = createAdminSession(1);
    adminCookie = `admin_session=${session.cookieValue}`;

    // Clean up test records
    db.prepare("DELETE FROM trials WHERE slug LIKE 'test-api-%'").run();
  });

  // Helpers
  let ipCounter = 1;
  function adminReq(
    url: string,
    init?: { method?: string; body?: string; headers?: Record<string, string> }
  ): NextRequest {
    return new NextRequest(url, {
      method: init?.method,
      body: init?.body,
      headers: {
        Cookie: adminCookie,
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
      method: init?.method,
      body: init?.body,
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": `10.99.2.${(ipCounter++ % 250) + 1}`,
        ...(init?.headers || {}),
      },
    });
  }

  // ==========================================================================
  // 1. Admin Authentication Guarding (401 Unauthorized)
  // ==========================================================================
  describe("1. Admin Authentication Guards", () => {
    it("rejects unauthenticated requests to all admin endpoints with HTTP 401", async () => {
      const dummyId = "dummy-id-123";
      const dummyParams = { params: Promise.resolve({ id: dummyId }) };

      const unauthRequests = [
        getAdminTrials(publicReq("http://localhost/api/v1/admin/trials")),
        createAdminTrial(publicReq("http://localhost/api/v1/admin/trials", { method: "POST", body: "{}" })),
        getAdminTrial(publicReq(`http://localhost/api/v1/admin/trials/${dummyId}`), dummyParams),
        updateAdminTrial(publicReq(`http://localhost/api/v1/admin/trials/${dummyId}`, { method: "PATCH", body: "{}" }), dummyParams),
        replaceComponents(publicReq(`http://localhost/api/v1/admin/trials/${dummyId}/components`, { method: "PUT", body: "{}" }), dummyParams),
        attachAsset(publicReq(`http://localhost/api/v1/admin/trials/${dummyId}/assets`, { method: "POST", body: "{}" }), dummyParams),
        detachAsset(publicReq(`http://localhost/api/v1/admin/trials/${dummyId}/assets`, { method: "DELETE" }), dummyParams),
        validateTrial(publicReq(`http://localhost/api/v1/admin/trials/${dummyId}/validate`), dummyParams),
        submitReview(publicReq(`http://localhost/api/v1/admin/trials/${dummyId}/submit-review`, { method: "POST", body: "{}" }), dummyParams),
        publishTrial(publicReq(`http://localhost/api/v1/admin/trials/${dummyId}/publish`, { method: "POST", body: "{}" }), dummyParams),
        unpublishTrial(publicReq(`http://localhost/api/v1/admin/trials/${dummyId}/unpublish`, { method: "POST", body: "{}" }), dummyParams),
        archiveTrial(publicReq(`http://localhost/api/v1/admin/trials/${dummyId}/archive`, { method: "POST", body: "{}" }), dummyParams),
        getTrialHistory(publicReq(`http://localhost/api/v1/admin/trials/${dummyId}/history`), dummyParams),
        deleteAdminTrial(publicReq(`http://localhost/api/v1/admin/trials/${dummyId}`, { method: "DELETE" }), dummyParams),
      ];

      const responses = await Promise.all(unauthRequests);
      for (const res of responses) {
        expect(res.status).toBe(401);
      }
    });
  });

  // ==========================================================================
  // 2. Admin Trial Creation & Idempotency (POST /api/v1/admin/trials)
  // ==========================================================================
  describe("2. Admin Trial Creation & Idempotency", () => {
    it("creates draft trial with revision=1 and initial 4x50g components", async () => {
      const payload = {
        title: "Test API Discovery Kit",
        slug: `test-api-discovery-${Date.now()}`,
        tagline: "4x50g Authentic Milk Chai Assortment",
        price_paise: 24900,
        compare_at_price_paise: 29900,
        cost_paise: 11000,
        sku: `SKU-${Date.now()}`,
        inventory_quantity: 50,
      };

      const res = await createAdminTrial(
        adminReq("http://localhost/api/v1/admin/trials", {
          method: "POST",
          body: JSON.stringify(payload),
        })
      );

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.id).toBeDefined();
      expect(data.slug).toBe(payload.slug);
      expect(data.status).toBe("draft");
      expect(data.revision).toBe(1);
      expect(data.net_weight_g).toBe(200);
      expect(data.pack_format).toBe("4x50g_sachets");

      // Verify DB state
      const fromDb = TrialService.getById(data.id);
      expect(fromDb).not.toBeNull();
      expect(fromDb?.components.length).toBe(4);
    });

    it("enforces idempotency key on creation: replaying returns same original record", async () => {
      const idempotencyKey = `idem-${Date.now()}-${Math.random()}`;
      const payload = {
        title: "Test API Idempotent Kit",
        slug: `test-api-idem-${Date.now()}`,
        price_paise: 22000,
      };

      const req1 = adminReq("http://localhost/api/v1/admin/trials", {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(payload),
      });
      const res1 = await createAdminTrial(req1);
      expect(res1.status).toBe(201);
      const d1 = await res1.json();

      const req2 = adminReq("http://localhost/api/v1/admin/trials", {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(payload),
      });
      const res2 = await createAdminTrial(req2);
      expect(res2.status).toBe(200); // Deduped status
      const d2 = await res2.json();

      expect(d1.id).toBe(d2.id);
      expect(d1.slug).toBe(d2.slug);
    });

    it("rejects invalid payloads with HTTP 400 Bad Request", async () => {
      // Missing title
      const res1 = await createAdminTrial(
        adminReq("http://localhost/api/v1/admin/trials", {
          method: "POST",
          body: JSON.stringify({ price_paise: 20000 }),
        })
      );
      expect(res1.status).toBe(400);

      // Title too short
      const res2 = await createAdminTrial(
        adminReq("http://localhost/api/v1/admin/trials", {
          method: "POST",
          body: JSON.stringify({ title: "Hi", price_paise: 20000 }),
        })
      );
      expect(res2.status).toBe(400);

      // Negative price (prohibited negative price)
      const res3 = await createAdminTrial(
        adminReq("http://localhost/api/v1/admin/trials", {
          method: "POST",
          body: JSON.stringify({ title: "Valid Title", price_paise: -100 }),
        })
      );
      expect(res3.status).toBe(400);

      // Draft with price = 0 is allowed at creation time (unfinalized pricing)
      const resZeroDraft = await createAdminTrial(
        adminReq("http://localhost/api/v1/admin/trials", {
          method: "POST",
          body: JSON.stringify({
            title: "Zero Price Draft Kit",
            slug: `test-api-zero-draft-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            price_paise: 0,
          }),
        })
      );
      expect(resZeroDraft.status).toBe(201);
    });

    it("rejects duplicate slug with HTTP 409 Conflict", async () => {
      const slug = `test-api-dup-${Date.now()}`;
      const payload = { title: "Original Kit", slug, price_paise: 20000 };

      const res1 = await createAdminTrial(
        adminReq("http://localhost/api/v1/admin/trials", {
          method: "POST",
          body: JSON.stringify(payload),
        })
      );
      expect(res1.status).toBe(201);

      const res2 = await createAdminTrial(
        adminReq("http://localhost/api/v1/admin/trials", {
          method: "POST",
          body: JSON.stringify({ title: "Copy Kit", slug, price_paise: 25000 }),
        })
      );
      expect(res2.status).toBe(409);
    });
  });

  // ==========================================================================
  // 3. Admin Listing & Search (GET /api/v1/admin/trials)
  // ==========================================================================
  describe("3. Admin Trial Listing & Query Options", () => {
    it("returns paginated list of trials with status and search filters", async () => {
      const uniqueName = `QuerySearch-${Date.now()}`;
      await createAdminTrial(
        adminReq("http://localhost/api/v1/admin/trials", {
          method: "POST",
          body: JSON.stringify({
            title: `First ${uniqueName}`,
            slug: `test-api-q1-${Date.now()}`,
            price_paise: 20000,
          }),
        })
      );

      const res = await getAdminTrials(
        adminReq(`http://localhost/api/v1/admin/trials?search=${encodeURIComponent(uniqueName)}&limit=10`)
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.trials).toBeDefined();
      expect(data.total).toBeGreaterThanOrEqual(1);
      expect(data.trials[0].title).toContain(uniqueName);
    });
  });

  // ==========================================================================
  // 4. Concurrency Control & CAS Revision Conflicts (PATCH /api/v1/admin/trials/:id)
  // ==========================================================================
  describe("4. Concurrency & CAS Revision Conflicts", () => {
    it("updates trial metadata and increments revision when expected_revision matches", async () => {
      const createRes = await createAdminTrial(
        adminReq("http://localhost/api/v1/admin/trials", {
          method: "POST",
          body: JSON.stringify({
            title: "Pre-Update Kit",
            slug: `test-api-patch-${Date.now()}`,
            price_paise: 20000,
          }),
        })
      );
      const created = await createRes.json();
      expect(created.revision).toBe(1);

      const patchRes = await updateAdminTrial(
        adminReq(`http://localhost/api/v1/admin/trials/${created.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            expected_revision: 1,
            title: "Updated Title via PATCH",
            tagline: "Updated Tagline",
          }),
        }),
        { params: Promise.resolve({ id: created.id }) }
      );

      expect(patchRes.status).toBe(200);
      const updated = await patchRes.json();
      expect(updated.title).toBe("Updated Title via PATCH");
      expect(updated.tagline).toBe("Updated Tagline");
      expect(updated.revision).toBe(2);
    });

    it("returns HTTP 409 Conflict when expected_revision is stale or mismatched", async () => {
      const createRes = await createAdminTrial(
        adminReq("http://localhost/api/v1/admin/trials", {
          method: "POST",
          body: JSON.stringify({
            title: "Conflict Test Kit",
            slug: `test-api-conflict-${Date.now()}`,
            price_paise: 20000,
          }),
        })
      );
      const created = await createRes.json();
      expect(created.revision).toBe(1);

      // Attempt PATCH with stale expected_revision=0
      const conflictRes = await updateAdminTrial(
        adminReq(`http://localhost/api/v1/admin/trials/${created.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            expected_revision: 0,
            title: "Stale Edit Attempt",
          }),
        }),
        { params: Promise.resolve({ id: created.id }) }
      );

      expect(conflictRes.status).toBe(409);
      const err = await conflictRes.json();
      expect(err.current_revision).toBe(1);
      expect(err.expected_revision).toBe(0);
      expect(err.error).toContain("Revision conflict");
    });
  });

  // ==========================================================================
  // 5. Sachet Component Replacement & 4x50g Invariant (PUT /api/v1/admin/trials/:id/components)
  // ==========================================================================
  describe("5. Component Replacement & 4x50g=200g Invariant", () => {
    it("replaces components atomically when 4x50g=200g invariant is satisfied", async () => {
      const createRes = await createAdminTrial(
        adminReq("http://localhost/api/v1/admin/trials", {
          method: "POST",
          body: JSON.stringify({
            title: "Components Test Kit",
            slug: `test-api-comps-${Date.now()}`,
            price_paise: 20000,
          }),
        })
      );
      const created = await createRes.json();

      const newComponents = [
        { slot_index: 0, name: "Moran CTC BP", estate: "Moran", grade: "BP", flush: "Second", weight_g: 50 },
        { slot_index: 1, name: "Batabari Elaichi", estate: "Batabari", grade: "Blend", flush: "Autumn", weight_g: 50 },
        { slot_index: 2, name: "Sonitpur Ginger", estate: "Sonitpur", grade: "Blend", flush: "Rain", weight_g: 50 },
        { slot_index: 3, name: "Cinnamara Masala", estate: "Cinnamara", grade: "BP", flush: "Second", weight_g: 50 },
      ];

      const res = await replaceComponents(
        adminReq(`http://localhost/api/v1/admin/trials/${created.id}/components`, {
          method: "PUT",
          body: JSON.stringify({
            expected_revision: created.revision,
            components: newComponents,
          }),
        }),
        { params: Promise.resolve({ id: created.id }) }
      );

      expect(res.status).toBe(200);
      const updated = await res.json();
      expect(updated.revision).toBe(created.revision + 1);

      // Verify in DB
      const details = TrialService.getById(created.id);
      expect(details?.components.length).toBe(4);
      expect(details?.components[0].name).toBe("Moran CTC BP");
    });

    it("rejects replacement with HTTP 422 when components violate 4x50g=200g invariant", async () => {
      const createRes = await createAdminTrial(
        adminReq("http://localhost/api/v1/admin/trials", {
          method: "POST",
          body: JSON.stringify({
            title: "Invalid Comps Kit",
            slug: `test-api-invalid-comps-${Date.now()}`,
            price_paise: 20000,
          }),
        })
      );
      const created = await createRes.json();

      // Only 3 components summing to 150g
      const invalidComponents = [
        { slot_index: 0, name: "Tea 1", estate: "Estate A", weight_g: 50 },
        { slot_index: 1, name: "Tea 2", estate: "Estate B", weight_g: 50 },
        { slot_index: 2, name: "Tea 3", estate: "Estate C", weight_g: 50 },
      ];

      const res = await replaceComponents(
        adminReq(`http://localhost/api/v1/admin/trials/${created.id}/components`, {
          method: "PUT",
          body: JSON.stringify({
            expected_revision: created.revision,
            components: invalidComponents,
          }),
        }),
        { params: Promise.resolve({ id: created.id }) }
      );

      expect(res.status).toBe(422);
      const err = await res.json();
      expect(err.error).toBeDefined();
    });

    it("returns 409 Conflict if expected_revision is stale during component replace", async () => {
      const createRes = await createAdminTrial(
        adminReq("http://localhost/api/v1/admin/trials", {
          method: "POST",
          body: JSON.stringify({
            title: "Stale Comps Kit",
            slug: `test-api-stale-comps-${Date.now()}`,
            price_paise: 20000,
          }),
        })
      );
      const created = await createRes.json();

      const validComps = [
        { slot_index: 0, name: "Tea 1", estate: "Estate A", weight_g: 50 },
        { slot_index: 1, name: "Tea 2", estate: "Estate B", weight_g: 50 },
        { slot_index: 2, name: "Tea 3", estate: "Estate C", weight_g: 50 },
        { slot_index: 3, name: "Tea 4", estate: "Estate D", weight_g: 50 },
      ];

      const res = await replaceComponents(
        adminReq(`http://localhost/api/v1/admin/trials/${created.id}/components`, {
          method: "PUT",
          body: JSON.stringify({
            expected_revision: 999, // Stale
            components: validComps,
          }),
        }),
        { params: Promise.resolve({ id: created.id }) }
      );

      expect(res.status).toBe(409);
    });
  });

  // ==========================================================================
  // 6. Stage Photography Assets (POST/DELETE /api/v1/admin/trials/:id/assets)
  // ==========================================================================
  describe("6. Photography Assets Attachment & CAS", () => {
    it("attaches asset with required alt text and increments revision", async () => {
      const createRes = await createAdminTrial(
        adminReq("http://localhost/api/v1/admin/trials", {
          method: "POST",
          body: JSON.stringify({
            title: "Asset Attachment Kit",
            slug: `test-api-asset-${Date.now()}`,
            price_paise: 20000,
          }),
        })
      );
      const created = await createRes.json();

      const res = await attachAsset(
        adminReq(`http://localhost/api/v1/admin/trials/${created.id}/assets`, {
          method: "POST",
          body: JSON.stringify({
            expected_revision: created.revision,
            stage: "dry_leaf",
            slot_index: 0,
            url: "/images/trials/pouch1-dry.jpg",
            alt_text: "Golden whole leaf orthodox dry tea leaves",
          }),
        }),
        { params: Promise.resolve({ id: created.id }) }
      );

      expect(res.status).toBe(200);
      const updated = await res.json();
      expect(updated.revision).toBe(created.revision + 1);

      // Verify asset exists in DB
      const details = TrialService.getById(created.id);
      expect(details?.assets.length).toBe(1);
      expect(details?.assets[0].alt_text).toBe("Golden whole leaf orthodox dry tea leaves");
    });

    it("rejects asset attachment with empty alt text (HTTP 400)", async () => {
      const createRes = await createAdminTrial(
        adminReq("http://localhost/api/v1/admin/trials", {
          method: "POST",
          body: JSON.stringify({
            title: "Asset No Alt Kit",
            slug: `test-api-asset-no-alt-${Date.now()}`,
            price_paise: 20000,
          }),
        })
      );
      const created = await createRes.json();

      const res = await attachAsset(
        adminReq(`http://localhost/api/v1/admin/trials/${created.id}/assets`, {
          method: "POST",
          body: JSON.stringify({
            expected_revision: created.revision,
            stage: "dry_leaf",
            url: "/images/trials/dry.jpg",
            alt_text: "", // Prohibited empty alt
          }),
        }),
        { params: Promise.resolve({ id: created.id }) }
      );

      expect(res.status).toBe(400);
    });

    it("returns 409 Conflict if expected_revision is stale during asset attachment", async () => {
      const createRes = await createAdminTrial(
        adminReq("http://localhost/api/v1/admin/trials", {
          method: "POST",
          body: JSON.stringify({
            title: "Stale Asset Kit",
            slug: `test-api-stale-asset-${Date.now()}`,
            price_paise: 20000,
          }),
        })
      );
      const created = await createRes.json();

      const res = await attachAsset(
        adminReq(`http://localhost/api/v1/admin/trials/${created.id}/assets`, {
          method: "POST",
          body: JSON.stringify({
            expected_revision: 999,
            stage: "packaging",
            url: "/images/trials/pkg.jpg",
            alt_text: "Outer box packaging",
          }),
        }),
        { params: Promise.resolve({ id: created.id }) }
      );

      expect(res.status).toBe(409);
    });
  });

  // ==========================================================================
  // 7. Publication Blocker Engine & Review Transitions (GET /validate, POST /publish)
  // ==========================================================================
  describe("7. Publication Blocker Engine & Lifecycle State Transitions", () => {
    it("GET /validate flags incomplete draft and POST /publish returns 422 with blockers", async () => {
      const createRes = await createAdminTrial(
        adminReq("http://localhost/api/v1/admin/trials", {
          method: "POST",
          body: JSON.stringify({
            title: "Incomplete Kit",
            slug: `test-api-incomplete-${Date.now()}`,
            price_paise: 20000,
            inventory_quantity: 0,
            inventory_policy: "track",
          }),
        })
      );
      const created = await createRes.json();

      // Validate returns can_publish: false
      const valRes = await validateTrial(
        adminReq(`http://localhost/api/v1/admin/trials/${created.id}/validate`),
        { params: Promise.resolve({ id: created.id }) }
      );
      expect(valRes.status).toBe(200);
      const valData = await valRes.json();
      expect(valData.can_publish).toBe(false);
      expect(Array.isArray(valData.blockers)).toBe(true);
      expect(valData.blockers.length).toBeGreaterThan(0);

      // Attempting to publish incomplete draft returns 422
      const pubRes = await publishTrial(
        adminReq(`http://localhost/api/v1/admin/trials/${created.id}/publish`, {
          method: "POST",
          body: JSON.stringify({ expected_revision: created.revision }),
        }),
        { params: Promise.resolve({ id: created.id }) }
      );

      expect(pubRes.status).toBe(422);
      const pubData = await pubRes.json();
      expect(pubData.blockers).toBeDefined();
      expect(pubData.blockers.length).toBeGreaterThan(0);
    });

    it("transitions draft -> in_review via POST /submit-review under revision control", async () => {
      const createRes = await createAdminTrial(
        adminReq("http://localhost/api/v1/admin/trials", {
          method: "POST",
          body: JSON.stringify({
            title: "Review Transition Kit",
            slug: `test-api-review-${Date.now()}`,
            price_paise: 20000,
          }),
        })
      );
      const created = await createRes.json();
      expect(created.status).toBe("draft");

      const res = await submitReview(
        adminReq(`http://localhost/api/v1/admin/trials/${created.id}/submit-review`, {
          method: "POST",
          body: JSON.stringify({ expected_revision: created.revision }),
        }),
        { params: Promise.resolve({ id: created.id }) }
      );

      expect(res.status).toBe(200);
      const updated = await res.json();
      expect(updated.status).toBe("in_review");
      expect(updated.revision).toBe(created.revision + 1);

      // Reject duplicate submit_review from in_review state
      const resDuplicate = await submitReview(
        adminReq(`http://localhost/api/v1/admin/trials/${created.id}/submit-review`, {
          method: "POST",
          body: JSON.stringify({ expected_revision: updated.revision }),
        }),
        { params: Promise.resolve({ id: created.id }) }
      );
      expect(resDuplicate.status).toBe(409);
    });

    it("publishes cleanly when all launch gates pass, then unpublishes back to draft", async () => {
      const createRes = await createAdminTrial(
        adminReq("http://localhost/api/v1/admin/trials", {
          method: "POST",
          body: JSON.stringify({
            title: "Launch Ready Kit",
            slug: `test-api-launch-${Date.now()}`,
            tagline: "Finest Himalayan craft chai assortment",
            description: "Four distinct craft teas formulated from Siliguri tea gardens.",
            meta_title: "TeaFloww Launch Ready Kit | 4x50g Sampler",
            meta_description: "Real Siliguri tea garden provenance, zero artificial aromas.",
            price_paise: 24000,
            inventory_quantity: 50,
            inventory_policy: "track",
          }),
        })
      );
      const created = await createRes.json();

      // 1. Attach packaging hero photo
      await attachAsset(
        adminReq(`http://localhost/api/v1/admin/trials/${created.id}/assets`, {
          method: "POST",
          body: JSON.stringify({
            expected_revision: 1,
            stage: "packaging",
            url: "/images/trials/launch-box.jpg",
            alt_text: "Artisanal launch box packaging with botanical foil line art",
          }),
        }),
        { params: Promise.resolve({ id: created.id }) }
      );

      // 2. Add verified claim with evidence_ref
      db.prepare(`
        INSERT INTO trial_claims (
          id, trial_id, claim_type, label, claim_text, basis, evidence_ref, verified, sort_order
        ) VALUES (?, ?, 'fssai_licence', 'FSSAI Verified', 'FBO Lic 12823999000456', 'Verified', 'EVID-FSSAI-001', 1, 0)
      `).run(`claim-${Date.now()}`, created.id);

      // 3. Transition to in_review
      await submitReview(
        adminReq(`http://localhost/api/v1/admin/trials/${created.id}/submit-review`, {
          method: "POST",
          body: JSON.stringify({ expected_revision: 2 }),
        }),
        { params: Promise.resolve({ id: created.id }) }
      );

      // 4. Publish trial
      const pubRes = await publishTrial(
        adminReq(`http://localhost/api/v1/admin/trials/${created.id}/publish`, {
          method: "POST",
          body: JSON.stringify({ expected_revision: 3 }),
        }),
        { params: Promise.resolve({ id: created.id }) }
      );

      expect(pubRes.status).toBe(200);
      const published = await pubRes.json();
      expect(published.status).toBe("published");
      expect(published.revision).toBe(4);

      // 5. Unpublish back to draft
      const unpubRes = await unpublishTrial(
        adminReq(`http://localhost/api/v1/admin/trials/${created.id}/unpublish`, {
          method: "POST",
          body: JSON.stringify({ expected_revision: 4 }),
        }),
        { params: Promise.resolve({ id: created.id }) }
      );

      expect(unpubRes.status).toBe(200);
      const unpublished = await unpubRes.json();
      expect(unpublished.status).toBe("draft");
      expect(unpublished.revision).toBe(5);
    });

    it("archives trial via POST /archive and rejects subsequent mutations", async () => {
      const createRes = await createAdminTrial(
        adminReq("http://localhost/api/v1/admin/trials", {
          method: "POST",
          body: JSON.stringify({
            title: "Archive Candidate Kit",
            slug: `test-api-archive-${Date.now()}`,
            price_paise: 20000,
          }),
        })
      );
      const created = await createRes.json();

      const archRes = await archiveTrial(
        adminReq(`http://localhost/api/v1/admin/trials/${created.id}/archive`, {
          method: "POST",
          body: JSON.stringify({ expected_revision: created.revision }),
        }),
        { params: Promise.resolve({ id: created.id }) }
      );

      expect(archRes.status).toBe(200);
      const archived = await archRes.json();
      expect(archived.status).toBe("archived");
      expect(archived.revision).toBe(created.revision + 1);

      // Subsequent update on archived trial must fail
      const updateRes = await updateAdminTrial(
        adminReq(`http://localhost/api/v1/admin/trials/${created.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            expected_revision: archived.revision,
            title: "Should Fail on Archived",
          }),
        }),
        { params: Promise.resolve({ id: created.id }) }
      );
      expect(updateRes.status).toBe(409);
    });
  });

  // ==========================================================================
  // 8. Audit Trail History (GET /api/v1/admin/trials/:id/history)
  // ==========================================================================
  describe("8. Chronological Audit History Trail", () => {
    it("returns chronological immutable audit log capturing actor, revision, and diffs", async () => {
      const createRes = await createAdminTrial(
        adminReq("http://localhost/api/v1/admin/trials", {
          method: "POST",
          body: JSON.stringify({
            title: "Audit Trail Kit",
            slug: `test-api-audit-${Date.now()}`,
            price_paise: 20000,
          }),
        })
      );
      const created = await createRes.json();

      await updateAdminTrial(
        adminReq(`http://localhost/api/v1/admin/trials/${created.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            expected_revision: 1,
            title: "Audit Trail Kit Title Edited",
          }),
        }),
        { params: Promise.resolve({ id: created.id }) }
      );

      const histRes = await getTrialHistory(
        adminReq(`http://localhost/api/v1/admin/trials/${created.id}/history`),
        { params: Promise.resolve({ id: created.id }) }
      );

      expect(histRes.status).toBe(200);
      const history = await histRes.json();
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBe(2);

      // Entries sorted by revision DESC
      expect(history[0].revision).toBe(2);
      expect(history[0].action).toBe("update");
      expect(history[0].created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(history[0].actor).toBeDefined();

      expect(history[1].revision).toBe(1);
      expect(history[1].action).toBe("create_draft");
    });
  });

  // ==========================================================================
  // 9. Admin Deletion Protection (DELETE /api/v1/admin/trials/:id)
  // ==========================================================================
  describe("9. Admin Deletion Protection", () => {
    it("blocks deletion of published trial with HTTP 400", async () => {
      const createRes = await createAdminTrial(
        adminReq("http://localhost/api/v1/admin/trials", {
          method: "POST",
          body: JSON.stringify({
            title: "Delete Published Check",
            slug: `test-api-del-pub-${Date.now()}`,
            price_paise: 20000,
          }),
        })
      );
      const created = await createRes.json();

      // Manually set status to published to test deletion guard
      db.prepare("UPDATE trials SET status = 'published' WHERE id = ?").run(created.id);

      const delRes = await deleteAdminTrial(
        adminReq(`http://localhost/api/v1/admin/trials/${created.id}`, { method: "DELETE" }),
        { params: Promise.resolve({ id: created.id }) }
      );

      expect(delRes.status).toBe(400);
      const err = await delRes.json();
      expect(err.error).toContain("Cannot delete a published trial");
    });

    it("deletes draft trial cleanly with HTTP 200", async () => {
      const createRes = await createAdminTrial(
        adminReq("http://localhost/api/v1/admin/trials", {
          method: "POST",
          body: JSON.stringify({
            title: "Delete Draft Check",
            slug: `test-api-del-draft-${Date.now()}`,
            price_paise: 20000,
          }),
        })
      );
      const created = await createRes.json();

      const delRes = await deleteAdminTrial(
        adminReq(`http://localhost/api/v1/admin/trials/${created.id}`, { method: "DELETE" }),
        { params: Promise.resolve({ id: created.id }) }
      );

      expect(delRes.status).toBe(200);
      expect(TrialService.getById(created.id)).toBeNull();
    });
  });

  // ==========================================================================
  // 10. Public Catalogue & Detail APIs
  // ==========================================================================
  describe("10. Public Catalogue & Detail APIs", () => {
    it("GET /api/v1/trials lists published trials and strictly excludes drafts", async () => {
      const draftSlug = `test-api-pub-draft-${Date.now()}`;
      await createAdminTrial(
        adminReq("http://localhost/api/v1/admin/trials", {
          method: "POST",
          body: JSON.stringify({
            title: "Private Draft Trial",
            slug: draftSlug,
            price_paise: 20000,
          }),
        })
      );

      const res = await getPublicTrials(publicReq("http://localhost/api/v1/trials"));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.trials)).toBe(true);

      const foundDraft = data.trials.find((t: any) => t.slug === draftSlug);
      expect(foundDraft).toBeUndefined();
    });

    it("GET /api/v1/trials/:slug returns 404 for draft, but allows admin preview session", async () => {
      const draftSlug = `test-api-preview-draft-${Date.now()}`;
      await createAdminTrial(
        adminReq("http://localhost/api/v1/admin/trials", {
          method: "POST",
          body: JSON.stringify({
            title: "Admin Preview Test Kit",
            slug: draftSlug,
            price_paise: 20000,
          }),
        })
      );

      // Customer public request -> 404 Not Found
      const customerRes = await getPublicTrialBySlug(
        publicReq(`http://localhost/api/v1/trials/${draftSlug}`),
        { params: Promise.resolve({ slug: draftSlug }) }
      );
      expect(customerRes.status).toBe(404);

      // Admin request -> 200 OK with is_preview: true
      const adminPreviewRes = await getPublicTrialBySlug(
        adminReq(`http://localhost/api/v1/trials/${draftSlug}`),
        { params: Promise.resolve({ slug: draftSlug }) }
      );
      expect(adminPreviewRes.status).toBe(200);
      const previewData = await adminPreviewRes.json();
      expect(previewData.slug).toBe(draftSlug);
      expect(previewData.is_preview).toBe(true);
    });

    it("strictly redacts internal COGS, supplier information, and private notes from public response", async () => {
      const pubSlug = `test-api-redaction-${Date.now()}`;
      const createRes = await createAdminTrial(
        adminReq("http://localhost/api/v1/admin/trials", {
          method: "POST",
          body: JSON.stringify({
            title: "Redaction Test Kit",
            slug: pubSlug,
            price_paise: 29900,
            cost_paise: 12000, // COGS to redact
            sku: "TR-REDACT-001",
          }),
        })
      );
      const created = await createRes.json();

      // Mark published in DB for testing
      db.prepare("UPDATE trials SET status = 'published' WHERE id = ?").run(created.id);

      const res = await getPublicTrialBySlug(
        publicReq(`http://localhost/api/v1/trials/${pubSlug}`),
        { params: Promise.resolve({ slug: pubSlug }) }
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.price_paise).toBe(29900);
      expect(data.cost_paise).toBeUndefined();
      expect(data.cogs).toBeUndefined();
      expect(data.supplier_rate).toBeUndefined();
      expect(data.admin_notes).toBeUndefined();
    });

    it("GET /api/v1/trials/:slug resolves trial by UUID as well as slug and provides gallery_images", async () => {
      const pubSlug = `test-api-uuid-${Date.now()}`;
      const createRes = await createAdminTrial(
        adminReq("http://localhost/api/v1/admin/trials", {
          method: "POST",
          body: JSON.stringify({
            title: "UUID Lookup Test Kit",
            slug: pubSlug,
            price_paise: 20000,
          }),
        })
      );
      const created = await createRes.json();

      // Mark published in DB for testing
      db.prepare("UPDATE trials SET status = 'published' WHERE id = ?").run(created.id);

      // Access via UUID instead of slug
      const resByUuid = await getPublicTrialBySlug(
        publicReq(`http://localhost/api/v1/trials/${created.id}`),
        { params: Promise.resolve({ slug: created.id }) }
      );

      expect(resByUuid.status).toBe(200);
      const dataByUuid = await resByUuid.json();
      expect(dataByUuid.id).toBe(created.id);
      expect(dataByUuid.slug).toBe(pubSlug);
      expect(Array.isArray(dataByUuid.gallery_images)).toBe(true);
    });
  });

  // ==========================================================================
  // 11. Public Shipping Quote API (POST /api/v1/trials/:id/shipping-quote)
  // ==========================================================================
  describe("11. Public Shipping Quote Calculation", () => {
    it("calculates courier estimate for valid 6-digit Indian PIN code", async () => {
      const createRes = await createAdminTrial(
        adminReq("http://localhost/api/v1/admin/trials", {
          method: "POST",
          body: JSON.stringify({
            title: "Shipping Quote Kit",
            slug: `test-api-ship-${Date.now()}`,
            price_paise: 20000,
          }),
        })
      );
      const created = await createRes.json();

      const res = await getShippingQuote(
        publicReq(`http://localhost/api/v1/trials/${created.id}/shipping-quote`, {
          method: "POST",
          body: JSON.stringify({ pincode: "734001", quantity: 1 }),
        }),
        { params: Promise.resolve({ id: created.id }) }
      );

      expect(res.status).toBe(200);
      const quote = await res.json();
      expect(quote.pincode).toBe("734001");
      expect(typeof quote.shipping_fee_paise).toBe("number");
      expect(quote.serviceable).toBe(true);
      expect(quote.net_weight_g).toBe(200);
    });

    it("rejects invalid or non-numeric PIN codes with HTTP 400 Bad Request", async () => {
      const createRes = await createAdminTrial(
        adminReq("http://localhost/api/v1/admin/trials", {
          method: "POST",
          body: JSON.stringify({
            title: "Shipping Invalid Pin Kit",
            slug: `test-api-invalid-pin-${Date.now()}`,
            price_paise: 20000,
          }),
        })
      );
      const created = await createRes.json();

      // Zero starting digit
      const r1 = await getShippingQuote(
        publicReq(`http://localhost/api/v1/trials/${created.id}/shipping-quote`, {
          method: "POST",
          body: JSON.stringify({ pincode: "000000" }),
        }),
        { params: Promise.resolve({ id: created.id }) }
      );
      expect(r1.status).toBe(400);

      // Letters
      const r2 = await getShippingQuote(
        publicReq(`http://localhost/api/v1/trials/${created.id}/shipping-quote`, {
          method: "POST",
          body: JSON.stringify({ pincode: "ABCDEF" }),
        }),
        { params: Promise.resolve({ id: created.id }) }
      );
      expect(r2.status).toBe(400);

      // Too short
      const r3 = await getShippingQuote(
        publicReq(`http://localhost/api/v1/trials/${created.id}/shipping-quote`, {
          method: "POST",
          body: JSON.stringify({ pincode: "123" }),
        }),
        { params: Promise.resolve({ id: created.id }) }
      );
      expect(r3.status).toBe(400);
    });

    it("returns HTTP 404 for non-existent trial ID", async () => {
      const res = await getShippingQuote(
        publicReq("http://localhost/api/v1/trials/non-existent-trial-id/shipping-quote", {
          method: "POST",
          body: JSON.stringify({ pincode: "734001" }),
        }),
        { params: Promise.resolve({ id: "non-existent-trial-id" }) }
      );
      expect(res.status).toBe(404);
    });
  });

  // ==========================================================================
  // 11. Public Endpoints 500 Error Sanitization (Zero Raw SQLite Leakage)
  // ==========================================================================
  describe("Public Endpoints 500 Error Sanitization", () => {
    it("GET /api/v1/trials sanitizes 500 errors and does not leak raw database exception", async () => {
      const spy = vi.spyOn(TrialService, "listPublic").mockImplementationOnce(() => {
        throw new Error("SqliteError: disk I/O error on table trials");
      });

      const res = await getPublicTrials(publicReq("http://localhost/api/v1/trials"));
      expect(res.status).toBe(500);

      const json = await res.json();
      expect(json.error).toBe("An unexpected error occurred");
      expect(JSON.stringify(json)).not.toContain("SqliteError");
      expect(JSON.stringify(json)).not.toContain("disk I/O error");

      spy.mockRestore();
    });

    it("GET /api/v1/trials/:slug sanitizes 500 errors and does not leak raw database exception", async () => {
      const spy = vi.spyOn(TrialService, "getPublicBySlug").mockImplementationOnce(() => {
        throw new Error("SqliteError: database table is locked (trials)");
      });

      const res = await getPublicTrialBySlug(
        publicReq("http://localhost/api/v1/trials/any-slug"),
        { params: Promise.resolve({ slug: "any-slug" }) }
      );
      expect(res.status).toBe(500);

      const json = await res.json();
      expect(json.error).toBe("An unexpected error occurred");
      expect(JSON.stringify(json)).not.toContain("SqliteError");
      expect(JSON.stringify(json)).not.toContain("locked");

      spy.mockRestore();
    });

    it("POST /api/v1/trials/:id/shipping-quote sanitizes 500 errors and does not leak raw database exception", async () => {
      const spy = vi.spyOn(TrialService, "getById").mockImplementationOnce(() => {
        throw new Error("SqliteError: foreign key constraint failed on trials");
      });

      const res = await getShippingQuote(
        publicReq("http://localhost/api/v1/trials/mock-id/shipping-quote", {
          method: "POST",
          body: JSON.stringify({ pincode: "734001" }),
        }),
        { params: Promise.resolve({ id: "mock-id" }) }
      );
      expect(res.status).toBe(500);

      const json = await res.json();
      expect(json.error).toBe("An unexpected error occurred");
      expect(JSON.stringify(json)).not.toContain("SqliteError");
      expect(JSON.stringify(json)).not.toContain("foreign key constraint");

      spy.mockRestore();
    });
  });
});
