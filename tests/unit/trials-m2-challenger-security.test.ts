/**
 * TeaFloww Trials v3 — Milestone 2 REST APIs Adversarial Security & Projection Test Suite
 *
 * Authored by: Challenger 2 (Empirical Adversarial Testing)
 * Focus areas:
 * 1. Authentication Enforcement across ALL admin endpoints (HTTP 401 Unauthorized)
 * 2. Draft Isolation & Public Storefront Protection (Drafts omitted, 404 unless verified admin preview)
 * 3. Sensitive Data Redaction (100% absence of COGS, supplier IDs, raw notes, exact inventory counts)
 * 4. Malformed Payloads, Boundary Values, Prototype Pollution & SQL Injection Defense
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { createAdminSession } from "@/lib/adminSessions";
import { resetRateLimits } from "@/lib/rateLimit";

// Route handlers under test
import { GET as getPublicTrials } from "@/app/api/v1/trials/route";
import { GET as getPublicTrialBySlug } from "@/app/api/v1/trials/[slug]/route";
import { POST as getShippingQuote } from "@/app/api/v1/trials/[slug]/shipping-quote/route";
import { GET as getAdminTrials, POST as createAdminTrial } from "@/app/api/v1/admin/trials/route";
import {
  GET as getAdminTrial,
  PATCH as updateAdminTrial,
  DELETE as deleteAdminTrial,
} from "@/app/api/v1/admin/trials/[id]/route";
import { PUT as replaceComponentsPut, POST as replaceComponentsPost } from "@/app/api/v1/admin/trials/[id]/components/route";
import { POST as attachAsset, DELETE as detachAsset } from "@/app/api/v1/admin/trials/[id]/assets/route";
import { GET as validateTrial } from "@/app/api/v1/admin/trials/[id]/validate/route";
import { POST as submitReview } from "@/app/api/v1/admin/trials/[id]/submit-review/route";
import { POST as publishTrial } from "@/app/api/v1/admin/trials/[id]/publish/route";
import { POST as unpublishTrial } from "@/app/api/v1/admin/trials/[id]/unpublish/route";
import { POST as archiveTrial } from "@/app/api/v1/admin/trials/[id]/archive/route";
import { GET as getTrialHistory } from "@/app/api/v1/admin/trials/[id]/history/route";

describe("Milestone 2 Challenger 2 — REST APIs Adversarial Security & Projection Suite", () => {
  let validAdminCookie: string;
  let ipCounter = 1;
  const db = getDb();

  beforeEach(() => {
    resetRateLimits();
    vi.stubEnv("COMMERCE_MOCK_PROVIDERS", "1");
    vi.stubEnv("SESSION_SECRET", "test_session_secret_for_signing_cookies_32_bytes_long");

    // Ensure root admin user exists
    db.prepare(`
      INSERT OR IGNORE INTO admin_users (id, username, password_hash, role)
      VALUES (1, 'rootadmin', 'hash', 'root')
    `).run();

    const session = createAdminSession(1);
    validAdminCookie = `admin_session=${session.cookieValue}`;

    // Clean up test records
    db.prepare("DELETE FROM trials WHERE slug LIKE 'adv-%' OR slug LIKE 'sec-%'").run();
  });

  // Helper request builders
  function makeReq(
    url: string,
    options: {
      method?: string;
      body?: string | null;
      cookie?: string | null;
      headers?: Record<string, string>;
    } = {}
  ): NextRequest {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-forwarded-for": `10.99.3.${(ipCounter++ % 240) + 1}`,
      ...(options.headers || {}),
    };
    if (options.cookie) {
      headers["Cookie"] = options.cookie;
    }
    return new NextRequest(url, {
      method: options.method || "GET",
      body: options.body ?? undefined,
      headers,
    });
  }

  function adminReq(
    url: string,
    init?: { method?: string; body?: string; headers?: Record<string, string> }
  ): NextRequest {
    return makeReq(url, {
      ...init,
      cookie: validAdminCookie,
    });
  }

  function publicReq(
    url: string,
    init?: { method?: string; body?: string; headers?: Record<string, string> }
  ): NextRequest {
    return makeReq(url, {
      ...init,
      cookie: null,
    });
  }

  // ==========================================================================
  // VECTOR 1: Authentication Enforcement on All Admin Endpoints
  // ==========================================================================
  describe("Vector 1: Authentication Enforcement on All Admin Endpoints", () => {
    const dummyId = "dummy-id-uuid-1234";
    const dummyParams = { params: Promise.resolve({ id: dummyId }) };

    it("1.1 strictly rejects requests with NO Cookie header across all 15 Admin endpoints (HTTP 401)", async () => {
      const endpoints: Array<() => Promise<Response>> = [
        () => getAdminTrials(publicReq("http://localhost/api/v1/admin/trials")),
        () => createAdminTrial(publicReq("http://localhost/api/v1/admin/trials", { method: "POST", body: "{}" })),
        () => getAdminTrial(publicReq(`http://localhost/api/v1/admin/trials/${dummyId}`), dummyParams),
        () => updateAdminTrial(publicReq(`http://localhost/api/v1/admin/trials/${dummyId}`, { method: "PATCH", body: "{}" }), dummyParams),
        () => deleteAdminTrial(publicReq(`http://localhost/api/v1/admin/trials/${dummyId}`, { method: "DELETE" }), dummyParams),
        () => replaceComponentsPut(publicReq(`http://localhost/api/v1/admin/trials/${dummyId}/components`, { method: "PUT", body: "{}" }), dummyParams),
        () => replaceComponentsPost(publicReq(`http://localhost/api/v1/admin/trials/${dummyId}/components`, { method: "POST", body: "{}" }), dummyParams),
        () => attachAsset(publicReq(`http://localhost/api/v1/admin/trials/${dummyId}/assets`, { method: "POST", body: "{}" }), dummyParams),
        () => detachAsset(publicReq(`http://localhost/api/v1/admin/trials/${dummyId}/assets`, { method: "DELETE" }), dummyParams),
        () => validateTrial(publicReq(`http://localhost/api/v1/admin/trials/${dummyId}/validate`), dummyParams),
        () => submitReview(publicReq(`http://localhost/api/v1/admin/trials/${dummyId}/submit-review`, { method: "POST", body: "{}" }), dummyParams),
        () => publishTrial(publicReq(`http://localhost/api/v1/admin/trials/${dummyId}/publish`, { method: "POST", body: "{}" }), dummyParams),
        () => unpublishTrial(publicReq(`http://localhost/api/v1/admin/trials/${dummyId}/unpublish`, { method: "POST", body: "{}" }), dummyParams),
        () => archiveTrial(publicReq(`http://localhost/api/v1/admin/trials/${dummyId}/archive`, { method: "POST", body: "{}" }), dummyParams),
        () => getTrialHistory(publicReq(`http://localhost/api/v1/admin/trials/${dummyId}/history`), dummyParams),
      ];

      for (const call of endpoints) {
        const res = await call();
        expect(res.status).toBe(401);
        const data = await res.json();
        expect(data).toHaveProperty("error", "Unauthorized.");
      }
    });

    it("1.2 rejects requests with forged, corrupted, or tampered session cookies (HTTP 401)", async () => {
      const forgedCookies = [
        "admin_session=",
        "admin_session=invalid_token_without_signature",
        "admin_session=dGhpcyBpcyBub3QgYSB2YWxpZCBzaWc=.1234567890abcdef",
        "admin_session=fake_sid_12345678901234567890123456789012.fake_sig_12345678901234567890123456789012",
        "admin_session=;;;",
        "admin_session=' OR 1=1 --",
        "other_cookie=foo; another=bar",
      ];

      for (const cookie of forgedCookies) {
        const req = makeReq("http://localhost/api/v1/admin/trials", { cookie });
        const res = await getAdminTrials(req);
        expect(res.status).toBe(401);
        const data = await res.json();
        expect(data.error).toBe("Unauthorized.");
      }
    });

    it("1.3 rejects expired admin sessions with HTTP 401", async () => {
      // Create session in past
      const pastTime = Date.now() - 24 * 60 * 60 * 1000; // 24h ago
      const expired = createAdminSession(1, pastTime);
      const expiredCookie = `admin_session=${expired.cookieValue}`;

      const req = makeReq("http://localhost/api/v1/admin/trials", { cookie: expiredCookie });
      const res = await getAdminTrials(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe("Unauthorized.");
    });

    it("1.4 rejects sessions belonging to deleted admin users with HTTP 401", async () => {
      // Create temporary admin user
      const tempId = 9999;
      db.prepare(`
        INSERT OR REPLACE INTO admin_users (id, username, password_hash, role)
        VALUES (?, 'temp_admin', 'hash', 'admin')
      `).run(tempId);

      const session = createAdminSession(tempId);
      const cookie = `admin_session=${session.cookieValue}`;

      // Verify it works while user exists
      const okReq = makeReq("http://localhost/api/v1/admin/trials", { cookie });
      const okRes = await getAdminTrials(okReq);
      expect(okRes.status).toBe(200);

      // Delete the user from database
      db.prepare("DELETE FROM admin_users WHERE id = ?").run(tempId);

      // Subsequent request must be rejected with 401
      const failReq = makeReq("http://localhost/api/v1/admin/trials", { cookie });
      const failRes = await getAdminTrials(failReq);
      expect(failRes.status).toBe(401);
      const data = await failRes.json();
      expect(data.error).toBe("Unauthorized.");
    });

    it("1.5 rejects Bearer tokens without valid cookie session (HTTP 401)", async () => {
      const req = makeReq("http://localhost/api/v1/admin/trials", {
        headers: {
          Authorization: "Bearer admin_master_key_9999999999",
        },
      });
      const res = await getAdminTrials(req);
      expect(res.status).toBe(401);
    });
  });

  // ==========================================================================
  // VECTOR 2: Draft Isolation & Public Storefront Protection
  // ==========================================================================
  describe("Vector 2: Draft Isolation & Public Storefront Protection", () => {
    let inReviewTrialId: string;
    let publishedTrialId: string;
    let archivedTrialId: string;

    const draftSlug = "adv-iso-draft-kit";
    const inReviewSlug = "adv-iso-in-review-kit";
    const publishedSlug = "adv-iso-published-kit";
    const archivedSlug = "adv-iso-archived-kit";

    beforeEach(async () => {
      // Helper to create trial with standard 4x50g components and valid SEO/identity
      async function createTestKit(slug: string, title: string) {
        const res = await createAdminTrial(
          adminReq("http://localhost/api/v1/admin/trials", {
            method: "POST",
            body: JSON.stringify({
              title,
              slug,
              tagline: `Tagline for ${title}`,
              meta_title: `SEO Title for ${title}`,
              meta_description: `SEO Description for ${title}`,
              price_paise: 49900,
              sku: `SKU-${slug.toUpperCase()}`,
              description: `Description for ${title}`,
              inventory_quantity: 25,
              inventory_policy: "track",
              components: [
                { slot_index: 0, name: "Sachet 1", estate: "Estate 1", grade: "FTGFOP1", flush: "Spring", weight_g: 50 },
                { slot_index: 1, name: "Sachet 2", estate: "Estate 2", grade: "FTGFOP1", flush: "Summer", weight_g: 50 },
                { slot_index: 2, name: "Sachet 3", estate: "Estate 3", grade: "FTGFOP1", flush: "Autumn", weight_g: 50 },
                { slot_index: 3, name: "Sachet 4", estate: "Estate 4", grade: "FTGFOP1", flush: "Winter", weight_g: 50 },
              ],
            }),
          })
        );
        const data = await res.json();
        return data.id;
      }

      await createTestKit(draftSlug, "Adversarial Draft Kit");
      inReviewTrialId = await createTestKit(inReviewSlug, "Adversarial In-Review Kit");
      publishedTrialId = await createTestKit(publishedSlug, "Adversarial Published Kit");
      archivedTrialId = await createTestKit(archivedSlug, "Adversarial Archived Kit");

      // Transition inReview: draft (rev 1) -> in_review (rev 2)
      await submitReview(
        adminReq(`http://localhost/api/v1/admin/trials/${inReviewTrialId}/submit-review`, {
          method: "POST",
          body: JSON.stringify({ expected_revision: 1 }),
        }),
        { params: Promise.resolve({ id: inReviewTrialId }) }
      );

      // Setup published kit with packaging asset & publish
      await attachAsset(
        adminReq(`http://localhost/api/v1/admin/trials/${publishedTrialId}/assets`, {
          method: "POST",
          body: JSON.stringify({
            expected_revision: 1,
            stage: "packaging",
            asset_url: "https://images.teafloww.com/pub-box.webp",
            alt_text: "Packaging box of the published kit",
          }),
        }),
        { params: Promise.resolve({ id: publishedTrialId }) }
      );

      await submitReview(
        adminReq(`http://localhost/api/v1/admin/trials/${publishedTrialId}/submit-review`, {
          method: "POST",
          body: JSON.stringify({ expected_revision: 2 }),
        }),
        { params: Promise.resolve({ id: publishedTrialId }) }
      );

      const pubRes = await publishTrial(
        adminReq(`http://localhost/api/v1/admin/trials/${publishedTrialId}/publish`, {
          method: "POST",
          body: JSON.stringify({ expected_revision: 3 }),
        }),
        { params: Promise.resolve({ id: publishedTrialId }) }
      );
      expect(pubRes.status).toBe(200);

      // Transition archived kit (draft -> in_review -> published -> archived)
      await attachAsset(
        adminReq(`http://localhost/api/v1/admin/trials/${archivedTrialId}/assets`, {
          method: "POST",
          body: JSON.stringify({
            expected_revision: 1,
            stage: "packaging",
            asset_url: "https://images.teafloww.com/arc-box.webp",
            alt_text: "Packaging box of the archive kit",
          }),
        }),
        { params: Promise.resolve({ id: archivedTrialId }) }
      );
      await submitReview(
        adminReq(`http://localhost/api/v1/admin/trials/${archivedTrialId}/submit-review`, {
          method: "POST",
          body: JSON.stringify({ expected_revision: 2 }),
        }),
        { params: Promise.resolve({ id: archivedTrialId }) }
      );
      await publishTrial(
        adminReq(`http://localhost/api/v1/admin/trials/${archivedTrialId}/publish`, {
          method: "POST",
          body: JSON.stringify({ expected_revision: 3 }),
        }),
        { params: Promise.resolve({ id: archivedTrialId }) }
      );
      await archiveTrial(
        adminReq(`http://localhost/api/v1/admin/trials/${archivedTrialId}/archive`, {
          method: "POST",
          body: JSON.stringify({ expected_revision: 4 }),
        }),
        { params: Promise.resolve({ id: archivedTrialId }) }
      );
    });

    it("2.1 public GET /api/v1/trials strictly omits draft, in_review, and archived kits", async () => {
      const res = await getPublicTrials(publicReq("http://localhost/api/v1/trials?limit=50"));
      expect(res.status).toBe(200);
      const data = await res.json();

      const slugs = data.trials.map((t: { slug: string }) => t.slug);
      expect(slugs).toContain(publishedSlug);
      expect(slugs).not.toContain(draftSlug);
      expect(slugs).not.toContain(inReviewSlug);
      expect(slugs).not.toContain(archivedSlug);
    });

    it("2.2 public search filter strictly excludes drafts and archived trials from matches", async () => {
      // Searching for "Draft Kit" must return 0 results
      const resDraft = await getPublicTrials(publicReq("http://localhost/api/v1/trials?search=Draft+Kit"));
      const dataDraft = await resDraft.json();
      expect(dataDraft.trials).toHaveLength(0);
      expect(dataDraft.total).toBe(0);

      // Searching for "Archived Kit" must return 0 results
      const resArc = await getPublicTrials(publicReq("http://localhost/api/v1/trials?search=Archived+Kit"));
      const dataArc = await resArc.json();
      expect(dataArc.trials).toHaveLength(0);
      expect(dataArc.total).toBe(0);

      // Searching for "Published Kit" matches the published one
      const resPub = await getPublicTrials(publicReq("http://localhost/api/v1/trials?search=Published+Kit"));
      const dataPub = await resPub.json();
      expect(dataPub.trials.length).toBeGreaterThanOrEqual(1);
      expect(dataPub.trials.some((t: { slug: string }) => t.slug === publishedSlug)).toBe(true);
    });

    it("2.3 public GET /api/v1/trials/:slug returns HTTP 404 for draft, in_review, and archived slugs without admin session", async () => {
      const check404 = async (slug: string) => {
        const res = await getPublicTrialBySlug(
          publicReq(`http://localhost/api/v1/trials/${slug}`),
          { params: Promise.resolve({ slug }) }
        );
        expect(res.status).toBe(404);
        const data = await res.json();
        expect(data).toHaveProperty("error", `Trial not found: ${slug}`);
      };

      await check404(draftSlug);
      await check404(inReviewSlug);
      await check404(archivedSlug);
      await check404("totally-non-existent-slug-404");
    });

    it("2.4 public GET /api/v1/trials/:slug returns 400 when slug parameter is empty or whitespace", async () => {
      const res = await getPublicTrialBySlug(
        publicReq("http://localhost/api/v1/trials/%20%20"),
        { params: Promise.resolve({ slug: "   " }) }
      );
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Trial slug is required.");
    });

    it("2.5 authenticated admin preview session can inspect draft and archived trials via GET /api/v1/trials/:slug with is_preview=true", async () => {
      const resDraft = await getPublicTrialBySlug(
        adminReq(`http://localhost/api/v1/trials/${draftSlug}`),
        { params: Promise.resolve({ slug: draftSlug }) }
      );
      expect(resDraft.status).toBe(200);
      const dataDraft = await resDraft.json();
      expect(dataDraft.slug).toBe(draftSlug);
      expect(dataDraft.is_preview).toBe(true);
      expect(resDraft.headers.get("Cache-Control")).toContain("no-store");

      const resArc = await getPublicTrialBySlug(
        adminReq(`http://localhost/api/v1/trials/${archivedSlug}`),
        { params: Promise.resolve({ slug: archivedSlug }) }
      );
      expect(resArc.status).toBe(200);
      const dataArc = await resArc.json();
      expect(dataArc.slug).toBe(archivedSlug);
      expect(dataArc.is_preview).toBe(true);
    });

    it("2.6 requests with invalid/tampered admin cookies on draft slugs strictly return 404 (no unauthorized preview)", async () => {
      const res = await getPublicTrialBySlug(
        makeReq(`http://localhost/api/v1/trials/${draftSlug}`, {
          cookie: "admin_session=invalid_signature_tampered_value",
        }),
        { params: Promise.resolve({ slug: draftSlug }) }
      );
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe(`Trial not found: ${draftSlug}`);
    });
  });

  // ==========================================================================
  // VECTOR 3: Sensitive Data Redaction Stress-Testing
  // ==========================================================================
  describe("Vector 3: Sensitive Data Redaction Stress-Testing", () => {
    const sensitiveSlug = "sec-redact-audit-kit";
    let sensitiveTrialId: string;

    const SECRET_COGS = 12550; // ₹125.50 internal cost
    const SECRET_PROD_ID = 1;
    const SECRET_VAR_ID = 1;
    const SECRET_LAB_NOTE = "Internal lab note: high tannin content, acquired at discount from supplier";
    const SECRET_ADMIN_EMAIL = "supersecret-admin@teafloww.com";
    const SECRET_UNVERIFIED_CLAIM = "Secret miracle tea curing all ailments";
    const SECRET_STOCK_COUNT = 47;

    beforeEach(async () => {
      // Create draft with cost_paise, stock, and SEO
      const createRes = await createAdminTrial(
        adminReq("http://localhost/api/v1/admin/trials", {
          method: "POST",
          body: JSON.stringify({
            title: "Confidentiality Redaction Assay Kit",
            slug: sensitiveSlug,
            tagline: "Ultra premium micro-batch single estate trial",
            meta_title: "Safe Public Meta Title",
            meta_description: "Safe Public Meta Description",
            price_paise: 69900,
            cost_paise: SECRET_COGS,
            sku: "SKU-REDACT-001",
            inventory_quantity: SECRET_STOCK_COUNT,
            inventory_policy: "track",
            components: [
              {
                slot_index: 0,
                name: "Sachet Alpha",
                estate: "Estate Alpha",
                grade: "SFTGFOP1",
                flush: "First Flush",
                elevation: "1800m",
                weight_g: 50,
                tasting_notes: ["Floral", "Peach"],
                regular_product_id: SECRET_PROD_ID,
                regular_variant_id: SECRET_VAR_ID,
              },
              { slot_index: 1, name: "Sachet Beta", estate: "Estate Beta", grade: "FTGFOP1", flush: "Second", weight_g: 50 },
              { slot_index: 2, name: "Sachet Gamma", estate: "Estate Gamma", grade: "TGFOP", flush: "Monsoon", weight_g: 50 },
              { slot_index: 3, name: "Sachet Delta", estate: "Estate Delta", grade: "BOP", flush: "Autumn", weight_g: 50 },
            ],
          }),
        })
      );
      const created = await createRes.json();
      sensitiveTrialId = created.id;

      // Direct DB insert of secret sensory notes, unverified claims, unapproved asset, and audit log
      db.prepare(`
        INSERT INTO trial_sensory_tests (id, trial_id, component_id, tester_name, aroma_score, body_score, astringency_score, finish_score, notes)
        VALUES ('sens-1', ?, NULL, 'Senior Q Grader', 9.0, 8.5, 8.0, 8.5, ?)
      `).run(sensitiveTrialId, SECRET_LAB_NOTE);

      db.prepare(`
        INSERT INTO trial_claims (id, trial_id, claim_type, label, claim_text, evidence_ref, verified, sort_order)
        VALUES ('claim-secret', ?, 'sensory', 'Miracle Claim', ?, 'UNVERIFIED-REF', 0, 1)
      `).run(sensitiveTrialId, SECRET_UNVERIFIED_CLAIM);

      db.prepare(`
        INSERT INTO trial_claims (id, trial_id, claim_type, label, claim_text, evidence_ref, verified, sort_order)
        VALUES ('claim-verified', ?, 'origin', '100% Darjeeling', 'Single estate guaranteed', 'DOC-EVID-101', 1, 2)
      `).run(sensitiveTrialId);

      db.prepare(`
        INSERT INTO trial_assets (id, trial_id, stage, asset_url, alt_text, rights_status, sort_order)
        VALUES ('asset-rejected', ?, 'packaging', 'https://images.teafloww.com/watermarked-leak.webp', 'Watermarked unapproved image', 'rejected', 0)
      `).run(sensitiveTrialId);

      db.prepare(`
        INSERT INTO trial_assets (id, trial_id, stage, asset_url, alt_text, rights_status, sort_order)
        VALUES ('asset-approved', ?, 'packaging', 'https://images.teafloww.com/clean-pack.webp', 'Approved packaging image', 'approved', 1)
      `).run(sensitiveTrialId);

      db.prepare(`
        INSERT INTO trial_audit (id, trial_id, revision, action, actor_type, actor_id, actor_email, diff_json)
        VALUES ('audit-secret', ?, 1, 'adversarial_test', 'admin', 'admin-007', ?, '{"internal_secret":"confidential_margin_99%"}')
      `).run(sensitiveTrialId, SECRET_ADMIN_EMAIL);

      // Submit review and publish
      await submitReview(
        adminReq(`http://localhost/api/v1/admin/trials/${sensitiveTrialId}/submit-review`, {
          method: "POST",
          body: JSON.stringify({ expected_revision: 1 }),
        }),
        { params: Promise.resolve({ id: sensitiveTrialId }) }
      );

      const pubRes = await publishTrial(
        adminReq(`http://localhost/api/v1/admin/trials/${sensitiveTrialId}/publish`, {
          method: "POST",
          body: JSON.stringify({ expected_revision: 2 }),
        }),
        { params: Promise.resolve({ id: sensitiveTrialId }) }
      );
      expect(pubRes.status).toBe(200);
    });

    it("3.1 public GET /api/v1/trials/:slug ensures 100% absence of confidential fields", async () => {
      const res = await getPublicTrialBySlug(
        publicReq(`http://localhost/api/v1/trials/${sensitiveSlug}`),
        { params: Promise.resolve({ slug: sensitiveSlug }) }
      );
      expect(res.status).toBe(200);

      const rawJsonText = await res.text();
      const data = JSON.parse(rawJsonText);

      // 1. Direct property assertions
      expect((data as Record<string, unknown>).cost_paise).toBeUndefined();
      expect((data as Record<string, unknown>).inventory_quantity).toBeUndefined();
      expect((data as Record<string, unknown>).inventory_policy).toBeUndefined();
      expect((data as Record<string, unknown>).sensory_tests).toBeUndefined();
      expect((data as Record<string, unknown>).audit).toBeUndefined();

      // Components must not leak supplier foreign keys
      for (const comp of data.components) {
        expect(comp.regular_product_id).toBeUndefined();
        expect(comp.regular_variant_id).toBeUndefined();
      }

      // Stock must be projected strictly as boolean in_stock
      expect(data.in_stock).toBe(true);

      // Unverified claims must be excluded; verified claims included
      const claims = data.claims.map((c: { label: string }) => c.label);
      expect(claims).toContain("100% Darjeeling");
      expect(claims).not.toContain("Miracle Claim");
      expect(claims).not.toContain(SECRET_UNVERIFIED_CLAIM);

      // Unapproved assets (rights_status=rejected) must be omitted
      expect(rawJsonText).not.toContain("watermarked-leak.webp");
      expect(rawJsonText).toContain("clean-pack.webp");

      // 2. Full text recursive leakage scan
      expect(rawJsonText).not.toContain(String(SECRET_COGS));
      expect(rawJsonText).not.toContain("regular_product_id");
      expect(rawJsonText).not.toContain("regular_variant_id");
      expect(rawJsonText).not.toContain(SECRET_LAB_NOTE);
      expect(rawJsonText).not.toContain(SECRET_ADMIN_EMAIL);
      expect(rawJsonText).not.toContain(SECRET_UNVERIFIED_CLAIM);
      expect(rawJsonText).not.toContain(`"inventory_quantity":${SECRET_STOCK_COUNT}`);
    });

    it("3.2 public GET /api/v1/trials catalogue items also strictly redact confidential fields", async () => {
      const res = await getPublicTrials(publicReq(`http://localhost/api/v1/trials?search=Redaction`));
      expect(res.status).toBe(200);
      const rawJsonText = await res.text();
      const data = JSON.parse(rawJsonText);

      const trial = data.trials.find((t: { slug: string }) => t.slug === sensitiveSlug);
      expect(trial).toBeDefined();

      expect(trial.cost_paise).toBeUndefined();
      expect(trial.inventory_quantity).toBeUndefined();
      expect(rawJsonText).not.toContain(String(SECRET_COGS));
      expect(rawJsonText).not.toContain("regular_product_id");
      expect(rawJsonText).not.toContain("regular_variant_id");
      expect(rawJsonText).not.toContain(SECRET_ADMIN_EMAIL);
    });

    it("3.3 Admin preview via GET /api/v1/trials/:slug projects through toPublicDto and still redacts COGS and supplier IDs", async () => {
      const res = await getPublicTrialBySlug(
        adminReq(`http://localhost/api/v1/trials/${sensitiveSlug}`),
        { params: Promise.resolve({ slug: sensitiveSlug }) }
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.cost_paise).toBeUndefined();
      expect(data.inventory_quantity).toBeUndefined();
      expect(data.components[0].regular_product_id).toBeUndefined();
      expect(data.components[0].regular_variant_id).toBeUndefined();
    });

    it("3.4 shipping quote API does not leak COGS, supplier IDs, or inventory counts", async () => {
      const res = await getShippingQuote(
        publicReq(`http://localhost/api/v1/trials/${sensitiveTrialId}/shipping-quote`, {
          method: "POST",
          body: JSON.stringify({ pincode: "110001", quantity: 2 }),
        }),
        { params: Promise.resolve({ id: sensitiveTrialId }) }
      );
      expect(res.status).toBe(200);
      const rawJsonText = await res.text();
      const data = JSON.parse(rawJsonText);
      expect(rawJsonText).not.toContain(String(SECRET_COGS));
      expect(rawJsonText).not.toContain("regular_product_id");
      expect(rawJsonText).not.toContain("regular_variant_id");
      expect(rawJsonText).not.toContain("inventory_quantity");
      expect((data as Record<string, unknown>).inventory_quantity).toBeUndefined();
    });
  });

  // ==========================================================================
  // VECTOR 4: Malformed Payloads, Boundary Values, Prototype Pollution & SQL Injection
  // ==========================================================================
  describe("Vector 4: Malformed Payloads, Boundary Values, Prototype Pollution & SQL Injection", () => {
    let testTrialId: string;
    const testSlug = "adv-payload-test-kit";

    beforeEach(async () => {
      const res = await createAdminTrial(
        adminReq("http://localhost/api/v1/admin/trials", {
          method: "POST",
          body: JSON.stringify({
            title: "Payload Validation Baseline Kit",
            slug: testSlug,
            price_paise: 50000,
            sku: "SKU-PAYLOAD-001",
            components: [
              { slot_index: 0, name: "Tea 1", estate: "E1", grade: "G1", flush: "F1", weight_g: 50 },
              { slot_index: 1, name: "Tea 2", estate: "E2", grade: "G2", flush: "F2", weight_g: 50 },
              { slot_index: 2, name: "Tea 3", estate: "E3", grade: "G3", flush: "F3", weight_g: 50 },
              { slot_index: 3, name: "Tea 4", estate: "E4", grade: "G4", flush: "F4", weight_g: 50 },
            ],
          }),
        })
      );
      const data = await res.json();
      testTrialId = data.id;
    });

    it("4.1 rejects malformed JSON bodies with HTTP 400 across all mutating endpoints", async () => {
      const malformedBodies = [
        "not json",
        "{ broken: json,",
        "",
        "12345",
        "true",
        "[1, 2, 3]",
      ];

      const dummyParams = { params: Promise.resolve({ id: testTrialId }) };

      for (const badBody of malformedBodies) {
        // POST /api/v1/admin/trials
        const resCreate = await createAdminTrial(
          adminReq("http://localhost/api/v1/admin/trials", { method: "POST", body: badBody })
        );
        expect(resCreate.status).toBe(400);

        // PATCH /api/v1/admin/trials/:id
        const resPatch = await updateAdminTrial(
          adminReq(`http://localhost/api/v1/admin/trials/${testTrialId}`, { method: "PATCH", body: badBody }),
          dummyParams
        );
        expect(resPatch.status).toBe(400);

        // PUT /api/v1/admin/trials/:id/components
        const resComp = await replaceComponentsPut(
          adminReq(`http://localhost/api/v1/admin/trials/${testTrialId}/components`, { method: "PUT", body: badBody }),
          dummyParams
        );
        expect(resComp.status).toBe(400);

        // POST /api/v1/admin/trials/:id/assets
        const resAsset = await attachAsset(
          adminReq(`http://localhost/api/v1/admin/trials/${testTrialId}/assets`, { method: "POST", body: badBody }),
          dummyParams
        );
        expect(resAsset.status).toBe(400);

        // POST /api/v1/trials/:id/shipping-quote
        const resQuote = await getShippingQuote(
          publicReq(`http://localhost/api/v1/trials/${testTrialId}/shipping-quote`, { method: "POST", body: badBody }),
          dummyParams
        );
        expect(resQuote.status).toBe(400);
      }
    });

    it("4.2 rejects or neutralizes prototype pollution attempts without affecting Object prototype", async () => {
      const pollutionBody = JSON.stringify({
        __proto__: { isAdmin: true, pollutedKey: "injected" },
        constructor: { prototype: { isRoot: true } },
        title: "Pollution Attempt Kit",
        slug: "adv-pollution-attempt",
        price_paise: 50000,
        sku: "SKU-POLLUTION-1",
        components: [
          { slot_index: 0, name: "Tea 1", estate: "E1", grade: "G1", flush: "F1", weight_g: 50 },
          { slot_index: 1, name: "Tea 2", estate: "E2", grade: "G2", flush: "F2", weight_g: 50 },
          { slot_index: 2, name: "Tea 3", estate: "E3", grade: "G3", flush: "F3", weight_g: 50 },
          { slot_index: 3, name: "Tea 4", estate: "E4", grade: "G4", flush: "F4", weight_g: 50 },
        ],
      });

      await createAdminTrial(
        adminReq("http://localhost/api/v1/admin/trials", { method: "POST", body: pollutionBody })
      );

      // Verify Object prototype was NOT polluted
      expect((Object.prototype as unknown as { isAdmin?: boolean }).isAdmin).toBeUndefined();
      expect((Object.prototype as unknown as { pollutedKey?: string }).pollutedKey).toBeUndefined();
      expect((Object.prototype as unknown as { isRoot?: boolean }).isRoot).toBeUndefined();
    });

    it("4.3 rejects negative and non-integer financial numbers with HTTP 400", async () => {
      const invalidPrices = [-500, -1, 1.99, "not_a_price"];

      for (const badPrice of invalidPrices) {
        const payload = {
          title: "Bad Price Kit",
          slug: `adv-bad-price-${String(badPrice).replace(/[^a-z0-9]/gi, "")}`,
          price_paise: badPrice,
          sku: "SKU-BAD-PRICE",
          components: [
            { slot_index: 0, name: "T1", estate: "E", grade: "G", flush: "F", weight_g: 50 },
            { slot_index: 1, name: "T2", estate: "E", grade: "G", flush: "F", weight_g: 50 },
            { slot_index: 2, name: "T3", estate: "E", grade: "G", flush: "F", weight_g: 50 },
            { slot_index: 3, name: "T4", estate: "E", grade: "G", flush: "F", weight_g: 50 },
          ],
        };

        const res = await createAdminTrial(
          adminReq("http://localhost/api/v1/admin/trials", {
            method: "POST",
            body: JSON.stringify(payload),
          })
        );
        expect(res.status).toBe(400);
      }

      // Zero price is valid for drafts (unfinalized pricing until publication)
      const zeroPayload = {
        title: "Draft Zero Price Allowed",
        slug: "adv-zero-price-ok",
        price_paise: 0,
        sku: "SKU-ZERO-PRICE-OK",
        components: [
          { slot_index: 0, name: "T1", estate: "E", grade: "G", flush: "F", weight_g: 50 },
          { slot_index: 1, name: "T2", estate: "E", grade: "G", flush: "F", weight_g: 50 },
          { slot_index: 2, name: "T3", estate: "E", grade: "G", flush: "F", weight_g: 50 },
          { slot_index: 3, name: "T4", estate: "E", grade: "G", flush: "F", weight_g: 50 },
        ],
      };
      const resZero = await createAdminTrial(
        adminReq("http://localhost/api/v1/admin/trials", {
          method: "POST",
          body: JSON.stringify(zeroPayload),
        })
      );
      expect(resZero.status).toBe(201);
    });

    it("4.4 rejects negative inventory quantities and negative costs with HTTP 400", async () => {
      const resCost = await createAdminTrial(
        adminReq("http://localhost/api/v1/admin/trials", {
          method: "POST",
          body: JSON.stringify({
            title: "Negative Cost Kit",
            slug: "adv-neg-cost",
            price_paise: 50000,
            cost_paise: -1000,
            sku: "SKU-NEG-COST",
          }),
        })
      );
      expect(resCost.status).toBe(400);

      const resStock = await updateAdminTrial(
        adminReq(`http://localhost/api/v1/admin/trials/${testTrialId}`, {
          method: "PATCH",
          body: JSON.stringify({
            expected_revision: 1,
            inventory_quantity: -50,
          }),
        }),
        { params: Promise.resolve({ id: testTrialId }) }
      );
      expect(resStock.status).toBe(400);
    });

    it("4.5 rejects non-compliant component weights and slot distributions with HTTP 422 or 400", async () => {
      const dummyParams = { params: Promise.resolve({ id: testTrialId }) };

      // Case A: 3 components instead of 4 (150g != 200g)
      const res3 = await replaceComponentsPut(
        adminReq(`http://localhost/api/v1/admin/trials/${testTrialId}/components`, {
          method: "PUT",
          body: JSON.stringify({
            expected_revision: 1,
            components: [
              { slot_index: 0, name: "T1", estate: "E", grade: "G", flush: "F", weight_g: 50 },
              { slot_index: 1, name: "T2", estate: "E", grade: "G", flush: "F", weight_g: 50 },
              { slot_index: 2, name: "T3", estate: "E", grade: "G", flush: "F", weight_g: 50 },
            ],
          }),
        }),
        dummyParams
      );
      expect(res3.status).toBe(422);

      // Case B: 4 components but total weight 201g (50g, 50g, 50g, 51g)
      const resWeight = await replaceComponentsPut(
        adminReq(`http://localhost/api/v1/admin/trials/${testTrialId}/components`, {
          method: "PUT",
          body: JSON.stringify({
            expected_revision: 1,
            components: [
              { slot_index: 0, name: "T1", estate: "E", grade: "G", flush: "F", weight_g: 50 },
              { slot_index: 1, name: "T2", estate: "E", grade: "G", flush: "F", weight_g: 50 },
              { slot_index: 2, name: "T3", estate: "E", grade: "G", flush: "F", weight_g: 50 },
              { slot_index: 3, name: "T4", estate: "E", grade: "G", flush: "F", weight_g: 51 },
            ],
          }),
        }),
        dummyParams
      );
      expect(resWeight.status).toBe(422);

      // Case C: Duplicate slot index (0, 0, 1, 2)
      const resDup = await replaceComponentsPut(
        adminReq(`http://localhost/api/v1/admin/trials/${testTrialId}/components`, {
          method: "PUT",
          body: JSON.stringify({
            expected_revision: 1,
            components: [
              { slot_index: 0, name: "T1", estate: "E", grade: "G", flush: "F", weight_g: 50 },
              { slot_index: 0, name: "T2", estate: "E", grade: "G", flush: "F", weight_g: 50 },
              { slot_index: 1, name: "T3", estate: "E", grade: "G", flush: "F", weight_g: 50 },
              { slot_index: 2, name: "T4", estate: "E", grade: "G", flush: "F", weight_g: 50 },
            ],
          }),
        }),
        dummyParams
      );
      expect([400, 422]).toContain(resDup.status);
    });

    it("4.6 rejects invalid Indian PIN codes and quantities in shipping quote API with HTTP 400", async () => {
      const dummyParams = { params: Promise.resolve({ id: testTrialId }) };
      const invalidPincodes = [
        "011001", // Starts with 0
        "11000",  // 5 digits
        "1100001",// 7 digits
        "110 01", // Embedded space
        "11000a", // Alphanumeric
        "' OR '1'='1", // SQL injection
        "110001; DROP TABLE trials; --",
      ];

      for (const pin of invalidPincodes) {
        const res = await getShippingQuote(
          publicReq(`http://localhost/api/v1/trials/${testTrialId}/shipping-quote`, {
            method: "POST",
            body: JSON.stringify({ pincode: pin, quantity: 1 }),
          }),
          dummyParams
        );
        expect(res.status).toBe(400);
      }

      // Quantity boundary violations: min 1, max 50
      for (const qty of [0, -5, 51, 100]) {
        const res = await getShippingQuote(
          publicReq(`http://localhost/api/v1/trials/${testTrialId}/shipping-quote`, {
            method: "POST",
            body: JSON.stringify({ pincode: "110001", quantity: qty }),
          }),
          dummyParams
        );
        expect(res.status).toBe(400);
      }
    });

    it("4.7 safely neutralizes SQL injection attempts across query parameters, paths, and JSON bodies", async () => {
      // 1. SQLi in public catalogue query parameters
      const sqlSearchPayloads = [
        "' OR '1'='1",
        "'; DROP TABLE trials; --",
        "' UNION SELECT id, username, password_hash, role FROM admin_users --",
        "admin'--",
      ];

      for (const sqli of sqlSearchPayloads) {
        const res = await getPublicTrials(
          publicReq(`http://localhost/api/v1/trials?search=${encodeURIComponent(sqli)}`)
        );
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(Array.isArray(data.trials)).toBe(true);
      }

      // 2. SQLi in sort_by and sort_dir query parameters (Zod enum rejection)
      const badSorts = [
        "title; DROP TABLE trials; --",
        "(SELECT password_hash FROM admin_users)",
        "published_at' OR '1'='1",
      ];

      for (const badSort of badSorts) {
        const res = await getPublicTrials(
          publicReq(`http://localhost/api/v1/trials?sort_by=${encodeURIComponent(badSort)}`)
        );
        expect(res.status).toBe(400);
      }

      // 3. SQLi in slug and id path parameters
      const badPaths = [
        "' OR 1=1 --",
        "test-id'; DROP TABLE trials; --",
        "' UNION SELECT * FROM admin_users --",
      ];

      for (const badPath of badPaths) {
        // Public slug -> 404
        const resSlug = await getPublicTrialBySlug(
          publicReq(`http://localhost/api/v1/trials/${encodeURIComponent(badPath)}`),
          { params: Promise.resolve({ slug: badPath }) }
        );
        expect(resSlug.status).toBe(404);

        // Admin id -> 404
        const resAdmin = await getAdminTrial(
          adminReq(`http://localhost/api/v1/admin/trials/${encodeURIComponent(badPath)}`),
          { params: Promise.resolve({ id: badPath }) }
        );
        expect(resAdmin.status).toBe(404);
      }

      // 4. SQLi in request body text fields (parameterized inserts must store text literally)
      const sqliTitle = "Assam Black'; DROP TABLE trials; --";
      const sqliSlug = "adv-sqli-literal-test";
      const createRes = await createAdminTrial(
        adminReq("http://localhost/api/v1/admin/trials", {
          method: "POST",
          body: JSON.stringify({
            title: sqliTitle,
            slug: sqliSlug,
            price_paise: 45000,
            sku: "SKU-SQLI-TEST",
            components: [
              { slot_index: 0, name: "Tea 1", estate: "E", grade: "G", flush: "F", weight_g: 50 },
              { slot_index: 1, name: "Tea 2", estate: "E", grade: "G", flush: "F", weight_g: 50 },
              { slot_index: 2, name: "Tea 3", estate: "E", grade: "G", flush: "F", weight_g: 50 },
              { slot_index: 3, name: "Tea 4", estate: "E", grade: "G", flush: "F", weight_g: 50 },
            ],
          }),
        })
      );
      expect(createRes.status).toBe(201);
      const createdData = await createRes.json();
      expect(createdData.title).toBe(sqliTitle);

      // 5. Verify database integrity: trials table exists, trials count is intact
      const countCheck = db.prepare("SELECT COUNT(*) as count FROM trials").get() as { count: number };
      expect(countCheck.count).toBeGreaterThan(0);

      const tableCheck = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='trials'")
        .get() as { name: string } | undefined;
      expect(tableCheck?.name).toBe("trials");
    });
  });
});
