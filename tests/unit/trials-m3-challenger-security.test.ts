/**
 * TeaFloww Trials v3 — Milestone 3 MCP Tool Parity Adversarial Security & Non-Repudiation Test Suite
 *
 * Authored by: trials_m3_challenger_2 (Empirical Adversarial Testing Challenger)
 * Focus Areas:
 * 1. Endpoint Auth Stress on /api/mcp (HTTP 401, JSON-RPC -32001, token query param vs Bearer header vs admin session)
 * 2. Schema & Argument Fuzzing (expected_revision boundaries, XSS in alt_text, alt_text validation, SQL injection defense, prototype pollution)
 * 3. Audit Log Non-Repudiation (actor_type === 'mcp' on all mutating tools, actor_type forgery resistance, SQLite CHECK constraints)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { rmSync } from "node:fs";
import { NextRequest } from "next/server";

import { POST as mcpPOST, GET as mcpGET, DELETE as mcpDELETE } from "@/app/api/mcp/route";
import { dispatchToolCall, McpError } from "@/lib/mcp";
import { getDb } from "@/lib/db";
import { createAdminSession } from "@/lib/adminSessions";
import { resetRateLimits } from "@/lib/rateLimit";
import type { TrialWithDetails } from "@/lib/trials/types";

const TEST_DB = path.join(tmpdir(), `trials-m3-challenger-${process.pid}-${Date.now()}.sqlite`);
process.env.DATABASE_PATH = TEST_DB;

const VALID_MCP_TOKEN = "teafloww_mcp_secret_token_challenger_999";
let ipCounter = 1;

function callTool<T = any>(name: string, args: unknown): T {
  return dispatchToolCall(name, args) as T;
}

function expectToolError(name: string, args: unknown, expectedCode: number): McpError {
  try {
    dispatchToolCall(name, args);
  } catch (err) {
    expect(err).toBeInstanceOf(McpError);
    const mcpErr = err as McpError;
    expect(mcpErr.code).toBe(expectedCode);
    return mcpErr;
  }
  throw new Error(`Expected tool "${name}" to throw McpError with code ${expectedCode}`);
}

function makeMcpRequest(
  urlPath: string,
  options: {
    method?: string;
    body?: unknown;
    cookie?: string | null;
    headers?: Record<string, string>;
  } = {}
): NextRequest {
  const fullUrl = `http://localhost:3000${urlPath}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-forwarded-for": `10.99.7.${(ipCounter++ % 240) + 1}`,
    ...(options.headers || {}),
  };
  if (options.cookie) {
    headers["Cookie"] = options.cookie;
  }
  return new NextRequest(fullUrl, {
    method: options.method || "POST",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}

const SAMPLE_COMPONENTS = [
  {
    slot_index: 0,
    name: "Darjeeling First Flush Makaibari",
    estate: "Makaibari Estate",
    grade: "FTGFOP1",
    flush: "Spring 2026",
    elevation: "1500m",
    weight_g: 50,
    quantity: 1,
    tasting_notes: ["Floral", "Muscatel"],
    brew_temp_c: 85,
    brew_time_sec: 180,
    leaf_dose_g: 2.5,
  },
  {
    slot_index: 1,
    name: "Assam Golden CTC Blend",
    estate: "Halmari Estate",
    grade: "BOP Clonal",
    flush: "Second Flush 2026",
    elevation: "120m",
    weight_g: 50,
    quantity: 1,
    tasting_notes: ["Malty", "Caramel"],
    brew_temp_c: 95,
    brew_time_sec: 240,
    leaf_dose_g: 2.5,
  },
  {
    slot_index: 2,
    name: "Kangra Highland Green",
    estate: "Dharmsala Tea Co",
    grade: "Special Green",
    flush: "Summer 2026",
    elevation: "1400m",
    weight_g: 50,
    quantity: 1,
    tasting_notes: ["Sweet Hay", "Pine"],
    brew_temp_c: 80,
    brew_time_sec: 120,
    leaf_dose_g: 2.0,
  },
  {
    slot_index: 3,
    name: "Nilgiri Frost Oolong",
    estate: "Glendale Estate",
    grade: "Twirl Oolong",
    flush: "Winter Frost 2026",
    elevation: "1850m",
    weight_g: 50,
    quantity: 1,
    tasting_notes: ["Honey", "Apricot"],
    brew_temp_c: 90,
    brew_time_sec: 210,
    leaf_dose_g: 2.5,
  },
];

describe("TeaFloww Trials v3 — Milestone 3 Adversarial Security & Non-Repudiation Suite", () => {
  let adminCookie: string;

  beforeAll(() => {
    execFileSync(process.execPath, ["scripts/migrate.mjs"], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_PATH: TEST_DB },
      stdio: "ignore",
    });

    const db = getDb();
    db.prepare(`
      INSERT OR IGNORE INTO admin_users (id, username, password_hash, role)
      VALUES (1, 'rootadmin', 'dummy_hash', 'root')
    `).run();
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
    resetRateLimits();
    vi.stubEnv("COMMERCE_MOCK_PROVIDERS", "1");
    vi.stubEnv("SESSION_SECRET", "test_session_secret_for_signing_admin_cookies_32_bytes_len");
    vi.stubEnv("MCP_TOKEN", VALID_MCP_TOKEN);

    const session = createAdminSession(1);
    adminCookie = `admin_session=${session.cookieValue}`;

    const db = getDb();
    db.prepare("DELETE FROM trials WHERE slug LIKE 'sec-%' OR slug LIKE 'fuzz-%' OR slug LIKE 'audit-%'").run();
  });

  // ===========================================================================
  // Task 1: Endpoint Auth Stress on /api/mcp
  // ===========================================================================
  describe("Task 1: Endpoint Auth Stress on /api/mcp", () => {
    it("1.1: rejects requests with no token and no admin session with HTTP 401 and JSON-RPC -32001", async () => {
      const req = makeMcpRequest("/api/mcp", {
        body: { jsonrpc: "2.0", id: 1, method: "tools/list" },
      });
      const res = await mcpPOST(req);
      expect(res.status).toBe(401);

      const json = await res.json();
      expect(json).toEqual({
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32001,
          message: "Unauthorized.",
        },
      });
    });

    it("1.2: rejects requests with invalid or forged query tokens with HTTP 401 and JSON-RPC -32001", async () => {
      const forgedTokens = [
        "wrong_token",
        "teafloww_mcp_secret_token_challenger_998",
        "forged' OR 1=1 --",
        "admin",
        "Bearer " + VALID_MCP_TOKEN,
        VALID_MCP_TOKEN + "_extra",
        VALID_MCP_TOKEN.slice(0, -1),
      ];

      for (const token of forgedTokens) {
        const req = makeMcpRequest(`/api/mcp?token=${encodeURIComponent(token)}`, {
          body: { jsonrpc: "2.0", id: "stress-token", method: "tools/list" },
        });
        const res = await mcpPOST(req);
        expect(res.status).toBe(401);
        const json = await res.json();
        expect(json.error.code).toBe(-32001);
      }
    });

    it("1.3: rejects requests with Bearer Authorization header when query token is missing", async () => {
      const req = makeMcpRequest("/api/mcp", {
        headers: {
          Authorization: `Bearer ${VALID_MCP_TOKEN}`,
        },
        body: { jsonrpc: "2.0", id: "bearer-test", method: "tools/list" },
      });
      const res = await mcpPOST(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error.code).toBe(-32001);
    });

    it("1.4: rejects requests with forged or tampered admin session cookie with HTTP 401", async () => {
      const forgedCookies = [
        "admin_session=forged.signature",
        "admin_session=12345678901234567890123456789012.invalidhmac",
        "admin_session=",
        "other_cookie=xyz",
      ];

      for (const cookie of forgedCookies) {
        const req = makeMcpRequest("/api/mcp", {
          cookie,
          body: { jsonrpc: "2.0", id: "cookie-test", method: "tools/list" },
        });
        const res = await mcpPOST(req);
        expect(res.status).toBe(401);
        const json = await res.json();
        expect(json.error.code).toBe(-32001);
      }
    });

    it("1.5: rejects requests when query token is empty string (?token=)", async () => {
      const req = makeMcpRequest("/api/mcp?token=", {
        body: { jsonrpc: "2.0", id: "empty-token", method: "tools/list" },
      });
      const res = await mcpPOST(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error.code).toBe(-32001);
    });

    it("1.6: accepts requests with valid token query parameter matching MCP_TOKEN (HTTP 200)", async () => {
      const req = makeMcpRequest(`/api/mcp?token=${VALID_MCP_TOKEN}`, {
        body: { jsonrpc: "2.0", id: "auth-success-token", method: "tools/list" },
      });
      const res = await mcpPOST(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.jsonrpc).toBe("2.0");
      expect(json.id).toBe("auth-success-token");
      expect(json.result).toHaveProperty("tools");
      expect(Array.isArray(json.result.tools)).toBe(true);

      const toolNames = json.result.tools.map((t: any) => t.name);
      expect(toolNames).toContain("trial_list");
      expect(toolNames).toContain("trial_get");
      expect(toolNames).toContain("trial_create");
    });

    it("1.7: accepts requests with valid admin session cookie (HTTP 200)", async () => {
      const req = makeMcpRequest("/api/mcp", {
        cookie: adminCookie,
        body: { jsonrpc: "2.0", id: "auth-success-cookie", method: "tools/list" },
      });
      const res = await mcpPOST(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.jsonrpc).toBe("2.0");
      expect(json.id).toBe("auth-success-cookie");
      expect(json.result).toHaveProperty("tools");
    });

    it("1.8: rejects unauthorized GET and DELETE requests on /api/mcp with HTTP 401", async () => {
      const getReq = makeMcpRequest("/api/mcp", { method: "GET" });
      const getRes = mcpGET(getReq);
      expect(getRes.status).toBe(401);

      const delReq = makeMcpRequest("/api/mcp", { method: "DELETE" });
      const delRes = mcpDELETE(delReq);
      expect(delRes.status).toBe(401);
    });

    it("1.9: rejects authorized GET and DELETE requests on /api/mcp with HTTP 405 (Method Not Allowed) and Allow: POST", async () => {
      const getReq = makeMcpRequest(`/api/mcp?token=${VALID_MCP_TOKEN}`, { method: "GET" });
      const getRes = mcpGET(getReq);
      expect(getRes.status).toBe(405);
      expect(getRes.headers.get("Allow")).toBe("POST");

      const delReq = makeMcpRequest(`/api/mcp?token=${VALID_MCP_TOKEN}`, { method: "DELETE" });
      const delRes = mcpDELETE(delReq);
      expect(delRes.status).toBe(405);
      expect(delRes.headers.get("Allow")).toBe("POST");
    });

    it("1.10: returns HTTP 400 and JSON-RPC -32700 on malformed JSON payload", async () => {
      const fullUrl = `http://localhost:3000/api/mcp?token=${VALID_MCP_TOKEN}`;
      const req = new NextRequest(fullUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "10.99.7.1" },
        body: "{ malformed json ::: invalid",
      });
      const res = await mcpPOST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe(-32700);
    });

    it("1.11: returns HTTP 400 and JSON-RPC -32600 on invalid JSON-RPC structure", async () => {
      // Missing jsonrpc or missing method
      const invalidRequests = [
        { id: 1, method: "tools/list" }, // missing jsonrpc: "2.0"
        { jsonrpc: "1.0", id: 2, method: "tools/list" }, // invalid jsonrpc version
        { jsonrpc: "2.0", id: 3 }, // missing method
        { jsonrpc: "2.0", id: 4, method: 123 }, // non-string method
      ];

      for (const body of invalidRequests) {
        const req = makeMcpRequest(`/api/mcp?token=${VALID_MCP_TOKEN}`, { body });
        const res = await mcpPOST(req);
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error.code).toBe(-32600);
      }
    });

    it("1.12: unknown JSON-RPC method returns HTTP 200 with JSON-RPC error -32601", async () => {
      const req = makeMcpRequest(`/api/mcp?token=${VALID_MCP_TOKEN}`, {
        body: { jsonrpc: "2.0", id: "unknown-method", method: "unsupported/method" },
      });
      const res = await mcpPOST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.error.code).toBe(-32601);
    });

    it("1.13: processes JSON-RPC batch array requests over /api/mcp correctly", async () => {
      const batchBody = [
        { jsonrpc: "2.0", id: "b1", method: "ping" },
        { jsonrpc: "2.0", id: "b2", method: "tools/list" },
      ];
      const req = makeMcpRequest(`/api/mcp?token=${VALID_MCP_TOKEN}`, { body: batchBody });
      const res = await mcpPOST(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(Array.isArray(json)).toBe(true);
      expect(json).toHaveLength(2);
      expect(json[0].id).toBe("b1");
      expect(json[1].id).toBe("b2");
    });
  });

  // ===========================================================================
  // Task 2: Schema & Argument Fuzzing
  // ===========================================================================
  describe("Task 2: Schema & Argument Fuzzing", () => {
    let testTrial: any;

    beforeEach(() => {
      testTrial = callTool("trial_create", {
        title: "Fuzz Test Trial Kit",
        slug: "fuzz-test-kit",
        tagline: "Exploring Himalayan Teas",
        description: "Four exquisite seasonal teas from Darjeeling and Assam.",
        price_paise: 25000,
        sku: "FUZZ-TEST-001",
        inventory_quantity: 10,
        components: SAMPLE_COMPONENTS,
      });
      expect(testTrial.revision).toBe(1);
    });

    it("2.1: trial_update rejects negative expected_revision (-1, -100) with -32009 revision conflict", () => {
      const negativeRevs = [-1, -100, -999999];
      for (const rev of negativeRevs) {
        const err = expectToolError("trial_update", {
          id: testTrial.id,
          expected_revision: rev,
          title: "Attacking Negative Revision",
        }, -32009);
        expect(err.message).toMatch(/conflict|revision mismatch/i);
      }
    });

    it("2.2: trial_update rejects zero expected_revision (0) with -32009 revision conflict", () => {
      const err = expectToolError("trial_update", {
        id: testTrial.id,
        expected_revision: 0,
        title: "Attacking Zero Revision",
      }, -32009);
      expect(err.message).toMatch(/conflict|revision mismatch/i);
    });

    it("2.3: trial_update rejects floating-point expected_revision (1.5, 2.7) with -32602", () => {
      const floats = [1.5, 2.7, 0.1, -1.5];
      for (const rev of floats) {
        const err = expectToolError("trial_update", {
          id: testTrial.id,
          expected_revision: rev,
          title: "Attacking Float Revision",
        }, -32602);
        expect(err.message).toMatch(/check the tool arguments/i);
      }
    });

    it("2.4: trial_update rejects non-numeric string expected_revision with -32602 or -32009", () => {
      const nonNumerics = ["abc", "NaN", "null", "undefined", "{}", "1e10foo"];
      for (const rev of nonNumerics) {
        const err = expectToolError("trial_update", {
          id: testTrial.id,
          expected_revision: rev,
          title: "Attacking Non-Numeric Revision",
        }, -32602);
        expect(err.message).toMatch(/check the tool arguments/i);
      }

      // Empty string coerces to 0 in JS Number(""), triggering revision conflict -32009
      const emptyStrErr = expectToolError("trial_update", {
        id: testTrial.id,
        expected_revision: "",
        title: "Attacking Empty String Revision",
      }, -32009);
      expect(emptyStrErr.message).toMatch(/conflict|revision mismatch/i);
    });

    it("2.5: trial_update rejects missing or undefined expected_revision with -32602", () => {
      const err = expectToolError("trial_update", {
        id: testTrial.id,
        title: "Missing expected_revision",
      }, -32602);
      expect(err.message).toMatch(/check the tool arguments/i);
    });

    it("2.6: trial_update rejects null expected_revision safely without modifying state", () => {
      // In JS, Number(null) is 0, which triggers CAS conflict -32009 or -32602
      try {
        callTool("trial_update", {
          id: testTrial.id,
          expected_revision: null,
          title: "Null Revision Attack",
        });
        expect.unreachable("Should have thrown error on null expected_revision");
      } catch (err: any) {
        expect(err).toBeInstanceOf(McpError);
        expect([-32009, -32602]).toContain(err.code);
      }

      // Verify trial remained at revision 1 and title did not change
      const current = callTool<TrialWithDetails>("trial_get", { id: testTrial.id });
      expect(current.revision).toBe(1);
      expect(current.title).toBe("Fuzz Test Trial Kit");
    });

    it("2.7: trial_update safely coerces valid numeric string expected_revision ('1') and succeeds", () => {
      const updated = callTool<TrialWithDetails>("trial_update", {
        id: testTrial.id,
        expected_revision: "1",
        title: "Updated Title via Numeric String Revision",
      });
      expect(updated.revision).toBe(2);
      expect(updated.title).toBe("Updated Title via Numeric String Revision");
    });

    it("2.8: trial_media_attach accepts script tags / XSS in alt_text as safe string literals", () => {
      const xssPayloads = [
        "<script>alert('xss')</script>",
        "\"><img src=x onerror=alert(1)>",
        "Tea Pouch <svg onload=fetch('http://attacker.com')>",
        "javascript:/*--></title></style></textarea></script></xmp><svg/onload='+/\"/+/onmouseover=1/+/[*/[]/+alert(1)//'>",
      ];

      let currentRev = testTrial.revision;
      for (let i = 0; i < xssPayloads.length; i++) {
        const payload = xssPayloads[i];
        const res = callTool<TrialWithDetails>("trial_media_attach", {
          id: testTrial.id,
          expected_revision: currentRev,
          slot_index: i % 4,
          stage: "dry_leaf",
          asset_url: `https://images.teafloww.com/trials/fuzz-${i}.jpg`,
          alt_text: payload,
        });

        expect(res.revision).toBe(currentRev + 1);
        currentRev = res.revision;

        // Fetch dossier and assert alt_text matches payload verbatim without escaping damage
        const dossier = callTool<TrialWithDetails>("trial_get", { id: testTrial.id });
        const attached = dossier.assets.find((a) => a.alt_text === payload);
        expect(attached).toBeDefined();
        expect(attached?.alt_text).toBe(payload);
      }
    });

    it("2.9: trial_media_attach rejects missing alt_text with -32602", () => {
      const err = expectToolError("trial_media_attach", {
        id: testTrial.id,
        expected_revision: testTrial.revision,
        slot_index: 0,
        stage: "packaging",
        asset_url: "https://images.teafloww.com/trials/no-alt.jpg",
      }, -32602);
      expect(err.message).toMatch(/check the tool arguments/i);
    });

    it("2.10: trial_media_attach rejects empty string alt_text with -32602", () => {
      const err = expectToolError("trial_media_attach", {
        id: testTrial.id,
        expected_revision: testTrial.revision,
        slot_index: 0,
        stage: "packaging",
        asset_url: "https://images.teafloww.com/trials/empty-alt.jpg",
        alt_text: "",
      }, -32602);
      expect(err.message).toMatch(/check the tool arguments/i);
    });

    it("2.11: trial_media_attach rejects whitespace-only alt_text with -32602", () => {
      const whitespacePayloads = [" ", "   ", "\t\t", "\n\n  "];
      for (const alt of whitespacePayloads) {
        const err = expectToolError("trial_media_attach", {
          id: testTrial.id,
          expected_revision: testTrial.revision,
          slot_index: 0,
          stage: "packaging",
          asset_url: "https://images.teafloww.com/trials/ws-alt.jpg",
          alt_text: alt,
        }, -32602);
        expect(err.message).toMatch(/check the tool arguments/i);
      }
    });

    it("2.12: trial_media_attach rejects single-character alt_text ('a') with -32602", () => {
      const err = expectToolError("trial_media_attach", {
        id: testTrial.id,
        expected_revision: testTrial.revision,
        slot_index: 0,
        stage: "packaging",
        asset_url: "https://images.teafloww.com/trials/short-alt.jpg",
        alt_text: "a",
      }, -32602);
      expect(err.message).toMatch(/check the tool arguments/i);
    });

    it("2.13: trial_media_attach safely handles SQL injection payload in alt_text without damaging assets table", () => {
      const sqlInjectionAlt = "'; DROP TABLE trial_assets; --";
      const attached = callTool<TrialWithDetails>("trial_media_attach", {
        id: testTrial.id,
        expected_revision: testTrial.revision,
        slot_index: 0,
        stage: "packaging",
        asset_url: "https://images.teafloww.com/trials/sqli-alt.jpg",
        alt_text: sqlInjectionAlt,
      });
      expect(attached.revision).toBe(testTrial.revision + 1);

      // Verify trial_assets table still exists and contains the verbatim alt_text
      const db = getDb();
      const assetRow = db.prepare("SELECT * FROM trial_assets WHERE alt_text = ?").get(sqlInjectionAlt) as any;
      expect(assetRow).toBeDefined();
      expect(assetRow.alt_text).toBe(sqlInjectionAlt);
    });

    it("2.14: trial_get safely rejects SQL injection payloads in id and slug with -32004", () => {
      const sqliPayloads = [
        "' OR 1=1 --",
        "'; DROP TABLE trials; --",
        "\" OR \"\"=\"",
        "admin' UNION SELECT * FROM trials --",
        "1' AND 1=(SELECT COUNT(*) FROM trial_audit) --",
        "' OR 'x'='x",
      ];

      for (const payload of sqliPayloads) {
        // Query by id
        const errId = expectToolError("trial_get", { id: payload }, -32004);
        expect(errId.message).toMatch(/not found/i);

        // Query by slug
        const errSlug = expectToolError("trial_get", { slug: payload }, -32004);
        expect(errSlug.message).toMatch(/not found/i);

        // Query by idOrSlug
        const errBoth = expectToolError("trial_get", { idOrSlug: payload }, -32004);
        expect(errBoth.message).toMatch(/not found/i);
      }

      // Assert trials table was not damaged or dropped
      const db = getDb();
      const count = db.prepare("SELECT COUNT(*) as count FROM trials").get() as { count: number };
      expect(count.count).toBeGreaterThanOrEqual(1);
    });

    it("2.15: prototype pollution attack payloads do not pollute Object.prototype", () => {
      const pollutionPayloads = [
        JSON.parse('{"__proto__": {"polluted": true, "isAdmin": true, "actor_type": "admin"}}'),
        JSON.parse('{"constructor": {"prototype": {"polluted": true, "role": "root"}}}'),
      ];

      for (const payload of pollutionPayloads) {
        try {
          callTool("trial_update", {
            id: testTrial.id,
            expected_revision: testTrial.revision,
            ...payload,
          });
        } catch {}

        // Assert global Object prototype was never polluted
        expect((Object.prototype as any).polluted).toBeUndefined();
        expect((Object.prototype as any).isAdmin).toBeUndefined();
        expect((Object.prototype as any).role).toBeUndefined();
        expect((Object.prototype as any).actor_type).toBeUndefined();
      }
    });
  });

  // ===========================================================================
  // Task 3: Audit Log Non-Repudiation & Constraint Enforcement
  // ===========================================================================
  describe("Task 3: Audit Log Non-Repudiation & Constraint Enforcement", () => {
    it("3.1: all 8 mutating MCP tools record actor_type = 'mcp' in SQLite trial_audit table", () => {
      const db = getDb();

      // Mutation 1: trial_create (rev 1)
      const trial1 = callTool<TrialWithDetails>("trial_create", {
        title: "Audit Non-Repudiation Trial Kit",
        slug: "audit-non-repudiation-kit",
        tagline: "Authentic Tasting Journey",
        description: "Four regional master teas from Darjeeling, Assam, Kangra and Nilgiri.",
        price_paise: 29900,
        sku: "AUDIT-NON-REP-01",
        inventory_quantity: 50,
        components: SAMPLE_COMPONENTS,
      });
      expect(trial1.revision).toBe(1);

      // Mutation 2: trial_update (rev 2)
      const trial2 = callTool<TrialWithDetails>("trial_update", {
        id: trial1.id,
        expected_revision: 1,
        meta_title: "Audit Non-Repudiation Kit | TeaFloww Trials",
        meta_description: "Explore 4 unique mountain flushes with certified provenance.",
      });
      expect(trial2.revision).toBe(2);

      // Mutation 3: trial_components_replace (rev 3)
      const trial3 = callTool<TrialWithDetails>("trial_components_replace", {
        id: trial1.id,
        expected_revision: 2,
        components: SAMPLE_COMPONENTS,
      });
      expect(trial3.revision).toBe(3);

      // Mutation 4: trial_media_attach (rev 4)
      const trial4 = callTool<TrialWithDetails>("trial_media_attach", {
        id: trial1.id,
        expected_revision: 3,
        slot_index: 0,
        stage: "packaging",
        asset_url: "https://images.teafloww.com/trials/audit-box.jpg",
        alt_text: "Four airtight tin pouches with gold emboss seals",
      });
      expect(trial4.revision).toBe(4);

      // Mutation 5: trial_submit_review (rev 5)
      const trial5 = callTool<TrialWithDetails>("trial_submit_review", {
        id: trial1.id,
        expected_revision: 4,
      });
      expect(trial5.revision).toBe(5);
      expect(trial5.status).toBe("in_review");

      // Mutation 6: trial_publish (rev 6)
      const trial6 = callTool<TrialWithDetails>("trial_publish", {
        id: trial1.id,
        expected_revision: 5,
      });
      expect(trial6.revision).toBe(6);
      expect(trial6.status).toBe("published");

      // Mutation 7: trial_unpublish (rev 7)
      const trial7 = callTool<TrialWithDetails>("trial_unpublish", {
        id: trial1.id,
        expected_revision: 6,
      });
      expect(trial7.revision).toBe(7);
      expect(trial7.status).toBe("draft");

      // Mutation 8: trial_archive (rev 8)
      const trial8 = callTool<TrialWithDetails>("trial_archive", {
        id: trial1.id,
        expected_revision: 7,
      });
      expect(trial8.revision).toBe(8);
      expect(trial8.status).toBe("archived");

      // Inspect SQLite trial_audit directly
      const auditRows = db.prepare(
        "SELECT * FROM trial_audit WHERE trial_id = ? ORDER BY revision ASC"
      ).all(trial1.id) as any[];

      expect(auditRows).toHaveLength(8);

      const expectedActions = [
        "create_draft",
        "update",
        "replace_components",
        "attach_asset",
        "submit_review",
        "publish",
        "unpublish",
        "archive",
      ];

      for (let i = 0; i < 8; i++) {
        const row = auditRows[i];
        expect(row.revision).toBe(i + 1);
        expect(row.action).toBe(expectedActions[i]);
        // Strict assertion: actor_type must be 'mcp'
        expect(row.actor_type).toBe("mcp");
        // Strict assertion: default actor_id must be 'mcp-agent'
        expect(row.actor_id).toBe("mcp-agent");
        expect(row.actor_email).toBe("mcp-agent@teafloww.com");
      }
    });

    it("3.2: records custom actor_id when passed by caller, but preserves actor_type = 'mcp'", () => {
      const trial = callTool<TrialWithDetails>("trial_create", {
        title: "Custom Actor Trial Kit",
        slug: "sec-custom-actor-kit",
        price_paise: 20000,
        sku: "SEC-ACTOR-01",
        actor_id: "agent-gemini-pro-42",
        reason: "Automated batch catalogue sync",
      });

      const db = getDb();
      const row = db.prepare(
        "SELECT * FROM trial_audit WHERE trial_id = ? AND revision = 1"
      ).get(trial.id) as any;

      expect(row).toBeDefined();
      expect(row.actor_type).toBe("mcp");
      expect(row.actor_id).toBe("agent-gemini-pro-42");
      expect(row.reason).toBe("Automated batch catalogue sync");
    });

    it("3.3: forgery attack: actor_type passed in tool arguments is neutralized and CANNOT be forged to 'admin' or 'system'", () => {
      const trial = callTool<TrialWithDetails>("trial_create", {
        title: "Forged Actor Type Trial",
        slug: "sec-forged-actor-kit",
        price_paise: 20000,
        sku: "SEC-FORGE-01",
        actor_type: "admin", // Attacker trying to masquerade as admin
        actor_id: "admin-root",
      });

      const db = getDb();
      const rowCreate = db.prepare(
        "SELECT * FROM trial_audit WHERE trial_id = ? AND revision = 1"
      ).get(trial.id) as any;

      expect(rowCreate.actor_type).toBe("mcp"); // MUST NOT be 'admin'

      // Try forging actor_type in trial_update
      callTool("trial_update", {
        id: trial.id,
        expected_revision: 1,
        title: "Attempting System Forgery",
        actor_type: "system", // Attacker trying to masquerade as system
      });

      const rowUpdate = db.prepare(
        "SELECT * FROM trial_audit WHERE trial_id = ? AND revision = 2"
      ).get(trial.id) as any;

      expect(rowUpdate.actor_type).toBe("mcp"); // MUST NOT be 'system'
    });

    it("3.4: SQLite CHECK constraint on trial_audit prevents invalid actor_type values at the database level", () => {
      const db = getDb();
      const trial = callTool<TrialWithDetails>("trial_create", {
        title: "DB Constraint Test Trial",
        slug: "sec-db-constraint-kit",
        price_paise: 20000,
        sku: "SEC-CHECK-01",
      });

      const invalidActorTypes = [
        "attacker",
        "root",
        "superuser",
        "hacker",
        "anonymous",
        "api_key",
        "",
      ];

      for (const invalidType of invalidActorTypes) {
        expect(() => {
          db.prepare(`
            INSERT INTO trial_audit (
              id, trial_id, revision, action, actor_type, actor_id, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `).run(
            `audit-fake-${Date.now()}-${Math.random()}`,
            trial.id,
            99,
            "forged_action",
            invalidType,
            "malicious-entity"
          );
        }).toThrow(/CHECK constraint failed:.*actor_type/i);
      }

      // Valid enum values must succeed directly in DB
      const validEnumValues = ["admin", "mcp", "system", "customer"];
      for (const validType of validEnumValues) {
        const id = `audit-valid-${validType}-${Date.now()}`;
        db.prepare(`
          INSERT INTO trial_audit (
            id, trial_id, revision, action, actor_type, actor_id, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(id, trial.id, 100, "test_action", validType, "test-actor");

        const row = db.prepare("SELECT actor_type FROM trial_audit WHERE id = ?").get(id) as any;
        expect(row.actor_type).toBe(validType);
      }
    });

    it("3.5: trial_history tool returns non-repudiable audit logs matching direct SQLite rows", () => {
      const trial = callTool<TrialWithDetails>("trial_create", {
        title: "History Parity Trial",
        slug: "sec-history-parity-kit",
        price_paise: 20000,
        sku: "SEC-HIST-01",
      });

      callTool("trial_update", {
        id: trial.id,
        expected_revision: 1,
        title: "History Parity Trial (Updated)",
      });

      const historyResult = callTool<{ history: any[]; total: number }>("trial_history", {
        id: trial.id,
      });

      expect(historyResult.total).toBe(2);
      expect(historyResult.history).toHaveLength(2);
      expect(historyResult.history[0].actor_type).toBe("mcp");
      expect(historyResult.history[1].actor_type).toBe("mcp");
      // History is sorted revision DESC (revision 2 is index 0, revision 1 is index 1)
      expect(historyResult.history[0].revision).toBe(2);
      expect(historyResult.history[0].action).toBe("update");
      expect(historyResult.history[1].revision).toBe(1);
      expect(historyResult.history[1].action).toBe("create_draft");
    });
  });
});
