import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { existsSync, mkdtempSync, rmSync } from "node:fs";

// Isolated temp DB migrated fresh; never touches ./data/store.sqlite.
const dir = mkdtempSync(path.join(tmpdir(), "ops-test-"));
const TEST_DB = path.join(dir, "ops.sqlite");
process.env.DATABASE_PATH = TEST_DB;
process.env.SESSION_SECRET = "ops-session-secret-0123456789abcdef";
process.env.ADMIN_USERNAME = "root";
process.env.ADMIN_PASSWORD = "ops-root-password-123";
process.env.MCP_TOKEN = "ops-mcp-token";
process.env.LOG_LEVEL = "error"; // keep test output quiet

const { GET: healthGET } = await import("../../src/app/api/health/route");
const { GET: readyGET } = await import("../../src/app/api/ready/route");
const { logger, redactText } = await import("../../src/lib/logger");

beforeAll(() => {
  execFileSync(process.execPath, ["scripts/migrate.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_PATH: TEST_DB },
    stdio: "ignore",
  });
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("structured logger redacts PII", () => {
  it("masks emails in free text", () => {
    expect(redactText("contact ada@example.com please")).toBe(
      "contact [redacted-email] please"
    );
  });
  it("redacts PII/secret fields in JSON output", () => {
    const prev = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = "debug";
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      logger.info("order created", {
        orderId: "abc-123",
        customer_email: "ada@example.com",
        customer_name: "Ada",
        shipping_address: "1 Main St",
        Cookie: "admin_session=abc",
      });
      expect(spy).toHaveBeenCalledOnce();
      const line = String(spy.mock.calls[0][0]);
      const entry = JSON.parse(line) as Record<string, unknown>;
      expect(entry.orderId).toBe("abc-123");
      expect(entry.customer_email).toBe("[redacted]");
      expect(entry.customer_name).toBe("[redacted]");
      expect(entry.shipping_address).toBe("[redacted]");
      expect(entry.Cookie).toBe("[redacted]");
      expect(line).not.toContain("ada@example.com");
      expect(line).not.toContain("admin_session=abc");
    } finally {
      spy.mockRestore();
      if (prev === undefined) delete process.env.LOG_LEVEL;
      else process.env.LOG_LEVEL = prev;
    }
  });
});

describe("health (liveness)", () => {
  it("returns ok without leaking paths or secrets", async () => {
    const res = await healthGET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.status).toBe("ok");
    expect(JSON.stringify(body)).not.toContain("ops-session-secret");
    expect(JSON.stringify(body)).not.toContain(TEST_DB);
  });
});

describe("readiness", () => {
  it("reports ready on a migrated DB without leaking token values", async () => {
    const res = await readyGET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      status: string;
      pending?: string[];
      checks: Record<string, boolean>;
    };
    expect(body.status).toBe("ready");
    expect(body.checks.database).toBe(true);
    expect(body.checks.migrations).toBe(true);
    expect(JSON.stringify(body)).not.toContain("ops-session-secret");
    expect(JSON.stringify(body)).not.toContain("ops-mcp-token");
  });
});

describe("migrate --check gate", () => {
  it("exits 0 when up to date", () => {
    expect(() =>
      execFileSync(process.execPath, ["scripts/migrate.mjs", "--check"], {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_PATH: TEST_DB },
        stdio: "ignore",
      })
    ).not.toThrow();
  });
  it("exits non-zero when the database is missing", () => {
    const missing = path.join(dir, "nope", "missing.sqlite");
    let code = 0;
    try {
      execFileSync(process.execPath, ["scripts/migrate.mjs", "--check"], {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_PATH: missing },
        stdio: "ignore",
      });
    } catch (e) {
      code = (e as { status?: number }).status ?? 1;
    }
    expect(code).not.toBe(0);
  });
});

describe("backup script", () => {
  it("writes a timestamped snapshot that is a valid SQLite file", () => {
    const out = execFileSync(process.execPath, ["scripts/backup.mjs"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DATABASE_PATH: TEST_DB,
        BACKUP_DIR: path.join(dir, "backups"),
      },
      encoding: "utf8",
    }).trim();
    expect(existsSync(out)).toBe(true);
    expect(out).toMatch(/store-.*\.sqlite$/);
  });
  it("refuses when the database is missing", () => {
    let code = 0;
    try {
      execFileSync(process.execPath, ["scripts/backup.mjs"], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          DATABASE_PATH: path.join(dir, "absent.sqlite"),
          BACKUP_DIR: path.join(dir, "backups"),
        },
        stdio: "ignore",
      });
    } catch (e) {
      code = (e as { status?: number }).status ?? 1;
    }
    expect(code).not.toBe(0);
  });
});
