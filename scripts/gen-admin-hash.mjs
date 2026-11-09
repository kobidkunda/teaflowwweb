// Generate ADMIN_PASSWORD_HASH for the env-root admin (migration 008).
// Usage: node scripts/gen-admin-hash.mjs 'a-strong-password-here'
// Prints env-ready lines. The password needs at least 12 characters and is
// never printed back. Params must match src/lib/password.ts.
import { randomBytes, scryptSync } from "node:crypto";

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;
const SALTLEN = 16;

const password = process.argv[2] || "";
if (!password || password.length < 12) {
  console.error("Usage: node scripts/gen-admin-hash.mjs '<password-min-12-chars>'");
  process.exit(1);
}
const salt = randomBytes(SALTLEN);
const key = scryptSync(password, salt, KEYLEN, { N, r: R, p: P });
const hash = ["scrypt", String(N), String(R), String(P), salt.toString("hex"), key.toString("hex")].join("$");
console.log("ADMIN_PASSWORD_HASH=" + hash);
console.log("# Add ADMIN_USERNAME=<name> alongside this line in .env, then POST /api/admin/login once to bootstrap root.");
