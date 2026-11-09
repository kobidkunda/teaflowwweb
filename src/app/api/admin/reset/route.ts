import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { resetSchema } from "@/lib/validation";
import { invalid } from "@/lib/adminHttp";
import { rateLimitResponse, RATE_LIMITS } from "@/lib/rateLimit";
import { logger } from "@/lib/logger";
import { getUserById, updateUserPassword } from "@/lib/adminUsers";
import { revokeUserSessions } from "@/lib/adminSessions";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

function sha256hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

// POST /api/admin/reset { token, password } → 200 { ok:true }. Tokens are
// single-use, expire after 60 minutes, and a successful reset revokes every
// session of that user. Generic 400 on any invalid/expired/used token.
export async function POST(request: Request) {
  const limited = rateLimitResponse(request, "login", RATE_LIMITS.login);
  if (limited) return limited;
  const body: unknown = await request.json().catch(() => null);
  const parsed = resetSchema.safeParse(body);
  if (!parsed.success) return invalid(parsed.error.flatten());
  const row = (() => {
    try {
      return getDb().prepare("SELECT * FROM password_reset_tokens WHERE token_hash=?").get(sha256hex(parsed.data.token)) as
        | { user_id: number; expires_at: string; used_at: string | null }
        | undefined;
    } catch {
      return undefined;
    }
  })();
  const invalidLink = () => NextResponse.json({ error: "Invalid or expired reset link." }, { status: 400 });
  if (!row || row.used_at) return invalidLink();
  if (!Number.isFinite(Date.parse(row.expires_at)) || Date.parse(row.expires_at) <= Date.now()) return invalidLink();
  const user = getUserById(row.user_id);
  if (!user || user.is_active !== 1) return invalidLink();
  try {
    updateUserPassword(user.id, parsed.data.password);
    getDb().prepare("UPDATE password_reset_tokens SET used_at=CURRENT_TIMESTAMP WHERE token_hash=?").run(sha256hex(parsed.data.token));
    revokeUserSessions(user.id);
  } catch {
    return invalidLink();
  }
  logger.info("admin password reset", { route: "/api/admin/reset" });
  return NextResponse.json({ ok: true });
}
