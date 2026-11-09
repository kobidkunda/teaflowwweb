import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { rmSync, readFileSync } from "node:fs";

// t3 verification: close the auth coverage gaps left by t2 — user CRUD
// authz (root-only + self/last-root guards), reset token expiry + single-use,
// per-account lockout, login rate-limit, session revocation/expiry, and the
// Bearer-must-401 negative contract. Isolated temp DB; never touches
// ./data/store.sqlite.
const TEST_DB = path.join(tmpdir(), `auth-verify-test-${process.pid}.sqlite`);
process.env.DATABASE_PATH = TEST_DB;
process.env.SESSION_SECRET = "auth-verify-secret-0123456789abcdef";
process.env.ADMIN_USERNAME = "root";
process.env.MCP_TOKEN = "auth-verify-mcp-token";

const ROOT_PASSWORD = "auth-verify-root-password-123";
const { hashPassword } = await import("../../src/lib/password");
process.env.ADMIN_PASSWORD_HASH = hashPassword(ROOT_PASSWORD);

const { POST: loginPOST } = await import("../../src/app/api/admin/login/route");
const { POST: logoutPOST } = await import("../../src/app/api/admin/logout/route");
const { GET: meGET } = await import("../../src/app/api/admin/me/route");
const { GET: usersGET, POST: usersPOST } = await import("../../src/app/api/admin/users/route");
const { PATCH: usersPATCH, DELETE: usersDELETE } = await import("../../src/app/api/admin/users/[id]/route");
const { POST: forgotPOST } = await import("../../src/app/api/admin/forgot/route");
const { POST: resetPOST } = await import("../../src/app/api/admin/reset/route");
const { guard } = await import("../../src/lib/adminHttp");
const { resetRateLimits } = await import("../../src/lib/rateLimit");
const { getDb } = await import("../../src/lib/db");

const sha256hex = (v: string) => createHash("sha256").update(v).digest("hex");
const cookieOf = (res: Response) => (res.headers.get("Set-Cookie") || "").split(";")[0];
const withIp = (headers: Record<string, string>, ip: string): Record<string, string> => ({
  ...headers,
  "X-Forwarded-For": ip,
});
const loginBody = (username: string, password: string, ip: string) =>
  new Request("http://x/api/admin/login", {
    method: "POST",
    headers: withIp({ "Content-Type": "application/json" }, ip),
    body: JSON.stringify({ username, password }),
  });

let ipCounter = 0;
const freshIp = () => `10.9.${Math.floor(ipCounter / 250)}.${(ipCounter++ % 250) + 1}`;
async function loginAs(username: string, password: string): Promise<{ status: number; cookie: string; id: number }> {
  const res = await loginPOST(loginBody(username, password, freshIp()));
  const body = (await res.json().catch(() => ({}))) as { user?: { id: number } };
  return { status: res.status, cookie: cookieOf(res), id: body.user?.id ?? -1 };
}

let rootCookie = "";
let rootId = -1;

beforeAll(async () => {
  execFileSync(process.execPath, ["scripts/migrate.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_PATH: TEST_DB },
    stdio: "ignore",
  });
  const root = await loginAs("root", ROOT_PASSWORD);
  if (root.status !== 200) throw new Error("root bootstrap login failed in test setup");
  rootCookie = root.cookie;
  rootId = root.id;
});

beforeEach(() => {
  resetRateLimits();
});

afterAll(() => {
  for (const suffix of ["", "-shm", "-wal", "-journal"]) {
    try {
      rmSync(TEST_DB + suffix, { force: true });
    } catch {
      /* ignore */
    }
  }
});

describe("login success/fail contract", () => {
  it("logs in with the env-bootstrapped root (200 + HttpOnly session cookie)", async () => {
    const res = await loginPOST(loginBody("root", ROOT_PASSWORD, freshIp()));
    expect(res.status).toBe(200);
    const setCookie = res.headers.get("Set-Cookie") || "";
    expect(setCookie).toMatch(/^admin_session=/);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Path=/");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = (await res.json()) as { ok: boolean; user: { username: string; role: string } };
    expect(body.ok).toBe(true);
    expect(body.user.username).toBe("root");
    expect(body.user.role).toBe("root");
    expect(JSON.stringify(body)).not.toContain("password_hash");
  });
  it("rejects a wrong password with a generic 401", async () => {
    const res = await loginPOST(loginBody("root", "wrong-password-123", freshIp()));
    expect(res.status).toBe(401);
    expect(((await res.json()) as { error: string }).error).toBe("Invalid username or password.");
  });
  it("gives unknown users and wrong passwords the identical 401 (no oracle)", async () => {
    const wrong = await loginPOST(loginBody("root", "wrong-password-123", freshIp()));
    const unknown = await loginPOST(loginBody("no-such-user-xyz", "wrong-password-123", freshIp()));
    expect(unknown.status).toBe(401);
    const [wrongText, unknownText] = [await wrong.text(), await unknown.text()];
    expect(unknownText).toBe(wrongText);
    expect((JSON.parse(unknownText) as { error: string }).error).toBe("Invalid username or password.");
  });
  it("rejects malformed credentials with 400, not 401", async () => {
    const res = await loginPOST(
      new Request("http://x/api/admin/login", {
        method: "POST",
        headers: withIp({ "Content-Type": "application/json" }, freshIp()),
        body: JSON.stringify({ username: "root" }),
      })
    );
    expect(res.status).toBe(400);
  });
});

describe("unauthorized admin API (Bearer must 401 by design)", () => {
  it("401s cookie-less reads with a generic body", async () => {
    const res = (await guard(new Request("http://x/api/admin/users", { headers: withIp({}, freshIp()) })))!;
    expect(res.status).toBe(401);
    expect(((await res.json()) as { error: string }).error).toBe("Unauthorized.");
  });
  it("401s the old Bearer header on reads and writes (negative contract)", async () => {
    const bearer = withIp({ Authorization: "Bearer auth-verify-secret-0123456789abcdef" }, freshIp());
    const read = (await guard(new Request("http://x/api/admin/users", { headers: bearer })))!;
    expect(read.status).toBe(401);
    const write = await usersPOST(
      new Request("http://x/api/admin/users", {
        method: "POST",
        headers: withIp({ "Content-Type": "application/json", Authorization: "Bearer x" }, freshIp()),
        body: JSON.stringify({ username: "bearer-staff", password: "long-enough-password-1" }),
      })
    );
    expect(write.status).toBe(401);
  });
  it("401s an expired session", async () => {
    const session = await loginAs("root", ROOT_PASSWORD);
    expect(session.status).toBe(200);
    // Expire ONLY this session's row (shared rootCookie belongs to the same
    // user and must keep working for later tests).
    const sid = session.cookie.split("=")[1].split(".")[0];
    getDb()
      .prepare("UPDATE admin_sessions SET expires_at='2000-01-01T00:00:00.000Z' WHERE token_hash=?")
      .run(sha256hex(sid));
    const res = await meGET(
      new Request("http://x/api/admin/me", { headers: withIp({ Cookie: session.cookie }, freshIp()) })
    );
    expect(res.status).toBe(401);
  });
  it("lets a valid session read /api/admin/me with no-store", async () => {
    const res = await meGET(
      new Request("http://x/api/admin/me", { headers: withIp({ Cookie: rootCookie }, freshIp()) })
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(((await res.json()) as { user: { username: string } }).user.username).toBe("root");
  });
  it("logout revokes the session (me → 401) and is idempotent", async () => {
    const session = await loginAs("root", ROOT_PASSWORD);
    expect(session.status).toBe(200);
    const out = await logoutPOST(
      new Request("http://x/api/admin/logout", {
        method: "POST",
        headers: withIp({ Cookie: session.cookie }, freshIp()),
      })
    );
    expect(out.status).toBe(200);
    expect((out.headers.get("Set-Cookie") || "")).toContain("Max-Age=0");
    const after = await meGET(
      new Request("http://x/api/admin/me", { headers: withIp({ Cookie: session.cookie }, freshIp()) })
    );
    expect(after.status).toBe(401);
    const again = await logoutPOST(new Request("http://x/api/admin/logout", { method: "POST" }));
    expect(again.status).toBe(200);
  });
});

describe("staff user CRUD authz (root-only)", () => {
  const staffCreds = { username: "verify-staff-1", password: "verify-staff-password-1" };
  let staffCookie = "";
  let staffId = -1;

  it("root creates a staff account (201)", async () => {
    const res = await usersPOST(
      new Request("http://x/api/admin/users", {
        method: "POST",
        headers: withIp({ "Content-Type": "application/json", Cookie: rootCookie }, freshIp()),
        body: JSON.stringify({ ...staffCreds, email: "staff-1@example.com", role: "admin" }),
      })
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { user: { id: number; username: string; role: string } };
    expect(body.user.username).toBe(staffCreds.username);
    expect(body.user.role).toBe("admin");
    expect(JSON.stringify(body)).not.toContain("password_hash");
    staffId = body.user.id;
  });
  it("the new staff account can log in", async () => {
    const s = await loginAs(staffCreds.username, staffCreds.password);
    expect(s.status).toBe(200);
    staffCookie = s.cookie;
  });
  it("non-root staff gets 403 on users list and create", async () => {
    const list = await usersGET(
      new Request("http://x/api/admin/users", { headers: withIp({ Cookie: staffCookie }, freshIp()) })
    );
    expect(list.status).toBe(403);
    const create = await usersPOST(
      new Request("http://x/api/admin/users", {
        method: "POST",
        headers: withIp({ "Content-Type": "application/json", Cookie: staffCookie }, freshIp()),
        body: JSON.stringify({ username: "verify-staff-2", password: "verify-staff-password-2" }),
      })
    );
    expect(create.status).toBe(403);
  });
  it("non-root staff gets 403 on patch and delete", async () => {
    const params = { params: Promise.resolve({ id: String(staffId) }) };
    const patched = await usersPATCH(
      new Request("http://x/api/admin/users/1", {
        method: "PATCH",
        headers: withIp({ "Content-Type": "application/json", Cookie: staffCookie }, freshIp()),
        body: JSON.stringify({ is_active: 1 }),
      }),
      params
    );
    expect(patched.status).toBe(403);
    const deleted = await usersDELETE(
      new Request("http://x/api/admin/users/1", {
        method: "DELETE",
        headers: withIp({ Cookie: staffCookie }, freshIp()),
      }),
      params
    );
    expect(deleted.status).toBe(403);
  });
  it("root lists users (200, no password hashes)", async () => {
    const res = await usersGET(
      new Request("http://x/api/admin/users", { headers: withIp({ Cookie: rootCookie }, freshIp()) })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { users: { username: string }[] };
    expect(body.users.map((u) => u.username)).toContain(staffCreds.username);
    expect(JSON.stringify(body)).not.toContain("password_hash");
  });
  it("duplicate usernames fail 409 with no raw DB text", async () => {
    const res = await usersPOST(
      new Request("http://x/api/admin/users", {
        method: "POST",
        headers: withIp({ "Content-Type": "application/json", Cookie: rootCookie }, freshIp()),
        body: JSON.stringify({ username: staffCreds.username, password: "another-long-password-1" }),
      })
    );
    expect(res.status).toBe(409);
    const text = await res.text();
    expect(text).not.toMatch(/sqlite|constraint|table|column|unique|database/i);
  });
  it("weak passwords fail 400 via Zod", async () => {
    const res = await usersPOST(
      new Request("http://x/api/admin/users", {
        method: "POST",
        headers: withIp({ "Content-Type": "application/json", Cookie: rootCookie }, freshIp()),
        body: JSON.stringify({ username: "verify-weak", password: "short" }),
      })
    );
    expect(res.status).toBe(400);
  });
  it("unknown and malformed ids give 404/400, not 500", async () => {
    const missing = await usersPATCH(
      new Request("http://x/api/admin/users/999999", {
        method: "PATCH",
        headers: withIp({ "Content-Type": "application/json", Cookie: rootCookie }, freshIp()),
        body: JSON.stringify({ is_active: 1 }),
      }),
      { params: Promise.resolve({ id: "999999" }) }
    );
    expect(missing.status).toBe(404);
    const malformed = await usersPATCH(
      new Request("http://x/api/admin/users/abc", {
        method: "PATCH",
        headers: withIp({ "Content-Type": "application/json", Cookie: rootCookie }, freshIp()),
        body: JSON.stringify({ is_active: 1 }),
      }),
      { params: Promise.resolve({ id: "abc" }) }
    );
    expect(malformed.status).toBe(400);
  });
  it("a root password change signs that account out everywhere", async () => {
    const before = await meGET(
      new Request("http://x/api/admin/me", { headers: withIp({ Cookie: staffCookie }, freshIp()) })
    );
    expect(before.status).toBe(200);
    const changed = await usersPATCH(
      new Request(`http://x/api/admin/users/${staffId}`, {
        method: "PATCH",
        headers: withIp({ "Content-Type": "application/json", Cookie: rootCookie }, freshIp()),
        body: JSON.stringify({ password: "verify-staff-password-2-rotated" }),
      }),
      { params: Promise.resolve({ id: String(staffId) }) }
    );
    expect(changed.status).toBe(200);
    const after = await meGET(
      new Request("http://x/api/admin/me", { headers: withIp({ Cookie: staffCookie }, freshIp()) })
    );
    expect(after.status).toBe(401);
    const relogin = await loginAs(staffCreds.username, "verify-staff-password-2-rotated");
    expect(relogin.status).toBe(200);
    staffCookie = relogin.cookie;
  });
  it("disabling a staff account blocks its login", async () => {
    const disabled = await usersPATCH(
      new Request(`http://x/api/admin/users/${staffId}`, {
        method: "PATCH",
        headers: withIp({ "Content-Type": "application/json", Cookie: rootCookie }, freshIp()),
        body: JSON.stringify({ is_active: 0 }),
      }),
      { params: Promise.resolve({ id: String(staffId) }) }
    );
    expect(disabled.status).toBe(200);
    const attempt = await loginAs(staffCreds.username, "verify-staff-password-2-rotated");
    expect(attempt.status).toBe(401);
    expect(((await (await loginPOST(loginBody(staffCreds.username, "verify-staff-password-2-rotated", freshIp()))).json()) as { error: string }).error).toBe(
      "Invalid username or password."
    );
  });
  it("root cannot disable or demote itself", async () => {
    const params = { params: Promise.resolve({ id: String(rootId) }) };
    const disableSelf = await usersPATCH(
      new Request(`http://x/api/admin/users/${rootId}`, {
        method: "PATCH",
        headers: withIp({ "Content-Type": "application/json", Cookie: rootCookie }, freshIp()),
        body: JSON.stringify({ is_active: 0 }),
      }),
      params
    );
    expect(disableSelf.status).toBe(409);
    const demoteSelf = await usersPATCH(
      new Request(`http://x/api/admin/users/${rootId}`, {
        method: "PATCH",
        headers: withIp({ "Content-Type": "application/json", Cookie: rootCookie }, freshIp()),
        body: JSON.stringify({ role: "admin" }),
      }),
      params
    );
    expect(demoteSelf.status).toBe(409);
    const deleteSelf = await usersDELETE(
      new Request(`http://x/api/admin/users/${rootId}`, {
        method: "DELETE",
        headers: withIp({ Cookie: rootCookie }, freshIp()),
      }),
      params
    );
    expect(deleteSelf.status).toBe(409);
  });
  it("root roles survive handoff: self-demote blocked, second root demotes and restores", async () => {
    // Self-demote is blocked (409) — the self-guard fires before the
    // last-root guard, which stays as TOCTOU defense-in-depth.
    const demoteSelf = await usersPATCH(
      new Request(`http://x/api/admin/users/${rootId}`, {
        method: "PATCH",
        headers: withIp({ "Content-Type": "application/json", Cookie: rootCookie }, freshIp()),
        body: JSON.stringify({ role: "admin" }),
      }),
      { params: Promise.resolve({ id: String(rootId) }) }
    );
    expect(demoteSelf.status).toBe(409);
    expect(((await demoteSelf.json()) as { error: string }).error).toBe("You cannot change your own role.");
    const second = await usersPOST(
      new Request("http://x/api/admin/users", {
        method: "POST",
        headers: withIp({ "Content-Type": "application/json", Cookie: rootCookie }, freshIp()),
        body: JSON.stringify({ username: "verify-root-2", password: "verify-root-2-password-1", role: "root" }),
      })
    );
    expect(second.status).toBe(201);
    const secondId = ((await second.json()) as { user: { id: number } }).user.id;
    // A second root demotes the first (cross-root, allowed while one root remains)...
    const secondLogin = await loginAs("verify-root-2", "verify-root-2-password-1");
    expect(secondLogin.status).toBe(200);
    const demoteFirst = await usersPATCH(
      new Request(`http://x/api/admin/users/${rootId}`, {
        method: "PATCH",
        headers: withIp({ "Content-Type": "application/json", Cookie: secondLogin.cookie }, freshIp()),
        body: JSON.stringify({ role: "admin" }),
      }),
      { params: Promise.resolve({ id: String(rootId) }) }
    );
    expect(demoteFirst.status).toBe(200);
    // ...and promotes it back, then is retired by the restored first root.
    const restore = await usersPATCH(
      new Request(`http://x/api/admin/users/${rootId}`, {
        method: "PATCH",
        headers: withIp({ "Content-Type": "application/json", Cookie: secondLogin.cookie }, freshIp()),
        body: JSON.stringify({ role: "root" }),
      }),
      { params: Promise.resolve({ id: String(rootId) }) }
    );
    expect(restore.status).toBe(200);
    const firstAgain = await loginAs("root", ROOT_PASSWORD);
    expect(firstAgain.status).toBe(200);
    const retire = await usersDELETE(
      new Request(`http://x/api/admin/users/${secondId}`, {
        method: "DELETE",
        headers: withIp({ Cookie: firstAgain.cookie }, freshIp()),
      }),
      { params: Promise.resolve({ id: String(secondId) }) }
    );
    expect(retire.status).toBe(200);
    rootCookie = firstAgain.cookie;
    // The helper the guard relies on: exactly one active root remains.
    const { countActiveRoots } = await import("../../src/lib/adminUsers");
    expect(countActiveRoots()).toBe(1);
    expect(countActiveRoots(rootId)).toBe(0);
  });
  it("DELETE deactivates (audit-safe) and revokes sessions", async () => {
    const made = await usersPOST(
      new Request("http://x/api/admin/users", {
        method: "POST",
        headers: withIp({ "Content-Type": "application/json", Cookie: rootCookie }, freshIp()),
        body: JSON.stringify({ username: "verify-doomed", password: "verify-doomed-password-1" }),
      })
    );
    expect(made.status).toBe(201);
    const doomedId = ((await made.json()) as { user: { id: number } }).user.id;
    const session = await loginAs("verify-doomed", "verify-doomed-password-1");
    expect(session.status).toBe(200);
    const removed = await usersDELETE(
      new Request(`http://x/api/admin/users/${doomedId}`, {
        method: "DELETE",
        headers: withIp({ Cookie: rootCookie }, freshIp()),
      }),
      { params: Promise.resolve({ id: String(doomedId) }) }
    );
    expect(removed.status).toBe(200);
    const relogin = await loginAs("verify-doomed", "verify-doomed-password-1");
    expect(relogin.status).toBe(401);
    const meAfter = await meGET(
      new Request("http://x/api/admin/me", { headers: withIp({ Cookie: session.cookie }, freshIp()) })
    );
    expect(meAfter.status).toBe(401);
    const row = getDb().prepare("SELECT is_active FROM admin_users WHERE id=?").get(doomedId) as {
      is_active: number;
    };
    expect(row.is_active).toBe(0);
  });
});

describe("per-account lockout (5 wrong → 15 min)", () => {
  it("locks after 5 failures and holds a correct password out with a generic 401", async () => {
    const made = await usersPOST(
      new Request("http://x/api/admin/users", {
        method: "POST",
        headers: withIp({ "Content-Type": "application/json", Cookie: rootCookie }, freshIp()),
        body: JSON.stringify({ username: "verify-locked", password: "verify-locked-password-1", email: "locked@example.com" }),
      })
    );
    expect(made.status).toBe(201);
    const ip = freshIp();
    for (let i = 0; i < 5; i++) {
      const res = await loginPOST(loginBody("verify-locked", "wrong-password-123", ip));
      expect(res.status).toBe(401);
    }
    const row = getDb().prepare("SELECT failed_attempts, locked_until FROM admin_users WHERE username=?").get(
      "verify-locked"
    ) as { failed_attempts: number; locked_until: string | null };
    expect(row.failed_attempts).toBeGreaterThanOrEqual(5);
    expect(row.locked_until).not.toBeNull();
    const correctWhileLocked = await loginPOST(loginBody("verify-locked", "verify-locked-password-1", freshIp()));
    expect(correctWhileLocked.status).toBe(401);
    expect(((await correctWhileLocked.json()) as { error: string }).error).toBe("Invalid username or password.");
  });
  it("unlocks after the lock window without revealing state", async () => {
    getDb()
      .prepare("UPDATE admin_users SET locked_until='2000-01-01T00:00:00.000Z' WHERE username=?")
      .run("verify-locked");
    const res = await loginAs("verify-locked", "verify-locked-password-1");
    expect(res.status).toBe(200);
  });
});

describe("login rate-limit (10/min/client → 429)", () => {
  it("sheds the 11th login from one client with Retry-After", async () => {
    const ip = freshIp();
    let lastStatus = 0;
    let last: Response | null = null;
    for (let i = 0; i < 11; i++) {
      last = await loginPOST(loginBody("no-such-user-rate", "wrong-password-123", ip));
      lastStatus = last.status;
      if (i < 10) expect(lastStatus).toBe(401);
    }
    expect(lastStatus).toBe(429);
    expect(last!.headers.get("Retry-After")).toMatch(/^\d+$/);
    expect(((await last!.json()) as { error: string }).error).toMatch(/too many requests/i);
  });
  it("a different client is unaffected by that shed", async () => {
    const res = await loginPOST(loginBody("no-such-user-rate", "wrong-password-123", freshIp()));
    expect(res.status).toBe(401);
  });
});

describe("password reset: generic forgot + single-use expiring tokens", () => {
  it("forgot answers {ok:true} for unknown emails without storing a token", async () => {
    const before = (getDb().prepare("SELECT COUNT(*) AS n FROM password_reset_tokens").get() as { n: number }).n;
    const res = await forgotPOST(
      new Request("http://x/api/admin/forgot", {
        method: "POST",
        headers: withIp({ "Content-Type": "application/json" }, freshIp()),
        body: JSON.stringify({ email: "nobody-knows-this@example.com" }),
      })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    const after = (getDb().prepare("SELECT COUNT(*) AS n FROM password_reset_tokens").get() as { n: number }).n;
    expect(after).toBe(before);
  });
  it("forgot answers the identical {ok:true} for a known email (no oracle) and stores a hash, not the token", async () => {
    const res = await forgotPOST(
      new Request("http://x/api/admin/forgot", {
        method: "POST",
        headers: withIp({ "Content-Type": "application/json" }, freshIp()),
        body: JSON.stringify({ email: "locked@example.com" }),
      })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    const row = getDb()
      .prepare("SELECT token_hash, used_at FROM password_reset_tokens WHERE user_id=(SELECT id FROM admin_users WHERE username='verify-locked') ORDER BY created_at DESC LIMIT 1")
      .get() as { token_hash: string; used_at: string | null };
    expect(row.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.used_at).toBeNull();
  });
  it("forgot rejects malformed emails with 400", async () => {
    const res = await forgotPOST(
      new Request("http://x/api/admin/forgot", {
        method: "POST",
        headers: withIp({ "Content-Type": "application/json" }, freshIp()),
        body: JSON.stringify({ email: "not-an-email" }),
      })
    );
    expect(res.status).toBe(400);
  });
  it("a valid token resets the password, revokes sessions, and is single-use", async () => {
    const made = await usersPOST(
      new Request("http://x/api/admin/users", {
        method: "POST",
        headers: withIp({ "Content-Type": "application/json", Cookie: rootCookie }, freshIp()),
        body: JSON.stringify({ username: "verify-reset", password: "verify-reset-password-1", email: "reset@example.com" }),
      })
    );
    expect(made.status).toBe(201);
    const userId = ((await made.json()) as { user: { id: number } }).user.id;
    const session = await loginAs("verify-reset", "verify-reset-password-1");
    expect(session.status).toBe(200);
    const raw = "r".repeat(64);
    getDb()
      .prepare("INSERT INTO password_reset_tokens (token_hash, user_id, expires_at) VALUES (?,?,?)")
      .run(sha256hex(raw), userId, new Date(Date.now() + 60 * 60 * 1000).toISOString());
    const reset = await resetPOST(
      new Request("http://x/api/admin/reset", {
        method: "POST",
        headers: withIp({ "Content-Type": "application/json" }, freshIp()),
        body: JSON.stringify({ token: raw, password: "verify-reset-password-2" }),
      })
    );
    expect(reset.status).toBe(200);
    expect(await reset.json()).toEqual({ ok: true });
    const reuse = await resetPOST(
      new Request("http://x/api/admin/reset", {
        method: "POST",
        headers: withIp({ "Content-Type": "application/json" }, freshIp()),
        body: JSON.stringify({ token: raw, password: "verify-reset-password-3" }),
      })
    );
    expect(reuse.status).toBe(400);
    expect(((await reuse.json()) as { error: string }).error).toBe("Invalid or expired reset link.");
    const oldSession = await meGET(
      new Request("http://x/api/admin/me", { headers: withIp({ Cookie: session.cookie }, freshIp()) })
    );
    expect(oldSession.status).toBe(401);
    const relogin = await loginAs("verify-reset", "verify-reset-password-2");
    expect(relogin.status).toBe(200);
    const staleLogin = await loginAs("verify-reset", "verify-reset-password-1");
    expect(staleLogin.status).toBe(401);
  });
  it("expired tokens fail 400 with the generic message", async () => {
    const userId = (getDb().prepare("SELECT id FROM admin_users WHERE username='verify-reset'").get() as { id: number }).id;
    const raw = "e".repeat(64);
    getDb()
      .prepare("INSERT INTO password_reset_tokens (token_hash, user_id, expires_at) VALUES (?,?,?)")
      .run(sha256hex(raw), userId, "2000-01-01T00:00:00.000Z");
    const res = await resetPOST(
      new Request("http://x/api/admin/reset", {
        method: "POST",
        headers: withIp({ "Content-Type": "application/json" }, freshIp()),
        body: JSON.stringify({ token: raw, password: "verify-reset-password-4" }),
      })
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe("Invalid or expired reset link.");
  });
  it("bogus tokens fail 400 without echoing the token", async () => {
    const raw = "f".repeat(64);
    const res = await resetPOST(
      new Request("http://x/api/admin/reset", {
        method: "POST",
        headers: withIp({ "Content-Type": "application/json" }, freshIp()),
        body: JSON.stringify({ token: raw, password: "verify-reset-password-5" }),
      })
    );
    expect(res.status).toBe(400);
    const text = await res.text();
    expect(text).not.toContain(raw);
  });
  it("tokens for deactivated accounts fail 400", async () => {
    const made = await usersPOST(
      new Request("http://x/api/admin/users", {
        method: "POST",
        headers: withIp({ "Content-Type": "application/json", Cookie: rootCookie }, freshIp()),
        body: JSON.stringify({ username: "verify-reset-gone", password: "verify-reset-gone-pass-1" }),
      })
    );
    expect(made.status).toBe(201);
    const userId = ((await made.json()) as { user: { id: number } }).user.id;
    const raw = "g".repeat(64);
    getDb()
      .prepare("INSERT INTO password_reset_tokens (token_hash, user_id, expires_at) VALUES (?,?,?)")
      .run(sha256hex(raw), userId, new Date(Date.now() + 60 * 60 * 1000).toISOString());
    getDb().prepare("UPDATE admin_users SET is_active=0 WHERE id=?").run(userId);
    const res = await resetPOST(
      new Request("http://x/api/admin/reset", {
        method: "POST",
        headers: withIp({ "Content-Type": "application/json" }, freshIp()),
        body: JSON.stringify({ token: raw, password: "verify-reset-gone-pass-2" }),
      })
    );
    expect(res.status).toBe(400);
  });
  it("weak reset passwords fail 400 via Zod", async () => {
    const res = await resetPOST(
      new Request("http://x/api/admin/reset", {
        method: "POST",
        headers: withIp({ "Content-Type": "application/json" }, freshIp()),
        body: JSON.stringify({ token: "h".repeat(64), password: "short" }),
      })
    );
    expect(res.status).toBe(400);
  });
});

describe("client bundle + login a11y static fences", () => {
  const adminClient = readFileSync(path.join(process.cwd(), "src/components/admin/AdminClient.tsx"), "utf8");
  const usersClient = readFileSync(path.join(process.cwd(), "src/components/admin/UsersClient.tsx"), "utf8");
  const resetClient = readFileSync(path.join(process.cwd(), "src/components/admin/ResetClient.tsx"), "utf8");
  it("no admin client ships secrets, tokens, or Authorization headers", () => {
    for (const [name, source] of [
      ["AdminClient", adminClient],
      ["UsersClient", usersClient],
      ["ResetClient", resetClient],
    ] as [string, string][]) {
      expect(source, name).not.toMatch(/SESSION_SECRET|ADMIN_PASSWORD|MCP_TOKEN|ADMIN_TOKEN/);
      // Header usage (quoted key + colon), not prose: AdminClient documents
      // "no Authorization header" in a comment, which must stay allowed.
      expect(source, name).not.toMatch(/["']Authorization["']\s*:/);
      expect(source, name).not.toMatch(/localStorage|sessionStorage/);
    }
  });
  it("the sign-in form is keyboard-native with labels, autocomplete, and live regions", () => {
    expect(adminClient).toContain('aria-label="Admin sign-in"');
    expect(adminClient).toContain("<label>");
    expect(adminClient).toContain('autoComplete="username"');
    expect(adminClient).toContain('autoComplete="current-password"');
    expect(adminClient).toContain('type="submit"');
    expect(adminClient).toContain('role="alert"');
    expect(adminClient).toContain('role="status"');
    expect(adminClient).toContain('aria-describedby="login-help"');
  });
  it("staff and reset consoles keep the same labelled-form + alert/status contract", () => {
    for (const source of [usersClient, resetClient]) {
      expect(source).toContain("<label>");
      expect(source).toContain('type="submit"');
      expect(source).toContain('role="alert"');
      expect(source).toContain('role="status"');
      expect(source).toContain("aria-label=");
    }
    expect(resetClient).toContain('type="email"');
    expect(usersClient).toContain('minLength={12}');
  });
  it("the mailer contract is graceful no-SMTP fallback + TLS-on-connect only", async () => {
    delete process.env.SMTP_HOST;
    const { sendMail } = await import("../../src/lib/email");
    const result = await sendMail({ to: "ops@example.com", subject: "t", text: "t" });
    expect(result.sent).toBe(false);
    const ops = readFileSync(path.join(process.cwd(), "docs/OPERATIONS.md"), "utf8");
    expect(ops).toContain("TLS-on-connect");
  });
});
