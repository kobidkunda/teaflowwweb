import { getDb } from "@/lib/db";
import { logger } from "@/lib/logger";
import { hashPassword, isHashFormat } from "@/lib/password";

export type AdminUserRow = {
  id: number;
  username: string;
  email: string | null;
  password_hash: string;
  role: string;
  is_active: number;
  failed_attempts: number;
  locked_until: string | null;
  created_at: string;
};

export type SafeAdminUser = {
  id: number;
  username: string;
  role: string;
};

export const MAX_ATTEMPTS = 5;
export const LOCK_MS = 15 * 60 * 1000;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

function hasAuthTables(): boolean {
  try {
    const row = getDb()
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='admin_users'")
      .get() as { name?: string } | undefined;
    return Boolean(row?.name);
  } catch {
    return false;
  }
}

export function getUserByUsername(username: string): AdminUserRow | undefined {
  if (!hasAuthTables()) return undefined;
  try {
    return getDb().prepare("SELECT * FROM admin_users WHERE username=?").get(normalizeUsername(username)) as
      | AdminUserRow
      | undefined;
  } catch {
    return undefined;
  }
}

export function getUserById(id: number): AdminUserRow | undefined {
  if (!hasAuthTables()) return undefined;
  try {
    return getDb().prepare("SELECT * FROM admin_users WHERE id=?").get(id) as AdminUserRow | undefined;
  } catch {
    return undefined;
  }
}

export function getUserByEmail(email: string): AdminUserRow | undefined {
  if (!hasAuthTables()) return undefined;
  try {
    return getDb().prepare("SELECT * FROM admin_users WHERE email=?").get(email.trim().toLowerCase()) as
      | AdminUserRow
      | undefined;
  } catch {
    return undefined;
  }
}

export function toSafeUser(row: AdminUserRow): SafeAdminUser {
  return { id: row.id, username: row.username, role: row.role };
}

export function listAdminUsers(): Array<Pick<AdminUserRow, "id" | "username" | "email" | "role" | "is_active" | "created_at">> {
  return getDb()
    .prepare("SELECT id, username, email, role, is_active, created_at FROM admin_users ORDER BY id")
    .all() as Array<Pick<AdminUserRow, "id" | "username" | "email" | "role" | "is_active" | "created_at">>;
}

function tableReady(): void {
  if (!hasAuthTables()) throw new Error("Auth tables are not migrated.");
}

export function createAdminUser(input: { username: string; password: string; role?: string; email?: string }): SafeAdminUser {
  tableReady();
  const username = normalizeUsername(input.username);
  const role = input.role ?? "admin";
  if (role !== "root" && role !== "admin") throw new Error("Unknown role.");
  const email = input.email ? input.email.trim().toLowerCase() : null;
  const db = getDb();
  const exists = db.prepare("SELECT id FROM admin_users WHERE username=?").get(username) as { id: number } | undefined;
  if (exists) throw new Error("Username already exists.");
  if (email) {
    const emailTaken = db.prepare("SELECT id FROM admin_users WHERE email=?").get(email) as { id: number } | undefined;
    if (emailTaken) throw new Error("Email already exists.");
  }
  const info = db
    .prepare("INSERT INTO admin_users (username, email, password_hash, role) VALUES (?,?,?,?)")
    .run(username, email, hashPassword(input.password), role);
  const row = getUserById(Number(info.lastInsertRowid));
  if (!row) throw new Error("Unable to create the user.");
  return toSafeUser(row);
}

export function setUserActive(id: number, active: boolean): void {
  tableReady();
  getDb().prepare("UPDATE admin_users SET is_active=? WHERE id=?").run(active ? 1 : 0, id);
}

export function setUserRole(id: number, role: string): void {
  tableReady();
  if (role !== "root" && role !== "admin") throw new Error("Unknown role.");
  getDb().prepare("UPDATE admin_users SET role=? WHERE id=?").run(role, id);
}

export function setUserEmail(id: number, email: string | null): void {
  tableReady();
  getDb().prepare("UPDATE admin_users SET email=? WHERE id=?").run(email ? email.trim().toLowerCase() : null, id);
}

export function updateUserPassword(id: number, password: string): void {
  tableReady();
  getDb()
    .prepare("UPDATE admin_users SET password_hash=?, failed_attempts=0, locked_until=NULL WHERE id=?")
    .run(hashPassword(password), id);
}

export function countActiveRoots(excludeId?: number): number {
  const rows = getDb()
    .prepare("SELECT id FROM admin_users WHERE role='root' AND is_active=1")
    .all() as { id: number }[];
  return excludeId === undefined ? rows.length : rows.filter((r) => r.id !== excludeId).length;
}

export function isLocked(row: AdminUserRow, now = Date.now()): boolean {
  if (!row.locked_until) return false;
  const until = Date.parse(row.locked_until);
  if (!Number.isFinite(until)) return false;
  if (now >= until) {
    try {
      getDb().prepare("UPDATE admin_users SET failed_attempts=0, locked_until=NULL WHERE id=?").run(row.id);
    } catch {
      /* best-effort unlock */
    }
    return false;
  }
  return true;
}

export function recordFailedAttempt(row: AdminUserRow): void {
  try {
    const attempts = (row.failed_attempts || 0) + 1;
    if (attempts >= MAX_ATTEMPTS) {
      const until = new Date(Date.now() + LOCK_MS).toISOString();
      getDb().prepare("UPDATE admin_users SET failed_attempts=?, locked_until=? WHERE id=?").run(attempts, until, row.id);
    } else {
      getDb().prepare("UPDATE admin_users SET failed_attempts=? WHERE id=?").run(attempts, row.id);
    }
  } catch {
    /* fail-closed: lockout write failure never blocks the 401 */
  }
}

export function resetLockout(id: number): void {
  try {
    getDb().prepare("UPDATE admin_users SET failed_attempts=0, locked_until=NULL WHERE id=?").run(id);
  } catch {
    /* best-effort */
  }
}

// Boot-only root bootstrap: creates the first admin from env when the table
// is empty. Prefers ADMIN_PASSWORD_HASH (scrypt, via gen-admin-hash); falls
// back to hashing ADMIN_PASSWORD once. Never overwrites, never logs secrets.
export function ensureRootBootstrap(): AdminUserRow | null {
  if (!hasAuthTables()) return null;
  try {
    const db = getDb();
    const count = (db.prepare("SELECT COUNT(*) AS n FROM admin_users").get() as { n: number }).n;
    if (count > 0) return null;
    const username = normalizeUsername(process.env.ADMIN_USERNAME || "");
    const hash = (process.env.ADMIN_PASSWORD_HASH || "").trim();
    const plain = process.env.ADMIN_PASSWORD || "";
    if (!username) return null;
    let passwordHash = "";
    if (hash && isHashFormat(hash)) passwordHash = hash;
    else if (plain) {
      passwordHash = hashPassword(plain);
      logger.warn("root bootstrapped from ADMIN_PASSWORD; set ADMIN_PASSWORD_HASH and unset ADMIN_PASSWORD", {
        route: "/api/admin/login",
      });
    } else return null;
    const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase() || null;
    db.prepare("INSERT INTO admin_users (username, email, password_hash, role) VALUES (?,?,?,?)").run(
      username,
      email,
      passwordHash,
      "root"
    );
    logger.info("root admin bootstrapped", { route: "/api/admin/login" });
    return getUserByUsername(username) ?? null;
  } catch {
    return null;
  }
}

export function upsertAdminUser(input: {
  id?: number;
  username: string;
  email?: string | null;
  password?: string;
  role?: string;
  is_active?: number | boolean;
}): SafeAdminUser {
  tableReady();
  const username = normalizeUsername(input.username);
  const target = input.id ? getUserById(input.id) : getUserByUsername(username);

  if (target) {
    if (input.role) {
      if (target.role === "root" && input.role !== "root" && countActiveRoots(target.id) < 1) {
        throw new Error("At least one active root must remain.");
      }
      setUserRole(target.id, input.role);
    }
    if (input.email !== undefined) {
      setUserEmail(target.id, input.email);
    }
    if (input.is_active !== undefined) {
      const active = Boolean(input.is_active);
      if (target.role === "root" && !active && countActiveRoots(target.id) < 1) {
        throw new Error("At least one active root must remain.");
      }
      setUserActive(target.id, active);
    }
    if (input.password) {
      updateUserPassword(target.id, input.password);
    }
    return toSafeUser(getUserById(target.id)!);
  }

  if (!input.password) {
    throw new Error("Password is required when creating a new admin user.");
  }

  return createAdminUser({
    username,
    password: input.password,
    role: input.role,
    email: input.email ?? undefined,
  });
}

export function deleteAdminUser(id: number): boolean {
  tableReady();
  const user = getUserById(id);
  if (!user) return false;
  if (user.role === "root" && countActiveRoots(id) < 1) {
    throw new Error("At least one active root must remain.");
  }
  const db = getDb();
  // Also delete sessions
  try {
    db.prepare("DELETE FROM admin_sessions WHERE user_id = ?").run(id);
  } catch { /* ignore */ }
  const info = db.prepare("DELETE FROM admin_users WHERE id = ?").run(id);
  return info.changes > 0;
}
