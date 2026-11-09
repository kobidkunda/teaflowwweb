import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// scrypt password hashing (stdlib only, no new deps). Stored format:
//   scrypt$<N>$<r>$<p>$<saltHex>$<keyHex>
// Params match scripts/gen-admin-hash.mjs — keep them in sync.
const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;
const SALTLEN = 16;

export function hashPassword(password: string): string {
  const salt = randomBytes(SALTLEN);
  const key = scryptSync(password, salt, KEYLEN, { N, r: R, p: P });
  return ["scrypt", String(N), String(R), String(P), salt.toString("hex"), key.toString("hex")].join("$");
}

export function isHashFormat(value: string): boolean {
  return value.startsWith("scrypt$");
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const parts = stored.split("$");
    if (parts.length !== 6 || parts[0] !== "scrypt") return false;
    const n = parseInt(parts[1], 10);
    const r = parseInt(parts[2], 10);
    const p = parseInt(parts[3], 10);
    if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p)) return false;
    const salt = Buffer.from(parts[4], "hex");
    const expected = Buffer.from(parts[5], "hex");
    if (salt.length === 0 || expected.length !== KEYLEN) return false;
    const actual = scryptSync(password, salt, KEYLEN, { N: n, r, p });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

// Precomputed dummy hash so unknown-username logins burn the same scrypt
// cost as real ones (no username oracle via timing). Random salt per process.
const DUMMY_HASH = hashPassword("dummy-password-for-timing-parity");

export function verifyDummy(password: string): void {
  verifyPassword(password, DUMMY_HASH);
}
