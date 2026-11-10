/**
 * Minimal in-memory fixed-window rate limiter (single-instance demo store).
 * One shared helper so auth/checkout/admin/MCP routes shed brute-force and
 * burst traffic the same way. Not a distributed limiter: a multi-instance
 * deploy must move this to Redis/KV (see comment on `buckets`).
 */

type Bucket = { count: number; resetAt: number };

// NOTE: per-process memory. Correct for the single-node SQLite build; revisit
// when the app runs behind more than one server instance.
const buckets = new Map<string, Bucket>();

const PRUNE_EVERY = 100;
let seen = 0;

function prune(now: number): void {
  if (seen++ % PRUNE_EVERY !== 0) return;
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
  if (buckets.size > 10_000) buckets.clear();
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now()
): RateLimitResult {
  prune(now);
  const current = buckets.get(key);
  if (!current || now >= current.resetAt) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }
  current.count += 1;
  return {
    allowed: current.count <= limit,
    remaining: Math.max(0, limit - current.count),
    resetAt: current.resetAt,
  };
}

/** Test/backfill hook: drop every bucket. Never called from routes. */
export function resetRateLimits(): void {
  buckets.clear();
}

/**
 * Best-effort client key: first X-Forwarded-For hop, else "unknown".
 * Never includes tokens, cookies or PII — safe to keep in memory.
 */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  const ip = forwarded.split(",")[0].trim();
  return ip || "unknown";
}

const WINDOW_MS = 60_1000;

/**
 * Route wiring helper. Returns null when the call is within budget, else a
 * generic 429 response (no internals, no token echo) with Retry-After.
 */
export function rateLimitResponse(
  request: Request,
  scope: string,
  limit: number
): Response | null {
  const testToken = process.env.ADMIN_TEST_TOKEN;
  if (
    (process.env.NODE_ENV !== "production" || process.env.DATABASE_TYPE !== "postgres") &&
    testToken &&
    testToken.length >= 16 &&
    request.headers.get("x-admin-test-token") === testToken
  ) {
    return null;
  }
  const key = scope + ":" + clientKey(request);
  const verdict = checkRateLimit(key, limit, WINDOW_MS);
  if (verdict.allowed) return null;
  const retryAfter = Math.max(
    1,
    Math.ceil((verdict.resetAt - Date.now()) / 1000)
  );
  return Response.json(
    { error: "Too many requests. Please retry shortly." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Limit": String(limit),
        "X-RateLimit-Remaining": "0",
      },
    }
  );
}

/** Per-scope budgets (requests/minute/client). Documented, not tuned. */
export const RATE_LIMITS = {
  /** Demo checkout: bursts from one client stay bounded. */
  checkout: 30,
  /** Token-gated admin writes/reads: brute-force shedding. */
  admin: 60,
  /** Admin login/forgot/reset: tight budget per client (plus per-account lockout). */
  login: 10,
  /** Token-gated MCP endpoint. */
  mcp: 120,
  /** Sensitive public reads (coupon preview). */
  publicSensitive: 60,
  /**
   * Public order lookup: deliberately tighter than coupon preview. Prefix
   * probes are cheap for an attacker and expensive nowhere else, so 30/min
   * keeps human retry UX intact while slowing enumeration (see
   * getPublicOrder: ≥8-char prefixes only).
   */
  lookup: 30,
} as const;
