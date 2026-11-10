/**
 * TeaFloww Private Label Studio — Milestone M8 Iteration 3 Adversarial Challenger Suite
 * Agent: private_label_m8_iter3_challenger_1
 *
 * Verification Areas:
 * 1. Deep adversarial URI scheme fuzzing & protocol bypass attempts against qcMilestoneSchema:
 *    - Uppercase & mixed-case schemes (JAVASCRIPT:, JavaScript:, VBSCRIPT:)
 *    - Unsafe schemes: vbscript:, data:, file:, blob:, ftp:, sftp:, ws:, wss:, gopher:, mailto:, tel:
 *    - Relative paths & directory traversal: /qc/image.png, ../qc/image.png, ../../etc/passwd, //teafloww.com/qc/image.png
 *    - Null bytes & malformed syntax: http://teafloww.com%00.jpg, http://teafloww.com/\x00evil, javascript\x00:alert(1)
 *    - Port fuzzing: valid ports (80, 443, 8080, 65535) vs invalid ports (70000, abc)
 *    - Buffer overflow / string length limit: strings > 500 characters
 *    - Protocol-level malformations: http:, https:, http:/, http:///, http://, https://, ://invalid.com, httpp://foo.com
 *    - Uniformity across all 3 field aliases: evidencePhotoUrl, evidence_photo_url, evidence_url
 * 2. REST Endpoint PATCH /api/v1/admin/private-label/jobs/:id:
 *    - Strict HTTP 400 Bad Request rejection for all non-HTTP/HTTPS URLs, schemes, and evasions
 *    - Strict HTTP 200 Success for valid HTTP/HTTPS URLs, empty strings, null, and undefined
 * 3. MCP Tool private_label_record_qc:
 *    - Strict JSON-RPC code -32602 rejection for all non-HTTP/HTTPS URLs across evidence_url and evidence_photo_url
 *    - Strict success for valid HTTP/HTTPS URLs, empty strings, null, and undefined
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { rmSync } from "node:fs";

const TEST_DB = path.join(tmpdir(), `pl-m8-iter3-challenger-1-${process.pid}-${Date.now()}.sqlite`);
process.env.DATABASE_PATH = TEST_DB;
(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.ADMIN_TEST_TOKEN = "challenger_admin_m8_iter3_token_123";

import { getDb } from "@/lib/db";
import { PrivateLabelService } from "@/lib/private-label/service";
import { qcMilestoneSchema } from "@/lib/private-label/schemas";
import { dispatchToolCall, McpError } from "@/lib/mcp";
import {
  PATCH as patchJobDetail,
} from "@/app/api/v1/admin/private-label/jobs/[id]/route";

const ADMIN_HEADERS = {
  "Content-Type": "application/json",
  "x-admin-test-token": "challenger_admin_m8_iter3_token_123",
};

// Comprehensive list of adversarial evasion attempts
const ADVERSARIAL_SCHEME_EVASIONS = [
  // Uppercase & mixed case schemes
  "JAVASCRIPT:alert(1)",
  "JavaScript:alert(1)",
  "javaScript:void(0)",
  "VBSCRIPT:msgbox(1)",
  "vbscript:msgbox(1)",
  "VbScript:alert(1)",

  // Unsafe schemes
  "data:text/html,<script>alert(1)</script>",
  "DATA:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
  "data:image/svg+xml;utf8,<svg onload=alert(1)>",
  "file:///etc/passwd",
  "FILE:///c:/windows/system32/calc.exe",
  "file://localhost/etc/shadow",
  "blob:https://teafloww.com/d94f2766-3d2b-47df-88c9-0a3794348633",
  "BLOB:http://teafloww.com/uuid",
  "ftp://anonymous@foo.com/pub/file.jpg",
  "sftp://foo.com/uploads/test.png",
  "ws://echo.websocket.org",
  "wss://secure.websocket.org",
  "gopher://evil.com/1/test",
  "ldap://evil.com/dc=example,dc=com",
  "telnet://evil.com:23",
  "mailto:security@teafloww.com",
  "tel:+917001304853",
  "feed:https://teafloww.com/feed.xml",
  "about:blank",
];

const ADVERSARIAL_PATH_EVASIONS = [
  // Relative paths & directory traversal
  "/qc/image.png",
  "../qc/image.png",
  "../../etc/passwd",
  "../../../var/log/app.log",
  "qc/image.png",
  "./image.png",
  "//teafloww.com/qc/image.png",
  "///teafloww.com/qc/image.png",
  "\\\\teafloww.com\\qc\\image.png",
];

const ADVERSARIAL_PORT_EVASIONS = [
  // Ports exceeding 65535 or non-numeric ports
  "http://teafloww.com:70000/image.jpg",
  "https://teafloww.com:99999/image.jpg",
  "http://teafloww.com:abc/image.jpg",
  "https://teafloww.com:80a/image.jpg",
];

const ADVERSARIAL_STRING_LENGTH_EVASIONS = [
  // Strings exceeding the 500-character constraint
  "https://teafloww.com/qc/" + "a".repeat(500), // >520 chars
  "http://cdn.teafloww.com/evidence/" + "b".repeat(600), // >625 chars
  "https://example.com/" + "x".repeat(1000), // >1015 chars
];

const ADVERSARIAL_MALFORMED_EVASIONS = [
  // Scheme-only or malformed URI structures
  "http:",
  "https:",
  "http:/",
  "http:///",
  "http://",
  "https://",
  "://invalid.com",
  "httpp://teafloww.com",
  "httpz://teafloww.com",
  "http://teafloww.com%00.jpg",
  "javascript\x00:alert(1)",
];

const ALL_ADVERSARIAL_URLS = [
  ...ADVERSARIAL_SCHEME_EVASIONS,
  ...ADVERSARIAL_PATH_EVASIONS,
  ...ADVERSARIAL_PORT_EVASIONS,
  ...ADVERSARIAL_STRING_LENGTH_EVASIONS,
  ...ADVERSARIAL_MALFORMED_EVASIONS,
];

describe("Milestone M8 Iteration 3 Adversarial URL & Security Stress Suite", () => {
  let jobId: string;
  let orderId: string;

  beforeAll(() => {
    execFileSync(process.execPath, ["scripts/migrate.mjs"], {
      env: { ...process.env, DATABASE_PATH: TEST_DB },
    });

    const db = getDb();
    PrivateLabelService.seedInitialCatalog();

    db.prepare(`
      INSERT OR IGNORE INTO customers (id, email, name)
      VALUES ('cust_m8_iter3', 'iter3@example.com', 'Iter3 Test Customer')
    `).run();

    db.prepare(`
      INSERT OR IGNORE INTO pl_clients (id, customer_id, company_name, contact_name, contact_email)
      VALUES ('client_m8_iter3', 'cust_m8_iter3', 'Iter3 Brand Co', 'Tester', 'iter3@example.com')
    `).run();

    db.prepare(`
      INSERT OR IGNORE INTO pl_projects (id, client_id, owner_customer_id, title, status, target_market, revision)
      VALUES ('proj_m8_iter3_01', 'client_m8_iter3', 'cust_m8_iter3', 'Iter3 Project', 'draft', 'IN', 1)
    `).run();

    db.prepare(`
      INSERT OR IGNORE INTO pl_quotes (id, quote_number, project_id, price_book_id, status, version, currency, grand_total_paise, revision)
      VALUES ('quote_m8_iter3_01', 'PL-Q-ITER3-01', 'proj_m8_iter3_01', 'pb_default_inr', 'firm_issued', 1, 'INR', 200000, 1)
    `).run();

    orderId = `order_iter3_${Date.now()}`;
    db.prepare(`
      INSERT OR IGNORE INTO pl_orders (id, order_number, client_id, quote_id, status, deposit_paise, balance_paise, revision)
      VALUES (?, 'PL-ORD-ITER3-01', 'client_m8_iter3', 'quote_m8_iter3_01', 'deposit_paid', 100000, 100000, 1)
    `).run(orderId);

    jobId = `job_qc_iter3_${Date.now()}`;
    db.prepare(`
      INSERT OR IGNORE INTO pl_jobs (id, job_number, order_id, status, released_by)
      VALUES (?, 'PL-JOB-ITER3-01', ?, 'qc', 'admin_iter3')
    `).run(jobId, orderId);

    db.prepare(`
      INSERT OR IGNORE INTO pl_qc_milestones (id, job_id, stage, status)
      VALUES ('mil_iter3_seal', ?, 'seal_integrity', 'pending')
    `).run(jobId);
  });

  afterAll(() => {
    try {
      rmSync(TEST_DB, { force: true });
      rmSync(`${TEST_DB}-wal`, { force: true });
      rmSync(`${TEST_DB}-shm`, { force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  // ============================================================================
  // Suite 1: Direct Schema URL Validation Stress Tests (qcMilestoneSchema)
  // ============================================================================
  describe("Suite 1: Direct Schema URL Validation Stress Tests", () => {
    it("1.1 Rejects all adversarial evasion schemes across all 3 field aliases", () => {
      const aliases = ["evidencePhotoUrl", "evidence_photo_url", "evidence_url"] as const;

      for (const field of aliases) {
        for (const badUrl of ALL_ADVERSARIAL_URLS) {
          const result = qcMilestoneSchema.safeParse({
            stage: "seal_integrity",
            status: "passed",
            inspectorName: "Adversarial Inspector",
            [field]: badUrl,
          });

          expect(
            result.success,
            `Expected qcMilestoneSchema to REJECT bad URL "${badUrl.slice(0, 50)}..." on field "${field}", but it succeeded!`
          ).toBe(false);

          if (!result.success) {
            const issues = result.error.issues;
            const matchesUrlOrRegex = issues.some(
              (i) =>
                i.message.includes("Evidence photo must be an HTTP or HTTPS URL") ||
                i.message.includes("Evidence photo must be a valid URL") ||
                i.message.includes("Too big") ||
                i.code === "custom" ||
                i.code === "too_big" ||
                i.code === "invalid_format"
            );
            expect(matchesUrlOrRegex).toBe(true);
          }
        }
      }
    });

    it("1.2 Port fuzzing: accepts valid ports (80, 443, 8080, 65535) and rejects invalid ports (>65535, abc)", () => {
      const validPorts = [
        "http://teafloww.com:80/image.jpg",
        "https://teafloww.com:443/image.jpg",
        "http://teafloww.com:8080/image.jpg",
        "https://teafloww.com:65535/image.jpg",
      ];

      for (const validUrl of validPorts) {
        const res = qcMilestoneSchema.safeParse({
          stage: "seal_integrity",
          status: "passed",
          inspectorName: "Port Tester",
          evidencePhotoUrl: validUrl,
        });
        expect(res.success, `Expected valid port URL "${validUrl}" to succeed`).toBe(true);
        if (res.success) {
          expect(res.data.evidencePhotoUrl).toBe(validUrl);
        }
      }

      for (const badPortUrl of ADVERSARIAL_PORT_EVASIONS) {
        const res = qcMilestoneSchema.safeParse({
          stage: "seal_integrity",
          status: "passed",
          inspectorName: "Port Tester",
          evidencePhotoUrl: badPortUrl,
        });
        expect(res.success, `Expected invalid port URL "${badPortUrl}" to be rejected`).toBe(false);
      }
    });

    it("1.3 String length limit: rejects strings > 500 characters and accepts valid URLs <= 500 characters", () => {
      for (const longUrl of ADVERSARIAL_STRING_LENGTH_EVASIONS) {
        const res = qcMilestoneSchema.safeParse({
          stage: "seal_integrity",
          status: "passed",
          inspectorName: "Length Tester",
          evidence_url: longUrl,
        });
        expect(res.success, `Expected length > 500 URL to fail`).toBe(false);
      }

      // Valid boundary URL of ~250 characters
      const normalUrl = "https://teafloww.com/qc/reports/2026/11/batch-12345/milestone-seal-integrity-inspector-vikram-" + "x".repeat(100) + ".jpg";
      expect(normalUrl.length).toBeLessThan(500);

      const normalRes = qcMilestoneSchema.safeParse({
        stage: "seal_integrity",
        status: "passed",
        inspectorName: "Length Tester",
        evidence_url: normalUrl,
      });
      expect(normalRes.success).toBe(true);
      if (normalRes.success) {
        expect(normalRes.data.evidence_url).toBe(normalUrl);
      }
    });

    it("1.4 Accepts valid HTTP/HTTPS URLs, empty string, null, and undefined across all 3 aliases", () => {
      const validTestCases = [
        {
          input: "https://teafloww.com/qc/seal-check-01.jpg",
          expected: "https://teafloww.com/qc/seal-check-01.jpg",
        },
        {
          input: "http://storage.teafloww.com/evidence/2026/11/tea-cupping.png?token=safe123",
          expected: "http://storage.teafloww.com/evidence/2026/11/tea-cupping.png?token=safe123",
        },
        {
          input: "https://s3.ap-south-1.amazonaws.com/teafloww-qc/sample.webp",
          expected: "https://s3.ap-south-1.amazonaws.com/teafloww-qc/sample.webp",
        },
        { input: "", expected: undefined },
        { input: null, expected: undefined },
        { input: undefined, expected: undefined },
      ];

      const aliases = ["evidencePhotoUrl", "evidence_photo_url", "evidence_url"] as const;

      for (const field of aliases) {
        for (const { input, expected } of validTestCases) {
          const result = qcMilestoneSchema.safeParse({
            stage: "seal_integrity",
            status: "passed",
            inspectorName: "Valid Case Inspector",
            [field]: input,
          });

          expect(result.success, `Expected "${input}" on "${field}" to succeed`).toBe(true);
          if (result.success) {
            expect(result.data[field]).toBe(expected);
          }
        }
      }
    });
  });

  // ============================================================================
  // Suite 2: REST API Adversarial Stress Testing (PATCH /jobs/:id)
  // ============================================================================
  describe("Suite 2: REST Endpoint Adversarial Stress Testing", () => {
    it("2.1 PATCH /api/v1/admin/private-label/jobs/:id strictly rejects all evasion URLs with HTTP 400 Bad Request", async () => {
      const sampleEvasions = [
        "JAVASCRIPT:alert(1)",
        "JavaScript:alert(document.cookie)",
        "vbscript:msgbox(1)",
        "data:text/html,<script>alert(1)</script>",
        "file:///etc/passwd",
        "blob:https://teafloww.com/uuid",
        "/qc/image.png",
        "../qc/image.png",
        "http://teafloww.com:70000/image.jpg",
        "https://teafloww.com/qc/" + "a".repeat(500),
        "http://teafloww.com%00.jpg",
      ];

      const aliases = ["evidencePhotoUrl", "evidence_photo_url", "evidence_url"] as const;

      for (const field of aliases) {
        for (const badUrl of sampleEvasions) {
          const req = new Request(`http://localhost/api/v1/admin/private-label/jobs/${jobId}`, {
            method: "PATCH",
            headers: ADMIN_HEADERS,
            body: JSON.stringify({
              stage: "seal_integrity",
              status: "passed",
              inspectorName: "REST Adversary Tester",
              [field]: badUrl,
            }),
          });

          const res = await patchJobDetail(req, { params: Promise.resolve({ id: jobId }) });
          expect(
            res.status,
            `Expected HTTP 400 when submitting "${badUrl}" in "${field}", got HTTP ${res.status}`
          ).toBe(400);

          const body = await res.json();
          expect(body.error).toBe("Please check the submitted fields.");
          expect(body.detail).toBeDefined();
        }
      }
    });

    it("2.2 PATCH /api/v1/admin/private-label/jobs/:id succeeds with HTTP 200 for valid HTTP/HTTPS URLs, empty strings, and null", async () => {
      const validCases = [
        { label: "Valid HTTPS URL", url: "https://teafloww.com/qc/seal-success.jpg" },
        { label: "Valid HTTP URL", url: "http://teafloww.com/qc/seal-http.jpg" },
        { label: "Empty string (cleared)", url: "" },
        { label: "Null (cleared)", url: null },
      ];

      for (const { label, url } of validCases) {
        const req = new Request(`http://localhost/api/v1/admin/private-label/jobs/${jobId}`, {
          method: "PATCH",
          headers: ADMIN_HEADERS,
          body: JSON.stringify({
            stage: "seal_integrity",
            status: "passed",
            inspectorName: "REST Success Tester",
            evidencePhotoUrl: url,
          }),
        });

        const res = await patchJobDetail(req, { params: Promise.resolve({ id: jobId }) });
        expect(res.status, `Expected HTTP 200 for ${label}, got HTTP ${res.status}`).toBe(200);

        const body = await res.json();
        expect(body.id).toBe(jobId);
      }
    });
  });

  // ============================================================================
  // Suite 3: MCP Tool Adversarial Stress Testing (private_label_record_qc)
  // ============================================================================
  describe("Suite 3: MCP Tool Adversarial Stress Testing", () => {
    it("3.1 MCP tool private_label_record_qc strictly rejects all evasion URLs with JSON-RPC -32602", () => {
      const sampleEvasions = [
        "JAVASCRIPT:alert(1)",
        "JavaScript:alert(document.cookie)",
        "vbscript:msgbox(1)",
        "data:text/html,<script>alert(1)</script>",
        "file:///etc/passwd",
        "blob:https://teafloww.com/uuid",
        "/qc/image.png",
        "../qc/image.png",
        "http://teafloww.com:70000/image.jpg",
        "https://teafloww.com/qc/" + "a".repeat(500),
        "http://teafloww.com%00.jpg",
      ];

      // Test both evidence_url and evidence_photo_url fields
      for (const field of ["evidence_url", "evidence_photo_url"] as const) {
        for (const badUrl of sampleEvasions) {
          let thrownError: unknown = null;
          try {
            dispatchToolCall("private_label_record_qc", {
              job_id: jobId,
              stage: "seal_integrity",
              status: "passed",
              inspector_name: "MCP Adversary Tester",
              [field]: badUrl,
            });
          } catch (err) {
            thrownError = err;
          }

          expect(
            thrownError,
            `Expected dispatchToolCall to throw McpError for "${badUrl}" in "${field}"`
          ).toBeInstanceOf(McpError);

          const mcpErr = thrownError as McpError;
          expect(
            mcpErr.code,
            `Expected JSON-RPC error code -32602 for "${badUrl}", got ${mcpErr.code}`
          ).toBe(-32602);
        }
      }
    });

    it("3.2 MCP tool private_label_record_qc succeeds for valid HTTP/HTTPS URLs, empty string, null, and undefined", () => {
      const validCases = [
        { label: "Valid HTTPS URL", url: "https://teafloww.com/qc/mcp-evidence.jpg" },
        { label: "Valid HTTP URL", url: "http://teafloww.com/qc/mcp-evidence.jpg" },
        { label: "Empty string", url: "" },
        { label: "Null", url: null },
        { label: "Undefined", url: undefined },
      ];

      for (const { label, url } of validCases) {
        const result = dispatchToolCall("private_label_record_qc", {
          job_id: jobId,
          stage: "seal_integrity",
          status: "passed",
          inspector_name: "MCP Success Tester",
          evidence_url: url,
        });

        expect(result, `Expected dispatchToolCall to succeed for ${label}`).toBeDefined();
        const resObj = result as { stage?: string; status?: string };
        expect(resObj.stage).toBe("seal_integrity");
        expect(resObj.status).toBe("passed");
      }
    });
  });
});
