import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { hashPassword } from "@/lib/password";
import { createAdminSession, SESSION_COOKIE } from "@/lib/adminSessions";
import { resetRateLimits } from "@/lib/rateLimit";

export interface TestEnv {
  dbPath: string;
  db: InstanceType<typeof Database>;
  cleanup: () => void;
}

export const TEST_ROOT_PASSWORD = "test-root-password-123";
export const TEST_STAFF_PASSWORD = "test-staff-password-123";

/**
 * Initializes an isolated ephemeral SQLite database for test suites,
 * executes migrations, ensures expansion tables exist, and seeds baseline fixtures.
 */
export function setupAdminTestEnv(): TestEnv {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "admin-e2e-"));
  const dbPath = path.join(tmpDir, "test.sqlite");

  process.env.DATABASE_PATH = dbPath;
  process.env.SESSION_SECRET = "test-session-secret-0123456789abcdef0123456789abcdef";
  process.env.ADMIN_USERNAME = "root";
  process.env.ADMIN_PASSWORD_HASH = hashPassword(TEST_ROOT_PASSWORD);
  process.env.MCP_TOKEN = "test-mcp-token-super-secret-123";

  // Run existing migrations (including 009_admin_portal_expansion.mjs)
  execFileSync(process.execPath, ["scripts/migrate.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_PATH: dbPath },
    stdio: "ignore",
  });

  const db = new Database(dbPath);

  // Seed default store settings if missing
  const insertSetting = db.prepare("INSERT OR IGNORE INTO store_settings (key, value) VALUES (?, ?)");
  insertSetting.run("store_name", "Himalayan Tea House");
  insertSetting.run("contact_email", "concierge@himalayanteahouse.com");
  insertSetting.run("currency_code", "INR");
  insertSetting.run("currency", "INR");
  insertSetting.run("gst_tax_rate_percent", "5");
  insertSetting.run("tax_rate_percent", "5");
  insertSetting.run("shipping_flat_fee_paise", "9900");
  insertSetting.run("shipping_fee_paise", "9900");
  insertSetting.run("free_shipping_threshold_paise", "150000");

  // Ensure root user exists in admin_users
  const rootExists = db.prepare("SELECT id FROM admin_users WHERE username = 'root'").get() as { id: number } | undefined;
  let rootId = rootExists?.id;
  if (!rootExists) {
    const info = db.prepare(
      "INSERT INTO admin_users (username, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?)"
    ).run("root", "root@himalayanteahouse.com", hashPassword(TEST_ROOT_PASSWORD), "root", 1);
    rootId = Number(info.lastInsertRowid);
  }

  // Ensure staff user exists in admin_users
  const staffExists = db.prepare("SELECT id FROM admin_users WHERE username = 'staff_admin'").get() as { id: number } | undefined;
  if (!staffExists) {
    db.prepare(
      "INSERT INTO admin_users (username, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?)"
    ).run("staff_admin", "staff@himalayanteahouse.com", hashPassword(TEST_STAFF_PASSWORD), "admin", 1);
  }

  resetRateLimits();

  return {
    dbPath,
    db,
    cleanup: () => {
      try {
        db.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
    },
  };
}

/**
 * Creates an authorized session cookie for a given role ('root' or 'admin').
 */
export function getAuthCookie(db: InstanceType<typeof Database>, role: "root" | "admin" = "root"): string {
  const username = role === "root" ? "root" : "staff_admin";
  const user = db.prepare("SELECT id FROM admin_users WHERE username = ?").get(username) as { id: number } | undefined;
  if (!user) throw new Error(`User ${username} not found in database.`);
  const { cookieValue } = createAdminSession(user.id);
  return `${SESSION_COOKIE}=${cookieValue}`;
}

/**
 * Creates image file buffer fixtures for media upload testing.
 */
export function createMockImageBuffer(format: "jpeg" | "png" | "webp" | "avif" | "svg" | "exe", sizeBytes = 1024): Buffer {
  const buf = Buffer.alloc(sizeBytes, 0x20); // space filled
  switch (format) {
    case "jpeg":
      buf[0] = 0xff; buf[1] = 0xd8; buf[2] = 0xff; buf[3] = 0xe0;
      break;
    case "png":
      buf[0] = 0x89; buf[1] = 0x50; buf[2] = 0x4e; buf[3] = 0x47;
      buf[4] = 0x0d; buf[5] = 0x0a; buf[6] = 0x1a; buf[7] = 0x0a;
      break;
    case "webp":
      buf.write("RIFF", 0);
      buf.write("WEBP", 8);
      break;
    case "avif":
      buf.write("ftypavif", 4);
      break;
    case "svg":
      return Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>');
    case "exe":
      buf[0] = 0x4d; buf[1] = 0x5a; // MZ header
      break;
  }
  return buf;
}
